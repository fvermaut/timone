import { spawn as spawnProcess } from "node:child_process";
import { createInterface } from "node:readline";

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type { CredentialProvider } from "../adapters/credentials.js";
import type { ModelTokenSource } from "../adapters/model-token.js";
import { repoSlug } from "../adapters/github-tickets.js";
import { SessionProgress } from "./progress.js";
import type { ServiceStack } from "./services.js";
import {
  apiErrorFrom,
  sessionOutcomeFrom,
  type SessionOutcome,
  type SessionRequest,
  type SessionRuntime,
  type StartedSession,
} from "./session.js";

/**
 * A run happens in a container built from the remotes, and nothing of
 * fvermaut's machine is inside it
 * ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)).
 *
 * This is the second {@link SessionRuntime}. The in-process one stays and is
 * what interactive sessions and the fallback path keep using
 * ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)
 * D5); which one a daemon uses is a flag, and it is off until 30k flips it.
 *
 * **The part that is easy to get wrong is progress, not the container.** A
 * runtime that returns an outcome but reports nothing is a run nobody can
 * watch, and that is how
 * [R17](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md#r17--the-daemon-shows-progress-while-a-session-runs)
 * regresses without anybody noticing: the tick still moves, so the daemon
 * still looks alive. So the CLI inside the box is launched with the streaming
 * JSON output **and partial messages**, every line is parsed back into a
 * message, and every message goes through the same `SessionProgress.observe`
 * the in-process path uses. Partial messages are not a detail: they are the
 * only honest source of output tokens, and without them the tick reports
 * about a thirtieth of the truth ([timone#10](https://github.com/fvermaut/timone/issues/10)).
 */

/** How a container ended. */
export interface ContainerExit {
  /** Exit status, or null when a signal killed it. */
  code: number | null;
  /** The signal that killed it, or null. */
  signal: string | null;
  /** Whatever it wrote to stderr, for the reason a failure carries. */
  stderr: string;
}

/** A running container, as this module needs to see one. */
export interface ContainerProcess {
  /** Its stdout, one line at a time, as they arrive. */
  lines: AsyncIterable<string>;
  /** How it ended. **Resolves; never rejects.** */
  exit: Promise<ContainerExit>;
  /** Stop it. */
  kill(): void;
}

/**
 * How a container is started. Behind a seam so the whole runtime can be driven
 * without docker — including the paths that matter most, which are the ones
 * where something goes wrong.
 */
export type ContainerSpawn = (
  command: string,
  args: string[],
  options?: { env?: Record<string, string> },
) => ContainerProcess;

