import { describe, expect, it } from "vitest";

import type { PipelineStage } from "../daemon/pipeline.js";
import {
  DEPARTURES_END,
  DEPARTURES_START,
  departureSection,
  departuresOf,
} from "./departures.js";
import { defaultOrder } from "./order.js";
import type { RecordEntry } from "./record.js";

const RUN = "scratch-app#12/1";

/** A step session starting, as the machine writes it down. */
function started(stage: PipelineStage, at: string): RecordEntry {
  return { kind: "step-started", at, runId: RUN, stage, sessionId: `s-${stage}` };
}

describe("the departures a pull request lists", () => {
  it("opens with a line saying the work was not checked, with the runner's reason, when the check did not run", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("planning", "2026-09-27T10:10:00.000Z"),
      started("execution", "2026-09-27T10:20:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-27T10:40:00.000Z",
        runId: RUN,
        skipped: ["verification"],
        reason: "The change only fixes a spelling mistake in the README.",
      },
      started("delivery", "2026-09-27T10:41:00.000Z"),
    ];

    const section = departureSection(
      departuresOf(entries, RUN, defaultOrder("chore")),
    );
    const lines = section.split("\n");

    expect(lines[0]).toBe(DEPARTURES_START);
    expect(lines[1]).toBe(
      "**Not checked.** No session other than the one that built this work checked it. " +
        "Reason: The change only fixes a spelling mistake in the README.",
    );
    expect(lines.at(-1)).toBe(DEPARTURES_END);
  });

  it("lists the interview and the approval of the requirements, each with the runner's reason, when neither ran", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-27T10:05:00.000Z",
        runId: RUN,
        skipped: ["clarification"],
        reason: "The ticket already lists every field the form needs.",
      },
      started("requirements", "2026-09-27T10:06:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-27T10:30:00.000Z",
        runId: RUN,
        skipped: ["requirements-approval"],
        reason: "fvermaut wrote on the ticket to go ahead without it.",
      },
      started("breakdown", "2026-09-27T10:31:00.000Z"),
      {
        kind: "approval",
        at: "2026-09-27T11:00:00.000Z",
        runId: RUN,
        what: "pieces",
        by: "fvermaut",
        commentAt: "2026-09-27T10:58:00.000Z",
      },
      started("planning", "2026-09-27T11:01:00.000Z"),
      started("execution", "2026-09-27T11:20:00.000Z"),
      started("verification", "2026-09-27T12:00:00.000Z"),
      started("delivery", "2026-09-27T12:30:00.000Z"),
    ];

    const lines = departureSection(
      departuresOf(entries, RUN, defaultOrder("feature")),
    ).split("\n");

    expect(lines).toContain(
      "- Asking what you need: did not run. Reason: The ticket already lists every field the form needs.",
    );
    expect(lines).toContain(
      "- Your approval of the requirements: did not run. Reason: fvermaut wrote on the ticket to go ahead without it.",
    );
  });

  it("says the default order was followed when every step ran in order", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("planning", "2026-09-27T10:10:00.000Z"),
      started("execution", "2026-09-27T10:20:00.000Z"),
      started("verification", "2026-09-27T10:50:00.000Z"),
      started("delivery", "2026-09-27T11:00:00.000Z"),
    ];

    expect(
      departureSection(departuresOf(entries, RUN, defaultOrder("chore"))),
    ).toBe(
      "<!-- timone:departures -->\nThe default order was followed.\n<!-- /timone:departures -->",
    );
  });

  it("still lists a departure the runner gave no reason for, marked as having no reason given", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-27T10:05:00.000Z",
        runId: RUN,
        skipped: ["planning"],
      },
      started("execution", "2026-09-27T10:06:00.000Z"),
      started("verification", "2026-09-27T10:40:00.000Z"),
      started("delivery", "2026-09-27T10:50:00.000Z"),
    ];

    const lines = departureSection(
      departuresOf(entries, RUN, defaultOrder("bug")),
    ).split("\n");

    expect(lines).toContain("- Preparing the work: did not run. No reason given.");
  });

  it("lists a step that ran only after a later step had already run as out of order", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-27T10:05:00.000Z",
        runId: RUN,
        skipped: ["planning"],
        reason: "The fix was clear from the ticket; the plan is written afterwards for the record.",
      },
      started("execution", "2026-09-27T10:06:00.000Z"),
      started("planning", "2026-09-27T10:30:00.000Z"),
      started("verification", "2026-09-27T10:40:00.000Z"),
      started("delivery", "2026-09-27T10:50:00.000Z"),
    ];

    const lines = departureSection(
      departuresOf(entries, RUN, defaultOrder("chore")),
    ).split("\n");

    expect(lines).toContain(
      "- Preparing the work: ran out of order. Reason: The fix was clear from the ticket; the plan is written afterwards for the record.",
    );
  });

  it("lists building again after the check as out of order, with no reason given when the runner gave none", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("planning", "2026-09-27T10:10:00.000Z"),
      started("execution", "2026-09-27T10:20:00.000Z"),
      started("verification", "2026-09-27T10:50:00.000Z"),
      started("execution", "2026-09-27T11:00:00.000Z"),
      started("verification", "2026-09-27T11:20:00.000Z"),
      started("delivery", "2026-09-27T11:30:00.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("chore")))).toBe(
      [
        DEPARTURES_START,
        "**Steps that did not follow the default order:**",
        "- Building: ran out of order. No reason given.",
        DEPARTURES_END,
      ].join("\n"),
    );
  });

  it("lists a step that went back more than once on one line", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("planning", "2026-09-27T10:10:00.000Z"),
      started("execution", "2026-09-27T10:20:00.000Z"),
      started("verification", "2026-09-27T10:50:00.000Z"),
      started("execution", "2026-09-27T11:00:00.000Z"),
      started("verification", "2026-09-27T11:20:00.000Z"),
      started("execution", "2026-09-27T11:30:00.000Z"),
      started("verification", "2026-09-27T11:50:00.000Z"),
      started("delivery", "2026-09-27T12:00:00.000Z"),
    ];

    expect(departuresOf(entries, RUN, defaultOrder("chore"))).toEqual([
      { kind: "out-of-order", step: defaultOrder("chore")[2], reason: undefined },
    ]);
  });

  it("does not list a step started again before any later step ran", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("planning", "2026-09-27T10:10:00.000Z"),
      started("execution", "2026-09-27T10:20:00.000Z"),
      started("execution", "2026-09-27T10:30:00.000Z"),
      started("verification", "2026-09-27T10:50:00.000Z"),
      started("delivery", "2026-09-27T11:00:00.000Z"),
    ];

    expect(departuresOf(entries, RUN, defaultOrder("chore"))).toEqual([]);
  });

  it("opens with the line saying the work was not checked when building ran again after the check and delivering started with no new check", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-29T10:00:00.000Z"),
      started("planning", "2026-09-29T10:10:00.000Z"),
      started("execution", "2026-09-29T10:20:00.000Z"),
      started("verification", "2026-09-29T10:50:00.000Z"),
      started("execution", "2026-09-29T11:00:00.000Z"),
      started("delivery", "2026-09-29T11:30:00.000Z"),
    ];

    const lines = departureSection(
      departuresOf(entries, RUN, defaultOrder("chore")),
    ).split("\n");

    expect(lines).toEqual([
      DEPARTURES_START,
      "**Not checked.** No session other than the one that built this work checked it. No reason given.",
      "",
      "**Steps that did not follow the default order:**",
      "- Building: ran out of order. No reason given.",
      DEPARTURES_END,
    ]);
  });

  it("gives the runner's reason for leaving out the check of the second building", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-29T10:00:00.000Z"),
      started("planning", "2026-09-29T10:10:00.000Z"),
      started("execution", "2026-09-29T10:20:00.000Z"),
      started("verification", "2026-09-29T10:50:00.000Z"),
      started("execution", "2026-09-29T11:00:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-29T11:29:00.000Z",
        runId: RUN,
        skipped: ["verification"],
        reason: "The second building only renamed one test.",
      },
      started("delivery", "2026-09-29T11:30:00.000Z"),
    ];

    const lines = departureSection(
      departuresOf(entries, RUN, defaultOrder("chore")),
    ).split("\n");

    expect(lines[1]).toBe(
      "**Not checked.** No session other than the one that built this work checked it. " +
        "Reason: The second building only renamed one test.",
    );
  });

  it("does not say the work was not checked when the check ran after delivering, with nothing built in between", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-29T10:00:00.000Z"),
      started("planning", "2026-09-29T10:10:00.000Z"),
      started("execution", "2026-09-29T10:20:00.000Z"),
      started("delivery", "2026-09-29T10:50:00.000Z"),
      started("verification", "2026-09-29T11:00:00.000Z"),
    ];

    expect(departuresOf(entries, RUN, defaultOrder("chore"))).toEqual([
      { kind: "out-of-order", step: defaultOrder("chore")[3], reason: undefined },
    ]);
  });

  it("lists three steps that did not run for one reason as one line naming the three, with the reason once", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-28T09:00:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-28T09:05:00.000Z",
        runId: RUN,
        skipped: ["clarification", "requirements", "requirements-approval"],
        reason: "fvermaut wrote on the ticket that this is a small change and can go straight to the pieces.",
      },
      started("breakdown", "2026-09-28T09:06:00.000Z"),
      {
        kind: "approval",
        at: "2026-09-28T09:30:00.000Z",
        runId: RUN,
        what: "pieces",
        by: "fvermaut",
        commentAt: "2026-09-28T09:29:00.000Z",
      },
      started("planning", "2026-09-28T09:31:00.000Z"),
      started("execution", "2026-09-28T09:50:00.000Z"),
      started("verification", "2026-09-28T10:20:00.000Z"),
      started("delivery", "2026-09-28T10:40:00.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("feature")))).toBe(
      [
        "<!-- timone:departures -->",
        "**Steps that did not follow the default order:**",
        "- Asking what you need, writing down what it needs and your approval of the requirements: did not run. " +
          "Reason: fvermaut wrote on the ticket that this is a small change and can go straight to the pieces.",
        "<!-- /timone:departures -->",
      ].join("\n"),
    );
  });

  it("keeps a skipped check as its own first line when it shares its reason with the steps grouped below it", () => {
    const reason = "fvermaut wrote on the ticket that this is a small change and can go straight to the pieces.";
    const entries: RecordEntry[] = [
      started("triage", "2026-09-28T09:00:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-28T09:05:00.000Z",
        runId: RUN,
        skipped: ["clarification", "requirements", "requirements-approval"],
        reason,
      },
      started("breakdown", "2026-09-28T09:06:00.000Z"),
      {
        kind: "approval",
        at: "2026-09-28T09:30:00.000Z",
        runId: RUN,
        what: "pieces",
        by: "fvermaut",
        commentAt: "2026-09-28T09:29:00.000Z",
      },
      started("planning", "2026-09-28T09:31:00.000Z"),
      started("execution", "2026-09-28T09:50:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-28T10:19:00.000Z",
        runId: RUN,
        skipped: ["verification"],
        reason,
      },
      started("delivery", "2026-09-28T10:20:00.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("feature")))).toBe(
      [
        "<!-- timone:departures -->",
        "**Not checked.** No session other than the one that built this work checked it. " +
          "Reason: fvermaut wrote on the ticket that this is a small change and can go straight to the pieces.",
        "",
        "**Steps that did not follow the default order:**",
        "- Asking what you need, writing down what it needs and your approval of the requirements: did not run. " +
          "Reason: fvermaut wrote on the ticket that this is a small change and can go straight to the pieces.",
        "<!-- /timone:departures -->",
      ].join("\n"),
    );
  });

  it("does not put a step that ran out of order on one line with a step that did not run, though they share a reason", () => {
    const entries: RecordEntry[] = [
      {
        kind: "departure",
        at: "2026-09-28T09:00:00.000Z",
        runId: RUN,
        skipped: ["triage", "planning"],
        reason: "The ticket says it is a small change that can go straight to building.",
      },
      started("execution", "2026-09-28T09:01:00.000Z"),
      started("planning", "2026-09-28T09:20:00.000Z"),
      started("verification", "2026-09-28T09:30:00.000Z"),
      started("delivery", "2026-09-28T09:45:00.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("chore")))).toBe(
      [
        "<!-- timone:departures -->",
        "**Steps that did not follow the default order:**",
        "- Sorting the request: did not run. Reason: The ticket says it is a small change that can go straight to building.",
        "- Preparing the work: ran out of order. Reason: The ticket says it is a small change that can go straight to building.",
        "<!-- /timone:departures -->",
      ].join("\n"),
    );
  });

  it("lists steps with no reason given on one line, a reason of only spaces counted as none", () => {
    const entries: RecordEntry[] = [
      { kind: "departure", at: "2026-09-28T09:00:00.000Z", runId: RUN, skipped: ["triage"] },
      { kind: "departure", at: "2026-09-28T09:00:30.000Z", runId: RUN, skipped: ["planning"], reason: "   " },
      started("execution", "2026-09-28T09:01:00.000Z"),
      started("verification", "2026-09-28T09:30:00.000Z"),
      started("delivery", "2026-09-28T09:45:00.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("chore")))).toBe(
      [
        "<!-- timone:departures -->",
        "**Steps that did not follow the default order:**",
        "- Sorting the request and preparing the work: did not run. No reason given.",
        "<!-- /timone:departures -->",
      ].join("\n"),
    );
  });

  it("puts each line where the first step it names was, when steps with one reason are not next to each other", () => {
    const goAhead = "fvermaut wrote on the ticket to go ahead without waiting for him.";
    const entries: RecordEntry[] = [
      started("triage", "2026-09-28T09:00:00.000Z"),
      { kind: "departure", at: "2026-09-28T09:05:00.000Z", runId: RUN, skipped: ["clarification"], reason: goAhead },
      started("requirements", "2026-09-28T09:06:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-28T09:30:00.000Z",
        runId: RUN,
        skipped: ["requirements-approval"],
        reason: "The requirements only say again what the ticket says.",
      },
      started("breakdown", "2026-09-28T09:31:00.000Z"),
      {
        kind: "departure",
        at: "2026-09-28T09:50:00.000Z",
        runId: RUN,
        skipped: ["pieces-approval", "planning"],
        reason: goAhead,
      },
      started("execution", "2026-09-28T09:51:00.000Z"),
      started("verification", "2026-09-28T10:20:00.000Z"),
      started("delivery", "2026-09-28T10:40:00.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("feature")))).toBe(
      [
        "<!-- timone:departures -->",
        "**Steps that did not follow the default order:**",
        "- Asking what you need, your approval of the list of pieces and preparing the work: did not run. " +
          "Reason: fvermaut wrote on the ticket to go ahead without waiting for him.",
        "- Your approval of the requirements: did not run. Reason: The requirements only say again what the ticket says.",
        "<!-- /timone:departures -->",
      ].join("\n"),
    );
  });
});

describe("the departures of a run that has not reached its order (40u)", () => {
  it("lists no departures when no step of the order has been reached", () => {
    // Verification of phase 40, found outside the verdicts, item 5: with no
    // step reached, every step of the order but the last was listed as not
    // run, before anything had run.
    const entries: RecordEntry[] = [
      { kind: "woke", at: "2026-09-27T10:00:00.000Z", runId: RUN, events: ["a new ticket"] },
    ];

    expect(departuresOf(entries, RUN, defaultOrder("feature"))).toEqual([]);
  });
});

describe("the departures of a run whose approvals were written into their files (40v)", () => {
  /** A named person's approval, as the machine writes it down. */
  function approval(what: "requirements" | "pieces", at: string): RecordEntry {
    return { kind: "approval", at, runId: RUN, what, by: "fvermaut", commentAt: at };
  }

  /**
   * The short session that writes an approval into its file. It has the
   * stage of the step that wrote the file, and starts after the approval.
   */
  function recording(stage: PipelineStage, what: "requirements" | "pieces", at: string): RecordEntry {
    return { kind: "step-started", at, runId: RUN, stage, sessionId: `s-record-${what}`, records: what };
  }

  it("lists no departures for a feature run that followed the order, each approval followed by the session that writes it into its file", () => {
    // The Spec review of phase 40, finding 1: this run's pull request said
    // "writing down what it needs" and "working out the pieces" ran out of
    // order, though every step ran as written.
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("clarification", "2026-09-27T10:05:00.000Z"),
      started("requirements", "2026-09-27T10:20:00.000Z"),
      approval("requirements", "2026-09-27T11:00:00.000Z"),
      recording("requirements", "requirements", "2026-09-27T11:00:01.000Z"),
      started("breakdown", "2026-09-27T11:10:00.000Z"),
      approval("pieces", "2026-09-27T12:00:00.000Z"),
      recording("breakdown", "pieces", "2026-09-27T12:00:01.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("feature")))).toBe(
      "<!-- timone:departures -->\nThe default order was followed.\n<!-- /timone:departures -->",
    );
  });

  it("lists only sorting when the same run left sorting out", () => {
    const entries: RecordEntry[] = [
      {
        kind: "departure",
        at: "2026-09-27T10:04:00.000Z",
        runId: RUN,
        skipped: ["triage"],
        reason: "fvermaut sorted the ticket as a feature by hand.",
      },
      started("clarification", "2026-09-27T10:05:00.000Z"),
      started("requirements", "2026-09-27T10:20:00.000Z"),
      approval("requirements", "2026-09-27T11:00:00.000Z"),
      recording("requirements", "requirements", "2026-09-27T11:00:01.000Z"),
      started("breakdown", "2026-09-27T11:10:00.000Z"),
      approval("pieces", "2026-09-27T12:00:00.000Z"),
      recording("breakdown", "pieces", "2026-09-27T12:00:01.000Z"),
    ];

    expect(departureSection(departuresOf(entries, RUN, defaultOrder("feature")))).toBe(
      [
        "<!-- timone:departures -->",
        "**Steps that did not follow the default order:**",
        "- Sorting the request: did not run. Reason: fvermaut sorted the ticket as a feature by hand.",
        "<!-- /timone:departures -->",
      ].join("\n"),
    );
  });
});
