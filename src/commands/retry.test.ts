import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import { acquireStateLock } from "../daemon/lock.js";
import { pending } from "../daemon/requests.js";
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

describe("timone retry", async () => {
  it("refuses an unknown project with guidance", async () => {
    // ✏ 2026-09-30: this also refused an untracked ticket in words of its
    // own. Every project is driven by the runner now, and a known project's
    // ticket gets the runner's sentence whatever the ledger holds.
    const store = newStore();
    const { log, lines } = collect();

    expect(await runRetry("nope#1", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toContain("scratch-app");
  });

  /**
   * Only a refusal that *names a holder* is a live daemon. A lock nobody can
   * read names nobody, and asking a daemon that may not exist to do something
   * would be worse than saying so.
   */
  it("asks nobody when the lock cannot be read at all", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-retry-unreadable-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-06T10:00:00Z" });
    failedRun(store);
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(`${statePath}.lock`, "not a lock", "utf8");
    const { log, lines } = collect();

    const code = await runRetry("scratch-app#6", { manifest, store, statePath, log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toContain("cannot be read");
    expect(pending(statePath).requests).toEqual([]);
  });

  it("refuses a malformed target with the shape it wanted", async () => {
    const { log, lines } = collect();

    const code = await runRetry("scratch-app", { manifest, store: newStore(), log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/<project>#<ticket>/);
  });
});

describe("timone retry — a project the runner drives", async () => {
  // ADR-0060 D6 and PRD-05 R11: `retry` is removed for these projects, and
  // the runner drives every project. The runner reads the ticket each time it
  // wakes, so the sentence sends the person there, on whichever path the
  // command takes.
  const runnerManifest: Manifest = {
    projects: {
      "scratch-app": {
        repo_url: "https://github.com/fvermaut/scratch-app.git",
        path: "projects/scratch-app",
        stack: [],
        bindings: { ticketing: "github" },
        instructors: ["fvermaut"],
      },
    },
  };

  it("refuses with the sentence that sends the person to the ticket, when no daemon holds the ledger", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-retry-runner-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-06T10:00:00Z" });
    failedRun(store);
    const before = store.get("scratch-app#6/1");
    const { log, lines } = collect();

    const code = await runRetry("scratch-app#6", { manifest: runnerManifest, store, statePath, log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toBe(
      "This project is run by the runner. Write on the ticket instead: say what you want done.",
    );
    expect(store.get("scratch-app#6/1")).toEqual(before);
  });

  it("refuses on a project whose entry names no driver, and leaves the failed run as it was", async () => {
    // Every project is driven by the runner now, so the refusal no longer
    // depends on what the project's entry says.
    const store = newStore();
    failedRun(store);
    const before = store.get("scratch-app#6/1");
    const { log, lines } = collect();

    const code = await runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toBe(
      "This project is run by the runner. Write on the ticket instead: say what you want done.",
    );
    expect(store.get("scratch-app#6/1")).toEqual(before);
  });

  it("refuses with the same sentence when a daemon holds the ledger, and asks it for nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-retry-runner-daemon-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-06T10:00:00Z" });
    failedRun(store);
    const before = store.get("scratch-app#6/1");
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    const { log, lines } = collect();

    const code = await runRetry("scratch-app#6", {
      manifest: runnerManifest,
      store,
      statePath,
      log,
    });

    expect(code).toBe(1);
    expect(lines.join("\n")).toBe(
      "This project is run by the runner. Write on the ticket instead: say what you want done.",
    );
    expect(pending(statePath).requests).toEqual([]);
    expect(store.get("scratch-app#6/1")).toEqual(before);
  });
});
