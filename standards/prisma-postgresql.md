# Standards — Prisma + PostgreSQL

> **Status: Draft — pending review (fvermaut).**
> Rules of this library: nothing tooling already enforces; nothing true of every project on Earth; only choices, patterns, and boundaries specific to how we build with Prisma + PostgreSQL.

Current major at drafting time (2026-07): **Prisma ORM 7** — Rust-free `prisma-client` generator, `prisma.config.ts`, client generated into the project source tree, driver adapters required ([v7 announcement]). **Churn watch:** Prisma has previewed "Prisma Next" (a full-TypeScript rewrite) as the future direction; re-verify this entry on the next major.

Supabase-specific matters (Supavisor, RLS, hosted-Postgres migration path) live in [vercel-supabase.md](vercel-supabase.md) — not here.

## Migrations

- `migrate dev` runs only against a local, disposable database. Everything shared — preview, staging, production — gets `migrate deploy` (in CI, not by hand). `migrate dev` and `migrate reset` can drop the database; they are never pointed at a shared one ([migrate workflows]).
- Applied migrations are immutable. A wrong migration is fixed forward with a new one, never by editing or deleting the applied file — edits desync the checksums in `_prisma_migrations` and force resets on other environments ([migrate workflows]).
- Every migration is named: `migrate dev --name <imperative-slug>` (`add-invoice-status`, `backfill-user-locale`). An unnamed timestamp directory is unreviewable.
- Renames and anything PSL can't express go through `migrate dev --create-only`, then hand-edit the SQL before applying. Prisma turns a field/model rename into drop-and-recreate (data loss) unless the generated SQL is rewritten to `ALTER ... RENAME`; expression indexes, triggers, extensions, and check constraints also land this way ([migrate workflows]). The migration SQL — not the schema diff — is the reviewed artifact.
- `db push` is allowed only before the first migration exists (throwaway prototyping). Once there is a migration history, all schema change flows through it.

## Modeling

- **IDs:** `String @id @default(uuid(7))` by default — client-generated (ids exist before the INSERT, usable in nested writes and logs) and time-ordered, avoiding the b-tree locality cost of random v4. `uuid(7)`, `cuid(2)`, and `ulid()` are all client-side generators; `autoincrement()` is reserved for purely internal tables that never leak into URLs ([schema reference]).
- **Enums vs lookup tables:** a Prisma `enum` (native Postgres enum) only for closed, code-owned sets that change with a deploy (e.g. a status machine). Postgres cannot remove enum values or reorder them short of dropping and re-creating the type ([PG enum docs]) — if the set is user-editable, tenant-specific, or plausibly shrinking, use a lookup table with a relation instead.
- **Timestamps:** every table carries `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`. Trap: `@updatedAt` is maintained by Prisma Client, not by the database — raw SQL, Prisma Studio, psql, and any other writer bypass it ([schema reference @updatedAt]). If a table has non-Prisma writers, add a trigger in a hand-edited migration; otherwise accept the ORM-level semantics knowingly.
- **Soft delete:** default is hard delete. `deletedAt DateTime?` only when a requirement demands recoverability or audit — and then: filtering is centralized in a client extension (never ad-hoc `deletedAt: null` sprinkled through queries), and every unique constraint on the model becomes a partial unique index (`WHERE "deletedAt" IS NULL`, hand-written or via the `where` index argument — Preview) so deleted rows don't block re-creation.

## Transactions and raw SQL

- Escalation order: nested write (one create for a related graph — no id passing) → `$transaction([...])` for independent writes → interactive `$transaction(async (tx) => ...)` only for genuine read-modify-write ([transactions docs]).
- Interactive transaction defaults are `maxWait` 2 s / `timeout` 5 s ([transactions docs]). Hitting them is a design smell to fix, not a knob to raise. Never `await` external I/O — HTTP, email, LLM calls — inside one; the connection is held the whole time.
- Postgres runs `ReadCommitted` by default. Invariants of the form "read, check, then write" (balances, quotas, uniqueness beyond a constraint) get `isolationLevel: Serializable` on that call plus a retry on serialization failure — not a global isolation bump.
- Raw SQL is the right tool for reporting/aggregation shapes and Postgres features the query API can't express. Order of preference: TypedSQL (`.sql` files, generated types) → `$queryRaw` tagged template → `$queryRawUnsafe` only for dynamically assembled SQL with no user-supplied fragments ([raw SQL docs]). Remember raw writes bypass `@updatedAt` and any client extension (including soft-delete filters).

