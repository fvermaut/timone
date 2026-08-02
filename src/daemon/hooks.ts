import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import type { TicketingAdapter, TicketingProject } from "../adapters/ticketing.js";
import type { Run, RunStore } from "./runs.js";

const execFileAsync = promisify(execFile);

/** A branch as the checks see it. */
export interface BranchEvidence {
  name: string;
  /** Commits this branch carries that its upstream does not. */
  unpushed: string[];
  /** False when the branch has no upstream at all. */
  hasUpstream: boolean;
}

/** A commit made during the session. */
export interface CommitEvidence {
  sha: string;
  branch: string;
  /** Repo-relative paths the commit touched. */
  files: string[];
}

/** What one repository did during a session. */
export interface RepoEvidence {
  /** Label used in messages: the project name, or "timone" for the workspace. */
  repo: string;
  defaultBranch: string;
  branches: BranchEvidence[];
  commits: CommitEvidence[];
  /** Repo-relative paths changed but not committed. */
  workingTree: string[];
}

/**
 * Everything the guardrails judge. Gathering it is git's job (see
 * `collectEvidence`); deciding on it is a pure function, so every rule can
 * be shown failing on a fabricated violation.
 */
export interface SessionEvidence {
  /** The project the session was supposed to be working on. */
  target: string;
  /** The timone repo, where the session ran. */
  workspace: RepoEvidence;
  /** The managed project's checkout. */
  project: RepoEvidence;
}

export type GuardrailRule =
  | "unpushed"
  | "status-placement"
  | "path-containment";

export interface Violation {
  rule: GuardrailRule;
  /** One line, in the human's terms. */
  summary: string;
  /** The evidence, verbatim enough to act on. */
  detail: string[];
}

/** Paths that belong to the harness and must never enter a client repo. */
const HARNESS_PATHS = [
  ".claude/",
  ".timone/",
  "timone.yaml",
  "process.md",
  "standards/",
];

/**
 * **Unpushed commits.** Work committed and never pushed exists on one
 * machine only; every stage that follows reads the remote, so this is the
 * failure that looks like success.
 */
export function checkUnpushed(evidence: SessionEvidence): Violation[] {
  const violations: Violation[] = [];
  for (const repo of [evidence.project, evidence.workspace]) {
    for (const branch of repo.branches) {
      if (branch.unpushed.length === 0) continue;
      violations.push({
        rule: "unpushed",
        summary: `${repo.repo}: ${branch.unpushed.length} commit(s) on \`${branch.name}\` never reached the remote`,
        detail: [
          branch.hasUpstream
            ? `Branch \`${branch.name}\` is ahead of its upstream.`
            : `Branch \`${branch.name}\` has no upstream — it was never pushed.`,
          ...branch.unpushed.map((sha) => `- ${sha}`),
        ],
      });
    }
  }
  return violations;
}

/**
 * **STATUS.md placement.** The status file is the human's view of a project
 * and is read from the default branch; written on a feature branch it is
 * invisible until — and unless — that branch merges.
 */
export function checkStatusPlacement(evidence: SessionEvidence): Violation[] {
  const violations: Violation[] = [];
  for (const repo of [evidence.project, evidence.workspace]) {
    for (const commit of repo.commits) {
      if (commit.branch === repo.defaultBranch) continue;
      if (!commit.files.some((file) => file.endsWith("STATUS.md"))) continue;
      violations.push({
        rule: "status-placement",
        summary: `${repo.repo}: STATUS.md was written on \`${commit.branch}\`, not on \`${repo.defaultBranch}\``,
        detail: [
          `Commit ${commit.sha} on \`${commit.branch}\` touches STATUS.md.`,
          `Nobody reading \`${repo.defaultBranch}\` will see it until that branch merges.`,
        ],
      });
    }
  }
  return violations;
}

/** True when `path` is one the client repo may legitimately receive. */
function isHarnessPath(path: string): boolean {
  return HARNESS_PATHS.some((prefix) => path === prefix || path.startsWith(prefix));
}

/**
 * **Path containment.** A session works one project. In the workspace repo
 * that means it should have touched nothing outside `projects/<target>/`
 * (and that directory is not the workspace repo's content anyway); in the
 * project repo it means no harness file rides along — process artifacts
 * under `doc/` and `CONTEXT.md` are exactly what a client repo does receive
 * (R2).
 */
