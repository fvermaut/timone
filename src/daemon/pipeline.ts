import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

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
  "verification",
  "delivery",
  "remediation",
  "feedback",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * What a stage waits for once its session has done its work. `review` is the
 * wait at the end of the line: the work sits as an open pull request, and
 * what resolves it is a human's review comment, merge, or close — read off
 * the PR thread, never off the ticket.
 */
export type WaitKind = "gate" | "conversation" | "review" | "none";

interface StageFacts {
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
 * A stage the daemon starts a session for, which must therefore say what that
 * session runs on. Declaring the model is not optional here on purpose: a
 * spawned stage without one silently takes the runtime's default, which is
 * precisely the defect this requirement closes — and it would hide in
 * whichever stage nobody thought to check.
 */
interface SpawnedStage {
  built: true;
  /** Never a conversation — see {@link UnspawnedStage}. */
  waits: Exclude<WaitKind, "conversation">;
  model: string;
  /**
   * Omitted for models that reject the parameter — Haiku 4.5 does. Optional
   * rather than defaulted, so the type carries the constraint instead of a
   * runtime check having to.
   */
  effort?: EffortLevel;
}

/**
 * A stage no session is ever started for, and which therefore declares
 * neither. Two ways to be one: the machinery does not exist yet, or the stage
 * waits on a conversation — `spawn()` short-circuits to `openConversation`
 * before it ever reaches `runStage`, so `runtime.start` is never called. A
 * model on either would be configuration nothing reads.
 */
type UnspawnedStage = { model?: never; effort?: never } & (
  | { built: false }
  | { built: true; waits: "conversation" }
);

type StageSpec = StageFacts & (SpawnedStage | UnspawnedStage);

/**
 * The model the approval-recording session runs on. Not a stage — it has no
 * row in the graph because it is not one of `process.md`'s steps — but it is
 * the second place `runtime.start` is called, and the one that would
 * otherwise keep the runtime default while every real stage moved off it.
 *
 * Haiku because the work genuinely is mechanical: stamp a name and a date
 * into an artifact that already exists, commit, push. No effort goes with it.
 */
export const APPROVAL_RECORD_MODEL = "claude-haiku-4-5";

/**
 * The stage graph. It is data rather than control flow on purpose: the daemon
 * orchestrates stage skills and never reimplements them, so what it holds
 * about a stage is which skill runs, what the run then waits for, what comes
 * next, and what it runs on — and those are facts, not code paths.
 *
 * The model and effort columns were settled once, at the grill of
 * 2026-08-06, and carry their reasons here so no slice re-argues them. They
 * live in the graph rather than in `timone.yaml` because the manifest is
 * strictly per-*project* and this is per-*stage*; moving them later would be
 * a refactor, and changing one is a one-line edit — which is why the choice
 * is recorded in phase 14's plan rather than in an ADR.
 */
const STAGES: Record<PipelineStage, StageSpec> = {
  triage: {
    processStage: 1,
    waits: "none",
    ownsBranch: false,
    built: true,
    // Not the cheap model, though the work looks small: triage routes
    // silently. A `triage:chore` label goes straight to planning while
    // `triage:feature` opens a human interview first, so a misclassification
    // skips a gate and nobody is told a gate was skipped.
    model: "claude-sonnet-5",
    effort: "medium",
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
    // The PRD everything downstream is built and verified against.
    model: "claude-opus-5",
    effort: "high",
    next: "planning",
  },
  planning: {
    processStage: 5,
    waits: "gate",
    ownsBranch: true,
    built: true,
    // Human-gated, but a bad cut costs a whole phase before anyone sees it.
    model: "claude-opus-5",
    effort: "high",
    next: "execution",
  },
  execution: {
    processStage: 6,
    waits: "none",
    ownsBranch: true,
    built: true,
    // A fleet: `timone-execute` spawns one sub-agent per sub-phase, and they
    // inherit this row.
    model: "claude-opus-5",
    effort: "xhigh",
    next: "verification",
  },
  verification: {
    processStage: 7,
    waits: "none",
    ownsBranch: true,
    built: true,
    // The check nobody else performs — correctness over cost.
    model: "claude-opus-5",
    effort: "xhigh",
    next: "delivery",
  },
  delivery: {
    processStage: 8,
    waits: "review",
    ownsBranch: true,
    built: true,
    // Also a fleet: two review axes as parallel fresh contexts.
    model: "claude-opus-5",
    effort: "high",
    // Nothing follows in the graph: the run ends at the pull request, whose
    // merge or close is a terminal event on the run, not a stage.
  },
  remediation: {
    // ADR-0016's carve-out of stage 9: a concrete review comment is
    // confirmed intake, and its fix rides the verify-fix shape — so what
    // follows a remediation is a full verification, then re-delivery.
    processStage: 9,
    waits: "none",
    ownsBranch: true,
    built: true,
    // Coding, on a live pull request.
    model: "claude-opus-5",
    effort: "high",
    next: "verification",
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

/**
 * The model a stage's session runs on, or undefined for a stage no session is
 * ever started for. The undefined is a real answer rather than a gap: see
 * {@link UnspawnedStage}.
 */
export function modelFor(stage: PipelineStage): string | undefined {
  return STAGES[stage].model;
}

/**
 * The reasoning effort a stage's session runs at, or undefined when there is
 * none to send — either because the stage spawns nothing, or because its
 * model rejects the parameter. Callers must omit the field entirely on
 * undefined rather than sending it unset.
 */
export function effortFor(stage: PipelineStage): EffortLevel | undefined {
  return STAGES[stage].effort;
}

/**
 * Whether the daemon starts this stage itself.
 *
 * Derived rather than declared, because it *is* the same fact: a stage whose
 * wait is a conversation has no unattended work to do — the conversation is
 * the work, and it needs someone at the keyboard. Recording it twice would
 * let the two drift.
 */
export function runsUnattended(stage: PipelineStage): boolean {
  return waitFor(stage) !== "conversation";
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
