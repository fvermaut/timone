import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Numbered files — phases, ADRs, triage records, PRDs — and the one way a
 * session gets a number for a new one: {@link reserveNumber}.
 */

/** The kinds of numbered file, in the order a person is told them. */
export const NUMBER_KINDS = ["phase", "adr", "triage", "prd"] as const;

/** One kind of numbered file. */
export type NumberKind = (typeof NUMBER_KINDS)[number];

/** Whether `value` names a kind of numbered file. */
export function isNumberKind(value: string): value is NumberKind {
  return (NUMBER_KINDS as readonly string[]).includes(value);
}

/** Where the files of a kind live, how their number is read, and its width. */
interface KindRule {
  /** The folder, relative to the checkout. Subfolders never count. */
  folder: string;
  /** Matches a file name of the kind; group 1 is its number. */
  pattern: RegExp;
  /** Digits the number is padded to; a larger number simply grows. */
  width: number;
}

const KINDS: Record<NumberKind, KindRule> = {
  phase: { folder: "doc/plans/phases", pattern: /^phase-(\d+)\.md$/, width: 2 },
  adr: { folder: "doc/adr", pattern: /^(\d{4})-/, width: 4 },
  triage: { folder: "doc/triage", pattern: /^(\d{3})-/, width: 3 },
  prd: { folder: "doc/specs/prd", pattern: /^prd-(\d+)-/, width: 2 },
};

/** `n` written the way the kind writes it: `7` → `07` for a phase. */
function padded(kind: NumberKind, n: number): string {
  return String(n).padStart(KINDS[kind].width, "0");
}

/** What a git command did: its exit code and what it printed. */
interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Run git in `dir` without a shell, feeding it `input` on stdin, and report
 * what it did whatever the exit code. Failing to start git at all (a folder
 * that does not exist) is reported the same way, with exit code -1.
 */
