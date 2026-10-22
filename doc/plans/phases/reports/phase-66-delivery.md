# Phase 66 — Delivery Report

- **Date:** 2026-10-22
- **Phase:** [phase-66.md](../phase-66.md) — `Complete`, verified in [phase-66-verification.md](phase-66-verification.md)
- **Branch:** `timone/73-a-box-could-not-start-because-a-name-fro-chunk-2` @ `0177f33`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `c5f0fc8`, and `main` has not moved since.
- **Pull request:** opened against this report from the branch above, into `main`. Its address is posted on [timone#73](https://github.com/fvermaut/timone/issues/73).
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none, so the screen gate was skipped.
- **Questions for the human:** none — the verification report's section of that name says none, and the runner's instructions carried no unanswered question.
- **Departures:** [`phase-66-departures.md`](phase-66-departures.md) — 4 entries.

## Scope

Fixes the fault in [timone#73](https://github.com/fvermaut/timone/issues/73): a box (a session's container) could not start because a container from an earlier box still held its name, and a start that docker refused removed the container that held the name. The phase claims [PRD-02.R23](../../../specs/prd/prd-02-inversion-of-control.criteria.md) (MUST), clause 1, on the words "a container created for that run and destroyed when it ends". It builds four things:

1. A box is named after its run — `timone-<project>-<ticket>-<run number>-<step>-<8 hex>` — not after a counter that restarts with each daemon.
2. The end of a box waits until docker has removed it. A start docker refused because the name was taken removes nothing.
3. SIGINT and SIGTERM remove the boxes still running and name them in the log.
4. Each box carries a `timone.ledger` label. A daemon that starts and holds the lock removes the boxes with its own ledger's label, and the old-style names of its own projects, and names them in the log. Previews, service containers and other ledgers' boxes are kept.

R23 stays `draft`: clauses 2 to 6 were not in scope.

## How to try it

### Against the preview

Timone has no preview configured for pull requests (no `bindings.preview` for `timone` in `timone.yaml`), and the change has no screen. Use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md). Then, from the repository root, on this branch:

1. `npm run build && npx vitest run src/daemon/leftover-boxes.test.ts src/daemon/container-runtime.test.ts src/commands/daemon.test.ts src/daemon/step-session.test.ts` — expect 177 of 177 passing.
2. `PROBE_TMP=/tmp/probe-tmp node doc/plans/phases/probes/prd-02.r23.mjs` — runs the built daemon against a stand-in for docker, first on `main`'s build and then on this one. Expect six clause-1 labels, (a) to (f), each `break leg: RED (as required)` then `green leg: PASS`, and a last line `--- PRD-02.R23: PASS`. It takes about 80 seconds and needs no docker.
3. On a machine with real docker, the five steps of the HUMAN-CHECK script in [phase-66-verification.md](phase-66-verification.md#human-check--prd-02r23-clause-1-on-real-docker-owed-before-merge). What you should see, in short:
   - `docker ps --format '{{.Names}}'` while a step runs shows `timone-scratch-app-<ticket>-<run number>-<step>-<8 hex characters>`.
   - After Ctrl-C, the daemon's log names the box it removed, and the name is gone from `docker ps -a`.
   - After `kill -9` of the daemon and a new start, the log of the new daemon names the old box as removed, and every preview container is still there.
   - `docker ps -a --filter name=probe-nolabel --format '[{{.Label "timone.ledger"}}]'` on a container with no label prints `[]`.

## Verification outcome

From [phase-66-verification.md](phase-66-verification.md) — 0 of 2 fix loops consumed. The checks ran against a stand-in for docker, because the checking container has no docker.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R23 (clause 1, claimed) | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (regression) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | PASS (regression) | 0 |
| PRD-06.R5 | MUST | api | PASS (regression, on the named test) | 0 |
| PRD-07.R4 | MUST | api | PASS (regression) | 0 |
| PRD-07.R6 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R2 | MUST | api | PASS (regression) | 0 |
| PRD-09.R4 | MUST | api | PASS (regression) | 0 |
| PRD-09.R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R2 | MUST | api | PASS (regression) | 0 |
| PRD-10.R3 | MUST | api | PASS (regression) | 0 |
| PRD-10.R4 | MUST | api | PASS (regression) | 0 |
| PRD-10.R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R6 | MUST | api | PASS (regression) | 0 |

The whole test suite: 2867 tests, 2797 passed, 70 failed. All 70 fail because the checking container refuses their pushes to `main` inside their own temporary repositories ([#220](https://github.com/fvermaut/timone/issues/220)). The last check on `main` saw the same 70.

### Outstanding for the human

- [ ] PRD-02.R23 — clause 1 on real docker: **NOT RUN, owed before merge.** Run the HUMAN-CHECK script in [phase-66-verification.md](phase-66-verification.md#human-check--prd-02r23-clause-1-on-real-docker-owed-before-merge) § HUMAN-CHECK scripts on a machine with docker. It also confirms one thing no test can: that docker prints an empty label for a container that has none, which the start-up removal relies on.
- [ ] PRD-02.R2 and PRD-02.R8 (and R23 clause 1) — the plan's live check on `scratch-app`: **NOT RUN, owed before merge.** Its five steps are in [phase-66.md § Live check owed](../phase-66.md#live-check-owed-rides-to-the-pull-request). It re-checks that a boxed step runs to its end and that a preview survives a daemon start.
- [ ] The whole test suite on a machine that does not refuse pushes to `main`: `npx vitest run`, expect 0 failures.

## Standards review — phase 66

- **Read:** `git diff main...HEAD -- src/` (`src/commands/daemon.ts`, `src/daemon/container-runtime.ts`, `src/daemon/leftover-boxes.ts`, `src/daemon/session.ts`, `src/daemon/step-session.ts` and the list of their tests); `/workspace/timone/standards/code-smells.md` (Approved 2026-07-28); `/workspace/timone/standards/typescript.md` (Approved 2026-07-19, amended 2026-07-26, so it is normative); `/workspace/timone/projects/timone/tsconfig.json`; the `scripts` in `/workspace/timone/projects/timone/package.json` (only `tsc` and `vitest`, with no lint or format tool); `/workspace/timone/projects/timone/CONTEXT.md` (searched for "box", "container" and "ledger"; none is a glossary term). `/workspace/timone/projects/timone/doc/standards.md` does not exist in this project, so nothing overrides the two shared references.
- **Diff:** `main...HEAD`: 17 files, +2708/−26. The `src/` part is 9 files, +1351/−25.
- **Findings:** 4

### 1. "Remove the container with `docker rm -f`" is written three times in this diff — Duplicated code

- **Where:** `src/daemon/container-runtime.ts:1415–1421`, `src/daemon/container-runtime.ts:1429–1438`, `src/daemon/leftover-boxes.ts:117–127`
- **What:** The same decision appears three times. Once in `destroy`: `await spawn("docker", ["rm", "-f", name]).exit.catch(() => undefined);`. Once in `dockerRemoveNow`: `spawnSync("docker", ["rm", "-f", ...names], { stdio: "ignore", timeout: 20_000 });`. Once in `removeContainers`: `const exit = await spawn("docker", ["rm", "-f", ...ids]).exit;`. Each copy also has its own "never throws" wrapper. Two of them (`destroy` and `removeContainers`) are the same async call through the same `ContainerSpawn` and differ only in whether they report the failure.
- **Why it matters:** code-smells.md, Duplicated code. This is the rule of three, and the reference says a repeated one-liner counts. A change to how a box is removed (for example a flag, a timeout or `--volumes`) has to be made in three places, and the third copy is the one that gets forgotten.
- **Suggested remediation:** Make one async removal in `container-runtime.ts` that takes a list of names or ids and returns its failure. `destroy` would call it and ignore the result, and `sweepLeftoverBoxes` would import it. Keep the sync `spawnSync` copy only for the signal path, and put it next to the async one so the arguments are kept the same. Not applied here.

### 2. Docker's exit code 125 is written inline as a bare number — Magic number

- **Where:** `src/daemon/container-runtime.ts:1345–1346`
- **What:** `const madeNoBox = !read && exit.code === 125 && NAME_TAKEN.test(exit.stderr);`. The stderr pattern next to it got a named, documented constant (`NAME_TAKEN`). The exit code, which has meaning ("docker itself refused the `run`"), did not.
- **Why it matters:** code-smells.md, Magic number or string. A literal with domain meaning sits inline where it is used, and the reader has to know docker's exit codes to understand the check.
- **Suggested remediation:** Add a named constant next to `NAME_TAKEN`, for example `DOCKER_RUN_REFUSED = 125`, with a one-line comment. Not applied here.

### 3. `runArgs` grows to seven positional parameters — Long parameter list

- **Where:** `src/daemon/container-runtime.ts:853–861`, and the call at `1209–1217`
- **What:** The diff adds `ledger: string | undefined` as a seventh positional parameter, after `name, image, script, network: string | undefined, env, interactive`. Two of the parameters are `string | undefined` (`network`, `ledger`) and three are `string`. A swap at the call site would still compile.
- **Why it matters:** code-smells.md, Long parameter list (four or more parameters). The function already had six. This diff makes it longer instead of fixing it.
- **Suggested remediation:** Pass one object with named fields (`runArgs({ name, image, script, network, env, interactive, ledger })`) so each argument is named where it is passed. Not applied here.

### 4. `removeContainers` reports failure as `string | undefined`, unlike the result shape used next to it — Errors and results (typescript.md)

- **Where:** `src/daemon/leftover-boxes.ts:117–127`, and its use at `98–109`
- **What:** `listContainers` in the same file returns `{ ok: true; lines } | { ok: false; reason }`. `removeContainers` returns `Promise<string | undefined>`, where `undefined` means success. So the caller reads `const failure = await removeContainers(...); if (failure !== undefined) ...`.
- **Why it matters:** typescript.md, "Expected failures return, bugs throw": a fallible external call returns `{ ok: true, value } | { ok: false, error }`. With that shape the type checker makes the caller handle both cases. With the `string | undefined` shape, success is the absence of a value, which is easy to read the wrong way round. It is also inconsistent with the function written next to it.
- **Suggested remediation:** Return `{ ok: true } | { ok: false; reason: string }` from `removeContainers`, matching `listContainers`. Not applied here.

## Spec review — phase 66

- **Read:** `git diff main...HEAD -- src/` and the diff to `doc/specs/prd/prd-02-inversion-of-control.criteria.md`; `doc/specs/prd/prd-02-inversion-of-control.md` (the R23 paragraph); `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R23); `doc/plans/phases/phase-66.md` (header, Requirements and Goal Description only); `gh issue view 73 --repo fvermaut/timone` (body). For context I also looked at `src/daemon/runs.ts` (`runId`), `src/daemon/services.ts` (`composeProject`) and where `statePath` is set in `src/commands/daemon.ts`.
- **Diff:** `main...HEAD`: 17 files, +2708/−26
- **Findings:** 1

All four points in the ticket are implemented, and they match R23 clause 1:

- **Box names:** a box is named `timone-<project>-<ticket>-<seq>-<stage>-<8 hex>`.
- **Waited-for removal:** `destroy` now waits for docker before the session counts as ended. The services are taken down only after the box is gone.
- **Refused start:** when docker refuses a start because the name is taken (exit code 125 with docker's "Conflict" message, and no output read), the session's ending removes nothing.
- **Ctrl-C:** the signal handler removes the running boxes synchronously, right after releasing the locks.
- **Start-up removal:** it finds boxes by a ledger label that holds the absolute path of the state file. It never matches on the `timone-` prefix, so previews (`timone-pr-<n>`), service containers (`timone-<project>-<ticket>-<seq>-<service>-<n>`) and a second daemon's boxes cannot match. It runs only under the lock and logs what it removed.

The ticket asks for a removal by the `timone-*` prefix. The diff uses the label instead. This is a deliberate choice recorded in the phase file and is not a defect. The register entry adds a note and does not move the status.

### 1. A stop that arrives before docker refuses a taken name still removes the other box — timone#73 point 3 ("only remove a container this runtime actually started")

- **Where:** `src/daemon/container-runtime.ts:1206` (`live.add(name)` before the spawn), `1379–1382` (`stop: () => { void remove(); }`) and `1062–1066` (`stopAllNow`)
- **What:** The guard against removing someone else's box is on the ending path only: `if (!madeNoBox) await remove();`. But the name goes into the set of running boxes before `docker run` has answered (`live.add(name); const container = spawn("docker", runArgs(...))`). The returned `stop` also removes by name without checking anything (`stop: () => { void remove(); }`). So if a cancel or a Ctrl-C arrives between the spawn and docker's refusal, `docker rm -f <name>` runs against a container this runtime never made. That is the case the ticket's third point is meant to close.
- **Why it matters:** timone#73's third point, which the phase ties to PRD-02.R23 clause 1 ("created for that run and destroyed when it ends"). With a 32-bit random part a name collision is now very unlikely, so this is a small remaining gap and not a live fault. The refused-start fix is still not total.
- **Suggested remediation:** Count a box as started only after it is known to exist, for example on the first line read or after a `docker inspect` of the name. Until then, have `stop` and `stopAllNow` wait for the start's outcome and skip the removal when `madeNoBox` holds. Not applied here.

## Notes

- **One correction to the Spec review's summary, from the completion report and `src/daemon/leftover-boxes.ts:54–66`, not from re-reviewing:** besides labelled boxes, the start-up removal also removes containers with no ledger label whose name is exactly the old form `timone-<project>-<digits>` for a project in `timone.yaml`. That is how the leftovers of daemons before this change get cleaned. It is still not a match on the bare `timone-` prefix, and the verification report saw preview-shaped and service containers kept.
- **Merge order:** none. The base is `main` and no other pull request must merge first.
- **The departures** are four plan steps that could not be followed to the letter (three test cases that could not fail on the old code and were proved by a mutation instead, one grep that also matches a function's definition) and the whole suite's 70 push refusals. They are quoted in full in the pull request.
- **Prerequisites:** `gh` was logged in; GitHub is the project's host.
