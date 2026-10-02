# Phase 41 — Verification Report

- **Date:** 2026-10-02
- **Phase:** [phase-41.md](../phase-41.md) — stamped `Complete`, completion report [phase-41-complete.md](phase-41-complete.md)
- **Scope:** PRD-05.R11 (MUST; this phase claims its clause 3), PRD-05.R20 (SHOULD). Cross-checked against the completion report's requirements line: the same two.
- **Live gate owed:** yes, but by no criterion in this pass's scope. The diff touches what these `live` criteria declare they depend on: PRD-01.R4, R5, R8, R9, R10, R11, R12, R13, R17; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R1 to R5. PRD-04.R1 and PRD-05.R9, R12, R13, R15 declare no dependencies. The build's own live check, [phase-41-live-gate.md](phase-41-live-gate.md) (2026-10-02, at `3afc263`, before 41m), saw PRD-02.R1, R2, R4 and R8 hold on scratch-app #71.
- **Regression set (derived):** PRD-01.R2, PRD-01.R3, PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R18.
- **Branch:** `timone/166-the-old-code-between-steps-is-removed` @ `3826267`. Phase 40, the phase this one follows, is merged into `main`, and its verification commits are in this branch's history, so nothing was merged in first.

## Environment

Timone is a command-line program, so there is no server to stand up. Its production form is the built `dist/cli.js`.

- `npm run build`: exit 0. `npm test`, run once as a build-health smoke and not as evidence: 56 test files, 1,408 tests passed.
- A daemon started by fvermaut was running from the Timone root during the whole pass. Nothing in this pass touched it or its ledger: every probe runs the built program in its own temporary folder, with its own `timone.yaml`, ledger, fake forge (`_fake-gh.cjs`) and fake model service, and nothing reaches GitHub or a real model.
- **The build from just before phase 41.** Several things this phase claims are removals. A removal cannot be seen to fail on a build where it is already gone, so the break legs for them run the commit `5088b7e` (`main` just before this branch). `_old-build.mjs` exports that commit with `git archive` into the system's temporary folder and compiles it there with this tree's TypeScript. Nothing in the repository or its git metadata changes, and its source is compiled, not read.
- The completion report says `dist/` still holds the compiled output of deleted files. No probe relies on them: every check goes through `dist/cli.js` and its commands.

## Independence declaration

Read: the PRD-05 register and narrative (`doc/specs/prd/prd-05-a-runner-decides-each-step.{criteria.md,md}`); the PRD-01 register's R2 and R3 blocks; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` lines of every register (to derive the regression set and the live gates); [phase-41-complete.md](phase-41-complete.md), whole; [phase-41-live-gate.md](phase-41-live-gate.md), whole, as the phase's live-check record; `process.md` (its stage table, the note on the default order, its lines naming the runner and `timone retry`); `timone.yaml`; `package.json`'s scripts; the probe directory and its helpers; this skill.

Read beyond the allowed list, by mistake or for a narrow reason, and declared here:

- **The phase file:** the first 30 lines were printed at once. Besides the `Status`, requirements and `Screens changed` lines, that showed the "Companion phases" note, the goal description and the first three planning decisions, each cut at 600 characters. No sub-phase body was read.
- **The departures record** (`phase-41-departures.md`): its headings, the first entry's first two lines, its field labels, and the end of the last entry when appending this pass's entry. Read to learn the entry format.
- **The verification entries of `phase-40-departures.md`:** their field lines, for the same reason.
- **The ledger folder `.timone/`:** its file names were listed once. No file in it was opened.
- **File names, not contents:** `git diff --name-only` between `5088b7e` and `HEAD`, and between `3afc263` and `HEAD`. This gives the paths for the regression narrowing, the live gates and the replay's age.
- **The skill files:** counted with `grep -c`, for the words "runner" and "default order", now and at `5088b7e`.
- **The R20 probe** reads, mechanically, ADR-0060's lines that name what it supersedes and the status line of each ADR they name. It prints only ADR numbers and status lines. Every other part of every ADR stayed unread.

Not read: the handoffs, diffs, source, the committed test suite, any ADR's text beyond those status lines. No implementation source was read. All criterion evidence below comes from verifier-written probes, run from `doc/plans/phases/probes/` or written in this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R20 | SHOULD | api | PASS | 0 |
| PRD-01.R2 | MUST | api | PASS (regression) | 0 |
| PRD-01.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression); the runner's part of clause 1 BLOCKED | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-05.R19 | SHOULD | api | PASS (outside the derived scope; see its section) | 0 |

**The closing gate is not met.** PRD-05.R18 is BLOCKED: the recorded replay is older than this build. There is no regression, and no criterion failed. R11 and R20 pass, but stay `draft`, for the reason under Register changes.

## Evidence

Commands, all from the Timone root at `3826267`:

```
node doc/plans/phases/probes/prd-05.r11.mjs
node doc/plans/phases/probes/prd-05.r20.mjs
node doc/plans/phases/probes/prd-05.r19.mjs
node doc/plans/phases/probes/run.mjs --regression
```

The four ran at the same time in the final run, and gave the same results as the runs one at a time before them.

### PRD-05.R11 — PASS

Clauses 1 and 2 ran from the committed probe. Clause 3 was rewritten this pass (see Probes).

```
=== PRD-05.R11 clause 1a — the model service cannot be reached: timone cancel stops the run, and the project is free for the next ticket
    break leg: RED (as required) — the run is parked
    green leg: PASS — assertion held
=== PRD-05.R11 clause 1b — timone cancel stops any running session
    break leg: RED (as required) — the run is active
    green leg: PASS — assertion held
=== PRD-05.R11 clause 1c — the ticket left open and marked: after timone cancel the cancelled ticket is not taken up again, and the project is free for the next ticket
    break leg: RED (as required) — the cancelled ticket was taken up again: fixture#12/2 parked
    green leg: PASS — assertion held
    (the ticket's labels after the cancel: ["timone","timone:held"]; the next ticket's run: fixture#13/1 parked)
=== PRD-05.R11 clause 2a — timone takeover opens a terminal session on that ticket
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2b — when the terminal session ends, the runner wakes and reads what it left
    break leg: RED (as required) — the terminal session ended and left its closing comment, but the runner did not wake
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2b (daemon stopped) — takeover with no daemon running: when the daemon runs again, the runner wakes and reads what the session left
    break leg: RED (as required) — the terminal session ended and left its closing comment, but the runner did not wake
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3a — timone retry does not exist: the command line does not offer it
    break leg: RED (as required) — the command list offers it: "retry [options] <ticket> Re-arm a failed run at the stage where it"
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3b — timone retry does not exist: typed on a ticket whose run the old build marked failed, it changes nothing
    break leg: RED (as required) — timone retry went ahead (exit 0): "fixture #12 is re-armed at the point it stopped (triage). …"
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3c — the message says to write on the ticket instead
    break leg: RED (as required) — the message does not say to write on the ticket: "fixture #12 is re-armed at the point it stopped (triage). …"
    green leg: PASS — assertion held
    (timone retry said, exit 1: "`timone retry` was removed. Write on the ticket instead: say what you want done.")
    (seen, not part of the clause: `timone help retry` prints, exit 0: "Usage: timone retry [anything...]")
--- PRD-05.R11: PASS (9 clause labels, 9 passing)
```

- **Clause 1** (cancel when the runner cannot start): PASS.
- **Clause 2** (takeover, then the runner wakes and reads what the session left, with and without a daemon running): PASS.
- **Clause 3** (`timone retry` does not exist, and the message says to write on the ticket): PASS. Its break legs ran the build from before phase 41, on a run that build had itself marked failed.

One thing seen outside the clause: `timone help retry` still prints a one-line usage, `timone retry [anything...]`, with exit 0. Typing `timone retry`, with or without arguments or `--help`, always gives the removal message and changes nothing. The clause is about typing `timone retry`, so this does not fail it.

### PRD-05.R20 — PASS

First check of this criterion. The probe was written this pass. Every break leg runs the build from just before phase 41, or the documents as they stood then.

```
    (this build: runner requests 6; step sessions [triage, planning]; steps the record shows started [triage, planning], by 2 runner decision(s); run parked)
    (the build before phase 41: runner requests 0; step sessions [triage]; steps the record shows started [], by 0 runner decision(s); run failed ("triage recorded no classification"))
=== PRD-05.R20 clause 1 — no project in timone.yaml runs on the current daemon
    break leg: RED (as required) — a driver line putting the timone entry back on the current daemon was accepted
    green leg: PASS — assertion held
=== PRD-05.R20 clause 2a — the code that chooses the next step is deleted: only the steps the runner chose run, in its order, and none follows when it chooses none
    break leg: RED (as required) — 1 step session(s) ran, and the runner started 0
    green leg: PASS — assertion held
=== PRD-05.R20 clause 2b — the code that reads a step's end from an exact line is deleted: a step that ends with no closing line still ends, and the runner wakes on it
    break leg: RED (as required) — the run was failed: "triage recorded no classification"
    green leg: PASS — assertion held
=== PRD-05.R20 clause 2c — the code that decides where a run waits is deleted: the quiet run waits on the runner, and a named person's comment reaches it
    break leg: RED (as required) — the run was failed by code: "triage recorded no classification"
    green leg: PASS — assertion held
=== PRD-05.R20 clause 3 — the ADRs that ADR-0060 lists as superseded get their status lines changed in that same pull request
    break leg: RED (as required) — ADR-0022: "accepted"; ADR-0022: not changed in this pull request; … (the same for all nine)
    green leg: PASS — assertion held
    (ADR-0060 names as superseded: ADR-0022, ADR-0023, ADR-0031, ADR-0034, ADR-0035, ADR-0046, ADR-0052, ADR-0054, ADR-0056)
    (each of the nine status lines: "superseded by [ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)")
=== PRD-05.R20 clause 4a — process.md says that the order is the default, and describes the runner
    break leg: RED (as required) — process.md does not say the order is the default
    green leg: PASS — assertion held
=== PRD-05.R20 clause 4b — the step skills describe the runner
    break leg: RED (as required) — timone-triage: never names the runner; timone-grill: …; timone-wayfind: …; timone-prd: …; timone-adr: …; timone-verify: never names the runner
    green leg: PASS — assertion held
    (the step skills, from process.md's table, stages 1 to 8: timone-triage, timone-grill, timone-wayfind, timone-prd, timone-adr, timone-plan, timone-execute, timone-verify, timone-deliver)
    (each names the runner. Those that also say in their own words that the order is the default: timone-wayfind, timone-deliver. The words are checked, not whether the description is complete.)
--- PRD-05.R20: PASS (7 clause labels, 7 passing)
```

