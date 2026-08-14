# ADR-0027: A guardrail finding is addressed to the session that caused it, and never to a client's ticket

- **Status:** accepted
- **Date:** 2026-08-14
- **Source:** fvermaut's two rulings of 2026-08-14, taken after findings 1 and 11 of [phase 20's live gate](../plans/phases/reports/phase-20-live-gate.md) were shown to share one cause, from three options each
- **Amends:** [ADR-0018](0018-the-session-bracket-belongs-to-the-hooks.md), which put the bracket in the hooks and left the destination of a finding where phase 11 had it
- **Revises:** `PRD-02` R15, whose second criterion — *"it is posted on that run's ticket"* — this reverses

## Context

Two findings of the same gate, opposite in appearance:

- **Finding 1.** The path-containment rule posted on `scratch-app` #29 that *"the session changed 1 file(s) outside `projects/scratch-app/`"*. **The session had not.** The orchestrator had, minutes earlier, and had left it uncommitted — and [phase 15](../plans/phases/phase-15.md)'s attribution fix reads the `Timone-Session:` trailer off **commits**, which a working-tree change does not carry. It published under fvermaut's GitHub account, on a ticket, where it reads as him accusing somebody.
- **Finding 11.** The branch `timone/29-…` was cut in the Timone repository instead of the project's. `status-placement` and `unpushed` fired **six times, correctly**, into `.timone/sessions.jsonl`. Nobody read it. Thirteen commits stayed off the remote for hours, and the handover written on that branch reported them as being on `main`.

**One check shouted something wrong where everyone could see it; another stated something true where nobody could.** The cause is the same, and it is not in either rule: **a finding's destination is chosen by who drove the session, not by who can act on the finding.** A daemon session's findings go to the ticket because a daemon session has a ticket. An interactive session's go to stdout and a journal because it has neither. Neither destination was ever chosen for the finding itself.

Two questions follow, and they are separable — which is why they were put separately.

**Who is a finding for?** Every violation the rules can express is something the *session* could fix in the turn it is told: push the commits, move the branch, amend the trailer, put `STATUS.md` where it is read. The session also holds the one thing no rule has: **it knows what it did.** Finding 1 is a false accusation that the accused session could have refuted instantly — it never touched the file — and no amount of sharpening the rule reaches that, because the rule reads git and the answer is not in git.

**What may be published in a human's name?** Timone posts through fvermaut's GitHub account. A guardrail comment is internal bookkeeping arriving on a client's thread, under a person's identity, where a reader has no way to tell a machine's housekeeping from that person's judgement of their work. When it is wrong, as it has now been twice ([14g](../plans/phases/reports/phase-14-live-gate.md), and finding 1), it is wrong in public and cannot be unsaid — the 2026-08-08 correction had to be posted **beneath** the original rather than replacing it.

**Alternatives considered:**

- **The human is always the first audience; the machine reports and never self-heals.** A session that just made a mess is arguably the last thing to trust with judging it. Rejected: it leaves finding 11 intact in a quieter form — the human is told, eventually, if they look — and it spends a human's attention on things a machine can fix in one turn.
- **Route by rule kind** — mechanical findings (unpushed, provenance, branch placement) back to the session, judgement findings (path containment, status placement) to the human. Rejected: every new rule then needs this call made about it, and **making that call wrongly is how finding 1 happened**. The split also fails on its own terms — containment is exactly the rule the session can settle fastest, because it knows whose change it was.
- **Keep publishing on the ticket, because it is the only channel that reaches a human who is not at the keyboard.** Rejected: `timone status` and the run's flags are that channel already, and the reach was never worth the cost of being wrong in public under somebody's name.

## Decision

**A guardrail finding is handed to the session that caused it, first. Only what survives that reaches a human, and it never reaches a client's ticket.**

1. **First sighting goes back to the session.** At `Stop`, a violation not seen before in this session is returned to the session as feedback and the session is not allowed to end on it. It gets **one** chance — to fix it, or to say why the finding is wrong.
2. **Escalation is for what survives.** A violation still standing at the next `Stop` has had its chance. It is escalated once and then falls silent, whatever happens afterwards.
3. **Escalation never posts on a ticket.** A run-driven session's escalation **flags the run**, which is what `timone status` reads. An interactive session's prints in the terminal and appends to `.timone/sessions.jsonl`, as it does today. `postComment` leaves the guardrail path entirely.
4. **The three states are per violation, not per session** — keyed by the violation's summary in the parked baseline, beside the `reported` list that already exists for the same reason: `Stop` fires at the end of every assistant turn, not once per session.

## Consequences

- **Finding 1 becomes refutable before it is published rather than corrected after.** The accused session is asked first, knows it never touched `timone.yaml`, and says so. Nothing lands on a client's thread either way.
- **Finding 11 becomes a thing the session has to deal with**, not a line in a file. A branch cut in the wrong repository is now returned to the session that cut it, while the session is still there to move it.
- **`PRD-02` R15 is revised and drops out of `verified`.** Its second criterion says a violation "is posted on that run's ticket"; that is now false by decision. Old evidence does not settle a changed requirement, so R15 needs re-observing on both session kinds — and this is the second requirement whose re-verification is owed on a live gate.
- **A session can now argue with a correct finding and waste a turn.** Accepted: the same freedom is what lets it refute a wrong one, and the bound is one round either way.
- **A session killed after being handed a finding escalates nothing.** The violation sits in the parked baseline as returned-but-unescalated, and the baseline is swept after a day. This is a real hole, recorded rather than engineered around: closing it needs something that runs when a session dies rather than when it stops, which nothing does today.
- **The `Stop` hook stops being unable to fail a session**, which was a deliberate property. It now *deliberately* blocks one stop per violation. Everything else about the hook keeps the old rule — an error inside it is still swallowed, because a guardrail that breaks sessions is worse than the faults it catches.
- **Nothing about the rules themselves changes.** They stay pure functions over git evidence, and the two failures this ADR answers were never in the rules.
