import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Error shape thrown by promisified execFile for a failing process. */
interface ExecFileError extends Error {
  stderr?: string;
  stdout?: string;
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
    // stdout before the exception's own text, because a conflicted `git
    // merge` reports what conflicted on *stdout* and leaves stderr empty —
    // and the reason for a refused merge is what goes on the ticket.
    const said = [
      (error as ExecFileError).stderr?.trim(),
      (error as ExecFileError).stdout?.trim(),
    ].find((output) => output !== undefined && output !== "");
    const reason =
      said ?? (error instanceof Error ? error.message : String(error));
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

/** What {@link mergeIntoDefault} answers: it merged, or it did not and why. */
export type MergeOutcome =
  | { merged: true; into: string }
  | { merged: false; reason: string };

/**
 * True when a merge is half-done in `dir` — the tree carries `MERGE_HEAD`.
 * Asked rather than assumed, so unwinding a refused merge never has to
 * swallow the "there is no merge to abort" error of the case where the
 * merge never started.
 */
async function mergeInProgress(dir: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", "MERGE_HEAD"], dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge `branch` into the repository's default branch and push it — the one
 * place this system writes to a default branch without a pull request, and
 * the only merge it performs other than {@link fastForward}'s pull onto an
 * upstream. It exists for one caller: the breakdown gate's approval merging
 * chunk zero (ADR-0030 D2, amending ADR-0015). It is not a general commit or
 * push primitive — it authors no content, takes no message, and can move
 * nothing but the default branch, and nothing but `branch`'s own commits onto
 * it.
 *
 * A refusal comes back as a result rather than an exception, because the
 * caller has to put the reason on a ticket: a dirty tree (which would be
 * carried into the merge and pushed), and a merge git will not make. Anything
 * else — a checkout or a push git rejects — throws with git's stderr, as
 * every other function in this module does.
 */
export async function mergeIntoDefault(
  dir: string,
  branch: string,
  message: string,
): Promise<MergeOutcome> {
  if (!(await isClean(dir))) {
    return {
      merged: false,
      reason: `the working tree at ${dir} has uncommitted changes`,
    };
  }

  await fetch(dir);
  const into = await defaultBranch(dir);
  await runGit(["checkout", into], dir);
  // The checkout's default branch is as old as the last time anything pulled
  // it, and every chunk's pull request merges on the remote. Merging into a
  // stale branch would produce a push the remote rejects.
  await fastForward(dir);

  try {
    // `-m` rather than `--no-edit`, because a merge git records as a commit
    // is a commit this system authored, and ADR-0019 says every one of those
    // names the stage that made it. The caller supplies the whole message,
    // trailers included; git uses it only when it actually creates a commit,
    // so a fast-forward still carries no message of its own and needs none —
    // the commits it moves are sessions' own, already trailed.
    //
    // Found by the guardrail check on 2026-08-15, after the first live merge
    // landed an untrailed `Merge branch …` on a client's default branch.
    await runGit(["merge", "--no-edit", "-m", message, "--", branch], dir);
  } catch (error) {
    if (await mergeInProgress(dir)) await runGit(["merge", "--abort"], dir);
    const reason = error instanceof Error ? error.message : String(error);
    return { merged: false, reason };
  }

  await runGit(["push", "origin", into], dir);
  return { merged: true, into };
}
