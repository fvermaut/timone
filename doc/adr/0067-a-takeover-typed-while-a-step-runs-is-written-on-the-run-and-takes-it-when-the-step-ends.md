# ADR-0067: A takeover typed while a step runs is written on the run, and takes the run when the step ends

- **Status:** accepted
- **Date:** 2026-10-05
- **Source:** planning of [timone#217](https://github.com/fvermaut/timone/issues/217), piece 1 of [timone#213](https://github.com/fvermaut/timone/issues/213). The plan is [phase 51](../plans/phases/phase-51.md).
- **Amends:** [ADR-0049](0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) D3 for one case: a takeover that waits for a running step waits without a time limit. The bounded wait for the daemon to read the request stays. [ADR-0032](0032-a-human-command-asks-the-daemon-to-act.md) and [ADR-0023](0023-one-answer-one-session.md) are unchanged: the daemon settles every request on the cycle that reads it, and stays the ledger's only writer.
- **Requirements:** [PRD-09](../specs/prd/prd-09-a-question-names-the-command-that-answers-it-in-a-terminal.criteria.md) R4

## Context

PRD-09.R4 says that `timone takeover` typed while a step of its ticket runs does not refuse. It says which step it waits for, waits for the step to end, and then opens the session. The runner starts no other step on the ticket between the step's end and the session opening. Ctrl-C stops the wait, and then the run is as if the command had never been typed. With no daemon running, no step can end, so the command says so and does not wait.

Today a takeover asks the daemon with a request file. The daemon resolves it on its next cycle, and a run whose step is running is refused there. The command waits at most `WATCH_BOUND_MS` (150 s) for the request to be settled, and withdraws it after that (ADR-0049 D3). A step can run for an hour, so the requirement does not fit inside that wait.

When a step ends, `afterStep` in `src/runner/driver.ts` puts the run on the runner's wait and asks for a runner wake. The wake runs on its own, and the runner it starts can start the next step within seconds. So "nothing starts between the step's end and the session" can only hold if the hand-over happens in the same synchronous write as the step's end. A poll cycle or the terminal itself is too late.

Alternatives considered:

- **Leave the request file on disk until the step ends.** The daemon would skip it on each cycle and carry it out at the step's end. Rejected: every request is settled on the cycle that reads it, and the reason is written in `applyRequests` — a request that survives is a file that is re-read and re-reported on every cycle, and the first exception makes every later one easier. It also makes Ctrl-C a race between deleting the file and the daemon reading it, which is ADR-0049 D3's race on a longer clock.
- **The terminal watches the ledger and claims the run once it is parked.** Rejected: between the park and the claim the runner has already been woken. The runner would start the next step, and the person would wait for that one too.
- **Refuse, and say when to try again.** Rejected: it is the behaviour R4 replaces.

## Decision

**The daemon writes the waiting terminal on the run, and the step's end hands the run to that terminal instead of waking the runner.**

- **D1 — The waiting terminal is a field on the run.** A takeover of a run whose step is running asks the daemon as today. The daemon writes the terminal's holder (ADR-0049 D1) on the run as the terminal that waits for the step, and settles the request. At most one terminal waits on a run. A second takeover is refused while the first one's process is alive, and replaces it when that process is gone. The field is cleared whenever the run leaves `active`, as `takenOver` is.
- **D2 — The step's end hands the run over in the same write.** When a step ends and the run carries a waiting terminal whose process is alive, the driver puts the run on its after-step wait and claims it for that terminal, with no await in between, and asks for no runner wake. The runner is woken when the terminal session ends, as for any takeover (PRD-05.R11). When the waiting terminal's process is gone, the field is cleared and the runner is woken as if nobody had waited.
- **D3 — The terminal waits without a time limit, and Ctrl-C needs no write.** The 150 s bound of ADR-0049 D3 still covers the daemon reading the request. After that the terminal watches the ledger until the run is claimed for it, the run moves some other way, or no live daemon holds the ledger. Ctrl-C ends the process, and the step's end then finds the waiting terminal gone (D2). When Ctrl-C comes after the claim has landed, the terminal gives the run back without saying a session ended, so the runner is woken with the step's end, as if nobody had waited.
- **D4 — The runner starts no step on a run a terminal holds.** A runner wake that was already running when the step ended — a 15-minute check, or a comment — is refused if it tries to start a step on a run a person's terminal holds.

## Consequences

- A person can copy the command from a question the moment it appears. This is what lets PRD-09's piece 2 name the command in every question.
- The run's ledger entry gains one optional field. A ledger written before it loads unchanged. An older build reading a ledger that holds the field refuses it, because the run schema is strict; this is true of every field added so far.
- A terminal can wait for a long step, for example an hour of building. It says what it waits for, and the person can stop waiting.
- The daemon checks the waiting terminal's process at the step's end. A terminal on another machine is answered "unknown" and treated as alive, as `RunStore.claim` treats an existing holder.
- The runner is not told a step ended until the terminal session ends. It then reads the step's end with the session's end, so the record and the wake stay in order.
