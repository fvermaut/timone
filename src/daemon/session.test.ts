import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import {
  MACHINE_MARKER,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { RunStore, type Run } from "./runs.js";
import {
  AgentSessionSpawner,
  type SessionRequest,
  type SessionRuntime,
} from "./session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-session-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-02T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

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

const project: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

const thread: TicketThread = {
  number: 7,
  title: "the page feels slow",
  body: "when I add many items the page feels slow, it's annoying",
  labels: ["timone"],
  url: "https://github.com/fvermaut/scratch-app/issues/7",
  author: "fvermaut",
  createdAt: "2026-08-01T09:00:00Z",
  comments: [],
};

interface PostedComment {
  number: number;
  body: string;
}

function fakeAdapter(ticket: TicketThread = thread): {
  adapter: TicketingAdapter;
  comments: PostedComment[];
} {
  const comments: PostedComment[] = [];
  const adapter: TicketingAdapter = {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [ticket];
    },
    async getTicket(): Promise<TicketThread> {
      return ticket;
    },
    async postComment(_project, number, body): Promise<void> {
      comments.push({ number, body });
    },
    async applyLabel(): Promise<void> {},
  };
  return { adapter, comments };
}

/** A runtime that records the request and reports the given outcome. */
function fakeRuntime(
  outcome: { ok: boolean; error?: string } = { ok: true },
): { runtime: SessionRuntime; requests: SessionRequest[] } {
  const requests: SessionRequest[] = [];
  const runtime: SessionRuntime = {
    async start(request) {
      requests.push(request);
      return {
        sessionId: "session-abc",
        completed: Promise.resolve({ sessionId: "session-abc", ...outcome }),
      };
    },
  };
  return { runtime, requests };
}

/** A picked-up run on scratch-app#7. */
function pickedUpRun(store: RunStore): Run {
  return store.register("scratch-app", 7).run;
}

describe("spawn configuration", () => {
  it("runs the session from the timone root, never inside the project", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/Users/fvermaut/dev/timone",
    }).spawn(pickedUpRun(store), project);

    expect(requests[0].cwd).toBe("/Users/fvermaut/dev/timone");
  });

  it("carries the project, the ticket and its body verbatim", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project);

    const { prompt } = requests[0];
    expect(prompt).toContain("scratch-app");
    expect(prompt).toContain("#7");
    expect(prompt).toContain(thread.body);
    expect(prompt).toContain("projects/scratch-app");
  });

  it("tells the session to classify, and never tells it the classification", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project);

    const { prompt } = requests[0];
    expect(prompt).toMatch(/classify/i);
    expect(prompt).toContain("triage:<kind>");
    expect(prompt).not.toMatch(/triage:(bug|feature|chore|question)\b/);
  });

  it("includes the comment thread when the ticket has one", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({
      ...thread,
      comments: [
        {
          author: "fvermaut",
          body: "it's worst on the archive page",
          createdAt: "2026-08-01T10:00:00Z",
          fromTimone: false,
        },
      ],
    });
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project);

    expect(requests[0].prompt).toContain("it's worst on the archive page");
  });

  it("tells the session to mark the comments it writes as the machine's", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project);

    expect(requests[0].prompt).toContain(MACHINE_MARKER);
  });

  it("shows the session which thread comments are its own, not the human's", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({
      ...thread,
      comments: [
        {
          author: "fvermaut",
          body: "Picked this up.",
          createdAt: "2026-08-01T10:00:00Z",
          fromTimone: true,
        },
        {
          author: "fvermaut",
          body: "it's worst on the archive page",
          createdAt: "2026-08-01T11:00:00Z",
          fromTimone: false,
        },
      ],
    });
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project);

    const { prompt } = requests[0];
    const machineLine = prompt
      .split("\n")
      .find((line) => line.includes("Picked this up.") || line.includes("---"));
    expect(machineLine).toBeDefined();
    // Both comments carry the same author; the prompt must still separate them.
    expect(prompt).toMatch(/Timone \(you\), earlier/);
    expect(prompt).toMatch(/fvermaut \(a person\)/);
  });
});

describe("target validation", () => {
  it("refuses a project the manifest does not declare", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();
    const run = store.register("not-managed", 3).run;

    await expect(
      new AgentSessionSpawner({
        manifest,
        store,
        adapter,
        runtime,
        root: "/root",
      }).spawn(run, { name: "not-managed", repoUrl: "https://x/y.git" }),
    ).rejects.toThrow(/not-managed/);

    expect(requests).toEqual([]);
    expect(store.get(run.id)?.status).toBe("picked-up");
  });
});

describe("run lifecycle", () => {
  it("activates on start and parks once on a clean exit", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: true });
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(run, project);

    const finished = store.get(run.id);
    expect(finished?.status).toBe("parked");
    expect(finished?.sessionId).toBe("session-abc");
    expect(finished?.waitingOn).toBeTruthy();
    expect(comments).toHaveLength(1);
    expect(comments[0].number).toBe(7);
  });

  it("ends the parking comment with a call to action", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: true });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project);

    const lastLine = comments[0].body.trimEnd().split("\n").at(-1) ?? "";
    expect(lastLine).toMatch(/\*\*What I need from you:\*\*/);
    expect(comments[0].body).not.toMatch(/timone-\w+|sub-phase/i);
  });

  it("fails the run when the session ends badly, and says so on the ticket", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: false, error: "model unavailable" });
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(run, project);

    const finished = store.get(run.id);
    expect(finished?.status).toBe("failed");
    expect(finished?.failure).toMatch(/model unavailable/);
    expect(comments[0].body).toMatch(/\*\*What I need from you:\*\*/);
  });

  it("flips the run state exactly once when the session ends", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: true });
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("parked");
    expect(comments).toHaveLength(1);
    // And a second exit flip is refused by the store, not merely avoided here.
    expect(() => store.park(run.id, { waitingOn: "again" })).toThrow(/parked/);
  });

  it("runs the post-session checks after the session, not before", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: true });
    const order: string[] = [];
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      afterSession: async (finishedRun) => {
        order.push(`checked:${finishedRun.id}`);
      },
    }).spawn(run, project);

    expect(order).toEqual(["checked:scratch-app#7"]);
  });

  it("does not let a failing post-session check crash the spawn", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: true });
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      afterSession: async () => {
        throw new Error("git blew up");
      },
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("parked");
  });
});
