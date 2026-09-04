# Phase 31 — live gate

> **Plan:** [phase-31.md](../phase-31.md), sub-phase 31m · **Decision:** [ADR-0049](../../../adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
> **Run:** 2026-09-04, 17:30–17:52 UTC, on `scratch-app`. Never `ivtrends`.

## How it was set up

A real `timone daemon`, driven against a **copy** of the ledger with `--state`.

- `.timone/state.json` was copied to a gate directory before anything ran. Its
  md5 was `cca5f2612437ce138108a68c7e1f6e67` before the gate and
  `cca5f2612437ce138108a68c7e1f6e67` after it. The real ledger was not opened
  by anything in this gate.
- The daemon was given a **manifest of its own containing `scratch-app`
  alone**. There is no per-project flag, and a daemon started on the real
  manifest would have polled `ivtrends` — a client project that is being
  built. The manifest is the only thing that keeps it out.
- Nothing was left running: the daemon (pid 12020) and the takeover (pid
  12475) are both stopped, and `pgrep` finds no `timone daemon`.

**Two limits on the instrument, named rather than implied.**

**The gate ran `--runtime in-process`, not in a box.** A boxed run downloads
Timone from GitHub and refuses a commit nobody has pushed (30k), and this
phase's twelve commits are local. So the sessions ran on this machine, in
`projects/scratch-app`, which is what phase 30 removed. That checkout was
`main` with an empty `git status` before the gate and is `main` with an empty
`git status` after it.

**Checks 1, 3 and 4 used a stand-in for the conversation program.** `timone
takeover` runs `claude` in the terminal; a session that sits for four minutes,
or one that finishes a step, is not something this context can drive. What
those checks are about is the **claim** and the process holding it, and both
were real throughout: a real `timone takeover`, a real pid, a real holder
written to the ledger by the daemon. What that process was running is not a
question the sweep asks. Check 4's stand-in additionally posted the outcome a
finished session would have posted, machine-typed and deleted from the ticket
as soon as the check was read (comments `5544394371` and `5544419220`, both
gone).

## What was watched

### 1. A takeover is not reclaimed under a live conversation — [#63](https://github.com/fvermaut/timone/issues/63)

`timone takeover scratch-app#47` at 17:35:08, with the daemon holding the
ledger. The daemon carried out the request on the terminal's behalf and — this
is the part that matters — recorded **the terminal** as the holder, not itself:

```
"command": "timone takeover scratch-app#47", "pid": 12475,
"since": "2026-09-04T17:35:17.646Z", "host": "MacBeast.local"
```

The claim was held until 17:39:12 — **3m55s**, against a staleness window of
2m00s — and the daemon reclaimed nothing.

**This confirms the outcome and does not isolate the holder.** The takeover's
ticker stamps a heartbeat every 30 seconds, so the run never became a stale
candidate and `store.hold` was never consulted. The mechanism is isolated by
check 3 instead, and by the reclaim below.

### 2. A takeover that gives up leaves nothing behind — [#78](https://github.com/fvermaut/timone/issues/78)

The daemon was frozen with `SIGSTOP` at 17:30:44 (`ps` state `TN`). `timone
takeover scratch-app#47` ran from 17:30:52 to 17:33:24 and said:

> `timone daemon` (pid 12020) has the ledger, so I've asked it to hand
> scratch-app #47 over on its next pass. Watching for that.
>
> scratch-app #47 is still queued. I waited **2m30s** and the daemon didn't get
> to it — a cycle takes as long as whatever it is running, so that is not a
> fault. **I've taken the request back**, so nothing will happen behind you.

At 17:33:33 the requests directory was **empty** and the run was `parked` with
no holder. The daemon was thawed at 17:33:33 and, 45 seconds and a cycle later,
had still done nothing to the run — which is the whole of the issue: before
this, the request stayed on disk and the run was handed minutes later to a
terminal that had gone.

The 2m30s is the corrected bound. The old one was 75s.

### 3. A killed session stops reading as working — [#11](https://github.com/fvermaut/timone/issues/11)

The takeover process was killed with `SIGKILL` at 17:39:12 and the daemon
stopped three seconds later. At 17:39:24, with **no daemon running**, and with
the run's heartbeat **11 seconds old**:

```
scratch-app  #47 (step 2 of 3 of #45) (preparing the work) —
  nobody is running this any more — I'll start it again on my next pass
```

**This is the observation that isolates the holder.** The clock said the run
was alive — the heartbeat was seconds old — and no daemon existed to have
witnessed anything. The pid was the only evidence available, and it was enough.
Before this phase the same state read *"working on it now"*, for ever.

### 4. A dead holder is put back to work — ADR-0049 D4, [R18](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r18--a-run-orphaned-by-a-crashed-daemon-is-reclaimed)

Not one of the four the plan listed, and the one that shows the sweep asking the
process rather than the clock. A cycle at 17:42:06:

```
re-arm scratch-app#47/1 — timone takeover scratch-app#47 (pid 12475) is gone,
       so it goes again at planning
```

The run went back to `picked-up` at `planning` with its branch intact, carrying
one death — *"the machine running it stopped before the work was finished"* —
and **nothing was posted on the ticket**, which is ADR-0034's rule that a
machine that broke is not the ticket's business while it still has a way
through. The daemon then spawned a real session for it (`claude-sonnet-5`,
2m44s, $0.85), which planned, could not proceed, and handed back.

**One thing the re-arm does not do, and it is worth knowing.** The holder
question is asked only of runs that have *also* gone quiet: a cycle at 17:40:34,
89 seconds after the holder died, reclaimed nothing, and the re-arm happened on
the next cycle past the two-minute window. The sweep narrows what may be
reclaimed; it does not widen it. `timone status` is the surface that answers
immediately, which is check 3.

### 5. A wait says which stage can end it — 31h

The handback that session wrote, read straight out of the gate ledger:

```json
{"on": "your answer to the question in my last comment.",
 "kind": "conversation", "opened": "2026-09-04T17:44:49Z",
 "resolvableBy": ["planning"]}
```

And a wait written before this phase, folded on load from the real ledger's own
`waitingOn`/`waitingKind`/`waitCursor`, came back in the same shape with
`resolvableBy: ["planning"]` supplied by the normalisation.

### 6. A step finished under takeover moves — [#76](https://github.com/fvermaut/timone/issues/76)

With the run parked on that handback, a takeover whose session recorded a
finished step ended with:

> scratch-app #47 has the step you finished recorded against it, so it stops
> asking. I'll carry it on from there on my next pass.

The run kept its stage and its branch, and its wait lost its kind — the
ledger's way of saying nobody is being waited on. Before this, `releaseClaim`
restored the old wait cursor and all, and `ivtrends` #58 went on asking a
person for an answer they had given by doing the work.

## What the gate found

**One fault, and it was fixed and re-watched.** The first run of check 6 left
`timone status` reading:

```
#47 (preparing the work) — waiting on you: nothing — I'll carry on from where
you left it.
```

That is [#14](https://github.com/fvermaut/timone/issues/14)'s
self-contradicting sentence in a new place. 31f's fix could not catch it: it
follows the shared calculation's answer, and the calculation was answering
`true`, because a run handed back to the machine falls into the branch for a
run stopped for want of machinery — right for that case, wrong for this one.

Fixed at `7d2d7ce`: the words are an exported constant, `CARRY_ON_WAIT`, for
the same reason `ESCALATION_WAIT` is one, and `ctaFor` recognises it. Re-run
against the fixed build on the same run at 17:52:07:

```
#47 (preparing the work) — nothing right now — I'll pick it up again on my
next pass.
```

A regression test was added with it.

## What this gate could not reach

- **The second death, and the park that follows it.** ADR-0049 D4's second
  half needs a holder to die twice with work on a branch, and the second death
  cannot be staged from outside — the first one was only reachable because a
  takeover is a process this context can kill. Phase 24's gate refused to
  hand-write `state.json` for the same reason and this one refuses too. Unit
  cases cover both deaths and the park; nobody has watched the second.
- **A refusal repeating and then being said** (31e, [#75](https://github.com/fvermaut/timone/issues/75)).
  Reaching it live means a spawn the daemon cannot satisfy, three cycles
  running, which means breaking the machine on purpose. Unit-covered, unwatched.
- **A boxed run.** Everything above ran `--runtime in-process`, because the box
  refuses a Timone commit nobody has pushed. The whole gate should be repeated
  once this phase is on `main`.
- **Check 1's isolation.** As recorded above, the live takeover was protected
  by its heartbeat as much as by its holder, so #63's mechanism was watched
  working and was not watched *alone*.
- **A real conversation.** Three of the checks used a stand-in for `claude`.
  What a person sees inside a takeover is unchanged by this phase, but nobody
  sat in one.
