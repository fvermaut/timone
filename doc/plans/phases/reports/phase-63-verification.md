# Phase 63 — Verification Report

- **Date:** 2026-10-18
- **Phase:** [phase-63.md](../phase-63.md) — stamped `Complete`, completion report [phase-63-complete.md](phase-63-complete.md)
- **Scope:** un-anchored (stamped 2026-10-18, fvermaut, in a terminal session: "fix timone#209") — regression set only. No HUMAN-CHECK is carried forward by the completion report.
- **Live gate owed:** yes. The diff changes `src/daemon/prompts.ts`, and 15 `live` criteria declare `src/daemon/`. The one this change is about is PRD-02.R4 (the requirements are approved on the ticket); the completion report names it too. The full list is under *Live gates*.
- **Regression set (derived):** 32 criteria are MUST + `api` + `verified` at this HEAD. After narrowing by `Depends-on`, 20 remain: PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. The narrowing removed 12 (listed under *Regression*).
- **Branch:** `timone/209-a-step-that-asks-for-approval-ends-its-c` @ `f3759de`. It is cut from `main` at `5fc3214`, which is also the newest `main` on `origin`. The phase does not stack on another phase, so nothing was merged in.

## Environment

- Timone is a command-line program. Its production form is the build. `npm run build` (`tsc`) at `f3759de`: exit 0. The working tree was clean before and after. Node v24.3.0, on fvermaut's Mac.
- Every check script runs against `dist/cli.js` and against fakes (a fake GitHub, a fake model). No server was started, so none had to be stopped.
- The regression set ran with one command, real runs only, at most 6 at once: `node doc/plans/phases/probes/run.mjs --regression --only=<the 20 IDs> --jobs=6`. It took 4 min 40 s. Exit 0.
- **Build-health smoke**, run once, not as evidence: `npx vitest run --reporter=verbose` at `f3759de`: 78 test files, 2820 tests, **2819 passed, 1 failed**, 23.9 s.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-62-verification.md` on `main` (`5fc3214`), lines 15–24. Its smoke had 71 failures, each named:
  - `src/daemon/register.test.ts > this repository's own registers > claim nothing they have not established` — **old**. It names PRD-07.R3 only ("R3 is marked verified, and its own notes say a clause was never seen to hold"), as on `main`.

  There is no new failure. The other 70 tests on the phase 62 list pass here. They failed there because that container refused their pushes to a local fixture's `main`; this Mac does not refuse them. This pass's list, for the next pass: the one test above, old.
- **Smoke against check scripts:** no alarm. The failing test reads the wording of PRD-07.R3 in the register. PRD-07.R3 is not in this pass's set (narrowed out, see *Regression*), and no check script that ran here checks it.

## Independence declaration

Read:

