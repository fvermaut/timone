import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  execCommandRunner,
  type CommandRunner,
} from "./command-runner.js";

/**
 * How a boxed session talks to the model.
 *
 * **A box inherits nothing from the host — that is the point of it
 * ([ADR-0041](../../doc/adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md))
 * — and until 2026-08-22 that included the ability to log in.** An in-process
 * session inherits whatever the host is logged in as; a boxed one inherited
 * nothing, so it would have started, cloned both repositories, stood up a
 * compose stack and then failed to authenticate. Recorded as blocker (e) of
 * phase 30 and put to fvermaut, because the two answers differ by a bill and
 * not by any engineering.
 *
 * **He chose his own subscription**, on 2026-08-22, over a separate API key.
 * So the box borrows a live login rather than being given a lasting one:
 *
 * - The token is read **fresh at every spawn** and cached nowhere — not on
 *   disk, not in memory. The host's own CLI refreshes it, so reading late is
 *   reading current; a copy Timone kept would go stale in hours while a
 *   daemon runs for days.
 * - It lives about six hours, which is far longer than a session and far
 *   shorter than anything worth stealing a copy of.
 * - Nothing about it is written down. It travels in the container's
 *   environment, like the forge credential, and never in an argument vector.
 *
 * **What this does cost, and it is worth saying plainly:** while a box runs,
 * a token that can spend fvermaut's subscription is inside it. That is the
 * trade he took, and it is not what ADR-0041 forbids — the ADR keeps the
 * host's *filesystem* out of the box, which is still true.
 */

/** A source of a live model credential. */
export type ModelTokenSource = () => Promise<string>;

/** Where macOS keeps it. */
const KEYCHAIN_SERVICE = "Claude Code-credentials";

/** Where every other platform keeps it. */
const CREDENTIALS_FILE = join(homedir(), ".claude", ".credentials.json");

export interface ClaudeSubscriptionTokenOptions {
  /** Subprocess seam, for the keychain read. */
  run?: CommandRunner;
  /** Injected clock, for the expiry check. */
  now?: () => number;
  /** Reads the credentials file; undefined when there is none. */
  readFile?: () => string | undefined;
}

/** What Claude Code stores, of the parts this cares about. */
interface StoredCredentials {
  claudeAiOauth?: {
    accessToken?: unknown;
    expiresAt?: unknown;
  };
}

/**
 * The access token of whatever Claude subscription this host is logged in to.
 *
 * Throws — naming what to do — when there is no login, when the entry cannot
 * be read, or when the token has expired. **Nothing it throws carries the
 * token**, or the refresh token beside it: these messages go into a daemon
 * log and onto tickets.
 */
export function claudeSubscriptionToken(
  options: ClaudeSubscriptionTokenOptions = {},
): ModelTokenSource {
  const run = options.run ?? execCommandRunner;
  const now = options.now ?? Date.now;
  const readCredentialsFile =
    options.readFile ??
    ((): string | undefined => {
      try {
        return readFileSync(CREDENTIALS_FILE, "utf8");
      } catch {
        return undefined;
      }
    });

  return async () => {
    // The file first: where it exists it is the whole answer, and asking the
    // keychain on a host that has no keychain is a subprocess for nothing.
    let raw = readCredentialsFile();

    if (raw === undefined) {
      try {
        raw = await run("security", [
          "find-generic-password",
          "-s",
          KEYCHAIN_SERVICE,
          "-w",
        ]);
      } catch {
        throw new Error(
          "This machine is not logged in to Claude, so a boxed run has no way " +
            "to reach the model. Run `claude` once and log in, then start the " +
            "daemon again.",
        );
      }
    }

    const stored = parse(raw);
    const token = stored?.claudeAiOauth?.accessToken;
    const expiresAt = stored?.claudeAiOauth?.expiresAt;

    if (typeof token !== "string" || token === "") {
      throw new Error(
        "Timone could not read this machine's Claude login — the stored " +
          "credential is not the shape it expects. Run `claude` once and log " +
          "in again.",
      );
    }

    if (typeof expiresAt === "number" && expiresAt <= now()) {
      // The host's CLI refreshes on use, so this means nobody has opened
      // Claude Code for a while rather than that anything is broken.
      throw new Error(
        "This machine's Claude login has expired, so a boxed run cannot reach " +
          "the model. Run `claude` once — that refreshes it — and start the " +
          "daemon again.",
      );
    }

    return token;
  };
}

/** Parse the stored credential, answering undefined for anything unreadable. */
function parse(raw: string): StoredCredentials | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null
      ? (value as StoredCredentials)
      : undefined;
  } catch {
    // Deliberately swallowed: the parse error would quote the payload, and
    // the payload is two secrets.
    return undefined;
  }
}
