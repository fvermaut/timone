import { rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  execCommandRunner,
  type CommandRunner,
} from "../adapters/command-runner.js";
import type { TicketingProject } from "../adapters/ticketing.js";

/**
 * The services a boxed run reaches, stood up beside it and never inside it
 * ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)
 * D3).
 *
 * The agent's container has no docker CLI and no docker socket, deliberately,
 * so it cannot stand anything up for itself. Whatever a run needs — a
 * database, a queue, the project's own app — the daemon starts before the
 * session and takes down after it.
 *
 * **The difference between this and a preview is that nothing is published to
 * the host.** A preview exists to be opened in a browser, so it publishes a
 * port; a run's stack exists only for the agent, which reaches it by service
 * name on a private network. Publishing would put the stack on fvermaut's
 * machine, where it collides with whatever he already has on 3000 — and the
 * whole point of this phase is that a run stops being something he has to
 * think about.
 *
 * **A project must commit a compose file.** That is a hard prerequisite for
 * being built at all rather than an optional nicety, and as of 2026-08-22
 * **neither managed project satisfies it** — checked against the forge, not
 * assumed. So the refusal names what to add rather than merely reporting
 * something missing.
 */

/** The compose file names, and the override this module writes beside them. */
export const COMPOSE_FILES = {
  /** What compose itself looks for, in its own order of preference. */
  accepted: ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"],
  /** What this module writes to unpublish every port. */
  override: "compose.timone-run.yaml",
} as const;

/** The profile a project's compose file uses for its full stack. */
const APP_PROFILE = "app";

/** The committed env template a compose file interpolates from, if any. */
const ENV_TEMPLATE = ".env.example";

/** How long compose may take to report every service healthy. */
const DEFAULT_WAIT_SECONDS = 180;

/** A stack that is up, and how to take it down. */
export interface ServiceStack {
  /**
   * The docker network the agent's container joins, so it reaches services by
   * the names their compose file gives them.
   */
  network: string;
  /** The compose project name, unique to this run. */
  project: string;
  /** Take it down, with its volumes, and remove the source it came from. */
  down(): Promise<void>;
}

export interface BringUpOptions {
  project: TicketingProject;
  /** The branch this run works on — the source the stack is built from. */
  branch: string;
  /** The run's id, which is what makes this stack nobody else's. */
  runId: string;
  /** The timone root. The source is cloned beneath its `.timone/`. */
  root: string;
  /** Subprocess seam; the real binaries when absent. */
  run?: CommandRunner;
  /** The forge credential the clone runs under, when there is one. */
  token?: string;
  /** Filesystem probe, injected so tests stay hermetic. */
  exists?: (path: string) => boolean;
  /** Writing the override, injected for the same reason. */
  write?: (path: string, body: string) => void;
  /** Removing the source, injected for the same reason. */
  remove?: (path: string) => void;
  /** Seconds compose may take to report health. */
  waitSeconds?: number;
}

/**
 * A compose project name nobody else can collide with.
 *
 * Two runs on different projects would otherwise reach each other's databases
 * by service name, because the names are identical — every Next.js project in
 * the world calls its database `db`. The run id is what separates them, and it
 * is already unique per project per chunk.
 */
