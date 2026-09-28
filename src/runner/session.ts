import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  McpSdkServerConfigWithInstance,
  Options,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import {
  NEEDED_FROM_YOU,
  type PullRequestThread,
  type TicketComment,
  type TicketingAdapter,
  type TicketingProject,
} from "../adapters/ticketing.js";
import { namedPeople, ticketLimitOf } from "../manifest.js";
import { technicalFault } from "../daemon/faults.js";
import { apiErrorFrom } from "../daemon/session.js";
import { askedFor } from "../daemon/outcomes.js";
import { SessionProgress } from "../daemon/progress.js";
import type { Run, RunStatus } from "../daemon/runs.js";
import { HELD_LABEL } from "../daemon/steps.js";
import {
  runnerActions,
  type RunnerActionDeps,
  type RunnerActions,
  type RunningSteps,
} from "./actions.js";
import { buildBrief, type StepActivity, type TimoneIssue } from "./brief.js";
import { gatherFacts } from "./facts.js";
import { ticketKindOf } from "./order.js";
import { appendEntry, readRecord, type RecordEntry } from "./record.js";
import {
  qualifiedRunnerToolNames,
  RUNNER_SERVER_NAME,
  runnerToolServer,
} from "./tools.js";

/**
 * The runner's session: one fresh session each time the runner is woken
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
 * D9, PRD-05 R14).
 *
 * **Nothing is kept between wakes.** A run can wait days for a person, and a
 * session held open for that long would be a process to keep alive, and a
 * memory that could drift from what really happened. So each wake starts a
 * new session, and gives it the brief: the run record, the ticket and the
 * facts, read again from the forge. [ADR-0013](../../doc/adr/0013-stateless-session-reentry.md)
 * made the same choice for the steps.
 *
 * **The runner can only act through its nine tools** (R2). The session is
 * given no built-in tool, one tool server, and a list of allowed tools that
 * holds only that server's tools. It cannot read a file, run a command, or
 * reach anything else.
 */

/**
 * The SDK's `query`, or a test's stand-in. The messages are the SDK's, and
 * they are read as `unknown`: they cross into this code from another
 * process, so each one is checked before anything is read from it.
 */
export type RunQuery = (params: { prompt: string; options: Options }) => AsyncIterable<unknown>;

/** What a runner session needs from outside. */
export interface RunnerSessionDeps {
  runQuery: RunQuery;
  /**
   * The deps of the runner's actions for `run`: its project, its ticket's
   * context, and the daemon's store, forge, root, running steps, clock and
   * log. The session reads every one of those from here too, so the brief,
   * the actions and the park read the same store and the same forge.
   */
  actionsFor: (run: Run) => RunnerActionDeps;
}

/** What one wake is asked with, beyond its events. */
export interface WakeOptions {
  /**
   * When the running step was last looked at, so the brief shows what it
   * did since then. Absent: since the step started.
   */
  checkSince?: string;
}

/**
 * The model the runner runs on, and how hard it thinks (ADR-0060 D9).
 * Judging is the whole job, and each wake reads little.
 */
export const RUNNER_MODEL = "claude-opus-5-5";
export const RUNNER_EFFORT = "medium";

/**
 * How far one session may go. A wake reads the brief and makes a few calls;
 * a session that needs more than 40 turns or $5 is going round in circles,
 * and is stopped before it spends more.
 */
export const RUNNER_MAX_TURNS = 40;
export const RUNNER_MAX_BUDGET_USD = 5;

/** How long one session may run before it is stopped. */
export const RUNNER_TIMEOUT_MS = 10 * 60_000;

/**
 * How long to wait before trying again a runner that could not reach its
 * model, in order (R16): two waits, so three tries in all. A minute clears a
 * short break in the connection, five minutes a short outage.
 */
export const RUNNER_RETRY_WAITS_MS: readonly number[] = [60_000, 300_000];

/** How often a runner that failed all three tries is tried again. */
export const RUNNER_UNREACHABLE_RETRY_MS = 15 * 60_000;

