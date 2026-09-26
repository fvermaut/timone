# ADR-0060: A runner decides each step of a run, and nothing merges without a person's yes

- **Status:** accepted
- **Date:** 2026-09-26
- **Source:** fvermaut, in an interview in the terminal on 2026-09-26. He proposed the change. Each decision below was put to him as one question with a recommendation, and D1 to D8 are his answers. D9 lists what the interviewer decided and he did not object to. The requirements are [PRD-05](../specs/prd/prd-05-a-runner-decides-each-step.md).
- **Supersedes, once the runner has replaced the old code on every project:** [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md), [ADR-0023](0023-one-answer-one-session.md), [ADR-0031](0031-a-handoff-is-a-wait-not-a-failure.md), [ADR-0034](0034-a-technical-stop-is-retried-not-reported.md), [ADR-0035](0035-a-resolved-escalation-hands-the-run-back.md), [ADR-0046](0046-a-pull-request-closed-without-merging-holds-its-ticket-and-asks.md), [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0056](0056-a-build-stages-question-rides-to-the-pull-request.md)
- **Amends, on the same condition:** [ADR-0014](0014-artifact-first-gates.md) (a gate may be skipped, with notice), [ADR-0024](0024-every-open-ticket-answers-for-itself.md) (the runner writes what a ticket needs), [ADR-0030](0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 (chunk zero merges only on a recorded yes), [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md) (`retry` is removed), [ADR-0049](0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) (the holder stays, the wait value goes), [ADR-0059](0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md) D2 (there is no failed run for takeover to open)

## Context

Today the order of steps is code. `src/daemon/pipeline.ts` holds a table in which each stage names the stage after it. Each stage is already an agent: a Claude session that runs the stage's instructions in the box. What is code is everything between two stages. It reads how a stage ended from one exact line on the ticket. It judges a failure by matching words in the error. It retries twice. It chooses where a run waits and what the ticket says.

That code fails in cases nobody wrote a rule for. Of the 35 defects filed on this repository from 5 to 26 September, about 20 are that kind:

- #139 threw away a finished plan because an emoji was one place to the left.
- In #140 a retry could never pass.
- In #143 and #161 a run stayed active for ever, and no command could move it.
- In #144 a ticket waited for the answer to a question nobody asked.

Each fix added a rule, and most of ADR-0017 to ADR-0059 are those rules. The list does not end. On 11 September fvermaut stopped running the daemon on Timone, after #122 failed twice at planning and a terminal session did the same work in one pass.

Only one defect in that period is about the order itself: #104, where approved requirements were still sent to the interview. The code says it is choosing badly there. A triage label "cannot carry a judgement — so the daemon takes the safe road every time".

A deciding layer was refused twice before. [ADR-0033](0033-a-stage-that-cannot-act-on-an-answer-escalates.md) refused a layer that would read comments and decide. [ADR-0054](0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md) D2 allowed the ask check only to make a question cheaper. Both rested on the same fear: work passed that nobody passed, and nobody sees it. On scratch-app #37 (18 August), a terminal session took an approval and then carried on. It wrote the plan, built the code, checked the code itself and opened pull request #38. ADR-0035 was written to stop that.

This decision answers the same fear in another way. It does not stop the machine from leaving the process. It makes every departure visible, and it keeps one approval that nothing can skip.

**Alternatives considered:**

- **Keep the fixed order, and keep fixing the code between stages.** No new risk. The defect record shows the cost: a new rule for each new case, found in a live run, with no end.
- **An agent that only recovers from failures, with the order still fixed.** It removes most of the defects and keeps every step. Rejected: fvermaut wants the machine able to leave the process when a case calls for it, and #104 is one such case. A recovering agent needs the same judgement anyway.
- **An agent that chooses, but may never skip a check.** This was the interviewer's recommendation: skipping a step whose purpose is already met is allowed, and skipping a check whose purpose is not met is never allowed. fvermaut rejected it: *"I think both are fine. As long as there's always a final approval stage by the human (like the PR), with clear departures cited, it's fine."*
- **An agent that chooses, with the pull request as the one approval never skipped, and every departure listed** (chosen).

## Decision

**D1 — A runner decides each step.** After each event in a run, a runner session reads the run and decides what happens next. **The order in `process.md` is its default, not a rule.** It follows that order unless it has a reason. It may skip any step, including the operator's approval of the requirements and of the list of pieces.

**D2 — Nothing reaches a default branch without a yes from a named person.** The machine never merges a pull request. It performs one merge today: chunk zero, merged when the list of pieces is approved (ADR-0030 D2). **That merge now happens only when a named person's approval is on record.** If the runner skipped that approval, the documents reach a pull request instead.

**D3 — Every departure is shown twice.** When the runner leaves the default order, it says so on the ticket at that moment, gives its reason, and carries on without waiting. On the pull request, **code writes the list of departures**. It compares the steps that ran with the default order, and the runner adds only the reasons. A skipped check is the first line of the pull request.

**D4 — Code keeps what protects the operator.** The runner acts only through actions that code gives it:

- start a stage session, with instructions;
- send a running stage a message;
- stop a stage;
- post on the ticket or the pull request;
- set or clear the hold on a ticket;
- file or update a Timone issue;
- end the run.

It edits no files and pushes nothing itself. To fix something, it starts a session. Code also keeps five things: the lock that allows one run per project, the limit per ticket, the list of people who may instruct, the list of departures, and the restart of a runner that failed.

**D5 — Each ticket has a limit of $150, enforced by code.** Code adds up the cost of every session on a ticket, the runner's own sessions included. At the limit, no new session starts. The runner says on the ticket what was spent and where the work stands. A named person's "continue" allows another $150. The amount can be changed per project.

**D6 — People instruct the runner in plain words on the ticket.** Every comment from a named person wakes it, and it acts or answers. **Only people named for the project in `timone.yaml` can instruct it**, the operator by default. Code passes the runner no one else's comments. `timone takeover` stays. `timone cancel` stays, and works without the runner. `timone retry` is removed.

**D7 — The runner wakes on events, and checks every 15 minutes.** The events are: a stage ends, fails or goes silent too long, or a named person comments. While a stage runs, code gives the runner a short summary every 15 minutes: the commands the stage ran, the time and the cost. The runner may send the stage a message or stop it.

**D8 — A fault in Timone is filed, not fixed.** When the runner judges that a fault is Timone's, it searches the open issues on this repository. It adds its evidence to a matching issue, or files a new one labelled `bug`. It files nothing for a network failure that a retry fixed. It does not change Timone. Putting the `timone` label back on Timone's issues is what would later let a run fix Timone, through a pull request.

**D9 — How it is built.** These were decided by the interviewer, and fvermaut did not object:

- **A fresh runner session each time it wakes.** It reads a run record that code keeps: the steps that ran, each decision and its reason, each departure, and the cost so far. A run can wait days for a person. [ADR-0013](0013-stateless-session-reentry.md) already chose a fresh session over a held one, for stages.
- **The runner runs on the operator's machine, beside the daemon, one per run.** One project's session then no longer stops the other projects (#148).
- **It runs on Opus 5.5 at medium effort.** Judging is the whole job, and each wake reads little.
- **The recorded failures become a replay set** that the runner must pass.
- **It is built beside the current daemon and chosen per project.** scratch-app goes first, then ivtrends, and then the old code between stages is deleted. Until then the old daemon gets only the fixes that block ivtrends.

## Consequences

- The machine may now build a whole feature on requirements the operator never read. The cost is wasted work, not unreviewed merges, because the pull request is still his.
- The operator will receive pull requests that no second session checked. Each one says so on its first line. ivtrends#118 shows what such a pull request looks like without that line.
- Timone's guarantees stop holding by construction for every step but one. Only D2 to D6 hold by code. Everything else holds because the runner chose it, and the run record is how anyone finds out what it chose.
- The first business goal in [product-overview.md](../specs/product-overview.md) says one process is "enforced identically on every project". After this decision, the process is followed by default and every departure is shown.
- Skills that refuse to start without an approval must accept an approval that the runner skipped and recorded. Planning, for example, refuses a requirements file still marked `Draft`. `process.md` and the skills change when the runner is built, not before, so they never describe something that does not exist yet.
- Most of the code between stages in `poll.ts`, `session.ts` and `runs.ts` is deleted at the end. The ADRs listed above get their status lines changed in that same change, not now: until then they still govern the runs on ivtrends.
- [PRD-04](../specs/prd/prd-04-one-short-question-instead-of-a-terminal.md) was built except for R7, which would let a written answer free a stuck job. The runner reads plain words, so R7 is deprecated and taken over by PRD-05. Whether the ask check stays in front of the runner's messages is left to the build.
- The runner costs money too. The cost is small next to a build session ($36 on average), and it counts toward the ticket's limit.
