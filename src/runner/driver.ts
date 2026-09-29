import { z } from "zod";

import type {
  PullRequestThread,
  TicketingAdapter,
  TicketingProject,
  Ticket,
  TicketThread,
} from "../adapters/ticketing.js";
import { stageLabel, type PipelineStage } from "../daemon/pipeline.js";
import type { Run, RunStatus, RunStore } from "../daemon/runs.js";
import { HELD_LABEL } from "../daemon/steps.js";
import type { TimonePin } from "../daemon/session.js";
import type {
  StepResult,
  StepSession,
  StepSessionInput,
} from "../daemon/step-session.js";
import { namedPeople, ticketLimitOf, type Manifest, type ProjectConfig } from "../manifest.js";
import { STOPPED_BY_RUNNER, type RunnerActionDeps, type RunningSteps } from "./actions.js";
import { isNamedPerson } from "./brief.js";
import { limitNotice } from "./comments.js";
import { allowanceOf, isOverLimit, spentOn } from "./limit.js";
import { departureSection, departuresOf, DEPARTURES_END, DEPARTURES_START } from "./departures.js";
import { defaultOrder, standingOf, ticketKindOf, type TicketContext } from "./order.js";
import { appendEntry, readRecord, type RecordEntry } from "./record.js";
import { RUNNER_DEFAULT_WAIT, type RunnerSessions, type WakeOptions } from "./session.js";

/**
 * The runner's driver: what the poll cycle calls, once a cycle, for every
 * project the runner drives
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
 * D6, D7 and D9; PRD-05 R1, R9, R11, R12, R15 and R19).
 *
 * **It tells the runner what happened, and never what to do.** No table here
 * picks the next step (R1): the events are facts and a named person's words,
 * and the runner decides.
 *
 * **It finds what happened, and asks for a wake. It never waits for one.**
 * The old daemon started a session and awaited it, so one project's hour of
 * building held up every other project for that hour (#148). Here a wake and
 * a step each run as a promise of their own, and the cycle moves on to the
 * next project at once (R15). {@link RunnerDriver.drain} waits for them, for
 * the tests and for a daemon run with `--once`.
 */

/**
 * The runner's sessions as the driver uses them: ask for a wake, stop a
 * run's wakes. A {@link RunnerSessions} in the daemon, a stand-in in tests.
 */
export type RunnerWakes = Pick<RunnerSessions, "wake" | "stop">;

/** What the driver needs from outside. */
export interface RunnerDriverDeps {
  store: RunStore;
  adapter: TicketingAdapter;
  manifest: Manifest;
  /** The Timone root: where the run records live, and every session's `cwd`. */
  root: string;
  /**
   * Builds the runner's sessions, given the deps of each run's actions. A
   * factory because the two need each other: a wake needs the actions, and
   * the actions' `stepEnded` is the driver's.
   */
  sessionsFor: (actionsFor: (run: Run) => RunnerActionDeps) => RunnerWakes;
  /** The steps running now. One for the daemon's life, shared with every wake. */
  running: RunningSteps;
  /** One question to a model, one answer; `sdkConsult()` in the daemon. Never throws. */
  consult: (prompt: string) => Promise<string | undefined>;
  /** `startStepSession`, bound to the daemon's store, runtime and log. */
  startStep: (input: StepSessionInput) => Promise<StepSession>;
  /** `readTimoneCheckout(root).pin`: the version of Timone a step's box is built from. */
  timonePin: () => Promise<TimonePin | undefined>;
  /** The time now, as an ISO-8601 timestamp. */
  clock: () => string;
  log: (message: string) => void;
}

/** A ticket's thread, and its pull request's, each read once per cycle. */
export interface CycleThreads {
  ticket(): Promise<TicketThread>;
  pullRequest(pr: number): Promise<PullRequestThread>;
}

/** What the poll cycle already knows about a project, handed to {@link RunnerDriver.tick}. */
export interface RunnerCycle {
  /** The project's marked tickets, as this cycle listed them. */
  tickets: readonly Ticket[];
  /** Whether a ticket is a step ticket of an initiative, as this cycle's survey found. */
  isStep(ticket: number): boolean;
  /** The cycle's own reader for a ticket's threads, so nothing is fetched twice. */
  threads(ticket: number): CycleThreads;
}

/**
 * What the runner is told when a ticket has just been picked up. The machine's
 * own sentence: only a named person's words or the machine's may be an event.
 */
