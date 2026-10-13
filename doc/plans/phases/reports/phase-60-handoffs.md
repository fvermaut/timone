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

## 60b — The brief says whether this ticket is in line, and that starting the build asks the planner

**Built.** The brief's place line now says whether this ticket is in line for the place. When another run takes the place, or the place is given to another run, the line ends in one of two sentences. A ticket that asked for a place and was refused reads "This ticket waits for its turn." A ticket that is not in line reads "This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line." Which one is decided by the run's own `place.waitingSince` in the ledger at the time the brief is built, and never by what another run holds. This is the case of ivtrends#197 and #201: the place was given to ivtrends#200, the run had never asked, and the brief said it waited. The planner line, when the planner was not asked, now reads "not asked yet. Starting the build asks it." The `given` and `free` lines, and the rule under *How you act*, are unchanged.

**Files touched.**

- `src/runner/brief.ts` — `PlaceFact`'s `taken` and `given-to` kinds have `waiting: boolean`. `placeText` ends both lines with a new helper, `inLineText(waiting)`, which gives one of the two sentences. `plannerText`'s `not-asked` gives the new words. Doc comments on `PlaceFact`, `inLineText` and `plannerText` say why (#249).
- `src/runner/session.ts` — `placeOf` reads the run's place once (`deps.store.get(run.id)?.place`), and sets `waiting` from its `waitingSince` for both `taken` and `given-to`. Its doc comment says the fact is the run's own (D2, #249).
- `src/runner/brief.test.ts` — in "the project's place, as the runner is told it (ADR-0063)": `lineFor` moved up to the describe; the old test now holds only the `given` and `free` lines; three new tests, for cases (1), (2) and (3). In "the planner's decision …": the `not-asked` assertion has the new words (case (4)).
- `src/runner/session.test.ts` — in "a place on the project after a wake (ADR-0063 D2, D3)": case (7) has the new `taken` words; two new tests, for cases (5) and (6).
- `doc/plans/phases/reports/phase-60-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **One helper writes the two sentences for both kinds.** The plan gives the same two sentences to `taken` and `given-to`. They are written once, in `inLineText`, so the two kinds cannot drift apart.
2. **The old "each state of the place" test was split.** It held all four kinds in one test. The `taken` and `given-to` lines now each have two forms, and the plan names them as separate cases, so the test keeps `given` and `free` only (renamed "writes one line under the facts for a place given to this ticket, and for a free place"), and cases (1), (2) and (3) are tests of their own.
3. **Case (6) is driven through two wakes, not by calling `askPlace` in the test.** In the first wake the runner tries `start_step` and the ledger refuses it (#11's step takes the one place). The second wake's brief is checked. This is the real path that puts a run in line, and it also shows that a refused try keeps the run in line from one wake to the next (60a's `refusedForPlace`).
4. **Case (5) gives the place to #13 by freeing it, as the orchestrator suggested.** `threeRuns` puts #13 in line behind #11's step. Parking #11 makes the ledger give the place to #13. #12 has never asked. A guard assertion checks that #13 has `givenAt` before the wake.
5. **`plannerText`'s doc comment names ivtrends#197 and #201 only as the cases where the brief said "not asked yet" and the runner started nothing.** The bug report does not say which of the two lines the runner acted on, so the comment does not claim one.

Deferred refactoring: none.

**Validation evidence.**

The cases were written one at a time, in the order (4), (1), (2), (5), (6), (3), (7). Red output is trimmed.

*Case (4)* — the `not-asked` assertion in "writes one line under the facts for each state of the planner's decision". Red:

```
× the planner's decision, as the runner is told it (ADR-0065 D2) > writes one line under the facts for each state of the planner's decision
Expected: "- The planner: not asked yet. Starting the build asks it."
Received: "- The planner: not asked yet."
Tests  1 failed | 51 skipped (52)
```

Green after `plannerText` changed: `src/runner/brief.test.ts (52 tests)`, all passed.

*Case (1)* — "tells a ticket that is not in line that the place is given to another run, and that a step it tries now is refused and puts it in line (#249)". Red:

```
× … tells a ticket that is not in line that the place is given to another run, and that a step it tries now is refused and puts it in line (#249)
Expected: "- The project's place: given to scratch-app#9/1. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line."
Received: "- The project's place: given to scratch-app#9/1. This ticket waits for its turn."
Tests  1 failed | 52 skipped (53)
```

Green after `given-to` got `waiting` and `inLineText`. At this step `placeOf` still gave `waiting: true` for `given-to`, to keep today's behaviour until case (5) asked for the ledger's fact. Both files: 80 passed; `tsc` exit 0.

*Case (2)* — "tells a ticket that is in line that the place is given to another run, and that it waits for its turn". Its line is the line the brief gave before this slice, so it passed when first run (`1 passed | 53 skipped`). It cannot be driven red honestly. To show it is not empty, `inLineText` was changed for a moment to ignore `waiting` (`return false // MUTATION ? …`). Result:

```
× … tells a ticket that is in line that the place is given to another run, and that it waits for its turn
Expected: "- The project's place: given to scratch-app#9/1. This ticket waits for its turn."
Received: "- The project's place: given to scratch-app#9/1. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line."
```

The file was put back from a copy made before the change; `grep -c MUTATION src/runner/brief.ts` gave 0, and the file's 54 tests passed.

*Case (5)* — "tells a run that never asked for a place that it is not in line, while the project's last place is given to another run (ivtrends#201, #249)", through `wakeRunner`. Red:

```
× a place on the project after a wake (ADR-0063 D2, D3) > tells a run that never asked for a place that it is not in line, while the project's last place is given to another run (ivtrends#201, #249)
Expected: "- The project's place: given to scratch-app#13/1. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line."
Received: "- The project's place: given to scratch-app#13/1. This ticket waits for its turn."
Tests  1 failed | 27 skipped (28)
```

Green after `placeOf` read `waiting` from the run's `place.waitingSince`: both files, 82 passed; `tsc` exit 0.

*Case (6)* — "tells a run whose try to start a step was refused for want of a place that it waits for its turn, on its next wake". Red:

```
× … tells a run whose try to start a step was refused for want of a place that it waits for its turn, on its next wake
Expected: "- The project's place: taken: scratch-app#11/1 has a step running. This ticket waits for its turn."
Received: "- The project's place: taken: scratch-app#11/1 has a step running."
Tests  1 failed | 28 skipped (29)
```

Made green with the smallest change: `taken` got `waiting`, `placeOf` gave it the same value as `given-to`, and `placeText` added the waits sentence only when `waiting` was true. Both files: 83 passed; `tsc` exit 0.

*Case (3)* — "says the same of a place taken by a run whose step runs: that this ticket waits for its turn, or that it is not in line and a step it tries now puts it in line". Its first assertion (waiting) was already true after case (6). Its second assertion was red:

```
× … says the same of a place taken by a run whose step runs: …
Expected: "- The project's place: taken: scratch-app#7/1 has a step running. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line."
Received: "- The project's place: taken: scratch-app#7/1 has a step running."
Tests  1 failed | 54 skipped (55)
```

*Case (7)* — "tells the runner in its brief who takes the project's place, or that it is given to this ticket". In its first wake #12 has never asked for a place, so its first line is now the `taken` line for a ticket that is not in line. The expected value was changed to those words, and the test was run before the code change. Red:

```
× … tells the runner in its brief who takes the project's place, or that it is given to this ticket
-   "- The project's place: taken: scratch-app#11/1 has a step running. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line.",
+   "- The project's place: taken: scratch-app#11/1 has a step running.",
```

Cases (3) and (7) went green when `placeText`'s `taken` line used `inLineText(place.waiting)`: both files, 84 passed; `tsc` exit 0.

*Against the code before this slice.* `brief.ts` and `session.ts` were copied aside, the HEAD versions were put in their place with `git show HEAD:src/runner/<file>.ts`, the two test files were run, and the copies were put back. `git diff --stat` afterwards showed the work in place. Result: `Tests  6 failed | 78 passed (84)`. The six were cases (1), (3), (4), (5), (6) and (7). Case (2) passed, as its line is unchanged.

The validation block, run from `projects/timone`:

```
$ npx vitest run src/runner/brief.test.ts src/runner/session.test.ts
 ✓ src/runner/brief.test.ts (55 tests) 6ms
 ✓ src/runner/session.test.ts (29 tests) 232ms
 Test Files  2 passed (2)
      Tests  84 passed (84)
exit: 0
$ npx tsc --noEmit
exit: 0
$ grep -n "This ticket waits for its turn" src/runner/brief.ts | grep -v '^\s*[0-9]*:\s*//\|^\s*[0-9]*:\s*\*'; echo "exit: $? (0 expected: the sentence is still used, for a waiting ticket)"
463:    ? "This ticket waits for its turn."
exit: 0 (0 expected: the sentence is still used, for a waiting ticket)
$ npm run --silent replay -- --dry
Replaying 24 cases, 3 tries each, with a scripted runner and no model (--dry).
PASS #139 — Read planning as finished, and start the build. 3 of 3 tries.
… (24 lines, every one PASS, 3 of 3 tries)
24 of 24 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
$ npx vitest run
 Test Files  77 passed (77)
      Tests  2752 passed (2752)
   Duration  22.06s
exit: 0
```

- [x] Cases (1), (5) and (4) failed before the change (red, above), and pass after.
- [x] The dry replay passes every case: 24 of 24.
- [x] The whole suite passes: 77 files, 2752 tests.
- [ ] **Human gate:** the real replay on the model. Not run by this slice; left for the orchestrator.

Tests run at the end:

- `src/runner/brief.test.ts` — 55 passed (52 before this slice, plus cases (1), (2) and (3)).
- `src/runner/session.test.ts` — 29 passed (27 before this slice, plus cases (5) and (6)).
- Whole suite, `npx vitest run` — 77 files, 2752 tests passed (2747 at 60a's close, plus 5), 22.06 s. An earlier run in this slice: 2752 passed, 22.77 s.

**What 60c must know.**

- `PlaceFact`'s `taken` and `given-to` kinds now require `waiting`. Any new code that builds a `PlaceFact` must set it. Only `placeOf` in `src/runner/session.ts` builds one today.
- `placeOf` reads `waiting` from the ledger when the brief is built, at the start of a wake. A run that is refused during the wake is in line from the next wake on; this wake's brief still says what was true when it started.
- The sentence "This ticket waits for its turn." is now written in one place only, `inLineText` in `src/runner/brief.ts`. The refusal words in `src/runner/actions.ts` ("This ticket now waits for its turn, …") are separate and were not changed.

## 60c — ADR-0063 says that recording an approval asks for a place, and that the brief says whether a ticket is in line

**Built.** A dated note, `✏ 2026-10-13`, at the end of D2 in ADR-0063, before D3. It is a blockquote in the form other ADRs use for dated notes (ADR-0034, ADR-0041, ADR-0049). It has two paragraphs. The first, for [#248](https://github.com/fvermaut/timone/issues/248): recording an approval asks for a place before the approval is written, as a step does; a try refused for want of a place writes nothing, the ticket waits in line, and its runner is woken when a place is given to it. It names ivtrends#182 and #189, which stood still from 2026-10-09 to 2026-10-13. The second, for [#249](https://github.com/fvermaut/timone/issues/249): since 2026-10-05 a run whose step has just ended does not wait for a place (PRD-07.R2 clause 6), ADR-0063 was not changed then, so the second paragraph of D2 no longer holds as written. That is why the brief's old sentence became false on ivtrends#197 and #201. The note then says what the brief says now: whether the ticket is in line, and that starting the build asks the planner. The note links phase 60, both issues, the four ivtrends issues and PRD-07.R2.

**Files touched.**

- `doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md` — the dated note under D2. Six lines added, none removed.
- `doc/plans/phases/reports/phase-60-handoffs.md` — this section.

**Decisions taken inside the slice.**

1. **The second paragraph of D2 is not struck through.** The note says it no longer holds as written and why. The plan asks for a note only, and nothing else in the ADR changes.
2. **The note names the rare case of 60a's open point.** The plan's words are "a refused try writes nothing". That is true for a try refused at the ask. When another run takes the place between the ask and the start, the approval is already written (60a, case (4)). The note says so in two sentences, so that it does not claim more than the code does.
3. **The ivtrends issues are written `ivtrends#N` and linked.** A bare `#189` in a Timone ADR would read as Timone's own #189, which was a pull request.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based.

```
$ grep -n "#248\|#249" doc/adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md; echo "exit: $? (0 expected)"
41:> **Recording an approval asks for a place, as a step does** ([#248](https://github.com/fvermaut/timone/issues/248)). …
43:> **The second paragraph of D2 no longer holds as written** ([#249](https://github.com/fvermaut/timone/issues/249)). …
exit: 0 (0 expected)
$ git diff --stat main -- doc/adr/
 .../0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md | 6 ++++++
 1 file changed, 6 insertions(+)
$ git diff main -- doc/adr/ | grep -c '^-[^-]'
0
```

- [x] The note is under D2, dated, and names both issues — lines 39 to 43, after D2's last paragraph and before the D3 heading; dated `✏ 2026-10-13`; #248 on line 41, #249 on line 43.
- [x] No other part of the ADR changed, other than this note — six lines added, none removed, one file under `doc/adr/`.

**What delivery must know.**

- The note's two sentences on the rare case follow the order 60a built: ask, write the approval, start the session. If the orchestrator closes 60a's open point by writing the approval only once the session has started, those two sentences must go.
- D2's second paragraph is still in the ADR as written on 2026-10-04. The note marks it as no longer holding. A later change may want to rewrite D2, or record the change of 2026-10-05 in its own ADR; this slice did neither.
