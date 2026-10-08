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

## 57b — In a container the guard judges by the container's step, and never asks

**Built.** `containerStep(env)` is new and exported, next to `sessionRun`. It says whether a session runs in a container, and which step the container names. `runGuard` now takes the step in this order: the ledger's run when there is one; else, in a container, the container's step, without reading the declaration; else the declaration, as before. It passes `container: true` to `probeGuardDecision` for every container session, with or without a run. `ProbeGuardInput` has a new optional `container`. In a container, a step that neither builds nor checks, or a missing, empty or unknown step, is refused with one fixed reason instead of asked. The three earlier reasons are unchanged. The push guard is unchanged.

**Files touched.**

- `src/commands/guardrails.ts` — `containerStep` (new, exported, with its comment); `runGuard` reads it, orders ledger, container and declaration, and passes `container`; one new paragraph in `runGuard`'s comment pointing at #87; `GuardDeps.env`'s comment names `containerStep` too. New imports: `z` from `zod`, `PIPELINE_STAGES` and `PipelineStage` from `../daemon/pipeline.js`.
- `src/daemon/probeGuard.ts` — `container?: boolean` on `ProbeGuardInput`; a new branch after the builder and checker branches that refuses in a container; the comment on the last branch says who is still asked.
- `src/commands/guardrails.test.ts` — new block at the end, "the guard in a container knows its step (PRD-10 R2, R3)", cases (1)–(9); one top-level `await import("../daemon/pipeline.js")` just above it for `PIPELINE_STAGES`, as phase 56 loads `PROBE_DIRECTORIES`. Phase 56's block: the marked amendment (see Decisions).
- `src/commands/guardrails.guard-command.test.ts` — new: cases (10) and (11), the built guard command.
- `doc/plans/phases/reports/phase-57-handoffs.md` — this section.

**Decisions taken inside the slice.**

- **Phase 56's block changed in three marked places, not one row.** The excerpt names a `PLACES` row and a `SESSIONS` row. Each kind is built by `KINDS`, which spreads a session and a place together, so the two rows cannot reach each other without a change to `KINDS` too. So: the `SESSIONS` row "a person" gained `readInContainer: "deny"` (its `read: "ask"` stays for the host); the `PLACES` row "in a container" gained `namesStep: true`; `KINDS` applies both, adding `TIMONE_RUN_STAGE: <the run's stage>` to the container's environment for the two run rows and using `readInContainer` in a container. Each of the three has a `✏ 57b: …, PRD-10 R3` comment. Nothing else in the block changed. Before the amendment, the block's two "a person, in a container" cases failed with `- "ask"` / `+ "deny"`, which is the change R3 asks for.
- `containerStep` checks the step with `z.enum(PIPELINE_STAGES).safeParse`, as `declared-stage.ts` checks a declared step, rather than with a hand-written list check (the TypeScript standard: environment values pass through a schema).
- `runGuard` passes `container: container !== undefined`, so a host session passes `false`, not an absent field. `probeGuardDecision` checks `input.container === true`, so both mean a host session.
- The expected reasons in the tests are fixed literals except for the folder names, which are joined from `PROBE_DIRECTORIES` (`PROBE_DIRECTORIES.join(" and ")`), because no test may spell a folder out.
- Case (7)'s split of steps uses two literal lists in the test (`["execution", "remediation"]`, `["verification", "update"]`), not the code's own lists, and iterates `PIPELINE_STAGES` for "every name".
- Red runs "on today's code": most cases went green on arrival because an earlier case's change already covered them. For each, the red run shown below was taken with `src/commands/guardrails.ts` and `src/daemon/probeGuard.ts` put back to `HEAD` (57a's commit) for the run, then restored. For (10) and (11), `npm run build` was run with those two files at `HEAD`, then the command test, then the files were restored and built again.
- What I would refactor (not done): `runGuard`'s nested ternary for the step now has three levels; a small `stepForGuard(run, container, root, sessionId)` would read more plainly. `sessionRun` and `containerStep` both read `TIMONE_RUN_PROJECT` with the same "missing or empty" test; one helper for "a non-empty environment value" would hold it once. In the tests, phase 56's block and this one each build a `freshRoot` and a ledger with a run; a shared helper at file level would remove the duplicate, but that touches phase 56's block.
- Existing tests that pass `process.env` into `runGuard` or `GuardDeps`: none. `grep` finds no `process.env` in `src/commands/guardrails.test.ts`, and no other test calls `runGuard` or the guard command. The one place `process.env` reaches the guard is the built command itself, which is what case (10) and (11) test, with the container's names removed first.

**Validation evidence.**

Case (1): `the guard in a container knows its step (PRD-10 R2, R3) > lets the checking step write a check script and run it`. Written first, red on today's code:

```
 FAIL  src/commands/guardrails.test.ts > the guard in a container knows its step (PRD-10 R2, R3) > lets the checking step write a check script and run it
