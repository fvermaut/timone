import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
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
      driver: "runner",
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
    async upsertComment() {},
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
