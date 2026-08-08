# Phase 14 — completion report

> Closes [phase 14](../phase-14.md). The live evidence is in [the 14g gate report](phase-14-live-gate.md) and is not restated here — this report decides what the evidence means, flips the register, and names what the phase deliberately left open.

## What it does now

A run stops being a black box. Each stage runs on a model chosen for its work rather than the runtime default; while a session works the daemon says so every thirty seconds; that same tick is what proves the run alive, so a daemon killed mid-session no longer strands a run `active` forever; the guardrail bracket moved out of the daemon's spawner into `SessionStart`/`Stop` hooks, so it now covers sessions fvermaut starts himself; and every machine-authored commit carries a trailer naming the stage, the session and the run that made it.

**Two of those five now work as intended. Three are demonstrably not finished**, and the phase closes saying so rather than claiming otherwise.

## Register decisions

| | requirement | before | after | why |
| --- | --- | --- | --- | --- |
| **R15** | post-session guardrail hooks | draft | **draft** | both session kinds observed, but the rule reports the wrong session |
| **R16** | a model and effort per stage | draft | **verified** | all five rows observed live; seam assertions in the suite |
| **R17** | the daemon shows progress | draft | **draft** | two defects in the numbers the tick prints |
| **R18** | an orphaned run is reclaimed | draft | **draft** | a measured false-positive path, 17 occurrences in one session |
| **R19** | machine-authored commits identifiable | draft | **verified** | 13 commits, 13 trailers, no harness file |

### R16 → verified

Every row of the declared table was observed from the daemon's own output, on both the opening `session` line and the closing `cost` line, across #11 and #13: triage on Sonnet, requirements on Opus, planning on Opus, execution on Opus, the approval record on Haiku. Nothing contradicted the table anywhere. The two clauses the live run cannot show — that a model rejecting `effort` is sent none, and that the seam receives the declared values — are asserted in the suite (`session.test.ts`, `pipeline.test.ts`; 532 tests green).

**One caveat, recorded rather than hidden:** planning's row was observed on a session that then died on an upstream API error before committing its plan. Planning's *model* is proven on #13, planning's *output* on #11. The requirement is about the model, so this does not qualify the verdict — but a reader comparing the gate report against the ticket will find #13 `failed`, and should find the reason here.

### R19 → verified

Tested directly at 14g step 5 and passing on every clause: thirteen machine-authored commits in the phase-05 range and thirteen complete trailers, across five stages and five distinct sessions whose ids match the daemon's log lines; `git log --grep=Timone-Stage` therefore a complete index rather than a partial one; no harness *file* in any diffstat across all history; and the interactive side correct in both directions — Timone's own commits trailed, fvermaut's deliberate `142edde "stray"` bare, which is precisely why R15's provenance rule fired on it.

**The attribution defect is not a reason to hold R19 down**, and this was the tempting mistake. R19 asks that the trailer be *written*; it was, on everything, without exception. That a different rule fails to *read* it is R15's problem — and the trailer's completeness is what makes that defect fixable at all. Holding R19 down would penalise the one mechanism that worked.

### R15 stays draft — and the reason is a criterion, not a mood

The phase file's instruction was that R15 returns to `verified` **only if both session kinds were observed**. They were, in one pass: a daemon violation with its loud ticket comment and flagged run, an interactive violation printed and journalled with no ticket comment, and a clean session of each kind falling silent. On the letter of that instruction R15 would flip.

**It does not flip, because a different criterion fails.** R15's fourth criterion reads:

> GIVEN a clean session of either kind / WHEN the hooks run / THEN they stay silent.

The execution session `82e4d50a` was clean with respect to path containment — every file it touched was inside `projects/scratch-app/`. The hooks did not stay silent. They posted a loud comment on a **client's ticket**, under fvermaut's GitHub identity, naming three files it never touched, and flagged the run. The same rule wrote a false line into `.timone/sessions.jsonl` against interactive session `dd86be88`, which had also violated nothing.

So the gate did not merely find R15 noisy — it found a criterion of R15 failing on real evidence. **That is a stronger reason to hold it than the "it reports the wrong actor to the wrong audience" argument the gate report offered**, which is a judgement about severity; this is the register's own words going red.

The cause and the proposed fix are in the gate report. Worth carrying: the fix removes **all three** lines of the client-ticket accusation, because every one of them is trailed — for that case it is complete rather than partial. The residual, an untrailed commit being genuinely unattributable and so over-reported, is the safe direction and belongs in the record rather than engineered around.

### R17 stays draft — two defects, possibly one mechanism

The tick fires, names what it should, and its closing line is authoritative and correct. Its **third** criterion — that redirected output is the same append-only lines with no cursor control — is now proven at the byte level: a pty capture and a file capture of tick-bearing output differ by exactly one carriage return per line and nothing else, with zero escape bytes in either.

What fails is the accuracy of two numbers the first criterion names:

- **Output tokens.** Under-reported 3.2× on execution, 2.2× on delivery, ~1.04× on the two stages that spawn no sub-agents — and then **5.8× on #13's planning session, which displayed no sub-agent at all** while its replies counter advanced and its token counter stayed frozen at 4.7k for four hours. The fan-out explanation covers four measurements and not the fifth.
- **Elapsed time.** Diverged from the SDK's `duration_ms` on four of five sessions, by up to 13×.

