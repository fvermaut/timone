import { describe, expect, it } from "vitest";

import type { RunQuery } from "../session.js";
import { CASES, type ReplayCase } from "./cases.js";
import { judgeCase } from "./harness.js";
import { runTry, type Seen, type Try, type Verdict } from "./recording.js";

/**
 * The replay harness's own logic (PRD-05 R18), with no model: the tries are
 * written here as a runner's session would have left them.
 *
 * The cases in `cases.ts` are the specification of the runner, not of the
 * harness, so what they ask the runner to do is not tested here. What is
 * tested is how the harness judges a case from its tries, and what the
 * runner is shown at a case's moment.
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

/** The case of the replay whose "what had happened" is `happened`. */
function caseThat(happened: string): ReplayCase {
  const found = CASES.find((each) => each.happened === happened);
  if (found === undefined) throw new Error(`No case of the replay says: "${happened}"`);
  return found;
}

/**
 * The prompt the runner is given at `replayCase`'s moment, from one try with
 * a runner's session that keeps its prompt, calls no tool and no model, and
 * ends at once.
 */
async function promptOf(replayCase: ReplayCase): Promise<string> {
  const prompts: string[] = [];
  const keepsThePrompt: RunQuery = ({ prompt }) => {
    prompts.push(prompt);
    return (async function* () {
      yield { type: "result", subtype: "success", is_error: false, total_cost_usd: 0, num_turns: 1, result: "Done." };
    })();
  };
  await runTry(replayCase.moment, keepsThePrompt);
  const [prompt] = prompts;
  if (prompt === undefined) throw new Error("The runner was never given a prompt.");
  return prompt;
}

describe("what the runner is shown about the running step", () => {
  it("says no command is running when every call of the step has ended, and still lists the suite runs since the last check (#110)", async () => {
    const prompt = await promptOf(
      caseThat("At a 15-minute check, the build step has run the full browser suite six times."),
    );

    const suite = "Bash(npx playwright test)";
    const picker = "Edit(components/TagPicker.tsx)";
    expect(prompt).toContain(
      `Commands and tools it used since the last check: ${[suite, suite, picker, suite, suite, picker, suite, suite].join("; ")}\n`,
    );
    expect(prompt).toContain("No command is running now.");
    expect(prompt).not.toContain("Still running:");
  });

  it("names the one browser test command still running, and since when, inside a long check (#238)", async () => {
    const prompt = await promptOf(
      caseThat("At a 15-minute check, the checking step is inside one browser test command that started 35 minutes ago."),
    );

    expect(prompt).toContain(
      "Still running: Bash(npx playwright test e2e/positions-short-text.spec.ts), started at 2026-10-09T10:59:00.000Z, 35 minutes ago.\n",
    );
    expect(prompt.match(/^Still running: /gm)).toHaveLength(1);
  });

  it("shows a step inside a long command as printing its 30-second sign, not as silent (#238)", async () => {
    const replayCase = caseThat(
      "At a 15-minute check, the checking step is inside one browser test command that started 35 minutes ago.",
    );
    const prompt = await promptOf(replayCase);

    const printed = /^It last printed something at (\S+)\. /m.exec(prompt)?.[1];
    expect(printed).toBeDefined();
    const before = Date.parse(replayCase.moment.now) - Date.parse(printed ?? "");
    expect(before).toBeGreaterThanOrEqual(0);
    expect(before).toBeLessThanOrEqual(30_000);
    expect(prompt).not.toContain("It has been silent since");
  });
});

describe("the replay set", () => {
  it("holds both moments of #238 just after the #110 case: a long test command, and one that hangs", () => {
    const after110 = CASES.findIndex((each) => each.issues.includes("#110")) + 1;

    expect(
      CASES.slice(after110, after110 + 2).map((each) => ({ issues: each.issues, happened: each.happened })),
    ).toEqual([
      {
        issues: ["#238"],
        happened: "At a 15-minute check, the checking step is inside one browser test command that started 35 minutes ago.",
      },
      {
        issues: ["#238"],
        happened: "At a 15-minute check, one command of the checking step has run for almost four hours.",
      },
    ]);
  });
});
