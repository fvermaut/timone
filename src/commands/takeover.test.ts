import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  Ticket,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import {
  parseTarget,
  resolveTakeover,
  runTakeover,
  takeoverPrompt,
  type ProcessLauncher,
} from "./takeover.js";

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
  const dir = mkdtempSync(join(tmpdir(), "timone-takeover-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-03T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

/** A run parked on a conversation at the clarification stage. */
function parkedOnConversation(store: RunStore, ticket = 6): RunStore {
  const { run } = store.register("scratch-app", ticket);
  store.activate(run.id, "session-1");
  store.park(run.id, {
    waitingOn: "a conversation in your terminal",
    kind: "conversation",
    stage: "clarification",
  });
  return store;
}

const thread: TicketThread = {
  number: 6,
  title: "typing in the box is fiddly on my phone",
  body: "the message box is hard to use on mobile",
  labels: ["timone", "triage:feature"],
  url: "https://github.com/fvermaut/scratch-app/issues/6",
  author: "fvermaut",
  createdAt: "2026-08-03T09:00:00Z",
  comments: [
    {
      author: "fvermaut",
      body: "Picked this up.",
      createdAt: "2026-08-03T09:05:00Z",
      fromTimone: true,
    },
    {
      author: "fvermaut",
      body: "it's worse in landscape",
      createdAt: "2026-08-03T09:10:00Z",
      fromTimone: false,
    },
  ],
};

function fakeAdapter(): { adapter: TicketingAdapter; asked: number[] } {
  const asked: number[] = [];
  const adapter: TicketingAdapter = {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [];
    },
    async getTicket(_project: TicketingProject, number: number) {
      asked.push(number);
      return thread;
    },
    async postComment() {},
    async applyLabel() {},
  };
  return { adapter, asked };
}

function fakeLauncher(exitCode = 0): {
  launcher: ProcessLauncher;
  calls: { command: string; args: readonly string[]; cwd: string }[];
} {
  const calls: { command: string; args: readonly string[]; cwd: string }[] = [];
  const launcher: ProcessLauncher = {
    async run(command, args, options) {
      calls.push({ command, args, cwd: options.cwd });
      return exitCode;
    },
  };
  return { launcher, calls };
}

describe("parseTarget", () => {
  it("reads <project>#<ticket>", () => {
    expect(parseTarget("scratch-app#6")).toEqual({
      project: "scratch-app",
      ticket: 6,
    });
  });

  it.each(["scratch-app", "#6", "scratch-app#", "scratch-app#six", "a b#1"])(
    "refuses %j with the shape it wanted",
    (raw) => {
      expect(() => parseTarget(raw)).toThrow(/<project>#<ticket>/);
    },
  );
});

describe("resolveTakeover", () => {
  it("resolves a ticket waiting on a conversation to that stage", () => {
    const store = parkedOnConversation(newStore());
    const resolution = resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store },
    );

    expect(resolution).toMatchObject({ kind: "converse", stage: "clarification" });
  });

  it("sends a ticket waiting on a gate back to the ticket, rather than opening an interview", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.park(run.id, {
      waitingOn: "your approval of what I wrote down",
      kind: "gate",
      stage: "requirements",
      gateCursor: "2026-08-03T10:00:00Z",
    });

    const resolution = resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store },
    );

    expect(resolution.kind).toBe("answer-on-ticket");
    expect(resolution).toMatchObject({
      message: expect.stringContaining("your approval of what I wrote down"),
    });
  });

  it("says what it is doing instead when the ticket is being worked on", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");

    const resolution = resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store },
    );

    expect(resolution.kind).toBe("nothing-to-do");
    expect(resolution).toMatchObject({
      message: expect.stringMatching(/working on .* right now/),
    });
  });

  it("explains a queued ticket rather than starting it out of turn", () => {
    const store = parkedOnConversation(newStore(), 4);
    const first = store.get("scratch-app#4");
    store.activate(first!.id, "session-again");
    store.claimBranch(first!.id, "timone/4-something");
    store.park(first!.id, { waitingOn: "approval", kind: "gate" });
    store.register("scratch-app", 6);

    const resolution = resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringMatching(/queue/),
    });
  });

  it("names the projects it knows when asked about one it doesn't", () => {
    const resolution = resolveTakeover(
      { project: "nope", ticket: 1 },
      { manifest, store: newStore() },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("scratch-app"),
    });
  });

  it("tells the human how to start work on an untracked ticket", () => {
    const resolution = resolveTakeover(
      { project: "scratch-app", ticket: 99 },
      { manifest, store: newStore() },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("`timone` label"),
    });
  });

  it("does not guess at a park it cannot resume", () => {
    // Phase 11 parked runs with no waiting kind at all. Guessing which
    // conversation those want would invent one.
    const store = newStore();
    const { run } = store.register("scratch-app", 4);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "the next stage to be built", stage: "triage" });

    expect(
      resolveTakeover({ project: "scratch-app", ticket: 4 }, { manifest, store }),
    ).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("the next stage to be built"),
    });
  });
});

