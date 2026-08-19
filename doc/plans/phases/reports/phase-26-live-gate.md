# Phase 26 — Live Gate Report (26f)

- **Date:** 2026-08-19, 07:49Z – 08:20Z
- **Plan:** [phase-26.md](../phase-26.md) — 26f
- **Fixture:** `scratch-app` [#39](https://github.com/fvermaut/scratch-app/issues/39). **`ivtrends` was not touched.**
- **Isolation:** the daemon ran with `--manifest` naming `scratch-app` alone and `--state` pointing at a **copy** of the ledger. The live `.timone/state.json` is byte-identical before and after (`md5 ac05d7a42597608d53426b8b3f1808b0`) and was **hand-edited zero times**.
- **Cost:** $0.72 recorded across two sessions, plus one requirements session killed at 8m31s whose cost was never printed.
- **Tickets are machine-typed.** The fixture ticket, both answers on it and both handback notes were written by this session. Which of those the plan asked for, and which it did not, is said below.

## Outcome in one line

**Four of the seven steps are observed, one defect was found and fixed mid-gate, and the two steps that need a person at a keyboard are fvermaut's.** The round trip works: a note handed the run back, the machinery claimed the branch and started the named step by itself, and the ticket stopped saying it was stuck.

## What #37 cost this gate, and why the fixture is new

**The plan named `scratch-app` [#37](https://github.com/fvermaut/scratch-app/issues/37) as the fixture and said not to tidy it up.** By the time this phase was built it had tidied itself away: the takeover session fvermaut opened on 2026-08-18 — running the *old* prompt, before 26d existed — carried the whole feature through building, checking and delivering, and left **pull request [#38](https://github.com/fvermaut/scratch-app/pull/38) open**. That is the behaviour this phase exists to stop, demonstrated once more, and it left nothing for a handback to hand back.

So the gate ran on a fresh ticket, driven to the same stop in two cycles for $0.72.

## Step 1 — a takeover unblocks and stops

**Not run, and it is the one step that cannot be run from here.** It needs a session at a keyboard, working with a person; the prompt's new bound is a rule about what such a session does with its freedom, and a stub cannot exercise it. What *is* checkable without a session is checked by test: the prompt forbids application code and a pull request in as many words, gives the reason, and carries the note's exact shape and the list of names it may use.

**#37 is the evidence for why the bound was needed**, and it is not evidence that the bound works.

## Step 2 — the ticket reads as a round trip

**Partly observed, and only for the words this session wrote.** Both handback notes on the fixture were hand-written by this session — one deliberately naming a step nobody defined, one naming a real step. What a *session* writes into that comment is step 1's, and unobserved.

## Step 3 — the next cycle carries the work on

**Observed.** With the run stopped at *asking what you need*, a note naming *writing down what it needs* produced, on the very next cycle and with nothing typed:

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

**Not run.** It is a full build, check and delivery on the fixture — the expensive half of the gate — and it follows step 1. Left for fvermaut to start when he wants it.

## The defect this gate found, and the fix

**A refused note could not be corrected, so the refusal was a trap.** The reader took the **first** handback note after the stop. Step 5 left a note naming a step nobody defined; the ticket did exactly the right thing and asked the person to come back and say where to pick it up — and the note they would come back with **could never be read**, because the bad one was already there and would answer for ever.

**It is the shape of the bug this whole phase exists to remove, one turn deeper:** a call to action that cannot be acted on, on a run with no way out.

**Cause:** `readHandback` inherited `readStageOutcome`'s rule without the difference being noticed. A stage's outcome is one closing comment and a second would be a contradiction; a handback is a message a person and a session can get wrong and correct.

**Fix (`outcomes.ts`):** the newest note wins. It cuts both ways deliberately — a good note corrected to a bad one is refused, because the machinery must not act on something its own last word withdrew. Two tests, and the fixture proved it live: the corrected note was read on the next cycle and started the work.

**Found for the price of one hand-written comment**, by following the plan's own step 5. The three defects this phase and the last have found were all in prose or in a rule about prose, and none of the 1096 green tests could see any of them.

## Smaller observations, not defects

- **The refusal's words survived contact with the situation that produces them.** *"That's mine to get wrong, not yours"* reads as intended on a real ticket, under a real name nobody defined.
- **A cycle that spawns a session runs for as long as the session does.** Obvious in hindsight, and worth writing down: a ten-minute limit around `daemon --once` kills whatever the session was doing. Anything driving a real stage session should run it in the background.

## What this gate does not prove

- **That a session opened on a stop obeys the bound** — writes the words, not the software, and hands back. That is step 1, it needs a person, and it is the whole of ADR-0035 D1.
- **That what a session writes in the note reads well to a person** (step 2's other half).
- **That the work reaches a pull request through the loop afterwards** (step 7).
- **That handing back works from any step but this one.** One path was driven: a stop at *asking what you need*, handed back to *writing down what it needs*.
- **That the round trip survives a session dying mid-step.** It was killed here by accident, not by design, and what the machinery would have done about it was cancelled rather than watched.
