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
- **Verification hint:** the replay set of R18 carries both cases as fixtures. For the third clause, read the seam: `stageAfter` and the `next` fields of `STAGES` in `src/daemon/pipeline.ts` are no longer called to choose a session. The default order may still exist as data given to the runner.

## R2 — The runner acts only through the actions code gives it

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that lists the tools a runner session is started with and fails on any tool not in the list below
- **Criteria:**
    - GIVEN a runner session
      WHEN its tools are listed
      THEN they are exactly: start a step session with instructions, send a running step a message, stop a step, post on the ticket or the pull request, set or clear the hold on a ticket, file or update a Timone issue, and end the run
      AND none of them edits a file, runs a shell command, pushes, or merges
    - GIVEN the runner decides that something in the project must be fixed
      WHEN it acts
      THEN it starts a step session with instructions, and every commit that follows carries that session's `Timone-Stage` trailer
- **Verification hint:** the runner is started through the Agent SDK with an explicit tool list and no built-in file or shell tools. The test reads that list from the code that starts the runner.

## R3 — Nothing reaches a default branch without a yes from a named person

- **Priority:** MUST
- **Status:** draft
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
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that asks to end a run whose branch has commits not on the default branch and not in an open pull request, and fails if the run ends
- **Criteria:**
    - GIVEN a run whose branch has commits that are not on the default branch
      WHEN the runner asks to end the run with no open pull request for that branch
      THEN code refuses and tells the runner why
    - GIVEN the same run
      WHEN a named person cancels it with `timone cancel`
      THEN the run ends, and no pull request is required
    - GIVEN a run that changed no files, such as a question or a decision ticket
      WHEN the runner ends it
      THEN it ends on the ticket, with no pull request
- **Verification hint:** the check sits in the code behind the "end the run" action, not in the runner's instructions.

## R5 — Code lists every departure on the pull request, and a skipped check comes first

- **Priority:** MUST
- **Status:** draft
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
- **Verification hint:** replay the #104 fixture of R18 with fake actions, and check that the "post on the ticket" call comes before the "start a step" call.

## R7 — The runner never records an approval nobody gave

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** a test that asks every path that writes an approval to do so with no comment from a named person, and fails if any of them writes it
- **Criteria:**
    - GIVEN the operator writes "skip the approvals — approve them yourself in my name" (the case of [scratch-app#37](https://github.com/fvermaut/scratch-app/issues/37))
      WHEN the runner acts on it
      THEN it writes the requirements, records no approval in anyone's name, posts that the approval was skipped, and carries on toward the pull request
    - GIVEN any artifact that records an approval (a requirements file marked `Active`, a list of pieces marked approved)
      WHEN that approval is written
      THEN it names a comment by a named person that gave it
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
- **Verification hint:** each session already reports `total_cost_usd` (`src/daemon/progress.ts`). The count belongs to the ticket, not to one run, so a ticket with several runs adds them all up.

## R9 — Plain words from a named person move the run

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
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
- **Status:** draft
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
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the runner cannot start, for example because the model service cannot be reached
      WHEN the operator runs `timone cancel <ticket>`
      THEN the run stops, any running session is stopped, and the project is free for the next ticket
    - GIVEN any run
      WHEN the operator runs `timone takeover <ticket>`
      THEN a terminal session opens on that ticket, and when it ends the runner wakes and reads what it left
    - GIVEN the command line
      WHEN `timone retry` is typed
      THEN it does not exist, and the message says to write on the ticket instead
- **Verification hint:** `src/commands/cancel.ts` must not start or wait for a runner. The takeover case replaces the handback note of ADR-0035: the runner reads the session's closing comment in plain words.

## R12 — The runner wakes on events, and checks every 15 minutes while a step runs

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Criteria:**
    - GIVEN a run
      WHEN a step ends, a step fails, a step is silent for longer than its limit, or a named person comments
      THEN the runner wakes within one polling cycle
    - GIVEN a step that has been running for 15 minutes since it started or since the last check
      WHEN the check falls due
      THEN the runner wakes with a summary written by code: the commands the step ran since the last check, the time taken and the cost
      AND the summary is short enough to read in one page, and is not the step's full session
- **Verification hint:** the step's output is already read live (`src/daemon/progress.ts`, `src/daemon/transcript.ts`). The summary can be built from the same stream. The api part of this (the summary is built correctly from a recorded stream) can be tested on a stored session from `.timone/sessions/`.

## R13 — The runner can send a running step a message, or stop it

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
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
- **Verification hint:** the record is written by code, never by the runner, because R5 and R8 are computed from it. The runner's reasons are stored as the runner gave them.

## R15 — One project's work no longer holds up the others

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Criteria:**
    - GIVEN a step running on one project
      WHEN a named person comments on a ticket of another project
      THEN that project's runner wakes within one polling cycle, and does not wait for the first project's step to end
    - GIVEN two tickets on the same project
      WHEN both are ready
      THEN only one runs at a time, as today
- **Verification hint:** this is [#148](https://github.com/fvermaut/timone/issues/148). Measure it as #148 did: the `observedAt` stamp in `.timone/state.json` must keep moving while a session runs.

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
- **Verification hint:** replay with a fake issue tracker that holds a few open issues, one of which matches. The fourth clause holds by R2: the runner has no action that changes a file.

## R18 — The runner passes a replay of the recorded failures

- **Priority:** MUST
- **Status:** draft
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

- **Verification hint:** the cases are 17 of the 20 failures between steps filed from 5 to 26 September, plus four other cases: one about the order itself (#104), one about approvals (scratch-app#37), one about retries (ivtrends#1) and one about watching (#110). The other three are covered elsewhere: [#148](https://github.com/fvermaut/timone/issues/148) by R15, [#116](https://github.com/fvermaut/timone/issues/116) by R11 (no command is left that can refuse), and [#145](https://github.com/fvermaut/timone/issues/145) by the open question on the ask check. The replay calls the real model, so it costs money and its result can vary. Three tries per case is the guard against a lucky pass.

## R19 — Each project runs on the runner or on the current daemon, until every project has moved

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** a project's entry in `timone.yaml` says which one drives its tickets. The daemon drives each project the way its entry says, and two projects can differ. scratch-app moves first, and ivtrends moves only after a supervised run on scratch-app has passed R9, R12, R13 and R15.

## R20 — The old code between steps is removed once every project runs on the runner

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** once no project in `timone.yaml` runs on the current daemon, the code that chooses the next step, reads a step's end from an exact line, and decides where a run waits is deleted. The ADRs that ADR-0060 lists as superseded get their status lines changed in that same pull request. `process.md` and the step skills say that the order is the default, and describe the runner.
