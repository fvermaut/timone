import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { reserveNumber } from "./numbers.js";
import { withoutRunGitSettings } from "./test-support/run-git-settings.js";

/**
 * `reserveNumber` against real git: a bare repository stands for the forge,
 * and clones of it stand for the checkouts sessions work in. What a test
 * looks at is the answer and what the bare repository holds afterwards —
 * never how the function read its way there.
 *
 * No test here ever touches a real remote: a reservation there is permanent.
 */

const tempDirs: string[] = [];

/** Puts back the run's git settings this file's tests ran without (PRD-11). */
let restoreRunGitSettings: () => void = () => {};

// The tests here push to their throwaway bare repositories. In a run's
// container the run's push guard would refuse those pushes, so each test runs
// without the run's git settings.
beforeEach(() => {
  restoreRunGitSettings = withoutRunGitSettings();
});

afterEach(() => {
  restoreRunGitSettings();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Run git in `cwd` and return its stdout. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** A fresh temporary directory, removed after the test. */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-numbers-"));
  tempDirs.push(dir);
  return dir;
}

/**
 * A clone of `remote` with a commit identity of its own, as a session's
 * checkout has one. Every clone gets the same identity on purpose: the
 * sessions of one machine all commit as the same bot.
 */
function cloneOf(remote: string): string {
  const dir = join(tempDir(), "checkout");
  execFileSync("git", ["clone", "--quiet", remote, dir], { stdio: "ignore" });
  git(dir, "config", "user.name", "Timone Test");
  git(dir, "config", "user.email", "test@timone.invalid");
  return dir;
}

/** Write `files` (path → content) into `dir`, creating folders as needed. */
function writeFiles(dir: string, files: string[]): void {
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `# ${file}\n`, "utf8");
  }
}

/**
 * A bare repository whose `main` holds `files` (an empty `README.md` when
 * none are given, so the branch exists).
 */
function remoteWith(files: string[] = []): string {
  const remote = join(tempDir(), "remote.git");
  git(tempDir(), "init", "--quiet", "--bare", "--initial-branch=main", remote);
  const seed = join(tempDir(), "seed");
  git(tempDir(), "init", "--quiet", "--initial-branch=main", seed);
  git(seed, "config", "user.name", "Timone Test");
  git(seed, "config", "user.email", "test@timone.invalid");
  writeFiles(seed, ["README.md", ...files]);
  git(seed, "add", "--all");
  git(seed, "commit", "--quiet", "-m", "seed");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "--quiet", "origin", "main");
  return remote;
}

/** The reservation refs of `kind` the bare repository holds, sorted. */
function reservations(remote: string, kind: string): string[] {
  return git(remote, "for-each-ref", "--format=%(refname)", `refs/timone/numbers/${kind}/`)
    .split("\n")
    .filter((line) => line !== "")
    .sort();
}

