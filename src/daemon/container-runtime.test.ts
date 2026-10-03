import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { githubAppCredentials, type MintCall } from "../adapters/credentials.js";
import {
  containerRuntime,
  keepForgeTokenFresh,
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

  /**
   * Stopping a boxed session, for a run a human cancelled
   * ([ADR-0047](../../doc/adr/0047-a-cancel-stops-the-work-it-cancels.md)).
   *
   * The fake ends its line stream when the container is removed, which is
   * what really happens: with the container gone the `docker run` client
   * exits and the pipe closes.
   */
  it("stops a session by removing the container, not by killing the client", async () => {
    const removed: string[] = [];
    let end!: () => void;
    const ending = new Promise<void>((resolve) => {
      end = resolve;
    });
    let kills = 0;
    const spawn: ContainerSpawn = (_command, args) => {
      if (args[0] !== "run") {
        removed.push(args.join(" "));
        end();
        return oneShot();
      }
      return {
        lines: (async function* () {
          yield started;
          await ending;
        })(),
        exit: Promise.resolve({ code: 137, signal: null, stderr: "" }),
        kill: () => {
          kills += 1;
        },
      };
    };

    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      nameFor: () => "timone-scratch-app-1",
    }).start(request());
    session.stop!();
    const outcome = await session.completed;

    // The container by name, and the client left to notice. Killing the
    // client instead would leave the box working, which is #69 itself.
    expect(removed[0]).toBe("rm -f timone-scratch-app-1");
    expect(kills).toBe(0);
    // And it really ends: a run whose session never settles holds its
    // project for ever, cancelled or not.
    expect(outcome.ok).toBe(false);
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

    expect(call.env?.TIMONE_PROMPT).toContain("do the thing");
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

  it("starts on a workspace that names no branch, and checks none out", async () => {
    // The stuck-run fault, seen live on ivtrends #57 on 2026-09-01: `triage`
    // owns no branch, the spawner therefore sent no workspace at all, and this
    // runtime refused every cycle for ever. A workspace with no branch is the
    // honest request — clone the project, stand on its default branch — and
    // the box has to accept it.
    const { spawn, calls } = fakeContainer([started, result()]);
    const branchless = sessionRequest({
      cwd: "/root",
      prompt: "do the thing",
      model: "claude-sonnet-5",
      workspace: {
        timone: {
          commit: TIMONE_COMMIT,
          remote: "https://github.com/fvermaut/timone.git",
        },
        project: {
          name: "scratch-app",
          repoUrl: "https://github.com/fvermaut/scratch-app.git",
        },
      },
    });

    const session = await runtimeWith(spawn).start(branchless);

    expect(session.sessionId).toBe("sess-1");
    const call = calls.find((entry) => entry.args[0] === "run")!;
    expect(call.env?.PROJECT_BRANCH).toBeUndefined();
    const script = call.args.at(-1)!;
    expect(script).toContain(
      'git clone --quiet "$PROJECT_REMOTE" /workspace/timone/projects/scratch-app',
    );
    expect(script).not.toContain("$PROJECT_BRANCH");
  });
});

describe("the environment the box gets for the project", () => {
  async function boxed(values: Record<string, string>, present = true) {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: { async tokenFor() { return "ghs_boxed"; } },
      runEnv: async () => ({
        path: "/root/.timone/env/scratch-app.env",
        present,
        values,
      }),
    }).start(request());
    const call = calls.find((entry) => entry.args[0] === "run")!;
    return { call, script: call.args[call.args.length - 1] };
  }

  it("carries the project's own values into the box, by name", async () => {
    // ivtrends#33, 2026-08-29: the run asked fvermaut to buy an AlphaVantage
    // subscription he had already bought. The key was on his disk, in the one
    // file nothing may read (ADR-0043 D1), and no other way in existed.
    const { call } = await boxed({ ALPHAVANTAGE_API_KEY: "premium-key" });

    expect(call.env?.ALPHAVANTAGE_API_KEY).toBe("premium-key");
    expect(call.args).toContain("ALPHAVANTAGE_API_KEY");
    // By name and never by value, like every other secret the box is handed.
    expect(call.args.join(" ")).not.toContain("premium-key");
  });

  it("writes them where the project's own tooling looks", async () => {
    // A value in the environment is not enough on its own: the project's
    // scripts do `set -a; . ./.env`, which then puts the committed template's
    // `localhost` addresses back over the top of it.
    const { script } = await boxed({
      DATABASE_URL: "postgresql://ivtrends:ivtrends@db:5432/ivtrends",
    });

    expect(script).toContain(".env.example");
    expect(script).toContain('printf "%s=\'%s\'\\n" DATABASE_URL "$DATABASE_URL"');
    // The template is copied first and these lines appended, so these win:
    // a shell and dotenv both take the last assignment of a name.
    expect(script.indexOf("cp ")).toBeLessThan(script.indexOf("DATABASE_URL"));
    // The value itself is nowhere in the vector.
    expect(script).not.toContain("ivtrends:ivtrends@db");
  });

  it("keeps the written file out of any commit the run makes", async () => {
    const { script } = await boxed({ ALPHAVANTAGE_API_KEY: "premium-key" });

    expect(script).toContain(".git/info/exclude");
    expect(script).toContain("chmod 0600");
  });

  it("writes nothing at all when the project declares nothing", async () => {
    const { script } = await boxed({}, false);

    expect(script).not.toContain(".env.example");
    expect(script).not.toContain(".git/info/exclude");
  });

  it("cannot be used to take over the box's own identity", async () => {
    // `run-env.ts` refuses these names when it reads the file. This is the
    // second lock on the same door: whatever reaches the seam, the daemon's
    // own values are the ones the box runs on.
    const { call } = await boxed({
      GH_TOKEN: "ghp_someone_else",
      TIMONE_PROMPT: "do something else entirely",
    } as Record<string, string>);

    expect(call.env?.GH_TOKEN).toBe("ghs_boxed");
    expect(call.env?.TIMONE_PROMPT).toMatch(/do the thing$/);
    expect(call.env?.TIMONE_PROMPT).not.toContain("do something else entirely");
  });

  it("says which file it read, so a missing one is visible before the run", async () => {
    const said: string[] = [];
    const { spawn } = fakeContainer([started, result()]);
    await containerRuntime({
      image: "timone-box:test",
      spawn,
      log: (message) => said.push(message),
      runEnv: async () => ({
        path: "/root/.timone/env/scratch-app.env",
        present: false,
        values: {},
      }),
    }).start(request());

    expect(said.join("\n")).toContain("/root/.timone/env/scratch-app.env");
  });
});

