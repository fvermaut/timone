import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

/**
 * The four kinds stage 1 classifies a request into. The daemon reads them
 * back off the `triage:<kind>` label the triage session applied.
 */
export const CLASSIFICATIONS = ["feature", "bug", "chore", "question"] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

/**
 * The kinds of ticket a wayfinder effort holds (ADR-0010), read back off the
 * `wayfinder:<type>` label the charting session applied.
 *
 * **`map` is the fifth, and it was deliberately absent until ADR-0024.** The
 * reasoning that kept it out was sound and is now overtaken: the map is an
 * index of the effort rather than a question anybody can answer, so a run on
 * it would be a run nothing could resolve. What that missed is the *last*
 * transition — the effort closing into a specification — which is a question
 * only the map can carry, because the map is the ticket that represents the
 * effort to the human. On 2026-08-13 fvermaut wrote his instruction on
 * `ivtrends` #1 and nothing was listening.
 *
 * So the map is a kind with a stage of its own ({@link PIPELINE_STAGES}'s
 * `charting`), **and the decision tickets are unchanged**.
 */
const WAYFINDER_TYPES = [
  "research",
  "grilling",
  "prototype",
  "task",
  "map",
] as const;

type WayfinderType = (typeof WAYFINDER_TYPES)[number];

/**
 * The stages a run passes through. Named for what they do rather than by
 * `process.md`'s numbers, because these strings surface in `timone status`
 * and on tickets, where a number would mean nothing to the reader.
 */
