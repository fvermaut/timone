# Phase 60 — Verification Report

- **Date:** 2026-10-13
- **Phase:** [phase-60.md](../phase-60.md) — stamped `Complete`, completion report [phase-60-complete.md](phase-60-complete.md)
- **Scope:** PRD-07.R2 (clause 3), PRD-07.R3, PRD-05.R1 (clause 1), PRD-05.R18 (clause 2). The completion report's requirements line names the same four. The phase was driven by the bugs [timone#248](https://github.com/fvermaut/timone/issues/248) and [timone#249](https://github.com/fvermaut/timone/issues/249).
- **Live gate owed:** yes — PRD-07.R5, R7 and R14, whose `Depends-on` names `src/runner/`, which this phase changes; and PRD-04.R1, PRD-05.R9, R12, R13, R15 and PRD-08.R6, which declare no dependencies and rest on the runner's actions, wake and brief. See *Live gates*.
- **Regression set (derived):** 26 criteria — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- **Branch:** `timone/248-a-refused-ticket-waits-in-line` @ `03b5c13`, then `edd1e99` (the record of replay run 2, made by this pass; no file outside `doc/plans/` changed). No stacked phase to merge in: the branch's base is `main` at `534b4dd`.

## Environment

There is no app server and no screen in this phase. The thing under check is the built command line and its daemon, driven by the check scripts' rig: a fake forge, a fake model service and steps run in the daemon's own process. Nothing reached GitHub or a real model, except the replay below.

