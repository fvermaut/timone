import { describe, expect, it } from "vitest";

import { latestUpdate, updateSection, withUpdate } from "./update-section.js";

/** The newest entry of `recordText`, or the test fails. */
function newest(recordText: string) {
  const entry = latestUpdate(recordText);
  if (entry === undefined) throw new Error("the record has no update entry");
  return entry;
}

describe("the update section of a pull request (ADR-0066)", () => {
  it("says the work was brought level, after which pull request, and what code changed and why, when every set passed (R7 clause 3)", () => {
    const record = [
      "# Phase 50 — updates",
      "",
      "## Update 1 — 2026-10-05T12:00:00Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** passed — 1262 tests passed",
      "- **Check scripts of this ticket:** passed — PRD-07.R7, PRD-07.R14",
      "- **Check scripts of the work that arrived:** passed — PRD-07.R5, PRD-07.R6",
      "- **Fixes:** 1",
      "- **Code changed:** `src/runner/driver.ts` now reads the place from `ledger.places`, because phase 49 renamed `ledger.slots` to it.",
      "- **Result:** passes",
      "",
    ].join("\n");

    expect(updateSection(newest(record), "main")).toBe(
      [
        "<!-- timone:update -->",
        "### Brought level with main",
        "",
        "What arrived on main: phase 49 (pull request #215).",
        "",
        "What had to change: `src/runner/driver.ts` now reads the place from `ledger.places`, because phase 49 renamed `ledger.slots` to it.",
        "",
        "- The whole test suite: passed — 1262 tests passed.",
        "- The check scripts of this ticket: passed — PRD-07.R7, PRD-07.R14.",
        "- The check scripts of the work that arrived: passed — PRD-07.R5, PRD-07.R6.",
        "<!-- /timone:update -->",
      ].join("\n"),
    );
  });

  it("says no code had to change when the record says none", () => {
    const record = [
      "## Update 1 — 2026-10-05T12:00:00Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** passed — 1262 tests passed",
      "- **Check scripts of this ticket:** passed — PRD-07.R7",
      "- **Check scripts of the work that arrived:** none — phase 49 claims no requirement",
      "- **Fixes:** 0",
      "- **Code changed:** none",
      "- **Result:** passes",
    ].join("\n");

    const lines = updateSection(newest(record), "main").split("\n");

    expect(lines).toContain("No code had to change.");
    expect(lines.some((line) => line.startsWith("What had to change"))).toBe(false);
  });

  it("says the work does not pass, and names the failure in its first lines, when the whole test suite still fails after two fixes (R7 clause 4)", () => {
    const record = [
      "## Update 1 — 2026-10-05T12:00:00Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** failed — 3 of 1262 tests fail in src/runner/driver.test.ts",
      "- **Check scripts of this ticket:** passed — PRD-07.R7",
      "- **Check scripts of the work that arrived:** passed — PRD-07.R5",
      "- **Fixes:** 2",
      "- **Code changed:** `src/runner/driver.ts` now reads `ledger.places`, because phase 49 renamed `ledger.slots`.",
      "- **Result:** does not pass — the driver still counts places from the old ledger field",
    ].join("\n");

    const lines = updateSection(newest(record), "main").split("\n");

    expect(lines.slice(1, 5)).toEqual([
      "### This work does not pass after being brought level with main",
      "",
      "It does not pass: the driver still counts places from the old ledger field.",
      "The whole test suite failed: 3 of 1262 tests fail in src/runner/driver.test.ts.",
    ]);
  });

  it("says the work does not pass, and names the set that did not run, when a set's line is missing and the result says passes (R7 clause 2)", () => {
    const record = [
      "## Update 1 — 2026-10-05T12:00:00Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** passed — 1262 tests passed",
      "- **Check scripts of this ticket:** passed — PRD-07.R7",
      "- **Fixes:** 0",
      "- **Code changed:** none",
      "- **Result:** passes",
    ].join("\n");

    const lines = updateSection(newest(record), "main").split("\n");

    expect(lines.slice(1, 4)).toEqual([
      "### This work does not pass after being brought level with main",
      "",
      "The check scripts of the work that arrived did not run.",
    ]);
    expect(lines).toContain("- The check scripts of the work that arrived: did not run.");
  });

  it("shows only the newest entry when the record holds two", () => {
    const record = [
      "# Phase 50 — updates",
      "",
      "## Update 1 — 2026-10-05T12:00:00Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** failed — 3 of 1262 tests fail in src/runner/driver.test.ts",
      "- **Check scripts of this ticket:** passed — PRD-07.R7",
      "- **Check scripts of the work that arrived:** passed — PRD-07.R5",
      "- **Fixes:** 2",
      "- **Code changed:** `src/runner/driver.ts` now reads `ledger.places`, because phase 49 renamed `ledger.slots`.",
      "- **Result:** does not pass — the driver still counts places from the old ledger field",
      "",
      "## Update 2 — 2026-10-06T09:30:00Z",
      "",
      "- **Level with:** main at 9b1e0d2",
      "- **Arrived:** phase 51 (pull request #218)",
      "- **Whole test suite:** passed — 1270 tests passed",
      "- **Check scripts of this ticket:** passed — PRD-07.R7",
      "- **Check scripts of the work that arrived:** none — phase 51 claims no requirement",
      "- **Fixes:** 0",
      "- **Code changed:** none",
      "- **Result:** passes",
      "",
    ].join("\n");

    const section = updateSection(newest(record), "main");

    expect(section.split("\n").slice(1, 4)).toEqual([
      "### Brought level with main",
      "",
      "What arrived on main: phase 51 (pull request #218).",
    ]);
    expect(section).not.toContain("pull request #215");
  });

  it("puts the update block first, above the departures block and the text, and changes nothing when run again", () => {
    const body = [
      "<!-- timone:departures -->",
      "The default order was followed.",
      "<!-- /timone:departures -->",
      "",
      "## What changed",
      "",
      'The README said "recieve"; it now says "receive".',
    ].join("\n");
    const section = [
      "<!-- timone:update -->",
      "### Brought level with main",
      "",
      "What arrived on main: phase 49 (pull request #215).",
      "<!-- /timone:update -->",
    ].join("\n");

    const once = withUpdate(body, section);

    expect(once).toBe(
      [
        "<!-- timone:update -->",
        "### Brought level with main",
        "",
        "What arrived on main: phase 49 (pull request #215).",
        "<!-- /timone:update -->",
        "",
        "<!-- timone:departures -->",
        "The default order was followed.",
        "<!-- /timone:departures -->",
        "",
        "## What changed",
        "",
        'The README said "recieve"; it now says "receive".',
      ].join("\n"),
    );
    expect(withUpdate(once, section)).toBe(once);
  });
});
