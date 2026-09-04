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

/**
 * Where `dir` was cloned from and which commit it stands on — the two things
 * a container needs in order to rebuild it
 * ([ADR-0041](../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D1).
 *
 * The commit is asked for in full and never abbreviated: a run is pinned to
 * this value, and a short name is ambiguous by design.
 *
 * Undefined when `dir` is not a checkout, has no `origin`, or carries no
 * commit yet — three different ways of saying "there is no version here",
 * none of which is worth telling the three apart for.
 */
export async function checkoutVersion(
  dir: string,
): Promise<{ remote: string; commit: string } | undefined> {
  try {
    const remote = (await runGit(["remote", "get-url", "origin"], dir)).trim();
    const commit = (await runGit(["rev-parse", "HEAD"], dir)).trim();
    if (remote === "" || commit === "") return undefined;
    return { remote, commit };
  } catch {
    return undefined;
  }
}

/**
 * Whether `commit` is one the remote already carries.
 *
 * **A boxed run is built from the remotes** ([ADR-0041](../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)
 * D1), so a commit the daemon is standing on but nobody has pushed is simply
 * not in the clone the box makes. Git's own words for that are `fatal:
 * reference is not a tree` — a true sentence naming no cause and suggesting
 * no action. It happened on the first real boxed session, on 2026-08-22,
 * because the daemon's branch was unpushed, and **it will happen to fvermaut
 * the first time he runs a boxed daemon on unmerged work.**
 *
 * Read from the remote **tracking refs**, which is what a `git push` or a
 * `git fetch` leaves behind. That makes this an offline question about what
 * this checkout last saw, not a network call on every spawn — and being a
 * cycle out of date errs the safe way: it refuses a run that would have
 * worked, rather than starting one that cannot.
 *
 * False for anything it cannot answer — a directory that is no checkout, a
 * commit that does not exist. The caller's next move is to refuse, and
 * refusing on an unanswerable question is the conservative direction.
 */
export async function isCommitOnRemote(
  dir: string,
  commit: string,
): Promise<boolean> {
  try {
    const branches = await runGit(
      ["branch", "--remotes", "--contains", commit],
      dir,
    );
    return branches.trim() !== "";
  } catch {
    return false;
  }
}

/**
 * The paths in `dir` carrying changes that are not committed — staged,
 * unstaged and untracked alike — renames counted at their destination.
 *
 * **Files git was told to ignore are never among them.** That is not a filter
 * applied here: `git status --porcelain` leaves them out, which is what makes
 * `node_modules/` and `dist/` not work anybody has to commit.
 *
 * Throws when `dir` is not a checkout, as everything else in this module
 * does. Empty means the tree is clean, and only that.
 */
export async function uncommittedFiles(dir: string): Promise<string[]> {
  const status = await runGit(["status", "--porcelain"], dir);
  return status
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const path = line.slice(3);
      const arrow = path.indexOf(" -> ");
      return arrow === -1 ? path : path.slice(arrow + 4);
    })
    .map((path) => path.replace(/^"|"$/g, ""));
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

/**
 * The sha the remote's default branch points at, or undefined when the
 * remote could not be asked.
 *
 * **`ls-remote`, not `fetch`.** This runs against fvermaut's own checkout on
 * every poll cycle, and a fetch would write remote-tracking refs into a
 * folder he has open. Asking costs one network call and changes nothing on
 * disk.
 *
 * **Undefined means "I could not ask", and callers must not read it as "up
 * to date".** A daemon on a train has no opinion about whether it is running
 * old code, and saying it is current when it could not look is worse than
 * saying nothing ([timone#5](https://github.com/fvermaut/timone/issues/5)).
 */
export async function remoteDefaultTip(
  dir: string,
): Promise<string | undefined> {
  try {
    const branch = await defaultBranch(dir);
    const output = await runGit(
      ["ls-remote", "origin", `refs/heads/${branch}`],
      dir,
    );
    const sha = output.trim().split(/\s+/)[0];
    return sha === undefined || sha === "" ? undefined : sha;
  } catch {
    return undefined;
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

// ---------------------------------------------------------------------------
// `mergeIntoDefault` lived here, with `mergeInProgress` beside it. It was the
// one place this system wrote to a default branch without a pull request, and
// it did it by checking out and merging **inside `projects/<name>`** — the
// folder fvermaut has open in an editor.
//
// Phase 30's 30c moved that merge to the forge and 30l deleted this one, last,
// after the new path had carried real traffic: a real two-parent merge commit
// on `fvermaut/scratch-app`, authored by `timone-agent`, watched on
// 2026-08-22.
//
// **Nothing else in this file went with it, deliberately.** `clone`,
// `isGitRepo`, `isClean`, `currentBranch`, `defaultBranch`, `fetch` and
// `fastForward` all keep `workspace sync` as their caller — fvermaut's own
// command, which 30d went out of its way to preserve — and `isCommitOnRemote`
// is 30k's. An agent grepping for callers, finding only `workspace.ts` and
// deleting the file, would break the command the phase protected.
//
// The `MergeOutcome` type moved to `src/adapters/ticketing.ts` at 30c, where
// the forge merge that replaced this one lives.
// ---------------------------------------------------------------------------

