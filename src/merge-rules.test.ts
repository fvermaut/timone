import { describe, expect, it } from "vitest";

import { mergeFile } from "./merge-rules.js";

/**
 * `mergeFile` is the seam: three texts in, one result out. Every expected
 * text below is written out by hand from the rule in the phase plan, never
 * computed the way the code computes it.
 */

/** The lines one text has that the base does not. */
function addedLines(base: string, side: string): string[] {
  const baseLines = new Set(base.split("\n"));
  return side.split("\n").filter((line) => line !== "" && !baseLines.has(line));
}

describe("mergeFile — when git merges cleanly", () => {
  it("returns git's result for a STATUS.md, clean, with no problems", async () => {
    const base = "# Status\n\n**Last updated:** 2026-10-01.\n\n**1. One.**\n\n**2. Two.**\n";
    const current = "# Status\n\n**Last updated:** 2026-10-01.\n\n**1. One, changed here.**\n\n**2. Two.**\n";
    const other = "# Status\n\n**Last updated:** 2026-10-01.\n\n**1. One.**\n\n**2. Two, changed there.**\n";

    const result = await mergeFile("status", { base, current, other });

    expect(result).toEqual({
      text: "# Status\n\n**Last updated:** 2026-10-01.\n\n**1. One, changed here.**\n\n**2. Two, changed there.**\n",
      clean: true,
      problems: [],
    });
  });

  it("returns git's result for a register, clean, with no problems", async () => {
    const base = "## R1 — First\n\n- **Status:** Draft\n\n## R2 — Second\n\n- **Status:** Draft\n";
    const current = "## R1 — First\n\n- **Status:** Approved\n\n## R2 — Second\n\n- **Status:** Draft\n";
    const other = "## R1 — First\n\n- **Status:** Draft\n\n## R2 — Second\n\n- **Status:** Verified\n";

    const result = await mergeFile("register", { base, current, other });

    expect(result).toEqual({
      text: "## R1 — First\n\n- **Status:** Approved\n\n## R2 — Second\n\n- **Status:** Verified\n",
      clean: true,
      problems: [],
    });
  });
});

const STATUS_HEAD = "# Status\n\n**Last updated:** 2026-10-01.\n\n";

/** Case 2: both sides add a different item after the same last item. */
const twoNewItems = {
  base: STATUS_HEAD + "**1. One.**\n\n**What I need from you:** nothing.\n",
  current:
    STATUS_HEAD +
    "**1. One.**\n\n**What I need from you:** nothing.\n\n" +
    "**2. Built here.**\n\n**What I need from you:** a review.\n",
  other:
    STATUS_HEAD +
    "**1. One.**\n\n**What I need from you:** nothing.\n\n" +
    "**2. Merged there.**\n\n**What I need from you:** nothing yet.\n",
};

/** Case 3: both sides change the Last updated line; the later date is the current side's. */
const laterDateOnCurrent = {
  base: "# Status\n\n**Last updated:** 2026-10-01.\n\n**1. One.**\n",
  current: "# Status\n\n**Last updated:** 2026-10-04.\n\n**1. One.**\n",
  other: "# Status\n\n**Last updated:** 2026-10-03.\n\n**1. One.**\n",
};

/** Case 3: both sides change the Last updated line; the later date is the other side's. */
const laterDateOnOther = {
  base: "# Status\n\n**Last updated:** 2026-10-01.\n\n**1. One.**\n",
  current: "# Status\n\n**Last updated:** 2026-10-02.\n\n**1. One.**\n",
  other: "# Status\n\n**Last updated:** 2026-10-05.\n\n**1. One.**\n",
};

/** Case 4: the current side changes a line; the other side adds a line right after it. */
const changedThenAdded = {
  base: STATUS_HEAD + "**1. One.**\n\n**What I need from you:** nothing.\n",
  current: STATUS_HEAD + "**1. One.**\n\n**What I need from you:** a review of the plan.\n",
  other:
    STATUS_HEAD +
    "**1. One.**\n\n**What I need from you:** nothing.\nThe plan is linked from the ticket.\n",
};

