# Phase 63: The step that writes a file for approval asks for it — the requirements step and the step that works out the pieces end their comment by asking for the approval the run waits on

> **Status:** Complete — see [reports/phase-63-complete.md](reports/phase-63-complete.md).

> **Companion phases:** [phase 45](phase-45.md) — last to edit the breakdown prompt (the `Needs:` and `**Order:**` lines); this phase changes the closing paragraph of the same prompt and leaves those lines alone. [Phase 23](phase-23.md) (23b) and [phase 12](phase-12.md) (12e) wrote the two paragraphs this phase replaces, at a time when code between steps posted the approval request. Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), because it removed that code and gave the runner only a rule to correct a newest comment that is false; [ADR-0014](../../adr/0014-artifact-first-gates.md), because the approval is asked against the committed file, so the comment links it.

> **Screens changed:** none — the change is in the text of two step prompts; no slice changes anything a person sees on a screen Timone draws.

## Requirements

**Un-anchored chore work (agreed 2026-10-18, fvermaut, in a terminal session: "fix timone#209"):** the instructions of the requirements step and of the step that works out the pieces say "the machinery posts the approval request itself, immediately after yours" and tell the step not to ask. That code was removed with the old code between steps (ADR-0060). So each step ends its comment with "What I need from you: nothing", while the run waits for an approval, and the runner then posts a second comment to correct it. [timone#209](https://github.com/fvermaut/timone/issues/209) records it more than 30 times since 2026-10-04, on ivtrends and on timone. The machine classified the ticket as a chore on the ticket itself (no triage record was committed). No requirement says who asks for the approval: [PRD-02.R4](../../specs/prd/prd-02-inversion-of-control.criteria.md#r4--prd-gate-on-the-ticket) says a summary is posted and the run waits, and `process.md` (*Gates, conversations and the human*) says a step that stops asks on its closing line for what it waits on. This phase makes the two prompts agree with that line. It claims no requirement.

## Goal Description

**What is wrong.** `requirementsPrompt` (`src/daemon/prompts.ts`, the paragraph starting "Then post one comment on the ticket summarizing") and `breakdownPrompt` (the paragraph starting "Then post one comment on the ticket describing") each say: do not ask them to approve it, the machinery posts the approval request itself. Nothing posts it now. The step obeys, ends with "nothing", and the newest comment on the ticket is false until the runner's next wake. The runner's rule in `src/runner/brief.ts` ("The newest comment on the ticket must say truthfully what the ticket needs now") is what has been posting the second comment every time. The person reads two comments, and the first one is wrong.

**What this phase builds.** Both prompts tell the step that the run now waits for an approval and that its own comment is what asks for it. The comment links the file on the branch, because the person approves the committed file. It ends with a fixed closing line, given word for word in the prompt:

- requirements: `**What I need from you:** read the requirements and reply "approved", or say what to change.`
- list of pieces: `**What I need from you:** read the list of pieces and reply "approved", or say what to change.`

The existing rule in `writingBlock` already puts the sentence that names `timone takeover` just above that line, because the comment now asks for something; nothing changes there. A question the step still has goes in the comment above that line. **One exception:** when the runner's instructions for this step (the section `runnerInstructionsBlock` appends at the end of the prompt) say the runner skipped this approval, nobody is asked, and the step says the work goes on and ends with "nothing". The prompt describes that case in its own words and does **not** quote `SKIPPED_REQUIREMENTS_APPROVAL` or `SKIPPED_PIECES_APPROVAL`: the skills look for those sentences word for word, and they must appear only where the runner put them.

**Decisions taken here that did not reach an ADR.** (1) **The closing line is fixed text, not left to the step.** `askedFor` reads the step's closing line as what the run waits on, and `timone status` shows it; the same words every time make both readable, and PRD-09's lesson was that a prompt must carry the finished sentence. (2) **The runner's rules do not change.** Its rule to correct a false newest comment stays as the safety net: if a step still ends with "nothing", or asks for an approval the runner then decides to skip, the runner corrects it as today. Both are one paragraph of text, undone by an edit, so neither passes the "hard to reverse" part of the test.

**No change to the runner's rules.** Nothing in `src/runner/brief.ts` changes, so PRD-05.R18 clause 2 (the replay run for a change to the runner's rules) does not apply.

