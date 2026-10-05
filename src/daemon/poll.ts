import type { Manifest, ProjectConfig } from "../manifest.js";
import type { PlannerDriver } from "../planner/driver.js";
import type { RunnerDriver } from "../runner/driver.js";
import {
  type Dependency,
  MARK_LABEL,
  PREVIEW_MARKER,
  type PullRequest,
  type PullRequestThread,
  type Step,
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
  fromForgeDefaultBranch,
  isReproposal,
  readBreakdown,
  readBreakdownSync,
  type BreakdownRead,
  type SyncBreakdownSource,
  type BreakdownSource,
} from "./breakdown.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "./progress.js";
// The commands themselves, called with no state path so they take no lock:
// the daemon already holds it, and re-implementing what may be cancelled or
// taken over would be a second opinion that drifts from the one the human gets
// at the terminal (ADR-0032).
import { holdCancelledTicket, runCancel } from "../commands/cancel.js";
import { resolveTakeover } from "../commands/takeover.js";
import { pending, settle, type QueuedRequest } from "./requests.js";
import {
  type InitiativeRecord, type Run, type RunStore, type Witness } from "./runs.js";
import { HELD_LABEL, MAP_LABEL, eligibleSteps } from "./steps.js";

export interface PollDeps {
  manifest: Manifest;
  store: RunStore;
  adapter: TicketingAdapter;
  /**
   * ~~The timone root, so the loop can reach a project's checkout.~~
   *
   * ✏ **Removed by phase 30's 30d.** The loop reached `projects/<name>/` to
   * read a ticket's breakdown, and it does not any more: the breakdown comes
   * off the project's default branch **on the forge**
   * ([ADR-0043](../../doc/adr/0043-the-humans-checkout-is-theirs-alone.md)).
   * There is nothing left here for a root to be for, and leaving the field in
   * place would be an invitation to reach for it again.
   *
   * Kept as a comment rather than deleted silently because "the loop is told
   * where the checkouts are" was a thing three tests asserted, one ADR
   * explained, and a whole refinement of phase 27 existed to fix.
   */
  /**
   * Where the ledger lives, so the cycle can find the requests waiting beside
   * it ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
   *
   * **Optional, and absent means this cycle serves nobody**: a loop built
   * without one behaves exactly as it did before commands could ask for
   * anything. That is the shape most tests construct, and it is why this is
   * optional rather than required — `runDaemon` passes the path it already
   * resolved for the lock, so every real daemon has one.
   */
  statePath?: string;
  /**
   * How often a cycle that is busy looks for a cancellation to carry out
   * ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)).
   * Injected so a test does not wait real seconds for the watch to come
   * round; {@link CANCEL_WATCH_INTERVAL_MS} otherwise.
   */
  cancelWatchIntervalMs?: number;
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
  /**
   * Where a ticket's approved list of pieces is read from. Defaults to the
   * project's default branch, which is the only place an approved breakdown is
   * guaranteed to be (ADR-0030 D2).
   *
   * **Injected so a test can hand over a plain directory**, not so a deployment
   * can choose: every real daemon takes the default. It was a working-tree read
   * until phase 27, which made "which piece is next" depend on the branch the
   * last session happened to leave checked out.
   */
  breakdownSource?: BreakdownSource;
  /**
   * The runner, which drives every project
   * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
   * D9). Each project is handed to it after the registration loop: what
   * happens next to each run is the runner's to decide.
   *
   * ✏ 2026-09-30: required. Until then a project chose its driver in the
   * manifest, and a cycle built without a runner left the runner's projects
   * alone. There is one driver now, so there is nothing to leave a project to.
   */
  runner: RunnerDriver;
  /**
   * The planner, which decides for each project which ticket may be built
   * now ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
   * D1). Each project is handed to it after the runner, with the same cycle.
   * Absent means no planner session starts, and a run that waits for one
   * goes on waiting.
   */
  planner?: Pick<PlannerDriver, "tick">;
  /** Progress sink; defaults to silence (the command wires stdout). */
  log?: (message: string) => void;
}

export interface PollResult {
  /**
   * Run ids reclaimed from a dead daemon this cycle, and so given back to the
   * runner.
   */
  reclaimed: string[];
  /**
   * Run ids newly picked up this cycle. ✏ 2026-10-04: every pickup lands
   * here; nothing is queued any more (ADR-0063 D2).
   */
  pickedUp: string[];
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
 * How often a cycle in progress looks for a cancellation
 * ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)).
 *
 * **Seconds, not a poll interval.** The whole value of a cancellation is how
 * soon it lands, and the cycle it has to interrupt can be held by a forge
 * that is slow to answer or a preview that is slow to start. The cost of a
 * look is one `readdir` of a directory that is almost always empty.
 */
export const CANCEL_WATCH_INTERVAL_MS = 2_000;

/**
 * The comment that closes an **initiative**, once no step of it is open.
 *
 * **It states what was actually delivered, never what was planned.** A step
 * can be closed because it was *dropped* — cancelled, then closed by a human
 * who moved on — and an initiative that refused to close over one abandoned
 * step would be a thread that never ends, which is the failure ADR-0040
 * exists to fix
 * ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
 * D4).
 *
 * **Built versus dropped is inferred and never asked.** One fact decides it:
 * a step whose run delivered a merged pull request was built, and a step
 * closed without one was dropped. No label, no comment convention, and
 * nothing the human has to remember to do — the tempting alternatives all put
 * a gesture between them and a thread that should simply finish.
 */
