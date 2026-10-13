import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { PROBE_DIRECTORIES } from "./daemon/probeGuard.js";
import { mergeConflicts, updateChecks } from "./update-checks.js";

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
  it("is npm test when the project has a scripts.test", () => {
    const { inClone } = behindAfterPhase49();

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommands).toEqual(["npm test"]);
  });

  it("is none when package.json has no scripts.test", () => {
    const { inClone } = levelWithNoTestScript();

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommands).toEqual([]);
  });

  it("is said to be missing in the command's plain output", () => {
    const { root } = levelWithNoTestScript();

    const ran = spawnSync(process.execPath, [CLI, "update-checks", "app"], { cwd: root, encoding: "utf8" });

    expect(ran.stderr).toBe("");
    expect(ran.status).toBe(0);
    expect(ran.stdout).toBe(
      "The project has no test command: its package.json has no scripts.test and no test: script.\n" +
        "\n" +
        "This branch's plan, doc/plans/phases/phase-50.md:\n" +
        "  PRD-07.R7: no check script\n" +
        "  PRD-07.R14: no check script\n" +
        "\n" +
        "No plan arrived on main since HEAD.\n",
    );
  });
});

/** A branch `b` level with `main`, whose package.json has `scripts`. */
function levelWithScripts(scripts: Record<string, string>) {
  const world = forge();
  const { seed, mustGit, commit } = world;
  commit({ "package.json": JSON.stringify({ name: "app", scripts }) }, "first");
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
  mustGit(seed, ["push", "--quiet", "origin", "b"]);
  world.cloneOn("b");
  return world;
}

describe("the project's test commands", () => {
  it("are each test: script but the watch one, in the order package.json lists them, when it has no scripts.test", () => {
    const { inClone } = levelWithScripts({
      build: "tsc",
      "test:unit": "vitest run",
      "test:integration": "vitest run --project integration",
      "test:watch": "vitest",
      "test:e2e": "playwright test",
    });

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommands).toEqual([
      "npm run test:unit",
      "npm run test:integration",
      "npm run test:e2e",
    ]);
  });

  it("are npm test alone when package.json has scripts.test, even with test: scripts", () => {
    const { inClone } = levelWithScripts({ test: "vitest run", "test:unit": "vitest run --project unit" });

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommands).toEqual(["npm test"]);
  });

  it("are none when package.json has neither scripts.test nor a test: script", () => {
    const { inClone } = levelWithScripts({ build: "tsc", lint: "eslint ." });

    expect(updateChecks(inClone, { defaultBranch: "main", before: "HEAD" }).testCommands).toEqual([]);
  });
});

describe("updateChecks on a branch whose check script has a dash for the dot", () => {
  it("lists the dashed script under the plan's requirement", () => {
    const world = forge();
    const { seed, mustGit, commit, inClone } = world;
    commit({ "package.json": PACKAGE_JSON }, "first");
    mustGit(seed, ["push", "--quiet", "origin", "main"]);
    mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
    commit(
      {
        "doc/plans/phases/phase-61.md": plan("Phase 61: Dashed names", ["PRD-18.R12"]),
        [probe("prd-18-r12.mjs")]: "// checks R12\n",
      },
      "docs: plan phase 61",
    );
    mustGit(seed, ["push", "--quiet", "origin", "b"]);
    world.cloneOn("b");

    const checks = updateChecks(inClone, { defaultBranch: "main", before: "HEAD" });

    expect(checks.own).toEqual({
      phase: "doc/plans/phases/phase-61.md",
      checks: [{ id: "PRD-18.R12", script: probe("prd-18-r12.mjs") }],
    });
  });
});

/** A check script with one check per line in `checks`. */
function checkScript(checks: string[]): string {
  return checks.map((check) => `check(${JSON.stringify(check)});\n`).join("");
}

/**
 * Both sides changed one check script: the base has `PRD-07.R7`'s script
 * with one check. `main` gained phase 49, which claims `PRD-07.R7`, and added
 * a second check at the end, as pull request 230. Branch `b` added phase 50,
 * which claims it too, and a third check at the end. Both changed the same
 * line of `src/a.ts`. The clone is on `b`, and `before` is its commit.
 */