/** The label a Timone fault is filed under, as `fileTimoneIssue` files it. */
const TIMONE_BUG_LABEL = "bug";

/**
 * The runner's working directory: an empty folder of its own under the
 * Timone root. The runner has no tool that reads or writes, so nothing is
 * ever put there; it exists so that the session does not start inside a
 * managed project (ADR-0007), or inside Timone's own files.
 */
function runnerDirectory(root: string): string {
  const path = join(root, ".timone", "runner");
  mkdirSync(path, { recursive: true });
  return path;
}

/**
 * The statuses of a run the runner is woken for: one just picked up, one
 * waiting, and one whose step is running.
 */
const WAKEABLE: readonly RunStatus[] = ["picked-up", "parked", "active"];

/**
 * What a run waits for when the runner asked nothing of anyone on the
 * ticket: whatever happens there next wakes it.
 */
export const RUNNER_DEFAULT_WAIT = "the next thing that happens on this ticket";

/**
 * Put `run` on the runner's wait, whether it is waiting already or not.
 *
 * It must name a stage that can end it, because a wait nothing can end is
 * refused (ADR-0049 D6). The stage the run stopped at is the honest one; a
 * run that has not reached any stage yet stopped before sorting the request.
 */
function putOnRunnersWait(deps: RunnerActionDeps, run: Run, waitingOn: string): void {
  const options = {
    waitingOn,
    kind: "runner" as const,
    waitCursor: deps.clock(),
    resolvableBy: [run.stage ?? "triage"],
  };
  if (run.status === "parked") deps.store.repark(run.id, options);
  else deps.store.park(run.id, options);
}

/**
 * How one wake ended.
 *
 * - `not-woken` — the run had ended, or was queued, so no session started
 *   and nothing was written.
 * - `ended` — the session ran to its end. What the runner did is in the
 *   record, as its actions wrote it.
 * - `failed` — the session did not run to its end. `retry` says whether
 *   trying again soon can help: only when the model could not be reached.
 * - `stopped` — {@link RunnerSessions.stop} ended it.
 */
export type WakeEnd =
  | { kind: "not-woken" }
  | { kind: "ended"; costUsd: number }
  | { kind: "failed"; retry: boolean; costUsd: number; error: string }
  | { kind: "stopped" };

/** What the record says of a session that was stopped. */
const STOPPED = "the session was stopped";

/**
 * Wake the runner once for `run`, with the events that woke it: build the
 * brief, start one session, and write down that it woke and how it ended.
 *
 * **It never throws for a session that fails.** A failure is an answer, and
 * `failed` says whether trying again can help. The run's status and wait are
 * left as they were: the runner not answering is not the run's fault, and a
 * failed run would need a person to start it again (R16).
 *
 * `signal` is {@link RunnerSessions.stop}'s: it ends the session in flight.
 */
