import { describe, expect, it } from "vitest";

import { DEFAULT_LIMIT_USD, allowanceOf, isOverLimit, spentOn } from "./limit.js";
import type { RecordEntry } from "./record.js";

/** A finished step of run `scratch-app#12/1` that cost `costUsd`. */
function stepCost(costUsd: number, at: string): RecordEntry {
  return {
    kind: "step-ended",
    at,
    runId: "scratch-app#12/1",
    stage: "execution",
    sessionId: `s-${at}`,
    ok: true,
    costUsd,
  };
}

describe("the spending limit of a ticket", () => {
  it("adds the cost of every step and every runner session, across two runs of the ticket", () => {
    const entries: RecordEntry[] = [
      {
        kind: "runner-ended",
        at: "2026-09-27T10:01:00.000Z",
        runId: "scratch-app#12/1",
        ok: true,
        costUsd: 0.75,
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:30:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s1",
        ok: true,
        costUsd: 12.5,
      },
      {
        kind: "limit-reached",
        at: "2026-09-27T10:31:00.000Z",
        spentUsd: 13.25,
      },
      {
        kind: "runner-ended",
        at: "2026-09-28T09:01:00.000Z",
        runId: "scratch-app#12/2",
        ok: false,
        costUsd: 1,
        error: "the session stopped",
      },
      {
        kind: "step-ended",
        at: "2026-09-28T09:40:00.000Z",
        runId: "scratch-app#12/2",
        stage: "verification",
        sessionId: "s2",
        ok: false,
        costUsd: 30.25,
      },
    ];

    expect(spentOn(entries)).toBe(44.5);
  });

  it("counts the $0.40 a planner session cost on the ticket it decided for (ADR-0065 D1)", () => {
    const entries: RecordEntry[] = [
      stepCost(12.5, "2026-09-27T10:30:00.000Z"),
      {
        kind: "planner-ended",
        at: "2026-09-27T11:00:00.000Z",
        runId: "scratch-app#12/1",
        ok: true,
        costUsd: 0.4,
      },
    ];

    expect(spentOn(entries)).toBe(12.9);
  });

  it("puts a ticket over its limit at $150 spent, but not at $149.50", () => {
    const at150: RecordEntry[] = [
      stepCost(100, "2026-09-27T10:00:00.000Z"),
      stepCost(50, "2026-09-27T11:00:00.000Z"),
    ];
    const at149AndAHalf: RecordEntry[] = [
      stepCost(100, "2026-09-27T10:00:00.000Z"),
      stepCost(49.5, "2026-09-27T11:00:00.000Z"),
    ];

    expect(isOverLimit(at150, DEFAULT_LIMIT_USD)).toBe(true);
    expect(isOverLimit(at149AndAHalf, DEFAULT_LIMIT_USD)).toBe(false);
  });

  it("allows $300 once a named person has said continue, so a ticket at $150 may go on", () => {
    const entries: RecordEntry[] = [
      stepCost(100, "2026-09-27T10:00:00.000Z"),
      stepCost(50, "2026-09-27T11:00:00.000Z"),
      {
        kind: "limit-raised",
        at: "2026-09-27T12:00:00.000Z",
        by: "fvermaut",
        commentAt: "2026-09-27T11:58:00.000Z",
      },
    ];

    expect(allowanceOf(entries, DEFAULT_LIMIT_USD)).toBe(300);
    expect(isOverLimit(entries, DEFAULT_LIMIT_USD)).toBe(false);
  });

  it("uses a project's own limit of $80 in place of $150", () => {
    const at80: RecordEntry[] = [
      stepCost(50, "2026-09-27T10:00:00.000Z"),
      stepCost(30, "2026-09-27T11:00:00.000Z"),
    ];
    const raisedOnce: RecordEntry[] = [
      ...at80,
      {
        kind: "limit-raised",
        at: "2026-09-27T12:00:00.000Z",
        by: "fvermaut",
        commentAt: "2026-09-27T11:58:00.000Z",
      },
    ];

    expect(isOverLimit(at80, 80)).toBe(true);
    expect(allowanceOf(raisedOnce, 80)).toBe(160);
  });
});
