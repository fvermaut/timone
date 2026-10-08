# Phase 57 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-08 — timone#230, execution

**Kind:** plan step
**Agreed:** 57a adds `stage` to the test fixtures the compiler rejects, and "no assertion of those tests changes, except" the exact-arguments test of `src/daemon/container-runtime.test.ts`.
**Did instead:** two assertions of `src/daemon/session.test.ts` also changed. "hands the in-process runtime what it received before…" now expects `stage: "execution"` in its `toStrictEqual`, and "leaves the effort key out…" now expects `"stage"` in its list of keys. Both carry a `✏ 57a` marker. The phase file is amended at 57a's fixture line.
**Why:** both tests check the exact shape of a request, and a required `stage` is part of every request now, so neither could pass unchanged. Each still checks what it was written for: no `workspace` key, and no `effort` key.

## 2026-10-08 — timone#230, execution

**Kind:** plan step
**Agreed:** 57b changes phase 56's block in `src/commands/guardrails.test.ts` by its `PLACES` row "in a container" and its `SESSIONS` row "a person", and the checkbox says "by its one marked row only".
**Did instead:** the block's `KINDS` line changed as well, with its own `✏ 57b` marker. It now gives a run in a container its step, and gives a person in a container the answer `deny`. The phase file is amended at 57b's test line.
**Why:** `KINDS` joins each session with each place by spreading both rows, so a value set on one row could not depend on the other without changing it. Nothing else in phase 56's block changed, and the block passes.

## 2026-10-08 — timone#230, verification

**Kind:** check not run
**Agreed:** Every criterion in scope is checked, including the standing regression set.
**Did instead:** PRD-05.R18 was not checked: all 3 of its clauses are BLOCKED. Clause 1 of PRD-05.R7 (the real runner) and clause 2b of PRD-05.R2 (reading GitHub) were not checked either; both criteria still pass on their other clauses. Every other criterion in scope passed.
**Why:** PRD-05.R18 needs a replay of the runner's recorded failures on this build against the real model (`npm run --silent replay`, from a terminal signed in to the model). This phase changed `src/runner/actions.ts`, so the replay matters here. This container has no such sign-in and cannot read GitHub. See [phase-57-verification.md](phase-57-verification.md), *Regression* and *Carried forward*.
