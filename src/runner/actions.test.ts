import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PullRequest,
  TicketComment,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { breakdownPath, renderBreakdown } from "../daemon/breakdown.js";
import { mergeChunkZero, type ChunkZeroDeps } from "../daemon/chunk-zero.js";
import { RunStore, type Run } from "../daemon/runs.js";
import type {
  StepResult,
  StepSession,
  StepSessionInput,
} from "../daemon/step-session.js";
import { RunningSteps, runnerActions, type RunnerActions } from "./actions.js";
import { appendEntry, readRecord, type RecordEntry } from "./record.js";

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

const TIMONE_REPO = "https://github.com/fvermaut/timone.git";

/** The work branch of scratch-app #12's first run, as `workBranch` names it. */
const BRANCH = "timone/12-a-due-date-on-each-task";

/** scratch-app, driven by the runner and instructed by the operator; and Timone itself. */
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
    timone: {
      repo_url: TIMONE_REPO,
      path: "projects/timone",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
    },
  },
};

/** A new feature ticket on scratch-app, with no comments yet. */
function featureTicket(comments: TicketComment[] = []): TicketThread {
  return {
    number: 12,
    title: "A due date on each task",
    body: "Each task should have a due date. The list should show the late tasks first, in red.",
    labels: ["timone", "triage:feature"],
    url: "https://github.com/fvermaut/scratch-app/issues/12",
    author: "fvermaut",
    createdAt: "2026-09-27T09:00:00Z",
    comments,
  };
}

/** A comment on the ticket by a person, not by the machine. */
function personSaid(author: string, createdAt: string, body: string): TicketComment {
  return { author, body, createdAt, fromTimone: false };
}

/**
 * An in-memory forge holding one ticket. Every call the actions make that
 * changes something is written to `calls`, which the step starter writes to
 * as well, so a test can read the order things happened in.
 */
function fakeForge(ticket: TicketThread, calls: string[]) {
  const thread = { ...ticket, comments: [...ticket.comments] };
  const state = {
    thread,
    comments: [] as { number: number; body: string }[],
    pullRequestComments: [] as { number: number; body: string }[],
    issues: [] as { project: TicketingProject; title: string; body: string; labels: string[] }[],
    issueComments: [] as { project: TicketingProject; number: number; body: string }[],
    closed: [] as { number: number; reason: string }[],
    defaultHead: "4f2a9c1",
    ahead: 0 as number | undefined,
    pullRequest: undefined as PullRequest | undefined,
    /** Files on the default branch, by path. */
    files: new Map<string, string>(),
    stepTickets: [] as { number: number; title: string; body: string }[],
    ticketBody: ticket.body,
  };
  const unused = (name: string) => async (): Promise<never> => {
    throw new Error(`no test here calls the forge's ${name}`);
  };
  const adapter: TicketingAdapter = {
    readBranches: async () => ({ defaultBranch: "main", defaultHead: state.defaultHead }),
    mergeIntoDefault: async (_project, branch) => {
      calls.push(`merge ${branch}`);
      state.defaultHead = `merge of ${branch}`;
      return { merged: true, into: "main" };
    },
    aheadOfDefault: async () => state.ahead,
    readFile: async (_project, branch, path) =>
      branch === "main" ? state.files.get(path) : undefined,
    listFiles: unused("listFiles"),
    listMarkedTickets: unused("listMarkedTickets"),
    listOpenTickets: unused("listOpenTickets"),
    listSteps: async () =>
      state.stepTickets.map((step) => ({
        number: step.number,
        title: step.title,
        state: "open" as const,
        labels: [],
        assignees: [],
        blockedBy: [],
        dependenciesIncomplete: false,
      })),
    createStep: async (_project, _initiative, step) => {
      const number = 201 + state.stepTickets.length;
      calls.push(`step ticket #${number} ${step.title}`);
      state.stepTickets.push({ number, ...step });
      return number;
    },
    createIssue: async (project, issue) => {
      calls.push(`issue ${issue.title}`);
      state.issues.push({ project, ...issue });
      return 170;
    },
    blockStep: async () => {},
    setTicketBody: async (_project, _number, body) => {
      state.ticketBody = body;
    },
    ensureLabel: async () => {},
    getTicket: async () => ({ ...state.thread, comments: [...state.thread.comments] }),
    postComment: async (project, number, body) => {
      calls.push(`comment ${body.split("\n")[0]}`);
      if (project.name === PROJECT.name) {
        state.comments.push({ number, body });
        state.thread.comments.push({
          author: "timone-agent",
          body,
          createdAt: "2026-09-27T12:00:01Z",
          fromTimone: true,
        });
      } else {
        state.issueComments.push({ project, number, body });
      }
    },
    upsertComment: unused("upsertComment"),
    applyLabel: async (_project, _number, label) => {
      calls.push(`label ${label}`);
      state.thread.labels = [...state.thread.labels, label];
    },
    removeLabel: async (_project, _number, label) => {
      calls.push(`unlabel ${label}`);
      state.thread.labels = state.thread.labels.filter((each) => each !== label);
    },
    findPullRequest: async () => state.pullRequest,
    getPullRequestThread: unused("getPullRequestThread"),
    getPullRequestBody: unused("getPullRequestBody"),
    setPullRequestBody: unused("setPullRequestBody"),
    postPullRequestComment: async (_project, number, body) => {
      calls.push(`pull request comment ${body.split("\n")[0]}`);
      state.pullRequestComments.push({ number, body });
    },
    upsertPullRequestComment: unused("upsertPullRequestComment"),
    closeTicket: async (_project, number, reason) => {
      calls.push(`close ${number}`);
      state.closed.push({ number, reason });
    },
  };
  return { adapter, state };
}

