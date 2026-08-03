import { query } from "@anthropic-ai/claude-agent-sdk";

import type { Manifest } from "../manifest.js";
import type {
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import {
  inviteToConversation,
  type ConversationChannel,
} from "../channels/conversation.js";
import { TerminalChannel } from "../channels/terminal.js";
import { waitCursorFrom } from "./gates.js";
import {
  classificationFromLabels,
  isBuilt,
  processStage,
  routeAfterTriage,
  runsUnattended,
  waitFor,
  type PipelineStage,
} from "./pipeline.js";
import type { SessionSpawner, SpawnContext } from "./poll.js";
import { PROMPTED_STAGES, conversationSubject, stagePrompt } from "./prompts.js";
import type { ParkOptions, Run, RunStore } from "./runs.js";

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
  /** Where multi-turn conversations happen. Defaults to the terminal. */
  channel?: ConversationChannel;
  /**
   * Guardrail bracket (R15): `beforeSession` records the state of the world
   * before the session touches it, `afterSession` judges what changed.
   */
  beforeSession?: (run: Run, project: TicketingProject) => Promise<void>;
  afterSession?: (run: Run, project: TicketingProject) => Promise<void>;
  log?: (message: string) => void;
}

/** The comment posted when a run reaches a stage this phase has not built. */
export function parkedComment(stage: PipelineStage): string {
  return [
    "**That's as far as I can take this one for now.**",
    "",
    `Everything up to this point is done and written on this ticket. What comes`,
    `next — process stage ${processStage(stage)} — is machinery that isn't built yet.`,
    "",
    "**What I need from you:** nothing right now — this ticket keeps its place and picks up from here once that machinery lands.",
  ].join("\n");
}

