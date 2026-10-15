# Phase 62 — Verification Report

- **Date:** 2026-10-15
- **Phase:** [phase-62.md](../phase-62.md) — stamped `Complete`, completion report [phase-62-complete.md](phase-62-complete.md)
- **Scope:** PRD-05.R9 (MUST, `live`) and PRD-05.R10 (MUST, `api`), from the phase file's requirements header, the same two the completion report names.
- **Live gate owed:** yes — PRD-05.R9. It declares no `Depends-on`, and this phase changes what happens when a named person comments on a map ticket, which is its clause 1.
- **Regression set (derived):** 23 criteria — PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. PRD-05.R10 is in both sets.
- **Branch:** `timone/254-a-comment-on-a-map-ticket-gets-no-answer` @ `8725bb2`. It stacks on no other phase: its parent is `ed8312b`, the head of `main`, which holds phase 61's verification.

## Environment

Timone is a command-line program and a daemon; its production form is the compiled program. `npm run build` (`tsc`) at `8725bb2`, exit 0. Every probe runs the built `dist/cli.js` through the verifier's rig (`doc/plans/phases/probes/_rig.mjs`): a fake GitHub (`_fake-gh.cjs`), a fake model service on 127.0.0.1, and the daemon started with `--runtime in-process` and `--interval 2`. Nothing reached GitHub or a real model. Order did not matter: there is no prerendering or cache.

- **Changed-file tests**, at the runner's request, before the whole suite and not as evidence: `npx vitest run src/runner/comments.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts` — 3 files, 173 of 173 passed. `npx tsc --noEmit` exit 0. The verbose titles show 15 tests about map tickets in those files: 3 for the reply's words (`comments.test.ts`), 3 in the poll (`poll.test.ts`), 9 in the driver's "a comment on a map ticket" block (`driver.test.ts`).
- **Build-health smoke**, run once at the end, not as evidence: `npx vitest run --reporter=verbose` at `8725bb2`: 78 test files, 2800 tests, **2729 passed, 71 failed**, 8.7 s.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-61-verification.md` on `main` (`ed8312b`), lines 14–86: its smoke had 71 failures and named each one. The 71 failing here are the same 71 tests, by name; every one is **old**, and no failure appears only on this branch. The `comm` of the two sorted lists is empty both ways. The completion report counted 101 failures in its container, on `main` and on the branch alike; 30 of those (in `src/cli.test.ts`, `src/daemon/push-guard*.test.ts`, `src/merge-rules.git.test.ts`, `src/update-checks.git.test.ts`, `src/commands/guardrails.guard-command.test.ts`, `src/daemon/container-runtime.test.ts`, `src/daemon/session.test.ts`) pass in this container. The main branch was not checked out or run here; the comparison is with the list on `main`, as the rules for this check require. This pass's list, for the next pass (all old):
  - `src/commands/guardrails.test.ts` — 45 tests: every test the phase 61 list names in that file (blocks "a session a human drove" 5, "a session the daemon drove" 3, "a session with no baseline" 1, "commits another session made" 5, "finding the run that drove a session" 2, "guarding the probes in a session run by hand (#169)" 4, "guarding the verifier's probes" 4, "switching off the guard on a run's pushes" 10, "the STATUS.md rule, read back off real commits" 2, "the journal" 1, "the provenance trailer, read back off real commits" 3, "the run a session belongs to" 5) — old
  - `src/commands/number.test.ts > timone number >` 3 tests: "names the projects it knows, and exits 1, for a project it does not know"; "prints only the reserved number, padded, and exits 0"; "prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails" — old
  - `src/daemon/register.test.ts > this repository's own registers > claim nothing they have not established` — old. It names PRD-07.R3 only, as on `main`.
  - `src/numbers.test.ts > reserveNumber >` 16 tests, the same 16 the phase 61 list names — old
  - `src/workspace.test.ts > syncWorkspace >` 6 tests: "clones a missing project on first sync"; "fails a plain non-git directory but still processes the others"; "fast-forwards and reports updated when the upstream gains a commit"; "reports up-to-date when the upstream has not moved"; "skips a checkout on a non-default branch"; "skips a dirty checkout without touching it" — old

  The 70 tests outside the register test are git-fixture tests, and the smoke output prints this container's refusal for their pushes: "this run may push only to `timone/254-…`, and this push goes to `refs/heads/main`". The 71st is the register test above.
