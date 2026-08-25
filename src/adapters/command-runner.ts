import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { CredentialProvider } from "./credentials.js";

const execFileAsync = promisify(execFile);

/**
 * The parts of a subprocess's environment an adapter may need to set.
 *
 * Both are optional and both matter to at least one adapter: the ticketing
 * adapter needs neither, and the Docker preview adapter needs both — compose
 * discovers its project from the working directory, and the host ports a
 * preview publishes are set by environment variables the compose file
 * interpolates.
 */
export interface CommandOptions {
  /** Working directory for the child process; the parent's when absent. */
  cwd?: string;
  /**
   * Variables to add to the parent's environment — added, never replacing
   * it. A child that lost `PATH` and `HOME` could not find `docker`, and a
   * caller should not have to reconstruct an environment to add one name.
   */
  env?: Record<string, string>;
  /**
   * The repository this command acts on, as GitHub's `owner/name`.
   *
   * Read only by {@link credentialCommandRunner}, and only when the command's
   * own arguments do not name one. Every `gh` call the ticketing adapter makes
   * passes `--repo <owner/name>`, so this is the escape hatch for the calls
   * that cannot — `gh api` against a path, for instance — rather than the
   * ordinary route.
   */
  repository?: string;
  /**
   * A deadline for this one call, overriding the runner's own.
   *
   * **For a call that legitimately takes longer than the default**, which is
   * sized against a slow `gh` request and is far too short for some of what
   * the daemon runs. `docker compose up --wait` is the case that forced this:
   * it is *given* how long to wait, and a runner that killed it earlier made
   * that argument unreachable and reported a healthy-but-slow stack as a
   * broken one ([#60](https://github.com/fvermaut/timone/issues/60)).
   *
   * A caller that sets this should derive it from whatever it told the
   * command to wait for, so the two cannot drift apart.
   */
  timeoutMs?: number;
}

/**
 * How an adapter reaches the outside world. Injected so tests can drive a
 * whole implementation without a network, a `gh` binary or a Docker daemon:
 * every subprocess an adapter runs goes through here.
 */
export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandOptions,
) => Promise<string>;

/** Error shape thrown by promisified execFile for a failing process. */
interface ExecFileError extends Error {
  stderr?: string;
  /** Set by node when it killed the child — a timeout, here. */
  killed?: boolean;
}

/** What actually spawns the process. A seam so retrying can be driven dry. */
export type Spawn = (
  command: string,
  args: string[],
  options: {
    maxBuffer: number;
    cwd?: string;
    env: NodeJS.ProcessEnv;
    timeout: number;
    killSignal: NodeJS.Signals;
  },
) => Promise<string>;

const execSpawn: Spawn = async (command, args, options) => {
  const { stdout } = await execFileAsync(command, args, options);
  return stdout;
};

