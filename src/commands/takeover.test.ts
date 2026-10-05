import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PullRequest,
  PullRequestThread,
  Step,
  Ticket,
  TicketingAdapter,
  TicketComment,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import {
  noBranches,
  noFiles,
  noRunnerCalls,
  noMerges, noStepWrites } from "../adapters/ticketing.stubs.js";
import type { Manifest } from "../manifest.js";
import { RunStore, type Run } from "../daemon/runs.js";
import { takeoverPrompt } from "../daemon/prompts.js";
import { RUNNER_DEFAULT_WAIT } from "../runner/session.js";
import { acquireStateLock, stateLockPath } from "../daemon/lock.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import {
  enqueue,
  pending,
  settle,
  WATCH_BOUND_MS,
} from "../daemon/requests.js";
import type { Holder } from "../daemon/holder.js";
import { intervalTicker } from "../daemon/session.js";
import { DEFAULT_POLL_INTERVAL_SECONDS } from "../daemon/poll.js";
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

/**
 * A run waiting for the runner at the clarification stage. An old kind of
 * wait reads back as the runner's since 2026-09-30 (timone#166), so this is
 * the wait a takeover finds a parked run on.
 */
function waitingForRunner(store: RunStore, ticket = 6): RunStore {
  const { run } = store.register("scratch-app", ticket);
  store.activate(run.id, "session-1");
  store.park(run.id, {
    waitingOn: "your answer to the question in my last comment.",
    kind: "runner",
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
  async findOpenPullRequestOfTicket(): Promise<undefined> {
    return undefined;
  },
  async getPullRequestThread(): Promise<PullRequestThread> {
    throw new Error("no pull request exists in this test");
  },
  async postPullRequestComment(): Promise<void> {},
  async upsertPullRequestComment(): Promise<void> {},
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
    async listPullRequestFiles(): Promise<string[]> {
      return [];
    },
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
    // No initiative in this test is broken into step tickets.
    async listSteps(): Promise<Step[]> {
      return [];
    },
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

function fakeLauncher(
  options: number | { exitCode?: number; onRun?: () => void } = 0,
): {
  launcher: ProcessLauncher;
  calls: { command: string; args: readonly string[]; cwd: string }[];
} {
  const settings = typeof options === "number" ? { exitCode: options } : options;
  const calls: { command: string; args: readonly string[]; cwd: string }[] = [];
  const launcher: ProcessLauncher = {
    async run(command, args, opened) {
      calls.push({ command, args, cwd: opened.cwd });
      // What the person did while the conversation was open, when a case
      // needs one: the ledger moving under a live takeover is a real event
      // and can only be staged from here.
      settings.onRun?.();
      return settings.exitCode ?? 0;
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

  // ✏ 2026-10-04: this asserted a queued ticket's answer. No ticket is queued
  // any more (ADR-0063 D2): one picked up while another run is parked on its
  // branch is picked up, and gets the answer every picked-up run gets.
  it("says it is working on a ticket picked up while another run is parked on its branch", async () => {
    const store = newStore();
    const { run: first } = store.register("scratch-app", 4);
    store.activate(first.id, "session-1");
    store.claimBranch(first.id, "timone/4-something");
    store.park(first.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
    });
    store.register("scratch-app", 6);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringMatching(/working on .* right now/),
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

  it("says a cancelled chunk on a closed ticket was abandoned, and what would start the work again", async () => {
    // 22b: `cancelled` is not `parked`. With no arm of its own it fell past the
    // parked case and told the human their ticket was parked on nothing — with
    // the reason sitting in `cancellation`, unread, all along.
    const store = newStore();
    const { run } = store.register("scratch-app", 4);
    store.activate(run.id, "session-1");
    store.cancel(run.id, "the ticket is no longer open and marked for me");

    // No open ticket: #4 is closed. An open one gets a new run (41m).
    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 4 },
      { manifest, store, adapter: fakeAdapter([]).adapter },
    );

    expect(resolution).toMatchObject({
      kind: "nothing-to-do",
      message: expect.stringContaining(
        "scratch-app #4 was cancelled: the ticket is no longer open and " +
          "marked for me.",
      ),
    });
    // Abandoned, not broken, and never parked: the words a person reads must
    // not hand them a fault to look for, nor a chunk to count.
    const said = resolution.kind === "open-session" ? "" : resolution.message;
    // ✏ 2026-10-02: a cancel holds every ticket since 40u, step or not, and
    // the cycle passes a held ticket over. So reopening and marking it starts
    // nothing: the way back is to reopen it and take the hold off. Until then
    // this test said the opposite, because only a dropped step was held. The
    // cycle also lists only marked tickets, and a run cancelled before 40u has
    // no hold, so the words name the mark and say "if it has it".
    expect(said).toMatch(/reopen the ticket/);
    expect(said).toContain("make sure it has the `timone` label");
    expect(said).toContain("take the `timone:held` label off if it has it");
    expect(said).not.toMatch(/mark it for me/);
    expect(said).not.toMatch(/parked|failed|stopped early|scratch-app#4/);
  });
});

describe("a ticket the ledger has never heard of", () => {
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
      if (resolution.kind === "nothing-to-do") said.push(resolution.message);
    }

    expect(said).toHaveLength(2);
    expect(said.join("\n")).not.toMatch(/I'm not working on/);
    expect(said.join("\n")).not.toMatch(/`timone` label/);
  });

  // ✏ 2026-10-04: this asserted that the new run was queued behind #6. A
  // branch takes no place (ADR-0063 D1, D5; PRD-07 R13), so the takeover
  // opens a session on the new run.
  it("opens a session on a new ticket while another run is parked on its branch", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
    });
    const { adapter } = fakeAdapter([decisionTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 12 },
      { manifest, store, adapter },
    );

    expect(resolution).toMatchObject({ kind: "open-session" });
    expect(store.get("scratch-app#12/1")).toMatchObject({ status: "parked" });
  });
});

