import { readFileSync, writeFileSync } from "node:fs";
import type { Command } from "commander";

import { MERGE_KINDS, isMergeKind, mergeFile } from "../merge-rules.js";

/**
 * `timone merge-file <kind> <base> <current> <other> [path]` — the command
 * git runs as the merge driver for `STATUS.md` and for a register
 * (`installMergeRules` in `merge-rules.ts` switches it on).
 *
 * It writes the merged text into `<current>`, as git asks of a driver, and
 * exits 0 when every part was decided. Git reads any exit above 0 as a
 * conflict in that file, so a part left undecided exits 1 and its sentence
 * goes to stderr, where git shows it.
 */
export function registerMergeFileCommand(program: Command): void {
  program
    .command("merge-file")
    .description("Merge three versions of STATUS.md or a register, as git's merge driver")
    .argument("<kind>", `the kind of file: ${MERGE_KINDS.join(" or ")}`)
    .argument("<base>", "the version both sides started from (git's %O)")
    .argument("<current>", "the work branch's version, overwritten with the result (git's %A)")
    .argument("<other>", "the default branch's version (git's %B)")
    .argument("[path]", "the file's path in the repository, to name it in what is printed (git's %P)")
    .action(
      async (kind: string, base: string, current: string, other: string, path?: string) => {
        if (!isMergeKind(kind)) {
          console.error(
            `"${kind}" is not a kind of file this merge knows; the kinds are: ${MERGE_KINDS.join(", ")}.`,
          );
          process.exitCode = 2;
          return;
        }
        const result = await mergeFile(kind, {
          base: readFileSync(base, "utf8"),
          current: readFileSync(current, "utf8"),
          other: readFileSync(other, "utf8"),
        });
        writeFileSync(current, result.text);
        for (const problem of result.problems) {
          console.error(path === undefined ? problem : `${path}: ${problem}`);
        }
        if (!result.clean) process.exitCode = 1;
      },
    );
}