export async function wakeRunner(
  deps: RunnerSessionDeps,
  run: Run,
  events: readonly string[],
  options: WakeOptions = {},
  signal?: AbortSignal,
): Promise<WakeEnd> {
  const actionDeps = deps.actionsFor(run);
  let current = actionDeps.store.get(run.id);
  // A wake is asked for when something happened, and by the time its turn
  // comes the run may be over: merging the list of pieces ends it while the
  // step that recorded the approval is still reporting. A queued run is
  // waiting for its project, not for the runner. Neither is woken.
  if (current === undefined || !WAKEABLE.includes(current.status)) return { kind: "not-woken" };
  if (signal?.aborted === true) return { kind: "stopped" };
  const config = actionDeps.manifest.projects[actionDeps.project.name];
  if (config === undefined) {
    throw new Error(
      `project "${actionDeps.project.name}" is not in the manifest, so its runner cannot be woken`,
    );
  }
  // A run just picked up is put on the runner's wait before the runner
  // sees it. The runner may decide at once that there is nothing to do, and
  // the ledger lets a run end only from `active` or `parked`; and a step it
  // starts claims a parked run as it would any other.
  if (current.status === "picked-up") {
    putOnRunnersWait(actionDeps, current, RUNNER_DEFAULT_WAIT);
    current = actionDeps.store.get(run.id) ?? current;
  }
  const actions = runnerActions(actionDeps, current);
  // What the runner asked for on the ticket in this wake: the last comment
  // it posted there. Watched at the action, so it is what the runner really
  // posted, not what it meant to.
  let asked: string | undefined;
  const watched: RunnerActions = {
    ...actions,
    post: async (input) => {
      const result = await actions.post(input);
      if (result.ok && input.where === "ticket") asked = input.body;
      return result;
    },
  };
  const write = (entry: RecordEntry): void => {
    appendEntry(actionDeps.root, actionDeps.project.name, run.ticket, entry);
  };

  write({ kind: "woke", at: actionDeps.clock(), runId: run.id, events: [...events] });
  const end = await converse(deps, {
    actionDeps,
    run: current,
    events,
    options,
    limitUsd: ticketLimitOf(config),
    server: runnerToolServer(watched),
    signal,
  });
  write(
    end.kind === "ended"
      ? { kind: "runner-ended", at: actionDeps.clock(), runId: run.id, ok: true, costUsd: end.costUsd }
      : {
          kind: "runner-ended",
          at: actionDeps.clock(),
          runId: run.id,
          ok: false,
          costUsd: end.kind === "failed" ? end.costUsd : 0,
          error: end.kind === "failed" ? end.error : STOPPED,
        },
  );
  if (end.kind === "ended") await settle(actionDeps, run.id, asked);
  return end;
}

/** Everything one session is started from. */
interface Conversation {
  actionDeps: RunnerActionDeps;
  run: Run;
  events: readonly string[];
  options: WakeOptions;
  limitUsd: number;
  server: McpSdkServerConfigWithInstance;
  signal: AbortSignal | undefined;
}

/**
 * Build the brief and run one session to its end, or to its failure. Never
 * throws: a record that cannot be read, a forge that does not answer while
 * the brief is built, or an SDK that throws, is a failed session like any
 * other.
 */
async function converse(
  deps: RunnerSessionDeps,
  conversation: Conversation,
): Promise<Exclude<WakeEnd, { kind: "not-woken" }>> {
  const { actionDeps, run, signal } = conversation;
  // The limit and the default order are worked out from the record. A brief
  // built on a record that could not be read would tell the runner that
  // nothing ran and nothing was spent, so no session starts on one. Trying
  // again soon would read the same file: a person has to mend it first.
  const read = readRecord(actionDeps.root, actionDeps.project.name, run.ticket);
  if (!read.ok) return { kind: "failed", retry: false, costUsd: 0, error: read.error.message };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RUNNER_TIMEOUT_MS);
  const stop = (): void => controller.abort();
  signal?.addEventListener("abort", stop, { once: true });

  let result: ResultMessage | undefined;
  // The main thread's last word, when that word was an API error. Last
  // wins: an error the CLI recovered from is followed by a real message.
  let lastApiError: string | undefined;
  try {
    const brief = await briefFor(actionDeps, run, read.value, conversation);
    const session = deps.runQuery({
      prompt: brief.prompt,
      options: {
        model: RUNNER_MODEL,
        effort: RUNNER_EFFORT,
        systemPrompt: brief.system,
        tools: [],
        mcpServers: { [RUNNER_SERVER_NAME]: conversation.server },
        allowedTools: qualifiedRunnerToolNames(),
        settingSources: [],
        cwd: runnerDirectory(actionDeps.root),
        maxTurns: RUNNER_MAX_TURNS,
        maxBudgetUsd: RUNNER_MAX_BUDGET_USD,
        abortController: controller,
      },
    });
    for await (const message of session) {
      const assistant = assistantMessage.safeParse(message);
      if (assistant.success && assistant.data.parent_tool_use_id === null) {
        lastApiError = apiErrorFrom(assistant.data);
      }
      const parsed = resultMessage.safeParse(message);
      if (parsed.success) result = parsed.data;
    }
  } catch (error) {
    if (signal?.aborted === true) return { kind: "stopped" };
    if (timedOut) return tookTooLong(result);
    // The SDK throws when it cannot start the model's session or loses it
    // on the way: that is what trying again is for. A login that is refused
    // is refused again, so it waits for a person instead.
    const text = oneLine(error);
    return { kind: "failed", retry: technicalFault(text) !== "credentials", costUsd: 0, error: text };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
  if (signal?.aborted === true) return { kind: "stopped" };
  if (timedOut) return tookTooLong(result);
  if (result === undefined) {
    return { kind: "failed", retry: false, costUsd: 0, error: "the session ended with no result" };
  }
  const costUsd = result.total_cost_usd ?? 0;
  const error = failureOf(result, lastApiError);
  if (error === undefined) return { kind: "ended", costUsd };
  // Only a broken link, or a login that ran out and is renewed, is tried
  // again soon. A session that reached its turn or spending cap reached the
  // model; trying it again at once would spend as much again. It waits for
  // the next thing that happens on the ticket, like any other failure.
  const fault = technicalFault(error);
  const retry = !REACHED_A_CAP.includes(result.subtype) && (fault === "link" || fault === "expired");
  return { kind: "failed", retry, costUsd, error };
}

