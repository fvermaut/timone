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
