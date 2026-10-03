# Handover — Timone — 2026-10-03

> Prior handover: none for this topic. This file holds the decisions of one interview, so that the session that writes the requirements does not ask them again.

## Snapshot

fvermaut wants the machine to work on several tickets of one project at the same time. He answered six questions in a terminal session on 3 October 2026 (session `a768710b-e81c-4e20-beb1-48ebab9d275a`). He read the summary below, changed nothing, and asked for the work to go to the daemon as a ticket. Nothing is written yet beyond this file and two new words in [`CONTEXT.md`](../../CONTEXT.md): **planner** and **update**.

## The request, as he wrote it

> I want to be able to work on multiple tickets at the same time for one project. Grill me through achieving this. From the top of my head, I think it AT LEAST implies:
> - having an agent that can manage rebasing/merging PRs (when another one has been merged before) and being able to understand what are the implications and the tests to run
> - understanding the dependencies between tickets/tasks, and maybe have a planner agent the runs parallel tasks in an optimal way (i.e. minimizing overlap - the kind of thing a team would decide during scrum planning)
> - breakdown phase could actually think about parallelizing tasks in this case
> - etc. (TBD)

## What the code does today (read on 2026-10-03, at `4b653ca`)

- **One ticket per project at a time.** `RunStore` in `src/daemon/runs.ts` keeps two rules: one running session per project, and a parked run that owns a branch holds the project until it is `done` or `cancelled`. A run ends only when its pull request merges (`endRun` in `src/runner/actions.ts`). So an open pull request waiting for review stops the whole project. This is PRD-02 R10 and [ADR-0026](../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) ("the chunk holds the project").
- **The first reason for the rule is gone.** It was "two agents in one working copy". Since [ADR-0041](../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) every run clones the project into its own container.
- **Step tickets already declare dependencies**, as GitHub's `blocked by` relation (`blockStep` in `src/adapters/github-tickets.ts`). The next step is the first one that is open, unblocked and unassigned. Nothing asks the breakdown to make steps independent.
- **Inside one build**, slices that share no file may already run in parallel (process.md stage 6).
- **A plan lists every file each slice creates or changes** (process.md stage 5, "file markers").
- **The machine never merges.** Only a named person does ([ADR-0060](../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)).

## Decisions made this session

All fvermaut's, 2026-10-03. Each was a question with a recommendation; he took the recommendation each time.

1. **Both changes, not one.** A ticket frees its project when its pull request opens, not when it merges. And several tickets of one project can be worked on at the same time.
2. **A real dependency waits for the merge.** A ticket that needs another ticket's work waits until that pull request merges. Nothing is built on top of an open pull request. Tickets that do not need each other run at the same time, before any pull request merges.
3. **A planner decides who runs.** It is a new agent that sees all of a project's tickets (see **Planner** in `CONTEXT.md`); it is not the runner, which sees one run. It decides **after a ticket's plan is written and before its build starts**, because the plan is the first place that names the files a ticket will change. It compares those files with the builds running and the pull requests not yet merged. A small overlap runs at the same time; a large one waits. When it holds a ticket back, it says on that ticket which ticket it waits for and why, and a named person can overrule it.
4. **A limit per project**, a number in `timone.yaml`, starting at 2. A ticket takes a place while one of its steps is running, whatever the step. A ticket waiting for a person, for a merge, or for its turn takes no place, and an open pull request takes none. When a place frees, a ticket labelled `priority:high` goes first, then the oldest.
5. **The update after a merge** (see **Update** in `CONTEXT.md`). Right after a pull request merges, every other open pull request of the project is brought level with the default branch. The machine then runs the whole test suite, the check scripts of the pull request's own ticket, and the check scripts of the ticket that just merged, so it tests both ways. Code changed to fix a conflict is described in a short section at the top of the pull request. If a test still fails after two fixes, the pull request says so, with the failure, and the person decides. Rejected: rebuilding the ticket from its plan; updating only when the person is about to merge.
6. **The breakdown aims for pieces that can run at the same time.** When two cuts are equally good, it chooses the one where fewer pieces wait for each other and fewer share files. When it is put up for approval, it shows the order, for example "1, then 2 and 3 together, then 4". The rule that each piece works end to end stays. Rejected: giving the planner a guess of each piece's files from the breakdown.

## Choices made without asking

He was shown these and did not object. Each can still be changed.

- To overrule the planner, a named person writes on the ticket in plain words, as with the runner today.
- A takeover in a person's own terminal takes no place.
- No total limit across all projects for now: up to six sessions at once on the one Claude login.
- A waiting ticket's plan is not rewritten after another merge. Its build adjusts the plan when it does not fit, as builds already do.
- The first watched run is on scratch-app, with test tickets the machine writes so that they overlap on purpose. Never on ivtrends.

## Risks

- **Files almost every ticket changes will conflict at every merge** until they are handled: `STATUS.md` (written on each run's own branch since #196), the requirement registers, and documents numbered by taking the next free number (phase files, ADRs, triage records). Two tickets planned at once would take the same phase number. This is a technical fix for the machine, and it has to come first.
- **Some conflicts no tool shows**, for example two database changes that work alone and fail together. Only the tests catch them.
- **More pull requests wait for the person at once.** A limit on waiting pull requests was offered and left for later.
- **The old rule is written in several places:** PRD-02 R10, ADR-0026, the sentence in process.md stage 6 that says a ticket-driven run holds its project until its pull request ends, and `RunStore` in `src/daemon/runs.ts`. All of them must change, or the old rule comes back.

## Exact next action

Write the requirements: PRD-07 with its criteria register, from the decisions above. The interview is done and needs no second round. It changes PRD-02 R10 and ADR-0026, so it also needs a decision record.

## Open questions

- None from the interview. What counts as a "large" overlap is the planner's judgement, by decision 3, and not a number to set now.
