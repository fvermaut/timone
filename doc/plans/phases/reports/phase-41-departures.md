# Phase 41 — Departures

> Every departure from the plan or the requirements during phase 41, one dated entry each, never rewritten.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41b deletes the tests 41a left on the current daemon's path, and keeps `successorHeldBack` and `watchForCancellations`.
**Did instead:** 41b first gives those two pieces of kept code a test each on a runner project, as its new cases (9) and (10), then deletes the old-only tests.
**Why:** 41a found that every test of those two pieces runs on the old path. Deleting them as planned would have left code the runner relies on with no test at all.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41b changes only the files it lists.
**Did instead:** 41b also removes the `driver` line from four runner test files and the replay cases, and deletes one old test in `src/daemon/session.test.ts` that drives the cycle with the old spawner.
**Why:** the build does not compile, and that test cannot pass, once the `driver` line is gone. The plan did not know these files set it.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** the manifest refuses to load a runner project that names nobody who may instruct it (phase 40).
**Did instead:** the daemon refuses to start while any project names nobody. The manifest itself no longer checks it.
**Why:** with every project on the runner, the manifest check would refuse every manifest with no `operator`, including the ones `projects list` and `workspace sync` read, which need nobody named. The daemon is where the missing `identity` block is already refused, so a project nobody may instruct is still refused loudly, where it matters.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41c case (5): one cycle over the converted ledger asks for no wake and posts nothing.
**Did instead:** case (5) holds for converted waiting runs, and for converted failed runs whose ticket is closed or not marked. A converted failed run whose ticket is still open and marked is picked up again as new work (new case 8).
**Why:** the plan's Goal Description already says so, and the runner's rules treat a marked ticket with no live run as new work. Case (5) as first written contradicted it. On the real ledger of 2026-09-30 no failed run's ticket is both open and marked.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41c changes `runs.ts` and adds tests; the tests of old states go with their code in later slices.
**Did instead:** 41c also deletes, or re-bases, 39 existing tests that assert what only a failed run or an old wait kind can do, in six test files.
**Why:** the conversion runs on every read, so no reader can see those states any more. The tests could not pass, and the code they covered is deleted by 41d to 41h.

## 2026-09-30 — timone#166, execution

**Kind:** check not run
**Agreed:** 41e's search for `converse` and three other names finds nothing outside the files later slices own.
**Did instead:** the search also leaves out `src/runner/session.ts`.
**Why:** that file has a function of its own called `converse`, which belongs to the runner and has nothing to do with the takeover. The search as written could not pass on correct code.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41f deletes `mergeChunkZero`, `gates.ts` and `gates.test.ts`.
**Did instead:** 41f kept `mergeChunkZero` (and `failedComment`, which only it uses) and trimmed `gates.ts` and its test instead of deleting them. 41h deletes them, together with dead code 41b to 41g left in files no slice owned.
**Why:** files outside 41f's list still import them: a runner test names `mergeChunkZero` in a type check, `pipeline.ts` imports `GateDecision`, and `prompts.ts` imports `clarifyingRounds`. The plan's rule is to keep what something still imports.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41h changes its listed files, and other files only in import lines and type annotations.
**Did instead:** 41h also removes `case "failed"` arms in `takeover.ts` and `cancel.ts`, old wait kinds and the removed `upsertComment` method in the stand-ins of nine test files and the replay's recording, and the expected printed line in one takeover test.
**Why:** those lines name a status, a wait kind and a method that no longer exist, so the build cannot pass with them. The edits change no behaviour.

## 2026-09-30 — timone#166, execution

**Kind:** plan step
**Agreed:** 41h case (2): 41c's tests pass unchanged.
**Did instead:** 41c's tests change only where an expected run carries `failure`, `consumedAnswerAt`, `reAsksAfterAnswer` or `wait.acknowledgedAt`, which are removed and stripped on read.
**Why:** the plan also asks 41h to remove fields nothing writes any more, and those four are such fields. The two instructions could not both hold. What 41c's tests check is unchanged.
