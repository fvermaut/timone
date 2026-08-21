import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type { Preview, PreviewAdapter } from "../adapters/preview.js";
import {
  CONVERSATION_RECORD_MARKER,
  CTA_MARKER,
  HANDBACK_MARKER,
  HANDBACK_STEP_PREFIX,
  MACHINE_MARKER,
  PREVIEW_MARKER,
  STAGE_ESCALATED_MARKER,
  type PullRequest,
  type PullRequestThread,
  type Step,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { breakdownPath, fromWorkingTree } from "./breakdown.js";
import { enqueue, pending, requestsDir } from "./requests.js";
import { RunStore, type Run } from "./runs.js";
import { pollOnce, type SessionSpawner, type SpawnContext } from "./poll.js";
import { processStage, stageLabel } from "./pipeline.js";
import { AgentSessionSpawner } from "./session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A store over a fresh state file with a deterministic clock. */
function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-poll-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-02T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

function manifestWith(...names: string[]): Manifest {
  return {
    projects: Object.fromEntries(
      names.map((name) => [
        name,
        {
          repo_url: `https://github.com/fvermaut/${name}.git`,
          path: `projects/${name}`,
          stack: [],
          bindings: { ticketing: "github" as const },
        },
      ]),
    ),
  };
}

/**
 * The same manifest with every project's introduction switch turned on.
 *
 * It is a transformer rather than a second builder so that it composes with
 * whichever builder a test already uses, and — more to the point — so that
 * `manifestWith` keeps saying what a manifest entry says when nobody has
 * thought about this: **nothing**. ADR-0024's switch defaults off, and a
 * default that every test fixture quietly opted into would be a default in
 * name only.
 */
function introducing(manifest: Manifest): Manifest {
  return {
    projects: Object.fromEntries(
      Object.entries(manifest.projects).map(([name, config]) => [
        name,
        { ...config, introduce_unmarked: true },
      ]),
    ),
  };
}

function ticket(number: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    number,
    title: `ticket ${number}`,
    body: "the page feels slow when I add many items",
    labels: ["timone"],
    url: `https://github.com/fvermaut/scratch-app/issues/${number}`,
    author: "fvermaut",
    createdAt: `2026-08-01T0${number}:00:00Z`,
    ...overrides,
  };
}

interface PostedComment {
  project: string;
  number: number;
  body: string;
}

/**
 * A fake ticketing adapter: `marked` maps project name → the tickets its
 * list call returns. Every comment posted is recorded. `failing` names
 * projects whose list call throws.
 */
/**
 * The seam's pull-request surface, for fakes in tests where none exists.
 * Reading a thread throws so a test that unexpectedly reaches for one fails
 * at the reach, not on an empty answer.
 */
const noPullRequests = {
  async findPullRequest(): Promise<PullRequest | undefined> {
    return undefined;
  },
  async getPullRequestThread(): Promise<PullRequestThread> {
    throw new Error("no pull request exists in this test");
  },
  async postPullRequestComment(): Promise<void> {},
  async upsertPullRequestComment(): Promise<void> {},
  async upsertComment(): Promise<void> {},
  async closeTicket(): Promise<void> {},
};

/**
 * The two ticket listings no fake here is *about*: the open one, and the step
 * children of an initiative. This project has nothing open beyond the marked
 * tickets it declares, and no initiative in these tests has been broken into
 * step tickets, so nothing here is ever introduced to either.
 *
 * Its own spread rather than a member of `noPullRequests`, because it is the
 * ticket surface: a fake answering these out of a constant named for pull
 * requests would be saying something it does not mean.
 */
const noOtherListings = {
  async listOpenTickets(): Promise<Ticket[]> {
    return [];
  },
  async listSteps(): Promise<Step[]> {
    return [];
  },
};

function fakeAdapter(
  marked: Record<string, Ticket[]>,
  failing: string[] = [],
): { adapter: TicketingAdapter; comments: PostedComment[] } {
  const comments: PostedComment[] = [];
  const adapter: TicketingAdapter = {
    // No initiative in this test is broken into step tickets.
    async listSteps(): Promise<Step[]> {
      return [];
    },
    async listMarkedTickets(project: TicketingProject): Promise<Ticket[]> {
      if (failing.includes(project.name)) {
        throw new Error(`gh exploded on ${project.name}`);
      }
      return marked[project.name] ?? [];
    },
    // Every ticket this fake declares is open, and every one of them carries
    // the mark — so the open listing is the marked listing here, and no
    // introduction is owed on any of them.
    async listOpenTickets(project: TicketingProject): Promise<Ticket[]> {
      if (failing.includes(project.name)) {
        throw new Error(`gh exploded on ${project.name}`);
      }
      return marked[project.name] ?? [];
    },
    async getTicket(
      project: TicketingProject,
      number: number,
    ): Promise<TicketThread> {
      const found = (marked[project.name] ?? []).find(
        (candidate) => candidate.number === number,
      );
      if (found === undefined) throw new Error(`no ticket ${number}`);
      return { ...found, comments: [] };
    },
    async postComment(project, number, body): Promise<void> {
      comments.push({ project: project.name, number, body });
    },
    async applyLabel(): Promise<void> {},
    ...noPullRequests,
  };
  return { adapter, comments };
}

/** A spawner that records what it was asked to run and does nothing else. */
function fakeSpawner(): { spawner: SessionSpawner; spawned: Run[] } {
  const spawned: Run[] = [];
  return {
    spawner: {
      async spawn(run) {
        spawned.push(run);
      },
    },
    spawned,
  };
}

describe("pollOnce — pickup and acknowledgement", () => {
  it("registers a run and acknowledges exactly once for a marked ticket", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(store.all()).toHaveLength(1);
    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ project: "scratch-app", number: 7 });
    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
  });

  it("touches nothing when no ticket carries the mark", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [] });
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(store.all()).toEqual([]);
    expect(comments).toEqual([]);
    expect(spawned).toEqual([]);
  });

  it("says nothing on a second cycle over the same ticket", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(comments).toHaveLength(1);
    expect(store.all()).toHaveLength(1);
    expect(second.pickedUp).toEqual([]);
  });

  it("ends every acknowledgement with a call to action", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(comments).toHaveLength(2);
    for (const comment of comments) {
      const lastLine = comment.body.trimEnd().split("\n").at(-1) ?? "";
      expect(lastLine).toMatch(/\*\*What I need from you:\*\*/);
    }
  });

  it("never asks the human to know a stage or a skill name", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    for (const comment of comments) {
      expect(comment.body).not.toMatch(/timone-\w+|stage \d|sub-phase/i);
    }
  });
});

describe("pollOnce — serialization", () => {
  it("queues a second marked ticket and says so in its acknowledgement", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(store.queue("scratch-app").map((run) => run.ticket)).toEqual([8]);
    expect(result.queued).toEqual(["scratch-app#8/1"]);

    const queuedAck = comments.find((comment) => comment.number === 8);
    expect(queuedAck?.body).toMatch(/queue/i);
    expect(queuedAck?.body).toMatch(/#7/);
    expect(spawned.map((run) => run.ticket)).toEqual([7]);
  });

  it("picks the queued ticket up on a later cycle, once the first is done", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7), ticket(8)] });
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    store.activate("scratch-app#7/1", "session-1");
    store.complete("scratch-app#7/1");
    await pollOnce(deps);

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(8);
    expect(spawned.map((run) => run.ticket)).toEqual([7, 8]);
  });

  it("spawns a session for the occupying run only once", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    store.activate("scratch-app#7/1", "session-1");
    await pollOnce(deps);

    expect(spawned).toHaveLength(1);
  });
});

describe("pollOnce — a ticket that stopped being mine while its run waited", () => {
  it("cancels the run instead of starting a session on it", async () => {
    // Picked up on an earlier cycle, when the ticket was still open and
    // marked; the human has closed it since. Nothing may be spawned on it —
    // asserted on the spawner rather than on a log line, because the claim is
    // that no session was started.
    const store = newStore();
    store.register("scratch-app", 7);
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(spawned).toEqual([]);
    expect(result.cancelled).toEqual(["scratch-app#7/1"]);
    const run = store.get("scratch-app#7/1");
    expect(run?.status).toBe("cancelled");
    expect(run?.cancellation).toMatch(/no longer open and marked/i);
  });

  it("takes a fresh chunk on the ticket when it comes back", async () => {
    // 22a meeting 22b: cancellation settles a chunk, so a ticket that is open
    // and marked again is picked up as new work rather than being stuck
    // behind the run that was abandoned.
    const store = newStore();
    store.register("scratch-app", 7);
    const gone = fakeAdapter({ "scratch-app": [] });
    const back = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner, spawned } = fakeSpawner();
    const manifest = manifestWith("scratch-app");

    await pollOnce({ manifest, store, adapter: gone.adapter, spawner });
    await pollOnce({ manifest, store, adapter: back.adapter, spawner });

    expect(store.runsForTicket("scratch-app", 7).map((run) => run.id)).toEqual([
      "scratch-app#7/1",
      "scratch-app#7/2",
    ]);
    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#7/2"]);
  });
});

describe("pollOnce — resilience", () => {
  it("carries on with the other projects when one fails", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(
      { alpha: [ticket(1)], beta: [ticket(2)] },
      ["alpha"],
    );
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("alpha", "beta"),
      store,
      adapter,
      spawner,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/alpha/);
    expect(store.occupyingRun("beta")?.ticket).toBe(2);
    expect(comments.map((comment) => comment.project)).toEqual(["beta"]);
  });

  it("does not let a failing spawn abort the cycle", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({ alpha: [ticket(1)], beta: [ticket(2)] });
    const spawner: SessionSpawner = {
      async spawn(run) {
        if (run.project === "alpha") throw new Error("SDK unavailable");
      },
    };

    const result = await pollOnce({
      manifest: manifestWith("alpha", "beta"),
      store,
      adapter,
      spawner,
    });

    expect(result.errors.some((error) => /alpha/.test(error))).toBe(true);
    expect(store.occupyingRun("beta")?.ticket).toBe(2);
  });
});

