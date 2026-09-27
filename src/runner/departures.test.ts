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

  it("does not list building again after the check as a departure", () => {
    const entries: RecordEntry[] = [
      started("triage", "2026-09-27T10:00:00.000Z"),
      started("planning", "2026-09-27T10:10:00.000Z"),
      started("execution", "2026-09-27T10:20:00.000Z"),
      started("verification", "2026-09-27T10:50:00.000Z"),
      started("execution", "2026-09-27T11:00:00.000Z"),
      started("verification", "2026-09-27T11:20:00.000Z"),
      started("delivery", "2026-09-27T11:30:00.000Z"),
    ];

    expect(departuresOf(entries, RUN, defaultOrder("chore"))).toEqual([]);
  });
});
