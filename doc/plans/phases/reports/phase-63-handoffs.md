# Phase 63 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 63a — The requirements step and the step that works out the pieces ask for the approval in their own comment

**Built.** The requirements step and the step that works out the pieces are now told to ask for the approval themselves. Each prompt tells the step to link the file on the branch, says the run now waits for the approval and that this comment is the only thing that asks, and gives the closing line word for word:

- requirements: `**What I need from you:** read the requirements and reply "approved", or say what to change.`
- list of pieces: `**What I need from you:** read the list of pieces and reply "approved", or say what to change.`

A question still open goes above that line. Ending with "nothing" is called false. One exception is described in words: when the runner's instructions for this step say it skipped this approval, nobody is asked, the comment says the work goes on, and it ends with "nothing". The old sentence ("the machinery posts the approval request itself … Do not ask them to approve it") is gone from both prompts.

**Files touched.**

- `src/daemon/prompts.ts` — new private `approvalAskBlock(what: "requirements" | "pieces")`, placed just above `requirementsPrompt`. `requirementsPrompt`: the comment paragraph now summarizes and links the requirements on the branch, then `approvalAskBlock("requirements")`. `breakdownPrompt`: the last two sentences of the comment paragraph are replaced by "Link the list on the branch, since that file is what they approve.", then `approvalAskBlock("pieces")`; "Say the order of the pieces in the same words as the `**Order:**` line." is unchanged. Both doc comments carry the dated line `✏ 2026-10-18 (timone#209): the step asks for the approval itself; nothing else posts the request since ADR-0060.`
- `src/daemon/prompts.test.ts` — imports `SKIPPED_REQUIREMENTS_APPROVAL` and `SKIPPED_PIECES_APPROVAL`; one new block, `describe("the step that writes a file for approval asks for it (timone#209)")`, with cases 1 to 6 (20 tests, since cases 3 to 6 run per stage). No existing test was edited.
- `doc/plans/phases/reports/phase-63-handoffs.md` — this file.

**Decisions taken inside the slice.**

- The requirements prompt says "since those files are what they approve", not "that file": the requirements are a pair of files (narrative and register). The breakdown keeps "that file".
- The exception sentence reads "When the runner's instructions for this step, at the end of this prompt, say that it skipped the approval of the requirements, nobody is asked." It holds the words "skipped the approval of …" but never the whole sentence of `SKIPPED_REQUIREMENTS_APPROVAL` / `SKIPPED_PIECES_APPROVAL` ("…, and recorded that it did."), so a skill looking for that sentence word for word does not find it in the step's own text.
- Cases 1 and 2 also assert that the closing line appears exactly once, which is the last checkbox's condition, checked in code as well as by reading.
- Case 5 finds "the same sentence" by splitting the whitespace-normalised prompt after `.`, `!` or `?` followed by a space.
- `approvalAskBlock`'s doc comment carries no `✏` line of its own; it links timone#209 and ADR-0060 in its text instead.

**Validation evidence.**

Red-green trace. All six cases were written first and run against the prompts as they were (`npx vitest run src/daemon/prompts.test.ts -t "asks for it"`, exit 1, 10 failed, 10 passed). Then the requirements prompt was changed alone (5 failed: every breakdown case), then the breakdown prompt (20 passed).

| Case | Test | Red, before the change | Green |
|------|------|------------------------|-------|
| 1 | tells the requirements step to end its comment asking for the approval of the requirements | `expected 'Write down what ticket #6 on **scratc…' to contain '**What I need from you:** read the re…'` | after the requirements change |
| 2 | tells the step that works out the pieces to end its comment asking for the approval of the list of pieces | `expected 'Break the work for ticket #6 on **scr…' to contain '**What I need from you:** read the li…'` | after the breakdown change |
| 3 | requirements / breakdown neither says something else posts the approval request nor tells the step not to ask | both: `expected '…' not to match /posts the approval request/i`. The second assertion was not reached; a separate check on the old prompts showed `/do (\*\*)?not(\*\*)? ask them to approve/i` matched both too. | requirements, then breakdown |
| 4 | %s does not say something else posts the approval request (all 12 stages) | requirements and breakdown failed: `expected '…' not to match /posts the approval request/i`. The other 10 stages passed on arrival, as expected: the claim was only in these two. | requirements, then breakdown |
| 5 | requirements / breakdown says in words that nobody is asked when the runner skipped the approval of …, without the sentence the skills read | first half failed for both: `no sentence names the runner's instructions, "skipped" and the requirements: expected undefined to be defined` (and the same for "the list of pieces"). The second half was not reached; a separate check on the old prompts showed neither constant was in them, so that half was green on arrival, as the plan says. | requirements, then breakdown |
| 6 | requirements / breakdown tells the comment to link the file on the branch | `expected '…' to match /link the requirements[^.]*on the bra…/i`; `expected '…' to match /link the list[^.]*on the branch/i` | requirements, then breakdown |

