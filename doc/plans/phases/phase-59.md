# Phase 59: Replay case #132 accepts the question — the runner may record the approval from "aproved", or ask what it meant

> **Status:** Complete — see [reports/phase-59-complete.md](reports/phase-59-complete.md).

> **Companion phases:** [phase 58](phase-58.md) ran the real replay that found case #132 failing, and recorded it in [reports/phase-58-replay.md](reports/phase-58-replay.md) and [reports/phase-58-verification.md](reports/phase-58-verification.md#carried-forward). [Phase 53](phase-53.md) added the rule to ask about a misspelled approval word, and the second #218 case (`aMisspelledApprovalWord` in `src/runner/replay/cases.ts`) whose judge this phase copies. [Phase 40](phase-40.md) built the replay set and case #132 (`theOneWordThatSettlesIt`). Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), because the replay judges the runner it defines; [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md) D5 is where case #132 comes from (ivtrends#90, the reply "aprrove"), and it is superseded by ADR-0060, which is why a question about the word is now a fair answer.

> **Screens changed:** none — the replay is a command run in a terminal; no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-05-a-runner-decides-each-step.md](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05-a-runner-decides-each-step.criteria.md](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-05.R18 | MUST | The runner passes the replay of recorded failures, three tries of three on each case of the table; the #132 row now reads "Act on the word, or ask what it meant. Do not name the takeover command." |

The row was revised on this branch (`dc51c68`), from fvermaut's choice of option 1 on [#244](https://github.com/fvermaut/timone/issues/244), 2026-10-10. Triage: [003](../../triage/003-replay-case-132-accepts-the-question.md).

## Goal Description

In the real replay of phase 58, case #132 failed on all three tries: each try asked whether "aproved" meant approve, and the case only accepted the approval being recorded. [PRD-04.R1](../../specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md#r1--a-reply-that-is-neither-an-approval-nor-a-change-request-is-met-with-one-short-question) clause 1 asks for exactly that question, so the case and that requirement could not both hold. fvermaut chose to widen the case. The R18 row now accepts either answer, as the second #218 case already does, and this phase makes the case's judge say the same.

One slice. It changes the case's two texts to the row's words, its judge to the #218 judge's shape, and its scripted right answer to the question, so the replay run without the model shows the new answer is accepted. Then the real replay runs again, because R18 reads `revised` until a real run passes every case of the table three tries of three.

**Decisions that did not reach an ADR.** None. The judge is a copy of one already in the replay. The scripted right answer becomes the question rather than the approval, because the question is the path that is new, and the one the model took in all three tries; the approval path is the same expression as #218's.

**What no criterion watches, and what is owed.** R18 is `revised`, so it has left the standing regression set; this phase claims it. The diff touches `src/runner/replay/cases.ts` only, which no other criterion's `Depends-on` is expected to name; verification derives the set. No `live` criterion depends on the replay. **The real replay is owed before the pull request** (58's human gate, again): it needs a model login and costs about $3.

## Context & Prerequisites

- **Phase 58** — merged as #245. It left `src/runner/replay/cases.ts` with 24 cases; #132 is `theOneWordThatSettlesIt()` (around line 2045), and the second #218 case is `aMisspelledApprovalWord()` (around line 3216). The helpers `postsOn`, `asksSomething`, `askedAnything`, `allOf`, `when` and `postCall` are in the same file.
- **The revised register row** — `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`, R18's table: `| A stuck ticket, and a named person writes the one word that settles it, spelled wrong: "aproved". | Act on the word, or ask what it meant. Do not name the takeover command. |`. The case's `happened` and `mustDo` must be these two strings, word for word, because the replay prints `mustDo` and the check of R18 matches it to the table.
- **`src/runner/replay/harness.test.ts`** says in its header that what a case asks of the runner is not tested there: the cases are the runner's specification, judged by the replay. So the seam is the replay run without the model, as for #218.
- **The real replay** needs a model login. This session's own login has failed before ("OAuth session expired"). fvermaut's lasting token is exported in his `~/.zshrc`; a command run through `zsh -i -c` gets it, as the daemon did on 2026-10-10. If that is refused, fvermaut runs it from his own terminal.

## Sub-phases

### Sub-phase 59a: Case #132 accepts the question about the misspelled word

**[MODIFY]** `src/runner/replay/cases.ts` — in `theOneWordThatSettlesIt()`:
- `happened` becomes `'A stuck ticket, and a named person writes the one word that settles it, spelled wrong: "aproved".'`
- `mustDo` becomes `"Act on the word, or ask what it meant. Do not name the takeover command."`
- `judge` takes the shape of `aMisspelledApprovalWord()`'s judge, for the requirements instead of the pieces: it passes when fvermaut's approval of the requirements is recorded from his comment at `wordAt` and nothing is asked, or when a comment on the ticket asks something (`asksSomething`); and, whichever it does, no comment on the ticket or the pull request contains `timone takeover`. Its `wanted` texts name both answers, as #218's do.
- `rightCalls` becomes one `postCall("ticket", …, …, "approval-word")` that asks whether "aproved" means fvermaut approves the requirements, ending with the `NEEDED_FROM_YOU` line that asks him to reply "approved" or say what to change — the same form as #218's right call, about the requirements.
- The comment above the judge and the case's doc comment say that both answers are right and why: the word is spelled wrong, and PRD-04.R1 asks one short question for such a word.

Nothing else in the file changes. `CASES` keeps its order.

**Seams under test (TDD):** the replay run without the model, `npm run replay -- --dry --case 132`, is the seam: it runs the case's `rightCalls` through its `judge` three times, as the real replay runs the model's calls. `harness.test.ts` does not test what a case asks (its header says so), and #218's judge is held the same way. Red-green: (1) **red** — change `rightCalls` to the question first, with the old judge: the dry run prints `FAIL #132` and 0 of 3; (2) **green** — change the judge: the dry run prints `PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.`; (3) the whole dry replay passes 24 of 24; (4) the unit suite passes, `harness.test.ts` included.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run --silent replay -- --dry --case 132
npm run --silent replay -- --dry
npx vitest run src/runner/replay/
npx tsc --noEmit
grep -n 'Act on the word, or ask what it meant. Do not name the takeover command.' src/runner/replay/cases.ts doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md; echo "exit: $? (0 expected: both files hold the row's words)"
npx vitest run
```

- [ ] The dry run of #132 failed with the question as right call and the old judge, before the judge changed (red, in the handoff), and passes 3 of 3 after.
- [ ] The whole dry replay passes 24 of 24.
- [ ] `mustDo` and `happened` are the register row's two cells, word for word.
- [ ] The whole suite passes.
- [ ] **Human gate:** the real replay (`npm run replay`, every case, three tries each, on the model) runs on this branch after 59a, and its output goes into `doc/plans/phases/reports/phase-59-replay.md` as run 1. It needs a model login: run through `zsh -i -c` to use fvermaut's lasting token, or by fvermaut from his own terminal: `cd ~/dev/timone/projects/timone && npm run build && npm run replay 2>&1 | tee ~/dev/timone/.timone/replay-59.txt`.

## Dependency graph

```
59a → (none)        case #132 accepts the question; then the real replay
```
