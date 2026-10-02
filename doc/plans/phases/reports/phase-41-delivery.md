# Phase 41 — Delivery Report

- **Date:** 2026-10-02
- **Phase:** [phase-41.md](../phase-41.md) — `Complete`, verified in [phase-41-verification.md](phase-41-verification.md)
- **Branch:** `timone/166-the-old-code-between-steps-is-removed` @ `2f9b7d4`
- **Base:** `main` — the project's default branch; the branch was cut from it.
- **Pull request:** opened against this report; its address is in the session's closing message and on [#166](https://github.com/fvermaut/timone/issues/166).
- **Screen:** no user-facing screen in this phase.
- **Questions for the human:** none from the check. The reviews raise one decision only a person can take (Spec finding 3).
- **Departures:** [phase-41-departures.md](phase-41-departures.md) — 13 entries.

## Scope

Piece 2 of [#164](https://github.com/fvermaut/timone/issues/164), ticket [#166](https://github.com/fvermaut/timone/issues/166): PRD-05.R20 (the old code between steps is removed, the superseded records are marked, and `process.md` and the skills describe the runner) and PRD-05.R11 clause 3 (`timone retry` does not exist, and says to write on the ticket instead). The list of pieces is [ticket-164.md](../../breakdowns/ticket-164.md), `Approved by fvermaut 2026-09-26 — 2 pieces`.

## How to try it

### Against the preview

Timone has no preview configured for pull requests. Use the local steps below.

### On a local checkout

Setup is in the [README](../../../../README.md). Then, on this branch:

1. `npm ci && npm run build && npm test` — 1,408 tests pass.
2. `node dist/cli.js retry scratch-app#1; echo "exit: $?"` — prints *"`timone retry` was removed. Write on the ticket instead: say what you want done."* and `exit: 1`. `node dist/cli.js --help` does not list `retry`.
3. `node dist/cli.js projects list` — loads `timone.yaml`, which has no `driver` line any more, and lists three projects. Add `driver: runner` under one project in a copy of the file and run `node dist/cli.js projects list --manifest <copy>`: it refuses, naming the project and saying to delete the line.
4. `node dist/cli.js status` — the runs the old code left read as cancelled or waiting. timone #106 reads *"stopped before the old code was removed: a build stage escalated"*.
5. With the daemon restarted on this build, `timone takeover timone#95` opens a terminal session told that the ticket is a wayfinding conversation.
6. `npm run --silent replay` from your own logged-in terminal (about $2.50) — owed, see below. It should report 19 of 19, three tries each.

The live check of this build, on scratch-app, is written up in [phase-41-live-gate.md](phase-41-live-gate.md).

## Verification outcome

Verified in [phase-41-verification.md](phase-41-verification.md) — 0 of 2 fix loops consumed.

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
| PRD-05.R19 | SHOULD | api | PASS (outside the derived scope) | 0 |

R11 and R20 pass but stay `draft`: each makes a claim about every case and names no `Falsified-by` check. R18 is BLOCKED because the recorded replay is older than the last code change.

### Outstanding for the human

- [ ] PRD-05.R18 — run the replay on this branch's last commit (`npm run --silent replay`, your own terminal), and record it as run 9 in [phase-40-replay.md](phase-40-replay.md). It also settles the runner's part of PRD-05.R7 clause 1.

## Standards review — phase 41

- **Read:** `standards/typescript.md`, `standards/testing.md`, `standards/code-smells.md`, the first rule in `CLAUDE.md`, `process.md` ("Writing to the human" and every changed section), `tsconfig.json`, `vitest.config.ts`, `package.json` (scripts). The diff `main...HEAD` for `src/`, `timone.yaml`, `timone.example.yaml`, `README.md`, `manual/`, `process.md`, `CONTEXT.md` and `.claude/skills/`. The current text of `src/commands/{daemon,takeover,status,cancel}.ts`, `src/daemon/{poll,prompts,runs,pipeline,consult,outcomes,requests,chunk-zero,dropped,session}.ts` and `manual/how-the-daemon-works.md`. The new or changed tests in `src/cli.test.ts`, `poll.test.ts`, `runs.test.ts`, `status.test.ts`, `takeover.test.ts`, `prompts.test.ts`, `pipeline.test.ts`, `daemon.test.ts`, `manifest.test.ts` and `outcomes.test.ts`. For comparison only, short parts of three files this diff does not change: `src/runner/driver.ts`, `src/runner/brief.ts` and `src/daemon/hooks.ts`. One extra check was run: `tsc --noEmit --noUnusedLocals`. The project's own config does not turn that flag on.
- **Diff:** `main...HEAD` — 115 files, +9,590/−28,374. The reviewed paths are 80 files, +6,347/−28,284.
- **Findings:** 9

### 1. A required daemon option that nothing reads — Dead code

- **Where:** `src/commands/daemon.ts:374–387`, `757–758`
- **What:** `RunDaemonOptions.root` is still `root: string;` (required). Its own docblock now says two opposite things: "What it is still for is the **timone** checkout — the spawner's version pin…" and then "✏ 2026-09-30: nothing here reads it since the spawner went." The call site still passes `root: process.cwd()`, with the comment "The timone root. The cycle takes none of its own." `daemon.test.ts` passes `root: noCheckouts` nine times.
- **Why it matters:** This is dead code (code-smells, Dispensables). The type-checker does not flag an interface field that nothing reads. The docblock contradicts itself.
- **Suggested remediation:** Delete the field, the line at the call site and the test arguments — not applied here.

### 2. `attemptMerge` is still exported, against its own rule — Dead code / Speculative generality

- **Where:** `src/daemon/chunk-zero.ts:79–80`, `108–115`
- **What:** The comment says "{@link attemptMerge} below takes no approval. Only this function may call it." and "nothing outside this file calls it now." The function is still `export async function attemptMerge(`.
- **Why it matters:** Nothing outside the file calls the export. It is also the one path that merges into a default branch without the approval that `tryMergeChunkZero` requires by its type (PRD-05 R3, cited in the same docblock). The comment states a rule that the code does not enforce.
- **Suggested remediation:** Drop `export` — not applied here.

### 3. Three test helpers left with no caller — Dead code

- **Where:** `src/daemon/poll.test.ts:395–425` (`threadedAdapter`), `522–573` (`staleReviewAdapter`), `575–581` (`staleWithPullRequest`)
- **What:** On `main` these were used 18, 4 and 5 times. The tests that used them were deleted, and the helpers stayed. `tsc --noUnusedLocals` lists all three. The project config does not use that flag, so the normal type-check says nothing.
- **Why it matters:** This is dead code. testing.md says "Test code gets production-level care". About 90 lines of a fake forge remain that no test uses.
- **Suggested remediation:** Delete the three helpers — not applied here.

### 4. Live code keeps the names of removed concepts — Inconsistent vocabulary

- **Where:** `src/commands/takeover.ts:50`, `204`, `321`, `741–783`; `src/daemon/prompts.ts:1159`, `1220–1227`, `1310`; `src/daemon/consult.ts:13–27`, `50–51`
- **What:**
  - **Takeover:** the only session a takeover opens is `{ kind: "escalation"; run: Run }`, opened by `escalate(…)` with `escalationPrompt(…)` over a `StoppedRun`. The docblock says that type is just "A run a takeover opens a session on". The prompt tells the session to write `Timone-Stage: … or \`escalation\` if none`.
  - **Consult:** `ASK_CHECK_MODEL` is still documented as "The model the ask check consults … Read one message, decide whether it is more expensive than the matter it is about, and if so write two sentences." Its only caller now asks whether a reply to the spending limit means "go on" (`consult.ts:43–46`).
  - **Glossary:** `CONTEXT.md:12` and `:14` now say "Escalation — removed on 2026-09-30" and "Ask check — removed on 2026-09-30".
- **Why it matters:** code-smells.md, Obscurers, "Inconsistent vocabulary": a name that contradicts `CONTEXT.md`, and the glossary is the authority. A reader of `takeover.ts` meets a concept that the glossary says no longer exists.
- **Suggested remediation:**
  - Rename the takeover names to takeover terms, for example `open-session`, `openSession`, `takeoverPrompt`, `TakeoverRun`.
  - Rename the constants to `CONSULT_MODEL` and `CONSULT_TIMEOUT_MS`, with a docblock about the spending-limit question.
  - Let a person decide whether the trailer value `escalation` stays, since commit history already carries it.
  - Not applied here.

### 5. Comments in files this diff edited still describe code it removed — Obsolete comment (Clean Code ch. 17, source [3] of code-smells.md)

- **Where:** `src/daemon/dropped.ts:14–17`, `24–26`; `src/commands/status.ts:133–135`; `src/commands/takeover.ts:224–227`; `src/daemon/outcomes.ts:7–10`; `src/daemon/pipeline.ts:118`, `135`, `168–174`; `timone.yaml:7–8`
- **What:**
  - `dropped.ts`: "**Any other ticket's** cancelled chunk is settled, so `register` opens a fresh one on the next cycle — which is what has always happened and is still what happens". It also says "three surfaces … the ticket's standing note". This diff removed the standing note, and it now puts the hold on every cancelled ticket (`cancel.ts:57`, "applied to every ticket").
  - `status.ts:133–135`: "**Read only for runs of projects the runner drives** … a project the daemon drives has no record". The same diff rewrote `spendingReader` in that file to say every project.
  - `takeover.ts:224–227`: "Its reason lives in `cancellation` rather than `failure`". `failure` is now a field the ledger drops (`runs.ts` `REMOVED_FIELDS`).
  - `outcomes.ts`: "the standing note it would land in is one line".
  - `pipeline.ts`, the `clarification` row: "The session judges whether what they wrote settles the question" and "The work is reading one written answer". The written answer was removed. The same file still says "the graph" twice, but the `next` column that made the table a graph is gone.
  - `timone.yaml`: "a runner project that names no instructors". Every project is now driven by the runner.
- **Why it matters:** Each one tells the next reader something false about code that this diff changed. The `dropped.ts` one is about the exact rule this phase changed.
- **Suggested remediation:** Rewrite each sentence to match the code as it is now, or delete it — not applied here.

### 6. A message to the person, the manual and the glossary say what the code no longer does — Writing to the human (process.md); Inconsistent vocabulary

- **Where:** `src/commands/takeover.ts:236–238`; `manual/how-the-daemon-works.md:504`, `507–508`; `CONTEXT.md:8`
- **What:**
  - **The message:** on a closed ticket with a cancelled run, `timone takeover` prints "reopen the ticket and mark it for me, and I'll start it afresh on my next pass." But a cancel now puts `timone:held` on the ticket (`cancel.ts:84–86`), and the cycle skips a held ticket (`poll.ts:1139`). So doing what the message says starts nothing.
  - **The manual's takeover table:** it says "`done` | Refused: the ticket is finished.", "`cancelled` | Refused, with the reason and how to start it again." and, for a new run, "with no step chosen". Since 41m, `takeover.ts:196–207` and `284–318` open a new run for an open ticket whose last run is done or cancelled. The new run gets the step its `wayfinder:` label names.
  - **The glossary:** `CONTEXT.md:8` still says "All channels sit behind one adapter seam". This diff deleted that seam (`src/channels/conversation.ts`) and cut the matching words from `process.md`, so the two files now disagree.
- **Why it matters:** process.md's writing rule asks for plain statements of fact. A message that tells a person to act, when the action will have no effect, is the case it was written to prevent. The manual is the operator's reference for this command.
- **Suggested remediation:**
  - Change the message to name the hold label as the way back.
  - Update the manual's table rows for `done`, `cancelled` and "no run".
  - Drop "behind one adapter seam" from `CONTEXT.md:8`.
  - Not applied here.

### 7. "Which comments came after this instant" is decided a second way, by comparing strings — Duplicated code

- **Where:** `src/daemon/prompts.ts:1437`
- **What:** `(since === undefined || comment.createdAt > since),` compares ISO timestamps as strings. `src/runner/driver.ts:296–298` and `734` make the same decision through `ms()`, which is documented as "for comparing two of them whatever their spelling".
  - The ledger writes timestamps with milliseconds. For example, `waitCursor: created.updatedAt` at `takeover.ts:318` gives "…40.903Z".
  - GitHub writes them without milliseconds ("…09:05:00Z").
  - Compared as strings, "…:00Z" sorts after "…:00.500Z". So a comment written in the same second, before the wait opened, is shown to the session as written after it.
- **Why it matters:** code-smells.md, Duplicated code: the same decision made twice, and the second copy is done a different way. The first copy already handles the case the second one gets wrong.
- **Suggested remediation:** Compare with `Date.parse`, or share the driver's helper — not applied here.

### 8. New type assertions on unknown ledger data — typescript.md, "Traps that bite"

- **Where:** `src/daemon/runs.ts:1562`, `1648`, `1651`
- **What:** `const old = run as Record<string, unknown>;` in `normaliseOldPath` and in `normaliseRemovedFields`, and `? (old.wait as Record<string, unknown>)`.
- **Why it matters:** typescript.md says "`as` is legitimate in exactly three places: brand constructors, `as const`, test fixtures." These are three new uses. They copy a pattern the file already had at `:1483` (`normaliseWait`, from before this diff), and the schema still checks the result. So the risk is low, but the code still departs from an Approved entry.
- **Suggested remediation:** Narrow with `in` checks, as `normaliseSequences` does at `:1447–1448`, or read the old shape through a `z.looseObject` schema — not applied here.

### 9. Test names tied to the migration, not to behaviour — testing.md, "What a good test is"

- **Where:** `src/daemon/pipeline.test.ts:253–287`; `src/daemon/poll.test.ts:394`, `3872`; `src/commands/status.test.ts:894`; `src/commands/takeover.test.ts:1597`
- **What:**
  - **`pipeline.test.ts`:** the test "gives %s the same label, model, effort and branch as on main" checks values "Written out by hand from the table on `main` on 2026-09-30". After the merge, `main` is the code under test. The test becomes a second copy of the step table. Changing a model, which `pipeline.ts:136–137` calls "a one-line edit", will then need two edits, and the test name will be false.
  - **`poll.test.ts:394`:** `describe("pollOnce — resuming a run whose human answered")` now holds one test, about promoting the queue. The resume was removed.
  - **Three test names:** "…on a project whose entry names no driver" describes a condition that can no longer vary, because a `driver` line is now refused at load.
- **Why it matters:** testing.md says a test "reads as a specification: the name states behaviour under a condition". These names describe a moment in this branch's history, not a behaviour.
- **Suggested remediation:**
  - Rename the `pipeline.test.ts` test to the behaviour, for example "each step has its label, model, effort and branch". Or delete it once merged, since it only guarded the deletion.
  - Rename the `describe` block in `poll.test.ts`.
  - Drop "whose entry names no driver" from the three test names.
  - Not applied here.

## Spec review — phase 41

- **Read:** `doc/specs/prd/prd-05-a-runner-decides-each-step.md`, `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`, `doc/plans/phases/phase-41.md` (from the top to the end of `## Requirements`), `doc/plans/breakdowns/ticket-164.md`, and the head of `doc/adr/0060-…md`. The `main...HEAD` diff for: `src/` (pipeline, outcomes, runs, poll, session, prompts, cli, cli.test, cancel, takeover, requests, manifest, status, daemon, chunk-zero, consult, dropped, step-session, channels, runner/actions, runner/replay), `timone.yaml`, `timone.example.yaml`, `README.md`, `manual/README.md`, `manual/how-the-daemon-works.md` (searched only), `process.md`, `CONTEXT.md`, every changed `.claude/skills/*`, every changed `doc/adr/*`, `doc/specs/prd/prd-02…criteria.md`, `prd-04…criteria.md`, `prd-05*` and `doc/specs/product-overview.md`. The built `dist/cli.js` was run in an empty temporary folder; that changed nothing.
- **Diff:** `main...HEAD` — 115 files, +9,590/−28,374
- **Findings:** 3

Most of the work matches the requirements. The code that chose the next step (`stageAfter`, the `next` column, `whatFollows`, `resumeAnswered`) is gone. So is the code that read a step's end from an exact line (`readStageOutcome`, `readHandback`, the `STAGE_*`/`HANDBACK_*` markers) and the code that decided where a run waits (the gate, conversation, review and escalation waits, `cta.ts`, `gates.ts`). The `driver` line is refused when `timone.yaml` is read. All eight ADRs that ADR-0060 lists as superseded, plus ADR-0054, have their status lines changed. The six ADRs it amends carry "Amended by" lines. `process.md` says the order is the default and describes the runner. `timone cancel` still stops the run, stops the step, frees the project and holds the ticket.

### 1. Most step skills do not say the order is the default, and triage still presents its route as fixed — R20

- **Where:** `.claude/skills/timone-triage/SKILL.md:39–49` and `:110–114`; `.claude/skills/timone-execute/SKILL.md:338`; the one-line changes at `timone-adr/SKILL.md:20`, `timone-grill/SKILL.md:24`, `timone-prototype/SKILL.md:22`, `timone-triage/SKILL.md:20`
- **What:** Only deliver, plan, verify and wayfind call the order a default. Triage, grill, adr, prd and execute do not. Triage, grill, adr and prototype each got one changed line: "In a session the runner started, the target project arrives in the session's prompt". Triage's label sets the default order, but the skill still says "The entry point follows the stage-1 routing table — restated here, no variants" and "Triage routes; it never starts the next stage". It never says that the runner reads the label as a default and may leave it, as in the #104 case. Plan (`:228`) and verify (`:329`) gained the note "the runner chooses the next step … X is the default one". The matching closing items in execute ("5. The next invocation: `/timone-verify …`") and triage (item 3) did not get it.
- **Why it matters:** R20: "`process.md` and the step skills say that the order is the default, and describe the runner." `process.md` does. The skills do so only in part.
- **Suggested remediation:** In triage's Route section, say that the runner reads the label as the default order, may leave it, and says so on the ticket. Add the plan/verify note to the "next invocation" items in triage and execute. — not applied here

### 2. `timone help retry` shows the removed command and does not point to the ticket — R11

- **Where:** `src/cli.ts:60–70`; test at `src/cli.test.ts:34–47`
- **What:** The stub is `.command("retry", { hidden: true }) … .helpOption(false)`. `timone retry …` and `timone retry --help` print "`timone retry` was removed. Write on the ticket instead: say what you want done." and exit 1. But `timone help retry` on the built CLI prints `Usage: timone retry [anything...]` and exits 0. The test covers `retry --help`, not `help retry`.
- **Why it matters:** R11 clause 3: "WHEN `timone retry` is typed THEN it does not exist, and the message says to write on the ticket instead." This form shows a usage line for a command that should not exist, and it gives no pointer to the ticket.
- **Suggested remediation:** Make `help retry` print the same sentence and exit 1, and add that case to `cli.test.ts`. — not applied here

### 3. Takeover still opens no session for a queued or running run — R11

- **Where:** `src/commands/takeover.ts:186–197`; comment at `:207–212`; `README.md:91`
- **What:** For a run that is `queued`, `picked-up` or `active`, takeover answers "I'm working on X right now. Anything I need from you will land on the ticket." and opens nothing. A comment added in this diff says "A takeover opens a terminal session on any run (PRD-05.R11)". The README text in this diff narrows the rule instead: "opens a terminal session on a ticket nothing is working on right now". `main` behaves the same way, so this is not a regression.
- **Why it matters:** R11 clause 2: "GIVEN any run WHEN the operator runs `timone takeover <ticket>` THEN a terminal session opens on that ticket". In the code it holds for parked runs, and for open tickets whose run is done or cancelled. It does not hold for queued or running runs.
- **Suggested remediation:** Either open a session on a running run (stopping its step first), or change R11 clause 2 to "any run nothing is working on", which matches the README. fvermaut should decide which. — not applied here

## Notes

- **The daemon** fvermaut started for the live check runs this branch's `3afc263`. After the merge, restart it so it runs the merged code, including 41m's change to how the ledger is read.
- **On Timone's own tickets**, the runner ended the six old conversation runs (#91, #92, #95 to #98) on the live check's first cycle, because their `timone` label was removed on 2026-09-11, and posted on four of them. The comments on #91 and #98 say the question above no longer needs an answer here, and the one on #95 says the request to answer no longer applies. The questions are still open for fvermaut; only the machine stopped waiting on them.
- **Older faults found on the way**, not caused by this work: [#186](https://github.com/fvermaut/timone/issues/186), [#187](https://github.com/fvermaut/timone/issues/187), [#188](https://github.com/fvermaut/timone/issues/188), and [#182](https://github.com/fvermaut/timone/issues/182) (the session check on Timone's own work branch).
- **Older tickets this work may have made moot**, worth a look before closing any of them: #116 (takeover refusing a failed run: no run can be failed now), #142 (a retried ticket keeps its hold: `timone retry` is gone), #171 (the terminal session gets the old instructions: the takeover prompt was rewritten).
- **`dist/`** still holds the output of the deleted files; nothing imports them. Clean it when no daemon runs from it.
