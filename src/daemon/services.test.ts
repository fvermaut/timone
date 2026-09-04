import { describe, expect, it } from "vitest";

import type { CommandOptions, CommandRunner } from "../adapters/command-runner.js";
import { bringUpServices, COMPOSE_FILES, type ServiceStack } from "./services.js";

interface Invocation {
  command: string;
  args: string[];
  options?: CommandOptions;
}

const project = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

/** A recording runner that can be told how to answer particular calls. */
function fakeRunner(): {
  run: CommandRunner;
  calls: Invocation[];
  on(match: (call: Invocation) => boolean, reply: string | Error): void;
  vector(verb: string): string[] | undefined;
} {
  const calls: Invocation[] = [];
  const stubs: { match: (call: Invocation) => boolean; reply: string | Error }[] =
    [];

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
    on: (match, reply) => void stubs.push({ match, reply }),
    vector: (verb) => calls.find((call) => call.args.includes(verb))?.args,
  };
}

/** Bring a stack up with everything faked but the decisions under test. */
function bringUp(
  overrides: {
    run?: CommandRunner;
    present?: readonly string[];
    written?: { path: string; body: string }[];
    log?: (message: string) => void;
  } = {},
): Promise<ServiceStack | undefined> {
  const { run } = overrides.run === undefined ? fakeRunner() : { run: overrides.run };
  return bringUpServices({
    ...(overrides.log === undefined ? {} : { log: overrides.log }),
    project,
    branch: "timone/7-slow",
    runId: "scratch-app#7/1",
    root: "/root",
    run,
    token: "ghs_boxed",
    exists: (path) =>
      (overrides.present ?? [`compose.yaml`]).some((name) => path.endsWith(name)),
    write: (path, body) => overrides.written?.push({ path, body }),
    // Injected like the other two, and it has to be. Without it the real
    // `rmSync` runs against the fixture root — `/root` — which on macOS does
    // not exist and is a silent no-op, and in a container exists and is not
    // writable. Fourteen of these tests passed here and failed in CI on its
    // first run, which is exactly the difference CI is for.
    remove: () => {},
  });
}

