# Phase 46 — Verification Report

- **Date:** 2026-10-04
- **Phase:** [phase-46.md](../phase-46.md) — stamped `Complete`, completion report [phase-46-complete.md](phase-46-complete.md)
- **Scope:** PRD-08.R1, R2, R3, R4, R5, R6 (the phase file's header; the completion report's requirements line names the same six)
- **Live gate owed:** yes — PRD-08.R6, and the `live` criteria whose `Depends-on` this diff touches (listed under *Live gates*). None was run here.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18, PRD-07.R10 — after narrowing; see *Regression* for what the narrowing removed.
- **Branch:** `timone/210-1-every-ticket-the-machine-opens-names-t` @ `df3d9673054f3b862b6f26e2f01c61de2c283282`. Not stacked: its merge-base with `main` is `a217b74`, and phase 45's verification is on `main`, so nothing was merged in.

## Environment

- Container, no services. Timone is a command-line program and needs none: `npm run build` (exit 0), then every probe runs the built `dist/` against throwaway folders. The daemon probes use the verifier rig (`_rig.mjs`): a fake GitHub behind `gh`, a fake model service on 127.0.0.1, and bare git remotes. Nothing reached GitHub or a real model.
- The build before this phase, used by break legs, is `main` at the merge-base `a217b74bc6f7eb13d29cb4b21f0b55593a1c809f`, compiled outside the tree by `_old-build.mjs`.
- No model login exists in this container, so the replay against the real model (`npm run --silent replay`) could not run. `npm run --silent replay -- --dry` ran: 19 of 19 cases passed, $0.00. It uses a scripted runner and is not evidence.
- The runner's instructions asked that the tests of the changed code run, and the whole suite once at the end. Changed code: `npx vitest run src/daemon/people.test.ts src/daemon/chunk-zero.test.ts src/runner/actions.test.ts src/adapters/github-tickets.test.ts` — 4 files, 156 tests passed.
- **Build-health smoke**, run once at the end and not as evidence: `npx vitest run` — 63 test files, 1662 tests passed, 3.41 s. `npx tsc --noEmit` exit 0. **Smoke failures:** none. No failing test, so there was nothing to mark old or new. The report on `main` it would have been compared with is `doc/plans/phases/reports/phase-45-verification.md`, whose smoke also passed whole (its line 16).
- No contradiction between the smoke and any probe.

## Independence declaration

Read:

- `doc/specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md` and its narrative `prd-08-a-ticket-the-machine-opens-names-its-people.md`.
- `doc/plans/phases/phase-46.md`, lines 1–40: the status line, the requirements header, the `Screens changed` line — and, because the range ran on, the *Goal Description* and its list of planning decisions. That list names the function that writes the line and the line's words. No sub-phase body was read. Every verdict below rests on what the probes observed, not on that list.
- `doc/plans/phases/reports/phase-46-complete.md`, whole, and `phase-46-departures.md`.
- `README.md` (by `grep` for run and test lines, and lines 95–104), `CONTEXT.md`, `STATUS.md`, the `scripts` of `package.json`. `doc/standards.md` does not exist in this project.
- The other registers' `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields, by script, to derive the regression set and the live gates.
- On `main`, through `git show`: `doc/plans/phases/reports/phase-45-verification.md`, a `grep -nE '^#|[Ss]moke'` over it — its headings and its lines 16, 17 and 28. **And one read outside the list:** a `grep -n R18` over the same report, which printed its lines 7, 24, 50, 52, 104, 116, 126–130 and 135: its verdict on PRD-05.R18 (BLOCKED, for want of a real model). That was read after this pass's own probe had already printed its BLOCKED verdict, and nothing below depends on it.
- `.claude/skills/timone-wayfind/SKILL.md` — PRD-08.R3 is about this file's words, and its hint says to read it. Its version at `a217b74` was read by the R3 probe's break leg.
- My probe directory `doc/plans/phases/probes/` (the rig and the regression probes, run, not re-derived).
- Names of changed files: `git diff --name-only origin/main...HEAD`.
- The exported names and argument counts of `dist/daemon/chunk-zero.js`, `dist/runner/actions.js`, `dist/daemon/people.js` and `dist/manifest.js`, printed by importing them. How to call `openStepTickets` and the `fileTimoneIssue` action was found by calling them with recording stand-ins and printing what they read and called. No compiled code was read.

