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
