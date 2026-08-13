# Phase 19 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 19a — one writer, and it says who holds it

**Built.** The run ledger now has an exclusive lock, and only the process holding it may write. A second `timone daemon` — the `--once` typed while the first is still inside a session, which is the shape that bought two agent sessions for one written answer — prints one plain sentence naming the holder (`timone daemon (pid 4213) is already working this ledger — it took it at …`) and exits non-zero, having started nothing. `timone takeover` and `timone retry` take the same lock for the same reason: both spawn sessions, and both were racing the daemon. A lock is given back on every ordinary exit, on the throwing path, and on `SIGINT`/`SIGTERM`.

A holder that crashed does not wedge its project, and a holder that is merely busy is not robbed: **a lock is broken when, and only when, the process it names is gone** ([ADR-0025](../../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)). The staleness window survives as a cheap first filter — a holder that touched its lock moments ago is not asked about at all — and stops being the authority. So a daemon two hours into a session, and a daemon on a laptop that was shut, are both refused however long they have been quiet, because their processes still exist; and a daemon killed at the terminal is reclaimed on the next start, which says whom it took the ledger from. **Nothing on any path through acquisition reads or writes `state.json`**: acquisition touches the lock file beside it and nothing else, so a refused process no longer mutates the ledger it was just refused. The unit surface is untouched: `pollOnce` takes no lock and needed no change, because the lock is on the process, not on the cycle.

**Files touched.**

- `src/daemon/lock.ts` — created. `acquireStateLock` / `withStateLock` / `releaseHeldLocks` / `stateLockPath` / `holderProcessIsAlive` over a lock file beside the state file (`.timone/state.json.lock`, already gitignored). The holder record carries what a refusal must say (`command`, `pid`, `since`) plus `observedAt` — its last sign of life — and a `token` identifying the particular hold. Liveness is a `isHolderAlive?: (holder) => boolean` on the request, defaulting to `holderProcessIsAlive`.
- `src/daemon/lock.test.ts` — created. Nine cases at the module's public surface.
- `src/commands/daemon.ts` — `RunDaemonOptions.statePath` added; `runDaemon` holds the lock across the whole loop via `withStateLock`, touches it after each cycle, logs a reclaim when it took the ledger from a dead holder, and returns 1 with the refusal's sentence when it cannot have it. The poll loop moved into a private `poll()` so the locked and unlocked shapes are one body. The command's action passes `statePath` and registers `SIGINT`/`SIGTERM` handlers that call `releaseHeldLocks()`. The `UNWITNESSED_POLL_INTERVALS` import is gone — it existed only to build the lock's witness.
- `src/commands/daemon.test.ts` — two cases added; the clocked-store helper now also hands back its state path.
- `src/commands/takeover.ts` / `takeover.test.ts` — `TakeoverDeps.statePath`; `runTakeover` wraps the whole takeover, interactive session included, in `withStateLock`. One case added.
- `src/commands/retry.ts` / `retry.test.ts` — `RetryDeps.statePath`; `runRetry` stays synchronous and acquires/releases around its body in a `try/finally`. One case added.

**Decisions taken inside the slice.**

