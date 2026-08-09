# Phase 18 — 18e, the live gate

- **Date:** 2026-08-09
- **Target:** `ivtrends`, the real project whose nine unanswerable decision tickets are why this phase exists
- **Run by:** an execution session, on fvermaut's instruction, with him reachable but not at the keyboard
- **Outcome:** **partly discharged.** Steps 1, 4 and 5 pass on real tickets. Steps 2 and 3 are outstanding and cannot be run without him — they require *his* answers to *his* questions, and no one else's would prove anything.

## What was done

**Three tickets marked, not nine.** The plan said nine. Two findings, both discovered while preparing the gate, say three is the right number today — see "Findings" below. `#5`, `#6` and `#9` are the frontier: every blocker of each is closed. The other six say "nothing needed from you on this one yet", which remains true, and marking them would have the machine invite answers to questions their own bodies say are not ready.

**Step 1 — the CTA blocks replaced, not appended to.** `#5`, `#6` and `#9` carried a hand-written block ending *"There is meant to be a second way to answer this — opening it as a conversation in your terminal… **That isn't available yet.**"* That sentence is now false, and it was the one thing the phase file warned twice must not survive. Each body was truncated at its separator and the real `grilling` template from `timone-wayfind` written in its place, with the ticket's own number substituted. Verified afterwards: zero occurrences of the stale claim remain. The five blocked tickets and the prototype were left alone — their blocks say "nothing needed yet" and never claimed the terminal option existed, so they carry nothing stale.

**The mark label did not exist in the repository** and was created (`timone`, the value of `MARK_LABEL`). Worth recording because it is a step nobody had written down: a project onboarded before this phase has no such label, and marking a ticket in a repository without one silently fails.

## Step-by-step outcome

| Step | Expected | Result |
|---|---|---|
| 1 — replace the hand-written CTAs | the real per-type templates, takeover line now true | **PASS** — three bodies replaced; stale claim gone |
| 2 — answer one in writing, completely | daemon picks it up unprompted, session resolves and closes the ticket, gist onto the map | **NOT RUN** — needs fvermaut's answer |
| 3 — answer another partially, then unsatisfyingly | exactly one follow-up carrying only what is still open; then a takeover CTA and no third question | **NOT RUN** — needs fvermaut's answers; **this is the discriminating step** |
| 4 — `timone takeover ivtrends#<n>` on a third | it resolves and opens the interview | **PASS** — see below |
| 5 — leave one untouched across two poll cycles | nothing said twice | **PASS** — three quiet cycles, comment count unchanged |

**Step 4, the one this phase was written for.** On 2026-08-09 the command refused:

```
$ node dist/cli.js takeover ivtrends#5
I'm not working on ivtrends #5. Add the `timone` label to that ticket and I'll pick it up.
```

After marking and one poll cycle:

```
pickup ivtrends#5
parked ivtrends#5 at wayfinding, waiting on a conversation
spawn  ivtrends#5
```

and `resolveTakeover` — the function the command is, called directly so the gate did not open an interview that is fvermaut's to hold — answers:

```
ivtrends#5 -> converse at stage "wayfinding"
ivtrends#6 -> converse at stage "wayfinding"
ivtrends#9 -> converse at stage "wayfinding"
```

**The control was run in the same breath and matters as much as the result.** Before `#6` was marked, it returned the *old* refusal verbatim — so what changed is the mark and the routing, not something incidental about the day.

The ledger entry is what 18b's assertion said it would be: `status: "parked"`, `waitingKind: "conversation"`, `stage: "wayfinding"`, no branch. `timone status` renders all three as *waiting on you: a conversation in your terminal*.

**Step 5.** Three consecutive further cycles produced **no output at all** and left every ticket at exactly two comments. The park holds and does not re-fire.

## Findings

Four, and the first two are the reason three tickets were marked rather than nine.

