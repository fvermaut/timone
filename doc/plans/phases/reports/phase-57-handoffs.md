# Phase 57 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 57a — A container carries the name of its step

**Built.** Every session request now names its step. `SessionRequest` and `SessionRequestInput` have a required `stage: PipelineStage`, and `sessionRequest` copies it. The runner's step session passes the same `stage` it gives the ledger just after. The session that writes an approval into its file passes `APPROVED_STAGE[what]`. The container runtime puts `TIMONE_RUN_STAGE` in the box's environment, right after `TIMONE_RUN_PROJECT`, forwarded by name. A project's run environment file may not set `TIMONE_RUN_STAGE`: `parseRunEnv` refuses it, and if a value still reaches the runtime, the box's own value wins.

**Files touched.**

- `src/daemon/session.ts` — `stage: PipelineStage` (required, with its comment) on `SessionRequest` and `SessionRequestInput`; `sessionRequest` copies it.
- `src/runner/actions.ts` — `stage` in the step session's `sessionRequest({…})` and in the approval-recording session's.
- `src/daemon/container-runtime.ts` — `TIMONE_RUN_STAGE: request.stage` after `TIMONE_RUN_PROJECT`, with a comment.
- `src/daemon/run-env.ts` — `"TIMONE_RUN_STAGE"` in `RESERVED` after `TIMONE_RUN_PROJECT`; named in the comment on the run's names.
- `src/runner/actions.test.ts` — new block "the step a step's session is given": cases (a), (b), (c).
- `src/daemon/container-runtime.test.ts` — `stage: "execution"` in the `request()` helper and the four other `sessionRequest` fixtures; case (d) in "what the box tells the checks about its run"; case (e) in "cannot be used to take over the box's own identity"; the exact-arguments test gains `"-e", "TIMONE_RUN_STAGE"` and a `✏ 57a` marker line.
- `src/daemon/run-env.test.ts` — case (f).
- `src/daemon/session.test.ts` — `stage: "execution"` in seven fixtures; two assertions changed (see Decisions).
- `src/daemon/step-session.test.ts` — `stage: "execution"` in the shared `request` fixture.
- `src/commands/guardrails.test.ts` — `stage: "execution"` in the one `sessionRequest` call the compiler rejected (line 381). Nothing else in the file changed; the `workspace()` helper is untouched.
- `doc/plans/phases/reports/phase-57-handoffs.md` — this file.

**Decisions taken inside the slice.**

- **Two assertions in `src/daemon/session.test.ts` changed. The plan said they would not.** "hands the in-process runtime what it received before, when no workspace is named" checks the request's exact shape with `toStrictEqual`. "leaves the effort key out, rather than undefined, for a stage that declares none" checks `Object.keys(request)`. A required `stage` must appear in the output, so both failed once their fixtures had a `stage`. I added `stage: "execution"` to the first expected object and `"stage"` to the second key list, each with a `✏ 57a` marker. What these tests check is unchanged: no `workspace` key and no `effort` key.
- In the exact-arguments test, I kept the existing `✏ 43c` comment line as it was and added one new line under it: `// ✏ 57a: and the step the box runs, forwarded by name after the project.` The only other change is the `"-e", "TIMONE_RUN_STAGE"` pair.
- Case (d) builds its request as `{ ...request(), stage: "verification" }`. The `request()` helper's signature stays as it was.
- Case (e) puts `TIMONE_RUN_STAGE: "triage"` in the project environment and expects the box's `"execution"`, the step in the `request()` helper.
- Cases (b) and (e) passed as soon as they were written, because the line that makes each one pass was already in place: (b) shares the line that (a) added, and (e) the line that (d) added. To show each was red, I removed that one line for a moment, ran the test, saw it fail, and put the line back. The red output below is from those runs.
- What I would refactor (not done): the two `stage` lines in `actions.ts` sit next to `workBranch`, and both sessions repeat the same `workspaceFor(...)`, `workBranch` and `stage` group. One helper for "the parts of a request that come from the run" would hold them in one place.

**Validation evidence.**

Case (a): `the step a step's session is given > is verification, for a check started at verification, as the ledger then says` (`src/runner/actions.test.ts`).

```
 FAIL  src/runner/actions.test.ts > the step a step's session is given > is verification, for a check started at verification, as the ledger then says
AssertionError: expected undefined to be 'verification' // Object.is equality
 ❯ src/runner/actions.test.ts:1778:43
      Tests  1 failed | 84 skipped (85)
```
Green after adding the field, `sessionRequest`'s copy and `stage` in the step session: `Tests  1 passed | 84 skipped (85)`.

Case (b): `… > is execution, for a build started at execution, as the ledger then says`. Red, with the step session's `stage` line removed for the run:

```
 FAIL  src/runner/actions.test.ts > the step a step's session is given > is execution, for a build started at execution, as the ledger then says
AssertionError: expected undefined to be 'execution' // Object.is equality
 ❯ src/runner/actions.test.ts:1798:43
      Tests  1 failed | 85 skipped (86)
```
Green with the line back: `Tests  2 passed | 84 skipped (86)`.

Case (c): `… > is requirements, for the session that writes an approval of the requirements into their file`.

```
 FAIL  src/runner/actions.test.ts > the step a step's session is given > is requirements, for the session that writes an approval of the requirements into their file
AssertionError: expected undefined to be 'requirements' // Object.is equality
 ❯ src/runner/actions.test.ts:1821:43
      Tests  1 failed | 2 passed | 84 skipped (87)
```
Green after adding `stage` to the approval session's request: `src/runner/actions.test.ts  Tests  87 passed (87)`.

