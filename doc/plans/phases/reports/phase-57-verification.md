# Phase 57 — Verification Report

- **Date:** 2026-10-08
- **Phase:** [phase-57.md](../phase-57.md) — stamped `Complete`, completion report [phase-57-complete.md](phase-57-complete.md)
- **Scope:** PRD-10.R1 (MUST), R2 (MUST), R3 (MUST), R6 (MUST), R7 (SHOULD) — the phase header and the completion report's requirements line agree. R8 (`live`, SHOULD) is not claimed by this phase.
- **Live gate owed:** yes. This diff touches `src/daemon/`, `src/commands/guardrails.ts`, `src/runner/`, `.claude/skills/timone-execute/` and `.claude/skills/timone-verify/` (and `.claude/skills/` as a whole), which these `live` criteria declare they depend on: PRD-01.R4, R11, R12; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R1, R2, R3, R4, R5; PRD-06.R1, R2, R3, R4; PRD-07.R5, R7, R14. These carry no `Depends-on` line, so they are owed on any phase: PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-08.R6, PRD-10.R8. See *Live gates*.
- **Regression set (derived):** 24 criteria (MUST + api + verified, narrowed by `Depends-on`): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-06.R5; PRD-07.R1, R2, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R4, R5.
- **Branch:** `timone/230-2-each-container-knows-its-step-and-the` @ `2ca720199c929d4d83ba5d0fed22ebbbe6db1f81`. The phase does not stack on an unverified phase: its merge-base with `main` is `c718880`, which holds phase 56 and its verification.

## Environment

