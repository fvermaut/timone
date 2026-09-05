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
import { HELD_LABEL } from "./steps.js";
import { takeoverCommand } from "../channels/terminal.js";
import { isBuildEscalation, technicalFault } from "./faults.js";
import { CARRY_ON_WAIT, type Run } from "./runs.js";

/**
 * Where a ticket's whole initiative stands, as a plain value.
 *
 * **This is what lets a call to action be about an initiative rather than
 * about a run** ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D4). A ticket is a conversation and a run is one chunk of it (ADR-0026), so
 * between two chunks the ticket's last run is `done` while the initiative is
 * very much alive — and a computation that only ever looked at the run said
 * *this one is finished* into that gap, on every ticket, between every pair of
 * pieces.
 *
 * It carries how far the initiative has got, plus the one fact about the
 * *artifact* a reader of the ticket has to be told: that the list has grown
 * since they approved it. The two are orthogonal — a re-proposed initiative is
 * still some number of pieces through — so this is not a state wearing flags,
 * it is two facts about one initiative.
 *
 * **✏ 29d: it no longer extends `ChunkProgress`.** It carried the same three
 * fields by inheritance while those fields meant *chunks counted out of the
 * ledger*. They now mean *step tickets read off the tracker*, which is the
 * same shape and a different fact, and inheriting from the counting model
 * would tie this to a type 29g deletes.
 *
 * **Computed by the caller**, never here: it comes from a file in a project's
 * checkout, and this module reads nothing. See `initiativeProgress` in
 * `poll.ts`, which is the one function both surfaces resolve it through.
 */
export interface InitiativeProgress {
  /** How many steps the initiative has. */
  total: number;
  /** How many of them are done. */
  done: number;
  /** The step to take next, or absent when none is. `index` counts from 1. */
  next?: { index: number; title: string };
  /** Whether the list of pieces has grown since the human approved it. */
  reproposed?: boolean;
}

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
   * Where the ticket's initiative stands, or undefined when it has no
   * breakdown at all — which is nearly every ticket, and every chore
   * (ADR-0030 D3). Undefined means *say exactly what you said before pieces
   * existed*, and that is what every branch below does with it.
   */
  progress?: InitiativeProgress;
  /**
   * The ticket's labels, as the tracker holds them. Read rather than stored on
   * the run, for the reason `wayfinderStage` gives: a copy in the ledger is a
   * copy that can disagree with a label a human has since changed.
   */
  labels?: readonly string[];
  /**
   * The step a handback note named that this machine could not use
   * ([ADR-0035](../../doc/adr/0035-a-resolved-escalation-hands-the-run-back.md)
   * D3), quoted exactly as the session wrote it — and **which of the two ways
   * it was unusable**.
   *
   * The two were rendered as one until phase 27, and the collapsed message was
   * wrong about half the cases it described. `unknown` is a name nobody
   * defined, and *"I don't know what that means"* is the truth about it.
   * `unbuilt` is a name that is perfectly well defined and has no session
   * behind it — `keeping the list of questions` is a real step of this process
   * that nothing runs — and telling a person the machine cannot read its own
   * handwriting sends them off to correct a note that was never wrong.
   *
   * Read off the thread by the caller for the same reason `labels` is: it is
   * a fact about a comment, not about the run, and a copy in the ledger would
   * be free to disagree with the thread the moment a corrected note is
   * posted.
   */
  misreadStep?: { named: string; kind: "unknown" | "unbuilt" };
  /**
   * Whether this ticket is a **step waiting on another step**, and so one the
   * frontier will pass over every cycle
   * ([ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)).
   *
   * Absent means *not known to be waiting*, which is the honest default: a
   * chore, a bug, and every ticket that is nobody's step all sit here, and
   * they are all things the machine really will pick up on its next pass.
   *
   * ✏ Added by phase 29's live gate, which found a step that waited on
   * another announcing *"I'll pick this up on my next pass."* on its own
   * ticket. It never would have.
   */
  blocked?: boolean;
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
   * reports that in its own sentence beside {@link Cta.command}.
   *
   * **✏ 29j — a *dropped* step needs the human and is still false here**, and
   * the reason is worth writing down because the opposite looks right. Its
   * two ways on are gestures on the tracker rather than a command, so there
   * is nothing to report beside {@link Cta.command} either — which reads like
   * an argument for setting this true. It is not: `timone status` lists every
   * cancelled run with its reason regardless, so the step is never invisible;
   * and the daemon cancels a run when its ticket is **closed**, so true would
   * ask the human to act on a ticket that is already shut.
   *
   * The two
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
 * What a ticket says when there is genuinely nothing left: the last piece
 * merged, and the conversation is over
 * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D3). The words `mergedComment` closes on, so the standing line and the
 * closing comment do not say the same thing twice over in two dialects.
 */
