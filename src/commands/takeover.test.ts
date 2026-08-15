import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PullRequest,
  PullRequestThread,
  Ticket,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import { takeoverPrompt } from "../daemon/prompts.js";
import { acquireStateLock } from "../daemon/lock.js";
import {
  parseTarget,
  resolveTakeover,
  runTakeover,
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

/**
 * A decision ticket off a wayfinder map, as PRD-02.R20's own preamble
 * describes one: charted by an interactive stage-2 session straight through
 * `gh`, so the ledger has never heard of it and — until ADR-0024 — nothing
 * could take it over.
 */
const decisionTicket: Ticket = {
  number: 12,
  title: "should the toggle live in settings or in the header?",
  body: "one decision off the map, waiting on a person",
  labels: ["wayfinder:grilling"],
  url: "https://github.com/fvermaut/scratch-app/issues/12",
  author: "fvermaut",
  createdAt: "2026-08-03T09:00:00Z",
};

const decisionThread: TicketThread = {
  ...decisionTicket,
  comments: [
    {
      author: "fvermaut",
      body: "charted this one off the map.",
      createdAt: "2026-08-03T09:30:00Z",
      fromTimone: true,
    },
  ],
};

/** The map itself: a ticket takeover must refuse — see 20f's handoff. */
const mapTicket: Ticket = {
  ...decisionTicket,
  number: 1,
  title: "map: the dark-mode effort",
  labels: ["timone", "wayfinder:map"],
};

const mapThread: TicketThread = { ...mapTicket, comments: [] };

/** An ordinary request nobody has classified: the ticket #5 shape. */
const unmarkedTicket: Ticket = {
  ...decisionTicket,
  number: 5,
  title: "can I get a dark mode?",
  labels: [],
};

const unmarkedThread: TicketThread = { ...unmarkedTicket, comments: [] };

/** Every ticket the fake tracker knows about, by number. */
const trackerThreads: Record<number, TicketThread> = {
  1: mapThread,
  5: unmarkedThread,
  6: thread,
  12: decisionThread,
};

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
 * A tracker holding `open` as its open issues. Anything not in
 * {@link trackerThreads} does not exist at all, and reading it throws the way
 * `gh` does — which is what lets a test tell a closed ticket from an absent
 * one rather than assert against one answer for both.
 */
function fakeAdapter(open: readonly Ticket[] = []): {
  adapter: TicketingAdapter;
  asked: number[];
  listings: string[];
} {
  const asked: number[] = [];
  const listings: string[] = [];
  const adapter: TicketingAdapter = {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [];
    },
    async listOpenTickets(project: TicketingProject): Promise<Ticket[]> {
      listings.push(project.name);
      return [...open];
    },
    async getTicket(_project: TicketingProject, number: number) {
      asked.push(number);
      const found = trackerThreads[number];
      if (found === undefined) {
        throw new Error(`gh: could not resolve to an issue: #${number}`);
      }
      return found;
    },
    async postComment() {},
    async applyLabel() {},
    ...noPullRequests,
  };
  return { adapter, asked, listings };
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
  it("resolves a ticket waiting on a conversation to that stage", async () => {
    const store = parkedOnConversation(newStore());
    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution).toMatchObject({ kind: "converse", stage: "clarification" });
  });

  it("sends a ticket waiting on a gate back to the ticket, rather than opening an interview", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.park(run.id, {
      waitingOn: "your approval of what I wrote down",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T10:00:00Z",
    });

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution.kind).toBe("answer-on-ticket");
    expect(resolution).toMatchObject({
      message: expect.stringContaining("your approval of what I wrote down"),
    });
  });

  it("says what it is doing instead when the ticket is being worked on", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution.kind).toBe("nothing-to-do");
    expect(resolution).toMatchObject({
      message: expect.stringMatching(/working on .* right now/),
    });
  });

  it("explains a queued ticket rather than starting it out of turn", async () => {
    const store = parkedOnConversation(newStore(), 4);
    const first = store.get("scratch-app#4/1");
    store.activate(first!.id, "session-again");
    store.claimBranch(first!.id, "timone/4-something");
    store.park(first!.id, { waitingOn: "approval", kind: "gate" });
    store.register("scratch-app", 6);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringMatching(/queue/),
    });
  });

  it("names the projects it knows when asked about one it doesn't", async () => {
    const resolution = await resolveTakeover(
      { project: "nope", ticket: 1 },
      { manifest, store: newStore(), adapter: fakeAdapter().adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("scratch-app"),
    });
  });

  it("does not guess at a park it cannot resume", async () => {
    // Phase 11 parked runs with no waiting kind at all. Guessing which
    // conversation those want would invent one.
    const store = newStore();
    const { run } = store.register("scratch-app", 4);
    store.activate(run.id, "session-1");
    store.park(run.id, { waitingOn: "the next stage to be built", stage: "triage" });

    expect(
      await resolveTakeover(
        { project: "scratch-app", ticket: 4 },
        { manifest, store, adapter: fakeAdapter().adapter },
      ),
    ).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("the next stage to be built"),
    });
  });
});