/** The result subtypes of a session that stopped at one of its caps. */
const REACHED_A_CAP: readonly string[] = ["error_max_turns", "error_max_budget_usd"];

/**
 * What went wrong in a session that ended with `result`, in its own words,
 * or undefined when nothing did.
 *
 * **A `success` is not proof on its own.** On 2026-08-07 a session died on
 * `API Error: Connection closed mid-response` and the SDK still reported
 * success; `sessionOutcomeFrom` reads the model's last word for that reason,
 * and so does this. The words are kept whole, so {@link technicalFault} can
 * tell a broken link from a refused login.
 */
function failureOf(result: ResultMessage, lastApiError: string | undefined): string | undefined {
  if (lastApiError !== undefined) return `the session stopped on an API error (${lastApiError})`;
  if (result.subtype !== "success") {
    const errors = result.errors ?? [];
    return errors.length === 0 ? result.subtype : `${result.subtype}: ${errors.join("; ")}`;
  }
  if (result.is_error === true) {
    return result.result ?? "the session reported success but flagged itself as an error";
  }
  return undefined;
}

/**
 * An SDK message from the model, as far as the runner reads it: whether it
 * was the main thread's, and the API error it carries, if any.
 */
const assistantMessage = z.object({
  type: z.literal("assistant"),
  parent_tool_use_id: z.string().nullable(),
  error: z.string().optional(),
  message: z.object({ content: z.unknown() }).optional(),
});

/**
 * A session stopped because it ran too long. It reached the model, so trying
 * again at once would only spend as much again: it waits for the next event.
 */
function tookTooLong(result: ResultMessage | undefined): Extract<WakeEnd, { kind: "failed" }> {
  return {
    kind: "failed",
    retry: false,
    costUsd: result?.total_cost_usd ?? 0,
    error: `the session ran for ${RUNNER_TIMEOUT_MS / 60_000} minutes, and was stopped`,
  };
}

/**
 * The SDK's last message of a session, as far as the runner reads it: how
 * it ended and what it cost. Checked, because it comes from another process;
 * every other field is left alone.
 */
const resultMessage = z.object({
  type: z.literal("result"),
  subtype: z.string(),
  is_error: z.boolean().optional(),
  total_cost_usd: z.number().nonnegative().optional(),
  errors: z.array(z.string()).optional(),
  result: z.string().optional(),
});

type ResultMessage = z.infer<typeof resultMessage>;

/**
 * After a wake, put the run on the runner's wait unless something else now
 * holds it: a step it started is running, or it has ended.
 *
 * **A run left picked up with nothing running holds its project for ever**,
 * and no command can move it — that was #143 and #161, and R16 rules it out.
 * An `active` run is left alone: a step's session made it active, and when
 * that step ends the driver puts the run back on the runner's wait.
 *
 * The wait names what the runner last asked for on the ticket. When it
 * posted nothing in this wake, the wait names what the ticket's newest
 * machine comment asks for (40s): a step's question, which the runner
 * judged still true. On scratch-app#62 the questions step asked four
 * questions, the runner posted nothing, and the run went on waiting on "the
 * runner to look at what the step did", so `timone status` said the wrong
 * thing. When that comment asks nothing either, what was asked before still
 * stands.
 */
