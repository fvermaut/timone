import type { PipelineStage } from "./pipeline.js";
import { readShellCommand } from "./shell-words.js";

/**
 * The two directories a builder may never open
 * ([ADR-0048](../../doc/adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4).
 *
 * One per repository: the project's own probes, and Timone's shared baseline
 * probes. A run's container clones both repositories (ADR-0041 D1), so there
 * is no hiding place — the guard is what keeps stage 6 out, not the layout.
 */
export const PROBE_DIRECTORIES = [
  "doc/plans/phases/probes",
  "standards/baseline/probes",
] as const;

/** Stages that write application code, and so must not see what checks it. */
const BUILD_STAGES: readonly PipelineStage[] = ["execution", "remediation"];

/**
 * The stages that run the checks, and so may read the probes. Verification
 * owns them and writes them. The update runs them after it brings a branch
 * level with the default branch
 * ([ADR-0066](../../doc/adr/0066-the-update-is-a-step-the-runner-starts-when-an-open-pull-request-falls-behind.md)
 * D4); the fix context it hands a failure to is kept out by its brief, not
 * by this hook, as the check's own fix context is.
 */
const CHECKING_STAGES: readonly PipelineStage[] = ["verification", "update"];

/**
 * Every string anywhere in a tool's input.
 *
 * Recursive rather than field-by-field on purpose: the guard must hold for
 * tools it was not written against. A new tool with a new field name is
 * covered the day it ships, which a list of known keys would not be.
 */
function strings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) strings(item, found);
  } else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) strings(item, found);
  }
  return found;
}

/**
 * A path as it reads with doubled slashes made single and `.` and `..`
 * segments resolved: `a//b`, `a/./b` and `a/x/../b` all read as `a/b`. Only
 * the text is changed; nothing is looked up on disk.
 */
function normalisePath(text: string): string {
  const kept: string[] = [];
  text.split("/").forEach((segment, at) => {
    if (segment === "" && at > 0) return;
    if (segment === ".") return;
    const last = kept[kept.length - 1];
    if (segment === ".." && last !== undefined && last !== "" && last !== "..") {
      kept.pop();
      return;
    }
    kept.push(segment);
  });
  return kept.join("/");
}

/** Whether the text names a probe directory, however its path is spelled. */
const namesProbeDirectory = (text: string): boolean => {
  const path = normalisePath(text);
  return PROBE_DIRECTORIES.some((directory) => path.includes(directory));
};

/**
 * Whether a tool call names a probe directory anywhere in its input.
 *
 * This is the rule for a tool {@link reachesProbeDirectory} has no rule for,
 * for a call whose tool is not known, for a shell command the reader cannot
 * read to the end, and for a shell command that hands code to an interpreter
 * as text.
 *
 * Substring matching on the directory path, which is blunt in one known
 * direction: a shell command that reaches the directory in two steps (`cd
 * doc/plans/phases && cat probes/x`) does not match. Nor does a path held in
 * a variable, a path built from pieces, a wildcard, or a search of the whole
 * project. That is accepted. The guard exists to stop the accident and the
 * idle glance, and a builder assembling a path in pieces to get around a
 * refusal it has been told about has left the territory a hook can police.
 *
 * Any other shell command is judged by its words
 * ({@link shellReachesProbeDirectory}): a word reaches a directory when the
 * directory's path starts the word, follows a `/`, `:`, `=`, `@`, `{` or `,`
 * in it, or follows a short flag glued to it (`-f`, `-C`). A path after any
 * other character — a space, a quote mark, a backtick — is text. The known
 * cost: a commit message or a `grep` pattern that begins with the path is
 * judged. Start the message with a word, or search with the `Grep` tool.
 *
 * Every path is read with doubled slashes and `.` and `..` segments resolved
 * first ({@link normalisePath}), so `a//b` and `a/x/../b` are judged as `a/b`.
 *
 * A command that hands code to an interpreter as text — `bash -c`, `node -e`,
 * `python3 -` reading a here-document, `bash <<<` reading a here-string, a
 * pipe into `sh`, `eval`, `xargs` — is
 * judged by all of its text instead. The guard cannot tell what a script will
 * do with a path it names, so it takes the path as read. That judges a script
 * that only prints a sentence naming a directory; that cost was accepted with
 * the rule.
 */
export function mentionsProbeDirectory(toolInput: unknown): boolean {
  return strings(toolInput).some(namesProbeDirectory);
}

/**
 * Words that may stand before the program without being it: a shell keyword
 * that starts a command, or a wrapper that runs the program after it.
 */