export const NEW_TICKET_EVENT = "A new ticket was picked up. Nothing has been done on it yet.";

/** Where a named person wrote, as the runner is told it. */
type Where = "ticket" | "pull request";

/** A check on a running step that is due: now, and since when the step was last looked at. */
interface Check {
  at: string;
  since: string;
}

/** A comment by a named person that the runner has not been told of yet. */
interface NamedComment {
  where: Where;
  author: string;
  body: string;
  createdAt: string;
}

/**
 * What the runner is told of a named person's comment: who, where, when, and
 * their words as they wrote them. Only a named person's words ever go here
 * (R10): the runner reads its events as they are given.
 */
export function commentEvent(comment: NamedComment): string {
  return `${comment.author} commented on the ${comment.where} at ${comment.createdAt}: "${comment.body}"`;
}

/**
 * What the runner is told when the run's pull request has ended. A merge is
 * a named person's yes to the work; a close without one is their no.
 */
export function pullRequestEvent(number: number, state: "merged" | "closed"): string {
  return state === "merged"
    ? `Pull request #${number} was merged.`
    : `Pull request #${number} was closed without merging.`;
}

/**
 * What a `notice` entry says the ticket was told when it reached its limit:
 * the word the runner's actions write, so the two read one record the same.
 */
const LIMIT_NOTICE = "limit";

/** What a run over its limit waits for, as `timone status` shows it. */
const LIMIT_WAIT = "a named person to allow more spending on this ticket";

/**
 * The one question put to a model about a reply to the limit notice. It asks
 * for one word, so the answer can be read without judging it.
 */
export function limitQuestion(reply: string): string {
  return (
    "A ticket reached its spending limit, and the machine asked whether to go on. " +
    `A person replied: ${reply}. ` +
    "Does this reply mean they want the work to go on? Answer with one word: YES or NO."
  );
}

/**
 * A model's answer that means yes: a first line that starts with the word
 * YES, in any case. Read strictly, because a model's words are the least
 * trusted input there is: anything else — NO, a sentence, nothing at all
 * because the model could not be reached — is no, and leaves the limit
 * where it is.
 */
const goOnAnswer = z
  .string()
  .transform((answer) => (answer.trim().split("\n")[0] ?? "").trim())
  .pipe(z.string().regex(/^yes\b/i));

/** Whether the model's answer means the person wants the work to go on. */
function meansGoOn(answer: string | undefined): boolean {
  return goOnAnswer.safeParse(answer).success;
}

/**
 * What the runner is told when a daemon that was running one of the run's
 * steps stopped, and a new one took the run back. The step's work may be
 * half done; the runner reads the branch and decides.
 */
export const DAEMON_STOPPED_EVENT = "The daemon stopped while a step was running.";

/**
 * What a `step-ended` entry says ended a step the stopped daemon took with
 * it, so a reader of the record can tell it from one the runner stopped
 * ({@link STOPPED_BY_RUNNER}) or one that failed by itself.
 */
const STOPPED_BY_DAEMON = "daemon";

/** The error a step the stopped daemon took with it ends on, in the record. */
const INTERRUPTED_STEP_ERROR = "the daemon stopped while this step was running";

/** What the runner is told when a person's terminal session on the run ended (R11). */
export const TAKEOVER_ENDED_EVENT = "The terminal session ended.";

/** How a step ended, as the record's `step-ended` entry says it. */
interface StepEnding {
  ok: boolean;
  error?: string;
  stoppedBy?: string;
}

/**
 * What the runner is told when a step of its run has ended: which step, and
 * whether it succeeded, failed — with the first line of why — or was stopped
 * because the runner asked.
 */
export function stepEndedEvent(stage: PipelineStage, ended: StepEnding): string {
  const step = `The step ${stageLabel(stage)} ended:`;
  if (ended.stoppedBy === STOPPED_BY_RUNNER) return `${step} it was stopped by you.`;
  if (ended.ok) return `${step} it succeeded.`;
  const why = (ended.error ?? "").split("\n")[0]?.trim() ?? "";
  if (why === "") return `${step} it failed, and gave no reason.`;
  return `${step} it failed: ${why}${/[.!?]$/.test(why) ? "" : "."}`;
}

/** What a run waits for once its step has ended and the runner is being woken. */
const AFTER_STEP_WAIT = "the runner to look at what the step did";

