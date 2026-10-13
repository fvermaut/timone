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

## 2026-10-13 — timone#234, build

**Kind:** check not run
**Agreed:** After 61d, the real replay (`npm run replay`, every case, three tries each, on the model) runs on this branch, and its output goes into `phase-61-replay.md` as run 1 (PRD-05.R18 clause 2).
**Did instead:** It was not run. One case was tried (`npm run replay -- --case 139`): all three tries ended "Not logged in · Please run /login", at $0.00. The dry replay passed 24 of 24.
**Why:** The container this build ran in has no model login. As the plan says, the replay rides to the pull request; fvermaut runs it from his own terminal: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-61.txt`.

## 2026-10-13 — timone#234, verification

**Kind:** check not run
**Agreed:** PRD-05.R18 clause 2: a change to the runner's instructions is proposed with the replay set run on it, and its result on the pull request. Phase 61 changes the runner's rule for an update that failed, so the check runs the replay on this build.
**Did instead:** The replay was not run. PRD-05.R18 is BLOCKED in [phase-61-verification.md](phase-61-verification.md): its clause 1 on the real model and its clause 2. Its parts judged with a stand-in model pass. Its register line is unchanged (`verified`, from phase 60).
**Why:** This container has no model login, and the runner's instructions said not to try to get one and to record the replay as not run, so the pull request lists it. fvermaut runs it from his own terminal: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-61.txt`, and its output goes into `phase-61-replay.md` as run 1.
