import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { Holder } from "./holder.js";
import { RunStore, runId, type Run } from "./runs.js";

/**
 * A slice of the ledger the daemon was actually running on 2026-08-14, copied
 * unchanged: four runs whose ids carry no chunk number, alongside the
 * introductions and the witness a real file has. Real rather than invented,
 * because the thing under test is whether *this* file still loads.
 */
const PRE_CHUNK_LEDGER = fileURLToPath(
  new URL("./fixtures/pre-chunk-state.json", import.meta.url),
);

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

describe("a run's identity", () => {
  it("names the project, the ticket and the chunk's sequence number", () => {
    expect(runId("scratch-app", 7, 1)).toBe("scratch-app#7/1");
    expect(runId("ivtrends", 12, 3)).toBe("ivtrends#12/3");
  });
});

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

  it("opens the ticket's next chunk once the previous one has finished", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.complete(first.run.id);

    const second = store.register("scratch-app", 7);

    expect(second.created).toBe(true);
    expect(second.run.id).toBe("scratch-app#7/2");
    expect(second.run.seq).toBe(2);
    expect(second.run.status).toBe("picked-up");
    expect(store.all()).toHaveLength(2);
  });
});

describe("a ticket's chunks", () => {
  it("has no live chunk before anything has been picked up", () => {
    const store = newStore();
    expect(store.liveRunForTicket("scratch-app", 7)).toBeUndefined();
    expect(store.runsForTicket("scratch-app", 7)).toEqual([]);
  });

  it("calls the one unfinished chunk the live one", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "approval on the ticket", kind: "runner" });

    expect(store.liveRunForTicket("scratch-app", 7)?.id).toBe(
      "scratch-app#7/1",
    );
  });

  it("has no live chunk once the ticket's only chunk has finished", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.complete(run.id);

    expect(store.liveRunForTicket("scratch-app", 7)).toBeUndefined();
    expect(store.runsForTicket("scratch-app", 7).map((r) => r.seq)).toEqual([1]);
  });

  it("lists a ticket's chunks in sequence order and lives in the last", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.complete(first.run.id);
    const second = store.register("scratch-app", 7);
    store.activate(second.run.id, "session-2");
    store.complete(second.run.id);
    const third = store.register("scratch-app", 7);

    expect(store.runsForTicket("scratch-app", 7).map((r) => r.id)).toEqual([
      "scratch-app#7/1",
      "scratch-app#7/2",
      "scratch-app#7/3",
    ]);
    expect(store.liveRunForTicket("scratch-app", 7)?.id).toBe(
      "scratch-app#7/3",
    );
    expect(third.run.seq).toBe(3);
  });

  it("keeps one ticket's chunks out of another's", () => {
    const store = newStore();
    store.register("scratch-app", 7);
    store.register("scratch-app", 8);

    expect(store.runsForTicket("scratch-app", 8).map((r) => r.id)).toEqual([
      "scratch-app#8/1",
    ]);
  });
});

describe("two chunks of one ticket", () => {
  it("hands back the live chunk rather than opening a second beside it", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");
    store.park(first.run.id, { waitingOn: "your review", kind: "runner" });

    const again = store.register("scratch-app", 7);

    expect(again.created).toBe(false);
    expect(again.run.id).toBe("scratch-app#7/1");
    expect(store.all()).toHaveLength(1);
    expect(store.occupyingRun("scratch-app")?.id).toBe("scratch-app#7/1");
  });

  it("queues a ticket's next chunk behind another ticket's work", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.complete(first.run.id);
    const other = store.register("scratch-app", 8);
    store.activate(other.run.id, "session-2");
    store.claimBranch(other.run.id, "timone/8-a-bug");

    const second = store.register("scratch-app", 7);

    expect(second.run.status).toBe("queued");
    expect(store.queue("scratch-app").map((r) => r.id)).toEqual([
      "scratch-app#7/2",
    ]);
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
    // Re-pointed when `picked-up → parked` became legal, so that a run
    // entering at a conversation stage can wait on a human without first
    // pretending a session is attached to it. The lifecycle must still refuse
    // *something*, and this is the neighbour that stayed illegal: a run still
    // queued behind another has not begun, so it cannot be waiting on anyone.
    const store = newStore();
    store.register("scratch-app", 7);
    const queued = store.register("scratch-app", 8);

    expect(queued.run.status).toBe("queued");
    expect(() => store.park(queued.run.id, { waitingOn: "the human" })).toThrow(
      /queued/,
    );
  });

  it("keeps a parked run holding its project once it owns a branch", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/7-reset-password");
    store.park(run.id, { waitingOn: "approval on the ticket", kind: "runner" });

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(store.register("scratch-app", 8).run.status).toBe("queued");
  });
});

