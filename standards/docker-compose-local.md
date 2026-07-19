# Standards — Docker Compose (local runtime)

> **Status: Draft — pending review (fvermaut).**

Local-runtime conventions for managed projects (Next.js + PostgreSQL stack). The compose file each project carries is not just a dev convenience: it is the same definition the PR-preview adapter runs on our own host ([ADR-0005](../doc/adr/0005-docker-previews-on-own-host.md)). Every rule below serves that dual use.

## What runs where

- **Containerized:** PostgreSQL and any other backing service (mail catcher, object store, etc.). One `db` service exists from onboarding day one.
- **On the host:** the Next.js dev server (`next dev`). Judgement: file-watching/HMR through a bind mount on macOS is slow and debugger attachment is indirect; container parity for the app itself is exercised by the preview stacks on every PR, so local dev pays no parity tax by staying on the host.
- The app **is** defined as a service in the compose file, but under `profiles: ["app"]`. Services without a `profiles` attribute always start; profiled ones only when the profile is activated ([profiles](https://docs.docker.com/compose/how-tos/profiles/)). So `docker compose up` locally starts backing services only, while the preview adapter runs the full stack with `COMPOSE_PROFILES=app` — one definition, both uses.

## File layout and naming

- One `compose.yaml` at the repo root — the canonical filename Compose prefers ([application model](https://docs.docker.com/compose/intro/compose-application-model/)). No `docker-compose.yml` legacy name.
- Set the top-level `name:` to the repo name. Project name prefixes every container, network, and volume; relying on the checkout directory name makes resource names depend on where someone cloned the repo.
- Never set `container_name:` — fixed names break running two instances of the same definition, which is exactly what per-PR previews do (the adapter overrides the project name per PR; prefixing must stay in Compose's hands).
- `compose.override.yaml` is reserved for **personal, uncommitted** tweaks and is gitignored. Compose auto-merges it over the base file ([merge](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)); anything a teammate or the preview host needs must live in `compose.yaml` itself.
- No host-machine assumptions in `compose.yaml`: no absolute bind-mount paths, no ports without env indirection (below). If it wouldn't run unchanged on the preview host, it doesn't belong in the base file.

## Ports — coexistence on one machine

Several managed projects run on the same laptop and the same preview host. Convention:

- Host-side ports are always interpolated: `"${POSTGRES_PORT:-5433}:5432"`. The container side stays canonical.
- Each project claims a distinct default port set at onboarding, recorded in its `.env.example` and `doc/standards.md` deviations table. Never default to the service's stock port (5432) — it collides with a host-installed Postgres and with the next project.
- Trap: for interpolation, a variable set in your shell beats the `.env` file ([precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)). Don't export `POSTGRES_PORT`-style names globally in your shell profile.

## Volumes and data lifecycle

- Database data lives in a **named volume**, never a bind mount (macOS bind-mount I/O and permissions make pg data slow and fragile; named volumes also get project-name prefixing for free).
- `docker compose down` preserves named volumes; only `down -v` removes them ([down](https://docs.docker.com/reference/cli/docker/compose/down/)). The reset story is therefore exactly: `down -v` → `up --wait` → seed (per the seed conventions in [prisma-postgresql.md](prisma-postgresql.md)).
- Corollary: local DB contents are always disposable. Any state a developer or agent would miss after a reset belongs in the seed, not in the volume. Never debug around dirty local data — reset.

## Healthchecks and depends_on

- Every long-lived backing service defines a `healthcheck` (Postgres: `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`). A service without one can only ever satisfy `service_started`, which races anything that opens a connection at boot.
- Inter-service dependencies use long-form `depends_on` with `condition: service_healthy` ([depends_on](https://docs.docker.com/reference/compose-file/services/#depends_on)). `service_started` on a DB dependency is banned — it races migrations.
- The host-side app is a "dependent" Compose can't see. The convention that replaces `depends_on` for it: always start the stack with `docker compose up --wait` (waits until services are running/healthy, implies detached; pair with `--wait-timeout` in scripts — [up](https://docs.docker.com/reference/cli/docker/compose/up/)). Package scripts and agent stage skills use `--wait`, never bare `up -d` followed by a sleep.

## Image pinning

- Pin images to a specific major.minor tag (`postgres:17.5`), never `latest` and never a bare major. Tags are mutable, so this is reproducibility judgement, not a guarantee; digest pinning buys full reproducibility at the cost of manual security updates ([build best practices](https://docs.docker.com/build/building/best-practices/)) — for local/preview stacks the tag level is the right trade-off, digests are not required.
- The Postgres major version must match the project's production target (Supabase — see [vercel-supabase.md](vercel-supabase.md)). Bumping it is a deliberate, reviewed change, not a compose-file drive-by.

## Env files

- `.env` at the repo root is the single env source: Compose interpolates from it and Next.js loads it — keep one file, identical variable names (`DATABASE_URL`, …) for both consumers. It is gitignored and never committed.
- `.env.example` is committed, lists every variable with working non-secret defaults (including this project's port block), and is the onboarding contract: `cp .env.example .env` must yield a running stack.
- No secrets as literals in `compose.yaml` (`environment:` values are committed text). Local-only credentials like the dev Postgres password may live in `.env` defaults; anything real never touches the repo.

## Tooling

Enforced by config, not prose — applied at onboarding:

- `.gitignore`: `.env`, `compose.override.yaml`.
- CI: `docker compose config -q` as a validation step (fails on schema/interpolation errors).
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
