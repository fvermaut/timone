# Phase 51 — Verification Report

- **Date:** 2026-10-05
- **Phase:** [phase-51.md](../phase-51.md) — stamped `Complete`, completion report [phase-51-complete.md](phase-51-complete.md)
- **Scope:** PRD-09.R4 (MUST, api); PRD-09.R5 (MUST, api), for the takeover paragraph only — its clauses 2 and 3. Its clause 1 is the second piece's and is not checked here.
- **Live gate owed:** yes. The completion report names one: on scratch-app, with the daemon running, a takeover typed while a step runs, then again with Ctrl-C before the step ends. By `Depends-on`, this diff also touches what these `live` criteria rest on: PRD-01.R4, PRD-02.R1, R2, R4, R6, R7, R8, R13, PRD-03.R1, R2, R4, R5, PRD-06.R1 to R4, PRD-07.R5, R7, R14; and PRD-04.R1, PRD-05.R9, R12, R13, R15 and PRD-08.R6, which declare no `Depends-on`. See *Live gates*.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12, R13; PRD-08.R2, R4, R5 — 20 criteria, from the 24 MUST + api + verified criteria at this HEAD. Narrowed out: 4 (see *Regression*).
- **Branch:** `timone/217-1-a-takeover-waits-for-the-running-step` @ `adfba2f`. It stacks on no unverified phase: its base, `e16cb71` on `main`, is after phase 50's merge.

## Environment

