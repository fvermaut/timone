import type { GateDecision } from "./gates.js";

/**
 * The four kinds stage 1 classifies a request into. The daemon reads them
 * back off the `triage:<kind>` label the triage session applied.
 */
export const CLASSIFICATIONS = ["feature", "bug", "chore", "question"] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

/**
 * The stages a run passes through. Named for what they do rather than by
 * `process.md`'s numbers, because these strings surface in `timone status`
 * and on tickets, where a number would mean nothing to the reader.
 */
export const PIPELINE_STAGES = [
  "triage",
  "clarification",
  "requirements",
  "planning",
  "execution",
  "feedback",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** What a stage waits for once its session has done its work. */
export type WaitKind = "gate" | "conversation" | "none";

interface StageSpec {
  /** The stage of `process.md` this is, for anyone comparing the two. */
  processStage: number;
  /** What the run waits on when the stage's session finishes. */
  waits: WaitKind;
  /**
   * Whether a run at this stage owns a work branch — and therefore holds its
   * project against every other ticket (see `RunStore`). Stages that only
   * talk to the human touch no repository and hold nothing.
   */
  ownsBranch: boolean;
  /** Whether the machinery for this stage exists yet. */
  built: boolean;
  /** The stage that follows, once this one's outcome is accepted. */
  next?: PipelineStage;
}

/**
 * The stage graph. It is data rather than control flow on purpose: the daemon
 * orchestrates stage skills and never reimplements them, so what it holds
 * about a stage is which skill runs, what the run then waits for, and what
 * comes next — and those are facts, not code paths.
 */
const STAGES: Record<PipelineStage, StageSpec> = {
  triage: {
    processStage: 1,
    waits: "none",
    ownsBranch: false,
    built: true,
    // What follows depends on the classification: see `routeAfterTriage`.
  },
  clarification: {
    processStage: 2,
    waits: "conversation",
    ownsBranch: false,
    built: true,
    next: "requirements",
  },
  requirements: {
    processStage: 3,
    waits: "gate",
    ownsBranch: true,
    built: true,
    next: "planning",
  },
  planning: {
    processStage: 5,
    waits: "gate",
    ownsBranch: true,
    built: true,
    next: "execution",
  },
  execution: {
    processStage: 6,
    waits: "none",
    ownsBranch: true,
    built: false,
  },
  feedback: {
    processStage: 9,
    waits: "none",
    ownsBranch: false,
    built: false,
  },
};

/** What a stage's outcome does to the run that reached it. */
export type PipelineTransition =
  | { kind: "advance"; stage: PipelineStage }
  | { kind: "repeat"; stage: PipelineStage; feedback: string }
  | { kind: "wait" }
  | { kind: "finish"; reason: string };

/**
 * The classification a triage session recorded, read back off the ticket's
 * labels. Anything unrecognised reads as unclassified: routing on a word
 * nobody defined is worse than triaging the ticket again.
 */
export function classificationFromLabels(
  labels: readonly string[],
): Classification | undefined {
  for (const label of labels) {
    const kind = label.startsWith("triage:") ? label.slice("triage:".length) : "";
    if ((CLASSIFICATIONS as readonly string[]).includes(kind)) {
      return kind as Classification;
    }
  }
  return undefined;
}

/**
 * Where a classified request goes next — `process.md` stage 1's routing
 * table, and nothing more.
 *
 * One narrowing is deliberate and worth naming: the spec lets triage send a
 * feature straight to stage 3 when its requirements are already clear, and
 * lets it *recommend* the at-scale discovery mode for a sprawling one. Both
 * are judgements, and a `triage:<kind>` label cannot carry a judgement — so
 * the daemon takes the safe road every time and asks the human first. A
 * clarification conversation that turns out to be unnecessary costs one short
 * interview; a skipped one costs a PRD written against a guess.
 */
export function routeAfterTriage(kind: Classification): PipelineTransition {
  switch (kind) {
    case "feature":
      return { kind: "advance", stage: "clarification" };
    case "chore":
      return { kind: "advance", stage: "planning" };
    case "bug":
      return { kind: "advance", stage: "feedback" };
    case "question":
      return {
        kind: "finish",
        reason: "a question is answered on the ticket, not built",
      };
  }
}

/** The stage that follows `stage`, or undefined at the end of the line. */
export function stageAfter(stage: PipelineStage): PipelineStage | undefined {
  return STAGES[stage].next;
}

/** What a run at `stage` waits for once the stage's work is done. */
export function waitFor(stage: PipelineStage): WaitKind {
  return STAGES[stage].waits;
}

/** Whether a run at `stage` owns a work branch, and so holds its project. */
export function ownsBranch(stage: PipelineStage): boolean {
  return STAGES[stage].ownsBranch;
}

/** Whether the machinery for `stage` exists yet. */
export function isBuilt(stage: PipelineStage): boolean {
  return STAGES[stage].built;
}

/** The `process.md` stage number, for messages that need to be precise. */
export function processStage(stage: PipelineStage): number {
  return STAGES[stage].processStage;
}

/**
 * Apply the human's answer to a gate.
 *
 * Approval advances exactly one stage; a change request re-enters the *same*
 * stage carrying the human's words, so the stage redoes its work with them in
 * hand. No third outcome exists, which is the property that makes a gate a
 * gate — see {@link readGateDecision} for why a reply is judged by shape.
 */
export function readGate(
  stage: PipelineStage,
  decision: GateDecision | undefined,
): PipelineTransition {
  requireWait(stage, "gate");
  if (decision === undefined) return { kind: "wait" };

  if (decision.kind === "change-request") {
    return { kind: "repeat", stage, feedback: decision.feedback };
  }

  const next = stageAfter(stage);
  if (next === undefined) {
    return { kind: "finish", reason: `nothing follows ${stage}` };
  }
  return { kind: "advance", stage: next };
}

/**
 * Apply the end of a conversation. Only an accepted outcome advances: a
 * conversation someone opened and walked away from decided nothing, and the
 * ticket is still waiting on them.
 */
export function concludeConversation(
  stage: PipelineStage,
  outcome: { accepted: boolean },
): PipelineTransition {
  requireWait(stage, "conversation");
  if (!outcome.accepted) return { kind: "wait" };

  const next = stageAfter(stage);
  if (next === undefined) {
    return { kind: "finish", reason: `nothing follows ${stage}` };
  }
  return { kind: "advance", stage: next };
}

/**
 * Refuse to apply the wrong kind of answer to a stage. A gate reply arriving
 * for a stage that waits on a conversation means the caller has lost track of
 * what the run is doing, and guessing would resolve a wait nobody answered.
 */
function requireWait(stage: PipelineStage, expected: WaitKind): void {
  const actual = waitFor(stage);
  if (actual !== expected) {
    throw new Error(
      `Stage ${stage} waits on ${actual === "none" ? "nothing" : actual}, ` +
        `not on a ${expected}`,
    );
  }
}
