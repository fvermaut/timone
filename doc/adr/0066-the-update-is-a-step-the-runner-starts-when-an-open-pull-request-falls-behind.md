# ADR-0066: The update is a step the runner starts when an open pull request falls behind the default branch, and it runs the check scripts while its fixes stay away from them

- **Status:** accepted
- **Date:** 2026-10-05
- **Source:** planning of [timone#202](https://github.com/fvermaut/timone/issues/202), piece 4 of [timone#197](https://github.com/fvermaut/timone/issues/197). The decision was made while planning that piece; the plan is [phase 50](../plans/phases/phase-50.md).
- **Requirements:** [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) R7 and R14
- **Standing:** [ADR-0063](0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) — an update is a step, so it takes a place; [ADR-0064](0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md) D3 — a branch is brought level by merging the default branch into it, never by rebasing; [ADR-0065](0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) D2 — the planner is not asked about an update; [ADR-0048](0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 — a builder never reads the check scripts

## Context

[PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) says what the update must do. Right after a pull request merges, every other open pull request of the project is brought level with the default branch (R7). The machine fixes any conflict. It runs the project's whole test suite, the check scripts of the pull request's own ticket, and the check scripts of the ticket that just merged. A short section at the top of the pull request says what code had to change. After two failed fixes, the top of the pull request says the work does not pass, and the person decides. A pull request that opens behind the default branch is brought level at once in the same way (R14), and one that opens level is not.

The requirements leave five things open, and the code today has none of them:

- **What notices.** The daemon reads only each run's own pull request. A merge of another ticket's pull request reaches no other run. No call to the forge says how far a branch is behind the default branch.
- **Who starts the update.** Since [ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md), the runner decides every step of a run.
- **Which pull requests.** A project can have open pull requests that no run owns: a person's own, for example.
- **Who may see the check scripts.** The check scripts are the probes under the project's probe folder. [ADR-0048](0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D4 keeps every step that writes code away from them, by a hook. The check sees them and never fixes: a fresh fix context fixes, and the check reads back only the commit. The update has to do both: run the check scripts, and fix.
- **Who writes the section at the top of the pull request.** Code already writes one section there after every step: the list of departures.

Alternatives considered:

- **Let GitHub bring the branch level** (its "Update branch" call), then test in a box. No merge in the box. Rejected: GitHub does not use Timone's merge rule for `STATUS.md` and the registers ([ADR-0064](0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md)), and it cannot fix a conflict. It would stop on almost every update.
- **Code starts the update by itself, without the runner.** A merge is a fact, and the answer is always the same step. Rejected: the runner is what knows the rest of the run. A step may already be running, a person may have asked for a change on the pull request, the ticket may be held or over its limit. Code that starts steps beside the runner would have to know all of that again, and two deciders on one run is what ADR-0060 removed.
- **Wake every run with an open pull request on every merge of the project**, and let each runner find out whether its branch is behind. Rejected: a run whose branch already holds the new commits would be woken for nothing, and R14's case, a pull request that opens after the merge, is not a merge at all.
- **The update is a building step, and the check runs again after it.** The update merges, fixes conflicts and runs the whole test suite, with the hook keeping it away from the check scripts like any builder. Then the existing check step runs the probes. Rejected: the check re-judges the whole phase: the full regression set, the screens, the register, and a new report. That is the cost of a whole check on every merge, for every open pull request. The two fixes the requirements allow would also be split across two steps that each count their own.
- **The update session fixes code itself and runs the check scripts.** One context, the cheapest. Rejected: that is a builder that has read the checks, the fault ADR-0048 D4 exists to stop.
- **The update session writes the section on the pull request itself**, with `gh pr edit`. Rejected: then nothing checks that the three test sets ran, and the section can be lost when delivery refreshes the description. The departures section has the same problem, and code already solves it.
- **Update every open pull request of the project, including a person's own.** Rejected: a person's pull request has no ticket, no plan and no check scripts. It has no run to own the step, and the place, the limit and the record all belong to a run. The person who opened it brings it level, as today.

## Decision

### D1 — Code notices a pull request behind the default branch, and wakes its runner once for each new head of the default branch

**On every poll cycle, for each run of the project that has an open pull request and no step running, code asks the forge how many commits the run's branch is behind the default branch, and what the default branch's head is.** One call answers both: GitHub's compare of the default branch with the branch. When the branch is behind, and this run has not been told about this head of the default branch, the runner is woken with an event. The event says the branch is behind, by how many commits, and at which head of the default branch. It is written as noticed, so it is told once for each head.

This covers both requirements with one rule. After a merge, the default branch has a new head, and every open pull request that does not hold it is behind (R7). A pull request that opens behind is a run with an open pull request whose branch is behind (R14). A pull request that opens level is not behind, and nothing happens (R14, clause 3).

A ticket under the hold is not woken, as for every other fact. It is told once the hold comes off.

### D2 — The runner starts the update, as a step of its own

**`update` is a new stage of the pipeline.** The runner's rules say: when told the branch is behind the default branch, and no step is running, start the update. The update owns the run's work branch, takes a place ([ADR-0063](0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md)), counts towards the ticket's limit, and is not asked of the planner ([ADR-0065](0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) D2). It is not in the default order of any kind of ticket: it is started on the fact, not in sequence, so it never counts as a step left out.

When the update ends, the runner does nothing more. The run waits on its pull request as before. When the default branch moves again, D1 tells it again.

### D3 — Only pull requests a run owns are updated

**The update covers every open pull request of the project that belongs to a run in the ledger.** Every pull request the machine opened belongs to one: a run ends only when its pull request merges or closes, and a ticket found at pickup with an open pull request is given a run that takes it over (ADR-0063 D4). A pull request opened by a person, with no ticket and no run, is not updated.

### D4 — The update session runs the checks and never fixes with its own hands

**The update session works as the check does.** It merges the default branch into the work branch (ADR-0064 D3). It runs the three test sets. It never edits code itself. A conflict that git and Timone's merge rule leave, and a test that fails, each go to a **fresh fix context**: a sub-agent of the session, given the conflicted files or the failing test, the two tickets' plans and the project's standards, and told never to open the probe folders. The fix context commits, and returns the commit and a few plain sentences on what it changed and why. The session keeps those sentences, for the section on the pull request, and never reads the diff.

**The hook lets the update read the probe folders, as it lets the check.** The fix context is a sub-agent of that session, so the hook cannot keep it out: the brief does. This is the same exposure as the check's own fix context today, and it is accepted for the same reason.

**The three test sets** are:

1. the project's whole test suite;
2. the check scripts of the pull request's own ticket: the probes of the requirements its plan claims;
3. the check scripts of each ticket whose work arrived on the default branch since the branch was last level: the probes of the requirements claimed by each plan that arrived with it.

A requirement with no probe, such as one checked by watching or by a person, has no check script, and the update says so rather than inventing one. **Timone computes sets 2 and 3** from the branch and the default branch, with one command (`node dist/cli.js update-checks <project>`, run in the box), so that every update draws the same line.

**Two fixes at most**, counted over the whole update: conflict fixes are not counted, test fixes are. A test that still fails after the second fix ends the update with the work marked as not passing. Nothing is asked of anyone during the update.

### D5 — The update writes a record, and code puts its section at the top of the pull request

**The update appends one entry to `doc/plans/phases/reports/phase-NN-update.md`**, NN being the phase of the run's own plan, and commits and pushes it with its merge and its fixes. The entry names the head of the default branch it brought the branch level with, the tickets whose work arrived, each of the three test sets with its result, the code it had to change and why in plain words, and whether the work passes. It writes no `STATUS.md`: the state of an open pull request is read on the pull request, and a `STATUS.md` commit on every merge would only add work for the next update.

**After every step, code reads the newest entry and puts its section at the top of the pull request's description**, above the departures, between its own two marker lines, as it does for the departures. The section is written by code from the entry. When the entry lacks one of the three test sets, the section says that set did not run, and the work does not count as passing. When the work does not pass, the section's first line says so and names the failure.

## Consequences

- **One call to the forge per cycle for each run with an open pull request.** With a few open pull requests per project, that is well within GitHub's limit.
- **An update costs a step:** a box, a session and a place, after every merge, for every open pull request the merge left behind. The more pull requests wait for a person, the more updates each merge causes. PRD-07 accepted that more pull requests wait at once.
- **A merge that lands while an update runs** leaves the branch behind again when the update ends. D1 tells the runner again, and a second update follows. Nothing is lost; it costs another step.
- **The update's fix context can read the check scripts.** Only its brief keeps it out, as for the check's fix context. A later change that lets the hook tell a sub-agent from its session would close both at once.
- **A person's own pull request is not brought level.** If the PRD's "every other open pull request" was meant to include those, this record is what to change.
- **The update does not re-judge the phase.** It runs the requirements' check scripts and the whole test suite, not the screens, the regression set or the register. A requirement it finds failing is said on the pull request, and its register line is not changed: changing it is the check's job.
- **GitHub's own "Update branch" call is not refused by the forge guard today.** A session that used it would bring a branch level without Timone's merge rule. The update's instructions say to merge in the box; refusing the call is left until it is seen used.
