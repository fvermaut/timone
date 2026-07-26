# Phase 07 — Completion Report

- **Date:** 2026-07-26
- **Plan:** [phase-07.md](../phase-07.md) — planned by hand (`timone-plan` is managed-projects-only by design), approved for execution by fvermaut 2026-07-24, amended twice in place with dated `✏ Refined` markers. Both amendments were *corrective* — they replaced a run expectation the dry run disproved — so under stage 5's re-approval rule the stamp stood.
- **Requirements:** PRD-01.R11 (MUST) — `verified`; PRD-01.R16 (MUST, verify-via `human`) — `verified`, on fvermaut's sign-off of 07c's evidence 2026-07-26.

## Summary

Stage 6 now has a skill. `timone-execute` reads an approved phase file, checks it against the repository before cutting anything, walks its sub-phases in dependency order through fresh sub-agent contexts, gates every transition on the slice's own validation block, and closes the phase with a completion report. R16 lives inside that loop: tests at declared seams only, red before green, one slice at a time.

**The dry run was the phase's centre of gravity by a wide margin** — four runs across three fixtures produced **seven rounds of fixes, roughly 35 defects**. The headline evidence is `projects/scratch-app`: a working Next.js 16 + PostgreSQL 17.5 to-do application built from an empty repository by the skill under test, seven slices, each with a red-green trace in the handoff chain.

The defects worth remembering are the ones no amount of desk-checking would have found, because they only exist *between* slices or *between* runs: a resume cross-check that fired gate 3 on the first real resume it ever saw; an escalation path that left state the resume path then rejected; a parallelism test that compared files while the actual collision travelled through the database; and a branch rule under which no project could ever start its second phase.

## Sub-phase outcomes

| Sub-phase | Outcome | Commits |
| --- | --- | --- |
| 07a — `process.md`: stage-6 required elements, branch/commit conventions, handoff home, escalation semantics; `.claude/skills/README.md` artifact-rule reconciliation | Done. The artifact rule had to be reconciled because this is the first stage whose skill commits *code* into a client repo — it now permits that while still forbidding skill, harness and timone-internal files, matching R4's wording. | `b811d7e`, `9404f88` |
| 07b — `timone-execute` skill | Done. Three terminal gates, two inline templates, and a sub-agent contract stated as inputs/outputs with the spawning mechanism named only as an example — so PRD-02's daemon can substitute the Agent SDK without editing the skill. | `3561f42` |
| 07c — dry run, 4 runs across 3 fixtures | Done; seven rounds of fixes; human gate passed by fvermaut 2026-07-26. | `40b25c8`, `060380e`, `d08f9ee`, `17273ad`, `e8b87a8`, `5633b65`+`1f84997`, `1e9dd98` |
| 07d — docs + R11/R16 → `verified` | Done; plus one spec/skill divergence found and closed at the close — see deviations. | this commit |

## Dry-run evidence (07c)

| Run | Fixture | Scope | Outcome |
| --- | --- | --- | --- |
| 1 | `scratch-app` | phase 01 — the whole to-do vertical, from an empty repo | **Executed to completion.** Seven slice commits (01a–01g) on `phase-01-to-do-list-vertical`, seven handoff sections with red-green traces, completion report, `Status: Complete`. The app runs and was loaded in a browser, not merely built. |
| 2 | `scratch-existing` | a planted plan-level defect, expected to escalate | **Expectation disproven, and the plan amended to say so.** Both attempts stopped at pre-flight — correctly: a plan-level defect is visible at read time by construction, so the feasibility check round 1 added catches it before a branch is cut. The fixture instead carries a *successful* three-commit execution against a real Express repo. |
| 3 | `scratch-app-2` | a plan stamped `Awaiting approval` | **Terminal refusal**, routing named. The fixture still sits on `main` at `34aee3f docs: plan phase 01 … (awaiting approval)` — no branch, no code. The negative is the evidence. |
| 4 | `scratch-app` | an appended slice needing the database container, run with Docker stopped | **Never fired.** See below. |

Run 1 is R11's and R16's positive evidence. The R4 regression probe passes: `git log --stat` across every touched fixture shows no `.claude/`, harness or timone-internal file — the first time a skill has committed code into a client repo.

**Beyond the plan's scope, the same fixture also ran phase 02** — a latency smoke check — which is what exposed round 7's branch defect. `scratch-app` therefore carries two stacked unmerged branches, both waiting on stages 7 and 8.

## Defects found by the dry run (all fixed)

Seven rounds; the full enumeration is in the round commit messages. By theme:

- **Round 1 (8)** — the dirty-tree rule contradicted the escalation path, making an escalated phase unresumable; gate-1 routing claimed re-planning could manufacture a missing approval; there was no read-time feasibility check at all; `CONTEXT.md` bound the code but was not among a slice's inputs.
- **Round 2 (5)** — amendment-vs-re-approval was circular, defining its trigger by its own conclusion; the handoff file appeared in no plan's file list, so the contract required writing a file it forbade touching; and some declared cases cannot be driven red honestly, which sanctioned mutation as the non-vacuity proof.
- **Round 3 (5)** — the first real resume was one the skill told the agent to abort; escalation and resume contradicted each other; test files at declared seams were not granted, so a slice obeying its file list literally could not test anything.
- **Round 4 (3)** — **failure probes must be trippable only by code.** A grep for a forbidden API also matches the comment explaining why the code avoids it, so a correct implementation with a good comment fails and the cheapest fix is a worse comment. Three consecutive slices hit it. Also: no rule forbade editing correct work to satisfy a defective assertion.
- **Round 5 (4)** — the parallelism test checked file overlap only, while 01d and 01e shared zero files and collided through the database; nothing re-checked earlier slices before closing.
- **Round 6 (4)** — re-running prior validations could not distinguish a regression from a checkbox a later slice is *meant* to falsify; the re-runs were treated as a set when they are a destructively interacting sequence.
- **Round 7 (1)** — **the branch rule could never start a second phase.** Found preparing a fixture rather than running one.

## Deviations from the plan

1. **Run 2's expectation was wrong and the run proved it** (`✏ Refined 2026-07-24`). A planted plan defect can no longer produce an escalation, because the pre-flight check the dry run itself added catches it first. Escalation is for *implementation* failure, so it moved to a new run 4. The fixture also moved from `scratch-app-2` (docs-only, so slice one could not commit anything real) to `scratch-existing`.
2. **Run 1 delivered seven slices, not the planned six.** 01g was added mid-phase by amendment, after 01e's seed turned 01d's committed keyboard-traversal test red — the collision that stopped the phase and forced a re-approval. The plan's "six commits / six sections" checkboxes are satisfied by seven of each.
3. **Run 4 — the escalation path — never fired, and is being closed deliberately untested.** Three attempts, each defeated for the same structural reason: the better the skill got, the harder that path became to reach honestly. A broken plan is caught at pre-flight; a missing grant or a stopped container is gate 3 at once, because no retry could change either; an optimistic performance budget was simply met. Provoking it would mean engineering a trap designed to defeat a competent agent, which tests the author's ingenuity rather than the tool. **The behaviour is fully specified and has never executed.** The recommendation on the record — in [STATUS.md](../../../../STATUS.md) and accepted at the gate — is to let the first real failure on a genuine project be its test, with the report of that failure noting that it is also R16's first exercise of escalation.
4. **One spec/skill divergence found while closing 07d, and closed here.** Round 7's branch-stacking fix landed in `.claude/skills/timone-execute/SKILL.md` only; `process.md` still said the work branch is cut from the default branch, with no stacking case. `process.md` is normative and outranks a skill, so the skill's own rule was contradicted by the spec above it. Amended in stage 6's note — spec corrected rather than skill bent, per 07c's own rule.

**Two artifacts landed this phase that the plan did not call for**, both recorded rather than silently absorbed: the six approved standards amendments carried over from phase 06's open list (`bddfbff`), and `STATUS.md` plus PRD-01.R22 (`a5e659d`, `d31adb7`) — a plain-language status report per project, requested by fvermaut mid-phase and implemented as a MUST obligation on every stage rather than as a new skill, because hand-maintained status docs rot unless the duty sits on the stages that cause the change.

## Context for the next agent

**Seven stage skills now exist:** onboard, triage, grill, prd, adr, plan, execute. Remaining PRD-01 lifecycle scope: **R12** (verify), R13 (deliver), R14 (improve), R17 (two-axis delivery review, inside deliver).

**The natural next phase is 08 — the verify skill (R12)**, and `scratch-app` is now exactly the fixture it needs: a project with a criteria register (`prd-01-todo-list.criteria.md`, every ID still `draft` — execution deliberately left them alone, since `verified`/`failed` are stage 7's to write) and a genuinely runnable application. Nothing had that before this phase.

**What stage 7 inherits from the dry run**, all flagged in `projects/scratch-app`'s own completion report and not resolved there:

- **R7's screen-reader criterion is a HUMAN-CHECK no automation closes** — an axe scan does not satisfy "announced meaningfully", and `standards/baseline/accessibility.md` says outright that automated scans cannot establish conformance.
- **The axe scan ran against `next dev`.** A production build is the right target — and `/` is statically prerendered with a 15-minute revalidation window, so seed before building or the scan meets an empty list.
- **Focus after deleting a to-do is unspecified.** It drops to `<body>`. Three agents declined to invent a rule, since encoding one would make a test the de facto owner of a product decision. This owes a decision, and stage 7's keyboard pass is the natural moment.

**Open items belonging elsewhere:** `baseline/ui-ux.md` and `baseline/accessibility.md` contradict each other on pending controls (measurably — disabling a focused checkbox blurs it and focus never returns); four standards corrections from `c20747a` are `pending approval`; `prisma-postgresql.md` omits `importFileExtension`, so the generated client is unloadable by bare `node`; and `timone-onboard` cannot backfill a missing artifact into an already-registered project, which wants its own chore and arguably an R5 revision.
