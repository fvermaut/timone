import { describe, expect, it } from "vitest";

import type { CommandOptions, CommandRunner } from "./command-runner.js";
import { DockerPreviewAdapter, previewFailureReason } from "./docker-preview.js";
import type { PreviewProject } from "./preview.js";

const ROOT = "/timone";
const REPO = "/timone/projects/scratch-app";
const WORKTREE = "/timone/.timone/previews/scratch-app/pr-12";

const scratchApp: PreviewProject = {
  name: "scratch-app",
  path: "projects/scratch-app",
};

/** Recorded invocation: the command, its verbatim argument vector, its context. */
interface Invocation {
  command: string;
  args: string[];
  options?: CommandOptions;
}

/**
 * A fake command runner driven by matchers rather than a queue: the adapter's
 * call sequence branches (a worktree that exists, a compose file that declares
 * a seed service), and a positional queue would make every test depend on the
 * exact length of every other path.
 *
 * An unmatched call returns empty stdout rather than throwing — the calls that
 * matter to a test are the ones it stubs and the ones it asserts.
 */
function fakeRunner(): {
  run: CommandRunner;
  calls: Invocation[];
  on(match: (call: Invocation) => boolean, reply: string | Error): void;
  vector(command: string, verb: string): string[] | undefined;
} {
  const calls: Invocation[] = [];
  const stubs: Array<{
    match: (call: Invocation) => boolean;
    reply: string | Error;
  }> = [];

  const run: CommandRunner = async (command, args, options) => {
    const call: Invocation = { command, args, options };
    calls.push(call);
    const hit = stubs.find((stub) => stub.match(call));
    if (hit === undefined) return "";
    if (hit.reply instanceof Error) throw hit.reply;
    return hit.reply;
  };

  return {
    run,
    calls,
    on(match, reply) {
      stubs.push({ match, reply });
    },
    /** The first `command` invocation whose vector contains `verb`. */
    vector(command, verb) {
      return calls.find((call) => call.command === command && call.args.includes(verb))
        ?.args;
    },
  };
}

/** An adapter over `run`, told which paths exist on disk. */
function adapterWith(
  run: CommandRunner,
  present: readonly string[] = [`${WORKTREE}/.env.example`],
): DockerPreviewAdapter {
  return new DockerPreviewAdapter({
    root: ROOT,
    run,
    exists: (path) => present.includes(path),
  });
}

/** `git worktree list --porcelain` output listing `paths`. */
function worktreeList(...paths: string[]): string {
  return [REPO, ...paths]
    .map((path) => `worktree ${path}\nHEAD 0000000\ndetached\n`)
    .join("\n");
}

describe("ensure — the contract with Docker", () => {
  it("drives worktree, compose project and both host ports with an exact argument vector", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    expect(preview.state).toBe("ready");

    // The whole contract with git: source comes from a detached worktree at
    // the exact commit, created under the timone root and never inside the
    // client's working tree.
    expect(runner.vector("git", "add")).toEqual([
      "-C",
      REPO,
      "worktree",
      "add",
      "--detach",
      WORKTREE,
      "abc1234",
    ]);

    // The whole contract with Docker. Asserted verbatim because a wrong flag
    // here is invisible until a live run: `-p` is what gives each PR its own
    // container names and volume prefix, and the zeroed ports are what let
    // Docker assign free ones instead of an allocation scheme that collides.
    expect(runner.vector("docker", "up")).toEqual([
      "compose",
      "-p",
      "scratch-app-pr-12",
      "--env-file",
      ".env.example",
      "up",
      "--build",
      "--detach",
      "--wait",
      "--wait-timeout",
      "600",
    ]);
    const up = runner.calls.find((call) => call.args.includes("up"));
    expect(up?.options).toEqual({
      cwd: WORKTREE,
      env: { APP_PORT: "0", POSTGRES_PORT: "0", COMPOSE_PROFILES: "app" },
    });
  });

  it("fetches before checking a commit out, so a head this clone has never seen resolves", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    const order = runner.calls.map((call) => call.args.join(" "));
    const fetched = order.findIndex((line) => line.includes("fetch"));
    const added = order.findIndex((line) => line.includes("worktree add"));
    expect(fetched).toBeGreaterThanOrEqual(0);
    expect(fetched).toBeLessThan(added);
  });

  it("reads the URL from Docker rather than computing it", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    // A port no scheme would ever have guessed, and not the project's own.
    runner.on((call) => call.args.includes("port"), "0.0.0.0:49713\n");

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    expect(preview.url).toBe("http://localhost:49713/");
    expect(runner.vector("docker", "port")).toEqual([
      "compose",
      "-p",
      "scratch-app-pr-12",
      "--env-file",
      ".env.example",
      "port",
      "app",
      "3000",
    ]);
  });

  it("reads an IPv6 published address too, taking the port and not the host", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "[::]:49713\n");

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    expect(preview.url).toBe("http://localhost:49713/");
  });

  it("omits --env-file for a project that commits no .env.example", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    const preview = await adapterWith(runner.run, []).ensure(scratchApp, 12, "abc1234");

    expect(preview.state).toBe("ready");
    expect(runner.vector("docker", "up")).toEqual([
      "compose",
      "-p",
      "scratch-app-pr-12",
      "up",
      "--build",
      "--detach",
      "--wait",
      "--wait-timeout",
      "600",
    ]);
  });
});

