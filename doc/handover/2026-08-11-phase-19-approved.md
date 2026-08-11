# Handover — Timone — 2026-08-11

> Prior handover: [2026-08-09-phase-18-gate-discharged.md](2026-08-09-phase-18-gate-discharged.md). Its "Exact next action" — *run stage 7 on phase 18* — was done by another session, which **failed both claimed criteria**. This session diagnosed the larger failure, put four options to fvermaut, and planned his choice.

## Snapshot

**[Phase 19](../plans/phases/phase-19.md) is approved for execution and nothing of it is built.** [Phase 18's verification](../plans/phases/reports/phase-18-verification.md) failed R3 and R20; this session traced the R3 failure to its mechanism, and it is not the one phase 18's completion report predicted. **The duplication is between daemon *processes*, not within a cycle** — three stacked faults (no lock on the ledger, the `parked → active` claim written *after* `runtime.start`, and guards answering from an unrefreshed in-memory snapshot), plus a fourth needing no concurrency at all. fvermaut was given four options and chose all three mechanisms layered, which is [ADR-0023](../adr/0023-one-answer-one-session.md). **This session wrote no code.** `main` is at the approval commit, clean, `src/` untouched since the trace.

## Done this session

- **[ADR-0023](../adr/0023-one-answer-one-session.md) written** — the traced mechanism with file-and-line citations, the four options and why each narrow one was rejected alone. `97ccc9b`.
- **[Phase 19](../plans/phases/phase-19.md) planned** — six slices, hand-planned as all Timone-self phases are. `97ccc9b`; approved and stamped at `92c692c`.
- **19e's gate moved off `ivtrends` onto the fixture** on fvermaut's correction, with the rejected reasoning recorded rather than swapped out. `5376b51`.
- **[STATUS.md](../../STATUS.md)** — the two open rulings collapsed to one, and `ivtrends` #10 corrected from open to closed (see below).
- **Memory `live-projects-are-not-guinea-pigs` sharpened** with the specific reasoning that broke it.

## In flight / blocked

- **Phase 19: nothing built.** All six slices are open. 19a–19d are a chain, not a fan — each writes to the ledger path the previous reshaped — and the plan says why.
- **[R3](../specs/prd/prd-02-inversion-of-control.criteria.md) and [R20](../specs/prd/prd-02-inversion-of-control.criteria.md) are both `failed`.** PRD-02 stands at **16 of 20 verified**; PRD-01 unchanged at 22 of 24.
- **The written-answer path is unsafe on `ivtrends` and STATUS.md says so.** Lifted by 19e and by nothing else.
- **`ivtrends` #12, #13, #14, #15 parked on conversations; #11 parked and blocked.** #10 was answered and closed by fvermaut at 19:17 today, outside this session.
- **17c's human gate still outstanding**, as the last three handovers left it.
- **`scratch-app` #4 still parked at triage; #10 and #13 still `failed`** — untouched for the seventh handover running.

## Decisions made this session

- **[ADR-0023](../adr/0023-one-answer-one-session.md) — one answer, one session.** Three mechanisms at three layers, none load-bearing alone. fvermaut rejected the cheap door-lock-only option after being shown that it would stop the reproduction while leaving two faults in place.
- **The safeguard the machine described to fvermaut does not exist in the machine.** "Each run puts its name on the ticket so the second stands down" is `timone-wayfind`'s frontier claim rule, over an assignee the daemon never fetches, under one shared account, in a session that never runs the check. The ADR records this so it is not cited again as though it might have helped.
- **R20 clause 2 is deliberately not folded into phase 19.** The register and the build disagree by design; which moves is fvermaut's ruling, still outstanding. The plan says so in two places.
- **The gate runs on the fixture, and the reason the earlier draft was wrong is recorded.** A fixture does *not* fail to prove human judgement — what a machine-typed answer cannot prove is whether a **person** finds the reply reasonable, and that closes when the person is real, not when the ticket is.

## Exact next action

**Execute phase 19** — invoke `timone-execute` on [phase-19.md](../plans/phases/phase-19.md), stamped `Approved for execution by fvermaut 2026-08-11`. Start at **19a**; the chain is strict.

Three things the executing session must not re-derive: the mechanism is in [ADR-0023](../adr/0023-one-answer-one-session.md)'s Context with citations, **verified before acting on but not re-traced**; the duplication is **not** reproducible in-process, so any test reasoning about two spawns in one cycle has misread it; and **the reproduction is not to be re-run** — [phase 18's verification report](../plans/phases/reports/phase-18-verification.md) carries both instances with timestamps and session ids, and re-obtaining them costs two paid sessions to learn nothing.

**Timone is not a managed project**, so `timone-execute`'s target-project resolution does not apply — this phase's slices touch `src/` at the timone root, as phases 14–18 did.

## Open questions

- **R20 clause 2 — reword the requirement, or build the tracker-resolution path?** `takeover` refuses a wayfinder ticket with no ledger run, which is the sentence ADR-0022 existed to abolish, by deliberate design. **Resolved by:** fvermaut. It is the one ruling still open on him.
- **Does consuming an answer want a visible marker on the ticket?** 19c makes a read answer invisible to a second reader; if the session then dies, the human sees a stall with nothing saying why until `timone status` is run. The plan accepts the stall as the better failure. **Resolved by:** 19e step 3, or fvermaut if the stall reads badly.
- **The frozen output-token counter** — R17's remainder, unexplained since 14g, decoupled from the clock by [15a](../plans/phases/reports/phase-15-clock-investigation.md). **Resolved by:** an investigation nobody has scheduled.
- **`timone status` still cannot see blocking**, and still cannot tell an unanswered question from one handed back. Both recorded, neither in phase 19. **Resolved by:** whoever decides they are worth ledger fields.
- **Nothing tells a resolving session to refresh the tickets that named it as a blocker.** Carried unresolved from the prior handover. **Resolved by:** fvermaut deciding whether to open a grill on it.
