# Phase 63 — Delivery Report

- **Date:** 2026-10-18
- **Phase:** [phase-63.md](../phase-63.md) — `Complete`, verified in [phase-63-verification.md](phase-63-verification.md)
- **Branch:** `timone/209-a-step-that-asks-for-approval-ends-its-c` @ `30eb59c`
- **Base:** `main` — the project's default branch; the branch was cut from it.
- **Pull request:** opened against this report; its address is in the session's closing message and on timone#209.
- **Screen:** no user-facing screen in this phase — Timone draws none, and the phase file's `Screens changed` line says none.
- **Questions for the human:** none — the verification report's section of that name says none.
- **Departures:** [`phase-63-departures.md`](phase-63-departures.md) — 2 entries.

## Scope

Un-anchored chore work, stamped 2026-10-18 for fvermaut's request in a terminal session ("fix timone#209"). It claims no requirement. The requirements step and the step that works out the pieces were told not to ask for the approval, because "the machinery posts the approval request itself". Nothing has posted it since ADR-0060. So both steps ended their comment with "What I need from you: nothing" while the run waited for an approval, and the runner posted a second comment to correct it each time — more than 30 times on ivtrends and timone since 2026-10-04 (timone#209). Now each step's comment links the file on the branch and ends by asking for the approval, in a fixed line. When the runner skipped the approval, the step says the work goes on and asks for nothing.

## How to try it

### Against the preview

This project has no preview configured for pull requests. The check that matters here needs the real daemon and fvermaut's login (the owed live gate below):

1. Run the daemon from this branch's build (`npm run build`), against scratch-app, as the project's `README.md` says.
2. On scratch-app, open a small feature ticket and mark it with the `timone` label.
3. When the step that writes the requirements finishes, its comment should link the requirements on the branch and end with: `**What I need from you:** read the requirements and reply "approved", or say what to change.` Just above that line it should hold the sentence that names `timone takeover scratch-app#<n>`. No second comment from the machine should follow it asking for the approval.
4. Reply "approved". When the step that works out the pieces finishes, its comment should end with: `**What I need from you:** read the list of pieces and reply "approved", or say what to change.` Again, no correcting comment should follow.

### On a local checkout

1. Install and build as the [README](../../../../README.md) says (*Getting started*).
2. `npx vitest run src/daemon/prompts.test.ts` — 275 of 275 pass. The new tests are the block `the step that writes a file for approval asks for it (timone#209)`: 20 tests.
3. `grep -n "posts the approval request" src/daemon/prompts.ts` — prints nothing (exit 1): the old claim is gone.
4. `npm run build`, then print the closing lines both steps are now told to write:

   ```bash
   node --input-type=module -e '
   import { stagePrompt } from "./dist/daemon/prompts.js";
   const context = { project: { name: "scratch-app", repoUrl: "x" }, ticket: { number: 6, title: "t", body: "b", labels: [], url: "u", author: "a", createdAt: "2026-08-03T09:00:00Z", comments: [] }, classification: "feature", branch: "timone/6-t" };
   for (const stage of ["requirements", "breakdown"]) console.log(stagePrompt(stage, context).split("\n").filter((l) => /What I need from you:\*\* read/.test(l)).join("\n"));'
   ```

   You should see the two lines from step 3 and 4 above, one for each step.
