# Phase 17 — 17c live gate: observations

> Closes [sub-phase 17c](../phase-17.md). Everything below was observed against a **continuously running** `timone daemon --interval 30 --progress-interval 30` — a real process, a real ledger on disk, real cycles thirty seconds apart. Not `--once`, because what is under test is what happens *between* cycles.

> **Run autonomously on 2026-08-08 at fvermaut's instruction** — *"can you just do it autonomously? I don't want to spend time in this"* — after he pushed back on the gate as originally specified, which asked him to schedule an evening and spend money on a real pipeline run. **The pushback was right and the plan was wrong.** Steps 1–3 read nothing but the ledger's own timestamps, so they need no agent session at all; the specified ceremony was buying nothing. Steps 4 and 5 do need one, and are **not** discharged here — see the bottom.

## The fixture, and what it costs the evidence

**An isolated ledger and a project that does not exist.** The manifest declares one project, `gate-fixture`, whose `repo_url` points at a repository that has never existed. The state file is a throwaway under the scratchpad; **the live `.timone/state.json` was never opened**, and `scratch-app` was never touched.

That choice does two things at once. It makes every ticketing call fail harmlessly — so no ticket was commented, no session was ever spawned, and the gate cost nothing — and it makes the failure the *safety mechanism*: `listMarkedTickets` throws before `pollProject` can reach the spawner, which is what guarantees a `picked-up` run in the fixture could not start a real agent session by accident.

**What it leaves open, stated rather than implied.** The reclaim path's *comment* on the ticket could not be exercised, because there was no ticket. That half is covered by unit tests and was observed live at [14g](phase-14-live-gate.md) on a real crash; it is not re-proven here, and R18's register entry says so.

**A seeded run is the same shape a real one is** — `active`, a claimed branch, a stage, a session id, and a `heartbeatAt` stamped by a ticker on the same twenty-second cadence the real progress tick uses. The code under test cannot tell the difference, because everything it reads is in that record.

## Step 1 — the machine stops, and the daemon declines to judge: **observed**

**The instrument: a `SIGSTOP` of the daemon and its ticker together**, held 150 seconds, then `SIGCONT`. [15a recorded this instrument as having failed](phase-15-clock-investigation.md) — and recorded precisely *why*, which is what makes it usable here. It failed for the **SDK-clock** question, because `mach_absolute_time` advances across a freeze and so a freeze cannot distinguish a sleep-excluding clock from a sleep-including one. Its valid conclusion, in 15a's own words, is *"about the tick, not the SDK: it independently confirms that `setInterval` does not fire while the process is not running, and that wall-clock elapsed keeps advancing across it."*

**Those two properties are exactly and only what the witness reads.** The witness compares two persisted wall-clock timestamps and asks whether a cycle fired between them. A freeze reproduces both faithfully. This is the instrument being verified before its output is believed, for the third phase running.

```
21:29:22  ---- seeded a LIVE run, heartbeat fresh
21:29:22  witness not judging — no daemon has observed this state file before, so every run gets one fresh window
21:29:53  witness not judging — watching for 31s of the 2m it would have to vouch for
21:30:23  witness not judging — watching for 1m of the 2m it would have to vouch for
21:30:54  witness not judging — watching for 1m of the 2m it would have to vouch for
21:31:53  ---- CONTROL: daemon is now mature and the run is alive. status=active
21:31:53  ---- FREEZING both (SIGSTOP) — nothing is scheduled from here
          ← 150 seconds. Five cycles due at :32:23, :32:53, :33:23, :33:53, :34:23.
          ← The log is empty across all of them. Not one fired.
21:34:23  ---- RESUMING both (SIGCONT) after 150s frozen; heartbeat is now 161s old, threshold is 120s
21:34:23  witness not judging — nothing was watching for 2m, so no run's silence over it is evidence of anything
21:34:54  witness not judging — watching for 31s of the 2m it would have to vouch for
21:35:25  witness not judging — watching for 1m of the 2m it would have to vouch for
21:35:38  ---- AFTER WAKE: status=active
```

**The control line at 21:31:53 is what makes the rest mean anything.** By then the daemon had watched unbroken for 2m06s — past the window — so it was entitled to judge and was choosing not to reclaim because the run was healthy. The freeze changed exactly one thing: whether anybody was listening.

**On resume the run was, by the ledger's own arithmetic, stale.** Its heartbeat was **161 seconds old against a 120-second threshold**. `staleRuns` is unchanged by this phase and names that run; a unit test asserts it does. **Under [ADR-0017](../../../adr/0017-a-runs-liveness-is-its-heartbeat.md) this run is dead at 21:34:23 and its branch is abandoned.** It was not, and the daemon said why in one line.

Then the watch rebuilt itself — 31s, 1m — and the run stayed `active`, because the ticker resumed stamping on wake exactly as a real session does.