- **Smoke against check scripts:** no alarm. The 70 push tests fail on this container's push guard before they reach what they test. The register test reads the wording of PRD-07.R3, and the probe of PRD-07.R3 checks what the daemon does. No failing test is in a file this phase changed.

## Independence declaration

Read, from the allowed list:

- the register `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`: lines 1–10, the R9 and R10 blocks (lines 166–202), the R11 block (lines 203–231, to check a clause count), and its `Priority`/`Status`/`Verify-via` lines; every register's `Depends-on` lines, by `grep`; the clause count of PRD-10.R2–R6, counted by a script.
- the PRD narrative `prd-05-a-runner-decides-each-step.md`, by `grep` for "map" and "comment" (one line, 49).
- the phase file's status line, `Screens changed` line and requirements header. A `grep` over its first 30 lines also printed lines 22, 26 and 30, three paragraphs of its goal description (what was wrong, the decisions taken, no change to the runner's rules). Declared here; nothing below rests on them, and every verdict comes from the probes.
- the completion report, whole.
- `CONTEXT.md` (the *Map ticket* line), `STATUS.md` (its *Waiting on you* section and the head of *What changed recently*), `package.json`'s scripts.
- the probe folder: `run.mjs`, `_lib.mjs`, `_rig.mjs`, `prd-05.r10.mjs`, `prd-07.r4.mjs` lines 1–125, and lines of `_fake-gh.cjs` and other probes found by `grep` for map tickets and comments.
- on `main`, by `git show`: `phase-61-verification.md`, cut to its headings and to lines 14–86 (its smoke line and list). The `grep` for its headings also printed lines 87, 91 and 97, part of its smoke note and of its independence declaration.
- name lists only: `git diff --name-only origin/main...HEAD`.
- test titles printed by `vitest --reporter=verbose` for the three changed test files, and the smoke's failure messages, which print three source lines of `src/daemon/register.test.ts` around line 130.

Not read: handoffs, the departures record, diffs, source, the committed test suite, ADRs, the phase file's sub-phase bodies. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or extended this pass.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R9 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| Regression set, 22 more criteria | MUST | api | PASS (7 parts of 3 of them could not run here) | 0 |

## Evidence

### PRD-05.R10 — PASS

Run on its own, so the two new checks did their break run: `PROBE_REAL_ONLY=1 PROBE_BREAK_FOR='PRD-05.R10 clause 1 (map ticket)|PRD-05.R10 clause 3 (map ticket)' node doc/plans/phases/probes/prd-05.r10.mjs`.

The map-ticket fixture: map #50 (`timone`, `timone:map`), step #51 closed, steps #52 and #53 open, all three children of #50; #50 carries an older machine comment. The probe's comments are written after the daemon's first cycle has picked up the steps, and the daemon is then watched for 14 s (several 2-second cycles).

```
=== PRD-05.R10 clause 1 (ticket) — a comment on the ticket by someone not named does not wake the runner, and its text is not given to it
    green leg: PASS — assertion held
=== PRD-05.R10 clause 1 (pull request) — a comment on the run's pull request by someone not named does not wake the runner, and its text is not given to it
    green leg: PASS — assertion held
    (what the runner was told instead: "1 comment by a person who may not instruct you was left out.")
=== PRD-05.R10 clause 2 — no one named for the project: the operator is the one named person
    green leg: PASS — assertion held
=== PRD-05.R10 clause 3 — a comment written by Timone itself is not treated as an instruction
    green leg: PASS — assertion held
=== PRD-05.R10 clause 1 (map ticket) — a comment on a map ticket by someone not named does not wake the runner, its text is not given to it, and the machine does not answer it
    break leg: RED (as required) — the machine answered on the map ticket: "**This ticket is not read any more.** Its work was split into smaller tickets, a"
    green leg: PASS — assertion held
=== PRD-05.R10 clause 3 (map ticket) — a comment written by Timone itself on a map ticket — under its own account, under a person's account, and its own reply there — is not treated as an instruction, also after a restart
    break leg: RED (as required) — the machine answered on the map ticket: "**This ticket is not read any more.** …" / the machine's own reply was answered: 2 machine comments on the map after the restart
    green leg: PASS — assertion held
    (the control: a named person wrote twice at once on map #50; machine comments on the map before the restart: 1, after it: 1; runner woken for the map: 0; the reply reads: "**This ticket is not read any more.** Its work was split into smaller tickets, and each of them is read on its own: - #52 — Step 2 - #53 — Step 3 Nothing will be done with a comment written here. If it is about one of those pieces, write it again on that ticket. If it is a new request, open a new ticket. **What I need from you:** nothing on this ticket. To get an answer, write on one of the tickets above, or open a new ticket.")
--- PRD-05.R10: PASS (6 clause labels, 6 passing, real run only)
```

