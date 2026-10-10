# Phase 58 — Verification Report

- **Date:** 2026-10-10
- **Phase:** [phase-58.md](../phase-58.md) — stamped `Complete`, completion report [phase-58-complete.md](phase-58-complete.md)
- **Scope:** PRD-05.R12, PRD-05.R13, PRD-05.R18, PRD-03.R1. These are the IDs in the phase file's header, and the same four as the completion report's requirements line.
- **Live gate owed:** yes. PRD-05.R12 and PRD-05.R13 carry no `Depends-on` line, and this phase changes what the runner reads at its 15-minute check and its rule for a command that is still running. PRD-03.R1's `Depends-on` names `src/daemon/`, and this diff changes `src/daemon/progress.ts` and `src/daemon/services.ts`.
- **Regression set (derived):** 23 criteria: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R4, R6, R9, R10; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- **Branch:** `timone/238-a-long-command-is-not-a-hung-step` @ `c6b8a06`. The phase is cut from `main` at `ee4e2e8`, which holds phase 57's verification, so nothing was merged in.

## Environment

- **The app.** Timone is a command-line program, so there is no server to stand up. Built with `npm run build` (`tsc`) on this branch, on fvermaut's Mac, in the clone at `projects/timone` (node v24.3.0 from nvm). Every check script runs the built `dist/cli.js`. The scripts that run the daemon start it in a throwaway folder against a stand-in GitHub and a stand-in model, as before.
- **This session** was run by hand. Its step was declared before any check script was touched (`node dist/cli.js stage verification --session fe742339-5b50-4117-b53c-25e8d385bad9`, by the session that started this pass).
- **The real replay** (PRD-05.R18) calls the model, and this session has no model login. It judges run 1 of [phase-58-replay.md](phase-58-replay.md), which fvermaut ran from his own terminal on this branch at `66a7af7`. Only the raw output in that run's block is used as evidence; the paragraphs below it are the build's account and are not evidence. `git diff --name-only 66a7af7 HEAD` lists only files under `doc/plans/`, so that run is on the code this branch carries.
- **The check scripts, all at once:** `REPLAY_RECORD=doc/plans/phases/reports/phase-58-replay.md node doc/plans/phases/probes/run.mjs --regression --only=<the 23 IDs above>`, real runs only, 5 min 22 s. 18 passed and 5 failed. Four of the five failures were faults of the check scripts on this host, not of Timone; each was fixed in the check script or shown by a run alone (see *Probes*). The fifth is PRD-05.R18.
- **Build-health smoke**, run once, not as evidence: `npx tsc --noEmit` exit 0, then `npx vitest run --reporter=json` on `c6b8a06` after `npm run build`: 77 test files, 2742 tests, **all passed**, 21 s.
- **Smoke failures:** none. Compared with `doc/plans/phases/reports/phase-57-verification.md` on `main` (lines 10–86: its smoke line and its named list of 70). All 70 failures named there were a refused `git push` inside a container (Timone #220); none of them fails here, on the Mac. This pass's list, for the next pass: empty.
- **Smoke against probes.** No test title in the suite concerns case #132 or a misspelled approval word, and the suite does not call the model. The suite and the check scripts do not disagree.

## Independence declaration

Read: `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` and `prd-03-a-run-ends-at-its-pull-request.criteria.md` whole, and both PRD narratives whole; the in-scope blocks of `prd-07-….criteria.md` (R1, R2, R4, R6, R9, R10), `prd-08-….criteria.md` (R5), `prd-09-….criteria.md` (R2, R4, R5) and `prd-10-….criteria.md` (R2 to R6, without their evidence lines); the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); and, **beyond the in-scope IDs**, the R1 block of `prd-04-….criteria.md`, register text only, to check replay case #132 against it. `phase-58.md`: its status line, *Screens changed* line and *Requirements* table, and **beyond the allowed list**, because the first 30 lines were printed at once, its *Companion phases* note and its *Goal Description*. They name source files and describe both fixes in outline. No verdict here uses them. `reports/phase-58-complete.md` whole; `reports/phase-58-replay.md` whole. `README.md`, `CONTEXT.md` and `package.json` whole. `STATUS.md` on `main` (headings, lines 1–40 and 60–160), to place this pass's update. The headings of `reports/phase-58-departures.md`, to append an entry, and **by a slip**, three lines of the build's second entry there (the replay's running call also sends the 30-second sign), which the completion report already says. On `main`, by `git show`: the heading list and lines 10–86 of `phase-57-verification.md` (its smoke line and list), and **beyond the allowed list**, its lines 87 and 91, which a search for the word "smoke" printed in full (its note that its smoke and probes agree, and its own independence declaration); the lines of `phase-57-departures.md` that a search for "verification" printed, and lines 12–17 of `phase-56-departures.md` (the form of a verification entry). The check-script folder: `run.mjs`, `_replay.mjs`, `_old-build.mjs`, `prd-05.r18.mjs` whole; parts of `_steps.mjs`, `prd-05.r3.mjs`, `prd-05.r7.mjs`, `_questions.mjs`, `prd-07.r9.mjs` and `prd-09.r4.mjs`. File-name lists only: `git diff --name-only origin/main...HEAD` and `git diff --name-only 66a7af7 HEAD`. Test **titles** and results from the test runner's JSON report, never test source. `doc/standards.md` does not exist in this project.