const FINISHED: Cta = {
  headline: "This one is finished.",
  needFromYou: "nothing — file a new ticket for anything else.",
  waitingOnYou: false,
};

/**
 * How a piece is spoken about: *piece 2 of 4*. The human never types or reads
 * a chunk id or a sequence number (`CONTEXT.md`, ADR-0026), so this is the
 * only rendering of one anywhere.
 */
function piece(index: number, total: number): string {
  return `piece ${index} of ${total}`;
}

/**
 * What a ticket with **no live chunk** says about its initiative, or undefined
 * when the initiative has nothing left to say and the run's own answer stands.
 *
 * The two states here are the ones a run-shaped view could not see
 * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D4): *between chunks*, where the next piece is coming and nothing is needed;
 * and *re-proposed*, where the list grew since it was approved and the human
 * is genuinely being waited on. Both were rendered as "this one is finished"
 * before — permanently, in the second case.
 */
function betweenChunks(progress: InitiativeProgress | undefined): Cta | undefined {
  if (progress === undefined) return undefined;

  if (progress.reproposed === true) {
    // `reproposedComment`'s own words, minus the file it names: what the human
    // is being asked is a judgement, and the path is a fact this module has no
    // business knowing (it reads nothing).
    return {
      headline: "The list of pieces has grown since you approved it.",
      needFromYou: "say here whether to carry on with the longer list.",
      waitingOnYou: true,
    };
  }

  if (progress.next === undefined) {
    // **No *eligible* step is not the same as no step left**, and reading the
    // first as the second is how an initiative with nothing built announced
    // *"This one is finished."* on its own ticket — found by phase 29's live
    // gate, on the thread it was opened to read. A step can be ineligible
    // because the machine is holding it or because it waits on another, and
    // in both cases the initiative is very much alive.
    if (progress.done >= progress.total) return undefined;
    return {
      headline: `${progress.done} of ${progress.total} pieces are done, and none of the rest can start yet.`,
      needFromYou:
        "have a look at the pieces below — one of them is either stopped or " +
        "waiting for another.",
      waitingOnYou: true,
    };
  }

  return {
    headline: `${capitalize(piece(progress.next.index, progress.total))} is next.`,
    needFromYou: "nothing right now — I'll start it on my next pass.",
    waitingOnYou: false,
  };
}

