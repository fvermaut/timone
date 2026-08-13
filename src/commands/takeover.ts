import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Command } from "commander";

import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import type { TicketingAdapter, TicketThread } from "../adapters/ticketing.js";
import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, runId, type Run } from "../daemon/runs.js";
import type { PipelineStage } from "../daemon/pipeline.js";
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
   * Absent means no lock is taken — the shape the resolution tests use, since
   * working out what a ticket is waiting on writes nothing.
   */
  statePath?: string;
  adapter: TicketingAdapter;
  launcher: ProcessLauncher;
  /** The timone root: the conversation runs here, never in the project (ADR-0007). */
  root: string;
  log?: (message: string) => void;
}

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
 * Work out what this ticket is waiting on, from the ledger.
 *
 * Every answer is a full sentence about the ticket's actual state, because a
 * takeover that finds nothing to do is the commonest case for someone who
 * typed the command hopefully — and "nothing to do" without a reason is what
 * makes a tool feel broken.
 */
export function resolveTakeover(
  target: TakeoverTarget,
  deps: Pick<TakeoverDeps, "manifest" | "store">,
): Exclude<TakeoverResolution, { kind: "converse" }> | { kind: "converse"; run: Run; stage: PipelineStage } {
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

  const run = store.get(runId(target.project, target.ticket));
  if (run === undefined) {
    return {
      kind: "nothing-to-do",
      message:
        `I'm not working on ${target.project} #${target.ticket}. ` +
        "Add the `timone` label to that ticket and I'll pick it up.",
    };
  }

  switch (run.status) {
    case "queued":
      return {
        kind: "nothing-to-do",
        message:
          `${target.project} #${target.ticket} is in the queue — I take one ` +
          "thing at a time on a project. I'll start it when the one ahead is done.",
      };
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

  const resolution = resolveTakeover(target, deps);
  if (resolution.kind !== "converse") {
    log(resolution.message);
    return resolution.kind === "answer-on-ticket" ? 0 : 1;
  }

  const project = {
    name: target.project,
    repoUrl: deps.manifest.projects[target.project].repo_url,
  };
  if (!(PROMPTED_STAGES as readonly string[]).includes(resolution.stage)) {
    log(
      `${target.project} #${target.ticket} is waiting at a stage I can't hold a ` +
        "conversation for yet. Nothing has changed.",
    );
    return 1;
  }

  const thread = await deps.adapter.getTicket(project, target.ticket);
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
