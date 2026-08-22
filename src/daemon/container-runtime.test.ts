import { describe, expect, it } from "vitest";

import {
  containerRuntime,
  parseSessionMessage,
  type ContainerExit,
  type ContainerProcess,
  type ContainerSpawn,
} from "./container-runtime.js";
import { SessionProgress } from "./progress.js";
import { sessionRequest, type SessionRequest } from "./session.js";

const TIMONE_COMMIT = "a".repeat(40);

function request(): SessionRequest {
  return sessionRequest({
    cwd: "/root",
    prompt: "do the thing",
    model: "claude-opus-5",
    workspace: {
      timone: { commit: TIMONE_COMMIT, remote: "https://github.com/fvermaut/timone.git" },
      project: {
        name: "scratch-app",
        repoUrl: "https://github.com/fvermaut/scratch-app.git",
      },
      branch: "timone/7-the-page-feels-slow",
    },
  });
}

/** One line of the CLI's streaming JSON, as it actually arrives. */
function line(message: unknown): string {
  return JSON.stringify(message);
}

const started = line({ type: "system", subtype: "init", session_id: "sess-1" });

function messageStart(parent: string | null = null): string {
  return line({
    type: "stream_event",
    parent_tool_use_id: parent,
    session_id: "sess-1",
    event: { type: "message_start" },
  });
}

function messageDelta(tokens: number, parent: string | null = null): string {
  return line({
    type: "stream_event",
    parent_tool_use_id: parent,
    session_id: "sess-1",
    event: { type: "message_delta", usage: { output_tokens: tokens } },
  });
}

function result(subtype = "success"): string {
  return line({
    type: "result",
    subtype,
    session_id: "sess-1",
    duration_ms: 1234,
    num_turns: 3,
    total_cost_usd: 0.5,
    modelUsage: { "claude-opus-5": { outputTokens: 900 } },
  });
}

/** A fake container: the lines it prints, and how it ends. */
function fakeContainer(
  lines: string[],
  exit: Partial<ContainerExit> = {},
): {
  spawn: ContainerSpawn;
  calls: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }[];
  removed: string[];
  killed: () => number;
} {
  const calls: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }[] = [];
  const removed: string[] = [];
  let kills = 0;

  const spawn: ContainerSpawn = (command, args, options) => {
    calls.push({ command, args, env: options?.env });

    // `docker rm` and friends are one-shot and print nothing.
    if (args[0] !== "run") {
      removed.push(args.join(" "));
      return oneShot();
    }

    let resolveExit!: (value: ContainerExit) => void;
    const finished = new Promise<ContainerExit>((resolve) => {
      resolveExit = resolve;
    });

    const process: ContainerProcess = {
      lines: (async function* () {
        for (const text of lines) yield text;
        resolveExit({ code: 0, signal: null, stderr: "", ...exit });
      })(),
      exit: finished,
      kill: () => {
        kills += 1;
        resolveExit({ code: null, signal: "SIGKILL", stderr: "" });
      },
    };
    return process;
  };

  return { spawn, calls, removed, killed: () => kills };
}

function oneShot(): ContainerProcess {
  return {
    lines: (async function* () {})(),
    exit: Promise.resolve({ code: 0, signal: null, stderr: "" }),
    kill: () => {},
  };
}

function runtimeWith(spawn: ContainerSpawn) {
  return containerRuntime({ image: "timone-box:test", spawn });
}

