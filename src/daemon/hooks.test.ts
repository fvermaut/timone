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
import { RunStore } from "./runs.js";
import {
  checkAll,
  checkBranchPlacement,
  checkPathContainment,
  checkProvenance,
  checkStatusPlacement,
  checkUnpushed,
  disposeViolations,
  reportGuardrails,
  type RepoEvidence,
  type SessionEvidence,
  type Violation,
} from "./hooks.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-hooks-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-02T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

const project: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

/** A repo that did nothing: no commits, no changes, nothing unpushed. */
function quietRepo(repo: string): RepoEvidence {
  return {
    repo,
    defaultBranch: "main",
    branches: [],
    commits: [],
    workingTree: [],
  };
}

/** Evidence for a session that behaved. */
function cleanEvidence(): SessionEvidence {
  return {
    target: "scratch-app",
    workspace: quietRepo("timone"),
    projects: [
      {
        repo: "scratch-app",
        defaultBranch: "main",
        branches: [{ name: "phase/01", unpushed: [], hasUpstream: true }],
        commits: [
          {
            sha: "aaa1111",
            branch: "phase/01",
            files: ["src/features/todos/x.ts"],
        trailers: ["Timone-Stage: execution"],
          },
        ],
        workingTree: [],
      },
    ],
  };
}

/** The one project checkout in the fixture above. */
function projectRepo(evidence: SessionEvidence): RepoEvidence {
  return evidence.projects[0];
}

describe("checkUnpushed", () => {
  it("flags a branch carrying commits the remote never saw", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "phase/01", unpushed: ["aaa1111", "bbb2222"], hasUpstream: true },
    ];

    const violations = checkUnpushed(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("unpushed");
    expect(violations[0].detail.join(" ")).toMatch(/phase\/01/);
    expect(violations[0].detail.join(" ")).toMatch(/aaa1111/);
  });

  it("flags a branch that was never pushed at all", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "phase/01", unpushed: ["aaa1111"], hasUpstream: false },
    ];

    const violations = checkUnpushed(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].detail.join(" ")).toMatch(/no upstream|never pushed/i);
  });

  it("stays silent when everything is pushed", () => {
    expect(checkUnpushed(cleanEvidence())).toEqual([]);
  });
});

describe("checkStatusPlacement", () => {
  it("flags STATUS.md committed off the default branch", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      { sha: "ccc3333", branch: "phase/01", files: ["STATUS.md", "src/x.ts"], trailers: ["Timone-Stage: execution"] },
    ];

    const violations = checkStatusPlacement(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("status-placement");
    expect(violations[0].detail.join(" ")).toMatch(/ccc3333/);
    expect(violations[0].detail.join(" ")).toMatch(/phase\/01/);
  });

  it("flags it in the workspace repo too", () => {
    const evidence = cleanEvidence();
    evidence.workspace.commits = [
      { sha: "ddd4444", branch: "some-branch", files: ["STATUS.md"], trailers: ["Timone-Stage: execution"] },
    ];

    expect(checkStatusPlacement(evidence)).toHaveLength(1);
  });

  it("stays silent when STATUS.md is committed on the default branch", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      { sha: "ccc3333", branch: "main", files: ["STATUS.md"], trailers: ["Timone-Stage: execution"] },
    ];

    expect(checkStatusPlacement(evidence)).toEqual([]);
  });

  it("stays silent when no commit touches STATUS.md", () => {
    expect(checkStatusPlacement(cleanEvidence())).toEqual([]);
  });
});

/**
 * Finding 11 of phase 20's live gate, as a rule.
 *
 * A run's work branch is named from its ticket and its chunk (`workBranch`) —
 * never from the repository it belongs in — so nothing downstream could tell
 * that `timone/29-…` had been cut at the timone root rather than in the
 * project's checkout. It sat there for three hours and collected seven
 * artifacts.
 */
