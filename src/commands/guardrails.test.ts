import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import type { Manifest } from "../manifest.js";
import type { Violation } from "../daemon/hooks.js";
import { RunStore } from "../daemon/runs.js";
import { declareStage } from "../daemon/declared-stage.js";
import { sessionRequest, type SessionRuntime } from "../daemon/session.js";
import { startStepSession } from "../daemon/step-session.js";
import {
  appendJournal,
  readHookPayload,
  registerGuardrailsCommand,
  runBaseline,
  runCheck,
  runForSession,
  runGuard,
  sessionRun,
} from "./guardrails.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const manifest: Manifest = {
  projects: {
    "scratch-app": {
      repo_url: "https://github.com/fvermaut/scratch-app.git",
      path: "projects/scratch-app",
      stack: [],
      bindings: { ticketing: "github" },
    },
  },
};

/** A commit message carrying the provenance trailer every session owes. */
function trailed(subject: string, sessionId: string): string {
  return `${subject}\n\nTimone-Stage: interactive\nTimone-Session: ${sessionId}`;
}

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

/**
 * A timone root with a real git repo in it, plus a real clone of a bare
 * "remote" as `projects/<project>` (`projects/scratch-app` unless named).
 *
 * Real repos rather than fabricated evidence, because this slice's risk is
 * not in the rules — those are pure functions and already shown red — but in
 * the plumbing between two processes: does the baseline survive, does the
 * evidence come back, does the session id find its run.
 */
function workspace(project = "scratch-app"): { root: string; projectDir: string } {
  const dir = mkdtempSync(join(tmpdir(), "timone-guardrails-"));
  tempDirs.push(dir);
  const root = join(dir, "timone");
  mkdirSync(root, { recursive: true });

  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "t");
  writeFileSync(join(root, "README.md"), "timone\n");
  // The real root ignores both, and the containment rule reads the working
  // tree — a fixture without them would report the workspace's own machinery
  // as stray files, which is a property of the fixture and not of the rule.
  writeFileSync(join(root, ".gitignore"), "projects/\n.timone/\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "first");
  // The root has a remote too, and pushing its first commit matters: without
  // one, `--not --remotes=origin` calls every commit in the fixture unpushed,
  // and a test asserting silence would be arguing with the fixture rather
  // than with the rule.
  const workspaceRemote = join(dir, "timone.git");
  git(dir, "init", "-q", "--bare", workspaceRemote);
  git(root, "remote", "add", "origin", workspaceRemote);
  git(root, "push", "-q", "origin", "main");

  // A bare remote, then a clone of it, so "unpushed" is a real question.
  const remote = join(dir, `project-${project}.git`);
  git(dir, "init", "-q", "--bare", remote);
  const projectDir = join(root, "projects", project);
  mkdirSync(join(root, "projects"), { recursive: true });
  git(dir, "clone", "-q", remote, projectDir);
  git(projectDir, "config", "user.email", "t@example.com");
  git(projectDir, "config", "user.name", "t");
  writeFileSync(join(projectDir, "README.md"), "app\n");
  git(projectDir, "add", "-A");
  git(projectDir, "commit", "-q", "-m", "first");
  git(projectDir, "push", "-q", "origin", "HEAD:main");

  return { root, projectDir };
}