describe("pollOnce — resuming a run whose human answered", () => {
  /** A thread whose comments the test controls. */
  function threadedAdapter(comments: TicketThread["comments"]): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
  } {
    const posted: PostedComment[] = [];
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    return { adapter, posted };
  }

  const invitation = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\ncome and talk to me`,
    createdAt: "2026-08-03T10:00:00Z",
    fromTimone: true,
  };

  /** A run parked on a conversation opened at `invitation`. */
  function parkedOnConversation(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    return store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });
  }

  /** A run parked on a gate opened at `invitation`. */
  function parkedOnGate(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    return store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: invitation.createdAt,
    });
  }

  it("advances a conversation the session recorded as accepted", async () => {
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\n---\n\n${CONVERSATION_RECORD_MARKER}\n\nwe agreed the send button is the problem`,
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(spawned).toHaveLength(1);
  });

  it("leaves a conversation nobody concluded exactly where it was", async () => {
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = threadedAdapter([invitation]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(result.resumed).toEqual([]);
    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  it("does not read an unmarked machine comment as a concluded conversation", async () => {
    // The session posts "we didn't finish" when the human walks away. It is
    // Timone's, and after the cursor, and it must still not advance anything.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\nwe didn't finish that conversation`,
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
  });

  it("ends a run whose conversation resolved the last thing it had to decide", async () => {
    // ✏ The amendment's third settled question, on the takeover's side of it.
    // Nothing follows wayfinding, so an accepted record is a `finish` — and a
    // run that finishes must end. Left as it was, the ledger accumulated a
    // parked run for every decision ticket already resolved and closed.
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "wayfinding",
      waitCursor: invitation.createdAt,
    });
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\n---\n\n${CONVERSATION_RECORD_MARKER}\n\nIV Rank, over a 252-day lookback`,
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(result.completed).toEqual(["scratch-app#6/1"]);
    // And nothing was started: there is no stage after this one to run.
    expect(spawned).toEqual([]);
  });

  it("picks up a written answer and carries it to the conversation's own stage", async () => {
    // ADR-0022's written path: a plain comment after the machine's question is
    // the answer, with no keyword, read exactly as a gate reply is. It resumes
    // the stage the run is parked at — the conversation is what ingests it.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: "it's the draft they lose, not the phone layout",
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: false,
      },
    ]);
    const contexts: unknown[] = [];
    const recording: SessionSpawner = {
      async spawn(_run, _project, context) {
        contexts.push(context);
      },
    };

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: recording,
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts).toEqual([
      {
        stage: "clarification",
        feedback: "it's the draft they lose, not the phone layout",
      },
    ]);
  });

  it("joins every comment they wrote after the park, not only the last one", async () => {
    // ✏ The amendment's fourth settled question: a written answer is read
    // generously, exactly as the review park reads a review. Someone who
    // answers and then adds a second thought has said one thing in two
    // comments, and dropping the first would lose it silently.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: "it's the draft they lose, not the phone layout",
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: false,
      },
      {
        author: "fvermaut",
        body: "and only ever on the long ones",
        createdAt: "2026-08-03T11:05:00Z",
        fromTimone: false,
      },
    ]);
    const contexts: { feedback?: string }[] = [];
    const recording: SessionSpawner = {
      async spawn(_run, _project, context) {
        contexts.push(context ?? {});
      },
    };

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: recording,
    });

    expect(contexts[0]?.feedback).toContain("it's the draft they lose");
    expect(contexts[0]?.feedback).toContain("only ever on the long ones");
  });

  it("does not read the machine's own follow-up question as the answer", async () => {
    // The machine asks the remaining question on the same thread it is
    // watching. A loop that answered itself would ask forever.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\nand which of the two do they hit first?`,
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  it("leaves a quiet conversation park where it is across two consecutive cycles", async () => {
    // The idempotency R1 already demands, stated over more than one cycle:
    // nothing new was said, so nothing may fire — not on this cycle and not on
    // the next one either.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter, posted } = threadedAdapter([invitation]);
    const { spawner, spawned } = fakeSpawner();
    const deps = { manifest: manifestWith("scratch-app"), store, adapter, spawner };

    const first = await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(first.resumed).toEqual([]);
    expect(second.resumed).toEqual([]);
    expect(spawned).toEqual([]);
    expect(posted).toEqual([]);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
    expect(store.get("scratch-app#6/1")?.waitCursor).toBe(invitation.createdAt);
  });

  it("advances a gate the human approved", async () => {
    const store = newStore();
    parkedOnGate(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: "approve",
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: false,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();
    const contexts: unknown[] = [];
    const recording: SessionSpawner = {
      async spawn(run, project, context) {
        await spawner.spawn(run, project, context);
        contexts.push(context);
      },
    };

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: recording,
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    // It advances *and* carries who approved and when, so the artifact can
    // record the gate rather than leaving the trace on the ticket alone.
    // ✏ `requirements` now advances to `breakdown` rather than to `planning`
    // (ADR-0030 D1). What this test is about is unchanged and is the second
    // half of the literal below: the approval travels with the transition, so
    // the artifact can be stamped rather than the trace living only on the
    // ticket. Only the stage the run advances *to* has moved.
    expect(contexts).toEqual([
      {
        stage: "breakdown",
        approval: {
          stage: "requirements",
          by: "fvermaut",
          at: "2026-08-03T11:00:00Z",
        },
      },
    ]);
  });

  it("re-runs the same stage on a change request, carrying the words", async () => {
    const store = newStore();
    parkedOnGate(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: "it's not about phones, it's about losing the draft",
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: false,
      },
    ]);
    const contexts: unknown[] = [];
    const recording: SessionSpawner = {
      async spawn(_run, _project, context) {
        contexts.push(context);
      },
    };

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: recording,
    });

    expect(contexts).toEqual([
      {
        stage: "requirements",
        feedback: "it's not about phones, it's about losing the draft",
      },
    ]);
  });

  it("never reads its own comment as the human's approval", async () => {
    // The trap the machine marker exists to close: Timone quoting the word
    // "approve" back at the ticket must not approve Timone's own work.
    const store = newStore();
    parkedOnGate(store);
    const { adapter } = threadedAdapter([
      invitation,
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\napprove`,
        createdAt: "2026-08-03T11:00:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
  });

  it("ignores an answer written before the question was asked", async () => {
    const store = newStore();
    parkedOnGate(store);
    const { adapter } = threadedAdapter([
      {
        author: "fvermaut",
        body: "approve",
        createdAt: "2026-08-03T09:00:00Z",
        fromTimone: false,
      },
      invitation,
    ]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
  });

  it("resumes one run per cycle, because sessions serialize", async () => {
    const store = newStore();
    const first = store.register("scratch-app", 6);
    store.activate(first.run.id, "s1");
    store.park(first.run.id, {
      waitingOn: "a conversation",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });
    const second = store.register("scratch-app", 7);
    store.activate(second.run.id, "s2");
    store.park(second.run.id, {
      waitingOn: "a conversation",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });

    const record = {
      author: "fvermaut",
      body: `${MACHINE_MARKER}\n\n${CONVERSATION_RECORD_MARKER}\n\nagreed`,
      createdAt: "2026-08-03T11:00:00Z",
      fromTimone: true,
    };
    const { adapter } = threadedAdapter([invitation, record]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(result.resumed).toHaveLength(1);
    expect(spawned).toHaveLength(1);
  });

  it("starts a run left queued behind a park that no longer holds anything", async () => {
    // The exact ledger phase 11 left on disk: #4 parked holding the project
    // under the old rule, #6 queued behind it forever. Written as a file
    // rather than built through the store, because the store would never
    // produce this shape again — only a restart onto an old one can.
    const dir = mkdtempSync(join(tmpdir(), "timone-poll-legacy-"));
    tempDirs.push(dir);
    const path = join(dir, ".timone", "state.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        runs: [
          {
            id: "scratch-app#4",
            project: "scratch-app",
            ticket: 4,
            status: "parked",
            stage: "triage",
            waitingOn: "the next stage to be built",
            flags: [],
            createdAt: "2026-08-02T18:29:31.940Z",
            updatedAt: "2026-08-02T18:32:29.650Z",
          },
          {
            id: "scratch-app#6",
            project: "scratch-app",
            ticket: 6,
            status: "queued",
            flags: [],
            createdAt: "2026-08-02T18:32:57.787Z",
            updatedAt: "2026-08-02T18:32:57.787Z",
          },
        ],
      }),
    );

    const store = RunStore.open(path);
    expect(store.get("scratch-app#6/1")?.status).toBe("queued");

    // Unclassified, so #4 has nothing to be resumed *into* — this test is
    // about the queue moving, not about the park being picked back up.
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(4), ticket(6)] });
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned.map((run) => run.ticket)).toEqual([6]);
    expect(store.get("scratch-app#4/1")?.status).toBe("parked");
  });
});

describe("pollOnce — runs parked before the machinery existed", () => {
  /** The shape phase 11 left: parked at triage, waiting on nothing. */
  function parkedAwaitingMachinery(store: RunStore, labels: string[]): Run {
    const { run } = store.register("scratch-app", 4);
    store.activate(run.id, "session-11");
    void labels;
    return store.park(run.id, {
      waitingOn: "the next stage to be built",
      stage: "triage",
    });
  }

  function labelledAdapter(labels: string[]): TicketingAdapter {
    const base = ticket(4, { labels });
    return {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
  }

  it("picks a run back up once the stage it was waiting for exists", async () => {
    const store = newStore();
    parkedAwaitingMachinery(store, ["timone", "triage:feature"]);
    const adapter = labelledAdapter(["timone", "triage:feature"]);
    const contexts: unknown[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(result.resumed).toEqual(["scratch-app#4/1"]);
    expect(contexts).toEqual([{ stage: "clarification" }]);
  });

  it("picks a bug back up now that the stage that acts on it exists", async () => {
    // ✏ The inverse of what this asserted until phase 27, and the inversion is
    // the fix. A bug routed to a stage nothing could run, so it parked here
    // and stayed parked for the life of the ledger — `scratch-app` #4 sat in
    // exactly this state while `STATUS.md` listed it under *nothing you can do
    // about it*. The stage exists now, so the run resumes into it.
    const store = newStore();
    parkedAwaitingMachinery(store, ["timone", "triage:bug"]);
    const adapter = labelledAdapter(["timone", "triage:bug"]);
    const contexts: (SpawnContext | undefined)[] = [];
    const spawner: SessionSpawner = {
      async spawn(_run, _project, context) {
        contexts.push(context);
      },
    };

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(result.resumed).toEqual(["scratch-app#4/1"]);
    // ✏ `feedback` until ADR-0036 retired the stage; a bug now goes straight
    // to planning, because triage read enough to know it is one.
    expect(contexts.at(-1)?.stage).toBe("planning");
  });

  it("leaves it parked when the ticket carries no classification to route on", async () => {
    const store = newStore();
    parkedAwaitingMachinery(store, ["timone"]);
    const adapter = labelledAdapter(["timone"]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
  });
});

describe("pollOnce — a run parked at an unbuilt stage resumes at that stage", () => {
  /** The shape 12f left scratch-app#6 in: parked *at* execution, which could
   * not run — not parked *after* it. Distinct from the phase-11 vintage above,
   * where the recorded stage had already run. */
  function parkedAtExecution(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-12");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    return store.park(run.id, {
      waitingOn: "the next stage to be built",
      stage: "execution",
    });
  }

  it("resumes at execution itself, never at the stage after it", async () => {
    // The trap: once execution has a successor in the graph, a resume that
    // asks "what follows?" would skip the build entirely and start
    // verification on code nobody wrote.
    const store = newStore();
    parkedAtExecution(store);
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    const contexts: unknown[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts).toEqual([{ stage: "execution" }]);
  });
});

describe("pollOnce — a run parked on a pull-request review", () => {
  function parkedOnReview(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    return store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "delivery",
      waitCursor: "2026-08-06T10:00:00Z",
    });
  }

  function reviewAdapter(
    state: "open" | "merged" | "closed",
    comments: PullRequestThread["comments"],
  ): { adapter: TicketingAdapter; posted: PostedComment[]; closed: string[] } {
    const posted: PostedComment[] = [];
    const closed: string[] = [];
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      async findPullRequest() {
        return {
          number: 9,
          title: "Fix the box",
          url: "https://github.com/fvermaut/scratch-app/pull/9",
          state,
          headSha: "aaaaaaa",
        };
      },
      async getPullRequestThread() {
        return {
          number: 9,
          title: "Fix the box",
          url: "https://github.com/fvermaut/scratch-app/pull/9",
          state,
          headSha: "aaaaaaa",
          comments,
        };
      },
      async postPullRequestComment(): Promise<void> {},
  async upsertPullRequestComment(): Promise<void> {},
      async upsertComment(): Promise<void> {},
      async closeTicket(_project, number, reason): Promise<void> {
        closed.push(`${number}:${reason}`);
      },
    };
    return { adapter, posted, closed };
  }

  it("completes the run and promotes the queue when the PR merged", async () => {
    const store = newStore();
    parkedOnReview(store);
    const { run: queued } = store.register("scratch-app", 8);
    expect(queued.status).toBe("queued");
    const { adapter, posted, closed } = reviewAdapter("merged", []);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(posted.some((comment) => /merged/i.test(comment.body))).toBe(true);
    // A ticket whose journey ended is closed, not left open forever.
    expect(closed).toEqual(["6:completed"]);
    // R10's live half in miniature: the terminal state is what starts the
    // next ticket.
    expect(store.get("scratch-app#8/1")?.status).not.toBe("queued");
    void spawned;
  });

  it("completes the run as declined when the PR was closed unmerged", async () => {
    const store = newStore();
    parkedOnReview(store);
    const { adapter, posted, closed } = reviewAdapter("closed", []);
    const { spawner } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(posted.some((comment) => /without merging/i.test(comment.body))).toBe(true);
    expect(closed).toEqual(["6:not-planned"]);
  });

  it("spawns a remediation carrying the human's words on a new review comment", async () => {
    const store = newStore();
    parkedOnReview(store);
    const { adapter } = reviewAdapter("open", [
      {
        author: "fvermaut",
        body: "Please rename this variable, it shadows the prop.",
        createdAt: "2026-08-06T12:00:00Z",
        fromTimone: false,
        replyTo: "501",
      },
    ]);
    const contexts: unknown[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts).toMatchObject([
      {
        stage: "remediation",
        feedback: expect.stringContaining("shadows the prop"),
      },
    ]);
  });

  it("stays parked on machine comments and on comments before the cursor", async () => {
    const store = newStore();
    parkedOnReview(store);
    const { adapter } = reviewAdapter("open", [
      {
        author: "fvermaut",
        body: "an earlier human remark",
        createdAt: "2026-08-06T09:00:00Z",
        fromTimone: false,
      },
      {
        author: "fvermaut",
        body: "machine bookkeeping after the cursor",
        createdAt: "2026-08-06T12:00:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });
});

describe("reclaiming a run its daemon left behind", () => {
  /** A store whose clock the test sets by hand. */
  function clockedStore(): { store: RunStore; set: (iso: string) => void } {
    const dir = mkdtempSync(join(tmpdir(), "timone-reclaim-"));
    tempDirs.push(dir);
    let instant = "2026-08-06T10:00:00Z";
    return {
      store: RunStore.open(join(dir, ".timone", "state.json"), {
        now: () => instant,
      }),
      set: (iso) => {
        instant = iso;
      },
    };
  }

  const FOUR_INTERVALS = 4 * 30 * 1000;
  const POLL_INTERVAL = 60 * 1000;

  /**
   * Leave the store's witness where a daemon polling every interval from
   * `from` until `to` would have left it (ADR-0020).
   *
   * Every reclaim test needs this, and that is the point: a daemon that was
   * not watching may not judge, so a test that reclaims without having watched
   * would be testing a daemon that cannot exist. It also keeps the tests below
   * honest — each one still fails for the reason it names, not because
   * judgement was withheld.
   */
  function watchingSince(store: RunStore, from: string, to: string): void {
    for (let at = Date.parse(from); at < Date.parse(to); at += POLL_INTERVAL) {
      store.witness({
        unwitnessedAfterMs: 2 * POLL_INTERVAL,
        staleAfterMs: FOUR_INTERVALS,
        now: new Date(at).toISOString(),
      });
    }
  }

  it("fails the run, tells the ticket and frees the project, in one cycle", async () => {
    const { store, set } = clockedStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
    expect(store.get("scratch-app#7/1")?.status).toBe("failed");
    expect(store.occupyingRun("scratch-app")).toBeUndefined();
    expect(comments.some((c) => c.body.includes("stopped before the work"))).toBe(
      true,
    );
  });

  /**
   * A tracker for a stale run that had opened pull request #19, answering for
   * that pull request in `state`. The reclaim tests above deal in runs that
   * never got as far as one; these deal in the run that did.
   */
  function staleReviewAdapter(state: "open" | "merged" | "closed"): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
    closed: string[];
  } {
    const posted: PostedComment[] = [];
    const closed: string[] = [];
    const base = ticket(7);
    const pull: PullRequestThread = {
      number: 19,
      title: "The volatility arithmetic",
      url: "https://github.com/fvermaut/ivtrends/pull/19",
      state,
      headSha: "aaaaaaa",
      comments: [],
    };
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      async findPullRequest() {
        return { ...pull };
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return pull;
      },
      async postPullRequestComment(): Promise<void> {},
      async upsertPullRequestComment(): Promise<void> {},
      async upsertComment(): Promise<void> {},
      async closeTicket(_project, number, reason): Promise<void> {
        closed.push(`${number}:${reason}`);
      },
    };
    return { adapter, posted, closed };
  }

  /** A stale run that got as far as opening pull request #19. */
  function staleWithPullRequest(store: RunStore): void {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
    store.recordPullRequest(run.id, 19);
  }

  it("finishes a stale run whose pull request merged, rather than failing it", async () => {
    // The fault this exists for: a session that dies *after* its work is
    // merged had its piece recorded as a crash, and ADR-0029 will not let the
    // ticket advance past a failed chunk — so the whole initiative stopped,
    // with the merged work already on main.
    const { store, set } = clockedStore();
    const { adapter, posted, closed } = staleReviewAdapter("merged");
    const { spawner } = fakeSpawner();

    staleWithPullRequest(store);
    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(store.get("scratch-app#7/1")?.status).toBe("done");
    expect(result.reclaimed).toEqual([]);
    expect(result.completed).toEqual(["scratch-app#7/1"]);
    // The ticket is told its work merged, and never told the machine died.
    expect(posted.some((c) => /stopped before the work/.test(c.body))).toBe(false);
    expect(closed).toEqual(["7:completed"]);
  });

  it("still fails a stale run whose pull request was closed unmerged", async () => {
    // The boundary. Only a merge says the work landed; a closed pull request
    // says the opposite, and a failure is the honest record of that.
    const { store, set } = clockedStore();
    const { adapter } = staleReviewAdapter("closed");
    const { spawner } = fakeSpawner();

    staleWithPullRequest(store);
    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
    expect(store.get("scratch-app#7/1")?.status).toBe("failed");
  });

  it("still fails a stale run whose pull request is open", async () => {
    const { store, set } = clockedStore();
    const { adapter } = staleReviewAdapter("open");
    const { spawner } = fakeSpawner();

    staleWithPullRequest(store);
    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
    expect(store.get("scratch-app#7/1")?.status).toBe("failed");
  });

  it("leaves a stale run alone when its pull request cannot be read", async () => {
    // Unreadable is not open. On a flaky link the tracker goes quiet for
    // reasons that say nothing about the run, and guessing "failed" there
    // would bury merged work on exactly the cycle least able to prove it.
    const { store, set } = clockedStore();
    // `fakeAdapter` throws from `getPullRequestThread`, which is the point.
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    staleWithPullRequest(store);
    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
    expect(result.errors.some((line) => /could not read PR #19/.test(line))).toBe(
      true,
    );
    // Nothing was said to the human about a failure that was never established.
    expect(comments.some((c) => /stopped before the work/.test(c.body))).toBe(false);
  });

  it("promotes the run that was queued behind it in the same cycle", async () => {
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { spawner, spawned } = fakeSpawner();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
    store.register("scratch-app", 8);
    expect(store.get("scratch-app#8/1")?.status).toBe("queued");

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(spawned.map((r) => r.id)).toEqual(["scratch-app#8/1"]);
  });

  it("never reclaims a long session that is still saying it is alive", async () => {
    // The false positive that matters most. A four-hour execution session is
    // a normal thing, and reclaiming one would kill work in progress.
    const { store, set } = clockedStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-alive");
    store.claimBranch(run.id, "timone/7-slow");

    set("2026-08-06T14:00:00Z");
    store.heartbeat(run.id);
    // The daemon has been watching throughout, so this run is spared for the
    // reason the test names — its heartbeat — and not for want of a witness.
    watchingSince(store, "2026-08-06T13:57:00Z", "2026-08-06T14:00:20Z");
    set("2026-08-06T14:00:20Z");

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
    expect(comments).toEqual([]);
  });

  it("says so once, not every cycle", async () => {
    const { store, set } = clockedStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    };
    await pollOnce(deps);
    // One poll interval later, so the daemon is still entitled to judge and
    // the silence below is the ledger's doing rather than the witness's.
    set("2026-08-06T10:10:00Z");
    const second = await pollOnce(deps);

    expect(second.reclaimed).toEqual([]);
    expect(
      comments.filter((c) => c.body.includes("stopped before the work")),
    ).toHaveLength(1);
  });

  it("leaves a run parked on a human alone, however long it has waited", async () => {
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s");
    store.claimBranch(run.id, "timone/7-slow");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    watchingSince(store, "2026-08-25T09:57:00Z", "2026-08-25T10:00:00Z");
    set("2026-08-25T10:00:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("parked");
  });

  it("leaves a reclaimed run ready for `timone retry`, with its branch intact", async () => {
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
    store.setStage(run.id, "execution");

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    const rearmed = store.retry("scratch-app#7/1");
    expect(rearmed.status).toBe("picked-up");
    expect(rearmed.stage).toBe("execution");
    expect(rearmed.branch).toBe("timone/7-slow");
  });

  // ─── The witness (phase 17, ADR-0020) ────────────────────────────────────

  /** A stale run of `scratch-app`, quiet since ten o'clock. */
  function quietRun(store: RunStore): void {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
  }

  it("still reclaims a run it watched go quiet, gap or no gap", async () => {
    // Asserted before any test of the skip, and the order is the point: a
    // change that merely stopped reclaiming would satisfy every test below
    // and destroy the requirement this phase exists to close.
    const { store, set } = clockedStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    quietRun(store);

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    });

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
    expect(comments.some((c) => c.body.includes("stopped before the work"))).toBe(
      true,
    );
  });

  it("reclaims nothing on the cycle that discovers a gap, and says why", async () => {
    // 15a's night: 146 suspensions, 113 of them past the threshold. Under a
    // continuously running daemon each one of those was a healthy run killed.
    const { store, set } = clockedStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    const lines: string[] = [];
    quietRun(store);

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
      log: (line) => lines.push(line),
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
    expect(comments.some((c) => c.body.includes("stopped before the work"))).toBe(
      false,
    );
    // The gate has to be able to read this off the log and know why — both
    // that judgement was withheld and how long the daemon was away.
    expect(
      lines.some((line) => /not checking for dead runs.*17m00s/.test(line)),
    ).toBe(true);
  });

  it("tells a young watch apart from an absence, in the words it logs", async () => {
    // Found by running the real binary rather than by a test: two cycles a
    // tenth of a second apart logged "nothing was watching for 0s", which is
    // false — the daemon had been watching the whole time and was merely too
    // young to judge. An operator who reads a line they know to be nonsense
    // stops reading the lines, and this is the line the gate turns on.
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    const lines: string[] = [];
    quietRun(store);
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
      log: (line: string) => lines.push(line),
    };

    // A gap: nobody was watching.
    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    await pollOnce(deps);
    // No gap at all — an unbroken watch that is simply not old enough yet.
    set("2026-08-06T10:19:00Z");
    await pollOnce(deps);

    // The two refusals, in order, picked out of everything else the cycle
    // says — a cycle logs whatever else it did, and this test is about the
    // words of the refusal rather than about its place in the log.
    const refusals = lines.filter((line) =>
      line.includes("not checking for dead runs"),
    );
    expect(refusals[0]).toMatch(/the daemon was not running for 17m00s/);
    expect(refusals[1]).toMatch(/has been up 1m00s.*watch a run for 2m00s/);
    expect(refusals[1]).not.toMatch(/was not running for/);
  });

  it("is delayed, not disabled: the same run is reclaimed a window later", async () => {
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    quietRun(store);
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    };

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    expect((await pollOnce(deps)).reclaimed).toEqual([]);

    set("2026-08-06T10:19:00Z");
    expect((await pollOnce(deps)).reclaimed).toEqual([]);
    set("2026-08-06T10:20:00Z");

    expect((await pollOnce(deps)).reclaimed).toEqual(["scratch-app#7/1"]);
  });

  it("grants the window on a state file no daemon has ever observed", async () => {
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    quietRun(store);

    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
  });

  it("takes one witness for the whole cycle, not one per project", async () => {
    // A witness taken per project would have project one's fresh stamp answer
    // for project two, which is the same masking hazard two daemons have.
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({
      "scratch-app": [ticket(7)],
      "other-app": [ticket(8)],
    });
    const { spawner } = fakeSpawner();
    const lines: string[] = [];

    for (const [project, number] of [
      ["scratch-app", 7],
      ["other-app", 8],
    ] as const) {
      const { run } = store.register(project, number);
      store.activate(run.id, `session-gone-${number}`);
      store.claimBranch(run.id, `timone/${number}-slow`);
    }

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app", "other-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
      log: (line) => lines.push(line),
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("other-app#8/1")?.status).toBe("active");
    expect(
      lines.filter((line) => /not checking for dead runs/.test(line)),
    ).toHaveLength(1);
  });

  it("derives the unwitnessed gap from the poll interval it was given", async () => {
    // Four minutes is an absence at a one-minute interval and jitter at a
    // five-minute one. The threshold is not a constant, it is twice the
    // cadence the daemon was actually told to poll at.
    const { store, set } = clockedStore();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();
    quietRun(store);

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:06:00Z");
    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: 5 * 60 * 1000,
    });

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
  });
});

// ─── Previews (phase 16) ────────────────────────────────────────────────────

/** A manifest whose named projects are all bound to Docker previews. */
function manifestWithPreviews(...names: string[]): Manifest {
  const manifest = manifestWith(...names);
  for (const name of names) {
    manifest.projects[name].bindings = {
      ticketing: "github" as const,
      preview: "docker" as const,
    };
  }
  return manifest;
}

/** A run of `project` that owns a branch and has a pull request open on it. */
function runWithPullRequest(
  store: RunStore,
  project: string,
  ticketNumber: number,
  pr: number,
): void {
  const { run } = store.register(project, ticketNumber);
  store.claimBranch(run.id, `timone/${ticketNumber}-work`);
  store.recordPullRequest(run.id, pr);
}

interface Upsert {
  project: string;
  number: number;
  marker: string;
  body: string;
}

/**
 * A ticketing fake whose pull-request surface answers with `pulls`, keyed by
 * branch, and records every in-place comment revision.
 */
function previewTicketing(pulls: Record<string, PullRequest>): {
  adapter: TicketingAdapter;
  upserts: Upsert[];
} {
  const upserts: Upsert[] = [];
  const adapter: TicketingAdapter = {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [];
    },
    ...noOtherListings,
    async getTicket(): Promise<TicketThread> {
      throw new Error("no ticket is read in this test");
    },
    async postComment(): Promise<void> {},
    async applyLabel(): Promise<void> {},
    async findPullRequest(_project, branch): Promise<PullRequest | undefined> {
      return pulls[branch];
    },
    async getPullRequestThread(): Promise<PullRequestThread> {
      throw new Error("no pull-request thread is read in this test");
    },
    async postPullRequestComment(): Promise<void> {},
    async upsertPullRequestComment(project, number, marker, body): Promise<void> {
      upserts.push({ project: project.name, number, marker, body });
    },
    async upsertComment(): Promise<void> {},
    async closeTicket(): Promise<void> {},
  };
  return { adapter, upserts };
}

/** A pull request as the tracker reports it. */
function pull(
  number: number,
  headSha: string,
  state: PullRequest["state"] = "open",
): PullRequest {
  return {
    number,
    title: `pull request ${number}`,
    url: `https://github.com/fvermaut/scratch-app/pull/${number}`,
    state,
    headSha,
  };
}

/**
 * A preview adapter that answers with whatever `reply` returns for the commit
 * it is asked about, and records everything it was asked to do.
 */
function fakePreviews(
  reply: (headSha: string) => Preview | Error = () => ({
    state: "ready" as const,
    url: "http://localhost:54321/",
  }),
): {
  previews: PreviewAdapter;
  ensured: Array<{ project: string; pr: number; headSha: string }>;
  released: Array<{ project: string; pr: number }>;
} {
  const ensured: Array<{ project: string; pr: number; headSha: string }> = [];
  const released: Array<{ project: string; pr: number }> = [];
  return {
    previews: {
      async ensure(project, pr, headSha): Promise<Preview> {
        ensured.push({ project: project.name, pr, headSha });
        const answer = reply(headSha);
        if (answer instanceof Error) throw answer;
        return answer;
      },
      async release(project, pr): Promise<void> {
        released.push({ project: project.name, pr });
      },
    },
    ensured,
    released,
  };
}

describe("pollOnce — previews are opt-in", () => {
  it("does not reconcile a project with no preview binding at all", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
    });
    const { previews, ensured } = fakePreviews();
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      previews,
    });

    // Not "built and discarded" — never asked. A binding says which adapter,
    // never whether to have one, so an unbound project must cost nothing.
    expect(ensured).toEqual([]);
    expect(upserts).toEqual([]);
    expect(store.previewsFor("scratch-app")).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("does nothing for a bound project when the daemon has no preview adapter", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
    });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWithPreviews("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(upserts).toEqual([]);
    expect(store.previewsFor("scratch-app")).toEqual([]);
  });
});

