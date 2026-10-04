# Phase 46 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-04 — timone#210, build

**Kind:** check not run
**Agreed:** Each slice's validation block ends with `npm test`, and the whole suite takes under a minute, so it would run whole at the end of every slice.
**Did instead:** Each slice ran the test files of what it changed, the type check and its other checks. The whole suite ran once, at the close of the phase.
**Why:** The runner's instructions for this step say: run only the tests of what you change while you work, and run the whole suite once, at the end.

## 2026-10-04 — timone#210, build

**Kind:** plan step
**Agreed:** 46a's first checkbox: cases 1–9 were red before the change and green after it.
**Did instead:** Cases 1, 2, 3 and 5 were seen red. Cases 4, 6, 7, 8 and 9 were already green when written, because the code for the earlier cases already did what they test. For each one the code was broken on purpose, the test was seen to fail, and the code was put back. The handoff shows each of those failures.
**Why:** Writing wrong code only to see a test fail would be a false red. A test seen to fail against broken code shows it is not empty.

## 2026-10-04 — timone#210, build

**Kind:** plan step
**Agreed:** 46a case 10: keep the existing no-assignee test for `createStep` unchanged, and add one assertion that the argv carries the body it was given, "names included", right after `--body`.
**Did instead:** The test's input was kept as it was. The added assertion checks that the value right after `--body` is exactly the body given, `"does the thing"`, which names nobody.
**Why:** The two instructions cannot both hold: that test's body has no names, and giving it names would change the test. The adapter passes the body through unchanged, so the assertion still shows that names written into the body reach `gh`.

## 2026-10-04 — timone#210, build

**Kind:** plan step
**Agreed:** 46b's first checkbox: cases 1–4 were red before the change and green after it.
**Did instead:** Case 1, and the existing test of the exact body, were seen red. Cases 2 and 3 were green when written, because the one line that made case 1 green already reads the `timone` project. Case 4 checks that nothing is added when nobody is named, which the code already did before the change. For each of the three the code was broken on purpose (reading the run's own project, naming only the operator, always adding the line), the test was seen to fail, and the code was put back. The handoff shows each failure.
**Why:** Writing wrong code only to see a test fail would be a false red. A test seen to fail against broken code shows it is not empty.

## 2026-10-04 — timone#210, build

**Kind:** check not run
**Agreed:** PRD-08.R6: on a live run on scratch-app, fvermaut is notified of a ticket the machine opened and of a later comment on it.
**Did instead:** Not run during the build. It goes to the pull request as an unticked item, and R6 stays `draft`.
**Why:** Only fvermaut can read fvermaut's own GitHub notifications. The runner's instructions for this step say not to try it and to write it down as not run.