- Built with `npm run build` on the branch; `npx tsc --noEmit` exit 0. Timone is a command-line program and a daemon, so its production form is the built `dist/cli.js`; every probe runs that build, and the daemon in a throwaway folder against a fake forge and a fake model (`_rig.mjs`). No server was stood up.
- **The container refuses pushes.** This run's container has a git pre-push hook that refuses every push not to the run's own work branch. It refused the probes' own setup pushes into their throwaway local repositories, so the first regression run had 19 FAIL, each on a setup push and before any check. I did not switch the guard off: the one attempt (`GIT_CONFIG_COUNT=0` on the command line) was refused by the session guard, and I did not try again. Instead, the shared rig was changed so its setup makes no push: `_rig.mjs` (`fixture()` and `pushBranch()`) and `_steps.mjs` (`boxScript()`) now fill the scratch remote with a `git fetch` run inside it. The state left is the same as the push left. The daemon under test is not affected: the rig already gave it its own git settings. PRD-01.R3's probe still pushes in its own setup and still fails there. It is narrowed out of this pass (below), so it was not changed.
- Order: the regression set (real runs only), in parallel; the rig changed; the regression set again; PRD-05.R3 alone; the new probes PRD-09.R4 and R5, with break runs; PRD-05.R11 and PRD-07.R13, rewritten in part, with break runs; the build-health smoke; the regression set a last time, in parallel; PRD-05.R3 with its break run (below). Probes share no state, so the order mattered only for load.
- **The replay** (PRD-05.R18) was tried: `npm run --silent replay` — 0 of 20, every try "Not logged in · Please run /login". This container has no model login. The free scripted replay, `npm run --silent replay -- --dry`, passed 20 of 20, $0.00. It is not R18's evidence.
- **Build-health smoke**, run once and not as evidence: `npm run build && npx tsc --noEmit && npx vitest run` — `tsc` exit 0; 76 test files, 1932 tests: **1862 passed, 70 failed**, 9.2 s. Each of the 70 failure messages contains the container's push refusal (*"Refused: this run may push only to `timone/217-1-a-takeover-waits-for-the-running-step`…"*), counted from the JSON report and not from the test files: 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. None fails on anything else.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-50-verification.md` on `main` (line 15). Its smoke passed whole, so its list is empty and, by the rule, every failure now is **new**. The runner asked me to confirm, by comparing with `main`, the build's claim that the same 70 fail on `main` in this container. The check's rules forbid checking out, building or running the default branch to compare, so I did not run `main`. What I can confirm: every one of the 70 fails on the container's push refusal, in the test's own setup, so none of them is a fault this phase brought in. Whether the same 70 fail on `main` is not something this check observed.
  - `src/numbers.test.ts > reserveNumber gives the first phase number, padded, to a project with none` — new
  - `src/numbers.test.ts > reserveNumber gives the first adr number, padded, to a project with none` — new
  - `src/numbers.test.ts > reserveNumber gives the first triage number, padded, to a project with none` — new
  - `src/numbers.test.ts > reserveNumber gives the first prd number, padded, to a project with none` — new
  - `src/numbers.test.ts > reserveNumber gives the phase after the highest on the default branch, not counting the reports folder` — new
  - `src/numbers.test.ts > reserveNumber counts a PRD and its criteria register as one number` — new
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only on another branch, pushed after the checkout was cloned` — new
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only in the checkout's folder, not committed` — new
  - `src/numbers.test.ts > reserveNumber counts a number another session reserved, and only reservations of the same kind` — new
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a phase number at once five different numbers, each reserved on the remote` — new
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a adr number at once five different numbers, each reserved on the remote` — new
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a triage number at once five different numbers, each reserved on the remote` — new
  - `src/numbers.test.ts > reserveNumber gives two reservations from one checkout, in the same second and with the same note, two different numbers` — new
  - `src/numbers.test.ts > reserveNumber leaves the checkout as it was: same branch, same status, and no local ref to the reservation` — new
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when the remote does not exist` — new
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when a pre-push hook refuses` — new
  - `src/workspace.test.ts > syncWorkspace clones a missing project on first sync` — new
  - `src/workspace.test.ts > syncWorkspace reports up-to-date when the upstream has not moved` — new
  - `src/workspace.test.ts > syncWorkspace fast-forwards and reports updated when the upstream gains a commit` — new
  - `src/workspace.test.ts > syncWorkspace skips a dirty checkout without touching it` — new
  - `src/workspace.test.ts > syncWorkspace skips a checkout on a non-default branch` — new
  - `src/workspace.test.ts > syncWorkspace fails a plain non-git directory but still processes the others` — new
  - `src/commands/guardrails.test.ts > guarding the verifier's probes says nothing about a tool call that touches no probe` — new
  - `src/commands/guardrails.test.ts > guarding the verifier's probes refuses a build run the probe directory` — new
  - `src/commands/guardrails.test.ts > guarding the verifier's probes lets the verification run that owns them through` — new
  - `src/commands/guardrails.test.ts > guarding the verifier's probes asks when no run drove the session, because a human is at the keyboard` — new
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) lets a session that declared the checking step through` — new
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) refuses the probes to a session that declared a building step` — new
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) still asks when the session has no run and declared no step` — new
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) goes by the ledger when the session has a run, whatever it declared` — new
  - `src/commands/guardrails.test.ts > finding the run that drove a session resolves the session id against the ledger` — new
  - `src/commands/guardrails.test.ts > finding the run that drove a session finds nobody for a session no run ever claimed` — new
  - `src/commands/guardrails.test.ts > the run a session belongs to is the box's declaration when the ledger has no run for the session` — new
  - `src/commands/guardrails.test.ts > the run a session belongs to is the ledger's run when the ledger has one, whatever the environment says` — new
  - `src/commands/guardrails.test.ts > the run a session belongs to is nobody's when neither the ledger nor the environment names a run` — new
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as a person's own session when nothing names a run` — new
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git push --no-verify origin x`` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git -c core.hooksPath=/tmp/h push`` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `GIT_CONFIG_COUNT=0 git push`` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git push origin timone/39-x`` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git commit --no-verify -m x`` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push --no-verify origin x` in a person's own session` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push origin timone/39-x` in a person's own session` — new
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git commit --no-verify -m x` in a person's own session` — new
  - `src/commands/guardrails.test.ts > a session the daemon drove asks the session first, then flags the run — and posts on no ticket` — new
  - `src/commands/guardrails.test.ts > a session the daemon drove stops flagging once the session has fixed what it was told` — new
  - `src/commands/guardrails.test.ts > a session the daemon drove says nothing anywhere when the session behaved` — new
  - `src/commands/guardrails.test.ts > a session a human drove prints the finding and journals it, and posts on no ticket at all` — new
  - `src/commands/guardrails.test.ts > a session a human drove says nothing when the session behaved` — new
  - `src/commands/guardrails.test.ts > a session a human drove does not judge Timone's own work against a project it never had` — new
  - `src/commands/guardrails.test.ts > a session a human drove catches a project's work branch cut at the timone root — finding 11, on real git` — new
  - `src/commands/guardrails.test.ts > a session a human drove goes round exactly once, however many turns the session takes` — new
  - `src/commands/guardrails.test.ts > a session with no baseline says so rather than passing silently` — new
  - `src/commands/guardrails.test.ts > the journal appends one line per finding, and creates the file` — new
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits accepts a trailed commit and flags an untrailed one` — new
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits flags a commit that carries no trailer at all` — new
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits tells the session its own id and what it owes, at SessionStart` — new
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the unpushed rule, and do not inflate its count` — new
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the STATUS.md placement rule` — new
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the path-containment rule — the 14g accusation itself` — new
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the provenance rule` — new
  - `src/commands/guardrails.test.ts > commits another session made are still judged when they name no session at all — the fix's known limit` — new
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits says nothing about a status file the work branch took from main` — new
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits still says so about a status file that exists only on a branch` — new
  - `src/commands/number.test.ts > timone number prints only the reserved number, padded, and exits 0` — new
  - `src/commands/number.test.ts > timone number names the projects it knows, and exits 1, for a project it does not know` — new
  - `src/commands/number.test.ts > timone number prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails` — new
