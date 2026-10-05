import { describe, expect, it } from "vitest";

import { askedFor } from "../daemon/outcomes.js";
import { takeoverCommand, withTwoWaysToAnswer } from "./terminal.js";

describe("takeoverCommand", () => {
  it("names the project and the ticket, and nothing else", () => {
    expect(takeoverCommand("scratch-app", 6)).toBe("timone takeover scratch-app#6");
  });
});

// PRD-09 R1 and R2: a question says both ways to answer it, and names the
// command with the real project and ticket, in code formatting.
describe("withTwoWaysToAnswer", () => {
  /** A comment that ends on a closing line, as every Timone message does. */
  function ending(needed: string): string {
    return [
      "**The plan cannot start yet.** The list of pieces names a page that does not exist.",
      "",
      "> **What I need from you:** an older line, quoted.",
      "",
      `**What I need from you:** ${needed}`,
    ].join("\n");
  }

  const SENTENCE =
    "You can answer here in writing, or in your terminal by running `timone takeover scratch-app#66`.";

  it("puts the sentence with the command on its own line, above the last closing line, and leaves that line as it was", () => {
    const body = ending("say which page you meant.");

    const result = withTwoWaysToAnswer(body, "scratch-app", 66);

    expect(result.match(/`timone takeover scratch-app#66`/g)).toHaveLength(1);
    const lines = result.split("\n");
    const closing = lines.lastIndexOf("**What I need from you:** say which page you meant.");
    expect(closing).toBe(lines.length - 1);
    expect(lines.slice(closing - 2, closing)).toEqual([SENTENCE, ""]);
    expect(askedFor(result)).toBe(askedFor(body));
  });

  // A message that asks for nothing is not a question, and is left exactly
  // as it was.
  it("leaves a message that asks for nothing as it was", () => {
    const body = ending("nothing.");

    expect(withTwoWaysToAnswer(body, "scratch-app", 66)).toBe(body);
  });

  it("leaves a message that asks for nothing but invites a reply as it was", () => {
    const body = ending("nothing. If you want the skipped step done after all, say so here.");

    expect(withTwoWaysToAnswer(body, "scratch-app", 66)).toBe(body);
  });

  it("leaves a question that already names the command as it was", () => {
    const body = [
      "**I need a decision.** Run `timone takeover scratch-app#66` to talk it through.",
      "",
      "**What I need from you:** say which page you meant.",
    ].join("\n");

    expect(withTwoWaysToAnswer(body, "scratch-app", 66)).toBe(body);
  });
});