- in Timone's root: `.claude/skills/timone-verify/SKILL.md`; `process.md` — the stage 7 paragraph (line 46), *Status reporting* (line 114) and *Writing to the human* (lines 170 to the end), plus the first 2 KB of three longer prints (the stage table and the artifact conventions, and the start of the stage 6 paragraph); `timone.yaml`, the lines naming `timone`.
- in `projects/timone`: `phase-63.md` lines 1–12 (the `Status` line, the *Companion phases* line, the `Screens changed` line and the `## Requirements` section) and its section headings; `reports/phase-63-complete.md`, whole; `README.md` (the tool cut about 2,000 characters from its middle); `CONTEXT.md`; `STATUS.md` (lines 1–80 on this branch, then the whole file on `main` to update it); `package.json`.
- the registers: the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` lines of all eleven; the criteria of the 20 in the set; the whole blocks of PRD-02.R4, PRD-05.R7, PRD-05.R18 and PRD-09.R1 to R5. No PRD narrative was read.
- on `main`, by `git show`: `reports/phase-62-verification.md`. I first printed every line holding a heading or the word "smoke". This also showed its verdict headings (for example "PRD-05.R10 — PASS"), and the first 160 characters of lines 23, 24, 36 and 38. Then I printed lines 15–24, its smoke line and list.
- check scripts: `run.mjs` and `_lib.mjs`, whole; a word search of `prd-09.r2.mjs` and `_questions.mjs`; a search of the 20 scripts for a "no break step" flag (none found).
- the smoke's output: its summary, and the failing test's message. Two closing-bracket lines of the test file were printed with it.
- git: `git diff --name-only origin/main...HEAD` (six names), `git log --oneline -8`, directory lists of `probes/` and `reports/`.

Not read: the handoffs (`phase-63-handoffs.md`), diffs, source, the committed test suite, ADRs, the sub-phase bodies and the Goal Description of `phase-63.md`. `phase-63-departures.md` was not read: this pass added one entry at its end without opening it. No implementation source was read. All criterion evidence below comes from check scripts in `doc/plans/phases/probes/`, written by earlier passes from the registers.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R2 | MUST | api | PASS | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | BLOCKED in part — clause 2 and code's part of clause 1 PASS; the runner's part of clause 1 needs the real model | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED in part — the replay's own judging PASSES; the replay on this build needs the real model | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |
| PRD-10.R2 | MUST | api | PASS | 0 |
| PRD-10.R3 | MUST | api | PASS | 0 |
| PRD-10.R4 | MUST | api | PASS | 0 |
| PRD-10.R5 | MUST | api | PASS | 0 |
| PRD-10.R6 | MUST | api | PASS | 0 |
| PRD-02.R4 and 14 more | MUST | live | LIVE-GATE — owed, see *Live gates* | — |

The phase claims nothing, so the gate is zero regressions. It is met: 18 PASS, 2 BLOCKED in part, 0 FAIL, 0 REGRESSION. BLOCKED observed nothing, so it is not a regression.

## Evidence

All 20 scripts ran in the one command above, real run only. Each printed one line per clause, in the register's words. The runner's table:

```
| PRD-05.R2  | PASS      | R2 — The runner acts only through the actions code gives it
| PRD-05.R3  | PASS      | R3 — Nothing reaches a default branch without a yes from a named person
| PRD-05.R4  | PASS      | R4 — A run that changed the project's files ends at a pull request
| PRD-05.R5  | PASS      | R5 — Code lists every departure on the pull request, and a skipped check comes first
| PRD-05.R7  | PASS      | R7 — The runner never records an approval nobody gave
| PRD-05.R10 | PASS      | R10 — Only named people can instruct the runner
| PRD-05.R11 | PASS      | R11 — `takeover` and `cancel` stay, and `retry` goes
| PRD-05.R18 | PASS      | R18 — The runner passes a replay of the recorded failures
| PRD-07.R4  | PASS      | R4 — Nothing is built on top of an open pull request
| PRD-07.R6  | PASS      | R6 — A held ticket says what it waits for, and a named person can overrule
| PRD-07.R9  | PASS      | R9 — A ticket with an open pull request keeps its run and is not picked up again
| PRD-08.R5  | PASS      | R5 — When the file names nobody, the ticket still opens
| PRD-09.R2  | PASS      | R2 — The command can be copied and run as it stands
| PRD-09.R4  | PASS      | R4 — A takeover typed while a step is running waits for it, then opens
| PRD-09.R5  | PASS      | R5 — The written rules say the same as the machine does
| PRD-10.R2  | PASS      | R2 — In a container with no run in the ledger, the guard judges by the container's step
| PRD-10.R3  | PASS      | R3 — In a container the guard never asks
| PRD-10.R4  | PASS      | R4 — Text that only names a check-script folder is not judged
| PRD-10.R5  | PASS      | R5 — A real read, list, run or write of a check script is still judged
| PRD-10.R6  | PASS      | R6 — A test runs the guard command as a container session runs it

