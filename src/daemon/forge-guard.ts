/**
 * A run cannot write to a branch or merge through the forge's API either
 * ([#85](https://github.com/fvermaut/timone/issues/85)).
 *
 * The push guard (`push-guard.ts`) keeps a run's `git push` on its own work
 * branch. The forge token the run holds can do the same work without git:
 * `gh pr merge`, or a `PUT` to `repos/<o>/<r>/contents/STATUS.md`, writes to
 * the default branch with no push at all. Only a named person's yes lets work
 * reach a default branch, so every `gh` the run calls is checked here first.
 *
 * The daemon's own `gh` calls are made by the daemon process, not by the run,
 * and never pass through this check.
 */

/** A `gh api` flag that takes a value, so the next word is not the path. */
const VALUE_FLAGS = new Set([
  "-X", "--method",
  "-f", "--raw-field",
  "-F", "--field",
  "--input",
  "-H", "--header",
  "-q", "--jq",
  "-t", "--template",
  "-p", "--preview",
  "--hostname",
  "--cache",
]);

/** The flags whose value is a `key=value` field of the request. */
const FIELD_FLAGS = new Set(["-f", "--raw-field", "-F", "--field"]);

/** What a `gh api` command line asks the forge for. */
interface ApiCall {
  /** As written, upper-cased; undefined when no `-X`/`--method` was given. */
  method: string | undefined;
  /** Every word that is not a flag or a flag's value. One of them is the path. */
  words: string[];
  /** Every `key=value` field, in order. */
  fields: { key: string; value: string }[];
  /** Whether the body comes from `--input`, which the rule cannot read. */
  input: boolean;
}

/**
 * Read a `gh api` command line (the words after `api`). Both spellings of a
 * flag's value are read: `-X PUT` and `-XPUT`, `--method PUT` and
 * `--method=PUT`. Every word that is not a flag is kept, not only the first,
 * so a flag this does not know cannot hide the path behind it.
 */
function readApiCall(args: readonly string[]): ApiCall {
  const call: ApiCall = { method: undefined, words: [], fields: [], input: false };
  const take = (flag: string, value: string): void => {
    if (flag === "-X" || flag === "--method") call.method = value.toUpperCase();
    if (flag === "--input") call.input = true;
    if (FIELD_FLAGS.has(flag)) {
      const at = value.indexOf("=");
      call.fields.push(
        at === -1
          ? { key: value, value: "" }
          : { key: value.slice(0, at), value: value.slice(at + 1) },
      );
    }
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--") {
      call.words.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      const at = arg.indexOf("=");
      take(arg.slice(0, at), arg.slice(at + 1));
    } else if (VALUE_FLAGS.has(arg)) {
      take(arg, args[i + 1] ?? "");
      i += 1;
    } else if (/^-[A-Za-z]./.test(arg) && VALUE_FLAGS.has(arg.slice(0, 2))) {
      // `-XPUT`, and `-X=PUT`, which `gh` reads the same way.
      take(arg.slice(0, 2), arg.slice(2).replace(/^=/, ""));
    } else if (!arg.startsWith("-")) {
      call.words.push(arg);
    }
  }
  return call;
}

/**
 * Whether the call writes. `gh` sends `GET` unless told otherwise, and sends
 * `POST` when it is given a field or an `--input` and no method.
 */
function writes(call: ApiCall): boolean {
  if (call.method !== undefined) return call.method !== "GET";
  return call.fields.length > 0 || call.input;
}

/**
 * The paths that move a branch or merge, under `repos/<o>/<r>/`. The path may
 * start with `/`, or be a whole URL, so it is matched wherever `repos/` starts
 * a segment. Anything after `?` is not part of the path.
 */
const MERGES = /(?:^|\/)repos\/[^/]+\/[^/]+\/merges\/?$/i;
const PULL_MERGE = /(?:^|\/)repos\/[^/]+\/[^/]+\/pulls\/\d+\/merge\/?$/i;
const REFS = /(?:^|\/)repos\/[^/]+\/[^/]+\/git\/refs(?:\/|$)/i;
const CONTENTS = /(?:^|\/)repos\/[^/]+\/[^/]+\/contents(?:\/|$)/i;

/** The GraphQL mutations that merge or move a branch. */
const MUTATIONS =
  /\b(mergePullRequest|enablePullRequestAutoMerge|mergeBranch|createCommitOnBranch|updateRefs|updateRef|createRef|deleteRef)\b/;

/** What a refused call does, in words, and the rule it breaks. */
interface Refused {
  /** The call, as the refusal names it. */
  call: string;
  /** What it does, to finish "`<call>` …". */
  does: string;
  /** True when the call merges, which no run ever does whatever its branch. */
  merges: boolean;
}

