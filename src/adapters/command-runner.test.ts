import { describe, expect, it } from "vitest";

import {
  credentialCommandRunner,
  execRunner,
  type CommandOptions,
  type CommandRunner,
  type Spawn,
} from "./command-runner.js";
import type { CredentialProvider } from "./credentials.js";

interface Invocation {
  command: string;
  args: string[];
  options?: CommandOptions;
}

/** A recording inner runner, plus a credential source that names what it saw. */
function harness(
  options: {
    answer?: (invocation: Invocation) => Promise<string>;
    tokens?: (repository: string) => string;
  } = {},
): {
  run: CommandRunner;
  calls: Invocation[];
  minted: string[];
} {
  const calls: Invocation[] = [];
  const minted: string[] = [];

  const inner: CommandRunner = async (command, args, opts) => {
    calls.push({ command, args, options: opts });
    return options.answer === undefined
      ? "{}"
      : options.answer({ command, args, options: opts });
  };

  const credentials: CredentialProvider = {
    async tokenFor(repository) {
      minted.push(repository);
      return options.tokens === undefined
        ? "ghs_secret_token"
        : options.tokens(repository);
    },
  };

  return {
    run: credentialCommandRunner({ credentials, run: inner }),
    calls,
    minted,
  };
}

describe("running as Timone rather than as whoever is logged in", () => {
  it("mints for the repository the command itself names", async () => {
    const { run, minted } = harness();

    await run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"]);

    expect(minted).toEqual(["fvermaut/scratch-app"]);
  });

  it("carries the token in the environment, never in an argument", async () => {
    const { run, calls } = harness();

    await run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"]);

    expect(calls[0].args).not.toContain("ghs_secret_token");
    expect(calls[0].options?.env?.GH_TOKEN).toBe("ghs_secret_token");
  });

  it("overrides an ambient login rather than falling back to one", async () => {
    const { run, calls } = harness();

    await run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"]);

    // `gh` reads both, and either one left over from a human's shell would
    // silently win somewhere. Both are set, to the same minted token.
    expect(calls[0].options?.env?.GH_TOKEN).toBe("ghs_secret_token");
    expect(calls[0].options?.env?.GITHUB_TOKEN).toBe("ghs_secret_token");
    expect(calls[0].options?.env?.GH_CONFIG_DIR).toBeDefined();
  });

  it("keeps the caller's own environment and working directory", async () => {
    const { run, calls } = harness();

    await run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"], {
      cwd: "/somewhere",
      env: { GH_PAGER: "cat" },
    });

    expect(calls[0].options?.cwd).toBe("/somewhere");
    expect(calls[0].options?.env?.GH_PAGER).toBe("cat");
  });

  it("reads the repository out of a `gh api` path, not only out of `--repo`", async () => {
    // Found the first time a real daemon ran against the forge, on
    // 2026-08-22: `upsertComment` calls `gh api repos/<owner>/<name>/issues/
    // comments/<id>`, which names its repository in the **path**. The runner
    // read `--repo` alone, refused the call, and the daemon could not say
    // where a ticket stood. Four such call sites existed; the claim that
    // "every gh call passes --repo" came from grepping for `--repo` and
    // finding what it looked for.
    const { run, minted } = harness();

    await run("gh", [
      "api",
      "repos/fvermaut/scratch-app/issues/comments/5293510719",
      "--method",
      "PATCH",
    ]);

    expect(minted).toEqual(["fvermaut/scratch-app"]);
  });

  it("reads it from a path that begins with a slash too", async () => {
    const { run, minted } = harness();

    await run("gh", ["api", "/repos/fvermaut/scratch-app/pulls/9/comments"]);

    expect(minted).toEqual(["fvermaut/scratch-app"]);
  });

  it("still refuses a `gh api` call that names no repository at all", async () => {
    // The refusal has to survive the widening: `gh api /user` is scoped to
    // nothing, and there is no credential this runner may give it.
    const { run, calls } = harness();

    await expect(run("gh", ["api", "/user"])).rejects.toThrow(
      /names no repository/,
    );
    expect(calls).toHaveLength(0);
  });

  it("prefers an explicitly declared repository over the one in the arguments", async () => {
    const { run, minted } = harness();

    await run("gh", ["api", "/repos/fvermaut/ivtrends/issues"], {
      repository: "fvermaut/scratch-app",
    });

    expect(minted).toEqual(["fvermaut/scratch-app"]);
  });

  it("mints per project, so two projects never share one token", async () => {
    const { run, minted } = harness();

    await run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"]);
    await run("gh", ["issue", "list", "--repo", "fvermaut/ivtrends"]);

    expect(minted).toEqual(["fvermaut/scratch-app", "fvermaut/ivtrends"]);
  });
});

describe("refusing to act under nobody's authority", () => {
  it("fails loudly on a command that names no repository, and does not run it", async () => {
    const { run, calls, minted } = harness();

    await expect(run("gh", ["auth", "status"])).rejects.toThrow(
      /names no repository/,
    );
    expect(calls).toHaveLength(0);
    expect(minted).toHaveLength(0);
  });

  it("does not run the command when minting fails", async () => {
    const calls: Invocation[] = [];
    const inner: CommandRunner = async (command, args, opts) => {
      calls.push({ command, args, options: opts });
      return "";
    };
    const credentials: CredentialProvider = {
      async tokenFor() {
        throw new Error("the App key is gone");
      },
    };
    const run = credentialCommandRunner({ credentials, run: inner });

    await expect(
      run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"]),
    ).rejects.toThrow(/the App key is gone/);
    expect(calls).toHaveLength(0);
  });
});

