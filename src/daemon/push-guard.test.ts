import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import { reserveNumber } from "../numbers.js";
import {
  foreignCommits,
  installPushGuard,
  pushRefusal,
  type RefUpdate,
} from "./push-guard.js";

/** A commit name, written out: what it is does not matter to the rule. */
const SHA = "1111111111111111111111111111111111111111";
const OLD = "2222222222222222222222222222222222222222";
/** What git sends for the far side of a ref that does not exist yet, or for a delete. */
const ZERO = "0000000000000000000000000000000000000000";

/** One line of what git hands a `pre-push` hook, for an update to `remoteRef`. */
function update(remoteRef: string, localSha = SHA): RefUpdate {
  return { localRef: "refs/heads/work", localSha, remoteRef, remoteSha: OLD };
}

describe("what a run may push", () => {
  const WORK = "timone/7-x";

  it("allows an update to the run's own work branch", () => {
    expect(pushRefusal([update("refs/heads/timone/7-x")], WORK)).toBeUndefined();
  });

  it.each([
    ["the default branch", "refs/heads/main"],
    ["another branch", "refs/heads/other"],
    ["a tag", "refs/tags/v1"],
  ])("refuses an update to %s", (_what, ref) => {
    const refusal = pushRefusal([update(ref)], WORK);

    expect(refusal).toContain(ref);
    expect(refusal).toContain("timone/7-x");
  });

  it("refuses deleting the work branch", () => {
    expect(pushRefusal([update("refs/heads/timone/7-x", ZERO)], WORK)).toBeDefined();
  });

  it("refuses a push that carries one allowed update and one refused one", () => {
    const refusal = pushRefusal(
      [update("refs/heads/timone/7-x"), update("refs/heads/main")],
      WORK,
    );

    expect(refusal).toContain("refs/heads/main");
  });

  it("never tells the reader to put anything on the default branch", () => {
    const refusal = pushRefusal([update("refs/heads/main")], WORK) ?? "";

    // Every sentence that says where to push names the work branch, and none
    // names `main` as a place to put work.
    expect(refusal).toMatch(/Commit on `timone\/7-x` and push that\./);
    expect(refusal).not.toMatch(/(push|commit|merge)[^.]*\bto `?main`?/i);
    expect(refusal).not.toMatch(/on `?main`?/i);
  });
});

describe("what a step with no work branch may push", () => {
  it.each([
    ["the default branch", "refs/heads/main"],
    ["a branch named like a run's", "refs/heads/timone/7-x"],
    ["a branch named undefined", "refs/heads/undefined"],
  ])("refuses an update to %s, and says the step pushes nothing", (_what, ref) => {
    const refusal = pushRefusal([update(ref)], undefined);

    expect(refusal).toBe(
      "Refused: this step has no work branch, so it pushes nothing to the project. " +
        "Say what you did on the ticket.",
    );
  });
});

describe("a reservation of a number, which every step may create", () => {
  /** One line of what git hands a `pre-push` hook for pushing a reservation to `remoteRef`. */
  function reservation(
    remoteRef: string,
    shas: { localSha?: string; remoteSha?: string } = {},
  ): RefUpdate {
    return {
      localRef: SHA,
      localSha: shas.localSha ?? SHA,
      remoteRef,
      remoteSha: shas.remoteSha ?? ZERO,
    };
  }

  it.each([
    ["a run with a work branch", "timone/7-x"],
    ["a step with no work branch", undefined],
  ])("allows %s to create a reservation", (_who, workBranch) => {
    expect(
      pushRefusal([reservation("refs/timone/numbers/phase/44")], workBranch),
    ).toBeUndefined();
  });

  describe.each([
    ["a run with a work branch", "timone/7-x"],
    ["a step with no work branch", undefined],
  ])("for %s", (_who, workBranch) => {
    const PHASE_44 = "refs/timone/numbers/phase/44";

    it.each([
      ["moving a reservation that exists", reservation(PHASE_44, { remoteSha: OLD })],
      ["deleting a reservation", reservation(PHASE_44, { localSha: ZERO, remoteSha: OLD })],
      [
        "a delete whose far side reads as no commit",
        reservation(PHASE_44, { localSha: ZERO, remoteSha: ZERO }),
      ],
      ["a ref under refs/timone/ outside numbers/", reservation("refs/timone/other/1")],
      ["a kind of numbered file that does not exist", reservation("refs/timone/numbers/chapter/1")],
      ["a number with more than digits", reservation("refs/timone/numbers/phase/44a")],
    ])("refuses %s", (_what, refused) => {
      expect(pushRefusal([refused], workBranch)).toBeDefined();
    });

    it("refuses a push that carries a reservation and an update to the default branch", () => {
      const refusal = pushRefusal(
        [reservation("refs/timone/numbers/phase/44"), update("refs/heads/main")],
        workBranch,
      );

      expect(refusal).toBeDefined();
    });
  });
});

