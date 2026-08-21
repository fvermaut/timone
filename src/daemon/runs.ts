import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { HELD_LABEL } from "./steps.js";
import { dirname, join } from "node:path";
import { z } from "zod";

import { PIPELINE_STAGES, type PipelineStage } from "./pipeline.js";

/**
 * A run's lifecycle. `queued` is where a pickup lands while another run holds
 * the project; the rest is the plan's `picked-up → active → parked | done |
 * failed`.
 *
 * `parked` — waiting on a human — is deliberately **not** terminal: the run
 * is unfinished and will resume where it stopped.
 *
 * `cancelled` is the abandoned ending, and it is deliberately **not**
 * `failed`: `failed` means the work broke and `timone retry` re-arms it, while
 * a run that should never have existed must not be one keystroke from
 * restarting. See {@link TRANSITIONS}, where it is the second dead end.
 */
export type RunStatus =
  | "queued"
  | "picked-up"
  | "active"
  | "parked"
  | "done"
  | "failed"
  | "cancelled";

/**
 * Statuses that occupy the one-session-at-a-time slot. A session is either
 * about to start or running, and two of those on one project would have two
 * agents in one working copy.
 */
const RUNNING: readonly RunStatus[] = ["picked-up", "active"];

/**
 * Statuses that end a run's hold on its project: it is over, so the next
 * queued ticket may be promoted. `failed` belongs here — a dead session must
 * not freeze the project behind it — and so does `cancelled`, for the same
 * reason: abandoned work must not keep a project to itself.
 *
 * See {@link isSettled}, which is deliberately narrower and is *not* a
 * duplicate of this.
 */
const TERMINAL: readonly RunStatus[] = ["done", "failed", "cancelled"];

/**
 * Statuses that **settle** a chunk: the ticket is finished with it and may
 * open its next one
 * ([ADR-0029](../../doc/adr/0029-a-chunk-advances-only-on-success.md)).
 *
 * The next reader will assume this duplicates {@link TERMINAL}. It does not —
 * the two answer different questions, and `failed` answers them differently:
 *
 * - {@link TERMINAL} is about the **project lock**. A failed run is over, so
 *   it stops holding the project and whatever queued behind it is promoted.
 * - Settledness is about the **ticket's succession**. A failed chunk is still
 *   its ticket's current business, because `timone retry <project>#<ticket>`
 *   re-arms *that* chunk in place. Letting the ticket move on would open a
 *   chunk beside the failure — the poll loop registers every marked ticket on
 *   every cycle, so within a minute — and the one-session guard would then
 *   refuse the retry, deleting the only road a broken chunk has back to
 *   working.
 *
 * A chunk advances only on success — or on being abandoned. `cancelled` is
 * **both** terminal and settled, and it has to be both: nobody is going to
 * retry it, so a cancelled chunk that stayed unsettled would hold its ticket
 * for ever and no work could ever be run on that ticket again. It is also what
 * makes the poll loop's closed-ticket cancellation self-healing — a ticket
 * reopened and re-marked simply takes its next chunk from {@link
 * RunStore.register}.
 */
const SETTLED: readonly RunStatus[] = ["done", "cancelled"];

/** Whether a chunk in this status lets its ticket move to the next one. */
function isSettled(status: RunStatus): boolean {
  return SETTLED.includes(status);
}

/**
 * Every transition the store will make; anything else is a bug, loudly.
 *
 * `active → active` is a real move, not a no-op: a run that clears one stage
 * and starts the next without a human in between re-activates under a new
 * session id, since each stage is its own session.
 *
 * `picked-up → parked` is the other one worth explaining. A run that enters
 * the pipeline at a stage waiting on a conversation — a wayfinder decision
 * ticket does, since it skips triage (ADR-0010, ADR-0022) — has never had a
 * session attached to it, and `active` means precisely that one is: `activate`
 * takes a session id. What such a run waits for is a *human*, and the session
 * that will serve them does not exist yet and may never be started by the
 * daemon at all. Routing it through `active` first would mint an id for a
 * session nobody started, and `timone status` would call the run running for
 * as long as the human took to answer.
 */
const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["picked-up", "cancelled"],
  "picked-up": ["active", "parked", "failed", "cancelled"],
  active: ["active", "parked", "done", "failed", "cancelled"],
  parked: ["active", "done", "failed", "cancelled"],
  done: [],
  // Abandoned, and abandoned for good. An empty list here is the whole of
  // "`cancelled` is deliberately not `failed`": a failure can be re-armed by
  // `timone retry`, and a run that should never have existed must not be one
  // keystroke from restarting. A ticket that deserves another go gets a
  // *fresh chunk* from `register`, because cancellation settles this one.
  cancelled: [],
  // Failure has two roads out, and they are not the same road. `timone retry`
  // re-arms the run at the stage it failed; `timone cancel` abandons it. The
  // second was added by fvermaut's ruling of 2026-08-15, because without it
  // clearing a failed run meant retrying it *first* — and the window between
  // the two commands is one the daemon polls, so a run somebody was trying to
  // delete could be picked up and spend real money before the second command
  // landed. One command now ends a run whatever state it is in.
  //
  // `done` stays a dead end: finished work is history, and a new ticket — not
  // an abandonment — is how it is reopened.
  failed: ["picked-up", "cancelled"],
};

