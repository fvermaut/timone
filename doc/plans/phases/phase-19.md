# Phase 19: one answer, one session

> **Status:** Complete — see [reports/phase-19-complete.md](reports/phase-19-complete.md).

> ✏ **Amended 2026-08-14 — the live gate found what the tests could not.** 19e ran on `scratch-app` with fvermaut answering in his own words. **Steps 1, 2 and 4 passed**: one written answer bought exactly one session, one resolution and one close at $1.39 with no `could not resume`; a second `daemon --once` and a `takeover` were both refused naming the holder; a live holder was refused five times running, four of them past the staleness window; and a crashed holder's lock was reclaimed with attribution. **Step 3 failed.** `timone retry` does not give back an answer consumed by a session that died *after* being activated, because `activate` clears the very field the rewind needs — so the human is asked the same question again and their answer is never read. **[19g](#sub-phase-19g-the-consumed-answer-survives-the-session-that-read-it-r3) is added to close it, and 19e's step 3 is re-run against it.** Nothing else in this plan moves.

> ✏ **Refined 2026-08-13 — the reclaim gate's evidence changes, on [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md).** Executing 19a found that [ADR-0023](../../adr/0023-one-answer-one-session.md)'s reclaim clause **cannot be built as written**: `RunStore.witness` (`src/daemon/runs.ts:586`) ends in `persist()`, so consulting ADR-0020's witness *writes to the very file the lock protects*. Two faults followed, both reproduced at the real defaults — a refused process mutates the ledger it was refused, and three refused `daemon --once` starts a minute apart accumulate enough watch to **break a live daemon's lock**, which is this phase's own fault arriving as its fix, on the path [19e step 2](#sub-phase-19e-live-gate--a-written-answer-from-a-person) walks. fvermaut ruled on 2026-08-13 that **a lock holder's proof of life is its process, not its witnessed time**. 19a's reclaim seams and 19e's step 4 are rewritten below; **nothing else in this plan moves**, and 19a's other four seams, 19b, 19c, 19d and 19f are untouched.

> **Re-checked against `main` at approval, as this plan required of itself.** `main` is at `5376b51`, clean. **Nothing under `src/` has changed since the trace this plan rests on** — the only commits since `8952478` are this plan, [ADR-0023](../../adr/0023-one-answer-one-session.md), and the fixture correction to 19e. Every file-and-line citation below is therefore as traced on 2026-08-11. **Nothing in this plan changes as a result** — it is confirmed, not amended.

> **Eighth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: **[ADR-0023](../../adr/0023-one-answer-one-session.md)** (one answer, one session), made by fvermaut on 2026-08-11 from four options, and **[ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)** (a lock holder's proof of life is its process), made on 2026-08-13 from three, which amends 0023's reclaim clause. Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) — **which after 0025 governs runs and no longer the lock** — [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md).

## Why this phase exists, and why it is next

[Phase 18](phase-18.md)'s stage-7 pass ([report](reports/phase-18-verification.md)) failed **PRD-02.R3** and **PRD-02.R20**. This phase closes the defect both failures share.

**What it costs while it waits, stated once.** [STATUS.md](../../../STATUS.md) instructs fvermaut to answer the six open `ivtrends` decision tickets by talking them through rather than writing on them, because a written answer is answered twice. That is a live restriction on a real project, on the very path [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) existed to open. **It is lifted by this phase's gate and by nothing else.**

**The ADR gate fired and is discharged.** The mechanism was traced on 2026-08-11 and four options were put to fvermaut with their trade-offs; he chose all three mechanisms layered, which is [ADR-0023](../../adr/0023-one-answer-one-session.md). **No slice below resolves an open decision.**

