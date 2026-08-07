# Handover — Timone — 2026-08-07

> Prior handover: [2026-08-06-phase-14-built-awaiting-live-gate.md](2026-08-06-phase-14-built-awaiting-live-gate.md). Its "Exact next action" — *run 14g with fvermaut* — **is what this session did**, for three of its six steps. This session began as a crash recovery and became the gate.

## Snapshot

**Phase 14 is built, and 14g is half proven.** Steps 3, 4 and 6 are complete; steps 1, 2 and 5 and the human gate are not. The gate found **four defects that unit tests could not** — all four are recorded, none fixed, on fvermaut's explicit call — and two others were fixed during the pass. All five requirements (R15–R19) remain `draft`; **on this evidence R15, R17 and R18 must stay down**, and 14h is what decides. Everything is committed and pushed; `main` is level with `origin/main`, tree clean.

The session opened with everything dead: a stray process had signalled every terminal, killing the daemon mid-execution and leaving `scratch-app` #11 wedged `active` with one uncommitted fix in the working tree. All of that is resolved, and #11 went the whole way to a merged PR.

## Done this session

Seven commits, `ca3bc09`..`30eeed6` — one fix, six on the gate record.

- **[`ca3bc09`](../../src/daemon/session.ts) — the recovered fix**, with the test it was missing: `run.stage` was written only when a stage *finished*, so `timone status` named the previous stage for the whole duration of the current one. Found live; test goes red without it.
- **[The 14g evidence log](../plans/phases/reports/phase-14-live-gate.md)** — created and extended across five commits as the gate ran. **It is the artifact this handover mostly points at**; it carries the per-step evidence, all six defects, the cost table and per-requirement register guidance for 14h.
- **`scratch-app` #11 ran ticket → merged [PR #12](https://github.com/fvermaut/scratch-app/pull/12)** (14 files, +1535 / −24), through a real crash and an upstream API failure, needing no human repair beyond two `timone retry` calls. Its own artifacts are in that repo under `doc/plans/phases/reports/phase-05-*`.

## In flight / blocked

- **14g steps 1, 2 and 5 are not done**, and the **human gate** is unanswered. All four are listed with what each needs in the [report's "Still owed"](../plans/phases/reports/phase-14-live-gate.md).
- **14h is not started.** It reads the gate report, writes `phase-14-complete.md`, and decides the register flips.
- **The four recorded defects are unrouted by design** — see Decisions.
- **`scratch-app` #10 sits `failed`** ("the planning stage finished without committing anything to gate") from an earlier session; **#4 remains parked at triage**. Neither was touched.
- **#11 finished carrying two containment flags, both false positives** — the `daemon.log` one that `8f96919` fixed, and the three-file accusation that was this session's own. Harmless on a done run, but they are the visible residue of two recorded defects.

## Decisions made this session

- **Four defects recorded rather than fixed, on fvermaut's call each time.** They are the gate's main output and all four are written up in the report: guardrail findings **attributed to the wrong session**; the tick's **token count** under-reporting with fan-out; the tick's **clock** disagreeing with the session's; `timone retry` **carrying a dead attempt's flags**.
- **The ledger was hand-repaired once, deliberately.** #11 crashed in `execution` but its record said `planning`, so `timone retry` would have re-run planning and re-asked for an approval already given. `.timone/state.json` was corrected to `execution` before retrying (backup in the session scratchpad). **A fix cannot repair records the bug already wrote** — worth remembering as a class.
- **Nothing was committed to this repo while a daemon session ran.** That was the only way to obtain a clean daemon session for step 4, and it is itself the clearest measure of what the attribution fix is worth.
- **Step 4's daemon-side violation was accepted as *incidental*** rather than forced — the pre-crash run tripped containment on its own and produced both halves the step asks for. 14h may judge otherwise; the caveats are in the report.
- **`/timone-improve` is not the route for Timone's own defects.** The skill is managed-projects-only and stops when asked to improve Timone. A CTA in this session recommended it in error. **Timone's feedback stays hand-run, as its planning does** — 14h is the vehicle.

## Exact next action

**Run 14h by hand**, against [the gate report](../plans/phases/reports/phase-14-live-gate.md). It writes `doc/plans/phases/reports/phase-14-complete.md` and decides the register flips for R15–R19 in [PRD-02's criteria](../specs/prd/prd-02-inversion-of-control.criteria.md).

The report already carries a **Register guidance** section arguing: **R15 no** (the attribution defect posts a false accusation on a client ticket through the loud channel), **R17 no** (both tick defects), **R18 wait** (the sleep hazard is unresolved), **R16** proven at two rows of its table only, **R19** untested pending step 5. 14h should test that reasoning rather than adopt it.

Deciding whether to **fix the four defects inside phase 14 or defer them to phase 15** is the other half of 14h's job, and it is a scope decision for fvermaut.

## Open questions

- **Does the tick's clock diverge because the machine sleeps?** Three healthy sessions diverged (1h05m vs 5m05s; 23m46s vs 15m08s; 24m48s vs 10m11s) with very regular ~15-minute gaps. Sleep is the plain reading, unconfirmed. **It lands on R18, not R17:** `heartbeatAt` stamps only when the tick fires, so a sleeping laptop makes a healthy run look stale against a 2-minute threshold. Nothing was reclaimed on three occasions, but that looks like a race with the poll loop on wake rather than design. **Resolved by:** investigating whether the SDK's `duration_ms` excludes suspended time, and whether a monotonic clock or wake-aware staleness is the answer.
- **Can sub-agent output tokens be obtained honestly?** The obvious fallback is the exact source 14b rejected for under-reporting ~30×. Unresolved; an investigation, not a one-liner.
- **Should the two false-positive flags on #11 be cleared** when the attribution and retry defects are fixed? 14h's call.
- Carried unchanged from the prior handover: the real bot identity (needs a credential); only one conversation medium behind the R14 seam; the deferred PRD-01 list (R23 onboarding repair, R24 standards drift); `scratch-app`'s screen-reader HUMAN-CHECK and the guessed 2 ms latency budget; the **two-daemon ledger hazard** (two writers of the same field still race); **reclaim-without-recovery** conservatism; Docker previews as phase 15.
- **Closed by this session, and no longer open:** the `SessionStart` hook does fire (`additionalContext` arrives); per-turn `Stop` firing is suppressed to one report per finding; the crash log's 6½-minute tick gap is explained by the clock defect above; reclaim works on a real crash.
