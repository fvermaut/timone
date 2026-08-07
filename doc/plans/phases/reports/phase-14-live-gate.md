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

**The false-positive half is observed:** staleness is four intervals (2 minutes at the 30 s default) and the restarted execution session ran past **17 minutes** untouched with nothing reclaiming it.

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

**Still owed on the daemon side: a clean daemon session confirming silence.** Note that #11's run carries the stale flag through `timone retry` (see below), so its next clean session must be read with that in mind.

### Steps 5 and 6 — **not started**

Trailer inspection across the phase's commits, and taking #11 the whole way to a merged PR.

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

  **Proposed fix, if 14h routes it:** keep the baseline diff for finding candidate commits, but exclude any commit whose trailer names a different session. That removes the daemon-attribution line and the inflated count. The duplicate provenance line survives by necessity — an untrailed commit is genuinely unattributable — and over-reporting a real violation is the safe direction. That limit belongs in the record rather than engineered around.

- **The tick goes stale while the fleet works — every number but elapsed time freezes.** Observed on #11's execution: `14 replies · 19.5k out · 1 sub-agent`, unchanged across **25 consecutive ticks** (12½ minutes), while the sub-agent was demonstrably working the whole time.

  The run was proven alive by three independent means, none of them the progress line: `6a5694b feat: 05a — the production build no longer reads the database` was committed at 19:44 with a full trailer; `Dockerfile` (5,946 bytes), `.dockerignore` and `next.config.ts` carried mtimes inside the frozen window, the last of them seconds before the check; and the SDK process was alive and consuming CPU throughout.

  **The replies half is correct by design** — `progress.ts:87` counts main-thread messages only, and the main thread genuinely is idle while a sub-agent works. **The token half is the defect.** `progress.ts:129-132` deliberately tallies each sub-agent's stream under its own key, with a comment explaining that a shared key would have them overwrite each other — the per-key design is right and is simply never fed. The `1 sub-agent` display is the tell: that count comes from `assistant` messages carrying a non-null `parent_tool_use_id` (line 83), so sub-agent *messages* arrive; output tokens come only from `message_delta` **stream events** (line 143), and those evidently do not arrive for sub-agents.

  **Why this is load-bearing rather than cosmetic.** The phase's stated goal is that a run stops being a black box. `timone-execute` spawns one sub-agent per sub-phase, so the fleet's work *is* the run — and across exactly that stretch the display is frozen. A frozen tick is also indistinguishable from a hung session: fvermaut asked "is it me or the daemon does nothing?" and the only way to answer was `ps` and file mtimes, which is the question the feature exists to make unnecessary.

  14b took real trouble to avoid printing a confidently *wrong* number and landed on a confidently *stale* one.

  **No fix proposed here, deliberately.** The obvious fallback — `usage.output_tokens` on the sub-agent's `assistant` message — is precisely the source `progress.ts:78-81` rejects as under-reporting by roughly thirty times. Whether sub-agent deltas can be obtained honestly is an investigation, not a one-liner, and 14h should route it as one. Note the interaction with ADR-0017: the tick is also the heartbeat, and the heartbeat kept stamping correctly throughout — **liveness was never affected**, only the display.

- **`timone retry` carries a dead attempt's flags into the fresh one.** It clears `failure` and `sessionId` but not `flags`, so #11 resumed carrying `the session changed 1 file(s) outside projects/scratch-app/` from its crashed attempt — a flag whose cause (`daemon.log`) had already been fixed by `8f96919`. `timone status` therefore shows `⚠ 1 automatic check(s) failed` about a file that no longer exists.

## Watch item, not yet a defect

The crash log shows ticks at `2m21s` then `8m54s` — a 6½-minute gap where thirteen were owed. A gap that long on a *healthy* session is exactly the false positive step 3 exists to rule out. **It has not reproduced**: the restarted session ticked unbroken every 30 s across the whole observed window. The benign explanation — the signal storm starving the whole process, poll loop included, so nothing was awake to reclaim anything — is the better-supported one, but this is worth one more look before 14h closes R18.

## Still owed before 14g can close

1. Step 1's remaining rows — triage on Sonnet, requirements and planning on Opus, observed rather than inferred.
2. Step 2's `> daemon.log` identity check.
3. A **clean daemon session confirming silence** — the last piece of step 4. The daemon violation is observed but incidental; 14h decides whether a forced one is still required. **R15 needs both kinds in one pass**, and the interactive half alone does not earn it back.
4. Steps 5 and 6 in full.
5. The human gate: fvermaut confirms the daemon's output tells him what he wants while a run works, and that the interactive check would have caught the commit that blocked his build. **The stale-tick defect above bears directly on the first half of that gate** and should be put in front of him rather than asked around.

## Sequencing note

Anything needing a fresh daemon session on `scratch-app` — a forced violation, a clean-silence pass — **must wait for #11 to release the project**. One session per project runs at a time, so there is no way to run one alongside without killing a healthy build that is itself serving as step 3's false-positive evidence and step 6's whole-loop proof. The order that costs nothing: let #11 run through verification and delivery, then use the released project for whatever step 4 still needs.