/** Case 5: both sides rewrite the same item differently. */
const oneItemRewrittenTwice = {
  base:
    STATUS_HEAD +
    "**1. One.**\n\n**What I need from you:** nothing.\n\n" +
    "**2. Two.**\n\n**What I need from you:** nothing.\n",
  current:
    STATUS_HEAD +
    "**1. One, rebuilt here.**\n\n**What I need from you:** a review.\n\n" +
    "**2. Two.**\n\n**What I need from you:** nothing.\n",
  other:
    STATUS_HEAD +
    "**1. One, rebuilt there.**\n\n**What I need from you:** a merge.\n\n" +
    "**2. Two.**\n\n**What I need from you:** nothing.\n",
};

describe("mergeFile — STATUS.md", () => {
  it("keeps both new items, the other side's first, one blank line apart", async () => {
    const result = await mergeFile("status", twoNewItems);

    expect(result).toEqual({
      text:
        STATUS_HEAD +
        "**1. One.**\n\n**What I need from you:** nothing.\n\n" +
        "**2. Merged there.**\n\n**What I need from you:** nothing yet.\n\n" +
        "**2. Built here.**\n\n**What I need from you:** a review.\n",
      clean: true,
      problems: [],
    });
  });

  it("keeps one Last updated line, the later date, when that date is on the current side", async () => {
    const result = await mergeFile("status", laterDateOnCurrent);

    expect(result).toEqual({
      text: "# Status\n\n**Last updated:** 2026-10-04.\n\n**1. One.**\n",
      clean: true,
      problems: [],
    });
  });

  it("keeps one Last updated line, the later date, when that date is on the other side", async () => {
    const result = await mergeFile("status", laterDateOnOther);

    expect(result).toEqual({
      text: "# Status\n\n**Last updated:** 2026-10-05.\n\n**1. One.**\n",
      clean: true,
      problems: [],
    });
  });

  it("keeps a changed line and a line added right after it, each once", async () => {
    const result = await mergeFile("status", changedThenAdded);

    expect(result).toEqual({
      text:
        STATUS_HEAD +
        "**1. One.**\n\n**What I need from you:** a review of the plan.\n" +
        "The plan is linked from the ticket.\n",
      clean: true,
      problems: [],
    });
  });

  it("keeps both versions of an item both sides rewrote, the other side's first", async () => {
    const result = await mergeFile("status", oneItemRewrittenTwice);

    expect(result).toEqual({
      text:
        STATUS_HEAD +
        "**1. One, rebuilt there.**\n\n**What I need from you:** a merge.\n\n" +
        "**1. One, rebuilt here.**\n\n**What I need from you:** a review.\n\n" +
        "**2. Two.**\n\n**What I need from you:** nothing.\n",
      clean: true,
      problems: [],
    });
  });
});

const R1_HEAD = "## R1 — First\n\n> ✏ 2026-09-01 — a note already there.\n\n";
const R1_TAIL =
  "- **Verify-via:** api\n" +
  "- **Criteria:**\n" +
  "    - GIVEN a ticket WHEN it runs THEN it ends\n" +
  "- **Verification hint:** run it.\n\n";
const R2_HEAD = "## R2 — Second\n\n- **Priority:** SHOULD\n- **Status:** draft\n";

/** Case 8: both sides change the same Status line to different values. */
const twoStatuses = {
  base: R1_HEAD + "- **Priority:** MUST\n- **Status:** draft\n" + R1_TAIL + R2_HEAD,
  current: R1_HEAD + "- **Priority:** MUST\n- **Status:** verified\n" + R1_TAIL + R2_HEAD,
  other: R1_HEAD + "- **Priority:** MUST\n- **Status:** blocked\n" + R1_TAIL + R2_HEAD,
};

/** Case 8, another field: both sides change the same Last live gate line. */
const twoLiveGates = {
  base: R2_HEAD + "- **Last live gate:** never\n",
  current: R2_HEAD + "- **Last live gate:** phase-48-live-gate.md — PASS\n",
  other: R2_HEAD + "- **Last live gate:** phase-47-live-gate.md — FAIL\n",
};