function newStore(root: string): RunStore {
  let tick = 0;
  return RunStore.open(join(root, ".timone", "state.json"), {
    now: () => `2026-08-06T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

interface StopResult {
  account: string;
  returned: Violation[];
  printed: string[];
  journalled: string[];
}

/** One `Stop`, with what each audience saw at it. */
async function stopOnce(
  root: string,
  sessionId: string,
  store: RunStore,
): Promise<StopResult> {
  const printed: string[] = [];
  const journalled: string[] = [];
  const outcome = await runCheck({
    root,
    manifest,
    store,
    sessionId,
    // Never the test process's own: a `TIMONE_RUN_*` set there would turn
    // every person's session below into a boxed run's.
    env: {},
    print: (message) => printed.push(message),
    journal: (line) => journalled.push(line),
  });
  return { ...outcome, printed, journalled };
}

/**
 * Bracket a session: baseline, do `work`, then stop **twice**.
 *
 * Two stops because ADR-0027 gives the session one chance before anything
 * reaches a human — so a single stop shows only what the session was told,
 * and every test below asking "does this finding reach the human" needs the
 * round after it. `Stop` fires at the end of every assistant turn, so a
 * session that is told something and does not fix it reaches the second stop
 * by simply carrying on, which is what these two calls are.
 */
async function bracket(
  root: string,
  sessionId: string,
  store: RunStore,
  work: () => void,
): Promise<StopResult & { first: StopResult }> {
  await runBaseline({
    root,
    manifest,
    sessionId,
    now: new Date("2026-08-06T10:00:00Z"),
  });
  work();
  const first = await stopOnce(root, sessionId, store);
  const second = await stopOnce(root, sessionId, store);
  return { ...second, first };
}

describe("reading the hook payload", () => {
  it("takes the session id off the payload", async () => {
    const payload = await readHookPayload(
      Readable.from([JSON.stringify({ session_id: "abc", cwd: "/root" })]),
    );

    expect(payload?.session_id).toBe("abc");
  });

  it("yields nothing rather than throwing on rubbish", async () => {
    // This runs as a hook on every session. A guardrail that can break a
    // session is a worse failure than one that occasionally cannot judge it.
    expect(await readHookPayload(Readable.from(["not json"]))).toBeUndefined();
    expect(await readHookPayload(Readable.from(["{}"]))).toBeUndefined();
    expect(await readHookPayload(Readable.from([""]))).toBeUndefined();
  });
});

describe("guarding the verifier's probes", () => {
  /** A ledger holding one run for `session-abc`, parked at `stage`. */
  const ledgerAt = (root: string, stage: "execution" | "verification"): RunStore => {
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");
    store.setStage(run.id, stage);
    return store;
  };

  it("says nothing about a tool call that touches no probe", () => {
    const { root } = workspace();
    expect(
      runGuard({
        store: ledgerAt(root, "execution"),
        sessionId: "session-abc",
        env: {},
        toolInput: { file_path: "src/index.ts" },
      }),
    ).toBeUndefined();
  });

  it("refuses a build run the probe directory", () => {
    const { root } = workspace();
    const reply = runGuard({
      store: ledgerAt(root, "execution"),
      sessionId: "session-abc",
      env: {},
      toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
    });

    expect(JSON.parse(reply ?? "{}")).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
      },
    });
  });

  it("lets the verification run that owns them through", () => {
    const { root } = workspace();
    const reply = runGuard({
      store: ledgerAt(root, "verification"),
      sessionId: "session-abc",
      env: {},
      toolInput: { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" },
    });

    expect(JSON.parse(reply ?? "{}").hookSpecificOutput.permissionDecision).toBe(
      "allow",
    );
  });

  it("asks when no run drove the session, because a human is at the keyboard", () => {
    const { root } = workspace();
    const reply = runGuard({
      store: newStore(root),
      sessionId: "session-nobody",
      env: {},
      toolInput: { command: "cat standards/baseline/probes/axe.mjs" },
    });

    expect(JSON.parse(reply ?? "{}").hookSpecificOutput.permissionDecision).toBe(
      "ask",
    );
  });
});

describe("guarding the probes in a session run by hand (#169)", () => {
  // A session run by hand has no run in the ledger. It says which step it is
  // running instead, and the guard treats it as a daemon run of that step.
  const probe = { file_path: "doc/plans/phases/probes/PRD-01.R3.mjs" };

  it("lets a session that declared the checking step through", () => {
    const { root } = workspace();
    declareStage(root, "session-hand", "verification");

    const reply = runGuard({
      root,
      store: newStore(root),
      sessionId: "session-hand",
      env: {},
      toolInput: probe,
    });

    expect(JSON.parse(reply ?? "{}").hookSpecificOutput.permissionDecision).toBe(
      "allow",
    );
  });

  it("refuses the probes to a session that declared a building step", () => {
    const { root } = workspace();
    declareStage(root, "session-hand", "execution");

    const reply = runGuard({
      root,
      store: newStore(root),
      sessionId: "session-hand",
      env: {},
      toolInput: probe,
    });

    expect(JSON.parse(reply ?? "{}").hookSpecificOutput.permissionDecision).toBe(
      "deny",
    );
  });

  it("still asks when the session has no run and declared no step", () => {
    const { root } = workspace();
    // Another session's declaration is in the file, and must not leak across.
    declareStage(root, "session-other", "verification");

    const reply = runGuard({
      root,
      store: newStore(root),
      sessionId: "session-hand",
      env: {},
      toolInput: probe,
    });

    expect(JSON.parse(reply ?? "{}").hookSpecificOutput.permissionDecision).toBe(
      "ask",
    );
  });

  it("goes by the ledger when the session has a run, whatever it declared", () => {
    // A daemon builder must not be able to declare itself the checker.
    const { root } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-daemon");
    store.setStage(run.id, "execution");
    declareStage(root, "session-daemon", "verification");

    const reply = runGuard({
      root,
      store,
      sessionId: "session-daemon",
      env: {},
      toolInput: probe,
    });

    expect(JSON.parse(reply ?? "{}").hookSpecificOutput.permissionDecision).toBe(
      "deny",
    );
  });
});

describe("finding the run that drove a session", () => {
  it("resolves the session id against the ledger", () => {
    const { root } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");

    expect(runForSession(store, "session-abc")?.id).toBe("scratch-app#7/1");
  });

  it("finds the run of a session started under the claim-first ordering", async () => {
    // The run is claimed before the runtime is asked for a session, so for a
    // moment the ledger holds a run with no session id (ADR-0023). The id
    // still has to land, or every daemon session's `Stop` report would be
    // filed as `interactive` — on the terminal, to nobody, instead of on the
    // ticket the run belongs to.
    const dir = mkdtempSync(join(tmpdir(), "timone-guardrails-"));
    tempDirs.push(dir);
    const store = newStore(dir);
    const runtime: SessionRuntime = {
      async start() {
        return {
          sessionId: "session-resumed",
          completed: Promise.resolve({ sessionId: "session-resumed", ok: true }),
        };
      },
    };

    const { run } = store.register("scratch-app", 7);
    store.park(run.id, {
      waitingOn: "an answer from fvermaut",
      kind: "runner",
      stage: "clarification",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    const session = await startStepSession(
      {
        store,
        runtime,
        progressIntervalMs: 30_000,
        ticker: () => ({ stop() {} }),
        log: () => {},
      },
      {
        runId: run.id,
        request: sessionRequest({ cwd: dir, prompt: "go", model: "claude-opus-4-6", stage: "execution" }),
        label: `${run.id} (clarification)`,
      },
    );
    await session.completed;

    expect(runForSession(store, "session-resumed")?.id).toBe("scratch-app#7/1");
  });

  it("finds nobody for a session no run ever claimed", () => {
    const { root } = workspace();
    const store = newStore(root);
    store.register("scratch-app", 7);

    expect(runForSession(store, "session-interactive")).toBeUndefined();
  });
});

/**
 * A run in a box (#85, 43c). The box clones Timone fresh, so its ledger is
 * empty, and the box says which run it belongs to in its environment instead.
 */
describe("the run a session belongs to", () => {
  /** What the box declares about its run. */
  const boxed = {
    TIMONE_RUN_PROJECT: "timone",
    TIMONE_RUN_BRANCH: "timone/39-x",
  };

  it("is the box's declaration when the ledger has no run for the session", () => {
    const { root } = workspace();

    expect(sessionRun(newStore(root), "session-boxed", boxed)).toEqual({
      project: "timone",
      workBranch: "timone/39-x",
    });
  });

  it("is the ledger's run when the ledger has one, whatever the environment says", () => {
    const { root } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 40);
    store.activate(run.id, "session-daemon");
    store.claimBranch(run.id, "timone/40-y");

    expect(sessionRun(store, "session-daemon", boxed)).toEqual({
      project: "scratch-app",
      workBranch: "timone/40-y",
    });
  });

  it("is nobody's when neither the ledger nor the environment names a run", () => {
    const { root } = workspace();

    expect(sessionRun(newStore(root), "session-person", {})).toBeUndefined();
  });

  /** A manifest that names Timone as a managed project, as since ADR-0050. */
  const timoneManifest: Manifest = {
    projects: {
      timone: {
        repo_url: "https://github.com/fvermaut/timone.git",
        path: "projects/timone",
        stack: [],
        bindings: { ticketing: "github" },
      },
    },
  };

  /**
   * One `Stop` after a session whose only commit puts `STATUS.md` on
   * `timone/39-x` in `projects/timone`, pushed. That is what a run on Timone
   * is asked to do (ADR-0050 D-2), and what a person's own branch must not.
   */
  async function statusOnWorkBranch(env: NodeJS.ProcessEnv) {
    const { root, projectDir } = workspace("timone");
    const store = newStore(root);
    await runBaseline({
      root,
      manifest: timoneManifest,
      sessionId: "session-boxed",
      now: new Date("2026-08-06T10:00:00Z"),
    });
    git(projectDir, "checkout", "-q", "-b", "timone/39-x");
    writeFileSync(join(projectDir, "STATUS.md"), "# Status\n");
    git(projectDir, "add", "-A");
    git(projectDir, "commit", "-q", "-m", trailed("docs: the status file", "session-boxed"));
    git(projectDir, "push", "-q", "origin", "HEAD:timone/39-x");

    const printed: string[] = [];
    const outcome = await runCheck({
      root,
      manifest: timoneManifest,
      store,
      sessionId: "session-boxed",
      env,
      print: (message) => printed.push(message),
      journal: () => {},
    });
    return { ...outcome, printed };
  }

  it("is judged as a person's own session when nothing names a run", async () => {
    const { returned } = await statusOnWorkBranch({});

    expect(returned.map((violation) => violation.summary)).toContain(
      "timone: STATUS.md was written on `timone/39-x`, not on `main`",
    );
  });

  it("is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2", async () => {
    const { returned, printed } = await statusOnWorkBranch(boxed);

    expect(returned).toEqual([]);
    expect(printed).toEqual([]);
  });
});

/**
 * A run's pushes go through a guard that git runs as a hook (43a). These
 * commands switch that hook off, so a run is refused them before they run.
 */
describe("switching off the guard on a run's pushes", () => {
  const boxed = {
    TIMONE_RUN_PROJECT: "timone",
    TIMONE_RUN_BRANCH: "timone/39-x",
  };

  /** What `PreToolUse` answers for one `Bash` command in this session. */
  function guardOnBash(command: string, env: NodeJS.ProcessEnv) {
    const { root } = workspace();
    const reply = runGuard({
      root,
      store: newStore(root),
      sessionId: "session-boxed",
      env,
      toolName: "Bash",
      toolInput: { command },
    });
    return reply === undefined ? undefined : JSON.parse(reply);
  }

  it.each([
    "git push --no-verify origin x",
    "git -c core.hooksPath=/tmp/h push",
    "GIT_CONFIG_COUNT=0 git push",
  ])("refuses a run `%s`", (command) => {
    const reply = guardOnBash(command, boxed);

    expect(reply?.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(reply?.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(reply?.hookSpecificOutput.permissionDecisionReason).toContain(
      "keeps a run off the project's default branch",
    );
  });

  it.each(["git push origin timone/39-x", "git commit --no-verify -m x"])(
    "says nothing to a run about `%s`",
    (command) => {
      expect(guardOnBash(command, boxed)).toBeUndefined();
    },
  );

  it.each([
    "git push --no-verify origin x",
    "git -c core.hooksPath=/tmp/h push",
    "GIT_CONFIG_COUNT=0 git push",
    "git push origin timone/39-x",
    "git commit --no-verify -m x",
  ])("says nothing about `%s` in a person's own session", (command) => {
    expect(guardOnBash(command, {})).toBeUndefined();
  });
});

describe("guardrails pre-push, on the first push of a work branch (PRD-07.R4)", () => {
  const ZERO = "0000000000000000000000000000000000000000";
  const SHA = "1111111111111111111111111111111111111111";
  const OLD = "2222222222222222222222222222222222222222";

  /**
   * Run `timone guardrails pre-push --branch timone/7-x` as git's hook would,
   * with one update to the work branch on stdin, in a folder that is not a
   * git repository: any question to git fails there, so a case can see
   * whether git was asked.
   */
  async function prePushOutsideGit(
    remoteSha: string,
  ): Promise<{ errors: string[]; exitCode: number | undefined }> {
    const dir = mkdtempSync(join(tmpdir(), "timone-pre-push-"));
    tempDirs.push(dir);
    const startedIn = process.cwd();
    vi.stubEnv("GIT_CEILING_DIRECTORIES", tmpdir());
    vi.stubEnv("GIT_DIR", undefined);
    vi.spyOn(process, "stdin", "get").mockReturnValue(
      Readable.from([
        `refs/heads/timone/7-x ${SHA} refs/heads/timone/7-x ${remoteSha}\n`,
      ]) as unknown as typeof process.stdin,
    );
    const program = new Command();
    program.exitOverride();
    registerGuardrailsCommand(program);
    const errors: string[] = [];
    const realError = console.error;
    console.error = (message: unknown): void => {
      errors.push(String(message));
    };
    process.chdir(dir);
    try {
      await program.parseAsync(["guardrails", "pre-push", "--branch", "timone/7-x"], {
        from: "user",
      });
    } finally {
      process.chdir(startedIn);
      console.error = realError;
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
    const code = process.exitCode;
    process.exitCode = undefined;
    return { errors, exitCode: typeof code === "number" ? code : undefined };
  }

  it("does not ask git about a push of a branch the remote already has", async () => {
    expect(await prePushOutsideGit(OLD)).toEqual({ errors: [], exitCode: undefined });
  });

  it("asks git on the first push, and refuses the push when git cannot answer", async () => {
    const result = await prePushOutsideGit(ZERO);

    expect(result.exitCode).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(
      /^Refused: Timone's push guard could not judge this push, so it lets nothing through\. /,
    );
  });
});

describe("a session the daemon drove", () => {
  it("asks the session first, then flags the run — and posts on no ticket", async () => {
    // ADR-0027 reversing phase 11's behaviour, on real git. What used to be
    // one loud ticket comment is now a round with the session, and a flag
    // for what survives it. `timone status` reads the flags; the client's
    // thread sees nothing either way.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-daemon");

    // Stopped by hand rather than through `bracket`, because the ledger is
    // the thing under test and its state between the two stops is the claim.
    await runBaseline({
      root,
      manifest,
      sessionId: "session-daemon",
      now: new Date("2026-08-06T10:00:00Z"),
    });
    writeFileSync(join(projectDir, "feature.txt"), "work\n");
    git(projectDir, "add", "-A");
    git(projectDir, "commit", "-q", "-m", trailed("never pushed", "session-daemon"));

    // The first stop: handed to the session, and nothing recorded anywhere.
    const first = await stopOnce(root, "session-daemon", store);
    expect(first.returned).toHaveLength(1);
    expect(first.returned[0].summary).toContain("never reached the remote");
    expect(first.account).toContain("handed");
    expect(store.get("scratch-app#7/1")?.flags).toEqual([]);

    // The second: it did not fix it, so the run carries it.
    const second = await stopOnce(root, "session-daemon", store);
    expect(second.returned).toEqual([]);
    expect(store.get("scratch-app#7/1")?.flags).toHaveLength(1);
    expect(store.get("scratch-app#7/1")?.flags[0]).toContain(
      "never reached the remote",
    );
    // And nothing leaked to the interactive audience.
    expect(second.printed).toEqual([]);
    expect(second.journalled).toEqual([]);
  });

  it("stops flagging once the session has fixed what it was told", async () => {
    // The other half of the round, and the reason it is worth having: a
    // session that pushes when asked leaves nothing on the run at all.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-daemon");

    await runBaseline({
      root,
      manifest,
      sessionId: "session-daemon",
      now: new Date("2026-08-06T10:00:00Z"),
    });
    writeFileSync(join(projectDir, "feature.txt"), "work\n");
    git(projectDir, "add", "-A");
    git(projectDir, "commit", "-q", "-m", trailed("never pushed", "session-daemon"));

    expect((await stopOnce(root, "session-daemon", store)).returned).toHaveLength(1);

    git(projectDir, "push", "-q", "origin", "HEAD:main");
    const second = await stopOnce(root, "session-daemon", store);

    expect(second.account).toContain("clean");
    expect(store.get("scratch-app#7/1")?.flags).toEqual([]);
  });

  it("says nothing anywhere when the session behaved", async () => {
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-daemon");

    const { account, printed } = await bracket(
      root,
      "session-daemon",
      store,
      () => {
        writeFileSync(join(projectDir, "feature.txt"), "work\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", trailed("pushed", "session-daemon"));
        git(projectDir, "push", "-q", "origin", "HEAD:main");
      },
    );
    expect(printed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.flags).toEqual([]);
    expect(account).toContain("clean");
  });
});

describe("a session a human drove", () => {
  it("prints the finding and journals it, and posts on no ticket at all", async () => {
    // The 2026-08-06 accident, reproduced: a commit left in a project
    // checkout by a session nobody was watching.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed, journalled } = await bracket(
      root,
      "session-interactive",
      store,
      () => {
        writeFileSync(join(projectDir, "stray.txt"), "left behind\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", trailed("stray", "session-interactive"));
      },
    );

    expect(printed.join("\n")).toContain("never reached the remote");
    expect(journalled).toHaveLength(1);
    expect(JSON.parse(journalled[0])).toMatchObject({
      session: "session-interactive",
      rule: "unpushed",
    });
    // No run owns it, so there is nowhere to post and nothing to flag.
  });

  it("says nothing when the session behaved", async () => {
    const { root } = workspace();
    const store = newStore(root);

    const { account, printed, journalled } = await bracket(
      root,
      "session-interactive",
      store,
      () => {},
    );

    expect(printed).toEqual([]);
    expect(journalled).toEqual([]);
    expect(account).toContain("clean");
  });

  it("does not judge Timone's own work against a project it never had", async () => {
    // A session working on Timone itself touches `src/` and `doc/`, which are
    // outside every `projects/<name>/`. Judged against a target it never
    // declared, every honest edit would read as a containment violation.
    const { root } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(
      root,
      "session-interactive",
      store,
      () => {
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "thing.ts"), "export const x = 1;\n");
      },
    );

    expect(printed.join("\n")).not.toContain("outside");
  });

  it("catches a project's work branch cut at the timone root — finding 11, on real git", async () => {
    // 2026-08-14, 15:52: a session recording an approval, sitting at the
    // timone root, created `timone/29-…` here instead of in the project's
    // checkout and never switched back. Three hours later the next session
    // committed seven of Timone's own artifacts onto it and reported them as
    // being on `main`. Nothing in the rules named the branch itself.
    const { root } = workspace();
    const store = newStore(root);

    const { printed, journalled } = await bracket(
      root,
      "session-interactive",
      store,
      () => {
        git(root, "checkout", "-q", "-b", "timone/29-fixture-map-notes-on-a-to-do");
        writeFileSync(join(root, "doc-artifact.md"), "an ADR that never lands\n");
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", trailed("stranded", "session-interactive"));
      },
    );

    expect(printed.join("\n")).toContain(
      "is a project's work branch, cut in Timone's own repository",
    );
    expect(
      journalled.map((line) => JSON.parse(line).rule as string),
    ).toContain("branch-placement");
  });

  it("goes round exactly once, however many turns the session takes", async () => {
    // `Stop` fires at the end of every assistant turn, not once per session,
    // so ADR-0027's three states have to survive being asked repeatedly: the
    // session is told once, the human hears once, and a session that talks
    // for another ten turns hears nothing further about it.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    await runBaseline({
      root,
      manifest,
      sessionId: "session-chatty",
      now: new Date("2026-08-06T10:00:00Z"),
    });

    writeFileSync(join(projectDir, "stray.txt"), "left behind\n");
    git(projectDir, "add", "-A");
    git(projectDir, "commit", "-q", "-m", trailed("stray", "session-chatty"));

    const first = await stopOnce(root, "session-chatty", store);
    const second = await stopOnce(root, "session-chatty", store);
    const third = await stopOnce(root, "session-chatty", store);

    expect(first.account).toContain("handed");
    expect(first.printed).toEqual([]);
    expect(second.account).toContain("flagged");
    expect(second.printed).toHaveLength(1);
    expect(third.account).toContain("clean");
    expect(third.printed).toEqual([]);
    expect(third.returned).toEqual([]);
  });
});

describe("a session with no baseline", () => {
  it("says so rather than passing silently", async () => {
    // Silence would look exactly like a clean session, which is the one
    // reading it must never produce.
    const { root } = workspace();
    const store = newStore(root);

    const { account, returned } = await runCheck({
      root,
      manifest,
      store,
      sessionId: "session-never-started",
      env: {},
      print: () => {},
      journal: () => {},
    });

    expect(account).toContain("no baseline");
    expect(account).not.toContain("clean");
    // And it does not hold the session hostage over a check it could not run.
    expect(returned).toEqual([]);
  });
});

describe("the journal", () => {
  it("appends one line per finding, and creates the file", () => {
    const { root } = workspace();

    appendJournal(root, JSON.stringify({ session: "a", rule: "unpushed" }));
    appendJournal(root, JSON.stringify({ session: "b", rule: "unpushed" }));

    const lines = readFileSync(join(root, ".timone", "sessions.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line !== "");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1])).toMatchObject({ session: "b" });
  });
});

describe("the provenance trailer, read back off real commits", () => {
  it("accepts a trailed commit and flags an untrailed one", async () => {
    // The parsing is the part that can silently break: the message is
    // multi-line and the file list follows it in the same `git log` output.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(
      root,
      "session-trailers",
      store,
      () => {
        writeFileSync(join(projectDir, "good.txt"), "a\n");
        git(projectDir, "add", "-A");
        git(
          projectDir,
          "commit",
          "-q",
          "-m",
          "feat: something\n\nA body that wraps\nover several lines.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nTimone-Stage: execution\nTimone-Run: scratch-app#7",
        );
        git(projectDir, "push", "-q", "origin", "HEAD:main");
      },
    );

    expect(printed.join("\n")).not.toContain("where they came from");
  });

  it("flags a commit that carries no trailer at all", async () => {
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(
      root,
      "session-untrailed",
      store,
      () => {
        writeFileSync(join(projectDir, "bare.txt"), "a\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", "just a subject");
        git(projectDir, "push", "-q", "origin", "HEAD:main");
      },
    );

    expect(printed.join("\n")).toContain("where they came from");
    expect(printed.join("\n")).toContain("Timone-Stage: interactive");
  });

  it("tells the session its own id and what it owes, at SessionStart", async () => {
    // The hook is the only place that knows the session id — the prompt is
    // built before the SDK has issued one — and the one place both kinds of
    // session pass through.
    const { root } = workspace();

    const reply = JSON.parse(
      await runBaseline({
        root,
        manifest,
        sessionId: "session-xyz",
        now: new Date("2026-08-06T10:00:00Z"),
      }),
    ) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };

    expect(reply.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(reply.hookSpecificOutput.additionalContext).toContain(
      "Timone-Session: session-xyz",
    );
    expect(reply.hookSpecificOutput.additionalContext).toContain("Timone-Stage:");
  });
});

/**
 * The 14g attribution defect, per rule.
 *
 * Two sessions are open at the timone root — which is how this project is
 * developed, and the daemon builds while fvermaut works. The rules scoped
 * "this session's commits" by diffing against the session's `SessionStart`
 * baseline alone, so the session whose baseline was older was blamed for the
 * other's work. At 14g that posted a false accusation on a client's ticket
 * naming three files the accused session never touched — all three carrying
 * the trailer that would have exonerated it.
 *
 * Every rule is asserted separately rather than once. One filter at the
 * evidence boundary corrects all four, and that is the design — but a test
 * naming only one rule would not notice a rule reading commits by some other
 * route, which is exactly how the unpushed half came to need its own fix.
 */
describe("commits another session made", () => {
  it("are invisible to the unpushed rule, and do not inflate its count", async () => {
    // The common case rather than the edge one: `rev-list --not
    // --remotes=origin` is a repository-state question with no session
    // scoping in it at all, so *any* interactive session opened while the
    // daemon holds in-flight commits reported them as its own.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(root, "mine", store, () => {
      writeFileSync(join(projectDir, "theirs.txt"), "the daemon's work\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", trailed("theirs", "session-daemon"));
      writeFileSync(join(projectDir, "mine.txt"), "my work\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", trailed("mine", "mine"));
    });

    const report = printed.join("\n");
    expect(report).toContain("1 commit(s)");
    expect(report).toContain(git(projectDir, "rev-parse", "--short", "HEAD").trim());
    expect(report).not.toContain(
      git(projectDir, "rev-parse", "--short", "HEAD~1").trim(),
    );
  });

  it("are invisible to the STATUS.md placement rule", async () => {
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(root, "mine", store, () => {
      git(projectDir, "checkout", "-q", "-b", "feature");
      writeFileSync(join(projectDir, "STATUS.md"), "# status\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", trailed("status", "session-daemon"));
      git(projectDir, "push", "-q", "origin", "HEAD:feature");
    });

    expect(printed.join("\n")).not.toContain("STATUS.md was written on");
  });

  it("are invisible to the path-containment rule — the 14g accusation itself", async () => {
    // The one that reached a client's ticket. A daemon session working
    // `scratch-app` is judged against `projects/scratch-app/`, and the files
    // an interactive session committed to Timone's own tree were counted
    // against it.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 11);
    store.activate(run.id, "session-daemon");

    const { printed } = await bracket(
      root,
      "session-daemon",
      store,
      () => {
        // The daemon's own work, where it belongs.
        writeFileSync(join(projectDir, "feature.txt"), "work\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", trailed("feature", "session-daemon"));
        git(projectDir, "push", "-q", "origin", "HEAD:main");
        // Meanwhile, a human writing this very report in the workspace.
        writeFileSync(join(root, "report.md"), "# gate\n");
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", trailed("the report", "dd86be88"));
      },
    );
    expect(printed).toEqual([]);
    expect(store.get("scratch-app#11/1")?.flags).toEqual([]);
  });

  it("are invisible to the provenance rule", async () => {
    // A commit naming its session but not its stage: trailed enough to be
    // attributable, untrailed enough for the provenance rule to fire on it.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(root, "mine", store, () => {
      writeFileSync(join(projectDir, "theirs.txt"), "a\n");
      git(projectDir, "add", "-A");
      git(
        projectDir,
        "commit",
        "-q",
        "-m",
        "feat: theirs\n\nTimone-Session: session-daemon",
      );
      git(projectDir, "push", "-q", "origin", "HEAD:main");
    });

    expect(printed.join("\n")).not.toContain("where they came from");
  });

  it("are still judged when they name no session at all — the fix's known limit", async () => {
    // Deliberate, and asserted so a later tidy-up cannot remove it without
    // a test going red. A commit carrying no session trailer is genuinely
    // unattributable, and over-reporting a real violation is the safe
    // direction. The duplicate provenance line survives by necessity.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed } = await bracket(root, "mine", store, () => {
      writeFileSync(join(projectDir, "orphan.txt"), "a\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", "just a subject");
      git(projectDir, "push", "-q", "origin", "HEAD:main");
    });

    expect(printed.join("\n")).toContain("where they came from");
  });
});

