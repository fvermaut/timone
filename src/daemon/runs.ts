import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

/**
 * A run's lifecycle. `queued` is where a pickup lands while another run
 * occupies the project; the rest is the plan's `picked-up → active →
 * parked | done | failed`.
 *
 * `parked` — waiting on a human — is deliberately **not** terminal: the
 * ticket is still the project's active ticket until someone answers, so a
 * parked run keeps holding the project against R10.
 */
export type RunStatus =
  | "queued"
  | "picked-up"
  | "active"
  | "parked"
  | "done"
  | "failed";

/** Statuses that mean the project is busy: a queued pickup waits behind them. */
const OCCUPYING: readonly RunStatus[] = ["picked-up", "active", "parked"];

/** Statuses a run never leaves. */
const TERMINAL: readonly RunStatus[] = ["done", "failed"];

/** Every transition the store will make; anything else is a bug, loudly. */
const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["picked-up"],
  "picked-up": ["active", "failed"],
  active: ["parked", "done", "failed"],
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
  /** Lifecycle stage the session reached, for `timone status`. */
  stage: z.string().optional(),
  /** What a parked run is waiting for, in the human's terms. */
  waitingOn: z.string().optional(),
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

/**
 * The daemon's run ledger: which ticket each project is working, what is
 * queued behind it, and how each run ended. Persisted to `.timone/state.json`
 * (gitignored — it is machine state, never a process artifact) and written
 * atomically after every mutation, so a crash never leaves a half-file.
 *
 * The one-active-run-per-project rule of R10 is an invariant this store
 * enforces: callers cannot activate a second run on a busy project, and a
 * pickup on a busy project is queued rather than refused.
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
   * The run currently holding `project` — picked up, active or parked.
   * Undefined when the project is idle.
   */
  occupyingRun(project: string): Run | undefined {
    const run = this.state.runs.find(
      (candidate) =>
        candidate.project === project && OCCUPYING.includes(candidate.status),
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

  /** Mark a run as running under `sessionId`. */
  activate(id: string, sessionId: string): Run {
    return this.transition(id, "active", (run) => {
      run.sessionId = sessionId;
    });
  }

  /** Park a run against a human wait, naming what it waits for. */
  park(id: string, waitingOn: string, stage?: string): Run {
    return this.transition(id, "parked", (run) => {
      run.waitingOn = waitingOn;
      if (stage !== undefined) run.stage = stage;
    });
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
  setStage(id: string, stage: string): Run {
    const run = this.mutable(id);
    run.stage = stage;
    run.updatedAt = this.now();
    this.persist();
    return { ...run };
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
   * Move a run to `next`, refusing illegal transitions and refusing to make
   * a project doubly busy. Promotes the queue head when the run ends.
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

    if (OCCUPYING.includes(next)) {
      const occupier = this.occupyingRun(run.project);
      if (occupier !== undefined && occupier.id !== id) {
        throw new Error(
          `Project ${run.project} is already occupied by run ${occupier.id} ` +
            `(${occupier.status}) — one active ticket per project`,
        );
      }
    }

    run.status = next;
    apply(run);
    run.updatedAt = this.now();

    if (TERMINAL.includes(next)) this.promoteHead(run.project);

    this.persist();
    return { ...run };
  }

  /** Move the oldest queued run of `project` into `picked-up`, if idle. */
  private promoteHead(project: string): void {
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