**Regression set and what no criterion watches.** The diff touches `src/daemon/prompts.ts` and `src/daemon/prompts.test.ts`. Derived from the register at planning time (MUST, `api`, `verified`, narrowed by `Depends-on`; a criterion with no `Depends-on` is always in): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. Verification derives it again from the register as it stands then. **PRD-02.R4 is `live`, `verified`, and depends on `src/daemon/`**: this phase changes exactly the comment its first clause describes, so it **owes a live gate before delivery**: a requirements step on a scratch-app ticket whose own comment links the requirements and ends by asking for the approval, with no second comment from the runner after it. Per [ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) it rides to the pull request if only fvermaut can run it. The other `live` criteria that name `src/daemon/` (PRD-01.R4; PRD-02.R1, R2, R6, R7, R8, R13; PRD-03.R1, R2, R4, R5; PRD-07.R5, R7, R14) name the whole folder; this diff changes the text of two step prompts and none of the code they exercise. **What no criterion watches:** that the step obeys the new paragraph. The tests below prove the prompt says it; only a live step shows the model doing it. The tests of 63a are therefore a hard gate, and the live gate above is the only other evidence.

**Expected once the fix is live.** The next requirements step and the next step that works out the pieces, on any project, end their comment with the approval line, and the runner posts no correction after them. That is the sighting #209 waits for before it can be closed.

## Context & Prerequisites

- **`src/daemon/prompts.ts`** — `requirementsPrompt` (line ~851): the paragraph at lines ~877–882 ("Then post one comment on the ticket summarizing … two different sets of instructions would tell them two different things."). `breakdownPrompt` (line ~1139): the paragraph at lines ~1203–1211 ("Then post one comment on the ticket describing … two sets of instructions would tell them two different things."). Both are followed by `writingBlock(context)` and "Then stop.". `NEEDED_FROM_YOU` is imported from `../adapters/ticketing.js` (`"**What I need from you:**"`). `SKIPPED_REQUIREMENTS_APPROVAL` and `SKIPPED_PIECES_APPROVAL` (line ~771) and `runnerInstructionsBlock` (line ~788) show the section the exception refers to, headed `## The runner's instructions for this step`.
- **`src/daemon/prompts.test.ts`** — `stagePrompt(stage, context)` is the seam every prompt test uses; `context` and `PROMPTED_STAGES` are at the top. The block `describe("the breakdown prompt's list of pieces (45d)")` already asserts, on whitespace-normalised text, the sentence "Say the order of the pieces in the same words as the `**Order:**` line." — keep that sentence unchanged. `describe("the planning prompt")` asserts the planning prompt asks for nothing and says no "approval request"; it must stay green and is not edited.
- **`src/runner/brief.ts`** — read only. The rule about a false newest comment stays.
- **`process.md`**, *Gates, conversations and the human*: "A step that stops has to ask one thing on that line, and the ticket waits on the words it asked." Read only; this phase makes the prompts agree with it.
- **Skills** — `timone-prd` step 4 already says to ask for the approval against the committed register; `timone-plan`'s breakdown section says the gate is taken against the committed file. Neither changes.
- **Known state** — run timone#209/1 is parked in the daemon's ledger since 2026-10-07 after sorting, with no branch; this phase is worked by hand on `timone/209-a-step-that-asks-for-approval-ends-its-c`, the name `workBranch` gives the ticket.

## Sub-phases

### Sub-phase 63a: The requirements step and the step that works out the pieces ask for the approval in their own comment

**[MODIFY]** `src/daemon/prompts.ts`:
- Add one private function, for example `approvalAskBlock(what: "requirements" | "pieces")`, returning the paragraph both prompts share. It says, in the prompts' own style: the run now waits for their approval of the requirements (or of the list of pieces), and this comment is what asks for it — nothing else on the ticket asks; end the comment with the closing line, word for word (the two lines in the Goal Description, built from `NEEDED_FROM_YOU`); a question still open goes above that line; a comment that ends with "nothing" here is false, because the work waits for their answer and they would not know they were asked. Then the exception: when the runner's instructions for this step, at the end of the prompt, say it skipped this approval, nobody is asked — say that the work goes on, and end with "nothing". Describe that case in words; do not put the text of `SKIPPED_REQUIREMENTS_APPROVAL` or `SKIPPED_PIECES_APPROVAL` in the prompt.
- In `requirementsPrompt`, replace the paragraph from "Then post one comment on the ticket summarizing" to "two different things." with: post one comment summarizing, in plain words, what you understood they want — the substance, not a file listing — and link the requirements on the branch, since that file is what they approve; then `approvalAskBlock("requirements")`. Nothing else in the prompt changes.
- In `breakdownPrompt`, replace only the last two sentences of the closing paragraph ("Do **not** ask them to approve it … two different things.") with: link the list on the branch, since that file is what they approve; then `approvalAskBlock("pieces")`. Keep "Say the order of the pieces in the same words as the `**Order:**` line." as it is.
- In the doc comments of `requirementsPrompt` and `breakdownPrompt`, add one dated line each: `✏ 2026-10-18 (timone#209): the step asks for the approval itself; nothing else posts the request since ADR-0060.`

