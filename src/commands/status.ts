import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";

/** Statuses that mean the project is busy with that ticket. */
const OCCUPYING = ["picked-up", "active", "parked"];

export interface RenderStatusOptions {
  /** False when the daemon has never written a state file. */
  stateExists: boolean;
}

/** What one project's line says after its name. */
function describeProject(project: string, runs: Run[]): string {
  const mine = runs.filter((run) => run.project === project);
  const busy = mine.find((run) => OCCUPYING.includes(run.status));
  const queued = mine.filter((run) => run.status === "queued");

  const parts: string[] = [];

  if (busy === undefined) {
    parts.push("idle");
  } else {
    const stage = busy.stage === undefined ? "" : ` (${busy.stage})`;
    if (busy.status === "parked") {
      parts.push(
        `#${busy.ticket}${stage} — waiting on you: ${busy.waitingOn ?? "an answer"}`,
      );
    } else if (busy.status === "active") {
      parts.push(`#${busy.ticket}${stage} — working on it now`);
    } else {
      parts.push(`#${busy.ticket}${stage} — picked up, about to start`);
    }
    if (busy.flags.length > 0) {
      parts.push(
        `⚠ ${busy.flags.length} automatic check(s) failed — see the ticket`,
      );
    }
  }

  if (queued.length > 0) {
    const numbers = queued.map((run) => `#${run.ticket}`).join(", ");
    parts.push(`${queued.length} queued (${numbers})`);
  }

  return parts.join("  ·  ");
}

/**
 * Every project on one line: the ticket it is working, how far that ticket
 * got, whether it is waiting on the reader, what is queued behind it, and
 * whether the automatic checks complained. Written to be read at a glance
 * by someone who knows nothing about the process (R9).
 */
export function renderStatus(
  manifest: Manifest,
  runs: Run[],
  options: RenderStatusOptions,
): string {
  const names = [
    ...Object.keys(manifest.projects),
    ...runs
      .map((run) => run.project)
      .filter((project) => !(project in manifest.projects)),
  ].filter((name, index, all) => all.indexOf(name) === index);

  const width = Math.max(...names.map((name) => name.length), 0);
  const lines = names.map(
    (name) => `${name.padEnd(width)}  ${describeProject(name, runs)}`,
  );

  const failures = runs
    .filter((run) => run.status === "failed" && run.failure !== undefined)
    .map((run) => `${run.project} #${run.ticket} stopped early: ${run.failure}`);

  const waiting = runs.filter((run) => run.status === "parked");

  const closing =
    waiting.length === 0
      ? "**What I need from you:** nothing — nothing is waiting on you right now."
      : `**What I need from you:** answer on ${waiting
          .map((run) => `${run.project} #${run.ticket}`)
          .join(", ")} — each ticket says what it needs.`;

  return [
    ...(options.stateExists
      ? []
      : ["Nothing has run yet — start the watcher with `timone daemon`.", ""]),
    ...lines,
    ...(failures.length > 0 ? ["", ...failures] : []),
    "",
    closing,
  ].join("\n");
}

/** Register the `status` command on the program. */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show what each managed project is working on")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .option("--state <path>", "path to the daemon state file")
    .action((options: { manifest: string; state?: string }) => {
      let manifest: Manifest;
      try {
        manifest = loadManifest(options.manifest);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }

      const statePath =
        options.state === undefined
          ? defaultStatePath(process.cwd())
          : resolve(options.state);
      const stateExists = existsSync(statePath);

      let runs: Run[];
      try {
        runs = RunStore.open(statePath).all();
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }

      console.log(renderStatus(manifest, runs, { stateExists }));
    });
}
