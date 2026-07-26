# Standards — TypeScript

> **Status: Approved 2026-07-19 (fvermaut).**
> ✏ Amended 2026-07-25, approved 2026-07-26: the TypeScript 7 baseline is not yet reachable on a Next.js app; pin `^6.x` until the toolchain catches up. Proven executing `scratch-app` phase 01.
> Scope: language-level practice for our TypeScript projects (Next.js/Prisma/zod apps). Anything a compiler flag or lint rule can enforce lives in the shared tsconfig and is only indexed under [Tooling](#tooling). Baseline **as approved 2026-07-19**: **TypeScript 7**; `strict` has been the compiler default since 6.0 and is the assumed floor.
>
> **On Next.js the floor is 6.x, not 7** (correction approved 2026-07-26). TypeScript 7 is unsatisfiable there — `typescript-eslint`, vendored by `eslint-config-next@16.2.11`, peers `typescript <6.1.0` and hard-errors on 7. Pin `typescript@^6.0.3` on Next.js projects and revisit when `eslint-config-next` ships a `typescript-eslint` that accepts 7. Verified 2026-07-25 executing `scratch-app` phase 01. The 2026-07-19 TypeScript 7 baseline stands for non-Next.js projects.

## Type design

- **States are discriminated unions, never flag combinations.** Tag with a literal `kind`/`status` field, not `isLoading` + `error?` + `data?`. Every `switch` over the tag ends with the value assigned to `never` (`x satisfies never`), so a new variant breaks every handler at compile time.
- **Brand a domain primitive only when a swap is plausible** (ids that travel together, cents vs. euros, absolute vs. repo-relative paths): `string & { readonly __brand: "ProjectId" }` with one constructor holding the only assertion. Keep the branded set small — brand what has bitten or could, not every string.

## Errors and results

**Expected failures return, bugs throw.** Domain-level failure (validation, gate not met, fallible external call) returns `{ ok: true, value } | { ok: false, error }` so the checker forces callers to handle both arms. `throw` is for programmer errors and unrecoverable states, caught only at process/request boundaries — never woven through business logic. A caught value is `unknown`: narrow it, never `e as Error`.

## Boundaries

All external data — HTTP responses, LLM output, config, env vars, DB rows crossing a serialization seam — enters as `unknown` and passes through a zod schema. The schema is the type: derive with `z.infer<typeof Schema>`, never a hand-written twin interface. `as` is banned as a parsing tool — `JSON.parse(s) as Config` is a lie with a delay; the honest spellings are `Schema.parse(...)` (throwing, config that should halt startup) or `Schema.safeParse(...)` (result-shaped runtime input). LLM output is the least trustworthy input in the system; its validation failure is an expected, retryable domain failure.

## Traps that bite

- Excess-property checking fires only on fresh literals — an annotation won't strip fields; build serialization output explicitly (or `Schema.parse` it).
- No new enums: `as const` object + derived union instead (enforced by `erasableSyntaxOnly`).
- `as` is legitimate in exactly three places: brand constructors, `as const`, test fixtures. `as unknown as X` in production means a boundary is missing a schema.
- `(cb: () => void)` silently accepts an async callback and drops its rejection — take `() => Promise<void>` and await it where a floating promise would be a real bug.

## Tooling

Beyond the TS ≥ 6 defaults, the shared `tsconfig.json` adds:

| Flag | Why |
|------|-----|
| `noUncheckedIndexedAccess` | index lookups yield `T \| undefined` (still not in `strict`) |
| `verbatimModuleSyntax` | forces `import type`; imports mean what they say |
| `erasableSyntaxOnly` | bans enums/namespaces/parameter properties — code stays Node-runnable |
| `exactOptionalPropertyTypes` | keeps `prop?: T` and explicit `undefined` distinct |
| `noImplicitOverride` | catches silent override drift |
| `types` (explicit list) | default is `[]` since 6.0 — list `@types/node` etc. per project |

## Sources

- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) — current baseline and defaults
- [Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) — discriminated unions, exhaustiveness via `never`
- [Playground: Nominal Typing](https://www.typescriptlang.org/play#example/nominal-typing) — branded-type technique
- [Zod documentation](https://zod.dev) — schema-first boundaries, `z.infer`
