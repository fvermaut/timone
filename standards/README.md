# Standards Library

Central, per-stack engineering standards injected into agent sessions alongside the stage skills. Each managed project's `doc/standards.md` selects the entries that apply and records project-specific deviations.

**Authorship model:** agents draft each entry from cited primary sources (see [phase-03](../doc/plans/phases/phase-03.md)); fvermaut reviews and approves. An entry is normative only once approved. (The non-`poc-*` customer skills under `tmp/` are not source material.)

Discipline for every entry (see `process.md`, "The standards library"):

- Tool-enforceable rules live in tool config — the eslint/tsconfig/prettier setup *is* the standard; never restate it in prose.
- Capture only what tooling cannot enforce: choices, patterns, boundaries, "never do X here" rules.
- If a line would be true of every project on Earth, it doesn't belong.

## Baseline (mandatory — every project, no opt-out)

| Entry | Scope | Status |
|-------|-------|--------|
| [baseline/accessibility.md](baseline/accessibility.md) | EAA / EN 301 549 / WCAG 2.1 AA compliance | Draft — pending review |
| [baseline/ui-ux.md](baseline/ui-ux.md) | Cross-project UI/UX invariants | Draft — pending review |

Every project's `doc/standards.md` includes the baseline unconditionally. Enforcement: PRD accessibility criteria (stage 3), verification checks (stage 7), delivery Standards review (stage 8).

## Stack entries (selected per project)

| Entry | Scope | Status |
|-------|-------|--------|
| [typescript.md](typescript.md) | Language-level practices | Draft — pending review |
| [nextjs.md](nextjs.md) | Next.js full-stack | Draft — pending review |
| [shadcn.md](shadcn.md) | UI component library (shadcn/ui) | Draft — pending review |
| [prisma-postgresql.md](prisma-postgresql.md) | Data layer | Draft — pending review |
| [better-auth.md](better-auth.md) | Authentication | Draft — pending review |
| [testing.md](testing.md) | TDD & test quality (seams, anti-patterns) | Draft — pending review |
| [docker-compose-local.md](docker-compose-local.md) | Local runtime | Draft — pending review |
| [vercel-supabase.md](vercel-supabase.md) | Go-to live deployment | Draft — pending review |
