import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { SessionSummary } from "./progress.js";
import { RunStore } from "./runs.js";
import {
  sessionRequest,
  type SessionRequest,
  type SessionRuntime,
  type StartedSession,
  type Ticker,
} from "./session.js";
import { startStepSession, type StepSessionDeps } from "./step-session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A real ledger in a temp dir. The clock is the test's to set, so a timestamp
 * the store writes is a value the test chose rather than one it has to count
 * the store's own calls to predict.
 */
function newStore(clock: { now: string } = { now: "2026-09-27T10:00:00Z" }): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-step-session-"));
  tempDirs.push(dir);
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => clock.now,
  });
}

/** What every test here asks a runtime to run. */
const request: SessionRequest = sessionRequest({
  cwd: "/root",
  prompt: "plan the next phase of scratch-app#7",
  model: "claude-opus-5-5",
});

/**
 * A runtime that hands back the session the test describes. The agent SDK is
 * the thing faked here, never the ledger: the store is real, because what a
 * step session does to a run is exactly what these tests are about.
 */
function runtimeReturning(session: StartedSession): SessionRuntime {
  return {
    async start() {
      return session;
    },
  };
}

/**
 * A ticker that never fires by itself. `tick` is the test firing one interval
 * by hand, which is deterministic where a real timer would race the session.
 */
function handTicker(): {
  ticker: (onTick: () => void, intervalMs: number) => Ticker;
  tick: () => void;
} {
  let onTick = (): void => {
    throw new Error("the ticker was never started");
  };
  return {
    ticker: (fn) => {
      onTick = fn;
      return { stop: () => {} };
    },
    tick: () => onTick(),
  };
}

/** The dependencies a test does not care about, filled with quiet defaults. */
function depsOver(
  store: RunStore,
  runtime: SessionRuntime,
  extra: Partial<StepSessionDeps> = {},
): StepSessionDeps {
  return {
    store,
    runtime,
    progressIntervalMs: 30_000,
    ticker: handTicker().ticker,
    log: () => {},
    ...extra,
  };
}

describe("a step session, started and watched", () => {
  it("activates the run with the runtime's session id, held by this process", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);

    await startStepSession(
      depsOver(
        store,
        runtimeReturning({
          sessionId: "session-abc",
          completed: Promise.resolve({ sessionId: "session-abc", ok: true }),
        }),
      ),
      { runId: run.id, request, label: `${run.id} (planning)` },
    );

    const after = store.get(run.id);
    expect(after?.status).toBe("active");
    expect(after?.sessionId).toBe("session-abc");
    expect(after?.holder).toMatchObject({
      command: "timone daemon scratch-app#7/1",
      pid: process.pid,
    });
  });

  it("stamps the run's heartbeat on every tick of the ticker it was given", async () => {
    const clock = { now: "2026-09-27T10:00:00Z" };
    const store = newStore(clock);
    const { run } = store.register("scratch-app", 7);
    const hand = handTicker();

    await startStepSession(
      depsOver(
        store,
        runtimeReturning({
          sessionId: "session-abc",
          // Never settles: the session is still working while the ticks land.
          completed: new Promise(() => {}),
        }),
        { ticker: hand.ticker },
      ),
      { runId: run.id, request, label: `${run.id} (planning)` },
    );

    clock.now = "2026-09-27T10:05:00Z";
    hand.tick();
    expect(store.get(run.id)?.heartbeatAt).toBe("2026-09-27T10:05:00Z");

    clock.now = "2026-09-27T10:05:30Z";
    hand.tick();
    expect(store.get(run.id)?.heartbeatAt).toBe("2026-09-27T10:05:30Z");
  });

  it("finishes with how the session ended and what it cost", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    const summary: SessionSummary = {
      durationMs: 312_000,
      turns: 41,
      costUsd: 1.87,
      models: [{ model: "claude-opus-5-5", outputTokens: 18_400 }],
    };

    const session = await startStepSession(
      depsOver(
        store,
        runtimeReturning({
          sessionId: "session-abc",
          completed: Promise.resolve({
            sessionId: "session-abc",
            ok: false,
            error: "error_max_turns",
          }),
          progress: {
            snapshot: () => ({ elapsedMs: 0, replies: 0, outputTokens: 0, subAgents: 0 }),
            summary: () => summary,
          },
        }),
      ),
      { runId: run.id, request, label: `${run.id} (planning)` },
    );

    expect(await session.completed).toEqual({
      outcome: { sessionId: "session-abc", ok: false, error: "error_max_turns" },
      summary: {
        durationMs: 312_000,
        turns: 41,
        costUsd: 1.87,
        models: [{ model: "claude-opus-5-5", outputTokens: 18_400 }],
      },
    });
  });

  it("ends the runtime's session when it is told to stop", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    let stops = 0;

    const session = await startStepSession(
      depsOver(
        store,
        runtimeReturning({
          sessionId: "session-abc",
          completed: new Promise(() => {}),
          stop: () => {
            stops += 1;
          },
        }),
      ),
      { runId: run.id, request, label: `${run.id} (planning)` },
    );
    session.stop();

    expect(stops).toBe(1);
  });

  it("puts a parked run back on the same wait when its session fails to start", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-before");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "runner",
      stage: "requirements",
      waitCursor: "2026-09-27T09:30:00Z",
    });
    // Read while the start is in flight. Without it, "still parked" at the end
    // would also be true of a run nobody ever took off its wait.
    let statusWhileStarting: string | undefined;

    const starting = startStepSession(
      depsOver(store, {
        async start() {
          statusWhileStarting = store.get(run.id)?.status;
          throw new Error("docker: no such image");
        },
      }),
      { runId: run.id, request, label: `${run.id} (requirements)` },
    );

    await expect(starting).rejects.toThrow("docker: no such image");
    expect(statusWhileStarting).toBe("active");
    const after = store.get(run.id);
    expect(after?.status).toBe("parked");
    expect(after?.wait).toMatchObject({
      on: "your answer on the ticket",
      kind: "runner",
      opened: "2026-09-27T09:30:00Z",
    });
  });
});
