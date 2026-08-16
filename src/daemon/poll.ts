import { join } from "node:path";

import type { Manifest, ProjectConfig } from "../manifest.js";
import {
  CTA_MARKER,
  MARK_LABEL,
  PREVIEW_MARKER,
  stampMachineComment,
  type PullRequest,
  type PullRequestThread,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import type {
  Preview,
  PreviewAdapter,
  PreviewProject,
} from "../adapters/preview.js";
import {
  instant as instantOf,
  readConversationRecord,
  readGateDecision,
  waitCursorFrom,
} from "./gates.js";
import {
  classificationFromLabels,
  concludeConversation,
  frontierIsEmpty,
  isBuilt,
  readGate,
  routeAfterTriage,
  stageAfter,
  wayfinderStage,
  type PipelineStage,
} from "./pipeline.js";
import { chunkProgress, isReproposal, readBreakdown } from "./breakdown.js";
import {
  ctaComment,
  ctaFor,
  type InitiativeProgress,
  type TicketState,
} from "./cta.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "./progress.js";
// The commands themselves, called with no state path so they take no lock:
// the daemon already holds it, and re-implementing what may be retried or
// cancelled would be a second opinion that drifts from the one the human gets
// at the terminal (ADR-0032).
import { runRetry } from "../commands/retry.js";
import { runCancel } from "../commands/cancel.js";
import { pending, settle, type QueuedRequest } from "./requests.js";
import { type Run, type RunStore, type Witness } from "./runs.js";
// The same comment the spawner posts when a session ends badly, because this
// is the same kind of ending: work stopped, nothing was decided, try again.
// `waitOf` comes from there too, so a run put back onto its wait is described
// by one function wherever it is put back — the spawner's release path and
// this loop's consume must not drift on what a run was waiting for.
import { failedComment, waitOf } from "./session.js";

/** What a spawn is resuming, when it is resuming something. */
export interface SpawnContext {
  /** Start at this stage rather than the run's recorded one. */
  stage?: PipelineStage;
  /**
   * The human's words, when they are what resumed the run: a gate's change
   * request, or the answer they wrote on a ticket waiting on a conversation
   * (ADR-0022). Its presence at a conversation stage is also what tells the
   * spawner to *run* that stage rather than invite again — a stage reached
   * with nothing in hand still stops.
   */
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
   * The timone root, so the loop can reach a project's checkout at
   * `projects/<name>/` — which is where a ticket's breakdown lives
   * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
   * D1) and therefore where "is there another piece of this to build?" is
   * answered.
   *
   * **Optional, and absent means the loop cannot read a breakdown at all**: a
   * merged pull request then ends its ticket exactly as it did before a ticket
   * hosted more than one chunk. That is the old behaviour rather than a new
   * one, and it is a fixture's answer, not a daemon's: `runDaemon`'s own
   * options require a root, so the compiler makes every real daemon state one
   * and only a test can construct a loop without.
   */
  root?: string;
  /**
   * Where the ledger lives, so the cycle can find the requests waiting beside
   * it ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
   *
   * **Optional, and absent means this cycle serves nobody**: a loop built
   * without one behaves exactly as it did before commands could ask for
   * anything. That is the shape every existing test constructs, and it is why
   * this is optional rather than required — `runDaemon` passes the path it
   * already resolved for the lock, so every real daemon has one.
   */
  statePath?: string;
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
  /** Run ids abandoned this cycle, because their ticket stopped being ours. */
  cancelled: string[];
  /** Run ids whose human wait was answered and which resumed this cycle. */
  resumed: string[];
  /** Run ids that reached a terminal state this cycle (a PR merged or closed). */
  completed: string[];
  /**
   * What a human asked for and this cycle carried out, as `<kind> <target>`
   * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
   * A request the cycle could not carry out is on {@link PollResult.errors}
   * instead, and is gone from the queue either way.
   */
  applied: string[];
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

/**
 * The comment posted on the ticket when its **last** pull request was merged
 * and the initiative is over.
 *
 * It names **every** pull request the initiative produced, not only the one
 * that just merged ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D3). A ticket built in four pieces closes on the fourth, and by then the
 * first is weeks up the thread — so the closing comment is the one place the
 * whole of the work is listed, and a reader arriving at the end can still find
 * all of it.
 */
export function mergedComment(prs: readonly number[]): string {
  const opening =
    prs.length <= 1
      ? `The work for this ticket went in with pull request ${listOf(prs)}.`
      : `The work for this ticket went in over ${prs.length} pieces — ` +
        `pull requests ${listOf(prs)}.`;

  return [
    "**Merged — this one is done.**",
    "",
    `${opening} The branches have`,
    "served their purpose, and this ticket's journey ends here.",
    "",
    "**What I need from you:** nothing — file a new ticket for anything else.",
  ].join("\n");
}

/**
 * The comment posted when a piece merged and the initiative carries on.
 *
 * It says three things a human would otherwise have to infer: that this piece
 * is in, how much of the list is left, and that the next one does **not** jump
 * the queue — R22 clause 6's promise that the project is free between chunks
 * is only kept if the person watching can see it being kept.
 */
export function pieceMergedComment(
  pr: number,
  done: number,
  total: number,
  next: string,
): string {
  return [
    `**Merged — that's ${done} of ${total} done.**`,
    "",
    `Pull request #${pr} went in, and this ticket isn't finished: the next piece`,
    `is **${next}**. I'll start it when this project is next free — it works one`,
    "thing at a time, so anything already waiting goes first.",
    "",
    "**What I need from you:** nothing — I'll comment here when the next piece starts.",
  ].join("\n");
}

/**
 * The comment posted when a piece merged but the list of pieces has grown
 * since the human approved it
 * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D3).
 *
 * **The ticket stays open and nothing else starts.** The piece that would come
 * next is one nobody has read, and the machine is not entitled to decide on
 * its own that the longer list is fine. What it *is* obliged to do is say so —
 * a ticket that simply went quiet would look exactly like a daemon that had
 * stopped.
 */
export function reproposedComment(
  pr: number,
  listed: number,
  approved: number,
  path: string,
): string {
  return [
    "**Merged — and I've stopped here.**",
    "",
    `Pull request #${pr} went in. But the list of pieces for this ticket now`,
    `holds ${listed}, and the version you approved held ${approved} — so it has`,
    "grown since, and the piece I would pick up next is one you have never seen.",
    "I'm not going to build something nobody agreed to, and I'm not going to",
    "decide on my own that the longer list is fine.",
    "",
    `**What I need from you:** read the list of pieces in \`${path}\` and say here whether to carry on with it.`,
  ].join("\n");
}

/** `#9`, `#9 and #12`, `#9, #12 and #14` — a list a person reads aloud. */
function listOf(prs: readonly number[]): string {
  const marked = prs.map((pr) => `#${pr}`);
  if (marked.length <= 1) return marked[0] ?? "none";
  return `${marked.slice(0, -1).join(", ")} and ${marked.at(-1)}`;
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
 * The one comment an unmarked ticket ever gets: who is reading this
 * repository, and what hands a ticket over
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **It says nothing about this ticket's state**, deliberately. It is posted
 * once and never revised — unlike the standing call to action, which is
 * reconciled every cycle and is the place a claim about *this* ticket
 * belongs. A one-time comment that made such a claim would be a sentence
 * frozen at the moment it was written, on a ticket that may be handed over
 * five minutes later.
 *
 * The label is named rather than described, because the whole failure this
 * closes is a human with no way of knowing what to do: `scratch-app` #5 was
 * filed on 2026-08-03 and sat silent, with nothing on it explaining why.
 */
export function introductionComment(): string {
  return [
    "**Hello — this repository is worked by a machine as well as by people.**",
    "",
    "I'm Timone. Where I'm asked to, I take a ticket from its first reading",
    "through to a pull request, and I write back here in plain language at every",
    "step, so the ticket itself tells you where things stand.",
    "",
    `I only do that for tickets carrying the \`${MARK_LABEL}\` label. This one`,
    "doesn't have it, so it is yours rather than mine and I am leaving it exactly",
    "as it is. **This is the only time I'll say so here** — I won't comment on",
    "this ticket again unless it is handed to me.",
    "",
    `**What I need from you:** nothing — add the \`${MARK_LABEL}\` label if you would like me to pick this up.`,
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
 * Why a run was abandoned before its session started, in the words of what was
 * actually observed.
 *
 * **It reports the observation, not a verdict.** A `Ticket` carries no
 * open/closed field and the listing this is judged against is the marked and
 * open one, so the ticket having left it is the whole of the evidence — it
 * covers a ticket closed and a mark taken off, and asserting a closure that
 * was never read would be the ledger claiming to know something it does not.
 */
export function noLongerListedReason(): string {
  return "its ticket is no longer open and marked for me";
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
    cancelled: [],
    resumed: [],
    completed: [],
    applied: [],
    errors: [],
  };

  // First of all, before the witness and before any project is looked at: a
  // human asked for this while the daemon held the ledger, and a retry applied
  // after the registration loop has already walked past its ticket waits a
  // whole cycle to do anything (ADR-0032). The natural place to add a new call
  // is at the end, and the end is the one place this may not go.
  await applyRequests(deps, result, log);

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
      await pollProject(project, config, deps, result, log);
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
 * Carry out what humans asked for while the daemon held the ledger
 * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
 *
 * **The daemon is still the ledger's only writer**, which is the whole of why
 * this exists: ADR-0023's rule is kept literally true by moving the *act* here
 * rather than by letting a second process write the file.
 *
 * **A request is settled whether or not it could be carried out.** The run was
 * already re-armed, the ticket has been closed, the project has left the
 * manifest — none of those get better by being retried every sixty seconds,
 * and a request that survives its own failure is a poison pill that stops the
 * queue for ever. What could not be done is said once, on the cycle's errors,
 * where the operator reads it.
 */
async function applyRequests(
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { statePath } = deps;
  if (statePath === undefined) return;

  const { requests, unreadable } = pending(statePath);

  for (const path of unreadable) {
    // Reported and left alone. Deleting it would destroy the only evidence of
    // whatever wrote it, and throwing would take the cycle — and therefore
    // every project — down over one bad file.
    const line = `unreadable request at ${path}, left where it is`;
    result.errors.push(line);
    log(`error  ${line}`);
  }

  for (const request of requests) {
    const { body } = request;
    const what = `${body.kind} ${body.project}#${body.ticket}`;
    const said: string[] = [];
    const say = (message: string): void => {
      said.push(message);
    };

    let code: number;
    try {
      code = await applyRequest(request, deps, say);
    } catch (error) {
      code = 1;
      say(oneLine(error));
    }
    settle(request.path);

    const words = said.join(" ");
    if (code === 0) {
      result.applied.push(what);
      log(`apply  ${what} (asked by ${request.askedBy}) — ${words}`);
      continue;
    }
    const line = `could not apply ${what} asked by ${request.askedBy}: ${words}`;
    result.errors.push(line);
    log(`error  ${line}`);
  }
}

/**
 * One request, applied by **the command's own code** rather than by a second
 * implementation of it.
 *
 * `runRetry` and `runCancel` take no lock when handed no state path — the
 * shape their own refusal tests use — so the daemon reaches the same decisions
 * about which runs may be retried, which may be cancelled, and what a rewind
 * of a consumed answer means, without either of them learning that a daemon
 * exists.
 */
async function applyRequest(
  request: QueuedRequest,
  deps: PollDeps,
  log: (message: string) => void,
): Promise<number> {
  const { manifest, store } = deps;
  const { body } = request;
  const target = `${body.project}#${body.ticket}`;

  switch (body.kind) {
    case "retry":
      return runRetry(target, { manifest, store, log });
    case "cancel":
      return runCancel(target, { manifest, store, reason: body.reason, log });
    case "claim-takeover":
    case "release-takeover":
      // Unreachable until 24d, because nothing enqueues one yet. Written as a
      // refusal rather than a silent settle so that if 24d lands the enqueue
      // and forgets the apply, the log says so on the first cycle.
      log("nothing in this daemon applies a takeover request yet.");
      return 1;
  }
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

/**
 * One project's share of a cycle. Throws only on tracker-level failures.
 *
 * It takes the project's manifest entry as well as its tracker identity
 * because one thing it does is governed per project rather than for every
 * project alike — see {@link introduceUnmarked}. `reconcilePreviews` takes the
 * same pair for the same reason.
 */
async function pollProject(
  project: TicketingProject,
  config: ProjectConfig,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter } = deps;

  // One reader per ticket for this project's turn, so every question the
  // cycle asks of a ticket's thread — has this wait ended, what should the
  // run resume with, does its call to action still stand — is answered from
  // one fetch of it.
  const threads = threadReaders(project, adapter);

  const tickets = await adapter.listMarkedTickets(project);
  // Tickets told where they stand a moment ago, by the acknowledgement below.
  const acknowledged = new Set<number>();
  for (const ticket of tickets) {
    // Before the ledger is touched: this is where a ticket's *next* chunk is
    // opened, so it is where one the human has not approved is refused. See
    // {@link successorHeldBack} — it says nothing about a ticket's first
    // chunk, or one it is already working.
    const heldBack = successorHeldBack(project.name, ticket.number, deps);
    if (heldBack !== undefined) {
      log(`hold   ${project.name}#${ticket.number} — ${heldBack}`);
      continue;
    }

    const occupier = store.occupyingRun(project.name);
    const { run, created } = store.register(project.name, ticket.number);
    if (!created) continue;
    acknowledged.add(ticket.number);

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

  // Before anything is resumed: a map whose frontier emptied since the last
  // cycle is a map that has a question to ask, and asking it is what makes
  // the answer readable. Ordered first so a go-ahead already written — the
  // daemon was down, or the human answered the closing summary within the
  // minute — is picked up on this cycle rather than the next.
  await openGoAheads(project, tickets, threads, deps, result, log);

  await resumeAnswered(project, deps, result, log, threads);

  // Hand off whatever now holds the project, if nothing is running it yet.
  // `promoteQueue` is what starts a run left queued behind a park that no
  // longer holds anything — promotion is otherwise a side effect of the run
  // ahead moving, and nothing moved.
  store.promoteQueue(project.name);
  const occupier = store.occupyingRun(project.name);
  if (occupier !== undefined && occupier.status === "picked-up") {
    // Before the spawn, never after it: a session started on a ticket nobody
    // is asking about any more is work done into a void, and the whole cost of
    // it has been paid by the time anything else could notice.
    //
    // **Absence from this cycle's listing is the observation, and the reason
    // says exactly that.** There is no open/closed field on a `Ticket` and the
    // listing is `--state open` and marked, so "closed" is not a question that
    // can be asked here without an adapter this slice does not have. What can
    // be seen is that the ticket is no longer in the set Timone is asked to
    // work, which covers the ticket being closed *and* the mark being taken
    // off it — both of which mean the same thing to the human who did it. The
    // reason must not claim more than that.
    //
    // Self-healing by construction: cancelling settles the chunk (ADR-0029),
    // so a ticket that comes back open and marked is registered as a fresh
    // chunk on the next cycle rather than being stuck behind an abandoned one.
    if (!tickets.some((candidate) => candidate.number === occupier.ticket)) {
      const reason = noLongerListedReason();
      store.cancel(occupier.id, reason);
      result.cancelled.push(occupier.id);
      log(`cancel ${occupier.id} — ${reason}`);
    } else {
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

  // Last, and deliberately: a ticket's call to action is a statement about
  // where its run stands *now*, and everything above is what moves it. A run
  // that resumed, failed or finished during this cycle says so on the same
  // cycle rather than a minute later.
  await reconcileCtas(project, tickets, acknowledged, threads, deps, result, log);

  // And after it, on the tickets nothing above could see — where this project
  // has asked for that. Nothing in this call reaches the ledger's pickup path,
  // which is what keeps R1 true.
  await introduceUnmarked(project, config, deps, result, log);
}

/**
 * Ask a wayfinder map for its go-ahead, once its own questions are all closed
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **This is the map's question being asked, and nothing else here asks it.**
 * A map is parked with no kind of wait for as long as it is being worked — it
 * is waiting on its own decision tickets, not on a human. The closing session
 * empties the frontier and says so with a label, and this is the cycle that
 * turns that into a wait a written answer can resolve.
 *
 * **It posts nothing.** The map's standing call to action is reconciled at
 * the end of this same cycle and flips itself, because {@link ctaFor} reads
 * the wait this writes — one computation, and the terminal follows it too.
 *
 * **The cursor is the machine's last word**, exactly as the spawner opens
 * every other wait, and for the reason {@link waitCursorFrom} gives: a human
 * who answers in the moment between the closing summary and this cycle must
 * not land past their own answer. Its other half matters more here — a map is
 * a ticket people talk on for weeks, and everything said *before* the way was
 * clear was said about something else. It cannot agree to a question nobody
 * had asked yet.
 *
 * The thread comes from the cycle's own reader, so it is the one the resume
 * decision reads a moment later and the reconciler reads after that: opening
 * the wait costs the tracker nothing.
 *
 * One-way, deliberately: a frontier that reopens (fog graduating into fresh
 * tickets) leaves the wait standing rather than withdrawing a question the
 * human may be in the middle of answering.
 */
async function openGoAheads(
  project: TicketingProject,
  tickets: readonly Ticket[],
  threads: (ticket: number) => RunThreads,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store } = deps;

  for (const ticket of tickets) {
    const run = store.runsForTicket(project.name, ticket.number).at(-1);
    if (run === undefined || run.stage !== "charting") continue;
    if (run.status !== "parked" || run.waitingKind !== undefined) continue;
    if (!frontierIsEmpty(ticket.labels)) continue;

    try {
      const thread = await threads(ticket.number).ticket();
      store.repark(run.id, {
        waitingOn: "your go-ahead to write the specification",
        kind: "conversation",
        stage: run.stage,
        waitCursor: waitCursorFrom(thread),
      });
      log(`asking ${run.id} — the way to the destination is clear`);
    } catch (error) {
      const line = `${project.name}: could not ask for the go-ahead on #${ticket.number}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}

/**
 * Say hello, once, on every open ticket that does not carry the mark
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **This is the one place in the loop that looks past the permission
 * boundary, and it may only ever speak.** {@link MARK_LABEL} stops bounding
 * what Timone *says* and still bounds what it *does*: nothing here registers a
 * run, spawns a session or applies a label, and
 * [PRD-02.R1](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md#r1--ticket-pickup)
 * — which forbids a run on an unmarked issue and has never forbidden a comment
 * — is what that sentence is protecting.
 *
 * **The ledger is what makes it once, and the thread is never consulted.**
 * `releasePreview`'s precedent: an unmarked ticket stays unmarked for ever, so
 * an introduction decided from the ticket's own state would be posted every
 * cycle for the life of the daemon. Reading the thread back to look for
 * something that might be ours is the other way to answer this, and it is a
 * guess — the machine posts under a person's account, a human may quote the
 * comment, and a guess that goes wrong duplicates the one comment this ticket
 * was ever meant to get.
 *
 * **Recorded before it is posted**, exactly as a pickup is registered before
 * it is acknowledged. The two failure modes are not symmetrical: a post that
 * fails after the record leaves one ticket unspoken-to and one line in
 * `errors`, while a record that fails after the post puts a second
 * introduction on a client's ticket on the next cycle, which is the fault this
 * whole mechanism exists to prevent.
 *
 * **A project that has not asked for this is not introduced to at all** — not
 * listed, not enumerated, not asked about. ADR-0024 gives the per-project
 * switch as *"the whole of the restraint"* on the one thing in this loop that
 * speaks where nobody invited it, and it defaults off for a repository
 * onboarded with an existing backlog: two hundred open issues would otherwise
 * each meet Timone in the same cycle. **Absent means off**, so an entry
 * written before the switch existed keeps its silence, and the return is above
 * the listing so a silent project costs the tracker nothing rather than one
 * request it discards — `reconcilePreviews`'s shape for an unbound project,
 * for the same reason.
 *
 * One extra listing per *introducing* project per cycle, and no per-ticket
 * read at all: what to say needs nothing from the thread.
 */
async function introduceUnmarked(
  project: TicketingProject,
  config: ProjectConfig,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  // First, and above everything: `!== true` rather than `=== false`, because
  // the key being absent is the case the ADR is written for.
  if (config.introduce_unmarked !== true) return;

  const { store, adapter } = deps;

  // Contained here rather than left to the project handler: this is the last
  // thing a project's turn does, and a listing that escaped would take the
  // project's preview reconciliation down with it — a repository Timone cannot
  // enumerate would stop telling reviewers where to look, which is a larger
  // consequence than the fault.
  let open: readonly Ticket[];
  try {
    open = await adapter.listOpenTickets(project);
  } catch (error) {
    const line = `${project.name}: could not list the open tickets: ${oneLine(error)}`;
    result.errors.push(line);
    log(`error  ${line}`);
    return;
  }

  for (const ticket of open) {
    if (ticket.labels.includes(MARK_LABEL)) continue;
    // A ticket the ledger is already working, whatever its labels say. Since
    // 20g `timone takeover` creates a run from the tracker for an open ticket
    // that has none, and deliberately does not apply the label — so "unmarked"
    // and "not mine" stopped being the same fact. Introducing itself here
    // would tell the human to hand over a ticket a session is already open on,
    // which is the lying line ADR-0024 exists to abolish; what such a ticket is
    // owed is a statement of where it stands, not an introduction.
    if (store.runsForTicket(project.name, ticket.number).length > 0) continue;
    if (store.introducedAt(project.name, ticket.number) !== undefined) continue;

    try {
      store.recordIntroduction(project.name, ticket.number);
      await adapter.postComment(project, ticket.number, introductionComment());
      log(`hello  ${project.name}#${ticket.number}`);
    } catch (error) {
      const line = `${project.name}: could not introduce myself on #${ticket.number}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}

/**
 * Bring every listed ticket into line with what it is currently asking of the
 * human, and say nothing wherever it already asks it
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **The differs-from-last guard is the whole of the restraint here, and it is
 * the way this goes wrong.** The loop runs every minute; an upsert issued
 * unconditionally is one comment edit per ticket per minute, which on a
 * client's tracker is a notification storm and a thread nobody can read. The
 * rendered body is the comparison key and needs no record of its own:
 * `ctaComment(ctaFor(state))` is a pure function of the state, so a body
 * identical to the one already on the ticket *is* the statement that nothing
 * has changed.
 *
 * **It compares by the same rule the upsert writes by** — ours, carrying the
 * marker, the first such comment. A guard judging by a different rule than
 * the write it guards would compare against one comment and edit another, and
 * so write on every cycle for ever, which is the fault it exists to prevent
 * wearing the costume of a fix.
 *
 * Nothing here decides what a ticket needs: {@link ctaFor} does, once, for
 * this surface and for `timone status` both. One ticket's failure is one
 * ticket's — a thread that cannot be read is reported and the rest of the
 * listing is still reconciled.
 */
async function reconcileCtas(
  project: TicketingProject,
  tickets: readonly Ticket[],
  acknowledged: ReadonlySet<number>,
  threads: (ticket: number) => RunThreads,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter, root } = deps;

  for (const ticket of tickets) {
    // A ticket acknowledged moments ago has just been told this, in these
    // words — `pickedUpComment` and `queuedComment` end on the very line the
    // call to action is made of. Repeating it under a marker in the same
    // cycle would be two near-identical comments seconds apart, which is what
    // the guard below exists to prevent everywhere else. Its standing copy
    // lands on the next cycle, by which time the run has usually moved.
    if (acknowledged.has(ticket.number)) continue;

    try {
      // Every chunk this ticket has had, because what the thread is asking
      // about is the initiative and the last run is only the latest piece of
      // it. On the cycle a piece merges, that last run is `done` and the
      // successor has not been opened yet — which is the gap ADR-0028 D4
      // exists to fill.
      const chunks = store.runsForTicket(project.name, ticket.number);
      const body = ctaBody({
        project: project.name,
        ticket: ticket.number,
        run: chunks.at(-1),
        labels: ticket.labels,
        progress:
          root === undefined
            ? undefined
            : initiativeProgress(
                checkoutOf(root, project.name),
                ticket.number,
                chunks,
              ),
      });
      const thread = await threads(ticket.number).ticket();
      if (saysTheSame(standingCta(thread), stampMachineComment(body))) continue;

      await adapter.upsertComment(project, ticket.number, CTA_MARKER, body);
      log(`cta    ${project.name}#${ticket.number}`);
    } catch (error) {
      const line = `${project.name}: could not say where #${ticket.number} stands: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}

/**
 * A ticket's standing statement of what it needs, under the marker that makes
 * it revisable. A renderer over a renderer: every word comes from
 * {@link ctaFor}, and the marker is prepended rather than baked into
 * {@link ctaComment} because the terminal's rendering of the same value must
 * not carry it.
 */
function ctaBody(state: TicketState): string {
  return `${CTA_MARKER}\n\n${ctaComment(ctaFor(state))}`;
}

/**
 * Whether what the ticket already says and what this cycle would say are the
 * same statement — undefined on the left meaning it has never been said.
 *
 * **Compared by their words rather than byte for byte, because the guard
 * fails open.** A tracker that hands a body back with the line endings it
 * stores rather than the ones it was sent — or a maintainer who edited the
 * comment in a browser — would otherwise make every cycle find a difference
 * and rewrite the comment, silently, for ever. That is not a near-miss of the
 * guard: it is precisely the storm the guard exists to prevent, arriving
 * through the one door left open.
 */
function saysTheSame(said: string | undefined, saying: string): boolean {
  const words = (body: string): string => body.replace(/\r\n/g, "\n").trim();
  return said !== undefined && words(said) === words(saying);
}

/**
 * What the machine last said under {@link CTA_MARKER} on `thread`, exactly as
 * the ticket holds it — stamp and all — or undefined where it has never said
 * it.
 *
 * The *first* such comment rather than the newest, matching
 * {@link TicketingAdapter.upsertComment}'s own `find`: this must name the
 * comment that call would edit. And ours rather than merely marked, for the
 * reason that call gives — Timone comments under a person's account, so the
 * machine header is the only thing telling the two apart, and a human
 * quoting the marker back is not the machine's last word.
 */
function standingCta(thread: TicketThread): string | undefined {
  return thread.comments.find(
    (comment) => comment.fromTimone && comment.body.includes(CTA_MARKER),
  )?.body;
}

/**
 * Where a run that has never run anything starts, when its ticket's labels —
 * or its own place in its ticket's sequence — say somewhere other than the
 * default.
 *
 * Two things answer, in this order.
 *
 * **The labels**, for a wayfinder decision ticket. It was charted by a
 * discovery session that had already decided what kind of question it holds,
 * so sending it through triage would classify a decision as a fresh request
 * and route it into the build pipeline.
 *
 * **The sequence number**, for a successor chunk. A ticket is a durable
 * conversation and hosts a sequence of chunks
 * ([ADR-0026](../../doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md));
 * triage classified it when its *first* chunk ran, and the classification is a
 * fact about the ticket rather than about one piece of it. A second chunk sent
 * through triage would re-classify a conversation already in flight — and
 * re-interview the human about a feature whose breakdown they have approved.
 * What a successor needs is a plan for its own piece, which is `planning`.
 *
 * **Labels first, deliberately:** a decision ticket that opens a second chunk
 * is still a decision ticket, and the sequence rule must not quietly re-point
 * it at the build pipeline.
 *
 * Everything else gets `undefined` — the spawner's own default is triage, and
 * naming it here as well would let the two disagree.
 *
 * The labels come from the listing this cycle already made, so recognising a
 * wayfinder ticket costs the tracker nothing, and the sequence is on the run.
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
  const charted = wayfinderStage(labels);
  if (charted !== undefined) return { stage: charted };

  return run.seq > 1 ? { stage: "planning" } : undefined;
}

/**
 * Resume every parked run whose human has answered.
 *
 * The ticket is the one surface this reads (ADR-0012): a gate's answer is the
 * human's reply, and a conversation's is either the record the session posted
 * when it concluded or — since ADR-0022 — the answer they simply wrote in the
 * thread. All of them are found relative to the cursor stored when the run
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
  threadsFor: (ticket: number) => RunThreads,
): Promise<void> {
  const { store, adapter } = deps;

  for (const run of store.parkedRuns(project.name)) {
    if (store.runningRun(project.name) !== undefined) return;
    if (run.stage === undefined) continue;

    const holder = store.occupyingRun(project.name);
    if (holder !== undefined && holder.id !== run.id) continue;

    // Every question asked about this run below is asked of the same thread,
    // fetched once. Two questions are asked — has the wait ended, and what
    // should the run resume with — and they used to be two fetches, so the
    // second could see a thread the first never saw and the pair could decide
    // against different comments. One read makes the decision atomic with
    // respect to what the human wrote, which is what ADR-0023 is about, and
    // halves the latency of reaching it.
    const threads = threadsFor(run.ticket);

    // A review park is the one wait that can end the run outright — a PR
    // merged or closed is a terminal event, not a stage to spawn.
    if (run.waitingKind === "review") {
      try {
        const ended = await concludeReview(run, project, threads, deps, result, log);
        if (ended) return;
      } catch (error) {
        const line = `${project.name}: could not read PR for #${run.ticket}: ${oneLine(error)}`;
        result.errors.push(line);
        log(`error  ${line}`);
        continue;
      }
    }

    // A conversation park is the other one, for a different reason: at a
    // stage nothing follows, the answer *is* the whole of the run.
    if (run.waitingKind === "conversation") {
      try {
        const ended = await concludeLastConversation(run, threads, deps, result, log);
        if (ended) return;
      } catch (error) {
        const line = `${project.name}: could not read #${run.ticket}: ${oneLine(error)}`;
        result.errors.push(line);
        log(`error  ${line}`);
        continue;
      }
    }

    let resumption: Resumption | undefined;
    try {
      resumption = await resolveWait(run, threads);
    } catch (error) {
      const line = `${project.name}: could not read #${run.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
      continue;
    }
    if (resumption === undefined) continue;

    try {
      // Reading the answer is what consumes it (ADR-0023), so the cursor moves
      // before the session exists rather than after it returns: a second reader
      // — another process, or this loop on its next cycle — then finds nothing
      // outstanding. Before the spawn and not after it, deliberately: the
      // spawner claims the run against the record it reads here and restores
      // that record if the session never starts, so a cursor written now
      // survives a failed spawn, while one written later would be overwritten.
      //
      // The same write records *which* answer was consumed, because the cursor
      // cannot keep it: `activate` clears the wait a moment later, and a
      // session killed after that used to leave the run failed with nothing
      // pointing at the answer it had read — so `timone retry` re-asked the
      // question instead of rewinding to it. One write, from the one read, so
      // the marker and the cursor can never name different comments.
      if (resumption.consumed !== undefined) {
        store.repark(run.id, {
          ...waitOf(run),
          waitCursor: resumption.consumed,
          consumedAnswerAt: resumption.consumed,
        });
      }
      await deps.spawner.spawn(run, project, resumption.context);
      result.resumed.push(run.id);
      log(`resume ${run.id} → ${resumption.context.stage ?? run.stage}`);
    } catch (error) {
      const line = `${project.name}: could not resume #${run.ticket}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
    return;
  }
}

/**
 * The threads one parked run's decisions are taken from, each fetched at most
 * once for the run's turn in a cycle.
 *
 * It exists so that "has this wait ended?" and "what should this run resume
 * with?" are answered from the same words. They are two questions about one
 * thread, asked a few hundred milliseconds apart, and asking the tracker twice
 * both paid for the round trip twice and left the pair free to disagree about
 * what the human had written — the answer read by one and not the other.
 *
 * **One reader per ticket, and its lifetime is one project's turn in one
 * cycle.** The staleness this must not buy is one thread answering for
 * another moment of itself, so the key is the ticket: a reader shared across
 * *runs* would answer a later run from a thread fetched before an earlier
 * run's session posted to it, and keying by ticket is what makes that
 * impossible. Within one ticket the sharing is the point — the call to action
 * reconciled at the end of the cycle is compared against the thread the
 * resume decision already read, rather than fetching it a second time, which
 * is what keeps "one read per parked run per cycle" true now that something
 * else in the cycle needs the same thread.
 */
interface RunThreads {
  /** The run's ticket, with its comments. */
  ticket(): Promise<TicketThread>;
  /** The thread of `pr`, which for a run is the pull request it opened. */
  pullRequest(pr: number): Promise<PullRequestThread>;
}

/**
 * This project's readers for this cycle, one per ticket, each created the
 * first time something asks for it.
 */
function threadReaders(
  project: TicketingProject,
  adapter: TicketingAdapter,
): (ticket: number) => RunThreads {
  const readers = new Map<number, RunThreads>();
  return (ticket) => {
    const existing = readers.get(ticket);
    if (existing !== undefined) return existing;
    const reader = threadsOf(ticket, project, adapter);
    readers.set(ticket, reader);
    return reader;
  };
}

/** {@link RunThreads} over `adapter`, memoising each thread's first fetch. */
function threadsOf(
  number: number,
  project: TicketingProject,
  adapter: TicketingAdapter,
): RunThreads {
  let ticket: Promise<TicketThread> | undefined;
  let pull: { pr: number; thread: Promise<PullRequestThread> } | undefined;

  return {
    ticket: () => (ticket ??= adapter.getTicket(project, number)),
    pullRequest: (pr) => {
      // Keyed by number rather than assumed: a run has one pull request today,
      // and a memo that answered for a different one would be a wrong thread
      // rather than a slow one.
      if (pull?.pr !== pr) {
        pull = { pr, thread: adapter.getPullRequestThread(project, pr) };
      }
      return pull.thread;
    },
  };
}

/**
 * End a review-parked run if its pull request reached a terminal state.
 * Returns true when the run ended (the ticket has been told and the queue
 * promoted); false when the PR is still open and the wait continues.
 */
async function concludeReview(
  run: Run,
  project: TicketingProject,
  threads: RunThreads,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<boolean> {
  const { store, adapter } = deps;
  if (run.pr === undefined) return false;

  const pr = await threads.pullRequest(run.pr);
  if (pr.state === "open") return false;

  // **First, and before anything about a successor is decided.** Completing
  // the chunk is what frees the project, and `store.complete` promotes
  // whatever queued behind it while it was building — a bug filed on Tuesday
  // takes the project here, in this call (R22 clause 6). This function's whole
  // remaining job is *close the ticket or don't*: the next chunk is opened by
  // the registration loop on a later cycle, which is what makes it queue
  // behind the promoted work rather than ahead of it. Registering a successor
  // from here would look identical and would starve the queue silently, which
  // is the fault ADR-0026 split the ledger to end.
  store.complete(run.id);

  if (pr.state === "merged") {
    await concludeInitiative(run, project, pr.number, deps, result, log);
  } else {
    await adapter.postComment(project, run.ticket, closedUnmergedComment(pr.number));
    await adapter.closeTicket(project, run.ticket, "not-planned");
  }

  result.completed.push(run.id);
  log(`done   ${run.id} — PR #${pr.number} ${pr.state}`);
  return true;
}

/**
 * Say what a merged pull request means for the *initiative*, now that the
 * chunk it belonged to is finished: the ticket closes, or it stays open with a
 * piece still to come.
 *
 * **It closes the ticket or it does not, and that is all it does.** It opens
 * nothing — see {@link concludeReview} for why the ordering matters.
 */
async function concludeInitiative(
  run: Run,
  project: TicketingProject,
  pr: number,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter } = deps;
  const succession = successionOf(project.name, run.ticket, deps);

  if (succession.kind === "unreadable") {
    // The file is there and says something nobody can act on. That is a fault
    // worth a line in the cycle's errors — unlike its *absence*, which is an
    // ordinary state of the world, since a chore has no breakdown by design
    // (ADR-0030 D3) — and the ticket still closes, because the alternative is
    // leaving it open on the strength of a file nothing could read.
    const line =
      `${project.name}: could not read the breakdown for #${run.ticket} ` +
      `(${succession.path}): ${succession.reason}`;
    result.errors.push(line);
    log(`error  ${line}`);
  }

  if (succession.kind === "reproposed") {
    await adapter.postComment(
      project,
      run.ticket,
      reproposedComment(pr, succession.listed, succession.approved, succession.path),
    );
    log(
      `held   ${run.id} — the list of pieces grew to ${succession.listed} ` +
        `since ${succession.approved} were approved`,
    );
    return;
  }

  if (succession.kind === "continues") {
    await adapter.postComment(
      project,
      run.ticket,
      pieceMergedComment(pr, succession.done, succession.total, succession.next),
    );
    log(`next   ${run.id} — piece ${succession.done + 1} of ${succession.total}`);
    return;
  }

  const prs = store
    .runsForTicket(project.name, run.ticket)
    .map((chunk) => chunk.pr)
    .filter((number): number is number => number !== undefined);
  await adapter.postComment(project, run.ticket, mergedComment(prs));
  await adapter.closeTicket(project, run.ticket, "completed");
}

/**
 * Where a managed project's checkout is, from the timone root
 * ([ADR-0007](../../doc/adr/0007-sessions-at-timone-root.md): everything runs
 * at the root and projects are materialized beneath it).
 *
 * **The only place the poll loop and `timone status` spell this**, so the two
 * cannot look for a ticket's breakdown in two different directories and
 * conclude two different things about the same initiative — which is R21's
 * original defect in a new costume.
 */
export function checkoutOf(root: string, project: string): string {
  return join(root, "projects", project);
}

/**
 * Where a ticket's initiative stands, for the two surfaces that have to say
 * so out loud ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D4) — or undefined when the ticket has no readable list of pieces at all,
 * which is nearly every ticket and every chore (ADR-0030 D3).
 *
 * **This is the single function `timone status` and the ticket both resolve
 * the progress value through**, and that is what makes [R21 clause
 * 8](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md) hold rather
 * than merely be intended. `ctaFor` decides what a ticket needs; this decides
 * the one input to it that neither renderer can see for itself. Two callers
 * computing it their own way would drift, and the drift would be invisible
 * until a human read the terminal and the thread in the same minute.
 *
 * `undefined` is answered rather than thrown for the reason `readBreakdown`
 * gives: this is on the path of every poll cycle and of every `timone status`,
 * and a project whose checkout is missing is an ordinary state of the world.
 */
export function initiativeProgress(
  repoDir: string,
  ticket: number,
  runs: readonly Run[],
): InitiativeProgress | undefined {
  const read = readBreakdown(repoDir, ticket);
  if (read.kind !== "ok") return undefined;

  // `done`, not settled — the same choice `successionOf` makes, and for the
  // same reason: a cancelled chunk delivered nothing, so the piece it was
  // opened for is still the piece to come.
  const done = runs.filter((chunk) => chunk.status === "done").length;
  const progress = chunkProgress(read.breakdown, done);
  return isReproposal(read.breakdown)
    ? { ...progress, reproposed: true }
    : progress;
}

/**
 * What a ticket's approved list of pieces says about what happens after this
 * chunk.
 *
 * **`finished` and `unlisted` are separate arms although a merged pull request
 * treats them alike**, and that is the distinction the second reader will want
 * to collapse. Both close the ticket — there is no next piece either way — but
 * only `finished` is a statement *about an approved list*. `unlisted` means
 * nobody ever wrote one, which is not a fault: a chore and a technical enabler
 * reach a pull request without ever meeting the breakdown stage (ADR-0030 D3),
 * and so does anything run by hand. So `unlisted` may never hold a ticket's
 * next chunk back, and {@link successorHeldBack} relies on being able to tell
 * the two apart.
 *
 * `unreadable` is separate again: a file that exists and cannot be parsed is
 * somebody's mistake rather than a shape of work.
 */
type Succession =
  | { kind: "finished" }
  | { kind: "unlisted" }
  | { kind: "unreadable"; path: string; reason: string }
  | { kind: "continues"; done: number; total: number; next: string }
  | { kind: "reproposed"; path: string; listed: number; approved: number };

/**
 * Read a ticket's breakdown against the ledger, and answer where the
 * initiative stands.
 *
 * **Doneness is derived, never written**
 * ([ADR-0030](../../doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)
 * D4). Nothing here — and nothing anywhere in this loop — writes to the
 * breakdown: the file the human approved is the file that stays on the branch,
 * and ticking a box in it would mean the daemon committing and pushing to a
 * client's default branch on its own account. So *which piece is next* is
 * computed every time it is asked, from the approved list and a count the
 * ledger already holds.
 *
 * **`done`, not settled.** `runs.ts` distinguishes the two and 23a left the
 * choice here: a *cancelled* chunk delivered nothing, so the piece it was
 * opened for is still the piece to build next, and counting it would skip one.
 * A `done` chunk is one whose pull request reached a terminal state, which is
 * the only evidence of a piece having actually landed.
 *
 * It never throws — `readBreakdown` answers instead — because this is on the
 * path of every cycle, and an exception here takes a whole project's turn with
 * it.
 */
function successionOf(
  project: string,
  ticket: number,
  deps: PollDeps,
): Succession {
  const { store, root } = deps;
  if (root === undefined) return { kind: "unlisted" };

  const read = readBreakdown(checkoutOf(root, project), ticket);
  if (read.kind === "absent") return { kind: "unlisted" };
  if (read.kind === "malformed") {
    return { kind: "unreadable", path: read.path, reason: read.reason };
  }

  const { breakdown } = read;
  if (isReproposal(breakdown) && breakdown.stamp.kind === "approved") {
    return {
      kind: "reproposed",
      path: read.path,
      listed: breakdown.chunks.length,
      approved: breakdown.stamp.pieces,
    };
  }

  const done = store
    .runsForTicket(project, ticket)
    .filter((chunk) => chunk.status === "done").length;
  const progress = chunkProgress(breakdown, done);
  return progress.next === undefined
    ? { kind: "finished" }
    : {
        kind: "continues",
        done: progress.done,
        total: progress.total,
        next: progress.next.title,
      };
}

/**
 * Why this ticket's **next** chunk may not be opened yet, in words for a log
 * line — or undefined when it may.
 *
 * Succession rides the registration loop, which opens the next chunk of every
 * marked ticket whose previous one has settled. That is what makes a successor
 * queue behind work that was already waiting (R22 clause 6) — and it is also
 * what would open a piece nobody approved, one minute after the loop refused
 * to close the ticket over exactly that. This is where the refusal is kept.
 *
 * **It can only ever hold back a *successor*.** A ticket with no chunks at all
 * is registered without a thought — the breakdown does not exist yet at that
 * point and could not, since it is written by a stage this registration is on
 * the way to. A ticket with a live chunk is handed that chunk back by
 * `register` regardless. So both return early, before anything touches a disk.
 *
 * **A ticket with no breakdown is never held back**, which is the arm that
 * matters most: a chore never meets the breakdown stage (ADR-0030 D3), and a
 * guard that refused what it could not find would freeze every chore on the
 * fleet the moment it opened its second chunk.
 */
function successorHeldBack(
  project: string,
  ticket: number,
  deps: PollDeps,
): string | undefined {
  const { store } = deps;
  if (store.liveRunForTicket(project, ticket) !== undefined) return undefined;
  if (store.runsForTicket(project, ticket).length === 0) return undefined;

  const succession = successionOf(project, ticket, deps);
  if (succession.kind === "reproposed") {
    return (
      `the list of pieces has grown to ${succession.listed} since ` +
      `${succession.approved} were approved`
    );
  }
  return succession.kind === "finished"
    ? "every piece the human approved has been built"
    : undefined;
}

/**
 * End a conversation-parked run whose stage has nothing after it, once the
 * conversation has been recorded as agreed. Returns true when the run ended,
 * false when it is still waiting or has somewhere left to go.
 *
 * Only `wayfinding` is such a stage today, and deliberately so (ADR-0010): a
 * decision ticket's answer resolves that ticket and the map owns what comes
 * next, so there is no next stage to advance into. Without this the run sat
 * `parked` for the rest of the ledger's life — harmless, since a closed
 * ticket leaves `listMarkedTickets` and nothing re-registers it, but it left
 * `timone status` claiming to be waiting on a human for a question they had
 * already answered.
 *
 * The session started by a *written* answer ends its own run, in the spawner:
 * it is still `active` when it finds the record, so it is not this loop's to
 * see. This is the takeover's half of the same ending — a session the daemon
 * never ran, whose only trace is what it posted.
 */
async function concludeLastConversation(
  run: Run,
  threads: RunThreads,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<boolean> {
  const { store } = deps;
  const { stage, waitCursor } = run;
  if (stage === undefined || waitCursor === undefined) return false;

  const thread = await threads.ticket();
  if (readConversationRecord(thread, waitCursor) === undefined) return false;

  const transition = concludeConversation(stage, { accepted: true });
  if (transition.kind !== "finish") return false;

  store.complete(run.id);
  result.completed.push(run.id);
  log(`done   ${run.id} — ${transition.reason}`);
  return true;
}

/**
 * A parked run's decision to resume: what the session should do, and what
 * reading the wait consumed in order to decide it.
 *
 * The two travel together because they are one decision. A cursor computed
 * separately would mean reading the thread twice and judging it twice, and two
 * readers of one thread are free to disagree about which comment the answer
 * was.
 */
interface Resumption {
  context: SpawnContext;
  /**
   * The instant the run's wait cursor must advance to before the session
   * starts, when deciding to resume *was* reading the human's words
   * (ADR-0023). Absent when nothing was consumed: an approval, an accepted
   * conversation record and a park with no wait at all are all decided from
   * something other than a comment the loop must not read twice.
   */
  consumed?: string;
}

/**
 * What a parked run should do now, or undefined while it is still waiting.
 *
 * A change request returns the *same* stage with the human's words; an
 * approval or an accepted conversation returns the next one. Nothing else
 * moves a run — an unanswered gate and an abandoned conversation both look
 * like silence, and silence is not an answer.
 *
 * It reads through {@link RunThreads} rather than the adapter, so the thread
 * it judges is the one the caller's own conclusion check judged, and no branch
 * here can quietly fetch a second copy of it.
 */
async function resolveWait(
  run: Run,
  threads: RunThreads,
): Promise<Resumption | undefined> {
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
    // A map being worked is the one park with no wait that is not a run
    // stopped for want of machinery. It is waiting on its own decision
    // tickets, and what moves it is {@link openGoAheads} finding the frontier
    // empty — never a resume, which at this stage would spawn a session for a
    // map nobody has agreed to write anything about.
    if (stage === "charting") return undefined;
    if (stage !== "triage") {
      return isBuilt(stage) ? { context: { stage } } : undefined;
    }
    const thread = await threads.ticket();
    const next = whatFollows(stage, thread.labels);
    return next !== undefined && isBuilt(next)
      ? { context: { stage: next } }
      : undefined;
  }

  const cursor = run.waitCursor;
  if (cursor === undefined) return undefined;

  if (run.waitingKind === "gate") {
    const thread = await threads.ticket();
    const decision = readGateDecision(thread, cursor);
    const transition = readGate(stage, decision);

    if (transition.kind === "advance") {
      return {
        context: {
          stage: transition.stage,
          approval:
            decision?.kind === "approve"
              ? {
                  stage,
                  by: decision.comment.author,
                  at: decision.comment.createdAt,
                }
              : undefined,
        },
      };
    }
    if (transition.kind === "repeat") {
      return {
        context: { stage: transition.stage, feedback: transition.feedback },
      };
    }
    return undefined;
  }

  if (run.waitingKind === "conversation") {
    // The map's conversation is the one whose answer is *agreement* rather
    // than information (ADR-0024). Everywhere else a written answer re-enters
    // the same stage, because that stage has to judge whether the answer
    // settles the question it asked; here the question is "shall I write the
    // specification?", nothing runs at this stage, and what the agreement
    // starts is stage 3 — on this run, holding this project until the
    // specification is committed.
    //
    // The frontier is re-checked rather than trusted: the wait was opened
    // when it was empty, and a map that has since grown a question back is
    // one nobody has agreed anything about. It is the same clause the
    // `waitingKind === undefined` branch above enforces, and it is worth two
    // copies — this is the branch that starts a build.
    if (stage === "charting") {
      const thread = await threads.ticket();
      if (!frontierIsEmpty(thread.labels)) return undefined;

      const answer = writtenAnswer(thread, cursor);
      if (answer === undefined) return undefined;

      const transition = concludeConversation(stage, { accepted: true });
      return transition.kind === "advance"
        ? {
            context: { stage: transition.stage, feedback: answer.words },
            consumed: answer.at,
          }
        : undefined;
    }

    // One thread, and both halves of the decision taken from it: what the
    // session is handed, and the instant consuming it advances the cursor to
    // (ADR-0023). Splitting the pair across two reads would let the run resume
    // on words it had already consumed, or consume words it never read.
    const thread = await threads.ticket();
    const record = readConversationRecord(thread, cursor);
    if (record !== undefined) {
      const transition = concludeConversation(stage, { accepted: true });
      return transition.kind === "advance"
        ? { context: { stage: transition.stage } }
        : undefined;
    }

    // ADR-0022's second path. The conversation may also be answered in
    // writing, and what resumes is the *same* stage carrying the words — the
    // conversation is what ingests an answer to its own question, and
    // advancing on it would skip the stage that has to judge whether the
    // answer settles anything.
    //
    // This is the one wait resolved by reading what a human wrote where the
    // words themselves are the trigger, so it is the one that must be consumed
    // (ADR-0023): a gate's answer clears its wait by advancing the run to
    // another stage, and a conversation record is the machine's own.
    const answer = writtenAnswer(thread, cursor);
    return answer === undefined
      ? undefined
      : { context: { stage, feedback: answer.words }, consumed: answer.at };
  }

  if (run.waitingKind === "review") {
    if (run.pr === undefined) return undefined;
    const pr = await threads.pullRequest(run.pr);

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

    return {
      context: { stage: "remediation", feedback: words.join("\n\n---\n\n") },
    };
  }

  return undefined;
}

/**
 * The human's written answer to an open conversation, or undefined while they
 * have not written one — their words, and the instant of the last comment the
 * answer was read from.
 *
 * That instant is what consuming moves the cursor to (ADR-0023), and it is the
 * *newest* comment read rather than the oldest so that nothing already read is
 * left outstanding, and nothing said later is swallowed with it.
 *
 * **No keyword, and Timone's own comments can never be it** — the machine asks
 * its remaining question on the same thread it is watching, and a loop that
 * read its own question as the answer would ask forever. `fromTimone` is the
 * adapter's marker-derived judgement, never the author, because Timone posts
 * through the human's account.
 *
 * **Everything they wrote after the park is the answer, joined** — the same
 * rule the review park reads a review by, and settled deliberately against
 * preferring the newest. A written answer is meant to be read generously, and
 * someone who answers and then adds a second thought has said one thing in two
 * comments: dropping the first would lose it, silently and without telling
 * them.
 */
function writtenAnswer(
  thread: TicketThread,
  cursor: string,
): { words: string; at: string } | undefined {
  const after = instantOf(cursor);

  const said = thread.comments.filter(
    (comment) =>
      !comment.fromTimone &&
      instantOf(comment.createdAt) > after &&
      comment.body.trim() !== "",
  );
  const newest = said.at(-1);
  if (newest === undefined) return undefined;

  return {
    words: said.map((comment) => comment.body.trim()).join("\n\n---\n\n"),
    at: newest.createdAt,
  };
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
