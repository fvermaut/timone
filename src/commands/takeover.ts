import { spawn } from "node:child_process";
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
import { PROMPTED_STAGES, takeoverPrompt } from "../daemon/prompts.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { withStateLock } from "../daemon/lock.js";

/** A parsed `<project>#<ticket>` target. */
export interface TakeoverTarget {
  project: string;
  ticket: number;
}

/** What a takeover turns out to be. */
export type TakeoverResolution =
  | { kind: "converse"; run: Run; stage: PipelineStage; thread: TicketThread }
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
  /** The timone root: the conversation runs here, never in the project (ADR-0007). */
  root: string;
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
    case "parked":
      break;
  }

  if (run.waitingKind === "gate") {
    return {
      kind: "answer-on-ticket",
      message:
        `${target.project} #${target.ticket} isn't waiting for a conversation — ` +
        `it's waiting for your answer on the ticket: ${run.waitingOn ?? "a decision"}. ` +
        "Reply there and I'll carry on from your reply.",
    };
  }

  if (run.waitingKind === "review") {
    return {
      kind: "answer-on-ticket",
      message:
        `${target.project} #${target.ticket} isn't waiting for a conversation — ` +
        `its work is open as pull request #${run.pr ?? "?"}, waiting for your ` +
        "review. Comment or merge there, and I'll carry on from what you do.",
    };
  }

  if (run.waitingKind !== "conversation" || run.stage === undefined) {
    return {
      kind: "nothing-to-do",
      message:
        `${target.project} #${target.ticket} is parked, but not on anything I ` +
        `can pick up in a conversation: ${run.waitingOn ?? "no reason recorded"}.`,
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

  const held = await withStateLock(
    {
      statePath: deps.statePath,
      command: `timone takeover ${raw}`,
      staleAfterMs: 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000,
      // A takeover reclaims on the same evidence a daemon does — the holder's
      // process being gone (ADR-0025). It is a question anybody can ask the
      // OS, and withholding the answer here would leave a crashed daemon
      // wedging the very command an operator reaches for to unwedge it.
    },
    () => takeover(raw, deps, log),
  );

  if (held.ok) return held.value;
  log(held.error.message);
  return 1;
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