**The fix context's note** was longer than one paragraph. It named source files, functions and line numbers under `src/runner/` and said what they do. It was read. No verdict here rests on it: PRD-05.R18's verdict rests on the replay record and the register, and the conflict with PRD-04.R1 can be seen from the two registers and the replay's own output. A listing of this session's scratch folder showed two files that another part of this session wrote (a copy of a source file and a replay log). Neither was opened.

Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or changed this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R12 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R13 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R18 | MUST | api | REGRESSION | 1 |
| PRD-03.R1 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R2 | MUST | api | PASS | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-07.R1 | MUST | api | PASS | 0 |
| PRD-07.R2 | MUST | api | PASS | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-07.R10 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |
| PRD-10.R2 | MUST | api | PASS | 0 |
| PRD-10.R3 | MUST | api | PASS | 0 |
| PRD-10.R4 | MUST | api | PASS | 0 |
| PRD-10.R5 | MUST | api | PASS | 0 |
| PRD-10.R6 | MUST | api | PASS | 0 |

**The gate is not met:** one regression, PRD-05.R18, not resolved within the loops. Every other MUST criterion in scope is PASS or LIVE-GATE.

## Evidence

### PRD-05.R18 — REGRESSION

Run: `node doc/plans/phases/probes/prd-05.r18.mjs` (break run, then real run, because two of its checks were changed this pass; see *Probes*). It judged run 1 of `phase-58-replay.md`, at `66a7af7`. The register's table has 19 cases; the replay ran 24 (it also holds #202, #218 and the two #238 cases, which the table does not list).

```
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result
    break leg: RED (as required) — case #110 is missing from the result
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner
    break leg: RED (as required) — not a run of the real model with three tries each: "Replaying 24 cases, 3 tries each, with a scripted runner and no model (--dry)."
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    break leg: RED (as required) — 2 of the table's 19 cases did not choose the table's action on three tries of three: case #139: FAIL #139 — planted. 2 of 3 tries chose it. || case #132: …
    green leg: FAIL — 1 of the table's 19 cases did not choose the table's action on three tries of three: case #132: FAIL #132 — Act on the word. 0 of 3 tries chose it. Try 1: posted on the ticket: "You wrote "aproved". I want to be sure b…
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    break leg: RED (as required) — files outside doc/plans/ and doc/specs/ changed after run 1 (at 66a7af7…^): 3, under src/
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    break leg: RED (as required) — run 1's result is not in doc/plans/phases/reports/phase-58-replay.md at 66a7af7…
    green leg: PASS — assertion held
--- PRD-05.R18: FAIL (5 clause labels, 4 passing)
```

- **Clause 1 — FAIL on case #132.** The register's row: *"A stuck ticket, and a named person writes the one word that settles it. — Act on the word."* The replay's raw line: `FAIL #132 — Act on the word. 0 of 3 tries chose it.` On each try the runner posted a question whether "aproved" meant approve; the replay wanted fvermaut's approval of the requirements recorded, from his comment at 2026-09-17T09:05:12Z. The other 18 cases of the table passed 3 of 3, among them #110 (a step seen at its 15-minute check) and scratch-app#37 (which PRD-05.R7 rests on). The two #238 cases this phase added are not in the table; both passed 3 of 3.
- **The instrument was checked.** As recorded, only #132 fails. The same record with #132's line set to a pass gives no failing case. So the red comes from #132 and from nothing in the check script.
- **Clause 2 — PASS.** The run is on the code this branch carries, and its record is on the branch (`origin/timone/238-a-long-command-is-not-a-hung-step`).
- **Why it is a regression.** The criterion entered this pass `verified`. The cause of the failure is not this verdict's business; whatever change caused it, the shipped behaviour is now observed to differ from the register.
- **Fix loop 1** (see *Fix-loop accounting*): no commit. For the case as the replay sets it up, the word is misspelled, and [PRD-04.R1](../../../specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md) clause 1 says: *"WHEN the human replies with a word that is plainly a misspelling of an approval word, and asks for no change THEN the ticket's next message is one short question asking whether they meant to approve AND no stage session is started"*. That is what the runner did, on all three tries. The table's "Act on the word" and that clause cannot both hold for this case. Status `verified` → `failed`.