describe("checkBranchPlacement", () => {
  it("flags a run's work branch cut in the harness repo", () => {
    const evidence = cleanEvidence();
    evidence.workspace.branches = [
      {
        name: "timone/29-fixture-map-notes-on-a-to-do",
        unpushed: [],
        hasUpstream: false,
      },
    ];

    const violations = checkBranchPlacement(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("branch-placement");
    expect(violations[0].summary).toMatch(/timone\/29-fixture-map-notes/);
    expect(violations[0].detail.join(" ")).toMatch(/projects\/scratch-app/);
  });

  it("counts the work stranded on it, which is what makes it urgent", () => {
    const evidence = cleanEvidence();
    evidence.workspace.branches = [
      { name: "timone/29-fixture", unpushed: ["ddd4444"], hasUpstream: false },
    ];
    evidence.workspace.commits = [
      {
        sha: "ddd4444",
        branch: "timone/29-fixture",
        files: ["doc/adr/0026-a-ticket-is-a-conversation.md"],
        trailers: ["Timone-Stage: interactive"],
      },
    ];

    const violations = checkBranchPlacement(evidence);

    expect(violations[0].detail.join(" ")).toMatch(/ddd4444/);
  });

  it("says nothing about the same branch in the project it belongs to", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "timone/29-fixture", unpushed: [], hasUpstream: true },
    ];

    expect(checkBranchPlacement(evidence)).toEqual([]);
  });

  it("leaves Timone's own branches alone", () => {
    // Timone is not a managed project and no run ever targets it, so only
    // the `timone/` prefix is decidable — a phase branch is its own business.
    const evidence = cleanEvidence();
    evidence.workspace.branches = [
      { name: "main", unpushed: [], hasUpstream: true },
      { name: "phase-21-chunking", unpushed: [], hasUpstream: true },
    ];

    expect(checkBranchPlacement(evidence)).toEqual([]);
  });

  it("is silent on a session that did nothing to the workspace", () => {
    expect(checkBranchPlacement(cleanEvidence())).toEqual([]);
  });

  it("is one of the checks that actually run", () => {
    // The rule existing and the rule being wired in are different claims,
    // and only the second one would have caught finding 11.
    const evidence = cleanEvidence();
    evidence.workspace.branches = [
      { name: "timone/29-fixture", unpushed: [], hasUpstream: false },
    ];

    expect(checkAll(evidence).map((violation) => violation.rule)).toContain(
      "branch-placement",
    );
  });
});

describe("checkPathContainment", () => {
  it("flags a commit in the timone workspace itself", () => {
    const evidence = cleanEvidence();
    evidence.workspace.commits = [
      { sha: "eee5555", branch: "main", files: ["src/daemon/poll.ts"], trailers: ["Timone-Stage: execution"] },
    ];

    const violations = checkPathContainment(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("path-containment");
    expect(violations[0].detail.join(" ")).toMatch(/src\/daemon\/poll\.ts/);
  });

  it("flags an uncommitted change in the timone workspace", () => {
    const evidence = cleanEvidence();
    evidence.workspace.workingTree = ["process.md"];

    expect(checkPathContainment(evidence)).toHaveLength(1);
  });

  it("flags harness files committed into the client repo", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      {
        sha: "fff6666",
        branch: "phase/01",
        files: [".claude/skills/timone-plan/SKILL.md", "src/x.ts"],
        trailers: ["Timone-Stage: execution"],
      },
    ];

    const violations = checkPathContainment(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].detail.join(" ")).toMatch(/\.claude/);
  });

  it("allows process artifacts in the client repo", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      {
        sha: "fff6666",
        branch: "phase/01",
        files: ["doc/plans/phases/phase-01.md", "CONTEXT.md"],
        trailers: ["Timone-Stage: execution"],
      },
    ];

    expect(checkPathContainment(evidence)).toEqual([]);
  });

  it("allows the workspace to carry the target project's own path", () => {
    const evidence = cleanEvidence();
    evidence.workspace.workingTree = ["projects/scratch-app/notes.md"];

    expect(checkPathContainment(evidence)).toEqual([]);
  });

  it("flags another project's path in the workspace", () => {
    const evidence = cleanEvidence();
    evidence.workspace.workingTree = ["projects/other-app/notes.md"];

    expect(checkPathContainment(evidence)).toHaveLength(1);
  });

  it("stays silent on a session that stayed where it belongs", () => {
    expect(checkPathContainment(cleanEvidence())).toEqual([]);
  });
});

interface PostedComment {
  number: number;
  body: string;
}

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
  async listOpenTickets(): Promise<never[]> {
    return [];
  },
  async closeTicket(): Promise<void> {},
};

function fakeAdapter(): {
  adapter: TicketingAdapter;
  comments: PostedComment[];
} {
  const comments: PostedComment[] = [];
  const adapter: TicketingAdapter = {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [];
    },
    async getTicket(): Promise<TicketThread> {
      throw new Error("not used");
    },
    async postComment(_project, number, body): Promise<void> {
      comments.push({ number, body });
    },
    async applyLabel(): Promise<void> {},
    ...noPullRequests,
  };
  return { adapter, comments };
}

