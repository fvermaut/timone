import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readRegister, registerFaults } from "./register.js";

/** A register block, assembled from its parts so each test varies one thing. */
function block(options: {
  id?: string;
  title?: string;
  priority?: string;
  status?: string;
  verifyVia?: string;
  falsifiedBy?: string;
  criteria?: string;
  gate?: string;
  note?: string;
}): string {
  return [
    `## ${options.id ?? "R1"} — ${options.title ?? "A requirement"}`,
    "",
    ...(options.note === undefined ? [] : [`> ${options.note}`, ""]),
    `- **Priority:** ${options.priority ?? "MUST"}`,
    `- **Status:** ${options.status ?? "verified"}`,
    `- **Verify-via:** ${options.verifyVia ?? "live"}`,
    `- **Last live gate:** ${options.gate ?? "never"}`,
    ...(options.falsifiedBy === undefined
      ? []
      : [`- **Falsified-by:** ${options.falsifiedBy}`]),
    "- **Criteria:**",
    `    - ${options.criteria ?? "GIVEN a thing WHEN it happens THEN it works"}`,
    "- **Verification hint:** look at it",
    "",
  ].join("\n");
}

describe("reading a register", () => {
  it("splits it into requirements and reads their fields", () => {
    const blocks = readRegister(block({ id: "R1" }) + block({ id: "R2", priority: "SHOULD" }));

    expect(blocks.map((entry) => entry.id)).toEqual(["R1", "R2"]);
    expect(blocks[0]?.priority).toBe("MUST");
    expect(blocks[1]?.priority).toBe("SHOULD");
  });

  // The bug this had on its first run over the real registers: `Last live
  // gate: never` says a gate has never run, which is the opposite of a claim
  // about every case. Searching the whole block flagged eleven requirements
  // for a word answering a different question.
  it("reads the claim without the fields around it", () => {
    const blocks = readRegister(block({ gate: "never", criteria: "GIVEN x WHEN y THEN z" }));

    expect(blocks[0]?.criteria).toContain("GIVEN x");
    expect(blocks[0]?.criteria).not.toContain("never");
  });
});

describe("a claim that outruns what established it", () => {
  it("flags a universal closed by watching alone", () => {
    const faults = registerFaults(
      block({ criteria: "THEN at no point is the human told to run a command" }),
    );

    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatchObject({ requirement: "R1", kind: "watched-only" });
  });

  it("finds the universal in the title as well as the criteria", () => {
    const faults = registerFaults(block({ title: "Skills reach sessions, never repos" }));

    expect(faults.map((fault) => fault.kind)).toEqual(["watched-only"]);
  });

  it("accepts it once something can go red behind it", () => {
    const faults = registerFaults(
      block({
        criteria: "THEN at no point is the human told to run a command",
        falsifiedBy: "`ask-check.test.ts` — the empty import list",
      }),
    );

    expect(faults).toEqual([]);
  });

  it("flags a status that outruns the block's own notes", () => {
    const faults = registerFaults(
      block({ gate: "2026-09-07 PASS — clause 2 was never triggered" }),
    );

    expect(faults[0]).toMatchObject({ requirement: "R1", kind: "status-outruns-notes" });
  });

  // D2 is about what the register admits, not about what kind of claim it is,
  // so it applies on every channel — including the ones no test can reach.
  it("flags an admission even on a channel no test could cover", () => {
    const faults = registerFaults(
      block({ verifyVia: "human", note: "the discriminating case was never observed" }),
    );

    expect(faults[0]?.kind).toBe("status-outruns-notes");
  });

  it.each([
    ["it is not yet claimed to hold", { status: "draft" }],
    ["it is not a MUST", { priority: "SHOULD" }],
    ["it claims nothing about every case", { criteria: "THEN the page renders" }],
  ])("says nothing when %s", (_case, overrides) => {
    expect(
      registerFaults(
        block({ criteria: "THEN at no point does it fail", ...overrides }),
      ),
    ).toEqual([]);
  });
});

// The rule applied to the repository that wrote it. This is what would have
// fired on 2026-09-07, when PRD-03.R5 was marked verified on a live gate that
// had walked every path except the one ivtrends#90 walked three days later.
describe("this repository's own registers", () => {
  it("claim nothing they have not established", () => {
    const dir = join(import.meta.dirname, "..", "..", "doc", "specs", "prd");
    const found = readdirSync(dir)
      .filter((name) => name.endsWith(".criteria.md"))
      .flatMap((name) =>
        registerFaults(readFileSync(join(dir, name), "utf8")).map(
          (fault) => `${name} ${fault.requirement} (${fault.kind}): ${fault.detail}`,
        ),
      );

    expect(found).toEqual([]);
  });
});
