import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type {
  Ticket,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
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