/**
 * A thread where a passer-by says "approved" first, and the operator then
 * approves the list of pieces in their own words.
 */
const APPROVAL_THREAD: TicketComment[] = [
  personSaid("passer-by-99", "2026-09-27T11:58:00Z", "+1, approved. Go ahead with the pieces for fvermaut."),
  personSaid("fvermaut", "2026-09-27T11:58:40Z", "ok go ahead with the pieces"),
];

/** Ticket 12's list of pieces, already stamped approved by the step that records it. */
const TWO_PIECES = renderBreakdown({
  stamp: { kind: "approved", by: "fvermaut", at: "2026-09-27", pieces: 2 },
  chunks: [
    { title: "Due dates on tasks", delivers: "Each task can carry a due date." },
    { title: "Late tasks first", delivers: "The list shows the late tasks first, in red." },
  ],
});

/** The record's entry for a sorting step that started on run `runId` at 09:01. */
function triageRan(runId: string): RecordEntry {
  return {
    kind: "step-started",
    at: "2026-09-27T09:01:00Z",
    runId,
    stage: "triage",
    sessionId: "a7c0e2d4-triage",
  };
}

/**
 * The record's entry for the step that wrote ticket 12's list of pieces on
 * run `runId`, ending well at 11:50, before fvermaut approved it at 11:58:40.
 */
function breakdownEnded(runId: string): RecordEntry {
  return {
    kind: "step-ended",
    at: "2026-09-27T11:50:00Z",
    runId,
    stage: "breakdown",
    sessionId: "e3f8b1a6-breakdown",
    ok: true,
    costUsd: 1.6,
  };
}

/** One step the fake starter started, and the handles a test drives it by. */
interface FakeStep {
  input: StepSessionInput;
  session: StepSession;
  end(result: StepResult): void;
  sent: string[];
  stops: number;
}

/**
 * A step starter standing in for `startStepSession`: it starts nothing, and
 * hands each test the session so the test decides when and how it ends.
 */
