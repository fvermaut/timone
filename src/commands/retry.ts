import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, type Run } from "../daemon/runs.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { acquireStateLock } from "../daemon/lock.js";
import { waitOf } from "../daemon/session.js";
import { parseTarget } from "./takeover.js";

export interface RetryDeps {
  manifest: Manifest;
  store: RunStore;
  /**
   * Where the ledger lives, so a retry is the only thing writing it
   * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)): re-arming a
   * run is a ledger mutation, and the daemon may be mid-cycle over the same
   * file.
   *
   * Absent means no lock is taken, which is what the refusal tests do — they
   * never reach a write.
   */
  statePath?: string;
  log?: (message: string) => void;
}

/**
 * Re-arm a failed run at the stage it failed — the supported way back into
 * the pipeline that 12g had to fake three times by hand-editing the ledger.
 * Everything that is not a failed run is refused with a sentence about what
 * the ticket *is* doing, in the same discipline as `timone takeover`.
 */
export function runRetry(raw: string, deps: RetryDeps): number {
  const log = deps.log ?? ((message: string) => console.log(message));
  if (deps.statePath === undefined) return retry(raw, deps, log);

  const acquired = acquireStateLock({
    statePath: deps.statePath,
    command: `timone retry ${raw}`,
    staleAfterMs: 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000,
    // A retry reclaims on the same evidence a daemon does — the holder's
    // process being gone (ADR-0025). `retry` is the route back from a session
    // that died holding the ledger, so it above all must not be refused by
    // the corpse of the daemon that died holding it.
  });
  if (!acquired.ok) {
    log(acquired.error.message);
    return 1;
  }

  try {
    return retry(raw, deps, log);
  } finally {
    acquired.lock.release();
  }
}

