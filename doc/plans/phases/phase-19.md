# Phase 19: one answer, one session

> **Status:** Awaiting approval.

> **Eighth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decision: **[ADR-0023](../../adr/0023-one-answer-one-session.md)** (one answer, one session), made by fvermaut on 2026-08-11 from four options. Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0014](../../adr/0014-artifact-first-gates.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md), [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md).

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
- **The lock is reclaimable on ADR-0020's evidence and no other.** A crashed process must not wedge a project — that is precisely the fault [phase 14](phase-14.md) removed. **It may not be reclaimed on witness the daemon cannot vouch for**, or a sleeping laptop starts breaking locks, which is [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md) inverted.
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

**[NEW FILE]** `src/daemon/lock.ts`, `lock.test.ts` — an exclusive lock over the state file: acquire, release, and a reclaim path gated on [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)'s witness. The holder's identity is recorded so the refusal can name it.
**[MODIFY]** `src/commands/daemon.ts`, `daemon.test.ts` — acquire on start, release on exit including the signal paths; a second daemon exits non-zero with one plain sentence.
**[MODIFY]** `src/commands/takeover.ts`, `src/commands/retry.ts` and their tests — the same acquisition, for the same reason: both spawn sessions and both were racing the daemon.

**Seams under test (TDD):** a second acquisition while the first is held **fails**, and this is asserted before any release test; the refusal names the holder and exits non-zero; release makes the lock available again; a lock whose holder crashed is reclaimable **only** when the witness says the daemon may judge, and is **not** reclaimed on a witness gap — the sleeping-laptop inversion, asserted explicitly; releasing is proven to happen on the throwing path, not only the returning one; `pollOnce` is proven **untaken** by a test that calls it directly with no lock held, so the unit surface stays as it was.

> No dependency on other sub-phases. Sequenced first: it is the slice that makes the other two safe to reason about.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/lock.test.ts src/commands/daemon.test.ts src/commands/takeover.test.ts src/commands/retry.test.ts
npm run type-check
npm test
```

- [ ] A second writer is refused, and the refusal names the holder
- [ ] The lock is released on the throwing path, asserted before the happy path
- [ ] A crashed holder's lock is reclaimable — and **not** across an unwitnessed gap
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

### Sub-phase 19e: live gate — a written answer, from a person

**[NO CODE.]** A live run on the fixture, then the human gate on a real project.

1. **A written answer is still picked up and resolved — once.** On `scratch-app`, mark a throwaway question, park it, write an ordinary answer, and run the daemon. Expect: one session, one resolution, one close, and **no** `could not resume` in the log. **A fix that merely stopped resuming would pass nothing else in this list**, which is why step 2 exists.
2. **The refusal fires and is legible.** With the daemon inside a session, run a second `daemon --once` and a `takeover`. Both refused, both naming the holder. This is the step that would have caught the original fault, and it is run on purpose.
3. **The way back works.** Kill a session holding a consumed answer; confirm the run is reported stopped rather than silently idle, and that `timone retry` makes the answer readable again and resolves it.
4. **The lock does not wedge anything.** Kill the daemon holding the lock with the machine awake throughout; confirm a fresh daemon reclaims and starts. Then confirm across a witness gap that it does **not** — the sleeping-laptop inversion, checked from the ledger's own timestamps as [17c](reports/phase-17-live-gate.md) did, at no cost.
5. **The one judgement no pass has witnessed.** **fvermaut answers one real `ivtrends` decision ticket in writing**, and judges two things a machine cannot: whether the resolution is a fair reading of what he wrote, and — on a deliberately partial answer — whether the single clarifying question is reasonable and the hand-back timed right. Every written answer tested to date was typed by a machine in his voice; this is the gap [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), [phase 18](phase-18.md) and its verification all name.

**Seams under test (TDD):** none — this is the live gate. Phase 14 found six defects this way against 532 green tests; phase 16 found a message about to publish local paths onto a client's public pull request. **Steps 1–4 run on `scratch-app`**, the fixture. **Step 5 is the first written answer on a real project and is deliberately last**, behind evidence.

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
19e → 19a–19d         live gate: a written answer, from a person
19f → all prior       docs, register, reports
```

The code slices are a chain rather than a fan, because each writes to the ledger path the previous one reshaped. That is deliberate and it is the cost of layering three mechanisms at three depths.

## What this phase deliberately does not close

- **PRD-02.R20 clause 2** — `takeover` resolving a wayfinder ticket from the tracker. The register and the build disagree by design, and fvermaut's ruling on which moves is outstanding. **The case where it bites is unchanged:** a repository onboarded before phase 18 has no `timone` label, marking there fails silently, and there is then no way in.
- **R20 clause 1's three unobserved branches** — `prototype`, `research` and `task` CTAs, which need a map charted by an interactive stage-2 session.
- **The frozen output-token counter**, R17's remainder, unexplained since 14g and decoupled from the clock by [15a](reports/phase-15-clock-investigation.md).
- **`timone status`'s blindness to blocking**, which is why it currently asks fvermaut to answer `ivtrends` #11 while #11 says nothing is needed.
- **A claim readable off the ticket.** The assignee is the natural place for it and cannot arbitrate while every comment posts under one account. It waits on the bot identity, which needs a credential.
- **An always-on host**, which would remove the sleeping-laptop premise this phase's lock reclaim has to respect.
