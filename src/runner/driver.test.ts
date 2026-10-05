import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  MergeOutcome,
  PullRequest,
  TicketComment,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import {
  noBranches,
  noFiles,
  noMerges,
  noRunnerCalls,
  noStepWrites,
} from "../adapters/ticketing.stubs.js";
import type { Manifest } from "../manifest.js";
import { breakdownPath, renderBreakdown } from "../daemon/breakdown.js";
import { RunStore, type Run } from "../daemon/runs.js";
import { HELD_LABEL } from "../daemon/steps.js";
import type { StepResult, StepSessionInput } from "../daemon/step-session.js";
import { RunningSteps, runnerActions } from "./actions.js";
import { RunnerDriver, type RunnerDriverDeps } from "./driver.js";
import { appendEntry, readRecord, type RecordEntry } from "./record.js";
import { wakeRunner, type RunQuery, type WakeOptions } from "./session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PROJECT: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

/** scratch-app, driven by the runner and instructed by the operator. */
const MANIFEST: Manifest = {
  operator: "fvermaut",
  projects: {
    "scratch-app": {
      repo_url: PROJECT.repoUrl,
      path: "projects/scratch-app",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
    },
  },
};

/** The work branch of scratch-app #12's first run. */
const BRANCH = "timone/12-fix-the-readme-spelling";

/** A chore on scratch-app: a spelling mistake in the README. */
const CHORE: TicketThread = {
  number: 12,
  title: "Fix the README spelling",
  body: 'The README says "recieve".',
  labels: ["timone", "triage:chore"],
  url: "https://github.com/fvermaut/scratch-app/issues/12",
  author: "fvermaut",
  createdAt: "2026-09-27T09:00:00Z",
  comments: [],
};

/** Pull request #21, open for the branch. */
const PULL_REQUEST_21: PullRequest = {
  number: 21,
  title: "Fix the README spelling",
  url: "https://github.com/fvermaut/scratch-app/pull/21",
  state: "open",
  headSha: "bbbbbbb",
};

/**
 * An in-memory forge holding the chore and its open pull request #21, whose
 * description is `body` and is replaced by each `setPullRequestBody`.
 */
function forge(body: string): {
  adapter: TicketingAdapter;
  descriptions: string[];
  posted: string[];
} {
  const descriptions: string[] = [];
  const posted: string[] = [];
  let description = body;
  const adapter: TicketingAdapter = {
    async listPullRequestFiles(): Promise<string[]> {
      return [];
    },
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
    async listMarkedTickets() {
      return [CHORE];
    },
    async listOpenTickets() {
      return [CHORE];
    },
    async listSteps() {
      return [];
    },
    async getTicket() {
      return CHORE;
    },
    async postComment(_project, _number, comment) {
      posted.push(comment);
    },
    async applyLabel() {},
    async closeTicket() {},
    async findPullRequest(_project, branch) {
      return branch === BRANCH ? PULL_REQUEST_21 : undefined;
    },
    async findOpenPullRequestOfTicket(): Promise<undefined> {
      return undefined;
    },
    async getPullRequestThread() {
      return { ...PULL_REQUEST_21, comments: [] };
    },
    async postPullRequestComment() {},
    async upsertPullRequestComment() {},
    async getPullRequestBody(_project, number) {
      if (number !== 21) throw new Error(`no pull request ${number}`);
      return description;
    },
    async setPullRequestBody(_project, number, next) {
      if (number !== 21) throw new Error(`no pull request ${number}`);
      description = next;
      descriptions.push(next);
    },
  };
  return { adapter, descriptions, posted };
}

/** One wake the driver asked for. */
interface AskedWake {
  runId: string;
  events: string[];
  options: WakeOptions;
}

/** A stand-in for the runner's sessions: writes down every wake it is asked for. */
function fakeWakes(): { sessions: ReturnType<RunnerDriverDeps["sessionsFor"]>; wakes: AskedWake[] } {
  const wakes: AskedWake[] = [];
  return {
    sessions: {
      async wake(run, events, options = {}) {
        wakes.push({ runId: run.id, events: [...events], options });
      },
      stop() {},
    },
    wakes,
  };
}

/** A runner's session that calls no tool and ends at once, as the SDK reports a quiet one. */
const endsAtOnce: RunQuery = async function* () {
  yield {
    type: "result",
    subtype: "success",
    is_error: false,
    total_cost_usd: 0.05,
    num_turns: 1,
    result: "Nothing to do.",
  };
};

/**
 * A step that runs until the test ends it. Starting it claims and activates
 * the run, as `startStepSession` does, so the run is `active` while it runs.
 */
