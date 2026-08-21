import { type Step } from "../adapters/ticketing.js";

/**
 * The frontier: which step of an initiative the daemon takes next.
 *
 * Under [ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)
 * a step is a ticket, so the next step is *read off the tracker* rather than
 * counted from the ledger. This module is the rule and nothing else: pure,
 * offline, and given whatever the ticketing adapter managed to read.
 */

/**
 * The label that says the machine is holding a step and will not take it up.
 *
 * It is what a `timone cancel` leaves behind: the run is dead, the step ticket
 * stays open, and this label is the only thing keeping the frontier off it
 * ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
 * D3). A label rather than an assignee because **a GitHub App's bot cannot be
 * an issue assignee at all** — every route refuses, and that path is reserved
 * for GitHub's own registered coding agents.
 *
 * It does not collide with the mark: `listMarkedTickets` filters on the exact
 * name `timone`, so a step carrying both is marked and held at once, which is
 * precisely what a dropped step is. Removing this label is how a human hands
 * the step back ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
 * D7) — the one act in the system with no `timone` command behind it.
 */
export const HELD_LABEL = "timone:held";

/**
 * The first step that is **open, unblocked, unheld and unclaimed**, or
 * `undefined` when there is none — which is the signal to close the
 * initiative.
 *
 * The four conditions are one rule, and **any of them read alone lets a
 * stopped step be retaken**: the hold if the labels are skipped, a human's
 * takeover if the assignees are. The function asks whether a claim exists and
 * never who made it — it knows no login and compares against no identity.
 *
 * A dependency carries its own openness rather than a number to resolve, so a
 * cycle simply blocks every step in it and the call returns `undefined`
 * instead of looping. A step whose dependency list came back incomplete is
 * **blocked**, never free.
 */
export const nextStep = (steps: Step[]): Step | undefined =>
  steps.find(
    (s) =>
      s.state === "open" &&
      !s.labels.includes(HELD_LABEL) &&
      s.assignees.length === 0 &&
      !s.dependenciesIncomplete &&
      !s.blockedBy.some((d) => d.open),
  );
