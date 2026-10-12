# Phase 59 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten.

## 2026-10-10 — timone#244, requirements

**Kind:** requirement
**Agreed:** a change to a requirement is written and committed first, and the person approves the committed text.
**Did instead:** fvermaut chose option 1 on #244 ("1 for #244", in the terminal session), before the row was written. The row was then written to say exactly that option, in the words of the second #218 case of the replay, and committed as `dc51c68`. He did not see the committed row before the build.
**Why:** his choice named the change exactly: case #132 also accepts the question, as case #218 already does. He sees the committed row on the pull request, and merging it is his approval.

## 2026-10-11 — timone#244, verification

The check could not finish PRD-05.R18, and one clause of PRD-05.R7, on the final build. It found one fault in replay case #132: a question about something else was counted as asking what "aproved" meant. The fix (`f3e41e8`) changed the replay's code. Both real replay runs (run 1 by the build at `732996f`, run 2 by the check at `40309de`) were made before it. So R18 clauses 1a, 1b, 1c, 2a, 2b and R7 clause 1 (runner) are BLOCKED. The check was allowed one real run and had used it. Owed: run `npm run --silent replay` on the branch at `f3e41e8` or later, from a terminal with a model login (about $2 to $3), record it as run 3 of [phase-59-replay.md](phase-59-replay.md), and check again. Details: [phase-59-verification.md](phase-59-verification.md#carried-forward).

## 2026-10-11 — timone#244, verification, second check

This entry settles the one above; it is not a new departure. Run 3 of the real replay was made on the branch at `430ef7b`, after the fix `f3e41e8`, with fvermaut's lasting token, and recorded in [phase-59-replay.md](phase-59-replay.md) (`0b4cbdb`): 24 of 24 cases, each three tries of three. The second check judged it. PRD-05.R18 passes all 8 of its checks and is now `verified`. PRD-05.R7 clause 1 (runner) passes. Nothing from the entry above is still open. Details: [phase-59-verification.md](phase-59-verification.md#iteration-2--2026-10-11--r18-and-r7-clause-1-on-replay-run-3).