/** What `gh api` would do that a run may not, or undefined. */
function refusedApiCall(
  args: readonly string[],
  workBranch: string | undefined,
): Refused | undefined {
  const call = readApiCall(args);
  const paths = call.words.map((word) => word.split("?")[0]!);

  if (paths.includes("graphql") || paths.includes("/graphql")) {
    const queries = call.fields.filter((field) => field.key === "query");
    // A query `gh` reads from a file (`--input`, or `-F query=@file`) is one
    // this cannot see, so it cannot say the query is harmless.
    if (call.input || queries.some((field) => field.value.startsWith("@"))) {
      return {
        call: "`gh api graphql`",
        does: "sends a query from a file the guard cannot read",
        merges: false,
      };
    }
    for (const query of queries) {
      const mutation = MUTATIONS.exec(query.value)?.[1];
      if (mutation === undefined) continue;
      return {
        call: `the GraphQL mutation \`${mutation}\``,
        does: /PullRequest/.test(mutation)
          ? "merges a pull request"
          : mutation === "mergeBranch"
            ? "merges one branch into another on the forge"
            : "moves a branch on the forge",
        merges: /PullRequest/.test(mutation),
      };
    }
    return undefined;
  }

  if (!writes(call)) return undefined;
  const method = call.method ?? "POST";
  for (const path of paths) {
    const name = `\`gh api -X ${method} ${path}\``;
    if (PULL_MERGE.test(path)) return { call: name, does: "merges a pull request", merges: true };
    if (MERGES.test(path)) {
      return { call: name, does: "merges one branch into another on the forge", merges: false };
    }
    if (REFS.test(path)) return { call: name, does: "moves a branch on the forge", merges: false };
    if (CONTENTS.test(path)) {
      // A body from `--input` is not read; the fields are then sent in the
      // query string, so a `branch` field among them says nothing about it.
      const branches = call.input
        ? []
        : call.fields.filter((field) => field.key === "branch").map((field) => field.value);
      if (branches.length > 0 && branches.every((branch) => branch === workBranch)) {
        continue;
      }
      return {
        call: name,
        does:
          branches.length === 0
            ? "writes a file without naming a branch, which the forge takes as the default branch"
            : `writes a file to the branch \`${branches.at(-1)}\``,
        merges: false,
      };
    }
  }
  return undefined;
}

/**
 * The command's words — `pr merge`, `repo sync` — with the flags left out.
 * `gh pr --repo o/r merge` is a merge too, so `-R`/`--repo` and its value
 * are skipped wherever they are.
 */
function commandWords(args: readonly string[]): string[] {
  const words: string[] = [];
  for (let i = 0; i < args.length && words.length < 2; i += 1) {
    const arg = args[i]!;
    if (arg === "-R" || arg === "--repo") i += 1;
    else if (!arg.startsWith("-")) words.push(arg);
  }
  return words;
}

/**
 * Why this `gh` call may not run, or undefined when it may. `args` is the
 * command line without the `gh`.
 *
 * Refused: merging a pull request in any form — the machine never merges
 * one (ADR-0060 D2); `gh repo sync`, which moves a branch on the forge; an
 * API call that writes to a merge, a ref, or a file on any branch but the
 * run's own; and a GraphQL mutation that merges or moves a branch. Reading,
 * commenting, labelling, opening a pull request and editing an issue are
 * allowed.
 *
 * The words are read by the session that made the call, and that session
 * acts on them. So they say where work may go, in the push guard's words,
 * and never name the default branch as a place to put anything.
 */
export function forgeCallRefusal(
  args: readonly string[],
  workBranch: string | undefined,
): string | undefined {
  const [command, sub] = commandWords(args);
  const refused: Refused | undefined =
    command === "pr" && sub === "merge"
      ? { call: "`gh pr merge`", does: "merges a pull request", merges: true }
      : command === "repo" && sub === "sync"
        ? { call: "`gh repo sync`", does: "moves a branch on the forge", merges: false }
        : command === "api"
          ? refusedApiCall(args.slice(args.indexOf("api") + 1), workBranch)
          : undefined;
  if (refused === undefined) return undefined;

  // A step that owns no branch — sorting a ticket, answering a question —
  // writes nothing to the project, and its work is what it says on the ticket.
  const rule = refused.merges
    ? "a run never merges a pull request"
    : workBranch === undefined
      ? "this step has no work branch, so it writes nothing to the project"
      : `this run may write only to \`${workBranch}\``;
  const next =
    workBranch === undefined
      ? "Say what you did on the ticket."
      : `Commit on \`${workBranch}\` and push that.`;
  return (
    `Refused: ${refused.call} ${refused.does}, and ${rule}. ` +
    "Nothing reaches the project's default branch without a person's yes. " +
    next
  );
}