/**
 * How long a single forge call may take before it is killed.
 *
 * Node's `execFile` default is `0`, meaning **never** — so before this
 * existed, one hung `gh` hung the poll cycle that called it, indefinitely, and
 * with it every project that cycle had not reached yet. Filed as
 * [timone#47](https://github.com/fvermaut/timone/issues/47).
 *
 * Ninety seconds is chosen against the slowest real call rather than against
 * a typical one: `gh issue list` over a large repository, and the GraphQL
 * reads behind a step listing, both run into double-digit seconds on a poor
 * connection. A deadline that fires on a healthy-but-slow call is worse than
 * none, because it converts slowness into a failed run.
 */
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Waits before each further attempt, in order — so three attempts in all.
 *
 * Filed as [timone#48](https://github.com/fvermaut/timone/issues/48): there
 * was no retry anywhere. The only retry in the system re-ran a **whole stage
 * session** on a model link failure, which is a different thing and could
 * never stand in for this one.
 */
const DEFAULT_RETRY_WAITS_MS: readonly number[] = [2_000, 8_000];

/**
 * Whether a failure is the connection rather than the answer.
 *
 * **This distinction is the whole point of retrying.** A `404` is the forge
 * telling us something true, and asking again three times gets the same true
 * answer more slowly. A reset connection is the forge not having spoken at
 * all. Matched on named transport conditions rather than on "not obviously a
 * success", so a new kind of real answer is never retried by default.
 */
function isTransportFailure(error: unknown): boolean {
  // Killed means node hit the deadline: the call gave no answer at all.
  if ((error as ExecFileError).killed === true) return true;

  const stderr = (error as ExecFileError).stderr ?? "";
  const message = error instanceof Error ? error.message : String(error);
  const text = `${stderr}\n${message}`;

  return [
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /EAI_AGAIN/i,
    /ENOTFOUND/i,
    /EPIPE/i,
    /EHOSTUNREACH/i,
    /ENETUNREACH/i,
    /socket hang up/i,
    /connection reset/i,
    /TLS handshake/i,
    // GitHub being unwell rather than answering. 5xx only: a 4xx is an answer.
    /HTTP 50[0234]\b/,
    /\bBad gateway\b/i,
    /\bService unavailable\b/i,
    /\bServer Error\b/i,
  ].some((pattern) => pattern.test(text));
}

export interface ExecRunnerOptions {
  /** Injected spawner, for tests. */
  spawn?: Spawn;
  /** Deadline per attempt. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Waits before each further attempt, in order. Defaults to
   * {@link DEFAULT_RETRY_WAITS_MS}; an empty list turns retrying off.
   */
  retryWaitsMs?: readonly number[];
  /** Waiting. Behind a seam so a test needs no real clock. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * The real runner: the named binary with arguments passed verbatim (never
 * through a shell), under a deadline, retried when the connection rather than
 * the forge is what failed.
 */
export function execRunner(options: ExecRunnerOptions = {}): CommandRunner {
  const spawn = options.spawn ?? execSpawn;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const waits = options.retryWaitsMs ?? DEFAULT_RETRY_WAITS_MS;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return async (command, args, callerOptions) => {
    // The caller's own deadline wins where it gave one: only the caller knows
    // that this particular command was told to spend three minutes waiting.
    const deadline = callerOptions?.timeoutMs ?? timeout;
    const callerDeadline = callerOptions?.timeoutMs !== undefined;
    let attempt = 0;
    for (;;) {
      try {
        return await spawn(command, args, {
          maxBuffer: 32 * 1024 * 1024,
          ...(callerOptions?.cwd === undefined ? {} : { cwd: callerOptions.cwd }),
          env:
            callerOptions?.env === undefined
              ? process.env
              : { ...process.env, ...callerOptions.env },
          timeout: deadline,
          killSignal: "SIGTERM",
        });
      } catch (error) {
        // A kill is ordinarily worth retrying: `gh` gave no answer at all, and
        // the next attempt costs a second. It is not worth retrying when the
        // deadline that fired was the caller's own, because then the kill is
        // this system carrying out its own instruction rather than the network
        // failing. Retrying turns one long build into three
        // ([#64](https://github.com/fvermaut/timone/issues/64)): a preview
        // killed at its own 660s deadline was rebuilt from scratch twice more
        // before anybody was told.
        const ownDeadline =
          callerDeadline && (error as ExecFileError).killed === true;
        const retryable = isTransportFailure(error) && !ownDeadline;
        if (retryable && attempt < waits.length) {
          await sleep(waits[attempt]);
          attempt += 1;
          continue;
        }

        const killed = (error as ExecFileError).killed === true;
        const stderr = (error as ExecFileError).stderr?.trim();
        const reason = killed
          ? `gave no answer within ${Math.round(deadline / 1000)}s and was killed`
          : stderr !== undefined && stderr !== ""
            ? stderr
            : error instanceof Error
              ? error.message
              : String(error);

        // The attempt count is only worth saying when there was more than one:
        // a reader chasing a one-off 404 does not need to be told it happened
        // once.
        const tried =
          retryable && attempt > 0 ? ` after ${attempt + 1} attempts` : "";
        throw new Error(
          `${command} ${args.join(" ")} failed${tried}: ${reason}`,
        );
      }
    }
  };
}

/**
 * The default runner, with the deadline and the retries the daemon needs.
 * Kept as a value rather than a factory because every existing importer
 * passes it straight through as a `CommandRunner`.
 */
export const execCommandRunner: CommandRunner = execRunner();

export interface CredentialRunnerOptions {
  /** Where a short-lived, single-repository token comes from. */
  credentials: CredentialProvider;
  /** The runner that actually spawns the process. Defaults to the real one. */
  run?: CommandRunner;
}

/**
 * Pull the repository this command acts on out of its own argument vector.
 *
 * The scope of the credential is taken from the command's **own arguments**
 * rather than from an ambient notion of "the current project", and that is the
 * point rather than an implementation detail: a token derived this way can
 * never be wider than the call that uses it.
 *
 * **Two spellings, because `gh` has two.** A porcelain command takes `--repo
 * <owner/name>`; `gh api` takes the repository inside its **path**, as
 * `repos/<owner>/<name>/…`.
 *
 * ✏ **The second was missing until 2026-08-22**, and it was missing for a
 * reason worth writing down: the claim *"every `gh` invocation passes
 * `--repo`"* came from grepping for `--repo` and finding what it looked for.
 * Four `gh api` call sites did not, and the first real daemon run refused its
 * own comment update — the daemon could not say where a ticket stood.
 */
function repositoryInArgs(args: string[]): string | undefined {
  const at = args.indexOf("--repo");
  if (at !== -1 && at < args.length - 1 && args[at + 1] !== "") {
    return args[at + 1];
  }

  for (const arg of args) {
    const path = /^\/?repos\/([^/\s]+)\/([^/\s]+)(?:\/|$)/.exec(arg);
    if (path !== null) return `${path[1]}/${path[2]}`;
  }
  return undefined;
}

/**
 * A {@link CommandRunner} that runs every command as **Timone**, under a
 * credential minted for the one repository that command names
 * ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)).
 *
 * Three properties, and each one is a thing that used to be untrue:
 *
 * - **It never falls back to an ambient login.** A command that names no
 *   repository cannot be scoped, so it is refused and never spawned — rather
 *   than running as whoever last typed `gh auth login`. `GH_CONFIG_DIR` is
 *   pointed at an empty directory for the same reason: `gh`'s stored host
 *   credentials are not a fallback this may quietly reach.
 * - **It mints per repository.** Two projects in one poll cycle produce two
 *   mint calls, so a token for one is never spent on the other. The caching
 *   that keeps this cheap lives in the provider, keyed by repository.
 * - **The token is never written down.** It travels in the child's
 *   environment, so it is absent from the argument vector every log line and
 *   every error message is built from.
 */
export function credentialCommandRunner(
  options: CredentialRunnerOptions,
): CommandRunner {
  const inner = options.run ?? execCommandRunner;

  // Created on first use rather than at import: a module that makes a
  // directory as a side effect of being loaded is one every test pays for.
  let configDir: string | undefined;
  const emptyConfigDir = (): string => {
    configDir ??= mkdtempSync(join(tmpdir(), "timone-gh-"));
    return configDir;
  };

  return async (command, args, callerOptions) => {
    const repository =
      callerOptions?.repository ?? repositoryInArgs(args);
    if (repository === undefined) {
      throw new Error(
        `Refusing to run "${command} ${args.join(" ")}": it names no repository, ` +
          "so no credential can be scoped to it. Timone acts under its own " +
          "identity and never under an ambient login (ADR-0042).",
      );
    }

    const token = await options.credentials.tokenFor(repository);

    return inner(command, args, {
      ...callerOptions,
      env: {
        ...callerOptions?.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
        GH_CONFIG_DIR: emptyConfigDir(),
      },
    });
  };
}
