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
import { tryMergeChunkZero, type ChunkZeroDeps } from "../daemon/chunk-zero.js";
import type { Holder } from "../daemon/holder.js";
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
    listPullRequestFiles: async () => [],
    readBranches: async () => ({ defaultBranch: "main", defaultHead: state.defaultHead }),
    mergeIntoDefault: async (_project, branch) => {
      calls.push(`merge ${branch}`);
      state.defaultHead = `merge of ${branch}`;
      return { merged: true, into: "main" };
    },
    aheadOfDefault: async () => state.ahead,
    behindDefault: async () => ({ behind: 0, defaultHead: state.defaultHead }),
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
    applyLabel: async (_project, _number, label) => {
      calls.push(`label ${label}`);
      state.thread.labels = [...state.thread.labels, label];
    },
    removeLabel: async (_project, _number, label) => {
      calls.push(`unlabel ${label}`);
      state.thread.labels = state.thread.labels.filter((each) => each !== label);
    },
    findPullRequest: async () => state.pullRequest,
    findOpenPullRequestOfTicket: async () => undefined,
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
 * `setup` runs against the store before the actions are built. The manifest
 * is {@link MANIFEST} unless the test gives its own.
 */
function world(ticket: TicketThread = featureTicket(), manifest: Manifest = MANIFEST): World {
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
      manifest,
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

/**
 * The runner's actions on run `scratch-app#12/1`, as {@link world} builds
 * them, with a step starter that writes down the run's stage in the ledger at
 * the moment it is called. With `start: "fails"`, it then throws, as a box
 * that cannot start does.
 */
function stageWatchingWorld(start: "starts" | "fails") {
  const root = mkdtempSync(join(tmpdir(), "timone-actions-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"));
  const { run: registered } = store.register(PROJECT.name, 12);
  const run = store.activate(registered.id, "runner-session-1");
  const { adapter } = fakeForge(featureTicket(), []);
  const stagesAtStart: (string | undefined)[] = [];
  const startStep = async (): Promise<StepSession> => {
    stagesAtStart.push(store.get(run.id)?.stage);
    if (start === "fails") throw new Error("the box did not start: no space left on the disk");
    return { sessionId: "session-1", completed: new Promise<StepResult>(() => {}), stop: () => {} };
  };
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
      stepEnded: async () => {},
      clock: () => "2026-09-27T12:00:00.000Z",
      log: () => {},
    },
    run,
  );
  return {
    store,
    run,
    actions,
    stagesAtStart,
    wrote: (entry: RecordEntry) => appendEntry(root, PROJECT.name, 12, entry),
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
        body:
          "Seen on scratch-app #12 at 2026-09-27T11:40:00Z, in session 3f1c9a52.\n\n" +
          "Named so that GitHub tells them about this ticket and every comment on it: @fvermaut",
        labels: ["bug"],
      },
    ]);
  });

  it("names the operator on a Timone issue when the timone project lists no instructors, under the runner's own words (R2)", async () => {
    const { actions, forge } = world();

    await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12, in session 3f1c9a52.",
      reason: "The failure came from Timone's own code.",
    });

    expect(forge.issues[0]?.body).toContain("@fvermaut");
    expect(forge.issues[0]?.body.startsWith("Seen on scratch-app #12, in session 3f1c9a52.")).toBe(true);
  });

  it("names the timone project's people on a Timone issue, never those of the project the run is on (R2)", async () => {
    const onScratchApp: Manifest = {
      ...MANIFEST,
      projects: {
        ...MANIFEST.projects,
        "scratch-app": { ...MANIFEST.projects["scratch-app"]!, instructors: ["client-person"] },
      },
    };
    const { actions, forge } = world(featureTicket(), onScratchApp);

    await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12, in session 3f1c9a52.",
      reason: "The failure came from Timone's own code.",
    });

    expect(forge.issues[0]?.body).toContain("@fvermaut");
    expect(forge.issues[0]?.body).not.toContain("@client-person");
  });

  it("names the timone project's instructors on a Timone issue, and not the operator they replace", async () => {
    const instructedTimone: Manifest = {
      ...MANIFEST,
      projects: {
        ...MANIFEST.projects,
        timone: { ...MANIFEST.projects["timone"]!, instructors: ["alice"] },
      },
    };
    const { actions, forge } = world(featureTicket(), instructedTimone);

    await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12, in session 3f1c9a52.",
      reason: "The failure came from Timone's own code.",
    });

    expect(forge.issues[0]?.body).toContain("@alice");
    expect(forge.issues[0]?.body).not.toContain("@fvermaut");
  });

  it("files a Timone issue with the runner's body as it is when the manifest names nobody (R5)", async () => {
    const namesNobody: Manifest = { projects: { ...MANIFEST.projects } };
    const { actions, forge } = world(featureTicket(), namesNobody);

    const result = await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12, in session 3f1c9a52.",
      reason: "The failure came from Timone's own code.",
    });

    expect(result.ok).toBe(true);
    expect(forge.issues[0]?.body).toBe("Seen on scratch-app #12, in session 3f1c9a52.");
  });

  it("keeps a Timone issue's title and its one label, bug, when it names people", async () => {
    const { actions, forge } = world();

    await actions.fileTimoneIssue({
      title: "A step is started twice when the box restarts",
      body: "Seen on scratch-app #12, in session 3f1c9a52.",
      reason: "The failure came from Timone's own code.",
    });

    expect(forge.issues[0]?.title).toBe("A step is started twice when the box restarts");
    expect(forge.issues[0]?.labels).toEqual(["bug"]);
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

  it("refuses to end a run while its pull request is open, leaves it running, and closes no ticket", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = {
      number: 31,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/31",
      state: "open",
      headSha: "9e1d0b7",
    };

    const result = await actions.endRun({
      reason: "The pull request is open, so the work is delivered.",
      closeTicket: true,
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("Pull request #31 is open") });
    expect(store.get(run.id)?.status).toBe("active");
    expect(forge.closed).toEqual([]);
  });

  it("refuses to end a run whose pull request was closed without merging while its branch is still ahead, names the two ways it can end, and leaves it running (40w)", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = {
      number: 31,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/31",
      state: "closed",
      headSha: "9e1d0b7",
    };
    const before = store.get(run.id);

    const result = await actions.endRun({
      reason: "fvermaut closed the pull request and wrote that the feature is not wanted.",
      closeTicket: true,
    });

    expect(result).toEqual({
      ok: false,
      refused:
        `Pull request #31 was closed without merging, and the changes this run made on ${BRANCH} ` +
        "are not on the default branch. The run can end in two ways: a new pull request for this work " +
        "is merged, or a named person asks on the ticket to stop the work.",
    });
    expect(store.get(run.id)).toEqual(before);
    expect(store.get(run.id)?.status).toBe("active");
    expect(forge.closed).toEqual([]);
  });

  it("records the step's stage in the ledger before its session starts, and leaves it there while the step runs", async () => {
    const { actions, store, run, stagesAtStart } = stageWatchingWorld("starts");

    const result = await actions.startStep({
      stage: "triage",
      instructions: "Sort this request.",
      reason: "A new ticket.",
    });

    expect(result.ok).toBe(true);
    expect(stagesAtStart).toEqual(["triage"]);
    expect(store.get(run.id)?.stage).toBe("triage");
  });

  it("puts the ledger's stage back as it was when the step's session does not start", async () => {
    const { actions, store, run, wrote } = stageWatchingWorld("fails");
    wrote(triageRan(run.id));
    store.setStage(run.id, "triage");

    const result = await actions.startStep({
      stage: "clarification",
      instructions: "Ask fvermaut what a late task is.",
      reason: "The ticket is sorted. Asking what is needed is next.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("no space left on the disk") });
    expect(store.get(run.id)?.stage).toBe("triage");
  });

  it("leaves the ledger's stage as it was when a step is refused", async () => {
    const { actions, store, run, wrote, stagesAtStart } = stageWatchingWorld("starts");
    wrote(triageRan(run.id));
    store.setStage(run.id, "triage");

    const result = await actions.startStep({
      stage: "requirements",
      instructions: "Write the requirements for due dates.",
      reason: "The ticket is clear.",
    });

    expect(result.ok).toBe(false);
    expect(stagesAtStart).toEqual([]);
    expect(store.get(run.id)?.stage).toBe("triage");
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
    const { actions, run, wrote, steps, endAndWait, forge, store } = world(chore);
    wrote(triageRan(run.id));
    // ✏ 2026-10-05: the build needs the planner's decision (ADR-0065 D2).
    store.decidePlanner(run.id, {
      kind: "build",
      at: "2026-09-27T11:00:00Z",
      reason: "Nothing else on the project is being built.",
    });
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

  it("refuses delivering with no reason when building ran again after the check, and starts nothing", async () => {
    const chore = { ...featureTicket(), labels: ["timone", "triage:chore"] };
    const { actions, run, wrote, steps, forge, record } = world(chore);
    for (const [stage, at] of [
      ["triage", "2026-09-29T10:00:00Z"],
      ["planning", "2026-09-29T10:10:00Z"],
      ["execution", "2026-09-29T10:20:00Z"],
      ["verification", "2026-09-29T10:50:00Z"],
      ["execution", "2026-09-29T11:00:00Z"],
    ] as const) {
      wrote({ kind: "step-started", at, runId: run.id, stage, sessionId: `s-${stage}-${at}` });
    }

    const result = await actions.startStep({
      stage: "delivery",
      instructions: "Open the pull request.",
      reason: "The fix is built.",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("checking the result") });
    expect(steps).toEqual([]);
    expect(forge.comments).toEqual([]);
    expect(record().filter((entry) => entry.kind === "departure")).toEqual([]);
  });

  it("tells the ticket the check is skipped before delivering starts, when building ran again after the check", async () => {
    const chore = { ...featureTicket(), labels: ["timone", "triage:chore"] };
    const { actions, run, wrote, calls, record } = world(chore);
    for (const [stage, at] of [
      ["triage", "2026-09-29T10:00:00Z"],
      ["planning", "2026-09-29T10:10:00Z"],
      ["execution", "2026-09-29T10:20:00Z"],
      ["verification", "2026-09-29T10:50:00Z"],
      ["execution", "2026-09-29T11:00:00Z"],
    ] as const) {
      wrote({ kind: "step-started", at, runId: run.id, stage, sessionId: `s-${stage}-${at}` });
    }

    const result = await actions.startStep({
      stage: "delivery",
      instructions: "Open the pull request.",
      reason: "The fix is built.",
      skipReason: "The second building only renamed one test.",
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      "comment **I am skipping a step.** I am going straight to delivering, " +
        "without checking the result. Reason: The second building only renamed one test.",
      "start scratch-app#12/1 (delivery)",
    ]);
    expect(record().filter((entry) => entry.kind === "departure")).toEqual([
      {
        kind: "departure",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        skipped: ["verification"],
        reason: "The second building only renamed one test.",
      },
    ]);
  });

  it("starts delivering with nothing to tell when the check ran after the second building", async () => {
    const chore = { ...featureTicket(), labels: ["timone", "triage:chore"] };
    const { actions, run, wrote, forge } = world(chore);
    for (const [stage, at] of [
      ["triage", "2026-09-29T10:00:00Z"],
      ["planning", "2026-09-29T10:10:00Z"],
      ["execution", "2026-09-29T10:20:00Z"],
      ["verification", "2026-09-29T10:50:00Z"],
      ["execution", "2026-09-29T11:00:00Z"],
      ["verification", "2026-09-29T11:20:00Z"],
    ] as const) {
      wrote({ kind: "step-started", at, runId: run.id, stage, sessionId: `s-${stage}-${at}` });
    }

    const result = await actions.startStep({
      stage: "delivery",
      instructions: "Open the pull request.",
      reason: "The fix is built and checked.",
    });

    expect(result.ok).toBe(true);
    expect(forge.comments).toEqual([]);
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

  it("says on the ticket where the work stands when the limit is reached: what is done, and what comes next", async () => {
    const chore = { ...featureTicket(), labels: ["timone", "triage:chore"] };
    const { actions, run, wrote, forge } = world(chore);
    wrote(triageRan(run.id));
    wrote({
      kind: "step-ended",
      at: "2026-09-27T09:06:00Z",
      runId: run.id,
      stage: "triage",
      sessionId: "a7c0e2d4-triage",
      ok: true,
      costUsd: 160,
    });

    const result = await actions.startStep({
      stage: "planning",
      instructions: "Plan the rename.",
      reason: "The ticket is sorted as a chore.",
    });

    expect(result.ok).toBe(false);
    expect(forge.comments.map((comment) => comment.body)).toEqual([
      "**This ticket has reached its spending limit.** It has cost $160.00, and the limit is $150.00. " +
        "I will not start any more work on it for now.\n\n" +
        "Done so far: sorting the request. Next, in the usual order: preparing the work.\n\n" +
        "You can answer here in writing, or in your terminal by running `timone takeover scratch-app#12`.\n\n" +
        '**What I need from you:** reply "continue" to allow another $150.00, or say nothing and it stays stopped.',
    ]);
  });

  // PRD-09 R1: the limit notice asks a question, so it names the command
  // that answers it in a terminal, with this run's ticket number. Its last
  // line is the one it always had.
  it("names the takeover command for the run's ticket in the limit notice, and keeps its last line", async () => {
    const { actions, run, wrote, forge } = world();
    wrote({
      kind: "step-ended",
      at: "2026-09-27T11:00:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "b41e-requirements",
      ok: true,
      costUsd: 150.4,
    });

    await actions.startStep({ stage: "triage", instructions: "Sort this request.", reason: "A new ticket." });

    const [notice] = forge.comments.map((comment) => comment.body);
    expect(notice).toContain(
      "\n\nYou can answer here in writing, or in your terminal by running `timone takeover scratch-app#12`.\n\n",
    );
    expect(notice?.match(/`timone takeover scratch-app#12`/g)).toHaveLength(1);
    expect(notice?.split("\n").at(-1)).toBe(
      '**What I need from you:** reply "continue" to allow another $150.00, or say nothing and it stays stopped.',
    );
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
      // @ts-expect-error — `tryMergeChunkZero` requires the approval that allows it (R3).
      tryMergeChunkZero(deps, run, project);
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

/**
 * The runner's actions on run `scratch-app#12/1`, whose ticket is a piece of
 * the map #10, and whose pull request #31 was merged. The map's other piece,
 * #11, was built first by a run of its own, whose pull request #29 was
 * merged; `otherPiece` says whether its ticket is closed or still open. The
 * forge lists the map's pieces with the state each ticket has now, so a
 * ticket closed by the actions reads as closed.
 */
function pieceOfAMap(otherPiece: "closed" | "open") {
  const root = mkdtempSync(join(tmpdir(), "timone-actions-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"));
  const { run: earlier } = store.register(PROJECT.name, 11);
  store.activate(earlier.id, "step-session-11");
  store.recordPullRequest(earlier.id, 29);
  store.complete(earlier.id);
  const { run: registered } = store.register(PROJECT.name, 12);
  const run = store.activate(registered.id, "runner-session-1");
  store.claimBranch(run.id, BRANCH);
  store.recordPullRequest(run.id, 31);
  store.rememberInitiative({
    project: PROJECT.name,
    initiative: 10,
    title: "Due dates on tasks",
    steps: [11, 12],
    done: otherPiece === "closed" ? 1 : 0,
  });
  const calls: string[] = [];
  const { adapter, state } = fakeForge(featureTicket(), calls);
  state.ahead = 3;
  state.pullRequest = {
    number: 31,
    title: "A due date on each task",
    url: "https://github.com/fvermaut/scratch-app/pull/31",
    state: "merged",
    headSha: "9e1d0b7",
  };
  const closedBefore = otherPiece === "closed" ? [11] : [];
  const listSteps: TicketingAdapter["listSteps"] = async () =>
    [11, 12].map((number) => ({
      number,
      title: `Piece #${number}`,
      state:
        closedBefore.includes(number) || state.closed.some((closed) => closed.number === number)
          ? ("closed" as const)
          : ("open" as const),
      labels: [],
      assignees: [],
      blockedBy: [],
      dependenciesIncomplete: false,
    }));
  const actions = runnerActions(
    {
      store,
      adapter: { ...adapter, listSteps },
      manifest: MANIFEST,
      root,
      timonePin: async () => undefined,
      project: PROJECT,
      ticketContext: { isStep: true, isRemediation: false },
      startStep: async () => {
        throw new Error("no test here starts a step");
      },
      running: new RunningSteps(),
      stepEnded: async () => {},
      clock: () => "2026-09-27T12:00:00.000Z",
      log: () => {},
    },
    run,
  );
  return { store, run, forge: state, calls, actions };
}

describe("the end of a run on a piece of a map", () => {
  it("closes the map with the comment that says what was built, once its last open piece ends after its merge", async () => {
    const { actions, store, run, forge, calls } = pieceOfAMap("closed");

    const result = await actions.endRun({
      reason: "fvermaut merged pull request #31.",
      closeTicket: true,
    });

    expect(result.ok).toBe(true);
    expect(store.get(run.id)?.status).toBe("done");
    expect(forge.closed).toEqual([
      { number: 12, reason: "completed" },
      { number: 10, reason: "completed" },
    ]);
    expect(forge.comments).toEqual([
      {
        number: 10,
        body: [
          "**Done — this ticket is finished.**",
          "",
          "All 2 pieces were built.",
          "The work went in with pull requests #29 and #31.",
          "",
          "**What I need from you:** nothing — file a new ticket for anything else.",
        ].join("\n"),
      },
    ]);
    expect(calls).toEqual(["close 12", "comment **Done — this ticket is finished.**", "close 10"]);
  });

  it("leaves the map open, with nothing posted on it, when another of its pieces is still open", async () => {
    const { actions, store, run, forge } = pieceOfAMap("open");

    const result = await actions.endRun({
      reason: "fvermaut merged pull request #31.",
      closeTicket: true,
    });

    expect(result.ok).toBe(true);
    expect(store.get(run.id)?.status).toBe("done");
    expect(forge.closed).toEqual([{ number: 12, reason: "completed" }]);
    expect(forge.comments).toEqual([]);
  });
});

/**
 * fvermaut's comment on ticket 12, asking the machine to stop for good, as
 * the operator did on #115: the work was finished by hand. Machine-typed,
 * not copied from #115.
 */
const STOP_ASKED = "Fixed by hand in pull request #55, which is merged. Leave this one on hold.";

describe("the end of a run that a named person asked to stop", () => {
  it("ends a run whose branch holds commits and no pull request when it names a named person's comment, and cancels it with a reason naming that comment", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("fvermaut", "2026-09-27T11:58:40Z", STOP_ASKED)]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 1;
    forge.pullRequest = undefined;

    const result = await actions.endRun({
      reason: "fvermaut finished the work by hand, and asked me to stop.",
      closeTicket: false,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({
      ok: true,
      said: "The run is ended without a pull request, as fvermaut asked in the comment at 2026-09-27T11:58:40Z.",
    });
    const ended = store.get(run.id);
    expect(ended?.status).toBe("cancelled");
    expect(ended?.cancellation).toContain("fvermaut");
    expect(ended?.cancellation).toContain("2026-09-27T11:58:40Z");
    expect(forge.closed).toEqual([]);
  });

  it("closes the ticket too, when asked, after a named person asked to stop", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("fvermaut", "2026-09-27T11:58:40Z", "I did this myself in #55. Stop, and close this one.")]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 1;
    forge.pullRequest = undefined;

    const result = await actions.endRun({
      reason: "fvermaut did the work and asked me to stop and close the ticket.",
      closeTicket: true,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({
      ok: true,
      said:
        "The run is ended without a pull request, as fvermaut asked in the comment at 2026-09-27T11:58:40Z, " +
        "and ticket #12 is closed.",
    });
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(forge.closed).toEqual([{ number: 12, reason: "completed" }]);
  });

  it("refuses to end it when the comment at that time is the machine's, though posted under a named person's login, and leaves the run as it was", async () => {
    const machineSaid: TicketComment = {
      author: "fvermaut",
      body: "**I put this ticket on hold.** I will not start any more work on it.\n\n**What I need from you:** nothing.",
      createdAt: "2026-09-27T11:58:40Z",
      fromTimone: true,
    };
    const { actions, store, run, forge } = world(featureTicket([machineSaid]));
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 1;
    forge.pullRequest = undefined;
    const before = store.get(run.id);

    const result = await actions.endRun({
      reason: "The ticket says the work is on hold.",
      closeTicket: false,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result.ok).toBe(false);
    expect(store.get(run.id)).toEqual(before);
    expect(store.get(run.id)?.status).toBe("active");
    expect(forge.closed).toEqual([]);
  });

  it("refuses to end it when the comment at that time is by someone who is not named, and leaves the run as it was", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("passer-by-99", "2026-09-27T11:58:40Z", "Stop this, I did it myself.")]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 1;
    forge.pullRequest = undefined;
    const before = store.get(run.id);

    const result = await actions.endRun({
      reason: "passer-by-99 said the work was done by hand.",
      closeTicket: true,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("passer-by-99, who is not named") });
    expect(store.get(run.id)).toEqual(before);
    expect(forge.closed).toEqual([]);
  });

  it("refuses as before when it names no comment, though a named person asked on the ticket to stop, and leaves the run as it was", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("fvermaut", "2026-09-27T11:58:40Z", STOP_ASKED)]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 1;
    forge.pullRequest = undefined;
    const before = store.get(run.id);

    const result = await actions.endRun({
      reason: "fvermaut finished the work by hand.",
      closeTicket: false,
    });

    expect(result).toEqual({
      ok: false,
      refused: expect.stringContaining(`This run changed files on ${BRANCH}, and they have no pull request yet.`),
    });
    expect(store.get(run.id)).toEqual(before);
    expect(forge.closed).toEqual([]);
  });

  it("still refuses to end it while its pull request is open, though it names a named person's comment, and leaves the run as it was", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("fvermaut", "2026-09-27T11:58:40Z", STOP_ASKED)]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 1;
    forge.pullRequest = {
      number: 31,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/31",
      state: "open",
      headSha: "9e1d0b7",
    };
    const before = store.get(run.id);

    const result = await actions.endRun({
      reason: "fvermaut finished the work by hand, and asked me to stop.",
      closeTicket: false,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("Pull request #31 is open") });
    expect(store.get(run.id)).toEqual(before);
    expect(forge.closed).toEqual([]);
  });
});

/** Pull request #31 for ticket 12's branch, closed by a person without merging. */
const CLOSED_UNMERGED: PullRequest = {
  number: 31,
  title: "A due date on each task",
  url: "https://github.com/fvermaut/scratch-app/pull/31",
  state: "closed",
  headSha: "9e1d0b7",
};

describe("the end of a run whose pull request was closed without merging (40w)", () => {
  it("ends it when it names a named person's comment asking to stop, and cancels it with a reason naming that comment", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("fvermaut", "2026-09-27T11:58:40Z", "I closed #31. We do not want due dates after all. Stop this one.")]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = CLOSED_UNMERGED;

    const result = await actions.endRun({
      reason: "fvermaut closed the pull request and asked me to stop.",
      closeTicket: false,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({
      ok: true,
      said: "The run is ended without a merged pull request, as fvermaut asked in the comment at 2026-09-27T11:58:40Z.",
    });
    const ended = store.get(run.id);
    expect(ended?.status).toBe("cancelled");
    expect(ended?.cancellation).toBe("fvermaut asked to stop the work, in the comment at 2026-09-27T11:58:40Z");
    expect(forge.closed).toEqual([]);
  });

  it("refuses to end it when the comment at that time is by someone who is not named, and leaves the run as it was", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("passer-by-99", "2026-09-27T11:58:40Z", "The pull request is closed, so stop this.")]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = CLOSED_UNMERGED;
    const before = store.get(run.id);

    const result = await actions.endRun({
      reason: "passer-by-99 asked to stop after the pull request was closed.",
      closeTicket: true,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({ ok: false, refused: expect.stringContaining("passer-by-99, who is not named") });
    expect(store.get(run.id)).toEqual(before);
    expect(forge.closed).toEqual([]);
  });

  it("still ends a run whose pull request was merged while its branch is ahead, as done, without reading the comment it names", async () => {
    const { actions, store, run, forge } = world(
      featureTicket([personSaid("passer-by-99", "2026-09-27T11:58:40Z", "Merged, so stop this.")]),
    );
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 3;
    forge.pullRequest = { ...CLOSED_UNMERGED, state: "merged" };

    const result = await actions.endRun({
      reason: "fvermaut merged the pull request.",
      closeTicket: true,
      stopCommentAt: "2026-09-27T11:58:40Z",
    });

    expect(result).toEqual({ ok: true, said: "The run is ended, and ticket #12 is closed." });
    expect(store.get(run.id)?.status).toBe("done");
    expect(forge.closed).toEqual([{ number: 12, reason: "completed" }]);
  });

  it("ends it, as done, when its branch holds nothing the default branch lacks", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 0;
    forge.pullRequest = CLOSED_UNMERGED;

    const result = await actions.endRun({
      reason: "fvermaut closed the pull request; the same change reached the default branch another way.",
      closeTicket: true,
    });

    expect(result).toEqual({ ok: true, said: "The run is ended, and ticket #12 is closed." });
    expect(store.get(run.id)?.status).toBe("done");
    expect(forge.closed).toEqual([{ number: 12, reason: "completed" }]);
  });

  it("does not tell the runner, while the pull request is open, that its close would end the run", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = { ...CLOSED_UNMERGED, state: "open" };

    const result = await actions.endRun({
      reason: "The pull request is delivered.",
      closeTicket: false,
    });

    expect(result).toEqual({
      ok: false,
      refused: "Pull request #31 is open. The run waits on it: answer its review, and end the run when it is merged.",
    });
  });

  it("does not tell the runner, before there is a pull request, that its close would end the run", async () => {
    const { actions, store, run, forge } = world();
    store.claimBranch(run.id, BRANCH);
    forge.ahead = 2;
    forge.pullRequest = undefined;

    const result = await actions.endRun({
      reason: "The work is built.",
      closeTicket: false,
    });

    expect(result).toEqual({
      ok: false,
      refused:
        `This run changed files on ${BRANCH}, and they have no pull request yet. ` +
        "The run waits on one, and ends when it is merged.",
    });
  });
});

describe("the session that writes an approval into its file (40v)", () => {
  it("is written down as recording that approval, so it is not read as its step running again", async () => {
    const { actions, store, run, record, wrote } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote(breakdownEnded(run.id));

    await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the list of pieces.",
    });

    expect(record().filter((entry) => entry.kind === "step-started")).toEqual([
      expect.objectContaining({ stage: "breakdown", records: "pieces" }),
    ]);
  });
});