describe("takeoverPrompt", () => {
  const prompt = takeoverPrompt("scratch-app", "clarification", thread);

  it("carries the ticket in the words it was written in", () => {
    expect(prompt).toContain("the message box is hard to use on mobile");
    expect(prompt).toContain("typing in the box is fiddly on my phone");
  });

  it("separates the voices, since the account name cannot", () => {
    expect(prompt).toMatch(/Timone \(you\), earlier[\s\S]*Picked this up\./);
    expect(prompt).toMatch(/fvermaut \(a person\)[\s\S]*it's worse in landscape/);
  });

  it("names the stage being resumed and the project to touch", () => {
    expect(prompt).toContain("clarification");
    expect(prompt).toContain("projects/scratch-app/");
  });

  it("says the session carries nothing over, so it rebuilds from artifacts", () => {
    expect(prompt).toMatch(/nothing was carried over/i);
  });

  it("requires an accepted summary on the ticket, and no transcript anywhere", () => {
    expect(prompt).toMatch(/accepted summary to the ticket/i);
    expect(prompt).toMatch(/not an artifact/i);
  });

  it("forbids asking the human to name a stage or a skill", () => {
    expect(prompt).toMatch(/never ask them to name a stage/i);
  });

  it("copes with a ticket nobody has replied to", () => {
    expect(takeoverPrompt("scratch-app", "clarification", { ...thread, comments: [] }))
      .toContain("(no replies yet)");
  });
});

describe("runTakeover", () => {
  it("execs the conversation session at the timone root", async () => {
    const store = parkedOnConversation(newStore());
    const { adapter, asked } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      adapter,
      launcher,
      root: "/root",
      log: () => {},
    });

    expect(code).toBe(0);
    expect(asked).toEqual([6]);
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("claude");
    expect(calls[0].cwd).toBe("/root");
    expect(calls[0].args[0]).toContain("typing in the box is fiddly on my phone");
  });

  it("returns the session's own exit code", async () => {
    const { adapter } = fakeAdapter();
    const { launcher } = fakeLauncher(3);

    expect(
      await runTakeover("scratch-app#6", {
        manifest,
        store: parkedOnConversation(newStore()),
        adapter,
        launcher,
        root: "/root",
        log: () => {},
      }),
    ).toBe(3);
  });

  it("starts nothing when the ticket is waiting on a ticket reply", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "your approval", kind: "gate" });
    const { adapter } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      adapter,
      launcher,
      root: "/root",
      log: (message) => said.push(message),
    });

    expect(calls).toEqual([]);
    expect(code).toBe(0);
    expect(said.join("\n")).toMatch(/answer on the ticket/i);
  });

  it("starts nothing, and fails, on a target it cannot make sense of", async () => {
    const { adapter } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app", {
      manifest,
      store: newStore(),
      adapter,
      launcher,
      root: "/root",
      log: (message) => said.push(message),
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(said.join("\n")).toMatch(/<project>#<ticket>/);
  });

  it("does not read the ticket at all when there is nothing to take over", async () => {
    const { adapter, asked } = fakeAdapter();
    const { launcher } = fakeLauncher();

    await runTakeover("scratch-app#99", {
      manifest,
      store: newStore(),
      adapter,
      launcher,
      root: "/root",
      log: () => {},
    });

    expect(asked).toEqual([]);
  });
});
