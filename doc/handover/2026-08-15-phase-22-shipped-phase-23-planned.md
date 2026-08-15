# Handover — Timone — 2026-08-15

> Prior handover: [2026-08-15-phase-22-approved.md](2026-08-15-phase-22-approved.md).

## Snapshot

**`main` is at `45005fc`, clean, pushed.** [Phase 22](../plans/phases/phase-22.md) was executed and **closed at 22b** — its ledger half shipped, its shaping half was cut unbuilt and is re-planned as [phase 23](../plans/phases/phase-23.md), which is written and **`Awaiting approval`**. **859 tests green across 24 files** (up from 818), type-check clean. `.timone/state.json` was **never hand-edited and never modified** across the whole session; it still holds its 26 original runs.

**Three artifacts are waiting on fvermaut, and they must be signed in order:** [R22 in the register](../specs/prd/prd-02-inversion-of-control.criteria.md) (`ed5060b`), [ADR-0030](../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) (`19f13e0`, **`proposed` — the only ADR in the repo that is**), then [phase 23](../plans/phases/phase-23.md) (`45005fc`). Approving phase 23 is what accepts ADR-0030.

## Done this session

- **[Phase 22](../plans/phases/phase-22.md) executed, 22a and 22b** (`d48ce65`, `88c03df`) — the chunked ledger, and a run that can be ended. **Findings 8 and 9 from [phase 20's live gate](../plans/phases/reports/phase-20-live-gate.md) are closed**, which unblocks [phase 21](../plans/phases/phase-21.md).
- **[ADR-0029](../adr/0029-a-chunk-advances-only-on-success.md)** — a chunk advances only on success, found during execution.
- **[Phase 22 closed](../plans/phases/reports/phase-22-complete.md)** (`d37e470`) at reduced scope. A reduction keeps the approval stamp, so it closed against its original approval.
- **[PRD-02.R22 persisted](../specs/prd/prd-02-inversion-of-control.criteria.md)** (`ed5060b`) — eight clauses, four of which have no machinery yet and say so.
- **[ADR-0030 proposed](../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)** (`19f13e0`) and **[phase 23 planned](../plans/phases/phase-23.md)** (`45005fc`), nine slices.

## The thing worth knowing, if you read nothing else

**`TERMINAL` had been doing two unrelated jobs since the daemon was built** — freeing the project lock, and declaring a ticket finished. Under one-run-per-ticket they are indistinguishable. Chunking forces them apart: a failed chunk must free the project so a queued ticket starts, but must **not** let its own ticket advance, or `timone retry` races a successor for the same work. `TERMINAL` kept the lock job; **settledness** ([ADR-0029](../adr/0029-a-chunk-advances-only-on-success.md)) took succession. Execution found this, not planning, and it is why 22a took two attempts.

## In flight / blocked

- **Nothing is half-built.** Working tree clean, everything pushed, suite green.
- **[Phase 23](../plans/phases/phase-23.md) is `Awaiting approval`** and is the next build. Its **safe stopping point is 23a–23e** — declared in advance, because phase 22 reduced cleanly at 22b only for that reason.
- **[Phase 21](../plans/phases/phase-21.md) is still `Awaiting approval`** and is now genuinely unblocked: its prerequisite was a ledger clear of residue without hand-editing, which 22b delivered.
- **The live ledger still holds its residue** — 2 failed runs (`scratch-app#10`, `#13`) and 1 parked. `timone cancel` can now clear all three; nobody has, because clearing them is phase 21's to do inside its own gate.
- **`ivtrends` #1 is untouched** and remains the thing waiting behind all of this.

## Decisions made this session

- **A failed chunk keeps holding its ticket** — ruled by fvermaut, recorded as [ADR-0029](../adr/0029-a-chunk-advances-only-on-success.md). The plan had asked for both "a terminal run accepts a further run" and "`retry` re-arms from failed", which cannot both hold.
- **`failed → cancelled`** — ruled by fvermaut. Without it, clearing a failed run meant retrying it first, through a window the daemon polls, and finding 9 stayed half-closed.
- **Unmarking a ticket cancels the run about to start on it** — confirmed as wanted. The daemon sees only the marked-and-open set, so absence covers closed and unmarked alike and the two cannot be told apart without adapter changes.
- **Phase 22 reduced to 22a+22b**, and the breakdown re-planned rather than amended.
- **Three amendments were made by the executing stage** rather than routed to stage 5, on fvermaut's explicit ruling that the phase proceed under its existing stamp, taken with the alternative in front of him.

## Open questions

- **ADR-0030 is `proposed` and its shape is the load-bearing choice.** A `breakdown` pipeline stage with `processStage: 5`, versus moving the existing requirements gate. **Resolved by:** fvermaut approving or rejecting phase 23.
- **Does a chore keep a gate?** `routeAfterTriage` sends a chore straight to `planning`, so an ungated `planning` leaves it with no human gate before its pull request. Phase 23's 23c routes chores through `breakdown`; the alternative is that a chore's judgement moves to its PR. **Resolved by:** fvermaut at phase 23's approval.
- **Is the breakdown immutable after approval?** R22 clause 5 says a merged chunk is "marked done in the breakdown", which would mean the daemon committing and pushing to a client repo's default branch — machinery that exists nowhere. Phase 23 re-specifies the breakdown as immutable with doneness derived from the ledger. **Resolved by:** fvermaut at phase 23's approval.
- **Carried unresolved:** the attribution defect (an uncommitted change carries no trailer); the frozen output-token counter; `timone status` cannot see blocking; R21's clause 1 versus clause 3; a refuted guardrail finding still escalating.

## Three notes for whoever runs the next one

**Verify the sub-agent, not just the code.** Every slice this session returned a confident, well-evidenced report, and three of them contained something material that only survived because it was checked: 22a's first pass reported its checkboxes PASS while `npm run type-check` — a command in its own validation block — was failing. Re-running the validation block yourself is not ceremony.

**A bare `switch` over a union is not exhaustiveness-checked.** Adding `cancelled` to `RunStatus` broke the build at `cta.ts`'s `satisfies` tripwire, loudly and at the exact line. `takeover.ts`'s bare switch compiled clean, passed 856 tests, and shipped a sentence claiming a cancelled run "is parked… no reason recorded" until somebody ran the command. **A tripwire that compiles is worse than one that does not**, and `session.ts:941` is the next one of these — its fall-through comment says "the only remaining wait-free stage is triage", which phase 23's 23b invalidates.

**The anchoring gate would have caught phase 22's failure a week earlier.** Phase 22 planned 22c–22f against `PRD-02.R22`, listing it as *"added and closed"* by 22e — the requirement was to be written by the slice implementing it. Nobody had written down the observable behaviour before deciding how to build it, and the cut that came out was wrong in three places. Stage 5 stopped on exactly that gate this session, which is why R22 exists now.