/** What a run's actions are told of its ticket before any cycle has looked at it. */
const NO_CONTEXT: TicketContext = { isStep: false, isRemediation: false };

/**
 * `body` with `section` as its first lines, in place of any list of
 * departures it held already. The old list goes with its markers and the
 * blank line after it; everything else is kept, where it was.
 */
export function withDepartures(body: string, section: string): string {
  const start = body.indexOf(DEPARTURES_START);
  const end = start === -1 ? -1 : body.indexOf(DEPARTURES_END, start);
  const rest =
    end === -1
      ? body
      : body.slice(0, start) + body.slice(end + DEPARTURES_END.length).replace(/^\r?\n(\r?\n)?/, "");
  return rest.trim() === "" ? section : `${section}\n\n${rest}`;
}

/** What the runner is told when its run's ticket left the listing of marked tickets. */
export const TICKET_CLOSED_EVENT = "The ticket was closed, or its mark was removed.";

/**
 * How often the runner is woken to look at a step that is still running
 * (ADR-0060 D7, PRD-05 R12): what it did since the last look, and whether it
 * has gone quiet, so the runner can message it or stop it.
 */
export const RUNNER_CHECK_INTERVAL_MS = 15 * 60_000;

/**
 * What the runner is told when it is woken to look at its running step. The
 * brief shows what the step did since the last check, and since when it has
 * been silent when it has.
 */
export const CHECK_EVENT = "A 15-minute check on the running step.";

/** The statuses of a run the driver looks at: one just picked up, one waiting, one working. */
const UNSETTLED: readonly RunStatus[] = ["picked-up", "active", "parked"];

/** Reduce an error to its first line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** An instant as milliseconds, for comparing two of them whatever their spelling. */
function ms(instant: string): number {
  return Date.parse(instant);
}

/**
 * How far a thread's comments have been read for this ticket, from the latest
 * `seen` mark that names it, or undefined when none does.
 */
function seenUntil(entries: readonly RecordEntry[], thread: string): string | undefined {
  let until: string | undefined;
  for (const entry of entries) {
    if (entry.kind === "seen" && entry.thread === thread) until = entry.until;
  }
  return until;
}

/** Whether the record already notes the fact `about`, so it is not told twice. */
function noticed(entries: readonly RecordEntry[], about: string): boolean {
  return entries.some((entry) => entry.kind === "notice" && entry.about === about);
}

/** When the ticket was last told it reached its limit, or undefined when it never was. */
function limitNoticeAt(entries: readonly RecordEntry[]): string | undefined {
  let at: string | undefined;
  for (const entry of entries) {
    if (entry.kind === "notice" && entry.about === LIMIT_NOTICE) at = entry.at;
  }
  return at;
}

/**
 * Whether the ticket was told of its limit since a named person last raised
 * it: after a raise, reaching the limit again is new, and is told again.
 */
function toldOfLimit(entries: readonly RecordEntry[]): boolean {
  let told = false;
  for (const entry of entries) {
    if (entry.kind === "limit-raised") told = false;
    if (entry.kind === "notice" && entry.about === LIMIT_NOTICE) told = true;
  }
  return told;
}

/** How the latest step of run `runId` at `stage` ended, from the record. */
function lastStepEnded(
  entries: readonly RecordEntry[],
  runId: string,
  stage: PipelineStage,
): StepEnding | undefined {
  let ended: StepEnding | undefined;
  for (const entry of entries) {
    if (entry.kind === "step-ended" && entry.runId === runId && entry.stage === stage) {
      ended = {
        ok: entry.ok,
        ...(entry.error === undefined ? {} : { error: entry.error }),
        ...(entry.stoppedBy === undefined ? {} : { stoppedBy: entry.stoppedBy }),
      };
    }
  }
  return ended;
}

/** Whether the runner has ever been woken for run `runId`. */
function wokeBefore(entries: readonly RecordEntry[], runId: string): boolean {
  return entries.some((entry) => entry.kind === "woke" && entry.runId === runId);
}

/**
 * Drives the runner's projects: finds the events of each run, asks for the
 * wakes, and does the bookkeeping when a step ends.
 */