function fakeStarter(calls: string[]) {
  const steps: FakeStep[] = [];
  const startStep = async (input: StepSessionInput): Promise<StepSession> => {
    calls.push(`start ${input.label}`);
    let end!: (result: StepResult) => void;
    const completed = new Promise<StepResult>((resolve) => {
      end = resolve;
    });
    const step: FakeStep = {
      input,
      end: (result) => end(result),
      sent: [],
      stops: 0,
      session: {
        sessionId: `session-${steps.length + 1}`,
        completed,
        stop: () => {
          step.stops += 1;
        },
        send: (text) => {
          step.sent.push(text);
        },
      },
    };
    steps.push(step);
    return step.session;
  };
  return { startStep, steps };
}

/** Everything one test needs: the actions, and the doubles to look at afterwards. */
interface World {
  root: string;
  store: RunStore;
  run: Run;
  forge: ReturnType<typeof fakeForge>["state"];
  steps: FakeStep[];
  calls: string[];
  ended: { runId: string; stage: string; result: StepResult }[];
  actions: RunnerActions;
  /** The run's record, as the machine wrote it. */
  record(): RecordEntry[];
  /** Write an entry into the run's record before the actions are used. */
  wrote(entry: RecordEntry): void;
  /** End `step` with `result`, and wait until the driver has been told. */
  endAndWait(step: FakeStep, result: StepResult): Promise<void>;
}

/**
 * The runner's actions on run `scratch-app#12/1`, active, with nothing running.
 * `setup` runs against the store before the actions are built.
 */
function world(ticket: TicketThread = featureTicket()): World {
  const root = mkdtempSync(join(tmpdir(), "timone-actions-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"));
  const { run: registered } = store.register(PROJECT.name, 12);
  const run = store.activate(registered.id, "runner-session-1");
  const calls: string[] = [];
  const { adapter, state } = fakeForge(ticket, calls);
  const { startStep, steps } = fakeStarter(calls);
  const ended: World["ended"] = [];
  let told: (() => void) | undefined;
  const actions = runnerActions(
    {
      store,
      adapter,
      manifest: MANIFEST,
      root,
      timonePin: async () => undefined,
      project: PROJECT,
      ticketContext: { isStep: false, isRemediation: false },
      startStep,
      running: new RunningSteps(),
      stepEnded: async (runId, stage, result) => {
        ended.push({ runId, stage, result });
        told?.();
      },
      clock: () => "2026-09-27T12:00:00.000Z",
      log: () => {},
    },
    run,
  );
  return {
    root,
    store,
    run,
    forge: state,
    steps,
    calls,
    ended,
    actions,
    record: () => {
      const read = readRecord(root, PROJECT.name, 12);
      if (!read.ok) throw new Error(read.error.message);
      return read.value;
    },
    wrote: (entry) => appendEntry(root, PROJECT.name, 12, entry),
    endAndWait: async (step, result) => {
      const driverTold = new Promise<void>((resolve) => {
        told = resolve;
      });
      step.end(result);
      await driverTold;
    },
  };
}

/** A step that finished its work, having cost `costUsd`. */
function finished(sessionId: string, costUsd: number): StepResult {
  return {
    outcome: { sessionId, ok: true },
    summary: { durationMs: 412_000, turns: 38, costUsd, models: [] },
  };
}

