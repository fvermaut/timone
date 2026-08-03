import { describe, expect, it } from "vitest";

import {
  MACHINE_MARKER,
  stampMachineComment,
  type TicketComment,
  type TicketThread,
} from "../adapters/ticketing.js";
import { APPROVAL_WORD, gateComment } from "./gate-comment.js";
import { APPROVAL_TOKENS, readGateDecision } from "./gates.js";

/** The instant the gate comment was posted; the cursor stored on the run. */
const GATE_POSTED_AT = "2026-08-03T10:00:00Z";

let tick = 0;

/** A human reply, after the gate unless `at` says otherwise. */
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

describe("readGateDecision", () => {
  it("reads an approval from a human reply after the gate", () => {
    const decision = readGateDecision(
      thread(machine("Ready for you.", GATE_POSTED_AT), human("approve")),
      GATE_POSTED_AT,
    );

    expect(decision).toMatchObject({ kind: "approve" });
  });

  it.each(APPROVAL_TOKENS)("accepts %s as an approval", (token) => {
    const decision = readGateDecision(thread(human(token)), GATE_POSTED_AT);
    expect(decision?.kind).toBe("approve");
  });

  it.each([
    ["Approve", "capitalised"],
    ["APPROVED", "shouted"],
    ["  approve  ", "padded"],
    ["Approved.", "with a full stop"],
    ["LGTM!", "with an exclamation"],
    ["**approve**", "bolded"],
    ["approve\n\nnice work", "with prose underneath"],
  ])("accepts %j (%s)", (body) => {
    const decision = readGateDecision(thread(human(body)), GATE_POSTED_AT);
    expect(decision?.kind).toBe("approve");
  });

  it.each([
    ["approve once you've fixed the wording", "a conditional approval"],
    ["yes but not the second half", "a qualified yes"],
    ["I think this is approved already?", "a question about approval"],
    ["can you make it shorter", "a plain change request"],
  ])("reads %j as a change request (%s)", (body) => {
    const decision = readGateDecision(thread(human(body)), GATE_POSTED_AT);

    expect(decision?.kind).toBe("change-request");
    expect(decision).toMatchObject({ feedback: body });
  });

  it("carries the human's exact words as the change request's feedback", () => {
    const words = "the phone keyboard covers the send button, that's the real problem";
    const decision = readGateDecision(thread(human(words)), GATE_POSTED_AT);

    expect(decision).toEqual({
      kind: "change-request",
      feedback: words,
      comment: expect.objectContaining({ body: words }),
    });
  });

  it("never reads a Timone comment as a decision, however it is worded", () => {
    const decision = readGateDecision(
      thread(
        machine("Reply `approve` to go ahead."),
        machine("approve"),
        machine("I approve of this plan."),
      ),
      GATE_POSTED_AT,
    );

    expect(decision).toBeUndefined();
  });

  it("discriminates by the marker and not by the author name", () => {
    // Timone posts through the human's account: both comments below carry the
    // same login, and only the marker tells them apart.
    const decision = readGateDecision(
      thread(machine("approve"), human("no, make it bigger")),
      GATE_POSTED_AT,
    );

    expect(decision).toMatchObject({
      kind: "change-request",
      feedback: "no, make it bigger",
    });
  });

  it("ignores everything at or before the cursor", () => {
    const decision = readGateDecision(
      thread(
        human("approve", "2026-08-03T09:30:00Z"),
        machine("Ready for you.", GATE_POSTED_AT),
      ),
      GATE_POSTED_AT,
    );

    expect(decision).toBeUndefined();
  });

  it("reads a stale approval only once a new gate cursor is passed", () => {
    // The same thread, read against an earlier gate, does yield that approval:
    // it is the cursor that scopes a decision, not the words.
    const replies = thread(human("approve", "2026-08-03T09:30:00Z"));

    expect(readGateDecision(replies, "2026-08-03T09:00:00Z")?.kind).toBe("approve");
    expect(readGateDecision(replies, GATE_POSTED_AT)).toBeUndefined();
  });

  it("yields nothing on an empty thread", () => {
    expect(readGateDecision(thread(), GATE_POSTED_AT)).toBeUndefined();
  });

  it("yields nothing while only Timone has spoken since the gate", () => {
    expect(
      readGateDecision(thread(machine("Still working.")), GATE_POSTED_AT),
    ).toBeUndefined();
  });

  it("resolves multiple replies to the first human one", () => {
    const decision = readGateDecision(
      thread(
        human("actually hold on, the title is wrong"),
        human("approve"),
      ),
      GATE_POSTED_AT,
    );

    expect(decision).toMatchObject({
      kind: "change-request",
      feedback: "actually hold on, the title is wrong",
    });
  });

  it("skips an empty human comment rather than calling it a change request", () => {
    // An empty comment carries neither an approval nor anything to act on.
    // Skipping it is safe in the one direction that matters: it can never
    // approve. The next real reply decides.
    const decision = readGateDecision(
      thread(human("   \n  "), human("approve")),
      GATE_POSTED_AT,
    );

    expect(decision?.kind).toBe("approve");
  });

  it("does not mistake a quoted machine marker for a machine comment", () => {
    // `fromTimone` is the adapter's judgement and this function's only input
    // on the question — a human quoting the marker is still a human.
    const quoted = human(`> ${MACHINE_MARKER}\n\nwhy does it say that?`);
    const decision = readGateDecision(thread(quoted), GATE_POSTED_AT);

    expect(decision?.kind).toBe("change-request");
  });
});