- **Clause 1** — PASS. On a ticket, on a pull request, and now on a map ticket, a comment by someone not named wakes no runner and its text reaches no runner session. On the map ticket the machine also posts nothing. The break leg names the same person for the project, and the machine then answers: the instrument sees an answer when there is one.
- **Clause 2** — PASS.
- **Clause 3** — PASS. On a map ticket, a comment under the machine's account, and one under the operator's account that starts with the machine's header line, get no answer and wake nothing. The machine's own reply is not answered either, in the cycles after it and after the daemon is stopped and started again on the same state. Break legs: the same text by the operator without the header line gets an answer; a named person's further comment after the restart is seen as a second machine comment.
- **Instrument fault, fixed before the result above.** The first run of the new clause 3 check counted a machine-account comment the probe itself had planted as an answer, and went red on its real run (`/tmp` run 1: "the machine answered on the map ticket: \"PROBE-R10-TEXT: …\""). The counter now leaves out the probe's own comments. This was the probe's fault, not the build's: no fix loop was used.

The control line above is not evidence for PRD-05.R9, which is `live`. It is the instrument's own check that an answer can be seen. For the reader it also shows, on the built program with a fake GitHub: two comments at once by a named person got one reply; the reply lists the open steps #52 and #53 and not the closed #51; the reply was not posted again after a restart; no runner session was woken for the map.

PRD-05.R10 entered the pass `verified` and passes; it stays `verified`. Its `Falsified-by` line names a test of the code that wakes the runner; the probe's break legs also went red.

### PRD-05.R9 — LIVE-GATE

See *Live gates* below. No probe and no script were written for it.

### The regression set — PASS

`node doc/plans/phases/probes/run.mjs --regression --jobs=6 --only=<the 22 IDs below>` (PRD-05.R10 ran on its own, above):

```
| PRD-05.R2  | PASS      | R2 — The runner acts only through the actions code gives it
| PRD-05.R3  | PASS      | R3 — Nothing reaches a default branch without a yes from a named person
| PRD-05.R4  | PASS      | R4 — A run that changed the project's files ends at a pull request
| PRD-05.R5  | PASS      | R5 — Code lists every departure on the pull request, and a skipped check comes first
| PRD-05.R7  | PASS      | R7 — The runner never records an approval nobody gave
| PRD-05.R11 | PASS      | R11 — `takeover` and `cancel` stay, and `retry` goes
| PRD-05.R18 | PASS      | R18 — The runner passes a replay of the recorded failures
| PRD-07.R1  | PASS      | R1 — A ticket frees its project when its pull request opens
| PRD-07.R2  | PASS      | R2 — Each project has a number of places, 2 unless `timone.yaml` says otherwise
| PRD-07.R3  | PASS      | R3 — A freed place goes to one ticket: `priority:high` first, then the oldest
| PRD-07.R4  | PASS      | R4 — Nothing is built on top of an open pull request
| PRD-07.R6  | PASS      | R6 — A held ticket says what it waits for, and a named person can overrule
| PRD-07.R9  | PASS      | R9 — A ticket with an open pull request keeps its run and is not picked up again
| PRD-07.R10 | PASS      | R10 — The breakdown shows which pieces are built at the same time
| PRD-08.R5  | PASS      | R5 — When the file names nobody, the ticket still opens
| PRD-09.R2  | PASS      | R2 — The command can be copied and run as it stands
| PRD-09.R4  | PASS      | R4 — A takeover typed while a step is running waits for it, then opens
| PRD-09.R5  | PASS      | R5 — The written rules say the same as the machine does
| PRD-10.R2  | PASS      | R2 — In a container with no run in the ledger, the guard judges by the container's step
| PRD-10.R3  | PASS      | R3 — In a container the guard never asks
| PRD-10.R4  | PASS      | R4 — Text that only names a check-script folder is not judged
| PRD-10.R5  | PASS      | R5 — A real read, list, run or write of a check script is still judged
| PRD-10.R6  | PASS      | R6 — A test runs the guard command as a container session runs it

23 passing, 0 failing, 0 blocked, 0 with no probe.
```

