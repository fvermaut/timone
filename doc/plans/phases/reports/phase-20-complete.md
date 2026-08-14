# Phase 20 — Completion Report

- **Date:** 2026-08-14
- **Plan:** [phase-20.md](../phase-20.md) — breakdown approved by fvermaut 2026-08-13, the same day the ruling behind it was made. **No amendments and no re-approvals**: the plan was executed as approved, and the two file-grant widenings it needed were orchestrator decisions rather than plan changes (phase 20 carries no file markers).
- **Requirements:** PRD-02.R21 (MUST) — **stays `draft`**; six of its eight clauses were observed live and two were not, so it is not verified here and must not be read as such. PRD-02.R20 (MUST) — **stays `failed`**; clause 2 is now **built**, clause 3 closed with phase 19, clause 1's `prototype` and `task` branches remain unobserved. PRD-02.R1 (MUST) — **unchanged and unamended**; its run-clause was re-observed live and its stale 2026-08-03 evidence corrected in place.
- **Branch:** `main` — no phase branch, following every prior Timone-self phase (15–19). The skill's one-branch-per-phase rule is written for managed projects with a stage-8 pull request; Timone has no such flow, and a branch would sit unmerged with no reviewer. A deliberate deviation, recorded rather than omitted.
- **Tests:** **695 green at the phase's start, 792 green across 23 files at 20g.** Type-check clean throughout.

## Summary

On 2026-08-13 the `ivtrends` wayfinder map closed its last question and fvermaut replied on it: *"ok go ahead and write the spec."* **Nothing happened, and nothing was going to** — the map was deliberately unmarked, and `wayfinding` declares no `next`. Probing every open ticket on both projects the same day found **all four failing**, each differently, and two faults already on the record turned out to be the same disease: a call to action that was true when written and went stale with nothing responsible for it afterwards.

[ADR-0024](../../../adr/0024-every-open-ticket-answers-for-itself.md) made that one rule seen from six sides, and all six are built. There is now exactly **one** computation of what a ticket needs, rendered onto both the ticket and `timone status` (20a); the ticketing seam can revise a standing statement instead of repeating it (20b); the daemon reconciles that statement onto every listed ticket each cycle and **only where it differs** (20c); an unmarked ticket is introduced to exactly once (20d), governed by a per-project switch that defaults off (20e); the wayfinder map is a run-backed ticket whose call to action tracks its own state and flips when its frontier empties (20f); and `takeover` creates a run from the tracker rather than refusing anything the ledger has never heard of (20g).

**The gate is the evidence, and the sentence that matters is fvermaut's own.** On the fixture map, the frontier emptied, the call to action flipped **unprompted** to *"say go ahead here and I'll write the specification this map has been finding its way to"*, his written go-ahead started stage 3 **on the map's own run**, and he approved the resulting specification himself on the ticket at 13:51:32Z. That is the identical gesture that produced nothing at all the day before.

**And the gate is why R21 does not close.** Two of its eight clauses were not obtained — clause 3 is unobservable on this machine because fvermaut enabled the introduction switch on both projects, and clause 6's *"the right session opens"* half was not seen — and the ten-minute idle observation stands at **4m19s**, ended by his own comment and defeated on the retry by a real GitHub outage. Timone's own rule is that a requirement is verified only when an agent that did not build it checks it and records evidence. **A marker recording exactly what was seen is what this phase leaves; the status is stage 7's to move.**

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 20a — one computation, two renderers | Landed as planned. `ctaFor` decides; `ctaComment` and `timone status` render. **`timone status`'s output is byte-identical to `main`'s across 64 renders**, and the one-call property is proven by a three-step mutation probe rather than by two strings agreeing. | `704180f` |
| 20b — the ticket-side upsert | Landed as planned. `upsertComment` edits Timone's last statement under a marker, and tells its own comment from a human's by the machine header alone — never by the author, who is the same account. | `d6d7fe4` |
| 20c — the CTA is reconciled each cycle | Landed as planned. The zero-writes guard was written first, as the plan required, and is non-vacuous by the mutation ADR-0024 warns about. | `4f8aabd` |
| 20d — see the unmarked, and introduce yourself once | Landed as planned. `listOpenTickets` beside `listMarkedTickets`, exactly-once from a ledger record, and **R1's no-run clause asserted as a regression test** rather than left to the shape of the loop. | `6a16f66` |
| 20e — the backlog switch | Landed as planned. `introduce_unmarked`, **absent means off**, gated above the listing call so a quiet project costs its tracker nothing at all. | `18d0ea0` |
| 20f — the map becomes first-class | Landed as planned. A `charting` stage, a frontier label translated into the run's wait, and **`wayfinding` still has no `next`, asserted as its own test.** | `61fb6da` |
| 20g — takeover resolves from the tracker | Landed as planned, **plus one escalation closed inside the slice** (see Deviations). The retirement of the old refusal is pinned as a prohibition, not left to reading. | `2c931d3` |
| 20h — live gate | **Run.** Six R21 clauses observed, two not; the idle check partial; seven findings. | no commit — the evidence is [the live-gate report](phase-20-live-gate.md) |
| — documentation, register, reports | **The plan has no such sub-phase.** See Deviations. | this slice |