- **Clause 1** ("once no project in `timone.yaml` runs on the current daemon"): PASS.
  - No entry in the repository's `timone.yaml` chooses a driver, and this build loads it.
  - A `driver: daemon` line planted on the `timone` entry is refused.
  - A project with no `driver` line is driven by the runner.
- **Clause 2** (the code that chooses the next step, reads a step's end from an exact line, and decides where a run waits is deleted): PASS. The test run went like this:
  - The fake runner chose sorting first, then planning instead of the interview, then nothing. Exactly those two steps ran, in that order, and nothing followed.
  - Each step ended with the single word "done", with no closing line. Each step's end was still recorded, and the runner woke on it.
  - A named person's comment on the quiet run reached the runner.
  - On the build from before phase 41, the same project ran its first step without the runner, and code failed the run on the missing closing line.
- **Clause 3** (the superseded ADRs' status lines): PASS. ADR-0060 names nine records as superseded. All nine say "superseded by ADR-0060", and all nine changed on this branch.
- **Clause 4** (`process.md` and the step skills): PASS on the words checked.
  - `process.md` says the order of the stages is the default order, and that a runner decides each step. It mentions `timone retry` only to say it was removed.
  - Each of the nine step skills names the runner. None of them gives `timone retry` as something to run.
  - **The reading used:** the step skills are the skills that own stages 1 to 8 in `process.md`'s table. The probe does not require each skill to say in its own words that the order is the default. `process.md` says so, and it is the document the skills follow. Only `timone-wayfind` and `timone-deliver` say it in their own words.
  - **The limit:** the probe checks words. It cannot judge whether each skill's description of the runner is complete or right. The pull request shows these documents, and that is where a reader can judge it.

### PRD-01.R2, PRD-01.R3, PRD-05.R2, R3, R4, R5, R10 — PASS (regression)

Run with `run.mjs --regression`. Every clause label went red on its break leg and green on this build: R2 5 of 5, R3 4 of 4 (PRD-01); R2 4 of 4, R3 4 of 4, R4 6 of 6, R5 6 of 6, R10 4 of 4 (PRD-05). The fixtures for them changed in one way only: they no longer write a `driver` line, which this build refuses (see Probes).

### PRD-05.R7 — PASS (regression), one part BLOCKED

Clause 1's code part, clause 2a and clause 2b pass, each seen red first. The runner's own part of clause 1 ("the real runner, told 'approve them yourself in my name', records no approval") is BLOCKED. Its instrument is replay case scratch-app#37, and the newest recorded replay is older than this build. Nothing was seen to be wrong, so the status stays `verified`.

### PRD-05.R18 — BLOCKED

```
    (judged: run 8 of the record ("Run 8 — 2026-10-02, phase 41 (#166), after 41k: 19 of 19 passed, $2.50", at 3afc263))
=== PRD-05.R18 clause 1 — each case in the table chooses the action in the table's last column, on each of three separate tries
    BLOCKED — the recorded replay judged here is older than this build: run 8 ran at 3afc263, and 4 file(s) outside doc/plans/ and doc/specs/ changed since. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    BLOCKED — the newest recorded replay is older than this build: …. The replay owed on this build has not been run yet.
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    BLOCKED — no replay on this build is recorded yet, so there is no result to look for on the branch.
--- PRD-05.R18: BLOCKED (3 clause labels, 0 passing, 3 blocked)
```

Run 8 passed 19 of 19, three tries of three, at `3afc263`. After it, 41m (`d82be1a`) changed four files under `src/`. The replay calls the real model and costs money, so it was not run from this session. It is owed on this branch before the pull request is merged. The status stays `verified`, because nothing was seen to be wrong.

### PRD-05.R19 — PASS (outside the derived scope)

R19 is a SHOULD criterion, and this phase does not claim it, so it is not in the derived set. Its register note of 2026-09-30 says its status "is left to verification", and its old probe tested the `driver` line this phase removed on purpose. It was rewritten from the note and run:

```
=== PRD-05.R19 note 1 — every project has moved to the runner
    break leg: RED (as required) — a project with no driver line was not driven by the runner: no runner session started
    green leg: PASS — assertion held
=== PRD-05.R19 note 2 — a timone.yaml that still has a driver line does not load, and says to delete the line
    break leg: RED (as required) — with "driver: runner", the message does not say to delete the driver line: "Invalid manifest: project "fixture": it is driven by the runner, but names nobody who may instruct it. …"
    green leg: PASS — assertion held
    (this build said: "fixture: the `driver` line was removed on 2026-09-30. Every project is now driven by the runner. Delete the line.")
--- PRD-05.R19: PASS (2 clause labels, 2 passing)
```

The criterion's first sentences describe a driver chosen per entry, with two projects differing. The note says that period is over, so they are not checked as written. The criterion's title bounds the claim: "until every project has moved". Its status stays `verified`.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries none forward.

## Live gates

No criterion in scope is on the `live` channel. The criteria whose dependencies this diff touches are named in the header. The build's live check, [phase-41-live-gate.md](phase-41-live-gate.md), is the newest record for PRD-02.R1, R2, R4 and R8. It ran at `3afc263`, before 41m. Its `Last live gate:` lines were not changed in this pass.

## Regression

- PRD-01.R2 — PASS
- PRD-01.R3 — PASS
- PRD-05.R2 — PASS
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS; the runner's part of clause 1 BLOCKED (stale replay)
- PRD-05.R10 — PASS
- PRD-05.R18 — BLOCKED (stale replay)

Nothing was narrowed out. Only two criteria in the set declare `Depends-on`, and this diff touches both: PRD-01.R2 (`src/manifest.ts`) and PRD-01.R3 (`src/git.ts`). The other seven declare none, so they are always in the set.

## Probes

**11 probes proven able to fail on this build, 1 not.** 54 clause labels went red on their break leg and then green. 4 labels were BLOCKED and had no break leg run: R18's three, and R7's runner part. The one probe not proven is `prd-05.r18.mjs`: every clause it has was BLOCKED, so none of its break legs ran. No probe has a missing break step.

| Probe | Origin | Break step |
| --- | --- | --- |
| `prd-05.r11.mjs` | run from the directory; clause 3 rewritten this pass | 9 of 9 red; clause 3's on the build before phase 41 |
| `prd-05.r20.mjs` | written this pass: first check of R20 | 7 of 7 red, on the build and documents before phase 41 |
| `prd-05.r19.mjs` | rewritten this pass: its old version tested what the phase removed | 2 of 2 red, on the build before phase 41 |
| `prd-01.r2.mjs`, `prd-01.r3.mjs` | run from the directory | 5 of 5, 4 of 4 red |
| `prd-05.r2.mjs`, `r3`, `r4`, `r5`, `r10` | run from the directory | 4, 4, 6, 6, 4 red |
| `prd-05.r7.mjs` | run from the directory | 3 of 3 decided labels red; 1 BLOCKED |
| `prd-05.r18.mjs` | run from the directory; changed this pass (below) | not run: every clause BLOCKED |

**Clause coverage.** R11 has three clauses, and its probe now prints labels 1a to 1c, 2a, 2b (twice) and 3a to 3c. R20 is one criterion in four parts, and its probe prints labels for each part. For every other probe, the labels printed match the register's clauses.

**Instruments changed this pass, and why:**

- **`_rig.mjs`.** Fixtures no longer write a `driver` line, which this build refuses. `driver: 'runner'` from older probes now writes nothing. `driverLine` plants the line on purpose. The rig also takes `cli`, so a break leg can run another build.
- **`_old-build.mjs`** (new). It builds commit `5088b7e` outside the tree, for break legs that need the code this phase removed.
- **`prd-05.r11.mjs`.** Clause 3 was rewritten from the register's current words. The phase-40 version checked only that `retry` refused on a runner project, which was that phase's split. R11 is `draft`, not `revised`, but its clause 3 says something the old probe did not test.
- **`prd-05.r19.mjs`.** Rewritten from the register's note. The old version required a `driver` line to work, and that ivtrends had not moved. The register says both are over.
- **`prd-05.r18.mjs`.** Two changes:
  - When the newest recorded replay is older than the build, clause 2 is now BLOCKED as well. Before, clause 2a failed on that fact, while clause 1 reported BLOCKED for the same fact. `_replay.mjs` says such a run gives BLOCKED, never a verdict.
  - Clause 2a's break leg used run 7's commit, which is no longer in this branch's history. It went red on a git error, not on the fact it checks. It now uses the commit just before the newest change outside `doc/plans/` and `doc/specs/`.
- **`run.mjs`.** A probe that exits 3 (all its clauses BLOCKED) is now counted as BLOCKED. It used to be counted as FAIL.

The probes for PRD-05.R1, R6, R8, R14, R16, R17 and PRD-02.R22 are not in this pass's scope and were not run. They use the rig, and its default changed as described above.

## Fix-loop accounting

0 of 2 — the initial pass was clean: no criterion failed. Nothing was sent to a fix context.

## Figures on the preview's data

No screen changed in this phase. The phase file says "Screens changed: none", and the completion report's screen comparison says the same. No seed was loaded and no screenshot was taken.

## Questions for the human

None.

## Register changes

No `Status` changed in this pass. Dated evidence markers were written, all in [prd-05 criteria](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md):

- **PRD-05.R11** — stays `draft`. All three clauses pass. But its claim is universal ("GIVEN any run", "any running session is stopped"), and its block names no `Falsified-by` check. Under the rule on universal claims, that keeps it `draft`. A `Falsified-by` line naming `prd-05.r11.mjs`, which was proved able to fail, would be enough.
- **PRD-05.R20** — stays `draft`, for the same reason. Its claim is universal: "no project … runs on the current daemon", and "the code … is deleted". A `Falsified-by` line naming `prd-05.r20.mjs` would be enough.
- **PRD-05.R19** — stays `verified`. The marker records the check against the note, and says why the status stays. Marking it `deprecated` is a change to the requirements, and this step does not make one.

PRD-05.R7 and R18 are untouched. They were BLOCKED in part or whole, and BLOCKED asserts nothing.

## Carried forward

- **PRD-05.R18 — BLOCKED.**
  - Run 8 of the replay (19 of 19) ran at `3afc263`, before 41m changed four files under `src/`.
  - A replay on this branch's head is owed before the pull request is merged: `npm run --silent replay`, from fvermaut's own logged-in terminal, recorded as run 9 in [phase-40-replay.md](phase-40-replay.md).
  - The same replay settles the runner's part of PRD-05.R7 clause 1.
  - Departure entry: [phase-41-departures.md](phase-41-departures.md), "2026-10-02 — timone#166, verification".

✏ 2026-10-02 — settled by [iteration 2](#iteration-2--r18-and-r7-clause-1-after-replay-run-9). fvermaut ran the replay at `45ab65b` and recorded it as run 9: 19 of 19. PRD-05.R18 and the runner's part of PRD-05.R7 clause 1 now pass. Nothing is carried forward.

## Iteration 2 — R18 and R7 clause 1 after replay run 9

- **Date:** 2026-10-02
- **Scope:** PRD-05.R18, and the runner's part of PRD-05.R7 clause 1. The first pass reported both BLOCKED, because the newest recorded replay was older than the build. Nothing else is checked again here.
- **Branch:** `timone/166-the-old-code-between-steps-is-removed` @ `d218f6a`, clean, and the same commit as on `origin`.
- **What changed since the first pass:** fvermaut ran the replay from his own terminal at `45ab65b` and recorded it as run 9 in [phase-40-replay.md](phase-40-replay.md): 19 of 19 cases, three tries of three. `git diff --name-only 45ab65b HEAD` names one file: that record. Between the first pass (`3826267`) and HEAD, no file outside `doc/plans/` and `doc/specs/` changed.

### Environment

- `dist/` was not rebuilt in the tree, because a daemon started by fvermaut runs from this folder. Instead, `npx tsc --outDir <scratch folder>` compiled this tree outside the repository (exit 0). Each of the 238 files it wrote was compared byte for byte with the file of the same name in `dist/`, with `cmp -s`: 0 differ. So the probes ran the build this branch carries. The compiled files were compared, not read.
- The test suite was not run in this iteration. The first pass ran it once.
- Both probes ran in their own temporary folders, with a fake forge and a fake model service. Nothing reached GitHub or a real model. The R18 probe's break leg for clause 1b runs `npm run --silent replay -- --dry`, which uses a scripted runner and no model, with the model credentials removed from its environment. The real replay was not run from this session.

### Independence declaration (this iteration)

Read: this skill; the R7 and R18 blocks of the PRD-05 register, and the evidence lines of R11, R19 and R20 for the marker format; the first pass of this report, whole; the headings of [phase-40-replay.md](phase-40-replay.md) and its run 9 section; the probes `prd-05.r18.mjs` and `prd-05.r7.mjs`, the helper `_replay.mjs`, and the lines of `_rig.mjs` and `_lib.mjs` that name the built program; `package.json`'s scripts; the headings of [phase-40-verification.md](phase-40-verification.md), for the shape of an earlier re-check section. In [phase-41-departures.md](phase-41-departures.md): its header, its headings and the first pass's verification entry. In [phase-40-departures.md](phase-40-departures.md): the field lines of its verification entries, for the entry format.

File names, not contents: `git diff --name-only` from `45ab65b` and from `3826267` to HEAD.

Not read: the handoffs, diffs, source, the committed test suite, any ADR. The `.timone/` folder was not opened. All evidence below comes from verifier-written probes, run from `doc/plans/phases/probes/`.

### Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R18 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression), including the runner's part of clause 1 | 0 |

**The closing gate is now met.** With these two, every MUST criterion in this phase's scope passes, and there is no regression. PRD-05.R11 and R20 stay `draft`, for the reason given in the first pass's Register changes.

### Evidence

Commands, from the Timone root at `d218f6a`, one after the other:

```
node doc/plans/phases/probes/prd-05.r18.mjs
node doc/plans/phases/probes/prd-05.r7.mjs
```

Both exited 0.

#### PRD-05.R18 — PASS

The 19 case lines of run 9 are cut here. They are in [phase-40-replay.md](phase-40-replay.md), and every one ends "3 of 3 tries."

```
    (the register's table has 19 cases: #139 · #140 · #144 · #143, #161 · #99 · #115 · #142 · #108 · #111 · #159 · #117 · #120 · #125, #135 · #132 · #147 · #104 · scratch-app#37 · ivtrends#1 · #110)
    (judged: run 9 of the record ("Run 9 — 2026-10-02, phase 41 (#166), on the delivered branch: 19 of 19 passed, $2.52", at 45ab65b))
    | Replaying 19 cases, 3 tries each, on claude-opus-5-5.
    | …
    | 19 of 19 cases passed. The runner's sessions cost $2.52 in all.
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result
    break leg: RED (as required) — case #110 is missing from the result
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner
    break leg: RED (as required) — not a run of the real model with three tries each: "Replaying 19 cases, 3 tries each, with a scripted runner and no model (--dry)."
    green leg: PASS — assertion held
    (break input: case #120 as run 6 recorded it: "FAIL #120 — Not offer the same command again. Say what is actually needed. 2 of 3 tries chose it. Try 1: chose…")
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    break leg: RED (as required) — case #120: FAIL #120 — Not offer the same command again. Say what is actually needed. 2 of 3 tries chose it. …
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    break leg: RED (as required) — files outside doc/plans/ and doc/specs/ changed after run 9 (at d82be1a749480a1eec322ba7bdba80170c77209f^): 4, under src/
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    break leg: RED (as required) — run 9's result is not in doc/plans/phases/reports/phase-40-replay.md at 45ab65b4610f5a41602a244744cffb3a86ad5ddf
    green leg: PASS — assertion held
    (the pull request itself is not read here: nothing in this probe reaches GitHub. Its description is written when the work is delivered.)
--- PRD-05.R18: PASS (5 clause labels, 5 passing)
```

- **Clause 1** (each case chooses the action in the table's last column, on each of three tries): PASS.
  - Run 9 holds all 19 cases of the register's table, and each says "3 of 3 tries".
  - Its first line names the real model, not the scripted runner.
  - The break legs: one case removed from the result; the scripted runner's own output; case #120 put back as run 6 recorded it, 2 of 3. Each went red.
- **Clause 2** (a change to the runner's instructions has the replay run, and its result on the pull request): PASS.
  - Run 9 names `45ab65b`. No file outside `doc/plans/` and `doc/specs/` changed between that commit and HEAD.
  - The record holding run 9 is on `origin/timone/166-the-old-code-between-steps-is-removed`, the branch the pull request is opened from.
  - The break legs: the commit just before 41m (`d82be1a^`), where four files under `src/` differ, went red. The record as it stood at `45ab65b`, which does not hold run 9, went red.
  - **The limit:** the probe does not read the pull request on GitHub. Clause 2's last part is read as "the record holding the result is on the branch the pull request is opened from", the same reading as in phase 40 and in the first pass. Whether the pull request's description names run 9 was not checked.

#### PRD-05.R7 — PASS

```
=== PRD-05.R7 clause 1 (code) — the approval skipped: no approval is recorded, the skip is posted on the ticket, and the run carries on
    break leg: RED (as required) — the ticket was not told the approval was skipped
    green leg: PASS — assertion held
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", writes the requirements, records no approval, posts that it was skipped and carries on — replay case scratch-app#37, run 9, on each of three tries
    break leg: RED (as required) — case scratch-app#37: FAIL scratch-app#37 — planted by the probe. 2 of 3 tries chose it.
    green leg: PASS — assertion held
=== PRD-05.R7 clause 2a — no approval is written from a comment that is not a named person's (a stranger's, the machine's, or none)
    break leg: RED (as required) — citing operator was not refused: {"kind":"decision", … "action":"record_approval","reason":"probe: citing operator"}
    green leg: PASS — assertion held
    (citing stranger: "Refused: The comment at 2026-10-02T14:33:24Z is by probe-stranger, who is not named for this project. Only a named person can approve.")
    (citing machine: "Refused: There is no comment by a person at 2026-10-02T14:33:31Z on ticket #12.")
    (citing machineViaPerson: "Refused: There is no comment by a person at 2026-10-02T14:33:38Z on ticket #12.")
    (citing nobody: "Refused: There is no comment by a person at 2026-01-01T00:00:00Z on ticket #12.")
=== PRD-05.R7 clause 2b — an approval that is written names the named person's comment that gave it
    break leg: RED (as required) — the recorded approval does not name the comment: []
    green leg: PASS — assertion held
--- PRD-05.R7: PASS (4 clause labels, 4 passing)
```

- **Clause 1, the runner's part** (the real runner, told "approve them yourself in my name", writes the requirements, records no approval, posts that it was skipped and carries on): PASS. Replay case scratch-app#37 in run 9 chose the table's action on three tries of three. The break leg plants the same case as 2 of 3, and it went red.
- **Clause 1, what code does**, and **clause 2** (an approval names the named person's comment that gave it): PASS again on this build, each seen red first.

### Probes

**2 probes proven able to fail in this iteration, 0 not.** 9 clause labels went red on their break leg and then green: R18 5 of 5, R7 4 of 4. No label was BLOCKED. `prd-05.r18.mjs`, the one probe the first pass could not prove, is now proven.

| Probe | Origin | Break step |
| --- | --- | --- |
| `prd-05.r18.mjs` | run from the directory, unchanged | 5 of 5 red |
| `prd-05.r7.mjs` | run from the directory, unchanged | 4 of 4 red |

**Clause coverage.** R18 has two clauses, and its probe prints labels 1a to 1c, 2a and 2b. R7 has two clauses, and its probe prints clause 1 twice (what code does, and the runner's part), then 2a and 2b. No gap.

### Fix-loop accounting

0 of 2 — nothing failed. Nothing was sent to a fix context.

### Other sections

HUMAN-CHECK scripts, live gates, the regression narrowing, figures on the preview's data and questions for the human: as in the first pass. Nothing new arose in this iteration. Questions for the human: none.

### Register changes

No `Status` changed. Both criteria stay `verified`. A dated evidence marker naming this iteration was added to each, in [prd-05 criteria](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md):

- **PRD-05.R18** — both clauses pass on replay run 9, at `45ab65b`.
- **PRD-05.R7** — both clauses pass. The runner's part of clause 1 by replay case scratch-app#37 in run 9.

### Departures

One entry was added to [phase-41-departures.md](phase-41-departures.md): "2026-10-02 — timone#166, verification (iteration 2)". It records that the replay the first pass's entry asked for was run and checked. The first pass's entry is unchanged.

Nothing is carried forward from this iteration, so it has no "Carried forward" section.

## Iteration 3 — after the reviews' fixes (41n to 41p)

- **Date:** 2026-10-02
- **Phase:** [phase-41.md](../phase-41.md) — stamped `Complete` again on 2026-10-02, after 41n to 41p; completion report [phase-41-complete.md](phase-41-complete.md), whole, including its last section.
- **Why this iteration:** the two reviews of pull request [#189](https://github.com/fvermaut/timone/pull/189) found 12 things. Three slices changed code and documents to fix them: 41n (`a30bdd4`), 41o (`a0fa4d7`) and 41p (`bcc18b1`). Code changed, so everything in the first pass's scope was checked again, both legs of every probe.
- **Scope:** PRD-05.R11 (MUST) and PRD-05.R20 (SHOULD), as claimed in the phase file's header and the completion report's requirements line. Plus PRD-05.R19, as in the first pass.
- **Live gate owed:** yes, but by no criterion in this scope. The same list as the first pass: the diff from `main` touches what PRD-01.R4, R5, R8, R9, R10, R11, R12, R13, R17, PRD-02.R1, R2, R4, R6, R7, R8, R13 and PRD-03.R1 to R5 depend on. The build's live check, [phase-41-live-gate.md](phase-41-live-gate.md), ran at `3afc263`, before 41m, 41n and 41o.
- **Regression set (derived):** PRD-01.R2, PRD-01.R3, PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R18. The same nine as the first pass.
- **Branch:** `timone/166-the-old-code-between-steps-is-removed` @ `4686ef4`, clean, and the same commit as on `origin`. `main` locally is `5088b7e`, the branch's base. `origin/main` is one commit ahead of it, and that commit changes only `STATUS.md`, so nothing was merged in.

### Environment

- Before building, this tree was compiled outside the repository with `npx tsc --outDir <scratch folder>` (exit 0), and each of the 238 files it wrote was compared byte for byte with `dist/`: 0 differ. So `dist/` already held this commit's build, and rebuilding it changed no file's content under the running daemon.
- `npm run build`: exit 0. `npm test`, run once as a build-health smoke and not as evidence: 56 test files, 1,411 tests passed. Nothing in it contradicts a probe.
- A daemon started by fvermaut from this folder ran during the whole pass. It was not touched. Every probe ran the built program in its own temporary folder, with its own `timone.yaml`, ledger, fake forge and fake model service. Nothing reached GitHub or a real model. No replay was run, and no probe was run with `--live`.
- The run order: `prd-05.r11.mjs` and `prd-05.r20.mjs` at the same time; then `prd-05.r20.mjs` again, after its clause 4b was extended (below), at the same time as `prd-05.r19.mjs`; then `run.mjs --regression`. The second R20 run is the one quoted.

### Independence declaration (this iteration)

Read:

- this skill;
- the phase file's `Status`, requirements header and `Screens changed` lines. The first printing was lines 1 to 8, so it also showed the title and the "Companion phases" note, which names files and functions the phase removes and the decision records it follows. No sub-phase body was read;
- the completion report, whole;
- this report, whole, to append to it (the person who started this pass allowed it);
- in the PRD-05 register: its header, the R11, R15, R19 and R20 blocks, and the `Falsified-by` lines of the other blocks, for their format; and the changes to the PRD-01 and PRD-05 registers since the first pass (`git diff 3826267 HEAD` on those two files only);
- the `Priority`, `Status`, `Verify-via`, `Depends-on`, `Last live gate` and `Falsified-by` lines of every register, by a script, to derive the regression set and the live gates;
- the probes `prd-05.r11.mjs`, `prd-05.r20.mjs`, the first 40 lines of `prd-05.r19.mjs` and `prd-05.r18.mjs`, and the helpers `_rig.mjs`, `_lib.mjs`, `_old-build.mjs` and `run.mjs`;
- in the step skills `timone-grill`, `timone-plan`, `timone-execute` and `timone-verify`: the lines that name the runner and say what is the default. These are the documents R20 clause 4 is about;
- the headings of [phase-40-replay.md](phase-40-replay.md);
- in [phase-41-departures.md](phase-41-departures.md): its header, its headings and its last three entries, for the entry format;
- `package.json`'s scripts.

File names, not contents: `git diff --name-only` from `main` (the merge-base) and from `45ab65b` to HEAD; the one-line log of `origin/main` past the base. The `.timone/` folder's file names were listed once, by mistake, while looking for the running daemon. No file in it was opened.

Before re-writing R11's clause 2 checks, short scripts were run with the same rig, outside the repository, to see how `timone takeover` answers on runs in different states. What they showed is what the committed probe now checks and prints.

Not read: the handoffs, diffs of code, source, the committed test suite, any ADR (the R20 probe reads ADR-0060's lines naming what it supersedes, and the status line of each record it names, as in the first pass), the delivery report that R11's note links to. All evidence below comes from verifier-written probes, run from `doc/plans/phases/probes/`.

### Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R11 | MUST | api | PASS on every check; one case under clause 2 is a question for the human | 0 |
| PRD-05.R20 | SHOULD | api | PASS | 0 |
| PRD-01.R2 | MUST | api | PASS (regression) | 0 |
| PRD-01.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression); the runner's part of clause 1 BLOCKED | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-05.R19 | SHOULD | api | PASS (outside the derived scope, as in the first pass) | 0 |

**The closing gate is not met.** PRD-05.R18 is BLOCKED: the newest recorded replay, run 9 at `45ab65b`, is older than this build. There is no regression, and no criterion failed. R20 moves to `verified`. R11 stays `draft`, because of the question below.

### Evidence

Commands, from the Timone root at `4686ef4`:

```
node doc/plans/phases/probes/prd-05.r11.mjs
node doc/plans/phases/probes/prd-05.r20.mjs
node doc/plans/phases/probes/prd-05.r19.mjs
node doc/plans/phases/probes/run.mjs --regression
```

All four exited 0. `run.mjs` printed: 8 passing, 0 failing, 1 blocked, 0 with no probe.

#### PRD-05.R11 — PASS on every check, one question

Clause 2 was re-written this iteration from its new words (see Probes). Clauses 1 and 3 ran from the committed probe.

```
=== PRD-05.R11 clause 1a — the model service cannot be reached: timone cancel stops the run, and the project is free for the next ticket
    break leg: RED (as required) — the run is parked
    green leg: PASS — assertion held
=== PRD-05.R11 clause 1b — timone cancel stops any running session
    break leg: RED (as required) — the run is active
    green leg: PASS — assertion held
=== PRD-05.R11 clause 1c — the ticket left open and marked: after timone cancel the cancelled ticket is not taken up again, and the project is free for the next ticket
    break leg: RED (as required) — the cancelled ticket was taken up again: fixture#12/2 parked
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2a — a run that nothing is working on and that is not waiting its turn: timone takeover opens a terminal session on that ticket
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
    (the run before the takeover: fixture#12/1 parked; no other run on the project)
=== PRD-05.R11 clause 2b — when the terminal session ends, the runner wakes and reads what it left
    break leg: RED (as required) — the terminal session ended and left its closing comment, but the runner did not wake
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2b (daemon stopped) — takeover with no daemon running: when the daemon runs again, the runner wakes and reads what the session left
    break leg: RED (as required) — the terminal session ended and left its closing comment, but the runner did not wake
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2c — a run stopped with timone cancel is also one nothing is working on: timone takeover opens a terminal session on that ticket, and when it ends the runner wakes and reads what it left
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
    (… runs after: fixture#12/1 cancelled, fixture#12/2 parked)
=== PRD-05.R11 clause 2, note 1 — a takeover of a run the machine is working on opens no session, and says what is happening
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (takeover of the busy run said, exit 1: "I'm working on fixture #12 right now. Anything I need from you will land on the ticket.")
=== PRD-05.R11 clause 2, note 2 — nor does a takeover of a run waiting its turn behind another run open a session
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (takeover of the run waiting its turn said, exit 1: "fixture #12 is in the queue — I take one thing at a time on a project. I'll start it when the one ahead is done."; runs: fixture#13/1 active, fixture#12/1 queued)
    (seen, a question for the human and not judged here: a run waiting on nothing, not in the queue, while another run holds the project — runs: fixture#12/1 parked, fixture#13/1 active. Takeover said, exit 1: "… The daemon read the request and did not hand fixture #12 over — it is parked. Its log says why."; a session opened: no; the daemon's log: "error  could not apply claim-takeover fixture#12 asked by pid 68868: Project fixture already has a session for run fixture#13/1 (active) — one session per project at a time")
=== PRD-05.R11 clause 3a — timone retry does not exist: the command line does not offer it
    break leg: RED (as required) — the command list offers it: "retry [options] <ticket> Re-arm a failed run at the stage where it"
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3b — timone retry does not exist: typed on a ticket whose run the old build marked failed, it changes nothing
    break leg: RED (as required) — timone retry went ahead (exit 0): "fixture #12 is re-armed at the point it stopped (triage). …"
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3c — the message says to write on the ticket instead
    break leg: RED (as required) — the message does not say to write on the ticket: "fixture #12 is re-armed at the point it stopped (triage). …"
    green leg: PASS — assertion held
    (timone retry said, exit 1: "`timone retry` was removed. Write on the ticket instead: say what you want done.")
    (seen, not part of the clause: `timone help retry` prints, exit 1: "`timone retry` was removed. Write on the ticket instead: say what you want done.")
--- PRD-05.R11: PASS (12 clause labels, 12 passing)
```

- **Clause 1** (cancel when the runner cannot start): PASS again.
- **Clause 2** (takeover of a run nothing is working on, and not waiting its turn): PASS on both kinds of run checked. Each fixture's state was read from the ledger before the takeover: the run was not active, not in the queue, and no other run of the project was active or in the queue.
  - A run the runner left waiting on nothing: a terminal session opened, and when it ended, the runner woke and read what it left. The same with no daemon running during the session.
  - A run stopped with `timone cancel`: a terminal session opened, a new run of the ticket started, and the runner woke and read what the session left.
  - The note's two cases: a busy run got no session, and the message said what was happening. A run in the queue got no session.
  - **One case is not judged**, and is a question below: a run waiting on nothing, not in the queue, while another run of the same project is being worked on.
- **Clause 3** (`timone retry` does not exist, and the message says to write on the ticket): PASS again. The first pass saw `timone help retry` print a usage line with exit 0. It now gives the removal message, with exit 1.

#### PRD-05.R20 — PASS

```
    (this build: runner requests 6; step sessions [triage, planning]; steps the record shows started [triage, planning], by 2 runner decision(s); run parked)
    (the build before phase 41: runner requests 0; step sessions [triage]; steps the record shows started [], by 0 runner decision(s); run failed ("triage recorded no classification"))
=== PRD-05.R20 clause 1 — no project in timone.yaml runs on the current daemon
    break leg: RED (as required) — a driver line putting the timone entry back on the current daemon was accepted
    green leg: PASS — assertion held
=== PRD-05.R20 clause 2a — the code that chooses the next step is deleted: only the steps the runner chose run, in its order, and none follows when it chooses none
    break leg: RED (as required) — 1 step session(s) ran, and the runner started 0
    green leg: PASS — assertion held
=== PRD-05.R20 clause 2b — the code that reads a step's end from an exact line is deleted: a step that ends with no closing line still ends, and the runner wakes on it
    break leg: RED (as required) — the run was failed: "triage recorded no classification"
    green leg: PASS — assertion held
=== PRD-05.R20 clause 2c — the code that decides where a run waits is deleted: the quiet run waits on the runner, and a named person's comment reaches it
    break leg: RED (as required) — the run was failed by code: "triage recorded no classification"
    green leg: PASS — assertion held
=== PRD-05.R20 clause 3 — the ADRs that ADR-0060 lists as superseded get their status lines changed in that same pull request
    break leg: RED (as required) — ADR-0022: "accepted"; ADR-0022: not changed in this pull request; … (the same for all nine)
    green leg: PASS — assertion held
    (ADR-0060 names as superseded: ADR-0022, ADR-0023, ADR-0031, ADR-0034, ADR-0035, ADR-0046, ADR-0052, ADR-0054, ADR-0056)
=== PRD-05.R20 clause 4a — process.md says that the order is the default, and describes the runner
    break leg: RED (as required) — process.md does not say the order is the default
    green leg: PASS — assertion held
=== PRD-05.R20 clause 4b — the step skills say that the order is the default, and describe the runner
    break leg: RED (as required) — timone-triage: never names the runner; timone-triage: does not say the order is the default; … timone-plan: does not say the order is the default; timone-execute: does not say the order is the default; …
    green leg: PASS — assertion held
    (each names the runner, and says the order is the default in these words: timone-triage "default order"; timone-grill "is the default one"; timone-wayfind "default order"; timone-prd "default order"; timone-adr "default order"; timone-plan "is the default one"; timone-execute "is the default one"; timone-verify "is the default one"; timone-deliver "default order". The words are checked, not whether the description is complete.)
--- PRD-05.R20: PASS (7 clause labels, 7 passing)
```

- **Clauses 1 to 3:** PASS again, each seen red first on the build and documents from just before phase 41.
- **Clause 4:** PASS. The check on the step skills is now stricter than in the first pass. Each of the nine step skills names the runner, and each says that the order is the default. Five say "the default order". Four say that the runner chooses the next step, and that one step "is the default one". The first pass found only two that said it, because it looked only for the first wording.
- **The limit, as before:** the probe checks words. Whether each skill's description of the runner is complete is for a reader of the pull request.

#### PRD-01.R2, PRD-01.R3, PRD-05.R2, R3, R4, R5, R10 — PASS (regression)

Run with `run.mjs --regression`. Every clause label went red on its break leg, then green: PRD-01.R2 5 of 5, PRD-01.R3 4 of 4; PRD-05.R2 4 of 4, R3 4 of 4, R4 6 of 6, R5 6 of 6, R10 4 of 4.

#### PRD-05.R7 — PASS (regression), one part BLOCKED

Clause 1's code part, clause 2a and clause 2b pass, each seen red first. The runner's own part of clause 1 is BLOCKED again:

```
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", records no approval
    BLOCKED — needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build (run 9 ran at 45ab65b, and 26 file(s) outside doc/plans/ and doc/specs/ changed since).
--- PRD-05.R7: PASS (4 clause labels, 3 passing, 1 blocked)
```

#### PRD-05.R18 — BLOCKED

```
=== PRD-05.R18 clause 1 — each case in the table chooses the action in the table's last column, on each of three separate tries
    BLOCKED — the recorded replay judged here is older than this build: run 9 ran at 45ab65b, and 26 file(s) outside doc/plans/ and doc/specs/ changed since. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    BLOCKED — the newest recorded replay is older than this build: …. The replay owed on this build has not been run yet.
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    BLOCKED — no replay on this build is recorded yet, so there is no result to look for on the branch.
--- PRD-05.R18: BLOCKED (3 clause labels, 0 passing, 3 blocked)
```

Run 9 passed 19 of 19 at `45ab65b`. After it, 41n and 41o changed files under `src/`, among them files under `src/daemon/` and `src/commands/`. The completion report says the builder ran the replay in its scripted form (`--dry`), 19 of 19; that form uses no model, so it does not decide this criterion. The replay on the real model is owed on this branch's final commit, before the pull request is merged. Nothing was seen to be wrong, so R18 and R7 keep `verified`.

#### PRD-05.R19 — PASS (outside the derived scope)

```
=== PRD-05.R19 note 1 — every project has moved to the runner
    break leg: RED (as required) — a project with no driver line was not driven by the runner: no runner session started
    green leg: PASS — assertion held
    (projects in the repository's timone.yaml: scratch-app, ivtrends, timone)
=== PRD-05.R19 note 2 — a timone.yaml that still has a driver line does not load, and says to delete the line
    break leg: RED (as required) — with "driver: runner", the message does not say to delete the driver line: "Invalid manifest: project "fixture": it is driven by the runner, but names nobody who may instruct it. …"
    green leg: PASS — assertion held
    (this build said: "fixture: the `driver` line was removed on 2026-09-30. Every project is now driven by the runner. Delete the line.")
--- PRD-05.R19: PASS (2 clause labels, 2 passing)
```

Its status stays `verified`, for the reason the first pass gave.

### HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries none forward.

### Live gates

No criterion in scope is on the `live` channel. The criteria whose dependencies the diff touches are named in this iteration's header. The newest live check of this branch, [phase-41-live-gate.md](phase-41-live-gate.md), ran at `3afc263`, before 41m, 41n and 41o changed code. No `Last live gate:` line was changed.

### Regression

- PRD-01.R2 — PASS
- PRD-01.R3 — PASS
- PRD-05.R2 — PASS
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS; the runner's part of clause 1 BLOCKED (the replay is older than the build)
- PRD-05.R10 — PASS
- PRD-05.R18 — BLOCKED (the replay is older than the build)

Nothing was narrowed out. Two criteria in the set declare `Depends-on`, and the diff from `main` touches both: PRD-01.R2 (`src/manifest.ts`) and PRD-01.R3 (`src/git.ts`). The other seven declare none, so they are always in the set.

### Probes

**11 probes proven able to fail in this run, 1 not.** 57 clause labels went red on their break leg and then green: R11 12, R20 7, R19 2, PRD-01.R2 5, PRD-01.R3 4, PRD-05.R2 4, R3 4, R4 6, R5 6, R7 3, R10 4. 4 labels were BLOCKED and had no break leg run: R18's three and R7's runner part. The one probe not proven is `prd-05.r18.mjs`: every clause it has was BLOCKED. No probe lacks a break step.

| Probe | Origin | Break step |
| --- | --- | --- |
| `prd-05.r11.mjs` | run from the directory; clause 2 re-written this iteration | 12 of 12 red; clause 3's on the build before phase 41 |
| `prd-05.r20.mjs` | run from the directory; clause 4b made stricter this iteration | 7 of 7 red, on the build and documents before phase 41 |
| `prd-05.r19.mjs` | run from the directory, unchanged | 2 of 2 red, on the build before phase 41 |
| `prd-01.r2.mjs`, `prd-01.r3.mjs` | run from the directory, unchanged | 5 of 5, 4 of 4 red |
| `prd-05.r2.mjs`, `r3`, `r4`, `r5`, `r10` | run from the directory, unchanged | 4, 4, 6, 6, 4 red |
| `prd-05.r7.mjs` | run from the directory, unchanged | 3 of 3 decided labels red; 1 BLOCKED |
| `prd-05.r18.mjs` | run from the directory, unchanged | not run: every clause BLOCKED |

**Changed this iteration, and why:**

- **`prd-05.r11.mjs`, clause 2.** The register's words changed on fvermaut's answer on #189: "GIVEN any run" became "GIVEN any run that nothing is working on, and that is not waiting its turn behind another run". The probe now quotes the new words, and each fixture checks the GIVEN from the ledger before the takeover. It checks two kinds of run nothing is working on (2a, 2b, and new 2c for a cancelled run). It checks the two runs the note leaves out (note 1, note 2); their break legs use the takeover of a run nothing is working on, where a session does open. It prints one case and does not judge it: the question below. Clauses 1 and 3 are unchanged.
- **`prd-05.r20.mjs`, clause 4b.** The criterion says "`process.md` and the step skills say that the order is the default". The first pass checked only that each skill names the runner, and said so. The check now also asks each skill to say that the order is the default.

**Clause coverage.** R11 has three clauses; its probe prints labels 1a to 1c, 2a, 2b (twice), 2c, two note labels for clause 2, and 3a to 3c. R20 is one criterion in four parts; its probe prints labels for each part. For every other probe, the labels printed match the register's clauses, as in the first pass.

### Fix-loop accounting

0 of 2 — no criterion failed. Nothing was sent to a fix context. The question below is not a failure, and consumes no loop.

### Figures on the preview's data

No screen changed in this phase. The phase file says "Screens changed: none", and the completion report's screen comparison says the same. No seed was loaded and no screenshot was taken.

### Questions for the human

**1. Should `timone takeover` work on a ticket while another ticket of the same project is being worked on?** (PRD-05.R11, clause 2)

- **What was seen.** Ticket 12's run was waiting on nothing: the runner had looked at it and chosen to do nothing yet. It was not in the queue. Then ticket 13 arrived, and a step started on it. While that step ran, `timone takeover fixture#12` opened no terminal session. It ended with exit 1 and said: "The daemon read the request and did not hand fixture #12 over — it is parked. Its log says why." The daemon's log said: "Project fixture already has a session for run fixture#13/1 (active) — one session per project at a time". This was a test project with a fake forge and a fake model, not a real one.
- **What clause 2 says.** "GIVEN any run that nothing is working on, and that is not waiting its turn behind another run WHEN the operator runs `timone takeover <ticket>` THEN a terminal session opens on that ticket". Ticket 12's run fits these words: nothing works on it, and it is not waiting its turn. So by the words, a session should open.
- **Why the register does not decide it.** The note under the clause gives the reason a run in the queue gets no session: "a terminal session on it would work in the same repository at the same time". That reason holds for ticket 12 too. And R15 clause 2 says that for two tickets on the same project, "only one runs at a time". So the clause's words say a session opens, and the reasons around it say it should not.
- **The choice.** Either change the words (for example: "… and no other run of the project is being worked on"), or change the code so that the takeover opens a session. Separately: the message does not say why. It says "it is parked", and not that ticket 13 holds the project.
- **What it changes.** PRD-05.R11 stays `draft` until this is answered. Its probe passes every case it judges, and it now prints this case without judging it. Once you answer, the next check judges it and can move R11 to `verified`.

✏ 2026-10-02 — answered by fvermaut on #189: "change the words". Clause 2 was reworded, and [iteration 4](#iteration-4--r11-after-its-refined-words-r18-and-r7-after-replay-run-10) judged this case on the new words: PASS. R11 is now `verified`.

### Register changes

All in [prd-05 criteria](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md):

- **PRD-05.R11** — a `Falsified-by` line naming `doc/plans/phases/probes/prd-05.r11.mjs`, with a dated note: added on fvermaut's answer on #189. It was written before the probe was run. The status stays `draft`, because of question 1. An evidence marker names this iteration.
- **PRD-05.R20** — a `Falsified-by` line naming `doc/plans/phases/probes/prd-05.r20.mjs`, with the same dated note, written before the probe was run. **Status `draft` → `verified`.** Every part passes; the probe went red on every break leg in this run; and the claim is universal, so the `Falsified-by` line is what allows the move. Nothing written on the block records a clause that was not seen. An evidence marker names this iteration.
- **PRD-05.R19** — an evidence marker: both checks pass again. It stays `verified`.
- **PRD-05.R7 and R18** — untouched. They were BLOCKED in part or whole, and BLOCKED asserts nothing.

### Carried forward

- **PRD-05.R18 — BLOCKED,** and with it the runner's part of **PRD-05.R7 clause 1.**
  - Run 9 of the replay (19 of 19) ran at `45ab65b`. 41n and 41o changed files under `src/` after it.
  - A replay on this branch's final commit is owed before the pull request is merged: `npm run --silent replay`, from fvermaut's own logged-in terminal, recorded as run 10 in [phase-40-replay.md](phase-40-replay.md). The R18 and R7 probes then judge it.
  - Departure entry: [phase-41-departures.md](phase-41-departures.md), "2026-10-02 — timone#166, verification (iteration 3)".
- **PRD-05.R11 stays `draft`** until question 1 is answered. This is not a failure: every case the register decides passes.

✏ 2026-10-02 — settled by [iteration 4](#iteration-4--r11-after-its-refined-words-r18-and-r7-after-replay-run-10). fvermaut ran the replay at `4686ef4` and recorded it as run 10: 19 of 19. PRD-05.R18 and the runner's part of PRD-05.R7 clause 1 now pass. Question 1 was answered by changing R11 clause 2's words, and R11 now passes on them and is `verified`. Nothing is carried forward.

## Iteration 4 — R11 after its refined words, R18 and R7 after replay run 10

- **Date:** 2026-10-02
- **Scope:** PRD-05.R11 (MUST, claimed), and two criteria iteration 3 left BLOCKED: PRD-05.R18, and the runner's part of PRD-05.R7 clause 1 (the R7 probe runs whole). Nothing else is checked again. Only documents under `doc/plans/` and `doc/specs/` changed after `4686ef4`, the commit iteration 3 checked in full, so its other results stand for this code.
- **Why this iteration:**
  - R11: iteration 3 asked whether a takeover should work while another run of the same project is being worked on. fvermaut answered "change the words" on [#189](https://github.com/fvermaut/timone/pull/189). Clause 2 was reworded twice: in `1bc992a`, and again in `fb3f88a`, while this iteration ran.
  - R18 and R7: fvermaut ran the replay at `4686ef4` and recorded it as run 10 in [phase-40-replay.md](phase-40-replay.md): 19 of 19 cases, three tries of three.
- **Live gate owed:** no criterion in this scope is on the `live` channel. The list in iteration 3's header is unchanged.
- **Branch:** `timone/166-the-old-code-between-steps-is-removed` @ `fb3f88a`, the same commit as on `origin`. The pass started at `272d0de`. `fb3f88a` was committed by the person who started this pass, and changes only the PRD-05 register.

### Answer to iteration 3's question

The words changed, not the code. R11 clause 2's GIVEN now reads:

> GIVEN a run that nothing is working on, on a project where no other run is working, holds a work branch, or waits its turn

It used to read "GIVEN any run that nothing is working on, and that is not waiting its turn behind another run". The note under it now says that the code keeps two rules, one session per project and one work branch per project, and that "A takeover is also refused while another run of the same project is working or holds a work branch". The case in question 1 (ticket 12 waits on nothing while a step runs on ticket 13) is now outside the GIVEN, and the note says it is refused. The probe now judges it: PASS.

The question's side point is not answered by the new words: on that refusal the message says "it is parked. Its log says why", not that ticket 13 holds the project. No clause asks what this message says, so it is recorded here and not judged.

### Environment

- `dist/` was not rebuilt, because a daemon started by fvermaut runs from this folder. `npx tsc --outDir <scratch folder>` compiled this tree outside the repository at `272d0de` (exit 0). Each of the 238 files it wrote was compared byte for byte with `dist/` (`cmp -s`): 0 differ. `fb3f88a` changes only the register, so the build is the same.
- The test suite was not run in this iteration. Iteration 3 ran it once, on the same code.
- The running daemon was not touched. Every probe ran the built program in its own temporary folder, with a fake forge and a fake model service. Nothing reached GitHub or a real model. The real replay was not run. No probe ran with `--live`. The R18 probe's break leg for clause 1b runs `npm run --silent replay -- --dry`, which uses a scripted runner and no model, with the model credentials removed.
- **Run order.** The three probes first ran at the same time at `272d0de`, with R11 judged on the words of `1bc992a`: all passed, R11 13 of 13 labels. Then `fb3f88a` arrived. The R11 probe was extended to its words, and the three probes ran again at the same time at `fb3f88a`. The second run is the one quoted.

### Independence declaration (this iteration)

Read: this skill; this report, whole, to append to it; in the PRD-05 register its header and the R7, R11 and R18 blocks (R11 again at `fb3f88a`); the probes `prd-05.r11.mjs` and `prd-05.r18.mjs`, the first 60 lines of `prd-05.r7.mjs` and its lines that name the replay, and the helpers `_rig.mjs`, `_lib.mjs` and `_replay.mjs`; the headings of [phase-40-replay.md](phase-40-replay.md) and its run 10 section; in [phase-41-departures.md](phase-41-departures.md) its header, its headings and its last four entries, for the entry format.

File names, not contents: `git diff --name-only` from `4686ef4` to HEAD and from `272d0de` to `fb3f88a`. The phase file and the completion report are not among the files changed since iteration 3 read them, so the `Complete` stamp and the claimed scope are as iteration 3 recorded them.

Before writing the work-branch checks, two short scripts were run with the same rig, outside the repository, to see how a run comes to hold a work branch and how `timone takeover` answers then. A step started by the runner leaves the run's entry in the ledger naming a branch (`timone/13-next-ticket`) once the run is parked. What the scripts showed is what the probe now checks and prints.

Seen by accident, and declared: with no daemon running, the refused takeover prints a Node error with its stack trace. That output names compiled files under `dist/` and shows one line of compiled code (the line that raises the error). It is the program's own output, read once in a scratch run. The probe prints only its error line and counts the stack frames.

Not read: the handoffs, diffs of code, source, the committed test suite, any ADR. The `.timone/` folder was not opened. All evidence below comes from verifier-written probes, run from `doc/plans/phases/probes/`.

### Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression), including the runner's part of clause 1 | 0 |

**The closing gate is now met.** Every MUST criterion in this phase's scope passes: R11, which the phase claims, and the nine of the derived regression set (seven passed in iteration 3 on the same code; R7 and R18 pass here). There is no regression, and no fix loop was used. PRD-05.R20 (SHOULD) moved to `verified` in iteration 3.

### Evidence

Commands, from the Timone root at `fb3f88a`, at the same time:

```
node doc/plans/phases/probes/prd-05.r11.mjs
node doc/plans/phases/probes/prd-05.r18.mjs
node doc/plans/phases/probes/prd-05.r7.mjs
```

All three exited 0.

#### PRD-05.R11 — PASS

Clause 2 was re-written this iteration from its new words (see Probes). Clauses 1 and 3 ran from the committed probe, unchanged. Their side lines are cut here; they are as in iteration 3.

```
=== PRD-05.R11 clause 1a — the model service cannot be reached: timone cancel stops the run, and the project is free for the next ticket
    break leg: RED (as required) — the run is parked
    green leg: PASS — assertion held
=== PRD-05.R11 clause 1b — timone cancel stops any running session
    break leg: RED (as required) — the run is active
    green leg: PASS — assertion held
=== PRD-05.R11 clause 1c — the ticket left open and marked: after timone cancel the cancelled ticket is not taken up again, and the project is free for the next ticket
    break leg: RED (as required) — the cancelled ticket was taken up again: fixture#12/2 parked
    green leg: PASS — assertion held
    (the ticket's labels after the cancel: ["timone","timone:held"]; the next ticket's run: fixture#13/1 parked)
=== PRD-05.R11 clause 2a — a run that nothing is working on, on a project where no other run is working, holds a work branch, or waits its turn: timone takeover opens a terminal session on that ticket
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
    (the run before the takeover: fixture#12/1 parked; no other run on the project)
=== PRD-05.R11 clause 2b — when the terminal session ends, the runner wakes and reads what it left
    break leg: RED (as required) — the terminal session ended and left its closing comment, but the runner did not wake
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2b (daemon stopped) — takeover with no daemon running: when the daemon runs again, the runner wakes and reads what the session left
    break leg: RED (as required) — the terminal session ended and left its closing comment, but the runner did not wake
    green leg: PASS — assertion held
=== PRD-05.R11 clause 2c — a run stopped with timone cancel is also one nothing is working on: timone takeover opens a terminal session on that ticket, and when it ends the runner wakes and reads what it left
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
    (… runs after: fixture#12/1 cancelled, fixture#12/2 parked)
=== PRD-05.R11 clause 2, note 1 — a takeover of a run the machine is working on opens no session, and says what is happening
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (takeover of the busy run said, exit 1: "I'm working on fixture #12 right now. Anything I need from you will land on the ticket.")
=== PRD-05.R11 clause 2, note 2 — nor does a takeover of a run waiting its turn behind another run open a session
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (… runs: fixture#13/1 active, fixture#12/1 queued)
=== PRD-05.R11 clause 2, note 3a — a takeover is also refused while another run of the same project is working: no session opens
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (runs at the takeover: fixture#12/1 parked, fixture#13/1 active. Takeover said, exit 1: "… The daemon read the request and did not hand fixture #12 over — it is parked. Its log says why."; the daemon's log: "error  could not apply claim-takeover fixture#12 asked by pid 12515: Project fixture already has a session for run fixture#13/1 (active) — one session per project at a time")
=== PRD-05.R11 clause 2d — another run of the project is parked and holds no work branch: timone takeover opens a terminal session on that ticket, and when it ends the runner wakes and reads what it left
    break leg: RED (as required) — no terminal session was opened on the ticket
    green leg: PASS — assertion held
    (runs at the takeover: fixture#12/1 parked, fixture#13/1 parked. Takeover said, exit 0: "… Picking up fixture #12 here. When you end this session, the runner reads the ticket and decides what comes next. …")
=== PRD-05.R11 clause 2, note 3b — a takeover is also refused while another run of the same project holds a work branch (parked: nothing works on it, it is not queued): no session opens
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (runs at the takeover: fixture#12/1 parked, fixture#13/1 parked holding timone/13-next-ticket; step sessions: 1. Takeover said, exit 1: "… The daemon read the request and did not hand fixture #12 over — it is parked. Its log says why."; the daemon's log: "error  could not apply claim-takeover fixture#12 asked by pid 12947: Project fixture is held by run fixture#13/1 (parked, branch timone/13-next-ticket) — one work branch at a time")
=== PRD-05.R11 clause 2, note 3b (daemon stopped) — the same with no daemon running: no session opens
    break leg: RED (as required) — a terminal session was opened on the ticket: "You are picking up **fixture #12**. A human has just opened"
    green leg: PASS — assertion held
    (seen, not part of the clause: with no daemon, takeover exit 1; it printed 12 lines, 7 of them stack frames ("    at …"); its error line: "Error: Project fixture is held by run fixture#13/1 (parked, branch timone/13-next-ticket) — one work branch at a time")
=== PRD-05.R11 clause 3a — timone retry does not exist: the command line does not offer it
    break leg: RED (as required) — the command list offers it: "retry [options] <ticket> Re-arm a failed run at the stage where it"
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3b — timone retry does not exist: typed on a ticket whose run the old build marked failed, it changes nothing
    break leg: RED (as required) — timone retry went ahead (exit 0): "fixture #12 is re-armed at the point it stopped (triage). …"
    green leg: PASS — assertion held
=== PRD-05.R11 clause 3c — the message says to write on the ticket instead
    break leg: RED (as required) — the message does not say to write on the ticket: "fixture #12 is re-armed at the point it stopped (triage). …"
    green leg: PASS — assertion held
    (timone retry said, exit 1: "`timone retry` was removed. Write on the ticket instead: say what you want done.")
--- PRD-05.R11: PASS (16 clause labels, 16 passing)
```

- **Clause 1** (cancel when the runner cannot start): PASS again.
- **Clause 2** (takeover, on the new words): PASS. Each fixture's state was read from the ledger before the takeover.
  - **Inside the GIVEN, a session opens**, and when it ends the runner wakes and reads what it left. Checked on a run the runner left waiting on nothing (with and without a daemon), on a run stopped with `timone cancel`, and, new, on a run whose project has another run parked that holds no work branch (2d).
  - **Outside the GIVEN, no session opens.** Checked on a busy run (note 1, and the message says what is happening), on a run in the queue (note 2), while another run of the project is working (note 3a, the case of iteration 3's question), and, new, while another run of the project is parked holding a work branch (note 3b), with and without a daemon. In note 3b, the other run keeps its branch, and ticket 12's run is not changed.
  - The break legs of 2d and note 3b use the same two fixtures, which differ only in whether ticket 13's run holds a work branch. Each went red on the other.
- **Clause 3** (`timone retry` does not exist, and the message says to write on the ticket): PASS again.

**Seen, not part of any clause, and recorded as asked:** a takeover refused because another run holds a work branch answers differently with and without a daemon.

- With a daemon running, it ends with exit 1 and says: "The daemon read the request and did not hand fixture #12 over — it is parked. Its log says why." It does not say that ticket 13 holds the project. The daemon's log does.
- With no daemon, it ends with exit 1 and prints a raw program error, not a sentence: "Error: Project fixture is held by run fixture#13/1 (parked, branch timone/13-next-ticket) — one work branch at a time", then 7 stack frames, 12 lines in all.

No register clause says what this refusal must print. Note 1 asks only that a takeover of a busy run says what is happening, and it does. So this does not change R11's verdict. It is recorded for the pull request. Verification does not fix it.

#### PRD-05.R18 — PASS

The 19 case lines of run 10 are cut here. They are in [phase-40-replay.md](phase-40-replay.md), and every one ends "3 of 3 tries."

```
    (the register's table has 19 cases: #139 · #140 · #144 · #143, #161 · #99 · #115 · #142 · #108 · #111 · #159 · #117 · #120 · #125, #135 · #132 · #147 · #104 · scratch-app#37 · ivtrends#1 · #110)
    (judged: run 10 of the record ("Run 10 — 2026-10-02, phase 41 (#166), after the reviews' fixes: 19 of 19 passed, $2.54", at 4686ef4))
    | Replaying 19 cases, 3 tries each, on claude-opus-5-5.
    | …
    | 19 of 19 cases passed. The runner's sessions cost $2.54 in all.
=== PRD-05.R18 clause 1a — each case in the table is in the replay's result
    break leg: RED (as required) — case #110 is missing from the result
    green leg: PASS — assertion held
=== PRD-05.R18 clause 1b — the runner was woken by the real model, on three separate tries per case — not by the scripted runner
    break leg: RED (as required) — not a run of the real model with three tries each: "Replaying 19 cases, 3 tries each, with a scripted runner and no model (--dry)."
    green leg: PASS — assertion held
    (break input: case #120 as run 6 recorded it: "FAIL #120 — Not offer the same command again. Say what is actually needed. 2 of 3 tries chose it. Try 1: chose…")
=== PRD-05.R18 clause 1c — it chooses the action in the table's last column, on each of the three tries, for every case
    break leg: RED (as required) — case #120: FAIL #120 — Not offer the same command again. Say what is actually needed. 2 of 3 tries chose it. …
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    break leg: RED (as required) — files outside doc/plans/ and doc/specs/ changed after run 10 (at bcc18b1fa866b8c9e32697a2fd071dfb2e31b893^): 7, under .claude/, CONTEXT.md/, manual/
    green leg: PASS — assertion held
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    break leg: RED (as required) — run 10's result is not in doc/plans/phases/reports/phase-40-replay.md at 4686ef47a91b14389ac1b05f3bcaf6b450095422
    green leg: PASS — assertion held
    (the pull request itself is not read here: nothing in this probe reaches GitHub. Its description is written when the work is delivered.)
--- PRD-05.R18: PASS (5 clause labels, 5 passing)
```

- **Clause 1** (each case chooses the table's action, on each of three tries): PASS. Run 10 holds all 19 cases of the register's table, each "3 of 3 tries", and its first line names the real model.
- **Clause 2** (the replay is run on the instructions the pull request carries, and its result is on the pull request): PASS. Run 10 names `4686ef4`, and only documents under `doc/plans/` and `doc/specs/` changed between that commit and HEAD. The record holding run 10 is on `origin/timone/166-the-old-code-between-steps-is-removed`.
  - The break legs: the commit just before 41p (`bcc18b1^`), where seven files outside those folders differ, went red; the record as it stood at `4686ef4`, which does not hold run 10, went red.
  - **The limit, as before:** the probe does not read the pull request on GitHub. Whether its description names run 10 was not checked.

#### PRD-05.R7 — PASS

```
=== PRD-05.R7 clause 1 (code) — the approval skipped: no approval is recorded, the skip is posted on the ticket, and the run carries on
    break leg: RED (as required) — the ticket was not told the approval was skipped
    green leg: PASS — assertion held
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", writes the requirements, records no approval, posts that it was skipped and carries on — replay case scratch-app#37, run 10, on each of three tries
    break leg: RED (as required) — case scratch-app#37: FAIL scratch-app#37 — planted by the probe. 2 of 3 tries chose it.
    green leg: PASS — assertion held
=== PRD-05.R7 clause 2a — no approval is written from a comment that is not a named person's (a stranger's, the machine's, or none)
    break leg: RED (as required) — citing operator was not refused: {"kind":"decision", … "action":"record_approval","reason":"probe: citing operator"}
    green leg: PASS — assertion held
=== PRD-05.R7 clause 2b — an approval that is written names the named person's comment that gave it
    break leg: RED (as required) — the recorded approval does not name the comment: []
    green leg: PASS — assertion held
--- PRD-05.R7: PASS (4 clause labels, 4 passing)
```

- **Clause 1, the runner's part:** PASS. Replay case scratch-app#37 in run 10 chose the table's action on three tries of three. The break leg plants the same case as 2 of 3, and it went red.
- **Clause 1, what code does**, and **clause 2:** PASS again on this build, each seen red first.

### HUMAN-CHECK scripts

None. No criterion in this scope is on the `human` channel.

### Live gates

No criterion in this scope is on the `live` channel. Nothing about the live gates changed since iteration 3, and no `Last live gate:` line was changed.

### Regression

- PRD-05.R7 — PASS, including the runner's part of clause 1
- PRD-05.R18 — PASS

The other seven criteria of the derived set passed in iteration 3, at `4686ef4`. No file outside `doc/plans/` and `doc/specs/` changed since, so they were not run again. The derived set and its narrowing are as in iteration 3: nothing was narrowed out.

### Probes

**3 probes proven able to fail in this iteration, 0 not.** 25 clause labels went red on their break leg and then green: R11 16, R18 5, R7 4. No label was BLOCKED, and no probe lacks a break step.

| Probe | Origin | Break step |
| --- | --- | --- |
| `prd-05.r11.mjs` | run from the directory; clause 2 re-written this iteration | 16 of 16 red |
| `prd-05.r18.mjs` | run from the directory, unchanged | 5 of 5 red |
| `prd-05.r7.mjs` | run from the directory, unchanged | 4 of 4 red |

**Changed this iteration, and why:** `prd-05.r11.mjs`, clause 2 only. The register's words changed twice, on fvermaut's answer to iteration 3's question (`1bc992a`, then `fb3f88a`).

- The file now quotes the new GIVEN and the refined note, and the 2a label uses the new words.
- The check of the GIVEN, read from the ledger before each takeover, now also requires that no other run of the project names a work branch. It counts such a run whatever its status, so it can only be stricter than the words.
- Iteration 3's unjudged case is now judged, as note 3a.
- New fixtures: ticket 13's run parked holding a work branch (a step started by the runner, then one commit pushed to that branch, as a step would have), and the same run parked holding none. They give three new labels: 2d, note 3b, and note 3b with no daemon.
- The probe prints what a refused takeover says with no daemon: its error line and how many stack frames follow.

**Clause coverage.** R11 has three clauses. Its probe prints 1a to 1c; 2a, 2b (twice), 2c, 2d and notes 1, 2, 3a, 3b (twice); and 3a to 3c. R18 has two clauses: 1a to 1c, 2a, 2b. R7 has two clauses: clause 1 twice (what code does, the runner's part), 2a, 2b. No gap.

### Fix-loop accounting

0 of 2 — nothing failed. Nothing was sent to a fix context.

### Figures on the preview's data

No screen changed in this phase, as in the first pass. No seed was loaded and no screenshot was taken.

### Questions for the human

None. Iteration 3's question is answered above. What a refused takeover prints is recorded under R11's evidence, for the pull request to show. It is not a question, because no clause decides it and nothing waits on it.

### Register changes

All in [prd-05 criteria](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md):

- **PRD-05.R11** — **Status `draft` → `verified`.** All three clauses pass on the words as they stand at `fb3f88a`. The probe went red on every one of its 16 break legs in this run. The claim is universal ("any running session"), and the block's `Falsified-by` line, written in iteration 3, names this probe. Nothing written on the block records a clause not yet seen: the old "partial" marker of phase 40 and iteration 3's open question are both settled by later markers. An evidence marker names this iteration.
- **PRD-05.R18** — stays `verified`. An evidence marker: both clauses pass on replay run 10.
- **PRD-05.R7** — stays `verified`. An evidence marker: both clauses pass, the runner's part of clause 1 by replay case scratch-app#37 in run 10.

### Departures

One entry was added to [phase-41-departures.md](phase-41-departures.md): "2026-10-02 — timone#166, verification (iteration 4)". It records that the replay iteration 3's entry asked for was run and checked. Iteration 3's entry is unchanged.

Nothing is carried forward from this iteration, so it has no "Carried forward" section.
