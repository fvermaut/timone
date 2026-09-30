import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { RunStore, defaultStatePath } from "../daemon/runs.js";
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
 *
 * ✏ 2026-09-30: **refused on every project**, with the sentence that sends
 * the person to the ticket. The runner drives every project, and `retry` is
 * removed for the projects it drives
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
 * D6, which amends ADR-0032; PRD-05 R11). Nothing is written and nothing is
 * asked of a daemon, whichever path the command takes.
 */
export async function runRetry(raw: string, deps: RetryDeps): Promise<number> {
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
    // A refusal that names a holder is a *live* daemon: the reclaim above
    // would have broken the lock of a dead one. It is asked for nothing: the
    // daemon would refuse the retry the same way, and a request it can only
    // refuse would cost the person a wait for nothing.
    if (acquired.error.holder === undefined) {
      log(acquired.error.message);
      return 1;
    }
    return retry(raw, deps, log);
  }

  try {
    return retry(raw, deps, log);
  } finally {
    acquired.lock.release();
  }
}

/**
 * What `retry` says on a project the runner drives, where it is removed
 * ([ADR-0060](../../doc/adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)
 * D6, which amends ADR-0032; PRD-05 R11). The runner reads the ticket every
 * time it wakes, so writing there is how to ask it for anything.
 */
export const RUNNER_RETRY_REFUSAL =
  "This project is run by the runner. Write on the ticket instead: say what you want done.";

/**
 * The retry itself: a target it can read, on a project it knows, is refused
 * with {@link RUNNER_RETRY_REFUSAL}. Asked before the store is touched, so no
 * run is ever re-armed or rewound — whatever state it is in.
 */
function retry(
  raw: string,
  deps: RetryDeps,
  log: (message: string) => void,
): number {
  const { manifest } = deps;

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

  log(RUNNER_RETRY_REFUSAL);
  return 1;
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
    .action(async (ticket: string, options: { manifest: string; state?: string }) => {
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

      process.exitCode = await runRetry(ticket, { manifest, store, statePath });
    });
}