export const PIPELINE_STAGES = [
  "triage",
  "clarification",
  "wayfinding",
  "charting",
  "research",
  "requirements",
  "breakdown",
  "planning",
  "execution",
  "verification",
  "delivery",
  "remediation",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * What the runner reads about a step. ✏ 2026-09-30: the columns only the old
 * code between steps read — the `process.md` stage number, the wait, whether
 * the step is built, whether it is inside the build, and the step that
 * follows — were removed with that code. The runner decides what comes next.
 */
interface StageFacts {
  /**
   * What this step is called when a person is told about it — in `timone
   * status`, on tickets and in the runner's words.
   *
   * **It lives here so it cannot be partial.** It was a map in `status.ts`
   * covering five stages of thirteen. Being a field of this table makes it
   * total by construction: the compiler will not accept a stage without one.
   *
   * Written for someone who has never heard of this process: never the
   * stage's own name, never a number.
   */
  label: string;
  /**
   * Whether a run at this stage owns a work branch — and therefore holds its
   * project against every other ticket (see `RunStore`). Stages that only
   * talk to the human touch no repository and hold nothing.
   */
  ownsBranch: boolean;
}

/**
 * A stage a session is started for, which must therefore say what that
 * session runs on. Declaring the model is not optional here on purpose: a
 * step without one silently takes the runtime's default, and it would hide in
 * whichever stage nobody thought to check.
 */
interface SpawnedStage {
  /** Never set here: {@link UnspawnedStage} is what carries the false. */
  spawns?: never;
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
 * neither. A model on it would be configuration nothing reads.
 *
 * `charting` is the one such stage (ADR-0024): the map's stage is a ticket
 * waiting, and the session that follows the human's go-ahead belongs to the
 * next stage, on the same run.
 */
type UnspawnedStage = { spawns: false; model?: never; effort?: never };

type StageSpec = StageFacts & (SpawnedStage | UnspawnedStage);

/**
 * The model the approval-recording session runs on. Not a stage — it has no
 * row in the step table because it is not one of `process.md`'s steps — but
 * it is the second place `runtime.start` is called, and the one that would
 * otherwise keep the runtime default while every real stage moved off it.
 *
 * Haiku because the work genuinely is mechanical: stamp a name and a date
 * into an artifact that already exists, commit, push. No effort goes with it.
 */
export const APPROVAL_RECORD_MODEL = "claude-haiku-4-5";

/**
 * The step table. It is data rather than control flow on purpose: what it
 * holds about a step is what the step is called, whether it owns a branch,
 * and what it runs on — and those are facts, not code paths. ✏ 2026-09-30:
 * which step comes next is the runner's to decide, and is no longer here.
 *
 * The model and effort columns were settled once, at the grill of
 * 2026-08-06, and carry their reasons here so no slice re-argues them. They
 * live in the step table rather than in `timone.yaml` because the manifest is
 * strictly per-*project* and this is per-*stage*; moving them later would be
 * a refactor, and changing one is a one-line edit — which is why the choice
 * is recorded in phase 14's plan rather than in an ADR.
 *
 * ✏ On 2026-08-30 fvermaut said the runs cost too many tokens and asked
 * for a step down. Sonnet now runs every stage that works from an artifact a
 * human has already approved, and every stage that ends in a question rather
 * than in code. Opus stays on the three judgements nothing downstream
 * repeats: the specification, the cut of the initiative, and the check of
 * what was built. The two `xhigh` rows came down to `high`. Nothing came
 * down two notches, and nothing moved to Haiku.
 *
 * ✏ On 2026-09-23 fvermaut asked to try Opus 5.5 on every stage that ran on
 * Sonnet. Every row below now runs on `claude-opus-5-5`; the efforts are
 * unchanged, and the approval record stays on Haiku. The dated Sonnet notes
 * on each row say why that row was stepped down, which is the case to read
 * if the cost is too high again.
 */
const STAGES: Record<PipelineStage, StageSpec> = {
  triage: {
    label: "sorting the request",
    ownsBranch: false,
    // Not the cheap model, though the work looks small: triage routes
    // silently. A `triage:chore` label goes straight to planning while
    // `triage:feature` opens a human interview first, so a misclassification
    // skips a gate and nobody is told a gate was skipped.
    model: "claude-opus-5-5",
    effort: "medium",
  },
  clarification: {
    label: "asking what you need",
    ownsBranch: false,
    // The session interviews the person until every branch is resolved, and
    // may write an ADR: the same class of work as requirements and planning,
    // which carry the same pair.
    // ✏ Sonnet since 2026-08-30. The work was then reading one written answer
    // and deciding whether it settled the question; the written answer was
    // removed on 2026-09-30. The effort stays `high`, because judging when
    // the question is settled is the whole of the session.
    model: "claude-opus-5-5",
    effort: "high",
  },
  wayfinding: {
    // Stage 2's other mode: the same requirements discovery, at scale
    // (ADR-0010). What is resolved here is one decision ticket off a map, and
    // what it produces is a decision — never a slice of a build, which is why
    // it owns no branch.
    label: "talking a question through",
    ownsBranch: false,
    // The same pair as `clarification`, for the same reason.
    // ✏ Down to Sonnet on 2026-08-30, with `clarification`.
    model: "claude-opus-5-5",
    effort: "high",
  },
  charting: {
    // The map itself ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md),
    // amending ADR-0010): not a question anybody answers but the effort's own
    // ticket.
    label: "keeping the list of questions",
    // The map holds nothing while it waits. It starts holding its project the
    // moment the go-ahead lands, because what follows *does* own a branch —
    // and from then until the specification is committed no other ticket on
    // that project moves. ADR-0024 records that as intended.
    ownsBranch: false,
    // Nothing runs at this stage: the map's whole behaviour is a ticket
    // waiting. See {@link UnspawnedStage}.
    spawns: false,
  },
  research: {
    label: "looking something up",
    ownsBranch: false,
    // Not the cheap model, for `triage`'s reason wearing stage 2's clothes:
    // what this stage produces is an answer somebody's decision rests on, and
    // a lookup that is confidently wrong is worse than one that says it could
    // not find out. Judging what a source is worth is the work here.
    // ✏ Sonnet since 2026-08-30. Still not the cheapest model, and the
    // effort stays `high`: what came down is the model, not the care.
    model: "claude-opus-5-5",
    effort: "high",
  },
  requirements: {
    label: "writing down what it needs",
    ownsBranch: true,
    // The PRD everything downstream is built and verified against.
    // ✏ Kept on Opus at the 2026-08-30 step down: nothing later rewrites
    // this artifact, and every phase is planned and verified against it.
    model: "claude-opus-5-5",
    effort: "high",
  },
  breakdown: {
    // ADR-0030 D1: the list of pieces the initiative is built in, approved
    // once, split from `planning`, which writes each piece's phase file.
    label: "working out the pieces",
    // Chunk zero's branch, inherited rather than cut: `claimBranch` returns
    // early when the run already has one, so this costs nothing and keeps the
    // project held from the specification through the approval (ADR-0028 D2).
    ownsBranch: true,
    // The one cut the human approves for the whole initiative, and the only
    // approval standing between a specification and every pull request that
    // follows it. A bad cut is not a bad phase, it is a bad five phases.
    // ✏ Kept on Opus at the 2026-08-30 step down, for that reason.
    model: "claude-opus-5-5",
    effort: "high",
  },
  planning: {
    label: "preparing the work",
    ownsBranch: true,
    // Unchanged: a bad cut of one chunk still costs a whole phase, and this is
    // now the last unattended judgement before code gets written.
    // ✏ Sonnet since 2026-08-30. This stage writes one chunk's phase file
    // from a cut the human has already approved, so the hard judgement was
    // made upstream at `breakdown`, which stayed on Opus.
    model: "claude-opus-5-5",
    effort: "high",
  },
  execution: {
    label: "building",
    ownsBranch: true,
    // A fleet: `timone-execute` spawns one sub-agent per sub-phase, and they
    // inherit this row.
    // ✏ The largest saving of the 2026-08-30 step down, because this row
    // is multiplied by every sub-agent. Sonnet at `high` writes code against
    // a phase file that already says what to build, and what judges the
    // result is `verification`, which stayed on Opus.
    model: "claude-opus-5-5",
    effort: "high",
  },
  verification: {
    label: "checking the result",
    ownsBranch: true,
    // The check nobody else performs — correctness over cost.
    // ✏ Kept on Opus on 2026-08-30, and now the only check standing over
    // a build Sonnet wrote. The effort came down from `xhigh` to `high`.
    model: "claude-opus-5-5",
    effort: "high",
  },
  delivery: {
    label: "delivering",
    ownsBranch: true,
    // Also a fleet: two review axes as parallel fresh contexts.
    // ✏ Sonnet at `medium` since 2026-08-30. Both axes read a build that
    // `verification` has already checked, and a human reads the pull request
    // after them.
    model: "claude-opus-5-5",
    effort: "medium",
  },
  remediation: {
    // ADR-0016's carve-out of stage 9: a concrete review comment is
    // confirmed intake, and its fix rides the verify-fix shape.
    label: "acting on your review",
    ownsBranch: true,
    // Coding, on a live pull request.
    // ✏ Sonnet since 2026-08-30, with `execution`, which it is a small
    // version of. A full verification runs after it either way.
    model: "claude-opus-5-5",
    effort: "high",
  },
};

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
 * The stage a wayfinder ticket carrying `labels` enters, or undefined when
 * the ticket is not one.
 *
 * **Derived from the labels every time, never stored on the run.** The
 * tracker holds the ticket's type; a copy of it in the ledger is a copy that
 * can disagree with a label a human has since changed.
 *
 * Three answers, and the split is ADR-0010's own table plus ADR-0024's
 * amendment to it:
 *
 * - `research` resolves itself with nobody waiting.
 * - `grilling`, `prototype` and `task` each resolve only through exchange
 *   with a human — a conversation, whatever medium it runs on.
 * - `map` is the effort itself.
 */
export function wayfinderStage(
  labels: readonly string[],
): PipelineStage | undefined {
  for (const label of labels) {
    const type = label.startsWith("wayfinder:")
      ? label.slice("wayfinder:".length)
      : "";
    if (!(WAYFINDER_TYPES as readonly string[]).includes(type)) continue;

    const kind = type as WayfinderType;
    if (kind === "research") return "research";
    if (kind === "map") return "charting";
    return "wayfinding";
  }
  return undefined;
}

/**
 * What this step is called when a person is told about it. Total: every stage
 * has one, and the compiler enforces it.
 */
export function stageLabel(stage: PipelineStage): string {
  return STAGES[stage].label;
}

/** Whether a run at `stage` owns a work branch, and so holds its project. */
export function ownsBranch(stage: PipelineStage): boolean {
  return STAGES[stage].ownsBranch;
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