describe("gateComment", () => {
  const input = {
    headline: "I've written down what this ticket is asking for.",
    summary: ["It says the send button gets covered by the phone keyboard."],
    artifacts: [
      {
        label: "what I understood you're asking for",
        url: "https://github.com/fvermaut/scratch-app/blob/timone/6/doc/x.md",
      },
    ],
    onApproval: "work out how to build it and come back with a plan.",
  };

  it("opens with the headline and carries the summary", () => {
    const body = gateComment(input);

    expect(body.startsWith(`**${input.headline}**`)).toBe(true);
    expect(body).toContain(input.summary[0]);
  });

  it("links every artifact the human is asked to read", () => {
    const body = gateComment({
      ...input,
      artifacts: [
        input.artifacts[0],
        { label: "the plan", url: "https://example.test/plan.md" },
      ],
    });

    expect(body).toContain(`[${input.artifacts[0].label}](${input.artifacts[0].url})`);
    expect(body).toContain("[the plan](https://example.test/plan.md)");
  });

  it("ends with a CTA naming the literal word to reply", () => {
    const body = gateComment(input);
    const closing = body.slice(body.lastIndexOf("**What I need from you:**"));

    expect(closing).toContain(`\`${APPROVAL_WORD}\``);
    expect(closing).toContain(input.onApproval);
  });

  it("tells the human that anything else is read as a change", () => {
    // Replies are judged by shape; a reader who does not know that can be
    // surprised by their own gate, so the comment has to say it.
    expect(gateComment(input)).toContain("I read as a change");
  });

  it("asks for a word the decision reader actually accepts", () => {
    // The one assertion that stops the CTA and the parser drifting apart.
    const reply = readGateDecision(thread(human(APPROVAL_WORD)), GATE_POSTED_AT);

    expect(gateComment(input)).toContain(`\`${APPROVAL_WORD}\``);
    expect(reply?.kind).toBe("approve");
  });

  it("never stamps the machine marker — the adapter owns that", () => {
    expect(gateComment(input)).not.toContain(MACHINE_MARKER);
  });

  it("names no stage and no skill", () => {
    const body = gateComment(input).toLowerCase();

    for (const jargon of ["stage ", "timone-", "sub-phase", "prd", "adr"]) {
      expect(body).not.toContain(jargon);
    }
  });
});
