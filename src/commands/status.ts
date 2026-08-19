import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import {
  fromDefaultBranch,
  type BreakdownSource,
} from "../daemon/breakdown.js";
import { ctaFor, type Cta, type InitiativeProgress } from "../daemon/cta.js";
import { modelFor, stageLabel } from "../daemon/pipeline.js";
import { checkoutOf, initiativeProgress } from "../daemon/poll.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";

/** Statuses that mean a session is running, or about to. */
const RUNNING = ["picked-up", "active"];

/**
 * Plain words for the stages whose bare names would read as jargon. The
 * front half's names shipped with R9 and read fine on a status line; the
 * back half earns a phrase, because "execution" answers less than "building"
 * for the reader this command exists for.
 */
export interface RenderStatusOptions {
  /** False when the daemon has never written a state file. */
  stateExists: boolean;
  /** Now, for saying how long a running session has been going. */
  now?: Date;
  /**
   * The timone root, so a ticket's list of pieces can be read from its
   * project's checkout ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
   * D1 names this cost: answering *is there a next piece?* means reading a
   * file rather than a field).
   *
   * **Absent means no breakdown is read and every line reads as it did before
   * tickets had pieces.** The command itself always supplies one — sessions
   * run at the root (ADR-0007) — so this is a fixture's answer, not a user's.
   */
  root?: string;
  /**
   * Where that list is read from. Defaults to the project's default branch,
   * which is the only place an approved breakdown is guaranteed to be
   * (ADR-0030 D2) — and, since phase 27, the only place either surface looks.
   *
   * **Injected for the same reason `root` is**: a fixture hands over a plain
   * directory. The command supplies nothing, so it takes the default, which
   * keeps R21 clause 8 true — the terminal and the ticket read the same file
   * from the same ref.
   */
  breakdownSource?: BreakdownSource;
}

/**
 * What each of one render's helpers needs beyond the run in front of it.
 *
 * Bundled rather than passed one by one because it travels through four
 * functions: a second and third parameter threaded that far is the data clump
 * `code-smells.md` names, and the next thing the ticket has to say about
 * itself would thread a fourth.
 */
interface RenderContext {
  /** Now, or undefined when the caller does not want durations. */
  now?: Date;
  /** Where this run's ticket's initiative stands, resolved once per ticket. */
  progressOf: (run: Run) => InitiativeProgress | undefined;
}

/**
 * The reader `timone status` resolves every ticket's progress through.
 *
 * **It is `poll.ts`'s {@link initiativeProgress}, called the same way, and
 * that is the whole of R21 clause 8's guarantee**: the terminal and the ticket
 * cannot disagree about where an initiative stands, because there is no second
 * computation for them to disagree between. Memoized per ticket so a project
 * with several waiting tickets reads each breakdown once.
 */
function progressReader(
  runs: readonly Run[],
  root: string | undefined,
  source: BreakdownSource | undefined,
): (run: Run) => InitiativeProgress | undefined {
  if (root === undefined) return () => undefined;

  const cache = new Map<string, InitiativeProgress | undefined>();
  return (run) => {
    const key = `${run.project}#${run.ticket}`;
    if (!cache.has(key)) {
      const chunks = runs.filter(
        (chunk) => chunk.project === run.project && chunk.ticket === run.ticket,
      );
      cache.set(
        key,
        initiativeProgress(
          checkoutOf(root, run.project),
          run.ticket,
          chunks,
          source ?? fromDefaultBranch,
        ),
      );
    }
    return cache.get(key);
  };
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
function ctaOf(run: Run, context: RenderContext): Cta {
  return ctaFor({
    project: run.project,
    ticket: run.ticket,
    run,
    progress: context.progressOf(run),
  });
}

/**
 * What a parked run is waiting for, in the words the ticket itself carries —
 * and the command that moves it, where one does.
 *
 * The command is shown for the same reason it is put on the ticket: a line
 * saying *run this command* without the command in it asks the reader to
 * guess, and a run stopped where nothing written can restart it has no other
 * way out to guess at.
 */
function describeWait(run: Run, context: RenderContext): string {
  const cta = ctaOf(run, context);
  const how = cta.command === undefined ? "" : ` — ${cta.command}`;
  return `waiting on you: ${cta.needFromYou}${how}`;
}

/** One run's phrase: the ticket, how far it got, and what it is doing. */
function describeRun(run: Run, context: RenderContext): string {
  const now = context.now;
  const stage =
    run.stage === undefined ? "" : ` (${stageLabel(run.stage)})`;
  // The model is named for a working run only: it answers "what is this
  // costing me right now", which is not a question about a parked one.
  const model =
    run.status === "active" && run.stage !== undefined
      ? (modelFor(run.stage) ?? "")
      : "";
  const on = model === "" ? "" : ` on ${model}`;
  const what =
    run.status === "parked"
      ? describeWait(run, context)
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
function describeProject(
  project: string,
  runs: Run[],
  context: RenderContext,
): string {
  const mine = runs.filter((run) => run.project === project);
  const running = mine.filter((run) => RUNNING.includes(run.status));
  const parked = mine.filter((run) => run.status === "parked");
  const queued = mine.filter((run) => run.status === "queued");

  const parts = [...running, ...parked].map((run) => describeRun(run, context));
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

  // One reader for the whole render, so a ticket's list of pieces is read
  // once however many of its runs and closing lines mention it.
  const context: RenderContext = {
    now: options.now,
    progressOf: progressReader(runs, options.root, options.breakdownSource),
  };

  const width = Math.max(...names.map((name) => name.length), 0);
  const lines = names.map(
    (name) => `${name.padEnd(width)}  ${describeProject(name, runs, context)}`,
  );

  // Every failure names the way back, in the same breath as the bad news.
  // A run reclaimed from a dead daemon arrives here like any other failure,
  // which is the point: the reader does not need to know it was reclaimed,
  // only what happened and what to type.
  const failures = runs
    .filter((run) => run.status === "failed" && run.failure !== undefined)
    .flatMap((run) => {
      const { command } = ctaOf(run, context);
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

  // **By ticket, not by run.** A ticket is a conversation and a run is one
  // chunk of it (ADR-0026), so a ticket built in three pieces holds three
  // runs — and since a *done* run can now be waiting on the human (a
  // re-proposed list of pieces is), naming the run would put the same ticket
  // in this line once per piece it has had.
  const waiting = runs
    .filter((run) => ctaOf(run, context).waitingOnYou)
    .map((run) => `${run.project} #${run.ticket}`)
    .filter((name, index, all) => all.indexOf(name) === index);

  const closing =
    waiting.length === 0
      ? "**What I need from you:** nothing — nothing is waiting on you right now."
      : `**What I need from you:** answer on ${waiting.join(", ")} — each ticket says what it needs.`;

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

      // The root is where the command was run, which is where sessions and
      // the daemon run too (ADR-0007) — the same directory `defaultStatePath`
      // resolves the ledger under, so the ledger and the checkouts it talks
      // about are read from one place.
      console.log(
        renderStatus(manifest, runs, {
          stateExists,
          now: new Date(),
          root: process.cwd(),
        }),
      );
    });
}
