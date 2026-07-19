import { existsSync, writeFileSync } from "node:fs";
import type { Command } from "commander";
import {
  addProject,
  loadManifest,
  serializeManifest,
  updateProject,
  type Manifest,
  type ProjectConfig,
  type ProjectPatch,
} from "../manifest.js";

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

/**
 * Split a `--stack` flag value on commas, trimming each entry. An
 * empty/whitespace-only string yields an empty array rather than `[""]`.
 */
function parseStack(raw: string): string[] {
  const trimmed = raw.trim();
  return trimmed === "" ? [] : trimmed.split(",").map((entry) => entry.trim());
}

/** Options accepted by `projects add`, as commander parses them. */
interface AddOptions {
  repo: string;
  path: string;
  stack: string;
  ticketing: string;
  preview?: string;
  manifest: string;
}

/** Options accepted by `projects update`, as commander parses them. */
interface UpdateOptions {
  repo?: string;
  path?: string;
  stack?: string;
  ticketing?: string;
  preview?: string;
  manifest: string;
}

/**
 * Translate `projects update` flags into a {@link ProjectPatch}, or
 * `undefined` when no field flag was passed at all.
 */
function buildPatch(options: UpdateOptions): ProjectPatch | undefined {
  const bindings = {
    ...(options.ticketing !== undefined
      ? { ticketing: options.ticketing }
      : {}),
    ...(options.preview !== undefined ? { preview: options.preview } : {}),
  } as Partial<ProjectConfig["bindings"]>;

  const patch: ProjectPatch = {
    ...(options.repo !== undefined ? { repo_url: options.repo } : {}),
    ...(options.path !== undefined ? { path: options.path } : {}),
    ...(options.stack !== undefined ? { stack: parseStack(options.stack) } : {}),
    ...(Object.keys(bindings).length > 0 ? { bindings } : {}),
  };

  return Object.keys(patch).length > 0 ? patch : undefined;
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

  projects
    .command("add")
    .description("Add a project to the manifest")
    .argument("<name>", "project name")
    .requiredOption("--repo <url>", "git repository URL")
    .requiredOption(
      "--path <path>",
      'local checkout path (must start with "projects/")',
    )
    .requiredOption("--stack <list>", "comma-separated technology tags")
    .requiredOption("--ticketing <backend>", "ticketing backend")
    .option("--preview <backend>", "preview-environment backend")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .action((name: string, options: AddOptions) => {
      let manifest: Manifest;
      try {
        manifest = existsSync(options.manifest)
          ? loadManifest(options.manifest)
          : { projects: {} };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }

      const bindings = {
        ticketing: options.ticketing,
        ...(options.preview !== undefined ? { preview: options.preview } : {}),
      } as ProjectConfig["bindings"];

      const entry: ProjectConfig = {
        repo_url: options.repo,
        path: options.path,
        stack: parseStack(options.stack),
        bindings,
      };

      let updated: Manifest;
      try {
        updated = addProject(manifest, name, entry);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }

      try {
        writeFileSync(options.manifest, serializeManifest(updated), "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }

      console.log(`Added project "${name}" to ${options.manifest}`);
    });

  projects
    .command("update")
    .description("Correct fields of an existing project in the manifest")
    .argument("<name>", "project name")
    .option("--repo <url>", "git repository URL")
    .option("--path <path>", 'local checkout path (must start with "projects/")')
    .option("--stack <list>", "comma-separated technology tags")
    .option("--ticketing <backend>", "ticketing backend")
    .option("--preview <backend>", "preview-environment backend")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .action((name: string, options: UpdateOptions) => {
      const patch = buildPatch(options);
      if (patch === undefined) {
        console.error(
          "Nothing to update: pass at least one of --repo, --path, --stack, --ticketing, --preview",
        );
        process.exitCode = 1;
        return;
      }

      let updated: Manifest;
      try {
        const manifest = loadManifest(options.manifest);
        updated = updateProject(manifest, name, patch);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }

      try {
        writeFileSync(options.manifest, serializeManifest(updated), "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }

      console.log(`Updated project "${name}" in ${options.manifest}`);
    });
}