Test count by slice: 722 (20a) → 727 (20b) → 735 (20c) → 755 (20d) → 769 (20e) → 782 (20f) → 792 (20g).

## Deviations from the plan

- **⚠ The plan has no documentation sub-phase, and this report exists because of that omission.** [Phase 19](../phase-19.md) had 19f for exactly this work — flip or hold the register, update `STATUS.md` and `README.md`, write both reports. **Phase 20 stops at its live gate.** So the criteria register, `STATUS.md`, `README.md`, this report and the live-gate report were **unassigned by the plan** and were treated as phase-close work by the orchestrator. It is recorded rather than smoothed over for two reasons: the plan's own rule is that its slices are the whole of the work, and a phase that ends at a gate with its register unmarked is a phase whose most consequential artifact — the record of what was and was not proven — depends on somebody noticing it is missing. **The next Timone-self plan should carry a documentation slice explicitly**, as 19f did.
- **✏ Two file-grant widenings, both orchestrator decisions, neither a plan amendment.** 20b's grant was widened to fix the **19 conformance sites across 7 test files** that a tenth method on `TicketingAdapter` broke; 20e's was widened to `src/commands/projects.ts` and a new test file after [ADR-0008](../../../adr/0008-manifest-writes-via-cli-command.md)'s *"the command accepts flags for every schema field"* obliged a CLI flag pair for the new manifest key. Phase 20 carries no file markers, so no plan amendment was involved in either. Both are recorded in [the handoffs](phase-20-handoffs.md).
- **✏ 20g closed its own first escalation inside the slice**, with `src/daemon/poll.ts` added to its grant for that fix alone. Enrolling from the tracker is what made *"unmarked"* and *"not mine"* stop being the same fact; left standing, a ticket taken over but still unmarked would have received *"add the `timone` label if you would like me to pick this up"* **while its run was parked and a session was open on it** — a ticket lying about its own state, inside the phase that exists to abolish exactly that.
- **✏ The plan overrode ADR-0024 on one mechanism, and the build followed the plan.** The ADR says *"a marker in the comment makes it exactly-once"*; the plan specified *"a record in the store is what makes something happen once"*, following `releasePreview`'s precedent. 20d built the record and deliberately defined **no** introduction marker. **The consequence is a real one: a lost or reset ledger re-introduces on every unmarked ticket.** It adds no new class of failure — `readState`'s own docblock already says a silently-fresh state file would re-pick-up every ticket the daemon has ever seen — but the divergence is written down here so a later reader does not mistake it for the build drifting from the decision.
- **No phase branch**, per the Branch line above.
- **`ivtrends` was touched, though it was not the gate.** fvermaut enabled `introduce_unmarked` on it as well as on the fixture (`7693de8`), and its one unmarked open ticket — #1, the map — received one introduction. That was his call, and it is the reason R21 clause 3 became unobservable; both halves are in the live-gate report.

## What the phase did not close, and must not be read as closing

