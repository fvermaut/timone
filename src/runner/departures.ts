import type { PipelineStage } from "../daemon/pipeline.js";
import { joined } from "./comments.js";
import type { OrderStep } from "./order.js";
import type { RecordEntry } from "./record.js";

/**
 * The departures of a run: the steps of its written order that did not run
 * or ran out of order, and the section of the pull request that lists them.
 *
 * **A departure is allowed; a hidden one is the fault.** The runner may leave
 * the default order when it has a reason. What it may not do is leave it
 * quietly, so the list is worked out here from the run record — which the
 * machine writes — and never from anything the runner says about itself.
 */

/** The line that opens the departures section of a pull request. */
export const DEPARTURES_START = "<!-- timone:departures -->";

/** The line that closes it. */
export const DEPARTURES_END = "<!-- /timone:departures -->";

/**
 * One step of the written order that did not run as written: either it never
 * ran, or it ran after a step that comes later in the order had started.
 */
export type Departure = {
  kind: "did-not-run" | "out-of-order";
  step: OrderStep;
  /** The runner's reason, from its `departure` entry, or undefined when it gave none. */
  reason: string | undefined;
};

/**
 * Where in `order` an entry of the record says the run reached, or undefined
 * when the entry is not one of the order's steps running.
 *
 * An approval step is reached by a named person's approval, not by a
 * session; every other step by a session starting at its stage.
 */
function stepIndexOf(entry: RecordEntry, order: readonly OrderStep[]): number | undefined {
  let index = -1;
  if (entry.kind === "step-started") {
    index = order.findIndex((step) => step.stage === entry.stage);
  } else if (entry.kind === "approval") {
    index = order.findIndex((step) => step.approval === entry.what);
  }
  return index === -1 ? undefined : index;
}

/**
 * The stages that build the work a check looks at: building it, and acting
 * on a review of it.
 */
const BUILDING_STAGES: readonly PipelineStage[] = ["execution", "remediation"];

/**
 * The entries of one run written after its latest building started, oldest
 * first, or undefined when nothing was built. `ofRun` is one run's entries,
 * oldest first.
 *
 * **A check counts only for what was built before it started.** Whatever
 * the check once said, it said nothing about a building that came after
 * it, so what counts for the work as it is now starts here.
 */
export function sinceLastBuild(ofRun: readonly RecordEntry[]): readonly RecordEntry[] | undefined {
  let last = -1;
  ofRun.forEach((entry, position) => {
    if (entry.kind === "step-started" && BUILDING_STAGES.includes(entry.stage)) last = position;
  });
  return last === -1 ? undefined : ofRun.slice(last + 1);
}

/**
 * Whether the work built last was taken past the check without one: a step
 * that comes after the check in `order` started after the latest building,
 * and the check did not start again after it.
 */
function deliveredUnchecked(ofRun: readonly RecordEntry[], order: readonly OrderStep[]): boolean {
  const check = order.findIndex((step) => step.check === true);
  const since = sinceLastBuild(ofRun);
  if (check === -1 || since === undefined) return false;
  const indices = since.flatMap((entry) =>
    entry.kind === "step-started" ? [order.findIndex((step) => step.stage === entry.stage)] : [],
  );
  return indices.some((index) => index > check) && !indices.includes(check);
}

/**
 * The departures of run `runId` from `order`, in the order's own sequence.
 *
 * **Only the steps before the furthest one reached are judged.** A step the
 * run has not got to yet is not a departure; it is work still to come. Once
 * the run has reached delivery, everything before delivery is judged.
 *
 * **Every time a step starts after a later step, it ran out of order**
 * (verification of phase 40). Going back to building after the check is a
 * step that ran out of order, as the register defines a departure, so it is
 * listed. A step that went back several times is still one line. A step
 * started again before any later step ran is not out of order.
 *
 * **But the work that building made still needs its check.** When a step
 * after the check starts after the latest building, with no check between
 * them, the check did not run for that work, and it is listed as not run
 * (verification of phase 40): delivering it is a skipped check like any
 * other, and the first line a person reads says so.
 *
 * The reason for a step is taken from the latest `departure` entry of the
 * run that names it. The runner may give a reason more than once, and the
 * latest one is the one it holds to.
 */
