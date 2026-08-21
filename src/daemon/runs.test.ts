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

import type { PipelineStage } from "./pipeline.js";
import { RunStore, runId } from "./runs.js";

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

  it("hands back a failed chunk rather than opening the next one beside it", () => {
    // ADR-0029: `done` settles a chunk, `failed` does not. The poll loop
    // registers every marked ticket on every cycle, so a failed chunk that
    // let its ticket move on would grow a fresh chunk a minute later — and
    // `timone retry` would then be refused by the one-session guard.
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.fail(first.run.id, "the stage died");

    const again = store.register("scratch-app", 7);

    expect(again.created).toBe(false);
    expect(again.run.id).toBe("scratch-app#7/1");
    expect(again.run.status).toBe("failed");
    expect(store.all()).toHaveLength(1);
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
    store.park(run.id, { waitingOn: "approval on the ticket", kind: "gate" });

    expect(store.liveRunForTicket("scratch-app", 7)?.id).toBe(
      "scratch-app#7/1",
    );
  });

  it("still calls a failed chunk live, because only a retry can end it", () => {
    // ADR-0029. `failed` is not settled: the ticket has not moved past this
    // chunk, it is waiting for it to be retried.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.fail(run.id, "the stage died");

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
    store.park(first.run.id, { waitingOn: "your review", kind: "review" });

    const again = store.register("scratch-app", 7);

    expect(again.created).toBe(false);
    expect(again.run.id).toBe("scratch-app#7/1");
    expect(store.all()).toHaveLength(1);
    expect(store.occupyingRun("scratch-app")?.id).toBe("scratch-app#7/1");
  });

  it("leaves a failed chunk retryable however often the poll loop re-registers", () => {
    // ADR-0029, and the reason for it. `poll.ts` registers every marked
    // ticket on every cycle; if a failure let the ticket succeed to chunk 2,
    // the one-session guard would refuse `timone retry scratch-app#7` and the
    // broken chunk would have no road back.
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");
    store.fail(first.run.id, "the stage died");

    store.register("scratch-app", 7);

    expect(store.retry(first.run.id).status).toBe("picked-up");
    expect(store.runsForTicket("scratch-app", 7).map((r) => r.id)).toEqual([
      "scratch-app#7/1",
    ]);
  });

  it("opens the next chunk once a retried chunk finally succeeds", () => {
    // Failure delays succession rather than ending it: the chunk advances on
    // the success it eventually reaches.
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.fail(first.run.id, "the stage died");
    store.retry(first.run.id);
    store.activate(first.run.id, "session-2");
    store.complete(first.run.id);

    const second = store.register("scratch-app", 7);

    expect(second.created).toBe(true);
    expect(second.run.id).toBe("scratch-app#7/2");
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
    expect(() => store.activate("scratch-app#7/1", "session-7b")).toThrow(
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

describe("the answer a run has read and not acted on", () => {
  // ADR-0023: reading a written answer consumes it, so the cursor moves past it
  // before the session that will act on it exists. The window that opens there
  // is the one the run must be able to be wound back into — and `waitCursor`
  // cannot hold the way back, because activating the run clears it.

  const invitation = "2026-08-03T09:00:00Z";
  const readAt = "2026-08-03T09:30:00Z";

  /** A run parked on a conversation whose answer the loop has just consumed. */
  function consumed(store: RunStore, ticket: number): string {
    const { run } = store.register("scratch-app", ticket);
    store.activate(run.id, `session-${ticket}`);
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "wayfinding",
      waitCursor: invitation,
    });
    // What the poll loop writes when it reads their answer: the cursor moves to
    // the answer, and the run records which answer that was.
    store.repark(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "wayfinding",
      waitCursor: readAt,
      consumedAnswerAt: readAt,
    });
    return run.id;
  }

  it("keeps it through the transition that clears the wait, and through failure", () => {
    const path = statePath();
    const store = newStore(path);
    const id = consumed(store, 26);

    store.activate(id, "session-26b");
    const active = store.get(id);
    store.fail(id, "Claude Code process terminated by signal SIGKILL");

    // The wait is gone, cursor included — that is what activating a run means.
    expect(active?.waitCursor).toBeUndefined();
    expect(active?.waitingKind).toBeUndefined();
    // The answer it read is not, and it is on disk, where the next process
    // reads it: a session dying here is the whole reason the field exists.
    expect(active?.consumedAnswerAt).toBe(readAt);
    expect(newStore(path).get(id)).toMatchObject({
      status: "failed",
      consumedAnswerAt: readAt,
    });
  });

  it("forgets it once the run has moved on, by a new wait or the next stage", () => {
    const store = newStore();
    const reparked = consumed(store, 26);
    const advanced = consumed(store, 27);

    // The session asked one more thing and parked again: a new wait, and the
    // answer that started it has been acted on.
    store.repark(reparked, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "wayfinding",
      waitCursor: "2026-08-03T10:00:00Z",
    });
    // The other settled it and walked on to the next stage. Re-recording the
    // stage it is *already* at must not count — that happens before a resumed
    // session runs, on the answer it was resumed with.
    store.activate(advanced, "session-27b");
    store.setStage(advanced, "wayfinding");
    const resuming = store.get(advanced);
    store.setStage(advanced, "requirements");

    expect(store.get(reparked)?.consumedAnswerAt).toBeUndefined();
    expect(resuming?.consumedAnswerAt).toBe(readAt);
    expect(store.get(advanced)?.consumedAnswerAt).toBeUndefined();
  });

  it("forgets it when the run resolves, so nothing can reopen a settled answer", () => {
    const store = newStore();
    const id = consumed(store, 26);

    store.activate(id, "session-26b");
    store.complete(id);

    expect(store.get(id)).toMatchObject({ status: "done" });
    expect(store.get(id)?.consumedAnswerAt).toBeUndefined();
  });
});

