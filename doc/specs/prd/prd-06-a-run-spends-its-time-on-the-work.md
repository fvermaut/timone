# PRD-06: A run spends its time on the work, not on repeats

> **Status:** Draft
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-06-a-run-spends-its-time-on-the-work.criteria.md](prd-06-a-run-spends-its-time-on-the-work.criteria.md)
> **Phases:** none yet

## Problem

A ticket takes too long, and most of the time is not the model.

On 6 September a small build step on scratch-app took 68 minutes ([#110](https://github.com/fvermaut/timone/issues/110)). The model took 21 of them. Shell commands took 42. Of those, 12.5 minutes were spent waiting for a new GitHub token, and about 22 minutes were the whole browser test suite, run at least 8 times.

On ivtrends the check is the largest cost ([#185](https://github.com/fvermaut/timone/issues/185), [ivtrends triage 019](https://github.com/fvermaut/ivtrends/blob/main/doc/triage/019-checking-and-building-take-too-long.md)). About 70 check scripts run twice on every check: once with the thing they test broken on purpose, once on the real build. After each fix, all of them run again. One script alone takes 18 minutes. The decision that made a full re-run after every fix said it "costs almost nothing" ([ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md)). That is no longer true.

These repeats come from Timone's own rules for building and checking, so a project cannot remove them by itself.

Source: the interview of 2026-10-02 in the terminal, on #110 and #185 together. Every decision here was the operator's answer to one question. The decision is recorded in [ADR-0061](../../adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md).

## Goals

- A ticket reaches its pull request sooner, because the build and the check stop repeating work that cannot have changed.
- What is skipped is always visible. A report lists every check script that ran without its break run, and every one not run again after a fix. The operator's review of the pull request stays the final gate.
- A run never waits for a GitHub token.

## Scope

### In scope

**Checking.** A check script does its break run only when it is new or rewritten, or when its result is in doubt. Every other check runs it once, on the real build (R1). After a fix, the check runs again only the scripts that failed and the scripts the fix can affect. It judges that from the names of the files the fix changed, never from their contents. If the fix changed a file many parts of the app rest on, every script runs again (R2). To tell old failures in the project's own tests from new ones, the check compares with the list the last check report wrote down. It never builds the default branch just to compare (R3).

**Building.** While a piece is built part by part, each part runs the tests its change can affect, plus every suite that takes under a minute. When the last part is done, every suite runs whole once, and every part's own checks run once more (R4). This changes one clause of [PRD-01.R16](prd-01-process-layer.criteria.md#r16--tdd-implementation-loop), which said the full suite runs at the end of every part.

**The token.** Every GitHub token the machine gives a box lives longer than the time until the box's next new token (R5). This is a fault, not a choice: today a box can hold a dead token for up to about 15 minutes. It is the first half of [#71](https://github.com/fvermaut/timone/issues/71).

### Out of scope

- **Which model runs each step.** Every step stays on Opus 5.5, as chosen on 23 September. It is measured again after this work lands.
- **The first check of a piece of work.** It still runs every old check script once. Narrowing that set stays as [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) has it.
- **A box asking for a new token itself**, the second half of [#71](https://github.com/fvermaut/timone/issues/71). With R5 a box never needs to.
- **ivtrends' own costs**: its 51 failing browser tests, its test database shared by every test file, its browser tests that wait on each other, and its data load that runs out of memory. ivtrends triage 019 sends those to ivtrends' own plan.

### Risks the operator accepted

- An old check script that has quietly stopped being able to fail is no longer caught by its break run.
- A fault that a fix causes somewhere else can reach the pull request. The report lists what was not run again.
- A part that breaks an earlier part is found only when the last part is done.

## Open Questions

None.
