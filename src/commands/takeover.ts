import { spawn } from "node:child_process";
import { heldStepWayOut } from "../daemon/dropped.js";
import { HELD_LABEL } from "../daemon/steps.js";
import { resolve } from "node:path";
import type { Command } from "commander";

import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import {
  MARK_LABEL,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
} from "../adapters/ticketing.js";
import { loadManifest, namedPeople, placesIn, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";
import { takeoverPrompt } from "../daemon/prompts.js";
import { stageLabel, wayfinderStage } from "../daemon/pipeline.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { acquireStateLock } from "../daemon/lock.js";
import { takeHold, type Holder } from "../daemon/holder.js";
import {
  enqueue,
  settle as settleRequest,
  waitUntilSettled,
  WATCH_BOUND_MS,
  WATCH_INTERVAL_MS,
  type WaitOptions,
} from "../daemon/requests.js";
import { intervalTicker, waitOf, type Ticker } from "../daemon/session.js";
import { RUNNER_DEFAULT_WAIT } from "../runner/session.js";
import { readRecord } from "../runner/record.js";

/** A parsed `<project>#<ticket>` target. */
export interface TakeoverTarget {
  project: string;
  ticket: number;
}

/** What a takeover turns out to be. */
export type TakeoverResolution =
  /**
   * A run waiting for the runner, for the terminal to hold in a session bound
   * to no step ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md),
   * [ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)).
   * What the run does next is the runner's to decide, not a step's, so no
   * step travels with this resolution.
   *
   * ✏ 2026-09-30: the only session a takeover opens. The session bound to a
   * stage, for a run parked on a conversation, went with the old code
   * between steps: the ledger loads every old kind of wait as the runner's.
   */
  | { kind: "open-session"; run: Run }
  /**
   * A run whose step is running: the takeover waits for the step to end, and
   * the step's end hands the run to the terminal
   * ([ADR-0067](../../doc/adr/0067-a-takeover-typed-while-a-step-runs-is-written-on-the-run-and-takes-it-when-the-step-ends.md)).
   * `step` names the step in the human's words.
   */
  | { kind: "wait-for-step"; run: Run; step: string }
  /** Nothing to take over; the message says what *is* happening instead. */
  | { kind: "nothing-to-do"; message: string };

/** Launching a child process, behind a seam so the wiring is testable. */
export interface ProcessLauncher {
  run(
    command: string,
    args: readonly string[],
    options: { cwd: string },
  ): Promise<number>;
}

export interface TakeoverDeps {
  manifest: Manifest;
  store: RunStore;
  /**
   * Where the ledger lives, so a takeover is the only thing writing it
   * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)). A takeover
   * spawns a session like the daemon does, and was racing it by exactly the
   * same faults.
   *
   * Absent means no lock is taken — the shape the resolution tests use.
   * **They are the only callers entitled to that shape**: since ADR-0024
   * resolving a ticket the ledger has never heard of *creates its run*, so
   * resolution is a write and every real one happens inside
   * {@link runTakeover}'s hold.
   */
  statePath?: string;
  adapter: TicketingAdapter;
  launcher: ProcessLauncher;
  /**
   * How long to watch for the daemon to hand a run over, when it is the
   * daemon doing the claiming. Injected so a test does not wait a real minute.
   */
  wait?: WaitOptions;
  /** The timone root: the conversation runs here, never in the project (ADR-0007). */
  root: string;
  /**
   * What keeps the claimed run's heartbeat warm, behind the same seam the
   * daemon's own sessions use, so a test needs no clock.
   */
  ticker?: (onTick: () => void, intervalMs: number) => Ticker;
  log?: (message: string) => void;
}

/**
 * What working out the answer needs: the manifest, the ledger, and — since
 * ADR-0024 — the tracker, because a ticket with no run is a question only the
 * tracker can answer.
 */
export type TakeoverResolutionDeps = Pick<
  TakeoverDeps,
  "manifest" | "store" | "adapter"
>;

/**
 * Parse `<project>#<ticket>`. Anything else is refused with the shape it
 * wanted — this is the one argument the human types, so a wrong guess about
 * what it should look like has to be answered rather than absorbed.
 */
export function parseTarget(raw: string): TakeoverTarget {
  const match = /^([^#\s]+)#(\d+)$/.exec(raw.trim());
  if (match === null) {
    throw new Error(
      `"${raw}" is not a ticket. Give it as <project>#<ticket>, for example ` +
        `"scratch-app#6".`,
    );
  }
  return { project: match[1], ticket: Number(match[2]) };
}

/**
 * Work out what this ticket is waiting on — from the ledger, and from the
 * tracker where the ledger has never heard of it.
 *
 * Every answer is a full sentence about the ticket's actual state, because a
 * takeover that finds nothing to do is the commonest case for someone who
 * typed the command hopefully — and "nothing to do" without a reason is what
 * makes a tool feel broken.
 *
 * **It writes, since [ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)**,
 * and that is the one thing to know before calling it. A ticket with no run
 * gets one here ({@link enrolFromTracker}) rather than being refused, so this
 * is no longer a question that can be asked idly: every caller outside a test
 * must hold the ledger lock, which is why {@link runTakeover} is the only one.
 * ✏ 2026-10-02 (41m): so does an open ticket whose latest run is done or
 * cancelled. {@link findTakeover} is the half that writes nothing.
 */
export async function resolveTakeover(
  target: TakeoverTarget,
  deps: TakeoverResolutionDeps,
): Promise<TakeoverResolution> {
  const found = await findTakeover(target, deps);
  return found.kind === "enrol" ? enrolFromTracker(target, found.ticket, deps) : found;
}

/**
 * What a takeover finds before it writes anything: the answer, or an open
 * ticket that needs a new run first.
 */
type Finding = TakeoverResolution | { kind: "enrol"; ticket: Ticket };

/**
 * {@link resolveTakeover} without the write: it reads the ledger and the
 * tracker, and where a new run is needed it says so instead of registering
 * one. A takeover that could not get the ledger asks this, because it must
 * not write (41m).
 */
async function findTakeover(
  target: TakeoverTarget,
  deps: TakeoverResolutionDeps,
): Promise<Finding> {
  const { manifest, store } = deps;

  if (!(target.project in manifest.projects)) {
    const known = Object.keys(manifest.projects).join(", ") || "none";
    return {
      kind: "nothing-to-do",
      message:
        `I don't know a project called "${target.project}". ` +
        `I look after: ${known}.`,
    };
  }

  const run = store.runsForTicket(target.project, target.ticket).at(-1);
  if (run === undefined) {
    // The refusal survives for the two cases where there is genuinely
    // nothing to pick up, each with a sentence of its own, because "closed"
    // and "no such ticket" are different things to have got wrong.
    const { ticket, project } = await openTicketOf(target, deps);
    if (ticket === undefined) return notOpen(target, project, deps.adapter);
    return { kind: "enrol", ticket };
  }

  switch (run.status) {
    case "active":
      // ✏ 2026-10-05 (ADR-0067 D1): a step runs on it, so the takeover waits
      // for that step to end rather than refusing.
      if (run.takenOver !== true) {
        return { kind: "wait-for-step", run, step: runningStepOf(run) };
      }
      return { kind: "nothing-to-do", message: workingOnMessage(target) };
    case "picked-up":
      // No step runs on it yet, and the runner has not looked at it.
      return { kind: "nothing-to-do", message: workingOnMessage(target) };
    case "parked":
      // ✏ 2026-09-30: **every parked run waits for the runner.** The ledger
      // loads a run parked on an older kind of wait — a gate, a review, a
      // conversation, a stop — as waiting for the runner, and the runner is
      // what moves it (ADR-0060). So the session that opens is the one bound
      // to no step. The answers this command used to give for a gate or a
      // review, and the conversation it opened at a stage, went with the old
      // code between steps.
      return { kind: "open-session", run };
    case "done":
    case "cancelled": {
      // ✏ 2026-10-02 (41m): **a settled run on an open ticket gets a new
      // run**, as a ticket with no run does. A takeover opens a terminal
      // session on any run nothing is working on (PRD-05.R11). The runner
      // ends a run whose ticket lost its mark, and a takeover of that ticket
      // used to answer "finished" and open nothing. A closed ticket still
      // gets the answer.
      const { ticket } = await openTicketOf(target, deps);
      if (ticket !== undefined) return { kind: "enrol", ticket };
      return { kind: "nothing-to-do", message: settledMessage(target, run, store) };
    }
  }
}

/** The step that runs on `run`, in the human's words. */
function runningStepOf(run: Run): string {
  return run.stage === undefined ? "the step that is running" : stageLabel(run.stage);
}

/** What a takeover of a run the machine is working on says. */
function workingOnMessage(target: TakeoverTarget): string {
  return (
    `I'm working on ${target.project} #${target.ticket} right now. ` +
    "Anything I need from you will land on the ticket."
  );
}

/**
 * Why a takeover with the ledger in hand opens nothing. A run whose step
 * runs is still refused with the words it always got there, since no daemon
 * runs to end the step.
 */
function refusalOf(
  target: TakeoverTarget,
  resolution: Exclude<TakeoverResolution, { kind: "open-session" }>,
): string {
  return resolution.kind === "wait-for-step" ? workingOnMessage(target) : resolution.message;
}

/** What a takeover of a closed ticket whose latest run is done or cancelled says. */
function settledMessage(target: TakeoverTarget, run: Run, store: RunStore): string {
  if (run.status !== "cancelled") {
    return `${target.project} #${target.ticket} is finished — see the ticket.`;
  }
  // Abandoned, not broken — so the words say it was cancelled, and never
  // that something went wrong. Its reason is in `cancellation`, and dropping
  // the clause when there is none beats a sentence reading "cancelled: "
  // with nothing after it.
  const because =
    run.cancellation === undefined || run.cancellation === ""
      ? "."
      : `: ${run.cancellation}.`;
  // ✏ 2026-10-02: a cancel puts the hold on every ticket since 40u, and the
  // cycle passes a held ticket over. So reopening and marking it starts
  // nothing; taking the hold off does. The cycle lists only marked tickets,
  // and a run cancelled before 40u left no hold, so the words name the mark
  // and take the hold off only "if it has it".
  return (
    `${target.project} #${target.ticket} was cancelled${because} ` +
    "Cancelled work isn't picked up again — " +
    (heldStepWayOut(store, target.project, target.ticket) ??
      `reopen the ticket, make sure it has the \`${MARK_LABEL}\` label, and ` +
        `take the \`${HELD_LABEL}\` label off if it has it. Then I'll start ` +
        "it afresh on my next pass.")
  );
}

/**
 * The ticket as the tracker lists it among the open ones, or undefined when
 * it is not open. The project is returned too, for the caller that must then
 * tell a closed ticket from one that does not exist.
 */
async function openTicketOf(
  target: TakeoverTarget,
  deps: TakeoverResolutionDeps,
): Promise<{ ticket: Ticket | undefined; project: TicketingProject }> {
  const project = {
    name: target.project,
    repoUrl: deps.manifest.projects[target.project].repo_url,
  };
  const open = await deps.adapter.listOpenTickets(project);
  return {
    ticket: open.find((candidate) => candidate.number === target.ticket),
    project,
  };
}

/**
 * Take an open ticket the ledger has never heard of, and make it a run
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **This is the refusal's replacement**, and the refusal — *"I'm not working
 * on X. Add the `timone` label…"* — is what PRD-02.R20's second criterion has
 * failed on since phase 18. Marking at creation is kept: this is a second way
 * in beside the label, not instead of it, so nothing here touches the ticket's
 * labels. Two reasons, and either is sufficient. The label is what daemon
 * pickup is built on and the ADR keeps it that way; and applying it would make
 * this command fail on the exact repository it exists to rescue — one
 * onboarded before the label existed, where `gh issue edit --add-label` has
 * nothing to add and errors.
 *
 * The refusal survives for the two cases where there is genuinely nothing to
 * pick up; {@link findTakeover} gives it, before this is called.
 *
 * ✏ 2026-09-30: **the new run waits for the runner**
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)),
 * with no step chosen. That is the wait the runner puts a run on when it
 * first wakes for it (`putOnRunnersWait` in `src/runner/session.ts`). The
 * terminal then holds it like any other run the runner waits on, and gives
 * it back with a request to wake the runner. Until then the run was parked
 * on a conversation at the stage its labels named, and a ticket at a stage
 * with no conversation of its own was refused.
 *
 * ✏ 2026-10-02 (41m): a ticket whose `wayfinder:` label names a step gets
 * that step on its new run, so the session is told which conversation to
 * hold. Without it, a takeover of a decision ticket opened a session that did
 * not know it was a wayfinding conversation.
 *
 * ✏ 2026-10-02 (41m): the same for an open ticket whose latest run is done
 * or cancelled. `register` opens its next run.
 */
function enrolFromTracker(
  target: TakeoverTarget,
  ticket: Ticket,
  deps: TakeoverResolutionDeps,
): TakeoverResolution {
  const { store } = deps;
  const created = store.register(target.project, target.ticket).run;

  // ✏ 2026-10-02 (41m): **at the step the ticket's `wayfinder:` label
  // names**, as the runner's own order reads it: a decision ticket at
  // wayfinding, a map at charting. The prompt then tells the session to hold
  // that conversation. A ticket with no such label gets no step, as before.
  const stage = wayfinderStage(ticket.labels);
  // Opened when the run was, and ended by the step it is at, or by the step a
  // new ticket starts at, as the runner's own first wait is.
  const run = store.park(created.id, {
    waitingOn: RUNNER_DEFAULT_WAIT,
    kind: "runner",
    ...(stage === undefined ? {} : { stage }),
    waitCursor: created.updatedAt,
    resolvableBy: [stage ?? "triage"],
  });
  return { kind: "open-session", run };
}

/**
 * The two ways a ticket can have nothing to take over, told apart.
 *
 * The open listing says only that it is not open. Which of the two that is —
 * closed, or never there at all — is what the human got wrong, and answering
 * both with one sentence would leave them checking the wrong thing. The
 * tracker is asked once more, and a read that throws is the answer.
 */
async function notOpen(
  target: TakeoverTarget,
  project: TicketingProject,
  adapter: TicketingAdapter,
): Promise<{ kind: "nothing-to-do"; message: string }> {
  try {
    await adapter.getTicket(project, target.ticket);
  } catch {
    return {
      kind: "nothing-to-do",
      message:
        `There's no ticket #${target.ticket} on ${target.project}. ` +
        "Check the number — I can only pick up something that exists.",
    };
  }

  return {
    kind: "nothing-to-do",
    message:
      `${target.project} #${target.ticket} is closed, so there's nothing to ` +
      "pick up. Reopen it if it still needs something from me.",
  };
}

/**
 * Resolve the ticket, then hand the terminal to an interactive session.
 *
 * The session is the `claude` CLI with stdio inherited, not the daemon's
 * unattended runtime: a conversation needs someone at the keyboard, and the
 * daemon's sessions run with no one there (ADR-0009 — CLI-first).
 */
export async function runTakeover(
  raw: string,
  deps: TakeoverDeps,
): Promise<number> {
  const log = deps.log ?? ((message: string) => console.log(message));
  if (deps.statePath === undefined) return takeover(raw, deps, log);

  let target: TakeoverTarget;
  try {
    target = parseTarget(raw);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const claimed = await claimForTakeover(raw, target, deps, log);
  if (claimed.kind !== "claimed") return claimed.code;

  // From here the run's *status* is what holds the run: it is `active`, so
  // the runner leaves it alone and no step starts on it (ADR-0032). It is
  // marked taken over, so it takes no place on the project, and other
  // tickets' steps go on starting (ADR-0063 D5). No lock is held across the
  // conversation, so the daemon carries on with every other ticket and project.
  //
  // A claimed run is `active`, and an active run that stops stamping its
  // heartbeat is reclaimed as dead by the daemon's next pass (ADR-0020) —
  // after four progress intervals, which is two minutes. Only the daemon's
  // own sessions used to stamp it, so every takeover was killed a couple of
  // minutes in while the human was still sitting in it. Seen live on
  // ivtrends #27 on 2026-08-25: the conversation ran to a correct fix, and
  // the run it was holding had been marked failed before the first commit
  // landed, which left the ticket unable to accept another word.
  const beat = (deps.ticker ?? intervalTicker)(() => {
    try {
      deps.store.heartbeat(claimed.run.id);
    } catch {
      // The run left the ledger under us — cancelled elsewhere, or the file
      // rewritten. Nothing here can fix that, and a takeover that died on a
      // failed heartbeat would lose the conversation over bookkeeping.
    }
  }, DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000);

  // A signal does not run a `finally`, and Ctrl-C is how a conversation ends
  // more often than not, so the claim is given back on that path too — and
  // the beat stopped with it, since a timer left running would hold the
  // process open past the conversation it was beating for. A claim that
  // outlives its session is the stuck run phase 14 closed.
  const giveBack = (): void => {
    beat.stop();
    releaseClaim(target, claimed.run, deps, log);
  };
  process.once("SIGINT", giveBack);
  process.once("SIGTERM", giveBack);

  try {
    return await openSession(target, claimed.run, deps, log);
  } finally {
    process.off("SIGINT", giveBack);
    process.off("SIGTERM", giveBack);
    // **The ordinary ending reads what the session recorded; a signal cannot**
    // (ADR-0049 D6). Ctrl-C runs no `await`, so the signal handler above stays
    // the blind restore it has always been — a claim given back is better than
    // a claim held by a process that is gone. This path has time to ask the
    // ticket what happened.
    beat.stop();
    await endTakeover(target, claimed.run, deps, log);
  }
}

/** A claimed run, or the exit code of a takeover that never started one. */
type Claim = { kind: "claimed"; run: Run } | { kind: "no"; code: number };

/**
 * Take the run for this conversation, by whichever road the ledger allows.
 *
 * **Three roads, and only the middle one is new.** The ledger free: resolve
 * and claim inside a hold measured in milliseconds, then give the lock
 * straight back. A live daemon holding it: ask, and let the daemon claim.
 * Anything else — an unreadable lock — is refused exactly as before.
 *
 * **Refusals keep their words wherever they can.** Where the ledger already
 * knows this ticket, resolution is a read, so it happens here and the human
 * gets the same sentence they have always got about a running run, or a
 * finished one. Only enrolling a ticket the ledger has never heard of
 * is a write, and only that case is handed to the daemon whole.
 * ✏ 2026-10-02 (41m): so is a new run for an open ticket whose latest run is
 * done or cancelled. It is handed to the daemon whole too.
 */
async function claimForTakeover(
  raw: string,
  target: TakeoverTarget,
  deps: TakeoverDeps,
  log: (message: string) => void,
): Promise<Claim> {
  const { store, statePath } = deps;
  if (statePath === undefined) return { kind: "no", code: 1 };

  // This terminal is what will be holding the run, and it says so on the run
  // itself (ADR-0049 D1). Until this, a claim recorded no owner at all — so a
  // second takeover was refused with a sentence about work nobody was doing,
  // and the sweep took the run away from a live conversation (timone#78, #63).
  const hold = takeHold(`timone takeover ${raw}`);

  const acquired = acquireStateLock({
    statePath,
    command: `timone takeover ${raw}`,
    staleAfterMs: 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000,
    // A takeover reclaims on the same evidence a daemon does — the holder's
    // process being gone (ADR-0025). It is a question anybody can ask the
    // OS, and withholding the answer here would leave a crashed daemon
    // wedging the very command an operator reaches for to unwedge it.
  });

  if (acquired.ok) {
    try {
      const resolution = await resolveTakeover(target, deps);
      if (resolution.kind !== "open-session") {
        log(refusalOf(target, resolution));
        return { kind: "no", code: 1 };
      }
      return {
        kind: "claimed",
        run: store.claim(resolution.run.id, hold, { takeover: true }),
      };
    } finally {
      acquired.lock.release();
    }
  }

  const { holder } = acquired.error;
  if (holder === undefined) {
    log(acquired.error.message);
    return { kind: "no", code: 1 };
  }

  // The ledger knows this ticket, so the refusals stay exactly as verified
  // against R14. ✏ 2026-10-02 (41m): working out the answer writes nothing
  // here. A new run for an open ticket whose latest run is settled is a
  // write, so the daemon makes it, from the request.
  // ✏ 2026-10-05 (ADR-0067 D1): a run whose step runs is not refused here.
  // The request is left as for any other, and the daemon writes this
  // terminal on the run as the one that waits for the step.
  if (store.runsForTicket(target.project, target.ticket).length > 0) {
    const found = await findTakeover(target, deps);
    if (found.kind === "nothing-to-do") {
      log(found.message);
      return { kind: "no", code: 1 };
    }
  }

  const name = `${target.project} #${target.ticket}`;
  const path = enqueue(statePath, {
    kind: "claim-takeover",
    project: target.project,
    ticket: target.ticket,
    holder: hold,
  });
  log(
    `${holder.command} (pid ${holder.pid}) has the ledger, so I've asked it to ` +
      `hand ${name} over on its next pass. Watching for that.`,
  );

  if (!(await waitUntilSettled(path, deps.wait))) {
    // **Taken back, not left behind** (ADR-0049 D3). Until this, the request
    // stayed on disk, the daemon applied it minutes later, and the run was
    // handed to a terminal that had gone — timone#78. Nothing else ended that
    // claim but the dead-run sweep.
    const withdrawn = await withdraw(path, target, hold, deps);
    if (withdrawn.kind === "applied") {
      // The race the withdraw has to detect rather than assume away: the
      // daemon had already read the request and was carrying it out as the
      // file was removed. It really did hand the run over, so saying it did
      // not would leave a claim nobody is holding.
      log(`The daemon handed ${name} over as I was giving up, so I have it.`);
      return withdrawn.claim;
    }
    log(
      `${name} is still queued. I waited ${waitWords(boundOf(deps.wait))} and ` +
        "the daemon didn't get to it — a cycle takes as long as whatever it " +
        "is running, so that is not a fault. I've taken the request back, so " +
        "nothing will happen behind you. Ask again whenever you like; " +
        "`timone status` shows where it stands.",
    );
    return { kind: "no", code: 1 };
  }

  const run = store.runsForTicket(target.project, target.ticket).at(-1);
  // ✏ 2026-10-05 (ADR-0067 D1, D3): the daemon wrote this terminal on the run
  // as the one that waits for its step. The step's end hands the run over.
  if (run?.waitingTerminal?.token === hold.token) {
    log(
      `Waiting for the step running on ${name} (${runningStepOf(run)}) to end, ` +
        "then I'll open the session here — press Ctrl-C to stop waiting, and " +
        "nothing changes.",
    );
    return waitForHandOver(target, hold, deps);
  }
  if (run === undefined || run.status !== "active") {
    log(
      `The daemon read the request and did not hand ${name} over — it is ` +
        `${run?.status ?? "not in the ledger"}. Its log says why.`,
    );
    return { kind: "no", code: 1 };
  }
  return { kind: "claimed", run };
}

/**
 * Watch the ledger until the run is claimed with this terminal's own token,
 * which the step's end does (ADR-0067 D2). No time limit: a step can run for
 * an hour (D3).
 */
async function waitForHandOver(
  target: TakeoverTarget,
  hold: Holder,
  deps: TakeoverDeps,
): Promise<Claim> {
  const intervalMs = deps.wait?.intervalMs ?? WATCH_INTERVAL_MS;
  const sleep =
    deps.wait?.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  for (;;) {
    const run = deps.store.runsForTicket(target.project, target.ticket).at(-1);
    if (run?.status === "active" && run.holder?.token === hold.token) {
      return { kind: "claimed", run };
    }
    await sleep(intervalMs);
  }
}

/**
 * End a takeover: give the run back to the runner, and say at the terminal
 * what happens next.
 *
 * **The runner reads what the session left** (PRD-05 R11), in plain words,
 * from the ticket. So nothing here reads the session's outcome: the run goes
 * back, and the runner is woken — now by a daemon that is running, or by the
 * next one to start.
 *
 * ✏ 2026-09-30: until the runner drove every project, a run of a project the
 * old daemon drove was moved on here when the session had recorded a
 * finished step (ADR-0049 D6, timone#76). The runner reads that record for
 * itself.
 *
 * **And it says so.** Ending silently is what left `ivtrends` #58 looking
 * answered: the person walked away from a terminal that had told them
 * nothing about what their session had or had not moved.
 */
async function endTakeover(
  target: TakeoverTarget,
  run: Run,
  deps: TakeoverDeps,
  log: (message: string) => void,
): Promise<void> {
  const { store } = deps;
  const name = `${target.project} #${target.ticket}`;

  // Somebody else moved it while the conversation ran — the daemon reclaimed
  // it, a `timone cancel` landed, another terminal took it. Saying so is the
  // point: this used to be a silent early return, which is timone#63's
  // handback that could never be read.
  const now = store.get(run.id);
  if (now === undefined || now.status !== "active") {
    log(
      `${name} moved while we were talking — it is now ` +
        `${now?.status ?? "gone from the ledger"}. I've left it alone rather ` +
        "than writing over whatever did that.",
    );
    return;
  }

  releaseClaim(target, run, deps, log);
  log(`${name} goes back to the runner. It reads what the session left as soon as the daemon runs.`);
}

/**
 * Take back a request the daemon has not carried out, and say whether that
 * worked (ADR-0049 D3).
 *
 * **The race is the whole of it.** Removing the file stops a daemon that has
 * not read it yet, and stops nothing at all in a daemon that read it a moment
 * ago and is applying it now — the daemon applies a request and settles it
 * afterwards, so a file still on disk proves nothing either way. So the
 * withdraw is not assumed to have worked: the ledger is watched for a short
 * while afterwards for this terminal's own hold, and a claim that lands is
 * accepted rather than abandoned.
 *
 * **This terminal's own token, and no weaker test.** A run that turns
 * `active` in this window could have been claimed by anything; only the token
 * minted for this command says it was claimed *for us*.
 */
async function withdraw(
  path: string,
  target: TakeoverTarget,
  hold: Holder,
  deps: TakeoverDeps,
): Promise<{ kind: "withdrawn" } | { kind: "applied"; claim: Claim }> {
  settleRequest(path);

  const { store } = deps;
  const intervalMs = deps.wait?.intervalMs ?? WITHDRAW_LOOK_MS;
  const sleep =
    deps.wait?.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));

  for (let looked = 0; looked <= WITHDRAW_LOOKS; looked += 1) {
    const run = store.runsForTicket(target.project, target.ticket).at(-1);
    if (
      run !== undefined &&
      run.status === "active" &&
      run.holder?.token === hold.token
    ) {
      return { kind: "applied", claim: { kind: "claimed", run } };
    }
    if (looked < WITHDRAW_LOOKS) await sleep(intervalMs);
  }
  return { kind: "withdrawn" };
}

/**
 * How long the withdraw watches the ledger, and how often.
 *
 * Short on purpose. The daemon writes the claim and settles the request in
 * the same breath, so a daemon that was mid-apply shows up almost at once;
 * anything longer would add a wait to a command that has just decided to stop
 * waiting.
 */
const WITHDRAW_LOOKS = 2;
const WITHDRAW_LOOK_MS = 1_000;

/** `30s`, `2m30s` — how long a command waited, in words. */
function waitWords(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

/** How long this command was told to wait, or the default it uses. */
function boundOf(wait: WaitOptions | undefined): number {
  return wait?.boundMs ?? WATCH_BOUND_MS;
}

/**
 * Give the run back to whatever it was waiting on.
 *
 * **Synchronous on every road**, which is what lets a signal handler use it:
 * taking the lock is a file create, and leaving a request is a file write.
 * Neither waits for anything.
 *
 * The claim kept the run's wait on it ({@link RunStore.claim} says so
 * deliberately), so what it goes back to is read off the run itself rather
 * than remembered by this process — a process that may not be alive to
 * remember anything.
 */
function releaseClaim(
  target: TakeoverTarget,
  run: Run,
  deps: TakeoverDeps,
  log: (message: string) => void,
): void {
  const { store, statePath } = deps;
  if (statePath === undefined) return;
  if (store.get(run.id)?.status !== "active") return;

  const acquired = acquireStateLock({
    statePath,
    command: "timone takeover (giving the run back)",
    staleAfterMs: 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000,
  });
  if (acquired.ok) {
    let parked = false;
    try {
      store.park(run.id, waitOf(run));
      parked = true;
    } catch (error) {
      log(error instanceof Error ? error.message : String(error));
    } finally {
      acquired.lock.release();
    }
    // ✏ No daemon is running, so nothing can wake the runner now, and the
    // session's closing comment is the machine's own, which never wakes it
    // (PRD-05 R10). The next daemon is asked to, on its first cycle (R11).
    if (parked) {
      enqueue(statePath, {
        kind: "takeover-ended",
        project: target.project,
        ticket: target.ticket,
      });
    }
    return;
  }
  if (acquired.error.holder === undefined) return;

  enqueue(statePath, {
    kind: "release-takeover",
    project: target.project,
    ticket: target.ticket,
    outcome: "ended",
  });
}

/**
 * The session bound to no step: the terminal, and a prompt that names no
 * stage. The ticket is read here, once, for the prompt.
 *
 * ✏ 2026-09-30: the only session a takeover opens. Its twin, the session
 * bound to the stage a run was parked on for a conversation, went with the
 * old code between steps.
 */
async function openSession(
  target: TakeoverTarget,
  run: Run,
  deps: TakeoverDeps,
  log: (message: string) => void,
): Promise<number> {
  const project = {
    name: target.project,
    repoUrl: deps.manifest.projects[target.project].repo_url,
  };
  const thread = await deps.adapter.getTicket(project, target.ticket);
  const prompt = takeoverPrompt(target.project, run, thread, {
    record: readRecord(deps.root, target.project, target.ticket),
    namedPeople: namedPeople(deps.manifest, target.project),
  });

  log(
    `Picking up ${target.project} #${target.ticket} here. When you end this ` +
      "session, the runner reads the ticket and decides what comes next.",
  );
  return deps.launcher.run("claude", [prompt], { cwd: deps.root });
}

/** The takeover itself, once this process is the ledger's only writer. */
async function takeover(
  raw: string,
  deps: TakeoverDeps,
  log: (message: string) => void,
): Promise<number> {
  let target: TakeoverTarget;
  try {
    target = parseTarget(raw);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const resolution = await resolveTakeover(target, deps);
  if (resolution.kind !== "open-session") {
    log(refusalOf(target, resolution));
    return 1;
  }
  return openSession(target, resolution.run, deps, log);
}

/**
 * The real launcher: inherit stdio so the human's terminal *is* the session's
 * terminal. Anything that captured the streams would turn the conversation
 * into a log of one.
 */
export const inheritingLauncher: ProcessLauncher = {
  run(command, args, options): Promise<number> {
    return new Promise((done, fail) => {
      const child = spawn(command, [...args], {
        cwd: options.cwd,
        stdio: "inherit",
      });
      child.on("error", fail);
      child.on("close", (code) => done(code ?? 0));
    });
  },
};

/** Register the `takeover` command on the program. */
export function registerTakeoverCommand(program: Command): void {
  program
    .command("takeover")
    .argument("<ticket>", "which ticket to pick up, as <project>#<ticket>")
    .description("Work on a ticket in this terminal, then give it back to the runner")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .option("--state <path>", "path to the daemon state file")
    .action(
      async (ticket: string, options: { manifest: string; state?: string }) => {
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

        let store: RunStore;
        try {
          store = RunStore.open(statePath, { placesOf: placesIn(manifest) });
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          process.exitCode = 1;
          return;
        }

        process.exitCode = await runTakeover(ticket, {
          manifest,
          store,
          statePath,
          adapter: new GitHubTicketingAdapter(),
          launcher: inheritingLauncher,
          root: process.cwd(),
        });
      },
    );
}
