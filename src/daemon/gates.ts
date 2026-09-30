import {
  carriesMarker,
  CLARIFICATION_MARKER,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";

// ✏ 2026-09-30: the gate reader, the reader of a conversation's record, the
// wait cursor and the approval words went with the old spawner, their last
// caller. What is left here is still imported: `GateDecision` by
// `pipeline.ts`, and `clarifyingRounds` by `prompts.ts`.

/** A human's answer to a gate. */
export type GateDecision =
  | { kind: "approve"; comment: TicketComment }
  | { kind: "change-request"; feedback: string; comment: TicketComment };

/**
 * How many clarifying rounds the written path has already spent on this
 * ticket: the machine's own comments carrying {@link CLARIFICATION_MARKER}.
 *
 * ADR-0022 bounds the written path at one — ask what is still open once, and
 * if the next answer still does not settle it, hand back the takeover rather
 * than typing at them a third time. The bound is counted here, on the thread,
 * because the thread is where the asking happened; nothing in the ledger
 * records it, and nothing should.
 *
 * Deliberately not cursor-relative. It answers "have I already asked again
 * about this ticket", which is a question about the whole conversation — and
 * a fresh cursor is written on every re-park, so scoping it to one would
 * reset the bound on the very move that spends it.
 */
export function clarifyingRounds(thread: TicketThread): number {
  return thread.comments.filter(
    (comment) =>
      comment.fromTimone && carriesMarker(comment.body, CLARIFICATION_MARKER),
  ).length;
}
