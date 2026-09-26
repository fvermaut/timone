# PRD-05: A runner decides each step of a run

> **Status:** Draft
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-05-a-runner-decides-each-step.criteria.md](prd-05-a-runner-decides-each-step.criteria.md)
> **Phases:** none yet

## Problem

Timone moves a ticket through its steps with fixed code. Each step is already done by an agent. But the code between two steps decides everything else: how a step ended, whether a failure is worth a retry, where the run waits, and what the ticket says. It decides by matching exact text and by rules written one case at a time.

That code breaks whenever a run meets a case nobody wrote a rule for, and this happens often. Of the 35 defects filed on Timone from 5 to 26 September, about 20 are this kind. A finished plan was thrown away because an emoji was one place to the left ([#139](https://github.com/fvermaut/timone/issues/139)). A run stayed "active" for ever and no command could move it ([#143](https://github.com/fvermaut/timone/issues/143), [#161](https://github.com/fvermaut/timone/issues/161)). A ticket waited for the answer to a question nobody asked ([#144](https://github.com/fvermaut/timone/issues/144)). Each time, the operator had to notice, open a terminal and repair the run by hand. A person reading the ticket and the branch would have seen what to do in a minute.

The fixed order also cannot bend when a case calls for it. A request whose requirements were already approved was still sent to the interview ([#104](https://github.com/fvermaut/timone/issues/104)).

Source: the interview of 2026-09-26 in the terminal. The operator proposed the change, and every decision in it was his answer to one question. The decision is recorded in [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md).

## Goals

- A run that meets an unexpected case recovers by itself, without the operator opening a terminal. This serves the second business goal: the operator's part is decisions and reviews only.
- The written process stays the default, and the machine may leave it when a case calls for it. Every departure is visible to the operator.
- Nothing reaches a project's default branch without a yes from a named person. This goal outranks the two above.
- Spending on one ticket has a limit that code enforces.

## Scope

### In scope

A **runner** is an agent that decides what happens next in a run. It wakes when something happens, reads the run, and chooses the next step. The written order of steps is its default, and it may leave that order when it has a reason (R1). It acts only through a small set of actions that code gives it, and it edits no files itself (R2).

Three rules hold in code, whatever the runner decides:

- **Nothing reaches a default branch without a yes from a named person** (R3). A run that changed the project's files always ends at a pull request (R4). The runner never records an approval that nobody gave (R7).
- **Every departure is shown twice.** The runner posts it on the ticket at the moment it happens (R6). Code lists all departures on the pull request, with a skipped check on the first line (R5).
- **Each ticket has a spending limit of $150** (R8).

People talk to the runner in plain words on the ticket (R9). Only people named for the project can instruct it (R10). `timone takeover` and `timone cancel` stay, and `timone retry` goes (R11).

The runner wakes on events, and it also checks every 15 minutes while a step runs (R12). It can send a running step a message, or stop it (R13). Each time it wakes it is a fresh session, working from a record of the run that code keeps (R14). One project's work no longer holds up the others (R15). If the runner itself fails, it is started again, and the run is not failed for it (R16).

When the runner finds a fault in Timone itself, it files an issue or adds to one, and does not fix it (R17).

The failures recorded since 5 September become a replay set that the runner must pass before it runs a real project (R18). Each project runs on either the runner or the current daemon, until every project has moved (R19). Then the old code between steps is removed (R20).

### Out of scope

- **The runner fixing Timone.** It files and does not fix, for now. Putting the `timone` label back on Timone's issues is how that would be switched on later, and nothing new would need building.
- **Rewriting `process.md` and the step skills now.** They change when the runner is built, so they never describe something that does not exist yet.
- **Reading across many runs to propose changes to the process.** This needs the record of each job that the map [#92](https://github.com/fvermaut/timone/issues/92) is working out. The run record here (R14) is one input to it.
- **A chat channel** (Slack or similar). Plain words on the ticket come first.
- **A different model per step.** The steps keep the models set in `pipeline.ts`. Only the runner's own model is chosen here.

## Open Questions

- **Does the ask check stay?** The ask check ([ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md)) was added because a step could not see enough to ask a cheap question. The runner writes with the whole run in view. The build decides whether the check is still needed, and says so on its pull request.
- **Should a step still running when the limit is reached be stopped?** As written, the step finishes and no new one starts. A ticket can therefore go over its limit by one step's cost, which was $231 at most in the last five weeks. The first live run on scratch-app shows whether this matters.