export interface ContainerRuntimeOptions {
  /** The image to run, built from the `Dockerfile` at the repository root. */
  image: string;
  /** Injected spawner; the real `docker` when absent. */
  spawn?: ContainerSpawn;
  /**
   * Where the box's forge credential comes from, scoped to the one repository
   * the run is for ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md)).
   * Absent means the box gets none, which is what a test wants and what a
   * production run must never have.
   */
  credentials?: CredentialProvider;
  /** Names the container. Behind a seam so a test is not clock-dependent. */
  nameFor?: (request: SessionRequest) => string;
  /**
   * Stands the project's services up beside the box, and answers the network
   * the box joins ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)
   * D3, and 30i).
   *
   * Absent means no stack, which is not an error: 30h's runtime worked before
   * 30i existed, and a project with nothing to stand up is an ordinary case.
   * A stack that **refuses** — no compose file, or never healthy — stops the
   * spawn before a container exists, because a session run against services
   * that are not there fails in a way that reads as the agent's fault.
   */
  services?: (request: SessionRequest) => Promise<ServiceStack>;
  /**
   * How the box talks to the model
   * ([blocker (e)](../../doc/plans/phases/phase-30.md), answered by fvermaut
   * on 2026-08-22: his own subscription rather than a separate API key).
   *
   * **Read per spawn and never cached.** The host's own CLI refreshes this
   * token about every six hours and a daemon runs for days, so a copy taken
   * at start-up is stale before lunch. See `src/adapters/model-token.ts`.
   *
   * Absent means the box is given no login, which is what a test wants and
   * what a production run must never have — a session that cannot reach the
   * model fails after cloning two repositories and standing up a database.
   */
  modelToken?: ModelTokenSource;
  /**
   * Whether the remote already carries the commit the request pins Timone to.
   *
   * **A boxed run is built from the remotes**, so a commit nobody has pushed
   * is not in the clone the box makes. Left as a readable failure by 30h;
   * made a refusal by 30k, because that is where the box becomes the default
   * and it stops being hypothetical. A run that cannot possibly work should
   * not first spend a compose build and two clones finding that out.
   *
   * Absent means the question is not asked, which is what a test wants.
   */
  commitIsPushed?: (commit: string) => Promise<boolean>;
  /**
   * How often a running box is handed a freshly minted forge token, in
   * milliseconds. Defaults to twenty minutes; a test passes something short.
   */
  refreshIntervalMs?: number;
  /**
   * The wait between refreshes. Behind a seam so a test is not clock-bound.
   * The real one is a timer that can be cut short when the run ends.
   */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Where a refresh that failed is reported. The daemon's log, in production.
   *
   * **A failed refresh never fails the run.** One blip leaves the previous
   * token in place, which is still good for a while, and the next attempt
   * mends it. What must not happen is silence: a box whose token stopped
   * being refreshed loses every commit it makes from then on, which is the
   * fault this whole mechanism exists to end.
   */
  log?: (message: string) => void;
  /**
   * Keeps every line the session printed, on the **host**.
   *
   * ✏ 2026-08-22. The first real boxed run cost an hour and $22, stopped
   * halfway through a phase, and could not be diagnosed: the CLI writes its
   * own transcript inside the container, and the container is destroyed. On
   * the host a failed session can be read back afterwards; in a box it could
   * not, so the one question worth answering — *why did it stop?* — had no
   * evidence at all.
   *
   * Every line already passes through this runtime on its way to
   * {@link SessionProgress}. Keeping them costs one file handle, and a line
   * that could not be parsed is kept too, because that is the interesting one.
   */
  transcript?: (line: string, sessionId: string | undefined) => void;
  /**
   * Who the box commits as.
   *
   * ✏ 2026-08-22. The first real boxed run pushed two commits carrying all
   * three provenance trailers correctly — and authored `Francois Vermaut
   * <fvermaut@gmail.com>`, because a fresh clone has no `user.email` and
   * something supplied the host's. [R23](../../doc/specs/prd/prd-02-inversion-of-control.criteria.md)
   * clause 5 says a commit the machine produces is **Timone's own and not
   * fvermaut's**; the comments were, the commits were not.
   */
  commitIdentity?: { name: string; email: string };
}

/**
 * The shared-memory size the box gets.
 *
 * Docker's default is 64 MiB, which kills Chromium on a real page. This is
 * Playwright's own guidance and it is the same floor `docker/image-check.mjs`
 * asserts from inside — the two must agree, or the check passes on an image
 * the daemon then starts differently.
 */
const SHM_SIZE = "1g";

/** Where the box puts what it clones. Nothing here comes from the host. */
const WORKSPACE = "/workspace";

/**
 * Where the box keeps the forge token, and the one place either reader looks.
 *
 * Under the box's own home rather than the workspace: the workspace holds two
 * git checkouts, and a secret written inside one of them is a secret one
 * `git add -A` away from a public repository.
 */
const FORGE_TOKEN_DIR = "$HOME/.timone";

/** The token itself. Written 0600, by the box at start and the daemon after. */
const FORGE_TOKEN_FILE = `${FORGE_TOKEN_DIR}/gh-token`;

/** Where the `gh` shim goes. First on PATH, so it is the `gh` that runs. */
const WRAPPER_DIR = "$HOME/.local/bin";

/** The variable a refreshed token travels in, host to box. Never an argument. */
const FORGE_TOKEN_VAR = "TIMONE_FORGE_TOKEN";

/**
 * How often the daemon writes a fresh forge token into a running box.
 *
 * A minted installation token lives one hour, and `tokenFor` re-mints once
 * five minutes are left. Twenty minutes is comfortably inside both, and the
 * cost of being early is one extra mint an hour.
 */
const FORGE_REFRESH_MS = 20 * 60 * 1000;

/**
 * The remote as a URL the box can actually open.
 *
 * **The box holds a forge token and no SSH key, and it never will** — a key is
 * host state, which is the one thing this phase keeps out. But a checkout on a
 * machine set up with SSH answers `git@github.com:owner/name.git` to `git
 * remote get-url origin`, and that is what the pin carries. Cloning it inside
 * the box asks for a passphrase nobody is there to type.
 *
 * Caught on 2026-08-22 by reading the request the fixed spawner built, before
 * it reached a real run — the earlier live checks had passed an HTTPS URL by
 * hand and so never met it.
 */