describe("runTakeover", () => {
  it("execs the session at the timone root", async () => {
    const store = waitingForRunner(newStore());
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
        store: waitingForRunner(newStore()),
        adapter,
        launcher,
        root: "/root",
        log: () => {},
      }),
    ).toBe(3);
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
    // own — this run is at work — the tracker is still not asked at all.
    // ✏ 2026-10-02 (41m): the run was a finished one. A finished run now gets
    // a new run when its ticket is still open, so the tracker is asked.
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
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

});

describe("takeover and the ledger's one writer", () => {
  it("asks the daemon holding the ledger, names it, and gives up saying so", async () => {
    // ADR-0032 replaced the refusal that used to stand here. Exclusivity is
    // the run's status now, not the lock, so a live daemon is asked to hand
    // the run over rather than being a wall. This is the fixture where it
    // never does, which must end rather than hang.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-lock-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    waitingForRunner(store);
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
      wait: { intervalMs: 1, boundMs: 3, sleep: async () => {} },
      log: (message) => said.push(message),
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(said.join("\n")).toContain("timone daemon");
    expect(said.join("\n")).toContain("4213");
    expect(said.join("\n")).toContain("still queued");
    // **Asked, and the ask taken back** — reversed at 31j (ADR-0049 D3). It
    // used to be left on disk "for the daemon to find", and that is
    // timone#78: the daemon found it minutes later and handed the run to a
    // terminal that had gone, leaving a claim nobody was holding and a ticket
    // answering with a refusal that was not true.
    expect(pending(statePath).requests).toEqual([]);
    // Untouched: the conversation never started, so the run still waits.
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  it("creates no run from the tracker while a daemon holds the ledger", async () => {
    // Since ADR-0024 the *resolution* writes: a ticket with no run gets one.
    // The invariant survives ADR-0032 unchanged and matters as much: a
    // takeover that could not get the ledger must not have written to it.
    // What changed is who enrols — the daemon does, from the request, and
    // this command does not reach the tracker at all.
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
      wait: { intervalMs: 1, boundMs: 3, sleep: async () => {} },
      log: () => {},
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(listings).toEqual([]);
    expect(store.all()).toEqual([]);
  });

  it("creates no new run of an open ticket whose latest run is done while a daemon holds the ledger", async () => {
    // ✏ 2026-10-02 (41m): a takeover of such a ticket registers a new run.
    // That is a write, so it is the daemon's to make, from the request, as
    // for a ticket with no run.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-settled-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    const { run } = store.register("scratch-app", 12);
    store.activate(run.id, "session-1");
    store.complete(run.id);
    const daemon = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    expect(daemon.ok).toBe(true);
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app#12", {
      manifest,
      store,
      statePath,
      adapter: fakeAdapter([decisionTicket]).adapter,
      launcher,
      root: "/root",
      wait: { intervalMs: 1, boundMs: 3, sleep: async () => {} },
      log: (message) => said.push(message),
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    // The daemon was asked, and the ask taken back when it did not answer.
    expect(said.join("\n")).toContain("timone daemon");
    expect(pending(statePath).requests).toEqual([]);
    expect(store.runsForTicket("scratch-app", 12).map((each) => each.id)).toEqual([
      "scratch-app#12/1",
    ]);
  });
});

describe("a takeover that gives up leaves nothing behind", () => {
  /** A ledger with #6 waiting for the runner, and a daemon holding the lock. */
  function heldLedger(): { statePath: string; store: RunStore } {
    const dir = mkdtempSync(join(tmpdir(), "timone-withdraw-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-09-04T10:00:00Z" });
    waitingForRunner(store);
    const daemon = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    expect(daemon.ok).toBe(true);
    return { statePath, store };
  }

  it("takes its request back, so no later cycle can act on it", async () => {
    const { statePath, store } = heldLedger();
    const { adapter } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      wait: { intervalMs: 1, boundMs: 3, sleep: async () => {} },
      log: () => {},
    });

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(pending(statePath).requests).toEqual([]);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  it("detects a daemon that claimed the run as the request was withdrawn", async () => {
    // The race, played out rather than argued about. The daemon reads the
    // request, the terminal's bound passes and it deletes the file, and the
    // daemon then writes the claim — with the terminal's own holder on it,
    // because that is what the request carries since 31b. A withdraw that
    // assumed it had won would walk away from a run it is holding.
    const { statePath, store } = heldLedger();
    const { adapter } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();

    // What the "daemon" read before the file was removed.
    let read: Holder | undefined;
    let applied = false;
    const sleep = async (): Promise<void> => {
      const queued = pending(statePath).requests[0];
      if (queued?.body.kind === "claim-takeover") read = queued.body.holder;
      if (read !== undefined && !applied && pending(statePath).requests.length === 0) {
        applied = true;
        store.claim("scratch-app#6/1", read);
      }
    };

    const said: string[] = [];
    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      wait: { intervalMs: 1, boundMs: 3, sleep },
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });

    expect(applied).toBe(true);
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(said.join("\n")).toContain("as I was giving up");
    // And the run is not left claimed by nobody. The daemon still holds the
    // ledger here, so the handback is asked for rather than written — and the
    // run carries this terminal's own hold until it lands, which is exactly
    // what timone#78 lacked.
    expect(
      pending(statePath).requests.map((request) => request.body.kind),
    ).toEqual(["release-takeover"]);
    expect(store.get("scratch-app#6/1")?.holder?.token).toBe(read?.token);
  });

  it("waits long enough for a cycle plus an interval, and says what it waited", async () => {
    // The old bound was 75s on the words "one poll interval plus a margin".
    // The daemon sleeps its interval *after* a cycle, so a request left just
    // after a read waits the rest of that cycle and then a full interval —
    // past 90 seconds on measured cycles of 29–33s.
    expect(WATCH_BOUND_MS).toBeGreaterThanOrEqual(
      DEFAULT_POLL_INTERVAL_SECONDS * 1000 + 90_000,
    );

    const { statePath, store } = heldLedger();
    const { adapter } = fakeAdapter();
    const { launcher } = fakeLauncher();
    const said: string[] = [];

    await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      wait: { intervalMs: 1, boundMs: 90_000, sleep: async () => {} },
      log: (message) => said.push(message),
    });

    // It says how long it waited and that a long cycle is not a fault, rather
    // than implying the daemon is not coming.
    expect(said.join("\n")).toContain("1m30s");
    expect(said.join("\n")).toContain("taken the request back");
  });

  it("stamps a sign of life as soon as it starts holding the run", async () => {
    // A plain `setInterval` says nothing for its first whole interval, so a
    // takeover held a run for thirty seconds having given no sign of life at
    // all. That is how wide timone#78's window was.
    const ticks: number[] = [];
    const ticker = intervalTicker(() => ticks.push(1), 60_000);
    try {
      expect(ticks).toHaveLength(1);
    } finally {
      ticker.stop();
    }
  });
});