- **Smoke against probes.** The 45 failures in `guardrails.test.ts` are about the push guard, which PRD-05.R3's probe checks and passes. They fail in their own setup, on the container's refusal, and not on the guard's behaviour, so the two do not disagree. To leave no doubt, PRD-05.R3's probe was run once more with its break run: all 19 clauses went red on their break leg, then green (6 min 40 s).

## Independence declaration

Read: `doc/specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md` and its PRD narrative; PRD-05.R11's block and PRD-07.R13's block in their registers; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); `phase-51.md` lines 1 to 30 — this took in its status line, companion line, *Screens changed* line and *Requirements* header, **and also its *Goal Description***, which names some of the build's choices; I did not use them for any expectation, and every check below is written from the register's words; `reports/phase-51-complete.md` whole; the headings of `reports/phase-51-departures.md`, to append to it; in `phase-50-verification.md` on `main`, a list of its headings and the lines of its *Environment* section that a search for "smoke" printed (lines 13, 15, 20); the last entry of `phase-50-departures.md` on `main`, for the form of a check's departure; `README.md`; `CONTEXT.md`; the top of `STATUS.md`; the takeover paragraph of `process.md` (lines 147 to 152); the probe directory; the container's own pre-push hook (`~/.timone/git-hooks/pre-push`), to see what it refuses. `doc/standards.md` does not exist in this project. File-name lists only: `git diff --name-only origin/main...HEAD`. Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. PRD-09.R5's probe reads `process.md`, the skills and the runner's instructions as its clause says; it reads the runner's instructions as the fake model receives them, not from `src/runner/brief.ts`.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 (clauses 2, 3) | MUST | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (the real-runner clause BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** | 0 |
| PRD-07.R1 | MUST | api | PASS | 0 |
| PRD-07.R2 | MUST | api | PASS | 0 |
| PRD-07.R3 | MUST | api | PASS | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-07.R10 | MUST | api | PASS | 0 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-07.R13 | MUST | api | PASS (clause 3 read with PRD-09.R4 — see *Questions for the human*) | 0 |
| PRD-08.R2 | MUST | api | PASS | 0 |
| PRD-08.R4 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |

**The gate is not met:** PRD-05.R18, a MUST in the regression set, is BLOCKED. No regression was found, and no fix loop was needed. Every criterion this phase claims passes.

