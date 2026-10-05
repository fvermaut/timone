# Phase 53 — Verification Report

- **Date:** 2026-10-05
- **Phase:** [phase-53.md](../phase-53.md) — stamped `Complete`, completion report [phase-53-complete.md](phase-53-complete.md)
- **Scope:** PRD-09.R1, PRD-09.R2, PRD-09.R3 (MUST), and PRD-09.R5 clause 1 (MUST; its clauses 2 and 3 were phase 51's and are re-run here because the probe gained clause 1). Cross-checked against the completion report's requirements line: the same four.
- **Live gate owed:** yes. This diff touches `src/daemon/`, `src/runner/`, `process.md` and twelve skills under `.claude/skills/`, which nearly every `live` criterion declares it depends on — see *Live gates*. The completion report's own owed check is one of them: on scratch-app, with the daemon running, one question posted by the runner and one posted by a step, each with the sentence and the exact command, and the command copied into a terminal opening the session.
- **Regression set (derived):** 25 criteria are MUST + `api` + `verified` at this HEAD; narrowed by `Depends-on` to 20: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R4.
- **Branch:** `timone/218-2-every-question-names-the-command` @ `4271983` (the phase is not stacked: its merge-base with `main` is `3d7c360`, and nothing was merged in).

## Environment

- Timone is a command-line program with no production server. "Production form" is the compiled build: `npm run build` (exit 0), then every probe runs the built `dist/cli.js`. `npx tsc --noEmit` exit 0.
- Probes run the built daemon through the verifier's rig (`doc/plans/phases/probes/_rig.mjs`): a fake GitHub behind `gh`, a fake model service on 127.0.0.1, steps in-process. Nothing reached GitHub or a real model.
- Break legs that need the build before this phase use `_old-build.mjs` with `3d7c360` (the branch's merge-base with `main`), built outside the tree.
- Order: the regression set (real runs only, in parallel, with the new `--only` option of `run.mjs`); experiments with the build to learn what it shows its fake model and forge; the four PRD-09 probes, each with its break run; the build-health smoke; PRD-05.R3 alone, with its break run (see *Smoke against probes*). Probes share no state, so the order mattered only for load.
- **Build-health smoke**, run once and not as evidence: `npm run build && npx tsc --noEmit && npx vitest run --reporter=json` — `tsc` exit 0; 76 test files, 1984 tests: **1914 passed, 70 failed**, 10.0 s. Every one of the 70 failure messages contains the container's push refusal (*"Refused: this run may push only to `timone/218-2-every-question-names-the-command`, and this push goes to `refs/heads/main`…"*), counted from the JSON report: 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. None fails on anything else. This is the container's guard refusing a push to `main` inside the tests' own scratch repositories (known Timone issue #220), not a fault of this work.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-51-verification.md` on `main` (lines 16–17). That report counted its 70 failures by file (45, 16, 6, 3, the same four files) and said each carried the same refusal, but did not name the tests. So there is no named list to compare with, and the failures below are unmarked. What can be said: the files and the count per file are identical, and every failure here fails on the refusal in the test's own setup. No test fails on anything else. The runner asked me to confirm the failing set is the same on `main`; the check's rules forbid checking out, building or running the default branch to compare, so `main` was not run. The 70, named so the next pass has a list:
  - `src/numbers.test.ts > reserveNumber gives the first phase number, padded, to a project with none`
  - `src/numbers.test.ts > reserveNumber gives the first adr number, padded, to a project with none`
  - `src/numbers.test.ts > reserveNumber gives the first triage number, padded, to a project with none`
  - `src/numbers.test.ts > reserveNumber gives the first prd number, padded, to a project with none`
  - `src/numbers.test.ts > reserveNumber gives the phase after the highest on the default branch, not counting the reports folder`
  - `src/numbers.test.ts > reserveNumber counts a PRD and its criteria register as one number`
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only on another branch, pushed after the checkout was cloned`
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only in the checkout's folder, not committed`
  - `src/numbers.test.ts > reserveNumber counts a number another session reserved, and only reservations of the same kind`
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a phase number at once five different numbers, each reserved on the remote`
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a adr number at once five different numbers, each reserved on the remote`
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a triage number at once five different numbers, each reserved on the remote`
  - `src/numbers.test.ts > reserveNumber gives two reservations from one checkout, in the same second and with the same note, two different numbers`
  - `src/numbers.test.ts > reserveNumber leaves the checkout as it was: same branch, same status, and no local ref to the reservation`
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when the remote does not exist`
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when a pre-push hook refuses`
  - `src/workspace.test.ts > syncWorkspace clones a missing project on first sync`
  - `src/workspace.test.ts > syncWorkspace reports up-to-date when the upstream has not moved`
  - `src/workspace.test.ts > syncWorkspace fast-forwards and reports updated when the upstream gains a commit`
  - `src/workspace.test.ts > syncWorkspace skips a dirty checkout without touching it`
  - `src/workspace.test.ts > syncWorkspace skips a checkout on a non-default branch`
  - `src/workspace.test.ts > syncWorkspace fails a plain non-git directory but still processes the others`
  - `src/commands/guardrails.test.ts > guarding the verifier's probes says nothing about a tool call that touches no probe`
  - `src/commands/guardrails.test.ts > guarding the verifier's probes refuses a build run the probe directory`
  - `src/commands/guardrails.test.ts > guarding the verifier's probes lets the verification run that owns them through`
  - `src/commands/guardrails.test.ts > guarding the verifier's probes asks when no run drove the session, because a human is at the keyboard`
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) lets a session that declared the checking step through`
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) refuses the probes to a session that declared a building step`
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) still asks when the session has no run and declared no step`
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) goes by the ledger when the session has a run, whatever it declared`
  - `src/commands/guardrails.test.ts > finding the run that drove a session resolves the session id against the ledger`
  - `src/commands/guardrails.test.ts > finding the run that drove a session finds nobody for a session no run ever claimed`
  - `src/commands/guardrails.test.ts > the run a session belongs to is the box's declaration when the ledger has no run for the session`
  - `src/commands/guardrails.test.ts > the run a session belongs to is the ledger's run when the ledger has one, whatever the environment says`
  - `src/commands/guardrails.test.ts > the run a session belongs to is nobody's when neither the ledger nor the environment names a run`
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as a person's own session when nothing names a run`
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2`
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git push --no-verify origin x``
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git -c core.hooksPath=/tmp/h push``
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `GIT_CONFIG_COUNT=0 git push``
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git push origin timone/39-x``
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git commit --no-verify -m x``
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push --no-verify origin x` in a person's own session`
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session`
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session`
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push origin timone/39-x` in a person's own session`
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git commit --no-verify -m x` in a person's own session`
  - `src/commands/guardrails.test.ts > a session the daemon drove asks the session first, then flags the run — and posts on no ticket`
  - `src/commands/guardrails.test.ts > a session the daemon drove stops flagging once the session has fixed what it was told`
  - `src/commands/guardrails.test.ts > a session the daemon drove says nothing anywhere when the session behaved`
  - `src/commands/guardrails.test.ts > a session a human drove prints the finding and journals it, and posts on no ticket at all`
  - `src/commands/guardrails.test.ts > a session a human drove says nothing when the session behaved`
  - `src/commands/guardrails.test.ts > a session a human drove does not judge Timone's own work against a project it never had`
  - `src/commands/guardrails.test.ts > a session a human drove catches a project's work branch cut at the timone root — finding 11, on real git`
  - `src/commands/guardrails.test.ts > a session a human drove goes round exactly once, however many turns the session takes`
  - `src/commands/guardrails.test.ts > a session with no baseline says so rather than passing silently`
  - `src/commands/guardrails.test.ts > the journal appends one line per finding, and creates the file`
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits accepts a trailed commit and flags an untrailed one`
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits flags a commit that carries no trailer at all`
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits tells the session its own id and what it owes, at SessionStart`
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the unpushed rule, and do not inflate its count`
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the STATUS.md placement rule`
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the path-containment rule — the 14g accusation itself`
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the provenance rule`
  - `src/commands/guardrails.test.ts > commits another session made are still judged when they name no session at all — the fix's known limit`
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits says nothing about a status file the work branch took from main`
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits still says so about a status file that exists only on a branch`
  - `src/commands/number.test.ts > timone number prints only the reserved number, padded, and exits 0`
  - `src/commands/number.test.ts > timone number names the projects it knows, and exits 1, for a project it does not know`
  - `src/commands/number.test.ts > timone number prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails`
