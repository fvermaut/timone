# Phase 43 — Departures from the plan

> One dated entry per departure, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-03 — timone#85, execution

**Kind:** plan step
**Agreed:** 43b: `agentSdkRuntime` puts the guard directory itself first on the session's `PATH`, and the box's `gh` wrapper runs `guardrails forge-call … -- "$@" || exit 1`.
**Did instead:** the session's checking `gh` is written to `<guard dir>/bin/gh`, and `<guard dir>/bin` goes first on `PATH`. Both wrappers run the check with `< /dev/null`.
**Why:** the guard directory also holds fifteen git hook files such as `pre-commit`, and those names are commands too; on `PATH` they would hide a project's own `pre-commit` tool (a test showed it, red before the move). Without `< /dev/null` the check would read the input that `gh api --input -` sends to the real `gh`.

## 2026-10-03 — timone#85, execution

**Kind:** plan step
**Agreed:** 43c's file list: `container-runtime.ts`, `guardrails.ts`, `hooks.ts` and their tests.
**Did instead:** 43c also changes `src/daemon/run-env.ts` and its test, so a project's run environment file may not set `TIMONE_RUN_BRANCH` or `TIMONE_RUN_PROJECT`. The plan is amended with a dated marker and a case 7.
**Why:** that file's values enter the box's environment before the box's own. At a step with no work branch the box sets no `TIMONE_RUN_BRANCH`, so a line in the file would have chosen the branch the push guard allows, and the run the checks believe they belong to.
