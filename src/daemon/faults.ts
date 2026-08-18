/**
 * What kind of stop a failure was, when the daemon can tell
 * ([ADR-0034](../../doc/adr/0034-a-technical-stop-is-retried-not-reported.md)).
 *
 * Its own module, and a pure one, because two surfaces need the same
 * judgement and only one of them may load an agent runtime: the spawner
 * decides whether to try the stage again, and a ticket's standing note
 * decides which words to say about a run that failed. `timone status` renders
 * that note, so a classifier living in `session.ts` would drag the SDK into
 * every terminal command.
 */

/**
 * A stop that is about the machinery rather than about the work
 * ([ADR-0034](../../doc/adr/0034-a-technical-stop-is-retried-not-reported.md)).
 *
 * `link` — the connection to the service a session runs on, or that service
 * itself: a dropped socket, a 500, an overload, a rate limit. Nothing on the
 * ticket caused it and nothing on the ticket mends it, so the daemon tries
 * again rather than reporting it.
 *
 * `credentials` — the login is being refused. Technical in exactly the same
 * sense, and the one technical stop that trying again cannot mend, because
 * the next attempt presents the same refused login.
 */
export type TechnicalFault = "link" | "credentials";

/**
 * Wordings that mean the login was refused. Checked before the link's, since
 * a refusal is not a bad connection and only one of the two is worth
 * repeating.
 */
const CREDENTIAL_SIGNS: readonly string[] = [
  "authentication_failed",
  "authentication_error",
  "invalid_api_key",
  "invalid api key",
  "permission_error",
  "unauthorized",
  "token has expired",
];

/** Wordings that mean the link, or the service at the other end of it, broke. */
const LINK_SIGNS: readonly string[] = [
  "server_error",
  "overloaded_error",
  "overloaded",
  "rate_limit",
  "api_error",
  "timeout",
  "timed out",
  "econnreset",
  "econnrefused",
  "etimedout",
  "enotfound",
  "eai_again",
  "epipe",
  "socket hang up",
  "fetch failed",
  "network error",
  "connection closed",
  "connection error",
  "connection reset",
  "service unavailable",
  "bad gateway",
  "internal server error",
];

/**
 * What kind of stop a failure's own words describe, or undefined when they
 * describe the work.
 *
 * **The runtime says what happened; this decides what it was.** One site, so
 * the SDK, a test's fake and whatever runtime comes next are all judged by
 * the same rule — and so that the rule can be read and argued with in one
 * place rather than inferred from three.
 *
 * **An unrecognised wording is not technical**, which is the safe direction:
 * a stop nobody has taught this function about is put in front of a human
 * rather than retried in silence.
 */
export function technicalFault(error: string | undefined): TechnicalFault | undefined {
  if (error === undefined) return undefined;
  const text = error.toLowerCase();
  if (CREDENTIAL_SIGNS.some((sign) => text.includes(sign))) return "credentials";
  if (LINK_SIGNS.some((sign) => text.includes(sign))) return "link";
  return undefined;
}
