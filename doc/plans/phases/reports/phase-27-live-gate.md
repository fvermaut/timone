# Phase 27 — Live Gate Report

- **Date:** 2026-08-19, 17:08Z – 17:26Z
- **Plan:** [phase-27.md](../phase-27.md) — 27a, the only sub-phase that earns a gate
- **Fixture:** `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4). **`ivtrends` was not touched** — every cycle ran with `--manifest` naming `scratch-app` alone.
- **Cost:** $2.32 for the diagnosis session (6m22s, 21 turns, Opus 5), plus the approval-record and planning sessions of the second half.

**The ticket is not machine-typed.** #4 was filed as an ordinary bug report on 2026-08-02 and triaged as one. Nothing about it was staged for this gate, and it had been stuck for seventeen days at the exact stop this phase exists to clear. That is what makes it worth running.

## Outcome in one line

**27a works, and the second half found a real gap in it.** A bug ticket that no version of this machine could act on was picked up, diagnosed, committed and put in front of the human as a question they could answer. fvermaut approved it. The run then advanced to the wrong stage — and the stage refused, correctly, and said why in plain words.

So both halves are now observed, and the honest summary is: **the road out of the bug classification exists and works; where it points is wrong for one of the three layers stage 9 can find.**

## Two deviations, stated up front

**This gate ran against the live ledger, not a copy.** Earlier gates used `--state` pointing at a copy. The subject here is the real run `scratch-app#4/1`, parked since triage routed it into a stage that did not exist; a copy would have proved the code works and left the real run stuck. The live file was hand-edited zero times.

**The daemon fvermaut had running was stopped and has not been restarted.** Pid 66170, started 08:57Z, was executing the pre-phase build, and two daemons on one ledger is the condition the lock exists to prevent. See the smaller observations — it was not healthy.

## Pre-state, recorded before the run

| | |
|---|---|
| Ledger | `scratch-app#4/1`, `parked`, stage `triage`, **no wait kind**, waitingOn *"the next stage to be built"* |
| Tracker | #4 open, labels `timone` and `triage:bug` |
| `STATUS.md` | listed it under *"Nothing you can do about it"* |

## What was predicted, and what happened

Written down before the cycle ran, in the order predicted.

| | Predicted | Observed |
|---|---|---|
| 1 | Reads the labels, routes `triage:bug` → `feedback`, resumes there | `resume scratch-app#4/1 → feedback` |
| 2 | Claims a branch, because the stage owns one | `branch scratch-app#4/1 → timone/4-the-page-feels-slow` |
| 3 | Diagnoses, commits a record under `doc/feedback/`, pushes, comments | `docs: feedback 005 — the page feels slow`, one file, 106 lines |
| 4 | The branch moved, so the gate opens rather than failing | Gate comment posted, headed *"I've had a look at what went wrong."* |
| 5 | Run ends `parked`, stage `feedback`, waitingKind `gate` | Exactly that, with the branch and cursor recorded |
| 6 | The standing note says the ticket is waiting on a human | `cta scratch-app#4` — the reconciler only writes when the body changed |

### The four falsifiers, none of which fired

- **The run stays parked at `triage`.** It did not.
- **The session commits to `main`,** following the skill's own instruction over the prompt's override, leaving the branch tip unmoved and the run failed. It committed to the work branch.
- **The session posts a gate-shaped question of its own,** so the ticket carries two sets of instructions. It did the opposite, unprompted and in its own words: *"**What I need from you: nothing in reply to this message** — the next message on this ticket is the one that asks you to decide."*
- **Anything is written into Timone's own repository.** `git status` clean, HEAD unchanged at `8fab9cc`.

## What the stage actually produced

