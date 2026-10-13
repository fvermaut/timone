# Phase 61 — Verification Report

- **Date:** 2026-10-13
- **Phase:** [phase-61.md](../phase-61.md) — stamped `Complete`, completion report [phase-61-complete.md](phase-61-complete.md)
- **Scope:** PRD-07.R7 (MUST, `live`) and PRD-05.R18 (MUST, `api`), the IDs the phase file's header claims; the completion report's requirements line names the same two. Also the five parts the runner's instructions for this step asked to confirm, checked in their own section below; they are not criteria of the register.
- **Live gate owed:** yes — PRD-07.R7. It depends on `src/runner/`, `src/daemon/` and `.claude/skills/`, and this phase's diff touches all three.
- **Regression set (derived):** 28 criteria — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R1, R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- **Branch:** `timone/234-the-update-step-cannot-finish-a-merge-wh` @ `6b322d9` when this pass began; the fix of this pass is `0e94d4a`. No earlier phase had to be merged in: the branch was cut from `main` at `2f60802`, after phase 60's verification merged.

## Environment

- **Build:** `npm run build` (`tsc`), exit 0, at `6b322d9` and again at `0e94d4a`. Timone has no server to stand up: every check runs the built `dist/cli.js` — its commands, and its daemon against a fake forge and a fake model service on 127.0.0.1 (`doc/plans/phases/probes/_rig.mjs`), with steps run in-process.
- **This container** refuses every `git push` that is not to this run's own work branch. The probes fill their throwaway remotes by a `git fetch` run in the remote instead, as the rig has done since phase 51. No model login is here, and the runner said not to try to get one.
- **Build-health smoke**, run once at the end, not as evidence: `npx vitest run` at `0e94d4a`: 77 test files, 2786 tests, **2715 passed, 71 failed**, 8.1 s. The 71 are exactly the ones the completion report names as failing before any change was made in this kind of container. 70 are tests whose `git push … main` to a temporary remote is refused by this container's push guard (45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`). 1 is `src/daemon/register.test.ts`: it reads this repository's registers and says PRD-07.R3 "is marked verified, and its own notes say a clause was never seen to hold". That note on R3 was written by phase 60's verification and is already on `main`; this phase did not change it. Its words "where that ticket was never woken" describe the build before phase 60, not a clause left unseen.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-60-verification.md` on `main`, lines 16–17: its smoke passed whole and its list was empty, so every failure here is marked new. They are new to that list, not new faults of this phase: phase 60's smoke ran outside this container, and before its own note on R3 was written. This pass's list, for the next pass:
- src/commands/guardrails.test.ts > a session a human drove > catches a project's work branch cut at the timone root — finding 11, on real git — new
- src/commands/guardrails.test.ts > a session a human drove > does not judge Timone's own work against a project it never had — new
- src/commands/guardrails.test.ts > a session a human drove > goes round exactly once, however many turns the session takes — new
- src/commands/guardrails.test.ts > a session a human drove > prints the finding and journals it, and posts on no ticket at all — new
- src/commands/guardrails.test.ts > a session a human drove > says nothing when the session behaved — new
- src/commands/guardrails.test.ts > a session the daemon drove > asks the session first, then flags the run — and posts on no ticket — new
- src/commands/guardrails.test.ts > a session the daemon drove > says nothing anywhere when the session behaved — new
- src/commands/guardrails.test.ts > a session the daemon drove > stops flagging once the session has fixed what it was told — new
- src/commands/guardrails.test.ts > a session with no baseline > says so rather than passing silently — new
- src/commands/guardrails.test.ts > commits another session made > are invisible to the STATUS.md placement rule — new
- src/commands/guardrails.test.ts > commits another session made > are invisible to the path-containment rule — the 14g accusation itself — new
- src/commands/guardrails.test.ts > commits another session made > are invisible to the provenance rule — new
- src/commands/guardrails.test.ts > commits another session made > are invisible to the unpushed rule, and do not inflate its count — new
- src/commands/guardrails.test.ts > commits another session made > are still judged when they name no session at all — the fix's known limit — new
- src/commands/guardrails.test.ts > finding the run that drove a session > finds nobody for a session no run ever claimed — new
- src/commands/guardrails.test.ts > finding the run that drove a session > resolves the session id against the ledger — new
- src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > goes by the ledger when the session has a run, whatever it declared — new
- src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > lets a session that declared the checking step through — new
- src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > refuses the probes to a session that declared a building step — new
- src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) > still asks when the session has no run and declared no step — new
- src/commands/guardrails.test.ts > guarding the verifier's probes > asks when no run drove the session, because a human is at the keyboard — new
- src/commands/guardrails.test.ts > guarding the verifier's probes > lets the verification run that owns them through — new
- src/commands/guardrails.test.ts > guarding the verifier's probes > refuses a build run the probe directory — new
- src/commands/guardrails.test.ts > guarding the verifier's probes > says nothing about a tool call that touches no probe — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > refuses a run `GIT_CONFIG_COUNT=0 git push` — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > refuses a run `git -c core.hooksPath=/tmp/h push` — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > refuses a run `git push --no-verify origin x` — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git commit --no-verify -m x` in a person's own session — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git push --no-verify origin x` in a person's own session — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing about `git push origin timone/39-x` in a person's own session — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing to a run about `git commit --no-verify -m x` — new
- src/commands/guardrails.test.ts > switching off the guard on a run's pushes > says nothing to a run about `git push origin timone/39-x` — new
- src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits > says nothing about a status file the work branch took from main — new
- src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits > still says so about a status file that exists only on a branch — new
- src/commands/guardrails.test.ts > the journal > appends one line per finding, and creates the file — new
- src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > accepts a trailed commit and flags an untrailed one — new
- src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > flags a commit that carries no trailer at all — new
- src/commands/guardrails.test.ts > the provenance trailer, read back off real commits > tells the session its own id and what it owes, at SessionStart — new
- src/commands/guardrails.test.ts > the run a session belongs to > is judged as a person's own session when nothing names a run — new
- src/commands/guardrails.test.ts > the run a session belongs to > is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2 — new
- src/commands/guardrails.test.ts > the run a session belongs to > is nobody's when neither the ledger nor the environment names a run — new
- src/commands/guardrails.test.ts > the run a session belongs to > is the box's declaration when the ledger has no run for the session — new
- src/commands/guardrails.test.ts > the run a session belongs to > is the ledger's run when the ledger has one, whatever the environment says — new
- src/commands/number.test.ts > timone number > names the projects it knows, and exits 1, for a project it does not know — new
- src/commands/number.test.ts > timone number > prints only the reserved number, padded, and exits 0 — new
- src/commands/number.test.ts > timone number > prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails — new
- src/daemon/register.test.ts > this repository's own registers > claim nothing they have not established — new
- src/numbers.test.ts > reserveNumber > counts a PRD and its criteria register as one number — new
- src/numbers.test.ts > reserveNumber > counts a number another session reserved, and only reservations of the same kind — new
- src/numbers.test.ts > reserveNumber > counts a phase that exists only in the checkout's folder, not committed — new
- src/numbers.test.ts > reserveNumber > counts a phase that exists only on another branch, pushed after the checkout was cloned — new
- src/numbers.test.ts > reserveNumber > gives five sessions asking for a adr number at once five different numbers, each reserved on the remote — new
- src/numbers.test.ts > reserveNumber > gives five sessions asking for a phase number at once five different numbers, each reserved on the remote — new
- src/numbers.test.ts > reserveNumber > gives five sessions asking for a triage number at once five different numbers, each reserved on the remote — new
- src/numbers.test.ts > reserveNumber > gives the first adr number, padded, to a project with none — new
- src/numbers.test.ts > reserveNumber > gives the first phase number, padded, to a project with none — new
- src/numbers.test.ts > reserveNumber > gives the first prd number, padded, to a project with none — new
- src/numbers.test.ts > reserveNumber > gives the first triage number, padded, to a project with none — new
- src/numbers.test.ts > reserveNumber > gives the phase after the highest on the default branch, not counting the reports folder — new
- src/numbers.test.ts > reserveNumber > gives two reservations from one checkout, in the same second and with the same note, two different numbers — new
- src/numbers.test.ts > reserveNumber > leaves the checkout as it was: same branch, same status, and no local ref to the reservation — new
- src/numbers.test.ts > reserveNumber > throws with git's words, and reserves nothing, when a pre-push hook refuses — new
- src/numbers.test.ts > reserveNumber > throws with git's words, and reserves nothing, when the remote does not exist — new
- src/workspace.test.ts > syncWorkspace > clones a missing project on first sync — new
- src/workspace.test.ts > syncWorkspace > fails a plain non-git directory but still processes the others — new
- src/workspace.test.ts > syncWorkspace > fast-forwards and reports updated when the upstream gains a commit — new
- src/workspace.test.ts > syncWorkspace > reports up-to-date when the upstream has not moved — new
- src/workspace.test.ts > syncWorkspace > skips a checkout on a non-default branch — new
- src/workspace.test.ts > syncWorkspace > skips a dirty checkout without touching it — new
- **Smoke against check scripts:** no alarm. No failing test covers behaviour a check script here judged: the 70 push tests fail on this container's guard before they reach what they test, and the register test reads the register's wording, while the probe of PRD-07.R3 checks what the daemon does.

## Independence declaration

Read, from the allowed list: the registers `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (whole) and, of `prd-05-a-runner-decides-each-step.criteria.md`, the R18 block; the phase file's status line, companion line, `Screens changed` line and requirements header; the completion report, whole; `STATUS.md` (its *Waiting on you* section); `CONTEXT.md` (the lines for *Update*, *Probe* and *Break run*); `package.json`'s scripts; the probe folder `doc/plans/phases/probes/` (`run.mjs`, `_lib.mjs`, `_rig.mjs`, `_guard-step.mjs`, `prd-05.r5.mjs`, and part of `_fake-gh.cjs`); on `main`, by `git show`, `phase-60-verification.md` cut to its headings and lines 16–18 (its smoke line and list), which also printed lines 32 and 35, two lines of its independence declaration. Name lists only: `git diff --name-only origin/main...HEAD` for the phase, and `git show --name-only --format= 0e94d4a` for the fix.

