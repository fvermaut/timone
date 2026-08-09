# ADR-0012: Gates on tickets, conversations on channels

- **Status:** accepted — **amended 2026-08-09 by [ADR-0022](0022-a-conversation-ticket-can-be-answered-in-writing.md)** on the conversation bullet alone: a ticket waiting on a conversation now also names a written-answer path beside the takeover. The split below stands; the body is untouched.
- **Date:** 2026-08-02
- **Source:** grill session of 2026-08-02 (conversation-medium design for PRD-02)

## Context

PRD-02 as first drafted carried *all* human interaction as ticket comments — approval gates and clarification interviews alike. Tickets are the right home for traceability and for single decisions, but a grilling interview is fifteen questions asked one at a time; run as comment ping-pong it is slow and miserable, and fvermaut flagged it as the part he was unconvinced by. A second direction landed at the same time: the human is assumed to know nothing about the process — a chat medium (Slack first, others pluggable) is where conversations naturally live, with a terminal fallback for when no chat is wired up.

## Decision

The process distinguishes two kinds of human interaction and gives each its own medium:

- **Gates** — single decisions with one CTA (approve a PRD, approve a plan, confirm/decline/defer a feedback item) — are expressed as **ticket/PR replies only**. The ticket is the sole write-path for gate decisions. A chat channel may later notify, deep-link, and eventually relay a decision, but the adapter posts it onto the ticket; the daemon reads one surface.
- **Conversations** — multi-turn interviews (grilling, wayfinder sessions, prototype walk-throughs) — run on a **conversation channel** behind a real adapter interface (open a conversation for project/ticket/stage, exchange turns, conclude with an outcome). The **terminal takeover is the first implementation and the universal fallback**: the ticket carries a CTA naming a `timone takeover <project>#<ticket>` command; running it resolves what the ticket is waiting on and spawns the right stage session. Slack is a fast-follow behind the same seam; its specifics (app, events, threads, identity) are decided in its own phase.
- An acceptance that **concludes a conversation** (accepting the grill summary) is an in-conversation act; the session posts the accepted outcome summary to the ticket as the record. Formal stage gates still round-trip through the ticket.
- **Persistence:** the ticket gets the outcome summary — so traceability shows the conversation happened and what it concluded. Transcripts live only in informal daemon logs; they are not process artifacts and nothing may cite them. Truth lands in PRD/ADR/CONTEXT as always.

## Consequences

- The channel seam must be a real interface from day one (the ADR-0004 discipline), or the Slack port becomes a rewrite; the pilot does not wait on Slack.
- Every message the process addresses to a human ends with an explicit, set-off CTA — a cross-cutting rule in `process.md`.
- Notifications remain native GitHub ones until a chat channel adds pings.
- Run records / observability were considered alongside and **declined** as a formal requirement; transcripts-in-logs is an implementation detail, not a promise.
