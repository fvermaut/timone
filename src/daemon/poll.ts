import type { Manifest, ProjectConfig } from "../manifest.js";
import {
  PREVIEW_MARKER,
  type PullRequest,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
} from "../adapters/ticketing.js";
import type {
  Preview,
  PreviewAdapter,
  PreviewProject,
} from "../adapters/preview.js";
import { instant as instantOf, readConversationRecord, readGateDecision } from "./gates.js";
import {
  classificationFromLabels,
  concludeConversation,
  isBuilt,
  readGate,
  routeAfterTriage,
  stageAfter,
  wayfinderStage,
  type PipelineStage,
} from "./pipeline.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "./progress.js";
import type { Run, RunStore, Witness } from "./runs.js";
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
   * orphaned by a dead daemon (ADR-0020). Four progress intervals by default,
   * which is four chances for a healthy session to have said something.
   *
   * Silence past this is *not* on its own grounds for reclaiming: the daemon
   * must also have been present to hear it — see {@link pollIntervalMs}.
   */
  staleAfterMs?: number;
  /**
   * How often the daemon polls, which is what the unwitnessed-gap threshold
   * derives from (ADR-0020): a gap longer than
   * {@link UNWITNESSED_POLL_INTERVALS} of these means no daemon was watching
   * across it. Defaults to the command's own default cadence.
   */
  pollIntervalMs?: number;
  /**
   * How previews are served, when any are. Absent means the daemon was built
   * without one, and no project gets previews however it is bound — the
   * binding says *which* adapter, never *whether* to have one at all.
   */
  previews?: PreviewAdapter;
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

/**
 * Seconds between poll cycles when nobody says otherwise. It is also what the
 * unwitnessed-gap threshold is measured in, which is why it is a constant here
 * rather than a string default on the command's option.
 */
export const DEFAULT_POLL_INTERVAL_SECONDS = 60;

/**
 * How many poll intervals of silence make a gap unwitnessed (ADR-0020).
 *
 * One missed cycle is scheduler jitter; two is evidence the process was not
 * running.
 */
