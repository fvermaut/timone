import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { installPushGuard } from "./push-guard.js";

/**
 * The guard as a box uses it: `git push` in a clone whose environment is what
 * `installPushGuard` returns, with the built command line as the hook. So
 * `npm run build` comes before these tests, as for `push-guard.test.ts`.
 */
const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A bare repository standing for the forge, with `main` on it, and `clone`
 * made from it with `git clone`, as a box makes its checkout. `git clone`
 * is what sets `origin/HEAD`, which the guard reads for the default branch.
 *
 * Every git here runs with `HOME` in the temp directory, no system config,
 * and none of this process's `GIT_*` variables, so neither the machine's git
 * settings nor a `GIT_CONFIG_COUNT` already set can make a case pass or fail.
 */
function forge() {
  const root = mkdtempSync(join(tmpdir(), "timone-push-guard-git-"));
  tempDirs.push(root);
  const home = join(root, "home");
  mkdirSync(home);
  const baseEnv: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined && !entry[0].startsWith("GIT_"),
      ),
    ),
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");

  const git = (cwd: string, args: string[], extra: Record<string, string> = {}) => {
    const ran = spawnSync("git", args, { cwd, env: { ...baseEnv, ...extra }, encoding: "utf8" });
    return { status: ran.status, stderr: ran.stderr, stdout: ran.stdout.trim() };
  };
  const mustGit = (cwd: string, args: string[]): string => {
    const ran = git(cwd, args);
    if (ran.status !== 0) throw new Error(`git ${args.join(" ")}: ${ran.stderr}`);
    return ran.stdout;
  };
  const setUser = (dir: string) => {
    mustGit(dir, ["config", "user.name", "A Test"]);
    mustGit(dir, ["config", "user.email", "test@example.invalid"]);
  };
  const remoteHas = (ref: string): string | undefined => {
    const ran = git(root, ["--git-dir", remote, "rev-parse", "--verify", "--quiet", ref]);
    return ran.status === 0 ? ran.stdout : undefined;
  };

  mustGit(root, ["init", "--quiet", "--bare", "--initial-branch=main", remote]);
  mustGit(root, ["init", "--quiet", "--initial-branch=main", seed]);
  setUser(seed);
  mustGit(seed, ["remote", "add", "origin", remote]);
  mustGit(seed, ["commit", "--quiet", "--allow-empty", "-m", "first"]);
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  mustGit(root, ["clone", "--quiet", remote, clone]);
  setUser(clone);

  /** Cut `branch` from `from` in the clone, and commit one piece of work on it. */
  const cut = (branch: string, from: string) => {
    mustGit(clone, ["checkout", "--quiet", "-b", branch, from]);
    mustGit(clone, ["commit", "--quiet", "--allow-empty", "-m", `work on ${branch}`]);
  };
  /** Push `branch` from the clone with no guard: another run, or a person, pushed it. */
  const pushUnguarded = (branch: string) => {
    mustGit(clone, ["push", "--quiet", "origin", branch]);
  };
  /** Push `branch` from the clone with the guard of a run that works `branch`. */
  const pushGuarded = (branch: string) =>
    git(
      clone,
      ["push", "origin", branch],
      installPushGuard(join(root, "guard"), { workBranch: branch, cli: CLI }),
    );

  return { clone, cut, pushUnguarded, pushGuarded, remoteHas, mustGit };
}

describe("a run's first push of its work branch, against real git (PRD-07.R4)", () => {
  it("pushes a branch cut from origin/main", () => {
    const { clone, cut, pushGuarded, remoteHas, mustGit } = forge();
    cut("timone/7-x", "origin/main");

    const pushed = pushGuarded("timone/7-x");

    expect({ status: pushed.status, stderr: pushed.stderr }).toMatchObject({ status: 0 });
    expect(remoteHas("refs/heads/timone/7-x")).toBe(mustGit(clone, ["rev-parse", "HEAD"]));
  });

  it("refuses a branch cut from another pushed timone/ branch, and names that branch", () => {
    const { cut, pushUnguarded, pushGuarded, remoteHas } = forge();
    cut("timone/12-other", "origin/main");
    pushUnguarded("timone/12-other");
    cut("timone/7-x", "timone/12-other");

    const pushed = pushGuarded("timone/7-x");

    expect(pushed.status).not.toBe(0);
    expect(pushed.stderr).toContain(
      "Refused: this branch carries work of timone/12-other that is not on the default branch yet. " +
        "Cut the work branch from the default branch, and keep only this ticket's commits on it.",
    );
    expect(remoteHas("refs/heads/timone/7-x")).toBeUndefined();
  });

  it("does not check again a branch the remote already has", () => {
    const { clone, cut, pushUnguarded, pushGuarded, remoteHas, mustGit } = forge();
    cut("timone/12-other", "origin/main");
    pushUnguarded("timone/12-other");
    cut("timone/7-x", "timone/12-other");
    pushUnguarded("timone/7-x");
    mustGit(clone, ["commit", "--quiet", "--allow-empty", "-m", "more work on timone/7-x"]);

    const pushed = pushGuarded("timone/7-x");

    expect({ status: pushed.status, stderr: pushed.stderr }).toMatchObject({ status: 0 });
    expect(remoteHas("refs/heads/timone/7-x")).toBe(mustGit(clone, ["rev-parse", "HEAD"]));
  });
});