export class RunnerDriver {
  private readonly deps: RunnerDriverDeps;
  private readonly sessions: RunnerWakes;
  /** The wakes and the bookkeeping still running, for {@link drain}. */
  private readonly pending = new Set<Promise<unknown>>();
  /** What the last cycle knew about each run's ticket, for its actions. */
  private readonly contexts = new Map<string, TicketContext>();
  /**
   * When the runner last looked at each run's running step. In memory: a
   * restarted daemon has no step running, so there is nothing to have looked
   * at.
   */
  private readonly lastCheck = new Map<string, string>();

  constructor(deps: RunnerDriverDeps) {
    this.deps = deps;
    this.sessions = deps.sessionsFor((run) => this.actionsFor(run));
  }

  /**
   * Look at every unsettled run of `project` once, and ask for a wake for
   * each that has something new. Returns one line per run it could not look
   * at; the other runs are still looked at.
   *
   * **Never waits for a wake.** Only the reads it needs to find the events
   * are awaited here; the wake runs on its own.
   */
  async tick(
    project: TicketingProject,
    config: ProjectConfig,
    cycle: RunnerCycle,
  ): Promise<string[]> {
    const errors: string[] = [];
    for (const run of this.deps.store.runsFor(project.name)) {
      if (!UNSETTLED.includes(run.status)) continue;
      this.contexts.set(run.id, { isStep: cycle.isStep(run.ticket), isRemediation: false });
      try {
        await this.look(run, project, config, cycle);
      } catch (error) {
        errors.push(`${project.name}: the runner could not look at #${run.ticket}: ${oneLine(error)}`);
      }
    }
    return errors;
  }

  /**
   * Find what is new for `run`, and ask for its wake when anything is.
   *
   * A record that cannot be read stops here, with nothing written: the
   * `seen` marks are in it, and reading the comments without them would wake
   * the runner again for words it was already given.
   */
  private async look(
    run: Run,
    project: TicketingProject,
    config: ProjectConfig,
    cycle: RunnerCycle,
  ): Promise<void> {
    // An active run with no step of this daemon running is held by someone
    // else: a person's terminal took it over (R11), or a daemon that stopped
    // left it, which the reclaim hands back. Nothing wakes the runner on it
    // until then, and its comments stay unread, so the runner is told of them
    // once the run is back.
    if (run.status === "active" && !this.deps.running.has(run.id)) return;
    const read = readRecord(this.deps.root, project.name, run.ticket);
    if (!read.ok) throw new Error(read.error.message);
    const entries = read.value;
    const threads = cycle.threads(run.ticket);
    const ticket = await threads.ticket();
    const pull = run.pr === undefined ? undefined : await threads.pullRequest(run.pr);

    const said = this.newComments(run, project, entries, [
      ["ticket", "ticket", ticket.comments],
      ...(pull === undefined
        ? []
        : [["pull request", `pull-request #${pull.number}`, pull.comments] as const]),
    ]);
    const events: string[] = said.map(commentEvent);
    // Each fact is told once: its notice is written when the wake that
    // carries it is asked for, and a fact already noticed is not told again.
    const notices: string[] = [];
    let check: Check | undefined;
    // **A held ticket wakes on a named person's words and nothing else.** The
    // hold is how the runner, or a person, says "wait for someone": a fact
    // arriving meanwhile is not someone. It is not lost either — it is not
    // noticed, so it is told on the first wake after the hold comes off.
    //
    // Except on a step ticket, where the same label is the machine's own
    // claim, put on at pickup (ADR-0044 D7). Read as a hold there, it would
    // keep every new step's run from ever being woken.
    const held = ticket.labels.includes(HELD_LABEL) && !cycle.isStep(run.ticket);
    if (!held) {
      if (run.status === "picked-up" && !wokeBefore(entries, run.id)) {
        events.unshift(NEW_TICKET_EVENT);
      }
      if (pull !== undefined && pull.state !== "open") {
        const about = `pull request #${pull.number} ${pull.state}`;
        if (!noticed(entries, about)) {
          events.push(pullRequestEvent(pull.number, pull.state));
          notices.push(about);
        }
      }
      // Absent from this cycle's listing is what can be seen, and the words
      // say no more than that: the ticket was closed, or its mark taken off.
      // Both mean the same to the person who did it.
      if (!cycle.tickets.some((listed) => listed.number === run.ticket)) {
        const about = `ticket #${run.ticket} no longer listed, run ${run.id}`;
        if (!noticed(entries, about)) {
          events.push(TICKET_CLOSED_EVENT);
          notices.push(about);
        }
      }
      check = this.checkDue(run);
      if (check !== undefined) events.push(CHECK_EVENT);
    }
    // **At the limit, nothing wakes the runner but a yes** (ADR-0060 D5, R8).
    // A runner session costs money like a step, so none starts while the
    // ticket is over. The one way on is a named person's reply to the limit
    // notice that means "go on": one question to a model decides that, and
    // only its yes writes the raise and wakes the runner. Anything else
    // leaves the ticket as it is; the comment is marked read all the same.
    if (isOverLimit(entries, ticketLimitOf(config))) {
      await this.atLimit(run, project, config, entries, async () => ticket.labels);
      const toldAt = limitNoticeAt(entries);
      const replies =
        toldAt === undefined ? [] : said.filter((comment) => ms(comment.createdAt) > ms(toldAt));
      if (replies.length > 0) this.track(this.askToGoOn(run, replies, events, notices, check));
      return;
    }
    if (events.length === 0) return;
    this.deliver(run, events, notices, check);
  }