/**
 * The branch a step's pushes may reach (#85, 43a). The guard that holds a
 * session to it is installed by the runtime; these say the runtime is told
 * which branch that is, by both of the starts here.
 */
describe("the work branch a step's session is given", () => {
  it("is the run's branch, for a step that owns one, with no pinned Timone version", async () => {
    // `world` answers no Timone version, so the request carries no workspace.
    // The branch must not depend on one.
    const chore = { ...featureTicket(), labels: ["timone", "triage:chore"] };
    const { actions, run, wrote, steps } = world(chore);
    wrote(triageRan(run.id));

    await actions.startStep({
      stage: "planning",
      instructions: "Plan the rename.",
      reason: "The ticket is sorted as a chore.",
    });

    expect(steps[0]?.input.request.workspace).toBeUndefined();
    expect(steps[0]?.input.request.workBranch).toBe(BRANCH);
  });

  it("is absent for a step that owns no branch", async () => {
    const { actions, steps } = world();

    await actions.startStep({ stage: "triage", instructions: "Sort this request.", reason: "A new ticket." });

    expect(steps[0]?.input.request).not.toHaveProperty("workBranch");
  });

  it("is the run's branch for the session that writes an approval into its file", async () => {
    const { actions, store, run, steps, wrote } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote(breakdownEnded(run.id));

    await actions.recordApproval({
      what: "pieces",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the list of pieces.",
    });

    expect(steps[0]?.input.request.workspace).toBeUndefined();
    expect(steps[0]?.input.request.workBranch).toBe(BRANCH);
  });
});