describe("a work branch that carries another ticket's unmerged commits (PRD-07.R4)", () => {
  const WORK = "timone/7-x";
  /** The first push of the work branch: the remote does not have it yet. */
  const firstPush: RefUpdate = {
    localRef: "refs/heads/timone/7-x",
    localSha: SHA,
    remoteRef: "refs/heads/timone/7-x",
    remoteSha: ZERO,
  };

  it("finds nothing, and lets the push go ahead, when no other branch has the branch's own commits (clause 2)", () => {
    const found = foreignCommits(["aaa", "bbb"], () => ["origin/main"], WORK);

    expect(found).toEqual([]);
    expect(pushRefusal([firstPush], WORK, found)).toBeUndefined();
  });

  it("finds an own commit that origin/timone/12-other has, and refuses the push naming that branch", () => {
    const found = foreignCommits(
      ["aaa", "bbb"],
      (sha) => (sha === "bbb" ? ["origin/timone/12-other"] : []),
      WORK,
    );

    expect(found).toEqual([{ sha: "bbb", branch: "timone/12-other" }]);
    expect(pushRefusal([firstPush], WORK, found)).toBe(
      "Refused: this branch carries work of timone/12-other that is not on the default branch yet. " +
        "Cut the work branch from the default branch, and keep only this ticket's commits on it.",
    );
  });

  it("does not count a commit that only the remote's copy of the work branch has", () => {
    expect(foreignCommits(["aaa"], () => ["origin/timone/7-x"], WORK)).toEqual([]);
  });
});

/**
 * The command line as it ships. The hook runs it the way a box does, so the
 * build comes before these tests (`npm run build && npm test`), as it does
 * for `cli.test.ts`.
 */
const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A bare repository standing in for the project's remote, with `main` on it,
 * and a clone of it one commit ahead.
 *
 * Every git here runs with `HOME` in the temp directory and no system config,
 * so the person's own git configuration can neither help nor break the test,
 * and nothing is written to it. The inherited `GIT_*` variables are dropped
 * for the same reason.
 */