Not read: handoffs, diffs, source, the committed test suite, ADRs. All criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. No browser probe ran: no screen changed.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-08.R1 | MUST | api | PASS | 0 |
| PRD-08.R2 | MUST | api | PASS | 0 |
| PRD-08.R3 | SHOULD | api | PASS | 0 |
| PRD-08.R4 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-08.R6 | MUST | live | LIVE-GATE (owed, not run) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; 1 clause BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; 1 clause BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** (regression) | 0 |
| PRD-07.R10 | MUST | api | PASS (regression) | 0 |

**The closing gate is not met:** PRD-05.R18 is a MUST criterion in scope and is BLOCKED. It needs the replay against the real model on this build, and this container has no model login. It is not a regression: nothing was observed wrong. Every claimed MUST criterion passed or is a live gate. Zero regressions, zero failures, no fix loop used.

## Evidence

### PRD-08.R1 — PASS

`node doc/plans/phases/probes/prd-08.r1.mjs` — new this pass, break run then real run. The built daemon walks ticket #12 of a fixture project to an approved list of three pieces, on the fake GitHub, and the step tickets it opens are read back.

```
    #100 "1. Piece 1: the store" — last line: Named so that GitHub tells them about this ticket and every comment on it: @fvermaut
    #101 "2. Piece 2: the count" — last line: Named so that GitHub tells them about this ticket and every comment on it: @fvermaut
    #102 "3. Piece 3: the filter" — last line: Named so that GitHub tells them about this ticket and every comment on it: @fvermaut
=== PRD-08.R1 clause 1 — no instructors and operator fvermaut: a named person approves three pieces, and each of the three tickets the machine opens contains @fvermaut
    break leg: RED (as required) — step ticket 1 (#100) does not name @fvermaut: "keep the to-dos. Delivers PRD-01.R1.\n\nPart of #12. The full list is in `doc/plans/breakdowns/ticket-12.md`."
    green leg: PASS — assertion held
    #100 "1. Piece 1: the store" — last line: Named so that GitHub tells them about this ticket and every comment on it: @alice @bob
    ...
=== PRD-08.R1 clause 2 — instructors [alice, bob]: a ticket the machine opens for one of the pieces contains @alice and @bob
    break leg: RED (as required) — step ticket 1 (#100) does not name @alice: "keep the to-dos. ..."
    green leg: PASS — assertion held
    tickets created: "1. Piece 1: the store", "3. Piece 3: the filter"
    calls touching #50: gh issue edit 50 --repo probe-owner/fixture --add-blocked-by 100
    #50 body after: "PROBE-R08-SENTINEL: this body was written before the opening ran again."
=== PRD-08.R1 clause 3 — a ticket for a piece already exists and the opening finds it by its title: it is not opened again and its body is not changed
    break leg: RED (as required) — the piece-2 ticket exists 1 times: #101
    green leg: PASS — assertion held
--- PRD-08.R1: PASS (3 clause labels, 3 passing)
```

