import { z } from "zod";

/**
 * The label that marks a ticket as Timone's to touch. It is a permission
 * boundary, not a routing instruction (phase 11's load-bearing decision):
 * its presence says "the daemon may act on this issue", and says nothing
 * about what the issue is — classifying that is stage 1's job.
 */
export const MARK_LABEL = "timone";

/**
 * The header every machine-written comment carries.
 *
 * Timone posts through whatever credentials the machine has, so its comments
 * appear under a person's account. Without this line a thread reads as if the
 * human wrote their own acknowledgements and their own verdicts — and worse,
 * a session reading the thread back cannot tell its own words from theirs,
 * which is exactly what a gate decided by ticket replies must never confuse.
 */
export const MACHINE_MARKER =
  "🤖 **Timone** · automatic message — written by the machine, not by the account it appears under";

/**
 * The line an accepted conversation record carries, under the machine marker.
 *
 * A conversation concludes inside the conversation, but the *record* of it
 * lands on the ticket — and the ticket is the one surface the loop reads
 * ([ADR-0012](../../doc/adr/0012-conversation-channels.md)). This marker is
 * what lets the daemon tell "we agreed this" from everything else a session
 * might post. Matching on prose instead would make the pipeline's advance
 * depend on wording nobody knew was load-bearing.
 */
export const CONVERSATION_RECORD_MARKER =
  "✅ **Agreed** · the record of a conversation, accepted by the human";

/** Put the machine header on a comment body, unless it already carries one. */
export function stampMachineComment(body: string): string {
  return body.startsWith(MACHINE_MARKER)
    ? body
    : `${MACHINE_MARKER}\n\n---\n\n${body}`;
}

/** True when a comment body was written by Timone rather than by a person. */
export function isMachineComment(body: string): boolean {
  return body.trimStart().startsWith(MACHINE_MARKER);
}

/** One comment in a ticket's thread. */
export const ticketCommentSchema = z.strictObject({
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
  /**
   * Whether Timone wrote this comment. Derived from {@link MACHINE_MARKER},
   * never from the author — the author is the account the machine borrows.
   */
  fromTimone: z.boolean(),
});

/** A ticket as the process sees it — no tracker-specific fields. */
export const ticketSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string(),
  /** Verbatim issue body, however naive the language it is written in. */
  body: z.string(),
  labels: z.array(z.string()),
  url: z.string(),
  author: z.string(),
  createdAt: z.string(),
});

/** A ticket together with its comment thread, oldest comment first. */
export const ticketThreadSchema = ticketSchema.extend({
  comments: z.array(ticketCommentSchema),
});

export type TicketComment = z.infer<typeof ticketCommentSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketThread = z.infer<typeof ticketThreadSchema>;

/**
 * The subset of a managed project an adapter needs: its manifest name (for
 * error messages and run keys) and its clone URL (which the implementation
 * resolves to whatever the tracker addresses repositories by).
 */
export interface TicketingProject {
  name: string;
  repoUrl: string;
}

/**
 * The seam between the process and whatever tracks tickets. Real interface
 * from day one per ADR-0004: GitHub is the first implementation, not the
 * shape. Four capabilities, and no more — anything a stage needs beyond
 * these is a deliberate widening of the seam, not an incidental one.
 */
export interface TicketingAdapter {
  /** Open tickets carrying the mark label, oldest first. */
  listMarkedTickets(project: TicketingProject): Promise<Ticket[]>;

  /** One ticket with its comment thread. */
  getTicket(project: TicketingProject, number: number): Promise<TicketThread>;

  /**
   * Append a comment to a ticket's thread. Implementations stamp it with
   * {@link MACHINE_MARKER}: marking is not the caller's job to remember.
   */
  postComment(
    project: TicketingProject,
    number: number,
    body: string,
  ): Promise<void>;

  /** Add a label to a ticket (labels are read off {@link Ticket.labels}). */
  applyLabel(
    project: TicketingProject,
    number: number,
    label: string,
  ): Promise<void>;
}