export function initiativeClosedComment(
  built: readonly number[],
  dropped: readonly number[],
  prs: readonly number[],
): string {
  const total = built.length + dropped.length;
  const opening =
    dropped.length === 0
      ? `All ${total} pieces were built.`
      : `${built.length} of ${total} pieces were built — ` +
        `${dropped.length === 1 ? "one was" : `${dropped.length} were`} ` +
        `dropped: ${listOf(dropped.map((step) => step))}.`;

  return [
    "**Done — this ticket is finished.**",
    "",
    opening,
    prs.length === 0
      ? "Nothing was merged for it."
      : `The work went in with pull ${prs.length === 1 ? "request" : "requests"} ${listOf(prs)}.`,
    "",
    "**What I need from you:** nothing — file a new ticket for anything else.",
  ].join("\n");
}

/** `#9`, `#9 and #12`, `#9, #12 and #14` — a list a person reads aloud. */
function listOf(prs: readonly number[]): string {
  const marked = prs.map((pr) => `#${pr}`);
  if (marked.length <= 1) return marked[0] ?? "none";
  return `${marked.slice(0, -1).join(", ")} and ${marked.at(-1)}`;
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
 * The one comment an unmarked ticket ever gets: who is reading this
 * repository, and what hands a ticket over
 * ([ADR-0024](../../doc/adr/0024-every-open-ticket-answers-for-itself.md)).
 *
 * **It says nothing about this ticket's state**, deliberately. It is posted
 * once and never revised. A one-time comment that made a claim about *this*
 * ticket would be a sentence frozen at the moment it was written, on a ticket
 * that may be handed over five minutes later.
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
 * once, and ask the runner to wake for each run that has something new.
 *
 * Nothing here throws: a project whose tracker misbehaves is reported in
 * `errors` and the remaining projects are still polled. The acknowledgement
 * is posted only for runs this cycle created, which is what makes repeated
 * cycles silent (the store's registration is idempotent per ticket).
 */
export async function pollOnce(deps: PollDeps): Promise<PollResult> {
  const log = deps.log ?? (() => {});
  const result: PollResult = {
    reclaimed: [],
    pickedUp: [],
    applied: [],
    errors: [],
  };

  // First of all, before the witness and before any project is looked at: a
  // human asked for this while the daemon held the ledger, and a request applied
  // after the registration loop has already walked past its ticket waits a
  // whole cycle to do anything (ADR-0032). The natural place to add a new call
  // is at the end, and the end is the one place this may not go.
  await applyRequests(deps, result, log);

  // From here to the end of the cycle, a cancellation is read on a clock of
  // its own (ADR-0047). Everything below can block for as long as a slow
  // forge call or a slow preview start takes, and a `timone cancel` that
  // waits for that is a cancel that arrives late (#69).
  const cancellations = watchForCancellations(deps, result, log);
  try {
    await pollProjects(deps, result, log);
  } finally {
    await cancellations.stop();
  }

  // Last of all, and after the per-project catch so a project that threw does
  // not cost the daemon its own alibi: this cycle has stopped working, so the
  // next one measures the gap it was idle rather than the gap since this one
  // began (timone#49).
  deps.store.cycleEnded();

  return result;
}

/**
 * Every project, polled in turn — the body of a cycle, minus the requests it
 * opens with and the stamps it closes with.
 *
 * Its own function so that {@link watchForCancellations} can wrap exactly the
 * part of a cycle that blocks, and so the watch is stopped on the way out
 * whatever happens in here.
 */
async function pollProjects(
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
  const { manifest } = deps;

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
    log(
      `waiting not checking for dead runs — ${whyNotJudging(witness, staleAfterMs)}`,
    );
  }

  // ✏ In manifest order, and one after the other (PRD-05 R15). No project's
  // turn waits for a session: the runner's tick returns once it has asked for
  // its wakes, so one project's work does not hold up the next. Until
  // 2026-09-30 a project the old daemon drove waited for the whole of its
  // session here, and the runner's projects needed a clock of their own.
  for (const [name, config] of Object.entries(manifest.projects)) {
    const project: TicketingProject = { name, repoUrl: config.repo_url };
    try {
      // Before anything is picked up: a run left `active` by a daemon that
      // died is holding its project, and every ticket behind it is waiting on
      // a session that no longer exists.
      await reclaimStale(project, deps, result, log, witness, staleAfterMs);
      await pollProject(project, config, deps, result, log);
      // Last, so a preview is looked at after everything else this project
      // did in the cycle.
      await reconcilePreviews(project, config, deps, result, log);
    } catch (error) {
      const line = `${name}: ${oneLine(error)}`;
      result.errors.push(line);
      log(`error  ${line}`);
    }
  }
}

/** What the cycle says about a retry request left from before it was removed. */
const RETRY_REMOVED =
  "the retry command was removed. Write on the ticket instead: say what you want done.";

/**
 * Carry out what humans asked for while the daemon held the ledger
 * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
 *
 * **The daemon is still the ledger's only writer**, which is the whole of why
 * this exists: ADR-0023's rule is kept literally true by moving the *act* here
 * rather than by letting a second process write the file.
 *
 * **A request is settled whether or not it could be carried out.** The run has
 * already ended, the ticket has been closed, the project has left the
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

  const { requests, removed, unreadable } = pending(statePath);

  for (const path of unreadable) {
    // Reported and left alone. Deleting it would destroy the only evidence of
    // whatever wrote it, and throwing would take the cycle — and therefore
    // every project — down over one bad file.
    const line = `unreadable request at ${path}, left where it is`;
    result.errors.push(line);
    log(`error  ${line}`);
  }

  for (const leftover of removed) {
    // A retry left before the command was removed. It can no longer be
    // carried out, so it is settled like any request that could not be, and
    // said once. Left on disk, it would be reported on every cycle.
    settle(leftover.path);
    const what = `${leftover.body.kind} ${leftover.body.project}#${leftover.body.ticket}`;
    const line = `could not apply ${what} asked by ${leftover.askedBy}: ${RETRY_REMOVED}`;
    result.errors.push(line);
    log(`error  ${line}`);
  }

  for (const request of requests) {
    await carryOut(request, deps, result, log);
  }
}

/**
 * One request, carried out, settled and reported — whichever clock found it.
 *
 * Shared by the top of the cycle and by the cancellation watch that runs
 * *during* it ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)),
 * so a cancellation applied while a run is in flight is applied by the same
 * code, settled the same way and reported on the same cycle as one applied
 * before the projects are walked.
 */
async function carryOut(
  request: QueuedRequest,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): Promise<void> {
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
    return;
  }
  const line = `could not apply ${what} asked by ${request.askedBy}: ${words}`;
  result.errors.push(line);
  log(`error  ${line}`);
}