AssertionError: expected 'ask' to be 'allow' // Object.is equality
 ❯ src/commands/guardrails.test.ts:1352:107
      Tests  1 failed | 82 skipped (83)
```
Green after adding `containerStep` and the step order in `runGuard`: `Tests  1 passed | 82 skipped (83)`.

Case (2): `… > lets the update read a check script`. Green on arrival (the change for (1) covers it). Red on today's code:

```
 FAIL  src/commands/guardrails.test.ts > the guard in a container knows its step (PRD-10 R2, R3) > lets the update read a check script
AssertionError: expected 'ask' to be 'allow' // Object.is equality
 ❯ src/commands/guardrails.test.ts:1357:86
```
Green: `Tests  2 passed | 82 skipped (84)`.

Case (3): `… > refuses a check script to the building step execution` and `… remediation`. Expects the whole reply, with the builder's reason word for word. Red on today's code:

```
 FAIL  … > refuses a check script to the building step execution
 FAIL  … > refuses a check script to the building step remediation
AssertionError: expected { hookEventName: 'PreToolUse', …(2) } to deeply equal { hookEventName: 'PreToolUse', …(2) }
-   "permissionDecision": "deny",
-   "permissionDecisionReason": "Refused: … hold the checks that will be run against what you build. …",
+   "permissionDecision": "ask",
+   "permissionDecisionReason": "This is …, which belongs to the stage that checks the build. …",
 ❯ src/commands/guardrails.test.ts:1369:62
      Tests  2 failed | 84 skipped (86)
```
Green: `Tests  4 passed | 82 skipped (86)`.

Case (4): `… > does not read a declaration in a container: a builder that declared the checking step is still refused`. Red on today's code (today the declaration is read, so the builder is let through):

```
 FAIL  … > does not read a declaration in a container: a builder that declared the checking step is still refused
AssertionError: expected 'allow' to be 'deny' // Object.is equality
 ❯ src/commands/guardrails.test.ts:1380:95
      Tests  1 failed | 86 skipped (87)
```
Green: `Tests  5 passed | 82 skipped (87)`.

Case (5): `… > goes by the ledger when it has a run for the session, whatever the container says`. Green on today's code (`Tests  1 passed | 87 skipped (88)`) and with the change. Mutation: the container's step put before the ledger's run in `runGuard`, for one run:

```
 FAIL  … > goes by the ledger when it has a run for the session, whatever the container says
AssertionError: expected 'allow' to be 'deny' // Object.is equality
 ❯ src/commands/guardrails.test.ts:1390:105
      Tests  1 failed | 87 skipped (88)
```
Reverted: `Tests  1 passed | 87 skipped (88)`.

Case (6): `… > still asks a person with no declaration, and lets one through who declared the checking step`. Green on today's code (`Tests  1 passed | 88 skipped (89)`) and with the change. Mutation: `containerStep` made to call every session a container's, for one run:

```
 FAIL  … > still asks a person with no declaration, and lets one through who declared the checking step
AssertionError: expected 'ask' to be 'allow' // Object.is equality
 ❯ src/commands/guardrails.test.ts:1398:79
      Tests  1 failed | 88 skipped (89)
```
Reverted: `Tests  1 passed | 88 skipped (89)`.

Case (7): `… > never asks about a check script, at $label` (all 13 names in `PIPELINE_STAGES`, plus "no step", "an empty step", "an unknown step": 16 tests) and `… > refuses with the one container reason, at $label` (the 9 steps that neither build nor check, plus the three odd ones: 12 tests). Red with only the change for (1) in place:

```
 FAIL  … > never asks about a check script, at 'triage'
 … (12 in all: the 9 steps that neither build nor check, 'no step', 'an empty step', 'an unknown step')
