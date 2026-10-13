import { describe, expect, it } from "vitest";

import { latestUpdate, unfinishedUpdate, updateSection, withUpdate } from "./update-section.js";

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

describe("the update record's time and joined check scripts (ADR-0068)", () => {
  it("reads the time of an entry from its heading, and none when the heading has no time or a time that is not a date", () => {
    const fields = [
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Result:** passes",
    ];

    expect(newest(["## Update 3 — 2026-10-13T12:38:51Z", ...fields].join("\n")).at).toBe("2026-10-13T12:38:51Z");
    expect(newest(["## Update 3", ...fields].join("\n")).at).toBeUndefined();
    expect(newest(["## Update 3 — not a time", ...fields].join("\n")).at).toBeUndefined();
  });

  it("reads the joined check scripts whole, with every requirement and how each was joined", () => {
    const record = [
      "## Update 3 — 2026-10-13T12:38:51Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Check scripts joined:** PRD-17.R3: kept the version that fails wherever the other would; PRD-18.R12: kept both sides' checks",
      "- **Result:** passes",
    ].join("\n");

    expect(newest(record).checkScriptsJoined).toBe(
      "PRD-17.R3: kept the version that fails wherever the other would; PRD-18.R12: kept both sides' checks",
    );
  });

  it("says which check scripts were joined and how, under what had to change, and leaves the heading as it was", () => {
    const withoutJoined = [
      "## Update 3 — 2026-10-13T12:38:51Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** passed — 1262 tests passed",
      "- **Check scripts of this ticket:** passed — PRD-17.R3",
      "- **Check scripts of the work that arrived:** passed — PRD-18.R12",
      "- **Fixes:** 0",
      "- **Code changed:** `src/runner/driver.ts` now reads the place from `ledger.places`, because phase 49 renamed `ledger.slots` to it.",
      "- **Result:** passes",
    ];
    const withJoined = [
      ...withoutJoined.slice(0, 9),
      "- **Check scripts joined:** PRD-17.R3: kept the version that fails wherever the other would; PRD-18.R12: kept both sides' checks",
      ...withoutJoined.slice(9),
    ];

    expect(updateSection(newest(withJoined.join("\n")), "main")).toBe(
      [
        "<!-- timone:update -->",
        "### Brought level with main",
        "",
        "What arrived on main: phase 49 (pull request #215).",
        "",
        "What had to change: `src/runner/driver.ts` now reads the place from `ledger.places`, because phase 49 renamed `ledger.slots` to it.",
        "",
        "Check scripts joined: PRD-17.R3: kept the version that fails wherever the other would; PRD-18.R12: kept both sides' checks.",
        "",
        "- The whole test suite: passed — 1262 tests passed.",
        "- The check scripts of this ticket: passed — PRD-17.R3.",
        "- The check scripts of the work that arrived: passed — PRD-18.R12.",
        "<!-- /timone:update -->",
      ].join("\n"),
    );
    expect(updateSection(newest(withoutJoined.join("\n")), "main").split("\n")[1]).toBe(
      "### Brought level with main",
    );
  });

  it("says nothing about joined check scripts when the record says none, or has no such line", () => {
    const withoutJoined = [
      "## Update 3 — 2026-10-13T12:38:51Z",
      "",
      "- **Level with:** main at 1630843",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** passed — 1262 tests passed",
      "- **Check scripts of this ticket:** passed — PRD-17.R3",
      "- **Check scripts of the work that arrived:** passed — PRD-18.R12",
      "- **Fixes:** 0",
      "- **Code changed:** none",
      "- **Result:** passes",
    ];
    const joinedNone = [...withoutJoined.slice(0, 9), "- **Check scripts joined:** none", ...withoutJoined.slice(9)];

    for (const record of [joinedNone, withoutJoined]) {
      const lines = updateSection(newest(record.join("\n")), "main").split("\n");

      expect(lines.some((line) => line.startsWith("Check scripts joined"))).toBe(false);
    }
  });
});

/** An update entry written at `at`, level with main at 9b1e0d2, whose result is `result`. */
function entryAt(at: string, result: string) {
  return newest(
    [
      `## Update 2 — ${at}`,
      "",
      "- **Level with:** main at 9b1e0d2",
      "- **Arrived:** phase 49 (pull request #215)",
      "- **Whole test suite:** failed — 3 tests failed in src/runner/driver.test.ts",
      "- **Check scripts of this ticket:** passed — PRD-07.R7",
      "- **Check scripts of the work that arrived:** none — phase 49 claims no requirement",
      "- **Fixes:** 2",
      "- **Code changed:** none",
      `- **Result:** ${result}`,
    ].join("\n"),
  );
}

/** When the update step in these cases started. */
const STARTED_AT = "2026-10-13T14:00:00.000Z";

describe("why an update step that ended cleanly did not do its work (ADR-0068 D4)", () => {
  it("finds nothing wrong when the step wrote a new entry and the branch holds its commit, also when the work does not pass", () => {
    for (const result of ["passes", "does not pass — 3 tests failed in src/runner/driver.test.ts"]) {
      const entry = entryAt("2026-10-13T14:20:00Z", result);

      expect(
        unfinishedUpdate({ entry, startedAt: STARTED_AT, holds: true, behind: 2, defaultBranch: "main" }),
        result,
      ).toBeUndefined();
    }
  });

  it("says the merge was not finished, naming the commit and the failure the entry gives, when the branch does not hold that commit", () => {
    const entry = entryAt(
      "2026-10-13T14:20:00Z",
      "does not pass — main could not be merged in: src/runner/driver.ts is left in conflict",
    );

    expect(unfinishedUpdate({ entry, startedAt: STARTED_AT, holds: false, behind: 2, defaultBranch: "main" })).toBe(
      "the merge of main at 9b1e0d2 was not finished: main could not be merged in: src/runner/driver.ts is left in conflict",
    );
  });

  it("finds nothing wrong when the only entry is older than the step and the branch is level, whatever that old entry says", () => {
    // Written by an earlier update, an hour before this step started. Its
    // commit is not on the branch, but this step did not write it.
    const entry = entryAt("2026-10-13T13:00:00Z", "does not pass — main could not be merged in: a conflict");

    expect(
      unfinishedUpdate({ entry, startedAt: STARTED_AT, holds: false, behind: 0, defaultBranch: "main" }),
    ).toBeUndefined();
  });

  it("says the step wrote no entry and how far the branch is still behind, when there is no entry and the branch is behind", () => {
    expect(
      unfinishedUpdate({ entry: undefined, startedAt: STARTED_AT, holds: undefined, behind: 3, defaultBranch: "main" }),
    ).toBe("it wrote no record entry, and the branch is still 3 commits behind main");
    expect(
      unfinishedUpdate({ entry: undefined, startedAt: STARTED_AT, holds: undefined, behind: 1, defaultBranch: "main" }),
    ).toBe("it wrote no record entry, and the branch is still 1 commit behind main");
  });

  it("finds nothing wrong when the forge did not say whether the branch holds the commit, or how far it is behind", () => {
    const entry = entryAt("2026-10-13T14:20:00Z", "does not pass — main could not be merged in: a conflict");

    expect(
      unfinishedUpdate({ entry, startedAt: STARTED_AT, holds: undefined, behind: 3, defaultBranch: "main" }),
    ).toBeUndefined();
    expect(
      unfinishedUpdate({ entry: undefined, startedAt: STARTED_AT, holds: false, behind: undefined, defaultBranch: "main" }),
    ).toBeUndefined();
  });
});