/** A cancellation watch, stoppable — and awaited when it is stopped. */
interface CancelWatch {
  stop(): Promise<void>;
}

/**
 * Look for cancellations on a clock of the watch's own, for as long as this
 * cycle lasts ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)).
 *
 * **Why a second clock exists at all.** ADR-0032 put requests first in the
 * cycle so that none of them waits a whole cycle, and that placement is
 * right. What defeats it is that a cycle does not come round again while a
 * run is in flight: the daemon spawns a session and awaits it, so "first in
 * the next cycle" and "when the run ends" are the same moment. On 2026-08-30
 * that was nine minutes, over two commands, on the one request whose entire
 * purpose is to interrupt work that is happening now
 * ([#69](https://github.com/fvermaut/timone/issues/69)).
 *
 * ✏ 2026-09-30: no cycle waits for a session any more, since the runner's
 * wakes run on their own. The clock stays, because a forge that is slow to
 * answer, or a preview that is slow to start, still holds the cycle.
 *
 * **Cancellations only, and deliberately.** Every other request asks for work
 * to *start* or to *move*, and a cycle already walking the projects is the
 * worst moment to be told either — a request applied halfway through the
 * registration loop is exactly the race ADR-0032 avoided by applying requests
 * before the walk. A cancellation is the opposite: it asks for work to stop,
 * it is the one request that is worth less the later it lands, and nothing it
 * touches is something the cycle is going on to start.
 *
 * **The order between the two clocks is the request's own order**, which is
 * all ADR-0032 promised: cancellations are carried out oldest first here, as
 * they are there. A cancellation may overtake a request of another kind that
 * was asked for earlier, and that is the intended effect rather than a lost
 * guarantee.
 */
function watchForCancellations(
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
): CancelWatch {
  const { statePath } = deps;
  if (statePath === undefined) return { stop: async () => {} };

  // One look at a time. A look that runs long — a cancellation posts nothing,
  // but it does write the ledger — must not be overtaken by the next tick and
  // settle the same request twice.
  let looking: Promise<void> | undefined;
  const look = async (): Promise<void> => {
    if (looking !== undefined) return;
    looking = (async () => {
      try {
        for (const request of pending(statePath).requests) {
          if (request.body.kind !== "cancel") continue;
          await carryOut(request, deps, result, log);
        }
      } catch (error) {
        // Caught in here, so this promise never rejects: it is awaited both
        // by the tick that made it and by whoever stops the watch, and a
        // rejection would reach one of them as the cycle's own failure. A
        // watch that cannot look is worth a line, never the poll.
        const line = `could not look for cancellations: ${oneLine(error)}`;
        result.errors.push(line);
        log(`error  ${line}`);
      }
    })();
    try {
      await looking;
    } finally {
      looking = undefined;
    }
  };

  const handle = setInterval(
    () => void look(),
    deps.cancelWatchIntervalMs ?? CANCEL_WATCH_INTERVAL_MS,
  );
  // The daemon's own loop is what keeps the process alive; this timer must
  // never be the reason a `--once` run refuses to exit.
  handle.unref?.();

  return {
    async stop(): Promise<void> {
      clearInterval(handle);
      // A look already in flight finishes before the cycle reports: it is
      // writing the ledger and appending to this cycle's result.
      await looking;
    },
  };
}

