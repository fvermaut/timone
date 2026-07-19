# Standards — better-auth

> **Status: Draft — pending review (fvermaut).**
> Scope: authentication with better-auth in our Next.js + Prisma + PostgreSQL stack. Verified against better-auth docs, July 2026 (stable line **1.6.x**; 1.7.0 is in RC on the `next` channel). better-auth moves fast — items marked *churn* must be re-verified at onboarding time.

## Version & upgrade posture

- Pin to the **stable line** (`1.6.x` as of this draft); never adopt the `next` channel in a client project. New capabilities land on stable only when non-breaking; breaking changes go through `next` first ([release policy](https://github.com/better-auth/better-auth/releases)).
- Auth is the one dependency where lagging is a liability: the [June 2026 security update](https://better-auth.com/blog/security-update-june-2026) fixed 15 vulnerabilities (up to Critical) across core and plugins. Watch the GitHub Security Advisories tab; when bumping, also bump scoped plugin packages (`@better-auth/sso` etc.) — updating `better-auth` alone does not pull them.
- Treat an upgrade as a schema event: re-run `generate` (see Tooling) and diff the Prisma schema before assuming a patch bump is schema-neutral.

## Configuration posture

- One server instance in `lib/auth.ts`, exported as `auth` — the CLI detects it by that name/location ([installation](https://www.better-auth.com/docs/installation)). One client instance in `lib/auth-client.ts` from `better-auth/react`. No second instance anywhere, ever; all auth options live in these two files.
- `BETTER_AUTH_SECRET` (≥ 32 chars, generated with `npx auth@latest secret`) and `BETTER_AUTH_URL` per environment. For rotation, use the versioned-secrets mechanism (`secrets` option / `BETTER_AUTH_SECRETS`) — old sessions stay decryptable via fallback keys, so rotation is not a forced global logout ([security reference](https://www.better-auth.com/docs/reference/security)).

## Session strategy

- **Database-backed cookie sessions (the default) are our strategy.** No stateless/JWT-only sessions for app login: server-side sessions are what make revocation immediate, which OWASP treats as the core property of session management ([OWASP cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)). Session tokens live only in httpOnly cookies — never mirrored into localStorage or client state.
- Defaults are acceptable and should not be tuned without a reason in `doc/standards.md`: `expiresIn` 7 days (absolute), `updateAge` 1 day (sliding refresh) ([session management](https://www.better-auth.com/docs/concepts/session-management)). Shorten both for projects handling sensitive data; never lengthen past defaults.
- `cookieCache` trades revocation latency for a saved DB round-trip: a revoked session stays valid up to `maxAge` on cached reads. Enable it only when per-request session lookups are a *measured* problem, and keep `maxAge` ≤ 5 minutes. *(churn: encoding strategies — `compact`/`jwt`/`jwe` — are recent; re-verify.)*
- Use session **freshness** (`freshAge`) as the gate for destructive account operations (password change, account deletion) instead of hand-rolled re-auth checks.

## Integration conventions

- **Prisma adapter** with `provider: "postgresql"`. Schema flow: `npx auth@latest generate` writes the better-auth models into the Prisma schema; migration is then *ours* via `prisma migrate dev` — the better-auth CLI `migrate` command does not support Prisma ([CLI docs](https://www.better-auth.com/docs/concepts/cli)). Never hand-edit generated auth models except to add fields better-auth explicitly supports extending. *(churn: adapter packaging is shifting from `better-auth/adapters/prisma` to a scoped `@better-auth/prisma-adapter`; Prisma 7+ requires importing PrismaClient from the configured output path.)*
- Mount once at `app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)` ([Next.js integration](https://www.better-auth.com/docs/integrations/next)). No custom auth endpoints beside it — extend through plugins or `auth.api` calls in server code.
- Server-side session access is always `auth.api.getSession({ headers: await headers() })` in RSC, route handlers, and server actions. **The authorization check lives in the page/layout/action that serves the data, not in middleware**: middleware may use `getSessionCookie(request)` only as an optimistic fast redirect — it proves a cookie exists, not that the session is valid.
- Any server action that signs in/out or mutates the session requires the `nextCookies()` plugin, **last** in the plugin array — server actions can't set cookies otherwise.
- Client components use `useSession` and the `auth-client` methods; never `fetch` the auth API routes directly.

## Plugin posture

Prefer an official plugin over custom code for anything that is an *auth flow* (it ships endpoints, schema, and client typing as a tested unit); write custom code only for business logic that merely reads the session ([plugins](https://www.better-auth.com/docs/concepts/plugins)).

- **`twoFactor`** — when the PRD covers admin/back-office access or regulated data; not by default on consumer sign-up.
- **`organization`** — the moment a project says "teams", "workspaces", or per-tenant roles. Do not model tenancy tables by hand next to better-auth's user model.
- **`magicLink`** — preferred passwordless option for low-friction consumer products; it removes the password-reset surface entirely.
- Every server plugin needs its **matching client plugin**, and adding one is a schema event: re-run `generate` + a Prisma migration before it works.

## Security defaults worth stating

- **Never set `disableCSRFCheck` or `disableOriginCheck`.** better-auth's CSRF story is layered (origin validation, `SameSite=Lax`, Fetch-Metadata checks) and these flags exist for exotic backends we don't have ([security reference](https://www.better-auth.com/docs/reference/security)).
- `trustedOrigins` is explicit per environment: exact origins, no `localhost` entries in production config, and prefer scheme-qualified wildcards (`https://*.example.com`) over bare `*.example.com` when previews need a wildcard.
- Rate limiting is on by default **in production only** and its default storage is **in-memory — useless on Vercel/serverless where instances don't share memory**. On serverless deploys set `rateLimit.storage` to `"database"` or `"secondary-storage"` ([rate limit](https://www.better-auth.com/docs/concepts/rate-limit)). Defaults (100 req/60 s, 3/10 s on `/sign-in/email`) stand unless load testing says otherwise.
- Behind a proxy/CDN, configure `advanced.ipAddress.ipAddressHeaders` + `trustedProxies` — otherwise rate limiting keys on a spoofable `X-Forwarded-For`.

## Tooling

Enforce mechanically, not in review prose:

- **Schema drift check (CI):** run `npx auth@latest generate` and fail on git diff — catches upgrades/plugins that changed the auth schema without a migration.
- **Env validation at boot** (zod or equivalent): `BETTER_AUTH_SECRET` present and ≥ 32 chars, `BETTER_AUTH_URL` set — fail fast, not at first sign-in.
- **Dependency alerts** (Renovate/Dependabot + GitHub security advisories) on `better-auth` and all `@better-auth/*` packages.

## Sources

- better-auth docs (v1.6, July 2026): [installation](https://www.better-auth.com/docs/installation) · [session management](https://www.better-auth.com/docs/concepts/session-management) · [security reference](https://www.better-auth.com/docs/reference/security) · [rate limit](https://www.better-auth.com/docs/concepts/rate-limit) · [CLI](https://www.better-auth.com/docs/concepts/cli) · [Prisma adapter](https://www.better-auth.com/docs/adapters/prisma) · [Next.js integration](https://www.better-auth.com/docs/integrations/next) · [plugins](https://www.better-auth.com/docs/concepts/plugins)
- [Security update: June 2026](https://better-auth.com/blog/security-update-june-2026) · [Releases](https://github.com/better-auth/better-auth/releases)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
