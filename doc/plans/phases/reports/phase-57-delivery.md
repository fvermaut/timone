# Phase 57 — Delivery Report

- **Date:** 2026-10-08
- **Phase:** [phase-57.md](../phase-57.md) — `Complete`, verified in [phase-57-verification.md](phase-57-verification.md)
- **Branch:** `timone/230-2-each-container-knows-its-step-and-the` @ `672341a`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `c718880`, which already holds phase 56 (#232), piece 1 of the same list.
- **Pull request:** opened against this report; its address is on [timone#230](https://github.com/fvermaut/timone/issues/230).
- **Screen:** no user-facing screen in this phase. The phase file's *Screens changed* line says none, so the screen gate was skipped.
- **Questions for the human:** none in the verification report. The runner asks the reviewer for two things, listed under *Outstanding for the human*.
- **Departures:** [`phase-57-departures.md`](phase-57-departures.md) — 3 entries: two test assertions the plan said would not change, and one check not run.

## Scope

This phase is piece 2 of the [list approved on #87](../../breakdowns/ticket-87.md), driven by [timone#230](https://github.com/fvermaut/timone/issues/230). It claims PRD-10.R1, R2, R3, R6 (MUST) and R7 (SHOULD) from the [criteria register](../../../specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md). R8 (`live`) is not claimed: it is observed on the next supervised run.

Each container the runner starts now carries the name of its step as `TIMONE_RUN_STAGE`, and a project's environment file may not set it. When the ledger has no run for the session, the guard judges by that step: the checking step may use the check scripts, a building step is refused them, a declaration made with `timone stage` cannot beat the step, and the ledger still wins when it has a run. In a container the guard never asks. `timone stage` says in a container that the container's step decides. Three skills that said "the ledger already knows its step" are updated.

## How to try it

### Against the preview

This project has no preview configured for pull requests. Use the local steps below.

### On a local checkout

Set up as [README.md](../../../../README.md) says, check out `timone/230-2-each-container-knows-its-step-and-the`, then:

1. `npm run build` — expect exit 0.
2. `npx vitest run src/commands/guardrails.test.ts -t "PRD-10" src/commands/guardrails.guard-command.test.ts src/daemon/probeGuard.test.ts src/commands/stage.test.ts` — expect all to pass. (In a container, the 45 old #220 failures of `guardrails.test.ts` may show when the `-t` filter is left off.)
3. The guard command as a container's hook runs it, with an empty ledger and a step that neither builds nor checks:
   ```bash
   root=$(mktemp -d); P=$(node -e 'import("./dist/daemon/probeGuard.js").then(m=>console.log(m.PROBE_DIRECTORIES[0]))')
   echo "{\"session_id\":\"s\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$P/x.mjs\"}}" \
     | env -u TIMONE_RUN_BRANCH TIMONE_RUN_PROJECT=timone TIMONE_RUN_STAGE=planning node dist/cli.js guardrails guard --root "$root" --state "$root/state.json"
   ```
   Expect one line whose `permissionDecision` is `"deny"`, never `"ask"`. With `TIMONE_RUN_STAGE=verification` and `"tool_name":"Write"` it is `"allow"`; with `TIMONE_RUN_STAGE=execution` and `Read` it is `"deny"`.
4. `timone stage` in a container:
   ```bash
   env TIMONE_RUN_PROJECT=timone TIMONE_RUN_STAGE=execution node dist/cli.js stage verification --session s --root "$root"; echo "exit: $?"
   ```
   Expect exit 0 and a sentence that names `execution`, says the container's step decides, and does not contain "is now". The same command with `env -u TIMONE_RUN_PROJECT -u TIMONE_RUN_STAGE` prints the old sentence, *"Session s is now the checking step: …"*.
5. `npm run --silent replay`, from a terminal signed in to Claude — the replay the check could not run (below).

## Verification outcome

From [phase-57-verification.md](phase-57-verification.md): 0 of 2 fix loops consumed. Its gate was **not met** only because PRD-05.R18 is BLOCKED: it needs a real model. Every claimed criterion passed and there is no regression.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-10.R1 | MUST | api | PASS | 0 |
| PRD-10.R2 | MUST | api | PASS | 0 |
| PRD-10.R3 | MUST | api | PASS | 0 |
| PRD-10.R6 | MUST | api | PASS | 0 |
| PRD-10.R7 | SHOULD | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; clause 1 runner BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** (regression) | 0 |
| PRD-06.R5 | MUST | api | PASS (regression, on its named test) | 0 |
| PRD-07.R1 | MUST | api | PASS (regression) | 0 |
| PRD-07.R2 | MUST | api | PASS (regression) | 0 |
| PRD-07.R4 | MUST | api | PASS (regression) | 0 |
| PRD-07.R6 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |
| PRD-07.R12 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2 | MUST | api | PASS (regression) | 0 |
| PRD-08.R4 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R2 | MUST | api | PASS (regression) | 0 |
| PRD-09.R4 | MUST | api | PASS (regression) | 0 |
| PRD-09.R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R4 | MUST | api | PASS (regression) | 0 |
| PRD-10.R5 | MUST | api | PASS (regression) | 0 |

PRD-10.R1 passes but stays `draft` in the register: one of its clauses is a claim about every way the daemon starts a container, and its block has no `Falsified-by:` line (the verification report, PRD-10.R1). The whole test suite: 2655 passed, 70 failed; all 70 are the old failures of #220, the same list as on `main`.

### Outstanding for the human

- [ ] PRD-05.R18 — the replay of the runner's recorded failures was not run. It needs a real model, and this phase changed `src/runner/actions.ts`. Run `npm run --silent replay` on this branch from a terminal signed in to Claude, and reply with its last line.
- [ ] The two existing tests changed against the plan ([phase-57-departures.md](phase-57-departures.md), entries 1 and 2) were not judged by the check, because the check may not read tests. The Spec review below read them and found both sound; the runner asks you to look at them too.
- [ ] Live gates owed: this diff touches `src/daemon/`, `src/commands/guardrails.ts`, `src/runner/` and `.claude/skills/`. The criteria are listed in [phase-57-verification.md](phase-57-verification.md) § *Live gates*. A real run in a container on this build is also what PRD-10.R8 needs.
- [ ] PRD-05.R2 clause 2b (reading GitHub) and PRD-05.R7 clause 1 (the real runner) were not checked, as on phase 56. Both criteria pass on their other clauses.

## Standards review — phase 57

- **Read:** the diff `origin/main...672341a`, restricted to `src/**` (non-test hunks read in full) and `.claude/skills/**`. Current content of `src/commands/stage.ts`, `src/commands/guardrails.ts` (lines 280–345) and `src/daemon/probeGuard.ts` (lines 270–330). `standards/code-smells.md` (Timone's), `package.json`, `tsconfig.json`. There is no ESLint, Prettier or Biome config, and no `doc/standards.md`.
- **Diff:** `origin/main...672341a` — 35 files, +2488/−27
- **Findings:** 3

### 1. The doc comment on `stage` is now wrong for container sessions — Inconsistent vocabulary

- **Where:** `src/daemon/probeGuard.ts:289–295`
- **What:** The diff adds `container?: boolean` to `ProbeGuardInput`. It leaves the field above it as it was: `/** The stage of the run driving this session; undefined means a human is. */`. In a container, `containerStep` returns `step: undefined` when `TIMONE_RUN_STAGE` is missing or unknown. The guard then gets `stage: undefined, container: true`, and that is not a human's session. The new deny branch is built for exactly that case.
- **Why it matters:** One concept, "undefined stage", now has two meanings, and the comment states only the old one. A reader who trusts the comment will reason wrongly about the container branch.
- **Suggested remediation:** Reword the comment, for example: "undefined means no known step: a person's session on the host, or a container that names none". Not applied here.

### 2. The "is this variable set" test is now written four times in one file — Duplicated code (repeated one-liner)

- **Where:** `src/commands/guardrails.ts:316`, `:318`, `:341`
- **What:** `sessionRun` already had `project === undefined || project === ""` and `workBranch === undefined || workBranch === ""`. The new `containerStep` adds `(project === undefined || project === "") && (named === undefined || named === "")`. Both functions read the same box variables and make the same decision about what counts as empty.
- **Why it matters:** The rule of three counts a repeated one-liner. The next box variable will copy the test a fifth time, or forget the `""` half.
- **Suggested remediation:** Add a small helper such as `boxVar(env, name): string | undefined` that turns empty into undefined. Use it in both `sessionRun` and `containerStep`. Not applied here.

### 3. `containerSays` copies how `guardSays` asks the guard for a verdict — Duplicated code

- **Where:** `src/commands/stage.ts:60–65` and `:111–117`
- **What:** Both functions build the same sample call, `probeGuardDecision({ toolName: "Read", toolInput: { file_path: join(PROBE_DIRECTORIES[0], "x.mjs") }, stage… })?.permissionDecision`, and then switch on the result. Only the `container` flag and the wording of the sentence differ.
- **Why it matters:** Each copy decides on its own which call stands for "touching the probes". The diff's stated aim is that this sentence cannot drift from what the guard does. Two copies of the question can drift from each other. This is the second copy, which the rule of three allows, but the copied part is a decision, not just syntax.
- **Suggested remediation:** Extract `probeVerdict(stage, container)`, which returns the `permissionDecision` of the guard for that sample read. Both functions call it and keep only their own wording. Not applied here.

## Spec review — phase 57

- **Read:** `src/commands/guardrails.ts`, `src/commands/stage.ts`, `src/daemon/probeGuard.ts`, `src/daemon/container-runtime.ts`, `src/daemon/run-env.ts`, `src/daemon/session.ts`, `src/runner/actions.ts` (the two `sessionRequest` calls and `APPROVED_STAGE`), and the diffs of their tests: `src/commands/guardrails.test.ts`, `src/commands/guardrails.guard-command.test.ts`, `src/commands/stage.test.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/run-env.test.ts`, `src/daemon/session.test.ts`, `src/daemon/step-session.test.ts`, `src/runner/actions.test.ts`. The three changed skills: `.claude/skills/timone-execute/SKILL.md`, `timone-update/SKILL.md` and `timone-verify/SKILL.md`. `doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md` with its `.criteria.md` file, and lines 1–25 of `doc/plans/phases/phase-57.md`.
- **Diff:** `origin/main...672341a` — 35 files, +2488/−27
- **Findings:** none
- **The two changed tests:**
  - **`src/daemon/session.test.ts`:** This change is sound. `stage` is now a required field of every request, and both tests still check what they were written for: a `workspace` key or an `effort` key that is undefined does not show up in the request.
  - **The `KINDS` line in `src/commands/guardrails.test.ts`:** This change is sound. The register says a person's session carries neither `TIMONE_RUN_PROJECT` nor a step. So the old "person in a container" row (it has `TIMONE_RUN_PROJECT` and no step) is really a container with no step, and PRD-10.R3 says that case is refused. The row's label is now a little wrong, but its expectation is right. The run rows now also carry their step, as PRD-10.R1 says every container does.

Notes, not findings:

- **Every requirement checked against the code:**
  - **PRD-10.R1:** both `sessionRequest` callers in `src/runner/actions.ts` now give the step: the step a run starts, and `requirements` or `breakdown` for the session that records an approval. `stage` is a required field, so the compiler stops any other caller that leaves it out. `TIMONE_RUN_STAGE` is added to `RESERVED`.
  - **PRD-10.R2:** in `runGuard`, the order is the ledger first, then the container's step, then the declaration. The declaration is read only when there is no container.
  - **PRD-10.R3:** in a container, the `container` flag answers `deny` before the guard could ever reach its `ask` branch. No other place was found where the guard can answer `ask`.
  - **PRD-10.R6:** the new test starts the real command in its own process. If the guard ignored the container's step, the test would fail.
  - **PRD-10.R7:** in a container, `timone stage` now says the container's step decides. A person's session gets the same sentences as before, and its tests pass `env: {}` and are otherwise unchanged.
- **Scope:** no scope creep. The changes to the three skills only explain that `timone stage` changes nothing in a container, which goes with R7. PRD-10.R8 is not built, as the phase says.
- **Criteria register:** the diff marks R2, R3, R6 and R7 `verified`. R1 stays `draft`, though the phase claims it. No gap was found in the code for R1.

## Notes

- The Spec review's note on PRD-10.R1 has its answer in the verification report: R1 passes, and stays `draft` because the claim in its clause 2 is about every way a container is started, and its block names no `Falsified-by:` check. The Spec review observed that `stage` is a required field the compiler enforces; naming that on R1's block is the step the verification report suggests.
- Both reviews ran as separate fresh contexts on the same diff range. Neither read the other's report or the verification report.
- The 70 failing tests are the old failures of #220 (pieces #228 and later); none is new.
