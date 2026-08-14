/**
 * What a ticket says it needs, computed once
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **One computation, two renderers.** {@link ctaFor} decides what an open
 * ticket is asking of the human; {@link ctaComment} renders that onto the
 * ticket and `timone status` renders the same value onto the terminal. Neither
 * renderer decides anything, which is the whole point: the fault this closes is
 * `timone status` asking for an answer on a ticket whose own body said nothing
 * was needed, and two places deciding is what made that possible.
 *
 * It sits beside `gate-comment.ts` because that is where comment composition
 * already lives, and it is pure for the same reason that file is: what a ticket
 * needs is a question about state, not about the tracker.
 */
import { MARK_LABEL } from "../adapters/ticketing.js";
import { takeoverCommand } from "../channels/terminal.js";
import { runId, type Run } from "./runs.js";

/**
 * Everything the CTA is computed from: one ticket, and whatever the ledger and
 * the tracker know about it.
 */
export interface TicketState {
  project: string;
  ticket: number;
  /** The ledger's run for this ticket, or undefined when it has none. */
  run?: Run;
  /**
   * The ticket's labels, as the tracker holds them. Read rather than stored on
   * the run, for the reason `wayfinderStage` gives: a copy in the ledger is a
   * copy that can disagree with a label a human has since changed.
   */
  labels?: readonly string[];
}

/** What one open ticket is asking of the human. */
export interface Cta {
  /** One line: where this ticket stands. Bolded at the top of the comment. */
  headline: string;
  /** What follows "What I need from you:", on every surface that says it. */
  needFromYou: string;
  /**
   * Whether the ticket has stopped and is waiting for the human to **say
   * something on it** — what `timone status`'s closing line names.
   *
   * A run that stopped early needs the human too, and this is false for it:
   * what it needs is a command rather than an answer, and `timone status`
   * reports that in its own sentence beside {@link Cta.command}. The two
   * fields are independent facts about one CTA — who is being waited on, and
   * whether anything they can type moves it.
   */
  waitingOnYou: boolean;
  /** The exact command that moves it, when one does. */
  command?: string;
}

/**
 * The acknowledgement comment's own words for "I have this, and I will write
 * back here" — shared by a ticket the daemon has yet to register and one whose
 * session is running, because from the reader's side they are one situation.
 */
const WORKING_ON_IT = "nothing right now — I'll comment here when I do.";

/**
 * What a ticket in `state` is asking of the human. Pure: no I/O, no clock.
 *
 * Every branch's words are the ones the ticket has already been told
 * elsewhere — `pickedUpComment`, `queuedComment`, `parkedComment`,
 * `failedComment`, `describeWait` — because this relocates the decision rather
 * than restating it in a second dialect.
 */
export function ctaFor(state: TicketState): Cta {
  const { run } = state;

  if (run === undefined) {
    return (state.labels ?? []).includes(MARK_LABEL)
      ? {
          headline: "I'll pick this up on my next pass.",
          needFromYou: WORKING_ON_IT,
          waitingOnYou: false,
        }
      : {
          headline: "I'm not working on this one.",
          needFromYou: `add the \`${MARK_LABEL}\` label to this ticket and I'll pick it up.`,
          waitingOnYou: true,
        };
  }

  if (run.status === "picked-up" || run.status === "active") {
    return {
      headline: "Picked this up.",
      needFromYou: WORKING_ON_IT,
      waitingOnYou: false,
    };
  }

  if (run.status === "done") {
    return {
      headline: "This one is finished.",
      needFromYou: "nothing — file a new ticket for anything else.",
      waitingOnYou: false,
    };
  }

  if (run.status === "queued") {
    return {
      headline: "This one is in the queue.",
      needFromYou: "nothing right now — I'll comment here when I start.",
      waitingOnYou: false,
    };
  }

  if (run.status === "failed") {
    return {
      headline: "Something went wrong while I was working on this.",
      needFromYou: "run the command and I'll pick it up from where it stopped.",
      waitingOnYou: false,
      command: `timone retry ${runId(state.project, state.ticket)}`,
    };
  }

  if (run.waitingKind === "review" && run.pr !== undefined) {
    return {
      headline: "The work is open as a pull request.",
      needFromYou: `your review of pull request #${run.pr}`,
      waitingOnYou: true,
    };
  }

  // Everything left is parked. Written as an assertion rather than a comment
  // so a new run status breaks here at compile time instead of silently
  // falling into the wait below.
  run.status satisfies "parked";

  return {
    // A park with no kind of wait is not waiting on a human at all: it is a
    // run stopped because a stage's machinery does not exist (`resolveWait`
    // says so), and `parkedComment` is what the ticket was already told. The
    // recorded wait names what would unblock it — "the next stage to be
    // built" — which is what R21's first criterion asks of such a ticket.
    headline:
      run.waitingKind === undefined
        ? "That's as far as I can take this one for now."
        : "This one is waiting on you.",
    needFromYou: run.waitingOn ?? "an answer",
    waitingOnYou: true,
    ...(run.waitingKind === "conversation"
      ? { command: takeoverCommand(state.project, state.ticket) }
      : {}),
  };
}

/**
 * The ticket's rendering of a CTA: what happened, the command that moves it
 * when one does, and the closing line — in that order, because every comment
 * Timone posts ends on what is being asked and readers have learned to look
 * at the bottom.
 *
 * A renderer, not a second opinion. Everything it says comes from the {@link
 * Cta} it is handed, so the ticket and `timone status` cannot disagree about
 * what a ticket needs — they are reading one computation.
 */
export function ctaComment(cta: Cta): string {
  return [
    `**${cta.headline}**`,
    ...(cta.command === undefined ? [] : ["", "```", cta.command, "```"]),
    "",
    `**What I need from you:** ${cta.needFromYou}`,
  ].join("\n");
}
