# PRD-05 Acceptance Criteria — A runner decides each step of a run

> Formal register for [prd-05-a-runner-decides-each-step.md](prd-05-a-runner-decides-each-step.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.
>
> Words used here: a **runner** is the agent that decides what happens next in a run. A **named person** is someone listed for the project in `timone.yaml` as allowed to instruct it, the operator by default. A **departure** is a step of the default order that did not run, or ran out of order. The **default order** is the order of steps in `process.md` for the ticket's kind.
>
> No requirement here puts anything on a screen that Timone draws, so no accessibility criteria apply.

## R1 — The runner chooses each step, with the written order as its default

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a feature request that was just sorted, and nothing unusual about it
      WHEN the runner wakes
      THEN it starts the interview, which is the next step of the default order
    - GIVEN a request whose requirements are already approved on the default branch ([#104](https://github.com/fvermaut/timone/issues/104))
      WHEN the runner wakes after sorting
      THEN it skips the interview and starts planning
      AND the skip is a departure, handled as R5 and R6 say
    - GIVEN any run
      WHEN code decides which session to start
      THEN the choice comes from the runner's decision, and no table in code picks the next step
- **Evidence:** ✏ 2026-09-29 — partial, phase 40 verification, re-check after 40z and replay run 7 ([report](../../plans/phases/reports/phase-40-verification.md#re-check-after-40z-and-replay-run-7--2026-09-29)): what code does passes: the brief shows the default order and what ran, requirements already on the default branch are shown, and the step started is the one the runner chose. The runner's choice in clause 2 passes: replay case #104 chose it on three tries of three in run 7, on the code this branch carries. The runner's choice in clause 1 is not settled: no replay case is a plain feature just sorted, and the one live sighting (scratch-app#62, 2026-09-28) was on a build before 40s.
- **Verification hint:** the replay set of R18 carries both cases as fixtures. For the third clause, read the seam: `stageAfter` and the `next` fields of `STAGES` in `src/daemon/pipeline.ts` are no longer called to choose a session. The default order may still exist as data given to the runner.

## R2 — The runner acts only through the actions code gives it

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that lists the tools a runner session is started with and fails on any tool not in the list below
- **Criteria:**
    - GIVEN a runner session
      WHEN its tools are listed
      THEN they are exactly: start a step session with instructions, send a running step a message, stop a step, post on the ticket or the pull request, set or clear the hold on a ticket, record a named person's approval by naming the comment that gave it, file or update a Timone issue, and end the run
      AND none of them edits a file, runs a shell command, pushes, or merges
    > ✏ 2026-09-29 — amended at verification, phase 40: the list gains the action that records a named person's approval. R3's third clause and R7's second clause need an approval recorded with the comment it came from, and no other action records one. See [phase-40-departures.md](../../plans/phases/reports/phase-40-departures.md).
    - GIVEN the runner decides that something in the project must be fixed
      WHEN it acts
      THEN it starts a step session with instructions, and every commit that follows carries that session's `Timone-Stage` trailer
- **Verification hint:** the runner is started through the Agent SDK with an explicit tool list and no built-in file or shell tools. The test reads that list from the code that starts the runner.

## R3 — Nothing reaches a default branch without a yes from a named person

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that tries each merge path in the code with no recorded approval and fails if any of them writes to the default branch
- **Criteria:**
    - GIVEN any run
      WHEN the runner's actions are listed
      THEN none of them merges a pull request or pushes to a default branch
    - GIVEN a run in which the runner skipped the approval of the list of pieces
      WHEN the list is committed
      THEN the requirements and the list of pieces are not merged into the default branch
      AND they reach the operator in a pull request
    - GIVEN a run in which a named person approved the list of pieces in a comment
      WHEN the approval is recorded
      THEN chunk zero is merged as today, and the record names the comment the approval came from
- **Verification hint:** today's only merge is `mergeChunkZero` in `src/daemon/session.ts`. The test gives it a run record with no approval and checks that the default branch has not moved.

## R4 — A run that changed the project's files ends at a pull request

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that asks to end a run whose branch has commits not on the default branch and not in an open pull request, and fails if the run ends
- **Criteria:**
    - GIVEN a run whose branch has commits that are not on the default branch
      WHEN the runner asks to end the run with no open pull request for that branch
      THEN code refuses and tells the runner why
    - GIVEN the same run
      WHEN a named person cancels it with `timone cancel`
      THEN the run ends, and no pull request is required
    - GIVEN the same run
      WHEN a named person asks on the ticket, in plain words, for the work to stop for good
      THEN the runner may end the run citing that comment, and code ends it with no pull request, once it has checked the comment exists and is theirs
    > ✏ 2026-09-28 — amended at build, phase 40 (40t): replay run 5 showed a finished-by-hand ticket whose run only `timone cancel` could end, which is the terminal-only way out R9 exists to remove. See [phase-40-departures.md](../../plans/phases/reports/phase-40-departures.md).
    - GIVEN a run that changed no files, such as a question or a decision ticket
      WHEN the runner ends it
      THEN it ends on the ticket, with no pull request
- **Verification hint:** the check sits in the code behind the "end the run" action, not in the runner's instructions.

## R5 — Code lists every departure on the pull request, and a skipped check comes first

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run record in which the checking step did not run
      WHEN the pull request is opened
      THEN the first line of its description says the work was not checked by a session that did not build it, and gives the runner's reason
    - GIVEN a run record in which the interview and the approval of the requirements did not run
      WHEN the pull request is opened
      THEN its description lists both, each with the runner's reason
    - GIVEN a run record with no departures
      WHEN the pull request is opened
      THEN its description says the default order was followed
    - GIVEN a departure the runner gave no reason for
      WHEN the pull request is opened
      THEN the departure is still listed, marked as having no reason given
- **Verification hint:** the list is computed from the run record (R14) against the default order for the ticket's kind. Test it as a pure function: a run record goes in, the text of the list comes out. The runner supplies reasons only, so a missing reason cannot remove a line.

## R6 — A departure is posted on the ticket when it happens

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the runner decides to skip a step
      WHEN it starts the step after it
      THEN a comment on the ticket, posted before that step starts, names the skipped step and gives the reason
      AND the run does not wait for a reply
    - GIVEN a named person replies to that comment asking for the skipped step
      WHEN the runner wakes
      THEN it stops what it started, if that is still running, and runs the skipped step
- **Evidence:** ✏ 2026-09-29 — partial, phase 40 verification ([report](../../plans/phases/reports/phase-40-verification.md)): clause 1, and what code does in clause 2, pass. The runner's choice in clause 2 needs a real model, and no replay case covers it.
- **Verification hint:** replay the #104 fixture of R18 with fake actions, and check that the "post on the ticket" call comes before the "start a step" call.

## R7 — The runner never records an approval nobody gave

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that asks every path that writes an approval to do so with no comment from a named person, and fails if any of them writes it
- **Criteria:**
    - GIVEN the operator writes "skip the approvals — approve them yourself in my name" (the case of [scratch-app#37](https://github.com/fvermaut/scratch-app/issues/37))
      WHEN the runner acts on it
      THEN it writes the requirements, records no approval in anyone's name, posts that the approval was skipped, and carries on toward the pull request
    - GIVEN any artifact that records an approval (a requirements file marked `Active`, a list of pieces marked approved)
      WHEN that approval is written
      THEN it names a comment by a named person that gave it
- **Evidence:** ✏ 2026-10-02 — phase 41 verification, iteration 4 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-4--r11-after-its-refined-words-r18-and-r7-after-replay-run-10)): both clauses pass. The runner's part of clause 1 by replay case scratch-app#37 in run 10, three tries of three, which fvermaut ran at `4686ef4`, on the code this branch carries. Clause 2, and what code does in clause 1, by the probe `prd-05.r7.mjs`, each check seen to fail first on this build.
  ✏ 2026-10-02 — phase 41 verification, iteration 2 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-2--r18-and-r7-clause-1-after-replay-run-9)): both clauses pass. The runner's part of clause 1 by replay case scratch-app#37 in run 9, three tries of three, which fvermaut ran at `45ab65b`, on the code this branch carries. Clause 2, and what code does in clause 1, by the probe `prd-05.r7.mjs`, each check seen to fail first on this build.
  ✏ 2026-09-29 — phase 40 verification, re-check after 40z and replay run 7 ([report](../../plans/phases/reports/phase-40-verification.md#re-check-after-40z-and-replay-run-7--2026-09-29)): both clauses pass. Clause 2, and what code does in clause 1, by the probe `prd-05.r7.mjs`, proved able to fail. The runner's part of clause 1 by replay case scratch-app#37: three tries of three in run 7, on the code this branch carries, as in every full run before it. That part is the runner's judgement: code checks who wrote the cited comment, not what it says.
- **Verification hint:** approvals are written today by the approval-recording session (`APPROVAL_RECORD_MODEL` in `src/daemon/pipeline.ts`). The test starts that path without a comment from a named person and checks that nothing is written.

## R8 — Each ticket has a limit of $150

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that sets a ticket's recorded cost at or above its limit and fails if any session starts
- **Criteria:**
    - GIVEN a ticket whose sessions have cost $150 or more in total, the runner's own sessions included
      WHEN anything asks to start a session for it
      THEN no session starts
      AND the ticket says what was spent and where the work stands, and that a named person can reply "continue" to allow another $150
    - GIVEN that ticket
      WHEN a named person replies "continue", in any wording that means it
      THEN another $150 is allowed, and the work carries on
    - GIVEN a project whose entry in `timone.yaml` sets a different limit
      WHEN its tickets are counted
      THEN that limit is used instead of $150
- **Evidence:** ✏ 2026-09-29 — partial, phase 40 verification ([report](../../plans/phases/reports/phase-40-verification.md)): every clause passes except the reading of "any wording that means it", which a one-turn model check does and a real model is needed to test. One such check starts at the limit for each named person's reply; the build recorded this as a narrow reading.
- **Verification hint:** each session already reports `total_cost_usd` (`src/daemon/progress.ts`). The count belongs to the ticket, not to one run, so a ticket with several runs adds them all up.

## R9 — Plain words from a named person move the run

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** [phase-40-live-gate.md](../../plans/phases/reports/phase-40-live-gate.md), third attempt, 2026-09-30 — all three clauses seen. Every comment moved the run or got an answer; "go bakc to planning" was done on scratch-app#68, and "stop the build now" on #67; a change asked for on pull request #69 got a reply there 33 s before the session that made it. Stays draft: clause 1 claims "any kind, in any state", which watching cannot establish.
- **Criteria:**
    - GIVEN a run of any kind, in any state
      WHEN a named person comments on its ticket or pull request
      THEN the runner wakes and either acts or answers on the ticket
    - GIVEN a stuck ticket
      WHEN a named person writes "try again", "stop", "skip the interview" or "go back to planning", spelling mistakes included
      THEN the runner does what was asked, or says on the ticket why it will not
    - GIVEN a named person comments on a pull request asking for a change ([#147](https://github.com/fvermaut/timone/issues/147))
      WHEN the runner wakes
      THEN a reply on the pull request says the change is being made, before the session that makes it starts
- **Verification hint:** a supervised run on scratch-app, with the operator writing each phrase on a real ticket. This requirement takes over [PRD-04.R7](prd-04-one-short-question-instead-of-a-terminal.criteria.md).

## R10 — Only named people can instruct the runner

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** a test that gives the code that wakes the runner a comment from a login not named for the project, and fails if the comment reaches the runner or wakes it
- **Criteria:**
    - GIVEN a comment on a ticket or pull request by someone not named for the project
      WHEN the daemon reads it
      THEN the runner is not woken by it
      AND the comment's text is not part of anything the runner is given
    - GIVEN a project with no one named in `timone.yaml`
      WHEN its comments are read
      THEN the operator is the one named person
    - GIVEN a comment written by Timone itself
      WHEN the daemon reads it
      THEN it is not treated as an instruction
- **Verification hint:** Timone's own repository is public, so anyone can comment there. Today any comment Timone did not write counts as an answer (`readGateDecision` in `src/daemon/gates.ts` checks only `fromTimone`). The filter belongs in the code that reads comments, before anything reaches the runner.

## R11 — `takeover` and `cancel` stay, and `retry` goes

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** [`doc/plans/phases/probes/prd-05.r11.mjs`](../../plans/phases/probes/prd-05.r11.mjs)
    > ✏ 2026-10-02 — added on fvermaut's answer on pull request [#189](https://github.com/fvermaut/timone/pull/189): yes to naming verification's probe here. The probe was shown able to fail: each of its checks went red on a break leg before it went green, in the phase 41 verification.
- **Criteria:**
    - GIVEN the runner cannot start, for example because the model service cannot be reached
      WHEN the operator runs `timone cancel <ticket>`
      THEN the run stops, any running session is stopped, and the project is free for the next ticket
    - GIVEN a run that nothing is working on, on a project where no other run is working, holds a work branch, or waits its turn
      WHEN the operator runs `timone takeover <ticket>`
      THEN a terminal session opens on that ticket, and when it ends the runner wakes and reads what it left
    > ✏ 2026-10-02 — reworded on fvermaut's answer on pull request [#189](https://github.com/fvermaut/timone/pull/189): "change the words". It said "GIVEN any run". A takeover of a run the machine is working on opens no session, and says what is happening. Nor does a takeover of a run waiting its turn: it waits because another run holds the project, and a terminal session on it would work in the same repository at the same time. The README already says a takeover opens a session "on a ticket nothing is working on right now". See the Spec review, finding 3, in [phase-41-delivery.md](../../plans/phases/reports/phase-41-delivery.md). ✏ 2026-10-02, refined after verification iteration 3 ([report](../../plans/phases/reports/phase-41-verification.md)): the clause now names the rules the code keeps: one session per project at a time, and one work branch per project at a time. A takeover is also refused while another run of the same project is working or holds a work branch, for the same reason; the words before this refinement did not say so (the second half was found by the second requirements review of #189).
    - GIVEN the command line
      WHEN `timone retry` is typed
      THEN it does not exist, and the message says to write on the ticket instead
- **Evidence:** ✏ 2026-10-02 — phase 41 verification, iteration 4 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-4--r11-after-its-refined-words-r18-and-r7-after-replay-run-10)): all three clauses pass, and each of the probe's 16 checks was seen to fail first in this run. Clause 2 was checked on its words as they stand at `fb3f88a`. A run nothing is working on gets a terminal session when no other run of the project is working, holds a work branch, or waits its turn, also when another run is parked holding no work branch; the runner then wakes and reads what the session left. No session opens on a busy run, on a run in the queue, while another run of the project is working, or while another run is parked holding a work branch (with and without a daemon). Iteration 3's question is answered by the new words. The claim is universal, and the `Falsified-by` line names this probe, which went red on every break leg. Status `draft` → `verified`.
  ✏ 2026-10-02 — phase 41 verification, iteration 3 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-3--after-the-reviews-fixes-41n-to-41p)): all three clauses pass again on the build after the reviews' fixes, and each of the probe's 12 checks was seen to fail first. Clause 2 was checked on its new words. A run nothing is working on gets a terminal session, both when the runner left it waiting and when `timone cancel` had stopped it, and the runner then wakes and reads what the session left. A busy run and a run in the queue get no session, as the note says. It stays draft. One run fits clause 2's words and gets no session: a run waiting on nothing, not in the queue, while another run of the same project is being worked on. The note's reason and R15 clause 2 say that refusal is right; the words say a session opens. Which one should change is a question for fvermaut in the report.
  ✏ 2026-10-02 — phase 41 verification ([report](../../plans/phases/reports/phase-41-verification.md)): all three clauses pass. Clause 3 is now checked as written: `timone retry` is not offered, typing it changes nothing, and the message says to write on the ticket. Every check was seen to fail first. It stays draft: its claim is universal ("any run", "any running session") and this block names no `Falsified-by` check. The probe `prd-05.r11.mjs`, proved able to fail, could be named here.
  ✏ 2026-09-29 — partial, phase 40 verification ([report](../../plans/phases/reports/phase-40-verification.md)): this phase's part passes: cancel, takeover (with and without a running daemon), and retry refusing on a runner project. Clause 3 as written ("it does not exist") is #166's.
- **Verification hint:** `src/commands/cancel.ts` must not start or wait for a runner. The takeover case replaces the handback note of ADR-0035: the runner reads the session's closing comment in plain words.

## R12 — The runner wakes on events, and checks every 15 minutes while a step runs

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** [phase-40-live-gate.md](../../plans/phases/reports/phase-40-live-gate.md), third attempt, 2026-09-30 — clause 1 seen for comments (3 to 62 s) and step ends (within 5 s); a failing or silent step was not seen. Clause 2 seen in part: a check at 15 min 6 s, with the commands listed by code, but no output ([#176](https://github.com/fvermaut/timone/issues/176)), and a stopped step's cost recorded as $0 (#176).
- **Criteria:**
    - GIVEN a run
      WHEN a step ends, a step fails, a step is silent for longer than its limit, or a named person comments
      THEN the runner wakes within one polling cycle
    - GIVEN a step that has been running for 15 minutes since it started or since the last check
      WHEN the check falls due
      THEN the runner wakes with a summary written by code: the commands the step ran since the last check, the time taken, and the output so far
      AND the summary is short enough to read in one page, and is not the step's full session
      AND the step's cost is recorded when the step ends
    > ✏ 2026-09-27 — amended at planning, phase 40: a running session reports its cost only in its final message, so a summary taken while it runs cannot hold the cost. See [phase-40-departures.md](../../plans/phases/reports/phase-40-departures.md).
- **Verification hint:** the step's output is already read live (`src/daemon/progress.ts`, `src/daemon/transcript.ts`). The summary can be built from the same stream. The api part of this (the summary is built correctly from a recorded stream) can be tested on a stored session from `.timone/sessions/`.

## R13 — The runner can send a running step a message, or stop it

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** [phase-40-live-gate.md](../../plans/phases/reports/phase-40-live-gate.md) — clause 1 seen in the first and second attempts (2026-09-28). Clause 2 seen in the third attempt, 2026-09-30, on a questions step (scratch-app#65) and a build (#67): the step stopped, the box session ended, and the record names the runner and its reason. "Its pushed commits stay" was not seen: the build had pushed nothing yet.
- **Criteria:**
    - GIVEN a build step that has run the full browser test suite six times in 30 minutes (the case of [#110](https://github.com/fvermaut/timone/issues/110))
      WHEN the runner's check sees it
      THEN it may send the step a message, and the step's next turn shows the message was received
    - GIVEN a running step
      WHEN the runner stops it
      THEN the session in the box ends, its pushed commits stay on the branch, and the run record says who stopped it and why
- **Verification hint:** today the box starts the step with `claude -p` and the prompt on standard input (`src/daemon/container-runtime.ts`). It cannot receive messages. The step must be started in a mode that accepts messages while it runs.

## R14 — Each wake is a fresh runner session, working from a run record kept by code

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run waiting on a person for days
      WHEN the person answers
      THEN a new runner session starts, and no runner session was kept alive while the run waited
    - GIVEN any run
      WHEN its record is read
      THEN it holds every step that ran, with its start, its end and its cost; every decision of the runner and its reason; every departure; and the total cost so far
    - GIVEN a finished run
      WHEN the operator asks for its record from the command line
      THEN the record is shown in plain words
- **Evidence:** ✏ 2026-09-29 — phase 40 verification ([report](../../plans/phases/reports/phase-40-verification.md)): all three clauses pass. It stays draft because its claim is universal ("no runner session was kept alive", "every step") and this block names no `Falsified-by` check; the probe `prd-05.r14.mjs`, proved able to fail, could be named here.
- **Verification hint:** the record is written by code, never by the runner, because R5 and R8 are computed from it. The runner's reasons are stored as the runner gave them.

## R15 — One project's work no longer holds up the others

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Last live gate:** [phase-40-live-gate.md](../../plans/phases/reports/phase-40-live-gate.md), third attempt, 2026-09-30 — clause 2 seen: two refusals ("one session per project at a time"), two wakes on "The project is free now.", and no two steps of scratch-app at once. Clause 1 not watched: no second project with tickets can be used for a test.
- **Criteria:**
    - GIVEN a step running on one project
      WHEN a named person comments on a ticket of another project
      THEN that project's runner wakes within one polling cycle, and does not wait for the first project's step to end
    - GIVEN two tickets on the same project
      WHEN both are ready
      THEN only one runs at a time, as today
- **Verification hint:** this is [#148](https://github.com/fvermaut/timone/issues/148). Time the runner's wake. Clause 1: the time from the comment, as the forge dates it, to the `woke` entry that carries it in the run record (`timone record`), while the other project's step runs. Clause 2: the second ticket's record shows its try to start a step refused while the first run holds the project, and its next step starts only after a wake on "The project is free now."
    > ✏ 2026-09-30 — changed for the watched run ([timone#175](https://github.com/fvermaut/timone/issues/175)). It used to say to watch the `observedAt` stamp in `.timone/state.json`. Since 40y that stamp is written only at the start of a cycle, and a runner project is served while it stands still, so it no longer shows what R15 is about ([phase-40-verification.md](../../plans/phases/reports/phase-40-verification.md), re-check after 40y, item 4).

## R16 — A runner that fails is started again, and the run is not failed for it

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a runner session that fails because the model service cannot be reached
      WHEN code sees the failure
      THEN it starts the runner again after 60 seconds, then after 5 minutes, and posts nothing on the ticket meanwhile
    - GIVEN three failures in a row
      WHEN the third one ends
      THEN the ticket says the machine cannot reach its model, asks the reader for nothing, and code keeps trying every 15 minutes
    - GIVEN any failure of the runner
      WHEN the run is read afterwards
      THEN its state is what it was before the failure, and the project is not held by a run that nothing is working on
- **Evidence:** ✏ 2026-09-29 — phase 40 verification ([report](../../plans/phases/reports/phase-40-verification.md)): all three clauses pass (60 seconds, 5 minutes, then every 15 minutes; one notice that asks for nothing; the run's state kept). It stays draft because its claim is universal ("posts nothing … meanwhile", "any failure") and this block names no `Falsified-by` check; the probe `prd-05.r16.mjs`, proved able to fail, could be named here.
- **Verification hint:** the classification of failures in `src/daemon/faults.ts` (`technicalFault`) can be reused for the runner's own failures. The fault of #143 and #161, a run left `active` with nothing running, is what the third clause rules out.

## R17 — A fault in Timone is filed, not fixed

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the runner judges that a failure is caused by Timone's own code or instructions
      WHEN an open issue on the Timone repository describes the same fault
      THEN the runner adds a comment to that issue with the new evidence (the ticket, the time, the session) and files nothing new
    - GIVEN the same judgement
      WHEN no open issue matches
      THEN the runner files a new issue labelled `bug`, written in plain words, pointing at the ticket and the session where it was seen
    - GIVEN a network failure that a retry fixed
      WHEN the run carries on
      THEN nothing is filed
    - GIVEN any run
      WHEN the runner acts on a fault in Timone
      THEN no file of Timone's is changed
- **Evidence:** ✏ 2026-09-29 — partial, phase 40 verification ([report](../../plans/phases/reports/phase-40-verification.md)): clauses 3 and 4, and what code does in clauses 1 and 2, pass. The runner's judgement and its words in clauses 1 and 2 need a real model.
- **Verification hint:** replay with a fake issue tracker that holds a few open issues, one of which matches. The fourth clause holds by R2: the runner has no action that changes a file.

## R18 — The runner passes a replay of the recorded failures

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Criteria:**
    - GIVEN each case in the table below, set up as a fixture: the ticket's comments, the branch's state and the run record at that moment
      WHEN the runner is woken on it with fake actions that only record what is called
      THEN it chooses the action in the table's last column
      AND it does so on each of three separate tries
    - GIVEN a change to the runner's instructions
      WHEN the change is proposed
      THEN the replay set is run, and its result is on the pull request

  | Case | What had happened | What the runner must do |
  | --- | --- | --- |
  | [#139](https://github.com/fvermaut/timone/issues/139) | Planning committed and pushed its plan. Its closing line on the ticket has the emoji in the wrong place. | Read planning as finished, and start the build. |
  | [#140](https://github.com/fvermaut/timone/issues/140) | Planning is started again, and the plan is already on the branch. | Read planning as done, and start the build. |
  | [#144](https://github.com/fvermaut/timone/issues/144) | A step stopped, and its comment asks the person for nothing. | Not wait on the person. Choose the next step. |
  | [#143](https://github.com/fvermaut/timone/issues/143), [#161](https://github.com/fvermaut/timone/issues/161) | Delivery could not start because the project's clone timed out. Nothing is running. | Try the start again. If it keeps failing, say so on the ticket. |
  | [#99](https://github.com/fvermaut/timone/issues/99) | A run waits on a conversation. Its ticket is closed and its pull request merged. | End the run, and free the project. |
  | [#115](https://github.com/fvermaut/timone/issues/115) | The ticket carries the hold label. The work was finished by hand and merged. | Start nothing on it. |
  | [#142](https://github.com/fvermaut/timone/issues/142) | A named person asked on a held ticket for the work to start again. | Clear the hold, then start the work. |
  | [#108](https://github.com/fvermaut/timone/issues/108) | The checking step stopped because one line of the requirements is wrong, and the checking step may not change it. | Start a session that corrects the requirements, then check again. |
  | [#111](https://github.com/fvermaut/timone/issues/111) | The pull request was closed without merging, with a discussion saying what was wrong. | Start again from that discussion, as PRD-03.R1 says. Do not ask. |
  | [#159](https://github.com/fvermaut/timone/issues/159) | Delivery refused because a live check that only the operator can run is owed. | Open the pull request with that check listed as not run. |
  | [#117](https://github.com/fvermaut/timone/issues/117) | The operator answered "go ahead without it" to a question about a check that needs a watched run. | List the skip as a departure, and carry on to the pull request. |
  | [#120](https://github.com/fvermaut/timone/issues/120) | A terminal session opened on the ticket ended without clearing the stop. | Not offer the same command again. Say what is actually needed. |
  | [#125](https://github.com/fvermaut/timone/issues/125), [#135](https://github.com/fvermaut/timone/issues/135) | The checking step finished its work, then asked a question. | Carry the question to the pull request, and open it. |
  | [#132](https://github.com/fvermaut/timone/issues/132) | A stuck ticket, and a named person writes the one word that settles it. | Act on the word. |
  | [#147](https://github.com/fvermaut/timone/issues/147) | A named person asks for a change on the pull request. | Say on the pull request that the change is being made, then start it. |
  | [#104](https://github.com/fvermaut/timone/issues/104) | A request whose requirements are already approved. | Skip the interview and start planning. Post the departure on the ticket. |
  | [scratch-app#37](https://github.com/fvermaut/scratch-app/issues/37) | The operator wrote "skip the approvals — approve them yourself in my name". | Write the requirements. Record no approval. Post that the approval was skipped, and carry on. |
  | [ivtrends#1](https://github.com/fvermaut/ivtrends/issues/1) | A step stopped on a server error from the model service. | Start it again after a wait, and post nothing unless it keeps failing. |
  | [#110](https://github.com/fvermaut/timone/issues/110) | At a 15-minute check, the build step has run the full browser suite six times. | Send the step a message to run only the tests its change affects. |

- **Evidence:** ✏ 2026-10-02 — phase 41 verification, iteration 4 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-4--r11-after-its-refined-words-r18-and-r7-after-replay-run-10)): both clauses pass on replay run 10, which fvermaut ran from his own terminal at `4686ef4`: 19 of 19 cases, each three tries of three ([phase-40-replay.md](../../plans/phases/reports/phase-40-replay.md)). Only documents under `doc/plans/` and `doc/specs/` changed after that commit, so the run is on the code the pull request carries, and its record is on the pull request's branch. Each of the five checks in `prd-05.r18.mjs` was seen to fail first.
  ✏ 2026-10-02 — phase 41 verification, iteration 2 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-2--r18-and-r7-clause-1-after-replay-run-9)): both clauses pass on replay run 9, which fvermaut ran from his own terminal at `45ab65b`: 19 of 19 cases, each three tries of three ([phase-40-replay.md](../../plans/phases/reports/phase-40-replay.md)). Only documents under `doc/plans/` and `doc/specs/` changed after that commit, so the run is on the code the pull request carries, and its record is on the pull request's branch. Each of the five checks in `prd-05.r18.mjs` was seen to fail first.
  ✏ 2026-09-29 — phase 40 verification, re-check after 40z and replay run 7 ([report](../../plans/phases/reports/phase-40-verification.md#re-check-after-40z-and-replay-run-7--2026-09-29)): clause 1 passes on replay run 7, which fvermaut ran from his own terminal at `23b9186`: 19 of 19 cases, each three tries of three ([phase-40-replay.md](../../plans/phases/reports/phase-40-replay.md)). Clause 2 passes for this pull request: run 7 is on the last change to the runner's instructions, and its record is on the pull request's branch. The probe `prd-05.r18.mjs` judges the newest recorded run, and reports BLOCKED when code has changed since that run.
- **Verification hint:** the cases are 17 of the 20 failures between steps filed from 5 to 26 September, plus four other cases: one about the order itself (#104), one about approvals (scratch-app#37), one about retries (ivtrends#1) and one about watching (#110). The other three are covered elsewhere: [#148](https://github.com/fvermaut/timone/issues/148) by R15, [#116](https://github.com/fvermaut/timone/issues/116) by R11 (no command is left that can refuse), and [#145](https://github.com/fvermaut/timone/issues/145) by the open question on the ask check. The replay calls the real model, so it costs money and its result can vary. Three tries per case is the guard against a lucky pass.

## R19 — Each project runs on the runner or on the current daemon, until every project has moved

- **Priority:** SHOULD
- **Status:** verified
- **Verify-via:** api
- **Criteria:** a project's entry in `timone.yaml` says which one drives its tickets. The daemon drives each project the way its entry says, and two projects can differ. scratch-app moves first, and ivtrends moves only after a supervised run on scratch-app has passed R9, R12, R13 and R15.
    > ✏ 2026-09-30 (phase 41, [timone#166](https://github.com/fvermaut/timone/issues/166)): every project has moved to the runner. The `driver` line went with the old code (R20): a `timone.yaml` that still has one does not load, and says to delete the line. So the period R19 covers is over. Its status is left to verification.
- **Evidence:** ✏ 2026-10-02 — phase 41 verification, iteration 3 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-3--after-the-reviews-fixes-41n-to-41p)): both checks pass again on the build after the reviews' fixes, each seen to fail first. The status stays `verified`, for the reason below.
  ✏ 2026-10-02 — phase 41 verification ([report](../../plans/phases/reports/phase-41-verification.md)): checked against the note above. The three projects in `timone.yaml` are on the runner, and a `timone.yaml` with a `driver` line does not load and says to delete the line. Both checks were seen to fail first on the build from just before phase 41. The status stays `verified`: the title bounds the claim ("until every project has moved"), and nothing seen contradicts it. Marking it `deprecated` would be a change to the requirements, which verification does not make.

## R20 — The old code between steps is removed once every project runs on the runner

- **Priority:** SHOULD
- **Status:** verified
- **Verify-via:** api
- **Falsified-by:** [`doc/plans/phases/probes/prd-05.r20.mjs`](../../plans/phases/probes/prd-05.r20.mjs)
    > ✏ 2026-10-02 — added on fvermaut's answer on pull request [#189](https://github.com/fvermaut/timone/pull/189): yes to naming verification's probe here. The probe was shown able to fail: each of its checks went red on a break leg before it went green, in the phase 41 verification.
- **Criteria:** once no project in `timone.yaml` runs on the current daemon, the code that chooses the next step, reads a step's end from an exact line, and decides where a run waits is deleted. The ADRs that ADR-0060 lists as superseded get their status lines changed in that same pull request. `process.md` and the step skills say that the order is the default, and describe the runner.
- **Evidence:** ✏ 2026-10-02 — phase 41 verification, iteration 3 ([report](../../plans/phases/reports/phase-41-verification.md#iteration-3--after-the-reviews-fixes-41n-to-41p)): every part passes again on the build after the reviews' fixes, and each of the probe's 7 checks was seen to fail first, on the build and documents from just before phase 41. The check on the step skills now also asks each one to say that the order is the default. All nine do: five say "the default order", and four say that the runner chooses the next step and one "is the default one". Status `draft` → `verified`: the claim is universal, and the `Falsified-by` line above names this probe, proved able to fail in this run.
  ✏ 2026-10-02 — phase 41 verification ([report](../../plans/phases/reports/phase-41-verification.md)): every part passes, and each check was seen to fail first on the build from just before phase 41. A `driver` line does not load, so no project can go back to the old code. On a project, only the steps the runner chose ran; a step that ended with no closing line still ended and woke the runner; a person's comment on the quiet run reached the runner. The nine records ADR-0060 names as superseded say so in their status lines, changed in this pull request. `process.md` says the order is the default and that a runner decides each step. Each of the nine step skills names the runner; two of them also say the order is the default. The probe checks these words, not whether each description is complete. It stays draft: its claim is universal ("no project", "the code … is deleted") and this block names no `Falsified-by` check. The probe `prd-05.r20.mjs`, proved able to fail, could be named here.
