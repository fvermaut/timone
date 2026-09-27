import { stageLabel, type PipelineStage } from "../daemon/pipeline.js";

/**
 * The default order: the steps written down for each kind of ticket, in the
 * order they are meant to run.
 *
 * **The runner may leave it, and the order is what makes that visible.** It
 * is not a script the machine follows. It is the list a finished run is
 * compared with, so every step that did not run, or ran out of order, can be
 * named on the pull request (see `departures.ts`).
 */

/** Every kind of ticket that has a written order. */
export const TICKET_KINDS = [
  "feature",
  "chore",
  "bug",
  "question",
  "decision",
  "research",
  "map",
  "step",
  "remediation",
] as const;

export type TicketKind = (typeof TICKET_KINDS)[number];

/** The two things a named person approves before building starts. */
export type Approval = "requirements" | "pieces";

/**
 * One step of a written order.
 *
 * A step is either a session at a stage or a person's approval, never both,
 * so the two shapes are a union rather than one shape with every field
 * optional. The other shape's fields are typed `undefined`, so a caller can
 * still read `step.stage` or `step.approval` on any step and use the answer
 * to tell them apart.
 *
 * `id` is what the runner names when it leaves a step out, and what a
 * `departure` entry records. `label` is what a person reads.
 */
export type OrderStep =
  | {
      id: string;
      label: string;
      stage: PipelineStage;
      /** Set on the step where a session that did not build the work checks it. */
      check?: true;
      approval?: undefined;
    }
  | {
      id: string;
      label: string;
      approval: Approval;
      stage?: undefined;
      check?: undefined;
    };

/**
 * A step that is a session at `stage`. Its id is the stage's own name — no
 * stage appears twice in one order — and its label is the stage's plain
 * words, the same ones `timone status` uses.
 */
function stageStep(stage: PipelineStage): OrderStep {
  return stage === "verification"
    ? { id: stage, label: stageLabel(stage), stage, check: true }
    : { id: stage, label: stageLabel(stage), stage };
}

const APPROVE_REQUIREMENTS: OrderStep = {
  id: "requirements-approval",
  label: "your approval of the requirements",
  approval: "requirements",
};

const APPROVE_PIECES: OrderStep = {
  id: "pieces-approval",
  label: "your approval of the list of pieces",
  approval: "pieces",
};

/** The written order for a ticket of `kind`. */
export function defaultOrder(kind: TicketKind): readonly OrderStep[] {
  switch (kind) {
    case "feature":
      return [
        stageStep("triage"),
        stageStep("clarification"),
        stageStep("requirements"),
        APPROVE_REQUIREMENTS,
        stageStep("breakdown"),
        APPROVE_PIECES,
        stageStep("planning"),
        stageStep("execution"),
        stageStep("verification"),
        stageStep("delivery"),
      ];
    case "chore":
    case "bug":
      return [
        stageStep("triage"),
        stageStep("planning"),
        stageStep("execution"),
        stageStep("verification"),
        stageStep("delivery"),
      ];
    case "question":
      return [stageStep("triage")];
    case "decision":
      return [stageStep("wayfinding")];
    case "research":
      return [stageStep("research")];
    case "map":
      return [
        stageStep("charting"),
        stageStep("requirements"),
        APPROVE_REQUIREMENTS,
        stageStep("breakdown"),
        APPROVE_PIECES,
      ];
    case "step":
      return [
        stageStep("planning"),
        stageStep("execution"),
        stageStep("verification"),
        stageStep("delivery"),
      ];
    case "remediation":
      return [
        stageStep("remediation"),
        stageStep("verification"),
        stageStep("delivery"),
      ];
    default:
      return kind satisfies never;
  }
}
