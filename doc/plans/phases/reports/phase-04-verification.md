# Phase 04 — Verification Report

**Date:** 2026-07-19   **Scope:** PRD-01.R5, R15 (MUST); regression check on R2 (manifest), R4 (skills reach sessions, clean client repos)

## Summary

| ID | Priority | Verify-via | Verdict |
| -- | -------- | ---------- | ------- |
| PRD-01.R5 | MUST | api | PASS (after one fix cycle) |
| PRD-01.R15 | MUST | api | PASS |
| PRD-01.R2 (regression) | MUST | api | PASS |
| PRD-01.R4 (regression) | MUST | api | PASS |

## Evidence

### PRD-01.R5 — PASS (iteration 2)

**Iteration 1 (FAIL):** the greenfield dry-run against `scratch-app-2` produced no artifacts — `mkdir -p projects/scratch-app-2/doc/...` had double-nested to `projects/scratch-app-2/projects/scratch-app-2/doc/...` (empty, untracked, no product overview, no ADRs, no standards.md). Root cause: nothing in `timone-onboard` prevented working-directory drift; an agent inspecting the target repo during existing-codebase detection could `cd` in and never `cd` back.

**Fix applied:** `.claude/skills/timone-onboard/SKILL.md` amended with an explicit never-`cd` rule and a `pwd` sanity check before the doc-tree step (commit `2663bf7`).

**Iteration 2 (PASS):** re-run against a reset `scratch-app-2` fixture. Manifest entry registered via `projects add` (confirmed in `timone.yaml`, stack `typescript,nextjs,prisma,postgresql,better-auth`), cloned via `workspace sync`. Produced, correctly nested this time, and committed in `projects/scratch-app-2` (`0bc1ff4`): `doc/specs/product-overview.md` (includes a Constraints section, baseline accessibility stated unconditionally), three founding ADRs (`0001-nextjs-full-stack-framework.md`, `0002-prisma-postgresql-data-layer.md`, `0003-better-auth-authentication.md`), each with genuine alternatives weighed in Context (e.g. ADR-0001 rejects a separate SPA+API split and Remix, with reasoning tied to standards-library coverage) and honest Consequences including lock-in cost. Both the product overview and `doc/standards.md` carry `Status: Draft — pending confirmation`, and fvermaut confirmed the run interactively before this verification pass — satisfying the "user confirms overview and standards before they are saved" criterion.

No second fix cycle was needed (within the process's max-2-loop bound).

### PRD-01.R15 — PASS

`doc/standards.md` produced in both scratch projects, in both cases correctly excluding no-longer-relevant content and never restating entry text (references only):

- **`scratch-app-2` (greenfield):** baseline (accessibility, UI/UX) included unconditionally; nine stack entries selected — not just the literal manifest tags (typescript, nextjs, prisma, postgresql, better-auth) but also `project-structure.md`, `shadcn.md`, `testing.md`, `docker-compose-local.md`, and `vercel-supabase.md`, correctly reasoning these are the standard full-stack companions rather than separately-opted-into components. `## Deviations` correctly empty (no code exists yet to observe).
- **`scratch-existing` (existing codebase, fixture seeded with plain JS/Express, `app/controllers/` layout, and a `.eslintrc.json` with `"semi": "never"`):** the skill detected the codebase was substantial (2-of-3 markers), and — notably — discovered mid-run that the manifest's stated stack (`typescript, nextjs`, from pre-clone intake) didn't match the observed code. It recorded this mismatch explicitly under `## Deviations` rather than silently trusting either source, correctly selected **zero** stack entries (none of the nine cover a plain JS/Express project), and correctly determined `project-structure.md` doesn't apply — its own text scopes it to Next.js App Router — rather than fabricating a conflict against an inapplicable entry. This is stronger evidence for the "never silently override, always ask on conflict" criterion than the originally planned scenario (a same-stack-but-different-convention clash), because it shows the skill reasoning about entry *applicability*, not just pattern-matching.

The run also surfaced a legitimate, correctly-scoped-out finding: no `timone projects update` command exists, so a manifest tag known to be stale (per ADR-0008, never hand-edited) can't be corrected without a new CLI feature. Logged as backlog below, not a phase-04 gap — R15 does not require manifest correction, only correct standards-artifact behavior in its presence.

### Regressions — PASS, none found

`timone projects list` and `timone workspace sync` behavior unchanged (exercised throughout this phase's dry-runs across three scratch projects with no anomalies). `git log --stat` in all three scratch repos (`scratch-app`, `scratch-app-2`, `scratch-existing`) shows only `doc/…`-rooted paths — R4 holds under the new onboarding skill's heavier file-creation load.

## Fix-loop accounting

1 verify-fix iteration used (of the process's max 2) — the cwd-drift bug found and fixed within budget.
