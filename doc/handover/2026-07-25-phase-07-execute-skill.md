# Handover — Timone (meta) — 2026-07-25

> Prior handover: [2026-07-20-phase-06-plan-and-mcp.md](2026-07-20-phase-06-plan-and-mcp.md) — everything up to the close of phase 06. This file covers only the session after it.

## Snapshot

Phase 07 is built and proven but **not closed**: `timone-execute` exists (`.claude/skills/timone-execute/SKILL.md`), and 07a/07b/07c are done, but **07d is gated on fvermaut signing off 07c's dry-run evidence** — the one thing blocking the phase. The dry run was the phase's centre of gravity by a wide margin: it executed `scratch-app` phase 01 end to end into a working Next.js + PostgreSQL app, and produced **seven rounds of skill fixes, roughly 35 defects**. Two new artifacts landed outside the plan: the six approved standards amendments from the prior handover's open list, and `STATUS.md` (PRD-01.R22), a plain-language status report per project requested by fvermaut. The tree is clean apart from the deliberately-local `timone.yaml` and an untracked `doc/todo.md` of unknown provenance.

## Done this session

- **Six pending standards entries approved** — the prior handover's headline blocker, cleared (`bddfbff`). `nextjs`, `prisma-postgresql`, `better-auth`, `shadcn`, `testing`, `vercel-supabase`.
- **Phase 07 planned by hand** — [phase-07.md](../plans/phases/phase-07.md), `8bf4526`, amended twice in place with `✏ Refined` markers.
- **07a** — `process.md` stage-6 required elements (branch/commit conventions, handoff home, completion-report elements, escalation semantics) plus the `.claude/skills/README.md` artifact-rule reconciliation (`b811d7e`, follow-up `9404f88`).
- **07b** — `timone-execute` skill (`3561f42`).
- **07c** — dry run: four runs across three fixtures. Seven rounds of fixes: `40b25c8`, `060380e`, `d08f9ee`, `17273ad`, `e8b87a8`, `5633b65`+`1f84997`, `1e9dd98`.
- **Four standards entries corrected against what execution proved** (`c20747a`) — all marked *pending approval*, see Open questions.
- **`STATUS.md` + PRD-01.R22** (`a5e659d`, `d31adb7`) — plain-language status per project and for Timone, as a MUST obligation on every stage rather than a new skill.
- **On `scratch-app`:** phase 01 executed to completion (7 slices, working app, branch `phase-01-to-do-list-vertical`), `doc/standards.md` backfilled and ratified, phase 02 executed and closed on a stacked branch. All unmerged — stage 8 does not exist.

## In flight / blocked

- **07d is the only remaining work in phase 07** and is blocked on fvermaut's review of 07c's evidence. It is small: flip PRD-01.R11 and R16 to `verified`, add `/timone-execute` to `README.md`, update the Status paragraph. **Do not flip R11/R16 before the human gate passes** — the plan states it explicitly.
- **The escalation path (bounded retries → hand back to a human) has never fired.** Specified in 07a, refined twice, untested after three deliberate attempts. Each failed for the same structural reason: the better the skill got, the harder that path became to reach honestly — a broken plan is caught at pre-flight, a missing grant or stopped container stops immediately (a retry cannot change either), and an optimistic performance budget was simply met. **Recommendation recorded in [STATUS.md](../../STATUS.md): let the first real failure on a genuine project be its test.** Do not engineer a further trap; that tests the author's ingenuity, not the tool.
- **`projects/scratch-app` has two stacked unmerged branches** — phase 02 on top of phase 01. Both wait on stage 7 (verify) and stage 8 (deliver), neither of which exists.
- **`doc/todo.md`**, one line reading `- ISO standards`, untracked at the Timone root. Not written by any agent in this session; left untouched pending fvermaut.

## Decisions made this session

- **Re-approval rule for amended plans** (`process.md` stage 5): an amendment that *reduces* scope keeps the approval stamp; one that *changes or grows* it — new sub-phase, new file marker, changed seam, new assertion — voids the stamp and reverts the file to `Awaiting approval`. Written because gate 1's original trigger ("amended in a way that needs re-approval") defined itself. Exercised twice on `scratch-app` phase 01, both times with fvermaut re-approving.
- **Work branches stack on the previous phase's branch when it is complete but unmerged** (`1e9dd98`). The original rule — cut from the default branch — meant **no project could ever start its second phase**, since a finished phase waits unmerged for a human. Found preparing a fixture, not running one.
- **Failure probes must be trippable only by code** (`timone-plan`). A grep for a forbidden API also matches the comment explaining why the code avoids it, so a correct implementation with a good comment fails and the cheapest fix is a worse comment. Three consecutive slices hit it.
- **The sub-agent contract is stated as inputs/outputs, with the spawning mechanism named only as an example** — so PRD-02's daemon can substitute the Agent SDK unedited. Recorded in phase 07's Goal Description with the significance-test reasoning that kept it out of an ADR.
- **`STATUS.md` is an obligation on every stage, not a skill** — hand-maintained status docs rot, so the duty sits on the stages that cause the change. Explicitly one-directional: agents write it, never read it as truth.
- **Correction fvermaut should know about:** two errors of mine were caught by sub-agents, not by me. Amending `standards/typescript.md` I overwrote the approved baseline in the body, leaving no record of what had been approved. And my 01b amendment's *prescription* was wrong on three technical counts (a root `resolve` is not inherited by inline Vitest `projects`; the effective key is `ssr.resolve.conditions`; a bare `"@"` alias corrupts scoped packages) — right diagnosis, wrong fix. Both corrected.

## Exact next action

**Ask fvermaut to sign off 07c's dry-run evidence.** The evidence is the working app at `projects/scratch-app/` plus its reports under `projects/scratch-app/doc/plans/phases/reports/` (`phase-01-complete.md`, `phase-01-handoffs.md`). On sign-off, execute **07d by hand** — `timone-plan` and `timone-execute` are managed-projects-only, so Timone's own phases stay hand-run.

Then plan **phase 08 — the verify skill (PRD-01.R12)**. `scratch-app` is now the fixture it needs: a project with a criteria register and a genuinely runnable app, which is exactly what R12 requires and what nothing had before this session.

## Open questions

- **The four standards corrections from `c20747a` are `pending approval`** — `nextjs`, `typescript`, `prisma-postgresql` (twice over). Factual corrections of instructions that provably do not work, but non-normative until fvermaut approves.
- **`baseline/ui-ux.md` and `baseline/accessibility.md` contradict each other.** ui-ux requires submitting controls to go disabled/pending; disabling a focused checkbox blurs it and focus never returns, measurably breaking WCAG 2.4.3. Both are no-opt-out, so one entry must be amended — suggested scoping: the pending rule applies only to controls whose repeat activation is *unintended*. fvermaut resolves.
- **Where focus goes after deleting a to-do** — undefined in plan and PRD; three agents declined to invent it. Blocks stage 7's verification of R7 on `scratch-app`.
- **`prisma-postgresql.md` omits `importFileExtension`**, so the generated client is unloadable by bare `node`. Cost one slice a ~25-line workaround.
- **`timone-onboard` cannot backfill a missing artifact** — it aborts on an existing manifest entry and an existing directory, and it is the sole owner of `doc/standards.md`. So any project missing a stage-0 artifact is unfixable through the process; this session's backfill only worked by overriding those aborts. Wants its own chore, and arguably an R5 revision.
- **The zod deviation granted on `scratch-app` does not cover `toggleTodoAction`/`deleteTodoAction`** — a differently shaped boundary now in the codebase.
- **Carried from prior handovers, still open:** no mechanism detects standards drift against upstream; PRD-02's session continuity, ticket-marking and preview-exposure questions; the `ticketing: github` binding vs `repo_url` guard in `timone-triage`; whether draft-PRD divergence should count as a bug.
