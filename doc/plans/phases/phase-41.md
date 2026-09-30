# Phase 41: The old code between steps is removed — every project on the runner, `timone retry` gone, the documents describe the runner

> **Status:** Planned.

> **Companion phases:** [phase 40](phase-40.md) built the runner beside the current daemon and left what this phase removes: the `driver` line and `driverOf` (`src/manifest.ts`), the split of the cycle and `turnRunnerProjects` (`src/daemon/poll.ts`), `timone retry`'s refusal on runner projects (`src/commands/retry.ts`), and the old spawner, which already delegates to `startStepSession` (`src/daemon/step-session.ts`) and the moved chunk-zero functions (`src/daemon/chunk-zero.ts`). [Phase 39](phase-39.md) left `src/daemon/consult.ts`, which the runner keeps using after the ask check is gone. Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), whose D9 orders this deletion and whose header lists the records whose status lines this phase changes; [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) D1, because the live check this phase owes rides to the pull request if it cannot be run before it; [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4, which narrows the regression set below; [ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md), because two kept checks test what this phase removes on purpose, and the build must not open them; [ADR-0049](../../adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) D1 to D3, because the holder stays when the wait kinds go; [ADR-0047](../../adr/0047-a-cancel-stops-the-work-it-cancels.md), because `timone cancel` must still stop a step and its runner.

> **Screens changed:** none — no slice changes anything a person sees on a screen.

## Requirements

