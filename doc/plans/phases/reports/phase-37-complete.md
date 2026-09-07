# Phase 37 — Completion Report

- **Date:** 2026-09-07
- **Plan:** [phase-37.md](../phase-37.md) — a standalone bug fix, not part of a breakdown ([ADR-0030](../../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D3 — a bug meets no gate before its pull request, same as a chore).
- **Requirements:** PRD-03.R1 (MUST) — `verified` in the register, unchanged by this phase; the fix closes a gap in the mechanism the register's `verified` status covers, and verification will want to re-examine it against this change.
- **Branch:** `timone/115-daemon-resumes-a-parked-run-on-a-held-ti`
- **Departures:** none — the phase executed as planned.

## Summary

Ticket `timone#105`'s run was parked waiting for an answer while its ticket carried the `timone:held` label. Plain-language comments written by supervised sessions, carrying no machine marker, read as human answers, and the daemon resumed the run on its own on its very next cycle — breaking the promise a hold makes. The cause was narrow: the registration path already refused to open a fresh chunk on a held ticket, but `resumeAnswered`, the path that resumes a run already parked, never read the ticket's labels at all.

This phase adds the missing check, in the same shape as the one that already exists on the registration path: read the ticket's current labels and, if `timone:held` is present, leave the run exactly where it is. The check sits ahead of `resolveWait` — the call that consumes an answer — so a comment left unread while a ticket is held is still there, unread, once the hold comes off; the run then resumes on that same comment rather than the wait having been silently thrown away.

The one thing the plan's code excerpt did not spell out was where the new read needed to sit relative to error handling. Placed as a bare statement ahead of the existing `try`/`catch`, it broke two pre-existing tests covering a run parked on an `escalation` wait whose ticket had left the listing entirely — `threads.ticket()` throws in that case, and that failure was already being caught by the `try`/`catch` around `resolveWait`, which itself reads the same ticket for that wait kind. Moving the new read inside the same `try`/`catch` fixed both without changing where, relative to `resolveWait`, the read happens — the ordering the plan cared about is intact, and the full daemon suite passes.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 37a — A held ticket's parked run stays parked | Landed as planned; five new red-green cases, two existing test-local adapter builders extended with an optional `labels` parameter | `b46f6ff` |

## Deviations from the plan

None — the phase executed as planned. The try/catch placement described above is a mechanical consequence of the plan's own instruction (place the read before `resolveWait`), not a change to what the plan asked for.

## Context for the next agent

- Run the suite with `npx vitest run src/daemon/poll.test.ts` (194 tests) or `npx vitest run src/daemon` (1183 tests) from `projects/timone/`; `npm run type-check` is clean.
- The five new cases live in `src/daemon/poll.test.ts`, in the `"pollOnce — resuming a run whose human answered"` describe block (cases 1, 3, 4) and the `"pollOnce — a run parked on a pull-request review"` block (case 5, the scope guard proving `concludeReview` is unaffected).
- The plan's own note stands: PRD-03.R1 is `verified` in the register on the mechanism this phase just found a gap in. Whether re-examining it needs a fresh live gate or can be argued from this phase's tests plus the existing evidence is verification's call, not this report's.
- No HUMAN-CHECK items are carried forward.
