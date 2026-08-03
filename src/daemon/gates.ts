import {
  CONVERSATION_RECORD_MARKER,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";

/**
 * The words a human may reply with to approve. The gate comment tells them
 * exactly what to type, so this list is short on purpose: it is the set of
 * spellings someone might reasonably reach for instead, not an attempt to
 * understand English.
 */
export const APPROVAL_TOKENS = [
  "approve",
  "approved",
  "yes",
  "go ahead",
  "lgtm",
] as const;

/** A human's answer to a gate. */
export type GateDecision =
  | { kind: "approve"; comment: TicketComment }
  | { kind: "change-request"; feedback: string; comment: TicketComment };

/**
 * Read the human's answer to an open gate off a ticket thread, or undefined
 * while they have not answered.
 *
 * Two rules make this safe, and both are load-bearing:
 *
 * - **Shape, not sentiment.** A reply whose first line *is* an approval token
 *   approves. Everything else is a change request carrying the human's exact
 *   words — never a second guess at what they meant, and never a silent
 *   approval. "approve once you've fixed the wording" is a change request,
 *   which is the whole point: a gate that reasons about intent is a gate that
 *   eventually approves something nobody approved.
 * - **Timone can never decide its own gate.** Its own comments are skipped by
 *   {@link TicketComment.fromTimone}, which the adapter derives from the
 *   machine marker — never by author, because Timone posts through the
 *   human's account and the two logins are identical.
 *
 * `cursor` is the instant the gate comment was posted, stored on the run.
 * Only strictly later comments count, so an "approve" written earlier in the
 * thread about something else cannot answer this gate.
 */
export function readGateDecision(
  thread: TicketThread,
  cursor: string,
): GateDecision | undefined {
  const after = instant(cursor);

  for (const comment of thread.comments) {
    if (comment.fromTimone) continue;
    if (instant(comment.createdAt) <= after) continue;

    // An empty reply carries neither an approval nor anything to act on;
    // the next real one decides. Skipping it is safe in the only direction
    // that matters — it can never approve.
    const body = comment.body.trim();
    if (body === "") continue;

    return isApproval(body)
      ? { kind: "approve", comment }
      : { kind: "change-request", feedback: comment.body.trim(), comment };
  }

  return undefined;
}

/**
 * Find the record of a concluded conversation posted after `cursor`, or
 * undefined while none has been.
 *
 * The mirror image of {@link readGateDecision}: there, the human's own words
 * decide, and Timone's are skipped; here the record is Timone's by
 * construction — it is the session writing down what was agreed in a
 * conversation the daemon never saw. Only a comment carrying
 * {@link CONVERSATION_RECORD_MARKER} counts, so a conversation the human
 * abandoned leaves the run waiting exactly as it should.
 */
export function readConversationRecord(
  thread: TicketThread,
  cursor: string,
): TicketComment | undefined {
  const after = instant(cursor);

  return thread.comments.find(
    (comment) =>
      comment.fromTimone &&
      instant(comment.createdAt) > after &&
      comment.body.includes(CONVERSATION_RECORD_MARKER),
  );
}

/**
 * When the gate this run is waiting on was opened: the newest comment Timone
 * posted, since the gate comment is always one of its own.
 *
 * Deliberately *not* the newest comment of any kind. A human who replies in
 * the moment between the session posting and the daemon reading would
 * otherwise land past the cursor and have their answer silently ignored.
 */
export function waitCursorFrom(thread: TicketThread): string {
  const mine = thread.comments.filter((comment) => comment.fromTimone);
  const newest = mine.at(-1);
  return newest?.createdAt ?? thread.createdAt;
}

/**
 * Whether a reply's first meaningful line is an approval token, allowing for
 * the decoration people put around a single word: case, surrounding
 * whitespace, trailing punctuation, and markdown emphasis.
 *
 * Deliberately an equality test and not a prefix test — anything with words
 * of its own attached is a change request.
 */
function isApproval(body: string): boolean {
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "");
  if (firstLine === undefined) return false;

  const normalized = firstLine
    .toLowerCase()
    .replaceAll(/[*_`]/g, "")
    .replace(/[.!]+$/, "")
    .trim();

  return (APPROVAL_TOKENS as readonly string[]).includes(normalized);
}

/**
 * Parse a timestamp for ordering. An unparseable one sorts before everything,
 * so a malformed cursor makes the gate read comments rather than swallow them
 * — the failure mode is a visible wrong answer, not a silent stall.
 */
function instant(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}
