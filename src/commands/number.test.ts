import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Command } from "commander";

import { registerNumberCommand } from "./number.js";

/**
 * `timone number <project> <kind>` as a session types it: from a folder
 * holding a `timone.yaml` whose project is checked out under `projects/`,
 * with a bare repository standing for the forge. What a test looks at is
 * what a session sees — the printed number, the sentences, the exit code.
 */

const tempDirs: string[] = [];
const startedIn = process.cwd();

afterEach(() => {
  process.chdir(startedIn);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  // The action reports failure by setting this rather than throwing, so a
  // test that provoked one would otherwise leak it into the next.
  process.exitCode = undefined;
});

/** Run git in `cwd` and return its stdout. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** A fresh temporary directory, removed after the test. */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-number-cmd-"));
  tempDirs.push(dir);
  return dir;
}

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

/**
 * A timone root holding {@link MANIFEST} and, unless `cloned` is false, a
 * checkout of `app` at `projects/app` cloned from a fresh bare repository.
 * The test's working folder becomes that root, as a session's is.
 */
function timoneRoot(cloned = true): { root: string; checkout: string } {
  const root = tempDir();
  writeFileSync(join(root, "timone.yaml"), MANIFEST, "utf8");
  const checkout = join(root, "projects", "app");
  if (cloned) {
    const remote = join(tempDir(), "app.git");
    git(root, "init", "--quiet", "--bare", "--initial-branch=main", remote);
    const seed = join(tempDir(), "seed");
    git(root, "init", "--quiet", "--initial-branch=main", seed);
    writeFileSync(join(seed, "README.md"), "# app\n", "utf8");
    git(seed, "add", "--all");
    git(seed, "-c", "user.name=T", "-c", "user.email=t@t.invalid", "commit", "--quiet", "-m", "seed");
    git(seed, "push", "--quiet", remote, "main");
    mkdirSync(join(root, "projects"));
    execFileSync("git", ["clone", "--quiet", remote, checkout], { stdio: "ignore" });
    git(checkout, "config", "user.name", "Timone Test");
    git(checkout, "config", "user.email", "test@timone.invalid");
  }
  process.chdir(root);
  return { root, checkout };
}

/** Run `timone number …` as the CLI would, capturing what it printed. */
async function number(
  ...args: string[]
): Promise<{ out: string[]; errors: string[]; exitCode: number | undefined }> {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerNumberCommand(program);

  const out: string[] = [];
  const errors: string[] = [];
  const realLog = console.log;
  const realError = console.error;
  console.log = (message: unknown): void => {
    out.push(String(message));
  };
  console.error = (message: unknown): void => {
    errors.push(String(message));
  };
  try {
    await program.parseAsync(["number", ...args], { from: "user" });
  } finally {
    console.log = realLog;
    console.error = realError;
  }
  const code = process.exitCode;
  return { out, errors, exitCode: typeof code === "number" ? code : undefined };
}

describe("timone number", () => {
  it("prints only the reserved number, padded, and exits 0", async () => {
    timoneRoot();

    const result = await number("app", "phase");

    expect(result).toEqual({ out: ["01"], errors: [], exitCode: undefined });
  });

  it("names the projects it knows, and exits 1, for a project it does not know", async () => {
    timoneRoot();

    const result = await number("nosuchproject", "phase");

    expect(result).toEqual({
      out: [],
      errors: ['I don\'t know a project called "nosuchproject"; the projects I know are: app.'],
      exitCode: 1,
    });
  });

  it("names the kinds, and exits 1, for a kind it does not know, before it looks at the checkout", async () => {
    // No checkout at projects/app: any git command would fail with git's
    // words, so getting the kind sentence shows the kind is checked first.
    timoneRoot(false);

    const result = await number("app", "chapter");

    expect(result).toEqual({
      out: [],
      errors: ['"chapter" is not a kind of numbered file; the kinds are: phase, adr, triage, prd.'],
      exitCode: 1,
    });
  });

  it("prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails", async () => {
    const { checkout } = timoneRoot();
    git(checkout, "remote", "set-url", "origin", join(tempDir(), "gone.git"));

    const result = await number("app", "phase");

    expect(result.out).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("does not appear to be a git repository");
    expect(result.exitCode).toBe(1);
  });
});
