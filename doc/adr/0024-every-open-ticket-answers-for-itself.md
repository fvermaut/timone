# ADR-0024: Every open ticket answers for itself

- **Status:** accepted
- **Date:** 2026-08-13
- **Source:** fvermaut's ruling of 2026-08-13, from six questions put one at a time with their trade-offs, after he wrote an instruction on a ticket and nothing happened
- **Amends:** [ADR-0010](0010-wayfinder-discovery-maps.md), whose "the map is an index, never a run" this reverses for the map's closing transition
- **Extends:** [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md), whose written-answer path this makes universal rather than per-ticket-type; [ADR-0012](0012-conversation-channels.md), whose two channels this holds every open ticket to
- **Depends on:** [ADR-0023](0023-one-answer-one-session.md) — see Consequences; this must not be built before it

## Context

On 2026-08-13 the `ivtrends` wayfinder map closed its fifteenth and last question. The machine posted a summary on the map ticket saying the decisions would now become a specification, and ended it with *"What I need from you: nothing right now."* fvermaut replied on that ticket: **"ok go ahead and write the spec."** Nothing happened, and nothing was ever going to.

**Two independent reasons, either sufficient.**

1. **The daemon cannot see the map.** `listMarkedTickets` (`src/adapters/github-tickets.ts:234`) lists only issues carrying the `timone` label. `ivtrends` #1 carries `wayfinder:map` and no mark, deliberately — `src/daemon/pipeline.ts:17` states it: *"`map` is deliberately not among them. The map is an index of the effort rather than a question anybody can answer, so it never carries the mark label and never becomes a run."*
2. **Marked, it would still have nowhere to go.** The `wayfinding` stage declares no `next` (`src/daemon/pipeline.ts:173`): *"Nothing follows, on purpose. … The destination artifact is the whole map's to hand to stage 3 once the effort closes."* That hand-off lives in `timone-wayfind`'s closing (`SKILL.md:176` — *"Hand off to `timone-prd`"*), which is a human typing a session.

**So the stage-2 → stage-3 transition is the only handover in the loop with no ticket-borne entry point** — and it is the transition where an entire discovery effort turns into the specification everything downstream is built and checked against.

**The gap is not one ticket's.** Probed against every open ticket on both managed projects on 2026-08-13, **all four fail**, each differently:

| Ticket | State | How it fails |
|---|---|---|
| `ivtrends` #1 | `wayfinder:map` | CTA says "nothing right now"; invisible to the daemon; no ledger run, so `takeover` refuses |
| `scratch-app` #4 | parked at `triage` | CTA is *"waiting on you: the next stage to be built"* — truthful, and nothing can move it |
| `scratch-app` #5 | unlabelled | never touched, no CTA at all; filed 2026-08-03 and silent since |
| `scratch-app` #13 | run `failed` at planning | `timone status` offers `timone retry scratch-app#13`; **the ticket itself does not say so** |

