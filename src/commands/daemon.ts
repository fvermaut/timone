import { resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { GitHubTicketingAdapter } from "../adapters/github-tickets.js";
import {
  credentialCommandRunner,
  type CommandRunner,
} from "../adapters/command-runner.js";
import {
  githubAppCredentials,
  type MintCall,
} from "../adapters/credentials.js";
import { DockerPreviewAdapter } from "../adapters/docker-preview.js";
import type { PreviewAdapter } from "../adapters/preview.js";
import type { TicketingAdapter } from "../adapters/ticketing.js";
import { RunStore, defaultStatePath } from "../daemon/runs.js";
import {
  releaseHeldLocks,
  withStateLock,
  type StateLock,
} from "../daemon/lock.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  pollOnce,
  type SessionSpawner,
} from "../daemon/poll.js";
import { DEFAULT_PROGRESS_INTERVAL_SECONDS } from "../daemon/progress.js";
import { AgentSessionSpawner, agentSdkRuntime } from "../daemon/session.js";

export interface MachineAdapterOptions {
  /** Injected process spawner; the real one when absent. */
  run?: CommandRunner;
  /** Injected mint call; the real endpoint when absent. */
  mint?: MintCall;
}

/**
 * The ticketing adapter the **daemon** uses: every call it makes runs as
 * Timone, under a credential minted for the one repository that call names
 * ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)).
 *
 * **This is where "fails loudly at spawn time, never falls back to ambient
 * login" is enforced.** A manifest with no `identity` block does not yield a
 * degraded adapter that borrows whoever is logged in — it yields nothing, and
 * the daemon does not start. The manifest schema leaves the block optional on
 * purpose: `workspace sync` and `projects list` are fvermaut's own commands,
 * run from his terminal under his own login, and they are entitled to it. The
 * daemon is not.
 *
 * `root` is the timone root the key path is resolved against, so a daemon
 * started from anywhere reads the same key.
 */
export function machineAdapter(
  manifest: Manifest,
  root: string,
  options: MachineAdapterOptions = {},
): GitHubTicketingAdapter {
  const identity = manifest.identity;
  if (identity === undefined) {
    throw new Error(
      "The manifest declares no `identity`, so the daemon has no forge " +
        "credential of its own. It never runs under an ambient `gh` login " +
        "(ADR-0042). Add an `identity` block naming the Timone App's " +
        "`app_id`, `installation_id`, `private_key_path` and `login`.",
    );
  }

  const credentials = githubAppCredentials({
    appId: identity.app_id,
    installationId: identity.installation_id,
    privateKeyPath: resolve(root, identity.private_key_path),
    ...(options.mint === undefined ? {} : { mint: options.mint }),
  });

  return new GitHubTicketingAdapter({
    run: credentialCommandRunner({
      credentials,
      ...(options.run === undefined ? {} : { run: options.run }),
    }),
    machineLogin: identity.login,
  });
}

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
  /**
   * Where the ledger lives, so this daemon can be the only thing writing it
   * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)): the lock sits
   * beside the state file and is held for as long as the loop runs.
   *
   * Absent means no lock is taken, which is what the tests of the cycle's own
   * arithmetic do — the lock is on the process, not on the poll cycle, and
   * `pollOnce` is reachable without one exactly as it always was.
   */
  statePath?: string;
  /**
   * The timone root, so the cycle can reach a project's checkout at
   * `projects/<name>/` — which is where a ticket's breakdown lives and
   * therefore how the loop knows whether a merged pull request ended a piece
   * of an initiative or the whole of it ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
   * D1).
   *
   * **Required, unlike the cycle's own `root`.** This is the only place a real
   * daemon's root is known, and the cost of forgetting it is silent: every
   * multi-piece initiative truncated at its first merge, with the ticket
   * closed and nothing anywhere saying a piece was skipped. So the compiler
   * asks rather than a default answering.
   */
  root: string;
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
  if (options.statePath === undefined) return poll(options, log);

  const staleAfterMs =
    options.staleAfterMs ?? 4 * DEFAULT_PROGRESS_INTERVAL_SECONDS * 1000;
  const held = await withStateLock(
    {
      statePath: options.statePath,
      command: "timone daemon",
      staleAfterMs,
      // Nothing else: the holder's process is the evidence, and the default
      // probe asks the OS for it (ADR-0025). Acquisition reads the lock file
      // and, at most, writes the lock file — the ledger it protects is not
      // touched on any path through it, refusals included.
    },
    async (lock) => {
      if (lock.reclaimed !== undefined) {
        log(
          `took the ledger back from ${lock.reclaimed.command} ` +
            `(pid ${lock.reclaimed.pid}), silent since ${lock.reclaimed.observedAt}`,
        );
      }
      return poll(options, log, lock);
    },
  );

  if (held.ok) return held.value;
  log(held.error.message);
  return 1;
}

/**
 * Poll until stopped, holding the lock throughout when there is one.
 *
 * The cycle itself is untouched by the lock: what holds it is the process,
 * and `pollOnce` takes nothing — which is what keeps every test that drives a
 * cycle directly working exactly as it did.
 */
async function poll(
  options: RunDaemonOptions,
  log: (message: string) => void,
  lock?: StateLock,
): Promise<number> {
  let failures = 0;

  for (;;) {
    const result = await pollOnce({
      manifest: options.manifest,
      store: options.store,
      adapter: options.adapter,
      spawner: options.spawner,
      root: options.root,
      // The same path the lock was taken on, so the cycle serves the requests
      // waiting beside the ledger it is holding (ADR-0032).
      statePath: options.statePath,
      staleAfterMs: options.staleAfterMs,
      // The cadence this loop actually keeps, so the unwitnessed-gap threshold
      // is derived from it rather than assumed (ADR-0020). A daemon told to
      // poll every five minutes must not read a four-minute gap as an absence.
      pollIntervalMs: options.intervalMs,
      previews: options.previews,
      log,
    });
    failures = result.errors.length;
    // Still here, once per cycle. This is what keeps a long-lived daemon out
    // of the reclaim path's *first filter* — it is no longer what keeps its
    // lock safe, since a quiet holder whose process is alive is refused
    // anyway (ADR-0025). A cheap tick that saves a probe, not a defence.
    lock?.touch();

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

      let adapter: GitHubTicketingAdapter;
      try {
        adapter = machineAdapter(manifest, process.cwd());
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
        return;
      }

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

      // Ctrl-C is how every operator stops the daemon, and a lock left behind
      // by that is a project wedged until the reclaim path's window passes.
      // `withStateLock`'s `finally` never runs on a signal, so the exit path
      // has to say it itself.
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
          releaseHeldLocks();
          process.exit(signal === "SIGINT" ? 130 : 143);
        });
      }

      process.exitCode = await runDaemon({
        manifest,
        store,
        statePath,
        // The same root the spawner is given, from the same place: sessions
        // run here (ADR-0007) and the checkouts sit under it.
        root: process.cwd(),
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
