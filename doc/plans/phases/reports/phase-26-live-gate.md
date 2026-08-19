# Phase 26 — Live Gate Report (26f)

- **Date:** 2026-08-19, 07:49Z – 08:46Z
- **Plan:** [phase-26.md](../phase-26.md) — 26f
- **Fixtures:** `scratch-app` [#39](https://github.com/fvermaut/scratch-app/issues/39) (steps 3–6, driven by hand) and [#40](https://github.com/fvermaut/scratch-app/issues/40) (steps 1–3, driven by fvermaut at his keyboard). **`ivtrends` was not touched.** Both are closed and unmarked, and their branches are deleted.
- **Isolation:** every cycle this session ran used `--manifest` naming `scratch-app` alone and `--state` pointing at a **copy** of the ledger, and the live file was **hand-edited zero times**. It did not stay untouched: the daemon fvermaut started himself carried neither flag, so the live ledger picked #40 up as new work and created its own run for it ([timone#32](https://github.com/fvermaut/timone/issues/32)). That run was ended with `timone cancel`, which is the one live write this gate caused.
- **Cost:** $1.21 recorded across four sessions, plus two sessions killed mid-work whose cost was never printed (a requirements session at 8m31s, a planning session at ~3m).
- **Tickets are machine-typed, except where they are not.** Both fixture tickets and every answer on them were written by this session in fvermaut's voice. #39's two handback notes were hand-written by it as well. **#40's handback was written by a session, and the yes it acted on was fvermaut's own, typed at his keyboard** — which is what makes steps 1 and 2 worth anything.

## Outcome in one line

**Six of the seven steps are observed, and one defect was found and fixed mid-gate.** Only step 7 — the work coming out the far end as a pull request — is unobserved, and it was deliberately stopped. The round trip works: a note handed the run back, the machinery claimed the branch and started the named step by itself, and the ticket stopped saying it was stuck.

## What #37 cost this gate, and why the fixture is new

**The plan named `scratch-app` [#37](https://github.com/fvermaut/scratch-app/issues/37) as the fixture and said not to tidy it up.** By the time this phase was built it had tidied itself away: the takeover session fvermaut opened on 2026-08-18 — running the *old* prompt, before 26d existed — carried the whole feature through building, checking and delivering, and left **pull request [#38](https://github.com/fvermaut/scratch-app/pull/38) open**. That is the behaviour this phase exists to stop, demonstrated once more, and it left nothing for a handback to hand back.

So the gate ran on a fresh ticket, driven to the same stop in two cycles for $0.72.

## Step 1 — a takeover unblocks and stops

**Observed on `scratch-app` [#40](https://github.com/fvermaut/scratch-app/issues/40), 2026-08-19, by fvermaut at his own keyboard: *"it stopped right"*.**

The session took his yes in the terminal, wrote the requirements and the decisions on the branch, and stopped. It said so itself, unprompted, in the note it left:

> **What was not done, deliberately.** Nothing was built here. The plan, the code, the check and the two reviews are each done by a session that did not write what it is looking at — **which is the part the last ticket like this one gave up**, and the reason its pull request came with *"nobody but the machine has looked at this"*.

That last clause is the session naming [#37](https://github.com/fvermaut/scratch-app/issues/37) — the run this phase was written about — as the thing it was not going to repeat. It also listed the two calls it made on his behalf and said both were cheap to change while nothing was built.

**One thing the bound does not cover, seen here:** the session left the fixture's checkout clean, but a stage session killed mid-work does not — see the smaller observations.

**#37 remains the evidence for why the bound was needed**, and #40 is the first evidence that it holds.

## Step 2 — the ticket reads as a round trip

**Observed on #40, in a note a session wrote rather than one this session typed.** It opens *"Settled. You said yes at your keyboard, and the work carries on without you now"*, says what was agreed in plain words, separates the two calls the machine made from the ones he made, flags a promise being narrowed on purpose, and closes:

> **What I need from you: nothing.** The next thing you hear about this is a pull request.
> ```
> Carrying on at: preparing the work
> ```

No process vocabulary reaches the reader; the machinery's half of it is one line at the bottom.

**On the earlier fixture (#39) both notes were hand-written by this session** — one naming a step nobody defined, one naming a real step — and that is what steps 5 and 3 were driven with.

## Step 3 — the next cycle carries the work on

**Observed twice: once on a hand-written note (#39), once on a session's own (#40).**

On #40 the note said *"Carrying on at: preparing the work"*, and the next cycle produced:

```
branch scratch-app#40/1 → timone/40-can-i-hide-the-ones-i-ve-finished
session ef8f3146-9089-4559-8ea1-bf097d2dae8e started for scratch-app#40/1 (planning, claude-opus-5)
```

**The branch the machinery claimed is the branch the takeover session had already been working on** — arrived at from the ticket and the chunk, not from the note, which named none. That is the phase's own rule paying off rather than being asserted.

On #39, with the run stopped at *asking what you need*, a note naming *writing down what it needs* produced, on the very next cycle and with nothing typed:

```
branch scratch-app#39/1 → timone/39-can-i-star-the-ones-that-matter
session 77f79596-a65a-46c0-b671-69f5608d2896 started for scratch-app#39/1 (requirements, claude-opus-5)
```

**The branch was claimed by the machinery that always claims it**, computed from the ticket and the chunk — the note carried no branch and could not have. This is the state the phase was built for: `timone#30` is the ticket that could never be resumed, and it resumed.

**The session was killed at 8m31s by a ten-minute limit on the command that ran the cycle** — this session's mistake, not the machinery's. The run was left `active` with a stale heartbeat, which is the state R18's reclaim exists for; it was ended with `timone cancel` rather than left to be reclaimed, because the fixture had already shown what it was there to show.

## Step 4 — the standing note stops saying it is stuck

**Observed.** Before: *"I picked this back up and then lost my footing… That's mine to get wrong, not yours."* After the handback was acted on: *"Picked this up. — What I need from you: nothing right now — I'll comment here when I do."* One computation, repaired on the cycle the state changed, with nobody asked to do anything.

## Step 5 — a note it cannot read is refused out loud

**Observed, and this is the step the plan asked to be driven by hand.** A note naming *"the rest of it"* left the run stopped, started nothing, and rewrote the ticket to:

> **I picked this back up and then lost my footing: I wrote down "the rest of it" as the place to carry on, and I don't know what that means. That's mine to get wrong, not yours.**
> `timone takeover scratch-app#39`
> **What I need from you:** run this command and tell me where to pick it up. Everything we settled is safe — it's written down.

The name is quoted exactly as it was written, which is what lets a person see what went wrong rather than being told that something did.

## Step 6 — the human's words still start nothing

**Observed.** *"Come on, just do it. I already told you it's fine."* written on the stopped ticket, three cycles run: **zero sessions, zero comments**, the cursor unmoved. Phase 25's guarantee survives the slice that gave this wait a way out.

## Step 7 — the work reaches a pull request through the loop

**Not run, and deliberately stopped part-way.** The #40 run was handed back and started planning; three minutes in, fvermaut called the ticket done, and the cycle was killed rather than allowed to build, check and deliver. What is proven is that the loop takes the work back and starts the named step by itself; what a whole initiative looks like coming out the other side is unobserved.

## What running it without the flags found — [timone#32](https://github.com/fvermaut/timone/issues/32)

**A ticket whose requirements were written and approved was re-triaged from scratch, and the triage session said so while being routed as if it had not been.** fvermaut started a daemon without `--state`, so the live ledger — which had never heard of #40 — registered it as new work. Triage ran, read the branch, and wrote:

> **Routing:** requirements and breakdown are already approved for this ticket — the next open step is the build plan (`timone-plan`), not another round of requirements discovery.

**And was then routed to another round of requirements discovery**, because routing reads the classification label and nothing else. The ticket asked him for a conversation it had already had, and a paid session produced the contradiction.

**Two ledgers is a fixture accident; the path is not.** A lost or reset ledger reaches the same place, which phase 20's report already names as a class. Filed rather than fixed: whether triage may route on what it finds is a process decision.

## The defect this gate found, and the fix

**A refused note could not be corrected, so the refusal was a trap.** The reader took the **first** handback note after the stop. Step 5 left a note naming a step nobody defined; the ticket did exactly the right thing and asked the person to come back and say where to pick it up — and the note they would come back with **could never be read**, because the bad one was already there and would answer for ever.

**It is the shape of the bug this whole phase exists to remove, one turn deeper:** a call to action that cannot be acted on, on a run with no way out.

**Cause:** `readHandback` inherited `readStageOutcome`'s rule without the difference being noticed. A stage's outcome is one closing comment and a second would be a contradiction; a handback is a message a person and a session can get wrong and correct.

**Fix (`outcomes.ts`):** the newest note wins. It cuts both ways deliberately — a good note corrected to a bad one is refused, because the machinery must not act on something its own last word withdrew. Two tests, and the fixture proved it live: the corrected note was read on the next cycle and started the work.

**Found for the price of one hand-written comment**, by following the plan's own step 5. The three defects this phase and the last have found were all in prose or in a rule about prose, and none of the 1096 green tests could see any of them.

## Smaller observations, not defects

- **The refusal's words survived contact with the situation that produces them.** *"That's mine to get wrong, not yours"* reads as intended on a real ticket, under a real name nobody defined.
- **A stage session killed mid-work leaves the shared checkout dirty.** The planning session on #40 was three minutes in when it was stopped; it left five modified source files and an untracked probe test in `projects/scratch-app`, uncommitted. Nothing owns that mess: the next session inherits it, and the guardrail that reads the working tree blames whoever is stopping ([timone#9](https://github.com/fvermaut/timone/issues/9)'s neighbourhood). Discarded by hand here.
- **A cycle that spawns a session runs for as long as the session does.** Obvious in hindsight, and worth writing down: a ten-minute limit around `daemon --once` kills whatever the session was doing. Anything driving a real stage session should run it in the background.

## What this gate does not prove

- **That a session obeys the bound reliably.** It obeyed once, watched by the person it was working with, and said in its own words why it was not repeating #37. One session is not a rate — over-obedience is invisible here too, and a session that judges the bound wrong would look exactly like one that judges it right until someone reads the branch.
- **That the work reaches a pull request through the loop afterwards** (step 7), since the run was stopped at planning.
- **That handing back works from any step but this one.** One path was driven: a stop at *asking what you need*, handed back to *writing down what it needs*.
- **That the round trip survives a session dying mid-step.** It was killed here by accident, not by design, and what the machinery would have done about it was cancelled rather than watched.
