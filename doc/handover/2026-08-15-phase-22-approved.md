# Handover — Timone — 2026-08-15

> Prior handover: [2026-08-14-guardrail-findings-rerouted.md](2026-08-14-guardrail-findings-rerouted.md).

## Snapshot

**`main` is at `19ee102`, clean, pushed.** The session had one job: address the "1 ticket = 1 run" problem before `ivtrends` #1 is picked up. **No code was written and nothing was built** — [phase 22](../plans/phases/phase-22.md) is planned, **approved by fvermaut**, and entirely unbuilt. **818 tests green, type-check clean, unchanged from `a484d34`** since nothing under `src/` was touched. `PRD-02` still stands at **16 of 21 verified** with R15 at `draft`; phase 22 will take that count **down before up**, by design. **Two phases are now queued and their order is deliberate: 22 before 21.**

## Done this session

- **[Phase 22 planned](../plans/phases/phase-22.md)** (`e0fcbba`) — ADR-0026's chunking, six slices: the ledger identity, a run that can end, the breakdown and its gate, chunk succession, the register, the live gate.
- **[Phase 22 approved](../plans/phases/phase-22.md)** (`19ee102`), stamped `Approved for execution by fvermaut 2026-08-14T21:58:15Z`. **That approval is also the ruling on five open decisions** — see below.
- **Two of ADR-0026's predicted costs shown to be free**, recorded in the phase so no slice spends effort on them: the `Timone-Run:` trailer is built from the project and ticket directly (`prompts.ts:165`) and **is never parsed anywhere**, so a ticket-shaped trailer survives a chunked ledger untouched; and guardrail attribution resolves session → run on `run.sessionId` (`guardrails.ts:135`), not on the ticket.

## In flight / blocked

- **Nothing is half-built.** No file under `src/` was opened for writing. Working tree clean, everything pushed.
- **[Phase 22](../plans/phases/phase-22.md) is approved and unstarted.** It is the next build.
- **[Phase 21](../plans/phases/phase-21.md) is still `Awaiting approval`** and is now **deliberately second**. Its own prerequisites say the ledger must be clear of residue before its gate, and 22a+22b are what make that true — until then its fixture runs still need `.timone/state.json` hand-edited.
- **`ivtrends` #1 is untouched** and remains the thing waiting behind all of this.

## Decisions made this session

- **Scope: the ledger *and* the shaping**, not the ledger alone. Put as two options with the cost of each; fvermaut took the larger one. The consequence is that **R5 and R10 lose their `verified` sign-off** — the per-chunk plan gate is retired and the chunk holds the project instead of the ticket — the same rule that cost R15 its sign-off on 2026-08-14, applied a second time.
- **Order: phase 22 before phase 21.** Chosen because 22b closes [findings 8 and 9](../plans/phases/reports/phase-20-live-gate.md), which are phase 21's own blocked prerequisite.
- **Five decisions ADR-0026 left open are ruled by that approval**, set out in [the phase's own section](../plans/phases/phase-22.md#the-five-decisions-this-phase-asks-you-to-make): D1 the breakdown is a committed artifact, not a ledger record; D2 chunk zero merges on the breakdown's approval; D3 a ticket closes when its last chunk's PR merges; D4 the thread says where the initiative stands between chunks as well as during them; D5 a chunk's review stays on its PR. **ADR-0028 is owed and is 22a's first act**, dated on the approval.
- **Nothing normative was written before approval, on purpose.** R22's text and the R5/R10 revisions live in the phase file and are applied by 22e. An amendment unwinds nothing.

## Exact next action

**Execute [phase 22](../plans/phases/phase-22.md), starting at 22a.** It is stamped `Approved for execution` so the entry gate is satisfied. 22a writes ADR-0028 from D1–D5, then changes `runId`, `runSchema`, `register`, and the five call sites the phase names with line numbers.

**22b is the highest-value slice and is independent of 22c** — it is what unblocks phase 21 and ends the hand-editing of `.timone/state.json`.

**Before starting:** `main` is the working branch, as for phases 15–21. **Restart the daemon only when a slice's behaviour is to be observed** — not as a ritual. Nothing in 22a–22e requires a running daemon; 22f does.

## Open questions

- **A refuted guardrail finding still escalates anyway**, carried unchanged from the prior handover. **Resolved by:** fvermaut at phase 21 step 2, with the behaviour in front of him.
- **A session killed after being handed a finding escalates nothing.** Recorded in ADR-0027; phase 21 step 5 measures it.
- **The attribution defect is untouched** — an uncommitted change carries no trailer, so the containment rule can still name the wrong session.
- **The read cost of D1 is introduced and not measured.** Answering "is there a next chunk?" now means reading a file in a checkout every cycle. [Phase 22 says so in "What this phase does not prove"](../plans/phases/phase-22.md#what-this-phase-does-not-prove). **Resolved by:** whoever sees the poll loop get slow.
- **Whether the rhythm holds at real size.** A two-chunk fixture is not a five-chunk milestone; the honest answer arrives on `ivtrends`.
- **Carried unresolved:** the frozen output-token counter (R17's remainder); `timone status` still cannot see blocking; R21's clause 1 versus clause 3, which still blocks its verification.

## Two notes for whoever runs the next one

**The approval stamp was reverted in the working tree after being committed.** `19ee102` stamps the approval and is pushed; an uncommitted edit then set the Status line back to `Awaiting approval`. It was discarded, not the approval — fvermaut had said `approve` in the same breath as asking for this handover. **If the next session finds the file un-stamped, the committed history is the truth.**

**The guardrail round fired on this session and worked, which is live evidence phase 21 wants.** A commit was made and not pushed; the `Stop` check handed the finding **back to this session**, it was fixed in one round, and **nothing was posted anywhere public**. That is [ADR-0027](../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md)'s claim happening unprompted on the interactive path — most of 21a step 3, obtained for free and outside a gate. It should be cited in phase 21's report rather than re-staged.

**And one on how the session went.** The first attempt at the load-bearing question asked fvermaut to choose where the "breakdown artifact" should be stored. He had never heard the word — it is coined in ADR-0026's prose and names something that has never existed. The question was withdrawn, the thing was defined with a machine-typed example of what he would actually read, and he approved the shape in one line. **An ADR's vocabulary is not shared vocabulary until something has been built or drawn.**
