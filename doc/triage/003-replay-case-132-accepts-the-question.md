# Triage 003: replay case #132 also accepts the question about a misspelled word

- **Date:** 2026-10-10
- **Kind:** feature
- **Entry point:** timone-prd (stage 3)
- **Source:** issue #244

## Request

> **Two requirements ask for opposite things on one replay case.**
>
> Replay case #132 gives the runner the reply "aproved", spelled wrong. The case passes only if the runner records the approval. Another requirement says the runner must ask whether a misspelled word meant approve. In the real replay of 2026-10-10, the runner asked in all 3 tries, so the case failed.
>
> This is older than the work that found it. The runner was told to ask in this case on 2026-10-05. The real replay had last run on 2026-09-28.
>
> The finding is recorded here: [phase 58 check, carried forward](https://github.com/fvermaut/timone/blob/timone/238-a-long-command-is-not-a-hung-step/doc/plans/phases/reports/phase-58-verification.md#carried-forward).
>
> One of the two must change:
> 1. Case #132 also accepts the question, as case #218 already does.
> 2. The rule to ask is dropped or narrowed.
>
> **What I need from you:** choose 1 or 2. I recommend 1.

fvermaut's answer, in the terminal session of 2026-10-10: "1 for #244".

## Rationale

A feature, not a bug. The runner does what [PRD-04.R1](../specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md) clause 1 asks: it asks one short question about a misspelled approval word. No code breaks a requirement that can be named on its own. What is wrong is that the table of [PRD-05.R18](../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) asks, for case #132, only for "Act on the word", which PRD-04.R1 forbids for a misspelled word. Settling that changes what Timone must pass, the R18 table row, and a change to a requirement is a feature by kind. The choice is made: fvermaut chose option 1 on 2026-10-10, so case #132 also accepts the question, as the second #218 case already does. No question is left open, so the interview is skipped. The requirements step amends the R18 row first; planning, the build and the check of the replay case follow. The real replay must run again before the pull request, because R18 reads `failed` until it does.
