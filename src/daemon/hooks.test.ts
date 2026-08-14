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
  checkPathContainment,
  checkProvenance,
  checkStatusPlacement,
  checkUnpushed,
  reportGuardrails,
  type RepoEvidence,
  type SessionEvidence,
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

describe("reportGuardrails", () => {
  it("posts one loud comment per violation and flags the run", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    const { adapter, comments } = fakeAdapter();

    const evidence = cleanEvidence();
    projectRepo(evidence).branches = [
      { name: "phase/01", unpushed: ["aaa1111"], hasUpstream: true },
    ];
    projectRepo(evidence).commits = [
      { sha: "ccc3333", branch: "phase/01", files: ["STATUS.md"], trailers: ["Timone-Stage: execution"] },
    ];

    const violations = await reportGuardrails(evidence, {
      store,
      adapter,
      target: { kind: "run", project, runId: run.id, ticket: 7 },
    });

    expect(violations).toHaveLength(2);
    expect(comments).toHaveLength(2);
    expect(store.get(run.id)?.flags).toHaveLength(2);
    for (const comment of comments) {
      expect(comment.number).toBe(7);
      const lastLine = comment.body.trimEnd().split("\n").at(-1) ?? "";
      expect(lastLine).toMatch(/\*\*What I need from you:\*\*/);
    }
  });

  it("says nothing at all about a clean session", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    const { adapter, comments } = fakeAdapter();

    const violations = await reportGuardrails(cleanEvidence(), {
      store,
      adapter,
      target: { kind: "run", project, runId: run.id, ticket: 7 },
    });

    expect(violations).toEqual([]);
    expect(comments).toEqual([]);
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
