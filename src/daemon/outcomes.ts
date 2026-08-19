import {
  HANDBACK_MARKER,
  HANDBACK_STEP_PREFIX,
  STAGE_DONE_MARKER,
  STAGE_ESCALATED_MARKER,
  STAGE_HANDED_MARKER,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";
import { instant } from "./gates.js";
import { stageFromLabel, type PipelineStage } from "./pipeline.js";

/** How a stage's session said it ended, read off the ticket. */
export type StageOutcome =
  | { kind: "advanced"; comment: TicketComment }
  | { kind: "handed-to-human"; comment: TicketComment }
  /**
   * The stage was given an answer it may not act on, and said so
   * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
   * The comment is the stage's own account of the dead end, and it is what
   * the session opened on this run is handed.
   */
  | { kind: "escalated"; comment: TicketComment };

/**
 * Find the outcome a stage's session recorded after `cursor`, or undefined
 * while none has been.
 *
 * The third reader in this family, and the rules compose from the other two:
 * like {@link readConversationRecord} the record is Timone's by construction
 * — only a machine comment counts, so a human quoting the marker back at the
 * ticket moves nothing (the mirror of the gate trap: there a machine must
 * not speak for the human, here a human must not move the machine's
 * bookkeeping). Like {@link readGateDecision} the ambiguous case fails safe:
 * a comment somehow carrying both markers reads as handed-to-human, because
 * a wrongly stopped pipeline costs a retry while a wrongly advanced one
 * builds on nothing.
 */
/**
 * The instant from which a stage's outcome may be read: the newest comment
 * on the ticket as the stage's session starts. The session's closing comment
 * is necessarily later; everything already said necessarily is not.
 */
export function outcomeCursorFrom(thread: TicketThread): string {
  return thread.comments.at(-1)?.createdAt ?? thread.createdAt;
}

export function readStageOutcome(
  thread: TicketThread,
  cursor: string,
): StageOutcome | undefined {
  const after = instant(cursor);

  for (const comment of thread.comments) {
    if (!comment.fromTimone) continue;
    if (instant(comment.createdAt) <= after) continue;

    // Read above the handed marker, because an escalation *is* a handoff that
    // has additionally given up on being answered. A comment carrying both
    // must resolve as the stronger of the two, and this ordering is what
    // guarantees it — not the stage remembering to write only one.
    if (comment.body.includes(STAGE_ESCALATED_MARKER)) {
      return { kind: "escalated", comment };
    }
    if (comment.body.includes(STAGE_HANDED_MARKER)) {
      return { kind: "handed-to-human", comment };
    }
    if (comment.body.includes(STAGE_DONE_MARKER)) {
      return { kind: "advanced", comment };
    }
  }

  return undefined;
}

/**
 * A session's note that a stop has been cleared and the work carries on
 * ([ADR-0035](../../doc/adr/0035-a-resolved-escalation-hands-the-run-back.md)).
 *
 * **Three answers, because a caller has three things to do.** A step named is
 * a run to resume there; nothing named is a run to resume where it stopped;
 * and a name nobody defined is a refusal with something to say — the ticket
 * quotes the name back and the run stays where it is. Collapsing the last two
 * would make a refusal indistinguishable from silence, and then nothing can
 * tell the human why nothing happened.
 *
 * A fourth answer is the absence of one: `undefined`, meaning no note.
 */
export type Handback =
  | { kind: "at"; stage: PipelineStage; comment: TicketComment }
  | { kind: "unnamed"; comment: TicketComment }
  | { kind: "unknown"; named: string; comment: TicketComment };

/**
 * Find the handback note posted after `cursor`, or undefined while none has
 * been.
 *
 * The rules are {@link readStageOutcome}'s, for the same reasons: only the
 * machine's own comment counts, so a human quoting the marker back moves
 * nothing; and only what was written after the stop opened can answer it.
 */
export function readHandback(
  thread: TicketThread,
  cursor: string,
): Handback | undefined {
  const after = instant(cursor);

  for (const comment of thread.comments) {
    if (!comment.fromTimone) continue;
    if (instant(comment.createdAt) <= after) continue;
    if (!comment.body.includes(HANDBACK_MARKER)) continue;

    const named = namedStep(comment.body);
    if (named === undefined) return { kind: "unnamed", comment };

    const stage = stageFromLabel(named);
    return stage === undefined
      ? { kind: "unknown", named, comment }
      : { kind: "at", stage, comment };
  }

  return undefined;
}

/**
 * The step a handback note names, as the session wrote it, or undefined when
 * it named none.
 *
 * The name is returned unresolved so an unrecognised one can be quoted back
 * on the ticket. Everything after the prefix on that line is the name: a
 * session writing two words means a step of two words, and truncating at the
 * first space would turn *"checking the result"* into a name nobody defined.
 */
function namedStep(body: string): string | undefined {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(HANDBACK_STEP_PREFIX)) continue;
    const named = trimmed.slice(HANDBACK_STEP_PREFIX.length).trim();
    if (named !== "") return named;
  }
  return undefined;
}
