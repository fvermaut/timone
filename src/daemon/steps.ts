import { type Step } from "../adapters/ticketing.js";

/**
 * The frontier: which steps of an initiative the daemon may take up.
 *
 * Under [ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)
 * a step is a ticket, so the steps to take are *read off the tracker* rather
 * than counted from the ledger. This module is the rule and nothing else: pure,
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
 * The label that puts a ticket first in the order a freed place on its
 * project is given ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)
 * D3). It is read from the ticket each time one of its steps asks for a
 * place, so a label added later counts from the next try.
 */
export const PRIORITY_LABEL = "priority:high";

/**
 * What the hold label says on the tracker, for whoever reads it there.
 *
 * **Under 100 characters, and that is a hard limit rather than a style.**
 * GitHub refuses a longer one with `HTTP 422: Validation Failed` and says
 * nothing about which field was wrong — which is exactly how phase 29's live
 * gate failed, at 111 characters, with the 422 surfacing as *"stopped part
 * way"* and no step tickets opened. See {@link MAP_LABEL_DESCRIPTION}.
 */
export const HELD_LABEL_DESCRIPTION =
  "Timone stopped this step. Remove this label to hand it back and it starts again.";

/**
 * The label that says a ticket is an initiative's **map** rather than work.
 *
 * Applied when its breakdown is approved and its body is rewritten into the
 * list of its children (29c). It is what keeps the daemon from opening a run
 * on the initiative itself alongside the runs on its steps — the map is a
 * conversation, and the work belongs to the tickets it points at.
 *
 * A label rather than "has children" because the loop already holds every
 * marked ticket's labels, so reading it costs nothing, and because it is
 * **visible**: a human looking at the tracker can see which ticket is the map.
 */
export const MAP_LABEL = "timone:map";

/** What the map label says on the tracker. Under 100 characters — see {@link HELD_LABEL_DESCRIPTION}. */
export const MAP_LABEL_DESCRIPTION =
  "The map of a job. The work happens on the tickets listed in it, not here.";

/**
 * Every step that is **open, unblocked, unheld and unclaimed**, in the
 * listing's order. An empty list is the signal to close the initiative.
 *
 * It used to return only the first such step, so one initiative built one
 * step at a time. Now every step that meets the four conditions may be picked
 * up ([PRD-07.R4](../../doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r4--nothing-is-built-on-top-of-an-open-pull-request),
 * [ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D6). How many of them build at once is decided later, by the project's
 * places and the planner, not here.
 *
 * The four conditions are one rule, and **any of them read alone lets a
 * stopped step be retaken**: the hold if the labels are skipped, a human's
 * takeover if the assignees are. The function asks whether a claim exists and
 * never who made it — it knows no login and compares against no identity.
 *
 * A dependency carries its own openness rather than a number to resolve, so a
 * cycle simply blocks every step in it and none of them is returned, with no
 * loop. A step whose dependency list came back incomplete is **blocked**,
 * never free.
 */
export const eligibleSteps = (steps: Step[]): Step[] =>
  steps.filter(
    (s) =>
      s.state === "open" &&
      !s.labels.includes(HELD_LABEL) &&
      s.assignees.length === 0 &&
      !s.dependenciesIncomplete &&
      !s.blockedBy.some((d) => d.open),
  );
