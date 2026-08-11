# Phase 18 — Verification Report

- **Date:** 2026-08-11
- **Phase:** [phase-18.md](../phase-18.md) — stamped `Complete`, completion report [phase-18-complete.md](phase-18-complete.md), live gate [phase-18-live-gate.md](phase-18-live-gate.md)
- **Scope:** claimed set **PRD-02.R3, PRD-02.R20**
- **Regression set (derived):** **R1, R2, R4, R5, R6, R7, R8, R13, R14, R18** — every criterion that is MUST + `api` + `verified` in [the register](../../../specs/prd/prd-02-inversion-of-control.criteria.md) at this HEAD. R9, R10, R12, R15, R16, R19 are SHOULD; R11 and R17 are `draft`; R3 is `revised` and in the claimed set.
- **Branch:** `main` @ `8242e5d`, clean. No phase branch — phase 18 followed phases 15–17 in committing directly, recorded as a deliberate deviation in its completion report. There is therefore no parent branch to merge and no stale-ancestry hazard.

## Environment

Timone's production form is the compiled CLI, not `tsx`. `npm run build` (tsc, clean) then `node dist/cli.js …` throughout; `npm run type-check` clean. The daemon was driven with `daemon --once` rather than left running, so each poll cycle is a discrete, attributable act — and because a cycle spawns real agent sessions, every one of them is accounted for below.

Build-health smoke, run once and reported as exactly that: **`npm test` — 662 passed, 20 files, 38.3s.** It is not criterion evidence and nothing below rests on it. It did not contradict any probe. The completion report's "one unidentified intermittent test failure, seen once in eight full-suite runs" did not recur in this pass's single run, which neither confirms nor clears it.

**All live probing was done on `scratch-app`, the fixture.** `ivtrends` was read but never written to: no comment, no label, no body edit, no takeover, no cycle. Everything below drawn from `ivtrends` is read-only observation of what its tickets already carry.

## Independence declaration

**Read:** [the PRD-02 criteria register](../../../specs/prd/prd-02-inversion-of-control.criteria.md) (whole), [the PRD-02 narrative](../../../specs/prd/prd-02-inversion-of-control.md), [phase-18.md](../phase-18.md) down to but not into its sub-phase bodies, [phase-18-complete.md](phase-18-complete.md) (whole), [phase-18-live-gate.md](phase-18-live-gate.md) (whole), `README.md`, `CONTEXT.md`, `timone.yaml`, `.timone/state.json`, and the daemon's own CLI help.

**Two departures from the closed allowed list, declared rather than glossed:**

1. **The phase file was read past its header** — through "Goal Description" and "Context & Prerequisites", which name load-bearing decisions and some source files. The sub-phase bodies were not opened. This gave me build knowledge the allowed list exists to withhold; where it could have shaped a probe I have said so, and the R20 clause 2 finding below is in fact *against* that knowledge rather than in sympathy with it.
2. **The live gate report was read**, on the invocation's explicit instruction to weigh it. It is an observation record rather than a build narrative, but its observations are the builder's. **It was read only after every first-hand probe below had been run and recorded**, so nothing here is a confirmation of it. Where this report and the gate report agree, they agree from independent measurements; where they disagree, that is called out.

**Not read:** `phase-18-handoffs.md`, any diff or `git show` of code, anything under `src/`, the committed test suite, ADR-0022 or any other ADR. No implementation source was read. All criterion evidence below comes from probes I authored from the register's clauses.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R20 | MUST | api | **FAIL** — clause 2 fails against its literal text; clause 1 observed for one of four ticket types; clause 3's mechanism reached, defectively | 0 |
| PRD-02.R3 | MUST | api | **FAIL** — clauses 1 and 2 PASS on real tickets; clause 3's path reproducibly spawns two sessions per answer | 0 |

## Evidence

### PRD-02.R3 — FAIL