function composeProject(runId: string): string {
  return `timone-${runId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

/**
 * Bring up the project's compose stack on a private network.
 *
 * Throws — naming what went wrong — when the project commits no compose file,
 * or when the stack never becomes healthy. Both are refusals a human can act
 * on, and both leave nothing running: a half-started stack holds a network and
 * volumes the next run on the same project cannot take back.
 */
export async function bringUpServices(
  options: BringUpOptions,
): Promise<ServiceStack> {
  const run = options.run ?? execCommandRunner;
  const exists = options.exists ?? existsSync;
  const write =
    options.write ??
    ((path: string, body: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body, "utf8");
    });
  const remove =
    options.remove ??
    ((path: string) => rmSync(path, { recursive: true, force: true }));

  const name = composeProject(options.runId);
  // The daemon's own scratch space, beside the previews. **Never
  // `projects/`** — that folder is fvermaut's (ADR-0043), and the whole
  // reason this clones at all is that the daemon no longer has one.
  const source = join(options.root, ".timone", "stacks", name);

  remove(source);
  const remote = remoteFor(options.project.repoUrl);
  const env = credentialEnv(options.token);
  const shallow = ["clone", "--quiet", "--depth", "1"];

  // **The branch may not exist yet, and that is the ordinary case, not a
  // fault.** A run's work branch is cut by the first session that owns one and
  // pushed from inside the box; this clone happens *before* that session
  // starts. So the very first stage of a run that owns a branch — `breakdown`
  // for an initiative, `planning` for a step — asks for a branch nobody has
  // made, and git answers `Remote branch ... not found in upstream origin`.
  //
  // The box's own script has always allowed for this (`checkout ... || true`)
  // and this call did not, which made a boxed run impossible to start on a
  // fresh branch. Watched live on `ivtrends` #1, 2026-08-23.
  //
  // The default branch is the right fallback and not a guess: what this clone
  // is for is the compose file and the env template, which are the project's
  // committed shape rather than the run's work.
  try {
    await run("git", [...shallow, "--branch", options.branch, remote, source], env);
  } catch {
    // A real failure — no network, a bad credential, no such repository —
    // fails the second call too, and its message is the one that surfaces.
    remove(source);
    await run("git", [...shallow, remote, source], env);
  }

  const compose = COMPOSE_FILES.accepted.find((file) =>
    exists(join(source, file)),
  );
  if (compose === undefined) {
    remove(source);
    throw new Error(
      `${options.project.name} commits no compose file, so there is nothing to ` +
        `stand up beside a run. Add a \`${COMPOSE_FILES.accepted[0]}\` at the ` +
        "repository root declaring the services the app needs — a database, a " +
        "queue, whatever it talks to — under an `app` profile. A boxed run " +
        "reaches them by service name and publishes no port.",
    );
  }

  const envFile = exists(join(source, ENV_TEMPLATE))
    ? ["--env-file", ENV_TEMPLATE]
    : [];
  // **`COMPOSE_PROFILES` is on every compose call, including `down`.** A
  // service declared under a profile is invisible to compose without it, and
  // `docker compose down` then **exits 0 having removed nothing** —
  // `--remove-orphans` does not save it. Watched live on 2026-08-22. A
  // teardown that reports success and leaks the container, the network and
  // the volumes is how a machine fills up quietly.
  const context = {
    cwd: source,
    env: { COMPOSE_PROFILES: APP_PROFILE },
  };

  // Every service's ports are cleared, so nothing reaches the host. `!reset`
  // rather than a bare `ports: []`, which compose *merges* into the project's
  // own list and therefore changes nothing.
  const services = (
    await run(
      "docker",
      ["compose", "-p", name, ...envFile, "config", "--services"],
      context,
    )
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  write(
    join(source, COMPOSE_FILES.override),
    unpublished(services),
  );

  const composeArgs = [
    "compose",
    "-p",
    name,
    ...envFile,
    "-f",
    compose,
    "-f",
    COMPOSE_FILES.override,
  ];

  const down = async (): Promise<void> => {
    try {
      await run(
        "docker",
        [...composeArgs, "down", "-v", "--remove-orphans"],
        context,
      );
    } finally {
      remove(source);
    }
  };

  try {
    await run(
      "docker",
      [
        ...composeArgs,
        "up",
        "-d",
        "--wait",
        "--wait-timeout",
        String(options.waitSeconds ?? DEFAULT_WAIT_SECONDS),
      ],
      context,
    );
  } catch (error) {
    // Down first, then report: a stack that failed half-up is still holding a
    // network and volumes, and the reason is no use to anybody if the next run
    // cannot start either.
    await down().catch(() => undefined);
    throw new Error(
      `${options.project.name}'s services never became healthy, so no session ` +
        `was started against them: ${oneLine(error)}`,
    );
  }

  return {
    // Compose's own default network for a project, which is what the agent's
    // container joins.
    network: `${name}_default`,
    project: name,
    down,
  };
}

/** The override that unpublishes every service's ports. */
function unpublished(services: readonly string[]): string {
  return [
    "# Written per run by Timone (phase 30, 30i). Not committed anywhere.",
    "#",
    "# A boxed run reaches its services by name on a private network and",
    "# publishes nothing to the host: a published port would put this stack on",
    "# fvermaut's machine, where it collides with whatever he already has.",
    "#",
    "# `!reset` rather than `ports: []` — an override's empty list is *merged*",
    "# into the project's own, which changes nothing at all.",
    "services:",
    ...services.map((service) => `  ${service}:\n    ports: !reset []`),
  ].join("\n");
}

/** The clone URL, with no credential in it — the token travels in the env. */
function remoteFor(repoUrl: string): string {
  return repoUrl;
}

/**
 * How the credential reaches git without appearing in the argument vector.
 *
 * A URL carrying a token is a URL that lands in a log line, a `ps` listing and
 * git's own error messages. The askpass helper hands it over on demand instead.
 */
function credentialEnv(token: string | undefined): {
  env?: Record<string, string>;
} {
  if (token === undefined) return {};
  return {
    env: {
      GIT_ASKPASS: "/bin/echo",
      GIT_TERMINAL_PROMPT: "0",
      // git reads the credential from the helper's stdout; `echo` prints
      // whatever it is given, and the token is what it is given.
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: `!f() { echo "username=x-access-token"; echo "password=$TIMONE_FORGE_TOKEN"; }; f`,
      TIMONE_FORGE_TOKEN: token,
    },
  };
}

function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}