**Beyond the allowed list, and why.**
- `phase-61.md` lines 11–30 and 35 were printed by the first look at its header: its goal, the decisions it took, and a line naming functions. That was a mistake of the command, not a choice. Nothing below rests on it: every expectation comes from the register or from the runner's own words.
- The runner's instructions asked to confirm wording in the update's instructions and in ADR-0066, and to search for other places that repeat the old rule. For that, this pass read `.claude/skills/timone-update/SKILL.md` (whole), ADR-0066's status line and the lines a search for "never", "probe", "check script", "edit", "amend" and "status" printed, `process.md` lines 46 (its sentences on probes), 56 and 86–92, line 43 of `.claude/skills/timone-verify/SKILL.md`, and search hits across `.claude/`, `process.md`, `CONTEXT.md` and `README.md`. These are the delivered text the runner named, read as text. No criterion verdict uses them.
- `doc/plans/phases/reports/phase-61-departures.md`, read to append to it.
- Test titles printed by `npx vitest run src/update-checks.git.test.ts src/update-checks.test.ts --reporter=verbose`, and the failure messages of the smoke run, which print three source lines of `src/daemon/register.test.ts` around line 130. Never the test source otherwise.

Not read: handoffs, diffs, source, the committed test suite, ADR-0068, triage 004 and the ticket. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R7 | MUST | live | LIVE-GATE — owed a fresh gate | 0 |
| PRD-05.R18 | MUST | api | BLOCKED — clause 1 on the real model, and clause 2, need a replay on this build; the parts judged with a stand-in model pass | 0 |
| Regression set, 28 criteria | MUST | api | PASS on every part that could run; one part of PRD-05.R2, one of PRD-05.R7 and five of PRD-05.R18 BLOCKED | 0 |
| The runner's five parts (not register criteria) | — | api | PASS, after one fix: part 5 failed on the first run | 1 |

