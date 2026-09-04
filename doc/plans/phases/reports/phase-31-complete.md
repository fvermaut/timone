# Phase 31 — completion report

> **Plan:** [phase-31.md](../phase-31.md) · **Decision:** [ADR-0049](../../../adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
> **Requirements:** [PRD-02.R18](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r18--a-run-orphaned-by-a-crashed-daemon-is-reclaimed), [PRD-02.R14](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r14--conversation-channel-seam-with-terminal-takeover)
> **Built:** 2026-09-04, one session. **All fourteen slices done.** 1571 tests pass.

## What this phase set out to do

Seven open issues were one fault: a run's state was twenty fields of which one
was governed. A run had no holder, so nothing could tell a claim somebody was
holding from a claim nobody was; and a wait did not say what could end it, so a
run could park on a question nothing would ever answer.

## What is done

| Slice | State |
|---|---|
| 31a the holder, and whether it is alive | Done |
| 31b a run records who is holding it | Done, watched live |
| 31c the sweep asks the process | Done, watched live |
| 31d a dead holder is re-armed once | Done; the **first** death watched live, the second not |
| 31e a refusal is not a death | Done, unwatched |
| 31f the terminal asks the holder | Done, watched live |
| 31g the wait becomes one value | Done |
| 31h a wait says what can end it | Done, watched live |
| 31i a takeover reads what it recorded | Done, watched live |
| 31j giving up withdraws the request | Done, watched live |
| 31k a ticket closed while it waited | **Already fixed**; four cases added |
| 31l the register and the decision agree | Done |
| 31m the live gate | Done, and it found one fault |
| 31n close the phase | This report |

## The seven issues, and what is honestly owed on each

| Issue | What landed | Watched live? |
|---|---|---|
| [#78](https://github.com/fvermaut/timone/issues/78) a takeover that gave up is still handed the run | A claim records its owner (31b); giving up withdraws the request and detects losing the race (31j); the bound is 150s and says what it waited | **Yes**, gate check 2 |
| [#76](https://github.com/fvermaut/timone/issues/76) a takeover leaves a wait no stage can answer | The wait carries `resolvableBy` (31h); a takeover reads its own recorded outcome and stops the ticket asking (31i) | **Yes**, gate checks 5 and 6 |
| [#75](https://github.com/fvermaut/timone/issues/75) a refusal repeats for ever, then is reported as a death | A refused run is no longer swept as dead; refusals are counted without touching the liveness field; a refusal that does not clear is said once on the ticket after three cycles; a self-clearing one is never said (31e) | **No** — reaching it live means breaking the machine on purpose |
| [#63](https://github.com/fvermaut/timone/issues/63) a takeover's run is reclaimed under it | A live holder is never reclaimed (31c); the daemon claims on the terminal's behalf and records the terminal (31b); a run that moved under a takeover is said out loud (31i) | **Yes**, gate check 1 — but the outcome only, see below |
| [#27](https://github.com/fvermaut/timone/issues/27) you are asked to re-mark a broken ticket, and it does nothing | **Half.** The two sentences that asked for it now point at the command that works (31d). D7 — a failed run carrying a wait, answerable on the ticket — is **not built** | **No** |
| [#12](https://github.com/fvermaut/timone/issues/12) a job whose ticket was closed still starts | Nothing. It was fixed on 2026-08-15, the day after it was seen, and never closed. Four cases now hold it (31k) | **No**, and it is covered by tests that bite |
| [#11](https://github.com/fvermaut/timone/issues/11) a killed session is reported as still working | `timone status` asks the holder's process, which needs no daemon and no witness (31f) | **Yes**, gate check 3 |

**#63's watch is weaker than it looks.** The takeover was held 3m55s against a
2m00s window and was not reclaimed, which is the issue's outcome. But the
takeover's ticker keeps its heartbeat fresh, so the run never became a stale
candidate and the holder was never consulted. The mechanism is isolated by
check 3 instead, where the clock said alive and the pid said nobody.

## What the plan said that the tree did not support

Three of the plan's premises were wrong, and each is recorded where it was
found rather than worked around.

**31e — a refused spawn does not refresh the liveness field.** The plan said
`spawn` calls `setStage` before building the request, so eighty refusals kept a
run looking alive. It does not: `spawn` refuses above the stage loop, before
any store write. Probed against the real poll loop before a line was written.
What the code did instead was worse in a different way — after two minutes the
sweep reclaimed the run and told the ticket *"the machine running it stopped
before the work was finished"* while nothing had stopped. The plan's first case
stayed in the suite as a guard on the code this slice adds.

**31g — two of the five wait fields cannot go inside the wait.**
`consumedAnswerAt` and `reAsksAfterAnswer` must both outlive it: the marker
exists to survive `activate` and `fail`, which is the 2026-08-13 fault it was
added for, and the count accumulates across parks separated by activations,
which is ADR-0033's floor. Either of them inside the wait would be reset by the
transition it was added to survive. So it is three fields into one, not five,
and twenty fields become eighteen rather than sixteen. ADR-0049 D5 is amended.

**31h — #76's dead end is not made unreachable.** D6 says it stops being
reachable rather than being detected. `ivtrends` #58's wait *is* resolvable —
a person writing on the ticket ends it, and `writtenAnswer` reads exactly that.
What went wrong is that the human answered by doing the work in a takeover and
the takeover threw its own outcome away, which is 31i. The refusal of an empty
`resolvableBy` is a real guard and it is not what fixed #76. ADR-0049 D6 is
amended.

**31k — the issue was already fixed.** Its four cases pass against the tree
unchanged. The check landed on 2026-08-15 in 22b, one day after the issue was
seen, and nobody closed it. With the listing comparison disabled, two of the
four fail, so they are not vacuous.

## Decisions taken during the build

- **`holderLiveness`, not the plan's `isHolderAlive`** (31a). It does not
  return a boolean — a holder on another machine gets `unknown`, which the plan
  demanded as a third answer — and `lock.ts` already has a field of that name
  with the boolean meaning. `holderProcessIsAlive` keeps its name and its
  meaning for the lock, where `unknown` answers true.
- **The holder argument is optional** (31b). Two hundred test call sites pass a
  run id alone, and 31g already carried 367 test references of blast radius. A
  required argument would have spent that budget on a contract the type system
  cannot enforce at the one place that matters.
- **Only the `gone` path re-arms** (31d). A run judged dead by witnessed time
  alone keeps the ending phase 17 verified. Witnessed time is a well-founded
  inference; a pid is a fact, and ADR-0049 D4 says "provably gone".
- **`TRANSITIONS` is unchanged**, as the plan required. The re-arm is `active →
  failed → picked-up`, both moves the table already allows, applied as one
  write so the queue cannot promote another run into the gap.
- **`ParkOptions` keeps its flat field names** (31g). It is the write side and
  its shape is what a caller passes, not what the ledger holds.
- **A takeover that finishes its step does not work out the next stage** (31i).
  What follows a work stage is decided by `afterWorkStage`, which reads the
  branch. The run is parked with no kind of wait — the ledger's way of saying
  "carry on when you can" — and the stage then finishes through every check it
  already has. One more pass is the right price for not guessing.
- **Two sentences corrected** (31d), which ADR-0049 D7 requires while D7 itself
  is unbuilt: `failedComment` and `unclassifiedComment` both asked the reader to
  re-mark a ticket whose mark was already on.

## What is left

1. **Repeat the gate in a box.** Everything was watched `--runtime in-process`,
   because a boxed run refuses a Timone commit nobody has pushed and this
   phase's commits are local. Push, then run it again.
2. **The second death** (31d) and **a repeating refusal** (31e) are unit-covered
   and unwatched. Neither can be staged from outside without breaking the
   machine on purpose.
3. **ADR-0049 D7 is not built.** A failed run does not carry a wait, so an
   answer written on a broken ticket still re-arms nothing. #27 stays open on
   that half; what this phase did was stop the machine asking for a gesture
   that does nothing.
4. **R18 and R14 both re-enter verification** (31l). Neither is verified by
   this phase: the gate is evidence for a stage-7 pass to weigh, not the pass
   itself.
5. **[ADR-0050](../../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md)
   D1's condition is part-met.** It says Timone joins its own manifest once
   this phase is built *and watched working on a real run*. It was watched
   working on a real run — `scratch-app` #47, a real planning session, $0.85 —
   but in-process rather than boxed, and on a ledger copy. Whether that
   discharges D1 is fvermaut's to say.
