# Standards — Vercel + Supabase (go-to live)

> **Status: Draft — pending review (fvermaut).**
> Scope: the *default* live-deployment stack. Customer deployments may differ per project; when a project deviates, its `doc/standards.md` records the deviation. Local runtime is covered by `docker-compose-local.md`; the data layer by `prisma-postgresql.md`; identity by `better-auth.md`.

## Division of responsibilities

- **Vercel** hosts the Next.js app: builds, edge network, serverless functions, and environment configuration. Nothing else runs there — no databases, no long-lived workers.
- **Supabase** is our managed Postgres, plus its backup machinery (and optionally Storage for user-uploaded objects). That is *all* we take from it.
- **We do not use Supabase Auth.** better-auth owns identity; its tables live in the same Postgres via Prisma. Consequences worth being explicit about:
  - Authorization lives in the Next.js server layer. Supabase RLS policies keyed to Supabase Auth (`auth.uid()`) are meaningless in our setup — do not build on them.
  - The client never talks to Supabase directly: no `supabase-js` in the browser, no Data API/PostgREST exposure. All data access goes through Prisma on the server. The publishable key (`sb_publishable_...`) is therefore unused unless a project adopts Storage with client-side access — treat that as a per-project deviation.
  - Secret keys (`sb_secret_...`, or the legacy `service_role` JWT) bypass RLS entirely; they exist only as Vercel server-side env vars, never in anything bundled for the browser.

## Environments and secrets on Vercel

- Every env var is scoped explicitly to Production / Preview / Development in Vercel — no "all environments" convenience defaults for anything database- or auth-shaped. Preview must point at a non-production database (see preview posture below); Production values exist only in the Production scope.
- Mark production secrets (`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, any `sb_secret_...`) as **Sensitive** in Vercel, making them non-readable after creation. Vercel redacts sensitive values ≥ 32 chars from build logs; don't rely on that as the only line of defense.
- `NEXT_PUBLIC_` discipline: the prefix is a publication decision, not a naming convention. Nothing connection-string-, key-, or token-shaped ever gets it. When in doubt, it stays server-side.
- Local dev env comes from `vercel env pull` (Development scope) or the compose-local defaults — not from hand-copied production values.

## Local Postgres → Supabase (the Prisma path)

Development and CI run against local Docker Postgres; Supabase enters only at go-live. The same committed Prisma migrations are then deployed against Supabase — never schema drift applied by hand in the Supabase dashboard SQL editor.

Two connection strings, always (Vercel functions are transient, so pooling is mandatory):

- `DATABASE_URL` (runtime, Prisma Client): Supavisor **transaction mode**, port **6543**, with `?pgbouncer=true`. Transaction mode does not support prepared statements; the `pgbouncer=true` flag is what makes Prisma cope — omitting it produces intermittent prepared-statement errors under load, not a clean failure.
- `DIRECT_URL` (Prisma CLI: `migrate deploy`, introspection): the **direct** connection (or session pooler on IPv4-only networks), port **5432**. Migrations never run through the transaction pooler.

Additional choices:

- Create a dedicated `prisma` database role on Supabase instead of connecting as `postgres` (Supabase's own recommendation) — it isolates credentials and makes Prisma traffic identifiable in monitoring.
- The shared Supavisor pooler is fine as the default; the dedicated PgBouncer pooler (paid plans) is a per-project upgrade decision when latency measurably matters, not a starting point.

## Preview posture (vs ADR-0005)

The default preview mechanism is **timone's own Docker previews** (ADR-0005): one adapter for every project shape, databases included, and client code stays on owned infrastructure. Vercel preview deployments are the *exception*, applying when a project is already Vercel-connected on the customer's account or the customer explicitly wants Vercel's PR-preview workflow.

When Vercel previews are in play:

- Preview-scoped env vars point at a separate Supabase project or a Supabase preview branch — never at production. Branch-specific overrides handle the rare case where one PR needs its own values.
- Supabase branching is metered per branch-hour (~$0.013/h); acceptable for short-lived PR databases, but tear branches down on PR close — the same discipline ADR-0005 already imposes on Docker previews.
- Keep Vercel's deployment protection (Vercel Authentication) on preview URLs; customer pre-release work is not publicly browsable.

## Cost and limits judgement

- **Vercel Hobby is non-commercial by its fair-use terms.** Customer work goes on Pro — this is a compliance matter, not a resource one. Pro also brings spend management; configure it rather than discovering overage retroactively.
- **Supabase Free is not a customer-production tier:** projects pause after 1 week of inactivity, there are no automated backups, and 500 MB / shared compute is the ceiling. Free is acceptable for throwaway experiments only. Customer production starts at Pro ($25/mo, 7-day backups, 8 GB disk included).
- Supabase Pro has the **spend cap on by default** — services degrade at quota instead of billing more. Decide per project whether that failure mode is acceptable and record the choice; don't let the default decide.

## Backup / restore posture

- Pro's daily backups (7-day retention) are the baseline. PITR (add-on, ~$100/mo for 7-day retention, ≤ 2 min worst-case RPO, requires Small compute) is a per-project decision driven by the customer's data-loss tolerance — state it in the project's `doc/standards.md` either way.
- **Storage objects are not in database backups** (metadata only). A project using Supabase Storage needs its own object backup story, or accepts that objects are unrecoverable.
- Restores take the project down for the duration, and custom role passwords (including the `prisma` role's) are not in daily backups — resetting them is part of any restore runbook.
- Independent of Supabase: periodic `pg_dump`/CLI `db dump` to owned storage for anything a customer would call irreplaceable. Supabase's backups live inside the same account whose compromise or closure you'd be recovering from.

## Tooling

Enforced in config, not prose — do not restate in reviews:

- Env presence/shape is validated at app boot (schema-validated env module); a missing `DIRECT_URL` or an unprefixed leak fails the build, not the runtime.
- `prisma migrate deploy` against `DIRECT_URL` is wired into the deploy pipeline; humans don't run go-live migrations ad hoc.

## Sources

Accessed 2026-07-19:

- Supabase × Prisma guide — <https://supabase.com/docs/guides/database/prisma>
- Supabase connection options (Supavisor modes, ports, prepared statements) — <https://supabase.com/docs/guides/database/connecting-to-postgres>
- Supabase API keys (publishable/secret, RLS bypass) — <https://supabase.com/docs/guides/api/api-keys>
- Supabase backups & PITR — <https://supabase.com/docs/guides/platform/backups>
- Supabase pricing (free-tier pausing, spend cap, branching) — <https://supabase.com/pricing>
- Vercel environment variables (scoping, branch overrides) — <https://vercel.com/docs/environment-variables>
- Vercel sensitive environment variables — <https://vercel.com/docs/environment-variables/sensitive-environment-variables>
- Vercel Hobby plan & fair use (non-commercial restriction) — <https://vercel.com/docs/plans/hobby>
- Prisma × Supabase (`directUrl`, `pgbouncer=true`) — <https://www.prisma.io/docs/orm/overview/databases/supabase>
- ADR-0005 — `doc/adr/0005-docker-previews-on-own-host.md`
