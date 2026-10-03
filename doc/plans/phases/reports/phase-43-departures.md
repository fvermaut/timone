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

## 2026-10-03 — timone#85, execution

**Kind:** plan step
**Agreed:** 43d's validation: `grep` for "will see it until that branch merges" in `src/daemon/hooks.ts` code gives no output and exit 1.
**Did instead:** the check now expects exactly one line in code: the finding for a person's own session. The plan is amended with a dated marker. Cases 1 and 5 show that a run never receives that sentence.
**Why:** 43d's own prose and case 5 keep today's sentence for a person's own session, as phase 32 D-2 did, so the grep as written could not pass while case 5 held. The ticket asked for the sentence to stop being the remedy for a run, which is what was built.
