import { describe, expect, it } from "vitest";

import type { RecordEntry } from "../runner/record.js";
import { renderRecord } from "./record.js";

/**
 * A record as `readRecord` hands it over when the file was read. Written out
 * rather than read from disk: the seam is the render, and the file's own
 * reading is tested in `src/runner/record.test.ts`.
 */
function read(entries: RecordEntry[]): { ok: true; value: RecordEntry[] } {
  return { ok: true, value: entries };
}

describe("renderRecord", () => {
  it("prints each step with the time it started, the time it ended, and what it cost", () => {
    const entries: RecordEntry[] = [
      {
        kind: "step-started",
        at: "2026-09-27T10:01:00.000Z",
        runId: "scratch-app#12/1",
        stage: "requirements",
        sessionId: "s-1",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:14:00.000Z",
        runId: "scratch-app#12/1",
        stage: "requirements",
        sessionId: "s-1",
        ok: true,
        costUsd: 1.2,
      },
      {
        kind: "step-started",
        at: "2026-09-27T10:20:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-2",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T11:02:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-2",
        ok: true,
        costUsd: 8.4,
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    expect(result.ok).toBe(true);
    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      "- Writing down what it needs: started 2026-09-27 10:01 UTC, ended 2026-09-27 10:14 UTC, cost $1.20.",
    );
    expect(text).toContain(
      "- Building: started 2026-09-27 10:20 UTC, ended 2026-09-27 11:02 UTC, cost $8.40.",
    );
  });

  it("prints each decision with the reason given for it", () => {
    const entries: RecordEntry[] = [
      {
        kind: "decision",
        at: "2026-09-27T10:00:00.000Z",
        runId: "scratch-app#12/1",
        action: "start_step",
        reason: "The ticket asks for a new page, so its needs come first.",
      },
      {
        kind: "decision",
        at: "2026-09-27T10:15:00.000Z",
        runId: "scratch-app#12/1",
        action: "post",
        reason: "The requirements are written and need an approval.",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    expect(result.ok).toBe(true);
    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      "- 2026-09-27 10:00 UTC — start a step. Reason: The ticket asks for a new page, so its needs come first.",
    );
    expect(text).toContain(
      "- 2026-09-27 10:15 UTC — write on the ticket. Reason: The requirements are written and need an approval.",
    );
  });

  it("prints each step that was left out of the default order, with the reason given", () => {
    const entries: RecordEntry[] = [
      {
        kind: "departure",
        at: "2026-09-27T10:19:00.000Z",
        runId: "scratch-app#12/1",
        skipped: ["clarification", "requirements-approval"],
        reason: "The ticket is a one-line fix.",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    expect(result.ok).toBe(true);
    const text = result.ok ? result.value : result.error;
    expect(text).toContain("Steps left out of the default order:");
    expect(text).toContain(
      "- 2026-09-27 10:19 UTC — asking what you need and your approval of the requirements. " +
        "Reason: The ticket is a one-line fix.",
    );
  });

  it("ends with what the ticket has spent, steps and runner together, against its limit", () => {
    const entries: RecordEntry[] = [
      {
        kind: "runner-ended",
        at: "2026-09-27T10:00:30.000Z",
        runId: "scratch-app#12/1",
        ok: true,
        costUsd: 2.24,
      },
      {
        kind: "step-started",
        at: "2026-09-27T10:01:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-1",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:40:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-1",
        ok: true,
        costUsd: 10.1,
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 80,
    });

    expect(result.ok).toBe(true);
    const text = result.ok ? result.value : result.error;
    // $10.10 + $2.24, worked out by hand.
    expect(text.split("\n").at(-1)).toBe(
      "This ticket has spent $12.34 of the $80.00 it may spend: " +
        "$10.10 on steps and $2.24 on the runner deciding what to do next.",
    );
  });

  it("says there is no record of a ticket nothing was written about, as a failure the command exits 1 on", () => {
    const result = renderRecord({
      project: "scratch-app",
      ticket: 999999,
      record: read([]),
      limitUsd: 150,
    });

    expect(result).toEqual({
      ok: false,
      error:
        "There is no record of scratch-app #999999: nothing has been written down about it yet. " +
        "A record is kept only for tickets in projects the runner works on.",
    });
  });

  it("names the broken line of a record that cannot be read, as a failure", () => {
    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: {
        ok: false,
        error: {
          line: 3,
          message:
            "The run record .timone/records/scratch-app/12.jsonl cannot be read: line 3 is not JSON.",
        },
      },
      limitUsd: 150,
    });

    expect(result).toEqual({
      ok: false,
      error:
        "The record of scratch-app #12 cannot be read: line 3 of " +
        ".timone/records/scratch-app/12.jsonl is broken. Fix that line, then run this again.",
    });
  });

  it("says a step that started and has no end written down has not ended", () => {
    const entries: RecordEntry[] = [
      {
        kind: "step-started",
        at: "2026-09-27T11:05:00.000Z",
        runId: "scratch-app#12/1",
        stage: "verification",
        sessionId: "s-3",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      "- Checking the result: started 2026-09-27 11:05 UTC, no end written down yet.",
    );
  });

  it("says a step that ended with a fault failed, and what the fault was", () => {
    const entries: RecordEntry[] = [
      {
        kind: "step-started",
        at: "2026-09-27T10:20:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-2",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:31:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-2",
        ok: false,
        costUsd: 3.5,
        error: "the session stopped on an API error (529: overloaded)",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      "- Building: started 2026-09-27 10:20 UTC, ended 2026-09-27 10:31 UTC, cost $3.50. " +
        "It failed: the session stopped on an API error (529: overloaded)",
    );
  });

  it("says a step the runner asked to stop was stopped by the runner, not that it failed", () => {
    const entries: RecordEntry[] = [
      {
        kind: "step-started",
        at: "2026-09-27T10:20:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-2",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:25:00.000Z",
        runId: "scratch-app#12/1",
        stage: "execution",
        sessionId: "s-2",
        ok: false,
        costUsd: 0.8,
        error: "the session was aborted",
        stoppedBy: "runner",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      "- Building: started 2026-09-27 10:20 UTC, ended 2026-09-27 10:25 UTC, cost $0.80. " +
        "The runner stopped it.",
    );
    expect(text).not.toContain("It failed");
  });

  it("still lists a step left out with no reason, and says no reason was given", () => {
    const entries: RecordEntry[] = [
      {
        kind: "departure",
        at: "2026-09-27T10:19:00.000Z",
        runId: "scratch-app#12/1",
        skipped: ["verification"],
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain("- 2026-09-27 10:19 UTC — checking the result. No reason given.");
  });

  it("shows under a decision that the machine refused it, and why", () => {
    const entries: RecordEntry[] = [
      {
        kind: "decision",
        at: "2026-09-27T10:05:00.000Z",
        runId: "scratch-app#12/1",
        action: "start_step",
        reason: "The work is ready to build.",
        detail:
          "Refused: Starting building now leaves out checking the result. Give the reason in skipReason, or start the step that comes first.",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      [
        "- 2026-09-27 10:05 UTC — start a step. Reason: The work is ready to build.",
        "  Refused: Starting building now leaves out checking the result. Give the reason in skipReason, or start the step that comes first.",
      ].join("\n"),
    );
  });

  it("says who allowed more, and when, when the limit was raised", () => {
    const entries: RecordEntry[] = [
      {
        kind: "runner-ended",
        at: "2026-09-27T10:00:30.000Z",
        runId: "scratch-app#12/1",
        ok: true,
        costUsd: 160,
      },
      {
        kind: "limit-raised",
        at: "2026-09-27T12:00:10.000Z",
        by: "fvermaut",
        commentAt: "2026-09-27T12:00:00.000Z",
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      [
        "This ticket has spent $160.00 of the $300.00 it may spend: " +
          "$0.00 on steps and $160.00 on the runner deciding what to do next.",
        "- fvermaut allowed another $150.00 on 2026-09-27 12:00 UTC.",
      ].join("\n"),
    );
  });

  it("says so under each list that has nothing in it, rather than leaving it blank", () => {
    const entries: RecordEntry[] = [
      {
        kind: "woke",
        at: "2026-09-27T10:00:00.000Z",
        runId: "scratch-app#12/1",
        events: ["fvermaut added the timone label"],
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain("Steps:\n- None.");
    expect(text).toContain("Decisions:\n- None.");
    expect(text).toContain("Steps left out of the default order:\n- None.");
  });

  it("names the session that writes an approval into its file as recording that approval, not as its step run again (40v)", () => {
    const entries: RecordEntry[] = [
      {
        kind: "step-started",
        at: "2026-09-27T10:01:00.000Z",
        runId: "scratch-app#12/1",
        stage: "requirements",
        sessionId: "s-1",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:14:00.000Z",
        runId: "scratch-app#12/1",
        stage: "requirements",
        sessionId: "s-1",
        ok: true,
        costUsd: 1.2,
      },
      {
        kind: "approval",
        at: "2026-09-27T10:31:00.000Z",
        runId: "scratch-app#12/1",
        what: "requirements",
        by: "fvermaut",
        commentAt: "2026-09-27T10:30:00.000Z",
      },
      {
        kind: "step-started",
        at: "2026-09-27T10:31:00.000Z",
        runId: "scratch-app#12/1",
        stage: "requirements",
        sessionId: "s-2",
        records: "requirements",
      },
      {
        kind: "step-ended",
        at: "2026-09-27T10:33:00.000Z",
        runId: "scratch-app#12/1",
        stage: "requirements",
        sessionId: "s-2",
        ok: true,
        costUsd: 0.05,
      },
    ];

    const result = renderRecord({
      project: "scratch-app",
      ticket: 12,
      record: read(entries),
      limitUsd: 150,
    });

    const text = result.ok ? result.value : result.error;
    expect(text).toContain(
      "- Recording the approval of the requirements: started 2026-09-27 10:31 UTC, ended 2026-09-27 10:33 UTC, cost $0.05.",
    );
    expect(text.split("\n").filter((line) => line.startsWith("- Writing down what it needs:"))).toHaveLength(1);
  });
});
