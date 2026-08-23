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
 * - Nothing about it is written down. It travels in the container's
 *   environment, like the forge credential, and never in an argument vector.
 *
 * **What this does cost, and it is worth saying plainly:** while a box runs,
 * a token that can spend fvermaut's subscription is inside it. That is the
 * trade he took, and it is not what ADR-0041 forbids — the ADR keeps the
 * host's *filesystem* out of the box, which is still true.
 *
 * ## What a borrowed token cannot do, and what to use instead
 *
 * This file used to say the token "lives about six hours, which is far
 * longer than a session". **The first half is true and the second is not**,
 * and a run paid for the difference: `ivtrends#24` on 2026-08-23 ran for
 * three hours and was refused mid-sentence with `401 OAuth access token has
 * expired`, losing 134 turns and $43 of work
 * ([#55](https://github.com/fvermaut/timone/issues/55)).
 *
 * The six hours are counted from when the *host* last refreshed, not from the
 * spawn, so a box is handed whatever happens to be left — sometimes minutes.
 * Nothing inside can renew it: the refresh token is not passed in and the
 * host's file is not mounted, which is ADR-0041 working as intended. A
 * borrowed token therefore sets a deadline the run knows nothing about.
 *
 * So there are two sources now, in order of preference:
 *
 * 1. **A lasting token, from `claude setup-token`**, read out of the daemon's
 *    own environment. That command exists for exactly this case and issues a
 *    credential that outlives any run. When it is set, this asks the host
 *    nothing.
 * 2. **The host's login, borrowed as before** — the fallback, so a daemon
 *    still starts on a machine where nobody has run `setup-token`. It is now
 *    refused when too little of it is left to be worth starting a run on,
 *    rather than only when it is already dead: the old check let a token with
 *    one minute on it start a two-hour session.
 */

/** A source of a live model credential. */
export type ModelTokenSource = () => Promise<string>;

/** Where macOS keeps it. */
const KEYCHAIN_SERVICE = "Claude Code-credentials";

/**
 * The environment variable a lasting token arrives in — the same name the CLI
 * itself reads, so a daemon started in a shell that already has one needs no
 * setting of its own.
 */
const LASTING_TOKEN_VAR = "CLAUDE_CODE_OAUTH_TOKEN";

/**
 * How much of a borrowed token has to be left for a run to be worth starting.
 *
 * **This is a floor, not a promise.** No margin can guarantee a borrowed
 * token covers a run, because a run's length is not known when it starts and
 * sessions here go on for hours. What it does buy is that a run is not
 * started on a credential that is about to die — which is what happened
 * before, when the only question asked was whether the token was already
 * dead. A daemon that hits this often is a daemon that should be given a
 * lasting token instead, and the message says so.
 */
const BORROWED_MARGIN_MS = 30 * 60 * 1000;

/** Where every other platform keeps it. */
const CREDENTIALS_FILE = join(homedir(), ".claude", ".credentials.json");

export interface ClaudeSubscriptionTokenOptions {
  /** Subprocess seam, for the keychain read. */
  run?: CommandRunner;
  /** Injected clock, for the expiry check. */
  now?: () => number;
  /** Reads the credentials file; undefined when there is none. */
  readFile?: () => string | undefined;
  /** The environment to look for a lasting token in. Defaults to the daemon's. */
  env?: Record<string, string | undefined>;
}

/** What Claude Code stores, of the parts this cares about. */
interface StoredCredentials {
  claudeAiOauth?: {
    accessToken?: unknown;
    expiresAt?: unknown;
  };
}

/**
 * A lasting token if the daemon was given one, and otherwise the access token
 * of whatever Claude subscription this host is logged in to.
 *
 * Throws — naming what to do — when there is no login, when the entry cannot
 * be read, or when too little of the borrowed token is left to start a run
 * on. **Nothing it throws carries the token**, or the refresh token beside
 * it: these messages go into a daemon log and onto tickets.
 */
export function claudeSubscriptionToken(
  options: ClaudeSubscriptionTokenOptions = {},
): ModelTokenSource {
  return async () => (await resolveModelLogin(options)).token;
}

/**
 * Which login a boxed run would be given, said in one line, **without the
 * token in it**.
 *
 * **The point of this is that a daemon can be checked rather than trusted.**
 * A lasting token arrives in an environment variable, and an environment
 * variable is one new terminal, one reboot or one edited profile away from
 * being absent — at which point the daemon silently goes back to borrowing
 * the host's login and long runs start dying again months later, for a reason
 * nobody connects to a shell that forgot something
 * ([#55](https://github.com/fvermaut/timone/issues/55)).
 *
 * So the daemon says which one it has at startup, every time. A refusal is
 * returned here as its own words rather than thrown: this is a report, and a
 * daemon must not fail to start because it could not describe itself.
 */
export async function modelLoginSummary(
  options: ClaudeSubscriptionTokenOptions = {},
): Promise<string> {
  const now = options.now ?? Date.now;
  try {
    const login = await resolveModelLogin(options);
    if (login.source === "lasting") {
      return "Model login: a lasting token, from this daemon's environment. Runs of any length are covered.";
    }
    const left =
      login.expiresAt === undefined
        ? undefined
        : Math.round((login.expiresAt - now()) / 60000);
    return (
      "Model login: borrowed from this machine's Claude login" +
      (left === undefined ? "" : `, about ${left} minute(s) left`) +
      ". A run that lasts longer than that is refused partway and loses its " +
      "work. Give the daemon a lasting token with `claude setup-token`."
    );
  } catch (error) {
    return `Model login: none usable. ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Which login there is, and — for a borrowed one — when it dies. */
type ModelLogin =
  | { source: "lasting"; token: string }
  | { source: "borrowed"; token: string; expiresAt?: number };

/**
 * The one place the two sources are chosen between, so what a run is given
 * and what the daemon says it will be given can never disagree.
 */
async function resolveModelLogin(
  options: ClaudeSubscriptionTokenOptions,
): Promise<ModelLogin> {
  const run = options.run ?? execCommandRunner;
  const now = options.now ?? Date.now;
  const env = options.env ?? process.env;
  const readCredentialsFile =
    options.readFile ??
    ((): string | undefined => {
      try {
        return readFileSync(CREDENTIALS_FILE, "utf8");
      } catch {
        return undefined;
      }
    });

  // A lasting token beats a borrowed one, and asking the host anything at
  // all is pointless once there is one: it has no expiry to read, no
  // keychain to unlock and nothing that runs out mid-run.
  const lasting = env[LASTING_TOKEN_VAR];
  if (typeof lasting === "string" && lasting.trim() !== "") {
    return { source: "lasting", token: lasting.trim() };
  }

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

  if (typeof expiresAt === "number") {
    const leftMs = expiresAt - now();

    if (leftMs <= 0) {
      // The host's CLI refreshes on use, so this means nobody has opened
      // Claude Code for a while rather than that anything is broken.
      throw new Error(
        "This machine's Claude login has expired, so a boxed run cannot " +
          "reach the model. Run `claude` once — that refreshes it — and " +
          "start the daemon again.",
      );
    }

    if (leftMs < BORROWED_MARGIN_MS) {
      // Refused rather than started, because the run would die partway and
      // everything it had done would be thrown away (#55). Better to lose
      // the start than the hour.
      throw new Error(
        `This machine's Claude login has about ${Math.round(leftMs / 60000)} ` +
          "minute(s) left, which is not enough to start a run on — a run " +
          "that outlives it loses everything it has done. Run `claude` " +
          "once to refresh it, or give the daemon a lasting token with " +
          `\`claude setup-token\` and start it with ${LASTING_TOKEN_VAR} set.`,
      );
    }
  }

  return typeof expiresAt === "number"
    ? { source: "borrowed", token, expiresAt }
    : { source: "borrowed", token };
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
