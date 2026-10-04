# Phase 48 — Departures

> One entry per departure from the plan, appended in order, never rewritten. Format per the build stage's departures record.

## 2026-10-04 — timone#200, build

**Kind:** check not run
**Agreed:** each sub-phase's validation block ends with `npm test`, the whole suite.
**Did instead:** each sub-phase ran only the test files its change can affect. The whole suite ran once, at the close of the phase.
**Why:** the runner's instructions for this step asked for exactly that: "While working, run only the tests for what you change; run the whole test suite once at the end."

## 2026-10-04 — timone#200, build

**Kind:** plan step
**Agreed:** 48a case 11: for each of cases 2 to 9, every line either side added is in the merged text.
**Did instead:** in case 3, the older `**Last updated:**` line is not looked for. The phase file carries the amendment at case 11.
**Why:** case 3 keeps only the later `**Last updated:**` line, so the older one cannot also be in the text. The two cases contradicted each other; case 3 is what ADR-0064 D1 decides.
