# Phase 60 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 60a — Recording an approval asks for a place, and a refusal leaves the ticket in line

**Built.** `recordApproval` now asks for a place on the project, as `startStep` does. It asks after every other rule (the named person, the branch, the record, the R7 time check, the terminal, a running step, the limit) and before it writes the `approval` entry. When every place is taken, the runner is told the same words as for a refused step ("No place is free on <project>: … This ticket now waits for its turn, and you are woken when a place is given to it."). The run is then in line for a place, with its order (priority label, then the time the ticket was opened). Nothing is written in the record but the refused decision, and no session starts. When another run takes the place between the ask and the start, the action asks once more and gives the same refusal, and the run is in line. Any other failure to start keeps today's words ("The approval is written down, but the step that writes it into the file did not start: …").

In `wakeRunner`, a `record_approval` refused for want of a place now counts as a refusal for want of a place, as a refused `start_step` does. So at the end of the wake the run keeps its turn, and is not taken out of line.

**Files touched.**

- `src/runner/actions.ts` — in `recordApproval`: `turn` is built from the ticket thread that `namedPersonsComment` returned; `deps.store.askPlace(run.id, turn)` is called after `stepBlocked` and before the `approval` entry; a refusal returns `noPlace(place.holder)`. In the `catch` around `deps.startStep`, a `NoPlaceError` asks once more and returns `noPlace(again.holder)` when refused. The comment above the session request now says the session takes a place and asks for one as a step does (ADR-0063 D2, #248). New comments above the ask and in the `catch` say why.
- `src/runner/session.ts` — `watched` in `wakeRunner` wraps `actions.recordApproval` as it wraps `actions.startStep`, and sets `refusedForPlace` on a refusal that starts with `noPlaceRefusal(project)`. The comments on `refusedForPlace` and on `freePlace` name both actions.
- `src/runner/actions.test.ts` — a new describe, "recording an approval asks for a place on the project (ADR-0063 D2, #248)", with cases (1)–(4), on the `placeWorld` ledger, and a constant `PIECES_APPROVED` for the try.
- `src/runner/session.test.ts` — case (5) in "a place on the project after a wake (ADR-0063 D2, D3)". The test's fake forge now answers `findPullRequest` with no pull request (see decision 1).
- `doc/plans/phases/reports/phase-60-handoffs.md` — this file.

**Decisions taken inside the slice.**

1. **The session test's fake forge answers `findPullRequest`.** To record an approval, the run needs a branch. The brief reads the pull request of a run that has a branch, and the fake forge threw on that call, so the wake failed before the runner made any call (first run of case (5): `expected [] to deeply equal [ { content: … } ]`). The forge now says the branch has no pull request. No other case in that file gives a run a branch, so no other case reads it; all 26 old cases stay green.
2. **Case (5) expects the run first in line, before #13.** #12 was opened at 09:00 and #13 at 10:00, so #12 comes first. Before the wake #12 was not in line and #13 was. After the wake the line is #12, #13: #12 is behind no one, as it would be after a refused `start_step` (the existing case just above it expects the same line).
3. **Case (4) does not check the record for an `approval` entry.** The plan puts the ask before the write and the start after it, so in that case the entry is already written when the start is refused. The comment in the `catch` says so. See "What 60b must know" for why this matters.
4. **The wrapper in `watched` is copied, not shared.** The plan says "as `startStep` is", and two copies are allowed by `standards/code-smells.md`. Deferred refactoring, for the delivery review: one helper could serve both wrappers in `watched`; and `startStep` and `recordApproval` now repeat the same four parts (build `turn`, ask, refuse, ask again in the `catch`), which one helper in `actions.ts` could hold.

**Validation evidence.**

Red is shown against the code before this slice: the file was copied aside, the HEAD version was put in its place with `git show HEAD:src/runner/<file>.ts`, the test was run, and the copy was put back. `git diff --stat` after each restore showed the work in place.

*Case (1)* — "refuses to record an approval while another ticket's step runs, naming that run, and writes that the run waits". Red (the words of #248):

```
× … refuses to record an approval while another ticket's step runs, naming that run, and writes that the run waits
- "refused": "No place is free on scratch-app: run scratch-app#7/1 has a step running. This ticket now waits for its turn, and you are woken when a place is given to it.",
+ "refused": "The approval is written down, but the step that writes it into the file did not start: No place is free on scratch-app: run scratch-app#7/1 has a step running.",
Tests  1 failed | 87 skipped (88)
```

Green after the ask was added: `Tests  1 passed | 87 skipped (88)`.

*Case (2)* — "writes no approval and starts no session when it is refused for want of a place". Written after case (1) was green, so it was run against the HEAD `actions.ts`. Red:

```
× … writes no approval and starts no session when it is refused for want of a place
AssertionError: expected [ { kind: 'approval', …(5) } ] to deeply equal []
+   { "at": "2026-09-27T12:00:00.000Z", "by": "fvermaut", "commentAt": "2026-09-27T11:58:40Z",
+     "kind": "approval", "runId": "scratch-app#12/1", "what": "pieces" },
Tests  2 failed | 87 skipped (89)   (cases 1 and 2)
```

Green with the change: `Tests  2 passed | 87 skipped (89)`. The second check, `steps` is empty, was already true at HEAD: `placeWorld`'s ledger refuses the claim before the fake session starts. That half is held by the ledger, not by the action; the red half is the `approval` entry.

*Case (3)* — "records the approval and starts its session when the place is given to this run, and the run takes the place". It passed at HEAD and with the change (`Tests  1 passed | 89 skipped (90)` both times): the ledger already let a run with a given place start. It cannot be driven red honestly. To show it is not empty, a temporary mutation was made: after the ask, refuse when any run holds a place (`placeHolders(project)[0]`), which counts the run's own given place as taken. Result:

```
× … records the approval and starts its session when the place is given to this run, and the run takes the place
-   "ok": true,
-   "said": "Recorded fvermaut's approval of the list of pieces, and started the step that writes it into the file. You are woken when it ends.",
+   "ok": false,
+   "refused": "No place is free on scratch-app: the place is given to run scratch-app#12/1. This ticket now waits for its turn, and you are woken when a place is given to it.",
```

The mutation was removed; `grep -c MUTATION` gave 0 and `diff` against the copy made before it showed no difference.

*Case (4)* — "refuses to record an approval whose place was taken between the ask and the start, in the same words, and writes that the run waits". Red with the ask in place but before the `catch` change:

```
× … refuses to record an approval whose place was taken between the ask and the start, in the same words, and writes that the run waits
- "refused": "No place is free on scratch-app: run scratch-app#7/1 has a step running. This ticket now waits for its turn, and you are woken when a place is given to it.",
+ "refused": "The approval is written down, but the step that writes it into the file did not start: No place is free on scratch-app: run scratch-app#7/1 has a step running.",
Tests  1 failed | 3 passed | 87 skipped (91)
```

Green after the `catch` change: `src/runner/actions.test.ts (91 tests)`, all passed.

*Case (5)* — "leaves a run waiting for its turn, in its place in the line, when its try to record an approval in the wake was refused for want of a place (#248)". Red with both `actions.ts` and `session.ts` at HEAD:

```
× … when its try to record an approval in the wake was refused for want of a place (#248)
-         "text": StringMatching /^Refused: No place is free on scratch-app: run scratch-app#11\/1 has a step running\./,
+         "text": "Refused: The approval is written down, but the step that writes it into the file did not start: no test here starts a step",
```

(The session test's step starter throws its own words, not the ledger's; in the daemon the words after "did not start:" would be the `NoPlaceError`.) Still red with `actions.ts` changed and `session.ts` not — the refusal is right, but the end of the wake takes the run out of line:

```
AssertionError: expected [ 'scratch-app#13/1' ] to deeply equal [ 'scratch-app#12/1', …(1) ]
-   "scratch-app#12/1",
    "scratch-app#13/1",
```

Green after the `watched` change: `Tests  1 passed | 26 skipped (27)`.

*Case (6)* — the existing cases of `recordApproval` (free place, the R7 time rules, the close of the list of pieces, the session's branch and step) stayed green: `src/runner/actions.test.ts (91 tests)` = 87 old + 4 new, all passed. `src/runner/driver.test.ts`, which also records an approval, passed in the whole suite.

The validation block, run from `projects/timone`:

```
$ npx vitest run src/runner/actions.test.ts src/runner/session.test.ts
 ✓ src/runner/actions.test.ts (91 tests) 240ms
 ✓ src/runner/session.test.ts (27 tests) 301ms
 Test Files  2 passed (2)
      Tests  118 passed (118)
exit: 0
$ npx tsc --noEmit
exit: 0
$ npx vitest run src/daemon/runs.test.ts
 ✓ src/daemon/runs.test.ts (161 tests) 240ms
 Test Files  1 passed (1)
      Tests  161 passed (161)
exit: 0
$ npm run --silent build
exit: 0
```

- [x] Cases (1), (2) and (5) failed before the change to `actions.ts` and `session.ts` (red, above), and pass after.
- [x] A refused `recordApproval` leaves no `approval` entry and no session — case (2), for a refusal at the ask. In case (4) the place was given at the ask, so the entry is written before the start is refused, as the plan orders it (see below).
- [x] `npm run build` ends with exit 0.

Tests run at the end:

- `src/runner/actions.test.ts` — 91 passed.
- `src/runner/session.test.ts` — 27 passed.
- `src/daemon/runs.test.ts` — 161 passed.
- Whole suite, `npx vitest run` — 77 files, 2747 tests passed, 41.27 s. Run a second time: 2747 passed, 41.72 s. Phase 59 timed it at 21.1 s; the machine's load average was 52 at the time, and each new case takes a few milliseconds.

**What 60b must know.**

- `src/runner/session.test.ts`'s fake forge now answers `findPullRequest` with no pull request, so a case there can give the run a branch. Case (5) gives #12 the branch `timone/12-a-due-date-on-each-task`.
- `wakeRunner`'s `watched` now wraps three actions: `post`, `startStep` and `recordApproval`.
- An open point for the orchestrator, not for 60b to fix: when another run takes the place between the ask and the start (case (4)), the `approval` entry is already written, and the refusal tells the runner only that the ticket waits for its turn. The plan's decision (1) says an approval written before its session runs lets the brief show it as given while its file still waits for it. This path keeps that for one rare case (the gap is the time to read Timone's version and build the request). I followed the plan's order. Two ways to close it, both changes to the plan's text: write the entry only once the session has started, or say in that refusal that the approval is written down.
