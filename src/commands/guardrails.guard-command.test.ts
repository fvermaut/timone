import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { PROBE_DIRECTORIES } from "../daemon/probeGuard.js";

/**
 * The guard command itself, as the hook runs it in a container (PRD-10 R6).
 * #87 asked for it: "Whatever the fix, it needs a test that runs the guard
 * with no ledger entry, because that is the state every boxed session is in
 * and no current test covers it."
 *
 * The command runs as its own process, so this is the only test that shows
 * the step is read from the command's own environment, not handed in.
 * `npm run build` comes before these tests, as for `src/cli.test.ts`.
 */
const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * This process's environment without the names a container sets, then a
 * container's at `step`. The session running these tests may itself be in a
 * container, so the names it carries are taken out first.
 */
function containerEnv(step: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.TIMONE_RUN_PROJECT;
  delete env.TIMONE_RUN_BRANCH;
  delete env.TIMONE_RUN_STAGE;
  return { ...env, TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: step };
}

/**
 * Run `timone guardrails guard` on one tool call, in an empty root with an
 * empty ledger, and give back the decision it printed.
 */
function guard(step: string, toolName: string, toolInput: unknown): unknown {
  const root = mkdtempSync(join(tmpdir(), "timone-guard-command-"));
  tempDirs.push(root);
  const ran = spawnSync(
    process.execPath,
    [CLI, "guardrails", "guard", "--root", root, "--state", join(root, "state.json")],
    {
      cwd: root,
      env: containerEnv(step),
      input: JSON.stringify({ session_id: "session-87", tool_name: toolName, tool_input: toolInput }),
      encoding: "utf8",
    },
  );
  expect(ran.status).toBe(0);
  expect(ran.stderr).toBe("");
  return JSON.parse(ran.stdout).hookSpecificOutput.permissionDecision;
}

describe("the guard command in a container, with an empty ledger (PRD-10 R6)", () => {
  const probe = `${PROBE_DIRECTORIES[0]}/prd-10.r1.mjs`;

  it("lets the checking step write a check script", () => {
    expect(guard("verification", "Write", { file_path: probe, content: "x" })).toBe("allow");
  });

  it("refuses a check script to the building step", () => {
    expect(guard("execution", "Read", { file_path: probe })).toBe("deny");
  });
});