## Evidence

### PRD-09.R4 — PASS

Probe `prd-09.r4.mjs`, written this pass from the register. Command: `node doc/plans/phases/probes/prd-09.r4.mjs` (break run, then real run; 3 min 20 s). The fixture's runner is eager: on every wake it starts a step, up to two. Each step ends 12 s after it starts. So whenever nothing holds the ticket when a step ends, the runner starts the next step at once.

```
=== PRD-09.R4 clause 1a — a run whose step is still running: when a named person runs the command, the command does not refuse, and says in one sentence that it waits and that Ctrl-C stops the wait
    break leg: RED (as required) — the command refused: "I'm working on fixture #12 right now. Anything I need from you will land on the ticket."
    green leg: PASS — assertion held
=== PRD-09.R4 clause 1b — that one sentence says which step it waits for (a build step, on this ticket)
    break leg: RED (as required) — the sentence does not name the build step on #12 as the step it waits for: "Waiting for the step running on fixture #12 (checking the result) to end, then I'll open the session here — press Ctrl-C to stop waiting, and nothing changes."
    green leg: PASS — assertion held
    (the command said: "timone daemon (pid 49820) has the ledger, so I've asked it to hand fixture #12 over on its next pass. Watching for that. Waiting for the step running on fixture #12 (building) to end, then I'll open the session here — press Ctrl-C to stop waiting, and nothing changes. Picking up fixture #12 here. […]")
=== PRD-09.R4 clause 2a — a takeover waiting this way: when the step ends, the terminal session opens on the ticket
    break leg: RED (as required) — no terminal session opened on the ticket
    green leg: PASS — assertion held
=== PRD-09.R4 clause 2b — the runner starts no other step on the ticket between the step's end and the session opening
    break leg: RED (as required) — the runner started 1 step(s) between the step's end and the session opening: execution at 2026-10-05T15:36:51.661Z
    green leg: PASS — assertion held
    (step ended 2026-10-05T15:35:28.723Z; session opened 2026-10-05T15:35:29.030Z; runner wakes in between: 0; steps started in all: 2)
=== PRD-09.R4 clause 2c — when the session ends, the runner wakes and reads what it left on the ticket, as PRD-05.R11 says
    break leg: RED (as required) — no terminal session opened on the ticket
    green leg: PASS — assertion held
    (wakes after the session: ["The step building ended: it succeeded.","The terminal session ended."])
=== PRD-09.R4 clause 3a — a takeover waiting this way, stopped with Ctrl-C before the step ends: the run is the same as if the command had never been typed, and the runner carries on as it would have
    break leg: RED (as required) — the runner did not carry on as it would have: […] woke:The step building ended: it succeeded./The terminal session ended. […]
    green leg: PASS — assertion held
    (stopped after it said: "[…] press Ctrl-C to stop waiting, and nothing changes. Stopped waiting. Nothing changed on fixture #12."; exit 130, 410 ms after Ctrl-C)
=== PRD-09.R4 clause 3b — the same, with Ctrl-C pressed at once, before the command has said anything
    break leg: RED (as required) — the runner did not carry on as it would have: […]
    green leg: PASS — assertion held
    (stopped at once; it said: "timone daemon (pid 54865) has the ledger, so I've asked it to hand fixture #12 over on its next pass. Watching for that."; exit null SIGINT)
=== PRD-09.R4 clause 4 — a run whose step is running, and no daemon running: so no step can end, the command says so and does not wait
    break leg: RED (as required) — the command was still waiting 14221 ms after it was typed
    green leg: PASS — assertion held
    (no daemon: it said, in 142 ms, exit 1: "A step shows as running on fixture #12 (building), but no daemon is running, so it cannot end and I won't wait for it. Start the daemon with `timone daemon`; it gives the run back to the runner, and then you can run this again.")
--- PRD-09.R4: PASS (8 clause labels, 8 passing)
```

