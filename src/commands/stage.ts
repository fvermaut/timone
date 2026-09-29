import { resolve } from "node:path";
import type { Command } from "commander";

import { clearStage, declareStage } from "../daemon/declared-stage.js";
import { PIPELINE_STAGES, type PipelineStage } from "../daemon/pipeline.js";
import { PROBE_DIRECTORIES, probeGuardDecision } from "../daemon/probeGuard.js";

/** What the person asked for: a step to declare, or to take one back. */
type StageChoice = { kind: "declare"; stage: PipelineStage } | { kind: "clear" };

/** The word that takes a declaration back. Not a stage, so it cannot clash. */
const CLEAR = "none";

/**
 * Read the argument as a stage name or `none`. Anything else is refused with
 * every valid name, so the person never has to go and look them up.
 */
function parseStageChoice(
  raw: string,
): { ok: true; value: StageChoice } | { ok: false; error: string } {
  if (raw === CLEAR) return { ok: true, value: { kind: "clear" } };
  const stage = PIPELINE_STAGES.find((known) => known === raw);
  if (stage !== undefined) return { ok: true, value: { kind: "declare", stage } };
  return {
    ok: false,
    error:
      `"${raw}" is not a step I know. Use one of: ${PIPELINE_STAGES.join(", ")}. ` +
      `Or use ${CLEAR} to take back what this session declared.`,
  };
}

/**
 * One sentence on what the guard will now do for this session.
 *
 * The answer is asked of the guard itself rather than written down a second
 * time here, so this sentence cannot drift from what the guard does. It
 * assumes a session run by hand: for a session the daemon drove, the ledger
 * decides and a declaration changes nothing.
 */
function guardSays(sessionId: string, choice: StageChoice): string {
  if (choice.kind === "clear") {
    return (
      `Session ${sessionId} no longer declares a step: the guard asks you ` +
      "before it touches the probes."
    );
  }
  const { stage } = choice;
  const verdict = probeGuardDecision({
    toolInput: PROBE_DIRECTORIES[0],
    stage,
  })?.permissionDecision;
  switch (verdict) {
    case "allow":
      return (
        `Session ${sessionId} is now the checking step: the guard lets it read ` +
        "and write the probes without asking."
      );
    case "deny":
      return (
        `Session ${sessionId} is now the ${stage} step, which builds code: ` +
        "the guard refuses it the probes."
      );
    case "ask":
      return (
        `Session ${sessionId} is now the ${stage} step, which neither builds ` +
        "nor checks: the guard still asks you before it touches the probes."
      );
    case undefined:
      // The guard said nothing about its own probe directory. That is a bug
      // in the guard, not something the person did.
      throw new Error(`the probe guard has no opinion on ${PROBE_DIRECTORIES[0]}`);
    default:
      verdict satisfies never;
      return verdict;
  }
}

export interface StageDeps {
  /** The timone root, where the declarations live. */
  root: string;
  /** The session the declaration is for — the id the session start hook gave it. */
  sessionId: string;
  /** Injected so a test can fix the declaration's time. */
  now?: () => string;
  log?: (message: string) => void;
}

/**
 * `timone stage <stage> --session <id>`: a session run by hand says which step
 * it is running, and `timone stage none` takes that back
 * ([#169](https://github.com/fvermaut/timone/issues/169)).
 *
 * The probe guard (ADR-0048 D4) knows a daemon session's step from the
 * ledger. A session run by hand has no run there, so the guard asked the
 * person about every call that named a probe — and the checking step names
 * one on almost every call. Declaring the step lets the guard treat the
 * session as it treats a daemon run of that step.
 *
 * Returns the exit code: 0 when the declaration is written or cleared, 1 when
 * the step is refused.
 */
export function runStage(raw: string, deps: StageDeps): number {
  const log = deps.log ?? ((message: string) => console.log(message));
  const choice = parseStageChoice(raw);
  if (!choice.ok) {
    log(choice.error);
    return 1;
  }
  switch (choice.value.kind) {
    case "declare":
      declareStage(deps.root, deps.sessionId, choice.value.stage, deps.now);
      break;
    case "clear":
      clearStage(deps.root, deps.sessionId);
      break;
    default:
      choice.value satisfies never;
  }
  log(guardSays(deps.sessionId, choice.value));
  return 0;
}

/** Register the `stage` command on the program. */
export function registerStageCommand(program: Command): void {
  program
    .command("stage")
    .argument(
      "<stage>",
      `the step this session is running (${PIPELINE_STAGES.join(", ")}), or ${CLEAR} to take it back`,
    )
    .description(
      "Say which step a session run by hand is running, so the probe guard knows it",
    )
    .requiredOption(
      "--session <id>",
      "the session's id, as the session start hook gave it",
    )
    // `--root` for the same reason `guardrails` takes it: the guard reads the
    // declarations from the root the hook is given, so the two must agree
    // whichever directory the command is typed in.
    .option("--root <path>", "the timone root", process.cwd())
    .action((stage: string, options: { session: string; root: string }) => {
      try {
        process.exitCode = runStage(stage, {
          root: resolve(options.root),
          sessionId: options.session,
        });
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
