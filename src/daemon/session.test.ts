import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketingProject } from "../adapters/ticketing.js";
import {
  agentSdkRuntimeWith,
  apiErrorFrom,
  sessionOutcomeFrom,
  sessionRequest,
} from "./session.js";

/** Temp directories made by these tests, removed together afterwards. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const project: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

describe("how a session's ending is judged", () => {
  it("believes a plain success", () => {
    expect(sessionOutcomeFrom("s1", { subtype: "success" }, undefined)).toEqual({
      sessionId: "s1",
      ok: true,
    });
  });

  it("fails a session whose last word was an API error, however it was reported", () => {
    // Found live on 2026-08-07. A planning session died on "API Error:
    // Connection closed mid-response" — the transcript ends on a synthetic
    // message carrying `error: "server_error"` — and the SDK still reported
    // `subtype: "success"`. The daemon believed it, opened a gate over a
    // branch with nothing on it, and asked a human to approve a document
    // that was never written.
    const outcome = sessionOutcomeFrom("s1", { subtype: "success" }, "server_error");

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("server_error");
  });

  it("fails a success that flags itself as an error", () => {
    const outcome = sessionOutcomeFrom("s1", { subtype: "success", is_error: true }, undefined);

    expect(outcome.ok).toBe(false);
  });

  it("still reports a non-success subtype as before", () => {
    expect(
      sessionOutcomeFrom("s1", { subtype: "error_max_turns" }, undefined),
    ).toMatchObject({ ok: false, error: "error_max_turns" });
  });

  it("keeps the sentence beside the code, not just the code", () => {
    // #55: the runtime puts `authentication_failed` in `error` and the reason
    // — expired, or refused — only in the message's text. Keeping the code
    // alone lost the one word that decides whether the daemon retries.
    expect(
      apiErrorFrom({
        error: "authentication_failed",
        message: {
          content: [
            {
              type: "text",
              text: "Failed to authenticate. API Error: 401 OAuth access token has expired.",
            },
          ],
        },
      }),
    ).toBe(
      "authentication_failed: Failed to authenticate. API Error: 401 OAuth access " +
        "token has expired.",
    );
  });

  it("answers the code alone when the message said nothing else", () => {
    expect(apiErrorFrom({ error: "server_error", message: { content: [] } })).toBe(
      "server_error",
    );
    expect(apiErrorFrom({ error: "server_error" })).toBe("server_error");
  });

  it("answers nothing for a message that was not an error", () => {
    // Load-bearing: the caller assigns this unconditionally, so a real
    // message after a recovered error has to clear it.
    expect(
      apiErrorFrom({ message: { content: [{ type: "text", text: "on with it" }] } }),
    ).toBeUndefined();
  });

  it("does not fail a session that recovered from a transient error", () => {
    // The caller clears the error whenever the model speaks again, so an
    // error the CLI retried past never reaches here. Recording the rule where
    // it is relied upon, so the clearing is not later "tidied" into a latch.
    expect(sessionOutcomeFrom("s1", { subtype: "success" }, undefined).ok).toBe(true);
  });
});

describe("the request builder", () => {
  /**
   * A commit as `git rev-parse HEAD` reports it. Written out rather than read
   * from a repository: the point of these tests is that the request carries
   * whatever the daemon was pinned to, and a value the code could recompute
   * would prove nothing.
   */
  const TIMONE_COMMIT = "4f0d1c9b7a2e6d5c3b8a19f0e7d6c5b4a3928170";
  const TIMONE_REMOTE = "https://github.com/fvermaut/timone.git";

  it("pins timone to the commit the daemon is running", () => {
    const request = sessionRequest({
      cwd: "/root",
      prompt: "go",
      model: "claude-opus-4-6",
      stage: "execution",
      workspace: {
        timone: { remote: TIMONE_REMOTE, commit: TIMONE_COMMIT },
        project,
        branch: "timone/7-the-page-feels-slow",
      },
    });

    expect(request.workspace?.timone).toEqual({
      remote: TIMONE_REMOTE,
      commit: TIMONE_COMMIT,
    });
  });

  it("refuses a timone version that is a branch name rather than a commit", () => {
    expect(() =>
      sessionRequest({
        cwd: "/root",
        prompt: "go",
        model: "claude-opus-4-6",
        stage: "execution",
        workspace: {
          timone: { remote: TIMONE_REMOTE, commit: "main" },
          project,
          branch: "timone/7-the-page-feels-slow",
        },
      }),
    ).toThrow(/commit/);
  });

  it("names the target project's work branch, and where to clone it from", () => {
    const request = sessionRequest({
      cwd: "/root",
      prompt: "go",
      model: "claude-opus-4-6",
      stage: "execution",
      workspace: {
        timone: { remote: TIMONE_REMOTE, commit: TIMONE_COMMIT },
        project,
        branch: "timone/7-the-page-feels-slow",
      },
    });

    expect(request.workspace?.project).toEqual({
      name: "scratch-app",
      remote: "https://github.com/fvermaut/scratch-app.git",
      branch: "timone/7-the-page-feels-slow",
    });
  });

  it("hands the in-process runtime what it received before, when no workspace is named", () => {
    const request = sessionRequest({
      cwd: "/root",
      prompt: "go",
      model: "claude-opus-4-6",
      stage: "execution",
    });

    // Strictly: a `workspace` key set to undefined is not the same request as
    // one without it, and the in-process runtime must see the second.
    // ✏ 57a: a request now always names its step (PRD-10.R1, #87).
    expect(request).toStrictEqual({
      cwd: "/root",
      prompt: "go",
      model: "claude-opus-4-6",
      stage: "execution",
    });
  });

  it("leaves the effort key out, rather than undefined, for a stage that declares none", () => {
    const request = sessionRequest({
      cwd: "/root",
      prompt: "go",
      model: "claude-haiku-4-5",
      stage: "execution",
      effort: undefined,
    });

    // ✏ 57a: a request now always names its step (PRD-10.R1, #87).
    expect(Object.keys(request)).toEqual(["cwd", "prompt", "model", "stage"]);
  });
});

