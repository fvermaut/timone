import { NEEDED_FROM_YOU } from "../adapters/ticketing.js";
import type { Standing } from "./order.js";

/**
 * What the machine itself says on a ticket when the runner acts
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md),
 * PRD-05).
 *
 * **Written by code, not by the runner.** A skipped step and a reached limit
 * are the two things a person must always be told, so the words are fixed
 * here rather than left to a model that might forget them or soften them.
 *
 * Every notice is read by a person who does not know how Timone works, and
 * who may not read English as a first language: short sentences, common
 * words, no words from Timone's own process, and a last line saying what is
 * needed from them.
 */

/** What a departure notice is made from. */
export interface DepartureNoticeInput {
  /** What a person calls each step left out, in the order they come. */
  skippedLabels: readonly string[];
  /** The runner's reason, in its own words. */
  reason: string;
  /** What a person calls the step that is starting instead. */
  nextLabel: string;
}

/**
 * The comment that says the runner is leaving out steps of the default
 * order, posted before the step that leaves them out starts.
 */
export function departureNotice(input: DepartureNoticeInput): string {
  const one = input.skippedLabels.length === 1;
  return [
    `**I am skipping ${one ? "a step" : `${input.skippedLabels.length} steps`}.** ` +
      `I am going straight to ${input.nextLabel}, without ${joined(input.skippedLabels)}. ` +
      `Reason: ${sentence(input.reason)}`,
    "",
    `${NEEDED_FROM_YOU} nothing. If you want ${one ? "the skipped step" : "the skipped steps"} ` +
      "done after all, say so here.",
  ].join("\n");
}

/** What a limit notice is made from, in dollars. */
export interface LimitNoticeInput {
  /** What every session of the ticket has cost so far. */
  spentUsd: number;
  /** What the ticket may spend now, raises included. */
  allowanceUsd: number;
  /** What one "continue" from a named person adds: the project's limit. */
  raiseUsd: number;
  /** Where the run's work stands against its written order (`standingOf`). */
  standing: Standing;
}

/**
 * The comment that says the ticket has spent what it may, so no new step
 * starts until a named person allows more (ADR-0060 D5). Posted once each
 * time the limit is reached, not once for every step that is refused.
 *
 * It says where the work stands too (PRD-05 R8): what is done, what is
 * running, and what the written order puts next. A person deciding whether
 * to allow more needs to know what the money has bought so far.
 */
export function limitNotice(input: LimitNoticeInput): string {
  return [
    `**This ticket has reached its spending limit.** It has cost ${usd(input.spentUsd)}, ` +
      `and the limit is ${usd(input.allowanceUsd)}. I will not start any more work on it for now.`,
    "",
    standingText(input.standing),
    "",
    `${NEEDED_FROM_YOU} reply "continue" to allow another ${usd(input.raiseUsd)}, ` +
      "or say nothing and it stays stopped.",
  ].join("\n");
}

/** Where the work stands, in a few short sentences. */
function standingText(standing: Standing): string {
  const done =
    standing.done.length === 0
      ? "Nothing is done yet."
      : `Done so far: ${joined(standing.done.map((step) => step.label))}.`;
  const running =
    standing.running === undefined ? [] : [`Running now: ${standing.running.label}.`];
  const next =
    standing.next === undefined
      ? "Every step of the usual order is done."
      : `Next, in the usual order: ${standing.next.label}.`;
  return [done, ...running, next].join(" ");
}

/**
 * The comment that says the list of pieces was approved, the requirements
 * and the list are on the default branch, and the pieces have their tickets.
 * Posted once all three are true, and not before: until then the approval is
 * written down but not acted on.
 */
export function piecesApprovedNotice(by: string): string {
  return [
    `**The list of pieces is approved.** ${by} approved it. I added the requirements and the ` +
      "list to the project's default branch, and each piece now has its own ticket, listed at " +
      "the top of this one.",
    "",
    `${NEEDED_FROM_YOU} nothing.`,
  ].join("\n");
}

/**
 * What went wrong after a named person approved the list of pieces (40x):
 * the merge into the default branch, or, once that was done, opening a
 * ticket for each piece. `said` is what the forge or git said, as it said it.
 */
export type PiecesFailure =
  | { failed: "merge"; conflict: boolean; said: string }
  | { failed: "tickets"; said: string };

/**
 * The comment that says the approved list of pieces could not be acted on
 * (40x). Posted once, when it happens.
 *
 * **The run is not ended, so there is nothing to start again.** The runner
 * is woken, and reads the replies on the ticket. So the comment names no
 * command and no standing note: it says what failed, and that a reply here
 * is read.
 */
export function piecesFailedNotice(failure: PiecesFailure): string {
  const what =
    failure.failed === "tickets"
      ? "**I could not open a ticket for each piece.** The approval is written down, and the " +
        "requirements and the list of pieces are on the project's default branch."
      : "**I could not add the requirements and the list of pieces to the project's default branch.** " +
        (failure.conflict
          ? "The approval is written down. But the default branch has changes that clash with " +
            "them, so nothing was added. Someone has to decide which version to keep."
          : "The approval is written down, but nothing was added.");
  return [
    what,
    "",
    `What went wrong: ${sentence(failure.said)}`,
    "",
    `${NEEDED_FROM_YOU} reply here to say what to do next. I read every reply on this ticket.`,
  ].join("\n");
}

/** Dollars as a person reads them: `$150.40`. */
function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** `a`, `a and b`, `a, b and c`. */
export function joined(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The text, trimmed, with a full stop added when it ends without one. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
