# PRD-07: Several tickets of one project at the same time

> **Status:** Active
> **Approved by:** fvermaut on 2026-10-03T17:05:30Z
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-07-several-tickets-of-one-project-at-once.criteria.md](prd-07-several-tickets-of-one-project-at-once.criteria.md)
> **Phases:** none yet

## Problem

The machine works on one ticket of a project at a time. A ticket keeps the project until its pull request merges. So a pull request that waits for review stops all other work on its project, sometimes for days. A one-line bug waits behind a feature that is already built and only needs a person to read it.

The first reason for this rule was two agents working in one copy of the repository. That reason is gone: since [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) every run clones the project into its own box. The rule stayed.

fvermaut asked for this on 3 October 2026 ([timone#197](https://github.com/fvermaut/timone/issues/197)): "I want to be able to work on multiple tickets at the same time for one project." He answered six questions in a terminal session the same day. Every decision below is his. The source is the handover file [2026-10-03-several-tickets-at-once.md](../../handover/2026-10-03-several-tickets-at-once.md), which also records what the code does today and the risks. It uses two words from [`CONTEXT.md`](../../../CONTEXT.md): the **planner** and the **update**.

A decision record that replaces the rule of [ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md) ("the chunk holds the project") is still to be written. ✏ 2026-10-04: it is written. [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) replaces that rule: a ticket takes one of its project's places only while one of its steps runs, and a freed place is given to one waiting ticket.

## Goals

- A pull request waiting for review no longer stops other work on its project. This serves the product's second goal: the operator's part is decisions and reviews, and the machine does not wait for them when it has other work.
- Tickets that do not need each other are built at the same time, up to a limit per project.
- Work is never built on top of work that is not merged. Nothing reaches a default branch without a yes from a named person, as [PRD-05.R3](prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person) says. This goal outranks the two above.
- When one pull request merges, every other open pull request of the project still works on top of it, and the person can see what had to change.

## Scope

### In scope

**The project is free when the pull request opens.** A ticket stops holding its project when its pull request opens, not when it merges (R1). The ticket's run stays: it still waits for the merge, the close, or a review comment, and it still wakes on them (R9). A ticket with an open pull request is never picked up again as new work (R9).

**Places.** Each project has a number of places, set in `timone.yaml` and 2 when it is not set (R2). A ticket takes a place while one of its steps runs, whatever the step. A ticket waiting for a person, for a merge, or for its turn takes no place. An open pull request takes none. A runner session and a takeover in a person's own terminal take none. When a place frees, it goes to one ticket: a ticket labelled `priority:high` first, then the oldest (R3). Only that ticket is told a place is free, and its next step is not refused for want of one. A takeover is not refused because another ticket of the same project is building or holds a work branch (R13).

**A real dependency waits for the merge.** A ticket that needs another ticket's work does not start building until that ticket's pull request has merged. Every work branch is cut from the default branch, never from another ticket's branch (R4). Tickets that do not need each other build at the same time, before any pull request merges. This includes the step tickets of one initiative: every step that is open and not blocked may build, not only the first one.

**The planner decides who builds.** The planner is a new agent that sees all the tickets of one project. It is not the runner, which sees one run. It decides after a ticket's plan is written and before its build starts, because the plan is the first place that names the files a ticket will change (R5). It compares those files with the builds running and the pull requests not yet merged. A small overlap builds at the same time; a large one waits. What counts as large is the planner's judgement, not a number. When it holds a ticket back, it says on that ticket which ticket it waits for and why (R6). A named person can overrule it by writing on the ticket in plain words, as they do with the runner today (R6). When the ticket it waits for merges or closes, the planner decides again. A waiting ticket's plan is not rewritten; its build adjusts the plan if it no longer fits, as builds already do.

**The update after a merge.** Right after a pull request merges, every other open pull request of the project is brought level with the default branch (R7). The machine fixes any conflict. Then it runs the project's whole test suite, the check scripts of the pull request's own ticket, and the check scripts of the ticket that just merged, so the two are tested both ways. Code changed to fix a conflict is described in a short section at the top of the pull request. If a test still fails after two fixes, the pull request says so at the top, with the failure, and the person decides. An update is a step, so it takes a place. It is not a rebuild: the work already done is kept. A pull request can also open after the default branch has moved on, because another pull request merged while its ticket was still building. Then the machine brings it level at once and tests it again, in the same way as after a merge (R14).

**The files every ticket changes come first.** Some files are changed by almost every ticket: `STATUS.md`, the requirement registers, and documents numbered by taking the next free number (phase files, ADRs, triage records). Until they are handled, every merge would cause a conflict there, and two tickets planned at once would take the same phase number. Two tickets worked at the same time never take the same number, and an update never needs a person because of these files (R8). This is a fault in the machine, and it has to be fixed first.

**The breakdown aims for pieces that can be built at the same time.** When two ways of cutting an initiative into pieces are equally good, the breakdown chooses the one where fewer pieces wait for each other and fewer share files (R11). The rule that each piece works end to end ([PRD-01.R25](prd-01-process-layer.criteria.md#r25--a-piece-is-a-thin-path-through-every-layer-and-names-only-what-it-finishes)) stays and comes first. When the breakdown is put up for approval, it shows the order, for example "1, then 2 and 3 together, then 4", and the step tickets it opens wait for each other exactly as that order says (R10).

**The old rule is removed everywhere it is written** (R12), or it comes back. See the next section.

### What this changes in the requirements already active

- **[PRD-02.R10](prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project)** (serialized work per project) is replaced. It says a project with an active chunk queues every other ticket until that chunk reaches a terminal state. R1, R2 and R3 take its place.
- **[PRD-02.R22](prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks)** changes in two clauses. Clause 1 says the daemon takes up "the first step ticket that is open, unblocked and unassigned"; with R4, every such step may build, within the places and the planner's decision. Clause 6 says a queued ticket starts "in the window" between two chunks of an initiative; with R1 that window is no longer the only time it can start.
- **[PRD-03](prd-03-a-run-ends-at-its-pull-request.md)**, out of scope, says: "Changing how a project is held. One pull request in flight per project, the run holding it until merge or close, stays as it is (PRD-02.R10)". This PRD reverses that line. PRD-03's requirements R1 to R5 are not changed: a run still ends at its pull request.
- **[PRD-05.R15](prd-05-a-runner-decides-each-step.criteria.md#r15--one-projects-work-no-longer-holds-up-the-others)**, clause 2, says two ready tickets of one project run "only one at a time, as today". R2 replaces it. Clause 1 (one project does not hold up another) is not changed.
- **[PRD-05.R11](prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes)**, clause 2, refuses a takeover while another run of the project is working or holds a work branch. R13 replaces that part of clause 2. A takeover is still refused on a run the machine is working on itself.
- **[PRD-05.R3](prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person)** is not changed. The update brings a work branch level with the default branch; it never writes to the default branch, and the machine still never merges.
- **[PRD-05.R9 and R10](prd-05-a-runner-decides-each-step.criteria.md#r10--only-named-people-can-instruct-the-runner)** are not changed. R6 uses the same rule for who may overrule the planner.

### What this covers among Timone's open issues

- **[#181](https://github.com/fvermaut/timone/issues/181)** — a new run started on a ticket whose pull request from an earlier run was still open, and the new run did not know that pull request. **Covered by R9.** With R1 more tickets will have an open pull request while other work goes on, so this fault would happen more often. R9 asks for what the issue asks for: a ticket with an open pull request is not picked up as new work, and its run keeps tracking that pull request.
- **[#184](https://github.com/fvermaut/timone/issues/184)** — a runner was told "the project is free" while another run held the project, and its step was refused. **Covered by R3.** The message "the project is free" goes away. A freed place is given to one ticket, only that ticket is told, and no other ticket can take the place before its step starts.

### Out of scope

- **A limit on how many pull requests wait for the person at once.** It was offered and left for later. More pull requests will wait at the same time; this is an accepted cost.
- **A total limit across all projects.** There is none for now. Up to six sessions run at once on the one Claude login.
- **Rebuilding a ticket from its plan after another merge.** Rejected: the update keeps the work already done.
- **Updating a pull request only when the person is about to merge it.** Rejected: the update runs right after each merge.
- **Rewriting a waiting ticket's plan after another merge.** Its build adjusts the plan when it does not fit.
- **The planner guessing each piece's files from the breakdown.** Rejected: the planner decides from the plan, which names the files.
- **The machine merging.** It never does. Only a named person merges.
- **Box names that collide across daemon restarts** ([#73](https://github.com/fvermaut/timone/issues/73)). Two boxes of one project at the same time make it more likely to matter, but it is its own issue and is fixed there.
- **ivtrends.** The first watched run is on scratch-app, with test tickets the machine writes so that they overlap on purpose. Never on ivtrends.

### Risks fvermaut accepted

- **Some conflicts no tool shows**, for example two database changes that each work alone and fail together. Only the tests in the update catch them.
- **More pull requests wait for the person at once.**
- **The planner's judgement of a large overlap can be wrong.** A named person can overrule it, and the update catches what it let through.

## Open Questions

None. Two questions were open when this file was first written. fvermaut answered both on the ticket on 3 October 2026 ([his comment](https://github.com/fvermaut/timone/issues/197)):

- **Is a takeover still refused while another ticket of the same project is building?** No. A takeover is allowed then (R13).
- **Is a pull request brought level when it opens behind the default branch?** Yes. The machine brings it level at once and tests it again, in the same way as after a merge (R14).
