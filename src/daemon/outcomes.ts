import {
  STAGE_DONE_MARKER,
  STAGE_HANDED_MARKER,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";
import { instant } from "./gates.js";

/** How a stage's session said it ended, read off the ticket. */
export type StageOutcome =
  | { kind: "advanced"; comment: TicketComment }
  | { kind: "handed-to-human"; comment: TicketComment };

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

    if (comment.body.includes(STAGE_HANDED_MARKER)) {
      return { kind: "handed-to-human", comment };
    }
    if (comment.body.includes(STAGE_DONE_MARKER)) {
      return { kind: "advanced", comment };
    }
  }

  return undefined;
}
