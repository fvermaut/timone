# Phase 66 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-22 — timone#73, execution

**Kind:** plan step
**Agreed:** 66a: "Cases 1–6 must be seen to fail before the change."
**Did instead:** Cases 1–4 and 6 were seen red. Case 5 (one runtime, two starts, two names) passed on the old code; it was proved by a mutation instead: a fixed suffix in the default `nameFor` turned it red, then the mutation was reverted. The phase file is amended at that line.
**Why:** The old counter already gave one runtime a new name at each start. The fault was across daemons, which case 4 covers and which did fail.

## 2026-10-22 — timone#73, execution

**Kind:** plan step
**Agreed:** 66c: the `grep -n "stopOnSignal(" src/commands/daemon.ts` step should give "one line inside the process.once handler".
**Did instead:** The grep gives two lines: `580:export function stopOnSignal(` (the definition the same slice is told to add) and `800:          stopOnSignal(signal, {` (the one call, inside the `process.once` handler). The step was read as "the definition plus one call", and the phase file is amended at that step. The code was not reshaped to make the grep give one line.
**Why:** The plan's own wording for the function's signature makes the definition match the grep; a correct implementation cannot give one line.

## 2026-10-22 — timone#73, execution

**Kind:** plan step
**Agreed:** 66d: "Cases 1–16 must be seen to fail before the change."
**Did instead:** Fourteen cases were seen red against the code before the change. Cases 13 (no `ledger` gives no `--label`) and 15 (a refused second daemon never sweeps) passed there; each was proved by a mutation that turned it red, then reverted. The phase file is amended at that line.
**Why:** Both cases assert that something does not happen, and the old code does neither thing, so no honest red was possible.

## 2026-10-22 — timone#73, execution

**Kind:** check not run
**Agreed:** 66d's last step: `npx vitest run` (the whole suite), expect exit 0.
**Did instead:** It was run once, at the close, and it exits 1: 79 files, 2867 tests, 2797 passed, 70 failed. All 70 fail on the container's refusal of a `git push … main` inside the tests' own temporary repositories (`guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `commands/number.test.ts` 3). These are the same 70 that phase 64's close recorded on the code before this phase.
**Why:** This container refuses every push to `main`, the tests' own pushes included. The whole suite has to be run once on a machine without that refusal.
