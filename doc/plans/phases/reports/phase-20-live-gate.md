# Phase 20 — 20h, the live gate

- **Date:** 2026-08-14
- **Target:** `scratch-app`, the fixture. **`ivtrends` was not the gate** — fvermaut's standing rule, and the same siting [ADR-0023](../../../adr/0023-one-answer-one-session.md) adopted after rejecting *"it is free over there"*. `ivtrends` was nonetheless **touched incidentally**, and honestly so: fvermaut enabled `introduce_unmarked` on it as well (commit `7693de8`), and its one unmarked open ticket — #1, the wayfinder map — received exactly one introduction telling it how to hand itself over.
- **Run by:** an execution session driving a real daemon on a real ledger, **with fvermaut at the keyboard for the decisive step** — the go-ahead on the fixture map and the `approve` on the PRD gate are his, typed by him on the ticket.
- **Outcome:** **six of R21's eight clauses observed and confirmed; two were not obtained.** Clause 3 is **unobservable on this machine** (see below), and clause 6's *"the right session opens"* half was not seen. **The idle write-volume check is partial: zero writes over 4m19s where the plan asks for ten minutes.** R21 therefore stays `draft` and is **not** marked verified here.
- **Cost:** roughly **$6** of sessions across the gate, of which the stage-3 run on the map's own branch is `17m30s · 27 turns · $2.55`.

## The setting, and why it changes what clause 3 can mean

fvermaut enabled `introduce_unmarked` on **both** managed projects (`7693de8`), which was his call and was made before the gate ran. **No project on this machine is therefore in the default state**, and the default state is precisely what clause 3 asserts. This is recorded up front because it is not a detail of one clause — it is the reason a clause cannot be claimed, and a gate that discovered it in a footnote would be a gate that nearly claimed it.

## R21's eight clauses, as actually observed

| # | Clause | Result |
|---|---|---|
| 1 | Every open ticket carries a line saying what happens next | **PASS** — all five open tickets, quoted below |
| 2 | Unmarked ticket → exactly one comment, **no run** | **PASS** — #30, asserted from the ledger |
| 3 | A backlog project is silent, because the switch defaults off | **NOT OBSERVED** — no project on this machine is in the default state |
| 4 | A map with open questions asks nothing and starts nothing | **PASS** — #29 parked at `charting` |
| 5 | Frontier empties → CTA flips → a go-ahead starts stage 3 on the map's own run | **PASS**, and this is the fault the phase existed for |
| 6 | Takeover on a ticket with no run creates it; the refusal never appears | **PASS on its essential point; half unobserved** |
| 7 | A changed CTA is posted once; an unchanged cycle is silent | **PASS** — zero CTA writes across the idle window |
| 8 | `timone status` and every ticket agree | **PASS**, word for word |

### Clause 1 — every open ticket carries a line

All **five** open tickets carried one, and each says something different because each is in a different state:

| Ticket | The line it carries |
|---|---|
| `scratch-app` #4 | *"the next stage to be built"* |
| `scratch-app` #5 | *"add the `timone` label if you would like me to pick this up"* |
| `scratch-app` #13 | *"run the command and I'll pick it up from where it stopped"* |
| `scratch-app` #29 | *"your answer on the ticket"* |
| `scratch-app` #30 | *"add the `timone` label if you would like me to pick this up"* |

**#4 and #13 are the two [ADR-0024](../../../adr/0024-every-open-ticket-answers-for-itself.md) opened with.** #4 is parked at a stage nobody has built and says so plainly rather than pretending something can move it; #13's ticket now names the exact command `timone status` had been the only place to find it. That second one is the ADR's own table, row four, closed.

### Clause 2 — one comment, no run

Issue **#30** was filed unmarked — *"the delete button is a bit close to the tick box"* — and received **exactly one** comment. **No run was created**, asserted from the ledger rather than inferred from the absence of a session: `.timone/state.json` holds nothing whose id is `scratch-app#30` at that point. That is [R1](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r1--ticket-pickup)'s surviving clause, re-observed live on the behaviour that invalidated its old evidence.

### Clause 3 — not observed, and why

The clause asserts that a project onboarded with a backlog receives **no** introduction on any of its unmarked issues, because the per-project switch defaults off. **The switch is on for both projects on this machine**, by fvermaut's own change, so the default state does not exist here to observe. **The clause cannot be claimed on today's evidence and is not.**

What *was* observed is the enabled path on a second project: `ivtrends` had exactly one unmarked open ticket — **#1, the wayfinder map** — and it received **exactly one** introduction, telling it how to hand itself over. That is clause 2 on a second repository, not clause 3.

