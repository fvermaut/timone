# Standards — Docker Compose (local runtime)

> **Status: Draft — pending review (fvermaut).**

Local-runtime conventions for managed projects (Next.js + PostgreSQL stack). The compose file doubles as the definition the PR-preview adapter runs on our own host ([ADR-0005](../doc/adr/0005-docker-previews-on-own-host.md)); every rule below serves that dual use.

## What runs where

- **Containerized:** PostgreSQL and any other backing service (mail catcher, object store, …). One `db` service from onboarding day one.
- **On the host:** the Next.js dev server (bind-mount HMR on macOS is slow, debugger attachment indirect; container parity for the app is exercised by preview stacks on every PR anyway).
- The app **is** a service in the compose file, under `profiles: ["app"]` — unprofiled services always start, profiled ones only when activated ([profiles](https://docs.docker.com/compose/how-tos/profiles/)). So local `docker compose up` starts backing services only; the preview adapter runs the full stack with `COMPOSE_PROFILES=app`. One definition, both uses.

## File layout and naming

- One `compose.yaml` at the repo root (Compose's canonical filename — [application model](https://docs.docker.com/compose/intro/compose-application-model/)); no legacy `docker-compose.yml`.
- Set top-level `name:` to the repo name — the project name prefixes every container/network/volume, and must not depend on where someone cloned the repo.
- Never set `container_name:` — fixed names break running two instances of the same definition, which is exactly what per-PR previews do.
- `compose.override.yaml` is for **personal, uncommitted** tweaks and is gitignored (Compose auto-merges it — [merge](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)); anything a teammate or the preview host needs lives in `compose.yaml`.
- No host-machine assumptions in `compose.yaml` (no absolute bind-mount paths, no ports without env indirection): if it wouldn't run unchanged on the preview host, it doesn't belong in the base file.

## Ports — coexistence on one machine

- Host-side ports are always interpolated: `"${POSTGRES_PORT:-5433}:5432"`; the container side stays canonical.
- Each project claims a distinct default port set at onboarding, recorded in `.env.example` and the `doc/standards.md` deviations table. Never default to the stock port (5432) — it collides with host Postgres and the next project.
- Trap: a shell-exported variable beats the `.env` file for interpolation ([precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)) — don't export `POSTGRES_PORT`-style names in your shell profile.

## Volumes and data lifecycle

- Database data lives in a **named volume**, never a bind mount (macOS bind-mount I/O and permissions make pg data slow and fragile; named volumes also get project-name prefixing).
- `down` preserves named volumes; only `down -v` removes them ([down](https://docs.docker.com/reference/cli/docker/compose/down/)). Reset story: `down -v` → `up --wait` → seed ([prisma-postgresql.md](prisma-postgresql.md)).
- Corollary: local DB contents are disposable — anything you'd miss after a reset belongs in the seed. Never debug around dirty local data; reset.

## Healthchecks and depends_on

- Every long-lived backing service defines a `healthcheck` (Postgres: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`); without one it can only satisfy `service_started`, which races anything opening a connection at boot.
- Dependencies use long-form `depends_on` with `condition: service_healthy` ([depends_on](https://docs.docker.com/reference/compose-file/services/#depends_on)); `service_started` on a DB dependency is banned — it races migrations.
- The host-side app is a dependent Compose can't see: always start with `docker compose up --wait` (waits until healthy, implies detached; pair with `--wait-timeout` in scripts — [up](https://docs.docker.com/reference/cli/docker/compose/up/)). Never bare `up -d` followed by a sleep.

## Image pinning

- Pin to a specific major.minor tag (`postgres:17.5`) — never `latest` or a bare major. Tags are mutable, so this is reproducibility judgement; digest pinning trades manual security updates for full reproducibility ([build best practices](https://docs.docker.com/build/building/best-practices/)) and is not required for local/preview stacks.
- The Postgres major must match the production target (Supabase — [vercel-supabase.md](vercel-supabase.md)); bumping it is a deliberate, reviewed change.

## Env files

- `.env` at the repo root is the single env source — Compose interpolates from it and Next.js loads it; one file, identical variable names (`DATABASE_URL`, …). Gitignored, never committed.
- `.env.example` is committed, lists every variable with working non-secret defaults (including the port block): `cp .env.example .env` must yield a running stack.
- No secrets as literals in `compose.yaml` (`environment:` values are committed text). Local-only credentials (dev Postgres password) may live in `.env` defaults; anything real never touches the repo.

## Tooling

Enforced by config, not prose — applied at onboarding:

- `.gitignore`: `.env`, `compose.override.yaml`.
- CI: `docker compose config -q` (fails on schema/interpolation errors).
- `package.json` scripts: `db:up` → `docker compose up --wait`, `db:reset` → `docker compose down -v && docker compose up --wait && <seed>`.

## Sources

- Compose application model, file naming, project name — https://docs.docker.com/compose/intro/compose-application-model/
- Profiles — https://docs.docker.com/compose/how-tos/profiles/
- Merging compose files / override — https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/
- Environment variable precedence — https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/
- `depends_on` / `healthcheck` reference — https://docs.docker.com/reference/compose-file/services/#depends_on
- `docker compose down` (volume lifecycle) — https://docs.docker.com/reference/cli/docker/compose/down/
- `docker compose up --wait` — https://docs.docker.com/reference/cli/docker/compose/up/
- Image pinning trade-offs — https://docs.docker.com/build/building/best-practices/
- [ADR-0005 — Docker previews on own infrastructure](../doc/adr/0005-docker-previews-on-own-host.md)
