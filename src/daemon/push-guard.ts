import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * A run's `git push` reaches its own work branch and nothing else
 * ([#85](https://github.com/fvermaut/timone/issues/85)).
 *
 * A boxed run pushed `STATUS.md` straight to a project's default branch. The
 * forge token it holds can write any branch, and nothing between the session
 * and the remote asked which branch a push was for. Only a named person's yes
 * lets work reach a default branch, so the check has to sit where every push
 * passes: git's own `pre-push` hook, switched on for the session's git by its
 * environment rather than by anything in the project's checkout.
 */

/** One line of what git hands a `pre-push` hook: what is pushed, and where to. */
export interface RefUpdate {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

/** A commit name of nothing but zeros: git's way of saying "delete this ref". */
const NO_COMMIT = /^0+$/;

/**
 * Why this push may not go ahead, or undefined when it may.
 *
 * **Every update has to be allowed, or none goes.** A non-zero exit from
 * `pre-push` refuses the whole push, so one update to the default branch
 * carried beside one to the work branch stops both — which is what is wanted:
 * a push the run did not mean to make is not half made.
 *
 * The words are read by the session that tried the push, and that session
 * acts on them. So they say where work may go, and never name the default
 * branch as a place to put anything.
 */
export function pushRefusal(
  updates: readonly RefUpdate[],
  workBranch: string | undefined,
): string | undefined {
  // A step that owns no branch — sorting a ticket, answering a question —
  // has nothing to push, and its work is what it says on the ticket.
  if (workBranch === undefined) {
    return updates.length === 0
      ? undefined
      : "Refused: this step has no work branch, so it pushes nothing to the project. " +
          "Say what you did on the ticket.";
  }
  const allowed = `refs/heads/${workBranch}`;
  const refused = updates.filter(
    (update) => update.remoteRef !== allowed || NO_COMMIT.test(update.localSha),
  );
  if (refused.length === 0) return undefined;

  const what = refused
    .map((update) =>
      NO_COMMIT.test(update.localSha)
        ? `deletes \`${update.remoteRef}\``
        : `goes to \`${update.remoteRef}\``,
    )
    .join(" and ");
  return (
    `Refused: this run may push only to \`${workBranch}\`, and this push ${what}. ` +
    "Nothing reaches the project's default branch without a person's yes. " +
    `Commit on \`${workBranch}\` and push that.`
  );
}

/** A commit name as git writes one: SHA-1, or SHA-256 in a repository that uses it. */
const OBJECT_NAME = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * Read what git hands a `pre-push` hook on stdin: one line per ref, each
 * `<local ref> <local sha> <remote ref> <remote sha>`.
 *
 * Throws on a line that is not that shape. Git never writes one, so a line
 * this cannot read means something is wrong with the guard itself — and the
 * caller refuses the push rather than guess.
 */
export function parsePrePushInput(text: string): RefUpdate[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const fields = line.trim().split(/\s+/);
      const [localRef, localSha, remoteRef, remoteSha] = fields;
      if (
        fields.length !== 4 ||
        localRef === undefined ||
        localSha === undefined ||
        remoteRef === undefined ||
        remoteSha === undefined ||
        !OBJECT_NAME.test(localSha) ||
        !OBJECT_NAME.test(remoteSha)
      ) {
        throw new Error(`not a line git writes to a pre-push hook: "${line}"`);
      }
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

/** A word the shell reads back exactly as it is written here. */
function shellWord(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}

/**
 * Every client-side hook git runs other than `pre-push`. Pointing
 * `core.hooksPath` at the guard takes the project's own hooks out of git's
 * sight, so each of these hands over to the project's hook of the same name.
 */
const FORWARDED_HOOKS = [
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
  "pre-commit",
  "pre-merge-commit",
  "prepare-commit-msg",
  "commit-msg",
  "post-commit",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "pre-auto-gc",
  "post-rewrite",
  "reference-transaction",
] as const;

/**
 * Where the repository keeps its own hooks: its **local** `core.hooksPath`
 * when it sets one, otherwise the hooks folder of its git directory. Only the
 * local value is read, because the value git sees is the guard's own. A
 * relative path is read from where git runs hooks — the top of the work
 * tree — which is how git itself reads it.
 */
const OWN_HOOKS =
  'own=$(git config --local --type=path --get core.hooksPath) ||' +
  ' own="$(git rev-parse --git-common-dir)/hooks"';

/** Write one hook file, executable. */
function writeHook(dir: string, name: string, lines: readonly string[]): void {
  const path = join(dir, name);
  writeFileSync(path, ["#!/bin/sh", ...lines, ""].join("\n"));
  chmodSync(path, 0o755);
}

/**
 * Where {@link installPushGuard} writes its `gh`: a folder of its own inside
 * the guard's directory, so that putting it on a session's `PATH` adds `gh`
 * and nothing else. The hooks' names are commands too — `pre-commit` is a
 * common tool — and must not shadow them.
 */
export function forgeGuardBin(dir: string): string {
  return join(resolve(dir), "bin");
}

/**
 * Write the guard's hooks into `dir`, and a `gh` into {@link forgeGuardBin},
 * and return the environment that makes git use the hooks.
 *
 * **The environment, not the checkout.** `core.hooksPath` set through
 * `GIT_CONFIG_COUNT` outranks the repository's own config, so a session cannot
 * switch the guard off by editing `.git/config`, and nothing about it is ever
 * written into the project. Only `git -c` and `git push --no-verify` outrank
 * it, and those are a session working to get around the guard, not one that
 * pushed to the wrong branch by mistake.
 *
 * The project's own hooks keep running: `pre-push` hands the same input to
 * the project's `pre-push` once the guard has passed it, and every other hook
 * name hands over its arguments and input unchanged.
 *
 * **The `gh` is the same guard for the forge's API** (`forge-guard.ts`): a
 * run cannot merge, or write to any branch but its own, through `gh` either.
 * It is used by whoever puts {@link forgeGuardBin} first on the session's
 * `PATH`. It checks the call with Timone's own command, then runs the real
 * `gh`, looked up on this process's own `PATH` — the one from before that
 * folder was put in front — so the lookup never finds the wrapper itself.
 */
export function installPushGuard(
  dir: string,
  options: { workBranch?: string; cli: string },
): Record<string, string> {
  const at = resolve(dir);
  mkdirSync(at, { recursive: true });
  const branch =
    options.workBranch === undefined ? "" : ` --branch ${shellWord(options.workBranch)}`;
  writeHook(at, "pre-push", [
    "# Written by Timone: this run may push to its own work branch and nothing else.",
    // Kept in a file because two commands read it: the guard, then the
    // project's own hook, which must see exactly what git sent.
    'input=$(mktemp) || exit 1',
    `trap 'rm -f "$input"' EXIT`,
    'cat > "$input"',
    `node ${shellWord(options.cli)} guardrails pre-push${branch} < "$input" || exit 1`,
    OWN_HOOKS,
    '[ -x "$own/pre-push" ] || exit 0',
    '"$own/pre-push" "$@" < "$input"',
  ]);
  mkdirSync(forgeGuardBin(at), { recursive: true });
  writeHook(forgeGuardBin(at), "gh", [
    "# Written by Timone: this run may not merge, or write to any branch but its own, through gh.",
    // Nothing on stdin for the check, which reads none: it is the real
    // `gh`'s (`--input -`).
    `node ${shellWord(options.cli)} guardrails forge-call${branch} -- "$@" < /dev/null || exit 1`,
    `real=$(PATH=${shellWord(process.env.PATH ?? "")}; command -v gh) || {`,
    '  echo "gh is not installed on this machine." >&2',
    "  exit 127",
    "}",
    'exec "$real" "$@"',
  ]);
  for (const name of FORWARDED_HOOKS) {
    writeHook(at, name, [
      `# Written by Timone: runs the project's own ${name} hook, if it has one.`,
      OWN_HOOKS,
      `[ -x "$own/${name}" ] || exit 0`,
      `exec "$own/${name}" "$@"`,
    ]);
  }
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.hooksPath",
    GIT_CONFIG_VALUE_0: at,
  };
}
