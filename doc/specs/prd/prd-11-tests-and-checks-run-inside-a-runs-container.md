# PRD-11: Tests and checks run inside a run's container

> **Status:** Draft
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-11-tests-and-checks-run-inside-a-runs-container.criteria.md](prd-11-tests-and-checks-run-inside-a-runs-container.criteria.md)
> **Phases:** none yet

## Problem

A run on a ticket works inside a container. The container has a push guard: git's hooks are set, through the environment, to a `pre-push` hook that refuses every push to a branch other than the ticket's own. The guard does not look at which repository a push goes to.

Many of Timone's tests, and several of its older checks, build throwaway git repositories under `/tmp` and push to `main` in them. Inside a run's container the guard refuses those pushes too. On [timone#219](https://github.com/fvermaut/timone/issues/219), on 2026-10-05, 70 tests in 4 files and 7 of the 9 older checks failed before they tested anything ([build report](../../plans/phases/reports/phase-52-complete.md), [check report](../../plans/phases/reports/phase-52-verification.md)). On 2026-10-07 the same 70 tests fail on `main` in a run's container. So on Timone's own tickets, a run cannot run its tests and checks, and reports them as not run.

Source: the conversation on [timone#220](https://github.com/fvermaut/timone/issues/220). The machine's answer of 2026-10-07 settled where the fix goes: in the tests and the older checks, not in the guard. Three newer test files already run git without the run's git settings when they make their throwaway repositories ([`src/daemon/push-guard.git.test.ts`](../../../src/daemon/push-guard.git.test.ts), lines 28–48), so the guard never sees their pushes. Nobody asked for the guard to change.

## Goals

- A run on a Timone ticket can run the whole test suite and the older checks, and get a real answer from each.
- The guard keeps the project's default branch exactly as safe as today ([PRD-05.R3](prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person)).

## Scope

### In scope

The whole test suite passes inside a run's container, and still passes outside one (R1). This holds also for the git commands that Timone's own code runs while a test calls it, such as reserving a number or syncing the workspace, and it is done by how the test sets that code up, not by changing the code (R2). The guard is not changed and is not weakened: a push to the project's real `main` from a run's container is refused as before, and Timone's own code, run for real in a container, is still under the guard (R3).

The 7 older checks that were blocked on #219 run inside a run's container and reach a verdict (R4). Only the step that checks a build may change the older checks; the step that builds may not, as for every other check (R5).

### Out of scope

- Any change to the guard ([`src/daemon/push-guard.ts`](../../../src/daemon/push-guard.ts)) or to the git settings the container sets ([`src/daemon/container-runtime.ts`](../../../src/daemon/container-runtime.ts)).
- Turning the guard off for a whole test run, for example in the command or the npm script that starts the tests.
- A check that stops a future test from being written the old way. If the fault comes back, that is a new ticket.
- The eighth blocked check of #219 (PRD-05.R18, the replay). It needs a logged-in terminal and the real model, not a change here.
- Tests and checks that do not push, or that already pass in a container.

## Open Questions

- None that block writing the pieces. Which 7 older checks are meant is read from the check report of #219: those of PRD-05.R2, R3, R4, R5, R7, R10 and R11.