  /**
   * The check on `run`'s running step, when one is due: 15 minutes after the
   * step started, or after the last check. It tells the brief to show what
   * the step did since the last look. Only asked, not yet made: the moment is
   * kept once the wake that carries it is asked for.
   */
  private checkDue(run: Run): Check | undefined {
    const step = this.deps.running.get(run.id);
    if (step === undefined) return undefined;
    const last = this.lastCheck.get(run.id);
    // A check made on an earlier step says nothing about this one.
    const since = last !== undefined && ms(last) > ms(step.startedAt) ? last : step.startedAt;
    const now = this.deps.clock();
    if (ms(now) - ms(since) < RUNNER_CHECK_INTERVAL_MS) return undefined;
    return { at: now, since };
  }

  /**
   * What a run over its limit is owed instead of a wake: the ticket is told,
   * once each time the limit is reached, what was spent, where the work
   * stands and how to allow more (R8) — in the words the runner's own
   * refusal posts, and noted in the record the same way, so the two never
   * tell it twice. `labelsOf` gives the ticket's labels, for its written
   * order; it is asked only when the ticket is told, so a cycle that has
   * already read the ticket reads it once.
   *
   * The run is put on the runner's wait for more spending to be allowed:
   * one just picked up, so it does not hold the project while nothing can
   * work on it (R16), and one already waiting, so what it waits for is what
   * `timone status` says. A step's run that is active is left to its step.
   */
  private async atLimit(
    run: Run,
    project: TicketingProject,
    config: ProjectConfig,
    entries: readonly RecordEntry[],
    labelsOf: () => Promise<readonly string[]>,
  ): Promise<void> {
    const waits = run.status === "picked-up" || run.status === "parked";
    if (waits && run.wait?.on !== LIMIT_WAIT) this.parkForRunner(run, LIMIT_WAIT);
    if (toldOfLimit(entries)) return;
    const base = ticketLimitOf(config);
    const spentUsd = spentOn(entries);
    const kind = ticketKindOf(await labelsOf(), this.contexts.get(run.id) ?? NO_CONTEXT);
    await this.deps.adapter.postComment(
      project,
      run.ticket,
      limitNotice({
        spentUsd,
        allowanceUsd: allowanceOf(entries, base),
        raiseUsd: base,
        standing: standingOf(entries, run.id, defaultOrder(kind)),
      }),
    );
    const write = (entry: RecordEntry): void => {
      appendEntry(this.deps.root, project.name, run.ticket, entry);
    };
    write({ kind: "limit-reached", at: this.deps.clock(), spentUsd });
    write({ kind: "notice", at: this.deps.clock(), about: LIMIT_NOTICE });
  }

  /**
   * Put `run` on the runner's wait, whether it is waiting already or not.
   * The wait names a stage that can end it, as every wait must (ADR-0049
   * D6): `stage` when a step just ended there, else the stage the run is at,
   * else sorting the request, which is where a run with none starts.
   */
  private parkForRunner(run: Run, waitingOn: string, stage?: PipelineStage): void {
    const options = {
      waitingOn,
      kind: "runner" as const,
      waitCursor: this.deps.clock(),
      resolvableBy: [stage ?? run.stage ?? "triage"],
      ...(stage === undefined ? {} : { stage }),
    };
    if (run.status === "parked") this.deps.store.repark(run.id, options);
    else this.deps.store.park(run.id, options);
  }