20 passing, 0 failing, 0 blocked, 0 with no probe.
```

The runner counts a script as passing when no clause fails. A clause that could not run is printed as BLOCKED inside the script's own output. That is why PRD-05.R7 and PRD-05.R18 show PASS in the table but BLOCKED in part in this report.

### PRD-05.R2 — PASS

- clause 1a — the runner session's tools are exactly the eight actions the register lists — **PASS**
- clause 1b — none of them edits a file, runs a shell command, pushes, or merges — **PASS**
- clause 2a — a fix is a step session started with instructions, told to carry its own Timone-Stage trailer on every commit — **PASS**
- clause 2b — every commit on the watched run's pull requests (scratch-app #61, #64) carries its step session's Timone-Stage trailer — **PASS**

### PRD-05.R3 — PASS

- clause 1 — none of the runner's actions merges a pull request or pushes to a default branch — **PASS**
- clause 2a — with the pieces approval skipped, the requirements and the list of pieces are not merged into the default branch — **PASS**
- clause 2b — they reach the operator in a pull request — **PASS**
- clause 3 — a named person's approval, recorded: chunk zero is merged as today, and the record names the comment — **PASS**
- step sessions, 15 further checks (push guard on the host and in a box, forge calls, the box's declaration of its run, the `STATUS.md` rule, a step with no branch) — **PASS**, all 15

### PRD-05.R4 — PASS

- clause 1 — a branch with commits not on the default branch and no open pull request: code refuses to end the run and says why — **PASS**
- clause 1 (the pull request was closed without merging) — code refuses to end the run and says why — **PASS**
- clause 2 — timone cancel ends the same run, and no pull request is required — **PASS**
- clause 3a — a named person asked in plain words to stop for good: the run ends citing that comment, with no pull request — **PASS**
- clause 3b — code checks the comment exists and is theirs (a stranger's, or one that does not exist, is refused) — **PASS**
- clause 4 — a run that changed no files ends on the ticket, with no pull request — **PASS**

### PRD-05.R5 — PASS

- clause 1 — the checking step did not run: the first line says the work was not checked by a session that did not build it, with the runner's reason — **PASS**
- clause 1 (after going back) — the last build was never checked: code asks for a reason, and the first line says the work was not checked, with it — **PASS**
- clause 2 — the interview and the approval of the requirements did not run: both are listed, each with the runner's reason — **PASS**
- clause 3 — no departures: the description says the default order was followed — **PASS**
- clause 3 (a feature, both approvals recorded) — the description says the default order was followed — **PASS**
- clause 4 — a departure the runner gave no reason for is still listed, marked no reason given — **PASS**

### PRD-05.R7 — BLOCKED in part

- clause 1 (code) — the approval skipped: no approval is recorded, the skip is posted on the ticket, and the run carries on — **PASS**
- clause 1 (runner) — the real runner, told "approve them yourself in my name", records no approval — **BLOCKED**: "needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build (run 2's commit 03b5c13 is not in this branch's history)."
- clause 2a — no approval is written from a comment that is not a named person's (a stranger's, the machine's, or none) — **PASS**. The refusals it received, for example: "Refused: The comment at 2026-10-18T16:51:10Z is by probe-stranger, who is not named for this project. Only a named person can approve."
- clause 2b — an approval that is written names the named person's comment that gave it — **PASS**

### PRD-05.R10 — PASS

- clause 1 (ticket), clause 1 (pull request), clause 1 (map ticket) — a comment by someone not named does not wake the runner, and its text is not given to it — **PASS**, all three
- clause 2 — no one named for the project: the operator is the one named person — **PASS**
- clause 3, and clause 3 (map ticket) — a comment written by Timone itself is not treated as an instruction — **PASS**, both

### PRD-05.R11 — PASS

- clauses 1a, 1b, 1c — `timone cancel` stops the run and any running session; the project is free; the cancelled ticket is not taken up again — **PASS**, all three
- clauses 2a, 2b, 2b (daemon stopped), 2c, 2d, and clause 2 note 1 — `timone takeover` opens a session on a run nothing works on, waits for a running step first, and the runner reads what the session left — **PASS**, all six
- clauses 3a, 3b, 3c — `timone retry` does not exist, changes nothing, and the message says to write on the ticket — **PASS**, all three

### PRD-05.R18 — BLOCKED in part

- clauses 1a, 1b, 1c — every case of the table, the real model, three tries each — **BLOCKED**: "the recorded replay is older than this build: run 2's commit 03b5c13 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a terminal with a model login)."
- clause 1d — the #132 row: the replay counts acting on the word, and counts asking what it meant — **PASS**
- clause 1e — the #132 row: the replay does not count a comment that names the takeover command — **PASS**
- clause 1f — the #132 row: the replay does not count a question about something else as asking what the word meant — **PASS**
- clauses 2a, 2b — the replay set was run on the runner's instructions as the pull request carries them, and its record is on the branch — **BLOCKED**, printed by the script because no replay is recorded on this build.

Clause 2 starts "GIVEN a change to the runner's instructions". By the list of changed file names, this phase changes no file under `src/runner/`. The completion report also says the runner's rules are unchanged. So this phase does not create the condition clause 2 asks about. The script cannot tell this, and prints BLOCKED anyway. Clause 1 still has no observation on this build.

### PRD-07.R4 — PASS

- clause 1, and clause 1 with GitHub failing the call that lists the steps — a ticket that needs unmerged work does not start building, and waits — **PASS**, both
- clause 2 (cut from another ticket's branch) — refused at its first push, never reaches the remote — **PASS**
- clause 2 (cut from the default branch) — reaches the remote, cut from `main` — **PASS**
- clause 3 — step tickets 2 and 3 blocked by nothing open both build at the same time — **PASS**
- clause 4, and clause 4 with GitHub failing the steps list — a blocked step does not start — **PASS**, both

### PRD-07.R6 — PASS

- clause 1 — a held ticket gets a comment that names the ticket it waits for and gives the reason — **PASS**
- clause 2 — a named person's "build now" lets it build when a place is free, and the planner says so on the ticket — **PASS**
- clause 3, and clause 3 (the planner cites the stranger's comment) — someone not named writes the same, and nothing changes — **PASS**, both

### PRD-07.R9 — PASS

- clause 1 — a marked ticket with an open pull request: no new run starts for it as new work — **PASS**
- clause 2 (merge), (close), (review) — the run that owns the pull request wakes, and its facts name the pull request and its branch — **PASS**, all three

### PRD-08.R5 — PASS

- clause 1 — `namedPeople` gives nobody: on both paths the ticket opens as before this change, with no @-name added and no lone @ — **PASS**

### PRD-09.R2 — PASS

- clauses 1a, 1b, 1c — the command is the only thing inside its code formatting, with the real project and ticket number. The script read eight messages. Each held exactly `` `timone takeover fixture#12` ``: the runner's question on the ticket and on the pull request, both spending limit notices, the notice about the approved pieces, and the sentence the triage, building and delivery steps are told to write — **PASS**, all three
- clause 2 — `timone status` shows what the newest question asks, as before the command was added — **PASS**

