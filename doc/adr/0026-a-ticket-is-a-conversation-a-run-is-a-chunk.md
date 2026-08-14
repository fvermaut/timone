# ADR-0026: A ticket is a conversation; a run is a chunk of work

- **Status:** accepted
- **Date:** 2026-08-14
- **Source:** fvermaut's rulings of 2026-08-14, four questions put one at a time, after [phase 20](../plans/phases/phase-20.md)'s live gate showed an approved map walking straight on into building
- **Discharges:** [ADR-0015](0015-branch-per-driving-unit.md)'s deferred question — *"a ticket that grows into multiple phases … this ADR is where the serial-phases-on-one-branch question gets taken up"*
- **Amends:** [ADR-0024](0024-every-open-ticket-answers-for-itself.md), whose "the map is a fifth wayfinder kind with a stage of its own" becomes a special case of a general rule; and the one-run-per-project rule of 2026-08-03, which now binds the chunk rather than the ticket

## Context

[Phase 20](../plans/phases/phase-20.md) made a wayfinder map answerable: its frontier empties, its call to action invites the go-ahead, and a written agreement starts stage 3 on the map's own run. Its [live gate](../plans/phases/reports/phase-20-live-gate.md) then showed the consequence nobody had ruled on — once the specification's gate was approved, **the map's run walked on into planning and took a branch.** Left alone it would have built the whole thing. That followed correctly from giving the map a `next` of `requirements`; what was missing is that **nobody had decided a discovery map should become the thing that gets built.**

fvermaut's position, stated when the finding was put to him: **tickets are not tasks.** A ticket must have scope and must be semantically sound at the *domain* level — something a person can relate to. A ticket exists only where there is genuinely a new discussion to open with a human. *"If it's only about 'we need now to write the spec/plan or start the build', a comment on an existing ticket is more than enough."* His instinct was that the map is the right home for an initiative — an epic — with all its subsequent steps living inside it.

**That instinct collided with an identity the ledger has carried since the daemon was built.** A ticket and a run are the same object: `run.id` is literally `project#ticket`, with one status, one stage, one branch, one place in the queue. Taken literally, "the epic hosts the whole initiative" therefore meant *one run, one branch, one pull request for an entire milestone* — a PR nobody could judge, and a project frozen for weeks. That is not what he meant, which exposed the real proposal: **the two concepts must stop being one.**

**Alternatives considered, per ruling:**

- **On the identity.** *Keep ticket and run fused and end the map at the specification*, with building as separate tickets — cheapest by far, no ledger surgery, and defensible because a chunk like "the screener board" is domain-shaped. Rejected: it is not the epic he described, and it puts process boundaries into the human's field of view. *Split them* (chosen), accepting that the ledger's central identity stops being true.
- **On what holds a project.** *The whole initiative holds it* — simplest to explain, nothing can wander into a half-built milestone. Rejected: a one-line bug would wait weeks, and that is the rule he would resent first. *Drop one-at-a-time entirely and run anything on a different branch* — rejected: it reopens the collision question the 2026-08-03 rule closed, and nothing arbitrates two runs editing one file. *Only the chunk currently building holds it* (chosen).
- **On the approval rhythm.** *Every chunk's plan approved, as today* — ten touches per five-chunk milestone; the plan gate has already earned its keep once, catching a misunderstanding on `scratch-app` #6 before it was built. Rejected as mostly process. *Only finished work* — five touches, every one of them something real. Rejected: a chunk could be built wrong end to end and paid for before anyone looked. *The breakdown once, then each pull request* (chosen), six touches.
- **On whether an initiative is a kind.** *Epics are their own kind*, with rules of their own — smaller blast radius, clearer to talk about. Rejected: two shapes to explain, and a ticket that turns out bigger has to be converted. *No special kind* (chosen).

## Decision

**A ticket is a durable conversation with a human. A run is one chunk of work with its own branch and its own pull request. One ticket hosts a sequence of runs over its life.**

- **The identity `run.id = project#ticket` ends.** A ticket may have many runs; a run belongs to exactly one ticket. Every report, gate and review from every run lands in that one ticket's thread, which is the human's single view of the initiative.
- **The chunk holds the project, not the ticket.** Only a run actually building occupies the project's one-at-a-time slot. Between one chunk's pull request merging and the next starting, the project is free, and anything queued — a bug filed mid-milestone — takes its turn. **The 2026-08-03 rule is unchanged in substance**: it simply binds the chunk instead of the ticket, so a milestone is several short occupations rather than one long one.
- **The breakdown is approved once; each chunk is judged as a pull request.** When the specification lands, the machine proposes the chunks it intends to build and the human approves *that shape* — the one gate that is genuinely domain-level, *is this the right shape of work*. Per-chunk plan gates are retired.
- **There is no such thing as an epic.** Every ticket works this way and they differ only in size: a bug report is a ticket with one chunk, a milestone is a ticket with five, and *"the page feels slow"* may turn out to need three without anybody reclassifying it. **The machine never needs the word.**
- **Process transitions are never tickets.** Writing a specification, planning, starting a build: these are comments on the ticket that owns them. A new ticket is created only where there is a new domain-level topic to open with a human.

## Consequences

- **This is the deepest change to the ledger since the daemon was built.** `run.id` is load-bearing in the queue, `timone status`, the guardrails' session-to-run resolution, `takeover`, `retry`, every report and every provenance trailer (`Timone-Run: <project>#<ticket>`). None of it is unreachable, and all of it is touched.
- **[Phase 20](../plans/phases/phase-20.md)'s 20f becomes a special case rather than a special kind**, days after shipping. The `charting` stage and the `map` wayfinder type were built to make one ticket wait, flip its own call to action, and start the next stage on its own run. **That mechanism is exactly what generalises** — what does not survive is its being the map's alone. The work is not wasted; its scope is.
- **[ADR-0015](0015-branch-per-driving-unit.md)'s deferred question is answered**, and answered against its own default: the driving unit of work is no longer the ticket, so a branch belongs to the chunk. Its ticket-driven clause — *"owns its branch from the moment the requirements stage claims it until the pull request merges"* — now describes a chunk's life, not a ticket's.
- **A bug filed mid-milestone waits days rather than weeks.** That is the point, and it is bought with a partially-built milestone sitting on the default branch between chunks — which is already true of any multi-phase work and is what the phase discipline exists to make safe.
- **The planning stage acquires an output it does not have today:** a breakdown of a specification into chunks, proposed for one approval. Today one ticket yields one phase file. That is the concrete piece of work this decision creates.
- **Left open, deliberately, and not to be inferred from this record:** when a ticket is allowed to close; what its thread says while a chunk is building and between chunks; whether a chunk's pull request review lands on the ticket or stays on the pull request; and how existing runs migrate, given every one of them is a ticket with exactly one chunk and so is already conformant.
- **What does not change:** the two answer paths, gate parsing, what a resolution looks like, and the rule that the ticket is the sole write-path for gate decisions ([ADR-0012](0012-conversation-channels.md)). This is a decision about how work is *shaped*, not about how the human is *spoken to*.