const runSchema = z.strictObject({
  /** `<project>#<ticket>/<seq>` — see {@link runId}. */
  id: z.string(),
  project: z.string(),
  ticket: z.number().int().positive(),
  /**
   * Which chunk of its ticket this run is, counting from 1
   * ([ADR-0026](../../doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)).
   *
   * A ticket is a durable conversation and hosts a sequence of chunks over its
   * life, each with its own branch and its own pull request. This is the
   * sequence number of one of them — not an attempt count and not a retry
   * count: a re-armed run keeps its number, because it is the same chunk being
   * built again.
   *
   * Required rather than optional, unlike the other fields added since the
   * ledger was written. A run with no chunk number is a run whose identity is
   * incomplete, and every such ledger is normalised on load — see
   * {@link normaliseSequences} — so the field is never absent by the time
   * anything reads it.
   */
  seq: z.number().int().positive(),
  status: z.enum([
    "queued",
    "picked-up",
    "active",
    "parked",
    "done",
    "failed",
    "cancelled",
  ]),
  /** Lifecycle stage the run has reached, for `timone status` and for resuming. */
  stage: z.enum([...PIPELINE_STAGES]).optional(),
  /** What a parked run is waiting for, in the human's terms. */
  waitingOn: z.string().optional(),
  /**
   * Which *kind* of wait that is — what an arriving answer may resolve.
   *
   * `escalation` resolves to nothing arriving: it is a run stopped where no
   * written answer can help, waiting on a person to pick it up
   * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
   */
  waitingKind: z
    .enum(["gate", "conversation", "review", "escalation"])
    .optional(),
  /**
   * The instant the wait was opened — the gate comment, or the invitation to
   * a conversation. Anything at or before it belongs to an earlier question
   * and cannot answer this one.
   */
  waitCursor: z.string().optional(),
  /**
   * How many times running this run has read a written answer and then asked
   * again at the same stage — the count ADR-0033's floor keeps.
   *
   * Absent means none, which is what every run written before it existed
   * means too. It is here rather than only in `applyPark`'s head because the
   * ticket's words depend on it: a run that said it was stuck reads
   * differently from one that had to be caught being stuck, and only this
   * number tells them apart.
   */
  reAsksAfterAnswer: z.number().int().nonnegative().optional(),
  /**
   * The instant of the written answer this run has read and not yet acted on
   * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)).
   *
   * **It exists because {@link waitCursor} cannot carry it.** Reading an answer
   * consumes it — the cursor advances past it as part of deciding to resume —
   * and then {@link RunStore.activate} clears the wait, cursor included. A
   * session killed after that left the run `failed` with nothing pointing at
   * the answer, so `timone retry` had nothing to rewind and re-posted the
   * original question instead. That is a silent re-ask, which is not the trade
   * ADR-0023 accepted: it undertook that retry rewinds the marker.
   *
   * **Present only while the answer is outstanding.** It is written when the
   * answer is consumed, survives `activate` and {@link RunStore.fail} — the
   * whole point — and is dropped the moment the run shows the answer was acted
   * on: a new wait ({@link applyPark}), the next stage ({@link
   * RunStore.setStage}), or the run resolving ({@link RunStore.complete}). So a
   * marker that is present always names an answer nobody has finished with, and
   * `timone retry` can rewind to it without asking the human anything.
   *
   * Optional, and its absence is a legitimate state: a run that consumed
   * nothing has none, and neither has one parked by a daemon predating the
   * field — `retry` falls back to the cursor for those, as it did before.
   */
  consumedAnswerAt: z.string().optional(),
  /**
   * The work branch this run owns, once it has one. Its presence is what
   * makes a parked run hold its project — see {@link RunStore}.
   */
  branch: z.string().optional(),
  /**
   * The pull request the run's delivery opened, once one exists. What a
   * `review` wait is waiting on; kept on the run so `timone status` and the
   * poll loop name the PR without re-asking the tracker.
   */
  pr: z.number().int().positive().optional(),
  /** Agent SDK session identifier, once one has been spawned. */
  sessionId: z.string().optional(),
  /**
   * When the run last proved it was alive (ADR-0020, superseding ADR-0017).
   * Stamped by the same tick that prints the progress line, so liveness and
   * visibility are one mechanism rather than two that can disagree.
   *
   * **It is evidence, and only ever evidence *for* liveness.** A stale one
   * means the run went quiet, which means it died *only if somebody was
   * listening throughout* — see {@link RunStore.witness}. Nothing may write
   * this field to grant a run more time: that would record a heartbeat that
   * never happened.
   *
   * Optional, and its absence is a legitimate state rather than a gap: a run
   * written by a daemon older than this field has none, and a run that has
   * not ticked yet has none either. {@link RunStore.staleRuns} falls back to
   * `updatedAt` for both, which is when the run last actually moved.
   */
  heartbeatAt: z.string().optional(),
  /** Why a failed run failed. */
  failure: z.string().optional(),
  /**
   * Why a cancelled run was cancelled.
   *
   * **Its own field rather than {@link failure}, because a cancelled chunk was
   * abandoned and not broken.** The two words are read by people: `timone
   * status` prints a failure as *"stopped early"* beside the command that
   * restarts it, and `timone takeover` reports one as something that went
   * wrong. A cancellation is neither — nothing broke, and nothing is going to
   * be retried — and a reason stored under `failure` would be one substitution
   * away from being announced as a fault at every one of those surfaces.
   *
   * Optional, like every field added since the ledger was written, so a state
   * file from before this existed loads unchanged at `version: 1`.
   */
  cancellation: z.string().optional(),
  /** Guardrail-hook violations recorded against this run (R15). */
  flags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * What the daemon last knew about one pull request's preview.
 *
 * It is the record, not the preview: the containers are the adapter's, and
 * this exists so a cycle can tell "nothing has changed, say nothing" from
 * "this moved, revise what the pull request says". That is why the URL and
 * the reason are here alongside the commit — a preview whose URL changed
 * without its commit changing is still news to a reviewer.
 */
const previewRecordSchema = z.strictObject({
  project: z.string(),
  pr: z.number().int().positive(),
  /** The commit this preview was last reconciled against. */
  headSha: z.string(),
  state: z.enum(["ready", "building", "failed"]),
  url: z.string().optional(),
  reason: z.string().optional(),
  updatedAt: z.string(),
});

/**
 * That Timone has said hello on one unmarked ticket, and when.
 *
 * **The record is the mechanism, not a note about it**
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)) —
 * {@link previewRecordSchema}'s release half is the precedent. An unmarked
 * ticket stays unmarked for ever, so an introduction decided from the ticket's
 * own state would be posted on every cycle for the life of the daemon. Nothing
 * about the ticket can carry this: the alternative is reading the thread back
 * and guessing whether one of the comments there is ours, which is the guess
 * that produces duplicates.
 *
 * The instant is the *first* one, kept rather than refreshed: it answers "when
 * did you introduce yourself", and a re-record is a bug upstream rather than a
 * second introduction.
 */
const introductionRecordSchema = z.strictObject({
  project: z.string(),
  ticket: z.number().int().positive(),
  at: z.string(),
});

/**
 * What the last cycle saw of one initiative and its step tickets.
 *
 * **It is a cache and nothing in the loop depends on it.** The tracker is the
 * authority on which steps exist and which are closed; this is the daemon
 * writing down what it just read, so that `timone status` can answer without
 * a network call in front of a waiting human
 * ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
 * D5). It is at most one poll interval stale, and being stale costs a wrong
 * line on a terminal — never a wrong decision.
 */
const initiativeRecordSchema = z.strictObject({
  project: z.string(),
  /** The map ticket's number — the conversation the human filed. */
  initiative: z.number().int().positive(),
  title: z.string(),
  /** Its step tickets, in the order the approved breakdown put them. */
  steps: z.array(z.number().int().positive()),
  /** How many of them are closed. */
  done: z.number().int().nonnegative(),
  /** The step the frontier would take next, or absent when none is eligible. */
  next: z.number().int().positive().optional(),
  /**
   * That step's title, so a renderer can name it without asking the tracker.
   * Absent exactly when `next` is — the two are one fact.
   */
  nextTitle: z.string().optional(),
  at: z.string(),
});

const stateSchema = z.strictObject({
  version: z.literal(1),
  runs: z.array(runSchema),
  /**
   * Previews, keyed `<project>#<pr>`.
   *
   * **Top-level rather than a field on a run, because a preview outlives the
   * run that opened it**: a delivered run parks on `review` and its pull
   * request keeps living — through remediation, through a second reviewer,
   * possibly after the run reaches a terminal state.
   *
   * **Optional so `version` stays `1`.** Every state file written before this
   * field existed loads unchanged; nothing migrates, and a daemon rolled back
   * simply stops recording previews.
   */
  previews: z.record(z.string(), previewRecordSchema).optional(),
  /**
   * Introductions, keyed `<project>#<ticket>`.
   *
   * **Top-level rather than a field on a run, because the tickets it is about
   * have no run and must never get one** — that is PRD-02.R1's surviving
   * clause and the reason this map exists at all. Optional for the same reason
   * `previews` is: every state file written before this field existed loads
   * unchanged, `version` stays `1`, and a daemon rolled back simply stops
   * recording introductions.
   */
  introductions: z.record(z.string(), introductionRecordSchema).optional(),
  /**
   * When a poll cycle last observed the world (ADR-0020).
   *
   * **Top-level, because it describes the daemon's attention** rather than
   * anything about a run. Optional for the same reason `previews` is: every
   * state file written before it existed loads unchanged and `version` stays
   * `1`. Its absence means nobody was listening, which is not the same as
   * nothing having happened — see {@link RunStore.witness}.
   */
  /**
   * The cached picture of each initiative, keyed `<project>#<initiative>`.
   *
   * Top-level for the same reason `introductions` is: it is about a ticket
   * that has no run and must never get one — an initiative's ticket is a map
   * of its children, and the runs belong to the children. Optional for the
   * same reason as well, so `version` stays `1` and a ledger written before
   * this existed loads unchanged.
   */
  initiatives: z.record(z.string(), initiativeRecordSchema).optional(),
  observedAt: z.string().optional(),
  /**
   * When the daemon's current unbroken watch began (ADR-0020).
   *
   * A cycle finding a normal gap since {@link observedAt} carries this
   * forward; a cycle finding a large one resets it to now, because whatever
   * happened across that gap happened unobserved.
   */
  observingSince: z.string().optional(),
});

export type Run = z.infer<typeof runSchema>;
export type PreviewRecord = z.infer<typeof previewRecordSchema>;
export type IntroductionRecord = z.infer<typeof introductionRecordSchema>;
export type InitiativeRecord = z.infer<typeof initiativeRecordSchema>;
type State = z.infer<typeof stateSchema>;

/** What a cycle's {@link RunStore.witness} call establishes about the daemon. */
export interface Witness {
  /** When the current unbroken watch began. */
  observingSince: string;
  /**
   * Whether the daemon has now been continuously present for at least as long
   * as the staleness window it is about to judge. False means it has not, and
   * nothing may be reclaimed on this cycle.
   */
  mayJudge: boolean;
  /**
   * Milliseconds since the previous cycle, or undefined when there was none.
   * Carried so the log can say *how long* the daemon was away rather than
   * merely that it was — which is the difference between a line an operator
   * can act on and one they learn to ignore.
   */
  gapMs?: number;
  /** How long the current unbroken watch has run, at this cycle's instant. */
  watchedMs: number;
  /**
   * Whether the gap since the previous cycle was too large to have been
   * watched — that is, whether this cycle *reset* the watch.
   *
   * Distinct from `mayJudge` being false, and the two were briefly conflated:
   * a daemon that has watched unbroken for one second may not judge either,
   * and reporting that as "nothing was watching" is simply untrue. A witness
   * that cannot tell its own two refusals apart cannot explain either.
   */
  unwitnessedGap: boolean;
}

/** What the store needs to know to judge a cycle's witness. */
export interface WitnessOptions {
  /**
   * A gap longer than this is unwitnessed. One missed cycle is scheduler
   * jitter; two is evidence the process was not running.
   */
  unwitnessedAfterMs: number;
  /** The staleness window this cycle would judge runs against. */
  staleAfterMs: number;
  /** Override the clock, as {@link RunStore.staleRuns} allows. */
  now?: string;
}

export interface RunStoreOptions {
  /** Injected clock, so tests get deterministic timestamps. */
  now?: () => string;
}

/** Default state-file location, relative to the timone root. */
export function defaultStatePath(root: string): string {
  return join(root, ".timone", "state.json");
}

/** Options for parking a run against a human wait. */
export interface ParkOptions {
  /** What it is waiting for, in the human's terms. */
  waitingOn: string;
  /**
   * Which kind of wait it is, when the daemon will resume it from an answer —
   * or `escalation`, the wait no answer resumes (ADR-0033).
   */
  kind?: "gate" | "conversation" | "review" | "escalation";
  /** The stage it parked at, when parking moves it. */
  stage?: PipelineStage;
  /** The instant the wait was opened; answers before it are not answers to it. */
  waitCursor?: string;
  /**
   * The instant of the answer this park has read and not yet acted on — set
   * only by the consume that read it (ADR-0023). Absent on every ordinary
   * park, which is what makes an ordinary park *forget* a marker the run was
   * carrying: see {@link Run.consumedAnswerAt}.
   */
  consumedAnswerAt?: string;
}

/**
 * The daemon's run ledger: which ticket each project is working, what is
 * queued behind it, and how each run ended. Persisted to `.timone/state.json`
 * (gitignored — it is machine state, never a process artifact) and written
 * atomically after every mutation, so a crash never leaves a half-file.
 *
 * **Two rules, not one**, and keeping them apart is what phase 12 changed:
 *
 * - **One running session per project, always.** Two agents in one working
 *   copy is the collision R10 exists to prevent, so a run may only enter
 *   `picked-up` or `active` while no other run of that project is in either.
 * - **A parked run holds its project only once it owns a work branch.**
 *   Triage and clarification touch no repository — a ticket waiting there for
 *   an answer blocks nothing, and several may wait at once. From the moment a
 *   run claims a branch it holds the project until it reaches a terminal
 *   state, because from then on two runs would be two branches of work on the
 *   same repository.
 *
 * Phase 11 had only the first rule and applied it to parked runs too, which
 * meant one unanswered question froze a project indefinitely. Both rules are
 * enforced here rather than by callers: a rule about a shared resource that
 * lives in the caller is a rule the next caller will not know about.
 */
export class RunStore {
  private constructor(
    private readonly path: string,
    private state: State,
    private readonly now: () => string,
  ) {}

  /** Open the store at `path`, starting empty when the file does not exist. */
  static open(path: string, options: RunStoreOptions = {}): RunStore {
    const now = options.now ?? (() => new Date().toISOString());
    return new RunStore(path, readState(path), now);
  }

  /** Every run, in pickup order. */
  all(): Run[] {
    return this.state.runs.map((run) => ({ ...run }));
  }

  get(id: string): Run | undefined {
    const run = this.state.runs.find((candidate) => candidate.id === id);
    return run === undefined ? undefined : { ...run };
  }

  /** Every run of `project`, in pickup order. */
  runsFor(project: string): Run[] {
    return this.state.runs
      .filter((run) => run.project === project)
      .map((run) => ({ ...run }));
  }

  /**
   * Every chunk of `ticket`, in sequence order, oldest first (ADR-0026).
   *
   * **The last of them is the ticket's current chunk** — the live one wherever
   * one is live, since {@link register} only opens a new sequence number once
   * nothing of the ticket is live, and otherwise the chunk the ticket last
   * finished on. That is what the surfaces addressed to a human ask for:
   * `timone retry`, `timone takeover` and a ticket's call to action all speak
   * about a ticket, and the chunk they mean is its most recent one, whether or
   * not it is still going.
   *
   * Reads the file, as {@link occupyingRun} does and for the same reason.
   */
  runsForTicket(project: string, ticket: number): Run[] {
    this.refresh();
    return this.loadedRunsForTicket(project, ticket);
  }

  /**
   * The one chunk of `ticket` that is not settled, or undefined when none has
   * been opened or every one of them is settled (ADR-0026, ADR-0029).
   *
   * At most one can exist: {@link register} refuses to open a chunk while
   * another lives, which is what keeps a ticket's work a *sequence* rather
   * than a fan-out. `parked` counts as living — a run waiting on a human is
   * unfinished — and so does **`failed`**, which is the surprising half: a
   * failed chunk is what `timone retry` re-arms, so the ticket is not done
   * with it. Only `done` (and, from 22b, `cancelled`) ends a chunk's claim on
   * its ticket. See {@link isSettled} for why that is not {@link TERMINAL}.
   */
  liveRunForTicket(project: string, ticket: number): Run | undefined {
    this.refresh();
    return this.loadedLiveRunForTicket(project, ticket);
  }

  /**
   * The run currently holding `project`: one whose session is running or
   * about to, or one parked on a work branch it owns. Undefined when the
   * project is free — including when runs are parked awaiting answers at a
   * stage that touches no repository.
   *
   * Reads the file rather than this store's memory (ADR-0023). It is one of
   * the three the poll loop guards on, and a guard that answers from memory
   * cannot see the claim another process has just written — which is what let
   * one answer buy two sessions.
   */
  occupyingRun(project: string): Run | undefined {
    this.refresh();
    return this.loadedOccupyingRun(project);
  }

  /**
   * The run occupying `project`'s single session slot — running, or picked up
   * and awaiting a spawn. Undefined when no session is in flight, however
   * many runs are parked. Reads the file, as {@link occupyingRun} does and
   * for the same reason.
   */
  runningRun(project: string): Run | undefined {
    this.refresh();
    return this.loadedRunningRun(project);
  }

  /**
   * Every run of `project` parked on a human, in pickup order. Reads the
   * file, as {@link occupyingRun} does and for the same reason — this is the
   * list the poll loop walks when it looks for a run to resume.
   */
  parkedRuns(project: string): Run[] {
    this.refresh();
    return this.state.runs
      .filter((run) => run.project === project && run.status === "parked")
      .map((run) => ({ ...run }));
  }

  /**
   * {@link occupyingRun} over the state already in hand.
   *
   * The split is not an optimisation. A mutation holds a live reference into
   * `this.state` between {@link mutable} and {@link persist}, and a refresh in
   * that window replaces the object the reference points into — so the change
   * would be written to a state nobody persists. Every caller inside a
   * mutation asks these; every caller outside one asks the public pair, which
   * re-reads first.
   */
  private loadedOccupyingRun(project: string): Run | undefined {
    const run = this.state.runs.find(
      (candidate) => candidate.project === project && holdsProject(candidate),
    );
    return run === undefined ? undefined : { ...run };
  }

  /** {@link runsForTicket} over the state already in hand. */
  private loadedRunsForTicket(project: string, ticket: number): Run[] {
    return this.state.runs
      .filter((run) => run.project === project && run.ticket === ticket)
      .sort((left, right) => left.seq - right.seq)
      .map((run) => ({ ...run }));
  }

  /** {@link liveRunForTicket} over the state already in hand. */
  private loadedLiveRunForTicket(
    project: string,
    ticket: number,
  ): Run | undefined {
    const run = this.state.runs.find(
      (candidate) =>
        candidate.project === project &&
        candidate.ticket === ticket &&
        !isSettled(candidate.status),
    );
    return run === undefined ? undefined : { ...run };
  }

  /** {@link runningRun} over the state already in hand. */
  private loadedRunningRun(project: string): Run | undefined {
    const run = this.state.runs.find(
      (candidate) =>
        candidate.project === project && RUNNING.includes(candidate.status),
    );
    return run === undefined ? undefined : { ...run };
  }

  /** Runs waiting behind the occupying one, in pickup order. */
  queue(project: string): Run[] {
    return this.state.runs
      .filter((run) => run.project === project && run.status === "queued")
      .map((run) => ({ ...run }));
  }

  /** 1-based position of a queued run, or 0 when it is not queued. */
  queuePosition(id: string): number {
    const run = this.get(id);
    if (run === undefined || run.status !== "queued") return 0;
    return this.queue(run.project).findIndex((queued) => queued.id === id) + 1;
  }

  /**
   * Register a pickup. **Idempotent by the ticket's *live* chunk, not by the
   * ticket** ([ADR-0026](../../doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)):
   * a ticket with an unsettled chunk yields that chunk and `created: false`,
   * so re-polling a marked ticket never doubles it — and a ticket whose chunks
   * are all settled opens the next one.
   *
   * **A failed chunk is unsettled**, so it is handed back rather than
   * succeeded (ADR-0029): a chunk advances only on success, and `timone retry`
   * is how a broken one recovers. A failure that nobody will retry is ended by
   * `timone cancel` instead, which settles it — that is what lets its ticket
   * move on rather than being held for ever by a chunk that will never run.
   *
   * Until phase 22 it was idempotent by the ticket in *any* state, finished
   * included, which is what made a ticket and a run the same object. A ticket
   * is a conversation and outlives the work done under it, so a second chunk
   * has to be openable; that is the whole of the change here.
   */
  register(project: string, ticket: number): { run: Run; created: boolean } {
    this.refresh();
    const live = this.loadedLiveRunForTicket(project, ticket);
    if (live !== undefined) return { run: live, created: false };

    const timestamp = this.now();
    const holder = this.loadedOccupyingRun(project);
    const seq = nextSequence(this.loadedRunsForTicket(project, ticket));
    const run: Run = {
      id: runId(project, ticket, seq),
      project,
      ticket,
      seq,
      status: holder === undefined ? "picked-up" : "queued",
      flags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.runs.push(run);
    this.persist();
    return { run: { ...run }, created: true };
  }

  /**
   * Mark a run as running under `sessionId`. A resuming run stops waiting:
   * whatever it was parked on has been answered, and leaving the wait behind
   * would let a later poll try to resolve it twice.
   *
   * **What it does not clear is {@link Run.consumedAnswerAt}.** The answer has
   * been *read*, not acted on — that is the window ADR-0023 accepts — and this
   * is the transition a session dies just after. A marker cleared here is the
   * live fault of 2026-08-13: nothing left to rewind, so the question is asked
   * again.
   */
  activate(id: string, sessionId: string): Run {
    return this.transition(id, "active", (run) => {
      run.sessionId = sessionId;
      stopWaiting(run);
    });
  }

  /**
   * Take the run out of the pool a second process could resume it from,
   * before the session that will do the work exists (ADR-0023).
   *
   * Distinct from {@link activate} in the one way that matters: there is no
   * session id yet, because the runtime has not been asked to start one.
   * Minting a placeholder would be worse than the gap it closed — the ledger's
   * session id is what a guardrail report is matched against, so a made-up one
   * files a real session's report against the wrong run.
   *
   * **What it waits for is deliberately left on the run.** The claim exists to
   * hold the slot for a session that may still fail to start, and a claim that
   * erased the wait would leave a process that died mid-spawn with no record
   * of what the run was waiting for. {@link activate} clears it a moment
   * later, once there is really a session.
   */
  claim(id: string): Run {
    return this.transition(id, "active", () => {});
  }

  /** Park a run against a human wait, naming what it waits for. */
  park(id: string, options: ParkOptions): Run {
    return this.transition(id, "parked", (run) => {
      applyPark(run, options);
    });
  }

  /**
   * Change what an already-parked run is waiting for.
   *
   * Distinct from {@link park} on purpose. Parking is a run stopping, and
   * doing that twice is the double-flip bug the lifecycle refuses. This is a
   * different event: the run's wait was answered, it moved on, and what it
   * now waits for is not what it waited for before. Giving it its own name
   * keeps the refusal that matters while allowing the move that is real.
   */
  repark(id: string, options: ParkOptions): Run {
    const run = this.mutable(id);
    if (run.status !== "parked") {
      throw new Error(
        `Run ${id} is ${run.status}, not parked — use park() to stop a run`,
      );
    }
    applyPark(run, options);
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /**
   * Record the work branch a run owns. From here on it holds its project
   * even while parked, so this is a claim on a shared resource and not a
   * setter: the project must be free of other holders when it is made.
   */
  claimBranch(id: string, branch: string): Run {
    const run = this.mutable(id);
    const holder = this.loadedOccupyingRun(run.project);
    if (holder !== undefined && holder.id !== id) {
      throw new Error(
        `Run ${id} cannot claim a branch on ${run.project}: run ${holder.id} ` +
          `(${holder.status}) already holds it`,
      );
    }
    run.branch = branch;
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /** Record the pull request a run's delivery opened. */
  recordPullRequest(id: string, pr: number): Run {
    const run = this.mutable(id);
    run.pr = pr;
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /**
   * Finish a run, promoting whatever is queued behind it.
   *
   * A finished run holds no consumed answer: whatever it read has been acted
   * on, and that is what "resolved" means. Left behind, the marker would let a
   * later rewind reach back past a settled decision (ADR-0023).
   */
  complete(id: string): Run {
    return this.transition(id, "done", (run) => {
      run.waitingOn = undefined;
      run.consumedAnswerAt = undefined;
    });
  }

  /**
   * End a run in failure, promoting whatever is queued behind it.
   *
   * **The whole wait goes, not just the words for it.** It used to clear
   * `waitingOn` alone and leave the kind and the cursor behind, which made a
   * failed run the one state carrying a wait nothing was waiting on — `ctaFor`
   * answers on the status before it ever reaches a wait branch, and `activate`
   * cleared the leftovers on the next retry. Dead data that looks live is what
   * a later reader builds on, so it is cleared here, where the wait ends.
   *
   * **What survives is {@link Run.consumedAnswerAt}, deliberately** (ADR-0023).
   * That is the marker `timone retry` rewinds a re-armed run to, and it is the
   * one fact about a dead session that is still owed to somebody: they wrote an
   * answer, it was read, and nothing acted on it. The `waitCursor` fallback
   * beside it in `retry` is only ever reached on a **parked** run — a failed one
   * takes the `store.retry` path — so clearing the cursor here costs that
   * fallback nothing.
   */
  fail(id: string, reason: string): Run {
    return this.transition(id, "failed", (run) => {
      run.failure = reason;
      stopWaiting(run);
    });
  }

  /**
   * Abandon a run, saying why.
   *
   * The reason is written where a person will read it — `timone status` and
   * `timone cancel`'s own answer — and it is a statement of what was observed
   * rather than a verdict: the poll loop cancels on a ticket having left the
   * marked-and-open listing, which is what it can actually see.
   *
   * Everything the run was waiting for goes with it, the consumed marker
   * included. A cancelled run is nobody's business any more, and a marker left
   * behind would let a later rewind reach back past it (ADR-0023) — the same
   * reason {@link complete} clears it.
   */
  cancel(id: string, reason: string): Run {
    return this.transition(id, "cancelled", (run) => {
      run.cancellation = reason;
      stopWaiting(run);
      run.consumedAnswerAt = undefined;
    });
  }

  /**
   * Record which lifecycle stage a run reached.
   *
   * A run that has *moved on* has acted on whatever answer it was holding, so
   * the consumed marker goes with the stage it belonged to (ADR-0023). Only a
   * real change counts: the stage is also re-recorded before a resumed session
   * runs the very stage it is resuming, and clearing the marker there would
   * discard the answer that session was started on.
   */
  setStage(id: string, stage: PipelineStage): Run {
    const run = this.mutable(id);
    // A run reaching another stage is what progress looks like, so the floor's
    // count starts again there (ADR-0033). Resetting on any park would never
    // accumulate; resetting on nothing would eventually stop a run that was
    // legitimately asked twice, months apart.
    if (run.stage !== stage) {
      run.consumedAnswerAt = undefined;
      run.reAsksAfterAnswer = undefined;
    }
    run.stage = stage;
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /**
   * Promote the oldest queued run of `project` if the project is free, and
   * return it. The poll loop calls this each cycle: promotion normally
   * happens as a side effect of the run ahead moving, but a ledger written
   * under the old rule — where every parked run held its project — can hold
   * a queued run behind a park that no longer blocks anything.
   */
  promoteQueue(project: string): Run | undefined {
    this.refresh();
    this.promoteHead(project);
    this.persist();
    return this.loadedRunningRun(project);
  }

  /**
   * Re-arm a failed run at the stage it failed, keeping its branch, stage
   * and pull request — they are what "picking up where it stopped" means.
   * The transition guards still apply: a project that has moved on to
   * another run refuses, because re-arming would put two sets of work on
   * one repository.
   *
   * What it does *not* keep is everything belonging to the attempt that
   * died: its failure, its session, and its guardrail flags. The flags were
   * missed until 14g, where a re-armed run carried a warning about a file
   * whose cause had already been fixed — so `timone status` complained about
   * something that no longer existed. They are cleared here rather than in
   * `runRetry` so there is one answer to what re-arming resets.
   */
  retry(id: string): Run {
    const run = this.mutable(id);
    // Before the generic refusal, and written as a sentence: `timone retry`
    // prints whatever this throws, verbatim and with no case of its own for a
    // cancelled run, so these words are what a person sees after typing a
    // command. What they need is why there is nothing to retry and what would
    // start the work again — never that a status failed a comparison.
    if (run.status === "cancelled") {
      const because =
        run.cancellation === undefined || run.cancellation === ""
          ? "."
          : `: ${run.cancellation}.`;
      throw new Error(
        `${run.project} #${run.ticket} was cancelled${because} Cancelled work ` +
          `isn't retried — remove the \`${HELD_LABEL}\` label from the ticket ` +
          "and I'll start it afresh, or close it and I'll carry on without it.",
      );
    }
    if (run.status !== "failed") {
      throw new Error(
        `Run ${id} is ${run.status}, not failed — only a failed run can be retried`,
      );
    }
    return this.transition(id, "picked-up", (rearmed) => {
      rearmed.failure = undefined;
      rearmed.sessionId = undefined;
      rearmed.flags = [];
    });
  }

  /**
   * Stamp a run as still alive (ADR-0020, superseding ADR-0017).
   *
   * `updatedAt` is deliberately left alone: a heartbeat is not the run
   * moving, and overwriting it would erase when the run actually started —
   * which is what `timone status` reports as how long it has been running.
   */
  heartbeat(id: string): Run {
    const run = this.mutable(id);
    run.heartbeatAt = this.now();
    this.persist();
    return { ...run };
  }

  /**
   * Runs that have gone quiet: running, and with no sign of life for longer
   * than `thresholdMs`.
   *
   * **It answers "which runs are quiet", not "which runs are dead"** — a
   * distinction ADR-0020 made load-bearing. Silence is evidence of death only
   * when a daemon was present to miss it, and that question is
   * {@link witness}'s, not this one's. Nothing changed here; what changed is
   * that the caller must ask both.
   *
   * Only `active` and `picked-up` runs qualify. A parked run is waiting on a
   * human by design and may wait for weeks; a terminal one is finished.
   *
   * Staleness is judged against the run's last sign of life, which is the
   * **later** of its heartbeat and `updatedAt` — not the heartbeat alone.
   *
   * Both halves are load-bearing. Without `updatedAt` a run picked up moments
   * ago, which has never ticked, would be reclaimed instantly, and a run left
   * `active` by a daemon predating the field would be immortal. Without
   * taking the later of the two, a heartbeat from a *previous* session
   * outlives the session that wrote it: a run re-armed by `timone retry`
   * carries the old tick, and the next cycle reclaims it before it has had a
   * chance to start. That happened live on 2026-08-07.
   */
  staleRuns(thresholdMs: number, now?: string): Run[] {
    const cutoff = Date.parse(now ?? this.now()) - thresholdMs;
    return this.state.runs
      .filter((run) => RUNNING.includes(run.status))
      .filter((run) => lastSignOfLife(run) < cutoff)
      .map((run) => ({ ...run }));
  }

  /**
   * Record that a poll cycle is happening now, and answer whether the daemon
   * has watched long enough to be entitled to call anything dead (ADR-0020).
   *
   * A `setInterval` cannot fire while its process is not scheduled, so on a
   * laptop that suspends the daemon goes silent for exactly as long as the
   * session it is watching does — and a run's silence looks identical to a
   * corpse's. The daemon can prove that about *itself*: the gap between two of
   * its own cycles is measurable from inside, without asking the operating
   * system anything.
   *
   * So each cycle stamps `observedAt`, and carries `observingSince` forward
   * only when the gap since the last cycle is small enough to have been
   * jitter. Judgement is granted once the unbroken watch is at least as long
   * as the window being judged: **the daemon may only call a run quiet for two
   * minutes dead if it was present for those two minutes.**
   *
   * An absent `observedAt` — a first-ever cycle, or a state file from a daemon
   * predating this field — counts as unwitnessed, so it grants the window
   * rather than reclaiming. Conservative in the only safe direction: a late
   * reclaim costs a project two minutes, an early one costs an agent's work.
   *
   * **No run is touched.** Granting the window by rewriting each run's
   * `heartbeatAt` would record a heartbeat that never happened, and the
   * heartbeat is evidence rather than bookkeeping.
   */
  witness(options: WitnessOptions): Witness {
    this.refresh();
    const at = options.now ?? this.now();
    const nowMs = Date.parse(at);

    const previous = this.state.observedAt;
    const gapMs =
      previous === undefined ? undefined : nowMs - Date.parse(previous);
    const continuous =
      gapMs !== undefined &&
      gapMs <= options.unwitnessedAfterMs &&
      this.state.observingSince !== undefined;

    const observingSince = continuous
      ? (this.state.observingSince as string)
      : at;
    this.state.observedAt = at;
    this.state.observingSince = observingSince;
    this.persist();

    const watchedMs = nowMs - Date.parse(observingSince);
    return {
      observingSince,
      mayJudge: watchedMs >= options.staleAfterMs,
      gapMs,
      watchedMs,
      unwitnessedGap: !continuous,
    };
  }

  /** What the daemon last knew about a pull request's preview, if anything. */
  previewRecord(project: string, pr: number): PreviewRecord | undefined {
    const record = this.state.previews?.[previewKey(project, pr)];
    return record === undefined ? undefined : { ...record };
  }

  /** Every preview the daemon is currently tracking for `project`. */
  previewsFor(project: string): PreviewRecord[] {
    return Object.values(this.state.previews ?? {})
      .filter((record) => record.project === project)
      .map((record) => ({ ...record }));
  }

  /**
   * Write down what a pull request's preview now is. Returns the previous
   * record, so a caller can tell whether anything a reviewer would care
   * about actually changed — which is what keeps a per-cycle reconciler from
   * saying the same thing every minute.
   */
  recordPreview(
    project: string,
    pr: number,
    preview: { state: PreviewRecord["state"]; url?: string; reason?: string },
    headSha: string,
  ): PreviewRecord | undefined {
    this.refresh();
    const key = previewKey(project, pr);
    const previous = this.state.previews?.[key];
    this.state.previews = {
      ...this.state.previews,
      [key]: {
        project,
        pr,
        headSha,
        state: preview.state,
        url: preview.url,
        reason: preview.reason,
        updatedAt: this.now(),
      },
    };
    this.persist();
    return previous === undefined ? undefined : { ...previous };
  }

  /** Drop a preview's record. Idempotent: an absent one is already dropped. */
  forgetPreview(project: string, pr: number): void {
    this.refresh();
    const key = previewKey(project, pr);
    if (this.state.previews?.[key] === undefined) return;
    const { [key]: _dropped, ...rest } = this.state.previews;
    this.state.previews = rest;
    this.persist();
  }

  /**
   * When Timone introduced itself on `ticket`, or undefined where it never
   * has. The question a cycle asks before saying hello — asked of the ledger
   * and never of the ticket's thread, which is what keeps the answer a fact
   * rather than a guess.
   */
  /**
   * Write down what this cycle saw of an initiative, replacing whatever the
   * last one wrote.
   *
   * **Replaced whole, never merged.** The picture is a snapshot; a merge would
   * leave a step the tracker no longer lists sitting beside the ones it does,
   * and a count from one cycle beside a list from another.
   */
  rememberInitiative(picture: Omit<InitiativeRecord, "at">): void {
    this.refresh();
    this.state.initiatives = {
      ...this.state.initiatives,
      [initiativeKey(picture.project, picture.initiative)]: {
        ...picture,
        at: this.now(),
      },
    };
    this.persist();
  }

  /**
   * The initiative a step belongs to, as of the last cycle that looked — or
   * undefined for a ticket no cached picture lists.
   *
   * Undefined is an ordinary answer rather than a fault: a chore has no
   * initiative, and neither has anything the daemon has not polled since it
   * started.
   */
  initiativeFor(project: string, ticket: number): InitiativeRecord | undefined {
    this.refresh();
    return Object.values(this.state.initiatives ?? {}).find(
      (record) =>
        record.project === project &&
        // The **map's own number** as well as its steps'. The map ticket is
        // the thread the human reads, so it is the one whose standing note
        // most needs to say how far the work has got — and it is not one of
        // its own children, so matching only the steps left it the one ticket
        // in the system with nothing to report.
        (record.initiative === ticket || record.steps.includes(ticket)),
    );
  }

  /**
   * Every initiative of `project` the daemon has a picture of, oldest ticket
   * first — what `timone status` needs to say that an initiative is alive
   * between two of its steps, when no run exists to hang the line on.
   */
  initiativesFor(project: string): InitiativeRecord[] {
    this.refresh();
    return Object.values(this.state.initiatives ?? {})
      .filter((record) => record.project === project)
      .sort((a, b) => a.initiative - b.initiative);
  }

  introducedAt(project: string, ticket: number): string | undefined {
    this.refresh();
    return this.state.introductions?.[introductionKey(project, ticket)]?.at;
  }

  /**
   * Write down that Timone has now said hello on `ticket`. Idempotent, and
   * the first instant wins: a second call is a bug upstream, not a second
   * introduction, and the honest answer stays when the first one happened.
   */
  recordIntroduction(project: string, ticket: number): void {
    this.refresh();
    const key = introductionKey(project, ticket);
    if (this.state.introductions?.[key] !== undefined) return;
    this.state.introductions = {
      ...this.state.introductions,
      [key]: { project, ticket, at: this.now() },
    };
    this.persist();
  }

  /** Record a guardrail violation against a run (R15). */
  flag(id: string, violation: string): Run {
    const run = this.mutable(id);
    run.flags.push(violation);
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /**
   * Re-read the state file before writing to it.
   *
   * The daemon is no longer the only writer. Since ADR-0018 the guardrail
   * checks run as hooks in their own process, and one of the things they do is
   * flag a run — so a long-lived daemon store holding an in-memory copy from
   * before the hook ran would write that flag straight back out of existence.
   * It was silently losing exactly the record the checks exist to leave.
   *
   * Re-reading here makes last-write-wins per *mutation* rather than per
   * process, which is what makes two writers of different fields safe. It does
   * not make two daemons safe — two writers of the *same* field still race,
   * and that hazard is named and still open.
   */
  private refresh(): void {
    this.state = readState(this.path);
  }

  /** The run record, by id, for in-place mutation. Throws when unknown. */
  private mutable(id: string): Run {
    this.refresh();
    const run = this.state.runs.find((candidate) => candidate.id === id);
    if (run === undefined) throw new Error(`No such run: ${id}`);
    return run;
  }

  /**
   * Move a run to `next`, refusing illegal transitions and refusing to break
   * either rule above. Promotes the queue head whenever this move frees the
   * project — which is at the end of a run, and also when a branchless run
   * parks, since that releases the session slot while holding nothing.
   */
  private transition(
    id: string,
    next: RunStatus,
    apply: (run: Run) => void,
  ): Run {
    const run = this.mutable(id);
    const allowed = TRANSITIONS[run.status];
    if (!allowed.includes(next)) {
      throw new Error(
        `Run ${id} cannot go from ${run.status} to ${next} ` +
          `(allowed: ${allowed.join(", ") || "nothing — it is finished"})`,
      );
    }

    if (RUNNING.includes(next)) {
      const running = this.loadedRunningRun(run.project);
      if (running !== undefined && running.id !== id) {
        throw new Error(
          `Project ${run.project} already has a session for run ${running.id} ` +
            `(${running.status}) — one session per project at a time`,
        );
      }

      const holder = this.loadedOccupyingRun(run.project);
      if (holder !== undefined && holder.id !== id) {
        throw new Error(
          `Project ${run.project} is held by run ${holder.id} ` +
            `(${holder.status}, branch ${holder.branch}) — one work branch at a time`,
        );
      }
    }

    run.status = next;
    apply(run);
    run.updatedAt = this.now();

    if (TERMINAL.includes(next) || next === "parked") {
      this.promoteHead(run.project);
    }

    this.persist();
    return { ...run };
  }

  /**
   * Move the oldest queued run of `project` into `picked-up`, if the project
   * is free. "Free" is both rules at once: nothing running, and nothing
   * parked on a branch.
   */
  private promoteHead(project: string): void {
    if (this.loadedRunningRun(project) !== undefined) return;
    if (this.loadedOccupyingRun(project) !== undefined) return;
    const head = this.state.runs.find(
      (run) => run.project === project && run.status === "queued",
    );
    if (head === undefined) return;
    head.status = "picked-up";
    head.updatedAt = this.now();
  }

  /** Write the state file atomically: temp file, then rename over. */
  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    renameSync(temp, this.path);
  }
}

/**
 * A run's identity: the ticket it belongs to, and which chunk of that ticket
 * it is ([ADR-0026](../../doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)).
 *
 * The trailing `/<seq>` is the whole of the change. Until phase 22 the id was
 * `<project>#<ticket>` and a ticket therefore *was* a run, which is the
 * identity ADR-0026 ended: one ticket now hosts a sequence of chunks, each
 * with its own branch and its own pull request, and the ledger needs to tell
 * them apart.
 *
 * **The human never types the sequence.** `timone takeover ivtrends#1` and
 * `timone retry ivtrends#1` still name a ticket, because a ticket is what a
 * person has an opinion about; the sequence is the machine's bookkeeping and
 * is resolved from the ledger.
 */
export function runId(project: string, ticket: number, seq: number): string {
  return `${project}#${ticket}/${seq}`;
}

/**
 * The number the next chunk of a ticket takes: one past the highest already
 * opened, and 1 for a ticket that has never been worked. Numbers are never
 * reused, so a ticket's chunks read as the order they happened in.
 */
function nextSequence(runs: readonly Run[]): number {
  return runs.reduce((highest, run) => Math.max(highest, run.seq), 0) + 1;
}

/** One preview per pull request, keyed the same way runs are keyed. */
export function previewKey(project: string, pr: number): string {
  return `${project}#${pr}`;
}

/** How an initiative's cached picture is keyed in the ledger. */
function initiativeKey(project: string, initiative: number): string {
  return `${project}#${initiative}`;
}

/** One introduction per ticket, keyed the same way runs are keyed. */
export function introductionKey(project: string, ticket: number): string {
  return `${project}#${ticket}`;
}

/** Clear the wait a run has finished waiting on. */
function stopWaiting(run: Run): void {
  run.waitingOn = undefined;
  run.waitingKind = undefined;
  run.waitCursor = undefined;
}

/**
 * How many times running a run may read an answer and ask again at the same
 * stage before the machinery stops it
 * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
 *
 * Two, not one. Once is a stage that asked badly and may well settle the
 * question with the next answer; twice running is a stage that has proved the
 * answer does not reach what is blocking it. On ivtrends #1 it happened five
 * times.
 */
const RE_ASK_LIMIT = 2;

/**
 * What a run stopped by the floor says it is waiting on.
 *
 * The same words `escalate` writes in `session.ts` for the stage that
 * declares its own stop, and one copy of them, because from the ledger's side
 * and the reader's side the two are the same situation: the difference is only
 * who noticed.
 */
export const ESCALATION_WAIT = "me — I can't take this one further on my own.";

/**
 * Whether this park is a run reading an answer and asking the same stage's
 * question again — the loop ADR-0033's floor is under.
 *
 * **Computed here because here is the only place both halves exist.** The
 * consumed marker is transient by design (see {@link applyPark}), so the
 * incoming `run` still carries it for exactly the instant before this
 * function overwrites it, and `options` says what the run is about to wait
 * for. Detecting this anywhere else would need the marker to live longer,
 * which is the contract phase 19 was built to fix.
 */
function isReAskAfterAnswer(run: Run, options: ParkOptions): boolean {
  return (
    run.consumedAnswerAt !== undefined &&
    options.kind === "conversation" &&
    options.stage !== undefined &&
    options.stage === run.stage
  );
}

/**
 * Write a wait onto a run. Shared by {@link RunStore.park} and `repark`.
 *
 * A wait is written whole, absent fields included, which is what makes the
 * consumed marker ({@link Run.consumedAnswerAt}) transient: only the consume
 * passes one, so every other park clears it. That is the honest reading of a
 * park — the run is waiting on something new, so whatever answer it was
 * holding has been acted on.
 *
 * **And it is where the floor lives** (ADR-0033's second detector). The
 * transience above is what puts both facts here at once: the answer this run
 * read, and the wait it is about to open. A stage that read an answer and
 * asked the same question again has spent a pass to arrive where it started —
 * twice running, and the park becomes one no answer resumes, whether or not
 * the stage ever noticed anything was wrong.
 */
function applyPark(run: Run, options: ParkOptions): void {
  const reAsked = isReAskAfterAnswer(run, options);
  const count = reAsked ? (run.reAsksAfterAnswer ?? 0) + 1 : run.reAsksAfterAnswer;
  const caught = reAsked && (count ?? 0) >= RE_ASK_LIMIT;

  run.waitingOn = caught ? ESCALATION_WAIT : options.waitingOn;
  run.waitingKind = caught ? "escalation" : options.kind;
  run.waitCursor = options.waitCursor;
  run.consumedAnswerAt = options.consumedAnswerAt;
  run.reAsksAfterAnswer = count;
  if (options.stage !== undefined) run.stage = options.stage;
}

/**
 * The last moment a run showed it was alive: the later of its heartbeat and
 * the last time it moved. A heartbeat belongs to the session that wrote it
 * and says nothing about a later one, so it can only ever be evidence *for*
 * liveness — never against it.
 */
function lastSignOfLife(run: Run): number {
  const moved = Date.parse(run.updatedAt);
  const ticked = run.heartbeatAt === undefined ? Number.NaN : Date.parse(run.heartbeatAt);
  return Number.isNaN(ticked) ? moved : Math.max(moved, ticked);
}

/**
 * Whether a run holds its project against every other ticket: its session is
 * running or about to, or it is parked on a work branch it owns.
 */
function holdsProject(run: Run): boolean {
  if (RUNNING.includes(run.status)) return true;
  return run.status === "parked" && run.branch !== undefined;
}

/**
 * Bring a ledger written before a run had a chunk number into the current
 * shape, before it is validated (ADR-0026).
 *
 * **The old id is the whole of the evidence, and it is enough.** Every run
 * written under the old identity is `<project>#<ticket>` with no `/`, and
 * every one of them was the entirety of its ticket's work — ADR-0026 says so
 * in as many words: existing runs are "already conformant", each a ticket with
 * exactly one chunk. So the normalisation is one rule with no judgement in it:
 * an id with no `/` is chunk 1, and gets told so.
 *
 * **Idempotent, because it runs constantly.** {@link RunStore.refresh} re-reads
 * the file at the top of every public read and every mutation, so this is on
 * the hot path rather than a start-up step. A run whose id already carries a
 * `/` is returned untouched, so a second pass changes nothing and allocates
 * nothing.
 *
 * **It normalises rather than migrating**: `version` stays `1` and no file is
 * rewritten on its account. The normalised shape reaches disk the next time
 * something persists, and until then every load produces it afresh — which is
 * also what makes a rollback survivable.
 */
function normaliseSequences(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  if (!("runs" in data) || !Array.isArray(data.runs)) return data;
  return { ...data, runs: data.runs.map(normaliseSequence) };
}

/** {@link normaliseSequences} for one run: an id with no `/` is chunk 1. */
function normaliseSequence(run: unknown): unknown {
  if (typeof run !== "object" || run === null) return run;
  if (!("id" in run) || typeof run.id !== "string") return run;
  if (run.id.includes("/")) return run;
  return { ...run, id: `${run.id}/1`, seq: 1 };
}

/**
 * Read and validate the state file, or start empty. A file that exists but
 * cannot be read as valid state is an error naming the path: silently
 * starting fresh would re-pick-up every ticket the daemon has ever seen.
 */
function readState(path: string): State {
  if (!existsSync(path)) return { version: 1, runs: [] };

  const raw = readFileSync(path, "utf8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot parse daemon state file "${path}": ${reason}`);
  }

  const result = stateSchema.safeParse(normaliseSequences(data));
  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) =>
          `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`Invalid daemon state file "${path}": ${details}`);
  }
  return result.data;
}