describe("a run parked on something nothing written can resolve", () => {
  // ADR-0033's kind. This slice adds the kind and the ledger's ability to
  // carry it; nothing creates one yet.

  const stopped = "2026-08-03T09:00:00Z";

  it("carries the new kind through the file, and back out of it", () => {
    const path = statePath();
    const store = newStore(path);
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "me — I can't take this one further myself.",
      kind: "escalation",
      stage: "verification",
      waitCursor: stopped,
    });

    const reopened = RunStore.open(path);

    expect(reopened.get(run.id)).toMatchObject({
      status: "parked",
      waitingKind: "escalation",
      stage: "verification",
      waitCursor: stopped,
    });
  });

  it("does not disturb a ledger written before the kind existed", () => {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(PRE_CHUNK_LEDGER, path);

    const store = RunStore.open(path);

    expect(store.all()).toHaveLength(4);
    expect(
      JSON.parse(readFileSync(path, "utf8")) as { version: number },
    ).toMatchObject({ version: 1 });
  });

  it("clears a consumed answer like every other park, because none is passed", () => {
    // The contract `applyPark` already has, asserted for the new kind because
    // the floor is about to read the marker at exactly this instant.
    const store = newStore();
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "an answer",
      kind: "conversation",
      stage: "verification",
      waitCursor: stopped,
      consumedAnswerAt: stopped,
    });

    store.repark(run.id, {
      waitingOn: "me — I can't take this one further myself.",
      kind: "escalation",
      stage: "verification",
      waitCursor: stopped,
    });

    expect(store.get(run.id)?.consumedAnswerAt).toBeUndefined();
  });
});

