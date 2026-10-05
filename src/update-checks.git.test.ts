import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { PROBE_DIRECTORIES } from "./daemon/probeGuard.js";
import { updateChecks } from "./update-checks.js";

/**
 * `updateChecks` against a real repository: a bare repository standing for
 * the forge, a seed repository standing for the people who push to it, and a
 * clone on the work branch, as a box has. The probe folder's path is never
 * written here; it comes from `PROBE_DIRECTORIES`.
 */

/**
 * The command line as it ships: the built `dist/cli.js`, run by node. The
 * build comes before the tests, as for `cli.test.ts`.
 */
const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A path in the project's probe folder. */
function probe(name: string): string {
  return posix.join(PROBE_DIRECTORIES[0], name);
}

/** A phase file whose *Requirements* table claims `ids`. */
function plan(title: string, ids: string[]): string {
  return (
    `# ${title}\n\n## Requirements\n\n` +
    "| ID | Priority | Requirement (one line) |\n| -- | -------- | ---------------------- |\n" +
    ids.map((id) => `| ${id} | MUST | Something that holds |\n`).join("") +
    "\n## Sub-phases\n\nNothing yet.\n"
  );
}

const PACKAGE_JSON = JSON.stringify({ name: "app", scripts: { test: "vitest run" } });

/**
 * A forge, a seed and a clone at `projects/app` under the temp root.
 *
 * Every git here runs with `HOME` in the temp directory, no system config,
 * and none of this process's `GIT_*` variables, so the machine's git
 * settings cannot make a case pass or fail.
 */
function forge() {
  const root = mkdtempSync(join(tmpdir(), "timone-update-checks-"));
  tempDirs.push(root);
  const home = join(root, "home");
  mkdirSync(home);
  const env: Record<string, string> = {
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
  const clone = join(root, "projects", "app");

  const mustGit = (cwd: string, args: readonly string[]): string => {
    const ran = spawnSync("git", args, { cwd, env, encoding: "utf8" });
    if (ran.status !== 0) throw new Error(`git ${args.join(" ")}: ${ran.stdout}${ran.stderr}`);
    return ran.stdout;
  };
  const setUser = (dir: string) => {
    mustGit(dir, ["config", "user.name", "A Test"]);
    mustGit(dir, ["config", "user.email", "test@example.invalid"]);
  };
  /** Write `files` in the seed and commit them on the branch checked out there. */
  const commit = (files: Record<string, string>, message: string) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(seed, path)), { recursive: true });
      writeFileSync(join(seed, path), text);
    }
    mustGit(seed, ["add", "--all"]);
    mustGit(seed, ["commit", "--quiet", "-m", message]);
  };

  mustGit(root, ["init", "--quiet", "--bare", "--initial-branch=main", remote]);
  mustGit(root, ["init", "--quiet", "--initial-branch=main", seed]);
  setUser(seed);
  mustGit(seed, ["remote", "add", "origin", remote]);

  /** Clone the forge at `projects/app` with `branch` checked out. */
  const cloneOn = (branch: string) => {
    mkdirSync(dirname(clone), { recursive: true });
    mustGit(root, ["clone", "--quiet", "--branch", branch, remote, clone]);
    setUser(clone);
  };
  /** The port `updateChecks` takes: git run in the clone. */
  const inClone = (args: readonly string[]) => mustGit(clone, args);

  return { root, seed, clone, mustGit, commit, cloneOn, inClone };
}

/**
 * Case 3's world: branch `b` added phase 50 (R7 and R14) and R7's check
 * script; `main` has since gained phase 49 (R5 and R6) with both scripts,
 * landed as a squash commit of pull request 215. The clone is on `b`.
 */
function behindAfterPhase49() {
  const world = forge();
  const { seed, mustGit, commit } = world;
  commit({ "README.md": "# app\n", "package.json": PACKAGE_JSON }, "first");
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
  commit(
    {
      "doc/plans/phases/phase-50.md": plan("Phase 50: The update", ["PRD-07.R7", "PRD-07.R14"]),
      [probe("prd-07.r7.mjs")]: "// checks R7\n",
    },
    "docs: plan phase 50",
  );
  mustGit(seed, ["push", "--quiet", "origin", "b"]);
  mustGit(seed, ["checkout", "--quiet", "main"]);
  commit(
    {
      "doc/plans/phases/phase-49.md": plan("Phase 49: Two places", ["PRD-07.R5", "PRD-07.R6"]),
      [probe("prd-07.r5.mjs")]: "// checks R5\n",
      [probe("prd-07.r6.mjs")]: "// checks R6\n",
    },
    "feat: phase 49 — two places and the planner (#215)",
  );
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  world.cloneOn("b");
  return world;
}

/** What case 3 expects of phase 50, the branch's own plan. */
const OWN_PHASE_50 = {
  phase: "doc/plans/phases/phase-50.md",
  checks: [{ id: "PRD-07.R7", script: probe("prd-07.r7.mjs") }, { id: "PRD-07.R14" }],
};