describe("pollOnce — previews reconcile and land on the pull request", () => {
  it("says it once and revises it in place, never once per cycle", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const pulls = { "timone/7-work": pull(9, "abc1234") };
    const { adapter, upserts } = previewTicketing(pulls);
    let port = 54321;
    const { previews } = fakePreviews(() => ({
      state: "ready",
      url: `http://localhost:${port}/`,
    }));
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWithPreviews("scratch-app"),
      store,
      adapter,
      spawner,
      previews,
    };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    // Three cycles, one statement. This is the failure mode a per-cycle
    // reconciler creates and the one that would spam a client's pull request.
    expect(upserts).toHaveLength(1);
    expect(upserts[0].marker).toBe(PREVIEW_MARKER);
    expect(upserts[0].body).toContain("http://localhost:54321/");

    // A rebuild moved the port, which is the one thing a reviewer must be
    // told again — and it is a revision, not a second comment.
    port = 49713;
    pulls["timone/7-work"] = pull(9, "def5678");
    await pollOnce(deps);

    expect(upserts).toHaveLength(2);
    expect(upserts[1].body).toContain("http://localhost:49713/");
    expect(upserts[1].body).toContain("def5678");
  });

  it("records the preview against the commit it was reconciled for", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter } = previewTicketing({ "timone/7-work": pull(9, "abc1234") });
    const { previews, ensured } = fakePreviews();
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWithPreviews("scratch-app"),
      store,
      adapter,
      spawner,
      previews,
    });

    expect(ensured).toEqual([
      { project: "scratch-app", pr: 9, headSha: "abc1234" },
    ]);
    expect(store.previewRecord("scratch-app", 9)).toMatchObject({
      project: "scratch-app",
      pr: 9,
      headSha: "abc1234",
      state: "ready",
      url: "http://localhost:54321/",
    });
  });

  it("posts a failed preview's reason and lets the rest of the cycle happen", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    runWithPullRequest(store, "other-app", 3, 4);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
      "timone/3-work": pull(4, "beef999"),
    });
    const { previews, ensured } = fakePreviews((headSha) =>
      headSha === "abc1234"
        ? { state: "failed", reason: "the app container never became healthy" }
        : { state: "ready", url: "http://localhost:54321/" },
    );
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWithPreviews("scratch-app", "other-app"),
      store,
      adapter,
      spawner,
      previews,
    });

    // A failure is a value, so it is not an error and it blocks nothing.
    expect(result.errors).toEqual([]);
    expect(upserts[0].body).toContain("never became healthy");
    expect(upserts[0].body).toContain("Nothing is blocked by this");
    expect(ensured.map((call) => call.project)).toEqual([
      "scratch-app",
      "other-app",
    ]);
  });

  it("catches an adapter that throws into errors, leaving the rest of the cycle intact", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    runWithPullRequest(store, "other-app", 3, 4);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
      "timone/3-work": pull(4, "beef999"),
    });
    const { previews } = fakePreviews((headSha) =>
      headSha === "abc1234" ? new Error("docker daemon is not running") : {
        state: "ready",
        url: "http://localhost:54321/",
      },
    );
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWithPreviews("scratch-app", "other-app"),
      store,
      adapter,
      spawner,
      previews,
    });

    expect(result.errors).toEqual([
      "scratch-app: preview for #7: docker daemon is not running",
    ]);
    expect(upserts.map((upsert) => upsert.number)).toEqual([4]);
  });
});

describe("pollOnce — previews end when their pull request does", () => {
  /** A store and fakes with one preview already recorded and running. */
  async function withLivePreview(state: PullRequest["state"]): Promise<{
    store: RunStore;
    deps: Parameters<typeof pollOnce>[0];
    released: Array<{ project: string; pr: number }>;
    upserts: Upsert[];
    pulls: Record<string, PullRequest>;
  }> {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const pulls: Record<string, PullRequest> = {
      "timone/7-work": pull(9, "abc1234"),
    };
    const { adapter, upserts } = previewTicketing(pulls);
    const { previews, released } = fakePreviews();
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWithPreviews("scratch-app"),
      store,
      adapter,
      spawner,
      previews,
    };

    await pollOnce(deps);
    pulls["timone/7-work"] = pull(9, "abc1234", state);
    return { store, deps, released, upserts, pulls };
  }

  it("releases a merged pull request's preview and drops its record", async () => {
    const { store, deps, released } = await withLivePreview("merged");

    await pollOnce(deps);

    expect(released).toEqual([{ project: "scratch-app", pr: 9 }]);
    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();
  });

  it("releases a pull request closed without merging, just the same", async () => {
    const { store, deps, released } = await withLivePreview("closed");

    await pollOnce(deps);

    expect(released).toEqual([{ project: "scratch-app", pr: 9 }]);
    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();
  });

  it("releases once per ending, not once per cycle thereafter", async () => {
    const { deps, released } = await withLivePreview("merged");

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    // A merged pull request stays merged forever; a release keyed on its
    // state alone would make work for the rest of the daemon's life.
    expect(released).toHaveLength(1);
  });

  it("gives a reopened pull request a preview again, with no code of its own", async () => {
    const { store, deps, pulls, upserts } = await withLivePreview("closed");
    await pollOnce(deps);
    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();

    // Reopening is not a case anything handles — it is simply an open pull
    // request with no preview recorded, which is what a new one is.
    pulls["timone/7-work"] = pull(9, "abc1234", "open");
    await pollOnce(deps);

    expect(store.previewRecord("scratch-app", 9)).toMatchObject({
      state: "ready",
    });
    expect(upserts).toHaveLength(2);
  });

  it("reports a release that fails and does not wedge the cycle", async () => {
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const pulls: Record<string, PullRequest> = {
      "timone/7-work": pull(9, "abc1234"),
    };
    const { adapter } = previewTicketing(pulls);
    const { spawner } = fakeSpawner();
    const previews: PreviewAdapter = {
      async ensure(): Promise<Preview> {
        return { state: "ready", url: "http://localhost:54321/" };
      },
      async release(): Promise<void> {
        throw new Error("docker compose down exploded");
      },
    };
    const deps = {
      manifest: manifestWithPreviews("scratch-app"),
      store,
      adapter,
      spawner,
      previews,
    };

    await pollOnce(deps);
    pulls["timone/7-work"] = pull(9, "abc1234", "merged");
    const result = await pollOnce(deps);

    expect(result.errors).toEqual([
      "scratch-app: preview for #7: docker compose down exploded",
    ]);
    // The record survives, so a later cycle tries again rather than leaving
    // containers on the host with nothing left that remembers them.
    expect(store.previewRecord("scratch-app", 9)).toBeDefined();
  });
});

describe("pollOnce — a wayfinder decision ticket", () => {
  /**
   * The real spawner over fakes for the two things outside the process: the
   * tracker, and the agent runtime. Everything the assertions are about —
   * the stage graph, the conversation channel, the ledger — is the real
   * collaborator, because "it parks on a conversation" is a claim about how
   * those three behave together and a fake spawner could only restate it.
   *
   * The runtime throws on purpose: a conversation stage must never reach
   * `runtime.start`, and a test that let it silently would be asserting the
   * opposite of what it claims.
   */
  function realSpawner(
    store: RunStore,
    adapter: TicketingAdapter,
  ): SessionSpawner {
    return new AgentSessionSpawner({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      runtime: {
        async start() {
          throw new Error("no unattended session may start for a conversation");
        },
      },
      root: "/nowhere",
    });
  }

  it("parks on a conversation at stage 2, without ever being triaged", async () => {
    // The map that charted this ticket already decided what kind of question
    // it is. Triaging it would classify a decision as a fresh request and
    // route it into the build pipeline.
    const store = newStore();
    const { adapter } = fakeAdapter({
      "scratch-app": [ticket(5, { labels: ["timone", "wayfinder:grilling"] })],
    });

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: realSpawner(store, adapter),
    });

    const run = store.get("scratch-app#5/1");
    expect(run?.stage).toBe("wayfinding");
    expect(processStage("wayfinding")).toBe(2);
    expect(run?.status).toBe("parked");
    expect(run?.waitingKind).toBe("conversation");
    // A decision ticket produces a decision, so nothing was branched.
    expect(run?.branch).toBeUndefined();
  });

  it("leaves an ordinary marked ticket to start where it always did", async () => {
    // The negative half of the routing, and the one that protects every
    // existing run: a ticket carrying no wayfinder label is handed to the
    // spawner with no entry context at all — not one naming triage. Two
    // answers to where a run starts would eventually disagree.
    const store = newStore();
    const { adapter } = fakeAdapter({
      "scratch-app": [ticket(5, { labels: ["timone"] })],
    });
    const contexts: unknown[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(contexts).toEqual([undefined]);
  });

  it("does not work a wayfinder ticket the tracker never handed it", async () => {
    // R1's negative clause, unchanged by this phase. The mark label is the
    // permission boundary and `listMarkedTickets` is where it is applied — so
    // a wayfinder ticket without the mark is simply not in the cycle's
    // listing, and carrying `wayfinder:grilling` buys it no exemption. The
    // map itself is the ticket this protects: it is never marked, and a run
    // on it would be a run nothing could resolve.
    const store = newStore();
    const { adapter, comments } = fakeAdapter({ "scratch-app": [] });
    const spawned: Run[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(run) {
          spawned.push(run);
        },
      },
    });

    expect(store.all()).toEqual([]);
    expect(spawned).toEqual([]);
    expect(comments).toEqual([]);
  });

  it("resumes an old triage park onto the map, not into the build pipeline", async () => {
    // A park from before this stage existed: triage ran, classified the
    // ticket, and the run stopped because what followed was not built. If a
    // wayfinder label has landed on it since, the map is what the ticket
    // became — and resuming on the stale `triage:feature` would send a
    // decision question off to have its requirements written.
    const store = newStore();
    const { adapter } = fakeAdapter({
      "scratch-app": [
        ticket(5, {
          labels: ["timone", "triage:feature", "wayfinder:grilling"],
        }),
      ],
    });
    const contexts: unknown[] = [];

    const { run } = store.register("scratch-app", 5);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "the next stage to be built", stage: "triage" });

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(contexts).toEqual([{ stage: "wayfinding" }]);
  });

  it("invites the human with the channel's own words, not a second copy of them", async () => {
    // ADR-0022's invitation is one piece of copy. The daemon's park comment
    // is `TerminalChannel.open`'s, so a wayfinder ticket and a clarification
    // ticket say the same thing about how to answer.
    const store = newStore();
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(5, { labels: ["timone", "wayfinder:grilling"] })],
    });

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: realSpawner(store, adapter),
    });

    const park = comments.at(-1)?.body ?? "";
    expect(park).toMatch(/two ways to answer/i);
    expect(park).toContain("timone takeover scratch-app#5");
  });
});

describe("pollOnce — a written answer reaches a session that ingests it", () => {
  /**
   * The real spawner again, and for the same reason: "the answer is picked up
   * and the session spawned" (ADR-0022) is a claim about the poll loop, the
   * stage graph and the spawner together. A fake spawner can only restate the
   * half of it that lives in `poll.ts`.
   *
   * The runtime records rather than throws, because here a session *is* what
   * should start — the written path exists so that writing causes something
   * to happen.
   */
  function realSpawner(
    store: RunStore,
    adapter: TicketingAdapter,
    prompts: string[],
  ): SessionSpawner {
    return new AgentSessionSpawner({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      runtime: {
        async start(request) {
          prompts.push(request.prompt);
          return {
            sessionId: "session-2",
            completed: Promise.resolve({ sessionId: "session-2", ok: true }),
          };
        },
      },
      root: "/nowhere",
    });
  }

  it("starts a session carrying the answer, rather than asking again", async () => {
    const store = newStore();
    const invitation = {
      author: "fvermaut",
      body: `${MACHINE_MARKER}\n\ntwo ways to answer this`,
      createdAt: "2026-08-03T10:00:00Z",
      fromTimone: true,
    };
    const answer = {
      author: "fvermaut",
      body: "it's the draft they lose, not the phone layout",
      createdAt: "2026-08-03T11:00:00Z",
      fromTimone: false,
    };
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const posted: PostedComment[] = [];
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [invitation, answer] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };

    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });

    const prompts: string[] = [];
    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: realSpawner(store, adapter, prompts),
    });

    // One session, instructed with what they actually wrote.
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("it's the draft they lose");
    // And no second invitation: re-posting the question they just answered is
    // the exact failure the written path exists to prevent.
    expect(posted.map((comment) => comment.body).join("\n")).not.toMatch(
      /two ways to answer/i,
    );
  });
});

