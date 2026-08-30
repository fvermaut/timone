# ADR-0047: A cancel stops the work it cancels

- **Status:** accepted
- **Date:** 2026-08-30
- **Source:** [timone#69](https://github.com/fvermaut/timone/issues/69), filed after a run started by mistake on `ivtrends` #35 could only be stopped by killing its container by hand
- **Amends:** [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md), whose *"the daemon applies queued requests at the top of each cycle"* is kept for every request except a cancellation, and whose *"up to one poll interval of latency"* was untrue for the one request that cannot afford any
- **Standing:** [ADR-0023](0023-one-answer-one-session.md), unchanged — the daemon is still the ledger's only writer, and the second clock added here beats inside the same process

## Context

`timone cancel` could not stop a run that was actually running. The request was written to disk and sat there until the run ended on its own, which is the one situation the command exists for.

On 2026-08-30, on `ivtrends` #35:

| time (UTC) | what happened |
| --- | --- |
| 13:47:30 | the daemon spawned the run |
| 13:56:27 | `timone cancel ivtrends#35` — a request written to `.timone/requests/` |
| 14:00:30 | a second `timone cancel ivtrends#35` — a second request written |
| 14:03:39 | the run advanced from planning to execution and began writing code |
| ~14:03 | its container was stopped by hand, which is what actually ended it |
| 14:06:35 | the daemon finished a poll cycle and applied **both** requests at once |

The run kept working for seven minutes after it was told to stop, moved on to a further stage and pushed a commit. Both requests sat unread for more than nine minutes while the daemon was alive the whole time.

**Nothing was misplaced.** `applyRequests` runs first in the cycle, exactly where ADR-0032 put it, so that no request waits a whole cycle. What defeats that placement is that **a cycle does not come round again while a run is in flight**: the daemon spawns a session and awaits it, so "first in the next cycle" and "when the run ends" are the same moment. A run is minutes or hours; a poll interval is sixty seconds. Both messages the human read — *"on its next pass"* from the command, and *"it will on its next pass"* from the wait that timed out — were true and useless.

**Stopping the ledger is not stopping the work.** Even applied instantly, `runCancel` writes `cancelled` and nothing else. The container carries on: it holds the model token, spends money, and pushes commits to the work branch. Killing it was a thing only a person with a terminal could do.

Alternatives considered:

- **Release the lock between cycles**, so a command can act directly. Rejected by ADR-0032 already, and rejected again here for the same reason: it puts a second writer beside the daemon. It also fixes nothing — the daemon does not reach the gap between cycles while a run is in flight.
- **Spawn runs without awaiting them**, so the cycle stays short. A much larger change: the cycle's one-session-per-project guard, its heartbeat and its reclaim all read a run that the cycle itself is holding. Worth considering on its own; far too much to carry a cancellation on.
- **A socket the daemon listens on.** ADR-0032 left this open and it is still open. It is a change of transport, not of rule, and the rule is what was wrong.
- **Read requests on a clock of their own** (chosen).

## Decision

**D1 — A cancellation is read on a clock of its own, for as long as a cycle lasts.** The cycle starts a watch after its own `applyRequests` and stops it on the way out. The watch looks every two seconds — seconds, because the whole value of a cancellation is how soon it lands, and the cost of a look is one `readdir` of a directory that is almost always empty.

**D2 — Cancellations only.** Every other request asks for work to *start* or to *move*, and a cycle already walking the projects is the worst moment to be told either — that race is precisely what ADR-0032 avoided by applying requests before the walk. A cancellation is the opposite: it asks for work to stop, it is worth less the later it lands, and nothing it touches is something the cycle is going on to start. Everything else still waits for the top of the next cycle.

**D3 — A cancellation stops the session the run is in.** The ledger is written first, then the spawner is asked to stop the run's session. A boxed session is stopped by **removing its container**, not by killing the `docker run` client — killing the client only stops the daemon watching, and the box keeps working, which is the fault itself one level down. An in-process session is stopped by the abort controller it was started with.

**D4 — The order is the ledger, then the work — never the other way round.** The spawner reads the run when its session ends: a run marked `cancelled` is a human's decision and is reported nowhere, while a session stopped before the cancellation was written is indistinguishable from one that broke. It would be failed, commented on the ticket, and — because a killed session ends on whatever the connection to it was saying — possibly retried by [ADR-0034](0034-a-technical-stop-is-retried-not-reported.md), starting the work again seconds after a human asked for it to stop.

**D5 — A runtime that cannot stop a session still cancels.** The stop is best effort and says so in the daemon's log. What is lost is the work ending early, never the cancellation.

## Consequences

**`timone cancel` does what it says.** A cancellation lands within seconds whatever the daemon is doing, and the work stops with it. The command's own words change with it: it no longer promises a pass that is not coming, and its timeout now means something is wrong rather than something is slow.

**Requests are no longer applied in one global order.** A cancellation may overtake a retry that was asked for earlier. ADR-0032 promised order between requests as they were asked for, and this keeps it among cancellations, which is where it was ever observable. The exchange is deliberate: the request whose value decays is the one that stops queueing behind requests whose value does not.

**A cancelled run's work is destroyed mid-flight.** The container goes with whatever it had not committed. That is what cancelling means, and the alternative — asking a running agent to stop politely — needs a channel into a box that does not exist and would be ignored by a session waiting on the model.

**Two clocks now write the ledger, and both are the daemon's.** ADR-0023's single writer is untouched: the watch is a timer inside the same process, and its looks do not overlap each other or run past the end of the cycle that started them. What it does mean is that a store write can now land between two awaits of the spawner. The stage walk reads the run's status where that matters — before each stage, when a session ends, and before a retry — and stops rather than writing over a cancellation.

**Nothing is read between cycles.** The watch belongs to a cycle, because a cycle is the only thing that blocks; between two of them the daemon's own loop is already coming round within a poll interval, which is inside the wait the command keeps.
