import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { installMergeRules } from "./merge-rules.js";

/**
 * The merge rule as a box uses it: `git merge` of the default branch into a
 * work branch, in a clone whose environment is exactly what
 * `installMergeRules` returns, with the built command line as the driver.
 * So `npm run build` comes before these tests, as for `push-guard.test.ts`.
 */
const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const STATUS = "STATUS.md";
const REGISTER = "doc/specs/prd/prd-01-x.criteria.md";

const STATUS_BASE = `# Status

**Last updated:** 2026-10-01.

---

**1. First item.** The runner is built.

**What I need from you:** nothing.

**2. Second item.** The guard is merged.

**What I need from you:** a review.
`;

/** `STATUS.md` with its date set to `date` and `item` added after the last item. */
function statusWith(date: string, item: string): string {
  return STATUS_BASE.replace("2026-10-01", date) + `\n${item}\n\n**What I need from you:** nothing.\n`;
}

const R1_CLAUSE = "    - GIVEN a ticket WHEN it runs THEN it ends\n";

/** A register with R1 and R2; `parts` adds a clause to R1, a note under R2, or sets R2's Status. */
function registerWith(parts: { clause?: string; note?: string; r2Status?: string; extra?: string } = {}): string {
  return (
    "# PRD-01 — X: acceptance criteria\n\n" +
    "## R1 — First\n\n" +
    "- **Priority:** MUST\n- **Status:** draft\n- **Verify-via:** api\n- **Criteria:**\n" +
    R1_CLAUSE +
    (parts.clause ?? "") +
    "- **Verification hint:** run it.\n\n" +
    "## R2 — Second\n\n" +
    (parts.note === undefined ? "" : `${parts.note}\n\n`) +
    `- **Priority:** SHOULD\n- **Status:** ${parts.r2Status ?? "draft"}\n- **Verify-via:** api\n- **Criteria:**\n` +
    "    - GIVEN a run WHEN it stops THEN it says why\n" +
    "- **Verification hint:** stop it.\n" +
    (parts.extra ?? "")
  );
}

/**
 * A bare repository standing for the forge, a seed repository standing for
 * the people who push to it, and `clone` for a clone made later.
 *
 * Every git here runs with `HOME` in the temp directory, no system config,
 * and none of this process's `GIT_*` variables, so neither the machine's git
 * settings nor a `GIT_CONFIG_COUNT` already set can make a case pass or fail.
 */
function forge() {
  const root = mkdtempSync(join(tmpdir(), "timone-merge-rules-"));
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
    return { status: ran.status, output: ran.stdout + ran.stderr, stdout: ran.stdout };
  };
  const mustGit = (cwd: string, args: string[]): string => {
    const ran = git(cwd, args);
    if (ran.status !== 0) throw new Error(`git ${args.join(" ")}: ${ran.output}`);
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

  /** Clone the forge with `branch` checked out, ready to merge. */
  const cloneOn = (branch: string) => {
    mustGit(root, ["clone", "--quiet", "--branch", branch, remote, clone]);
    setUser(clone);
  };

  return { root, clone, git, mustGit, commit, cloneOn, seed };
}

/**
 * `main` with both files; branches `a` and `b` cut from it, each with its own
 * changes to both files; `a` landed on `main` as `landing` makes it.
 */
function twoBranches(
  sides: { a: Record<string, string>; b: Record<string, string> },
  landing: "squash" | "merge",
) {
  const world = forge();
  const { seed, mustGit, commit } = world;
  commit({ [STATUS]: STATUS_BASE, [REGISTER]: registerWith() }, "first");
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  mustGit(seed, ["checkout", "--quiet", "-b", "a"]);
  commit(sides.a, "work on a");
  mustGit(seed, ["checkout", "--quiet", "-b", "b", "main"]);
  commit(sides.b, "work on b");
  mustGit(seed, ["push", "--quiet", "origin", "b"]);
  mustGit(seed, ["checkout", "--quiet", "main"]);
  if (landing === "squash") {
    mustGit(seed, ["merge", "--quiet", "--squash", "a"]);
    mustGit(seed, ["commit", "--quiet", "-m", "feat: a (#1)"]);
  } else {
    mustGit(seed, ["merge", "--quiet", "--no-ff", "-m", "Merge pull request #1 from a", "a"]);
  }
  mustGit(seed, ["push", "--quiet", "origin", "main"]);
  world.cloneOn("b");
  return world;
}

/** Case 1's two branches: new items and dates, notes under R2, clauses at the end of R1. */
const CASE_1 = {
  a: {
    [STATUS]: statusWith("2026-10-02", "**3. Added on a.** The merge rule is planned."),
    [REGISTER]: registerWith({
      clause: "    - GIVEN a closed ticket WHEN it reopens THEN it runs again\n",
      note: "> ✏ 2026-10-02 — a note from a.",
    }),
  },
  b: {
    [STATUS]: statusWith("2026-10-03", "**3. Added on b.** The merge rule is built."),
    [REGISTER]: registerWith({
      clause: "    - GIVEN a second ticket WHEN it waits THEN it says why\n",
      note: "> ✏ 2026-10-03 — a note from b.",
    }),
  },
};