describe("what the box tells the agent about the box", () => {
  async function prompt(options: {
    services?: string[];
    values?: Record<string, string>;
  }) {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({
      image: "timone-box:test",
      spawn,
      ...(options.services === undefined
        ? {}
        : {
            services: async () => ({
              network: "n",
              project: "p",
              services: options.services!,
              down: async () => {},
            }),
          }),
      ...(options.values === undefined
        ? {}
        : {
            runEnv: async () => ({
              path: "/root/.timone/env/scratch-app.env",
              present: true,
              values: options.values!,
            }),
          }),
    }).start(request());
    return calls.find((entry) => entry.args[0] === "run")!.env!.TIMONE_PROMPT;
  }

  it("says a database beside the box is reached by name, not on localhost", async () => {
    // ivtrends#33: the agent checked for `docker`, then for a port on
    // `localhost`, and told fvermaut no database was running. One was, on the
    // network its own container had joined. Neither check could have found it.
    const said = await prompt({ services: ["db", "migrate", "app"] });

    expect(said).toContain("db, migrate, app");
    expect(said).toContain("no `docker` in this container");
    expect(said).toContain("Never `localhost`");
  });

  it("says so plainly when nothing was stood up beside it", async () => {
    expect(await prompt({})).toContain("No services were stood up");
  });

  it("names the values written into the project's .env, and never their content", async () => {
    const said = await prompt({ values: { ALPHAVANTAGE_API_KEY: "premium-key" } });

    expect(said).toContain("ALPHAVANTAGE_API_KEY");
    expect(said).not.toContain("premium-key");
  });

  it("says where a value a run still needs has to be put", async () => {
    // So a run that is genuinely missing something asks for the one action
    // that fixes it, instead of asking a human to buy what he already owns.
    expect(await prompt({})).toContain(".timone/env/scratch-app.env");
  });

  it("keeps the stage's own prompt, and puts it after", async () => {
    const said = await prompt({});

    expect(said).toContain("do the thing");
    expect(said.indexOf("running inside a container")).toBeLessThan(
      said.indexOf("do the thing"),
    );
  });
});

describe("a command that takes longer than a couple of minutes", () => {
  async function boxed() {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({ image: "timone-box:test", spawn }).start(request());
    const call = calls.find((entry) => entry.args[0] === "run")!;
    return { call, script: call.args[call.args.length - 1] };
  }

  it("is given ten minutes by default, and thirty if the agent asks", async () => {
    // ivtrends#35, 2026-08-30: the CLI's own two-minute default moved `npm
    // install` and an integration suite into the background, and both
    // sessions then ended waiting for a notification an unattended run never
    // gets. Neither command was an unusual one.
    const { call } = await boxed();

    expect(call.env?.BASH_DEFAULT_TIMEOUT_MS).toBe("600000");
    expect(call.env?.BASH_MAX_TIMEOUT_MS).toBe("1800000");
  });

  it("forwards both into the container, by name", async () => {
    // Setting them on the docker CLI's own process would change nothing
    // inside the box. Same trap as `TIMONE_REMOTE` on 2026-08-22.
    const { call } = await boxed();

    expect(call.args).toContain("BASH_DEFAULT_TIMEOUT_MS");
    expect(call.args).toContain("BASH_MAX_TIMEOUT_MS");
  });

  it("tells the agent what the budget is, and that a backgrounded command is lost", async () => {
    const { call } = await boxed();

    expect(call.env?.TIMONE_PROMPT).toContain("ten minutes");
    expect(call.env?.TIMONE_PROMPT).toContain("moved to the background is lost");
  });
});

describe("the project's dependencies", () => {
  async function boxed() {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({ image: "timone-box:test", spawn }).start(request());
    const call = calls.find((entry) => entry.args[0] === "run")!;
    return { call, script: call.args[call.args.length - 1] };
  }

  it("are installed by the box, not by the session", async () => {
    // `node_modules/` is gitignored, so the clone has none, and installing
    // them is the longest single command a stage runs. Doing it here takes
    // it out of the session entirely.
    const { script } = await boxed();

    expect(script).toContain("/workspace/timone/projects/scratch-app/package.json");
    expect(script).toContain("npm ci --no-audit --no-fund");
    expect(script).toContain("/tmp/timone-project-install.log");
  });

  it("falls back to `npm install` when there is no lockfile, or `npm ci` refuses", async () => {
    const { script } = await boxed();

    expect(script).toContain("if [ -f package-lock.json ]; then");
    expect(script).toContain("npm install --no-audit --no-fund");
  });

  it("does not take the box down when they will not install", async () => {
    // Timone's own install is a refusal, because the guardrail hooks depend
    // on it. This one is not: a project whose dependencies will not install
    // is something the stage must see and report, not a reason to kill the
    // box before the agent has read a file.
    const { script } = await boxed();

    // Up to the push guard, which comes next and is a refusal of its own (43a).
    const project = script.slice(
      script.indexOf("timone-project-install.log"),
      script.indexOf("guardrails install-push-guard"),
    );
    expect(project).not.toContain("exit 79");
    expect(script).toContain("the run has to install them itself");
  });

  it("leaves Timone's own install as the refusal it was", async () => {
    const { script } = await boxed();

    expect(script).toContain("Refusing to work without them.");
    // Timone first: a box that cannot run its own hooks must stop before it
    // spends minutes installing the project's tree.
    expect(script.indexOf("/tmp/timone-npm-ci.log")).toBeLessThan(
      script.indexOf("/tmp/timone-project-install.log"),
    );
  });

  it("tells the agent they are already there, and where npm's words are", async () => {
    const { call } = await boxed();

    expect(call.env?.TIMONE_PROMPT).toContain("installed before this session started");
    expect(call.env?.TIMONE_PROMPT).toContain("/tmp/timone-project-install.log");
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
        services: ["db"],
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
    //
    // ✏ The example used to be a project with no compose file. Since phase 32
    // that is not a refusal at all — it is a project with no services, and
    // Timone is one — so the example is a stack that never became healthy,
    // which is what a refusal now means.
    const { spawn, calls } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        services: async () => {
          throw new Error("scratch-app's db never became healthy");
        },
      }).start(request()),
    ).rejects.toThrow(/never became healthy/);

    expect(calls.filter((call) => call.args[0] === "run")).toHaveLength(0);
  });

  it("runs without a stack when the project commits no compose file", async () => {
    // The path a Timone self-run takes (ADR-0050 D1): a command-line program
    // with no services beside it. Before phase 32 this threw at the spawn.
    const { spawn, calls } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      services: async () => undefined,
    }).start(request());

    expect(calls.filter((call) => call.args[0] === "run")).toHaveLength(1);
    expect(calls.find((call) => call.args[0] === "run")!.args).not.toContain(
      "--network",
    );
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
          services: ["db"],
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

describe("refusing a version the box could never follow", () => {
  it("does not start anything when the pinned commit is not on the remote", async () => {
    // Found live on 2026-08-22 and left as a readable failure by 30h; 30k
    // makes it a refusal, because 30k is where the box becomes the default
    // and this stops being hypothetical. The run should not start rather
    // than start, clone, stand up a database and then die.
    const { spawn, calls } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        commitIsPushed: async () => false,
      }).start(request()),
    ).rejects.toThrow(/not on the remote/);

    expect(calls.filter((entry) => entry.args[0] === "run")).toHaveLength(0);
  });

  it("names the commit and what to do about it", async () => {
    const { spawn } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        commitIsPushed: async () => false,
      }).start(request()),
    ).rejects.toThrow(new RegExp(`${TIMONE_COMMIT}[\\s\\S]*[Pp]ush`));
  });

  it("asks before standing a stack up, so a refusal leaves nothing running", async () => {
    // The order matters and it is the cheap half: the check is offline, the
    // stack is a compose build.
    const order: string[] = [];
    const { spawn } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        commitIsPushed: async () => {
          order.push("checked");
          return false;
        },
        services: async () => {
          order.push("stack");
          return { network: "n", project: "p", services: [], down: async () => {} };
        },
      }).start(request()),
    ).rejects.toThrow(/not on the remote/);

    expect(order).toEqual(["checked"]);
  });

  it("starts normally when the commit is on the remote", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      commitIsPushed: async () => true,
    }).start(request());

    expect(calls.filter((entry) => entry.args[0] === "run")).toHaveLength(1);
  });

  it("starts normally when nobody configured the check", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(request());

    expect(calls.filter((entry) => entry.args[0] === "run")).toHaveLength(1);
  });
});

