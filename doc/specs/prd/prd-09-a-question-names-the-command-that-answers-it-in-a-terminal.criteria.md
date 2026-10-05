# PRD-09 Acceptance Criteria — A question names the command that answers it in a terminal

> Formal register for [prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md](prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

In this register, a **question** is a message the machine posts on a ticket or on its pull request whose last line starting with `**What I need from you:**` asks the person for something, that is, says anything other than "nothing". **The command** for ticket `<n>` of project `<project>` is `timone takeover <project>#<n>`, with the project's name as `timone.yaml` gives it and the ticket's number, also when the message is on the pull request.

## R1 — Every question names the command, and says both ways to answer

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run of ticket `<n>` of project `<project>`
      WHEN the machine posts a question on the ticket, and none of the cases of R3 applies
      THEN the question contains the command
      AND it says that the person can answer either by writing on the ticket or by running the command
    - GIVEN a run whose pull request is open
      WHEN the machine posts a question on the pull request, as a comment or in the pull request's description, and none of the cases of R3 applies
      THEN the question contains the command, with the ticket's number and not the pull request's
    - GIVEN each way the machine posts a message: the runner's post action, a step's own comment, and each message that code writes itself (for example the spending limit notice and the notice that an approved list of pieces could not be acted on)
      WHEN that way posts a question
      THEN the first two clauses hold for it
- **Falsified-by:** to be named by the build, before this can reach `verified`. It needs a test at each way of posting that is handed a question without the command and fails if the question reaches the ticket without it, and a replay case in which a step asks a question.
- **Verification hint:** the runner's post action is `post` in `src/runner/actions.ts`; the messages code writes are in `src/runner/comments.ts`; the command is built by `takeoverCommand` in `src/channels/terminal.ts`. A step posts its own comments from its session, so its part is checked by the replay set ([PRD-05.R18](prd-05-a-runner-decides-each-step.criteria.md#r18--the-runner-passes-a-replay-of-the-recorded-failures)) and by reading the step skills' rules on asking.

## R2 — The command can be copied and run as it stands

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a question that R1 says contains the command
      WHEN its text is read
      THEN the command is inside code formatting (one pair of backticks, or a code block)
      AND nothing but the command is inside that code formatting
      AND it holds no placeholder: the project's name and the ticket's number are the real ones
    - GIVEN that question is the newest question on the ticket
      WHEN `timone status` is run
      THEN it shows what the question asks, as it did before the command was added
- **Verification hint:** a test on each message code writes, and on the runner's post action, that matches the command with the exact pattern ``` `timone takeover <project>#<n>` ```. For the second clause: what a run waits on is read from the last line by `askedFor` in `src/daemon/outcomes.ts`, which reads nothing from a line longer than `LONGEST_ASK` (300 characters). A command added to that line must not push it past that.

## R3 — Three kinds of question leave the command out

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a step stopped because a key or secret is missing where it runs
      WHEN the machine asks for the key to be added
      THEN the message does not contain `timone takeover`, not even to say that it will not help
    - GIVEN a run waiting for an approval
      WHEN a named person replies with a word that is plainly a misspelling of an approval word, and the machine asks whether they meant to approve
      THEN that question does not contain `timone takeover` ([PRD-04.R1](prd-04-one-short-question-instead-of-a-terminal.criteria.md#r1--a-reply-that-is-neither-an-approval-nor-a-change-request-is-met-with-one-short-question))
    - GIVEN a terminal session opened with the command on this ticket has ended, and what it was opened for is still not settled
      WHEN the machine next asks the person something on the ticket or its pull request
      THEN that question does not contain `timone takeover`, and says what is actually needed ([PRD-05.R18](prd-05-a-runner-decides-each-step.criteria.md#r18--the-runner-passes-a-replay-of-the-recorded-failures), case [#120](https://github.com/fvermaut/timone/issues/120))
- **Verification hint:** the replay set in `src/runner/replay/cases.ts` already holds the missing-key case and case #120, and the case for #120 already fails on any comment containing `timone takeover`. A case for the misspelled approval word is to be added. The runner's rule for the missing key is in `src/runner/brief.ts`, in the section *What the written process says when work stops*.

## R4 — A takeover typed while a step is running waits for it, then opens

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a run of ticket `<n>` whose step is still running, for example because it has just posted a question and has not yet ended
      WHEN a named person runs the command
      THEN the command does not refuse
      AND it says at the terminal, in one sentence, which step it waits for, and that the person can stop waiting with Ctrl-C
    - GIVEN a takeover waiting this way
      WHEN the step ends
      THEN the terminal session opens on the ticket
      AND the runner starts no other step on the ticket between the step's end and the session opening
      AND when the session ends, the runner wakes and reads what it left on the ticket, as PRD-05.R11 says
    - GIVEN a takeover waiting this way
      WHEN the person stops it before the step ends
      THEN the run is the same as if the command had never been typed, and the runner carries on as it would have
    - GIVEN a run whose step is running
      WHEN the command is typed, both while the daemon is running and holds the run ledger, and while no daemon is running
      THEN it behaves as the clauses above say, or, when no daemon is running and so no step can end, it says so and does not wait
- **Falsified-by:** two tests, each seen to fail first in [phase 51](../../plans/phases/phase-51.md) ([handoffs](../../plans/phases/reports/phase-51-handoffs.md)). In `src/commands/takeover.test.ts`: "a takeover typed while the ticket's step runs (ADR-0067) > says which step it waits for, and opens the session when the step ends, before the runner is woken (PRD-09.R4 clauses 1 and 2)". In `src/runner/driver.test.ts`: "RunnerDriver — a step ends on a run a terminal waits for (ADR-0067 D2) > wakes the runner with the step's end, and clears the waiting terminal, when that terminal's process is gone (PRD-09.R4 clause 3, ADR-0067 D2)". The check in PRD-05.R11's probe that a takeover of a run the machine is working on opens no session is replaced by one that it waits and then opens, seen to fail first. Verification makes that change, not the build.
- **Verification hint:** `findTakeover` and `claimForTakeover` in `src/commands/takeover.ts` answer *"I'm working on … right now"* for a run that is `picked-up` or `active`; that answer is what changes. A test with a fake step that ends after the command is typed shows the wait, the opening, and that the runner was not woken into a new step in between.

## R5 — The written rules say the same as the machine does

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the build of this PRD is merged
      WHEN `process.md`, the runner's instructions in `src/runner/brief.ts`, and the step skills under `.claude/skills/` are read
      THEN each place that tells the machine how to ask a person something says that a question names the command, with the three cases of R3 left out
      AND `process.md`'s paragraph on `timone takeover` says that a takeover typed while a step runs waits for it to end, then opens
      AND no line in them says that a takeover refuses while a step of its own ticket runs
- **Verification hint:** read the places named above. In `process.md` these are the paragraph on `timone takeover` and the paragraph that starts *"Every command a ticket names can be run while the daemon is running"*. That second paragraph's rule, that no message may name a command the machine would refuse, stays as it is: R4 makes it true for the command a question names. [PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes) carries a dated note that R4 replaces its refusal.