export const UNWITNESSED_POLL_INTERVALS = 2;

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
 * (ADR-0020, keeping ADR-0017's conservatism intact): a crash mid-stage can
 * leave partial commits on the branch, and
 * a reproducible crash re-armed automatically would loop forever. The way
 * back is `timone retry`, and {@link failedComment} already asks for it.
 */
export function reclaimedReason(): string {
  return "the machine running it stopped before the work was finished";
}

/**
 * What a pull request says about its preview, in words that assume nothing.
 *
 * Two things are said outright rather than left to be discovered: it is
 * reachable only from the machine Timone runs on, and its data is fake. Both
 * are limits [ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)
 * accepted deliberately, and a reviewer who has to work either of them out
 * for themselves has been misled by omission.
 */
export function previewComment(preview: Preview, headSha: string): string {
  const commit = headSha.slice(0, 7);

  if (preview.state === "ready" && preview.url !== undefined) {
    return [
      PREVIEW_MARKER,
      "",
      `**Open it: ${preview.url}**`,
      "",
      `That's this pull request's code actually running, built from commit \`${commit}\`.`,
      "It gets rebuilt shortly after every push to this branch, and this comment is",
      "rewritten rather than repeated — so there is only ever one of it, and the",
      "address in it may change. It disappears when this pull request does.",
      "",
      "**Two things it is not.** It runs on the same machine Timone runs on, so it is",
      "reachable from there and nowhere else — not from your phone. And whatever data",
      "it holds comes from this project's own committed sample data, never from a copy",
      "of anything real.",
      "",
      "**What I need from you:** nothing — open it if it helps you review.",
    ].join("\n");
  }

  if (preview.state === "building") {
    return [
      PREVIEW_MARKER,
      "",
      `**Still starting up**, on commit \`${commit}\`. I'll put the address here when it answers.`,
      "",
      "**What I need from you:** nothing — this comment updates itself.",
    ].join("\n");
  }

  return [
    PREVIEW_MARKER,
    "",
    `**I could not get this branch running**, at commit \`${commit}\`:`,
    "",
    `> ${preview.reason ?? "no reason was reported"}`,
    "",
    "**Nothing is blocked by this.** The pull request itself is unaffected and still",
    "yours to read, comment on and merge — a preview is a convenience for reviewing,",
    "not part of the work. I'll try again on the next commit pushed here.",
    "",
    "**What I need from you:** nothing — though if the same failure keeps appearing, it is worth telling me.",
  ].join("\n");
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

  // Once for the whole cycle, and before any project is looked at (ADR-0020).
  // Per-project would let the first project's fresh stamp answer for the
  // second, which is exactly the masking that makes two daemons unsafe.
  const staleAfterMs =
    deps.staleAfterMs ?? 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000;
  const pollIntervalMs =
    deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_SECONDS * 1000;
  const witness = deps.store.witness({
    unwitnessedAfterMs: UNWITNESSED_POLL_INTERVALS * pollIntervalMs,
    staleAfterMs,
  });
  if (!witness.mayJudge) {
    log(`witness not judging — ${whyNotJudging(witness, staleAfterMs)}`);
  }

  for (const [name, config] of Object.entries(manifest.projects)) {
    const project: TicketingProject = { name, repoUrl: config.repo_url };
    try {
      // Before anything is picked up: a run left `active` by a daemon that
      // died is holding its project, and every ticket behind it is waiting on
      // a session that no longer exists.
      await reclaimStale(project, deps, result, log, witness, staleAfterMs);
      await pollProject(project, deps, result, log);
      // Last, so a run whose pull request merged during `pollProject` has
      // already been completed when its preview is released — R12's "within
      // one poll cycle" is the same cycle, not the next one.
      await reconcilePreviews(project, config, deps, result, log);
    } catch (error) {
      const line = `${name}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }

  return result;
}

/**
 * Why the daemon is declining to judge, in the terms an operator can act on.
 *
 * **Three refusals, not one**, and saying which is which is the whole value of
 * the line. A daemon that was away for 17m is a machine that slept; one that
 * has watched unbroken for 40s of a 2m window is a machine that just started
 * and is about to be fine. Collapsing them printed "nothing was watching for
 * 0s" on two cycles a tenth of a second apart — a statement an operator knows
 * to be false, which is how a log stops being read. Found by running the built
 * binary, not by a test.
 */
function whyNotJudging(witness: Witness, staleAfterMs: number): string {
  if (witness.gapMs === undefined) {
    return "no daemon has observed this state file before, so every run gets one fresh window";
  }
  if (witness.unwitnessedGap) {
    return (
      `nothing was watching for ${humanMs(witness.gapMs)}, ` +
      `so no run's silence over it is evidence of anything`
    );
  }
  return (
    `watching for ${humanMs(witness.watchedMs)} of the ` +
    `${humanMs(staleAfterMs)} it would have to vouch for`
  );
}

/**
 * `40s`, `1m03s`, `4h13m` — enough to tell jitter from a night's sleep, and
 * shaped like the progress line's own durations so the two read as one system.
 *
 * The seconds are load-bearing below a minute's resolution: dropping them
 * printed "watching for 1m of the 2m" on two consecutive cycles at the live
 * gate, which reads as a daemon stuck rather than one counting up.
 */
function humanMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
  return `${total}s`;
}

/**
 * Fail every run of `project` whose heartbeat has gone quiet *while a daemon
 * was listening*, tell its ticket, and let the ledger free the project and
 * promote whatever was queued behind it — `store.fail` does both, because
 * ending a run is what releases it.
 *
 * **The witness comes first and can stop this outright** (ADR-0020). A
 * `setInterval` cannot fire while its process is not scheduled, so a suspended
 * laptop silences a healthy session and the daemon watching it in the same
 * breath; 15a measured 146 such suspensions in one night, 113 of them past the
 * staleness threshold. Reclaiming on that evidence would have killed a live
 * run seventeen times over. So a cycle that cannot vouch for having watched
 * the window it is judging reclaims nothing and waits for one that can.
 *
 * Idempotent across cycles for free: a failed run is no longer running, so
 * the next call finds nothing and the ticket is told exactly once.
 */
async function reclaimStale(
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
  witness: Witness,
  threshold: number,
): Promise<void> {
  const { store, adapter } = deps;
  if (!witness.mayJudge) return;

  for (const run of store.staleRuns(threshold)) {
    if (run.project !== project.name) continue;

    const reason = reclaimedReason();
    store.fail(run.id, reason);
    log(`reclaim ${run.id} — ${reason}`);
    result.reclaimed.push(run.id);
    await adapter.postComment(project, run.ticket, failedComment(reason));
  }
}

/**
 * Bring every open Timone pull request on `project` into line with the commit
 * under review, and let the pull request itself say where to look.
 *
 * **Reconciliation, not a stage** ([ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)):
 * `PIPELINE_STAGES` gains no member and no run enters a preview state, because
 * a preview outlives the run that opened it and belongs to the pull request
 * rather than to the pipeline.
 *
 * **A project with no preview binding is not reconciled at all** — not asked
 * about, not looked up, and certainly not built. Previews are opt-in per
 * project, and the way to be sure of that is for this function to return
 * before it has done anything.
 *
 * Nothing here can stop the pipeline: a preview that fails is a value posted
 * on the pull request, and an adapter that throws is caught per pull request
 * so the rest of the cycle — and the rest of the project's pull requests —
 * carry on.
 */