Case (d): `what the box tells the checks about its run > names the step the box runs, by name (PRD-10.R1, #87)` (`src/daemon/container-runtime.test.ts`).

```
 FAIL  src/daemon/container-runtime.test.ts > what the box tells the checks about its run > names the step the box runs, by name (PRD-10.R1, #87)
AssertionError: expected undefined to be '-e' // Object.is equality
 ❯ src/daemon/container-runtime.test.ts:2238:30
      Tests  1 failed | 107 skipped (108)
```
After adding `TIMONE_RUN_STAGE` to the box's environment, the exact-arguments test failed as expected. It showed exactly the one new pair:

```
 FAIL  … > builds exactly today's arguments and script for a request that is not interactive
    "-e",
    "TIMONE_RUN_PROJECT",
    "-e",
+   "TIMONE_RUN_STAGE",
+   "-e",
    "TIMONE_PROMPT",
```
Green after the pair and its marker line were added to that test: `Tests  108 passed (108)`.

Case (e): `the environment the box gets for the project > cannot be used to take over the box's own identity`. Red, with the box's `TIMONE_RUN_STAGE` line removed for the run:

```
 FAIL  src/daemon/container-runtime.test.ts > the environment the box gets for the project > cannot be used to take over the box's own identity
AssertionError: expected 'triage' to be 'execution' // Object.is equality
 ❯ src/daemon/container-runtime.test.ts:556:40
      Tests  1 failed | 107 skipped (108)
```
Green with the line back: `Tests  108 passed (108)`.

Case (f): `parseRunEnv > refuses TIMONE_RUN_STAGE, the step the checks believe the box runs` (`src/daemon/run-env.test.ts`).

```
 FAIL  src/daemon/run-env.test.ts > parseRunEnv > refuses TIMONE_RUN_STAGE, the step the checks believe the box runs
AssertionError: expected [Function] to throw an error
 ❯ src/daemon/run-env.test.ts:110:70
      Tests  1 failed | 11 passed (12)
```
Green after adding the name to `RESERVED`: `Tests  12 passed (12)`.

Validation commands, run from the project root:

```
$ npm run build; echo "exit: $?"
> timone@0.1.0 build
> tsc
exit: 0

$ npx vitest run src/runner/actions.test.ts src/daemon/container-runtime.test.ts src/daemon/run-env.test.ts src/daemon/session.test.ts src/daemon/step-session.test.ts; echo "exit: $?"
 Test Files  5 passed (5)
      Tests  232 passed (232)
exit: 0

$ grep -n "sessionRequest({" -A3 src/runner/actions.ts | grep -v '^\s*//' ; grep -c "stage" src/runner/actions.ts
942:      const request = sessionRequest({
943-        cwd: deps.root,
944-        prompt: [
945-          stagePrompt(stage, {
--
1151:      const request = sessionRequest({
1152-        cwd: deps.root,
1153-        prompt: approvalRecordPrompt(
1154-          { stage, by: comment.author, at: commentAt },
61
```
There are two `sessionRequest({` calls, and both now pass `stage` (lines 971 and 1162). The count is 61; it was 58 on the base commit. The compiler is what proves that both calls name the step.

```
$ npx vitest run; echo "exit: $?"
 Test Files  4 failed | 72 passed (76)
      Tests  70 failed | 2609 passed (2679)
exit: 1
```
Failing tests per file: `src/commands/guardrails.test.ts` 45, `src/numbers.test.ts` 16, `src/workspace.test.ts` 6, `src/commands/number.test.ts` 3. These are the four files #220 names. I ran `src/commands/guardrails.test.ts` on the base commit (changes stashed) and with the changes. The same 45 test names fail both times.

Checkboxes:

- [x] Cases (a)-(f) were each seen red before green; the handoff shows the red run. (b) and (e) were shown red by removing one line for the run, as Decisions says.
- [x] The exact-arguments test differs from `main` by the one `-e TIMONE_RUN_STAGE` pair and its marker comment, and passes.
- [x] `npm run build` passes, so no caller of `sessionRequest` lacks a step.
- [x] The whole suite fails only in the four files #220 names, with 70 failures. The baseline was 70.

Tests run at slice end: `src/runner/actions.test.ts` (87 passed), `src/daemon/container-runtime.test.ts` (108 passed), `src/daemon/run-env.test.ts` (12 passed), `src/daemon/session.test.ts` (20 passed), `src/daemon/step-session.test.ts` (5 passed; 232 in total over the five files). Whole suite: 76 files, 2679 tests, 2609 passed, 70 failed, all in the four files above.

**What 57b must know.**

- Inside a box, the step is in `process.env.TIMONE_RUN_STAGE`. The value is a `PipelineStage`, spelled as the ledger spells it (for example `verification`, `execution`). The box sets it on every run, whether or not the step has a work branch. A project's run environment file cannot set it.
- The in-process runtime (`agentSdkRuntimeWith`) receives `request.stage` but does nothing with it. Only the container runtime puts it in the environment.
- Test fixtures built with `sessionRequest(...)` now need a `stage`. The `request()` helper in `container-runtime.test.ts` uses `"execution"`, so every boxed test there sees `TIMONE_RUN_STAGE=execution` unless it overrides the stage.
