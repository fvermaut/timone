import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { TicketingAdapter, TicketingProject } from "../adapters/ticketing.js";
import type { RunStore } from "./runs.js";

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
  /** The commit message's trailer lines, verbatim (ADR-0019). */
  trailers: string[];
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
  /**
   * The project the session was supposed to be working on, when one is known.
   *
   * A daemon session always has one — it belongs to a run, and the run names
   * its project. An interactive session belongs to no run and names nothing,
   * and that absence is meaningful rather than missing information: with no
   * declared target there is no "should have stayed inside" to judge, and a
   * session working on Timone itself touches nothing under `projects/` at all.
   */
  target?: string;
  /** The timone repo, where every session runs (ADR-0007). */
  workspace: RepoEvidence;
  /**
   * The managed projects' checkouts. One for a daemon session; every declared
   * project for an interactive one, because nobody said which it would touch.
   */
  projects: RepoEvidence[];
}

export type GuardrailRule =
  | "unpushed"
  | "status-placement"
  | "path-containment"
  | "provenance";

/** The trailer every Timone-authored commit carries (ADR-0019). */
export const STAGE_TRAILER = "Timone-Stage";

/**
 * The trailer naming which session made a commit (ADR-0019).
 *
 * It exists so "who did this?" is answered from git history alone — and for
 * one phase the rules that *enforce* it did not *read* it, which is how a
 * clean session came to be accused publicly on a client's ticket of touching
 * three files another session had committed.
 */
