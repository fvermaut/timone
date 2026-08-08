import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
