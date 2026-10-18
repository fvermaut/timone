# Phase 63 — Departures

> One entry per departure from the plan or the requirements, appended in order and never rewritten. Format per `timone-execute`, *The departures record*.

## 2026-10-18 — timone#209 (worked by hand), execution

**Kind:** plan step
**Agreed:** 63a's last check runs `npx vitest run src/daemon src/runner src/commands/takeover.test.ts` and expects exit 0.
**Did instead:** the check leaves out `src/daemon/register.test.ts` (`--exclude`); with it left out, 41 files and 2115 tests pass, exit 0. The plan's step carries a `✏` marker saying so.
**Why:** that file has one test that fails on `main` before this phase: the register check finds PRD-07 R3 marked verified while its notes say "was never" (timone#250). It reads a register, not a prompt, so with it in the command could only exit 1. It still runs in the whole suite at the close.

## 2026-10-18 — verification: two checks that need the real model were not run

- **What:** in the regression set, the runner's part of PRD-05.R7 clause 1 (replay case scratch-app#37) and PRD-05.R18 clause 1 (every replay case, three tries each, with the real model) could not run. Their check scripts report BLOCKED.
- **Why:** the newest recorded replay is run 2 of [phase-60-replay.md](phase-60-replay.md), at `03b5c13`, and that commit is not in this branch's history. A new replay needs a terminal with a model login and costs money. This pass ran its checks against the build and against fakes only.
- **Effect:** the register is unchanged; both stay `verified`. This phase changes no file under `src/runner/`, so the runner's instructions are the same as on `main`.
- **What would clear it:** `npm run --silent replay` on this branch, from a terminal with a model login, and its record committed to the branch. See [phase-63-verification.md](phase-63-verification.md), *Carried forward*.
