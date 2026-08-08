# ADR-0017: A run's liveness is its heartbeat

- **Status:** superseded by [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md)
- **Date:** 2026-08-06
- **Source:** grill session of 2026-08-06, on the open question carried out of [phase 13](../plans/phases/phase-13.md): "a crashed daemon has no recovery path"

## Context

`timone retry` re-arms a **failed** run at the stage it failed. It refuses everything else, deliberately and by name — a `parked` run is waiting on the human, a `done` run is history, and an `active` run *"is being worked on right now. There is nothing to retry."*

That last refusal is a lie whenever the daemon died. A process killed mid-session — SIGKILL, OOM, a closed laptop — leaves its run `active` in `.timone/state.json` forever. The ledger's transition map has no edge out of `active` except by the daemon that owned it, and that daemon is gone. Worse than the stuck run: an `active` run **holds its project**, so every other ticket on that repository queues behind a corpse indefinitely. Nothing detects it, nothing reports it, and the only way out is hand-editing the state file — the exact practice `timone retry` was built to end.

The ledger has nothing to distinguish a corpse from a healthy run. There is **no pid, no lease, no lock** anywhere in `RunStore`; `open()` reads a file and writes are atomic temp-and-rename. `updatedAt` cannot separate them either: a run stays `active` from `store.activate()` until the whole stage returns, so a legitimately slow execution session — and execution sessions are the long ones — is byte-for-byte indistinguishable from one whose process died an hour ago.

Nothing prevents two daemons running at once, either. Both would `open()` the same file and clobber each other last-write-wins. That is a pre-existing hazard, but it constrains the fix: any rule of the form *"on startup, every `active` run must be dead"* would reclaim a second daemon's live session and set two agents loose on one branch — the collision the serialization rules exist to prevent.

The alternatives considered:

- **Startup sweep.** On boot, fail every `active` run. Simplest possible change, no schema field. But it is an *assumption* about the world rather than evidence about a run, it is wrong the moment two daemons exist (so it owes a pid lockfile), and it detects nothing while a daemon keeps running — a session that dies on its own stays invisible until the next restart.
- **`timone retry --force`.** The human declares a run dead. Smallest change, human in every reclaim. But the project stays blocked until somebody notices, which is precisely what an unattended daemon cannot rely on; "the daemon has no recovery path" would remain true wherever it matters.
- **A dedicated lease** — pid, host and expiry written on the run, refreshed by a timer of its own. Correct, and a second timer doing what an existing timer could do.
- **The progress heartbeat, doing double duty** (chosen).

The deciding fact is that a ticker already exists. The same grill settled that the daemon prints a throttled progress line every ~30s while a session runs, because today there is total silence between "session started" and the next stage line. That ticker fires if and only if the daemon is alive and driving that session — which is the definition of the liveness signal the ledger lacks.

## Decision

**A run carries `heartbeatAt`, stamped by the progress ticker, and staleness is the evidence that reclaims it.**

- **One tick, two jobs.** Each progress tick both prints its line and stamps `heartbeatAt` on the run. No second timer, no second concept: the thing that proves to the human that work is happening is the same thing that proves it to the ledger.
- **Staleness is evidence, not assumption.** A run is orphaned when its status is `active` or `picked-up` **and** `heartbeatAt` is older than four intervals (two minutes at the 30s default). A live session keeps stamping, so a second daemon's work is never reclaimed; a SIGKILLed one stops stamping instantly, so its work always is. The rule needs no knowledge of how many daemons exist, which is the property the startup sweep could not have.
- **A reclaimed run is failed, never resumed automatically.** It is marked `failed` with a plain reason, the existing `failedComment` goes on the ticket, and the project is released so the queue promotes. `timone retry` — already built, already proven live three times — is the way back. The daemon does not re-enter the stage by itself.
- **`--progress-interval` is a correctness setting, not a cosmetic one.** It sets both the print cadence and the staleness threshold. This is the coupling's price and it is stated here so nobody later "tidies" the interval without knowing what else moves.

## Consequences

- The stuck-`active` hole closes for the case that actually happens — the machine dying — with one optional schema field and no new timer.
- **Reclaim is deliberately not recovery.** A crash mid-stage can leave partial commits on the work branch; re-entering blind inherits a dirty tree, and a reproducible crash would loop forever. Failing loudly and waiting for `timone retry` keeps the human's eyes on a branch whose state nobody vouched for. The cost is real and accepted: **an unattended overnight run stops at the crash and waits.** If that proves to be the wrong trade, the escalation already discussed is one free automatic re-arm per run with an attempt counter, and this ADR is what to revisit.
- The reclaim path shares its fate with the ticker. If the progress output is ever made conditional — quiet mode, non-TTY suppression, a longer interval for cheap stages — recovery changes with it. The tick must keep stamping even when it prints nothing.
- `heartbeatAt` is optional in the schema, so existing state files load unchanged; a run written by an older daemon simply has no heartbeat and is reclaimable only once a newer daemon has touched it.
- **Two daemons are still unsafe** — this ADR makes reclaim safe under concurrency, it does not make the ledger safe under concurrent writes. That hazard is untouched and stays open.
- PRD-02's declined-observability line is narrowed rather than contradicted: a heartbeat is operational state on the ledger, not a citable run record.