> **PRD:** [prd-05](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05 criteria](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-05.R11 | MUST | `takeover` and `cancel` stay, and `retry` goes — **clause 3 here: `timone retry` does not exist, and says to write on the ticket** |
| PRD-05.R20 | SHOULD | The old code between steps is removed once every project runs on the runner, the superseded records are marked, and `process.md` and the skills describe the runner |

This is piece 2 of the [approved breakdown](../breakdowns/ticket-164.md) for [#164](https://github.com/fvermaut/timone/issues/164), ticket [#166](https://github.com/fvermaut/timone/issues/166). Phase 40 delivered the rest of R11.

## Goal Description

Phase 40 put the runner beside the current daemon. scratch-app moved to it first, and ivtrends moved on 2026-09-30. ivtrends' first ticket on the runner, [#59](https://github.com/fvermaut/ivtrends/issues/59), reached its pull request [#142](https://github.com/fvermaut/ivtrends/pull/142) with no stop. That is the condition the breakdown set for this piece. What is left is the code that only the current daemon runs: the table that picks the next step, the reading of a step's end from an exact line, the choice of where a run waits, the standing call to action and its ask check, and `timone retry`. The three largest files involved (`poll.ts`, `session.ts` and `runs.ts`) and their tests hold about 26,000 lines, and well over half of them go.

The cut deletes from the top down. The cycle's shared behaviour is first moved onto runner projects in the tests (41a), so that deleting the old path cannot delete the only test of something the runner also does. Then the cycle loses its old path (41b), old runs in the ledger are converted (41c), and each layer below is removed once nothing above it calls it (41d to 41h). The documents come last (41i to 41k). The build and every test pass after each slice.

**Decisions taken while planning.** None reached the bar for a decision record. Each sits inside a choice ADR-0060 already made, and each is reversible in code:

1. **Timone's own entry moves to the runner with the others.** It has no `driver` line, so today it runs on the current daemon. R20's condition is "no project runs on the current daemon", so it cannot stay there. None of Timone's issues carries the `timone` label, so nothing starts on it either before or after. The `driver` line is removed from the manifest; a manifest that still has one fails to load and says to delete the line.
2. **Runs the old code left in the ledger are converted when the ledger is read.** The real ledger on 2026-09-30 holds four failed runs and six runs waiting in the old ways. A **failed** run becomes **cancelled**, and keeps what stopped it. A cancelled run does not hold its project, and a ticket that is still open and marked is picked up again as new work, as the runner's rules already say. Of the four, three tickets are closed (scratch-app #10, timone #106, #122) and one is not marked (scratch-app #48), so none is picked up. A run **waiting in an old way** (on an approval, a conversation, a review, an escalation, or with no kind) becomes a run waiting for the runner, and keeps what it waits on. Whether a waiting run holds its project depends on its branch, not on its wait, so nothing changes there. **The conversion asks for no wake**, so no comment appears on those tickets. A named person's comment, a pull request's merge or close, or the end of a takeover wakes the runner, as for any run. This touches Timone's conversation tickets #91, #92 and #95 to #98: `timone takeover timone#95` still works, and opens a session told which step the ticket was at and what it was waiting on (41g).
3. **The ask check is removed.** PRD-05 left open whether it stays, and said the build decides and says so on its pull request. It only ever ran in front of the standing call to action, which is deleted here. The runner writes every question with the whole run in view, which is the gap the ask check was made for. [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md) is marked superseded by ADR-0060 (41i). The one-turn check that reads "go on" at the spending limit is not the ask check: it uses `src/daemon/consult.ts`, which stays.
4. **Steps are no longer told to end with a line only the old code read.** The hidden end-of-step lines, the escalation line and the hand-back line are read by nothing once the old code is gone. A step still ends with one plain comment, and that comment still ends with the *What I need from you* line, because `timone status` and the runner read that line. The runner's own instructions (`SYSTEM` in `src/runner/brief.ts`) are not changed by any slice.
5. **`timone retry` answers, and is not listed.** Typing it exits with code 1 and says to write on the ticket instead. It is not in `timone --help`. That is R11 clause 3 as written: "it does not exist, and the message says to write on the ticket instead".
6. **The cancel watch stays.** `watchForCancellations` was built because a daemon project's turn waited for a whole session. That wait is gone, but a cycle can still be long: starting a preview can build an image for minutes. It is not code between steps, so it stays. `turnRunnerProjects` goes, because it exists only to give runner projects a turn while a daemon project held the cycle.

**What is protected, and what is not.** The regression set is every criterion that is MUST, checked through the API, `verified`, and whose declared dependencies this phase touches. That is PRD-01.R2 (it depends on `src/manifest.ts`, which 41b changes) and PRD-05.R2, R3, R4, R5, R7, R10 and R18, which declare no dependencies and so cannot be narrowed out. Verification runs them. **R18 will read as blocked** until the replay is run again on this build: its check refuses any recorded replay older than the code. That is part of 41l. Four `live` criteria depend on `src/daemon/`: PRD-02.R1 (a marked ticket is picked up and acknowledged), R2 (steps run from the Timone root on the named project), R4 (requirements are approved on the ticket) and R8 (a pull request carries a preview). **This phase therefore owes a live check before delivery**, which is 41l. What no criterion watches: the conversion of the real ledger, and what a takeover session is told about an old conversation ticket. 41c's and 41g's tests are hard gates for them, and 41l looks at the real ledger after the conversion.

**Two kept checks test what this phase removes on purpose.** The check for PRD-05.R19 reads the `driver` line, and the check for PRD-05.R11 runs `timone retry` and expects a refusal on runner projects. Both will fail after this phase, correctly. Verification re-authors them. No slice opens them ([ADR-0048](../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md)).

**A missing artifact, carried from phase 40.** Timone has no `doc/standards.md`. This phase follows the central [standards/typescript.md](../../../standards/typescript.md) and [standards/testing.md](../../../standards/testing.md), both `Approved`.

## Context & Prerequisites

- **`src/daemon/poll.ts`** (3,516 lines) — `pollProjects` splits the projects by `driverOf` and starts `turnRunnerProjects`. `pollProject` shares its registration between the two paths, then sends a runner project to `runner.tick` and the others through `openGoAheads`, `resumeAnswered`, the pickup spawn and `reconcileCtas`. `reclaimStale` and `applyRequest` also branch on the driver. The functions only the old path reaches are listed in 41b.
- **`src/daemon/session.ts`** (2,560 lines) — `AgentSessionSpawner` and everything around it is the old path. What the runner uses from this file is listed in 41f, and stays.
- **`src/daemon/runs.ts`** (2,304 lines) — the ledger both paths share. `failed`, the wait kinds other than `runner`, and several fields and methods are written only by the old path (listed in 41h). `normaliseWait` and `normaliseSequence` are the existing pattern for reading an older ledger without rewriting it.
- **`src/daemon/pipeline.ts`** — the step table. The runner reads its labels, models, efforts and `ownsBranch`, and `PIPELINE_STAGES`. `next`, `stageAfter`, the wait columns and the routing helpers are the old path's.
- **`src/daemon/prompts.ts`** — the runner's `start_step` action builds each step's prompt with `stagePrompt` (`src/runner/actions.ts`). A takeover of a run waiting for the runner uses `escalationPrompt`, whose hand-back section and "what ordinarily follows" hint are old-path text.
- **`src/commands/`** — `retry.ts` is the old path's command. `takeover.ts`, `status.ts` and `cancel.ts` each branch on the driver. `src/daemon/cta.ts` writes the standing call to action, and `status.ts` still reads it for a runner run's "waiting on you" line.
- **Tests** — `src/daemon/poll.test.ts` (9,548 lines) tests the cycle at `pollOnce`; about 1,100 lines at its end run on runner projects, and most of the rest runs on daemon projects, including tests of behaviour both paths share. `src/daemon/session.test.ts` is almost all spawner. `src/commands/daemon.test.ts` drives `pollOnce` with spawner stand-ins.
- **The real ledger** (`.timone/state.json`, not tracked) — on 2026-09-30: failed runs scratch-app #10 and #48, timone #106 and #122; runs waiting in the old ways timone #91 (conversation), #92 (map, no kind), #95 to #98 (conversation); and scratch-app #67 waiting for the runner.
- **The replay** — `npm run --silent replay` calls the real model (about $2.50). `npm run --silent replay -- --dry` runs the scripted runner with no model, and checks that the cases still build.
- **`timone.yaml`** — scratch-app and ivtrends carry `driver: runner`; timone has none.

## Sub-phases

**Two rules for every code slice.** First: a slice that removes the last caller of a function deletes that function and its tests, unless the function lives in a file a later slice owns; then the handoff names it for that slice. Second: before deleting anything, check with a search of `src/` that nothing outside the slice's files still imports it. Where something does, keep it, and say so in the handoff.

### Sub-phase 41a: The cycle's shared behaviour is tested on runner projects

**[MODIFY]** `src/daemon/poll.test.ts` — every test of behaviour both paths share is moved to a project with `driver: runner`, using the runner stand-in the runner-only blocks at the end of the file already use. Shared behaviour: pickup and its acknowledgement, queueing and promotion, previews, introductions of unmarked tickets, the requests (cancel, takeover claim and release), the step frontier and step tickets, the hold label, closing an initiative, the reclaim of a stale run, and the witness. A test whose assertion holds only on the current daemon's path — it expects a spawn, a resume, a standing call to action, an ask check, a retry, a failed run or an old wait kind — stays where it is, and the handoff lists it by name as old-only. 41b deletes it.
**[MODIFY]** `src/commands/daemon.test.ts` — the same, for the tests that drive `pollOnce` with a spawner stand-in.

**Seams under test (TDD):** `pollOnce`, as today. This slice moves tests and adds no behaviour, so no production file changes. In place of red-green: for at least three moved tests — the pickup acknowledgement, the release of a preview after a merge, and a cancel — break the one line of production code the test watches, show the test failing on the runner project, and restore the line. If a shared behaviour fails on a runner project with the code unbroken, that is a fault in the runner's path: stop, record it in the handoff, and add a marked slice that fixes it before 41b.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
git diff --name-only main -- src | grep -v '\.test\.ts$' ; echo "exit: $? (expected 1: no production file changed)"
```

- [ ] All tests pass. The handoff gives the number of tests moved, and lists every old-only test left behind, by name.
- [ ] The three break-and-restore checks are in the handoff, with the failing output of each.

---

### Sub-phase 41b: Every project is driven by the runner, and the cycle has one path

**[MODIFY]** `src/manifest.ts` — remove `driver`, its schema, the `Driver` type and `driverOf`. A manifest with a `driver:` line fails to load with this message: *"<project>: the `driver` line was removed on 2026-09-30. Every project is now driven by the runner. Delete the line."*
**[MODIFY]** `timone.yaml` — delete both `driver: runner` lines and their comments. The timone entry is unchanged.
**[MODIFY]** `src/daemon/poll.ts`:
- `pollProjects`: one loop over the projects in manifest order. `turnRunnerProjects` and `RunnerTurns` are deleted.
- `pollProject`: the shared registration stays, and `heldSinceListing` now applies to every project. Then `promoteQueue`, `runner.tick` and `introduceUnmarked`. Deleted: `openGoAheads`, `resumeAnswered`, the pickup spawn (`entryContext`, `boundRefusal`, `REFUSAL_LIMIT`), the cancel of an occupier whose ticket is no longer listed, `reconcileCtas`, and the ask check's helpers (`cheaperAsk`, `instead`, `asksAPerson`, `lastHumanWords`, `saysTheSame`, `standingCta`).
- `reclaimStale`: every stale run goes to `runner.reclaimed`. Deleted: `concludeReview`, the re-arm through `store.reclaim`, and the path through `store.fail` and `failedComment`. The skip of runs carrying a `refusal` goes: only the old path set it.
- `applyRequest`: `cancel` no longer calls a spawner; `release-takeover` always takes the runner's branch; `claim-takeover` no longer calls `markAnswerConsumed` or `reopenIfFailed` (their deletion from `takeover.ts` is 41e's). A `retry` request still goes to `runRetry`, which now refuses on every project (below); 41d removes it.
- Deleted with their last caller: `mergedComment`, `stepMergedComment`, `pieceMergedComment`, `reproposedComment`, `closedUnmergedComment`, `reviewReadComment`, `reclaimedReason`, `noLongerListedReason`, `concludeInitiative`, `concludeStep`, `concludeLastConversation`, `Resumption`, `resolveWait`, `writtenAnswer`, `whatFollows`, `handbackStage`, `canStart`, `misreadStep`, and the async `initiativeProgress`. Where another file still imports one (for example `cta.ts` and `misreadStep`), it stays for the slice that owns that file.
- `PollDeps` loses `spawner` and `consultAskCheck`, and `runner` becomes required. `SpawnContext` and `SessionSpawner` are deleted. `PollResult` loses the fields nothing fills any more.

> ✏ 2026-09-30 (build, timone#166): 41a found two pieces of shared code this slice keeps whose only tests are on the old path: the successor hold at pickup (`successorHeldBack`, tested only in *a ticket's next chunk*) and the cancel watch (`watchForCancellations`, tested only with a spawner that holds the cycle). **Before deleting the old-only tests, give each a test on a runner project** — cases (9) and (10) below. On a runner project the cycle can be held by a slow forge call or a slow preview start instead of a session. Both behaviours exist already, so neither case can be driven red honestly: prove each test is not vacuous by breaking the code it watches, recording the failure, and restoring it. Recorded in [phase-41-departures.md](reports/phase-41-departures.md).

**[MODIFY]** `src/commands/daemon.ts` — no `AgentSessionSpawner`, and no ask-check model call. The runner's wiring is unchanged.
**[MODIFY]** `src/commands/status.ts`, `src/commands/takeover.ts`, `src/commands/cancel.ts`, `src/commands/retry.ts` — each check of the driver keeps only its runner branch. `retry` refuses on every project with its existing runner sentence. `cancel`'s message for a daemon project is deleted.
**[MODIFY]** `src/daemon/poll.test.ts`, `src/commands/daemon.test.ts`, `src/manifest.test.ts`, and the tests of the four commands — the old-only tests 41a listed are deleted, and the tests of the collapsed branches no longer set a driver.

**Seams under test (TDD):** `pollOnce` for the cycle and `loadManifest` for the manifest; the commands at their existing test seams. Red-green: (1) a project entry with no `driver` line: a new marked ticket asks the runner for a wake; (2) a manifest with a `driver:` line fails to load, and the message names the project and says to delete the line; (3) **R15 still holds without the split**: `pollOnce` over two projects resolves while a step on the first never completes, and a named person's comment on the second asks for a wake in the same cycle; (4) a stale run on any project goes to the runner's reclaim, and is neither failed nor re-armed; (5) a `cancel` request stops the runner's step and session; (6) `timone retry` refuses on a project with no `driver` line; (7) `timone takeover` on such a project takes the runner's branch, and its release asks for a wake; (8) `timone status` shows the spending line for such a project; ✏ 2026-09-30 (build, timone#166): (9) on a runner project, a step ticket whose earlier chunk is not settled is held back at pickup, as `successorHeldBack` decides; (10) on a runner project, while the cycle is held by a slow call, a `cancel` request left during it is carried out before the cycle ends.

> Sub-phase 41a must be complete before starting this sub-phase (41a moves the shared tests off the path this slice deletes).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
grep -rn "driverOf\|turnRunnerProjects\|AgentSessionSpawner" src --include='*.ts' --exclude='*.test.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' | grep -v '^src/daemon/session\.ts' ; echo "exit: $? (expected 1: only session.ts, which 41f owns, may still name the spawner)"
node dist/cli.js projects list
```

- [ ] Red-green evidence for each of the eight cases is in the handoff, and for cases (9) and (10) the break-and-restore evidence.
- [ ] `node dist/cli.js projects list` loads the edited `timone.yaml` and lists three projects.
- [ ] The handoff lists every function this slice left for a later slice's file, with the file.

---

### Sub-phase 41c: Runs the old code left in the ledger become runs the runner can read

**[MODIFY]** `src/daemon/runs.ts` — when the ledger is read, in the pattern of `normaliseWait` (`version` stays 1, and nothing is written because of a read):
- A `failed` run becomes `cancelled`. What stopped it is kept where `cancel` keeps its reason, prefixed *"stopped before the old code was removed: "*.
- A `parked` run whose wait kind is `gate`, `conversation`, `review`, `escalation`, or none, gets the kind `runner`. What it waits on, and when the wait opened, are kept.
- Nothing else changes. In particular, a parked run holds its project only while it owns a branch, exactly as before.

No wake is asked for because of a conversion.

**[NEW FILE]** `src/daemon/fixtures/ledger-before-166.json` — a ledger typed for this test, shaped like the real one on 2026-09-30: a failed run with a branch and one without, a parked run of each old kind (one of them on a branch), a run waiting for the runner, and done and cancelled runs.
**[MODIFY]** `src/daemon/runs.test.ts`, `src/daemon/poll.test.ts`, `src/commands/status.test.ts`

**Seams under test (TDD):** the store's load from a file, as `runs.test.ts` already reads older ledgers; `pollOnce` for the absence of a wake; the status report. Red-green: (1) each failed run loads as cancelled, with what stopped it kept; (2) each old wait kind loads as `runner`, with what it waits on and when it opened kept; (3) loading twice gives the same runs, and the file is unchanged after a load; (4) a converted run on a branch still holds its project, and one without a branch does not; (5) one `pollOnce` over the converted ledger, with no new comment, asks for no wake and posts nothing; (6) a named person's comment on a converted run's ticket asks for a wake; (7) `timone status` shows what a converted run waits on.

> Sub-phase 41b must be complete before starting this sub-phase (the old path, which still read these runs, is gone).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
git status --short .timone ; echo "(expected: nothing — no test touched the real ledger)"
```

- [ ] Red-green evidence for each of the seven cases is in the handoff.
- [ ] **Hard gate:** these seven tests are the only protection the conversion has before the live check. None may be skipped or weakened.

---

### Sub-phase 41d: `timone retry` is gone

**[DELETE]** `src/commands/retry.ts`, `src/commands/retry.test.ts`
**[MODIFY]** `src/cli.ts` — `retry` is no longer registered. Typing `timone retry` with any arguments exits with code 1 and prints: *"`timone retry` was removed. Write on the ticket instead: say what you want done."* It is not listed in `timone --help`.
**[MODIFY]** `src/daemon/requests.ts` — the `retry` request kind is removed. A leftover retry request in the queue is settled and removed on the next cycle, and reported once, not on every cycle. Check what the cycle does today with an unreadable request, and use that path if it already behaves so.
**[MODIFY]** `src/daemon/poll.ts` — `applyRequest`'s `retry` branch and its import are removed.
**[MODIFY]** `src/daemon/runs.ts` — `retry()` is deleted, with the helpers and imports only it used.
**[MODIFY]** `src/daemon/cta.ts`, `src/commands/status.ts` — every text that names `timone retry` goes: the call to action for a failed run, and the status report's list of failures. No failed run can exist after 41c.
**[MODIFY]** `src/commands/cancel.ts`, `src/commands/takeover.ts`, `src/daemon/dropped.ts`, `src/daemon/faults.ts` — their comments no longer describe `timone retry` as a command that exists. `src/daemon/lock.test.ts` uses `timone cancel` as its sample command instead.

**Seams under test (TDD):** the command line, built (`node dist/cli.js`), and `pollOnce` for the queue. Red-green: (1) `timone retry scratch-app#1` exits 1 with the sentence; (2) `timone --help` does not list `retry`; (3) a retry request left in the queue is settled and removed in one cycle, and the next cycle reports nothing about it; (4) `timone status` on 41c's fixture shows no list of failures, and names no command that no longer exists.

> Sub-phase 41c must be complete before starting this sub-phase (the texts for failed runs can only go once no failed run can be read).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
node dist/cli.js retry scratch-app#1 ; echo "exit: $? (expected 1)"
node dist/cli.js --help | grep -c retry ; echo "(expected 0)"
grep -rn "timone retry" src --include='*.ts' | grep -v '^src/daemon/session\.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)'
```

- [ ] The last command prints only the new sentence in `src/cli.ts` and its test, and recorded comments inside `src/runner/replay/cases.ts`, which stay as they were recorded. `src/daemon/session.ts` still names it until 41f deletes the spawner.
- [ ] No comment in a file that stays describes `timone retry` as a command that exists.
- [ ] Red-green evidence for each of the four cases is in the handoff.

---

### Sub-phase 41e: Takeover, the status report and the call to action know only the runner's wait

**[MODIFY]** `src/commands/takeover.ts` — deleted: the answer-on-the-ticket branches for an approval and a review, the conversation branch and `converse`, `markAnswerConsumed`, `reopenIfFailed`, and the old `endTakeover`, `release` and `settle`. `resolveTakeover` handles: no run, a queued run, a running run, a run waiting for the runner, and a finished or cancelled run, each as the runner's branch does today. `enrolFromTracker`, the takeover of a ticket with no run, registers a run in the runner's shape and claims it for the terminal session. Its release asks the runner for a wake, as for any run. Today it writes a conversation wait and opens `converse`.
**[MODIFY]** `src/commands/status.ts` — what a run waits on is described for the runner's wait only.
**[MODIFY]** `src/daemon/cta.ts` — only what the status report needs for the runs that can still exist stays: queued, picked up, active, waiting for the runner, done and cancelled. If what remains is small, move it into `status.ts` and delete `cta.ts`; say which in the handoff.
**[MODIFY]** `src/daemon/poll.ts` — remaining calls into what this slice deletes.
**[MODIFY]** `src/commands/takeover.test.ts`, `src/commands/status.test.ts`, `src/daemon/cta.test.ts` — the tests of deleted branches go with them.

`escalate` and `escalationPrompt` stay: a takeover of a run waiting for the runner uses them. 41g rewrites the prompt.

**Seams under test (TDD):** `resolveTakeover` and `runTakeover` in `takeover.test.ts`, and the status report. Red-green: (1) a takeover of a ticket with no run registers a run in the runner's shape, and its release asks for a wake; (2) a takeover of a run waiting for the runner opens the session bound to no step, as today; (3) a takeover of a queued or running run behaves as today; (4) for each kind of run 41c's fixture holds after conversion, the status report says where it stands and names no command that no longer exists; (5) the "waiting on you" line for a run waiting for the runner is unchanged.

> Sub-phase 41d must be complete before starting this sub-phase (both change `cta.ts` and `status.ts`).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
grep -rnw "converse\|markAnswerConsumed\|reopenIfFailed\|CARRY_ON_WAIT" src --include='*.ts' | grep -v '^src/daemon/session\.ts\|^src/daemon/runs\.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' ; echo "exit: $? (expected 1; session.ts and runs.ts are 41f's and 41h's)"
```

- [ ] Red-green evidence for each of the five cases is in the handoff.

---

### Sub-phase 41f: The old spawner, and everything only it used, is deleted

**[MODIFY]** `src/daemon/session.ts` — deleted: `AgentSessionSpawner` and its options, its ticket comments (`parkedComment` to `unclassifiedComment`), the forge witnesses, `handBack`, `escalate`, `carryToPullRequest`, `asBuildOutcome`, `laterOf`, `uncommittedRefusal`, `NAMED_IN_REFUSAL`, `DEFAULT_LINK_RETRY_WAITS_MS` and `waitWords`. Kept, because the runner's path uses them: `TimonePin`, `SessionWorkspace`, `TimoneCheckout` and `readTimoneCheckout` (without `uncommitted` if only the refusal read it), the session request builders, the session types, `apiErrorFrom`, `spokenText`, `sessionOutcomeFrom`, `intervalTicker`, `SessionRuntime`, `workspaceFor`, `mergeMessage`, `oneLine`, `waitOf`, `isPrompted` and `agentSdkRuntime`. Nothing is renamed.
**[MODIFY]** `src/daemon/chunk-zero.ts` — `mergeChunkZero`, the old merge that failed a run, is deleted. `openStepTickets`, `tryMergeChunkZero` and `attemptMerge` stay.
**[DELETE]** `src/daemon/gates.ts`, `src/daemon/gates.test.ts`, `src/daemon/gate-comment.ts`
**[DELETE]** `src/daemon/ask-check.ts`, `src/daemon/ask-check.test.ts` — the type of the model call moves to `src/daemon/consult.ts`, where `sdkConsult` is.
**[MODIFY]** `src/daemon/outcomes.ts` — only `askedFor` and `LONGEST_ASK` stay.
**[MODIFY]** `src/daemon/faults.ts` — only `technicalFault` stays.
**[MODIFY]** `src/daemon/session.test.ts` — the tests of the kept helpers stay (`sessionOutcomeFrom`, `apiErrorFrom`, `sessionRequest`); the rest go.
**[MODIFY]** `src/commands/guardrails.test.ts` — the case that builds an `AgentSessionSpawner`: moved to `startStepSession` if it tests a guardrail on a step's session, deleted if it tests only the spawner. The handoff says which.
**[MODIFY]** the tests of every other file changed here.

**Seams under test (TDD):** none new. This slice deletes code that no path has reached since 41b and 41e. Its checks are the compiler, the whole suite, the runner's own tests unchanged, and the replay's dry run.

> Sub-phase 41e must be complete before starting this sub-phase (takeover no longer calls into the spawner's prompts and comments).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
git diff --name-only main -- src/runner | grep -v '^src/runner/replay/' ; echo "exit: $? (expected 1: the runner's own files are unchanged)"
npm run --silent replay -- --dry 2>&1 | tail -3
grep -rn "timone retry" src --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)'
```

- [ ] The dry replay reports 19 of 19 cases.
- [ ] The last command prints only the sentence in `src/cli.ts` and its test, and recorded comments inside `src/runner/replay/cases.ts`.

---

### Sub-phase 41g: What a step is told matches the runner

**[MODIFY]** `src/daemon/prompts.ts`:
- `outcomeBlock`: steps are no longer told to end with the end-of-step lines. A step ends with the one plain comment it already writes, which still ends with the *What I need from you* line: `askedFor` reads it for the status report and the runner.
- `stuckBlock`: no escalation line. A step that cannot go on says so on the ticket in plain words, says what it needs, and ends. The runner reads that.
- The conversation record line and the words *"started because they answered in writing"* in the clarification and wayfinding prompts: removed, unless a search shows code that still reads the line (check `src/channels/conversation.ts` and `src/runner/`).
- The requirements and breakdown prompts say the step does not ask for the approval itself, because the machine does. Today they say "the machinery posts the approval request itself", which is still true in meaning; reword only if the words name a mechanism that is gone.
- Deleted, if 41e and 41f left them without a caller: `feedbackBlock`, `writtenAnswerBlock`, `carriedBlock`, `conversationSubject`, `takeoverPrompt`, and every input field only they read.
- `escalationPrompt` becomes the prompt for a takeover of a run. It names the run's step and what the run waits on, what the run record says happened, and the named people's words since. It drops the hand-back section (`handbackBlock`, `HANDBACK_MARKER`) and the "what ordinarily follows" hint, which calls `stageAfter`. When the run's step is a conversation (clarification, wayfinding or charting), it tells the session to hold that conversation with the person, using that step's skill. It says that when the session ends, the runner wakes and reads what the session left on the ticket, so the session ends by writing there, in plain words, what it did and what should happen next.

**[MODIFY]** `src/adapters/ticketing.ts` — the markers no code reads any more are deleted. `MACHINE_MARKER` and anything the runner or the status report still reads stay.
**[MODIFY]** `src/runner/replay/cases.ts` — only where a case imported a deleted marker: that marker's text is written into the case as it was, so every recorded comment stays exactly as it was recorded.
**[MODIFY]** `src/daemon/prompts.test.ts`

`SYSTEM` in `src/runner/brief.ts` is not changed. The runner's instructions are the same before and after this slice.

**Seams under test (TDD):** `stagePrompt` and the takeover prompt builder, in `prompts.test.ts`. Red-green: (1) for every step in `PROMPTED_STAGES`, the prompt contains none of the deleted markers; (2) every step's prompt still asks it to end with the *What I need from you* line; (3) the takeover prompt for a run waiting for the runner names its step and what it waits on, and says nothing about a hand-back line; (4) for a run whose step is wayfinding, it names the wayfinding skill; (5) the dry replay still passes 19 of 19, with every case's recorded comments unchanged.

> Sub-phase 41f must be complete before starting this sub-phase (the old callers of the deleted prompt parts are gone).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
git diff --quiet main -- src/runner/brief.ts ; echo "exit: $? (expected 0: the runner's instructions are unchanged)"
npm run --silent replay -- --dry 2>&1 | tail -3
```

- [ ] Red-green evidence for each of the five cases is in the handoff.
- [ ] The handoff lists each marker deleted, and for each, the search that shows nothing reads it.

---

### Sub-phase 41h: The ledger and the step table keep only what the runner uses

**[MODIFY]** `src/daemon/runs.ts`:
- `RunStatus` loses `failed`. `TRANSITIONS` loses the `failed` row and every transition only the old path made, such as `active` back to `picked-up`.
- The wait kind has one value left. If the field is then carried only to say `runner`, it is removed and the read strips it; if a reader on the runner's path still needs it, it stays and the handoff says which.
- Fields only the old path wrote are removed from the schema and stripped when the ledger is read: `reAsksAfterAnswer`, `consumedAnswerAt`, `askCheck`, `deaths`, `refusal`, `carried`, `wait.acknowledgedAt`, and `failure` unless 41c's cancelled runs keep their reason in it. The rule is the same for each: remove it only if nothing on the runner's path writes it.
- Deleted methods: `runningRun`, `parkedRuns`, `rememberAskCheck`, `fail`, `reopenForTakeover`, `refuse`, `started`, `unstarted`, `refusalTold`, `reclaim` and `carry`. Deleted helpers: `RE_ARM_LIMIT`, `stoppedTwiceWait`, `assertAllowed`, `RE_ASK_LIMIT`, `ESCALATION_WAIT`, `CARRY_ON_WAIT`, `isReAskAfterAnswer`, and the re-ask floor in `applyPark`.

**[MODIFY]** `src/daemon/pipeline.ts` — the table keeps what the runner reads: `PIPELINE_STAGES`, `stageLabel`, `modelFor`, `effortFor`, `ownsBranch`, `classificationFromLabels`, `wayfinderStage` and `APPROVAL_RECORD_MODEL`, and whatever else a search of `src/` still finds an importer for. Deleted: `next` and `stageAfter`, the wait columns and `waitFor`, `WaitKind`, `runsUnattended`, `requireWait` and `resolvableBy`, `built` and `isBuilt`, `inBuild`, `processStage`, `readGate`, `concludeConversation`, `routeAfterTriage`, `PipelineTransition`, `frontierIsEmpty`, `isMap` and `stageFromLabel`.
**[MODIFY]** `src/daemon/runs.test.ts`, `src/daemon/pipeline.test.ts` — the tests of what is deleted go with it.

**Seams under test (TDD):** the store's load from a file, and the step table. Red-green: (1) a ledger carrying every removed field loads, and the loaded runs carry none of them; (2) 41c's fixture still loads as 41c's tests say, and those tests pass unchanged; (3) written before the change and kept after it: for every step, the table gives the same label, model, effort and `ownsBranch` as on `main`.

> Sub-phase 41g must be complete before starting this sub-phase (`escalationPrompt` no longer calls `stageAfter`).

#### Agent Validation Steps

```bash
npm run build && npm test 2>&1 | tail -5
grep -rnw "stageAfter\|routeAfterTriage\|inBuild\|readStageOutcome" src --include='*.ts' | grep -vE '^[^:]+:[0-9]+:\s*(//|/?\*)' ; echo "exit: $? (expected 1)"
npm run --silent replay -- --dry 2>&1 | tail -3
```

- [ ] PRD-05.R1's hint holds: no table in code picks the next step. `next` and `stageAfter` no longer exist.
- [ ] `RunStatus` no longer has `failed`. The word stays only in the code that reads an old ledger (41c).
- [ ] Red-green evidence for each of the three cases is in the handoff.

---

### Sub-phase 41i: The decision records and the requirement lists say what happened

**[MODIFY]** `doc/adr/0022-…`, `0023-…`, `0031-…`, `0034-…`, `0035-…`, `0046-…`, `0052-…`, `0056-…` — the status line becomes `superseded by [ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)`, in the form ADR-0017 uses.
**[MODIFY]** `doc/adr/0054-…` — the same status line, followed by one sentence: ADR-0060 left to the build whether the ask check stays, and phase 41 removed it with the old code, because the runner writes every question with the whole run in view.
**[MODIFY]** `doc/adr/0014-…`, `0024-…`, `0030-…`, `0032-…`, `0049-…`, `0059-…` — the status stays `accepted`, and a line is added in the form ADR-0016 uses: `- **Amended by:** [ADR-0060](…), 2026-09-30 — <what changed>`. What changed, from ADR-0060's own list: 0014, a gate may be skipped with notice; 0024, the runner writes what a ticket needs; 0030 D2, chunk zero merges only on a recorded yes; 0032, `retry` is removed; 0049, the holder stays and the wait value goes; 0059 D2, there is no failed run for takeover to open.
**[MODIFY]** `doc/adr/0060-…` — the lines "Supersedes, once the runner has replaced the old code on every project" and "Amends, on the same condition" lose their condition, with a dated marker saying phase 41 (#166) met it.
**[MODIFY]** `doc/specs/prd/prd-05-a-runner-decides-each-step.md` — the open question on the ask check gets a dated answer: removed in phase 41, and why.
**[MODIFY]** `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md` — R19 gets a dated note: every project moved, and the `driver` line went with the old code (R20), so the period R19 covers is over. No status is changed; verification owns statuses.
**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — the clauses of R18 and R22 that name `timone retry` get a dated note: the command was removed by PRD-05.R11, and the runner decides whether a step is tried again (ADR-0060 D6). Older evidence notes that mention it are history and stay.
**[MODIFY]** `doc/specs/product-overview.md` — the goal "One written process, enforced identically on every project" gets a dated note, in ADR-0060's words: the process is followed by default, and every departure is shown.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 41h must be complete before starting this sub-phase (the records describe code that is then gone). It shares no file with 41j or 41k, and may run beside them.

#### Agent Validation Steps

```bash
for n in 0022 0023 0031 0034 0035 0046 0052 0054 0056; do grep -H -m1 -- '- \*\*Status:\*\*' doc/adr/$n-*.md; done
for n in 0014 0024 0030 0032 0049 0059; do grep -H -c -- 'Amended by:\*\* \[ADR-0060\]' doc/adr/$n-*.md; done
grep -n "once the runner has replaced\|on the same condition" doc/adr/0060-*.md
```

- [ ] Nine status lines read `superseded by [ADR-0060](…)`, with a link that resolves.
- [ ] Six records each carry one `Amended by: [ADR-0060]` line, naming what changed.
- [ ] ADR-0060's two conditions carry the dated marker.

---

### Sub-phase 41j: `process.md`, the step skills and the glossary describe the runner

**[MODIFY]** `process.md`:
- Under the table of stages, a short paragraph: the order is the default, not a rule. A runner decides each step and may leave the order; it says so on the ticket when it does, and code lists every departure on the pull request. Nothing reaches a default branch without a named person's yes (ADR-0060).
- Line 26, the chore's path: the default path, not a rule.
- Stage 5, the breakdown: chunk zero merges only on a recorded yes (ADR-0030 D2 as amended), and when the runner skipped the approval of the list of pieces, the initiative is one piece — as `timone-plan` already says.
- Stage 6: the refusal to build without an approved breakdown carries the exception `timone-execute` already has, for a skipped approval that was recorded. "Then escalate to the human" and the text about the escalation path leaving work behind are brought in line with ADR-0060: a question asked after building started does not stop the run, and the runner carries it to the pull request.
- Stage 8: the pull request opens with the list of departures that code writes (`<!-- timone:departures -->`), as `timone-deliver` already says.
- The section on gates, conversations and the human (from line 125) is rewritten: a named person instructs the runner in plain words on the ticket; `timone takeover` opens a terminal session on a ticket, and the runner reads what it left; `timone cancel` stops the run; code keeps the rules of ADR-0060 D2 to D5. The mechanics of ADR-0022, 0023, 0031, 0035, 0052 and 0056, and `timone retry`, are removed. The *What I need from you* line stays: the status report shows it.
- Line 168: whether a failed step is tried again is the runner's decision; code restarts a runner that failed (PRD-05.R16).
- Line 144: "the daemon orchestrates stage skills" becomes the runner.
- "Departure" in stages 6 to 8 means a build's departure from its plan, recorded in `phase-NN-departures.md`. The glossary's **Departure** means a step of the default order that did not run. Each use in `process.md` says which, in words.

**[MODIFY]** `.claude/skills/*/SKILL.md` and `.claude/skills/README.md`:
- The preamble "In loop mode (daemon-initiated sessions)" in ten skills and in the README becomes "In a session the runner started". The meaning stays: the target project comes with the event.
- `timone-execute` (the sentence at line 196), `timone-verify` (line 64) and `timone-deliver` (line 28), each from ADR-0056: in runner terms, a question a step asks after building started does not stop the run, and the runner carries it to the pull request.
- `timone-execute` line 49, `timone-verify` lines 60 and 328, "PRD-02's daemon will spawn" in `timone-deliver`, `timone-execute` and `timone-verify`, `timone-plan` line 228 and `timone-prd` line 189: in runner terms.
- `timone-wayfind`, lines 62 to 143 and 196 to 201: the map's questions are answered in plain words on the ticket, the runner reads the answers and starts the next step, and `timone takeover` stays for a conversation in the terminal. The call-to-action templates that offer a command only the old code honoured, the "one clarifying round", and the reading of a written answer go. The wayfinding labels stay: the runner reads them.
- `.claude/skills/README.md` line 21, "dispatched through stages 5 → 6 → 7 → 8": the default order.
- "Handoff" in `timone-execute`, `timone-plan` and `timone-verify` means a sub-agent's handoff notes, not a wait. It stays.

**[MODIFY]** `CONTEXT.md` — **Takeover**: a terminal session on a ticket; the runner reads what it left. **Written answer**, **Handoff**, **Escalation**, **Handback** and **Ask check**: each keeps one line saying it was removed on 2026-09-30 with the old code (ADR-0060), because older records still use the words. **Request**, **Step ticket** (its mention of `timone retry`), **Chunk zero** (merged only on a recorded yes) and **Breakdown** (the runner may skip its approval, and says so): brought in line. New: **Default order**, and **Departures record**, set apart from **Departure**.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 41h must be complete before starting this sub-phase (the documents describe code that is then gone). It shares no file with 41i or 41k, and may run beside them.

#### Agent Validation Steps

```bash
grep -rn "timone retry\|loop mode (daemon-initiated\|handback\|HANDBACK" process.md CONTEXT.md .claude/skills | grep -iv "removed\|was removed"
grep -c -i "runner" process.md
```

- [ ] The first command prints nothing.
- [ ] `process.md` names the runner, and says the order is the default.
- [ ] Each skill still reads as a whole from top to bottom: no sentence refers to a mechanism another sentence removed.

---

### Sub-phase 41k: The README and the manual describe the runner

**[MODIFY]** `README.md` — lines 8 to 11 and 108: the runner decides each step. Line 66: the `timone retry` line is removed. Lines 77 to 93: the section on runner projects becomes a section on the runner: every project is on it, who may instruct it (`operator`, `instructors`), the limit and how to say go on, and `timone record`. There is no `driver` line to set.
**[MODIFY]** `manual/how-the-daemon-works.md` — rewritten to describe the machine as it now is: the poll cycle (registration, the runner's turn, previews, introductions, the reclaim of a stale run, the requests), how a run moves (the runner decides, with the default order), the one wait, the run record, the limit, takeover and cancel, and what code keeps whatever the runner decides. The state diagram and the stage graph are redrawn; the old ones, with `timone retry` in them, go. The file name stays, because the README and `manual/README.md` link to it.
**[MODIFY]** `manual/README.md` — its line about the manual, if it no longer fits.
**[MODIFY]** `timone.example.yaml` — the `operator` line and one project's `instructors` list, as `timone.yaml` has them, with a comment each.

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 41h must be complete before starting this sub-phase. It shares no file with 41i or 41j, and may run beside them.

#### Agent Validation Steps

```bash
grep -rn "timone retry\|driver:" README.md manual/ timone.example.yaml ; echo "exit: $? (expected 1)"
node dist/cli.js projects list --manifest timone.example.yaml
```

- [ ] The example manifest loads through the real manifest reader.
- [ ] Every diagram in the manual renders on GitHub (look at the file on the pushed branch).

---

### Sub-phase 41l: The live check — the replay, and one watched run on scratch-app

This slice needs fvermaut: the model login the daemon and the replay use lives in his terminal.

1. **The replay.** He runs `npm run --silent replay` from his terminal, on this branch's last commit (about $2.50). The result is recorded as the next run in [phase-40-replay.md](reports/phase-40-replay.md), naming the commit, as runs 1 to 7 were. This is what unblocks PRD-05.R18's check.
2. **The real ledger.** Before the daemon starts, copy `.timone/state.json` to `.timone/state.json.bak-<date>-166`. He starts the daemon from his terminal on this branch's build, and its first line is checked for the lasting login. After the first cycle: `timone status` shows the four failed runs as cancelled and the six old waits as waiting, with what they wait on; and no comment was posted on any of those ten tickets.
3. **One watched run.** A small feature ticket on scratch-app, typed by the machine and said to be, checked first against scratch-app's code so that it asks for something the app does not yet do. It is marked `timone`. What is watched: it is picked up and acknowledged (PRD-02.R1); its steps run from the Timone root on scratch-app (R2); the requirements are approved on the ticket, by fvermaut's comment, and the run then goes on to planning (R4); its pull request carries a preview (R8) and the list of departures. A second watch runs beside the first for any machine question on any open ticket or pull request of scratch-app, not only this one.
4. The daemon is stopped at the end by whoever started it.

What was seen is written in `doc/plans/phases/reports/phase-41-live-gate.md`. **If this cannot be run before the pull request, the pull request opens with it listed as owed** ([ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) D1).

No behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phases 41i, 41j and 41k must be complete before starting this sub-phase (the watched run's steps read the rewritten skills).

#### Agent Validation Steps

```bash
ls .timone/state.json.bak-*-166
node dist/cli.js status 2>&1 | head -40
```

- [ ] The replay passes 19 of 19, three tries of three, on this branch's last commit.
- [ ] The ten old runs read as described in step 2, and no comment was posted on their tickets.
- [ ] The watched ticket reached its pull request with one stop only, for the approval of the requirements.
- [ ] **Human gate:** fvermaut runs the replay and starts the daemon, and approves the watched ticket's requirements on the ticket.

---

## Dependency graph

```
41a → (none)            the shared cycle tests run on runner projects
41b → 41a               every project on the runner; the cycle has one path
41c → 41b               old runs in the ledger become runs the runner reads
41d → 41c               timone retry is gone
41e → 41d               takeover, status and the call to action know one wait
41f → 41e               the old spawner and what only it used are deleted
41g → 41f               what a step is told matches the runner
41h → 41g               the ledger and the step table keep only what the runner uses
41i → 41h               the decision records and requirement lists       ┐
41j → 41h               process.md, the skills and the glossary          ├ may run in parallel
41k → 41h               the README and the manual                        ┘
41l → 41i, 41j, 41k     the replay, the real ledger, one watched run
```

The code slices run one after another: each deletes what the one before left without a caller, and most of them share `poll.ts`, `runs.ts` or `status.ts`.
