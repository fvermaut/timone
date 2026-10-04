#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";

import { registerCancelCommand } from "./commands/cancel.js";
import { registerDaemonCommand } from "./commands/daemon.js";
import { registerGuardrailsCommand } from "./commands/guardrails.js";
import { registerNumberCommand } from "./commands/number.js";
import { registerProjectsCommand } from "./commands/projects.js";
import { registerRecordCommand } from "./commands/record.js";
import { registerStageCommand } from "./commands/stage.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerTranscriptCommand } from "./commands/transcript.js";
import { registerTakeoverCommand } from "./commands/takeover.js";
import { registerWorkspaceCommand } from "./commands/workspace.js";

/**
 * Read the package version at runtime. Works both from source (src/cli.ts,
 * via tsx) and from the build output (dist/cli.js): in either case
 * package.json sits one directory above this file.
 */
function packageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(
    readFileSync(join(here, "..", "package.json"), "utf8"),
  ) as { version: string };
  return pkg.version;
}

/**
 * What `timone retry` says since it was removed. The runner reads the ticket
 * each time it wakes, so writing there is how to ask it for anything
 * ([ADR-0060](../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
 * D6).
 */
const RETRY_REMOVED =
  "`timone retry` was removed. Write on the ticket instead: say what you want done.";

/**
 * `timone retry`, kept only to answer a person who still types it. Every way
 * in says {@link RETRY_REMOVED} on stderr and exits 1: with any arguments,
 * with `--help`, and as `timone help retry`.
 *
 * Commander answers `timone help retry` by calling this command's `help()`,
 * which would print a usage line for it and exit 0. So `help()` gives the
 * sentence instead. `--help` is switched off, so it reaches the action like
 * any other argument.
 */
class RemovedRetryCommand extends Command {
  constructor() {
    super("retry");
    this.argument("[anything...]")
      .allowUnknownOption()
      .helpOption(false)
      .action(() => {
        console.error(RETRY_REMOVED);
        process.exitCode = 1;
      });
  }

  override help(): never {
    console.error(RETRY_REMOVED);
    process.exit(1);
  }
}

/**
 * Build the root commander program. Future sub-phases register commands here
 * (e.g. `program.addCommand(makeFooCommand())`) before it is parsed.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("timone")
    .description("Timone — the helm for agentic software development")
    .version(packageVersion());

  registerProjectsCommand(program);
  registerWorkspaceCommand(program);
  registerDaemonCommand(program);
  registerGuardrailsCommand(program);
  registerStatusCommand(program);
  registerTranscriptCommand(program);
  registerRecordCommand(program);
  registerTakeoverCommand(program);
  // Hidden, so the help does not offer it.
  program.addCommand(new RemovedRetryCommand(), { hidden: true });
  registerCancelCommand(program);
  registerStageCommand(program);
  registerNumberCommand(program);

  return program;
}

await buildProgram().parseAsync(process.argv);
