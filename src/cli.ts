#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";

import { registerDaemonCommand } from "./commands/daemon.js";
import { registerGuardrailsCommand } from "./commands/guardrails.js";
import { registerProjectsCommand } from "./commands/projects.js";
import { registerRetryCommand } from "./commands/retry.js";
import { registerStatusCommand } from "./commands/status.js";
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
  registerTakeoverCommand(program);
  registerRetryCommand(program);

  return program;
}

await buildProgram().parseAsync(process.argv);
