import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkoutVersion, uncommittedFiles } from "./git.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

/**
 * A real checkout — one commit, one remote, nothing outstanding.
 *
 * Real git rather than a fake, because "which commit is this?" and "is
 * anything uncommitted here?" are questions about git, and a fake would only
 * prove that the fake agrees with itself.
 *
 * **These tests live in their own file deliberately.** The first subprocess a
 * vitest worker spawns costs what that worker's heap costs, and a worker that
 * has loaded the Agent SDK pays about twenty-four seconds for it on this
 * machine — measured while writing this, and the same cost `vitest.config.ts`
 * records as a flake in `guardrails.test.ts`. This file imports nothing but
 * `git.ts`, so its git calls run in tens of milliseconds.
 */
function checkout(): { dir: string; commit: string; remote: string } {
  const dir = mkdtempSync(join(tmpdir(), "timone-git-"));
  tempDirs.push(dir);
  const remote = "https://github.com/fvermaut/timone.git";
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "t");
  git(dir, "remote", "add", "origin", remote);
  writeFileSync(join(dir, "process.md"), "the rules\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "first");
  return { dir, commit: git(dir, "rev-parse", "HEAD").trim(), remote };
}

describe("what version a checkout is", () => {
  it("reports the commit it stands on, and where it was cloned from", async () => {
    const { dir, commit, remote } = checkout();

    expect(await checkoutVersion(dir)).toEqual({ remote, commit });
  });

  it("reports the commit in full, never abbreviated", async () => {
    // A run is pinned to this value, and a short name is ambiguous by design.
    const { dir } = checkout();

    expect((await checkoutVersion(dir))?.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("answers nothing for a directory that is not a checkout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-git-"));
    tempDirs.push(dir);

    expect(await checkoutVersion(dir)).toBeUndefined();
  });
});

describe("what a checkout has not committed", () => {
  it("names an edited file and a file nobody added", async () => {
    const { dir } = checkout();
    writeFileSync(join(dir, "process.md"), "the rules, edited\n");
    writeFileSync(join(dir, "notes.md"), "a new file nobody added\n");

    expect((await uncommittedFiles(dir)).sort()).toEqual([
      "notes.md",
      "process.md",
    ]);
  });

  it("does not name a file git was told to ignore", async () => {
    // `node_modules/` and `dist/` are not work anybody has to commit, and a
    // daemon that refused to start over them would never start at all.
    const { dir } = checkout();
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "ignore the installed things");
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "left-pad.js"), "module.exports=1\n");

    expect(await uncommittedFiles(dir)).toEqual([]);
  });

  it("says nothing is outstanding in a checkout with nothing outstanding", async () => {
    const { dir } = checkout();

    expect(await uncommittedFiles(dir)).toEqual([]);
  });
});
