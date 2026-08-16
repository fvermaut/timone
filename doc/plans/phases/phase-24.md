# Phase 24: a handoff is a wait, and a command asks the daemon

> **Status:** Complete — see [reports/phase-24-complete.md](reports/phase-24-complete.md). Built as 24a–24g on 2026-08-16, approved for execution by fvermaut the same day. **24h, the live gate, is not run**, and until it is, both issues are closed in code and open in evidence.

> **The two findings [phase 23's live gate](reports/phase-23-live-gate.md) left open**, filed as [timone#1](https://github.com/fvermaut/timone/issues/1) and [timone#2](https://github.com/fvermaut/timone/issues/2). Governing decisions: **[ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md)** — a handoff is a wait, not a failure — and **[ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md)** — a human command asks the daemon to act. Both are `accepted`, on fvermaut's rulings of 2026-08-16 in the grill session that took the two issues together, from three options each. Standing: [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md), [ADR-0023](../../adr/0023-one-answer-one-session.md), [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md), [ADR-0012](../../adr/0012-conversation-channels.md), [ADR-0024](../../adr/0024-every-open-ticket-answers-for-itself.md), [ADR-0029](../../adr/0029-a-chunk-advances-only-on-success.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md).

## Why this phase exists, and why it is next

**Phase 23 shipped 932 green tests and its live gate found seven defects none of them could see.** Three were fixed during the gate and four are open, all four filed as issues. **These are two of the four**, and they are the two that needed a decision rather than a patch — which is why they were not attempted at 2am and are a phase of their own. The other two, [timone#3](https://github.com/fvermaut/timone/issues/3) and [timone#4](https://github.com/fvermaut/timone/issues/4), are about the words Timone writes and are deliberately not here.

**They are one knot, and that is the single most important thing about this plan.** On `scratch-app` [#31](https://github.com/fvermaut/scratch-app/issues/31) the execution session stopped, asked fvermaut to *"just tell me here to carry on"*, and he did. Nothing acted on it. The status box above his reply named `timone retry` — the command the daemon's own lock refuses while it is running. **Every path the ticket offered was a dead end**, and each of the two fixes is the other's escape hatch:

- [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) makes an unanswered handoff **hold its project**. The way out of a park nobody wants to answer is `timone cancel` — refused today.
- [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md) makes the commands runnable, which is what allows a handoff to hold a project at all without introducing a new way to wedge one.

**So the build order is not free, and it is the reverse of the order the issues were filed in.** The queue lands first. At every point after it the machine is strictly better than today; at every point in the other order, there is a window where a handoff parks and blocks a project with no runnable escape. Nobody may reorder 24a–24d after 24e for convenience.

**It is next because the gate that found these is the third to hold the same ratio** — [phase 14](reports/phase-14-live-gate.md) found six against 532 green, [phase 20](reports/phase-20-live-gate.md) ten against 792, phase 23 seven against 932 — and because both findings are live on the fixture right now.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| [PRD-02.R21](../../specs/prd/prd-02-inversion-of-control.criteria.md#r21--every-open-ticket-answers-for-itself) | MUST | Every open ticket answers for itself | **evidence, not new wording** — the criterion was violated by a ticket whose answer was wrong on both halves |
| [PRD-02.R3](../../specs/prd/prd-02-inversion-of-control.criteria.md#r3--async-clarification-via-a-conversation) | MUST | Async clarification via a conversation | **widened** — ADR-0022's written path gains the one class of stop that could not use it |
| [PRD-02.R10](../../specs/prd/prd-02-inversion-of-control.criteria.md#r10--serialized-work-per-project) | SHOULD | Serialized work per project | **revised** — a handoff now holds its project where it used to release it, so its sign-off lapses |
| [PRD-02.R14](../../specs/prd/prd-02-inversion-of-control.criteria.md#r14--conversation-channel-seam-with-terminal-takeover) | MUST | Conversation channel seam with terminal takeover | **revised** — the takeover stops holding the ledger for its conversation; its behaviour to the human is unchanged and its sign-off still lapses |

**Nothing normative is written before approval.** R3's, R10's and R14's revisions are applied by 24g and are set out there in full. If this phase is amended, nothing has to be unwound.

Deliberately **not** this phase:

- **[timone#3](https://github.com/fvermaut/timone/issues/3) and [timone#4](https://github.com/fvermaut/timone/issues/4)** — the clarification that asks for a conversation without saying what it wants, and the handed-back message that never says whether the fault is the app or the machine. #4 is close kin: it is about the *words* a handoff writes, where this phase is about the *state* behind them. Both are separate decisions and neither is smuggled in here.
- **A socket for the daemon.** [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md) considered and deferred it; a slice that reaches for one has left the plan.
- **The R21 clause-1-against-clause-3 contradiction**, flagged independently by 20d, 20e and 20g and still fvermaut's to settle.
- **A per-project ledger, or a per-project lock.** One state file, unchanged.

## Goal Description

You write `carry on` on a stalled ticket and the machine carries on. You run `timone retry` or `timone cancel` without stopping the daemon first.

**Load-bearing, so the build does not drift into something easier:**

- **The daemon stays the ledger's only writer.** [ADR-0023](../../adr/0023-one-answer-one-session.md)'s rule is not loosened to fit this phase — it is kept literally true by moving the *act*, not the *write*. A slice that has two processes writing `state.json` has misread the decision.
- **A handoff reuses the `conversation` wait; it does not invent a fourth kind.** `resolveWait` ([`poll.ts:1751`](../../../src/daemon/poll.ts)) already re-enters the *same* stage carrying the human's words, which is exactly what a stage that asked a question needs. Nothing in `ParkOptions.kind` ([`runs.ts:396`](../../../src/daemon/runs.ts)) changes.
- **A real failure is still a failure.** A stage that ends without an outcome, or claims an artifact it did not produce, still fails, still posts `failedComment`, and is still what `timone retry` exists for. Only the *handoff* branch moves.
- **A command with no daemon running behaves exactly as it does today.** The queue is the path around a live holder, not a new dependency on one. A slice that makes `timone retry` require a daemon has broken the fallback that every live gate drives.
- **A takeover's claim must not outlive its session.** This is the stuck-run fault [phase 14](phase-14.md) closed, and [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md) names it as the specific way that decision goes wrong. It gets its own slice and its own test rather than a line in someone else's.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–23. `main` is at `c2f210e`, clean, pushed.
- **932 tests green across 25 files at `c2f210e`**, type-check clean. The command is **`npm run type-check` — note the hyphen. There is no `typecheck` script**, and assuming one cost a session an hour on 2026-08-14.
- `npm run build` before any `node dist/cli.js`. A stale `dist/` has produced a confusing result more than once.
- **The daemon must be restarted after any slice whose behaviour is to be observed.** A running daemon keeps the code it started with. This has now bitten six times, and phase 23's gate lost a cycle to it.
- **A live daemon holds `.timone/state.json`.** **Never point a mutating command at that file.** Copy it and use `--state <copy>`, as every slice of phases 22 and 23 did.
- **The live gate runs on `scratch-app` and never on `ivtrends`** — ruled twice, and re-stated here because this phase's gate involves deliberately stalling a run.
- **`RunStore` re-reads the file before every public read** ([`runs.ts:531`](../../../src/daemon/runs.ts)), which is what makes a request applied by the daemon visible to a CLI watching for its effect. This is existing behaviour and no slice needs to add it.

## Sub-phases

### 24a — The request queue

**[NEW FILE]** `src/daemon/requests.ts` — writing, listing, reading and removing request files.
**[NEW FILE]** `src/daemon/requests.test.ts`.

**This slice wires nothing.** It adds a module; no command writes to it and the daemon does not read it yet. That is what makes it independently landable and its validation meaningful.

**What a request is.** One JSON file per request in `<dirname(statePath)>/requests/` — `.timone/requests/` at the default — named so that two requests written in the same millisecond cannot collide. **One file per request is the whole design**: creating a file is not a read-modify-write, so **enqueuing needs no lock at all**, which is the property the entire decision rests on.

**The module's surface**, so a fresh context does not invent one:

- `requestsDir(statePath: string): string` — the only place that path is spelled.
- `enqueue(statePath: string, request: RequestBody): string` — writes atomically (temp file plus `rename`, as [`runs.ts`](../../../src/daemon/runs.ts)'s `persist` already does) and returns the file's path, so a caller can watch or withdraw it.
- `pending(statePath: string): QueuedRequest[]` — every readable request, **in write order**, each carrying its file path.
- `settle(path: string): void` — removes an applied request.
- An **unreadable** request file is skipped and reported, never thrown on: one corrupt file must not stop the daemon reading the rest, and must not be silently deleted either.

**The body is a discriminated union** — `{ kind: "retry", project, ticket }`, `{ kind: "cancel", project, ticket, reason? }`, `{ kind: "claim-takeover", project, ticket }`, `{ kind: "release-takeover", project, ticket, outcome }` — with the same exhaustiveness tripwire the codebase uses elsewhere, so a fifth kind breaks at compile time rather than being ignored at runtime.

**Every request carries who asked and when**, because a request that is applied minutes later needs to be attributable in the daemon's log and in any report about it.

**Seams under test (TDD):** the module's own functions against a temp directory. Red-green cases:

- **Enqueuing takes no lock.** Red: `enqueue` acquires the state lock. Green: with the lock file present and held by a live pid, `enqueue` still succeeds — asserted directly, because this is the property the decision rests on and an implementation that "just takes the lock quickly" would pass every other test here.
- **Two requests in the same millisecond both survive.** Red: the second overwrites the first. Green: `pending` returns two, in write order, with a frozen clock.
- **An unreadable file is skipped and named.** Red: a corrupt file throws out of `pending`. Green: the valid requests come back, the corrupt one is reported, and **it is still on disk afterwards**.
- **`settle` removes exactly one.** Red: it clears the directory. Green: the other requests remain.

#### Agent Validation Steps

```bash
npm test -- src/daemon/requests.test.ts
npm run type-check
npm test
```

- [ ] The lock-held test asserts against a **live** holder (a pid that exists), not merely a lock file — a stale-lock fixture would pass without proving anything
- [ ] `git grep -n "requests/" src/` shows the directory spelled in `requests.ts` and nowhere else
- [ ] The full suite is green and no file outside this slice's grant was modified

### 24b — The daemon applies requests

**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — `pollOnce` ([`:444`](../../../src/daemon/poll.ts)) applies pending requests **before any project is looked at**, and `PollResult` ([`:447`](../../../src/daemon/poll.ts)) gains what it applied so the daemon's log and the tests can see it. `PollDeps` gains the state path, which it does not carry today.
**[MODIFY]** [`src/commands/daemon.ts`](../../../src/commands/daemon.ts) — pass it; the path is already resolved there ([`:200`](../../../src/commands/daemon.ts)).
**[MODIFY]** [`src/daemon/poll.test.ts`](../../../src/daemon/poll.test.ts), [`src/commands/daemon.test.ts`](../../../src/commands/daemon.test.ts).

**Before any project, and before `reclaimStale`.** A retry request that lands after reclaim has to wait a whole cycle to be noticed; one applied first is picked up by the same cycle's registration loop. This is the same ordering argument [23f](phase-23.md) makes about succession, and it is worth stating because the natural place to put a new call is at the end.

**Applying a request is applying it to the store, not re-implementing the command.** `retry` and `cancel` already exist as functions over a `RunStore`; the daemon calls the same code. **A request whose target no longer makes sense is settled, not retried forever** — the run was already re-armed, the ticket was closed, the project left the manifest — and what it could not do is logged in one plain sentence. A request file that survives a failure to apply is a poison pill that stops the queue on every cycle for ever.

**Seams under test (TDD):** `pollOnce` through its injected store and the temp state path, as `poll.test.ts` already drives it. Red-green cases:

- **A queued retry re-arms the run, in the cycle that finds it.** Red: `pollOnce` ignores the directory. Green: a failed run is `queued`/`picked-up` after one cycle, the request file is gone, and the result names what it applied.
- **Requests are applied before reclaim.** Red: the retry is applied after `reclaimStale`. Green: asserted by ordering — the reclaim path sees the re-armed run, not the failed one.
- **An inapplicable request is settled once.** Red: a retry naming a `done` run is left on disk and re-attempted every cycle. Green: it is removed, the cycle records why, and a second cycle does nothing.
- **A corrupt request does not take the cycle down.** Red: the whole poll throws. Green: every project is still polled and the error is on `result.errors`.
- **An empty or absent directory costs nothing.** Red: a missing directory throws. Green: the cycle runs exactly as it does today — this is the state of every existing installation.

> 24a must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/poll.test.ts src/commands/daemon.test.ts
npm run type-check
npm test
npm run build
cp .timone/state.json /tmp/timone-24b.json && node dist/cli.js status --state /tmp/timone-24b.json
```

- [ ] The ordering test asserts on an **observable effect** (what reclaim saw), not on the order of two log lines
- [ ] The absent-directory case is asserted, because every existing installation is in it
- [ ] `.timone/state.json` is byte-identical after the last command (`md5` before and after)

### 24c — `retry` and `cancel` ask when they are refused

**[MODIFY]** [`src/commands/retry.ts`](../../../src/commands/retry.ts) — `runRetry` ([`:33`](../../../src/commands/retry.ts)) enqueues instead of giving up when `acquireStateLock` ([`:37`](../../../src/commands/retry.ts)) refuses **because a live holder has it**. The refusal already carries `holder` on **both** live-holder paths — the quiet-window one ([`lock.ts:163`](../../../src/daemon/lock.ts)) and the process-is-alive one ([`:173`](../../../src/daemon/lock.ts)) — so the refusal kinds are distinguishable without guessing, and both of them enqueue.
**[MODIFY]** [`src/commands/cancel.ts`](../../../src/commands/cancel.ts) — the same, at [`:49`](../../../src/commands/cancel.ts).
**[MODIFY]** [`src/commands/retry.test.ts`](../../../src/commands/retry.test.ts), [`src/commands/cancel.test.ts`](../../../src/commands/cancel.test.ts).

**Three outcomes, and the third is the new one.** Lock free → act directly, exactly as today, **byte for byte in what it prints**. Lock held by a live holder → enqueue, then watch the ledger until the effect appears or a bound expires. Lock unreadable, or held by a dead holder → unchanged; the existing reclaim path owns that case and this slice must not touch it.

**The command reports the effect, not the errand** ([ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md)). Having enqueued, it polls the ledger — `RunStore` refreshes on every read ([`runs.ts:531`](../../../src/daemon/runs.ts)) — and prints what actually happened. **The wait is bounded and the bound is stated to the human**: a poll interval plus a margin, after which it says the request is still queued, names the daemon holding the ledger, and exits non-zero. **A silent hang is the one behaviour this slice may not have**, and it is the reason the bound is a requirement rather than a nicety.

**The waiting message is not decoration.** *"The daemon has the ledger; I've asked it to retry `scratch-app#31` and I'm watching for it"* is what stops a human from concluding the command did nothing and stopping the daemon by hand — which is the habit this whole phase exists to remove.

**Seams under test (TDD):** `runRetry` and `runCancel` over an injected store, a temp state path, an injected clock and an injected lock outcome. Red-green cases:

- **Lock free: nothing is enqueued.** Red: the request path runs unconditionally. Green: the run is re-armed in-process, the requests directory is empty, and the printed output matches today's literal.
- **Live holder: enqueued and reported.** Red: the command prints the refusal and exits 1. Green: a request file exists, and once the store shows the effect the command prints it and exits 0.
- **The wait is bounded.** Red: the loop never ends when the daemon never applies it. Green: with a frozen clock past the bound it exits non-zero saying the request is still queued and naming the holder.
- **A dead holder is untouched.** Red: a stale lock enqueues. Green: the existing reclaim path runs and nothing is enqueued — asserted, because conflating the two refusals would take away `daemon --once`'s route out of a crash, which [ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md) exists to protect.

> 24b must be complete: a request nothing applies is worse than a refusal, because it looks like it worked.

#### Agent Validation Steps

```bash
npm test -- src/commands/retry.test.ts src/commands/cancel.test.ts
npm run type-check
npm test
npm run build
cp .timone/state.json /tmp/timone-24c.json && node dist/cli.js retry scratch-app#1 --state /tmp/timone-24c.json
```

- [ ] The lock-free path's output is asserted against a **literal string**, so "harmless" rewording cannot slip past the tests that every gate report quotes
- [ ] The dead-holder case is asserted separately from the live-holder case
- [ ] The bounded wait's failure exit code is asserted, not just its message

### 24d — A takeover claims through the run

**[MODIFY]** [`src/commands/takeover.ts`](../../../src/commands/takeover.ts) — `runTakeover` ([`:374`](../../../src/commands/takeover.ts)) stops wrapping the interactive session in `withStateLock` ([`:381`](../../../src/commands/takeover.ts)). It claims the run — directly when the lock is free, by request when the daemon holds it — then runs the session **holding no lock**, and releases the claim on **every** exit path.
**[MODIFY]** [`src/commands/takeover.test.ts`](../../../src/commands/takeover.test.ts).

**Exclusivity moves from the file lock to the run's status, which is where the rest of the system already keeps it.** A `RUNNING` status occupies the project's one-session slot ([`runs.ts:34`](../../../src/daemon/runs.ts)), so a claimed run stops the daemon spawning anything else on that project — the same guarantee the daemon's own sessions have always had, and one that survives the daemon being restarted mid-conversation, which the lock never did.

**Release is the risk and it is the whole of this slice's difficulty.** A claim that outlives its session is [phase 14](phase-14.md)'s stuck run, reintroduced. Three exits, and all three are this slice's: the session ends normally; it throws; the process is signalled. `releaseHeldLocks` ([`lock.ts:109`](../../../src/daemon/lock.ts)) already exists for exactly this shape on the lock, and the claim needs the same treatment on the same signal path — **not a `finally`, which a signal does not run**, a fact [`daemon.ts:229`](../../../src/commands/daemon.ts) already records in a comment.

**And the backstop is already built.** A claim that escapes all three paths is an `active` run with no session, which is what `reclaimStale` ([`poll.ts:479`](../../../src/daemon/poll.ts)) reclaims on [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)'s witnessed time. The release paths are the fix; the reclaim is the net; neither is a reason to skip the other.

**Seams under test (TDD):** `runTakeover` over an injected store, lock outcome and a fake session runner. Red-green cases:

- **The session runs with no lock held.** Red: the lock is held for the session's duration. Green: during the fake session the lock file is free — asserted from inside the runner, which is the only place the distinction is observable.
- **The claim is released on a throwing session.** Red: the run stays `active`. Green: it is back to its prior state and the ticket is not left claimed.
- **The claim is released on a signal.** Green: the signal path gives back the claim, driven the way `daemon.test.ts` already drives its own signal handling.
- **A daemon holding the ledger no longer refuses a takeover.** Red: today's refusal message. Green: the claim is requested, the daemon applies it, and the session starts.
- **Every existing refusal survives** — a park it cannot resume, an untracked ticket, an unknown project, a malformed target. These are R14's verified behaviour and are asserted unchanged, because this slice rewrites the function that owns them.

> 24b must be complete. Independent of 24c and may be built in either order; **they share no files**.

#### Agent Validation Steps

```bash
npm test -- src/commands/takeover.test.ts
npm run type-check
npm test
npm run build
```

- [ ] The no-lock-held assertion is made **from inside** the fake session, not before or after it
- [ ] All four pre-existing refusal paths are asserted, by name, in this slice's test file
- [ ] `git grep -n "withStateLock" src/commands/` shows `daemon.ts` and no longer `takeover.ts`

### 24e — A handoff parks

**[MODIFY]** [`src/daemon/session.ts`](../../../src/daemon/session.ts) — the three handoff branches park instead of failing: `afterWorkStage` ([`:724`](../../../src/daemon/session.ts)), `afterRemediation` ([`:764`](../../../src/daemon/session.ts)), `afterDelivery` ([`:816`](../../../src/daemon/session.ts)). Each calls `store.park` ([`runs.ts:679`](../../../src/daemon/runs.ts)) with `kind: "conversation"`, the stage that stopped, and `waitCursor` set to **the handoff comment's own `createdAt`** — which `readStageOutcome` already returns on the outcome ([`outcomes.ts:37`](../../../src/daemon/outcomes.ts)), so nothing has to be fetched or guessed.
**[MODIFY]** [`src/daemon/session.test.ts`](../../../src/daemon/session.test.ts).

**The cursor is the whole of the correctness here.** Set it to the handoff comment and only what is said *after* the question can answer it. Set it to "now", and a clock skew of a second swallows an answer typed immediately; set it to the park's own instant computed separately, and the run can resume on words it never read — the pairing [ADR-0023](../../adr/0023-one-answer-one-session.md) exists to keep intact.

**The transition is already legal**: `active → parked` and `picked-up → parked` are both in `TRANSITIONS` ([`runs.ts:97`](../../../src/daemon/runs.ts)). No change to the state machine, and a slice that finds itself editing that table has taken a wrong turn.

**`waitingOn` is what the ticket will say after *"What I need from you:"***, so it is written for the human and not for the ledger. It names what the stage asked, not that a stage handed back.

**No `failedComment` on this path.** The session's own comment **is** the report — that is what the existing code means by *"a handed-to-human outcome stops without commentary"* — and the standing call to action reconciles to *"This one is waiting on you"* by itself, because `ctaFor` computes from the run's state ([`cta.ts:290`](../../../src/daemon/cta.ts)). **The contradiction between the session's prose and the status box closes here, as a consequence and not as a second fix.**

**Seams under test (TDD):** the three `after*` methods over an injected store and adapter, as `session.test.ts` already drives them. Red-green cases:

- **A handed-back work stage parks, with the right cursor.** Red: `store.fail` is called. Green: `park` is called with `kind: "conversation"`, the stopping stage, and `waitCursor` **equal to the handoff comment's `createdAt`** — asserted against the fixture comment's own timestamp, not against a clock.
- **The other three endings are untouched.** Red: an over-broad change parks a stage that ended with no outcome. Green: no outcome → `failed` and `failedComment` posted; advanced with a real artifact → next stage; advanced without one → `failed`. Asserted in the same test file, because this is precisely where too much gets changed.
- **Remediation and delivery park too, and keep their own other endings.** Green: remediation's reply-with-no-commit still re-parks on the review; delivery's no-open-PR still fails.
- **A parked handoff does not post `failedComment`.** Red: the ticket gets *"Something went wrong"* under the session's own question. Green: `postComment` is not called on this path.

> 24c **and** 24d must be complete. This is the dependency that must not be reordered: before them, a handoff parks and holds its project with no runnable way to release it.

#### Agent Validation Steps

```bash
npm test -- src/daemon/session.test.ts src/daemon/cta.test.ts
npm run type-check
npm test
```

- [ ] The cursor is asserted against the fixture comment's timestamp — a test that asserts "some ISO string" would pass a clock-based implementation
- [ ] All three non-handoff endings are asserted in the same file, by name
- [ ] `git grep -n "handed the work to you" src/` shows the wording surviving as the park's `waitingOn`, or the handoff says which words replaced it and why

### 24f — The park resumes on a written answer

**[MODIFY]** [`src/daemon/poll.test.ts`](../../../src/daemon/poll.test.ts) — the end-to-end proof, through `pollOnce`.
**[MODIFY]** [`src/daemon/poll.ts`](../../../src/daemon/poll.ts) — **only if a case below proves it necessary.** The expectation is that this slice writes no production code: `resumeAnsweredRuns` ([`:1153`](../../../src/daemon/poll.ts)) already resumes parked runs, and the `conversation` branch of `resolveWait` ([`:1751`](../../../src/daemon/poll.ts)) already returns `{ stage, feedback, consumed }` — the same stage, carrying the human's words. **A slice that ends with no production diff has succeeded, not failed**, and the grant exists so that a real gap can be closed rather than worked around.

**The hazard this slice exists to prove is absent.** A `conversation` park is checked by `concludeLastConversation` before it is resumed, and that reads `readConversationRecord` ([`gates.ts:83`](../../../src/daemon/gates.ts)) — **any machine comment after the cursor carrying `CONVERSATION_RECORD_MARKER`**. An execution handoff must never be concluded that way: it would mark the run `done` and close a ticket whose work stopped half-built. The marker is written by conversation stages, which is why this is a hazard rather than a bug — and why it is asserted rather than assumed.

**Seams under test (TDD):** `pollOnce` with a fake adapter serving a thread. Red-green cases:

- **`carry on` resumes the stage that stopped.** The gate's own failure, as a test: a run parked at `execution`, a human comment after the cursor, one cycle → `spawn` called with **`stage: "execution"`** and the human's words as feedback. Red before 24e (the run is `failed` and nothing looks at it).
- **The answer is consumed exactly once.** Green: a second cycle with no new comment spawns nothing — [ADR-0023](../../adr/0023-one-answer-one-session.md)'s consume-on-read, asserted on the path that never used it before.
- **A machine comment does not answer a handoff.** Green: a comment with `fromTimone` after the cursor — the standing CTA reconciliation writes one every cycle — resumes nothing.
- **A conversation record does not conclude a handoff at a work stage.** Green: a machine comment carrying `CONVERSATION_RECORD_MARKER` after the cursor leaves an `execution` park parked. **If this goes red, the fix is in `poll.ts` and it is inside this slice's grant.**
- **Words written *before* the question do not answer it.** Green: a comment older than the cursor resumes nothing.

> 24e must be complete.

#### Agent Validation Steps

```bash
npm test -- src/daemon/poll.test.ts
npm run type-check
npm test
```

- [ ] The resume case asserts the spawned **stage** and the **feedback**, not merely that `spawn` was called
- [ ] The conversation-record case is present and passing; if it needed production code, the handoff says exactly what and why
- [ ] The full suite is green

### 24g — The register and the narrative

**[MODIFY]** [`doc/specs/prd/prd-02-inversion-of-control.criteria.md`](../../specs/prd/prd-02-inversion-of-control.criteria.md) — R3 widened, R10 and R14 revised, R21 annotated with the defect and its fix. Each revision is a dated `✏` block in the house style, naming the ADR that instructed it.
**[MODIFY]** [`process.md`](../../../process.md) — wherever it describes a stage handing back, or names `timone retry`/`cancel`/`takeover` as requiring a stopped daemon.
**[MODIFY]** [`STATUS.md`](../../../STATUS.md) — where it tracks what is safe to use on a live project.
**[MODIFY]** `.claude/skills/timone-execute/SKILL.md` and any other stage skill instructing a session on how to hand back — a skill that tells a session to say *"reply here"* is now telling the truth, and one that tells it to say *"run `timone retry`"* is not.

**Documentation only. No `src/` file is granted to this slice**, and a `.ts` diff here is a defect.

**`CONTEXT.md` is already done** — `Handoff` and `Request` were written at decision time in `c2f210e`, per the glossary rule. This slice adds nothing to it unless a term was sharpened during the build, which the handoff must then say.

**What R21 gets is an annotation, not a rewording.** The criterion was never wrong; a ticket answered for itself and its answer was a dead end. Rewriting the clause would hide that the *machinery* failed a criterion that already said the right thing.

> 24a–24f must be complete. Everything here describes built behaviour.

#### Agent Validation Steps

```bash
npm run type-check
npm test
git diff --stat
grep -rn "timone retry" .claude/skills/ process.md | head
```

- [ ] `git diff --name-only` for this slice shows **no** file under `src/`
- [ ] Every `✏` block names its ADR and carries the date
- [ ] The `grep` shows no surviving instruction telling a human to stop the daemon before running a command

### 24h — The live gate

**No files.** Observation on `scratch-app`, with a restarted daemon, written up whatever the outcome.

**The steps, each an observation and not a hope:**

1. **The `carry on` reply, replayed.** Drive a run to a genuine handoff, reply in writing, and watch the next cycle resume the stage that stopped. **This is the gate's whole reason to exist** — it is the exact sequence that failed on [#31](https://github.com/fvermaut/scratch-app/issues/31) on 2026-08-16.
2. **The ticket says the right thing while it waits.** *"This one is waiting on you"*, with what it needs — and **not** *"Something went wrong"*, and no `timone retry` in the box.
3. **`timone retry` with the daemon up.** Applied within one cycle, with the CLI reporting the effect rather than the errand.
4. **`timone cancel` with the daemon up** — never once observed live, because the lock made it unrunnable ([finding 9 of phase 20](reports/phase-20-live-gate.md) is half-closed on this).
5. **`timone takeover` with the daemon up**, and the daemon still servicing another project during the conversation.
6. **A takeover closed uncleanly gives back its claim.** Ctrl-C mid-conversation, then confirm the run is not left `active`.
7. **The blocking cost, looked at rather than reasoned about.** Queue a second ticket behind a parked handoff and confirm it waits — the cost [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md) accepts — then cancel the handoff and confirm the queued ticket is promoted. **Step 4 is what makes step 7 survivable**, and running them together is the point.

```bash
node dist/cli.js daemon --once
node dist/cli.js status
gh issue view <n> --repo fvermaut/scratch-app --comments
cat .timone/state.json
```

- [ ] Steps 1–7 each observed, with timestamps and costs captured for the gate report
- [ ] Step 6 performed by actually signalling the process, not by simulating it
- [ ] `.timone/state.json` hand-edited **zero** times across the whole gate
- [ ] The gate report is written to `doc/plans/phases/reports/phase-24-live-gate.md` whatever the outcome, including any step not reached
- [ ] **Human gate — fvermaut answers one question:** stalled on a real ticket and having replied in writing, did the machine come back? This phase exists because it did not, and he is the only person who can say the experience is fixed.

## Dependency graph

```
24a → (none)          the request queue
24b → 24a             the daemon applies requests
24c → 24b             retry and cancel ask when refused
24d → 24b             a takeover claims through the run
24e → 24c, 24d        a handoff parks
24f → 24e             the park resumes on a written answer
24g → 24a–24f         the register and the narrative
24h → 24g             the live gate
```

**24c and 24d are genuinely parallel** — `retry.ts`/`cancel.ts` against `takeover.ts`, sharing zero files. Per [process.md](../../../process.md) stage 6's rule, that is the one parallel pair here.

**24e depends on 24c *and* 24d, and this is the ordering that must not be relaxed.** It is the tempting reorder, because 24e is the fix to the issue that was filed first and the one that stings. Built early, it makes an unanswered handoff hold its project while the only escape — `timone cancel` — is still refused by the lock. **That is strictly worse than today's bug**: an invisible dead end becomes a blocked project. The queue first, always.

## Safe stopping point

**24a–24d form a coherent shippable increment, and if this phase has to be reduced mid-flight it reduces *there*.**

After 24d: every command the tickets advertise runs while the daemon is up, `timone cancel` becomes real for the first time since it was built, and a takeover no longer locks the daemon out of every other project. [timone#2](https://github.com/fvermaut/timone/issues/2) closes in full. Nothing about handoffs has changed, so a handed-back run behaves exactly as it does today — unreachable, and no worse.

**What stopping there costs, named:** [timone#1](https://github.com/fvermaut/timone/issues/1) stays open and `carry on` still does nothing, which is the finding phase 23 called the worst of the five. R3, R10 and R14's revisions shrink to R14's alone.

**This section exists because it has worked twice.** [Phase 22](phase-22.md#dependency-graph) said in advance which prefix stood alone, and when it was reduced on 2026-08-15 that sentence made the cut a scope reduction that kept its stamp rather than an improvisation. Phase 23 repeated it. A plan that has not said which prefix stands alone cannot be reduced safely, because the decision then falls to whoever is holding the least context.

## What this phase does not prove

- **That a human finds the resumed session's answer good.** The gate proves the reply *reaches* the work. Whether a stage resuming on `carry on` picks up where a person expected it to is a judgement one fixture cannot settle, and it is the same limit [ADR-0022](../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)'s written path has always had.
- **That the handed-back message reads well.** [timone#4](https://github.com/fvermaut/timone/issues/4) is untouched here: the message still may not say whether the fault is the app or the machine, and now it says so on a ticket that correctly reports it is waiting.
- **That the blocking cost is acceptable at real size.** One queued ticket behind one park, on a fixture. What it feels like when a real initiative is blocked for a working day by a question nobody saw is not something step 7 can show.
- **That a request survives a daemon that dies between enqueue and apply.** The CLI reports the request as still queued and exits non-zero, which is the designed behaviour; the *human's* recovery from that state is not exercised.
- **Anything about two machines.** The lock is single-host ([ADR-0025](../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)) and the request directory is beside it, so it is single-host by the same assumption. Unchanged, and unproven either way.
- **That `timone status` reads well for a parked handoff.** It will report the run as waiting on the human, which is true and is more than it said before. Whether that is the sentence a person wants is [timone#4](https://github.com/fvermaut/timone/issues/4)'s neighbourhood, not this phase's.
