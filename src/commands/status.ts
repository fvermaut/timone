import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import type { PipelineStage } from "../daemon/pipeline.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";

/** Statuses that mean a session is running, or about to. */
const RUNNING = ["picked-up", "active"];

/**
 * Plain words for the stages whose bare names would read as jargon. The
 * front half's names shipped with R9 and read fine on a status line; the
 * back half earns a phrase, because "execution" answers less than "building"
 * for the reader this command exists for.
 */
const STAGE_LABELS: Partial<Record<PipelineStage, string>> = {
  execution: "building",
  verification: "checking the result",
  delivery: "delivering",
  remediation: "acting on your review",
};

export interface RenderStatusOptions {
  /** False when the daemon has never written a state file. */
  stateExists: boolean;
}

/** What a parked run is waiting for. A review wait names its pull request
 * from the ledger, so the line points at the place the reader must go even
 * when the recorded `waitingOn` text is terser. */
function describeWait(run: Run): string {
  if (run.waitingKind === "review" && run.pr !== undefined) {
    return `waiting on you: your review of pull request #${run.pr}`;
  }
  return `waiting on you: ${run.waitingOn ?? "an answer"}`;
}

/** One run's phrase: the ticket, how far it got, and what it is doing. */
function describeRun(run: Run): string {
  const stage =
    run.stage === undefined ? "" : ` (${STAGE_LABELS[run.stage] ?? run.stage})`;
  const what =
    run.status === "parked"
      ? describeWait(run)
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

  // Every failure names the way back, in the same breath as the bad news.
  // A run reclaimed from a dead daemon arrives here like any other failure,
  // which is the point: the reader does not need to know it was reclaimed,
  // only what happened and what to type.
  const failures = runs
    .filter((run) => run.status === "failed" && run.failure !== undefined)
    .flatMap((run) => [
      `${run.project} #${run.ticket} stopped early: ${run.failure}`,
      `  to pick it up from where it stopped: timone retry ${run.id}`,
    ]);

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
