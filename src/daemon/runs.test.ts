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

describe("retry", () => {
  it("re-arms a failed run keeping its branch, stage and pull request", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.setStage(run.id, "execution");
    store.fail(run.id, "died mid-slice");

    const rearmed = store.retry(run.id);

    expect(rearmed.status).toBe("picked-up");
    expect(rearmed.stage).toBe("execution");
    expect(rearmed.branch).toBe("timone/6-fiddly-box");
    expect(rearmed.pr).toBe(9);
    expect(rearmed.failure).toBeUndefined();
  });

  it("leaves the dead attempt's flags behind", () => {
    // 14g: #11 resumed still carrying `the session changed 1 file(s) outside
    // projects/scratch-app/` from its crashed attempt — a flag whose cause
    // had already been fixed — so `timone status` warned about a file that
    // no longer existed. `flags` is the third field belonging to the dead
    // attempt, beside `failure` and `sessionId`, and was simply missed.
    const store = newStore();
    const { run } = store.register("scratch-app", 11);
    store.activate(run.id, "s1");
    store.flag(run.id, "the session changed 1 file(s) outside `projects/scratch-app/`");
    store.fail(run.id, "died mid-slice");

    expect(store.retry(run.id).flags).toEqual([]);
  });

  it("keeps the flags the fresh attempt earns for itself", () => {
    // The property that separates "clear the dead attempt's" from "clear
    // all": re-arming forgets the old attempt's findings, not every finding
    // the run will ever collect.
    const store = newStore();
    const { run } = store.register("scratch-app", 11);
    store.activate(run.id, "s1");
    store.flag(run.id, "from the attempt that died");
    store.fail(run.id, "died mid-slice");
    store.retry(run.id);

    store.flag(run.id, "from the attempt that followed");

    expect(store.get(run.id)?.flags).toEqual(["from the attempt that followed"]);
  });

  it("refuses to retry anything that is not failed", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");

    expect(() => store.retry(run.id)).toThrow(/not failed/);
  });

  it("refuses when another run has since claimed the project", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.fail(run.id, "died");
    const { run: next } = store.register("scratch-app", 8);
    store.activate(next.id, "s2");

    expect(() => store.retry(run.id)).toThrow(/scratch-app#8|session/);
    expect(store.get(run.id)?.status).toBe("failed");
  });
});

describe("the heartbeat, and the runs that have stopped making one", () => {
  /** A store whose clock the test sets by hand, instant by instant. */
  function clockedStore(path = statePath()): {
    store: RunStore;
    set: (iso: string) => void;
  } {
    let instant = "2026-08-06T10:00:00Z";
    return {
      store: RunStore.open(path, { now: () => instant }),
      set: (iso) => {
        instant = iso;
      },
    };
  }

  const FOUR_INTERVALS = 4 * 30 * 1000;

  it("stamps the heartbeat without pretending the run moved", () => {
    // `updatedAt` is what `timone status` reads as when the run started
    // working. A heartbeat that overwrote it would make every long session
    // look as though it had just begun.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    const activatedAt = store.get(run.id)!.updatedAt;

    set("2026-08-06T10:04:00Z");
    store.heartbeat(run.id);

    expect(store.get(run.id)?.heartbeatAt).toBe("2026-08-06T10:04:00Z");
    expect(store.get(run.id)?.updatedAt).toBe(activatedAt);
  });

  it("never calls a run stale while its heartbeat is fresh, however long it has run", () => {
    // The false positive that would be worst, and the property the rejected
    // startup-sweep alternative could not have had: a healthy four-hour
    // execution session must survive every cycle of every daemon.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");

    set("2026-08-06T14:00:00Z");
    store.heartbeat(run.id);
    set("2026-08-06T14:00:20Z");

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
  });

  it("calls a run stale once its heartbeat is older than the threshold", () => {
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.heartbeat(run.id);

    set("2026-08-06T10:03:00Z");

    expect(store.staleRuns(FOUR_INTERVALS).map((stale) => stale.id)).toEqual([
      "scratch-app#7",
    ]);
  });

  it("judges a run that has never ticked by when it last moved", () => {
    // Both the run picked up two seconds ago and the one an older daemon left
    // `active` for a week look identical — neither has a heartbeat — and the
    // difference between them is entirely in `updatedAt`.
    const { store, set } = clockedStore();
    store.register("scratch-app", 7);

    set("2026-08-06T10:00:30Z");
    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);

    set("2026-08-06T10:09:00Z");
    expect(store.staleRuns(FOUR_INTERVALS)).toHaveLength(1);
  });

  it("reclaims a run written before this field existed rather than leaving it immortal", () => {
    const path = statePath();
    const { store: seed } = clockedStore(path);
    const { run } = seed.register("scratch-app", 7);
    seed.activate(run.id, "session-abc");

    // Strip the field the way an older state file would have it: absent.
    const state = JSON.parse(readFileSync(path, "utf8")) as {
      runs: Record<string, unknown>[];
    };
    expect(state.runs[0]).not.toHaveProperty("heartbeatAt");

    const reopened = RunStore.open(path, {
      now: () => "2026-08-06T11:00:00Z",
    });
    expect(reopened.staleRuns(FOUR_INTERVALS).map((r) => r.id)).toEqual([
      "scratch-app#7",
    ]);
  });

  it("leaves a parked run alone however long it waits", () => {
    // A park is a human wait, and humans take weeks. Reclaiming one would
    // fail a run because nobody had answered yet.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.park(run.id, { waitingOn: "your answer on the ticket", kind: "gate" });

    set("2026-08-20T10:00:00Z");

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
  });

  it("leaves finished runs alone, however old", () => {
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s");
    store.complete(run.id);

    const second = store.register("scratch-app", 8).run;
    store.activate(second.id, "s2");
    store.fail(second.id, "something broke");

    set("2026-09-01T10:00:00Z");

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
  });

  it("lets a reclaimed run be failed and then retried, with no new transition", () => {
    // Reclaim is not recovery: the way back is `timone retry`, and it needs
    // no change to handle a run that stopped this way rather than any other.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.claimBranch(run.id, "timone/7-slow");

    set("2026-08-06T10:09:00Z");
    const [stale] = store.staleRuns(FOUR_INTERVALS);
    store.fail(stale.id, "the daemon running it stopped");

    const rearmed = store.retry(stale.id);
    expect(rearmed.status).toBe("picked-up");
    expect(rearmed.branch).toBe("timone/7-slow");
    expect(rearmed.failure).toBeUndefined();
  });

  it("frees the project the moment a stale run is failed", () => {
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.claimBranch(run.id, "timone/7-slow");
    const queued = store.register("scratch-app", 8).run;
    expect(queued.status).toBe("queued");

    set("2026-08-06T10:09:00Z");
    store.fail(store.staleRuns(FOUR_INTERVALS)[0].id, "the daemon stopped");

    expect(store.get("scratch-app#8")?.status).toBe("picked-up");
    expect(store.occupyingRun("scratch-app")?.id).toBe("scratch-app#8");
  });

  it("has nothing more to reclaim once it has reclaimed", () => {
    // Idempotence across cycles: the second cycle must find nothing, or the
    // daemon would comment on the same ticket every minute forever.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");

    set("2026-08-06T10:09:00Z");
    const first = store.staleRuns(FOUR_INTERVALS);
    expect(first).toHaveLength(1);
    store.fail(first[0].id, "the daemon stopped");

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
  });
});

