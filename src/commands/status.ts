import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, placesIn, ticketLimitOf, type Manifest } from "../manifest.js";
import {
  holderLiveness,
  type Hold,
  type Holder,
  type Liveness,
} from "../daemon/holder.js";
import { modelFor, stageLabel } from "../daemon/pipeline.js";
import { daemonRecordNotice } from "../daemon/version.js";
import { joined } from "../runner/comments.js";
import { allowanceOf, spentOn } from "../runner/limit.js";
import { readRecord } from "../runner/record.js";
import { RUNNER_DEFAULT_WAIT } from "../runner/session.js";

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
   * A ticket's record, as `readRecord` gives it, so a ticket the runner works
   * on can show what it has spent against its limit
   * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)).
   *
   * **Read only for the runs this command names**, one file per ticket, on
   * every project: the runner drives them all.
   *
   * Absent means say nothing about spending, which is what a fixture wants.
   */
  records?: (project: string, ticket: number) => ReturnType<typeof readRecord>;
  /**
   * The runs of a project that wait for a place, in the order they will be
   * given one, as `RunStore.waitingForPlace` gives them
   * ([ADR-0063](../../doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)
   * D3).
   *
   * **The ledger's order, not a second one.** The order that decides who gets
   * the place is kept in one function, so this line cannot name a turn the
   * ledger will not give.
   *
   * Absent means say nothing about waiting, which is what a fixture wants.
   */
  waitingForPlace?: (project: string) => readonly Run[];
  /**
   * The runs of a project that wait for the planner's decision, in the order
   * the planner takes them, as `RunStore.waitingForPlanner` gives them
   * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
   * D2).
   *
   * Absent means say nothing about the planner, which is what a fixture wants.
   */
  waitingForPlanner?: (project: string) => readonly Run[];
  /**
   * The runs of a project the planner holds, as `RunStore.heldByPlanner`
   * gives them (ADR-0065 D2). Absent means none.
   */
  heldByPlanner?: (project: string) => readonly Run[];
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
  /** Every initiative of a project the daemon has a picture of. */
  initiativesOf: (project: string) => readonly InitiativeRecord[];
  /** The runs of a project that wait for a place, in the ledger's order. */
  waitingForPlace: (project: string) => readonly Run[];
  /** The runs of a project that wait for the planner's decision, in its order. */
  waitingForPlanner: (project: string) => readonly Run[];
  /** The runs of a project the planner holds. */
  heldByPlanner: (project: string) => readonly Run[];
  /**
   * What this run's ticket has spent against its limit, as the words that
   * end its phrase — or nothing, when no reader of records was given.
   */
  spendingOf: (run: Run) => string;
}

/**
 * What a ticket has spent against its limit, ` — $12.34 of $150.00 spent`,
 * from the functions that decide whether another session may start — so the
 * number here is the number that stops the work. Nothing at all when no
 * reader of records was given.
 *
 * ✏ 2026-09-30: every project, since the runner drives every project. Until
 * then a project the old daemon drove showed no spending.
 */