- **The app.** Timone is a command-line program, so there is no server to stand up. Built with `npm run build` (`tsc`) on this branch, after the install the container had already done. Every check script runs the built `dist/cli.js`. Scripts that run the daemon start it in a throwaway root with `--runtime container`, with a stand-in `docker` first on the path that records what it is handed and starts nothing (see PRD-10.R1 below), or with `--runtime in-process`, as the existing scripts do.
- **Break runs** use the build of `c718880`, the commit on `main` just before phase 57 (`_old-build.mjs`: exported with `git archive` into the system's temporary folder and compiled there; nothing in the repository changes).
- **This session's own guard.** This session was started by the runner in a container whose Timone is `c718880`, from before this work. Its own guard did not know its step: the first listing of the check-script folder was stopped with a question nobody could answer. The session declared its step with `node dist/cli.js stage verification --session 6ad6e44e-7fd4-44d3-aba7-c789c7ead1b3` at the Timone root, as the instructions say to do for a session run by hand, and went on. That is the fault #87 describes, seen once more on the old code. It is not evidence for or against this phase.
- **Build-health smoke**, run once at the end, not as evidence: `npx tsc --noEmit` exit 0, then `npx vitest run --reporter=json` on `2ca7201` after `npm run build` — 77 test files, 2725 tests: **2655 passed, 70 failed**, 10.3 s. Every failure message is a refused `git push` in the test's own setup (*"Command failed: git push …"*): 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. This is Timone issue #220, not this work.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-56-verification.md` on `main` (lines 15–86, its smoke line and its named list of 70). All 70 failures here are named there, so all 70 are **old**. No test that failed there passes here. The list, for the next pass:
  - `src/commands/guardrails.test.ts > a session a human drove catches a project's work branch cut at the timone root — finding 11, on real git` — old
  - `src/commands/guardrails.test.ts > a session a human drove does not judge Timone's own work against a project it never had` — old
  - `src/commands/guardrails.test.ts > a session a human drove goes round exactly once, however many turns the session takes` — old
  - `src/commands/guardrails.test.ts > a session a human drove prints the finding and journals it, and posts on no ticket at all` — old
  - `src/commands/guardrails.test.ts > a session a human drove says nothing when the session behaved` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove asks the session first, then flags the run — and posts on no ticket` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove says nothing anywhere when the session behaved` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove stops flagging once the session has fixed what it was told` — old
  - `src/commands/guardrails.test.ts > a session with no baseline says so rather than passing silently` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the STATUS.md placement rule` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the path-containment rule — the 14g accusation itself` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the provenance rule` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the unpushed rule, and do not inflate its count` — old
  - `src/commands/guardrails.test.ts > commits another session made are still judged when they name no session at all — the fix's known limit` — old
  - `src/commands/guardrails.test.ts > finding the run that drove a session finds nobody for a session no run ever claimed` — old
  - `src/commands/guardrails.test.ts > finding the run that drove a session resolves the session id against the ledger` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) goes by the ledger when the session has a run, whatever it declared` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) lets a session that declared the checking step through` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) refuses the probes to a session that declared a building step` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) still asks when the session has no run and declared no step` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes asks when no run drove the session, because a human is at the keyboard` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes lets the verification run that owns them through` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes refuses a build run the probe directory` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes says nothing about a tool call that touches no probe` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `GIT_CONFIG_COUNT=0 git push` `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git -c core.hooksPath=/tmp/h push` `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git push --no-verify origin x` `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git commit --no-verify -m x` in a person's own session `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push --no-verify origin x` in a person's own session `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push origin timone/39-x` in a person's own session `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git commit --no-verify -m x` `` — old
  - `` src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git push origin timone/39-x` `` — old
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits says nothing about a status file the work branch took from main` — old
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits still says so about a status file that exists only on a branch` — old
  - `src/commands/guardrails.test.ts > the journal appends one line per finding, and creates the file` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits accepts a trailed commit and flags an untrailed one` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits flags a commit that carries no trailer at all` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits tells the session its own id and what it owes, at SessionStart` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as a person's own session when nothing names a run` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is nobody's when neither the ledger nor the environment names a run` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is the box's declaration when the ledger has no run for the session` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is the ledger's run when the ledger has one, whatever the environment says` — old
  - `src/commands/number.test.ts > timone number names the projects it knows, and exits 1, for a project it does not know` — old
  - `src/commands/number.test.ts > timone number prints only the reserved number, padded, and exits 0` — old
  - `src/commands/number.test.ts > timone number prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails` — old
  - `src/numbers.test.ts > reserveNumber counts a PRD and its criteria register as one number` — old
  - `src/numbers.test.ts > reserveNumber counts a number another session reserved, and only reservations of the same kind` — old
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only in the checkout's folder, not committed` — old
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only on another branch, pushed after the checkout was cloned` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a adr number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a phase number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a triage number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives the first adr number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first phase number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first prd number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first triage number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the phase after the highest on the default branch, not counting the reports folder` — old
  - `src/numbers.test.ts > reserveNumber gives two reservations from one checkout, in the same second and with the same note, two different numbers` — old
  - `src/numbers.test.ts > reserveNumber leaves the checkout as it was: same branch, same status, and no local ref to the reservation` — old
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when a pre-push hook refuses` — old
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when the remote does not exist` — old
  - `src/workspace.test.ts > syncWorkspace clones a missing project on first sync` — old
  - `src/workspace.test.ts > syncWorkspace fails a plain non-git directory but still processes the others` — old
  - `src/workspace.test.ts > syncWorkspace fast-forwards and reports updated when the upstream gains a commit` — old
  - `src/workspace.test.ts > syncWorkspace reports up-to-date when the upstream has not moved` — old
  - `src/workspace.test.ts > syncWorkspace skips a checkout on a non-default branch` — old
  - `src/workspace.test.ts > syncWorkspace skips a dirty checkout without touching it` — old
- **Smoke against probes.** The 45 failures in `guardrails.test.ts` fail in their setup, on the container's push refusal, not on what the guard answers. The tests of this phase in that file (titles under "the guard in a container knows its step (PRD-10 R2, R3)") all passed in the smoke, and the probes pass the same behaviour. The two instruments do not disagree.

## Independence declaration

