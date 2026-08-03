import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { Command } from "commander";

import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import type { TicketingAdapter, TicketThread } from "../adapters/ticketing.js";
import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, runId, type Run } from "../daemon/runs.js";
import type { PipelineStage } from "../daemon/pipeline.js";
import { takeoverCommand } from "../channels/terminal.js";

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
 * Build the instruction the interactive session starts from.
 *
 * It is a router, not a memory ([ADR-0013](../../doc/adr/0013-stateless-session-reentry.md)):
 * the session is handed the project, the ticket with its thread, and which
 * stage it is resuming — and rebuilds everything else from the artifacts. If
 * that is not enough to continue, the deficiency is in the artifacts, which
 * is the point.
 */
export function takeoverPrompt(
  project: string,
  stage: PipelineStage,
  ticket: TicketThread,
): string {
  const thread =
    ticket.comments.length === 0
      ? "(no replies yet)"
      : ticket.comments
          .map((comment) => {
            const who = comment.fromTimone
              ? "Timone (you), earlier"
              : `${comment.author} (a person)`;
            return `--- ${who}, at ${comment.createdAt} ---\n${comment.body}`;
          })
          .join("\n\n");

  return [
    `You are resuming work on the managed project **${project}**, at the`,
    `**${stage}** stage. A human has just opened this session by running`,
    `\`${takeoverCommand(project, ticket.number)}\` — they are at the keyboard now,`,
    "and this is a conversation with them, not a batch job.",
    "",
    `Project: ${project} — touch only \`projects/${project}/…\`.`,
    `Ticket: #${ticket.number} — ${ticket.title}`,
    `URL: ${ticket.url}`,
    `Filed by: ${ticket.author}`,
    "",
    "--- the ticket, in the words it was written in ---",
    ticket.body,
    "--- end of ticket ---",
    "",
    "Replies so far, oldest first. Timone posts under the same account as the",
    "human, so the author name does not tell you apart from them — the labels",
    "below do:",
    "",
    thread,
    "",
    "You are running at the timone root. Follow `process.md` and `CLAUDE.md`,",
    "and rebuild whatever else you need from the committed artifacts and the",
    "thread above — nothing was carried over from the session that parked this.",
    "",
    "Run the stage that owns this work and hold the conversation it calls for.",
    "The human knows nothing about the process: never ask them to name a stage",
    "or a skill, and never make them repeat something the ticket already says.",
    "",
    "When you have what you need, summarize what you agreed, get their explicit",
    "acceptance of that summary, and post the accepted summary to the ticket as",
    "the record. The conversation itself is not an artifact and nothing may",
    "cite it. If they leave without accepting, say so on the ticket and change",
    "nothing else.",
  ].join("\n");
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
  const thread = await deps.adapter.getTicket(project, target.ticket);
  const prompt = takeoverPrompt(target.project, resolution.stage, thread);

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
          adapter: new GitHubTicketingAdapter(),
          launcher: inheritingLauncher,
          root: process.cwd(),
        });
      },
    );
}
