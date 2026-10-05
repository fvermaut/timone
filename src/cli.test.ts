import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The command line as it ships: the built `dist/cli.js`, run by node. The
 * build comes before the tests (`npm run build && npm test`), so this is the
 * file a person runs.
 */
const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Run the built command line in an empty directory, so no command can read
 * this repository's manifest or its ledger.
 */
function timone(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const cwd = mkdtempSync(join(tmpdir(), "timone-cli-"));
  tempDirs.push(cwd);
  const ran = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return { status: ran.status, stdout: ran.stdout, stderr: ran.stderr };
}

describe("the removed retry command", () => {
  it.each([
    "retry scratch-app#1",
    "retry",
    "retry scratch-app#1 --state elsewhere.json",
    "retry --help",
    // Commander answers `help <command>` itself, by printing that command's
    // help, so this way in needs its own case.
    "help retry",
  ])("exits 1 and sends the person to the ticket: `timone %s`", (line) => {
    const ran = timone(...line.split(" "));

    expect(ran.status).toBe(1);
    expect(ran.stderr).toBe(
      "`timone retry` was removed. Write on the ticket instead: say what you want done.\n",
    );
    expect(ran.stdout).toBe("");
  });

  it("is not listed in the help", () => {
    const ran = timone("--help");

    expect(ran.status).toBe(0);
    // The list of commands is there, so its missing line is not a missing list.
    expect(ran.stdout).toContain("cancel [options] <ticket>");
    expect(ran.stdout).not.toMatch(/\bretry\b/);
  });
});

describe("update-checks", () => {
  it("exits 2 on an unknown project, with a sentence naming the projects it knows", () => {
    const cwd = mkdtempSync(join(tmpdir(), "timone-cli-"));
    tempDirs.push(cwd);
    writeFileSync(
      join(cwd, "timone.yaml"),
      `projects:
  app:
    repo_url: https://example.invalid/app.git
    path: projects/app
    stack: [typescript]
    bindings:
      ticketing: github
  site:
    repo_url: https://example.invalid/site.git
    path: projects/site
    stack: [typescript]
    bindings:
      ticketing: github
`,
    );

    const ran = spawnSync(process.execPath, [CLI, "update-checks", "no-such-project"], { cwd, encoding: "utf8" });

    expect(ran.status).toBe(2);
    expect(ran.stderr).toBe(
      'I don\'t know a project called "no-such-project"; the projects I know are: app, site.\n',
    );
    expect(ran.stdout).toBe("");
  });
});
