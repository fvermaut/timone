# Standards — better-auth

> **Status: Draft — pending review (fvermaut).**
> Scope: authentication with better-auth in our Next.js + Prisma + PostgreSQL stack. Verified against better-auth docs, July 2026 (stable line **1.6.x**; 1.7.0 in RC on `next`). better-auth moves fast — items marked *churn* must be re-verified at onboarding time.

## Version & upgrade posture

- Pin to the **stable line** (`1.6.x` as of this draft); never adopt the `next` channel in a client project ([release policy](https://github.com/better-auth/better-auth/releases)).
- Auth is the one dependency where lagging is a liability: the [June 2026 security update](https://better-auth.com/blog/security-update-june-2026) fixed 15 vulnerabilities (up to Critical). Watch GitHub Security Advisories; when bumping, also bump scoped plugin packages (`@better-auth/sso` etc.) — updating `better-auth` alone does not pull them.
- Treat an upgrade as a schema event: re-run `generate` and diff the Prisma schema before assuming a patch bump is schema-neutral.

## Configuration posture

- One server instance in `lib/auth.ts` exported as `auth` (the CLI detects it there — [installation](https://www.better-auth.com/docs/installation)); one client instance in `lib/auth-client.ts` from `better-auth/react`. No second instance anywhere; all auth options live in these two files.
- `BETTER_AUTH_SECRET` (≥ 32 chars, `npx auth@latest secret`) and `BETTER_AUTH_URL` per environment. Rotate via the versioned-secrets mechanism (`secrets` / `BETTER_AUTH_SECRETS`) — fallback keys keep old sessions decryptable, so rotation isn't a forced global logout ([security reference](https://www.better-auth.com/docs/reference/security)).

## Session strategy

- **Database-backed cookie sessions (the default).** No stateless/JWT-only sessions for app login — server-side sessions make revocation immediate ([OWASP cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)). Tokens live only in httpOnly cookies — never mirrored to localStorage or client state.
- Defaults stand unless `doc/standards.md` records a reason: `expiresIn` 7 days (absolute), `updateAge` 1 day (sliding) ([session management](https://www.better-auth.com/docs/concepts/session-management)). Shorten for sensitive data; never lengthen.
- `cookieCache` trades revocation latency for a saved DB round-trip (revoked sessions stay valid up to `maxAge` on cached reads). Enable only for a *measured* problem, `maxAge` ≤ 5 minutes. *(churn: `compact`/`jwt`/`jwe` encoding strategies are recent; re-verify.)*
- Use session **freshness** (`freshAge`) to gate destructive account operations (password change, deletion) instead of hand-rolled re-auth.

## Integration conventions

- **Prisma adapter**, `provider: "postgresql"`. Schema flow: `npx auth@latest generate` writes the models; migration is *ours* via `prisma migrate dev` — the better-auth CLI `migrate` does not support Prisma ([CLI docs](https://www.better-auth.com/docs/concepts/cli)). Never hand-edit generated models except fields better-auth explicitly supports extending. *(churn: adapter packaging shifting to `@better-auth/prisma-adapter`; Prisma 7+ imports PrismaClient from the configured output path.)*
- Mount once at `app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)` ([Next.js integration](https://www.better-auth.com/docs/integrations/next)). No custom auth endpoints beside it — extend via plugins or `auth.api` calls in server code.
- Server-side session access is always `auth.api.getSession({ headers: await headers() })`. **The authorization check lives in the page/layout/action serving the data, not middleware**: middleware may use `getSessionCookie(request)` only as an optimistic fast redirect — it proves a cookie exists, not that the session is valid.
- Server actions that sign in/out or mutate the session require the `nextCookies()` plugin, **last** in the plugin array.
- Client components use `useSession` and `auth-client` methods; never `fetch` the auth API routes directly.

## Plugin posture

Prefer an official plugin over custom code for anything that is an *auth flow* (endpoints + schema + client typing as a tested unit); custom code only for business logic that merely reads the session ([plugins](https://www.better-auth.com/docs/concepts/plugins)).

- **`twoFactor`** — when the PRD covers admin/back-office access or regulated data; not by default on consumer sign-up.
- **`organization`** — the moment a project says "teams"/"workspaces"/per-tenant roles; never model tenancy tables by hand next to better-auth's user model.
- **`magicLink`** — preferred passwordless option for low-friction consumer products (removes the password-reset surface).
- Every server plugin needs its **matching client plugin**; adding one is a schema event: re-run `generate` + a Prisma migration.

## Security defaults worth stating

- **Never set `disableCSRFCheck` or `disableOriginCheck`** — better-auth's layered CSRF story (origin validation, `SameSite=Lax`, Fetch-Metadata) covers us; the flags exist for exotic backends we don't have ([security reference](https://www.better-auth.com/docs/reference/security)).
- `trustedOrigins` explicit per environment: exact origins, no `localhost` in production, prefer scheme-qualified wildcards (`https://*.example.com`) when previews need one.
- Rate limiting is on by default in production only and its default storage is **in-memory — useless on Vercel/serverless**. On serverless set `rateLimit.storage` to `"database"` or `"secondary-storage"` ([rate limit](https://www.better-auth.com/docs/concepts/rate-limit)). Defaults (100 req/60 s; 3/10 s on `/sign-in/email`) stand unless load testing says otherwise.
- Behind a proxy/CDN, configure `advanced.ipAddress.ipAddressHeaders` + `trustedProxies` — otherwise rate limiting keys on a spoofable `X-Forwarded-For`.

## Tooling

- **Schema drift check (CI):** run `npx auth@latest generate`, fail on git diff — catches upgrades/plugins that changed the auth schema without a migration.
- **Env validation at boot** (zod or equivalent): `BETTER_AUTH_SECRET` present and ≥ 32 chars, `BETTER_AUTH_URL` set — fail fast, not at first sign-in.
- **Dependency alerts** (Renovate/Dependabot + advisories) on `better-auth` and all `@better-auth/*` packages.

## Sources

- better-auth docs (v1.6, July 2026): [installation](https://www.better-auth.com/docs/installation) · [session management](https://www.better-auth.com/docs/concepts/session-management) · [security reference](https://www.better-auth.com/docs/reference/security) · [rate limit](https://www.better-auth.com/docs/concepts/rate-limit) · [CLI](https://www.better-auth.com/docs/concepts/cli) · [Prisma adapter](https://www.better-auth.com/docs/adapters/prisma) · [Next.js integration](https://www.better-auth.com/docs/integrations/next) · [plugins](https://www.better-auth.com/docs/concepts/plugins)
- [Security update: June 2026](https://better-auth.com/blog/security-update-june-2026) · [Releases](https://github.com/better-auth/better-auth/releases)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