5. `npx vitest run` — the whole suite: 2820 tests, 2819 pass. The one failure is `src/daemon/register.test.ts`, which fails on `main` too (PRD-07 R3, timone#250).

## Verification outcome

Quoted from [phase-63-verification.md](phase-63-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R2 | MUST | api | PASS | 0 |
| PRD-05.R3 | MUST | api | PASS | 0 |
| PRD-05.R4 | MUST | api | PASS | 0 |
| PRD-05.R5 | MUST | api | PASS | 0 |
| PRD-05.R7 | MUST | api | BLOCKED in part — clause 2 and code's part of clause 1 PASS; the runner's part of clause 1 needs the real model | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| PRD-05.R11 | MUST | api | PASS | 0 |
| PRD-05.R18 | MUST | api | BLOCKED in part — the replay's own judging PASSES; the replay on this build needs the real model | 0 |
| PRD-07.R4 | MUST | api | PASS | 0 |
| PRD-07.R6 | MUST | api | PASS | 0 |
| PRD-07.R9 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 0 |
| PRD-09.R2 | MUST | api | PASS | 0 |
| PRD-09.R4 | MUST | api | PASS | 0 |
| PRD-09.R5 | MUST | api | PASS | 0 |
| PRD-10.R2 | MUST | api | PASS | 0 |
| PRD-10.R3 | MUST | api | PASS | 0 |
| PRD-10.R4 | MUST | api | PASS | 0 |
| PRD-10.R5 | MUST | api | PASS | 0 |
| PRD-10.R6 | MUST | api | PASS | 0 |
| PRD-02.R4 and 14 more | MUST | live | LIVE-GATE — owed | — |

Zero regressions: 18 PASS, 2 BLOCKED in part, 0 FAIL.

### Outstanding for the human

- [ ] PRD-02.R4 — live gate owed: a requirements step on a scratch-app ticket whose own comment links the requirements and ends with the approval line, with no correcting comment after it. Steps under *How to try it*, above. This is the one live gate this change is about.
- [ ] 14 more `live` criteria name `src/daemon/` as a whole, which the diff touches, so each owes a gate by the rule: PRD-01.R4; PRD-02.R1, R2, R6, R7, R8, R13; PRD-03.R1, R2, R4, R5; PRD-07.R5, R7, R14. The diff changes only the text of two step prompts. The verification report's *Live gates* section lists them, with seven more that have no `Depends-on` line.
- [ ] PRD-05.R7 (the runner's part of clause 1) and PRD-05.R18 (clause 1) — BLOCKED: run `npm run --silent replay` on this branch from a terminal with a model login, and commit its record. No file under `src/runner/` changed. See *Carried forward* in the verification report.

## Standards review — phase 63

- **Read:** the diff `git diff origin/main...timone/209-a-step-that-asks-for-approval-ends-its-c -- src/daemon/prompts.ts src/daemon/prompts.test.ts`; the branch versions of `src/daemon/prompts.ts` (lines 1–210, 560–950, 1175–1260 and greps across the file) and `src/daemon/prompts.test.ts` (lines 1–80, 705–860 and greps); `tsconfig.json`; the `scripts` in `package.json`. The project's `doc/standards.md` does not exist, so the central standards apply: `/Users/fvermaut/dev/timone/standards/code-smells.md`, `/Users/fvermaut/dev/timone/standards/typescript.md`, `/Users/fvermaut/dev/timone/standards/testing.md`.
- **Diff:** `origin/main...timone/209-a-step-that-asks-for-approval-ends-its-c`: 7 files, +713/−8. The two reviewed files: `src/daemon/prompts.ts` +53/−8, `src/daemon/prompts.test.ts` +87/−0.
- **Findings:** 3, all minor

The rest of the diff follows the file's own style. Prompt text is built from arrays of short lines of about 75 characters. Each new describe block in the test file builds its own context with the branch. Each test flattens whitespace with `.replace(/\s+/g, " ")`, as its neighbours do. The expected closing lines are written out as literals, not built from `NEEDED_FROM_YOU`, so they do not depend on the code under test. The doc comments explain why, not what.

### 1. The two new `✏` markers are one unwrapped 117-character line, and the same line appears twice. This breaks the surrounding style.

- **Where:** `src/daemon/prompts.ts:892` and `src/daemon/prompts.ts:1182`
- **What:** `* ✏ 2026-10-18 (timone#209): the step asks for the approval itself; nothing else posts the request since ADR-0060.` appears word for word above `requirementsPrompt` and above `breakdownPrompt`. Every other `✏` line in the file wraps at 71–82 characters (lines 134, 229, 256, 384, 499, 571, 616, 627, 717, 1268, 1385, 1473, 1487). The other lines over 100 characters are links or template openers. These two are the only plain prose lines in a doc comment that run that long.
- **Why it matters:** Surrounding style (line length of the neighbouring doc comments). No Prettier or ESLint config exists, so no tool will catch it. The second verbatim copy is "Duplicated code" at its second, tolerable occurrence.
- **Suggested remediation:** Wrap each marker to about 80 columns, like its neighbours. Optionally shorten each one to point at `approvalAskBlock`, whose doc comment already gives the full reason. Not applied here.

### 2. A second mapping on the same unnamed approval kind, written as a ternary that tsc cannot check for completeness — Duplicated code (second copy)

- **Where:** `src/daemon/prompts.ts:861–862`, beside the existing `src/daemon/prompts.ts:790` and `800–802`
- **What:** `function approvalAskBlock(what: "requirements" | "pieces")` with `what === "requirements" ? "the requirements" : "the list of pieces"`. The existing `runnerInstructionsBlock(…, skipped: readonly ("requirements" | "pieces")[])` already maps the same union with `what === "requirements" ? SKIPPED_REQUIREMENTS_APPROVAL : SKIPPED_PIECES_APPROVAL`. The union now appears in two signatures, and each has its own ternary that sends every value that is not "requirements" to the "pieces" words.
- **Why it matters:** "Duplicated code" in `code-smells.md`: the same decision is restated, at the second copy, which is tolerable. The ternary is also not checked for completeness. `typescript.md` ("States are discriminated unions… a new variant breaks every handler at compile time") asks for mappings that fail to compile when a variant is added. A third approval kind added to either union would quietly get the "list of pieces" words in both places.
- **Suggested remediation:** Name the union, for example `type ApprovalKind = "requirements" | "pieces"`. Keep its words in one `Record<ApprovalKind, { words: string; skipped: string }>`, which tsc checks for completeness, and read that record in both functions. Not applied here.

### 3. One test assertion repeats an assertion in the next test — Duplicated code (redundant assertion in a test)

- **Where:** `src/daemon/prompts.test.ts:803–811` and `src/daemon/prompts.test.ts:813–818`
- **What:** `it.each(["requirements", "breakdown"] as const)("%s neither says something else posts the approval request nor tells the step not to ask", …)` asserts `expect(prompt).not.toMatch(/posts the approval request/i)`. The next test, `it.each(PROMPTED_STAGES)("%s does not say something else posts the approval request", …)`, makes the same assertion for every stage, and `PROMPTED_STAGES` includes `requirements` and `breakdown`.
- **Why it matters:** `testing.md`, "one condition per test". The first test checks two conditions, and the next test already covers one of them. This is not the visible repetition that `testing.md` accepts for readability. It is the same check run twice, and it makes the first test's name longer than its own job needs.
- **Suggested remediation:** Keep only the `do (**)not(**) ask them to approve` assertion in the first `it.each`, and rename it to say just that. Not applied here.

## Spec review — phase 63

- **Read:** `git diff origin/main...timone/209-a-step-that-asks-for-approval-ends-its-c -- src/daemon/prompts.ts src/daemon/prompts.test.ts`; `src/daemon/prompts.ts` on the branch (around lines 120–200, 280–380, 760–935, 1160–1275) and `src/daemon/prompts.test.ts` (lines 769–855); `doc/plans/phases/phase-63.md` from the top to the end of `## Requirements`; timone#209 (title and body); `doc/specs/prd/prd-02-inversion-of-control.criteria.md`, blocks R4 and R5; `/Users/fvermaut/dev/timone/process.md`, section *Gates, conversations and the human*.
- **Diff:** `origin/main...timone/209-a-step-that-asks-for-approval-ends-its-c` — 7 files, +713/−8. The reviewed files: `src/daemon/prompts.ts` +53/−8, `src/daemon/prompts.test.ts` +87/−0.
- **Findings:** 1. It is minor, and the diff did not cause it.

The diff does what the requirements section says and nothing more:
- It removes the false sentence "the machinery posts the approval request itself" from the requirements prompt and from the breakdown prompt.
- It replaces that sentence with one shared block, `approvalAskBlock`. The block gives the step the exact closing line, built from `NEEDED_FROM_YOU`.
- It adds the link to the committed file, as ADR-0014 asks and as PRD-02.R4 says ("a summary comment linking to it").
- It covers one case where nobody is asked: when the runner skipped the approval. That case is described in plain words and does not copy the runner's exact sentences.
- Its tests check four things: the closing line appears exactly once; the old claim is not in any step's prompt; the skip case is described without copying `SKIPPED_*_APPROVAL`; and the link to the file is asked for.

Nothing else changed. Nothing the ticket asks for is missing.

The diff agrees with process.md, *Gates, conversations and the human*: "A step that stops has to ask one thing on that line, and the ticket waits on the words it asked." The closing line asks one thing. In the skip case the closing line says "nothing", which matches "A message that asks nothing says so". The closing line can carry the takeover sentence above it, as `writingBlock` requires: an open question goes above, then the takeover sentence, then the closing line.

### 1. R5's status note still says the daemon posts the approval request — PRD-02.R5

- **Where:** `doc/specs/prd/prd-02-inversion-of-control.criteria.md:112`. The diff does not touch this file.
- **What:** The note says: "**What must be seen, on one initiative:** the `breakdown` stage committing the list of pieces on the work branch, the daemon posting the approval request against that committed file, …". After this diff, the breakdown step's own comment carries the request (`src/daemon/prompts.ts:1253–1256` and `approvalAskBlock`, lines 841–880). R5's criteria do not say who asks; they say "gated on approval exactly like R4". So the diff does not contradict the criteria. Only this note describes something that no longer happens. The phase file's own statement agrees: "No requirement says who asks for the approval".
- **Why it matters:** PRD-02.R5 has not been verified. Whoever verifies it next will read this note first and will look for a separate request from the daemon that will never appear. The note went out of date with ADR-0060, not with this diff.
- **Suggested remediation:** add a marked amendment to R5's status note saying the breakdown step's comment asks for the approval. Do the same for R4's history line if wanted. Not applied here.

## Notes

- **Worked by hand.** fvermaut asked for timone#209 to be fixed in a terminal session. The daemon's run on #209 (timone#209/1) stopped after sorting the request on 2026-10-07 and was never woken again (timone#243 describes that kind of stop). It holds no branch and was left alone: a permission check refused to cancel it from the session. When #209 is closed, the daemon drops that run by itself.
- **No closing keyword.** The pull request names #209 without a closing word, so merging does not close it. The completion report says #209 waits for a live sighting before it is closed.
