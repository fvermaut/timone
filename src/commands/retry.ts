import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath, runId } from "../daemon/runs.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { acquireStateLock } from "../daemon/lock.js";
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

  const run = store.get(runId(target.project, target.ticket));
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
      log(
        `${name} didn't fail — it's waiting on you: ${run.waitingOn ?? "an answer"}. ` +
          "Answer that and it carries on by itself.",
      );
      return 1;
    case "done":
      log(`${name} is finished. Retry can't reopen it — file a new ticket instead.`);
      return 1;
    case "failed":
      break;
  }

  try {
    const rearmed = store.retry(run.id);
    log(
      `${name} is re-armed at the point it stopped (${rearmed.stage ?? "the start"}). ` +
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