## Evidence

### PRD-07.R7 — LIVE-GATE

On the `live` channel; no probe and no script by rule. Its `Last live gate:` is `never`, and this phase owes one: an update on scratch-app where both sides changed one check script. See *Live gates*. The five parts below check, on the built commands and the built daemon with a fake forge and model, the code that this live gate would watch a real session use. They do not replace it.

### PRD-05.R18 — BLOCKED

`node doc/plans/phases/probes/run.mjs --regression --jobs=6 --only=…` (real runs only), as printed:

```
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result, judged against the table's last column as the register now words it
    BLOCKED — the recorded replay is older than this build: run 2's commit 03b5c13 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a terminal with a model login).
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case
    BLOCKED — (the same)
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    BLOCKED — (the same)
=== PRD-05.R18 clause 1d — the #132 row: the replay counts acting on the word, and counts asking what it meant
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1e — the #132 row: the replay does not count a comment that names the takeover command
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1f — the #132 row: the replay does not count a question about something else as asking what the word meant
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    BLOCKED — the newest recorded replay is older than this build: run 2's commit 03b5c13 is not in this branch's history.
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    BLOCKED — no replay on this build is recorded yet.
```

Phase 61 changed one of the runner's rules (what to do when an update failed; part 4 below shows the new rule in the runner's instructions). So clause 2 asks for the replay set to run on this build, with its result on the pull request. It needs a model login, which this container does not have; the runner said not to get one and to record it as not run. The build tried one case and got "Not logged in" (its departures, entry 4). **Not run; it rides to the pull request.** Command, from a terminal with a model login: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-61.txt`, its output to go into `doc/plans/phases/reports/phase-61-replay.md` as run 1.

### The regression set — PASS on every part that could run

The 28 probes, one command, real runs only, at `6b322d9`: `28 passing, 0 failing, 0 blocked, 0 with no probe.` Per probe, clause labels passing: PRD-05.R2 3 of 4 (clause 2b BLOCKED: "GitHub could not be read from here (gh)"); R3 19 of 19; R4 6 of 6; R5 6 of 6; R7 3 of 4 (clause 1, the real runner, BLOCKED: needs the replay on this build); R10 4 of 4; R11 12 of 12; R18 3 of 8 (above); PRD-07.R1 5 of 5; R2 15 of 15; R3 6 of 6; R4 7 of 7; R6 4 of 4; R9 4 of 4; R10 5 of 5; R12 5 of 5; PRD-08.R1 3 of 3; R2 2 of 2; R4 2 of 2; R5 1 of 1; PRD-09.R2 4 of 4; R4 8 of 8; R5 7 of 7; PRD-10.R2 6 of 6; R3 3 of 3; R4 2 of 2; R5 3 of 3; R6 2 of 2. Every probe printed as many labels as its register block has clauses, or more.

### The runner's five parts — PASS after one fix

The runner's instructions for this step asked to confirm five parts. They are checked by `doc/plans/phases/probes/phase-61-requested.mjs`, written this pass from the runner's words, from the built commands' `--help` and output, and from what the built daemon showed a fake forge and a fake model. It is not the probe of a criterion: PRD-07.R7 is `live`, and `run.mjs` does not run this file. First run, break leg then real leg, at `6b322d9`:

```
    (update-checks, as printed: The project's tests: npm run test:unit, then npm run test:integration, then npm run test:e2e. | This branch's plan, doc/plans/phases/phase-02.md: |   PRD-18.R12: doc/plans/phases/probes/prd-18-r12.mjs |   PRD-18.R13: no check script | Arrived on main, doc/plans/phases/phase-03.md: |   PRD-19.R1: doc/plans/phases/probes/prd-19.r1.mjs)
