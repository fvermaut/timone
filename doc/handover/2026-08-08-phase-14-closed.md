# Handover — Timone — 2026-08-08

> Prior handover: [2026-08-07-phase-14-gate-partly-run.md](2026-08-07-phase-14-gate-partly-run.md). Its "Exact next action" — *run 14h against the gate report* — **is what this session did**, after first finishing the three 14g steps that handover listed as owed.

## Snapshot

**Phase 14 is closed.** All six steps of the 14g live gate are observed, the human gate was answered, 14h is written and the register is flipped: **R16 and R19 to `verified`; R15, R17 and R18 deliberately held at `draft`**, each with its reason recorded. Seven commits, `1424648`..`31a824c`, all pushed; `main` level with `origin/main`, tree clean. The gate found **six defects no unit test could reach** — three fixed, three recorded and unrouted. **The only thing outstanding on Timone is fvermaut's scope call**: do the three recorded defects get fixed before phase 15's Docker previews, or after.

## Done this session

- **[The 14g gate report](../plans/phases/reports/phase-14-live-gate.md)** — extended across five commits until all six steps closed. **It remains the artifact this handover mostly points at**; every measurement below lives there in full.
- **[The phase 14 completion report](../plans/phases/reports/phase-14-complete.md)** — new. Carries the register reasoning, the deviations, what the phase left open, and the scope decision for fvermaut.
- **[PRD-02's criteria register](../specs/prd/prd-02-inversion-of-control.criteria.md)** — R15–R19 all annotated; R16 and R19 flipped to `verified`.
- **[STATUS.md](../../STATUS.md)** — phase 14 in plain language, phase 15 named next, the closed problems struck and the three new ones written in.
- **[README.md](../../README.md)** — `npm link` added to "Getting started" with its reason.
- **`scratch-app` #13 filed and driven** triage → requirements → approval record → planning, to supply the stages #11 could not. **$7.19**, execution never reached, as intended.

## In flight / blocked

- **Nothing on Timone is in flight.** Phase 14 is closed and phase 15 is not started.
- **`scratch-app` #13 sits `failed`** — planning died on an upstream API error before committing its plan. `timone retry scratch-app#13` is the way back. **Not needed for phase 14** (step 1 closed on the session that died), so carrying it to a real plan is a `scratch-app` decision.
- **`scratch-app` #10 still `failed`** and **#4 still parked at triage**, both untouched, as in the prior handover.
- **The three recorded defects are unrouted by design** — see Decisions.

## Decisions made this session

- **R15 held at `draft` on a criterion, not on severity — and this overrides the gate report's own argument.** The phase file would have flipped it: both session kinds were observed in one pass. It does not flip because R15's **fourth** criterion — *a clean session of either kind produces silence* — failed on real evidence. A session clean with respect to path containment drew a loud public accusation naming three files it never touched. The gate report argued severity; 14h found the register's own words going red, which is the stronger ground.
- **R19 deliberately not bundled with the attribution defect.** R19 asks that the trailer be *written*, and it was, on everything without exception. That another rule fails to *read* it is R15's problem — and the trailer's completeness is what makes that defect fixable at all.
- **R18's middle criterion recorded as inadequate *as worded***, not merely unmet. It says "alive **and still stamping its heartbeat**"; a suspended session is not stamping, so the sleep case slips through its own precondition and the requirement reads as satisfied by a run that would in fact be killed. Any fix must bring a criterion saying *healthy runs are never reclaimed* without presupposing the mechanism.
- **The two tick defects are to be routed as one investigation, not two fixes** — the fifth token measurement and the clock divergence came from the same session, and suspension dropping `message_delta` events while `assistant` messages survive would explain both.
- **`npm link` is a required setup step, not a convenience.** fvermaut ran it; no code changed. Every CTA Timone writes names the `timone` binary, and without the link none of them run. A **`setup` skill** (install, build, link, manifest, credential) was **deliberately deferred** until Timone is redistributed — recorded in the completion report because `doc/todo.md` is gitignored and a deferral nobody else can read reads as an oversight later.
- **The gate was driven with `--once` throughout**, per the plan. That turned out to be load-bearing in an unplanned way: it is the only reason the overnight session was not reclaimed, which is how the R18 hazard came to be *measured* rather than suffered.

## Exact next action

**Answer the scope question, then plan accordingly.** Fvermaut decides: are the three recorded defects fixed **before** phase 15 (Docker previews) or **after**? The completion report suggests, if they are taken: **the two tick defects first and together** (R17 and R18 both wait on them), then the attribution defect (self-contained, fix already argued), then `timone retry`'s stale flags (smallest).

Either way the next step is **`timone-plan` on Timone by hand** — for a defect-fix phase 15, or for the Docker-preview phase 15 as originally planned. **Timone's own planning stays hand-run**, and `/timone-improve` is not the route for Timone's own defects: the skill is managed-projects-only.

**One operational warning to carry forward:** do not leave the daemon running unattended overnight on a laptop that sleeps until the clock defect is fixed — it would reclaim healthy runs and discard their work.

## Open questions

- **Does the tick's clock diverge because the machine sleeps?** Now very well supported but still not *proven*: four of five sessions diverged with a textbook 30s-then-~15m gap pattern, and the one session that ran uninterrupted agreed to within one second (7m01s vs 7m02s). **Resolved by:** determining whether the SDK's `duration_ms` excludes suspended time, and whether a monotonic clock or wake-aware staleness is the answer.
- **Why did #13's planning session freeze its token counter at 4.7k for four hours while its replies counter advanced 8→22, with no sub-agent displayed?** This breaks the fan-out explanation that covered the other four measurements. **Resolved by:** the same investigation as the clock — sleep is the shared suspect.
- **Can sub-agent output tokens be obtained honestly?** The obvious fallback is the exact source 14b rejected for under-reporting ~30×. Unchanged from the prior handover.
- **Should the two false-positive flags on `scratch-app` #11 be cleared** when the attribution and retry defects are fixed?
- Carried unchanged: the real bot identity (needs a credential); only one conversation medium behind the R14 seam; the deferred PRD-01 list (R23 onboarding repair, R24 standards drift); `scratch-app`'s screen-reader HUMAN-CHECK; the **two-daemon ledger hazard**; **reclaim-without-recovery** conservatism, now sharpened by the sleep finding.
- **Closed by this session, and no longer open:** whether both session kinds could be guarded in one pass (yes); whether the redirection clause holds (yes, measured at the byte level); whether the model table holds at every row (yes, all five); whether the trailer convention is complete (yes, 13/13).

## A habit this phase earned

**A measurement instrument gets verified before its output is believed.** The redirection check first used `script(1)`, which silently dropped output and produced a wholly convincing false defect — an error line the file "kept" and the terminal "lost". A one-line `/bin/sh` reproduction exposed the instrument rather than the subject. Recorded because the fabricated defect was, briefly, entirely believable, and it would have gone into the record as real.
