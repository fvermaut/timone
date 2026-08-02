import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import type { TicketingAdapter } from "../adapters/ticketing.js";
import { RunStore, defaultStatePath } from "../daemon/runs.js";
import { pollOnce, type SessionSpawner } from "../daemon/poll.js";
import { AgentSessionSpawner, agentSdkRuntime } from "../daemon/session.js";

/** Options accepted by `timone daemon`, as commander parses them. */
interface DaemonOptions {
  manifest: string;
  interval: string;
  once?: boolean;
  state?: string;
}

export interface RunDaemonOptions {
  manifest: Manifest;
  store: RunStore;
  intervalMs: number;
  once: boolean;
  adapter: TicketingAdapter;
  spawner: SessionSpawner;
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
    .option("--interval <seconds>", "seconds between poll cycles", "60")
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
      const spawner = new AgentSessionSpawner({
        manifest,
        store,
        adapter,
        runtime: agentSdkRuntime,
        root: process.cwd(),
        log: (message) => console.log(message),
      });

      process.exitCode = await runDaemon({
        manifest,
        store,
        intervalMs: interval * 1000,
        once: options.once === true,
        adapter,
        spawner,
      });
    });
}