function remoteAndClone() {
  const root = mkdtempSync(join(tmpdir(), "timone-push-guard-"));
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
  const clone = join(root, "clone");

  const git = (args: string[], extra: Record<string, string> = {}) => {
    const ran = spawnSync("git", args, {
      cwd: clone,
      env: { ...baseEnv, ...extra },
      encoding: "utf8",
    });
    return { status: ran.status, stderr: ran.stderr, stdout: ran.stdout.trim() };
  };
  const mustGit = (args: string[], extra: Record<string, string> = {}): string => {
    const ran = git(args, extra);
    if (ran.status !== 0) throw new Error(`git ${args.join(" ")}: ${ran.stderr}`);
    return ran.stdout;
  };
  const remoteHas = (ref: string): string | undefined => {
    const ran = spawnSync("git", ["--git-dir", remote, "rev-parse", "--verify", "--quiet", ref], {
      env: baseEnv,
      encoding: "utf8",
    });
    return ran.status === 0 ? ran.stdout.trim() : undefined;
  };

  spawnSync("git", ["init", "--quiet", "--bare", remote], { env: baseEnv });
  mkdirSync(clone);
  mustGit(["init", "--quiet", "-b", "main"]);
  mustGit(["config", "user.name", "A Test"]);
  mustGit(["config", "user.email", "test@example.invalid"]);
  mustGit(["remote", "add", "origin", remote]);
  mustGit(["commit", "--quiet", "--allow-empty", "-m", "first"]);
  mustGit(["push", "--quiet", "origin", "HEAD:main"]);
  // What `git clone` sets, and a box's checkout is a clone: the guard reads
  // the default branch from it on a work branch's first push.
  mustGit(["remote", "set-head", "origin", "main"]);
  mustGit(["commit", "--quiet", "--allow-empty", "-m", "the run's work"]);

  return { root, clone, env: baseEnv, git, mustGit, remoteHas };
}

describe("a run's git push, with the guard switched on", () => {
  it("a run cannot push to the default branch", () => {
    const { root, git, mustGit, remoteHas } = remoteAndClone();
    const guard = installPushGuard(join(root, "guard"), { workBranch: "timone/7-x", cli: CLI });
    const mainBefore = remoteHas("refs/heads/main");

    const toMain = git(["push", "origin", "HEAD:main"], guard);

    expect(toMain.status).not.toBe(0);
    expect(toMain.stderr).toContain("timone/7-x");
    expect(remoteHas("refs/heads/main")).toBe(mainBefore);

    const toWork = git(["push", "origin", "HEAD:timone/7-x"], guard);

    expect(toWork.status).toBe(0);
    expect(remoteHas("refs/heads/timone/7-x")).toBe(mustGit(["rev-parse", "HEAD"]));
  });

  it.each([
    ["a run with a work branch", "timone/7-x"],
    ["a step with no work branch", undefined],
  ])("%s can reserve a number, and still cannot push to the default branch", async (_who, workBranch) => {
    const { root, clone, env, git, remoteHas } = remoteAndClone();
    const guard = installPushGuard(join(root, "guard"), { workBranch, cli: CLI });
    const mainBefore = remoteHas("refs/heads/main");
    // `reserveNumber` runs git with this process's own environment, so the
    // guard is switched on there, with the same clean git setup as the rest.
    for (const name of Object.keys(process.env)) {
      if (name.startsWith("GIT_")) vi.stubEnv(name, undefined);
    }
    for (const [name, value] of Object.entries({ ...env, ...guard })) {
      if (process.env[name] !== value) vi.stubEnv(name, value);
    }

    try {
      expect(await reserveNumber(clone, "phase")).toBe("01");
      expect(remoteHas("refs/timone/numbers/phase/01")).toBeDefined();
    } finally {
      vi.unstubAllEnvs();
    }

    expect(git(["push", "origin", "HEAD:main"], guard).status).not.toBe(0);
    expect(remoteHas("refs/heads/main")).toBe(mainBefore);
  });
});

describe("the guard as a box installs it", () => {
  it("is the same guard when installed through Timone's own command", () => {
    // The box has no TypeScript to call, so it installs through the command
    // line. This is that command, with only the variables the box exports.
    const { root, env: baseEnv, git, remoteHas } = remoteAndClone();
    const dir = join(root, "git-hooks");
    const installed = spawnSync(
      process.execPath,
      [CLI, "guardrails", "install-push-guard", "--dir", dir, "--branch", "timone/7-x"],
      { env: baseEnv, encoding: "utf8" },
    );
    expect(installed.status).toBe(0);
    const env = {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.hooksPath",
      GIT_CONFIG_VALUE_0: dir,
    };
    const mainBefore = remoteHas("refs/heads/main");

    expect(git(["push", "origin", "HEAD:main"], env).status).not.toBe(0);
    expect(remoteHas("refs/heads/main")).toBe(mainBefore);
    expect(git(["push", "origin", "HEAD:timone/7-x"], env).status).toBe(0);
  });
});

