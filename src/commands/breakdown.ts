import { resolve } from "node:path";
import type { Command } from "commander";

import {
  breakdownPath,
  checkOrderLine,
  fromWorkingTree,
} from "../daemon/breakdown.js";
import { loadManifest, type Manifest } from "../manifest.js";

/**
 * Register `breakdown <project> <ticket>`: print the order a ticket's list of
 * pieces is built in, in plain words, or refuse a list whose `**Order:**` line
 * says another order than its `Needs:` lines.
 *
 * A session runs this after it writes a list and before it commits it, so the
 * order a person reads is the order the step tickets will follow.
 */
export function registerBreakdownCommand(program: Command): void {
  program
    .command("breakdown")
    .description(
      "Print the order a ticket's list of pieces is built in, or say why its Order: line is wrong",
    )
    .argument("<project>", "the project, as named in the manifest")
    .argument("<ticket>", "the number of the ticket the list belongs to")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .action((project: string, ticket: string, options: { manifest: string }) => {
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

      // The working tree, not the default branch: the session owns this
      // checkout and has just written the list on its own branch.
      const path = breakdownPath(Number(ticket));
      const text = fromWorkingTree(resolve(process.cwd(), config.path))(path);
      if (text === undefined) {
        console.error(
          `Ticket ${ticket} of ${project} has no list of pieces: there is no file ${path} in ${config.path}.`,
        );
        process.exitCode = 1;
        return;
      }

      const check = checkOrderLine(text);
      if (check.kind === "problem") {
        console.error(check.problem);
        process.exitCode = 1;
        return;
      }
      console.log(check.words);
    });
}