One file, [`doc/feedback/005-the-page-feels-slow.md`](https://github.com/fvermaut/scratch-app/blob/timone/4-the-page-feels-slow/doc/feedback/005-the-page-feels-slow.md). No code, no phase file, no PRD amendment — *"Nothing has moved,"* as its own opening says. The record's Decision column reads `awaiting` throughout.

**It found a mis-triage, which is the layer nothing else in the process checks.** The 2026-08-02 triage comment classified #4 as a bug on the grounds that the requirements already promise a tick shows on screen immediately. They do not: the word *immediately* is in PRD-01.R6's **delete** clause, and the toggle clause carries no timing word at all. So nothing was being broken — the promise was simply missing, and the item is a change of intent rather than a shortfall. Stage 9's *the record is wrong* layer earned its keep on its first live run.

The comment it wrote for the human says that in four sentences, admits the earlier error as its own, and flags its proposed numbers — *"with 100 to-dos on the page, a tick shows within a fifth of a second"* — as its guess and not fvermaut's.

## Second half — the approval, and the gap it exposed

**fvermaut replied `approve` at 17:22:26Z**, at his own keyboard. His own daemon — restarted by him, running this branch's build — read it on its next cycle. Nothing here was driven by this session.

**Predicted before the resume, and written down before it ran:**

> The diagnosis's own recommendation is two steps: amend PRD-01 with a new R8 *first*, then plan and build anchored on it. The graph's `next` after `feedback` is `planning`. So the run goes straight to writing a phase file, against a criterion that does not exist.

**Observed, in order:**

1. The gate read the approval and a short session stamped it into the artifact — commit `5f2b1b2`, *"Record approval on feedback 005"*.
2. The run advanced to **`planning`**, skipping stage 3. The prediction held.
3. **The planning session refused and escalated.** No phase file was written; the branch still carries two commits and neither is a plan.

Its own words on the ticket, unprompted:

> I am the part that works out how to build things. I am not allowed to write requirements. That split is deliberate: what the app promises and how it gets built must not be decided in the same pass. The requirements file still says nothing about speed. If I planned the work now, I would be planning against a promise that only exists in a note, and the check at the end would have nothing to measure the result against.
>
> Nothing is wrong with your answer. Answering again will not move it — you already said the right thing. The writing-down step simply never ran, and it has to run before me.

That is the failure the feedback record had argued against three hours earlier, in almost the same terms: *"the code work would have been built against a standard nobody agreed to, and finished against a threshold nobody set."*

### The finding

**`feedback`'s `next: "planning"` is wrong for an intent-layer item.** Stage 9 sorts feedback into three layers, and only one of them — an implementation gap — is ready for stage 5. An intent change owes stage 3 first, and a record-is-wrong item may owe nothing at all.

**27a is incomplete, not wrong.** The road out of the `bug` classification exists and every step of it works. It points one stage too far along for one of the three layers.

**Two ways to close it, and choosing is a decision rather than a detail:**

- **Route by layer.** `feedback` would have to record which layer it found somewhere the daemon can read, and the graph would branch on it — the shape `routeAfterTriage` already has.
- **Always route to `requirements`.** Simpler and one road; it costs a stage-3 session on every remediation, including the ones that change no intent at all.

**Not fixed in this phase.** It is fvermaut's call, and the run is parked safely in the meantime.

### What the escalation is worth on its own

ADR-0033's guard was built for a stage handed an *answer* it may not act on. This is the first time it has caught a **routing** mistake — the machinery sending a stage work that belongs to another stage — and it caught it before anything was written, explained it to the human without process vocabulary, and told them the one command that moves it. The graph was wrong and the ticket still said something true and actionable.

## Smaller observations

1. **The daemon that was running had been alive but blind for 51 minutes.** Its lock recorded `observedAt` 16:16:48Z while its process was still up at 17:07Z, and the first line of this gate's own log reads *"the daemon was not running for 51m11s"*. The process was hung, not stopped — which is fresh evidence for the two defects diagnosed on 2026-08-17 and never filed: no timeout on `gh`, and no retry on transport failures. **Still unfiled.**
2. **The provenance trailers are on the commit**, including `Timone-Run: scratch-app#4` — the ticket, not the chunk, which is the documented format.
3. **The two comments do not contradict each other.** The prompt tells the session not to invent an approval instruction because the machinery posts its own immediately after; the session obeyed and said so to the reader.