describe("pollOnce — reading a written answer consumes it", () => {
  const invitation = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\ntwo ways to answer this`,
    createdAt: "2026-08-03T10:00:00Z",
    fromTimone: true,
  };
  const answer = {
    author: "fvermaut",
    body: "it's the draft they lose, not the phone layout",
    createdAt: "2026-08-03T11:00:00Z",
    fromTimone: false,
  };

  /** A conversation thread the test can add comments to as cycles pass. */
  function conversationAdapter(comments: TicketThread["comments"]): {
    adapter: TicketingAdapter;
    thread: TicketThread["comments"];
  } {
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const thread = [...comments];
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [...thread] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    return { adapter, thread };
  }

  /** A run parked on a conversation opened at `invitation`. */
  function parkedOnConversation(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    return store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });
  }

  it("reads one answer once, however many cycles pass over the same thread", async () => {
    // ADR-0023's fourth mechanism. The comment stays on the ticket; what moves
    // is the machine's marker, and it moves as part of deciding to resume — so
    // the next read of the same thread finds nothing outstanding.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = conversationAdapter([invitation, answer]);
    const { spawner, spawned } = fakeSpawner();
    const deps = { manifest: manifestWith("scratch-app"), store, adapter, spawner };

    const first = await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(first.resumed).toEqual(["scratch-app#6/1"]);
    expect(second.resumed).toEqual([]);
    expect(spawned).toHaveLength(1);
  });

  it("records which answer it consumed, before the session that reads it exists", async () => {
    // The cursor cannot be the record: `activate` clears it the moment the
    // session starts, and a session killed just after that left the run failed
    // with nothing pointing at the answer it had read (ADR-0023). So the same
    // write that moves the cursor records the instant it moved to — and, being
    // taken from the one read of the thread, it names the very comment the
    // session is handed rather than whatever a second read would have found.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter } = conversationAdapter([invitation, answer]);
    const ledger: (Run | undefined)[] = [];
    const contexts: SpawnContext[] = [];
    const spawner: SessionSpawner = {
      async spawn(run, _project, context) {
        ledger.push(store.get(run.id));
        contexts.push(context ?? {});
      },
    };

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    const atSpawn = ledger[0];
    expect(atSpawn?.waitCursor).toBe(answer.createdAt);
    expect(atSpawn?.consumedAnswerAt).toBe(answer.createdAt);
    // The words that instant belongs to are the words the session was given.
    expect(contexts[0]?.feedback).toBe(answer.body);
  });

  it("still hears the next thing they write, and hears only that", async () => {
    // Consuming must move the marker, never deafen the path. A second answer
    // is a second answer — and it arrives on its own, not with the first one
    // silently restated alongside it.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter, thread } = conversationAdapter([invitation, answer]);
    const contexts: { feedback?: string }[] = [];
    const recording: SessionSpawner = {
      async spawn(_run, _project, context) {
        contexts.push(context ?? {});
      },
    };
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: recording,
    };

    await pollOnce(deps);
    thread.push({
      author: "fvermaut",
      body: "and only ever on the long ones",
      createdAt: "2026-08-03T12:00:00Z",
      fromTimone: false,
    });
    const second = await pollOnce(deps);

    expect(second.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts).toHaveLength(2);
    expect(contexts[1]?.feedback).toBe("and only ever on the long ones");
  });

  /** Every call on the seam that changes something a human can see. */
  const WRITES = [
    "postComment",
    "applyLabel",
    "closeTicket",
    "postPullRequestComment",
    "upsertPullRequestComment",
    // The call to action reconciled at the end of every cycle writes on the
    // same thread the human's answer is on, so it is the write this test most
    // needs to see. Left out, the assertions below would watch it happen and
    // report nothing.
    "upsertComment",
  ];

  /**
   * The seam with a recorder behind it: every call, with its arguments, in
   * order. `postComment` really appends, so the machine's own words land on
   * the thread and are recorded — which is what proves the instrument can see
   * a write at all before it is used to say that none happened.
   */
  function recordingAdapter(comments: TicketThread["comments"]): {
    adapter: TicketingAdapter;
    calls: { call: string; args: unknown[] }[];
    thread: TicketThread["comments"];
  } {
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const thread = [...comments];
    const calls: { call: string; args: unknown[] }[] = [];
    let clock = 0;
    const record = (call: string, ...args: unknown[]): void => {
      calls.push({ call, args });
    };
    const adapter: TicketingAdapter = {
      // No initiative in this test is broken into step tickets.
      async listSteps(): Promise<Step[]> {
        return [];
      },
      async listMarkedTickets(): Promise<Ticket[]> {
        record("listMarkedTickets");
        return [base];
      },
      // An unmarked ticket beside the marked one, so the recorder below has
      // phase 20d's introduction to see as well as everything else the cycle
      // writes. Without it the instrument would be blind to the newest write
      // on the seam — which is the trap 20b left for 20c and 20c for 20d.
      async listOpenTickets(): Promise<Ticket[]> {
        record("listOpenTickets");
        return [base, ticket(5, { labels: [] })];
      },
      async getTicket(): Promise<TicketThread> {
        record("getTicket");
        return { ...base, comments: [...thread] };
      },
      async postComment(_project, number, body): Promise<void> {
        record("postComment", number, body);
        thread.push({
          author: "fvermaut",
          body: `${MACHINE_MARKER}\n\n---\n\n${body}`,
          createdAt: `2026-08-03T13:${String(clock++).padStart(2, "0")}:00Z`,
          fromTimone: true,
        });
      },
      async applyLabel(_project, number, label): Promise<void> {
        record("applyLabel", number, label);
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return undefined;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        throw new Error("no pull request exists in this test");
      },
      async postPullRequestComment(_project, number, body): Promise<void> {
        record("postPullRequestComment", number, body);
      },
      async upsertPullRequestComment(
        _project,
        number,
        marker,
        body,
      ): Promise<void> {
        record("upsertPullRequestComment", number, marker, body);
      },
      async upsertComment(_project, number, marker, body): Promise<void> {
        record("upsertComment", number, marker, body);
      },
      async closeTicket(_project, number, reason): Promise<void> {
        record("closeTicket", number, reason);
      },
    };
    return { adapter, calls, thread };
  }

  it("never writes to what the human wrote, only alongside it", async () => {
    // The answer is never destroyed — it is a comment on the ticket, permanent
    // and public, and only the machine's marker moves (ADR-0023). Asserted
    // against a recorder that demonstrably *does* see the machine's own post,
    // so "nothing was written" is an observation and not an empty log.
    const store = newStore();
    parkedOnConversation(store);
    const { adapter, calls, thread } = recordingAdapter([invitation, answer]);
    const before = { ...answer };
    const spawner = new AgentSessionSpawner({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      runtime: {
        async start() {
          return {
            sessionId: "session-2",
            completed: (async () => {
              await adapter.postComment(
                { name: "scratch-app", repoUrl: "https://github.com/fvermaut/scratch-app.git" },
                6,
                "and which of the two do they hit first?",
              );
              return { sessionId: "session-2", ok: true };
            })(),
          };
        },
      },
      root: "/nowhere",
    });

    await pollOnce({
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    });

    const writes = calls.filter((entry) => WRITES.includes(entry.call));
    // The instrument sees a write when there is one to see.
    expect(JSON.stringify(writes)).toContain("which of the two");
    // Including the newest one: the call to action this cycle reconciled onto
    // the same thread. Asserted rather than assumed — a recorder blind to a
    // write is a test that reports silence about it.
    expect(writes.map((entry) => entry.call)).toContain("upsertComment");
    // And phase 20d's introduction on the unmarked ticket beside it, for the
    // same reason: a write the instrument cannot see is a write this test
    // reports silence about.
    expect(JSON.stringify(writes)).toContain("add the `timone` label");
    // And not one of them carries the human's words anywhere.
    expect(
      writes.filter((entry) =>
        JSON.stringify(entry.args).includes("the draft they lose"),
      ),
    ).toEqual([]);
    // The comment is still on the thread, word for word, and still theirs.
    expect(thread.filter((comment) => comment.createdAt === before.createdAt)).toEqual([
      before,
    ]);
  });
});

describe("pollOnce — one read of one thread per parked run", () => {
  // Deciding whether a parked run's wait has ended, and deciding what to
  // resume it with, are two questions asked of one thread. Asking the tracker
  // twice doubles the latency of the decision and lets the two halves see
  // different threads — which is the shape of fault ADR-0023 closes.
  //
  // Both halves of each case are load-bearing: the count says the thread is
  // read once, and the decision says the cycle still reaches the answer it
  // reached when it read twice. A count on its own would pass on a loop that
  // decided nothing at all.

  const invitation = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\ntwo ways to answer this`,
    createdAt: "2026-08-03T10:00:00Z",
    fromTimone: true,
  };
  const answer = {
    author: "fvermaut",
    body: "the phone layout, and only on the long ones",
    createdAt: "2026-08-03T11:00:00Z",
    fromTimone: false,
  };

  it("reads the ticket once to resume a conversation, and resumes on the same words", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });

    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    let fetches = 0;
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        fetches += 1;
        return { ...base, comments: [invitation, answer] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    const contexts: (SpawnContext | undefined)[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(fetches).toBe(1);
    // The same session, on the same words, at the same stage …
    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts).toEqual([
      { stage: "clarification", feedback: answer.body },
    ]);
    // … and the same ledger write: the answer is still consumed (ADR-0023).
    expect(store.get("scratch-app#6/1")?.waitCursor).toBe(answer.createdAt);
  });

  it("reads the pull request once to resume a review, and resumes on the same words", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "delivery",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    let fetches = 0;
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      async findPullRequest(): Promise<PullRequest | undefined> {
        return undefined;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        fetches += 1;
        return {
          number: 9,
          title: "Fix the box",
          url: "https://github.com/fvermaut/scratch-app/pull/9",
          state: "open",
          headSha: "aaaaaaa",
          comments: [
            {
              author: "fvermaut",
              body: "Please rename this variable, it shadows the prop.",
              createdAt: "2026-08-06T12:00:00Z",
              fromTimone: false,
              replyTo: "501",
            },
          ],
        };
      },
      async postPullRequestComment(): Promise<void> {},
      async upsertPullRequestComment(): Promise<void> {},
      async upsertComment(): Promise<void> {},
      async closeTicket(): Promise<void> {},
    };
    const contexts: (SpawnContext | undefined)[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(fetches).toBe(1);
    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts).toEqual([
      {
        stage: "remediation",
        feedback: "Please rename this variable, it shadows the prop.",
      },
    ]);
    // A review park is not consumed, and the loop wrote nothing to the ledger.
    const after = store.get("scratch-app#6/1");
    expect(after?.status).toBe("parked");
    expect(after?.waitCursor).toBe("2026-08-06T10:00:00Z");
  });
});

describe("pollOnce — the call to action is reconciled each cycle", () => {
  // Every open ticket says what happens next, and the daemon repairs that
  // line rather than reporting it (ADR-0024). The whole risk of doing it
  // every cycle is saying it again when nothing has changed: an upsert issued
  // unconditionally is one comment edit per ticket per minute, which on a
  // client's tracker is a notification storm and a thread nobody can read.
  // So the guard is asserted first, and every case below counts calls on the
  // seam rather than reading the loop's shape.

  /** Every call on the seam whose effect a human can see. */
  const WRITE_CALLS = [
    "postComment",
    "upsertComment",
    "applyLabel",
    "closeTicket",
    "postPullRequestComment",
    "upsertPullRequestComment",
  ];

  interface SeamCall {
    call: string;
    number: number;
    body?: string;
  }

  const writesIn = (calls: readonly SeamCall[]): SeamCall[] =>
    calls.filter((entry) => WRITE_CALLS.includes(entry.call));

  /**
   * A ticketing fake with the write path a reconciler actually meets: an
   * upsert really replaces the machine's marked comment, or adds one where
   * there is none, so a later cycle reads back what an earlier one wrote.
   * A fake that dropped the write would let "a third cycle is silent again"
   * pass for the wrong reason.
   *
   * `listed` is the array the test holds, so a ticket can leave the listing
   * between cycles exactly as a closed one does.
   */
  function reconcilingAdapter(
    listed: Ticket[],
    seed: Record<number, TicketThread["comments"]> = {},
  ): {
    adapter: TicketingAdapter;
    calls: SeamCall[];
    unreadable: Set<number>;
    threadOf: (number: number) => TicketThread["comments"];
  } {
    const calls: SeamCall[] = [];
    const unreadable = new Set<number>();
    const threads = new Map<number, TicketThread["comments"]>(
      Object.entries(seed).map(([number, comments]) => [
        Number(number),
        [...comments],
      ]),
    );
    let clock = 0;
    const stamp = (body: string): string =>
      `${MACHINE_MARKER}\n\n---\n\n${body}`;
    const wrote = (body: string): TicketThread["comments"][number] => ({
      author: "fvermaut",
      body: stamp(body),
      createdAt: `2026-08-03T13:${String(clock++).padStart(2, "0")}:00Z`,
      fromTimone: true,
    });
    const thread = (number: number): TicketThread["comments"] => {
      const found = threads.get(number);
      if (found !== undefined) return found;
      const fresh: TicketThread["comments"] = [];
      threads.set(number, fresh);
      return fresh;
    };

    const adapter: TicketingAdapter = {
      // No initiative in this test is broken into step tickets.
      async listSteps(): Promise<Step[]> {
        return [];
      },
      async listMarkedTickets(): Promise<Ticket[]> {
        return [...listed];
      },
      // Everything listed here carries the mark, so the two listings agree and
      // no introduction is owed — these tests are about the standing call to
      // action, not about who Timone says hello to.
      async listOpenTickets(): Promise<Ticket[]> {
        return [...listed];
      },
      async getTicket(_project, number): Promise<TicketThread> {
        calls.push({ call: "getTicket", number });
        if (unreadable.has(number)) {
          throw new Error(`gh could not read issue ${number}`);
        }
        const base = listed.find((candidate) => candidate.number === number);
        return { ...(base ?? ticket(number)), comments: [...thread(number)] };
      },
      async postComment(_project, number, body): Promise<void> {
        calls.push({ call: "postComment", number, body });
        thread(number).push(wrote(body));
      },
      async upsertComment(_project, number, marker, body): Promise<void> {
        calls.push({ call: "upsertComment", number, body });
        const comments = thread(number);
        // The adapter's own identity rule: ours, carrying the marker, the
        // first such comment — and a fresh one when there is none.
        const existing = comments.find(
          (comment) => comment.fromTimone && comment.body.includes(marker),
        );
        if (existing === undefined) comments.push(wrote(body));
        else existing.body = stamp(body);
      },
      async applyLabel(_project, number, label): Promise<void> {
        calls.push({ call: "applyLabel", number, body: label });
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return undefined;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        throw new Error("no pull request exists in this test");
      },
      async postPullRequestComment(_project, number, body): Promise<void> {
        calls.push({ call: "postPullRequestComment", number, body });
      },
      async upsertPullRequestComment(
        _project,
        number,
        _marker,
        body,
      ): Promise<void> {
        calls.push({ call: "upsertPullRequestComment", number, body });
      },
      async closeTicket(_project, number, reason): Promise<void> {
        calls.push({ call: "closeTicket", number, body: reason });
      },
    };
    return { adapter, calls, unreadable, threadOf: thread };
  }

  /**
   * What ADR-0024's `scratch-app` #13 is owed, written out by hand rather
   * than computed — so a cycle that agrees with it agrees with something
   * other than itself.
   */
  const FAILED_CTA = [
    "**Something went wrong while I was working on this.**",
    "",
    "```",
    "timone retry scratch-app#7",
    "```",
    "",
    "**What I need from you:** run the command and I'll pick it up from where it stopped.",
  ].join("\n");

  /** A run of `scratch-app` #7 that stopped badly. */
  function failedRun(store: RunStore): void {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.fail(run.id, "the machine running it stopped");
  }

  it("writes nothing at all when every ticket already says the right thing", async () => {
    // The guard, asserted before anything is made to post: a cycle over a
    // ticket whose call to action is already true touches nothing. The
    // fixture is the comment the machine would have written, seeded by hand,
    // so this holds without a happy path having run first.
    const store = newStore();
    failedRun(store);
    const { adapter, calls } = reconcilingAdapter([ticket(7)], {
      7: [
        {
          author: "fvermaut",
          body: `${MACHINE_MARKER}\n\n---\n\n${CTA_MARKER}\n\n${FAILED_CTA}`,
          createdAt: "2026-08-03T12:00:00Z",
          fromTimone: true,
        },
      ],
    });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(writesIn(calls)).toEqual([]);
  });
  it("posts the call to action a ticket has never been given", async () => {
    const store = newStore();
    failedRun(store);
    const { adapter, calls } = reconcilingAdapter([ticket(7)]);
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    const upserts = calls.filter((entry) => entry.call === "upsertComment");
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.number).toBe(7);
    // The marker leads the body, because it is what the next cycle finds this
    // comment by; the words under it are the fixed example above.
    expect(upserts[0]?.body).toBe(`${CTA_MARKER}\n\n${FAILED_CTA}`);
  });
  it("edits once when the state changes, and says nothing on the cycle after", async () => {
    const store = newStore();
    const listed = [ticket(7)];
    const { adapter, calls } = reconcilingAdapter(listed);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    store.activate("scratch-app#7/1", "session-1");
    await pollOnce(deps);

    // The state moves under it: the session running this ticket stopped badly.
    store.fail("scratch-app#7/1", "the machine running it stopped");
    const before = calls.length;
    await pollOnce(deps);

    const edits = writesIn(calls.slice(before));
    expect(edits).toHaveLength(1);
    expect(edits[0]?.call).toBe("upsertComment");
    expect(edits[0]?.body).toBe(`${CTA_MARKER}\n\n${FAILED_CTA}`);

    // And the cycle after it, with nothing changed, is silent again.
    const settled = calls.length;
    await pollOnce(deps);
    expect(writesIn(calls.slice(settled))).toEqual([]);
  });
  it("refreshes a ticket whose blocker closed, with nothing run by hand", async () => {
    // ADR-0024's rule replacing a session's good manners: the ticket waiting
    // behind another is brought up to date because a cycle ran, not because
    // whoever finished the first one remembered it.
    const store = newStore();
    const listed = [ticket(7), ticket(8)];
    const { adapter, calls, threadOf } = reconcilingAdapter(listed);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    store.activate("scratch-app#7/1", "session-1");
    await pollOnce(deps);
    expect(
      calls.find((entry) => entry.call === "upsertComment" && entry.number === 8)
        ?.body,
    ).toContain("**This one is in the queue.**");

    // #7's work finished and its ticket closed, so it leaves the listing —
    // and nothing else happens: no command is run, no session is started.
    store.complete("scratch-app#7/1");
    listed.splice(0, 1);
    const before = calls.length;
    await pollOnce(deps);

    const edits = writesIn(calls.slice(before));
    expect(edits).toHaveLength(1);
    expect(edits[0]?.number).toBe(8);
    expect(edits[0]?.body).toContain("**Picked this up.**");
    // Revised where it stood, not repeated under itself.
    expect(
      threadOf(8).filter((comment) => comment.body.includes(CTA_MARKER)),
    ).toHaveLength(1);
  });

  it("does not take a human's quotation of the marker for its own last word", async () => {
    // Timone comments under the human's own account, so the marker alone
    // cannot tell the two apart — `upsertComment` edits the first comment
    // that is *ours* and carries it. A guard reading the thread by any other
    // rule would compare against a comment the upsert would never touch and
    // so find a difference on every cycle for ever, which is the storm the
    // guard exists to prevent.
    const store = newStore();
    failedRun(store);
    const { adapter, calls } = reconcilingAdapter([ticket(7)], {
      7: [
        {
          author: "fvermaut",
          body: `${CTA_MARKER}\n\n${FAILED_CTA}\n\nis this still what you need from me?`,
          createdAt: "2026-08-03T11:00:00Z",
          fromTimone: false,
        },
        {
          author: "fvermaut",
          body: `${MACHINE_MARKER}\n\n---\n\n${CTA_MARKER}\n\n${FAILED_CTA}`,
          createdAt: "2026-08-03T12:00:00Z",
          fromTimone: true,
        },
      ],
    });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(writesIn(calls)).toEqual([]);
  });

  it("does not repeat, under its marker, an acknowledgement it has just posted", async () => {
    // `pickedUpComment` ends on the very line the call to action is made of,
    // so posting the standing copy seconds later would be two near-identical
    // comments in one cycle.
    const store = newStore();
    const { adapter, calls } = reconcilingAdapter([ticket(7)]);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);

    const acknowledgement = writesIn(calls);
    expect(acknowledgement).toHaveLength(1);
    expect(acknowledgement[0]?.call).toBe("postComment");

    // The standing copy lands on the next cycle instead.
    store.activate("scratch-app#7/1", "session-1");
    const before = calls.length;
    await pollOnce(deps);
    const standing = writesIn(calls.slice(before));
    expect(standing).toHaveLength(1);
    expect(standing[0]?.call).toBe("upsertComment");
  });

  it("carries on to the next ticket when one ticket's thread cannot be read", async () => {
    const store = newStore();
    failedRun(store);
    const second = store.register("scratch-app", 8).run;
    store.activate(second.id, "session-2");
    store.fail(second.id, "the machine running it stopped");
    const { adapter, calls, unreadable } = reconcilingAdapter([
      ticket(7),
      ticket(8),
    ]);
    unreadable.add(7);
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/#7/);
    expect(
      calls
        .filter((entry) => entry.call === "upsertComment")
        .map((entry) => entry.number),
    ).toEqual([8]);
  });
  it("is not fooled into writing by line endings it did not choose", async () => {
    // The guard fails open — silently, and into the storm it exists to
    // prevent — if the thread hands back the same words in a different shape.
    // A tracker that stores CRLF, or a maintainer who edited the comment in a
    // browser, must not make every cycle find a difference.
    const store = newStore();
    failedRun(store);
    const posted = `${MACHINE_MARKER}\n\n---\n\n${CTA_MARKER}\n\n${FAILED_CTA}`;
    const { adapter, calls } = reconcilingAdapter([ticket(7)], {
      7: [
        {
          author: "fvermaut",
          body: `${posted.replace(/\n/g, "\r\n")}\r\n`,
          createdAt: "2026-08-03T12:00:00Z",
          fromTimone: true,
        },
      ],
    });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(writesIn(calls)).toEqual([]);
  });
});

