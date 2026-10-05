import { z } from "zod";

import { PROBE_DIRECTORIES } from "./daemon/probeGuard.js";

/**
 * Which three test sets an update runs
 * ([ADR-0066](../doc/adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md)):
 * the project's own tests, the check scripts of the branch's own plan, and
 * the check scripts of each plan that arrived on the default branch since the
 * branch was last level with it. `timone update-checks` prints them.
 */

/** A requirement ID as a phase file's *Requirements* table writes it, e.g. `PRD-07.R7`. */
const REQUIREMENT_ID = /PRD-\d+\.R\d+/g;

/**
 * Every requirement ID in the first column of the plan's *Requirements*
 * table, in order, each once. An ID named anywhere else is not claimed.
 */
export function claimedRequirements(phaseText: string): string[] {
  const lines = phaseText.split("\n");
  const start = lines.findIndex((line) => /^##\s+Requirements\s*$/.test(line));
  if (start === -1) return [];
  const ids: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (!line.startsWith("|")) continue;
    const firstCell = line.split("|")[1] ?? "";
    for (const [id] of firstCell.matchAll(REQUIREMENT_ID)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * The check script of one requirement: the file in `files` that lies directly
 * in the project's probe folder and whose name is the lowercased ID plus an
 * extension. `files` are paths from the repository's root, as git lists them.
 */
export function checkScriptOf(id: string, files: readonly string[]): string | undefined {
  const folder = `${PROBE_DIRECTORIES[0]}/`;
  const name = id.toLowerCase();
  return files.find((file) => {
    if (!file.startsWith(folder)) return false;
    const fileName = file.slice(folder.length);
    const dot = fileName.lastIndexOf(".");
    return !fileName.includes("/") && dot > 0 && fileName.slice(0, dot) === name;
  });
}

/** Runs one git command in the project and returns what it printed; throws when git fails. */
export type RunGit = (args: readonly string[]) => string;

/** One plan's requirements, each with its check script when it has one. */
export interface PlanChecks {
  /** The phase file's path in the repository. */
  phase: string;
  /** The pull request that brought the plan to the default branch, when its commit names one. */
  pullRequest?: number;
  checks: { id: string; script?: string }[];
}

/** The three test sets an update runs. */
export interface UpdateChecks {
  /** The project's `scripts.test` in `package.json`, when it has one. */
  testCommand: string | undefined;
  own: PlanChecks | undefined;
  arrived: PlanChecks[];
}

/** A phase file, directly in the phases folder: not a report, not a check script. */
const PHASE_FILE = /^doc\/plans\/phases\/phase-[^/]+\.md$/;

/** The pull request number in a merge commit's subject: `… (#215)` or `Merge pull request #215 …`. */
const PULL_REQUEST = [/\(#(\d+)\)\s*$/, /^Merge pull request #(\d+)/];

/** The part of `package.json` the test command is read from. */
const PackageJson = z.object({ scripts: z.record(z.string(), z.string()).optional() });

/** The phase files `git diff --diff-filter=A <range>` adds. */
function addedPhases(git: RunGit, range: string): string[] {
  return lines(git(["diff", "--name-only", "--diff-filter=A", range, "--", "doc/plans/phases/"]))
    .filter((path) => PHASE_FILE.test(path));
}

/** The non-empty lines of git's output. */
function lines(output: string): string[] {
  return output.split("\n").filter((line) => line !== "");
}

/**
 * The pull request each phase file arrived with, for the first-parent
 * commits of `range`: each commit's subject, and the phase files it added
 * against its first parent.
 */
function pullRequests(git: RunGit, range: string): Map<string, number> {
  const output = git([
    "log", "--first-parent", "--diff-merges=first-parent", "--diff-filter=A",
    "--name-only", "--format=%x01%s", range, "--", "doc/plans/phases/",
  ]);
  const found = new Map<string, number>();
  for (const entry of output.split("\x01").slice(1)) {
    const [subject = "", ...paths] = lines(entry);
    const number = PULL_REQUEST.map((pattern) => pattern.exec(subject)?.[1]).find((n) => n !== undefined);
    if (number === undefined) continue;
    for (const path of paths) found.set(path, Number(number));
  }
  return found;
}

/**
 * The three test sets an update runs, read from git in the project. `before`
 * is the branch's commit before the update merges the default branch in, so
 * the answer is the same before and after that merge.
 */
export function updateChecks(
  git: RunGit,
  options: { defaultBranch: string; before: string },
): UpdateChecks {
  const { before } = options;
  const target = `origin/${options.defaultBranch}`;
  const branchFiles = lines(git(["ls-tree", "-r", "--name-only", before]));
  const files = [...branchFiles, ...lines(git(["ls-tree", "-r", "--name-only", target]))];
  const planChecks = (ref: string, phase: string, pullRequest?: number): PlanChecks => ({
    phase,
    ...(pullRequest === undefined ? {} : { pullRequest }),
    checks: claimedRequirements(git(["show", `${ref}:${phase}`])).map((id) => {
      const script = checkScriptOf(id, files);
      return script === undefined ? { id } : { id, script };
    }),
  });

  const ownPhase = addedPhases(git, `${target}...${before}`)[0];
  const numbers = pullRequests(git, `${before}..${target}`);
  const arrived = addedPhases(git, `${before}...${target}`).map((phase) =>
    planChecks(target, phase, numbers.get(phase)),
  );
  return {
    testCommand: branchFiles.includes("package.json")
      ? PackageJson.parse(JSON.parse(git(["show", `${before}:package.json`]))).scripts?.["test"]
      : undefined,
    own: ownPhase === undefined ? undefined : planChecks(before, ownPhase),
    arrived,
  };
}
