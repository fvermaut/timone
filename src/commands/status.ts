import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { ctaFor, type Cta } from "../daemon/cta.js";
import { modelFor, type PipelineStage } from "../daemon/pipeline.js";
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
  // The one stage whose bare name reads as the opposite of what it is: to
  // someone glancing at a status line, "breakdown" is a thing that has gone
  // wrong, not a session working out how to cut the job up.
  breakdown: "working out the pieces",
  execution: "building",
  verification: "checking the result",
  delivery: "delivering",
  remediation: "acting on your review",
};

export interface RenderStatusOptions {
  /** False when the daemon has never written a state file. */
  stateExists: boolean;
  /** Now, for saying how long a running session has been going. */
  now?: Date;
}

/**
 * How long a run has been working, in the words the daemon's own progress
 * line uses — so the thing printed while a session runs and the thing
 * `timone status` reports agree rather than being two dialects.
 *
 * Measured from `updatedAt`, which for an active run is when it activated.
 * The heartbeat deliberately does not touch that field, for this reason.
 */
function howLong(run: Run, now: Date | undefined): string {
  if (now === undefined) return "";
  const started = Date.parse(run.updatedAt);
  if (!Number.isFinite(started)) return "";
  const elapsed = now.getTime() - started;
  return elapsed < 0 ? "" : ` for ${humanDuration(elapsed)}`;
}

/** `9s`, `4m12s`, `1h04m` — the same shape the progress line prints. */
function humanDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");

  if (hours > 0) return `${hours}h${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m${pad(seconds)}s`;
  return `${seconds}s`;
}

/**
 * What one run's ticket is asking of the human.
 *
 * **The only place this file decides that**, and it decides it by asking
 * (ADR-0024). What a ticket needs is computed once and rendered onto both the
 * ticket and this command; a second opinion here is how `timone status` came
 * to ask for an answer on a ticket whose own body said nothing was needed.
 */
function ctaOf(run: Run): Cta {
  return ctaFor({ project: run.project, ticket: run.ticket, run });
}

/** What a parked run is waiting for, in the words the ticket itself carries. */
function describeWait(run: Run): string {
  return `waiting on you: ${ctaOf(run).needFromYou}`;
}

/** One run's phrase: the ticket, how far it got, and what it is doing. */
function describeRun(run: Run, now: Date | undefined): string {
  const stage =
    run.stage === undefined ? "" : ` (${STAGE_LABELS[run.stage] ?? run.stage})`;
  // The model is named for a working run only: it answers "what is this
  // costing me right now", which is not a question about a parked one.
  const model =
    run.status === "active" && run.stage !== undefined
      ? (modelFor(run.stage) ?? "")
      : "";
  const on = model === "" ? "" : ` on ${model}`;
  const what =
    run.status === "parked"
      ? describeWait(run)
      : run.status === "active"
        ? `working on it now${on}${howLong(run, now)}`
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
function describeProject(project: string, runs: Run[], now: Date | undefined): string {
  const mine = runs.filter((run) => run.project === project);
  const running = mine.filter((run) => RUNNING.includes(run.status));
  const parked = mine.filter((run) => run.status === "parked");
  const queued = mine.filter((run) => run.status === "queued");

  const parts = [...running, ...parked].map((run) => describeRun(run, now));
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
    (name) => `${name.padEnd(width)}  ${describeProject(name, runs, options.now)}`,
  );

  // Every failure names the way back, in the same breath as the bad news.
  // A run reclaimed from a dead daemon arrives here like any other failure,
  // which is the point: the reader does not need to know it was reclaimed,
  // only what happened and what to type.
  const failures = runs
    .filter((run) => run.status === "failed" && run.failure !== undefined)
    .flatMap((run) => {
      const { command } = ctaOf(run);
      return [
        `${run.project} #${run.ticket} stopped early: ${run.failure}`,
        ...(command === undefined
          ? []
          : [`  to pick it up from where it stopped: ${command}`]),
      ];
    });

  // Beside the failures rather than among them, and in its own words. A
  // cancelled chunk was abandoned, not broken: there is no way back into it —
  // `timone retry` refuses one — so it is stated and nothing is offered. It is
  // reported at all because typing `timone cancel` has to change something the
  // person who typed it can see.
  const cancelled = runs
    .filter((run) => run.status === "cancelled")
    .map(
      (run) =>
        `${run.project} #${run.ticket} was cancelled: ` +
        `${run.cancellation ?? "no reason recorded"}`,
    );

  const waiting = runs.filter((run) => ctaOf(run).waitingOnYou);

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
    ...(cancelled.length > 0 ? ["", ...cancelled] : []),
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

      console.log(renderStatus(manifest, runs, { stateExists, now: new Date() }));
    });
}