export const SESSION_TRAILER = "Timone-Session";

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
  for (const repo of [...evidence.projects, evidence.workspace]) {
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
  for (const repo of [...evidence.projects, evidence.workspace]) {
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
 * **Path containment.** Two halves, and they have different preconditions.
 *
 * In the workspace repo: a session sent to work one project should have
 * touched nothing outside `projects/<target>/`. This half asks a question
 * that only exists when somebody named a target — a session working on
 * Timone itself was *sent* to change `src/` and `doc/`, and judging it
 * against a target it never had would flag every honest edit. So it runs for
 * a daemon session and is silent for an interactive one.
 *
 * In a project repo: no harness file may ride along, whoever was driving.
 * Process artifacts under `doc/` and `CONTEXT.md` are exactly what a client
 * repo does receive (R2); `.claude/`, `.timone/` and the rest are not. This
 * half needs no target and runs for both kinds.
 */
export function checkPathContainment(evidence: SessionEvidence): Violation[] {
  const violations: Violation[] = [];

  if (evidence.target !== undefined) {
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
  }

  for (const project of evidence.projects) {
    const harness = project.commits.flatMap((commit) =>
      commit.files
        .filter(isHarnessPath)
        .map((file) => `- ${file} (commit ${commit.sha})`),
    );

    if (harness.length > 0) {
      violations.push({
        rule: "path-containment",
        summary: `${harness.length} harness file(s) were committed into ${project.repo}`,
        detail: [
          "A client repository receives process artifacts only — documents under `doc/` and `CONTEXT.md`. These are not that:",
          ...harness,
        ],
      });
    }
  }

  return violations;
}

/**
 * **Provenance.** Every commit a Timone session makes says which stage made
 * it (ADR-0019), so "where did this come from?" is answered from git history
 * alone rather than reconstructed from memory.
 *
 * This is what makes the convention binding rather than aspirational. A
 * trailer emitted only by the stage skills would bind only the sessions that
 * follow a skill — and an interactive session follows none, which is exactly
 * the gap phase 14 exists to close. So the rule is checked here, on evidence,
 * for both kinds.
 *
 * Only commits made *during* the session are judged, which is what the
 * baseline already scopes the evidence to. Every commit made before this
 * convention landed is unmarked, and nothing is rewritten: absence proves
 * nothing about existing history, and this rule never claims otherwise.
 */
export function checkProvenance(evidence: SessionEvidence): Violation[] {
  const untrailed = [...evidence.projects, evidence.workspace].flatMap((repo) =>
    repo.commits
      .filter(
        (commit) =>
          !commit.trailers.some((line) =>
            line.startsWith(`${STAGE_TRAILER}:`),
          ),
      )
      .map((commit) => `- ${repo.repo} ${commit.sha} on \`${commit.branch}\``),
  );

  if (untrailed.length === 0) return [];

  return [
    {
      rule: "provenance",
      summary: `${untrailed.length} commit(s) made in this session say nothing about where they came from`,
      detail: [
        `Every commit a Timone session makes carries a \`${STAGE_TRAILER}:\` trailer naming the step that made it. These do not:`,
        ...untrailed,
        "",
        `Amend them with the trailer — \`${STAGE_TRAILER}: interactive\` when no process stage was running.`,
      ],
    },
  ];
}

/** Every check, in the order their comments should read. */
export function checkAll(evidence: SessionEvidence): Violation[] {
  return [
    ...checkPathContainment(evidence),
    ...checkUnpushed(evidence),
    ...checkStatusPlacement(evidence),
    ...checkProvenance(evidence),
  ];
}

/**
 * Where a report goes, which is decided by whether a run owns the session.
 *
 * Resolved rather than configured: the check looks the session id up in the
 * ledger, and runs already store it. A run found means the daemon drove this
 * session and its ticket is the right place; no run means a human did, and
 * there is no ticket to write on. One implementation, two audiences.
 */
export type ReportTarget =
  | { kind: "run"; project: TicketingProject; runId: string; ticket: number }
  | { kind: "interactive"; sessionId: string };

export interface GuardrailReportDeps {
  store: RunStore;
  adapter: TicketingAdapter;
  target: ReportTarget;
  /** Where an interactive report is written. Defaults to stdout. */
  print?: (message: string) => void;
  /** Appends one line to `.timone/sessions.jsonl`. Defaults to doing nothing. */
  journal?: (line: string) => void;
  /**
   * Violation summaries already reported for this session, which are found
   * again but not repeated. `Stop` fires at the end of every assistant turn
   * rather than once per session, so without this an interactive session
   * would be told the same thing after every reply until it was fixed.
   *
   * It lives here rather than in the rules on purpose: the rules stay pure
   * functions over git evidence and know nothing about turns.
   */
  suppress?: ReadonlySet<string>;
}

/** The loud comment for one violation. Ends, like every message, with a CTA. */
export function violationComment(violation: Violation): string {
  return [
    `⚠️ **Automatic check failed — ${violation.summary}**`,
    "",
    ...violation.detail,
    "",
    "This is a mechanical check, not a judgement about the work itself. It runs after every session at the timone root because these are mistakes that otherwise pass unnoticed.",
    "",
    "**What I need from you:** nothing yet — but treat anything below this comment as unfinished until it is sorted out.",
  ].join("\n");
}

/** The same violation, for someone reading a terminal rather than a ticket. */
export function violationReport(violation: Violation): string {
  return [
    `⚠️  Automatic check failed — ${violation.summary}`,
    ...violation.detail.map((line) => `    ${line}`),
  ].join("\n");
}

/**
 * Run every check and report what failed.
 *
 * A session the daemon drove gets one loud ticket comment per violation and
 * its run flagged, so `timone status` shows it — unchanged from phase 11,
 * because that path already worked and this slice's risk is breaking it.
 *
 * A session a human drove gets the same words on stdout and one line in the
 * journal, and posts nothing anywhere: there is no ticket, and inventing one
 * would put a machine's bookkeeping on somebody's unrelated work.
 *
 * A clean session of either kind produces nothing. Silence is the signal.
 */
export async function reportGuardrails(
  evidence: SessionEvidence,
  deps: GuardrailReportDeps,
): Promise<Violation[]> {
  const suppress = deps.suppress ?? new Set<string>();
  const violations = checkAll(evidence).filter(
    (violation) => !suppress.has(violation.summary),
  );
  const print = deps.print ?? ((message: string) => console.log(message));
  const journal = deps.journal ?? (() => {});

  for (const violation of violations) {
    if (deps.target.kind === "run") {
      await deps.adapter.postComment(
        deps.target.project,
        deps.target.ticket,
        violationComment(violation),
      );
      deps.store.flag(deps.target.runId, violation.summary);
      continue;
    }

    print(violationReport(violation));
    journal(
      JSON.stringify({
        session: deps.target.sessionId,
        rule: violation.rule,
        summary: violation.summary,
      }),
    );
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

/**
 * The trailer lines of a commit message: the `Key: value` lines of its final
 * paragraph. Read here rather than via `git log --format=%(trailers)` so the
 * message is parsed once, alongside the file list, from a single log call.
 */
function trailersOf(message: string): string[] {
  const paragraphs = message.trimEnd().split(/\n\s*\n/);
  const last = paragraphs.at(-1) ?? "";
  const lines = last.split("\n").map((line) => line.trim());
  return lines.every((line) => /^[A-Za-z][A-Za-z0-9-]*:\s*\S/.test(line))
    ? lines
    : [];
}

/** One repository's tip shas, taken before the session runs. */
export type RepoBaseline = Map<string, string>;

/** What the guardrails need to know about the world before a session. */
export interface SessionBaseline {
  workspace: RepoBaseline;
  /** Project name → its checkout's branch tips, for every declared project. */
  projects: Map<string, RepoBaseline>;
}

/**
 * Record every repo's branch tips. Called from the `SessionStart` hook, which
 * cannot know which project the session will touch — so it baselines them
 * all. A checkout that does not exist yet contributes an empty map rather
 * than an error: not having cloned a project is not a violation.
 */
export async function captureBaseline(
  root: string,
  projects: readonly string[],
): Promise<SessionBaseline> {
  const byProject = new Map<string, RepoBaseline>();
  for (const name of projects) {
    const dir = join(root, "projects", name);
    byProject.set(
      name,
      existsSync(dir) ? await branchTips(dir) : new Map<string, string>(),
    );
  }
  return { workspace: await branchTips(root), projects: byProject };
}

/**
 * Compare a repo against its baseline: which branches moved, what commits
 * they gained, what is unpushed, and what is left uncommitted.
 */
async function collectRepo(
  dir: string,
  label: string,
  baseline: RepoBaseline,
  sessionId: string,
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
    // Unpushed commits are a question about the *repository* — `--not
    // --remotes=origin` has no session scoping in it whatsoever — so they
    // need the trailer filter by their own route rather than inheriting it
    // from the baseline diff below. This is the half that fired in the
    // common case: any interactive session opened while the daemon builds
    // saw the daemon's in-flight commits as its own.
    const unpushed = (
      await commitsOn(dir, name, [name, "--not", "--remotes=origin"])
    ).filter((commit) => !madeElsewhere(commit, sessionId));

    const upstream = (
      await git(dir, ["rev-parse", "--verify", `refs/remotes/origin/${name}`])
    ).trim();

    branches.push({
      name,
      unpushed: unpushed.map((commit) => commit.sha),
      hasUpstream: upstream !== "",
    });

    // Commits reachable from this branch but from none of the tips that
    // existed before the session — that is what the session added, minus
    // whatever another session added alongside it.
    for (const commit of await commitsOn(dir, name, [
      name,
      "--not",
      ...baselineShas,
    ])) {
      if (madeElsewhere(commit, sessionId)) continue;
      commits.push(commit);
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

/**
 * The commits `revArgs` selects, each with the trailers that say who made it.
 *
 * The \x00 / \x01 / \x02 delimiters exist because the message is multi-line
 * and the file list follows it in the same output: without them the two
 * cannot be told apart.
 */
async function commitsOn(
  dir: string,
  branch: string,
  revArgs: string[],
): Promise<CommitEvidence[]> {
  const log = await git(dir, [
    "log",
    "--pretty=format:%x00%H%x01%B%x02",
    "--name-only",
    ...revArgs,
  ]);

  const commits: CommitEvidence[] = [];
  for (const block of log.split("\0")) {
    if (block.trim() === "") continue;
    const [header, afterBody = ""] = block.split("\x02");
    const [sha, body = ""] = header.split("\x01");
    if (sha.trim() === "") continue;
    commits.push({
      sha: sha.trim().slice(0, 7),
      branch,
      files: afterBody.split("\n").filter((line) => line.trim() !== ""),
      trailers: trailersOf(body),
    });
  }
  return commits;
}

/**
 * True when this commit says, in its own message, that a **different**
 * session made it.
 *
 * The predicate excludes; it never includes. A commit carrying no session
 * trailer is kept and judged, because such a commit is genuinely
 * unattributable and over-reporting a real violation is the safe direction —
 * so the duplicate provenance line from an untrailed commit survives by
 * necessity. That is the known limit of this fix, and it is a test rather
 * than a comment: removing it turns a guardrail into a blind spot.
 */
function madeElsewhere(commit: CommitEvidence, sessionId: string): boolean {
  const prefix = `${SESSION_TRAILER}:`;
  for (const line of commit.trailers) {
    if (!line.startsWith(prefix)) continue;
    return line.slice(prefix.length).trim() !== sessionId;
  }
  return false;
}

/**
 * Gather the evidence for one finished session.
 *
 * `target` is passed only when a run owns the session. Every project the
 * baseline covered is collected either way — a stray commit in a checkout
 * nobody named is exactly the accident this widening exists to catch.
 *
 * `sessionId` is required rather than optional, and arrives as an argument
 * rather than off the environment: it is what scopes the evidence to the
 * session being judged, and every rule downstream depends on that scoping
 * being right. A baseline diff alone cannot do it — two sessions open at the
 * timone root share the repository, and the one with the older baseline sees
 * the other's commits as its own.
 */
export async function collectEvidence(
  root: string,
  baseline: SessionBaseline,
  session: { sessionId: string; target?: string },
): Promise<SessionEvidence> {
  const projects: RepoEvidence[] = [];
  for (const [name, tips] of baseline.projects) {
    projects.push(
      await collectRepo(join(root, "projects", name), name, tips, session.sessionId),
    );
  }
  return {
    ...(session.target === undefined ? {} : { target: session.target }),
    workspace: await collectRepo(root, "timone", baseline.workspace, session.sessionId),
    projects,
  };
}

// ---------------------------------------------------------------------------
// Parking a baseline between two processes.
//
// `SessionStart` and `Stop` are separate invocations of the CLI, so the
// baseline cannot live in memory the way it did when one spawner held both
// ends. It is keyed by session id rather than run id because an interactive
// session has no run — and the session id is the only identifier both hooks
// are given.
// ---------------------------------------------------------------------------

/** What is parked on disk between the two hooks. */
interface StoredBaseline {
  workspace: Record<string, string>;
  projects: Record<string, Record<string, string>>;
  /**
   * Violation summaries already reported for this session. `Stop` fires at
   * the end of every assistant turn, not once per session, so without this
   * an interactive session would repeat the same complaint after every reply.
   */
  reported: string[];
  /** When the baseline was taken, so old ones can be swept. */
  takenAt: string;
}

/** A session id reduced to something safe to use as a filename. */
function safeName(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128) || "unknown";
}

/** Where a session's baseline is parked. Under `.timone/`, so gitignored. */
export function baselinePath(root: string, sessionId: string): string {
  return join(root, ".timone", "baselines", `${safeName(sessionId)}.json`);
}

/** The journal an interactive session's findings are appended to. */
export function journalPath(root: string): string {
  return join(root, ".timone", "sessions.jsonl");
}

/** Park a baseline for the `Stop` hook to find. */
export function saveBaseline(
  path: string,
  baseline: SessionBaseline,
  takenAt: string,
): void {
  const stored: StoredBaseline = {
    workspace: Object.fromEntries(baseline.workspace),
    projects: Object.fromEntries(
      [...baseline.projects].map(([name, tips]) => [
        name,
        Object.fromEntries(tips),
      ]),
    ),
    reported: [],
    takenAt,
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(stored)}\n`, "utf8");
}

/**
 * Read a parked baseline, or undefined when there is none — which is a
 * finding rather than a silence: without a baseline the checks cannot judge
 * anything, and passing quietly would disarm them on exactly the session that
 * needed watching.
 */
export function loadBaseline(
  path: string,
): { baseline: SessionBaseline; reported: string[] } | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const stored = JSON.parse(readFileSync(path, "utf8")) as StoredBaseline;
    return {
      baseline: {
        workspace: new Map(Object.entries(stored.workspace ?? {})),
        projects: new Map(
          Object.entries(stored.projects ?? {}).map(([name, tips]) => [
            name,
            new Map(Object.entries(tips)),
          ]),
        ),
      },
      reported: stored.reported ?? [],
    };
  } catch {
    return undefined;
  }
}

/** Remember what has already been said, so `Stop` does not say it each turn. */
export function markReported(path: string, summaries: string[]): void {
  if (!existsSync(path) || summaries.length === 0) return;
  try {
    const stored = JSON.parse(readFileSync(path, "utf8")) as StoredBaseline;
    stored.reported = [...new Set([...(stored.reported ?? []), ...summaries])];
    writeFileSync(path, `${JSON.stringify(stored)}\n`, "utf8");
  } catch {
    // A journal that cannot be updated is not worth failing a session over.
  }
}

/**
 * Delete baselines older than a day. Called on `SessionStart`, because that
 * is the moment a new one is written and the only moment anything is
 * guaranteed to run: a session killed mid-flight never reaches `Stop`, and
 * its baseline would otherwise sit there forever.
 */
export function sweepBaselines(root: string, now: Date, maxAgeMs: number): void {
  const dir = dirname(baselinePath(root, "x"));
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    try {
      const stored = JSON.parse(readFileSync(path, "utf8")) as StoredBaseline;
      const age = now.getTime() - Date.parse(stored.takenAt);
      if (Number.isFinite(age) && age > maxAgeMs) rmSync(path, { force: true });
    } catch {
      rmSync(path, { force: true });
    }
  }
}
