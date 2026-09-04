import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **No machine code path performs a git operation under `projects/`, and no
 * machine code path resolves a path there at all** — phase 30's second R23
 * clause, and the one that fixes the problem fvermaut actually reported
 * ([ADR-0043](../../doc/adr/0043-the-humans-checkout-is-theirs-alone.md)).
 *
 * `projects/<name>` is the folder he has open in an editor. Until phase 30 the
 * daemon probed branch tips there, read phase files there, and **merged into a
 * default branch** there — so his `git switch` and a running build fought over
 * one working tree, in a form nobody would recognise because no agent was
 * visibly running.
 *
 * **This is a wall with four doors, and that is the honest description.** What
 * it buys is not "nothing touches the checkout" but the difference between
 * four doors somebody chose and an unknown number nobody counted. Each
 * exemption below is named, with the reason it survives; adding a fifth means
 * editing this file, which is the point.
 *
 * ✏ **It runs in CI, and it did not always.** When this was written `.github/`
 * did not exist here, so the guard was only what a local `npm test` offers —
 * strong at every session's `Stop` hook and absent on a pull request. That was
 * recorded as an open question and it was **fvermaut's** to answer, because the
 * Timone App is installed without the Workflows permission, deliberately: a
 * token that can rewrite `.github/workflows` can widen its own grant on the
 * next run ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)).
 *
 * He answered it on 2026-08-22 with `bebd29e`, *"ci: run the tests and the
 * checkout guard on every push"*. The paragraph above stood for two weeks
 * telling every reader there was no runner, which is the cost of a note that
 * records a question and is never revisited when it is answered. Corrected
 * 2026-09-04, from a pull request that CI ran.
 */

/** The repository's `src` directory, from this file. */
const SRC = join(import.meta.dirname, "..");

/**
 * The files allowed to reach into `projects/`, each with the reason it is
 * allowed to. **Nothing else may.**
 *
 * Read the reasons rather than the list: three of the four are things phase 30
 * promises to keep, and the fourth is a human's own command.
 */
const EXEMPT: Record<string, string> = {
  "commands/workspace.ts":
    "`workspace sync` is what materializes the checkouts. It is fvermaut's " +
    "own command, run from his terminal, and after 30d it is a convenience " +
    "for him and a prerequisite for nothing.",
  "commands/status.ts":
    "`timone status` reads his folder to say where an initiative stands. " +
    "His command, his checkout, and `checkoutOf` lives here for that reason.",
  "daemon/hooks.ts":
    "The R15 guardrail bracket. It captures a baseline and collects evidence " +
    "with local, read-only git — `rev-parse`, `status --porcelain`, `log` — " +
    "and never reaches the forge. Phase 30's own plan says of it: nothing " +
    "here is removed.",
  "adapters/docker-preview.ts":
    "The preview adapter drives worktrees out of `projects/<name>/.git` " +
    "(ADR-0021). Phase 30 does not touch the preview machinery: previews are " +
    "driven from the host and never from inside a session.",
  "daemon/container-runtime.ts":
    "It builds `/workspace/projects/<name>` — a path **inside the box**, on " +
    "the container's own filesystem, which is the layout ADR-0007 fixed and " +
    "which a session expects to find. It is not a host path and cannot " +
    "become one: this file mounts nothing (asserted in its own tests) and " +
    "spawns docker, never git. The guard flagging it is the guard working — " +
    "the string is identical and only the filesystem differs.",
  "daemon/prompts.ts":
    "It writes the sentence `touch only `projects/<name>/…`` into a session " +
    "prompt. That is the R15 instruction to the agent, not a path this " +
    "process resolves: nothing here reaches a filesystem or spawns anything.",
};

/**
 * The files allowed to perform a git operation **at all**, each with what
 * they operate on. **Nothing else may.**
 *
 * A separate list from {@link EXEMPT}, and the separation is the point: git
 * against the *timone* checkout is an ordinary thing this system does, and git
 * against a *project's* checkout is what phase 30 ended. Conflating them would
 * either ban the first or excuse the second.
 */
const GIT_USERS: Record<string, string> = {
  // Direct use only — `commands/status.ts` reaches git *through*
  // `daemon/breakdown.ts`'s `fromDefaultBranch` and is not listed here. That
  // is not a hole: a file calling into a git-performing module still has to
  // hand it a path under `projects/`, which is what {@link EXEMPT} catches.
  "git.ts":
    "The module itself. Since 30c it has no machine caller: everything left " +
    "in it belongs to `workspace sync`, and 30l deletes `mergeIntoDefault`.",
  "commands/workspace.ts": "Clones and fast-forwards, on fvermaut's command.",
  "daemon/hooks.ts":
    "The R15 bracket's local, read-only reads. See its entry above.",
  "adapters/docker-preview.ts":
    "Worktrees for previews, on the host. See its entry above.",
  "daemon/breakdown.ts":
    "`fromDefaultBranch`, the on-disk source `timone status` builds. The " +
    "machine's source is `fromForgeDefaultBranch`, in this same file, and it " +
    "reaches no disk.",
  "commands/daemon.ts":
    "Asks whether the commit the daemon is standing on is on the remote, " +
    "before starting a boxed run that could not follow it (30k). The " +
    "**timone** checkout, offline, read-only — never a project's.",
  "daemon/session.ts":
    "Reads the **timone** checkout — which version of Timone is running, and " +
    "what in it is uncommitted (ADR-0041 D2, phase 30's 30f). Never a " +
    "project's: this file resolves no path under `projects/` at all any more.",
};

