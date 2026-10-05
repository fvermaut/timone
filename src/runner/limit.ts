import type { RecordEntry } from "./record.js";

/**
 * The spending limit of a ticket: how much its sessions have cost, and how
 * much they may cost before no further session starts.
 *
 * **Counted per ticket, across every run of it.** A ticket's work can take
 * several runs, and a limit that started again with each run would never
 * stop a ticket that keeps failing and being retried. The runner's own
 * sessions count too: deciding what to do next costs money like any step.
 * So do the planner's, for the ticket it decided for (ADR-0065 D1).
 */

/**
 * Everything the sessions of a ticket have cost so far, in dollars: every
 * finished step, runner session and planner session in its record.
 *
 * Not rounded. The sum is compared with the limit, and rounding it first
 * could let a ticket start one more session than it may.
 */
export function spentOn(entries: readonly RecordEntry[]): number {
  let spent = 0;
  for (const entry of entries) {
    if (
      entry.kind === "step-ended" ||
      entry.kind === "runner-ended" ||
      entry.kind === "planner-ended"
    ) {
      spent += entry.costUsd;
    }
  }
  return spent;
}

/** The limit of a ticket whose project's entry does not set one. */
export const DEFAULT_LIMIT_USD = 150;

/**
 * How much the ticket may spend: `base` once, and `base` again for each time
 * a named person said "continue".
 *
 * `base` is the project's own limit when its entry sets one, and
 * {@link DEFAULT_LIMIT_USD} when it does not. The caller passes it every
 * time, rather than this file assuming a default, so a project's limit
 * cannot be forgotten on one of the paths that checks it.
 */
export function allowanceOf(entries: readonly RecordEntry[], base: number): number {
  const raises = entries.filter((entry) => entry.kind === "limit-raised").length;
  return base * (1 + raises);
}

/**
 * Whether the ticket has spent its allowance, so no session may start.
 * Reaching it exactly counts: at $150 of $150 nothing more starts.
 */
export function isOverLimit(entries: readonly RecordEntry[], base: number): boolean {
  return spentOn(entries) >= allowanceOf(entries, base);
}