/** The retry itself, once this process is the ledger's only writer. */
function retry(
  raw: string,
  deps: RetryDeps,
  log: (message: string) => void,
): number {
  const { manifest, store } = deps;

  let target: { project: string; ticket: number };
  try {
    target = parseTarget(raw);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (!(target.project in manifest.projects)) {
    const known = Object.keys(manifest.projects).join(", ") || "none";
    log(
      `I don't know a project called "${target.project}". I look after: ${known}.`,
    );
    return 1;
  }

  const run = store.runsForTicket(target.project, target.ticket).at(-1);
  const name = `${target.project} #${target.ticket}`;
  if (run === undefined) {
    log(
      `I'm not working on ${name} and there is nothing to retry. ` +
        "Add the `timone` label to that ticket and I'll pick it up.",
    );
    return 1;
  }

  switch (run.status) {
    case "queued":
      log(`${name} hasn't started — it's in the queue, and needs no retry.`);
      return 1;
    case "picked-up":
    case "active":
      log(`${name} is being worked on right now. There is nothing to retry.`);
      return 1;
    case "parked":
      return rewind(run, name, store, log);
    case "done":
      log(`${name} is finished. Retry can't reopen it — file a new ticket instead.`);
      return 1;
    case "failed":
      break;
  }

  try {
    const rearmed = store.retry(run.id);
    const readAgain = reopenConsumed(rearmed, store);
    log(
      readAgain
        ? `${name} is re-armed, and I've wound it back to before the answer you ` +
            "wrote on the ticket, so I read that answer again instead of asking " +
            "you the same question twice. The watcher picks it up on its next " +
            "cycle — start `timone daemon` if it isn't running."
        : `${name} is re-armed at the point it stopped (${rearmed.stage ?? "the start"}). ` +
            "The watcher picks it up on its next cycle — start `timone daemon` if it isn't running.",
    );
    return 0;
  } catch (error) {
    // The store's guard fired: the project has moved on to another run, and
    // re-arming this one would put two sets of work on one repository.
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Put a conversation's marker back to before the last answer read from it
 * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)), so the watcher
 * reads that answer again.
 *
 * This is the other half of consuming an answer. Reading one moves the marker
 * past it, which leaves a window where the answer is read and nothing is
 * acting on it — the deliberate trade of a silent double-answer for a visible
 * stall. A stall a human can see and cannot leave is not a route back, so
 * `retry` is the one, and it needs nothing of them but the ticket's name.
 *
 * **A millisecond is the whole rewind, and it is exact where it matters.** The
 * marker sits *at* the instant of the last comment the answer was read from,
 * and a comment counts as unread only when it is strictly later than the
 * marker — so stepping back by the smallest instant the timestamp can express
 * makes that comment readable again and nothing else. An answer written as
 * several comments in one poll interval is rewound to its last one; the ledger
 * keeps one instant per wait, and inventing a wider rewind would re-read
 * comments that were never part of it.
 *
 * Only a conversation is rewound. A gate's answer is not consumed — it clears
 * its wait by moving the run to another stage — so for every other wait this
 * stays what it was: a refusal that says what the ticket is doing.
 */
function rewind(
  run: Run,
  name: string,
  store: RunStore,
  log: (message: string) => void,
): number {
  // The marker first, the cursor as a fallback. They name the same instant on a
  // park this build consumed; the fallback is for a park consumed by a daemon
  // that predates the marker, which has only its cursor to go back from.
  const at = instantOf(run.consumedAnswerAt) ?? instantOf(run.waitCursor);
  if (run.waitingKind !== "conversation" || at === undefined) {
    log(
      `${name} didn't fail — it's waiting on you: ${run.waitingOn ?? "an answer"}. ` +
        "Answer that and it carries on by itself.",
    );
    return 1;
  }

  // `waitOf` carries no marker, so using one spends it: the rewound park is a
  // park with an answer outstanding again, not one still holding a read receipt.
  store.repark(run.id, { ...waitOf(run), waitCursor: justBefore(at) });
  log(
    `${name} is waiting on a conversation, and I've wound it back to before the ` +
      "last answer written on the ticket, so I read that answer again instead of " +
      "leaving it sitting there. The watcher picks it up on its next cycle — start " +
      "`timone daemon` if it isn't running.",
  );
  return 0;
}

/**
 * Put a re-armed run back on the conversation it was resumed from, when it
 * died holding an answer it had already read
 * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)). Returns whether
 * it did.
 *
 * This is {@link rewind} for the state the live gate found on 2026-08-13, and
 * the reason that gate failed: a session killed after its run was activated
 * leaves the run `failed` with no wait at all — no cursor, no kind, nothing to
 * wind back. Re-arming it alone hands it to the *entry* path, which asks the
 * question again from scratch, and the answer they wrote is never read. What
 * survives is the marker, so the wait is rebuilt around it: the same
 * conversation, wound back to just before the answer, which the next cycle then
 * reads exactly as it would have.
 *
 * **The marker is the whole warrant.** It is present only while an answer has
 * been read and not acted on ({@link Run.consumedAnswerAt}), so a run that
 * failed at some later stage carries none and is re-armed as it always was.
 * Nothing here asks the human anything, and nothing re-reads the thread to
 * guess which comment was last read — guessing is what produced the fault.
 */
function reopenConsumed(run: Run, store: RunStore): boolean {
  const at = instantOf(run.consumedAnswerAt);
  if (at === undefined || run.stage === undefined) return false;

  store.park(run.id, {
    // Its own words rather than the channel's: what this run is waiting for is
    // one cycle of the watcher, and the wait the session cleared is gone.
    waitingOn: "the answer you wrote on the ticket, which I'll read again",
    kind: "conversation",
    waitCursor: justBefore(at),
  });
  return true;
}

/** An instant as milliseconds, or undefined when there is nothing to read. */
function instantOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : at;
}

/**
 * The instant just before `at` — the whole of a rewind, and exact where it
 * matters: a comment is unread only when it is strictly later than the cursor,
 * so the smallest step the timestamp can express makes that one comment
 * readable again and nothing else.
 */
function justBefore(at: number): string {
  return new Date(at - 1).toISOString();
}

/** Register the `retry` command on the program. */
export function registerRetryCommand(program: Command): void {
  program
    .command("retry")
    .argument("<ticket>", "which ticket to retry, as <project>#<ticket>")
    .description("Re-arm a failed run at the stage where it stopped")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .option("--state <path>", "path to the daemon state file")
    .action((ticket: string, options: { manifest: string; state?: string }) => {
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

      process.exitCode = runRetry(ticket, { manifest, store, statePath });
    });
}