describe("the services a boxed run reaches", () => {
  it("brings the stack up and waits for it before the session starts", async () => {
    // Case (1). `--wait` is the whole of it: a session that starts against a
    // database still initialising fails in a way that reads as the agent's
    // fault.
    const runner = fakeRunner();

    await bringUp({ run: runner.run });

    const up = runner.vector("up");
    expect(up).toBeDefined();
    expect(up).toContain("--wait");
    expect(up).toContain("-d");
  });

  it("publishes no port to the host", async () => {
    // The difference between this and a preview. A boxed run reaches its
    // services by name on a private network; a published port would put the
    // stack on fvermaut's machine, where it can collide with whatever he is
    // already running on 3000.
    const written: { path: string; body: string }[] = [];
    const runner = fakeRunner();
    runner.on(
      (call) => call.args.includes("config"),
      "app\ndb\n",
    );

    await bringUp({ run: runner.run, written });

    const override = written.find((file) => file.path.endsWith(COMPOSE_FILES.override));
    expect(override).toBeDefined();
    expect(override!.body).toContain("app:");
    expect(override!.body).toContain("db:");
    // `!reset` replaces the project's own list rather than appending to it,
    // which is what a bare `ports: []` in an override does.
    expect(override!.body).toContain("ports: !reset []");
  });

  it("fails with a readable reason when the stack never becomes healthy", async () => {
    // Case (2). Never a hung poll cycle: `--wait` has a timeout and the
    // failure carries what compose said.
    const runner = fakeRunner();
    runner.on(
      (call) => call.args.includes("up"),
      new Error("container scratch-app-db-1 is unhealthy"),
    );

    await expect(bringUp({ run: runner.run })).rejects.toThrow(
      /never became healthy[\s\S]*unhealthy/,
    );
  });

  it("tears the stack down when it failed to come up", async () => {
    // Case (3), the path that leaks: a half-started stack holds a network and
    // volumes that the next run on the same project cannot take back.
    const runner = fakeRunner();
    runner.on((call) => call.args.includes("up"), new Error("no"));

    await bringUp({ run: runner.run }).catch(() => undefined);

    expect(runner.vector("down")).toBeDefined();
  });

  it("tears the stack down, with its volumes, when asked", async () => {
    const runner = fakeRunner();

    const stack = await bringUp({ run: runner.run });
    await stack!.down();

    const down = runner.vector("down");
    expect(down).toContain("-v");
    expect(down).toContain("--remove-orphans");
  });

  it("names the profile when taking the stack down, or it takes nothing down", async () => {
    // Watched live on 2026-08-22, and it is the worst shape a bug can have:
    // `docker compose down` with no `COMPOSE_PROFILES` **exits 0 and removes
    // nothing**, because a service declared under a profile is invisible to
    // compose without it. `--remove-orphans` does not save it. A teardown
    // that reports success and leaks the container, the network and the
    // volumes is how a machine fills up quietly.
    const runner = fakeRunner();

    const stack = await bringUp({ run: runner.run });
    await stack!.down();

    const down = runner.calls.find((call) => call.args.includes("down"));
    expect(down?.options?.env?.COMPOSE_PROFILES).toBe("app");
  });

  it("does NOT name the profile when bringing the stack up", async () => {
    // The reverse of the test above, and the reverse of what this used to
    // assert (#60). The profile is right for `down` and wrong for `up`: it
    // pulls the profile-gated `app` service into the stack a run stands up,
    // and `app` is `build: .`. Every boxed run on `ivtrends` built a
    // production image of the whole application before the agent did
    // anything — 190 seconds against 5 for the database alone, longer than
    // any deadline it was given, so no run could start at all.
    //
    // Nothing wanted that image: a boxed run clones the project and builds
    // and runs it inside the box. What it needs beside it is the database.
    const runner = fakeRunner();

    await bringUp({ run: runner.run });

    const up = runner.calls.find((call) => call.args.includes("up"));
    expect(up?.options?.env?.COMPOSE_PROFILES).toBeUndefined();

    const config = runner.calls.find((call) => call.args.includes("config"));
    expect(config?.options?.env?.COMPOSE_PROFILES).toBeUndefined();
  });

  it("gives the stack longer to come up than it told it to wait", async () => {
    // These two numbers lived in different files and could not both be true:
    // compose was told to wait 180s by `services.ts` and killed at 90s by the
    // runner's own default, so the 180 was unreachable by construction (#60).
    const runner = fakeRunner();

    await bringUp({ run: runner.run });

    const up = runner.calls.find((call) => call.args.includes("up"))!;
    const waitSeconds = Number(up.args[up.args.indexOf("--wait-timeout") + 1]);

    expect(waitSeconds).toBeGreaterThan(0);
    expect(up.options?.timeoutMs).toBeGreaterThan(waitSeconds * 1000);
  });

  it("says a deadline was a deadline, rather than calling the stack unhealthy", async () => {
    // The wording that sent a reader to compose files and healthchecks that
    // were correct. A command killed on our own deadline has told us nothing
    // about the stack's health (#60).
    const runner = fakeRunner();
    runner.on(
      (call) => call.args.includes("up"),
      new Error("docker compose up failed after 3 attempts: gave no answer within 240s and was killed"),
    );

    const said = await bringUp({ run: runner.run }).then(
      () => "it did not fail at all",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );

    expect(said).toMatch(/took longer than/i);
    expect(said).toMatch(/deadline, not a verdict/i);
    expect(said).not.toMatch(/never became healthy/i);
  });

  it("stands nothing up for a project that commits no compose file", async () => {
    // ✏ **This used to be a refusal, and phase 32 made it a statement.** Not
    // every managed project is an application with a database beside it:
    // Timone is a command-line program with no services at all (ADR-0050 D1),
    // and a rule about every project would have made every self-run
    // impossible to start.
    await expect(bringUp({ present: [] })).resolves.toBeUndefined();
  });

  it("says so on the daemon's log, naming what to add if it was an omission", async () => {
    // The message that used to be a refusal keeps its job: a project that
    // *should* have committed one tells whoever reads the log, once.
    const said: string[] = [];
    await bringUp({ present: [], log: (message) => said.push(message) });

    expect(said.join("\n")).toMatch(/compose\.yaml/);
    expect(said.join("\n")).toMatch(/nothing is stood up/i);
  });

  it("leaves nothing behind when there is no compose file", async () => {
    // The clone it made to look for one. A source left in `.timone/stacks/`
    // is the next run on the same project starting from stale code.
    const removed: string[] = [];
    await bringUpServices({
      project,
      branch: "timone/7-slow",
      runId: "scratch-app#7/1",
      root: "/root",
      run: fakeRunner().run,
      exists: () => false,
      write: () => {},
      remove: (path) => removed.push(path),
    });

    expect(removed.some((path) => path.includes("/.timone/stacks/"))).toBe(true);
  });

  it("accepts any of the names compose itself accepts", async () => {
    for (const name of COMPOSE_FILES.accepted) {
      await expect(bringUp({ present: [name] })).resolves.toBeDefined();
    }
  });

  it("gives each run its own compose project, so two runs share no network", async () => {
    // Case (5). Two runs on different projects on one machine would otherwise
    // reach each other's databases by service name — the names are identical.
    const first = fakeRunner();
    const second = fakeRunner();

    await bringUpServices({
      project,
      branch: "timone/7-slow",
      runId: "scratch-app#7/1",
      root: "/root",
      run: first.run,
      exists: () => true,
      write: () => {},
      remove: () => {},
    });
    await bringUpServices({
      project: { name: "ivtrends", repoUrl: "https://github.com/fvermaut/ivtrends.git" },
      branch: "timone/1-charts",
      runId: "ivtrends#1/1",
      root: "/root",
      run: second.run,
      exists: () => true,
      write: () => {},
      remove: () => {},
    });

    const nameOf = (args: string[]): string => args[args.indexOf("-p") + 1];
    expect(nameOf(first.vector("up")!)).not.toBe(nameOf(second.vector("up")!));
  });

  it("names the network the agent's container joins", async () => {
    const stack = await bringUp();

    expect(stack!.network).toContain("scratch-app");
    expect(stack!.network.endsWith("_default")).toBe(true);
  });
});