function cloneable(remote: string): string {
  return `https://github.com/${repoSlug(remote)}.git`;
}

/**
 * Turn one line of the CLI's stdout into a message
 * {@link SessionProgress.observe} understands.
 *
 * **This is a new, untyped boundary and it is the reason this function is
 * exported and separately tested.** In the in-process runtime the messages
 * are values the SDK handed over; here they are text, printed by a program in
 * a container, on a stream anything else in that container may also print to.
 * So a line that is not JSON, or is JSON but not a message, is **ignored** —
 * a banner on stdout is not a reason to fail a run — and only the shape
 * `observe` actually branches on is let through.
 */
export function parseSessionMessage(text: string): SDKMessage | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  if (typeof (value as { type?: unknown }).type !== "string") return undefined;

  return value as SDKMessage;
}

/** The real spawner: `docker`, with its stdout read a line at a time. */
const dockerSpawn: ContainerSpawn = (command, args, options) => {
  const child = spawnProcess(command, args, {
    env: options?.env === undefined ? process.env : { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    // Bounded: a container that fails by printing for an hour must not be
    // able to exhaust the daemon's memory on its way out.
    stderr = `${stderr}${chunk.toString("utf8")}`.slice(-64 * 1024);
  });

  const exit = new Promise<ContainerExit>((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal, stderr }));
    child.on("error", (error) =>
      resolve({ code: null, signal: null, stderr: `${stderr}${error.message}` }),
    );
  });

  return {
    lines: createInterface({ input: child.stdout! }),
    exit,
    kill: () => child.kill("SIGKILL"),
  };
};

/**
 * The script the box runs: clone both repositories at the versions the request
 * names, then hand the prompt to the CLI.
 *
 * `set -e` is load-bearing — a clone that fails must not be followed by a
 * session running against an empty directory and reporting that the stage
 * produced nothing.
 *
 * The prompt travels in the environment rather than in this string. It is
 * arbitrary human and machine text, and building a shell command out of it is
 * how a ticket body ends up executed.
 */