Read: `doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md` whole and its PRD narrative whole; the R5 block of `prd-06-….criteria.md`; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); `phase-57.md`'s status line, *Screens changed* line and *Requirements* table (by `grep`); `reports/phase-57-complete.md` whole; `CONTEXT.md` and `README.md` whole; `package.json`'s scripts, type and bin; the headings of `STATUS.md`, its first 30 lines and lines 65–68, 146–150 and 417; the headings of `reports/phase-57-departures.md` (its line count and two `##` lines, to append an entry). On `main`, by `git show`: `phase-56-verification.md`'s heading list and lines 15–86 (its smoke line and list), and, **beyond the allowed list**, its lines 87 and 91, which a search for the word "smoke" printed in full: its note that its smoke and probes agree, and its own independence declaration. They describe what that pass read, not any verdict, and no verdict here uses them; and lines 12–17 of `phase-56-departures.md` (the form of a check's entry, a stage-7 artifact). The probe directory: `run.mjs`, `_lib.mjs`, `_guard.mjs`, `_old-build.mjs`, `prd-10.r4.mjs`, `_steps.mjs` (lines 1–198), parts of `_rig.mjs` (the fixture, the fake model, the daemon helper, `clause`/`finish`), and lines 1–87 of `prd-05.r3.mjs` (how it drives an approval). The values of `PROBE_DIRECTORIES` and `PIPELINE_STAGES`, by importing the built modules `dist/daemon/probeGuard.js` and `dist/daemon/pipeline.js`, and the names of the built files that mention `PIPELINE_STAGES` (`grep -l`). `node dist/cli.js stage --help`. File-name lists only: `git diff --name-only origin/main...HEAD`. Counts only, for the runner's question about the three instructions: how often three phrases occur in `.claude/skills/timone-execute|update|verify/SKILL.md` on this branch and the old phrase on `main`, and the one sentence of `timone-verify/SKILL.md` that replaced it (this stage's own instructions). Test **titles** and pass/fail results from the test runner's JSON report, never test source. `doc/standards.md` does not exist in this project. Not read: handoffs, diffs, source, the committed test suite, ADRs, the departures entries of the build. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass — except PRD-06.R5, which fvermaut decided on 2026-10-03 is verified on one named builder test (see *Regression*).

**One instruction of the runner was not followed.** The runner asked this pass to read `phase-57-departures.md` and judge whether the build's two changes to existing tests are sound. That file's build entries are not on this step's list of what it may read, and judging a test change means reading the tests, which this step may never do: a check that reads the builder's tests checks the builder against the builder. The completion report says what the two changes are (two assertions of `src/daemon/session.test.ts` now include `stage`; phase 56's `KINDS` line in `guardrails.test.ts` changed with its two rows). Whether they are sound belongs to the code review at delivery, which reads code. This pass did observe one related fact from outside: with nothing changed, the tests of this phase pass, and the probe of R6 shows the new command test fails when the guard is changed (below).

## Verdict summary

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

**Gate:** not met. Every claimed criterion passes and there is no regression, but PRD-05.R18, a MUST criterion in the regression set, is BLOCKED: it needs a replay of the runner's recorded failures against the real model on this build, which this container cannot run. BLOCKED observed nothing and is not a regression. It is carried forward (below) and in the departures record.

## Evidence

Every probe below was run on its own, without `PROBE_REAL_ONLY`, so each clause did its break run on the build before phase 57 (or the break the probe names) and then its real run on this branch. Commands: `node doc/plans/phases/probes/prd-10.rN.mjs`; for R6, `PROBE_R6_FILES=<the 8 test files this phase changed>` as well (see R6).

### PRD-10.R1 — PASS

Probe `prd-10.r1.mjs`, written this pass. The built daemon runs in container mode in a throwaway root, with a stand-in `docker` that records its arguments, its own environment and the ledger at that moment, and answers `docker run` as a finished session would. The container's environment is worked out as docker builds it from `-e NAME` (value from docker's environment), `-e NAME=value` and `--env-file`. One run is walked: the runner starts `requirements`; a person approves the requirements and the runner records the approval; the runner starts `execution`, then `verification`.

- **Clause 1** — PASS. Break run on the old build: all 3 step containers had `TIMONE_RUN_STAGE=<not set>` (red). Real run:
  ```
  timone-fixture-1: TIMONE_RUN_STAGE="requirements", ledger stage requirements
  timone-fixture-3: TIMONE_RUN_STAGE="execution", ledger stage execution
  timone-fixture-4: TIMONE_RUN_STAGE="verification", ledger stage verification
  ```
- **Clause 2** — PASS. The session that records an approval starts its own container (it is started with its prompt in `TIMONE_PROMPT` and no `-i`). Break run: `<not set>` (red). Real run: `timone-fixture-2: TIMONE_RUN_STAGE="requirements", ledger stage requirements (the approval's session)`. 4 containers were started in the walk in all; the planner started none.
- **Clause 3** — PASS. A project environment file `.timone/env/fixture.env` holding `TIMONE_RUN_STAGE=verification`: no container started, and the record's decision reads *"Refused: The step did not start: …/.timone/env/fixture.env:1 sets TIMONE_RUN_STAGE, which is the box's own. A run's identity, its prompt and its model are the daemon's to set; a project file that took one over would redirect the run without saying so. Remove the line."* The same file with `TIMONE_RUN_PROJECT=other` gives the same sentence with only the name and the folder changed. Break run on the old build: a container was started and nothing was refused (red).

