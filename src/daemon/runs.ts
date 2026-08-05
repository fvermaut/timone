import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
 */
export type RunStatus =
  | "queued"
  | "picked-up"
  | "active"
  | "parked"
  | "done"
  | "failed";

/**
 * Statuses that occupy the one-session-at-a-time slot. A session is either
 * about to start or running, and two of those on one project would have two
 * agents in one working copy.
 */
const RUNNING: readonly RunStatus[] = ["picked-up", "active"];

/** Statuses a run never leaves. */
const TERMINAL: readonly RunStatus[] = ["done", "failed"];

/**
 * Every transition the store will make; anything else is a bug, loudly.
 *
 * `active → active` is a real move, not a no-op: a run that clears one stage
 * and starts the next without a human in between re-activates under a new
 * session id, since each stage is its own session.
 */
const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["picked-up"],
  "picked-up": ["active", "failed"],
  active: ["active", "parked", "done", "failed"],
  parked: ["active", "done", "failed"],
  done: [],
  failed: [],
};

const runSchema = z.strictObject({
  /** `<project>#<ticket>` — one run per ticket, which is what makes pickup idempotent. */
  id: z.string(),
  project: z.string(),
  ticket: z.number().int().positive(),
  status: z.enum([
    "queued",
    "picked-up",
    "active",
    "parked",
    "done",
    "failed",
  ]),
  /** Lifecycle stage the run has reached, for `timone status` and for resuming. */
  stage: z.enum([...PIPELINE_STAGES]).optional(),
  /** What a parked run is waiting for, in the human's terms. */
  waitingOn: z.string().optional(),
  /** Which *kind* of wait that is — what an arriving answer may resolve. */
  waitingKind: z.enum(["gate", "conversation", "review"]).optional(),
  /**
   * The instant the wait was opened — the gate comment, or the invitation to
   * a conversation. Anything at or before it belongs to an earlier question
   * and cannot answer this one.
   */
  waitCursor: z.string().optional(),
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
  /** Why a failed run failed. */
  failure: z.string().optional(),
  /** Guardrail-hook violations recorded against this run (R15). */
  flags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const stateSchema = z.strictObject({
  version: z.literal(1),
  runs: z.array(runSchema),
});

export type Run = z.infer<typeof runSchema>;
type State = z.infer<typeof stateSchema>;

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
  /** Which kind of wait it is, when the daemon will resume it from an answer. */
  kind?: "gate" | "conversation" | "review";
  /** The stage it parked at, when parking moves it. */
  stage?: PipelineStage;
  /** The instant the wait was opened; answers before it are not answers to it. */
  waitCursor?: string;
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
   * The run currently holding `project`: one whose session is running or
   * about to, or one parked on a work branch it owns. Undefined when the
   * project is free — including when runs are parked awaiting answers at a
   * stage that touches no repository.
   */
  occupyingRun(project: string): Run | undefined {
    const run = this.state.runs.find(
      (candidate) => candidate.project === project && holdsProject(candidate),
    );
    return run === undefined ? undefined : { ...run };
  }

  /**
   * The run occupying `project`'s single session slot — running, or picked up
   * and awaiting a spawn. Undefined when no session is in flight, however
   * many runs are parked.
   */
  runningRun(project: string): Run | undefined {
    const run = this.state.runs.find(
      (candidate) =>
        candidate.project === project && RUNNING.includes(candidate.status),
    );
    return run === undefined ? undefined : { ...run };
  }

  /** Every run of `project` parked on a human, in pickup order. */
  parkedRuns(project: string): Run[] {
    return this.state.runs
      .filter((run) => run.project === project && run.status === "parked")
      .map((run) => ({ ...run }));
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
   * Register a pickup. Idempotent: a ticket already tracked — in any state,
   * finished included — yields its existing run and `created: false`, so
   * re-polling the same marked ticket never doubles it.
   */
  register(project: string, ticket: number): { run: Run; created: boolean } {
    const id = runId(project, ticket);
    const existing = this.get(id);
    if (existing !== undefined) return { run: existing, created: false };

    const timestamp = this.now();
    const run: Run = {
      id,
      project,
      ticket,
      status: this.occupyingRun(project) === undefined ? "picked-up" : "queued",
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
   */
  activate(id: string, sessionId: string): Run {
    return this.transition(id, "active", (run) => {
      run.sessionId = sessionId;
      run.waitingOn = undefined;
      run.waitingKind = undefined;
      run.waitCursor = undefined;
    });
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
    const holder = this.occupyingRun(run.project);
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

  /** Finish a run, promoting whatever is queued behind it. */
  complete(id: string): Run {
    return this.transition(id, "done", (run) => {
      run.waitingOn = undefined;
    });
  }

  /** End a run in failure, promoting whatever is queued behind it. */
  fail(id: string, reason: string): Run {
    return this.transition(id, "failed", (run) => {
      run.failure = reason;
      run.waitingOn = undefined;
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
   * Promote the oldest queued run of `project` if the project is free, and
   * return it. The poll loop calls this each cycle: promotion normally
   * happens as a side effect of the run ahead moving, but a ledger written
   * under the old rule — where every parked run held its project — can hold
   * a queued run behind a park that no longer blocks anything.
   */
  promoteQueue(project: string): Run | undefined {
    this.promoteHead(project);
    this.persist();
    return this.runningRun(project);
  }

  /** Record a guardrail violation against a run (R15). */
  flag(id: string, violation: string): Run {
    const run = this.mutable(id);
    run.flags.push(violation);
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
  }

  /** The run record, by id, for in-place mutation. Throws when unknown. */
  private mutable(id: string): Run {
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
      const running = this.runningRun(run.project);
      if (running !== undefined && running.id !== id) {
        throw new Error(
          `Project ${run.project} already has a session for run ${running.id} ` +
            `(${running.status}) — one session per project at a time`,
        );
      }

      const holder = this.occupyingRun(run.project);
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
    if (this.runningRun(project) !== undefined) return;
    if (this.occupyingRun(project) !== undefined) return;
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

/** One run per ticket — the id is what makes re-pickup a no-op. */
export function runId(project: string, ticket: number): string {
  return `${project}#${ticket}`;
}

/** Write a wait onto a run. Shared by {@link RunStore.park} and `repark`. */
function applyPark(run: Run, options: ParkOptions): void {
  run.waitingOn = options.waitingOn;
  run.waitingKind = options.kind;
  run.waitCursor = options.waitCursor;
  if (options.stage !== undefined) run.stage = options.stage;
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

  const result = stateSchema.safeParse(data);
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