describe("cloning a remote the box can actually reach", () => {
  function sshRequest(): SessionRequest {
    return sessionRequest({
      cwd: "/root",
      prompt: "do the thing",
      model: "claude-opus-5",
      workspace: {
        // What `git remote get-url origin` answers on a machine set up with
        // SSH keys — which is fvermaut's, and is how his timone checkout is
        // configured. Caught on 2026-08-22, before he hit it.
        timone: { commit: "a".repeat(40), remote: "git@github.com:fvermaut/timone.git" },
        project: {
          name: "scratch-app",
          repoUrl: "ssh://git@github.com/fvermaut/scratch-app.git",
        },
        branch: "timone/7-slow",
      },
    });
  }

  it("turns an SSH remote into one the box's token can open", async () => {
    // The box holds a forge token and no SSH key, and it never will — a key
    // is host state, which is the one thing this phase keeps out. So an SSH
    // remote must become HTTPS on the way in, or the clone asks for a
    // passphrase nobody is there to type.
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(sshRequest());

    const env = calls.find((entry) => entry.args[0] === "run")!.env!;
    expect(env.TIMONE_REMOTE).toBe("https://github.com/fvermaut/timone.git");
    expect(env.PROJECT_REMOTE).toBe("https://github.com/fvermaut/scratch-app.git");
  });

  it("leaves an HTTPS remote exactly as it is", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(request());

    const env = calls.find((entry) => entry.args[0] === "run")!.env!;
    expect(env.PROJECT_REMOTE).toBe("https://github.com/fvermaut/scratch-app.git");
  });

  it("mints for the repository whichever spelling the remote used", async () => {
    const minted: string[] = [];
    const { spawn } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: {
        async tokenFor(repository) {
          minted.push(repository);
          return "ghs_boxed";
        },
      },
    }).start(sshRequest());

    expect(minted).toEqual(["fvermaut/scratch-app"]);
  });
});

describe("what a boxed run leaves behind for a human to read", () => {
  it("writes every line the session printed to a transcript on the host", async () => {
    // ✏ 2026-08-22. The first real boxed run cost an hour and $22, stopped
    // halfway through a phase, and **could not be diagnosed** — the CLI's own
    // transcript lives inside the container and dies with it. On the host a
    // failed session can be read back afterwards; in a box it could not.
    // Every line already passes through this runtime, so keeping them costs
    // one file handle.
    const written: string[] = [];
    const { spawn } = fakeContainer([started, messageDelta(10), result()]);

    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      transcript: (line) => written.push(line),
    }).start(request());
    await session.completed;

    expect(written).toHaveLength(3);
    expect(written[0]).toBe(started);
    expect(JSON.parse(written[2]).type).toBe("result");
  });

  it("keeps a line it could not parse, because that is the interesting one", async () => {
    const { spawn } = fakeContainer(["not json at all", started, result()]);

    const written: string[] = [];
    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      transcript: (line) => written.push(line),
    }).start(request());
    await session.completed;

    expect(written).toContain("not json at all");
  });

  it("does not take the run down when the transcript cannot be written", async () => {
    const { spawn } = fakeContainer([started, result()]);

    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      transcript: () => {
        throw new Error("the disk is full");
      },
    }).start(request());

    expect((await session.completed).ok).toBe(true);
  });
});

describe("who the box commits as", () => {
  it("commits as Timone, not as whoever the host belongs to", async () => {
    // ✏ 2026-08-22. The first real boxed run pushed two commits carrying all
    // three provenance trailers correctly — and authored `Francois Vermaut
    // <fvermaut@gmail.com>`. R23 clause 5 says a commit the machine produces
    // is Timone's own and not fvermaut's; comments were, commits were not.
    const { spawn, calls } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      commitIdentity: {
        name: "timone-agent[bot]",
        email: "319428833+timone-agent[bot]@users.noreply.github.com",
      },
    }).start(request());

    const env = calls.find((entry) => entry.args[0] === "run")!.env!;
    expect(env.GIT_AUTHOR_NAME).toBe("timone-agent[bot]");
    expect(env.GIT_COMMITTER_NAME).toBe("timone-agent[bot]");
    expect(env.GIT_AUTHOR_EMAIL).toBe(
      "319428833+timone-agent[bot]@users.noreply.github.com",
    );
    expect(env.GIT_COMMITTER_EMAIL).toBe(env.GIT_AUTHOR_EMAIL);
  });

  it("sets nothing when no identity is configured", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(request());

    expect(
      calls.find((entry) => entry.args[0] === "run")!.env!.GIT_AUTHOR_NAME,
    ).toBeUndefined();
  });
});

describe("the box can run Timone's own tooling", () => {
  it("builds Timone in the box, so the R15 hooks are not silently absent", async () => {
    // ✏ 2026-08-22. `dist/` and `node_modules/` are gitignored, so the clone
    // the box makes has neither — and **both** `.claude/settings.json` hooks
    // run `node "$CLAUDE_PROJECT_DIR/dist/cli.js"`. They could not run at
    // all. This phase's own plan says of the R15 bracket: *"Inside a
    // container the hooks still run and still matter… Nothing here is
    // removed."* They were removed, silently, by a `.gitignore` line.
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(request());

    const script = calls.find((entry) => entry.args[0] === "run")!.args.at(-1)!;
    expect(script).toContain("npm ci");
    expect(script).toContain("npm run build");
    // And it must fail loudly: a run without its guardrails is a run that
    // should not happen quietly.
    expect(script).toMatch(/guardrails|exit 79/);
  });

  it("keeps what npm said when the install fails, so the stop can be named", async () => {
    // ✏ 2026-08-24, after ivtrends#25/1 died here and told nobody why. Both
    // steps ran under `npm --silent`, and npm's `--silent` is a log level, not
    // an output channel: it suppresses errors as well. The run's whole failure
    // text was the sentence this file writes, and npm's own — the one naming
    // ECONNRESET, or a lock file out of sync — was gone.
    //
    // It cost more than a diagnosis. `technicalFault` reads a failure's own
    // words to decide whether a stop was a broken link worth retrying
    // (ADR-0034). With npm's words deleted there was nothing to read, so a
    // transient install failure was judged as broken work and put in front of
    // a human.
    const { spawn, calls } = fakeContainer([started, result()]);

    await runtimeWith(spawn).start(request());

    const script = calls.find((entry) => entry.args[0] === "run")!.args.at(-1)!;

    // The flag that did it, on either step, in any of its spellings.
    expect(script).not.toMatch(/npm (ci|run build)[^\n]*(--silent|--loglevel[= ]silent|\s-s\b)/);

    // Not silenced, and not on stdout either: stdout is the session's
    // stream-json channel. The output is kept in a file so the failure branch
    // can read it back.
    expect(script).toMatch(/npm ci[^\n]*>\s*\S+\s+2>&1/);
    expect(script).toMatch(/npm run build[^\n]*>\s*\S+\s+2>&1/);

    // And read back it is: each refusal quotes what the tool said.
    const refusals = script
      .split("\n")
      .filter((line) => line.includes("Refusing to work without them"));
    expect(refusals).toHaveLength(2);
    for (const refusal of refusals) {
      expect(refusal).toContain("$(timone_reason ");
    }
  });
});