- **Smoke against probes.** The 45 failures in `guardrails.test.ts` are about the push guard, which PRD-05.R3's probe checks and passes. They fail in their own setup, on the container's refusal, and not on the guard's behaviour, so the two do not disagree. To leave no doubt, PRD-05.R3's probe was run once more with its break run: all 19 clauses went red on their break leg, then green (`--- PRD-05.R3: PASS (19 clause labels, 19 passing)`).

## Independence declaration

Read: `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md` and its PRD narrative; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); `phase-53.md` lines 1 to 24 — this took in its status line, companion line, *Screens changed* line and *Requirements* header, **and also the first paragraph of its *Goal Description***, which names where some of the build's code lives; I did not use it for any expectation, and every check below is written from the register's words; `reports/phase-53-complete.md` whole; lines 1 to 11 of `reports/phase-53-departures.md`, cut to 80 characters, to see the form of an entry and append one; in `phase-51-verification.md` on `main`, a list of its headings and lines 14 to 17 of its *Environment* section (the smoke line and its list); `README.md` (not opened beyond its size); `CONTEXT.md`; `package.json`; the top of `STATUS.md` and its headings; `process.md`'s paragraphs on *What I need from you*, on `timone takeover`, and the rule in *Writing to the human* that this phase added (lines 140–147 and 188–206); the step skills' lines that name `timone takeover`, *What I need from you* or asking (by search), and `timone-triage` lines 62–78, `timone-deliver` lines 186–200, `timone-update` line 11 and its lines on asking; the probe directory. File-name lists only: `git diff --name-only origin/main...HEAD`. `doc/standards.md` does not exist in this project. Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. What the probes lean on about the build — the post action's options, the step names, the wording of the runner's wakes — was learned by running the built daemon and reading what it sent its fake model and its fake forge.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-09.R1 | MUST | api | BLOCKED in part — 7 of 8 checks PASS; the real runner's choice not observed | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R3 | MUST | api | BLOCKED in part — 9 of 12 checks PASS; the real runner's choice not observed, once per clause | 0 |
| PRD-09.R5 | MUST | api | PASS (clause 1 this phase; clauses 2 and 3 re-run) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED, as before: GitHub cannot be read from here) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; its real-runner clause BLOCKED: needs a real model) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | BLOCKED (regression) — the recorded replay against the real model is older than this build | 0 |
| PRD-07.R1 | MUST | api | PASS (regression) | 0 |
| PRD-07.R2 | MUST | api | PASS (regression) | 0 |
| PRD-07.R3 | MUST | api | PASS (regression) | 0 |
| PRD-07.R4 | MUST | api | PASS (regression) | 0 |
| PRD-07.R6 | MUST | api | PASS (regression) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |
| PRD-07.R12 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2 | MUST | api | PASS (regression) | 0 |
| PRD-08.R4 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R4 | MUST | api | PASS (regression) | 0 |

