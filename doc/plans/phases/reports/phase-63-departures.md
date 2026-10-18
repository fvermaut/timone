# Phase 63 — Departures

> One entry per departure from the plan or the requirements, appended in order and never rewritten. Format per `timone-execute`, *The departures record*.

## 2026-10-18 — timone#209 (worked by hand), execution

**Kind:** plan step
**Agreed:** 63a's last check runs `npx vitest run src/daemon src/runner src/commands/takeover.test.ts` and expects exit 0.
**Did instead:** the check leaves out `src/daemon/register.test.ts` (`--exclude`); with it left out, 41 files and 2115 tests pass, exit 0. The plan's step carries a `✏` marker saying so.
**Why:** that file has one test that fails on `main` before this phase: the register check finds PRD-07 R3 marked verified while its notes say "was never" (timone#250). It reads a register, not a prompt, so with it in the command could only exit 1. It still runs in the whole suite at the close.
