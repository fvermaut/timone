import { join } from "node:path";
import { existsSync } from "node:fs";

import {
  execCommandRunner,
  type CommandOptions,
  type CommandRunner,
} from "./command-runner.js";
import type { Preview, PreviewAdapter, PreviewProject } from "./preview.js";

/**
 * How long the adapter waits for a stack to become healthy before calling the
 * preview failed. Generous, because the first `ensure` on a branch builds an
 * image from scratch; bounded, because a healthcheck that never passes would
 * otherwise hold a poll cycle open forever.
 */
export const PREVIEW_WAIT_TIMEOUT_SECONDS = 600;

/**
 * How much longer than its own wait the compose call is allowed to take before
 * the runner kills it.
 *
 * **The two used to be set in different files and could not both be true**
 * ([#64](https://github.com/fvermaut/timone/issues/64)). This asked compose to
 * wait 600 seconds and then called it through a runner whose deadline is 90 —
 * sized against a slow `gh` call, for good reasons of its own
 * ([#47](https://github.com/fvermaut/timone/issues/47)) — so the 600 was
 * unreachable by construction. Every preview whose image was not already built
 * was killed mid-build and reported to a client's pull request as a build that
 * had broken.
 *
 * This is the same fault [#60](https://github.com/fvermaut/timone/issues/60)
 * fixed in `src/daemon/services.ts`, left behind in the other of the two call
 * sites that pass `--wait-timeout`.
 *
 * Derived from the wait rather than written beside it, so the two cannot drift
 * apart again.
 */
const WAIT_MARGIN_SECONDS = 60;

/**
 * The container port a preview's application listens on.
 *
 * Deliberately a constant rather than something read from the project: it is
 * the port *inside* the container, which the standards entry fixes for every
 * project, and the whole point of publishing to an ephemeral host port is
 * that the inside stays predictable while the outside does not.
 */
const APP_CONTAINER_PORT = "3000";

/** The compose profile that brings a project's full stack up. */
const APP_PROFILE = "app";

/** The service within it that answers requests — what gets a published port. */
const APP_SERVICE = "app";

/** The compose profile a project uses to declare how its preview is seeded. */
const SEED_PROFILE = "seed";
const SEED_SERVICE = "seed";

/**
 * The committed env template a project's compose file interpolates from.
 * Committed, non-secret and obviously local by convention — which is exactly
 * what a preview should run on. Absent is a legitimate answer: a project whose
 * compose file needs no variables gets no `--env-file` flag.
 */
const ENV_TEMPLATE = ".env.example";

export interface DockerPreviewAdapterOptions {
  /** The timone root. Worktrees and project paths are resolved against it. */
  root: string;
  /** Subprocess seam; defaults to running the real binaries. */
  run?: CommandRunner;
  /** Filesystem probe, injected so tests stay hermetic. */
  exists?: (path: string) => boolean;
  /** Seconds to wait for a stack to become healthy. */
  waitTimeoutSeconds?: number;
}

/** What the adapter last made true for one pull request. */
interface Ensured {
  headSha: string;
  preview: Preview;
}

/**
 * Previews as Docker Compose stacks on this host, one compose project and one
 * git worktree per pull request ([ADR-0005](../../doc/adr/0005-docker-previews-on-own-host.md),
 * [ADR-0021](../../doc/adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)).
 *
 * **It reads the port rather than allocating one.** The stack comes up with
 * `APP_PORT=0` and `POSTGRES_PORT=0`, so Docker picks free host ports and
 * `docker compose port` reports what it picked. There is no allocation scheme
 * to collide and no per-project registry to keep. The accepted cost is that a
 * preview's URL is not stable across a rebuild — the comment on the pull
 * request is updated in place instead of the URL being promised constant.
 *
 * **The compose project name is what makes two previews coexist.** `-p
 * <project>-pr-<n>` prefixes container names *and* volume names, which is what
 * the pilot's `compose.yaml` header was written for. Nothing else in this file
 * distinguishes one preview from another.
 *
 * **Source is a detached worktree under the timone root**, never a checkout
 * inside the client's working tree: the repository is only ever addressed with
 * `git -C` to administer worktrees. Everything written lands under
 * `.timone/previews/`.
 *
 * **What it remembers, and why that is safe.** A ready or failed preview is
 * memoised against the commit it was ensured for, so a cycle that finds
 * nothing changed issues no work at all — the property that makes calling this
 * every minute reasonable. The memory is per-process and deliberately not
 * persisted: the run ledger already records previews, and two ledgers
 * disagreeing is worse than a cold process doing one redundant convergence.
 * That convergence is safe because every operation here is idempotent — an
 * unchanged `up --build` recreates nothing and republishes nothing.
 */
export class DockerPreviewAdapter implements PreviewAdapter {
  private readonly root: string;
  private readonly run: CommandRunner;
  private readonly exists: (path: string) => boolean;
  private readonly waitTimeoutSeconds: number;
  private readonly ensured = new Map<string, Ensured>();

