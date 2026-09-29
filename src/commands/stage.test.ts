import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { declareStage, declaredStage } from "../daemon/declared-stage.js";
import { runStage } from "./stage.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A Timone root with nothing in it: no `.timone/`, no declarations. */
function emptyRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-stage-"));
  tempDirs.push(dir);
  return dir;
}

describe("timone stage", () => {
  it("refuses a step it does not know, and lists the ones it does", () => {
    const root = emptyRoot();
    const said: string[] = [];

    const code = runStage("verify", {
      root,
      sessionId: "session-hand",
      log: (message) => said.push(message),
    });

    expect(code).toBe(1);
    expect(declaredStage(root, "session-hand")).toBeUndefined();
    // Every name, written out by hand from the pipeline, so a missing one shows.
    const sentence = said.join("\n");
    for (const name of [
      "triage",
      "clarification",
      "wayfinding",
      "charting",
      "research",
      "requirements",
      "breakdown",
      "planning",
      "execution",
      "verification",
      "delivery",
      "remediation",
      "none",
    ]) {
      expect(sentence).toContain(name);
    }
  });

  it("declares the checking step and says the guard will stop asking", () => {
    const root = emptyRoot();
    const said: string[] = [];

    const code = runStage("verification", {
      root,
      sessionId: "session-hand",
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(declaredStage(root, "session-hand")).toBe("verification");
    expect(said).toEqual([
      "Session session-hand is now the checking step: the guard lets it read " +
        "and write the probes without asking.",
    ]);
  });

  it("takes a declaration back with none", () => {
    const root = emptyRoot();
    declareStage(root, "session-hand", "verification");
    const said: string[] = [];

    const code = runStage("none", {
      root,
      sessionId: "session-hand",
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(declaredStage(root, "session-hand")).toBeUndefined();
    expect(said).toEqual([
      "Session session-hand no longer declares a step: the guard asks you " +
        "before it touches the probes.",
    ]);
  });
});