describe("a takeover that finishes the step it took over", () => {
  /** A store and the path it is written to, which this command needs both of. */
  function ledger(): { store: RunStore; statePath: string } {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-end-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    let tick = 0;
    return {
      statePath,
      store: RunStore.open(statePath, {
        now: () => `2026-08-03T10:${String(tick++).padStart(2, "0")}:00Z`,
      }),
    };
  }

  /**
   * A run waiting for the runner at `requirements`, on a branch. It was
   * parked on a conversation until an old kind of wait read back as the
   * runner's (2026-09-30, timone#166). What these tests check is how the
   * takeover ends, which does not depend on the wait it came from.
   */
  function handedBackAtRequirements(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-the-backfill");
    store.park(run.id, {
      waitingOn: "your answer to the question in my last comment.",
      kind: "runner",
      stage: "requirements",
      waitCursor: "2026-08-03T09:30:00Z",
      resolvableBy: ["requirements"],
    });
    return store.get(run.id) as Run;
  }

  /** A tracker whose thread carries whatever the takeover session posted. */
  function trackerSaying(comments: readonly TicketComment[]): TicketingAdapter {
    const said: TicketThread = { ...thread, comments: [...comments] };
    return {
      ...fakeAdapter().adapter,
      async getTicket(): Promise<TicketThread> {
        return said;
      },
    };
  }

  /** What a session posts when it has finished the step it was given. */
  const finished: TicketComment = {
    author: "fvermaut",
    body: "🏁 **Step finished** · written by the machine when a stage completed its work\n\nThe backfill says where it has got to.",
    createdAt: "2026-08-03T10:48:00Z",
    fromTimone: true,
  };

  it("says so, and writes nothing, when the run moved under it", async () => {
    // timone#63's silent early return. `releaseClaim` returned without a word
    // when the run was no longer active, so a person whose run had been
    // reclaimed, cancelled or taken by another terminal saw a conversation end
    // normally and had no way to know the ledger had gone the other way.
    const { store, statePath } = ledger();
    handedBackAtRequirements(store);
    const { launcher } = fakeLauncher({
      onRun: () => store.cancel("scratch-app#6/1", "you closed the ticket"),
    });
    const said: string[] = [];

    await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter: trackerSaying([finished]),
      launcher,
      root: "/root",
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });

    expect(store.get("scratch-app#6/1")?.status).toBe("cancelled");
    expect(said.join("\n")).toContain("moved while we were talking");
    expect(said.join("\n")).toContain("cancelled");
  });

  it("tells the terminal what happened whichever way it went", async () => {
    // Ending silently is what left #58 looking answered: the person walked
    // away from a terminal that had said nothing about what their session had
    // or had not moved.
    for (const comments of [[finished], []]) {
      const { store, statePath } = ledger();
      handedBackAtRequirements(store);
      const { launcher } = fakeLauncher();
      const said: string[] = [];

      await runTakeover("scratch-app#6", {
        manifest,
        store,
        statePath,
        adapter: trackerSaying(comments),
        launcher,
        root: "/root",
        ticker: () => ({ stop: () => {} }),
        log: (message) => said.push(message),
      });

      expect(said.join("\n")).toMatch(/scratch-app #6/);
    }
  });
});

