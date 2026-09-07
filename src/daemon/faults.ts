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
 * `expired` — the token the session was given ran out while it was working.
 * Retried, and this is the correction of a rule that was wrong: `expired`
 * used to be part of `credentials`, on the reasoning that a refused login is
 * refused again. That is true of a login that was revoked and false of one
 * that timed out, because the token is read afresh at every spawn and the
 * host keeps it current. The two used to be one word and one behaviour;
 * telling them apart is what lets the recoverable one recover
 * ([#55](https://github.com/fvermaut/timone/issues/55)).
 *
 * `credentials` — the login is being refused: revoked, wrong, or not
 * entitled. Technical in the same sense, and the one technical stop that
 * trying again cannot mend, because the next attempt presents the same
 * refused login.
 */
export type TechnicalFault = "link" | "expired" | "credentials";

/**
 * Wordings that mean the token ran out rather than that it was refused.
 * Checked before the refusal's, because every one of these also trips a
 * refusal sign — the service says "authentication failed" for both — and the
 * first match wins. Read in that order, an expiry is a refusal that says why.
 *
 * The wording seen live on 2026-08-23 was `401 OAuth access token has
 * expired. Re-authenticate to continue.`
 */
const EXPIRED_SIGNS: readonly string[] = [
  "token has expired",
  "token expired",
  "re-authenticate to continue",
];

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
  if (EXPIRED_SIGNS.some((sign) => text.includes(sign))) return "expired";
  if (CREDENTIAL_SIGNS.some((sign) => text.includes(sign))) return "credentials";
  if (LINK_SIGNS.some((sign) => text.includes(sign))) return "link";
  return undefined;
}

/**
 * The spawner declining to start a session at all — not a session that ran
 * and stopped
 * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
 * D4's second half).
 *
 * **`clears` is the whole reason this is a type rather than a message.**
 * There are two refusals and they want opposite treatment. One clears on its
 * own — uncommitted changes in Timone's own folder, which the human is in the
 * middle of making — and retrying that for ever is correct. The other never
 * clears: a missing workspace, a stage with no prompt, anything wrong with
 * the wiring. Retrying *that* for ever is the stuck run of timone#75, which
 * sat at "picked up, about to start" for two and a half hours.
 *
 * **An unclassified error does not clear**, which is the safe direction and
 * the same one {@link technicalFault} takes: a refusal nobody has taught this
 * about is put in front of a human rather than repeated in silence.
 */
export class SpawnRefusal extends Error {
  constructor(
    message: string,
    readonly clears: boolean,
  ) {
    super(message);
    this.name = "SpawnRefusal";
  }
}

/** Whether a refusal is the kind that goes away without anybody being told. */
export function refusalClears(error: unknown): boolean {
  return error instanceof SpawnRefusal && error.clears;
}

/**
 * The prefix a build-stage escalation's failure reason carries
 * ([ADR-0052](../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)).
 *
 * A stage at `execution`, `verification` or `delivery` that is handed an
 * answer it may not act on no longer parks the run on a person — the
 * question itself is the defect, so the run is filed as failed instead. This
 * is what `session.ts`'s `failBuildEscalation` writes ahead of the
 * escalation comment's own words, and what {@link isBuildEscalation} looks
 * for. It lives here, beside {@link technicalFault}, rather than in
 * `session.ts`: `ctaFor` reads it too, and `session.ts` is the one surface
 * that may load the agent runtime.
 */
export const BUILD_ESCALATION_PREFIX = "a build stage escalated: ";

/**
 * Whether a run's failure reason is a build-stage escalation (ADR-0052)
 * rather than an ordinary technical stop or a defect in the work itself.
 *
 * **Not a `TechnicalFault` variant.** A technical fault is the machine's own
 * infrastructure breaking under it; this is a stage that behaved wrongly by
 * asking a question it had no authority to ask. Both are the machine's fault
 * rather than the reader's, which is why `ctaFor` checks this first and
 * `technicalFault` second, but they are different kinds of wrong and stay
 * different types.
 */
export function isBuildEscalation(failure: string | undefined): boolean {
  return failure !== undefined && failure.startsWith(BUILD_ESCALATION_PREFIX);
}
