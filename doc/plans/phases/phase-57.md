# Phase 57: Each container knows its step, and the guard uses it — the container's step, the guard's answer in a container, and what `timone stage` says there

> **Status:** Planned.

> **Companion phases:** [phase 56](phase-56.md) is piece 1 of the same list and is merged on `main` (#232): it taught the guard to judge only real reads and writes, so once this phase lets a container know its step, a builder there is refused only real reads and writes, not every call that names the folders. This phase changes the same functions again — `runGuard` in `src/commands/guardrails.ts`, `probeGuardDecision` in `src/daemon/probeGuard.ts`, `guardSays` in `src/commands/stage.ts` — and one row of phase 56's `runGuard` test table. Phase 55 is reserved by another ticket and touches none of these files as far as its plan shows. Governing decisions: [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — the builder may not read the check scripts and only the checking step writes them; this phase makes that hold in a container. [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — every run is a container cloned from the remotes with an empty `.timone/`, which is why the ledger is empty there and the container must carry its step itself. [ADR-0045](../../adr/0045-a-boxed-runs-project-environment-comes-from-a-file-the-daemon-owns.md) — a project's environment file may not set a name the box sets for itself; the new name joins that list. [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md) — the guard is a hook that must never break a session, so every new path stays inside its existing `try` and never throws. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `src/` and `.claude/skills/` are committed here.

> **Screens changed:** none — the guard answers a hook on stdout and the container's environment is not seen by a person; no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-10-the-probe-guard-knows-the-step-in-a-container.md](../../specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md) — criteria in [prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md](../../specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-10.R1 | MUST | Every container Timone starts for a run carries the name of its step, spelled as the ledger records it, and a project's environment file cannot set that name. |
| PRD-10.R2 | MUST | In a container with no run in the ledger, the guard judges by the container's step: the checking step is allowed, a building step is refused, a declaration cannot beat it, the ledger still wins, and a person's session is unchanged. |
| PRD-10.R3 | MUST | In a container the guard never asks: a step that neither builds nor checks, and a missing, empty or unknown step, is refused with one plain reason. |
| PRD-10.R6 | MUST | A test starts the guard command itself with an empty ledger and a container's environment, and checks a checking step and a building step. |
| PRD-10.R7 | SHOULD | In a container, `timone stage` says that the container's step decides, names it, and does not claim the session is now the checking step. |

**R8** (`live`, SHOULD) is not built here. The list says so: it is checked on the next supervised run after this phase lands. Nothing in this phase can observe it.

In this file, as in the register and in phase 56, **`<probes>`** stands for either folder in `PROBE_DIRECTORIES` (`src/daemon/probeGuard.ts`). Tests build every fixture path from `PROBE_DIRECTORIES`, never by spelling a folder out. Since phase 56 is deployed in Timone's own root, naming the folders in text is no longer refused, but the rule costs nothing and keeps this phase readable by any guard.

## Goal Description

[#87](https://github.com/fvermaut/timone/issues/87) records that inside a container the guard never knows the step: the ledger it reads, `.timone/state.json`, is on the host, and a container's `.timone/` is empty. So the checking step in a container is asked about every check script it writes, with nobody to answer, and a building step is asked rather than refused. This phase is piece 2 of the [list approved on #87](../breakdowns/ticket-87.md). Piece 1 (phase 56) is merged, so the dependency the list names is met.

**The cut follows the data.** 57a makes the container carry its step: the session request names the step, the runner fills it in at both places it starts a session, the box puts it in the environment as `TIMONE_RUN_STAGE` next to `TIMONE_RUN_PROJECT` and `TIMONE_RUN_BRANCH`, and a project's environment file may not set it. That is observable on its own, in the container's built environment. 57b makes the guard read it, never ask in a container, and adds the test of the guard command itself that #87 asks for. 57c makes `timone stage` tell the truth in a container. 57d brings the three skills that say "the ledger already knows its step" up to date. 57b and 57c could be built in either order after 57a; 57c uses the helper 57b adds, so it comes after.

**Choices settled before this phase.** The list's approval settled that a container step which neither builds nor checks is refused the check scripts (R3). The name `TIMONE_RUN_STAGE` is the one R1's verification hint gives; it follows the pattern #85 set for `TIMONE_RUN_PROJECT`, so it is not a new decision.

**Decisions taken here that do not clear the ADR bar.** (1) *A session is a container session when its environment holds a non-empty `TIMONE_RUN_PROJECT` or a non-empty `TIMONE_RUN_STAGE`.* The register defines a container session by the first and a person's session as one holding neither; a session holding only the second fits neither definition, and treating it as a container is the direction that cannot leak a check script (it is refused, never asked). One line in one function, easy to change, surprising to nobody who has the register. (2) *The step travels as a required field of the session request*, not an optional one, so the compiler refuses any new way of starting a session that forgets it (R1's second clause). The in-process runtime ignores the field. (3) *The approval-recording session carries the step whose output it approves* (`requirements` or `breakdown`, the `APPROVED_STAGE` map in `src/runner/actions.ts`), which is the step its prompt already names. Both are steps that neither build nor check, so the guard gives the same answer whatever the ledger's current stage is. See the open question below. (4) *`timone stage` in a container still writes its declaration and still exits 0*; only its sentence changes. The guard ignores the declaration there (R2), so writing it is harmless, and refusing would turn a skill's harmless instruction into a failed command.

**Regression set** (ADR-0051 D4: MUST, `api`, `verified`, narrowed by `Depends-on`). The diff touches `src/daemon/` (`session.ts`, `container-runtime.ts`, `run-env.ts`, `probeGuard.ts`), `src/runner/actions.ts` and `src/commands/` (`guardrails.ts`, `stage.ts`). That brings in [PRD-06.R5](../../specs/prd/prd-06-a-run-spends-its-time-on-the-work.criteria.md) (`container-runtime.ts`), [PRD-07.R1, R2, R4, R6, R9, R10](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) (`src/runner/` or `src/daemon/`) and [PRD-08.R2](../../specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md) (`src/runner/actions.ts`). None of them reads the step or the guard; the whole suite is their gate. **A live gate is owed before delivery** by the letter of D4: [PRD-02.R1, R2, R4, R6 and R8](../../specs/prd/prd-02-inversion-of-control.criteria.md) are `live` and `verified` and name all of `src/daemon/`, and R2 names `src/commands/guardrails.ts`. The phase changes what every container is given, so this is a real cost, not a formality: the next supervised run is that gate, and it is also R8's observation. **What no criterion watches:** that a step started in a container still starts, with every name it had before. The exact-arguments test of `src/daemon/container-runtime.test.ts` ("builds exactly today's arguments and script…") pins that; 57a amends it by exactly one name, and that test is a hard gate.

`doc/standards.md` does not exist in this project; the central `standards/` entries for TypeScript, testing and code smells govern, as for the rest of `src/`. No triage record under `doc/triage/` covers #230; the ticket is a step of the approved list.

### Open questions

These are places where the list or the register and the code do not quite match. None stops the build; each names the choice this plan takes.

- **R1's second clause, "any other way the daemon starts a session today".** The code has two: the step session and the approval-recording session, both in `src/runner/actions.ts`, both through `sessionRequest`. `timone takeover` runs on the person's machine and is out of scope. If the build finds a third caller of `runtime.start`, it carries the step too; the required field makes the compiler find it.
- **"Spelled as the ledger records it" for the approval-recording session.** That session does not call `setStage`, so the ledger's stage is whatever the run last recorded, usually the step whose output is approved. The plan passes `APPROVED_STAGE[what]`. If verification reads the clause as "equal to `run.stage` at that moment", the alternative is `current().stage`; the guard's answer is the same either way.
- **Phase 56's test row "a person, in a container".** Its environment holds `TIMONE_RUN_PROJECT` and no step, which after this phase is a container session with no step, so its expected answer for a real read becomes a refusal (phase 56's report says so). 57b amends that row; it does not delete it.