The validation block, as written:

```text
$ npx vitest run src/daemon/prompts.test.ts -t "asks for it" ; echo "exit: $?"   # before the change
 Tests  10 failed | 10 passed | 255 skipped (275)
exit: 1

$ npx vitest run src/daemon/prompts.test.ts ; echo "exit: $?"
 Tests  275 passed (275)
exit: 0

$ npx tsc --noEmit ; echo "exit: $?"
exit: 0

$ grep -n "posts the approval request" src/daemon/prompts.ts ; echo "exit: $?"
exit: 1

$ npx vitest run src/daemon src/runner src/commands/takeover.test.ts ; echo "exit: $?"
 × this repository's own registers > claim nothing they have not established
 Test Files  1 failed | 41 passed (42)
      Tests  1 failed | 2125 passed (2126)
exit: 1
```

The last command does not reach exit 0. Its one failure is the known one on this branch before any change: `src/daemon/register.test.ts`, a register finding about PRD-07 R3 ("R3 is marked verified, and its own notes say a clause was never seen to hold"). It reads a requirements register, not a prompt. The same command with that one file left out passes:

```text
$ npx vitest run src/daemon src/runner src/commands/takeover.test.ts --exclude src/daemon/register.test.ts ; echo "exit: $?"
 Test Files  41 passed (41)
      Tests  2115 passed (2115)
exit: 0
```

Checkboxes:

- [x] The new block's red run is in the handoff, naming which cases failed before the change. — Cases 1, 2, 3, 4 (for requirements and breakdown) and 6 failed, and case 5 failed on its first half; see the table.
- [x] `src/daemon/prompts.test.ts` passes in full, including `the planning prompt` and `the breakdown prompt's list of pieces (45d)`, unedited. — 275 passed, exit 0; neither block was edited.
- [x] Reading `stagePrompt("requirements", …)` and `stagePrompt("breakdown", …)` printed in full: each ends with the comment paragraph, the approval paragraph, `writingBlock`'s rules, and "Then stop."; the closing line appears once in each. — Printed with `npx tsx` and the context from the brief. In both, the stage's own text ends in that order; after "Then stop." come the blocks `stagePrompt` adds to every stage (what to do when stuck, the checkout, the commit trailers). `grep -c 'What I need from you:\*\* read'` gives 1 for each.
- [x] `git diff --stat main` lists only `src/daemon/prompts.ts`, `src/daemon/prompts.test.ts`, and this phase's own files under `doc/plans/phases/`. — It lists `doc/plans/phases/phase-63.md`, `src/daemon/prompts.test.ts`, `src/daemon/prompts.ts`. This handoff file is new and untracked, so it shows only once committed; it is also under `doc/plans/phases/`.

Tests run at the end: the whole suite, once (`npx vitest run`, 23 s): `Test Files 1 failed | 77 passed (78)`, `Tests 1 failed | 2819 passed (2820)`. The one failure is the known `src/daemon/register.test.ts > this repository's own registers > claim nothing they have not established`.

**What delivery must know.**

- The validation block's last command cannot reach exit 0 on this branch while the PRD-07 R3 register finding stands. That is not caused by this slice.
- No refactor is proposed. The words "the requirements" and "the list of pieces" are written in `approvalAskBlock` and also inside the two `SKIPPED_…` constants; the constants must stay literal sentences, so sharing the words between them is not worth it.
