import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Command } from "commander";

import { registerBreakdownCommand } from "./breakdown.js";

/**
 * `timone breakdown <project> <ticket>` as a session types it: from a folder
 * holding a `timone.yaml` whose project sits under `projects/`, with the list
 * of pieces written in that folder. What a test looks at is what a session
 * sees — the printed words, the sentences, the exit code.
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
 * PRD-07 R10's own example, 2 and 3 needing 1 and 4 needing 2 and 3, with
 * `order` as its `**Order:**` line.
 */
function r10(order: string): string {
  return [
    "# Breakdown",
    "",
    "**Status:** Awaiting approval",
    "",
    "1. **One** — the first piece.",
    "   - Needs: nothing.",
    "2. **Two** — the second piece.",
    "   - Needs: piece 1.",
    "3. **Three** — the third piece.",
    "   - Needs: piece 1.",
    "4. **Four** — the fourth piece.",
    "   - Needs: pieces 2 and 3.",
    "",
    order,
    "",
  ].join("\n");
}

/**
 * A timone root holding {@link MANIFEST} and a folder for `app` at
 * `projects/app`, with `list` written as ticket 7's list of pieces when given.
 * The test's working folder becomes that root, as a session's is.
 */
function timoneRoot(list?: string): void {
  const root = mkdtempSync(join(tmpdir(), "timone-breakdown-cmd-"));
  tempDirs.push(root);
  writeFileSync(join(root, "timone.yaml"), MANIFEST, "utf8");
  const breakdowns = join(root, "projects", "app", "doc", "plans", "breakdowns");
  mkdirSync(breakdowns, { recursive: true });
  if (list !== undefined) {
    writeFileSync(join(breakdowns, "ticket-07.md"), list, "utf8");
  }
  process.chdir(root);
}

/** Run `timone breakdown …` as the CLI would, capturing what it printed. */
async function breakdown(
  ...args: string[]
): Promise<{ out: string[]; errors: string[]; exitCode: number | undefined }> {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerBreakdownCommand(program);

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
    await program.parseAsync(["breakdown", ...args], { from: "user" });
  } finally {
    console.log = realLog;
    console.error = realError;
  }
  const code = process.exitCode;
  return { out, errors, exitCode: typeof code === "number" ? code : undefined };
}

describe("timone breakdown", () => {
  it("prints the order in words, and exits 0, when the Order: line says it", async () => {
    timoneRoot(r10("**Order:** 1, then 2 and 3 together, then 4."));

    const result = await breakdown("app", "7");

    expect(result).toEqual({
      out: ["1, then 2 and 3 together, then 4."],
      errors: [],
      exitCode: undefined,
    });
  });

  it("prints the problem on stderr, nothing on stdout, and exits 1, when the Order: line says another order", async () => {
    timoneRoot(r10("**Order:** 1, then 2, then 3, then 4."));

    const result = await breakdown("app", "7");

    expect(result).toEqual({
      out: [],
      errors: [
        'The **Order:** line says "1, then 2, then 3, then 4.", but the Needs: lines say ' +
          '"1, then 2 and 3 together, then 4.". ' +
          "Change the line to: **Order:** 1, then 2 and 3 together, then 4.",
      ],
      exitCode: 1,
    });
  });

  it("names the projects it knows, and exits 1, for a project it does not know", async () => {
    timoneRoot(r10("**Order:** 1, then 2 and 3 together, then 4."));

    const result = await breakdown("nosuchproject", "7");

    expect(result).toEqual({
      out: [],
      errors: ['I don\'t know a project called "nosuchproject"; the projects I know are: app.'],
      exitCode: 1,
    });
  });

  it("says there is no list, and exits 1, for a ticket that has none", async () => {
    timoneRoot();

    const result = await breakdown("app", "7");

    expect(result).toEqual({
      out: [],
      errors: [
        "Ticket 7 of app has no list of pieces: there is no file " +
          "doc/plans/breakdowns/ticket-07.md in projects/app.",
      ],
      exitCode: 1,
    });
  });
});
