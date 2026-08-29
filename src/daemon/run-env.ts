import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The environment a boxed run gets for the project it works on — the real
 * secrets, and the addresses of the services the daemon stood up beside the
 * box ([ADR-0045](../../doc/adr/0045-a-boxed-runs-project-environment-comes-from-a-file-the-daemon-owns.md)).
 *
 * **Why this file has to exist at all.** A boxed run is built from the
 * remotes ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)),
 * and a project's `.env` is gitignored by every project that has one. So the
 * box gets the committed template and nothing else: every secret in it is
 * empty, and every address in it is the *host's* way to reach a service —
 * `localhost:5434` for a database that, inside the box, is a container called
 * `db` on a private network.
 *
 * Both halves of that were watched live on
 * [ivtrends#33](https://github.com/fvermaut/ivtrends/issues/33) on 2026-08-29.
 * The run stopped before writing a line of code and asked fvermaut to buy an
 * AlphaVantage subscription he had already bought — the key was on his disk,
 * in `projects/ivtrends/.env`, where nothing is allowed to read it
 * ([ADR-0043](../../doc/adr/0043-the-humans-checkout-is-theirs-alone.md) D1:
 * no fetch, no checkout, no merge, **no read**) — and reported that no
 * database was running while a healthy PostgreSQL sat on the very network its
 * container had joined.
 *
 * So the values come from a file the daemon owns, under its own state
 * directory, and never from the human's checkout.
 */

/** Where a project's run environment lives, under the daemon's own state. */
export const RUN_ENV_DIR = join(".timone", "env");

/** The file for one project. */
export function runEnvPath(root: string, project: string): string {
  return join(root, RUN_ENV_DIR, `${project}.env`);
}

/**
 * Names the box sets for itself, which a project's file may not take over.
 *
 * This is not tidiness. `GH_TOKEN` is the box's identity
 * ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)) and
 * `TIMONE_PROMPT` is the instruction it runs; a project file that set either
 * would silently redirect the run. A refusal that names the key is the only
 * safe answer, because the alternative — quietly ignoring the line — leaves a
 * human staring at a value he set and the machine did not use.
 */
const RESERVED = new Set([
  "TIMONE_REMOTE",
  "TIMONE_COMMIT",
  "TIMONE_PROMPT",
  "TIMONE_MODEL",
  "TIMONE_EFFORT",
  "TIMONE_FORGE_TOKEN",
  "PROJECT_REMOTE",
  "PROJECT_BRANCH",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
]);

/** What a shell and a dotenv reader both accept as a name. */
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface ReadRunEnvOptions {
  /** The timone root. The file is resolved beneath its `.timone/`. */
  root: string;
  /** The managed project this run is for. */
  project: string;
  /**
   * Reading the file, injected so tests stay hermetic. Returns `undefined`
   * when there is no file, which is not an error: a project that needs no
   * secret and talks to no service is an ordinary case.
   */
  read?: (path: string) => string | undefined;
}

/** A project's run environment, and where it was read from. */
export interface RunEnv {
  /** The file, named in full so a message can point a human at it. */
  path: string;
  /** Whether that file exists. */
  present: boolean;
  /** What it declares. Empty when the file is absent. */
  values: Record<string, string>;
}

/**
 * Read one project's run environment.
 *
 * Throws — naming the line — on anything the box could not carry safely. A
 * bad file must stop the run before a container exists, because the failure
 * it causes otherwise arrives as an agent reporting that a key is missing.
 */
export function readRunEnv(options: ReadRunEnvOptions): RunEnv {
  const path = runEnvPath(options.root, options.project);
  const read = options.read ?? defaultRead;
  const body = read(path);
  if (body === undefined) return { path, present: false, values: {} };
  return { path, present: true, values: parseRunEnv(body, path) };
}

/**
 * Parse the file's text.
 *
 * The format is the one every project already writes by hand: `NAME=value`,
 * one per line, `#` comments, blank lines ignored, an optional `export `
 * prefix and optional surrounding quotes tolerated so a file copied out of a
 * project's own `.env` works unchanged.
 */
export function parseRunEnv(body: string, path: string): Record<string, string> {
  const values: Record<string, string> = {};

  body.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;

    const at = `${path}:${index + 1}`;
    const separator = line.indexOf("=");
    if (separator === -1) {
      throw new Error(
        `${at} is not \`NAME=value\`, so the box cannot carry it: ${line}`,
      );
    }

    const name = line.slice(0, separator).replace(/^export\s+/, "").trim();
    if (!NAME.test(name)) {
      throw new Error(`${at} declares "${name}", which is not a variable name.`);
    }
    if (RESERVED.has(name)) {
      throw new Error(
        `${at} sets ${name}, which is the box's own. A run's identity, its ` +
          "prompt and its model are the daemon's to set; a project file that " +
          "took one over would redirect the run without saying so. Remove the " +
          "line.",
      );
    }

    const value = unquote(line.slice(separator + 1).trim());

    // **The one shape that is refused rather than escaped.** The value is
    // written into the project's `.env` inside the box, and that file is read
    // two ways: sourced by a shell (`set -a; . ./.env`) and parsed by dotenv.
    // A single quote or a backslash means one escaping that satisfies both
    // readers, and there is none — so the honest answer is to say the value
    // cannot travel rather than to write a file that means different things
    // to the two programs that read it. No API key, connection string or
    // password observed here contains either.
    if (/['\\]/.test(value)) {
      throw new Error(
        `${at} sets ${name} to a value containing a quote or a backslash, ` +
          "which cannot be written into a `.env` that both a shell and dotenv " +
          "read the same way. Change the value, or set it inside the project.",
      );
    }

    values[name] = value;
  });

  return values;
}

/** Strip one layer of matching quotes, the way a `.env` reader does. */
function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted === null ? value : quoted[2];
}

function defaultRead(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}