## Connections

- One `PrismaClient` per process, module-level singleton; in Next.js dev, cache it on `globalThis` so hot reload doesn't leak pools ([connections docs]).
- In v7, pool size and timeouts are configured on the **driver adapter**, not via `?connection_limit=` URL params ([connections docs]).
- Serverless: instantiate outside the handler, keep the pool small, don't call `$disconnect()` per invocation (it defeats container reuse), and size platform concurrency below `db max_connections ÷ connections per instance` ([connections docs]). At any real concurrency, put a pooler in front instead of tuning this.
- PgBouncer: transaction mode, `max_prepared_statements > 0`; the `?pgbouncer=true` flag only for PgBouncer < 1.21 ([PgBouncer docs]). Runtime uses the pooled URL; the CLI (migrations) needs a direct URL — wire `directUrl`/`DIRECT_URL` in `prisma.config.ts` from day one, because `migrate deploy` through a transaction-mode pooler fails in confusing ways.

## Indexing

- Neither Postgres nor Prisma indexes foreign-key *referencing* columns automatically ([PG constraints docs]) — Prisma's `@relation` creates the constraint, not the index. Every relation scalar used in joins or filters gets an explicit `@@index`. This is the single most common performance omission in Prisma schemas.
- PSL covers b-tree plus `type: Gin/Gist/Brin/Hash` with operator classes, sort order, and partial indexes via `where` (Preview). Expression/function indexes (e.g. `lower(email)`, `to_tsvector(...)`) are not expressible — write them in a `--create-only` migration; Prisma keeps them, it just can't represent them ([indexes docs]).

## Seeding

- v7 change: seeds run **only** via `prisma db seed` — the automatic hook on `migrate dev`/`migrate reset` is gone ([seeding docs]). Local setup scripts must chain it explicitly.
- Seeds are idempotent (`upsert` keyed on stable unique fields) and contain only the reference data the app needs to boot: lookup rows, the dev login, one exemplar of each entity. Test fixtures belong to tests ([testing.md](testing.md)), not the seed.

## Query shape

- The dataloader batches only `findUnique` calls issued through the fluent API in the same tick — `findMany` in a loop does not batch and is the canonical N+1 ([query optimization docs]). Fan-out reads are shaped as one `findMany({ where: { id: { in: ids } } })` (or `include` on the parent), never a per-row query.
- `relationLoadStrategy: "join"` (single-query SQL join) is still Preview — usable per-query where the default multi-query strategy measurably loses, but not a schema-wide default until GA ([query optimization docs]).

## Tooling

Enforced by config at onboarding, not restated in prose: generator `provider = "prisma-client"` with an explicit `output` in the source tree; `prisma.config.ts` carrying schema path, `migrations.seed`, and the direct-vs-pooled URL split; `previewFeatures` limited to what this entry uses (`typedSql`, partial-index `where`, `relationLoadStrategy` as needed); CI runs `prisma migrate status` (drift check) before `migrate deploy`, and `prisma format` in the lint step.

## Sources

- [v7 announcement]: https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
- [migrate workflows]: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- [schema reference]: https://www.prisma.io/docs/orm/reference/prisma-schema-reference (id default functions; [schema reference @updatedAt]: `@updatedAt` is "implemented at Prisma ORM level"; see also https://github.com/prisma/prisma/issues/6772)
- [PG enum docs]: https://www.postgresql.org/docs/current/datatype-enum.html
- [transactions docs]: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- [raw SQL docs]: https://www.prisma.io/docs/orm/prisma-client/using-raw-sql
- [connections docs]: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- [PgBouncer docs]: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer
- [PG constraints docs]: https://www.postgresql.org/docs/current/ddl-constraints.html
- [indexes docs]: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes
- [seeding docs]: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- [query optimization docs]: https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance
