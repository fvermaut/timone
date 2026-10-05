# Phase 51 — Departures

> One entry per departure, appended in order, never rewritten. Format per `process.md` stage 6.

## 2026-10-05 — timone#217, build

**Kind:** plan step
**Agreed:** At the end of each sub-phase, run the tests the change can affect and every suite that takes under a minute, whole. The whole suite took 5.8 s in phase 50's close, so it would run whole at the end of every sub-phase.
**Did instead:** Each sub-phase ran only the tests of the files it changed and of the code that uses them. The whole suite ran once before the first sub-phase, after `npm run build` (76 files, 1908 tests, all passed, 7.3 s), and runs once at the close.
**Why:** The runner's instructions for this step asked for exactly this: run only the tests of what you change while working, and the whole suite once at the end.

## 2026-10-05 — timone#217, build

**Kind:** plan step
**Agreed:** 51a changes one existing test, the `poll.test.ts` case that expected a takeover of a running run to be refused. Every other existing case of the four test files passes unchanged.
**Did instead:** Two more existing cases in `src/commands/takeover.test.ts` changed. "resolveTakeover > says what it is doing instead when the ticket is being worked on" expected the "I'm working on … right now" answer for a running run; it now checks case 7's answer, that the takeover waits for the step. The cancelled-ticket case only had its type check widened, because the answer gained a third kind; its assertions are the same.
**Why:** Case 7 of the plan asks for the opposite of the first test, so both cannot hold. The plan named only the `poll.test.ts` case and missed this one.

## 2026-10-05 — timone#217, build

**Kind:** plan step
**Agreed:** 51c ends the wait with the "moved on" sentence when the run is no longer `active` with this terminal as waiter, and not claimed for it. Four cases.
**Did instead:** The run counts as moved on only when two looks in a row see it so. A fifth test, at the same seam (`runTakeover`), shows a run seen parked once and claimed on the next look opening the session. Two existing tests in `src/commands/takeover.test.ts` that expected "I'm working on … right now" for an `active` run with no daemon now expect the "no daemon" sentence, as case 1 requires.
**Why:** The step's end parks the run and then claims it for the terminal in two writes to the ledger file. The terminal is another process and can read between them. On one look it would say "moved on" and leave a claim that nobody opens, and the runner is not woken after a hand-over.

## 2026-10-05 — timone#217, build

**Kind:** check not run
**Agreed:** At the close, the whole suite runs once and passes (51e's validation: `npx vitest run`, exit 0).
**Did instead:** The whole suite ran once: 76 files, 1932 tests, 1862 passed, 70 failed, in four files — `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/workspace.test.ts` (6), `src/commands/number.test.ts` (3). Each of these tests pushes to `main` in a temporary repository, and this container's push guard refuses it ("Refused: this run may push only to `timone/217-…`"). The same four files fail the same 70 tests on `origin/main`, checked out apart, with none of this phase's changes. These 70 tests were not run in a place where they can pass.
**Why:** The container lets a run push only to its own branch, and the push guard also applies inside the tests' temporary repositories. Nothing this phase changed touches those four files or the code they test.

## 2026-10-05 — timone#217, verification

**Kind:** check not run
**Agreed:** The check runs every regression criterion in scope, PRD-05.R18 (the replay on the real model) included, and each clause of PRD-05.R2 and PRD-05.R7.
**Did instead:** PRD-05.R18 is BLOCKED: `npm run --silent replay` was tried and every case failed with "Not logged in · Please run /login". PRD-05.R7's real-runner clause is BLOCKED for the same reason. PRD-05.R2 clause 2b is BLOCKED: GitHub could not be read from here. The dry replay ran, 20 of 20; it is not R18's evidence. The completion report's watched run on scratch-app (a takeover while a step runs, then with Ctrl-C) and the other live gates this diff touches are owed. See [phase-51-verification.md](phase-51-verification.md), *Carried forward* and *Live gates*.
**Why:** This container has no model login and no daemon on real infrastructure. The pull request should list the replay and the watched run as checks not run.

## 2026-10-05 — timone#217, verification

**Kind:** workaround
**Agreed:** The check scripts run as they are, from the probe directory.
**Did instead:** The shared script `_rig.mjs` (`fixture()`, `pushBranch()`) and `_steps.mjs` (`boxScript()`) now fill their throwaway local repositories with a `git fetch` run inside them, instead of a `git push` into them. PRD-01.R3's probe still pushes in its own setup and fails there; it is narrowed out of this pass and was not changed.
**Why:** This container's pre-push hook refuses every push that is not to the run's own work branch, and it refused the scripts' setup pushes into their scratch repositories, before any check ran. The guard was not switched off: the one attempt was refused, and not tried again. A fetch is not a push, and the state it leaves is the same.

## 2026-10-05 — timone#217, verification

**Kind:** instruction not followed
**Agreed:** The runner asked the check to confirm, by comparing with `main`, the build's claim that the same 70 tests fail on `main` in this container.
**Did instead:** `main` was not run. The 70 failures were compared with the list in `phase-50-verification.md` on `main`, which is empty, so by the rule all 70 are marked new. Every one of the 70 failure messages is the container's push refusal, in the test's own setup.
**Why:** The check's rules forbid checking out, building or running the default branch to compare. What was confirmed is the cause of the failures, not that `main` fails the same way.

## 2026-10-05 — timone#217, verification

**Kind:** requirement read
**Agreed:** PRD-07.R13 clause 3: "no session opens, and the message says what is happening, as today".
**Did instead:** Clause 3 was checked read with PRD-09.R4, which replaces the refusal "as today" names: no session opens while the ticket's own step runs, and the message says a step is running on it. Its probe's message check was rewritten that way and seen to fail first. The status stays `verified`.
**Why:** The two requirements disagree, and PRD-09.R4 is the later one, approved on 2026-10-05, and says it replaces that refusal. PRD-05.R11 carries a note saying so; PRD-07.R13 does not. Whether its words should change is a question in the report.