/** A sentence starts on a capital, and `piece(…)` is written for mid-sentence. */
function capitalize(sentence: string): string {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * What a ticket in `state` is asking of the human. Pure: no I/O, no clock.
 *
 * Every branch's words are the ones the ticket has already been told
 * elsewhere — `pickedUpComment`, `queuedComment`, `parkedComment`,
 * `failedComment`, `describeWait` — because this relocates the decision rather
 * than restating it in a second dialect.
 */
export function ctaFor(state: TicketState): Cta {
  const { run, progress } = state;

  if (run === undefined) {
    if (state.blocked === true) {
      return {
        headline: "This one is waiting for the piece before it.",
        needFromYou:
          "nothing — I'll start it as soon as the piece it waits for is done.",
        waitingOnYou: false,
      };
    }
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
    // The piece under construction is the one the ledger has *not* finished,
    // which is `next` — a live chunk is not a done one. A ticket with no
    // breakdown keeps the words it has always had.
    const building =
      progress?.next === undefined
        ? undefined
        : piece(progress.next.index, progress.total);
    return {
      headline: building === undefined ? "Picked this up." : `Building ${building}.`,
      needFromYou: WORKING_ON_IT,
      waitingOnYou: false,
    };
  }

  if (run.status === "done") {
    // The ledger's answer is about a *chunk*; the ticket's reader is asking
    // about the initiative. Where a breakdown says a piece remains, the piece
    // is the answer — and only where none does is "finished" the truth.
    return betweenChunks(progress) ?? FINISHED;
  }

  if (run.status === "queued") {
    return {
      headline: "This one is in the queue.",
      needFromYou: "nothing right now — I'll comment here when I start.",
      waitingOnYou: false,
    };
  }

  if (run.status === "failed") {
    // ADR-0052: a build stage that asked a question it had no business
    // asking is filed as a fault, never parked on a person. Checked ahead of
    // `technicalFault` because it is a different kind of machine-caused stop
    // — not the infrastructure breaking under it, but a stage behaving
    // wrongly — and the wording says so rather than borrowing the login/link
    // language below.
    if (isBuildEscalation(run.failure)) {
      return {
        headline: "I asked a question inside the build that I had no business asking, so I stopped.",
        needFromYou: "nothing on this ticket — this is mine to fix, and this command starts me again.",
        waitingOnYou: false,
        command: `timone retry ${state.project}#${state.ticket}`,
      };
    }

    // A stop the machine caused itself does not read like a stop about the
    // work (ADR-0034), and the ticket's two surfaces must not disagree: the
    // comment posted at the moment of failure says the fault was the
    // machine's, and this note is what that comment points the reader at.
    const fault = technicalFault(run.failure);
    if (fault !== undefined) {
      return {
        headline:
          fault === "credentials"
            ? "My login to the service I run on was refused, so I stopped."
            : fault === "expired"
              ? "My login ran out while I was working, and did not come back, so I stopped."
              : "I could not reach the service I run on, so I stopped.",
        needFromYou:
          fault === "credentials" || fault === "expired"
            ? "nothing on this ticket — my login needs fixing first, and then this command starts me again."
            : "nothing on this ticket — this one is mine. Once it is sorted, this command starts me again.",
        waitingOnYou: false,
        command: `timone retry ${state.project}#${state.ticket}`,
      };
    }
    return {
      headline: "Something went wrong while I was working on this.",
      needFromYou: "run the command and I'll pick it up from where it stopped.",
      waitingOnYou: false,
      command: `timone retry ${state.project}#${state.ticket}`,
    };
  }

  if (run.status === "cancelled") {
    // ✏ 29j: **the work is dropped, and it stays dropped.** This branch used
    // to promise *"while this ticket is open and marked for me I'll start it
    // afresh on my next pass"*, on the strength of ADR-0029: cancelling
    // settled the chunk, and an open marked ticket simply took a fresh one.
    // Both halves are false now. `timone cancel` **drops** the work
    // ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
    // D2), and the `timone:held` label the machine leaves behind is exactly
    // what keeps the frontier off the step (D3). A ticket told to wait for a
    // pass that never comes sits open for ever, which is the failure ADR-0040
    // set out to end.
    //
    // **Both ways on, and the label is named rather than described.** A
    // reader who has to look up what "the hold" is cannot act on the sentence
    // in front of them. **Neither way is a `timone` command** — one is
    // removing a label, the other is closing the ticket, and both are two
    // clicks in any GitHub view (D7) — so there is no `command` to print, and
    // reaching for `timone retry` here would name a command the ledger
    // refuses outright.
    //
    // **`waitingOnYou` stays false**, as {@link Cta.waitingOnYou}'s own
    // docblock says it must, and the slice that wrote this branch tried true
    // first on the argument that a dropped step would otherwise appear on no
    // terminal surface. **That argument is false**: `timone status` lists
    // every cancelled run with its reason, unconditionally
    // (`status.ts`'s `cancelled` block), so the step is visible either way.
    // And true is worse than merely unnecessary — the daemon cancels a run
    // when its ticket is **closed** (`poll.ts`'s `no longer open and marked`),
    // and the flag would then put *"answer on scratch-app #6"* in front of a
    // human whose ticket is already shut.
    //
    // The two ways on are carried where they can be acted on: this call to
    // action, on the ticket, which exists only while the ticket is open.
    // **And only for a ticket the machine is actually holding.** A cancelled
    // run is settled, so `loadedLiveRunForTicket` answers nothing for it and
    // `register` opens a **fresh** run next cycle — which is still exactly
    // what happens to an ordinary ticket whose chunk was cancelled. What
    // changed is that a dropped *step* now carries the hold label, and that
    // is the ticket the machine will not take up. Saying these words to an
    // unheld ticket would name a gesture with no effect and promise a stop
    // that is not coming.
    if (!(state.labels ?? []).includes(HELD_LABEL)) {
      return {
        headline: "I stopped work on this one.",
        needFromYou:
          "nothing — while this ticket is open and marked for me I'll start it " +
          "afresh on my next pass.",
        waitingOnYou: false,
      };
    }

    return {
      headline: "I stopped work on this one, and I won't start it again by myself.",
      needFromYou:
        `either remove the \`${HELD_LABEL}\` label and I'll start it afresh, ` +
        "or close this ticket and I'll carry on without it.",
      waitingOnYou: false,
    };
  }

  if (run.wait?.kind === "review" && run.pr !== undefined) {
    // The pull request number leads, because it is what the reviewer
    // navigates by; the piece follows it, because it is what tells them how
    // much of the initiative this review is. A ticket with no breakdown reads
    // byte for byte as it always has.
    const of =
      progress?.next === undefined
        ? ""
        : ` — that's ${piece(progress.next.index, progress.total)}.`;
    return {
      headline: "The work is open as a pull request.",
      needFromYou: `your review of pull request #${run.pr}${of}`,
      waitingOnYou: true,
    };
  }

  // Everything left is parked. Written as an assertion rather than a comment
  // so a new run status breaks here at compile time instead of silently
  // falling into the wait below.
  run.status satisfies "parked";

  // The stop no answer reaches
  // ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
  //
  // **The second sentence is the whole slice.** A reader who has already
  // written an answer — four of them, on ivtrends #1 — cannot tell from
  // anything else on the ticket that writing a fifth will not help. Every
  // other branch here describes a state; this one has to say what does *not*
  // work, before it says what does.
  //
  // The two openings are ADR-0033 D3's two detectors. Saying which one fired
  // is not bookkeeping leaked onto the ticket: being told "I can't do this"
  // and being told "I asked you the same thing twice" are different pieces of
  // news, and only the second is the machine's own fault to apologise for.
  if (run.wait?.kind === "escalation") {
    // The machine wrote itself a note and cannot read it back
    // ([ADR-0035](../../doc/adr/0035-a-resolved-escalation-hands-the-run-back.md)
    // D3). Refusing to guess is right — a guess starts work at the wrong step
    // on a branch of half-finished work — but refusing in silence would leave
    // the reader watching a ticket that says the same thing for ever, having
    // already done what it asked. It is the machine's own mess, and it says
    // so; the name is quoted exactly, because that is what the person needs
    // in order to see what went wrong.
    if (state.misreadStep !== undefined) {
      const { named, kind } = state.misreadStep;
      return {
        headline:
          kind === "unknown"
            ? `I picked this back up and then lost my footing: I wrote down ` +
              `"${named}" as the place to carry on, and I don't know what that ` +
              "means. That's mine to get wrong, not yours."
            : `I picked this back up and then stalled: I wrote down "${named}" ` +
              "as the place to carry on. That is a real step — I just can't " +
              "run it yet. That's mine to get wrong, not yours.",
        needFromYou:
          kind === "unknown"
            ? "run this command and tell me where to pick it up. Everything we " +
              "settled is safe — it's written down."
            : "run this command and tell me where else to pick it up. " +
              "Everything we settled is safe — it's written down.",
        waitingOnYou: true,
        command: takeoverCommand(state.project, state.ticket),
      };
    }

    const caught = (run.reAsksAfterAnswer ?? 0) >= 2;
    return {
      headline: caught
        ? "I asked you the same thing twice, and I still can't do what you " +
          "asked. Sorry — writing another answer here won't move it."
        : "I can't take this one further myself. Writing another answer here " +
          "won't move it.",
      needFromYou:
        "run this command. It opens this ticket with me in your terminal, " +
        "with everything I know about where it stopped — and there I can do " +
        "things I can't do on my own.",
      waitingOnYou: true,
      command: takeoverCommand(state.project, state.ticket),
    };
  }

  // A run handed back to the machine, with nothing wanted from anybody
  // (ADR-0049 D6). It reaches the same branch as a run stopped for want of
  // machinery — both have words and no kind of wait — and that branch says a
  // person is being waited on, so without this clause the ticket and
  // `timone status` both read *"waiting on you: nothing"*. Found by phase
  // 31's live gate rather than by a test, on a run it had just watched work.
  if (run.wait?.on === CARRY_ON_WAIT) {
    return {
      headline: "I've got what I need to carry on with this one.",
      needFromYou: "nothing right now — I'll pick it up again on my next pass.",
      waitingOnYou: false,
    };
  }

  // The map's own ticket, whose two states are ADR-0024's fourth ruling
  // ("while questions are open, *nothing — I am working the list*; once the
  // frontier is empty, *say go and I will write the specification*").
  //
  // **Read off the run, like every other branch here, and not off the map's
  // labels.** The frontier is a fact about the tracker, but by the time it
  // reaches here the poll loop has already written it into the run's wait —
  // which is what lets `timone status` and the ticket say the same thing, and
  // they would not if this branch needed a listing the terminal never makes.
  //
  // No command, deliberately. Every other conversation park offers the
  // takeover; the map's stage starts no session of its own, so `timone
  // takeover` answers "a stage I can't hold a conversation for yet". The
  // go-ahead is written here, in a comment, exactly as any other written
  // answer.
  if (run.stage === "charting") {
    return run.wait?.kind === undefined
      ? {
          headline: "I'm working through this map's questions.",
          needFromYou:
            "nothing right now — I'll come back here when the last one is closed.",
          waitingOnYou: false,
        }
      : {
          headline: "Every question on this map is answered.",
          needFromYou:
            "say go ahead here and I'll write the specification this map has been finding its way to.",
          waitingOnYou: true,
        };
  }

  return {
    // A park with no kind of wait is not waiting on a human at all: it is a
    // run stopped because a stage's machinery does not exist (`resolveWait`
    // says so), and `parkedComment` is what the ticket was already told. The
    // recorded wait names what would unblock it — "the next stage to be
    // built" — which is what R21's first criterion asks of such a ticket.
    headline:
      run.wait?.kind === undefined
        ? "That's as far as I can take this one for now."
        : "This one is waiting on you.",
    needFromYou: run.wait?.on ?? "an answer",
    waitingOnYou: true,
    ...(run.wait?.kind === "conversation"
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
