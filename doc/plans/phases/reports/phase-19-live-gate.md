# Phase 19 — 19e, the live gate

- **Dates:** 2026-08-13 (steps 1, 2, 4 and 5) and 2026-08-14 (step 3, re-run against [19g](../phase-19.md#sub-phase-19g-the-consumed-answer-survives-the-session-that-read-it-r3))
- **Target:** `scratch-app`, the fixture. **`ivtrends` was not touched** — no comment, no label, no body edit, and that was the plan's own instruction after fvermaut rejected the cheap version of this gate on 2026-08-11
- **Run by:** an execution session driving a real daemon on a real ledger, **with fvermaut at the keyboard for step 5** — the answers in step 5 are his, typed by him, and the judgements on what came back are his
- **Outcome:** **all five steps pass.** Step 3 **failed at the first sitting**, which is why [19g](../phase-19.md#sub-phase-19g-the-consumed-answer-survives-the-session-that-read-it-r3) exists; it passes on the re-run against 19g. The human gate is **obtained**: fvermaut confirms the written path is safe to use on `ivtrends`, with the restart caveat in finding 1.
- **Cost:** roughly **$6** for the whole gate — #25 $1.39, #26's re-run $0.92, #24's clarifying round $0.76, #24's second cycle $1.51, plus one #23 session on the pre-phase-19 build.

## Step-by-step outcome

| Step | Expected | Result |
|---|---|---|
| 1 — a written answer picked up and resolved, **once** | one session, one resolution, one close, no `could not resume` | **PASS** — `scratch-app` #25, one cycle, one session, ticket CLOSED |
| 2 — the refusal fires and is legible | a second `daemon --once` and a `takeover` both refused, both naming the holder | **PASS** — both exit 1 naming pid 71240 and when it took the ledger |
| 3 — the way back works | the run reported stopped, and `timone retry` makes the answer readable again | **FAIL 2026-08-13**, **PASS 2026-08-14** against 19g — see below |
| 4 — the lock wedges nothing, and does not break under a live holder | a crashed holder reclaimed with attribution; a live holder refused however long it is quiet | **PASS**, both halves, five refusals and one reclaim |
| 5 — the one judgement no pass has witnessed | fvermaut's own written answers, and his judgement of what came back | **PASS** — three judgements, all his, one of them more interesting than a pass |

## Step 1 — one answer, one session

`scratch-app` [#25](https://github.com/fvermaut/scratch-app/issues/25), answered **in writing at 21:42:36Z** by fvermaut, with nothing run by hand afterwards.

```
one cycle · session 9d8696f8-0861-4272-9dcf-194700a5a4e6
3m38s working · 30 turns · $1.39 · claude-opus-5 12.9k out
done — wayfinding resolved it
```

The ticket closed with four comments and the run ended `done` carrying **one** session id. **Zero occurrences of `could not resume`** in the daemon's log — the operator-visible ending of both phase-18 reproductions.

**This was checked from the daemon's log *and* from the ledger, separately**, because the two disagreeing is what exposed the original fault: phase 18 saw two session ids in the log and two in the ledger and the cycle ending on a lifecycle error. Here both say one, and they say the same one.

**The resume path is shown firing, not merely quiet** — the plan's second checkbox, and the thing a fix that simply stopped resuming would fail. The session resolved a real question from the words fvermaut wrote and closed the ticket on them; a daemon that had stopped reading answers would have left #25 parked and silent.

## Step 2 — the refusal, with the daemon inside a session

Run while the daemon was inside #25's session and holding the lock:

```
$ node dist/cli.js daemon --once
timone daemon (pid 71240) is already working this ledger — it took it at
2026-08-13T21:42:43.969Z, so this one stops rather than becoming a second writer.
exit: 1

$ node dist/cli.js takeover scratch-app#25
timone daemon (pid 71240) is already working this ledger — it took it at
2026-08-13T21:42:43.969Z, so this one stops rather than becoming a second writer.
exit: 1
```

Both name the holder, both name when it took the ledger, both exit non-zero, and **neither started anything**. This is the exact shape that bought two sessions for one written answer on 2026-08-11 — a second `--once` typed while the first is blocked inside a session — and it is now a refusal.

## Step 4 — the lock under a live holder, and under a corpse

**A live holder was refused five times running, and the message changed to name the reason** as the quiet passed the staleness window:

```
21:43:24Z    40s quiet, holder pid 71240 alive=true   exit=1  "is already working this ledger"
21:44:09Z    85s quiet, holder pid 71240 alive=true   exit=1  "is already working this ledger"
21:44:54Z   131s quiet, holder pid 71240 alive=true   exit=1  "has not touched this ledger since …"
21:45:41Z   177s quiet, holder pid 71240 alive=true   exit=1  "… but its process is still running — a busy holder is still the holder"
21:46:21Z   218s quiet, holder pid 71240 alive=true   exit=1  (same)
```

**Under the pre-ADR-0025 design the third of those would have broken the lock**, and the two after it as well: the window was the authority, and a daemon inside a session goes quiet for the session's whole length. That is [ADR-0025](../../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)'s fault, observed live on the shape the ADR predicted from arithmetic.

Then a genuinely crashed holder — `kill -9`, no clean release, no chance to delete its lock file:

```
21:51:37Z   130s quiet, pid 72300 alive=false
took the ledger back from timone daemon (pid 72300), silent since 2026-08-13T21:49:27.912Z
witness not judging — nothing was watching for 2m10s, so no run's silence over it is evidence of anything
```

**Those two lines are independent, and the separation is the point.** The lock was reclaimed on the holder's process being gone; [ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)'s run-witness, in the same cycle, separately declined to judge any *run*, because nothing had been watching for 2m10s. That is exactly the division ADR-0025 set out to draw — process-existence for the lock, witnessed time for runs — and here it is visible in two consecutive lines of one log.

**A cost this makes concrete, and it is finding 6 below:** a fresh daemon started two seconds after the `kill -9` was **refused**, because the quiet window is a first filter and the liveness probe is never reached inside it. A crashed daemon therefore wedges its project for up to the staleness window — two minutes at defaults. That is ADR-0025's designed trade, not a defect.

## Step 3 — the way back, failed and then fixed

### The first sitting, 2026-08-13: FAIL

On `scratch-app` [#26](https://github.com/fvermaut/scratch-app/issues/26), an answer written at 21:52:33Z, consumed, and its session killed at 21:53:16Z:

```
21:53:17   "Something went wrong … nothing was decided about this ticket"   (correct, and good)
21:54:0x   timone retry   -> run re-armed as `picked-up`
21:54:32   the ORIGINAL invitation re-posted VERBATIM; cursor now 21:54:32 — AFTER the answer
```

**The stop was reported honestly and the recovery command was handed over** — that half worked. What did not is the recovery itself: the run after the kill carried `waitCursor: undefined`, because `activate` clears it, so `retry` had nothing to rewind, fell through to the entry path, and asked fvermaut the same question again over the top of his own answer, which was then permanently unread.

**[ADR-0023](../../../adr/0023-one-answer-one-session.md) traded "a silent double-answer for a visible stall" and undertook that `timone retry` rewinds the marker.** What the build did instead was a **silent re-ask**, which is not the trade that was accepted and is worse on a real decision than the fault it replaced. The plan was amended, 19g was added, fvermaut re-approved, and this step was re-run.

### The re-run, 2026-08-14, on the same ticket: PASS

```
08:02:35Z   answer consumed; run active; consumedAnswerAt 2026-08-14T08:02:35Z
08:03:02Z   session killed -> failed; waitCursor undefined; consumedAnswerAt SURVIVED

$ node dist/cli.js retry scratch-app#26
scratch-app #26 is re-armed, and I've wound it back to before the answer you wrote on
the ticket, so I read that answer again instead of asking you the same question twice.
            ledger: parked, waitCursor 2026-08-14T08:02:34.999Z, consumedAnswerAt cleared

08:03:23Z   next cycle RESUMED: session b2229d9e, $0.92, resolved, ticket CLOSED
            invitations on the thread: 2 before, 2 after — no third
```

**The kill landed after the run was `active`**, which is the state the first pass proved is the broken one and the state 19c's tests never reached. `waitCursor` is gone, as it always was; the new marker is not, which is the whole of the fix. `retry` prints a **different sentence** on this path from the one a failure with no consumed answer prints, so which sentence appears is itself the diagnosis. The thread gained **no third invitation** — the strongest single check, because a cycle that re-posts the question is a fail however right the ledger looks.

## Step 5 — the judgement no test can make

**This is what unlocks R3, and nothing else does.** fvermaut answered fixture questions on `scratch-app` in his own words and judged the results himself. Every written answer tested before today — the 2026-08-09 gate's and the 2026-08-11 verifier's — was typed by a machine in his voice.

**1. A five-word answer, on #23: "just do it automatically".** His judgement: **"fair — and it flagged the ambiguity well."** The resolution read him as *"you decide, don't hold it up on me"*, made the call for an Edit control, gave its reasons **against his own earlier rejection of that button on #6**, named what it was accepting on his behalf, and said in the open that if he had meant auto-saving instead, one half of the decision flips and saying so is enough. That last part is what makes the reading safe to act on: it does not hide the branch it took.

**2. A deliberately partial answer, on #24: "A brief 'deleted' is fine".** His judgement: **"reasonable — and it held what I'd settled."** It restated the settled half as settled and refused to re-ask it, read "brief" as also settling the duration rather than making a second question of it, asked **exactly one** question — does the strip give a way *back*, or only announce — checked the app rather than asking about it, recommended an answer with its cost, and offered a one-word reply. The clarifying round is the clause [ADR-0022](../../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md)'s written path exists for, and it is the first time a person has judged one.

**3. The contradiction test: "undo, yeah. but don't keep the deleted one anywhere".** fvermaut's judgement: **a pass — "it didn't badger, and the reading is good."**

**And this is the most interesting thing in the gate, so it is recorded rather than smoothed over: it did not hand back.** The documented bound says a second unsettled answer **hands the conversation back to the terminal** — [`CONTEXT.md`](../../../../CONTEXT.md)'s glossary in as many words (*"a second unsettled answer hands back the takeover instead of a third question"*) and [ADR-0022](../../../adr/0022-a-conversation-ticket-can-be-answered-in-writing.md) behind it — and [phase 18](phase-18-live-gate.md) watched it do exactly that on `scratch-app` #19. Here it **resolved instead**: it reconciled the two halves — the delete stays final; the strip re-adds the words as a *new* to-do from what the browser still holds — named three costs, flagged the one thing it had decided for him, and closed.

**The bound's purpose held; its letter did not.** The purpose is that the human is never asked a third time, and he was not. The letter says the mechanism for that is a hand-back, and the mechanism used was a resolution. **fvermaut ruled it a pass** on the outcome. Two things follow and neither is closed here:

- The rule as written and the behaviour observed are not the same rule. Whether the record should say *"never a third question"* — which is what he actually judged — or *"hand back on the second unsettled answer"* — which is what it says — is a specification question, and it belongs to stage 9 rather than to a fix context.
- The hand-back path is therefore **not re-observed at this gate**. It was observed at phase 18 on a machine-authored answer; it has still never been observed on a human's.

## Findings

Six, and none of them is fixed here.

1. **A running daemon executes whatever code was in memory when it started.** The gate opened against a `timone daemon` that had been up since 15:39. It picked up #23 and resolved it on **pre-phase-19 code** — the `timone` binary is a symlink into this working tree, so the code was current *on disk* and stale *in the process*. Two `daemon --once` runs exited 0 silently, which read like a lock failure and was not. **The operator consequence is the one that matters and it is in [STATUS.md](../../../../STATUS.md) in plain words: phase 19 changes nothing for a daemon that is already running. It has to be restarted.**
2. **The `resume` line prints after the session has already finished.** `poll.ts:710` logs after `await spawner.spawn` returns, so the log reads `done … resolved it` followed by `resume … → wayfinding` and looks exactly like a second resume firing on a finished run. **Phase 18's failure ended on that shape**, so this actively impedes the next diagnosis of the fault this phase just closed. Cosmetic in effect, wrong in substance, and **no test can see it** — the third phase running where the thing the tests could not see is the thing a human would read.
3. **A ticket declaring itself a throwaway fixture still gets its decision written into the project's permanent record.** #24, #25 and #26 each carried *"Throwaway fixture … Not a real product decision"* in their bodies, and the resolving sessions committed and **pushed** their decisions into `scratch-app`'s `CONTEXT.md` and `STATUS.md` — the glossary acquired an undo strip invented purely to test a lock. Reverted at `scratch-app` `2d80e64` on fvermaut's call, keeping #23's, which answered a genuinely open PRD-02 question. **The banner does not bind the record**, and that is precisely the mechanism by which "it's only the fixture" becomes real pollution of a real repository.
4. **[Phase 18's finding 3](phase-18-live-gate.md) reproduced unchanged.** A wayfinding park comment still opens *"Before I write down what "&lt;title&gt;" actually needs …"* — stage 2's clarification voice, promising the write-up the wayfinding prompt explicitly forbids. It is the first sentence a human reads on any wayfinder park. Now observed on a third occasion and still not fixed.
5. **Phase 18's "unidentified intermittent" is identified.** It is `src/commands/guardrails.test.ts > finding the run that drove a session > resolves the session id against the ledger`. It does real `git` work in a temporary repository, runs in ~1.2s alone, and blows its 5000ms timeout under full-suite contention. **Confirmed failing at `2c7f04e` — before any phase-19 code existed** — and passing in later runs on a quieter machine. Not this phase's to fix; it is no longer unknown, and a red run on that name is not evidence of a regression.
6. **A crashed daemon wedges its project for up to the staleness window** — two minutes at defaults. Observed: a fresh daemon started two seconds after the `kill -9` was refused, because the quiet window is a first filter and the liveness probe is never reached inside it. **This is [ADR-0025](../../../adr/0025-a-lock-holders-proof-of-life-is-its-process.md)'s designed trade, not a defect** — the alternative is probing on every acquisition, which buys two minutes at the price of making the probe the hot path. The cost is stated here so nobody meets it as a surprise: after a crash, wait out the window or the second daemon refuses.

## What this gate did not prove

- **The hand-back on a human's answer.** See step 5's third judgement: the bound's purpose held by a different mechanism than the record describes, so the escalation itself is still witnessed only against a machine-authored answer.
- **Anything on `ivtrends`.** By instruction. The written path is now judged safe to *use* there, which is a different act from proving it there.
- **`prototype`, `research` and `task` wayfinder CTAs** — untouched by this phase, and part of R20's named remainder.
- **`takeover` resolving a ticket with no ledger run** — R20's clause 2, untouched here by the plan's own statement, and phase 20's to build.
- **A second host.** The lock is single-machine by construction, and everything above ran on one laptop.

## Human gate

**Obtained.** fvermaut answered in writing, in his own words, judged all three results himself, and confirms the written path is safe to use on `ivtrends`. **The confirmation carries finding 1 as a condition**: a daemon already running is running the old code, and answering a question against it is answering against the fault. It must be restarted first.
