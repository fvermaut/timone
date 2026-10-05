import { posix } from "node:path";
import { describe, expect, it } from "vitest";

import { PROBE_DIRECTORIES } from "./daemon/probeGuard.js";
import { checkScriptOf, claimedRequirements } from "./update-checks.js";

/**
 * The two pure parts of `update-checks`: which requirements a plan claims,
 * and which check script belongs to one of them. The probe folder's path is
 * never written here; it comes from `PROBE_DIRECTORIES`.
 */

/** A phase file whose *Requirements* table claims R7 and R14, and whose prose names PRD-01.R4. */
const PLAN = `# Phase 50: The update after a merge

> **Companion phases:** this phase builds on PRD-01.R4, which is merged.

## Requirements

> **PRD:** [prd-07.md](../../specs/prd/prd-07.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R7 | MUST | An open pull request is brought level; PRD-01.R4 still holds |
| PRD-07.R14 | SHOULD | The update is told once for each head |

## Sub-phases

The work keeps PRD-01.R4 as it is.
`;

describe("claimedRequirements", () => {
  it("returns the IDs in the first column of the Requirements table, and none named only in prose", () => {
    expect(claimedRequirements(PLAN)).toEqual(["PRD-07.R7", "PRD-07.R14"]);
  });
});

describe("checkScriptOf", () => {
  const probes = PROBE_DIRECTORIES[0];

  it("returns the file directly in the probe folder named by the lowercased ID, and no file whose name only starts with it", () => {
    const files = [
      posix.join(probes, "prd-07.r7.mjs"),
      posix.join(probes, "prd-07.r70.mjs"),
      "other/prd-07.r7.mjs",
    ];

    expect(checkScriptOf("PRD-07.R7", files)).toBe(posix.join(probes, "prd-07.r7.mjs"));
  });
});
