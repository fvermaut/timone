import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { appendEntry, readRecord, type RecordEntry } from "./record.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A throwaway directory standing in for the timone root. */
function root(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-record-"));
  tempDirs.push(dir);
  return dir;
}

describe("the run record", () => {
  it("reads an appended entry back equal to what was written", () => {
    const dir = root();
    const entry: RecordEntry = {
      kind: "step-ended",
      at: "2026-09-27T10:15:00.000Z",
      runId: "scratch-app#12/1",
      stage: "execution",
      sessionId: "3f1c9a52-7d0e-4b8a-9e51-0c2d6f4a7b19",
      ok: true,
      costUsd: 4.25,
    };

    appendEntry(dir, "scratch-app", 12, entry);

    expect(readRecord(dir, "scratch-app", 12)).toEqual({
      ok: true,
      value: [entry],
    });
  });

  it("names the line number when a line does not match the entry schema", () => {
    const dir = root();
    const folder = join(dir, ".timone", "records", "scratch-app");
    mkdirSync(folder, { recursive: true });
    // Line 2 is a finished step with no cost: the one field the limit needs.
    writeFileSync(
      join(folder, "12.jsonl"),
      [
        '{"kind":"woke","at":"2026-09-27T10:00:00.000Z","runId":"scratch-app#12/1","events":["ticket marked"]}',
        '{"kind":"step-ended","at":"2026-09-27T10:20:00.000Z","runId":"scratch-app#12/1","stage":"triage","sessionId":"a1","ok":true}',
        '{"kind":"notice","at":"2026-09-27T10:21:00.000Z","about":"limit"}',
        "",
      ].join("\n"),
    );

    const result = readRecord(dir, "scratch-app", 12);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(2);
    expect(result.error.message).toContain("line 2");
  });

  it("reads back the planner's hold and the cost of its session (ADR-0065 D2)", () => {
    const dir = root();
    const decision: RecordEntry = {
      kind: "planner-decision",
      at: "2026-10-05T10:00:00.000Z",
      runId: "scratch-app#12/1",
      decision: "hold",
      reason: "Both tickets change the task list.",
      waitsFor: [7],
    };
    const ended: RecordEntry = {
      kind: "planner-ended",
      at: "2026-10-05T10:00:05.000Z",
      runId: "scratch-app#12/1",
      ok: true,
      costUsd: 0.4,
    };

    appendEntry(dir, "scratch-app", 12, decision);
    appendEntry(dir, "scratch-app", 12, ended);

    expect(readRecord(dir, "scratch-app", 12)).toEqual({ ok: true, value: [decision, ended] });
  });

  it("names the line number when a planner's decision has no reason", () => {
    const dir = root();
    const folder = join(dir, ".timone", "records", "scratch-app");
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(folder, "12.jsonl"),
      [
        '{"kind":"woke","at":"2026-10-05T09:59:00.000Z","runId":"scratch-app#12/1","events":["the build was refused"]}',
        '{"kind":"planner-decision","at":"2026-10-05T10:00:00.000Z","runId":"scratch-app#12/1","decision":"build"}',
        "",
      ].join("\n"),
    );

    const result = readRecord(dir, "scratch-app", 12);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(2);
    expect(result.error.message).toContain("line 2");
  });

  it("reads a ticket with no record yet as an empty list", () => {
    expect(readRecord(root(), "scratch-app", 12)).toEqual({
      ok: true,
      value: [],
    });
  });
});
