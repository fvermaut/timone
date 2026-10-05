import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type {
  MergeOutcome,
  PullRequest,
  PullRequestThread,
  RepositoryBranches,
  Step,
  Ticket,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../../adapters/ticketing.js";
import type { PipelineStage } from "../../daemon/pipeline.js";
import { SessionProgress } from "../../daemon/progress.js";
import { RunStore, type Run, type RunStatus } from "../../daemon/runs.js";
import type { TimonePin } from "../../daemon/session.js";
import type { StepResult, StepSession, StepSessionInput } from "../../daemon/step-session.js";
import { HELD_LABEL } from "../../daemon/steps.js";
import { RunningSteps, type RunnerActionDeps } from "../actions.js";
import { appendEntry, readRecord, type RecordEntry } from "../record.js";
import { wakeRunner, type RunQuery, type WakeEnd } from "../session.js";
import { REPLAY_MANIFEST, type Moment, type RunningStepAtMoment } from "./cases.js";

/**
 * The stand-ins a replay try runs on, and the try itself (PRD-05 R18).
 *
 * **Only the world outside is fake.** Each try runs the real `wakeRunner`:
 * the real brief, the real rules, the real session options, the real tool
 * server and the real actions with every check they make. What they reach is
 * a forge that serves the case's ticket, pull request and files and records
 * every write, a step starter that records what it was asked to start and
 * starts nothing, a ledger and a run record in a temporary folder, and a
 * clock stopped at the case's moment.
 *
 * **What is judged is what reached the stand-ins**, never what the model
 * wrote in its own words: model output is the least trusted input there is,
 * and a runner that says it started the build has started nothing.
 */

/**
 * One thing the runner's actions did to the world outside, as the stand-ins
 * saw it, in the order it happened.
 *
 * - `step-started` — a step session was started, at `stage`, with the
 *   runner's instructions, as the record's `step-started` entry names it.
 * - `step-not-started` — a start the case makes fail, as a clone that timed
 *   out fails it (#143, #161).
 * - `posted` — a comment on the ticket or on the run's pull request.
 * - `hold` — the hold label put on the ticket or taken off; `label` is any
 *   other label.
 * - `timone-issue-filed`, `timone-issue-commented` — on Timone's own tracker.
 * - `ticket-closed` — the run's ticket was closed.
 * - `step-messaged`, `step-stopped` — said to a running step.
 * - `other` — any other write, which no action of the runner is expected to
 *   make; listed so that a failure line shows it.
 */
export type Call =
  | { kind: "step-started"; stage: PipelineStage; instructions: string }
  | { kind: "step-not-started"; error: string }
  | { kind: "posted"; where: "ticket" | "pull-request"; body: string }
  | { kind: "hold"; on: boolean }
  | { kind: "label"; label: string; on: boolean }
  | { kind: "timone-issue-filed"; title: string; body: string }
  | { kind: "timone-issue-commented"; number: number; body: string }
  | { kind: "ticket-closed"; reason: "completed" | "not-planned" }
  | { kind: "step-messaged"; text: string }
  | { kind: "step-stopped" }
  | { kind: "other"; what: string };

/** Everything one try did, as the stand-ins and the run record saw it. */
export interface Seen {
  calls: readonly Call[];
  /** The record entries the machine wrote during the try, oldest first. */
  entries: readonly RecordEntry[];
  /** The run's status in the ledger once the try was over. */
  status: RunStatus;
}

/** Whether a try chose what the case asks for, and when not, what was wanted. */
export type Verdict = { ok: true } | { ok: false; wanted: string };

/**
 * How one try of a case went.
 *
 * - `ran` — the runner's session ran to its end, and `seen` is what it did.
 * - `errored` — it did not: the session failed or was stopped, or the try
 *   could not be set up. Nothing it did is judged, because a runner that
 *   cannot finish a wake has not chosen anything.
 *
 * `costUsd` is what the runner's session cost, as the record's
 * `runner-ended` entry says; an errored session was paid for all the same.
 */
export type Try =
  | { kind: "ran"; seen: Seen; costUsd: number }
  | { kind: "errored"; error: string; costUsd: number };

/**
 * The version of Timone every step of the replay would be built from. Fixed,
 * so a request is built the way the daemon builds it, with a workspace, and
 * no git runs to find it.
 */
const REPLAY_PIN: TimonePin = {
  remote: "https://github.com/fvermaut/timone.git",
  commit: "0a905f3c6e1d2b4a59788796a5b4c3d2e1f00a1b",
};

/** A ticket that is neither a step ticket nor a run answering a review. */
const PLAIN_TICKET = { isStep: false, isRemediation: false };

/**
 * One try of `moment`: set the world up as it was, wake the runner once with
 * `runQuery`, and say what reached the stand-ins.
 *
 * **Never throws.** A try that cannot be set up, or a wake that throws, is an
 * errored try, which the case counts as failed. Each try has a folder of its
 * own, removed afterwards, so three tries never see each other's writes and
 * nothing is written under the real `.timone/`.
 */
export async function runTry(moment: Moment, runQuery: RunQuery): Promise<Try> {
  const root = mkdtempSync(join(tmpdir(), "timone-replay-"));
  try {
    return await tryIn(root, moment, runQuery);
  } catch (error) {
    return { kind: "errored", error: `the try broke: ${oneLine(error)}`, costUsd: costIn(root, moment) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** {@link runTry}, in the folder `root`. */
async function tryIn(root: string, moment: Moment, runQuery: RunQuery): Promise<Try> {
  const project = projectOf(moment);
  const store = RunStore.open(join(root, ".timone", "state.json"), { now: () => moment.now });
  const run = placeRun(store, moment);
  for (const entry of moment.record) {
    appendEntry(root, project.name, moment.ticket.number, entry);
  }

  const log = new CallLog();
  const running = new RunningSteps();
  if (moment.run.status === "active") {
    running.set(run.id, runningStepOf(moment.run.step, log, moment.now));
  }
  const adapter = recordingForge(moment, project, log);
  const startStep = recordingStarter(moment, log);
  const actionsFor = (): RunnerActionDeps => ({
    store,
    adapter,
    manifest: REPLAY_MANIFEST,
    root,
    timonePin: async () => REPLAY_PIN,
    project,
    ticketContext: moment.context ?? PLAIN_TICKET,
    startStep,
    running,
    // A step here never ends, so nothing ever calls this; the driver's part
    // of a step's end is not what the replay tests.
    stepEnded: async () => {},
    clock: () => moment.now,
    log: () => {},
  });

  const end = await wakeRunner(
    { runQuery, actionsFor },
    run,
    moment.events,
    moment.checkSince === undefined ? {} : { checkSince: moment.checkSince },
  );
  const entries = writtenDuring(root, moment);
  const costUsd = runnerCost(entries);
  const status = store.get(run.id)?.status ?? run.status;
  return tryEnded(end, { calls: log.calls(entries), entries, status }, costUsd);
}

/** A try, from how its wake ended. */
function tryEnded(end: WakeEnd, seen: Seen, costUsd: number): Try {
  switch (end.kind) {
    case "ended":
      return { kind: "ran", seen, costUsd };
    case "failed":
      return { kind: "errored", error: `the runner's session failed: ${end.error}`, costUsd };
    case "stopped":
      return { kind: "errored", error: "the runner's session was stopped", costUsd };
    case "not-woken":
      return {
        kind: "errored",
        error: "the runner was not woken: the case's run is not one the runner wakes for",
        costUsd,
      };
    default:
      return end satisfies never;
  }
}

/** The case's project, as the adapter and the actions address it. */
function projectOf(moment: Moment): TicketingProject {
  const config = REPLAY_MANIFEST.projects[moment.project];
  if (config === undefined) {
    throw new Error(`the replay's manifest has no project called ${moment.project}`);
  }
  return { name: moment.project, repoUrl: config.repo_url };
}

/**
 * Put the case's run in the ledger, as it stood at the moment: its branch,
 * its pull request, its stage, and whether it waits or has a step running.
 * The store is new, so the run is the ticket's first, and its id is the one
 * the case's record entries name.
 *
 * The planner has let the run build (ADR-0065 D2), so a case whose runner
 * starts the build is judged on that choice, not on a refusal for want of
 * the planner's decision, which no recorded case was made with.
 */
function placeRun(store: RunStore, moment: Moment): Run {
  const { run } = store.register(moment.project, moment.ticket.number);
  store.decidePlanner(run.id, {
    kind: "build",
    at: moment.now,
    reason: "The replay's runs are let build, so each case is judged on its choice.",
  });
  const at = moment.run;
  switch (at.status) {
    case "picked-up":
      break;
    case "parked":
      if (at.branch !== undefined) store.claimBranch(run.id, at.branch);
      if (at.pr !== undefined) store.recordPullRequest(run.id, at.pr);
      store.setStage(run.id, at.stage);
      store.park(run.id, {
        waitingOn: at.waitingOn,
        kind: "runner",
        stage: at.stage,
        resolvableBy: [at.stage],
      });
      break;
    case "active":
      store.claimBranch(run.id, at.branch);
      if (at.pr !== undefined) store.recordPullRequest(run.id, at.pr);
      store.setStage(run.id, at.stage);
      store.activate(run.id, at.step.sessionId);
      break;
    default:
      return at satisfies never;
  }
  const placed = store.get(run.id);
  if (placed === undefined) throw new Error(`the run ${run.id} is not in the ledger`);
  return placed;
}

/** The record entries written during the try: those after the case's own. */
function writtenDuring(root: string, moment: Moment): RecordEntry[] {
  const read = readRecord(root, moment.project, moment.ticket.number);
  if (!read.ok) throw new Error(read.error.message);
  return read.value.slice(moment.record.length);
}

/** What the runner's sessions cost, from their `runner-ended` entries. */
function runnerCost(entries: readonly RecordEntry[]): number {
  return entries.reduce(
    (sum, entry) => (entry.kind === "runner-ended" ? sum + entry.costUsd : sum),
    0,
  );
}

/** What was spent in `root` so far, or nothing when its record cannot be read. */
function costIn(root: string, moment: Moment): number {
  try {
    return runnerCost(writtenDuring(root, moment));
  } catch {
    return 0;
  }
}

/**
 * The calls of one try, in order. A step's stage and instructions are not
 * known when it is started — the actions write them in the record just after
 * — so a step is kept by its session id until the try is over, and then
 * named from its `step-started` entry.
 */
class CallLog {
  private readonly seen: (Call | { kind: "pending-step"; sessionId: string })[] = [];

  push(call: Call): void {
    this.seen.push(call);
  }

  stepStarted(sessionId: string): void {
    this.seen.push({ kind: "pending-step", sessionId });
  }

  calls(entries: readonly RecordEntry[]): Call[] {
    return this.seen.map((call): Call => {
      if (call.kind !== "pending-step") return call;
      const started = entries.find(
        (entry) => entry.kind === "step-started" && entry.sessionId === call.sessionId,
      );
      return started?.kind === "step-started"
        ? { kind: "step-started", stage: started.stage, instructions: started.instructions ?? "" }
        : { kind: "other", what: `started session ${call.sessionId}, which the record does not name` };
    });
  }
}

/**
 * The step starter: it records the start and starts nothing. The session it
 * hands back never ends, so the run stays as a started step leaves it, and
 * whatever the runner says to it is recorded.
 *
 * A case may make its first starts fail, with the error a real start gave.
 */
function recordingStarter(
  moment: Moment,
  log: CallLog,
): (input: StepSessionInput) => Promise<StepSession> {
  const failures = [...(moment.startFailures ?? [])];
  let started = 0;
  return async () => {
    const failure = failures.shift();
    if (failure !== undefined) {
      log.push({ kind: "step-not-started", error: failure });
      throw new Error(failure);
    }
    started += 1;
    const sessionId = `replay-step-${started}`;
    log.stepStarted(sessionId);
    return recordingSession(sessionId, log);
  };
}

/** A step session that never ends, and records what is said to it. */
function recordingSession(
  sessionId: string,
  log: CallLog,
  progress?: SessionProgress,
): StepSession {
  return {
    sessionId,
    completed: new Promise<StepResult>(() => {}),
    ...(progress === undefined ? {} : { progress }),
    stop: () => log.push({ kind: "step-stopped" }),
    send: (text) => log.push({ kind: "step-messaged", text }),
  };
}

/** The step the case has running, with what it did so far. */
function runningStepOf(step: RunningStepAtMoment, log: CallLog, now: string) {
  return {
    stage: step.stage,
    startedAt: step.startedAt,
    session: recordingSession(step.sessionId, log, progressOf(step, now)),
  };
}

/**
 * What the running step did, as the machine watched it: its tool calls fed,
 * at their own times, into the same {@link SessionProgress} a real step's
 * output is fed into. The brief reads the step's activity from it.
 */
function progressOf(step: RunningStepAtMoment, now: string): SessionProgress {
  let at = Date.parse(step.startedAt);
  const progress = new SessionProgress({ now: () => at });
  for (const [index, use] of step.tools.entries()) {
    at = Date.parse(use.at);
    progress.observe(sdkMessage({ type: "stream_event", parent_tool_use_id: null, event: { type: "message_start" } }));
    progress.observe(
      sdkMessage({
        type: "stream_event",
        parent_tool_use_id: null,
        event: { type: "message_delta", usage: { output_tokens: 240 } },
      }),
    );
    progress.observe(
      sdkMessage({
        type: "assistant",
        parent_tool_use_id: null,
        message: {
          content: [{ type: "tool_use", id: `toolu_replay_${index}`, name: use.name, input: use.input }],
        },
        session_id: step.sessionId,
      }),
    );
  }
  at = Date.parse(now);
  return progress;
}

/**
 * A message of a step's output stream, written for the replay. Only the
 * fields {@link SessionProgress} reads are filled in; the cast is the one the
 * TypeScript standard allows for fixture data.
 */
function sdkMessage(message: Record<string, unknown>): SDKMessage {
  return message as SDKMessage;
}

/**
 * The forge of one try: it serves the case's ticket, pull request, files and
 * open Timone issues, and records every write in the order it came. A
 * comment posted here is added to the thread it was posted on, as the forge
 * would add it, so a later read in the same wake sees it.
 */
function recordingForge(moment: Moment, project: TicketingProject, log: CallLog): TicketingAdapter {
  const thread: TicketThread = {
    ...moment.ticket,
    labels: [...moment.ticket.labels],
    comments: [...moment.ticket.comments],
  };
  const pr = moment.pullRequest;
  const prComments = [...(pr?.comments ?? [])];
  const runBranch = moment.run.status === "picked-up" ? undefined : moment.run.branch;
  let issues = 900;
  let steps = 800;

  const isTicket = (on: TicketingProject, number: number): boolean =>
    on.name === project.name && number === thread.number;
  const isTimone = (on: TicketingProject): boolean => on.name === "timone";
  const byMachine = (body: string) => ({
    author: "timone-agent",
    body,
    createdAt: moment.now,
    fromTimone: true,
  });

  /** The files on `branch`: the default branch's, and the run's branch's on top. */
  const filesOn = (branch: string): Readonly<Record<string, string>> | undefined => {
    if (branch === "main") return moment.files.main;
    if (branch === runBranch) return { ...moment.files.main, ...(moment.files.branch ?? {}) };
    return undefined;
  };

  const pullRequestOf = (): PullRequest | undefined =>
    pr === undefined
      ? undefined
      : { number: pr.number, title: pr.title, url: pr.url, state: pr.state, headSha: pr.headSha };

  return {
    async listPullRequestFiles(): Promise<string[]> {
      return [];
    },
    async readBranches(_on, branch?: string): Promise<RepositoryBranches> {
      const known = branch !== undefined && filesOn(branch) !== undefined;
      return {
        defaultBranch: "main",
        defaultHead: "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
        ...(known ? { head: "9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c" } : {}),
      };
    },
    async mergeIntoDefault(_on, branch): Promise<MergeOutcome> {
      log.push({ kind: "other", what: `merged ${branch} into the default branch` });
      return { merged: false, reason: "the replay merges nothing" };
    },
    async aheadOfDefault(_on, branch) {
      return branch === runBranch ? (moment.ahead ?? 0) : undefined;
    },
    async behindDefault() {
      return { behind: 0, defaultHead: "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39" };
    },
    async readFile(_on, branch, path) {
      return filesOn(branch)?.[path];
    },
    async listFiles(_on, branch, directory) {
      const files = filesOn(branch);
      if (files === undefined) return undefined;
      const under = Object.keys(files).filter(
        (path) => path.startsWith(`${directory}/`) && !path.slice(directory.length + 1).includes("/"),
      );
      return under.length === 0 ? undefined : under;
    },
    async listMarkedTickets(): Promise<Ticket[]> {
      return [ticketOf(thread)];
    },
    async listOpenTickets(on): Promise<Ticket[]> {
      if (!isTimone(on)) return [ticketOf(thread)];
      return (moment.timoneIssues ?? []).map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: "",
        labels: ["bug"],
        url: issue.url,
        author: "fvermaut",
        createdAt: "2026-09-01T09:00:00Z",
      }));
    },
    async listSteps(): Promise<Step[]> {
      return [];
    },
    async createStep(_on, _initiative, step) {
      log.push({ kind: "other", what: `opened a step ticket: "${step.title}"` });
      steps += 1;
      return steps;
    },
    async createIssue(on, issue) {
      if (isTimone(on)) log.push({ kind: "timone-issue-filed", title: issue.title, body: issue.body });
      else log.push({ kind: "other", what: `opened an issue on ${on.name}: "${issue.title}"` });
      issues += 1;
      return issues;
    },
    async blockStep(_on, step, waitsFor) {
      log.push({ kind: "other", what: `made step #${step} wait for #${waitsFor}` });
    },
    async setTicketBody(_on, number) {
      log.push({ kind: "other", what: `rewrote the body of #${number}` });
    },
    async ensureLabel() {
      // Making sure a label exists changes nothing anybody reads; putting it
      // on the ticket is the call that counts, and it is recorded below.
    },
    async getTicket(on, number) {
      if (!isTicket(on, number)) {
        throw new Error(`the replay has no ticket ${on.name}#${number}`);
      }
      return { ...thread, labels: [...thread.labels], comments: [...thread.comments] };
    },
    async postComment(on, number, body) {
      if (isTicket(on, number)) {
        log.push({ kind: "posted", where: "ticket", body });
        thread.comments.push(byMachine(body));
      } else if (isTimone(on)) {
        log.push({ kind: "timone-issue-commented", number, body });
      } else {
        log.push({ kind: "other", what: `commented on ${on.name}#${number}` });
      }
    },
    async applyLabel(on, number, label) {
      if (!isTicket(on, number)) {
        log.push({ kind: "other", what: `labelled ${on.name}#${number} ${label}` });
        return;
      }
      log.push(label === HELD_LABEL ? { kind: "hold", on: true } : { kind: "label", label, on: true });
      if (!thread.labels.includes(label)) thread.labels.push(label);
    },
    async removeLabel(on, number, label) {
      if (!isTicket(on, number)) {
        log.push({ kind: "other", what: `took ${label} off ${on.name}#${number}` });
        return;
      }
      log.push(label === HELD_LABEL ? { kind: "hold", on: false } : { kind: "label", label, on: false });
      thread.labels = thread.labels.filter((each) => each !== label);
    },
    async findPullRequest(_on, branch) {
      return pr !== undefined && pr.branch === branch ? pullRequestOf() : undefined;
    },
    async findOpenPullRequestOfTicket(): Promise<undefined> {
      return undefined;
    },
    async getPullRequestThread(_on, number): Promise<PullRequestThread> {
      const found = pullRequestOf();
      if (found === undefined || found.number !== number) {
        throw new Error(`the replay has no pull request #${number}`);
      }
      return { ...found, comments: [...prComments] };
    },
    async getPullRequestBody(_on, number) {
      if (pr === undefined || pr.number !== number) {
        throw new Error(`the replay has no pull request #${number}`);
      }
      return pr.body;
    },
    async setPullRequestBody(_on, number) {
      log.push({ kind: "other", what: `rewrote the description of pull request #${number}` });
    },
    async postPullRequestComment(_on, _number, body) {
      log.push({ kind: "posted", where: "pull-request", body });
      prComments.push(byMachine(body));
    },
    async upsertPullRequestComment(_on, number) {
      log.push({ kind: "other", what: `rewrote a standing comment on pull request #${number}` });
    },
    async closeTicket(on, number, reason) {
      if (isTicket(on, number)) log.push({ kind: "ticket-closed", reason });
      else log.push({ kind: "other", what: `closed ${on.name}#${number}` });
    },
  };
}

/** A ticket without its thread. */
function ticketOf(thread: TicketThread): Ticket {
  return {
    number: thread.number,
    title: thread.title,
    body: thread.body,
    labels: [...thread.labels],
    url: thread.url,
    author: thread.author,
    createdAt: thread.createdAt,
  };
}

/** Reduce an error to its first line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}
