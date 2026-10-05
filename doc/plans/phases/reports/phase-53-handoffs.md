# Phase 53 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 53a — The sentence, and the two questions code writes

**Built.** `twoWaysToAnswer(project, ticket)` returns the one sentence: ``You can answer here in writing, or in your terminal by running `timone takeover <project>#<n>`.`` `withTwoWaysToAnswer(body, project, ticket)` puts it on its own line, with a blank line after it, at the start of the line holding the last `**What I need from you:**`. It returns the body unchanged when the body is not a question, or already holds the exact command. `isQuestion(body)` says whether the last closing line asks for something: not empty, not starting with "nothing" (any case), no length limit. The spending limit notice and the pieces-failed notice now take the ticket they are posted on and carry the sentence. Their last line is unchanged.

**Files touched.**

- `src/channels/terminal.ts` — added `twoWaysToAnswer` and `withTwoWaysToAnswer`, beside `takeoverCommand`.
- `src/daemon/outcomes.ts` — added `isQuestion`.
- `src/runner/comments.ts` — new `PostedOn { project, ticket }`; `limitNotice(input, on)` and `piecesFailedNotice(failure, on)` return their text through `withTwoWaysToAnswer`; `piecesFailedNotice`'s doc comment now says it names one command, the takeover command, and why.
- `src/runner/actions.ts` — `limitRefusal` and `piecesNotActedOn` pass `{ project: deps.project.name, ticket: run.ticket }`.
- `src/runner/driver.ts` — `atLimit` passes `{ project: project.name, ticket: run.ticket }` (`project` is the `TicketingProject` of the run; same name as `deps.project.name` on the actions side).
- `src/channels/terminal.test.ts` — cases 1 and 2.
- `src/daemon/outcomes.test.ts` — case 3.
- `src/runner/actions.test.ts` — case 4 (`limitRefusal`); one existing expectation updated (see the plan defect below).
- `src/daemon/poll.test.ts` — case 4 (`atLimit`, through `RunnerDriver` in the poll cycle); one existing expectation updated (see below).
- `src/runner/driver.test.ts` — case 5; `namesACommand` narrowed.

**Decisions taken inside the slice.**