function spendingReader(
  manifest: Manifest,
  records: RenderStatusOptions["records"],
): (run: Run) => string {
  return (run) => {
    const config = manifest.projects[run.project];
    if (records === undefined || config === undefined) return "";
    const record = records(run.project, run.ticket);
    // Said rather than left out: a missing number would read as a ticket
    // that has spent nothing, and the record is what the limit is counted
    // from. `timone record` names the broken line.
    if (!record.ok) {
      return (
        " — spending unknown: its record cannot be read, " +
        `see timone record ${run.project}#${run.ticket}`
      );
    }
    const spent = spentOn(record.value);
    const allowance = allowanceOf(record.value, ticketLimitOf(config));
    return ` — $${spent.toFixed(2)} of $${allowance.toFixed(2)} spent`;
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
 * Whether one run's ticket is waiting on the reader, which is what the
 * closing line names it for.
 *
 * - **A parked run waits on the reader when the runner asked one for
 *   something** (40i). Its wait holds what the runner last asked for on the
 *   ticket, or `RUNNER_DEFAULT_WAIT` when it asked nothing. The runner is told
 *   to end every message with what it needs from the reader, "or nothing",
 *   so an ask that opens on that word asks nothing either.
 * - Every other run waits on nobody: picked up, at work, cancelled, or done.
 *
 * ✏ 2026-09-30: decided here. It was `ctaFor` in `src/daemon/cta.ts`, one
 * calculation for the ticket's standing note and for this command. The
 * standing note went with the old code between steps, and every wait a run
 * is read with now is the runner's, so this is all of it that was left.
 *
 * ✏ 2026-10-06 (#186): **a done run waits on nobody.** It used to be named
 * when its initiative had steps left and none of them could start, or when
 * its list of pieces had grown since it was approved. Both readings came from
 * the old daemon. Now a person is asked something only by the runner, and the
 * runner asks by parking the run with the ask as its wait
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)).
 * An initiative with steps left and none eligible is ordinary
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D6), and an old initiative picture stays in the ledger after its map ticket
 * closes, so the old reading named finished work for ever.
 */
function waitsOnYou(run: Run): boolean {
  if (run.status !== "parked") return false;
  const on = run.wait?.on ?? RUNNER_DEFAULT_WAIT;
  return on !== RUNNER_DEFAULT_WAIT && !/^nothing\b/i.test(on.trim());
}

/**
 * What a parked run is waiting for, in its own words, saying only that the
 * run waits (ADR-0060). Whether a person is being waited on is the runner's
 * to say on the ticket; the closing line names the ticket when one is.
 *
 * ✏ 2026-09-30: **every parked run waits for the runner.** The ledger loads
 * a run parked on an older kind of wait as the runner's, so the words for a
 * gate, a review, a conversation and a stop, and the command some of them
 * printed, went with the old code between steps. A parked run with no wait
 * at all is named with the words the runner gives a run that asked nothing.
 */
