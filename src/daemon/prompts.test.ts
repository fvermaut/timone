import { describe, expect, it } from "vitest";

import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import {
  PROMPTED_STAGES,
  conversationSubject,
  stagePrompt,
  takeoverPrompt,
  type PromptContext,
} from "./prompts.js";

const project: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

const ticket: TicketThread = {
  number: 6,
  title: "typing in the box is fiddly on my phone",
  body: "the message box is hard to use on mobile. i keep losing what i typed.",
  labels: ["timone", "triage:feature"],
  url: "https://github.com/fvermaut/scratch-app/issues/6",
  author: "fvermaut",
  createdAt: "2026-08-03T09:00:00Z",
  comments: [
    {
      author: "fvermaut",
      body: "Picked this up.",
      createdAt: "2026-08-03T09:05:00Z",
      fromTimone: true,
    },
    {
      author: "fvermaut",
      body: "it's worse in landscape",
      createdAt: "2026-08-03T09:10:00Z",
      fromTimone: false,
    },
  ],
};

const context: PromptContext = { project, ticket, classification: "feature" };

/**
 * The rules that hold for every prompt, whichever stage it belongs to. New
 * stages inherit them by existing, which is the point of listing the prompts
 * rather than the tests.
 */
describe("every stage prompt", () => {
  it.each(PROMPTED_STAGES)("%s carries the ticket in the words it was written in", (stage) => {
    const prompt = stagePrompt(stage, context);
    expect(prompt).toContain(ticket.body);
    expect(prompt).toContain(ticket.title);
  });

  it.each(PROMPTED_STAGES)("%s separates the voices in the thread", (stage) => {
    // Timone posts under the human's account, so the login cannot tell them
    // apart and the prompt has to.
    const prompt = stagePrompt(stage, context);
    expect(prompt).toMatch(/Timone \(you\), earlier/);
    expect(prompt).toMatch(/fvermaut \(a person\)/);
    expect(prompt).toContain("it's worse in landscape");
  });

  it.each(PROMPTED_STAGES)("%s tells the session to stamp what it posts", (stage) => {
    expect(stagePrompt(stage, context)).toContain(MACHINE_MARKER);
  });

  it.each(PROMPTED_STAGES)("%s names the one project it may touch", (stage) => {
    expect(stagePrompt(stage, context)).toContain("projects/scratch-app/");
  });

  it.each(PROMPTED_STAGES)("%s rebuilds from the artifacts and the thread alone", (stage) => {
    // ADR-0013: every human wait is a session boundary, so a resuming
    // session is handed a router and not a memory.
    expect(stagePrompt(stage, context)).toMatch(/nothing was carried over/i);
  });

  it.each(PROMPTED_STAGES)("%s writes back for someone new to all this", (stage) => {
    expect(stagePrompt(stage, context)).toMatch(/knows nothing about/i);
  });

  it.each(PROMPTED_STAGES)("%s carries the human's words when a gate sent it back", (stage) => {
    const words = "it's not about phones, it's about losing the draft";
    const prompt = stagePrompt(stage, { ...context, feedback: words });

    expect(prompt).toContain(words);
    expect(prompt).toMatch(/again/i);
  });

  it.each(PROMPTED_STAGES)("%s says nothing about feedback when there was none", (stage) => {
    expect(stagePrompt(stage, context)).not.toMatch(/asked for a change/i);
  });
});

describe("the triage prompt", () => {
  it("does not tell the session what kind of request it is", () => {
    // Working that out from the raw text is the entire job of the stage.
    const prompt = stagePrompt("triage", { project, ticket });

    expect(prompt).toMatch(/has not been classified/i);
    expect(prompt).not.toMatch(/this is a feature/i);
  });

  it("asks for the classification to be recorded where the process wants it", () => {
    expect(stagePrompt("triage", { project, ticket })).toContain("triage:<kind>");
  });

  it("does not send the session past its own stage", () => {
    expect(stagePrompt("triage", { project, ticket })).toMatch(
      /do not act on it beyond classifying/i,
    );
  });
});

describe("the clarification prompt", () => {
  const prompt = stagePrompt("clarification", context);

  it("tells the session someone is present and waiting", () => {
    expect(prompt).toMatch(/at the keyboard/i);
  });

  it("carries what triage decided, so the interview does not start from nothing", () => {
    expect(prompt).toContain("feature");
  });

  it("supposes no answer to the questions it exists to ask", () => {
    expect(prompt).not.toMatch(/the problem is|they want|you should build/i);
  });

  it("requires an accepted summary, marked so the machine can find it again", () => {
    expect(prompt).toMatch(/accept/i);
    expect(prompt).toContain(CONVERSATION_RECORD_MARKER);
  });

  it("forbids treating the conversation itself as a record", () => {
    expect(prompt).toMatch(/not a process artifact/i);
  });

  it("says plainly what to do when the human leaves without accepting", () => {
    expect(prompt).toMatch(/without accepting/i);
  });

  it("forbids asking the human to name a stage or a skill", () => {
    expect(prompt).toMatch(/never ask them to name a stage/i);
  });
});

describe("conversationSubject", () => {
  it("says what is about to be talked through, in the ticket's own terms", () => {
    const subject = conversationSubject(ticket);

    expect(subject).toContain(ticket.title);
    expect(subject.toLowerCase()).not.toContain("stage");
    expect(subject.toLowerCase()).not.toContain("timone-");
  });
});

describe("takeoverPrompt", () => {
  it("is the stage's own prompt, framed for a human who just opened it", () => {
    const prompt = takeoverPrompt("scratch-app", "clarification", ticket);

    expect(prompt).toContain(ticket.body);
    expect(prompt).toMatch(/Timone \(you\), earlier/);
    expect(prompt).toContain("timone takeover scratch-app#6");
  });
});
