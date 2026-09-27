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
 * ran, or it ran only after a step that comes later in the order.
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
 * The departures of run `runId` from `order`, in the order's own sequence.
 *
 * **Only the steps before the furthest one reached are judged.** A step the
 * run has not got to yet is not a departure; it is work still to come. Once
 * the run has reached delivery, everything before delivery is judged.
 *
 * **Only the first time a step ran decides whether it was out of order.**
 * Going back to building after the check found a fault is how the work gets
 * fixed, not a change to the order. Listing it would add a line for every
 * round of fixes, and the real departures would be hard to find among them.
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
    if (index === undefined || reached.has(index)) continue;
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

  return order.slice(0, furthest).flatMap((step, index): Departure[] => {
    if (!reached.has(index)) return [{ kind: "did-not-run", step, reason: reasonFor(step) }];
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
    for (const departure of others) {
      lines.push(
        `- ${capitalised(departure.step.label)}: ${whatHappened(departure)} ${reasonText(departure.reason)}`,
      );
    }
  }
  lines.push(DEPARTURES_END);
  return lines.join("\n");
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