- **Build:** `npm run build` at `03b5c13`, exit 0. The check scripts run `dist/cli.js`.
- **Build from just before phase 60**, for break runs: `main` at `534b4dd`, compiled outside the tree by the check scripts' own helper (`_old-build.mjs`), never checked out.
- **Build-health smoke**, run once, not as evidence: `npx vitest run` at `03b5c13` after the build: 77 test files, 2752 tests, **all passed**, 34.3 s.
- **Smoke failures:** none. Compared with `doc/plans/phases/reports/phase-59-verification.md` on `main`, iteration 2, lines 243–244: its smoke passed whole and its list was empty. This pass's list, for the next pass: empty.
- **Smoke against check scripts:** the suite passed and every check script passed. No alarm.
- **The real replay** (PRD-05.R18): run once by this pass, on `03b5c13`, with fvermaut's lasting token, through `zsh -i -c 'cd ~/dev/timone/projects/timone && npm run --silent build && npm run --silent replay'`. The token was never read or printed. 24 of 24 cases, each three tries of three, $2.14. Its output is run 2 of [phase-60-replay.md](phase-60-replay.md), committed as `edd1e99` before this report. Run 1 of that record was made by the session that built the phase, at `3402ea7`, before the ADR note of 60c; the check scripts count a run only for the code it ran on, so they reported run 1 as older than this build.
- **Load on the machine.** The first one-command run started all 27 check scripts at once. Five of them failed on waits that ran out (details under *Probes*). Each of the five passed when run on its own, and the second one-command run, five at a time (`--jobs=5`, an option added this pass), passed 26 of 26. The load average at the start of the second run was 5.7, and 14.4 over the 15 minutes before it.
- **Processes left behind:** none. The fake `gh` processes these runs left (27, all under this pass's own temporary folder) were stopped at the end. The count of such processes from older runs is 12, as it was before this pass.

## Independence declaration

Read:
- `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` and `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` whole; the PRD-07 and PRD-05 narratives whole. By script, the `Priority`, `Status`, `Verify-via` and `Depends-on` fields of every register, the `Last live gate` lines of every `live` criterion, and the number of GIVEN clauses of every criterion. The blocks of PRD-04.R1, PRD-08.R6 and PRD-10.R8 whole (three `live` criteria with no `Last live gate` line).
- `doc/plans/phases/phase-60.md` lines 1–21: its status line, its *Companion phases* note (which names source files and function names in the runner), its *Screens changed* line and its *Requirements* section; and its list of `##` headings, which shows no sub-phase title. No sub-phase body.
- `reports/phase-60-complete.md` whole. It names functions in the runner's source; no verdict here uses them.
- `reports/phase-60-replay.md` whole (the record of the replay's output; only its output blocks are used as evidence).
- `reports/phase-60-departures.md` lines 1–6 and its heading list, to append an entry; and, beyond that, the last 200 bytes of the file, which a check of its ending printed (the last line of the build's entry).
- `README.md`, `CONTEXT.md`, `package.json` whole. `doc/standards.md` does not exist in this project. `STATUS.md` was not read: the session that started this pass updates it.
- On `main`, by `git show`: a search of `phase-59-verification.md` for its headings and for the word "smoke" printed its heading list (with its verdict headings) and lines 14–16, 21, 243–245 and 380. Lines 243–244 are the list this pass uses. **Beyond the allowed list**, lines 16 and 245 (its notes that its smoke and check scripts agree), line 21 (its independence declaration) and line 380 (its list of check scripts run without a break run) were printed too. No verdict here uses them.
- The check-script folder: `run.mjs`, `_lib.mjs`, `_rig.mjs`, `_places.mjs`, `_old-build.mjs`, `_replay.mjs`, `prd-07.r2.mjs`, `prd-07.r3.mjs`, `prd-07.r9.mjs`, `prd-05.r1.mjs`, `prd-05.r7.mjs`, `prd-05.r18.mjs` whole; `prd-05.r3.mjs` lines 1–120.
- File-name lists only: `git diff --name-only main...HEAD` and `git diff --name-only 3402ea7 HEAD`.
- What the built app showed the fake model service (the lines of the runner's brief about the project's place, the planner and the ticket's turn) and wrote in its run records and its ledger, on this build and on the build from just before phase 60. Test titles and the summary printed by the smoke run, never test source.

Not read: handoffs, diffs, source, the committed test suite, ADRs, the two bug reports. No implementation source was read; all criterion evidence below comes from verifier-authored check scripts, run from `doc/plans/phases/probes/` or extended this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R2 | MUST | api | PASS | 0 |
| PRD-07.R3 | MUST | api | PASS | 0 |
| PRD-05.R1 | MUST | api | BLOCKED — clause 1, the runner's own choice, needs a real model and has no replay case. Every part code does passes, and so does the runner's choice in clause 2 | 0 |
| PRD-05.R18 | MUST | api | PASS | 0 |
| PRD-05.R2, R3, R4, R5, R7, R10, R11 | MUST | api | PASS (regression) | 0 |
| PRD-07.R1, R4, R6, R9, R10, R12 | MUST | api | PASS (regression) | 0 |
| PRD-08.R2, R4, R5 | MUST | api | PASS (regression) | 0 |
| PRD-09.R2, R4, R5 | MUST | api | PASS (regression) | 0 |
| PRD-10.R2, R3, R4, R5, R6 | MUST | api | PASS (regression) | 0 |

PRD-07.R2 and PRD-05.R18 are both claimed and in the regression set; they are listed once. **Closing gate:** not met in one part. Every MUST criterion passes except PRD-05.R1, whose clause 1 is BLOCKED in its runner part. Zero regressions, within 0 of 2 fix loops.

## Evidence

All check scripts below ran on the build at `03b5c13`. "Break run" is a run where the check script must fail; here every break run used the build from just before phase 60 (`main` at `534b4dd`), where the faults of #248 and #249 are still present, unless said otherwise.

### PRD-07.R2 — PASS

`node doc/plans/phases/probes/prd-07.r2.mjs`, with `PROBE_REAL_ONLY=1 PROBE_BREAK_FOR='PRD-07.R2 clause 3 (recording an approval)'`: the new label does its break run and its real run; the 14 older labels do their real run only. All 15 labels pass; they passed again in the second one-command run.

Clause 3 gains one label this pass, for the step that writes a named person's approval into the requirements. One place. Ticket 13 writes its requirements while the place is free. Ticket 12 then starts a step that takes the place for 25 s. Ticket 14 asks to start a step and is refused. While ticket 12's step runs, the operator writes "looks right" on ticket 13, and its runner asks to record that approval.

```
=== PRD-07.R2 clause 3 (recording an approval) — a project with one place and a step of another ticket running: a ticket's runner asks to record a named person's approval, and the step that writes it does not start, and the ticket waits for its turn
    break leg: RED (as required) — the ticket does not wait for its turn in the ledger after the refusal: parked {"priority":false,"openedAt":"2026-09-01T10:00:00.000Z"}
    green leg: PASS — assertion held
    (refused with: "Refused: No place is free on fixture: run fixture#12/1 has a step running. This ticket now waits for its turn, and you are woken when a place is given to it."; the ticket in the ledger after it: parked {"priority":false,"openedAt":"2026-09-01T10:00:00.000Z","waitingSince":"2026-10-13T05:13:05.393Z"}; the writing step started at 2026-10-13T05:13:29.017Z, after the other step ended at 2026-10-13T05:13:26.028Z)
    (break leg, the build before phase 60: refused with "Refused: The approval is written down, but the step that writes it into the file did not start: No place is free on fixture: run fixture#12/1 has a step running."; the ticket in the ledger after it: parked {"priority":false,"openedAt":"2026-09-01T10:00:00.000Z"})
```

The older labels, each as it was printed:

- Clause 1 — no `places` line: 2 steps run, the third ticket is refused for want of a place. PASS.
- Clause 2 — `places: 3`: 3 run, the fourth is refused; `places: 1`: 1 runs. PASS.
- Clause 3 — with 2 places full; and with one place taken by a building, a sorting and a delivering step: the asking ticket's step does not start, and the ledger shows it waiting for a place. PASS.
- Clause 4 — one of two places taken: the second step starts while the first keeps running; no place taken: the step starts. PASS.
- Clause 5 — a ticket waiting for a person, for a merge with only an open pull request, or for its turn takes no place. PASS.
- Clause 6 — a runner session (at pickup and after a step) and a takeover terminal take no place. PASS.

### PRD-07.R3 — PASS

`node doc/plans/phases/probes/prd-07.r3.mjs`, with `PROBE_REAL_ONLY=1 PROBE_BREAK_FOR='PRD-07.R3 clause 3 (refused while recording an approval)'`. All 6 labels pass; they passed again in the second one-command run.

Clause 3 gains one label this pass, on the same fixture as above, followed to its end: ticket 13 (created 09-01) was refused while recording an approval, ticket 14 (created 09-05) was refused a step, and then ticket 12's step ends.

```
=== PRD-07.R3 clause 3 (refused while recording an approval) — a place given to the ticket that was refused when its runner asked to record an approval: its runner wakes and asks again, the step that writes the approval is not refused for want of a place, and no other ticket of the project was told that a place is free
    break leg: RED (as required) — the ticket refused while recording an approval was not given the freed place (told: never; the other ticket told: 2026-10-13T05:11:09.419Z; …)
    green leg: PASS — assertion held
    (waiting: #13 refused while recording an approval, created 09-01; #14 refused a step, created 09-05. The step holding the place ended at 05:11:08. #13 told at 05:11:09; its tries: ["Refused: No place is free on fixture: run fixture#12/1 has a step running. This ticket now waits for its turn, and you are woken when a place is given to it.","accepted"]; the writing step started at 05:11:10; #14 told: 0×)
    (break leg, the build before phase 60: #13 told 0×, #14 told 1×; #13's tries: ["Refused: The approval is written down, but the step that writes it into the file did not start: No place is free on fixture: run fixture#12/1 has a step running."])
```

The older labels: clause 1 (the place goes to the ticket labelled `priority:high`), clause 2 (to the oldest, with none or several labelled), clause 3 (the given ticket's step is not refused, and no other ticket is told — #184) and clause 4 (a given ticket that starts nothing passes the place on, in the same order). All PASS.

### PRD-05.R1 — BLOCKED in one part (clause 1, the runner's choice); everything else PASS

`node doc/plans/phases/probes/prd-05.r1.mjs`, first with `PROBE_REAL_ONLY=1 PROBE_BREAK_FOR='PRD-05.R1 clause 1 (code, another ticket has the place)'`, then again with `PROBE_REAL_ONLY=1` after replay run 2 was recorded.

Clause 1 gains one label for code's part, for the state #249 is about. One place. Ticket 13, a feature, is sorting. Ticket 12 asks to start a step and is refused, so it waits in line. When sorting ends, the place is given to ticket 12. Ticket 13 never asked for a place, so it is not in line. Its runner is woken after sorting and starts the interview.

```
=== PRD-05.R1 clause 1 (code, another ticket has the place) — a feature just sorted, while another ticket has the project's one place: the runner is not told the ticket waits for its turn, since it never asked for one; the interview it starts waits for a place, and starts when one is given to it
    break leg: RED (as required) — the runner is told the ticket waits for its turn, though it never asked for a place: "- The project's place: given to fixture#12/1. This ticket waits for its turn."
    green leg: PASS — assertion held
    (told after sorting: "- The project's place: given to fixture#12/1. This ticket is not in line for it: a step you try now is refused, and the refusal puts the ticket in line."; the interview's tries: ["Refused: No place is free on fixture: the place is given to run fixture#12/1. This ticket now waits for its turn, and you are woken when a place is given to it.","accepted"]; in the ledger after the refusal: {…,"waitingSince":"2026-10-13T05:01:39.281Z"}; place given at 05:01:53; interview started at 05:01:54)
=== PRD-05.R1 clause 1 (runner) — the real runner then starts the interview
    BLOCKED — needs a real model, and no case of the replay (PRD-05.R18) is a plain feature just sorted. …
=== PRD-05.R1 clause 2 (runner) — the real runner skips the interview and starts planning, and posts the departure — replay case #104, run 2, on each of three tries
    green leg: PASS — assertion held
--- PRD-05.R1: PASS (7 clause labels, 6 passing, 1 blocked, real run only)
```

The other labels pass: clause 1 (code) — after sorting, the runner is shown the interview as the next step of the default order; clause 2 (code) — requirements already on the default branch are shown; clause 3a and 3b — the step started is the one the runner chose, and nothing starts when it chooses nothing.

Clause 1's runner part is what #249 was about in practice: a real runner told its ticket waits for its turn has a reason to start nothing. The words it is now told are true, and code acts on its choice correctly. Whether a real model now tries the step is not observed by any instrument. See *Carried forward*.

### PRD-05.R18 — PASS

`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.r18.mjs --ref HEAD`, after `edd1e99`. `--ref` was added this pass: clause 2b reads the replay record at the named commit instead of at `origin`, because the record and this report are pushed together after this commit.

```
    (judged: run 2 of doc/plans/phases/reports/phase-60-replay.md — "Run 2 — 2026-10-13, at `03b5c13`", at 03b5c13)
    | Replaying 24 cases, 3 tries each, on claude-opus-5-5.
    | (24 lines PASS … 3 of 3 tries.)
    | 24 of 24 cases passed. The runner's sessions cost $2.14 in all.
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result, judged against the table's last column as the register now words it — PASS
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner — PASS
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case — PASS
=== PRD-05.R18 clause 1d — the #132 row: the replay counts acting on the word, and counts asking what it meant — PASS
=== PRD-05.R18 clause 1e — the #132 row: the replay does not count a comment that names the takeover command — PASS
=== PRD-05.R18 clause 1f — the #132 row: the replay does not count a question about something else as asking what the word meant — PASS
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them — PASS
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from — PASS
    (clause 2b read the record at HEAD)
--- PRD-05.R18: PASS (8 clause labels, 8 passing, real run only)
```

(Shortened: each label's two lines, "break leg: not run" and "green leg: PASS — assertion held", are folded into "— PASS", and the 24 case lines are left out; they are in run 2 of the record.)

Clause 2, as the phase claims it: 60b changed the runner's brief, and the replay was run on it twice — run 1 by the session that built it, and run 2 by this pass on the code the branch now carries. The pull request itself is written at delivery; this check reads the branch it is opened from.

### The regression set — PASS

`node doc/plans/phases/probes/run.mjs --regression --jobs=5 --only=<the 25 criteria of the set other than PRD-05.R18, plus PRD-07.R3>`, real runs only. PRD-05.R18 ran on its own, above, because of `--ref`.

```
| PRD-05.R2  | PASS | PRD-05.R3  | PASS | PRD-05.R4  | PASS | PRD-05.R5  | PASS
| PRD-05.R7  | PASS | PRD-05.R10 | PASS | PRD-05.R11 | PASS | PRD-07.R1  | PASS
| PRD-07.R2  | PASS | PRD-07.R3  | PASS | PRD-07.R4  | PASS | PRD-07.R6  | PASS
| PRD-07.R9  | PASS | PRD-07.R10 | PASS | PRD-07.R12 | PASS | PRD-08.R2  | PASS
| PRD-08.R4  | PASS | PRD-08.R5  | PASS | PRD-09.R2  | PASS | PRD-09.R4  | PASS
| PRD-09.R5  | PASS | PRD-10.R2  | PASS | PRD-10.R3  | PASS | PRD-10.R4  | PASS
| PRD-10.R5  | PASS | PRD-10.R6  | PASS
26 passing, 0 failing, 0 blocked, 0 with no probe.
```

(The table is folded into four columns here; the command prints one line per criterion.) PRD-05.R7 clause 1's runner part was judged on replay case scratch-app#37 in run 2: three tries of three.

PRD-07.R9 was then changed (see *Probes*) and run once more on its own, with both runs:

```
=== PRD-07.R9 clause 1 — … no new run starts for that ticket as new work
    break leg: RED (as required) — the ticket was told it was picked up as new work: "… **Picked this up.** …"
    green leg: PASS — assertion held
=== PRD-07.R9 clause 2 (merge) — break leg: RED — the run that owns the pull request did not wake after the merge; green leg: PASS
=== PRD-07.R9 clause 2 (close) — break leg: RED; green leg: PASS
=== PRD-07.R9 clause 2 (review) — break leg: RED; green leg: PASS
--- PRD-07.R9: PASS (4 clause labels, 4 passing)
```

Its break runs used the build from just before phase 47, as they always have.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no manual check forward.

## Live gates

This pass performs no live gate. Owed by this phase:

- **PRD-07.R5** (the planner decides which tickets build) — last live gate: never. Owed: its `Depends-on` names `src/runner/`, which this phase changes.
- **PRD-07.R7** (the update after a merge) — last live gate: never. Owed, for the same reason.
- **PRD-07.R14** (a pull request opened behind the default branch is brought level) — last live gate: never. Owed, for the same reason.
- **PRD-05.R9, R12, R13, R15** — last live gate: [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-30. **PRD-04.R1** and **PRD-08.R6** — no `Last live gate` line, so never. These six declare no `Depends-on`. This phase changes the runner's actions, how it is woken, and its brief (`src/runner/actions.ts`, `session.ts`, `brief.ts`). Their words rest on what the runner is told and does, and the file names alone cannot show that they do not rest on these files. So each is counted as owed.

Not owed: PRD-10.R8 (it declares no `Depends-on`; its words are about the check-script guard in a container, which no changed file name concerns); and every other `live` criterion (PRD-01, PRD-02, PRD-03 and PRD-06), whose `Depends-on` names nothing this phase changes.

## Regression

The derived set's results, each PASS in the second one-command run (five at a time):
PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R4, R6, R9, R10, R12; PRD-08.R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.

What the narrowing removed (their `Depends-on` names no file this phase changes; the changed files are under `src/runner/`, `doc/adr/` and `doc/plans/`):

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts` (checked anyway: it is claimed)
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`

## Probes

**28 probes proven able to fail, 0 not.** These are the check scripts of the 28 criteria in scope (the 26 of the regression set, PRD-07.R3 and PRD-05.R1). Each was proved able to fail by an earlier pass; four labels and one probe did a break run this pass:

- `prd-07.r2.mjs`, new label *clause 3 (recording an approval)* — first check of this case. Break run on the build before phase 60: RED. Real run: GREEN.
- `prd-07.r3.mjs`, new label *clause 3 (refused while recording an approval)* — first check of this case. Break run: RED. Real run: GREEN.
- `prd-05.r1.mjs`, new label *clause 1 (code, another ticket has the place)* — first check of this case. Break run: RED. Real run: GREEN.
- `prd-07.r9.mjs`, all four labels — changed this pass, so both runs were done. In the first one-command run its read of the tickets lasted a fixed 8 s, the daemon had not finished one cycle in that time, and clause 1 passed on a read that never happened. The read now waits until the ledger holds a run for the ticket, plus 6 s, and clause 1 checks that it does. Break run on the build before phase 47: RED on all four. Real run: GREEN.

Ran without a break run this pass: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R4, R6, R10, R12; PRD-08.R2, R4, R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6; and the older labels of PRD-07.R2, PRD-07.R3 and PRD-05.R1. None is one of the four cases that need one.

**The first one-command run.** `run.mjs --regression` with all 27 scripts started at once: 22 PASS and 5 FAIL — PRD-05.R4 (clauses 3a, 3b), PRD-05.R5 (clause 1), PRD-07.R1 (clause 1), PRD-07.R2 (clauses 4, 5) and PRD-07.R9 (clause 2). Each failure was a wait that ran out: a second ticket still waiting for the planner's decision when the wait ended, a run not ended in time, a read of the tickets that had not happened. Each of the five passed when run on its own on the same build, and in the second run, five at a time. These were the instrument's failures, not the app's, and no fix was asked for. `run.mjs` gained `--jobs=N`, which runs at most N check scripts at once.

**Other changes to the check scripts this pass:**
- `_rig.mjs` — `PROBE_BREAK_FOR` names labels that do their break run even in a real-run-only pass, so a new label can be proved without redoing the older ones.
- `_places.mjs` — two fixtures: `approvalAsks` (recording an approval with every place taken) and `sortedWhileTaken` (a feature sorted while another ticket has the place); and `before60`, the build from just before phase 60.
- `prd-05.r18.mjs` — `--ref`, described above.

**Clause coverage:** every criterion in scope prints a label for every clause of its register block. No gap.

## Fix-loop accounting

0 of 2 — the initial pass found no fault in the app. The five failures of the first one-command run are explained under *Probes*: they were waits that ran out under load, and each passed on its own.

## Figures on the preview's data

No screen changed in this phase. The phase file's *Screens changed* line says "none", and nothing here is drawn on a screen.

## Questions for the human

None.

## Register changes

No `Status` flip. Dated notes only:

- **PRD-07.R2** — a note: all six clauses pass, and clause 3 was also checked for the step that writes an approval. Stays `verified`.
- **PRD-07.R3** — a note: all four clauses pass, and clause 3 was also checked for a ticket refused while recording an approval. Stays `verified`.
- **PRD-05.R1** — a partial-evidence line: code's part passes, also with another ticket holding the place; the runner's choice in clause 2 passes on replay run 2; the runner's choice in clause 1 is still not settled. Stays `draft`.
- **PRD-05.R18** — an evidence line: both clauses pass on replay run 2. Stays `verified`.
- **PRD-05.R7** — an evidence line: the runner's part of clause 1 passes on replay run 2. Stays `verified`.

## Carried forward

- **PRD-05.R1 clause 1, the runner's own choice — BLOCKED.** Whether a real model, woken after sorting a plain feature, starts the interview. This phase changed what the runner is told in that state when another ticket has the place: it used to be told, falsely, "This ticket waits for its turn."; it is now told the ticket is not in line and that a refused try puts it in line. No replay case covers this state, so no instrument has seen what a real model does with the new words. What would close it: a replay case for a feature just sorted while another ticket holds the place, which is a new row in PRD-05.R18's table, for fvermaut to approve. Recorded in [phase-60-departures.md](phase-60-departures.md), entry of 2026-10-13, verification.
- **Owed live gates**, listed under *Live gates*. They are carried to the pull request as items to tick.
