# PRD-12: An approval counts while the files it approves are unchanged, and a terminal session's work becomes the run's

> **Status:** Active (approved by fvermaut at 2026-10-08T09:08:18Z)
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-12-an-approval-counts-while-its-files-are-unchanged.criteria.md](prd-12-an-approval-counts-while-its-files-are-unchanged.criteria.md)
> **Phases:** none yet

## Problem

A named person approves the requirements, and later the list of pieces, by writing a comment on the ticket. The runner records that approval by naming the comment ([PRD-05.R7](prd-05-a-runner-decides-each-step.criteria.md#r7--the-runner-never-records-an-approval-nobody-gave)). Today `record_approval` in `src/runner/actions.ts` accepts the comment only if it was written after the last step that wrote the approved files ended. It does not look at whether that step changed anything. So a person who has already approved is asked to approve again, three times on record:

- **[ivtrends#143](https://github.com/fvermaut/ivtrends/issues/143)**, 2026-09-30 ([timone#183](https://github.com/fvermaut/timone/issues/183)). A terminal session (a takeover) talked the questions through with fvermaut and pushed PRD-12 and ADR-0047 to a branch. It handed back saying "you approved the result" and "What I need from you: nothing now". The run did not know that branch, and no approval was on the ticket, so the runner asked again. fvermaut wrote "approve" at 18:59:38Z. The runner could not record it: the run had no branch. It started the requirements step only to take up the branch. That step changed nothing, but it ended after the comment, so the approval was refused. fvermaut had to approve a third time.
- **[timone#197](https://github.com/fvermaut/timone/issues/197)**, 2026-10-03 ([timone#198](https://github.com/fvermaut/timone/issues/198)). fvermaut answered two open questions and approved the rest in one comment. The requirements step wrote his answers in. The approval was then refused, because the comment is older than that step. The runner had told him it would record his approval once the file was updated. That was not true.
- **The list of pieces after a failed merge** (item 1 of [timone#176](https://github.com/fvermaut/timone/issues/176); finding 11 of the [phase 40 delivery report](../../plans/phases/reports/phase-40-delivery.md)). When the merge into the default branch fails after the approval, the only way to try again is to record the approval again. The session that wrote the approval into the file ended after the comment, so the comment is refused, and the person must approve the same list a second time.

fvermaut asked on 2026-10-07 that one fix cover all three, and that #198 close with #183. He answered three questions in a terminal session, and accepted this summary on 2026-10-08:

1. An approval counts as long as the approved files have not changed since it was written. If one comment gives answers and the approval, the answers are written in and the approval recorded together. The same holds for the list of pieces.
2. An approval is always a comment on the ticket. A terminal session asks for it before it ends and never says "nothing needed" while one is missing.
3. Work a terminal session pushes to the run's branch becomes the run's when it ends.

The words **Approval** and **Takeover** in [CONTEXT.md](../../../CONTEXT.md) carry these answers (commit `0b51657`).

Source: the ticket, its thread, #198, #176, the three answers above, the code of `record_approval` and `closeChunkZero` in `src/runner/actions.ts`, and `takeoverPrompt` in `src/daemon/prompts.ts`. The requirements were not written in the terminal session on purpose: the run could not have seen that branch, which is this same fault.

## Goals

- A person approves each version of the requirements, and each version of the list of pieces, once.
- What the machine tells a person is true: it never says nothing is needed while an approval is missing, and it never says it will record an approval that the rules will refuse.
- Work done in a terminal session is visible to the run, so the runner decides from what is really on the branch.
- The safeguard of PRD-05.R7 stays whole: no comment approves files that did not exist when it was written, and no approval is recorded that a named person did not give in a comment.

These serve the product's goal that a run moves on its own between the moments a person must decide, and that a person is asked only what they have not already answered.

## Scope

### In scope

**An approval counts while the approved files are unchanged** (R1). A named person's comment approves the files as they were on the run's branch when the comment was written. The runner can record it as long as those files are the same now. A step that ran on them and changed nothing does not void it. Writing that same approval into the file does not void it either. Any other change does, and the refusal says which file changed, so the runner asks for approval of the files as they are now. A comment written before the files existed on the run's branch approves nothing, as today: this is what keeps the case of scratch-app#37 refused. The rule holds for the requirements and for the list of pieces alike. It extends PRD-05.R7 clause 2: an approval still names a named person's comment, and that comment must now also have seen the files it approves.

**One comment can give answers and the approval** (R2). When a named person's comment answers open questions and approves, the runner starts the step that writes those answers in, tied to that comment. When the step ends, the approval from that same comment is recorded, with no second comment. Only the step tied to that comment opens this exception. A change made by any other step after the comment voids it, as R1 says.

**Trying a failed merge again needs no new approval** (R3). When the list of pieces was approved and its merge into the default branch failed, a named person's "try again" retries the merge on the approval already given. The merge, and what the record writes down about it, name the comment that gave the approval, not the "try again" comment. It extends PRD-05.R3 clause 3 and PRD-05.R9 clause 2.

**A terminal session never takes an approval** (R4). It tells the person that words said at the keyboard are not an approval. When the requirements or the list of pieces are written and not approved when it ends, its closing comment asks a named person to approve them on the ticket. It never says that nothing is needed while an approval is missing, and it never marks a file approved. This is what the session is told, and it is checked on the instructions code gives it.

**A terminal session's work becomes the run's** (R5). A terminal session on a run with no branch is told the branch the run will use. When the session ends, a branch it pushed under that name becomes the run's branch. The runner then sees the branch, and the requirements files on it with their status, as it does after a step. An approval a named person writes on the ticket after the session can then be recorded at once, with no step started only to take up the branch. It extends PRD-05.R11 clause 2, which says the runner reads what a terminal session left.

**The runner is told the new rule, and the replay holds it** (R6). The runner's instructions and the description of `record_approval` say when an approval counts. Two new cases join the replay of PRD-05.R18: the hand-back of ivtrends#143, and the comment of timone#197 that gave answers and the approval.

**One supervised run shows it** (R7): a terminal session writes the requirements on a real ticket and ends; a named person approves on the ticket once; the runner records that approval and goes on to the list of pieces with no second request.

Nothing here puts anything on a screen that Timone draws, so this PRD carries no accessibility criteria.

### Out of scope

- **An approval given in the terminal.** It is never recorded, by the session or by the runner. fvermaut's second answer settles this: an approval is always a comment on the ticket.
- **Work a terminal session pushes to a branch other than the one it was told.** It does not become the run's. The session is told the name, and the closing comment says where the work is if it went elsewhere.
- **Counting a terminal session as the requirements step.** The run record still shows that no requirements step ran, and the pull request lists that as a departure (PRD-05.R5). The departure is true: the requirements were written at the keyboard, not by a step.
- **Who may approve.** It stays a named person (PRD-05.R10). Nothing here widens it.
- **The old daemon's approval path** (`src/daemon/`), which item 4 of #176 names. Every project now runs on the runner (PRD-05.R20).
- **The other items of #176.** Only item 1 is in this PRD.

## Open Questions

The thread settles what is wanted. Three points it does not name are written here as the plainest reading. Any of them can change when the requirements are approved.

- **What "the approved files" are** (R1). For the requirements: the narrative and the criteria file of each PRD the run's branch adds or changes. For the list of pieces: the breakdown file the run's branch adds. A requirements file and an ADR are not the same thing; an ADR changed after the comment does not void an approval of the requirements.
- **How a step is tied to the comment whose answers it writes in** (R2). The register asks only that the tie be in the run record and name the comment, so that code, not the runner's judgement, decides the exception. How the runner sets it is a choice for the plan.
- **R6 is a SHOULD.** The thread does not ask for replay cases. They are how PRD-05.R18 keeps the runner from repeating a recorded failure, and both failures here came partly from the runner's own words, so they are proposed, not required.
