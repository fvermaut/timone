import { query } from "@anthropic-ai/claude-agent-sdk";

import type { Manifest } from "../manifest.js";
import {
  MACHINE_MARKER,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import type { SessionSpawner } from "./poll.js";
import type { Run, RunStore } from "./runs.js";

/** What the spawner asks a runtime to run. */
export interface SessionRequest {
  /** Always the timone root — sessions never run inside a managed project. */
  cwd: string;
  prompt: string;
}

/** How a session ended. */
export interface SessionOutcome {
  sessionId: string;
  ok: boolean;
  error?: string;
}

/** A session that has started and will finish. */
export interface StartedSession {
  sessionId: string;
  completed: Promise<SessionOutcome>;
}

/**
 * The agent runtime, behind an interface so the spawner's configuration —
 * the part that carries the process rules — is testable without the SDK.
 */
export interface SessionRuntime {
  start(request: SessionRequest): Promise<StartedSession>;
}

export interface AgentSessionSpawnerOptions {
  manifest: Manifest;
  store: RunStore;
  adapter: TicketingAdapter;
  runtime: SessionRuntime;
  /** The timone root; every session runs here (ADR-0007). */
  root: string;
  /**
   * Guardrail bracket (R15): `beforeSession` records the state of the world
   * before the session touches it, `afterSession` judges what changed.
   */
  beforeSession?: (run: Run, project: TicketingProject) => Promise<void>;
  afterSession?: (run: Run, project: TicketingProject) => Promise<void>;
  log?: (message: string) => void;
}

/**
 * Build the session's instruction. Two rules shape it:
 *
 * - **The session classifies; the spawner does not.** The daemon knows only
 *   that a ticket was marked. Deciding what kind of request it is belongs to
 *   stage 1, run by an agent that has read the raw text — so this prompt
 *   carries the text and the instruction to classify, never a verdict.
 * - **The human's words are quoted, never paraphrased.** A naive ticket body
 *   is the evidence triage works from; summarizing it here would hand the
 *   session a pre-digested version of the thing it is supposed to read.
 */
export function triagePrompt(
  project: TicketingProject,
  ticket: TicketThread,
): string {
  // Who said what matters more than it looks: Timone posts under a person's
  // account, so the author line is the same for both. Attribution here comes
  // from the marker, never from the login.
  const thread =
    ticket.comments.length === 0
      ? ""
      : [
          "",
          "Replies on the ticket, oldest first. Note who wrote each one — Timone",
          "posts under the same account as the human, so the author name does not",
          "tell you apart from them:",
          ...ticket.comments.map((comment) => {
            const who = comment.fromTimone
              ? "Timone (you), earlier"
              : `${comment.author} (a person)`;
            return `\n--- ${who}, at ${comment.createdAt} ---\n${comment.body}`;
          }),
          "",
        ].join("\n");

  return [
    `A ticket was filed on the managed project **${project.name}** and marked for Timone.`,
    "",
    `Project: ${project.name} — touch only \`projects/${project.name}/…\`.`,
    `Ticket: #${ticket.number} — ${ticket.title}`,
    `URL: ${ticket.url}`,
    `Filed by: ${ticket.author}`,
    "",
    "--- the ticket, in the words it was written in ---",
    ticket.body,
    "--- end of ticket ---",
    thread,
    "You are running at the timone root. Follow `process.md` and `CLAUDE.md`.",
    "",
    "**This request has not been classified.** Classify it yourself by running",
    "stage 1 on the raw text above — do not assume what kind of request it is,",
    "and do not act on it beyond classifying it.",
    "",
    "Record the outcome the way the process requires: the classification and its",
    `rationale as a comment on ticket #${ticket.number}, and a \`triage:<kind>\` label`,
    "on the issue. Write the comment for someone who knows nothing about this",
    "process — no stage numbers, no skill names — and end it with an explicit",
    "line saying what, if anything, is being asked of them.",
    "",
    "**Every comment you post on the ticket must start with this exact line,**",
    "followed by a blank line, `---` and a blank line, then your text. You are",
    "posting through a person's GitHub account: without it the thread reads as",
    "though they wrote your words, and neither they nor a later session can tell",
    "your output from theirs.",
    "",
    MACHINE_MARKER,
    "",
    "Then stop. The stages that would follow are not built yet; the run will be",
    "parked after you finish.",
  ].join("\n");
}

/** The comment posted when a run parks at the end of triage. */
export function parkedComment(): string {
  return [
    "**That's as far as I can take this one for now.**",
    "",
    "I've worked out what kind of request this is and written it above. Acting on",
    "it — asking you the questions it raises, then planning and building it — is",
    "the next piece of machinery being built, and it isn't ready yet.",
    "",
    "**What I need from you:** nothing right now — this ticket keeps its place and picks up from here once that machinery lands.",
  ].join("\n");
}

/** The comment posted when a session ends badly. */
export function failedComment(reason: string): string {
  return [
    "**Something went wrong while I was working on this.**",
    "",
    `The session stopped early: ${reason}`,
    "",
    "Nothing was decided about this ticket, so nothing here is final.",
    "",
    "**What I need from you:** re-mark this ticket when you want me to try again," +
      " or leave it and tell me what looks wrong.",
  ].join("\n");
}

/** Reduce an error to one readable line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}

/**
 * Starts one agent session per picked-up run and drives that run's state
 * from the session's lifecycle.
 *
 * Two invariants live here rather than in the prompt, because a prompt is a
 * request and an invariant is not: the target project must be declared in
 * `timone.yaml` before anything is spawned (R2), and the session's working
 * directory is the timone root, never the project checkout (ADR-0007).
 */
export class AgentSessionSpawner implements SessionSpawner {
  private readonly log: (message: string) => void;

  constructor(private readonly options: AgentSessionSpawnerOptions) {
    this.log = options.log ?? (() => {});
  }

  async spawn(run: Run, project: TicketingProject): Promise<void> {
    const { manifest, store, adapter, runtime, root } = this.options;

    if (!(project.name in manifest.projects)) {
      throw new Error(
        `Refusing to spawn a session for "${project.name}": it is not declared in the manifest`,
      );
    }

    const ticket = await adapter.getTicket(project, run.ticket);

    if (this.options.beforeSession !== undefined) {
      try {
        await this.options.beforeSession(run, project);
      } catch (error) {
        this.log(`pre-session snapshot failed for ${run.id}: ${oneLine(error)}`);
      }
    }

    const started = await runtime.start({
      cwd: root,
      prompt: triagePrompt(project, ticket),
    });
    store.activate(run.id, started.sessionId);
    this.log(`session ${started.sessionId} started for ${run.id}`);

    const outcome = await started.completed;

    let finished: Run;
    if (outcome.ok) {
      finished = store.park(run.id, "the next stage to be built", "triage");
      await adapter.postComment(project, run.ticket, parkedComment());
    } else {
      const reason = outcome.error ?? "the session ended without a result";
      finished = store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
    }

    // Guardrails report; they never decide whether the run succeeded, and a
    // broken check must not take the daemon down with it.
    if (this.options.afterSession !== undefined) {
      try {
        await this.options.afterSession(finished, project);
      } catch (error) {
        this.log(`post-session checks failed for ${run.id}: ${oneLine(error)}`);
      }
    }
  }
}

/**
 * The real runtime: one Claude Agent SDK session per run (ADR-0002).
 *
 * Permissions are bypassed because there is no human at the keyboard to
 * answer a prompt — a daemon session that asks would hang forever. That is
 * the accepted risk PRD-02 records for sandboxing; the path-containment
 * guardrail (R15) is what catches a session that strays.
 */
export const agentSdkRuntime: SessionRuntime = {
  async start(request: SessionRequest): Promise<StartedSession> {
    const session = query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    });

    let resolveId!: (id: string) => void;
    const sessionId = new Promise<string>((resolve) => {
      resolveId = resolve;
    });

    const completed = (async (): Promise<SessionOutcome> => {
      let id = "unknown";
      try {
        for await (const message of session) {
          if ("session_id" in message && typeof message.session_id === "string") {
            id = message.session_id;
            resolveId(id);
          }
          if (message.type === "result") {
            resolveId(id);
            return message.subtype === "success"
              ? { sessionId: id, ok: true }
              : { sessionId: id, ok: false, error: message.subtype };
          }
        }
        resolveId(id);
        return { sessionId: id, ok: false, error: "session ended with no result" };
      } catch (error) {
        resolveId(id);
        return { sessionId: id, ok: false, error: oneLine(error) };
      }
    })();

    return { sessionId: await sessionId, completed };
  },
};
