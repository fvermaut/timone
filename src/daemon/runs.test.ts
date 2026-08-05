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
    expect(() => store.park(run.id, { waitingOn: "the human" })).toThrow(
      /picked-up/,
    );
  });

  it("keeps a parked run holding its project once it owns a branch", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/7-reset-password");
    store.park(run.id, { waitingOn: "approval on the ticket", kind: "gate" });

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(store.register("scratch-app", 8).run.status).toBe("queued");
  });
});

describe("the holds-the-project rule", () => {
  /** A run parked at a stage that touches no repository. */
  function parkedBranchless(store: RunStore, ticket: number): string {
    const { run } = store.register("scratch-app", ticket);
    store.activate(run.id, `session-${ticket}`);
    store.park(run.id, { waitingOn: "an answer", kind: "conversation" });
    return run.id;
  }

  it("lets a branchless parked run go, so one unanswered ticket cannot freeze a project", () => {
    const store = newStore();
    parkedBranchless(store, 7);

    expect(store.occupyingRun("scratch-app")).toBeUndefined();
    expect(store.register("scratch-app", 8).run.status).toBe("picked-up");
  });

  it("starts holding the project the moment a run claims a branch", () => {
    const store = newStore();
    const id = parkedBranchless(store, 7);

    expect(store.occupyingRun("scratch-app")).toBeUndefined();
    store.claimBranch(id, "timone/7-reset-password");

    expect(store.occupyingRun("scratch-app")?.id).toBe(id);
    expect(store.register("scratch-app", 8).run.status).toBe("queued");
  });

  it("parks several branchless runs side by side", () => {
    const store = newStore();
    parkedBranchless(store, 7);
    parkedBranchless(store, 8);
    parkedBranchless(store, 9);

    const parked = store
      .runsFor("scratch-app")
      .filter((run) => run.status === "parked");
    expect(parked.map((run) => run.ticket)).toEqual([7, 8, 9]);
    expect(store.queue("scratch-app")).toEqual([]);
  });

  it("still runs one session at a time, however many runs are parked", () => {
    const store = newStore();
    parkedBranchless(store, 7);
    const second = store.register("scratch-app", 8);
    store.activate(second.run.id, "session-8");

    // #7's answer arrives while #8's session is mid-flight: it has to wait
    // its turn, because sessions serialize even when nothing is held.
    const third = store.register("scratch-app", 9);
    expect(third.run.status).toBe("queued");
    expect(() => store.activate("scratch-app#7", "session-7b")).toThrow(
      /scratch-app#8/,
    );
  });

  it("frees the session slot when a branchless run parks", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");

    store.park(first.run.id, { waitingOn: "an answer", kind: "conversation" });

    expect(store.get(second.run.id)?.status).toBe("picked-up");
  });

  it("does not promote the queue behind a run that parked holding a branch", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");

    store.park(first.run.id, { waitingOn: "approval", kind: "gate" });

    expect(store.get(second.run.id)?.status).toBe("queued");
    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
  });

  it("promotes the queue when a branch-holding run finally ends", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");
    store.park(first.run.id, { waitingOn: "approval", kind: "gate" });

    store.complete(first.run.id);

    expect(store.get(second.run.id)?.status).toBe("picked-up");
  });

  it("enforces the rule in the store rather than trusting its callers", () => {
    // Claiming a branch is a claim on a shared resource, so the store checks
    // it rather than trusting the caller to have looked first.
    const store = newStore();
    const first = parkedBranchless(store, 7);
    const second = store.register("scratch-app", 8);
    store.activate(second.run.id, "session-8");

    expect(() => store.claimBranch(first, "timone/7-reset-password")).toThrow(
      /scratch-app#8/,
    );
  });

  it("refuses to resume a parked run while another holds the project on a branch", () => {
    const store = newStore();
    // #7 waits for an answer holding nothing, so #8 gets picked up, claims a
    // branch and parks on its own gate.
    const first = parkedBranchless(store, 7);
    const second = store.register("scratch-app", 8);
    store.activate(second.run.id, "session-8");
    store.claimBranch(second.run.id, "timone/8-export");
    store.park(second.run.id, { waitingOn: "approval", kind: "gate" });

    // #7's answer now arrives. Its session slot is free, but the repository
    // is not: it waits until #8 is finished with it.
    expect(() => store.activate(first, "session-7b")).toThrow(
      /scratch-app#8.*timone\/8-export/,
    );
  });

  it("promotes a run left queued behind a park that no longer holds anything", () => {
    // Exactly the ledger phase 11 leaves behind: one parked run that held
    // its project under the old rule, and one queued behind it.
    const path = statePath();
    const store = newStore(path);
    const first = store.register("scratch-app", 4);
    const second = store.register("scratch-app", 6);
    store.activate(first.run.id, "session-4");
    store.park(first.run.id, { waitingOn: "the next stage", stage: "triage" });
    // The park itself already promotes; a reopened store must reach the same
    // conclusion from the file alone.
    expect(store.get(second.run.id)?.status).toBe("picked-up");

    const reopened = RunStore.open(path);
    expect(reopened.promoteQueue("scratch-app")?.ticket).toBe(6);
  });

  it("promotes nothing while the project is held", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");

    expect(store.promoteQueue("scratch-app")?.ticket).toBe(7);
    expect(store.get(second.run.id)?.status).toBe("queued");
  });

  it("records what a parked run is waiting for, and where the gate starts", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/7-reset-password");
    store.park(run.id, {
      waitingOn: "approval on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T10:00:00Z",
    });

    expect(store.get(run.id)).toMatchObject({
      waitingOn: "approval on the ticket",
      waitingKind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T10:00:00Z",
      branch: "timone/7-reset-password",
    });
  });

  it("clears what a run waits on once it resumes", () => {
    const store = newStore();
    const id = parkedBranchless(store, 7);
    store.activate(id, "session-1b");

    expect(store.get(id)?.waitingOn).toBeUndefined();
    expect(store.get(id)?.waitingKind).toBeUndefined();
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
    store.claimBranch(first.run.id, "timone/7-reset-password");
    store.park(first.run.id, {
      waitingOn: "approval on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T10:00:00Z",
    });

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

describe("the pull request on a run", () => {
  it("records the pull request a delivered run is waiting on", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");

    const updated = store.recordPullRequest(run.id, 9);

    expect(updated.pr).toBe(9);
  });

  it("persists the pull request and the review wait across a reopen", () => {
    const path = statePath();
    const store = newStore(path);
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "delivery",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    const reopened = RunStore.open(path).get(run.id);

    expect(reopened?.pr).toBe(9);
    expect(reopened?.waitingKind).toBe("review");
    expect(reopened?.stage).toBe("delivery");
  });

  it("holds the project while parked on a review, and frees it on completion", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, { waitingOn: "your review", kind: "review", stage: "delivery" });

    // A queued ticket stays queued behind the open pull request…
    const { run: queued } = store.register("scratch-app", 8);
    expect(queued.status).toBe("queued");

    // …and starts the moment the PR's merge completes the run (R10).
    store.complete(run.id);
    expect(store.get(queued.id)?.status).toBe("picked-up");
  });
});
