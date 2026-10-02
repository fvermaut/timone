import { HELD_LABEL } from "./steps.js";
import type { RunStore } from "./runs.js";

/**
 * How a human starts a **dropped step** again — or `undefined` when the
 * ticket is not a step, and the caller's own sentence is the true one.
 *
 * Two different things are true here and they must not be said to each other:
 *
 * - A **step** the machine dropped is *held*, by {@link HELD_LABEL}, and stays
 *   stopped until somebody takes the hold off
 *   ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
 *   D2 and D7). Closed instead, it lets the initiative carry on without it.
 * - **Any other ticket** has no initiative to carry on. `timone cancel` puts
 *   the hold on it too, but a ticket cancelled before 40u, or whose run the
 *   old code failed, has none. So each caller says its way back in its own
 *   words.
 *
 * Telling a ticket to remove a label it does not carry names a gesture with
 * no effect. A slice that assumed every cancelled run was a dropped step
 * shipped that once, and asking what a poll cycle would post on a real
 * non-step ticket is what caught it.
 *
 * **Its own module because two commands ask the question**: `timone cancel`
 * and `timone takeover`. Each keeps its own lead-in; only the way out is
 * shared.
 */
export function heldStepWayOut(
  store: RunStore,
  project: string,
  ticket: number,
): string | undefined {
  return store.initiativeFor(project, ticket) === undefined
    ? undefined
    : `remove the \`${HELD_LABEL}\` label from the ticket and I'll start it ` +
        "afresh, or close it and I'll carry on without it.";
}
