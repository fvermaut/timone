import { takeHold } from "./holder.js";
import { closingLine, tickLine, type SessionSummary } from "./progress.js";
import type { RunStore } from "./runs.js";
// `session.ts` imports this module back. That is safe only because nothing
// here reads `waitOf` while the modules load, only when a start fails.
import {
  waitOf,
  type ProgressReader,
  type SessionOutcome,
  type SessionRequest,
  type SessionRuntime,
  type StartedSession,
  type Ticker,
} from "./session.js";

/** What starting and watching one session needs from outside. */
export interface StepSessionDeps {
  store: RunStore;
  runtime: SessionRuntime;
  /** Milliseconds between two ticks: two heartbeats, two progress lines. */
  progressIntervalMs: number;
  /**
   * Starts the ticker. Required rather than defaulted, so this module never
   * has to reach back into `session.ts` for `intervalTicker`: each caller
   * passes the real one, and a test passes its own.
   */
  ticker: (onTick: () => void, intervalMs: number) => Ticker;
  log: (message: string) => void;
}

/** The one session to start, and how the daemon's log names it. */
export interface StepSessionInput {
  runId: string;
  request: SessionRequest;
  /** How the progress lines name the session: `scratch-app#7/1 (planning)`. */
  label: string;
  /**
   * The line that says the session started, given its id. Logged once the run
   * is active and before the first tick, which is the order the daemon's log
   * has always had: a session is announced before anything is said about how
   * it is doing.
   */
  announce?: (sessionId: string) => string;
}

/** How a step session ended, and what it cost when the runtime could say. */
export interface StepResult {
  outcome: SessionOutcome;
  /**
   * The runtime's own accounting, read once the session has ended. Absent for
   * a runtime that cannot see inside a session, for the reason
   * {@link StartedSession.progress} is optional.
   */
  summary?: SessionSummary;
}

/** A session that has started, is being watched, and will finish. */
export interface StepSession {
  sessionId: string;
  /**
   * Settles when the session ends. By then the ticker has stopped and the
   * cost line has been logged, whether the session succeeded or not.
   */
  completed: Promise<StepResult>;
  progress?: ProgressReader;
  /**
   * End the session now, because the run was cancelled
   * ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)).
   *
   * Always callable, and it never throws, for the reasons
   * {@link StartedSession.stop} gives. A runtime that cannot stop a session
   * is said so in the log, and a stop that throws is logged rather than
   * passed on: the run is cancelled either way, and the session ends when it
   * ends.
   */
  stop(): void;
  /**
   * Say something to the session while it runs: the runtime's own
   * {@link StartedSession.send}, passed through unchanged. Present only when
   * the request was interactive and the runtime can deliver a message, which
   * today means the box.
   */
  send?(text: string): void;
}

/**
 * Start one session for a run and watch it: the one place a session is
 * started, which both the spawner and the runner call.
 *
 * **Claim the run, then start its session — in that order (ADR-0023).** The
 * claim is what tells a second process the run is taken, so it has to be on
 * disk *before* the work exists rather than after it returns.
 * `runtime.start` awaits the session's first message, so the window between
 * the two used to be as long as a session takes to answer, and for all of it
 * the ledger still advertised the run as waiting on a human.
 *
 * Only a parked run is claimed here, because a `picked-up` run is already
 * claimed: that status occupies the project's session slot and every guard
 * already excludes it. What was missing was never a claim for the entry path
 * — it was one for the resume path.
 *
 * If the start fails the run goes back to the wait it came from, and the
 * error goes on to whoever asked for the session. **A claim that outlives its
 * session is the stuck-run fault**, so releasing it is part of the same path
 * rather than a later cycle's problem.
 */
export async function startStepSession(
  deps: StepSessionDeps,
  input: StepSessionInput,
): Promise<StepSession> {
  const { store, runtime, log } = deps;
  const { runId, label } = input;

  const before = store.get(runId);
  const parked = before?.status === "parked" ? before : undefined;
  // The holder is this process, because this process is what is running the
  // session (ADR-0049 D1). If it dies, the pid goes with it and the run is
  // reclaimable at once rather than after a clock says so.
  const holder = takeHold(`timone daemon ${runId}`);
  if (parked !== undefined) store.claim(runId, holder);

  let started: StartedSession;
  try {
    started = await runtime.start(input.request);
    store.activate(runId, started.sessionId, holder);
  } catch (error) {
    if (parked !== undefined) store.park(runId, waitOf(parked));
    throw error;
  }

  if (input.announce !== undefined) log(input.announce(started.sessionId));

  const { progress } = started;
  // One tick, two jobs (ADR-0020, which narrowed the heartbeat's meaning and
  // left ADR-0017's mechanism alone). The heartbeat is stamped unconditionally
  // — including for a runtime that can say nothing about its progress —
  // because it is what proves the run alive, and a tick made conditional on
  // having something to print would silently move recovery with it.
  const ticker = deps.ticker(() => {
    store.heartbeat(runId);
    if (progress !== undefined) {
      log(`work   ${label} — ${tickLine(progress.snapshot())}`);
    }
  }, deps.progressIntervalMs);

  return {
    sessionId: started.sessionId,
    completed: watched(started, ticker, label, log),
    ...(progress === undefined ? {} : { progress }),
    stop: () => stopSession(started, runId, log),
    ...(started.send === undefined
      ? {}
      : { send: (text: string) => started.send?.(text) }),
  };
}

/**
 * Await a session's ending, then say what it cost.
 *
 * The ticker is cleared in a `finally`, so a session that fails or throws
 * leaves no timer behind, and the closing line is printed there too — the
 * money was spent whether or not the session succeeded, and a cost report
 * that only appears on success is a success report wearing its clothes.
 */
async function watched(
  started: StartedSession,
  ticker: Ticker,
  label: string,
  log: (message: string) => void,
): Promise<StepResult> {
  try {
    const outcome = await started.completed;
    const summary = started.progress?.summary();
    return summary === undefined ? { outcome } : { outcome, summary };
  } finally {
    ticker.stop();
    const summary = started.progress?.summary();
    if (summary !== undefined) {
      log(`cost   ${label} — ${closingLine(summary)}`);
    }
  }
}

/** End a running session, saying in the log what happened. Never throws. */
function stopSession(
  started: StartedSession,
  runId: string,
  log: (message: string) => void,
): void {
  if (started.stop === undefined) {
    log(`stop   ${runId} — this runtime cannot stop a running session`);
    return;
  }
  log(`stop   ${runId} — cancelled, so its session is being ended`);
  try {
    started.stop();
  } catch (error) {
    // A stop that throws is not the cancelling cycle's failure. The run is
    // cancelled either way, and the session ends when it ends.
    log(`stop   ${runId} — could not end its session: ${oneLine(error)}`);
  }
}

function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}