describe("the runner's actions", () => {
  it("refuses a post with no line saying what the reader must do, and posts nothing", async () => {
    const { actions, forge } = world();

    const result = await actions.post({
      where: "ticket",
      body: "**The requirements are written.** They are in doc/specs/prd/prd-02-due-dates.md.",
      reason: "Tell fvermaut the requirements are ready.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("**What I need from you:**") });
    expect(forge.comments).toEqual([]);
  });

  it("files a Timone issue on the timone project, labelled bug", async () => {
    const { actions, forge } = world();

    const result = await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12 at 2026-09-27T11:40:00Z, in session 3f1c9a52.",
      reason: "The failure came from Timone's own code, and no open issue describes it.",
    });

    expect(result.ok).toBe(true);
    expect(forge.issues).toEqual([
      {
        project: { name: "timone", repoUrl: TIMONE_REPO },
        title: "A step is started twice when the box restarts",
        body: "Seen on scratch-app #12 at 2026-09-27T11:40:00Z, in session 3f1c9a52.",
        labels: ["bug"],
      },
    ]);
  });

  it("refuses to end a run whose branch has two commits the default branch lacks and no pull request, and leaves it running", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = undefined;

    const result = await actions.endRun({
      reason: "The work is done.",
      closeTicket: true,
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining(BRANCH) });
    expect(store.get(run.id)?.status).toBe("active");
    expect(forge.closed).toEqual([]);
  });

  it("ends a run whose branch holds nothing the default branch lacks", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 0;

    const result = await actions.endRun({
      reason: "The question was answered on the ticket; nothing was changed.",
      closeTicket: false,
    });

    expect(result.ok).toBe(true);
    expect(store.get(run.id)?.status).toBe("done");
  });

  it("ends a run whose pull request was merged, though a squash merge left its branch ahead", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 3;
    forge.pullRequest = {
      number: 31,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/31",
      state: "merged",
      headSha: "9e1d0b7",
    };

    const result = await actions.endRun({
      reason: "fvermaut merged the pull request.",
      closeTicket: true,
    });

    expect(result.ok).toBe(true);
    expect(store.get(run.id)?.status).toBe("done");
  });

  it("refuses a step that leaves out a step of the default order when no reason is given, and starts nothing", async () => {
    const { actions, run, wrote, steps, forge, record } = world();
    wrote(triageRan(run.id));

    const result = await actions.startStep({
      stage: "requirements",
      instructions: "Write the requirements for due dates.",
      reason: "The ticket is clear.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("asking what you need") });
    expect(steps).toEqual([]);
    expect(forge.comments).toEqual([]);
    expect(record().filter((entry) => entry.kind === "departure")).toEqual([]);
  });

  it("tells the ticket a step is being skipped before the step that skips it starts", async () => {
    const { actions, run, wrote, calls } = world();
    wrote(triageRan(run.id));

    const result = await actions.startStep({
      stage: "requirements",
      instructions: "Write the requirements for due dates.",
      reason: "The ticket is clear.",
      skipReason: "The ticket already says what the list must show.",
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      "comment **I am skipping a step.** I am going straight to writing down what it needs, " +
        "without asking what you need. Reason: The ticket already says what the list must show.",
      "start scratch-app#12/1 (requirements)",
    ]);
  });

  it("writes down how a step ended and what it cost, then hands the run back to the driver", async () => {
    const { actions, run, steps, record, ended, endAndWait } = world();
    await actions.startStep({
      stage: "triage",
      instructions: "Sort this request.",
      reason: "A new ticket.",
    });

    await endAndWait(steps[0]!, finished("session-1", 0.38));

    expect(record().filter((entry) => entry.kind.startsWith("step-"))).toEqual([
      {
        kind: "step-started",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        stage: "triage",
        sessionId: "session-1",
        instructions: "Sort this request.",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        stage: "triage",
        sessionId: "session-1",
        ok: true,
        costUsd: 0.38,
      },
    ]);
    expect(ended).toEqual([{ runId: run.id, stage: "triage", result: finished("session-1", 0.38) }]);
  });

  it("does not ask again for the reason of a step it already skipped with one", async () => {
    const chore = { ...featureTicket(), labels: ["timone", "triage:chore"] };
    const { actions, run, wrote, steps, endAndWait, forge } = world(chore);
    wrote(triageRan(run.id));
    await actions.startStep({
      stage: "execution",
      instructions: "Rename the column in the task list.",
      reason: "The change is one line.",
      skipReason: "Renaming one column needs no plan.",
    });
    await endAndWait(steps[0]!, finished("session-1", 1.2));

    const result = await actions.startStep({
      stage: "verification",
      instructions: "Check that the column is renamed everywhere.",
      reason: "The work is built.",
    });

    expect(result.ok).toBe(true);
    expect(forge.comments).toHaveLength(1);
  });

  it("refuses every step once the ticket has spent its limit, and says so on the ticket only once", async () => {
    const { actions, run, wrote, steps, forge } = world();
    wrote({
      kind: "step-ended",
      at: "2026-09-27T11:00:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "b41e-requirements",
      ok: true,
      costUsd: 150.4,
    });
    const triage = { stage: "triage", instructions: "Sort this request.", reason: "A new ticket." } as const;

    const first = await actions.startStep(triage);
    const second = await actions.startStep(triage);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    expect(steps).toEqual([]);
    expect(forge.comments.map((comment) => comment.body.split("\n")[0])).toEqual([
      "**This ticket has reached its spending limit.** It has cost $150.40, and the limit is $150.00. " +
        "I will not start any more work on it for now.",
    ]);
  });

  it("refuses an approval given in a comment by someone who is not named, and records none", async () => {
    const { actions, store, run, steps, record } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);

    const result = await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:00Z",
      reason: "The list of pieces was approved on the ticket.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("passer-by-99") });
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([]);
    expect(steps).toEqual([]);
  });

  it("records a named person's approval, and starts the step that writes it into the file", async () => {
    const { actions, store, run, steps, record, wrote } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote(breakdownEnded(run.id));

    const result = await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the list of pieces.",
    });

    expect(result.ok).toBe(true);
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([
      {
        kind: "approval",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        what: "pieces",
        by: "fvermaut",
        commentAt: "2026-09-27T11:58:40Z",
      },
    ]);
    expect(steps.map((step) => [step.input.label, step.input.request.model])).toEqual([
      ["scratch-app#12/1 (recording the approval)", "claude-haiku-4-5"],
    ]);
  });

  it("merges nothing into the default branch when no approval of the pieces is in the record", async () => {
    const { actions, store, run, forge, record } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);

    const result = await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:00Z",
      reason: "passer-by-99 approved the pieces for fvermaut.",
    });

    expect(result.ok).toBe(false);
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([]);
    expect(forge.defaultHead).toBe("4f2a9c1");

    // The merge itself cannot be written without an approval: `tsc` fails on
    // this file if the line below ever compiles. It is never run.
    const mergeWithoutApproval = (deps: ChunkZeroDeps, project: TicketingProject) =>
      // @ts-expect-error — `mergeChunkZero` requires the approval that allows it (R3).
      mergeChunkZero(deps, run, project);
    expect(mergeWithoutApproval).toBeTypeOf("function");
  });

  it("merges the requirements and the pieces into the default branch once the approval is in the file, opens a ticket per piece, and ends the run", async () => {
    const { actions, store, run, forge, steps, endAndWait, record, wrote } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote(breakdownEnded(run.id));
    forge.files.set(breakdownPath(12), TWO_PIECES);
    await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the list of pieces.",
    });

    await endAndWait(steps[0]!, finished("session-1", 0.04));

    expect(forge.defaultHead).toBe(`merge of ${BRANCH}`);
    expect(forge.stepTickets.map((step) => step.title)).toEqual([
      "1. Due dates on tasks",
      "2. Late tasks first",
    ]);
    expect(store.get(run.id)?.status).toBe("done");
    expect(record()).toContainEqual({
      kind: "decision",
      at: "2026-09-27T12:00:00.000Z",
      runId: run.id,
      action: "chunk-zero-merged",
      reason: "the list of pieces was approved by fvermaut, in the comment at 2026-09-27T11:58:40Z",
    });
    expect(forge.comments.at(-1)?.body.split("\n")[0]).toBe(
      "**The list of pieces is approved.** fvermaut approved it. I added the requirements " +
        "and the list to the project's default branch, and each piece now has its own ticket, " +
        "listed at the top of this one.",
    );
  });

  it("merges nothing when the record no longer holds the approval of the pieces by the time its step ends", async () => {
    const { actions, root, store, run, forge, steps, endAndWait } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    appendEntry(root, PROJECT.name, 12, breakdownEnded(run.id));
    forge.files.set(breakdownPath(12), TWO_PIECES);
    await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the list of pieces.",
    });
    // The record is the only proof of the approval the merge may act on.
    // Here it is lost while the step runs, so nothing proves it any more.
    rmSync(join(root, ".timone", "records", "scratch-app", "12.jsonl"));

    await endAndWait(steps[0]!, finished("session-1", 0.04));

    expect(forge.defaultHead).toBe("4f2a9c1");
    expect(forge.stepTickets).toEqual([]);
    expect(store.get(run.id)?.status).toBe("active");
  });

  it("starts no second step while a step of the run is running", async () => {
    const { actions, steps } = world();
    const triage = { stage: "triage", instructions: "Sort this request.", reason: "A new ticket." } as const;
    await actions.startStep(triage);

    const second = await actions.startStep(triage);

    expect(second).toEqual({ ok: false, refused: expect.stringContaining("sorting the request") });
    expect(steps).toHaveLength(1);
  });

  it("passes the runner's message to the step that is running", async () => {
    const { actions, steps } = world();
    await actions.startStep({ stage: "triage", instructions: "Sort this request.", reason: "A new ticket." });

    const result = await actions.messageStep({
      text: "The ticket names a bug, not a feature. Look at the second paragraph.",
      reason: "The step has been reading the ticket as a feature.",
    });

    expect(result.ok).toBe(true);
    expect(steps[0]?.sent).toEqual([
      "The ticket names a bug, not a feature. Look at the second paragraph.",
    ]);
  });

  it("stops the running step, and writes down that the runner stopped it", async () => {
    const { actions, steps, record, endAndWait } = world();
    await actions.startStep({ stage: "triage", instructions: "Sort this request.", reason: "A new ticket." });

    const result = await actions.stopStep({ reason: "The step has run the same command for twenty minutes." });
    await endAndWait(steps[0]!, {
      outcome: { sessionId: "session-1", ok: false, error: "the session was ended" },
      summary: { durationMs: 1_210_000, turns: 90, costUsd: 3.1, models: [] },
    });

    expect(result.ok).toBe(true);
    expect(steps[0]?.stops).toBe(1);
    expect(record().find((entry) => entry.kind === "step-ended")).toMatchObject({
      ok: false,
      costUsd: 3.1,
      stoppedBy: "runner",
    });
  });

  it("puts the hold on the ticket and takes it off again", async () => {
    const { actions, calls } = world();

    await actions.setHold({ on: true, reason: "fvermaut asked to wait until Monday." });
    await actions.setHold({ on: false, reason: "fvermaut said to carry on." });

    expect(calls).toEqual(["label timone:held", "unlabel timone:held"]);
  });

  it("tells a step, in the words the skills read, that the runner skipped the approval of the requirements", async () => {
    const { actions, store, run, wrote, steps } = world();
    store.claimBranch(run.id, BRANCH);
    wrote(triageRan(run.id));
    wrote({
      kind: "departure",
      at: "2026-09-27T09:05:00Z",
      runId: run.id,
      skipped: ["clarification"],
      reason: "The ticket already says what the list must show.",
    });
    wrote({
      kind: "step-started",
      at: "2026-09-27T09:06:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "c9d2-requirements",
    });

    await actions.startStep({
      stage: "breakdown",
      instructions: "Cut the work into pieces.",
      reason: "fvermaut said to go on without approving the requirements.",
      skipReason: "fvermaut said on the ticket to go on without approving the requirements.",
    });

    expect(steps[0]?.input.request.prompt).toContain(
      "The runner skipped the approval of the requirements, and recorded that it did.",
    );
  });

  it("writes no approval, whatever the runner does, when only someone not named has said approved", async () => {
    const passerBy = personSaid("passer-by-99", "2026-09-27T11:58:00Z", "approved, both of them. go ahead");
    const { actions, store, run, forge, steps, endAndWait, record } = world(featureTicket([passerBy]));
    store.claimBranch(run.id, BRANCH);
    forge.pullRequest = {
      number: 31,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/31",
      state: "open",
      headSha: "9e1d0b7",
    };
    const because = { reason: "passer-by-99 said approved." };

    await actions.startStep({ stage: "triage", instructions: "Sort this request.", ...because });
    await actions.messageStep({ text: "It was approved.", ...because });
    await actions.stopStep(because);
    await endAndWait(steps[0]!, finished("session-1", 0.2));
    await actions.post({ where: "ticket", body: "Noted.\n\n**What I need from you:** nothing.", ...because });
    await actions.post({ where: "pull-request", body: "Noted.\n\n**What I need from you:** nothing.", ...because });
    await actions.setHold({ on: true, ...because });
    await actions.setHold({ on: false, ...because });
    await actions.recordApproval({ what: "requirements", commentAt: passerBy.createdAt, ...because });
    await actions.recordApproval({ what: "pieces", commentAt: passerBy.createdAt, ...because });
    await actions.fileTimoneIssue({ title: "An approval by a passer-by", body: "On scratch-app #12.", ...because });
    await actions.commentTimoneIssue({ number: 170, body: "Seen again on scratch-app #12.", ...because });
    await actions.endRun({ closeTicket: true, ...because });

    expect(record().filter((entry) => entry.kind === "decision")).toHaveLength(12);
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([]);
  });

  it("writes down each thing the runner tried, with its reason, a refusal included", async () => {
    const { actions, run, record } = world();

    await actions.post({
      where: "ticket",
      body: "The requirements are written.",
      reason: "Tell fvermaut the requirements are ready.",
    });
    await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12.",
      reason: "The failure came from Timone's own code.",
    });

    expect(record()).toEqual([
      {
        kind: "decision",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        action: "post",
        reason: "Tell fvermaut the requirements are ready.",
        detail: expect.stringMatching(/^Refused: The comment has no line/),
      },
      {
        kind: "decision",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        action: "file_timone_issue",
        reason: "The failure came from Timone's own code.",
      },
    ]);
  });

  it("refuses a named person's comment written before the requirements step ended as their approval, and records none", async () => {
    const { actions, store, run, wrote, steps, record } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote({
      kind: "step-started",
      at: "2026-09-27T11:20:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "c9d2-requirements",
    });
    wrote({
      kind: "step-ended",
      at: "2026-09-27T11:59:30Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "c9d2-requirements",
      ok: true,
      costUsd: 2.4,
    });

    const result = await actions.recordApproval({
      what: "requirements",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut said to go ahead.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("before the requirements were finished") });
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([]);
    expect(steps).toEqual([]);
  });

  it("records a named person's comment written after the requirements step ended as their approval", async () => {
    const { actions, store, run, wrote, record } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote({
      kind: "step-started",
      at: "2026-09-27T11:20:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "c9d2-requirements",
    });
    wrote({
      kind: "step-ended",
      at: "2026-09-27T11:58:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "c9d2-requirements",
      ok: true,
      costUsd: 2.4,
    });

    const result = await actions.recordApproval({
      what: "requirements",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the requirements.",
    });

    expect(result.ok).toBe(true);
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([
      {
        kind: "approval",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        what: "requirements",
        by: "fvermaut",
        commentAt: "2026-09-27T11:58:40Z",
      },
    ]);
  });

  it("refuses an approval of the list of pieces when no step of the run has written the list, and records none", async () => {
    const { actions, store, run, wrote, steps, record } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote({
      kind: "step-ended",
      at: "2026-09-27T11:40:00Z",
      runId: run.id,
      stage: "breakdown",
      sessionId: "d17a-breakdown",
      ok: false,
      costUsd: 0.9,
      error: "The requirements file was not found on the branch.",
    });

    const result = await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut said to go ahead with the pieces.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("nothing to approve") });
    expect(record().filter((entry) => entry.kind === "approval")).toEqual([]);
    expect(steps).toEqual([]);
  });
});