AssertionError: expected 'ask' not to be 'ask' // Object.is equality
 FAIL  … > refuses with the one container reason, at 'triage'
 … (12 in all)
AssertionError: expected { hookEventName: 'PreToolUse', …(2) } to deeply equal { hookEventName: 'PreToolUse', …(2) }
      Tests  24 failed | 11 passed | 82 skipped (117)
```
On today's code all 28 fail: `Tests  28 failed | 89 skipped (117)`. Green after the container branch in `probeGuardDecision` and `container` passed from `runGuard`: `Tests  35 passed | 82 skipped (117)`.

Case (8): `… > refuses, not asks, a run the ledger has at planning, in a container`. Green on arrival (`container` is passed with or without a run). Red on today's code:

```
 FAIL  … > refuses, not asks, a run the ledger has at planning, in a container
-   "permissionDecision": "deny",
+   "permissionDecision": "ask",
 ❯ src/commands/guardrails.test.ts:1439:81
      Tests  1 failed | 117 skipped (118)
```
Also red with `container` passed only when the ledger has no run (`container: run === undefined && container !== undefined`), the same `- "deny"` / `+ "ask"`; reverted. Green: `Tests  36 passed | 82 skipped (118)`.

Case (9): `… > says nothing about a call that names no folder, at $label` (execution, verification, no step). Green on today's code (`Tests  3 passed | 118 skipped (121)`) and with the change. Mutation: the container refusal let through before the folder check (`!reachesProbeDirectory(…) && input.container !== true`), for one run:

```
 FAIL  … > says nothing about a call that names no folder, at 'execution'
 FAIL  … > says nothing about a call that names no folder, at 'verification'
 FAIL  … > says nothing about a call that names no folder, at 'no step'
AssertionError: expected { hookEventName: 'PreToolUse', …(2) } to be undefined
      Tests  3 failed | 118 skipped (121)
```
Reverted: `Tests  3 passed | 118 skipped (121)`.

Case (10): `the guard command in a container, with an empty ledger (PRD-10 R6) > lets the checking step write a check script` (`src/commands/guardrails.guard-command.test.ts`). Red with today's `runGuard`, built (R6's second clause):

```
== today's runGuard
build: 0
 FAIL  src/commands/guardrails.guard-command.test.ts > the guard command in a container, with an empty ledger (PRD-10 R6) > lets the checking step write a check script
AssertionError: expected 'ask' to be 'allow' // Object.is equality
 ❯ src/commands/guardrails.guard-command.test.ts:68:80
      Tests  1 failed (1)
```
Green after building with the change: `build: 0`, `Tests  1 passed (1)`.

Case (11): `… > refuses a check script to the building step`. Red with today's `runGuard`, built:

```
build: 0
 FAIL  src/commands/guardrails.guard-command.test.ts > the guard command in a container, with an empty ledger (PRD-10 R6) > refuses a check script to the building step
AssertionError: expected 'ask' to be 'deny' // Object.is equality
 ❯ src/commands/guardrails.guard-command.test.ts:72:62
      Tests  1 failed | 1 skipped (2)
```
Green after building with the change: `build: 0`, `Tests  2 passed (2)`.

Validation commands, run from the project root:

```
$ npm run build; echo "exit: $?"
> timone@0.1.0 build
> tsc
exit: 0

$ npx vitest run src/commands/guardrails.test.ts -t "PRD-10" src/commands/guardrails.guard-command.test.ts src/daemon/probeGuard.test.ts src/commands/stage.test.ts; echo "exit: $?"
 ✓ src/daemon/probeGuard.test.ts (679 tests | 19 skipped)
 ✓ src/commands/guardrails.test.ts (121 tests | 52 skipped)
 ✓ src/commands/guardrails.guard-command.test.ts (2 tests)
 Test Files  3 passed | 1 skipped (4)
      Tests  731 passed | 74 skipped (805)
exit: 0
```
`-t "PRD-10"` applies to every file named, so `src/commands/stage.test.ts` (no test names PRD-10) is skipped and `probeGuard.test.ts` runs only its matching tests. Run whole, without the filter:

```
$ npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts src/commands/guardrails.guard-command.test.ts
 Test Files  3 passed (3)
      Tests  684 passed (684)