**The limit, stated plainly: this was a frozen process, not a suspended machine.** Nobody has yet watched this daemon across a real macOS sleep. What closes that gap is not an untested assumption but a *separate measurement already taken*: [15a's `pmset` reading](phase-15-clock-investigation.md) of the same laptop — 146 suspensions in one night, median 889s, 113 of them past the threshold — is the evidence that real sleep produces gaps of this shape. The chain is two measured links, not one measured and one assumed. **The residual is whether macOS's suspend differs from a freeze in some way neither measurement would show**, and one lid-close closes it.

## Step 2 — reclaim still fires, with the machine awake throughout: **observed**

Run first, and the ordering is not cosmetic. **A change that merely stopped reclaiming would have passed step 1 and been catastrophic.** This is [15e's discipline](phase-15-clock-investigation.md) applied to a new mechanism.

A separate seeded run, last alive ten minutes earlier, against a daemon started fresh and awake for the whole test:

```
21:25:47  witness not judging — no daemon has observed this state file before, so every run gets one fresh window
21:26:20  witness not judging — watching for 33s of the 2m it would have to vouch for
21:26:51  witness not judging — watching for 1m of the 2m it would have to vouch for
21:27:21  witness not judging — watching for 1m of the 2m it would have to vouch for
21:27:52  reclaim gate-fixture#1 — the machine running it stopped before the work was finished
```

The ledger after it: `status: failed`, the plain reason recorded, branch and stage intact. Then:

```
$ timone retry gate-fixture#1
gate-fixture #1 is re-armed at the point it stopped (execution).
→ status: picked-up | stage: execution | branch: timone/1-gate-fixture | failure: undefined
```

**Reclaim fires, the run is failed with a reason a human can read, the project is freed, and `timone retry` re-arms it at the stage it stopped with its branch kept.** The one link not exercised is the ticket comment, for the reason given above.

## Step 3 — the delay is bounded: **observed**

Visible in both traces without a separate test. Reclaim at 21:27:52 came **2m05s after the watch began at 21:25:47** — one staleness window, not never. The decline is a deferral with a deadline, and the countdown is printed on every cycle.

The same property holds after a wake: at 21:34:54 and 21:35:25 the daemon is visibly rebuilding toward the window rather than sitting in a permanent refusal. Had the run's ticker not resumed, the cycle at ~21:36:25 would have reclaimed it.

## A defect the gate found, and a consequence it exposed

**Defect — a log line that told an operator two different things in the same words.** The first run of the built binary, before any of the above, produced this from two cycles a tenth of a second apart:

```
witness not judging — nothing was watching for 0s
```

Which is false twice: something *was* watching, continuously, and "0s" is not why it declined. Three distinct refusals — never observed before, an absence, and an unbroken watch too young — had been collapsed into one message. **A line an operator knows to be nonsense is a line they stop reading, and this is the line the whole gate turns on.** Fixed in `3f7d7a7`, and it is why `Witness` carries `watchedMs` and `unwitnessedGap` rather than `mayJudge` alone. **No test would have caught it**, because every test asserted behaviour and this was a defect in explanation.

**Second, smaller, same family.** The gate log above shows `1m` on two consecutive cycles — 1m03s and 1m34s rendered identically — which reads as a daemon stuck rather than one counting up. The formatter now matches the progress line's own shape, confirmed live after rebuilding:

```
witness not judging — watching for 32s of the 2m00s it would have to vouch for
witness not judging — watching for 1m03s of the 2m00s it would have to vouch for
witness not judging — watching for 1m35s of the 2m00s it would have to vouch for
```

That change post-dates the traces above and is cosmetic; the decline-and-reclaim behaviour they record is unaffected.

**A consequence, not a defect, and it should be written down before somebody discovers it as a surprise.** 15a measured the overnight cycle at ~45s awake per ~15m49s asleep. At a 60-second poll interval that means **at most one cycle per wake window, and consecutive cycles ~15m apart — every one of them an unwitnessed gap.** So on a sleeping laptop the daemon will decline to judge on essentially every overnight cycle. Healthy runs are therefore safe, which is the point; but **a genuinely dead run will not be reclaimed until the machine is properly awake.** That is the conservative direction and strictly better than today's behaviour of killing everything, and it is a real change in what "reclaim" promises overnight.

## Steps 4 and 5 — **not discharged**

Both need a real agent session, which this gate deliberately did not buy.

- **Step 4, the two clocks read side by side on a session spanning a suspend.** The labels are proven by unit test and rendered against 15a's own numbers (`4h13m elapsed` beside `19m30s working`), but no live session has printed them.
- **Step 5, the token counter measured against `modelUsage`.** Untouched. It is the half of R17 that has been unexplained since 14g — 4.7k frozen for four hours with no sub-agents in play — and nothing here bears on it.

**Therefore R17 does not close**, exactly as [the plan required of itself](../phase-17.md): *"R17 closes only if 17c's gate shows the token counter accurate on the sessions it observes; otherwise it stays `draft` with the token half named as the remainder."* Both steps ride along free on the next real ticket that reaches a long stage.

## Human gate

**Not obtained, and it should not be read as obtained.** fvermaut delegated the running of this gate; he has not seen its evidence. The overnight prohibition has been rewritten to match what is now proven rather than struck outright — see [STATUS.md](../../../../STATUS.md) — and the one judgement made on his behalf is named there so he can reverse it in a word.