function boxScript(request: SessionRequest): string {
  const workspace = request.workspace!;
  // **Beneath the timone root, not beside it.** ADR-0007 fixes the layout as
  // `<timone root>/projects/<name>`, and every skill and prompt says
  // `projects/<name>/…` relative to where the session runs. The box put them
  // side by side at first, and the first real run showed exactly what that
  // costs: the agent found no `projects/` where it expected one, ran
  // `workspace sync` to make it, and cloned the whole project a second time —
  // throwing away the branch the box had already checked out for it.
  const project = `${WORKSPACE}/timone/projects/${workspace.project.name}`;

  return [
    "set -e",

    // Timone, at the exact commit the daemon is running (ADR-0041 D2). Cloned
    // whole rather than shallow: a commit is not reachable from a depth-1
    // clone of a branch tip.
    //
    // **The forge token is read from a file, and never from the environment
    // the container started with** ([#56](https://github.com/fvermaut/timone/issues/56)).
    // A minted token dies within the hour and a run lasts longer than that,
    // so a value fixed at spawn is dead for most of the run. The daemon
    // rewrites this file from outside while the run works; both readers below
    // open it afresh every time they are asked, so a refreshed token takes
    // effect with nothing restarted.
    //
    // The token still never reaches an argument vector: a URL carrying a
    // secret lands in a log line, a `ps` listing and git's own error messages.
    'if [ -n "${GH_TOKEN:-}" ]; then',
    `  mkdir -p "${FORGE_TOKEN_DIR}" "${WRAPPER_DIR}"`,
    `  ( umask 077; printf %s "$GH_TOKEN" > "${FORGE_TOKEN_FILE}" )`,
    // git asks the helper on every request, so it re-reads the file each time.
    "  git config --global credential.helper " +
      `'!f() { echo "username=x-access-token"; echo "password=$(cat "${FORGE_TOKEN_FILE}")"; }; f'`,
    // `gh` reads only its environment, and the environment of a running
    // process cannot be changed from outside. So it is shadowed: a wrapper
    // earlier on PATH sets the variable from the file and hands over to the
    // real binary. Every `gh` call is a new process, so every one of them
    // reads the current token.
    `  cat > "${WRAPPER_DIR}/gh" <<'TIMONE_GH_WRAPPER'`,
    "#!/bin/sh",
    `GH_TOKEN=$(cat "${FORGE_TOKEN_FILE}" 2>/dev/null)`,
    "GITHUB_TOKEN=$GH_TOKEN",
    "export GH_TOKEN GITHUB_TOKEN",
    'exec /usr/local/bin/gh "$@"',
    "TIMONE_GH_WRAPPER",
    `  chmod 0755 "${WRAPPER_DIR}/gh"`,
    `  export PATH="${WRAPPER_DIR}:$PATH"`,
    "fi",
    `git clone --quiet "$TIMONE_REMOTE" ${WORKSPACE}/timone`,
    // A commit the daemon is standing on but nobody has pushed is not in the
    // clone, and git's own words for that are "reference is not a tree",
    // which names no cause and suggests no action. Watched live on
    // 2026-08-22, on a branch that had not been pushed yet.
    `git -C ${WORKSPACE}/timone checkout --quiet "$TIMONE_COMMIT" 2>/dev/null || {`,
    `  echo "the daemon is running Timone at $TIMONE_COMMIT, and that commit` +
      ` is not on the remote. A boxed run is built from the remotes, so it` +
      ` cannot follow a commit nobody has pushed. Push it, or run the daemon` +
      ` on a commit that is pushed." >&2`,
    "  exit 78",
    "}",
    // The project, on the branch this run works. A branch that does not exist
    // yet is the ordinary case before the stage that cuts one, so the checkout
    // is allowed to fail and the clone's default branch stands.
    `mkdir -p ${WORKSPACE}/timone/projects`,
    `git clone --quiet "$PROJECT_REMOTE" ${project}`,
    `git -C ${project} checkout --quiet "$PROJECT_BRANCH" 2>/dev/null || true`,
    // Timone's own dependencies and build. `dist/` and `node_modules/` are
    // gitignored, so the clone has neither — and **both** hooks in
    // `.claude/settings.json` run `node "$CLAUDE_PROJECT_DIR/dist/cli.js"`.
    // Without this the R15 guardrail bracket is silently absent from every
    // boxed session, which is the opposite of what this phase promised.
    `cd ${WORKSPACE}/timone`,
    // **The output goes to a file, not to nowhere.** Both of these ran under
    // `--silent` until 2026-08-24, and npm's `--silent` is a log level: it
    // suppresses errors too. A run died here on 2026-08-24 (ivtrends#25/1) and
    // the only words anybody got were our own sentence below, so what npm
    // objected to was unknowable — and, worse, `technicalFault` reads the
    // failure's own words to decide whether a stop was a broken link. npm
    // would have written `ECONNRESET` or `fetch failed`; with those deleted
    // the stop looked like broken work, so ADR-0034's retry never fired and a
    // transient install failure went to the human instead.
    //
    // Redirecting is what `--silent` was reaching for and got wrong: the box's
    // **stdout is the session's stream-json channel**, so npm must not write
    // to it, but that is an argument for sending the output somewhere, not for
    // destroying it.
    "timone_reason() {",
    // npm prefixes every line with `npm error `; tsc does not. Strip it where
    // it is there, drop the blank spacer lines and the trailing pointer to a
    // log file inside a container nobody will ever open, and keep the first
    // three lines — which is where npm puts the code and the message, and
    // where tsc puts the first type error.
    "  sed -e 's/^npm \\(error\\|ERR!\\) *//' \"$1\" |",
    "    grep -v '^[[:space:]]*$' |",
    "    grep -v '^A complete log of this run' |",
    // Bounded: this sentence ends up on a ticket a human reads, and npm's
    // usage text runs for pages.
    "    head -3 | tr '\\n' ' ' | cut -c 1-300",
    "}",
    "npm ci --no-audit --no-fund > /tmp/timone-npm-ci.log 2>&1 || {",
    '  echo "could not install Timone\'s dependencies in the box, so its' +
      " guardrail hooks would not run. Refusing to work without them." +
      ' npm said: $(timone_reason /tmp/timone-npm-ci.log)" >&2',
    "  exit 79",
    "}",
    "npm run build > /tmp/timone-npm-build.log 2>&1 || {",
    '  echo "could not build Timone in the box, so its guardrail hooks would' +
      " not run. Refusing to work without them." +
      ' The build said: $(timone_reason /tmp/timone-npm-build.log)" >&2',
    "  exit 79",
    "}",
    // The prompt on stdin, so it is never a shell word.
    'printf "%s" "$TIMONE_PROMPT" | exec claude -p' +
      " --output-format stream-json --verbose --include-partial-messages" +
      ' --model "$TIMONE_MODEL"' +
      ' --permission-mode bypassPermissions' +
      ' ${TIMONE_EFFORT:+--effort "$TIMONE_EFFORT"}',
  ].join("\n");
}