describe("ensure — reconciling against a commit", () => {
  it("moves the existing worktree to a new head rather than adding a second one", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList(WORKTREE));
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    await adapterWith(runner.run).ensure(scratchApp, 12, "def5678");

    expect(runner.calls.filter((call) => call.args.includes("add"))).toEqual([]);
    expect(runner.vector("git", "checkout")).toEqual([
      "-C",
      WORKTREE,
      "checkout",
      "--detach",
      "def5678",
    ]);
    // The stack is rebuilt onto the new commit in the same call that would
    // have created it — `up --build` is what replaces it.
    expect(runner.vector("docker", "up")).toContain("--build");
  });

  it("issues no work at all for an unchanged head on a ready preview", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");
    const adapter = adapterWith(runner.run);

    const first = await adapter.ensure(scratchApp, 12, "abc1234");
    const before = runner.calls.length;
    const second = await adapter.ensure(scratchApp, 12, "abc1234");

    // A no-op, not merely a fast path: per-cycle reconciliation over a
    // rebuild loop is the whole reason this seam can be called every minute.
    expect(runner.calls.length).toBe(before);
    expect(second).toEqual(first);
  });

  it("rebuilds when the head moves, after having been ready", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList(WORKTREE));
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");
    const adapter = adapterWith(runner.run);

    await adapter.ensure(scratchApp, 12, "abc1234");
    const before = runner.calls.length;
    await adapter.ensure(scratchApp, 12, "def5678");

    expect(runner.calls.length).toBeGreaterThan(before);
    expect(
      runner.calls
        .slice(before)
        .some((call) => call.args.includes("checkout") && call.args.includes("def5678")),
    ).toBe(true);
  });
});

describe("ensure — seeding", () => {
  it("comes up ready without seeding when the compose file declares no seed service", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("config"), "db\nmigrate\napp\n");
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    // Empty rather than failed: "no seed" is a project's answer, not a fault.
    expect(preview).toEqual({ state: "ready", url: "http://localhost:54321/" });
    expect(runner.calls.filter((call) => call.args.includes("run"))).toEqual([]);
  });

  it("runs the seed service, after the stack is up, when the compose file declares one", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("config"), "db\nmigrate\napp\nseed\n");
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    expect(preview.state).toBe("ready");
    expect(runner.vector("docker", "run")).toEqual([
      "compose",
      "-p",
      "scratch-app-pr-12",
      "--env-file",
      ".env.example",
      "run",
      "--rm",
      "seed",
    ]);
    const order = runner.calls.map((call) => call.args.join(" "));
    expect(order.findIndex((line) => line.includes(" up "))).toBeLessThan(
      order.findIndex((line) => line.includes(" run ")),
    );
  });

  it("asks compose what services exist, never the project's package manifest", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    expect(runner.vector("docker", "config")).toEqual([
      "compose",
      "-p",
      "scratch-app-pr-12",
      "--env-file",
      ".env.example",
      "--profile",
      "seed",
      "config",
      "--services",
    ]);
    expect(runner.calls.every((call) => call.command !== "npm")).toBe(true);
  });
});

describe("ensure — failure is a value", () => {
  it("returns failed with a reason when the stack never becomes healthy, and does not throw", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on(
      (call) => call.args.includes("up"),
      new Error(
        "dependency failed to start\ncontainer scratch-app-pr-12-app-1 is unhealthy",
      ),
    );

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");

    expect(preview.state).toBe("failed");
    expect(preview.reason).toContain("unhealthy");
    expect(preview.url).toBeUndefined();
    // One line, because it goes onto a pull request.
    expect(preview.reason).not.toContain("\n");
  });

  it("returns failed rather than throwing when the commit cannot be checked out", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on(
      (call) => call.args.includes("add"),
      new Error("fatal: invalid reference: deadbee"),
    );

    const preview = await adapterWith(runner.run).ensure(scratchApp, 12, "deadbee");

    expect(preview.state).toBe("failed");
    expect(preview.reason).toContain("invalid reference");
  });

  it("does not retry a head that already failed, and does retry the next one", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("up"), new Error("build failed"));
    const adapter = adapterWith(runner.run);

    await adapter.ensure(scratchApp, 12, "abc1234");
    const before = runner.calls.length;
    await adapter.ensure(scratchApp, 12, "abc1234");
    expect(runner.calls.length).toBe(before);

    // A broken commit does not build differently a minute later; a new one
    // might, and that is the escape hatch — pushing a fix retries.
    await adapter.ensure(scratchApp, 12, "def5678");
    expect(runner.calls.length).toBeGreaterThan(before);
  });
});

