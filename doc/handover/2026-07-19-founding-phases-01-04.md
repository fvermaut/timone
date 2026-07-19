# Handover — Timone (meta) — 2026-07-19

> Prior handover: none — this is the first.

## Snapshot

Today's session took Timone from a name (chosen in a prior Gemini conversation) to a working harness: the founding specs, four completed phases, eight ADRs, an 11-entry approved standards library, and four working stage skills (onboard, grill, PRD, ADR) — all dry-run against real scratch fixtures, including one bug found and fixed by the dry-run process itself. The remaining lifecycle skills (triage, plan, execute, verify, deliver, improve) and the inverted-control daemon (PRD-02) are still ahead.

## Done this session

- **Product overview + PRD-01/PRD-02** — [doc/specs/product-overview.md](../specs/product-overview.md), [prd-01-process-layer.md](../specs/prd/prd-01-process-layer.md) (+ `.criteria.md`), [prd-02-inversion-of-control.md](../specs/prd/prd-02-inversion-of-control.md) (+ `.criteria.md`). PRD-01 = the process layer (priority #1, per correction below); PRD-02 = the daemon-driven loop, not yet started.
- **`process.md`** (repo root) — the single written definition of all 12 stages + 2 cross-cutting utilities (onboarding, handover).
- **Eight ADRs** — [doc/adr/](../adr/): 0001 (independent repos, gitignored workspace), 0002 (TS + Agent SDK), 0003 (local daemon runtime), 0004 (GitHub-first adapters), 0005 (Docker previews), 0006 (specs in-repo, single source of truth), 0007 (**sessions run at the timone root**, skills resolve a target project — governs everything), 0008 (manifest writes only via CLI, never hand-edited YAML).
- **Phase 01** — CLI scaffold, `timone.yaml` manifest + loader, `projects list`, `workspace sync`. [Complete](../plans/phases/phase-01.md).
- **Phase 02** — skill conventions (`.claude/skills/README.md`), root `CLAUDE.md`, and the `timone-grill` / `timone-prd` / `timone-adr` skills. [Complete](../plans/phases/phase-02.md).
- **Phase 03** — the standards library: 2 baseline entries (accessibility — EAA/EN 301 549/WCAG 2.1 AA — and UI/UX, mandatory on every project) + 9 stack entries (typescript, nextjs, project-structure/bulletproof-react, shadcn, prisma-postgresql, better-auth, testing, docker-compose-local, vercel-supabase). All 11 **Approved** by fvermaut after a conciseness review round. [Complete](../plans/phases/phase-03.md).
- **Phase 04** — `timone projects add` (built TDD, red→green) + the `timone-onboard` skill (greenfield + existing-codebase paths, `doc/standards.md` drafting). [Complete](../plans/phases/phase-04.md) — the dry-run caught a real cwd-drift bug (fixed in `2663bf7`), and separately surfaced a legitimate gap logged as backlog below.
- **`timone-handover` skill** (this session, just before this file) — [SKILL.md](../../.claude/skills/timone-handover/SKILL.md), PRD-01.R21.

PRD-01 requirement status: **11 verified**, 1 revised-not-yet-reverified in isolation (R10, folded into R5/R15 verification), 9 still `draft` (R6, R11–R14, R16, R17, R18 — wait, R18 is verified; the drafts are R6, R11, R12, R13, R14, R16, R17, R21).

## In flight / blocked

Nothing mid-execution — phase 04 closed cleanly, working tree is clean except the local (deliberately uncommitted) `timone.yaml`. The natural next unit of work (phase 05 — triage, R6) has **not been planned yet**; this handover is the stopping point before that plan gets cut.

## Decisions made this session

- **Process coverage is requirement #1**, before inversion of control — corrected fvermaut's initial framing; drove PRD-01/PRD-02 split. See `[[process-coverage-is-priority-one]]` in memory.
- **ADRs are standalone artifacts**, written at decision time, never embedded as plan sub-phases — corrected mid-phase-01. See `[[adrs-are-standalone-artifacts]]`.
- **Sessions run at the timone root**, not inside `projects/<name>` — [ADR-0007](../adr/0007-sessions-at-timone-root.md), a significant correction to the original design (skills were going to be delivered/symlinked into project dirs; instead they're timone's own project-level skills, and every skill resolves a target project).
- **Standards authorship**: agents draft from cited primary sources, fvermaut reviews and approves — not the reverse. Non-`poc-*` files under `tmp/skills/` are permanently off-limits as source material.
- **Mandatory accessibility/UI-UX baseline** — [PRD-01.R20](../specs/prd/prd-01-process-layer.criteria.md), driven by the EAA (applicable since 2025-06-28); no opt-out, enforced at requirements/verification/delivery.
- **Preferred stack** locked in: TypeScript, Next.js full-stack, Prisma+PostgreSQL, better-auth, shadcn/ui, bulletproof-react structure; Docker Compose locally, Vercel+Supabase as the go-to live target.
- **Manifest writes only via CLI** — [ADR-0008](../adr/0008-manifest-writes-via-cli-command.md), validated during phase 04 when the existing-codebase dry-run hit a stale manifest tag and correctly refused to hand-edit around it.

## Exact next action

Cut the **phase 05 plan** for the **triage skill** (`PRD-01.R6`) — the smallest remaining stage skill, and the natural entry point once a ticket-shaped request exists. Prerequisite check before planning: none blocking: `timone-onboard`/`timone-grill`/`timone-prd`/`timone-adr` are all available and dry-run-proven. Suggested invocation next session: continue this conversation or start fresh at the timone root and ask to plan phase 05, or simply say "plan the triage skill."

After triage, the natural sequence is **plan → execute** (R10/R11 — the bigger lift, since execute is genuinely new orchestration code, not a document-producing skill) **→ verify/deliver/improve** (R12–R14), which together close out PRD-01's MVP-relevant scope before PRD-02's daemon begins.

## Open questions

- **`timone projects update` command** — no way to correct a manifest entry once registered (only `add`); surfaced live during phase 04's existing-codebase dry-run. Not blocking anything yet, but will bite the first time a real project's stack tag needs correcting. Decide: build it opportunistically in phase 05, or defer to whenever it's actually needed?
- **Skill-delivery mechanism vs. daemon sessions (PRD-02)** — interactive skills work today via `.claude/skills/`; how the future daemon injects the same skills into programmatic Agent SDK sessions is still open (noted as an open question in PRD-01's narrative since its first draft).
- **PRD-02's three open questions** — session continuity across gates, ticket-marking convention, preview exposure (localhost vs public) — untouched since PRD-02 was drafted; still open when that PRD's phases eventually start.
