import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest, type ProjectConfig } from "../manifest.js";
import {
  clone,
  currentBranch,
  defaultBranch,
  fastForward,
  fetch,
  isClean,
  isGitRepo,
} from "../git.js";

/** Outcome of syncing one manifest project. */
export interface SyncEntry {
  name: string;
  /** Human-readable status, e.g. "cloned", "skipped (dirty)". */
  status: string;
  /** True when the project could not be synced (counts toward exit code 1). */
  failed: boolean;
}

/**
 * Reduce an error to a single readable line, preferring git's own
 * "fatal:"/"error:" line when present.
 */
function oneLineReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return (
    lines.find(
      (line) => line.startsWith("fatal:") || line.startsWith("error:"),
    ) ??
    lines[0] ??
    "unknown error"
  );
}

/** Sync a single project checkout; never throws. */
async function syncProject(
  name: string,
  project: ProjectConfig,
  cwd: string,
): Promise<SyncEntry> {
  const dir = resolve(cwd, project.path);
  try {
    if (!existsSync(dir)) {
      await clone(project.repo_url, dir);
      return { name, status: "cloned", failed: false };
    }
    if (!(await isGitRepo(dir))) {
      return { name, status: "failed (not a git repository)", failed: true };
    }
    if (!(await isClean(dir))) {
      return { name, status: "skipped (dirty)", failed: false };
    }
    const branch = await currentBranch(dir);
    const wanted = await defaultBranch(dir);
    if (branch !== wanted) {
      return { name, status: `skipped (on branch ${branch})`, failed: false };
    }
    await fetch(dir);
    const { updated } = await fastForward(dir);
    return { name, status: updated ? "updated" : "up-to-date", failed: false };
  } catch (error) {
    return { name, status: `failed (${oneLineReason(error)})`, failed: true };
  }
}

/**
 * Sync every project of the manifest, in declaration order, resolving each
 * project path against `cwd`. Individual failures are reported in the
 * returned entries; this function itself does not throw on git errors.
 */
export async function syncWorkspace(
  manifest: Manifest,
  cwd: string,
): Promise<SyncEntry[]> {
  const entries: SyncEntry[] = [];
  for (const [name, project] of Object.entries(manifest.projects)) {
    entries.push(await syncProject(name, project, cwd));
  }
  return entries;
}

/** Register the `workspace` command group (with `sync`) on the program. */
export function registerWorkspaceCommand(program: Command): void {
  const workspace = program
    .command("workspace")
    .description("Manage the local checkouts of the manifest projects");

  workspace
    .command("sync")
    .description("Clone missing projects and fast-forward clean checkouts")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .action(async (options: { manifest: string }) => {
      let manifest: Manifest;
      try {
        manifest = loadManifest(options.manifest);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
        return;
      }

      const entries = await syncWorkspace(manifest, process.cwd());
      for (const entry of entries) {
        console.log(`${entry.name}  ${entry.status}`);
      }
      if (entries.some((entry) => entry.failed)) {
        process.exitCode = 1;
      }
    });
}
