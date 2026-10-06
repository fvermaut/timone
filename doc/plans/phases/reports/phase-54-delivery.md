# Phase 54 — Delivery Report

- **Date:** 2026-10-06
- **Phase:** [phase-54.md](../phase-54.md) — `Complete`, verified in [phase-54-verification.md](phase-54-verification.md)
- **Branch:** `timone/186-timone-status-asks-you-to-answer-on-abou` @ `0823b11`
- **Base:** `main` — the project's default branch; the branch was cut from `main` at `becd196` and nothing was stacked.
- **Pull request:** opened against this report, from the branch above, referencing [#186](https://github.com/fvermaut/timone/issues/186); its address is posted on the ticket.
- **Screen:** no user-facing screen in this phase (`Screens changed: none` — `timone status` prints to a terminal) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none (the verification report's section of that name says none, and the runner carried no unanswered question to this step).
- **Departures:** [`phase-54-departures.md`](phase-54-departures.md) — 4 entries.

## Scope

A bug fix against PRD-02.R9 (SHOULD, `verified`, unchanged), driven by [#186](https://github.com/fvermaut/timone/issues/186). The last line of `timone status` now names a ticket only when one of its runs is parked and the runner asked a person something. A finished run is never named. `waitsOnYou` in `src/commands/status.ts` keeps only its parked arm; both arms that named a done run are gone ("pieces left and none can start", and "the list of pieces grew since approval"). The per-ticket progress reader only those arms used is removed from `status.ts` (54a), and the code it leaves with no caller outside tests is removed from `src/daemon/poll.ts` and `src/daemon/breakdown.ts` (54b). `timone status` no longer reads a checkout or runs git. The project's own line ("#7 … nothing to take") is unchanged.

## How to try it

### Against the preview

This project has no preview configured for pull requests (`timone.yaml` has no `bindings.preview` for `timone`). `timone status` is a terminal command; use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md). Then, on this branch:

1. `npm run build`, then run the check's PRD-02.R9 script with `node`, as written in [phase-54-verification.md](phase-54-verification.md) § PRD-02.R9. It stages ledgers and runs the built `timone status`. Expect `--- PRD-02.R9: PASS (5 clause labels, 5 passing)`. In its output, a finished run on `fixture #51` whose initiative has steps left ends with `**What I need from you:** nothing — nothing is waiting on you right now.`, and a run parked with a question ends with `answer on fixture #12`.
2. `npx vitest run src/commands/status.test.ts src/guards/checkouts.test.ts src/daemon/breakdown.test.ts` — expect all to pass.
3. `node dist/cli.js status` against your own daemon's ledger — expect the closing line to name no finished ticket; before this change it named about 80.
4. `npx vitest run` — outside the container, expect no failure. Inside a run's container, 70 tests fail on `main` too (Timone issue #220).

## Verification outcome

From [phase-54-verification.md](phase-54-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R9 | SHOULD | api | PASS | 0 |
| PRD-05.R2 | MUST | api | PASS (3 clauses; clause 2b BLOCKED) | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | PASS (3 clauses; clause 1 (runner) BLOCKED) | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |

Whole suite in the container: 1984 tests, 1914 passed, 70 failed. All 70 are the tests that push to `main` in scratch repositories, which the container refuses (Timone issue #220); they fail on `main` the same way, and none is new.

### Outstanding for the human

- [ ] PRD-05.R18, and PRD-05.R7 clause 1 (real runner) — the replay against the real model on this build: `npm run --silent replay`, from a logged-in terminal. Can be run before merging.
- [ ] PRD-05.R2 clause 2b — needs GitHub, not reachable from the container.
- [ ] Live gates owed, by the register's `Depends-on` lines (this diff touches `src/daemon/` and `src/commands/`): PRD-01.R4; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R1, R2, R4, R5; PRD-07.R5, R7, R14; and, having no `Depends-on` line, PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-08.R6. The list and each one's last run are in [phase-54-verification.md](phase-54-verification.md) § Live gates.

## Standards review — phase 54

- **Read:** diff of `src/commands/status.ts`, `src/commands/status.test.ts`, `src/daemon/breakdown.ts`, `src/daemon/breakdown.test.ts`, `src/daemon/poll.ts`, `src/daemon/poll.test.ts` and `src/guards/checkouts.test.ts` in the range; the branch's current `src/commands/status.ts`, `src/commands/status.test.ts`, `src/daemon/breakdown.ts` and `src/daemon/poll.ts`, for context; `/workspace/timone/standards/code-smells.md` (Approved 2026-07-28); `/workspace/timone/standards/typescript.md` (Approved 2026-07-19, amended 2026-07-26); `/workspace/timone/standards/testing.md` (Approved 2026-07-24); `tsconfig.json`; the `package.json` scripts. The project's `doc/standards.md` does not exist in this project, so the review uses only the shared references. The project has no linter. Its only tool check is `tsc` in `strict` mode, and that check does not flag unused exports.
- **Diff:** `main...timone/186-timone-status-asks-you-to-answer-on-abou` — 7 files, +195/−488 (the src files only)
- **Findings:** 1

### 1. The test for "name a ticket once" no longer tests that — test does not observe the behaviour its name states (testing.md, "What a good test is")

- **Where:** `src/commands/status.test.ts:430–452`
- **What:** The test is renamed to `"names a ticket once in its closing line however many runs it has had"`. Its fixture is now two `status: "done"` runs and one `status: "parked"` run, all for ticket 6. After this diff, `waitsOnYou` returns false for every done run. So only one run of ticket 6 reaches the step that removes repeated names in `src/commands/status.ts`:
  ```ts
  .filter((run) => waitsOnYou(run))
  .map((run) => `${run.project} #${run.ticket}`)
  .filter((name, index, all) => all.indexOf(name) === index);
  ```
  Nothing is left for that last `.filter` to remove. The test's own comment and the new comment in `status.ts` both give the reason the filter is kept: "the ledger can still hold more than one parked run of one ticket, written by older code". Yet no test in the file has two parked runs of one ticket. I checked every `status: "parked"` fixture in `status.test.ts`. If someone deleted the last `.filter`, this test and the whole suite would still pass.
- **Why it matters:** `testing.md` says a test "reads as a specification: the name states behaviour under a condition". The condition named here is that one ticket has several runs waiting on the reader. That condition is no longer built, so the test passes without checking what its name says it checks. The two done runs are now leftover setup that has no effect on the result.
- **Suggested remediation:** Make the fixture match the name: give ticket 6 two parked runs that asked for something, the case the comment describes. The done runs can stay, to show they are never named, or they can be removed. Not applied here.

## Spec review — phase 54

- **Read:** `git diff main...timone/186-timone-status-asks-you-to-answer-on-abou` for the seven src files and for `doc/specs/prd/prd-02-inversion-of-control.criteria.md`; the current branch content of `src/commands/status.ts` and `src/daemon/poll.ts` (lines 1120–1185 and 1480–1630), for context; `doc/specs/prd/prd-02-inversion-of-control.md` (the R9 passage, line 26); `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (the R9 section); `doc/plans/phases/phase-54.md` lines 1–20.
- **Diff:** `main...timone/186-timone-status-asks-you-to-answer-on-abou` — 7 files, +195/−488 (the src files only)
- **Findings:** 1

The main fix matches the ticket. A `done` run is no longer named when its initiative has steps left and none can start. A parked run that asked something is still named, once. The new tests in `src/commands/status.test.ts` pin both cases, including one against a real ledger copy with old initiative records.

### 1. The fix also stopped naming a ticket whose list of pieces grew after approval, and the daemon still holds that ticket for a person — PRD-02.R9

- **Where:** `src/commands/status.ts:241–246` (the new `waitsOnYou`). The removed arm was `if (progress.reproposed === true) return true;`. The live hold it relates to is `src/daemon/poll.ts:1163–1167` and `src/daemon/poll.ts:1593–1598`.
- **What:** The diff removed two readings, not one. Besides the "steps left, none can start" arm the ticket asked about, it removed `progress.reproposed === true`. That arm named a ticket whose list of pieces has more entries than were approved. The new comment justifies this with "Both readings came from the old daemon." The daemon on this branch does not support that claim. `pollProject` still calls `successorHeldBack`. For a grown list it returns "the list of pieces has grown to N since M were approved". The loop then logs `hold   <project>#<ticket> — …` and skips the ticket on every cycle. It does not park a run with a wait. So this hold is not covered by the "a person is asked only by a parked run" rule the diff relies on. After this change, `timone status` says nothing about it. The closing line can read "nothing is waiting on you right now" while a ticket waits for a person to approve its list again. The one status test that covered this case was rewritten to use a parked run. No test now checks what status shows for a grown list.
- **Why it matters:** PRD-02.R9 asks that `timone status` show "any gate waiting for human input, in one glance". Ticket #186 asked to drop tickets that do *not* wait on a person. This hold is one that does. Removing it goes beyond the ticket and leaves a real person-gate out of the status output.
- **Suggested remediation:** A follow-up would do one of two things. Option one: keep the re-proposal reading in `waitsOnYou`. This would bring back a breakdown read in `status.ts`, or the daemon would record the hold in the ledger so status can read it without a checkout. Option two: change the daemon so a grown list parks the run with a wait that asks the person, and the existing parked-run rule then covers it. Either way, add a status test for a ticket held by a grown list. Also correct the "both readings came from the old daemon" comment. Not applied here.

## Notes

- The check's own PRD-02.R9 script is in the range but was left out of both reviews' subject: it is the check's artifact, and a guard keeps reviewing contexts away from the folder that holds it.
- Neither review read the other's report or the verification report.
- Remediation, if wanted, is a new ticket naming the finding and this report.
