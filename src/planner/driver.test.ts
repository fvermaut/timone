import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PullRequestThread,
  TicketComment,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import { noBranches } from "../adapters/ticketing.stubs.js";
import type { Manifest } from "../manifest.js";
import { RunStore, type Run } from "../daemon/runs.js";
import { appendEntry, readRecord, type RecordEntry } from "../runner/record.js";
import type { PlannerFacts, PlannerFactsAdapter } from "./facts.js";
import { PlannerDriver, type PlannerDriverCycle } from "./driver.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const SCRATCH: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

const TODO: TicketingProject = {
  name: "todo-app",
  repoUrl: "https://github.com/fvermaut/todo-app.git",
};

/** scratch-app and todo-app, each instructed by the operator only. */
const MANIFEST: Manifest = {
  operator: "fvermaut",
  projects: {
    "scratch-app": {
      repo_url: SCRATCH.repoUrl,
      path: "projects/scratch-app",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
    },
    "todo-app": {
      repo_url: TODO.repoUrl,
      path: "projects/todo-app",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
    },
  },
};

/** A marked ticket, opened at `createdAt`, with `comments`. */
function thread(
  number: number,
  createdAt: string,
  comments: TicketComment[] = [],
  labels: string[] = ["timone", "triage:feature"],
): TicketThread {
  return {
    number,
    title: `Ticket ${number}`,
    body: "",
    labels,
    url: `https://github.com/fvermaut/scratch-app/issues/${number}`,
    author: "fvermaut",
    createdAt,
    comments,
  };
}

/** Every entry of scratch-app #`ticket`'s record, or the test fails. */
function recordOf(root: string, ticket: number): RecordEntry[] {
  const read = readRecord(root, "scratch-app", ticket);
  if (!read.ok) throw new Error(read.error.message);
  return read.value;
}

/** One decision the driver asked for: the run, the facts, and how to end its session. */
interface AskedDecision {
  runId: string;
  facts: PlannerFacts;
  end: () => void;
}

/**
 * A ledger, an in-memory forge, and a planner driver whose `decide` writes
 * down what it is asked and runs until the test ends it. Every ticket's
 * thread is read from `threads`, and every pull request's state from
 * `pulls`.
 */
function world() {
  const root = mkdtempSync(join(tmpdir(), "planner-driver-"));
  tempDirs.push(root);
  const clock = { now: "2026-10-05T10:00:00Z" };
  const path = join(root, ".timone", "state.json");
  const store = RunStore.open(path, { now: () => clock.now });
  const threads = new Map<string, TicketThread>();
  const pulls = new Map<number, PullRequestThread["state"]>();
  /** The files on each branch, by path. The default branch is `main`. */
  const branches = new Map<string, Map<string, string>>();
  const adapter: PlannerFactsAdapter = {
    ...noBranches,
    listFiles: async (_project, branch, directory) => {
      const files = branches.get(branch);
      if (files === undefined) return undefined;
      return [...files.keys()].filter((path) => path.startsWith(`${directory}/`));
    },
    readFile: async (_project, branch, path) => branches.get(branch)?.get(path),
    listPullRequestFiles: async () => [],
  };
  const asked: AskedDecision[] = [];
  const driverOver = (over: RunStore) =>
    new PlannerDriver({
      store: over,
      adapter,
      manifest: MANIFEST,
      root,
      decide: (run: Run, facts: PlannerFacts) =>
        new Promise<void>((resolve) => {
          asked.push({ runId: run.id, facts, end: resolve });
        }),
      clock: () => clock.now,
      log: () => {},
    });
  const driver = driverOver(store);
  const cycleOf = (project: TicketingProject): PlannerDriverCycle => ({
    isStep: () => false,
    blockedBy: () => [],
    threads: (ticket) => ({
      ticket: async () => {
        const found = threads.get(`${project.name}#${ticket}`);
        if (found === undefined) throw new Error(`no ticket ${ticket}`);
        return found;
      },
      pullRequest: async (pr) => ({
        number: pr,
        title: `Pull request ${pr}`,
        url: `https://github.com/fvermaut/${project.name}/pull/${pr}`,
        state: pulls.get(pr) ?? "open",
        headSha: "aaaaaaa",
        comments: [],
      }),
    }),
  });
  /** A run of `ticket` on `project`, its thread on the forge, waiting for the planner. */
  const waiting = (
    ticket: TicketThread,
    project: TicketingProject = SCRATCH,
    over: RunStore = store,
  ): Run => {
    threads.set(`${project.name}#${ticket.number}`, ticket);
    const { run } = over.register(project.name, ticket.number);
    return over.askPlanner(run.id, { priority: false, openedAt: ticket.createdAt });
  };
  const tick = async (project: TicketingProject = SCRATCH, by = driver): Promise<string[]> =>
    by.tick(project, MANIFEST.projects[project.name]!, cycleOf(project));
  return { root, clock, path, store, threads, pulls, branches, asked, driver, driverOver, waiting, tick };
}

