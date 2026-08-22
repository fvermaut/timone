import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Timone's own identity on the forge, and the credential it acts under.
 *
 * Timone is a **GitHub App installed on the managed repositories**, not a
 * second account invited to them
 * ([ADR-0042](../../doc/adr/0042-timone-acts-under-its-own-identity.md), as
 * amended). Installation is the grant and the repository selection is the
 * scoping, so there is no per-repository invitation to record anywhere.
 *
 * The credential is minted here in three steps, all of them documented
 * platform calls rather than design work: sign a JWT with the App's private
 * key, exchange it for an installation access token **naming one
 * repository**, and cache it for its one-hour life so a poll cycle does not
 * re-mint per call.
 *
 * **The repository array is the whole of the scoping**, and it is what makes
 * this module worth having. A token minted with `{"repositories":
 * ["scratch-app"]}` answers HTTP 200 on `scratch-app` and HTTP **404** on
 * `ivtrends`, both being inside the same installation — the second repository
 * is *invisible*, not merely refused. A token that cannot see a repository
 * cannot be talked into acting on one by a confused agent, and there is no
 * "permission denied" for an error message to leak the name into. Watched by
 * hand on 2026-08-21; asserted in `credentials.test.ts` on the argument vector
 * of the mint request, because a thing observed once by hand is not a
 * regression guard.
 *
 * **The installation id is an installation's, not a project's.** One
 * installation covers every selected repository, and the per-repository
 * narrowing happens at the mint call and only there. An implementation that
 * mints once per cycle and reuses the token across projects has thrown away
 * the whole property this module exists to buy — which is why
 * {@link githubAppCredentials} caches per repository rather than per provider.
 */

/** The mint call's argument vector, made a value so a test can read it. */
export interface MintRequest {
  /** The installation's `access_tokens` endpoint. */
  url: string;
  /** The RS256 assertion proving this is the App. */
  jwt: string;
  /** The repositories the minted token may see — always exactly one. */
  repositories: string[];
}

/** What the forge answers with: a token and when it dies. */
export interface MintedToken {
  token: string;
  /** ISO 8601, as GitHub returns it. */
  expiresAt: string;
}

/**
 * How a credential is exchanged for a token. A seam so the whole provider can
 * be driven without a network — and so the scoping assertion has an argument
 * vector to read.
 */
export type MintCall = (request: MintRequest) => Promise<MintedToken>;

/** A source of short-lived credentials, each authorising one repository. */
export interface CredentialProvider {
  /**
   * A token authorising `repository` — given as GitHub's `owner/name` — and
   * no other repository. Cached until it is close to expiry.
   */
  tokenFor(repository: string): Promise<string>;
}

export interface GitHubAppCredentialOptions {
  /** The App's numeric id. */
  appId: number;
  /** The installation on the account that owns the managed repositories. */
  installationId: number;
  /** Path to the App's private key, in PEM. Read at mint time, never held. */
  privateKeyPath: string;
  /** Injected mint call; defaults to the real endpoint over `fetch`. */
  mint?: MintCall;
  /** Injected clock, for the cache's expiry arithmetic. */
  now?: () => Date;
}

/**
 * How long before a token's stated expiry it stops being reused. A cycle that
 * starts a call at 59:59 must not have it arrive with a dead token, and the
 * cost of being early is one extra mint an hour.
 */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/**
 * How far in the past the assertion claims to have been issued. GitHub
 * rejects a JWT whose `iat` is in the future, and a laptop clock that runs a
 * few seconds fast is the ordinary case rather than the exotic one.
 */
const CLOCK_SKEW_SECONDS = 60;

/** GitHub's ceiling on an App assertion's life. */
const ASSERTION_LIFE_SECONDS = 9 * 60;

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

/**
 * Reduce GitHub's `owner/name` to the bare `name` the mint call wants.
 *
 * Throws naming what it was given: a repository that cannot be reduced is a
 * call whose scope is unknown, and the one thing this module may never do is
 * guess wide.
 */
function repositoryName(repository: string): string {
  const parts = repository.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new Error(
      `Cannot mint a credential for "${repository}": expected GitHub's "owner/name".`,
    );
  }
  return parts[1];
}

/** The default mint call: the real endpoint, over `fetch`. */
const fetchMint: MintCall = async ({ url, jwt, repositories }) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repositories }),
  });

  if (!response.ok) {
    // The body is GitHub's message, never the assertion or the token: this
    // error is going into a log.
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Minting a credential for ${repositories.join(", ")} failed: HTTP ${response.status}${
        detail === "" ? "" : ` — ${detail.slice(0, 500)}`
      }`,
    );
  }

  const body = (await response.json()) as { token?: string; expires_at?: string };
  if (typeof body.token !== "string" || typeof body.expires_at !== "string") {
    throw new Error(
      `Minting a credential for ${repositories.join(", ")} returned an unexpected shape.`,
    );
  }
  return { token: body.token, expiresAt: body.expires_at };
};

/**
 * A {@link CredentialProvider} backed by a GitHub App installation.
 *
 * Caches per repository, deliberately: see the module note — one token per
 * installation would be exactly the mistake the scoping exists to prevent.
 */
export function githubAppCredentials(
  options: GitHubAppCredentialOptions,
): CredentialProvider {
  const mint = options.mint ?? fetchMint;
  const now = options.now ?? (() => new Date());
  const cache = new Map<string, MintedToken>();

  function assertion(): string {
    let key: string;
    try {
      key = readFileSync(options.privateKeyPath, "utf8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot read the Timone App private key at "${options.privateKeyPath}": ${reason}`,
      );
    }

    const issuedAt = Math.floor(now().getTime() / 1000) - CLOCK_SKEW_SECONDS;
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({
        iat: issuedAt,
        exp: issuedAt + ASSERTION_LIFE_SECONDS,
        iss: String(options.appId),
      }),
    );

    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(key).toString("base64url");
    return `${header}.${payload}.${signature}`;
  }

  return {
    async tokenFor(repository) {
      const name = repositoryName(repository);

      const cached = cache.get(name);
      if (
        cached !== undefined &&
        Date.parse(cached.expiresAt) - now().getTime() > EXPIRY_MARGIN_MS
      ) {
        return cached.token;
      }

      const minted = await mint({
        url: `https://api.github.com/app/installations/${options.installationId}/access_tokens`,
        jwt: assertion(),
        // Exactly one. This array is the scoping.
        repositories: [name],
      });
      cache.set(name, minted);
      return minted.token;
    },
  };
}