describe("takeover claims through the run, not the lock", () => {
  /**
   * The slice's central claim, and the only place it is observable: *during*
   * the conversation. Asserted from inside the launcher, because before and
   * after it the lock is free either way.
   */
  it("holds no lock while the conversation runs, and holds the run instead", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-claim-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    // Waiting for the runner: an old kind of wait reads back as the runner's
    // since 2026-09-30 (timone#166), so this is the wait a run now comes from.
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      stage: "clarification",
    });
    const { adapter } = fakeAdapter();
    const seen: { lockHeld: boolean; status?: string }[] = [];
    const launcher: ProcessLauncher = {
      async run() {
        seen.push({
          lockHeld: existsSync(stateLockPath(statePath)),
          status: store.get("scratch-app#6/1")?.status,
        });
        return 0;
      },
    };

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      log: () => {},
    });

    expect(code).toBe(0);
    // No lock during the conversation — the daemon is free to work every
    // other project — and the run is what stops it working this one.
    expect(seen).toEqual([{ lockHeld: false, status: "active" }]);
    // And it is given back afterwards, on the wait it came from.
    const after = store.get("scratch-app#6/1");
    expect(after?.status).toBe("parked");
    expect(after?.wait?.kind).toBe("runner");
    expect(after?.stage).toBe("clarification");
  });

  it("gives the claim back when the conversation throws", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-throw-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    waitingForRunner(store);
    const { adapter } = fakeAdapter();
    const launcher: ProcessLauncher = {
      async run() {
        throw new Error("claude is not installed");
      },
    };

    await expect(
      runTakeover("scratch-app#6", {
        manifest,
        store,
        statePath,
        adapter,
        launcher,
        root: "/root",
        log: () => {},
      }),
    ).rejects.toThrow("claude is not installed");

    // A claim that outlived its session is the stuck run phase 14 closed.
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  /**
   * A signal runs no `finally`, and Ctrl-C is how a conversation ends more
   * often than not — the fact `daemon.ts` already records about its own exit
   * path. Driven by emitting the signal while the launcher is running.
   */
  it("gives the claim back on a signal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-signal-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    waitingForRunner(store);
    const { adapter } = fakeAdapter();
    let duringSignal: string | undefined;
    const launcher: ProcessLauncher = {
      async run() {
        process.emit("SIGINT");
        duringSignal = store.get("scratch-app#6/1")?.status;
        return 130;
      },
    };

    await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      log: () => {},
    });

    expect(duringSignal).toBe("parked");
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  /**
   * The fault the daemon found on ivtrends #27: the claim is `active`, and an
   * active run that stops stamping its heartbeat is reclaimed as dead after
   * two minutes — which killed every takeover while its human was still
   * sitting in it. The beat is asserted from inside the launcher, because
   * that is the whole window it exists for.
   */
  it("keeps the claimed run's heartbeat warm while the conversation runs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-beat-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    let clock = "2026-08-03T10:00:00Z";
    const store = RunStore.open(statePath, { now: () => clock });
    waitingForRunner(store);
    const { adapter } = fakeAdapter();

    let beat: (() => void) | undefined;
    let interval: number | undefined;
    let stopped = 0;
    const before = store.get("scratch-app#6/1")?.heartbeatAt;

    const launcher: ProcessLauncher = {
      async run() {
        clock = "2026-08-03T10:01:00Z";
        beat?.();
        return 0;
      },
    };

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      ticker: (onTick, intervalMs) => {
        beat = onTick;
        interval = intervalMs;
        return { stop: () => void stopped++ };
      },
      log: () => {},
    });

    expect(code).toBe(0);
    // Stamped while the human was in the conversation, so the daemon's dead-run
    // pass sees a live run rather than a quiet one.
    expect(store.get("scratch-app#6/1")?.heartbeatAt).toBe("2026-08-03T10:01:00Z");
    expect(store.get("scratch-app#6/1")?.heartbeatAt).not.toBe(before);
    // The same interval the daemon's own sessions beat at, so the two cannot
    // drift into one being reclaimed and the other not.
    expect(interval).toBe(DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000);
    // And no timer is left behind to hold the process open.
    expect(stopped).toBeGreaterThan(0);
  });

  it("stops beating when a signal ends the conversation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-beat-signal-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    waitingForRunner(store);
    const { adapter } = fakeAdapter();

    let stoppedDuringSignal = 0;
    let stopped = 0;
    const launcher: ProcessLauncher = {
      async run() {
        process.emit("SIGINT");
        stoppedDuringSignal = stopped;
        return 130;
      },
    };

    await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      ticker: () => ({ stop: () => void stopped++ }),
      log: () => {},
    });

    // Ctrl-C runs no `finally`, so the beat has to be stopped on that path
    // too — a live timer would hold the process open past the conversation.
    expect(stoppedDuringSignal).toBeGreaterThan(0);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
  });

  /**
   * The refusal the gate hit, gone. The daemon here is the injected sleep,
   * doing on its "cycle" what `applyRequests` does with a claim request.
   */
  it("starts the conversation once the daemon has handed the run over", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-served-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-03T10:00:00Z" });
    waitingForRunner(store);
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    const { adapter } = fakeAdapter();
    const { launcher, calls } = fakeLauncher();
    const daemonCycle = async (): Promise<void> => {
      for (const request of pending(statePath).requests) {
        if (request.body.kind === "claim-takeover") store.claim("scratch-app#6/1");
        settle(request.path);
      }
    };

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: "/root",
      wait: { intervalMs: 1, boundMs: 100, sleep: daemonCycle },
      log: () => {},
    });

    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    // Given back through the queue, since the daemon still holds the ledger.
    expect(
      pending(statePath).requests.map((request) => request.body.kind),
    ).toEqual(["release-takeover"]);
  });
});

