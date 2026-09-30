import { describe, expect, it } from "vitest";

import {
  CLARIFICATION_MARKER,
  stampMachineComment,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";
import { clarifyingRounds } from "./gates.js";

let tick = 0;

/** A human reply. */
function human(body: string, at = `2026-08-03T10:${pad(++tick)}:00Z`): TicketComment {
  return { author: "fvermaut", body, createdAt: at, fromTimone: false };
}

/**
 * A Timone comment: stamped and flagged exactly as the adapter would
 * return it, so the tests exercise the real discrimination and not a
 * convenient shortcut.
 */
function machine(body: string, at = `2026-08-03T10:${pad(++tick)}:00Z`): TicketComment {
  return {
    author: "fvermaut",
    body: stampMachineComment(body),
    createdAt: at,
    fromTimone: true,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function thread(...comments: TicketComment[]): TicketThread {
  return {
    number: 6,
    title: "typing in the box is fiddly on my phone",
    body: "the message box is hard to use on mobile",
    labels: ["timone", "triage:feature"],
    url: "https://github.com/fvermaut/scratch-app/issues/6",
    author: "fvermaut",
    createdAt: "2026-08-03T09:00:00Z",
    comments,
  };
}

describe("clarifyingRounds", () => {
  it("counts nothing on a thread where the machine has only ever invited", () => {
    // The bound is spent by *asking again*, not by having opened the
    // conversation in the first place.
    const invited = machine("come and talk to me");
    const answered = human("it's the draft they lose");

    expect(clarifyingRounds(thread(invited, answered))).toBe(0);
  });

  it("counts the machine's clarifying question, once it has asked one", () => {
    const asked = machine(`${CLARIFICATION_MARKER}\n\nwhich of the two first?`);

    expect(clarifyingRounds(thread(machine("come and talk"), asked))).toBe(1);
  });

  it("never counts a human quoting the marker back", () => {
    // The count is what bounds the machine, so only the machine's own
    // comments may spend it. `fromTimone` is the adapter's marker-derived
    // judgement and this function's only input on the question — Timone posts
    // through the human's account, so the author says nothing.
    const quoted = human(`> ${CLARIFICATION_MARKER}\n\nwhy does it say that?`);

    expect(clarifyingRounds(thread(quoted))).toBe(0);
  });
});