**The evidence this phase acts on is gathered and is not to be re-gathered.** [Phase 18's verification report](reports/phase-18-verification.md) carries both reproductions with timestamps, session ids and the operator-visible error; the trace of 2026-08-11 carries the file-and-line mechanism, restated in [ADR-0023](../../adr/0023-one-answer-one-session.md)'s Context. Slices read them. **Reproducing the duplication again costs two paid sessions to learn nothing new**, and the gate below is built so it is not needed.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R3 | MUST | Async clarification via a conversation, answerable in writing | **closes**, if 19e's human gate is obtained — clauses 1 and 2 already PASS |
| PRD-02.R20 | MUST | Wayfinder decision tickets participate in the loop | **clause 3 closes; the requirement does not** — see below |

**R20's limit, stated now so the completion report is not where it is discovered.** R20 failed on three counts and this phase fixes one of them. **Clause 2 — `takeover` resolving a wayfinder ticket with no ledger run, from the tracker — is untouched here**, because the register and the build disagree by deliberate design and which one moves is fvermaut's ruling, not a fix context's guess. **Clause 1's `prototype`, `research` and `task` branches remain unobserved**; obtaining them needs a map charted by an interactive stage-2 session. **R20 therefore stays `failed`** with its remainder named, and nobody should read this phase as closing it.

Deliberately **not** this phase: **R20 clause 2**, above; **the frozen output-token counter** (R17's remainder, unexplained since 14g); **`timone status` understanding "blocked by another question"**, and the related fault that it cannot tell an unanswered question from one handed back; **nothing forcing a resolving session to refresh the tickets that waited on it**; the real bot identity, which is what would let a claim be read off the ticket at all; the Slack adapter; a `setup` skill.

## Goal Description

A written answer is acted on once.

Today three faults stack. Nothing enforces one writer of `.timone/state.json`. A run is claimed *after* its session has already started, so for minutes the ledger advertises as parked a run that is running. And the guards that would notice answer from an in-memory snapshot that only ever advances when their own process mutates it. Underneath all three sits a fourth that needs no concurrency: a resumed session that posts no comment reparks with a cursor pointing before the human's answer, so the next cycle reads it again.

After this phase: one process may write the ledger and a second says so plainly; a run is claimed before its session exists; the guards read the file; and reading an answer consumes it, with `timone retry` as the way back.

**Load-bearing decisions, fixed here so slices don't re-litigate them** (all from [ADR-0023](../../adr/0023-one-answer-one-session.md)):

- **The lock is on the process, not on the function.** `pollOnce` and every other unit under test is unchanged and untaken; the lock is acquired by the CLI entry points that mutate the ledger — `daemon`, `takeover`, `retry`. **If a slice finds itself taking a lock inside `poll.ts`, it has left its scope.**
- **A refusal, never a wait and never a second copy.** The second process exits non-zero with one plain sentence naming the holder. A queue would make two daemons look supported.
- ~~**The lock is reclaimable on ADR-0020's evidence and no other.** A crashed process must not wedge a project — that is precisely the fault [phase 14](phase-14.md) removed. **It may not be reclaimed on witness the daemon cannot vouch for**, or a sleeping laptop starts breaking locks, which is [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) inverted.~~ ✏ **Refined 2026-08-13 — unbuildable as written; see the banner.** **The lock is reclaimed on the holder's process being gone, and on nothing else** ([ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)). A crashed process must still not wedge a project. The quiet window survives as a cheap first filter and stops being the authority: **a stale lock whose process is alive is refused**, which is what makes the sleeping laptop a non-question rather than a hazard to reason about — a suspended holder still exists. **The witness is not consulted, not stamped, and not required on any path through acquisition**; a slice that reaches for `RunStore.witness` from `lock.ts` has left its scope.
- **Claiming before the spawn must release on failure.** `parked → active` moves ahead of `runtime.start`; if the spawn throws, the same path puts the run back. **A claim that outlives its session is the stuck-run fault**, and reintroducing it is the specific way this phase can go wrong. It is asserted before any happy-path test.
- **Refreshing is on the accessors the guards use**, not a blanket re-read on every call. `occupyingRun`, `runningRun` and `parkedRuns` are the three the poll loop guards on.
- **The answer is never destroyed; only the marker moves.** The comment stays on the ticket, permanent and public. Consuming means the cursor advances as part of deciding to resume.
- **`timone retry` rewinds the cursor.** That is the route back when a session dies holding a consumed answer, and it is what makes consuming safe rather than lossy.
- **Nothing a human reads changes.** No ticket wording, no resolution shape, no change to either answer path. A slice editing `src/channels/terminal.ts` copy or a skill's CTA template has left its scope.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–18 — Timone's own work commits directly and this is recorded rather than assumed. Re-check this plan against `main` at approval.
- **The mechanism's file-and-line citations are in [ADR-0023](../../adr/0023-one-answer-one-session.md)'s Context** — `runs.ts:281,309,321,330,686,725,771`, `session.ts:465,554,563,925`, `poll.ts:639,642`. They are starting points found by trace, not a specification; a slice verifies each before acting on it.
- **`--once` is a fresh process per cycle**, which is what made the observed race reachable by hand and is what 19a's refusal will now catch.
- **Two spawn sites exist per cycle** — the entry spawn for a `picked-up` occupier and the resume spawn in `resumeAnswered` — and both are awaited, so a single process cannot double-spawn. **The duplication is between processes**, and any slice reasoning about it in-process has misread the finding.
- **662 tests are green at `main`**, with one unidentified intermittent failure seen once in eight runs at phase 18 and not since. It is not this phase's to chase, and it is named so a red run is not mistaken for one of ours.

## Sub-phases

### Sub-phase 19a: one writer, and it says who holds it (R3)

**[NEW FILE]** `src/daemon/lock.ts`, `lock.test.ts` — an exclusive lock over the state file: acquire, release, and a reclaim path gated on the holder's **process being gone** ([ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)). ✏ **Refined 2026-08-13** — was "gated on [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)'s witness", which is unbuildable; see the banner. The holder's identity — pid, `command`, and `since` — is recorded so the refusal can name it **and** so a reused pid is not mistaken for the holder. **Liveness is injected** (a `isHolderAlive?: (holder) => boolean` on the request, defaulting to a `process.kill(pid, 0)` probe), because a test cannot portably manufacture a dead pid and must not be left asserting against whatever the runner's pid table happens to hold.
**[MODIFY]** `src/commands/daemon.ts`, `daemon.test.ts` — acquire on start, release on exit including the signal paths; a second daemon exits non-zero with one plain sentence.
**[MODIFY]** `src/commands/takeover.ts`, `src/commands/retry.ts` and their tests — the same acquisition, for the same reason: both spawn sessions and both were racing the daemon.

**Seams under test (TDD):** a second acquisition while the first is held **fails**, and this is asserted before any release test; the refusal names the holder and exits non-zero; release makes the lock available again; releasing is proven to happen on the throwing path, not only the returning one; `pollOnce` is proven **untaken** by a test that calls it directly with no lock held, so the unit surface stays as it was.

✏ **Refined 2026-08-13** — the reclaim cases are rewritten onto [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md); the five above are unchanged and any already written to them stand. **In place of the witness cases:** a lock quiet past the window whose **process is gone** is reclaimed, and the reclaimer says whom it took it from; a lock quiet past the window whose **process is alive** is **refused** — the suspended-holder case, asserted explicitly, and it is the one this slice exists to get right; a lock quiet past the window whose pid is alive but **running a different `command`** is treated as a reused pid and **reclaimed**; a lock **inside** the quiet window is refused **without the liveness probe being called at all**, asserted by counting probe calls, so the window stays a filter rather than becoming a second authority; and **no path through acquisition touches the ledger** — asserted by taking `state.json`'s mtime and content across a refused acquisition and a reclaim, both of which must leave it byte-identical, which is the assertion that would have caught the defect this amendment exists for.

> No dependency on other sub-phases. Sequenced first: it is the slice that makes the other two safe to reason about.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/lock.test.ts src/commands/daemon.test.ts src/commands/takeover.test.ts src/commands/retry.test.ts
npm run type-check
npm test
```

- [ ] A second writer is refused, and the refusal names the holder
- [ ] The lock is released on the throwing path, asserted before the happy path
- [ ] ~~A crashed holder's lock is reclaimable — and **not** across an unwitnessed gap~~ ✏ **Refined 2026-08-13:** a crashed holder's lock is reclaimable, and a **live** holder's is refused however long it has been quiet
- [ ] The quiet window never probes liveness, and no acquisition path writes `state.json` — both asserted, not argued
- [ ] `pollOnce` still runs untaken, so no test needed a lock to keep passing

---

### Sub-phase 19b: the claim precedes the work (R3)

**[MODIFY]** `src/daemon/session.ts`, `session.test.ts` — `parked → active` moves ahead of `runtime.start`; the spawn's failure path releases the claim.
**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — `occupyingRun`, `runningRun` and `parkedRuns` refresh from disk before answering.

**Seams under test (TDD):** a spawn that throws leaves the run **parked**, not `active` — asserted before any happy-path claim test, because a claim that outlives its session is the stuck-run fault; a run claimed by another process's write is visible to a guard that has not itself mutated anything, which is the property the in-memory accessors could not hold; the ordering is asserted directly — the ledger reads `active` before `runtime.start` is entered, using a runtime double that inspects the store when called; two `activate` calls on one run are proven impossible to interleave through the refreshed guard; `runForSession` (`src/commands/guardrails.ts:136`) matches a session to its run under the new ordering, so a guardrail report is not misfiled as `interactive` — the side effect the collision produced.

> Depends on 19a. The refreshed guards are only meaningful once one writer is guaranteed, and testing them against a second writer needs the lock's reclaim path to exist.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/session.test.ts src/daemon/runs.test.ts src/commands/guardrails.test.ts
npm run type-check
npm test
```

- [ ] A failed spawn leaves no claim behind — asserted first
- [ ] The claim is proven written **before** the session starts, by observation not by reading the diff
- [ ] A guardrail report reaches its run rather than being filed as `interactive`

---

### Sub-phase 19c: reading an answer consumes it (R3, R20 clause 3)

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — the wait cursor advances as part of deciding to resume on a written answer.
**[MODIFY]** `src/daemon/session.ts`, `session.test.ts` — `afterConversation`'s repark no longer resolves a cursor pointing before the human's answer; the no-comment path is the one that re-fires today and it is fixed here.
**[MODIFY]** `src/commands/retry.ts`, `retry.test.ts` — `retry` rewinds the cursor to before the consumed answer.

**Seams under test (TDD):** a second read of the same thread after the cursor advanced finds **nothing outstanding** — the single assertion this slice exists for; a resumed session that posts **no** comment does **not** cause the same answer to be read again on the next cycle, which is the single-process re-fire and needs no concurrency to demonstrate; `retry` after a consumed answer makes that answer readable again, end to end through the ledger rather than by poking fields; the comment itself is proven **untouched** on the ticket in every case — nothing edits or deletes what the human wrote; a genuinely *new* comment arriving after a consumed one is still picked up, so consuming is proven not to have deafened the path.

> Depends on 19b. Consuming is a ledger write on the resume decision, and it must sit inside the claim ordering 19b establishes rather than beside it.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts src/daemon/session.test.ts src/commands/retry.test.ts
npm run type-check
npm test
```

- [ ] The re-fire is proven fixed **without** a second process in the test
- [ ] `retry` is proven to be a real route back, through the ledger
- [ ] The human's comment is never written to, in any path
- [ ] A fresh answer still gets picked up — consuming did not deafen it

---

### Sub-phase 19d: one fetch per parked run per cycle

**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — `concludeReview`/`resolveWait` and `concludeLastConversation`/`resolveWait` each fetch the same thread twice per parked run per cycle. One refactor covers both, as [phase 18's handoff](reports/phase-18-handoffs.md) records.

**Why it rides here rather than waiting.** It is not the cause of the duplication and must not be reported as such. It is on this exact path, it doubles the latency of a decision, and it makes that decision non-atomic with respect to the thread it reads — which is the shape of fault this phase is closing.

**Seams under test (TDD):** one `getTicket` per parked run per cycle, asserted by counting adapter calls, for both the review and conversation paths; the decisions reached are byte-identical to those reached with two fetches, so the refactor is proven behaviour-preserving rather than assumed.

> Depends on 19c, which is the last slice to change this file's decision logic. Sequenced last among the code slices so it refactors a settled shape.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/poll.test.ts
npm run type-check
npm test
```

- [ ] The call count is asserted, not the code shape
- [ ] Decisions unchanged — the diff is fetches, not judgement

---

### Sub-phase 19g: the consumed answer survives the session that read it (R3)

✏ **Added 2026-08-14**, after [19e](#sub-phase-19e-live-gate--a-written-answer-from-a-person) step 3 **failed on the live gate**. Steps 1, 2 and 4 passed; this slice exists because step 3 did not, and 19e is re-run once it lands.

**What the gate found, so it is not re-derived.** On the resume path the consumed cursor is written by `repark`, then the run is spawned, and then `activate` **clears `waitCursor`**. A session that dies after being activated therefore leaves the run `failed` with **no cursor at all**. `timone retry` has nothing to rewind, falls through to the entry path, and reparks with `waitCursorFrom(ticket)` — which is *now*, after the human's answer. Observed on `scratch-app` #26 at 21:54:32Z against an answer written at 21:52:33Z: **the original invitation was re-posted verbatim and the answer was left permanently unread.**

**Why it is not a documentation matter.** [ADR-0023](../../adr/0023-one-answer-one-session.md) justified consume-on-read by trading *"a silent double-answer for a visible stall"*, and undertook that **`timone retry` rewinds the marker**. What the build does instead is a **silent re-ask** — the human's words discarded and the same question posed again. That is not the trade that was accepted, and on a real decision it is worse than the double-answer it replaced.

**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — the run records the instant of the answer it consumed, in a field that **survives `activate`**. `waitCursor` cannot carry it, which is the whole of the fault.
**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — the consume writes that instant alongside the repark, from the same single read [19d](#sub-phase-19d-one-fetch-per-parked-run-per-cycle) established.
**[MODIFY]** `src/commands/retry.ts`, `retry.test.ts` — `retry` rewinds to that instant **whichever state the run died in**, and clears it once used.

**Seams under test (TDD):** a run that died **`active`** — the live case, which 19c's test never reached — is made readable again by `retry`, asserted end to end through the ledger and **before** any other case, because it is the one the gate caught; the consumed instant is proven to **survive `activate`**, by reading it back after the transition that clears `waitCursor`; `retry` on a **parked** run still rewinds as it did, asserted as a regression so 19c's case is not traded away for this one; a run that **resolved normally** leaves no stale consumed instant behind, so a later retry cannot resurrect a settled answer; and the re-ask itself is proven gone — after `retry`, the next cycle **resumes** rather than posting a fresh invitation, asserted by counting invitations on the thread.

> Depends on 19c and 19d. It writes to the consume path 19c created and must take its instant from the single read 19d established.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/runs.test.ts src/daemon/poll.test.ts src/commands/retry.test.ts
npm run type-check
npm test
```

- [ ] A session that died **`active`** gives its answer back on `retry` — asserted first
- [ ] The consumed instant survives `activate`, proven by reading it back
- [ ] 19c's parked-run rewind still works — no regression
- [ ] After `retry` the next cycle **resumes**; no second invitation is posted
- [ ] A normally-resolved run leaves nothing a later `retry` could resurrect

---

### Sub-phase 19e: live gate — a written answer, from a person

**[NO CODE.]** A live run on the fixture, then the human gate on a real project.

1. **A written answer is still picked up and resolved — once.** On `scratch-app`, mark a throwaway question, park it, write an ordinary answer, and run the daemon. Expect: one session, one resolution, one close, and **no** `could not resume` in the log. **A fix that merely stopped resuming would pass nothing else in this list**, which is why step 2 exists.
2. **The refusal fires and is legible.** With the daemon inside a session, run a second `daemon --once` and a `takeover`. Both refused, both naming the holder. This is the step that would have caught the original fault, and it is run on purpose.
3. **The way back works.** Kill a session holding a consumed answer; confirm the run is reported stopped rather than silently idle, and that `timone retry` makes the answer readable again and resolves it. ✏ **Ran 2026-08-13 and FAILED** — the run was reported stopped correctly, naming the signal and handing over the recovery command, but `retry` re-asked the question instead of giving the answer back. **Re-run against [19g](#sub-phase-19g-the-consumed-answer-survives-the-session-that-read-it-r3)**, and the re-run must kill the session **after** the run is `active`, since that is the state the first pass proved is the broken one — killing a merely parked run exercises the case 19c already had covered.
4. ~~**The lock does not wedge anything.** Kill the daemon holding the lock with the machine awake throughout; confirm a fresh daemon reclaims and starts. Then confirm across a witness gap that it does **not** — the sleeping-laptop inversion, checked from the ledger's own timestamps as [17c](reports/phase-17-live-gate.md) did, at no cost.~~ ✏ **Refined 2026-08-13 on [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md).** **The lock does not wedge anything, and does not break under a live holder.** Kill the daemon holding the lock; confirm a fresh `daemon --once` reclaims, starts, and **names whom it took the lock from**. Then the inverse, which is now checkable directly rather than by manufacturing a gap: with a daemon **alive and inside a session** — so its lock is quiet well past the window — run a second daemon repeatedly and confirm it is **refused every time**. That is the step the old wording could not have run, since driving the gate with `--once` was itself what accumulated the entitlement to break the lock.
5. **The one judgement no pass has witnessed.** **fvermaut answers a `scratch-app` fixture question in writing, in his own words**, and judges two things a machine cannot: whether the resolution is a fair reading of what he wrote, and — on a deliberately partial second answer — whether the single clarifying question is reasonable and the hand-back timed right. Every written answer tested to date was typed by a machine in his voice; this is the gap [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), [phase 18](phase-18.md) and its verification all name, and **it closes because the person is real, not because the ticket is.** The fixture question must be one he can hold an opinion about and one a partial answer is natural on — a throwaway question about the to-do app, not a synthetic prompt, or he is judging a strawman.

**Seams under test (TDD):** none — this is the live gate. Phase 14 found six defects this way against 532 green tests; phase 16 found a message about to publish local paths onto a client's public pull request. **Every step runs on `scratch-app`, the fixture, and none touches `ivtrends`.** An earlier draft of this plan put step 5 on a live `ivtrends` question on the reasoning that six of them already existed and were therefore free; fvermaut rejected it on 2026-08-11. **Cheapness is the usual argument for polluting a real tracker**, and the fixture exists to absorb exactly that cost. `ivtrends` is where the fix gets *used* once R3 is verified, which is not the same act.

> Sub-phases 19a–19d must be complete.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
node dist/cli.js retry <project>#<n>
```

- [ ] Steps 1–5 each observed, evidence captured for the completion report
- [ ] The resume path shown still **firing**, not merely quiet
- [ ] Exactly one session per answer, verified from the daemon's log **and** the ledger, since the two disagreeing is what exposed the original fault
- [ ] **Human gate:** fvermaut confirms the written path is safe to use on `ivtrends`

---

### Sub-phase 19f: documentation, register, and the route out

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R3 `failed` → `verified` **only on 19e step 5's evidence**; R20 stays `failed` with clause 3 recorded as closed and clauses 1 and 2 named as the remainder.
**[MODIFY]** `STATUS.md` — plain language: what was wrong, what changed, and **the write-your-answer instruction reversed only if step 5 passed**. The two rulings at the top of the file collapse to one, since R20 clause 2 is still open.
**[MODIFY]** `README.md` — one sentence that a second watcher is refused, in the operator's terms.
**[NEW FILE]** `doc/plans/phases/reports/phase-19-complete.md` and `reports/phase-19-live-gate.md`.

**Seams under test (TDD):** none.

> All prior sub-phases must be complete.

#### Agent Validation Steps

```bash
grep -n -A3 "^## R3 " doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n -A3 "^## R20" doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n "in writing" STATUS.md
```

- [ ] R3 does not flip on a merged diff — only on step 5
- [ ] R20 is **not** quietly closed; its clause 2 remainder is named
- [ ] STATUS.md's standing instruction to fvermaut is reversed against evidence or left standing

## Dependency graph

```
19a → (none)          one writer, and it says who holds it
19b → 19a             the claim precedes the work
19c → 19b             reading an answer consumes it
19d → 19c             one fetch per parked run per cycle
19g → 19c, 19d        the consumed answer survives the session that read it
19e → 19a–19d, 19g    live gate: a written answer, from a person
19f → all prior       docs, register, reports
```

✏ **Amended 2026-08-14:** 19g is inserted between 19d and 19e. It keeps the next free letter per the amendment rule rather than renumbering, so the chain reads `a → b → c → d → g → e → f`. It extends rather than breaks the chain's logic: like every code slice before it, it writes to the ledger path the previous one reshaped.

The code slices are a chain rather than a fan, because each writes to the ledger path the previous one reshaped. That is deliberate and it is the cost of layering three mechanisms at three depths.

## What this phase deliberately does not close

- **PRD-02.R20 clause 2** — `takeover` resolving a wayfinder ticket from the tracker. The register and the build disagree by design, and fvermaut's ruling on which moves is outstanding. **The case where it bites is unchanged:** a repository onboarded before phase 18 has no `timone` label, marking there fails silently, and there is then no way in.
- **R20 clause 1's three unobserved branches** — `prototype`, `research` and `task` CTAs, which need a map charted by an interactive stage-2 session.
- **The frozen output-token counter**, R17's remainder, unexplained since 14g and decoupled from the clock by [15a](reports/phase-15-clock-investigation.md).
- **`timone status`'s blindness to blocking**, which is why it currently asks fvermaut to answer `ivtrends` #11 while #11 says nothing is needed.
- **A claim readable off the ticket.** The assignee is the natural place for it and cannot arbitrate while every comment posts under one account. It waits on the bot identity, which needs a credential.
- ~~**An always-on host**, which would remove the sleeping-laptop premise this phase's lock reclaim has to respect.~~ ✏ **Refined 2026-08-13:** after [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md) the lock rests on no sleeping-laptop premise at all — a suspended holder's process exists, so it reads as alive. **An always-on host stays out of scope**, and what would now force the lock to be revisited is a *second host*, since the lock is single-machine by construction.
