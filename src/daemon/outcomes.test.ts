import { describe, expect, it } from "vitest";

import {
  MACHINE_MARKER,
  STAGE_DONE_MARKER,
  STAGE_ESCALATED_MARKER,
  STAGE_HANDED_MARKER,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";
import { readStageOutcome } from "./outcomes.js";

const cursor = "2026-08-06T10:00:00Z";

function comment(overrides: Partial<TicketComment> = {}): TicketComment {
  return {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_DONE_MARKER}\n\nBuilt all five slices.`,
    createdAt: "2026-08-06T11:00:00Z",
    fromTimone: true,
    ...overrides,
  };
}

function thread(...comments: TicketComment[]): TicketThread {
  return {
    number: 6,
    title: "typing in the box is fiddly on my phone",
    body: "it keeps jumping around",
    labels: ["timone", "triage:feature"],
    url: "https://github.com/fvermaut/scratch-app/issues/6",
    author: "fvermaut",
    createdAt: "2026-08-01T09:00:00Z",
    comments,
  };
}

describe("readStageOutcome", () => {
  it("reads a done marker as the stage having advanced", () => {
    const outcome = readStageOutcome(thread(comment()), cursor);

    expect(outcome?.kind).toBe("advanced");
    expect(outcome?.comment.body).toContain("five slices");
  });

  it("reads a handed marker as the stage asking for a person", () => {
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_HANDED_MARKER}\n\nSlice 04c failed twice.`,
        }),
      ),
      cursor,
    );

    expect(outcome?.kind).toBe("handed-to-human");
  });

  it("never reads a human comment as a stage outcome, whatever it contains", () => {
    // The mirror of the gate trap: there, a machine must not speak for the
    // human; here, a human quoting the machine's bookkeeping back at the
    // ticket must not move the machine's bookkeeping.
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `Looks like it said "${STAGE_DONE_MARKER}" — nice!`,
          fromTimone: false,
        }),
      ),
      cursor,
    );

    expect(outcome).toBeUndefined();
  });

  it("ignores outcomes at or before the cursor", () => {
    const outcome = readStageOutcome(
      thread(comment({ createdAt: cursor })),
      cursor,
    );

    expect(outcome).toBeUndefined();
  });

  it("ignores machine comments carrying no marker", () => {
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\nStill working on it.`,
        }),
      ),
      cursor,
    );

    expect(outcome).toBeUndefined();
  });

  it("reads a comment carrying both markers as handed to a person", () => {
    // A confused comment must fail in the safe direction: a wrongly stopped
    // pipeline costs a retry, a wrongly advanced one builds on nothing.
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_DONE_MARKER}\n${STAGE_HANDED_MARKER}`,
        }),
      ),
      cursor,
    );

    expect(outcome?.kind).toBe("handed-to-human");
  });

  it("reads an escalation marker as the stage being unable to go on", () => {
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_ESCALATED_MARKER}\n\nI would have to reword the promises I check against.`,
        }),
      ),
      cursor,
    );

    expect(outcome?.kind).toBe("escalated");
    expect(outcome?.comment.body).toContain("promises I check against");
  });

  it("reads an escalation over a handoff on the same comment", () => {
    // An escalation is a handoff that has additionally given up on being
    // answered, so the pair resolves to the stronger of the two. Precedence
    // rather than the stage remembering not to write both: a comment carrying
    // both would otherwise park on a conversation nothing can conclude.
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_HANDED_MARKER}\n${STAGE_ESCALATED_MARKER}`,
        }),
      ),
      cursor,
    );

    expect(outcome?.kind).toBe("escalated");
  });

  it("never reads a human's copy of the escalation marker as one", () => {
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `you said "${STAGE_ESCALATED_MARKER}" — why?`,
          fromTimone: false,
        }),
      ),
      cursor,
    );

    expect(outcome).toBeUndefined();
  });

  it("returns undefined on an empty thread", () => {
    expect(readStageOutcome(thread(), cursor)).toBeUndefined();
  });

  it("resolves to the first machine outcome after the cursor", () => {
    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_HANDED_MARKER}\n\nfirst`,
          createdAt: "2026-08-06T11:00:00Z",
        }),
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_DONE_MARKER}\n\nsecond`,
          createdAt: "2026-08-06T12:00:00Z",
        }),
      ),
      cursor,
    );

    expect(outcome?.kind).toBe("handed-to-human");
  });
});