/** Case 6: both sides add a note under the same heading. */
const twoNewNotes = {
  base: R1_HEAD + "- **Priority:** MUST\n- **Status:** draft\n" + R1_TAIL + R2_HEAD,
  current:
    R1_HEAD +
    "> ✏ 2026-10-02 — a note added here.\n\n" +
    "- **Priority:** MUST\n- **Status:** draft\n" +
    R1_TAIL +
    R2_HEAD,
  other:
    R1_HEAD +
    "> ✏ 2026-10-03 — a note added there.\n\n" +
    "- **Priority:** MUST\n- **Status:** draft\n" +
    R1_TAIL +
    R2_HEAD,
};

/** Case 7: both sides add a clause at the end of the same Criteria list. */
const CRITERIA_START = R1_HEAD + "- **Priority:** MUST\n- **Status:** draft\n- **Verify-via:** api\n- **Criteria:**\n";
const CRITERIA_END = "- **Verification hint:** run it.\n";
const twoNewClauses = {
  base: CRITERIA_START + "    - GIVEN a ticket WHEN it runs THEN it ends\n" + CRITERIA_END,
  current:
    CRITERIA_START +
    "    - GIVEN a ticket WHEN it runs THEN it ends\n" +
    "    - GIVEN a second ticket WHEN it waits THEN it says why\n" +
    CRITERIA_END,
  other:
    CRITERIA_START +
    "    - GIVEN a ticket WHEN it runs THEN it ends\n" +
    "    - GIVEN a closed ticket WHEN it reopens THEN it runs again\n" +
    CRITERIA_END,
};

/** Case 9: the current side changes Status; the other side adds a note on the line before it. */
const noteBeforeChangedStatus = {
  base: "## R3 — Third\n\n- **Status:** draft\n- **Verify-via:** api\n",
  current: "## R3 — Third\n\n- **Status:** verified\n- **Verify-via:** api\n",
  other: "## R3 — Third\n\n> ✏ 2026-10-03 — checked again.\n\n- **Status:** draft\n- **Verify-via:** api\n",
};

/** Case 10: both sides add a requirement numbered R15. */
const twoR15s = {
  base: R2_HEAD,
  current: R2_HEAD + "\n## R15 — Built here\n\n- **Priority:** MUST\n- **Status:** draft\n",
  other: R2_HEAD + "\n## R15 — Merged there\n\n- **Priority:** SHOULD\n- **Status:** verified\n",
};

describe("mergeFile — a register", () => {
  it("keeps the other side's Status and records the current side's in a note below the notes", async () => {
    const result = await mergeFile("register", twoStatuses, { today: "2026-10-04" });

    expect(result).toEqual({
      text:
        "## R1 — First\n\n> ✏ 2026-09-01 — a note already there.\n\n" +
        "> ✏ 2026-10-04 — when this branch was brought level with the default branch, " +
        "it had `- **Status:** verified`. The default branch's `- **Status:** blocked` stands.\n\n" +
        "- **Priority:** MUST\n- **Status:** blocked\n" +
        R1_TAIL +
        R2_HEAD,
      clean: true,
      problems: [],
    });
  });

  it("applies the same rule to a Last live gate line, with the note right under the heading", async () => {
    const result = await mergeFile("register", twoLiveGates, { today: "2026-10-04" });

    expect(result).toEqual({
      text:
        "## R2 — Second\n\n" +
        "> ✏ 2026-10-04 — when this branch was brought level with the default branch, " +
        "it had `- **Last live gate:** phase-48-live-gate.md — PASS`. " +
        "The default branch's `- **Last live gate:** phase-47-live-gate.md — FAIL` stands.\n\n" +
        "- **Priority:** SHOULD\n- **Status:** draft\n" +
        "- **Last live gate:** phase-47-live-gate.md — FAIL\n",
      clean: true,
      problems: [],
    });
  });

  it("keeps both notes added under the same heading, and one Status line", async () => {
    const result = await mergeFile("register", twoNewNotes, { today: "2026-10-04" });

    expect(result).toEqual({
      text:
        R1_HEAD +
        "> ✏ 2026-10-03 — a note added there.\n\n" +
        "> ✏ 2026-10-02 — a note added here.\n\n" +
        "- **Priority:** MUST\n- **Status:** draft\n" +
        R1_TAIL +
        R2_HEAD,
      clean: true,
      problems: [],
    });
    const sectionR1 = result.text.split("## R2")[0]!;
    expect(sectionR1.split("\n").filter((line) => line.startsWith("- **Status:**"))).toEqual([
      "- **Status:** draft",
    ]);
  });

  it("keeps both clauses added at the end of the same Criteria list", async () => {
    const result = await mergeFile("register", twoNewClauses, { today: "2026-10-04" });

    expect(result).toEqual({
      text:
        CRITERIA_START +
        "    - GIVEN a ticket WHEN it runs THEN it ends\n" +
        "    - GIVEN a closed ticket WHEN it reopens THEN it runs again\n" +
        "    - GIVEN a second ticket WHEN it waits THEN it says why\n" +
        CRITERIA_END,
      clean: true,
      problems: [],
    });
  });

  it("keeps a changed Status line and a note added on the line before it, each once", async () => {
    const result = await mergeFile("register", noteBeforeChangedStatus, { today: "2026-10-04" });

    expect(result).toEqual({
      text: "## R3 — Third\n\n> ✏ 2026-10-03 — checked again.\n\n- **Status:** verified\n- **Verify-via:** api\n",
      clean: true,
      problems: [],
    });
  });

  it("leaves a number both sides took undecided, names it, and keeps both sections", async () => {
    const result = await mergeFile("register", twoR15s, { today: "2026-10-04" });

    expect(result).toEqual({
      text:
        R2_HEAD +
        "\n## R15 — Merged there\n\n- **Priority:** SHOULD\n- **Status:** verified\n" +
        "\n## R15 — Built here\n\n- **Priority:** MUST\n- **Status:** draft\n",
      clean: false,
      problems: [
        "R15 is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose.",
      ],
    });
  });
});

