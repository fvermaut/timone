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
