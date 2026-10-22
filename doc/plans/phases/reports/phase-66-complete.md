# Phase 66 — Completion Report

- **Date:** 2026-10-22
- **Plan:** [phase-66.md](../phase-66.md) — no list of pieces: a bug ([timone#73](https://github.com/fvermaut/timone/issues/73)), classified on the ticket itself (comments of 2026-10-07 and 2026-10-22), and the whole fix is one piece. No triage record was committed for it; the plan says so.
- **Requirements:** PRD-02.R23 (MUST), clause 1, on the words "created for that run and destroyed when it ends" — `draft` in the register, untouched by this phase.
- **Branch:** `timone/73-a-box-could-not-start-because-a-name-fro-chunk-2`
- **Departures:** [`phase-66-departures.md`](phase-66-departures.md) — 4 entries.

## Summary

A box no longer asks docker for a name an earlier box may still hold. Its name is now `timone-<project>-<ticket>-<seq>-<stage>-<8 hex>`, built by `boxName` in `src/daemon/container-runtime.ts` from the run id that `startStepSession` now passes in. Before, the name was `timone-<project>-<n>`, from a counter that started at 1 in every daemon. This is the cause the ticket named, and it is gone.

The end of a box is now waited for. `destroy` resolves when `docker rm -f` has exited, `completed` waits for it, and the services stack goes down after the box has left its network. A stop and the ending after it share one removal. A `docker run` that docker refused because the name was taken (`NAME_TAKEN`) removes nothing, so a collision can no longer kill another run's box. This is the "worse part" of the ticket.

On SIGINT or SIGTERM the daemon now calls `stopOnSignal` (`src/commands/daemon.ts`): it releases the locks, removes every box the runtime still has running with one synchronous `docker rm -f`, logs their names, and exits. When a boxed daemon starts and holds the lock, `sweepLeftoverBoxes` (`src/daemon/leftover-boxes.ts`) lists every container. It removes the boxes labelled `timone.ledger=<its own state file>` (a label every box now carries) and the boxes named the old way for the manifest's projects, and logs their names. Previews, service containers, other ledgers' boxes and new-style unlabelled names are kept. A refused second daemon removes nothing.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 66a — a box is named after its run, with a random part | Landed first attempt. Case 5 could not fail on the old code; proved by a mutation (departure 1). | `5ec98d7` |
| 66b — the end of a box waits for its removal, and a refused start removes nothing | Landed first attempt. Cases 1, 2, 3, 6 seen red; 4 and 5 pass before and after, as planned. | `90ed652` |
| 66c — Ctrl-C removes the boxes that are still running | Landed first attempt. The `stopOnSignal(` grep also matches the definition (departure 2). | `158627c` |
| 66d — each box names its ledger, and a starting daemon removes its own leftovers | Landed first attempt. Cases 13 and 15 could not fail on the old code; proved by mutations (departure 3). Its whole-suite step was run at the close (departure 4). | `9e36576` |

## Tests run

No suite was timed before the first slice: phase 64's close timed the whole suite at 13 s, so it takes under a minute. The runner's instructions for this step asked for only the affected tests per slice and the whole suite once at the end; that was followed.

**Known in this container:** it refuses every `git push … main`, also the pushes the tests make into their own temporary repositories. `npm run build` was run before every test run, because the gh-guard tests read `dist/cli.js`.

- **66a:** `container-runtime.test.ts` and `step-session.test.ts` 119 of 119; `tsc` exit 0; affected files `src/daemon`, `src/commands/daemon.test.ts`, `src/runner` 2106 of 2106.
- **66b:** `container-runtime.test.ts` and `step-session.test.ts` 125 of 125; `tsc` exit 0; the ADR-0047 stop test by name, 1 passed; affected files 2112 of 2112.
- **66c:** the three files 159 of 159; `tsc` exit 0; affected files 2120 of 2120.
- **66d:** the four files 177 of 177; `tsc` exit 0; affected files (43 files) 2138 of 2138.
- **Close:** the whole suite once, after `npm run build`: 79 files, 2867 tests, 2797 passed, 70 failed — all 70 on the push refusal (`guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `commands/number.test.ts` 3), the same 70 as phase 64's close — in 9 s. Then the validation steps of 66a, 66b, 66c and 66d once, in that order (none changes anything outside the repository): every test file named 132, 132, 164 and 177 passed; `tsc` exit 0; the counter grep finds nothing; the ADR-0047 stop test passes; the `stopOnSignal(` grep gives the definition (line 603) and one call inside `process.once` (line 825); no test file names `spawnSync("docker"` or `dockerSpawn`; `options.sweep` (line 466) is inside the `withStateLock(` callback (line 445); `git diff --stat main` lists only the nine planned source and test files and this phase's files under `doc/plans/phases/`. The test files changed only by additions, apart from one import line in `daemon.test.ts` that now also imports `type SessionRuntime`.

## Screen comparison

None — the phase changes no screen.

## Deviations from the plan

Four, each in [`phase-66-departures.md`](phase-66-departures.md), and the first three are amended in place in the phase file with a `✏ 2026-10-22 (build, timone#73)` marker:

1. 66a case 5 could not be seen red; proved by a mutation.
2. 66c's `stopOnSignal(` grep matches the definition as well as the one call.
3. 66d cases 13 and 15 could not be seen red; proved by mutations.
4. 66d's whole-suite step exits 1 here, on the 70 push refusals only.

Everything the plan called for landed.

## Context for the next agent

- Build first (`npm run build`), then `npx vitest run src/daemon/leftover-boxes.test.ts src/daemon/container-runtime.test.ts src/commands/daemon.test.ts src/daemon/step-session.test.ts`. The whole suite fails 70 tests in a container that refuses pushes to `main`; run it once on a machine without that refusal.
- **The live check is owed before merge and was not run** (no docker here). Its five steps are in the phase file's "Live check owed" section. It should also confirm one thing no test can: that `docker ps -a --format '{{.Label "timone.ledger"}}'` prints an empty string for a container with no such label, which `parseListing` relies on.
- Not tested: the action's real wiring of the sweep (`dockerSpawn`, `statePath`, the manifest's projects) is checked by reading and by `tsc` only.
- A failed leftover removal returns `[]` from `sweepLeftoverBoxes`, because which boxes docker did remove is not known; nothing reads the return value today.
- A name leaves the running set only after its removal has finished, so a signal that arrives during a normal removal removes that box again, which `docker rm -f` allows.