/** What case 3 expects of phase 49, which arrived with pull request 215. */
const ARRIVED_PHASE_49 = {
  phase: "doc/plans/phases/phase-49.md",
  pullRequest: 215,
  checks: [
    { id: "PRD-07.R5", script: probe("prd-07.r5.mjs") },
    { id: "PRD-07.R6", script: probe("prd-07.r6.mjs") },
  ],
};

describe("updateChecks on a branch behind the default branch", () => {
  it("names the branch's own plan and the plan that arrived, with each requirement's check script and the pull request", () => {
    const { inClone } = behindAfterPhase49();

    const checks = updateChecks(inClone, { defaultBranch: "main", before: "HEAD" });

    expect(checks.own).toEqual(OWN_PHASE_50);
    expect(checks.arrived).toEqual([ARRIVED_PHASE_49]);
  });
});

describe("updateChecks after the update merged the default branch into the branch", () => {
  it("gives the same answer as before the merge when told the branch's commit before it", () => {
    const { clone, mustGit, inClone } = behindAfterPhase49();
    const beforeMerge = mustGit(clone, ["rev-parse", "HEAD"]).trim();
    mustGit(clone, ["merge", "--quiet", "--no-edit", "origin/main"]);

    const checks = updateChecks(inClone, { defaultBranch: "main", before: beforeMerge });

    expect(checks.own).toEqual(OWN_PHASE_50);
    expect(checks.arrived).toEqual([ARRIVED_PHASE_49]);
  });

  it("finds no plan arrived when told nothing of the commit before the merge, and still answers", () => {
    const { clone, mustGit, inClone } = behindAfterPhase49();
    mustGit(clone, ["merge", "--quiet", "--no-edit", "origin/main"]);

    const checks = updateChecks(inClone, { defaultBranch: "main", before: "HEAD" });

    expect(checks.own).toEqual(OWN_PHASE_50);
    expect(checks.arrived).toEqual([]);
  });
});

describe("updateChecks on a branch level with the default branch", () => {
  it("finds no plan arrived", () => {
    const world = forge();
    const { seed, mustGit, commit, inClone } = world;
    commit({ "README.md": "# app\n", "package.json": PACKAGE_JSON }, "first");
    commit(
      { "doc/plans/phases/phase-49.md": plan("Phase 49: Two places", ["PRD-07.R5"]) },
      "feat: phase 49 — two places and the planner (#215)",
    );
    mustGit(seed, ["push", "--quiet", "origin", "main"]);
    mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
    commit(
      { "doc/plans/phases/phase-50.md": plan("Phase 50: The update", ["PRD-07.R7", "PRD-07.R14"]) },
      "docs: plan phase 50",
    );
    mustGit(seed, ["push", "--quiet", "origin", "b"]);
    world.cloneOn("b");

    const checks = updateChecks(inClone, { defaultBranch: "main", before: "HEAD" });

    expect(checks.arrived).toEqual([]);
  });
});

/** A manifest naming one project, `app`, checked out at `projects/app`. */
const MANIFEST = `
projects:
  app:
    repo_url: https://example.invalid/app.git
    path: projects/app
    stack:
      - typescript
    bindings:
      ticketing: github
`;

/** A branch `b` level with `main`, which adds phase 50 and has a package.json with no `scripts.test`. */
function levelWithNoTestScript() {
  const world = forge();
  const { seed, mustGit, commit } = world;
  commit({ "package.json": JSON.stringify({ name: "app", scripts: { build: "tsc" } }) }, "first");
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
  commit(
    { "doc/plans/phases/phase-50.md": plan("Phase 50: The update", ["PRD-07.R7", "PRD-07.R14"]) },
    "docs: plan phase 50",
  );
  mustGit(seed, ["push", "--quiet", "origin", "b"]);
  world.cloneOn("b");
  writeFileSync(join(world.root, "timone.yaml"), MANIFEST);
  return world;
}

describe("the project's test command", () => {
  it("is the project's scripts.test", () => {
    const { inClone } = behindAfterPhase49();

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommand).toBe("vitest run");
  });

  it("is undefined when package.json has no scripts.test", () => {
    const { inClone } = levelWithNoTestScript();

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommand).toBeUndefined();
  });

  it("is said to be missing in the command's plain output", () => {
    const { root } = levelWithNoTestScript();

    const ran = spawnSync(process.execPath, [CLI, "update-checks", "app"], { cwd: root, encoding: "utf8" });

    expect(ran.stderr).toBe("");
    expect(ran.status).toBe(0);
    expect(ran.stdout).toBe(
      "The project has no test command: there is no scripts.test in its package.json.\n" +
        "\n" +
        "This branch's plan, doc/plans/phases/phase-50.md:\n" +
        "  PRD-07.R7: no check script\n" +
        "  PRD-07.R14: no check script\n" +
        "\n" +
        "No plan arrived on main since HEAD.\n",
    );
  });
});