/** The plan #12's branch added: it changes the task list. */
const PLAN_12 = "# Phase 50 — Due dates\n\n**[MODIFY]** `src/list.tsx`\n";

/**
 * #7's run, let build, with its pull request #21; and #12's run on its
 * branch with its plan, held by the planner until #7 is merged or closed.
 */
function heldBehindSeven() {
  const w = world();
  w.threads.set("scratch-app#7", thread(7, "2026-09-30T09:00:00Z"));
  const seven = w.store.register("scratch-app", 7).run;
  w.store.decidePlanner(seven.id, { kind: "build", at: "2026-10-01T09:00:00Z", reason: "Nothing else." });
  w.store.claimBranch(seven.id, "timone/7-sort-the-list");
  w.store.recordPullRequest(seven.id, 21);
  w.store.park(seven.id, {
    waitingOn: "fvermaut to review pull request #21",
    kind: "runner",
    resolvableBy: ["delivery"],
  });
  const held = w.waiting(thread(12, "2026-10-01T09:00:00Z"));
  w.store.claimBranch(held.id, "timone/12-due-dates");
  w.branches.set("main", new Map());
  w.branches.set("timone/12-due-dates", new Map([["doc/plans/phases/phase-50.md", PLAN_12]]));
  w.store.decidePlanner(held.id, {
    kind: "hold",
    at: "2026-10-05T09:30:00Z",
    reason: "It changes src/list.tsx, which #7 changes too.",
    waitsFor: [7],
  });
  return { ...w, seven, held };
}

describe("PlannerDriver — one session per project at a time (ADR-0065 D1)", () => {
  it("starts one session for the run first by order, none while it runs, and the other's once it has ended", async () => {
    const w = world();
    const later = w.waiting(thread(12, "2026-10-02T09:00:00Z"));
    const first = w.waiting(thread(13, "2026-10-01T09:00:00Z"));

    await w.tick();
    expect(w.asked.map((one) => one.runId)).toEqual([first.id]);

    await w.tick();
    expect(w.asked.map((one) => one.runId)).toEqual([first.id]);

    // The session lets #13 build, and ends.
    w.store.decidePlanner(first.id, { kind: "build", at: w.clock.now, reason: "Nothing else is built." });
    w.asked[0]!.end();
    await w.driver.drain();
    await w.tick();

    expect(w.asked.map((one) => one.runId)).toEqual([first.id, later.id]);
  });
});

describe("PlannerDriver — each project has its own planner (ADR-0065 D1)", () => {
  it("starts one session for each of two projects whose runs wait, both running at once", async () => {
    const w = world();
    const scratch = w.waiting(thread(12, "2026-10-01T09:00:00Z"));
    const todo = w.waiting(thread(4, "2026-10-01T09:00:00Z"), TODO);

    await w.tick(SCRATCH);
    await w.tick(TODO);

    expect(w.asked.map((one) => one.runId)).toEqual([scratch.id, todo.id]);
  });
});

