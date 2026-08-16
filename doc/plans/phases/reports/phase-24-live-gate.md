# Phase 24 — Live gate report

- **Date:** 2026-08-16
- **Plan:** [phase-24.md](../phase-24.md) — 24h
- **Status:** **PART ONE OF TWO. [timone#2](https://github.com/fvermaut/timone/issues/2) is observed and holds. [timone#1](https://github.com/fvermaut/timone/issues/1) is not observed at all**, and cannot be until a run genuinely hands back — see [what this gate could not reach](#what-this-gate-could-not-reach).
- **Cost:** **$0 in agent sessions.** No session was spawned; nothing was billed. This half of the gate is machinery, not judgement.
- **Never `ivtrends`**, ruled twice — and structurally impossible here: the gate daemon's manifest named one project and pointed it at a repository that does not exist.

## How it was driven, and the one place that differs from a real day

**The real daemon (pid 28774, up since 12:58, running pre-phase-24 code) was left alone throughout.** It still holds `.timone/state.json` and still polls both projects. Nothing in this gate stopped it, spoke to it, or wrote to its ledger.

The observations were made against a **second, real daemon** — the phase-24 binary, `node dist/cli.js daemon`, holding a **copy** of the ledger at `--state`, with a manifest naming `scratch-app` at a repository that does not exist. So:

- The lock, the daemon process, the commands and the request queue are all **the real thing**, and the interaction under test — a command that wants the ledger while a live daemon holds it — is exactly the one [timone#2](https://github.com/fvermaut/timone/issues/2) is about.
- The tracker is **unreachable by construction**, so no comment could be posted to any real ticket and no session could be spawned. That is the deliberate limit: **nothing here observes what a ticket says**, only what the ledger and the terminal do.

**`.timone/state.json` was hand-edited zero times and modified by nothing in this gate.** Checked by `md5` before and after: it changed only in `observedAt`, which the real daemon stamps every cycle, and all 28 runs are byte-identical — `scratch-app#10` still `failed`, `#13` still `failed`.

## What was observed

| # | Claim | Evidence |
| --- | --- | --- |
| 3 | `timone retry` runs while a daemon holds the ledger | **2.1s**, exit 0. *"timone daemon (pid 90217) has the ledger, so I've asked it to retry scratch-app #10 on its next pass. Watching for that."* → *"scratch-app #10 is re-armed at the point it stopped (planning)."* Ledger: `failed → picked-up`, failure cleared. |
| 4 | `timone cancel` runs while a daemon holds the ledger | **1.1s**, exit 0, and **the first time this command has ever run against a live daemon since it was built** — [finding 9 of phase 20](phase-20-live-gate.md) is closed in practice at last. Ledger: `cancelled`, carrying the reason typed at the terminal. |
| 5 | `timone takeover` is no longer refused by the lock | It reached its own resolution and answered about the **ticket** — *"scratch-app #4 is parked, but not on anything I can pick up in a conversation: the next stage to be built."* Yesterday the same command against a live daemon printed *"timone daemon (pid 71729) is already working this ledger."* |
| — | The command reports the **effect**, not the errand | Every one of the three named the holder first and then said what actually happened. None exited on *"asked the daemon"*. |
| — | The wait is **bounded**, and a stalled daemon is not a hang | The holder was frozen with `SIGSTOP` — alive, so the lock is legitimately held, but never polling. The command waited **75.2s exactly** and exited 1 on *"scratch-app #10 is still queued — the daemon hasn't taken it yet."* This is [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md)'s named residual risk, and it fails loudly rather than silently. |
| — | A request that cannot be carried out is **settled, not retried for ever** | On thaw, the queued second retry was refused — *"could not apply retry scratch-app#10 … is being worked on right now"* — and removed. The queue directory is empty; the next cycle re-attempted nothing. |
| — | The daemon stays the ledger's only writer | Every mutation above appears in the **daemon's** log as an `apply` line naming the pid that asked. No command wrote the ledger while the daemon held it. |

**One thing was found and it was mine, not the machine's.** The first attempt ran the gate daemon with an empty manifest; the retry was refused with *"I don't know a project called scratch-app. I look after: none."* Recorded because of how it failed: the command reported *"The daemon read the request and did not re-arm scratch-app #10 — it is still failed. Its log says why"* and exited 1. It did not claim success, and it did not hang. That is the honest-reporting path, exercised by accident before it was exercised on purpose.

## What this gate could not reach

**[timone#1](https://github.com/fvermaut/timone/issues/1) has no evidence here at all, and the reason is worth stating plainly: there is no handoff to look at, and one cannot be manufactured.**

`scratch-app` [#31](https://github.com/fvermaut/scratch-app/issues/31) — the fixture the fault was found on — **finished**: both chunks are `done`. Nothing else in the ledger is a handoff. And a handoff is not a state anything can be put into from outside: it exists only when a working session **decides** it cannot continue and posts the handed-back marker. There is no command for it, and writing one into `.timone/state.json` by hand is the thing every gate since phase 22 has refused to do.

So four of the seven steps stand unobserved:

- **Step 1 — the `carry on` reply resumes the stage that stopped.** The whole point of [ADR-0031](../../adr/0031-a-handoff-is-a-wait-not-a-failure.md), and the sequence that failed on 2026-08-16.
- **Step 2 — the ticket reads *"This one is waiting on you"* rather than *"Something went wrong"*.** Needs a real ticket and a reachable tracker; this gate had neither.
- **Step 6 — a takeover closed uncleanly gives back its claim.** Needs a run parked on a conversation to claim; the ledger holds none. **This is [ADR-0032](../../adr/0032-a-human-command-asks-the-daemon-to-act.md)'s own named failure mode** — a claim outliving its session is [phase 14](../phase-14.md)'s stuck run — and it is currently proven by unit tests alone.
- **Step 7 — a queued ticket waits behind a parked handoff, and is promoted when it is cancelled.** The cost and the escape in one observation. Needs a handoff.

**The new code is not live.** The running daemon started at 12:58 on pre-phase-24 code, and a running daemon keeps the code it started with. Until it is restarted, no handoff anywhere will park — it will fail, exactly as before.

## The honest reading

**Issue #2 is fixed and watched.** Three commands that were refused yesterday all run today, the daemon remains the single writer, and the two ways this design could have gone wrong quietly — a silent hang, and a request retried for ever — were each provoked and each behaved.

**Issue #1 is fixed in argument only.** 965 green tests say the park happens, the cursor is right, and the reply resumes the stage that asked. Phase 23 shipped 932 green tests and its gate found seven defects none of them could see, which is the exact reason this section exists rather than a claim that both issues are done.
