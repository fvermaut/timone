# Handover — Timone — 2026-08-05

> Prior handover: [2026-08-03-phase-12-built-awaiting-live-gate.md](2026-08-03-phase-12-built-awaiting-live-gate.md) — its "Exact next action" (fvermaut runs 12g's six steps) is **done**; read this file instead.

## Snapshot

**Phase 12 is complete and signed off.** A ticket now goes from raw text to an approved plan without anyone naming a stage or a skill: triage classifies it, a feature opens a conversation in the human's own terminal, and the requirements and then the plan are each committed on a work branch and gated on a ticket reply, with the approval written back into the artifact as its stamp. Proven live on `scratch-app` #6 with fvermaut in the loop, change requests included. **PRD-02 R3, R4, R5, R13, R14 all `verified`** — every requirement this phase claimed. 318 tests green, `type-check` clean, `main` pushed.

## Done this session

- **12a–12f built and committed**, one commit each ([completion report](../plans/phases/reports/phase-12-complete.md) has the table).
- **12g passed in full** — all six steps. See the report for what each proved.
- **[ADR-0014](../adr/0014-artifact-first-gates.md)** recorded after a grill: gated stages write their artifact first and gate on it. Amended `process.md` (both gates, the status lifecycle, the ID-stability clock), `timone-prd`, `timone-plan`, and both daemon prompts.
- **Five defects found and fixed outside the slice bodies**, each a dated `✏ Refined` amendment on the plan: `timone status` hiding all but the first waiting ticket, no way to resume the runs phase 11 parked, a branch claimed against a blank project, a gate opened over an artifact that was never written, and an approval-recording session running with no guardrail baseline.
- **Register flipped where evidence reached**, with the limits written in rather than implied.

## In flight / blocked

- **`scratch-app` #6 is parked at execution**, holding branch `timone/6-typing-in-the-box-is-fiddly-on-my-phone`, with an approved PRD pair and an approved five-slice `phase-04.md`. It is phase 13's natural first input and sits exactly at its entry point.
- **`scratch-app` #4 is parked at triage**, classified `triage:bug`, waiting on stage 9's daemon path. Holds no project.

## Decisions made this session

- **[ADR-0014](../adr/0014-artifact-first-gates.md) — write the artifact, then gate on it.** One rule, both gated stages, both the daemon's path and a hand-run session's. Chosen because the artifact *is* the review material and approving a summary approves a different object from the one kept (ADR-0006). The old rule protected nothing anyone had chosen — it assumed a hand-run session with the human in the room.
- **Requirement IDs become permanent at approval, not at first write.** Forced by the above: write-then-gate had already burned `R5`–`R9` on `scratch-app` #6 as tombstones for requirements never ratified.
- **Entry gates are untouched.** A stage that correctly declines — stage 5's anchoring or ADR gate — still writes nothing at all.
- **The daemon writes the gate comment, never the session** that did the work, so the CTA always matches what the decision reader accepts.
- **An approval is recorded into the artifact by a session of its own**, before the run advances, because the next stage may not be built and an approval that only lands when the next stage runs disappears whenever the pipeline stops.

## Exact next action

**Plan phase 13: execution → verification → pull request** (PRD-02 R6, R7, R11), hand-planned like every Timone-self phase. `scratch-app` #6 is parked at exactly its entry point, holding an approved PRD pair and an approved five-slice `phase-04.md` on `timone/6-typing-in-the-box-is-fiddly-on-my-phone`. Nothing else is outstanding on phase 12.

## Open questions

- **Interactive sessions leave no trace.** R13's second clause could only be verified from fvermaut's report — an interactive run produces no ticket comment, no label, no commit, so nobody else can re-check it. Related to the marker-as-convention question below.
- **No supported recovery path for a failed or mis-parked run.** `register` is idempotent per ticket, so re-marking a ticket whose run ended does nothing, and `.timone/state.json` had to be hand-edited three times during 12g. A `timone retry`-shaped slice would close it.
- **A real bot identity** (GitHub App, `timone[bot]`) — still needs a credential from fvermaut. The marker is what exists until then.
- **The marker as a process-wide convention** — interactive stage sessions still post unmarked comments. Needs a grill.
- **Triage's finer routing stays narrowed:** `process.md` lets triage send a clear-enough feature straight to requirements and recommend the at-scale discovery mode; a `triage:<kind>` label cannot carry a judgement, so the daemon always asks first. Documented in `routeAfterTriage`.
- **Only one conversation channel exists.** The seam's second implementation is a test fake; no second medium (Slack) has been built against it.
- Carried unchanged: the deferred PRD-01 list (R23 onboarding repair, R24 standards-drift needing a grill, deployment/maintenance skills, `timone-wayfind`'s first use, never-fired give-up paths). `scratch-app`'s screen-reader HUMAN-CHECK and the guessed 2 ms latency budget remain open on that project.
