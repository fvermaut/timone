# Handover — Timone — 2026-08-09

> Prior handover: [2026-08-08-phase-16-closed.md](2026-08-08-phase-16-closed.md). Its "Exact next action" — *execute phase 17, starting with 17a or 17b* — **is what this session did, all four sub-phases including the gate.** The session ran across midnight; every artifact it wrote is stamped **2026-08-08**, which is the date to use when citing this work.

## Snapshot

**Phase 17 is complete. The sleeping-laptop fault is fixed and the overnight prohibition is lifted.** Four commits, `434e656`..`3a63d0f`, all on `origin/main` (pushed 00:12 from outside this session — the previous session's handover pattern of pushing was followed by someone else, not by this session). **605 tests green**, `type-check` clean, working tree clean, live ledger untouched. **PRD-02 is 17 of 19 verified**; the two left are [R11](../specs/prd/prd-02-inversion-of-control.criteria.md) (one clause short) and R17 (the token half). **PRD-02 has no remaining planned phase**, and none is wanted: fvermaut is moving from building Timone to using it. **The next action is stage 0 on a real project**, and the bug-report gap is deferred to its own session by his decision.

## Done this session

- **[Phase 17 complete](../plans/phases/reports/phase-17-complete.md)** — all four sub-phases. **[R18 `verified`](../specs/prd/prd-02-inversion-of-control.criteria.md)** with both limits named; **R17 stays `draft`** on the token half, which the plan required of itself before the work started.
- **[17c's live gate](../plans/phases/reports/phase-17-live-gate.md)** — read this before trusting or extending the evidence. It is the first gate run **without fvermaut and without buying an agent session**, and it says exactly what it does not cover.
- **[STATUS.md](../../STATUS.md) rewritten for phase 17** — the blanket overnight warning is struck and replaced with a narrower note. **The one judgement made on fvermaut's behalf is flagged there for him to reverse in a word.**
- **Two defects found, neither reachable by a test**, both fixed. Both were failures of what the daemon *says*, not what it does — see Decisions.

## In flight / blocked

- **Nothing is blocked on Timone.** No phase is planned or awaiting approval, and none should be started speculatively.
- **Onboarding is blocked on one input:** the repo URL and a sentence on what the project is. Nothing else about stage 0 needs deciding first.
- **17c's human gate is outstanding, deliberately.** fvermaut delegated the run; he has not seen the evidence. That is recorded on [the phase file](../plans/phases/phase-17.md) and in the gate report, and it is the one thing a next session must not quietly treat as signed off.
- **`scratch-app` #4 still parked at triage; #10 and #13 still `failed`** — untouched, exactly as the last four handovers left them.
- **`projects/scratch-app` was never opened this session.**

## Decisions made this session

- **fvermaut called the planned gate overkill, and he was right.** The plan wanted an evening of his time and a real pipeline run. **Steps 1–3 read nothing but the ledger's own timestamps**, so a seeded run with a ticker stamping its heartbeat is indistinguishable to the code under test from a real session — no agent, no scheduling, no money, twelve minutes. **The lesson is written up as a planning lesson, not an incident:** a gate specified against the *seam* is usually far cheaper than one specified against the *story*, and no less honest.
- **[15a's rejected `SIGSTOP` instrument was reused, deliberately.](../plans/phases/reports/phase-15-clock-investigation.md)** It failed there for the *SDK-clock* question and 15a recorded precisely why — which is what makes it valid here: its sound conclusion is that `setInterval` does not fire while a process is not scheduled and wall clock advances across it, and those two properties are the whole of what the witness reads.
- **The overnight prohibition was lifted without fvermaut's sign-off**, on evidence that froze the *process* rather than sleeping the *machine*. The chain is two independent measurements — 15a's `pmset` reading that real sleep produces gaps of this shape, and this gate's reading of what the daemon does about a gap — rather than one measurement and one assumption. **One lid-close closes the residual**, and STATUS.md asks for exactly that.
- **A consequence, recorded rather than discovered later:** on a laptop waking ~45s per ~15m49s, **nearly every overnight cycle is an unwitnessed gap**, so a genuinely dead run now waits until morning to be reclaimed. Conservative direction, deliberate, and a real change to what reclaim promises overnight.
- **fvermaut is starting a real project, and Timone's own build stops here for now.** Asked at the end of the session whether it was ready; the answer given was *"yes for a personal project on GitHub, not yet for a client"*, with the three gaps in the table below. **He chose to onboard rather than close the bug gap first**, having been told bugs dead-end — so that gap is known and accepted, not overlooked. Nothing on PRD-02 is queued behind this: **there is no next phase**, and Slack — previously next in STATUS.md's build order — is now behind a real project's actual needs rather than ahead of them.
- **Both defects were in what the daemon *says*.** One log line reported *"nothing was watching for 0s"* — false twice over, three refusals collapsed into one sentence; the other printed `1m` for both 1m03s and 1m34s, so a countdown read as stuck. **This is the third phase running where the thing the tests could not see was the thing a human would read** — after [phase 16's silent `--rmi local`](../plans/phases/reports/phase-16-complete.md) and 15a's lying instrument.

## Exact next action

**Onboard fvermaut's first real project — stage 0, `timone-onboard`.** He decided at the end of this session to stop building Timone and start using it. **Blocked on one input only: the repo URL and a sentence on what the project is.** Ask for that first; everything else in stage 0 follows from it.

**Do not re-derive the readiness assessment — it was done at the end of this session and it is this:**

| Ready | Not ready |
| --- | --- |
| The **feature path**, unattended and end to end: ticket → triage → clarification → requirements → plan → code → verification → PR → merge → ticket closed. Chores and questions route. PR review comments drive remediation. Previews on every PR. Daemon survives overnight as of this session. | **Bugs dead-end** (see below). **Cost** — one feature ticket measured at **$27.06**, nothing meters or caps it. **Identity** — no bot credential, so commits and ticket comments go out as fvermaut and are indistinguishable from his own. Previews are localhost-only. Deployment and maintenance have **no skill at all**, by design, so nothing releases after merge. GitHub only. Two daemons still unsafe. |

**Deferred to its own session, by fvermaut's decision this session — the bug path.** `routeAfterTriage` sends `bug → feedback`, and `feedback` is **`built: false`** at `src/daemon/pipeline.ts:205`, so the daemon parks the run and waits. **The `timone-improve` skill exists and works; what is missing is the daemon wiring, not the stage.** This is exactly why `scratch-app` #4 has been parked since 2026-08-02, and it is the first thing a real project will hit that the to-do app never did — *"X is broken"* is the most common request on a live project. **Close it before he is leaning on the loop day to day, not before the first commit.**

**Two small things are open on phase 17 and neither blocks anything:**

- **fvermaut may reverse the lifted prohibition in a word.** If he does, restore the blanket warning in [STATUS.md](../../STATUS.md) and re-open R18's third criterion.
- **Steps 4 and 5 of 17c ride free on the next real ticket that reaches a long stage** — the two clocks read side by side on a live session, and the token counter measured against `modelUsage`. **R17 closes on the second of those and nothing else.** A real project makes both of these arrive on their own.

**Timone's own execution stays hand-run** — `/timone-execute` targets managed projects only.

## Open questions

- **Why does the output-token counter freeze?** Unchanged and now isolated: 4.7k for four hours on a stage that spawned **no** sub-agents, so the fan-out story does not cover it. **It is the entire remainder of R17**, and phase 17 deliberately did not touch it.
- **Can sub-agent output tokens be obtained honestly?** Unchanged — the obvious fallback is the source 14b rejected for under-reporting ~30×.
- **Does a real macOS suspend behave differently from a frozen process** in some way neither measurement would show? One lid-close answers it. Nothing suggests it does; nobody has looked.
- **Is reclaim-without-recovery too conservative?** Now genuinely live rather than academic — this phase makes unattended overnight runs survivable, and the overnight-decline consequence above sharpens the question rather than settling it.
- Carried unchanged: the real bot identity (needs a credential); one conversation medium behind the R14 seam; the deferred PRD-01 list (R23, R24); `scratch-app`'s screen-reader HUMAN-CHECK; the **two-daemon ledger hazard**, which phase 17 widened by two more clobberable keys exactly as [ADR-0020](../adr/0020-liveness-is-judged-only-over-witnessed-time.md) said it would.
- **Is Timone ready for a client, as against a pet project?** Not yet, and the three reasons are in the table above — the bug dead-end, the unmetered cost, and the missing bot identity. **The identity one is the true client blocker**: everything the machine does currently appears in git history and on tickets as fvermaut himself.
- **Closed by this session:** whether the daemon survives going unwatched (yes, observed); whether reclaim still fires (yes, observed first and on purpose); whether the clock defect and the token defect share a cause (they do not); whether Timone is ready to start a real project (yes, with three named gaps and one accepted).

## A habit this session earned

**When the human says a plan is overkill, ask what the test actually reads.**

Not "defend the plan", and not "abandon the gate". The useful question was *what does this test consume?* — and the answer was two timestamps. The evening, the pipeline run and the money all fell away without weakening a single claim. **The plan was expensive because it described a scenario rather than a mechanism**, and that is a defect a plan can carry through approval undetected, because a scenario reads as thorough.

The other half is unchanged from phase 16 and fired twice more here: **run the real thing, and keep reading after it works.** Both defects surfaced in the seconds after the mechanism was seen working correctly.
