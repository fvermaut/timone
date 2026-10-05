import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import {
  holderLiveness,
  holderSchema,
  type Hold,
  type Holder,
  type Liveness,
} from "./holder.js";
import { DEFAULT_PLACES } from "../manifest.js";
import { PIPELINE_STAGES, type PipelineStage } from "./pipeline.js";

/**
 * A run's lifecycle: `picked-up → active → parked | done | cancelled`.
 *
 * ✏ 2026-10-04: `queued` was removed
 * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)
 * D2). Every pickup opens a run as `picked-up`, and a run waits for a place
 * only once its runner tries a step — see {@link Run.place}. A queued run an
 * older ledger holds is read as picked up — see {@link normaliseQueued}.
 *
 * `parked` — waiting for the runner — is deliberately **not** terminal: the
 * run is unfinished, and the next thing that happens on its ticket wakes the
 * runner.
 *
 * `cancelled` is the one ending that is not success. ✏ 2026-09-30: `failed`
 * was removed with the old code between steps, which was the only code that
 * wrote it. A run an older ledger holds as failed is read as cancelled — see
 * {@link normaliseOldPath}.
 */
export type RunStatus =
  | "picked-up"
  | "active"
  | "parked"
  | "done"
  | "cancelled";

/**
 * Statuses in which a session is running or about to: what
 * {@link RunStore.staleRuns} judges. ✏ 2026-10-04: no longer a rule about the
 * project. Which runs may have a step running at once is the place rule —
 * see {@link RunStore}.
 */
const RUNNING: readonly RunStatus[] = ["picked-up", "active"];

/**
 * A run refused `active` because every place on its project is taken
 * (ADR-0063 D1, D2). The message names the run that takes the place, by its
 * run id, so the runner and a person reading the record can find it.
 */
export class NoPlaceError extends Error {
  constructor(project: string, holder: Run) {
    super(`No place is free on ${project}: ${whoTakesThePlace(holder)}.`);
    this.name = "NoPlaceError";
  }
}

/**
 * Statuses that **settle** a chunk: the ticket is finished with it and may
 * open its next one
 * ([ADR-0029](../../doc/adr/0029-a-chunk-advances-only-on-success.md)).
 *
 * This is about the **ticket's succession**. A chunk advances only on
 * success — or on being abandoned. `cancelled` settles a chunk, and it has to: a cancelled chunk that stayed unsettled would hold its ticket for
 * ever and no work could ever be run on that ticket again. A ticket reopened
 * and re-marked simply takes its next chunk from {@link RunStore.register}.
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
 * `picked-up → parked` is the other one worth explaining. The runner puts a
 * run it has just picked up on its own wait before it looks at it, and a
 * takeover of a ticket with no run does the same. Neither has had a session
 * attached to it, and `active` means precisely that one is: `activate` takes
 * a session id. Routing such a run through `active` first would mint an id
 * for a session nobody started, and `timone status` would call the run
 * running while nothing was.
 *
 * ✏ 2026-09-30: every move into and out of `failed`, and `active →
 * picked-up`, were removed with the old code between steps, which was the
 * only code that made them.
 */