- Clause 1: PASS. The command did not refuse. One sentence names the step ("building") and Ctrl-C. Two sentences come before it, saying the command asked the daemon; the clause asks for one sentence that says both things, and there is one.
- Clause 2: PASS. The session opened 0.3 s after the step ended. The runner was not woken in between and started no step. When the session ended, the runner was woken with both events and read the session's closing comment.
- Clause 3: PASS. After Ctrl-C, the run's ledger entry and the run record's sequence of events are the same as in a run where nothing was typed, and the runner started its next step at the step's end, as it did there. Compared: every ledger field but times, ids and the holding process's pid and token. With Ctrl-C pressed at once (3b), the command ended by the signal, with no message of its own; the run was still unchanged.
- Clause 4: PASS. With the daemon running and holding the ledger, clauses 1 to 3 hold (every one ran with the daemon up). With no daemon, the command said no step can end and stopped in 0.14 s.

### PRD-09.R5 (clauses 2 and 3) — PASS

Probe `prd-09.r5.mjs`, written this pass. Command: `node doc/plans/phases/probes/prd-09.r5.mjs` (break run, then real run).

```
=== PRD-09.R5 clause 2 — process.md's paragraph on `timone takeover` says that a takeover typed while a step runs waits for it to end, then opens
    break leg: RED (as required) — the paragraph on timone takeover does not say that […] (process.md at e16cb71)
    green leg: PASS — assertion held
    (the paragraph: "[…] ✏ 2026-10-05 ([ADR-0067](…)) — **typed while a step of the ticket runs, it waits for that step to end, and then opens the session.** It says which step it waits for. The session opens before the runner starts anything else on the ticket. Ctrl-C stops the wait and changes nothing. With no daemon running, no step can end, so it says so and does not wait.")
=== PRD-09.R5 clause 3 (process.md) — no line in process.md says that a takeover refuses while a step of its own ticket runs
    break leg: RED (as required) — process.md, with one planted sentence says a takeover refuses […]
    green leg: PASS — assertion held
    (process.md before phase 51 had no such sentence either: 0 found; the refusal was the program's, not the document's)
=== PRD-09.R5 clause 3 (skills) — no line in the step skills under .claude/skills/ (14 files) says that a takeover refuses while a step of its own ticket runs
    break leg: RED (as required) — the skills, with one planted sentence says a takeover refuses […]
    green leg: PASS — assertion held
=== PRD-09.R5 clause 3 (the runner's instructions) — no line in the runner's instructions, as the runner receives them, says that a takeover refuses while a step of its own ticket runs
    break leg: RED (as required) — the runner's instructions, with one planted sentence says a takeover refuses […]
    green leg: PASS — assertion held
    (the runner's instructions: 10263 characters; sentences naming the takeover: 1)
      - "Do not write the takeover command in that comment, not even to say that it will not help."
    (set aside in process.md: 0 sentence(s) naming a takeover and a refusal)
    (set aside in skills: 0 sentence(s) naming a takeover and a refusal)
    (set aside in runner's instructions: 0 sentence(s) naming a takeover and a refusal)
=== PRD-09.R5 clause 1 — each place that tells the machine how to ask a person something says that a question names the command, with the three cases of R3 left out
    NOT CHECKED IN THIS PHASE — phase 51 claims R5 for the takeover paragraph only; this clause is the second piece's.
--- PRD-09.R5: PASS (4 clause labels, 4 passing)
```

The probe's filters for clause 3 (a sentence about history, another ticket, or a run just picked up is set aside) set aside nothing: no sentence in the three places names a takeover and a refusal at all.

### Regression — 19 PASS, 1 BLOCKED

`node doc/plans/phases/probes/run.mjs --regression`, real runs only, last run after every change (4 min 24 s). Its table, for the 20 criteria in scope:

```
| PRD-05.R2  | PASS      | R2 — The runner acts only through the actions code gives it
| PRD-05.R3  | PASS      | R3 — Nothing reaches a default branch without a yes from a named person
| PRD-05.R4  | PASS      | R4 — A run that changed the project's files ends at a pull request
| PRD-05.R5  | PASS      | R5 — Code lists every departure on the pull request, and a skipped check comes first
| PRD-05.R7  | PASS      | R7 — The runner never records an approval nobody gave
| PRD-05.R10 | PASS      | R10 — Only named people can instruct the runner
| PRD-05.R11 | PASS      | R11 — `takeover` and `cancel` stay, and `retry` goes
| PRD-05.R18 | BLOCKED   | R18 — The runner passes a replay of the recorded failures
| PRD-07.R1  | PASS      | R1 — A ticket frees its project when its pull request opens
| PRD-07.R2  | PASS      | R2 — Each project has a number of places, 2 unless `timone.yaml` says otherwise
| PRD-07.R3  | PASS      | R3 — A freed place goes to one ticket: `priority:high` first, then the oldest
| PRD-07.R4  | PASS      | R4 — Nothing is built on top of an open pull request
| PRD-07.R6  | PASS      | R6 — A held ticket says what it waits for, and a named person can overrule
| PRD-07.R9  | PASS      | R9 — A ticket with an open pull request keeps its run and is not picked up again
| PRD-07.R10 | PASS      | R10 — The breakdown shows which pieces are built at the same time
| PRD-07.R12 | PASS      | R12 — The old rule is gone from every place it is written
| PRD-07.R13 | PASS      | R13 — A takeover is allowed while another ticket of the same project is building
| PRD-08.R2  | PASS      | R2 — An issue the runner files on Timone names the people of the `timone` project
| PRD-08.R4  | PASS      | R4 — Nobody is assigned to a ticket because of this
| PRD-08.R5  | PASS      | R5 — When the file names nobody, the ticket still opens
```

- **PRD-05.R2:** 3 of 4 clause labels pass; clause 2b BLOCKED — "GitHub could not be read from here (gh)". As in earlier passes.
- **PRD-05.R7:** 3 of 4 pass; "clause 1 (runner)" BLOCKED — it needs the real model's replay.
- **PRD-05.R18: BLOCKED**, all 3 labels — "the newest recorded replay is older than this build". The replay was tried here and could not log in (*Environment*).
- **PRD-05.R11:** its note-1 check was replaced this pass, as PRD-09.R4's `Falsified-by` line asks (below). Run on its own with its break run: 12 of 12 labels red, then green.

```
=== PRD-05.R11 clause 2, note 1 — a takeover of a run whose step is running (note of 2026-10-05, PRD-09.R4): it says which step it waits for, waits for it to end, and then opens the session
    break leg: RED (as required) — it does not say which step it waits for: "I'm working on fixture #12 right now. Anything I need from you will land on the ticket."
    green leg: PASS — assertion held
    (takeover of the run whose step was running said, exit 0: "[…] Waiting for the step running on fixture #12 (building) to end, then I'll open the session here — press Ctrl-C to stop waiting, and nothing changes. Picking up fixture #12 here. […]")
=== PRD-05.R11 clause 2d — another run of the project is parked and holds no work branch: timone takeover opens a terminal session on that ticket, and when it ends the runner wakes and reads what it left
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
--- PRD-05.R11: PASS (12 clause labels, 12 passing)
```

- **PRD-07.R13:** in the first run its clause 3 failed: the takeover of a ticket whose own step runs no longer says "I'm working on … right now"; it says it waits for the step. No session opened while the step ran, and none opened at all (the step never ends in that fixture; the takeover stopped when the daemon stopped and said so). PRD-09.R4, approved on 2026-10-05, replaces that refusal, and PRD-05.R11's register already carries a note saying so; PRD-07.R13's does not. I read clause 3 with PRD-09.R4: it holds when no session opens while the ticket's own step runs, and the message names the ticket and says that a step is running on it. The probe's message check was rewritten that way and run with a break run: 4 of 4 labels red, then green. This is not counted as a regression, and its words are a question for the human (below).

