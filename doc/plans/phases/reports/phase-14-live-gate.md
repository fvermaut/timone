# Phase 14 — 14g live gate: observations

> Evidence log for [sub-phase 14g](../phase-14.md#sub-phase-14g-live-proof-on-the-pilot), written as the gate runs rather than reconstructed after it. 14h folds this into `phase-14-complete.md` and decides the register flips. **The gate is not finished** — what is owed is listed at the bottom.
>
> Ticket under test: `scratch-app` #11 ("I can't run this anywhere but my own laptop"), branch `timone/11-i-can-t-run-this-anywhere-but-my-own-lap`.

## What has been observed

### Step 1 — R16, a model per stage: **partially observed**

Confirmed from the daemon's own output, not inferred:

```
work   scratch-app#11 (approval record) — 21s · 6 replies · 1.1k out
cost   scratch-app#11 (approval record) — 44s · 14 turns · $0.14 · claude-haiku-4-5 2.1k out
session 82e4d50a-8f9c-4a69-aa0d-1c7fd5c6762c started for scratch-app#11 (execution, claude-opus-5)
```

The approval-recording session ran on Haiku and execution on Opus, each as declared. **Triage on Sonnet and requirements/planning on Opus were not observed** — they ran before the 2026-08-07 crash and the log covering them was truncated when the daemon was restarted. The declared table is proven at two of its rows on this pass, not all of them.

### Step 2 — R17, the progress heartbeat: **observed, one clause outstanding**

Ticks every thirty seconds naming elapsed time, replies, output tokens and a sub-agent count, e.g.

```
work   scratch-app#11 (execution) — 2m21s · 9 replies · 9.4k out · 1 sub-agent
work   scratch-app#11 (execution) — 17m01s · 14 replies · 19.5k out · 1 sub-agent
```

The sub-agent count moved as `timone-execute` fanned out, and a closing `cost` line carried the authoritative total for the session that ended. **The "re-run with `> daemon.log` and confirm the file matches the terminal" clause has not been done** — the run in flight is redirected to the file, so the comparison is still owed.

**A defect sits under this step** — the tick freezes for the whole length of a sub-agent's work. See *the tick goes stale while the fleet works*, below. R17 should not be flipped to `verified` on this evidence.

### Step 3 — R18, the heartbeat is the run's liveness: **observed, and better than staged**

The kill was **not** a deliberate `SIGKILL`: on 2026-08-07 a stray process signalled every terminal and killed the daemon mid-execution, ~14 minutes into building #11. That is a real crash rather than a simulated one, which is stronger evidence than the plan asked for.

One `daemon --once` cycle on restart:

```
reclaim scratch-app#11 — the machine running it stopped before the work was finished
```

The run flipped to `failed` with a plain reason; the project was freed; the ticket got its comment ("Nothing was decided about this ticket, so nothing here is final") ending in a CTA; `timone status` named `timone retry scratch-app#11`. After `timone retry`, the next cycle picked it up and execution restarted.

**The false-positive half is conclusively observed:** staleness is four intervals (2 minutes at the 30 s default), and the restarted execution session ran **59m35s** — roughly thirty times the threshold — with the daemon polling throughout and nothing reclaiming it.

**But a false-positive path the check does not cover was found anyway — see *the tick's clock is not the session's clock*, below.** The heartbeat only stamps when the tick fires, and the tick did not fire for stretches of ~15 minutes. That the run survived appears to be timing rather than design, and R18 should not close until it is understood.

`ce6ebdb` was seen load-bearing in the wild: the re-armed run still carried a two-hour-old `heartbeatAt`, and only the `updatedAt` fallback stopped the very next cycle reclaiming it again.

### Step 4 — R15, both session kinds: **interactive side complete, daemon side owed**

**Interactive violation — caught.** A session started by fvermaut at the timone root committed `142edde "stray"` with no trailer, deliberately reproducing the 2026-08-06 accident. Journal lines written, printed to him, **no ticket comment** — the interactive path behaving as designed:

```json
{"session":"7192c7ca…","rule":"unpushed","summary":"timone: 2 commit(s) on `main` never reached the remote"}
{"session":"7192c7ca…","rule":"provenance","summary":"1 commit(s) made in this session say nothing about where they came from"}
```

The two rules that fired are the target-free pair. Containment stayed quiet because the session named no target — the deliberate 14d decision, working as intended rather than a miss.

**Clean session — silent.** A subsequent interactive session (`b64bed8a`) that only read a file recorded `"reported":[]` in its baseline and wrote no journal line.

**This closes the handover's open question about per-turn `Stop` firing.** The offending session took several turns and the provenance finding was journalled **once**. The parked baseline's suppression works.

**Daemon violation — caught, but incidentally rather than forced.** The pre-crash execution session on #11 tripped path containment on its own, and produced both halves the step asks to confirm. The ticket comment:

> ⚠️ **Automatic check failed — the session changed 1 file(s) outside `projects/scratch-app/`**
> This run was working on **scratch-app**, so everything it touches belongs under `projects/scratch-app/`.
> - daemon.log (uncommitted change)

and the matching ledger flag on the run, `the session changed 1 file(s) outside projects/scratch-app/`. Loud comment and flagged run, on the daemon path, unchanged from phase 11's behaviour.

**Two caveats 14h must weigh.** It was not *forced*, and the plan's wording asks for a forced one — though the observed behaviour is identical, and the same argument that made the real crash better evidence than a staged `SIGKILL` applies here. And its cause is now fixed (`8f96919` gitignored `daemon.log`), so this exact violation cannot recur; reproducing one deliberately needs a different mechanism.

**Daemon violation, forced version — arrived by itself, and it is the serious one.** The execution session `82e4d50a` was flagged for three files it never touched:

> ⚠️ **Automatic check failed — the session changed 3 file(s) outside `projects/scratch-app/`**
> - doc/plans/phases/reports/phase-14-live-gate.md (commit bcb6929)
> - doc/plans/phases/reports/phase-14-live-gate.md (commit c8a8920)
> - doc/plans/phases/reports/phase-14-live-gate.md (commit 21a1ae4)

All three are this report's own commits, made by interactive session `dd86be88` while the daemon happened to be building. See *findings are attributed to the wrong session* below — this is the same defect, in its damaging direction.

**Clean daemon session — silent. This completes step 4.** The verification session `6f0d5ff4` recorded `"reported":[]` and added no flag to the run. Three things make that silence trustworthy rather than merely absent:

- The mechanism demonstrably writes when it fires — execution's baseline for the same run carries `"reported":["the session changed 3 file(s) outside …"]`.
- `Stop` fires per assistant turn and the session took **32 turns**, so the check ran many times over, well before the session's end.
- Its baseline names `bcb6929` as the workspace head, and **nothing was committed to the timone repo for the whole life of that session** — deliberately held back for exactly this reason. A clean daemon session was only obtainable by staying out of the repo while it ran, which is itself a consequence of the attribution defect.

**Both session kinds, violation and silence, are now observed in one pass — which is what R15's widened criterion asks for.** Whether it may return to `verified` is a separate question, and the attribution defect is the reason to say no.

### Step 5 — R19, the provenance trailer: **complete, and clean**

Every commit the pipeline made on `scratch-app` for #11 carries the full trailer, and **`git log --grep=Timone-Stage` lists exactly the machine-authored work and nothing else**. Thirteen commits, spanning five stages and five distinct sessions:

| stage | commits | session |
| --- | --- | --- |
| `planning` | 1 | `3f87741a` |
| `planning (recording the approval)` | 1 | `4d19fd8b` |
| `execution` | 7 | `82e4d50a` |
| `verification` | 2 | `a0a8dcf5` |
| `delivery` | 2 | `8ad402af` |

All thirteen carry `Timone-Run: scratch-app#11`. **The count is the point: the phase-05 range holds thirteen commits and thirteen trailers** — no machine-authored commit escaped without one, so the grep is a complete index rather than a partial one. The session ids also match the daemon's own log line for each stage, which is what makes the trailer usable for attribution rather than merely decorative.

The five session ids being distinct is itself worth recording: the approval-recording session (`4d19fd8b`) is separable from the planning session that preceded it (`3f87741a`), which is the granularity R16's per-stage model claim needs to be checkable after the fact.

**No harness path in any diffstat, across all history.** `git log --stat --all | grep -cE "\.claude/|timone\.yaml"` returns **0** as the validation step asks. A broader probe (`\.timone/|process\.md|standards/`) returns 3, and all three are **commit-message prose** written by execution when it amended its own plan — "process.md stage 5's re-approval rule", "standards/testing.md" — not files. The rule is about files and the files are clean; the widened grep just cannot tell a path from a sentence.

**The interactive side, both directions.** Timone's own last fifteen commits each carry `Timone-Stage: interactive` with the session that made them, correctly splitting across three sessions. And fvermaut's deliberate `142edde "stray"` carries **no trailer at all** — which is the reason the provenance rule fired on it in step 4. R19's enforcement and R19's data are the same mechanism seen from two sides.

**One caveat for 14h, and it is small.** The local `projects/scratch-app` clone was inspected as it stands and has not been fetched since PR #12 merged, so the merge commit GitHub created is not in the set. Nothing in the step turns on it — the merge commit is GitHub's, not the pipeline's, and every commit the pipeline authored is present and trailed.

### Step 6 — **complete**

See *Still owed* below and the closing section: the ticket went the whole way to a merged PR.

## Defects the gate found

### Fixed during the gate

- **`ca3bc09` — the ledger named the stage a run had left, not the one it was in.** `run.stage` was written only when a stage *finished*, so `timone status` reported the previous stage for the entire duration of the current one. Caught live: #11 was fourteen minutes into execution on Opus and status read `(planning)`, while the daemon log correctly read `(execution, claude-opus-5)` — the tell that the defect was in the ledger write rather than in either reader. Fixed at the top of the stage loop, before the branch is claimed; test goes red without it. Re-confirmed live afterwards: status read `(building) — working on it now on claude-opus-5 for 17m24s`.

  **Its tail cost real work.** `timone retry` re-arms "at the point it stopped", reading `run.stage`. #11's record said `planning` when it had crashed in `execution`, so a straight retry would have re-run planning on Opus and re-asked for an approval already given. The ledger was hand-corrected to `execution` before retrying (backup kept). **A fix cannot repair records the bug already wrote** — worth remembering as a class, not just this instance.

- **`8f96919` (earlier session) — `daemon.log` at the timone root** was reported by path containment against whatever run was in flight. Correct check, file that should never have been tracked.

### Found and deliberately **not** fixed — for 14h to route

- **Guardrail findings are attributed to the wrong session when sessions overlap.** The rules scope "this session's commits" by diffing against the session's `SessionStart` baseline, and **never read the `Timone-Session:` trailer**. With two sessions open at the timone root, the one whose baseline is older is blamed for the other's commits.

  Observed directly. `dd86be88`'s baseline was taken at `17:24:35` with `main` at `e856ebb`; the journal then recorded against it:

  ```json
  {"session":"dd86be88…","rule":"unpushed","summary":"scratch-app: 1 commit(s) on `timone/11-…` never reached the remote"}
  {"session":"dd86be88…","rule":"provenance","summary":"1 commit(s) made in this session say nothing about where they came from"}
  ```

  The first is the **daemon's** in-flight execution commit. The second is `7192c7ca`'s stray commit, already correctly recorded against `7192c7ca` — so it is a duplicate naming an innocent session.

  **Why it matters beyond tidiness.** `.timone/sessions.jsonl` is the permanent record for interactive sessions and now names a session that did nothing wrong. And the first line is not a one-off: **any** interactive session opened while the daemon is building will report the daemon's unpushed commits as its own, which is the common case rather than the edge one.

  The sting: the trailer exists precisely to say which session made a commit, and the rule that *enforces* the trailer does not read it.

  **Then it fired in the damaging direction, and this is the severity escalation.** The execution session `82e4d50a` was flagged, and a false accusation was posted **publicly on `scratch-app` #11**, under fvermaut's GitHub identity, naming three files it never touched — all three being this report's own commits (`21a1ae4`, `c8a8920`, `bcb6929`), made by interactive session `dd86be88`.

  What separates this from the interactive symptom:

  - It writes into a **client repo's ticket**, through the loud channel, rather than dirtying a local journal.
  - It flags the run and instructs the reader to "treat anything below this comment as unfinished" — on a false premise. The loud channel firing at innocent work is the failure mode guardrails must not have.
  - **Every one of the three commits carries `Timone-Session: dd86be88-…`.** The information needed to attribute them correctly was present, in the trailer R19 exists to provide, and the rule did not read it.
  - It is now proven in **both** directions. This is not an edge case: it fires whenever anyone works at the timone root while the daemon runs, which is how this project is developed. It also made a clean daemon session obtainable only by deliberately not touching the repo for an hour.

  **Proposed fix, if 14h routes it:** keep the baseline diff for finding candidate commits, but exclude any commit whose trailer names a different session. That removes the daemon-attribution line and the inflated count — and, note, **all three** lines of the client-ticket accusation, since every one is trailed. For that case it is a complete fix rather than a partial one. The duplicate provenance line from an untrailed commit survives by necessity — such a commit is genuinely unattributable — and over-reporting a real violation is the safe direction. That limit belongs in the record rather than engineered around.

  **This should block R15 from returning to `verified`,** notwithstanding that both session kinds were observed in one pass. The rule is not merely noisy: it reports the wrong actor to the wrong audience through the loud channel.

- **The tick goes stale while the fleet works — every number but elapsed time freezes.** Observed on #11's execution: `14 replies · 19.5k out · 1 sub-agent`, unchanged across **25 consecutive ticks** (12½ minutes), while the sub-agent was demonstrably working the whole time.

  The run was proven alive by three independent means, none of them the progress line: `6a5694b feat: 05a — the production build no longer reads the database` was committed at 19:44 with a full trailer; `Dockerfile` (5,946 bytes), `.dockerignore` and `next.config.ts` carried mtimes inside the frozen window, the last of them seconds before the check; and the SDK process was alive and consuming CPU throughout.

  **The replies half is correct by design** — `progress.ts:87` counts main-thread messages only, and the main thread genuinely is idle while a sub-agent works. **The token half is the defect.** `progress.ts:129-132` deliberately tallies each sub-agent's stream under its own key, with a comment explaining that a shared key would have them overwrite each other — the per-key design is right and is simply never fed. The `1 sub-agent` display is the tell: that count comes from `assistant` messages carrying a non-null `parent_tool_use_id` (line 83), so sub-agent *messages* arrive; output tokens come only from `message_delta` **stream events** (line 143), and those evidently do not arrive for sub-agents.

  **Why this is load-bearing rather than cosmetic.** The phase's stated goal is that a run stops being a black box. `timone-execute` spawns one sub-agent per sub-phase, so the fleet's work *is* the run — and across exactly that stretch the display is frozen. A frozen tick is also indistinguishable from a hung session: fvermaut asked "is it me or the daemon does nothing?" and the only way to answer was `ps` and file mtimes, which is the question the feature exists to make unnecessary.

  **Now quantified, at the session's close:**

  ```
  work   scratch-app#11 (execution) — 59m31s · 44 replies · 53.8k out
  cost   scratch-app#11 (execution) — 59m35s · 52 turns · $14.44 · claude-opus-5 170.3k out
  ```

  The live counter's last reading was **53.8k**; the authoritative `modelUsage` total was **170.3k**. The tick under-reported the session's output by **3.2×**, the missing ~116k being the fleet's work. The freeze/unfreeze boundary was also watched directly, confirming the mechanism: `14 replies · 19.5k out` held for 25 consecutive ticks while a sub-agent worked, then jumped to `22 replies · 31.5k out` the moment it returned.

  **The error scales with fan-out, which confirms the diagnosis better than any single number.** Measured across all four stages of the run:

  | stage | last tick | authoritative | under-report | fleet? |
  | --- | --- | --- | --- | --- |
  | execution | 53.8k | 170.3k | **3.2×** | yes, one sub-agent per sub-phase |
  | delivery | 23.8k | 52.3k | **2.2×** | yes, two review axes |
  | verification (retry) | 48.5k | 50.3k | 1.04× | no |

  A stage that spawns no sub-agents is very nearly accurate; the two fleet stages are out by multiples. Nothing is wrong with the main-thread accounting — only the fleet's work is invisible, exactly as the code reading predicted.

  14b took real trouble to avoid printing a confidently *wrong* number — it rejected `usage.output_tokens` for under-reporting ~30× — and shipped something that under-reports ~3× on any run using the fleet, which is every execution run. The direction of the error was fixed; its existence was not.

  **No fix proposed here, deliberately.** The obvious fallback — `usage.output_tokens` on the sub-agent's `assistant` message — is precisely the source `progress.ts:78-81` rejects as under-reporting by roughly thirty times. Whether sub-agent deltas can be obtained honestly is an investigation, not a one-liner, and 14h should route it as one. Note the interaction with ADR-0017: the tick is also the heartbeat, and the heartbeat kept stamping correctly throughout — **liveness was never affected**, only the display.

- **The tick's clock is not the session's clock — they disagree by 13×, and the heartbeat rides on the wrong one.** The verification session's ticks and its own closing line describe the same session:

  ```
  work   scratch-app#11 (verification) — 31s   · 5 replies · 1.4k out
  work   scratch-app#11 (verification) — 2m31s · 10 replies · 9.5k out
  work   scratch-app#11 (verification) — 17m46s · 11 replies · 9.5k out
  work   scratch-app#11 (verification) — 18m16s · 12 replies · 10.8k out
  work   scratch-app#11 (verification) — 33m49s · 14 replies · 11.9k out
  …
  work   scratch-app#11 (verification) — 1h05m · 21 replies · 15.7k out
  cost   scratch-app#11 (verification) — 5m05s · 32 turns · $1.88 · claude-opus-5 15.7k out
  ```

  The ticks reach **1h05m**; the SDK's own `duration_ms` says **5m05s**. Both are labelled as how long this session has been going, and `timone status` renders the tick's number as "working on it now … for Xm". This is precisely the two-dialects problem `e856ebb` set out to kill, reappearing on a different pair of numbers.

  **Reproduced three times, on three healthy sessions, always in the same direction:**

  | session | ticks reached | SDK `duration_ms` | unaccounted |
  | --- | --- | --- | --- |
  | verification (first) | 1h05m | 5m05s | ~60m |
  | verification (retry) | 23m46s | 15m08s | 8m38s |
  | delivery | 24m48s | 10m11s | 14m37s |

  The first could be blamed on the API error that ended it; the second and third cannot — both completed normally and handed on. Three occurrences settle that this is a property of the tick rather than an artifact of any one failure.

  **The tick spacing is the clue and it is highly regular:** pairs of ticks 30 s apart, separated by gaps of ~15m15s, ~15m33s, ~15m28s, ~15m. The awake stretches sum to roughly the 5m05s the SDK reports. **The most plausible explanation is the machine sleeping** — a `setInterval` does not fire while a laptop sleeps, but wall-clock elapsed advances across it. That would also retire the earlier "watch item": the 6½-minute gap in the crash log, provisionally blamed on the signal storm, is far better explained as sleep, and it appeared in the same log for the same reason.

  **The consequence is R18's, not R17's, and it is the serious half.** ADR-0017 makes the tick the heartbeat: `heartbeatAt` is stamped only when the tick fires. A 15-minute sleep therefore leaves a perfectly healthy run looking stale against a 2-minute threshold, and the next poll cycle after wake is entitled to reclaim it. **Nothing was reclaimed on this run**, but the margin appears to be a race between the ticker and the poll loop on wake rather than anything designed — and step 3's false-positive check does not cover it, because that check was "let a healthy session run untouched", not "let the laptop sleep".

  Not investigated further and no fix proposed: whether the SDK's `duration_ms` excludes suspended time, and whether a monotonic clock or a wake-aware staleness rule is the right answer, are questions for 14h to route. **R18 should not close until this is understood** — a laptop that sleeps is the normal operating environment here.

- **`timone retry` carries a dead attempt's flags into the fresh one.** It clears `failure` and `sessionId` but not `flags`, so #11 resumed carrying `the session changed 1 file(s) outside projects/scratch-app/` from its crashed attempt — a flag whose cause (`daemon.log`) had already been fixed by `8f96919`. `timone status` therefore shows `⚠ 1 automatic check(s) failed` about a file that no longer exists.

## Resolved watch item

The crash log's 6½-minute tick gap (`2m21s` → `8m54s`), provisionally blamed on the signal storm, is **superseded**. The same shape recurred on a healthy verification session in far more regular form, and sleep explains both. Folded into *the tick's clock is not the session's clock*, above; no longer tracked separately.

## What the run cost, and how it ended

| stage | wall | turns | cost | model |
| --- | --- | --- | --- | --- |
| approval record | 44s | 14 | $0.14 | `claude-haiku-4-5` |
| execution | 59m35s | 52 | $14.44 | `claude-opus-5` (`xhigh`) |
| verification (died on API error) | 5m05s | 32 | $1.88 | `claude-opus-5` |
| verification (retry) | 15m08s | 72 | $5.61 | `claude-opus-5` |
| delivery | 10m11s | 35 | $4.99 | `claude-opus-5` |

**Total for one ticket, plan gate to open pull request: $27.06.** Worth having on the record — it is the first end-to-end cost measurement the project has, and the fleet stages dominate it.

Execution produced seven commits and closed its phase with a clean tree, **amending its own plan twice** when it found defects in it (`0dd2b97`, `8d95c65`) rather than building to a spec it had discovered was wrong. It then advanced to verification by itself, with `timone status` reading `(checking the result)` — the `ca3bc09` fix holding across a second stage transition.

**Verification then died: `the session stopped on an API error (server_error)`.** An upstream infrastructure event, not a Timone defect — the same instability was hitting this session's own tooling at the same moment. **The daemon handled it exactly as designed:** failed the run with a plain reason, left `timone retry scratch-app#11` as the way back. Worth recording as an unplanned second proof of the failure path, on a different cause than the crash.

## Still owed before 14g can close

1. Step 1's remaining rows — triage on Sonnet, requirements and planning on Opus, observed rather than inferred.
2. Step 2's `> daemon.log` identity check.
3. The human gate: fvermaut confirms the daemon's output tells him what he wants while a run works, and that the interactive check would have caught the commit that blocked his build. **Both tick defects above bear directly on the first half of that gate** and should be put in front of him rather than asked around — on this evidence the honest answer is that the display told him the wrong stage, the wrong token count and the wrong elapsed time, and each was found and fixed or recorded.

**The two remaining steps are one run apart.** Both 1 and 2 want a fresh ticket taken from filing to the plan gate: step 1 needs triage and requirements and planning observed on their declared models, and step 2 needs that same run redirected with `> daemon.log` so the file can be diffed against what the terminal showed. Neither needs execution, so neither needs the $14 stage — a ticket stopped at the plan gate buys both. `scratch-app` is free (#11 released it), and #4 is already parked at triage if a fresh ticket is not wanted.

**Step 5 is complete** — thirteen commits, thirteen trailers, no harness file anywhere in history.

**Step 4 is complete** — both session kinds, violation and silence, in one pass. Its silence half is now observed on **three** daemon sessions (verification twice, delivery once), each of which required staying out of the timone repo for its duration. **Step 3's false-positive check is complete** at 59m35s, with the sleep hazard recorded separately as a path it does not cover.

**Step 6 is complete.** The loop ran ticket → triage → plan → human approval → execution → verification → delivery → pull request → **merge**, and survived a hard crash and an upstream API failure on the way without human repair beyond two `timone retry` calls.

[`scratch-app` #12](https://github.com/fvermaut/scratch-app/pull/12) — 14 files, +1535 / −24 — was merged by fvermaut at `21:08:53Z`. The daemon detected the terminal event and **closed ticket #11 at `21:09:18Z`, twenty-five seconds later**, marking the run `done` and releasing the project. Queue promotion had nothing to promote: #4 holds no project and #10 is failed.

Nothing in phase 14 changed the pipeline's behaviour, which is what the step set out to show.

## Register guidance for 14h

Nothing in this report justifies flipping **R15** or **R17** to `verified`; both carry open defects found by this gate. **R18** should wait on the sleep question. **R16** is proven at two rows of its table and unobserved at the rest.

**R19 is the one requirement this gate can flip to `verified`.** Step 5 tested it directly and it passed on every clause: thirteen machine-authored commits and thirteen complete trailers, `--grep` returning a complete index, zero harness files in history, and the interactive side correct in both directions — trailed where it should be, bare on the commit that was meant to be bare. It was also exercised incidentally throughout the gate rather than only under test.

The attribution defect is **not** a reason to hold R19 down, and 14h should resist the reflex to bundle them. R19 asks that the trailer be *written*; it was, on everything, without exception. The defect is that a different rule does not *read* it — which lands on R15, and which the trailer's own completeness is what makes fixable at all. Holding R19 down for it would penalise the one mechanism that worked.

## Sequencing note

Anything needing a fresh daemon session on `scratch-app` — a forced violation, a clean-silence pass — **must wait for #11 to release the project**. One session per project runs at a time, so there is no way to run one alongside without killing a healthy build that is itself serving as step 3's false-positive evidence and step 6's whole-loop proof. The order that costs nothing: let #11 run through verification and delivery, then use the released project for whatever step 4 still needs.
