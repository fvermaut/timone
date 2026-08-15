import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import { acquireStateLock } from "../daemon/lock.js";
import { runCancel } from "./cancel.js";

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
  const dir = mkdtempSync(join(tmpdir(), "timone-cancel-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-15T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

function collect(): { log: (line: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (line) => lines.push(line), lines };
}

describe("timone cancel", () => {
  it("ends the ticket's current chunk and says what it did", () => {
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

    const code = runCancel("scratch-app#6", { manifest, store, log });

    expect(code).toBe(0);
    expect(store.get("scratch-app#6/1")?.status).toBe("cancelled");
    expect(lines.join("\n")).toContain("scratch-app #6");
    expect(lines.join("\n")).toMatch(/stopped|cancelled/i);
  });

  it("records the human's own words as the reason", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    const { log, lines } = collect();

    const code = runCancel("scratch-app#6", {
      manifest,
      store,
      reason: "we shipped this by hand yesterday",
      log,
    });

    expect(code).toBe(0);
    expect(store.get("scratch-app#6/1")?.cancellation).toBe(
      "we shipped this by hand yesterday",
    );
    expect(lines.join("\n")).toContain("we shipped this by hand yesterday");
  });

  it("cancels a run still waiting in the queue", () => {
    const store = newStore();
    const first = store.register("scratch-app", 6);
    store.activate(first.run.id, "s1");
    store.register("scratch-app", 8);
    const { log } = collect();

    expect(runCancel("scratch-app#8", { manifest, store, log })).toBe(0);
    expect(store.get("scratch-app#8/1")?.status).toBe("cancelled");
    expect(store.get("scratch-app#6/1")?.status).toBe("active");
  });

  it("refuses a ticket it has no run for", () => {
    const store = newStore();
    const { log, lines } = collect();

    expect(runCancel("scratch-app#99", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toMatch(/not working on/i);
  });

  it("refuses a finished run rather than unfinishing it", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.complete(run.id);
    const { log, lines } = collect();

    expect(runCancel("scratch-app#6", { manifest, store, log })).toBe(1);
    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(lines.join("\n")).toMatch(/finished/i);
    // The refusal is a sentence, not the store's transition complaint leaking
    // through the catch — which is what a person sees if this branch is gone.
    expect(lines.join("\n")).not.toMatch(/cannot go from/);
  });

  it("ends a failed run rather than sending the human via `timone retry`", () => {
    // Ruled by fvermaut 2026-08-15. This case used to refuse and point at
    // `timone retry`, which made clearing a failed run a two-command dance —
    // and between the two the daemon can pick the re-armed run up and spend
    // real money on work somebody was trying to delete.
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.fail(run.id, "the session died mid-slice");
    const { log, lines } = collect();

    const code = runCancel("scratch-app#6", {
      manifest,
      store,
      reason: "we shipped this by hand yesterday",
      log,
    });

    expect(code).toBe(0);
    expect(store.get("scratch-app#6/1")?.status).toBe("cancelled");
    expect(store.get("scratch-app#6/1")?.cancellation).toBe(
      "we shipped this by hand yesterday",
    );
    expect(lines.join("\n")).toContain(
      "Stopped work on scratch-app #6: we shipped this by hand yesterday.",
    );
    // The old refusal's advice must be gone with it: a cancelled chunk is
    // exactly what `timone retry` will not touch.
    expect(lines.join("\n")).not.toContain("timone retry");
  });

  it("says a run was already cancelled rather than cancelling it twice", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.cancel(run.id, "you asked me to stop");
    const { log, lines } = collect();

    expect(runCancel("scratch-app#6", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toMatch(/already cancelled/i);
    expect(lines.join("\n")).toContain("you asked me to stop");
  });

  it("refuses an unknown project and a malformed target with guidance", () => {
    const store = newStore();
    const { log, lines } = collect();

    expect(runCancel("nope#1", { manifest, store, log })).toBe(1);
    expect(runCancel("scratch-app", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toContain("scratch-app");
    expect(lines.join("\n")).toMatch(/<project>#<ticket>/);
  });

  it("cancels nothing while a daemon holds the ledger, and says who has it", () => {
    // ADR-0023: cancelling writes the ledger, and two writers of one field is
    // the race the lock exists for.
    const dir = mkdtempSync(join(tmpdir(), "timone-cancel-lock-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-15T10:00:00Z" });
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    const { log, lines } = collect();

    const code = runCancel("scratch-app#6", { manifest, store, statePath, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6/1")?.status).toBe("active");
    expect(lines.join("\n")).toContain("timone daemon");
    expect(lines.join("\n")).toContain("4213");
  });
});