export function departuresOf(
  entries: readonly RecordEntry[],
  runId: string,
  order: readonly OrderStep[],
): Departure[] {
  const ofRun = entries.filter((entry) => "runId" in entry && entry.runId === runId);
  const reached = new Set<number>();
  const late = new Set<number>();
  let furthest = -1;
  for (const entry of ofRun) {
    const index = stepIndexOf(entry, order);
    if (index === undefined) continue;
    if (index < furthest) late.add(index);
    reached.add(index);
    furthest = Math.max(furthest, index);
  }

  const reasonFor = (step: OrderStep): string | undefined => {
    let reason: string | undefined;
    for (const entry of ofRun) {
      if (entry.kind === "departure" && entry.skipped.includes(step.id)) {
        reason = entry.reason;
      }
    }
    return reason;
  };

  // **No step reached, no departure** (40u). With nothing reached `furthest`
  // stays −1, and `order.slice(0, -1)` is every step but the last: the first
  // brief of a new feature ticket listed nine steps as "did not run" before
  // anything had run.
  if (furthest === -1) return [];

  const unchecked = deliveredUnchecked(ofRun, order);

  return order.slice(0, furthest).flatMap((step, index): Departure[] => {
    if (!reached.has(index) || (step.check === true && unchecked)) {
      return [{ kind: "did-not-run", step, reason: reasonFor(step) }];
    }
    if (late.has(index)) return [{ kind: "out-of-order", step, reason: reasonFor(step) }];
    return [];
  });
}

/**
 * The block of a pull request's description that lists `departures`,
 * between {@link DEPARTURES_START} and {@link DEPARTURES_END}.
 *
 * **A skipped check is its first line.** Nothing else on the list changes
 * how far a person can trust the work as much as that one does, so it comes
 * before anything else they read. The markers are HTML comments, which a
 * rendered description does not show, so it is also the first line they see.
 */
export function departureSection(departures: readonly Departure[]): string {
  if (departures.length === 0) {
    return [DEPARTURES_START, "The default order was followed.", DEPARTURES_END].join("\n");
  }
  const lines = [DEPARTURES_START];
  const check = departures.find(
    (departure) => departure.kind === "did-not-run" && departure.step.check,
  );
  if (check !== undefined) {
    lines.push(
      "**Not checked.** No session other than the one that built this work checked it. " +
        reasonText(check.reason),
    );
  }
  const others = departures.filter((departure) => departure !== check);
  if (others.length > 0) {
    if (check !== undefined) lines.push("");
    lines.push("**Steps that did not follow the default order:**");
    for (const group of sharingAReason(others)) {
      lines.push(
        `- ${capitalised(joined(group.labels))}: ${whatHappened(group.first)} ${reasonText(group.first.reason)}`,
      );
    }
  }
  lines.push(DEPARTURES_END);
  return lines.join("\n");
}

/** Departures listed on one line: the first of them, and the labels of all of them. */
interface Group {
  first: Departure;
  labels: string[];
}

/**
 * `departures` gathered by what happened to them and their reason, each
 * group where its first departure was.
 *
 * **One reason is said once** (40r). The runner often leaves out several
 * steps with one reason, and scratch-app#61's list said the same reason
 * seven times, once under each step. A person reads one line that names the
 * steps, and the reason after them.
 *
 * **A step that ran out of order is never on a line with one that did not
 * run.** The line says one thing happened to every step it names.
 */
function sharingAReason(departures: readonly Departure[]): Group[] {
  const groups: Group[] = [];
  for (const departure of departures) {
    const group = groups.find(
      (each) =>
        each.first.kind === departure.kind &&
        reasonKey(each.first.reason) === reasonKey(departure.reason),
    );
    if (group === undefined) groups.push({ first: departure, labels: [departure.step.label] });
    else group.labels.push(departure.step.label);
  }
  return groups;
}

/**
 * The reason as departures are grouped by it: trimmed, and one value for
 * every reason that {@link reasonText} shows as missing.
 */
function reasonKey(reason: string | undefined): string {
  return (reason ?? "").trim();
}

/** What happened to a departed step, in the words the list uses. */
function whatHappened(departure: Departure): string {
  switch (departure.kind) {
    case "did-not-run":
      return "did not run.";
    case "out-of-order":
      return "ran out of order.";
    default:
      return departure.kind satisfies never;
  }
}

/** `label` with its first letter in capitals, to start a line of the list. */
function capitalised(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The runner's reason as the list shows it. A missing reason is written as
 * missing rather than left blank: the departure still happened, and a person
 * should see that nobody explained it. A reason of only spaces counts as
 * missing, since it explains nothing either.
 */
function reasonText(reason: string | undefined): string {
  return reason === undefined || reason.trim() === ""
    ? "No reason given."
    : `Reason: ${reason}`;
}