- **PRD-02.R21 stays `draft`.** Six clauses were observed live and confirmed by fvermaut; **clause 3 was not obtained** (no project on this machine is in the default state) and **clause 6's session-opening half was not observed** (the run was created; #29 held the project, so #30 queued). The **ten-minute idle observation stands at 4m19s**. The register carries a dated marker naming exactly this. Verification is stage 7's.
- **PRD-02.R20 stays `failed`.** Clause 2 is **built** — `takeover` creates the run from the tracker and the retired refusal never appeared at the gate — but a status is not this phase's to flip. Clause 3 closed with phase 19. **Clause 1's `prototype` and `task` branches remain unobserved**: the fixture map exercised `grilling` and the new `map` kind only.
- **PRD-02.R1 is unamended.** Its criterion forbids a *run* on an unmarked issue and has never forbidden a comment, so the requirement stands exactly as written. Its 2026-08-03 **evidence** is what the phase invalidated, and that is corrected in place rather than deleted.
- **The register's own internal tension is unresolved, and deliberately.** **Clause 1 promises every open ticket carries a line stating what happens next; clause 3 blesses silence on a backlog project** — so an unmarked ticket on a project with the switch off carries **nothing at all**, no introduction and no standing call to action. 20d, 20e and 20g each flagged this independently. **It is a contradiction inside the register fvermaut approved, and it is his to settle** — not a slice's, not the orchestrator's, and not stage 6's. Widening `reconcileCtas` to the open listing would decide it quietly and would also undo 20e's restraint, which ADR-0024 calls *"the whole of the restraint"*.
- **Whether a discovery map should become the build ticket** — see finding 3. It follows correctly from `next: "requirements"`, it is what ADR-0024 asked for, and **nobody put it to fvermaut**. Left alone at the gate, the fixture map's run would have built the feature end to end.
- **The seven live-gate findings**, none fixed here: the false accusation from the path-containment guardrail, fixture decisions landing in a project's permanent record for the second time in two days, the map walking on into building, R17's frozen counter caught lagging, the outage that tested per-ticket error containment for real, a killed session reported as working until something witnesses it, and the exact ledger residue on two closed tickets.

## Context for the next agent

**Running it.** `npm test` (792 across 23 files), `npm run type-check`, `npm run build`, then `node dist/cli.js …`. Each slice's validation block, with its red→green trace and its mutation probes, is in [phase-20-handoffs.md](phase-20-handoffs.md).

**Clear this first, before anything else on the ledger.** `scratch-app#29` is `active` at `planning` and `scratch-app#30` is `queued`, while **both tickets are closed** — the outage stopped the daemon witnessing the endings. Until it is cleared, `#29` holds `scratch-app` against every other ticket.

**One known intermittent, unchanged and not this phase's:** `src/commands/guardrails.test.ts > finding the run that drove a session > resolves the session id against the ledger` does real `git` work and blows its 5000ms timeout under full-suite contention. Confirmed failing at `2c7f04e` and at `18d0ea0`, before any of this work. A red run on that name is not a regression from this phase.

**The operator consequence that outlives this phase**, unchanged from 19 and worth repeating because it bit again here: **a `timone daemon` already running executes whatever code was in memory when it started.** The daemon and the CLI both run from `dist/`; rebuild and restart, or the fix is on disk and not in the process.

**The two things most likely to be misread.**

- **An unmarked ticket that `takeover` enrolled gets no standing call to action.** `reconcileCtas` walks the marked listing only. That is the open question above; it was seen, weighed and left, and it is not an oversight.
- **`timone takeover` never claims the run it works** (carried forward from phase 19). The claim-before-work rule holds for the daemon alone, and no document may overstate it.

**Deferred to the delivery review** (refactoring is not stage 6's), carried out of the slices' own handoffs and deduplicated — four slices said the same two things:

- **A `ProjectTurn { project, config, deps, result, log }` context object.** `pollProject` now takes six parameters and calls four per-project passes with the same trailing run; 20c, 20d, 20e and 20f each raised it independently, which is as close to a unanimous vote as this file gets.
- **One *"is this the machine's comment under this marker"* predicate.** The identity rule that protects a human's comment from being overwritten is now written **four** times — twice in `github-tickets.ts`'s two upserts, and again as `standingCta` + `saysTheSame` in `poll.ts`. It is one decision, and it is the decision with the worst failure mode in the phase.
- `upsertComment` and `upsertPullRequestComment` are the same algorithm twice; a private `upsertMarked(comments, marker, body, postFresh)` would leave one copy.
- `runId`, `previewKey` and `introductionKey` are three exported functions with one body; one `ledgerKey` would say once that the ledger keys everything by project and number.
- `ctaFor` is a run of nine guarded returns and wants a `switch` on the run status with the parked branch extracted; the `waitingOnYou` + `command?` pair could become a `CtaMove` discriminated union, per `standards/typescript.md`.
- `resolveTakeover`'s return type is written out twice; a named `TakeoverPlan` would leave one copy and let the unprompted-stage check be asked once instead of twice.
- **Two copy warts, both deliberate and both one-line:** a map receives the generic *"Picked this up. I'm reading it now, working out what kind of request it is…"* acknowledgement, which is not quite true of a map; and a run parked at an **unbuilt** stage is still listed by `timone status` as *"waiting on you"* although nothing the human types moves it.