- "The exact command" that makes `withTwoWaysToAnswer` leave a body alone is the command in code formatting, `` `timone takeover <project>#<n>` ``. That is the form R2 asks for. A body with the bare command and no backticks still gets the sentence, so it ends up holding the command in code formatting once.
- The two notices take the ticket as a second argument, `on: PostedOn`, rather than as new fields on their inputs. `PiecesFailure` is a union that is also written into the record (`piecesFailedAbout`), so adding fields to it would mix two things.
- `namesACommand` removes the one allowed string, `` `timone takeover scratch-app#12` `` (#12 is the run every caller of the helper uses), and then runs the old check on what is left. Any other backtick, any other `timone <word>`, or "standing note" still makes it true.
- Case 4 for `atLimit` is in `src/daemon/poll.test.ts`, not `driver.test.ts`. The poll test file already drives a `RunnerDriver` over a ticket past its limit with a fake adapter that keeps the posted comments. `driver.test.ts` has no such setup for the limit notice.
- Refactoring I would do, not done here: the case-4 test added to `poll.test.ts` now largely repeats the updated full-body test just above it. One of the two could go at the delivery review.

**Plan defect.** The second checkbox says every other existing case passes *unchanged*, apart from `namesACommand`. No correct build can meet that. Two existing cases compare the whole limit notice word for word, and R1 (and case 4) require the notice to change:

- `src/runner/actions.test.ts` — "says on the ticket where the work stands when the limit is reached: what is done, and what comes next"
- `src/daemon/poll.test.ts` — "tells the ticket once that it spent its limit, frees the project, and wakes nothing, for a new run of a ticket over its limit"

In each I added exactly one line to the expected text: the sentence paragraph, with the run's own ticket number (#12, #7), before the unchanged last line. Nothing else in those cases changed. Without that the validation command cannot exit 0. These two changes are listed here for the human to judge.

**Validation evidence.**

Case 1 — `src/channels/terminal.test.ts` › withTwoWaysToAnswer › "puts the sentence with the command on its own line, above the last closing line, and leaves that line as it was".
Red:
```
× withTwoWaysToAnswer > puts the sentence with the command on its own line, above the last closing line, and leaves that line as it was
TypeError: (0 , withTwoWaysToAnswer) is not a function
Tests  1 failed | 1 passed (2)
```
Green: `✓ src/channels/terminal.test.ts (2 tests)`.

Case 2 — same file: "leaves a message that asks for nothing as it was", "leaves a message that asks for nothing but invites a reply as it was", "leaves a question that already names the command as it was".
Red (the case-1 code added the sentence to every body):
```
× withTwoWaysToAnswer > leaves a message that asks for nothing as it was
× withTwoWaysToAnswer > leaves a message that asks for nothing but invites a reply as it was
× withTwoWaysToAnswer > leaves a question that already names the command as it was
AssertionError: expected '**The plan cannot start yet.** The li…' to be '**The plan cannot start yet.** The li…' // Object.is equality
Tests  3 failed | 2 passed (5)
```
Green: `✓ src/channels/terminal.test.ts (5 tests)`. (`isQuestion` was first written here in its smallest form: only the "nothing" check.)

Case 3 — `src/daemon/outcomes.test.ts` › isQuestion: "is a question when the closing line asks for something", "is not a question when the closing line asks for nothing", "is not a question when there is no closing line", "is not a question when the closing line is empty", "is a question when the ask is longer than 300 characters".
Red:
```
× isQuestion > is not a question when there is no closing line
× isQuestion > is not a question when the closing line is empty
AssertionError: expected true to be false // Object.is equality
Tests  2 failed | 8 passed (10)
```
Green: `Tests 15 passed (15)` (outcomes and terminal together). Three of the five were green on arrival, because case 2 had already made the "nothing" check. The ask and "nothing" cases are the same rule case 2 drove red. The 300-character case was proved able to fail: with `asked.length <= LONGEST_ASK` added to `isQuestion` for a moment, `× isQuestion > is a question when the ask is longer than 300 characters — AssertionError: expected false to be true`. Then reverted, `Tests 10 passed (10)`.

Case 4 — `src/runner/actions.test.ts` › the runner's actions › "names the takeover command for the run's ticket in the limit notice, and keeps its last line" (`limitRefusal`, #12), and `src/daemon/poll.test.ts` › the runner drives its projects in the poll cycle › "names the takeover command for the run's ticket in the limit notice it posts for a new run over its limit, and keeps its last line" (`atLimit`, #7).
Red:
```
× the runner's actions > names the takeover command for the run's ticket in the limit notice, and keeps its last line
× the runner drives its projects in the poll cycle > names the takeover command for the run's ticket in the limit notice it posts for a new run over its limit, and keeps its last line
AssertionError: expected '**This ticket has reached its spendin…' to contain '\n\nYou can answer here in writing, o…'
Tests  2 failed | 192 skipped (194)
```
Green: both pass. The two full-body cases named under the plan defect then failed (`AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]`). After the one-line update to each, `Tests 227 passed (227)` across actions, poll and driver.

Case 5 — `src/runner/driver.test.ts` › RunnerDriver — when the approved list of pieces cannot be acted on (40x) › "names the takeover command for the run's ticket when the approved pieces could not be acted on, and no other command". `namesACommand` was narrowed first.
Red:
```
× RunnerDriver — when the approved list of pieces cannot be acted on (40x) > names the takeover command for the run's ticket when the approved pieces could not be acted on, and no other command
AssertionError: expected '**I could not open a ticket for each …' to contain '\n\nYou can answer here in writing, o…'
Tests  1 failed | 33 passed (34)
```
Green: `Tests 34 passed (34)`. The narrowed helper was proved to still refuse other commands. With " See the standing note, or run `timone status`." added to the notice for a moment, all three 40x cases failed with `expected true to be false`. With the takeover command given ticket #13 instead of #12 for a moment, they failed the same way. Both were reverted, and the file went back to `34 passed`.

Validation block:
```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ npx vitest run src/channels/terminal.test.ts src/daemon/outcomes.test.ts src/runner/actions.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts; echo "exit: $?"
 ✓ src/daemon/outcomes.test.ts (10 tests)
 ✓ src/channels/terminal.test.ts (5 tests)
 ✓ src/runner/actions.test.ts (73 tests)
 ✓ src/daemon/poll.test.ts (121 tests)
 ✓ src/runner/driver.test.ts (34 tests)
 Test Files  5 passed (5)
      Tests  243 passed (243)
exit: 0
```

- [x] Cases 1–5 pass, each one's red run recorded above before its green run.
- [ ] Every other existing case of those files passes unchanged, apart from `namesACommand`: **not met as worded.** Every existing case passes. Two existing cases had one line added to their expected text, because R1 changes the notice they compare word for word (see the plan defect). `namesACommand`'s change is listed above.

Other test files run at the end, for the code that imports the changed files: `src/commands/daemon.test.ts`, `src/commands/takeover.test.ts`, `src/commands/status.test.ts`, `src/commands/record.test.ts`, `src/daemon/prompts.test.ts`, every test file under `src/planner/` and `src/runner/` (23 files, 659 tests): all passed. `npm run replay -- --dry`: "20 of 20 cases passed."

**What 53b must know.**

- `withTwoWaysToAnswer` already leaves a body alone when it is not a question or holds `` `timone takeover <project>#<n>` `` in code formatting. The `post` action can call it as it is.
- `withTwoWaysToAnswer` checks only for the right command. A body holding `timone takeover` with another project or number still gets the sentence added. Refusing such a body is 53b's job.
- `src/channels/terminal.ts` now imports `src/daemon/outcomes.ts`, which imports only `src/adapters/ticketing.ts`. There is no import loop.

## 53b — The runner's questions carry the command, and the runner names the three exceptions

**Built.** The runner's `post` tool takes an optional `leaveOutTakeover`: `"missing-key"`, `"approval-word"` or `"terminal-did-not-settle-it"`, each described in one sentence. After the closing-line check, `post` refuses a body holding `timone takeover` when the field is set (`This question leaves the takeover command out. Remove it, and post again.`), and refuses a body holding `timone takeover` without the exact command for this ticket (``The takeover command for this ticket is `timone takeover <project>#<n>`. Use that one, or leave it out.``). Otherwise, without the field, the body goes through `withTwoWaysToAnswer(body, deps.project.name, run.ticket)`, on the ticket and on the pull request alike, so the command always carries the run's ticket number. With the field, the body is posted as it is. The brief's *Writing to a person* section gains one rule naming `timone takeover` with this ticket, saying the machine adds the sentence, and naming the three field values. The missing-key rule now says to set `leaveOutTakeover` to `"missing-key"`, and still does not name the command. In the replay, `postCall` takes an optional `leaveOutTakeover`, case #120's right call sets `"missing-key"`, and two new cases are added to `CASES`: a pull request closed with no reason, and a misspelled approval word (`aprovd`) on the list of pieces.

**Files touched.**

- `src/runner/tools.ts` — `postInput` gains `leaveOutTakeover` (optional enum, three values).
- `src/runner/actions.ts` — imports `takeoverCommand` and `withTwoWaysToAnswer`; new `TAKEOVER` constant and `holdsExactly(body, command)` helper; `post` gains the two refusals and adds the sentence.
- `src/runner/brief.ts` — one new rule at the end of *Writing to a person*; one sentence added to the missing-key rule.
- `src/runner/replay/cases.ts` — `postCall` takes `leaveOutTakeover` (typed as `PostInput["leaveOutTakeover"]`); case #120's right call sets `"missing-key"`; new `aPullRequestClosedWithNoReason` and `aMisspelledApprovalWord`, both named `#218`, appended to `CASES`; the section heading now says "The twenty-two cases".
- `src/runner/actions.test.ts` — new describe "a question the runner posts names the takeover command (PRD-09)" (cases 1–5). Nothing existing changed.
- `src/runner/brief.test.ts` — new describe "the runner's rule that a question names the takeover command (PRD-09)" (case 6). Nothing existing changed.

**Decisions taken inside the slice.**

- "Holds the exact command" is checked with no digit allowed after the command. On ticket #12, `timone takeover scratch-app#123` holds the words of the command for #12 but names another ticket; a plain substring check let it through (a test for it was seen red, then green). A body holding the right command *and* another one is still let through; no requirement covered it, so I left it.
- The field-set refusal comes before the wrong-command refusal. A body with the field set and any takeover command gets the first message, which asks for the command to be removed: that is what the runner must do in that case.
- With the field set, the body is posted as it is (no `withTwoWaysToAnswer`), as the plan says.
- The judge of the closed-pull-request case reads the closing line for the words "again" and "stop" (the line the action is about, as the cases' header allows), and counts the backticked command for #74 in the whole comment. It must appear exactly once.
- The misspelled-approval case uses a feature ticket parked at `breakdown`, with the requirements approval already in the record and the list of pieces on the branch stamped `Awaiting approval`. Its judge passes on a pieces approval from the word's comment with nothing asked, or on any question on the ticket. It fails on any post holding `timone takeover`.
- Both new cases are named `#218`, the ticket that asked for them. `--case 218` picks both.
- Refactoring I would do, not done here: `post` now holds three refusals in a row; a small `refusal(text)` helper would shorten them. The cases.ts header still says "and five other cases"; it was already out of date before this slice, and I did not touch it.

**Validation evidence.**

Case 1 — `src/runner/actions.test.ts` › a question the runner posts names the takeover command (PRD-09) › "adds the sentence with the command for the run's ticket to a question on the ticket, and keeps its last line".
Red:
```
× ... > adds the sentence with the command for the run's ticket to a question on the ticket, and keeps its last line
AssertionError: expected [ { number: 12, …(1) } ] to deeply equal [ { number: 12, …(1) } ]
Tests  1 failed | 73 skipped (74)
```
Green: `Tests 74 passed (74)`.

Case 2 — same describe › "names the run's ticket, not the pull request, in the command it adds to a question on the pull request" (ticket #12, pull request #31).
Red:
```
× ... > names the run's ticket, not the pull request, in the command it adds to a question on the pull request
AssertionError: expected [ { number: 31, …(1) } ] to deeply equal [ { number: 31, …(1) } ]
Tests  1 failed | 1 passed | 73 skipped (75)
```
(A first red run failed with `expected { ok: false, …(1) }` because the test had not claimed a branch for the run; the setup was fixed, and the red above is the one for the right reason.) Green: `Tests 75 passed (75)`.

Case 3 — same describe › "posts a question unchanged when the runner leaves the command out (missing-key | approval-word | terminal-did-not-settle-it)" and "refuses a question that names the command when the runner said to leave it out (…), and posts nothing" (three values each).
Red:
```
× ... > posts a question unchanged when the runner leaves the command out (missing-key)
× ... > posts a question unchanged when the runner leaves the command out (approval-word)
× ... > posts a question unchanged when the runner leaves the command out (terminal-did-not-settle-it)
× ... > refuses a question that names the command when the runner said to leave it out (missing-key), and posts nothing
× ... (approval-word) ... × ... (terminal-did-not-settle-it) ...
AssertionError: expected [ { number: 12, …(1) } ] to deeply equal [ { number: 12, …(1) } ]
AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }
Tests  6 failed | 2 passed | 73 skipped (81)
```
Green: `Tests 81 passed (81)`; `npx tsc --noEmit` exit 0.

Case 4 — same describe › "refuses a question that names the takeover command of another ticket, names the right one, and posts nothing" (`timone takeover other#9`).
Red:
```
× ... > refuses a question that names the takeover command of another ticket, names the right one, and posts nothing
AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }
Tests  1 failed | 8 passed | 73 skipped (82)
```
Green: `Tests 82 passed (82)`. Then › "refuses a question whose takeover command has a longer number that starts with the ticket's, and posts nothing" (`scratch-app#123` on #12). Red with the substring check:
```
× ... > refuses a question whose takeover command has a longer number that starts with the ticket's, and posts nothing
AssertionError: expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }
Tests  1 failed | 9 passed | 73 skipped (83)
```
Green with `holdsExactly`: `Tests 83 passed (83)`.

Case 5 — same describe › "posts a comment that asks for nothing unchanged". Green on arrival: 53a's `withTwoWaysToAnswer` already leaves a body that asks for nothing alone. Proved able to fail: with `post` changed for a moment to put the sentence above every closing line,
```
× ... > posts a comment that asks for nothing unchanged
AssertionError: expected [ { number: 12, …(1) } ] to deeply equal [ { number: 12, …(1) } ]
```
Reverted: `Tests 84 passed (84)`.

Case 6 — `src/runner/brief.test.ts` › the runner's rule that a question names the takeover command (PRD-09) › "says a question names `timone takeover` with this ticket, that the machine adds the sentence, and names the three cases that leave it out" and "has the comment that asks for a missing key posted with leaveOutTakeover set to missing-key, and still does not name the command".
Red:
```
× ... > says a question names `timone takeover` with this ticket, ...
× ... > has the comment that asks for a missing key posted with leaveOutTakeover set to missing-key, ...
AssertionError: expected '' to contain 'A question tells the reader they can …'
AssertionError: expected '- When a step stops because a key or …' to contain 'When you post it, set leaveOutTakeove…'
Tests  2 failed | 45 skipped (47)
```
Green: `Tests 47 passed (47)`. The existing missing-key test (`not.toContain("timone takeover")`, 40z) still passes unchanged.

Case 7 — `npm run replay -- --dry`. After the `post` change and before #120's right call had its field:
```
FAIL #120 — Not offer the same command again. Say what is actually needed. 0 of 3 tries chose it. Try 1: posted on the ticket: "**The build still needs the Polygon key.** ..." — wanted: no comment that offers the takeover command again. ...
19 of 20 cases passed.
```
With `"missing-key"` on the right call: `PASS #120 ... 3 of 3 tries.` `20 of 20 cases passed.` With the two new cases: `22 of 22 cases passed.` The new judges were proved able to fail: with the closed-pull-request right call given `"terminal-did-not-settle-it"` (so no sentence) and the misspelled-word right call without `"approval-word"` (so the sentence is added), for a moment:
```
FAIL #218 — Ask on the ticket whether to do the work again or to stop, ... — wanted: a comment on the ticket that asks whether to do the work again or to stop, and names `timone takeover scratch-app#74` once ...
FAIL #218 — Record the approval and ask nothing, or ask what the word meant. ... — wanted: no comment that names the takeover command. ...
20 of 22 cases passed.
```
Reverted: `22 of 22 cases passed.`

Validation block:
```
$ npx tsc --noEmit; echo "exit: $?"
exit: 0
$ npx vitest run src/runner/actions.test.ts src/runner/brief.test.ts src/runner/replay/harness.test.ts; echo "exit: $?"
 Test Files  3 passed (3)
      Tests  134 passed (134)
exit: 0
$ npm run replay -- --dry; echo "exit: $?"
PASS #120 — Not offer the same command again. Say what is actually needed. 3 of 3 tries.
PASS #218 — Ask on the ticket whether to do the work again or to stop, and name the takeover command for the ticket once. 3 of 3 tries.
PASS #218 — Record the approval and ask nothing, or ask what the word meant. Do not name the takeover command. 3 of 3 tries.
22 of 22 cases passed. The runner's sessions cost $0.00 in all.
exit: 0
```

- [x] Cases 1–7 pass, with red runs recorded above (case 5 green on arrival, proved able to fail).
- [x] Every existing case of `actions.test.ts` passes unchanged. The diff of `actions.test.ts` and `brief.test.ts` holds only added lines. No existing case compared a question posted through `post` word for word, so no plan defect arose here.

Other test files run at the end, for code that imports the changed files: every test file under `src/runner/` and `src/planner/`, plus `src/daemon/poll.test.ts`, `src/daemon/prompts.test.ts`, `src/commands/daemon.test.ts`, `src/commands/takeover.test.ts`, `src/commands/record.test.ts`, `src/commands/status.test.ts`: 24 files, 793 tests, all passed.

**What the phase close must know.**

- `src/runner/replay/harness.test.ts`'s doc comment still says "The nineteen cases"; it is not in this slice's files, and it was already out of date.
- The two new replay cases are new specifications for the runner. They pass in the dry run. Whether the real model passes them (3 of 3 tries) is only known from a real replay, which costs money and was not run.
