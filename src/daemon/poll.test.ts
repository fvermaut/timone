import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
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

    const { adapter } = threadedAdapter([]);
    const { spawner, spawned } = fakeSpawner();

    await pollOnce({ manifest: manifestWith("scratch-app"), store, adapter, spawner });

    expect(spawned.map((run) => run.ticket)).toEqual([6]);
    expect(store.get("scratch-app#4")?.status).toBe("parked");
  });
});