function fakeStep(store: RunStore): {
  startStep: RunnerDriverDeps["startStep"];
  end: (result: StepResult) => void;
} {
  let end: (result: StepResult) => void = () => {
    throw new Error("the step was never started");
  };
  return {
    async startStep(input: StepSessionInput) {
      store.claim(input.runId);
      store.activate(input.runId, "step-session-4");
      return {
        sessionId: "step-session-4",
        completed: new Promise<StepResult>((resolve) => {
          end = resolve;
        }),
        stop() {},
      };
    },
    end: (result) => end(result),
  };
}

/** Every entry of the chore's record, or the test fails. */
function recordOf(root: string): RecordEntry[] {
  const read = readRecord(root, "scratch-app", 12);
  if (!read.ok) throw new Error(read.error.message);
  return read.value;
}

/**
 * The chore's first run, on its branch, waiting for the runner after
 * sorting, preparing and building each ran once.
 */
function builtChore(store: RunStore, root: string): Run {
  const { run } = store.register("scratch-app", 12);
  store.claimBranch(run.id, BRANCH);
  const parked = store.park(run.id, {
    waitingOn: "the runner to look at what the step did",
    kind: "runner",
    resolvableBy: ["execution"],
  });
  const stages = ["triage", "planning", "execution"] as const;
  for (const [index, stage] of stages.entries()) {
    appendEntry(root, "scratch-app", 12, {
      kind: "step-started",
      at: `2026-09-27T1${index}:00:00Z`,
      runId: run.id,
      stage,
      sessionId: `step-session-${index + 1}`,
    });
    appendEntry(root, "scratch-app", 12, {
      kind: "step-ended",
      at: `2026-09-27T1${index}:30:00Z`,
      runId: run.id,
      stage,
      sessionId: `step-session-${index + 1}`,
      ok: true,
      costUsd: 1,
    });
  }
  return parked;
}

describe("RunnerDriver — when a step ends", () => {
  it("records the step's cost, and rewrites the pull request's description with the departures first and the rest kept", async () => {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-27T14:00:00Z",
    });
    const run = builtChore(store, root);
    const { adapter, descriptions } = forge(
      [
        "<!-- timone:departures -->",
        "The default order was followed.",
        "<!-- /timone:departures -->",
        "",
        "## What changed",
        "",
        'The README said "recieve"; it now says "receive".',
      ].join("\n"),
    );
    const { sessions, wakes } = fakeWakes();
    const step = fakeStep(store);
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: step.startStep,
      timonePin: async () => undefined,
      clock: () => "2026-09-27T14:00:00Z",
      log: () => {},
    });

    const started = await runnerActions(driver.actionsFor(run), run).startStep({
      stage: "delivery",
      instructions: "Open the pull request.",
      skipReason: "The change only fixes a spelling mistake in the README.",
      reason: "The fix is built.",
    });
    expect(started.ok).toBe(true);
    step.end({
      outcome: { sessionId: "step-session-4", ok: true },
      summary: { durationMs: 60_000, turns: 12, costUsd: 2.5, models: [] },
    });
    await vi.waitFor(() => expect(wakes).toHaveLength(1));
    await driver.drain();

    expect(recordOf(root).filter((entry) => entry.kind === "step-ended").at(-1)).toMatchObject({
      runId: run.id,
      stage: "delivery",
      sessionId: "step-session-4",
      ok: true,
      costUsd: 2.5,
    });
    expect(descriptions).toEqual([
      [
        "<!-- timone:departures -->",
        "**Not checked.** No session other than the one that built this work checked it. " +
          "Reason: The change only fixes a spelling mistake in the README.",
        "<!-- /timone:departures -->",
        "",
        "## What changed",
        "",
        'The README said "recieve"; it now says "receive".',
      ].join("\n"),
    ]);
    expect(store.get(run.id)).toMatchObject({
      status: "parked",
      pr: 21,
      wait: { kind: "runner" },
    });
    expect(wakes).toEqual([
      { runId: run.id, events: ["The step delivering ended: it succeeded."], options: {} },
    ]);
  });

  it("points the ledger at the branch's new open pull request when the one it holds was closed and the redone work opened another", async () => {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-27T16:00:00Z",
    });
    const run = builtChore(store, root);
    // #21 was closed without merging. The work was done again, and delivering
    // opened #22 on the same branch.
    store.recordPullRequest(run.id, 21);
    const pullRequest22: PullRequest = {
      number: 22,
      title: "Fix the README spelling",
      url: "https://github.com/fvermaut/scratch-app/pull/22",
      state: "open",
      headSha: "ccccccc",
    };
    let description22 = "## What changed\n\nThe README now says \"receive\".";
    const adapter: TicketingAdapter = {
      ...forge("").adapter,
      async findPullRequest(_project, branch) {
        return branch === BRANCH ? pullRequest22 : undefined;
      },
      async getPullRequestBody(_project, number) {
        if (number !== 22) throw new Error(`no open pull request ${number}`);
        return description22;
      },
      async setPullRequestBody(_project, number, next) {
        if (number !== 22) throw new Error(`no open pull request ${number}`);
        description22 = next;
      },
    };
    const { sessions, wakes } = fakeWakes();
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: async () => {
        throw new Error("no step starts in this test");
      },
      timonePin: async () => undefined,
      clock: () => "2026-09-27T16:00:00Z",
      log: () => {},
    });

    await driver.stepEnded(run.id, "delivery", {
      outcome: { sessionId: "step-session-6", ok: true },
    });
    await driver.drain();

    expect(store.get(run.id)?.pr).toBe(22);
    expect(wakes).toHaveLength(1);
  });

  it("wakes nobody, and touches nothing, when the step's end already ended the run", async () => {
    // 40e: the step that records the approval of the list of pieces merges it
    // and ends the run before the driver is told the step ended.
    const root = mkdtempSync(join(tmpdir(), "timone-driver-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-27T14:00:00Z",
    });
    const { run } = store.register("scratch-app", 12);
    store.activate(run.id, "step-session-5");
    const done = store.complete(run.id);
    const { adapter, descriptions } = forge("");
    const { sessions, wakes } = fakeWakes();
    const logged: string[] = [];
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: async () => {
        throw new Error("no step starts in this test");
      },
      timonePin: async () => undefined,
      clock: () => "2026-09-27T14:00:00Z",
      log: (line) => logged.push(line),
    });

    await driver.stepEnded(run.id, "breakdown", {
      outcome: { sessionId: "step-session-5", ok: true },
    });
    await driver.drain();

    expect(wakes).toEqual([]);
    expect(descriptions).toEqual([]);
    expect(store.get(run.id)).toEqual(done);
    expect(logged).toEqual([]);
  });
});

