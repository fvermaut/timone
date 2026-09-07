# Phase 37: A held ticket's parked run does not resume itself

> **Status:** Planned.

> **Companion phases:** none — a standalone bug fix, not part of a breakdown. Governing decisions: [ADR-0046](../../adr/0046-a-pull-request-closed-without-merging-holds-its-ticket-and-asks.md) D3 — "the hold now means one thing everywhere: *do not pick this up*," the sentence this phase's fix completes; [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D7 — only a human removes a hold, which is why the fix must never do so itself.

## Requirements

> **PRD:** [prd-03-a-run-ends-at-its-pull-request.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.md) — criteria in [prd-03-a-run-ends-at-its-pull-request.criteria.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-03.R1 | MUST | Clause 3: once a pull request closes without merging, the ticket is marked held and its run "stops rather than restarting on its own" |

**What this bug report is, precisely.** R1's clause 3 is `verified` for the one path that already implements it — `concludeReview`, which applies the hold label itself when a pull request closes unmerged and never restarts the run it just ended. The daemon's *other* resume path, `resumeAnswered`'s final branch (`src/daemon/poll.ts:2053-2096`), spawns a session for any parked run whose wait has an answer, and never reads the ticket's labels before doing it. `timone#105`'s run was parked on a different kind of wait — not a review — and its ticket had been held since 2026-09-05 for an unrelated reason; three plain-language ticket comments, written by supervised sessions with no machine marker, read as human answers and the daemon resumed the run on its own. That is the same guarantee R1's clause 3 states — a held ticket's run does not restart on its own — reached through the path the clause's existing implementation does not cover. It is a bug against that guarantee, not a new promise.

## Goal Description

`pollProject`'s registration loop already refuses to open a *new* chunk on a held ticket (`src/daemon/poll.ts:1484-1490`, `if (ticket.labels.includes(HELD_LABEL)) continue;`), with a comment explaining exactly why: "Nothing here removes a hold... a ticket held by a declined pull request would simply be registered afresh on the next cycle and rebuilt." `resumeAnswered` is the sibling case the comment does not mention — a run that is already parked, not a fresh chunk — and it has no equivalent check. The two paths make the same promise (a held ticket does not move) through different mechanics (refuse to start vs. refuse to continue), and only one of them keeps it.

This phase adds the missing check to `resumeAnswered`, in the same shape as the one that already exists on the registration path: read the ticket's current labels and, if `HELD_LABEL` is present, leave the run exactly where it is. It changes nothing about *how* a ticket becomes held (`concludeReview`'s own application of the label, at `poll.ts:2282-2283`, is untouched) and nothing about how a hold is lifted (still only a human, per ADR-0044 D7) — it closes the one gap where an existing hold was not being read at all.

**Placement matters and is worth stating precisely, because getting it wrong either breaks a working path or hides the fix behind a false negative.** The check must sit after `threads.ticket()` is available (so it costs no extra fetch — the reader is memoised per ticket per cycle, `poll.ts:2213-2234`) and before `resolveWait` is called, not after: `resolveWait` is what decides an answer was given, and if the check ran after it the human's words would already have been read once (even though nothing would then act on them), which is one atomic read away from `store.repark`'s cursor advancing on a wait nobody acted on. Landing the check before that call means a held ticket's outstanding comment is untouched — not read, not marked as seen — so removing the hold later (ADR-0046 D4's "remove the hold label to have the work done again from scratch") lets the very same comment resume the run on the next cycle, rather than the answer having been silently consumed while nobody could act on it.

**The check must not extend to `concludeReview` or `concludeLastConversation`, the two branches above it in the same loop.** Both of those *end* a run — they never start a new session — so neither one is "picking this up" in ADR-0046 D3's sense; they are the mechanism that settles work already finished. `concludeReview` in particular is how a ticket *becomes* held in the first place, mid-cycle, from a `tickets` snapshot taken before that happened — gating it on the same snapshot's hold state would be checking a hold against the very moment it is being applied, which is not what this bug is about and would risk leaving a closed-and-unmerged pull request's run stuck open with nothing to settle it. This phase's fix is scoped to the one branch that actually restarts work: the `resolveWait`-then-`spawner.spawn` sequence.

**Why this does not need a decision record.** The three-part test: is it hard to reverse? No — it is one label check, on one boolean, mirroring a pattern that already exists four hundred lines away for the equivalent case; deleting it restores exactly today's behaviour. Is it surprising without context? No — ADR-0046 D3 already states the general rule in words ("the hold now means one thing everywhere"), and the registration path already implements it for its own case; this phase extends the same rule to the case the ADR's own title undersells. Is it the result of a real trade-off? No — there is no second reasonable design being passed over; a resume path that does not read the one label the whole hold mechanism is built on is simply incomplete. None of the three hold, so this stays a bug fix, recorded here rather than sent to a decision record.

**This phase's diff falls inside PRD-03.R1's declared dependency (`src/daemon/`).** R1 is `Verify-via: live` and already carries a `verified` status from a live gate that watched clause 3's own mechanism (`concludeReview`) but never exercised this one — the incident that opened this ticket is the first time anyone watched clause 3 fail in the wild, on the branch this phase does not touch. Verification will need to re-examine R1 against this fix; whether that re-examination requires a fresh live gate or can be argued from this phase's own tests plus the existing evidence is verification's call to make, not this plan's.

## Context & Prerequisites