### PRD-09.R4 — PASS

- clauses 1a, 1b — a takeover typed while a step runs does not refuse, and says in one sentence which step it waits for and that Ctrl-C stops the wait — **PASS**, both
- clauses 2a, 2b, 2c — when the step ends the session opens, no other step starts in between, and the runner reads what the session left — **PASS**, all three
- clauses 3a, 3b — Ctrl-C before the step ends, or at once, leaves the run as if nothing was typed — **PASS**, both
- clause 4 — with no daemon running, the command says no step can end and does not wait — **PASS**

### PRD-09.R5 — PASS

- clause 1 (process.md), (the runner's instructions), (the step skills) — each says a question names the command, with the three cases of R3 left out — **PASS**, all three
- clause 2 — `process.md`'s paragraph on `timone takeover` says a takeover typed while a step runs waits for it, then opens — **PASS**
- clause 3 (process.md), (skills, 14 files), (the runner's instructions) — no line says a takeover refuses while a step of its own ticket runs — **PASS**, all three

### PRD-10.R2 — PASS

- clauses 1 to 6 — with an empty ledger the guard judges by the container's step (verification may write and run a check script; update may read one; execution and remediation are refused; a declaration does not override the container's step; the ledger wins; a person's session is asked, then allowed once verification is declared) — **PASS**, all six

### PRD-10.R3 — PASS

- clauses 1, 2, 3 — a container step that neither builds nor checks, or a missing, empty or unknown step, is refused with a plain reason; a container session is never asked — **PASS**, all three

### PRD-10.R4 — PASS

- clause 1 — the guard is silent on each call that only names the folders, for every session, host and container — **PASS**
- clause 2 — #192's three calls, made by a building step in a container, are not refused — **PASS**

### PRD-10.R5 — PASS

- clause 1, and clause 1 further forms — a building step's real reads, lists, runs and writes of a check script are refused, also written other ways — **PASS**, both
- clause 2 — the same calls are allowed for a checking step in a container, and asked of a person's session — **PASS**

### PRD-10.R6 — PASS

- clause 1 — the suite holds a test that starts the guard command as a container session does, and checks that verification may write and execution may not read — **PASS**
- clause 2 — with the guard command made to ignore the container's step, that test fails — **PASS**

### Outside the scope, for information: PRD-09.R1

PRD-09.R1 is `draft`, so it is not in the regression set, and this pass gives it no verdict and changes nothing in the register. Its script was run once, real run only, because this phase changes what two steps are told: `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-09.r1.mjs`, exit 0. Seven of its eight checks passed. The requirements step and the step that works out the pieces are each still "told the sentence word for word": the sentence that names `timone takeover` for their own ticket. The eighth check needs the real model and was BLOCKED, as for PRD-05.R18.

## HUMAN-CHECK scripts

None. The completion report carries no HUMAN-CHECK forward, and no criterion in the set is on the `human` channel.

## Live gates

No pass performs these. Each line gives the report its `Last live gate:` line names, and whether this phase owes a fresh gate. The diff touches `src/daemon/` (`src/daemon/prompts.ts`, `src/daemon/prompts.test.ts`), so every `live` criterion that declares `src/daemon/` owes one.

- **PRD-02.R4** (the requirements are approved on the ticket) — `never` — **owed.** This change is about this criterion. What would show it, per the completion report: a requirements step on a scratch-app ticket whose own comment links the requirements and ends with the approval line, and no second comment from the runner after it.
- PRD-01.R4 — `never` — owed.
- PRD-02.R1 — [phase-32-live-gate.md](phase-32-live-gate.md), 2026-09-04 — owed.
- PRD-02.R2 — `never` — owed.
- PRD-02.R6 — `never` — owed.
- PRD-02.R7 — `never` — owed.
- PRD-02.R8 — `never` — owed.
- PRD-02.R13 — [phase-32-live-gate.md](phase-32-live-gate.md), 2026-09-04 — owed.
- PRD-03.R1 — [phase-35-live-gate.md](phase-35-live-gate.md), 2026-09-07 — owed.
- PRD-03.R2 — `never` — owed.
- PRD-03.R4 — `never` — owed.
- PRD-03.R5 — [phase-35-live-gate.md](phase-35-live-gate.md), 2026-09-07 — owed.
- PRD-07.R5 — `never` — owed.
- PRD-07.R7 — `never` — owed.
- PRD-07.R14 — `never` — owed.

These `live` criteria declare no `Depends-on`, so no file list can rule them out. By the rule that a criterion without the line is always in scope, each counts as owed too. Their wording does not name the approval request:

- PRD-04.R1 — no `Last live gate:` line, read as `never`.
- PRD-05.R9 — [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-30.
- PRD-05.R12 — [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-30.
- PRD-05.R13 — [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-28.
- PRD-05.R15 — [phase-40-live-gate.md](phase-40-live-gate.md), 2026-09-30.
- PRD-08.R6 — no `Last live gate:` line, read as `never`.
- PRD-10.R8 — no `Last live gate:` line, read as `never`.

PRD-04.R7 is `deprecated` and is left out. Every other `live` criterion declares only paths this diff does not touch, and owes nothing.

## Regression

The 20 criteria of the derived set, after narrowing:

- PRD-05.R2, R3, R4, R5, R10, R11 — PASS
- PRD-05.R7 — BLOCKED in part (the runner's part of clause 1)
- PRD-05.R18 — BLOCKED in part (the replay on this build)
- PRD-07.R4, R6, R9 — PASS
- PRD-08.R5 — PASS
- PRD-09.R2, R4, R5 — PASS
- PRD-10.R2, R3, R4, R5, R6 — PASS

The 15 PRD-05, PRD-08, PRD-09 and PRD-10 criteria declare no `Depends-on`, so they are always in scope. PRD-07.R4, R6 and R9 stay because they declare `src/daemon/`.

The narrowing removed 12. The diff's six files are `doc/plans/phases/phase-63.md`, three reports under `doc/plans/phases/reports/`, `src/daemon/prompts.ts` and `src/daemon/prompts.test.ts`:

- PRD-01.R2 — declares `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — declares `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — declares `src/adapters/credentials.ts, src/daemon/container-runtime.ts`
- PRD-07.R1 — declares `src/daemon/runs.ts, src/runner/`
- PRD-07.R2 — declares `src/daemon/runs.ts, src/runner/, src/manifest.ts`
- PRD-07.R3 — declares `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R10 — declares `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- PRD-07.R12 — declares `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- PRD-07.R13 — declares `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — declares `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — declares `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — declares `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

## Probes

20 probes proven able to fail, 0 not. Each was proven by an earlier pass. None was written or rewritten this pass. No criterion in the set is `revised`. The smoke contradicts none of them. No break run was owed.

Ran without a break run this pass (real run only), all 20: PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R4, PRD-07.R6, PRD-07.R9, PRD-08.R5, PRD-09.R2, PRD-09.R4, PRD-09.R5, PRD-10.R2, PRD-10.R3, PRD-10.R4, PRD-10.R5, PRD-10.R6. Also, outside the scope, PRD-09.R1.

No script carries a flag saying it has no break step.

Clause coverage: for each of the 20, the register's clauses were compared with the labels the script printed. Every clause has at least one label. No gap, and nothing was written.

`run.mjs` already does real runs only by default. It was not changed.

## Fix-loop accounting

0 of 2 — the initial pass was clean. No FAIL and no REGRESSION, so no brief was written and nothing was run again.

## Figures on the preview's data

No screen changed in this phase. The phase file's `Screens changed` line says "none", and Timone draws no screen.

## Questions for the human

None.

## Register changes

None. 18 criteria passed and were already `verified`. Two are BLOCKED in part, and BLOCKED leaves the register untouched. No `live` line is written by a verification pass.

## Carried forward

- **PRD-05.R7, the runner's part of clause 1, and PRD-05.R18, clause 1 — BLOCKED.** Both need the replay against the real model on this build. The newest recorded replay is run 2 of [phase-60-replay.md](phase-60-replay.md), at `03b5c13`, which is not in this branch's history. This phase changes no file under `src/runner/`, so the runner's instructions are the same as on `main`. Running `npm run --silent replay` on this branch, from a terminal with a model login, and recording it would clear both. The departures record has the entry: [phase-63-departures.md](phase-63-departures.md).
- **15 live gates owed**, PRD-02.R4 first (see *Live gates*). Only fvermaut can run them, with the daemon, on scratch-app.