describe("the guard on an in-process session's pushes", () => {
  /**
   * A `query` that starts nothing: it keeps the options it was handed, says
   * whether the guard's `pre-push` was on disk at that moment, and ends the
   * session at once.
   */
  function recordingQuery() {
    const seen: { options?: Options; prePushThere?: boolean } = {};
    const query = (params: { prompt: string; options?: Options }) => {
      seen.options = params.options;
      const dir = params.options?.env?.GIT_CONFIG_VALUE_0;
      seen.prePushThere = dir !== undefined && existsSync(join(dir, "pre-push"));
      return (async function* (): AsyncGenerator<SDKMessage> {
        yield { type: "result", subtype: "success", session_id: "s1" } as SDKMessage;
      })();
    };
    return { query, seen };
  }

  async function started(workBranch?: string) {
    const cwd = mkdtempSync(join(tmpdir(), "timone-session-"));
    tempDirs.push(cwd);
    const { query, seen } = recordingQuery();
    const session = await agentSdkRuntimeWith(query).start({
      cwd,
      prompt: "go",
      model: "claude-opus-4-6",
      stage: "execution",
      ...(workBranch === undefined ? {} : { workBranch }),
    });
    return { cwd, seen, session };
  }

  it("points the session's git at a directory holding the guard's pre-push", async () => {
    const { cwd, seen } = await started("timone/7-x");

    const env = seen.options?.env;
    expect(env?.GIT_CONFIG_COUNT).toBe("1");
    expect(env?.GIT_CONFIG_KEY_0).toBe("core.hooksPath");
    expect(env?.GIT_CONFIG_VALUE_0?.startsWith(join(cwd, ".timone", "push-guard"))).toBe(true);
    expect(seen.prePushThere).toBe(true);
  });

  it("keeps the rest of the daemon's environment", async () => {
    const { seen } = await started("timone/7-x");

    // ✏ 43b: the guard's directory now comes first on `PATH`, and the
    // daemon's own follows it whole.
    expect(seen.options?.env?.PATH?.endsWith(`${delimiter}${process.env.PATH}`)).toBe(true);
    expect(seen.options?.env?.HOME).toBe(process.env.HOME);
  });

  it("removes the guard's directory once the session is over", async () => {
    const { seen, session } = await started("timone/7-x");
    await session.completed;

    expect(existsSync(seen.options?.env?.GIT_CONFIG_VALUE_0 ?? "")).toBe(false);
  });
});

