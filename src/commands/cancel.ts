import { resolve } from "node:path";
import { heldStepWayOut } from "../daemon/dropped.js";
import { HELD_LABEL, HELD_LABEL_DESCRIPTION } from "../daemon/steps.js";
import type { Command } from "commander";

import { MARK_LABEL, type TicketingAdapter } from "../adapters/ticketing.js";
import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
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
   * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)): ending a run
   * is a ledger mutation and the daemon may be mid-cycle over the same file.
   *
   * Absent means no lock is taken, which is the shape the refusal tests use.
   */
  statePath?: string;
  /** Why, in the human's own words. */
  reason?: string;
  /**
   * The forge, to put the hold on a ticket once its run is cancelled here
   * (40u; see {@link holdCancelledTicket}).
   *
   * Absent in the daemon's own call, which holds the ticket itself once the
   * cancelled run's work is stopped: the forge can take a minute to answer,
   * and a cancel must never wait on it to stop a session.
   */
  adapter?: TicketingAdapter;
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
 * Put the hold on a ticket whose run was just cancelled (40u), and say what
 * that means for the ticket.
 *
 * **The dropped-step rule, applied to every ticket** (ADR-0044 D7). A
 * cancelled run is settled, so a ticket still open and marked for the machine
 * is taken up again as a new run on the next pass — within seconds, on the
 * verification of phase 40, with the command then reporting a failure. The
 * hold is what the registration passes over, and only a person takes it off.
 *
 * Nothing is done for a step ticket, which carries the hold since its pickup
 * and whose way back {@link heldStepWayOut} has already told.
 *
 * ✏ 2026-09-30: until the runner drove every project, a project the old
 * daemon drove got no hold, and its cancelled ticket started afresh.
 *
 * **Never throws.** The run is cancelled whatever the forge answers, so a
 * forge that fails is said, with what the person can do instead.
 */
export async function holdCancelledTicket(
  deps: { manifest: Manifest; store: RunStore; adapter: TicketingAdapter },
  target: { project: string; ticket: number },
  log: (message: string) => void,
): Promise<void> {
  const config = deps.manifest.projects[target.project];
  if (config === undefined) return;
  if (heldStepWayOut(deps.store, target.project, target.ticket) !== undefined) return;
  const project = { name: target.project, repoUrl: config.repo_url };
  try {
    await deps.adapter.ensureLabel(project, HELD_LABEL, HELD_LABEL_DESCRIPTION);
    await deps.adapter.applyLabel(project, target.ticket, HELD_LABEL);
    log(
      `The ticket now carries the \`${HELD_LABEL}\` label, so I won't start it ` +
        "again. Take the label off to hand it back, or close the ticket.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const why = message.split("\n")[0] ?? message;
    log(
      `I could not put the \`${HELD_LABEL}\` label on the ticket: ${why}. While ` +
        "it stays open and marked for me, I'll start it afresh on my next pass. " +
        `Close it, or take the \`${MARK_LABEL}\` label off it, to stop that.`,
    );
  }
}

/**
 * Abandon a ticket's current chunk — the supported way to end work that should
 * not carry on, and the end of hand-editing `.timone/state.json` to do it.
 *
 * **Cancelling is not failing.** A cancelled chunk is finished business: it is
 * settled, so the ticket may take a fresh chunk, and it has no way back.
 * Everything that cannot be cancelled is refused with a sentence about what
 * the ticket *is* doing, in the same discipline as `timone takeover`.
 */
export async function runCancel(raw: string, deps: CancelDeps): Promise<number> {
  const log = deps.log ?? ((message: string) => console.log(message));
  if (deps.statePath === undefined) return await cancel(raw, deps, log);

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
    return await cancel(raw, deps, log);
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
 *
 * **The daemon reads this one while it works**
 * ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)), and
 * stops the session the run is in. Until then a cancellation was read at the
 * top of a cycle that does not come round while a run is in flight — so the
 * one command whose purpose is to interrupt work in progress was the one that
 * could not, and the words below promised a pass that was not coming
 * ([#69](https://github.com/fvermaut/timone/issues/69)).
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
  // The run the daemon will cancel: the ticket's latest, as it stands now.
  // Read before asking, because the answer is judged by this run and by no
  // other (40u). A ticket still open and marked for the machine is taken up
  // again as a new run within seconds of its cancellation, and reading
  // "the ticket's latest run" afterwards found that new one and said the
  // cancel had failed.
  const asked = store.runsForTicket(target.project, target.ticket).at(-1);
  const path = enqueue(statePath, {
    kind: "cancel",
    project: target.project,
    ticket: target.ticket,
    ...(deps.reason === undefined ? {} : { reason: deps.reason }),
  });
  log(
    `${holder.command} (pid ${holder.pid}) has the ledger, so I've asked it to ` +
      `stop work on ${name}. It reads that within a few seconds, even while ` +
      "it is running something. Watching for that.",
  );

  if (!(await waitUntilSettled(path, deps.wait))) {
    log(
      `${name} is still queued — the daemon has not taken it. It reads a ` +
        "cancellation within a few seconds whatever it is doing, so check " +
        "that it is still running; `timone status` says where things stand.",
    );
    return 1;
  }

  const run = store
    .runsForTicket(target.project, target.ticket)
    .find((candidate) => candidate.id === asked?.id);
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
async function cancel(
  raw: string,
  deps: CancelDeps,
  log: (message: string) => void,
): Promise<number> {
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
    // Ruled by fvermaut 2026-08-15: a failure had two exits, not one. `timone
    // retry` re-armed the chunk, until it was removed on 2026-09-30, and this
    // abandons it. The refusal that stood here made abandoning a failure a
    // two-command dance — retry first, to get it out of `failed`, then
    // cancel — with a window in between that the daemon polls, so a run
    // somebody was trying to delete could be picked up and spend real money
    // before the second command landed. Nothing about
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
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const stepWayOut = heldStepWayOut(store, run.project, run.ticket);
  if (stepWayOut !== undefined) {
    log(`Stopped work on ${name}: ${reason}. I won't pick this up again — ${stepWayOut}`);
    return 0;
  }
  // ✏ The ticket is held once its run is cancelled (40u), so "I'll start it
  // afresh" is not said of it: what happens to the ticket is said by
  // {@link holdCancelledTicket}, here when this command has the forge and in
  // the daemon once the work is stopped.
  log(`Stopped work on ${name}: ${reason}. I won't pick this up again.`);
  if (deps.adapter !== undefined) {
    await holdCancelledTicket(
      { manifest, store, adapter: deps.adapter },
      { project: run.project, ticket: run.ticket },
      log,
    );
  }
  return 0;
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
          // Used only when no daemon runs: the hold then goes on under the
          // person's own login, as `timone takeover` reads the ticket under
          // it.
          adapter: new GitHubTicketingAdapter(),
        });
      },
    );
}
