import { describe, expect, it } from "vitest";

import {
  containerRuntime,
  parseSessionMessage,
  type ContainerExit,
  type ContainerProcess,
  type ContainerSpawn,
} from "./container-runtime.js";
import type { ServiceStack } from "./services.js";
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

  it("forwards every variable it sets into the container, by name", async () => {
    // Found by the first real session on 2026-08-22, and invisible to every
    // test above it: setting a variable in the options handed to `spawn` sets
    // it on the **docker CLI's own process**, and docker does not forward its
    // environment into the container. The box got an empty `TIMONE_REMOTE`
    // and died on `fatal: repository '' does not exist`.
    const call = runCall();

    for (const name of Object.keys(call.env ?? {})) {
      const at = call.args.indexOf("-e");
      expect(at, `no -e flags at all, so ${name} never reaches the box`).toBeGreaterThan(-1);
      expect(call.args).toContain(name);
    }
  });

  it("forwards them by name and never by value, so no secret is in the vector", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({
      image: "timone-box:test",
      spawn,
      modelToken: async () => "sk-ant-oat-live",
      credentials: { async tokenFor() { return "ghs_boxed"; } },
    }).start(request());

    const call = calls.find((entry) => entry.args[0] === "run")!;
    expect(call.args).toContain("CLAUDE_CODE_OAUTH_TOKEN");
    expect(call.args.join(" ")).not.toContain("sk-ant-oat-live");
    expect(call.args.join(" ")).not.toContain("ghs_boxed");
    // `-e NAME=value` would put it in the vector; `-e NAME` does not. Only
    // the arguments that follow an `-e` are checked — `--shm-size=1g` carries
    // an `=` and is nobody's secret.
    const forwarded = call.args.filter(
      (_arg, index) => call.args[index - 1] === "-e",
    );
    expect(forwarded.length).toBeGreaterThan(0);
    expect(forwarded.every((arg) => !arg.includes("="))).toBe(true);
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

describe("the services beside the box", () => {
  /** A stack that records whether it was taken down. */
  function fakeStack(): { stack: ServiceStack; downs: () => number } {
    let downs = 0;
    return {
      stack: {
        network: "timone-scratch-app-7-1_default",
        project: "timone-scratch-app-7-1",
        down: async () => {
          downs += 1;
        },
      },
      downs: () => downs,
    };
  }

  it("joins the network the stack is on, so services answer by name", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);
    const { stack } = fakeStack();

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      services: async () => stack,
    }).start(request());

    const args = calls.find((call) => call.args[0] === "run")!.args;
    expect(args).toContain("--network");
    expect(args).toContain("timone-scratch-app-7-1_default");
  });

  it("brings the stack up before the container starts, not after", async () => {
    const order: string[] = [];
    const { spawn } = fakeContainer([started, result()]);
    const recording: ContainerSpawn = (command, args, options) => {
      if (args[0] === "run") order.push("container");
      return spawn(command, args, options);
    };

    await containerRuntime({
      image: "timone-box:test",
      spawn: recording,
      services: async () => {
        order.push("stack");
        return fakeStack().stack;
      },
    }).start(request());

    expect(order).toEqual(["stack", "container"]);
  });

  it("takes the stack down when the session succeeded", async () => {
    const { spawn } = fakeContainer([started, result()]);
    const { stack, downs } = fakeStack();

    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      services: async () => stack,
    }).start(request());
    await session.completed;

    expect(downs()).toBe(1);
  });

  it("takes the stack down when the box failed", async () => {
    const { spawn } = fakeContainer([started], { code: 1 });
    const { stack, downs } = fakeStack();

    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      services: async () => stack,
    }).start(request());
    await session.completed;

    expect(downs()).toBe(1);
  });

  it("starts no container at all when the stack refused to come up", async () => {
    // A session run against services that are not there fails in a way that
    // reads as the agent's fault. Better to have started nothing.
    const { spawn, calls } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        services: async () => {
          throw new Error("scratch-app commits no compose file");
        },
      }).start(request()),
    ).rejects.toThrow(/compose file/);

    expect(calls.filter((call) => call.args[0] === "run")).toHaveLength(0);
  });

  it("runs without a stack when nothing configures one", async () => {
    // The in-between state this phase passes through: 30h's runtime works
    // before 30i exists, and a project with no services is not an error.
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(request());

    expect(calls.find((call) => call.args[0] === "run")!.args).not.toContain(
      "--network",
    );
  });
});

describe("how the box talks to the model", () => {
  it("carries the model token in the environment, never in an argument", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      modelToken: async () => "sk-ant-oat-live",
    }).start(request());

    const call = calls.find((entry) => entry.args[0] === "run")!;
    expect(call.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe("sk-ant-oat-live");
    expect(call.args.join(" ")).not.toContain("sk-ant-oat-live");
  });

  it("reads the token per spawn, so a refreshed login is the one used", async () => {
    // The host's CLI refreshes it about every six hours and a daemon runs for
    // days. A token read once at start-up would be stale before lunch.
    const reads: number[] = [];
    const { spawn } = fakeContainer([started, result()]);
    const runtime = containerRuntime({
      image: "timone-box:test",
      spawn,
      modelToken: async () => {
        reads.push(reads.length);
        return "sk-ant-oat-live";
      },
    });

    await runtime.start(request());
    await runtime.start(request());

    expect(reads).toHaveLength(2);
  });

  it("starts no container when there is no login to give it", async () => {
    // Nothing has been created yet, so the cheapest honest thing is to stop:
    // a box that starts, clones both repositories and stands up a database
    // before failing to authenticate has spent minutes to learn nothing.
    const { spawn, calls } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        modelToken: async () => {
          throw new Error("This machine is not logged in to Claude");
        },
      }).start(request()),
    ).rejects.toThrow(/not logged in/);

    expect(calls.filter((entry) => entry.args[0] === "run")).toHaveLength(0);
  });

  it("takes the stack down again when there is no login", async () => {
    // The stack comes up first, so a refusal here must not leave it running.
    let downs = 0;
    const { spawn } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        services: async () => ({
          network: "n",
          project: "p",
          down: async () => {
            downs += 1;
          },
        }),
        modelToken: async () => {
          throw new Error("This machine is not logged in to Claude");
        },
      }).start(request()),
    ).rejects.toThrow(/not logged in/);

    expect(downs).toBe(1);
  });
});
