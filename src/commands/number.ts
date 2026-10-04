import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { isNumberKind, NUMBER_KINDS, reserveNumber } from "../numbers.js";

/**
 * Register `number <project> <kind>`: reserve the next number of a kind of
 * numbered file for a project, and print it. A session asks this before it
 * names a new phase, ADR, triage record or PRD, so that two sessions working
 * at the same time never take the same number.
 */
export function registerNumberCommand(program: Command): void {
  program
    .command("number")
    .description(
      "Reserve the next number for a new numbered file of a project, and print it",
    )
    .argument("<project>", "the project, as named in the manifest")
    .argument("<kind>", "phase, adr, triage or prd")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .action(
      async (project: string, kind: string, options: { manifest: string }) => {
        // Checked first: it needs nothing, and a wrong kind must not reach git.
        if (!isNumberKind(kind)) {
          console.error(
            `"${kind}" is not a kind of numbered file; the kinds are: ${NUMBER_KINDS.join(", ")}.`,
          );
          process.exitCode = 1;
          return;
        }

        let manifest: Manifest;
        try {
          manifest = loadManifest(options.manifest);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(message);
          process.exitCode = 1;
          return;
        }

        const config = manifest.projects[project];
        if (config === undefined) {
          const known = Object.keys(manifest.projects).join(", ") || "none";
          console.error(
            `I don't know a project called "${project}"; the projects I know are: ${known}.`,
          );
          process.exitCode = 1;
          return;
        }

        const cwd = process.cwd();
        const dir = resolve(cwd, config.path);
        let reserved: string;
        try {
          reserved = await reserveNumber(dir, kind);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(message);
          process.exitCode = 1;
          return;
        }
        console.log(reserved);
      },
    );
}