**Status stays `draft`, by [ADR-0055](../../../adr/0055-a-universal-claim-is-not-established-by-watching.md).** Clause 2 is a claim about *every* other way the daemon starts a session in a container ("in any other way it does today"). This pass watched the ways one run walks through: a step, an approval, and the planner (which starts no container). A claim about every way is closed only by a check that cannot pass when one way forgets the step, named in a `Falsified-by:` line on R1's block, and R1 has none. What would have to exist: such a line, naming for example a test or a type that fails when any session request for a container is built without its step. The completion report says the request now carries a required `stage`; if that is a type the compiler enforces, naming it on the block would be enough.

### PRD-10.R2 — PASS

Probe `prd-10.r2.mjs`, written this pass, with the helper `_guard-step.mjs`. The guard is run as the hook runs it: `node dist/cli.js guardrails guard --root <root> --state <state>`, the payload on stdin, the environment set on the command line. A container session carries `TIMONE_RUN_PROJECT` (and `TIMONE_RUN_STAGE` when it has a step); a person's session has both removed. Every call is made for both folders, with the path relative and in full (4 forms).

- **Clause 1** — PASS: empty ledger, step `verification`: 8 judgements (a `Write` and `node …` of `<probes>/prd-10.r1.mjs`), all `allow`. Break: the old build answered `ask` to all 8 (red).
- **Clause 2** — PASS: step `update`, `Read`: 4 judgements, all `allow`. Break: `ask` ×4 (red).
- **Clause 3** — PASS: steps `execution` and `remediation`, `Read`: 8 judgements, all `deny`, each with exactly the reason a building step gets on the host (a ledger run of `execution`, no container environment): *"Refused: doc/plans/phases/probes and standards/baseline/probes hold the checks that will be run against what you build. …"*. That host reason is the same as the old build's. Break: `ask` ×4 (red).
- **Clause 4** — PASS: a declaration of `verification` made with the built `timone stage` command (shown to be in force: a person's session with the same id is allowed), then the container step `execution`: 4 judgements, all `deny`. Break: the old build let the declaration win, `allow` ×4 (red).
- **Clause 5** — PASS: a ledger run of `execution` for the session, container step `verification`: 4 judgements, all `deny`. Break: the same call with the ledger's run removed — what a guard that let the container's step beat the ledger would answer — `allow` ×4 (red). The old build cannot serve here: the ledger won there too.
- **Clause 6** — PASS: a person's session, empty ledger: 4 judgements `ask`; after declaring `verification`, 4 judgements `allow`. Break: the same session given a container's environment with no step answers `deny` (red). The old build cannot serve here: the clause says the behaviour is unchanged.

### PRD-10.R3 — PASS

Probe `prd-10.r3.mjs`, written this pass.

- **Clause 1** — PASS: empty ledger, each step of `PIPELINE_STAGES` that neither builds nor checks (triage, clarification, wayfinding, charting, research, requirements, breakdown, planning, delivery): 36 judgements, all `deny`, one reason: *"Refused: doc/plans/phases/probes and standards/baseline/probes hold the checks, and only the checking step uses them. This session runs in a container, where nobody can be asked, so the guard refuses rather than asks."* Two sentences; it says only the checking step uses the files and that nobody in a container can be asked. Break: the old build answered `ask` (red).
- **Clause 2** — PASS: the step missing, `""`, `"frobnicate"`, `"Verification"` and `"verification "` (a space after): 20 judgements, all `deny` with clause 1's reason. Break: `ask` (red).
- **Clause 3** — PASS: 4 ledgers (empty, and a run of `execution`, `verification`, `planning` for the session) × 16 steps (all 13 names, missing, empty, unknown) × 29 calls (real reads, writes, edits, notebook edits, globs, greps, `cat`, `ls`, `node`, a `python3` script, a helper prompt, a commit message and an unknown tool, for both folders, plus 3 ordinary calls) = 1856 judgements, none `ask`. Break: the old build asked in 704 of them (red).

Clause 3 is a universal claim ("never"). R3's block names a falsifying test; the test runner's report shows tests titled *"the guard in a container knows its step (PRD-10 R2, R3) never asks about a check script, at '<step>'"* for all 13 steps and a missing, empty and unknown step, all passing (titles only were read). This probe is also a check proved able to fail. Both bounds of ADR-0055 are met.

### PRD-10.R6 — PASS

Probe `prd-10.r6.mjs`, written this pass. **It observes the test suite without reading it.** It clones the repository at HEAD into a temporary folder, builds it there, and puts a recorder in front of the clone's `dist/cli.js`. For `guardrails guard` the recorder writes down the arguments, `TIMONE_RUN_PROJECT` and `TIMONE_RUN_STAGE`, the state file as the guard found it, the payload on stdin and the answer; every other command passes straight through. It then runs the tests in four modes: unchanged; the guard run with `TIMONE_RUN_STAGE` removed (clause 2's change); the execution `Read`'s refusal turned into an allow; the verification `Write`'s allow turned into a refusal. A test "checks" an answer when it fails once that answer is changed.

