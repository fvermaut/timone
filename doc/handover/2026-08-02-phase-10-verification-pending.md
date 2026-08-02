# Handover — Timone — 2026-08-02

> Prior handover: [2026-08-01-phase-10-planned.md](2026-08-01-phase-10-planned.md)

## Snapshot

Phase 10 is **substantially executed and not closed**. 10a and 10b are complete and committed. 10c's four feedback intakes have run for real against `scratch-app` and are pushed; run 5's dispatch has been planned, approved, built, closed and pushed as `phase-03`. **What remains is stage 7's verification of phase 03, stage 8's delivery, and 10d.** Execution stopped because of a sustained model/API outage — six consecutive sub-agent failures, then the Agent tool itself became unavailable — not because of anything in the work. Nothing is in a partial state: every stopping point was a clean commit boundary, which is stage 6's commit-after-validation rule doing its job.

`timone-improve` exists and has been through **seven correction rounds**. Four other stage skills were corrected as a side effect of exercising the loop.

## Done this session

**10a — stage-9 spec** (`cc7367e`). `process.md`'s one-paragraph stage 9 expanded to the ten decisions the plan specified; the register contradiction resolved as verdict transitions (stage 7's) vs intent transitions (stage 9's); `doc/feedback/NNN-<slug>.md` added to artifact conventions; skills-README artifact rule reconciled a fourth time.

**10b — `timone-improve`** (`5bc9489`). The skill, plus retirement of four stale "does not exist yet" concessions — two the plan named (deliver, verify) and two more of the same class found while checking (`timone-execute` still claimed `timone-verify` was unbuilt; `timone-triage`'s example named two skills that now exist).

**10c — twelve dry runs, four real intakes, seven correction rounds.**

| Round | Commit | The defect that mattered |
| ----- | ------ | ------------------------ |
| 1 | `e057c50` | The record layer had one class; three of four runs hit artifacts it could not reach. `report amendment` → `record correction`; a **seventh class, `verification pass`**, dispatched to stage 7 |
| 2 | `3e8cf67` | All four re-runs found the intent→verification-pass dispatch downgraded from an obligation to "say so in the record" |
| 3 | `05f91aa` | The layer question gave opposite answers on the highest-stakes item; two tiebreaks added |
| 4 | `b869108` | First real execution: **nothing was ever pushed** — a "committed artifact" nobody could open |
| 5 | `dd63f9f` | The intent path, run live: an amendment **strips regression protection from work dispatched beside it** |
| 6 | `6d2f2fa` | A corrected file must defend itself to a reader who never opens `doc/feedback/` |
| 7 | `b3aea9e`, `fb35332` | `timone-plan` refused stage-9 refinements; `timone-verify` never said the app server blocks |

**Cross-stage corrections this phase caused**, all because stage 9 sends work into stages written before it existed:
- `timone-plan` — the un-anchored path was scoped to "chore work triage routes here", so a **refinement from a feedback record** (the commonest thing stage 9 dispatches) had no branch and would have been refused. Also: "protected by the regression set" was asserted and never computed.
- `timone-verify` — never warned that `npm start` does not return. Two verifier contexts hung and died having written nothing.
- `timone-deliver`, `timone-execute`, `timone-triage` — stale existence claims.

**The four intakes, executed for real on `scratch-app` (all pushed to `main`):**

| Record | Source | Outcome |
| ------ | ------ | ------- |
| `doc/feedback/001-completed-todos-reappear-after-reload.md` | triage 001, routed here 2026-07-19 | closed **already resolved** — the record predates the build by six days; no dispatch, no PRD touch |
| `doc/feedback/002-phase-01-delivery-review-findings.md` | PR #1's nine findings | 7 confirmed, 1 declined, 1 deferred with a trigger. **PRD-01.R6 amended in place**, `Status: revised`, register intent-transition in the same commit (`26aba7c`). Three dispatches |
| `doc/feedback/003-extended-zod-deviation-cites-r2-r3.md` | PR #2 Spec finding 2 | record correction to `doc/standards.md` — the zod grant no longer claims requirement backing it never had |
| `doc/feedback/004-stale-focus-after-delete-non-conformance.md` | PR #2 Spec finding 1 | record correction — a stale open non-conformance withdrawn; the finding's headline accused the wrong artifact and its own report's note reversed it |

**Run 5 — the loop closing.** `phase-03` (one binding for the todos cache tag): planned from feedback 002 item 1, approved by fvermaut as written, built, closed, pushed. Branch `phase-03-todos-cache-tag`, commits `06b691e` (plan, on `main`), `03e5ebf` (03a), `79420b1` (close). Unit 4 / integration 9 / e2e 6, all unchanged; the e2e core-loop walk is the phase's real gate and passed.

## In flight / blocked

- **Stage 7 has not verified phase 03.** Three attempts died to infrastructure. The branch is pushed and clean; a fresh verifier can start immediately. **Do not let the author verify it** — the last sub-phase was committed by a context that had read the diff and run the build, so that context lacks independence.
- **Stage 8 has not delivered phase 03.** No PR exists for it.
- **10d not started** — README, `STATUS.md`, and R14's status.

## Decisions made this session

All fvermaut, 2026-08-02:

- **Six classes became seven.** `phase-10.md` carries a dated ✏ marker recording it. **This voids the plan's approval stamp under stage 5's own re-approval rule and fvermaut has not yet re-approved it.**
- **Spec 2 is intent, not a refinement** — reversing an earlier confirmation, on the fresh argument that no criterion required the built app's first render to reflect current database state; stage 7 had *worked around* it rather than failing it. This is what gives R14's PRD-amendment clause live evidence.
- **The duplicated e2e mutex is deferred**, trigger: a third e2e spec file.
- **The unused fonts are declined** — generator defaults stand.
- **The zod deviation is a record correction, not the intent route.**
- **Run 5 dispatches the cache-tag constant**, bounded to that one item.
- **Phase 03 approved as written.**
- **Phase 03's plan amended during execution, stamp retained** — a validation probe's expected output described the fallback shape, not the shape the plan specifies. Corrects a defect execution found and asserts less, so the stamp stands.

## Exact next action

1. **Verify phase 03** — `/timone-verify scratch-app phase-03` from a fresh context. Un-anchored, empty claimed set, so the pass is the derived regression set plus carried-forward HUMAN-CHECKs. **Have it derive the set and show the computation**: the register holds R6 at `revised`, and how a `revised` criterion behaves in the *derivation* is the last untested seam in stage 9's loop. Background the app server.
2. **Deliver phase 03** — `/timone-deliver scratch-app phase-03`. New PR, base `main`. **It must not merge.**
3. **10d** — README gains `/timone-improve`; Timone's `STATUS.md`; then R14.

## Open questions

- **R14's status is a judgement call for fvermaut.** Every clause now has live evidence — including the PRD amendment, thanks to the Spec 2 decision — *except* that the loop has not yet been seen to close at a PR, which is what steps 1 and 2 above finish. Flip to `verified` only after 10c's human gate genuinely passes; do not flip it on the strength of the specification alone.
- **`phase-10.md` needs re-approval** before the phase can honestly close.
- **PRD-01.R7's screen-reader HUMAN-CHECK** is queued (feedback 002, dispatch C) and needs fvermaut at a Mac with VoiceOver and Safari. No agent can discharge it.
- **Nothing is to merge.** PR #2 and phase 03's future PR both stay open for fvermaut.
- **A hole wider than stage 9:** `process.md`'s status-reporting section tells *every* stage to commit `STATUS.md` on the default branch and never says to push. Stage 8 pushes only because opening a PR forces it. Stage 9 was fixed here; the general rule is a candidate for its own remediation.
- Carried unchanged: nothing enforces the `STATUS.md` branch rule; docs-last sequencing reopens the status-contradiction window; whether to delete the merged phase-01 branch.