describe("two processes writing the one ledger", () => {
  it("does not let a long-lived store write another process's flag out of existence", () => {
    // Since ADR-0018 the guardrail checks run as hooks in their own process,
    // and flagging a run is one of the things they do. A daemon holding an
    // in-memory copy from before the hook ran used to write that flag straight
    // back out — silently losing exactly the record the checks exist to leave.
    const path = statePath();
    const daemon = newStore(path);
    const { run } = daemon.register("scratch-app", 7);
    daemon.activate(run.id, "session-abc");

    const hook = newStore(path);
    hook.flag(run.id, "scratch-app: 1 commit(s) never reached the remote");

    daemon.setStage(run.id, "planning");

    expect(RunStore.open(path).get(run.id)?.flags).toEqual([
      "scratch-app: 1 commit(s) never reached the remote",
    ]);
  });

  it("still applies its own change on top of what the other process wrote", () => {
    const path = statePath();
    const daemon = newStore(path);
    const { run } = daemon.register("scratch-app", 7);
    daemon.activate(run.id, "session-abc");

    newStore(path).flag(run.id, "a violation");
    daemon.setStage(run.id, "planning");

    const final = RunStore.open(path).get(run.id);
    expect(final?.stage).toBe("planning");
    expect(final?.flags).toEqual(["a violation"]);
  });

  it("sees a run another process registered, rather than refusing it exists", () => {
    const path = statePath();
    const daemon = newStore(path);
    daemon.register("scratch-app", 7);

    newStore(path).register("scratch-app", 8);

    // Registering the same ticket again from the first store must find the
    // existing run, not create a second one on top of it.
    expect(daemon.register("scratch-app", 8).created).toBe(false);
  });
});

describe("a heartbeat belongs to the session that wrote it", () => {
  function clockedStore(path = statePath()): {
    store: RunStore;
    set: (iso: string) => void;
  } {
    let instant = "2026-08-07T10:00:00Z";
    return {
      store: RunStore.open(path, { now: () => instant }),
      set: (iso) => {
        instant = iso;
      },
    };
  }

  const FOUR_INTERVALS = 4 * 30 * 1000;

  it("does not reclaim a run that was just re-armed under an old heartbeat", () => {
    // Fired live on 2026-08-07. A run retried hours after its session died
    // still carried that session's last tick, and the very next cycle
    // reclaimed it before it had a chance to start — so `timone retry`, the
    // one road back from failure, undid itself.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-one");
    store.heartbeat(run.id);

    // Hours pass; the session dies and the run is reclaimed and retried.
    set("2026-08-07T14:00:00Z");
    store.fail(run.id, "the machine running it stopped");
    store.retry(run.id);

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
  });

  it("still reclaims a run whose newer heartbeat has gone quiet", () => {
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-one");

    set("2026-08-07T14:00:00Z");
    store.heartbeat(run.id);
    set("2026-08-07T14:09:00Z");

    expect(store.staleRuns(FOUR_INTERVALS).map((r) => r.id)).toEqual([
      "scratch-app#7",
    ]);
  });

  it("takes the later of the two signals, whichever it happens to be", () => {
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-one");
    store.heartbeat(run.id);

    // The run moves on later than it last ticked — a stage transition.
    set("2026-08-07T10:05:00Z");
    store.setStage(run.id, "planning");
    set("2026-08-07T10:06:00Z");

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
  });
});
