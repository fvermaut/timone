# Standards — Prisma + PostgreSQL

> **Status: Draft — pending review (fvermaut).**
> Rules of this library: nothing tooling already enforces; nothing true of every project on Earth; only choices, patterns, and boundaries specific to how we build with Prisma + PostgreSQL.

Current major (2026-07): **Prisma ORM 7** — Rust-free `prisma-client` generator, `prisma.config.ts`, client generated into the source tree, driver adapters required ([v7 announcement]). **Churn watch:** "Prisma Next" (full-TypeScript rewrite) is the previewed future direction; re-verify on the next major. Supabase matters live in [vercel-supabase.md](vercel-supabase.md).

## Migrations

- `migrate dev` only against a local, disposable database — it and `migrate reset` can drop the DB. Everything shared (preview/staging/production) gets `migrate deploy`, in CI, not by hand ([migrate workflows]).
- Applied migrations are immutable: fix forward with a new one — edits desync `_prisma_migrations` checksums and force resets elsewhere.
- Every migration is named: `migrate dev --name <imperative-slug>` (`add-invoice-status`).
- Renames and anything PSL can't express (expression indexes, triggers, extensions, check constraints) go through `--create-only` + hand-edited SQL — Prisma turns a rename into drop-and-recreate (data loss) unless rewritten to `ALTER ... RENAME`. The migration SQL, not the schema diff, is the reviewed artifact.
- `db push` only before the first migration exists; after that, all schema change flows through history.

## Modeling

- **IDs:** `String @id @default(uuid(7))` — client-generated (usable before INSERT, in nested writes and logs) and time-ordered (avoids random-v4 b-tree locality cost). `autoincrement()` only for internal tables that never leak into URLs ([schema reference]).
- **Enums vs lookup tables:** Prisma `enum` only for closed, code-owned sets that change with a deploy. Postgres can't remove or reorder enum values short of re-creating the type ([PG enum docs]) — user-editable, tenant-specific, or plausibly shrinking sets get a lookup table.
- **Timestamps:** every table has `createdAt @default(now())` + `updatedAt @updatedAt`. Trap: `@updatedAt` is Prisma-Client-level — raw SQL, Studio, psql bypass it ([schema reference @updatedAt]); tables with non-Prisma writers need a trigger in a hand-edited migration.
- **Soft delete:** default is hard delete. `deletedAt DateTime?` only when a requirement demands recoverability/audit — then filtering is centralized in a client extension (never ad-hoc `deletedAt: null`), and every unique constraint becomes a partial unique index (`WHERE "deletedAt" IS NULL`) so deleted rows don't block re-creation.

## Transactions and raw SQL

- Escalation order: nested write → `$transaction([...])` for independent writes → interactive `$transaction(async (tx) => ...)` only for genuine read-modify-write ([transactions docs]).
- Interactive defaults: `maxWait` 2 s / `timeout` 5 s — hitting them is a design smell, not a knob to raise. Never `await` external I/O (HTTP, email, LLM) inside one; the connection is held throughout.
- Postgres default is `ReadCommitted`. "Read, check, then write" invariants (balances, quotas) get `isolationLevel: Serializable` on that call + retry on serialization failure — not a global bump.
- Raw SQL for reporting/aggregation and features the query API can't express. Preference: TypedSQL (`.sql` + generated types) → `$queryRaw` tagged template → `$queryRawUnsafe` only for dynamically assembled SQL with no user-supplied fragments ([raw SQL docs]). Raw writes bypass `@updatedAt` and client extensions (incl. soft-delete filters).

## Connections

- One `PrismaClient` per process, module-level singleton; in Next.js dev, cache on `globalThis` so hot reload doesn't leak pools ([connections docs]).
- v7: pool size/timeouts configure on the **driver adapter**, not `?connection_limit=` URL params.
- Serverless: instantiate outside the handler, small pool, no per-invocation `$disconnect()` (defeats container reuse), platform concurrency < `db max_connections ÷ connections per instance`. At any real concurrency, use a pooler instead of tuning this.
- PgBouncer: transaction mode, `max_prepared_statements > 0`; `?pgbouncer=true` only for PgBouncer < 1.21 ([PgBouncer docs]). Runtime uses the pooled URL; the CLI needs a direct one — wire `directUrl`/`DIRECT_URL` in `prisma.config.ts` from day one (`migrate deploy` through a transaction-mode pooler fails confusingly).

## Indexing

- Neither Postgres nor Prisma indexes FK *referencing* columns automatically ([PG constraints docs]) — `@relation` creates the constraint, not the index. Every relation scalar used in joins or filters gets an explicit `@@index`. The most common performance omission in Prisma schemas.
- PSL covers b-tree plus `type: Gin/Gist/Brin/Hash`, operator classes, sort order, partial indexes via `where` (Preview). Expression indexes (`lower(email)`, `to_tsvector(...)`) go in a `--create-only` migration — Prisma keeps them, it just can't represent them ([indexes docs]).

## Seeding

- v7: seeds run **only** via `prisma db seed` — the automatic hook on `migrate dev`/`reset` is gone ([seeding docs]); local setup scripts chain it explicitly.
- Seeds are idempotent (`upsert` on stable unique fields) and hold only boot-reference data: lookup rows, the dev login, one exemplar per entity. Test fixtures belong to tests ([testing.md](testing.md)).

## Query shape

- The dataloader batches only fluent-API `findUnique` calls in the same tick — `findMany` in a loop is the canonical N+1 ([query optimization docs]). Fan-out reads: one `findMany({ where: { id: { in: ids } } })` or `include` on the parent, never per-row queries.
- `relationLoadStrategy: "join"` is still Preview — per-query where the default measurably loses, not a schema-wide default until GA.

## Tooling

Enforced by config at onboarding: generator `provider = "prisma-client"` with explicit `output` in the source tree; `prisma.config.ts` carrying schema path, `migrations.seed`, and the direct-vs-pooled URL split; `previewFeatures` limited to what this entry uses; CI runs `prisma migrate status` (drift check) before `migrate deploy`, and `prisma format` in lint.

## Sources

- [v7 announcement]: https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
- [migrate workflows]: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- [schema reference]: https://www.prisma.io/docs/orm/reference/prisma-schema-reference ([schema reference @updatedAt]: "implemented at Prisma ORM level"; https://github.com/prisma/prisma/issues/6772)
- [PG enum docs]: https://www.postgresql.org/docs/current/datatype-enum.html
- [transactions docs]: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- [raw SQL docs]: https://www.prisma.io/docs/orm/prisma-client/using-raw-sql
- [connections docs]: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- [PgBouncer docs]: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer
- [PG constraints docs]: https://www.postgresql.org/docs/current/ddl-constraints.html
- [indexes docs]: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes
- [seeding docs]: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- [query optimization docs]: https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance
