# Phase 64 — Completion Report

- **Date:** 2026-10-18
- **Plan:** [phase-64.md](../phase-64.md) — no list of pieces: a bug ([timone#250](https://github.com/fvermaut/timone/issues/250)), classified on the ticket itself, and the whole fix is one piece. No triage record was committed for it; the plan says so.
- **Requirements:** PRD-02.R15 (SHOULD), clause 5, for this one false finding only — `draft` in the register, untouched by this phase.
- **Branch:** `timone/250-the-verified-status-check-reads-was-neve`
- **Departures:** [`phase-64-departures.md`](phase-64-departures.md) — 2 entries.

## Summary

The register check at the end of a session no longer reads the two words "was never" as a note that a clause was never seen to hold. PRD-07.R3's note used them about the build before a fix, and the check flagged it. The phrase is gone from `ADMISSIONS` in `src/daemon/register.ts`; "never seen", "never observed", "never triggered", "not observed" and "owed a sighting" still count.

Each finding now carries its own advice (`RegisterFault.remedy`), and `checkRegisterClaims` in `src/daemon/hooks.ts` prints it under the finding. A note that admits a clause was never seen is told to go back to `draft`, or to update the note once the clause has been seen. It is no longer offered a `Falsified-by:` line, which does not clear it. A claim about every case that was only watched keeps the old advice.

The test `this repository's own registers`, which failed on `main` because of this fault, passes again without any change to a register.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 64a — the check stops reading "was never" as an admission, and each finding carries the advice that clears it | landed in one attempt; case 6 was red before the change, not green as the plan expected (departure 1) | `2b1c733` |

## Tests run

No suite was timed before the slice: phase 62's close timed the whole suite at 7.9 s and phase 63's at 22 s, so it takes under a minute and runs whole.

**Known in this container:** it refuses every `git push … main`, also the pushes the tests make into their own temporary repositories. `dist/` was not built at the start; it was built with `npm run build` for the suite.

- **64a:** `src/daemon/register.test.ts` and `src/daemon/hooks.test.ts` 96 of 96; `tsc` exit 0; the whole suite once, after the build, 2759 of 2829, the 70 failures all on the push refusal. Without the change, the same run fails 71: those 70 and `this repository's own registers`.
- **Close:** the whole suite once: 78 files, 2829 tests, 2759 passed, 70 failed — the same 70, all on the push refusal (`guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `commands/number.test.ts` 3) — in 13 s. Then 64a's checks once (none changes anything outside the repository): the two files 96 of 96 (exit 0), `tsc` exit 0, `-t "admission"` 7 passed and 10 skipped (exit 0), `git diff --stat main` lists only the four source and test files and this phase's files under `doc/plans/phases/`.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

- Case 6 (the `watched-only` fault's remedy names `Falsified-by`) failed before the change, because the `remedy` field did not exist yet. The plan expected it to pass. The test was kept as written; the existing test "flags a universal closed by watching alone" is the guard the plan wanted, and it passed before the change.
- The whole suite does not exit 0 in this container, for the reason above. Nothing in this phase causes those failures.
- The frozen copy of PRD-07.R3 is in both test files, because both seams need it. It matches the register on this branch, except for one trailing blank line.

## Context for the next agent

- Run the two files with `npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts`; the whole suite with `npm run build && npx vitest run`.
- The whole suite should be run once on a machine that does not refuse a push to `main`, where it is expected to pass in full.
- Known limit, kept on purpose by the plan: a note that says "on the old build, clause 2 was never observed" is still flagged.
