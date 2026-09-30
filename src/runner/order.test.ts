import { describe, expect, it } from "vitest";

import { defaultOrder, standingOf, ticketKindOf } from "./order.js";
import type { RecordEntry } from "./record.js";

/** A ticket that is neither a step of an initiative nor a fix to a reviewed pull request. */
const PLAIN = { isStep: false, isRemediation: false };

describe("the kind of a ticket, read off its labels", () => {
  it("reads triage:chore as a chore", () => {
    expect(ticketKindOf(["timone", "triage:chore"], PLAIN)).toBe("chore");
  });

  it("reads wayfinder:map as a map", () => {
    expect(ticketKindOf(["timone", "wayfinder:map"], PLAIN)).toBe("map");
  });

  it("reads wayfinder:research as research", () => {
    expect(ticketKindOf(["timone", "wayfinder:research"], PLAIN)).toBe("research");
  });

  it("reads the other wayfinder types as a decision ticket", () => {
    expect(ticketKindOf(["timone", "wayfinder:grilling"], PLAIN)).toBe("decision");
    expect(ticketKindOf(["timone", "wayfinder:prototype"], PLAIN)).toBe("decision");
    expect(ticketKindOf(["timone", "wayfinder:task"], PLAIN)).toBe("decision");
  });

  it("reads a step ticket as a step, whatever its labels say", () => {
    const step = { isStep: true, isRemediation: false };

    expect(ticketKindOf(["timone"], step)).toBe("step");
    expect(ticketKindOf(["timone", "triage:feature"], step)).toBe("step");
    expect(ticketKindOf(["timone", "wayfinder:map"], step)).toBe("step");
  });

  it("reads a fix to a reviewed pull request as a remediation, even on a step ticket", () => {
    expect(
      ticketKindOf(["timone", "triage:bug"], { isStep: false, isRemediation: true }),
    ).toBe("remediation");
    expect(ticketKindOf(["timone"], { isStep: true, isRemediation: true })).toBe(
      "remediation",
    );
  });
});

describe("where a run stands against its order", () => {
  it("names no running step of the order while the session that writes an approval into its file runs (40v)", () => {
    const run = "scratch-app#12/1";
    const entries: RecordEntry[] = [
      { kind: "step-started", at: "2026-09-27T10:00:00Z", runId: run, stage: "triage", sessionId: "s1" },
      { kind: "step-ended", at: "2026-09-27T10:03:00Z", runId: run, stage: "triage", sessionId: "s1", ok: true, costUsd: 0.4 },
      { kind: "step-started", at: "2026-09-27T10:05:00Z", runId: run, stage: "clarification", sessionId: "s2" },
      { kind: "step-ended", at: "2026-09-27T10:15:00Z", runId: run, stage: "clarification", sessionId: "s2", ok: true, costUsd: 1.1 },
      { kind: "step-started", at: "2026-09-27T10:20:00Z", runId: run, stage: "requirements", sessionId: "s3" },
      { kind: "step-ended", at: "2026-09-27T10:40:00Z", runId: run, stage: "requirements", sessionId: "s3", ok: true, costUsd: 2.4 },
      { kind: "approval", at: "2026-09-27T11:00:00Z", runId: run, what: "requirements", by: "fvermaut", commentAt: "2026-09-27T10:58:00Z" },
      { kind: "step-started", at: "2026-09-27T11:00:01Z", runId: run, stage: "requirements", sessionId: "s4", records: "requirements" },
    ];

    const standing = standingOf(entries, run, defaultOrder("feature"));

    expect(standing.running).toBeUndefined();
  });
});
