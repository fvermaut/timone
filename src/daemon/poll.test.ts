import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type { Preview, PreviewAdapter } from "../adapters/preview.js";
import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  PREVIEW_MARKER,
  type PullRequest,
  type PullRequestThread,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { RunStore, type Run } from "./runs.js";
import { pollOnce, type SessionSpawner } from "./poll.js";

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
  async closeTicket(): Promise<void> {},
};

function fakeAdapter(
  marked: Record<string, Ticket[]>,
  failing: string[] = [],
): { adapter: TicketingAdapter; comments: PostedComment[] } {
  const comments: PostedComment[] = [];
  const adapter: TicketingAdapter = {
    async listMarkedTickets(project: TicketingProject): Promise<Ticket[]> {
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
    expect(result.pickedUp).toEqual(["scratch-app#7"]);
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
    expect(result.queued).toEqual(["scratch-app#8"]);

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
    store.activate("scratch-app#7", "session-1");
    store.complete("scratch-app#7");
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
    store.activate("scratch-app#7", "session-1");
    await pollOnce(deps);

    expect(spawned).toHaveLength(1);
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

    expect(result.resumed).toEqual(["scratch-app#6"]);
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
    expect(store.get("scratch-app#6")?.status).toBe("parked");
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

    expect(result.resumed).toEqual(["scratch-app#6"]);
    // It advances *and* carries who approved and when, so the artifact can
    // record the gate rather than leaving the trace on the ticket alone.
    expect(contexts).toEqual([
      {
        stage: "planning",
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
    expect(store.get("scratch-app#6")?.status).toBe("queued");

    // Unclassified, so #4 has nothing to be resumed *into* — this test is
    // about the queue moving, not about the park being picked back up.
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(4), ticket(6)] });
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned.map((run) => run.ticket)).toEqual([6]);
    expect(store.get("scratch-app#4")?.status).toBe("parked");
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

    expect(result.resumed).toEqual(["scratch-app#4"]);
    expect(contexts).toEqual([{ stage: "clarification" }]);
  });

  it("leaves it parked when what follows still isn't built", async () => {
    const store = newStore();
    parkedAwaitingMachinery(store, ["timone", "triage:bug"]);
    const adapter = labelledAdapter(["timone", "triage:bug"]);
    const { spawner, spawned } = fakeSpawner();

    // A bug routes to the feedback stage, which is phase 13's and later.
    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned).toEqual([]);
    expect(store.get("scratch-app#4")?.status).toBe("parked");
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

    expect(result.resumed).toEqual(["scratch-app#6"]);
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

    expect(store.get("scratch-app#6")?.status).toBe("done");
    expect(posted.some((comment) => /merged/i.test(comment.body))).toBe(true);
    // A ticket whose journey ended is closed, not left open forever.
    expect(closed).toEqual(["6:completed"]);
    // R10's live half in miniature: the terminal state is what starts the
    // next ticket.
    expect(store.get("scratch-app#8")?.status).not.toBe("queued");
    void spawned;
  });

  it("completes the run as declined when the PR was closed unmerged", async () => {
    const store = newStore();
    parkedOnReview(store);
    const { adapter, posted, closed } = reviewAdapter("closed", []);
    const { spawner } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(store.get("scratch-app#6")?.status).toBe("done");
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

    expect(result.resumed).toEqual(["scratch-app#6"]);
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
    expect(store.get("scratch-app#6")?.status).toBe("parked");
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

    expect(result.reclaimed).toEqual(["scratch-app#7"]);
    expect(store.get("scratch-app#7")?.status).toBe("failed");
    expect(store.occupyingRun("scratch-app")).toBeUndefined();
    expect(comments.some((c) => c.body.includes("stopped before the work"))).toBe(
      true,
    );
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
    expect(store.get("scratch-app#8")?.status).toBe("queued");

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    await pollOnce({
      manifest: manifestWith("scratch-app"),
      store,
      adapter,
      spawner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(spawned.map((r) => r.id)).toEqual(["scratch-app#8"]);
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
    expect(store.get("scratch-app#7")?.status).toBe("active");
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
    expect(store.get("scratch-app#7")?.status).toBe("parked");
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

    const rearmed = store.retry("scratch-app#7");
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

    expect(result.reclaimed).toEqual(["scratch-app#7"]);
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
    expect(store.get("scratch-app#7")?.status).toBe("active");
    expect(comments.some((c) => c.body.includes("stopped before the work"))).toBe(
      false,
    );
    // The gate has to be able to read this off the log and know why — both
    // that judgement was withheld and how long the daemon was away.
    expect(lines.some((line) => /not judging.*17m00s/.test(line))).toBe(true);
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

    expect(lines[0]).toMatch(/nothing was watching for 17m00s/);
    expect(lines[1]).toMatch(/watching for 1m00s of the 2m00s/);
    expect(lines[1]).not.toMatch(/nothing was watching/);
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

    expect((await pollOnce(deps)).reclaimed).toEqual(["scratch-app#7"]);
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
    expect(store.get("scratch-app#7")?.status).toBe("active");
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
    expect(store.get("other-app#8")?.status).toBe("active");
    expect(lines.filter((line) => /not judging/.test(line))).toHaveLength(1);
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

    expect(result.reclaimed).toEqual(["scratch-app#7"]);
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
