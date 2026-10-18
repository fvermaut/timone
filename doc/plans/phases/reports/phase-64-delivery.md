# Phase 64 — Delivery Report

- **Date:** 2026-10-18
- **Phase:** [phase-64.md](../phase-64.md) — `Complete`, verified in [phase-64-verification.md](phase-64-verification.md)
- **Branch:** `timone/250-the-verified-status-check-reads-was-neve` @ `4fb2129`
- **Base:** `main` — the project's default branch; the branch was cut from it, and its merge base is the tip of `main` (`ba699d2`).
- **Pull request:** opened against this report; its address is on timone#250.
- **Screen:** no user-facing screen in this phase — Timone draws none, and the phase file's `Screens changed` line says none.
- **Questions for the human:** none — the verification report's section of that name says none.
- **Departures:** [`phase-64-departures.md`](phase-64-departures.md) — 3 entries.

## Scope

A bug, [timone#250](https://github.com/fvermaut/timone/issues/250). It claims PRD-02.R15 (SHOULD), clause 5 only ("GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent"), for this one false finding; R15 stays `draft`. The check at the end of a session read the words "was never" in PRD-07.R3's note as a note that a clause was never seen to hold. The words described the old build, before a fix. The check also told every finding to add a `Falsified-by:` line, which does not clear this kind of finding, and R3 already had one. Now "was never" is no longer read as such a note. "Never seen", "never observed", "never triggered", "not observed" and "owed a sighting" still are. Each finding carries its own advice, and a note that says a clause was never seen is no longer asked for a `Falsified-by:` line. The change is in `src/daemon/register.ts` and `src/daemon/hooks.ts`, with tests.

## How to try it

### Against the preview

This project has no preview configured for pull requests. Timone is a command-line program; the steps below run on a local checkout.

### On a local checkout

1. Install and build as the [README](../../../../README.md) says.
2. `npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts` — 96 of 96 pass. This includes `this repository's own registers`, which fails on `main` today because of this bug.
3. `node doc/plans/phases/probes/prd-02.r15.mjs` — after `npm run build`. A session that commits PRD-07's register as it is on this branch gets no finding. Expect `--- PRD-02.R15: PASS`.
4. `node doc/plans/phases/probes/phase-64-requested.mjs` — notes that say "never seen", "never observed" or "never triggered" are still reported, and each finding prints its own advice under it. Expect `--- phase 64 (requested): PASS (2 clause labels, 2 passing)`.
5. `npx vitest run` — the whole suite. On a machine that allows pushes to a test repository's `main`, every test should pass. In the build container, 70 tests failed because it refuses those pushes ([#220](https://github.com/fvermaut/timone/issues/220)); they fail the same way without this change.

## Verification outcome

Quoted from [phase-64-verification.md](phase-64-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R15 (clause 5, the claimed case) | SHOULD | api | PASS | 0 |
| PRD-05.R2 | MUST | api | BLOCKED in part — 3 clause labels PASS, clause 2b BLOCKED | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | BLOCKED in part — 3 clause labels PASS, clause 1 (runner) BLOCKED | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED in part — 3 clause labels PASS, 5 BLOCKED | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |
| PRD-10.R2 | MUST | api | PASS | 0 |
| PRD-10.R3 | MUST | api | PASS | 0 |
| PRD-10.R4 | MUST | api | PASS | 0 |
| PRD-10.R5 | MUST | api | PASS | 0 |
| PRD-10.R6 | MUST | api | PASS | 0 |

No check failed and there is no regression. The BLOCKED parts could not run in the container.

### Outstanding for the human

- [ ] PRD-05.R7 clause 1 (runner) and PRD-05.R18 clauses 1a, 1b, 1c, 2a, 2b — not run: they need the replay against the real model on this build (`npm run --silent replay`, from a terminal with a model login).
- [ ] PRD-05.R2 clause 2b — not run: it needs a GitHub login that can read scratch-app's pull requests. Run `node doc/plans/phases/probes/prd-05.r2.mjs` with one.
- [ ] The 70 tests that fail in the container on its refusal of a push to `main` ([#220](https://github.com/fvermaut/timone/issues/220)) — run `npx vitest run` once on a machine that allows the push. They fail the same way without this change.

## Standards review — phase 64

- **Read:** the diff `origin/main...HEAD -- src/daemon/register.ts src/daemon/register.test.ts src/daemon/hooks.ts src/daemon/hooks.test.ts`; the current content of `src/daemon/register.ts` (lines 60–215), `src/daemon/hooks.ts` (lines 700–750), `src/daemon/hooks.test.ts` (lines 1414–1590) and `src/daemon/register.test.ts` (lines 1–210); `/workspace/timone/standards/code-smells.md`; `tsconfig.json`; the `scripts` section of `package.json`. `doc/standards.md` does not exist in this project. The project has no ESLint or Prettier config. Its only tool checks are `tsc` (strict) and `vitest`.
- **Diff:** `main...timone/250-the-verified-status-check-reads-was-neve` — 4 files, +177/−4
- **Findings:** none

## Spec review — phase 64

- **Read:** `git diff origin/main...HEAD -- src/ doc/specs/prd/`; `src/daemon/register.ts` (lines 1–210); `src/daemon/hooks.ts` (lines 690–760); `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R15 block); `doc/specs/prd/prd-02-inversion-of-control.md` (lines that mention R15); `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (R3 block); `doc/plans/phases/phase-64.md` (top through "Goal Description"). It also ran grep for `was never` across `doc/specs/prd/*.criteria.md`, and ran `npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts`: 96 passed.
- **Diff:** `main...timone/250-the-verified-status-check-reads-was-neve` — 5 files, +178/−4
- **Findings:** none

The diff does what the Goal Description says, and nothing more:
- It removes `/\bwas never\b/i` from `ADMISSIONS`. The other five patterns are unchanged.
- `RegisterFault` gains a `remedy` field, which `registerFaults` fills in for each rule.
- `checkRegisterClaims` now prints each finding's own remedy under it, and the shared line is gone.
- A finding about a note (status-outruns-notes) now advises `draft`, or rewording the note. It does not mention `Falsified-by`.
- A finding about a claim closed by watching (watched-only) keeps its old advice.

PRD-02.R15 clause 5 ("a clean session … stay silent"): the tests use a frozen copy of PRD-07.R3 and check that both `registerFaults` and `checkRegisterClaims` give no finding for it. The tests that must still be able to fail are present: "was never triggered" in the gate line, and an admission in a block that has a `Falsified-by:` line.

The diff adds one line to the criteria register. It is a dated note under PRD-02.R15. The note claims only clause 5, for one case, and keeps R15 at `draft`. That matches the phase's Requirements header.

## Notes

- The runner's instructions for this step said to open the pull request without stopping to ask about the checks that did not run, and to list them on the pull request. They are under *Outstanding for the human* above.
- Known limit, kept on purpose by the plan: a note that says "on the old build, clause 2 was never observed" is still reported.
