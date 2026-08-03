# Phase 11 — Completion Report

- **Date closed:** 2026-08-03
- **Phase:** [phase-11.md](../phase-11.md) — approved for execution by fvermaut 2026-08-02; amended once during execution, stamp retained (below)
- **Theme:** the daemon — pickup, routing, serialization. The first executable slice of [PRD-02](../../../specs/prd/prd-02-inversion-of-control.md)
- **Requirements:** R1, R2, R9, R10, R15 → `verified`; R13 → **still `draft`**, first clause verified, second unproven

## What the phase delivered

| Sub-phase | Commit | Outcome |
| --- | --- | --- |
| **11a** — ticketing seam | `38587cd` | `TicketingAdapter` (four capabilities, no GitHub type leaks) + a `gh` implementation driven entirely through an injected command runner; malformed responses fail loudly with the raw payload |
| **11b** — run state and queue | `42557aa` | Run lifecycle and the per-project queue in `.timone/state.json`, written atomically; one active run per project is an invariant the store enforces, not a convention callers follow |
| **11c** — poll loop | `9779d98` | One cycle: list marked tickets, register the unseen, acknowledge exactly once, hand the occupying run to an injected spawner; `timone daemon [--interval] [--once]` |
| **11d** — session spawn | `8d0f1e0` | The Agent SDK enters; sessions run from the timone root with the target validated against `timone.yaml`, instructed to classify and never told the classification |
| **11e** — guardrail hooks | `25b708f` | Three deterministic checks as pure functions over injected git evidence, bracketing every session; one loud comment per violation, silence when clean |
| **11f** — `timone status` | `1709672` | Every project on one line: ticket, stage, who is waited on, queue depth, hook flags; an absent state file yields guidance, not a stack trace |
| **11g** — live proof | — | Five steps against `scratch-app`, all observed; human gate passed by fvermaut 2026-08-03 |
| **11h** — documentation and close | this commit | `README.md`, `STATUS.md`, register flips, this report |

Plus `bc5d40f`, a pre-existing defect found while validating 11b: the root `npm test` swept the managed-project checkouts under `projects/` and reported four failures belonging to `scratch-app`.

## The amendment, and why the stamp was retained

**The defect:** Timone posts through the human's `gh` credentials, so **every comment it wrote appeared authored by the human**. fvermaut raised it at the 11g gate, in his words: *"every message on github issues appears as me as the author. This is confusing af."*

Confusing is the smaller half. The larger half is that a session reading the thread back could not tell its own words from the human's either — and [ADR-0012](../../../adr/0012-conversation-channels.md) makes ticket replies the decision write-path, so phase 12 would have been able to **read Timone's own comment as the human's approval**.

The fix (`504adab`) holds in three places, because two of them are not code:

1. **The adapter stamps everything the daemon posts** — acknowledgements, queue notices, parking messages, guardrail warnings. Not something each call site must remember.
2. **The spawned session is instructed to stamp what it posts itself.** This is the half that could have silently failed: the session writes its triage comment with `gh` directly, and no Timone code touches it. It obeyed — verified live on [#6](https://github.com/fvermaut/scratch-app/issues/6).
3. **`getTicket` returns `fromTimone` per comment**, derived from the marker and never from the author, and the session prompt separates the two voices explicitly. This is the clause phase 12 depends on.

Under stage 5's re-approval rule this is a defect execution found, so the stamp stands; the change carries a dated `✏ Refined` marker in the phase file. The four comments posted before the fix were edited to carry the marker, so the pilot's record is consistent (GitHub retains the originals in edit history).

**Deferred, deliberately, and named rather than left implicit:**

- **A real bot identity** (GitHub App, `timone[bot]`) is the proper fix; the marker makes the confusion legible rather than removing it. It needs credentials from the human, so it is its own slice.
- **Making the marker a process-wide convention** in `process.md` and the stage skills — so an interactive `/timone-triage` marks its comments too — is a meta-level process change, which gets a grill first.

## The live proof

| Step | Expected | Observed |
| --- | --- | --- |
| R1 discrimination | pick up the marked, ignore the unmarked | [#4](https://github.com/fvermaut/scratch-app/issues/4) → run + one ack; [#5](https://github.com/fvermaut/scratch-app/issues/5) → 0 comments, 0 labels |
| R13/R2 routing | classify without being told | `triage:bug` + a reasoned comment naming no stage or skill; run parked; session `f8982c83` |
| R10 serialization | second marked ticket waits | [#6](https://github.com/fvermaut/scratch-app/issues/6) queued behind `#4`, ack says so, `timone status` shows both |
| Idempotency | a repeated cycle is silent | third cycle: no new comments, no new runs |
| R15 violation | loud on violation, silent when clean | unpushed commit → one ⚠ comment + flagged status; clean re-run → nothing |
| R9 | status matches every state | matched at each step |
| R2 regression | no harness files in the client repo | `git log --stat` over all of `scratch-app`'s history: 0 matches for `.claude/` or `timone.yaml` |

The triage session is the phase's most useful artifact. Given "the page feels slow when I add many items", it classified a **bug**, argued *why the call was close* (no latency requirement exists, but "the change shows immediately" does, and that is the promise being missed), identified the double-refetch as the likely cause while explicitly marking that as a lead rather than a diagnosis, recognised the issue as one already agreed for fixing on 2026-08-02, and recommended merging the two rather than doing the work twice — in language containing no stage number and no skill name.

## What the evidence does not cover

Recorded here and in the register rather than left to inference:

- **R13's second clause has no evidence.** "An interactive timone-root session routes a raw request through triage first" is in force in `CLAUDE.md` and `process.md`, and has never been observed. Being written down is not evidence. The requirement stays `draft`; the next raw request stated in a terminal session settles it at no cost.
- **Containment was proven vacuously.** The live session wrote no files at all — triage records itself as an issue comment — so "every file lies under `projects/X/…`" held because nothing was written. The guardrail agreed, on the same empty evidence.
- **Only one of three guardrail rules fired live.** `STATUS.md` placement and path containment were shown capable of failing only by neutering each check and watching its fixtures go red (9 tests fell over). Phase 13's execution path is what supplies real evidence for both.
- **Queue promotion was never seen live.** `#4` parks awaiting phase 12 and has never reached a terminal state, so the head of the queue was never promoted outside the unit tests.

## A consequence worth stating plainly

**Parked runs hold their project.** A run waiting on a human is not terminal, so it keeps occupying the project — which is what R10 asks for, but it means "waiting on a human" and "busy" are the same state. With phase 12 unbuilt, every triaged ticket parks forever, and `scratch-app` now accepts no further work: `#6` sits queued behind `#4` indefinitely. Whether a human wait should block the project is a real design question, deliberately left to phase 12's planning rather than settled here.

## Housekeeping

- `scratch-app-2` and `scratch-existing` declare local fixture paths as `repo_url`, so the adapter refuses them and the cycle records two errors per poll before carrying on — which is the resilience assertion passing, and also noise. Either drop them from the manifest or teach the daemon to skip non-GitHub projects quietly.
- Issue `#7` on the pilot was a scripted guardrail fixture; closed with its outcome recorded.
