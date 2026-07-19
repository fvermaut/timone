import { existsSync } from "node:fs";
import type { Command } from "commander";
import { loadManifest, type Manifest } from "../manifest.js";

/** Column headers of the `projects list` table, in display order. */
const HEADERS = [
  "NAME",
  "PATH",
  "STACK",
  "TICKETING",
  "PREVIEW",
  "CLONED",
] as const;

/** Build the table rows (without headers) for the given manifest. */
function projectRows(manifest: Manifest): string[][] {
  return Object.entries(manifest.projects).map(([name, project]) => [
    name,
    project.path,
    project.stack.length > 0 ? project.stack.join(",") : "-",
    project.bindings.ticketing,
    project.bindings.preview ?? "-",
    existsSync(project.path) ? "yes" : "no",
  ]);
}

/**
 * Render rows as an aligned plain-text table: each column padded with spaces
 * to the width of its widest cell, columns separated by two spaces.
 */
function renderTable(rows: string[][]): string {
  const widths = HEADERS.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column].length)),
  );
  const renderRow = (row: readonly string[]): string =>
    row
      .map((cell, column) => cell.padEnd(widths[column]))
      .join("  ")
      .trimEnd();
  return [renderRow(HEADERS), ...rows.map(renderRow)].join("\n");
}

/** Register the `projects` command group (with `list`) on the program. */
export function registerProjectsCommand(program: Command): void {
  const projects = program
    .command("projects")
    .description("Manage the projects declared in the manifest");

  projects
    .command("list")
    .description("List the projects declared in the manifest")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .action((options: { manifest: string }) => {
      let manifest: Manifest;
      try {
        manifest = loadManifest(options.manifest);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }
      console.log(renderTable(projectRows(manifest)));
    });
}
