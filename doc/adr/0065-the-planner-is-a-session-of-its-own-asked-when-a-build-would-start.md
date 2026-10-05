# ADR-0065: The planner is a session of its own for one project, asked when a build would start, and nothing builds without its decision

- **Status:** accepted
- **Date:** 2026-10-05
- **Source:** planning of [timone#203](https://github.com/fvermaut/timone/issues/203), piece 5 of [timone#197](https://github.com/fvermaut/timone/issues/197). The decision was made while planning that piece; the plan is [phase 49](../plans/phases/phase-49.md).
- **Requirements:** [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) R2 (the number of places), R4, R5, R6, and R12 for the places named in D7

## Context

[PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) says what the planner must do. It is a new agent that sees all the tickets of one project, not the runner. It decides after a ticket's plan is written and before its build starts. It compares the files the plan names with the builds running and the pull requests not merged. A small overlap builds at the same time, a large one waits, and what counts as large is its judgement, not a number. A held ticket is told on the ticket which ticket it waits for and why. A named person can overrule it in plain words. When the ticket it waits for merges or closes, it decides again.

The requirements leave open how such an agent runs in the daemon. Nothing like it exists yet. Every agent session today belongs to one run: the runner, which decides one run's next step on the host ([ADR-0060](0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md)), and the steps, which run in boxes ([ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md)). The only other call to a model is one question with no tools, at the spending limit. [ADR-0063](0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) decided how places are taken and given, and left their number at one until this piece.

Alternatives considered:

- **Code alone compares the file lists and holds a ticket above a share of common files.** Cheap, and testable to the last case. Rejected: the requirements say what counts as large is the planner's judgement and not a number. Two plans can share one file in a way that conflicts on every line, or ten files where each adds one line.
- **Each ticket's runner decides for its own ticket**, given the other tickets as facts. No new kind of session. Rejected: two runners that decide at the same moment each let their own ticket through without seeing the other's decision. The requirements also say the planner is not the runner.
- **The planner is asked when the planning step ends.** Rejected: a run whose runner skips planning, or plans a second time, would be missed or decided twice. The try to start the build is the one moment every build passes through.
- **One planner session each poll cycle, deciding every waiting ticket at once.** Rejected: it spends a session on every cycle in which anything waits, and its cost belongs to no single ticket's limit.
- **The runner reads the overruling comment**, through a new action. Rejected: the runner and the planner would both read the same comment and both answer it, and the requirements say the planner lets the ticket build.
- **The planner runs in a box with a clone of the project.** Rejected: it changes nothing in the repository, everything it needs can be read from the forge, and a box takes minutes to start ([#206](https://github.com/fvermaut/timone/issues/206)).

## Decision

### D1 — The planner is a session of its own, one per project at a time, deciding one ticket

**The planner is an agent session that the daemon starts on the host, as it starts the runner, with its own instructions and its own three tools.** It decides for one ticket per session. A project has at most one planner session at a time: two sessions deciding at once would each let a ticket through without seeing the other. Tickets that wait for a decision are taken in the order a freed place is given (ADR-0063 D3): `priority:high` first, then the ticket opened first.

**The planner takes no place.** It is not a step of a ticket. Like the runner, it decides; it does not work. **Its cost is written into the record of the ticket it decided for**, and counts towards that ticket's spending limit like any other session.

### D2 — It is asked when a build would start, and the build waits for its decision

**When a runner starts the build (`start_step` at the stage `execution`) and the ledger holds no decision of the planner for that run, the step is refused**, and the ledger writes that the run waits for the planner. The runner reads why, and is woken when the planner has decided. A decision is recorded on the run, so it is asked for once per run. Steps after the build — the check, delivery, remediation, and the update after a merge — are not asked about. They work on a branch whose build the planner already let start, or on an open pull request.

### D3 — Code gathers the facts, the planner judges

Code gives the planner, for the ticket it decides:

- the ticket, its plan's title, and the files its plan names: every path in the plan's file markers (`[NEW FILE]`, `[MODIFY]`, `[DELETE]`);
- the tickets it is blocked by, and whether each is still open;
- every other ticket of the project that is **building** — the planner let it build and it has no pull request yet — or **has an open pull request**: its number, title, its plan's files, and for an open pull request the files the pull request changes;
- the comment of a named person, when that is what woke it (D5).

**It may read any of those plans in full**, through one tool, when the file lists are not enough to judge. It does not read code.

It answers with one of three tools:

- **`let_build`** — with its reason. The run may build, when a place is free.
- **`hold`** — with the tickets it waits for, and its reason. **Code writes the comment on the ticket**: it names each ticket waited for and gives the planner's reason in its words. Code checks that each ticket named is one the facts showed building or with an open pull request, or one this ticket is blocked by.
- **`pass_to_runner`** — only when a named person's comment woke it and the comment is not about when to build (D5).

A ticket that needs another ticket's work, and that work is not merged, is held: the planner's instructions say so ([PRD-07.R4](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r4--nothing-is-built-on-top-of-an-open-pull-request)).

### D4 — A held ticket is decided again when what it waits for is gone

A held run stays parked, waiting for the planner, and its runner is not woken for the hold. **When no ticket it waits for still has a build running or an open pull request** — each was merged, closed, or its run ended — the run waits for the planner again, and a new session decides. The held ticket's plan is not rewritten. When it is let build, its branch is still where it was cut; bringing a pull request level with the default branch when it opens behind it is the update's job ([PRD-07.R14](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r14--a-pull-request-that-opens-behind-the-default-branch-is-brought-level-at-once)).

### D5 — A named person's comment on a waiting ticket goes to the planner

**While a run waits for the planner, held or not yet decided, a named person's comment on its ticket wakes the planner, not the runner.** A comment by anyone else wakes nobody, as today ([PRD-05.R10](../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r10--only-named-people-can-instruct-the-runner)). The planner judges the words. When they say the ticket should build now, it calls `let_build` with the comment's time. **Code checks that a comment by a named person is on that ticket at that time**, as it does for an approval the runner records, and refuses otherwise. The comment code posts then says the ticket builds on that person's comment. When the words are about something else, the planner passes the comment to the runner, which is woken with it as it would have been.

### D6 — The number of places comes from `timone.yaml`, and every unblocked step may be picked up

Each project's entry in `timone.yaml` may set `places`, a whole number of 1 or more. **Absent means 2.** The ledger reads it in place of the one place of ADR-0063 D1.

**Every step ticket that is open, unblocked, unheld and unclaimed may be picked up**, not only the first one. The places and the planner decide which of them build.

**A run's first push of its work branch is refused when the branch carries a commit of another ticket's branch that the default branch does not have.** A box clones the default branch, so a branch is cut from it unless a session checks out another ticket's branch first. The push guard is where that is seen.

### D7 — The old rule is removed where this piece changes it

[PRD-02.R22](../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) clause 1 and [PRD-05.R15](../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r15--one-projects-work-no-longer-holds-up-the-others) clause 2 get a dated note naming this record and the PRD-07 requirement that replaces them. So do the sentences of `process.md` and the planning instructions that say the next step is the first step ticket that is open, unblocked and unassigned.

## Consequences

- **Every build costs one more session**, a planner's, and the runner is woken once more: after the refused try, when the decision lands. A few cents to a dollar per ticket, counted on its limit.
- **Two tickets of one project can build at once, on every project that sets no number**, ivtrends included. The planner is what holds one back when they change the same files. A project that should build one ticket at a time sets `places: 1`.
- **A wrong judgement costs a conflict or a wait, never lost work.** A named person can overrule a hold, and the update after a merge catches what a wrong let-through causes.
- **A held ticket builds from where its branch was cut.** Until the update lands (piece 4 of #197), a person resolves a conflict that results on the pull request.
- **A daemon restart loses a planner session in progress.** The run still waits for the planner in the ledger, so the next cycle starts a new one.
- **The planner's decision is a fact about a run, not a ticket.** A ticket's next chunk is a new run and is decided again.