async function settle(
  deps: RunnerActionDeps,
  runId: string,
  asked: string | undefined,
): Promise<void> {
  if (waitingRun(deps, runId) === undefined) return;
  const said = asked ?? (await newestMachineComment(deps, runId));
  // Read again: the forge was asked in between.
  const run = waitingRun(deps, runId);
  if (run === undefined) return;
  const standing = run.wait?.kind === "runner" ? run.wait.on : undefined;
  const waitingOn =
    (said === undefined ? undefined : askedFor(said)) ?? standing ?? RUNNER_DEFAULT_WAIT;
  putOnRunnersWait(deps, run, waitingOn);
}

/**
 * The run, when nothing else holds it now: no step of it is running, and it
 * has not ended. Otherwise undefined, and {@link settle} leaves it alone.
 */
function waitingRun(deps: RunnerActionDeps, runId: string): Run | undefined {
  const run = deps.store.get(runId);
  if (run === undefined) return undefined;
  if (deps.running.has(runId)) return undefined;
  if (run.status !== "picked-up" && run.status !== "parked") return undefined;
  return run;
}

/**
 * The words of the newest comment the machine wrote on the run's ticket, or
 * undefined when it wrote none.
 *
 * **Never a reason for the wake to fail.** A forge that does not answer
 * gives undefined, and the wait that stood before stays: the session has
 * already run, and what it did is in the record.
 */
async function newestMachineComment(
  deps: RunnerActionDeps,
  runId: string,
): Promise<string | undefined> {
  const run = deps.store.get(runId);
  if (run === undefined) return undefined;
  try {
    const ticket = await deps.adapter.getTicket(deps.project, run.ticket);
    let newest: TicketComment | undefined;
    for (const comment of ticket.comments) {
      if (!comment.fromTimone) continue;
      if (newest === undefined || Date.parse(comment.createdAt) >= Date.parse(newest.createdAt)) {
        newest = comment;
      }
    }
    return newest?.body;
  } catch (error) {
    deps.log(`runner ${runId} — the ticket could not be read to say what the run waits on: ${oneLine(error)}`);
    return undefined;
  }
}

/**
 * The brief for this wake, built from the ticket, the pull request, the
 * record and the facts as they are now.
 */
async function briefFor(
  deps: RunnerActionDeps,
  run: Run,
  record: readonly RecordEntry[],
  { events, options, limitUsd }: Pick<Conversation, "events" | "options" | "limitUsd">,
): Promise<{ system: string; prompt: string }> {
  const { adapter, project, manifest } = deps;
  const ticket = await adapter.getTicket(project, run.ticket);
  const [pullRequest, facts, timoneIssues] = await Promise.all([
    pullRequestOf(adapter, project, run),
    gatherFacts(adapter, project, run),
    openTimoneIssues(deps),
  ]);
  return buildBrief({
    project: project.name,
    run: { id: run.id },
    kind: ticketKindOf(ticket.labels, deps.ticketContext),
    ticket,
    pullRequest,
    namedPeople: namedPeople(manifest, project.name),
    record,
    facts,
    activity: activityOf(deps.running, run.id, options.checkSince),
    events,
    timoneIssues,
    // On a step ticket the hold label is the machine's own claim, put on at
    // pickup (ADR-0044 D7). Shown as a hold, it could lead the runner to do
    // nothing, and every piece of a split request would wait for ever.
    held: ticket.labels.includes(HELD_LABEL) && !deps.ticketContext.isStep,
    limitUsd,
    now: deps.clock(),
  });
}

/**
 * The run's pull request with everything said on it: the one the ledger
 * holds, or else the one the forge has for the branch, open or not. A merged
 * or closed one is still what happened to the work.
 */