/**
 * The step a session runs, given to its box (PRD-10.R1, #87, 57a). A box's
 * own ledger is empty, so the checks inside it learn the step from the
 * request alone. It is spelled as the run's ledger records it.
 */
describe("the step a step's session is given", () => {
  it("is verification, for a check started at verification, as the ledger then says", async () => {
    const { actions, store, run, wrote, steps } = world(choreTicket());
    wrote(triageRan(run.id));

    await actions.startStep({
      stage: "verification",
      instructions: "Check that the column is renamed everywhere.",
      reason: "The work is built.",
      skipReason: "The ticket already says what to check.",
    });

    expect(steps[0]?.input.request.stage).toBe("verification");
    expect(store.get(run.id)?.stage).toBe("verification");
  });

  it("is execution, for a build started at execution, as the ledger then says", async () => {
    const { actions, store, run, wrote, steps } = world(choreTicket());
    wrote(triageRan(run.id));
    store.decidePlanner(run.id, {
      kind: "build",
      at: "2026-09-27T11:00:00Z",
      reason: "Nothing else on the project is being built.",
    });

    await actions.startStep({
      stage: "execution",
      instructions: "Rename the column in the task list.",
      reason: "The change is one line.",
      skipReason: "Renaming one column needs no plan.",
    });

    expect(steps[0]?.input.request.stage).toBe("execution");
    expect(store.get(run.id)?.stage).toBe("execution");
  });

  it("is requirements, for the session that writes an approval of the requirements into their file", async () => {
    const { actions, store, run, wrote, steps } = world(featureTicket(APPROVAL_THREAD));
    store.claimBranch(run.id, BRANCH);
    wrote({
      kind: "step-ended",
      at: "2026-09-27T11:58:00Z",
      runId: run.id,
      stage: "requirements",
      sessionId: "c9d2-requirements",
      ok: true,
      costUsd: 2.4,
    });

    await actions.recordApproval({
      what: "requirements",
      commentAt: "2026-09-27T11:58:40Z",
      reason: "fvermaut approved the requirements.",
    });

    expect(steps[0]?.input.request.stage).toBe("requirements");
  });
});