describe("the holds-the-project rule", () => {
  /** A run parked at a stage that touches no repository. */
  function parkedBranchless(store: RunStore, ticket: number): string {
    const { run } = store.register("scratch-app", ticket);
    store.activate(run.id, `session-${ticket}`);
    store.park(run.id, { waitingOn: "an answer", kind: "runner" });
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
    expect(() => store.activate("scratch-app#7/1", "session-7b")).toThrow(
      /scratch-app#8/,
    );
  });

  it("frees the session slot when a branchless run parks", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");

    store.park(first.run.id, { waitingOn: "an answer", kind: "runner" });

    expect(store.get(second.run.id)?.status).toBe("picked-up");
  });

  it("does not promote the queue behind a run that parked holding a branch", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");

    store.park(first.run.id, { waitingOn: "approval", kind: "runner" });

    expect(store.get(second.run.id)?.status).toBe("queued");
    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
  });

  it("promotes the queue when a branch-holding run finally ends", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    const second = store.register("scratch-app", 8);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");
    store.park(first.run.id, { waitingOn: "approval", kind: "runner" });

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
    store.park(second.run.id, { waitingOn: "approval", kind: "runner" });

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

  it("records what a parked run is waiting for, and when the wait opened", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/7-reset-password");
    store.park(run.id, {
      waitingOn: "approval on the ticket",
      kind: "runner",
      stage: "requirements",
      waitCursor: "2026-08-03T10:00:00Z",
    });

    expect(store.get(run.id)).toMatchObject({
      wait: {
        on: "approval on the ticket",
        kind: "runner",
        opened: "2026-08-03T10:00:00Z",
      },
      stage: "requirements",
      branch: "timone/7-reset-password",
    });
  });

  it("clears what a run waits on once it resumes", () => {
    const store = newStore();
    const id = parkedBranchless(store, 7);
    store.activate(id, "session-1b");

    expect(store.get(id)?.wait?.on).toBeUndefined();
    expect(store.get(id)?.wait?.kind).toBeUndefined();
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
      kind: "runner",
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

  it("reads a ledger written before runs had chunk numbers", () => {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(PRE_CHUNK_LEDGER, path);

    const store = RunStore.open(path);

    // Every run in the fixture is one of these four, and each was the whole of
    // its ticket's work — so each is chunk 1 of its ticket.
    expect(store.all().map((run) => run.id)).toEqual([
      "scratch-app#4/1",
      "scratch-app#6/1",
      "scratch-app#10/1",
      "ivtrends#5/1",
    ]);
    expect(store.all().map((run) => run.seq)).toEqual([1, 1, 1, 1]);
    // Nothing else about the ledger moves.
    expect(store.occupyingRun("scratch-app")).toBeUndefined();
    expect(store.introducedAt("scratch-app", 5)).toBe(
      "2026-08-14T12:53:58.173Z",
    );
  });

  it("normalises a pre-chunk ledger once and not again", () => {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(PRE_CHUNK_LEDGER, path);

    const first = RunStore.open(path);
    // Persist the normalised shape, then read it back through the same path.
    first.recordIntroduction("scratch-app", 99);
    const reopened = RunStore.open(path);

    expect(reopened.all().map((run) => run.id)).toEqual(
      first.all().map((run) => run.id),
    );
    expect(reopened.all().map((run) => run.seq)).toEqual([1, 1, 1, 1]);
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

  it("persists the pull request and the wait on it across a reopen", () => {
    const path = statePath();
    const store = newStore(path);
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "runner",
      stage: "delivery",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    const reopened = RunStore.open(path).get(run.id);

    expect(reopened?.pr).toBe(9);
    expect(reopened?.wait?.kind).toBe("runner");
    expect(reopened?.wait?.on).toBe("your review of pull request #9");
    expect(reopened?.stage).toBe("delivery");
  });

  it("holds the project while parked on a review, and frees it on completion", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, { waitingOn: "your review", kind: "runner", stage: "delivery" });

    // A queued ticket stays queued behind the open pull request…
    const { run: queued } = store.register("scratch-app", 8);
    expect(queued.status).toBe("queued");

    // …and starts the moment the PR's merge completes the run (R10).
    store.complete(run.id);
    expect(store.get(queued.id)?.status).toBe("picked-up");
  });
});