  constructor(options: DockerPreviewAdapterOptions) {
    this.root = options.root;
    this.run = options.run ?? execCommandRunner;
    this.exists = options.exists ?? existsSync;
    this.waitTimeoutSeconds =
      options.waitTimeoutSeconds ?? PREVIEW_WAIT_TIMEOUT_SECONDS;
  }

  async ensure(
    project: PreviewProject,
    pr: number,
    headSha: string,
  ): Promise<Preview> {
    const key = previewKey(project.name, pr);
    const known = this.ensured.get(key);
    if (known !== undefined && known.headSha === headSha) return known.preview;

    let preview: Preview;
    try {
      preview = { state: "ready", url: await this.converge(project, pr, headSha) };
    } catch (error) {
      // Never an exception: the pull request is the deliverable and the
      // preview is an aid to reviewing it, so a stack that will not come up
      // is a thing to be told about rather than a reason to withhold work.
      preview = { state: "failed", reason: previewFailureReason(error) };
    }

    this.ensured.set(key, { headSha, preview });
    return preview;
  }

  async release(project: PreviewProject, pr: number): Promise<void> {
    const worktree = this.worktreePath(project, pr);
    this.ensured.delete(previewKey(project.name, pr));

    // The worktree carries the compose file, so its absence means there is
    // nothing left to address — which is also what makes this idempotent
    // across the cycles that follow a pull request ending.
    if (!(await this.hasWorktree(project, worktree))) return;

    await this.compose(project, pr, worktree, [
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
    await this.removeBuiltImages(project, pr);
    await this.run("git", [
      "-C",
      this.repoPath(project),
      "worktree",
      "remove",
      "--force",
      worktree,
    ]);
  }

  /**
   * Delete the images this preview's own build produced.
   *
   * **Measured at 16e's gate: without this, teardown left 1.5 GB per pull
   * request on the host forever** — containers and volumes are the small half
   * of the accumulation nobody notices until the disk fills.
   *
   * **Not `docker compose down --rmi local`**, which was tried first and does
   * nothing here: compose fills in a default `image` name for a build-only
   * service during config normalisation, and then skips it as "custom
   * tagged". It reports no error and no image, so the flag reads as working.
   * The matter was settled by looking at `docker images` after a real
   * teardown, not by reading the flag's documentation.
   *
   * The filter is the compose project prefix, which is unique to this pull
   * request — so this cannot reach a pinned image like `postgres:17.5`, which
   * other previews and the human's own stack share, or another preview's.
   */
  private async removeBuiltImages(
    project: PreviewProject,
    pr: number,
  ): Promise<void> {
    const listed = await this.run("docker", [
      "image",
      "ls",
      "--filter",
      `reference=${composeProject(project.name, pr)}-*`,
      "--quiet",
    ]);
    const ids = [
      ...new Set(listed.split("\n").map((id) => id.trim()).filter((id) => id !== "")),
    ];
    if (ids.length === 0) return;

    await this.run("docker", ["image", "rm", "--force", ...ids]);
  }

  /** Make the preview true, and return where it is. Throws on any failure. */
  private async converge(
    project: PreviewProject,
    pr: number,
    headSha: string,
  ): Promise<string> {
    const worktree = this.worktreePath(project, pr);
    const repo = this.repoPath(project);

    const existing = await this.hasWorktree(project, worktree);
    // The daemon's clone may never have seen this head — the branch moved on
    // GitHub since the last fetch — so resolve it before asking git to check
    // it out, rather than after a confusing "invalid reference".
    await this.run("git", ["-C", repo, "fetch", "--quiet", "origin"]);
    if (existing) {
      // Move the one worktree this pull request owns. A second `worktree add`
      // would leave the previous commit's copy on disk forever.
      await this.run("git", ["-C", worktree, "checkout", "--detach", headSha]);
    } else {
      await this.run("git", [
        "-C",
        repo,
        "worktree",
        "add",
        "--detach",
        worktree,
        headSha,
      ]);
    }

    // `--wait` is what makes readiness the project's own answer rather than
    // this adapter's guess: it holds until every service's healthcheck passes
    // and every gating job has exited successfully.
    await this.compose(
      project,
      pr,
      worktree,
      [
        "up",
        "--build",
        "--detach",
        "--wait",
        "--wait-timeout",
        String(this.waitTimeoutSeconds),
      ],
      // Longer than the wait it just asked for, so compose is the thing that
      // decides a stack is unhealthy — and it says which service.
      (this.waitTimeoutSeconds + WAIT_MARGIN_SECONDS) * 1000,
    );

    await this.seed(project, pr, worktree);

    return `http://localhost:${readPublishedPort(
      await this.compose(project, pr, worktree, [
        "port",
        APP_SERVICE,
        APP_CONTAINER_PORT,
      ]),
    )}/`;
  }

  /**
   * Run the project's seed if it declares one, after migrations have run.
   *
   * The question is put to compose, never to a package manifest: asking
   * "which services exist under the seed profile" works for a Node project, a
   * Rails one and a Go one alike, and keeps this adapter ignorant of what it
   * is previewing. A project that declares no seed service gets an empty
   * preview, which is the honest outcome and not a failure.
   */
  private async seed(
    project: PreviewProject,
    pr: number,
    worktree: string,
  ): Promise<void> {
    const services = await this.compose(project, pr, worktree, [
      "--profile",
      SEED_PROFILE,
      "config",
      "--services",
    ]);
    const declared = services
      .split("\n")
      .map((line) => line.trim())
      .includes(SEED_SERVICE);
    if (!declared) return;

    // `run` rather than `up`: a seed is a job that ends, and this waits for
    // its exit status instead of for a healthcheck it does not have.
    await this.compose(project, pr, worktree, ["run", "--rm", SEED_SERVICE]);
  }

  /** One `docker compose` invocation against this pull request's stack. */
  private async compose(
    project: PreviewProject,
    pr: number,
    worktree: string,
    args: string[],
    timeoutMs?: number,
  ): Promise<string> {
    const envFile = this.exists(join(worktree, ENV_TEMPLATE))
      ? ["--env-file", ENV_TEMPLATE]
      : [];
    return this.run(
      "docker",
      ["compose", "-p", composeProject(project.name, pr), ...envFile, ...args],
      {
        ...this.composeContext(worktree),
        // Only the call that was *given* a wait carries a deadline of its own;
        // the rest are quick and keep the runner's default.
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      },
    );
  }

  /**
   * Where compose runs and what it interpolates from.
   *
   * Both host ports are zeroed so Docker assigns free ones — the decision
   * that removes any need for an allocation scheme. A shell variable beats
   * the env file for compose interpolation, which is what makes this
   * override work against a project's own committed defaults.
   */
  private composeContext(worktree: string): CommandOptions {
    return {
      cwd: worktree,
      env: {
        APP_PORT: "0",
        POSTGRES_PORT: "0",
        COMPOSE_PROFILES: APP_PROFILE,
      },
    };
  }

  /** Whether git already has a worktree registered at `worktree`. */
  private async hasWorktree(
    project: PreviewProject,
    worktree: string,
  ): Promise<boolean> {
    const listed = await this.run("git", [
      "-C",
      this.repoPath(project),
      "worktree",
      "list",
      "--porcelain",
    ]);
    return listed
      .split("\n")
      .some((line) => line.trim() === `worktree ${worktree}`);
  }

  private repoPath(project: PreviewProject): string {
    return join(this.root, project.path);
  }

  private worktreePath(project: PreviewProject, pr: number): string {
    return join(this.root, ".timone", "previews", project.name, `pr-${pr}`);
  }
}

/** The compose project name — what prefixes containers *and* volumes. */
export function composeProject(project: string, pr: number): string {
  return `${project}-pr-${pr}`;
}

/** `<project>#<pr>` — how one preview is told from another. */
function previewKey(project: string, pr: number): string {
  return `${project}#${pr}`;
}

/**
 * The host port out of `docker compose port`'s answer, which is a published
 * address — `0.0.0.0:54321` or `[::]:54321`. Taken from the end so an IPv6
 * host, which is full of colons, does not confuse it.
 *
 * Read, never computed: the port is Docker's choice, and an adapter that
 * predicted it would be reporting a URL nobody had verified.
 */
export function readPublishedPort(published: string): string {
  const address = published.trim().split("\n")[0]?.trim() ?? "";
  const port = address.slice(address.lastIndexOf(":") + 1);
  if (port === "" || !/^\d+$/.test(port)) {
    throw new Error(
      `Docker did not report a published port for the preview (got "${address}")`,
    );
  }
  return port;
}

/** How much of a failure a pull-request comment will carry. */
const REASON_LIMIT = 300;

/** Buildkit's rules and separators, which carry no information on their own. */
const SEPARATOR = /^[-=\s>|]*$/;

/**
 * Reduce an error to the one line that will go onto a pull request.
 *
 * **The last meaningful line, not the first**, and that was learnt at 16e's
 * live gate rather than reasoned out: a deliberately broken build reported
 * `Dockerfile:74`, which is true, fits on one line, and tells a reviewer
 * nothing. Docker and git both put their *summary* last — `target app: failed
 * to solve: process "/bin/sh -c npm run build" did not complete successfully`
 * — and lead with progress and source excerpts.
 *
 * **The command echo is dropped, not just shortened.** {@link execCommandRunner}
 * prefixes its errors with the whole argument vector, which here is full of
 * absolute paths on the machine the daemon runs on — and this string is posted
 * on a *client's* public pull request. What a reviewer needs is what went
 * wrong; where this laptop keeps its files is neither useful to them nor ours
 * to publish.
 */
export function previewFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message
    // Docker colours its output, and a PR comment is not a terminal.
    .replace(/\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !SEPARATOR.test(line));
  const last = lines.at(-1) ?? "";

  const echoed = / failed: /.exec(last);
  const reason =
    echoed === null ? last : last.slice(echoed.index + echoed[0].length);
  return reason.length <= REASON_LIMIT
    ? reason
    : `${reason.slice(0, REASON_LIMIT - 1)}…`;
}