async function pullRequestOf(
  adapter: TicketingAdapter,
  project: TicketingProject,
  run: Run,
): Promise<PullRequestThread | undefined> {
  const number =
    run.pr ??
    (run.branch === undefined
      ? undefined
      : (await adapter.findPullRequest(project, run.branch))?.number);
  return number === undefined ? undefined : adapter.getPullRequestThread(project, number);
}

/**
 * The open issues on Timone's own repository labelled `bug`, so the runner
 * adds to a fault already filed rather than filing it twice.
 *
 * **Never a reason not to wake.** No Timone project in the manifest, or a
 * forge that does not answer, gives an empty list: the runner is still woken
 * with everything else, and at worst files a fault a second time.
 */
async function openTimoneIssues(deps: RunnerActionDeps): Promise<TimoneIssue[]> {
  const config = deps.manifest.projects["timone"];
  if (config === undefined) return [];
  try {
    const tickets = await deps.adapter.listOpenTickets({
      name: "timone",
      repoUrl: config.repo_url,
    });
    return tickets
      .filter((ticket) => ticket.labels.includes(TIMONE_BUG_LABEL))
      .map(({ number, title, url }) => ({ number, title, url }));
  } catch (error) {
    deps.log(`runner — the open Timone issues could not be read: ${oneLine(error)}`);
    return [];
  }
}

/**
 * What the step running now has done since the last check, or undefined
 * when no step of the run is running.
 *
 * The numbers come from the step's own output, which the runtimes record in
 * a {@link SessionProgress}. A step whose runtime records nothing is shown
 * with no tools and no output, which is all that is known about it.
 */
function activityOf(
  running: RunningSteps,
  runId: string,
  checkSince: string | undefined,
): StepActivity | undefined {
  const step = running.get(runId);
  if (step === undefined) return undefined;
  const base = { stage: step.stage, startedAt: step.startedAt };
  const progress = step.session.progress;
  if (!(progress instanceof SessionProgress)) return { ...base, tools: [], outputTokens: 0 };
  const since = checkSince ?? step.startedAt;
  const seen = progress.activitySince(since);
  const silent =
    seen.lastOutputAt !== undefined && Date.parse(seen.lastOutputAt) < Date.parse(since);
  return {
    ...base,
    tools: seen.tools,
    outputTokens: seen.outputTokens,
    ...(seen.lastOutputAt === undefined ? {} : { lastOutputAt: seen.lastOutputAt }),
    ...(silent && seen.lastOutputAt !== undefined ? { silentSince: seen.lastOutputAt } : {}),
  };
}

/** Reduce an error to its first line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** A wake asked for while another of the same run was running. */
interface QueuedWake {
  events: string[];
  options: WakeOptions;
  /** Each caller that asked for it, told when it has run. */
  waiting: { resolve: () => void; reject: (error: unknown) => void }[];
}

/** A try set for later, after the runner failed to reach its model three times. */
interface LaterTry {
  timer: ReturnType<typeof setTimeout>;
  /** The events of the wake that failed: nobody has answered them yet. */
  events: string[];
  options: WakeOptions;
}

/** What is going on with one run's wakes. */
interface RunWakes {
  /** A wake of this run is running now. */
  busy: boolean;
  /** The wakes asked for meanwhile, merged into one. */
  queued?: QueuedWake;
  /** The next try of a runner that cannot reach its model. */
  later?: LaterTry;
  /** Aborted by {@link RunnerSessions.stop}: ends the session in flight and every wait. */
  stopped: AbortController;
}

/**
 * The runner's sessions, for every run: the one place a wake is asked for.
 *
 * **One wake per run at a time.** Two sessions deciding for one run at once
 * could each start a step, or one could end the run while the other posts on
 * it. So a wake asked for while one of the same run is running waits for it
 * to end. Every wake asked for meanwhile is merged into one, with all of
 * their events, oldest first: the runner then reads everything that happened
 * while it was busy, in one session, and not one session per event.
 */
export class RunnerSessions {
  private readonly deps: RunnerSessionDeps;
  private readonly runs = new Map<string, RunWakes>();