describe("a ticket the ledger has never heard of", () => {
  it("resolves an open wayfinder ticket from the tracker, at its own stage", async () => {
    // PRD-02.R20's second criterion, and the refusal ADR-0024 retires: this
    // ticket was charted straight through `gh`, so it has no run — which used
    // to be the end of the conversation.
    const { adapter } = fakeAdapter([decisionTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 12 },
      { manifest, store: newStore(), adapter },
    );

    expect(resolution).toMatchObject({ kind: "converse", stage: "wayfinding" });
  });

  it("creates the run, parked on the conversation, at the stage the labels say", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter([decisionTicket]);

    await resolveTakeover({ project: "scratch-app", ticket: 12 }, {
      manifest,
      store,
      adapter,
    });

    expect(store.get("scratch-app#12/1")).toMatchObject({
      status: "parked",
      stage: "wayfinding",
      waitingKind: "conversation",
      // Past everything already said: the newest comment on the thread, so
      // nothing written before this conversation existed can answer it.
      waitCursor: "2026-08-03T09:30:00Z",
    });
  });

  it("enters a ticket nobody has classified at triage, and leaves it picked up", async () => {
    // `scratch-app` #5's shape — filed, unlabelled, never spoken to. It is
    // not waiting on a human, so nothing here says it is.
    const store = newStore();
    const { adapter } = fakeAdapter([unmarkedTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 5 },
      { manifest, store, adapter },
    );

    expect(resolution).toMatchObject({ kind: "converse", stage: "triage" });
    expect(store.get("scratch-app#5/1")).toMatchObject({
      status: "picked-up",
      stage: "triage",
    });
    expect(store.get("scratch-app#5/1")?.waitingKind).toBeUndefined();
  });

  it("still refuses a closed ticket, in a sentence of its own", async () => {
    // It exists on the tracker and is not in the open listing.
    const store = newStore();
    const { adapter } = fakeAdapter([decisionTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("is closed"),
    });
    expect(store.all()).toEqual([]);
  });

  it("still refuses a ticket that does not exist, in a sentence of its own", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter([decisionTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 99 },
      { manifest, store, adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("no ticket #99"),
    });
    expect(store.all()).toEqual([]);
  });

  it("answers neither refusal with the sentence ADR-0024 retired", async () => {
    // The one sentence that may never come back for a ticket that is merely
    // unknown to the ledger. Both survivors have to say something else.
    const { adapter } = fakeAdapter([decisionTicket]);
    const said: string[] = [];

    for (const ticket of [6, 99]) {
      const resolution = await resolveTakeover(
        { project: "scratch-app", ticket },
        { manifest, store: newStore(), adapter },
      );
      if (resolution.kind !== "converse") said.push(resolution.message);
    }

    expect(said).toHaveLength(2);
    expect(said.join("\n")).not.toMatch(/I'm not working on/);
    expect(said.join("\n")).not.toMatch(/`timone` label/);
  });

  it("refuses a map, and opens no wait on it", async () => {
    // 20f: `charting` starts no session of its own, so a takeover here would
    // hand back a refusal — and a run created on the way to one would put a
    // question on the map that nobody has asked yet.
    const store = newStore();
    const { adapter, asked } = fakeAdapter([mapTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 1 },
      { manifest, store, adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining("stage I can't hold a conversation for"),
    });
    expect(store.all()).toEqual([]);
    expect(asked).toEqual([]);
  });

  it("queues a ticket behind the run holding its project, rather than opening a second session", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.park(run.id, { waitingOn: "your approval", kind: "gate" });
    const { adapter } = fakeAdapter([decisionTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 12 },
      { manifest, store, adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringMatching(/queue/),
    });
    expect(store.get("scratch-app#12/1")).toMatchObject({ status: "queued" });
  });
});

