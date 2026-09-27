import { describe, expect, it } from "vitest";

import { judgeCase } from "./harness.js";
import type { Seen, Try, Verdict } from "./recording.js";

/**
 * The replay harness's own logic (PRD-05 R18), with no model: the tries are
 * written here as a runner's session would have left them.
 *
 * The nineteen cases in `cases.ts` are the specification of the runner, not of
 * the harness, so they are not tested here. What is tested is how the harness
 * judges a case from its tries.
 */

/** What the stand-ins saw a try do, when all it did was start one step at `stage`. */
function startedOnly(stage: "planning" | "execution"): Seen {
  return {
    calls: [{ kind: "step-started", stage, instructions: "Build what the plan says." }],
    entries: [],
    status: "parked",
  };
}

/** A case that passes a try when the runner started the build, as #139 asks. */
const startTheBuild = {
  issues: ["#139"],
  mustDo: "Read planning as finished, and start the build.",
  judge: (seen: Seen): Verdict =>
    seen.calls.some((call) => call.kind === "step-started" && call.stage === "execution")
      ? { ok: true }
      : { ok: false, wanted: "the build started" },
};

describe("judging a case of the replay", () => {
  it("passes a case only when all three tries chose the expected action", () => {
    const chose: Try = { kind: "ran", seen: startedOnly("execution"), costUsd: 0.21 };
    const planningAgain: Try = { kind: "ran", seen: startedOnly("planning"), costUsd: 0.19 };

    expect(judgeCase(startTheBuild, [chose, chose, planningAgain]).passed).toBe(false);
    expect(judgeCase(startTheBuild, [chose, chose, chose]).passed).toBe(true);
  });

  it("counts a try that errored as a failed try", () => {
    const chose: Try = { kind: "ran", seen: startedOnly("execution"), costUsd: 0.21 };
    const errored: Try = {
      kind: "errored",
      error: "the runner's session failed: error_max_turns",
      costUsd: 1.4,
    };

    expect(judgeCase(startTheBuild, [chose, chose, errored]).passed).toBe(false);
  });

  it("names the case's issue number in the line it prints", () => {
    const chose: Try = { kind: "ran", seen: startedOnly("execution"), costUsd: 0.21 };
    const planningAgain: Try = { kind: "ran", seen: startedOnly("planning"), costUsd: 0.19 };

    const { line } = judgeCase(startTheBuild, [chose, planningAgain, chose]);

    expect(line).toContain("#139");
  });
});