describe("a session that runs in a box", () => {
  it("reports the session id the CLI inside announced", async () => {
    const { spawn } = fakeContainer([started, result()]);

    const session = await runtimeWith(spawn).start(request());

    expect(session.sessionId).toBe("sess-1");
    expect((await session.completed).ok).toBe(true);
  });

  it("feeds every message to progress, in order, as the in-process path does", async () => {
    // Case (1). The fixture carries **partial-message events** on purpose:
    // they are the only honest source of output tokens, and a runtime that
    // dropped them would still tick — reporting about a thirtieth of the
    // truth, with R17 looking satisfied (timone#10).
    const lines = [
      started,
      messageStart(),
      messageDelta(400),
      messageStart(),
      messageDelta(500),
      result(),
    ];
    const { spawn } = fakeContainer(lines);

    const session = await runtimeWith(spawn).start(request());
    await session.completed;

    // The same lines, fed straight into a fresh accumulator the way the
    // in-process runtime feeds it.
    const reference = new SessionProgress();
    for (const text of lines) {
      const message = parseSessionMessage(text);
      if (message !== undefined) reference.observe(message);
    }

    expect(session.progress?.snapshot().outputTokens).toBe(
      reference.snapshot().outputTokens,
    );
    expect(session.progress?.snapshot().outputTokens).toBe(900);
    expect(session.progress?.summary()).toEqual(reference.summary());
  });

  it("returns a failed outcome for a container that exits non-zero", async () => {
    // Case (2). Not a thrown error: the spawner has to put a reason on a
    // ticket, and an exception here would take the whole poll cycle down.
    const { spawn } = fakeContainer([started], {
      code: 137,
      stderr: "the box ran out of memory",
    });

    const outcome = await (await runtimeWith(spawn).start(request())).completed;

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("137");
    expect(outcome.error).toContain("out of memory");
  });

  it("resolves rather than hanging when the container is killed mid-run", async () => {
    // Case (3). A run that never resolves holds its project for ever.
    const { spawn } = fakeContainer([started], { code: null, signal: "SIGKILL" });

    const outcome = await (await runtimeWith(spawn).start(request())).completed;

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/SIGKILL/);
  });

  it("destroys the container when the session succeeded", async () => {
    const { spawn, removed } = fakeContainer([started, result()]);

    await (await runtimeWith(spawn).start(request())).completed;

    expect(removed.some((call) => call.startsWith("rm -f"))).toBe(true);
  });

  it("destroys the container when the session failed", async () => {
    // Case (4). Every exit path, and this is the one that leaks in practice.
    const { spawn, removed } = fakeContainer([started], { code: 1 });

    await (await runtimeWith(spawn).start(request())).completed;

    expect(removed.some((call) => call.startsWith("rm -f"))).toBe(true);
  });

  it("destroys the container when the stream itself throws", async () => {
    const spawn: ContainerSpawn = (command, args) => {
      if (args[0] !== "run") return oneShot();
      return {
        lines: (async function* () {
          yield started;
          throw new Error("the pipe broke");
        })(),
        exit: Promise.resolve({ code: 0, signal: null, stderr: "" }),
        kill: () => {},
      };
    };
    const removed: string[] = [];
    const recording: ContainerSpawn = (command, args) => {
      if (args[0] !== "run") removed.push(args.join(" "));
      return spawn(command, args);
    };

    const outcome = await (
      await runtimeWith(recording).start(request())
    ).completed;

    expect(outcome.ok).toBe(false);
    expect(removed.some((call) => call.startsWith("rm -f"))).toBe(true);
  });
});