- **The reclaim path was rebuilt onto ADR-0025 after the original witness design was found unbuildable.** An earlier context built 19a as first planned — the reclaim gated on `RunStore.witness` (ADR-0020). The build is what exposed the flaw: `witness()` ends in `this.persist()`, so *consulting* the evidence writes the file the lock protects. Two faults followed, both reproduced at the real defaults: a refused process mutated the ledger, and repeated refusals accumulated a continuous watch that earned the right to break a **live** daemon's lock in three `--once` starts a minute apart. fvermaut ruled on 2026-08-13 and ADR-0025 records it. **The witness is not consulted, not stamped, and not required anywhere in `lock.ts` or in `daemon.ts`'s acquisition.** ADR-0020 is untouched for *runs* and still governs them through `poll.ts`. This paragraph exists because a handoff describing the superseded design would mislead 19b and stage 7 about what is in the tree.
- **Liveness is injected, and the whole judgement is the probe's.** `isHolderAlive?: (holder) => boolean` receives the entire holder record, not a pid, because identity is the pid *together with* what the lock recorded (ADR-0025) and a caller with a better identity oracle must be able to use it. It is injected because a test cannot portably manufacture a dead pid: any number it picks may be live on the runner's machine, and a case asserting against whatever the pid table happens to hold asserts nothing.
- **The default probe is `process.kill(pid, 0)`, and `EPERM` reads as alive.** Signal 0 sends nothing; it asks the OS whether the pid exists and whether this process may signal it. `EPERM` means *alive and somebody else's* — reading it as death would let an unprivileged rival break a root daemon's lock. The recorded `command` is a human-facing label (`timone daemon`), not an OS command line, so there is nothing in `ps` output it could honestly be compared against; **pid reuse inside the staleness window therefore stays a bounded residual risk**, exactly as ADR-0025 accepts, and the seam to refine it is the injection point.
- **The window is checked before the probe, never after.** It is a filter, not a second authority — two rules deciding one question drift apart. Asserted by counting probe calls rather than argued.
- **`takeover` and `retry` reclaim on the same evidence a daemon does.** The superseded design withheld reclaim from them because only a poll loop recorded a witness; under ADR-0025 the question is one anybody can ask the OS, and there is no reason to withhold the answer. `retry` above all: it is the route back from a session that died holding the ledger, so being refused by the corpse of the daemon that died holding it would be the phase-14 fault returning under a new name.
- **A `token` per hold**, so a process whose lock *was* reclaimed cannot delete the reclaimer's lock on its way out — that would have handed the ledger to a third writer silently.
- **Refusals return, the work's own errors throw.** Per `standards/typescript.md`: acquisition failure is a domain failure (`{ ok: false, error }`); anything the wrapped work throws is re-thrown *after* the lock is back.
- **Creation is an exclusive create (`wx`), rewrites go through temp+rename** like `RunStore.persist`, so two processes starting in the same instant cannot both decide the ledger is free, and no reader ever sees half a lock.
- **A lock file that cannot be read is refused, not overwritten** — "delete it if no timone process is running". Overwriting a file it cannot read would be a process deciding on no evidence that nobody is there. This branch has **no test**: it is outside the plan's declared seams, and I did not add tests the plan did not declare.

**Validation evidence.**

The five pre-existing seams were left standing and re-run, not re-driven. The two superseded reclaim cases (*…when the witness vouches for the silence*, *breaks nothing across a gap nobody watched*) were deleted with the design they tested. The five amended cases, red→green, one at a time:

1. *reclaims a crashed holder's lock, and says whom it took it from* — **red**: `AssertionError: expected false to be true` at `lock.test.ts:174` (the witness gate refused, there being no witness). Removed the witness gate so a lock quiet past the window is reclaimed. **Green** (5/5). Note the implementation at this point consulted nothing about the process — which is the defect the next case pins.
2. *refuses a quiet holder whose process is still running, however long the silence* — **red**: `AssertionError: expected true to be false` at `lock.test.ts:205` — the implementation broke a live holder's lock, which is ADR-0025's fault reproduced in a unit test. Added `isHolderAlive`, its `process.kill(pid, 0)` default, and the gate. **Green** (6/6). Same holder, same ten minutes of silence, same threshold as case 1: only the process table differs, and it is what decides. **This is the case the slice exists to get right.**
3. *reclaims from a pid the OS handed to something else* — **green on arrival**, honestly: identity is the probe's business, so this shares its branch with case 1 and no red could be manufactured for it without writing an implementation nobody would write. Proved non-vacuous by two mutations, pinning both directions. (a) Never reclaim (`if (true)` in place of the liveness gate) → cases 1 and 3 fail, case 2 passes: case 3 does assert a reclaim. (b) Probe with the command stripped (`alive({ ...existing, command: "" })`) → **case 2 alone** fails with `expected true to be false`: the recorded `command`, not just the pid, genuinely reaches the probe, which is what makes case 3 expressible at all. Both reverted.
4. *asks nothing about a holder still inside the quiet window* — **green on arrival** (the window check returns before the probe). Proved non-vacuous by mutation: hoisted the liveness call above the window check → this case failed with `AssertionError: expected 1 to be +0` on the probe counter, and *refuses a second acquisition …* failed with it. Reverted.
5. *writes nothing to the ledger on any path through acquisition* — **green on arrival** (the witness plumbing was already out). This is the assertion the amendment exists for, so it was proved non-vacuous against the real defect rather than a synthetic one: the fixture is a genuine ledger built through `RunStore` with an active run in it (`before.bytes.length` is asserted non-zero, so "unchanged" cannot be trivially true), and the mutation **restored the superseded design verbatim** — `RunStore.open(request.statePath).witness({…})` at the top of `acquireStateLock`. It failed at `lock.test.ts:317`, the **refusal** comparison, before the reclaim one, with the ledger's bytes rewritten:

```
-   ],
+   ],
+   "observedAt": "2026-08-13T18:00:08.710Z",
+   "observingSince": "2026-08-13T18:00:08.709Z"
-   "modifiedAtMs": 1786644008709.734,
+   "modifiedAtMs": 1786644008710.2607,
```

Reverted. A refused process writing to the ledger it was refused is now a failing test, not a paragraph.

The three command-level cases the earlier context drove red (`daemon`, `takeover`, `retry` each refused while another holds the ledger, each `expected +0 to be 1` before wiring) are unchanged in behaviour and still green; their comments were corrected where they cited the witness.

Validation block, as written in the plan:

- `npx vitest run src/daemon/lock.test.ts src/commands/daemon.test.ts src/commands/takeover.test.ts src/commands/retry.test.ts` → **4 files, 42 tests, all passing**.
- `npm run type-check` → **clean, no output**.
- `npm test` → **21 files, 675 tests, all passing**, in 35.6s. Baseline `main` is 662 across 20 files; this slice adds one file and 13 tests. No failure I did not cause, and the phase-18 intermittent did not appear in any of the runs.

Per checkbox:

- **A second writer is refused, and the refusal names the holder** — PASS. Proved at the module and at all three commands, each asserting the holder's command and pid in what the human is shown.
- **The lock is released on the throwing path, asserted before the happy path** — PASS. Unchanged from the earlier build; the throwing case precedes the returning one in the file and in execution order.
- **A crashed holder's lock is reclaimable, and a live holder's is refused however long it has been quiet** (as refined) — PASS. Cases 1 and 2, identical but for the process table.
- **The quiet window never probes liveness, and no acquisition path writes `state.json` — both asserted, not argued** — PASS. Case 4 counts probe calls; case 5 compares the ledger's bytes and mtime across a refusal and a reclaim, and fails against the real superseded implementation.
- **`pollOnce` still runs untaken, so no test needed a lock to keep passing** — PASS. Asserted directly in `daemon.test.ts`, and no test outside the four files in the block changed: `poll.test.ts`, `session.test.ts` and `runs.test.ts` are untouched and green.

**What 19b must know.**

- **The keep-alive hazard the earlier build flagged is discharged, not inherited.** `runDaemon` still touches the lock once per cycle, so a daemon inside a two-hour session still has an `observedAt` two hours old — but that no longer costs it anything, because a rival that gets past the window is then refused by the process probe. `touch()` is now a cheap tick that saves a probe, not a defence. **19b does not need to find a place to say "still here"**, which the earlier handoff asked it to consider.
- **`statePath` is optional on all three entry points**, and absent means no lock. Every production wiring passes it; the cycle-arithmetic tests do not, which is exactly what keeps them (and `pollOnce`) untaken. Do not make it required without re-reading those tests — the optionality is load-bearing for the "unit surface unchanged" checkbox, not laziness.
- **A takeover holds the lock for the whole interactive session.** That is ADR-0023's decision, not an oversight: while a human is in a takeover conversation, the daemon cannot start. If 19e's live gate wants both, the daemon has to be stopped first — and the refusal says so by naming the holder.
- **19e step 4's observation changed with the design** (ADR-0025 records this): kill the daemon holding the lock and confirm a fresh daemon reclaims and names whom it took it from; then confirm a *live* holder's lock is refused, which is now checkable directly instead of by manufacturing a witness gap.
- **`withStateLock` re-throws**, so a caller wanting an exit code from a failing cycle must keep its own `try`. `runRetry` uses `acquireStateLock` + `finally` directly rather than the wrapper, because it is synchronous and making it async would have churned seven existing tests for no behavioural gain.
- **Deferred to the delivery review** (refactoring is not this stage's): the acquire-or-refuse body of `runTakeover`/`runRetry`/`runDaemon` is the same three lines three times — log the refusal, return 1 — and is the duplicated *decision* `standards/code-smells.md` names; a `lockedCommand` helper would hold it once. Also, `lock.ts` carries both the lock mechanism and the refusal prose, and the prose is what 19f's docs will want to quote.