describe("keeping the credential out of everything that is written down", () => {
  it("does not put the token in the error of a failing command", async () => {
    const { run } = harness({
      answer: async () => {
        throw new Error("gh issue list --repo fvermaut/scratch-app failed: 404");
      },
    });

    await expect(
      run("gh", ["issue", "list", "--repo", "fvermaut/scratch-app"]),
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("ghs_secret_token"),
      }),
    );
  });

  it("does not put the token in the error of a failed mint", async () => {
    const credentials: CredentialProvider = {
      async tokenFor() {
        throw new Error("HTTP 401");
      },
    };
    const run = credentialCommandRunner({
      credentials,
      run: async () => "",
    });

    const error = await run("gh", [
      "issue",
      "list",
      "--repo",
      "fvermaut/scratch-app",
    ]).catch((thrown: unknown) => thrown);

    expect(String(error)).not.toContain("ghs_");
  });
});

describe("a forge call that never comes back, and one that comes back wrong", () => {
  /** A spawner that answers from a script, recording how often it was asked. */
  function spawner(...outcomes: (string | Error)[]): {
    spawn: Spawn;
    attempts: () => number;
  } {
    const queue = [...outcomes];
    let attempts = 0;
    const spawn: Spawn = async () => {
      attempts += 1;
      const next = queue.shift();
      if (next === undefined) throw new Error("spawner: nothing left to answer");
      if (next instanceof Error) throw next;
      return next;
    };
    return { spawn, attempts: () => attempts };
  }

  /** The error node reports when it kills a child for running too long. */
  function timedOut(): Error {
    return Object.assign(new Error("Command failed"), { killed: true });
  }

  function transport(message: string): Error {
    return Object.assign(new Error("Command failed"), { stderr: message });
  }

  it("retries a transport failure and reports the answer it finally got", async () => {
    const { spawn, attempts } = spawner(
      transport("dial tcp: lookup api.github.com: EAI_AGAIN"),
      "[]",
    );
    const run = execRunner({ spawn, retryWaitsMs: [0, 0] });

    await expect(run("gh", ["issue", "list"])).resolves.toBe("[]");
    expect(attempts()).toBe(2);
  });

  it("reports a transport failure that never clears, and says how often it tried", async () => {
    const { spawn, attempts } = spawner(
      transport("ECONNRESET"),
      transport("ECONNRESET"),
      transport("ECONNRESET"),
    );
    const run = execRunner({ spawn, retryWaitsMs: [0, 0] });

    await expect(run("gh", ["issue", "list"])).rejects.toThrow(/3 attempts/);
    expect(attempts()).toBe(3);
  });

  it("does not retry an answer the forge meant — a 404 is not a bad connection", async () => {
    const { spawn, attempts } = spawner(
      transport("GraphQL: Could not resolve to an Issue (HTTP 404)"),
    );
    const run = execRunner({ spawn, retryWaitsMs: [0, 0] });

    await expect(run("gh", ["issue", "view", "9999"])).rejects.toThrow(/404/);
    expect(attempts()).toBe(1);
  });

  it("retries a gateway error, which is the forge being unwell rather than answering", async () => {
    const { spawn, attempts } = spawner(
      transport("HTTP 502: Bad gateway"),
      "[]",
    );
    const run = execRunner({ spawn, retryWaitsMs: [0, 0] });

    await expect(run("gh", ["issue", "list"])).resolves.toBe("[]");
    expect(attempts()).toBe(2);
  });

  it("treats a killed child as a transport failure and retries it", async () => {
    const { spawn, attempts } = spawner(timedOut(), "[]");
    const run = execRunner({ spawn, retryWaitsMs: [0, 0] });

    await expect(run("gh", ["issue", "list"])).resolves.toBe("[]");
    expect(attempts()).toBe(2);
  });

  it("says plainly that a hung command was killed, rather than that it failed", async () => {
    const { spawn } = spawner(timedOut(), timedOut(), timedOut());
    const run = execRunner({ spawn, retryWaitsMs: [0, 0] });

    await expect(run("gh", ["issue", "list"])).rejects.toThrow(
      /gave no answer within/,
    );
  });

  it("gives every command a deadline, so a hung forge cannot hang the cycle", async () => {
    const seen: (number | undefined)[] = [];
    const spawn: Spawn = async (_command, _args, options) => {
      seen.push(options.timeout);
      return "";
    };

    await execRunner({ spawn, timeoutMs: 45_000 })("gh", ["issue", "list"]);

    expect(seen).toEqual([45_000]);
  });

  it("has a deadline even when nobody sets one", async () => {
    const seen: (number | undefined)[] = [];
    const spawn: Spawn = async (_command, _args, options) => {
      seen.push(options.timeout);
      return "";
    };

    await execRunner({ spawn })("gh", ["issue", "list"]);

    expect(seen[0]).toBeGreaterThan(0);
  });

  it("waits between attempts rather than hammering a forge that is struggling", async () => {
    const waits: number[] = [];
    const { spawn } = spawner(transport("ECONNRESET"), transport("ECONNRESET"), "[]");
    const run = execRunner({
      spawn,
      retryWaitsMs: [2_000, 8_000],
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    await run("gh", ["issue", "list"]);

    expect(waits).toEqual([2_000, 8_000]);
  });
});