/** Every `.ts` file under `src`, excluding tests, as paths relative to `src`. */
function sourceFiles(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) return [];
    return [relative(SRC, full)];
  });
}

/**
 * Whether `text` performs a git operation, by any of the routes this codebase
 * has.
 *
 * **Importing `src/git.ts` counts**, and that was a hole in the first version
 * of this guard: every export of that module shells out, so a file that
 * imports one has performed a git operation as surely as one that spells
 * `execFile("git", …)`. Without this line `commands/workspace.ts` — which
 * clones and fast-forwards every checkout there is — read as innocent.
 */
function spawnsGit(text: string): boolean {
  return [
    /execFileAsync\(\s*"git"/,
    /execFileSync\(\s*"git"/,
    /execFile\(\s*"git"/,
    /\.run\(\s*"git"/,
    /spawn\(\s*"git"/,
    /from "\.{1,2}(?:\/\.\.)*\/git\.js"/,
  ].some((pattern) => pattern.test(text));
}

/**
 * Whether `text` builds a filesystem path under `projects/`.
 *
 * Matched as a **path segment**, not as the word: `commands/projects.ts`
 * registers a CLI subcommand called `projects` and reaches into nothing, and
 * a guard that flagged it would be a guard somebody switches off.
 */
function reachesIntoCheckouts(text: string): boolean {
  return (
    /join\([^)]*["']projects["']/.test(text) ||
    /["'`][^"'`]*\/projects\//.test(text) ||
    /projects\/\$\{/.test(text) ||
    // A manifest entry's `path` is required to start with `projects/`, so
    // resolving one is reaching into a checkout by another spelling —
    // whichever of node's two path functions does it.
    /(?:join|resolve)\([^)]*\.path\b/.test(text)
  );
}

/** Every source file, with what it was found doing. */
function survey(): { file: string; git: boolean; checkout: boolean }[] {
  return sourceFiles().map((file) => {
    const text = readFileSync(join(SRC, file), "utf8");
    return { file, git: spawnsGit(text), checkout: reachesIntoCheckouts(text) };
  });
}

describe("the human's checkout is his alone", () => {
  it("performs git only where somebody said so, and said what on", () => {
    const offenders = survey()
      .filter((entry) => entry.git)
      .map((entry) => entry.file)
      .filter((file) => !(file in GIT_USERS));

    expect(offenders).toEqual([]);
  });

  it("has no file that both resolves a project path and performs git on it", () => {
    // The plan's own wording, asserted directly. The two lists above are
    // narrow separately; this is the pair of them at once, and it is the
    // sentence R23's second clause actually makes true.
    const offenders = survey()
      .filter((entry) => entry.git && entry.checkout)
      .map((entry) => entry.file)
      .filter((file) => !(file in EXEMPT));

    expect(offenders).toEqual([]);
  });

  it("has no machine code path that resolves a path under projects/", () => {
    const offenders = survey()
      .filter((entry) => entry.checkout)
      .map((entry) => entry.file)
      .filter((file) => !(file in EXEMPT) && file !== "manifest.ts");

    // `manifest.ts` names the string in an error-message helper — it walks a
    // zod issue path whose first element happens to be "projects". It builds
    // no filesystem path and spawns nothing.
    expect(offenders).toEqual([]);
  });

  it("catches a git call reintroduced into the daemon", () => {
    // Case (1), demonstrated rather than asserted: the guard is shown working
    // on text that actually contains the thing it forbids. A guard nobody has
    // watched catch anything is a guard that might match nothing at all.
    const reintroduced = `
      import { execFile } from "node:child_process";
      const dir = join(root, "projects", project.name);
      await execFileAsync("git", ["rev-parse", "--verify", branch], { cwd: dir });
    `;

    expect(spawnsGit(reintroduced)).toBe(true);
    expect(reachesIntoCheckouts(reintroduced)).toBe(true);
  });

  it("does not fire on code that merely mentions a project", () => {
    const innocent = `
      const project = { name: "scratch-app", repoUrl: config.repo_url };
      await adapter.readBranches(project, branch);
    `;

    expect(spawnsGit(innocent)).toBe(false);
    expect(reachesIntoCheckouts(innocent)).toBe(false);
  });

  it("names every exemption, so a further door cannot be opened quietly", () => {
    // The narrowness case. Adding a caller does not slip through: it slips
    // *into one of these lists*, where the next reader sees it and has to
    // agree with the reason written beside it.
    const files = sourceFiles();
    for (const list of [EXEMPT, GIT_USERS]) {
      for (const [file, reason] of Object.entries(list)) {
        expect(reason.length).toBeGreaterThan(40);
        expect(files).toContain(file);
      }
    }
  });

  it("has no exemption for a file that has stopped needing one", () => {
    // An exemption outliving its reason is how a list of four becomes a list
    // of nine that nobody reads. Every name here must still be doing the
    // thing it was excused for.
    const found = survey();
    for (const file of Object.keys(EXEMPT)) {
      const entry = found.find((candidate) => candidate.file === file);
      expect(entry, `${file} is exempt but is not a source file`).toBeDefined();
      expect(
        entry!.checkout,
        `${file} is exempt but resolves no project path — delete its exemption`,
      ).toBe(true);
    }
    for (const file of Object.keys(GIT_USERS)) {
      const entry = found.find((candidate) => candidate.file === file);
      expect(entry, `${file} is listed but is not a source file`).toBeDefined();
      expect(
        entry!.git,
        `${file} is listed as a git user but performs no git — delete its entry`,
      ).toBe(true);
    }
  });
});