describe("release", () => {
  it("tears the stack down with its volumes and removes the worktree", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList(WORKTREE));

    await adapterWith(runner.run).release(scratchApp, 12);

    expect(runner.vector("docker", "down")).toEqual([
      "compose",
      "-p",
      "scratch-app-pr-12",
      "--env-file",
      ".env.example",
      "down",
      "--volumes",
      "--remove-orphans",
    ]);
    expect(runner.vector("git", "remove")).toEqual([
      "-C",
      REPO,
      "worktree",
      "remove",
      "--force",
      WORKTREE,
    ]);
  });

  it("is a no-op against a preview that is already gone", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());

    await adapterWith(runner.run).release(scratchApp, 12);

    expect(runner.calls.every((call) => call.command !== "docker")).toBe(true);
    expect(runner.calls.filter((call) => call.args.includes("remove"))).toEqual([]);
  });

  it("forgets the preview, so a reopened pull request is built again", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList(WORKTREE));
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");
    const adapter = adapterWith(runner.run);

    await adapter.ensure(scratchApp, 12, "abc1234");
    await adapter.release(scratchApp, 12);
    const before = runner.calls.length;
    await adapter.ensure(scratchApp, 12, "abc1234");

    expect(runner.calls.length).toBeGreaterThan(before);
  });
});

describe("what the adapter never does", () => {
  it("writes nothing into the client's working tree", async () => {
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("list"), worktreeList());
    runner.on((call) => call.args.includes("port"), "0.0.0.0:54321\n");

    await adapterWith(runner.run).ensure(scratchApp, 12, "abc1234");
    await adapterWith(runner.run).release(scratchApp, 12);

    expect(runner.calls.length).toBeGreaterThan(0);
    for (const call of runner.calls) {
      // Every process runs in the preview's own worktree, or wherever the
      // daemon already stood — never inside the client's working tree.
      if (call.options?.cwd !== undefined) {
        expect(call.options.cwd).toBe(WORKTREE);
      }
      // Every absolute path handed to a process is either the preview's
      // worktree, or the repository under `-C` — which reads and administers
      // worktrees and checks nothing out into it.
      for (const arg of call.args.filter((value) => value.startsWith("/"))) {
        if (arg === REPO) {
          expect(call.args[call.args.indexOf(arg) - 1]).toBe("-C");
          continue;
        }
        expect(arg.startsWith(`${ROOT}/.timone/previews/`)).toBe(true);
      }
    }
  });
});

describe("what a failure is allowed to say", () => {
  it("reports what went wrong without republishing this machine's paths", () => {
    const reason = previewFailureReason(
      new Error(
        "git -C /Users/someone/dev/timone/projects/scratch-app worktree add " +
          "--detach /Users/someone/dev/timone/.timone/previews/scratch-app/pr-12 " +
          "deadbee failed: fatal: invalid reference: deadbee",
      ),
    );

    // This string goes on a *client's* public pull request. Where the daemon's
    // laptop keeps its files is not useful to a reviewer and not ours to post.
    expect(reason).toBe("fatal: invalid reference: deadbee");
    expect(reason).not.toContain("/Users/");
  });

  it("leaves an error that carries no command echo alone", () => {
    expect(previewFailureReason(new Error("docker daemon is not running"))).toBe(
      "docker daemon is not running",
    );
  });

  it("takes the summary Docker puts last, not the file reference it puts first", () => {
    // Verbatim from 16e's live gate, where the first line — `Dockerfile:74` —
    // was what a reviewer got, and it told them nothing.
    const reason = previewFailureReason(
      new Error(
        [
          "docker compose -p scratch-app-pr-16 up --build failed: #29 2.415   \u001b[90m18 |\u001b[0m       <AddTodoForm />",
          "#29 ERROR: process \"/bin/sh -c npm run build\" did not complete successfully: exit code: 1",
          "------",
          "Dockerfile:74",
          "--------------------",
          "  74 | >>> RUN npm run build",
          "--------------------",
          'target app: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1',
        ].join("\n"),
      ),
    );

    expect(reason).toBe(
      'target app: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1',
    );
    expect(reason).not.toContain("Dockerfile:74");
  });

  it("keeps the message to one line", () => {
    expect(
      previewFailureReason(new Error("container is unhealthy\nsee logs")),
    ).toBe("see logs");
  });

  it("truncates a reason too long to belong in a comment", () => {
    const reason = previewFailureReason(new Error("x".repeat(500)));

    expect(reason).toHaveLength(300);
    expect(reason.endsWith("\u2026")).toBe(true);
  });
});
