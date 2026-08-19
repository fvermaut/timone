import { describe, expect, it } from "vitest";

import {
  MACHINE_MARKER,
  STAGE_DONE_MARKER,
  HANDBACK_MARKER,
  HANDBACK_STEP_PREFIX,
  STAGE_ESCALATED_MARKER,
  STAGE_HANDED_MARKER,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";
import { readHandback, readStageOutcome } from "./outcomes.js";

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

describe("readHandback", () => {
  // ADR-0035 D2/D3. A person and the machine cleared a stop in the terminal;
  // the session says so on the ticket and names where the work carries on.
  // Nothing writes one of these yet — this is the reader, landing first.

  /** The note as a session writes it: header, marker, words, the step. */
  function note(step?: string, overrides: Partial<TicketComment> = {}) {
    const named = step === undefined ? "" : `\n\n${HANDBACK_STEP_PREFIX} ${step}`;
    return comment({
      body: `${MACHINE_MARKER}\n\n---\n\n${HANDBACK_MARKER}\n\nWe went through it together and it is settled.${named}`,
      ...overrides,
    });
  }

  it("reads the step a session named", () => {
    const handback = readHandback(thread(note("building")), cursor);

    expect(handback).toMatchObject({ kind: "at", stage: "execution" });
  });

  it("reads a step named in any case, with room around it", () => {
    const handback = readHandback(thread(note("  Building  ")), cursor);

    expect(handback).toMatchObject({ kind: "at", stage: "execution" });
  });

  it("says so when the note names nothing, which is not the same as no note", () => {
    // Distinct answers on purpose: naming nothing means carry on where it
    // stopped, and no note at all means the run is still stopped.
    expect(readHandback(thread(note()), cursor)).toMatchObject({ kind: "unnamed" });
    expect(readHandback(thread(), cursor)).toBeUndefined();
  });

  it("refuses a name nobody defined, and carries it so the ticket can quote it", () => {
    const handback = readHandback(thread(note("the last bit")), cursor);

    expect(handback).toMatchObject({ kind: "unknown", named: "the last bit" });
  });

  it("is never a human's copy of the marker", () => {
    // The gate trap, for this marker by name: the machine's own bookkeeping
    // must not be movable by someone quoting it back.
    expect(
      readHandback(thread(note("building", { fromTimone: false })), cursor),
    ).toBeUndefined();
  });

  it("ignores a note at or before the cursor", () => {
    // A stop is answered only by what was written after it opened.
    expect(
      readHandback(thread(note("building", { createdAt: cursor })), cursor),
    ).toBeUndefined();
  });

  it("is not the stage's own account of why it stopped", () => {
    // An escalation comment must never resolve the escalation it declares.
    const escalation = comment({
      body: `${MACHINE_MARKER}\n\n---\n\n${STAGE_ESCALATED_MARKER}\n\nI can't sign that as you.`,
    });

    expect(readHandback(thread(escalation), cursor)).toBeUndefined();
  });

  it("takes the newest note, so a refused one can be corrected", () => {
    // Found by phase 26's live gate on `scratch-app` #39: reading the *first*
    // note left a run that had named a step nobody defined stuck for good.
    // The ticket asked the person to come back and say where to pick it up —
    // and the note they came back with could never be read, because an
    // earlier one was already there. The machine's latest word is the one
    // that counts, exactly as it is everywhere a person can correct
    // themselves.
    const handback = readHandback(
      thread(
        note("the rest of it", { createdAt: "2026-08-06T11:00:00Z" }),
        note("building", { createdAt: "2026-08-06T12:00:00Z" }),
      ),
      cursor,
    );

    expect(handback).toMatchObject({ kind: "at", stage: "execution" });
  });

  it("reports the newest note even when the newest is the unusable one", () => {
    // The other direction, and it must not be clever: a session that named a
    // good step and then corrected itself to a bad one is refused. Preferring
    // the usable note would have the machinery act on something its own last
    // word withdrew.
    const handback = readHandback(
      thread(
        note("building", { createdAt: "2026-08-06T11:00:00Z" }),
        note("the rest of it", { createdAt: "2026-08-06T12:00:00Z" }),
      ),
      cursor,
    );

    expect(handback).toMatchObject({ kind: "unknown", named: "the rest of it" });
  });
});