describe("RunnerDriver — when a run comes back after a daemon stop", () => {
  it("writes the end of the step that was running, and none for the steps that had already ended", async () => {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-27T14:00:00Z",
    });
    const built = builtChore(store, root);
    appendEntry(root, "scratch-app", 12, {
      kind: "step-started",
      at: "2026-09-27T13:00:00Z",
      runId: built.id,
      stage: "delivery",
      sessionId: "step-session-4",
    });
    store.claim(built.id);
    const active = store.activate(built.id, "step-session-4");
    const { adapter } = forge("");
    const { sessions } = fakeWakes();
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: async () => {
        throw new Error("no step starts in this test");
      },
      timonePin: async () => undefined,
      clock: () => "2026-09-27T14:05:00Z",
      log: () => {},
    });

    driver.reclaimed(active);
    await driver.drain();

    expect(recordOf(root).filter((entry) => entry.kind === "step-ended")).toEqual([
      expect.objectContaining({ sessionId: "step-session-1", ok: true }),
      expect.objectContaining({ sessionId: "step-session-2", ok: true }),
      expect.objectContaining({ sessionId: "step-session-3", ok: true }),
      {
        kind: "step-ended",
        at: "2026-09-27T14:05:00Z",
        runId: built.id,
        stage: "delivery",
        sessionId: "step-session-4",
        ok: false,
        costUsd: 0,
        error: "the daemon stopped while this step was running",
        stoppedBy: "daemon",
      },
    ]);
  });
});