### PRD-05.R12 — LIVE-GATE

See *Live gates*. No probe and no script, as the channel requires.

### PRD-05.R13 — LIVE-GATE

See *Live gates*.

### PRD-03.R1 — LIVE-GATE

See *Live gates*.

### The regression set — PASS

Each of the 22 criteria below passed every clause its probe labels, on its real run. Per-clause output is in this session's runs; the short form:

- PRD-05.R2 (4 labels), R4 (6), R5 (6), R7 (4; its runner clause judged on the same replay run: scratch-app#37, 3 of 3), R10 (4) — in the run of all 23.
- PRD-05.R3 (19 labels) — failed 3 box clauses in the run of all 23 with `npm: command not found` inside the box; passed all 19 alone after the check script's fix, then again with a break run of every check (*Probes*).
- PRD-05.R11 (12 labels) — crashed in the run of all 23 before its clauses ran (*"could not build 5088b7e…"*); passed all 12 alone after the check script's fix.
- PRD-07.R1 (5), R2 (14), R4 (7), R6 (4), R10 (5); PRD-08.R5 (1); PRD-09.R2 (4), R5 (7); PRD-10.R2 (6), R3 (3), R4 (2), R5 (3), R6 (2) — in the run of all 23.
- PRD-07.R9 (4 labels) — failed 3 clauses in the run of all 23: its setup had not finished. The line *"after the read, the ledger holds for #12: nothing"* shows the daemon had not yet read the ticket in the script's fixed 8-second window, under the load of 23 scripts at once. Run alone, all 4 passed, and the same line showed the run on pull request #70. The PASS rests on that run. A weakness of the script, left for a later pass: clause 1 can pass while the daemon has read nothing.
- PRD-09.R4 (8 labels) — failed 3 clauses in the run of all 23 and alone, with *"the session opened NaN ms before the step ended"*. The stand-in terminal wrote its time with `date +%s%3N`, and the Mac's `date` has no `%N`. After the check script's fix, all 8 passed alone, then again with a break run of every check.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and no completion report item carries one forward.

## Live gates

- **PRD-05.R12** — last gate: [phase-40-live-gate.md](phase-40-live-gate.md), third attempt, 2026-09-30. **Owes a fresh one:** this phase changes the report the runner reads at its 15-minute check. What to watch: on ivtrends#178, its next checking step runs through a long test command and is not stopped.
- **PRD-05.R13** — last gate: [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-28 and 2026-09-30. **Owes a fresh one:** this phase changes the runner's rule for when to message or stop a step whose command is still running. What to watch: the same run; and a command that runs over two hours gets a message or a stop.
- **PRD-03.R1** — last gate: [phase-35-live-gate.md](phase-35-live-gate.md), 2026-09-07. **Owes a fresh one:** this diff changes `src/daemon/`, which it depends on. What to watch: every ivtrends step starts again (the clone before a step no longer times out).

The completion report says these sightings are ivtrends#178's own work after this merges, not a gate run on it. They were not run here.

Outside this phase's scope, 14 other `live` criteria declare a dependency on `src/daemon/` or `src/runner/` (in PRD-01, PRD-02, PRD-03 and PRD-07). They are not claimed by this phase and are not reported one by one.

## Regression

- PRD-05.R2 — PASS
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — **REGRESSION**, not resolved (above)
- PRD-07.R1 — PASS
- PRD-07.R2 — PASS
- PRD-07.R4 — PASS
- PRD-07.R6 — PASS
- PRD-07.R9 — PASS
- PRD-07.R10 — PASS
- PRD-08.R5 — PASS
- PRD-09.R2 — PASS
- PRD-09.R4 — PASS
- PRD-09.R5 — PASS
- PRD-10.R2 — PASS
- PRD-10.R3 — PASS
- PRD-10.R4 — PASS
- PRD-10.R5 — PASS
- PRD-10.R6 — PASS

What the narrowing removed (32 criteria are MUST, `api` and `verified`; 9 were removed because this diff touches none of the paths their `Depends-on` names):

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts, src/daemon/container-runtime.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R12 — `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

This diff changes `src/daemon/progress.ts`, `src/daemon/services.ts`, `src/runner/brief.ts`, `src/runner/session.ts`, `src/runner/replay/` and their tests, and documents under `doc/plans/`.

## Probes

**23 probes proven able to fail, 0 not.** Every probe in scope was proved able to fail by an earlier pass or by this one. None was written new this pass. None is marked as having no break step.

Break run, then real run, this pass:

- **PRD-05.R18** — two checks changed this pass (below). All 5 checks went red on their break leg; 4 then went green, and clause 1c stayed red on #132.
- **PRD-09.R4** — the stand-in terminal's time stamp changed this pass, and its earlier real run had failed. All 8 checks went red on their break leg, then green.
- **PRD-05.R3** — the box helper's search path changed this pass, and its earlier real run had failed. All 19 checks went red on their break leg (the box ones on the build from before phase 43: the box's push to `main` landed, and `gh` let a merge through), then green.

Real run only, this pass: PRD-05.R2, R4, R5, R7, R10, R11; PRD-07.R1, R2, R4, R6, R9, R10; PRD-08.R5; PRD-09.R2, R5; PRD-10.R2, R3, R4, R5, R6.

Changes to the check scripts, committed with this report:

- `_replay.mjs` — (1) blank lines at the top of a run's block are dropped: run 1's block starts with one, and the check that the run used the real model read `""` as its first line. (2) The replay may hold more cases than the register's table; it must hold at least the table's. (3) With no `REPLAY_RECORD`, the record is now the replay file of the highest phase (`phase-NN-replay.md`), not always phase 40's.
- `prd-05.r18.mjs` — clause 1c names every table case that failed, not only the first, and no longer needs the replay's own count line (*"N of N cases passed."*), which now counts cases the table does not list.
- `_steps.mjs` — the box's search path gains the folder of the node that runs the check, after `/usr/local/bin`. On a Mac with nvm, `npm` was not found inside the box, so the box stopped before the agent. In a container nothing changes.
- `_old-build.mjs` — a cache folder left half-built by a stopped run (here one from 2026-10-06) is removed before the build is moved into place. Before, every later run threw *"could not build"*.
- `prd-09.r4.mjs` — the stand-in terminal writes its time with node. The Mac's `date` printed `17916436183N` for `+%s%3N`.

Clause coverage: every register clause of every criterion in scope has a label its probe printed. No gap.

## Fix-loop accounting

**1 of 2 loops consumed.**

- **Loop 1.** One defect brief: PRD-05.R18, case #132, quoting clause 1 and the table's row, with PRD-04.R1 clause 1 named as a requirement the fix must keep true. The fresh fix context returned **no commit**. Its note: for the case as the replay sets it up, the table's "Act on the word" and PRD-04.R1 clause 1 cannot both hold, so it changed nothing; it ran only the dry replay on cases #132 and #218 (all passed, which checks the wiring and not the model's choice). No file changed, so the re-check had nothing to run again: the observation at `66a7af7` stands for `c6b8a06`. Every probe in scope was left as it was, for that reason. No screen changed, so there was no screen read to repeat.
- **Loop 2 was not used.** It would receive the same brief, and the fault needs a person to choose between two requirements, not a change to code.

## Figures on the preview's data

No screen changed in this phase (the phase file's *Screens changed* line: none).

## Questions for the human

None from the screens: no screen changed. The one decision only a person can make is under *Carried forward*.

## Register changes

- **PRD-05.R18** — `Status: verified` → `failed`, with a dated ✏ line on its evidence naming this report.
- No other status changed. PRD-05.R12, PRD-05.R13 and PRD-03.R1 are untouched, as the `live` channel requires. The 22 other criteria of the regression set stay `verified`.

## Carried forward

**PRD-05.R18 is `failed`.** Evidence: *Evidence* above, and run 1 of [phase-58-replay.md](phase-58-replay.md). The entry is in [phase-58-departures.md](phase-58-departures.md).

A person has to choose one of two things:

1. **Change what case #132 accepts**, so that a short question whether the misspelled word meant approve also passes, as the replay's #218 case already accepts. This changes the table row of PRD-05.R18.
2. **Drop or narrow PRD-04.R1**, so the runner records the approval from a misspelled word without asking. The runner's rules and the line in `process.md` about that question would then change with it.

Either way, the real replay must run again afterwards. It needs a model login, so fvermaut runs it from his own terminal:

```
cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-58b.txt
```

Its output goes into `phase-58-replay.md` as run 2, and the next check of this phase judges it.

**Also owed, and only fvermaut can start it:** the watched sighting of PRD-05.R12, PRD-05.R13 and PRD-03.R1 (*Live gates*).