function describeWait(run: Run): string {
  return `waiting: ${run.wait?.on ?? RUNNER_DEFAULT_WAIT}`;
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
      ? describeWait(run)
      : run.status === "active"
        ? working
        : "picked up, about to start";

  const flags =
    run.flags.length === 0
      ? ""
      : ` ⚠ ${run.flags.length} automatic check(s) failed — see the ticket`;

  return `#${run.ticket}${where}${stage} — ${what}${context.spendingOf(run)}${flags}`;
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
 * Which tickets of a project the planner is deciding, and which it holds
 * until which others are merged or closed (ADR-0065 D2):
 * `planner: deciding #12; holds #9 until #7`. Nothing when it does neither.
 *
 * Several tickets are joined with ", ", as the closing line names tickets.
 * The tickets one held ticket waits for read `#7 and #8`, as the hold
 * comment on the ticket says them.
 */
function describePlanner(
  deciding: readonly Run[],
  held: readonly Run[],
): string | undefined {
  const said: string[] = [];
  if (deciding.length > 0) {
    said.push(`deciding ${deciding.map((run) => `#${run.ticket}`).join(", ")}`);
  }
  if (held.length > 0) {
    const holds = held.map((run) => {
      const waitsFor = run.planner?.decision?.waitsFor ?? [];
      return `#${run.ticket} until ${joined(waitsFor.map((ticket) => `#${ticket}`))}`;
    });
    said.push(`holds ${holds.join(", ")}`);
  }
  return said.length === 0 ? undefined : `planner: ${said.join("; ")}`;
}

/**
 * What one project's line says after its name.
 *
 * **Every** waiting ticket is named, not just the first. Since phase 12 a run
 * that owns no work branch holds no project either, so a project can have
 * several tickets waiting on the reader at once — and a line showing one of
 * them would hide most of what is being asked of them, which is the one thing
 * this command exists to prevent.
 *
 * ✏ 2026-10-04: after the runs, the line names the ticket a place is given
 * to and the tickets that wait for one, in their order (ADR-0063). It says
 * nothing about a place when nobody waits.
 *
 * ✏ 2026-10-05: after that, the tickets the planner is deciding and those it
 * holds (ADR-0065 D2), through {@link describePlanner}.
 */
function describeProject(
  project: string,
  runs: Run[],
  context: RenderContext,
): string {
  const mine = runs.filter((run) => run.project === project);
  const running = mine.filter((run) => RUNNING.includes(run.status));
  const parked = mine.filter((run) => run.status === "parked");

  const parts = [...running, ...parked].map((run) => describeRun(run, context));

  // After the runs, because it is about them: which ticket a freed place is
  // given to, then which tickets get one next, in the order the ledger will
  // give it (ADR-0063 D3).
  for (const run of mine.filter((one) => one.place?.givenAt !== undefined)) {
    parts.push(`the place is given to #${run.ticket}`);
  }
  const waiting = context.waitingForPlace(project);
  if (waiting.length > 0) {
    parts.push(
      `waiting for a place: ${waiting.map((run) => `#${run.ticket}`).join(", then ")}`,
    );
  }
  const planner = describePlanner(
    context.waitingForPlanner(project),
    context.heldByPlanner(project),
  );
  if (planner !== undefined) parts.push(planner);

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

  return parts.join("  ·  ");
}

/**
 * Every project on one line: the ticket it is working, how far that ticket
 * got, whether it is waiting on the reader, and whether the automatic checks
 * complained. Written to be read at a glance
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

  const livenessOf = options.livenessOf ?? ((holder) => holderLiveness(holder));
  const context: RenderContext = {
    now: options.now,
    hold: (run) => (run.holder === undefined ? "none" : livenessOf(run.holder)),
    initiativesOf: (project) => options.pictures?.(project) ?? [],
    waitingForPlace: (project) => options.waitingForPlace?.(project) ?? [],
    waitingForPlanner: (project) => options.waitingForPlanner?.(project) ?? [],
    heldByPlanner: (project) => options.heldByPlanner?.(project) ?? [],
    spendingOf: spendingReader(manifest, options.records),
  };

  const width = Math.max(...names.map((name) => name.length), 0);
  const lines = names.map(
    (name) => `${name.padEnd(width)}  ${describeProject(name, runs, context)}`,
  );

  // ✏ 2026-09-30: there is no list of failures any more. No run can be read
  // as failed: the ledger loads a failed run as cancelled, so it is listed
  // below with what stopped it.
  //
  // In its own words. A cancelled chunk was abandoned, not broken: there is
  // no way back into it, so it is stated and nothing is offered. It is
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
  // chunk of it (ADR-0026), so one ticket can hold several runs. Only a
  // parked run that asked for something is named, but the ledger can still
  // hold more than one parked run of one ticket, written by older code, and
  // naming each run would put the same ticket in this line more than once.
  //
  // ✏ 2026-10-06 (#186): a done run is never named here (see
  // {@link waitsOnYou}).
  const waiting = runs
    .filter((run) => waitsOnYou(run))
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
        store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
        runs = store.all();
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }

      console.log(
        renderStatus(manifest, runs, {
          stateExists,
          now: new Date(),
          pictures: (project) => store.initiativesFor(project),
          waitingForPlace: (project) => store.waitingForPlace(project),
          waitingForPlanner: (project) => store.waitingForPlanner(project),
          heldByPlanner: (project) => store.heldByPlanner(project),
          records: (project, ticket) => readRecord(process.cwd(), project, ticket),
          // Undefined once the daemon's process is gone: nobody is running
          // old code when nothing is running.
          daemonVersion: () => store.daemonVersion(),
        }),
      );
    });
}