  constructor(deps: RunnerSessionDeps) {
    this.deps = deps;
  }

  /**
   * Wake the runner for `run`, with the events that happened. The promise
   * settles once that wake has run — after the one running now, when there
   * is one.
   */
  wake(run: Run, events: readonly string[], options: WakeOptions = {}): Promise<void> {
    const wakes = this.wakesOf(run.id);
    if (wakes.busy) {
      return new Promise<void>((resolve, reject) => {
        const queued = (wakes.queued ??= { events: [], options: {}, waiting: [] });
        queued.events.push(...events);
        queued.options = mergedOptions(queued.options, options);
        queued.waiting.push({ resolve, reject });
      });
    }
    const later = takeLaterTry(wakes);
    return this.drive(
      run,
      wakes,
      [...(later?.events ?? []), ...events],
      mergedOptions(later?.options ?? {}, options),
      RUNNER_RETRY_WAITS_MS,
    );
  }

  /**
   * Stop waking the runner for `run`: end the session in flight, and drop
   * the tries still to come and the wakes waiting behind it. The run is
   * being cancelled, and a runner that went on deciding for it could start a
   * step on a run nobody wants. The callers of a dropped wake are told it
   * is done.
   */
  stop(runId: string): void {
    const wakes = this.runs.get(runId);
    if (wakes === undefined) return;
    this.runs.delete(runId);
    wakes.stopped.abort();
    takeLaterTry(wakes);
    const queued = wakes.queued;
    wakes.queued = undefined;
    for (const caller of queued?.waiting ?? []) caller.resolve();
  }

  private wakesOf(runId: string): RunWakes {
    let wakes = this.runs.get(runId);
    if (wakes === undefined) {
      wakes = { busy: false, stopped: new AbortController() };
      this.runs.set(runId, wakes);
    }
    return wakes;
  }

  /** Run one wake, with its tries, then the wake queued behind it, if any. */
  private async drive(
    run: Run,
    wakes: RunWakes,
    events: string[],
    options: WakeOptions,
    waits: readonly number[],
  ): Promise<void> {
    wakes.busy = true;
    try {
      await this.tryUntilItRuns(run, wakes, events, options, waits);
    } finally {
      wakes.busy = false;
      this.next(run, wakes);
    }
  }

  /**
   * Wake the runner, and try again when it could not reach its model: after
   * each of `waits`, which for a new wake are 60 seconds, then 5 minutes
   * (R16). Nothing is posted meanwhile: a failure that goes away by itself is
   * not the reader's business.
   *
   * When the last try has failed too, the ticket is told once, and the
   * runner is tried again every 15 minutes until it answers, or until a new
   * wake takes over from it.
   */
  private async tryUntilItRuns(
    run: Run,
    wakes: RunWakes,
    events: string[],
    options: WakeOptions,
    waits: readonly number[],
  ): Promise<void> {
    const { signal } = wakes.stopped;
    for (let tried = 0; ; tried += 1) {
      const end = await wakeRunner(this.deps, run, events, options, signal);
      if (!needsAnotherTry(end)) return;
      const wait = waits[tried];
      if (wait === undefined) break;
      if (!(await pause(wait, signal))) return;
    }
    await this.tellModelUnreachable(run);
    if (signal.aborted) return;
    const timer = setTimeout(() => {
      wakes.later = undefined;
      this.drive(run, wakes, events, options, []).catch((error: unknown) => {
        this.deps.actionsFor(run).log(`runner ${run.id} — a later try failed: ${oneLine(error)}`);
      });
    }, RUNNER_UNREACHABLE_RETRY_MS);
    wakes.later = { timer, events, options };
  }

