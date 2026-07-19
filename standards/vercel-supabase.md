# Standards — Vercel + Supabase (go-to live)

> **Status: Draft — pending review (fvermaut).**
> Scope: the *default* live-deployment stack; per-project deviations go in that project's `doc/standards.md`. Local runtime: `docker-compose-local.md`; data layer: `prisma-postgresql.md`; identity: `better-auth.md`.

## Division of responsibilities

- **Vercel** hosts the Next.js app (builds, edge network, serverless functions, env config). Nothing else runs there — no databases, no long-lived workers.
- **Supabase** is managed Postgres plus backups (optionally Storage for user uploads). That is *all* we take from it.
- **We do not use Supabase Auth** — better-auth owns identity, its tables in the same Postgres via Prisma. Consequences:
  - Authorization lives in the Next.js server layer; RLS policies keyed to `auth.uid()` are meaningless here — do not build on them.
  - The client never talks to Supabase directly: no `supabase-js` in the browser, no Data API/PostgREST exposure; all data access goes through Prisma on the server. The publishable key (`sb_publishable_...`) is unused unless a project adopts client-side Storage (a per-project deviation).
  - Secret keys (`sb_secret_...`, legacy `service_role` JWT) bypass RLS entirely; Vercel server-side env vars only, never bundled for the browser.

## Environments and secrets on Vercel

- Every env var is scoped explicitly to Production / Preview / Development — no "all environments" defaults for anything database- or auth-shaped. Preview points at a non-production database; Production values exist only in the Production scope.
- Mark production secrets (`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, any `sb_secret_...`) as **Sensitive** (non-readable after creation). Vercel redacts sensitive values ≥ 32 chars from build logs — don't rely on that alone.
- `NEXT_PUBLIC_` is a publication decision: nothing connection-string-, key-, or token-shaped ever gets it. When in doubt, server-side.
- Local dev env comes from `vercel env pull` (Development scope) or compose-local defaults — never hand-copied production values.

## Local Postgres → Supabase (the Prisma path)

Dev and CI run against local Docker Postgres; Supabase enters at go-live, receiving the same committed Prisma migrations — never hand-applied drift via the dashboard SQL editor.

Two connection strings, always (Vercel functions are transient, so pooling is mandatory):

- `DATABASE_URL` (runtime): Supavisor **transaction mode**, port **6543**, with `?pgbouncer=true` — transaction mode doesn't support prepared statements, and omitting the flag produces intermittent prepared-statement errors under load, not a clean failure.
- `DIRECT_URL` (Prisma CLI: `migrate deploy`, introspection): the **direct** connection (or session pooler on IPv4-only networks), port **5432**. Migrations never run through the transaction pooler.

Also: create a dedicated `prisma` database role instead of connecting as `postgres` (Supabase's own recommendation — isolates credentials, identifiable traffic). The shared Supavisor pooler is the default; dedicated PgBouncer (paid) is a per-project upgrade when latency measurably matters.

## Preview posture (vs ADR-0005)

Default preview mechanism is **timone's own Docker previews** (ADR-0005). Vercel preview deployments are the *exception* — when a project is already Vercel-connected on the customer's account or the customer wants Vercel's PR workflow. When in play:

- Preview-scoped env vars point at a separate Supabase project or preview branch — never production; branch-specific overrides for the rare PR needing its own values.
- Supabase branching is metered per branch-hour (~$0.013/h) — tear branches down on PR close, same discipline ADR-0005 imposes on Docker previews.
- Keep Vercel deployment protection (Vercel Authentication) on preview URLs — customer pre-release work is not publicly browsable.

## Cost and limits judgement

- **Vercel Hobby is non-commercial by its fair-use terms.** Customer work goes on Pro — compliance, not resources. Configure Pro's spend management rather than discovering overage retroactively.
- **Supabase Free is not a customer-production tier** (pauses after 1 week inactivity, no automated backups, 500 MB / shared compute) — throwaway experiments only. Customer production starts at Pro ($25/mo, 7-day backups, 8 GB disk).
- Supabase Pro ships with the **spend cap on** — services degrade at quota instead of billing more. Decide per project whether that failure mode is acceptable and record it; don't let the default decide.

## Backup / restore posture

- Pro's daily backups (7-day retention) are the baseline. PITR (~$100/mo for 7-day retention, ≤ 2 min worst-case RPO, requires Small compute) is a per-project decision driven by the customer's data-loss tolerance — state it in `doc/standards.md` either way.
- **Storage objects are not in database backups** (metadata only) — a project using Storage needs its own object backup story or accepts unrecoverable objects.
- Restores take the project down for the duration; custom role passwords (including the `prisma` role's) are not in daily backups — resetting them belongs in any restore runbook.
- Independent of Supabase: periodic `pg_dump`/CLI `db dump` to owned storage for anything irreplaceable — Supabase's backups live inside the same account whose compromise or closure you'd be recovering from.

## Tooling

Enforced in config, not prose:

- Env presence/shape validated at app boot (schema-validated env module); a missing `DIRECT_URL` or an unprefixed leak fails the build, not the runtime.
- `prisma migrate deploy` against `DIRECT_URL` is wired into the deploy pipeline; humans don't run go-live migrations ad hoc.

## Sources

Accessed 2026-07-19:

- Supabase × Prisma guide — <https://supabase.com/docs/guides/database/prisma>
- Supabase connection options (Supavisor modes, ports, prepared statements) — <https://supabase.com/docs/guides/database/connecting-to-postgres>
- Supabase API keys (publishable/secret, RLS bypass) — <https://supabase.com/docs/guides/api/api-keys>
- Supabase backups & PITR — <https://supabase.com/docs/guides/platform/backups>
- Supabase pricing (free-tier pausing, spend cap, branching) — <https://supabase.com/pricing>
- Vercel environment variables — <https://vercel.com/docs/environment-variables> · [sensitive vars](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
- Vercel Hobby plan & fair use — <https://vercel.com/docs/plans/hobby>
- Prisma × Supabase (`directUrl`, `pgbouncer=true`) — <https://www.prisma.io/docs/orm/overview/databases/supabase>
- ADR-0005 — `doc/adr/0005-docker-previews-on-own-host.md`