**These should be routed as one investigation, not two fixes.** The fifth token measurement and the clock divergence came from the same session, and if suspension drops `message_delta` events while `assistant` messages survive, one mechanism explains both. Fixing them separately risks patching a symptom of the clock defect in the token code.

### R18 stays draft — and its criterion needs rewording too

Two of three criteria are observed and correct: a run orphaned by a real crash was reclaimed, commented, its project freed, `timone status` naming `timone retry`; and `timone retry` re-armed it at the stage it stopped.

The middle criterion is the problem:

> GIVEN a run whose session is alive **and still stamping its heartbeat** / WHEN another daemon polls / THEN the run is left untouched, however long the session has been running.

#13's planning session ran overnight across a sleeping laptop. It was alive throughout, and **17 of its 45 tick gaps exceeded the 2-minute staleness threshold, the largest by 8×.** A continuously running daemon would have reclaimed a healthy run seventeen times over; it survived only because the gate drove `--once` cycles and no poll loop existed beside it.

**Note what the wording does here.** A suspended session is not "still stamping its heartbeat", so the criterion as written lets the sleep case slip through its own precondition — the requirement can be read as satisfied by a run that would in fact be killed. **The criterion is inadequate, not merely unmet**, and 14h records that as a finding in its own right: whatever fix lands must come with a criterion that says *healthy runs are never reclaimed*, in terms that do not presuppose the mechanism.

Step 3's false-positive check passed at 59m35s. It passed because the machine stayed awake. The threshold is safe against long work and unsafe against suspension, and those are different claims.

## What the gate cost, and what it bought

| ticket | stages run | cost |
| --- | --- | --- |
| #11 | approval record → execution → verification (×2) → delivery | **$27.06** |
| #13 | triage → requirements → approval record → planning | **$7.19** |

#11 is the project's first end-to-end cost measurement, plan gate to merged pull request, and the fleet stages dominate it. #13 was filed deliberately to reach the stages #11 could not — #11 triaged as a **chore**, and a chore routes straight to planning, so requirements was never observable on it.

**Six defects were found by running the thing, and none of them by the 532 tests.** Two were fixed during the gate (`ca3bc09` the ledger naming the stage a run had left; `8f96919` `daemon.log` tracked at the root), one was fixed by fvermaut during it (`npm link`, so that the commands Timone tells him to run exist), and three are recorded for routing: the attribution defect, the tick's numbers, and `timone retry` carrying a dead attempt's flags.

## Deviations from the plan

- **14g step 3 asked for a deliberate `SIGKILL`.** It got a real crash instead — a stray process signalled every terminal mid-execution — which is stronger evidence than the plan asked for, on the same code path.
- **14g step 4 asked for a *forced* daemon-side violation.** The one observed arose incidentally, twice: once from `daemon.log` at the root, once from the attribution defect. The observed behaviour is identical to a forced one and both halves the step asks for were produced, so it was accepted; the caveat is in the gate report.
- **14g ran across two tickets rather than one**, for the routing reason above.
- **The gate was driven with `--once` throughout**, as the plan specified. That choice turned out to be load-bearing in an unplanned way: it is the only reason the overnight planning session was not reclaimed, which is how the R18 hazard came to be measured rather than suffered.

## What this phase deliberately did not close

Carried forward, as the plan required:

- **The two-daemon ledger hazard.** Detection moved to the heartbeat so it stays correct with two daemons polling, but two writers of the same ledger field still race. Untouched by this phase.
- **Reclaim-without-recovery may be too conservative for genuinely unattended runs.** ADR-0017 fails a reclaimed run rather than resuming it, because a crash mid-stage can leave partial commits. The honest cost is that an overnight run stops at the crash and waits. Whether that is right for a daemon meant to work while nobody watches is unsettled — and the R18 sleep finding sharpens it, since the machine most likely to be running overnight is the one most likely to suspend.
- **Sub-agent output tokens, honestly obtained.** The obvious fallback is the exact source 14b rejected for under-reporting ~30×. An investigation, not a one-liner.
- **Whether the two false-positive flags on #11 should be cleared** once the attribution and retry defects are fixed.
- **The real bot identity** still needs a credential; Timone posts under fvermaut's GitHub account with a marker.
- **A `setup` skill** — install, build, `npm link`, manifest, credential — deferred until Timone is redistributed rather than run from this checkout. `npm link` is documented in the README meanwhile.

## For the next agent

**The scope decision belongs to fvermaut and is not made here:** whether the three recorded defects are fixed inside phase 14 or become phase 15's opening work. Phase 15 was planned as Docker previews.

If they are routed, the order that respects what is known: **the two tick defects first and together** (they may be one mechanism, and R17 and R18 both wait on them), then **the attribution defect** (self-contained, with a fix already argued and a complete answer for the client-ticket case), then **`timone retry`'s stale flags** (smallest, and cosmetic beside the others).

**`/timone-improve` is not the route for any of this.** The skill is managed-projects-only and stops when asked to improve Timone. Timone's own feedback stays hand-run, as its planning does.

One habit this phase earned the hard way, worth more than any single defect: **a measurement instrument gets verified before its output is believed.** The gate's redirection check first used `script(1)`, which silently dropped output and produced a convincing false defect — an error line the file "kept" and the terminal "lost". A one-line `/bin/sh` reproduction exposed the instrument rather than the subject. The near-miss is recorded because the fabricated defect was, briefly, entirely believable.