**And two faults already on the record are the same disease.** [PRD-02.R20](../specs/prd/prd-02-inversion-of-control.criteria.md#r20--wayfinder-decision-tickets-participate-in-the-loop)'s 2026-08-11 marker records `timone status` asking the human to *"answer on … ivtrends #11"* while #11's body says nothing is needed. [STATUS.md](../../STATUS.md) records that **nothing forces a resolving session to refresh the tickets that were waiting on it** — it happened on `ivtrends` because a session chose well, not because a rule made it. Both are a CTA that was true when written and went stale, with no mechanism responsible for it afterwards.

**Alternatives considered**, per ruling, with what each was rejected for:

- **On the rule itself.** *Hard liveness* — no open ticket may exist that nothing can move — rejected: it pulls unbuilt stages into scope, so `scratch-app` #4 could not exist until the stage after triage is built, which is a far larger commitment than the fault warrants. *Wording only* — an accurate line and no promise of a mechanism — rejected: it would have left the original ticket, #1, exactly as unreachable as it was.
- **On scope.** *Marked tickets only* — rejected: it leaves `scratch-app` #5 silent forever, which is the "I filed it and nothing happened" hole in its purest form. *Marked plus maps* — rejected for the same reason, narrowly.
- **On unmarked tickets.** *Say nothing, surface it in `timone status` instead* — rejected: the CTA would live in a terminal, which only works when the human looks, and the whole direction is that the ticket is the interface. *Introduce itself only on issues fvermaut filed* — rejected: two issues side by side, one answered and one silent, with nothing on either explaining the difference.
- **On the map.** *A new marked ticket carries the spec-writing gate, map stays a pure index* — a cleaner separation and it keeps ADR-0010 whole; rejected on the evidence of what actually happened, which is that **fvermaut wrote his instruction on the map**, because the map is the ticket that represents the effort to him. *Takeover only* — rejected: it makes the terminal the sole route through the effort's most important transition.
- **On takeover.** *Keep phase 18's design and rely on marking at creation* — rejected: anything that slips the net (a repo onboarded before this existed, a hand-filed issue) stays permanently unreachable, which is the case that produced the refusal in the first place. *Resolve everything from the tracker and demote the label to permission only* — rejected as the deepest change of the three, with the daemon's entire pickup path built on the label today.
- **On enforcement.** *Report only, like the provenance-trailer check* — rejected: it leaves the refresh gap open and makes every stale CTA wait on the human noticing a warning. *Write on transition, report drift* — rejected: it reports the #11 contradiction rather than preventing it.

## Decision

**Every open ticket on a managed project says what happens next, and every one that can be moved names the thing that moves it.** Six rulings, which are one rule seen from six sides.

- **An honest CTA is owed unconditionally; a mechanism is owed wherever one exists.** Every open ticket carries a truthful line stating what happens next and who acts. Where the daemon or `takeover` can move it, that line names them — the exact command, not a description of one. Where nothing can, the line says so plainly and names what would unblock it. **A parked ticket is not a violation; a silent or lying one is.**
- **The rule covers every open ticket in a managed repository**, not only marked ones. The `timone` label stops being the boundary of what Timone will *say* and remains the boundary of what it will *do*.
- **An unmarked ticket is introduced to, exactly once.** One comment: what this repository is managed by, and that adding the `timone` label hands the ticket over. A marker in the comment makes it exactly-once, so no poll cycle repeats it. **A per-project switch governs it, defaulting off for a repository onboarded with an existing backlog** — introducing Timone to two hundred issues at once is a worse first impression than silence.
- **The wayfinder map becomes a first-class ticket.** It carries the mark label, becomes daemon-visible and run-backed, and its CTA tracks its own state: while questions are open, *nothing — I am working the list*; once the frontier is empty, *say go and I will write the specification*. A comment then starts stage 3. This reverses [ADR-0010](0010-wayfinder-discovery-maps.md)'s "never becomes a run" for the map alone; **decision tickets are unchanged and `wayfinding` still has nothing following it**, because a PRD written off one answer is the fault that clause exists to prevent.
- **`takeover` resolves any open ticket from the tracker.** Marking at creation stays, because that is what daemon pickup is built on; on top of it, `takeover` creates the run on demand for a ticket that has none. **The refusal — *"I'm not working on X. Add the `timone` label…"* (`src/commands/takeover.ts:90`) — is retired for open tickets.** This settles [PRD-02.R20](../specs/prd/prd-02-inversion-of-control.criteria.md#r20--wayfinder-decision-tickets-participate-in-the-loop)'s second criterion as **genuinely owed**, which its own marker left as fvermaut's ruling to make.
- **The CTA is repaired, not merely reported.** Each cycle the daemon computes what every open ticket's CTA should be and posts an update **only where it differs from the one it last posted**. Refreshing a ticket whose blocker closed stops being a session choosing well and becomes a rule.

## Consequences

- **PRD-02.R1 survives; the evidence under it does not.** Its criterion forbids a *run* on an unmarked issue, not a comment, so the requirement stands as written. What is invalidated is its 2026-08-03 verification evidence (*"0 comments and 0 labels"* on `scratch-app` #5) and STATUS.md's sentence that an unlabelled ticket *"is left completely alone"*. **R1 must be re-verified against the new behaviour**, and the old marker corrected rather than deleted.
- **The differs-from-last guard is load-bearing, and it is the way this goes wrong.** A daemon that writes on tickets every cycle without it produces a comment per ticket per minute. It is the first thing this phase's gate must try to break.
- **A map run holds its project.** Stage 3 owns a branch (`requirements: ownsBranch: true`), and runs serialize per project — so once the map's "go" is given, the map ticket holds `ivtrends` against every other ticket until the PRD is committed. That is correct, and it is new: a map ticket has never held anything.
- **The map needs its own stage in the graph.** `wayfinderStage()` maps all four decision types onto `wayfinding`, whose "nothing follows" must stay true for them. The map is therefore a fifth kind with a stage of its own, whose `next` is `requirements` — not a `next` bolted onto `wayfinding`.
- **This must not be built before [ADR-0023](0023-one-answer-one-session.md).** Self-healing CTAs run over the same resume-and-write path phase 19 is approved to fix and has not yet been built on. Building this first would multiply the double-answer defect from one answered ticket to every open one, on a timer. **Phase 19 is a hard prerequisite, not a preference.**
- **`ivtrends` #1 stays open and unactionable until this ships.** The specification it is waiting to authorise can still be written by a human-typed session in the meantime; what does not exist until then is fvermaut's ability to have said so on the ticket, which is the thing he actually did.
- **Timone acquires an opinion about repositories it has not been given.** Introducing itself on an unmarked issue is a small act, and it is the first time the machine speaks somewhere nobody invited it. The per-project default-off switch for backlogs is the whole of the restraint, which makes onboarding the moment to get it right.
