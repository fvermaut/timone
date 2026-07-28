# Standards Library

Central, per-stack engineering standards injected into agent sessions alongside the stage skills. Each managed project's `doc/standards.md` selects the entries that apply and records project-specific deviations.

**Authorship model:** agents draft each entry from cited primary sources (see [phase-03](../doc/plans/phases/phase-03.md)); fvermaut reviews and approves. An entry is normative only once approved. (The non-`poc-*` customer skills under `tmp/` are not source material.)

Discipline for every entry (see `process.md`, "The standards library"):

- Tool-enforceable rules live in tool config — the eslint/tsconfig/prettier setup *is* the standard; never restate it in prose.
- Capture only what tooling cannot enforce: choices, patterns, boundaries, "never do X here" rules.
- If a line would be true of every project on Earth, it doesn't belong.
- Agent tooling is CLI-first ([ADR-0009](../doc/adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md)): an entry adopting an MCP server must name the capability its CLI cannot provide. Silence means the CLI covers it.

## Baseline (mandatory — every project, no opt-out)

| Entry | Scope | Status |
|-------|-------|--------|
| [baseline/accessibility.md](baseline/accessibility.md) | EAA / EN 301 549 / WCAG 2.1 AA compliance | Approved 2026-07-19 |
| [baseline/ui-ux.md](baseline/ui-ux.md) | Cross-project UI/UX invariants | Approved 2026-07-19 |

Every project's `doc/standards.md` includes the baseline unconditionally. Enforcement: PRD accessibility criteria (stage 3), verification checks (stage 7), delivery Standards review (stage 8).

## Review references (applied by stage 8 to every project, overridable)

| Entry | Scope | Status |
|-------|-------|--------|
| [code-smells.md](code-smells.md) | The fixed smell checklist the delivery Standards review checks a diff against | Draft 2026-07-28 |

A project's own `doc/standards.md` overrides this tier on conflict — which is why it is not the mandatory baseline, a tier that admits no exceptions. It is also the sanctioned exception to the universality rule below: a review checklist shared across projects is universal by construction, and a per-project smell list would make two reviews incomparable.

## Stack entries (selected per project)

| Entry | Scope | Status |
|-------|-------|--------|
| [typescript.md](typescript.md) | Language-level practices | Approved 2026-07-19 |
| [nextjs.md](nextjs.md) | Next.js full-stack | Approved 2026-07-24 |
| [project-structure.md](project-structure.md) | Project structure (bulletproof-react) | Approved 2026-07-19 |
| [shadcn.md](shadcn.md) | UI component library (shadcn/ui) | Approved 2026-07-24 |
| [prisma-postgresql.md](prisma-postgresql.md) | Data layer | Approved 2026-07-24 |
| [better-auth.md](better-auth.md) | Authentication | Approved 2026-07-24 |
| [testing.md](testing.md) | TDD & test quality (seams, anti-patterns) | Approved 2026-07-24 |
| [docker-compose-local.md](docker-compose-local.md) | Local runtime | Approved 2026-07-19 |
| [vercel-supabase.md](vercel-supabase.md) | Go-to live deployment | Approved 2026-07-24 |