const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  "picked-up": ["active", "parked", "cancelled"],
  active: ["active", "parked", "done", "cancelled"],
  parked: ["active", "done", "cancelled"],
  // `done` is a dead end: finished work is history, and a new ticket — not an
  // abandonment — is how it is reopened.
  done: [],
  // Abandoned, and abandoned for good. A ticket that deserves another go gets
  // a *fresh chunk* from `register`, because cancellation settles this one.
  cancelled: [],
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
  status: z.enum(["picked-up", "active", "parked", "done", "cancelled"]),
  /** Lifecycle stage the run has reached, for `timone status` and for resuming. */
  stage: z.enum([...PIPELINE_STAGES]).optional(),
  /**
   * What this run is waiting for, whole
   * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
   * D5). It replaces `waitingOn`, `waitingKind` and `waitCursor`, which were
   * three fields that were always written together and could nevertheless be
   * read apart.
   *
   * **Its absence carries meaning and is not the same as an empty one.** A
   * parked run with no wait at all is a different thing from a wait nothing
   * can resolve, which D6 refuses outright.
   *
   * Old ledgers are folded into this shape on load, as {@link
   * normaliseSequences} folds a run with no chunk number.
   */
  wait: z
    .strictObject({
      /** What it is waiting for, in the human's terms. */
      on: z.string(),
      /**
       * `runner`: the run waits for the next thing that happens on its
       * ticket
       * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)).
       * Whatever happens wakes the runner, and the runner decides.
       *
       * ✏ 2026-09-30: the one kind left. The gate, the conversation, the
       * review and the escalation were the old code's own waits, and the
       * ledger reads each of them as the runner's. The field stays because
       * the runner reads it: `handBack` in `src/runner/driver.ts` and
       * `settle` in `src/runner/session.ts` keep a wait's words only when
       * its kind is `runner`.
       *
       * **Optional, and its absence is its own state**: a wait that names no
       * kind has words for the human and nothing else.
       */
      kind: z.enum(["runner"]).optional(),
      /** The instant the wait was opened. */
      opened: z.string().optional(),
      /**
       * Which stages may end this wait (ADR-0049 D5), recorded when it is
       * opened rather than worked out when it is read.
       *
       * **It may not be empty** (D6). A wait nothing can end is a run that
       * will sit for the life of the ledger with its ticket asking a person
       * for something, and the refusal makes it unwritable rather than
       * detectable. An *absent wait* is a different thing and stays legal —
       * see {@link Run.wait}.
       *
       * Optional only for a ledger written before this existed; every wait
       * written from here on has one, and the normalisation gives an old one
       * the stage it was parked at.
       */
      resolvableBy: z.array(z.enum([...PIPELINE_STAGES])).optional(),
    })
    .optional(),
  /**
   * The work branch this run owns, once it has one. ✏ 2026-10-04: it takes
   * no place on the project (ADR-0063 D1), so several runs of one project may
   * own branches at the same time.
   */
  branch: z.string().optional(),
  /**
   * The pull request the run's delivery opened, once one exists. What a
   * `review` wait is waiting on; kept on the run so `timone status` and the
   * poll loop name the PR without re-asking the tracker.
   */
  pr: z.number().int().positive().optional(),
  /**
   * The run's place on its project
   * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)),
   * from the first time it asks for one.
   *
   * `priority` and `openedAt` are the two facts that decide its turn: whether
   * its ticket carries the `priority:high` label, and when the ticket was
   * opened on the forge. They are read from the ticket at each try to start a
   * step, so a label added later counts from the next try (D2).
   * `waitingSince` means the run waits for a place. `givenAt` means a place is
   * given to it and not yet used: it takes the place until its next step
   * starts, or until it gives the place back (D3).
   *
   * Optional, so every ledger written before places existed loads unchanged.
   */
  place: z
    .strictObject({
      priority: z.boolean(),
      openedAt: z.string(),
      waitingSince: z.string().optional(),
      givenAt: z.string().optional(),
    })
    .optional(),
  /**
   * That a person's terminal holds this run through `timone takeover`, so it
   * takes no place on its project (ADR-0063 D5). Set by a claim made for a
   * takeover, and cleared when the run leaves `active`. Absent on every other
   * run.
   */
  takenOver: z.literal(true).optional(),
  /**
   * The terminal that waits for this run's running step to end, so that the
   * step's end hands the run to it instead of waking the runner
   * ([ADR-0067](../../doc/adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md)
   * D1). Written by {@link RunStore.waitForStep}, and cleared when the run
   * leaves `active` and when it is claimed. Absent on every other run.
   */
  waitingTerminal: holderSchema.optional(),
  /**
   * The planner's decision on this run
   * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
   * D2): whether its build may start now. The build is refused until there
   * is one.
   *
   * `askedAt` set and no `decision` means the run waits for the planner.
   * A `hold` decision means the planner holds it until the tickets in
   * `waitsFor` are merged or closed; a `build` decision means it may build.
   * `onComment` is the named person's comment a decision was taken on. The
   * decision stays on a finished run, as a record of what was decided.
   *
   * Optional, so every ledger written before the planner existed loads
   * unchanged.
   */
  planner: z
    .strictObject({
      askedAt: z.string().optional(),
      decision: z
        .strictObject({
          kind: z.enum(["build", "hold"]),
          at: z.string(),
          reason: z.string(),
          waitsFor: z.array(z.number().int().positive()).optional(),
          onComment: z.strictObject({ by: z.string(), at: z.string() }).optional(),
        })
        .optional(),
    })
    .optional(),
  /** Agent SDK session identifier, once one has been spawned. */
  sessionId: z.string().optional(),
  /**
   * Who is holding this run right now — a daemon session, or a terminal that
   * took it over
   * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
   * D1), in the shape the ledger lock has held since ADR-0025.
   *
   * **It is the run's proof of life**, and it answers a question no clock can:
   * `heartbeatAt` and `updatedAt` say whether something wrote recently, which
   * is not the same as whether anybody is there. A spawn the daemon refused
   * eighty times kept stamping `updatedAt` and the run looked alive for 83
   * minutes because the daemon kept failing to start it (timone#75).
   *
   * **Absent means held by nobody**, and that is a legitimate state rather
   * than a gap: a run just picked up, a parked one, a finished one, and every run
   * written before this field existed. Those are judged by witnessed time
   * exactly as before (ADR-0020) — see {@link RunStore.hold}.
   */
  holder: holderSchema.optional(),
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
  /**
   * Why a cancelled run was cancelled.
   *
   * The words are read by people, in `timone status` and `timone takeover`.
   * A run the old code left failed is read as cancelled, and its reason lands
   * here — see {@link normaliseOldPath}.
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

/**
 * What the running daemon's **own process** is built from, and what the
 * default branch had moved to when it last managed to look
 * ([timone#5](https://github.com/fvermaut/timone/issues/5)).
 *
 * **About the daemon's process and nothing else.** A daemon loads its code
 * once, at start-up, and keeps running it until somebody restarts it. A *run*
 * is never stale in the same way: it pins its own commit and refuses one the
 * remote does not carry (ADR-0041 D1), so a message that did not say which of
 * the two it meant would send an operator to restart the wrong thing.
 *
 * **The holder is here so a record left behind by a stopped daemon says
 * nothing.** Once the process is gone there is no daemon running old code —
 * there is no daemon — and `timone status` would otherwise ask for a restart
 * of something that is not running (ADR-0025's evidence, reused).
 *
 * Optional in the state file for the same reason `previews` is: every ledger
 * written before this field existed loads unchanged and `version` stays `1`.
 */
const daemonRecordSchema = z.strictObject({
  /** The commit the daemon's process started on. */
  commit: z.string(),
  /**
   * The default branch's tip, when the remote could be asked. Absent means it
   * could not be, which is **not** the same as being up to date.
   */
  tip: z.string().optional(),
  /** The daemon's process, so a record it left behind can be told apart. */
  holder: holderSchema,
  /** When this was written. */
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
  /**
   * When the last poll cycle **finished its work**
   * ([timone#49](https://github.com/fvermaut/timone/issues/49)).
   *
   * {@link observedAt} is stamped when a cycle *starts*, so the gap between
   * two of them is the previous cycle's own duration plus the interval. A
   * cycle whose body ran longer than the unwitnessed window was therefore
   * arithmetically identical to a daemon that had been switched off, and the
   * log printed a false statement about the daemon itself: "the daemon was
   * not running for 3m", written while it had been running the whole time and
   * working hard. Phase 30 makes that more likely rather than less, because
   * 30b and 30c put more forge calls into every cycle.
   *
   * With this, the gap measured is the time the daemon was **idle** — from
   * the end of one cycle to the start of the next — which is the only span in
   * which it could have missed anything.
   *
   * Optional, so `version` stays `1`: a state file written before this
   * existed, and the first cycle of every daemon, both fall back to
   * {@link observedAt} and grant the window rather than reclaiming.
   */
  workedUntil: z.string().optional(),
  /**
   * What the daemon's own process is running (timone#5). Top-level, because
   * it describes the daemon rather than anything about a run — `observedAt`
   * is here for the same reason. Optional, so `version` stays `1`.
   */
  daemon: daemonRecordSchema.optional(),
});

