import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest } from "../manifest.js";
import { mergeConflicts, type MergeConflicts, type RunGit } from "../update-checks.js";

/**
 * `timone update-conflicts <project> [--json]` — during an update's merge,
 * say which files the merge left in conflict: the check scripts, which the
 * update session joins itself, and every other file, which goes to the fix
 * context ([ADR-0068](../../doc/adr/0068-the-update-joins-a-conflict-in-a-check-script-itself-and-a-merge-it-could-not-finish-is-a-step-that-failed.md)
 * D1).
 *
 * It exits 2 with one sentence when the project is unknown, when no merge is
 * in progress in its checkout, or when git fails.
 */
export function registerUpdateConflictsCommand(program: Command): void {
  program
    .command("update-conflicts")
    .description("Say which files the update's merge left in conflict, check scripts apart")
    .argument("<project>", "the project, as named in the manifest")
    .option("--json", "print the answer as JSON")
    .option("--manifest <path>", "path to the timone manifest file", "timone.yaml")
    .action((project: string, options: { json?: boolean; manifest: string }) => {
      try {
        const manifest = loadManifest(options.manifest);
        const config = manifest.projects[project];
        if (config === undefined) {
          const known = Object.keys(manifest.projects).join(", ") || "none";
          throw new Error(
            `I don't know a project called "${project}"; the projects I know are: ${known}.`,
          );
        }
        const dir = resolve(process.cwd(), config.path);
        if (!existsSync(dir)) {
          throw new Error(`The project "${project}" is not checked out at ${dir}.`);
        }
        if (!mergeInProgress(dir)) {
          throw new Error(`No merge is in progress in ${project}: there is nothing to join.`);
        }
        const conflicts = mergeConflicts(gitIn(dir));
        console.log(options.json === true ? JSON.stringify(conflicts, null, 2) : plainText(conflicts));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 2;
      }
    });
}

/** Whether a merge is in progress in `dir`: git knows a `MERGE_HEAD`. */
function mergeInProgress(dir: string): boolean {
  return spawnSync("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"], { cwd: dir }).status === 0;
}

/** The port `mergeConflicts` takes: git run in `dir`, throwing a sentence that names the command when it fails. */
function gitIn(dir: string): RunGit {
  return (args) => {
    try {
      return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const said =
        error instanceof Error && "stderr" in error && typeof error.stderr === "string"
          ? error.stderr.trim()
          : String(error);
      throw new Error(`\`git ${args.join(" ")}\` failed in ${dir}: ${said}`);
    }
  };
}

/** The two lists as a person reads them, each under its heading, with "none" under an empty one. */
function plainText(conflicts: MergeConflicts): string {
  const list = (items: string[]) => (items.length === 0 ? ["none"] : items.map((item) => `- ${item}`));
  return [
    "Check scripts left in conflict — join these yourself, keeping every check from both sides:",
    ...list(conflicts.checkScripts.map((script) => `${script.id ?? "(no requirement)"}: ${script.path}`)),
    "Other files left in conflict — give these to the fix context:",
    ...list(conflicts.others),
  ].join("\n");
}