Seven parts could not run here, inside criteria that pass on every part that could: PRD-05.R2 clause 2b ("GitHub could not be read from here"), PRD-05.R7 clause 1 (runner) (needs a real model), and PRD-05.R18 clauses 1a, 1b, 1c, 2a and 2b (the newest recorded replay is older than this build; a real model is needed for a new one). R18's clause 2 asks for a replay when the runner's rules change: `src/runner/brief.ts` is not in this phase's list of changed files, so this phase does not owe one.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries no HUMAN-CHECK forward.

## Live gates

- **PRD-05.R9** — `Last live gate:` [phase-40-live-gate.md](phase-40-live-gate.md), third attempt, 2026-09-30. **This phase owes a fresh one**: it declares no `Depends-on`, and this phase changes what a named person's comment on a map ticket gets, which is clause 1 ("a run of any kind, in any state"). The sighting the completion report suggests: a named person writes on a scratch-app map ticket whose steps are open, and sees one reply within one cycle. Point for that gate to read: clause 1 says "the runner wakes and either acts or answers on the ticket". On a map ticket the answer comes from code with fixed words, and no runner session wakes (seen in the control above). Whether that meets "the runner wakes" is for the person who runs the gate to judge; the register's words do not say.

## Regression

All 23 criteria of the derived set PASS on every part that could run (see *The regression set* and *PRD-05.R10* above). No criterion that entered the pass `verified` failed.

What the narrowing removed (8), each with the `Depends-on` prefixes this phase's diff touches none of:

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R12 — `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

The diff's files: `CONTEXT.md`, the phase file and its reports, `src/daemon/poll.ts`, `src/runner/comments.ts`, `src/runner/driver.ts` and their three test files. PRD-07.R1, R2, R3, R4, R6, R9 and R10 stayed in through `src/runner/` or `src/daemon/`; the other 16 carry no `Depends-on` line.

## Probes

**24 probes ran; all 24 have been proven able to fail, 0 not.** This pass proved two checks with a break run: PRD-05.R10's new labels "clause 1 (map ticket)" and "clause 3 (map ticket)", written this pass, each red on its break leg and then green. Every other probe was proved by an earlier check.

- `prd-05.r10.mjs` — extended this pass with the two labels above. Why: this phase adds a new place where the daemon reads comments (map tickets), and R10's clauses 1 and 3 apply to every comment the daemon reads. Its four older labels ran their real run only.
- Ran without a break run this pass (real run only): PRD-05.R10 (its 4 older labels), PRD-05.R2, R3, R4, R5, R7, R11, R18; PRD-07.R1, R2, R3, R4, R6, R9, R10; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6.
- No probe has no break step: no label printed "break leg: none".
- Clause coverage: for each criterion in scope, the register's clauses were compared with the labels the probe printed. Every clause has a label. (A first count flagged PRD-05.R11 with 4 clauses; the fourth "GIVEN" is inside a note under clause 2, and R11 has 3 clauses, all labelled.)

## Fix-loop accounting

0 of 2 — the initial pass was clean. The one red result of the pass was the probe's own counter (see *PRD-05.R10*), fixed in the probe, with no defect brief and no fix commit.

## Figures on the preview's data

No screen changed in this phase: the phase file's `Screens changed` line says none.

## Questions for the human

None.

## Register changes

None. PRD-05.R10 was `verified` and passed, so it stays `verified`. PRD-05.R9 is on the `live` channel; this stage does not change its status. No regression criterion failed.

## Runner's checklist

The runner asked for five confirmations. In the terms above:

1. A named person's comment on a map ticket gets exactly one reply, saying the ticket is not read any more and linking each open step ticket — seen on the built program with a fake GitHub, as the R10 probe's control. The verdict for it is PRD-05.R9's live gate, which is owed.
2. Several comments at once get one reply, and no second reply after a daemon restart — seen in the same control, and in R10's clause 3 (map ticket), where the restart is part of the check.
3. The machine's own comments, and comments by people not named, get no reply — PRD-05.R10 clauses 1 and 3 (map ticket), PASS.
4. `CONTEXT.md` has the glossary line — yes: the *Map ticket* entry ends "✏ 2026-10-15 (timone#254): a named person who writes on it gets one reply from the machine. The reply says the ticket is not read any more, and links its open step tickets as the place to write. Nothing else is done with the comment."
5. The tests for this change were written and pass — the three changed test files hold 15 tests about map tickets, and the three files pass 173 of 173. The whole suite fails 71 tests, every one on the list on `main`; none fails only on this branch.
