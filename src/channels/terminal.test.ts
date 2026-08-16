import { describe, expect, it } from "vitest";

import { MACHINE_MARKER } from "../adapters/ticketing.js";
import {
  inviteToConversation,
  recordConversationOutcome,
  type ConversationChannel,
  type ConversationContext,
  type ConversationOutcome,
  type OpenedConversation,
} from "./conversation.js";
import { TerminalChannel, takeoverCommand } from "./terminal.js";

const context: ConversationContext = {
  project: "scratch-app",
  ticket: 6,
  stage: "clarification",
  subject: "I want to understand what's actually awkward about the message box.",
};

const accepted: ConversationOutcome = {
  accepted: true,
  summary: "The send button ends up under the phone keyboard.",
};

describe("takeoverCommand", () => {
  it("names the project and the ticket, and nothing else", () => {
    expect(takeoverCommand("scratch-app", 6)).toBe("timone takeover scratch-app#6");
  });
});

describe("TerminalChannel.open", () => {
  it("carries a copy-pasteable command naming project and ticket", async () => {
    const { comment } = await new TerminalChannel().open(context);

    expect(comment).toContain("timone takeover scratch-app#6");
    // In a fenced block, so copying it doesn't drag prose along.
    expect(comment).toMatch(/```\ntimone takeover scratch-app#6\n```/);
  });

  it("invites a written answer on the ticket, beside the command", async () => {
    const { comment } = await new TerminalChannel().open(context);

    expect(comment).toMatch(/two ways to answer/i);
    expect(comment).toMatch(/a comment is enough/i);
  });

  it("says what the conversation is about, in the words the stage wrote", async () => {
    const { comment } = await new TerminalChannel().open(context);
    expect(comment).toContain(context.subject);
  });

  it("asks the human to name no stage and no skill", async () => {
    const { comment } = await new TerminalChannel().open(context);
    const lower = comment.toLowerCase();

    for (const jargon of ["stage ", "timone-", "skill", "clarification"]) {
      expect(lower).not.toContain(jargon);
    }
  });

  it("ends with a CTA naming both paths and preferring neither", async () => {
    const { comment } = await new TerminalChannel().open(context);
    const closing = comment.trimEnd().split("\n").at(-1) ?? "";

    expect(closing).toMatch(/What I need from you:/);
    expect(closing).toMatch(/answer here/i);
    expect(closing).toMatch(/run the command/i);
    // Both named, neither recommended: the human picks without justifying it.
    expect(closing).not.toMatch(/better|instead|rather/i);
  });

  it("tells the ledger what the run is waiting for", async () => {
    const { waitingOn } = await new TerminalChannel().open(context);
    expect(waitingOn).toMatch(/terminal/i);
  });

  it("still says the run waits on a conversation, whichever way it is answered", async () => {
    const { waitingOn } = await new TerminalChannel().open(context);
    expect(waitingOn).toMatch(/conversation/i);
  });

  it("leaves the machine marker to the adapter", async () => {
    const { comment } = await new TerminalChannel().open(context);
    expect(comment).not.toContain(MACHINE_MARKER);
  });

  // process.md, "Writing to the human": a comment is a few sentences, under
  // 150 words. The subject is the stage's own text and is counted with it,
  // because the human reads one comment and not two halves of one.
  it("stays under the length a person will actually read", async () => {
    const { comment } = await new TerminalChannel().open(context);
    expect(comment.split(/\s+/).filter(Boolean).length).toBeLessThan(150);
  });
});

describe("TerminalChannel.conclude", () => {
  it("posts the accepted outcome as the record", async () => {
    const comment = await new TerminalChannel().conclude(context, accepted);
    expect(comment).toContain(accepted.summary);
  });

  it("says the transcript is not kept, because it is not an artifact", async () => {
    const comment = await new TerminalChannel().conclude(context, accepted);
    expect(comment).toMatch(/conversation itself isn't kept/i);
  });

  it("says plainly that nothing moved when the conversation was not accepted", async () => {
    const comment = await new TerminalChannel().conclude(context, {
      accepted: false,
      summary: "",
    });

    expect(comment).toMatch(/didn't finish/i);
    expect(comment).toContain("timone takeover scratch-app#6");
  });

  it("offers both paths again when the conversation was left unfinished", async () => {
    const comment = await new TerminalChannel().conclude(context, {
      accepted: false,
      summary: "",
    });

    expect(comment).toMatch(/two ways to answer/i);
    expect(comment).toMatch(/a comment is enough/i);
    expect(comment).toContain("timone takeover scratch-app#6");
  });

  it("ends with a CTA either way", async () => {
    for (const outcome of [accepted, { accepted: false, summary: "" }]) {
      const comment = await new TerminalChannel().conclude(context, outcome);
      const closing = comment.trimEnd().split("\n").at(-1) ?? "";
      expect(closing).toMatch(/What I need from you:/);
    }
  });
});

describe("the channel seam", () => {
  /**
   * A second implementation, and the point of the exercise: if the callers
   * above the seam need one line changed to drive this, the seam is a shape
   * borrowed from the terminal rather than a real boundary.
   */
  class FakeChannel implements ConversationChannel {
    readonly name = "fake";
    readonly opened: ConversationContext[] = [];
    readonly concluded: ConversationOutcome[] = [];

    async open(context: ConversationContext): Promise<OpenedConversation> {
      this.opened.push(context);
      return {
        comment: `talk to me about #${context.ticket}`,
        waitingOn: "a made-up conversation",
      };
    }

    async conclude(
      _context: ConversationContext,
      outcome: ConversationOutcome,
    ): Promise<string> {
      this.concluded.push(outcome);
      return outcome.accepted ? `agreed: ${outcome.summary}` : "nothing agreed";
    }
  }

  it("drives a fake channel through the same calls, unchanged", async () => {
    const fake = new FakeChannel();

    const opened = await inviteToConversation(fake, context);
    const record = await recordConversationOutcome(fake, context, accepted);

    expect(opened.comment).toBe("talk to me about #6");
    expect(opened.waitingOn).toBe("a made-up conversation");
    expect(record).toBe("agreed: The send button ends up under the phone keyboard.");
    expect(fake.opened).toEqual([context]);
    expect(fake.concluded).toEqual([accepted]);
  });

  it("gives every channel the same two capabilities and no more", async () => {
    const channels: ConversationChannel[] = [new TerminalChannel(), new FakeChannel()];

    for (const channel of channels) {
      const opened = await inviteToConversation(channel, context);
      expect(opened.comment.length).toBeGreaterThan(0);
      expect(opened.waitingOn.length).toBeGreaterThan(0);
      expect(
        (await recordConversationOutcome(channel, context, accepted)).length,
      ).toBeGreaterThan(0);
      expect(channel.name.length).toBeGreaterThan(0);
    }
  });
});
