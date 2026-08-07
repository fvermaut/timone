import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { query, type EffortLevel } from "@anthropic-ai/claude-agent-sdk";

const execFileAsync = promisify(execFile);

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
import { gateCommentFor } from "./gate-comment.js";
import { waitCursorFrom } from "./gates.js";
import { outcomeCursorFrom, readStageOutcome, type StageOutcome } from "./outcomes.js";
import {
  APPROVAL_RECORD_MODEL,
  classificationFromLabels,
  effortFor,
  isBuilt,
  modelFor,
  ownsBranch,
  processStage,
  routeAfterTriage,
  runsUnattended,
  stageAfter,
  waitFor,
  type PipelineStage,
} from "./pipeline.js";
import type { SessionSpawner, SpawnContext } from "./poll.js";
import {
  PROMPTED_STAGES,
  approvalRecordPrompt,
  conversationSubject,
  stagePrompt,
  workBranch,
} from "./prompts.js";
import {
  DEFAULT_PROGRESS_INTERVAL_SECONDS,
  SessionProgress,
  closingLine,
  tickLine,
  type ProgressSnapshot,
  type SessionSummary,
} from "./progress.js";
import type { ParkOptions, Run, RunStore } from "./runs.js";

/** What the spawner asks a runtime to run. */
export interface SessionRequest {
  /** Always the timone root — sessions never run inside a managed project. */
  cwd: string;
  prompt: string;
  /**
   * The model this session runs on, declared per stage in the graph. Required
   * rather than optional: a request that could omit it is a request that can
   * silently take whatever the runtime defaults to, which is the failure this
   * field exists to make impossible.
   */
  model: string;
  /**
   * The reasoning effort, when the stage declares one. Absent — not
   * undefined — for models that reject the parameter, so the runtime has
   * something unambiguous to omit.
   */
  effort?: EffortLevel;
}

/** How a session ended. */
export interface SessionOutcome {
  sessionId: string;
  ok: boolean;
  error?: string;
}

/** What the spawner needs to say how a running session is doing. */
export interface ProgressReader {
  snapshot(): ProgressSnapshot;
  summary(): SessionSummary | undefined;
}

/** A session that has started and will finish. */
export interface StartedSession {
  sessionId: string;
  completed: Promise<SessionOutcome>;
  /**
   * How the session is doing, for the spawner's ticker. Optional because a
   * runtime that cannot see inside a session — a test fake, mostly — should
   * not have to invent numbers to satisfy the interface.
   */
  progress?: ProgressReader;
}

/** A running ticker, stoppable. */
export interface Ticker {
  stop(): void;
}

/** The real ticker. Behind a seam so tests need no clock. */
function intervalTicker(onTick: () => void, intervalMs: number): Ticker {
  const handle = setInterval(onTick, intervalMs);
  return { stop: () => clearInterval(handle) };
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
   * Reads a branch's tip in a project checkout. Behind a seam so the
   * did-this-stage-produce-anything check is testable without a real repo.
   */
  repoProbe?: (repoDir: string, branch: string) => Promise<string | undefined>;
  /**
   * Reads the `Status:` line of the newest phase file on a branch. The
   * artifact half of execution's outcome check — the stage's own closing act
   * is flipping this line to `Complete` — behind a seam for the same reason
   * as {@link repoProbe}.
   */
  planStatusProbe?: (
    repoDir: string,
    branch: string,
  ) => Promise<string | undefined>;
  /**
   * Finds the newest phase's verification report on a branch, returning its
   * path or undefined. The artifact half of verification's outcome check.
   */
  verificationReportProbe?: (
    repoDir: string,
    branch: string,
  ) => Promise<string | undefined>;
  /**
   * Milliseconds between progress lines while a session works. Defaults to
   * {@link DEFAULT_PROGRESS_INTERVAL_SECONDS}.
   */
  progressIntervalMs?: number;
  /** Starts a ticker. Behind a seam so tests need no real timer. */
  ticker?: (onTick: () => void, intervalMs: number) => Ticker;
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
export function producedNothingComment(stage: PipelineStage): string {
  return [
    "**I stopped without writing anything down, and that's mine to fix.**",
    "",
    `The step I just ran (${stage}) was supposed to leave a document on this`,
    "ticket's branch for you to read and approve. It didn't.",
    "",
    "So there is **nothing for you to approve**, and I would rather say that than",
    "ask you to sign off on a blank.",
    "",
    "Nothing has moved on, and every answer you have already given on this ticket",
    "still stands.",
    "",
    "**What I need from you:** nothing right now — this needs fixing at my end, and I'll come back here when it is.",
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

/**
 * The `Status:` line of the newest phase file on `branch`, or undefined when
 * the branch carries none. Newest by number, because that is the file the
 * planning stage just committed and the one execution was told to build.
 */
async function gitPlanStatus(
  repoDir: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-tree", "-r", "--name-only", branch, "--", "doc/plans/phases"],
      { cwd: repoDir },
    );
    const newest = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^doc\/plans\/phases\/phase-\d+\.md$/.test(line))
      .sort()
      .at(-1);
    if (newest === undefined) return undefined;

    const { stdout: content } = await execFileAsync(
      "git",
      ["show", `${branch}:${newest}`],
      { cwd: repoDir },
    );
    const line = content
      .split("\n")
      .find((candidate) => candidate.includes("Status:"));
    return line?.replace(/^.*Status:\*{0,2}\s*/, "").trim();
  } catch {
    return undefined;
  }
}