/** The lines `side` holds that `base` does not. */
function addedLines(base: string, side: string): string[] {
  const baseLines = new Set(base.split("\n"));
  return side.split("\n").filter((line) => line !== "" && !baseLines.has(line));
}

/** The text of one register section, from its heading to the next. */
function section(text: string, heading: string): string {
  const start = text.indexOf(heading);
  const next = text.indexOf("\n## ", start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

describe("git merge of the default branch into a work branch, with the merge rules switched on", () => {
  it.each(["squash", "merge"] as const)(
    "brings both files level with no conflict when a landed as a %s commit",
    (landing) => {
      const { clone, git, root } = twoBranches(CASE_1, landing);
      const env = installMergeRules(join(root, "merge-rules"), { cli: CLI });

      const merged = git(clone, ["merge", "--no-edit", "origin/main"], env);
      const unmerged = git(clone, ["diff", "--name-only", "--diff-filter=U"]).stdout;

      expect({ status: merged.status, unmerged, output: merged.output }).toMatchObject({
        status: 0,
        unmerged: "",
      });
      const status = readFileSync(join(clone, STATUS), "utf8");
      const register = readFileSync(join(clone, REGISTER), "utf8");
      const keptDate = "**Last updated:** 2026-10-03.";
      for (const line of [
        ...addedLines(STATUS_BASE, CASE_1.a[STATUS]),
        ...addedLines(STATUS_BASE, CASE_1.b[STATUS]),
      ].filter((line) => !line.startsWith("**Last updated:**"))) {
        expect(status.split("\n")).toContain(line);
      }
      expect(status.split("\n").filter((line) => line.startsWith("**Last updated:**"))).toEqual([
        keptDate,
      ]);
      for (const line of [
        ...addedLines(registerWith(), CASE_1.a[REGISTER]),
        ...addedLines(registerWith(), CASE_1.b[REGISTER]),
      ]) {
        expect(register.split("\n")).toContain(line);
      }
      expect(
        section(register, "## R2").split("\n").filter((line) => line.startsWith("- **Status:**")),
      ).toEqual(["- **Status:** draft"]);
    },
  );

  it("stops on both files without the environment, so the cases above are not empty", () => {
    const { clone, git } = twoBranches(CASE_1, "squash");

    const merged = git(clone, ["merge", "--no-edit", "origin/main"]);

    expect(merged.status).toBe(1);
    expect(git(clone, ["diff", "--name-only", "--diff-filter=U"]).stdout).toBe(
      `${STATUS}\n${REGISTER}\n`,
    );
  });

  it("writes nothing into the project", () => {
    const { clone, git, root } = twoBranches(CASE_1, "squash");
    const env = installMergeRules(join(root, "merge-rules"), { cli: CLI });
    const configBefore = readFileSync(join(clone, ".git", "config"));

    expect(git(clone, ["merge", "--no-edit", "origin/main"], env).status).toBe(0);

    expect(existsSync(join(clone, ".gitattributes"))).toBe(false);
    expect(readFileSync(join(clone, ".git", "config")).equals(configBefore)).toBe(true);
    expect(existsSync(join(clone, ".git", "info", "attributes"))).toBe(false);
    expect(git(clone, ["status", "--porcelain"]).stdout).toBe("");
  });

  it("stops on the register, and names R3, when both branches add an R3", () => {
    const { clone, git, root } = twoBranches(
      {
        a: { [REGISTER]: registerWith({ extra: "\n## R3 — Added on a\n\n- **Priority:** MUST\n- **Status:** draft\n" }) },
        b: { [REGISTER]: registerWith({ extra: "\n## R3 — Added on b\n\n- **Priority:** SHOULD\n- **Status:** draft\n" }) },
      },
      "squash",
    );
    const env = installMergeRules(join(root, "merge-rules"), { cli: CLI });

    const merged = git(clone, ["merge", "--no-edit", "origin/main"], env);

    expect(merged.status).toBe(1);
    expect(git(clone, ["diff", "--name-only", "--diff-filter=U"]).stdout).toBe(`${REGISTER}\n`);
    expect(merged.output).toContain(
      `${REGISTER}: R3 is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose.`,
    );
  });

  it("keeps main's Status for R2, and a note naming the work branch's, when both change it", () => {
    const { clone, git, root } = twoBranches(
      {
        a: { [REGISTER]: registerWith({ r2Status: "verified" }) },
        b: { [REGISTER]: registerWith({ r2Status: "blocked" }) },
      },
      "squash",
    );
    const env = installMergeRules(join(root, "merge-rules"), { cli: CLI });

    expect(git(clone, ["merge", "--no-edit", "origin/main"], env).status).toBe(0);

    const r2 = section(readFileSync(join(clone, REGISTER), "utf8"), "## R2").split("\n");
    expect(r2.filter((line) => line.startsWith("- **Status:**"))).toEqual(["- **Status:** verified"]);
    expect(r2.filter((line) => line.startsWith("> ✏"))).toEqual([
      expect.stringMatching(
        /^> ✏ \d{4}-\d{2}-\d{2} — .*`- \*\*Status:\*\* blocked`.*`- \*\*Status:\*\* verified` stands\.$/,
      ),
    ]);
  });
});
