# Standards — TypeScript

> **Status: Draft — pending review (fvermaut).**
> Scope: language-level practice for our TypeScript projects. Anything a compiler flag or lint rule can enforce lives in the shared tsconfig/eslint config and is only *indexed* under [Tooling](#tooling) — never restated as prose rules.

Baseline as of July 2026: **TypeScript 7** (the Go-native compiler, GA 2026-07-08). `strict` has been the compiler default since 6.0, so "turn on strict mode" is no longer a standard — it is the floor everything below assumes.

## Type design

**States are discriminated unions, never flag combinations.** Anywhere a value can be in one of several shapes — job status, tool-call outcome, parse result — model it as a union tagged by a literal field (`kind` or `status`), not as optional fields plus booleans (`isLoading`, `error?`, `data?` invites the impossible `isLoading && error` state). Every `switch` over the tag ends with a `default` that assigns the value to `never` (or `x satisfies never`), so adding a variant breaks every site that must handle it at compile time, not in production.

**Brand the domain primitives that actually get confused.** Structural typing means `type ProjectId = string` and `type SessionId = string` are freely interchangeable — the alias documents nothing. For identifiers and units that cross function boundaries together (ids, absolute vs. repo-relative paths, cents vs. euros), use a branded type (`string & { readonly __brand: "ProjectId" }`) with a single constructor function that is the only place the brand is asserted. Keep the branded set small and boundary-driven: brand what has produced or could plausibly produce a swap bug, not every string in sight.

**`satisfies` for tables and configs; `as const` to derive types from data.** A registry or config object annotated with `: Record<K, V>` widens every entry and loses inference on lookups; the same object with `satisfies Record<K, V>` is checked for typos and completeness *without* widening — that is the default for any literal object that must conform to a contract. When the data itself is the source of truth (stage names, model ids, tool tables), declare it `as const` and derive the union with `keyof typeof` / indexed access rather than maintaining a parallel type by hand.

**Generics and overloads are last resorts, in that order.** Follow the handbook's three rules: a type parameter must relate at least two positions (appear twice) or it shouldn't exist; use as few parameters as possible; use the parameter itself rather than a constrained wrapper (`<T>(arr: T[])`, not `<T extends any[]>(arr: T)`). Prefer a union parameter over overloads; reach for overloads only when the *return* type genuinely depends on the argument type in a way a union or conditional type can't express readably.

## Errors and results

**Expected failures return, bugs throw.** Operations whose failure is part of the domain — a stage gate not met, an external call that can legitimately fail, user/agent input that doesn't validate — return a discriminated result (`{ ok: true, value } | { ok: false, error }`) so the caller is forced by the type checker to handle both arms. `throw` is reserved for programmer errors and unrecoverable states, caught only at process/request boundaries where they are logged and turned into an exit code or 500 — not woven through business logic as control flow.

**A caught value is `unknown` — treat it that way.** Under strict, `catch (e)` is `unknown` (`useUnknownInCatchVariables`, strict-family since 4.4). Never `e as Error`; narrow with `instanceof` or a helper that extracts a message from anything. Keep the thrown-error taxonomy shallow: one base error class per package with a machine-readable `code`, not a subclass per failure mode — failure modes belong in result types, where the compiler checks their handling.

## Boundaries: where `unknown` enters

All data from outside the compiled program — HTTP responses, LLM output, YAML/JSON config, env vars, file reads, DB rows crossing a serialization seam — enters as `unknown` and passes through a zod schema before touching typed code. Two consequences:

- **The schema is the type.** Derive with `z.infer<typeof Schema>`; never hand-write an interface next to a schema — they drift.
- **`as` is banned as a parsing tool.** `JSON.parse(s) as Config` is a lie with a delay; the only honest spellings are `Schema.parse(...)` (throwing, for config that should halt startup) or `Schema.safeParse(...)` (result-shaped, for runtime input — see error posture above).

LLM output is the least trustworthy input in this system and gets the same treatment as any network payload: schema-validate every structured response, and treat validation failure as an expected, retryable domain failure, not an exception.

## Traps that bite

- **Excess-property checking is shallower than it looks.** It fires only on *fresh* object literals; anything passed through a variable or a wider parameter slips extra fields through. Consequence: types do not prevent over-returning data (e.g. leaking fields into an API response). At serialization boundaries, build the output object explicitly (or `Schema.parse` it) — don't rely on an annotation to strip fields, because structurally it won't.
- **Enums: don't add new ones.** The replacement pattern is an `as const` object plus a derived union type — same ergonomics, plain JavaScript, aligned with the handbook's own "you may not need an enum" guidance and with Node's type-stripping execution (enums are non-erasable syntax). `const enum` in particular is inlined at compile time and breaks across dependency version skew. Enforcement is in Tooling (`erasableSyntaxOnly`); the pattern choice is recorded here.
- **Assertion discipline.** `as` appears in exactly three legitimate places: the single constructor of a branded type, `as const`, and test fixtures. `as unknown as X` in production code means the boundary is missing a schema — fix the boundary. Non-null `!` is acceptable only where the invariant is established a line or two above and the checker can't see it (e.g. a `Map.has`/`get` pair); anything less local gets a real guard.
- **Structural typing accepts more than you meant.** An empty interface matches everything; a `(cb: () => void)` parameter happily accepts a callback returning a `Promise` (return-type bivariance on the void side), silently dropping the rejection. Where a floating promise would be a real bug, take `() => Promise<void>` explicitly and await it.

## Tooling

The shared `tsconfig.json` is the enforceable half of this standard. On TypeScript ≥ 6 defaults (`strict`, `module: esnext`, current-ES `target`, `noUncheckedSideEffectImports`, forced `esModuleInterop`), the flags we add and why — one line each, no prose duplicates:

| Flag | Why it's on |
|------|-------------|
| `noUncheckedIndexedAccess` | Index/record lookups yield `T \| undefined`; still **not** part of `strict` in TS 7 — must be explicit. |
| `verbatimModuleSyntax` | Forces `import type`; makes imports mean what they say under type-stripping runtimes and bundlers. |
| `erasableSyntaxOnly` | Bans enums, runtime namespaces, parameter properties, `import =` — code stays directly Node-runnable (pairs with `verbatimModuleSyntax` per the 5.8 notes). |
| `exactOptionalPropertyTypes` | `prop?: T` no longer accepts an explicit `undefined` write — keeps optionality and undefined distinct. |
| `noImplicitOverride` | Silent override drift in class hierarchies becomes an error. |
| `types` (explicit list) | Default is `[]` since 6.0 — `@types/node` etc. must be listed per project, not discovered. |

Migration note: TS 6.0 removed/hard-defaulted a raft of flags (`baseUrl`, `moduleResolution: node10/classic`, `target: es5`, `outFile`, `esModuleInterop: false`, …) — never carry them into new configs; TS 7 errors on them. TS 7.0 ships **no stable compiler API** (expected in 7.1): anything programmatic against the compiler pins the `@typescript/typescript6` package until then.

## Sources

- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) — native compiler GA, changed defaults, removed flags, no-API caveat (2026-07-08)
- [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — `strict`/`module`/`types` defaults, deprecation list
- [Handbook: More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) — generic-function rules; unions over overloads
- [Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) — discriminated unions, exhaustiveness via `never`
- [Handbook: Enums](https://www.typescriptlang.org/docs/handbook/enums.html) — "Objects vs Enums", const-enum pitfalls
- [TypeScript 4.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html) — `satisfies`
- [TypeScript 5.8 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html) — `erasableSyntaxOnly` and pairing with `verbatimModuleSyntax`
- [TypeScript 4.4 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html) — `unknown` in catch clauses
- [Playground: Nominal Typing](https://www.typescriptlang.org/play#example/nominal-typing) — branded-type technique
- [Zod documentation](https://zod.dev) — schema-first boundary validation, `z.infer`