function bothChangedOneCheckScript() {
  const world = forge();
  const { seed, clone, mustGit, commit } = world;
  commit(
    {
      "package.json": PACKAGE_JSON,
      "src/a.ts": "export const a = 1;\n",
      [probe("prd-07.r7.mjs")]: checkScript(["one"]),
    },
    "first",
  );
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
  commit(
    {
      "doc/plans/phases/phase-50.md": plan("Phase 50: The update", ["PRD-07.R7"]),
      "src/a.ts": "export const a = 3;\n",
      [probe("prd-07.r7.mjs")]: checkScript(["one", "three"]),
    },
    "docs: plan phase 50",
  );
  mustGit(seed, ["push", "--quiet", "origin", "b"]);
  mustGit(seed, ["checkout", "--quiet", "main"]);
  commit(
    {
      "doc/plans/phases/phase-49.md": plan("Phase 49: Two places", ["PRD-07.R7"]),
      "src/a.ts": "export const a = 2;\n",
      [probe("prd-07.r7.mjs")]: checkScript(["one", "two"]),
    },
    "feat: phase 49 — two places (#230)",
  );
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  world.cloneOn("b");
  const before = mustGit(clone, ["rev-parse", "HEAD"]).trim();
  return { ...world, before };
}

describe("mergeConflicts while the update merges the default branch into the branch", () => {
  it("lists a check script both sides changed, with its requirement, apart from the other files", () => {
    const { clone, mustGit, inClone } = bothChangedOneCheckScript();
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT/);

    expect(mergeConflicts(inClone)).toEqual({
      checkScripts: [{ path: probe("prd-07.r7.mjs"), id: "PRD-07.R7" }],
      others: ["src/a.ts"],
    });
  });

  it("lists nothing once the update joined the check script and finished the merge, and the joined script counts for both plans", () => {
    const { clone, mustGit, inClone, before } = bothChangedOneCheckScript();
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT/);
    writeFileSync(join(clone, probe("prd-07.r7.mjs")), checkScript(["one", "two", "three"]));
    writeFileSync(join(clone, "src/a.ts"), "export const a = 2;\n");
    mustGit(clone, ["add", probe("prd-07.r7.mjs"), "src/a.ts"]);
    mustGit(clone, ["commit", "--quiet", "--no-edit"]);

    expect(existsSync(join(clone, ".git", "MERGE_HEAD"))).toBe(false);
    expect(mergeConflicts(inClone)).toEqual({ checkScripts: [], others: [] });
    expect(readFileSync(join(clone, probe("prd-07.r7.mjs")), "utf8")).toBe(
      'check("one");\ncheck("two");\ncheck("three");\n',
    );
    const checks = updateChecks(inClone, { defaultBranch: "main", before });
    expect(checks.own).toEqual({
      phase: "doc/plans/phases/phase-50.md",
      checks: [{ id: "PRD-07.R7", script: probe("prd-07.r7.mjs") }],
    });
    expect(checks.arrived).toEqual([
      {
        phase: "doc/plans/phases/phase-49.md",
        pullRequest: 230,
        checks: [{ id: "PRD-07.R7", script: probe("prd-07.r7.mjs") }],
      },
    ]);
  });
});

/**
 * A base of `base` files on `main`, branch `b` writing `branch` on it, and
 * `main` then writing `main`. The clone is on `b`.
 */
function merging(files: {
  base: Record<string, string>;
  branch: Record<string, string>;
  main: Record<string, string>;
}) {
  const world = forge();
  const { seed, commit } = world;
  commit({ "package.json": PACKAGE_JSON, ...files.base }, "first");
  world.mustGit(seed, ["push", "--quiet", "origin", "main"]);
  world.mustGit(seed, ["checkout", "--quiet", "-b", "b"]);
  commit(files.branch, "work on b");
  world.mustGit(seed, ["push", "--quiet", "origin", "b"]);
  world.mustGit(seed, ["checkout", "--quiet", "main"]);
  commit(files.main, "work on main");
  world.mustGit(seed, ["push", "--quiet", "origin", "main"]);
  world.cloneOn("b");
  return world;
}