describe("a project that keeps its own hooks, with the guard switched on", () => {
  /**
   * The clone from {@link remoteAndClone}, with `core.hooksPath` set in its
   * own config to a directory inside it, as a project using husky or a
   * `.githooks/` folder has. `hooks` is given the path of a marker file a
   * hook can write to show it ran.
   */
  function withOwnHooks(hooks: (marker: string) => Record<string, string>) {
    const world = remoteAndClone();
    const marker = join(world.root, "marker");
    mkdirSync(join(world.clone, ".githooks"));
    for (const [name, body] of Object.entries(hooks(marker))) {
      writeFileSync(join(world.clone, ".githooks", name), `#!/bin/sh\n${body}\n`, {
        mode: 0o755,
      });
    }
    world.mustGit(["config", "core.hooksPath", ".githooks"]);
    const guard = installPushGuard(join(world.root, "guard"), {
      workBranch: "timone/7-x",
      cli: CLI,
    });
    return { ...world, marker, guard };
  }

  it("still refuses a push to the default branch", () => {
    const { git, guard, remoteHas } = withOwnHooks(() => ({ "pre-push": "exit 0" }));
    const mainBefore = remoteHas("refs/heads/main");

    expect(git(["push", "origin", "HEAD:main"], guard).status).not.toBe(0);
    expect(remoteHas("refs/heads/main")).toBe(mainBefore);
  });

  it("runs the project's own pre-push on an allowed push, with what git sent it", () => {
    const { git, guard, marker, mustGit } = withOwnHooks((marker) => ({
      "pre-push": `cat > '${marker}'`,
    }));

    expect(git(["push", "origin", "HEAD:timone/7-x"], guard).status).toBe(0);
    expect(readFileSync(marker, "utf8")).toBe(
      `HEAD ${mustGit(["rev-parse", "HEAD"])} refs/heads/timone/7-x ` +
        "0000000000000000000000000000000000000000\n",
    );
  });

  it("runs the project's own pre-commit on a commit", () => {
    const { git, guard, marker } = withOwnHooks((marker) => ({
      "pre-commit": `echo ran > '${marker}'`,
    }));

    expect(git(["commit", "--quiet", "--allow-empty", "-m", "more"], guard).status).toBe(0);
    expect(existsSync(marker)).toBe(true);
  });

  it("lets the project's own pre-commit stop a commit", () => {
    const { git, guard, mustGit } = withOwnHooks(() => ({ "pre-commit": "exit 1" }));
    const before = mustGit(["rev-parse", "HEAD"]);

    expect(git(["commit", "--quiet", "--allow-empty", "-m", "more"], guard).status).not.toBe(0);
    expect(mustGit(["rev-parse", "HEAD"])).toBe(before);
  });

  it("hands the project's own hook the arguments git gave it", () => {
    const { git, guard, marker } = withOwnHooks((marker) => ({
      "commit-msg": `cat "$1" > '${marker}'`,
    }));

    expect(git(["commit", "--quiet", "--allow-empty", "-m", "the message"], guard).status).toBe(0);
    expect(readFileSync(marker, "utf8")).toBe("the message\n");
  });
});

describe("the guard's own command, when something is wrong", () => {
  it("refuses the push when it is given input it cannot read", () => {
    const home = mkdtempSync(join(tmpdir(), "timone-push-guard-home-"));
    tempDirs.push(home);
    const ran = spawnSync(
      process.execPath,
      [CLI, "guardrails", "pre-push", "--branch", "timone/7-x"],
      { input: "not a ref line\n", env: { ...process.env, HOME: home }, encoding: "utf8" },
    );

    expect(ran.status).toBe(1);
    expect(ran.stderr).toContain("Refused");
  });
});
