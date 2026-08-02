# Timone — Domain Glossary

> Ubiquitous language for Timone itself — terms only, no implementation details, no decisions.
> Managed projects each carry their own `CONTEXT.md`; this one is Timone's.

- **Gate** — a single human decision with one clear CTA: approve a PRD, approve a plan, confirm/decline/defer a feedback item. A gate decision is expressed as a reply on the ticket or PR — the ticket is the sole write-path for gate decisions.
- **Conversation** — a multi-turn interactive exchange with the human: a grilling interview, a wayfinder session, a prototype walk-through. Conversations run on a conversation channel, never as ticket comment ping-pong. An acceptance that concludes a conversation (e.g. accepting the grill summary) is an in-conversation act; the session posts the accepted outcome to the ticket as the record.
- **Conversation channel** — the medium a conversation runs on: a chat application (Slack first, pluggable) or a terminal session via takeover. All channels sit behind one adapter seam; the terminal is the universal fallback every channel must reduce to.
- **Takeover** — the terminal fallback for a conversation: the ticket carries a CTA naming a `timone takeover` command; running it resolves what the ticket is waiting on, spawns the right stage session (the human never names a skill), and the session re-enters statelessly from the artifacts and the ticket thread.
- **CTA (call to action)** — the explicit, visually set-off statement of what the human is being asked to do, ending every message the process addresses to a human.
