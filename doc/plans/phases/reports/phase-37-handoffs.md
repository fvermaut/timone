# Phase 37 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 37a — A held ticket's parked run stays parked

**Built.** `resumeAnswered` (`src/daemon/poll.ts`) now reads the ticket's current labels before resolving what a parked run should do next, and leaves the run parked, untouched, when the ticket carries `timone:held`. This is the sibling of the check `pollProject`'s registration loop already runs before opening a fresh chunk — the same rule, applied to a run that is already waiting rather than one about to start.

**Files touched.**

- `src/daemon/poll.ts` — one guard clause added inside `resumeAnswered`, placed before `resolveWait` is called.
- `src/daemon/poll.test.ts` — five new cases, plus a `labels` parameter added to two existing test-local adapter builders (`threadedAdapter`, `reviewAdapter`) so a test can hand a ticket a held label without touching every other test that calls them.

**Decisions taken inside the slice.** The guard reads the ticket inside the same `try`/`catch` that already wraps `resolveWait`, rather than as a bare statement ahead of it. The plan's code excerpt showed it unguarded; running it that way against the existing test suite surfaced two failures — `a parked occupier whose ticket is no longer listed`'s pair of tests, which park a run on an `escalation` wait for a ticket that then leaves the listing entirely. `threads.ticket()` throws in that case (`no ticket <n>`), and `resolveWait`'s own `escalation` branch already reads the same ticket, inside the try/catch, so the failure was already handled there before this change. Moving the new read inside the same try/catch keeps that handling intact — the read still happens strictly before `resolveWait`'s own body runs, so the "answer not consumed while held" guarantee (case 4) is unaffected — and the two pre-existing tests pass again unmodified.

**Validation evidence.**

Red-green, per declared case (`pollOnce`, in `src/daemon/poll.test.ts`, describe blocks `"pollOnce — resuming a run whose human answered"` and `"pollOnce — a run parked on a pull-request review"`):

1. `"does not resume a conversation wait when the ticket is held"` — written, run red against the unmodified code (`result.resumed` held `["scratch-app#6/1"]` instead of the expected `[]`), then green after the guard clause landed.
2. `"advances a conversation the session recorded as accepted"` (pre-existing, `poll.test.ts:575`) — not touched, passed unmodified before and after.
3. `"does not resume a gate wait when the ticket is held"` — written, run red the same way (`result.resumed` held the run id), then green.
4. `"does not consume the answer while held, so lifting the hold resumes on it"` — written, run red on its first assertion (the held cycle resumed instead of staying parked), then green once the guard landed; the second half of the case (lifting the hold and resuming on the same untouched comment) passed as soon as the first half did, because the guard sits ahead of the cursor-advancing write.
5. `"still ends a review wait when the ticket is already held for an unrelated reason"` — written as the scope guard; it passed green against the unmodified code too, since `concludeReview` was never in scope for this change — recorded as a control, not a red-green pair.

```
$ npm run type-check && echo "type-check exit: $?"
> timone@0.1.0 type-check
> tsc --noEmit
type-check exit: 0

$ npx vitest run src/daemon/poll.test.ts
 Test Files  1 passed (1)
      Tests  194 passed (194)

$ npx vitest run src/daemon
 Test Files  21 passed (21)
      Tests  1183 passed (1183)
```

Validation block, checkbox by checkbox:

- [x] Cases 1 and 3 failed red against the unmodified code, then passed green after the guard was added.
- [x] Case 2 passed unmodified before and after — `poll.test.ts:575` untouched.
- [x] Case 4 passed only once the guard sat before `resolveWait` — confirmed by placing the read inside the same try/catch, strictly ahead of the `resolveWait` call.
- [x] Case 5 passed unmodified — `concludeReview` and its existing tests are unaffected.
- [x] Full daemon suite green: `npx vitest run src/daemon` — 1183 passed.
- [x] `npm run type-check` clean.

**What delivery must know.** No departures were recorded — the plan executed as written, with one placement detail (the try/catch scoping above) resolved inside the slice because it was a mechanical consequence of the plan's own placement instruction, not a deviation from it. Verification will want to re-examine PRD-03.R1 against this fix, per the plan's own note on that — whether that needs a fresh live gate or can be argued from this phase's tests plus the existing evidence is verification's call.
