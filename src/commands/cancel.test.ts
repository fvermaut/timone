import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import { acquireStateLock } from "../daemon/lock.js";
import { pending, settle } from "../daemon/requests.js";
import { runCancel } from "./cancel.js";
import type { TicketingAdapter } from "../adapters/ticketing.js";

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

describe("timone cancel", async () => {
  it("ends the ticket's current chunk and says what it did", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.park(run.id, {
      waitingOn: "your approval of the plan",
      kind: "runner",
      stage: "planning",
    });
    const { log, lines } = collect();

    const code = await runCancel("scratch-app#6", { manifest, store, log });

    expect(code).toBe(0);
    expect(store.get("scratch-app#6/1")?.status).toBe("cancelled");
    expect(lines.join("\n")).toContain("scratch-app #6");
    expect(lines.join("\n")).toMatch(/stopped|cancelled/i);
  });

  it("records the human's own words as the reason", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    const { log, lines } = collect();

    const code = await runCancel("scratch-app#6", {
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

  it("cancels a run still waiting in the queue", async () => {
    const store = newStore();
    const first = store.register("scratch-app", 6);
    store.activate(first.run.id, "s1");
    store.register("scratch-app", 8);
    const { log } = collect();

    expect(await runCancel("scratch-app#8", { manifest, store, log })).toBe(0);
    expect(store.get("scratch-app#8/1")?.status).toBe("cancelled");
    expect(store.get("scratch-app#6/1")?.status).toBe("active");
  });

  it("refuses a ticket it has no run for", async () => {
    const store = newStore();
    const { log, lines } = collect();

    expect(await runCancel("scratch-app#99", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toMatch(/not working on/i);
  });

  it("refuses a finished run rather than unfinishing it", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.complete(run.id);
    const { log, lines } = collect();

    expect(await runCancel("scratch-app#6", { manifest, store, log })).toBe(1);
    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(lines.join("\n")).toMatch(/finished/i);
    // The refusal is a sentence, not the store's transition complaint leaking
    // through the catch — which is what a person sees if this branch is gone.
    expect(lines.join("\n")).not.toMatch(/cannot go from/);
  });

  it("says a run was already cancelled rather than cancelling it twice", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.cancel(run.id, "you asked me to stop");
    const { log, lines } = collect();

    expect(await runCancel("scratch-app#6", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toMatch(/already cancelled/i);
    expect(lines.join("\n")).toContain("you asked me to stop");
  });

  it("refuses an unknown project and a malformed target with guidance", async () => {
    const store = newStore();
    const { log, lines } = collect();

    expect(await runCancel("nope#1", { manifest, store, log })).toBe(1);
    expect(await runCancel("scratch-app", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toContain("scratch-app");
    expect(lines.join("\n")).toMatch(/<project>#<ticket>/);
  });

  /**
   * The refusal ADR-0032 replaced, and the one that mattered most: a handoff
   * park holds its project (ADR-0031) and this is the way out of it, so
   * `cancel` being unrunnable against a live daemon was load-bearing for the
   * bug this phase exists to fix.
   */
  it("asks the daemon holding the ledger, names it, and gives up saying so", async () => {
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

    const code = await runCancel("scratch-app#6", {
      manifest,
      store,
      statePath,
      log,
      wait: { intervalMs: 1, boundMs: 3, sleep: async () => {} },
    });

    expect(code).toBe(1);
    expect(lines.join("\n")).toContain("timone daemon");
    expect(lines.join("\n")).toContain("4213");
    expect(lines.join("\n")).toContain("still queued");
    expect(pending(statePath).requests.map((request) => request.body.kind)).toEqual([
      "cancel",
    ]);
    expect(store.get("scratch-app#6/1")?.status).toBe("active");
  });

  it("reports the stop, in the human's own words, once the daemon has made it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-cancel-served-"));
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
    const daemonCycle = async (): Promise<void> => {
      for (const request of pending(statePath).requests) {
        const { body } = request;
        store.cancel(run.id, body.kind === "cancel" ? (body.reason ?? "") : "");
        settle(request.path);
      }
    };

    const code = await runCancel("scratch-app#6", {
      manifest,
      store,
      statePath,
      log,
      reason: "I have changed my mind about labels",
      wait: { intervalMs: 1, boundMs: 100, sleep: daemonCycle },
    });

    expect(code).toBe(0);
    expect(store.get("scratch-app#6/1")?.status).toBe("cancelled");
    expect(lines.join("\n")).toContain("I have changed my mind about labels");
  });
});

describe("timone cancel — what it reports once the daemon has acted (40u)", () => {
  it("reports the stop by the run it cancelled, though the daemon has since taken the ticket up as a new run", async () => {
    // Verification of phase 40, found outside the verdicts, item 2: the daemon
    // cancelled the run, then took the still-marked ticket up afresh within
    // seconds, and the command read that new run and said it had failed.
    const dir = mkdtempSync(join(tmpdir(), "timone-cancel-taken-up-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-09-29T10:00:00Z" });
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    const { log, lines } = collect();
    const daemonCycles = async (): Promise<void> => {
      for (const request of pending(statePath).requests) {
        store.cancel(run.id, "not needed any more");
        settle(request.path);
        // The next pass finds the ticket still open and marked.
        store.register("scratch-app", 6);
      }
    };

    const code = await runCancel("scratch-app#6", {
      manifest,
      store,
      statePath,
      log,
      wait: { intervalMs: 1, boundMs: 100, sleep: daemonCycles },
    });

    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("Stopped work on scratch-app #6: not needed any more.");
    expect(lines.join("\n")).not.toContain("did not stop");
  });
});

describe("timone cancel — on a project the runner drives, with no daemon running (40u)", () => {
  /** scratch-app, instructed by the operator. */
  const runnerManifest: Manifest = {
    operator: "fvermaut",
    projects: {
      "scratch-app": {
        repo_url: "https://github.com/fvermaut/scratch-app.git",
        path: "projects/scratch-app",
        stack: [],
        bindings: { ticketing: "github" },
      },
    },
  };

  /** A forge that writes down every label put on a ticket, or refuses them all. */
  function labelForge(refuse?: string): { adapter: TicketingAdapter; applied: string[] } {
    const applied: string[] = [];
    const adapter = {
      async ensureLabel(): Promise<void> {
        if (refuse !== undefined) throw new Error(refuse);
      },
      async applyLabel(_project: unknown, number: number, label: string): Promise<void> {
        if (refuse !== undefined) throw new Error(refuse);
        applied.push(`#${number} ${label}`);
      },
    } as unknown as TicketingAdapter;
    return { adapter, applied };
  }

  it("puts the hold on the ticket, and says how to hand it back", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    const { adapter, applied } = labelForge();
    const { log, lines } = collect();

    const code = await runCancel("scratch-app#6", { manifest: runnerManifest, store, adapter, log });

    expect(code).toBe(0);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(applied).toEqual(["#6 timone:held"]);
    expect(lines.join("\n")).toContain("carries the `timone:held` label");
    expect(lines.join("\n")).not.toContain("start it afresh");
  });

  it("stops the work all the same when the forge refuses the hold, and says the ticket will be taken up again", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    const { adapter } = labelForge("gh: HTTP 502");
    const { log, lines } = collect();

    const code = await runCancel("scratch-app#6", { manifest: runnerManifest, store, adapter, log });

    expect(code).toBe(0);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(lines.join("\n")).toContain("I could not put the `timone:held` label on the ticket: gh: HTTP 502.");
    expect(lines.join("\n")).toContain("I'll start it afresh on my next pass");
  });
});
