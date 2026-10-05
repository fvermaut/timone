import { describe, expect, it } from "vitest";

import { buildPlannerBrief } from "./brief.js";
import type { PlannerFacts } from "./facts.js";

/**
 * Ticket 12, with #7 building and #9's pull request #30 open, woken by
 * fvermaut's comment.
 */
const FACTS: PlannerFacts = {
  project: "scratch-app",
  ticket: {
    number: 12,
    title: "Due dates on tasks",
    labels: ["timone", "triage:feature"],
    plan: {
      kind: "known",
      value: {
        path: "doc/plans/phases/phase-50.md",
        title: "Phase 50 — Due dates",
        files: ["src/tasks.ts", "src/list.tsx"],
        text: "# Phase 50 — Due dates",
      },
    },
  },
  blockers: [{ number: 8, url: "https://github.com/fvermaut/scratch-app/issues/8", open: false }],
  others: [
    {
      number: 7,
      title: "Sort the list",
      state: { kind: "building" },
      plan: {
        kind: "known",
        value: {
          path: "doc/plans/phases/phase-51.md",
          title: "Phase 51 — Sorting",
          files: ["src/list.tsx", "src/sort.ts"],
          text: "# Phase 51 — Sorting",
        },
      },
    },
    {
      number: 9,
      title: "Colours for late tasks",
      state: {
        kind: "open-pull-request",
        pr: 30,
        files: { kind: "known", value: ["src/theme.ts", "src/theme.test.ts"] },
      },
      plan: { kind: "unknown", why: "the forge did not answer: ECONNRESET" },
    },
  ],
  comment: {
    author: "fvermaut",
    body: "Build this one now, the list change in #7 is small.",
    createdAt: "2026-10-05T08:55:00Z",
    fromTimone: false,
  },
};

describe("buildPlannerBrief: what the planner reads (ADR-0065 D3)", () => {
  it("lists the ticket and each ticket building or with an open pull request, with their files", () => {
    const { prompt } = buildPlannerBrief(FACTS);

    expect(prompt).toContain("scratch-app #12: Due dates on tasks");
    expect(prompt).toContain("Files its plan names: src/tasks.ts, src/list.tsx");
    expect(prompt).toContain(
      [
        "- #7: Sort the list. It is building.",
        "  Plan: doc/plans/phases/phase-51.md (Phase 51 — Sorting)",
        "  Files its plan names: src/list.tsx, src/sort.ts",
      ].join("\n"),
    );
    expect(prompt).toContain(
      [
        "- #9: Colours for late tasks. Its pull request #30 is open.",
        "  The plan of #9 could not be read: the forge did not answer: ECONNRESET.",
        "  Files pull request #30 changes: src/theme.ts, src/theme.test.ts",
      ].join("\n"),
    );
    expect(prompt).toContain("- #8, closed");
  });

  it("says the comment that woke the planner, and who wrote it", () => {
    const { prompt } = buildPlannerBrief(FACTS);

    expect(prompt).toContain(
      [
        "fvermaut wrote at 2026-10-05T08:55:00Z:",
        "",
        "> Build this one now, the list change in #7 is small.",
      ].join("\n"),
    );
  });

  it("says when no comment woke the planner", () => {
    const { prompt } = buildPlannerBrief({ ...FACTS, comment: undefined });

    expect(prompt).toContain("No comment woke you.");
    expect(prompt).not.toContain("fvermaut wrote at");
  });

  it("names the three tools that decide in its rules, and asks for exactly one, once", () => {
    const { system } = buildPlannerBrief(FACTS);

    expect(system).toContain("let_build");
    expect(system).toContain("hold");
    expect(system).toContain("pass_to_runner");
    expect(system).toContain("Call exactly one of let_build, hold and pass_to_runner, once.");
  });
});
