import { describe, expect, it } from "vitest";

import type { CommandRunner } from "./command-runner.js";
import { claudeSubscriptionToken } from "./model-token.js";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-08-22T12:00:00Z");

/** The keychain entry as Claude Code actually writes it. */
function entry(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    claudeAiOauth: {
      accessToken: "sk-ant-oat-secret",
      refreshToken: "sk-ant-ort-secret",
      expiresAt: NOW + 6 * HOUR,
      refreshTokenExpiresAt: NOW + 25 * 24 * HOUR,
      scopes: ["user:inference"],
      subscriptionType: "max",
      ...overrides,
    },
  });
}

function source(
  reply: string | Error,
  options: { readFile?: () => string | undefined } = {},
) {
  const calls: string[][] = [];
  const run: CommandRunner = async (_command, args) => {
    calls.push(args);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return {
    calls,
    token: claudeSubscriptionToken({
      run,
      now: () => NOW,
      readFile: options.readFile ?? ((): string | undefined => undefined),
    }),
  };
}

describe("the token a boxed session talks to the model with", () => {
  it("reads the subscription's access token", async () => {
    const { token } = source(entry());

    await expect(token()).resolves.toBe("sk-ant-oat-secret");
  });

  it("reads it fresh every time, and caches nothing", async () => {
    // The host's own CLI refreshes this token; a cached copy goes stale in
    // hours and a daemon runs for days. Nothing here stores it, on disk or
    // in memory, which is also the whole of what fvermaut agreed to: the
    // box borrows a live login, it is not given a lasting one.
    const { token, calls } = source(entry());

    await token();
    await token();

    expect(calls).toHaveLength(2);
  });

  it("prefers the credentials file where one exists", async () => {
    // Linux, and any host where Claude Code writes a file instead of using a
    // keychain. The daemon runs on a Mac today (ADR-0003); this costs five
    // lines and stops the box being macOS-only for no reason.
    const { token, calls } = source(new Error("no keychain here"), {
      readFile: () => entry({ accessToken: "sk-ant-oat-from-file" }),
    });

    await expect(token()).resolves.toBe("sk-ant-oat-from-file");
    expect(calls).toHaveLength(0);
  });

  it("says what to do when there is no login at all", async () => {
    const { token } = source(new Error("SecKeychainSearchCopyNext: not found"));

    await expect(token()).rejects.toThrow(/claude/i);
    await expect(token()).rejects.toThrow(/log in/i);
  });

  it("says what to do when the login has expired", async () => {
    // The host CLI refreshes on use, so an expired token means nobody has
    // opened Claude Code for a while — a thing fvermaut fixes in one step.
    const { token } = source(entry({ expiresAt: NOW - HOUR }));

    await expect(token()).rejects.toThrow(/expired/i);
    await expect(token()).rejects.toThrow(/claude/i);
  });

  it("refuses an entry it cannot read, rather than passing nonsense to the box", async () => {
    const { token } = source("not json at all");

    await expect(token()).rejects.toThrow(/could not read/i);
  });

  it("refuses an entry carrying no access token", async () => {
    const { token } = source(JSON.stringify({ claudeAiOauth: { expiresAt: 1 } }));

    await expect(token()).rejects.toThrow(/could not read/i);
  });

  it("never puts the token in anything it throws", async () => {
    const { token } = source(entry({ expiresAt: NOW - HOUR }));

    const error = await token().catch((thrown: unknown) => String(thrown));

    expect(error).not.toContain("sk-ant-oat-secret");
    expect(error).not.toContain("sk-ant-ort-secret");
  });
});