export function checkPathContainment(evidence: SessionEvidence): Violation[] {
  const violations: Violation[] = [];
  const allowedPrefix = `projects/${evidence.target}/`;

  const strayed = [
    ...evidence.workspace.commits.flatMap((commit) =>
      commit.files.map((file) => ({ file, where: `commit ${commit.sha}` })),
    ),
    ...evidence.workspace.workingTree.map((file) => ({
      file,
      where: "uncommitted change",
    })),
  ].filter(({ file }) => !file.startsWith(allowedPrefix));

  if (strayed.length > 0) {
    violations.push({
      rule: "path-containment",
      summary: `the session changed ${strayed.length} file(s) outside \`${allowedPrefix}\``,
      detail: [
        `This run was working on **${evidence.target}**, so everything it touches belongs under \`${allowedPrefix}\`.`,
        ...strayed.map(({ file, where }) => `- ${file} (${where})`),
      ],
    });
  }

  const harness = evidence.project.commits.flatMap((commit) =>
    commit.files
      .filter(isHarnessPath)
      .map((file) => `- ${file} (commit ${commit.sha})`),
  );

  if (harness.length > 0) {
    violations.push({
      rule: "path-containment",
      summary: `${harness.length} harness file(s) were committed into ${evidence.project.repo}`,
      detail: [
        "A client repository receives process artifacts only — documents under `doc/` and `CONTEXT.md`. These are not that:",
        ...harness,
      ],
    });
  }

  return violations;
}

/** Every check, in the order their comments should read. */
export function checkAll(evidence: SessionEvidence): Violation[] {
  return [
    ...checkPathContainment(evidence),
    ...checkUnpushed(evidence),
    ...checkStatusPlacement(evidence),
  ];
}

export interface GuardrailReportDeps {
  store: RunStore;
  adapter: TicketingAdapter;
  project: TicketingProject;
  runId: string;
  ticket: number;
}

/** The loud comment for one violation. Ends, like every message, with a CTA. */
export function violationComment(violation: Violation): string {
  return [
    `⚠️ **Automatic check failed — ${violation.summary}**`,
    "",
    ...violation.detail,
    "",
    "This is a mechanical check, not a judgement about the work itself. It runs after every automatic session because these are mistakes that otherwise pass unnoticed.",
    "",
    "**What I need from you:** nothing yet — but treat anything below this comment as unfinished until it is sorted out.",
  ].join("\n");
}

/**
 * Run every check and report what failed: one loud ticket comment per
 * violation, and the run flagged so `timone status` shows it. A clean
 * session produces nothing — silence is the signal that all three passed.
 */
export async function reportGuardrails(
  evidence: SessionEvidence,
  deps: GuardrailReportDeps,
): Promise<Violation[]> {
  const violations = checkAll(evidence);

  for (const violation of violations) {
    await deps.adapter.postComment(
      deps.project,
      deps.ticket,
      violationComment(violation),
    );
    deps.store.flag(deps.runId, violation.summary);
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Gathering the evidence. Everything below talks to git; everything above is
// a pure function over what it returns. The split is deliberate: the rules
// are the part that must be shown failing, and they are the part that can be.
// ---------------------------------------------------------------------------

/** Run a git command in `dir`, returning stdout ("" when the command fails). */
async function git(dir: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: dir });
    return stdout;
  } catch {
    return "";
  }
}

/** Branch name → tip sha, for every local branch. */
async function branchTips(dir: string): Promise<Map<string, string>> {
  const out = await git(dir, [
    "for-each-ref",
    "--format=%(refname:short) %(objectname)",
    "refs/heads",
  ]);
  const tips = new Map<string, string>();
  for (const line of out.split("\n")) {
    const [name, sha] = line.trim().split(" ");
    if (name !== undefined && name !== "" && sha !== undefined) {
      tips.set(name, sha);
    }
  }
  return tips;
}

/** The remote's default branch, falling back to `main` when unknown. */
async function defaultBranchOf(dir: string): Promise<string> {
  const ref = (
    await git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD"])
  ).trim();
  if (ref !== "") return ref.replace(/^refs\/remotes\/origin\//, "");
  return "main";
}

/** Paths with uncommitted changes, renames counted at their destination. */
async function workingTreePaths(dir: string): Promise<string[]> {
  const out = await git(dir, ["status", "--porcelain"]);
  return out
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const path = line.slice(3);
      const arrow = path.indexOf(" -> ");
      return arrow === -1 ? path : path.slice(arrow + 4);
    })
    .map((path) => path.replace(/^"|"$/g, ""));
}

