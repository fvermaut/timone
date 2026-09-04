# Phase 32 — live gate

> **Plan:** [phase-32.md](../phase-32.md), sub-phase 32e · **Decision:** [ADR-0050](../../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md)
> **Run:** 2026-09-04, 20:05–20:41 UTC, on **`timone` itself** — the first time Timone has been worked by Timone.

## What this gate reached, in one line

Three of 32e's four things were watched. **The fourth was not: no pull request was opened**, because the run parked at verification and was right to — [timone#84](https://github.com/fvermaut/timone/issues/84), filed from what was seen here.

## How it was set up

A real `timone daemon`, on the real ledger, on the real manifest, in a container.

**The process table was cleared first, not just the ledger.** Phase 31's boxed gate found that `--state` isolates the ledger and not the tracker: two daemons polled one project at once and nothing collided by luck. That mistake costs more here, because the project is Timone.

- The daemon fvermaut started at 18:52 UTC (pid 74396) was stopped with `SIGTERM` at **20:05:03**. `ps` found no daemon process after it and `.timone/state.json.lock` was gone.
- **Nothing was in flight when it stopped.** `ivtrends#74` had parked on a conversation at 20:02:23, and no run in the ledger was `active` or `picked-up`. No work was killed.
- He was asked before it was stopped and answered *"Run it now"*.

