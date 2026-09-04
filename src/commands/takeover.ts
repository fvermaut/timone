import { spawn } from "node:child_process";
import { heldStepWayOut } from "../daemon/dropped.js";
import { HELD_LABEL } from "../daemon/steps.js";
import { resolve } from "node:path";
import type { Command } from "commander";

import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import type {
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";
import {
  waitFor,
  wayfinderStage,
  type PipelineStage,
} from "../daemon/pipeline.js";
import { outcomeCursorFrom } from "../daemon/outcomes.js";
import {
  PROMPTED_STAGES,
  escalationPrompt,
  takeoverPrompt,
} from "../daemon/prompts.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { acquireStateLock } from "../daemon/lock.js";
import { takeHold, type Holder } from "../daemon/holder.js";
import {
  enqueue,
  settle as settleRequest,
  waitUntilSettled,
  WATCH_BOUND_MS,
  type WaitOptions,
} from "../daemon/requests.js";
import { intervalTicker, waitOf, type Ticker } from "../daemon/session.js";

/** A parsed `<project>#<ticket>` target. */
export interface TakeoverTarget {
  project: string;
  ticket: number;
}

/** What a takeover turns out to be. */
export type TakeoverResolution =
  | { kind: "converse"; run: Run; stage: PipelineStage; thread: TicketThread }
  /**
   * The machinery stopped on this one and cannot take it further itself
   * ([ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)).
   * What opens is a session bound to no stage — which is why no stage travels
   * with this resolution, and why the stage the run stopped at is not checked
   * against `PROMPTED_STAGES`: the stop happens at work stages no
   * conversation exists for, and refusing there is the wedge this exists to
   * prevent.
   */
  | { kind: "escalation"; run: Run; thread?: TicketThread }
  /** The ticket is waiting, but on a reply rather than on an interview. */
  | { kind: "answer-on-ticket"; message: string }
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
 */
export async function resolveTakeover(
  target: TakeoverTarget,
  deps: TakeoverResolutionDeps,
): Promise<
  | Exclude<TakeoverResolution, { kind: "converse" }>
  | { kind: "converse"; run: Run; stage: PipelineStage; thread?: TicketThread }
> {
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
  if (run === undefined) return enrolFromTracker(target, deps);

  switch (run.status) {
    case "queued":
      return { kind: "nothing-to-do", message: queuedMessage(target) };
    case "picked-up":
    case "active":
      return {
        kind: "nothing-to-do",
        message:
          `I'm working on ${target.project} #${target.ticket} right now. ` +
          "Anything I need from you will land on the ticket.",
      };
    case "done":
      return {
        kind: "nothing-to-do",
        message: `${target.project} #${target.ticket} is finished — see the ticket.`,
      };
    case "failed":
      return {
        kind: "nothing-to-do",
        message:
          `${target.project} #${target.ticket} stopped early: ` +
          `${run.failure ?? "no reason recorded"}. Re-mark the ticket to try again.`,
      };
    case "cancelled": {
      // Abandoned, not broken — so the words say what `timone retry`'s own
      // refusal says (`RunStore.retry`), and never that something went wrong.
      // Its reason lives in `cancellation` rather than `failure` for exactly
      // that reason, and dropping the clause when there is none beats a
      // sentence reading "cancelled: " with nothing after it.
      const because =
        run.cancellation === undefined || run.cancellation === ""
          ? "."
          : `: ${run.cancellation}.`;
      return {
        kind: "nothing-to-do",
        message:
          `${target.project} #${target.ticket} was cancelled${because} ` +
          "Cancelled work isn't picked up again — " +
          (heldStepWayOut(store, target.project, target.ticket) ??
            "reopen the ticket and mark it for me, and I'll start it afresh " +
              "on my next pass."),
      };
    }
    case "parked":
      break;
  }

  if (run.wait?.kind === "gate") {
    return {
      kind: "answer-on-ticket",
      message:
        `${target.project} #${target.ticket} isn't waiting for a conversation — ` +
        `it's waiting for your answer on the ticket: ${run.wait?.on ?? "a decision"}. ` +
        "Reply there and I'll carry on from your reply.",
    };
  }

  if (run.wait?.kind === "review") {
    return {
      kind: "answer-on-ticket",
      message:
        `${target.project} #${target.ticket} isn't waiting for a conversation — ` +
        `its work is open as pull request #${run.pr ?? "?"}, waiting for your ` +
        "review. Comment or merge there, and I'll carry on from what you do.",
    };
  }

  // Before the conversation branch, because a run stopped this way is
  // parked at a work stage — `verification` on ivtrends #1 — and the
  // conversation branch would refuse it with the sentence about a stage it
  // cannot hold a conversation for. That refusal, on the one park whose CTA
  // hands the human this very command, is the wedged project ADR-0033's
  // ordering exists to prevent.
  if (run.wait?.kind === "escalation") {
    return { kind: "escalation", run };
  }

  if (run.wait?.kind !== "conversation" || run.stage === undefined) {
    return {
      kind: "nothing-to-do",
      message:
        `${target.project} #${target.ticket} is parked, but not on anything I ` +
        `can pick up in a conversation: ${run.wait?.on ?? "no reason recorded"}.`,
    };
  }

  return { kind: "converse", run, stage: run.stage };
}

/**
 * Take a ticket the ledger has never heard of, and make it a run
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
 * pick up, each with a sentence of its own, because "closed" and "no such
 * ticket" are different things to have got wrong.
 */
async function enrolFromTracker(
  target: TakeoverTarget,
  deps: TakeoverResolutionDeps,
): Promise<
  | Exclude<TakeoverResolution, { kind: "converse" }>
  | { kind: "converse"; run: Run; stage: PipelineStage; thread: TicketThread }
> {
  const { manifest, store, adapter } = deps;
  const project = {
    name: target.project,
    repoUrl: manifest.projects[target.project].repo_url,
  };

  const open = await adapter.listOpenTickets(project);
  const ticket = open.find((candidate) => candidate.number === target.ticket);
  if (ticket === undefined) return notOpen(target, project, adapter);

  const stage = entryStage(ticket.labels);
  // Asked **before** anything is written down. A stage this command cannot
  // hold a conversation for is one it is about to refuse, and a run created
  // on the way to a refusal is worse than the refusal: on a map it would open
  // a wait nobody asked for, which is ADR-0024's own fault inverted.
  if (!isPrompted(stage)) {
    return { kind: "nothing-to-do", message: cannotConverse(target) };
  }

  const created = store.register(target.project, target.ticket).run;
  if (created.status === "queued") {
    return { kind: "nothing-to-do", message: queuedMessage(target) };
  }

  const thread = await adapter.getTicket(project, target.ticket);
  const run = settle(created, stage, thread, store);
  return { kind: "converse", run, stage, thread };
}

/**
 * Put the new run into the state the **daemon's own pickup** would have left
 * it in at this stage, and no other. That is the whole rule, and it is what
 * keeps a takeover-created run resumable by the machinery that already exists
 * rather than by something new.
 *
 * - A stage that waits on a conversation is parked on one, exactly as
 *   `openConversation` parks it — minus the invitation, which would be a
 *   question posted at somebody already sitting in the conversation. The
 *   daemon then resumes this run off the record the session posts, or off a
 *   written answer, by the path it has always used.
 * - Anything else keeps the `picked-up` that {@link RunStore.register} just
 *   gave it, with its stage written down. It is not waiting on a human, so
 *   saying it is would be a lie in the ledger *and* on the ticket — `ctaFor`
 *   reads the same fields.
 */
function settle(
  run: Run,
  stage: PipelineStage,
  thread: TicketThread,
  store: RunStore,
): Run {
  if (waitFor(stage) !== "conversation") return store.setStage(run.id, stage);

  return store.park(run.id, {
    waitingOn: "a conversation in your terminal",
    kind: "conversation",
    stage,
    // Everything already on the ticket was said before this conversation was
    // opened, so none of it can answer it — `outcomeCursorFrom`'s own rule.
    // A cursor at the machine's last word instead would have the next cycle
    // read something the human wrote before anybody had asked them anything,
    // and resume this run behind the session they are sitting in.
    waitCursor: outcomeCursorFrom(thread),
  });
}

/**
 * Where a ticket with no run enters the pipeline, read off the labels the
 * tracker holds — `entryContext`'s rule in `poll.ts` (a wayfinder ticket
 * enters at its own stage, because a session already decided what kind of
 * question it holds), and the spawner's default behind it.
 */
function entryStage(labels: readonly string[]): PipelineStage {
  return wayfinderStage(labels) ?? "triage";
}

/** Whether a conversation can be held for `stage` at all. */
function isPrompted(stage: PipelineStage): boolean {
  return (PROMPTED_STAGES as readonly string[]).includes(stage);
}

/**
 * What a ticket waiting at a stage no conversation exists for is told. One
 * copy of the sentence, said by both the run that was already there and the
 * ticket this command declined to create one for.
 */
function cannotConverse(target: TakeoverTarget): string {
  return (
    `${target.project} #${target.ticket} is waiting at a stage I can't hold a ` +
    "conversation for yet. Nothing has changed."
  );
}

/** What a ticket behind another on its project is told. */
function queuedMessage(target: TakeoverTarget): string {
  return (
    `${target.project} #${target.ticket} is in the queue — I take one ` +
    "thing at a time on a project. I'll start it when the one ahead is done."
  );
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

  // From here the run's *status* is what holds the project — a RUNNING status
  // occupies the one-session slot, which is how the daemon's own sessions have
  // always had exclusivity (ADR-0032). No lock is held across the
  // conversation, so the daemon carries on with every other project.
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
    return claimed.escalation === true
      ? await escalate(target, claimed.run, claimed.thread, deps, log)
      : await converse(target, claimed.run, claimed.thread, deps, log);
  } finally {
    process.off("SIGINT", giveBack);
    process.off("SIGTERM", giveBack);
    giveBack();
  }
}

