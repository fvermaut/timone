import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  Ticket,
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import { RunStore } from "./runs.js";
import {
  checkPathContainment,
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
    project: {
      repo: "scratch-app",
      defaultBranch: "main",
      branches: [{ name: "phase/01", unpushed: [], hasUpstream: true }],
      commits: [
        { sha: "aaa1111", branch: "phase/01", files: ["src/features/todos/x.ts"] },
      ],
      workingTree: [],
    },
  };
}

describe("checkUnpushed", () => {
  it("flags a branch carrying commits the remote never saw", () => {
    const evidence = cleanEvidence();
    evidence.project.branches = [
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
    evidence.project.branches = [
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
    evidence.project.commits = [
      { sha: "ccc3333", branch: "phase/01", files: ["STATUS.md", "src/x.ts"] },
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
      { sha: "ddd4444", branch: "some-branch", files: ["STATUS.md"] },
    ];

    expect(checkStatusPlacement(evidence)).toHaveLength(1);
  });

  it("stays silent when STATUS.md is committed on the default branch", () => {
    const evidence = cleanEvidence();
    evidence.project.commits = [
      { sha: "ccc3333", branch: "main", files: ["STATUS.md"] },
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
      { sha: "eee5555", branch: "main", files: ["src/daemon/poll.ts"] },
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
    evidence.project.commits = [
      {
        sha: "fff6666",
        branch: "phase/01",
        files: [".claude/skills/timone-plan/SKILL.md", "src/x.ts"],
      },
    ];

    const violations = checkPathContainment(evidence);

    expect(violations).toHaveLength(1);
    expect(violations[0].detail.join(" ")).toMatch(/\.claude/);
  });

  it("allows process artifacts in the client repo", () => {
    const evidence = cleanEvidence();
    evidence.project.commits = [
      {
        sha: "fff6666",
        branch: "phase/01",
        files: ["doc/plans/phases/phase-01.md", "CONTEXT.md"],
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
  };
  return { adapter, comments };
}

describe("reportGuardrails", () => {
  it("posts one loud comment per violation and flags the run", async () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 7);
    const { adapter, comments } = fakeAdapter();

    const evidence = cleanEvidence();
    evidence.project.branches = [
      { name: "phase/01", unpushed: ["aaa1111"], hasUpstream: true },
    ];
    evidence.project.commits = [
      { sha: "ccc3333", branch: "phase/01", files: ["STATUS.md"] },
    ];

    const violations = await reportGuardrails(evidence, {
      store,
      adapter,
      project,
      runId: run.id,
      ticket: 7,
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
      project,
      runId: run.id,
      ticket: 7,
    });

    expect(violations).toEqual([]);
    expect(comments).toEqual([]);
    expect(store.get(run.id)?.flags).toEqual([]);
  });
});