```

The guard command by hand, in a container's environment with an empty ledger:

```
$ root=$(mktemp -d); P=$(node -e 'import("./dist/daemon/probeGuard.js").then(m=>console.log(m.PROBE_DIRECTORIES[0]))')
$ echo "{\"session_id\":\"s\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$P/x.mjs\"}}" \
  | env -u TIMONE_RUN_BRANCH TIMONE_RUN_PROJECT=timone TIMONE_RUN_STAGE=planning node dist/cli.js guardrails guard --root "$root" --state "$root/state.json"
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Refused: … hold the checks, and only the checking step uses them. This session runs in a container, where nobody can be asked, so the guard refuses rather than asks."}}
```
One line, `permissionDecision` is `"deny"`.

```
$ npx vitest run; echo "exit: $?"
 Test Files  4 failed | 73 passed (77)
      Tests  70 failed | 2650 passed (2720)
   Duration  11.13s
exit: 1
```
Failing tests per file: `src/commands/guardrails.test.ts` 45, `src/numbers.test.ts` 16, `src/workspace.test.ts` 6, `src/commands/number.test.ts` 3: the four files #220 names, 70 failures, as after 57a. The 41 new tests (39 in the new block, 2 in the new file) all pass. I listed the failing test names in `src/commands/guardrails.test.ts` with the changes and on 57a's commit (changes stashed): the same 45 names, and none from either PRD-10 block.

Checkboxes:

- [x] Cases (1)–(11) are above, each with a red run marked as failing on today's code (or, for (5), (6), (9), green on today's code with a mutation shown red), and the green run after.
- [x] The guard command test's red run is shown: with today's `runGuard`, built, case (10) answers `ask` and fails.
- [x] Phase 56's block changed only in its marked amendment (the "a person" row, the "in a container" row, and the `KINDS` line that applies them, each marked `✏ 57b`; see Decisions), and passes.
- [x] The three reasons `probeGuardDecision` gave before are unchanged word for word: `src/daemon/probeGuard.test.ts` passes, 679 tests, with no edit.

Tests run at slice end: `src/commands/guardrails.test.ts` (121 tests; 76 passed, 45 failed, all #220's and the same names as on 57a's commit), `src/commands/guardrails.guard-command.test.ts` (2 passed), `src/daemon/probeGuard.test.ts` (679 passed), `src/commands/stage.test.ts` (3 passed), `src/daemon/declared-stage.test.ts` (5 passed). Whole suite: 77 files, 2720 tests, 2650 passed, 70 failed, all in the four files above.

**What 57c must know.**

- `containerStep(env: NodeJS.ProcessEnv): { step: PipelineStage | undefined } | undefined`, exported from `src/commands/guardrails.ts`. `undefined` means a session on the host: neither `TIMONE_RUN_PROJECT` nor `TIMONE_RUN_STAGE` is set to a non-empty value. Otherwise `{ step }`, where `step` is `TIMONE_RUN_STAGE` when it is one of `PIPELINE_STAGES` and `undefined` when it is missing, empty or unknown.
- `probeGuardDecision({ toolName, toolInput, stage, container: true })` refuses, in a container, any step that is neither `execution`/`remediation` (builder's reason) nor `verification`/`update` (allowed), and refuses when `stage` is `undefined`. The reason is one fixed text: `` `Refused: ${PROBE_DIRECTORIES.join(" and ")} hold the checks, and only the checking step uses them. This session runs in a container, where nobody can be asked, so the guard refuses rather than asks.` `` A call that reaches no check-script folder is still answered `undefined`, in a container or not. `container` absent or `false` keeps the old answers, including `ask`.
- `runGuard` passes `container: true` whenever `containerStep(deps.env)` is defined, even when the ledger has a run. The ledger's run still decides the step when there is one.
- A test that spawns the built guard command must remove `TIMONE_RUN_PROJECT`, `TIMONE_RUN_BRANCH` and `TIMONE_RUN_STAGE` from the copy of `process.env` it hands the child; see `containerEnv` in `src/commands/guardrails.guard-command.test.ts`. A test of `runGuard` must hand it an explicit `env`, never `process.env`: in a container `process.env` carries `TIMONE_RUN_PROJECT`, and the guard would then never ask.

## 57c — `timone stage` says the truth in a container

**Built.** `StageDeps` has a new required `env: NodeJS.ProcessEnv`, and the command's action passes `process.env`. `guardSays` now reads `containerStep(env)` (57b) first. For a container's session it hands off to a new `containerSays`, which names the container's step (or says it names none) and says the declaration changes nothing. For a declared step it then gives the guard's verdict. That verdict comes from `probeGuardDecision` with `container: true` and the container's step. For `none` it says taking a declaration back changes nothing. `runStage` still writes or clears the declaration and still returns 0. On the host every sentence is as before. The comment on `guardSays` no longer says "It assumes a session run by hand". It now says what the sentence does in a container. The description in `registerStageCommand` is unchanged.

**Files touched.**

- `src/commands/stage.ts` — `env` on `StageDeps`; `process.env` in the action; `containerStep` imported from `./guardrails.js`; `guardSays` takes `env` and checks the container before anything else; new `containerSays`; the `guardSays` comment.
- `src/commands/stage.test.ts` — `env: {}` in the three existing calls, with no other change to them; new block "timone stage in a container (#87)" with cases (1)–(4) (five tests, since (4) runs twice through `it.each`).
- `doc/plans/phases/reports/phase-57-handoffs.md` — this section.

**Decisions taken inside the slice.**

- The container check comes before the `none` branch. That way `none` in a container gets the container sentence and not the host's "the guard asks you".
- In a container the guard should never answer `ask`, and should always have an answer about its own folder. `containerSays` treats `ask` and `undefined` as a bug in the guard and throws, as the host code already does for `undefined`. No test reaches that line: no input can.
- Case (4) runs twice: once with the step `execution`, and once in a container that names no step. The excerpt asks for both forms of the first sentence. Both tests were red before the change.
- Case (1) checks the whole sentence word for word, from the excerpt. It also checks the fragments the excerpt names: no "is now", no "checking step". It checks that the declaration is written (`verification`) and that the exit code is 0.
- The new tests use the session id `session-box`, and each one passes its container names in `env`, never `process.env`. The new block is named for #87. The excerpt names no PRD-10 requirement for this slice.
- What I would refactor (not done): `guardSays` and `containerSays` each build the same `probeGuardDecision` call (a `Read` of `x.mjs` in `PROBE_DIRECTORIES[0]`). A small `probeVerdict(stage, container)` would hold it once. The two endings "the guard lets it read and write the probes without asking." and "the guard refuses it the probes." are now written in both functions. `stage.ts` now imports the large `guardrails.ts` only for `containerStep`. `containerStep` could move to a smaller module, next to `sessionRun`'s reading of the environment.

**Validation evidence.**

Case (5), before any change (today's code, today's tests):

```
 ✓ src/commands/stage.test.ts (3 tests) 6ms
      Tests  3 passed (3)
