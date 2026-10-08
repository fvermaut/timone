# Breakdown

**Status:** Awaiting approval

This list builds [PRD-12](../../specs/prd/prd-12-an-approval-counts-while-its-files-are-unchanged.md).

1. **An approval counts while its files are unchanged** — the runner records a named person's approval as long as the files it approves are the same as when the comment was written.
   - A step that changed nothing, or only wrote that same approval in, no longer voids it. Any other change does, and the refusal names the file that changed.
   - One comment can give answers and the approval: the step that writes the answers in is tied to that comment in the run record, and the approval from that comment is recorded when the step ends.
   - When the merge of an approved list of pieces fails, "try again" retries it on the approval already given, and the record names the comment that gave it.
   - The runner's instructions and the description of `record_approval` say the new rule. The case of timone#197 joins the replay.
   - Delivers PRD-12 R1, R2, R3, and R6 for timone#197. Covers #198 and item 1 of #176.
   - Needs: nothing.
2. **A terminal session hands back the truth and its branch** — a terminal session asks for the approval on the ticket, and the branch it pushed becomes the run's when it ends.
   - Its instructions say that words at the keyboard are not an approval, that its closing comment asks a named person to approve on the ticket, and that it never marks a file approved.
   - On a run with no branch, it is told the branch the run will use. A branch it pushed under that name becomes the run's when the session ends, and the runner sees it and its requirements files.
   - An approval written on the ticket after the session is then recorded at once, with no step started in between. The case of ivtrends#143 joins the replay.
   - Delivers PRD-12 R4, R5, and R6 for ivtrends#143. R7 is checked on a supervised run after it lands.
   - Needs: piece 1.

**Order:** 1, then 2.

**Why piece 1 comes first:** a branch that becomes the run's is of little use while the approval rule is the old one. The run would hold the branch, and the runner would still refuse the approval, because no step of the run wrote the requirements. With piece 1 landed alone, the case of ivtrends#143 already needs one approval on the ticket, at the cost of one step started only to take up the branch. Piece 2 removes that step.

**Why the approval rule is one piece:** the three cases are one rule about the same files. A comment that gives answers and approves is the one change to the files that does not void the approval, and a retried merge is refused on the same check when the list changed.

**Three choices PRD-12 left open.** fvermaut approved PRD-12 without answering them, so the proposed answers stand. Any of them can be changed when this list is approved.

- **The approved files are the PRD files only** (R1, piece 1). For the requirements, they are the narrative and the criteria file of each PRD the run's branch adds or changes. An ADR changed after the comment does not void an approval of the requirements.
- **How the step is tied to the comment is decided when piece 1 is planned** (R2). The tie is in the run record and names the comment by its time, so code, not the runner's judgement, decides the exception.
- **The two replay cases are built** (R6, pieces 1 and 2). The thread did not ask for them. They keep the runner from repeating these failures, which came partly from its own words.