describe("the STATUS.md rule, read back off real commits", () => {
  it("says nothing about a status file the work branch took from main", async () => {
    // [timone#70](https://github.com/fvermaut/timone/issues/70), in the shape
    // it was seen in on `ivtrends` on 2026-08-30 and on this repository on
    // 2026-09-04: STATUS.md is written and pushed on `main`, and a work branch
    // then merges `main` in to take a fix. Containment reports every commit on
    // `main` against the branch, and the human is shown correct work as
    // something wrong with the session.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { printed, returned, first } = await bracket(
      root,
      "session-status-merged",
      store,
      () => {
        writeFileSync(join(projectDir, "STATUS.md"), "# Status\n");
        git(projectDir, "add", "-A");
        git(
          projectDir,
          "commit",
          "-q",
          "-m",
          trailed("docs: the status file", "session-status-merged"),
        );
        git(projectDir, "push", "-q", "origin", "HEAD:main");

        // The work branch, cut before that commit and merging `main` in — the
        // ordinary move the process asks for.
        git(projectDir, "checkout", "-q", "-b", "timone/34-11", "HEAD~1");
        writeFileSync(join(projectDir, "feature.txt"), "a\n");
        git(projectDir, "add", "-A");
        git(
          projectDir,
          "commit",
          "-q",
          "-m",
          trailed("feat: the eleventh piece", "session-status-merged"),
        );
        // `origin/main`, never the bare name. The fixture clones an empty bare
        // repository and pushes `HEAD:main`, so the *local* branch is whatever
        // the runner's `init.defaultBranch` says — `main` on this laptop and
        // `master` on CI, where this failed. The remote-tracking ref is the one
        // the push actually creates, and it is also the ref the rule reads.
        git(
          projectDir,
          "merge",
          "-q",
          "--no-edit",
          "-m",
          trailed("Merge main into the eleventh piece", "session-status-merged"),
          "origin/main",
        );
        git(projectDir, "push", "-q", "origin", "HEAD:timone/34-11");
      },
    );

    const said = [...printed, ...first.returned.map((v) => v.summary)].join("\n");
    expect(said).not.toContain("STATUS.md was written on");
    expect(returned.map((violation) => violation.rule)).not.toContain(
      "status-placement",
    );
  });

  it("still says so about a status file that exists only on a branch", async () => {
    // The rule keeps its purpose: a status file nobody reading `main` will see
    // is worth saying out loud. This session names no run, so nothing is
    // expected on a branch anywhere.
    const { root, projectDir } = workspace();
    const store = newStore(root);

    const { first } = await bracket(root, "session-status-stray", store, () => {
      git(projectDir, "checkout", "-q", "-b", "phase/01");
      writeFileSync(join(projectDir, "STATUS.md"), "# Status\n");
      git(projectDir, "add", "-A");
      git(
        projectDir,
        "commit",
        "-q",
        "-m",
        trailed("docs: the status file", "session-status-stray"),
      );
      git(projectDir, "push", "-q", "origin", "HEAD:phase/01");
    });

    expect(first.returned.map((violation) => violation.rule)).toContain(
      "status-placement",
    );
  });
});

