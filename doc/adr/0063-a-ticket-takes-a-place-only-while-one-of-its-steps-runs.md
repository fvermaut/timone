# ADR-0063: A ticket takes a place on its project only while one of its steps runs, and a freed place is given to one ticket

- **Status:** accepted
- **Date:** 2026-10-04
- **Source:** planning of [timone#201](https://github.com/fvermaut/timone/issues/201), piece 3 of [timone#197](https://github.com/fvermaut/timone/issues/197). The list of pieces says this piece records the decision that replaces the rule of ADR-0026; the plan is [phase 47](../plans/phases/phase-47.md).
- **Replaces:** the rule "the chunk holds the project" of [ADR-0026](0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), and the second of the two rules `RunStore` has kept since phase 12: "a parked run holds its project once it owns a work branch". The rest of ADR-0026 stands.
- **Requirements:** [PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md) R1, R2 (except the number of places), R3, R9, R13, and R12 for the places named in D6

## Context

Today a run holds its project from the moment it owns a work branch until its run ends, and a run ends only when its pull request merges. So a pull request waiting for review, or a question waiting for a person, stops every other ticket of the project. The first reason for the rule was two agents in one working copy. Since [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) every run clones the project into its own box, so that reason is gone. fvermaut decided on 3 October 2026 that the project is free when the pull request opens ([PRD-07](../specs/prd/prd-07-several-tickets-of-one-project-at-once.md)), and that each project has places: a ticket takes one while one of its steps runs, whatever the step.

The requirements say what must be true. They leave open how a freed place reaches exactly one ticket. Today two mechanisms wait for a project. A ticket picked up while the project is held is written `queued`, and the ledger moves the oldest one on when the project frees. A run whose try to start a step was refused is told "The project is free now" by the runner's driver, and every such run is told at once. Two runs can then be told, and only one can start: that is [#184](https://github.com/fvermaut/timone/issues/184), seen three times on 4 October on this project alone.

Alternatives considered:

- **Keep the two mechanisms and only stop holding on a branch.** Rejected: #184 stays, and becomes more frequent, because more tickets wait at once.
- **Decide who gets a freed place in the poll cycle**, where the forge's listing gives each ticket's labels and creation time. Rejected: a step ends between two cycles, and any runner woken in that gap can start a step and take the place before the cycle gives it. The place must be given in the same write to the ledger that frees it.
- **Wake every waiting run, and let the first to start win.** That is what happens today. Rejected: the losers post "the work has started" and then a correction, and a person reads both.
- **The ticket whose step just ended keeps the place for its next step**, so a ticket is built from start to pull request before the next one starts. Simplest to explain, and no ticket's steps are mixed with another's. Rejected: R2 says a ticket takes a place only while a step runs, and a ticket labelled `priority:high` would wait for a whole build.
- **The ticket whose step just ended goes to the back**, behind every ticket waiting. Rejected: with one place, two tickets would take turns step by step, and the older one would finish later than under any other rule.

## Decision

### D1 — A place is taken only by a running step, or by a place given to one ticket

**A run takes a place on its project while a step of it runs, and while a place is given to it (D3) and not yet used or given back.** Nothing else takes one: not a work branch, not an open pull request, not a wait for a person, not a run just picked up, not a runner session, not a terminal session a person opened with `timone takeover`. Several runs of one project may own work branches and open pull requests at the same time.

Until the piece that adds the number of places in `timone.yaml` lands, every project has **one** place. One ticket still builds at a time.

### D2 — A run that needs a place and finds none waits for its turn, and the ledger writes down its order

When a run tries to start a step and every place is taken, the try is refused and the ledger writes that the run **waits for a place**. With it, the ledger keeps the two facts that decide its turn: whether its ticket carries the `priority:high` label, and when its ticket was opened on the forge. They are read from the ticket at the try. A label added later counts from the next try.

**A run whose step has just ended waits for a place too, with its own order, until its runner has decided what comes next.** It keeps the place when it comes first, and loses it to a ticket labelled `priority:high` or an older ticket that waits. Its runner will very often start the next step at once, and this is what lets it do so without a race. When the runner's wake ends with no step started and no try refused, the run stops waiting.

The status `queued` is no longer written. Every pickup opens a run as `picked-up`, and a new ticket waits for a place only once its runner tries a step. A `queued` run that an older ledger holds is read as `picked-up` when the ledger is loaded.

### D3 — A freed place is given to one waiting run, in the same write that freed it

**Whenever a place frees — a step ends, a run ends, a given place is given back — the ledger gives it to one waiting run, in the same write:** a ticket labelled `priority:high` first, then the ticket opened first on the forge, then the lowest ticket number. The place is then that run's. Another run's try to start a step is refused for want of a place, and the given run's next step takes it.

**Only the run given the place is woken**, with a sentence that says a place is free for this ticket. "The project is free now" goes away.

**A place given and not used goes to the next run.** When the given run's runner wake ends with no step started, the ledger takes the place back and gives it again, by the same order. When the daemon starts, it takes back every place given and not used, and gives each again: no wake survives a restart, so a place given before one would otherwise never be used.

### D4 — A ticket with an open pull request is not picked up as new work

Before the pickup opens a new run for a marked ticket that has no live run, it asks the forge for an open pull request from a branch of that ticket (`timone/<n>`, or `timone/<n>-…`). **When one is open, the new run takes it over**: it records the branch and the pull request, and waits for the runner. It is not woken as a new ticket. It wakes, as every run with a pull request does, when that pull request merges, closes, or gets a comment from a named person, and the runner is shown the branch and the pull request. This is [#181](https://github.com/fvermaut/timone/issues/181).

### D5 — A takeover takes no place, and is not refused because of another ticket

A run a person's terminal holds is marked as such in the ledger, and is not counted as a place. A takeover is not refused because another ticket of the project has a step running, owns a work branch, or has an open pull request. It is still refused on a ticket whose own step the machine is running, as today.

### D6 — The old rule is removed where this piece changes it

The rule is struck, with a dated note naming this record and the requirement of PRD-07 that replaces it, in: [PRD-02.R10](../specs/prd/prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project); [PRD-02.R22](../specs/prd/prd-02-inversion-of-control.criteria.md#r22--a-ticket-hosts-a-sequence-of-chunks) clause 6; [PRD-05.R11](../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r11--takeover-and-cancel-stay-and-retry-goes) clause 2; the out-of-scope line of [PRD-03](../specs/prd/prd-03-a-run-ends-at-its-pull-request.md) on how a project is held; ADR-0026's status line; `process.md` stage 6; and the instructions for charting a large piece of work, which say a map holds its whole project. PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are changed by the piece that adds the number of places and the planner, not here.

## Consequences

- **#184 and #181 are closed by this piece**, and their tests are part of it.
- **A ticket's steps can be mixed with another ticket's.** With one place, a ticket labelled `priority:high` or an older ticket that waits takes the place when the current step ends. This is what R3 asks for.
- **A given place can sit unused for one runner session**, a few minutes, while its runner decides. No other step starts on the project meanwhile. This is the price of never waking two runs for one place.
- **The ledger carries two facts from the forge** — the `priority:high` label and the ticket's creation time — for each run that waits. They can be out of date by one try. A wrong order costs one turn, never a refused step.
- **Two open pull requests of one project can now change the same files**, and nothing brings the second level with the default branch after the first merges. Until the piece that adds the update after a merge lands, a person resolves such a conflict on the pull request, as they would for any pull request. Until the planner lands, nothing holds back a ticket that changes the same files as an open pull request. The list of pieces for #197 accepted this order.
- **Step tickets of one initiative are still protected** by the forge's `blocked by` relation: a step that needs another waits until that step's ticket closes, which is when its pull request merges. Nothing here changes that.
- **`timone status`** no longer has a queue to show. It shows the runs waiting for a place, in the order they will get it.
