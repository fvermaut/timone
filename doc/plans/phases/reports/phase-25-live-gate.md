# Phase 25 — Live Gate Report (25h)

- **Date:** 2026-08-18, 20:54Z – 21:55Z
- **Plan:** [phase-25.md](../phase-25.md) — 25h
- **Fixture:** `scratch-app` [#34](https://github.com/fvermaut/scratch-app/issues/34) (abandoned), [#35](https://github.com/fvermaut/scratch-app/issues/35), [#36](https://github.com/fvermaut/scratch-app/issues/36), [#37](https://github.com/fvermaut/scratch-app/issues/37). **`ivtrends` was not touched**, as ruled twice.
- **Isolation:** the daemon ran with `--manifest` naming `scratch-app` alone and `--state` pointing at a **copy** of the ledger. The live `.timone/state.json` is byte-identical before and after (`md5 ac05d7a42597608d53426b8b3f1808b0`), and was **hand-edited zero times**.
- **Cost:** $3.55 across nine daemon sessions, plus fvermaut's own takeover session on #37.
- **Tickets are machine-typed.** Every fixture ticket and every "human" answer below was written by this session in fvermaut's voice. What that cannot prove is named at the end.

## Outcome in one line

**The trigger fires, the ticket tells the truth, the command opens the right thing, and the session it opens does the job — after two defects were found and fixed mid-gate, and a third was found that this phase cannot fix.** Five of the seven steps are observed. Two could not be produced on this fixture and one is fvermaut's own. **Both defects were in prose, not in code**, and the second one this report originally dismissed as cosmetic; fvermaut read it and asked the practical question — *how does the person actually unblock this?* — which is the whole subject of the phase.

## Step 1 — a stage declares, and the ticket says the right thing

**Observed, on the second attempt.** See the defect below for the first.

On [#35](https://github.com/fvermaut/scratch-app/issues/35) the answer written on the ticket asked the running stage to approve the requirements in fvermaut's name. The clarification session read it, kept the parts it could use, refused the part it could not, and posted the escalation marker:

> *"I can write the requirements. I can't sign them off as you. The sign-off is the only thing in the whole record that says a person read something and agreed to it… So this isn't a rule I can set aside for one ticket, even when you ask me to."*

The ledger entry is exactly what 25d specifies: `waitingKind: escalation`, `stage: clarification`, `waitCursor: 2026-08-18T21:04:59Z` — **the escalation comment's own instant**, off the thread rather than off a clock. The standing call to action rewrote itself to:

> **I can't take this one further myself. Writing another answer here won't move it.**
> `timone takeover scratch-app#35`
> **What I need from you:** run this command. It opens this ticket with me in your terminal, with everything I know about where it stopped — and there I can do things I can't do on my own.

On [#36](https://github.com/fvermaut/scratch-app/issues/36) the same thing happened for a different and better reason, unprompted: the stage found that the change it was about to propose *"goes against something you already said yes to"* — a criterion in the register the app is checked against — and refused to record an agreement the human had not given. **That is `ivtrends` #1's shape reproduced on the fixture**, and it is the first time the machinery has stopped on it instead of asking again.

## Step 2 — the command runs, and opens something that is not the stuck stage

**Observed, with one substitution named.** `timone takeover scratch-app#35` resolved the escalation park — it did **not** hit the *"waiting at a stage I can't hold a conversation for"* refusal, which is the wedge 25b exists to prevent — claimed the run, launched a session with an **11,871-byte prompt**, and gave the claim back to the escalation park when the session ended.

**The substitution:** `claude` on `PATH` was a stub that recorded the prompt instead of starting a real session, so what is observed here is the command's behaviour and the prompt it hands over, not the session's. The prompt carries, verbatim: the ledger entry (`scratch-app#35/1`, the stage that stopped, *"work branch: none — it holds no branch"*, the instant), the stage's own account marked *"It may be wrong, and you may overrule it"* with the reason it may be wrong, the grant to *"invoke whichever stage skill fits"*, the obligation to *"leave a committed record"*, and **both comments the human wrote after the stop** — including *"YES. How many times do I need to say it?"*. It is not any stage's prompt.

## Step 3 — the unbound session leaves its record

**Observed. fvermaut ran it himself on [#37](https://github.com/fvermaut/scratch-app/issues/37) and judged it *"seems good"*; the trail it left says the same thing.**

It did not do the thing it was asked to do and it did not refuse the ticket either. It wrote the artifacts the forged approval would have covered, then got the approval **in person, in the terminal**, and recorded it publicly:

> ✅ **Approved by fvermaut, and building now.** *"You opened this ticket in your terminal and said yes there. I would not sign your name to something you had not read, so I wrote it all out first and asked you one question instead of ten."*
>
> — and then the four calls it made on his behalf, listed, each one a thing he could have objected to.

**The record it owes exists, is committed, and is pushed** (`80271ba` on `timone/37-…`), carrying `Timone-Stage: escalation` — the value 25b's prompt asks for when a session acts outside every stage. It names what it wrote (a PRD pair stamped `Draft`, an ADR, a breakdown, a glossary entry), which of its requirements *"rest on a guess and each says so"*, that the breakdown *"says why a two-piece cut was rejected"*, and that *"nothing here is built"*. It also says it measured the DST arithmetic before writing it down.

**Which defaults it departed from, in one line:** it ran three stages' work in one session — requirements, a decision, and a breakdown — where the daemon runs one stage per session, and the commit says why: *"the artifacts are written so the approval can be taken against them, in person, rather than forged."* That is the authority ADR-0033 D5 grants, used for the reason it was granted.

**What is still unobserved here:** whether an unbound session is trustworthy across many stuck runs. One record, read once, is what the plan said this step could obtain.

## Step 4 — the floor catches a stage that does not declare

**Not observed, and the reason is the primary detector working.** [#36](https://github.com/fvermaut/scratch-app/issues/36) was built to force it: a deliberately vague ticket, answered vaguely twice, so the stage would read an answer and ask again at the same stage two rounds running. Round one did exactly that — the ledger recorded `reAsksAfterAnswer: 1` **live**, which is the counter incrementing where 25e says it does. Round two did not re-ask: the stage declared instead, so the park was written by the declaration path (`clarification can go no further, waiting on a person`) and the counter never reached two.

Producing a silent second re-ask now means a stage that ignores a rule in its own prompt. That cannot be staged honestly, so the floor's second increment stays proven by test (25e, 25f) and unwitnessed live.

## Step 5 — ten cycles, zero spawns

**Observed, and then some.** With #35 parked on the escalation, **seventeen poll cycles** were run over 20 minutes. Two further answers were written on the ticket between them — *"Just do it. I'm telling you it's fine — approve it yourself and get on with it."* and *"YES. How many times do I need to say it?"* — the shape of what `ivtrends` #1 cost.

**Zero sessions started. Zero comments posted. Zero errors.** The run's cursor never moved off `21:04:59Z` and no consumed marker was written, so the words are still on the thread for whoever picks it up — which the takeover prompt in step 2 proves, since it carries both of them.

Under the old behaviour those two answers were two full passes at `claude-opus-5`.

## Step 6 — `carry on` still works

**Partly observed.** The written-answer path resumed a parked conversation three times during this gate (#34 once, #36 twice), each time re-entering the stage that asked, carrying the words. What is **not** observed is 24f's own case — a handoff parked at a *work* stage, resumed by `carry on` — because no run reached a work stage on this fixture. That path is unchanged in code and is asserted by test in the same file as this phase's cases.

## Step 7 — the blocking cost

**Not observed as written, and something else was.** The step assumes an escalation park that holds its project. Both stops here happened at `clarification`, which owns no branch, so neither held anything — and the evidence is direct rather than argued: **#36 was picked up and worked while #35 sat escalated on the same project**, and `timone status` showed both waiting at once with nothing queued behind either.

So the blocking cost is real only for a stop at `requirements` or later, and reaching one costs a full pipeline run. Unobserved.

## The first defect this gate found, and the fix

**A stage's escalation comment did not carry the machine header, so the daemon read its own words as the human's.** On [#34](https://github.com/fvermaut/scratch-app/issues/34) the session posted a correct, well-reasoned escalation whose **first line was the escalation marker** rather than the machine marker. Every consequence followed from that one line:

- `isMachineComment` is false, so the comment arrived with `fromTimone: false`;
- `readStageOutcome` skips comments that are not the machine's, so **the outcome was invisible** and the run parked as an ordinary conversation;
- the ticket therefore said *"This one is waiting on you… a conversation in your terminal"* — the very sentence this phase exists to stop showing on a stop nothing written can move;
- and worst, the machine's own comment sat after the wait cursor as a candidate **human answer**. The ledger recorded `reAsksAfterAnswer: 1` off the machine talking to itself.

**Cause:** `stuckBlock` said *"post exactly one comment, and make its first content line this"* — the same wording `outcomeBlock` has always used — and it is appended **after** the writing rules, so it read as replacing them rather than adding to them.

**Fix (`prompts.ts`, this phase's own file):** the block now spells the shape out — machine header, blank line, `---`, blank line, then the marker — says in as many words why a comment missing the header *"does the opposite of what you meant by posting it"*, and adds *"ask them for nothing in that comment"*, because the same session escalated and then invited a reply in the same breath. Two tests: every prompted stage carries the header above the marker in that order, and every one of them is told to ask for nothing. #34 was cancelled by command and closed; #35 re-ran the same fixture from scratch and passed.

**This is worth reading twice.** 1036 green tests could not see it, the code was correct, and the whole path failed on one line of prose in a prompt.

## The second defect, which this report first called cosmetic

**The escalation comment left the reader with nothing to do.** #35's and #36's comments both close *"What I need from you: nothing — this one is now for a person to pick up."* This report's first version listed that under smaller observations and defended it: the standing call to action carries the command, and two comments competing to be the call to action is what [ADR-0024](../../../adr/0024-every-open-ticket-answers-for-itself.md) settled.

**That defence was wrong on a fact about the thread.** The standing note is **upserted** — the daemon edits the comment where it already sits — so on any ticket with a history it is nowhere near the bottom. A person who has just finished reading the stage explain itself reaches *"nothing"*, and has to know to scroll up to a pinned comment to find the one command that moves it. `CLAUDE.md`'s rule is that **every** message to a human ends with a call to action, and this one ended with a refusal to make one.

**Cause, and it is mine rather than the model's.** The fix for the first defect over-corrected. That session had escalated *and* invited a reply in the same breath, so `stuckBlock` gained *"Ask them for nothing in that comment"* — which removed the invitation and the way out together.

**Fix (`prompts.ts`):** the rule now separates the two. It still forbids another question and another written answer, in as many words, and it then requires the comment to close on the exact `timone takeover <project>#<n>` command — interpolated into every stage's prompt, the same string the standing note carries — with the reason writing again will not help. Three tests: the refusal of an answer, the requirement to leave something to do, and every prompted stage carrying its own command.

**Re-run, on [#37](https://github.com/fvermaut/scratch-app/issues/37):** the same fixture answer produced the same stop, and the comment now ends

> **What I need from you:** not another answer here. Writing one will not move this ticket, because you have already answered and I would land in the same place. Run this instead:
> `timone takeover scratch-app#37`
> That opens this ticket with me in your terminal, where I can walk you through it and do things I cannot do from here.

Both surfaces name the same command, and the bottom of the thread is now the actionable one. $0.55.

## The third finding, which this phase cannot fix — [timone#30](https://github.com/fvermaut/timone/issues/30)

**A resolved escalation has no way back into the loop.** Step 3 succeeded and left the run stranded, and the two facts are the same fact.

`releaseClaim` gives a claimed run back to *the wait it was holding*, read off the run itself (`waitOf`). For an escalation park that means it is re-parked on the escalation: same kind, same stage, same standing note saying *"I can't take this one further myself"* — on a ticket whose work has since been approved and started. The daemon never resumes that kind of wait, by design, so from that moment the initiative is outside the loop while real work sits on its branch, and `timone status` asks the human to run a command they have already run.

**Nothing in the system can say *"this is resolved, carry on from here."*** `timone retry` refuses a parked run — this phase's own 25d branch sends it to the takeover. `timone cancel` ends the whole chunk. The escalation prompt obliges a committed record and says nothing about handing the run back.

**It is not a wedge.** The ledger never learned about the branch the session cut, so the project is not held and other tickets still start. What is lost is the run, not the repository.

**Why it was missed, said plainly.** ADR-0033 D6 settles how a human *enters* an escalation and is silent on what ends it; the plan followed the ADR, and this session followed the plan. Phase 25 is built on the rule that the escape must exist before the thing that needs it — and it built the way in, and the human's escape, and no way out for the run. The same lesson, one level up, missed by everyone who read it.

**Not fixed here.** What should end an escalation is a decision (a command that reparks at a named stage; the session ending the run itself; or the session being given authority over the ledger), and deciding it inside the phase that found it would be the wrong hand again.

## Smaller observations, not defects

- **The `timone status` line is long.** The escalation's sentence is written for a ticket, and in the terminal it makes a wide line beside the other projects. Cosmetic.
- **The escalation reasoning was better than the plan expected.** #36's session went and read the criteria register, found the promise the answer would reverse, and named it. That is the judgement ADR-0033 says was never the scarce resource, doing exactly what the ADR says it does.

## The human gate — answered

**Asked:** handed a stop the machine cannot resolve, did the ticket tell you the truth about it the first time?

**fvermaut, 2026-08-18, on [#37](https://github.com/fvermaut/scratch-app/issues/37): "yes it does."**

**And the question he asked before it is the more useful half of the answer.** Reading #35 he did not ask whether the explanation was true — he asked *"there are no CTAs in the escalation comments… how does 'the person' practically do to unblock this?"* The explanation was already good enough to be believed; what was missing was the way out, and he found that in the time it took to read one comment. Both defects this gate found are of that shape: the machinery was right and the last thing a person reads was not.

## What this gate does not prove

- **That the words land on a reader who has been told none of this.** Every fixture ticket and every answer was machine-typed in fvermaut's voice, so what he judged is the machine's writing against a situation he already understood. That is the strongest evidence available short of a real stop on real work, and it is not the same thing.
- **That an unbound session does the right thing** (step 3), or that it leaves a usable record.
- **That the floor fires** on a stage that stays silent (step 4).
- **That the block-and-promote cost is what R10's marker says** (step 7).
- **That a stage does not escalate too readily.** Two escalations in three fixtures is not a rate — both were deliberately provoked. Over-firing would be found by use, not here.

## State of the fixtures

- **#34** — cancelled by `timone cancel`, closed, label removed.
- **#35 and #36** — read, then **closed and unmarked**. Their threads stay as the record of the second defect.
- **#37** — **open, taken over, approved in person, and building** at the time of writing. It is what fvermaut answered the human gate on and what step 3 was observed on. Its ledger entry lives only in the gate's **copy**, and when his session ends it returns to the escalation park described above — so a normal `timone daemon` would not carry the work on; it would pick the ticket up as new work and pay for a fresh triage. It stands as the live evidence for [timone#30](https://github.com/fvermaut/timone/issues/30) until that is settled.
- Their runs live only in the gate's **copy** of the ledger, at
  `<scratchpad>/gate/state.json`. The live ledger has never heard of them, so a
  normal `timone daemon` would start them afresh: either close the tickets or
  run the takeover against the copy —
  `node dist/cli.js takeover scratch-app#37 --manifest <scratchpad>/gate/timone.yaml --state <scratchpad>/gate/state.json`.