describe("RunnerDriver — a place on the project is given to one waiting run (ADR-0063 D3)", () => {
  // #184: three runs refused a step were all told "The project is free now",
  // and only one of them could start. Now the ledger gives the freed place
  // to one waiting run, and only that run is woken.

  /** What the run given a place is woken with, as the plan words it. */
  const PLACE_GIVEN = "A place on the project is free for this ticket now. A step you start will not be refused for want of one.";

  /** A chore on scratch-app opened before every other: its step takes the place first. */
  const FIRST: TicketThread = {
    ...CHORE,
    number: 11,
    title: "Fix the badge link",
    body: "The build badge links to the old repository.",
    url: "https://github.com/fvermaut/scratch-app/issues/11",
    createdAt: "2026-09-25T09:00:00Z",
  };

  /** A chore opened second on the forge, but picked up after #14. */
  const OLDER: TicketThread = {
    ...CHORE,
    number: 13,
    title: "Fix the licence year",
    body: "The licence says 2025.",
    url: "https://github.com/fvermaut/scratch-app/issues/13",
    createdAt: "2026-09-26T09:00:00Z",
  };

  /** A chore opened last on the forge, but picked up before #13. */
  const NEWER: TicketThread = {
    ...CHORE,
    number: 14,
    title: "Fix the contributing guide",
    body: "The guide names a branch that no longer exists.",
    url: "https://github.com/fvermaut/scratch-app/issues/14",
    createdAt: "2026-09-27T09:00:00Z",
  };

  const TICKETS = [FIRST, OLDER, NEWER];

  /**
   * The forge: #11, #13 and #14, all open and marked, with no comments, and
   * pull request #21 in the state `pull` holds when it is asked. The tickets
   * numbered in `held` carry the hold label.
   */
  function threeChores(
    pull: { state: PullRequest["state"] },
    held: readonly number[],
  ): TicketingAdapter {
    return {
      ...forge("").adapter,
      async getPullRequestThread() {
        return { ...PULL_REQUEST_21, state: pull.state, comments: [] };
      },
      async listMarkedTickets() {
        return TICKETS;
      },
      async getTicket(_project, number) {
        const ticket = TICKETS.find((one) => one.number === number);
        if (ticket === undefined) throw new Error(`no ticket ${number}`);
        return held.includes(number) ? { ...ticket, labels: [...ticket.labels, HELD_LABEL] } : ticket;
      },
    };
  }

  /** One poll cycle's view of the project: every ticket listed, none a step. */
  function cycleOver(adapter: TicketingAdapter): Parameters<RunnerDriver["tick"]>[2] {
    return {
      tickets: TICKETS,
      isStep: () => false,
      threads: (ticket) => ({
        ticket: () => adapter.getTicket(PROJECT, ticket),
        pullRequest: (pr) => adapter.getPullRequestThread(PROJECT, pr),
      }),
    };
  }

  /** The runner's wait, as a wake leaves a run it just picked up. */
  const RUNNER_WAIT = {
    waitingOn: "the next thing that happens on this ticket",
    kind: "runner" as const,
    resolvableBy: ["triage" as const],
  };

  /**
   * #11's run with a step running, so it takes the project's one place, and
   * #14's then #13's runs picked up beside it, each waiting for the runner.
   * The driver over them, whose steps claim the run as `startStepSession`
   * does. `clock.now` is the time the ledger and the driver write. The
   * tickets numbered in `held` are held by a person.
   *
   * ✏ 2026-10-05: the project has one place, as every project did when these
   * cases were written (ADR-0063 D1). A project now has two unless
   * `timone.yaml` sets another number (PRD-07.R2).
   */
  function threeRuns({ held = [] }: { held?: readonly number[] } = {}) {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-place-"));
    tempDirs.push(root);
    const clock = { now: "2026-09-29T10:00:00Z" };
    const path = join(root, ".timone", "state.json");
    const store = RunStore.open(path, { now: () => clock.now, placesOf: () => 1 });
    const first = store.activate(store.register("scratch-app", 11).run.id, "step-session-11");
    const newer = store.park(store.register("scratch-app", 14).run.id, RUNNER_WAIT);
    const older = store.park(store.register("scratch-app", 13).run.id, RUNNER_WAIT);
    const pull: { state: PullRequest["state"] } = { state: "open" };
    const adapter = threeChores(pull, held);
    const { sessions, wakes } = fakeWakes();
    const step = fakeStep(store);
    const running = new RunningSteps();
    const driverOver = (over: RunStore) =>
      new RunnerDriver({
        store: over,
        adapter,
        manifest: MANIFEST,
        root,
        sessionsFor: () => sessions,
        running,
        consult: async () => undefined,
        startStep: step.startStep,
        timonePin: async () => undefined,
        clock: () => clock.now,
        log: () => {},
      });
    const driver = driverOver(store);
    const tryToSort = (run: Run, by = driver) =>
      runnerActions(by.actionsFor(run), run).startStep({
        stage: "triage",
        instructions: "Sort the request.",
        reason: "A new ticket starts with sorting.",
      });
    const cycle = async (by = driver): Promise<void> => {
      await by.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
      await by.drain();
    };
    return { root, path, clock, store, first, newer, older, pull, adapter, wakes, step, driver, driverOver, tryToSort, cycle };
  }

  it("wakes only the first waiting run by order when the step that took the place ends, and tells it the place is given (R3 clause 3, #184)", async () => {
    const w = threeRuns();
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    expect((await w.tryToSort(w.older)).ok).toBe(false);
    await w.cycle();
    expect(w.wakes).toEqual([]);

    w.store.park(w.first.id, RUNNER_WAIT);
    await w.cycle();

    expect(w.wakes).toEqual([{ runId: w.older.id, events: [PLACE_GIVEN], options: {} }]);
  });

  it("asks for no wake on a second tick when nothing has changed, since the run was told of its place", async () => {
    const w = threeRuns();
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    expect((await w.tryToSort(w.older)).ok).toBe(false);
    w.store.park(w.first.id, RUNNER_WAIT);
    await w.cycle();
    expect(w.wakes).toHaveLength(1);

    await w.cycle();

    expect(w.wakes).toHaveLength(1);
  });

  it("gives the place to the next waiting run when the run given it ends its runner's wake with no step started, and the next tick wakes that run (R3 clause 4)", async () => {
    const w = threeRuns();
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    expect((await w.tryToSort(w.older)).ok).toBe(false);
    w.store.park(w.first.id, RUNNER_WAIT);
    await w.cycle();

    // #13's runner is woken, reads the ticket, and starts no step.
    await wakeRunner(
      { runQuery: endsAtOnce, actionsFor: (run) => w.driver.actionsFor(run) },
      w.store.get(w.older.id)!,
      [PLACE_GIVEN],
    );
    await w.cycle();

    expect(w.wakes).toEqual([
      { runId: w.older.id, events: [PLACE_GIVEN], options: {} },
      { runId: w.newer.id, events: [PLACE_GIVEN], options: {} },
    ]);
  });

  it("wakes a run whose step just ended and kept the place once, with the step's end, and not again for the place", async () => {
    const w = threeRuns();
    w.store.park(w.first.id, RUNNER_WAIT);
    expect((await w.tryToSort(w.older)).ok).toBe(true);
    w.step.end({
      outcome: { sessionId: "step-session-4", ok: true },
      summary: { durationMs: 60_000, turns: 12, costUsd: 0.5, models: [] },
    });
    await vi.waitFor(() => expect(w.wakes).toHaveLength(1));
    await w.driver.drain();
    expect(w.store.placeHolders("scratch-app").map((run) => run.id)).toEqual([w.older.id]);

    await w.cycle();
    await w.cycle();

    expect(w.wakes).toEqual([
      { runId: w.older.id, events: ["The step sorting the request ended: it succeeded."], options: {} },
    ]);
  });

  it("does not wake a run waiting for a person on its own branch with an open pull request when a place frees, and wakes it on the merge (R1 clause 3)", async () => {
    const w = threeRuns();
    // #14 built its work and opened pull request #21. Its last step ended,
    // and its runner's wake then started no step, so it left its turn.
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    w.store.leaveTurn(w.newer.id);
    w.store.claimBranch(w.newer.id, BRANCH);
    w.store.recordPullRequest(w.newer.id, 21);
    w.store.repark(w.newer.id, {
      waitingOn: "fvermaut to review pull request #21",
      resolvableBy: ["delivery"],
    });
    expect((await w.tryToSort(w.older)).ok).toBe(false);

    w.store.park(w.first.id, RUNNER_WAIT);
    await w.cycle();
    expect(w.wakes.filter((wake) => wake.runId === w.newer.id)).toEqual([]);

    w.pull.state = "merged";
    await w.cycle();

    expect(w.wakes.filter((wake) => wake.runId === w.newer.id)).toEqual([
      { runId: w.newer.id, events: ["Pull request #21 was merged."], options: {} },
    ]);
  });

  it("wakes the first waiting run again after a restart, which takes back the place given before it and gives it again (D3)", async () => {
    const w = threeRuns();
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    expect((await w.tryToSort(w.older)).ok).toBe(false);
    w.store.park(w.first.id, RUNNER_WAIT);
    await w.cycle();
    expect(w.wakes).toHaveLength(1);

    // The daemon stops before #13's runner has used the place, and starts
    // again an hour later. No wake survives the stop.
    w.clock.now = "2026-09-29T11:00:00Z";
    const store = RunStore.open(w.path, { now: () => w.clock.now, placesOf: () => 1 });
    store.regivePlaces();
    await w.cycle(w.driverOver(store));

    expect(w.wakes).toEqual([
      { runId: w.older.id, events: [PLACE_GIVEN], options: {} },
      { runId: w.older.id, events: [PLACE_GIVEN], options: {} },
    ]);
  });

  it("does not wake a run given the place whose ticket is held, and gives the place to the next waiting run in the same tick", async () => {
    const w = threeRuns({ held: [13] });
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    expect((await w.tryToSort(w.older)).ok).toBe(false);
    w.store.park(w.first.id, RUNNER_WAIT);
    expect(w.store.get(w.older.id)?.place?.givenAt).toBeDefined();

    await w.cycle();
    expect(w.wakes).toEqual([]);
    expect(w.store.placeHolders("scratch-app").map((run) => run.id)).toEqual([w.newer.id]);

    await w.cycle();

    expect(w.wakes).toEqual([{ runId: w.newer.id, events: [PLACE_GIVEN], options: {} }]);
  });

  it("does not wake a run given the place that is over its spending limit, and gives the place to the next waiting run in the same tick", async () => {
    const w = threeRuns();
    expect((await w.tryToSort(w.newer)).ok).toBe(false);
    expect((await w.tryToSort(w.older)).ok).toBe(false);
    // #13's runner sessions have spent the project's whole limit, $150.
    appendEntry(w.root, "scratch-app", 13, {
      kind: "runner-ended",
      at: "2026-09-29T09:30:00Z",
      runId: w.older.id,
      ok: true,
      costUsd: 150,
    });
    w.store.park(w.first.id, RUNNER_WAIT);
    expect(w.store.get(w.older.id)?.place?.givenAt).toBeDefined();

    await w.cycle();
    expect(w.wakes).toEqual([]);
    expect(w.store.placeHolders("scratch-app").map((run) => run.id)).toEqual([w.newer.id]);

    await w.cycle();

    expect(w.wakes).toEqual([{ runId: w.newer.id, events: [PLACE_GIVEN], options: {} }]);
  });

  it("does not wake a run refused for another reason when the place frees", async () => {
    const w = threeRuns();
    // Refused for a missing reason to skip sorting, not for want of a place.
    const refused = await runnerActions(w.driver.actionsFor(w.older), w.older).startStep({
      stage: "planning",
      instructions: "Write the plan.",
      reason: "Small enough to plan at once.",
    });
    expect(refused.ok).toBe(false);

    w.store.complete(w.first.id);
    await w.cycle();

    expect(w.wakes).toEqual([]);
  });
});

