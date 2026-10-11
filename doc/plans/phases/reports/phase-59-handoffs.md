# Phase 59 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 59a — Case #132 accepts the question about the misspelled word

**Built.** Replay case #132 now accepts two answers to fvermaut's misspelled "aproved". The first is to record his approval of the requirements from that comment, and ask nothing. The second is to ask on the ticket what the word meant. In both, no comment on the ticket or the pull request may contain `timone takeover`. The case's two texts are now the register row's two cells, word for word. The dry run's right call is now the question: it asks whether "aproved" means fvermaut approves the requirements, and ends with the line that asks him to reply "approved" or say what to change. It is the same form as the second #218 case.

**Files touched.**

- `src/runner/replay/cases.ts` — in `theOneWordThatSettlesIt()` only: `happened` and `mustDo` are the row's cells. The judge has the shape of `aMisspelledApprovalWord()`'s judge, for the requirements instead of the pieces. `rightCalls` is one `postCall("ticket", …, …, "approval-word")`. The doc comment and the comment above the judge say that both answers are right, and why: the word is spelt wrong, and PRD-04.R1 asks one short question for such a word.

**Decisions taken inside the slice.**

1. The question says "before the work goes on", where #218's says "before the building starts". After the requirements, the next step is the list of pieces, not the build.
2. The right call's reason says "it is spelt wrong, so I ask before I record his approval". #218's reason says "spelt too far from it". "aproved" is one letter from "approved", so "too far" would not be true here.
3. The comments say "spelt", as the rest of `cases.ts` does. `happened` says "spelled", because it must match the register row word for word.

**Validation evidence.**

Red. `rightCalls` was changed to the question first, with the old judge still in place:

```
$ npm run --silent replay -- --dry --case 132
Replaying 1 cases, 3 tries each, with a scripted runner and no model (--dry).
FAIL #132 — Act on the word. 0 of 3 tries chose it. Try 1: posted on the ticket: "**You wrote "aproved".** I think you mean that you approve the requirements, but I want to be sure …" — wanted: fvermaut's approval of the requirements recorded, from his comment at 2026-09-17T09:05:12Z. Try 2: … Try 3: … (same)
0 of 1 cases passed. The runner's sessions cost $0.00 in all.
exit: 1
```

Green. Then the judge, the two texts and the comments were changed:

```
$ npm run --silent replay -- --dry --case 132
PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.
1 of 1 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
```

Two more checks of the new judge, each made with a temporary edit. The file was restored from a copy afterwards, and `cmp` confirmed it was the same:

- With the old right call (the recorded approval) put back: `PASS #132 … 3 of 3 tries.` The judge still accepts the first answer.
- With the question posted without `"approval-word"`, so the machine adds the takeover sentence: `FAIL #132 … 0 of 3 tries chose it … wanted: no comment that names the takeover command.` The judge sees the comment as it is posted, takeover sentence included.

The validation block, run from `projects/timone`:

```
$ npm run --silent replay -- --dry --case 132
PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.
1 of 1 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
$ npm run --silent replay -- --dry
Replaying 24 cases, 3 tries each, with a scripted runner and no model (--dry).
PASS … (24 lines, each 3 of 3 tries)
24 of 24 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
$ npx vitest run src/runner/replay/
 ✓ src/runner/replay/harness.test.ts (7 tests)
 Test Files  1 passed (1)
      Tests  7 passed (7)
exit: 0
$ npx tsc --noEmit
exit: 0
$ grep -n 'Act on the word, or ask what it meant. Do not name the takeover command.' src/runner/replay/cases.ts doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md; echo "exit: $? (0 expected: both files hold the row's words)"
doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md:368:  | [#132](…) | A stuck ticket, and a named person writes the one word that settles it, spelled wrong: "aproved". | Act on the word, or ask what it meant. Do not name the takeover command. |
src/runner/replay/cases.ts:2061:    mustDo: "Act on the word, or ask what it meant. Do not name the takeover command.",
exit: 0 (0 expected: both files hold the row's words)
$ npx vitest run
 Test Files  77 passed (77)
      Tests  2742 passed (2742)
   Duration  20.48s
exit: 0
```

- [x] The dry run of #132 failed with the question as right call and the old judge, before the judge changed, and passes 3 of 3 after. **PASS** — red `FAIL #132 … 0 of 3`, green `PASS #132 … 3 of 3 tries`, both above.
- [x] The whole dry replay passes 24 of 24. **PASS** — `24 of 24 cases passed.`
- [x] `mustDo` and `happened` are the register row's two cells, word for word. **PASS** — the grep above finds `mustDo` in both files. A second grep for the `happened` text, `A stuck ticket, and a named person writes the one word that settles it, spelled wrong: "aproved".`, finds it once in each file.
- [x] The whole suite passes. **PASS** — `npx vitest run`: 77 files, 2742 tests, 20.48 s.
- [ ] **Human gate:** the real replay on the model. **Left to the orchestrator.** It was not run here, because it calls the model and costs money.

Tests run at the end: the whole unit suite (`npx vitest run`, 2742 of 2742), and the whole dry replay (24 of 24). There is no other suite.

**What delivery must know.**

- `approvalCall()` in `cases.ts` (line 538) now has no caller. #132 was its only use. `tsc` does not report it, because the project does not set `noUnusedLocals`. The plan says nothing else in the file changes, so it was left in place. It can be removed, or kept for a later case that records an approval.
- The dry run only shows that the judge accepts the scripted question. Whether the model passes #132 three times out of three is for the human gate's real replay to show.
