import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Command } from "commander";

import { loadManifest } from "../manifest.js";
import { registerProjectsCommand } from "./projects.js";

/**
 * Phase 20e's flag pair, at the seam ADR-0008 puts every manifest write
 * through: the command itself, parsed as a user types it, writing a real file
 * that `loadManifest` then reads back. Asserting on the file rather than on an
 * options object is the point — the ADR's whole claim is that there is *one*
 * validated path from a flag to the YAML on disk, and a test that stopped at
 * the parsed options would not have crossed it.
 */

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  // The action handlers report failure by setting this rather than throwing,
  // so a test that provoked one would otherwise fail the *next* test's reading
  // of it — and, at the end of the run, the whole process.
  process.exitCode = undefined;
});

/** A path in a fresh temp dir; the file is written only if `body` is given. */
function manifestPath(body?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-projects-cmd-"));
  tempDirs.push(dir);
  const file = join(dir, "timone.yaml");
  if (body !== undefined) writeFileSync(file, body, "utf8");
  return file;
}

/**
 * Run `timone projects …` as the CLI would, capturing what it printed.
 * Commander's own exits are overridden so a usage error is a thrown value
 * rather than a killed test process.
 */
async function projects(
  ...args: string[]
): Promise<{ out: string[]; errors: string[] }> {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerProjectsCommand(program);

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
    await program.parseAsync(["projects", ...args], { from: "user" });
  } finally {
    console.log = realLog;
    console.error = realError;
  }
  return { out, errors };
}

const registered = `
projects:
  scratch-app:
    repo_url: git@github.com:fvermaut/scratch-app.git
    path: projects/scratch-app
    stack:
      - typescript
    bindings:
      ticketing: github
      preview: docker
`;

describe("projects add — the introduction switch", () => {
  it("registers a project that has asked to introduce itself", async () => {
    const file = manifestPath();

    await projects(
      "add",
      "chatty-app",
      "--repo",
      "git@github.com:fvermaut/chatty-app.git",
      "--path",
      "projects/chatty-app",
      "--stack",
      "typescript",
      "--ticketing",
      "github",
      "--introduce-unmarked",
      "--manifest",
      file,
    );

    expect(
      loadManifest(file).projects["chatty-app"]!.introduce_unmarked,
    ).toBe(true);
  });

  it("writes no switch at all when nobody passed the flag", async () => {
    // ADR-0024's default reaching the file: a project registered without an
    // answer must carry no opinion, not a written-down `false`. The YAML is
    // read as text because that is where the difference between the two lives
    // — both parse to a project that stays silent, and only one of them is a
    // statement somebody made.
    const file = manifestPath();

    await projects(
      "add",
      "quiet-app",
      "--repo",
      "git@github.com:fvermaut/quiet-app.git",
      "--path",
      "projects/quiet-app",
      "--stack",
      "",
      "--ticketing",
      "github",
      "--manifest",
      file,
    );

    expect(readFileSync(file, "utf8")).not.toContain("introduce_unmarked");
    expect(
      loadManifest(file).projects["quiet-app"]!.introduce_unmarked,
    ).toBeUndefined();
  });

  it("records an explicit no as an explicit no", async () => {
    // The answer a human gave at onboarding, kept. It behaves exactly as the
    // absent key does; what it adds is that somebody was asked.
    const file = manifestPath();

    await projects(
      "add",
      "quiet-app",
      "--repo",
      "git@github.com:fvermaut/quiet-app.git",
      "--path",
      "projects/quiet-app",
      "--stack",
      "",
      "--ticketing",
      "github",
      "--no-introduce-unmarked",
      "--manifest",
      file,
    );

    expect(loadManifest(file).projects["quiet-app"]!.introduce_unmarked).toBe(
      false,
    );
  });
});

describe("projects update — the introduction switch", () => {
  it("turns the switch on without disturbing a single other field", async () => {
    const file = manifestPath(registered);

    await projects(
      "update",
      "scratch-app",
      "--introduce-unmarked",
      "--manifest",
      file,
    );

    expect(loadManifest(file).projects["scratch-app"]).toEqual({
      repo_url: "git@github.com:fvermaut/scratch-app.git",
      path: "projects/scratch-app",
      stack: ["typescript"],
      introduce_unmarked: true,
      bindings: { ticketing: "github", preview: "docker" },
    });
  });

  it("turns it off again", async () => {
    const file = manifestPath(registered);

    await projects(
      "update",
      "scratch-app",
      "--introduce-unmarked",
      "--manifest",
      file,
    );
    await projects(
      "update",
      "scratch-app",
      "--no-introduce-unmarked",
      "--manifest",
      file,
    );

    expect(loadManifest(file).projects["scratch-app"]!.introduce_unmarked).toBe(
      false,
    );
  });

  it("is a reason to update on its own, and the refusal says so", async () => {
    // `buildPatch` returns undefined when no field flag was passed, and the
    // command refuses. A switch it did not know about would fall into that
    // hole — the command would answer "nothing to update" to somebody who had
    // just asked for something — so both halves are asserted: the flag alone
    // works, and the refusal's list of flags names it.
    const file = manifestPath(registered);

    const asked = await projects(
      "update",
      "scratch-app",
      "--introduce-unmarked",
      "--manifest",
      file,
    );
    expect(asked.errors).toEqual([]);
    expect(process.exitCode).not.toBe(1);

    const askedNothing = await projects(
      "update",
      "scratch-app",
      "--manifest",
      file,
    );
    expect(askedNothing.errors[0]).toContain("Nothing to update");
    expect(askedNothing.errors[0]).toContain("--introduce-unmarked");
  });
});
