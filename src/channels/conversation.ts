import type { PipelineStage } from "../daemon/pipeline.js";

/** Which conversation is being had, and about what. */
export interface ConversationContext {
  /** Manifest name of the managed project. */
  project: string;
  /** The ticket the conversation belongs to — where its outcome lands. */
  ticket: number;
  /** The stage holding the conversation. */
  stage: PipelineStage;
  /**
   * One line, in the human's terms, of what needs talking through. Written
   * by the stage that opens the conversation; never a stage or skill name.
   */
  subject: string;
}

/** What opening a conversation produced. */
export interface OpenedConversation {
  /** The comment to post on the ticket, inviting the human in. */
  comment: string;
  /** What the run is waiting for, in the human's terms, for the ledger. */
  waitingOn: string;
}

/** How a conversation ended. */
export interface ConversationOutcome {
  /**
   * Whether the human accepted the summary that closed the interview. A
   * conversation that ends without acceptance decided nothing.
   */
  accepted: boolean;
  /** The accepted outcome, in the human's terms. Empty when not accepted. */
  summary: string;
}

/**
 * The seam between the process and wherever multi-turn conversations happen
 * ([ADR-0012](../../doc/adr/0012-conversation-channels.md)).
 *
 * Two capabilities, and deliberately no more: invite the human into a
 * conversation, and record what it concluded. Everything in between belongs
 * to the medium — a terminal session, a chat thread — and the process has no
 * business modelling it. **Transcripts are not process artifacts:** what
 * crosses back over this seam is the accepted outcome, never the exchange
 * that produced it.
 *
 * The terminal implementation is the universal fallback and the only one
 * built. A chat channel is a second implementation of *this*, not a rewrite
 * of the stages that use it.
 */
export interface ConversationChannel {
  /** How this channel names itself in logs and on tickets. */
  readonly name: string;

  /** Invite the human into a conversation about `context`. */
  open(context: ConversationContext): Promise<OpenedConversation>;

  /** Turn how it ended into the record that lands on the ticket. */
  conclude(
    context: ConversationContext,
    outcome: ConversationOutcome,
  ): Promise<string>;
}

/**
 * Open a conversation and get back what to post and what to wait on.
 *
 * A thin wrapper on purpose: it is the call site every stage shares, so the
 * stages depend on the seam rather than on a channel. Swapping the channel
 * changes nothing above this line — which is the property the seam exists
 * for, and the one a fake channel in the tests demonstrates.
 */
export async function inviteToConversation(
  channel: ConversationChannel,
  context: ConversationContext,
): Promise<OpenedConversation> {
  return channel.open(context);
}

/**
 * Turn the end of a conversation into the comment that records it.
 *
 * An unaccepted conversation still produces a comment — the human opened it,
 * walked away, and the ticket has to say so; silence would read as progress.
 */
export async function recordConversationOutcome(
  channel: ConversationChannel,
  context: ConversationContext,
  outcome: ConversationOutcome,
): Promise<string> {
  return channel.conclude(context, outcome);
}
