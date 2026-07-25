# Standards — Next.js (full-stack)

> **Status: Approved 2026-07-24 (fvermaut).**
> ✏ Amended 2026-07-20, approved 2026-07-24: scaffolding via `create-next-app` added; `next-devtools` MCP adopted per ADR-0009.
> ✏ Amended 2026-07-25 — **pending approval**: `create-next-app` cannot run in place in a managed project (scaffold into a temp dir and copy in); generator-emitted harness files must be deleted before commit. Both proven executing `scratch-app` phase 01.
> Rules of this library: nothing tooling already enforces; nothing true of every project on Earth; only choices, patterns, and boundaries specific to how we build with Next.js (full-stack).

Applies to **Next.js 16** (App Router, Turbopack default). Deployment specifics live in [vercel-supabase.md](vercel-supabase.md) — never duplicated here.

## Framework posture

- **App Router only.** No `pages/` directory, ever — route handlers cover one-off API routes.
- **Enable Cache Components on new projects** (`cacheComponents: true`): the documented forward model in 16 (PPR + `use cache`); its build-time error for uncached data outside `<Suspense>` is the enforcement we want. Skip only for an incompatible dependency — record the deviation in `doc/standards.md`.
- **Volatile area — verify before acting:** caching defaults churned across majors (14 cached `fetch` by default; 15 reversed it; 16 added Cache Components; `middleware.ts` → `proxy.ts`). Pre-16 patterns (`export const revalidate`, `unstable_cache`, `middleware.ts`) are a smell — re-check current docs.

## Routing files: who does what

- **Layouts render chrome; they never fetch per-request data** — `loading.js` doesn't cover layouts, so `cookies()`/`headers()`/uncached fetches there block navigation. Runtime reads go in a child component behind its own `<Suspense>`.
- **Pages compose; components fetch** — identical requests are memoized per render pass; don't fetch at the page and drill props.
- **Route handlers (`route.ts`) exist only for external consumers** (webhooks, OAuth callbacks, file/stream responses, third-party clients). Internal reads → Server Components; internal mutations → Server Actions. A `route.ts` with no consumer outside our React tree is a design error.

## The server/client boundary

- Default is server. `"use client"` is justified only by state, effects, event handlers, browser APIs, or context — and goes on the **leaf interactive component**, never a page or layout (everything a client file imports joins the client bundle).
- Server content passes **through** client components as `children`/props; context providers wrap `{children}` as deep as possible, not `<html>`.
- Every module touching the DB, secrets, or server env imports **`server-only`** — accidental client imports become build errors, not silently empty env vars.
- `NEXT_PUBLIC_` is a publication decision — same scrutiny as putting the value in page source.

## Data fetching and caching

- **`fetch` is not cached by default in 15/16.** Uncached data streams behind `<Suspense>` or is cached explicitly — never left blocking the route.
- Caching is **data-level first**: `'use cache'` + `cacheLife()` + `cacheTag()` on the fetching function in `lib/`. UI-level `use cache` only for whole pages genuinely shared across users.
- Anything from `cookies()`/`headers()`/`searchParams` stays out of cached scopes — extract the value and pass it as an argument so it joins the cache key.
- Independent requests start together (`Promise.all` / unawaited promises to `use`); request-scoped shared reads (current user, tenant) wrapped once in `React.cache` in `lib/`.
- Prefer **tags over paths**: `updateTag` in Server Actions when the user must see their own write; `revalidateTag` (stale-while-revalidate) for background freshness; `revalidatePath` only when tagging is genuinely overkill.
- Serverless caveat: default `use cache` storage is in-memory and doesn't survive across invocations — durable caching (`use cache: remote`) is a deployment concern, see [vercel-supabase.md](vercel-supabase.md).

## Mutations: Server Actions

