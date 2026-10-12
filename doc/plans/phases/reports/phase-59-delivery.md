# Phase 59 — Delivery Report

- **Date:** 2026-10-11
- **Phase:** [phase-59.md](../phase-59.md) — `Complete`, verified in [phase-59-verification.md](phase-59-verification.md) (iteration 2)
- **Branch:** `timone/244-replay-case-132-accepts-the-question` @ `48449cc`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `2e9d1d3`.
- **Pull request:** opened against this report; its address is on [timone#244](https://github.com/fvermaut/timone/issues/244).
- **Screen:** no user-facing screen in this phase. The phase file's *Screens changed* line says none, so the screen gate was skipped.
- **Questions for the human:** none.
- **Departures:** [`phase-59-departures.md`](phase-59-departures.md) — 3 entries: the requirement change was chosen before its text was committed; the first check left the replay requirement blocked; the second check settled that.

## Scope

This phase was worked by hand in a terminal session, after fvermaut chose option 1 on [timone#244](https://github.com/fvermaut/timone/issues/244) on 2026-10-10. It claims PRD-05.R18 (MUST), whose row for case #132 was revised on this branch ([register](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)).

Replay case #132 now accepts two answers to the misspelled reply "aproved": the runner records the approval and asks nothing, or it asks on the ticket what the word meant. No comment may name the takeover command. The check found that the first version also accepted a question about something else, and narrowed it (`f3e41e8`). The real replay then passed 24 of 24 cases, three tries each, on the final code.

## How to try it

### Against the preview

Timone has no preview configured for pull requests. Use the steps on your own machine below.

### On a local checkout

1. Set up the clone as [README.md](../../../../README.md) says. Then check out `timone/244-replay-case-132-accepts-the-question` and run `npm ci`.
2. `npm run --silent replay -- --dry --case 132` — you should see `PASS #132 — Act on the word, or ask what it meant. Do not name the takeover command. 3 of 3 tries.` This runs the case's scripted answer, the question about "aproved", through its check. It does not call the model.
3. `npm run --silent replay -- --dry` — 24 of 24 cases pass.
4. Optional, needs a model login and costs about $2 to $3: `npm run --silent replay` runs every case on the model, three tries each. On this branch it passed 24 of 24 three times ([phase-59-replay.md](phase-59-replay.md)).
5. Read the changed row for #132 in the table of PRD-05.R18, in [the register](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md), and its ✏ note above the block.

## Verification outcome

Verified in [phase-59-verification.md](phase-59-verification.md), iteration 2 — 1 of 2 fix loops consumed. Every MUST criterion in scope passes; no regression. PRD-05.R18 is `verified` again.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R18 | MUST | api | PASS — on replay run 3 | 1 |
| PRD-05.R7 | MUST | api | PASS — clause 1 on replay run 3 | 1 |
| PRD-05.R2, R3, R4, R5, R10, R11 | MUST | api | PASS | 1 |
| PRD-07.R1, R2, R4, R6, R9, R10 | MUST | api | PASS | 1 |
| PRD-07.R12 | MUST | api | PASS | 0 |
| PRD-08.R5 | MUST | api | PASS | 1 |
| PRD-09.R2, R4, R5 | MUST | api | PASS | 1 |
| PRD-10.R2, R3, R4, R5, R6 | MUST | api | PASS | 1 |

### Outstanding for the human

- [ ] PRD-07.R5, PRD-07.R7, PRD-07.R14 — a watched run with the real daemon is owed by the rule, because the branch changes a file under `src/runner/`. That file is only the replay's list of cases, which the daemon never runs, and none of the three has ever had such a run. See [phase-59-verification.md](phase-59-verification.md) § Live gates.

## Standards review — phase 59

- **Read:** `git diff origin/main...48449cc -- src` (only `src/runner/replay/cases.ts`); `standards/code-smells.md`; `package.json`; `tsconfig.json`. I also read parts of the current `src/runner/replay/cases.ts` for context: the helpers at lines 475–505 and the two other takeover checks at lines 1898–1910 and 3389–3404. There is no ESLint, Prettier or Biome config, and no `doc/standards.md`.
- **Diff:** `origin/main...48449cc` — 1 file under `src/`, +49/−15
- **Findings:** 1

### 1. The "no comment names the takeover command" check is now written out a third time — Duplicated code

- **Where:** `src/runner/replay/cases.ts:2179–2182`
- **What:** The new judge adds this clause:
  ```ts
  when(
    ![...postsOn(seen, "ticket"), ...postsOn(seen, "pull-request")].some((body) => body.includes("timone takeover")),
    "no comment that names the takeover command",
  ),
  ```
  On `origin/main` the same check already appears twice: at line 1903 (`![...onTicket, ...postsOn(seen, "pull-request")].some((body) => body.includes("timone takeover"))`) and at line 3367 (now line 3401), which is the same text character for character. This diff adds the third copy. The literal `"timone takeover"` is repeated each time. The spread `[...postsOn(seen, "ticket"), ...postsOn(seen, "pull-request")]` also repeats what `askedAnything` (line 491) already builds inside itself.
- **Why it matters:** Duplicated code. The rule of three says the third copy is the point where a shared helper costs less than the copies. The reference counts a repeated one-liner too. If the command's name or the rule about where comments are checked ever changes, a fourth case could keep the old version. The test-code exception does not clearly apply. The file already has a set of small helpers of this kind (`postsOn`, `asksSomething`, `askedAnything`, `when`, `allOf`), so a new one would follow the existing pattern rather than start a new one.
- **Suggested remediation:** Add one helper next to `askedAnything`, for example `postsAnywhere(seen)` that returns all ticket and pull-request comments, and `namesTakeover(seen)` built on it. Keep the `"timone takeover"` text only inside that helper. Then use it in all three judges, and let `askedAnything` use `postsAnywhere` as well. — not applied here

## Spec review — phase 59

- **Read:** `git diff origin/main...48449cc -- src` and `-- doc/specs/prd/`; `src/runner/replay/cases.ts` at `48449cc` (case #132 `theOneWordThatSettlesIt`, the judge helpers `postsOn`, `asksSomething`, `askedAnything`, `allOf`, `when`, `postCall`, the file header, the #120 judge and the second #218 case `aMisspelledApprovalWord` for comparison); `doc/specs/prd/prd-05-a-runner-decides-each-step.md`; `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`; the R1 block of `doc/specs/prd/prd-04-one-short-question-instead-of-a-terminal.criteria.md`; `doc/plans/phases/phase-59.md` lines 1–8 and its `## Requirements` section.
- **Diff:** `origin/main...48449cc` — 1 file under `src/`, +49/−15
- **Findings:** 2

The `happened` and `mustDo` texts match the revised #132 row word for word. The diff changes nothing outside case #132.

### 1. The "ask" answer passes whatever else the try did, including starting the next step or recording the approval — PRD-05.R18, PRD-04.R1

- **Where:** `src/runner/replay/cases.ts:2171–2177`
- **What:** The first check is `(approved && !askedAnything(seen)) || asked`. When `asked` is true, the judge looks at nothing else the try did. A try that records the approval, starts planning, and also posts "Did you mean approved?" passes. In that try the `!askedAnything` guard on the approval branch has no effect. A try that asks the question and starts a step in the same wake also passes.
- **Why it matters:** The revised R18 row says "Act on the word, **or** ask what it meant", which means one answer or the other. The row was revised to agree with PRD-04.R1 clause 1. That clause asks for the question "AND no stage session is started". Asking whether a word meant "approve" while also acting on it as an approval is not asking what it meant. The judge cannot fail a try that does both.
- **Suggested remediation:** In the "ask" branch, also require that no step was started (`stepsStarted(seen).length === 0`) and that no approval was recorded from the comment at `wordAt`. The second #218 case uses the same pattern, so a later fix would likely apply to both. — not applied here

### 2. "A question about what the word meant" counts any question that contains "approv" — PRD-05.R18

- **Where:** `src/runner/replay/cases.ts:2160–2162`, `2171–2173`
- **What:** The comment says: "the comment that asks must name the word as he wrote it, or the approval it may mean. A question about anything else does not count." The code is `asksSomething(body) && (body.toLowerCase().includes(word) || /approv/i.test(body))`. In this run, any comment that asks for something usually ends with the standard line `reply "approved", or say what to change`. So the `/approv/i` test is true for almost any question. Two examples pass the judge:
  - The try posts the original request again ("read them and reply "approved", or say what to change"). That ignores the word.
  - The try asks about something else, such as weekly tasks, and ends with "reply approved".
- **Why it matters:** The R18 row for #132 accepts "ask what it meant". PRD-04.R1 clause 1 asks for "one short question asking whether they meant to approve". As written, the matcher is much looser than the row and than its own comment. A question that is not about the word still passes.
- **Suggested remediation:** Count a question only when it names the word as written ("aproved"), as the case's own right call does. Or test the approval wording only in the line `askedFor` returns, and not in the whole body, so that the standard reply line alone does not satisfy it. — not applied here

## Notes

- **Both findings against the requirements are about the replay's check, not about what Timone does.** The check for case #132 can still pass a try it should fail: a question about something else, when the question ends with the usual line asking for "approved"; or a try that both asks and acts on the word. The three real runs passed because the model asked about the word itself. The second #218 case has the same shape, so a later fix would cover both.
- `approvalCall()` in `src/runner/replay/cases.ts` now has no caller (completion report).
- The replay on the model ran three times on this branch: 24 of 24 each time, $3.04, $2.17 and $2.12.