This pass ran the 8 test files the phase changed (`PROBE_R6_FILES`), as the runner asked: run only the tests of what changed while working. 363 tests, 45 failing with nothing changed (all the #220 failures of `guardrails.test.ts`).

- **Clause 1** — PASS. Seen: one guard command for a `Write` of `doc/plans/phases/probes/prd-10.r1.mjs` with `TIMONE_RUN_PROJECT` and step `verification` (answer `allow`), and one for a `Read` of it with step `execution` (answer `deny`), each with a payload on stdin and `--state` pointing at a ledger that holds no run. Turning the refusal into an allow makes *"the guard command in a container, with an empty ledger (PRD-10 R6) refuses a check script to the building step"* fail; turning the allow into a refusal makes *"… lets the checking step write a check script"* fail. Break: the clone at `c718880` started no such guard command (red).
  - **A reading, stated so it can be argued with:** the clause says "a state file that holds no run". The test's `--state` names a path where no file exists. This pass counts that as a state file that holds no run: a container starts with an empty `.timone/`, so in a real container the ledger file is absent, and the guard reads no run either way. The case of an existing file with no runs is covered by this pass's probe of R2, which uses one.
- **Clause 2** — PASS. With `TIMONE_RUN_STAGE` removed from the guard command's environment, *"… lets the checking step write a check script"* fails. Break: the same change on the clone at `c718880` makes no test fail (red).

### PRD-10.R7 — PASS

Probe `prd-10.r7.mjs`, written this pass. The register's criterion is one paragraph; the probe labels its two sentences as two clauses.

- **Clause 1** — PASS. `timone stage verification --session sess-1 --root <root>` in a container session, steps execution, verification, remediation, planning. For example: *"Session sess-1 runs in a container whose step is execution. In a container the step decides what the guard does, and this declaration changes nothing: the guard refuses it the probes."* Each names its step, says the container's step decides, and none says the session "is now" the checking step. Exit 0. Break: the old build said *"Session sess-1 is now the checking step: …"* (red).
- **Clause 2** — PASS. In a person's session, `timone stage` for verification, execution, planning and none prints exactly what the old build prints, for example *"Session sess-1 is now the checking step: the guard lets it read and write the probes without asking."* Break: the same command with a container's environment differs from it (red).

### The three instructions (asked by the runner; no criterion covers them)

No register criterion covers the wording of `.claude/skills/timone-execute`, `timone-update` and `timone-verify`. Counted only: the old sentence *"the ledger already knows its step"* occurs once in each of the three files on `main` and in none of them on this branch; each now mentions a container (2, 1 and 3 times). `timone-verify` now reads: *"A session the runner started does neither: the ledger knows its step or, in a container, the container does. In a container `node dist/cli.js stage` changes nothing"*. This is not criterion evidence.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

No claimed criterion is on the `live` channel. PRD-10.R8 (`live`, SHOULD, not claimed here) has no `Last live gate:` line; it is observed on the next supervised run, as the completion report says. The phase owes a fresh live gate on the criteria listed in the header: those whose `Depends-on` this diff touches (PRD-01.R4, R11, R12; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R1, R2, R3, R4, R5; PRD-06.R1, R2, R3, R4; PRD-07.R5, R7, R14) and those with no `Depends-on` (PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-08.R6, PRD-10.R8). Their last gates: PRD-02.R1 and R13, [phase-32-live-gate.md](phase-32-live-gate.md); PRD-03.R1, R3 and R5, [phase-35-live-gate.md](phase-35-live-gate.md); PRD-05.R9, R12, R13 and R15, [phase-40-live-gate.md](phase-40-live-gate.md); PRD-04.R1, PRD-08.R6 and PRD-10.R8 carry no line; every other one says `never`. The completion report names PRD-02's `live` criteria as owed before delivery because `src/daemon/` changed. A real run in a container on this build is also what R8 needs.

## Regression

Run with `node doc/plans/phases/probes/run.mjs --regression --only=<the 23 IDs with a probe>`, real runs only, 4 min 23 s:

- PRD-05.R2 — PASS (3 of 4 clauses; clause 2b BLOCKED: GitHub cannot be read from here)
- PRD-05.R3 — PASS (19 labels)
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS (3 of 4 clauses; clause 1 with the real runner BLOCKED: it needs a real model)
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — **BLOCKED**, all 3 clauses: *"the recorded replay judged here is older than this build: run 10's commit 4686ef4 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal)."*
- PRD-07.R1, R2, R4, R6, R9, R10, R12 — PASS
- PRD-08.R2, R4, R5 — PASS
- PRD-09.R2, R4, R5 — PASS
- PRD-10.R4, R5 — PASS
- PRD-06.R5 — PASS. It has no probe: on 2026-10-03 fvermaut decided it is verified on the builder's test its `Falsified-by` line names (the register's marker on the block). Run by name, as that marker says: `npx vitest run src/daemon/container-runtime.test.ts -t "a box is never handed a token that dies before its next refresh"` — 1 passed, 107 skipped.