describe("a takeover of a ticket with no run", () => {
  // The runner drives every run (ADR-0060), so a run a takeover opens is
  // opened the way the runner would hold it: waiting for the runner, with
  // no step chosen. ✏ 2026-10-02 (41m): for a ticket nobody has classified.
  // A decision ticket off a map is opened at its step: see the describe
  // below.
  it("registers a run waiting for the runner, and resolves to the session bound to no step, for a ticket with no `wayfinder:` label", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter([unmarkedTicket]);

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: unmarkedTicket.number },
      { manifest, store, adapter },
    );

    expect(resolution.kind).toBe("open-session");
    expect(resolution).not.toHaveProperty("stage");
    const runs = store.runsForTicket("scratch-app", unmarkedTicket.number);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: "parked",
      wait: { kind: "runner", on: RUNNER_DEFAULT_WAIT, resolvableBy: ["triage"] },
    });
    expect(runs[0]?.stage).toBeUndefined();
  });

  it("holds the new run for the terminal, then gives it back to the runner and asks for a wake", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-no-run-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath);
    const { adapter, asked } = fakeAdapter([decisionTicket]);
    const during: { run?: Run; prompt?: string }[] = [];
    const launcher: ProcessLauncher = {
      async run(_command, args) {
        during.push({ run: store.get("scratch-app#12/1"), prompt: args[0] });
        return 0;
      },
    };
    const said: string[] = [];

    const code = await runTakeover("scratch-app#12", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: dir,
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    // Held by this terminal while the session runs, still on the runner's wait.
    expect(during).toHaveLength(1);
    expect(during[0]?.run).toMatchObject({
      status: "active",
      holder: { command: "timone takeover scratch-app#12" },
      wait: { kind: "runner", on: RUNNER_DEFAULT_WAIT },
    });
    // The session bound to no step, built from the ticket read once.
    expect(during[0]?.prompt).toBe(
      takeoverPrompt("scratch-app", during[0]?.run as Run, decisionThread, {
        record: { ok: true, value: [] },
        namedPeople: [],
      }),
    );
    expect(asked).toEqual([12]);
    // Given back to the runner, and the next daemon is asked to wake it.
    expect(store.get("scratch-app#12/1")).toMatchObject({
      status: "parked",
      wait: { kind: "runner", on: RUNNER_DEFAULT_WAIT },
    });
    expect(pending(statePath).requests.map((request) => request.body)).toEqual([
      { kind: "takeover-ended", project: "scratch-app", ticket: 12 },
    ]);
    expect(said.at(-1)).toBe(
      "scratch-app #12 goes back to the runner. It reads what the session left as soon as the daemon runs.",
    );
  });
});