describe("the floor under a stage that does not notice", () => {
  // ADR-0033's second detector. A stage that reads an answer and asks again at
  // the same stage has spent a pass to reach the question it started with.
  // Once is a stage doing its job badly; twice running is the ivtrends #1
  // loop, and the second one stops rather than asks.

  const invitation = "2026-08-03T09:00:00Z";

  /** The park the poll loop writes when it consumes an answer, at `stage`. */
  function consumedAt(store: RunStore, id: string, stage: PipelineStage, at: string): void {
    store.repark(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage,
      waitCursor: at,
      consumedAnswerAt: at,
    });
  }

  /** A run parked at `stage`, ready to be answered. */
  function waiting(store: RunStore, ticket: number, stage: PipelineStage): string {
    const { run } = store.register("scratch-app", ticket);
    store.activate(run.id, `session-${ticket}`);
    store.park(run.id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage,
      waitCursor: invitation,
    });
    return run.id;
  }

  it("stops the second time a run reads an answer and asks again at the same stage", () => {
    const store = newStore();
    const id = waiting(store, 31, "verification");

    // The session read their answer and posted another question at the same
    // stage. Once: still a conversation, and the human's next answer reaches it.
    consumedAt(store, id, "verification", "2026-08-03T09:30:00Z");
    store.repark(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "verification",
      waitCursor: "2026-08-03T09:35:00Z",
    });
    expect(store.get(id)?.waitingKind).toBe("conversation");
    expect(store.get(id)?.reAsksAfterAnswer).toBe(1);

    // Twice. The answer was read, the same question came back, and asking a
    // third time is what this stops.
    consumedAt(store, id, "verification", "2026-08-03T10:00:00Z");
    store.repark(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "verification",
      waitCursor: "2026-08-03T10:05:00Z",
    });

    expect(store.get(id)?.waitingKind).toBe("escalation");
    expect(store.get(id)?.reAsksAfterAnswer).toBe(2);
  });

  it("never counts a park that read no answer, however many there are", () => {
    // The discrimination that matters. A stage asking a question nobody has
    // answered yet is behaving correctly, and a hundred of those are still a
    // hundred correct questions.
    const store = newStore();
    const id = waiting(store, 31, "clarification");

    for (let round = 0; round < 100; round += 1) {
      store.repark(id, {
        waitingOn: "your answer to the question in my last comment.",
        kind: "conversation",
        stage: "clarification",
        waitCursor: `2026-08-03T10:${String(round).padStart(2, "0")}:00Z`,
      });
    }

    expect(store.get(id)?.waitingKind).toBe("conversation");
    expect(store.get(id)?.reAsksAfterAnswer ?? 0).toBe(0);
  });

  it("starts again when the run moves to another stage, because that is progress", () => {
    const store = newStore();
    const id = waiting(store, 31, "execution");

    consumedAt(store, id, "execution", "2026-08-03T09:30:00Z");
    store.repark(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "execution",
      waitCursor: "2026-08-03T09:35:00Z",
    });
    expect(store.get(id)?.reAsksAfterAnswer).toBe(1);

    store.activate(id, "session-b");
    store.setStage(id, "verification");
    store.park(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "verification",
      waitCursor: "2026-08-03T11:00:00Z",
    });
    consumedAt(store, id, "verification", "2026-08-03T11:30:00Z");
    store.repark(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "verification",
      waitCursor: "2026-08-03T11:35:00Z",
    });

    expect(store.get(id)?.waitingKind).toBe("conversation");
    expect(store.get(id)?.reAsksAfterAnswer).toBe(1);
  });

  it("counts only a re-ask, not a wait of another kind", () => {
    // A gate and a review do not re-enter the stage that asked, so neither can
    // be the loop this floor is under.
    const store = newStore();
    const id = waiting(store, 31, "requirements");

    consumedAt(store, id, "requirements", "2026-08-03T09:30:00Z");
    store.repark(id, {
      waitingOn: "your approval of what I wrote down",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T09:35:00Z",
    });
    consumedAt(store, id, "requirements", "2026-08-03T10:00:00Z");
    store.repark(id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "requirements",
      waitCursor: "2026-08-03T10:05:00Z",
    });

    expect(store.get(id)?.waitingKind).toBe("review");
  });

  it("counts only a re-ask at the same stage", () => {
    const store = newStore();
    const id = waiting(store, 31, "clarification");

    consumedAt(store, id, "clarification", "2026-08-03T09:30:00Z");
    store.repark(id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "wayfinding",
      waitCursor: "2026-08-03T09:35:00Z",
    });

    expect(store.get(id)?.waitingKind).toBe("conversation");
    expect(store.get(id)?.reAsksAfterAnswer ?? 0).toBe(0);
  });

  it("treats a run written before the counter existed as having none", () => {
    const path = statePath();
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(PRE_CHUNK_LEDGER, path);

    const store = RunStore.open(path);
    const id = store.all()[0].id;

    expect(store.get(id)?.reAsksAfterAnswer).toBeUndefined();
    expect(() =>
      store.repark(id, {
        waitingOn: "your answer to the question in my last comment.",
        kind: "conversation",
        stage: store.get(id)?.stage ?? "triage",
        waitCursor: "2026-08-03T10:00:00Z",
      }),
    ).not.toThrow();
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
      kind: "gate",
      stage: "planning",
      waitCursor: "2026-08-02T10:00:00Z",
    });

    const cancelled = store.cancel(run.id, "you asked me to stop");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.waitingOn).toBeUndefined();
    expect(cancelled.waitingKind).toBeUndefined();
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

  it("cancels a failed run, so work nobody will retry can be ended", () => {
    // Ruled by fvermaut 2026-08-15. A failure has two exits, not one: `timone
    // retry` re-arms it and `timone cancel` abandons it. Without the second,
    // clearing a failed run meant retrying it first — and in the window
    // between the two commands the daemon can pick the run up and spend real
    // money on work somebody was trying to delete.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.fail(run.id, "the stage died");

    const cancelled = store.cancel(run.id, "we shipped this by hand");

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancellation).toBe("we shipped this by hand");
    expect(store.get(run.id)?.status).toBe("cancelled");
  });

  it("gives a run cancelled out of failure no way back, retry included", () => {
    // The asymmetry the ruling keeps: a failure has two exits, a cancellation
    // has none. Taking the abandonment exit must not leave the retry one open
    // behind it, or `timone cancel` on a failed run would be undoable by the
    // very command it was typed instead of.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.fail(run.id, "the stage died");
    store.cancel(run.id, "we shipped this by hand");

    expect(() => store.retry(run.id)).toThrow(/was cancelled/);
    expect(store.get(run.id)?.status).toBe("cancelled");
  });

  it("lets a ticket move on from a failure that was abandoned rather than retried", () => {
    // The other half of the ruling. A failed chunk is unsettled on purpose —
    // it is what `timone retry` re-arms — so cancelling it has to settle it,
    // or the ticket would be held for ever by a chunk nobody will ever run.
    const store = newStore();
    const first = store.register("scratch-app", 7);
    store.activate(first.run.id, "session-1");
    store.claimBranch(first.run.id, "timone/7-reset-password");
    store.fail(first.run.id, "the stage died");
    store.cancel(first.run.id, "we shipped this by hand");

    const second = store.register("scratch-app", 7);

    expect(second.created).toBe(true);
    expect(second.run.id).toBe("scratch-app#7/2");
    expect(second.run.status).toBe("picked-up");
    expect(store.liveRunForTicket("scratch-app", 7)?.id).toBe("scratch-app#7/2");
  });

  it("has no way out of cancelled, retry included", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.cancel(run.id, "its ticket is no longer open");

    expect(() => store.cancel(run.id, "again")).toThrow(/nothing — it is finished/);
    expect(() => store.retry(run.id)).toThrow();
  });

  it("refuses a retry in words a person can act on, not an assertion", () => {
    // `timone retry` prints whatever this throws, verbatim (`retry.ts`'s
    // `switch` has no `cancelled` case and falls through to here). So the
    // message is a user interface, and the generic "is cancelled, not failed"
    // would put a state-machine complaint in front of somebody who just typed
    // a command.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.cancel(run.id, "its ticket is no longer open and marked");

    expect(() => store.retry(run.id)).toThrow(
      "scratch-app #7 was cancelled: its ticket is no longer open and marked. " +
        "Cancelled work isn't retried — remove the `timone:held` label from " +
        "the ticket and I'll start it afresh, or close it and I'll carry on " +
        "without it.",
    );
  });

  it("says so without a reason, when none was recorded", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.cancel(run.id, "");

    expect(() => store.retry(run.id)).toThrow(
      "scratch-app #7 was cancelled. Cancelled work isn't retried — remove " +
        "the `timone:held` label from the ticket and I'll start it afresh, " +
        "or close it and I'll carry on without it.",
    );
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

    expect(store.get("scratch-app#8/1")?.status).toBe("picked-up");
    expect(store.occupyingRun("scratch-app")?.id).toBe("scratch-app#8/1");
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

  it("shows another process's claim to a guard that has itself written nothing", () => {
    // The guards are the poll loop's only defence against resuming a run
    // somebody else has already taken (ADR-0023, fault 3). Answering from
    // memory made them blind to exactly the write they exist to notice — and
    // a guard that has mutated nothing has nothing that would have refreshed
    // its memory as a side effect.
    const path = statePath();
    const daemon = newStore(path);
    const { run } = daemon.register("scratch-app", 7);
    daemon.activate(run.id, "session-abc");
    daemon.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "triage",
    });

    const rival = newStore(path);
    expect(rival.parkedRuns("scratch-app").map((each) => each.id)).toEqual([
      run.id,
    ]);

    daemon.claim(run.id);

    expect(rival.runningRun("scratch-app")?.id).toBe(run.id);
    expect(rival.occupyingRun("scratch-app")?.id).toBe(run.id);
    expect(rival.parkedRuns("scratch-app")).toEqual([]);
  });

  /**
   * The poll loop's guard sequence over one project, as `resumeAnswered`
   * runs it: walk the parked runs, stop if a session is in flight, skip a run
   * whose project somebody else holds, and resume the first that survives.
   * Copied rather than imported because the loop is not this module's — what
   * is being asserted is that these three answers are enough to serialize two
   * processes, which is the promise `poll.ts` is entitled to rely on.
   */
  function resumeOneParkedRun(
    store: RunStore,
    project: string,
    sessionId: string,
  ): string | undefined {
    for (const run of store.parkedRuns(project)) {
      if (store.runningRun(project) !== undefined) return undefined;
      const holder = store.occupyingRun(project);
      if (holder !== undefined && holder.id !== run.id) continue;
      store.activate(run.id, sessionId);
      return run.id;
    }
    return undefined;
  }

  it("lets only one of two processes resume the same parked run", () => {
    // One written answer, two daemons, two sessions, two full resolutions
    // posted on one ticket — reproduced twice on scratch-app at phase 18's
    // stage-7 pass. The second process must find the run already taken by
    // asking, not by having happened to write something first.
    const path = statePath();
    const daemon = newStore(path);
    const { run } = daemon.register("scratch-app", 7);
    daemon.activate(run.id, "session-earlier");
    daemon.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "triage",
    });

    const first = newStore(path);
    const second = newStore(path);

    expect(resumeOneParkedRun(first, "scratch-app", "session-a")).toBe(run.id);
    expect(resumeOneParkedRun(second, "scratch-app", "session-b")).toBeUndefined();
    expect(RunStore.open(path).get(run.id)?.sessionId).toBe("session-a");
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