/**
 * The `docker run` argument vector. Nothing of the host is in it.
 *
 * **Every variable the box needs is declared here as a bare `-e NAME`.** That
 * was missing until 2026-08-22 and no unit test could see it: setting a
 * variable in the options handed to `spawn` sets it on the **docker CLI's own
 * process**, and docker does not forward its environment into the container.
 * The box therefore got an empty `TIMONE_REMOTE` and died on `fatal:
 * repository '' does not exist` — found by the first real session, not by the
 * eleven tests that assert the environment is set, all of which were right.
 *
 * The bare form (`-e NAME`, no `=value`) is deliberate: docker reads the value
 * from its own environment, so **no secret ever enters the argument vector**,
 * which is the property the credential tests assert.
 */
function runArgs(
  name: string,
  image: string,
  script: string,
  network: string | undefined,
  env: readonly string[],
): string[] {
  return [
    "run",
    // Named rather than `--rm`: a container docker removed on exit cannot be
    // inspected after a failure, and this runtime removes it itself on every
    // path (including the ones `--rm` would not cover).
    "--name",
    name,
    "--init",
    // Chromium dies on a real page with docker's 64 MiB default.
    `--shm-size=${SHM_SIZE}`,
    // The stack's own network, so the agent reaches a database by the name
    // its compose file gives it. **Nothing is published to the host** — that
    // is the difference between this and a preview (30i).
    ...(network === undefined ? [] : ["--network", network]),
    // Forwarded by name, never by value. See the note above.
    ...env.flatMap((name) => ["-e", name]),
    // No `-v`, no `--mount`, no docker socket, no `--privileged`. The absence
    // is the point of the whole phase and is asserted on this vector.
    image,
    "sh",
    "-c",
    script,
  ];
}

/** A running refresh loop, stoppable. */
export interface ForgeTokenRefresh {
  /** Stop refreshing. Safe to call more than once, and after the box is gone. */
  stop(): void;
}

export interface ForgeTokenRefreshOptions {
  spawn: ContainerSpawn;
  /** The container to write into. */
  name: string;
  /** The repository the token is scoped to — `owner/name`. */
  repository: string;
  credentials: CredentialProvider;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

/**
 * Keep a running box's forge token current for as long as it runs
 * ([#56](https://github.com/fvermaut/timone/issues/56)).
 *
 * **The box cannot do this for itself and never will.** Minting needs the
 * App's private key, and the key stays on the host — that is ADR-0042 D3 and
 * it is not up for revision. So the only party that can hand a box a fresh
 * credential is the daemon, and the only thing it needs is a way in.
 *
 * `docker exec` is that way. It is the same command channel the runtime
 * already uses to start and destroy the container, it needs no port, no
 * mount and no listening socket in the box, and it costs one process every
 * twenty minutes.
 *
 * **The token is passed by name, not by value**, exactly as the spawn passes
 * it: `-e NAME` takes the value from this process's environment, so it never
 * appears in the exec's argument vector, in `ps`, or in a docker log line.
 */
export function keepForgeTokenFresh(
  options: ForgeTokenRefreshOptions,
): ForgeTokenRefresh {
  const intervalMs = options.intervalMs ?? FORGE_REFRESH_MS;
  let stopped = false;
  let cutShort: (() => void) | undefined;

  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        // A daemon must not be held open by this loop's next tick.
        timer.unref?.();
        cutShort = () => {
          clearTimeout(timer);
          resolve();
        };
      }));

  void (async () => {
    // The first write is the box script's own, from the token the spawn gave
    // it, so the loop waits before it does anything.
    while (!stopped) {
      await sleep(intervalMs);
      if (stopped) return;

      try {
        const token = await options.credentials.tokenFor(options.repository);
        const exit = await writeForgeToken(options.spawn, options.name, token);
        if (exit.code !== 0 && !stopped) {
          options.log?.(
            `could not hand ${options.name} a fresh forge token: ` +
              `${reasonFor(exit)}. Its current one dies within the hour, and ` +
              "anything it commits after that would not reach the remote.",
          );
        }
      } catch (error) {
        if (!stopped) {
          options.log?.(
            `could not mint a forge token for ${options.name}: ${oneLine(error)}`,
          );
        }
      }
    }
  })();

  return {
    stop() {
      stopped = true;
      cutShort?.();
    },
  };
}

