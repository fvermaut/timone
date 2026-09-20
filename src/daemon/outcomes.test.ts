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
import { askedFor, LONGEST_ASK, readHandback, readStageOutcome } from "./outcomes.js";

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

  it("reads the marker when the session typed the picture in the wrong place", () => {
    // ivtrends #101, 2026-09-19. The session wrote every word of the line
    // right and put the emoji after the bold text instead of before it. The
    // plan was written, committed and pushed; the run was failed for having
    // recorded no outcome, and the retry that followed could not pass either.
    const moved = STAGE_DONE_MARKER.replace(/^(\S+) (\*\*[^*]+\*\*)/u, "$2 $1");
    expect(moved).toContain("**Step finished** 🏁");

    const outcome = readStageOutcome(
      thread(
        comment({
          body: `${MACHINE_MARKER}\n\n---\n\n${moved}\n\nThe plan is written.`,
        }),
      ),
      cursor,
    );

    expect(outcome?.kind).toBe("advanced");
  });

  it("still tells the three markers apart once the pictures are ignored", () => {
    // The words alone have to carry the distinction, or the tolerant read
    // would resolve every ending as whichever one it tested for first.
    for (const [marker, kind] of [
      [STAGE_DONE_MARKER, "advanced"],
      [STAGE_HANDED_MARKER, "handed-to-human"],
      [STAGE_ESCALATED_MARKER, "escalated"],
    ] as const) {
      const outcome = readStageOutcome(
        thread(
          comment({
            body: `${MACHINE_MARKER}\n\n---\n\n${marker.replace(/^\S+ /u, "")}\n\nSo it ended.`,
          }),
        ),
        cursor,
      );
      expect(outcome?.kind).toBe(kind);
    }
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