/**
 * ADR-0027's three states, as a pure function over what this session has
 * already been told. `Stop` fires at the end of every assistant turn, so
 * "first sighting" and "still standing" are distinguishable only against
 * what was parked at the last one.
 */
describe("disposeViolations", () => {
  const unpushed: Violation = {
    rule: "unpushed",
    summary: "scratch-app: 1 commit(s) never reached the remote",
    detail: ["aaa1111"],
  };
  const stray: Violation = {
    rule: "path-containment",
    summary: "the session changed 1 file(s) outside `projects/scratch-app/`",
    detail: ["timone.yaml"],
  };

  it("hands a first sighting back to the session and escalates nothing", () => {
    const seen = disposeViolations([unpushed], { returned: [], escalated: [] });

    expect(seen.returned).toEqual([unpushed]);
    expect(seen.escalated).toEqual([]);
  });

  it("escalates what is still standing at the next stop", () => {
    const seen = disposeViolations([unpushed], {
      returned: [unpushed.summary],
      escalated: [],
    });

    expect(seen.returned).toEqual([]);
    expect(seen.escalated).toEqual([unpushed]);
  });

  it("falls silent once escalated, however many turns follow", () => {
    const seen = disposeViolations([unpushed], {
      returned: [unpushed.summary],
      escalated: [unpushed.summary],
    });

    expect(seen.returned).toEqual([]);
    expect(seen.escalated).toEqual([]);
  });

  it("tracks each violation separately, not the session as a whole", () => {
    // One finding fixed and a new one made in the same turn is the ordinary
    // case, and a per-session flag would either re-say the old or swallow
    // the new.
    const seen = disposeViolations([unpushed, stray], {
      returned: [unpushed.summary],
      escalated: [],
    });

    expect(seen.returned).toEqual([stray]);
    expect(seen.escalated).toEqual([unpushed]);
  });

  it("says nothing about a session with nothing wrong with it", () => {
    const seen = disposeViolations([], { returned: [], escalated: [] });

    expect(seen).toEqual({ returned: [], escalated: [] });
  });
});

describe("reportGuardrails", () => {
  it("hands a first sighting to the session, flagging nothing yet", async () => {
    // ADR-0027: the session gets one chance before anything reaches a human.
    const store = newStore();
    const { run } = store.register("scratch-app", 7);

    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "phase/01", unpushed: ["aaa1111"], hasUpstream: true },
    ];

    const printed: string[] = [];
    const seen = await reportGuardrails(evidence, {
      store,
      target: { kind: "run", runId: run.id },
      print: (message) => printed.push(message),
    });

    expect(seen.returned).toHaveLength(1);
    expect(seen.escalated).toEqual([]);
    expect(store.get(run.id)?.flags).toEqual([]);
    expect(printed).toEqual([]);
  });

  it("flags the run when a finding survives its chance, and posts nowhere", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);

    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "phase/01", unpushed: ["aaa1111"], hasUpstream: true },
    ];
    projectRepo(evidence).commits = [
      { sha: "ccc3333", branch: "phase/01", files: ["STATUS.md"], trailers: ["Timone-Stage: execution"] },
    ];
    const summaries = checkAll(evidence).map((violation) => violation.summary);

    const seen = await reportGuardrails(evidence, {
      store,
      target: { kind: "run", runId: run.id },
      seen: { returned: summaries, escalated: [] },
    });

    expect(seen.escalated).toHaveLength(2);
    expect(store.get(run.id)?.flags).toHaveLength(2);
  });

  it("prints and journals an interactive escalation, as it always did", async () => {
    const store = newStore();
    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "phase/01", unpushed: ["aaa1111"], hasUpstream: true },
    ];
    const summaries = checkAll(evidence).map((violation) => violation.summary);

    const printed: string[] = [];
    const journalled: string[] = [];
    await reportGuardrails(evidence, {
      store,
      target: { kind: "interactive", sessionId: "session-interactive" },
      print: (message) => printed.push(message),
      journal: (line) => journalled.push(line),
      seen: { returned: summaries, escalated: [] },
    });

    expect(printed.join("\n")).toContain("never reached the remote");
    expect(JSON.parse(journalled[0])).toMatchObject({
      session: "session-interactive",
      rule: "unpushed",
    });
  });

  it("says nothing at all about a clean session", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);

    const seen = await reportGuardrails(cleanEvidence(), {
      store,
      target: { kind: "run", runId: run.id },
    });

    expect(seen).toEqual({ returned: [], escalated: [] });
    expect(store.get(run.id)?.flags).toEqual([]);
  });
});

