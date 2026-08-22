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
}

/**
 * The default runner: the named binary with arguments passed verbatim (never
 * through a shell). Throws an Error carrying the process's stderr when it
 * fails.
 */
export const execCommandRunner: CommandRunner = async (
  command,
  args,
  options,
) => {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: 32 * 1024 * 1024,
      cwd: options?.cwd,
      env: options?.env === undefined ? process.env : { ...process.env, ...options.env },
    });
    return stdout;
  } catch (error) {
    const stderr = (error as ExecFileError).stderr?.trim();
    const reason =
      stderr !== undefined && stderr !== ""
        ? stderr
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`${command} ${args.join(" ")} failed: ${reason}`);
  }
};

export interface CredentialRunnerOptions {
  /** Where a short-lived, single-repository token comes from. */
  credentials: CredentialProvider;
  /** The runner that actually spawns the process. Defaults to the real one. */
  run?: CommandRunner;
}

/**
 * Pull `--repo <owner/name>` out of an argument vector.
 *
 * The scope of the credential is taken from the command's **own arguments**
 * rather than from an ambient notion of "the current project", and that is the
 * point rather than an implementation detail: a token derived this way can
 * never be wider than the call that uses it. Every `gh` invocation in
 * `github-tickets.ts` passes `--repo`, so this covers all of them.
 */
function repositoryInArgs(args: string[]): string | undefined {
  const at = args.indexOf("--repo");
  if (at === -1 || at === args.length - 1) return undefined;
  const value = args[at + 1];
  return value === "" ? undefined : value;
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