describe("mergeConflicts on other conflicts in the probe folders", () => {
  it("lists a script both sides added, named with a dash, with its requirement", () => {
    const { clone, mustGit, inClone } = merging({
      base: {},
      branch: { [probe("prd-23-r8.mjs")]: checkScript(["the branch's way"]) },
      main: { [probe("prd-23-r8.mjs")]: checkScript(["main's way"]) },
    });
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT \(add\/add\)/);

    expect(mergeConflicts(inClone)).toEqual({
      checkScripts: [{ path: probe("prd-23-r8.mjs"), id: "PRD-23.R8" }],
      others: [],
    });
  });

  it("lists a helper file in the probe folder with the check scripts, with no requirement, never with the other files", () => {
    const { clone, mustGit, inClone } = merging({
      base: { [probe("_shared.mjs")]: "export const tolerance = 1;\n" },
      branch: { [probe("_shared.mjs")]: "export const tolerance = 2;\n" },
      main: { [probe("_shared.mjs")]: "export const tolerance = 3;\n" },
    });
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT/);

    expect(mergeConflicts(inClone)).toStrictEqual({
      checkScripts: [{ path: probe("_shared.mjs") }],
      others: [],
    });
  });

  it("lists a file in the other probe folder with the check scripts", () => {
    const baseline = posix.join(PROBE_DIRECTORIES[1], "contrast.mjs");
    const { clone, mustGit, inClone } = merging({
      base: { [baseline]: checkScript(["one"]) },
      branch: { [baseline]: checkScript(["one", "three"]) },
      main: { [baseline]: checkScript(["one", "two"]) },
    });
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT/);

    expect(mergeConflicts(inClone)).toStrictEqual({ checkScripts: [{ path: baseline }], others: [] });
  });
});

describe("mergeConflicts once no conflict is left", () => {
  it("gives two empty lists while the merge is still in progress", () => {
    const { clone, mustGit, inClone } = merging({
      base: { "src/a.ts": "export const a = 1;\n" },
      branch: { "src/a.ts": "export const a = 3;\n" },
      main: { "src/a.ts": "export const a = 2;\n" },
    });
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT/);
    writeFileSync(join(clone, "src/a.ts"), "export const a = 2;\n");
    mustGit(clone, ["add", "src/a.ts"]);

    expect(existsSync(join(clone, ".git", "MERGE_HEAD"))).toBe(true);
    expect(mergeConflicts(inClone)).toEqual({ checkScripts: [], others: [] });
  });
});

describe("the update-conflicts command", () => {
  it("exits 2 with one sentence when no merge is in progress", () => {
    const { root } = bothChangedOneCheckScript();
    writeFileSync(join(root, "timone.yaml"), MANIFEST);

    const ran = spawnSync(process.execPath, [CLI, "update-conflicts", "app"], { cwd: root, encoding: "utf8" });

    expect(ran.stdout).toBe("");
    expect(ran.stderr).toBe("No merge is in progress in app: there is nothing to join.\n");
    expect(ran.status).toBe(2);
  });

  it("prints the check scripts and the other files left in conflict under their headings", () => {
    const { root, clone, mustGit } = bothChangedOneCheckScript();
    writeFileSync(join(root, "timone.yaml"), MANIFEST);
    expect(() => mustGit(clone, ["merge", "--no-edit", "origin/main"])).toThrow(/CONFLICT/);

    const ran = spawnSync(process.execPath, [CLI, "update-conflicts", "app"], { cwd: root, encoding: "utf8" });

    expect(ran.stderr).toBe("");
    expect(ran.status).toBe(0);
    expect(ran.stdout).toBe(
      "Check scripts left in conflict — join these yourself, keeping every check from both sides:\n" +
        `- PRD-07.R7: ${probe("prd-07.r7.mjs")}\n` +
        "Other files left in conflict — give these to the fix context:\n" +
        "- src/a.ts\n",
    );
  });
});
