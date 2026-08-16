# ADR-0032: A human command asks the daemon to act

- **Status:** accepted
- **Date:** 2026-08-16
- **Source:** fvermaut's ruling of 2026-08-16, in the grill session on [timone#2](https://github.com/fvermaut/timone/issues/2), from three options for the short commands and three for the takeover
- **Amends:** [ADR-0023](0023-one-answer-one-session.md), whose *"this binds `takeover` and `retry` as well as `daemon`"* this replaces with a rule about acting rather than about writing
- **Bounds:** [ADR-0025](0025-a-lock-holders-proof-of-life-is-its-process.md), unchanged — the lock is still reclaimed on the holder's process, and is simply held for far less time

## Context

Measured on 2026-08-16 with the daemon running, at [phase 23's live gate](../plans/phases/reports/phase-23-live-gate.md):

| Command | Result |
| --- | --- |
| `timone retry` | refused |
| `timone cancel` | refused |
| `timone takeover` | refused |
| `timone status` | works (read-only) |

> `timone daemon (pid 71729) is already working this ledger — it took it at 2026-08-15T16:36:11.415Z, so this one stops rather than becoming a second writer.`

`runDaemon` wraps its whole poll loop in `withStateLock` (`src/commands/daemon.ts:81`), so the lock is held for the daemon's entire life. **Every call to action Timone writes names one of the three refused commands.** To act on any ticket you must stop the daemon, act, and start it again — which is what the gate did, four times. It also means [finding 9 of phase 20](../plans/phases/reports/phase-20-live-gate.md) is only half-closed in practice: `timone cancel` exists and cannot be run while the daemon is up.

**The three commands are not one problem, which is what the refusal message hides.** `retry` (`src/commands/retry.ts:57`) re-arms a failed run and returns; the daemon picks it up on its next pass. `cancel` is the same shape. **Neither spawns a session**, so each needs the ledger for milliseconds — and ADR-0023's stated reason for binding them, *"because they spawn sessions too"*, is true of `takeover` and untrue of `retry` as built. `takeover` (`src/commands/takeover.ts:381`) is the opposite: it runs the interactive `claude` CLI **inside** `withStateLock`, so it holds the ledger for as long as a human is talking to it.

**Alternatives considered, for the short commands:**

- **A socket the daemon listens on.** Immediate and definite, and `timone status` could use it too. Rejected for now: a server, a protocol and its versioning inside the daemon, plus a new failure mode when a socket outlives the process that made it — machinery ahead of the need.
- **Release the lock between cycles** and let commands take it in the gap. Cheap, and not a corruption risk: `RunStore` already re-reads the file before every public read (`src/daemon/runs.ts:531`). Rejected: ADR-0023 made the lock process-wide so that no second actor decides anything beside the daemon, and this puts that window straight back.
- **The daemon serves the request** (chosen).

**Alternatives considered, for the takeover:**

- **The daemon stands down** — asked to release the lock and idle while the takeover holds it, re-acquiring when it ends. Keeps today's shape; rejected because a takeover that crashes or is simply closed leaves the daemon idle with nobody to tell it otherwise.
- **Leave takeover as it is.** Smallest scope; rejected because the refusal the gate hit would stay true for one of the three commands the tickets advertise, and the tickets would go on advertising it.
- **Claim through the run** (chosen).

## Decision

**A human command asks the daemon to act; it does not write the ledger behind the daemon's back.**

- **Requests are files, not a protocol.** A command drops one request file in a queue directory beside the state file. One file per request means no read-modify-write, so **enqueuing needs no lock at all**.
- **The daemon applies queued requests at the top of each cycle**, holding the lock it already holds. It remains the ledger's only writer, so ADR-0023's rule stays literally true rather than being weakened to fit.
- **The command reports the effect, not the errand.** Having enqueued, the CLI watches the ledger and says what actually happened — a retry re-armed, a run cancelled — rather than *"asked the daemon"*. What the human reads is what it reads today, up to one poll interval later.
- **With no daemon holding the lock, a command acts directly**, taking the lock itself exactly as it does now. The queue is the path around a holder, not a new dependency on one: nothing requires a daemon to be running for `timone retry` to work.
- **A takeover claims through the run, not through the lock.** It enqueues a request; the daemon claims the run — a `RUNNING` status already occupies the project's one-session slot (`src/daemon/runs.ts:34`) — and the interactive session then runs **holding no lock**, ending with a second request that records how it went. Exclusivity comes from the run's status, which is how the daemon's own sessions have always had it.

**The lock goes back to being what it is:** protection for a read-modify-write, held for milliseconds by whoever is writing. It stops doubling as a claim on the project, which is a job the run ledger was already doing.

## Consequences

- **Every call to action becomes runnable while the daemon is up**, which is the whole point. The tickets stop advertising commands the machine refuses, and [ADR-0024](0024-every-open-ticket-answers-for-itself.md)'s promise stops depending on the daemon being stopped first.
- **`timone cancel` becomes real in practice**, which [ADR-0031](0031-a-handoff-is-a-wait-not-a-failure.md) depends on: it is the escape from a handoff park nobody answers.
- **Up to one poll interval of latency** on a command served by a running daemon — 60s at the default. Accepted: the CLI waits and reports the outcome, so the cost is time, not certainty.
- **A request that no daemon ever reads is a new way to lose an instruction.** Bounded by the direct path: a command only enqueues when a live holder refuses it, and the holder's liveness is ADR-0025's process check, not a guess. A queue file whose daemon dies before applying it is the residual risk, and it is visible — the CLI is watching the ledger for an effect that never arrives, and says so rather than exiting quietly.
- **`timone takeover` no longer blocks the daemon**, so the daemon keeps servicing every other project while a conversation runs. It also means the takeover must release its claim on exit, including an unclean one; a claim outliving its session is the stuck-run fault [phase 14](../plans/phases/phase-14.md) closed, and it is the specific way this decision can go wrong.
- **The socket is not foreclosed.** If request files prove too slow or too silent, the daemon gaining a socket is a change of transport behind the same rule — the command asks, the daemon acts.
