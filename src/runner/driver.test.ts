import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  MergeOutcome,
  PullRequest,
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
import type { StepResult, StepSessionInput } from "../daemon/step-session.js";
import { RunningSteps, runnerActions } from "./actions.js";
import { RunnerDriver, type RunnerDriverDeps } from "./driver.js";
import { appendEntry, readRecord, type RecordEntry } from "./record.js";
import type { WakeOptions } from "./session.js";

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

describe("RunnerDriver — a run refused a step because its project was busy (40u)", () => {
  // Verification of phase 40, found outside the verdicts, item 1: two tickets
  // picked up together, one runner refused a step because the other held the
  // project. When the other's run ended, the refused one was never woken
  // again, and waited until a person wrote.

  /** A second chore on scratch-app, picked up with #12. */
  const SECOND: TicketThread = {
    ...CHORE,
    number: 13,
    title: "Fix the licence year",
    body: "The licence says 2025.",
    url: "https://github.com/fvermaut/scratch-app/issues/13",
  };

  /** The forge: #12 and #13, both open and marked, with no comments. */
  function twoChores(): TicketingAdapter {
    return {
      ...forge("").adapter,
      async listMarkedTickets() {
        return [CHORE, SECOND];
      },
      async getTicket(_project, number) {
        if (number === 12) return CHORE;
        if (number === 13) return SECOND;
        throw new Error(`no ticket ${number}`);
      },
    };
  }

  /** One poll cycle's view of the project: both tickets listed, neither a step. */
  function cycleOver(adapter: TicketingAdapter): Parameters<RunnerDriver["tick"]>[2] {
    return {
      tickets: [CHORE, SECOND],
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
   * #12's run waiting for the runner with no branch, and #13's run picked up
   * beside it with a step running, so #13 takes the project's one place. The
   * driver over them, whose steps claim the run as `startStepSession` does.
   *
   * ✏ 2026-10-04: #13's step now runs. A run just picked up takes no place
   * any more (ADR-0063 D1), so it would not keep #12 from a step.
   */
  function pickedUpTogether(): {
    store: RunStore;
    root: string;
    first: Run;
    second: Run;
    driver: RunnerDriver;
    adapter: TicketingAdapter;
    wakes: AskedWake[];
  } {
    const root = mkdtempSync(join(tmpdir(), "timone-driver-busy-"));
    tempDirs.push(root);
    const store = RunStore.open(join(root, ".timone", "state.json"), {
      now: () => "2026-09-29T10:00:00Z",
    });
    const first = store.park(store.register("scratch-app", 12).run.id, RUNNER_WAIT);
    const second = store.activate(store.register("scratch-app", 13).run.id, "step-session-9");
    const adapter = twoChores();
    const { sessions, wakes } = fakeWakes();
    const driver = new RunnerDriver({
      store,
      adapter,
      manifest: MANIFEST,
      root,
      sessionsFor: () => sessions,
      running: new RunningSteps(),
      consult: async () => undefined,
      startStep: fakeStep(store).startStep,
      timonePin: async () => undefined,
      clock: () => "2026-09-29T10:00:00Z",
      log: () => {},
    });
    return { store, root, first, second, driver, adapter, wakes };
  }

  it("wakes it once, with the event, when the run that held the project's session ends", async () => {
    const { store, first, second, driver, adapter, wakes } = pickedUpTogether();
    const refused = await runnerActions(driver.actionsFor(first), first).startStep({
      stage: "triage",
      instructions: "Sort the request.",
      reason: "A new ticket starts with sorting.",
    });
    expect(refused.ok).toBe(false);

    await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
    await driver.drain();
    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([]);

    store.complete(second.id);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
      await driver.drain();
    }

    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([
      { runId: first.id, events: ["The project is free now."], options: {} },
    ]);
  });

  it("wakes it once, with the event, when the run that held the project parks without a branch", async () => {
    const { store, first, second, driver, adapter, wakes } = pickedUpTogether();
    // #13's step takes the project's one place, so #12's step is refused.
    const refused = await runnerActions(driver.actionsFor(first), first).startStep({
      stage: "planning",
      instructions: "Write the plan.",
      skipReason: "The ticket names the one line to change.",
      reason: "Small enough to plan at once.",
    });
    expect(refused.ok).toBe(false);

    store.park(second.id, RUNNER_WAIT);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
      await driver.drain();
    }

    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([
      { runId: first.id, events: ["The project is free now."], options: {} },
    ]);
  });

  it("wakes it again after a new refusal, once the project is free again", async () => {
    const { store, first, second, driver, adapter, wakes } = pickedUpTogether();
    const tryToSort = () =>
      runnerActions(driver.actionsFor(first), first).startStep({
        stage: "triage",
        instructions: "Sort the request.",
        reason: "A new ticket starts with sorting.",
      });
    expect((await tryToSort()).ok).toBe(false);
    store.complete(second.id);
    await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
    await driver.drain();

    // Woken, the runner tries again; a third ticket's run took the project meanwhile.
    const third = store.activate(store.register("scratch-app", 14).run.id, "step-session-14");
    expect((await tryToSort()).ok).toBe(false);
    await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
    await driver.drain();
    store.park(third.id, RUNNER_WAIT);
    await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
    await driver.drain();

    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([
      { runId: first.id, events: ["The project is free now."], options: {} },
      { runId: first.id, events: ["The project is free now."], options: {} },
    ]);
  });

  it("does not wake a run refused for another reason when the project is free", async () => {
    const { store, first, second, driver, adapter, wakes } = pickedUpTogether();
    // Refused for a missing reason to skip sorting, not for the busy project.
    const refused = await runnerActions(driver.actionsFor(first), first).startStep({
      stage: "planning",
      instructions: "Write the plan.",
      reason: "Small enough to plan at once.",
    });
    expect(refused.ok).toBe(false);

    store.complete(second.id);
    await driver.tick(PROJECT, MANIFEST.projects["scratch-app"]!, cycleOver(adapter));
    await driver.drain();

    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([]);
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