describe("reserveNumber", () => {
  it.each([
    ["phase", "01"],
    ["adr", "0001"],
    ["triage", "001"],
    ["prd", "01"],
  ] as const)(
    "gives the first %s number, padded, to a project with none",
    async (kind, expected) => {
      const remote = remoteWith();
      const clone = cloneOf(remote);

      expect(await reserveNumber(clone, kind)).toBe(expected);
    },
  );

  it("gives the phase after the highest on the default branch, not counting the reports folder", async () => {
    const remote = remoteWith([
      "doc/plans/phases/phase-43.md",
      "doc/plans/phases/reports/phase-43-complete.md",
      "doc/plans/phases/reports/phase-50-delivery.md",
    ]);
    const clone = cloneOf(remote);

    expect(await reserveNumber(clone, "phase")).toBe("44");
  });

  it("counts a PRD and its criteria register as one number", async () => {
    const remote = remoteWith([
      "doc/specs/prd/prd-07-x.md",
      "doc/specs/prd/prd-07-x.criteria.md",
    ]);
    const clone = cloneOf(remote);

    expect(await reserveNumber(clone, "prd")).toBe("08");
  });

  it("counts a phase that exists only on another branch, pushed after the checkout was cloned", async () => {
    const remote = remoteWith(["doc/plans/phases/phase-43.md"]);
    const clone = cloneOf(remote);
    const other = cloneOf(remote);
    git(other, "switch", "--quiet", "-c", "timone/9-x");
    writeFiles(other, ["doc/plans/phases/phase-45.md"]);
    git(other, "add", "--all");
    git(other, "commit", "--quiet", "-m", "phase 45");
    git(other, "push", "--quiet", "origin", "timone/9-x");

    expect(await reserveNumber(clone, "phase")).toBe("46");
  });

  it("counts a phase that exists only in the checkout's folder, not committed", async () => {
    const remote = remoteWith(["doc/plans/phases/phase-43.md"]);
    const clone = cloneOf(remote);
    writeFiles(clone, ["doc/plans/phases/phase-61.md"]);

    expect(await reserveNumber(clone, "phase")).toBe("62");
  });

  it("counts a number another session reserved, and only reservations of the same kind", async () => {
    const remote = remoteWith(["doc/plans/phases/phase-43.md"]);
    const main = git(remote, "rev-parse", "main").trim();
    git(remote, "update-ref", "refs/timone/numbers/phase/47", main);
    git(remote, "update-ref", "refs/timone/numbers/adr/0090", main);
    const clone = cloneOf(remote);

    expect(await reserveNumber(clone, "phase")).toBe("48");
  });

  // Falsifies R8's own clause: "two sessions that start a numbered file at
  // the same time never take the same number". Five sessions ask at once,
  // each from its own checkout of the same remote, as five runs would.
  it.each(["phase", "adr", "triage"] as const)(
    "gives five sessions asking for a %s number at once five different numbers, each reserved on the remote",
    async (kind) => {
      const remote = remoteWith();
      const clones = [1, 2, 3, 4, 5].map(() => cloneOf(remote));

      const answers = await Promise.all(
        clones.map((clone) => reserveNumber(clone, kind)),
      );

      expect(new Set(answers).size).toBe(5);
      expect(reservations(remote, kind)).toEqual(
        answers.map((answer) => `refs/timone/numbers/${kind}/${answer}`).sort(),
      );
    },
  );

  // Two reservation commits with the same message, made by the same identity
  // in the same second, are the same commit; a push of the second to a ref
  // that already holds it "succeeds" while reserving nothing. Both calls here
  // read the remote before either has pushed, so both try the same number
  // with the same note, and the remote is made to take the first push before
  // it answers the second, which is exactly when that happens.
  it("gives two reservations from one checkout, in the same second and with the same note, two different numbers", async () => {
    const remote = remoteWith();
    const clone = cloneOf(remote);
    const first = join(tempDir(), "first-push");
    const receivePack = join(tempDir(), "receive-pack.sh");
    writeFileSync(
      receivePack,
      [
        "#!/bin/sh",
        "# The first push goes straight through. A later one waits until a",
        "# reservation has landed on the remote, for at most five seconds.",
        `if mkdir '${first}' 2>/dev/null; then exec git-receive-pack "$@"; fi`,
        "tries=0",
        `while [ -z "$(git --git-dir='${remote}' for-each-ref refs/timone/numbers/phase/)" ] && [ $tries -lt 100 ]; do`,
        "  sleep 0.05; tries=$((tries + 1))",
        "done",
        'exec git-receive-pack "$@"',
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    git(clone, "config", "remote.origin.receivepack", receivePack);

    const answers = await Promise.all([
      reserveNumber(clone, "phase", { note: "for timone/1-x" }),
      reserveNumber(clone, "phase", { note: "for timone/1-x" }),
    ]);

    expect(new Set(answers).size).toBe(2);
    expect(reservations(remote, "phase")).toEqual(
      answers.map((answer) => `refs/timone/numbers/phase/${answer}`).sort(),
    );
  });

  it("leaves the checkout as it was: same branch, same status, and no local ref to the reservation", async () => {
    const remote = remoteWith(["notes.md"]);
    const clone = cloneOf(remote);
    git(clone, "switch", "--quiet", "-c", "timone/2-y");
    writeFileSync(join(clone, "notes.md"), "changed, not committed\n", "utf8");
    writeFiles(clone, ["scratch.txt"]);
    const statusBefore = git(clone, "status", "--porcelain");

    const answer = await reserveNumber(clone, "phase");

    const reservation = git(remote, "rev-parse", `refs/timone/numbers/phase/${answer}`).trim();
    expect(git(clone, "branch", "--show-current")).toBe("timone/2-y\n");
    expect(git(clone, "status", "--porcelain")).toBe(statusBefore);
    expect(git(clone, "for-each-ref", "--points-at", reservation)).toBe("");
  });

  it("throws with git's words, and reserves nothing, when the remote does not exist", async () => {
    const remote = remoteWith();
    const clone = cloneOf(remote);
    git(clone, "remote", "set-url", "origin", join(tempDir(), "gone.git"));

    await expect(reserveNumber(clone, "phase")).rejects.toThrow(
      "does not appear to be a git repository",
    );
    expect(reservations(remote, "phase")).toEqual([]);
  });

  it("throws with git's words, and reserves nothing, when a pre-push hook refuses", async () => {
    const remote = remoteWith();
    const clone = cloneOf(remote);
    writeFileSync(
      join(clone, ".git", "hooks", "pre-push"),
      "#!/bin/sh\necho 'pushes are refused here' >&2\nexit 1\n",
      { mode: 0o755 },
    );

    await expect(reserveNumber(clone, "phase")).rejects.toThrow(
      "pushes are refused here",
    );
    expect(reservations(remote, "phase")).toEqual([]);
  });
});