/** Write one token into a running box, out of this process's environment. */
function writeForgeToken(
  spawn: ContainerSpawn,
  name: string,
  token: string,
): Promise<ContainerExit> {
  return spawn(
    "docker",
    [
      "exec",
      // By name. The value is in the environment below, never in this array.
      "-e",
      FORGE_TOKEN_VAR,
      name,
      "sh",
      "-c",
      // `mkdir` because a refresh can land before the box script has run,
      // and `umask` because the token is readable by nobody else.
      `mkdir -p "${FORGE_TOKEN_DIR}" && umask 077 && ` +
        `printf %s "$${FORGE_TOKEN_VAR}" > "${FORGE_TOKEN_FILE}"`,
    ],
    { env: { [FORGE_TOKEN_VAR]: token } },
  ).exit;
}

/**
 * A {@link SessionRuntime} that runs each session in its own container.
 */
export function containerRuntime(
  options: ContainerRuntimeOptions,
): SessionRuntime {
  const spawn = options.spawn ?? dockerSpawn;
  let sequence = 0;
  const nameFor =
    options.nameFor ??
    ((request: SessionRequest) =>
      `timone-${request.workspace?.project.name ?? "session"}-${++sequence}`);

  return {
    async start(request: SessionRequest): Promise<StartedSession> {
      const workspace = request.workspace;
      if (workspace === undefined) {
        throw new Error(
          "a boxed session needs a workspace to clone: this request describes none " +
            "(ADR-0041 D1)",
        );
      }

      const token =
        options.credentials === undefined
          ? undefined
          : await options.credentials.tokenFor(
              repoSlug(workspace.project.remote),
            );

      // First of all, and before anything is created: this is an offline
      // question about what the checkout last saw, and the alternative is
      // discovering the answer after a compose build and two clones.
      if (
        options.commitIsPushed !== undefined &&
        !(await options.commitIsPushed(workspace.timone.commit))
      ) {
        throw new Error(
          `Timone is at ${workspace.timone.commit}, and that commit is not on ` +
            "the remote. A boxed run is built from the remotes, so it cannot " +
            "follow a commit nobody has pushed. Push it, or run the daemon on " +
            "a commit that is pushed.",
        );
      }

      // Before the container, deliberately. A stack that refuses stops the
      // spawn here, with nothing started to clean up.
      const stack =
        options.services === undefined
          ? undefined
          : await options.services(request);

      // Also before the container, and for the same reason: a box that starts,
      // clones both repositories and stands up a database before failing to
      // authenticate has spent minutes to learn nothing. The stack is taken
      // back down if this refuses, since it is already up by now.
      let modelToken: string | undefined;
      try {
        modelToken =
          options.modelToken === undefined ? undefined : await options.modelToken();
      } catch (error) {
        if (stack !== undefined) await stack.down().catch(() => undefined);
        throw error;
      }

      const name = nameFor(request);
      const env: Record<string, string> = {
        TIMONE_REMOTE: cloneable(workspace.timone.remote),
        TIMONE_COMMIT: workspace.timone.commit,
        PROJECT_REMOTE: cloneable(workspace.project.remote),
        PROJECT_BRANCH: workspace.project.branch,
        TIMONE_PROMPT: request.prompt,
        TIMONE_MODEL: request.model,
        ...(request.effort === undefined ? {} : { TIMONE_EFFORT: request.effort }),
        ...(token === undefined ? {} : { GH_TOKEN: token, GITHUB_TOKEN: token }),
        ...(modelToken === undefined
          ? {}
          : { CLAUDE_CODE_OAUTH_TOKEN: modelToken }),
        ...(options.commitIdentity === undefined
          ? {}
          : {
              GIT_AUTHOR_NAME: options.commitIdentity.name,
              GIT_AUTHOR_EMAIL: options.commitIdentity.email,
              GIT_COMMITTER_NAME: options.commitIdentity.name,
              GIT_COMMITTER_EMAIL: options.commitIdentity.email,
            }),
      };

      const container = spawn(
        "docker",
        runArgs(
          name,
          options.image,
          boxScript(request),
          stack?.network,
          Object.keys(env),
        ),
        { env },
      );

      // Started with the container, stopped with it. Without this the token
      // the spawn just handed over is the only one the box will ever have,
      // and it dies within the hour (#56).
      const refresh =
        options.credentials === undefined
          ? undefined
          : keepForgeTokenFresh({
              spawn,
              name,
              repository: repoSlug(workspace.project.remote),
              credentials: options.credentials,
              ...(options.refreshIntervalMs === undefined
                ? {}
                : { intervalMs: options.refreshIntervalMs }),
              ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
              ...(options.log === undefined ? {} : { log: options.log }),
            });

      let resolveId!: (id: string) => void;
      const sessionId = new Promise<string>((resolve) => {
        resolveId = resolve;
      });

      const progress = new SessionProgress();

      const completed = (async (): Promise<SessionOutcome> => {
        let id = "unknown";
        let lastApiError: string | undefined;
        let outcome: SessionOutcome | undefined;

        try {
          for await (const text of container.lines) {
            const message = parseSessionMessage(text);

            // The session id comes off the first message, so it is known
            // before the second line is written — which is what lets each run
            // have its own file instead of everything landing in one pile.
            if (
              message !== undefined &&
              "session_id" in message &&
              typeof message.session_id === "string"
            ) {
              id = message.session_id;
              resolveId(id);
            }

            // Written whatever parsing made of it: a line nobody could read
            // is the one somebody will want afterwards. A transcript that
            // cannot be written never costs the run.
            if (options.transcript !== undefined) {
              try {
                options.transcript(text, id === "unknown" ? undefined : id);
              } catch {
                // Losing the record is bad; losing the run is worse.
              }
            }

            if (message === undefined) continue;
            progress.observe(message);

            if (message.type === "assistant" && message.parent_tool_use_id === null) {
              lastApiError = apiErrorFrom(message);
            }
            if (message.type === "result") {
              outcome = sessionOutcomeFrom(id, message, lastApiError);
            }
          }
        } catch (error) {
          // The pipe broke. The container may still be running, so it is
          // killed rather than merely waited for.
          container.kill();
          outcome = { sessionId: id, ok: false, error: oneLine(error) };
        }

        // Before the container is waited on, let alone destroyed: a refresh
        // firing into a box that is going away is a `docker exec` failure
        // reported as if the token had stopped being renewed.
        refresh?.stop();

        const exit = await container.exit;
        // Destroyed on **every** path, including this one — a leaked container
        // holds a name, a network and a gigabyte of shared memory, and the
        // next run on the same project cannot take the name back. The stack
        // goes with it, for the same reason and on the same paths.
        destroy(spawn, name);
        if (stack !== undefined) await stack.down().catch(() => undefined);
        resolveId(id);

        if (outcome !== undefined) return outcome;

        // No result message. Whatever the container did, it did not finish a
        // session, and the honest thing to report is how it ended.
        return { sessionId: id, ok: false, error: reasonFor(exit) };
      })();

      return { sessionId: await sessionId, completed, progress };
    },
  };
}

/** Remove the container, whatever state it is in. Never throws. */
function destroy(spawn: ContainerSpawn, name: string): void {
  try {
    void spawn("docker", ["rm", "-f", name]).exit.catch(() => undefined);
  } catch {
    // A teardown that fails is not a reason to lose the run's outcome. The
    // leak is visible in `docker ps -a`, which 30h's own gate reads.
  }
}

/** What a container's ending is called, in words that go on a ticket. */
function reasonFor(exit: ContainerExit): string {
  const detail = exit.stderr.trim();
  const tail = detail === "" ? "" : ` — ${detail.split("\n").slice(-3).join(" ")}`;

  if (exit.signal !== null) {
    return `the box was killed by ${exit.signal} before the session finished${tail}`;
  }
  return `the box exited ${exit.code ?? "with no status"} before the session finished${tail}`;
}

function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}
