import type { Manifest } from "../manifest.js";
import type { TicketingAdapter, TicketingProject } from "../adapters/ticketing.js";
import { instant as instantOf, readConversationRecord, readGateDecision } from "./gates.js";
import {
  classificationFromLabels,
  concludeConversation,
  isBuilt,
  readGate,
  routeAfterTriage,
  stageAfter,
  type PipelineStage,
} from "./pipeline.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "./progress.js";
import type { Run, RunStore } from "./runs.js";
// The same comment the spawner posts when a session ends badly, because this
// is the same kind of ending: work stopped, nothing was decided, try again.
import { failedComment } from "./session.js";

/** What a spawn is resuming, when it is resuming something. */
export interface SpawnContext {
  /** Start at this stage rather than the run's recorded one. */
  stage?: PipelineStage;
  /** The human's words, when a gate sent the stage back to do it again. */
  feedback?: string;
  /**
   * The approval that resumed this run. Its stage's artifact has to record
   * it before anything moves on: the reply lives on the ticket, but the
   * artifact is the record (ADR-0006), and a gate whose outcome exists only
   * in a comment thread is one the next stage cannot see.
   */
  approval?: { stage: PipelineStage; by: string; at: string };
}

/**
 * The hand-off to a spawned agent session. Declared here rather than in the
 * session module so the poll loop depends on the seam, not on the Agent SDK:
 * the loop is fully testable with a fake, and the real spawner is one
 * implementation of this interface.
 */
export interface SessionSpawner {
  spawn(
    run: Run,
    project: TicketingProject,
    context?: SpawnContext,
  ): Promise<void>;
}

export interface PollDeps {
  manifest: Manifest;
  store: RunStore;
  adapter: TicketingAdapter;
  spawner: SessionSpawner;
  /**
   * How long a run may go without a heartbeat before it is treated as
   * orphaned by a dead daemon (ADR-0017). Four progress intervals by default,
   * which is four chances for a healthy session to have said something.
   */
  staleAfterMs?: number;
  /** Progress sink; defaults to silence (the command wires stdout). */
  log?: (message: string) => void;
}

export interface PollResult {
  /** Run ids reclaimed from a dead daemon this cycle. */
  reclaimed: string[];
  /** Run ids newly picked up this cycle. */
  pickedUp: string[];
  /** Run ids newly queued behind an occupying run this cycle. */
  queued: string[];
  /** Run ids handed to the spawner this cycle. */
  spawned: string[];
  /** Run ids whose human wait was answered and which resumed this cycle. */
  resumed: string[];
  /** Run ids that reached a terminal state this cycle (a PR merged or closed). */
  completed: string[];
  /** One readable line per project that failed; the cycle continued. */
  errors: string[];
}

/** The comment posted on the ticket when its pull request was merged. */
export function mergedComment(pr: number): string {
  return [
    "**Merged — this one is done.**",
    "",
    `The work for this ticket went in with pull request #${pr}. The branch has`,
    "served its purpose, and this ticket's journey ends here.",
    "",
    "**What I need from you:** nothing — file a new ticket for anything else.",
  ].join("\n");
}

/** The comment posted when the pull request was closed without merging. */
export function closedUnmergedComment(pr: number): string {
  return [
    "**The pull request was closed without merging.**",
    "",
    `Pull request #${pr} for this ticket was closed rather than merged, so I'm`,
    "treating this work as declined and closing this ticket with it. The",
    "branch and everything on it stay where they are.",
    "",
    "**What I need from you:** nothing — reopen and re-mark this ticket if you want the work picked back up.",
  ].join("\n");
}

/**
 * The acknowledgement posted when a ticket is picked up. Written for
 * someone who knows nothing about the process: no stage names, no skill
 * names, and a closing line that says plainly what is being asked of them
 * (here: nothing).
 */
export function pickedUpComment(): string {
  return [
    "**Picked this up.**",
    "",
    "I'm reading it now, working out what kind of request it is and what should",
    "happen next. Whatever I work out gets written back here on this ticket.",
    "",
    "**What I need from you:** nothing right now — I'll comment here when I do.",
  ].join("\n");
}

/**
 * The acknowledgement posted when a ticket has to wait: this project is
 * already working something else, and it works one thing at a time.
 */
export function queuedComment(
  aheadOfIt: number,
  position: number,
): string {
  const place =
    position <= 1 ? "It's next in line." : `It's number ${position} in line.`;
  return [
    "**This one is in the queue.**",
    "",
    `I'm already working on #${aheadOfIt} for this project, and I take one thing`,
    `at a time so two pieces of work never collide. ${place}`,
    "",
    "**What I need from you:** nothing right now — I'll comment here when I start.",
  ].join("\n");
}

/**
 * Why a reclaimed run failed, in words that assume nothing about daemons.
 *
 * It says what happened and stops. Reclaim is deliberately not recovery
 * (ADR-0017): a crash mid-stage can leave partial commits on the branch, and
 * a reproducible crash re-armed automatically would loop forever. The way
 * back is `timone retry`, and {@link failedComment} already asks for it.
 */