- **`src/daemon/poll.ts:1442-1520`** (`pollProject`'s registration loop) — the existing, working pattern this phase mirrors: `ticket.labels.includes(HELD_LABEL)` read from the cycle's `tickets` listing, `continue` when true, with the comment at `:1484-1490` explaining why. `resumeAnswered` does not have access to that same `tickets` array — it reads the ticket through its own `threads.ticket()` instead, which is the equivalent read for a function that only ever sees one ticket at a time.
- **`src/daemon/poll.ts:2000-2098`** (`resumeAnswered`) — the function this phase changes. The loop reads one parked run at a time, fetches `threads` once per ticket (`:2023`), then branches on the run's wait kind: a review conclusion (`:2027-2037`), a conversation conclusion (`:2041-2051`), and — the branch this phase gates — resolving and spawning (`:2053-2096`).
- **`src/daemon/steps.ts`** — `HELD_LABEL` (`"timone:held"`) and `HELD_LABEL_DESCRIPTION`, already imported into `poll.ts` (`:71-73`). No new import is needed.
- **`src/adapters/ticketing.ts`** — `TicketThread` (`labels: z.array(z.string())`, via the shared ticket schema), what `threads.ticket()` resolves to. The check reads `.labels` off that value.
- **`src/daemon/poll.test.ts`** — the seam this phase tests through is `pollOnce`, the pattern used by every existing describe block in this file (there is no test file that calls `resumeAnswered` directly; it is not exported). `describe("pollOnce — resuming a run whose human answered", ...)` (`:514`) already has the fixtures this phase's tests extend: `threadedAdapter`, `parkedOnConversation`, `parkedOnGate`, and the `invitation`/answer comment shapes. `describe("pollOnce — a run parked on a pull-request review", ...)` (`:1161`) has the review-wait fixtures the regression case needs.

## Sub-phases

### Sub-phase 37a: A held ticket's parked run stays parked

**[MODIFY]** `src/daemon/poll.ts` — in `resumeAnswered`, after the conversation-conclusion branch (`:2041-2051`) and before `resolveWait` is called (`:2053`), read the ticket through the already-open `threads` reader and skip this run when it is held:

```ts
const ticket = await threads.ticket();
if (ticket.labels.includes(HELD_LABEL)) continue;
```

Comment it the same way the registration-path check at `:1484-1490` is commented: name what this guards against (a parked run resuming on a ticket the human has not cleared), and cross-reference that this is the sibling of the registration-path check rather than a new rule.

**Seams under test (TDD):** `pollOnce`, the house seam for every behaviour in this file — a fake store, a fake ticketing adapter and a fake spawner drive one poll cycle and the test reads `result.resumed`, `spawned`, and the run's status back out. Red-green:

1. A run parked on a **conversation** wait (`parkedOnConversation`-style fixture), whose ticket carries `HELD_LABEL` in the listing `threads.ticket()` resolves to, receives a comment that would otherwise read as an accepted conversation record. Today: it resumes and a session is spawned. After the fix: `result.resumed` is `[]`, nothing is spawned, and the run's status is still `"parked"`.
2. The same fixture **without** `HELD_LABEL` on the ticket resumes exactly as today — this is the existing "advances a conversation the session recorded as accepted" case (`poll.test.ts:575`) and must still pass unmodified; it is the control that proves the fix discriminates on the label rather than blocking resumption outright.
3. A run parked on a **gate** wait (`parkedOnGate`-style fixture), whose ticket carries `HELD_LABEL`, receives an `approve` reply. Same assertion as case 1: no resume, no spawn, still parked. This is the shape closest to the live incident — a plain-language reply on a held ticket must not move a waiting run, whatever kind of wait it is parked on.
4. **The answer is not consumed while held.** Run case 1's cycle, then simulate the hold being lifted (re-poll with the same ticket fixture minus `HELD_LABEL`, same comment still on the thread, nothing new posted). The run now resumes on that same, previously-unread comment — proving the fix bails out before `resolveWait` reads anything, rather than reading and discarding the answer. A fix that reads-then-drops would fail this case even though it passes cases 1 and 3.
5. **Scope guard: a review-wait run is unaffected.** A run parked on a **review** wait, whose ticket independently carries `HELD_LABEL` (held for an unrelated reason, unrelated to this pull request), has its pull request close unmerged this cycle. `concludeReview` still runs, still ends the run (`result.completed` contains it), still posts the closed-unmerged comment, and the held label is still applied by `concludeReview` itself as it already is today — none of that is gated by this phase's check. This guards against over-scoping the fix to the two conclusion branches instead of only the spawn branch.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npm run type-check && echo "type-check exit: $?"
npx vitest run src/daemon/poll.test.ts
npx vitest run src/daemon
```

- [ ] Cases 1 and 3 fail red against the unmodified code (confirm the bug reproduces) before the guard is added, then pass green after
- [ ] Case 2 passes unmodified before and after — the existing test at `poll.test.ts:575` is not touched
- [ ] Case 4 passes only once the guard sits before `resolveWait`, not after — if it fails after the guard lands, the placement is wrong even though cases 1 and 3 pass
- [ ] Case 5 passes unmodified — `concludeReview`'s existing behaviour and its own tests (`poll.test.ts:1161` onward) are unaffected
- [ ] Full daemon test suite green: `npx vitest run src/daemon`
- [ ] `npm run type-check` clean

---

## Dependency graph

```
37a → (none)   the whole fix: one guard clause in resumeAnswered, and the tests that prove it
```
