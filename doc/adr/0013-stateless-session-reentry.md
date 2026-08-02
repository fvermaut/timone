# ADR-0013: Stateless session re-entry across human waits

- **Status:** accepted
- **Date:** 2026-08-02
- **Source:** grill session of 2026-08-02 (conversation-medium design for PRD-02)

## Context

The inverted loop waits on humans for days at a time — at every gate, and mid-conversation when a takeover CTA sits unanswered. PRD-02 carried this as an open question: hold the Agent SDK session alive across the wait and reattach, or re-enter statelessly? Held sessions preserve full conversational memory but must survive reboots, crashes and weeks of idleness on a single machine (ADR-0003).

## Decision

**Every human wait is a session boundary.** The daemon never holds an agent session across a wait. Resumption — whether the next poll cycle finds a gate reply, or a `timone takeover` command starts a conversation — spawns a fresh session that rebuilds its state from the committed artifacts and the ticket thread. Nothing else carries state.

## Consequences

- Survives reboots, crashes, and arbitrarily long waits for free; the takeover CLI stays trivial.
- The artifacts must carry everything needed to resume — which is already the process's core discipline (ADR-0006: the repo is the source of truth), so this decision costs nothing new; it makes an existing rule load-bearing.
- Conversational nuance not captured in an artifact or ticket comment is lost at every boundary — accepted; anything worth keeping was to be written down anyway.
- The rule binds all of PRD-02's stages uniformly: gates, conversations, and the PR feedback loop re-enter the same way.
