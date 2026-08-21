import { resolve } from "node:path";
import { HELD_LABEL } from "../daemon/steps.js";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath } from "../daemon/runs.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { acquireStateLock, type LockHolder } from "../daemon/lock.js";
import { enqueue, waitUntilSettled, type WaitOptions } from "../daemon/requests.js";
import { parseTarget } from "./takeover.js";

export interface CancelDeps {
  manifest: Manifest;
  store: RunStore;
  /**
   * Where the ledger lives, so a cancellation is the only thing writing it
   * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)) — the same
   * reason `timone retry` takes the lock: ending a run is a ledger mutation
   * and the daemon may be mid-cycle over the same file.
   *
   * Absent means no lock is taken, which is the shape the refusal tests use.
   */
  statePath?: string;
  /** Why, in the human's own words. */
  reason?: string;
  /**
   * How long to watch for the daemon to carry out a request, when it is the
   * daemon doing it. Injected so a test does not wait a real minute.
   */
  wait?: WaitOptions;
  log?: (message: string) => void;
}

/**
 * What a cancellation says happened when the human gave no reason of their
 * own. Their words are better and are used whenever they type any, but the
 * ledger must never record an empty why: `timone status` prints this back, and
 * "cancelled: " with nothing after it is a sentence that explains nothing.
 */
const ASKED_TO_STOP = "you asked me to stop";

/**
 * Abandon a ticket's current chunk — the supported way to end work that should
 * not carry on, and the end of hand-editing `.timone/state.json` to do it.
 *
 * **Cancelling is not failing.** A cancelled chunk is finished business: it is
 * settled, so the ticket may take a fresh chunk, and it has no way back —
 * `timone retry` refuses it in as many words. Everything that cannot be
 * cancelled is refused with a sentence about what the ticket *is* doing, in
 * the same discipline as `timone retry` and `timone takeover`.
 */
export async function runCancel(raw: string, deps: CancelDeps): Promise<number> {
  const log = deps.log ?? ((message: string) => console.log(message));
  if (deps.statePath === undefined) return cancel(raw, deps, log);

  const acquired = acquireStateLock({
    statePath: deps.statePath,
    command: `timone cancel ${raw}`,
    staleAfterMs: 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000,
    // Reclaimed on the same evidence a daemon reclaims on — the holder's
    // process being gone (ADR-0025). A run worth cancelling is often one held
    // by a daemon that has already died, so the corpse must not be what
    // refuses the command that clears up after it.
  });
  if (!acquired.ok) {
    // Named holder means a *live* daemon — a dead one's lock was broken above.
    // That is the case worth asking about; every other refusal is unchanged.
    const { holder } = acquired.error;
    if (holder === undefined) {
      log(acquired.error.message);
      return 1;
    }
    return askForCancel(raw, deps, holder, log);
  }

  try {
    return cancel(raw, deps, log);
  } finally {
    acquired.lock.release();
  }
}

/**
 * Ask the daemon to abandon this chunk, and report what happened rather than
 * that it was asked
 * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
 *
 * This is the command [ADR-0031](../../doc/adr/0031-a-handoff-is-a-wait-not-a-failure.md)
 * leans on: a handoff nobody wants to answer holds its project, and this is
 * the way out of it. It was unrunnable against a live daemon until now.
 */
async function askForCancel(
  raw: string,
  deps: CancelDeps,
  holder: LockHolder,
  log: (message: string) => void,
): Promise<number> {
  const { manifest, store, statePath } = deps;
  if (statePath === undefined) return 1;

  let target: { project: string; ticket: number };
  try {
    target = parseTarget(raw);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (!(target.project in manifest.projects)) {
    const known = Object.keys(manifest.projects).join(", ") || "none";
    log(`I don't know a project called "${target.project}". I look after: ${known}.`);
    return 1;
  }

  const name = `${target.project} #${target.ticket}`;
  const path = enqueue(statePath, {
    kind: "cancel",
    project: target.project,
    ticket: target.ticket,
    ...(deps.reason === undefined ? {} : { reason: deps.reason }),
  });
  log(
    `${holder.command} (pid ${holder.pid}) has the ledger, so I've asked it to ` +
      `stop work on ${name} on its next pass. Watching for that.`,
  );

  if (!(await waitUntilSettled(path, deps.wait))) {
    log(
      `${name} is still queued — the daemon hasn't taken it yet. It will on its ` +
        "next pass; run `timone status` to see where things stand.",
    );
    return 1;
  }

  const run = store.runsForTicket(target.project, target.ticket).at(-1);
  if (run?.status !== "cancelled") {
    log(
      `The daemon read the request and did not stop ${name} — it is ` +
        `${run?.status ?? "unknown"}. Its log says why.`,
    );
    return 1;
  }
  log(
    `Stopped work on ${name}: ${run.cancellation ?? ASKED_TO_STOP}. I won't pick ` +
      "this chunk up again.",
  );
  return 0;
}

/** The cancellation itself, once this process is the ledger's only writer. */
function cancel(
  raw: string,
  deps: CancelDeps,
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

  // The ticket's most recent chunk, which is its live one wherever one lives
  // (ADR-0026). A person cancels a *ticket*; which chunk of it that is comes
  // from the ledger, never from them.
  const run = store.runsForTicket(target.project, target.ticket).at(-1);
  const name = `${target.project} #${target.ticket}`;
  if (run === undefined) {
    log(`I'm not working on ${name}, so there is nothing to cancel.`);
    return 1;
  }

  switch (run.status) {
    case "done":
      log(`${name} is finished — there is nothing left to cancel.`);
      return 1;
    case "cancelled":
      log(
        `${name} was already cancelled: ${run.cancellation ?? "no reason recorded"}.`,
      );
      return 1;
    // A failure is cancellable, and this is the arm that used to refuse it.
    // Ruled by fvermaut 2026-08-15: a failure has two exits, not one. `timone
    // retry` re-arms the chunk and this abandons it, and the refusal that
    // stood here made abandoning a failure a two-command dance — retry first,
    // to get it out of `failed`, then cancel — with a window in between that
    // the daemon polls, so a run somebody was trying to delete could be picked
    // up and spend real money before the second command landed. Nothing about
    // a failure is worth protecting from a person who has typed `cancel`: the
    // branch, stage and pull request the old wording defended are still there
    // in the ledger, and a ticket that deserves another go takes a fresh chunk.
    case "failed":
    case "queued":
    case "picked-up":
    case "active":
    case "parked":
      break;
  }

  const reason =
    deps.reason === undefined || deps.reason.trim() === ""
      ? ASKED_TO_STOP
      : deps.reason.trim();

  try {
    store.cancel(run.id, reason);
    log(
      `Stopped work on ${name}: ${reason}. I won't pick this up again by ` +
        `myself — remove the \`${HELD_LABEL}\` label from the ticket and I'll ` +
        "start it afresh, or close it and I'll carry on without it.",
    );
    return 0;
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/** Register the `cancel` command on the program. */
export function registerCancelCommand(program: Command): void {
  program
    .command("cancel")
    .argument("<ticket>", "which ticket to stop working, as <project>#<ticket>")
    .description("Stop the work in progress on a ticket, for good")
    .option("--reason <text>", "why, in words the ticket's reader will see")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .option("--state <path>", "path to the daemon state file")
    .action(
      async (
        ticket: string,
        options: { manifest: string; state?: string; reason?: string },
      ) => {
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

        process.exitCode = await runCancel(ticket, {
          manifest,
          store,
          statePath,
          reason: options.reason,
        });
      },
    );
}