export type Run = z.infer<typeof runSchema>;

/**
 * What a run is waiting for, as one value
 * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
 * D5) — {@link Run.wait}, named so that readers can talk about it.
 */
export type RunWait = NonNullable<Run["wait"]>;

/** The planner's decision on a run (ADR-0065 D2) — see {@link Run.planner}. */
export type PlannerDecision = NonNullable<NonNullable<Run["planner"]>["decision"]>;

/** What decides a run's turn for a place, and for the planner (ADR-0063 D3). */
export type PlaceOrder = { priority: boolean; openedAt: string };

export type PreviewRecord = z.infer<typeof previewRecordSchema>;
export type IntroductionRecord = z.infer<typeof introductionRecordSchema>;
export type InitiativeRecord = z.infer<typeof initiativeRecordSchema>;
export type DaemonRecord = z.infer<typeof daemonRecordSchema>;
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
  /**
   * Whether a holder's process is still there. Injected, and defaulting to
   * {@link holderLiveness}, for the reason ADR-0025 gives: a test cannot
   * portably manufacture a dead pid, so a case left asserting against
   * whatever the runner's pid table happens to hold asserts nothing.
   */
  livenessOf?: (holder: Holder) => Liveness;
  /**
   * How many places a project has: how many of its runs may have a step
   * running at once (PRD-07.R2, ADR-0065 D6). The caller reads it from
   * `timone.yaml`. Absent means `DEFAULT_PLACES` for every project.
   */
  placesOf?: (project: string) => number;
}

/** Default state-file location, relative to the timone root. */
export function defaultStatePath(root: string): string {
  return join(root, ".timone", "state.json");
}

/** Options for parking a run on a wait. */
export interface ParkOptions {
  /** What it is waiting for, in the human's terms. */
  waitingOn: string;
  /** `runner`, the wait of a run the runner drives (ADR-0060). */
  kind?: "runner";
  /** The stage it parked at, when parking moves it. */
  stage?: PipelineStage;
  /** The instant the wait was opened. */
  waitCursor?: string;
  /**
   * Which stages may end this wait (ADR-0049 D5). Absent means the stage the
   * run parks at, which is what the runner writes too.
   */
  resolvableBy?: PipelineStage[];
}

/**
 * The daemon's run ledger: which tickets each project is working, which runs
 * take or wait for a place, and how each run ended. Persisted to
 * `.timone/state.json` (gitignored — it is machine state, never a process
 * artifact) and written atomically after every mutation, so a crash never
 * leaves a half-file.
 *
 * **The place rule**
 * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)):
 *
 * - **A run takes a place on its project while a step of it runs, or while a
 *   place is given to it and not yet used.** Nothing else takes one: not a
 *   work branch, not an open pull request, not a wait for a person, not a run
 *   just picked up, not a terminal a person opened with `timone takeover`. A
 *   project has the number of places {@link placesOf} answers, and a run
 *   may enter `active` only while one is free or given to it.
 * - **A run refused a place waits for one, and a freed place is given to one
 *   waiting run in the same write that freed it**: a ticket labelled
 *   `priority:high` first, then the ticket opened first on the forge, then
 *   the lowest ticket number. No runner woken in between can take it first.
 *
 * ✏ 2026-10-04: this replaces the two rules phase 12 set — one session per
 * project, and a parked run holding its project once it owns a work branch.
 * Since ADR-0041 every run works in its own box, so two branches of one
 * project no longer share a working copy.
 *
 * The rule is enforced here rather than by callers: a rule about a shared
 * resource that lives in the caller is a rule the next caller will not know
 * about.
 */
export class RunStore {
  private constructor(
    private readonly path: string,
    private state: State,
    private readonly now: () => string,
    private readonly livenessOf: (holder: Holder) => Liveness,
    private readonly places: (project: string) => number,
  ) {}

  /** Open the store at `path`, starting empty when the file does not exist. */
  static open(path: string, options: RunStoreOptions = {}): RunStore {
    const now = options.now ?? (() => new Date().toISOString());
    const livenessOf = options.livenessOf ?? ((holder) => holderLiveness(holder));
    const places = options.placesOf ?? (() => DEFAULT_PLACES);
    return new RunStore(path, readState(path), now, livenessOf, places);
  }

  /**
   * How many places `project` has: how many of its runs may have a step
   * running at once (PRD-07.R2, ADR-0065 D6).
   */
  placesOf(project: string): number {
    return this.places(project);
  }