/** What the runner is told when every place on scratch-app is taken, held as `holder` says. */
function noPlace(holder: string): string {
  return (
    `No place is free on scratch-app: ${holder}. This ticket now waits for its turn, ` +
    "and you are woken when a place is given to it."
  );
}

/** Ticket 12, sorted as a chore, so planning — a step that owns a branch — comes next. */
function choreTicket(labels: string[] = []): TicketThread {
  return { ...featureTicket(), labels: ["timone", "triage:chore", ...labels] };
}

/**
 * The runner's actions on run `scratch-app#12/1`, parked on the runner's
 * wait as a wake finds it, with the triage step in its record. `setup`
 * arranges the project's other runs before the actions are built.
 *
 * The step starter does to the ledger what `startStepSession` does: it
 * claims the parked run, then marks it active once the session has started.
 * So the ledger refuses a step for want of a place as it does in the daemon.
 * `beforeClaim` runs between the action's ask and the claim, for a place
 * taken in between.
 *
 * ✏ 2026-10-05: the project has one place, as every project did when these
 * cases were written (ADR-0063 D1). A project now has two unless
 * `timone.yaml` sets another number (PRD-07.R2).
 */
function placeWorld(
  ticket: TicketThread,
  setup: (store: RunStore) => void,
  beforeClaim: (store: RunStore) => void = () => {},
) {
  const root = mkdtempSync(join(tmpdir(), "timone-actions-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"), { placesOf: () => 1 });
  const { run: registered } = store.register(PROJECT.name, 12);
  const run = store.park(registered.id, {
    waitingOn: "the next thing that happens on this ticket",
    kind: "runner",
    resolvableBy: ["triage"],
  });
  setup(store);
  appendEntry(root, PROJECT.name, 12, triageRan(run.id));
  const calls: string[] = [];
  const { adapter, state } = fakeForge(ticket, calls);
  const fake = fakeStarter(calls);
  const startStep = async (input: StepSessionInput): Promise<StepSession> => {
    beforeClaim(store);
    if (store.get(input.runId)?.status === "parked") store.claim(input.runId);
    const session = await fake.startStep(input);
    store.activate(input.runId, session.sessionId);
    return session;
  };
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
      stepEnded: async () => {},
      clock: () => "2026-09-27T12:00:00.000Z",
      log: () => {},
    },
    run,
  );
  return {
    store,
    run,
    actions,
    forge: state,
    steps: fake.steps,
    wrote: (entry: RecordEntry) => appendEntry(root, PROJECT.name, 12, entry),
    /** The run's record, as the machine wrote it. */
    record: (): RecordEntry[] => {
      const read = readRecord(root, PROJECT.name, 12);
      if (!read.ok) throw new Error(read.error.message);
      return read.value;
    },
  };
}