describe("pollOnce — an unmarked ticket is introduced to, once", () => {
  // ADR-0024's second ruling: the `timone` label stops being the boundary of
  // what Timone will *say* and remains the boundary of what it will *do*. The
  // ticket this exists for is `scratch-app` #5 — "can I get a dark mode?",
  // filed 2026-08-03 without the label and silent ever since, with nothing on
  // it explaining why.
  //
  // Two properties, and the second is the one that must never break: an
  // unmarked ticket receives exactly one comment, ever, and **never a run**.
  // PRD-02.R1's surviving clause is that second one, and it is asserted here
  // as a regression test rather than assumed from the shape of the loop.

  /** Every call on the seam whose effect a human can see. */
  const WRITE_CALLS = [
    "postComment",
    "upsertComment",
    "applyLabel",
    "closeTicket",
    "postPullRequestComment",
    "upsertPullRequestComment",
  ];

  interface SeamCall {
    call: string;
    number: number;
    body?: string;
    /** Which project was spoken to, where the call says (a comment does). */
    project?: string;
  }

  const writesIn = (calls: readonly SeamCall[]): SeamCall[] =>
    calls.filter((entry) => WRITE_CALLS.includes(entry.call));

  const writesOn = (calls: readonly SeamCall[], number: number): SeamCall[] =>
    writesIn(calls).filter((entry) => entry.number === number);

  /**
   * A fake with the two listings the loop now makes: what carries the mark,
   * and what is simply open. The marked listing is derived from the open one
   * by the label, exactly as the tracker derives it, so a test cannot set up
   * a project where the two disagree about a ticket's labels.
   *
   * `open` is the array the test holds, so a ticket can gain the label between
   * cycles exactly as a human's edit does.
   */
  function twoListings(open: Ticket[]): {
    adapter: TicketingAdapter;
    calls: SeamCall[];
  } {
    const calls: SeamCall[] = [];
    const threads = new Map<number, TicketThread["comments"]>();
    let clock = 0;
    const thread = (number: number): TicketThread["comments"] => {
      const found = threads.get(number);
      if (found !== undefined) return found;
      const fresh: TicketThread["comments"] = [];
      threads.set(number, fresh);
      return fresh;
    };
    const stamp = (body: string): string =>
      `${MACHINE_MARKER}\n\n---\n\n${body}`;

    const adapter: TicketingAdapter = {
      // No initiative in this test is broken into step tickets.
      async listSteps(): Promise<Step[]> {
        return [];
      },
      async listMarkedTickets(): Promise<Ticket[]> {
        return open.filter((candidate) => candidate.labels.includes("timone"));
      },
      async listOpenTickets(): Promise<Ticket[]> {
        return [...open];
      },
      async getTicket(_project, number): Promise<TicketThread> {
        calls.push({ call: "getTicket", number });
        const base = open.find((candidate) => candidate.number === number);
        return { ...(base ?? ticket(number)), comments: [...thread(number)] };
      },
      async postComment(project, number, body): Promise<void> {
        calls.push({ call: "postComment", number, body, project: project.name });
        thread(number).push({
          author: "fvermaut",
          body: stamp(body),
          createdAt: `2026-08-03T13:${String(clock++).padStart(2, "0")}:00Z`,
          fromTimone: true,
        });
      },
      async upsertComment(_project, number, marker, body): Promise<void> {
        calls.push({ call: "upsertComment", number, body });
        const comments = thread(number);
        const existing = comments.find(
          (comment) => comment.fromTimone && comment.body.includes(marker),
        );
        if (existing === undefined) {
          comments.push({
            author: "fvermaut",
            body: stamp(body),
            createdAt: `2026-08-03T13:${String(clock++).padStart(2, "0")}:00Z`,
            fromTimone: true,
          });
        } else {
          existing.body = stamp(body);
        }
      },
      async applyLabel(_project, number, label): Promise<void> {
        calls.push({ call: "applyLabel", number, body: label });
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return undefined;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        throw new Error("no pull request exists in this test");
      },
      async postPullRequestComment(_project, number, body): Promise<void> {
        calls.push({ call: "postPullRequestComment", number, body });
      },
      async upsertPullRequestComment(
        _project,
        number,
        _marker,
        body,
      ): Promise<void> {
        calls.push({ call: "upsertPullRequestComment", number, body });
      },
      async closeTicket(_project, number, reason): Promise<void> {
        calls.push({ call: "closeTicket", number, body: reason });
      },
    };
    return { adapter, calls };
  }

  it("creates no run for a ticket that does not carry the mark", async () => {
    // PRD-02.R1, second criterion, re-verified rather than amended: its
    // criterion forbids a *run* on an unmarked issue and has never forbidden a
    // comment. Speaking to an unmarked ticket is what this slice adds; working
    // one is what it must never do, and this is the assertion that says so.
    const store = newStore();
    const { adapter } = twoListings([
      ticket(5, { labels: [] }),
      ticket(7),
    ]);
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    };

    const first = await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    expect(store.all().map((run) => run.id)).toEqual(["scratch-app#7/1"]);
    expect(store.get("scratch-app#5/1")).toBeUndefined();
    expect(first.pickedUp).toEqual(["scratch-app#7/1"]);
    // And no session was ever started on it either — a run is what a spawn
    // needs, so this cannot fail on its own, but it is the consequence R1 is
    // actually about and it costs one line to say so.
    expect(spawned.filter((run) => run.ticket === 5)).toEqual([]);
  });

  it("introduces itself exactly once across three cycles", async () => {
    // Three and not two: a bug that posts on cycles 1 and 3 but not 2 passes
    // a two-cycle test, and "exactly once for the life of the daemon" is the
    // whole promise. Counted on the seam rather than in the thread.
    const store = newStore();
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    const said = writesOn(calls, 5);
    expect(said).toHaveLength(1);
    expect(said[0]?.call).toBe("postComment");
  });

  it("names the label that would hand the ticket over, and ends on the ask", async () => {
    // The point of speaking at all: a human looking at a silent ticket has no
    // way of knowing what to do, so the one thing the comment must contain is
    // the exact label. Hand-written here rather than composed from the same
    // function the loop composes it with.
    const store = newStore();
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    });

    const body = writesOn(calls, 5)[0]?.body ?? "";
    expect(body).toContain("add the `timone` label");
    expect(body.trimEnd().split("\n").at(-1)).toBe(
      "**What I need from you:** nothing — add the `timone` label if you would like me to pick this up.",
    );
  });

  it("leaves a marked ticket to the path it already had", async () => {
    // The negative half, and the one that protects everything built before
    // this: a ticket carrying the mark is acknowledged, run and given its
    // standing call to action exactly as it was, and is never introduced to.
    const store = newStore();
    const { adapter, calls } = twoListings([
      ticket(5, { labels: [] }),
      ticket(7),
    ]);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    await pollOnce(deps);

    const saidOnSeven = writesOn(calls, 7);
    expect(saidOnSeven.map((entry) => entry.call)).toEqual([
      "postComment",
      "upsertComment",
    ]);
    expect(saidOnSeven[0]?.body).toContain("**Picked this up.**");
    expect(saidOnSeven[1]?.body).toContain(CTA_MARKER);
    for (const entry of saidOnSeven) {
      expect(entry.body).not.toContain("this repository is worked by a machine");
    }
  });

  it("holds its peace once the label lands, without ever having been given a run", async () => {
    // The transition a human actually makes: they read the introduction and
    // add the label. From that cycle on the ticket is an ordinary marked one
    // — and the introduction, having been posted once, is not repeated when
    // the ticket loses the label again.
    //
    // Since 22b the third cycle also *abandons* the run: a ticket that has
    // left the marked-and-open listing is one nobody is asking Timone to work,
    // and the loop cancels rather than spawning on it. The introduction still
    // stays unrepeated, which is what this test is about — a cancelled run is
    // still a run, so `introduceUnmarked` keeps its peace.
    const store = newStore();
    const open = [ticket(5, { labels: [] })];
    const { adapter, calls } = twoListings(open);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    open[0] = ticket(5, { labels: ["timone"] });
    await pollOnce(deps);
    open[0] = ticket(5, { labels: [] });
    const before = calls.length;
    await pollOnce(deps);

    expect(store.get("scratch-app#5/1")?.status).toBe("cancelled");
    expect(
      writesOn(calls, 5).filter((entry) => entry.call === "postComment"),
    ).toHaveLength(2);
    expect(writesIn(calls.slice(before))).toEqual([]);
  });

  it("says nothing on an unmarked ticket it is already working, and everything on one it is not", async () => {
    // 20g: `timone takeover` now creates a run from the tracker for an open
    // ticket that has none, and it deliberately does **not** apply the label —
    // applying it fails outright on a repository onboarded before the label
    // existed, which is the case ADR-0024 exists to rescue. So an unmarked
    // ticket can now have a run, and telling its human to "add the `timone`
    // label if you would like me to pick this up" while a session is open on
    // it is a ticket lying about its own state — the one thing this phase
    // exists to abolish.
    //
    // The control beside it is half the point: #6 has no run and must still
    // get its introduction, or the fix has silenced 20d rather than corrected
    // it.
    const store = newStore();
    const enrolled = store.register("scratch-app", 5).run;
    store.park(enrolled.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "wayfinding",
      waitCursor: "2026-08-03T12:00:00Z",
    });
    const { adapter, calls } = twoListings([
      ticket(5, { labels: [] }),
      ticket(6, { labels: [] }),
    ]);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    expect(writesOn(calls, 5)).toEqual([]);
    expect(store.introducedAt("scratch-app", 5)).toBeUndefined();

    const saidOnSix = writesOn(calls, 6);
    expect(saidOnSix).toHaveLength(1);
    expect(saidOnSix[0]?.body).toContain("add the `timone` label");
  });

  it("asks the ledger whether it has said hello, never the ticket's thread", async () => {
    // Exactly-once is *recorded*, not inferred (ADR-0024). A store that
    // already holds the record keeps the machine quiet even though the thread
    // is empty — which is the discriminating case: a loop reading the thread
    // to decide would see nothing there and post.
    const store = newStore();
    store.recordIntroduction("scratch-app", 5);
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter,
      spawner,
    });

    expect(writesIn(calls)).toEqual([]);
    // And it did not read the thread to find that out, either.
    expect(calls.filter((entry) => entry.call === "getTicket")).toEqual([]);
  });

  it("writes the record down before it speaks, so a failed post is never a second comment", async () => {
    // The asymmetry the ordering is chosen on: a post that fails after the
    // record leaves one ticket unspoken-to and one line in `errors`, while a
    // record written after a successful post would put a second introduction
    // on a client's ticket the moment anything crashed between the two.
    const store = newStore();
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { spawner } = fakeSpawner();
    const failing: TicketingAdapter = {
      ...adapter,
      async postComment(): Promise<void> {
        throw new Error("gh could not comment on issue 5");
      },
    };
    const deps = {
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter: failing,
      spawner,
    };

    const first = await pollOnce(deps);

    expect(first.errors).toHaveLength(1);
    expect(first.errors[0]).toMatch(/#5/);
    expect(store.introducedAt("scratch-app", 5)).toBeDefined();

    // The next cycle stays quiet rather than trying again, which is the price
    // of the ordering and is paid deliberately.
    const second = await pollOnce({ ...deps, adapter });
    expect(second.errors).toEqual([]);
    expect(writesIn(calls)).toEqual([]);
  });

  it("costs the project nothing else in the cycle when the open listing fails", async () => {
    // The new listing is a `gh` call that can fail on its own — a rate limit,
    // a large repository — and it is the last thing a project's turn does.
    // Letting it escape would take the project's preview reconciliation with
    // it, so a repository Timone cannot enumerate would also stop telling
    // reviewers where to look. That is a bigger consequence than the fault.
    const store = newStore();
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
    });
    const { previews, ensured } = fakePreviews();
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: introducing(manifestWithPreviews("scratch-app")),
      store,
      adapter: {
        ...adapter,
        async listOpenTickets(): Promise<Ticket[]> {
          throw new Error("gh could not list the open issues");
        },
      },
      spawner,
      previews,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/could not list the open issues/);
    expect(ensured).toHaveLength(1);
    expect(upserts).toHaveLength(1);
  });

  it("says nothing at all on a project that has not asked for introductions", async () => {
    // ADR-0024's restraint, and the whole of it: the per-project switch
    // defaults off, and *absent* is what off means — a manifest entry written
    // before this existed asks for nothing and gets nothing. A repository
    // onboarded with two hundred open issues would otherwise meet Timone two
    // hundred times in its first cycle, which the ADR calls a worse first
    // impression than silence.
    const store = newStore();
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    let listings = 0;
    const counted: TicketingAdapter = {
      ...adapter,
      async listOpenTickets(project: TicketingProject): Promise<Ticket[]> {
        listings += 1;
        return adapter.listOpenTickets(project);
      },
    };
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter: counted,
      spawner,
    };

    await pollOnce(deps);
    await pollOnce(deps);

    expect(writesIn(calls)).toEqual([]);
    expect(store.introducedAt("scratch-app", 5)).toBeUndefined();
    // And the tracker was never asked either. A project with introductions off
    // does not pay for a listing it would then throw away — the same shape
    // `reconcilePreviews` uses for a project with no preview binding.
    expect(listings).toBe(0);
  });

  it("speaks on the project that asked and stays silent on the one beside it", async () => {
    // The switch is *per project*, which is the half a single-project test
    // cannot show: one cycle, one daemon, one adapter and two repositories
    // whose only difference is the switch. Exactly one introduction is posted
    // and it names which repository got it, so the pair cannot pass by the
    // behaviour being globally on or globally off.
    const store = newStore();
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { spawner } = fakeSpawner();
    const both = manifestWith("quiet-app", "chatty-app");

    await pollOnce({
      manifest: {
        projects: {
          "quiet-app": both.projects["quiet-app"]!,
          "chatty-app": {
            ...both.projects["chatty-app"]!,
            introduce_unmarked: true,
          },
        },
      },
      store,
      adapter,
      spawner,
    });

    const said = writesIn(calls);
    expect(said).toHaveLength(1);
    expect(said[0]?.project).toBe("chatty-app");
    expect(said[0]?.body).toContain("add the `timone` label");
    expect(store.introducedAt("chatty-app", 5)).toBeDefined();
    expect(store.introducedAt("quiet-app", 5)).toBeUndefined();
  });

  it("carries on to the next ticket when one introduction cannot be posted", async () => {
    const store = newStore();
    const { adapter, calls } = twoListings([
      ticket(5, { labels: [] }),
      ticket(6, { labels: [] }),
    ]);
    const { spawner } = fakeSpawner();
    const failing: TicketingAdapter = {
      ...adapter,
      async postComment(project, number, body): Promise<void> {
        if (number === 5) throw new Error("gh could not comment on issue 5");
        await adapter.postComment(project, number, body);
      },
    };

    const result = await pollOnce({
      manifest: introducing(manifestWith("scratch-app")),
      store,
      adapter: failing,
      spawner,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/#5/);
    expect(writesOn(calls, 6)).toHaveLength(1);
  });
});