1. **Marking several tickets in one cycle queues all but the first, and tells them so in words that are wrong here.** `pollProject` registers every listed ticket before any of them parks, so the second onward are `queued` and each receives *"I'm already working on #5 for this project, and I take one thing at a time so two pieces of work never collide."* Nothing is colliding — they are questions waiting on a human, and a branchless conversation park holds nothing. Marking one at a time avoids it entirely (each parks and releases before the next is registered), which is what was done here: **zero queue comments were posted.** This is the open question the prior handover raised — *does R10's one-run-per-project fit a nine-ticket map?* — and the answer observed today is that it fits badly enough to be worth changing.
2. **The daemon has no notion of blocking.** A `Blocked by` line is prose in the body; nothing reads it. Mark a blocked ticket and it parks and invites an answer, directly contradicting its own body. Five of the nine are in that state, which is why they were not marked.
3. **The park comment opens in the wrong stage's voice.** `conversationSubject` produces *"Before I write down what "<title>" actually needs, there are a few things I want to check with you"* — written for stage 2's clarification mode, where a PRD does follow. The wayfinding prompt explicitly forbids writing the destination artifact ("no requirements, no PRD, no phase file"), so the comment promises the one thing the session must not do. Cosmetic in effect, wrong in substance, and it is the first thing a human reads.
4. **The invitation now appears twice on a marked wayfinder ticket** — once in the body, from the skill's template, and again in the park comment, from `TerminalChannel.open`. They say the same words, so nothing contradicts; but a reader meets the same block twice, and the body copy is the one that is stale the moment anything about the invitation changes.

## What was still owed after the first sitting

- **Steps 2 and 3**, which are the whole of the written path and include the discriminating case. Until they run, [R20](../../specs/prd/prd-02-inversion-of-control.criteria.md)'s third criterion and [R3](../../specs/prd/prd-02-inversion-of-control.criteria.md)'s new clause have been observed only against fixtures. **Discharged the same day on `scratch-app` — see below.**
- **The remaining six tickets**, as their blockers close. Still owed.
- Findings 1–4 above, none of which is fixed here. Still owed; **finding 3 reproduced** on the second project, and a fifth is added below.

---

# Steps 2 and 3 — discharged on `scratch-app`, 2026-08-09

- **Target:** `scratch-app`, the fixture project, **not `ivtrends`**
- **Run by:** an interactive session at the timone root, against the daemon fvermaut already had running
- **Outcome:** **both pass.** The written path works end to end, and the bound holds.

## Why the target changed, and what that costs

The plan said `ivtrends`, and the first sitting said these two steps needed *fvermaut's own answers to his own questions*. **He declined to use `ivtrends` as a guinea pig**, which is his call to make and a reasonable one: steps 2 and 3 exercise a machine, and the price of exercising it on live product decisions is machine-authored resolutions landing on decisions that are actually his. So a throwaway map was charted on `scratch-app` — the same project every prior live gate has used — and the two steps run there.

**What that buys and what it does not.** It buys the whole mechanism, live: a real tracker, the real daemon on its real poll loop, real sessions, real ledger transitions. **It does not buy the human.** The answers below were written by the session running the gate, in the voice of a user, and no real human read a word of it. That matters for exactly one thing — whether the follow-up question is one a *person* would find reasonable — and for nothing else. Every clause in [R3](../../specs/prd/prd-02-inversion-of-control.criteria.md) and [R20](../../specs/prd/prd-02-inversion-of-control.criteria.md) is about what the machine does with a comment, and a comment is a comment whoever typed it. **The one judgement still unwitnessed by a human is whether the escalation fires at the right moment**; the gate could only make an answer that was unsettled *by construction*, and a real conversation would be muddier than that.

The fixture, all three tickets throwaways carrying that word in their titles:

| Ticket | Role |
|---|---|
| [#17](https://github.com/fvermaut/scratch-app/issues/17) | the map — `wayfinder:map`, **unmarked**, per the never-mark-the-map rule |
| [#18](https://github.com/fvermaut/scratch-app/issues/18) | `wayfinder:grilling`, marked — step 2, answered completely |
| [#19](https://github.com/fvermaut/scratch-app/issues/19) | `wayfinder:grilling`, marked — step 3, answered partly, then unsettleably |

Both decision tickets carry the `grilling` CTA from `timone-wayfind` verbatim, with their own numbers substituted. `wayfinder:map` and `wayfinder:grilling` did not exist on `scratch-app` and were created — the same gap the first sitting recorded for `ivtrends`'s mark label, now seen twice, which makes it a property of any project onboarded before this phase rather than an accident.

## Step 2 — a complete written answer

Marked at 16:20:25Z. Parked at 16:21:09Z with `waitingKind: "conversation"`, `stage: "wayfinding"`, no branch — the ledger shape 18b's assertion predicts. The answer was posted at 16:21:34Z as an ordinary comment: no keyword, no marker, nothing to remember.

```
16:21:42  issue=OPEN    run=parked
16:22:29  issue=OPEN    run=active     <- picked up unprompted, nothing was run by hand
16:23:58  issue=CLOSED  run=done
```

**Two minutes twenty-four from comment to closed ticket, with no human touching anything.** The resolution comment carries `CONVERSATION_RECORD_MARKER`, restates what was understood, and closes. The gist landed on the map under "Decisions so far", and the map's "Not yet specified" section was tightened at the same time.

**It did the thing the prompt asks for and the plan only hoped for: it answered from the codebase instead of asking.** Unprompted, the session checked the app and reported that most of the answer was already how the app behaves, that only the greying was missing, and — unasked — that the grey would have to stay readable for low vision. That is the accessibility baseline asserting itself through a stage that was not told to think about it.

**The failure 18c was written to prevent did not occur.** The invitation was not re-posted, and the question was not re-asked. `git status` in `projects/scratch-app` is clean and no commit landed: wayfinding produced a decision and no deliverable, as its prompt requires.

## Step 3 — the discriminating one

Marked and parked, then answered **partially** at 16:25:28Z: the answer settled how an overdue item should *look* and said nothing about where it should *sit*.

**Exactly one follow-up, carrying only what was open.** Posted 16:28:05Z under `❓ Still open`, it opened by restating the settled half as settled, asked the ordering question alone, offered a recommendation with a reason, and told the human that one line would do. It then re-parked. **The whole question was not re-asked**, which is the clause ADR-0022's written path exists for.

Then the deliberately unsettleable answer at 16:28:52Z — wanting overdue items at the top *and* refusing a list that rearranges itself, closing on "it depends on the day".

**The bound held.** At 16:31:00Z, one comment, no third question:

> **This one needs a conversation, and I'd rather say so than keep typing at you.** … Those two pull in opposite directions, and your own answer says which one wins depends on the day. That isn't something I can settle by putting the same question to you a third time in writing, so I'm stopping and handing it back.

It named the contradiction rather than blaming the answer, **held what was already settled** ("the look is settled and I'm holding it"), said what it had checked in the app rather than asking, floated a middle way to discuss out loud, and ended on the takeover command. The run stayed parked on a conversation.

**The hand-back's command is not a decoration.** Called directly, so the gate did not open an interview:

```
scratch-app#19 -> converse at stage "wayfinding"
scratch-app#18 -> nothing-to-do | scratch-app #18 is finished — see the ticket.
scratch-app#20 -> nothing-to-do | I'm not working on scratch-app #20. Add the `timone` label…
```

Three outcomes from one function: the escalated ticket resolves, the ticket resolved in writing correctly refuses, and a ticket that was never marked returns the original 2026-08-09 refusal verbatim. The last is the control — it is the sentence this whole phase exists to stop being the answer for a *marked* wayfinder ticket, and it is still the right answer for an unmarked one.

## Step-by-step outcome, completed

| Step | Result |
|---|---|
| 1 — replace the hand-written CTAs | **PASS** (first sitting, `ivtrends`) |
| 2 — answer one in writing, completely | **PASS** (`scratch-app` #18) — picked up unprompted, resolved, closed, gist on the map |
| 3 — answer another partially, then unsatisfyingly | **PASS** (`scratch-app` #19) — exactly one follow-up carrying only the remainder, then a takeover hand-back and no third question |
| 4 — `timone takeover` on a third | **PASS** (first sitting, `ivtrends`) |
| 5 — untouched across two poll cycles | **PASS** (first sitting, three cycles) |

## What `ivtrends` was left holding

**Nothing was done to it in this sitting.** Its three marked tickets — #5, #6, #9 — sit parked exactly as the first sitting left them, at two comments each, and one of them was being taken over interactively in a parallel session while this ran. No comment, no label and no body edit was made on that project here.

## A fifth finding

5. **A conversation that hands back leaves the run parked with no record of having escalated.** `scratch-app` #19's ledger entry after the hand-back is indistinguishable from its entry before the first answer: `parked`, `wayfinding`, `waitingKind: "conversation"`, only the cursor moved. The one-clarifying-round bound is therefore enforced by *the thread* — the session reads its own prior clarification comment and counts — exactly as the phase's load-bearing decision says it should be. That is consistent, and it works. What it costs is that `timone status` says "waiting on you: a conversation in your terminal" in the same words for a ticket that has never been answered and for one that has been answered twice and handed back. The human cannot tell from the status line which of their tickets have gone as far as they can in writing.

**Finding 3 reproduced**, on a project that had never seen a wayfinder ticket: `scratch-app` #18's park comment opened *"Before I write down what "Fixture: how should a ticked-off item look in the list?" actually needs…"*, promising a write-up the wayfinding prompt forbids. It is the first sentence a human reads on any wayfinder park, and it is wrong on both projects.
