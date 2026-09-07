# Phase 35 — Delivery Report

- **Date:** 2026-09-07
- **Phase:** [phase-35.md](../phase-35.md) — `Complete`, verified in [phase-35-verification.md](phase-35-verification.md), live gate in [phase-35-live-gate.md](phase-35-live-gate.md)
- **Branch:** `timone/105-1-the-run-carries-on-instead-of-stopping` @ `f1f0c63`
- **Base:** `main` — the phase's branch was cut from `main` (merge-base `ca9a38f`); not stacked.
- **Pull request:** opened against this report (URL in the closing message).
- **Look gate:** no user-facing screen in this phase — it changes the daemon, three build-stage skills, and `process.md`. [ADR-0039](../../../adr/0039-the-look-is-gated-twice.md) does not apply.

## Scope

The first piece of ticket [#103](https://github.com/fvermaut/timone/issues/103): from a run's last human agreement to its pull request, the build stages stop stopping. Claims PRD-03.R1, R3 and R5 (all MUST). Execution, verification and delivery no longer park a build-stage problem on a person — each records what it bent in a departures record and carries on. Execution may amend the plan or the criteria register in place, with a dated marker naming the run. The daemon treats a stray build-stage escalation as its own defect (a retryable failure), not a wait. Non-build stages keep their park-and-wait floor unchanged. It does **not** touch R2 (the PR body's own departures section) or R4 (the screen at the PR) — those are ticket #103's second piece.

## How to try it

### Against the preview

This phase has no preview: it is a command-line tool and a daemon, not a served page. Use the local steps.

### On a local checkout

Setup (Node, install) is in [`README.md`](../../../../README.md).

1. `npm run build` — compiles clean (`tsc --strict`, no diagnostics).
2. `npx vitest run src/daemon` — the daemon suite, 1179 tests, all passing. These cover the new `inBuild` fact, the build-escalation-to-failure path, the failure CTA, and the regression guard that non-build stages still park.
3. To see the behaviour itself (what the live gate did): start `timone daemon` on the scratch-app fixture, mark a ticket whose plan will contradict itself mid-build, and watch `timone status` — the run reaches a pull request with no waiting state and no question on the ticket, and its branch carries a `phase-NN-departures.md` naming what it bent. The full watched account is in [phase-35-live-gate.md](phase-35-live-gate.md).

## Verification outcome

Stage 7 ran twice in the sealed container and could not discharge these criteria there — they need a running machine, which the box does not have. Its verdict table:

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R1 | MUST | live | LIVE-GATE — owed | 0 |
| PRD-03.R3 | MUST | api → live | BLOCKED, then reclassified | 0 |
| PRD-03.R5 | MUST | live | LIVE-GATE — owed | 0 |

The owed live gate then ran on the scratch-app fixture ([phase-35-live-gate.md](phase-35-live-gate.md)) and discharged them. In the register now: **R1 verified** (clause 1 watched four times, clause 3 reworded to the observed stop-and-ask per [#111](https://github.com/fvermaut/timone/issues/111)), **R3 verified**, **R5 verified**. One caveat is recorded in R1's register line, not hidden: clause 2 (a run whose own tests fail still opens a PR saying so) was never triggered — no run's own work failed — so it rests on the phase's unit test plus a partial sighting, and is owed a direct look someday.

### Outstanding for the human

Nothing scripted for a person to run. The one open item above is a note in the register, not a HUMAN-CHECK.

## Standards review — phase 35

- **Read:** `standards/README.md`, `standards/typescript.md`, `standards/code-smells.md`, `standards/testing.md`, `src/daemon/faults.ts` (full), `tsconfig.json`, `package.json`; the full `main...HEAD` diff of the subject files
- **Diff:** `main...HEAD` — 11 subject files, +292/−50
- **Findings:** none

The change adds a build-stage escalation path (ADR-0052): a new `inBuild` fact per pipeline stage, an `isBuildEscalation`/`BUILD_ESCALATION_PREFIX` pair in `faults.ts`, a `failBuildEscalation` sibling to `escalate` in `session.ts`, and a `ctaFor` branch. It conforms to the conventions in play: the string-prefix classification matches the existing `technicalFault` pattern and lives in `faults.ts` so `ctaFor` reads it without importing the agent runtime; `inBuild` is a data-driven boolean on the existing `StageFacts` table, set for every stage, with an exhaustiveness test; the doc comments are why-comments, not what-restating; tests observe exported seams, one behaviour each, with values independent of the code under test. `failBuildEscalation`'s five parameters deliberately mirror the existing `escalate` sibling so the two outcomes read identically at the one call site. `process.md` and the SKILL.md edits are prose in the document's established style. Nothing is a tooling-caught issue restated (the repo runs `tsc --strict` only, no ESLint).

## Spec review — phase 35

- **Read:** `git diff main...HEAD` (full range); `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md`; `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md`; the requirements header of `doc/plans/phases/phase-35.md`
- **Diff:** `main...HEAD` — 19 files, +1134/−58 (subject: the three skills, `process.md`, `src/daemon/{cta,faults,pipeline,session}.ts` plus tests)
- **Findings:** none

The subject implements PRD-03.R1, R3 and R5 faithfully; no missing requirement, no scope creep, no implementation that looks wrong against its criterion.

- **R1**: the three build-stage skills are rewritten so each former stop records a departure and continues (execute's gate 2/gate 3 and two-attempt failure; verify's environment BLOCKED and fix-loop exhaustion; deliver's gate 3 no longer refusing on `failed`/BLOCKED). The daemon backstop (`inBuild` over the STAGES table; `failBuildEscalation`) files a stray build-stage escalation as a retryable `failed` run rather than parking it — the recorded ADR-0052 last-resort guard, not the happy path.
- **R3**: execute's gate 2/gate 3 gain direct authority to amend the phase file or criteria register in place with `✏ <date> (build, timone#<ticket>): …`, preserving the original wording; `process.md` stage 6 restates it; the departures record is additive, not a replacement.
- **R5**: build stages no longer escalate-park; a stray build escalation becomes a fault whose CTA carries `waitingOnYou: false`, no "waiting on you" wording, and `timone retry`. Non-build stages keep the ADR-0033 park-and-wait floor, guarded by regression tests.

Two deliberate, documented scope decisions checked and not flagged: `planning` and `remediation` are excluded from `inBuild` (reasoned in the phase header; remediation's stop-and-ask is the reworded clause 3), and delivery still routes to the human on an owed-but-unrun live gate (the ADR-0051 self-verification mechanism, preserved by ADR-0052).

## Notes

- **Base is `main`, not stacked.** This is the first phase against PRD-03.
- **This branch carries the live-gate work too.** Beyond the original phase-35 build, the branch now also carries the live-gate report, the R3-channel correction, the R1 clause 3 reword, and the register status flips (R1, R3, R5 → verified) — all committed on the branch after the gate ran. They are the evidence the verification report said was owed, and they ride this pull request.
- **Five faults the gate found are filed separately:** [#110](https://github.com/fvermaut/timone/issues/110), [#112](https://github.com/fvermaut/timone/issues/112), [#113](https://github.com/fvermaut/timone/issues/113), a note on [#73](https://github.com/fvermaut/timone/issues/73); the register-vs-behaviour decision was [#111](https://github.com/fvermaut/timone/issues/111), now closed by the reword.
