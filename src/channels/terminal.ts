import type {
  ConversationChannel,
  ConversationContext,
  ConversationOutcome,
  OpenedConversation,
} from "./conversation.js";

/**
 * The command that resolves a ticket's open conversation and starts it.
 *
 * One argument, `<project>#<ticket>` — the two things the human already has
 * in front of them. The command works out which conversation is waiting and
 * what to talk about; naming a stage or a skill is never asked of them.
 */
export function takeoverCommand(project: string, ticket: number): string {
  return `timone takeover ${project}#${ticket}`;
}

/**
 * The universal conversation channel: the human's own terminal.
 *
 * It is the fallback that always exists — no account to connect, no service
 * to be up — so it is the one implementation the process can depend on. The
 * ticket carries a copy-pasteable command; running it opens the interview
 * where the human already works.
 */
export class TerminalChannel implements ConversationChannel {
  readonly name = "terminal";

  async open(context: ConversationContext): Promise<OpenedConversation> {
    const command = takeoverCommand(context.project, context.ticket);

    return {
      comment: [
        "**I need to ask you a few things before I go further.**",
        "",
        context.subject,
        "",
        "This one needs a back-and-forth rather than a single answer, so it's",
        "better done in your terminal than in comments here. Run this and I'll",
        "pick up exactly where this ticket left off:",
        "",
        "```",
        command,
        "```",
        "",
        "You don't need to tell it anything else — it works out what this ticket",
        "is waiting for. When we're done, I'll write what we agreed back here.",
        "",
        `**What I need from you:** run \`${command}\` when you have a few minutes.`,
      ].join("\n"),
      waitingOn: "a conversation in your terminal",
    };
  }

  async conclude(
    context: ConversationContext,
    outcome: ConversationOutcome,
  ): Promise<string> {
    if (!outcome.accepted) {
      const command = takeoverCommand(context.project, context.ticket);
      return [
        "**We didn't finish that conversation.**",
        "",
        "Nothing was settled, so I haven't changed anything or moved this on.",
        "",
        `**What I need from you:** run \`${command}\` again when you can pick it back up.`,
      ].join("\n");
    }

    return [
      "**Here's what we agreed.**",
      "",
      outcome.summary,
      "",
      "This is the record — the conversation itself isn't kept, so if anything",
      "here doesn't match what you meant, say so on this ticket and I'll fix it",
      "before it goes any further.",
      "",
      "**What I need from you:** nothing right now — read it if you like, and I'll carry on.",
    ].join("\n");
  }
}