describe("a takeover that opens a new run, at the step its `wayfinder:` label names (41m)", () => {
  // On 2026-10-02 the runner ended the runs of six of Timone's own decision
  // tickets, because their mark had been removed. A takeover of a ticket
  // with no run then gave the new run no step, so the session was not told
  // it was a wayfinding conversation.

  /** A map ticket the ledger has never heard of. */
  const mapTicket: Ticket = {
    ...decisionTicket,
    number: 13,
    title: "dark mode, all of it",
    labels: ["wayfinder:map"],
  };

  /**
   * Take over `ticket` on a fresh ledger, and say what the session saw.
   * `before` writes the ledger first; `open` is the tracker's open listing,
   * `ticket` alone unless given.
   */
  async function takeOverOnFreshLedger(
    ticket: Ticket,
    options: { before?: (store: RunStore) => void; open?: readonly Ticket[] } = {},
  ): Promise<{
    code: number;
    store: RunStore;
    statePath: string;
    during: { run?: Run; prompt?: string }[];
    said: string[];
  }> {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-step-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath);
    options.before?.(store);
    const during: { run?: Run; prompt?: string }[] = [];
    const launcher: ProcessLauncher = {
      async run(_command, args) {
        during.push({
          run: store.runsForTicket("scratch-app", ticket.number).at(-1),
          prompt: args[0],
        });
        return 0;
      },
    };
    const said: string[] = [];
    const code = await runTakeover(`scratch-app#${ticket.number}`, {
      manifest,
      store,
      statePath,
      adapter: fakeAdapter(options.open ?? [ticket]).adapter,
      launcher,
      root: dir,
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });
    return { code, store, statePath, during, said };
  }

  it("gives the new run the step its label names: a decision ticket at wayfinding, a map at charting", async () => {
    for (const [ticket, step] of [
      [decisionTicket, "wayfinding"],
      [mapTicket, "charting"],
    ] as const) {
      const store = newStore();

      const resolution = await resolveTakeover(
        { project: "scratch-app", ticket: ticket.number },
        { manifest, store, adapter: fakeAdapter([ticket]).adapter },
      );

      expect(resolution.kind).toBe("open-session");
      expect(store.runsForTicket("scratch-app", ticket.number)).toEqual([
        expect.objectContaining({
          status: "parked",
          stage: step,
          wait: expect.objectContaining({
            kind: "runner",
            on: RUNNER_DEFAULT_WAIT,
            resolvableBy: [step],
          }),
        }),
      ]);
    }
  });

  it("opens a session on a `wayfinder:grilling` ticket whose prompt names wayfinding and the `timone-wayfind` skill", async () => {
    const { code, store, during } = await takeOverOnFreshLedger(decisionTicket);

    expect(code).toBe(0);
    expect(during).toHaveLength(1);
    expect(during[0]?.run).toMatchObject({ status: "active", stage: "wayfinding" });
    const prompt = during[0]?.prompt ?? "";
    expect(prompt).toContain("- its step: talking a question through (wayfinding)");
    expect(prompt).toContain(
      "**The run's step is a conversation: talking a question through.**",
    );
    expect(prompt).toContain("`timone-wayfind`");
    // Given back to the runner at that step.
    expect(store.get("scratch-app#12/1")).toMatchObject({
      status: "parked",
      stage: "wayfinding",
      wait: { kind: "runner", on: RUNNER_DEFAULT_WAIT },
    });
  });

  it("opens the session with no step on a ticket with no `wayfinder:` label, as before", async () => {
    const { code, store, during } = await takeOverOnFreshLedger(unmarkedTicket);

    expect(code).toBe(0);
    expect(during).toHaveLength(1);
    expect(during[0]?.run).toMatchObject({
      status: "active",
      wait: { kind: "runner", on: RUNNER_DEFAULT_WAIT, resolvableBy: ["triage"] },
    });
    expect(during[0]?.run?.stage).toBeUndefined();
    const prompt = during[0]?.prompt ?? "";
    expect(prompt).toContain("- its step: none yet");
    expect(prompt).not.toMatch(/hold that conversation/i);
    expect(prompt).not.toContain("`timone-wayfind`");
    expect(prompt).not.toContain("`timone-grill`");
    expect(store.get("scratch-app#5/1")?.stage).toBeUndefined();
  });

  // ✏ 2026-10-02 (41m, case 5): the runner ended the runs of six decision
  // tickets, so they were `done`, and a takeover of one answered "finished"
  // and opened nothing. PRD-05.R11 clause 2: a takeover opens a terminal
  // session on any run nothing is working on. An open ticket whose latest run
  // is settled gets a new run, as a ticket with no run does.

  /** Ticket #12's first run, ended by the runner. */
  function endedFirstRun(store: RunStore): void {
    const { run } = store.register("scratch-app", 12);
    store.activate(run.id, "session-1");
    store.complete(run.id);
  }

  it("registers a new run of an open `wayfinder:grilling` ticket whose latest run is done, at wayfinding, and opens the session", async () => {
    const { code, store, during } = await takeOverOnFreshLedger(decisionTicket, {
      before: endedFirstRun,
    });

    expect(code).toBe(0);
    expect(during).toHaveLength(1);
    expect(during[0]?.run).toMatchObject({
      id: "scratch-app#12/2",
      status: "active",
      stage: "wayfinding",
    });
    const prompt = during[0]?.prompt ?? "";
    expect(prompt).toContain("- its step: talking a question through (wayfinding)");
    expect(prompt).toContain("`timone-wayfind`");
    // The finished run stays as it was; the new one goes back to the runner.
    expect(
      store.runsForTicket("scratch-app", 12).map((run) => [run.id, run.status, run.stage]),
    ).toEqual([
      ["scratch-app#12/1", "done", undefined],
      ["scratch-app#12/2", "parked", "wayfinding"],
    ]);
  });

  it("registers the next run of an open ticket whose latest run is done or cancelled", async () => {
    for (const end of ["done", "cancelled"] as const) {
      const store = newStore();
      const { run } = store.register("scratch-app", 12);
      store.activate(run.id, "session-1");
      if (end === "done") store.complete(run.id);
      else store.cancel(run.id, "fvermaut: not now");

      const resolution = await resolveTakeover(
        { project: "scratch-app", ticket: 12 },
        { manifest, store, adapter: fakeAdapter([decisionTicket]).adapter },
      );

      expect(resolution).toMatchObject({
        kind: "open-session",
        run: { id: "scratch-app#12/2", status: "parked", stage: "wayfinding" },
      });
      expect(store.get(run.id)?.status).toBe(end);
    }
  });

  it("gives the finished answer, and opens nothing, when that ticket is closed", async () => {
    const { code, store, statePath, during, said } = await takeOverOnFreshLedger(
      decisionTicket,
      { before: endedFirstRun, open: [] },
    );

    expect(code).toBe(1);
    expect(during).toEqual([]);
    expect(said).toEqual(["scratch-app #12 is finished — see the ticket."]);
    expect(store.runsForTicket("scratch-app", 12).map((run) => run.id)).toEqual([
      "scratch-app#12/1",
    ]);
    expect(pending(statePath).requests).toEqual([]);
  });
});