const KEYWORDS = new Set(["{", "!", "if", "then", "elif", "else", "do", "while", "until"]);
const WRAPPERS = new Set(["env", "sudo", "command", "exec", "time", "nice", "nohup", "timeout"]);

/** Programs that run code they are given; `python` may carry a version. */
const INTERPRETERS = new Set([
  "sh", "bash", "zsh", "dash", "ksh",
  "node", "deno", "bun", "tsx", "perl", "ruby", "php",
]);
const PYTHON = /^python(\d+(\.\d+)?)?$/;

/** Flags that give an interpreter its code as text. */
const CODE_FLAGS = new Set(["-c", "-e", "-p", "--eval", "--print"]);

/** The last part of a program's path: `/usr/bin/python3` is `python3`. */
const programName = (word: string): string => word.slice(word.lastIndexOf("/") + 1);

const isInterpreter = (word: string): boolean => {
  const name = programName(word);
  return INTERPRETERS.has(name) || PYTHON.test(name);
};

/**
 * Whether a command hands code to an interpreter as text, so that no word of
 * it says what the code opens.
 *
 * The program is found past any `VAR=value` words, keywords and wrappers. A
 * wrapper's flags are skipped, and so is the word after one of its flags or
 * a number, since it may be the flag's value (`sudo -u root`, `nice -n 10`,
 * `timeout 5`) — unless that word is itself an interpreter.
 */
function handsCodeToInterpreter(words: readonly string[]): boolean {
  let wrapped = false;
  let afterFlag = false;
  let at = 0;
  for (; at < words.length; at += 1) {
    const word = words[at]!;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word) || KEYWORDS.has(word)) continue;
    if (WRAPPERS.has(programName(word))) {
      wrapped = true;
      afterFlag = false;
      continue;
    }
    if (wrapped && (word.startsWith("-") || /^\d/.test(word))) {
      afterFlag = word.startsWith("-");
      continue;
    }
    if (wrapped && afterFlag && !isInterpreter(word)) {
      afterFlag = false;
      continue;
    }
    break;
  }
  const program = words[at];
  if (program === undefined) return false;
  const name = programName(program);
  if (name === "eval" || name === "xargs") return true;
  if (!isInterpreter(name)) return false;

  // Code as text: a flag that carries it, `-` as the script, `deno eval`, or
  // no script file at all, so the code comes from a here-document, a
  // here-string or a pipe.
  let script: string | undefined;
  for (const arg of words.slice(at + 1)) {
    if (arg === "-") return true;
    if (script !== undefined) continue;
    if (CODE_FLAGS.has(arg) || /^--(eval|print)=/.test(arg) || /^-[A-Za-z]*[cep][A-Za-z]*$/.test(arg)) {
      return true;
    }
    if (!arg.startsWith("-")) script = arg;
  }
  return script === undefined || (name === "deno" && script === "eval");
}

/**
 * Whether a probe directory's path starts the word, follows `/`, `:`, `=`,
 * `@`, `{` or `,` in it, or follows a short flag the word starts with.
 *
 * `@` is how `curl -d @file` and `gh api -F body=@file` name a file they
 * read; `{` and `,` are brace expansion, `{a,b}`; a short flag may carry its
 * value glued on, `grep -ffile` or `tar -Cdir`.
 */
function wordReaches(word: string): boolean {
  const path = normalisePath(word);
  return PROBE_DIRECTORIES.some((directory) => {
    for (let at = path.indexOf(directory); at !== -1; at = path.indexOf(directory, at + 1)) {
      if (at === 0 || "/:=@{,".includes(path.charAt(at - 1))) return true;
      if (/^-[A-Za-z0-9]+$/.test(path.slice(0, at))) return true;
    }
    return false;
  });
}

/**
 * Whether a `Bash` call reads, lists, runs or writes a probe directory, judged
 * by the words of its command and its here-strings. Here-document bodies are
 * not looked at: they are text a command reads, and the ones an interpreter
 * runs were caught by the interpreter rule first, as are the here-strings an
 * interpreter runs. The rules and their costs are set out at
 * {@link mentionsProbeDirectory}.
 */
function shellReachesProbeDirectory(toolInput: unknown): boolean {
  const command: unknown =
    typeof toolInput === "object" && toolInput !== null ? Reflect.get(toolInput, "command") : undefined;
  const commands = typeof command === "string" ? readShellCommand(command) : undefined;
  if (commands === undefined || commands.some((found) => handsCodeToInterpreter(found.words))) {
    return mentionsProbeDirectory(toolInput);
  }
  return commands.some((found) => [...found.words, ...found.herestrings].some(wordReaches));
}

