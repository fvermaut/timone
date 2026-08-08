import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import { DockerPreviewAdapter } from "../adapters/docker-preview.js";
import type { PreviewAdapter } from "../adapters/preview.js";
import type { TicketingAdapter } from "../adapters/ticketing.js";
import { RunStore, defaultStatePath } from "../daemon/runs.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  pollOnce,
  type SessionSpawner,
} from "../daemon/poll.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { AgentSessionSpawner, agentSdkRuntime } from "../daemon/session.js";

/** Options accepted by `timone daemon`, as commander parses them. */
interface DaemonOptions {
  manifest: string;
  interval: string;
  progressInterval: string;
  once?: boolean;
  state?: string;
}

export interface RunDaemonOptions {
  manifest: Manifest;
  store: RunStore;
  intervalMs: number;
  /** How long a run may go silent before it is treated as orphaned. */
  staleAfterMs?: number;
  once: boolean;
  adapter: TicketingAdapter;
  spawner: SessionSpawner;
  /** How previews are served. Absent means no project gets one. */
  previews?: PreviewAdapter;
  log?: (message: string) => void;
}

/**
 * Poll until stopped. `--once` runs a single cycle, which is the mode every
 * test and every live proof uses: each transition stays inspectable between
 * cycles instead of racing a timer.
 */
export async function runDaemon(options: RunDaemonOptions): Promise<number> {
  const log = options.log ?? ((message: string) => console.log(message));
  let failures = 0;

  for (;;) {
    const result = await pollOnce({
      manifest: options.manifest,
      store: options.store,
      adapter: options.adapter,
      spawner: options.spawner,
      staleAfterMs: options.staleAfterMs,
      // The cadence this loop actually keeps, so the unwitnessed-gap threshold
      // is derived from it rather than assumed (ADR-0020). A daemon told to
      // poll every five minutes must not read a four-minute gap as an absence.
      pollIntervalMs: options.intervalMs,
      previews: options.previews,
      log,
    });
    failures = result.errors.length;

    if (options.once) break;
    await new Promise((done) => setTimeout(done, options.intervalMs));
  }

  return failures > 0 ? 1 : 0;
}

/** Register the `daemon` command on the program. */
export function registerDaemonCommand(program: Command): void {
  program
    .command("daemon")
    .description("Watch the managed projects' tickets and run what is marked")
    .option(
      "--manifest <path>",
      "path to the timone manifest file",
      "timone.yaml",
    )
    .option(
      "--interval <seconds>",
      "seconds between poll cycles — and, twice one of them without a cycle, " +
        "how long a gap the daemon treats as time it did not witness",
      String(DEFAULT_POLL_INTERVAL_SECONDS),
    )
    .option(
      "--progress-interval <seconds>",
      "seconds between progress lines — and, four of them without one, " +
        "when a run is treated as orphaned by a stopped daemon",
      String(DEFAULT_PROGRESS_INTERVAL_SECONDS),
    )
    .option("--once", "run a single poll cycle and exit")
    .option("--state <path>", "path to the daemon state file")
    .action(async (options: DaemonOptions) => {
      let manifest: Manifest;
      try {
        manifest = loadManifest(options.manifest);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }

      const interval = Number(options.interval);
      if (!Number.isFinite(interval) || interval <= 0) {
        console.error(`--interval must be a positive number of seconds`);
        process.exitCode = 1;
        return;
      }

      const progressInterval = Number(options.progressInterval);
      if (!Number.isFinite(progressInterval) || progressInterval <= 0) {
        console.error(`--progress-interval must be a positive number of seconds`);
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

      const adapter = new GitHubTicketingAdapter();
      const log = (message: string): void => console.log(message);
      // No guardrail bracket here any more (ADR-0018): the checks live in
      // `.claude/settings.json`'s SessionStart/Stop hooks, which every session
      // at the timone root passes through — including the ones a human starts.
      const spawner = new AgentSessionSpawner({
        manifest,
        store,
        adapter,
        runtime: agentSdkRuntime,
        root: process.cwd(),
        progressIntervalMs: progressInterval * 1000,
        log,
      });

      process.exitCode = await runDaemon({
        manifest,
        store,
        // One adapter for every bound project: which projects get previews is
        // the manifest's answer, not this command's (ADR-0021).
        previews: new DockerPreviewAdapter({ root: process.cwd() }),
        intervalMs: interval * 1000,
        // ADR-0020, keeping ADR-0017's mechanism: the tick that prints is the
        // tick that proves the run alive, so this one flag sets both cadences.
        // Four intervals gives a healthy session four chances to have said
        // something — and silence across them is only evidence of death if the
        // daemon was present throughout, which `--interval` above decides.
        staleAfterMs: 4 * progressInterval * 1000,
        once: options.once === true,
        adapter,
        spawner,
      });
    });
}
