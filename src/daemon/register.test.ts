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

// timone#250. "was never" was on the admission list, and PRD-07.R3's note
// used the two words about the build before a fix, in a note that says every
// clause passes on this one. The check then refused the stop of a session that
// had only made that register more honest.
describe("an old build's words are not an admission (timone#250)", () => {
  // A frozen copy of PRD-07.R3 as the register had it on 2026-10-18, so a later
  // edit of the register cannot take this case away.
  const PRD_07_R3 = [
    "## R3 — A freed place goes to one ticket: `priority:high` first, then the oldest",
    "",
    "> ✏ 2026-10-13 — checked in [phase-60-verification.md](../../plans/phases/reports/phase-60-verification.md), with its probe [`prd-07.r3.mjs`](../../plans/phases/probes/prd-07.r3.mjs): all four clauses pass on this build. Clause 3 was also checked for a ticket refused a place when its runner asked to record an approval: the freed place went to it, its next try was not refused, the step that writes the approval started, and the other waiting ticket was not told. This check went red on the build from just before phase 60, where that ticket was never woken and the place went to the other one. The status stays `verified`.",
    "",
    "- **Priority:** MUST",
    "- **Status:** verified",
    "- **Verify-via:** api",
    "- **Falsified-by:** a test with two tickets waiting for one place, which frees it and fails if both are woken, or if the woken one's step is refused for want of a place",
    "- **Depends-on:** `src/daemon/runs.ts, src/runner/driver.ts`",
    "- **Criteria:**",
    "    - GIVEN tickets waiting for a place on a project, one of them labelled `priority:high`",
    "      WHEN a place frees",
    "      THEN the place goes to the ticket labelled `priority:high`",
    "    - GIVEN tickets waiting for a place on a project, none labelled `priority:high`, or several",
    "      WHEN a place frees",
    "      THEN the place goes to the oldest of them",
    "    - GIVEN a place given to one ticket",
    "      WHEN its runner wakes and starts a step",
    "      THEN the step is not refused for want of a place",
    "      AND no other ticket of the project was told that a place is free ([#184](https://github.com/fvermaut/timone/issues/184))",
    "    - GIVEN a place given to one ticket whose runner decides to start no step",
    "      WHEN that runner session ends",
    "      THEN the place goes to the next ticket by the same order",
    "- **Verification hint:** this is [#184](https://github.com/fvermaut/timone/issues/184). Today `PROJECT_FREE_EVENT` in `src/runner/driver.ts` is sent to every run that was refused, whenever the project is free, so two runs can be told and only one can start. \"Oldest\" is the ticket's creation time on the forge, unless the build has a reason to choose another; it says so in its departures.",
    "",
  ].join("\n");

  it("leaves PRD-07.R3 alone", () => {
    expect(registerFaults(PRD_07_R3)).toEqual([]);
  });

  it("does not read a note about an older build as an admission", () => {
    const faults = registerFaults(
      block({
        note:
          "This check went red on the build from just before phase 60, where that " +
          "ticket was never woken. All four clauses pass on this build.",
      }),
    );

    expect(faults).toEqual([]);
  });

  it("still flags an admission when the block has a Falsified-by line", () => {
    const faults = registerFaults(
      block({ note: "clause 3 was never seen to hold", falsifiedBy: "a test that goes red" }),
    );

    expect(faults).toHaveLength(1);
    expect(faults[0]?.kind).toBe("status-outruns-notes");
  });

  it("still flags an admission in the gate line", () => {
    const faults = registerFaults(
      block({ gate: "2026-09-07 PASS — clause 2 was never triggered" }),
    );

    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatchObject({ kind: "status-outruns-notes", quoted: "never triggered" });
  });

  // A `Falsified-by:` line answers a watched-only claim and nothing in an
  // admission, so advising one for an admission sends the reader the wrong way.
  it("advises the status or the note for an admission, not a Falsified-by line", () => {
    const [fault] = registerFaults(block({ note: "clause 3 was never seen to hold" }));

    expect(fault?.remedy).toContain("`draft`");
    expect(fault?.remedy).not.toContain("Falsified-by");
  });

  it("advises a Falsified-by line for a universal closed by watching", () => {
    const [fault] = registerFaults(
      block({ criteria: "THEN at no point is the human told to run a command" }),
    );

    expect(fault?.kind).toBe("watched-only");
    expect(fault?.remedy).toContain("Falsified-by");
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
