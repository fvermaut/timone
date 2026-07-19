# Phase 04 — Completion Report

**Date:** 2026-07-19

## Summary

All five sub-phases delivered: `timone projects add` (04a, built TDD — the first genuinely test-first code sub-phase since phase 01), the `timone-onboard` skill's greenfield path (04b) and standards/existing-codebase extension (04c), an end-to-end dry-run across two scenarios (04d — which caught and fixed a real bug), and this documentation update (04e). Onboarding is now real: a project can go from "just a repo URL" to a registered, cloned, documented, ADR-anchored, standards-governed managed project in one skill invocation.

## Requirement Verification

2/2 MUST verified — R5, R15 — plus a clean regression pass on R2 and R4. See [phase-04-verification.md](phase-04-verification.md). One fix-loop iteration was used (of the process's max 2): the first dry-run failed outright due to a cwd-drift bug in the doc-tree step; fixed and re-verified within budget.

## Key Decisions

- [ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md): manifest writes go exclusively through `timone projects add`, never hand-edited YAML — validated by `04c`'s dry-run, which hit exactly the scenario this was meant to prevent (a stale manifest tag) and correctly refused to patch around it, surfacing the gap instead of working around the discipline.
- `timone-onboard` treats "which standards entries apply" as a judgement call, not a literal tag match — greenfield selection pulled in `project-structure.md`, `testing.md`, `docker-compose-local.md`, and `vercel-supabase.md` beyond the manifest's literal stack tags, correctly reasoning they're the standard companions to the chosen stack. Worth watching in future onboardings that this doesn't over-select.
- The existing-codebase dry-run revealed the skill correctly checks a library entry's *stated scope* before treating a mismatch as a conflict (declined to flag `project-structure.md` against a non-Next.js repo, since that entry is explicitly Next.js-scoped) — this is the R15 second criterion working as intended, and more rigorously than the originally planned test scenario would have shown.

## Known Limitations / Deferred Items

- **No `timone projects update` command.** Discovered live: `scratch-existing`'s manifest stack tag (`typescript, nextjs`, recorded at intake) turned out to be wrong once the repo was inspected (it's plain JS/Express). ADR-0008 correctly blocks hand-editing `timone.yaml` to fix it, but there's no CLI path to correct it either — the mismatch is recorded as a permanent Deviation instead. A `projects update` command (or a `projects add --force`/upsert mode) is legitimate follow-up scope, not required for R5/R15.

## Context for Next Agent

- Working skills: `timone-grill`, `timone-prd`, `timone-adr`, `timone-onboard` — all four document-producing stage skills of the pipeline now exist and have been dry-run end to end.
- `timone-onboard`'s never-`cd` rule (added mid-phase) is a pattern worth checking for in every future skill that inspects files inside a managed project — the same drift risk exists anywhere a skill reads target-project files.
- Three scratch fixtures now exist under `tmp/fixtures/` (`scratch-app`, `scratch-app-2`, `scratch-existing`) and are registered in the local (uncommitted) `timone.yaml` — reusable for future dry-runs (triage, plan, execute).
- Remaining PRD-01 scope: R6 (triage), R10 (plan, revised), R11 (execute), R12 (verify), R13 (deliver), R14 (improve), R16 (TDD loop enforcement — 04a is the first real precedent), R17 (two-axis delivery review). Natural next phase: triage (R6) is small and unblocks a real ticket-shaped entry point; plan/execute (R10/R11) are the bigger lift after that.

## Key Files Changed

- `src/manifest.ts`, `src/commands/projects.ts`, `src/manifest.test.ts` — `projects add` command
- `.claude/skills/timone-onboard/SKILL.md`
- `doc/adr/0008-manifest-writes-via-cli-command.md`
- `projects/scratch-app-2/{doc/specs/product-overview.md, doc/standards.md, doc/adr/0001-0003-*.md}`, `projects/scratch-existing/{doc/specs/product-overview.md, doc/standards.md}` (in the scratch projects' own repos)