/**
 * The newest phase's verification report on `branch` — its path when the
 * file exists there, undefined otherwise. "Newest phase" is resolved the
 * same way {@link gitPlanStatus} resolves it, so the two witnesses of the
 * back half always talk about the same phase.
 */
async function gitVerificationReport(
  repoDir: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-tree", "-r", "--name-only", branch, "--", "doc/plans/phases"],
      { cwd: repoDir },
    );
    const files = stdout.split("\n").map((line) => line.trim());
    const newest = files
      .filter((line) => /^doc\/plans\/phases\/phase-\d+\.md$/.test(line))
      .sort()
      .at(-1);
    if (newest === undefined) return undefined;

    const phase = /phase-(\d+)\.md$/.exec(newest)?.[1];
    const report = `doc/plans/phases/reports/phase-${phase}-verification.md`;
    return files.includes(report) ? report : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A branch's tip sha in `repoDir`, or undefined when the branch does not
 * exist. Missing is a legitimate answer, not an error: before the first stage
 * that owns one, there is no branch.
 */
async function gitBranchHead(
  repoDir: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--verify", `refs/heads/${branch}`],
      { cwd: repoDir },
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
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
  private readonly progressIntervalMs: number;

  constructor(private readonly options: AgentSessionSpawnerOptions) {
    this.log = options.log ?? (() => {});
    this.channel = options.channel ?? new TerminalChannel();
    this.progressIntervalMs =
      options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000;
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

    if (context.approval !== undefined) {
      const recorded = await this.recordApproval(run, project, context.approval);
      if (!recorded) return;
    }

    for (;;) {
      if (!isBuilt(stage)) {
        await this.park(run, project, stage);
        return;
      }

      if (!runsUnattended(stage)) {
        await this.openConversation(run, project, stage);
        return;
      }

      await this.claimBranch(run, project, stage);

      const outcome = await this.runStage(run, project, stage, feedback);
      if (!outcome.ok) return;
      feedback = undefined;

      const next = await this.afterStage(
        run,
        project,
        stage,
        outcome.ticket,
        outcome.producedWork,
        outcome.outcome,
      );
      if (next === undefined) return;
      stage = next;
      this.options.store.setStage(run.id, stage);
      this.log(`stage  ${run.id} → ${stage}`);
    }
  }

  /**
   * Run one stage's session. Returns the ticket as it stood afterwards, and
   * whether the session actually moved the work branch on — which is the only
   * evidence the daemon has that a stage owing an artifact produced one.
   */
  private async runStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    feedback: string | undefined,
  ): Promise<
    | {
        ok: true;
        ticket: TicketThread;
        producedWork: boolean;
        outcome: StageOutcome | undefined;
      }
    | { ok: false }
  > {
    const { store, adapter, runtime, root } = this.options;

    const model = modelFor(stage);
    if (!isPrompted(stage) || model === undefined) {
      // A stage the graph calls built and the prompts module cannot instruct
      // is a wiring mistake, and failing loudly beats running a blank session.
      // The missing model is the same mistake wearing different clothes — and
      // is unreachable while the graph type-checks, since a stage the daemon
      // spawns cannot be declared without one. It is here so that a stage
      // reaching this line by some path the types cannot see stops, rather
      // than running on whatever the runtime happens to default to.
      const reason =
        isPrompted(stage) && model === undefined
          ? `no model is declared for the ${stage} stage`
          : `no prompt exists for the ${stage} stage`;
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
      branch: store.get(run.id)?.branch,
    });

    const branch = store.get(run.id)?.branch;
    const headBefore = await this.branchHead(project, branch);

    const effort = effortFor(stage);
    const started = await runtime.start({
      cwd: root,
      prompt,
      model,
      // Spread rather than assigned, so a stage with no effort produces a
      // request with no `effort` key — not one set to undefined, which the
      // runtime would have to tell apart from an intended value.
      ...(effort === undefined ? {} : { effort }),
    });
    const active = store.activate(run.id, started.sessionId);
    this.log(`session ${started.sessionId} started for ${run.id} (${stage}, ${model})`);

    const outcome = await this.watch(run.id, `${run.id} (${stage})`, started);

    if (!outcome.ok) {
      const reason = outcome.error ?? "the session ended without a result";
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      return { ok: false };
    }

    const headAfter = await this.branchHead(project, branch);

    const after = await adapter.getTicket(project, run.ticket);
    return {
      ok: true,
      ticket: after,
      producedWork: headAfter !== undefined && headAfter !== headBefore,
      outcome: readStageOutcome(after, outcomeCursorFrom(before)),
    };
  }

  /**
   * Judge an unattended work stage by its two witnesses: the outcome its
   * session recorded on the ticket, and the artifact it owes on the branch.
   * Only the honest pair — a done marker over a real artifact — advances;
   * a handed-to-human outcome stops without commentary (the session's own
   * comment is the report); every other combination is a wiring defect the
   * run fails loudly on, because a stage that says one thing and shows
   * another cannot be built upon in either direction.
   */
  private async afterWorkStage(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    outcome: StageOutcome | undefined,
    artifact: () => Promise<{ ok: boolean; observed: string }>,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    if (outcome?.kind === "handed-to-human") {
      store.fail(
        run.id,
        `the ${stage} stage stopped and handed the work to you — see the ticket`,
      );
      this.log(`handed ${run.id} — ${stage} stopped, see the ticket`);
      return undefined;
    }

    const evidence = await artifact();
    if (outcome?.kind === "advanced" && evidence.ok) {
      return stageAfter(stage);
    }

    const reason =
      outcome === undefined
        ? `the ${stage} stage ended without recording an outcome, and ${evidence.observed}`
        : `the ${stage} stage said it finished, but ${evidence.observed}`;
    store.fail(run.id, reason);
    await adapter.postComment(project, run.ticket, failedComment(reason));
    this.log(`failed ${run.id} — ${reason}`);
    return undefined;
  }

  /**
   * Judge a remediation. Three honest endings, because ADR-0016 gives the
   * session three paths: a fix committed (the branch moved) re-verifies —
   * nothing reaches the PR unchecked; a reply with nothing committed goes
   * straight back to waiting on the review — a clarifying question is not a
   * change and re-verifying nothing would be theatre; handed-to-human stops
   * as everywhere else.
   */
  private async afterRemediation(
    run: Run,
    project: TicketingProject,
    outcome: StageOutcome | undefined,
    producedWork: boolean,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    if (outcome?.kind === "handed-to-human") {
      store.fail(
        run.id,
        "the remediation stopped and handed the work to you — see the ticket",
      );
      this.log(`handed ${run.id} — remediation stopped, see the ticket`);
      return undefined;
    }

    if (outcome?.kind === "advanced" && producedWork) {
      return "verification";
    }

    if (outcome?.kind === "advanced") {
      const pr = store.get(run.id)?.pr;
      if (pr !== undefined) {
        const thread = await adapter.getPullRequestThread(project, pr);
        store.park(run.id, {
          waitingOn: `your review of pull request #${pr}`,
          kind: "review",
          stage: "remediation",
          waitCursor: thread.comments.at(-1)?.createdAt ?? "",
        });
        this.log(`parked ${run.id} — replied on PR #${pr}, waiting again`);
        return undefined;
      }
    }

    const reason =
      outcome === undefined
        ? "the remediation ended without recording an outcome"
        : "the remediation said it finished, but the run has lost its pull request";
    store.fail(run.id, reason);
    await adapter.postComment(project, run.ticket, failedComment(reason));
    this.log(`failed ${run.id} — ${reason}`);
    return undefined;
  }

  /**
   * Judge the delivery and park the run on its review. Delivery's artifact
   * is the pull request itself (ADR-0004) — a branch probe cannot prove one
   * exists, so the tracker is asked directly. The park's cursor sits at the
   * PR thread's newest comment: only what the human says after the park can
   * wake the run.
   */
  private async afterDelivery(
    run: Run,
    project: TicketingProject,
    outcome: StageOutcome | undefined,
  ): Promise<void> {
    const { store, adapter } = this.options;

    if (outcome?.kind === "handed-to-human") {
      store.fail(
        run.id,
        "the delivery stage stopped and handed the work to you — see the ticket",
      );
      this.log(`handed ${run.id} — delivery stopped, see the ticket`);
      return;
    }

    const branch = store.get(run.id)?.branch;
    const pr =
      branch === undefined
        ? undefined
        : await adapter.findPullRequest(project, branch);
    const open = pr !== undefined && pr.state === "open";

    if (outcome?.kind !== "advanced" || !open) {
      // A park on a review nobody can perform is a gate over nothing —
      // the 12f rule wearing stage 8's clothes.
      const observed = open
        ? `pull request #${pr.number} exists`
        : "no open pull request exists for the branch";
      const reason =
        outcome === undefined
          ? `the delivery stage ended without recording an outcome, and ${observed}`
          : `the delivery stage said it finished, but ${observed}`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      this.log(`failed ${run.id} — ${reason}`);
      return;
    }

    store.recordPullRequest(run.id, pr.number);
    const thread = await adapter.getPullRequestThread(project, pr.number);
    store.park(run.id, {
      waitingOn: `your review of pull request #${pr.number}`,
      kind: "review",
      stage: "delivery",
      waitCursor: thread.comments.at(-1)?.createdAt ?? "",
    });
    this.log(`parked ${run.id} at delivery, waiting on PR #${pr.number}`);
  }

  /** The phase file's status text on `branch`, or undefined without one. */
  private async planStatus(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<string | undefined> {
    if (branch === undefined) return undefined;
    const probe = this.options.planStatusProbe ?? gitPlanStatus;
    try {
      return await probe(
        join(this.options.root, "projects", project.name),
        branch,
      );
    } catch {
      return undefined;
    }
  }

  /** The verification report's path on `branch`, or undefined without one. */
  private async verificationReport(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<string | undefined> {
    if (branch === undefined) return undefined;
    const probe = this.options.verificationReportProbe ?? gitVerificationReport;
    try {
      return await probe(
        join(this.options.root, "projects", project.name),
        branch,
      );
    } catch {
      return undefined;
    }
  }

  /** The work branch's tip, or undefined when there is no branch yet. */
  private async branchHead(
    project: TicketingProject,
    branch: string | undefined,
  ): Promise<string | undefined> {
    if (branch === undefined) return undefined;
    const probe = this.options.repoProbe ?? gitBranchHead;
    try {
      return await probe(join(this.options.root, "projects", project.name), branch);
    } catch {
      return undefined;
    }
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
    producedWork: boolean,
    outcome: StageOutcome | undefined,
  ): Promise<PipelineStage | undefined> {
    const { store, adapter } = this.options;

    if (waitFor(stage) === "gate") {
      await this.openGate(run, project, stage, producedWork);
      return undefined;
    }

    if (stage === "execution") {
      return this.afterWorkStage(run, project, stage, outcome, async () => {
        const status = await this.planStatus(
          project,
          store.get(run.id)?.branch,
        );
        return {
          ok: status !== undefined && /^Complete\b/.test(status),
          observed: `the phase file's status is "${status ?? "not found"}"`,
        };
      });
    }

    if (stage === "verification") {
      return this.afterWorkStage(run, project, stage, outcome, async () => {
        const report = await this.verificationReport(
          project,
          store.get(run.id)?.branch,
        );
        return {
          ok: report !== undefined,
          observed:
            report !== undefined
              ? `the verification report is ${report}`
              : "no verification report exists on the branch",
        };
      });
    }

    if (stage === "delivery") {
      await this.afterDelivery(run, project, outcome);
      return undefined;
    }

    if (stage === "remediation") {
      return this.afterRemediation(run, project, outcome, producedWork);
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
      // The comment says "I'm closing my side of it" — so close it, rather
      // than saying one thing and doing another.
      await adapter.closeTicket(project, run.ticket, "completed");
      this.log(`done   ${run.id} — ${transition.reason}`);
      return undefined;
    }
    if (transition.kind !== "advance") return undefined;

    return transition.stage;
  }

  /**
   * Write an approval into the artifact it belongs to, before the run moves
   * on. Returns false when the recording session failed, in which case the
   * run has already been failed and the ticket told.
   *
   * A short session of its own rather than a line appended to the next
   * stage's prompt: the next stage may not be built, and an approval that
   * only lands when the following stage happens to run is an approval that
   * disappears whenever the pipeline stops.
   */
  private async recordApproval(
    run: Run,
    project: TicketingProject,
    approval: NonNullable<SpawnContext["approval"]>,
  ): Promise<boolean> {
    const { store, adapter, runtime, root } = this.options;
    if (!isPrompted(approval.stage)) return true;

    const ticket = await adapter.getTicket(project, run.ticket);
    const prompt = approvalRecordPrompt(
      { stage: approval.stage, by: approval.by, at: approval.at },
      { project, ticket, branch: store.get(run.id)?.branch },
    );

    // Its own declared model, never the runtime's default: this is the second
    // `runtime.start` site and not a `PipelineStage`, so nothing in the graph
    // speaks for it. Haiku carries no effort at all.
    const started = await runtime.start({
      cwd: root,
      prompt,
      model: APPROVAL_RECORD_MODEL,
    });
    const active = store.activate(run.id, started.sessionId);
    this.log(`record ${run.id} — ${approval.by} approved ${approval.stage}`);

    const outcome = await this.watch(run.id, `${run.id} (approval record)`, started);
    if (!outcome.ok) {
      const reason = `could not record the approval: ${outcome.error ?? "the session ended without a result"}`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, failedComment(reason));
      return false;
    }

    return true;
  }

  /**
   * Give the run its work branch, at the first stage that owns one.
   *
   * This is the moment it starts holding its project — so it happens before
   * the session starts, not after. A session that cut a branch on a project
   * another run was already working would have made the collision before the
   * ledger ever heard about it.
   */
  private async claimBranch(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
  ): Promise<void> {
    const { store, adapter } = this.options;
    if (!ownsBranch(stage)) return;
    if (store.get(run.id)?.branch !== undefined) return;

    const ticket = await adapter.getTicket(project, run.ticket);
    const branch = workBranch(ticket);
    store.claimBranch(run.id, branch);
    this.log(`branch ${run.id} → ${branch}`);
  }

  /**
   * Post the approval request and park on it.
   *
   * The daemon writes this comment, never the session that did the work: the
   * CTA has to be worded exactly as the decision reader accepts it, and a
   * session asked to invent its own would eventually word it otherwise —
   * leaving the human answering a question nothing was listening for.
   */
  private async openGate(
    run: Run,
    project: TicketingProject,
    stage: PipelineStage,
    producedWork: boolean,
  ): Promise<void> {
    const { store, adapter } = this.options;
    const branch = store.get(run.id)?.branch ?? "the work branch";

    // A gate over nothing is the one failure a gate must never have. If the
    // stage committed nothing, the link would 404 and a reply of `approve`
    // would advance the pipeline past a step nobody did — so say so plainly
    // and stop, rather than asking for a signature on a blank.
    if (!producedWork) {
      const reason = `the ${stage} stage finished without committing anything to gate`;
      store.fail(run.id, reason);
      await adapter.postComment(project, run.ticket, producedNothingComment(stage));
      this.log(`failed ${run.id} — ${reason}`);
      return;
    }

    const comment = gateCommentFor(stage, project, branch, [
      "I've written it up and put it on a branch, so you can read the real thing",
      "rather than my description of it.",
    ]);

    if (comment !== undefined) {
      await adapter.postComment(project, run.ticket, comment);
    }

    const after = await adapter.getTicket(project, run.ticket);
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage,
      waitCursor: waitCursorFrom(after),
    });
    this.log(`parked ${run.id} at ${stage}, waiting on a reply`);
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

    this.stop(run, { waitingOn: "the next stage to be built", stage });
    await adapter.postComment(project, run.ticket, parkedComment(stage));
    this.log(`parked ${run.id} at ${stage} — not built yet`);
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
   * Await a session, saying what it is doing while it works and what it cost
   * when it stops.
   *
   * The ticker is cleared in a `finally`, so a session that fails or throws
   * leaves no timer behind, and the closing line is printed there too — the
   * money was spent whether or not the session succeeded, and a cost report
   * that only appears on success is a success report wearing its clothes.
   */
  private async watch(
    runId: string,
    label: string,
    started: StartedSession,
  ): Promise<SessionOutcome> {
    const { progress } = started;
    const start = this.options.ticker ?? intervalTicker;

    // One tick, two jobs (ADR-0017). The heartbeat is stamped unconditionally
    // — including for a runtime that can say nothing about its progress —
    // because it is what proves the run alive, and a tick made conditional on
    // having something to print would silently move recovery with it.
    const ticker = start(() => {
      this.options.store.heartbeat(runId);
      if (progress !== undefined) {
        this.log(`work   ${label} — ${tickLine(progress.snapshot())}`);
      }
    }, this.progressIntervalMs);

    try {
      return await started.completed;
    } finally {
      ticker.stop();
      const summary = progress?.summary();
      if (summary !== undefined) {
        this.log(`cost   ${label} — ${closingLine(summary)}`);
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
 * guardrail (R15) is what catches a session that strays. That check no longer
 * lives here — since ADR-0018 it is a `Stop` hook in `.claude/settings.json`,
 * which is what makes it cover interactive sessions too.
 */
export const agentSdkRuntime: SessionRuntime = {
  async start(request: SessionRequest): Promise<StartedSession> {
    const session = query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        model: request.model,
        // The only honest live source of output tokens is the cumulative
        // `usage` on a `message_delta`, and that arrives only as a partial
        // message. Without this the progress line reports about a thirtieth
        // of the truth (see `SessionProgress.observeStreamEvent`).
        includePartialMessages: true,
        // Omitted entirely when the stage declares none — Haiku 4.5 rejects
        // the parameter, and sending it as undefined is not the same as not
        // sending it.
        ...(request.effort === undefined ? {} : { effort: request.effort }),
      },
    });

    let resolveId!: (id: string) => void;
    const sessionId = new Promise<string>((resolve) => {
      resolveId = resolve;
    });

    // Fed as the stream is consumed rather than reconstructed afterwards:
    // everything the tick reports has to be known *while* the session runs,
    // and the stream is the only place it exists.
    const progress = new SessionProgress();

    const completed = (async (): Promise<SessionOutcome> => {
      let id = "unknown";
      try {
        for await (const message of session) {
          progress.observe(message);
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

    return { sessionId: await sessionId, completed, progress };
  },
};