export function reclaimedReason(): string {
  return "the machine running it stopped before the work was finished";
}

/** Reduce an error to one readable line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}

/**
 * Run one poll cycle over every project in the manifest: list the marked
 * tickets, register the ones not already tracked, acknowledge each exactly
 * once, resume any parked run whose human has answered, and hand the
 * project's occupying run to the spawner if no session is attached to it yet.
 *
 * Nothing here throws: a project whose tracker misbehaves is reported in
 * `errors` and the remaining projects are still polled. The acknowledgement
 * is posted only for runs this cycle created, which is what makes repeated
 * cycles silent (the store's registration is idempotent per ticket).
 */
export async function pollOnce(deps: PollDeps): Promise<PollResult> {
  const { manifest } = deps;
  const log = deps.log ?? (() => {});
  const result: PollResult = {
    reclaimed: [],
    pickedUp: [],
    queued: [],
    spawned: [],
    resumed: [],
    completed: [],
    errors: [],
  };

  for (const [name, config] of Object.entries(manifest.projects)) {
    const project: TicketingProject = { name, repoUrl: config.repo_url };
    try {
      // Before anything is picked up: a run left `active` by a daemon that
      // died is holding its project, and every ticket behind it is waiting on
      // a session that no longer exists.
      await reclaimStale(project, deps, result, log);
      await pollProject(project, deps, result, log);
    } catch (error) {
      const line = `${name}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }

  return result;
}

/**
 * Fail every run of `project` whose heartbeat has gone quiet, tell its ticket,
 * and let the ledger free the project and promote whatever was queued behind
 * it — `store.fail` does both, because ending a run is what releases it.
 *
 * Idempotent across cycles for free: a failed run is no longer running, so
 * the next call finds nothing and the ticket is told exactly once.
 */
async function reclaimStale(
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter } = deps;
  const threshold =
    deps.staleAfterMs ?? 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000;

  for (const run of store.staleRuns(threshold)) {
    if (run.project !== project.name) continue;

    const reason = reclaimedReason();
    store.fail(run.id, reason);
    log(`reclaim ${run.id} — ${reason}`);
    result.reclaimed.push(run.id);
    await adapter.postComment(project, run.ticket, failedComment(reason));
  }
}

/** One project's share of a cycle. Throws only on tracker-level failures. */
async function pollProject(
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter } = deps;

  const tickets = await adapter.listMarkedTickets(project);
  for (const ticket of tickets) {
    const occupier = store.occupyingRun(project.name);
    const { run, created } = store.register(project.name, ticket.number);
    if (!created) continue;

    if (run.status === "queued") {
      result.queued.push(run.id);
      log(`queued ${run.id}`);
      await adapter.postComment(
        project,
        ticket.number,
        queuedComment(occupier?.ticket ?? 0, store.queuePosition(run.id)),
      );
    } else {
      result.pickedUp.push(run.id);
      log(`pickup ${run.id}`);
      await adapter.postComment(project, ticket.number, pickedUpComment());
    }
  }

  await resumeAnswered(project, deps, result, log);

  // Hand off whatever now holds the project, if nothing is running it yet.
  // `promoteQueue` is what starts a run left queued behind a park that no
  // longer holds anything — promotion is otherwise a side effect of the run
  // ahead moving, and nothing moved.
  store.promoteQueue(project.name);
  const occupier = store.occupyingRun(project.name);
  if (occupier !== undefined && occupier.status === "picked-up") {
    try {
      await deps.spawner.spawn(occupier, project);
      result.spawned.push(occupier.id);
      log(`spawn  ${occupier.id}`);
    } catch (error) {
      const line = `${project.name}: could not start a session for #${occupier.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}

/**
 * Resume every parked run whose human has answered.
 *
 * The ticket is the one surface this reads (ADR-0012): a gate's answer is the
 * human's reply, and a conversation's is the record the session posted when
 * it concluded. Both are found relative to the cursor stored when the run
 * parked, so nothing said before the question can answer it.
 *
 * Only one run resumes per cycle per project, because sessions serialize. The
 * rest keep waiting and are picked up by a later cycle in the order they
 * parked — no answer is lost by being second.
 */
async function resumeAnswered(
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter } = deps;

  for (const run of store.parkedRuns(project.name)) {
    if (store.runningRun(project.name) !== undefined) return;
    if (run.stage === undefined) continue;

    const holder = store.occupyingRun(project.name);
    if (holder !== undefined && holder.id !== run.id) continue;

    // A review park is the one wait that can end the run outright — a PR
    // merged or closed is a terminal event, not a stage to spawn.
    if (run.waitingKind === "review") {
      try {
        const ended = await concludeReview(run, project, deps, result, log);
        if (ended) return;
      } catch (error) {
        const line = `${project.name}: could not read PR for #${run.ticket}: ${oneLine(error)}`;
        result.errors.push(line);
        log(`error  ${line}`);
        continue;
      }
    }

    let context: SpawnContext | undefined;
    try {
      context = await resolveWait(run, project, adapter);
    } catch (error) {
      const line = `${project.name}: could not read #${run.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
      continue;
    }
    if (context === undefined) continue;

    try {
      await deps.spawner.spawn(run, project, context);
      result.resumed.push(run.id);
      log(`resume ${run.id} → ${context.stage ?? run.stage}`);
    } catch (error) {
      const line = `${project.name}: could not resume #${run.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
    return;
  }
}

/**
 * End a review-parked run if its pull request reached a terminal state.
 * Returns true when the run ended (the ticket has been told and the queue
 * promoted); false when the PR is still open and the wait continues.
 */
async function concludeReview(
  run: Run,
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<boolean> {
  const { store, adapter } = deps;
  if (run.pr === undefined) return false;

  const pr = await adapter.getPullRequestThread(project, run.pr);
  if (pr.state === "open") return false;

  store.complete(run.id);
  await adapter.postComment(
    project,
    run.ticket,
    pr.state === "merged" ? mergedComment(pr.number) : closedUnmergedComment(pr.number),
  );
  await adapter.closeTicket(
    project,
    run.ticket,
    pr.state === "merged" ? "completed" : "not-planned",
  );
  result.completed.push(run.id);
  log(`done   ${run.id} — PR #${pr.number} ${pr.state}`);
  return true;
}

/**
 * What a parked run should do now, or undefined while it is still waiting.
 *
 * A change request returns the *same* stage with the human's words; an
 * approval or an accepted conversation returns the next one. Nothing else
 * moves a run — an unanswered gate and an abandoned conversation both look
 * like silence, and silence is not an answer.
 */
async function resolveWait(
  run: Run,
  project: TicketingProject,
  adapter: TicketingAdapter,
): Promise<SpawnContext | undefined> {
  const stage = run.stage;
  if (stage === undefined) return undefined;

  // A park with no kind of wait is not waiting on a human at all: it is a
  // run stopped because a stage's machinery did not exist. Two vintages of
  // that park meet here, and they recorded different things: phase 11 parked
  // runs whose recorded stage had already *run* (triage, with what follows
  // read off the labels); every later park records the stage that could not
  // run, and resuming must run *that stage itself* — asking "what follows?"
  // would skip it, and for a park at execution that means verifying code
  // nobody wrote.
  if (run.waitingKind === undefined) {
    if (stage !== "triage") {
      return isBuilt(stage) ? { stage } : undefined;
    }
    const thread = await adapter.getTicket(project, run.ticket);
    const next = whatFollows(stage, thread.labels);
    return next !== undefined && isBuilt(next) ? { stage: next } : undefined;
  }

  const cursor = run.waitCursor;
  if (cursor === undefined) return undefined;

  if (run.waitingKind === "gate") {
    const thread = await adapter.getTicket(project, run.ticket);
    const decision = readGateDecision(thread, cursor);
    const transition = readGate(stage, decision);

    if (transition.kind === "advance") {
      return {
        stage: transition.stage,
        approval:
          decision?.kind === "approve"
            ? {
                stage,
                by: decision.comment.author,
                at: decision.comment.createdAt,
              }
            : undefined,
      };
    }
    if (transition.kind === "repeat") {
      return { stage: transition.stage, feedback: transition.feedback };
    }
    return undefined;
  }

  if (run.waitingKind === "conversation") {
    const thread = await adapter.getTicket(project, run.ticket);
    const record = readConversationRecord(thread, cursor);
    const transition = concludeConversation(stage, {
      accepted: record !== undefined,
    });

    return transition.kind === "advance" ? { stage: transition.stage } : undefined;
  }

  if (run.waitingKind === "review") {
    if (run.pr === undefined) return undefined;
    const pr = await adapter.getPullRequestThread(project, run.pr);

    // Only a human wakes a parked review. The machine's own bookkeeping —
    // outcome comments, threaded replies — lands on the same surface, and a
    // loop that answered itself would remediate forever.
    const words = pr.comments
      .filter(
        (comment) =>
          !comment.fromTimone && instantOf(comment.createdAt) > instantOf(cursor),
      )
      .map((comment) => comment.body.trim())
      .filter((body) => body !== "");
    if (words.length === 0) return undefined;

    return { stage: "remediation", feedback: words.join("\n\n---\n\n") };
  }

  return undefined;
}

/**
 * The stage that follows `stage` for a ticket carrying `labels`. After
 * triage that depends on the classification; everywhere else the graph
 * already knows.
 */
function whatFollows(
  stage: PipelineStage,
  labels: readonly string[],
): PipelineStage | undefined {
  if (stage !== "triage") return stageAfter(stage);

  const kind = classificationFromLabels(labels);
  if (kind === undefined) return undefined;
  const transition = routeAfterTriage(kind);
  return transition.kind === "advance" ? transition.stage : undefined;
}