```
With `env: {}` added to the three existing calls, before any change to `stage.ts`: `Tests  3 passed (3)`. After each step below the three stayed green (shown as ✓ in each run), and at the end: `Tests  8 passed (8)`.

Case (1): `timone stage in a container (#87) > names the container's step, not the declared one, and says the guard refuses a builder`. Red:

```
 × timone stage in a container (#87) > names the container's step, not the declared one, and says the guard refuses a builder 5ms
AssertionError: expected 'Session session-box is now the checki…' not to contain 'is now'
Received: "Session session-box is now the checking step: the guard lets it read and write the probes without asking."
 ❯ src/commands/stage.test.ts:119:26
      Tests  1 failed | 3 passed (4)
```
Green after adding `env`, the action's `process.env`, and a container sentence that always ended "the guard refuses it the probes.": `Tests  4 passed (4)`.

Case (2): `… > names the checking step when the container names it, and says the guard lets it through`. Red:

```
 × … > names the checking step when the container names it, and says the guard lets it through
-   "Session session-box runs in a container whose step is verification. In a container the step decides what the guard does, and this declaration changes nothing: the guard lets it read and write the probes without asking.",
+   "Session session-box runs in a container whose step is verification. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.",
 ❯ src/commands/stage.test.ts:140:18
      Tests  1 failed | 4 passed (5)
```
Green after `containerSays` asks `probeGuardDecision` with `container: true` and the container's step: `Tests  5 passed (5)`.

Case (3): `… > says a container that names no step is refused the probes`. Red:

```
 × … > says a container that names no step is refused the probes
-   "Session session-box runs in a container that names no step Timone knows. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.",
+   "Session session-box runs in a container whose step is undefined. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.",
 ❯ src/commands/stage.test.ts:160:18
      Tests  1 failed | 5 passed (6)
```
Green after the "names no step" wording for a missing step: `Tests  6 passed (6)`.

Case (4): `… > says taking a declaration back changes nothing, in a container 'whose step is execution'` and `… 'that names no step'`. Red:

```
 × … > says taking a declaration back changes nothing, in a container 'whose step is execution'
 × … > says taking a declaration back changes nothing, in a container 'that names no step'
-   "Session session-box runs in a container whose step is execution. In a container the step decides what the guard does, and taking a declaration back changes nothing.",
+   "Session session-box no longer declares a step: the guard asks you before it touches the probes.",
 ❯ src/commands/stage.test.ts:198:18
      Tests  2 failed | 6 passed (8)
```
Green after the container check moved before the `none` branch and `containerSays` gained the `none` ending: `Tests  8 passed (8)`.

Validation commands, run from the project root:

```
$ npm run build; echo "exit: $?"
> timone@0.1.0 build
> tsc
exit: 0

$ npx vitest run src/commands/stage.test.ts; echo "exit: $?"
 ✓ src/commands/stage.test.ts (8 tests) 10ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
exit: 0

$ root=$(mktemp -d)
$ env TIMONE_RUN_PROJECT=timone TIMONE_RUN_STAGE=execution node dist/cli.js stage verification --session s --root "$root"; echo "exit: $?"
Session s runs in a container whose step is execution. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.
exit: 0

$ env -u TIMONE_RUN_PROJECT -u TIMONE_RUN_STAGE node dist/cli.js stage verification --session s --root "$root"; echo "exit: $?"
Session s is now the checking step: the guard lets it read and write the probes without asking.
exit: 0
```
After both runs, `$root/.timone/declared-stages.json` holds `"s": { "stage": "verification", … }`: the declaration is written in both cases.

Checkboxes:

- [x] Cases (1)–(4) were each seen red before green; the red runs are above. Case (5) (the three existing tests, with `env: {}`) was green before any change and after each step.
- [x] The two hand runs print the sentences named: the first names "execution", has no "is now", and exits 0. The second prints today's "Session s is now the checking step: …" and exits 0.

Tests run at slice end: `src/commands/stage.test.ts` (8 passed). `src/commands/guardrails.test.ts -t "PRD-10"` and `src/cli.test.ts` were not run. `grep` finds no use of the stage command in either file. The only match is `guardrails.test.ts`'s import of `declared-stage.js`. The whole suite was not run, as asked.

**What 57d must know.**

In a container (when `TIMONE_RUN_PROJECT` or `TIMONE_RUN_STAGE` is set to a non-empty value), `timone stage <step> --session <id>` still writes the declaration and exits 0. It prints one of these sentences:

- The container names `verification` or `update`: `Session <id> runs in a container whose step is <step>. In a container the step decides what the guard does, and this declaration changes nothing: the guard lets it read and write the probes without asking.`
- The container names any other step Timone knows: `Session <id> runs in a container whose step is <step>. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.`
- The container's step is missing, empty or unknown: `Session <id> runs in a container that names no step Timone knows. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.`
- `timone stage none` in a container clears the declaration, exits 0, and prints `Session <id> runs in a container whose step is <step>. In a container the step decides what the guard does, and taking a declaration back changes nothing.` If the container names no step it prints `Session <id> runs in a container that names no step Timone knows. In a container the step decides what the guard does, and taking a declaration back changes nothing.`

The declared step plays no part in any of these sentences. On the host the sentences are unchanged: "is now the checking step: …", "is now the <step> step, which builds code: …", "is now the <step> step, which neither builds nor checks: …", and "no longer declares a step: …". An unknown step is still refused with exit 1, in a container or not.
