import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";

/** Statuses that mean a session is running, or about to. */
const RUNNING = ["picked-up", "active"];

export interface RenderStatusOptions {
  /** False when the daemon has never written a state file. */
  stateExists: boolean;
}

/** One run's phrase: the ticket, how far it got, and what it is doing. */
function describeRun(run: Run): string {
  const stage = run.stage === undefined ? "" : ` (${run.stage})`;
  const what =
    run.status === "parked"
      ? `waiting on you: ${run.waitingOn ?? "an answer"}`
      : run.status === "active"
        ? "working on it now"
        : "picked up, about to start";

  const flags =
    run.flags.length === 0
      ? ""
      : ` ⚠ ${run.flags.length} automatic check(s) failed — see the ticket`;

  return `#${run.ticket}${stage} — ${what}${flags}`;
}

/**
 * What one project's line says after its name.
 *
 * **Every** waiting ticket is named, not just the first. Since phase 12 a run
 * that owns no work branch holds no project either, so a project can have
 * several tickets waiting on the reader at once — and a line showing one of
 * them would hide most of what is being asked of them, which is the one thing
 * this command exists to prevent.
 */
function describeProject(project: string, runs: Run[]): string {
  const mine = runs.filter((run) => run.project === project);
  const running = mine.filter((run) => RUNNING.includes(run.status));
  const parked = mine.filter((run) => run.status === "parked");
  const queued = mine.filter((run) => run.status === "queued");

  const parts = [...running, ...parked].map(describeRun);
  if (parts.length === 0) parts.push("idle");

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
