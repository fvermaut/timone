# Phase 61 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-13 — timone#234, build

**Kind:** plan step
**Agreed:** Sub-phase 61b's file list: `src/update-checks.ts`, `src/commands/update-conflicts.ts`, the CLI, `src/daemon/probeGuard.ts` and its test, `src/update-checks.git.test.ts`.
**Did instead:** The plan was amended to also grant `src/guards/checkouts.test.ts`, and 61b added `commands/update-conflicts.ts` to its `GIT_USERS` list.
**Why:** That test names every source file that runs git. The new command runs git, so without the entry the whole suite fails one test. Phase 50 added `update-checks` to the same list.

## 2026-10-13 — timone#234, build

**Kind:** plan step
**Agreed:** 61b's validation runs `node dist/cli.js update-conflicts timone` and expects exit 2 because no merge is in progress.
**Did instead:** It is run from the Timone root, as `node projects/timone/dist/cli.js update-conflicts timone`.
**Why:** The command finds the project at `projects/<name>` under the folder it runs in, as `update-checks` does. From inside the project it exits 2 for a different reason: the project is not found.

## 2026-10-13 — timone#234, build

**Kind:** check not run
**Agreed:** The build's rule: at the end of each sub-phase, every suite that takes under a minute runs whole. Timone's one suite took 34.3 s at phase 60's close, so 61a and 61b each ran it whole at their end.
**Did instead:** From 61c on, each sub-phase runs only the tests of the files it changes and the tests its own validation names. The whole suite runs once, at the close.
**Why:** The person asked for this during the build on 2026-10-13: the whole suite had been run about five times, and it is slow.
