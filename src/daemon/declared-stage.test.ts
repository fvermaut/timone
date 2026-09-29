import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearStage,
  declareStage,
  declaredStage,
  declaredStagesPath,
} from "./declared-stage.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A Timone root with nothing in it: no `.timone/`, no declarations. */
function emptyRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-declared-"));
  tempDirs.push(dir);
  return dir;
}

/** Put `content` where the declarations live, as some other writer might. */
function plant(root: string, content: string): void {
  const path = declaredStagesPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

describe("the step a session run by hand declares", () => {
  it("reads back the step a session declared", () => {
    const root = emptyRoot();

    declareStage(root, "session-abc", "verification");

    expect(declaredStage(root, "session-abc")).toBe("verification");
  });

  it("reads a cleared declaration as no step at all", () => {
    const root = emptyRoot();
    declareStage(root, "session-abc", "verification");

    clearStage(root, "session-abc");

    expect(declaredStage(root, "session-abc")).toBeUndefined();
  });

  it("reads a file that fails the schema as no step, without throwing", () => {
    // The guard reads this on every tool call that names a probe. A step
    // nobody can name must fall back to asking, never to letting through.
    const root = emptyRoot();
    plant(
      root,
      JSON.stringify({
        "session-abc": { stage: "building", at: "2026-09-28T10:00:00Z" },
      }),
    );

    expect(declaredStage(root, "session-abc")).toBeUndefined();
  });

  it("reads a file that is not JSON at all as no step, without throwing", () => {
    // A write cut off halfway, or a hand edit gone wrong. Same answer: ask.
    const root = emptyRoot();
    plant(root, '{ "session-abc": { "stage": "verifi');

    expect(declaredStage(root, "session-abc")).toBeUndefined();
  });

  it("keeps two sessions' declarations apart", () => {
    // Two sessions run by hand at once, one checking and one building, is
    // the case the guard most needs to tell apart.
    const root = emptyRoot();

    declareStage(root, "session-checker", "verification");
    declareStage(root, "session-builder", "execution");

    expect(declaredStage(root, "session-checker")).toBe("verification");
    expect(declaredStage(root, "session-builder")).toBe("execution");
  });
});
