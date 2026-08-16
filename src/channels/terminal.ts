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
 * The invitation: the two ways a ticket waiting on a conversation can be
 * answered, offered together and with neither preferred — a written answer in
 * the thread, or the takeover ([ADR-0022](../../doc/adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)).
 *
 * **One copy, used twice.** Both `open` and the unfinished branch of
 * `conclude` end on this block, and `timone-wayfind` writes the same words
 * into the bodies of the tickets it creates. If those two drift, this is the
 * one that is right. The written path is bounded at one clarifying round, and
 * the block says so, because the bound is a promise to the human and not an
 * implementation detail.
 *
 * It ends with the CTA, so callers append nothing after it.
 */
function invitationToAnswer(command: string): string[] {
  return [
    "**Two ways to answer — pick either.**",
    "",
    '- **Write your answer here.** A comment is enough. You don\'t need to answer every part, and "I don\'t know, what do you suggest?" is a real answer. If something is still unclear I\'ll ask once more here, then stop.',
    "- **Talk it through instead.** Run this and I'll pick up where this ticket left off:",
    "",
    "```",
    command,
    "```",
    "",
    "**What I need from you:** answer here, or run the command.",
  ];
}

/**
 * The universal conversation channel: the human's own terminal.
 *
 * It is the fallback that always exists — no account to connect, no service
 * to be up — so it is the one implementation the process can depend on. The
 * ticket carries a copy-pasteable command; running it opens the interview
 * where the human already works. Since ADR-0022 it carries a second path too:
 * the human can simply write the answer on the ticket. Both reach the same
 * session and produce the same record, so the channel offers them together
 * and prefers neither.
 */
export class TerminalChannel implements ConversationChannel {
  readonly name = "terminal";

  async open(context: ConversationContext): Promise<OpenedConversation> {
    const command = takeoverCommand(context.project, context.ticket);

    return {
      comment: [
        "**I need to ask you a few things first.**",
        "",
        context.subject,
        "",
        ...invitationToAnswer(command),
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
        ...invitationToAnswer(command),
      ].join("\n");
    }

    return [
      "**Here's what we agreed.**",
      "",
      outcome.summary,
      "",
      "This is the record — the conversation itself isn't kept. If anything",
      "here is wrong, say so and I'll fix it.",
      "",
      "**What I need from you:** nothing right now — read it if you like, and I'll carry on.",
    ].join("\n");
  }
}
