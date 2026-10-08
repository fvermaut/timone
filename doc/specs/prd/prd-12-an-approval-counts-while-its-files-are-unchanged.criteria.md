# PRD-12 Acceptance Criteria — An approval counts while the files it approves are unchanged, and a terminal session's work becomes the run's

> Formal register for [prd-12-an-approval-counts-while-its-files-are-unchanged.md](prd-12-an-approval-counts-while-its-files-are-unchanged.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

In this register:

- **An approval** is a named person's comment on the ticket that approves the requirements or the list of pieces ([CONTEXT.md](../../../CONTEXT.md), *Approval*). **Recording it** is a call to `record_approval` that is accepted and writes an `approval` entry to the run record.
- **The approved files** are, for the requirements, the narrative and the criteria file of each PRD the run's branch adds or changes; for the list of pieces, the breakdown file the run's branch adds.
- **The files as they were when the comment was written** are their contents on the run's branch at the last commit pushed before the comment's time.
- **Changed** means their contents differ. Writing the approval being recorded into them (the `Status:` and `Approved by:` lines, or the list's approval line) is not a change.
- **A terminal session** is a session opened by `timone takeover`.

No requirement here puts anything on a screen that Timone draws, so no accessibility criteria apply.

## R1 — An approval counts while the approved files are unchanged since the comment

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Extends:** [PRD-05.R7](prd-05-a-runner-decides-each-step.criteria.md#r7--the-runner-never-records-an-approval-nobody-gave) clause 2
- **Falsified-by:** a test of `recordApproval` in `src/runner/actions.test.ts`, one per clause, each seen to fail on today's code where today's code differs, which goes red when the check compares the comment with a step's end instead of with the files.
- **Criteria:**
    - GIVEN the requirements on the run's branch, a named person's comment that approves them, and then a requirements step that ends after the comment and leaves the approved files unchanged (the case of ivtrends#143)
      WHEN the runner records the approval, naming that comment
      THEN it is accepted, and the `approval` entry names that comment
    - GIVEN the same, with the list of pieces and a breakdown step that leaves the breakdown file unchanged
      WHEN the runner records the approval of the list of pieces, naming that comment
      THEN it is accepted
    - GIVEN a named person's comment that approves the requirements, and then a step that changes one of the approved files, other than as R2 allows
      WHEN the runner records the approval, naming that comment
      THEN it is refused, nothing is written to the run record or the files, and the refusal names the file that changed and says to ask for approval of the files as they are now
    - GIVEN a named person's comment written before any of the approved files existed on the run's branch (the case of [scratch-app#37](https://github.com/fvermaut/scratch-app/issues/37))
      WHEN the runner records the approval, naming that comment
      THEN it is refused, as today
    - GIVEN a comment that is not a named person's
      WHEN the runner records the approval, naming it
      THEN it is refused, as today
- **Verification hint:** today's check is the `finished` comparison in `recordApproval`, `src/runner/actions.ts`, which takes the end of the last `step-ended` entry of the approved stage and refuses any comment at or before it. The existing test "refuses a named person's comment written before the requirements step ended as their approval" in `src/runner/actions.test.ts` is the one whose case changes; the scratch-app#37 test must keep passing. Build a branch with a fixture remote, add a run record with a step that ended after the comment, and compare the files with `git show <commit>:<path>`.

## R2 — One comment can give answers and the approval

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Extends:** [PRD-05.R7](prd-05-a-runner-decides-each-step.criteria.md#r7--the-runner-never-records-an-approval-nobody-gave) clause 2
- **Criteria:**
    - GIVEN a named person's comment that answers open questions and approves the requirements (the case of [timone#197](https://github.com/fvermaut/timone/issues/197), [timone#198](https://github.com/fvermaut/timone/issues/198))
      WHEN the runner starts the requirements step to write those answers in
      THEN the run record ties that step to that comment, by the comment's time
    - GIVEN that step ends and changed the approved files, and no other step changed them after the comment
      WHEN the runner records the approval, naming that comment
      THEN it is accepted, and no second comment from the person is needed
    - GIVEN that step, and then another requirements step not tied to the comment that changes the approved files
      WHEN the runner records the approval, naming that comment
      THEN it is refused, as R1 clause 3 says
    - GIVEN a requirements step tied to one named person's comment
      WHEN the runner records an approval naming a different, earlier comment
      THEN the tie does not apply to it, and R1 alone decides
- **Verification hint:** a step is started by `startStep` in `src/runner/actions.ts`, from `start_step` in `src/runner/tools.ts`, whose input today names no comment. The test writes the step's start and end to the run record with the tie, changes the criteria file between them, and calls `recordApproval`.

## R3 — Trying a failed merge of the list of pieces again needs no new approval

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Extends:** [PRD-05.R3](prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person) clause 3, [PRD-05.R9](prd-05-a-runner-decides-each-step.criteria.md#r9--plain-words-from-a-named-person-move-the-run) clause 2
- **Falsified-by:** a test in `src/runner/actions.test.ts` where the merge fails once and then succeeds after a named person's reply, which goes red when the second try asks for or records a new approval.
- **Criteria:**
    - GIVEN a named person approved the list of pieces in a comment, the approval was recorded and written into the file, and the merge into the default branch then failed (item 1 of [timone#176](https://github.com/fvermaut/timone/issues/176))
      WHEN a named person writes "try again" and the runner acts on it
      THEN the merge is tried again on the approval already recorded, and no new approval is asked for on the ticket
    - GIVEN that second try succeeds
      WHEN the record's `chunk-zero-merged` decision is read
      THEN it names the comment that gave the approval, not the "try again" comment
    - GIVEN the same, but the breakdown file changed after the approval's comment, other than by writing that approval in
      WHEN the runner tries the merge again
      THEN nothing is merged, and the refusal says the list changed since it was approved
- **Verification hint:** the merge is `closeChunkZero` in `src/runner/actions.ts`, run after the session that writes the approval into the file; its failure is `piecesNotActedOn`. Finding 11 of `doc/plans/phases/reports/phase-40-delivery.md` names the paths and suggests the test. Fail the first merge with a fixture remote whose default branch has a clashing commit, remove the clash, then retry.

## R4 — A terminal session asks for the approval on the ticket, and never takes one

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Extends:** [PRD-05.R7](prd-05-a-runner-decides-each-step.criteria.md#r7--the-runner-never-records-an-approval-nobody-gave), [PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes) clause 2
- **Falsified-by:** a test of `takeoverPrompt` in `src/daemon/prompts.test.ts`, one per clause, which goes red when a sentence is removed.
- **Criteria:**
    - GIVEN any run
      WHEN the instructions of a terminal session are built
      THEN they say that words said in the session are not an approval, and that an approval is a named person's comment on the ticket
    - GIVEN any run
      WHEN the instructions of a terminal session are built
      THEN they say that when the requirements or the list of pieces are written and not approved as the session ends, its closing comment asks a named person to approve them on the ticket, and does not say that nothing is needed
    - GIVEN any run
      WHEN the instructions of a terminal session are built
      THEN they say not to mark a requirements file `Active` or a list of pieces approved
- **Verification hint:** `takeoverPrompt` in `src/daemon/prompts.ts`; today it says to post "what you did and what should happen next" and says nothing about approvals. R7 checks the session's behaviour on a real ticket.

## R5 — Work a terminal session pushes to the run's branch becomes the run's

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Extends:** [PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes) clause 2
- **Falsified-by:** a test of the takeover's end in `src/runner/driver.test.ts` or `src/commands/takeover.test.ts`, which goes red when the run still holds no branch after the session pushed one.
- **Criteria:**
    - GIVEN a run with no branch
      WHEN a terminal session opens on it
      THEN its instructions name the branch the run will use, the same name a step of the run would be given, and say that work pushed there becomes the run's
    - GIVEN a run with no branch, and a terminal session that pushed commits to that branch
      WHEN the session ends and the runner wakes
      THEN the run holds that branch, and the runner's facts show it, with the requirements files it adds and their `Status:` lines
    - GIVEN a run with no branch, and a terminal session that pushed nothing to that branch
      WHEN the session ends
      THEN the run still holds no branch
    - GIVEN a terminal session wrote the requirements on the run's branch and ended, and a named person then wrote an approval on the ticket (the case of ivtrends#143)
      WHEN the runner records that approval, naming the comment
      THEN it is accepted, with no step started in between
- **Verification hint:** a run's branch is `run.branch`; `takeoverPrompt` prints "none — it holds no branch" today. The runner is told the session ended by `TAKEOVER_ENDED_EVENT` in `src/runner/driver.ts`, and its facts are read by `src/runner/facts.ts`, which reads the default branch when the run has none. Use a fixture remote: push to the branch as the session would, end the session, and read the run and the facts.

## R6 — The runner is told the rule, and the replay holds it

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Extends:** [PRD-05.R18](prd-05-a-runner-decides-each-step.criteria.md#r18--the-runner-passes-a-replay-of-the-recorded-failures)
- **Criteria:** the runner's instructions and the description of `record_approval` say that an approval counts while the approved files are unchanged since the comment, and that a comment giving answers and the approval is recorded once the step tied to it has written the answers in. Two cases join the replay set of PRD-05.R18 and pass on three tries of three: [ivtrends#143](https://github.com/fvermaut/ivtrends/issues/143), where after a terminal session's hand-back a named person approves on the ticket and the runner records that approval without starting a step; and [timone#197](https://github.com/fvermaut/timone/issues/197), where one comment answers and approves and the runner starts the requirements step tied to it, then records the approval from that comment.
- **Verification hint:** the cases are in `src/runner/replay/cases.ts`; the tool's description is in `src/runner/tools.ts`.

## R7 — One supervised run shows the whole path

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Criteria:**
    - GIVEN a feature ticket on scratch-app whose run has no branch, and a terminal session opened on it with `timone takeover`
      WHEN the session writes the requirements on the branch it was told, the person says "approve" at the keyboard, and the session ends
      THEN the session's closing comment asks for the approval on the ticket and does not say nothing is needed, and no approval is recorded
    - GIVEN that run, after the session ended
      WHEN a named person writes one approval on the ticket
      THEN the runner records it naming that comment, and goes on to the list of pieces with no second request for approval
- **Verification hint:** a supervised run against a real daemon and the real forge, as the live gates of PRD-05 are run. Read the run record for the `approval` entry, and the ticket's thread for the closing comment and for any second request.