describe("pollOnce — the wayfinder map is a ticket of its own", () => {
  // ADR-0024's fourth ruling, and the ticket the whole phase started from:
  // `ivtrends` #1 closed its last question, the machine said "nothing right
  // now", fvermaut replied **"ok go ahead and write the spec"** — and nothing
  // happened, because the map was unmarked and `wayfinding` had no `next`.
  //
  // The map is now marked at creation and enters a stage of its own. Its two
  // states are the whole of the behaviour: while its own questions are open
  // it asks for nothing and starts nothing; once its frontier is empty it
  // asks for the go-ahead, and a comment agreeing runs stage 3 on this run.

  const MAP = 1;

  const closingSummary = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\nthat was the last question — here is the route we walked`,
    createdAt: "2026-08-13T09:00:00Z",
    fromTimone: true,
  };

  const goAhead = {
    author: "fvermaut",
    body: "ok go ahead and write the spec",
    createdAt: "2026-08-13T09:30:00Z",
    fromTimone: false,
  };

  /**
   * The tracker as a map effort leaves it: one `wayfinder:map` ticket
   * carrying the mark, whatever the thread holds, and whatever else is open.
   *
   * `labels` is the array the test holds, so the frontier can empty between
   * two cycles exactly as the closing session's `gh` call empties it.
   */
  function mapWorld(
    comments: TicketThread["comments"],
    labels: string[],
    others: Ticket[] = [],
  ): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
    ctas: PostedComment[];
    reads: number[];
  } {
    const posted: PostedComment[] = [];
    const ctas: PostedComment[] = [];
    const reads: number[] = [];
    const map = (): Ticket =>
      ticket(MAP, { title: "chart the trends redesign", labels });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [map(), ...others];
      },
      ...noOtherListings,
      async getTicket(_project, number): Promise<TicketThread> {
        reads.push(number);
        if (number === MAP) return { ...map(), comments };
        const other = others.find((candidate) => candidate.number === number);
        if (other === undefined) throw new Error(`no ticket ${number}`);
        return { ...other, comments: [] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
      async upsertComment(project, number, _marker, body): Promise<void> {
        ctas.push({ project: project.name, number, body });
      },
    };
    return { adapter, posted, ctas, reads };
  }

  /**
   * The real spawner, whose runtime throws: nothing may start a session for a
   * map that is still being worked, and a fake spawner could only restate the
   * half of that claim living in `poll.ts`.
   */
  function refusingSpawner(
    store: RunStore,
    adapter: TicketingAdapter,
  ): SessionSpawner {
    return new AgentSessionSpawner({
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      runtime: {
        async start() {
          throw new Error("no session may start for a map");
        },
      },
      root: "/nowhere",
    });
  }

  it("stops on the map without asking the human for anything", async () => {
    // R21 clause 4, the CTA half. A map with an open frontier is not waiting
    // on a human, so it must not be told it is — and it must not be sent the
    // invitation every *other* conversation stage opens, which would be a
    // question on a ticket nobody can answer yet.
    const store = newStore();
    const { adapter, posted, ctas } = mapWorld([], ["timone", "wayfinder:map"]);
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: refusingSpawner(store, adapter),
    };

    await pollOnce(deps);
    await pollOnce(deps);

    const run = store.get("ivtrends#1/1");
    expect(run?.stage).toBe("charting");
    expect(run?.status).toBe("parked");
    expect(run?.waitingKind).toBeUndefined();
    expect(run?.branch).toBeUndefined();
    expect(posted.map((comment) => comment.body).join("\n")).not.toMatch(
      /two ways to answer/i,
    );
    expect(ctas.at(-1)?.body).toContain(
      "**What I need from you:** nothing right now — I'll come back here when the last one is closed.",
    );
  });

  it("starts nothing on a map whose questions are still open", async () => {
    // R21 clause 4's other half — *a map does not advance on a single
    // answer*. Somebody has written on the map, as people do; the frontier is
    // not empty, so nothing about that comment moves anything.
    const store = newStore();
    const { adapter, ctas } = mapWorld(
      [closingSummary, goAhead],
      ["timone", "wayfinder:map"],
    );
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: refusingSpawner(store, adapter),
    };

    await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(second.resumed).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(store.get("ivtrends#1/1")?.stage).toBe("charting");
    expect(store.get("ivtrends#1/1")?.waitingKind).toBeUndefined();
    expect(ctas.at(-1)?.body).toContain("nothing right now");
  });

  it("asks for the go-ahead once the map's frontier is empty", async () => {
    // R21 clause 5, the CTA half. The closing session emptied the frontier;
    // the next cycle opens the wait and the standing call to action — one
    // computation, the same `ctaFor` every other ticket reads — flips.
    const store = newStore();
    const labels = ["timone", "wayfinder:map"];
    const { adapter, ctas, reads } = mapWorld([closingSummary], labels);
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: refusingSpawner(store, adapter),
    };

    await pollOnce(deps);
    // The discriminating half: before the frontier empties this map is
    // waiting on nobody, so the flip below is caused by the label and not by
    // the map having been a conversation all along.
    expect(store.get("ivtrends#1/1")?.waitingKind).toBeUndefined();

    labels.push("wayfinder:frontier-empty");
    reads.length = 0;
    await pollOnce(deps);

    // 19d's property, unbroken: opening the wait, deciding whether it has
    // been answered and reconciling the call to action are three questions
    // about one thread, and they are asked of one fetch of it.
    expect(reads).toEqual([1]);
    const run = store.get("ivtrends#1/1");
    expect(run?.status).toBe("parked");
    expect(run?.waitingKind).toBe("conversation");
    // Asked *now*, from the machine's last word — so nothing said before the
    // way was clear can be read as agreeing to it.
    expect(run?.waitCursor).toBe(closingSummary.createdAt);
    expect(ctas.at(-1)?.body).toContain(
      "**What I need from you:** say go ahead here and I'll write the specification this map has been finding its way to.",
    );
    // And no command: `timone takeover` cannot hold this stage's conversation.
    expect(ctas.at(-1)?.body).not.toContain("timone takeover");
  });

  it("refuses the go-ahead on a map that has grown a question back", async () => {
    // Resolving a ticket clears fog, and fog graduates into fresh tickets —
    // so a map can look finished and then not be. The wait is opened once and
    // never withdrawn (a question the human may be mid-answer on), which is
    // exactly why the frontier is checked again where it matters: at the
    // branch that starts a build.
    const store = newStore();
    const comments = [closingSummary];
    const labels = ["timone", "wayfinder:map"];
    const { adapter } = mapWorld(comments, labels);
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: refusingSpawner(store, adapter),
    };

    await pollOnce(deps);
    labels.push("wayfinder:frontier-empty");
    await pollOnce(deps);
    expect(store.get("ivtrends#1/1")?.waitingKind).toBe("conversation");

    labels.splice(labels.indexOf("wayfinder:frontier-empty"), 1);
    comments.push(goAhead);
    const third = await pollOnce(deps);

    expect(third.resumed).toEqual([]);
    expect(third.errors).toEqual([]);
    expect(store.get("ivtrends#1/1")?.stage).toBe("charting");
  });

  it("never asks a map's second piece for the go-ahead again", async () => {
    // timone#21, end to end and through the real spawner, because the failure
    // was the loop and the spawner agreeing: chunk 2 entered at `charting`,
    // the spawner parked it there with no wait, and the frontier label — which
    // nothing ever takes off a map — had the next cycle park it on the
    // go-ahead question. On `ivtrends` #1 that stopped an initiative of
    // fourteen pieces after the first one, and it never recovered.
    const store = newStore();
    const labels = ["timone", "wayfinder:map", "wayfinder:frontier-empty"];
    // The thread as a map in flight actually holds it: the go-ahead was given
    // a day ago and the machine has spoken since, so nothing after the wait
    // cursor a re-asked question would open can ever answer it. That is why
    // the real one never recovered.
    const pieceOneShipped = {
      author: "fvermaut",
      body: `${MACHINE_MARKER}\n\npiece 1 of 14 is merged`,
      createdAt: "2026-08-14T07:02:00Z",
      fromTimone: true,
    };
    const { adapter } = mapWorld(
      [closingSummary, goAhead, pieceOneShipped],
      labels,
    );

    // The map already did the thing its stage exists for: it was given the
    // go-ahead, wrote the specification and delivered its first piece.
    const { run: first } = store.register("ivtrends", MAP);
    store.activate(first.id, "s1");
    store.claimBranch(first.id, "timone/1-chunk-1");
    store.recordPullRequest(first.id, 9);
    store.complete(first.id);
    const { run: second } = store.register("ivtrends", MAP);
    expect(second.seq).toBe(2);

    const prompts: string[] = [];
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: new AgentSessionSpawner({
        manifest: manifestWith("ivtrends"),
        store,
        adapter,
        runtime: {
          async start(request) {
            prompts.push(request.prompt);
            return {
              sessionId: "session-plan",
              completed: Promise.resolve({ sessionId: "session-plan", ok: true }),
            };
          },
        },
        root: "/nowhere",
      }),
    };

    await pollOnce(deps);
    await pollOnce(deps);

    const chunk = store.get("ivtrends#1/2");
    expect(chunk?.stage).not.toBe("charting");
    expect(chunk?.waitingOn ?? "").not.toMatch(/go-ahead/);
    // And it did the one thing the stuck chunk never did: it ran.
    expect(prompts).not.toHaveLength(0);
  });
});

describe("pollOnce — a written go-ahead on a map starts stage 3", () => {
  // R21 clause 5's second half, and the sentence this phase exists for:
  // *"ok go ahead and write the spec"*, written on the map, with nothing run
  // by hand. The spawner is the real one over a recording runtime, because
  // "stage 3 starts on the map's own run" is a claim about the loop, the
  // stage graph and the spawner together — a fake spawner could only restate
  // the third of it that lives in `poll.ts`.

  const MAP = 1;

  const closingSummary = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\nthat was the last question — here is the route we walked`,
    createdAt: "2026-08-13T09:00:00Z",
    fromTimone: true,
  };

  const goAhead = {
    author: "fvermaut",
    body: "ok go ahead and write the spec",
    createdAt: "2026-08-13T09:30:00Z",
    fromTimone: false,
  };

  /** A map whose frontier is empty and whose human has agreed, plus room for
   * a second ticket to arrive on the project later. */
  function world(): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
    others: Ticket[];
    labels: string[];
  } {
    const posted: PostedComment[] = [];
    const others: Ticket[] = [];
    const labels = ["timone", "wayfinder:map", "wayfinder:frontier-empty"];
    const map = (): Ticket =>
      ticket(MAP, { title: "chart the trends redesign", labels });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [map(), ...others];
      },
      ...noOtherListings,
      async getTicket(_project, number): Promise<TicketThread> {
        if (number === MAP) {
          return { ...map(), comments: [closingSummary, goAhead] };
        }
        const other = others.find((candidate) => candidate.number === number);
        if (other === undefined) throw new Error(`no ticket ${number}`);
        return { ...other, comments: [] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
      async upsertComment(): Promise<void> {},
    };
    return { adapter, posted, others, labels };
  }

  /**
   * The real spawner over a runtime that records its prompt, and probes that
   * report a branch which moved — so the requirements stage's own gate is
   * reached rather than its "you committed nothing" refusal.
   */
  function realSpawner(
    store: RunStore,
    adapter: TicketingAdapter,
    prompts: string[],
  ): SessionSpawner {
    let commits = 0;
    return new AgentSessionSpawner({
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      runtime: {
        async start(request) {
          prompts.push(request.prompt);
          return {
            sessionId: "session-prd",
            completed: Promise.resolve({ sessionId: "session-prd", ok: true }),
          };
        },
      },
      root: "/nowhere",
      repoProbe: async () => `sha-${commits++}`,
      headProbe: async () => "sha-root",
    });
  }

  it("runs the specification stage on the map's own run, unprompted", async () => {
    const store = newStore();
    const { adapter } = world();
    const prompts: string[] = [];
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: realSpawner(store, adapter, prompts),
    };

    await pollOnce(deps);
    const second = await pollOnce(deps);

    // One run, the map's own — not a new one, and not a decision ticket's.
    expect(second.resumed).toEqual(["ivtrends#1/1"]);
    expect(store.all().map((run) => run.id)).toEqual(["ivtrends#1/1"]);
    const run = store.get("ivtrends#1/1");
    expect(run?.stage).toBe("requirements");
    // Instructed with what they actually wrote, so the specification session
    // reads the agreement rather than being told one happened.
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("ok go ahead and write the spec");
  });

  it("holds the whole project from the moment the go-ahead lands", async () => {
    // ADR-0024's consequence, asserted rather than assumed: stage 3 owns a
    // branch and runs serialize per project, so the map ticket holds
    // `ivtrends` against every other ticket until the specification is done.
    // A map ticket has never held anything before this.
    const store = newStore();
    const { adapter, posted, others } = world();
    const deps = {
      manifest: manifestWith("ivtrends"),
      store,
      adapter,
      spawner: realSpawner(store, adapter, []),
    };

    await pollOnce(deps);
    await pollOnce(deps);
    others.push(ticket(2, { title: "the header wraps on mobile" }));
    await pollOnce(deps);

    expect(store.occupyingRun("ivtrends")?.ticket).toBe(MAP);
    expect(store.get("ivtrends#1/1")?.branch).toBe(
      "timone/1-chart-the-trends-redesign",
    );
    expect(store.get("ivtrends#2/1")?.status).toBe("queued");
    expect(posted.find((comment) => comment.number === 2)?.body).toMatch(/#1/);
  });
});

/**
 * Chunk succession: what happens to a ticket when one of its chunks merges.
 *
 * A ticket is a conversation and a run is one chunk of it (ADR-0026), so a
 * merged pull request is the end of a *piece* and only sometimes the end of
 * the initiative. What decides which is the breakdown — the list of pieces the
 * human approved, on the project's default branch (ADR-0028 D1) — read against
 * how many of them the ledger has finished. Nothing is ever written back into
 * it (ADR-0030 D4).
 */
