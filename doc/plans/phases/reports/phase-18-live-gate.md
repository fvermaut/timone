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

## What is still owed

- **Steps 2 and 3**, which are the whole of the written path and include the discriminating case. Until they run, [R20](../../specs/prd/prd-02-inversion-of-control.criteria.md)'s third criterion and [R3](../../specs/prd/prd-02-inversion-of-control.criteria.md)'s new clause have been observed only against fixtures.
- **The remaining six tickets**, as their blockers close.
- Findings 1–4 above, none of which is fixed here.
