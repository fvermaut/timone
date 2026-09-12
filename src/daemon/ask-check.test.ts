import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  LONGEST_QUESTION,
  askCheck,
  askCheckPrompt,
  planAskCheck,
  readAskCheckAnswer,
  type AskCheckMemory,
} from "./ask-check.js";

const COMPOSED = "I can't take this one further myself. Run `timone takeover x#1`.";

function remembered(overrides: Partial<AskCheckMemory> = {}): AskCheckMemory {
  return {
    for: COMPOSED,
    question: "You wrote `aprrove`. Did you mean approve? Reply `yes`.",
    askedAt: "2026-09-11T10:00:00Z",
    ...overrides,
  };
}

describe("the limits hold by construction", () => {
  // PRD-04.R3 and R4. The check cannot move a run or withhold a message
  // because it is never handed anything that could, and a later edit wanting
  // it to has to widen the seam first. Asserted on the source rather than on
  // behaviour: a behavioural test only shows it did not do so this time.
  it("imports nothing at all, so it can reach no run, gate or tracker", () => {
    const source = readFileSync(new URL("./ask-check.ts", import.meta.url), "utf8");
    const imports = source.match(/^\s*import\s/gm) ?? [];

    expect(imports).toEqual([]);
  });

  it("offers no way to say post nothing", () => {
    // Every verdict this module can produce, across every input shape the
    // tests below drive it with, is one of exactly two kinds.
    const kinds = new Set(
      [
        readAskCheckAnswer("LET IT THROUGH"),
        readAskCheckAnswer("ASK: did you mean approve?"),
        readAskCheckAnswer("something else entirely"),
        readAskCheckAnswer(""),
      ].map((verdict) => verdict.kind),
    );

    expect([...kinds].sort()).toEqual(["as-composed", "ask-instead"]);
  });
});

describe("reading what the model said", () => {
  it("asks instead when told to ask", () => {
    expect(readAskCheckAnswer("ASK: You wrote `aprrove`. Did you mean approve?")).toEqual({
      kind: "ask-instead",
      question: "You wrote `aprrove`. Did you mean approve?",
    });
  });

  it("leaves the message alone when told to", () => {
    expect(readAskCheckAnswer("LET IT THROUGH")).toEqual({ kind: "as-composed" });
  });

  // PRD-04.R4: the fallback for a shape it does not recognise is the message
  // the machinery composed — never silence.
  it.each([
    ["prose it cannot read", "I think you should probably ask them about this"],
    ["an empty answer", "   "],
    ["an empty question", "ASK:   "],
    ["a question that is not short", `ASK: ${"x".repeat(LONGEST_QUESTION + 1)}`],
  ])("posts the composed message given %s", (_case, said) => {
    expect(readAskCheckAnswer(said)).toEqual({ kind: "as-composed" });
  });

  it("posts the composed message when the model cannot be reached", async () => {
    const verdict = await askCheck(
      { composed: COMPOSED },
      { consult: async () => undefined },
    );

    expect(verdict).toEqual({ kind: "as-composed" });
  });
});

describe("the one-question budget", () => {
  // PRD-04.R5, all four branches. The budget is decided here, in code, before
  // any model is consulted.
  it("consults when it has asked nothing", () => {
    expect(planAskCheck(COMPOSED, undefined, undefined)).toEqual({ kind: "consult" });
  });

  it("consults when what is being asked has changed", () => {
    expect(planAskCheck("a different message", remembered(), undefined)).toEqual({
      kind: "consult",
    });
  });

  it("reuses its own words while nobody has answered, so the cycle changes nothing", () => {
    expect(planAskCheck(COMPOSED, remembered(), undefined)).toEqual({
      kind: "reuse",
      question: remembered().question,
    });
  });

  it("reuses its own words when the last thing said predates the question", () => {
    expect(planAskCheck(COMPOSED, remembered(), "2026-09-11T09:00:00Z")).toEqual({
      kind: "reuse",
      question: remembered().question,
    });
  });

  // The record is marked, never cleared. A cleared one let the check ask the
  // same question again on the next cycle, and whether that re-asked question
  // then re-triggered on the old answer came down to which instant happened to
  // be later.
  it("is finished with an ask for good once the answer has been acted on", () => {
    expect(
      planAskCheck(COMPOSED, remembered({ actedOn: true }), undefined),
    ).toEqual({ kind: "as-composed" });
  });

  it("stands aside once answered, so it never asks twice about one thing", () => {
    expect(planAskCheck(COMPOSED, remembered(), "2026-09-11T10:30:00Z")).toEqual({
      kind: "as-composed",
    });
  });
});

describe("what the model is told", () => {
  it("carries the message and what the person wrote", () => {
    const prompt = askCheckPrompt({ composed: COMPOSED, lastWords: "aprrove" });

    expect(prompt).toContain(COMPOSED);
    expect(prompt).toContain("aprrove");
  });

  it("says plainly that it decides nothing", () => {
    expect(askCheckPrompt({ composed: COMPOSED })).toContain("You are not deciding anything");
  });

  it("leaves out the reply block when nobody has written", () => {
    expect(askCheckPrompt({ composed: COMPOSED })).not.toContain("the last thing the person wrote");
  });
});
