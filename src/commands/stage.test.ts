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
      env: {},
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
      env: {},
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
      env: {},
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

// #87: in a container the step the box names decides what the guard does,
// and the declaration is never read. The command must say that, not the
// host sentences. Each test hands `runStage` the container's names itself:
// this file may run in a container, and `process.env` must not leak in.
describe("timone stage in a container (#87)", () => {
  it("names the container's step, not the declared one, and says the guard refuses a builder", () => {
    const root = emptyRoot();
    const said: string[] = [];

    const code = runStage("verification", {
      root,
      sessionId: "session-box",
      env: { TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: "execution" },
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(declaredStage(root, "session-box")).toBe("verification");
    const sentence = said.join("\n");
    expect(sentence).not.toContain("is now");
    expect(sentence).not.toContain("checking step");
    expect(said).toEqual([
      "Session session-box runs in a container whose step is execution. " +
        "In a container the step decides what the guard does, and this " +
        "declaration changes nothing: the guard refuses it the probes.",
    ]);
  });

  it("names the checking step when the container names it, and says the guard lets it through", () => {
    const root = emptyRoot();
    const said: string[] = [];

    const code = runStage("verification", {
      root,
      sessionId: "session-box",
      env: { TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: "verification" },
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(said).toEqual([
      "Session session-box runs in a container whose step is verification. " +
        "In a container the step decides what the guard does, and this " +
        "declaration changes nothing: the guard lets it read and write the " +
        "probes without asking.",
    ]);
  });

  it("says a container that names no step is refused the probes", () => {
    const root = emptyRoot();
    const said: string[] = [];

    const code = runStage("verification", {
      root,
      sessionId: "session-box",
      env: { TIMONE_RUN_PROJECT: "timone" },
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(said).toEqual([
      "Session session-box runs in a container that names no step Timone " +
        "knows. In a container the step decides what the guard does, and " +
        "this declaration changes nothing: the guard refuses it the probes.",
    ]);
  });

  it.each([
    {
      label: "whose step is execution",
      env: { TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: "execution" },
      expected:
        "Session session-box runs in a container whose step is execution. " +
        "In a container the step decides what the guard does, and taking a " +
        "declaration back changes nothing.",
    },
    {
      label: "that names no step",
      env: { TIMONE_RUN_PROJECT: "timone" },
      expected:
        "Session session-box runs in a container that names no step Timone " +
        "knows. In a container the step decides what the guard does, and " +
        "taking a declaration back changes nothing.",
    },
  ])("says taking a declaration back changes nothing, in a container $label", ({ env, expected }) => {
    const root = emptyRoot();
    declareStage(root, "session-box", "verification");
    const said: string[] = [];

    const code = runStage("none", {
      root,
      sessionId: "session-box",
      env,
      log: (message) => said.push(message),
    });

    expect(code).toBe(0);
    expect(declaredStage(root, "session-box")).toBeUndefined();
    expect(said).toEqual([expected]);
  });
});