**The gate is not met.** No check failed, and there is no regression. But three MUST criteria are BLOCKED in whole or in part, all for one reason: what the **real** runner chooses can only be seen by the replay against the real model (`npm run --silent replay`), which cannot run here, and the newest recorded replay (run 10, at `4686ef4`) is not in this branch's history. This phase changed the runner's instructions, so that replay is owed on this build in any case (PRD-05.R18 clause 2).

## Evidence

All four PRD-09 probes were authored this pass (first check of R1, R2 and R3; R5's probe gained clause 1) and each was run with its break run first. Every break leg went red, every green leg passed.

### PRD-09.R1 — BLOCKED in part (7 PASS, 1 BLOCKED)

Probe: `node doc/plans/phases/probes/prd-09.r1.mjs` (48 s). The project is `fixture` in `timone.yaml`, the ticket #12, its pull request #100.

- **Clause 1 (the runner's post action) — PASS.** The runner posted `PROBE-R1 ticket: which colour should the count be? … **What I need from you:** say red or blue (ticket).` What reached the ticket:
  > PROBE-R1 ticket: which colour should the count be?
  >
  > You can answer here in writing, or in your terminal by running `timone takeover fixture#12`.
  >
  > **What I need from you:** say red or blue (ticket).

  Break leg (the build before phase 53): red — "the question does not contain `timone takeover fixture#12`".
- **Clause 2 (the runner's post action) — PASS.** On pull request #100 the same sentence, with `timone takeover fixture#12` — the ticket's number, not `fixture#100`. Break leg (before phase 53): red, no command.
- **Clause 1 and 3 (a step's own comment) — PASS.** A step posts from its own model session, which a fake model cannot stand for, so as the register's hint says this is judged on what each step is told. Each of the 12 steps that can start (triage, clarification, wayfinding, research, requirements, breakdown, planning, execution, verification, delivery, remediation, update) is told, word for word: *"You can answer here in writing, or in your terminal by running `timone takeover fixture#12`."*, to put it just above the closing line when a comment asks for something. `charting` starts no session ("it has no instructions of its own"). Break leg (before phase 53): red — execution and delivery are given no command.
- **Clause 2 (the pull request's description) — PASS.** The delivery step is told: *"When the pull request's *Questions for you* section holds a question, end that section with this sentence, on its own line: You can answer here in writing, or in your terminal by running `timone takeover fixture#12`."* Break leg: red — before phase 53 the delivery step is told nothing about that section.
- **Clause 3 (the spending limit notice, a step passes the limit) — PASS.** The notice: *"**This ticket has reached its spending limit.** It has cost $160.00, and the limit is $150.00. … You can answer here in writing, or in your terminal by running `timone takeover fixture#12`. **What I need from you:** reply "continue" to allow another $150.00, or say nothing and it stays stopped."* Break leg (before phase 53): red.
- **Clause 3 (the spending limit notice, a new run already over its limit) — PASS.** A ticket whose record already held $160 of cost was picked up; no runner session started, and the same notice, with the command, was posted. Break leg: the same notice with the command taken out — red.
- **Clause 3 (the notice that the approved pieces could not be acted on) — PASS.** An approved list of three pieces, with GitHub refusing `gh issue create` (HTTP 403): *"**I could not open a ticket for each piece.** … You can answer here in writing, or in your terminal by running `timone takeover fixture#12`. **What I need from you:** reply here to say what to do next. …"* No other command is named. Break leg (before phase 53): red.
- **Clause 1 and 2 (the real runner) — BLOCKED.** Whether the real runner leaves the command in (does not mark a case of R3) when none applies is a model's choice; its instrument is replay case #218 *"a pull request closed with no reason"*. Needs a real model: the newest recorded replay is older than this build. The same case passes with the scripted runner (`npm run --silent replay -- --dry`: 22 of 22), which shows the case exists and is judged, not what the model does.

### PRD-09.R2 — PASS

Probe: `node doc/plans/phases/probes/prd-09.r2.mjs`.

- **Clause 1a — PASS**, **1b — PASS**, **1c — PASS.** Read on the eight questions above (the runner's on the ticket and on the pull request, both limit notices, the pieces notice, and the sentence the triage, building and delivery steps are told). In each, the only code span naming the takeover is exactly `` `timone takeover fixture#12` ``: one pair of backticks, nothing else inside, the project's name as `timone.yaml` gives it and the ticket's number. Break legs: 1a, the build before phase 53 — red (no code span with the command); 1b, the same questions with `--now` added inside the span — red; 1c, the same questions with `<project>#<n>`, then with `fixture#100` — red on both.
- **Clause 2 — PASS.** After the runner's question, `timone status` showed, on this build and on the build before phase 53, the identical line: *"fixture  #12 — waiting: say whether the count goes above the list or below it. — $0.00 of $150.00 spent"*. With a 280-character ask (which a command added to the last line would push past the 300-character limit the register's hint names) both builds showed the ask, and the lines were identical. Break leg: a 320-character ask — status shows *"waiting: the next thing that happens on this ticket"* instead, and the check went red. So the sentence is added above the last line and the last line is left as the runner wrote it.

### PRD-09.R3 — BLOCKED in part (9 PASS, 3 BLOCKED)

Probe: `node doc/plans/phases/probes/prd-09.r3.mjs`. Which of the three cases a question is, is a judgement only the model can make; code cannot tell a key request or an unsettled session from any other question. The build's post action takes a `leaveOutTakeover` field (missing-key, approval-word, terminal-did-not-settle-it), seen in the schema the model is sent. Each clause is checked in four parts.

- **Clause 1, a missing key.** (code) **PASS**: a key request marked `missing-key` was posted with no `timone takeover`; a marked request that said *"A terminal session with `timone takeover` will not help here"* was refused, and so was one naming `timone takeover fixture#12` — *"Refused: This question leaves the takeover command out. Remove it, and post again."* Break leg: the same request not marked — red, the command was added. (runner told) **PASS**: the runner is told to ask for the key in `.timone/env/<project>.env`, *"Do not write the takeover command in that comment, not even to say that it will not help. … set leaveOutTakeover to "missing-key"."* Break leg (before phase 53): red. (steps told) **PASS**: every step is told *"Leave the sentence out, and write `timone takeover` nowhere in the comment, in three cases: when you ask for a missing key or secret; …"*. Break leg: red. (real runner) **BLOCKED**: needs a real model.
- **Clause 2, a misspelled approval word.** (code) **PASS**: marked `approval-word`, no command; not marked — red. (runner told) **PASS**, break red. (steps told) **PASS**, break red. (real runner) **BLOCKED**: replay case #218 *"the misspelled approval word"* needs a real model; it passes with the scripted runner only.
- **Clause 3, after a terminal session.** A stand-in terminal opened with `timone takeover fixture#12` and ended; the runner was woken with *"The terminal session ended."* (code) **PASS**: its question, marked `terminal-did-not-settle-it`, holds no command; not marked — red, the command was added. The terminal session itself is told *"Do not write the takeover command in what you post here"*. (runner told) **PASS**, break red. (steps told) **PASS**, break red. (real runner) **BLOCKED**: whether the real runner marks the question and *"says what is actually needed"* is replay case #120's, and needs a real model.

### PRD-09.R5 — PASS

Probe: `node doc/plans/phases/probes/prd-09.r5.mjs`, run whole with its break run.

- **Clause 1 (process.md) — PASS.** The paragraph *"Every message ends with the line What I need from you"* now ends: *"a message that asks for something also names `timone takeover` for its ticket, just above that line, except in three cases, as Writing to the human says."* *Writing to the human* holds the rule, the sentence with `timone takeover <project>#<n>`, and the three cases (a missing key or secret; whether a misspelled word meant approve; right after a terminal session that did not settle things). Break leg: `process.md` at `3d7c360` — red.
- **Clause 1 (the runner's instructions) — PASS.** As the runner receives them: *"A question tells the reader they can also answer in a terminal, with `timone takeover` and this ticket. When you post a question, the machine adds the sentence that says so. Do not write it yourself. Leave it out only in three cases, by setting leaveOutTakeover: …"*. Break leg: the build before phase 53 — red.
- **Clause 1 (the step skills) — PASS.** Twelve skills tell the machine how to write to a person, and each says a question names `timone takeover <project>#<n>` with this project and ticket, except in the three cases (`timone-triage` and `timone-deliver` carry the sentence in their templates; the others point at *Writing to the human*). `timone-update` is judged not to be such a place: its only rule on asking is *"Ask nobody anything … Do not post a comment that asks for anything."* Break leg: the skills at `3d7c360` — red for all twelve.
- **Clauses 2 and 3 — PASS**, as in phase 51: the paragraph on `timone takeover` says a takeover typed while a step runs waits, then opens; no line in `process.md`, the 14 skill files or the runner's instructions says a takeover refuses while a step of its own ticket runs. Each break leg red.

### Known open points from the completion report, not checked

The completion report lists three observations no requirement covers: a runner post holding the right command and also a wrong one; the sentence possibly appearing twice in a pull request with questions in two sections; two out-of-date counts in comments. No register clause decides them, so no verdict is given.

## HUMAN-CHECK scripts

No criterion in scope is on the `human` channel, and none of its clauses needed a person.

## Live gates

No claimed criterion is on the `live` channel. The diff touches what almost every `live` criterion of the registers depends on, so each of these owes a fresh live gate (its last gate in brackets): PRD-01.R4, R5, R8, R9, R10, R11, R12, R13, R15, R17 (never); PRD-02.R1 (phase-32-live-gate.md), R2, R4, R6, R7, R8 (never), R13 (phase-32-live-gate.md); PRD-03.R1, R3, R5 (phase-35-live-gate.md), R2, R4 (never); PRD-04.R1 (no `Last live gate` line); PRD-05.R9, R12, R13, R15 (phase-40-live-gate.md); PRD-06.R1, R2, R3, R4 (never); PRD-07.R5, R7, R14 (never); PRD-08.R6 (no `Last live gate` line). Not owed: PRD-01.R20 (depends on `standards/baseline/`, untouched). PRD-04.R7 is deprecated. The concrete check this phase owes is the completion report's: on scratch-app with the daemon running, one question posted by the runner and one by a step, each with the sentence and the exact command, and the command copied into a terminal opens the session.

## Regression

Run with `node doc/plans/phases/probes/run.mjs --only=<the 20 IDs>`, real runs only:

- PASS: PRD-05.R2 (clause 2b BLOCKED: GitHub cannot be read from here), PRD-05.R3, R4, R5, R7 (its real-runner clause BLOCKED: needs a real model), R10, R11; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R4.
- BLOCKED: PRD-05.R18 — all three clauses: the recorded replay is older than this build, and no replay on this build is recorded.

19 passing, 0 failing, 1 blocked. No regression.

What the narrowing removed (the `Depends-on` prefixes, none touched by this diff):

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`

## Probes

**24 probes proven able to fail, 0 not** — the 4 PRD-09 probes, run with their break run this pass, and the 20 regression probes, proved by earlier passes (PRD-05.R3 also again this pass). No probe in scope lacks a break step.

- Authored this pass, first check of the criterion, break run done (all red, then green): `prd-09.r1.mjs`, `prd-09.r2.mjs`, `prd-09.r3.mjs`, with a shared helper `_questions.mjs`.
- Extended this pass, break run done: `prd-09.r5.mjs` — clause 1 added (it was printed as "not checked" for phase 51). The whole probe ran with its break run.
- Run again with its break run: `prd-05.r3.mjs` (smoke against probes, above).
- Ran without a break run this pass (real runs only, proved by earlier passes): PRD-05.R2, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R4. (PRD-05.R3 also ran real-only in the regression run, then again with its break run.)
- Instruments changed: `run.mjs` gains `--only=ID,ID`, to run just the narrowed set; `_fake-gh.cjs` accepts `{ pattern, message }` in `failCalls`, to fail with GitHub's own words (HTTP 403).
- Clause coverage: R1 has 3 clauses, its probe prints labels for all 3 (some clauses split by way of posting); R2 has 2 clauses (4 THEN/AND lines), 4 labels; R3 has 3 clauses, 12 labels; R5 has 3 clauses, 7 labels. No gap.

## Fix-loop accounting

0 of 2 — no check failed, so no defect brief was issued. The BLOCKED parts are not failures and consume no loop.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none`).

## Questions for the human

None.

## Register changes

- PRD-09.R2: `draft` → `verified`. A `Falsified-by:` line names this probe, and an `Evidence:` line links this report.
- PRD-09.R5: `draft` → `verified`. Clause 1 passed this pass, and clauses 2 and 3 passed again. A dated `Evidence:` line and a `Falsified-by:` line are added.
- PRD-09.R1: stays `draft`. Dated partial-evidence line: 7 of 8 checks pass; the real runner's choice is not observed.
- PRD-09.R3: stays `draft`. Dated partial-evidence line: the code and the instructions pass for all three clauses; the real runner's choice is not observed for any of them.

## Carried forward

- **PRD-09.R1 (the real runner) and PRD-09.R3 (the real runner, all three clauses): BLOCKED.** They need the replay against the real model on this build. The replay's cases for #218 (twice) and #120 are its instrument. They pass with the scripted runner only.
- **PRD-05.R18: BLOCKED**, for the same reason. This phase changed the runner's instructions, so its clause 2 owes a replay on this build, with the result on the pull request.
- One entry for these is appended to [`phase-53-departures.md`](phase-53-departures.md).