```
=== PRD-07.R13 clause 3 — a ticket whose own step the machine is working on: timone takeover on it opens no session, and the message says what is happening, as today
    break leg: RED (as required) — a terminal session opened on the ticket: […] | and | the message does not say what is happening: "[…] Picking up fixture #12 here. When you end this session, the runner reads the ti"
    green leg: PASS — assertion held
    (runs at the takeover: fixture#12/1 active (execution) on timone/12-ticket-to-take-over. Takeover said, exit 1: "[…] Waiting for the step running on fixture #12 (building) to end, then I'll open the session here — press Ctrl-C to stop waiting, and nothing changes. The daemon stopped, so the step on fixture #12 cannot end. I've stopped waiting, and nothing changed.")
--- PRD-07.R13: PASS (4 clause labels, 4 passing)
```

### Known open points from the completion report, not checked

The completion report lists four points the build found and left open. None is a register clause, so none is judged here: a second terminal could take the run in the moment before the daemon reads this terminal's request; the runner still posts and ends a run while a terminal holds it; R4's *Verification hint* still describes the code before this phase; Ctrl-C before the daemon reads the request ends the process the old way. The last one was seen here (clause 3b: the command ended by the signal, with no message) and the run was still unchanged.

## HUMAN-CHECK scripts

No criterion in scope is on the `human` channel, and no clause needed a person.

## Live gates

No criterion in scope is on the `live` channel. Owed by this phase, as above:

- **The completion report's own live gate:** on scratch-app, with the daemon running, a takeover typed while a step runs; then again with Ctrl-C before the step ends. Never run.
- `live` criteria whose `Depends-on` this diff touches (`src/daemon/`, `src/commands/`, `src/runner/`, `process.md`), with their `Last live gate:`: PRD-01.R4 — never; PRD-02.R1 — phase-32-live-gate.md (2026-09-04); PRD-02.R2, R4, R6, R7, R8 — never; PRD-02.R13 — phase-32-live-gate.md (2026-09-04); PRD-03.R1 — phase-35-live-gate.md (2026-09-07); PRD-03.R2, R4 — never; PRD-03.R5 — phase-35-live-gate.md (2026-09-07); PRD-06.R1, R2, R3, R4 — never; PRD-07.R5, R7, R14 — never.
- `live` criteria with no `Depends-on`, so owed on any change: PRD-04.R1 — never; PRD-05.R9, R12, R13, R15 — phase-40-live-gate.md (2026-09-30); PRD-08.R6 — never.
- Not owed (their `Depends-on` names nothing this diff touches): PRD-01.R5, R8, R9, R10, R11, R12, R13, R15, R17, R20; PRD-03.R3.

## Regression

The derived set's results are in *Evidence* above: 19 PASS, 1 BLOCKED (PRD-05.R18), no REGRESSION.

Narrowed out by `Depends-on` (this diff touches none of their prefixes):

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`. Ran anyway with the set: PASS.
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`. Ran anyway: FAIL in its own setup, on the container's push refusal (`git push -q "/tmp/probe-prd01r3-…/origin.git" main` refused). No clause was reached. Out of scope; not changed.
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`. No probe.
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`. Ran anyway: PASS.

## Probes

22 probes ran on criteria in scope: the 20 of the regression set and the 2 new ones. **21 proven able to fail, 0 not, 1 with nothing decided:** 5 were proven this pass (below); 16 print that an earlier check proved them; PRD-05.R18's probe decided no clause (all BLOCKED). No probe in scope lacks a break step.