describe("the prompt a takeover starts from", () => {
  // What the prompt must contain is `prompts.test.ts`'s business — it is the
  // same prompt the daemon would use. What matters here is that the command
  // hands over that prompt and not one of its own.
  it("is the stage's own prompt, for the stage the ticket is waiting at", () => {
    expect(takeoverPrompt("scratch-app", "clarification", thread)).toContain(
      "the message box is hard to use on mobile",
    );
  });

  it("copes with a ticket nobody has replied to", () => {
    expect(
      takeoverPrompt("scratch-app", "clarification", { ...thread, comments: [] }),
    ).toContain("(no replies yet)");
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

  it("does not read the ticket at all when the ledger already says there is nothing to take over", async () => {
    // Amended by ADR-0024, and only in its GIVEN: a ticket the *ledger* has
    // never heard of is now resolved **from** the tracker, so reading it is
    // the answer rather than a wasted call. Where the ledger answers on its
    // own — this run finished — the tracker is still not asked at all.
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.complete(run.id);
    const { adapter, asked, listings } = fakeAdapter([decisionTicket]);
    const { launcher, calls } = fakeLauncher();

    await runTakeover("scratch-app#6", {
      manifest,
      store,
      adapter,
      launcher,
      root: "/root",
      log: () => {},
    });

    expect(asked).toEqual([]);
    expect(listings).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("opens the session for a ticket the ledger had never heard of, reading it once", async () => {
    // R21's sixth criterion, end to end: no run, no label, and the stage-2
    // conversation opens anyway — off the tracker.
    const store = newStore();
    const { adapter, asked } = fakeAdapter([decisionTicket]);
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app#12", {
      manifest,
      store,
      adapter,
      launcher,
      root: "/root",
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toContain(
      "should the toggle live in settings or in the header?",
    );
    expect(calls[0].args[0]).toContain("one decision on a shared map");
    expect(said.join("\n")).not.toMatch(/I'm not working on/);
    // One fetch for the whole command: the wait was opened from the same
    // thread the prompt is built out of (19d's property, on this path).
    expect(asked).toEqual([12]);
    expect(store.get("scratch-app#12/1")).toMatchObject({ status: "parked" });
  });
});

describe("takeover and the ledger's one writer", () => {
  it("starts no session while a daemon holds the ledger, and says who has it", async () => {
    // ADR-0023: takeover spawns a session too, and was racing the daemon by
    // the same three faults — so it takes the same lock or it does not run.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-lock-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    parkedOnConversation(store);
    const daemon = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    expect(daemon.ok).toBe(true);

    const { adapter } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      log: (message) => said.push(message),
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(said.join("\n")).toContain("timone daemon");
    expect(said.join("\n")).toContain("4213");
  });

  it("creates no run from the tracker while a daemon holds the ledger", async () => {
    // Since ADR-0024 the *resolution* writes: a ticket with no run gets one.
    // So it has to happen inside the hold, or a refused takeover would have
    // registered a run in a ledger it was refused — phase 19's fault in a
    // new costume.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-enrol-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    const daemon = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    expect(daemon.ok).toBe(true);

    const { adapter, listings } = fakeAdapter([decisionTicket]);
    const { launcher, calls } = fakeLauncher();

    const code = await runTakeover("scratch-app#12", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      log: () => {},
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(listings).toEqual([]);
    expect(store.all()).toEqual([]);
  });
});

describe("a ticket waiting on a pull-request review", () => {
  it("redirects to the pull request instead of opening anything", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "delivery",
    });

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution.kind).toBe("answer-on-ticket");
    if (resolution.kind === "answer-on-ticket") {
      expect(resolution.message).toMatch(/pull request #9/);
    }
  });
});
