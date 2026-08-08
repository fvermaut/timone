# Phase 15: the defects running it found — false accusations, two clocks, and a stale flag

> **Status:** **Awaiting approval by fvermaut.** Hand-planned 2026-08-08, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument.

> **Fifth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md) (a run's liveness is its heartbeat), [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md). Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md).

> **This phase displaces Docker previews a second time.** They were phase 13's recorded next action, phase 14 took their slot, and phase 15 takes it again. fvermaut chose the displacement on 2026-08-08 from the scope question [the phase 14 completion report](reports/phase-14-complete.md) put to him: the three defects [the 14g gate](reports/phase-14-live-gate.md) found are fixed **before** previews. **Previews become phase 16**, and R11's preview clause stays `draft` one further phase. That cost is stated rather than discovered later — it is now two phases old.

## The honest scope of this phase, stated first

Phase 14 found **three** unrouted defects. **This phase fixes two of them and measures the third**, and that is a deliberate limit rather than a shortfall:

- **The attribution defect** has a fix already argued from evidence, needs no new decision, and is fixed here (15b).
- **`timone retry`'s stale flags** is a two-line correction and is fixed here (15c).
- **The tick's two wrong numbers** — the frozen token counter and the 13× clock divergence — are **investigated here (15a) and fixed in phase 16.** Not out of caution: the fix is a choice between a monotonic clock, a wake-aware staleness rule, and stamping liveness from something other than the timer, and every one of those changes what [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md) means by *a run's liveness is its heartbeat*. That is a significant decision by the three-part test — hard to reverse, surprising without context, a real trade-off — so **the ADR gate fires**, and the decision cannot be recorded before something measures which mechanism is actually at work. Planning the fix now would be resolving that decision inside a plan file, which is exactly what the gate forbids.

**So R17 and R18 do not close in this phase**, and nobody should read its completion report expecting them to. What closes is R15, and what phase 16 inherits is a measured question with an ADR attached rather than a hypothesis.

**The exit of this phase is a route to `timone-adr`**, carrying 15a's measurement. That is a normal outcome of a gate, not a failure of the plan.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R15 | SHOULD | Post-session guardrail hooks bracket every session at the timone root | **closes** — the fourth criterion is what fails, and 15b is what fixes it |
| PRD-02.R18 | MUST | A run orphaned by a crashed daemon is reclaimed, reported and its project freed | **criterion revised (15d), requirement stays `draft`** |
| PRD-02.R17 | SHOULD | The daemon shows progress while a session runs, and its authoritative cost when it ends | **measured only (15a), stays `draft`** |

**R19 is not reopened.** It was verified at 14g on every clause and the attribution defect is not its problem — the trailer *is* written, on everything; 15b is about a rule that fails to *read* it. This is recorded here because bundling them is the tempting mistake and the completion report already refused it once.

Deliberately **not** this phase: Docker previews (R8/R12) and R11's preview clause — phase 16; the Slack adapter; a real bot identity, which still needs a credential from fvermaut; the **two-daemon ledger hazard** on `.timone/state.json`, untouched since phase 14 and untouched again here; **whether reclaim-without-recovery is too conservative for unattended runs**, which 15a's finding will sharpen but not settle; **sub-agent output tokens obtained honestly**, which is the phase-16 half of 15a's question; a **`setup` skill**, still deferred until Timone is redistributed; `scratch-app` #4, #10 and #13, all of which stay exactly where phase 14 left them.

## Goal Description

The guardrails stop accusing the wrong session. Since [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md) moved the bracket into the hooks, the rules scope "this session's commits" by diffing against the session's `SessionStart` baseline — and never read the `Timone-Session:` trailer that says who actually made each commit. With two sessions open at the timone root, which is how this project is developed, the one whose baseline is older is blamed for the other's work. At 14g that fired in the damaging direction: a clean execution session was flagged and a **false accusation was posted publicly on a client's ticket**, under fvermaut's GitHub identity, naming three files it never touched — all three carrying the trailer that would have exonerated it. After this phase every rule sees only the commits this session made, `timone retry` stops carrying a dead attempt's flags into a fresh one, and the question of why the tick's clock and the SDK's disagree by 13× has an answer written down rather than a hypothesis.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **The trailer filter belongs at the evidence boundary, not in the four rules.** `collectEvidence` is the one place commits enter, and `CommitEvidence` already carries `trailers` — parsed by `trailersOf(body)` and, today, read by `checkProvenance` alone. Filtering there means `checkUnpushed`, `checkStatusPlacement`, `checkPathContainment` and `checkProvenance` are all corrected by one change and none of them learns about sessions. Filtering in each rule would be four places to forget.
- **The filter excludes, it does not include.** A commit is dropped only when it carries a `Timone-Session:` trailer naming a **different** session. A commit with **no** trailer is kept and judged, because such a commit is genuinely unattributable, and over-reporting a real violation is the safe direction. **This is the fix's known limit and it stays in the record rather than being engineered around:** the duplicate provenance line from an untrailed commit survives. For the case that mattered at 14g — three trailed commits on a client's ticket — the fix is complete, not partial.
- **The unpushed rule needs the same filter and cannot get it from `CommitEvidence`.** `branch.unpushed` comes from `rev-list <branch> --not --remotes=origin`, which is a repository-state question with no session scoping in it at all — that is why an interactive session opened while the daemon builds reports the daemon's in-flight commits as its own. The unpushed shas must therefore carry their own trailers, read in the same pass. **This is the half that fired in the common case rather than the edge one**, and a fix that corrects only `CommitEvidence` would leave it.
- **The session id reaches `collectEvidence` as an argument, not from the environment.** It is already in hand at both call sites (`runCheck` has `deps.sessionId`), and reading it from a global would put an untestable dependency into the one function every rule's evidence flows through.
- **`store.retry` clears `flags`, and the clearing belongs in the store rather than in the command.** `retry()` already clears `failure` and `sessionId` in its `transition` callback; `flags` is the third field belonging to the dead attempt and was simply missed. Putting it beside the other two keeps one answer to "what does re-arming reset", which is the drift a fix in `runRetry` would start.
- **15a produces a finding, not a fix, and its instrument is verified before its output is believed.** This is [the habit phase 14 earned](reports/phase-14-complete.md) applied deliberately: 14g's redirection check first used `script(1)`, which silently dropped output and produced a wholly convincing false defect. Any clock measurement here is confirmed by two independent means before it is written down.
- **The sleep hypothesis is the leading candidate and is not assumed.** Five sessions diverged with a textbook pattern — pairs of ticks 30 s apart separated by ~15-minute gaps — and the one session that ran uninterrupted agreed to within a second (7m01s against 7m02s). That is strong, and it is still a correlation. 15a's job is to make it a mechanism or replace it.
- **Liveness was never affected by either tick defect, and that bounds the urgency correctly.** The heartbeat kept stamping throughout; what the clock defect creates is a *false-positive reclaim path*, which is a hazard rather than a live breakage — and it is a hazard only under a continuously running daemon, which is why the operational warning below stands until phase 16 lands.
- **The operational warning stays in force for the whole of this phase.** Do not leave `timone daemon` running unattended overnight on a laptop that sleeps: a healthy run would be reclaimed and its work discarded. 15a measures this hazard; it does not remove it.

## Context & Prerequisites

- Phase 14 closed 2026-08-08 with R16 and R19 `verified` and R15, R17, R18 held at `draft`. **532 tests green**, `type-check` clean, `main` level with `origin/main` at `eaf6a4d`.
- **The evidence this phase acts on is already gathered and is not to be re-gathered.** [The 14g gate report](reports/phase-14-live-gate.md) carries every measurement — five clock divergences with their gap distributions, five token measurements across the fan-out table, and the two directions the attribution defect fired in. Slices read it; they do not repeat it.
- **`CommitEvidence.trailers` already exists** and is populated for every commit the baseline diff finds. The information 15b needs has been on the evidence object since 14e — only the filter is missing.
- **`.claude/settings.json` is tracked** and declares both hooks; nothing in this phase changes it.
- **No ticket is in flight**, and 15e needs one. `scratch-app` #13 sits `failed` with `timone retry scratch-app#13` as the way back — carrying it is a `scratch-app` decision, not this phase's, so 15e should file a fresh ticket rather than resolve that question by accident.
- **`scratch-app` #11 carries two false-positive flags** from 14g. Whether they are cleared is 15e's to decide with evidence in hand, and is named there rather than left to drift.

## Sub-phases

### Sub-phase 15a: what the two clocks are measuring (R17, R18 — investigation, no fix)

**[NEW FILE]** `doc/plans/phases/reports/phase-15-clock-investigation.md` — the finding: what the SDK's `duration_ms` actually measures, whether it excludes suspended time, and whether the frozen token counter is the same mechanism seen twice or a second independent defect.

**[NO PRODUCTION CODE.]** This slice ships no behaviour. If it finds itself editing `src/daemon/progress.ts`, it has left its scope.

**What must be established, each by two independent means:**

1. **Does `duration_ms` exclude suspended time?** A short scripted session, a deliberate suspend (`pmset sleepnow`) partway through, a wake, and a comparison of the SDK's `duration_ms` against wall clock measured outside the process. The prediction the sleep hypothesis makes is specific: wall clock includes the suspend, `duration_ms` does not. **A session that is not suspended is run first as the control** — the instrument is shown agreeing with itself before it is used to find a disagreement.
2. **Does a suspend drop `message_delta` stream events while `assistant` messages survive?** This is the single mechanism that would explain both defects at once, and it is the finding phase 16's fix hangs on. The same suspended session's message stream answers it: count `assistant` messages and `message_delta` events either side of the pause.
3. **What `setInterval` does across a suspend**, confirmed rather than assumed — it is the premise under both the gap pattern and the heartbeat hazard.

**What the finding must contain, whatever it concludes:** the mechanism or the honest absence of one; whether the two defects are one; **the options for phase 16 with their trade-offs stated but not chosen** — a monotonic clock for the tick, a wake-aware staleness rule, stamping `heartbeatAt` from message arrival rather than the timer, or simply a larger threshold — and what each would cost ADR-0017's current wording. **It must not pick one.** That is `timone-adr`'s to record and fvermaut's to approve.

**Seams under test (TDD):** none — this slice writes no production code, and inventing a test for a measurement would be theatre. **Its rigour comes from the control run, not from the suite.**

> No dependency on other sub-phases. Sequenced first because it is the only slice whose outcome shapes anything else, and because phase 16 cannot start until it lands.

#### Agent Validation Steps

```bash
# the control first — a session that is never suspended
node dist/cli.js daemon --once --progress-interval 10
# then the same with a deliberate suspend partway through
```

- [ ] The control run was taken **before** the suspended one, and the two clocks agreed on it
- [ ] Every number in the finding is reproduced by two independent means
- [ ] The finding names the mechanism, or says plainly that it could not
- [ ] Phase 16's options are stated with their trade-offs and **none is chosen**
- [ ] No file under `src/` was modified

---

### Sub-phase 15b: guardrail findings read the trailer they enforce (R15)

**[MODIFY]** `src/daemon/hooks.ts`, `hooks.test.ts` — `collectEvidence` takes the session id; `collectRepo` drops any commit whose `Timone-Session:` trailer names a different session, and reads trailers for the **unpushed** shas in the same pass so `branch.unpushed` is filtered by the same rule. A commit carrying no session trailer is kept.
**[MODIFY]** `src/commands/guardrails.ts`, `guardrails.test.ts` — `runCheck` passes `deps.sessionId` through to `collectEvidence`.

**Seams under test (TDD):** a commit trailed to another session is invisible to **all four** rules, asserted per rule rather than once — that a single filter corrects four rules is the design, and a test naming only one of them would not notice a rule that reads commits by some other route; an **untrailed** commit is still judged, which is the deliberate limit and the assertion that stops a later "tidy-up" from removing it; the unpushed rule filters by trailer too, on a fixture with two sessions' commits on one branch — this is the case that fired in the common direction; a session whose own commits are all trailed to itself is judged exactly as it is today, so the fix is proven not to have gone silent; and the 14g scenario end to end — an interactive session's trailed commits present while a daemon session's `Stop` runs, and the daemon session reports nothing.

> No dependency on 15a. Independent of it in every file it touches.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts
npm run type-check
npm test
```

- [ ] All four rules are corrected by the one filter, each asserted separately
- [ ] An untrailed commit is still reported — the limit is a test, not a comment
- [ ] The unpushed half is filtered, not only `CommitEvidence`
- [ ] A clean single-session case behaves exactly as before

---

### Sub-phase 15c: `timone retry` re-arms without the dead attempt's flags

**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — `retry()` clears `flags` alongside `failure` and `sessionId`.
**[MODIFY]** `src/commands/status.test.ts` — if any fixture asserts a retried run's flags, it changes with the behaviour.

**Seams under test (TDD):** a failed run carrying flags is re-armed with none; the flags a run acquires *after* being re-armed are kept, which is the property that separates "clear the dead attempt's" from "clear all"; `timone status` no longer reports `⚠ 1 automatic check(s) failed` about a fixed cause on a retried run.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/runs.test.ts src/commands/retry.test.ts src/commands/status.test.ts
npm run type-check
```

- [ ] A re-armed run carries no flags from its dead attempt
- [ ] Flags earned by the *new* attempt survive

---

### Sub-phase 15d: R18's middle criterion says what it means

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R18's middle criterion is rewritten. Today it reads *"a run whose session is alive **and still stamping its heartbeat**"*, and a suspended session is not stamping — so the sleep case slips through the criterion's own precondition and the requirement reads as satisfied by a run that would in fact be killed. The replacement must say **healthy runs are never reclaimed**, in terms that do not presuppose the mechanism. The old wording and why it was inadequate stay in the annotation, not deleted.

**This is a specification correction, not an intent change.** R18 has always meant that a live run is not killed; the criterion failed to say so in a way that could go red. Nothing about what the requirement asks for moves, which is why this is a slice here rather than a route to `timone-improve`.

**Seams under test (TDD):** none — no behaviour-carrying code.

> Sub-phase 15a should be complete first. The replacement wording must not presuppose a mechanism, and the cheapest way to write a criterion that accidentally presupposes one is to write it while the mechanism is still a guess.

#### Agent Validation Steps

```bash
grep -n "still stamping its heartbeat" doc/specs/prd/prd-02-inversion-of-control.criteria.md   # expect no match
```

- [ ] The new criterion can go red on the overnight session 14g measured
- [ ] It names no mechanism — not sleep, not a clock, not a threshold
- [ ] The old wording and its inadequacy survive in the annotation

---

### Sub-phase 15e: live gate — the accusation does not recur (R15)

**[NO CODE.]** A live run, and the human gate.

1. **The 14g scenario, deliberately reproduced.** With a daemon session building, open an interactive session at the timone root and commit something trailed to itself. Expect: the daemon session's `Stop` reports **nothing** about those commits, no comment on the client's ticket, no flag on the run, and `.timone/sessions.jsonl` gains no line naming an innocent session. **This is the criterion that held R15 down and the only evidence that lifts it.**
2. **The rules still fire on real violations.** In the same pass, a genuine violation from each side — an interactive session's untrailed commit, and a daemon session straying outside its project — each still caught, printed and reported where it belongs. **A filter that silenced the rules would look identical to a filter that fixed them at step 1 alone**, which is why this step is not optional.
3. **The unpushed half specifically.** An interactive session opened while the daemon holds in-flight commits reports none of them. This is the common case, and step 1 does not cover it on its own.
4. **`timone retry` on a flagged run**, confirming `timone status` no longer carries the dead attempt's warning.
5. **The two false-positive flags on `scratch-app` #11** — cleared or left, decided here with the evidence in hand, and the reason written down either way.

**Seams under test (TDD):** none — this is the live gate, and its whole point is evidence no unit test can reach. Phase 14 found six defects this way and its 532 tests found none of them.

> Sub-phases 15b and 15c must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
cat .timone/sessions.jsonl
git log --grep=Timone-Session --oneline | head
```

- [ ] Steps 1–5 each observed, evidence captured for the completion report
- [ ] The rules were shown still **firing**, not merely silent — the failure mode a filter creates
- [ ] The unpushed half checked in its own right
- [ ] **Human gate:** fvermaut confirms he would now trust a guardrail comment on a client's ticket

---

### Sub-phase 15f: documentation, register, and the route out

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R15 to `verified` **only on 15e's two-direction evidence**; a pass that shows silence without showing the rules still firing leaves it `draft` with the gap named. R17 and R18 annotated with 15a's finding and left `draft`, saying explicitly that the fix is phase 16's.
**[MODIFY]** `STATUS.md` — phase 15 in plain language; the attribution and retry defects struck from the known problems; **the tick's two numbers stay listed**, with the operational warning about overnight daemon runs kept until phase 16 removes its cause.
**[NEW FILE]** `doc/plans/phases/reports/phase-15-complete.md` — what closed, what did not, and the phase's exit: **route to `timone-adr` with 15a's finding**, then plan phase 16 for the tick fix and Docker previews.

**Seams under test (TDD):** none — no behaviour-carrying code; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "R15" doc/specs/prd/prd-02-inversion-of-control.criteria.md | head
grep -n "overnight" STATUS.md
```

- [ ] R15 flips only on evidence that the rules still fire, not only that they went quiet
- [ ] R17 and R18 say plainly that the fix is phase 16's, so nobody reads this phase as having closed them
- [ ] The operational warning survives into `STATUS.md` and is not quietly dropped
- [ ] The report names the ADR route as the phase's exit

## Dependency graph

```
15a → (none)        what the two clocks measure — investigation only (R17, R18)
15b → (none)        guardrail findings read the trailer (R15)
15c → (none)        retry clears the dead attempt's flags
15d → 15a           R18's middle criterion, reworded without a mechanism
15e → 15b, 15c      live gate: the accusation does not recur, the rules still fire
15f → all prior     docs, register, and the route to timone-adr
```

15a, 15b and 15c are mutually independent and may run in any order or together. 15a is listed first because it is the only slice whose outcome shapes anything downstream — 15d's wording and the whole of phase 16 — and because a finding that arrives late delays a phase that has not started.

## What this phase deliberately does not close

- **R17 and R18 stay `draft`.** The fix trips the ADR gate; see the scope statement at the top. Phase 16 carries it.
- **The two-daemon ledger hazard** on `.timone/state.json` — untouched by phase 14 and untouched again here.
- **Whether reclaim-without-recovery is too conservative** for genuinely unattended runs. 15a's finding sharpens the question — the machine most likely to run overnight is the one most likely to suspend — and does not settle it.
- **Sub-agent output tokens obtained honestly.** The obvious fallback is the exact source 14b rejected for under-reporting ~30×; 15a establishes whether it is even the right question.
- **The `setup` skill**, the real bot identity, and Docker previews — all carried forward unchanged.