describe("cancelling a run", () => {
  it("cancels a queued run, recording why", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    const { run } = store.register("scratch-app", 8);

    const cancelled = store.cancel(run.id, "its ticket is no longer open");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancellation).toBe("its ticket is no longer open");
    expect(store.get(run.id)?.status).toBe("cancelled");
  });

  it("cancels a run that was picked up but never started", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);

    expect(store.cancel(run.id, "its ticket is no longer open").status).toBe(
      "cancelled",
    );
  });

  it("cancels a run whose session is running", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");

    expect(store.cancel(run.id, "you asked me to stop").status).toBe(
      "cancelled",
    );
  });

  it("cancels a parked run, and it stops waiting on the human", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "your approval of the plan",
      kind: "runner",
      stage: "planning",
      waitCursor: "2026-08-02T10:00:00Z",
    });

    const cancelled = store.cancel(run.id, "you asked me to stop");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.wait?.on).toBeUndefined();
    expect(cancelled.wait?.kind).toBeUndefined();
  });

  it("refuses to cancel a run that is already finished", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.complete(run.id);

    expect(() => store.cancel(run.id, "you asked me to stop")).toThrow(
      /cannot go from done to cancelled/,
    );
  });

  it("has no way out of cancelled", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.cancel(run.id, "its ticket is no longer open");

    expect(() => store.cancel(run.id, "again")).toThrow(/nothing — it is finished/);
  });

  it("frees the project for whatever was queued behind it", () => {
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");
    const second = store.register("scratch-app", 8);
    expect(second.run.status).toBe("queued");

    store.cancel(first.run.id, "you asked me to stop");

    expect(store.get(second.run.id)?.status).toBe("picked-up");
    expect(store.occupyingRun("scratch-app")?.id).toBe(second.run.id);
  });

  it("lets its ticket take a fresh chunk, because an abandoned one is settled", () => {
    // ADR-0029's other half. A cancelled chunk that stayed unsettled would
    // hold its ticket for ever and nothing could ever be run on it again —
    // which is also what makes the poll loop's closed-ticket cancellation
    // self-healing: a ticket reopened and re-marked simply starts chunk 2.
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.cancel(first.run.id, "its ticket is no longer open and marked");

    const second = store.register("scratch-app", 7);

    expect(second.created).toBe(true);
    expect(second.run.id).toBe("scratch-app#7/2");
    expect(second.run.status).toBe("picked-up");
    expect(store.liveRunForTicket("scratch-app", 7)?.id).toBe("scratch-app#7/2");
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
      "scratch-app#7/1",
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
      "scratch-app#7/1",
    ]);
  });

  it("leaves a parked run alone however long it waits", () => {
    // A park is a human wait, and humans take weeks. Reclaiming one would
    // fail a run because nobody had answered yet.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.park(run.id, { waitingOn: "your answer on the ticket", kind: "runner" });

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
    store.cancel(second.id, "you asked me to stop");

    set("2026-09-01T10:00:00Z");

    expect(store.staleRuns(FOUR_INTERVALS)).toEqual([]);
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
    // What the cycle does with a stale run: give it back to the runner.
    store.park(first[0].id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
    });

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

  it("shows another process's claim to a guard that has itself written nothing", () => {
    // A guard answering from memory is blind to exactly the write it exists
    // to notice (ADR-0023, fault 3) — and a guard that has mutated nothing
    // has nothing that would have refreshed its memory as a side effect.
    const path = statePath();
    const daemon = newStore(path);
    const { run } = daemon.register("scratch-app", 7);
    daemon.activate(run.id, "session-abc");
    daemon.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "runner",
      stage: "triage",
    });

    const rival = newStore(path);
    expect(rival.occupyingRun("scratch-app")).toBeUndefined();

    daemon.claim(run.id);

    expect(rival.occupyingRun("scratch-app")?.id).toBe(run.id);
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

  it("still reclaims a run whose newer heartbeat has gone quiet", () => {
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-one");

    set("2026-08-07T14:00:00Z");
    store.heartbeat(run.id);
    set("2026-08-07T14:09:00Z");

    expect(store.staleRuns(FOUR_INTERVALS).map((r) => r.id)).toEqual([
      "scratch-app#7/1",
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

describe("previews", () => {
  it("records a preview against the commit it was reconciled for", () => {
    const store = newStore();

    const previous = store.recordPreview(
      "scratch-app",
      9,
      { state: "ready", url: "http://localhost:54321/" },
      "abc1234",
    );

    expect(previous).toBeUndefined();
    expect(store.previewRecord("scratch-app", 9)).toEqual({
      project: "scratch-app",
      pr: 9,
      headSha: "abc1234",
      state: "ready",
      url: "http://localhost:54321/",
      reason: undefined,
      updatedAt: "2026-08-02T10:00:00Z",
    });
  });

  it("hands back what it replaced, so a caller can tell whether anything moved", () => {
    const store = newStore();
    store.recordPreview(
      "scratch-app",
      9,
      { state: "ready", url: "http://localhost:54321/" },
      "abc1234",
    );

    const previous = store.recordPreview(
      "scratch-app",
      9,
      { state: "ready", url: "http://localhost:49713/" },
      "def5678",
    );

    expect(previous).toMatchObject({
      headSha: "abc1234",
      url: "http://localhost:54321/",
    });
  });

  it("keeps previews of one project out of another's", () => {
    const store = newStore();
    store.recordPreview("scratch-app", 9, { state: "ready" }, "abc1234");
    store.recordPreview("other-app", 9, { state: "failed" }, "def5678");

    expect(store.previewsFor("scratch-app")).toHaveLength(1);
    expect(store.previewsFor("scratch-app")[0].pr).toBe(9);
    expect(store.previewsFor("other-app")[0].state).toBe("failed");
  });

  it("forgets a preview, and forgetting one that is already gone is a no-op", () => {
    const store = newStore();
    store.recordPreview("scratch-app", 9, { state: "ready" }, "abc1234");

    store.forgetPreview("scratch-app", 9);
    store.forgetPreview("scratch-app", 9);

    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();
    expect(store.previewsFor("scratch-app")).toEqual([]);
  });

  it("survives a preview record outliving the run that opened it", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.recordPreview("scratch-app", 9, { state: "ready" }, "abc1234");
    store.activate(run.id, "session-1");
    store.complete(run.id);

    // The pull request keeps living after its run reaches a terminal state,
    // which is why the record is top-level rather than a field on the run.
    expect(store.previewRecord("scratch-app", 9)?.state).toBe("ready");
  });

  it("loads a state file written before previews existed, at version 1", () => {
    const path = statePath();
    const store = newStore(path);
    store.register("scratch-app", 7);

    const written = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    expect(written.version).toBe(1);
    expect(written).not.toHaveProperty("previews");

    // Re-open it, exactly as a daemon started later would.
    const reopened = newStore(path);
    expect(reopened.all()).toHaveLength(1);
    expect(reopened.previewsFor("scratch-app")).toEqual([]);

    reopened.recordPreview("scratch-app", 9, { state: "ready" }, "abc1234");
    expect(
      (JSON.parse(readFileSync(path, "utf8")) as { version: number }).version,
    ).toBe(1);
  });
});

describe("introductions", () => {
  // The record is what makes the introduction happen once rather than every
  // cycle for the life of the daemon — `releasePreview`'s precedent, and for
  // the same reason: an unmarked ticket stays unmarked for ever, so anything
  // keyed on its state alone would generate work on every poll (ADR-0024).

  it("has no record of a ticket it has never introduced itself on", () => {
    const store = newStore();
    expect(store.introducedAt("scratch-app", 5)).toBeUndefined();
  });

  it("records when it introduced itself, and says so afterwards", () => {
    const store = newStore();

    store.recordIntroduction("scratch-app", 5);

    expect(store.introducedAt("scratch-app", 5)).toBe("2026-08-02T10:00:00Z");
  });

  it("keeps the first introduction's instant when asked to record a second", () => {
    // Recording twice is a bug upstream, and the honest answer to "when did
    // you introduce yourself?" is still the first time. Overwriting would make
    // the record report the most recent duplicate as if it were the original.
    const store = newStore();

    store.recordIntroduction("scratch-app", 5);
    store.recordIntroduction("scratch-app", 5);

    expect(store.introducedAt("scratch-app", 5)).toBe("2026-08-02T10:00:00Z");
  });

  it("keeps one project's introductions out of another's, and one ticket's out of another's", () => {
    const store = newStore();
    store.recordIntroduction("scratch-app", 5);

    expect(store.introducedAt("other-app", 5)).toBeUndefined();
    expect(store.introducedAt("scratch-app", 6)).toBeUndefined();
  });

  it("survives the daemon restarting, which is the whole point of writing it down", () => {
    const path = statePath();
    newStore(path).recordIntroduction("scratch-app", 5);

    expect(newStore(path).introducedAt("scratch-app", 5)).toBe(
      "2026-08-02T10:00:00Z",
    );
  });

  it("loads a state file written before introductions existed, at version 1", () => {
    const path = statePath();
    const store = newStore(path);
    store.register("scratch-app", 7);

    const written = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    expect(written.version).toBe(1);
    expect(written).not.toHaveProperty("introductions");

    const reopened = newStore(path);
    expect(reopened.introducedAt("scratch-app", 7)).toBeUndefined();
    reopened.recordIntroduction("scratch-app", 7);
    expect(
      (JSON.parse(readFileSync(path, "utf8")) as { version: number }).version,
    ).toBe(1);
  });
});

describe("the witness — the time a daemon can vouch for having watched", () => {
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

  /** The daemon's default cadences, in the units the store takes them in. */
  const POLL_INTERVAL = 60 * 1000;
  const UNWITNESSED_AFTER = 2 * POLL_INTERVAL;
  const FOUR_INTERVALS = 4 * 30 * 1000;

  /** One poll cycle's worth of witnessing, at the default cadences. */
  function observe(store: RunStore): ReturnType<RunStore["witness"]> {
    return store.witness({
      unwitnessedAfterMs: UNWITNESSED_AFTER,
      staleAfterMs: FOUR_INTERVALS,
    });
  }

  it("lets the daemon judge once it has watched a full staleness window", () => {
    // Asserted first, and deliberately: a fix that simply stopped reclaiming
    // would pass every test below it and destroy R18 outright. The daemon
    // present throughout must end up entitled to judge.
    const { store, set } = clockedStore();

    observe(store);
    set("2026-08-06T10:01:00Z");
    observe(store);
    set("2026-08-06T10:02:00Z");

    expect(observe(store).mayJudge).toBe(true);
  });

  it("does not read its own slow cycle as time it was not running", () => {
    // timone#49. The gap between two cycle *starts* includes the first
    // cycle's own work, so a cycle whose body took longer than the
    // unwitnessed window used to be arithmetically identical to a daemon
    // that was switched off — and the log said, about itself, "the daemon
    // was not running for 3m". Phase 30 makes that more likely, not less:
    // 30b and 30c put more forge calls in every cycle.
    const { store, set } = clockedStore();

    observe(store);
    // The cycle runs for three minutes — longer than the two-minute
    // unwitnessed window — and then says so.
    set("2026-08-06T10:03:00Z");
    store.cycleEnded();
    // The next cycle starts a normal interval later.
    set("2026-08-06T10:04:00Z");

    const witness = observe(store);
    expect(witness.unwitnessedGap).toBe(false);
    expect(witness.observingSince).toBe("2026-08-06T10:00:00Z");
  });

  it("still sees a daemon that was actually switched off", () => {
    // The other half, and the one that must not be broken by the fix above:
    // an idle gap between the end of one cycle and the start of the next is
    // real absence, and reclaiming on it would be reclaiming a run nobody
    // watched.
    const { store, set } = clockedStore();

    observe(store);
    set("2026-08-06T10:00:05Z");
    store.cycleEnded();
    // Nothing for five minutes: the process was not there.
    set("2026-08-06T10:05:00Z");

    expect(observe(store).unwitnessedGap).toBe(true);
  });

  it("measures the idle gap, not the whole time since the last cycle began", () => {
    const { store, set } = clockedStore();

    observe(store);
    set("2026-08-06T10:03:00Z");
    store.cycleEnded();
    set("2026-08-06T10:04:00Z");

    // One minute idle, not four.
    expect(observe(store).gapMs).toBe(60 * 1000);
  });

  it("falls back to the cycle's start when no cycle has said it ended", () => {
    // A state file written by a daemon predating `cycleEnded` — and the first
    // cycle of every daemon, which has not ended yet. Conservative in the
    // only safe direction: it grants the window rather than reclaiming.
    const { store, set } = clockedStore();

    observe(store);
    set("2026-08-06T10:05:00Z");

    expect(observe(store).unwitnessedGap).toBe(true);
  });

  it("refuses judgement on the first cycle a daemon has ever run", () => {
    // No `observedAt` is not "nothing happened" — it is "nobody was
    // listening", which is exactly the case for granting the window.
    const { store } = clockedStore();

    expect(observe(store).mayJudge).toBe(false);
  });

  it("refuses judgement after a gap longer than twice the poll interval", () => {
    const { store, set } = clockedStore();
    observe(store);
    set("2026-08-06T10:01:00Z");
    observe(store);
    set("2026-08-06T10:02:00Z");
    expect(observe(store).mayJudge).toBe(true);

    // The laptop sleeps for sixteen minutes — 15a's median, near enough.
    set("2026-08-06T10:18:00Z");
    const woken = observe(store);

    expect(woken.mayJudge).toBe(false);
    expect(woken.observingSince).toBe("2026-08-06T10:18:00Z");
    expect(woken.gapMs).toBe(16 * 60 * 1000);
  });

  it("is delayed, not disabled: judgement returns a window after the gap", () => {
    const { store, set } = clockedStore();
    observe(store);
    set("2026-08-06T10:18:00Z");
    expect(observe(store).mayJudge).toBe(false);

    set("2026-08-06T10:19:00Z");
    expect(observe(store).mayJudge).toBe(false);
    set("2026-08-06T10:20:00Z");

    expect(observe(store).mayJudge).toBe(true);
  });

  it("carries the watch forward across normal cycles rather than restarting it", () => {
    const { store, set } = clockedStore();

    observe(store);
    set("2026-08-06T10:01:00Z");
    const second = observe(store);
    set("2026-08-06T10:02:00Z");
    const third = observe(store);

    expect(second.observingSince).toBe("2026-08-06T10:00:00Z");
    expect(third.observingSince).toBe("2026-08-06T10:00:00Z");
  });

  it("treats one missed cycle as jitter and two as an absence", () => {
    const { store, set } = clockedStore();
    observe(store);

    // Twice the interval exactly is still within the watch: the boundary
    // belongs to jitter, because the cost of getting it wrong the other way
    // is a live agent's work.
    set("2026-08-06T10:02:00Z");
    expect(observe(store).observingSince).toBe("2026-08-06T10:00:00Z");

    set("2026-08-06T10:04:01Z");
    expect(observe(store).observingSince).toBe("2026-08-06T10:04:01Z");
  });

  it("stamps a run's heartbeat nowhere: the window is granted, not forged", () => {
    // `heartbeatAt` is evidence, and rewriting it on wake would record a
    // heartbeat that never happened. The whole ADR turns on the distinction.
    const { store, set } = clockedStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.heartbeat(run.id);

    set("2026-08-06T10:18:00Z");
    observe(store);

    expect(store.get(run.id)?.heartbeatAt).toBe("2026-08-06T10:00:00Z");
    expect(store.staleRuns(FOUR_INTERVALS).map((r) => r.id)).toEqual([
      "scratch-app#7/1",
    ]);
  });

  it("persists the witness, because every cycle is its own process under --once", () => {
    const path = statePath();
    const { store, set } = clockedStore(path);
    observe(store);
    set("2026-08-06T10:01:00Z");
    observe(store);

    const written = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    expect(written.observedAt).toBe("2026-08-06T10:01:00Z");
    expect(written.observingSince).toBe("2026-08-06T10:00:00Z");
    expect(written.version).toBe(1);

    // A second process one cycle later inherits the watch rather than
    // starting a new one — which is the whole reason this is on disk.
    const next = RunStore.open(path, { now: () => "2026-08-06T10:02:00Z" });
    expect(
      next.witness({
        unwitnessedAfterMs: UNWITNESSED_AFTER,
        staleAfterMs: FOUR_INTERVALS,
      }).mayJudge,
    ).toBe(true);
  });

  it("loads a state file written before the witness existed, at version 1", () => {
    const path = statePath();
    const seed = newStore(path);
    seed.register("scratch-app", 7);

    const written = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      unknown
    >;
    expect(written).not.toHaveProperty("observedAt");
    expect(written).not.toHaveProperty("observingSince");

    const reopened = RunStore.open(path, { now: () => "2026-08-06T10:00:00Z" });
    expect(reopened.all()).toHaveLength(1);
    expect(observe(reopened).mayJudge).toBe(false);
    expect(
      (JSON.parse(readFileSync(path, "utf8")) as { version: number }).version,
    ).toBe(1);
  });
});

/**
 * 29d — the picture `timone status` renders from.
 *
 * `timone status` answers instantly, and it does that by reading a picture the
 * daemon wrote rather than asking GitHub while the human waits (ADR-0044 D5).
 * The daemon takes it as a side effect of the eligibility query it already
 * makes, so no extra call is added anywhere.
 */
describe("the cached picture of an initiative", () => {
  const picture = {
    project: "scratch-app",
    initiative: 7,
    title: "the lists could be smarter",
    steps: [51, 52, 53],
    done: 1,
    next: 52,
  };

  it("remembers what the last cycle saw", () => {
    const store = newStore();

    store.rememberInitiative(picture);

    expect(store.initiativeFor("scratch-app", 52)).toMatchObject({
      initiative: 7,
      steps: [51, 52, 53],
      done: 1,
      next: 52,
    });
  });

  /** Any of its steps finds it, not only the live one. */
  it("is found from any of its steps", () => {
    const store = newStore();

    store.rememberInitiative(picture);

    for (const step of [51, 52, 53]) {
      expect(store.initiativeFor("scratch-app", step)?.initiative).toBe(7);
    }
  });

  it("knows nothing about a step of no initiative it has seen", () => {
    const store = newStore();

    store.rememberInitiative(picture);

    expect(store.initiativeFor("scratch-app", 99)).toBeUndefined();
    expect(store.initiativeFor("ivtrends", 52)).toBeUndefined();
  });

  /**
   * The picture is a *snapshot*, so a later cycle replaces it whole. A merge
   * that closed a step must not leave the old count sitting beside the new
   * one, which is what merging the records rather than replacing them would
   * do.
   */
  it("is replaced whole by the next cycle, never merged", () => {
    const store = newStore();
    store.rememberInitiative(picture);

    store.rememberInitiative({ ...picture, steps: [51, 52], done: 2, next: undefined });

    expect(store.initiativeFor("scratch-app", 51)).toMatchObject({
      steps: [51, 52],
      done: 2,
    });
    expect(store.initiativeFor("scratch-app", 51)?.next).toBeUndefined();
    expect(store.initiativeFor("scratch-app", 53)).toBeUndefined();
  });

  it("survives a reload, because another process is what reads it", () => {
    const path = statePath();
    newStore(path).rememberInitiative(picture);

    expect(newStore(path).initiativeFor("scratch-app", 52)?.initiative).toBe(7);
  });

  /** Every field added since the ledger was written leaves `version` at 1. */
  it("leaves a ledger written before it existed loading unchanged", () => {
    const path = statePath();
    const store = newStore(path);
    store.register("scratch-app", 7);

    expect(() => newStore(path).runsForTicket("scratch-app", 7)).not.toThrow();
  });
});

describe("an initiative's picture is found from the map as well", () => {
  /**
   * The map ticket is the thread the human reads, so its standing note is the
   * one that most needs to say how far the work has got. It is not one of its
   * own children, so a lookup that matched only the steps left the map the
   * one ticket in the system with nothing to report.
   */
  it("is found from the initiative's own number", () => {
    const store = newStore();
    store.rememberInitiative({
      project: "scratch-app",
      initiative: 7,
      title: "the lists could be smarter",
      steps: [51, 52],
      done: 0,
      next: 51,
    });

    expect(store.initiativeFor("scratch-app", 7)?.initiative).toBe(7);
  });
});

describe("who is holding a run", () => {
  /**
   * A store whose idea of the process table the test writes
   * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
   * D2, extending ADR-0025). Injected for the reason `lock.test.ts` gives:
   * a test cannot portably manufacture a dead pid.
   */
  function storeWatching(alive: readonly number[]): RunStore {
    let tick = 0;
    return RunStore.open(statePath(), {
      now: () => `2026-09-04T10:${String(tick++).padStart(2, "0")}:00Z`,
      livenessOf: (holder) => (alive.includes(holder.pid) ? "alive" : "gone"),
    });
  }

  /** A holder as a command or a daemon records one. */
  function holderOf(command: string, pid: number): Holder {
    return {
      token: `token-${pid}`,
      command,
      pid,
      since: "2026-09-04T10:00:00Z",
      observedAt: "2026-09-04T10:00:00Z",
      host: "fvermaut-mac",
    };
  }

  it("writes the holder a claim is given", () => {
    // timone#78 in one line: today `claim` writes `active` and nothing about
    // who asked, so nothing can tell a claim somebody is holding from one
    // nobody is.
    const store = storeWatching([4213]);
    const { run } = store.register("scratch-app", 7);

    const claimed = store.claim(run.id, holderOf("timone takeover scratch-app#7", 4213));

    expect(claimed.holder?.command).toBe("timone takeover scratch-app#7");
    expect(claimed.holder?.pid).toBe(4213);
    expect(store.hold(claimed)).toBe("alive");
  });

  it("refuses a second claim while the first holder is still running, naming it", () => {
    const store = storeWatching([4213]);
    const { run } = store.register("scratch-app", 7);
    store.claim(run.id, holderOf("timone takeover scratch-app#7", 4213));

    expect(() =>
      store.claim(run.id, holderOf("timone takeover scratch-app#7", 9000)),
    ).toThrow(/timone takeover scratch-app#7.*4213/);
  });

  it("lets a claim through when the holder's process is gone", () => {
    // The case that ends timone#78's two-minute refusal. A suite with the
    // refusal above alone passes against code that never asks about liveness
    // at all, so this is the one that makes the question load-bearing.
    const store = storeWatching([]);
    const { run } = store.register("scratch-app", 7);
    store.claim(run.id, holderOf("timone takeover scratch-app#7", 4213));

    const second = store.claim(run.id, holderOf("timone takeover scratch-app#7", 9000));

    expect(second.holder?.pid).toBe(9000);
    expect(store.hold(second)).toBe("gone");
  });

  it("replaces a claim's holder with the session's when the run activates", () => {
    const store = storeWatching([4213, 5000]);
    const { run } = store.register("scratch-app", 7);
    store.claim(run.id, holderOf("timone takeover scratch-app#7", 4213));

    const active = store.activate(run.id, "session-1", holderOf("timone daemon", 5000));

    expect(active.holder?.command).toBe("timone daemon");
    expect(active.holder?.pid).toBe(5000);
  });

  it("clears the holder when the run parks", () => {
    // A parked run is waiting on a person and nobody is holding it. A holder
    // left behind is dead data that looks live, and the next claim would be
    // refused by a process that stopped caring.
    const store = storeWatching([4213]);
    const { run } = store.register("scratch-app", 7);
    store.claim(run.id, holderOf("timone daemon", 4213));

    const parked = store.park(run.id, { waitingOn: "an answer on the ticket" });

    expect(parked.holder).toBeUndefined();
    expect(store.hold(parked)).toBe("none");
  });

  it("treats a run written before holders existed as held by nobody", () => {
    const store = storeWatching([]);
    const { run } = store.register("scratch-app", 7);

    expect(store.hold(run)).toBe("none");
    expect(() => store.claim(run.id, holderOf("timone daemon", 4213))).not.toThrow();
  });
});

describe("the wait as one value", () => {

  it("folds a real pre-collapse ledger into the new shape", () => {
    // The ledger the daemon was running on 2026-08-14, copied unchanged.
    // Real rather than invented, because what is under test is whether *this*
    // file still loads.
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(PRE_CHUNK_LEDGER, path);

    const store = RunStore.open(path);

    // A parked run keeps its words, gains a wait it never had a field for,
    // and is told which stage could end it — the answer `applyPark` would
    // write for it today (ADR-0049 D5). ✏ Since 2026-09-30 its wait is also
    // the runner's, because no stage waits on its own any more (timone#166).
    expect(store.get("scratch-app#4/1")?.wait).toEqual({
      on: "the next stage to be built",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    // And a run the old daemon finished keeps nothing: `complete` cleared
    // `waitingOn` alone and left a kind and a cursor behind for a wait nothing
    // was waiting on. Both done runs in this file are in that state.
    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(store.get("scratch-app#6/1")?.wait).toBeUndefined();
  });

  it("keeps an absent wait absent, which is its own state", () => {
    // Finding (b) of the phase's pre-flight. A parked run with a wait of no
    // kind is not the same thing as a wait nothing can answer.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "the next stage to be built" });

    const parked = store.get(run.id);
    expect(parked?.wait?.on).toBe("the next stage to be built");
    expect(parked?.wait?.kind).toBeUndefined();
  });

  it("moves a wait with repark, without the double-park refusal firing", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "an answer", kind: "runner" });

    const moved = store.repark(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "runner",
    });

    expect(moved.wait).toEqual({
      on: "your review of pull request #9",
      kind: "runner",
    });
    // And parking it again is still refused, which is what `repark` exists to
    // let through without.
    expect(() =>
      store.park(run.id, { waitingOn: "something else" }),
    ).toThrow(/parked/);
  });
});

describe("a wait that says what can end it", () => {
  it("refuses a wait no stage can end", () => {
    // ADR-0049 D6. A wait nothing can resolve leaves the ticket asking a
    // person for something for ever, so it is made unwritable rather than
    // detectable.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");

    expect(() =>
      store.park(run.id, {
        waitingOn: "something nobody can give me",
        kind: "runner",
        stage: "execution",
        resolvableBy: [],
      }),
    ).toThrow(/no stage can end/);
  });

  it("accepts a park with no wait at all, which is a different thing", () => {
    // Finding (b) of the phase's pre-flight, guarded. An absent wait means a
    // run stopped because a stage's machinery does not exist, and a slice that
    // conflated it with an empty `resolvableBy` would take out every unbuilt
    // stage's park.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");

    const parked = store.park(run.id, {
      waitingOn: "the next stage to be built",
      stage: "triage",
    });

    expect(parked.wait?.kind).toBeUndefined();
    expect(parked.wait?.resolvableBy).toEqual(["triage"]);
  });
});

describe("what the daemon's own process is running", () => {
  /** A store whose idea of the process table the test writes (ADR-0025). */
  function storeWatching(alive: readonly number[]): RunStore {
    return RunStore.open(statePath(), {
      now: () => "2026-09-04T10:00:00Z",
      livenessOf: (holder) => (alive.includes(holder.pid) ? "alive" : "gone"),
    });
  }

  function holderOf(pid: number): Holder {
    return {
      token: `token-${pid}`,
      command: "timone daemon",
      pid,
      since: "2026-09-04T10:00:00Z",
      observedAt: "2026-09-04T10:00:00Z",
      host: "fvermaut-mac",
    };
  }

  it("gives back the commit and the tip a live daemon wrote down", () => {
    const store = storeWatching([900]);
    store.recordDaemon({ commit: "abc1234", tip: "def5678", holder: holderOf(900) });
    expect(store.daemonVersion()).toMatchObject({
      commit: "abc1234",
      tip: "def5678",
    });
  });

  it("answers nothing once the daemon that wrote it has stopped", () => {
    // Nobody is running old code when there is no daemon, and asking a reader
    // to restart something that is not running is worse than saying nothing.
    const store = storeWatching([]);
    store.recordDaemon({ commit: "abc1234", tip: "def5678", holder: holderOf(900) });
    expect(store.daemonVersion()).toBeUndefined();
  });

  it("keeps a record whose machine it cannot look at", () => {
    // `unknown` is not a shy `gone` (ADR-0025): a pid table here says nothing
    // about a pid over there.
    const store = RunStore.open(statePath(), { livenessOf: () => "unknown" });
    store.recordDaemon({ commit: "abc1234", tip: "def5678", holder: holderOf(900) });
    expect(store.daemonVersion()?.commit).toBe("abc1234");
  });

  it("replaces the whole answer each cycle rather than merging it", () => {
    // A stale tip beside a fresh commit is a state that never existed.
    const store = storeWatching([900]);
    store.recordDaemon({ commit: "abc1234", tip: "def5678", holder: holderOf(900) });
    store.recordDaemon({ commit: "abc1234", holder: holderOf(900) });
    expect(store.daemonVersion()?.tip).toBeUndefined();
  });

  it("says nothing at all before any daemon has run", () => {
    expect(RunStore.open(statePath()).daemonVersion()).toBeUndefined();
  });
});

/**
 * A ledger typed for phase 41's slice 41c, in the shape the real one had on
 * 2026-09-30, the day the old code between steps was removed. Machine-typed,
 * not copied: the real ledger belongs to the daemon running from this folder.
 *
 * It holds a failed run on a branch (scratch-app #21) and one without
 * (ivtrends #88); a parked run of each old kind of wait — a gate (#90), a
 * conversation (#91), a review on a branch (scratch-app #24), an escalation
 * (#92) and none (#93); a run already waiting for the runner (#94); and done
 * and cancelled runs on both projects.
 */
const LEDGER_BEFORE_166 = fileURLToPath(
  new URL("./fixtures/ledger-before-166.json", import.meta.url),
);

/** One run of that ledger, exactly as the file has it. */
function before166(id: string): Run {
  const file = JSON.parse(readFileSync(LEDGER_BEFORE_166, "utf8")) as { runs: Run[] };
  const run = file.runs.find((candidate) => candidate.id === id);
  if (run === undefined) throw new Error(`the fixture has no run ${id}`);
  return run;
}

/**
 * One run of that ledger as the store reads it since 41h: without the four
 * fields nothing writes any more — `failure`, `consumedAnswerAt`,
 * `reAsksAfterAnswer`, and the wait's `acknowledgedAt`. Written out here, not
 * taken from `runs.ts`, so the test does not restate the code it checks.
 */
function before166Read(id: string): Run {
  const {
    failure: _failure,
    consumedAnswerAt: _consumed,
    reAsksAfterAnswer: _reAsks,
    ...run
  } = before166(id) as Run & {
    failure?: string;
    consumedAnswerAt?: string;
    reAsksAfterAnswer?: number;
  };
  if (run.wait === undefined) return run;
  const { acknowledgedAt: _acknowledged, ...wait } = run.wait as Run["wait"] & {
    acknowledgedAt?: string;
  };
  return { ...run, wait };
}

/** A copy of that ledger in a throwaway directory, so no test opens the fixture itself. */
function copyOfLedgerBefore166(): string {
  const path = statePath();
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(LEDGER_BEFORE_166, path);
  return path;
}

describe("runs the old code left in the ledger become runs the runner can read", () => {
  it("loads each failed run as cancelled, keeping what stopped it, and leaves done and cancelled runs as they were", () => {
    const store = RunStore.open(copyOfLedgerBefore166());

    // One on a branch and one without. Nothing else about either run moves.
    expect(store.get("scratch-app#21/1")).toEqual({
      ...before166Read("scratch-app#21/1"),
      status: "cancelled",
      cancellation:
        "stopped before the old code was removed: " +
        "the execution stage finished without committing anything to gate",
    });
    expect(store.get("ivtrends#88/1")).toEqual({
      ...before166Read("ivtrends#88/1"),
      status: "cancelled",
      cancellation:
        "stopped before the old code was removed: triage recorded no classification",
    });
    for (const id of ["scratch-app#12/1", "scratch-app#15/1", "ivtrends#60/1", "ivtrends#61/1"]) {
      expect(store.get(id)).toEqual(before166(id));
    }
  });

  it("loads each old kind of wait as the runner's, keeping what it waits on and when it opened", () => {
    const store = RunStore.open(copyOfLedgerBefore166());

    // A gate, a conversation, a review, an escalation, and a wait of no kind.
    for (const id of [
      "ivtrends#90/1",
      "ivtrends#91/1",
      "scratch-app#24/1",
      "ivtrends#92/1",
      "ivtrends#93/1",
    ]) {
      const was = before166Read(id);
      expect(store.get(id)).toEqual({ ...was, wait: { ...was.wait, kind: "runner" } });
    }
    // Spelled out for two, so the test does not only restate the fixture.
    expect(store.get("ivtrends#90/1")?.wait).toEqual({
      on: "your approval of the requirements I wrote down",
      kind: "runner",
      opened: "2026-09-25T09:12:44Z",
      resolvableBy: ["requirements"],
    });
    expect(store.get("ivtrends#93/1")?.wait).toEqual({
      on: "the next stage to be built",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    // A run that already waited for the runner is left as it was.
    expect(store.get("ivtrends#94/1")).toEqual(before166("ivtrends#94/1"));
  });

  it("gives the same converted runs on a second load, and leaves the file as it was", () => {
    const path = copyOfLedgerBefore166();
    const bytes = readFileSync(path, "utf8");

    // Every one of these reads the file again. None of them may write it.
    const first = RunStore.open(path);
    first.occupyingRun("scratch-app");
    first.runsForTicket("ivtrends", 88);
    first.liveRunForTicket("ivtrends", 90);
    const second = RunStore.open(path);

    expect(second.get("scratch-app#21/1")?.status).toBe("cancelled");
    expect(second.get("ivtrends#90/1")?.wait?.kind).toBe("runner");
    expect(second.all()).toEqual(first.all());
    expect(readFileSync(path, "utf8")).toBe(bytes);

    // Once something writes the ledger, the converted runs reach the file.
    // Read back, they are the same runs again, and converted only once.
    first.recordIntroduction("scratch-app", 99);
    expect(RunStore.open(path).all()).toEqual(second.all());
  });

  it("keeps a converted run on a branch holding its project, and one without a branch not", () => {
    const store = RunStore.open(copyOfLedgerBefore166());

    // scratch-app #24 waited on a review, on its branch. It still holds the
    // project, now as a run waiting for the runner.
    const holder = store.occupyingRun("scratch-app");
    expect(holder?.id).toBe("scratch-app#24/1");
    expect(holder?.wait?.kind).toBe("runner");
    // No converted run of ivtrends owns a branch, so nothing holds it, and a
    // new ticket there is picked up rather than queued.
    expect(store.occupyingRun("ivtrends")).toBeUndefined();
    expect(store.register("ivtrends", 99).run.status).toBe("picked-up");
  });
});

describe("fields only the old code wrote are dropped when the ledger is read (41h)", () => {
  /** A done run, a parked run and a cancelled run, as the old code left them. */
  const written = {
    version: 1,
    runs: [
      {
        id: "scratch-app#30/1",
        project: "scratch-app",
        ticket: 30,
        seq: 1,
        status: "done",
        stage: "delivery",
        branch: "timone/30-export-to-csv",
        pr: 41,
        deaths: ["the machine running it stopped"],
        carried: [
          {
            stage: "execution",
            at: "2026-09-20T10:00:00Z",
            words: "Should the export include archived tasks?",
          },
        ],
        flags: [],
        createdAt: "2026-09-19T09:00:00Z",
        updatedAt: "2026-09-21T16:00:00Z",
      },
      {
        id: "ivtrends#96/1",
        project: "ivtrends",
        ticket: 96,
        seq: 1,
        status: "parked",
        stage: "triage",
        wait: {
          on: "the next thing that happens on this ticket",
          kind: "runner",
          opened: "2026-09-29T14:00:00Z",
          resolvableBy: ["triage"],
          acknowledgedAt: "2026-09-29T14:02:00Z",
        },
        reAsksAfterAnswer: 1,
        askCheck: {
          for: "**What I need from you:** say which page is slow.",
          question: "Which page is slow?",
          askedAt: "2026-09-29T14:05:00Z",
        },
        refusal: {
          reason: "the box could not start",
          count: 3,
          since: "2026-09-29T14:10:00Z",
          told: true,
        },
        flags: [],
        createdAt: "2026-09-29T13:58:00Z",
        updatedAt: "2026-09-29T14:00:00Z",
      },
      {
        id: "ivtrends#97/1",
        project: "ivtrends",
        ticket: 97,
        seq: 1,
        status: "cancelled",
        stage: "planning",
        cancellation: "fvermaut: not needed any more",
        failure: "the planning stage recorded no outcome",
        consumedAnswerAt: "2026-09-27T09:00:00Z",
        deaths: ["the machine running it stopped", "the box could not reach the model"],
        refusal: { reason: "the box could not start", count: 1, since: "2026-09-28T08:00:00Z" },
        flags: [],
        createdAt: "2026-09-27T08:00:00Z",
        updatedAt: "2026-09-28T09:00:00Z",
      },
    ],
  };

  it("loads a ledger carrying each of them, and gives runs that carry none of them", () => {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(written, null, 2)}\n`);
    const bytes = readFileSync(path, "utf8");

    const store = RunStore.open(path);

    expect(store.get("scratch-app#30/1")).toEqual({
      id: "scratch-app#30/1",
      project: "scratch-app",
      ticket: 30,
      seq: 1,
      status: "done",
      stage: "delivery",
      branch: "timone/30-export-to-csv",
      pr: 41,
      flags: [],
      createdAt: "2026-09-19T09:00:00Z",
      updatedAt: "2026-09-21T16:00:00Z",
    });
    expect(store.get("ivtrends#96/1")).toEqual({
      id: "ivtrends#96/1",
      project: "ivtrends",
      ticket: 96,
      seq: 1,
      status: "parked",
      stage: "triage",
      wait: {
        on: "the next thing that happens on this ticket",
        kind: "runner",
        opened: "2026-09-29T14:00:00Z",
        resolvableBy: ["triage"],
      },
      flags: [],
      createdAt: "2026-09-29T13:58:00Z",
      updatedAt: "2026-09-29T14:00:00Z",
    });
    expect(store.get("ivtrends#97/1")).toEqual({
      id: "ivtrends#97/1",
      project: "ivtrends",
      ticket: 97,
      seq: 1,
      status: "cancelled",
      stage: "planning",
      cancellation: "fvermaut: not needed any more",
      flags: [],
      createdAt: "2026-09-27T08:00:00Z",
      updatedAt: "2026-09-28T09:00:00Z",
    });
    // A read writes nothing. The runs reach the file without the fields the
    // next time something writes it.
    expect(readFileSync(path, "utf8")).toBe(bytes);
    store.recordIntroduction("ivtrends", 99);
    for (const run of JSON.parse(readFileSync(path, "utf8")).runs as { wait?: object }[]) {
      for (const field of [
        "askCheck",
        "deaths",
        "refusal",
        "carried",
        "failure",
        "consumedAnswerAt",
        "reAsksAfterAnswer",
      ]) {
        expect(run).not.toHaveProperty(field);
      }
      expect(run.wait ?? {}).not.toHaveProperty("acknowledgedAt");
    }
  });

  it("reads an old kind of wait on a run that is not parked as the runner's, and still loads", () => {
    // A run claimed for a session keeps the wait it was parked on until the
    // session starts. The old code could leave one claimed on a gate.
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        runs: [
          {
            id: "scratch-app#31/1",
            project: "scratch-app",
            ticket: 31,
            seq: 1,
            status: "active",
            stage: "requirements",
            wait: {
              on: "your approval of the requirements I wrote down",
              kind: "gate",
              opened: "2026-09-29T10:00:00Z",
              resolvableBy: ["requirements"],
            },
            branch: "timone/31-a-calendar-view",
            flags: [],
            createdAt: "2026-09-28T10:00:00Z",
            updatedAt: "2026-09-29T11:00:00Z",
          },
        ],
      }),
    );

    const store = RunStore.open(path);

    expect(store.get("scratch-app#31/1")?.wait).toEqual({
      on: "your approval of the requirements I wrote down",
      kind: "runner",
      opened: "2026-09-29T10:00:00Z",
      resolvableBy: ["requirements"],
    });
  });
});

describe("a failed run the old code left keeps a reason of one line (41m)", () => {
  /**
   * A whole machine comment, as the old code could keep it as a run's
   * failure: a line of its own, then the banner, the stage's account, and a
   * command to type. Machine-typed in the shape the live check found on
   * timone #106 on 2026-10-02; not copied from the real ledger.
   */
  const machineComment =
    "🤖 **Timone** · automatic message — written by the machine, not by the account it appears under\n" +
    "\n" +
    "---\n" +
    "\n" +
    "🆘 **Needs a person** · the build stopped on a question it cannot answer alone.\n" +
    "\n" +
    "The plan renames the `holder` field, but the ledger on disk still has runs under the old name.\n" +
    "\n" +
    "**What I need from you:** take this over in your terminal:\n" +
    "\n" +
    "```\n" +
    "timone takeover timone#106\n" +
    "```\n";

  /** A ledger holding one failed run of the old code, with `failure` as given. */
  function ledgerWithFailure(failure: string): string {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        runs: [
          {
            id: "timone#106/1",
            project: "timone",
            ticket: 106,
            seq: 1,
            status: "failed",
            stage: "execution",
            branch: "timone/106-the-holder-field",
            failure,
            flags: [],
            createdAt: "2026-09-08T09:00:00Z",
            updatedAt: "2026-09-08T11:30:00Z",
          },
        ],
      }),
    );
    return path;
  }

  it("loads an old failed run whose failure is a whole machine comment with one line, and no banner and no command", () => {
    // Text before the banner on the first line is the reason. The rest of the
    // comment is not.
    const behind = RunStore.open(
      ledgerWithFailure(`a build stage escalated: ${machineComment}`),
    ).get("timone#106/1");
    expect(behind?.status).toBe("cancelled");
    expect(behind?.cancellation).toBe(
      "stopped before the old code was removed: a build stage escalated",
    );

    // A failure that is the comment and nothing else has no reason of its own.
    const whole = RunStore.open(ledgerWithFailure(machineComment)).get("timone#106/1");
    expect(whole?.status).toBe("cancelled");
    expect(whole?.cancellation).toBe(
      "stopped before the old code was removed: no reason recorded",
    );

    for (const run of [behind, whole]) {
      expect(run?.cancellation).not.toContain("\n");
      expect(run?.cancellation).not.toContain("🤖");
      expect(run?.cancellation).not.toContain("timone takeover");
    }
  });

  it("cuts the reason the same way on a run an earlier build already converted and wrote", () => {
    // An earlier build converted it on read and kept the whole comment. The
    // daemon's next write put that run on disk as cancelled.
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    const written = {
      id: "timone#106/1",
      project: "timone",
      ticket: 106,
      seq: 1,
      status: "cancelled",
      stage: "execution",
      branch: "timone/106-the-holder-field",
      cancellation: `stopped before the old code was removed: a build stage escalated: ${machineComment}`,
      flags: [],
      createdAt: "2026-09-08T09:00:00Z",
      updatedAt: "2026-09-08T11:30:00Z",
    };
    const cancelledByAPerson = {
      ...written,
      id: "timone#107/1",
      ticket: 107,
      branch: "timone/107-a-second-thing",
      cancellation: "fvermaut: not needed any more",
    };
    writeFileSync(path, JSON.stringify({ version: 1, runs: [written, cancelledByAPerson] }));

    const store = RunStore.open(path);

    expect(store.get("timone#106/1")).toEqual({
      ...written,
      cancellation: "stopped before the old code was removed: a build stage escalated",
    });
    // A reason a person gave is left as it was.
    expect(store.get("timone#107/1")).toEqual(cancelledByAPerson);
  });
});
