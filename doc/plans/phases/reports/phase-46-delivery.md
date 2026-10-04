# Phase 46 — Delivery Report

- **Date:** 2026-10-04
- **Phase:** [phase-46.md](../phase-46.md) — `Complete`, verified in [phase-46-verification.md](phase-46-verification.md)
- **Branch:** `timone/210-1-every-ticket-the-machine-opens-names-t` @ `67a6171` (before this report)
- **Base:** `main` — the project's default branch; the branch was cut from it (merge-base `a217b74`), not stacked.
- **Pull request:** opened against this report, from the branch above to `main`; its address is posted on ticket #210.
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none. The names appear in GitHub ticket text.
- **Questions for the human:** none — the verification report's section of that name says none.
- **Departures:** [phase-46-departures.md](phase-46-departures.md) — 6 entries.

## Scope

Every ticket the machine opens names the project's people. A ticket opened for a piece of an approved list ends with the line `Named so that GitHub tells them about this ticket and every comment on it: @<login> …`, so GitHub notifies those people of the ticket and of each later comment. An issue the runner files on Timone gets the same line, naming the people of the `timone` project, never those of the client project where the fault was seen. The charting instructions (`.claude/skills/timone-wayfind/SKILL.md`) tell the session to add the same line on the tickets it opens. Nobody is assigned. A project that names nobody gets its tickets with no line.

