import { describe, expect, it } from "vitest";

import {
  credentialCommandRunner,
  type CommandOptions,
  type CommandRunner,
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
