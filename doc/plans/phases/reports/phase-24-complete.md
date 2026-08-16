# Phase 24 — Completion Report

- **Date:** 2026-08-16
- **Plan:** [phase-24.md](../phase-24.md) — approved for execution by fvermaut 2026-08-16
- **Issues:** [timone#1](https://github.com/fvermaut/timone/issues/1) and [timone#2](https://github.com/fvermaut/timone/issues/2), the two findings [phase 23's live gate](phase-23-live-gate.md) left open
- **Requirements:** PRD-02.R3 **widened**; R10 and R14 **revised, sign-offs lapsed**; R21 **annotated, status unmoved**
- **Branch:** `main` (as for phases 15–23), at `4ed8c65`, pushed
- **Built:** 24a–24g. **24h, the live gate, is not run** — it is fvermaut's, and it is the only thing between this phase and its evidence.

## Summary

**Both issues are closed in code and neither is closed in evidence.** A stage that hands work back now parks on the human instead of failing, so a written reply resumes the stage that asked; and every command a ticket advertises runs against a live daemon, because a command that cannot have the ledger now asks the daemon to act rather than giving up. The suite went **932 → 965 green across 26 files**, type-check clean throughout, and `.timone/state.json` was never hand-edited or modified — the one live command ran against a copy via `--state`, `md5`-compared before and after.

**The plan's one real decision held, and it was the ordering.** The queue landed first (24a–24d) and the handoff second (24e–24f), against the order the issues were filed in, because [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) makes an unanswered handoff hold its project and `timone cancel` is the escape. Built the other way round there is a window in which the fix is strictly worse than the bug: an invisible dead end becomes a blocked project. Nothing in the build tempted a reorder, but the reason is recorded here because the temptation is real — 24e is the slice that fixes the finding that stings.

**Two things were found by building that planning did not see**, and both are recorded below rather than absorbed: the takeover holds the ledger while writing nothing to it, and a machine comment could wedge a handoff park for ever.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 24a — The request queue | Landed as planned. One file per request, so enqueuing needs no lock — asserted against a lock held by a live pid, not merely against a lock file. 11 tests. | `79ff50b` |
| 24b — The daemon applies requests | Landed as planned, first in the cycle. The daemon calls the commands' own code rather than a second implementation of it: `runRetry`/`runCancel` already take no lock when handed no state path. 8 tests. | `d2c2ba7` |
| 24c — `retry` and `cancel` ask when refused | Landed as planned. Three endings; the lock-free output is now asserted as a literal. Both commands became async, which reached 23 existing call sites. 5 tests changed or added. | `86b1017` |
| 24d — A takeover claims through the run | Landed, and larger than planned — see the deviations. The conversation now holds no lock at all; the claim is given back on three exit paths including a signal. 6 tests. | `66931ad` |
| 24e — A handoff parks | Landed as planned. Three `store.fail` sites became one `handBack`; the cursor is the handoff comment's own instant, asserted against the thread. 5 tests changed. | `2bf680d` |
| 24f — The park resumes on a written answer | Landed, and it did need production code — see the deviations. 5 tests. | `eead4a2` |
| 24g — The register and the narrative | Landed as planned. No file under `src/` touched, asserted rather than intended. | `4ed8c65` |
| 24h — The live gate | **Not run.** Needs a real daemon, the fixture, and fvermaut. | — |

## Deviations from the plan

**1 — 24f wrote production code, and the plan said it might not have to.** Four of its five cases passed with no change at all, exactly as predicted: `resolveWait` already re-enters the stage carrying the human's words. The fifth went red on the hazard the slice existed to prove absent. `concludeLastConversation` reads *any* machine comment carrying `CONVERSATION_RECORD_MARKER` after the cursor; a handoff parks a **work** stage on a conversation wait; and `concludeConversation` throws for a stage that declares no conversation of its own. The run was never at risk of being wrongly marked `done` — the throw happens first — but the cycle errored and **the human's answer could never be read**: an unreachable reply, one layer below the one this phase exists to fix. The guard is the stage's own declared wait, applied in both readers. The plan held the grant open for exactly this and named the file it would be in.

**2 — 24d is bigger than "stop wrapping the session in the lock".** The plan's reading was right about the mechanism and understated the work, because `takeover` **writes nothing to the ledger at all**: it resolves, builds a prompt and launches `claude`, and held the lock purely to be exclusive. So the claim is genuinely new behaviour rather than a relocation of an existing write, and three questions had to be answered that the plan did not ask — what a claim is (`store.claim`, which keeps the wait on the run deliberately), what gives it back (`store.park` with `waitOf` read off the run, so no process has to remember anything), and what happens to enrolment, which *is* a write and therefore cannot happen in a command that was refused the ledger. Enrolling is now the daemon's on that path, which is also why the invariant the old test defended still holds: a takeover that could not get the ledger has still written nothing to it.

**3 — Three slices touched files granted to another slice.** `poll.ts` gained the takeover arms in 24d and the wait guard in 24f, both granted to 24b; `poll.ts` and `daemon.ts` gained `await` in 24c when the commands became async. Each is small and each is in a file this phase owns end to end, but the plan's own grants said otherwise and phase 22's report is about what under-granting costs, so they are named here rather than left for a reader to notice from the diff.

**4 — `requests.ts` gained the client half of its own protocol in 24c** (`waitUntilSettled`), rather than that living in the commands or in a new module. It is the module that defines what a request is; "ask, and watch for it to be dealt with" is the other side of the same contract. The alternative was the same loop written twice, in two commands, or a new file the plan did not grant either.

**5 — `pending` returns `{ requests, unreadable }` rather than the plain array the plan sketched.** The daemon has to report an unreadable file and cannot do that if the reader silently drops it.

**6 — The dead-holder refusal is not asserted in the command tests.** The plan's checklist asks for it separately from the live-holder case. `lock.test.ts` records in a comment that a test cannot portably manufacture a dead pid, and injects liveness to get around it; `runRetry` has no such injection point and adding one is not this slice's. What is asserted instead is the whole of what the commands can distinguish: a refusal **naming a holder** enqueues, and an unreadable lock does not. A dead holder's lock is broken by `acquireStateLock` itself — proven at `lock.test.ts` — after which the command takes the direct path, which is covered.

## What is now true, and what is only argued

**True, and tested:** a handed-back run parks with a `conversation` wait whose cursor is the handoff comment; the standing call to action computes *"This one is waiting on you"* from that state, so the two messages that contradicted each other on `scratch-app` #31 no longer can; `carry on` written after the question resumes **execution** carrying those words, once and only once; the machine's own comments do not answer it; `retry` and `cancel` reach the ledger through the daemon and report what happened; a takeover holds no lock while the human talks to it and gives its claim back on a normal end, a throw and a signal.

**Argued, not observed:** all of it, on a real daemon. **965 green tests are precisely what was true of the machinery that produced these two faults** — phase 23 shipped 932 and its gate found seven defects none of them could see. That is the whole reason 24h exists and the reason this report does not claim the issues are fixed.

## Handoff to the live gate

- **Restart the daemon before observing anything.** A running daemon keeps the code it started with; this has now bitten six times.
- **`npm run build` first.** The gate drives `node dist/cli.js`.
- **`scratch-app` only, never `ivtrends`** — ruled twice, and this gate deliberately stalls a run.
- **Step 7 is the one that needs both fixes at once** — queue a ticket behind a parked handoff, watch it wait, then cancel the handoff and watch it promote. It is the cost and the escape in a single observation.
- **Step 6 must be a real signal**, not a simulated one: the claim-release path a test drives with `process.emit` is the one that matters least, because the process survives it.
