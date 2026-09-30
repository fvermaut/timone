import { describe, expect, it } from "vitest";

import { MACHINE_MARKER } from "../adapters/ticketing.js";
import { askedFor, LONGEST_ASK } from "./outcomes.js";

/**
 * The line a stage's closing comment opened on when it stopped and asked a
 * person for help, as the old steps wrote it. Its constant was deleted on
 * 2026-09-30; the text is kept here so these closing comments read as before.
 */
const STAGE_HANDED_MARKER =
  "🙋 **Needs a person** · written by the machine when a stage stopped and is asking for help";

// timone#144. A stage that hands a run back is parked on what it asked for,
// and what it asked for is read off its own closing line. The fault: a wait
// written without looking at the comment it waits on.
describe("askedFor", () => {
  /** A closing comment, as every stage writes one. */
  function closing(needed: string): string {
    return [
      MACHINE_MARKER,
      "",
      "---",
      "",
      STAGE_HANDED_MARKER,
      "",
      "The piece cannot be planned as the list describes it.",
      "",
      `**What I need from you:** ${needed}`,
      "",
    ].join("\n");
  }

  it("reads what the stage asked for, in the stage's own words", () => {
    expect(askedFor(closing("say whether the nightly run keeps calls too."))).toBe(
      "say whether the nightly run keeps calls too.",
    );
  });

  // The whole point of reading it: `ivtrends` #111 asked for nothing, and the
  // wait said a question had been asked. Nothing is not a question, and this
  // says so rather than inventing one.
  it("has nothing to report when the comment carries no closing line", () => {
    const body = `${MACHINE_MARKER}\n\n---\n\n${STAGE_HANDED_MARKER}\n\nI stopped.`;

    expect(askedFor(body)).toBeUndefined();
  });

  it("has nothing to report when the closing line is empty", () => {
    expect(askedFor(closing(""))).toBeUndefined();
  });

  // A paragraph is not a line, and the standing note it would land in is one.
  it("has nothing to report when the ask is longer than a line", () => {
    expect(askedFor(closing("x".repeat(LONGEST_ASK + 1)))).toBeUndefined();
  });

  // Every Timone comment ends on this line, so a stage quoting an earlier
  // message would otherwise have the quote read as its own ask.
  it("reads the last of several, which is the stage's own", () => {
    const quoted = `> **What I need from you:** the old one.\n\n${closing("the new one.")}`;

    expect(askedFor(quoted)).toBe("the new one.");
  });
});