- Server Actions are the default mutation path for our own UI. Each is a **public POST endpoint** — encrypted action IDs and the Origin/Host check are not a security boundary, nor is "the form only renders when logged in".
- Inside every action, in order: authenticate from cookies/session (never a client-supplied token argument), authorize against the resource, validate input shape. Schema validation proves shape, not ownership — ownership is re-read server-side.
- Return what the UI renders, never raw DB records (return values are serialized to the client).
- `redirect()` throws — revalidation calls go **before** it. Actions dispatch sequentially per client: bulk work happens inside one action, not `Promise.all` over several.
- Shared actions in `lib/actions/` (or a segment `_actions.ts`) with file-level `'use server'`; inline actions only for single-use, page-local mutations.

## Streaming and Suspense

- `<Suspense>` sits **close to the uncached read**, not at the route root — static/cached content ships in the shell, only the dynamic hole streams. Route-level `loading.tsx` is the coarse fallback for pages dynamic end-to-end.
- Fallbacks are meaningful (skeleton matching the final layout) — they are part of the shell users see.
- In a sequential dependency chain the first request blocks everything: it must be fast or cached; only dependents stream.

## Proxy (`proxy.ts`, formerly middleware)

- **Last resort**, per the framework's own guidance: redirects, rewrites, header shaping, coarse optimistic gating. No data fetching, session management, or business logic.
- Optimistic auth in proxy never replaces per-action/per-component checks: Server Actions POST to the page's own route, so a matcher change silently removes proxy coverage.
- Always ship an explicit `matcher` with the negative pattern excluding `_next/static`, `_next/image`, and metadata files.

## Project structure

- Structure follows [project-structure.md](project-structure.md) (bulletproof-react feature folders); `src/app/` contains **routing files only** (`page`, `layout`, `route`, `loading`, `error`, metadata).
- Route groups `(marketing)` / `(app)` are for layout boundaries (including differing root layouts), not decorative foldering.

## Tooling

**Scaffold with the generator**: `npx create-next-app@latest <name> --ts --app --src-dir --eslint --use-npm --import-alias "@/*"` — never hand-assemble `package.json`, `tsconfig.json`, or `next.config.ts`. The generator tracks the current major's defaults; hand-rolled configs drift silently. Note `--turbopack` and `--tailwind` are already defaults in 16, and the linter is now a three-way choice (`--eslint` / `--biome` / `--no-linter`). Post-generation deltas we always apply: `cacheComponents: true`, the strict `jsx-a11y` preset and the import-boundary zones from [project-structure.md](project-structure.md), and `server-only` on every server module. Anything else differing from generator output is a deviation and gets recorded in `doc/standards.md`.

**Scaffold into a temp directory, then copy in — never in place.** A managed project always already contains `CONTEXT.md`, `README.md` and `doc/`, and `create-next-app .` **refuses to run** in a non-empty directory. Generate into an empty temp dir, then copy the output into the repo. Proven on 2026-07-25 executing `scratch-app` phase 01; there is no flag that overrides it.

**Delete what the generators emit for other agents.** `create-next-app` writes `AGENTS.md` and `CLAUDE.md` by default, and `prisma init` writes `.claude/skills/`, `.windsurf/skills/`, `.agents/skills/` and `skills-lock.json`. Every one of those is a harness file that [PRD-01.R4](../doc/specs/prd/prd-01-process-layer.criteria.md) forbids in a client repo. Suppress or delete them **before** the slice's commit — the generator's defaults are not a licence, and nothing else in the pipeline will catch them.

**MCP: `next-devtools` is adopted** ([ADR-0009](../doc/adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md)) — the named gap is live dev-server state (build/runtime errors, logs, resolved routes) exposed via Next 16's built-in `/_next/mcp` endpoint, which no CLI surfaces. It is only useful with a dev server running. Config lives in timone's root `.mcp.json`, never in a client repo.

Enforced by config, not prose: `eslint-config-next` (core-web-vitals) via flat config; generated route/`PageProps`/`RouteContext` types (`next typegen`, checked by `tsc`); the Cache Components build error; `npx @next/codemod` on major upgrades (including `middleware-to-proxy`).

## Sources

- [Next.js 16 release](https://nextjs.org/blog/next-16) — verified current major, 2026-07.
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Caching](https://nextjs.org/docs/app/getting-started/caching) / [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) / [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Project structure](https://nextjs.org/docs/app/getting-started/project-structure)