describe("a takeover of a run that is picked up or running", () => {
  /** A ledger at a path of its own, so the command takes the lock as it does for real. */
  function ledger(): { store: RunStore; statePath: string } {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-busy-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    return { statePath, store: RunStore.open(statePath) };
  }

  /** Run the command on #6, and return what it did. */
  async function takeOver(
    store: RunStore,
    statePath: string,
  ): Promise<{ code: number; said: string[]; launched: number }> {
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];
    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter: fakeAdapter([decisionTicket]).adapter,
      launcher,
      root: "/root",
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });
    return { code, said, launched: calls.length };
  }

  // ✏ 2026-10-04: this asserted a queued run's answer. No run is queued any
  // more (ADR-0063 D2), so the run picked up behind a run parked on its
  // branch gets the answer every picked-up run gets.
  it("starts nothing for a run picked up while another run is parked on its branch, and says it is being worked on", async () => {
    const { store, statePath } = ledger();
    const { run: ahead } = store.register("scratch-app", 4);
    store.activate(ahead.id, "session-1");
    store.claimBranch(ahead.id, "timone/4-something");
    store.park(ahead.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
    });
    const { run } = store.register("scratch-app", 6);

    const { code, said, launched } = await takeOver(store, statePath);

    expect(code).toBe(1);
    expect(launched).toBe(0);
    expect(said).toEqual([
      "I'm working on scratch-app #6 right now. Anything I need from you " +
        "will land on the ticket.",
    ]);
    expect(store.get(run.id)?.status).toBe("picked-up");
    expect(pending(statePath).requests).toEqual([]);
    expect(existsSync(stateLockPath(statePath))).toBe(false);
  });

  it("starts nothing for a run picked up or at work, says it is being worked on, and leaves it as it was", async () => {
    for (const status of ["picked-up", "active"] as const) {
      const { store, statePath } = ledger();
      const { run } = store.register("scratch-app", 6);
      if (status === "active") store.activate(run.id, "session-1");

      const { code, said, launched } = await takeOver(store, statePath);

      expect(code).toBe(1);
      expect(launched).toBe(0);
      expect(said).toEqual([
        "I'm working on scratch-app #6 right now. Anything I need from you " +
          "will land on the ticket.",
      ]);
      expect(store.get(run.id)?.status).toBe(status);
      expect(pending(statePath).requests).toEqual([]);
      expect(existsSync(stateLockPath(statePath))).toBe(false);
    }
  });
});

describe("a run the runner waits on", () => {
  // ADR-0060 and PRD-05 R11: `timone takeover` stays. What a run of the
  // runner does next is the runner's to decide, not a stage's, so the
  // session that opens is the one bound to no stage.
  it("resolves to the session bound to no stage", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });

    const resolution = await resolveTakeover(
      { project: "scratch-app", ticket: 6 },
      { manifest, store, adapter: fakeAdapter().adapter },
    );

    expect(resolution.kind).toBe("open-session");
    expect(resolution).not.toHaveProperty("stage");
  });

  it("opens the session bound to no step, even for a run that stopped at a step", async () => {
    // The step is where the run was, not the session that opens. The prompt
    // is compared whole, because a step's own prompt carries the same ticket.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-unbound-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath);
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/6-message-box");
    store.park(run.id, {
      waitingOn: 'read them and reply "approved", or say what to change.',
      kind: "runner",
      stage: "requirements",
    });
    const { adapter, asked } = fakeAdapter();
    const during: { run?: Run; prompt?: string }[] = [];
    const launcher: ProcessLauncher = {
      async run(command, args, opened) {
        during.push({ run: store.get(run.id), prompt: args[0] });
        expect(command).toBe("claude");
        expect(opened.cwd).toBe(dir);
        return 0;
      },
    };
    const said: string[] = [];

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter,
      launcher,
      root: dir,
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(during).toHaveLength(1);
    expect(during[0]?.run).toMatchObject({ status: "active", stage: "requirements" });
    expect(during[0]?.prompt).toBe(
      takeoverPrompt("scratch-app", during[0]?.run as Run, thread, {
        record: { ok: true, value: [] },
        namedPeople: [],
      }),
    );
    expect(asked).toEqual([6]);
    expect(said[0]).toBe(
      "Picking up scratch-app #6 here. When you end this session, the runner reads the ticket and decides what comes next.",
    );
  });

  it("gives the run back to the runner when no daemon is running, and leaves the daemon a request to wake it", async () => {
    // PRD-05 R11: when the terminal session ends, the runner wakes and reads
    // what it left. With no daemon running, nothing can wake it now, so the
    // next daemon is asked to.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-runner-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath);
    const { run } = store.register("scratch-app", 6);
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter: fakeAdapter().adapter,
      launcher,
      root: dir,
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(pending(statePath).requests.map((request) => request.body)).toEqual([
      { kind: "takeover-ended", project: "scratch-app", ticket: 6 },
    ]);
    expect(said.at(-1)).toBe(
      "scratch-app #6 goes back to the runner. It reads what the session left as soon as the daemon runs.",
    );
  });

  it("gives the run back to the runner, and leaves the daemon a request to wake it", async () => {
    // Every project is driven by the runner now, so the way back does not
    // depend on what the project's entry says.
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-no-driver-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath);
    const { run } = store.register("scratch-app", 6);
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    const { launcher, calls } = fakeLauncher();
    const said: string[] = [];

    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter: fakeAdapter().adapter,
      launcher,
      root: dir,
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(pending(statePath).requests.map((request) => request.body)).toEqual([
      { kind: "takeover-ended", project: "scratch-app", ticket: 6 },
    ]);
    expect(said.at(-1)).toBe(
      "scratch-app #6 goes back to the runner. It reads what the session left as soon as the daemon runs.",
    );
  });
});

