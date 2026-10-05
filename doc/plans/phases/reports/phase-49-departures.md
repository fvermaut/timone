# Phase 49 — Departures

> One entry per departure from the plan, appended in order, never rewritten. Format per the build stage's departures record.

## 2026-10-05 — timone#203, build

**Kind:** check not run
**Agreed:** each sub-phase ends by running the tests its change can affect and every suite that takes under a minute, whole. The whole suite takes under a minute (3.8 s before the first slice), so each sub-phase would run it whole.
**Did instead:** each sub-phase runs its own validation steps and the test files its change can affect. The whole suite runs once, at the close of the phase.
**Why:** the runner's instructions for this step ask for exactly that: "While you work, run only the tests of what you change; run the whole test suite once at the end."

## 2026-10-05 — timone#203, build

**Kind:** check not run
**Agreed:** 49d and 49f end with `npm run replay`, PRD-05.R18's replay set, expected to pass.
**Did instead:** `npm run replay` is not counted. Before the first slice it was run: all 19 cases failed with "Not logged in · Please run /login", because this container has no model login. The replay's own test file, `src/runner/replay/harness.test.ts`, and the type check run instead, and the pull request lists the replay set as a check not run.
**Why:** the replay set asks a model for each case. Nothing in this container can log in to one. The operator can run it on their machine.

## 2026-10-05 — timone#203, build

**Kind:** plan step
**Agreed:** 49a changes `src/manifest.test.ts`, `src/daemon/runs.test.ts` and `src/runner/session.test.ts`; case 3 says phase 47's one-place cases open their store with `placesOf: () => 1`.
**Did instead:** the store helpers of `src/commands/status.test.ts`, `src/runner/actions.test.ts`, `src/runner/driver.test.ts` and `src/daemon/poll.test.ts` also open with `placesOf: () => 1`. The phase file grants these files to 49a, with a marked amendment.
**Why:** phase 47's one-place cases are in those four files too. With two places by default, 14 of them failed. Case 3 already decides the change; only the file list left them out.

## 2026-10-05 — timone#203, build

**Kind:** plan step
**Agreed:** 49b changes `src/daemon/steps.ts`, `src/daemon/poll.ts` and their two test files, and no code uses `nextStep` afterwards.
**Did instead:** `src/daemon/chunk-zero.test.ts` also changed: its one case that called `nextStep` now checks that step 11 is among `eligibleSteps`. The phase file grants this file to 49b, with a marked amendment.
**Why:** that test file imported `nextStep`, so the type check failed and the plan's own grep found it. The case still checks what it checked: piece 1's step ticket is free to be taken.

## 2026-10-05 — timone#203, build

**Kind:** plan step
**Agreed:** 49c changes `src/daemon/push-guard.ts`, `src/commands/guardrails.ts` and their tests.
**Did instead:** `src/guards/checkouts.test.ts` also changed: its list of files that run git (`GIT_USERS`) now names `commands/guardrails.ts`, with the reason. The phase file grants this file to 49c, with a marked amendment. The change is its own commit, after 49c's.
**Why:** `guardrails pre-push` now asks git about the branch it pushes. That test fails when a file runs git and is not on its list. 49c's own checks did not run that test; 49d's checks found it.

## 2026-10-05 — timone#203, build

**Kind:** plan step
**Agreed:** 49d adds two kinds of run record entry and changes the files its list names.
**Did instead:** `src/daemon/prompts.ts` also changed: `recordLine` writes no line for the two new kinds, as for `runner-ended`. The phase file grants this file to 49d, with a marked amendment.
**Why:** `recordLine` must cover every kind of entry, and the type check failed without it.

## Verification, 2026-10-05 — checks that could not run here

- **What:** PRD-05.R18 (all three clauses) and the real-runner clause of PRD-05.R7 are BLOCKED: the replay (`npm run --silent replay`) needs a Claude login, which the container that ran the check does not have. PRD-05.R2 clause 2b is BLOCKED: its probe could not read GitHub from there.
- **Why it was not resolved:** nothing was observed, so no fix loop applies. The runner's instructions for this step said not to try them. A person runs the replay from a logged-in terminal on this branch before merging, and commits its record on the branch.
- **Where:** [phase-49-verification.md](phase-49-verification.md), *Carried forward*.

## Verification, 2026-10-05 — a live check owed

- **What:** PRD-07.R5 is on the `live` channel and has never had its watched run. This phase's changes touch what it rests on, so one is owed: on scratch-app, never ivtrends, three test tickets — two whose plans change most of the same files, one that changes none of them — where the planner lets one of the first two and the third build at once and holds the other with a comment naming the ticket it waits for.
- **Why it was not resolved:** only the operator's machine runs the real daemon against real tickets. The runner's instructions for this step said not to try it.
- **Where:** [phase-49-verification.md](phase-49-verification.md), *Live gates*.

## Verification, 2026-10-05 — a fix that goes against ADR-0063 D2

- **What:** fix `074ec45` makes a ticket whose step just ended take no place while its runner decides the next step, as PRD-07.R2 clause 6 says. Its fix context reported that ADR-0063 D2 decides the opposite. The ADR was not changed.
- **Why it was not resolved:** which of the two stands is the person's decision. The check follows the register.
- **Where:** [phase-49-verification.md](phase-49-verification.md), *Questions for the human*, 1.