=== part 1a — update-checks finds a check script named with a dash (prd-18-r12.mjs), and still finds one named with a dot
    break leg: RED (as required) — PRD-18.R12's check script, named with a dash, is not found: {"id":"PRD-18.R12"}
    green leg: PASS — assertion held
=== part 1b — a project with no `test` script: the update runs test:unit, test:integration and test:e2e, in that order, and no watch script
    break leg: RED (as required) — the test commands of a project with test:unit, test:integration, test:e2e and two watch scripts, and no test script, are []
    green leg: PASS — assertion held
    (update-conflicts, as printed: Check scripts left in conflict — join these yourself, keeping every check from both sides: | - (no requirement): doc/plans/phases/probes/_lib.mjs | - PRD-07.R7: doc/plans/phases/probes/prd-07.r7.mjs | - PRD-20.R1: doc/plans/phases/probes/prd-20-r1.mjs | - (no requirement): standards/baseline/probes/keyboard.mjs | Other files left in conflict — give these to the fix context: | - src/a.js)
    (with no merge in progress: exit 2, "No merge is in progress in fixture: there is nothing to join.")
=== part 2 — update-conflicts lists every conflicted file, and marks the check scripts (with their requirement) apart from the others
    break leg: RED (as required) — a check script both sides changed is not marked with its requirement: []
    green leg: PASS — assertion held
    (update joined: the step succeeded; the runner was told: "- The step bringing the work up to date ended: it succeeded.")
    (update abort: the step failed — "the merge of main at f40c6cd was not finished: main could not be merged in: PRD-01.R1: cannot tell which check is stricter"; the runner was told: "- The step bringing the work up to date ended: it failed: the merge of main at f40c6cd was not finished: main could not be merged in: PRD-01.R1: cannot tell which check is stricter.")
    (update nothing: the step failed — "it wrote no record entry, and the branch is still 1 commit behind main"; the runner was told: "- The step bringing the work up to date ended: it failed: it wrote no record entry, and the branch is still 1 commit behind main.")
    (the section at the top of the pull request after the join: ### Brought level with main | What arrived on main: 1 commit with no plan. | No code had to change. | Check scripts joined: PRD-01.R1: kept the checks each side added, all in one script. | - The whole test suite: passed — 1 test passed. | - The check scripts of this ticket: passed — PRD-01.R1. | - The check scripts of the work that arrived: none — no plan arrived.)
=== part 3 — the update's record says which check scripts were joined and how, and the top of the pull request shows it
    break leg: RED (as required) — the pull request's section does not name the joined check script: ### Brought level with main What arrived on main: 1 commit with no plan. No code had to change. - The whole test suite: passed — 1 test passed. - The check scripts of this ticket: passed — PRD-01.R1. - The check scripts of the work that arrived: none — no plan arrived. 
    green leg: PASS — assertion held
=== part 4 — an update that could not finish its merge is recorded as failed, the runner is told so, and its rules say to ask a named person
    break leg: RED (as required) — the update is not recorded as a step that failed: [{"kind":"step-ended","at":"2026-10-13T13:41:28.259Z","runId":"fixture#12/1","stage":"update","sessionId":"f7cb27ba-a910-4d42-98b5-0712d85f48b5","ok":true,"costUsd":0.0024000000000000002}]
    green leg: PASS — assertion held
=== part 5a — the update's instructions let the session open a check script that update-conflicts names, to join it
    break leg: RED (as required) — the update's rule on the probe folder has no exception for a check script it joins: "- **The contents of the probe folder the check uses (see `timone-verify`).** You *run* the check scripts it holds. You never open, print or list them. `update-checks` gives you each script's path, and"
    green leg: PASS — assertion held
=== part 5b — ADR-0066 says, on its status line, that ADR-0068 amends its rule D4 for check scripts
    break leg: RED (as required) — ADR-0066's status line does not say ADR-0068 amends D4: "- **Status:** accepted"
    green leg: PASS — assertion held
    (still written: process.md:89: plans/phases/probes/<criterion-id>.<ext>    stage-7 probes — one per criterion, written and run only by)
=== part 5c — no other written rule still says the check scripts are written or opened only by the checking step
    break leg: RED (as required) — 2 place(s) still say it on origin/main: .claude/skills/timone-verify/SKILL.md:43: - **Your own probe directory, `doc/plans/phases/probes/`** — the probes previous verification passes committed. It is yours: only this stage writes there, and s ; process.md:89: plans/phases/probes/<criterion-id>.<ext> stage-7 probes — one per criterion, written and run only by
    green leg: FAIL — 1 place(s) still say it: process.md:89: plans/phases/probes/<criterion-id>.<ext> stage-7 probes — one per criterion, written and run only by
--- phase 61, the runner's five parts: FAIL (8 clause labels, 7 passing)
```

1. **The update finds dash-named check scripts and runs `test:` scripts (#235).** PASS. `update-checks` names `prd-18-r12.mjs` under PRD-18.R12, still finds a dotted name, and lists `npm run test:unit, then npm run test:integration, then npm run test:e2e` for a project with those, two watch scripts and no `test` script. Each check went red on its broken setup (the script missing; no `test:` script).
2. **`update-conflicts` lists conflicted files and marks check scripts.** PASS. A merge where both sides changed a check script, added the same dash-named one, changed a helper in the probe folder and a file in `standards/baseline/probes/`, and changed `src/a.js`: the four probe-folder files are listed as check scripts, with their requirement where they have one, and `src/a.js` alone as another file. With no merge in progress it exits 2 with one sentence. **The test the runner asked about exists and passes**, by its printed title: `src/update-checks.git.test.ts > mergeConflicts while the update merges the default branch into the branch > lists a check script both sides changed, with its requirement, apart from the other files` (26 of 26 in the two update-checks test files).
3. **The record says which check scripts were joined and how.** PASS. The built daemon walked a chore to its pull request; main then changed the same check script; the scripted update step merged, ran `update-conflicts` (it listed `PRD-01.R1`), joined the file, and wrote an entry with `Check scripts joined: PRD-01.R1: kept the checks each side added, all in one script`. The step ended as succeeded, and the top of the pull request read: `Check scripts joined: PRD-01.R1: kept the checks each side added, all in one script.` With `Check scripts joined: none` the line is absent (the break leg).
4. **An update that could not finish its merge is recorded as failed, and a person is asked.** PASS. The step that stopped its merge and wrote the entry for it ended as failed — "the merge of main at f40c6cd was not finished: main could not be merged in: PRD-01.R1: cannot tell which check is stricter" — and the runner was woken with "The step bringing the work up to date ended: it failed: …". A step that wrote nothing failed too: "it wrote no record entry, and the branch is still 1 commit behind main". The runner's instructions carry the rule: "When it failed, the branch is still behind: say on the ticket in plain words what stopped it, and ask a named person to bring the branch level." The step that joined and finished its merge ended as succeeded (the break leg). Whether the real model then asks the person is the replay's to show (PRD-05.R18, BLOCKED above). The guard also lets a session on the `update` step read, write and edit a check script, in a container and on the host, and still refuses the build step.
5. **The old rule is gone.** **FAIL on the first run, PASS after the fix `0e94d4a`.** 5a: the update's instructions now let the session open a check script that `update-conflicts` names, to join it, and tell it to join each one itself (the fix context is still kept out of the probe folders, which is not the old rule). 5b: ADR-0066's status line says ADR-0068 amends its D4 for check scripts; its body is untouched, as ADRs are. The update session's own brief, as the fake model received it, says nothing about the probe folder. 5c failed: **`process.md` line 89**, in the table of artifacts, still said probes are "written and run only by stage 7". Phase 61 corrected the same sentence in the checking step's instructions but missed this one. A defect brief went to a fresh fix context, which changed only `process.md` (`0e94d4a`). Re-run, real leg only: 8 of 8 pass.

**Two small things noticed, neither a failure of what was asked:**
- `process.md` line 56, in the paragraph on the update, now says the same thing twice in a row: "Every other conflict and every failing test still go to a fresh fix context. A conflict or a failing test goes to a fresh fix context, …". Wording only.
- When a scripted update step wrote its entry within the same second as the step started, the step still ended as failed, but the reason said "it wrote no record entry" although one was written. The entry's time is written in whole seconds. A real update session takes minutes, so this is not expected to happen; the checks above wait two seconds before writing.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

- PRD-07.R7 — `Last live gate: never`. **This phase owes a fresh one**: its diff touches `src/runner/`, `src/daemon/` and `.claude/skills/`, all three of the criterion's `Depends-on`. The gate to watch: an update on scratch-app where both pull requests changed one check script, so that a real session joins it by the rules.

## Regression

- 28 of 28 probes PASS, real runs only (lines above). Parts that could not run here: PRD-05.R2 clause 2b (GitHub cannot be read from this container), PRD-05.R7 clause 1 and PRD-05.R18 clauses 1a–1c and 2a–2b (each needs a replay on the real model, on this build). None of them is a regression: nothing was observed wrong.
- Narrowed out by `Depends-on`, none of whose prefixes this phase's diff touches:
  - PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
  - PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
  - PRD-06.R5 — `src/adapters/credentials.ts, src/daemon/container-runtime.ts`
  - PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`

## Probes

- **8 checks proven able to fail this pass, 0 not**: the eight of `phase-61-requested.mjs` (parts 1a, 1b, 2, 3, 4, 5a, 5b, 5c), written this pass — first check of what the runner asked — each red on its broken setup and then run on the build.
- **Run without a break run this pass** (each proved able to fail by an earlier pass; none is new, revised or in doubt): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10, R12; PRD-08.R1, R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- No probe has no break step. No probe was rewritten. Clause coverage: no gap found.
- `run.mjs` is unchanged.

## Fix-loop accounting

**1 of 2 loops consumed.**

- **Loop 1.** Brief: the runner's part 5 — `process.md` lines 89–90 still said probes are "written and run only by stage 7". Fix commit: `0e94d4a` (`fix: verify 61 — process.md no longer says only the check writes and runs the check scripts`). Changed files: `process.md` only.
- **Run again, real runs only, after the fix (rebuilt):** `phase-61-requested.mjs`, 8 of 8 PASS; PRD-07.R12 (its `Depends-on` names `process.md`) PASS; and every criterion of the set with no `Depends-on` line, since it could not be told from the file name alone whether a change to `process.md` reaches them: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18, PRD-08.R5, PRD-09.R2, R4, R5, PRD-10.R2, R3, R4, R5, R6 — `18 passing, 0 failing, 0 blocked`, the same parts BLOCKED as before.
- **Not run again:** PRD-07.R1, R2, R3, R4, R6, R9, R10, PRD-08.R1, R2, R4 — each one's `Depends-on` names only paths under `src/`, and the fix changed no file there.

## Figures on the preview's data

No screen changed in this phase (its `Screens changed` line: none).

## Questions for the human

None.

## Register changes

None. PRD-07.R7 is `live` (LIVE-GATE: its status is not this pass's to change). PRD-05.R18 is BLOCKED, which leaves its line untouched; it stays `verified` from phase 60, and its replay on this build is owed. No regression was observed.

## Carried forward

- **PRD-05.R18 — BLOCKED.** The replay on the real model was not run on this build: no model login here. Its clause 2 needs it, because phase 61 changes one of the runner's rules. Recorded in [phase-61-departures.md](phase-61-departures.md), the entry dated 2026-10-13 for verification.
- **PRD-07.R7 — a live gate is owed** (not BLOCKED; listed so the pull request carries it).