Clause 1 PASS, clause 2 PASS, clause 3 PASS. A name counts only in plain text, outside backticks. In clause 3, the existing ticket for piece 2 (#50) was given a `blocked by` relation to piece 1 and nothing else; its body is unchanged.

### PRD-08.R2 — PASS

`node doc/plans/phases/probes/prd-08.r2.mjs` — new this pass, break run then real run. The fake runner calls the `file_timone_issue` action on its first wake; the issue is read back from the Timone repository on the fake GitHub.

```
    filed on probe-owner/timone: "PROBE-R08: what was seen, naming nobody.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @fvermaut"
    filed on probe-owner/timone: "PROBE-R08: the runner wrote `@fvermaut` here, but only inside code.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @fvermaut"
=== PRD-08.R2 clause 1 — operator fvermaut and a timone project with no instructors: a Timone issue whose words name nobody is opened containing @fvermaut, added by code whatever the words
    break leg: RED (as required) — the issue filed with "PROBE-R08: what was seen, naming nobody." does not name @fvermaut in plain text: "PROBE-R08: what was seen, naming nobody."
    green leg: PASS — assertion held
    filed on probe-owner/timone: "PROBE-R08: what was seen, naming nobody.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @fvermaut"
=== PRD-08.R2 clause 2 — a run on a client project with instructors [client-person]: the Timone issue names the timone project's people and does not contain @client-person
    break leg: RED (as required) — the issue does not name the timone project's people (@fvermaut): "PROBE-R08: what was seen, naming nobody.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @client-person"
    green leg: PASS — assertion held
--- PRD-08.R2: PASS (2 clause labels, 2 passing)
```

Clause 1 PASS (two different sets of runner words, one with the name only inside backticks; code added the plain-text name both times). Clause 2 PASS. The clause-2 break gives the `timone` project the instructor `client-person`: the issue then names `@client-person`, which shows the name follows the `timone` project's entry and not the run's project.

### PRD-08.R3 — PASS

`node doc/plans/phases/probes/prd-08.r3.mjs` — new this pass, break run then real run. It reads `.claude/skills/timone-wayfind/SKILL.md`; the break leg reads the same file at `a217b74`.

```
    code writes: "Named so that GitHub tells them about this ticket and every comment on it: @someone"
=== PRD-08.R3 label a — the step that creates the map ticket says to end it with the line naming the project's people, and the map template carries it
    break leg: RED (as required) — the step that creates the map does not say to name the project's people: 3. **Create the map** ...
    green leg: PASS — assertion held
=== PRD-08.R3 label b — each step that creates decision tickets says each ends with the line naming the project's people
    break leg: RED (as required) — a step that creates decision tickets does not say to name the project's people: 4. **Create the tickets you can specify now** ...
    green leg: PASS — assertion held
    **Where the people are found.** Read `timone.yaml`. Use the project's `instructors` when it lists any. Otherwise use the top-level `operator`. These are the people allowed to instruct the project's runner.
=== PRD-08.R3 label c — the instructions say where the people are found: timone.yaml, instructors, else operator
    break leg: RED (as required) — the instructions do not say where the people are found
    green leg: PASS — assertion held
--- PRD-08.R3: PASS (3 clause labels, 3 passing)
```

The criterion is one paragraph, read as three labels. The line the instructions give is the same line the built code writes. The first run of this probe failed labels a and b because of two faults in the probe: its sample list was missing a part the opening needs, and a pattern missed one step's heading. Both were fixed in the probe before any verdict. The app was not involved, and no fix loop was used.

### PRD-08.R4 — PASS

`node doc/plans/phases/probes/prd-08.r4.mjs` — new this pass, break run then real run.

```
    gh issue create --repo probe-owner/fixture --title 1. Piece 1: the store --body --label timone --parent 12 (body omitted)
    gh issue create --repo probe-owner/fixture --title 2. Piece 2: the count --body --label timone --parent 12 (body omitted)
    gh issue create --repo probe-owner/fixture --title 3. Piece 3: the filter --body --label timone --parent 12 (body omitted)
    gh issue create --repo probe-owner/timone --title PROBE-R08: a fault in Timone --body --label bug (body omitted)
    151 gh calls read; 0 set an assignee
=== PRD-08.R4 clause 1 — on both paths, the ticket opened has no assignee and the gh command that opens it carries no --assignee
    break leg: RED (as required) — a gh call sets an assignee: gh issue create --repo probe-owner/fixture --title injected --body x --assignee fvermaut | gh issue edit 100 --repo probe-owner/fixture --add-assignee fvermaut
    green leg: PASS — assertion held
    piece 1 is #100: last line "Named so that GitHub tells them about this ticket and every comment on it: @fvermaut"; runs: #12, #100, #101, #102
    first comment on it: **Picked this up.**
=== PRD-08.R4 clause 2 — a ticket for a piece that names @fvermaut, open, not blocked, unassigned: it can be chosen as the next piece to start
    break leg: RED (as required) — the ticket for piece 1 (#50) was not chosen; runs: #12, #100, #101
    green leg: PASS — assertion held
--- PRD-08.R4: PASS (2 clause labels, 2 passing)
```

Clause 1 PASS: every `gh` call of both paths was read for `--assignee`, `-a`, `--add-assignee`, or an API call naming assignees, and every opened ticket's assignees were read back. The break sends two assigning calls through the same fake `gh`, to show the check reads what is sent. Clause 2 PASS: the daemon started a run on piece 1's ticket (#100), which names `@fvermaut`, and posted "Picked this up". The break leaves piece 1's ticket on the forge beforehand, held with `timone:held`; the opening uses it and it is not chosen.

### PRD-08.R5 — PASS

`node doc/plans/phases/probes/prd-08.r5.mjs` — new this pass, break run then real run. The daemon refuses to start when a project names nobody (seen: `The daemon does not start: project "fixture" names nobody who may instruct it.`). As the register's hint says, both paths are called directly in the built code, with a manifest that has no `operator` and no `instructors`, and a recording tracker in place of GitHub. The same calls are made in the build before this phase, and the tracker calls are compared one by one.

```
    namedPeople: client [], timone []
    step ticket body: "keep the to-dos. Delivers PRD-01.R1.\n\nPart of #12. The full list is in `doc/plans/breakdowns/ticket-12.md`."
    step ticket body: "count the open ones. Delivers PRD-01.R2.\n\nPart of #12. The full list is in `doc/plans/breakdowns/ticket-12.md`."
    Timone issue body: "PROBE-R08: what was seen."
    tracker calls, this build: 9; build before: 9; action returned: {"ok":true,"said":"Filed Timone issue #100."}
=== PRD-08.R5 clause 1 — namedPeople gives nobody: on both paths the ticket opens as before this change, with no @-name added and no lone @
    break leg: RED (as required) — a body contains "@": "keep the to-dos. ...\n\nNamed so that GitHub tells them about this ticket and every comment on it: @fvermaut"
    green leg: PASS — assertion held
--- PRD-08.R5: PASS (1 clause labels, 1 passing)
```

The only clause PASSES. Both paths opened their tickets; no body holds an `@`; every tracker call matches the build before this phase.

### PRD-08.R6 — LIVE-GATE

Not run, as the runner's instructions say: only fvermaut can read fvermaut's own GitHub notifications. See *Live gates*.

### Regression set — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18, PRD-07.R10

`node doc/plans/phases/probes/run.mjs --regression` — real runs only. It runs every MUST + api + verified criterion, including three the narrowing removed (see *Regression*).

```
| PRD-01.R2  | PASS      | R2 — Project manifest
| PRD-01.R3  | PASS      | R3 — Workspace sync
| PRD-05.R2  | PASS      | R2 — The runner acts only through the actions code gives it
| PRD-05.R3  | PASS      | R3 — Nothing reaches a default branch without a yes from a named person
| PRD-05.R4  | PASS      | R4 — A run that changed the project's files ends at a pull request
| PRD-05.R5  | PASS      | R5 — Code lists every departure on the pull request, and a skipped check comes first
| PRD-05.R7  | PASS      | R7 — The runner never records an approval nobody gave
| PRD-05.R10 | PASS      | R10 — Only named people can instruct the runner
| PRD-05.R11 | PASS      | R11 — `takeover` and `cancel` stay, and `retry` goes
| PRD-05.R18 | BLOCKED   | R18 — The runner passes a replay of the recorded failures
| PRD-06.R5  | NO PROBE  | R5 — A box never holds a GitHub token that runs out before its next one arrives
| PRD-07.R10 | PASS      | R10 — The breakdown shows which pieces are built at the same time

10 passing, 0 failing, 1 blocked, 1 with no probe.
```

Blocked clauses, from the same output:

```
=== PRD-05.R2 clause 2b — every commit on the watched run's pull requests carries its step session's Timone-Stage trailer
    BLOCKED — GitHub could not be read from here (gh).
=== PRD-05.R7 clause 1 (runner) — the real runner, told "approve them yourself in my name", records no approval
    BLOCKED — needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build (run 10's commit 4686ef4 is not in this branch's history).
=== PRD-05.R18 clause 1 — each case in the table chooses the action in the table's last column, on each of three separate tries
    BLOCKED — the recorded replay judged here is older than this build: run 10's commit 4686ef4 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).
=== PRD-05.R18 clause 2a — the replay set was run on the runner's instructions as the pull request carries them
    BLOCKED — the newest recorded replay is older than this build: run 10's commit 4686ef4 is not in this branch's history. The replay owed on this build has not been run yet.
=== PRD-05.R18 clause 2b — its result is on the pull request: the record holding it is on the branch the pull request is opened from
    BLOCKED — no replay on this build is recorded yet, so there is no result to look for on the branch.
```

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no script forward from an earlier report. (The completion report calls PRD-08.R6 a HUMAN-CHECK. The register puts it on the `live` channel, and the register decides: it is reported under *Live gates*, with no script.)

## Live gates

- **PRD-08.R6** — last live gate: never. **Owed by this phase**: it is one of its claimed criteria. Not run, as the runner's instructions say. What it needs is in the register: on scratch-app, never on ivtrends, with fvermaut's watch setting for `fvermaut/scratch-app` on "Participating and @mentions", fvermaut's GitHub notifications show a ticket the machine opened and a later comment on it.
- Owed because this diff touches what they declare they depend on (`src/daemon/`, `src/adapters/`, `src/runner/`, `.claude/skills/`): PRD-01.R4 (never), PRD-02.R1 ([phase-32-live-gate.md](phase-32-live-gate.md), the marked-ticket clause only), PRD-02.R2 (never), PRD-02.R4 (never), PRD-02.R6 (never), PRD-02.R7 (never), PRD-02.R8 (never), PRD-02.R13 ([phase-32-live-gate.md](phase-32-live-gate.md)), PRD-03.R1 ([phase-35-live-gate.md](phase-35-live-gate.md)), PRD-03.R2 (never), PRD-03.R4 (never), PRD-03.R5 ([phase-35-live-gate.md](phase-35-live-gate.md)), PRD-07.R5 (never), PRD-07.R7 (never), PRD-07.R14 (never).
- No `Depends-on` line, so always in scope and counted as owed: PRD-04.R1 (never), PRD-05.R9, R12, R13, R15 (each [phase-40-live-gate.md](phase-40-live-gate.md)). PRD-04.R7 is `deprecated` and is not counted.
- Not owed (their `Depends-on` is not touched): the other `live` criteria of PRD-01, PRD-03.R3 and PRD-06.R1–R4.

The completion report says the plan counts the R6 run as the live gate this phase owes for PRD-02.R1, R2, R4 and R8. One watched run on scratch-app that opens step tickets would cover R6 and touch those.

## Regression

- PRD-05.R2 — PASS (clause 2b BLOCKED: GitHub could not be read from here)
- PRD-05.R3 — PASS
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS (clause 1, the real runner's part, BLOCKED: needs the replay against the real model)
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — BLOCKED: needs the replay against the real model on this build
- PRD-07.R10 — PASS (`Depends-on` touched: `src/runner/`)

PRD-05's criteria carry no `Depends-on`, so they are always in scope.

What the narrowing removed:

- PRD-01.R2 — `Depends-on: src/manifest.ts, src/commands/projects.ts`; neither is touched. Its probe ran anyway, inside the one command: PASS.
- PRD-01.R3 — `Depends-on: src/commands/workspace.ts, src/git.ts`; neither is touched. Ran anyway: PASS.
- PRD-06.R5 — `Depends-on: src/adapters/credentials.ts, src/daemon/container-runtime.ts`; neither is touched. No probe exists.

## Probes

**5 probes proven able to fail this pass, 0 not.** (11 regression probes ran their real run only; their break runs were done by earlier passes.)

Written this pass, each the first check of its criterion; each went red on its break leg and green on its real run, both in its first full run and again when all five ran together:

- `prd-08.r1.mjs` — 3 clause labels for 3 clauses. Break: the build before this phase (clauses 1, 2); an existing ticket whose title differs by one word (clause 3).
- `prd-08.r2.mjs` — 2 labels for 2 clauses. Break: the build before this phase (clause 1); the `timone` project given the instructor `client-person` (clause 2).
- `prd-08.r3.mjs` — 3 labels for a one-paragraph criterion. Break: the instructions file at `a217b74`.
- `prd-08.r4.mjs` — 2 labels for 2 clauses. Break: two assigning `gh` calls sent through the fake `gh` (clause 1); piece 1's ticket already there and held (clause 2).
- `prd-08.r5.mjs` — 1 label for 1 clause. Break: the same calls with `operator: fvermaut`.
- `_people.mjs` — shared helpers for these five: the walk to an approved list of three pieces, the filed Timone issue, and the plain-text name reader.

Ran without a break run this pass (real run only, through `run.mjs --regression`): PRD-01.R2, PRD-01.R3, PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R10.

No probe without a break step. Clause coverage: every PRD-08 criterion's clauses each have a label. The regression probes printed the label counts above; their registers' clauses were not changed by this phase.

## Fix-loop accounting

0 of 2 — the initial pass was clean. No defect brief was written. The two faults found in the R3 probe were in the probe, fixed before any verdict, and are not loops.

## Figures on the preview's data

No screen changed in this phase. The phase file's `Screens changed` line reads "none".

## Questions for the human

None.

## Register changes

In `doc/specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md`:

- PRD-08.R1 — `draft` → `verified`. Its `Falsified-by` line names a check that can fail; this pass's probe went red on every break leg.
- PRD-08.R2 — `draft` → `verified`. Same.
- PRD-08.R4 — `draft` → `verified`. Same.
- PRD-08.R5 — `draft` → `verified`. Its words make no claim about every case or every time: "either path" means the two paths, and both were checked.
- PRD-08.R3 — stays `draft`, with a dated marker. It passed, but its words say "every ticket it opens", which is a claim about all cases, and its block has no `Falsified-by` line. The probe `prd-08.r3.mjs`, proven able to fail, could be named there.
- PRD-08.R6 — unchanged (`live`).
- No regression criterion changed.

## Carried forward

- **PRD-05.R18 — BLOCKED.** The replay against the real model on this build is owed: `npm run --silent replay`, from a terminal logged in to Claude. The same replay settles PRD-05.R7's runner clause. Recorded in [phase-46-departures.md](phase-46-departures.md).
- **PRD-08.R6 — live gate owed**, with the other live gates listed above. Recorded by the build in [phase-46-departures.md](phase-46-departures.md), entry 5.