**[MODIFY]** `src/daemon/prompts.test.ts` — one new `describe("the step that writes a file for approval asks for it (timone#209)")` block.

**Seams under test (TDD):** `stagePrompt(stage, context)` is the seam — pure, returns the text a step is given; it is what the daemon sends, and it survives any reshaping of the private blocks. Compare on whitespace-normalised text (`.replace(/\s+/g, " ")`), as the 45d block does. Red-green:
1. `stagePrompt("requirements", …)` contains `**What I need from you:** read the requirements and reply "approved", or say what to change.`
2. `stagePrompt("breakdown", …)` contains `**What I need from you:** read the list of pieces and reply "approved", or say what to change.`
3. Neither of the two says the machinery posts the approval request, nor tells the step not to ask: no match for `/posts the approval request/i` and none for `/do (\*\*)?not(\*\*)? ask them to approve/i`.
4. Across every stage in `PROMPTED_STAGES`, no prompt matches `/posts the approval request/i` — the false claim does not come back in another prompt.
5. Each of the two names the exception in words — it contains `skipped` and the name of its own approval ("the requirements" / "the list of pieces") in the same sentence as "runner's instructions" — and neither contains `SKIPPED_REQUIREMENTS_APPROVAL` or `SKIPPED_PIECES_APPROVAL` (import both constants from `./prompts.js`).
6. Each of the two tells the comment to link the file on the branch (a match for `/link the (requirements|list)[^.]*on the branch/i`, matching the stage).

Cases 1 to 4 and 6 must be seen to fail on the code as it is before the change; case 5 fails on its first half (no exception is described today), while its second half already passes (the constants are not in the prompts today, and the case guards that it stays so). Record that red run in the handoff, naming each case.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone   # from the timone root

# Red first: the new block, run against the prompts as they were. Expect
# failures in cases 1, 2, 3, 4 and 6, and a non-zero exit.
npx vitest run src/daemon/prompts.test.ts -t "asks for it" ; echo "exit: $?"

# Green after the change. Expect every test in the file to pass, exit 0.
npx vitest run src/daemon/prompts.test.ts ; echo "exit: $?"
npx tsc --noEmit ; echo "exit: $?"            # expect exit: 0

# The false claim is gone from the file, prompts and comments alike (the new
# doc-comment line does not use these words). Expect no line and exit: 1
# (grep's "no match"; 2 would mean the file is missing).
grep -n "posts the approval request" src/daemon/prompts.ts ; echo "exit: $?"

# The tests that read these prompts elsewhere still pass. Expect exit: 0.
# ✏ 2026-10-18 (build, timone#209): src/daemon/register.test.ts is left out.
# It fails on main before this phase (the PRD-07 R3 register finding,
# timone#250) and reads a register, not a prompt; with it in, the command
# can only exit 1. It still runs in the whole suite at the close.
npx vitest run src/daemon src/runner src/commands/takeover.test.ts --exclude src/daemon/register.test.ts ; echo "exit: $?"
```

- [ ] The new block's red run is in the handoff, naming which cases failed before the change.
- [ ] `src/daemon/prompts.test.ts` passes in full, including `the planning prompt` and `the breakdown prompt's list of pieces (45d)`, unedited.
- [ ] Reading `stagePrompt("requirements", …)` and `stagePrompt("breakdown", …)` printed in full: each ends with the comment paragraph, the approval paragraph, `writingBlock`'s rules, and "Then stop."; the closing line appears once in each.
- [ ] `git diff --stat main` lists only `src/daemon/prompts.ts`, `src/daemon/prompts.test.ts`, and this phase's own files under `doc/plans/phases/`.

---

## Dependency graph

```
63a → (none)        the two step prompts ask for the approval in their own comment, with tests
```
