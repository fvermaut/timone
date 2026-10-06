# Phase 54 — Verification Report

- **Date:** 2026-10-06
- **Phase:** [phase-54.md](../phase-54.md) — stamped `Complete`, completion report [phase-54-complete.md](phase-54-complete.md)
- **Scope:** PRD-02.R9 (SHOULD, `api`, `verified` before this pass). The phase fixes a bug against it: the last line of `timone status` named finished tickets as if they waited on a person ([#186](https://github.com/fvermaut/timone/issues/186)).
- **Live gate owed:** yes, by the rule that a phase owes one when its diff touches what a `live` criterion declares it depends on. This diff touches `src/daemon/` and `src/commands/`, which these declare: PRD-01.R4, PRD-02.R1, R2, R4, R6, R7, R8, R13, PRD-03.R1, R2, R4, R5, PRD-07.R5, R7, R14. These carry no `Depends-on` line, so they are counted as touched too: PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-08.R6 (PRD-04.R7 is `deprecated`). The completion report says no `live` criterion depends on the changed files; the register's own `Depends-on` lines say otherwise (most name all of `src/daemon/`). See *Live gates*.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5 — 15 criteria.
- **Branch:** `timone/186-timone-status-asks-you-to-answer-on-abou` @ `fd3abeff9cff8c35cbd9ac2ac39efb09bce61afd`. It is cut from `main` at `becd196` (phase 53's merge), so the earlier phases' verification commits are in its history; nothing was merged in.

## Environment

- `timone status` is a terminal command, so "production form" is the compiled CLI: `npm run build` (`tsc`), then `node dist/cli.js …`. No server to stand up. The probes run the built daemon through the probe rig (`_rig.mjs`): a fake forge, a fake model, local bare repositories. Nothing reached GitHub or a real model.
- The build from just before this phase (`becd196`, the merge-base with `main`) was compiled outside the tree by `_old-build.mjs`, as the break leg of PRD-02.R9 parts 4 and 5. It was used only as a probe's broken setup, never to compare test results.
- Order: the PRD-02.R9 probe with its break run; then the regression set, real runs only, in parallel (`run.mjs --regression --only=…`); then the build-health smoke once. The probes share no state, so the order mattered only for load.
- **Build-health smoke**, run once and not as evidence: `npm run build && npx tsc --noEmit && npx vitest run --reporter=json` — `tsc` exit 0; 76 test files, 1984 tests: **1914 passed, 70 failed**, 8.0 s. Every one of the 70 failure messages contains the container's push refusal (*"Refused: this run may push only to …"*): 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. This is the container refusing a push to `main` inside the tests' own scratch repositories (Timone issue #220), not a fault of this work.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-53-verification.md` on `main` (lines 17–87, its named list of 70). All 70 failures here are named there, so all 70 are **old**. No test that failed there passes here, and no test fails here that did not fail there. The runner asked to confirm the same tests fail on `main`; the check's rules forbid checking out or running the default branch to compare, so `main`'s suite was not run, and this comparison with the last named list stands in for it. The list, for the next pass:
  - `src/numbers.test.ts > reserveNumber gives the first phase number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first adr number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first triage number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first prd number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the phase after the highest on the default branch, not counting the reports folder` — old
  - `src/numbers.test.ts > reserveNumber counts a PRD and its criteria register as one number` — old
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only on another branch, pushed after the checkout was cloned` — old
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only in the checkout's folder, not committed` — old
  - `src/numbers.test.ts > reserveNumber counts a number another session reserved, and only reservations of the same kind` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a phase number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a adr number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a triage number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives two reservations from one checkout, in the same second and with the same note, two different numbers` — old
  - `src/numbers.test.ts > reserveNumber leaves the checkout as it was: same branch, same status, and no local ref to the reservation` — old
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when the remote does not exist` — old
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when a pre-push hook refuses` — old
  - `src/workspace.test.ts > syncWorkspace clones a missing project on first sync` — old
  - `src/workspace.test.ts > syncWorkspace reports up-to-date when the upstream has not moved` — old
  - `src/workspace.test.ts > syncWorkspace fast-forwards and reports updated when the upstream gains a commit` — old
  - `src/workspace.test.ts > syncWorkspace skips a dirty checkout without touching it` — old
  - `src/workspace.test.ts > syncWorkspace skips a checkout on a non-default branch` — old
  - `src/workspace.test.ts > syncWorkspace fails a plain non-git directory but still processes the others` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes says nothing about a tool call that touches no probe` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes refuses a build run the probe directory` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes lets the verification run that owns them through` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes asks when no run drove the session, because a human is at the keyboard` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) lets a session that declared the checking step through` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) refuses the probes to a session that declared a building step` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) still asks when the session has no run and declared no step` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) goes by the ledger when the session has a run, whatever it declared` — old
  - `src/commands/guardrails.test.ts > finding the run that drove a session resolves the session id against the ledger` — old
  - `src/commands/guardrails.test.ts > finding the run that drove a session finds nobody for a session no run ever claimed` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is the box's declaration when the ledger has no run for the session` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is the ledger's run when the ledger has one, whatever the environment says` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is nobody's when neither the ledger nor the environment names a run` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as a person's own session when nothing names a run` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git push --no-verify origin x`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git -c core.hooksPath=/tmp/h push`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `GIT_CONFIG_COUNT=0 git push`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git push origin timone/39-x`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git commit --no-verify -m x`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push --no-verify origin x` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push origin timone/39-x` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git commit --no-verify -m x` in a person's own session` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove asks the session first, then flags the run — and posts on no ticket` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove stops flagging once the session has fixed what it was told` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove says nothing anywhere when the session behaved` — old
  - `src/commands/guardrails.test.ts > a session a human drove prints the finding and journals it, and posts on no ticket at all` — old
  - `src/commands/guardrails.test.ts > a session a human drove says nothing when the session behaved` — old
  - `src/commands/guardrails.test.ts > a session a human drove does not judge Timone's own work against a project it never had` — old
  - `src/commands/guardrails.test.ts > a session a human drove catches a project's work branch cut at the timone root — finding 11, on real git` — old
  - `src/commands/guardrails.test.ts > a session a human drove goes round exactly once, however many turns the session takes` — old
  - `src/commands/guardrails.test.ts > a session with no baseline says so rather than passing silently` — old
  - `src/commands/guardrails.test.ts > the journal appends one line per finding, and creates the file` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits accepts a trailed commit and flags an untrailed one` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits flags a commit that carries no trailer at all` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits tells the session its own id and what it owes, at SessionStart` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the unpushed rule, and do not inflate its count` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the STATUS.md placement rule` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the path-containment rule — the 14g accusation itself` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the provenance rule` — old
  - `src/commands/guardrails.test.ts > commits another session made are still judged when they name no session at all — the fix's known limit` — old
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits says nothing about a status file the work branch took from main` — old
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits still says so about a status file that exists only on a branch` — old
  - `src/commands/number.test.ts > timone number prints only the reserved number, padded, and exits 0` — old
  - `src/commands/number.test.ts > timone number names the projects it knows, and exits 1, for a project it does not know` — old
  - `src/commands/number.test.ts > timone number prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails` — old
- **Smoke against probes.** The 45 failures in `guardrails.test.ts` are about the push guard and the probe guard, which PRD-05.R3's probe checks and passes. They fail in their own setup, on the container's refusal, and not on the guard's behaviour, so the two instruments do not disagree. No smoke failure touches `timone status`.

## Independence declaration

Read: `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (the headings, and the R9 block whole); the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); `phase-54.md` lines 1–20 — status line, companion line, *Screens changed* line, *Requirements* header. **I also saw more of `phase-54.md` than the allowed list permits:** a search for header lines printed about fifteen matching lines of its *Goal Description* and sub-phase body (lines 23–58: where the fault sat in `src/commands/status.ts`, the names of the reader and functions removed, the files 54a and 54b change, and the 54a seam). I did not use it for any expectation: every check below is written from the register's sentence, and the scenario was learned by running the built daemon and reading the ledger it wrote. `reports/phase-54-complete.md` whole; lines 1–12 of `reports/phase-54-departures.md`, cut to 80 characters, to see the form of an entry and append one; in `phase-53-verification.md` on `main`, a list of its headings and the lines that mention the smoke (lines 15–17, 88, 92, 208), then lines 17–87 (its list of smoke failures); the line counts of `README.md`, `CONTEXT.md`, `STATUS.md`, the first 20 lines of `CONTEXT.md`, the top of `STATUS.md` and its headings; the probe directory: `run.mjs` (top), `_lib.mjs`, parts of `_rig.mjs`, `_questions.mjs`, `_steps.mjs`, `_old-build.mjs`, `prd-07.r4.mjs` (top) and `prd-02.r22.mjs` (its ledger helpers). File-name lists only: `git diff --name-only origin/main...HEAD`. `doc/standards.md` does not exist in this project. Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass.

The runner's instructions for this step asked for two things this check may not do: to confirm that a named test in the committed suite fails on `main` and passes on the branch, and to confirm that the deleted code was used only by the old rule. Both need the test suite or the source, which this check never reads. They were answered from the outside instead: PRD-02.R9 part 4 runs the same scenario on the build from before this phase (red: it names the finished ticket #51) and on the branch (green: it names nothing); part 3 shows a ticket with an open question is still named; the type check passes, the whole suite has no new failure, and every regression probe that could run passed. A departure records this.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R9 | SHOULD | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (3 clauses; clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (3 clauses; clause 1 (runner) BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |

The closing gate: every MUST criterion in scope is PASS, except PRD-05.R18, which is BLOCKED (it needs a replay against the real model, which only a logged-in terminal can run; it was BLOCKED in the same way before this phase). Zero regressions. 0 of 2 fix loops used.

## Evidence

### PRD-02.R9 — PASS

Probe `doc/plans/phases/probes/prd-02.r9.mjs`, written this pass (first probe for this criterion; it was verified by a person at phase 11). Command: `node doc/plans/phases/probes/prd-02.r9.mjs`, with its break run. It labels the register's one sentence in five parts.

What `timone status` printed, on the branch:

```
--- observed: timone status, two projects, one building
alpha  #7 (building) — working on it now on claude-opus-5-5 for 0s — $0.00 of $150.00 spent
beta   idle

**What I need from you:** nothing — nothing is waiting on you right now.

--- observed: timone status, a run parked with a question
fixture  #12 — waiting: say which colour you want, red or blue. — $0.00 of $150.00 spent

**What I need from you:** answer on fixture #12 — each ticket says what it needs.

--- observed: timone status, a finished step run, its initiative with steps left that cannot start
    ledger runs: fixture#51/1 done; initiatives: [{"initiative":50,"steps":[51,52,53],"done":0}]
fixture  idle

**What I need from you:** nothing — nothing is waiting on you right now.

--- observed: timone status, the parked question run and the finished runs in one ledger
fixture  #12 — waiting: say which colour you want, red or blue. — $0.00 of $150.00 spent

**What I need from you:** answer on fixture #12 — each ticket says what it needs.
```

Per part:

```
=== PRD-02.R9 part 1 — lists every managed project
    break leg: RED (as required) — no line for project beta: …
    green leg: PASS — assertion held
=== PRD-02.R9 part 2 — with its active ticket, current stage
    break leg: RED (as required) — alpha's line does not name its active ticket #7: "alpha idle"
    green leg: PASS — assertion held
=== PRD-02.R9 part 3 — and any gate waiting for human input — a run parked with a question is named, on its project's line and in the closing line
    break leg: RED (as required) — the closing line does not name #12, which waits on a question: "**What I need from you:** nothing — nothing is waiting on you right now."
    green leg: PASS — assertion held
=== PRD-02.R9 part 4 — a finished run is not a gate waiting for human input: it is never named, even when its initiative has steps left that cannot start
    break leg: RED (as required) — the closing line names finished run(s) #51: "**What I need from you:** answer on fixture #51 — each ticket says what it needs."
    green leg: PASS — assertion held
=== PRD-02.R9 part 5 — in one glance: with a waiting run and finished runs side by side, the closing line names exactly the waiting ticket, once
    break leg: RED (as required) — the closing line should name exactly #12, once; it names [51, 12]: "**What I need from you:** answer on fixture #51, fixture #12 — each ticket says what it needs."
    green leg: PASS — assertion held
--- PRD-02.R9: PASS (5 clause labels, 5 passing)
```

The break legs of parts 4 and 5 are the build from just before this phase, on the same ledger. They show the fault #186 reports: the old build named the finished ticket #51 as waiting on a person, and the branch does not.

**Not staged:** the completion report says a second old reading also went, a finished run whose list of pieces grew after approval. The probe does not build that state; part 4 covers the case the ticket reports.

### Regression set

Command: `node doc/plans/phases/probes/run.mjs --regression --only=PRD-05.R2,PRD-05.R3,PRD-05.R4,PRD-05.R5,PRD-05.R7,PRD-05.R10,PRD-05.R11,PRD-05.R18,PRD-07.R4,PRD-07.R6,PRD-07.R9,PRD-08.R5,PRD-09.R2,PRD-09.R4,PRD-09.R5` — real runs only, 4 min 13 s, exit 0.

```
--- PRD-05.R2: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
--- PRD-05.R3: PASS (19 clause labels, 19 passing, real run only)
--- PRD-05.R4: PASS (6 clause labels, 6 passing, real run only)
--- PRD-05.R5: PASS (6 clause labels, 6 passing, real run only)
--- PRD-05.R7: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
--- PRD-05.R10: PASS (4 clause labels, 4 passing, real run only)
--- PRD-05.R11: PASS (12 clause labels, 12 passing, real run only)
--- PRD-05.R18: BLOCKED (3 clause labels, 0 passing, 3 blocked, real run only)
--- PRD-07.R4: PASS (7 clause labels, 7 passing, real run only)
--- PRD-07.R6: PASS (4 clause labels, 4 passing, real run only)
--- PRD-07.R9: PASS (4 clause labels, 4 passing, real run only)
--- PRD-08.R5: PASS (1 clause labels, 1 passing, real run only)
--- PRD-09.R2: PASS (4 clause labels, 4 passing, real run only)
--- PRD-09.R4: PASS (8 clause labels, 8 passing, real run only)
--- PRD-09.R5: PASS (7 clause labels, 7 passing, real run only)
```

The BLOCKED clauses, as the probes printed them:

- PRD-05.R2 clause 2b — every commit on the watched run's pull requests carries its step session's `Timone-Stage` trailer: *GitHub could not be read from here (gh).*
- PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", records no approval: *needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build.*
- PRD-05.R18 clauses 1, 2a, 2b — the replay of the recorded failures: *the newest recorded replay is older than this build; a new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).*

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

No `live` criterion is in the claimed set. By the register's `Depends-on` lines, this diff (`src/daemon/poll.ts`, `src/daemon/breakdown.ts`, `src/commands/status.ts`) touches what these declare, so each owes a fresh gate:

- PRD-01.R4 — last: never. Owed (`src/daemon/`, `src/commands/`).
- PRD-02.R1 — last: `phase-32-live-gate.md`, 2026-09-04 (marked-ticket clause only). Owed (`src/daemon/`).
- PRD-02.R2, R4, R6, R7, R8 — last: never. Owed (`src/daemon/`).
- PRD-02.R13 — last: `phase-32-live-gate.md`, 2026-09-04. Owed (`src/daemon/`).
- PRD-03.R1, R5 — last: `phase-35-live-gate.md`, 2026-09-07. Owed (`src/daemon/`).
- PRD-03.R2, R4 — last: never. Owed (`src/daemon/`).
- PRD-07.R5, R7, R14 — last: never. Owed (`src/daemon/`).
- PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-08.R6 — no `Depends-on` line, so counted as touched. PRD-05.R9, R12, R13, R15 last: `phase-40-live-gate.md`, 2026-09-30; the others: never.

What this phase changed in `src/daemon/` is, by the completion report, the removal of code that only `timone status` used; the type check passed and no daemon-facing probe changed result. The rule still counts the gates as owed, because the `Depends-on` lines name the whole folder. None of this stops the phase; delivery carries the list to the pull request.

## Regression

- PRD-05.R2 — PASS (clause 2b BLOCKED: GitHub not reachable from here)
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS (clause 1, real runner, BLOCKED: needs the real model)
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — BLOCKED: needs a replay on this build against the real model
- PRD-07.R4 — PASS (in via `src/daemon/`)
- PRD-07.R6 — PASS (in via `src/daemon/`)
- PRD-07.R9 — PASS (in via `src/daemon/`)
- PRD-08.R5 — PASS
- PRD-09.R2 — PASS
- PRD-09.R4 — PASS
- PRD-09.R5 — PASS

The criteria with no `Depends-on` line (all of PRD-05's above, PRD-08.R5, PRD-09.R2, R4, R5) are in by default.

What the narrowing removed (MUST + `api` + `verified`, none of whose `Depends-on` prefixes this diff touches):

- PRD-01.R2 — `src/manifest.ts`, `src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts`, `src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R1 — `src/daemon/runs.ts`, `src/runner/`
- PRD-07.R2 — `src/daemon/runs.ts`, `src/runner/`, `src/manifest.ts`
- PRD-07.R3 — `src/daemon/runs.ts`, `src/runner/driver.ts`
- PRD-07.R10 — `.claude/skills/timone-plan/`, `src/adapters/github-tickets.ts`, `src/runner/`
- PRD-07.R12 — `process.md`, `doc/adr/`, `doc/specs/prd/`, `src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts`, `src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts`, `src/adapters/`, `src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts`, `src/adapters/`, `src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts`, `src/runner/actions.ts`, `src/adapters/`

## Probes

**5 clause checks proven able to fail this pass, 0 not.** One probe file was written this pass; 15 ran from the directory.

- `prd-02.r9.mjs` — written this pass (first probe for PRD-02.R9; before, a person checked it at phase 11). Break run done: all 5 parts went red on the broken setup, then green. Parts 4 and 5 break on the build of `becd196`.
- Ran without a break run this pass (real run only; each was proved able to fail by an earlier pass): PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R4, PRD-07.R6, PRD-07.R9, PRD-08.R5, PRD-09.R2, PRD-09.R4, PRD-09.R5.
- None is in doubt: no smoke failure disagrees with a probe (see *Smoke against probes*).
- Clause coverage: PRD-02.R9's register text is one sentence; the probe prints a label for each of its five parts. For each regression criterion, the register's GIVEN clauses were counted (by script) and compared with the clause numbers its probe printed. Every clause has a label. PRD-05.R11 counts four GIVENs and prints clauses 1 to 3: the fourth GIVEN is the old wording quoted in a note ("It said 'GIVEN any run'"), not a clause. No gap was found.

## Fix-loop accounting

0 of 2 — the initial pass was clean. No defect brief was issued.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none` — `timone status` prints to a terminal).

## Questions for the human

None.

## Register changes

- PRD-02.R9 — `Status` stays `verified`. A dated `✏` marker was added naming this report and the probe that now checks it.
- No other line changed. BLOCKED clauses change nothing.

## Carried forward

- PRD-05.R18 BLOCKED, and the real-runner clause of PRD-05.R7: both need the replay against the real model on this build (`npm run --silent replay`, from a logged-in terminal). PRD-05.R2 clause 2b BLOCKED: GitHub is not reachable from this container. These were BLOCKED the same way before this phase.
- Fresh live gates are owed for the `live` criteria listed under *Live gates*.
- The departures record, [`phase-54-departures.md`](phase-54-departures.md), has an entry for these and one for the runner's two requests this check could not carry out.
