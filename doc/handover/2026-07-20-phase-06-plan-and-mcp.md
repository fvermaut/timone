# Handover — Timone (meta) — 2026-07-20

> Prior handover: [2026-07-19-phase-05-triage.md](2026-07-19-phase-05-triage.md) — everything up to the close of phase 05. This file covers only the session after it.

## Snapshot

Phase 06 is planned, executed, verified and closed: `timone-plan` exists and PRD-01.R10 is `verified`, making six stage skills and **10 of 21 PRD-01 requirements verified**. The session then ran past the phase into two pieces of unplanned work fvermaut raised at the closing gate — official framework scaffolding and MCP servers — which produced [ADR-0009](../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md), a root `.mcp.json`, six amended standards entries, and the clearing of some stale spec debt. Remaining PRD-01 lifecycle scope is execute, verify, deliver, improve (R11–R14, plus R16/R17). Nothing is mid-execution; the tree is clean apart from the deliberately-local `timone.yaml`.

## Done this session

- **Phase 06** — planned, approved, executed, closed. Plan: [phase-06.md](../plans/phases/phase-06.md); evidence: [reports/phase-06-complete.md](../plans/phases/reports/phase-06-complete.md). Commits `d12c2a4` → `2aaca98`.
- **`timone-plan`** — `.claude/skills/timone-plan/SKILL.md`, 190 lines. R10 `revised` → `verified`.
- **Two `process.md` amendments** — stage 5 gained the phase-file required elements, the three-state `Status` lifecycle, and the plan-amendment rule (`cd27dcc`, `43da2f9`).
- **ADR-0009** — CLI-first agent tooling ([link](../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md)), `b2e0587`.
- **`.mcp.json` at the timone root** — `playwright` + `next-devtools`, `0ee9c61`.
- **Six standards entries amended** — scaffolding commands, MCP adopt/decline per entry, and stale-fact corrections. All in `0ee9c61`.
- **Spec debt cleared** — PRD-02.R2 revised, plus stale phrasing in PRD-02's narrative and `product-overview.md`, and PRD-01's dead "skill delivery mechanism" open question struck.
- **Two fixture defects fixed** in the fixture repos: `scratch-app`'s PRD-01 `Draft` → `Active` (`86ffca9`), `scratch-existing`'s stale manifest-mismatch deviation (`9e06f1b`).

## In flight / blocked

- **Six standards entries carry `✏ Amended 2026-07-20 — pending approval`** and are the one thing waiting on a human: `nextjs`, `prisma-postgresql`, `better-auth`, `shadcn`, `testing`, `vercel-supabase`. Their `Status:` lines were deliberately **not** bumped — per `standards/README.md` only fvermaut approves an entry, so these are drafts sitting inside approved files. Nothing else blocks on them.
- Nothing is mid-execution. Phase 07 has not been planned.

## Decisions made this session

- **`timone-plan` is managed-projects-only** (fvermaut, at planning). The dual-scope `timone-handover` precedent was considered and declined: consistency with the other stage skills beat the dogfooding convenience. Consequence: **Timone's own phases stay hand-written** — the bootstrap does not close, and phase 07 will be planned by hand.
- **The phase-file `Status` blockquote carries the approval gate** across its lifecycle (`Awaiting approval` → `Approved for execution by <who> <date>` → `Complete`). A conventions amendment, not an ADR — passes the trade-off part of the significance test but not hard-to-reverse. Recorded in `process.md` stage 5.
- **ADR-0009 — CLI-first agent tooling.** Framework CLIs are the default surface; an MCP server is adopted only for a named capability gap, and MCP config is two-tier on credentials. See the ADR; not re-explained here.
- **No GitHub MCP** — `gh` stays the single GitHub surface (ADR-0004 already chose it). Folded into ADR-0009.
- **Correction fvermaut should know about:** the 06a spec wording was wrong on first write — it said a phase file carries `Awaiting approval` *when written*, but R10 requires approval *before* the write, making that state unreachable. A fresh-context conformance review caught it; `process.md` was corrected rather than the skill bent around it.

## Exact next action

Plan **phase 07 — the execute skill (PRD-01.R11)**: say "plan phase 07" at the timone root. It is the biggest remaining lift — real orchestration over fresh-context sub-agents — and it carries R16 (the TDD loop) inside it. Note it must be planned **by hand**: `timone-plan` is managed-projects-only by the decision above.

`projects/scratch-app/doc/plans/phases/phase-01.md` is a real, approved, unexecuted 6-slice phase file produced by the 06c dry-run — the natural fixture for exercising R11 when it lands.

Before that, if fvermaut wants: **approve or amend the six pending standards entries** (five minutes of review; they are the only thing waiting on a human).

## Open questions

- **The six pending standards amendments** — fvermaut approves, amends, or rejects. Until then they are non-normative.
- **Does `better-auth` stay the manual-setup exception?** Its own docs make manual setup the default and never mention `auth init`, and what `init` produces is undocumented — so the entry was written as the deliberate exception to the scaffolding rule. fvermaut may prefer consistency instead; it is a knowing choice either way.
- **The scoped MCP tier is untested policy** — it has zero members, so its first real use will also be its first validation, at the moment the daemon lands. Flagged in ADR-0009's consequences.
- **`standards/shadcn.md` was found with three stale facts** (CLI major version, `add --diff`, the `-b` values) that nothing would have caught but a close read. No mechanism exists to detect standards drift against upstream; worth a decision when the library next gets attention.
- **Carried from prior handovers, still open:** PRD-02's session continuity, ticket-marking, and preview-exposure questions; the `ticketing: github` binding vs `repo_url` guard in `timone-triage`; and whether draft-PRD divergence should count as a bug.