describe("what the box is given, and what it is not", () => {
  function runCall(): { args: string[]; env?: Record<string, string> } {
    const { spawn, calls } = fakeContainer([started, result()]);
    void runtimeWith(spawn).start(request());
    return calls.find((call) => call.args[0] === "run")!;
  }

  function runArgs(): string[] {
    return runCall().args;
  }

  it("mounts nothing from the host", async () => {
    // Case (5), asserted on the arguments actually passed. A single `-v`
    // would put fvermaut's disk back inside the box, silently.
    const args = runArgs();

    expect(args).not.toContain("-v");
    expect(args).not.toContain("--volume");
    expect(args.some((arg) => arg.startsWith("--mount"))).toBe(false);
  });

  it("gives the box no docker socket and no docker CLI", async () => {
    const args = runArgs();

    expect(args.join(" ")).not.toContain("docker.sock");
    expect(args).not.toContain("--privileged");
  });

  it("runs the image it was configured with, and destroys the container itself", async () => {
    const args = runArgs();

    expect(args).toContain("timone-box:test");
    // Named, so teardown can name it back — and NOT `--rm`, because a
    // container docker removed on exit cannot be inspected after a failure.
    expect(args).toContain("--name");
    expect(args).not.toContain("--rm");
  });

  it("gives Chromium enough shared memory to survive a real page", async () => {
    // Docker's default /dev/shm is 64 MiB, which kills Chromium mid-page —
    // the same floor the image's own check asserts.
    expect(runArgs()).toContain("--shm-size=1g");
  });

  it("names the commit to clone timone at, never a branch", async () => {
    // In the environment rather than in the argument vector, deliberately:
    // the prompt travels the same way, and it is arbitrary human and machine
    // text. Building a shell command out of a ticket body is how a ticket
    // body ends up executed.
    expect(runCall().env?.TIMONE_COMMIT).toBe(TIMONE_COMMIT);
  });

  it("names the project's work branch", async () => {
    expect(runCall().env?.PROJECT_BRANCH).toBe("timone/7-the-page-feels-slow");
  });

  it("keeps the prompt out of the command line entirely", async () => {
    const call = runCall();

    expect(call.env?.TIMONE_PROMPT).toBe("do the thing");
    expect(call.args.join(" ")).not.toContain("do the thing");
  });

  it("gives the box a credential scoped to the one repository it works on", async () => {
    const minted: string[] = [];
    const { spawn, calls } = fakeContainer([started, result()]);
    const runtime = containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: {
        async tokenFor(repository) {
          minted.push(repository);
          return "ghs_boxed";
        },
      },
    });

    await runtime.start(request());
    const call = calls.find((entry) => entry.args[0] === "run")!;

    expect(minted).toEqual(["fvermaut/scratch-app"]);
    expect(call.env?.GH_TOKEN).toBe("ghs_boxed");
    expect(call.args.join(" ")).not.toContain("ghs_boxed");
  });

  it("gives the box nothing at all when no credential source is configured", async () => {
    expect(runCall().env?.GH_TOKEN).toBeUndefined();
  });

  it("refuses a request that describes no workspace", async () => {
    const { spawn } = fakeContainer([started, result()]);
    const bare = sessionRequest({
      cwd: "/root",
      prompt: "do the thing",
      model: "claude-opus-5",
    });

    await expect(runtimeWith(spawn).start(bare)).rejects.toThrow(/workspace/);
  });
});

describe("reading a message that arrived as text", () => {
  it("parses a line the CLI printed into a message progress understands", () => {
    const message = parseSessionMessage(messageDelta(120));

    expect(message).toBeDefined();
    const progress = new SessionProgress();
    progress.observe(message!);
    expect(progress.snapshot().outputTokens).toBe(120);
  });

  it("ignores a line that is not JSON, rather than taking the run down", () => {
    // The CLI prints to stdout, and so does anything else in the box that
    // decides to. A banner is not a reason to fail a run.
    expect(parseSessionMessage("Welcome to the box")).toBeUndefined();
  });

  it("ignores JSON that is not a message", () => {
    expect(parseSessionMessage("[1, 2, 3]")).toBeUndefined();
    expect(parseSessionMessage('{"no_type":true}')).toBeUndefined();
  });

  it("ignores a blank line", () => {
    expect(parseSessionMessage("   ")).toBeUndefined();
  });
});

describe("the box is built from the remotes, and says so when it cannot be", () => {
  it("explains an unpushed timone commit instead of quoting git", async () => {
    // Watched live on 2026-08-22: the box clones Timone from the remote, so a
    // commit the daemon is standing on but nobody has pushed is simply not
    // there. Git's own words are "reference is not a tree", which names no
    // cause and suggests no action.
    const { spawn } = fakeContainer([], {
      code: 78,
      stderr:
        "the daemon is running Timone at aaaa, and that commit is not on the " +
        "remote. A boxed run is built from the remotes, so it cannot follow a " +
        "commit nobody has pushed. Push it, or run the daemon on a commit " +
        "that is pushed.",
    });

    const outcome = await (await runtimeWith(spawn).start(request())).completed;

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/not on the remote/);
    expect(outcome.error).toMatch(/Push it/);
  });

  it("carries that reason through, rather than a bare exit status", async () => {
    const { spawn } = fakeContainer([], { code: 78, stderr: "" });

    const outcome = await (await runtimeWith(spawn).start(request())).completed;

    // With nothing on stderr there is nothing to say but the number, and the
    // number is still better than silence.
    expect(outcome.error).toContain("78");
  });
});