/** A claimed run, or the exit code of a takeover that never started one. */
type Claim =
  | { kind: "claimed"; run: Run; thread?: TicketThread; escalation?: true }
  | { kind: "no"; code: number };

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
 * gets the same sentence they have always got about a gate, a review, a
 * finished run. Only enrolling a ticket the ledger has never heard of is a
 * write, and only that case is handed to the daemon whole.
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
      if (resolution.kind === "escalation") {
        return {
          kind: "claimed",
          run: store.claim(resolution.run.id, hold),
          escalation: true,
        };
      }
      if (resolution.kind !== "converse") {
        log(resolution.message);
        return { kind: "no", code: resolution.kind === "answer-on-ticket" ? 0 : 1 };
      }
      if (!isPrompted(resolution.stage)) {
        log(cannotConverse(target));
        return { kind: "no", code: 1 };
      }
      return {
        kind: "claimed",
        run: store.claim(resolution.run.id, hold),
        ...(resolution.thread === undefined ? {} : { thread: resolution.thread }),
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

  // The ledger knows this ticket, so resolving it writes nothing and the
  // refusals stay exactly as verified against R14.
  if (store.runsForTicket(target.project, target.ticket).length > 0) {
    const resolution = await resolveTakeover(target, deps);
    if (resolution.kind !== "converse" && resolution.kind !== "escalation") {
      log(resolution.message);
      return { kind: "no", code: resolution.kind === "answer-on-ticket" ? 0 : 1 };
    }
    if (resolution.kind === "converse" && !isPrompted(resolution.stage)) {
      log(cannotConverse(target));
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
  if (run === undefined || run.status !== "active") {
    log(
      `The daemon read the request and did not hand ${name} over — it is ` +
        `${run?.status ?? "not in the ledger"}. Its log says why.`,
    );
    return { kind: "no", code: 1 };
  }
  // The claim cleared nothing about what the run was waiting on
  // (`RunStore.claim` keeps the wait deliberately), so which session to open
  // is still readable off the run the daemon handed back.
  return run.wait?.kind === "escalation"
    ? { kind: "claimed", run, escalation: true }
    : { kind: "claimed", run };
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
      return {
        kind: "applied",
        claim:
          run.wait?.kind === "escalation"
            ? { kind: "claimed", run, escalation: true }
            : { kind: "claimed", run },
      };
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
    try {
      store.park(run.id, waitOf(run));
    } catch (error) {
      log(error instanceof Error ? error.message : String(error));
    } finally {
      acquired.lock.release();
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
 * The conversation itself, holding no lock. Everything it needs was decided
 * before the claim; all that is left is the prompt and the terminal.
 */
async function converse(
  target: TakeoverTarget,
  run: Run,
  known: TicketThread | undefined,
  deps: TakeoverDeps,
  log: (message: string) => void,
): Promise<number> {
  const project = {
    name: target.project,
    repoUrl: deps.manifest.projects[target.project].repo_url,
  };
  const stage = run.stage;
  if (stage === undefined || !isPrompted(stage)) {
    log(cannotConverse(target));
    return 1;
  }

  // Read again only where the claim had no reason to: a ticket enrolled from
  // the tracker was already fetched to open its wait from, and fetching it
  // twice in one command is the fault 19d closed in the poll loop.
  const thread = known ?? (await deps.adapter.getTicket(project, target.ticket));
  const prompt = takeoverPrompt(
    target.project,
    stage as (typeof PROMPTED_STAGES)[number],
    thread,
  );

  log(`Picking up ${target.project} #${target.ticket} — over to you.`);
  return deps.launcher.run("claude", [prompt], { cwd: deps.root });
}

/**
 * The unbound session: the same terminal, and a prompt that names no stage.
 *
 * It reads beside {@link converse} on purpose. Everything about the command is
 * the same — the claim, the launcher, the root — and exactly one thing differs:
 * what the session is told it is.
 */
async function escalate(
  target: TakeoverTarget,
  run: Run,
  known: TicketThread | undefined,
  deps: TakeoverDeps,
  log: (message: string) => void,
): Promise<number> {
  const project = {
    name: target.project,
    repoUrl: deps.manifest.projects[target.project].repo_url,
  };
  const thread = known ?? (await deps.adapter.getTicket(project, target.ticket));
  const prompt = escalationPrompt(target.project, run, thread);

  log(
    `Picking up ${target.project} #${target.ticket} — I couldn't take this one ` +
      "further myself. Over to you.",
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
  if (resolution.kind === "escalation") {
    return escalate(target, resolution.run, resolution.thread, deps, log);
  }
  if (resolution.kind !== "converse") {
    log(resolution.message);
    return resolution.kind === "answer-on-ticket" ? 0 : 1;
  }

  const project = {
    name: target.project,
    repoUrl: deps.manifest.projects[target.project].repo_url,
  };
  if (!isPrompted(resolution.stage)) {
    log(cannotConverse(target));
    return 1;
  }

  // Read again only where the resolution had no reason to: a ticket enrolled
  // from the tracker was already fetched to open its wait from, and fetching
  // it twice in one command is the fault 19d closed in the poll loop.
  const thread =
    resolution.thread ?? (await deps.adapter.getTicket(project, target.ticket));
  const prompt = takeoverPrompt(
    target.project,
    resolution.stage as (typeof PROMPTED_STAGES)[number],
    thread,
  );

  log(`Picking up ${target.project} #${target.ticket} — over to you.`);
  return deps.launcher.run("claude", [prompt], { cwd: deps.root });
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
    .description("Pick up a ticket that is waiting to talk something through")
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
          store = RunStore.open(statePath);
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