/**
 * The box switches the merge rules for `STATUS.md` and the registers on with
 * this command (48b), as it does the push guard.
 */
describe("guardrails install-merge-rules", () => {
  /** Run `timone guardrails install-merge-rules …` as the CLI would, capturing what it printed. */
  async function installMergeRulesCommand(
    ...args: string[]
  ): Promise<{ out: string[]; errors: string[]; exitCode: number | undefined }> {
    const program = new Command();
    program.exitOverride();
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
    registerGuardrailsCommand(program);
    const out: string[] = [];
    const errors: string[] = [];
    const realLog = console.log;
    const realError = console.error;
    console.log = (message: unknown): void => {
      out.push(String(message));
    };
    console.error = (message: unknown): void => {
      errors.push(String(message));
    };
    try {
      await program.parseAsync(["guardrails", "install-merge-rules", ...args], { from: "user" });
    } finally {
      console.log = realLog;
      console.error = realError;
    }
    const code = process.exitCode;
    process.exitCode = undefined;
    return { out, errors, exitCode: typeof code === "number" ? code : undefined };
  }

  it("writes the attributes file with one line per kind, and prints nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-merge-rules-cmd-"));
    tempDirs.push(dir);

    const result = await installMergeRulesCommand("--dir", dir);

    expect(result).toEqual({ out: [], errors: [], exitCode: undefined });
    expect(readFileSync(join(dir, "attributes"), "utf8")).toBe(
      "/STATUS.md merge=timone-status\ndoc/specs/prd/*.criteria.md merge=timone-register\n",
    );
  });

  it("exits 1 with one line naming the command when the folder cannot be made", async () => {
    const dir = mkdtempSync(join(tmpdir(), "timone-merge-rules-cmd-"));
    tempDirs.push(dir);
    writeFileSync(join(dir, "a-file"), "not a folder\n");

    const result = await installMergeRulesCommand("--dir", join(dir, "a-file", "rules"));

    expect(result.out).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^guardrails install-merge-rules: /);
    expect(result.exitCode).toBe(1);
  });
});

