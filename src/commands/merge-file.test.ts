import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Command } from "commander";

import { registerMergeFileCommand } from "./merge-file.js";

/**
 * `timone merge-file <kind> <base> <current> <other> [path]` as git runs it:
 * three files on disk, the merged text written into `<current>`, the exit
 * code and stderr read back.
 */

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  // The action reports failure by setting this rather than throwing.
  process.exitCode = undefined;
});

/** Write the three versions of one file into a fresh temporary directory. */
function threeFiles(sides: { base: string; current: string; other: string }) {
  const dir = mkdtempSync(join(tmpdir(), "timone-merge-file-"));
  tempDirs.push(dir);
  const paths = { base: join(dir, "base"), current: join(dir, "current"), other: join(dir, "other") };
  writeFileSync(paths.base, sides.base);
  writeFileSync(paths.current, sides.current);
  writeFileSync(paths.other, sides.other);
  return paths;
}

/** Run `timone merge-file …` as the CLI would, capturing what it printed. */
async function mergeFileCommand(
  ...args: string[]
): Promise<{ out: string[]; errors: string[]; exitCode: number | undefined }> {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerMergeFileCommand(program);

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
    await program.parseAsync(["merge-file", ...args], { from: "user" });
  } finally {
    console.log = realLog;
    console.error = realError;
  }
  const code = process.exitCode;
  return { out, errors, exitCode: typeof code === "number" ? code : undefined };
}

const R2_HEAD = "## R2 — Second\n\n- **Priority:** MUST\n- **Status:** draft\n";

describe("timone merge-file", () => {
  it("exits 1 and names the path and R15 when both sides add an R15", async () => {
    const files = threeFiles({
      base: R2_HEAD,
      current: R2_HEAD + "\n## R15 — Built here\n\n- **Priority:** MUST\n- **Status:** draft\n",
      other: R2_HEAD + "\n## R15 — Merged there\n\n- **Priority:** SHOULD\n- **Status:** verified\n",
    });

    const result = await mergeFileCommand(
      "register", files.base, files.current, files.other, "doc/specs/prd/x.criteria.md",
    );

    expect(result).toEqual({
      out: [],
      errors: [
        "doc/specs/prd/x.criteria.md: R15 is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose.",
      ],
      exitCode: 1,
    });
  });

  it("exits 0 and leaves the merged text in <current> when the three merge cleanly", async () => {
    const files = threeFiles({
      base: "# Status\n\n**1. First.** One.\n\n**2. Second.** Two.\n",
      current: "# Status\n\n**1. First.** One, changed here.\n\n**2. Second.** Two.\n",
      other: "# Status\n\n**1. First.** One.\n\n**2. Second.** Two, changed there.\n",
    });

    const result = await mergeFileCommand("status", files.base, files.current, files.other);

    expect(result).toEqual({ out: [], errors: [], exitCode: undefined });
    expect(readFileSync(files.current, "utf8")).toBe(
      "# Status\n\n**1. First.** One, changed here.\n\n**2. Second.** Two, changed there.\n",
    );
  });

  it("exits 2 with one sentence naming the kinds, and writes nothing, for a kind it does not know", async () => {
    const files = threeFiles({ base: "base\n", current: "current\n", other: "other\n" });

    const result = await mergeFileCommand("chapter", files.base, files.current, files.other);

    expect(result).toEqual({
      out: [],
      errors: ['"chapter" is not a kind of file this merge knows; the kinds are: status, register.'],
      exitCode: 2,
    });
    expect([files.base, files.current, files.other].map((path) => readFileSync(path, "utf8"))).toEqual([
      "base\n",
      "current\n",
      "other\n",
    ]);
  });
});
