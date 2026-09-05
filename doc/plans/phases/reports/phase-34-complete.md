# Phase 34 — Completion Report

- **Date:** 2026-09-05
- **Plan:** [phase-34.md](../phase-34.md) — no breakdown; the plan states the human's approval is the list of pieces this work is being built in, not a stamp on this file (ADR-0030 D1)
- **Requirements:** PRD-02.R22 (clause 7) — MUST. Left `draft` on the register; execution moves code, not that document.
- **Branch:** `timone/99-a-parked-run-whose-ticket-was-closed-kee`

## Summary

Ticket #39's run stayed `parked` after its pull request merged and its ticket closed, because the daemon's registration cycle only compared a `picked-up` occupier against the cycle's ticket listing — a `parked` occupier holding its project by owning a work branch was read every cycle and never checked. Nothing else resolves that wait: a park nobody comments on and no pull request now names never ends on its own. The dead run held `timone`, and #91 and #92 queued behind it until a human ran `timone cancel` by hand ([timone#99](https://github.com/fvermaut/timone/issues/99)).

The fix widens the existing check in `pollProject` (`src/daemon/poll.ts`) from `occupier.status === "picked-up"` to `occupier.status !== "active"`, so a parked, branch-holding occupier is cancelled the same way a picked-up one is once its ticket leaves the listing. The spawn branch, which only ever wants a `picked-up` occupier, is gated behind its own `occupier.status === "picked-up"` check so a parked occupier whose ticket is still open is never asked to spawn. `active` is untouched, as the plan required.

Building stopped once, partway through: the plan's third test case claimed a run queued behind the cancelled occupier is still `queued` in the same poll and only promoted on the next one. That is not what the ledger does — `store.cancel` settles the chunk (ADR-0029), and settling is one of the two events `RunStore.transition` promotes the queue head on, so the queued run already reads `picked-up` in the same poll the cancel runs in. Only the spawn waits for a later poll, because the registration check reads `occupier` once, before the cancel, and never re-reads it. fvermaut approved correcting the plan rather than the code; the plan was corrected in place with a dated `✏` note (`11ed7d5`) and the sub-phase resumed against the corrected case.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 34a — a parked occupier's closed ticket is cancelled, not left holding the queue | Landed as planned, after the plan correction above. Four red-green cases in `poll.test.ts`: left alone while listed, cancelled once unlisted, the queued run promoted same-poll but started only on the next, and `active` left untouched. | `5781e14` (plan correction: `11ed7d5`) |

## Deviations from the plan

- **The plan's own third test case was corrected before the sub-phase could pass** — see Summary. Nothing about the code shape changed; only the plan's claim about when the ledger promotes the queue.

## Context for the next agent

- **Running it:** `npx vitest run src/daemon/poll.test.ts` (190 tests), `npm run type-check`, `npm test` (1619 tests) — all green.
- `git grep -n 'occupier.status === "picked-up"' src/daemon/poll.ts` now matches only the spawn-gating `else if`, not the ticket-gone check — the checklist's own instruction to read the hit rather than assert zero.
- This closes clause 7 of PRD-02.R22 for every ledger status the code can produce (`queued`, `picked-up`, `active` — deliberately left alone — and `parked`). The register itself is untouched; a verification pass is what would move R22 off `draft`.
- No pull request is open yet — delivery is next.