describe("RunnerDriver — when a step ends and the ticket's record cannot be read (40v)", () => {
  it("leaves the pull request's description as it is, and logs why", async () => {
    // The Standards review of phase 40, finding 1: an unread record counted
    // as an empty one, and "The default order was followed." replaced the
    // list of departures the pull request held.
    const root = mkdtempSync(join(tmpdir(), "timone-driver-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-27T14:00:00Z",
    });
    const run = builtChore(store, root);
    // The six entries above are lines 1 to 6; line 7 is cut short.
    appendFileSync(join(root, ".timone", "records", "scratch-app", "12.jsonl"), '{"kind":"step-sta\n');
    const { adapter, descriptions } = forge(
      [
        "<!-- timone:departures -->",
        "**Not checked.** No session other than the one that built this work checked it. " +
          "Reason: The change only fixes a spelling mistake in the README.",
        "<!-- /timone:departures -->",
        "",
        "## What changed",
      ].join("\n"),
    );
    const { sessions, wakes } = fakeWakes();
    const logged: string[] = [];
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: async () => {
        throw new Error("no step starts in this test");
      },
      timonePin: async () => undefined,
      clock: () => "2026-09-27T14:00:00Z",
      log: (line) => logged.push(line),
    });

    await driver.stepEnded(run.id, "delivery", {
      outcome: { sessionId: "step-session-4", ok: true },
    });
    await driver.drain();

    expect(descriptions).toEqual([]);
    expect(logged).toContainEqual(expect.stringContaining("line 7 is not JSON"));
    expect(store.get(run.id)?.pr).toBe(21);
    expect(wakes).toHaveLength(1);
  });
});