/** Run `ticket` of scratch-app, picked up, with a step of it running. */
function stepRunning(store: RunStore, ticket: number): Run {
  const { run } = store.register(PROJECT.name, ticket);
  return store.activate(run.id, `session-of-${ticket}`);
}

/** The try to start planning on ticket 12. */
const PLANNING = {
  stage: "planning" as const,
  instructions: "Plan the rename.",
  reason: "The ticket is sorted as a chore.",
};

describe("a step asks for a place on the project (ADR-0063 D2)", () => {
  it("refuses a step while another ticket's step runs, naming that run, and writes that the run waits", async () => {
    const { actions, store, run, steps, forge } = placeWorld(choreTicket(), (store) => {
      stepRunning(store, 7);
    });

    const result = await actions.startStep(PLANNING);

    expect(result).toEqual({ ok: false, refused: noPlace("run scratch-app#7/1 has a step running") });
    expect(steps).toEqual([]);
    expect(store.get(run.id)?.branch).toBeUndefined();
    expect(forge.comments).toEqual([]);
    const waiting = store.waitingForPlace(PROJECT.name);
    expect(waiting.map((each) => each.id)).toEqual([run.id]);
    expect(waiting[0]?.place).toMatchObject({ priority: false, openedAt: "2026-09-27T09:00:00Z" });
  });

  it("starts a step while another ticket's run waits on its open pull request, with no step running (R1)", async () => {
    const { actions, store, run, steps } = placeWorld(choreTicket(), (store) => {
      const other = stepRunning(store, 7);
      store.claimBranch(other.id, "timone/7-export-to-csv");
      store.recordPullRequest(other.id, 31);
      store.park(other.id, {
        waitingOn: "pull request #31",
        kind: "runner",
        resolvableBy: ["delivery"],
      });
    });

    const result = await actions.startStep(PLANNING);

    expect(result.ok).toBe(true);
    expect(steps.map((step) => step.input.label)).toEqual(["scratch-app#12/1 (planning)"]);
    expect(store.get(run.id)?.branch).toBe(BRANCH);
    expect(store.placeHolders(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });

  it("starts a step when the place is given to this run, and the run no longer waits (R3 clause 3)", async () => {
    const { actions, store, run, steps } = placeWorld(choreTicket(), (store) => {
      const other = stepRunning(store, 7);
      store.askPlace("scratch-app#12/1", { priority: false, openedAt: "2026-09-27T09:00:00Z" });
      store.park(other.id, { waitingOn: "fvermaut's answer", resolvableBy: ["planning"] });
    });
    expect(store.get(run.id)?.place?.givenAt).toBeDefined();

    const result = await actions.startStep(PLANNING);

    expect(result.ok).toBe(true);
    expect(steps).toHaveLength(1);
    expect(store.waitingForPlace(PROJECT.name)).toEqual([]);
    expect(store.get(run.id)?.place?.givenAt).toBeUndefined();
    expect(store.placeHolders(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });

  it("refuses a step while the place is given to another run, naming that run", async () => {
    const { actions, store, run, steps } = placeWorld(choreTicket(), (store) => {
      const running = stepRunning(store, 8);
      const { run: given } = store.register(PROJECT.name, 7);
      store.askPlace(given.id, { priority: false, openedAt: "2026-09-20T09:00:00Z" });
      store.park(running.id, { waitingOn: "fvermaut's answer", resolvableBy: ["planning"] });
    });

    const result = await actions.startStep(PLANNING);

    expect(result).toEqual({ ok: false, refused: noPlace("the place is given to run scratch-app#7/1") });
    expect(steps).toEqual([]);
    expect(store.get(run.id)?.branch).toBeUndefined();
    expect(store.waitingForPlace(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });

  it("writes the order of a ticket labelled priority:high as first, when its step is refused", async () => {
    const { actions, store, run } = placeWorld(choreTicket(["priority:high"]), (store) => {
      stepRunning(store, 7);
    });

    await actions.startStep(PLANNING);

    expect(store.get(run.id)?.place).toMatchObject({
      priority: true,
      openedAt: "2026-09-27T09:00:00Z",
    });
  });

  it("refuses a step whose place was taken between the ask and the start, in the same words, and writes that the run waits", async () => {
    const { actions, store, run, steps } = placeWorld(
      choreTicket(),
      () => {},
      (store) => {
        if (store.get("scratch-app#7/1") === undefined) stepRunning(store, 7);
      },
    );
    store.setStage(run.id, "triage");

    const result = await actions.startStep(PLANNING);

    expect(result).toEqual({ ok: false, refused: noPlace("run scratch-app#7/1 has a step running") });
    expect(steps).toEqual([]);
    expect(store.get(run.id)?.stage).toBe("triage");
    expect(store.get(run.id)?.status).toBe("parked");
    expect(store.waitingForPlace(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });
});

/** The record's entry for the planning step of run `runId`, starting at 09:10. */
function planningStarted(runId: string): RecordEntry {
  return {
    kind: "step-started",
    at: "2026-09-27T09:10:00Z",
    runId,
    stage: "planning",
    sessionId: "b2d4f6a8-planning",
  };
}

/** The record's entry for the planning step of run `runId`, ending well at 09:30. */
function planningEnded(runId: string): RecordEntry {
  return {
    kind: "step-ended",
    at: "2026-09-27T09:30:00Z",
    runId,
    stage: "planning",
    sessionId: "b2d4f6a8-planning",
    ok: true,
    costUsd: 0.9,
  };
}

/** The try to start building ticket 12, its plan written. */
const BUILDING = {
  stage: "execution" as const,
  instructions: "Build the rename the plan describes.",
  reason: "The plan is written.",
};

/** The refusal of a build the planner has not decided on yet (ADR-0065 D2). */
const PLANNER_NOT_DECIDED =
  "The planner has not decided yet whether this ticket may be built now: it looks at what else " +
  "on scratch-app is being built. This ticket now waits for its decision, and you are woken when " +
  "it has decided.";

describe("the build waits for the planner's decision (PRD-07.R5, ADR-0065 D2)", () => {
  it("refuses the build of a run with a committed plan and no decision, takes no place, and writes that it waits for the planner (clause 1)", async () => {
    const { actions, store, run, steps, wrote } = placeWorld(choreTicket(), (store) => {
      stepRunning(store, 7);
    });
    wrote(planningStarted(run.id));
    wrote(planningEnded(run.id));

    const result = await actions.startStep(BUILDING);

    expect(result).toEqual({ ok: false, refused: PLANNER_NOT_DECIDED });
    expect(steps).toEqual([]);
    expect(store.placeHolders(PROJECT.name).map((each) => each.id)).toEqual(["scratch-app#7/1"]);
    expect(store.waitingForPlace(PROJECT.name)).toEqual([]);
    expect(store.get(run.id)?.branch).toBeUndefined();
    expect(store.waitingForPlanner(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });

  it("refuses the build of a run the planner holds, naming the ticket it waits for, and starts nothing", async () => {
    const { actions, store, run, steps, wrote } = placeWorld(choreTicket(), () => {});
    wrote(planningStarted(run.id));
    wrote(planningEnded(run.id));
    store.askPlanner(run.id, { priority: false, openedAt: "2026-09-27T09:00:00Z" });
    store.decidePlanner(run.id, {
      kind: "hold",
      at: "2026-09-27T11:00:00Z",
      reason: "Both tickets change the task list.",
      waitsFor: [7],
    });

    const result = await actions.startStep(BUILDING);

    expect(result).toEqual({
      ok: false,
      refused:
        "The planner holds this ticket until #7 is merged or closed: Both tickets change the task list. " +
        "You are woken if that changes.",
    });
    expect(steps).toEqual([]);
    expect(store.placeHolders(PROJECT.name)).toEqual([]);
    expect(store.waitingForPlace(PROJECT.name)).toEqual([]);
    expect(store.heldByPlanner(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });

  it("starts the build of a run the planner let build, taking a place as any step does", async () => {
    const { actions, store, run, steps, wrote } = placeWorld(choreTicket(), () => {});
    wrote(planningStarted(run.id));
    wrote(planningEnded(run.id));
    store.askPlanner(run.id, { priority: false, openedAt: "2026-09-27T09:00:00Z" });
    store.decidePlanner(run.id, {
      kind: "build",
      at: "2026-09-27T11:00:00Z",
      reason: "Nothing else on the project is being built.",
    });

    const result = await actions.startStep(BUILDING);

    expect(result.ok).toBe(true);
    expect(steps.map((step) => step.input.label)).toEqual(["scratch-app#12/1 (execution)"]);
    expect(store.placeHolders(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
    expect(store.waitingForPlanner(PROJECT.name)).toEqual([]);
  });

  it("refuses the build of a run the planner let build for want of a place, as before", async () => {
    const { actions, store, run, steps, wrote } = placeWorld(choreTicket(), (store) => {
      stepRunning(store, 7);
    });
    wrote(planningStarted(run.id));
    wrote(planningEnded(run.id));
    store.decidePlanner(run.id, {
      kind: "build",
      at: "2026-09-27T11:00:00Z",
      reason: "The two tickets change different files.",
    });

    const result = await actions.startStep(BUILDING);

    expect(result).toEqual({ ok: false, refused: noPlace("run scratch-app#7/1 has a step running") });
    expect(steps).toEqual([]);
    expect(store.waitingForPlace(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });

  it("does not ask the planner before planning, checking, delivering or a remediation", async () => {
    for (const stage of ["planning", "verification", "delivery", "remediation"] as const) {
      const { actions, store, steps } = placeWorld(choreTicket(), () => {});

      const result = await actions.startStep({
        stage,
        instructions: "Do this step.",
        reason: "It is next.",
        skipReason: "The ticket already says what to do.",
      });

      expect(result, stage).toMatchObject({ ok: true });
      expect(steps, stage).toHaveLength(1);
      expect(store.waitingForPlanner(PROJECT.name), stage).toEqual([]);
    }
  });
});

/** The try to bring ticket 12's open pull request level with the default branch. */
const UPDATING = {
  stage: "update" as const,
  instructions: "Bring the branch level with main, which moved 3 commits ahead.",
  reason: "The default branch moved on while the pull request is open.",
};

/** The run's own branch in the update cases: not the name `workBranch` would give. */
const OWN_BRANCH = "timone/12-due-dates-kept-from-before";

describe("the update of an open pull request (ADR-0066 D2)", () => {
  it("starts on the run's own branch, taking a place, with no planner decision asked", async () => {
    const { actions, store, run, steps } = placeWorld(choreTicket(), () => {});
    store.claimBranch(run.id, OWN_BRANCH);
    store.recordPullRequest(run.id, 31);

    const result = await actions.startStep(UPDATING);

    expect(result).toMatchObject({ ok: true });
    expect(steps.map((step) => step.input.label)).toEqual(["scratch-app#12/1 (update)"]);
    expect(steps[0]?.input.request.workBranch).toBe(OWN_BRANCH);
    expect(store.placeHolders(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
    expect(store.waitingForPlanner(PROJECT.name)).toEqual([]);
  });

  it("is refused for want of a place when every place is taken, as any step is", async () => {
    const { actions, store, run, steps } = placeWorld(choreTicket(), (store) => {
      stepRunning(store, 7);
    });
    store.claimBranch(run.id, OWN_BRANCH);
    store.recordPullRequest(run.id, 31);

    const result = await actions.startStep(UPDATING);

    expect(result).toEqual({ ok: false, refused: noPlace("run scratch-app#7/1 has a step running") });
    expect(steps).toEqual([]);
    expect(store.waitingForPlace(PROJECT.name).map((each) => each.id)).toEqual([run.id]);
  });
});

/** The refusal of a step while a person's terminal holds the run (ADR-0067 D4). */
const TERMINAL_HOLDS =
  "A person has this ticket open in a terminal. Start nothing until the terminal session ends; " +
  "you are woken then.";

/** A person's terminal, as `timone takeover` writes it on the run it claims. */
const TERMINAL: Holder = {
  token: "token-terminal-4213",
  command: "timone takeover scratch-app#12",
  pid: process.pid,
  since: "2026-09-27T11:59:00.000Z",
  observedAt: "2026-09-27T11:59:00.000Z",
};

describe("the runner starts no step on a run a person's terminal holds (ADR-0067 D4)", () => {
  it("refuses a step on a run claimed for a terminal after the wake began, and changes nothing but the record", async () => {
    const { actions, store, run, steps, forge, record } = placeWorld(choreTicket(), () => {});
    store.claim(run.id, TERMINAL, { takeover: true });
    const before = store.get(run.id);

    const result = await actions.startStep(PLANNING);

    expect(result).toEqual({ ok: false, refused: TERMINAL_HOLDS });
    expect(steps).toEqual([]);
    const after = store.get(run.id);
    expect(after?.status).toBe("active");
    expect(after?.takenOver).toBe(true);
    expect(after?.stage).toBe(before?.stage);
    expect(after?.place).toEqual(before?.place);
    expect(after?.branch).toBeUndefined();
    expect(forge.comments).toEqual([]);
    expect(record()).toEqual([
      triageRan(run.id),
      {
        kind: "decision",
        at: "2026-09-27T12:00:00.000Z",
        runId: run.id,
        action: "start_step",
        reason: PLANNING.reason,
        detail: `Refused: ${TERMINAL_HOLDS}`,
      },
    ]);
  });

  it("starts the step as before once the terminal session has ended and the run is parked again", async () => {
    const { actions, store, run, steps } = placeWorld(choreTicket(), () => {});
    store.claim(run.id, TERMINAL, { takeover: true });
    expect(await actions.startStep(PLANNING)).toEqual({ ok: false, refused: TERMINAL_HOLDS });
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });

    const result = await actions.startStep(PLANNING);

    expect(result).toMatchObject({ ok: true });
    expect(steps.map((step) => step.input.label)).toEqual(["scratch-app#12/1 (planning)"]);
    expect(store.get(run.id)?.status).toBe("active");
    expect(store.get(run.id)?.takenOver).toBeUndefined();
  });
});

describe("a question the runner posts names the takeover command (PRD-09)", () => {
  const SENTENCE =
    "You can answer here in writing, or in your terminal by running `timone takeover scratch-app#12`.";
  const QUESTION =
    "**The requirements are written:** [prd-02-due-dates.md](doc/specs/prd/prd-02-due-dates.md).\n\n" +
    '**What I need from you:** read them and reply "approved", or say what to change.';

  it("adds the sentence with the command for the run's ticket to a question on the ticket, and keeps its last line", async () => {
    const { actions, forge } = world();

    const result = await actions.post({
      where: "ticket",
      body: QUESTION,
      reason: "Ask fvermaut to approve the requirements.",
    });

    expect(result).toEqual({ ok: true, said: "Posted on ticket #12." });
    expect(forge.comments).toEqual([
      {
        number: 12,
        body:
          "**The requirements are written:** [prd-02-due-dates.md](doc/specs/prd/prd-02-due-dates.md).\n\n" +
          `${SENTENCE}\n\n` +
          '**What I need from you:** read them and reply "approved", or say what to change.',
      },
    ]);
  });

  it("names the run's ticket, not the pull request, in the command it adds to a question on the pull request", async () => {
    const { actions, forge, store, run } = world();
    store.claimBranch(run.id, BRANCH);
    forge.pullRequest = {
      number: 31,
      title: "A due date on each task",
      url: "https://github.com/fvermaut/scratch-app/pull/31",
      state: "open",
      headSha: "9e1d0b7",
    };

    const result = await actions.post({
      where: "pull-request",
      body: "**Should late tasks also show in bold?** The plan does not say.\n\n**What I need from you:** answer yes or no.",
      reason: "The check asked a question only fvermaut can answer.",
    });

    expect(result).toEqual({ ok: true, said: "Posted on pull request #31." });
    expect(forge.pullRequestComments).toEqual([
      {
        number: 31,
        body:
          "**Should late tasks also show in bold?** The plan does not say.\n\n" +
          `${SENTENCE}\n\n` +
          "**What I need from you:** answer yes or no.",
      },
    ]);
  });

  it.each(["missing-key", "approval-word", "terminal-did-not-settle-it"] as const)(
    "posts a question unchanged when the runner leaves the command out (%s)",
    async (leaveOutTakeover) => {
      const { actions, forge } = world();

      const result = await actions.post({
        where: "ticket",
        body: QUESTION,
        leaveOutTakeover,
        reason: "Ask fvermaut to approve the requirements.",
      });

      expect(result).toEqual({ ok: true, said: "Posted on ticket #12." });
      expect(forge.comments).toEqual([{ number: 12, body: QUESTION }]);
    },
  );

  it.each(["missing-key", "approval-word", "terminal-did-not-settle-it"] as const)(
    "refuses a question that names the command when the runner said to leave it out (%s), and posts nothing",
    async (leaveOutTakeover) => {
      const { actions, forge } = world();

      const result = await actions.post({
        where: "ticket",
        body:
          "**The build needs the Polygon key.** Or run `timone takeover scratch-app#12` in your terminal.\n\n" +
          "**What I need from you:** add the key.",
        leaveOutTakeover,
        reason: "The build needs a key only fvermaut can give.",
      });

      expect(result).toEqual({
        ok: false,
        refused: "This question leaves the takeover command out. Remove it, and post again.",
      });
      expect(forge.comments).toEqual([]);
    },
  );

  it("refuses a question that names the takeover command of another ticket, names the right one, and posts nothing", async () => {
    const { actions, forge } = world();

    const result = await actions.post({
      where: "ticket",
      body:
        "**The build needs the Polygon key.** You can also run `timone takeover other#9` in your terminal.\n\n" +
        "**What I need from you:** add the key.",
      reason: "The build needs a key only fvermaut can give.",
    });

    expect(result).toEqual({
      ok: false,
      refused:
        "The takeover command for this ticket is `timone takeover scratch-app#12`. Use that one, or leave it out.",
    });
    expect(forge.comments).toEqual([]);
  });

  it("refuses a question whose takeover command has a longer number that starts with the ticket's, and posts nothing", async () => {
    const { actions, forge } = world();

    const result = await actions.post({
      where: "ticket",
      body:
        "**The build needs the Polygon key.** You can also run `timone takeover scratch-app#123` in your terminal.\n\n" +
        "**What I need from you:** add the key.",
      reason: "The build needs a key only fvermaut can give.",
    });

    expect(result).toEqual({
      ok: false,
      refused:
        "The takeover command for this ticket is `timone takeover scratch-app#12`. Use that one, or leave it out.",
    });
    expect(forge.comments).toEqual([]);
  });

  it("posts a comment that asks for nothing unchanged", async () => {
    const { actions, forge } = world();
    const body = "**I am preparing the work now.** I will write here when the plan is ready.\n\n**What I need from you:** nothing.";

    const result = await actions.post({ where: "ticket", body, reason: "Tell fvermaut what happens next." });

    expect(result).toEqual({ ok: true, said: "Posted on ticket #12." });
    expect(forge.comments).toEqual([
      {
        number: 12,
        body: "**I am preparing the work now.** I will write here when the plan is ready.\n\n**What I need from you:** nothing.",
      },
    ]);
  });
});
