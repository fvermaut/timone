import type { PipelineStage } from "./pipeline.js";

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
 * Whether a tool call names a probe directory anywhere in its input.
 *
 * This is the rule for a tool {@link reachesProbeDirectory} has no rule for,
 * and for a call whose tool is not known.
 *
 * Substring matching on the directory path, which is blunt in one known
 * direction: a shell command that reaches the directory in two steps (`cd
 * doc/plans/phases && cat probes/x`) does not match. That is accepted. The
 * guard exists to stop the accident and the idle glance, and a builder
 * assembling a path in pieces to get around a refusal it has been told about
 * has left the territory a hook can police.
 */
export function mentionsProbeDirectory(toolInput: unknown): boolean {
  return strings(toolInput).some((value) =>
    PROBE_DIRECTORIES.some((directory) => value.includes(directory)),
  );
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
 * appears rather than the day someone adds it here. `Bash` is judged that
 * way too for now.
 */
export function reachesProbeDirectory(
  toolName: string | undefined,
  toolInput: unknown,
): boolean {
  const fields = toolName === undefined ? undefined : TARGET_FIELDS.get(toolName);
  if (fields === undefined) return mentionsProbeDirectory(toolInput);
  if (typeof toolInput !== "object" || toolInput === null) return false;
  return fields.some((field) => {
    const value: unknown = Reflect.get(toolInput, field);
    return (
      typeof value === "string" &&
      PROBE_DIRECTORIES.some((directory) => value.includes(directory))
    );
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