describe("pollOnce — a ticket's next chunk", () => {
  /**
   * A workspace root holding `scratch-app`'s checkout, with `body` written as
   * ticket 6's breakdown — or with no breakdown at all when `body` is absent,
   * which is what a chore's ticket looks like (ADR-0030 D3).
   */
  function rootWith(body?: string): string {
    const root = mkdtempSync(join(tmpdir(), "timone-root-"));
    tempDirs.push(root);
    if (body !== undefined) {
      const file = join(root, "projects", "scratch-app", breakdownPath(6));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, body, "utf8");
    }
    return root;
  }

  /**
   * The artifact as a stage session writes it, spelled out rather than
   * rendered: this is the file the poll loop meets on disk, and a fixture
   * built by the module under test could not catch the two drifting apart.
   *
   * `pieces` is the count the *stamp* names, which is what a re-proposal
   * differs from (ADR-0028 D3) — it defaults to the length of the list, so a
   * test that says nothing about it gets a breakdown nobody has re-proposed.
   */
  function breakdown(titles: string[], pieces = titles.length): string {
    return [
      "# Breakdown",
      "",
      `**Status:** Approved by fvermaut 2026-08-15 — ${pieces} pieces`,
      "",
      ...titles.map(
        (title, index) => `${index + 1}. **${title}** — what this piece delivers.`,
      ),
      "",
    ].join("\n");
  }

  /** Chunk `seq` of ticket 6, finished on a merged pull request `pr`. */
  function chunkDone(store: RunStore, seq: number, pr: number): Run {
    const { run } = store.register("scratch-app", 6);
    expect(run.seq).toBe(seq);
    store.activate(run.id, `s${seq}`);
    store.claimBranch(run.id, `timone/6-chunk-${seq}`);
    store.recordPullRequest(run.id, pr);
    return store.complete(run.id);
  }

  /** Chunk `seq` of ticket 6, parked waiting on the review of `pr`. */
  function chunkOnReview(store: RunStore, seq: number, pr: number): Run {
    const { run } = store.register("scratch-app", 6);
    expect(run.seq).toBe(seq);
    store.activate(run.id, `s${seq}`);
    store.claimBranch(run.id, `timone/6-chunk-${seq}`);
    store.recordPullRequest(run.id, pr);
    return store.park(run.id, {
      waitingOn: `your review of pull request #${pr}`,
      kind: "review",
      stage: "delivery",
      waitCursor: "2026-08-06T10:00:00Z",
    });
  }

  /**
   * An adapter over ticket 6 and whatever else is marked, whose pull requests
   * answer from `states`. Every comment posted and every close is recorded.
   *
   * `labels` is what ticket 6 carries — a triaged feature unless a test needs
   * the labels themselves to be the question.
   */
  function successionAdapter(
    states: Record<number, "open" | "merged" | "closed">,
    also: Ticket[] = [],
    labels: string[] = ["timone", "triage:feature"],
  ): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
    closed: string[];
  } {
    const posted: PostedComment[] = [];
    const closed: string[] = [];
    const base = ticket(6, { labels });
    const tickets = [base, ...also];
    const pull = (pr: number): PullRequest => {
      const state = states[pr];
      if (state === undefined) throw new Error(`no pull request #${pr} here`);
      return {
        number: pr,
        title: `piece ${pr}`,
        url: `https://github.com/fvermaut/scratch-app/pull/${pr}`,
        state,
        headSha: "aaaaaaa",
      };
    };
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return tickets;
      },
      ...noOtherListings,
      async getTicket(_project, number): Promise<TicketThread> {
        const found = tickets.find((candidate) => candidate.number === number);
        if (found === undefined) throw new Error(`no ticket ${number}`);
        return { ...found, comments: [] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      async findPullRequest(): Promise<PullRequest | undefined> {
        return undefined;
      },
      async getPullRequestThread(_project, pr): Promise<PullRequestThread> {
        return { ...pull(pr), comments: [] };
      },
      async postPullRequestComment(): Promise<void> {},
      async upsertPullRequestComment(): Promise<void> {},
      async upsertComment(): Promise<void> {},
      async closeTicket(_project, number, reason): Promise<void> {
        closed.push(`${number}:${reason}`);
      },
    };
    return { adapter, posted, closed };
  }

  it("does not close the ticket when a piece of it is still unbuilt", async () => {
    // The whole of the truncation this exists to end: chunk 1 merges, and the
    // ticket has two more pieces the human approved.
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter, posted, closed } = successionAdapter({ 9: "merged" });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(breakdown(["The ledger learns chunks", "The next chunk opens"])),
    });

    // Zero calls, not "called with something else": a guard that closed the
    // ticket with the wrong reason would pass any weaker assertion.
    expect(closed).toEqual([]);
    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    // And it says so on the ticket rather than going quiet.
    expect(
      posted.some((comment) => /next piece/i.test(comment.body)),
    ).toBe(true);
  });

  it("closes the ticket on the last piece, linking every pull request", async () => {
    const store = newStore();
    chunkDone(store, 1, 9);
    chunkOnReview(store, 2, 12);
    const { adapter, posted, closed } = successionAdapter({ 9: "merged", 12: "merged" });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(breakdown(["The ledger learns chunks", "The next chunk opens"])),
    });

    expect(closed).toEqual(["6:completed"]);
    const closing = posted.map((comment) => comment.body).join("\n");
    // Both of them: the initiative is what ended, and its record is the pull
    // requests it produced — one of which is three weeks up the thread.
    expect(closing).toContain("#9");
    expect(closing).toContain("#12");
  });

  it("still declines a pull request closed without merging, breakdown or no breakdown", async () => {
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter, closed } = successionAdapter({ 9: "closed" });
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(breakdown(["The ledger learns chunks", "The next chunk opens"])),
    });

    expect(closed).toEqual(["6:not-planned"]);
    expect(store.get("scratch-app#6/1")?.status).toBe("done");
  });

  it("lets a bug queued during a chunk take the project before the next chunk", async () => {
    // R22 clause 6, and the reason succession is not a `register` call inside
    // `concludeReview`. A bug filed while chunk 1 was building has been
    // waiting; completing chunk 1 promotes it *in that same call*, and the
    // next chunk is opened by a later cycle's registration loop — so it
    // queues behind the bug rather than in front of it. Registering the
    // successor here would look identical and starve the queue silently.
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter } = successionAdapter({ 9: "merged" }, [ticket(8)]);
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(breakdown(["The ledger learns chunks", "The next chunk opens"])),
    };

    // The bug arrives while chunk 1 is still out for review.
    expect(store.get("scratch-app#8/1")).toBeUndefined();

    await pollOnce(deps);

    // The window: chunk 1 is finished, the bug holds the project, and no
    // second chunk of #6 exists yet at all.
    expect(store.get("scratch-app#6/1")?.status).toBe("done");
    expect(store.get("scratch-app#8/1")?.status).toBe("picked-up");
    expect(store.get("scratch-app#6/2")).toBeUndefined();
    // Asserted on the spawner, not on the order of two log lines: the bug's
    // run is the one a session was started for.
    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#8/1"]);

    await pollOnce(deps);

    // Only now does chunk 2 open — behind the bug, which is still holding.
    expect(store.get("scratch-app#6/2")?.status).toBe("queued");
    expect(spawned.map((run) => run.id)).not.toContain("scratch-app#6/2");
  });

  it("opens nothing in the cycle a chunk merged, leaving the project free", async () => {
    // The other half of the window, with nothing waiting: the cycle that ends
    // chunk 1 must not start chunk 2 as well. A successor registered from
    // `concludeReview` would be picked up on the spot — the project is free
    // by then — and spawned before anything marked between cycles was ever
    // listed, which is R22 clause 6 failing while everything still looks fine.
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter } = successionAdapter({ 9: "merged" });
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(breakdown(["The ledger learns chunks", "The next chunk opens"])),
    });

    expect(spawned).toEqual([]);
    expect(store.all().map((run) => run.id)).toEqual(["scratch-app#6/1"]);
  });


  it("stops on a list that has grown since it was approved, and says so", async () => {
    // ADR-0028 D3. The stamp names two pieces; the file lists three. The
    // piece that would come next is one the human has never read, so nothing
    // closes and nothing starts — but the ticket is told, because a ticket
    // that simply went quiet looks exactly like a daemon that has died.
    const store = newStore();
    chunkDone(store, 1, 9);
    chunkOnReview(store, 2, 12);
    const { adapter, posted, closed } = successionAdapter({ 9: "merged", 12: "merged" });
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(
        breakdown(
          ["The ledger learns chunks", "The next chunk opens", "The ticket closes"],
          2,
        ),
      ),
    };

    await pollOnce(deps);

    expect(closed).toEqual([]);
    expect(
      posted.some((comment) => /grown since/i.test(comment.body)),
    ).toBe(true);

    // And no successor starts on the cycle after, either: the registration
    // loop would otherwise open piece 3 a minute later, which is the approval
    // this refusal exists to wait for being granted by the clock.
    await pollOnce(deps);

    expect(store.get("scratch-app#6/3")).toBeUndefined();
    expect(spawned).toEqual([]);
  });

  it("closes a ticket that never had a breakdown, and finishes the cycle", async () => {
    // A chore reaches a pull request without ever meeting the breakdown stage
    // (ADR-0030 D3), so an absent file is an ordinary shape of work and not a
    // fault. It closes as it always did, nothing is reported as an error, and
    // the rest of this project's turn still happens.
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter, closed } = successionAdapter({ 9: "merged" }, [ticket(8)]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(),
    });

    expect(closed).toEqual(["6:completed"]);
    expect(result.errors).toEqual([]);
    // The turn carried on past the merge: the ticket waiting behind it was
    // promoted and handed to the spawner in this same cycle.
    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#8/1"]);
  });

  it("reports a breakdown it cannot read, and still finishes the cycle", async () => {
    // The other half: a file that exists and says nothing anyone can act on is
    // somebody's mistake, so it earns a line in the cycle's errors. The ticket
    // still closes — leaving it open on the strength of a file nothing could
    // read would strand it — and the project's turn is not taken down.
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter, closed } = successionAdapter({ 9: "merged" }, [ticket(8)]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith("# Breakdown\n\nsomebody deleted the status line\n"),
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("doc/plans/breakdowns/ticket-06.md");
    expect(closed).toEqual(["6:completed"]);
    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#8/1"]);
  });

  it("enters a successor chunk at planning, never back at triage", async () => {
    // Triage classified this ticket when its first chunk ran, and the ticket
    // is the same conversation. Re-triaging it would classify work already in
    // flight as a fresh request — and the spawner's default for a run with no
    // stage is exactly that.
    const store = newStore();
    chunkDone(store, 1, 9);
    const { run: second } = store.register("scratch-app", 6);
    expect(second.seq).toBe(2);
    expect(second.stage).toBeUndefined();

    const { adapter } = successionAdapter({ 9: "merged" });
    const contexts: (SpawnContext | undefined)[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(contexts).toEqual([{ stage: "planning" }]);
  });

  it("enters a map's successor chunk at planning, not back at charting", async () => {
    // timone#21. A `wayfinder:map` label is read before the sequence number,
    // which is right for a decision ticket and wrong for the map: a map is a
    // question only once — "shall I write the specification?" — and every
    // chunk after that one is a piece of an approved breakdown. Entering them
    // at `charting` sent the map back to a go-ahead it was already given, and
    // its second piece was never built.
    const store = newStore();
    chunkDone(store, 1, 9);
    const { run: second } = store.register("scratch-app", 6);
    expect(second.seq).toBe(2);

    const { adapter } = successionAdapter({ 9: "merged" }, [], [
      "timone",
      "wayfinder:map",
      "wayfinder:frontier-empty",
    ]);
    const contexts: (SpawnContext | undefined)[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(contexts).toEqual([{ stage: "planning" }]);
  });

  it("still enters a decision ticket's successor chunk at its own stage", async () => {
    // The narrowing is the map alone. A `wayfinder:grilling` ticket that opens
    // a second chunk is still a question for a human, and the sequence rule
    // must not quietly re-point it at the build pipeline — the reason the
    // labels are read first in the first place.
    const store = newStore();
    chunkDone(store, 1, 9);
    const { run: second } = store.register("scratch-app", 6);
    expect(second.seq).toBe(2);

    const { adapter } = successionAdapter({ 9: "merged" }, [], [
      "timone",
      "wayfinder:grilling",
    ]);
    const contexts: (SpawnContext | undefined)[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(contexts).toEqual([{ stage: "wayfinding" }]);
  });

  it("leaves a first chunk to enter where it always did", async () => {
    // The discriminator is the sequence number, and this is the half that
    // protects every run there has ever been: chunk 1 of an ordinary ticket
    // is still handed over with no entry context at all.
    const store = newStore();
    const { adapter } = successionAdapter({});
    const contexts: (SpawnContext | undefined)[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
    });

    expect(store.get("scratch-app#6/1")?.seq).toBe(1);
    expect(contexts).toEqual([undefined]);
  });

  /**
   * The standing call to action on a ticket mid-initiative
   * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
   * D4). The cycle a piece merges on is the one that exposes it: the
   * registration loop has already run by the time the merge is concluded, so
   * the ticket reaches {@link reconcileCtas} with its last run `done` and its
   * successor not yet opened — and a run-shaped call to action says the
   * initiative is over into exactly that gap.
   */
  function recording(adapter: TicketingAdapter): {
    adapter: TicketingAdapter;
    upserts: string[];
  } {
    const upserts: string[] = [];
    return {
      adapter: {
        ...adapter,
        async upsertComment(_project, _number, _marker, body): Promise<void> {
          upserts.push(body);
        },
      },
      upserts,
    };
  }

  it("says the next piece is coming on the cycle a piece merged", async () => {
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter: base } = successionAdapter({ 9: "merged" });
    const { adapter, upserts } = recording(base);
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(breakdown(["The ledger learns chunks", "The next chunk opens"])),
    });

    const standing = upserts.join("\n");
    expect(standing).toContain("**Piece 2 of 2 is next.**");
    expect(standing).toContain(
      "**What I need from you:** nothing right now — I'll start it on my next pass.",
    );
    // The line this replaces, named so a regression cannot hide behind the
    // one above: the initiative is not finished, and the ticket must not say
    // it is.
    expect(standing).not.toContain("This one is finished.");
  });

  it("keeps asking whether to carry on while the list of pieces is re-proposed", async () => {
    // 23f's permanent contradiction, driven through the loop that produced
    // it: `reproposedComment` says "I've stopped here, tell me whether to
    // carry on" and the standing line said nothing was needed — for ever,
    // because a held-back successor never opens and the last run stays `done`.
    const store = newStore();
    chunkOnReview(store, 1, 9);
    const { adapter: base } = successionAdapter({ 9: "merged" });
    const { adapter, upserts } = recording(base);
    const { spawner } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      // A plain fixture directory, not a clone: the production default reads the
      // approved list off the default branch (ADR-0030 D2).
      breakdownSource: fromWorkingTree,
      root: rootWith(
        breakdown(["The ledger learns chunks", "The next chunk opens", "A piece nobody read"], 2),
      ),
    };

    await pollOnce(deps);
    // And on the cycle after, which is where "permanent" is: nothing has
    // moved, so the same line must still be the one on the ticket.
    await pollOnce(deps);

    const standing = upserts.at(-1) ?? "";
    expect(standing).toContain(
      "**The list of pieces has grown since you approved it.**",
    );
    expect(standing).toContain(
      "**What I need from you:** say here whether to carry on with the longer list.",
    );
    expect(standing).not.toContain("This one is finished.");
  });
});

/**
 * A store whose state path the test also holds, so it can leave a request
 * beside the ledger the way a refused command does
 * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
 */
function newStoreAt(): { store: RunStore; statePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "timone-poll-requests-"));
  tempDirs.push(dir);
  const statePath = join(dir, ".timone", "state.json");
  let tick = 0;
  const store = RunStore.open(statePath, {
    now: () => `2026-08-16T12:${String(tick++).padStart(2, "0")}:00Z`,
  });
  return { store, statePath };
}

/** A run that stopped badly, which is what `timone retry` exists for. */
function failedRun(store: RunStore, number = 31): Run {
  const { run } = store.register("scratch-app", number);
  store.activate(run.id, "session-1");
  return store.fail(run.id, "the execution stage said it finished, but nothing was committed");
}

describe("pollOnce — requests a human left for the daemon", () => {
  it("carries out a queued retry, and says whose it was", async () => {
    const { store, statePath } = newStoreAt();
    const run = failedRun(store);
    enqueue(statePath, { kind: "retry", project: "scratch-app", ticket: 31 }, { by: "fvermaut" });
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(31)] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      statePath,
    });

    expect(result.applied).toEqual(["retry scratch-app#31"]);
    expect(store.get(run.id)?.status).not.toBe("failed");
    expect(pending(statePath).requests).toEqual([]);
  });

  /**
   * The ordering the slice exists for, asserted on an effect rather than on
   * two log lines: a retry applied *after* the registration loop had walked
   * past its ticket would sit re-armed until the next cycle, sixty seconds
   * later. Applied first, the same cycle spawns it.
   */
  it("applies a request before the projects are walked, so the same cycle acts on it", async () => {
    const { store, statePath } = newStoreAt();
    failedRun(store);
    enqueue(statePath, { kind: "retry", project: "scratch-app", ticket: 31 });
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(31)] });
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      statePath,
    });

    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#31/1"]);
  });

  it("carries out a queued cancellation, in the human's own words", async () => {
    const { store, statePath } = newStoreAt();
    const run = failedRun(store);
    enqueue(statePath, {
      kind: "cancel",
      project: "scratch-app",
      ticket: 31,
      reason: "I have changed my mind about labels",
    });
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      statePath,
    });

    expect(result.applied).toEqual(["cancel scratch-app#31"]);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(store.get(run.id)?.cancellation).toBe("I have changed my mind about labels");
  });

  /**
   * A request that cannot be carried out is gone all the same. One that
   * survived its own failure would be re-attempted every sixty seconds for
   * ever — a poison pill that stops everything queued behind it.
   */
  it("settles a request it cannot carry out, and does not try it again", async () => {
    const { store, statePath } = newStoreAt();
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.complete(run.id);
    enqueue(statePath, { kind: "retry", project: "scratch-app", ticket: 31 });
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { spawner } = fakeSpawner();
    const deps = { manifest: manifestWith("scratch-app"), store, adapter, spawner, statePath };

    const first = await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(first.applied).toEqual([]);
    expect(first.errors.join(" ")).toContain("could not apply retry scratch-app#31");
    expect(pending(statePath).requests).toEqual([]);
    expect(second.errors).toEqual([]);
  });

  it("reports an unreadable request, leaves it alone, and polls anyway", async () => {
    const { store, statePath } = newStoreAt();
    mkdirSync(requestsDir(statePath), { recursive: true });
    const corrupt = join(requestsDir(statePath), "2026-08-16T12-00-00-000Z-000000-dead.json");
    writeFileSync(corrupt, "{ not json", "utf8");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      statePath,
    });

    expect(result.errors.join(" ")).toContain("unreadable request");
    expect(readFileSync(corrupt, "utf8")).toBe("{ not json");
    // The cycle did its actual job regardless: the marked ticket was still
    // registered and acknowledged.
    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
    expect(comments).toHaveLength(1);
  });

  it("costs nothing when nobody has ever asked for anything", async () => {
    const { store, statePath } = newStoreAt();
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      statePath,
    });

    expect(result.applied).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
  });

  /**
   * Every existing daemon and every existing test is in this state: a cycle
   * that was never told where the ledger lives serves nobody, and behaves
   * exactly as it did before requests existed.
   */
  it("serves nobody when the cycle was never told where the ledger is", async () => {
    const { store } = newStoreAt();
    failedRun(store);
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
    });

    expect(result.applied).toEqual([]);
    expect(store.get("scratch-app#31/1")?.status).toBe("failed");
  });
});

describe("pollOnce — handing a run to the terminal and taking it back", () => {
  it("claims a parked run for a takeover, and gives it back on release", async () => {
    const { store, statePath } = newStoreAt();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
    });
    enqueue(statePath, { kind: "claim-takeover", project: "scratch-app", ticket: 6 });
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(6)] });
    const { spawner, spawned } = fakeSpawner();
    const deps = { manifest: manifestWith("scratch-app"), store, adapter, spawner, statePath };

    const claiming = await pollOnce(deps);

    expect(claiming.applied).toEqual(["claim-takeover scratch-app#6"]);
    expect(store.get(run.id)?.status).toBe("active");
    // Claimed means the project is held: the daemon starts nothing on it
    // while the human is talking, which is the exclusivity that used to come
    // from the lock (ADR-0032).
    expect(spawned).toEqual([]);

    enqueue(statePath, {
      kind: "release-takeover",
      project: "scratch-app",
      ticket: 6,
      outcome: "ended",
    });
    const releasing = await pollOnce(deps);

    expect(releasing.applied).toEqual(["release-takeover scratch-app#6"]);
    const after = store.get(run.id);
    expect(after?.status).toBe("parked");
    // Back on the same wait, read off the run rather than remembered by the
    // process that claimed it — which may no longer exist.
    expect(after?.waitingKind).toBe("conversation");
    expect(after?.stage).toBe("clarification");
  });

  it("says so, and changes nothing, when there is nothing to hand over", async () => {
    const { store, statePath } = newStoreAt();
    enqueue(statePath, {
      kind: "release-takeover",
      project: "scratch-app",
      ticket: 6,
      outcome: "abandoned",
    });
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { spawner } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      statePath,
    });

    expect(result.applied).toEqual([]);
    expect(result.errors.join(" ")).toContain("not out at the terminal");
    expect(pending(statePath).requests).toEqual([]);
  });
});

/**
 * The gate's own failure, as tests: a run handed back mid-build, and the word
 * the human wrote under it
 * ([ADR-0031](../../doc/adr/0031-a-handoff-is-a-wait-not-a-failure.md)).
 *
 * Nothing here drives 24e's parking code — these start from the park it
 * produces, because what failed on scratch-app#31 was not the parking but
 * everything after it.
 */