describe("the forge token a running box works on", () => {
  /** Lets the test decide when the refresh loop's wait is over. */
  function handSleep() {
    const waiting: (() => void)[] = [];
    return {
      sleep: () => new Promise<void>((resolve) => void waiting.push(resolve)),
      pending: () => waiting.length,
      async tick(): Promise<void> {
        waiting.shift()?.();
        // Enough turns for the loop's two awaits — mint, then write — to run.
        for (let i = 0; i < 6; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      },
    };
  }

  function boxScriptOf(calls: { args: string[] }[]): string {
    const run = calls.find((call) => call.args[0] === "run")!;
    return run.args[run.args.length - 1];
  }

  it("reads its token from a file, so a refreshed one is picked up at once", async () => {
    // The fault behind #56: git and `gh` both read a value fixed when the
    // container started, and a minted token dies within the hour. Neither
    // reads the environment now — they read a file the daemon can rewrite.
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: {
        async tokenFor() {
          return "ghs_boxed";
        },
      },
    }).start(request());

    const script = boxScriptOf(calls);

    // git asks its helper on every request, and the helper opens the file.
    expect(script).toContain('password=$(cat "$HOME/.timone/gh-token")');
    // `gh` reads only its environment, and a running process's environment
    // cannot be changed from outside — so `gh` is shadowed by a wrapper that
    // sets the variable from the file and hands over to the real binary.
    expect(script).toContain('GH_TOKEN=$(cat "$HOME/.timone/gh-token"');
    expect(script).toContain('export PATH="$HOME/.local/bin:$PATH"');
    // The token is out of the workspace, which holds two git checkouts.
    expect(script).not.toContain("/workspace/timone/.timone/gh-token");
  });

  it("hands a running box a freshly minted token, over and over", async () => {
    const minted: string[] = [];
    const clock = handSleep();
    const { spawn, calls } = fakeContainer([]);

    const refresh = keepForgeTokenFresh({
      spawn,
      name: "timone-ivtrends-1",
      repository: "fvermaut/ivtrends",
      credentials: {
        async tokenFor(repository) {
          minted.push(repository);
          return `ghs_round_${minted.length}`;
        },
      },
      sleep: clock.sleep,
    });

    await clock.tick();
    await clock.tick();
    refresh.stop();

    const execs = calls.filter((call) => call.args[0] === "exec");
    expect(execs).toHaveLength(2);
    expect(minted).toEqual(["fvermaut/ivtrends", "fvermaut/ivtrends"]);
    expect(execs[0].env?.TIMONE_FORGE_TOKEN).toBe("ghs_round_1");
    expect(execs[1].env?.TIMONE_FORGE_TOKEN).toBe("ghs_round_2");
  });

  it("asks for a token that outlives the next refresh by ten minutes", async () => {
    // PRD-06.R5: the token written now is the box's only one until the next
    // refresh. With refreshes 30 minutes apart, it must have at least
    // 30 + 10 = 40 minutes left.
    const asked: ({ minLifeMs?: number } | undefined)[] = [];
    const clock = handSleep();
    const { spawn } = fakeContainer([]);

    const refresh = keepForgeTokenFresh({
      spawn,
      name: "timone-ivtrends-1",
      repository: "fvermaut/ivtrends",
      credentials: {
        async tokenFor(_repository, options) {
          asked.push(options);
          return "ghs_refreshed";
        },
      },
      intervalMs: 30 * 60 * 1000,
      sleep: clock.sleep,
    });

    await clock.tick();
    refresh.stop();

    expect(asked).toHaveLength(1);
    expect(asked[0]?.minLifeMs ?? 0).toBeGreaterThanOrEqual(2_400_000);
  });

  it("starts a box with a token that outlives its first refresh by ten minutes", async () => {
    // The first refresh comes 20 minutes after the start, so the token the
    // box starts with must have at least 20 + 10 = 30 minutes left.
    const asked: ({ minLifeMs?: number } | undefined)[] = [];
    const clock = handSleep();
    const { spawn } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: {
        async tokenFor(_repository, options) {
          asked.push(options);
          return "ghs_boxed";
        },
      },
      // Never ticked, so the only call below is the spawn's own.
      sleep: clock.sleep,
    }).start(request());

    expect(asked).toHaveLength(1);
    expect(asked[0]?.minLifeMs ?? 0).toBeGreaterThanOrEqual(1_800_000);
  });

  it("starts a box with a token that outlives a longer refresh interval by ten minutes", async () => {
    // The box's first refresh comes after the interval it was given, not
    // the default. With 30 minutes, its first token needs at least
    // 30 + 10 = 40 minutes left.
    const asked: ({ minLifeMs?: number } | undefined)[] = [];
    const clock = handSleep();
    const { spawn } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: {
        async tokenFor(_repository, options) {
          asked.push(options);
          return "ghs_boxed";
        },
      },
      refreshIntervalMs: 30 * 60 * 1000,
      // Never ticked, so the only call below is the spawn's own.
      sleep: clock.sleep,
    }).start(request());

    expect(asked).toHaveLength(1);
    expect(asked[0]?.minLifeMs ?? 0).toBeGreaterThanOrEqual(2_400_000);
  });

  it("a box is never handed a token that dies before its next refresh", async () => {
    // PRD-06.R5's falsifying test, with the real token cache on a fake
    // clock. The cache is shared with the machine's own calls, and on
    // 6 September it handed a box a token one of those calls had minted
    // earlier. Here the cached token has 25 minutes left when the box starts,
    // and the box's first refresh comes 20 minutes later.
    const dir = mkdtempSync(join(tmpdir(), "timone-box-token-"));
    try {
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      });
      const keyPath = join(dir, "app.private-key.pem");
      writeFileSync(keyPath, privateKey, { mode: 0o600 });

      let now = new Date("2026-09-06T12:00:00Z");
      // Each token the fake forge mints lives one hour, as GitHub's do, and
      // is named for the time it was minted.
      const mint: MintCall = async () => ({
        token: `ghs_minted_at_${now.toISOString().slice(11, 16)}`,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });
      const credentials = githubAppCredentials({
        appId: 4670926,
        installationId: 155426497,
        privateKeyPath: keyPath,
        mint,
        now: () => now,
      });

      // A box that keeps running until the test ends it, so its refresh has
      // something to write into.
      const calls: { args: string[]; env?: Record<string, string> }[] = [];
      let end!: () => void;
      const ended = new Promise<void>((resolve) => {
        end = resolve;
      });
      const spawn: ContainerSpawn = (_command, args, options) => {
        calls.push({ args, ...(options?.env === undefined ? {} : { env: options.env }) });
        if (args[0] !== "run") return oneShot();
        let resolveExit!: (value: ContainerExit) => void;
        const exit = new Promise<ContainerExit>((resolve) => {
          resolveExit = resolve;
        });
        return {
          lines: (async function* () {
            yield started;
            await ended;
            yield result();
            resolveExit({ code: 0, signal: null, stderr: "" });
          })(),
          exit,
          kill: () => resolveExit({ code: null, signal: "SIGKILL", stderr: "" }),
        };
      };
      const clock = handSleep();

      // The machine's own call, at noon: its token dies at 13:00.
      await credentials.tokenFor("fvermaut/scratch-app");

      // 25 minutes before that token dies, a box starts.
      now = new Date("2026-09-06T12:35:00Z");
      const session = await containerRuntime({
        image: "timone-box:test",
        spawn,
        credentials,
        sleep: clock.sleep,
      }).start(request());

      // Its first refresh, 20 minutes later.
      now = new Date("2026-09-06T12:55:00Z");
      await clock.tick();

      end();
      await session.completed;

      const atStart = calls.find((call) => call.args[0] === "run")?.env?.GH_TOKEN;
      const atRefresh = calls.find((call) => call.args[0] === "exec")?.env
        ?.TIMONE_FORGE_TOKEN;
      // The token minted for the box at 12:35 lives to 13:35. At the refresh
      // at 12:55 it still has 40 minutes left, more than 20 + 10, so the
      // refresh may hand it over again.
      expect(atStart).toBe("ghs_minted_at_12:35");
      expect(atRefresh).toBe("ghs_minted_at_12:35");
      expect([atStart, atRefresh]).not.toContain("ghs_minted_at_12:00");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("takes the box's token after the slow start-up, so the start-up does not eat its margin", async () => {
    // The cached token has 37 minutes left when the start begins, and the
    // stack beside the box takes 8 minutes to come up. Taken at the start, it
    // reaches the box with 29 minutes left, and has 9 left at the first
    // refresh 20 minutes later: under the 10 PRD-06.R5 asks.
    const dir = mkdtempSync(join(tmpdir(), "timone-box-token-"));
    try {
      const { privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      });
      const keyPath = join(dir, "app.private-key.pem");
      writeFileSync(keyPath, privateKey, { mode: 0o600 });

      let now = new Date("2026-09-06T12:00:00Z");
      // Each token the fake forge mints lives one hour, as GitHub's do, and
      // is named for the time it was minted.
      const mint: MintCall = async () => ({
        token: `ghs_minted_at_${now.toISOString().slice(11, 16)}`,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });
      const credentials = githubAppCredentials({
        appId: 4670926,
        installationId: 155426497,
        privateKeyPath: keyPath,
        mint,
        now: () => now,
      });
      const { spawn, calls } = fakeContainer([started, result()]);
      const clock = handSleep();

      // The machine's own call, at noon: its token dies at 13:00.
      await credentials.tokenFor("fvermaut/scratch-app");

      // 37 minutes before that token dies, a box starts.
      now = new Date("2026-09-06T12:23:00Z");
      await containerRuntime({
        image: "timone-box:test",
        spawn,
        credentials,
        // The stack takes 8 minutes to come up, and there is none after.
        services: async () => {
          now = new Date(now.getTime() + 8 * 60 * 1000);
          return undefined;
        },
        // Never ticked, so the only token the box gets is the spawn's own.
        sleep: clock.sleep,
      }).start(request());

      const atStart = calls.find((call) => call.args[0] === "run")?.env?.GH_TOKEN;
      // At 12:31 the noon token has 29 minutes left, less than 20 + 15, so
      // the box gets a new one.
      expect(atStart).toBe("ghs_minted_at_12:31");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("takes the stack down again when no forge token can be minted", async () => {
    // The token is taken after the stack is up, so a refusal here must not
    // leave the stack running.
    let downs = 0;
    const { spawn, calls } = fakeContainer([started, result()]);

    await expect(
      containerRuntime({
        image: "timone-box:test",
        spawn,
        services: async () => ({
          network: "n",
          project: "p",
          services: ["db"],
          down: async () => {
            downs += 1;
          },
        }),
        credentials: {
          async tokenFor() {
            throw new Error("GitHub refused to mint a token");
          },
        },
      }).start(request()),
    ).rejects.toThrow(/refused to mint/);

    expect(downs).toBe(1);
    expect(calls.filter((call) => call.args[0] === "run")).toHaveLength(0);
  });

  it("passes the token by name, so it is in no argument vector", async () => {
    const clock = handSleep();
    const { spawn, calls } = fakeContainer([]);

    const refresh = keepForgeTokenFresh({
      spawn,
      name: "timone-ivtrends-1",
      repository: "fvermaut/ivtrends",
      credentials: {
        async tokenFor() {
          return "ghs_secret_value";
        },
      },
      sleep: clock.sleep,
    });

    await clock.tick();
    refresh.stop();

    const exec = calls.find((call) => call.args[0] === "exec")!;
    expect(exec.args).toContain("TIMONE_FORGE_TOKEN");
    expect(exec.args.join(" ")).not.toContain("ghs_secret_value");
    expect(exec.env?.TIMONE_FORGE_TOKEN).toBe("ghs_secret_value");
  });

  it("says so when it could not hand one over, and does not take the run down", async () => {
    // Silence is the thing that must not happen. A box whose token stopped
    // being refreshed loses every commit it makes from then on, which is
    // exactly how #56 lost a phase's work without anybody being told.
    const said: string[] = [];
    const clock = handSleep();
    const { spawn } = fakeContainer([]);

    const refresh = keepForgeTokenFresh({
      spawn,
      name: "timone-ivtrends-1",
      repository: "fvermaut/ivtrends",
      credentials: {
        async tokenFor() {
          throw new Error("the forge refused to mint");
        },
      },
      sleep: clock.sleep,
      log: (message) => void said.push(message),
    });

    await clock.tick();
    // Still going: one failure is not the end of the loop, because the next
    // attempt is what mends it.
    await clock.tick();
    refresh.stop();

    expect(said).toHaveLength(2);
    expect(said[0]).toContain("could not mint");
    expect(said[0]).toContain("the forge refused to mint");
  });

  it("stops refreshing once the run is over", async () => {
    const clock = handSleep();
    const { spawn, calls } = fakeContainer([started, result()]);

    const session = await containerRuntime({
      image: "timone-box:test",
      spawn,
      credentials: {
        async tokenFor() {
          return "ghs_boxed";
        },
      },
      sleep: clock.sleep,
    }).start(request());

    // The loop is genuinely waiting, so the assertion below is about it
    // having stopped rather than about it never having started.
    expect(clock.pending()).toBe(1);

    await session.completed;
    await clock.tick();

    // Nothing was written into a box that is being destroyed — a refresh
    // firing at a container on its way out is a docker failure reported as
    // if the token had stopped being renewed.
    expect(calls.filter((call) => call.args[0] === "exec")).toHaveLength(0);
  });

  it("refreshes nothing when the box was given no forge credential", async () => {
    const clock = handSleep();
    const { spawn } = fakeContainer([started, result()]);

    await containerRuntime({
      image: "timone-box:test",
      spawn,
      sleep: clock.sleep,
    }).start(request());

    expect(clock.pending()).toBe(0);
  });
});

/**
 * The `docker run` arguments and the box script as the code built them on
 * 2026-09-27, at commit 1b270ab, before a box could take a message
 * (timone#165, sub-phase 40d). Captured by running that code, not written
 * by hand: a request that is not interactive must still produce exactly
 * these, and the only honest source for "exactly" is the code as it was.
 *
 * The request is {@link request} and the container is named
 * `timone-scratch-app-1`; no credential, no stack, no run environment.
 */
const ARGS_BEFORE_40D: readonly string[] = [
  "run",
  "--name",
  "timone-scratch-app-1",
  "--init",
  "--shm-size=1g",
  "-e",
  "TIMONE_REMOTE",
  "-e",
  "TIMONE_COMMIT",
  "-e",
  "PROJECT_REMOTE",
  "-e",
  "PROJECT_BRANCH",
  "-e",
  "TIMONE_PROMPT",
  "-e",
  "TIMONE_MODEL",
  "-e",
  "BASH_DEFAULT_TIMEOUT_MS",
  "-e",
  "BASH_MAX_TIMEOUT_MS",
  "timone-box:test",
  "sh",
  "-c",
];

const SCRIPT_BEFORE_40D: string = [
  "set -e",
  "if [ -n \"${GH_TOKEN:-}\" ]; then",
  "  mkdir -p \"$HOME/.timone\" \"$HOME/.local/bin\"",
  "  ( umask 077; printf %s \"$GH_TOKEN\" > \"$HOME/.timone/gh-token\" )",
  "  git config --global credential.helper '!f() { echo \"username=x-access-token\"; echo \"password=$(cat \"$HOME/.timone/gh-token\")\"; }; f'",
  "  cat > \"$HOME/.local/bin/gh\" <<'TIMONE_GH_WRAPPER'",
  "#!/bin/sh",
  "GH_TOKEN=$(cat \"$HOME/.timone/gh-token\" 2>/dev/null)",
  "GITHUB_TOKEN=$GH_TOKEN",
  "export GH_TOKEN GITHUB_TOKEN",
  "exec /usr/local/bin/gh \"$@\"",
  "TIMONE_GH_WRAPPER",
  "  chmod 0755 \"$HOME/.local/bin/gh\"",
  "  export PATH=\"$HOME/.local/bin:$PATH\"",
  "fi",
  "git clone --quiet \"$TIMONE_REMOTE\" /workspace/timone",
  "git -C /workspace/timone checkout --quiet \"$TIMONE_COMMIT\" 2>/dev/null || {",
  "  echo \"the daemon is running Timone at $TIMONE_COMMIT, and that commit is not on the remote. A boxed run is built from the remotes, so it cannot follow a commit nobody has pushed. Push it, or run the daemon on a commit that is pushed.\" >&2",
  "  exit 78",
  "}",
  "mkdir -p /workspace/timone/projects",
  "git clone --quiet \"$PROJECT_REMOTE\" /workspace/timone/projects/scratch-app",
  "git -C /workspace/timone/projects/scratch-app checkout --quiet \"$PROJECT_BRANCH\" 2>/dev/null || true",
  "cd /workspace/timone",
  "timone_reason() {",
  "  sed -e 's/^npm \\(error\\|ERR!\\) *//' \"$1\" |",
  "    grep -v '^[[:space:]]*$' |",
  "    grep -v '^A complete log of this run' |",
  "    head -3 | tr '\\n' ' ' | cut -c 1-300",
  "}",
  "npm ci --no-audit --no-fund > /tmp/timone-npm-ci.log 2>&1 || {",
  "  echo \"could not install Timone's dependencies in the box, so its guardrail hooks would not run. Refusing to work without them. npm said: $(timone_reason /tmp/timone-npm-ci.log)\" >&2",
  "  exit 79",
  "}",
  "npm run build > /tmp/timone-npm-build.log 2>&1 || {",
  "  echo \"could not build Timone in the box, so its guardrail hooks would not run. Refusing to work without them. The build said: $(timone_reason /tmp/timone-npm-build.log)\" >&2",
  "  exit 79",
  "}",
  "if [ -f \"/workspace/timone/projects/scratch-app/package.json\" ]; then",
  "  cd /workspace/timone/projects/scratch-app",
  "  if [ -f package-lock.json ]; then",
  "    npm ci --no-audit --no-fund > /tmp/timone-project-install.log 2>&1 ||",
  "      npm install --no-audit --no-fund > /tmp/timone-project-install.log 2>&1 || {",
  "      echo \"could not install the project's dependencies in the box, so the run has to install them itself before it can validate anything. npm said: $(timone_reason /tmp/timone-project-install.log)\" >&2",
  "    }",
  "  else",
  "    npm install --no-audit --no-fund > /tmp/timone-project-install.log 2>&1 || {",
  "      echo \"could not install the project's dependencies in the box, so the run has to install them itself before it can validate anything. npm said: $(timone_reason /tmp/timone-project-install.log)\" >&2",
  "    }",
  "  fi",
  "  cd /workspace/timone",
  "fi",
  "printf \"%s\" \"$TIMONE_PROMPT\" | exec claude -p --output-format stream-json --verbose --include-partial-messages --model \"$TIMONE_MODEL\" --permission-mode bypassPermissions ${TIMONE_EFFORT:+--effort \"$TIMONE_EFFORT\"}",
].join("\n");

/**
 * A box the runner can speak to while a step runs (timone#165, sub-phase
 * 40d).
 *
 * **Only an interactive request changes anything.** Every stage the daemon
 * runs today sends its prompt once and waits, and that path must stay exactly
 * as it was: the box script is the most expensive thing to get wrong in the
 * whole daemon, and each line of it was earned by a real run failing.
 */
describe("a box that can take a message while a step runs", () => {
  function interactiveRequest(): SessionRequest {
    return sessionRequest({
      cwd: "/root",
      prompt: "do the thing",
      model: "claude-opus-5",
      interactive: true,
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

  /** A user message, as the CLI prints one back when it takes it. */
  function replayOf(text: string): string {
    return line({
      type: "user",
      message: { role: "user", content: [{ type: "text", text }] },
      parent_tool_use_id: null,
      session_id: "sess-1",
      isReplay: true,
    });
  }

  /**
   * A box the test talks to as the CLI would: the test prints each line of
   * its stdout, and reads what the runtime wrote to its stdin.
   *
   * Two things are modelled on the real CLI, because the runtime depends on
   * both. **It says nothing until its first message arrives** — its `init`
   * opens a turn, and there is no turn before there is a message. And **it
   * exits once its stdin is closed and nothing is left to print**, which is
   * how a session that takes messages ends at all.
   *
   * It has a stdin only when the spawn asked for one, as `docker` does.
   */
  function liveContainer(): {
    spawn: ContainerSpawn;
    calls: { args: string[]; env?: Record<string, string> }[];
    print: (text: string) => void;
    written: () => string[];
    ended: () => boolean;
  } {
    const calls: { args: string[]; env?: Record<string, string> }[] = [];
    const written: string[] = [];
    const queue: string[] = [];
    let ended = false;
    let wake: (() => void) | undefined;
    const nudge = () => {
      wake?.();
      wake = undefined;
    };
    const print = (text: string) => {
      queue.push(text);
      nudge();
    };
    let resolveExit!: (value: ContainerExit) => void;
    const exit = new Promise<ContainerExit>((resolve) => {
      resolveExit = resolve;
    });

    const spawn: ContainerSpawn = (_command, args, options) => {
      calls.push({ args, ...(options?.env === undefined ? {} : { env: options.env }) });
      if (args[0] !== "run") return oneShot();
      return {
        lines: (async function* () {
          for (;;) {
            const next = queue.shift();
            if (next !== undefined) {
              yield next;
              continue;
            }
            if (ended) break;
            await new Promise<void>((resolve) => {
              wake = resolve;
            });
          }
          resolveExit({ code: 0, signal: null, stderr: "" });
        })(),
        exit,
        kill: () => resolveExit({ code: null, signal: "SIGKILL", stderr: "" }),
        ...(options?.stdin !== "pipe"
          ? {}
          : {
              stdin: {
                write: (text: string) => {
                  if (written.length === 0) print(started);
                  written.push(text);
                },
                end: () => {
                  ended = true;
                  nudge();
                },
              },
            }),
      };
    };

    return {
      spawn,
      calls,
      print,
      written: () => [...written],
      ended: () => ended,
    };
  }

  it("hands the prompt to an interactive box as its first message, on stdin", async () => {
    const box = liveContainer();

    const session = await runtimeWith(box.spawn).start(interactiveRequest());

    const run = box.calls.find((call) => call.args[0] === "run")!;
    // `-i` is a `docker run` flag, so it has to come before the image: after
    // it, it would be an argument to `sh`.
    expect(run.args).toContain("-i");
    expect(run.args.indexOf("-i")).toBeLessThan(run.args.indexOf("timone-box:test"));
    const script = run.args.at(-1)!;
    expect(script).toContain("--input-format stream-json");
    expect(script).not.toContain('printf "%s" "$TIMONE_PROMPT"');
    expect(run.env?.TIMONE_PROMPT).toBeUndefined();

    const first = box.written()[0]!;
    expect(first.endsWith("\n")).toBe(true);
    expect(JSON.parse(first)).toEqual({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: expect.stringMatching(/^You are running inside a container[\s\S]*\n\ndo the thing$/),
          },
        ],
      },
    });
    expect(session.sessionId).toBe("sess-1");
  });

  it("writes a message sent to the session as another user message", async () => {
    const box = liveContainer();
    const session = await runtimeWith(box.spawn).start(interactiveRequest());

    session.send!("x");

    expect(box.written()).toHaveLength(2);
    expect(box.written()[1]).toBe(
      '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"x"}]}}\n',
    );
  });

  it("closes the box's stdin once a result arrives with nothing sent since, so the session ends", async () => {
    const box = liveContainer();
    const session = await runtimeWith(box.spawn).start(interactiveRequest());

    box.print(replayOf("the prompt"));
    box.print(result());

    await vi.waitFor(() => expect(box.ended()).toBe(true));
    expect((await session.completed).ok).toBe(true);
  });

  it("keeps stdin open past a result while a message sent before it has not been taken", async () => {
    const box = liveContainer();
    const session = await runtimeWith(box.spawn).start(interactiveRequest());

    box.print(replayOf("the prompt"));
    session.send!("also check the README");
    box.print(result());
    // The first result has been read…
    await vi.waitFor(() => expect(session.progress?.summary()).toBeDefined());
    // …and the box is still listening: the CLI queued the message for a turn
    // of its own, and closing now would end the session before that turn.
    expect(box.ended()).toBe(false);

    box.print(replayOf("also check the README"));
    box.print(result());

    await vi.waitFor(() => expect(box.ended()).toBe(true));
    expect((await session.completed).ok).toBe(true);
    // The CLI says which messages it has taken only when it is asked to.
    const run = box.calls.find((call) => call.args[0] === "run")!;
    expect(run.args.at(-1)).toContain("--replay-user-messages");
  });

  it("ends at the first result when the message sent was taken into the turn still running", async () => {
    // The CLI adds a message that arrives mid-turn to that turn's next model
    // call, so one result closes both messages. A box that waited for a
    // result per message would wait here for ever.
    const box = liveContainer();
    const session = await runtimeWith(box.spawn).start(interactiveRequest());

    box.print(replayOf("the prompt"));
    session.send!("also check the README");
    box.print(replayOf("also check the README"));
    box.print(result());

    await vi.waitFor(() => expect(box.ended()).toBe(true));
    expect((await session.completed).ok).toBe(true);
  });

  it("builds exactly today's arguments and script for a request that is not interactive", async () => {
    const { spawn, calls } = fakeContainer([started, result()]);

    await (
      await containerRuntime({
        image: "timone-box:test",
        spawn,
        nameFor: () => "timone-scratch-app-1",
      }).start(request())
    ).completed;

    const run = calls.find((call) => call.args[0] === "run")!;
    expect(run.args.slice(0, -1)).toEqual(ARGS_BEFORE_40D);
    // ✏ 43a: the one change since is the push guard, installed just before
    // the CLI starts. ✏ 43b: and the check at the top of the `gh` wrapper.
    // Everything else is the script as 40d left it.
    const lines = SCRIPT_BEFORE_40D.split("\n");
    const wrapperStart = lines.indexOf("#!/bin/sh") + 1;
    expect(run.args.at(-1)).toBe(
      [
        ...lines.slice(0, wrapperStart),
        ...FORGE_CALL_LINES,
        ...lines.slice(wrapperStart, -1),
        ...PUSH_GUARD_LINES,
        ...lines.slice(-1),
      ].join("\n"),
    );
  });
});

/**
 * The lines 43a puts into the box script, written out by hand: the guard is
 * installed through Timone's own command, the box stops if that fails, and
 * the three variables that switch it on are exported for the CLI.
 */
const PUSH_GUARD_LINES: readonly string[] = [
  'node /workspace/timone/dist/cli.js guardrails install-push-guard --dir "$HOME/.timone/git-hooks"' +
    ' ${TIMONE_RUN_BRANCH:+--branch "$TIMONE_RUN_BRANCH"} > /tmp/timone-push-guard.log 2>&1 || {',
  '  echo "could not install the guard that keeps this run\'s pushes on its own work branch.' +
    " Refusing to work without it." +
    ' It said: $(timone_reason /tmp/timone-push-guard.log)" >&2',
  "  exit 79",
  "}",
  'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0="$HOME/.timone/git-hooks"',
];

/**
 * The lines 43b puts at the top of the box's `gh` wrapper, written out by
 * hand: no `gh` call runs before Timone is built, and every one is checked
 * by Timone's own command first.
 */
const FORGE_CALL_LINES: readonly string[] = [
  "[ -f /workspace/timone/dist/cli.js ] || {",
  '  echo "Refused: Timone\'s guard on gh calls is not built yet, so this gh call does not run." >&2',
  "  exit 1",
  "}",
  "node /workspace/timone/dist/cli.js guardrails forge-call" +
    ' ${TIMONE_RUN_BRANCH:+--branch "$TIMONE_RUN_BRANCH"} -- "$@" < /dev/null || exit 1',
];

/**
 * A run's `git push` reaches its own work branch and nothing else (#85, 43a).
 * The guard is only as good as the place it is switched on, and in a box that
 * place is the script.
 */
describe("the guard on a boxed run's pushes", () => {
  function boxScriptOf(calls: { args: string[] }[]): string {
    const run = calls.find((call) => call.args[0] === "run")!;
    return run.args[run.args.length - 1];
  }

  async function boxed(workBranch?: string) {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({ image: "timone-box:test", spawn }).start(
      workBranch === undefined ? request() : { ...request(), workBranch },
    );
    const run = calls.find((call) => call.args[0] === "run")!;
    return { args: run.args, env: run.env, script: boxScriptOf(calls) };
  }

  it("is installed after the project's install and before the CLI starts", async () => {
    const { script } = await boxed("timone/7-the-page-feels-slow");

    const installed = script.indexOf("guardrails install-push-guard");
    expect(installed).toBeGreaterThan(script.indexOf("/tmp/timone-project-install.log"));
    expect(installed).toBeLessThan(script.indexOf("exec claude"));
  });

  it("is switched on for every git the session runs", async () => {
    const { script } = await boxed("timone/7-the-page-feels-slow");

    const exported = script.indexOf(
      'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0="$HOME/.timone/git-hooks"',
    );
    expect(exported).toBeGreaterThan(script.indexOf("guardrails install-push-guard"));
    expect(exported).toBeLessThan(script.indexOf("exec claude"));
  });

  it("names the work branch only when the box was given one", async () => {
    const { script } = await boxed("timone/7-the-page-feels-slow");

    expect(script).toContain('${TIMONE_RUN_BRANCH:+--branch "$TIMONE_RUN_BRANCH"}');
    expect(script).not.toMatch(/--branch "\$TIMONE_RUN_BRANCH"(?!\})/);
  });

  it("stops the box when it cannot be installed, as a failed build of Timone does", async () => {
    const { script } = await boxed("timone/7-the-page-feels-slow");

    const after = script.slice(script.indexOf("guardrails install-push-guard"));
    expect(after.slice(0, after.indexOf("exec claude"))).toContain("exit 79");
  });

  it("hands the box the run's work branch, by name", async () => {
    const { args, env } = await boxed("timone/7-the-page-feels-slow");

    expect(args.join(" ")).toContain("-e TIMONE_RUN_BRANCH");
    expect(env?.TIMONE_RUN_BRANCH).toBe("timone/7-the-page-feels-slow");
  });

  it("hands the box no work branch when the step has none", async () => {
    const { args, env } = await boxed();

    expect(args).not.toContain("TIMONE_RUN_BRANCH");
    expect(env?.TIMONE_RUN_BRANCH).toBeUndefined();
  });
});

