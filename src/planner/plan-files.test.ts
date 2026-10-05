import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { planFiles } from "./plan-files.js";

/** Phase 47's own text, as it was merged. */
const PHASE_47 = readFileSync(
  join(import.meta.dirname, "../../doc/plans/phases/phase-47.md"),
  "utf8",
);

describe("planFiles: the files a plan names in its file markers (ADR-0065 D3)", () => {
  it("finds every file phase 47 marks, once each, in the order the plan names them", () => {
    // Read off phase 47 by hand, marker line by marker line. A file named a
    // second time is not listed again.
    expect(planFiles(PHASE_47)).toEqual([
      "src/daemon/runs.ts",
      "src/daemon/runs.test.ts",
      "src/daemon/poll.ts",
      "src/daemon/poll.test.ts",
      "src/commands/takeover.ts",
      "src/commands/cancel.ts",
      "src/commands/status.ts",
      "src/runner/driver.ts",
      "src/runner/session.ts",
      "src/runner/actions.ts",
      "src/daemon/step-session.ts",
      "src/runner/actions.test.ts",
      "src/runner/brief.ts",
      "src/commands/daemon.ts",
      "src/runner/driver.test.ts",
      "src/runner/session.test.ts",
      "src/runner/brief.test.ts",
      "src/adapters/ticketing.ts",
      "src/adapters/github-tickets.ts",
      "src/runner/replay/recording.ts",
      "src/adapters/github-tickets.test.ts",
      "github-pulls.test.ts",
      "src/commands/takeover.test.ts",
      "src/commands/status.test.ts",
      "doc/specs/prd/prd-02-inversion-of-control.criteria.md",
      "doc/specs/prd/prd-02-inversion-of-control.md",
      "doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md",
      "doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md",
      "doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md",
      "process.md",
      ".claude/skills/timone-wayfind/SKILL.md",
      "CONTEXT.md",
    ]);
  });

  it("does not take a path named in prose, on a line with no marker", () => {
    const plan = [
      "The ledger in `src/daemon/runs.ts` keeps the places.",
      "",
      "**[MODIFY]** `src/runner/actions.ts` — the refusal.",
    ].join("\n");

    expect(planFiles(plan)).toEqual(["src/runner/actions.ts"]);
  });

  it("takes the files a [DELETE] marker names", () => {
    const plan = "**[DELETE]** `src/commands/retry.ts`, `src/commands/retry.test.ts`";

    expect(planFiles(plan)).toEqual(["src/commands/retry.ts", "src/commands/retry.test.ts"]);
  });

  it("does not read a marker quoted in code as a marker", () => {
    const plan =
      "Every path following `**[NEW FILE]**` on a line counts, as in `src/planner/plan-files.ts`.";

    expect(planFiles(plan)).toEqual([]);
  });
});