**The unit evidence for clause 3 is not nothing, and is not a substitute.** [20e](phase-20-handoffs.md#20e--the-backlog-switch)'s first test asserts that a project with no switch receives no introduction **and never even makes the open-ticket listing** — counted on a wrapper around the adapter, and genuinely red before the gate existed. What is missing is the live half, and it costs one manifest edit and one cycle whenever somebody wants it.

### Clause 4 — a map with open questions asks nothing, starts nothing

The fixture map **#29**, with decision tickets #27 and #28 open, parked at `charting`, waiting on *"this map's own questions to be answered"*. Its standing call to action read:

> **What I need from you:** nothing right now — I'll come back here when the last one is closed.

**Nothing started on it.** That is the half [20f](phase-20-handoffs.md#20f--the-map-becomes-first-class) predicted would be the interesting one, and it held: a map is a ticket people write on, and a map that resumed on any comment would spend a project on an idle remark.

### Clause 5 — the frontier empties, and the thing that failed on 13 August works

**This is the fault the phase existed for, and it is the clause worth reading in full.**

#27 and #28 were closed and `wayfinder:frontier-empty` applied. The next cycle logged:

```
asking scratch-app#29 — the way to the destination is clear
```

and the map's standing call to action **flipped unprompted**, edited in place rather than added beside, to:

> say go ahead here and I'll write the specification this map has been finding its way to.

A written go-ahead then produced, with nothing typed at a terminal:

```
branch  scratch-app#29 → timone/29-…
session 5181c682 started for scratch-app#29 (requirements)
17m30s · 27 turns · $2.55
```

— a PRD (PRD-04) written **on the map's own branch**, off the map's own run, which then parked at its gate. **fvermaut replied `approve` on the ticket himself at 13:51:32Z** — a genuine non-machine comment, not one typed by a machine in his voice — and the daemon read it and recorded the approval.

**The comparison that makes this clause mean something:** on 2026-08-13 fvermaut made the identical gesture on `ivtrends` #1 — *"ok go ahead and write the spec"* — and **nothing happened, and nothing was going to.** The same gesture, on the same kind of ticket, now produces a specification.

### Clause 6 — takeover on a ticket with no run: the essential point passes, half is unobserved

`takeover scratch-app#30` — open, unmarked, **no run in the ledger** — **created the run**, and the retired refusal (*"I'm not working on … Add the `timone` label…"*) **never appeared**. That is the clause's essential point and R20's second criterion, and it passes.

**The session did not open**, because #29 held the project. The command queued the ticket and said so:

> scratch-app #30 is in the queue — I take one thing at a time on a project.

**The clause's "the right session opens" half is therefore unobserved.** It is said here rather than folded into the pass, because a takeover that creates a run and opens the wrong session would satisfy everything above.

The two surviving refusals both fired, each with its own sentence:

```
$ node dist/cli.js takeover scratch-app#9999
There's no ticket #9999 on scratch-app. Check the number — I can only pick up something that exists.

$ node dist/cli.js takeover scratch-app#25
scratch-app #25 is finished — see the ticket.
```

Neither says *"I'm not working on"* and neither names the label, which is the property [20g](phase-20-handoffs.md#20g--takeover-resolves-from-the-tracker) pinned as a prohibition rather than left to reading.

### Clause 7 — a changed CTA is posted once, an unchanged cycle is silent

Cycle 2 **rewrote nothing** on #4 or #13 — the two tickets whose state had not moved. The idle observation logged **zero** CTA writes and **zero** introductions across its whole window.

This is the clause [20c](phase-20-handoffs.md#20c--the-cta-is-reconciled-each-cycle) called the one no unit test can close: the guard compares what the tracker hands back against what the loop would post, and any transformation GitHub applies to a body would turn the guard off silently and produce a comment edit per ticket per minute. **The decisive observation is the second cycle over a settled ticket, and it was silent.**

### Clause 8 — `timone status` and every ticket agree, word for word

| Ticket | `timone status` | The ticket |
|---|---|---|
| #4 | *"waiting on you: the next stage to be built"* | *"the next stage to be built"* |
| #13 | `timone retry scratch-app#13` | *"run the command and I'll pick it up from where it stopped"* |
| #29 | *"your answer on the ticket"* | *"your answer on the ticket"* |

**This is the contradiction clause 8 exists to kill.** Before this phase, `timone status` was asking for an answer on `ivtrends` #11 while #11's body said nothing was needed — recorded under [R20](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r20--wayfinder-decision-tickets-participate-in-the-loop)'s 2026-08-11 marker and in [ADR-0024](../../../adr/0024-every-open-ticket-answers-for-itself.md)'s context. The two surfaces now render one computed value ([20a](phase-20-handoffs.md#20a--one-computation-two-renderers)), so they cannot disagree; the live pass is the confirmation that the construction survived contact with a real tracker.

## The idle write-volume check — PARTIAL

The plan asks for **ten idle minutes with zero writes**. What was obtained:

```
13:47:13Z   daemon started
            0 CTA writes, 0 introductions
13:51:32Z   fvermaut's `approve` on #29 — the idle window ends here, at 4m19s
```

**Zero writes over 4m19s is what was observed. Ten minutes is owed.** A full ten-minute observation was attempted afterwards and **could not be completed**: GitHub became unreachable (`error connecting to api.github.com`), so the window that followed measures an outage rather than an idle daemon.

The number is not nothing — 4m19s at a one-minute poll interval is four cycles over five open tickets with the reconciler running on each — but it is not the number the plan asked for, and it is not written down as though it were.

## Findings

Eleven — the last four added after the gate closed, as its residue was cleared and then as that clearing was itself audited. None of them is fixed here.

1. **A public false accusation, and it is [phase 15](../phase-15.md)'s fix meeting its known limit.** The path-containment guardrail posted on `scratch-app` #29: *"the session changed 1 file(s) outside `projects/scratch-app/` — timone.yaml (uncommitted change)"*. **The session had not. The orchestrator had** — running `projects update --introduce-unmarked` minutes earlier and leaving the change uncommitted in the working tree. Phase 15 stopped exactly this for **commits**, by reading the provenance trailer ([ADR-0019](../../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)); an **uncommitted working-tree change carries no trailer**, so the check still cannot tell whose it is. This is [phase 14](phase-14-live-gate.md)'s 14g fault reappearing through the one gap its fix does not cover, and **it published on a ticket**, under fvermaut's GitHub account, accusing an innocent session in public. Ranked first because it is the only finding here that writes something false where somebody else can read it.
2. **A ticket declaring itself a throwaway fixture is still recorded as real — second occurrence in two days.** The stage-3 session wrote the fixture's specification into `scratch-app`'s `STATUS.md` on `main` (`b2c9b07`), so the to-do app's own record announced a specification waiting on a decision nobody had asked for. Reverted at `af01893`; the branch and the PRD-04 draft were deleted. **[Phase 19's gate found the identical thing](phase-19-live-gate.md#findings) and it was reverted at `2d80e64`.** The banner in a ticket's body does not bind the record. **One occurrence is an accident; two is a mechanism**, and the mechanism is that nothing in a session's instructions treats "this is a fixture" as a constraint on what it may commit.
3. **The map becomes a build ticket, and nobody decided that.** Once the PRD gate was approved, #29's run walked straight on into `planning` and took a branch — **left alone it would have built the fixture feature end to end.** That follows correctly from giving the map a `next` of `requirements`, which is what ADR-0024 asked for and what 20f built. But **whether a discovery map should *become* the thing that gets built, or hand off to a fresh ticket, was never put to fvermaut** — [20f's handoff predicted this would be the first thing to surprise him](phase-20-handoffs.md#20f--the-map-becomes-first-class) and it is here as predicted. The orchestrator stopped the daemon at the planning boundary rather than spend a build on a fixture.
4. **[R17](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r17--the-daemon-shows-progress-while-a-session-runs)'s frozen output-token counter, caught in the act.** The live count sat at `14.2k out` across **four consecutive 30-second heartbeats** while the process was alive at ~2% CPU, and the closing line then read `24.3k out`. **So it lags rather than dies, and the closing cost line stays trustworthy** — which is a sharper description of the fault than the register has held since [15a](phase-15-clock-investigation.md) decoupled it from the clock. First sighting since. Still R17's unexplained remainder; still not this phase's to fix.
5. **A real GitHub outage tested error handling nobody planned to test.** Several cycles hit `TLS handshake timeout`, and later `error connecting to api.github.com`. The daemon **named the exact failing command per ticket, carried on to the others, and left the ledger consistent** — one ticket's failure stayed one ticket's. That is [20c](phase-20-handoffs.md#20c--the-cta-is-reconciled-each-cycle)'s and [20d](phase-20-handoffs.md#20d--see-the-unmarked-and-introduce-yourself-once)'s per-ticket error containment working under a real fault rather than a mocked one, which is the only way that property has ever been observed outside a test.
6. **A killed session is reported as working until something witnesses it.** After the daemon was stopped, `timone status` read `#29 (planning) — working on it now on claude-opus-5 for 7m53s` for a session that was **dead**. That is [ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) being honest — nothing had watched the silence, so nothing may judge it — but **with no daemon running, nothing ever witnesses, and the line stays wrong indefinitely.** The ADR's trade is correct in flight and has this hole at rest.
7. **Ledger residue on closed tickets — [phase 18](phase-18-live-gate.md)'s finding 6 reproduced.** The network outage prevented the daemon from witnessing the endings and clearing them, so the exact residue was:
   - `scratch-app#29` — **`active` at `planning`**, while the ticket is closed.
   - `scratch-app#30` — **`queued`**, while the ticket is closed.

   **✏ Cleared 2026-08-14, and clearing it produced findings 8 and 9.** A daemon was run once the network returned. It witnessed correctly and reclaimed: `reclaim scratch-app#29 — the machine running it stopped before the work was finished`, taking the run to `failed` — [ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)'s rule working exactly as built, after three cycles of *"watching for 1m35s of the 2m00s it would have to vouch for"*.

8. **A queued run promotes onto a closed ticket and starts a session on it.** The moment the reclaim freed the project, `#30` promoted and `session 5da3d8f2 started for scratch-app#30 (triage, claude-sonnet-5)` — **on a ticket that had been closed for hours.** Killed before it posted, so nothing was published, but it had already been spawned and paid for. **Promotion checks the ledger's queue and never re-checks whether the ticket is still open**, so any ticket closed while queued is worked on regardless. On a real project this is a session spent classifying something the human has already dealt with, and its output would land on a closed thread.

9. **There is no way to end a run, and clearing residue therefore requires hand-editing the ledger.** `retry` re-arms, `takeover` enrols, nothing cancels. Both entries had to be removed from `.timone/state.json` by hand (backed up first) — which is precisely what [phase 13](phase-13.md)'s sign-off recorded as fixed: *"Three times a run stopped and `timone retry` restarted it exactly where it stood — the hand-editing of internal files that plagued the last sign-off is gone."* It is not gone; it is only unnecessary for runs that **should** continue. A run that should never have existed, or whose ticket has been closed underneath it, has no exit. Until findings 8 and 9 are closed together, every fixture run on a gate leaves this behind.

10. **A map's frontier is asserted by a label, not derived from its questions — and the one real map in the workspace is wrong because of it.** `isFrontierEmpty` is `labels.includes(FRONTIER_EMPTY_LABEL)` (`src/daemon/pipeline.ts:58`). The label is written by the wayfinding session that closes the last question, so a map whose questions were closed **by hand, or before [20f](../phase-20.md) existed**, carries no label and reports itself as still working.

    **Found on `ivtrends` #1 on 2026-08-14**, answering fvermaut's question of whether he could pick that map up and ask for the next step. Its state: `OPEN`, labelled `wayfinder:map`, **not** labelled `timone`, **not** labelled `wayfinder:frontier-empty` — and it is the **only open issue on the project**, so every decision ticket beneath it is closed and its frontier is genuinely empty. Marked as it stands, its call to action would read *"I'm working through this map's questions"* on a map with none left.

    **This is the stale-line class [R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) exists to abolish**, reappearing one layer up: clause 7 keeps a CTA current against *the run's own state*, and nothing keeps that state honest against the tracker. It is the only finding of this gate sitting on a live project rather than the fixture, and it is the map that started phase 20.

    **The manual route out**, for as long as the label is the mechanism: add `timone` and `wayfinder:frontier-empty` together. **The fix**, when someone takes it: derive emptiness from the map's open children rather than trusting a label a session may never have written — the same shape of correction [20a](../phase-20.md) made when it removed the second place deciding what a ticket needs.

11. **A managed project's work branch was created a second time inside the Timone repository, and every close-out artifact of phases 19 and 20 was then committed onto it.** `timone/29-fixture-map-notes-on-a-to-do-phase-20-ga` exists twice: **correctly in `projects/scratch-app`**, cut at 15:34 by the requirements run and deleted with the rest of the fixture at 16:02 — and **wrongly in `/Users/fvermaut/dev/timone`**, created between 15:52 and 15:54 by a session sitting at the Timone root. The two reflogs are the evidence, and they interleave:

    ```
    15:34  scratch-app   checkout: moving from main to timone/29-…      ← correct, the run's own branch
    15:42  scratch-app   commit: PRD-04 draft
    15:43  scratch-app   checkout: → main, commit: STATUS.md            ← finding 2's pollution
    15:52  timone        checkout: moving from main to timone/29-…      ← the wrong repository
    15:53  timone        checkout: moving from timone/29-… to main
    15:54  timone        checkout: moving from main to timone/29-…      ← and left there
    15:54  scratch-app   commit: fvermaut approves PRD-04
    16:02  scratch-app   checkout: → main, commit: revert the fixture
    ```

    **The only session running in that window is the approval-record session**, whose scratch-app commit lands at 15:54. Its instruction is [`approvalRecordPrompt`](../../../../src/daemon/prompts.ts): *"Work on the branch `<name>`"* — **it names a branch and never names a repository**, and it runs with `cwd: root` (`src/daemon/session.ts:1054`) because [ADR-0007](../../../adr/0007-sessions-at-timone-root.md) puts every session at the Timone root. Unlike [`requirementsPrompt`](../../../../src/daemon/prompts.ts), it does not even say *cut from the project's default branch* — it assumes the branch is already there, which at the Timone root it is not. **`workBranch` is computed from the ticket alone** (`src/daemon/prompts.ts:621`), so the name carries no repository either, and nothing downstream can tell where it was meant to live. Whether the branch here was made deliberately or as a recovery from a failed checkout is not recoverable from the record; **that it was made, and left checked out, is.**

    Note what this is **not**: the run's own flag — *"the session changed 1 file(s) outside `projects/scratch-app/`"* — belongs to finding 1's uncommitted `timone.yaml`, not to this. The run cut its branch in the right place. **The boundary was crossed by the machinery that came after it.**

    **What it cost.** The checkout was never returned to `main`. Three hours later the session that closed phases 19 and 20 inherited it and committed **seven artifacts** there — [ADR-0026](../../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md), both phase-20 reports, the register markers, `STATUS.md`, finding 10, and [its own handover](../../../handover/2026-08-14-phases-19-20-closed.md), whose snapshot then asserted *"`main` is at `df453ef`, clean"*. **`main` was at `7693de8`, and `df453ef` was not on it.** With the six commits already unpushed beneath them, **13 commits stood outside `origin/main`** — every slice from 20c to 20g, plus the whole written record of two phases.

    **The guardrail saw all of it and changed nothing.** `.timone/sessions.jsonl` carries six findings naming this branch from session `8708bfbf` — five on `timone`, `status-placement` and `unpushed` alternating with the count climbing 8 → 9 → 10 as the commits landed, and one on `scratch-app`, which is the *correct* branch being reported correctly. They go to a log nobody reads mid-session, so **a check that fires accurately six times and is never surfaced is indistinguishable from one that does not exist**. Compare finding 1, where the same guardrail family published something false where everyone could see it: **opposite in direction, identical in cause** — nothing decides where a finding of this class is meant to land.

    **✏ Resolved 2026-08-14, on fvermaut's instruction.** `main` was a strict ancestor of the branch, so the repair was a fast-forward to `60cb4fc`, a branch delete, and one push of all 13 commits. **Nothing merged and nothing conflicted** — the branch held no fixture work at all, only Timone's own, which is why the damage was recoverable. **The defect is untouched:** the next managed-project run on this machine will cut its branch in the same place.

## What this gate did not prove

- **R21 clause 3 — the backlog default.** Unobservable on this machine while both projects have the switch on. Named in the register's marker as not obtained.
- **R21 clause 6's second half — that the right session *opens*.** The run was created and the refusal is gone; the session queued behind #29.
- **Ten idle minutes.** The observation stands at **4m19s**, ended by fvermaut's own comment, and the retry was defeated by a GitHub outage.
- **R20 clause 1's `prototype` and `task` branches.** The fixture map exercised `grilling` and the new `map` kind only. Unobserved, not passed.
- **Anything on `ivtrends` as a gate.** Its one introduction is incidental evidence for clause 2 on a second repository, not a gate on a live project.
- **The introduction on a repository with other contributors.** Two solo repositories cannot show it, exactly as the plan said.

## Human gate

**Obtained for the six clauses observed, and for nothing else.** fvermaut typed the go-ahead on the fixture map in his own words, watched the specification session run on the map's own run, and **approved the result himself on the ticket** — the gesture that produced nothing at all on 2026-08-13.

**What he is not being asked to accept:** that R21 is verified. Two clauses were not obtained and the idle check is partial; the requirement stays `draft`, and verification is [stage 7](../../../../process.md)'s to run from a context that did not build this.