  /**
   * What can be said about the process holding `run` (ADR-0049 D2).
   *
   * `none` is not a failure to answer: a run nobody is holding is judged by
   * witnessed time as it always was (ADR-0020), and `unknown` — a holder on
   * another machine — is not a shy `gone`, because `gone` is read as
   * permission to reclaim.
   */
  hold(run: Run): Hold {
    return run.holder === undefined ? "none" : this.livenessOf(run.holder);
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
   * `timone takeover`, `timone cancel` and a ticket's call to action all speak
   * about a ticket, and the chunk they mean is its most recent one, whether or
   * not it is still going.
   *
   * Reads the file, as {@link placeHolders} does: a guard that answers from
   * memory cannot see what another process has just written (ADR-0023).
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
   * than a fan-out. `parked` counts as living — a run waiting for the runner
   * is unfinished. Only `done` and `cancelled` end a chunk's claim on its
   * ticket; see {@link isSettled}.
   */
  liveRunForTicket(project: string, ticket: number): Run | undefined {
    this.refresh();
    return this.loadedLiveRunForTicket(project, ticket);
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

  /**
   * Register a pickup. **Idempotent by the ticket's *live* chunk, not by the
   * ticket** ([ADR-0026](../../doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)):
   * a ticket with an unsettled chunk yields that chunk and `created: false`,
   * so re-polling a marked ticket never doubles it — and a ticket whose chunks
   * are all settled opens the next one.
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
    const seq = nextSequence(this.loadedRunsForTicket(project, ticket));
    const run: Run = {
      id: runId(project, ticket, seq),
      project,
      ticket,
      seq,
      status: "picked-up",
      flags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.runs.push(run);
    this.persist();
    return { run: { ...run }, created: true };
  }

  /**
   * Open the ticket's next chunk on a pull request that is already open, from
   * an earlier run of the ticket
   * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)
   * D4, #181). The run is parked at `delivery` with the branch and the pull
   * request, and waits for the runner, which is woken when the pull request
   * merges, closes or gets a named person's comment. It takes no place.
   *
   * Refused when the ticket has a live run: that run already owns the work.
   */
  adopt(project: string, ticket: number, open: { branch: string; pr: number }): Run {
    this.refresh();
    const live = this.loadedLiveRunForTicket(project, ticket);
    if (live !== undefined) {
      throw new Error(
        `Cannot take over pull request #${open.pr} for ${project}#${ticket}: ` +
          `run ${live.id} is still going.`,
      );
    }

    const timestamp = this.now();
    const seq = nextSequence(this.loadedRunsForTicket(project, ticket));
    const run: Run = {
      id: runId(project, ticket, seq),
      project,
      ticket,
      seq,
      status: "parked",
      stage: "delivery",
      branch: open.branch,
      pr: open.pr,
      wait: {
        on: `pull request #${open.pr}, opened before this run`,
        kind: "runner",
        resolvableBy: ["delivery"],
      },
      flags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.runs.push(run);
    this.persist();
    return { ...run };
  }

  /**
   * Mark a run as running under `sessionId`. A resuming run stops waiting:
   * whatever it was parked on has been dealt with, and leaving the wait
   * behind would let it be read as still open.
   */
  activate(id: string, sessionId: string, holder?: Holder): Run {
    return this.transition(id, "active", (run) => {
      run.sessionId = sessionId;
      // The session is the holder now, replacing the claim's (ADR-0049 D1).
      // A claim is a slot held for a session that may never start; once one
      // has, the process worth asking about is the one running it.
      if (holder !== undefined) run.holder = holder;
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
  claim(id: string, holder?: Holder, options: { takeover?: boolean } = {}): Run {
    // The refusal is about the *existing* holder, so it is asked before the
    // transition: a run somebody is holding may not be taken from them, and
    // one whose holder's process is gone may (ADR-0049 D1, D2). Until this,
    // the only thing that ended a claim nobody held was the dead-run sweep
    // two minutes later — timone#78.
    const current = this.mutable(id);
    if (current.holder !== undefined) {
      const held = this.livenessOf(current.holder);
      if (held !== "gone" && current.holder.token !== holder?.token) {
        throw new Error(heldRunMessage(current.holder, held));
      }
    }
    // A person's terminal takes no place on the project (ADR-0063 D5), so
    // the mark is written before the transition and no place is asked.
    return this.transition(
      id,
      "active",
      (run) => {
        if (holder !== undefined) run.holder = holder;
        run.waitingTerminal = undefined;
      },
      { takeover: options.takeover === true },
    );
  }

  /**
   * Write `holder` on the run as the terminal that waits for its running step
   * to end (ADR-0067 D1). Refused when no step runs on it: the run is not
   * `active`, or a person's terminal holds it.
   */
  waitForStep(id: string, holder: Holder): Run {
    const run = this.mutable(id);
    if (run.status !== "active") {
      throw new Error(`Run ${id} is ${run.status}, so no step is running on it to wait for.`);
    }
    if (run.takenOver === true) {
      throw new Error(
        `Run ${id} is open in a person's terminal, so no step is running on it to wait for.`,
      );
    }
    run.waitingTerminal = holder;
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /** The terminal that waits for the run's running step to end, if one does (ADR-0067 D2). */
  liveWaiter(id: string): Holder | undefined {
    return this.mutable(id).waitingTerminal;
  }

  /**
   * Ask for a place on the run's project before a step starts (ADR-0063 D2).
   * `order` is what decides the run's turn, read from its ticket at this try.
   */
  askPlace(id: string, order: PlaceOrder): { ok: true } | { ok: false; holder: Run } {
    const run = this.mutable(id);
    run.place = { ...run.place, priority: order.priority, openedAt: order.openedAt };
    const holder = run.place.givenAt === undefined ? this.placeTakenFrom(run) : undefined;
    if (holder !== undefined) run.place.waitingSince ??= this.now();
    this.persist();
    return holder === undefined ? { ok: true } : { ok: false, holder: { ...holder } };
  }

  /**
   * Take back a place given to `id` and not used, and give it to the next
   * waiting run (ADR-0063 D3). For a run whose runner's wake ended with no
   * step started. The run does not wait any more.
   */
  giveBack(id: string): Run {
    const run = this.mutable(id);
    if (run.place !== undefined) run.place.givenAt = undefined;
    this.givePlaces(run.project);
    this.persist();
    return { ...run };
  }

  /**
   * Stop `id` waiting for a place, and take back a place given to it
   * (ADR-0063 D2): its runner's wake ended with no step started and no try
   * refused. The place goes to the next waiting run.
   */
  leaveTurn(id: string): Run {
    const run = this.mutable(id);
    if (run.place !== undefined) {
      run.place.waitingSince = undefined;
      run.place.givenAt = undefined;
    }
    this.givePlaces(run.project);
    this.persist();
    return { ...run };
  }

  /**
   * Take back every place given and not used, and give each again by order
   * (ADR-0063 D3). Called once when the daemon starts: no wake survives a
   * restart, so a place given before one would otherwise never be used. A
   * run whose place was taken back waits again. A run with a step running
   * is not touched.
   */
  regivePlaces(): void {
    this.refresh();
    for (const run of this.state.runs) {
      if (run.place?.givenAt === undefined || run.status === "active") continue;
      run.place.givenAt = undefined;
      run.place.waitingSince ??= this.now();
    }
    for (const project of new Set(this.state.runs.map((run) => run.project))) {
      this.givePlaces(project);
    }
    this.persist();
  }

  /**
   * The runs of `project` that wait for a place, in the order they will be
   * given one (ADR-0063 D3): a ticket labelled `priority:high` first, then
   * the ticket opened first on the forge, then the lowest ticket number.
   */
  waitingForPlace(project: string): Run[] {
    this.refresh();
    return this.loadedWaitingForPlace(project).map((run) => ({ ...run }));
  }

  /**
   * The runs of `project` that take a place now: a step of theirs runs, or a
   * place is given to them and not yet used (ADR-0063 D1).
   */
  placeHolders(project: string): Run[] {
    this.refresh();
    return this.state.runs
      .filter((run) => run.project === project && takesPlace(run))
      .map((run) => ({ ...run }));
  }

  /**
   * Write that `id` waits for the planner's decision (ADR-0065 D2). Does
   * nothing when the run has a decision. A run asked already keeps the time
   * it was first asked.
   *
   * `order` is the run's place order, read from its ticket at this try, and
   * written on its place as {@link askPlace} writes it, so
   * {@link waitingForPlanner} can order the runs that wait.
   */
  askPlanner(id: string, order: PlaceOrder): Run {
    const run = this.mutable(id);
    if (run.planner?.decision !== undefined) return { ...run };
    run.place = { ...run.place, priority: order.priority, openedAt: order.openedAt };
    run.planner = { askedAt: run.planner?.askedAt ?? this.now() };
    this.persist();
    return { ...run };
  }

  /**
   * Write the planner's decision on `id` (ADR-0065 D2). The time it was
   * asked stays. A new decision replaces the one before, as when a held run
   * is decided again.
   */
  decidePlanner(id: string, decision: PlannerDecision): Run {
    const run = this.mutable(id);
    run.planner = { ...run.planner, decision };
    this.persist();
    return { ...run };
  }

  /**
   * Ask the planner again for a held run, now that what it waits for is gone
   * (ADR-0065 D4): the hold goes, and the run waits for a new decision from
   * now. A run that is not held is left as it is.
   */
  reaskPlanner(id: string): Run {
    const run = this.mutable(id);
    if (run.planner?.decision?.kind !== "hold") return { ...run };
    run.planner = { askedAt: this.now() };
    this.persist();
    return { ...run };
  }

  /**
   * The live runs of `project` that wait for the planner's decision, in the
   * order a freed place is given (ADR-0063 D3, ADR-0065 D1). A run with no
   * place order comes after those that have one, by ticket number.
   */
  waitingForPlanner(project: string): Run[] {
    this.refresh();
    return this.state.runs
      .filter(
        (run) =>
          run.project === project &&
          !isSettled(run.status) &&
          run.planner?.askedAt !== undefined &&
          run.planner.decision === undefined,
      )
      .sort(byPlannerOrder)
      .map((run) => ({ ...run }));
  }

  /** The live runs of `project` the planner holds (ADR-0065 D4). */
  heldByPlanner(project: string): Run[] {
    this.refresh();
    return this.state.runs
      .filter(
        (run) =>
          run.project === project &&
          !isSettled(run.status) &&
          run.planner?.decision?.kind === "hold",
      )
      .map((run) => ({ ...run }));
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
   * Record the work branch a run owns.
   *
   * ✏ 2026-10-04: a setter, and nothing more
   * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)
   * D1). A work branch takes no place on the project, so several runs of one
   * project may own branches at the same time. Until then a branch held the
   * project, and the claim was refused while another run held it.
   */
  claimBranch(id: string, branch: string): Run {
    const run = this.mutable(id);
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
   * Finish a run. A place it took or was given goes to the first waiting run
   * (ADR-0063 D3).
   */
  complete(id: string): Run {
    return this.transition(id, "done", (run) => {
      run.wait = undefined;
      run.holder = undefined;
      run.place = undefined;
    });
  }

  /**
   * Abandon a run, saying why.
   *
   * The reason is written where a person will read it — `timone status` and
   * `timone cancel`'s own answer — and it is a statement of what was observed
   * rather than a verdict.
   *
   * Everything the run was waiting for goes with it.
   */
  cancel(id: string, reason: string): Run {
    return this.transition(id, "cancelled", (run) => {
      run.cancellation = reason;
      stopWaiting(run);
      run.holder = undefined;
      run.place = undefined;
    });
  }

  /** Record which lifecycle stage a run reached. */
  setStage(id: string, stage: PipelineStage): Run {
    const run = this.mutable(id);
    run.stage = stage;
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
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
   * outlives the session that wrote it: a re-armed run carries the old tick,
   * and the next cycle reclaims it before it has had a chance to start. That
   * happened live on 2026-08-07.
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

    // The end of the previous cycle where one said so, its start otherwise.
    // The distinction is timone#49: a slow cycle is work, not absence.
    const previous = this.state.workedUntil ?? this.state.observedAt;
    const gapMs =
      this.state.observedAt === undefined || previous === undefined
        ? undefined
        : nowMs - Date.parse(previous);
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

  /**
   * Record that this cycle has finished its work.
   *
   * Called once at the end of every poll cycle, so the next {@link witness}
   * measures the gap it was **idle** rather than the gap since it last
   * started ([timone#49](https://github.com/fvermaut/timone/issues/49)). A
   * cycle that dies before reaching this leaves the previous stamp in place,
   * which reads as a longer absence — conservative in the safe direction.
   */
  cycleEnded(now?: string): void {
    this.refresh();
    this.state.workedUntil = now ?? this.now();
    this.persist();
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

  /**
   * Write down what this daemon's process is running, and what the default
   * branch had moved to when it last looked (timone#5).
   *
   * Replaced whole on every cycle. The previous cycle's answer is worth
   * nothing: the remote moves, and a stale tip beside a fresh commit is how a
   * check comes to report a state that never existed.
   */
  recordDaemon(record: Omit<DaemonRecord, "at">): void {
    this.refresh();
    this.state.daemon = { ...record, at: this.now() };
    this.persist();
  }

  /**
   * What the daemon's process is running, or undefined when no daemon is
   * running at all.
   *
   * **A record whose process is gone answers undefined**, and that is the
   * whole reason the holder is stored. Nobody is running old code once the
   * daemon has stopped, and asking a reader to restart something that is not
   * running is worse than saying nothing. `unknown` — a daemon on another
   * machine — keeps its record: not being able to look at a pid table is not
   * evidence of death (ADR-0025).
   */
  daemonVersion(): DaemonRecord | undefined {
    this.refresh();
    const record = this.state.daemon;
    if (record === undefined) return undefined;
    return this.livenessOf(record.holder) === "gone" ? undefined : { ...record };
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
   * Move a run to `next`, refusing illegal transitions and refusing `active`
   * when no place is free for the run (ADR-0063 D1). A run whose step ends
   * takes no place while its runner decides (PRD-07.R2 clause 6). Whatever
   * place the move frees is given to the first waiting run before the file is
   * written (D3).
   */
  private transition(
    id: string,
    next: RunStatus,
    apply: (run: Run) => void,
    options: { takeover?: boolean } = {},
  ): Run {
    const run = this.mutable(id);
    const allowed = TRANSITIONS[run.status];
    if (!allowed.includes(next)) {
      throw new Error(
        `Run ${id} cannot go from ${run.status} to ${next} ` +
          `(allowed: ${allowed.join(", ") || "nothing — it is finished"})`,
      );
    }
    if (options.takeover === true) run.takenOver = true;

    if (next === "active" && run.takenOver !== true && run.place?.givenAt === undefined) {
      const holder = this.placeTakenFrom(run);
      if (holder !== undefined) throw new NoPlaceError(run.project, holder);
    }

    run.status = next;
    apply(run);
    run.updatedAt = this.now();
    // A person's terminal holds a run only while it is active (ADR-0063 D5).
    if (next !== "active") run.takenOver = undefined;
    // A terminal waits for a step only while the step runs (ADR-0067 D1).
    if (next !== "active") run.waitingTerminal = undefined;
    // The step takes the place itself now, so the place is no longer given
    // and the run no longer waits for one.
    if (next === "active" && run.place !== undefined) {
      run.place.givenAt = undefined;
      run.place.waitingSince = undefined;
    }
    // ✏ 2026-10-05: a run whose step has just ended does not wait for a
    // place, and none is given to it: the runner session it wakes takes no
    // place (PRD-07.R2 clause 6). Its next step asks like any other.
    this.givePlaces(run.project);

    this.persist();
    return { ...run };
  }

  /**
   * The run that keeps `run` from a place, or undefined when it may take one:
   * as many other runs of its project take a place as it has places
   * ({@link placesOf}). A place given to another run counts as taken. The
   * run named is the one a place is given to, when there is one, and else
   * the first whose step runs. Over the state already in hand.
   */
  private placeTakenFrom(run: Run): Run | undefined {
    const others = this.state.runs.filter(
      (other) => other.project === run.project && other.id !== run.id,
    );
    const taking = others.filter(takesPlace);
    const given = others.find((other) => other.place?.givenAt !== undefined);
    if (taking.length < this.places(run.project)) return undefined;
    return given ?? taking[0];
  }

  /**
   * Give each free place on `project` to the first waiting run, in the order
   * of {@link waitingForPlace} (ADR-0063 D3). Called inside the mutation that
   * freed the place, so the place is given in the same write: no runner woken
   * in between can take it first.
   */
  private givePlaces(project: string): void {
    for (;;) {
      const taking = this.state.runs.filter(
        (run) => run.project === project && takesPlace(run),
      );
      if (taking.length >= this.places(project)) return;
      const first = this.loadedWaitingForPlace(project)[0];
      if (first?.place === undefined) return;
      first.place.givenAt = this.now();
      first.place.waitingSince = undefined;
    }
  }

  /** {@link waitingForPlace} over the state already in hand. */
  private loadedWaitingForPlace(project: string): Run[] {
    return this.state.runs
      .filter(
        (run) =>
          run.project === project &&
          run.place?.waitingSince !== undefined &&
          !takesPlace(run),
      )
      .sort(byPlaceOrder);
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
 * `timone cancel ivtrends#1` still name a ticket, because a ticket is what a
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

/**
 * One plain sentence for a claim refused by somebody who is still there.
 *
 * It names the command and the pid, because "the run is already claimed"
 * tells an operator nothing they can act on and the commonest holder is a
 * `timone takeover` they left open in another terminal.
 */
function heldRunMessage(holder: Holder, held: Liveness): string {
  const since =
    held === "unknown"
      ? `is recorded on ${holder.host ?? "another machine"}, which this one ` +
        "cannot ask about"
      : `has held it since ${holder.since}`;
  return (
    `${holder.command} (pid ${holder.pid}) ${since} — this one stops rather ` +
    "than taking a run out from under it."
  );
}

/** Clear the wait a run has finished waiting on. */
function stopWaiting(run: Run): void {
  run.wait = undefined;
}

/**
 * Write a wait onto a run. Shared by {@link RunStore.park} and `repark`. A
 * wait is written whole, absent fields included.
 *
 * ✏ 2026-09-30: ADR-0033's floor, which turned a second re-ask at the same
 * stage into an escalation, was removed with the old code between steps.
 */
function applyPark(run: Run, options: ParkOptions): void {
  // A parked run is waiting on a person, and nobody is holding it. A holder
  // left behind is dead data that looks live: the next claim would be refused
  // by a process that stopped caring, which is timone#78's refusal in a
  // different disguise.
  run.holder = undefined;
  const stage = options.stage ?? run.stage;
  // **Recorded, not derived later** (ADR-0049 D5). A wait with no stage at all
  // is the one case nothing can be worked out for, and it is also the one no
  // park produces: every caller either names a stage or the run already has
  // one.
  const endedBy = options.resolvableBy ?? (stage === undefined ? undefined : [stage]);
  if (endedBy !== undefined && endedBy.length === 0) {
    throw new Error(
      `Refusing to park ${run.id} on a wait no stage can end. A wait with ` +
        "nothing that can resolve it leaves the ticket asking a person for " +
        "something for ever (ADR-0049 D6).",
    );
  }
  run.wait = {
    on: options.waitingOn,
    ...(options.kind === undefined ? {} : { kind: options.kind }),
    ...(options.waitCursor === undefined ? {} : { opened: options.waitCursor }),
    ...(endedBy === undefined ? {} : { resolvableBy: endedBy }),
  };
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
 * Whether a run takes a place on its project (ADR-0063 D1): a step of it
 * runs, and a person's terminal does not hold it; or a place is given to it
 * and not yet used. Nothing else takes one — not a work branch, not an open
 * pull request, not a wait for a person.
 */
function takesPlace(run: Run): boolean {
  return (
    (run.status === "active" && run.takenOver !== true) ||
    run.place?.givenAt !== undefined
  );
}

/**
 * The order in which waiting runs are given a place (ADR-0063 D3): a ticket
 * labelled `priority:high` first, then the ticket opened first on the forge,
 * then the lowest ticket number.
 */
function byPlaceOrder(left: Run, right: Run): number {
  const priority = Number(right.place?.priority === true) - Number(left.place?.priority === true);
  if (priority !== 0) return priority;
  const opened = Date.parse(left.place?.openedAt ?? "") - Date.parse(right.place?.openedAt ?? "");
  if (opened !== 0 && !Number.isNaN(opened)) return opened;
  return left.ticket - right.ticket;
}

/**
 * The order in which runs that wait for the planner are decided (ADR-0065
 * D1): a run with a place order first, by {@link byPlaceOrder}; then a run
 * with none, by ticket number.
 */
function byPlannerOrder(left: Run, right: Run): number {
  const ordered = Number(left.place === undefined) - Number(right.place === undefined);
  return ordered !== 0 ? ordered : byPlaceOrder(left, right);
}

/** Who takes the place a run was refused, as the refusal says it. */
function whoTakesThePlace(holder: Run): string {
  return holder.place?.givenAt !== undefined
    ? `the place is given to run ${holder.id}`
    : `run ${holder.id} has a step running`;
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
  return {
    ...data,
    runs: data.runs
      .map(normaliseSequence)
      .map(normaliseWait)
      .map(normaliseOldPath)
      .map(normaliseRemovedFields)
      .map(normaliseQueued),
  };
}

/**
 * Fold a run's three old wait fields into one {@link Run.wait}
 * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
 * D5), before the schema is asked to validate it.
 *
 * **`waitingOn` is the whole of the evidence, and it is enough.** The three
 * were only ever written together, by `applyPark` — a run with a kind or a
 * cursor and no words is a state nothing has ever produced. So the rule has
 * no judgement in it: words mean there is a wait, and the kind and the cursor
 * go with them.
 *
 * **Idempotent, because it runs constantly.** {@link RunStore.refresh}
 * re-reads the file at the top of every public read and every mutation, so
 * this is on the hot path rather than a start-up step. A run already in the
 * new shape is returned untouched.
 *
 * **It normalises rather than migrating**: `version` stays `1` and no file is
 * rewritten on its account, exactly as {@link normaliseSequences} does. The
 * new shape reaches disk the next time something persists, and until then
 * every load produces it afresh — which is also what makes a rollback
 * survivable.
 */
function normaliseWait(run: unknown): unknown {
  if (typeof run !== "object" || run === null) return run;
  const old = run as Record<string, unknown>;
  if (
    !("waitingOn" in old) &&
    !("waitingKind" in old) &&
    !("waitCursor" in old)
  ) {
    return run;
  }

  const { waitingOn, waitingKind, waitCursor, ...rest } = old;
  // **A kind or a cursor with no words is a finished run's leftovers**, and
  // they are dropped rather than carried across. `complete` used to clear
  // `waitingOn` alone, so every run the old daemon finished on a review or a
  // conversation kept a kind and a cursor for a wait nothing was waiting on —
  // both of the done runs in the 2026-08-14 ledger are in that state. That is
  // the dead-data-that-looks-live this collapse exists to make unwritable, so
  // the normalisation does not write it either.
  if (typeof waitingOn !== "string") return rest;
  // An old wait carries no `resolvableBy`, so it is given the one the stage
  // and the kind implied when the old code wrote it: a review was ended by
  // remediation, every other wait by the stage it opened at. A run with no
  // stage recorded gets none.
  const stage = typeof rest.stage === "string" ? rest.stage : undefined;
  const kind = typeof waitingKind === "string" ? waitingKind : undefined;
  const endedBy =
    stage === undefined ? undefined : kind === "review" ? ["remediation"] : [stage];
  return {
    ...rest,
    wait: {
      on: waitingOn,
      ...(kind === undefined ? {} : { kind }),
      ...(typeof waitCursor === "string" ? { opened: waitCursor } : {}),
      ...(endedBy === undefined ? {} : { resolvableBy: endedBy }),
    },
  };
}

/**
 * What goes in front of a failed run's reason when the ledger is read, so a
 * person can tell it from a cancel somebody asked for. See
 * {@link normaliseOldPath}.
 */
const STOPPED_BEFORE_REMOVAL = "stopped before the old code was removed: ";

/**
 * Turn a run the old code between steps left in the ledger into one the
 * runner can read, before the schema is asked to validate it
 * ([timone#166](https://github.com/fvermaut/timone/issues/166)).
 *
 * Since 2026-09-30 the runner drives every project, and two things the old
 * code wrote mean nothing to it:
 *
 * - **A failed run becomes cancelled.** Nothing re-arms a failed run any
 *   more: `timone retry` was removed. What stopped it is kept
 *   where {@link RunStore.cancel} keeps its reason, after
 *   {@link STOPPED_BEFORE_REMOVAL}, as one line ({@link oneLineReason}).
 *   ✏ 2026-10-02 (41m): a run an earlier build converted and wrote kept
 *   the whole old failure. Its reason is cut to one line the same way.
 * - **A parked run's old kind of wait becomes the runner's.** A gate, a
 *   conversation, a review, an escalation, or a wait of no kind was a
 *   stage's own wait, and no stage waits on its own any more. What it waits
 *   on and when the wait opened are kept, so the ticket and `timone status`
 *   still say what it waits for.
 *
 * **Nothing else changes.** A parked run holds its project only while it
 * owns a branch, exactly as before. A parked run with no wait at all is left
 * as it is, because there is nothing to say it waits on. Nothing here asks
 * for a wake.
 *
 * **It normalises rather than migrating**, as {@link normaliseWait} does:
 * `version` stays `1` and no file is rewritten because of a read. The
 * converted runs reach the file the next time something writes it.
 *
 * **Idempotent, because it runs on every read.** A cancelled run whose reason
 * is already one line, and a run already waiting for the runner, are returned
 * untouched, so the reason is never prefixed twice.
 */
function normaliseOldPath(run: unknown): unknown {
  if (typeof run !== "object" || run === null) return run;
  if (!("status" in run)) return run;
  if (run.status === "failed") {
    const failure =
      "failure" in run && typeof run.failure === "string"
        ? oneLineReason(run.failure)
        : "no reason recorded";
    return {
      ...run,
      status: "cancelled",
      cancellation: `${STOPPED_BEFORE_REMOVAL}${failure}`,
    };
  }
  if (
    run.status === "cancelled" &&
    "cancellation" in run &&
    typeof run.cancellation === "string" &&
    run.cancellation.startsWith(STOPPED_BEFORE_REMOVAL)
  ) {
    const reason = oneLineReason(run.cancellation.slice(STOPPED_BEFORE_REMOVAL.length));
    const cut = `${STOPPED_BEFORE_REMOVAL}${reason}`;
    return cut === run.cancellation ? run : { ...run, cancellation: cut };
  }
  if (run.status !== "parked" || !("wait" in run)) return run;
  const { wait } = run;
  if (typeof wait !== "object" || wait === null) return run;
  if ("kind" in wait && wait.kind === "runner") return run;
  return { ...run, wait: { ...wait, kind: "runner" } };
}

/**
 * The start of the banner every machine comment opens with
 * (`MACHINE_MARKER` in `src/adapters/ticketing.ts`).
 */
const MACHINE_BANNER = "🤖 **Timone**";

/**
 * A failed run's reason as one line: the first line of `failure`, cut before
 * the machine's banner where the line carries one, with spaces and a trailing
 * colon trimmed. An empty result is *"no reason recorded"*.
 *
 * ✏ 2026-10-02 (41m, [timone#166](https://github.com/fvermaut/timone/issues/166)):
 * the old code could keep a whole machine comment as a run's failure. On
 * timone #106 `timone status` printed all of it, with a command to type.
 */
function oneLineReason(failure: string): string {
  const first = failure.split("\n", 1)[0] ?? "";
  const banner = first.indexOf(MACHINE_BANNER);
  const line = banner === -1 ? first : first.slice(0, banner);
  const reason = line.trim().replace(/:$/, "").trimEnd();
  return reason === "" ? "no reason recorded" : reason;
}

/**
 * The fields only the old code between steps wrote, which nothing reads any
 * more: the ask check's question, the deaths of a run's holder, a refusal to
 * start it, a build stage's questions carried to the pull request, the count
 * of re-asks at one stage, the written answer read and not yet acted on, and
 * why a run failed. A run the ledger reads as cancelled keeps its reason in
 * `cancellation`, which {@link normaliseOldPath} writes before this runs.
 */
const REMOVED_FIELDS = [
  "askCheck",
  "deaths",
  "refusal",
  "carried",
  "reAsksAfterAnswer",
  "consumedAnswerAt",
  "failure",
] as const;

/**
 * Drop from a run what the old code between steps left on it and nothing
 * reads, before the schema is asked to validate it
 * ([timone#166](https://github.com/fvermaut/timone/issues/166)).
 *
 * - The fields in {@link REMOVED_FIELDS} are dropped, and so is a wait's
 *   `acknowledgedAt`: the instant of the newest comment an old wait had told
 *   the human it read.
 * - A wait of an old kind on a run that is not parked is read as the
 *   runner's, as {@link normaliseOldPath} reads a parked one. The old code
 *   could leave a run claimed for a session, still holding the wait it was
 *   parked on, and `runner` is now the only kind the schema has.
 *
 * It runs after {@link normaliseOldPath}, on every read, and like it writes
 * nothing: the runs reach the file without these fields the next time
 * something writes it. A run with none of them is returned untouched.
 */
function normaliseRemovedFields(run: unknown): unknown {
  if (typeof run !== "object" || run === null) return run;
  const wait =
    "wait" in run && typeof run.wait === "object" && run.wait !== null
      ? run.wait
      : undefined;
  const oldKind = wait !== undefined && "kind" in wait && wait.kind !== "runner";
  const acknowledged = wait !== undefined && "acknowledgedAt" in wait;
  if (!oldKind && !acknowledged && !REMOVED_FIELDS.some((field) => field in run)) {
    return run;
  }
  const kept = Object.fromEntries(
    Object.entries(run).filter(
      ([field]) => !(REMOVED_FIELDS as readonly string[]).includes(field),
    ),
  );
  if (wait === undefined) return kept;
  const waitKept = Object.fromEntries(
    Object.entries(wait).filter(([field]) => field !== "acknowledgedAt"),
  );
  return { ...kept, wait: oldKind ? { ...waitKept, kind: "runner" } : waitKept };
}

/**
 * Read a run an older ledger holds as `queued` as `picked-up`, before the
 * schema is asked to validate it
 * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)
 * D2).
 *
 * A queued run was a ticket picked up while another run held the project. It
 * had not begun, which is what `picked-up` says: its runner is woken for it as
 * for any new ticket, and it waits for a place only once it tries a step.
 *
 * Like the other normalisations it writes nothing, and it is idempotent: a
 * run that is not queued is returned untouched, so a second load reads the
 * same runs.
 */
function normaliseQueued(run: unknown): unknown {
  if (typeof run !== "object" || run === null) return run;
  if (!("status" in run) || run.status !== "queued") return run;
  return { ...run, status: "picked-up" };
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