describe("a failed run stops waiting", () => {
  /** A run parked on a gate, then killed mid-stage. */
  function failedAtAGate(): { store: RunStore; id: string } {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-19T09:00:00Z",
    });
    store.activate(run.id, "session-2");
    store.fail(run.id, "the session ended without a result");
    return { store, id: run.id };
  }

  it("carries no wait at all once it has failed", () => {
    // ✏ It used to clear the words and keep the kind and the cursor, which
    // made a failed run the one state holding a wait nothing was waiting on.
    // Dead data that looks live is what a later reader builds on.
    const { store, id } = failedAtAGate();
    const run = store.get(id);

    expect(run?.status).toBe("failed");
    expect(run?.waitingOn).toBeUndefined();
    expect(run?.waitingKind).toBeUndefined();
    expect(run?.waitCursor).toBeUndefined();
  });

  it("keeps the answer it read and never acted on", () => {
    // The one fact about a dead session still owed to somebody (ADR-0023):
    // they wrote an answer, it was read, and nothing acted on it. `timone
    // retry` rewinds to this, so clearing it here would silently re-ask.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: "2026-08-19T09:00:00Z",
      consumedAnswerAt: "2026-08-19T09:30:00Z",
    });
    store.activate(run.id, "session-2");
    store.fail(run.id, "killed mid-stage");

    expect(store.get(run.id)?.consumedAnswerAt).toBe("2026-08-19T09:30:00Z");
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