describe("checkProvenance", () => {
  it("flags a commit that says nothing about where it came from", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      { sha: "aaa1111", branch: "phase/01", files: ["src/x.ts"], trailers: [] },
    ];

    const [violation] = checkProvenance(evidence);

    expect(violation.rule).toBe("provenance");
    expect(violation.summary).toContain("say nothing about where they came from");
    expect(violation.detail.join("\n")).toContain("aaa1111");
  });

  it("reports a commit once, however many branches reach it", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      { sha: "aaa1111", branch: "main", files: ["src/x.ts"], trailers: [] },
      { sha: "aaa1111", branch: "feat/one", files: ["src/x.ts"], trailers: [] },
      { sha: "aaa1111", branch: "feat/two", files: ["src/x.ts"], trailers: [] },
    ];

    const [violation] = checkProvenance(evidence);

    expect(violation.summary).toContain("1 commit(s)");
    const lines = violation.detail.filter((line) => line.includes("aaa1111"));
    expect(lines).toHaveLength(1);
    // The branches are still named — that is useful; repeating the commit is not.
    expect(lines[0]).toContain("main");
    expect(lines[0]).toContain("feat/two");
  });

  it("ignores a merge the GitHub merge button made", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      {
        sha: "bbb2222",
        branch: "main",
        files: [],
        trailers: [],
        committerEmail: "noreply@github.com",
        parentCount: 2,
      },
    ];

    expect(checkProvenance(evidence)).toEqual([]);
  });

  it("still flags a merge a session made itself", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      {
        sha: "ccc3333",
        branch: "main",
        files: [],
        trailers: [],
        committerEmail: "someone@example.com",
        parentCount: 2,
      },
    ];

    const [violation] = checkProvenance(evidence);

    expect(violation.detail.join("\n")).toContain("ccc3333");
  });

  it("accepts a run-driven commit carrying all three lines", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      {
        sha: "aaa1111",
        branch: "phase/01",
        files: ["src/x.ts"],
        trailers: [
          "Timone-Stage: execution",
          "Timone-Run: scratch-app#7",
          "Timone-Session: abc-123",
        ],
      },
    ];

    expect(checkProvenance(evidence)).toEqual([]);
  });

  it("accepts an interactive commit, which carries no run", () => {
    // `Timone-Stage: interactive` is what makes absence unambiguous: a commit
    // with no run is different from a commit that forgot to say.
    const evidence = cleanEvidence();
    evidence.target = undefined;
    projectRepo(evidence).commits = [];
    evidence.workspace.commits = [
      {
        sha: "bbb2222",
        branch: "main",
        files: ["src/daemon/hooks.ts"],
        trailers: ["Timone-Stage: interactive", "Timone-Session: abc-123"],
      },
    ];

    expect(checkProvenance(evidence)).toEqual([]);
  });

  it("judges only what this session committed, never what was there before", () => {
    // The evidence is already scoped to the session by the baseline, and this
    // rule adds no reach of its own: every commit made before the convention
    // landed is unmarked, and nothing is rewritten.
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [];
    evidence.workspace.commits = [];

    expect(checkProvenance(evidence)).toEqual([]);
  });

  it("leaves Co-Authored-By alone — it adds a trailer, it does not replace one", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      {
        sha: "aaa1111",
        branch: "phase/01",
        files: ["src/x.ts"],
        trailers: [
          "Co-Authored-By: Claude <noreply@anthropic.com>",
          "Timone-Stage: execution",
        ],
      },
    ];

    expect(checkProvenance(evidence)).toEqual([]);
  });

  it("counts every untrailed commit, in both repos", () => {
    const evidence = cleanEvidence();
    projectRepo(evidence).commits = [
      { sha: "aaa1111", branch: "phase/01", files: ["a"], trailers: [] },
    ];
    evidence.workspace.commits = [
      { sha: "bbb2222", branch: "main", files: ["b"], trailers: [] },
    ];

    const [violation] = checkProvenance(evidence);
    expect(violation.summary).toContain("2 commit(s)");
  });
});
