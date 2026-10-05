import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PROBE_DIRECTORIES,
  mentionsProbeDirectory,
  probeGuardDecision,
} from "./probeGuard.js";

describe("mentionsProbeDirectory", () => {
  it("finds the project's probe directory in a file path", () => {
    expect(
      mentionsProbeDirectory({
        file_path: "/w/timone/projects/ivtrends/doc/plans/phases/probes/PRD-01.R3.mjs",
      }),
    ).toBe(true);
  });

  it("finds Timone's shared baseline probes", () => {
    expect(
      mentionsProbeDirectory({ file_path: "standards/baseline/probes/axe.mjs" }),
    ).toBe(true);
  });

  it("finds it inside a shell command", () => {
    expect(
      mentionsProbeDirectory({
        command: "cat projects/ivtrends/doc/plans/phases/probes/PRD-01.R1.mjs | head",
      }),
    ).toBe(true);
  });

  it("finds it nested in a structured input", () => {
    expect(
      mentionsProbeDirectory({
        edits: [{ path: "doc/plans/phases/probes/x.mjs", old: "a", new: "b" }],
      }),
    ).toBe(true);
  });

  it("leaves the reports directory alone", () => {
    expect(
      mentionsProbeDirectory({
        file_path: "doc/plans/phases/reports/phase-16-verification.md",
      }),
    ).toBe(false);
  });

  it("leaves a source file whose name merely contains 'probe' alone", () => {
    expect(mentionsProbeDirectory({ file_path: "src/lib/probe-helper.ts" })).toBe(
      false,
    );
  });

  it("says no when the input carries no strings at all", () => {
    expect(mentionsProbeDirectory({ limit: 20, force: true })).toBe(false);
    expect(mentionsProbeDirectory(undefined)).toBe(false);
  });

  it("names both directories it guards", () => {
    expect(PROBE_DIRECTORIES).toEqual([
      "doc/plans/phases/probes",
      "standards/baseline/probes",
    ]);
  });
});

describe("probeGuardDecision", () => {
  it("stays silent when the call has nothing to do with a probe", () => {
    expect(
      probeGuardDecision({ toolInput: { file_path: "src/index.ts" }, stage: "execution" }),
    ).toBeUndefined();
  });

  it("denies a build run — this is the fault the guard exists for", () => {
    const decision = probeGuardDecision({
      toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
      stage: "execution",
    });
    expect(decision?.permissionDecision).toBe("deny");
    expect(decision?.permissionDecisionReason).toContain("doc/plans/phases/probes");
  });

  it("denies a remediation run too — it writes code like execution does", () => {
    expect(
      probeGuardDecision({
        toolInput: { command: "grep -r x standards/baseline/probes/" },
        stage: "remediation",
      })?.permissionDecision,
    ).toBe("deny");
  });

  it("allows verification, which owns the directory", () => {
    expect(
      probeGuardDecision({
        toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
        stage: "verification",
      })?.permissionDecision,
    ).toBe("allow");
  });

  it("asks when a human is driving, rather than refusing them their own files", () => {
    const decision = probeGuardDecision({
      toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
      stage: undefined,
    });
    expect(decision?.permissionDecision).toBe("ask");
  });

  it("asks for a stage that neither builds nor verifies", () => {
    expect(
      probeGuardDecision({
        toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
        stage: "delivery",
      })?.permissionDecision,
    ).toBe("ask");
  });
});

describe("the probe guard and the update (ADR-0066 D4)", () => {
  // Built from the constant, so no fixture here spells the folder out.
  const probe = { file_path: join(PROBE_DIRECTORIES[0], "PRD-07.R7.mjs") };

  it("allows the update, which runs the check scripts as the check does, and says so by name", () => {
    const decision = probeGuardDecision({ toolInput: probe, stage: "update" });

    expect(decision?.permissionDecision).toBe("allow");
    expect(decision?.permissionDecisionReason).toMatch(/^Update /);
  });

  it("still allows verification, and names it", () => {
    const decision = probeGuardDecision({ toolInput: probe, stage: "verification" });

    expect(decision?.permissionDecision).toBe("allow");
    expect(decision?.permissionDecisionReason).toMatch(/^Verification /);
  });

  it.each(["execution", "remediation"] as const)("still denies %s", (stage) => {
    expect(probeGuardDecision({ toolInput: probe, stage })?.permissionDecision).toBe("deny");
  });

  it("still asks when no stage is running", () => {
    expect(probeGuardDecision({ toolInput: probe, stage: undefined })?.permissionDecision).toBe("ask");
  });
});
