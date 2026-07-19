# Standards — Next.js (full-stack)

> **Status: Draft — pending review (fvermaut).**
> Rules of this library: nothing tooling already enforces; nothing true of every project on Earth; only choices, patterns, and boundaries specific to how we build with Next.js (full-stack).

Applies to the current stable major, **Next.js 16** (App Router, Turbopack default). Deployment specifics (Vercel runtime, env, domains) live in [vercel-supabase.md](vercel-supabase.md) — never duplicated here.

## Framework posture

- **App Router only.** No `pages/` directory, ever — not even for one-off API routes (route handlers cover that).
- **Enable Cache Components on new projects** (`cacheComponents: true` in `next.config.ts`). This is the documented forward model in 16 (Partial Prerendering + `use cache`); its build-time error for uncached data outside `<Suspense>` is the enforcement we want. Only skip it when a dependency is incompatible — record the deviation in the project's `doc/standards.md`.
- **Volatile area — verify before acting:** caching defaults have churned across majors (Next 14 cached `fetch` by default; 15 reversed it; 16 added Cache Components; `middleware.ts` became `proxy.ts` in 16). When an agent reuses pre-16 patterns (`export const revalidate`, `unstable_cache`, `middleware.ts`), treat that as a smell and re-check current docs.

## Routing files: who does what

- **Layouts render chrome; they do not fetch per-request data.** A layout that touches `cookies()`, `headers()`, or uncached fetches blocks navigation because `loading.js` does not cover layouts. Runtime reads in a layout go in a child component behind its own `<Suspense>`.
- **Pages compose; components fetch.** Fetch in the component that needs the data (identical requests are memoized per render pass) instead of fetching at the page and drilling props.
- **Route handlers (`route.ts`) exist only for external consumers**: webhooks, OAuth callbacks, file/stream responses, and third-party clients. Internal reads go through Server Components; internal mutations go through Server Actions. A `route.ts` with no consumer outside our own React tree is a design error.

## The server/client boundary

- Default is server. `"use client"` is justified only by state, effects, event handlers, browser APIs, or context — and goes on the **leaf interactive component**, never on a page or layout. Everything a client file imports joins the client bundle.
- Server-rendered content passes **through** client components as `children`/props (e.g. server `<Cart>` inside client `<Modal>`); context providers wrap `{children}` as deep as possible, not `<html>`.
- Every module that touches the DB, secrets, or server env imports **`server-only`** at the top. This turns accidental client imports into build errors instead of silently empty env vars.
- `NEXT_PUBLIC_` is a publication decision, not a convenience — adding the prefix requires the same scrutiny as putting the value in page source.

## Data fetching and caching

- **`fetch` is not cached by default in 15/16.** Uncached data either streams behind `<Suspense>` or is cached explicitly — never left blocking the route.
- Caching is **data-level first**: `'use cache'` + `cacheLife()` + `cacheTag()` on the fetching function in `lib/`, not sprinkled over components. UI-level `use cache` is for whole pages that are genuinely shared across users.
- Anything derived from `cookies()`/`headers()`/`searchParams` stays out of cached scopes; extract the value and pass it as an argument so it becomes part of the cache key.
- Independent requests start together (`Promise.all` / unawaited promises handed to `use`), and request-scoped shared reads (current user, tenant) are wrapped in `React.cache` once in `lib/` rather than re-fetched per component.
- Prefer **tags over paths** for invalidation: `updateTag` in Server Actions when the user must see their own write in the same roundtrip; `revalidateTag` (stale-while-revalidate) for background freshness; `revalidatePath` only when tagging is genuinely overkill.
- Serverless caveat: default `use cache` storage is in-memory and does not survive across serverless invocations — durable caching (`use cache: remote`) is a deployment concern, see [vercel-supabase.md](vercel-supabase.md).

## Mutations: Server Actions

- Server Actions are the default mutation path for our own UI. Each one is a **public POST endpoint** — encrypted action IDs and the Origin/Host CSRF check are not a security boundary, and neither is "the form only renders when logged in".
- Therefore, inside every action, in this order: authenticate from cookies/session (never from a client-supplied token argument), authorize against the resource, validate the input shape. Schema validation proves shape, not ownership — the client sends an ID and the change; ownership is re-read server-side.
- Return values are serialized to the client: return what the UI renders, never raw DB records.
- `redirect()` throws — revalidation calls go **before** it. Actions dispatch sequentially per client, so bulk work happens inside one action, not `Promise.all` over several.
- Shared actions live in `lib/actions/` (or a route-segment `_actions.ts`) with file-level `'use server'`; inline actions are for single-use, page-local mutations only.

## Streaming and Suspense

- `<Suspense>` sits **close to the uncached read**, not at the route root: static/cached content ships in the shell, only the dynamic hole streams. Route-level `loading.tsx` is the coarse fallback for pages that are dynamic end-to-end.
- Fallbacks are meaningful (skeleton matching the final layout, or a stable fragment of it) — they are part of the static shell users actually see.
- In a sequential dependency chain, the first request blocks everything: it must be fast or cached; only the dependents stream.

## Proxy (`proxy.ts`, formerly middleware)

- **Last resort**, per the framework's own guidance: redirects, rewrites, header shaping, coarse optimistic gating. No data fetching, no session management, no business logic.
- Optimistic auth checks in proxy never replace per-action/per-component checks: Server Actions POST to the page's own route, so a matcher change silently removes proxy coverage.
- Always ship an explicit `matcher` with the negative pattern excluding `_next/static`, `_next/image`, and metadata files.

## Project structure

- Use `src/`; `src/app/` contains **routing files only** (`page`, `layout`, `route`, `loading`, `error`, metadata). Domain code lives in `src/lib/` (data access, actions, validation) and `src/components/`; route-local helpers may colocate under a private `_folder` inside the segment.
- Route groups `(marketing)` / `(app)` partition layouts (and root layouts when the shells genuinely differ); they are for layout boundaries, not decorative foldering.

## Tooling

Enforced by config, not prose: `eslint-config-next` (core-web-vitals) via flat config; generated route/`PageProps`/`RouteContext` types (`next typegen`, checked by `tsc`); the Cache Components build error for uncached data outside `<Suspense>`; `npx @next/codemod` on major upgrades (including `middleware-to-proxy`).

## Sources

- [Next.js 16 release](https://nextjs.org/blog/next-16) — Cache Components, Turbopack default, proxy rename (verified current major, 2026-07).
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — boundary, interleaving, `server-only`, env poisoning.
- [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) — no default fetch caching, memoization, parallel fetching, `use`, `React.cache`.
- [Caching](https://nextjs.org/docs/app/getting-started/caching) / [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) — `use cache`, `cacheLife`/`cacheTag`, `updateTag` vs `revalidateTag`, runtime APIs, serverless cache caveat.
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — conventions, caching model, page/route conflicts.
- [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) / [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) — security model, sequential dispatch, cache-update choice, auth-inside-action.
- [proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — middleware deprecation, "last resort" guidance, matcher, Server Action coverage warning.
- [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) — file conventions, route groups, private folders, colocation strategies.