describe("a takeover takes no place on its project (ADR-0063 D5)", () => {
  /** A ledger at a path of its own, so the command takes the lock as it does for real. */
  function ledger(): { store: RunStore; statePath: string } {
    const dir = mkdtempSync(join(tmpdir(), "timone-takeover-place-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    return { statePath, store: RunStore.open(statePath) };
  }

  /** Ticket #6's run, picked up and waiting for the runner. */
  function waitingSix(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    return store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });
  }

  /**
   * Run the command on #6 with the lock free. `during` runs while the
   * terminal session is open, which is the only time the takeover holds the run.
   */
  async function takeOver(
    store: RunStore,
    statePath: string,
    during: () => void = () => {},
  ): Promise<{ code: number; said: string[]; launched: number }> {
    const { launcher, calls } = fakeLauncher({ onRun: during });
    const said: string[] = [];
    const code = await runTakeover("scratch-app#6", {
      manifest,
      store,
      statePath,
      adapter: fakeAdapter().adapter,
      launcher,
      root: "/root",
      ticker: () => ({ stop: () => {} }),
      log: (message) => said.push(message),
    });
    return { code, said, launched: calls.length };
  }

  it("takes over a ticket while another ticket of the project has a step running, and leaves that step alone (R13 clause 1)", async () => {
    const { store, statePath } = ledger();
    const six = waitingSix(store);
    const { run: four } = store.register("scratch-app", 4);
    store.activate(four.id, "step-session-4");
    const fourBefore = store.get(four.id);
    let sixDuring: Run | undefined;
    let fourDuring: Run | undefined;

    const { code, launched } = await takeOver(store, statePath, () => {
      sixDuring = store.get(six.id);
      fourDuring = store.get(four.id);
    });

    expect(code).toBe(0);
    expect(launched).toBe(1);
    expect(sixDuring).toMatchObject({ status: "active", takenOver: true });
    expect(fourDuring).toEqual(fourBefore);
    expect(store.get(four.id)).toEqual(fourBefore);
  });

  it("takes over a ticket while another ticket of the project owns a branch and an open pull request, with no step running (R13 clause 2)", async () => {
    const { store, statePath } = ledger();
    const { run: four } = store.register("scratch-app", 4);
    store.activate(four.id, "step-session-4");
    store.claimBranch(four.id, "timone/4-due-dates");
    store.recordPullRequest(four.id, 19);
    store.park(four.id, {
      waitingOn: "pull request #19 to be merged",
      kind: "runner",
      resolvableBy: ["delivery"],
    });
    const six = waitingSix(store);
    let sixDuring: Run | undefined;

    const { code, said, launched } = await takeOver(store, statePath, () => {
      sixDuring = store.get(six.id);
    });

    expect(code).toBe(0);
    expect(launched).toBe(1);
    expect(said[0]).toMatch(/^Picking up scratch-app #6 here\./);
    expect(sixDuring).toMatchObject({ status: "active", takenOver: true });
    expect(store.get(four.id)).toMatchObject({
      status: "parked",
      branch: "timone/4-due-dates",
      pr: 19,
    });
  });

  it("refuses the takeover of a ticket whose own step is running, in the words it always used (R13 clause 3)", async () => {
    const { store, statePath } = ledger();
    const { run: six } = store.register("scratch-app", 6);
    store.activate(six.id, "step-session-6");
    const sixBefore = store.get(six.id);

    const { code, said, launched } = await takeOver(store, statePath);

    expect(code).toBe(1);
    expect(launched).toBe(0);
    expect(said).toEqual([
      "I'm working on scratch-app #6 right now. Anything I need from you " +
        "will land on the ticket.",
    ]);
    expect(store.get(six.id)).toEqual(sixBefore);
  });

  it("lets a third ticket's step start while a ticket is taken over (R2 clause 6)", async () => {
    const { store, statePath } = ledger();
    const six = waitingSix(store);
    const { run: eight } = store.register("scratch-app", 8);
    store.park(eight.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    let asked: ReturnType<RunStore["askPlace"]> | undefined;
    let eightDuring: Run | undefined;

    const { code } = await takeOver(store, statePath, () => {
      // What a step's start does: ask for the place, claim, then activate.
      asked = store.askPlace(eight.id, {
        priority: false,
        openedAt: "2026-08-03T09:00:00Z",
      });
      store.claim(eight.id);
      eightDuring = store.activate(eight.id, "step-session-8");
    });

    expect(code).toBe(0);
    expect(asked).toEqual({ ok: true });
    expect(eightDuring?.status).toBe("active");
    expect(store.placeHolders("scratch-app").map((run) => run.id)).toEqual([eight.id]);
    expect(store.get(six.id)?.status).toBe("parked");
  });
});