/**
 * The fields of a tool's input that say what the tool opens, by tool name.
 * Every other field of these tools is text: a prompt, a file's new content,
 * the words a search looks for.
 */
const TARGET_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
  ["Read", ["file_path"]],
  ["Write", ["file_path"]],
  ["Edit", ["file_path"]],
  ["NotebookEdit", ["notebook_path"]],
  ["Glob", ["pattern", "path"]],
  ["Grep", ["path", "glob"]],
  // A helper's prompt is text. What the helper then opens is its own tool
  // call, and the guard judges that call on its own.
  ["Agent", []],
  ["Task", []],
]);

/**
 * Whether a tool call reads, lists or writes a probe directory.
 *
 * A tool is judged by what it opens, not by every word it carries
 * ([#192](https://github.com/fvermaut/timone/issues/192)). Judging all of the
 * text refused a builder's helper for a prompt that told it to keep out of
 * the probes, and then refused the plan for naming them. Only the fields
 * that name a target are looked at; a field that is missing or not a string
 * is skipped.
 *
 * A tool with no rule here, or a call whose tool is not known, keeps the old
 * rule, {@link mentionsProbeDirectory}: all of its input text. That was the
 * choice approved with the list, so a new tool is covered the day it
 * appears rather than the day someone adds it here. `Bash` is judged by the
 * words of its command, {@link shellReachesProbeDirectory}.
 */
export function reachesProbeDirectory(
  toolName: string | undefined,
  toolInput: unknown,
): boolean {
  if (toolName === "Bash") return shellReachesProbeDirectory(toolInput);
  const fields = toolName === undefined ? undefined : TARGET_FIELDS.get(toolName);
  if (fields === undefined) return mentionsProbeDirectory(toolInput);
  if (typeof toolInput !== "object" || toolInput === null) return false;
  return fields.some((field) => {
    const value: unknown = Reflect.get(toolInput, field);
    return typeof value === "string" && namesProbeDirectory(value);
  });
}

/** What a `PreToolUse` hook may say back to the harness. */
export interface ProbeGuardDecision {
  permissionDecision: "allow" | "deny" | "ask";
  permissionDecisionReason: string;
}

export interface ProbeGuardInput {
  /**
   * The tool's name, as the hook payload carried it (`tool_name`); undefined
   * when the caller does not know it, which judges all of the input's text.
   */
  toolName?: string | undefined;
  /** The tool's own input, as the hook payload carried it. */
  toolInput: unknown;
  /** The stage of the run driving this session; undefined means a human is. */
  stage: PipelineStage | undefined;
}

/**
 * Judge one tool call.
 *
 * Returns undefined — say nothing at all — for the overwhelming majority of
 * calls, which touch no probe. A hook that answered every call would put a
 * decision of its own in front of every tool use in every session, and the
 * one thing this guard must not do is become the reason a session stops
 * working.
 */
export function probeGuardDecision(
  input: ProbeGuardInput,
): ProbeGuardDecision | undefined {
  if (!reachesProbeDirectory(input.toolName, input.toolInput)) return undefined;

  const where = PROBE_DIRECTORIES.join(" and ");

  if (input.stage !== undefined && BUILD_STAGES.includes(input.stage)) {
    return {
      permissionDecision: "deny",
      permissionDecisionReason:
        `Refused: ${where} hold the checks that will be run against what you build. ` +
        "A builder that reads them writes code to pass them, which is the same fault " +
        "as a verifier checking against your own test suite, with the two parties " +
        "swapped. Carry on without them. If you believe a probe is wrong, that is a " +
        "finding for the human, not a file to open.",
    };
  }

  if (input.stage !== undefined && CHECKING_STAGES.includes(input.stage)) {
    const name = input.stage.charAt(0).toUpperCase() + input.stage.slice(1);
    return {
      permissionDecision: "allow",
      permissionDecisionReason: `${name} runs the checks kept in ${where}, so it may read them.`,
    };
  }

  // Neither a builder nor a stage that runs the checks: an interactive
  // session, or a stage that does neither job. Asking is right where denying would be wrong — these
  // are the human's own files, and a hook that refused them to the person who
  // owns the repository would be a bug wearing a guardrail's clothes.
  return {
    permissionDecision: "ask",
    permissionDecisionReason:
      `This is ${where}, which belongs to the stage that checks the build. ` +
      "Nothing that builds code may read it. Allow only if you are not building.",
  };
}
