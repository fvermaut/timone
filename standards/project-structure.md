# Standards — Project structure (bulletproof-react)

> **Status: Draft — pending review (fvermaut).**
> Rules of this library: nothing tooling already enforces; nothing true of every project on Earth; only choices, patterns, and boundaries specific to how we structure application code.

Managed projects follow the [bulletproof-react](https://github.com/alan2207/bulletproof-react) feature-folder architecture, adapted for the Next.js App Router (see below). Upstream is framework-generic (it ships react-vite, nextjs-app, and nextjs-pages sample apps — verified current, 2026-07); we take its structure and dependency rules as-is and pin the Next.js-specific placements ourselves.

## Feature folders

Domain code lives in **`src/features/<feature>/`** — one folder per product feature, containing everything specific to it:

```
src/features/awesome-feature/
├── api/         # request declarations, query/mutation hooks, server actions
├── components/  # components scoped to this feature
├── hooks/       # hooks scoped to this feature
├── stores/      # feature state
├── types/       # feature types
└── utils/       # feature utilities
```

Create **only the subfolders a feature actually needs** — an empty scaffold is noise. No barrel files (`index.ts` re-exports): import concrete files directly, per upstream (preserves tree-shaking; in Next.js it also keeps server-only code out of accidental client import chains).

## Shared code and the promotion rule

Genuinely cross-feature code lives in the top-level shared folders: `src/components`, `src/hooks`, `src/lib`, `src/types`, `src/utils` (plus `src/config`, `src/stores`, `src/testing` when needed).

- **Code starts in its feature.** It moves to a shared folder only when a **second feature** actually consumes it — never preemptively "because it might be reused".
- Shared folders hold application-agnostic building blocks; anything that knows a feature's domain stays in that feature.

## Unidirectional dependencies

Code flows one way: **shared → features → app**.

- Shared modules import only other shared modules.
- Features import from shared, **never from another feature**. When two features must interact, compose them at the app level (a page renders both, passes data between them) — or the shared code they both need gets promoted.
- Only the app layer (`src/app/`) imports from features.

## Next.js App Router adaptation

Upstream's `app/` is a generic application layer (`app.tsx`, `provider.tsx`, `router.tsx`, a `routes/` folder — its Vite sample). In Next.js the framework owns `src/app/` as the file-system router, so we deviate:

- **`src/app/` contains routing files only** (`page`, `layout`, `route`, `loading`, `error`, metadata, route groups). Pages and layouts are thin: they import and compose feature components — no domain logic in `src/app/`. Providers wrap `{children}` in layouts instead of upstream's `provider.tsx`/`router.tsx`, which don't exist here.
- **Server actions belong to the feature that owns the mutation** (`src/features/<feature>/api/`), not to `src/app/`. Cross-feature actions follow the promotion rule into `src/lib/actions/`.
- **Route handlers** must sit in `src/app/**/route.ts` (framework requirement) but stay thin: parse/authorize/delegate to the owning feature's `api/` code. Per [nextjs.md](nextjs.md), they exist only for external consumers.
- Route-local helpers may colocate in a private `_folder` inside `src/app/` only when they serve exactly one route and no feature owns them.

## Tooling

Boundaries are lint-enforced, not reviewed by hand — `import/no-restricted-paths` (eslint-plugin-import) with two zone sets, exactly as bulletproof-react's project-structure doc configures them:

1. **Cross-feature ban:** one zone per feature — `target: './src/features/<x>'`, `from: './src/features'`, `except: ['./<x>']`. Add a zone when adding a feature.
2. **Unidirectional flow:** `src/features` may not import from `src/app`; shared folders (`components`, `hooks`, `lib`, `types`, `utils`) may not import from `features` or `app`.

Absolute imports via the single `@/* → ./src/*` alias (tsconfig `paths`), so files move without path surgery.

## Sources

- [bulletproof-react](https://github.com/alan2207/bulletproof-react) — repo with react-vite, nextjs-app, nextjs-pages sample apps; verified 2026-07.
- [docs/project-structure.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — folder layout, feature independence, unidirectional rule, ESLint zones.
- [docs/project-standards.md](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md) — absolute-import alias, lint conventions.
- [apps/nextjs-app](https://github.com/alan2207/bulletproof-react/tree/master/apps/nextjs-app) — upstream's own App Router application of the structure.
