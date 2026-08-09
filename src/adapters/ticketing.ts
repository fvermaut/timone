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

/**
 * The line the machine's one clarifying question carries, when a written
 * answer left something unsettled ([ADR-0022](../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)).
 *
 * The written path is bounded at **one clarifying round**, and this marker is
 * where that round is counted. It is counted on the *ticket* rather than in
 * the ledger deliberately: the thread already holds the fact — the machine
 * either asked again or it did not — and a counter beside it would be a
 * second copy of one truth, free to disagree with the comments a human is
 * looking at. Read by {@link clarifyingRounds}.
 */
export const CLARIFICATION_MARKER =
  "❓ **Still open** · written by the machine when a written answer left something unsettled";

/**
 * The line a stage's closing comment carries when its work is done and the
 * pipeline may move on. Phase 13's back half runs stages whose sessions do
 * real, fallible work; the daemon judges them by the artifact they owe *and*
 * this record ([phase 13](../../doc/plans/phases/phase-13.md)'s outcome
 * rule, extending ADR-0014 from gates to outcomes) — never by an exit code,
 * which is how a gate once opened over nothing.
 */
export const STAGE_DONE_MARKER =
  "🏁 **Step finished** · written by the machine when a stage completed its work";

/**
 * {@link STAGE_DONE_MARKER}'s sibling for the other honest ending: the stage
 * stopped inside its bounds — a failed slice, an exhausted fix loop — and a
 * person has to look. The comment carrying it is the report R6 requires.
 */
export const STAGE_HANDED_MARKER =
  "🙋 **Needs a person** · written by the machine when a stage stopped and is asking for help";

/**
 * The line the preview comment carries, so a pull request ends up with one of
 * them rather than one per poll cycle.
 *
 * Unlike its siblings this marker is not just provenance — it is an
 * *identity*. Previews are reconciled every cycle
 * ([ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)),
 * and a preview's URL changes whenever its stack is rebuilt, so the same
 * statement has to be *revised* on a client's pull request rather than
 * repeated. This is what {@link TicketingAdapter.upsertPullRequestComment}
 * matches on to find what it said last time.
 */
export const PREVIEW_MARKER =
  "🔍 **Preview** · a running copy of this pull request, kept up to date by the machine";

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
 * Where a pull request stands, as the process reads it: `merged` is the
 * terminal state that completes a run, `closed` (without merging) the one
 * that declines it, and `open` is a run still waiting on its review.
 */
export const PR_STATES = ["open", "merged", "closed"] as const;

/** A pull request as the process sees it — no tracker-specific fields. */
export const pullRequestSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.string(),
  state: z.enum(PR_STATES),
  /**
   * The commit at the head of the PR's branch, as the *tracker* sees it.
   *
   * Deliberately read from the tracker rather than from a local clone: a
   * preview is reconciled against the commit under review, and a clone that
   * has not fetched recently would have the reconciler chasing a commit
   * nobody is looking at.
   */
  headSha: z.string(),
});

/**
 * One comment on a pull request. A ticket comment, plus — where the tracker
 * can thread a reply under it — the id to hand back as `replyTo`. Undefined
 * means the surface is flat there (GitHub's PR conversation, review
 * summaries); a reply still lands on the PR, just unthreaded.
 */
export const pullRequestCommentSchema = ticketCommentSchema.extend({
  replyTo: z.string().optional(),
});

/**
 * A pull request with everything said on it — conversation comments, review
 * summaries and inline review comments — as one thread, oldest first. One
 * merged sequence on purpose: the review loop reads "what did the human say
 * since the cursor", and which GitHub surface they said it on is not the
 * process's business.
 */
export const pullRequestThreadSchema = pullRequestSchema.extend({
  comments: z.array(pullRequestCommentSchema),
});

export type PullRequest = z.infer<typeof pullRequestSchema>;
export type PullRequestComment = z.infer<typeof pullRequestCommentSchema>;
export type PullRequestThread = z.infer<typeof pullRequestThreadSchema>;

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
 * shape. Nine capabilities, and no more — anything a stage needs beyond
 * these is a deliberate widening of the seam, not an incidental one. Three
 * of them are phase 13's widening: delivery and the review loop live on
 * pull requests, and the PR is stage 8's artifact (ADR-0004), so reading
 * and answering it is the ticketing seam's business, not a second adapter's.
 * The last is phase 16's, and its reasoning is on the call itself.
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

  /**
   * The pull request whose head is `branch`, or undefined when none exists.
   * When the branch has several, the liveliest wins: open, then merged,
   * then closed — a stale closed PR must not hide the one under review.
   */
  findPullRequest(
    project: TicketingProject,
    branch: string,
  ): Promise<PullRequest | undefined>;

  /** One pull request with everything said on it, as one thread. */
  getPullRequestThread(
    project: TicketingProject,
    number: number,
  ): Promise<PullRequestThread>;

  /**
   * Say something on a pull request, stamped with {@link MACHINE_MARKER}
   * exactly as ticket comments are. With `replyTo` (a comment's
   * {@link PullRequestComment.replyTo}), the reply threads under that
   * comment; without it, it lands on the PR conversation.
   */
  postPullRequestComment(
    project: TicketingProject,
    number: number,
    body: string,
    replyTo?: string,
  ): Promise<void>;

  /**
   * Say something on a pull request **in place of** whatever was last said
   * under `marker`, editing that comment rather than adding another.
   *
   * Phase 16's widening of this seam, and deliberate rather than incidental.
   * Everything else the process says on a pull request is an *event* — this
   * happened, then that did — and appending is the honest record of an event.
   * A preview is not an event but a **standing fact** whose truth changes:
   * "this pull request is running here". Reconciled every cycle, appended, it
   * would be a client's PR filling with near-identical comments. Editing is
   * what makes per-cycle reconciliation compatible with a surface a human
   * reads.
   *
   * Implementations match on `marker` appearing in a comment they themselves
   * wrote, and post a new one when they find none.
   */
  upsertPullRequestComment(
    project: TicketingProject,
    number: number,
    marker: string,
    body: string,
  ): Promise<void>;

  /**
   * Close a ticket whose journey has ended — `completed` when the work
   * merged or a question was answered, `not-planned` when the work was
   * declined. A ticket left open after the machine told it "this ticket's
   * journey ends here" is the machine saying one thing and doing another
   * (asked for by fvermaut at phase 13's live gate).
   */
  closeTicket(
    project: TicketingProject,
    number: number,
    reason: "completed" | "not-planned",
  ): Promise<void>;
}
