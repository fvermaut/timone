# Phase 03: Standards Library Content

> **Status:** Planned.

> **Companion phases:** [Phase 01](phase-01.md) (complete — created the library scaffold), [Phase 02](phase-02.md) (independent — may run before, after, or interleaved; the two phases share no files).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                       |
| ---------- | -------- | ---------------------------------------------------------------------------- |
| PRD-01.R18 | SHOULD   | Standards library populated: agent-drafted from primary sources, human-approved |
| PRD-01.R20 | MUST     | Accessibility baseline content (EAA / EN 301 549 / WCAG 2.1 AA) — the substance behind the mandatory tier |

## Goal Description

Phase 01 scaffolded the standards library as stubs; the authorship model is now: **agents draft, fvermaut reviews and approves** — the human does not write the content. This phase fills all nine entries.

Each entry is drafted by a dedicated research sub-agent working from **high-trust primary sources only** — official documentation, W3C/ETSI specs, EU legal texts, framework author guidance — with citations. The non-`poc-*` customer skills under `tmp/` are never source material. Every entry ends at a human gate: fvermaut reviews, requests changes, or approves; an entry is `approved` only after that gate.

## Drafting rules (apply to every sub-phase)

These implement the library discipline from `process.md`:

1. **No tool-enforceable rules in prose.** If eslint/tsc/prettier/axe can enforce it, the entry instead names the tool config that should enforce it (a "Tooling" section listing recommended config, to be applied at onboarding) — the guideline text covers only what tools cannot check.
2. **No commonplaces.** A line true of every project on Earth is deleted. Entries capture choices, patterns, boundaries, and traps specific to how *we* build with this technology.
3. **Cited.** Every non-obvious claim links a primary source. A `## Sources` section closes each entry.
4. **Current.** Verify versions/APIs against the sources at drafting time (2026); flag anything likely to churn.
5. **Short.** Target ~1 page per entry (hard cap 1.5) — these are injected into agent contexts; length is a cost.
   > ✏ Refined 2026-07-19: was "≤ 2 pages"; fvermaut's review of the first drafts found them too long (typescript called out as overkill).
6. **Status header** flips from `stub` to `Draft — pending review (fvermaut)`; after the gate, `Approved <date>`.

## Sub-phases

Each sub-phase: research → draft the entry file → self-check against the drafting rules → present to fvermaut for the review gate. All nine share zero files and **may run in parallel**; the review gates may be batched at the end for the human's convenience.

| ID  | Entry file | Scope & primary sources |
| --- | ---------- | ----------------------- |
| 03a | `standards/baseline/accessibility.md` | EAA obligations relevant to typical client work; EN 301 549 ↔ WCAG 2.1 AA mapping; the practices tooling can't check (semantics, focus, forms, ARIA judgement calls, assistive-tech testing). Sources: EUR-Lex 2019/882, ETSI EN 301 549, W3C WCAG 2.1 + Understanding docs |
| 03b | `standards/baseline/ui-ux.md` | Cross-project UI/UX invariants: loading/empty/error states, responsive posture, i18n baseline, interaction conventions. Sources: established HIG-class references, W3C |
| 03c | `standards/typescript.md` | Strictness posture, type-design patterns, the traps worth writing down. Sources: TypeScript handbook/release notes |
| 03d | `standards/nextjs.md` | Full-stack Next.js: App Router conventions, server/client component boundaries, data-fetching and caching posture, server actions. Sources: nextjs.org docs |
| 03e | `standards/prisma-postgresql.md` | Schema/migration discipline, transaction and connection posture, indexing judgement, seed conventions. Sources: Prisma docs, PostgreSQL docs |
| 03f | `standards/better-auth.md` | Session/config posture, integration with Next.js + Prisma, security defaults worth stating. Sources: better-auth docs |
| 03g | `standards/testing.md` | The TDD loop as our process defines it (seams, red→green, anti-patterns — align with `process.md` stage 6), what to test at which level, vitest/Playwright posture. Sources: process spec + vitest/Playwright docs |
| 03h | `standards/docker-compose-local.md` | Local-runtime conventions: compose layout per project, DB lifecycle, env handling, parity with previews. Sources: Docker docs |
| 03i | `standards/vercel-supabase.md` | Go-to live stack: what belongs on which side, env/secret handling, migration path from local Postgres to Supabase. Sources: Vercel/Supabase docs |
| 03j | `standards/shadcn.md` | *(added 2026-07-19 on review feedback)* shadcn/ui as the standard UI library: copy-in ownership model, theming/tokens, Radix accessibility posture, update discipline. Sources: ui.shadcn.com |

#### Agent Validation Steps (every sub-phase)

- [ ] Entry rewritten in place; status header `Draft — pending review (fvermaut)`
- [ ] Self-check passed: no tool-enforceable rules in prose (moved to a Tooling section), no commonplaces, every non-obvious claim cited, ≤ 2 pages
- [ ] `## Sources` section present with resolvable links
- [ ] **Human gate:** fvermaut reviews → changes requested (loop) or approved (status → `Approved <date>`)

## Dependency graph

```
03a … 03i → (none)   all parallel, zero shared files
```

Review gates may be batched; the phase completes when all nine entries are Approved.