describe("RunnerDriver — when the approved list of pieces cannot be acted on (40x)", () => {
  // The Spec review of phase 40, finding 2 (PRD-05.R9, R11, R16): the merge
  // after the approval, or opening the pieces' tickets, failed the run. On a
  // runner project nothing wakes the runner for a failed run, and the
  // comment pointed at a standing note these projects do not have.

  /** A feature ticket on scratch-app, whose list of pieces fvermaut approved at 11:58:40. */
  const FEATURE: TicketThread = {
    number: 12,
    title: "A due date on each task",
    body: "Each task should have a due date.",
    labels: ["timone", "triage:feature"],
    url: "https://github.com/fvermaut/scratch-app/issues/12",
    author: "fvermaut",
    createdAt: "2026-09-27T09:00:00Z",
    comments: [
      {
        author: "fvermaut",
        body: "ok go ahead with the pieces",
        createdAt: "2026-09-27T11:58:40Z",
        fromTimone: false,
      },
    ],
  };

  /** Ticket 12's list of pieces, as the step that records the approval leaves it. */
  const TWO_PIECES = renderBreakdown({
    stamp: { kind: "approved", by: "fvermaut", at: "2026-09-27", pieces: 2 },
    chunks: [
      { title: "Due dates on tasks", delivers: "Each task can carry a due date." },
      { title: "Late tasks first", delivers: "The list shows the late tasks first, in red." },
    ],
  });

  /** The words git gives for a merge whose two sides changed the same lines. */
  const GIT_CONFLICT = "CONFLICT (content): Merge conflict in doc/specs/prd/prd-12.md";

  /**
   * The forge for the feature: the merge answers `merge`, and opening a
   * piece's ticket throws when `createStep` says so. Every comment posted on
   * the ticket is kept in `posted`.
   */
  function piecesForge(merge: MergeOutcome, createStep: "opens" | "throws"): {
    adapter: TicketingAdapter;
    posted: string[];
  } {
    const posted: string[] = [];
    const adapter: TicketingAdapter = {
      ...forge("").adapter,
      async getTicket() {
        return FEATURE;
      },
      async postComment(_project, _number, comment) {
        posted.push(comment);
      },
      async findPullRequest() {
        return undefined;
      },
      async mergeIntoDefault() {
        return merge;
      },
      async readFile(_project, branch, path) {
        return branch === "main" && path === breakdownPath(12) ? TWO_PIECES : undefined;
      },
      async ensureLabel() {},
      async createStep() {
        if (createStep === "throws") throw new Error("gh: HTTP 502: Bad Gateway");
        return 201;
      },
    };
    return { adapter, posted };
  }

  /**
   * #12's run on its branch, waiting for the runner after the step that wrote
   * the list of pieces ended well at 11:50, and a driver over it. The runner
   * then records fvermaut's approval, and the step that writes it into the
   * file ends well.
   */
  async function approvePieces(adapter: TicketingAdapter): Promise<{
    store: RunStore;
    root: string;
    run: Run;
    wakes: AskedWake[];
  }> {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-pieces-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-27T12:00:00Z",
    });
    const { run: registered } = store.register("scratch-app", 12);
    store.claimBranch(registered.id, BRANCH);
    const run = store.park(registered.id, {
      waitingOn: "the runner to look at what the step did",
      kind: "runner",
      resolvableBy: ["breakdown"],
    });
    appendEntry(root, "scratch-app", 12, {
      kind: "step-started",
      at: "2026-09-27T11:20:00Z",
      runId: run.id,
      stage: "breakdown",
      sessionId: "step-session-3",
    });
    appendEntry(root, "scratch-app", 12, {
      kind: "step-ended",
      at: "2026-09-27T11:50:00Z",
      runId: run.id,
      stage: "breakdown",
      sessionId: "step-session-3",
      ok: true,
      costUsd: 1.6,
    });
    const { sessions, wakes } = fakeWakes();
    const step = fakeStep(store);
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: step.startStep,
      timonePin: async () => undefined,
      clock: () => "2026-09-27T12:00:00Z",
      log: () => {},
    });

    const approved = await runnerActions(driver.actionsFor(run), run).recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the list of pieces.",
    });
    expect(approved.ok).toBe(true);
    step.end({
      outcome: { sessionId: "step-session-4", ok: true },
      summary: { durationMs: 40_000, turns: 6, costUsd: 0.04, models: [] },
    });
    await vi.waitFor(() => expect(store.get(run.id)?.status).not.toBe("active"));
    await driver.drain();
    return { store, root, run, wakes };
  }

  /** Whether a comment asks the reader to run a command, or points at a standing note. */
  function namesACommand(comment: string): boolean {
    return /`|\btimone [a-z]|standing note/i.test(comment);
  }

  it("leaves the run waiting for the runner when the merge conflicts, notes why, tells the ticket once, and wakes the runner with the failure", async () => {
    const { adapter, posted } = piecesForge(
      { merged: false, conflict: true, reason: GIT_CONFLICT },
      "opens",
    );

    const { store, root, run, wakes } = await approvePieces(adapter);

    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(recordOf(root)).toContainEqual({
      kind: "notice",
      at: "2026-09-27T12:00:00Z",
      about: expect.stringMatching(/clash.*CONFLICT \(content\): Merge conflict in doc\/specs\/prd\/prd-12\.md/),
    });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("clash");
    expect(posted[0]).toContain(GIT_CONFLICT);
    expect(posted[0]).toContain("**What I need from you:** reply here");
    expect(namesACommand(posted[0]!)).toBe(false);
    expect(wakes).toEqual([
      {
        runId: run.id,
        events: [
          "The step working out the pieces ended: it succeeded.",
          expect.stringMatching(/clash.*CONFLICT \(content\): Merge conflict in doc\/specs\/prd\/prd-12\.md.*The run was not ended\.$/),
        ],
        options: {},
      },
    ]);
  });

  it("leaves the run waiting for the runner when opening the pieces' tickets fails, notes why, tells the ticket once, and wakes the runner with the failure", async () => {
    const { adapter, posted } = piecesForge({ merged: true, into: "main" }, "throws");

    const { store, root, run, wakes } = await approvePieces(adapter);

    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(recordOf(root)).toContainEqual({
      kind: "notice",
      at: "2026-09-27T12:00:00Z",
      about: expect.stringMatching(/on the default branch.*gh: HTTP 502: Bad Gateway/),
    });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("ticket for each piece");
    expect(posted[0]).toContain("gh: HTTP 502: Bad Gateway");
    expect(posted[0]).toContain("**What I need from you:** reply here");
    expect(namesACommand(posted[0]!)).toBe(false);
    expect(wakes).toEqual([
      {
        runId: run.id,
        events: [
          "The step working out the pieces ended: it succeeded.",
          expect.stringMatching(/on the default branch.*gh: HTTP 502: Bad Gateway.*The run was not ended\.$/),
        ],
        options: {},
      },
    ]);
  });
});

describe("RunnerDriver — a run that waits for the planner (ADR-0065 D2, D5)", () => {
  /** fvermaut's comment on #12, written after the planner was asked. */
  const NAMED: TicketComment = {
    author: "fvermaut",
    body: "Please also fix the same word in CONTRIBUTING.md.",
    createdAt: "2026-10-05T10:30:00Z",
    fromTimone: false,
  };

  /**
   * The chore's run, refused the build and so waiting for the planner, with
   * `comments` on its ticket, and the driver over it.
   */
  function waitingForThePlanner(comments: TicketComment[]) {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-planner-"));
    tempDirs.push(root);
    const clock = { now: "2026-10-05T10:00:00Z" };
    const store = RunStore.open(join(root, ".timone", "state.json"), { now: () => clock.now });
    const { run } = store.register("scratch-app", 12);
    store.park(run.id, {
      waitingOn: "the planner to decide whether this ticket may be built now",
      kind: "runner",
      resolvableBy: ["execution"],
    });
    store.askPlanner(run.id, { priority: false, openedAt: CHORE.createdAt });
    // The runner was woken once already, when the ticket was picked up.
    appendEntry(root, "scratch-app", 12, {
      kind: "woke",
      at: "2026-10-05T10:00:00Z",
      runId: run.id,
      events: ["A new ticket was picked up. Nothing has been done on it yet."],
    });
    const thread: TicketThread = { ...CHORE, comments };
    const adapter: TicketingAdapter = { ...forge("").adapter, getTicket: async () => thread };
    const { sessions, wakes } = fakeWakes();
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: async () => {
        throw new Error("no step starts in this test");
      },
      timonePin: async () => undefined,
      clock: () => clock.now,
      log: () => {},
    });
    const cycle = async (): Promise<void> => {
      await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, {
        tickets: [CHORE],
        isStep: () => false,
        threads: () => ({
          ticket: async () => thread,
          pullRequest: async () => ({ ...PULL_REQUEST_21, comments: [] }),
        }),
      });
      await driver.drain();
    };
    clock.now = "2026-10-05T11:00:00Z";
    return { root, clock, store, run, wakes, cycle };
  }

  it("does not wake the runner on a named person's comment on a ticket the planner holds, and leaves the comment unread", async () => {
    const w = waitingForThePlanner([NAMED]);
    w.store.decidePlanner(w.run.id, {
      kind: "hold",
      at: "2026-10-05T10:15:00Z",
      reason: "It changes the README, which #7 changes too.",
      waitsFor: [7],
    });

    await w.cycle();

    expect(w.wakes).toEqual([]);
    expect(recordOf(w.root).filter((entry) => entry.kind === "seen")).toEqual([]);
  });

  it("tells the runner, once, a named person's comment the planner passed to it, as the comment event it would have been", async () => {
    const w = waitingForThePlanner([NAMED]);
    appendEntry(w.root, "scratch-app", 12, {
      kind: "notice",
      at: "2026-10-05T10:31:00Z",
      about: "planner read comment at 2026-10-05T10:30:00Z",
    });
    appendEntry(w.root, "scratch-app", 12, {
      kind: "notice",
      at: "2026-10-05T10:32:00Z",
      about: "passed to runner: comment at 2026-10-05T10:30:00Z",
    });

    await w.cycle();
    await w.cycle();

    expect(w.wakes).toEqual([
      {
        runId: w.run.id,
        events: [
          'fvermaut commented on the ticket at 2026-10-05T10:30:00Z: "Please also fix the same word in CONTRIBUTING.md."',
        ],
        options: {},
      },
    ]);
  });

  it("wakes the run once when the planner let it build, and not again on the tick after", async () => {
    const w = waitingForThePlanner([]);
    w.store.decidePlanner(w.run.id, {
      kind: "build",
      at: "2026-10-05T10:40:00Z",
      reason: "No other ticket is being built.",
    });

    await w.cycle();
    await w.cycle();

    expect(w.wakes).toEqual([
      {
        runId: w.run.id,
        events: ["The planner let this ticket be built now: No other ticket is being built."],
        options: {},
      },
    ]);
  });

  it("tells the runner the planner let the ticket build on a named person's comment, and does not tell it the comment as well", async () => {
    const w = waitingForThePlanner([NAMED]);
    appendEntry(w.root, "scratch-app", 12, {
      kind: "notice",
      at: "2026-10-05T10:31:00Z",
      about: "planner read comment at 2026-10-05T10:30:00Z",
    });
    w.store.decidePlanner(w.run.id, {
      kind: "build",
      at: "2026-10-05T10:40:00Z",
      reason: "fvermaut asked for it to be built now.",
      onComment: { by: "fvermaut", at: "2026-10-05T10:30:00Z" },
    });

    await w.cycle();

    expect(w.wakes).toEqual([
      {
        runId: w.run.id,
        events: [
          "The planner let this ticket be built now, on fvermaut's comment at 2026-10-05T10:30:00Z: " +
            "fvermaut asked for it to be built now.",
        ],
        options: {},
      },
    ]);
  });
});