/**
 * One request, applied by **the command's own code** rather than by a second
 * implementation of it.
 *
 * `runCancel` takes no lock when handed no state path — the shape its own
 * refusal tests use — so the daemon reaches the same decisions about which
 * runs may be cancelled, without the command learning that a daemon exists.
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
    case "cancel": {
      const code = await runCancel(target, {
        manifest,
        store,
        reason: body.reason,
        log,
      });
      // The ledger first, the work second, and never the other way round
      // ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)):
      // a step reads the run when it ends, and a step stopped before the
      // cancellation was written would end on a run not yet cancelled, and
      // wake the runner for it. Only when the cancellation actually took — a
      // refused one has stopped nothing and must not stop work that is fine.
      if (code === 0) {
        const cancelled = store.runsForTicket(body.project, body.ticket).at(-1);
        // The runner's work: the step's box and the runner's own session
        // (PRD-05 R11).
        if (cancelled !== undefined) deps.runner.stop(cancelled.id);
        // Then the hold on the ticket (40u): still open and marked, it would
        // otherwise be taken up as a new run on the next pass. After the
        // stop, never before it: the forge can take a minute to answer, and
        // the work must not run on meanwhile. Before this request is settled,
        // so the pass that follows it lists the ticket held.
        await holdCancelledTicket(
          { manifest, store, adapter: deps.adapter },
          { project: body.project, ticket: body.ticket },
          log,
        );
      }
      return code;
    }
    case "claim-takeover": {
      // The daemon resolves as the command would, which is what makes a
      // takeover of a ticket the ledger has never heard of work while the
      // daemon is up: enrolling is a write, and the writer is here.
      const resolution = await resolveTakeover(
        { project: body.project, ticket: body.ticket },
        { manifest, store, adapter: deps.adapter },
      );
      // A run waiting for the runner is handed over, and so is the one the
      // command has just enrolled: the terminal gets whatever the command
      // itself would have claimed.
      if (resolution.kind === "nothing-to-do") {
        log(resolution.message);
        return 1;
      }
      // ✏ 2026-10-05 (ADR-0067 D1): a step runs on it. The terminal is written
      // on the run as the one that waits for the step, and the step's end
      // hands the run to it (D2). A request written before requests carried
      // a holder names no terminal to hand it to, so it gets the refusal it
      // always got.
      if (resolution.kind === "wait-for-step") {
        if (body.holder === undefined) {
          log(
            `I'm working on ${body.project} #${body.ticket} right now. ` +
              "Anything I need from you will land on the ticket.",
          );
          return 1;
        }
        store.waitForStep(resolution.run.id, body.holder);
        log(`${target} waits for the step to end, for the terminal.`);
        return 0;
      }
      // On the asking terminal's behalf, never on the daemon's (ADR-0049 D1).
      // A run the daemon recorded itself as holding is one its own sweep will
      // reclaim from under a live conversation — timone#63. A person's
      // terminal takes no place on the project, so another ticket's step
      // does not stop the claim (ADR-0063 D5).
      store.claim(resolution.run.id, body.holder, { takeover: true });
      log(`${target} is the terminal's for now.`);
      return 0;
    }
    case "release-takeover": {
      const run = store.runsForTicket(body.project, body.ticket).at(-1);
      if (run === undefined || run.status !== "active") {
        log(`${target} is not out at the terminal — nothing to take back.`);
        return 1;
      }
      // It goes back to the runner, which is woken to read what the terminal
      // session left (PRD-05 R11). Only the runner moves a run.
      // ✏ 2026-10-05 (ADR-0067 D3): `abandoned` is a terminal that stopped
      // waiting for a step after the step's end had handed it the run. No
      // session was opened, so the runner is not told that one ended.
      if (body.outcome === "abandoned") deps.runner.takeoverAbandoned(run);
      else deps.runner.terminalEnded(run);
      log(`${target} is back with the runner (${body.outcome}).`);
      return 0;
    }
    case "takeover-ended": {
      // ✏ A terminal session ended while no daemon ran (PRD-05 R11). The
      // takeover already put the run back on its wait; the runner is woken
      // now to read what the session left, as it is when a daemon takes the
      // run back itself. A run that moved on since is left alone.
      const run = store.runsForTicket(body.project, body.ticket).at(-1);
      if (run === undefined || run.status !== "parked") {
        log(`${target} is ${run?.status ?? "not in the ledger"} now — nothing to wake.`);
        return 1;
      }
      deps.runner.terminalEnded(run);
      log(`${target} is back with the runner (the terminal session ended while no daemon ran).`);
      return 0;
    }
  }
}

/** Who is holding a run, as a log line names them. */
function heldBy(run: Run): string {
  const holder = run.holder;
  if (holder === undefined) return "nobody";
  return `${holder.command} (pid ${holder.pid})`;
}

/**
 * Why the daemon is not checking for dead runs, in the terms an operator can
 * act on — and in plain words, because a person reads this line.
 *
 * **Three reasons, not one**, and saying which is which is the whole value of
 * the line. A daemon that was away for 17m is a machine that slept; one that
 * has watched unbroken for 40s of a 2m window is a machine that just started
 * and is about to be fine. Collapsing them printed "nothing was watching for
 * 0s" on two cycles a tenth of a second apart — a statement an operator knows
 * to be false, which is how a log stops being read. Found by running the built
 * binary, not by a test.
 */