Claims PRD-08.R1, R2, R3, R4, R5, R6 ([register](../../../specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md)). Ticket: [#210](https://github.com/fvermaut/timone/issues/210), piece 1 of the list for [#207](https://github.com/fvermaut/timone/issues/207).

## How to try it

### Against the preview

Timone has no preview configured for pull requests (no `bindings.preview` in `timone.yaml`). Use the local steps below.

### On a local checkout

Install and build as the project's [README.md](../../../../README.md) § Getting started says. Then, from the checkout of this branch:

1. `npx vitest run src/daemon/people.test.ts src/daemon/chunk-zero.test.ts src/adapters/github-tickets.test.ts src/runner/actions.test.ts` — every test passes. These hold the new cases: one person named on three piece tickets, two people named, an existing ticket left alone, a Timone issue naming Timone's people and not the client's, and no line when nobody is named.
2. `npm run type-check; echo "exit: $?"` — prints `exit: 0`.
3. `grep -rn --include='*.ts' -e '--assignee' src | grep -v '\.test\.ts:' | grep -v '^\S*:\s*//' | grep -v '^\S*:\s*\*'; echo "exit: $?"` — prints only `exit: 1`: no code outside tests assigns anyone.
4. `grep -n "Named so that GitHub tells them about this ticket and every comment on it" .claude/skills/timone-wayfind/SKILL.md` — at least two lines: the new section and the map template.
5. The checker's own scripts for PRD-08.R1 to R5, which run the built daemon against a fake GitHub, are listed with their commands in [phase-46-verification.md](phase-46-verification.md) § Evidence. Each prints `PASS` for every clause.
6. The real-world check (PRD-08.R6, not run): on scratch-app, with your watch setting for `fvermaut/scratch-app` on "Participating and @mentions", let the machine open a piece ticket, then comment on it. Your GitHub notifications should show both.
7. The replay against the real model (not run): `npm run --silent replay`, from a terminal logged in to Claude. It should end with every case passing.

## Verification outcome

Quoted from [phase-46-verification.md](phase-46-verification.md). Loops consumed: 0 of 2.

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

The verification gate did not pass in full: PRD-05.R18 is BLOCKED because the replay against the real model needs a Claude login, and this machine had none. Nothing was observed wrong: zero regressions, zero failures. Whole suite: 63 files, 1662 tests passed; `tsc --noEmit` exit 0.

### Outstanding for the human

- [ ] **Not run — the replay against the real model** (PRD-05.R18, and PRD-05.R7's runner clause): run `npm run --silent replay` on this branch from a terminal logged in to Claude, and post the result on the pull request.
- [ ] **Not run — the check that GitHub really notifies fvermaut** (PRD-08.R6, live gate): on scratch-app, with the watch setting for `fvermaut/scratch-app` on "Participating and @mentions", see a piece ticket the machine opened, and a later comment on it, in fvermaut's GitHub notifications. A Timone issue naming him should notify him the same way. Steps in the register, PRD-08.R6.
- [ ] Other live gates this diff touches, per [phase-46-verification.md](phase-46-verification.md) § Live gates (PRD-01.R4, PRD-02.R1, R2, R4, R6, R7, R8, R13, PRD-03.R1, R2, R4, R5, PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-07.R5, R7, R14). One watched run on scratch-app that opens piece tickets covers PRD-08.R6 and touches PRD-02.R1, R2, R4 and R8.
- [ ] PRD-08.R3 passed but stays `draft`: its block has no `Falsified-by` line. The checker's R3 script could be named there.

## Standards review — phase 46

- **Read:** `standards/code-smells.md` (Timone's review reference); `process.md` § Writing to the human; `tsconfig.json`; `package.json` (scripts); the diff of the 8 non-process files; for context, `src/runner/actions.ts` lines 205–215 and 1035–1062, `src/manifest.ts` lines 163–167, and a search of `src/` for where `namedPeople`, `withPeopleNamed` and `NAMED_LINE_START` are used. The project has no `doc/standards.md`, and no ESLint or Prettier configuration.
- **Diff:** `origin/main...HEAD` — 8 files reviewed, +328/−21
- **Findings:** 2

### 1. The project name `"timone"` is written out a third time, though the project object is already in hand — magic number or string

- **Where:** `src/runner/actions.ts:1058`
- **What:** `body: withPeopleNamed(body, namedPeople(deps.manifest, "timone")),`. Two lines above, `const timone = timoneProject(deps.manifest);` has already looked up the Timone project. That object carries `name: "timone"` (set at line 212). The literal `"timone"` is now written in three places in this file: lines 211, 212 and 1058.
- **Why it matters:** Magic number or string. The literal has a domain meaning, and it is written again at the place it is used. Which project counts as Timone is decided in `timoneProject`, and line 1058 makes that decision again on its own. If one place changes, the others can be missed. This is the "repeated one-liner" case of duplicated code.
- **Suggested remediation:** Use `namedPeople(deps.manifest, timone.name)` at line 1058. Optionally, put the name in one constant that `timoneProject` uses — not applied here.

### 2. `NAMED_LINE_START` is exported, but no other file imports it — speculative generality

- **Where:** `src/daemon/people.ts:5–6`
- **What:** `export const NAMED_LINE_START = "Named so that GitHub tells them about this ticket and every comment on it:";`. A search of `src/` finds it used only inside `people.ts` (line 29). The tests write the sentence out in full each time and do not import the constant.
- **Why it matters:** Speculative generality. The export is a public entry point with no caller outside its own file. `tsc` does not report unused exports, so the tool configuration does not catch this.
- **Suggested remediation:** Drop the `export` keyword, or keep it only once code that reads tickets needs it — not applied here.

The new text in `.claude/skills/timone-wayfind/SKILL.md` follows the writing rule: short sentences, plain words, no metaphors. The repeated sentence in the test files is duplication in test code, which the reference allows, so it is not a finding.

## Spec review — phase 46

- **Read:** `doc/specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.md`, `doc/specs/prd/prd-08-a-ticket-the-machine-opens-names-its-people.criteria.md`, `doc/plans/phases/phase-46.md` (lines 1–25), `git diff origin/main...HEAD -- doc/specs/prd/`, the diff of the 8 non-process files, `src/manifest.ts` (`namedPeople`, lines 163–167), and a search of `src/` for the callers of `openStepTickets` and `namedPeople`
- **Diff:** `origin/main...HEAD` — 8 files reviewed, +328/−21
- **Findings:** none

The diff does what PRD-08.R1 to R6 ask.

- **PRD-08.R1:** Each new step ticket's body ends with the names: `withPeopleNamed(stepBody(...), people)`, with the names from `namedPeople(deps.manifest, deps.project.name)`. That call in `src/runner/actions.ts` is the only caller of `openStepTickets`. A step ticket found by its title is not opened again and not edited. Tests cover one person and three tickets, two people, and a second run.
- **PRD-08.R2:** `fileTimoneIssue` adds the names in code, using `namedPeople(deps.manifest, "timone")`. It never uses the people of the run's own project. A test checks that `@client-person` is absent.
- **PRD-08.R3:** The new section in `SKILL.md` says where to find the people (`instructors`, or else `operator`); to add the line to the map and to every decision ticket, both when charting and when adding tickets later; and never to put the line inside backticks.
- **PRD-08.R4:** No code path adds `--assignee`. Tests check `--assignee` is absent for `createStep` and `createIssue`. Another test shows the first piece's ticket can still be chosen by `nextStep`.
- **PRD-08.R5:** `withPeopleNamed` returns the body unchanged when the list is empty, or holds only blank or `@`-only logins. No lone `@` is added. Both paths have a test for this.
- **PRD-08.R6:** Not observable from code. The code makes it possible: the line is plain text with no backticks, holds one `@login` per person, and goes into the body when the ticket is opened.

Nothing outside PRD-08's scope was added: pull requests, older tickets and comments are untouched. The only other change under `doc/specs/prd/` is the criteria register: R1, R2, R4 and R5 set to `verified`; R3 and R6 stay `draft`. That matches what the phase claims.


## Notes

- Not stacked: no other pull request must merge first.
- The first Spec review was stopped by a guard before it returned anything, because its instructions named the checker's own folder. It was started again, fresh, with the same read list; the report above is that later run.
- No commit in this delivery changes code. Both reviews' findings are for a later ticket.
