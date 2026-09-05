# Triage 002: A parked run whose ticket was closed keeps holding the project

- **Date:** 2026-09-05
- **Kind:** bug
- **Entry point:** timone-plan (stage 5), anchored on R22 clause 7
- **Source:** issue #99

## Request

Seen live on 2026-09-05. Ticket #91 was marked for work at 10:45Z. The daemon saw it three minutes later and queued it, but never started it. #92 queued behind it too.

What blocked them: the run for ticket #39 was still `parked` in the ledger, waiting on a conversation. But #39 was already over — its pull request #89 was merged and the ticket was closed on 2026-09-04 at 21:54Z. A parked run that owns a work branch holds its project (`src/daemon/runs.ts:689`), so this dead run held `timone` and everything behind it waited.

Why nothing released it:

- The poll cancels an occupying run whose ticket left the marked-open listing, but only when that run is `picked-up` (`src/daemon/poll.ts:1554`). A `parked` occupier is never checked against the listing.
- The resume path only wakes a parked run when a human writes a new comment after the wait cursor. Merging the pull request and closing the ticket write no comment, so the wait never resolved.
- The run record had no `pr` field, so the path that ends a review-parked run when its pull request reaches a terminal state (`src/daemon/poll.ts:2237`) did not apply either.

The way out was `timone cancel timone#39`, run by hand. The daemon then promoted #91 on its next cycle. The fix owed: when a parked occupier's ticket is no longer in the listing, end that run the same way the `picked-up` case does, so the queue moves without a human noticing first.

## Rationale

`doc/specs/prd/prd-02-inversion-of-control.criteria.md`, R22 ("A ticket hosts a sequence of chunks"), clause 7 states, quoted exactly:

> GIVEN a ticket that has been closed, or had its mark removed, while a run for it stands in the ledger
> WHEN the daemon next polls the project
> THEN that run is cancelled with a reason and no session is spawned for it, asserted on the spawn itself rather than on the absence of a log line

This clause names no run status — "a run for it stands in the ledger" covers whatever the ledger admits, which R22's neighbouring clause 6 spells out as "queued, parked, active or failed". The criterion's note records clauses 7 and 8 as built and demonstrated against ledger copies at 859 green tests. Reading `src/daemon/poll.ts:1537`, the registration-cycle check that cancels an occupier whose ticket left the listing is gated on `occupier.status === "picked-up"` — a `parked` occupier never reaches it, and neither the ledger-test file (`src/daemon/poll.test.ts:2444-2479`, the only tests exercising `noLongerListedReason`) nor any other test drives a *parked* occupier through this path. The behaviour observed on #99 is exactly what clause 7 says must not happen: a closed ticket's run stood in the ledger, unstarted, and the next poll did not cancel it.

This is a bug, not a feature: the register already promises the behaviour the reporter wants, in a clause the project's own notes describe as built. It is not a chore either — the document is right; the code is what diverges from it. `ADR-0031`, `ADR-0033` and `ADR-0046` each discuss a parked run legitimately holding its project while a human has not yet answered, and that design is unaffected here — this is the narrower case where the ticket itself is gone, which R22 clause 7 already covers regardless of run status.

## Answer

(not applicable — routed as a bug)