  /**
   * Tell the ticket that the machine cannot reach its model — once. The
   * record says whether it was told since the runner last answered, so the
   * tries every 15 minutes, and the wakes of a person who keeps writing, do
   * not say it again.
   *
   * It asks the reader for nothing: nothing they can do mends it, and a
   * request they cannot act on is worse than none.
   */
  private async tellModelUnreachable(run: Run): Promise<void> {
    const deps = this.deps.actionsFor(run);
    const read = readRecord(deps.root, deps.project.name, run.ticket);
    if (!read.ok) {
      deps.log(`runner ${run.id} — cannot tell whether the ticket was told: ${read.error.message}`);
      return;
    }
    if (toldModelUnreachable(read.value)) return;
    try {
      await deps.adapter.postComment(deps.project, run.ticket, modelUnreachableNotice());
    } catch (error) {
      deps.log(`runner ${run.id} — the ticket could not be told: ${oneLine(error)}`);
      return;
    }
    appendEntry(deps.root, deps.project.name, run.ticket, {
      kind: "notice",
      at: deps.clock(),
      about: MODEL_NOTICE,
    });
  }

  /**
   * Start the wake queued behind the one that just ended, or forget the run
   * when nothing is left to do for it.
   */
  private next(run: Run, wakes: RunWakes): void {
    if (wakes.stopped.signal.aborted) return;
    const queued = wakes.queued;
    if (queued === undefined) {
      if (wakes.later === undefined && this.runs.get(run.id) === wakes) this.runs.delete(run.id);
      return;
    }
    wakes.queued = undefined;
    const later = takeLaterTry(wakes);
    this.drive(
      run,
      wakes,
      [...(later?.events ?? []), ...queued.events],
      mergedOptions(later?.options ?? {}, queued.options),
      RUNNER_RETRY_WAITS_MS,
    ).then(
      () => {
        for (const caller of queued.waiting) caller.resolve();
      },
      (error: unknown) => {
        for (const caller of queued.waiting) caller.reject(error);
      },
    );
  }
}

/**
 * The options of two wakes merged into one: the earlier moment the running
 * step was last looked at, so the brief shows everything it did since.
 */
function mergedOptions(first: WakeOptions, second: WakeOptions): WakeOptions {
  const since = [first.checkSince, second.checkSince]
    .filter((moment): moment is string => moment !== undefined)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  return since === undefined ? {} : { checkSince: since };
}

/** Whether a wake that ended this way is tried again soon. */
function needsAnotherTry(end: WakeEnd): boolean {
  switch (end.kind) {
    case "not-woken":
    case "ended":
    case "stopped":
      return false;
    case "failed":
      return end.retry;
    default:
      return end satisfies never;
  }
}

/**
 * Take the try set for later off `wakes`, so a new wake runs in its place,
 * with its events. The events are kept, never dropped: nobody has answered
 * them yet.
 */
function takeLaterTry(wakes: RunWakes): LaterTry | undefined {
  const later = wakes.later;
  if (later !== undefined) clearTimeout(later.timer);
  wakes.later = undefined;
  return later;
}

/** What a `notice` entry says the ticket was told when the model could not be reached. */
const MODEL_NOTICE = "model";

/**
 * Whether the ticket was told that the model cannot be reached since the
 * runner last ran to its end. Once it answers again, a later outage is new
 * news, and is told again.
 */
function toldModelUnreachable(entries: readonly RecordEntry[]): boolean {
  let told = false;
  for (const entry of entries) {
    if (entry.kind === "runner-ended" && entry.ok) told = false;
    if (entry.kind === "notice" && entry.about === MODEL_NOTICE) told = true;
  }
  return told;
}

/**
 * What the ticket is told after the third failed try. Plain words, for a
 * reader who does not know how the machine works: what is wrong, that it is
 * not theirs, and what the machine does next.
 */
export function modelUnreachableNotice(): string {
  return [
    "**I cannot reach the model I use to decide what to do next.** I tried three times. " +
      "Nothing on this ticket changed, and nothing you did caused this. " +
      `I will keep trying every ${RUNNER_UNREACHABLE_RETRY_MS / 60_000} minutes.`,
    "",
    `${NEEDED_FROM_YOU} nothing.`,
  ].join("\n");
}

/**
 * Wait `ms`, or less when `signal` is aborted first. True when the whole
 * wait went by, false when it was stopped.
 */
function pause(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const stop = (): void => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}
