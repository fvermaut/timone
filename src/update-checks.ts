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
 * extension. The name may also have a dash for the ID's dot
 * (`prd-18-r12.mjs`); when both names are there, the dotted one is the
 * script. `files` are paths from the repository's root, as git lists them.
 */
export function checkScriptOf(id: string, files: readonly string[]): string | undefined {
  const folder = `${PROBE_DIRECTORIES[0]}/`;
  const name = id.toLowerCase();
  const named = (wanted: string) =>
    files.find((file) => {
      if (!file.startsWith(folder)) return false;
      const fileName = file.slice(folder.length);
      const dot = fileName.lastIndexOf(".");
      return !fileName.includes("/") && dot > 0 && fileName.slice(0, dot) === wanted;
    });
  return named(name) ?? named(name.replace(".", "-"));
}

/** A check script's file name: `prd-18.r12` or `prd-18-r12`, plus an extension. */
const CHECK_SCRIPT_NAME = /^prd-(\d+)[.-]r(\d+)\.[^.]+$/;

/**
 * The requirement a check script checks, read from its path: `PRD-18.R12`
 * for `prd-18.r12.mjs` or `prd-18-r12.mjs` directly in either probe folder.
 * Undefined for any other file, such as a helper or a file in a sub-folder.
 */
export function requirementOfCheckScript(path: string): string | undefined {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  if (!PROBE_DIRECTORIES.some((probes) => probes === folder)) return undefined;
  const match = CHECK_SCRIPT_NAME.exec(path.slice(slash + 1));
  return match === null ? undefined : `PRD-${match[1]}.R${match[2]}`;
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
  /** The commands that run the project's tests, in the order to run them; none when it has none. */
  testCommands: string[];
  own: PlanChecks | undefined;
  arrived: PlanChecks[];
}

/** A phase file, directly in the phases folder: not a report, not a check script. */
const PHASE_FILE = /^doc\/plans\/phases\/phase-[^/]+\.md$/;

/** The pull request number in a merge commit's subject: `… (#215)` or `Merge pull request #215 …`. */
const PULL_REQUEST = [/\(#(\d+)\)\s*$/, /^Merge pull request #(\d+)/];

/** The part of `package.json` the test commands are read from. */
const PackageJson = z.object({ scripts: z.record(z.string(), z.string()).optional() });

/**
 * The commands that run the project's tests, from its `package.json` scripts:
 * `npm test` when it has `scripts.test`. Otherwise `npm run <name>` for each
 * script whose name starts with `test:`, in the order the file lists them,
 * leaving out any with a `watch` part, which does not end.
 */
function testCommandsOf(scripts: Record<string, string>): string[] {
  if (scripts["test"] !== undefined) return ["npm test"];
  return Object.keys(scripts)
    .filter((name) => name.startsWith("test:") && !name.split(":").includes("watch"))
    .map((name) => `npm run ${name}`);
}

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
  const scripts = branchFiles.includes("package.json")
    ? (PackageJson.parse(JSON.parse(git(["show", `${before}:package.json`]))).scripts ?? {})
    : {};
  return {
    testCommands: testCommandsOf(scripts),
    own: ownPhase === undefined ? undefined : planChecks(before, ownPhase),
    arrived,
  };
}