// Loaded here rather than at the top of the file, so this block adds no import
// line there. Every fixture below is built from it, so none spells a folder out.
const { PROBE_DIRECTORIES } = await import("../daemon/probeGuard.js");

/**
 * #192: a builder's helper was refused for a prompt that told it to keep out
 * of the check-script folders, and then the plan was refused for naming them.
 * This block never calls `workspace()`, so it runs in a container too (#220).
 */
describe("the guard judges only real reads and writes, for every kind of session (PRD-10 R4, R5)", () => {
  const p = PROBE_DIRECTORIES[0];
  const shared = PROBE_DIRECTORIES[1];
  const sessionId = "session-192";

  /** A root of its own, with nothing in it but what the ledger writes. */
  const freshRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "timone-guard-judges-"));
    tempDirs.push(root);
    return root;
  };

  /** A ledger holding a run for this session at `stage`, or no run at all. */
  const ledger = (root: string, stage: "execution" | "verification" | undefined): RunStore => {
    const store = newStore(root);
    if (stage === undefined) return store;
    const { run } = store.register("timone", 229);
    store.activate(run.id, sessionId);
    store.setStage(run.id, stage);
    return store;
  };

  /** Each kind of session, on the host and in a container. */
  const SESSIONS = [
    { who: "an execution run", stage: "execution", read: "deny" },
    { who: "a verification run", stage: "verification", read: "allow" },
    // ✏ 57b: a person's session is refused in a container, where nobody can be asked, PRD-10 R3.
    { who: "a person", stage: undefined, read: "ask", readInContainer: "deny" },
  ] as const;
  const PLACES = [
    { where: "on the host", env: {} },
    // ✏ 57b: a run's container also names the run's step, PRD-10 R3.
    { where: "in a container", env: { TIMONE_RUN_PROJECT: "timone" }, namesStep: true },
  ] as const;
  // ✏ 57b: the two marked rows above, applied to each kind, PRD-10 R3.
  const KINDS = SESSIONS.flatMap((session) =>
    PLACES.map((place) =>
      "namesStep" in place
        ? {
            ...session,
            ...place,
            env: session.stage === undefined ? place.env : { ...place.env, TIMONE_RUN_STAGE: session.stage },
            read: "readInContainer" in session ? session.readInContainer : session.read,
          }
        : { ...session, ...place },
    ),
  );

  const judge = (
    stage: "execution" | "verification" | undefined,
    env: NodeJS.ProcessEnv,
    toolName: string,
    toolInput: unknown,
  ): string | undefined => {
    const root = freshRoot();
    return runGuard({ root, store: ledger(root, stage), sessionId, env, toolName, toolInput });
  };

  it.each(KINDS)("lets the helper of $who be told to keep out, $where", ({ stage, env }) => {
    const prompt = `Do not open ${p} or ${shared}.`;
    expect(judge(stage, env, "Agent", { prompt, description: "d", subagent_type: "claude" })).toBeUndefined();
  });

  it.each(KINDS)("lets $who edit a plan that names a folder, $where", ({ stage, env }) => {
    expect(
      judge(stage, env, "Edit", {
        file_path: "doc/plans/phases/phase-42.md",
        old_string: "x",
        new_string: `See ${shared}/README.md.`,
      }),
    ).toBeUndefined();
  });

  it.each(KINDS)("still judges a real read by $who, $where", ({ stage, env, read }) => {
    const reply = judge(stage, env, "Read", { file_path: `${p}/prd-10.r1.mjs` });

    expect(JSON.parse(reply ?? "{}")).toMatchObject({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: read },
    });
  });

  /** #192's third call: a commit whose message names a folder, written as commits are. */
  const commit = [`git commit -m "$(cat <<'EOF'`, `docs: name ${shared}/README.md`, "EOF", `)"`].join("\n");

  it.each(KINDS)("lets $who commit a message that names a folder, $where", ({ stage, env }) => {
    expect(judge(stage, env, "Bash", { command: commit, description: "d" })).toBeUndefined();
  });

  it.each(KINDS)("still judges a real read joined to a commit by $who, $where", ({ stage, env, read }) => {
    const reply = judge(stage, env, "Bash", { command: `git commit -m "x" && cat ${p}/a.sh`, description: "d" });

    expect(JSON.parse(reply ?? "{}")).toMatchObject({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: read },
    });
  });
});