  /**
   * Ask, reply by reply and oldest first, whether a named person's reply to
   * the limit means "go on". The first yes writes `limit-raised` — which
   * allows one more limit — and wakes the runner with everything this cycle
   * found. One raise per cycle, however many replies said yes: they answered
   * one notice.
   */
  private async askToGoOn(
    run: Run,
    replies: readonly NamedComment[],
    events: readonly string[],
    notices: readonly string[],
    check: Check | undefined,
  ): Promise<void> {
    for (const reply of replies) {
      const answer = await this.deps.consult(limitQuestion(reply.body));
      if (!meansGoOn(answer)) continue;
      appendEntry(this.deps.root, run.project, run.ticket, {
        kind: "limit-raised",
        at: this.deps.clock(),
        by: reply.author,
        commentAt: reply.createdAt,
      });
      this.deliver(run, events, notices, check);
      return;
    }
  }

  /**
   * Ask for the wake, and write down the facts it tells so they are not told
   * again. Written when asked rather than when the runner has read them: a
   * wake that fails is tried again with the same events by the sessions
   * themselves, and a later one takes them over, so nothing asked for here
   * is lost.
   */
  private deliver(
    run: Run,
    events: readonly string[],
    notices: readonly string[],
    check?: Check,
  ): void {
    for (const about of notices) {
      appendEntry(this.deps.root, run.project, run.ticket, {
        kind: "notice",
        at: this.deps.clock(),
        about,
      });
    }
    const options: WakeOptions = {};
    if (check !== undefined) {
      this.lastCheck.set(run.id, check.at);
      options.checkSince = check.since;
    }
    this.track(this.sessions.wake(run, events, options));
  }

  /**
   * The comments by named people that came after the last `seen` mark of
   * each thread, oldest first, and a new mark for each thread that had any
   * comment at all.
   *
   * **The mark covers every comment read, named or not** (R10). A comment by
   * anyone else is read, marked, and dropped: it never wakes the runner and
   * never reaches it, now or on a later cycle. A thread with no mark yet is
   * read from the moment the run was picked up; what came before is on the
   * ticket, and the brief shows it.
   */
  private newComments(
    run: Run,
    project: TicketingProject,
    entries: readonly RecordEntry[],
    threads: readonly (readonly [Where, string, TicketThread["comments"]])[],
  ): NamedComment[] {
    const people = namedPeople(this.deps.manifest, project.name);
    const said: NamedComment[] = [];
    for (const [where, thread, comments] of threads) {
      const since = ms(seenUntil(entries, thread) ?? run.createdAt);
      const fresh = comments.filter((comment) => ms(comment.createdAt) > since);
      if (fresh.length === 0) continue;
      const newest = fresh.reduce((latest, comment) =>
        ms(comment.createdAt) > ms(latest.createdAt) ? comment : latest,
      );
      appendEntry(this.deps.root, project.name, run.ticket, {
        kind: "seen",
        at: this.deps.clock(),
        thread,
        until: newest.createdAt,
      });
      for (const comment of fresh) {
        if (comment.fromTimone || !isNamedPerson(people, comment.author)) continue;
        said.push({ where, author: comment.author, body: comment.body, createdAt: comment.createdAt });
      }
    }
    return said.sort((one, other) => ms(one.createdAt) - ms(other.createdAt));
  }

  /**
   * Stop everything working on run `runId`, because it was cancelled (PRD-05
   * R11): the running step's box, and the runner's session with the tries
   * still to come. Called after the cancellation is in the ledger, so the
   * step's end, when it comes, finds a cancelled run and wakes nobody.
   */
  stop(runId: string): void {
    this.deps.running.get(runId)?.session.stop();
    this.sessions.stop(runId);
    this.lastCheck.delete(runId);
  }

  /**
   * Give back a run the reclaim found stale: its holder is gone, or it went
   * quiet while the daemon watched (R16). Never failed, never re-armed: the
   * runner is woken and decides. An active run was running a step that the
   * stopped daemon took with it; a run only picked up never got as far as
   * the runner, so for the runner it is still a new ticket.
   */
  reclaimed(run: Run): void {
    this.endInterruptedSteps(run);
    this.handBack(run, run.status === "active" ? DAEMON_STOPPED_EVENT : NEW_TICKET_EVENT);
  }