describe("pollOnce — a handoff waits, and the reply reaches it", () => {
  const handoff = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\nthe fifth part found a real fault and stopped. Just tell me here to carry on.`,
    createdAt: "2026-08-16T10:00:00Z",
    fromTimone: true,
  };
  const carryOn = {
    author: "fvermaut",
    body: "carry on",
    createdAt: "2026-08-16T10:30:00Z",
    fromTimone: false,
  };

  /** A run handed back part-way through building, exactly as 24e parks it. */
  function handedBack(store: RunStore): Run {
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    return store.park(run.id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "execution",
      waitCursor: handoff.createdAt,
    });
  }

  function threadOf(...comments: TicketThread["comments"]): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
  } {
    const posted: PostedComment[] = [];
    const base = ticket(31, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    return { adapter, posted };
  }

  it("resumes the stage that stopped, carrying what the human wrote", async () => {
    const store = newStore();
    handedBack(store);
    const { adapter } = threadOf(handoff, carryOn);
    const { spawner, spawned } = fakeSpawner();
    const contexts: (SpawnContext | undefined)[] = [];
    const watching: SessionSpawner = {
      async spawn(run, project, context) {
        contexts.push(context);
        return spawner.spawn(run, project, context);
      },
    };

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: watching,
      root: "/nowhere",
    });

    expect(result.resumed).toEqual(["scratch-app#31/1"]);
    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#31/1"]);
    // The stage that asked the question is the one that judges the answer —
    // not the next one, which would build on a question nobody resolved.
    expect(contexts[0]?.stage).toBe("execution");
    expect(contexts[0]?.feedback).toContain("carry on");
  });

  it("reads that answer once, however many cycles pass over it", async () => {
    const store = newStore();
    handedBack(store);
    const { adapter } = threadOf(handoff, carryOn);
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    };

    await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(second.resumed).toEqual([]);
    expect(spawned).toHaveLength(1);
  });

  it("is not answered by the machine talking to itself", async () => {
    // The standing call to action is rewritten on the ticket every cycle. If
    // that counted as an answer the run would resume on its own words for ever.
    const store = newStore();
    handedBack(store);
    const { adapter } = threadOf(handoff, {
      author: "fvermaut",
      body: `${CTA_MARKER}\n\n**This one is waiting on you.**`,
      createdAt: "2026-08-16T10:15:00Z",
      fromTimone: true,
    });
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(result.resumed).toEqual([]);
    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#31/1")?.status).toBe("parked");
  });

  it("is not answered by words written before the question", async () => {
    const store = newStore();
    handedBack(store);
    const { adapter } = threadOf(
      {
        author: "fvermaut",
        body: "go for it",
        createdAt: "2026-08-16T09:00:00Z",
        fromTimone: false,
      },
      handoff,
    );
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(result.resumed).toEqual([]);
    expect(spawned).toEqual([]);
  });

  /**
   * The hazard this slice exists to prove absent, and it is not hypothetical
   * arithmetic: `concludeLastConversation` reads *any* machine comment
   * carrying `CONVERSATION_RECORD_MARKER` after the cursor, and a work stage
   * does not declare a conversation wait — so `concludeConversation` throws
   * for it. A handoff at `execution` must be untouched by such a comment, and
   * must still be answerable afterwards.
   */
  it("is neither concluded nor wedged by a conversation record from elsewhere", async () => {
    const store = newStore();
    handedBack(store);
    const { adapter } = threadOf(
      handoff,
      {
        author: "fvermaut",
        body: `${CONVERSATION_RECORD_MARKER}\n\n✅ Agreed: something else entirely.`,
        createdAt: "2026-08-16T10:10:00Z",
        fromTimone: true,
      },
      carryOn,
    );
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    // Not concluded: marking a half-built run `done` would close its ticket.
    expect(store.get("scratch-app#31/1")?.status).not.toBe("done");
    // And not wedged either: the human's answer still starts the work.
    expect(result.errors).toEqual([]);
    expect(spawned.map((run) => run.id)).toEqual(["scratch-app#31/1"]);
  });
});

describe("pollOnce — a park nothing written can end", () => {
  // ADR-0033. The stage read the human's words, understood them, and judged
  // that acting on them is outside what it may do. Handing it the same words
  // again buys another pass and the same judgement — five times, on
  // ivtrends #1 — so this wait does not end on a comment at all.

  const stopped = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\nI can't take this one further myself.`,
    createdAt: "2026-08-17T10:00:00Z",
    fromTimone: true,
  };
  const answer = {
    author: "fvermaut",
    body: "yes. go ahead to delivery",
    createdAt: "2026-08-17T10:30:00Z",
    fromTimone: false,
  };

  function threadOf(
    number: number,
    ...comments: TicketThread["comments"]
  ): { adapter: TicketingAdapter; posted: PostedComment[] } {
    const posted: PostedComment[] = [];
    const base = ticket(number, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments };
      },
      async postComment(project, num, body): Promise<void> {
        posted.push({ project: project.name, number: num, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    return { adapter, posted };
  }

  /** A run stopped at the stage that could not use the answer it was given. */
  function escalated(store: RunStore): Run {
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/31-slow-page");
    return store.park(run.id, {
      waitingOn: "me — I can't take this one further myself.",
      kind: "escalation",
      stage: "verification",
      waitCursor: stopped.createdAt,
    });
  }

  it("stays parked however plainly the human answers it", async () => {
    const store = newStore();
    escalated(store);
    const { adapter } = threadOf(31, stopped, answer);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(result.resumed).toEqual([]);
    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#31/1")).toMatchObject({
      status: "parked",
      waitingKind: "escalation",
      stage: "verification",
    });
    expect(result.errors).toEqual([]);
  });

  it("holds the same words a handoff at the same stage would have resumed on", async () => {
    // The discrimination is the kind of park, not the stage. Same stage, same
    // words, same instant — one resumes and one does not.
    const store = newStore();
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/31-slow-page");
    store.park(run.id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "verification",
      waitCursor: stopped.createdAt,
    });
    const { adapter } = threadOf(31, stopped, answer);
    const contexts: (SpawnContext | undefined)[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
      root: "/nowhere",
    });

    expect(result.resumed).toEqual(["scratch-app#31/1"]);
    expect(contexts[0]?.stage).toBe("verification");
    expect(contexts[0]?.feedback).toContain("go ahead");
  });

  it("leaves a gate park answered as it always was", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: stopped.createdAt,
    });
    const { adapter } = threadOf(6, stopped, {
      ...answer,
      body: "approve",
    });
    const contexts: (SpawnContext | undefined)[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
      root: "/nowhere",
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts[0]?.stage).toBe("breakdown");
  });

  it("leaves a review park answered as it always was", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "delivery",
      waitCursor: stopped.createdAt,
    });
    const base = ticket(6, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
      async findPullRequest() {
        return {
          number: 9,
          title: "Fix the box",
          url: "https://github.com/fvermaut/scratch-app/pull/9",
          state: "open" as const,
          headSha: "aaaaaaa",
        };
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return {
          number: 9,
          title: "Fix the box",
          url: "https://github.com/fvermaut/scratch-app/pull/9",
          state: "open",
          headSha: "aaaaaaa",
          comments: [
            {
              author: "fvermaut",
              body: "Please rename this variable.",
              createdAt: "2026-08-17T12:00:00Z",
              fromTimone: false,
              replyTo: "501",
            },
          ],
        };
      },
    };
    const contexts: (SpawnContext | undefined)[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
      root: "/nowhere",
    });

    expect(result.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts[0]?.stage).toBe("remediation");
  });
});

describe("pollOnce — the loop that cost five passes cannot happen", () => {
  // ADR-0033, end to end. Nothing new is expected in `poll.ts` here: 25a
  // refuses to resume, 25d parks when a stage declares, 25e parks when one
  // does not. This slice is the proof that those three meet in the loop.

  const question = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\n---\n\nThe two promises can't pass as worded. I can't reword them myself.`,
    createdAt: "2026-08-17T10:00:00Z",
    fromTimone: true,
  };

  function threadOf(
    number: number,
    comments: TicketThread["comments"],
  ): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
    standing: string[];
    thread: TicketThread["comments"];
  } {
    const posted: PostedComment[] = [];
    const standing: string[] = [];
    const base = ticket(number, { labels: ["timone", "triage:feature"] });
    const thread = [...comments];
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [...thread] };
      },
      async postComment(project, num, body): Promise<void> {
        posted.push({ project: project.name, number: num, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
      async upsertComment(_project, _num, _marker, body): Promise<void> {
        standing.push(body);
      },
    };
    return { adapter, posted, standing, thread };
  }

  /** A run stopped where nothing written can restart it, as 25d parks it. */
  function stopped(store: RunStore, ticket = 31): Run {
    const { run } = store.register("scratch-app", ticket);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, `timone/${ticket}-slow-page`);
    return store.park(run.id, {
      waitingOn: "me — I can't take this one further on my own.",
      kind: "escalation",
      stage: "verification",
      waitCursor: question.createdAt,
    });
  }

  it("spawns nothing over ten cycles, however often they answer", async () => {
    // Ten, not one: the fault was a loop, and one quiet cycle proves nothing
    // about the tenth.
    const store = newStore();
    stopped(store);
    const { adapter, thread } = threadOf(31, [question]);
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    };

    for (let cycle = 0; cycle < 10; cycle += 1) {
      thread.push({
        author: "fvermaut",
        body: `yes. go ahead (answer ${cycle + 1})`,
        createdAt: `2026-08-17T1${cycle}:30:00Z`,
        fromTimone: false,
      });
      await pollOnce(deps);
    }

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#31/1")).toMatchObject({
      status: "parked",
      waitingKind: "escalation",
    });
  });

  it("keeps their words where the session that picks it up can read them", async () => {
    // Refusing to act on an answer and losing it are different things, and
    // only the first was decided. Nothing consumed the comment, nothing moved
    // the cursor past it.
    const store = newStore();
    stopped(store);
    const answer = {
      author: "fvermaut",
      body: "yes. how many times do I need to say YES?",
      createdAt: "2026-08-17T10:30:00Z",
      fromTimone: false,
    };
    const { adapter, thread } = threadOf(31, [question, answer]);
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    const run = store.get("scratch-app#31/1");
    expect(run?.waitCursor).toBe(question.createdAt);
    expect(run?.consumedAnswerAt).toBeUndefined();
    expect(thread).toContainEqual(answer);
  });

  it("is not concluded by a conversation record from somewhere else", async () => {
    // `concludeLastConversation` reads any machine comment carrying the
    // record marker after the cursor. Concluding this run would mark it done
    // and close a ticket whose work is unfinished and whose question is
    // unanswered.
    const store = newStore();
    stopped(store);
    const { adapter } = threadOf(31, [
      question,
      {
        author: "fvermaut",
        body: `${CONVERSATION_RECORD_MARKER}\n\n✅ Agreed: something else entirely.`,
        createdAt: "2026-08-17T10:10:00Z",
        fromTimone: true,
      },
    ]);
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(store.get("scratch-app#31/1")?.status).toBe("parked");
    expect(spawned).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("tells the ticket, every cycle, that writing again will not move it", async () => {
    const store = newStore();
    stopped(store);
    const { adapter, standing } = threadOf(31, [question]);
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(standing.at(-1)).toMatch(/won't move it/i);
    expect(standing.at(-1)).toContain("timone takeover scratch-app#31");
  });

  it("closes the loop even when no stage ever notices", async () => {
    // The ivtrends #1 sequence with the declaration removed: a stage that
    // reads the answer and asks the same question again, twice. The second
    // re-ask is parked as an escalation by the floor, and the third cycle
    // spawns nothing.
    const store = newStore();
    const { run } = store.register("scratch-app", 32);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/32-slow-page");
    store.park(run.id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "verification",
      waitCursor: "2026-08-17T10:00:00Z",
    });

    const { adapter, thread } = threadOf(32, [
      { ...question, createdAt: "2026-08-17T10:00:00Z" },
    ]);
    const spawned: string[] = [];
    let asked = 0;
    // A stage that reads the answer and asks again, exactly as `handBack`
    // parks it — the shape of a session that never recognises the dead end.
    const asking: SessionSpawner = {
      async spawn(run) {
        spawned.push(run.id);
        asked += 1;
        const at = `2026-08-17T1${asked}:45:00Z`;
        thread.push({
          author: "fvermaut",
          body: `${MACHINE_MARKER}\n\n---\n\nSo shall I go ahead? (${asked})`,
          createdAt: at,
          fromTimone: true,
        });
        store.repark(run.id, {
          waitingOn: "your answer to the question in my last comment.",
          kind: "conversation",
          stage: "verification",
          waitCursor: at,
        });
      },
    };
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: asking,
      root: "/nowhere",
    };

    for (let cycle = 0; cycle < 3; cycle += 1) {
      thread.push({
        author: "fvermaut",
        body: `yes, go ahead (${cycle + 1})`,
        createdAt: `2026-08-17T1${cycle}:30:00Z`,
        fromTimone: false,
      });
      await pollOnce(deps);
    }

    // Two passes, not three: the second re-ask is where it stops.
    expect(spawned).toHaveLength(2);
    expect(store.get("scratch-app#32/1")).toMatchObject({
      status: "parked",
      waitingKind: "escalation",
      stage: "verification",
      reAsksAfterAnswer: 2,
    });
  });

  it("leaves a handoff at the same stage resuming on `carry on`", async () => {
    // Phase 24's own path, re-driven here because this phase's whole risk is
    // over-reach into it.
    const store = newStore();
    const { run } = store.register("scratch-app", 33);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/33-slow-page");
    store.park(run.id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "conversation",
      stage: "execution",
      waitCursor: "2026-08-17T10:00:00Z",
    });
    const { adapter } = threadOf(33, [
      { ...question, createdAt: "2026-08-17T10:00:00Z" },
      {
        author: "fvermaut",
        body: "carry on",
        createdAt: "2026-08-17T10:30:00Z",
        fromTimone: false,
      },
    ]);
    const contexts: (SpawnContext | undefined)[] = [];

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run, _project, context) {
          contexts.push(context);
        },
      },
      root: "/nowhere",
    });

    expect(result.resumed).toEqual(["scratch-app#33/1"]);
    expect(contexts[0]?.stage).toBe("execution");
    expect(contexts[0]?.feedback).toContain("carry on");
  });
});

describe("pollOnce — a stop cleared in the terminal goes back to the machine", () => {
  // ADR-0035. The other half of phase 25: a person and the machine settled it
  // together, the session says so on the ticket, and the work carries on
  // without a second command being typed.

  const question = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\n---\n\nI can't sign that off as you.`,
    createdAt: "2026-08-19T10:00:00Z",
    fromTimone: true,
  };

  function handback(step: string | undefined, extra = ""): TicketThread["comments"][number] {
    const named = step === undefined ? "" : `\n\n${HANDBACK_STEP_PREFIX} ${step}`;
    return {
      author: "fvermaut",
      body: `${MACHINE_MARKER}\n\n---\n\n${HANDBACK_MARKER}\n\nWe went through it and you approved it.${named}${extra}`,
      createdAt: "2026-08-19T10:30:00Z",
      fromTimone: true,
    };
  }

  function threadOf(...comments: TicketThread["comments"]): {
    adapter: TicketingAdapter;
    standing: string[];
  } {
    const standing: string[] = [];
    const base = ticket(41, { labels: ["timone", "triage:feature"] });
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
      async upsertComment(_project, _number, _marker, body): Promise<void> {
        standing.push(body);
      },
    };
    return { adapter, standing };
  }

  /** A run stopped where nothing written can restart it, as 25d parks it. */
  function stopped(store: RunStore): Run {
    const { run } = store.register("scratch-app", 41);
    store.activate(run.id, "session-1");
    return store.park(run.id, {
      waitingOn: "me — I can't take this one further on my own.",
      kind: "escalation",
      stage: "clarification",
      waitCursor: question.createdAt,
    });
  }

  it("starts the step the note names, exactly once", async () => {
    const store = newStore();
    stopped(store);
    const { adapter } = threadOf(question, handback("building"));
    const contexts: (SpawnContext | undefined)[] = [];
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        // Claims the run as the real spawner does. That claim is what makes
        // the note read once — activating clears the wait, exactly as it does
        // for an approved gate. Deliberately not a consume: a spawn that
        // fails leaves the note readable and the next cycle tries again,
        // where a consumed note would be lost with the session.
        async spawn(run: Run, _project: unknown, context?: SpawnContext) {
          contexts.push(context);
          store.activate(run.id, "session-2");
        },
      },
      root: "/nowhere",
    };

    const first = await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(first.resumed).toEqual(["scratch-app#41/1"]);
    expect(contexts.map((context) => context?.stage)).toEqual(["execution"]);
    expect(second.resumed).toEqual([]);
    expect(contexts).toHaveLength(1);
  });

  it("starts the step it stopped at when the note names none", async () => {
    const store = newStore();
    stopped(store);
    const { adapter } = threadOf(question, handback(undefined));
    const contexts: (SpawnContext | undefined)[] = [];

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner: {
        async spawn(_run: Run, _project: unknown, context?: SpawnContext) {
          contexts.push(context);
        },
      },
      root: "/nowhere",
    });

    expect(contexts[0]?.stage).toBe("clarification");
  });

  it("reads no branch out of the note, whatever the note says", async () => {
    // The branch is computed where it has always been computed, from the
    // ticket and the chunk (`claimBranch`). A comment that could name one
    // would let a comment redirect the work.
    const store = newStore();
    stopped(store);
    const { adapter } = threadOf(
      question,
      handback("building", "\n\nBranch: timone/somebody-elses-work"),
    );
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(store.get("scratch-app#41/1")?.branch).toBeUndefined();
  });

  it("refuses a step it does not know, says so, and starts nothing", async () => {
    const store = newStore();
    stopped(store);
    const { adapter, standing } = threadOf(question, handback("the last bit"));
    const { spawner, spawned } = fakeSpawner();

    const result = await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(spawned).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(store.get("scratch-app#41/1")).toMatchObject({
      status: "parked",
      waitingKind: "escalation",
    });
    // And it says which name it could not read, so the person can see what
    // the machine wrote down wrong.
    expect(standing.at(-1)).toContain("the last bit");
    expect(standing.at(-1)).toContain("timone takeover scratch-app#41");
  });

  it("refuses a step it knows the name of but cannot start", async () => {
    // `keeping the list of questions` is a real name for a real step that no
    // session is ever started for. Starting it would fail the run and put
    // "something went wrong" on a ticket whose stop the human had just
    // cleared — so it is refused, and named.
    //
    // ✏ It used to be `research`, which phase 27 built. The property under
    // test is *a real step with nothing behind it*, and the graph still has
    // one, so the test keeps its subject and changes its example.
    const store = newStore();
    stopped(store);
    const { adapter, standing } = threadOf(
      question,
      handback(stageLabel("charting")),
    );
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#41/1")?.status).toBe("parked");
    expect(standing.at(-1)).toContain(stageLabel("charting"));
  });

  it("says a real step it cannot run is real, not gibberish", async () => {
    // The two refusals were one message until phase 27, and the one message
    // was wrong about this half: it told the reader the machine could not read
    // its own handwriting, when the note said something perfectly well
    // defined. They would have gone off to correct a note that was right.
    const store = newStore();
    stopped(store);
    const { adapter, standing } = threadOf(
      question,
      handback(stageLabel("charting")),
    );
    const { spawner } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    const said = standing.at(-1) ?? "";
    expect(said).toContain("That is a real step");
    expect(said).not.toContain("I don't know what that means");
  });

  it("is not resolved by the stage's own account of why it stopped", async () => {
    const store = newStore();
    stopped(store);
    const { adapter } = threadOf(question, {
      author: "fvermaut",
      body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_ESCALATED_MARKER}\n\nI can't do that part.`,
      createdAt: "2026-08-19T10:15:00Z",
      fromTimone: true,
    });
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    });

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#41/1")?.waitingKind).toBe("escalation");
  });

  it("still starts nothing on the human writing again, ten cycles running", async () => {
    // Phase 25's guarantee, re-driven here because this is the slice where it
    // could be lost: the words are read by the same branch that now reads the
    // note.
    const store = newStore();
    stopped(store);
    const answers = [question];
    const { adapter } = threadOf(...answers);
    const { spawner, spawned } = fakeSpawner();
    const deps = {
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      root: "/nowhere",
    };

    for (let cycle = 0; cycle < 10; cycle += 1) {
      answers.push({
        author: "fvermaut",
        body: `yes, go ahead (${cycle + 1})`,
        createdAt: `2026-08-19T1${cycle}:45:00Z`,
        fromTimone: false,
      });
      await pollOnce(deps);
    }

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#41/1")?.waitingKind).toBe("escalation");
  });
});
