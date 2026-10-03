import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it } from "vitest";

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
    });

    // Strictly: a `workspace` key set to undefined is not the same request as
    // one without it, and the in-process runtime must see the second.
    expect(request).toStrictEqual({
      cwd: "/root",
      prompt: "go",
      model: "claude-opus-4-6",
    });
  });

  it("leaves the effort key out, rather than undefined, for a stage that declares none", () => {
    const request = sessionRequest({
      cwd: "/root",
      prompt: "go",
      model: "claude-haiku-4-5",
      effort: undefined,
    });

    expect(Object.keys(request)).toEqual(["cwd", "prompt", "model"]);
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

    expect(seen.options?.env?.PATH).toBe(process.env.PATH);
    expect(seen.options?.env?.HOME).toBe(process.env.HOME);
  });

  it("removes the guard's directory once the session is over", async () => {
    const { seen, session } = await started("timone/7-x");
    await session.completed;

    expect(existsSync(seen.options?.env?.GIT_CONFIG_VALUE_0 ?? "")).toBe(false);
  });
});