/** One repository's tip shas, taken before the session runs. */
export type RepoBaseline = Map<string, string>;

/** What the guardrails need to know about the world before a session. */
export interface SessionBaseline {
  workspace: RepoBaseline;
  project: RepoBaseline;
}

/** Record both repos' branch tips. Called immediately before a session. */
export async function captureBaseline(
  root: string,
  projectDir: string,
): Promise<SessionBaseline> {
  return {
    workspace: await branchTips(root),
    project: existsSync(projectDir)
      ? await branchTips(projectDir)
      : new Map<string, string>(),
  };
}

/**
 * Compare a repo against its baseline: which branches moved, what commits
 * they gained, what is unpushed, and what is left uncommitted.
 */
async function collectRepo(
  dir: string,
  label: string,
  baseline: RepoBaseline,
): Promise<RepoEvidence> {
  if (!existsSync(dir)) {
    return {
      repo: label,
      defaultBranch: "main",
      branches: [],
      commits: [],
      workingTree: [],
    };
  }

  const tips = await branchTips(dir);
  const touched = [...tips.entries()].filter(
    ([name, sha]) => baseline.get(name) !== sha,
  );

  const baselineShas = [...baseline.values()];
  const branches: BranchEvidence[] = [];
  const commits: CommitEvidence[] = [];

  for (const [name] of touched) {
    const unpushed = (
      await git(dir, ["rev-list", name, "--not", "--remotes=origin"])
    )
      .split("\n")
      .map((sha) => sha.trim())
      .filter((sha) => sha !== "");

    const upstream = (
      await git(dir, ["rev-parse", "--verify", `refs/remotes/origin/${name}`])
    ).trim();

    branches.push({
      name,
      unpushed: unpushed.map((sha) => sha.slice(0, 7)),
      hasUpstream: upstream !== "",
    });

    // Commits reachable from this branch but from none of the tips that
    // existed before the session — that is what the session added.
    const log = await git(dir, [
      "log",
      "--pretty=format:%x00%H",
      "--name-only",
      name,
      "--not",
      ...baselineShas,
    ]);
    for (const block of log.split("\0")) {
      const lines = block.split("\n").filter((line) => line.trim() !== "");
      if (lines.length === 0) continue;
      commits.push({
        sha: lines[0].slice(0, 7),
        branch: name,
        files: lines.slice(1),
      });
    }
  }

  return {
    repo: label,
    defaultBranch: await defaultBranchOf(dir),
    branches,
    commits,
    workingTree: await workingTreePaths(dir),
  };
}

/** Gather the evidence for one finished session. */
export async function collectEvidence(
  root: string,
  target: string,
  baseline: SessionBaseline,
): Promise<SessionEvidence> {
  const projectDir = join(root, "projects", target);
  return {
    target,
    workspace: await collectRepo(root, "timone", baseline.workspace),
    project: await collectRepo(projectDir, target, baseline.project),
  };
}

export interface GuardrailObserverOptions {
  root: string;
  store: RunStore;
  adapter: TicketingAdapter;
  log?: (message: string) => void;
}

/**
 * Brackets a session: records the baseline before it starts, then judges
 * what changed once it ends. Held per run, because a run's baseline is only
 * meaningful against that run's session.
 */
export class GuardrailObserver {
  private readonly baselines = new Map<string, SessionBaseline>();
  private readonly log: (message: string) => void;

  constructor(private readonly options: GuardrailObserverOptions) {
    this.log = options.log ?? (() => {});
  }

  async before(run: Run, project: TicketingProject): Promise<void> {
    this.baselines.set(
      run.id,
      await captureBaseline(
        this.options.root,
        join(this.options.root, "projects", project.name),
      ),
    );
  }

  async after(run: Run, project: TicketingProject): Promise<void> {
    const baseline = this.baselines.get(run.id);
    if (baseline === undefined) {
      this.log(
        `guardrails skipped for ${run.id}: no baseline was taken before the session`,
      );
      return;
    }
    this.baselines.delete(run.id);

    const evidence = await collectEvidence(
      this.options.root,
      project.name,
      baseline,
    );
    const violations = await reportGuardrails(evidence, {
      store: this.options.store,
      adapter: this.options.adapter,
      project,
      runId: run.id,
      ticket: run.ticket,
    });
    this.log(
      violations.length === 0
        ? `guardrails clean for ${run.id}`
        : `guardrails flagged ${violations.length} violation(s) for ${run.id}`,
    );
  }
}
