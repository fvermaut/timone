import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Error shape thrown by promisified execFile for a failing process. */
interface ExecFileError extends Error {
  stderr?: string;
}

/**
 * Run a git command (never through a shell — arguments are passed verbatim)
 * and return its stdout. Throws an Error carrying the git stderr in its
 * message when the command fails.
 */
async function runGit(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      args,
      cwd === undefined ? {} : { cwd },
    );
    return stdout;
  } catch (error) {
    const stderr = (error as ExecFileError).stderr?.trim();
    const reason =
      stderr !== undefined && stderr !== ""
        ? stderr
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`git ${args.join(" ")} failed: ${reason}`);
  }
}

/** Clone `repoUrl` into `dir` (leading directories are created by git). */
export async function clone(repoUrl: string, dir: string): Promise<void> {
  await runGit(["clone", "--", repoUrl, dir]);
}

/**
 * True when `dir` is itself the top level of a git working tree. A plain
 * directory that merely sits inside some outer repository does not count.
 */
export async function isGitRepo(dir: string): Promise<boolean> {
  let toplevel: string;
  try {
    toplevel = (await runGit(["rev-parse", "--show-toplevel"], dir)).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not a git repository")) return false;
    throw error;
  }
  return realpathSync(toplevel) === realpathSync(dir);
}

/** True when the working tree has no staged, unstaged or untracked changes. */
export async function isClean(dir: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], dir);
  return status.trim() === "";
}

/** Name of the currently checked-out branch (or "HEAD" when detached). */
export async function currentBranch(dir: string): Promise<string> {
  return (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], dir)).trim();
}

/**
 * Name of the remote's default branch, read from the local
 * `refs/remotes/origin/HEAD` symref (set by `git clone`), falling back to
 * asking the remote via `git remote show origin`.
 */
export async function defaultBranch(dir: string): Promise<string> {
  try {
    const ref = (
      await runGit(["symbolic-ref", "refs/remotes/origin/HEAD"], dir)
    ).trim();
    return ref.replace(/^refs\/remotes\/origin\//, "");
  } catch {
    const output = await runGit(["remote", "show", "origin"], dir);
    const match = /HEAD branch: (\S+)/.exec(output);
    if (match === null) {
      throw new Error(
        `git remote show origin did not report a HEAD branch for ${dir}`,
      );
    }
    return match[1];
  }
}

/** Fetch from the default remote. */
export async function fetch(dir: string): Promise<void> {
  await runGit(["fetch"], dir);
}

/**
 * Fast-forward the current branch onto its upstream (`git merge --ff-only
 * @{u}`). Returns whether HEAD actually moved; throws (with git's stderr)
 * when a fast-forward is not possible.
 */
export async function fastForward(dir: string): Promise<{ updated: boolean }> {
  const before = (await runGit(["rev-parse", "HEAD"], dir)).trim();
  await runGit(["merge", "--ff-only", "@{u}"], dir);
  const after = (await runGit(["rev-parse", "HEAD"], dir)).trim();
  return { updated: before !== after };
}
