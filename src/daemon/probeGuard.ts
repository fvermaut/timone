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

/** The stage that owns the probes and does the reading and writing. */
const OWNING_STAGE: PipelineStage = "verification";

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
 * Whether a tool call names a probe directory.
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

/** What a `PreToolUse` hook may say back to the harness. */
export interface ProbeGuardDecision {
  permissionDecision: "allow" | "deny" | "ask";
  permissionDecisionReason: string;
}

export interface ProbeGuardInput {
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
  if (!mentionsProbeDirectory(input.toolInput)) return undefined;

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

  if (input.stage === OWNING_STAGE) {
    return {
      permissionDecision: "allow",
      permissionDecisionReason: `Verification owns ${where}.`,
    };
  }

  // Neither a builder nor the owner: an interactive session, or a stage that
  // does neither job. Asking is right where denying would be wrong — these
  // are the human's own files, and a hook that refused them to the person who
  // owns the repository would be a bug wearing a guardrail's clothes.
  return {
    permissionDecision: "ask",
    permissionDecisionReason:
      `This is ${where}, which belongs to the stage that checks the build. ` +
      "Nothing that builds code may read it. Allow only if you are not building.",
  };
}