/** The comment posted when a question has been answered and nothing follows. */
export function answeredComment(): string {
  return [
    "**Answered above — and that's the whole of it.**",
    "",
    "This one was a question rather than something to build, so there's nothing",
    "to plan and nothing to make. I'm closing my side of it.",
    "",
    "**What I need from you:** nothing — reopen or file a new ticket if you want something built.",
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

/** The comment posted when triage finished without recording a classification. */
export function unclassifiedComment(): string {
  return [
    "**I couldn't work out what kind of request this is.**",
    "",
    "I read it and finished without reaching a conclusion I could act on, which",
    "is my failure and not yours.",
    "",
    "**What I need from you:** re-mark this ticket to make me try again, or add a line saying what you're after.",
  ].join("\n");
}

/** Reduce an error to one readable line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}

/** Whether `stage` is one the prompts module knows how to instruct. */
function isPrompted(
  stage: PipelineStage,
): stage is (typeof PROMPTED_STAGES)[number] {
  return (PROMPTED_STAGES as readonly string[]).includes(stage);
}

/**
 * Drives a run through the pipeline until it reaches a human wait.
 *
 * One session per stage, and the run walks on by itself between stages that
 * need no human — a stage boundary is not a session boundary, a *wait* is
 * (ADR-0013). So triage flowing into planning happens in one pass, while
 * anything needing an answer stops, parks, and is resumed by a later poll
 * from the artifacts and the thread.
 *
 * Two invariants live here rather than in the prompt, because a prompt is a
 * request and an invariant is not: the target project must be declared in
 * `timone.yaml` before anything is spawned (R2), and the session's working
 * directory is the timone root, never the project checkout (ADR-0007).
 */
export class AgentSessionSpawner implements SessionSpawner {
  private readonly log: (message: string) => void;
  private readonly channel: ConversationChannel;

  constructor(private readonly options: AgentSessionSpawnerOptions) {
    this.log = options.log ?? (() => {});
    this.channel = options.channel ?? new TerminalChannel();
  }

  async spawn(
    run: Run,
    project: TicketingProject,
    context: SpawnContext = {},
  ): Promise<void> {
    const { manifest } = this.options;

    if (!(project.name in manifest.projects)) {
      throw new Error(
        `Refusing to spawn a session for "${project.name}": it is not declared in the manifest`,
      );
    }

    let stage: PipelineStage = context.stage ?? run.stage ?? "triage";
    let feedback = context.feedback;

    for (;;) {
      if (!isBuilt(stage)) {
        await this.park(run, project, stage);
        return;
      }

      if (!runsUnattended(stage)) {
        await this.openConversation(run, project, stage);
        return;
      }

      const outcome = await this.runStage(run, project, stage, feedback);
      if (!outcome.ok) return;
      feedback = undefined;

      const next = await this.afterStage(run, project, stage, outcome.ticket);
      if (next === undefined) return;
      stage = next;
      this.options.store.setStage(run.id, stage);
      this.log(`stage  ${run.id} → ${stage}`);
    }
  }

  /** Run one stage's session. Returns the ticket as it stood afterwards. */
  private async runStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    feedback: string | undefined,
  ): Promise<{ ok: true; ticket: TicketThread } | { ok: false }> {
    const { store, adapter, runtime, root } = this.options;

    if (!isPrompted(stage)) {
      // A stage the graph calls built and the prompts module cannot instruct
      // is a wiring mistake, and failing loudly beats running a blank session.
      const reason = `no prompt exists for the ${stage} stage`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      return { ok: false };
    }

    const before = await adapter.getTicket(project, run.ticket);
    const prompt = stagePrompt(stage, {
      project,
      ticket: before,
      classification: classificationFromLabels(before.labels),
      feedback,
    });

    if (this.options.beforeSession !== undefined) {
      try {
        await this.options.beforeSession(run, project);
      } catch (error) {
        this.log(`pre-session snapshot failed for ${run.id}: ${oneLine(error)}`);
      }
    }

    const started = await runtime.start({ cwd: root, prompt });
    const active = store.activate(run.id, started.sessionId);
    this.log(`session ${started.sessionId} started for ${run.id} (${stage})`);

    const outcome = await started.completed;

    if (!outcome.ok) {
      const reason = outcome.error ?? "the session ended without a result";
      const failed = store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      await this.guardrails(failed, project);
      return { ok: false };
    }

    await this.guardrails(active, project);
    return { ok: true, ticket: await adapter.getTicket(project, run.ticket) };
  }

  /**
   * What the run does now that `stage`'s session has finished: the next stage
   * to run, or undefined when the run has stopped for good or for now.
   */
  private async afterStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    ticket: TicketThread,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    if (waitFor(stage) === "gate") {
      const cursor = waitCursorFrom(ticket);
      store.park(run.id, {
        waitingOn: "your answer on the ticket",
        kind: "gate",
        stage,
        waitCursor: cursor,
      });
      this.log(`parked ${run.id} at ${stage}, waiting on a reply`);
      return undefined;
    }

    // The only remaining wait-free stage is triage, and what follows it is
    // the classification it just recorded — read back off the ticket, because
    // the label is where the process says the record lives.
    const kind = classificationFromLabels(ticket.labels);
    if (kind === undefined) {
      store.fail(run.id, "triage recorded no classification");
      await adapter.postComment(project, run.ticket, unclassifiedComment());
      return undefined;
    }

    const transition = routeAfterTriage(kind);
    if (transition.kind === "finish") {
      store.complete(run.id);
      await adapter.postComment(project, run.ticket, answeredComment());
      this.log(`done   ${run.id} — ${transition.reason}`);
      return undefined;
    }
    if (transition.kind !== "advance") return undefined;

    return transition.stage;
  }

  /** Invite the human into a conversation, and park until they conclude it. */
  private async openConversation(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
  ): Promise<void> {
    const { store, adapter } = this.options;

    const ticket = await adapter.getTicket(project, run.ticket);
    const opened = await inviteToConversation(this.channel, {
      project: project.name,
      ticket: run.ticket,
      stage,
      subject: conversationSubject(ticket),
    });

    await adapter.postComment(project, run.ticket, opened.comment);
    const after = await adapter.getTicket(project, run.ticket);

    this.stop(run, {
      waitingOn: opened.waitingOn,
      kind: "conversation",
      stage,
      waitCursor: waitCursorFrom(after),
    });
    this.log(`parked ${run.id} at ${stage}, waiting on a conversation`);
  }

  /** Park a run at a stage nothing can run yet, and say so on the ticket. */
  private async park(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
  ): Promise<void> {
    const { adapter } = this.options;

    const parked = this.stop(run, {
      waitingOn: "the next stage to be built",
      stage,
    });
    await adapter.postComment(project, run.ticket, parkedComment(stage));
    this.log(`parked ${run.id} at ${stage} — not built yet`);
    await this.guardrails(parked, project);
  }

  /**
   * Put a run into a wait, whether it was running or already waiting for
   * something else. A resumed run that advances into a stage nothing can run
   * yet never became active, so what changes is its wait, not its state.
   */
  private stop(run: Run, options: ParkOptions): Run {
    const { store } = this.options;
    const current = store.get(run.id);
    return current?.status === "parked"
      ? store.repark(run.id, options)
      : store.park(run.id, options);
  }

  /**
   * Guardrails report; they never decide whether the run succeeded, and a
   * broken check must not take the daemon down with it.
   */
  private async guardrails(run: Run, project: TicketingProject): Promise<void> {
    if (this.options.afterSession === undefined) return;
    try {
      await this.options.afterSession(run, project);
    } catch (error) {
      this.log(`post-session checks failed for ${run.id}: ${oneLine(error)}`);
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