**The ticket.** [timone#39](https://github.com/fvermaut/timone/issues/39) — the primary sources owed for the UI/UX baseline's craft rules. D-1 chose it first deliberately: documentation only, no code, cheap to run the whole loop on. The `timone` label did not exist on this repository and was created with it.

**The daemon.** `node dist/cli.js daemon` from `docs/phase-32-plan`, started **20:05:48**, on the default runtime, which is the container. Stopped at **20:41:34**; `ps` finds no daemon, the lock is gone, no `timone-*` container is running.

**One limit on the instrument, named rather than implied.** The daemon ran on the **real** ledger and the **real** manifest, so it polled `scratch-app` and `ivtrends` too. That is deliberate — a gate on a copy would not be the machine fvermaut runs — and neither project moved during the gate: every run on both was already parked when it started.

## What was watched

### 1. A Timone ticket picked up, worked in a box — but no pull request

| | |
| --- | --- |
| Picked up | 20:06:32, `timone#39/1` |
| Pinned | `timone at 323600b` — this branch's tip, pushed |
| Triage | 20:06:35–20:07:48, 52s working, 9 turns, **$0.45**, `claude-sonnet-5` |
| Planning | → `timone/39-primary-sources-owed-for-the-ui-ux-basel` |
| Execution | three commits, on the remote at `5f7d119` |
| Verification | 14m19s working, 64 turns, **$5.77**, `claude-opus-5` |
| Parked | 20:40:05, waiting on a conversation |

The container was `timone-timone-1`, from `timone-agent:latest`. Its sessions ran with `cwd /workspace/timone` — inside the box, never here.

It planned and built **its own phase 33** on itself: a plan file, a completion report, a handoffs note, and the change to `standards/baseline/ui-ux.md` the ticket asked for.

```
5f7d119 docs: close phase 33 — primary sources for the screen-of-figures craft rules
150c802 docs: 33a — Reading a screen of figures gets its sources
342a125 docs: plan phase 33 — primary sources for the screen-of-figures craft rules
```

Every commit carries its provenance, which is ADR-0019 holding on a self-run:

```
Timone-Stage: execution
Timone-Run: timone#39
Timone-Session: 47c443c6-a353-46b6-a800-3e5c6dcfe146
```

**`~/dev/timone` was untouched throughout.** Checked at the start, during the run and at the end: clean working tree, still on `docs/phase-32-plan`, HEAD unmoved. `projects/timone` is clean and still on `main` — the work branch was cut **inside the container**, in the container's own clone, and pushed to the remote. Neither of his folders was opened by the run. That is [ADR-0043](../../../adr/0043-the-humans-checkout-is-theirs-alone.md), holding on Timone itself.

### 2. The guards were silent, and one of them was really exercised

`"flags": []` on `timone#39/1` after four boxed sessions. A run-driven session's escalation flags the run, so an empty list is the ledger's own evidence that nothing escalated.

**32b was exercised for real.** The run committed `standards/baseline/ui-ux.md` into `projects/timone`. `standards/` is a `HARNESS_PATHS` prefix: before this phase that commit produced *"1 harness file(s) were committed into timone"*, every time. It produced nothing.

**32c was not exercised, and that is a gap in this evidence.** The run wrote no `STATUS.md` at all — it is a documentation chore, and the stage that writes one is delivery, which was never reached. So D-2's exemption is proved by test and by the ivtrends replay, and **not** by this gate. Anybody reading this as "the STATUS.md rule was watched staying quiet on a self-run" is reading more than happened.

### 3. The merge was not reached

D3 says the merge is fvermaut's. There was nothing to merge: no pull request was opened, because delivery was never reached.

### 4. The daemon said it was running old code — for a different reason than planned

32e expected this the moment a pull request merged. It fired **at start-up instead**, and the reason is better evidence than the planned one: while phase 32 was being built, fvermaut merged the phase-32 plan as PR #83, so `main` moved to `e51581c` under a daemon started on `323600b`.

Said once in the daemon's terminal, in fifteen cycles:

```
⚠ The daemon is running an old copy of Timone. Its process started on commit 323600b,
and the default branch is now on e51581c. Stop it and start it again to pick that up:
node dist/cli.js daemon. Only the daemon's own process is behind — every job downloads
the copy of Timone it was told to use.
```

And on `timone status`, above the projects, which is the surface a person actually looks at:

```
timone       #39 (sorting the request) — working on it now on claude-sonnet-5 for 48s
```

The ledger's own record:

```json
{"commit": "323600b…", "tip": "e51581c…",
 "holder": {"command": "timone daemon", "pid": 62459, "since": "2026-09-04T20:05:48.008Z"},
 "at": "2026-09-04T20:05:49.588Z"}
```

**Not watched: the silent half.** No cycle ran with the daemon on the tip, and none ran with the remote unreachable. Both are covered by test and neither was seen here.

### 5. Finding (e)'s fix was confirmed, and it was load-bearing

```
timone commits no compose file, so nothing is stood up beside this run.
```

Before the fix committed in `da4a419` this threw, before the container exists, so the spawn was refused. **The gate would have ended here, at 20:06, with a message telling fvermaut to add a database to Timone.**

## What could not be reached

**Delivery, the pull request, and the merge.** The run parked at verification with a real question, and the question is [timone#84](https://github.com/fvermaut/timone/issues/84): of 20 MUST criteria in the derived regression set, **2 passed and 18 were BLOCKED** — not failed, unrunnable. The box has no `docker`, no forge credential beyond this one repository, and no clone of any other managed project, and Timone's own criteria are almost all about those things.

**This is not a fault in phase 32 and it is not a fault in the run.** It is the cost of ADR-0041 landing on Timone rather than on a client app: a client app verifies itself by being built and driven, and Timone verifies itself by driving a daemon, a container and somebody else's repository. The box was built to have none of those, deliberately.

It is also the thing that decides whether ADR-0050's bet pays. Three stages ran unattended and the last mile handed back, so **every** Timone ticket will stop in the same place until timone#84 is answered.

**The verification stage said so itself, unprompted, and reported no pass it had not earned.** That is the behaviour worth recording: the failure mode this could have had is a report claiming 20 passes from 2 probes.

## D2's number, first reading

D2 asks for handbacks per merged step ticket, against `ivtrends#24`'s three. **This gate produces no reading**: nothing merged, so the denominator is zero. One handback was seen on one ticket, and it was a handback about the machinery rather than about the work.

## Nothing was left running

- `ps` finds no `timone daemon` — neither the one fvermaut started nor the one this gate started.
- `.timone/state.json.lock` is gone.
- No `timone-*` container is running.
- `~/dev/timone`: clean, `docs/phase-32-plan`. `projects/timone`: clean, `main`.
- `timone#39` is parked, waiting on him, and its branch is on the remote with nothing merged.
