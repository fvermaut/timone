# Handover — Timone — 2026-08-09

> Prior handover: [2026-08-09-phase-18-answerable-tickets.md](2026-08-09-phase-18-answerable-tickets.md). Its "Exact next action" — *execute phase 18* — was done by another session, which built all four code slices and ran three of the five gate steps. **This session ran the other two.**

## Snapshot

**[Phase 18](../plans/phases/phase-18.md) is complete: four code slices, five gate steps, all passing.** The two steps the prior sitting could not run — the written path, including the discriminating partial-answer case — ran here, on **`scratch-app` rather than `ivtrends`**, because fvermaut declined to use a live project as a guinea pig. A throwaway map was charted on the fixture project and answered against his already-running daemon: a full answer resolved and closed its ticket in 2m24s with nothing typed by hand, and a contradictory one drew exactly one follow-up and then a hand-back with no third question. **`ivtrends` was not touched by this session at all.** What is *not* done is the flip: [PRD-02](../specs/prd/prd-02-inversion-of-control.criteria.md) still reads **16 of 20 verified**, R3 `revised` and R20 `draft`, because that belongs to a pass that did not watch the build. Nothing is blocked; the next thing is stage 7.

## Done this session

- **[18e's steps 2 and 3 discharged](../plans/phases/reports/phase-18-live-gate.md)** — the gate report gains a second half covering both, the evidence, and what the fixture substitution does *not* buy. `0bcb555`.
- **[Phase 18](../plans/phases/phase-18.md) stamped Complete** and its Definition of done ticked, with the one amendment below.
- **[STATUS.md](../../STATUS.md)** — the written path described as watched rather than promised, and the stale "the nine questions are not connected yet" paragraph corrected to three connected, six deliberately not.
- **`npm test` 662 green, `npm run type-check` clean** at `0bcb555`.
- **Three findings added to the gate report** (5, 6, 7) — see Decisions and Open questions.
- **The fixture cleaned up through the machinery**, not by hand: `scratch-app` #17–#19 closed, no run left nagging in `timone status`. `5ef58df`.

## In flight / blocked

- **Phase 18's independent verification has not run.** Nothing of stage 7 is started. This is the only thing standing between the phase and fvermaut's sign-off.
- **[R3](../specs/prd/prd-02-inversion-of-control.criteria.md) is still `revised` and [R20](../specs/prd/prd-02-inversion-of-control.criteria.md) still `draft`.** The behaviour behind both was observed live and is written up; the status flip is stage 7's to make, not the gate's.
- **Gate findings 1–7 are all recorded and none is fixed.** Findings 1 (marking several tickets queues them and says the wrong thing), 2 (the daemon has no notion of blocking) and 7 (nothing tells a resolving session to refresh its dependents) are the ones with teeth.
- **`ivtrends` #6, #9 and #7 sit parked** on conversations, marked and answerable either way. #5 was resolved by a parallel interactive session while this one ran; #7 was unblocked, refreshed and marked as a consequence. **None of that was this session's doing.**
- **17c's human gate is still outstanding**, as the last two handovers left it.
- **`scratch-app` #4 still parked at triage; #10 and #13 still `failed`** — untouched for the sixth handover running.

## Decisions made this session

- **A live project is not a guinea pig.** fvermaut stopped the gate from running on `ivtrends` and asked for it to be verified autonomously with no impact on his projects. Timone's own live gates run on `scratch-app`, which is what every prior one used. Saved to memory, since it is a standing preference rather than a fact about this phase.
- **The fixture substitution is written down with its limit rather than glossed.** The answers were typed by the gate session in a user's voice. That proves the mechanism — real tracker, real daemon, real sessions, real ledger — and proves nothing about whether a *person* would agree the escalation fired at the right moment. That single gap is named in the phase file, the gate report and `STATUS.md`.
- **The done-list item about the nine `ivtrends` tickets is amended to the ready ones**, on fvermaut's reading that blocked tickets get refreshed by Timone as their blockers close. The evidence supports him: #7's body was rewritten and marked when #5 resolved, and its park comment carried a working takeover line. **The gap that leaves is finding 7**, not more hand-work.
- **A conversation ticket closed by hand leaves its run parked forever** (finding 6), which is why the fixture was tidied by answering it rather than by closing it. `concludeLastConversation`'s docblock calls the lingering harmless; it is not, once `timone status` is the thing the human reads.

## Exact next action

**Run stage 7 on phase 18** — invoke `timone-verify` for the phase, from a context that did not watch the build. Its job is the register, not the machinery: re-check [R3](../specs/prd/prd-02-inversion-of-control.criteria.md) **whole** (the two phase-12 clauses as well as the written one — a requirement's status is the weakest of its clauses' outcomes) and [R20](../specs/prd/prd-02-inversion-of-control.criteria.md)'s three clauses, against the evidence in [the gate report](../plans/phases/reports/phase-18-live-gate.md), and flip both statuses or say why not.

Two things that pass must weigh: R20's clause 3 was observed on `scratch-app`, not `ivtrends`, and the answers were machine-typed. Both are stated in the report; neither was hidden, and whether they are sufficient is exactly the judgement stage 7 exists to make.

## Open questions

- **Is a fixture-run gate enough to verify R20's third clause?** The mechanism was observed live and end to end; the human's half of it was simulated. **Resolved by:** the verification pass, and fvermaut's sign-off after it.
- **Nothing tells a resolving session to refresh the tickets that named it as a blocker** (finding 7). It happened correctly on `ivtrends` #7 by good judgement rather than by rule, and it fails silently for any blocker closed outside Timone. One paragraph in `timone-wayfind` — but a process change, so it wants a grill first. **Resolved by:** fvermaut deciding whether to open that.
- **Does R10's one-run-per-project fit a map?** Carried over unresolved from the prior handover, and finding 1 sharpened it: marking several tickets in one cycle queues all but the first and tells them work is colliding when nothing is. **Resolved by:** fvermaut, once he has used it enough to say.
- **`timone status` cannot distinguish a ticket never answered from one answered twice and handed back** (finding 5). The bound lives in the thread by design; the status line is what the human reads. **Resolved by:** whoever decides whether that is worth a ledger field.
- **R11 and R17 remain PRD-02's two long-standing gaps**, unchanged: R11 one clause short, R17's output-token counter still frozen and still unexplained.