  /**
   * Write the end of each step of `run` that the record shows started and
   * never shows ended: a step the stopped daemon took with it. Without it the
   * brief shows the step running now while nothing runs, and the runner waits
   * for an end that never comes (#140).
   *
   * Nothing of this daemon is still running such a step. A step's session is
   * held by the daemon process that started it, and a run whose holder is
   * alive is never reclaimed.
   *
   * A record that cannot be read gets nothing written: the runner reads it
   * too, and says why it cannot (40g).
   */
  private endInterruptedSteps(run: Run): void {
    const read = readRecord(this.deps.root, run.project, run.ticket);
    if (!read.ok) {
      this.deps.log(`runner ${run.id} — ${read.error.message}`);
      return;
    }
    const entries = read.value;
    for (const started of entries) {
      if (started.kind !== "step-started" || started.runId !== run.id) continue;
      const ended = entries.some(
        (entry) =>
          entry.kind === "step-ended" &&
          entry.runId === run.id &&
          entry.sessionId === started.sessionId,
      );
      if (ended) continue;
      appendEntry(this.deps.root, run.project, run.ticket, {
        kind: "step-ended",
        at: this.deps.clock(),
        runId: run.id,
        stage: started.stage,
        sessionId: started.sessionId,
        ok: false,
        costUsd: 0,
        error: INTERRUPTED_STEP_ERROR,
        stoppedBy: STOPPED_BY_DAEMON,
      });
    }
  }

  /**
   * Give back a run a person's terminal session held, now that the session
   * has ended (R11). The runner is woken to read what it left.
   */
  terminalEnded(run: Run): void {
    this.handBack(run, TAKEOVER_ENDED_EVENT);
  }

  /**
   * Give `run` back to the runner once something outside it has ended. The
   * run is put on the runner's wait — keeping what the runner last asked for,
   * when that is what it waits on — and a wake is asked for with `event`,
   * unless the ticket is over its limit.
   *
   * The park is done now, before this returns, so the cycle that called it
   * finds the run waiting and never holding its project with nothing
   * working on it (R16). Only the wake runs on its own.
   */
  private handBack(run: Run, event: string): void {
    const current = this.deps.store.get(run.id) ?? run;
    if (!UNSETTLED.includes(current.status)) return;
    const waitingOn = current.wait?.kind === "runner" ? current.wait.on : RUNNER_DEFAULT_WAIT;
    this.parkForRunner(current, waitingOn);
    this.track(this.ask(this.deps.store.get(run.id) ?? current, [event]));
  }

  /**
   * Ask for a wake of `run` with `events`, unless its ticket is over its
   * limit (R8): then the ticket is told, once, and nothing wakes. The record
   * is read afresh, so a raise written a moment ago counts.
   *
   * A record that cannot be read does not stop the wake. The runner's session
   * reads it too, starts nothing on a record it cannot read, and writes down
   * why (40g), which is where a person will look.
   */
  private async ask(run: Run, events: readonly string[]): Promise<void> {
    const config = this.configOf(run);
    const read = readRecord(this.deps.root, run.project, run.ticket);
    if (read.ok && isOverLimit(read.value, ticketLimitOf(config))) {
      const project = this.projectOf(run);
      await this.atLimit(
        run,
        project,
        config,
        read.value,
        async () => (await this.deps.adapter.getTicket(project, run.ticket)).labels,
      );
      return;
    }
    this.deliver(run, events, []);
  }

  /** The manifest's entry for `run`'s project. A run of a project not in it is a wiring mistake. */
  private configOf(run: Run): ProjectConfig {
    const config = this.deps.manifest.projects[run.project];
    if (config === undefined) {
      throw new Error(`project "${run.project}" is not in the manifest, so the runner cannot drive it`);
    }
    return config;
  }

  /** `run`'s project, as the forge is asked about it. */
  private projectOf(run: Run): TicketingProject {
    return { name: run.project, repoUrl: this.configOf(run).repo_url };
  }

  /** The deps of `run`'s actions, for the runner's sessions. */
  actionsFor(run: Run): RunnerActionDeps {
    return {
      store: this.deps.store,
      adapter: this.deps.adapter,
      manifest: this.deps.manifest,
      root: this.deps.root,
      timonePin: this.deps.timonePin,
      project: this.projectOf(run),
      ticketContext: this.contexts.get(run.id) ?? NO_CONTEXT,
      startStep: this.deps.startStep,
      running: this.deps.running,
      stepEnded: (runId, stage, result) => this.stepEnded(runId, stage, result),
      clock: this.deps.clock,
      log: this.deps.log,
    };
  }