function runGit(dir: string, args: string[], input = ""): Promise<GitResult> {
  return new Promise((resolvePromise) => {
    const child = spawn("git", args, { cwd: dir });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolvePromise({ code: -1, stdout, stderr: stderr + error.message });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

/** git's own words for a result: stderr, else stdout, trimmed. */
function gitWords(result: GitResult): string {
  return result.stderr.trim() || result.stdout.trim() || `exit code ${result.code}`;
}

/** Run git in `dir` and return its stdout; throw with git's words if it fails. */
async function git(dir: string, args: string[], input = ""): Promise<string> {
  const result = await runGit(dir, args, input);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${gitWords(result)}`);
  }
  return result.stdout;
}

/** The numbers of `kind` among these file names; other names are ignored. */
function numbersIn(kind: NumberKind, names: string[]): number[] {
  const numbers: number[] = [];
  for (const name of names) {
    const match = KINDS[kind].pattern.exec(name);
    if (match?.[1] !== undefined) numbers.push(Number(match[1]));
  }
  return numbers;
}

/**
 * The numbers of `kind` in the kind's folder on every branch of the remote,
 * as the last fetch saw them.
 */
async function numbersOnRemoteBranches(
  dir: string,
  kind: NumberKind,
): Promise<number[]> {
  const refs = (
    await git(dir, ["for-each-ref", "--format=%(refname)", "refs/remotes/origin/"])
  )
    .split("\n")
    .filter((ref) => ref !== "" && ref !== "refs/remotes/origin/HEAD");
  const numbers: number[] = [];
  for (const ref of refs) {
    const paths = await git(dir, [
      "ls-tree",
      "--name-only",
      ref,
      "--",
      `${KINDS[kind].folder}/`,
    ]);
    const names = paths
      .split("\n")
      .filter((path) => path !== "")
      .map((path) => basename(path));
    numbers.push(...numbersIn(kind, names));
  }
  return numbers;
}

/**
 * The numbers of `kind` in the kind's folder of the checkout on disk,
 * committed or not.
 */
function numbersOnDisk(dir: string, kind: NumberKind): number[] {
  const folder = join(dir, KINDS[kind].folder);
  return existsSync(folder) ? numbersIn(kind, readdirSync(folder)) : [];
}

/** The ref that holds a reservation of `kind` numbered `number` (padded). */
function reservationRef(kind: NumberKind, number: string): string {
  return `refs/timone/numbers/${kind}/${number}`;
}

/** The numbers of `kind` already reserved on the remote. */
async function numbersReserved(dir: string, kind: NumberKind): Promise<number[]> {
  const listed = await git(dir, [
    "ls-remote",
    "origin",
    `refs/timone/numbers/${kind}/*`,
  ]);
  const numbers: number[] = [];
  for (const line of listed.split("\n")) {
    const match = /\trefs\/timone\/numbers\/([a-z]+)\/(\d+)$/.exec(line);
    if (match?.[1] === kind && match[2] !== undefined) {
      numbers.push(Number(match[2]));
    }
  }
  return numbers;
}

/** Whether the remote holds a reservation of `kind` numbered `number`. */
async function isReserved(
  dir: string,
  kind: NumberKind,
  number: string,
): Promise<boolean> {
  const listed = await git(dir, ["ls-remote", "origin", reservationRef(kind, number)]);
  return listed.trim() !== "";
}

/**
 * Try to reserve `number` of `kind` by pushing a commit to its ref: `true`
 * when this push made the ref, `false` when the number was already taken.
 * Throws with git's words when the push failed for any other reason.
 */
async function tryReserve(
  dir: string,
  kind: NumberKind,
  number: string,
  note: string,
): Promise<boolean> {
  const tree = (await git(dir, ["mktree"])).trim();
  // The random line makes every reservation commit a commit of its own. Two
  // commits with the same message, tree and identity, made in the same second,
  // are one commit, and a push of it to a ref that already holds it reports
  // success while reserving nothing.
  const nonce = randomBytes(8).toString("hex");
  const message = `Reserve ${kind} ${number}\n\n${note}\nnonce: ${nonce}\n`;
  const commit = (await git(dir, ["commit-tree", tree, "-F", "-"], message)).trim();
  const ref = reservationRef(kind, number);
  const pushed = await runGit(dir, ["push", "--porcelain", "origin", `${commit}:${ref}`]);
  // Exit 0 alone is not enough: a push of a commit the ref already holds
  // exits 0 too, reporting "up to date". Only a `*` line made the ref.
  const madeRef = pushed.stdout
    .split("\n")
    .some((line) => line.startsWith("*\t") && line.includes(`:${ref}\t`));
  if (pushed.code === 0 && madeRef) return true;
  if (await isReserved(dir, kind, number)) return false;
  throw new Error(`Could not reserve ${kind} ${number}: ${gitWords(pushed)}`);
}

/** The note a reservation carries when the caller gives none. */
function defaultNote(): string {
  const branch = process.env.TIMONE_RUN_BRANCH;
  return branch !== undefined && branch !== ""
    ? `for ${branch}`
    : "for a session run by hand";
}

/** How many numbers {@link reserveNumber} tries before it gives up. */
const MAX_TRIES = 100;

/**
 * Reserve the next number of `kind` for the project checked out at `dir`,
 * and return it padded.
 *
 * The number is one above the highest of the kind found in the kind's folder
 * on every branch of the remote, in the checkout's own folder on disk, and
 * among the reservations already on the remote. It is reserved by pushing a
 * commit with an empty tree to `refs/timone/numbers/<kind>/<number>`: the
 * remote creates a ref once, so of several sessions pushing the same number
 * exactly one gets it, and the others move on to the next.
 *
 * Nothing in the checkout changes: no branch, no file, no local ref. Throws
 * with git's own words when git fails for any reason other than the number
 * being taken; it never answers with a number it did not reserve.
 */
export async function reserveNumber(
  dir: string,
  kind: NumberKind,
  options: { note?: string } = {},
): Promise<string> {
  await git(dir, ["fetch", "--quiet", "--prune", "origin"]);
  const highest = Math.max(
    0,
    ...(await numbersOnRemoteBranches(dir, kind)),
    ...numbersOnDisk(dir, kind),
    ...(await numbersReserved(dir, kind)),
  );
  const note = options.note ?? defaultNote();
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const number = padded(kind, highest + 1 + tries);
    if (await tryReserve(dir, kind, number, note)) return number;
  }
  throw new Error(
    `Could not reserve a ${kind} number: tried ${MAX_TRIES} numbers from ` +
      `${padded(kind, highest + 1)} and every one was taken.`,
  );
}