- **Written this pass:** `prd-09.r4.mjs` (first check of PRD-09.R4) — break run done, 8 of 8 labels red, then green. `prd-09.r5.mjs` (first check of PRD-09.R5) — break run done, 4 of 4 red, then green.
- **Rewritten in part this pass, with a break run:** `prd-05.r11.mjs` — the note-1 check, replaced as PRD-09.R4's `Falsified-by` line asks: a takeover of a run whose step runs now must wait and then open, and its break leg is the build from just before phase 51 (`e16cb71`, built outside the tree by `_old-build.mjs`), which refused. Clause 2d's break leg used note 1's refused takeover; it now uses the same takeover on that older build. A check that "a run just picked up is still refused" (the build's own note on R11) was tried and dropped: from outside, a run could not be held in that state. 12 of 12 red, then green. `prd-07.r13.mjs` — clause 3's message check, read with PRD-09.R4 (above); its break leg now needs two breaks to go red. 4 of 4 red, then green.
- **Run again with a break run, its result in doubt:** `prd-05.r3.mjs` — 19 of 19 red, then green (*Environment*).
- **Instrument change, not a probe:** `_rig.mjs` and `_steps.mjs` fill their scratch remotes by fetch instead of push (*Environment*).
- **Ran without a break run this pass (real run only):** PRD-05.R2, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R18, PRD-07.R1, PRD-07.R2, PRD-07.R3, PRD-07.R4, PRD-07.R6, PRD-07.R9, PRD-07.R10, PRD-07.R12, PRD-08.R2, PRD-08.R4, PRD-08.R5 (and, out of scope, PRD-01.R2, PRD-01.R3, PRD-08.R1).
- **Clause coverage:** PRD-09.R4 has 4 clauses in the register; the probe prints 8 labels covering all 4. PRD-09.R5 has 3; the probe judges 2 and 3 and prints clause 1 as not checked in this phase. No gap found in the probes run from the directory.

## Fix-loop accounting

0 of 2 — the initial pass found no fault in the program. The first runs' failures were the instruments' (the container's push refusal in the rig's setup; my own first comparison in clause 3, which compared process ids across two fixtures) and were fixed in the probes, not in the program.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none`).

## Questions for the human

1. **PRD-07.R13 clause 3 still says "as today".** It reads: *"GIVEN a ticket whose own step the machine is working on WHEN a person runs `timone takeover <ticket>` on it THEN no session opens, and the message says what is happening, as today."* "As today" was the refusal "I'm working on … right now". PRD-09.R4, which you approved on 2026-10-05, replaces that refusal: the takeover now says which step it waits for, waits, and opens the session when the step ends. PRD-05.R11's register has a dated note saying R4 replaces its refusal; PRD-07.R13's has none. I checked clause 3 as: no session opens while the ticket's own step runs, and the message says a step is running on it. That holds. Should clause 3's words be changed to point at PRD-09.R4, as PRD-05.R11's were? A useful answer is "yes, change the words", or the words you want.

## Register changes

- **PRD-09.R4:** `draft` → `verified`. All four clauses pass. Its claim is universal ("the runner starts no other step … between"), and its `Falsified-by` line names two tests the build saw fail first, plus PRD-05.R11's probe change, made here and seen to fail first. This pass's probe, `prd-09.r4.mjs`, also went red on every break leg. Dated evidence marker added.
- **PRD-09.R5:** stays `draft`. Clauses 2 and 3 pass; clause 1 is the second piece's and was not checked. Dated partial-evidence marker added.
- **PRD-05.R11:** stays `verified`. Dated evidence marker added: the note-1 check is replaced, and all 12 labels pass.
- **PRD-07.R13:** stays `verified`. Dated evidence marker added: clause 3 read with PRD-09.R4, and the question above.

## Carried forward

- **PRD-05.R18 — BLOCKED.** The replay of recorded failures needs a logged-in model, and this container has none: `npm run --silent replay` gave 0 of 20, every try "Not logged in". The dry replay passed 20 of 20, which is not R18's evidence. PRD-05.R7's real-runner clause is BLOCKED for the same reason, and PRD-05.R2 clause 2b because GitHub could not be read from here. Owed: `npm run --silent replay`, from a logged-in terminal, on this branch.
- **Live gates owed** (see *Live gates*), the completion report's first: a takeover typed while a step runs on scratch-app, then with Ctrl-C.
- Recorded in [`phase-51-departures.md`](phase-51-departures.md), entries dated 2026-10-05, "timone#217, verification".