  /**
   * Called by the actions once a step has ended and its end — how it went,
   * and what it cost — is written in the record. Tracked, so {@link drain}
   * waits for it; it settles once the wake is asked for.
   */
  stepEnded(runId: string, stage: PipelineStage, result: StepResult): Promise<void> {
    return this.track(this.afterStep(runId, stage, result)).then(() => undefined);
  }

  /**
   * The bookkeeping after a step: put the run back on the runner's wait,
   * bring the pull request's description up to date, and wake the runner to
   * decide what comes next (D7).
   *
   * **The run may already be over.** The step that records the approval of
   * the list of pieces ends by merging it and ending the run (40e), so a run
   * that is done, failed or cancelled by now is left as it is, and nobody is
   * woken for it.
   *
   * **A forge that fails here does not stop the wake.** The description is
   * brought up to date again after every step; the runner not being told
   * that its step ended would leave the run waiting with nothing to wake it.
   */
  private async afterStep(runId: string, stage: PipelineStage, result: StepResult): Promise<void> {
    this.lastCheck.delete(runId);
    const run = this.deps.store.get(runId);
    if (run === undefined || !UNSETTLED.includes(run.status)) return;
    this.parkForRunner(run, AFTER_STEP_WAIT, stage);
    const read = readRecord(this.deps.root, run.project, run.ticket);
    const entries = read.ok ? read.value : [];
    if (!read.ok) this.deps.log(`runner ${runId} — ${read.error.message}`);
    try {
      await this.rewriteDepartures(runId, entries);
    } catch (error) {
      this.deps.log(`runner ${runId} — the pull request's description was not brought up to date: ${oneLine(error)}`);
    }
    const ended = lastStepEnded(entries, runId, stage) ?? {
      ok: result.outcome.ok,
      ...(result.outcome.error === undefined ? {} : { error: result.outcome.error }),
    };
    await this.ask(this.deps.store.get(runId) ?? run, [stepEndedEvent(stage, ended)]);
  }

  /**
   * Record the run's pull request whenever the branch's open one is not the
   * one the ledger holds, and put the list of departures at the top of its
   * description (R5), in place of the list written after the step before.
   * The rest of the description — what the step wrote, and anything a person
   * added — is kept as it was.
   *
   * Worked out from the record, which only the machine writes, and never
   * from what the runner says of itself.
   */
  private async rewriteDepartures(runId: string, entries: readonly RecordEntry[]): Promise<void> {
    const run = this.deps.store.get(runId);
    if (run?.branch === undefined) return;
    const project = this.projectOf(run);
    const { adapter } = this.deps;
    const found = await adapter.findPullRequest(project, run.branch);
    if (found?.state !== "open") return;
    // **The ledger follows the branch's open pull request** (40r). A run now
    // waits on its pull request, and the poll reads only the one the ledger
    // names. When that one was closed and the redone work opened another,
    // the new one's comments and its merge would otherwise never reach the
    // runner, and the run would wait with nothing to wake it.
    if (run.pr !== found.number) this.deps.store.recordPullRequest(run.id, found.number);
    const ticket = await adapter.getTicket(project, run.ticket);
    const kind = ticketKindOf(ticket.labels, this.contexts.get(run.id) ?? NO_CONTEXT);
    const section = departureSection(departuresOf(entries, run.id, defaultOrder(kind)));
    const body = await adapter.getPullRequestBody(project, found.number);
    const next = withDepartures(body, section);
    if (next !== body) await adapter.setPullRequestBody(project, found.number, next);
  }

  /**
   * Wait for every wake and every piece of bookkeeping asked for so far, and
   * for any they asked for in turn. For the tests, and for `--once`.
   */
  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  /**
   * Keep `promise` until it settles, so {@link drain} can wait for it, and
   * log a failure rather than leave a rejection nobody awaits.
   */
  private track<T>(promise: Promise<T>): Promise<T | undefined> {
    const kept: Promise<T | undefined> = promise
      .catch((error: unknown) => {
        this.deps.log(`runner — ${oneLine(error)}`);
        return undefined;
      })
      .finally(() => this.pending.delete(kept));
    this.pending.add(kept);
    return kept;
  }
}
