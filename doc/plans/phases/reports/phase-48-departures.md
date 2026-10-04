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

## 2026-10-04 — timone#200, build

**Kind:** plan step
**Agreed:** 48c changes only the last entry of `PUSH_GUARD_LINES` in `src/daemon/container-runtime.test.ts`, and the test "is switched on for every git the session runs".
**Did instead:** `PUSH_GUARD_LINES` also gained the five lines that install the merge rule, before the new export line. No test's body changed for this.
**Why:** the test "builds exactly today's arguments and script" checks the whole script through `PUSH_GUARD_LINES`. The script now holds the install lines the plan asks for, so that list must hold them too.

## 2026-10-04 — timone#200, build

**Kind:** plan step
**Agreed:** 48a creates `src/merge-rules.ts` and `src/merge-rules.test.ts`, and changes nothing else.
**Did instead:** at the close, `src/guards/checkouts.test.ts` gained one entry: `merge-rules.ts` in `GIT_USERS`, with its reason. The phase file grants this file to 48a, with a marked amendment.
**Why:** the whole suite failed once, in "performs git only where somebody said so, and said what on". That test requires every source file that runs git to be listed with its reason. The slices ran only the tests of what they changed, so the failure was found at the close.