function whyNotJudging(witness: Witness, staleAfterMs: number): string {
  if (witness.gapMs === undefined) {
    return (
      `this state file is new to the daemon, so every run gets ` +
      `a full ${humanMs(staleAfterMs)} to check in first`
    );
  }
  if (witness.unwitnessedGap) {
    return (
      `the daemon was not running for ${humanMs(witness.gapMs)}, ` +
      `so a run that went quiet then may still be alive`
    );
  }
  return (
    `the daemon has been up ${humanMs(witness.watchedMs)}, and it must ` +
    `watch a run for ${humanMs(staleAfterMs)} before calling it dead`
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
 * Give back to the runner every run of `project` whose heartbeat has gone
 * quiet *while a daemon was listening*, or whose holder is gone.
 *
 * **The witness comes first and can stop this outright** (ADR-0020). A
 * `setInterval` cannot fire while its process is not scheduled, so a suspended
 * laptop silences a healthy session and the daemon watching it in the same
 * breath; 15a measured 146 such suspensions in one night, 113 of them past the
 * staleness threshold. Reclaiming on that evidence would have killed a live
 * run seventeen times over. So a cycle that cannot vouch for having watched
 * the window it is judging reclaims nothing and waits for one that can.
 *
 * Idempotent across cycles for free: a run given back is parked on the
 * runner's wait and no longer running, so the next call does not find it.
 */
async function reclaimStale(
  project: TicketingProject,
  deps: PollDeps,
  result: PollResult,
  log: (message: string) => void,
  witness: Witness,
  threshold: number,
): Promise<void> {
  const { store, runner } = deps;

  for (const run of store.staleRuns(threshold)) {
    if (run.project !== project.name) continue;

    // Who is holding it decides, and the clock only decides where nobody is
    // (ADR-0049 D2, extending ADR-0025 to runs).
    //
    // `alive` ends it here however long the silence: a session that is
    // thinking says nothing for as long as it thinks, and a terminal holds a
    // takeover for as long as the conversation lasts — which is timone#63,
    // where the sweep took a run back from a live conversation after two
    // minutes and the handback could never be read.
    //
    // `gone` is proof, so it does not wait for the witness: the daemon does
    // not need to have been watching to know a pid it can ask about is not
    // there. That is what lets a killed session stop reading as working
    // (timone#11) rather than waiting out a window nobody was present for.
    //
    // `unknown` and `none` fall through to ADR-0020 exactly as before. A
    // holder on another machine cannot be asked, and a run with no holder is
    // every run written before this — so witnessed time still protects a
    // laptop that slept, which is what phase 17 verified.
    const held = store.hold(run);
    if (held === "alive") {
      log(`holding ${run.id} — ${heldBy(run)} is still running`);
      continue;
    }
    if (held !== "gone" && !witness.mayJudge) continue;

    // ✏ A stale run is never failed or re-armed here (ADR-0060 D9, PRD-05
    // R16). What to do with work a stopped daemon left half done is the
    // runner's to decide, and a failed run would need a person to start it
    // again. So it goes back on the runner's wait, and the runner is woken
    // and told why — whatever its pull request says, which the runner reads
    // for itself.
    runner.reclaimed(run);
    result.reclaimed.push(run.id);
    const why = held === "gone" ? `${heldBy(run)} is gone` : "it went silent while the daemon watched";
    log(`reclaim ${run.id} — ${why}, so it goes back to the runner`);
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
 * What this cycle knows about every initiative on a project: which tickets are
 * steps, and which steps of each may be taken up.
 */
interface Frontier {
  /**
   * Whether the steps of every initiative were read. When one listing failed,
   * a step of that initiative looks like an ordinary ticket, so no ticket can
   * be told from a step.
   */
  complete: boolean;
  isStep(ticket: number): boolean;
  isEligible(ticket: number): boolean;
  /** The tickets a step ticket is blocked by, as its listing gave them; none for any other ticket. */
  blockedBy(ticket: number): readonly Dependency[];
}

/**
 * Read every initiative's step tickets **once**, decide the frontier of each,
 * and write down what was seen.
 *
 * **One query per initiative per cycle, and it does three jobs.** It is what
 * tells a step ticket from an ordinary one, what chooses the steps to take, and
 * — as a side effect and not as a second call — what fills the cached picture
 * `timone status` renders from
 * ([ADR-0044](../../doc/adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md)
 * D5). Asking the tracker again to answer the third would put a `gh` call in
 * front of a waiting human, which is the thing that ruling refused.
 *
 * It never throws. A tracker that cannot list one initiative's children leaves
 * that initiative alone for a cycle, with a line in the errors, and says the
 * frontier is not complete. Taking the project's whole turn down over it would
 * stop the runs already open on it too.
 */
async function surveyInitiatives(
  project: TicketingProject,
  tickets: readonly Ticket[],
  deps: PollDeps,
  log: (message: string) => void,
): Promise<Frontier> {
  const { store, adapter } = deps;
  const steps = new Set<number>();
  const eligible = new Set<number>();
  const blockers = new Map<number, readonly Dependency[]>();
  let complete = true;

  for (const map of tickets.filter((t) => t.labels.includes(MAP_LABEL))) {
    let children: Step[];
    try {
      children = await adapter.listSteps(project, map.number);
    } catch (error) {
      log(
        `error  ${project.name}: could not read the steps of #${map.number} — ` +
          `${oneLine(error)}`,
      );
      complete = false;
      continue;
    }

    for (const child of children) {
      steps.add(child.number);
      blockers.set(child.number, child.blockedBy);
    }
    const toTake = eligibleSteps(children);
    for (const step of toTake) eligible.add(step.number);

    // `timone status` names one step as next, so the picture keeps the first
    // eligible one, as it did when only the first was picked up.
    const [first] = toTake;
    store.rememberInitiative({
      project: project.name,
      initiative: map.number,
      title: map.title,
      steps: children.map((child) => child.number),
      done: children.filter((child) => child.state === "closed").length,
      ...(first === undefined ? {} : { next: first.number, nextTitle: first.title }),
    });
  }

  return {
    complete,
    isStep: (ticket) => steps.has(ticket),
    isEligible: (ticket) => eligible.has(ticket),
    blockedBy: (ticket) => blockers.get(ticket) ?? [],
  };
}

/**
 * Whether a ticket that the listing showed free is held, or about to be, now
 * that it would be taken up again (40u).
 *
 * Asked only of a ticket all of whose runs have ended — the one case where
 * the registration opens a new run, and so the only case a cancel can reach.
 * A cancel of its run still being carried out counts as held: its request is
 * settled only after the hold is on. Otherwise the forge is asked for the
 * ticket as it is now. In that order, so a carry-out that ends between the two
 * questions has already put the hold on when the forge is asked.
 */
async function heldSinceListing(
  project: TicketingProject,
  ticket: number,
  deps: PollDeps,
): Promise<boolean> {
  const { store, statePath } = deps;
  if (store.liveRunForTicket(project.name, ticket) !== undefined) return false;
  if (store.runsForTicket(project.name, ticket).length === 0) return false;
  const cancelling =
    statePath !== undefined &&
    pending(statePath).requests.some(
      ({ body }) =>
        body.kind === "cancel" && body.project === project.name && body.ticket === ticket,
    );
  if (cancelling) return true;
  return (await deps.adapter.getTicket(project, ticket)).labels.includes(HELD_LABEL);
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
  const { store, adapter, runner } = deps;
  // One reader per ticket for this project's turn, so every question the
  // runner asks of a ticket's thread in this cycle is answered from one fetch
  // of it.
  const threads = threadReaders(project, adapter);

  const tickets = await adapter.listMarkedTickets(project);
  const frontier = await surveyInitiatives(project, tickets, deps, log);
  for (const ticket of tickets) {
    // No ticket is picked up on a cycle where the steps of an initiative
    // could not be read (PRD-07.R4). Its steps then look like ordinary
    // tickets, and one blocked by a step still open would be started. The
    // runs already open go on below; the next cycle that reads the steps
    // picks up what it may.
    if (!frontier.complete) break;

    // A map ticket is a conversation, not work: the runs belong to the steps
    // it points at. Without this the daemon works the initiative and its own
    // children at the same time, on the same project.
    if (ticket.labels.includes(MAP_LABEL)) continue;

    // A step that is not eligible waits: it is closed, held, taken by a
    // person, or blocked by a step still open or by a dependency list that
    // came back incomplete. Every step carries the mark — it has to, or
    // nothing could ever pick it up — so the mark alone cannot decide. Every
    // eligible step is picked up, not only the first (PRD-07.R4, ADR-0065
    // D6); how many build at once is for the places and the planner.
    if (frontier.isStep(ticket.number) && !frontier.isEligible(ticket.number)) {
      continue;
    }

    // Before the ledger is touched: this is where a ticket's *next* chunk is
    // opened, so it is where one the human has not approved is refused. See
    // {@link successorHeldBack} — it says nothing about a ticket's first
    // chunk, or one it is already working.
    const heldBack = await successorHeldBack(project.name, ticket.number, deps);
    if (heldBack !== undefined) {
      log(`hold   ${project.name}#${ticket.number} — ${heldBack}`);
      continue;
    }

    // **A held ticket is not picked up, whether or not it is a step.** For a
    // step the frontier already refuses it, because `eligibleSteps` leaves a
    // held step out; this is the same refusal for everything else, and
    // without it a ticket held by a declined pull request would simply be
    // registered afresh on the next cycle and rebuilt. Nothing here removes a
    // hold: taking it off is the human's half of the rule (ADR-0044 D7).
    if (ticket.labels.includes(HELD_LABEL)) continue;

    // ✏ And a ticket held since the listing was read (40u). A cancel the
    // watch carries out while this turn runs puts the hold on after its run
    // is cancelled, so a listing read in between shows the ticket free. A run
    // opened from it would sit on a held ticket, which nothing wakes, and hold
    // the project for every ticket behind it.
    if (await heldSinceListing(project, ticket.number, deps)) continue;

    // ✏ 2026-10-04: a ticket whose pull request from an earlier run is open
    // is taken over, not picked up as new work (ADR-0063 D4, #181). Asked
    // only when no run of the ticket is live, so once per pickup and not
    // once per cycle. Nothing is posted: the thread already has the pull
    // request. A forge that does not answer skips the ticket for this cycle:
    // picked up without the answer, it could be #181 again.
    if (store.liveRunForTicket(project.name, ticket.number) === undefined) {
      let open: { pullRequest: PullRequest; branch: string } | undefined;
      try {
        open = await adapter.findOpenPullRequestOfTicket(project, ticket.number);
      } catch (error) {
        const line =
          `${project.name}#${ticket.number}: could not ask for an open pull request ` +
          `of the ticket, so it is not picked up this cycle: ${oneLine(error)}`;
        result.errors.push(line);
        log(`error  ${line}`);
        continue;
      }
      if (open !== undefined) {
        const adopted = store.adopt(project.name, ticket.number, {
          branch: open.branch,
          pr: open.pullRequest.number,
        });
        log(`adopt  ${adopted.id} — pull request #${open.pullRequest.number} is open`);
        continue;
      }
    }

    const { run, created } = store.register(project.name, ticket.number);
    if (!created) continue;

    // The claim, and it is the whole of how a dropped step stays dropped: the
    // next cycle finds this step held and passes over it, and after a
    // `timone cancel` it goes on finding it held for ever — until a human
    // removes the label, which is how they hand the step back (ADR-0044 D7).
    // Nothing removes it here, and nothing writes an assignee: that field is
    // the human's half of the same rule and the machine only ever reads it.
    if (frontier.isStep(ticket.number)) {
      await adapter.applyLabel(project, ticket.number, HELD_LABEL);
    }

    // ✏ 2026-10-04: every pickup is a pickup (ADR-0063 D2). A ticket waits
    // for a place only once its runner tries a step, so none is queued here.
    result.pickedUp.push(run.id);
    log(`pickup ${run.id}`);
    await adapter.postComment(project, ticket.number, pickedUpComment());
  }

  // What happens next to each run is the runner's to decide (ADR-0060 D9,
  // PRD-05 R19), so nothing here decides it. The runner's tick returns once
  // it has asked for its wakes; it never waits for one, so this project's
  // work does not hold up the next (R15). ✏ 2026-10-04: nothing is promoted
  // here any more. The ledger gives a freed place in the write that frees it
  // (ADR-0063 D3).
  const cycle = { tickets, isStep: frontier.isStep, blockedBy: frontier.blockedBy, threads };
  for (const line of await runner.tick(project, config, cycle)) {
    result.errors.push(line);
    log(`error  ${line}`);
  }
  // Then the planner, with the same cycle, so it reads each thread from the
  // same fetch (ADR-0065 D1). Like the runner's, its tick returns once it
  // has started a session; it never waits for one.
  for (const line of (await deps.planner?.tick(project, config, cycle)) ?? []) {
    result.errors.push(line);
    log(`error  ${line}`);
  }

  // And after it, on the tickets nothing above could see — where this project
  // has asked for that. Nothing in this call reaches the ledger's pickup path,
  // which is what keeps R1 true.
  await introduceUnmarked(project, config, deps, result, log);
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
 * impossible. Within one ticket the sharing is the point: whatever else in
 * the cycle needs the same thread reads the one already fetched.
 *
 * ✏ 2026-09-30: the resume and the call to action are gone from the cycle.
 * The runner reads each thread through these readers now.
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
 * Close an initiative when no step of it is open, with the comment that says
 * what was built and what was dropped ({@link initiativeClosedComment}).
 *
 * ✏ 40s: taken out of {@link concludeStep} unchanged, and exported, so the
 * runner's `endRun` closes a map with this same code when its last piece's
 * run ends after a merge. Two copies of it would drift. It needs only the
 * ledger and the forge, so that is all it asks for.
 */
export async function closeInitiativeIfDone(
  deps: Pick<PollDeps, "store" | "adapter">,
  project: TicketingProject,
  initiative: number,
  log: (message: string) => void,
): Promise<void> {
  const { store, adapter } = deps;

  const steps = await adapter.listSteps(project, initiative);
  if (steps.some((step) => step.state === "open")) {
    log(
      `open   ${project.name}#${initiative} — ` +
        `${steps.filter((step) => step.state === "open").length} steps left`,
    );
    return;
  }

  // Built versus dropped, inferred from one fact and nothing else: a step
  // whose run delivered a merged pull request was built. A dropped step's run
  // was cancelled and carries none, so it needs no label and no question.
  const built: number[] = [];
  const dropped: number[] = [];
  const prs: number[] = [];
  for (const step of steps) {
    const merged = store
      .runsForTicket(project.name, step.number)
      .find((candidate) => candidate.status === "done" && candidate.pr !== undefined);
    if (merged?.pr === undefined) {
      dropped.push(step.number);
      continue;
    }
    built.push(step.number);
    prs.push(merged.pr);
  }

  await adapter.postComment(
    project,
    initiative,
    initiativeClosedComment(built, dropped, prs),
  );
  await adapter.closeTicket(project, initiative, "completed");
  log(
    `closed ${project.name}#${initiative} — ${built.length} of ${steps.length}` +
      (dropped.length === 0 ? "" : `, ${dropped.length} dropped`),
  );
}

// `checkoutOf` lived here until phase 30's 30d. It has one caller now —
// `timone status`, fvermaut's own command reading his own folder — so it
// moved there. The poll loop resolves no path under `projects/` at all any
// more (ADR-0043), and a helper for doing so left sitting in this file would
// be the obvious thing for the next reader to reach for.

/**
 * Where a ticket's whole initiative stands, as a plain value.
 *
 * **This is what lets `timone status` speak about an initiative rather than
 * about a run** ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D4). A ticket is a conversation and a run is one chunk of it (ADR-0026), so
 * between two chunks the ticket's last run is `done` while the initiative is
 * very much alive.
 *
 * It carries how far the initiative has got, plus the one fact about the
 * *artifact* a reader has to be told: that the list has grown since they
 * approved it. The two are separate facts about one initiative.
 *
 * ✏ 2026-09-30: moved here from `src/daemon/cta.ts`, which went with the
 * ticket's standing note. The functions below produce it.
 */
export interface InitiativeProgress {
  /** How many steps the initiative has. */
  total: number;
  /** How many of them are done. */
  done: number;
  /** The step to take next, or absent when none is. `index` counts from 1. */
  next?: { index: number; title: string };
  /** Whether the list of pieces has grown since the human approved it. */
  reproposed?: boolean;
}

/**
 * Where a ticket's initiative stands, for `timone status`, which renders
 * without waiting and reads fvermaut's own checkout
 * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D4) — or undefined when there is nothing to say. See
 * {@link readBreakdownSync}.
 *
 * **✏ 29g: the count comes off the tracker and the re-proposal comes off the
 * artifact, and they are two different facts from two different places.**
 *
 * - *How far it has got* is `done` step tickets out of the steps that exist,
 *   read by the daemon's own survey and cached in the ledger. Counting `done`
 *   runs against an approved list is gone with `chunkProgress`
 *   ([ADR-0040](../../doc/adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md)).
 * - *Whether the list has grown since the human approved it* is still read
 *   from the **file**, and must be: the committed artifact is the gate
 *   ([ADR-0014](../../doc/adr/0014-artifact-first-gates.md),
 *   [ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 *   D3), and no number of step tickets can tell you what a human agreed to.
 *
 * ✏ 2026-09-30: its twin that read the forge, for the cycle's standing call
 * to action, went with that call to action.
 */
export function initiativeProgressSync(
  source: SyncBreakdownSource,
  ticket: number,
  picture: InitiativeRecord | undefined,
): InitiativeProgress | undefined {
  return progressFrom(readBreakdownSync(ticket, source), picture);
}

/** The arithmetic of {@link initiativeProgressSync}, over a breakdown already read. */
function progressFrom(
  read: BreakdownRead,
  picture: InitiativeRecord | undefined,
): InitiativeProgress | undefined {
  const progress = progressOf(picture);
  const regrown = read.kind === "ok" && isReproposal(read.breakdown);

  if (!regrown) return progress;
  // No picture, and the list has regrown. `total` is the count the file lists
  // and `done` is nought — both true statements about **step tickets**, of
  // which this initiative has none yet. Neither is rendered: `timone status`
  // answers on the regrown list before it reaches them, because what the
  // human is being asked is a judgement rather than a number.
  const listed = read.kind === "ok" ? read.breakdown.chunks.length : 0;
  return { total: listed, done: 0, ...progress, reproposed: true };
}

/** {@link progressOfPicture}, tolerating a ticket no picture lists. */
export function progressOf(
  picture: InitiativeRecord | undefined,
): InitiativeProgress | undefined {
  return picture === undefined ? undefined : progressOfPicture(picture);
}

export function progressOfPicture(picture: InitiativeRecord): InitiativeProgress {
  const position =
    picture.next === undefined ? -1 : picture.steps.indexOf(picture.next);
  return position < 0 || picture.next === undefined || picture.nextTitle === undefined
    ? { total: picture.steps.length, done: picture.done }
    : {
        total: picture.steps.length,
        done: picture.done,
        next: { index: position + 1, title: picture.nextTitle },
      };
}

/**
 * What a ticket's approved list of pieces says about what happens after this
 * chunk.
 *
 * **`finished` and `unlisted` are separate arms**, and that is the
 * distinction the second reader will want to collapse. There is no next piece
 * either way, but only `finished` is a statement *about an approved list*. `unlisted` means
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
async function successionOf(
  project: string,
  ticket: number,
  deps: PollDeps,
): Promise<Succession> {
  const { store } = deps;

  const read = await readBreakdown(
    ticket,
    deps.breakdownSource ??
      fromForgeDefaultBranch(deps.adapter, {
        name: project,
        repoUrl: deps.manifest.projects[project]?.repo_url ?? "",
      }),
  );
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

  // ✏ 29g: **it is finished, and there is no counting left to do.** A ticket
  // that reaches here has a readable, approved, un-regrown breakdown. There
  // is no next chunk to open: chunks are gone, and what replaced them is a
  // ticket per step (ADR-0040).
  void store;
  return { kind: "finished" };
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
async function successorHeldBack(
  project: string,
  ticket: number,
  deps: PollDeps,
): Promise<string | undefined> {
  const { store } = deps;
  if (store.liveRunForTicket(project, ticket) !== undefined) return undefined;
  if (store.runsForTicket(project, ticket).length === 0) return undefined;

  const succession = await successionOf(project, ticket, deps);
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