/**
 * A run cannot write to a branch or merge through the forge's API either
 * (#85, 43b). Every `gh` the session runs in a box is the wrapper the script
 * writes, so the wrapper is where the check is switched on.
 */
describe("the guard on a boxed run's gh calls", () => {
  /** Timone's command line as it ships; built before these tests run. */
  const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** The `gh` wrapper, as the box script writes it. */
  async function boxedWrapper(): Promise<string> {
    const { spawn, calls } = fakeContainer([started, result()]);
    await containerRuntime({ image: "timone-box:test", spawn }).start(request());
    const run = calls.find((call) => call.args[0] === "run")!;
    const script = run.args[run.args.length - 1];
    const start = script.indexOf("<<'TIMONE_GH_WRAPPER'\n") + "<<'TIMONE_GH_WRAPPER'\n".length;
    return script.slice(start, script.indexOf("\nTIMONE_GH_WRAPPER", start));
  }

  /**
   * Run the wrapper outside a box. Its two fixed paths — Timone's CLI and the
   * real `gh` — are moved to `cli` and to a fake `gh` that writes down what
   * it was called with. `HOME` is a temp directory holding the token file.
   */
  function runWrapper(wrapper: string, cli: string, args: string[]) {
    const root = mkdtempSync(join(tmpdir(), "timone-box-gh-"));
    tempDirs.push(root);
    const home = join(root, "home");
    mkdirSync(join(home, ".timone"), { recursive: true });
    writeFileSync(join(home, ".timone", "gh-token"), "ghs_boxed");
    const called = join(root, "called");
    const realGh = join(root, "real-gh");
    writeFileSync(realGh, `#!/bin/sh\necho "$GH_TOKEN $*" > '${called}'\n`, { mode: 0o755 });
    const path = join(root, "gh");
    writeFileSync(
      path,
      wrapper
        .replaceAll("/workspace/timone/dist/cli.js", cli)
        .replaceAll("/usr/local/bin/gh", realGh),
      { mode: 0o755 },
    );
    const ran = spawnSync(path, args, {
      env: { ...process.env, HOME: home, TIMONE_RUN_BRANCH: "timone/7-x" },
      encoding: "utf8",
    });
    return {
      status: ran.status,
      stderr: ran.stderr,
      realGhGot: existsSync(called) ? readFileSync(called, "utf8").trim() : undefined,
    };
  }

  it("checks the call before it hands over to the real gh", async () => {
    const wrapper = await boxedWrapper();

    const checked = wrapper.indexOf(
      'guardrails forge-call ${TIMONE_RUN_BRANCH:+--branch "$TIMONE_RUN_BRANCH"} -- "$@"',
    );
    expect(checked).toBeGreaterThan(-1);
    expect(checked).toBeLessThan(wrapper.indexOf('exec /usr/local/bin/gh "$@"'));
  });

  it("refuses a merge, and the real gh never runs", async () => {
    const ran = runWrapper(await boxedWrapper(), CLI, ["pr", "merge", "12", "--squash"]);

    expect(ran.status).toBe(1);
    expect(ran.stderr).toContain("Refused: `gh pr merge`");
    expect(ran.realGhGot).toBeUndefined();
  });

  it("hands a comment to the real gh, with the token", async () => {
    const ran = runWrapper(await boxedWrapper(), CLI, ["issue", "comment", "85", "--body", "hi"]);

    expect(ran.status).toBe(0);
    expect(ran.realGhGot).toBe("ghs_boxed issue comment 85 --body hi");
  });

  it("refuses every call while Timone is not built yet", async () => {
    const root = mkdtempSync(join(tmpdir(), "timone-box-unbuilt-"));
    tempDirs.push(root);

    const ran = runWrapper(await boxedWrapper(), join(root, "dist", "cli.js"), [
      "issue", "comment", "85", "--body", "hi",
    ]);

    expect(ran.status).toBe(1);
    expect(ran.stderr).toContain("not built yet");
    expect(ran.realGhGot).toBeUndefined();
  });
});