/**
 * A run cannot write to a branch or merge through the forge's API either
 * (#85, 43b). The session finds `gh` on its `PATH`, so the guard's directory
 * comes first there, and the `gh` in it checks the call before it hands over
 * to the real one.
 */
describe("the guard on an in-process session's gh calls", () => {
  /** Timone's build, which the guard's `gh` runs; built before these tests. */
  const DIST = fileURLToPath(new URL("../../dist", import.meta.url));

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * A session whose `query` runs each of `calls` as `gh`, found on the
   * session's own `PATH`, while the session is running. The real `gh` is a
   * fake one first on the daemon's `PATH`, which writes down what it was
   * called with. The session's checkout holds Timone's build, as the timone
   * root does, and every call runs with `HOME` in a temp directory.
   */
  async function sessionRunningGh(calls: string[][]) {
    const root = mkdtempSync(join(tmpdir(), "timone-session-gh-"));
    tempDirs.push(root);
    const cwd = join(root, "cwd");
    const home = join(root, "home");
    const bin = join(root, "bin");
    mkdirSync(cwd);
    mkdirSync(home);
    mkdirSync(bin);
    symlinkSync(DIST, join(cwd, "dist"));
    const called = join(root, "called");
    writeFileSync(join(bin, "gh"), `#!/bin/sh\necho "$*" >> '${called}'\n`, { mode: 0o755 });
    vi.stubEnv("PATH", `${bin}${delimiter}${process.env.PATH ?? ""}`);

    const seen: { env?: Record<string, string | undefined> } = {};
    let firstOnPath: string[] = [];
    const ran: { status: number | null; stderr: string }[] = [];
    const query = (params: { prompt: string; options?: Options }) => {
      seen.env = params.options?.env;
      firstOnPath = readdirSync(seen.env?.PATH?.split(delimiter)[0] ?? "").sort();
      for (const args of calls) {
        const result = spawnSync("gh", args, {
          env: { ...params.options?.env, HOME: home },
          encoding: "utf8",
        });
        ran.push({ status: result.status, stderr: result.stderr });
      }
      return (async function* (): AsyncGenerator<SDKMessage> {
        yield { type: "result", subtype: "success", session_id: "s1" } as SDKMessage;
      })();
    };
    await agentSdkRuntimeWith(query).start({
      cwd,
      prompt: "go",
      model: "claude-opus-4-6",
      stage: "execution",
      workBranch: "timone/7-x",
    });
    const realGhGot = existsSync(called)
      ? readFileSync(called, "utf8").trim().split("\n")
      : [];
    return { seen, ran, realGhGot, firstOnPath, daemonPath: process.env.PATH };
  }

  it("puts a directory of the guard's first on the session's PATH", async () => {
    const { seen, daemonPath } = await sessionRunningGh([]);

    const [first, ...rest] = (seen.env?.PATH ?? "").split(delimiter);
    expect(first?.startsWith(seen.env?.GIT_CONFIG_VALUE_0 ?? "-")).toBe(true);
    expect(rest.join(delimiter)).toBe(daemonPath);
  });

  it("adds gh to the session's PATH and nothing else", async () => {
    // The guard's hooks have names a session may run as commands: the
    // `pre-commit` tool is the common one. They must not shadow anything.
    const { firstOnPath } = await sessionRunningGh([]);

    expect(firstOnPath).toEqual(["gh"]);
  });

  it("refuses a merge, and the real gh never runs", async () => {
    const { ran, realGhGot } = await sessionRunningGh([["pr", "merge", "12", "--squash"]]);

    expect(ran[0]?.status).toBe(1);
    expect(ran[0]?.stderr).toContain("Refused: `gh pr merge`");
    expect(realGhGot).toEqual([]);
  });

  it("hands a comment to the real gh", async () => {
    const { ran, realGhGot } = await sessionRunningGh([["issue", "comment", "85", "--body", "hi"]]);

    expect(ran[0]?.status).toBe(0);
    expect(realGhGot).toEqual(["issue comment 85 --body hi"]);
  });
});