async function reconcilePreviews(
  project: TicketingProject,
  config: ProjectConfig,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { previews, store, adapter } = deps;
  if (previews === undefined) return;
  if (config.bindings.preview === undefined) return;

  const target: PreviewProject = { name: project.name, path: config.path };

  for (const run of store.runsFor(project.name)) {
    if (run.pr === undefined || run.branch === undefined) continue;

    try {
      const pull = await adapter.findPullRequest(project, run.branch);
      if (pull === undefined) continue;

      if (pull.state === "open") {
        await ensurePreview(target, project, pull, deps, log);
      } else {
        await releasePreview(target, project, pull.number, deps, log);
      }
    } catch (error) {
      const line = `${project.name}: preview for #${run.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}

/**
 * Make an open pull request's preview true, and revise what the pull request
 * says about it — but only when a reviewer would notice the difference.
 *
 * That last condition is the whole reason the record exists. Reconciliation
 * runs every cycle; a comment posted every cycle would bury a client's pull
 * request under near-identical machine chatter within an hour.
 */
async function ensurePreview(
  target: PreviewProject,
  project: TicketingProject,
  pull: PullRequest,
  deps: PollDeps,
  log: (message: string) => void,
): Promise<void> {
  const { previews, store, adapter } = deps;
  if (previews === undefined) return;

  const preview = await previews.ensure(target, pull.number, pull.headSha);
  const before = store.recordPreview(
    project.name,
    pull.number,
    preview,
    pull.headSha,
  );
  if (
    before !== undefined &&
    before.headSha === pull.headSha &&
    before.state === preview.state &&
    before.url === preview.url &&
    before.reason === preview.reason
  ) {
    return;
  }

  await adapter.upsertPullRequestComment(
    project,
    pull.number,
    PREVIEW_MARKER,
    previewComment(preview, pull.headSha),
  );
  log(
    `preview ${project.name}!${pull.number} ${preview.state}` +
      (preview.url === undefined ? "" : ` — ${preview.url}`),
  );
}

/**
 * Give up the preview of a pull request that has ended, once.
 *
 * The record is what makes it once rather than every cycle thereafter: a
 * merged pull request stays merged forever, so a release keyed on the pull
 * request's state alone would generate work for the rest of the daemon's
 * life. Dropping the record is also what lets a *reopened* pull request get a
 * preview again with no code of its own — the next cycle simply finds it open
 * and unrecorded, which is the state a new pull request is in.
 */
async function releasePreview(
  target: PreviewProject,
  project: TicketingProject,
  pr: number,
  deps: PollDeps,
  log: (message: string) => void,
): Promise<void> {
  const { previews, store } = deps;
  if (previews === undefined) return;
  if (store.previewRecord(project.name, pr) === undefined) return;

  await previews.release(target, pr);
  store.forgetPreview(project.name, pr);
  log(`preview ${project.name}!${pr} released`);
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
      await deps.spawner.spawn(occupier, project, entryContext(occupier, tickets));
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
 * Where a run that has never run anything starts, when its ticket's labels
 * say somewhere other than the default.
 *
 * Only a wayfinder decision ticket does. It was charted by a discovery
 * session that had already decided what kind of question it holds, so sending
 * it through triage would classify a decision as a fresh request and route it
 * into the build pipeline. Everything else gets `undefined` — the spawner's
 * own default is triage, and naming it here as well would let the two
 * disagree.
 *
 * The labels come from the listing this cycle already made, so recognising a
 * wayfinder ticket costs the tracker nothing.
 */
function entryContext(
  run: Run,
  tickets: readonly Ticket[],
): SpawnContext | undefined {
  // A run that has already reached a stage is resuming rather than entering,
  // and where it resumes is the ledger's answer, not the label's.
  if (run.stage !== undefined) return undefined;

  const labels =
    tickets.find((candidate) => candidate.number === run.ticket)?.labels ?? [];
  const stage = wayfinderStage(labels);
  return stage === undefined ? undefined : { stage };
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

  // The map wins over the classification, and is read first for that reason.
  // These two labels can genuinely coexist: a ticket triaged before anyone
  // decided to chart it keeps its `triage:<kind>` label, and routing on that
  // would send a decision question off to have its requirements written. What
  // the ticket has *become* is a decision ticket on a map.
  const charted = wayfinderStage(labels);
  if (charted !== undefined) return charted;

  const kind = classificationFromLabels(labels);
  if (kind === undefined) return undefined;
  const transition = routeAfterTriage(kind);
  return transition.kind === "advance" ? transition.stage : undefined;
}
