import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";

import { loadManifest, type Manifest } from "../manifest.js";
import { isCommitOnRemote } from "../git.js";
import {
  GitHubTicketingAdapter,
  repoSlug,
} from "../adapters/github-tickets.js";
import {
  credentialCommandRunner,
  type CommandRunner,
} from "../adapters/command-runner.js";
import {
  githubAppCredentials,
  type CredentialProvider,
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
import {
  AgentSessionSpawner,
  agentSdkRuntime,
  type SessionRuntime,
} from "../daemon/session.js";
import { containerRuntime } from "../daemon/container-runtime.js";
import { bringUpServices } from "../daemon/services.js";
import {
  claudeSubscriptionToken,
  type ModelTokenSource,
} from "../adapters/model-token.js";

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
export function daemonCredentials(
  manifest: Manifest,
  root: string,
  mint?: MintCall,
): CredentialProvider {
  const identity = manifest.identity;
  if (identity === undefined) {
    throw new Error(
      "The manifest declares no `identity`, so the daemon has no forge " +
        "credential of its own. It never runs under an ambient `gh` login " +
        "(ADR-0042). Add an `identity` block naming the Timone App's " +
        "`app_id`, `installation_id`, `private_key_path` and `login`.",
    );
  }

  return githubAppCredentials({
    appId: identity.app_id,
    installationId: identity.installation_id,
    privateKeyPath: resolve(root, identity.private_key_path),
    ...(mint === undefined ? {} : { mint }),
  });
}

export function machineAdapter(
  manifest: Manifest,
  root: string,
  options: MachineAdapterOptions = {},
): GitHubTicketingAdapter {
  // Order matters: this throws when no identity is declared, which is where
  // "fails loudly at spawn time, never falls back to ambient login" lives.
  const credentials = daemonCredentials(manifest, root, options.mint);
  const identity = manifest.identity as NonNullable<Manifest["identity"]>;

  return new GitHubTicketingAdapter({
    run: credentialCommandRunner({
      credentials,
      ...(options.run === undefined ? {} : { run: options.run }),
    }),
    machineLogin: identity.login,
  });
}

/** The runtimes a daemon can spawn sessions in. */
export const RUNTIMES = ["in-process", "container"] as const;
export type RuntimeName = (typeof RUNTIMES)[number];

/**
 * Which runtime a daemon uses when nobody says.
 *
 * ✏ **Flipped to `container` by phase 30's 30k, on 2026-08-22.** Until then it
 * was `in-process` deliberately: a phase that changed where every run happens
 * as a side effect of building the option would be exactly the "two runtimes
 * and neither trusted" state phase 30's own stopping rule warns about. The
 * box was built at 30h, given its services at 30i, and watched running a real
 * session and a real browser pass at 30j before this line moved.
 *
 * **This is the daemon's default, and only the daemon's.** Sessions fvermaut
 * opens himself are untouched by it
 * ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)
 * D5) — they do not come through here at all. `--runtime in-process` puts a
 * daemon back the old way in one word.
 */
export const DEFAULT_RUNTIME: RuntimeName = "container";

/**
 * The image a boxed run is started from, unless a flag names another.
 *
 * `timone-agent` is what 30g's `Dockerfile` builds and what its own
 * validation commands name. The two must agree: a default naming an image
 * nobody builds fails at the first boxed spawn, with a message about a
 * missing image rather than about a wrong name.
 */
export const DEFAULT_IMAGE = "timone-agent:latest";

export interface RuntimeChoice {
  /** Absent means {@link DEFAULT_RUNTIME}. */
  runtime?: RuntimeName;
  /** The image the container runtime starts from. */
  image: string;
  /** Where a boxed session's forge credential comes from. */
  credentials?: CredentialProvider;
  /** The timone root, beneath which a stack's source is materialized. */
  root?: string;
  /** How a boxed session reaches the model. Injected for tests. */
  modelToken?: ModelTokenSource;
  /** Who the box commits as, from the manifest's identity. */
  commitIdentity?: { name: string; email: string };
}

/**
 * The runtime a daemon spawns sessions in
 * ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)).
 *
 * This function is the switch the plan found missing: `runtime` is a
 * non-optional constructor argument on the spawner, hard-coded at the single
 * production wiring site below, so "chosen by configuration and off by
 * default" was a thing that had to be built rather than set. Sessions
 * fvermaut opens himself are untouched by any of it (ADR-0041 D5).
 *
 * An unknown name **throws**. A daemon that fell back to the in-process
 * runtime because a flag was misspelled would run every session on
 * fvermaut's machine while its operator believed otherwise.
 */
/**
 * Where a boxed session's transcript is kept, and how.
 *
 * One file per day under `.timone/sessions/`, appended to. The daemon's own
 * state directory, beside the ledger — never `projects/`, which is fvermaut's
 * (ADR-0043).
 *
 * **It exists because a boxed run could not be diagnosed.** The CLI writes its
 * transcript inside the container and the container is destroyed, so when the
 * first real run stopped halfway through a phase after an hour and $22, there
 * was no evidence left to read.
 */
function transcriptWriter(root: string): (line: string) => void {
  const dir = join(root, ".timone", "sessions");
  let stream: WriteStream | undefined;
  return (line) => {
    if (stream === undefined) {
      mkdirSync(dir, { recursive: true });
      stream = createWriteStream(join(dir, "boxed.jsonl"), { flags: "a" });
    }
    stream.write(`${line}\n`);
  };
}

export function runtimeFor(choice: RuntimeChoice): SessionRuntime {
  const name = choice.runtime ?? DEFAULT_RUNTIME;
  if (name === "in-process") return agentSdkRuntime;
  if (name === "container") {
    const root = choice.root;
    const credentials = choice.credentials;
    return containerRuntime({
      image: choice.image,
      // fvermaut's own subscription, read fresh at every spawn and stored
      // nowhere (blocker (e), answered 2026-08-22).
      modelToken: choice.modelToken ?? claudeSubscriptionToken(),
      ...(credentials === undefined ? {} : { credentials }),
      ...(choice.commitIdentity === undefined
        ? {}
        : { commitIdentity: choice.commitIdentity }),
      // Only when there is a root to materialize a stack's source under. A
      // runtime built without one still runs a session; it just has no
      // services beside it, which is 30h's behaviour before 30i.
      ...(root === undefined
        ? {}
        : {
            // Offline, and asked before anything is created: a commit nobody
            // has pushed is not in the clone the box makes (30k).
            commitIsPushed: (commit: string) => isCommitOnRemote(root, commit),
            // Kept on the host, because the container that wrote it is
            // destroyed and a failed run has to be readable afterwards.
            transcript: transcriptWriter(root),
            services: async (request) => {
              const workspace = request.workspace!;
              return bringUpServices({
                project: {
                  name: workspace.project.name,
                  repoUrl: workspace.project.remote,
                },
                branch: workspace.project.branch,
                runId: `${workspace.project.name}-${workspace.project.branch}`,
                root,
                ...(credentials === undefined
                  ? {}
                  : {
                      token: await credentials.tokenFor(
                        repoSlug(workspace.project.remote),
                      ),
                    }),
              });
            },
          }),
    });
  }
  throw new Error(
    `Unknown runtime "${String(name)}". Known runtimes: ${RUNTIMES.join(", ")}.`,
  );
}

/** Options accepted by `timone daemon`, as commander parses them. */
interface DaemonOptions {
  manifest: string;
  interval: string;
  progressInterval: string;
  once?: boolean;
  state?: string;
  runtime?: string;
  image?: string;
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
   * The timone root.
   *
   * ✏ **Narrowed by phase 30's 30d.** It used to be here so the poll cycle
   * could reach `projects/<name>/` and read a ticket's breakdown; the cycle
   * reads the forge now and takes no root at all
   * ([ADR-0043](../../doc/adr/0043-the-humans-checkout-is-theirs-alone.md)).
   * What it is still for is the **timone** checkout — the spawner's version
   * pin and its refusal to start on a dirty tree (ADR-0041 D2).
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
    .option(
      "--runtime <name>",
      `where a spawned session runs: ${RUNTIMES.join(" or ")} — ` +
        "a boxed run touches nothing of this machine (ADR-0041)",
      DEFAULT_RUNTIME,
    )
    .option(
      "--image <ref>",
      "the image a boxed run is started from",
      DEFAULT_IMAGE,
    )
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

      let runtime: SessionRuntime;
      try {
        runtime = runtimeFor({
          ...(options.runtime === undefined
            ? {}
            : { runtime: options.runtime as RuntimeName }),
          image: options.image ?? DEFAULT_IMAGE,
          root: process.cwd(),
          // R23 clause 5: a commit the machine produces is Timone's own.
          ...(manifest.identity === undefined
            ? {}
            : {
                commitIdentity: {
                  name: manifest.identity.login,
                  // Without a declared address the commits are still not
                  // fvermaut's; they simply do not link to a profile.
                  email:
                    manifest.identity.commit_email ??
                    `${manifest.identity.login}@users.noreply.github.com`,
                },
              }),
          // The box acts under the same identity the daemon does, scoped to
          // the one repository the run is for (ADR-0042).
          credentials: daemonCredentials(manifest, process.cwd()),
        });
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
        runtime,
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
        // The timone root — the spawner's, for the version pin and the
        // dirty-checkout refusal (ADR-0041 D2). The cycle no longer takes one.
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
