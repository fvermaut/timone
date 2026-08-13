import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import { acquireStateLock } from "../daemon/lock.js";
import { runRetry } from "./retry.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const manifest: Manifest = {
  projects: {
    "scratch-app": {
      repo_url: "https://github.com/fvermaut/scratch-app.git",
      path: "projects/scratch-app",
      stack: [],
      bindings: { ticketing: "github" },
    },
  },
};

function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-retry-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-06T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

/** A run that failed mid-execution, branch and pull request in hand. */
function failedRun(store: RunStore): void {
  const { run } = store.register("scratch-app", 6);
  store.activate(run.id, "s1");
  store.claimBranch(run.id, "timone/6-fiddly-box");
  store.recordPullRequest(run.id, 9);
  store.setStage(run.id, "execution");
  store.fail(run.id, "the session died mid-slice");
}

function collect(): { log: (line: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (line) => lines.push(line), lines };
}

describe("timone retry", () => {
  it("re-arms a failed run at its stage, keeping everything it owned", () => {
    const store = newStore();
    failedRun(store);
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(0);
    const run = store.get("scratch-app#6");
    expect(run?.status).toBe("picked-up");
    expect(run?.stage).toBe("execution");
    expect(run?.branch).toBe("timone/6-fiddly-box");
    expect(run?.pr).toBe(9);
    expect(run?.failure).toBeUndefined();
    expect(lines.join("\n")).toMatch(/picks it up|next cycle/i);
  });

  it("refuses a run that is not failed, saying what it is doing", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.park(run.id, {
      waitingOn: "your approval of the plan",
      kind: "gate",
      stage: "planning",
    });
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6")?.status).toBe("parked");
    expect(lines.join("\n")).toMatch(/your approval of the plan/);
  });

  it("refuses a finished run rather than resurrecting it", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.complete(run.id);
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/finished/i);
  });

  it("refuses when the project has moved on to another ticket", () => {
    const store = newStore();
    failedRun(store);
    // The failure freed the project; another ticket has since claimed it.
    const { run: next } = store.register("scratch-app", 8);
    store.activate(next.id, "s2");
    store.claimBranch(next.id, "timone/8-other-work");
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6")?.status).toBe("failed");
    expect(lines.join("\n")).toMatch(/#8|another/i);
  });

  it("refuses an untracked ticket and an unknown project with guidance", () => {
    const store = newStore();
    const { log, lines } = collect();

    expect(runRetry("scratch-app#99", { manifest, store, log })).toBe(1);
    expect(runRetry("nope#1", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toMatch(/timone.*label|not working on/i);
    expect(lines.join("\n")).toContain("scratch-app");
  });

  it("re-arms nothing while a daemon holds the ledger, and says who has it", () => {
    // ADR-0023: retry rewinds a run and hands it back to the loop, so it
    // writes the ledger — and two writers of one field is the race.
    const dir = mkdtempSync(join(tmpdir(), "timone-retry-lock-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-06T10:00:00Z" });
    failedRun(store);
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, statePath, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6")?.status).toBe("failed");
    expect(lines.join("\n")).toContain("timone daemon");
    expect(lines.join("\n")).toContain("4213");
  });

  it("refuses a malformed target with the shape it wanted", () => {
    const { log, lines } = collect();

    const code = runRetry("scratch-app", { manifest, store: newStore(), log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/<project>#<ticket>/);
  });
});
