import {
  classificationFromLabels,
  stageLabel,
  type PipelineStage,
  wayfinderStage,
} from "../daemon/pipeline.js";
import type { RecordEntry } from "./record.js";

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

/**
 * Where one run's work stands against its written order: the steps it has
 * finished, the step running now, and the step that comes next.
 */
export interface Standing {
  /** The steps finished well, in the order's sequence. */
  done: OrderStep[];
  /** The step of the order running now, when one is. */
  running?: OrderStep;
  /** The first step of the order that is not done, not running and not left out. */
  next?: OrderStep;
}

/**
 * Where run `runId` stands against `order`, read from the ticket's record.
 *
 * A session step is done when a session at its stage ended well in this
 * run; an approval, when it was recorded in this run. A step is running when
 * its session started and has not ended. A step the run left out with a
 * reason is not next: the runner already said it would not run it.
 *
 * **It names what the written order puts next, and decides nothing.** The
 * runner may still choose another step; this is only what a person is told
 * of where the work is.
 */
export function standingOf(
  entries: readonly RecordEntry[],
  runId: string,
  order: readonly OrderStep[],
): Standing {
  const ofRun = entries.filter((entry) => "runId" in entry && entry.runId === runId);
  const done = order.filter((step) =>
    step.stage !== undefined
      ? ofRun.some((entry) => entry.kind === "step-ended" && entry.stage === step.stage && entry.ok)
      : ofRun.some((entry) => entry.kind === "approval" && entry.what === step.approval),
  );
  const unfinished = ofRun.flatMap((entry) =>
    entry.kind === "step-started" &&
    !ofRun.some((other) => other.kind === "step-ended" && other.sessionId === entry.sessionId)
      ? [entry.stage]
      : [],
  );
  const runningStage = unfinished.at(-1);
  const running = order.find((step) => step.stage !== undefined && step.stage === runningStage);
  const departed = (step: OrderStep): boolean =>
    ofRun.some((entry) => entry.kind === "departure" && entry.skipped.includes(step.id));
  const next = order.find((step) => !done.includes(step) && step !== running && !departed(step));
  return {
    done,
    ...(running === undefined ? {} : { running }),
    ...(next === undefined ? {} : { next }),
  };
}

/**
 * What the caller knows about a ticket that its labels do not say.
 *
 * `isStep` is true for a step ticket of an initiative, and `isRemediation`
 * for a run answering a review of its pull request. Neither is written on the
 * ticket as a label: a step ticket carries the labels its initiative gave it,
 * and a review is on the pull request. So the caller, which knows where the
 * run came from, says so.
 */
export interface TicketContext {
  isStep: boolean;
  isRemediation: boolean;
}

/**
 * The kind of a ticket, so its written order can be found with
 * {@link defaultOrder}. The brief and the runner's actions both read it here,
 * so the order the runner is shown is the order its skips are judged against.
 *
 * **The caller's context comes first, then the labels.** A remediation wins
 * over everything, because the work it answers is already at a pull request
 * whatever kind of ticket started it. A step ticket is a step whatever its
 * labels say: it can carry `wayfinder:map` or `triage:feature` from the
 * initiative it came from, and neither order is the one its run follows.
 *
 * Then `wayfinder:<type>`, read as {@link wayfinderStage} reads it — `map` is
 * the map, `research` is research, and the other types are decisions settled
 * with a person — then `triage:<kind>`.
 *
 * **A ticket with neither label is a feature.** That is the longest order, so
 * a ticket read wrongly here has steps shown to the runner that it may leave
 * out with a reason, rather than steps missing that it would never be told
 * about. A ticket not yet sorted also starts at sorting, as a feature does.
 */
export function ticketKindOf(
  labels: readonly string[],
  context: TicketContext,
): TicketKind {
  if (context.isRemediation) return "remediation";
  if (context.isStep) return "step";
  const wayfinder = wayfinderStage(labels);
  if (wayfinder === "charting") return "map";
  if (wayfinder === "research") return "research";
  if (wayfinder === "wayfinding") return "decision";
  return classificationFromLabels(labels) ?? "feature";
}