// The block below loads the list of steps the same way, next to its use.
const { PIPELINE_STAGES } = await import("../daemon/pipeline.js");

/**
 * #87: a check run in a container was asked about its own check scripts, and
 * nobody was there to answer. A builder there was asked too, not refused. The
 * container now names its step (57a), and the guard judges by it. Every case
 * has an empty ledger unless it says otherwise, because that is the state of
 * every session in a container. Like the block above, this one never calls
 * `workspace()`, so it runs in a container too (#220).
 */
describe("the guard in a container knows its step (PRD-10 R2, R3)", () => {
  const probe = `${PROBE_DIRECTORIES[0]}/prd-10.r1.mjs`;
  const sessionId = "session-87";

  /** A root of its own, with nothing in it but what the test writes. */
  const freshRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "timone-guard-container-"));
    tempDirs.push(root);
    return root;
  };

  /** A container's environment at `step`; undefined leaves the step out. */
  const boxed = (step: string | undefined): NodeJS.ProcessEnv =>
    step === undefined ? { TIMONE_RUN_PROJECT: "timone" } : { TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: step };

  /** What the guard answers, or undefined when it says nothing. */
  const judge = (
    env: NodeJS.ProcessEnv,
    toolName: string,
    toolInput: unknown,
    root: string = freshRoot(),
    store: RunStore = newStore(root),
  ): { permissionDecision?: string; permissionDecisionReason?: string } | undefined => {
    const reply = runGuard({ root, store, sessionId, env, toolName, toolInput });
    return reply === undefined ? undefined : JSON.parse(reply).hookSpecificOutput;
  };

  it("lets the checking step write a check script and run it", () => {
    expect(judge(boxed("verification"), "Write", { file_path: probe, content: "x" })?.permissionDecision).toBe("allow");
    expect(judge(boxed("verification"), "Bash", { command: `node ${probe}` })?.permissionDecision).toBe("allow");
  });

  it("lets the update read a check script", () => {
    expect(judge(boxed("update"), "Read", { file_path: probe })?.permissionDecision).toBe("allow");
  });

  /** The builder's reason, word for word as on the host. */
  const builderReason =
    `Refused: ${PROBE_DIRECTORIES.join(" and ")} hold the checks that will be run against what you build. ` +
    "A builder that reads them writes code to pass them, which is the same fault " +
    "as a verifier checking against your own test suite, with the two parties " +
    "swapped. Carry on without them. If you believe a probe is wrong, that is a " +
    "finding for the human, not a file to open.";

  it.each(["execution", "remediation"])("refuses a check script to the building step %s", (step) => {
    expect(judge(boxed(step), "Read", { file_path: probe })).toEqual({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: builderReason,
    });
  });

  it("does not read a declaration in a container: a builder that declared the checking step is still refused", () => {
    const root = freshRoot();
    declareStage(root, sessionId, "verification");

    expect(judge(boxed("execution"), "Read", { file_path: probe }, root)?.permissionDecision).toBe("deny");
  });

  it("goes by the ledger when it has a run for the session, whatever the container says", () => {
    const root = freshRoot();
    const store = newStore(root);
    const { run } = store.register("timone", 230);
    store.activate(run.id, sessionId);
    store.setStage(run.id, "execution");

    expect(judge(boxed("verification"), "Read", { file_path: probe }, root, store)?.permissionDecision).toBe("deny");
  });

  it("still asks a person with no declaration, and lets one through who declared the checking step", () => {
    expect(judge({}, "Read", { file_path: probe })?.permissionDecision).toBe("ask");

    const root = freshRoot();
    declareStage(root, sessionId, "verification");
    expect(judge({}, "Read", { file_path: probe }, root)?.permissionDecision).toBe("allow");
  });

  /** The one reason a container gets when its step neither builds nor checks. */
  const containerReason =
    `Refused: ${PROBE_DIRECTORIES.join(" and ")} hold the checks, and only the checking step uses them. ` +
    "This session runs in a container, where nobody can be asked, so the guard refuses rather than asks.";

  /** Steps a container may name that are not steps: missing, empty, unknown. */
  const ODD = [
    { step: undefined, label: "no step" },
    { step: "", label: "an empty step" },
    { step: "nonsense", label: "an unknown step" },
  ];
  const EVERY = [...PIPELINE_STAGES.map((step) => ({ step, label: step })), ...ODD];
  const BUILDING: readonly string[] = ["execution", "remediation"];
  const CHECKING: readonly string[] = ["verification", "update"];
  const NEITHER = EVERY.filter(({ step }) => step === undefined || (!BUILDING.includes(step) && !CHECKING.includes(step)));

  it.each(EVERY)("never asks about a check script, at $label", ({ step }) => {
    expect(judge(boxed(step), "Read", { file_path: probe })?.permissionDecision).not.toBe("ask");
  });

  it.each(NEITHER)("refuses with the one container reason, at $label", ({ step }) => {
    expect(judge(boxed(step), "Read", { file_path: probe })).toEqual({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: containerReason,
    });
  });

  it("refuses, not asks, a run the ledger has at planning, in a container", () => {
    const root = freshRoot();
    const store = newStore(root);
    const { run } = store.register("timone", 230);
    store.activate(run.id, sessionId);
    store.setStage(run.id, "planning");

    expect(judge(boxed("planning"), "Read", { file_path: probe }, root, store)).toEqual({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: containerReason,
    });
  });

  it.each([
    { step: "execution", label: "execution" },
    { step: "verification", label: "verification" },
    { step: undefined, label: "no step" },
  ])("says nothing about a call that names no folder, at $label", ({ step }) => {
    expect(judge(boxed(step), "Read", { file_path: "src/cli.ts" })).toBeUndefined();
  });
});