**Clause 1 — a conversation is opened, the CTA carries the exact takeover command, `timone status` shows a waiting gate, no further stage runs. PASS.**

Observed on six real `ivtrends` tickets (#10–#15) and, first-hand, on two fixtures I marked myself (`scratch-app` #21, #22). Each park writes a comment carrying the command in a fenced block with the ticket's own number substituted — `timone takeover scratch-app#21`. The ledger entry is `status: "parked"`, `waitingKind: "conversation"`, `stage: "wayfinding"`, no branch. `node dist/cli.js status` renders all six `ivtrends` parks as *waiting on you: a conversation in your terminal*. No further stage ran on any of them.

**Clause 2 — the conversation concludes, the accepted summary is posted, the pipeline resumes. PASS.**

Re-observed on five real `ivtrends` tickets resolved since the phase landed — #5, #6, #7, #8, #9 — each closed carrying a `✅ Agreed · the record of a conversation, accepted by the human` comment of 2.4k–7.4k characters. These are substantive records, not transcripts: #8's opens by stating that two of its three framing variables had been removed by decisions taken since, and says so plainly. Their runs are `done`.

I classified every comment on those threads by the machine marker rather than by author, because **every comment on both repositories posts under `fvermaut`'s GitHub account** — the machine's own comments say so in their first line. The probe is in `probe-threads.sh` and is discriminating in both directions: it labels the two hand-written map updates of 2026-08-09T08:56 on #7 and #8 `HUMAN` and everything else `MACHINE`, and on the fixtures below it correctly separates my typed answers from the machine's replies.

One shape difference worth recording rather than treating as a failure: on a wayfinder ticket the run **completes** rather than resuming into a later stage, because wayfinding produces a decision and no deliverable. "The pipeline resumes incorporating it" was verified in its pipeline shape at phase 12 and is unchanged here.

**Clause 3 — the daemon picks a written answer up, spawns the session, resolves without re-asking, posts only the remainder once, then hands back. FAIL.**

The pickup half is real and I watched it happen rather than taking it on report. On `scratch-app` #21 I marked a throwaway question, polled once to park it, posted an ordinary comment with no keyword and no marker at 14:18:28Z, and polled again. The daemon picked the comment up and spawned a session with nothing run by hand.

**What it then did is the defect, and it reproduced on the first attempt to reproduce it.** One written answer produced **two** independent agent sessions, each of which worked the question out from scratch, wrote a full `✅ Agreed` resolution, and closed the ticket:

| Fixture | Answer posted | Resolution 1 | Resolution 2 | Session in the daemon's log | Session in the ledger |
| --- | --- | --- | --- | --- | --- |
| `scratch-app` [#21](https://github.com/fvermaut/scratch-app/issues/21) | 14:18:28Z | 14:20:28Z | 14:20:54Z | `bd602ac4…` | `35bd31fb…` |
| `scratch-app` [#22](https://github.com/fvermaut/scratch-app/issues/22) | 14:23:36Z | 14:25:12Z | 14:25:45Z | `16b9d94d…` | `cde48b15…` |

The session id the daemon prints and the session id the ledger keeps **differ on both runs** — two sessions, not one comment posted twice. Both cycles then ended on an operator-visible error:

```
cost   scratch-app#22 (wayfinding) — 2m57s working · 24 turns · $0.97 · claude-opus-5 9.0k out
error  scratch-app: could not resume #22: Run scratch-app#22 cannot go from done to done (allowed: nothing — it is finished)
```

The two resolutions are independently written and differ in detail — #21's second cites a decision "settled four days ago on your *I can't tell at a glance how much is left* report" that its first does not mention. They happened to agree. **On #22 a third session then posted a comment about the duplication**, which is the sharpest single piece of evidence in this pass and is reproduced here as an observation, not as a cause I am endorsing:

> **But the duplication is the finding.** … Two separate runs picked up your one reply thirty seconds apart, both worked it out independently, both wrote it up, and both closed it — the second one arriving after the ticket was already closed. … **Why the usual safeguard did not stop it:** each run is supposed to put its name on the ticket before doing any work, so a second run sees the first one already there and stands down. The first run did put its name on it. The second run's check did not register that, and carried on. Harmless here — both answers matched, nothing about the app changed either way — but on a real question two runs could have reached two different conclusions and written both down as settled.

That last sentence is the criterion's stake. The clause exists so a human who answers in writing is answered once; what runs today answers them two or three times, bills two sessions ($0.91 and $0.97 for the tracked one of each pair, the untracked twin unaccounted), and reports an error to the operator on the happy path.

**The completion report predicted this and it was not read as a defect.** Its known-open observations list *"A double `getTicket` per cycle on the resume path"*. That is the same path, and this is what it costs.

On the partial-answer half of the clause: #21's answer settled the format and was silent on placement and on the all-done case, and neither session asked a remainder question — both judged the remainder answerable from decisions already on file and said which. That is defensible judgement rather than a breach, and I record it as observed rather than scoring it. **The remainder-once-then-hand-back behaviour did not fail here; it was not reached.** It was observed working on `scratch-app` #19 on 2026-08-09 — one `❓ Still open` comment carrying only the open half and explicitly holding the settled half, then a hand-back naming the contradiction and carrying the takeover command, with no third question. I read that thread in full and it is exactly what the clause describes. It is second-hand as to who typed the answers.

### PRD-02.R20 — FAIL

**Clause 1 — a CTA worded for its type. PASS for `grilling`; the other three types unobserved.**

The `grilling` form is on six real `ivtrends` tickets and both fixtures, and carries both paths verbatim — write here, or run the takeover — with the ticket's own number. That is one of four branches the clause names.

- **`prototype`** — `ivtrends` #11 is the only instance and it is *blocked*, so it carries "nothing right now — you'll get a link to click when there's something behind it" rather than the takeover the clause specifies. Its GIVEN is "a ticket a human is expected to act on", which #11 is not, so this is not a failure; it is an absence of evidence, and it means the clause's `prototype` branch has never been observed in the state it describes.
- **`research` and `task`** — `ivtrends` #2, #3 and #4 predate the phase and carry no CTA block at all. No post-phase instance of either type exists on either project.

Obtaining the missing three needs a map charted by an interactive stage-2 session, which is not this pass's to run.

**A live contradiction found while probing this clause, in the human-facing surface the clause is about:** `timone status` closes with *"answer on … ivtrends #11"* while #11's own body says nothing is needed. The status line and the ticket disagree about whether the human owes anything. This is the operator-visible consequence of the gate's finding 2 — the daemon has no notion of blocking — and I observed it first-hand.

**Clause 2 — takeover against a wayfinder ticket with no run in the ledger. FAIL.**

This is the clause R20's own preamble is written around: *"they have never had a run in the ledger … and why `timone takeover ivtrends#5` refused. This requirement is what makes them first-class."*

I built the precondition exactly and probed it. `scratch-app` [#20](https://github.com/fvermaut/scratch-app/issues/20), created open, labelled `wayfinder:grilling`, deliberately **not** marked `timone`, confirmed to have **zero runs in the ledger**:

```
$ node dist/cli.js takeover scratch-app#20
I'm not working on scratch-app #20. Add the `timone` label to that ticket and I'll pick it up.
$ echo $?
1
```

The register requires that this resolve what the ticket is waiting on **from the tracker** and spawn the stage-2 session. It refuses, with the same sentence the requirement was written to abolish.

**This is a deliberate divergence, not an oversight, which is why it needs a human rather than a fix context.** The phase file's load-bearing decisions rejected the tracker-resolution path by name, on the reasoning that takeover "does not need [it] if a run exists" — the chosen design instead has the wayfind skill mark tickets at creation so a run always exists. That is a coherent design. It is not what the MUST clause says, and the gap is reachable in practice: a project onboarded before this phase has no `timone` label at all, and the gate itself found that marking in such a repository *silently fails*.

**The gate's control for this step does not hold.** It reports `scratch-app#20 -> nothing-to-do | I'm not working on scratch-app #20` as proof the refusal is "still the right answer for an unmarked one" — but on 2026-08-09 issue #20 **did not exist** on `scratch-app` (the repository ended at #19). It was testing a missing ticket, not an unmarked wayfinder ticket. My probe created a real one, and the answer is the same refusal — so the conclusion survives, but it had not in fact been tested. The gate also recorded step 4 as PASS by calling `resolveTakeover` directly rather than running the command, so the spawn-and-re-enter half of this clause has never been observed end to end by anyone. It is separately evidenced by the five `ivtrends` tickets taken over and concluded on 2026-08-09 — but every one of those **had** a ledger run, so none of them meets this clause's GIVEN either.

**Clause 3 — the daemon picks up a written answer and spawns the session that resolves it, without the human running anything. FAIL.**

The literal outcome is reached: the answer is picked up unprompted and the ticket is resolved and closed with nothing run by hand. I watched it twice. But the clause says **the** session, and two run — see R3 clause 3 above for the full evidence, which is the same defect. A behaviour that reaches the required end state by billing two sessions, posting duplicate resolutions to the human and erroring in the operator's log is not a clause I am willing to record as satisfied.

## HUMAN-CHECK scripts

### HUMAN-CHECK — R3 clause 3 / R20 clause 3, the escalation judgement

Every clause of the written path has now been exercised by machine-typed answers — the gate's on 2026-08-09 and mine here. What no pass has witnessed is whether a **person** finds the clarifying question reasonable and the escalation timed right. The phase, the gate report and this report all name that same single gap, and it is now cheap.

- **Setup.** Six `ivtrends` decision tickets (#10, #12, #13, #14, #15 and, when unblocked, #11) are marked and parked on a conversation right now. The daemon must be running, or a cycle run by hand.
- **Steps.** 1. Pick one and answer it in writing, as a plain comment, as you would answer anyone. 2. Wait one poll cycle. 3. Read what comes back. 4. If it asks something, answer partly on purpose and read what comes back again.
- **Expected.** One reply, not two. If it asks a follow-up, it asks only what your answer left open and does not re-ask what you settled. If your second answer still doesn't settle it, you get a takeover CTA rather than a third question.
- **Record.** This report's next iteration, and the R3 / R20 markers in the register.

**Do not run this until the duplicate-session defect is fixed.** Today it would post two or three machine replies onto a live product decision, which is the specific harm the fixture-target rule exists to prevent.

## Regression

The derived set is ten criteria. **Five were re-observed live in this pass; five were not, and that is a gap in this pass rather than a finding about the code.**

| ID | This pass |
| --- | --- |
| R1 — ticket pickup | **PASS, both clauses, first-hand.** Marked `scratch-app` #21 and #22 each produced a run and exactly one acknowledgement comment within one cycle. Unmarked #20 produced **no run** — I checked the ledger directly. |
| R2 — target resolution, clean client repo | **PASS.** Four sessions ran against `scratch-app`; `git -C projects/scratch-app status` is clean, and `git log --all --stat` across its whole history still matches no `.claude/`, `.timone/`, `timone.yaml` or `standards/` path. |
| R13 — harness-owned routing | **PASS, first clause.** Both fixtures routed to stage-2 wayfinding rather than triage on their `wayfinder:` label, with no stage named by me. The interactive clause was not exercised. |
| R14 — conversation seam, terminal takeover | **PASS, clause 1.** Both parks carry the copy-pasteable command in a fenced block. Clause 2's refusal path re-observed on #20. The success path was not run — it opens an interview. |
| R18 — orphaned-run reclaim | **Partially re-observed.** ADR-0020's guard was seen refusing to judge on unwitnessed time — `witness not judging — watching for 1m32s of the 2m00s it would have to vouch for` — which is the middle clause's protection working. No reclaim was provoked. |
| R4, R5, R6, R7, R8 | **NOT re-observed.** No ticket reached the PRD gate, the plan gate, execution, delivery or a preview in this pass. Exercising them means a full ticket-to-pull-request cycle with Docker, which is several agent sessions and disproportionate to a phase that touched the conversation path. Named here so the omission is legible rather than implied. |

## Fix-loop accounting

**0 of 2 consumed, deliberately, and this was my call to make rather than an omission.**

Two failures were found. They cannot both be handed to a fix context:

- **R20 clause 2 is not a code defect.** The implementation does what the phase deliberately decided; the register says otherwise. Choosing between changing the criterion and building the tracker-resolution path is a specification decision, and stage 7 may not make it while stage 6 may not either. A fix context handed this brief would have to guess.
- **The duplicate-session defect is a clean code defect** and would take a brief well. But fixing it alone cannot lift either requirement to `verified` — R20 still fails clause 2 and still has three unobserved CTA branches — so the loop would buy a re-verify that changed no status, at the cost of more live sessions on the resume path that has already needed two mid-phase amendments.

Both go to stage 9 with the evidence above.

## Register changes

- **PRD-02.R3:** `revised` → **`failed`**, with a dated marker naming this report, recording that clauses 1 and 2 pass on real tickets and that clause 3's path reproducibly spawns two sessions per written answer.
- **PRD-02.R20:** `draft` → **`failed`**, with a dated marker naming this report, recording clause 2's divergence, clause 1's single observed branch, and clause 3's duplication.

Neither is a REGRESSION: R3's failing clause is the one added on 2026-08-09 and never verified, and R20 has never been verified.

## Handed to the human

Three things, all via `/timone-improve timone phase-18 verification`:

1. **One written answer spawns two agent sessions.** Reproduced 2/2 on `scratch-app` #21 and #22, with distinct session ids in the log and the ledger, duplicate `✅ Agreed` resolutions reaching the human, and `could not resume #NN: Run cannot go from done to done` in the operator's output. **This is live on `ivtrends` right now** — six tickets are parked and the next one answered in writing will be answered twice.
2. **R20 clause 2 says something the implementation deliberately does not do.** Either the criterion is mechanism-shaped and wants the correction R8 and R18 both received in this register, or the tracker-resolution path is owed. A decision, not a fix.
3. **Three of clause 1's four CTA branches have never been observed** — `research`, `task`, and `prototype` in an actionable state. They arrive free with the next map charted; nothing needs building.

### Defect brief — PRD-02.R3 clause 3 / R20 clause 3, loop 0 (issued to stage 9, not to a fix context)

- **Criterion:** "GIVEN a ticket waiting on a conversation WHEN the human writes their answer as a ticket comment instead of taking over THEN the daemon picks that comment up, spawns the session for what the ticket was waiting on, and the session resolves it from the written answer without re-asking what was answered".
- **Expected:** one session, one resolution, one comment.
- **Observed:** two sessions per answer, two full resolutions ~30s apart, both closing the ticket; the cycle ends `error … cannot go from done to done`. Session ids differ between the daemon's log line and the ledger record on both runs.
- **Reproduction:** create an issue on `scratch-app` labelled `wayfinder:grilling` + `timone`; `node dist/cli.js daemon --once` until it parks; post a plain comment; `node dist/cli.js daemon --once`. Both attempts reproduced.
- **Evidence:** `scratch-app` [#21](https://github.com/fvermaut/scratch-app/issues/21) and [#22](https://github.com/fvermaut/scratch-app/issues/22); #22's sixth comment is the system's own account of the duplication, left in place deliberately so it stays findable.
- **Related, from stage 6's own record:** the completion report's known-open observation *"A double `getTicket` per cycle on the resume path"*.
