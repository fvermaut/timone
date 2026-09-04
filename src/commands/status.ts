import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import {
  fromDefaultBranch,
  type SyncBreakdownSource,
} from "../daemon/breakdown.js";
import { ctaFor, type Cta, type InitiativeProgress } from "../daemon/cta.js";
import {
  holderLiveness,
  type Hold,
  type Holder,
  type Liveness,
} from "../daemon/holder.js";
import { modelFor, stageLabel } from "../daemon/pipeline.js";
import { initiativeProgressSync, progressOf } from "../daemon/poll.js";
import { daemonRecordNotice } from "../daemon/version.js";

/**
 * Where a project's checkout is, under the timone root.
 *
 * ✏ Moved here from `poll.ts` by phase 30's 30d, because this command is now
 * its only caller. `timone status` is **fvermaut's own command**, run in his
 * terminal against his own folder, and reading it is exactly what it is for —
 * one of the guard's named exemptions in `src/guards/checkouts.test.ts`. The
 * daemon resolves no such path any more.
 */
export function checkoutOf(root: string, project: string): string {
  return join(root, "projects", project);
}
import {
  RunStore,
  defaultStatePath,
  type DaemonRecord,
  type InitiativeRecord,
  type Run,
} from "../daemon/runs.js";

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
  /**
   * What the running daemon's process is built from, as the last cycle wrote
   * it down ([timone#5](https://github.com/fvermaut/timone/issues/5)).
   *
   * **This is where being out of date is said**, rather than only in the
   * daemon's terminal. A daemon prints its start-up lines into a window
   * nobody is looking at; this command is the one a person types. The
   * question is answered off the ledger for the same reason the initiative
   * pictures are — no network call in front of a waiting human (ADR-0044 D5).
   *
   * Absent means say nothing, which is what a fixture wants and what a ledger
   * written by an older daemon gives.
   */
  daemonVersion?: () => DaemonRecord | undefined;
  /**
   * The picture the daemon's last cycle wrote of the initiative a ticket
   * belongs to, or undefined for a ticket in no initiative it has seen.
   *
   * **This is why `timone status` is still instant and still synchronous.**
   * Under one step, one ticket the honest answer to *which step is live* lives
   * on the tracker — and asking for it would put a `gh` call in front of a
   * waiting human, which is the thing ADR-0044 D5 refused. So the daemon
   * writes what it saw each cycle and this reads it off disk. The picture is
   * at most one poll interval stale, which costs a wrong line and never a
   * wrong decision.
   *
   * **Absent means say what you said before**, which is what a fixture wants
   * and what a ledger written by an older daemon gives.
   */
  pictures?: (project: string) => readonly InitiativeRecord[];
  /** Now, for saying how long a running session has been going. */
  now?: Date;
  /**
   * Whether a run's holder is still there
   * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
   * D2), defaulting to asking this machine's process table.
   *
   * **This is the question the terminal can answer on its own**, which is
   * what timone#11 always lacked: with no daemon running, a killed session
   * read "working on it now" for ever, because the only evidence anything had
   * was a clock and a clock needs a witness to mean anything. A pid needs
   * none.
   *
   * Injected for the reason ADR-0025 gives — a test cannot portably
   * manufacture a dead pid.
   */
  livenessOf?: (holder: Holder) => Liveness;
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
  breakdownSource?: SyncBreakdownSource;
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
  /** What can be said about the process holding a run (ADR-0049 D2). */
  hold: (run: Run) => Hold;
  /** Where this run's ticket's initiative stands, resolved once per ticket. */
  progressOf: (run: Run) => InitiativeProgress | undefined;
  /** Every initiative of a project the daemon has a picture of. */
  initiativesOf: (project: string) => readonly InitiativeRecord[];
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
  root: string | undefined,
  source: SyncBreakdownSource | undefined,
  picture: (project: string, ticket: number) => InitiativeRecord | undefined,
): (run: Run) => InitiativeProgress | undefined {
  const cache = new Map<string, InitiativeProgress | undefined>();
  return (run) => {
    const key = `${run.project}#${run.ticket}`;
    if (!cache.has(key)) {
      const seen = picture(run.project, run.ticket);
      // Without a root there is no checkout to read the approved list from, so
      // a re-proposal cannot be seen — but how far the work has got still can,
      // because that comes off the ledger. Before 29g this answered nothing at
      // all, since everything it knew came from the file.
      cache.set(
        key,
        root === undefined
          ? progressOf(seen)
          : initiativeProgressSync(
              source ?? fromDefaultBranch(checkoutOf(root, run.project)),
              run.ticket,
              seen,
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
  // **The words follow the answer rather than being printed over it**
  // ([timone#14](https://github.com/fvermaut/timone/issues/14)). The shared
  // calculation already says whether the human is being waited on, and this
  // renderer used to say "waiting on you" whatever it answered — so a map
  // still working through its own questions read "waiting on you: nothing
  // right now", which is a sentence that contradicts itself. Seen live on the
  // trading app on 2026-08-16.
  const opening = cta.waitingOnYou ? "waiting on you: " : "";
  return `${opening}${cta.needFromYou}${how}`;
}

/** One run's phrase: the ticket, how far it got, and what it is doing. */
function describeRun(run: Run, context: RenderContext): string {
  const now = context.now;
  const where = stepOf(run, context);
  const stage =
    run.stage === undefined ? "" : ` (${stageLabel(run.stage)})`;
  // The model is named for a working run only: it answers "what is this
  // costing me right now", which is not a question about a parked one.
  const model =
    run.status === "active" && run.stage !== undefined
      ? (modelFor(run.stage) ?? "")
      : "";
  const on = model === "" ? "" : ` on ${model}`;
  // An `active` run whose holder's process is gone is not working on
  // anything, and the terminal can establish that with no daemon running at
  // all (ADR-0049 D2) — which is the whole of timone#11. `unknown` is a
  // holder on another machine and `none` is every run written before holders
  // existed: both keep the words they have always had, because guessing about
  // them is worse than saying what was said before.
  const working =
    context.hold(run) === "gone"
      ? "nobody is running this any more — I'll start it again on my next pass"
      : `working on it now${on}${howLong(run, now)}`;
  const what =
    run.status === "parked"
      ? describeWait(run, context)
      : run.status === "active"
        ? working
        : "picked up, about to start";

  const flags =
    run.flags.length === 0
      ? ""
      : ` ⚠ ${run.flags.length} automatic check(s) failed — see the ticket`;

  return `#${run.ticket}${where}${stage} — ${what}${flags}`;
}

/**
 * Where a run's ticket sits in its initiative — ` (step 2 of 3 of #7)` — or
 * nothing at all for a ticket in no initiative.
 *
 * **This is the thing nothing has ever displayed.** The daemon has always had
 * an opinion about which piece comes next and there has never been a way to
 * see it, which is why a wrong one could go unnoticed for a day
 * ([timone#41](https://github.com/fvermaut/timone/issues/41)).
 */
function stepOf(run: Run, context: RenderContext): string {
  const picture = context
    .initiativesOf(run.project)
    .find((record) => record.steps.includes(run.ticket));
  if (picture === undefined) return "";

  const position = picture.steps.indexOf(run.ticket) + 1;
  return ` (step ${position} of ${picture.steps.length} of #${picture.initiative})`;
}

/**
 * What an initiative with no run of its own is doing — the gap between two
 * steps, when the last one has merged and the next has not been taken up.
 *
 * Without it the project's line reads `idle`, which is true of the project and
 * false of the work: a fourteen-step initiative is alive for the whole minute
 * between every pair of pieces, and a reader told `idle` fourteen times would
 * be right to conclude nothing was happening.
 *
 * **An initiative every one of whose steps is closed says nothing**, because
 * it is finished rather than waiting.
 */
function describeInitiative(picture: InitiativeRecord): string | undefined {
  if (picture.done >= picture.steps.length) return undefined;

  const where = `#${picture.initiative} — ${picture.done} of ${picture.steps.length} done`;
  return picture.next === undefined || picture.nextTitle === undefined
    ? `${where}, nothing to take up yet`
    : `${where}, next is ${picture.nextTitle}`;
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

  // An initiative whose live step already has a run above is not named again:
  // that run's own phrase says where it is. This is for the initiatives with
  // no run at all — the gap between two steps.
  const busy = new Set(mine.map((one) => one.ticket));
  for (const picture of context.initiativesOf(project)) {
    if (picture.steps.some((step) => busy.has(step))) continue;
    const said = describeInitiative(picture);
    if (said !== undefined) parts.push(said);
  }

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
  const livenessOf = options.livenessOf ?? ((holder) => holderLiveness(holder));
  const context: RenderContext = {
    now: options.now,
    hold: (run) => (run.holder === undefined ? "none" : livenessOf(run.holder)),
    initiativesOf: (project) => options.pictures?.(project) ?? [],
    progressOf: progressReader(
      options.root,
      options.breakdownSource,
      (project, ticket) =>
        (options.pictures?.(project) ?? []).find(
          (record) =>
            record.initiative === ticket || record.steps.includes(ticket),
        ),
    ),
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

  // Above everything, because it is about the thing that produced everything
  // below it: a reader deciding what to do about a stuck project should know
  // first that the daemon telling them about it is running old code.
  const outOfDate = daemonRecordNotice(options.daemonVersion?.());

  return [
    ...(options.stateExists
      ? []
      : ["Nothing has run yet — start it with `timone daemon`.", ""]),
    ...(outOfDate === undefined ? [] : [outOfDate, ""]),
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
      let store: RunStore;
      try {
        store = RunStore.open(statePath);
        runs = store.all();
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
          pictures: (project) => store.initiativesFor(project),
          // Undefined once the daemon's process is gone: nobody is running
          // old code when nothing is running.
          daemonVersion: () => store.daemonVersion(),
        }),
      );
    });
}
