import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RunStore } from "./runs.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A fresh state file path inside a throwaway directory. */
function statePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-runs-"));
  tempDirs.push(dir);
  return join(dir, ".timone", "state.json");
}

/** A store over a fresh state file with a deterministic, advancing clock. */
function newStore(path = statePath()): RunStore {
  let tick = 0;
  return RunStore.open(path, {
    now: () => `2026-08-02T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

describe("register", () => {
  it("activates a pickup on an idle project", () => {
    const store = newStore();
    const { run, created } = store.register("scratch-app", 7);

    expect(created).toBe(true);
    expect(run.status).toBe("picked-up");
    expect(run.project).toBe("scratch-app");
    expect(run.ticket).toBe(7);
    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
  });

  it("queues a pickup on a busy project", () => {
    const store = newStore();
    store.register("scratch-app", 7);
    const { run } = store.register("scratch-app", 8);

    expect(run.status).toBe("queued");
    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(store.queue("scratch-app").map((r) => r.ticket)).toEqual([8]);
    expect(store.queuePosition(run.id)).toBe(1);
  });

  it("does not let another project's run make a project busy", () => {
    const store = newStore();
    store.register("alpha", 1);
    expect(store.register("beta", 1).run.status).toBe("picked-up");
  });

  it("is a no-op for a ticket it already tracks", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");

    const second = store.register("scratch-app", 7);

    expect(second.created).toBe(false);
    expect(second.run.id).toBe(first.run.id);
    expect(second.run.status).toBe("active");
    expect(store.all()).toHaveLength(1);
  });

  it("still tracks one run when the earlier one has finished", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.complete(run.id);

    expect(store.register("scratch-app", 7).created).toBe(false);
    expect(store.all()).toHaveLength(1);
  });
});

describe("the one-active-run invariant", () => {
  it("refuses to activate a run while another occupies the project", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");

    expect(() => store.activate(second.run.id, "session-2")).toThrow(
      /scratch-app/,
    );
  });

  it("refuses transitions the lifecycle does not allow", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    expect(() => store.park(run.id, "the human")).toThrow(/picked-up/);
  });

  it("keeps a parked run occupying its project", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, "approval on the ticket");

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(store.register("scratch-app", 8).run.status).toBe("queued");
  });
});

describe("promotion", () => {
  it("promotes the head of the queue when a run completes", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.register("scratch-app", 8);
    store.register("scratch-app", 9);
    store.activate(first.run.id, "session-1");

    store.complete(first.run.id);

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(8);
    expect(store.queue("scratch-app").map((r) => r.ticket)).toEqual([9]);
  });

  it("promotes when a run fails, too", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");

    store.fail(first.run.id, "gh exploded");

    expect(store.occupyingRun("scratch-app")?.id).toBe(second.run.id);
    expect(store.get(first.run.id)?.failure).toBe("gh exploded");
  });

  it("promotes in pickup order, not ticket order", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.register("scratch-app", 12);
    store.register("scratch-app", 3);
    store.activate(first.run.id, "session-1");

    store.complete(first.run.id);

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(12);
  });

  it("leaves the project idle when nothing is queued", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.complete(run.id);

    expect(store.occupyingRun("scratch-app")).toBeUndefined();
    expect(store.queue("scratch-app")).toEqual([]);
  });
});

describe("flags", () => {
  it("records guardrail flags against the run", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.flag(run.id, "unpushed commits on phase/01");

    expect(store.get(run.id)?.flags).toEqual(["unpushed commits on phase/01"]);
  });

  it("keeps a run flagged across a reload", () => {
    const path = statePath();
    const store = newStore(path);
    const { run } = store.register("scratch-app", 7);
    store.flag(run.id, "STATUS.md off the default branch");

    expect(RunStore.open(path).get(run.id)?.flags).toEqual([
      "STATUS.md off the default branch",
    ]);
  });
});

describe("persistence", () => {
  it("round-trips state through the file", () => {
    const path = statePath();
    const store = newStore(path);
    const first = store.register("scratch-app", 7);
    store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");
    store.park(first.run.id, "approval on the ticket");

    const reopened = RunStore.open(path);

    expect(reopened.all()).toEqual(store.all());
    expect(reopened.occupyingRun("scratch-app")?.status).toBe("parked");
    expect(reopened.queue("scratch-app").map((r) => r.ticket)).toEqual([8]);
  });

  it("starts empty when no state file exists yet", () => {
    const store = RunStore.open(statePath());
    expect(store.all()).toEqual([]);
    expect(store.occupyingRun("scratch-app")).toBeUndefined();
  });

  it("writes valid JSON a human can read", () => {
    const path = statePath();
    const store = newStore(path);
    store.register("scratch-app", 7);

    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      version: number;
      runs: unknown[];
    };
    expect(parsed.version).toBe(1);
    expect(parsed.runs).toHaveLength(1);
  });

  it("fails loudly on a corrupt state file rather than starting fresh", () => {
    const path = statePath();
    const store = newStore(path);
    store.register("scratch-app", 7);
    writeFileSync(path, "{ not json");

    expect(() => RunStore.open(path)).toThrow(/state\.json/);
  });

  it("fails loudly when the state file has an unexpected shape", () => {
    const path = statePath();
    const store = newStore(path);
    store.register("scratch-app", 7);
    writeFileSync(path, JSON.stringify({ version: 1, runs: [{ id: "x" }] }));

    expect(() => RunStore.open(path)).toThrow(/state\.json/);
  });
});