describe("getting the project's source without touching the human's checkout", () => {
  it("clones from the remote into the daemon's own state directory", async () => {
    const runner = fakeRunner();

    await bringUp({ run: runner.run });

    const clone = runner.calls.find((call) => call.args.includes("clone"));
    expect(clone?.command).toBe("git");
    expect(clone?.args.join(" ")).toContain("/root/.timone/stacks/");
    // Never `projects/` — that folder is fvermaut's (ADR-0043), and this is
    // the daemon's own scratch space, beside the previews.
    expect(clone?.args.join(" ")).not.toContain("/projects/");
  });

  it("clones the branch the run works on", async () => {
    const runner = fakeRunner();

    await bringUp({ run: runner.run });

    expect(runner.calls.find((call) => call.args.includes("clone"))?.args).toContain(
      "timone/7-slow",
    );
  });

  it("falls back to the default branch when the run's branch does not exist yet", async () => {
    // Watched live on `ivtrends` #1, 2026-08-23. A run's work branch is cut by
    // the first session that owns one and pushed from inside the box — so at
    // this point, on the very first stage that owns a branch, it does not
    // exist and git says `Remote branch ... not found in upstream origin`.
    // Refusing there makes a boxed run impossible to start on a fresh branch.
    const runner = fakeRunner();
    runner.on(
      (call) => call.args.includes("--branch"),
      new Error("fatal: Remote branch timone/7-slow not found in upstream origin"),
    );

    await expect(bringUp({ run: runner.run })).resolves.toBeDefined();

    const clones = runner.calls.filter((call) => call.args.includes("clone"));
    expect(clones).toHaveLength(2);
    expect(clones[1].args).not.toContain("--branch");
    // Still shallow, and still into the daemon's own scratch space.
    expect(clones[1].args).toContain("--depth");
    expect(clones[1].args.join(" ")).toContain("/root/.timone/stacks/");
  });

  it("reports the real reason when the fallback clone fails too", async () => {
    // The `catch` must not swallow a bad credential or a missing repository.
    // Both calls fail for the same reason, and the second one's message is
    // what the human is told.
    const runner = fakeRunner();
    runner.on(
      (call) => call.args.includes("clone"),
      new Error("fatal: could not read Username for 'https://github.com'"),
    );

    await expect(bringUp({ run: runner.run })).rejects.toThrow(
      /could not read Username/,
    );
  });

  it("carries the credential in the environment, never in the URL it logs", async () => {
    const runner = fakeRunner();

    await bringUp({ run: runner.run });

    const clone = runner.calls.find((call) => call.args.includes("clone"))!;
    expect(clone.args.join(" ")).not.toContain("ghs_boxed");
    expect(JSON.stringify(clone.options?.env)).toContain("ghs_boxed");
  });

  it("removes the clone when the stack comes down", async () => {
    const removed: string[] = [];
    const runner = fakeRunner();

    const stack = await bringUpServices({
      project,
      branch: "timone/7-slow",
      runId: "scratch-app#7/1",
      root: "/root",
      run: runner.run,
      exists: () => true,
      write: () => {},
      remove: (path) => removed.push(path),
    });
    await stack!.down();

    expect(removed.some((path) => path.includes("/.timone/stacks/"))).toBe(true);
  });
});