22 passing, 0 failing, 1 blocked among the probes; no regression.

**What the narrowing removed** (the criterion, and the `Depends-on` prefixes this diff does not touch): PRD-01.R2 (`src/manifest.ts`, `src/commands/projects.ts`); PRD-01.R3 (`src/commands/workspace.ts`, `src/git.ts`); PRD-07.R3 (`src/daemon/runs.ts`, `src/runner/driver.ts`); PRD-07.R13 (`src/commands/takeover.ts`, `src/daemon/runs.ts`); PRD-08.R1 (`src/daemon/chunk-zero.ts`, `src/adapters/`, `src/manifest.ts`).

## Probes

**5 probes proven able to fail this pass, 0 not.** The 5 new probes have 16 clauses in all; each clause did a break run that went red, then a real run that went green.

- Written this pass, first check of each criterion: `prd-10.r1.mjs`, `prd-10.r2.mjs`, `prd-10.r3.mjs`, `prd-10.r6.mjs`, `prd-10.r7.mjs`, and the helper `_guard-step.mjs` (runs the guard with a container's or a person's environment; makes a declaration with the built `timone stage`).
- Ran without a break run this pass (proved able to fail by an earlier pass; ADR-0061 D1): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R4, R5.
- No probe has no break step.
- Clause coverage: for every probe run, the register's `GIVEN` count was compared with the labels the probe printed. No criterion has more clauses than labels.
- **Instrument changes** (shared helpers, committed with this report): `_guard.mjs` (`judge`), `_steps.mjs` (`hookCli`) and `_rig.mjs` (`fx.env`) now clear `TIMONE_RUN_STAGE`, the container's step that exists since this phase. Without it, a verifier running in a container that carries a step would pass that step on to the "person" and "host" sessions of the older probes. This changes nothing in this container, which carries no step; R4 and R5 passed after the change. `prd-10.r3.mjs` runs its 1856 judgements ten at a time (`guardMany` in `_guard-step.mjs`), so a later real run takes about a minute.

## Fix-loop accounting

0 of 2 loops consumed — the initial pass found no failure.

## Figures on the preview's data

No screen changed in this phase: the phase file's *Screens changed* line says none.

## Questions for the human

None.

## Register changes

In `prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md`:

- PRD-10.R2: `draft` → `verified`.
- PRD-10.R3: `draft` → `verified` (a universal claim: its named falsifying tests exist and pass, and this pass's probe is proved able to fail).
- PRD-10.R6: `draft` → `verified`.
- PRD-10.R7: `draft` → `verified`.
- PRD-10.R1: stays `draft` although it passes, for the reason given under its evidence (ADR-0055: clause 2 is a claim about every way, and the block has no `Falsified-by` line).

## Carried forward

- **PRD-05.R18 — BLOCKED.** Its instrument is a replay of the runner's recorded failures against the real model on this build. This phase changed `src/runner/actions.ts`, so the replay is relevant here. Owed: `npm run --silent replay` on this branch, from a terminal signed in to Claude, and its result recorded on the branch. Recorded in [phase-57-departures.md](phase-57-departures.md).
- **PRD-05.R2 clause 2b and PRD-05.R7 clause 1 (the real runner)** were not checked, for the same reasons as on phase 56 (GitHub cannot be read from here; a real model is needed). Both criteria pass on their other clauses.