## Context & Prerequisites

- **Phase 56, merged** — `src/daemon/probeGuard.ts`: `BUILD_STAGES` (18), `CHECKING_STAGES` (28), `ProbeGuardInput` (281: `toolName`, `toolInput`, `stage`), `probeGuardDecision` (302: silent unless `reachesProbeDirectory`, then deny for a builder, allow for a checker, ask otherwise). Its three reasons stay word for word.
- **`src/commands/guardrails.ts`** — `GuardDeps` (139) already carries `env`; `runGuard` (182) takes the stage from the ledger's run, else from `declaredStage`, and never reads `env` for the stage. `sessionRun` (288) reads `TIMONE_RUN_PROJECT` with the ledger winning: the pattern to follow. The `guard` command (around 510-540) passes `process.env`.
- **`src/commands/stage.ts`** — `guardSays` (40) asks `probeGuardDecision` about a `Read` of a check script and turns the answer into one of four sentences. `StageDeps` (79) has no `env`. The action (around 145) is where `process.env` would be passed. Its sentences are pinned by `src/commands/stage.test.ts`.
- **`src/daemon/session.ts`** — `SessionRequest` (93), `SessionRequestInput` (140), `sessionRequest` (169), the one place a request is assembled. Today it carries no step.
- **`src/runner/actions.ts`** — the step session's request is built around 942 and `setStage(run.id, stage)` follows it (983); the approval-recording request is built around 1148 with `stage = APPROVED_STAGE[what]` (321). Tests read the request back as `steps[n].input.request` in `src/runner/actions.test.ts` (see the blocks "the work branch a step's session is given", 1719, and "the session that writes an approval into its file (40v)", 1696).
- **`src/daemon/container-runtime.ts`** — the box's environment is built around 1080-1100; `TIMONE_RUN_PROJECT` is at 1092 and `TIMONE_RUN_BRANCH` just after. Names are forwarded to `docker run` by name with `-e` (847). `src/daemon/container-runtime.test.ts` pins the exact arguments ("builds exactly today's arguments and script…", around 2040) and reads the environment back in "what the box tells the checks about its run" (2212).
- **`src/daemon/run-env.ts`** — `RESERVED` (55) lists the names a project's environment file may not set; `parseRunEnv` (124) refuses them with "sets NAME, which is the box's own". `src/daemon/run-env.test.ts` has one test per reserved name of a run (around 55).
- **`src/commands/guardrails.test.ts`** — its `workspace()` helper makes git repositories and pushes to a throwaway remote, which the push guard refuses inside a container ([#220](https://github.com/fvermaut/timone/issues/220), not merged). New tests must not call `workspace()`: make the root with `mkdtempSync` and open the ledger with `newStore(root)`, as phase 56's block at the end of the file does.
- **Tests that start the built command** — `src/cli.test.ts` and `src/daemon/push-guard.git.test.ts` run `dist/cli.js` with `spawnSync(process.execPath, [CLI, …])`. The build comes before the tests (`npm run build`, then `npx vitest run`).
- **The hook** — `.claude/settings.json` runs `node "$CLAUDE_PROJECT_DIR/dist/cli.js" guardrails guard --root "$CLAUDE_PROJECT_DIR"`. The hook inherits the session's environment, which is how `TIMONE_RUN_PROJECT` already reaches the guard in a container (#85); `TIMONE_RUN_STAGE` reaches it the same way.
- **The test environment of the build itself** — once this phase is deployed, a run's container holds `TIMONE_RUN_PROJECT` and `TIMONE_RUN_STAGE`. Every test that starts the built command must build its child's environment from `process.env` **with both names removed** and then set the ones it means, or it will judge the build's own step instead of the one it set.

## Sub-phases

### Sub-phase 57a: A container carries the name of its step

**[MODIFY]** `src/daemon/session.ts` — add `stage: PipelineStage` (required) to `SessionRequest` and to `SessionRequestInput`, with a comment: the step this session runs, spelled as the ledger records it, given to a container so its checks know the step when its own ledger is empty (PRD-10.R1, #87). `sessionRequest` copies it.
**[MODIFY]** `src/runner/actions.ts` — the step session's `sessionRequest({…})` gets `stage` (the same `stage` passed to `setStage` just after). The approval-recording session's gets `stage` (`APPROVED_STAGE[what]`, already in scope as `stage`).
**[MODIFY]** `src/daemon/container-runtime.ts` — the box's environment gets `TIMONE_RUN_STAGE: request.stage`, placed right after `TIMONE_RUN_PROJECT`, with a comment in the style of its neighbours: which step the box runs, for the guard inside it, whose ledger is empty (PRD-10.R1).
**[MODIFY]** `src/daemon/run-env.ts` — add `"TIMONE_RUN_STAGE"` to `RESERVED`, next to `TIMONE_RUN_PROJECT`, and name it in the comment that explains the run's names (49).
**[MODIFY]** every test fixture the compiler then rejects for lacking `stage` — `src/daemon/session.test.ts`, `src/daemon/step-session.test.ts`, `src/daemon/container-runtime.test.ts` (its `request()` helper), `src/commands/guardrails.test.ts` — gets a `stage` it does not otherwise care about (`"execution"` is fine). No assertion of those tests changes, except the one named below. ✏ 2026-10-08 (build, timone#230): two assertions of `src/daemon/session.test.ts` change too — "hands the in-process runtime what it received before…" (`toStrictEqual`) and "leaves the effort key out…" (`Object.keys`) check the request's exact shape, so a required `stage` must appear in what they expect. Each gains `stage` and a `✏ 57a` marker, and still checks what it was written for: no `workspace` key, no `effort` key.
**[MODIFY]** `src/daemon/container-runtime.test.ts` — the exact-arguments test gains exactly `"-e", "TIMONE_RUN_STAGE"` after `"-e", "TIMONE_RUN_PROJECT"`, with a marker comment in the style of the ones already there (`✏ 57a: …`). Nothing else in that test changes.

**Seams under test (TDD):** three public seams, each the boundary where the requirement is observed. `sessionRequest` is not one of them: it only copies a field, and the runner's test reads the result. (1) **The runner's `startStep` action** (`src/runner/actions.test.ts`), observed through the `steps[n].input.request` the fake `startStep` records, as the work-branch block does. Red-green: (a) a step started at stage `verification` carries `request.stage === "verification"`, and the ledger's stage for the run is that same string after the start; (b) the same for `execution`; (c) the approval-recording session for the requirements carries `request.stage === "requirements"`. (2) **`containerRuntime(…).start(request)`** with the fake `spawn` (`src/daemon/container-runtime.test.ts`, block "what the box tells the checks about its run"). Red-green: (d) a request with `stage: "verification"` gives a `docker run` whose `env.TIMONE_RUN_STAGE` is `"verification"`, forwarded by name (`-e TIMONE_RUN_STAGE` in the arguments, `TIMONE_RUN_STAGE=` nowhere in them); (e) a project environment that sets `TIMONE_RUN_STAGE` cannot win over the box's own value: add the name to the test "cannot be used to take over the box's own identity" (around 539), whose `boxed(…)` helper feeds the `runEnv` option, and assert the box's value stands. (3) **`parseRunEnv`** (`src/daemon/run-env.test.ts`). Red-green: (f) a body `TIMONE_RUN_STAGE=verification\n` throws `<path>:1 sets TIMONE_RUN_STAGE, which is the box's own`.

> No dependency on other sub-phases.

The step is a `PipelineStage` value, so it is always one of `PIPELINE_STAGES`, the spelling the ledger uses. Do not add a separate list of names.

#### Agent Validation Steps

```bash
cd projects/timone   # or the project's root in a run's container
npm run build; echo "exit: $?"        # expect 0: the required field compiles everywhere
npx vitest run src/runner/actions.test.ts src/daemon/container-runtime.test.ts src/daemon/run-env.test.ts src/daemon/session.test.ts src/daemon/step-session.test.ts; echo "exit: $?"   # expect 0
# Every place a request is assembled names the step: the compiler proves it, and this shows it.
grep -n "sessionRequest({" -A3 src/runner/actions.ts | grep -v '^\s*//' ; grep -c "stage" src/runner/actions.ts
npx vitest run; echo "exit: $?"       # whole suite: the only failures are the ones #220 names, the same set as on main in the same place
```

- [ ] Cases (a)-(f) were each seen red before green; the handoff shows the red run.
- [ ] The exact-arguments test differs from `main` by the one `-e TIMONE_RUN_STAGE` pair and its marker comment, and passes.
- [ ] `npm run build` passes, so no caller of `sessionRequest` lacks a step.
- [ ] The whole suite fails nowhere but in the files #220 names, with no more failures there than on `main`.

---

### Sub-phase 57b: In a container the guard judges by the container's step, and never asks

**[MODIFY]** `src/commands/guardrails.ts` — add and export `containerStep(env: NodeJS.ProcessEnv): { step: PipelineStage | undefined } | undefined`, next to `sessionRun`: `undefined` when the session is not a container session (neither `TIMONE_RUN_PROJECT` nor `TIMONE_RUN_STAGE` is set to a non-empty value); otherwise `{ step }`, where `step` is `TIMONE_RUN_STAGE` when it is one of `PIPELINE_STAGES`, and undefined when it is missing, empty or unknown. Its comment says why either name marks a container (the safe direction; see Goal Description decision 1). `runGuard` then takes the stage in this order: the ledger's run when there is one (unchanged, even in a container); else, in a container, the container's step, **and the declaration is not read**; else the declaration, as today. It passes `container: true` to `probeGuardDecision` whenever `containerStep(env)` is defined, **with or without a run in the ledger**, because R3's last clause holds for every container session. Its comment gains one paragraph on the container, in the voice of the ones already there, and points at #87.
**[MODIFY]** `src/daemon/probeGuard.ts` — `ProbeGuardInput` gains `container?: boolean` (absent means a session on the host, so every existing caller is unchanged). In `probeGuardDecision`, after the builder and checker branches, a container session gets a refusal instead of the question. The reason is one fixed text, whatever the step or its absence, in plain words: `Refused: ${where} hold the checks, and only the checking step uses them. This session runs in a container, where nobody can be asked, so the guard refuses rather than asks.` The comment on the last branch says the question stays for a person's session and for a host run of a step that neither builds nor checks.
**[MODIFY]** `src/commands/guardrails.test.ts` — new `describe` block at the end, "the guard in a container knows its step (PRD-10 R2, R3)", built like phase 56's block (`mkdtempSync` roots, `newStore`, no `workspace()`, paths from `PROBE_DIRECTORIES`). In phase 56's block, the `PLACES` row "in a container" gains the container's step for the two run rows and the `SESSIONS` row "a person" gets the expected answer `deny` there and `ask` on the host. Mark the amendment with a comment (`✏ 57b: …, PRD-10 R3`). ✏ 2026-10-08 (build, timone#230): the block's `KINDS` line changes too, with its own marker. It joins each session with each place, and without a change there the two marked rows could not reach each other.
**[NEW FILE]** `src/commands/guardrails.guard-command.test.ts` — the test of the guard command itself (R6). It starts `node dist/cli.js guardrails guard --root <empty temp root> --state <temp>/state.json` with `spawnSync(process.execPath, …)`, as `src/cli.test.ts` does, a hook payload on stdin (`session_id`, `tool_name`, `tool_input`), and an environment built from `process.env` with `TIMONE_RUN_PROJECT`, `TIMONE_RUN_BRANCH` and `TIMONE_RUN_STAGE` removed and then `TIMONE_RUN_PROJECT: "timone"` and the step under test set. Its top comment quotes #87's sentence that asks for it.

**Seams under test (TDD):** two seams. `runGuard` is the unit seam: public, pure apart from reading the declarations file, and it is where the order of ledger, container and declaration is decided. The built guard command is the seam R6 names: the only one that proves the step is read from the command's own process environment. Red-green at `runGuard`, every case with an empty ledger unless it says otherwise, and `env: { TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: <step> }`: (1) `verification`: a `Write` of `<probes>/prd-10.r1.mjs` and a `Bash` call `node <probes>/prd-10.r1.mjs` are both allowed; (2) `update`: a `Read` of it is allowed; (3) `execution`, then `remediation`: a `Read` is refused with the builder's reason, word for word as on the host; (4) `execution` with a declaration of `verification` for the same session in `.timone/declared-stages.json`: refused; (5) a ledger run for the session at `execution` and a container step of `verification`: refused, the ledger wins; (6) a person's session (`env: {}`): asks with no declaration, allows with a declaration of `verification` — this case is green before and after, and is there to hold it; (7) every name in `PIPELINE_STAGES`, plus a missing, an empty and an unknown step (`"nonsense"`): a `Read` is never answered `ask`, and every step that is neither building nor checking, and the missing, empty and unknown ones, get the one container reason; (8) a ledger run at `planning` in a container: refused, not asked; (9) a call that names no folder (a `Read` of `src/cli.ts`) in a container at each of `execution`, `verification` and no step: silent. Red-green at the guard command: (10) `verification`, `Write` of `<probes>/prd-10.r1.mjs`: stdout parses to `permissionDecision: "allow"`; (11) `execution`, `Read` of it: `"deny"`. Cases (1), (2), (3), (4), (7), (8), (10) and (11) fail on today's code (it asks); (5), (6) and (9) pass on it and are kept as guards.

> Sub-phase 57a must be complete before starting this sub-phase (the guard reads the name 57a puts in the container; without 57a the tests pass and the container never carries the name).

Keep the push guard (`pushGuardDecision`) unchanged: it already treats a container as a run through `sessionRun`.

#### Agent Validation Steps

```bash
npm run build; echo "exit: $?"   # expect 0; the guard command test runs dist/cli.js
npx vitest run src/commands/guardrails.test.ts -t "PRD-10" src/commands/guardrails.guard-command.test.ts src/daemon/probeGuard.test.ts src/commands/stage.test.ts; echo "exit: $?"   # expect 0
# By hand, the guard command as the hook runs it, in a container's environment with an empty ledger.
# The payload's path is built from the code's own list, so no folder is spelled here.
root=$(mktemp -d); P=$(node -e 'import("./dist/daemon/probeGuard.js").then(m=>console.log(m.PROBE_DIRECTORIES[0]))')
echo "{\"session_id\":\"s\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$P/x.mjs\"}}" \
  | env -u TIMONE_RUN_BRANCH TIMONE_RUN_PROJECT=timone TIMONE_RUN_STAGE=planning node dist/cli.js guardrails guard --root "$root" --state "$root/state.json"
# expect one line whose permissionDecision is "deny", never "ask"
npx vitest run; echo "exit: $?"   # whole suite: only the failures #220 names, no more than on main
```

- [ ] Cases (1)-(11) are in the handoff with the red run of every case marked as failing on today's code, and the green run after.
- [ ] The guard command test's red run is shown: with the container's step ignored (today's `runGuard`), case (10) answers `ask` and fails. This is R6's second clause.
- [ ] Phase 56's block changed by its one marked row only, and passes.
- [ ] The three reasons `probeGuardDecision` gave before are unchanged word for word (`src/daemon/probeGuard.test.ts` passes with no edit to its existing assertions).

---

### Sub-phase 57c: `timone stage` says the truth in a container

**[MODIFY]** `src/commands/stage.ts` — `StageDeps` gains `env: NodeJS.ProcessEnv` (required); the command's action passes `process.env`. `runStage` still writes or clears the declaration and still returns 0. `guardSays` takes the container's step from `containerStep` (57b) and, when the session is a container session, says so instead of the host sentences:
- step known and the guard allows it: `Session <id> runs in a container whose step is <step>. In a container the step decides what the guard does, and this declaration changes nothing: the guard lets it read and write the probes without asking.`
- step known and the guard refuses it: the same first two sentences, ending `…changes nothing: the guard refuses it the probes.`
- step missing, empty or unknown: `Session <id> runs in a container that names no step Timone knows. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes.`
- `none` in a container: the first two sentences as above for the step or its absence, ending `…and taking a declaration back changes nothing.`

The verdict is asked of `probeGuardDecision` with `container: true` and the container's step, as today's sentences ask it, so the sentence cannot drift from the guard. Its comment drops "It assumes a session run by hand" and says what it does in a container. The command's description in `registerStageCommand` stays.
**[MODIFY]** `src/commands/stage.test.ts` — existing calls pass `env: {}`; their expected sentences do not change.

**Seams under test (TDD):** `runStage` is the seam — the public function the command calls, with its output captured through `log`. Red-green: (1) `env: { TIMONE_RUN_PROJECT: "timone", TIMONE_RUN_STAGE: "execution" }`, `runStage("verification")`: the sentence names `execution`, says the container's step decides, and contains neither "is now" nor "checking step"; the declaration is written and the exit is 0; (2) the same with the container step `verification`: names it and says the guard lets it through; (3) a container with no step: says it names no step and that the guard refuses; (4) `none` in a container: says taking it back changes nothing; (5) `env: {}`: every sentence today's tests pin is unchanged.

> Sub-phase 57b must be complete before starting this sub-phase (it uses `containerStep` and the `container` input of `probeGuardDecision`).

#### Agent Validation Steps

```bash
npm run build; echo "exit: $?"   # expect 0
npx vitest run src/commands/stage.test.ts; echo "exit: $?"   # expect 0
root=$(mktemp -d)
env TIMONE_RUN_PROJECT=timone TIMONE_RUN_STAGE=execution node dist/cli.js stage verification --session s --root "$root"; echo "exit: $?"
# expect exit 0 and a sentence that names "execution" and does not contain "is now"
env -u TIMONE_RUN_PROJECT -u TIMONE_RUN_STAGE node dist/cli.js stage verification --session s --root "$root"; echo "exit: $?"
# expect exit 0 and today's sentence: "Session s is now the checking step: …"
```

- [ ] Cases (1)-(4) red before green in the handoff; case (5) green throughout.
- [ ] The two hand runs print the sentences named above.

---

### Sub-phase 57d: The skills say where a runner-started session's step comes from

**[MODIFY]** `.claude/skills/timone-verify/SKILL.md` (124), `.claude/skills/timone-execute/SKILL.md` (49), `.claude/skills/timone-update/SKILL.md` (46) — each ends its paragraph on declaring a step with "A session the runner started does neither: the ledger already knows its step." Change that sentence to say that the ledger knows the step, or, in a container, the container does, and that `timone stage` changes nothing in a container. Mark each with `✏ <date> ([PRD-10](…), phase 57)`, in the style of the markers already in those paragraphs. Nothing else in the skills changes.
**[MODIFY]** `doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md` — the header's `**Phases:**` line names phase 56 and phase 57, linked.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phases 57b and 57c must be complete before starting this sub-phase (the sentences describe what they built).

#### Agent Validation Steps

```bash
grep -n "ledger already knows its step" .claude/skills/timone-verify/SKILL.md .claude/skills/timone-execute/SKILL.md .claude/skills/timone-update/SKILL.md; echo "exit: $?"
# expect exit 1: the old sentence is gone from all three (exit 2 would mean a path is wrong)
grep -c "container" .claude/skills/timone-verify/SKILL.md .claude/skills/timone-execute/SKILL.md .claude/skills/timone-update/SKILL.md
grep -n "Phases:" doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md
npx vitest run src/process-text.test.ts; echo "exit: $?"   # expect 0: the skill texts still pass the checks on process text
```

- [ ] Each of the three paragraphs says where the step comes from in a container, carries a dated marker, and is otherwise unchanged.
- [ ] The PRD header names both phases.
- [ ] No file outside these four was changed by this sub-phase, other than its own handoff section.

## Dependency graph

```
57a → (none)        the container carries TIMONE_RUN_STAGE, set by the runner, refused in a project's env file
57b → 57a           the guard reads the container's step, never asks in a container; the guard command test
57c → 57b           `timone stage` says the container's step decides
57d → 57b, 57c      the three skills and the PRD header say so
```

The slices run one after another: 57b and 57c both change how the guard is asked, and 57c uses what 57b adds.
