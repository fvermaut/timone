import {
  NEEDED_FROM_YOU,
  type TicketingAdapter,
  type TicketingProject,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import type { Run, RunStore } from "../daemon/runs.js";
import { namedPersonsComment, type ActionResult } from "../runner/actions.js";
import { untilMergedOrClosed } from "../runner/brief.js";
import { joined } from "../runner/comments.js";
import { appendEntry, type RecordEntry } from "../runner/record.js";
import { planNotRead } from "./brief.js";
import type { PlanFact, PlannerFacts } from "./facts.js";
import type { HoldInput, LetBuildInput, PassToRunnerInput, ReadPlanInput } from "./tools.js";

/**
 * The planner's actions: the only things the planner can do
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D3, D5).
 *
 * **The planner judges; code keeps the rules**, as for the runner. Each
 * action checks what must hold before it acts — the ticket is the one being
 * decided, one decision per session, a hold names only tickets the planner
 * was shown, a comment is a named person's — and refuses in plain words when
 * it does not.
 *
 * **Code writes what the ticket is told**, in fixed words: a hold names each
 * ticket waited for and gives the planner's reason.
 */

/** What the planner's actions need from outside. */
export interface PlannerActionDeps {
  store: RunStore;
  adapter: Pick<TicketingAdapter, "getTicket" | "postComment">;
  manifest: Manifest;
  project: TicketingProject;
  /** The Timone root, where the run record lives (`.timone/records/`). */
  root: string;
  /** The time now, as an ISO-8601 timestamp. */
  clock: () => string;
}

/** The actions the planner can take in one session, deciding one ticket. */
export interface PlannerActions {
  letBuild(input: LetBuildInput): Promise<ActionResult>;
  hold(input: HoldInput): Promise<ActionResult>;
  passToRunner(input: PassToRunnerInput): Promise<ActionResult>;
  readPlan(input: ReadPlanInput): Promise<ActionResult>;
}

/**
 * What the `notice` entry says when the planner passed a named person's
 * comment to the runner: the runner's driver delivers a comment so passed to
 * a run that waits for the planner, and no other (ADR-0065 D5).
 */
export function passedToRunner(commentAt: string): string {
  return `passed to runner: comment at ${commentAt}`;
}

/** The text, trimmed, with a full stop added when it ends without one. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** `#7`, `#7 and #9`. */
function numbers(tickets: readonly number[]): string {
  return joined(tickets.map((ticket) => `#${ticket}`));
}

/**
 * The comment that says a ticket is held: which tickets it waits for, and
 * why, in the planner's words.
 */
function holdComment(waitsFor: readonly number[], reason: string): string {
  return [
    `**This ticket waits for ${numbers(waitsFor)} before it is built.** ${sentence(reason)} ` +
      `I will look again when ${untilMergedOrClosed(waitsFor)}.`,
    "",
    `${NEEDED_FROM_YOU} nothing. If it should be built now anyway, say so here.`,
  ].join("\n");
}

/**
 * The comment that says the ticket is let build on a named person's comment,
 * naming that person.
 */
function letBuildComment(by: string): string {
  return [
    `**I am building this ticket now, on ${by}'s comment.** It starts as soon as a place on ` +
      "the project is free.",
    "",
    `${NEEDED_FROM_YOU} nothing.`,
  ].join("\n");
}

/** The planner's actions for `run`, given the facts its session was started with. */
export function plannerActions(
  deps: PlannerActionDeps,
  run: Run,
  facts: PlannerFacts,
): PlannerActions {
  /** Add one entry to the end of the ticket's record. */
  const write = (entry: RecordEntry): void => {
    appendEntry(deps.root, deps.project.name, run.ticket, entry);
  };

  /** The tickets a hold may wait for: those building, with an open pull request, or blocking this one. */
  const shown = new Set([
    ...facts.others.map((other) => other.number),
    ...facts.blockers.map((blocker) => blocker.number),
  ]);

  /** Whether this session has decided: one decision, once. */
  let decided = false;

  /**
   * `body` as one of the three decisions: refused for a ticket other than
   * the one being decided, or once a decision is taken in this session.
   */
  const decision =
    <Input extends { ticket: number }>(body: (input: Input) => Promise<ActionResult>) =>
    async (input: Input): Promise<ActionResult> => {
      if (input.ticket !== run.ticket) {
        return {
          ok: false,
          refused: `You decide for ticket #${run.ticket} only, not for #${input.ticket}.`,
        };
      }
      if (decided) {
        return {
          ok: false,
          refused: `You have already decided for ticket #${run.ticket} in this session. Decide only once.`,
        };
      }
      const result = await body(input);
      if (result.ok) decided = true;
      return result;
    };

  /** The plan of each ticket the planner was shown, the one it decides first. */
  const plans = new Map<number, PlanFact>([
    [run.ticket, facts.ticket.plan],
    ...facts.others.map((other): [number, PlanFact] => [other.number, other.plan]),
  ]);

  return {
    letBuild: decision(async ({ reason, commentAt }) => {
      let onComment: { by: string; at: string } | undefined;
      if (commentAt !== undefined) {
        const found = await namedPersonsComment(
          deps,
          run.ticket,
          commentAt,
          "Only a named person can have a ticket built before the planner would let it.",
        );
        if (!found.ok) return found;
        onComment = { by: found.comment.author, at: commentAt };
      }
      const at = deps.clock();
      const on = onComment === undefined ? {} : { onComment };
      deps.store.decidePlanner(run.id, { kind: "build", at, reason, ...on });
      write({ kind: "planner-decision", at, runId: run.id, decision: "build", reason, ...on });
      if (onComment !== undefined) {
        await deps.adapter.postComment(deps.project, run.ticket, letBuildComment(onComment.by));
      }
      return { ok: true, said: `Ticket #${run.ticket} may be built now.` };
    }),
    hold: decision(async ({ waitsFor, reason }) => {
      if (waitsFor.length === 0) {
        return { ok: false, refused: "Name at least one ticket this ticket waits for." };
      }
      const unknown = waitsFor.filter((number) => !shown.has(number));
      if (unknown.length > 0) {
        return {
          ok: false,
          refused:
            `${numbers(unknown)} ${unknown.length === 1 ? "is not a ticket" : "are not tickets"} ` +
            "you were shown as building, with an open pull request, or blocking this ticket. " +
            "This ticket can wait only for one of those.",
        };
      }
      const at = deps.clock();
      deps.store.decidePlanner(run.id, { kind: "hold", at, reason, waitsFor });
      write({ kind: "planner-decision", at, runId: run.id, decision: "hold", reason, waitsFor });
      await deps.adapter.postComment(deps.project, run.ticket, holdComment(waitsFor, reason));
      return {
        ok: true,
        said: `Ticket #${run.ticket} is held until ${untilMergedOrClosed(waitsFor)}. The ticket is told why.`,
      };
    }),
    passToRunner: decision(async ({ commentAt }) => {
      const woke = facts.comment;
      if (woke === undefined) {
        return { ok: false, refused: "No comment woke you, so there is no comment to pass to the runner." };
      }
      if (woke.createdAt !== commentAt) {
        return {
          ok: false,
          refused: `The comment that woke you is the one at ${woke.createdAt}, not one at ${commentAt}.`,
        };
      }
      write({ kind: "notice", at: deps.clock(), about: passedToRunner(commentAt) });
      return {
        ok: true,
        said:
          `The comment at ${commentAt} goes to the runner. Ticket #${run.ticket} still waits ` +
          "for a decision.",
      };
    }),
    readPlan: async ({ ticket }) => {
      const plan = plans.get(ticket);
      if (plan === undefined) {
        return {
          ok: false,
          refused: `#${ticket} is not a ticket you were shown, so you cannot read its plan.`,
        };
      }
      if (plan.kind === "unknown") {
        return { ok: false, refused: planNotRead(ticket, plan.why) };
      }
      if (plan.value === undefined) return { ok: false, refused: `#${ticket} has no plan yet.` };
      return { ok: true, said: plan.value.text };
    },
  };
}