describe("PlannerDriver — a held ticket is decided again when what it waits for is gone (PRD-07.R5, ADR-0065 D4)", () => {
  it("does not ask again while #7's pull request is open, and once it is merged and its run ended, decides #12 with its plan as it was", async () => {
    const w = heldBehindSeven();

    await w.tick();
    expect(w.asked).toEqual([]);
    expect(w.store.get(w.held.id)?.planner?.decision?.kind).toBe("hold");

    w.pulls.set(21, "merged");
    w.store.complete(w.seven.id);
    await w.tick();

    expect(w.asked.map((one) => one.runId)).toEqual([w.held.id]);
    expect(w.store.get(w.held.id)?.planner).toEqual({ askedAt: w.clock.now });
    expect(w.asked[0]?.facts.ticket.plan).toEqual({
      kind: "known",
      value: {
        path: "doc/plans/phases/phase-50.md",
        title: "Phase 50 — Due dates",
        files: ["src/list.tsx"],
        text: PLAN_12,
      },
    });
    expect(w.branches.get("timone/12-due-dates")).toEqual(
      new Map([["doc/plans/phases/phase-50.md", PLAN_12]]),
    );
  });

  it("asks again once #7's pull request is closed without merging, while its run still waits", async () => {
    const w = heldBehindSeven();
    await w.tick();
    expect(w.asked).toEqual([]);

    w.pulls.set(21, "closed");
    await w.tick();

    expect(w.asked.map((one) => one.runId)).toEqual([w.held.id]);
  });
});

describe("PlannerDriver — a named person's comment on a waiting ticket goes to the planner (PRD-07.R6, ADR-0065 D5)", () => {
  it("decides a held ticket on the next tick with the named person's comment in its facts, and notes that the planner read it", async () => {
    const w = heldBehindSeven();
    const comment: TicketComment = {
      author: "fvermaut",
      body: "Build this one now, #7 can wait.",
      createdAt: "2026-10-05T09:45:00Z",
      fromTimone: false,
    };
    w.threads.set("scratch-app#12", thread(12, "2026-10-01T09:00:00Z", [comment]));

    await w.tick();

    expect(w.asked.map((one) => one.runId)).toEqual([w.held.id]);
    expect(w.asked[0]?.facts.comment).toEqual(comment);
    expect(recordOf(w.root, 12)).toEqual([
      { kind: "notice", at: w.clock.now, about: "planner read comment at 2026-10-05T09:45:00Z" },
    ]);
  });

  it("starts no session and changes nothing when the comment is by someone who is not named for the project (clause 3)", async () => {
    const w = heldBehindSeven();
    const before = w.store.get(w.held.id);
    w.threads.set(
      "scratch-app#12",
      thread(12, "2026-10-01T09:00:00Z", [
        {
          author: "a-passer-by",
          body: "Build this one now, #7 can wait.",
          createdAt: "2026-10-05T09:45:00Z",
          fromTimone: false,
        },
      ]),
    );

    await w.tick();

    expect(w.asked).toEqual([]);
    expect(w.store.get(w.held.id)).toEqual(before);
    expect(recordOf(w.root, 12)).toEqual([]);
  });
});

describe("PlannerDriver — a ticket the planner does not decide now", () => {
  it("starts no session for a ticket a person holds with timone:held", async () => {
    const w = world();
    w.waiting(thread(12, "2026-10-01T09:00:00Z", [], ["timone", "triage:feature", "timone:held"]));

    await w.tick();

    expect(w.asked).toEqual([]);
  });

  it("starts no session for a ticket over its spending limit", async () => {
    const w = world();
    const run = w.waiting(thread(12, "2026-10-01T09:00:00Z"));
    // The runner's sessions on #12 have spent the project's whole limit, $150.
    appendEntry(w.root, "scratch-app", 12, {
      kind: "runner-ended",
      at: "2026-10-05T09:00:00Z",
      runId: run.id,
      ok: true,
      costUsd: 150,
    });

    await w.tick();

    expect(w.asked).toEqual([]);
  });
});

describe("PlannerDriver — after a daemon restart (ADR-0065 D1)", () => {
  it("starts a session on the first tick of a new driver over the same ledger, for a run whose session the stop lost", async () => {
    const w = world();
    const run = w.waiting(thread(12, "2026-10-01T09:00:00Z"));
    await w.tick();
    expect(w.asked.map((one) => one.runId)).toEqual([run.id]);

    // The daemon stops while the session runs, and starts again an hour later.
    w.clock.now = "2026-10-05T11:00:00Z";
    const store = RunStore.open(w.path, { now: () => w.clock.now });
    await w.tick(SCRATCH, w.driverOver(store));

    expect(w.asked.map((one) => one.runId)).toEqual([run.id, run.id]);
  });
});