/**
 * Case 11: no line is lost. Each row names the lines that may be missing from
 * the text on purpose: in case 3 the older `**Last updated:**` line, which
 * case 3 itself removes; in case 8 the current side's field line, which counts
 * as kept when the note quotes it.
 */
describe("mergeFile — no line is lost", () => {
  it.each([
    { name: "case 2, two new items", kind: "status", sides: twoNewItems, dropped: [], quoted: [] },
    {
      name: "case 3, later date on the current side",
      kind: "status",
      sides: laterDateOnCurrent,
      dropped: ["**Last updated:** 2026-10-03."],
      quoted: [],
    },
    {
      name: "case 3, later date on the other side",
      kind: "status",
      sides: laterDateOnOther,
      dropped: ["**Last updated:** 2026-10-02."],
      quoted: [],
    },
    { name: "case 4, a changed line and a line added after it", kind: "status", sides: changedThenAdded, dropped: [], quoted: [] },
    { name: "case 5, one item rewritten on both sides", kind: "status", sides: oneItemRewrittenTwice, dropped: [], quoted: [] },
    { name: "case 6, two new notes", kind: "register", sides: twoNewNotes, dropped: [], quoted: [] },
    { name: "case 7, two new clauses", kind: "register", sides: twoNewClauses, dropped: [], quoted: [] },
    {
      name: "case 8, two Status values",
      kind: "register",
      sides: twoStatuses,
      dropped: [],
      quoted: ["- **Status:** verified"],
    },
    {
      name: "case 8, two Last live gate values",
      kind: "register",
      sides: twoLiveGates,
      dropped: [],
      quoted: ["- **Last live gate:** phase-48-live-gate.md — PASS"],
    },
    { name: "case 9, a note before a changed Status", kind: "register", sides: noteBeforeChangedStatus, dropped: [], quoted: [] },
  ] as const)("$name: every line either side added is in the text", async ({ kind, sides, dropped, quoted }) => {
    const result = await mergeFile(kind, sides, { today: "2026-10-04" });
    const textLines = result.text.split("\n");

    const added = [...addedLines(sides.base, sides.current), ...addedLines(sides.base, sides.other)];
    const missing = added.filter(
      (line) =>
        !textLines.includes(line) &&
        !(dropped as readonly string[]).includes(line) &&
        !((quoted as readonly string[]).includes(line) && result.text.includes(`\`${line}\``)),
    );

    expect(missing).toEqual([]);
  });
});
