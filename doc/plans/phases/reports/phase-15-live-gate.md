# Phase 15 — 15e live gate: observations

> Closes [sub-phase 15e](../phase-15.md). Everything below was observed against real repositories, the real ledger and the real `timone guardrails` CLI — the same code path the `SessionStart`/`Stop` hooks run. **Fixture ticket:** [`scratch-app#14`](https://github.com/fvermaut/scratch-app/issues/14), filed for the gate and closed at the end of it; every automatic-check comment on it was deliberately provoked.

## What has been observed

### Step 1 — the 14g accusation does not recur: **observed**

Two sessions were opened at the timone root with the daemon's baseline taken **first**, which is the condition that produced the defect: at 14g the session with the older baseline was blamed for the other's commits. The interactive session then did exactly what `dd86be88` did — committed this gate's own evidence into the timone workspace, trailed to itself.

The daemon session's `Stop` hook produced, in full:

- **no output**
- **no comment on `scratch-app#14`**
- **no flag on the run** (`flags: []`)
- **no line in `.timone/sessions.jsonl`** naming it

### Step 3 — and the silence is not the rules being dead: **observed**

Silence on its own proves nothing, so the discriminator was run immediately after, against **the same repository state and the same commit**: the *author* session's own `Stop` hook.

```
⚠️  Automatic check failed — timone: 1 commit(s) on `main` never reached the remote
    Branch `main` is ahead of its upstream.
    - b130a7f
guardrails flagged 1 violation(s) for this session
```

**Same commit, same instant, two sessions: the one that made it reports it, the one that did not stays silent.** That is the requirement, and it is the line that went onto a client's ticket at 14g.

This is also the **unpushed half** the plan called out separately, and it is the half that mattered most: `rev-list <branch> --not --remotes=origin` is a question about the repository with no session scoping in it at all, so before this fix *any* interactive session opened while the daemon was building reported the daemon's in-flight commits as its own. That is the common case, not the edge one.

### Step 2 — the rules still fire, on both sides: **observed**

A filter that silenced the rules would be indistinguishable from one that fixed them if the gate only checked for silence. Both directions were therefore provoked.

**Daemon side.** The run was working `scratch-app`, so a commit touching the timone workspace is a genuine violation — and it was trailed to the daemon session itself, so the new filter had no excuse available. It fired, flagged the run, and posted on the ticket through the loud channel. **The comment named exactly one file:**

```
⚠️ Automatic check failed — the session changed 1 file(s) outside `projects/scratch-app/`
- daemon-stray-15e.md (commit b9894fe)
```

At 14g the equivalent comment named **three files the session never touched**. Note the counts throughout: with three unpushed commits on `main` from three different sessions, the daemon session reported **1 file** and **1 commit**, not 3 — **the inflated count is fixed, and measured rather than asserted.**

**Interactive side.** An untrailed commit fired both applicable rules, printed them and journalled them, and — correctly — posted nothing to any ticket:

```
⚠️  Automatic check failed — timone: 1 commit(s) on `main` never reached the remote
⚠️  Automatic check failed — 1 commit(s) made in this session say nothing about where they came from
```

**This same step demonstrates the fix's known limit, live.** Three commits were unpushed at that moment; two carried trailers naming other sessions and were excluded, and the untrailed one was kept and attributed to the session that happened to be checking. That is the documented residual — an untrailed commit is genuinely unattributable, so it is over-reported rather than dropped — and it is the safe direction. It is now a test, a comment *and* a live observation.

### Step 4 — `timone retry` re-arms clean: **observed**

The fixture run was failed carrying two flags, then re-armed:

| | |
| --- | --- |
| flags on the dead attempt | `changed 1 file(s) outside …`, `1 commit(s) … never reached the remote` |
| after `timone retry scratch-app#14` | **`[]`** |
| `timone status` | no automatic-check warning |

**And the absence was proved to mean something.** A flag was then added to the re-armed run, and `timone status` immediately said so — `⚠ 1 automatic check(s) failed — see the ticket`. So the clean status after retry is the fix, not a display that never shows flags. That same probe incidentally confirmed 15c's second property live: **a flag the fresh attempt earns for itself survives**, which is what separates "clear the dead attempt's" from "clear all".

### Step 5 — the two false-positive flags on `scratch-app#11`: **cleared**

Both were removed, and the reasoning is recorded here rather than left implicit:

| flag | verdict |
| --- | --- |
| `the session changed 3 file(s) outside …` | **False.** The attribution defect: three commits made by interactive session `dd86be88`, every one of them carrying the trailer that would have exonerated the accused session. |
| `the session changed 1 file(s) outside …` | **True of the attempt that earned it, stale on the attempt that held it.** Its cause was `daemon.log` tracked at the root, fixed by `8f96919`; it was then carried into the fresh attempt by the `timone retry` defect. |

**Clearing both puts the ledger into exactly the state the fixed code would have produced**, which is the reason to prefer it over clearing only the provably false one: #11 was re-armed, and under 15c a re-armed run does not carry the dead attempt's flags at all. Neither flag would exist today.

**Not done, and left to fvermaut:** the false accusation is still standing **publicly on `scratch-app#11`**, under his GitHub identity. Clearing a local flag does not retract a comment on a client's ticket. Posting a retraction is an outward-facing action on a client repository and beyond what this sub-phase authorises, so it is named here as a decision rather than taken.

## Fixture hygiene

The gate made real commits in the real workspace and a real run in the real ledger. All of it was removed:

- three test commits discarded (`git reset --hard origin/main`); tree clean, `main` level with `origin/main`
- the `scratch-app#14` fixture run removed from `.timone/state.json` (6 runs → 5)
- the gate's baselines deleted; `scratch-app#14` closed with a comment saying its check comments were provoked
- `.timone/sessions.jsonl` **kept** — the journal is a permanent record and the gate's lines belong in it

## What this gate does not settle

- **R17 and R18 are untouched by it.** This gate is R15's evidence only; the tick's two numbers are [15a's finding](phase-15-clock-investigation.md) and phase 16's fix.
- **No LLM stage was run.** The subject here is the hooks, not the pipeline, and the hooks were exercised through their real CLI entry point against real git state. What this gate does *not* re-prove is that the pipeline end-to-end still works — phase 14's 13h/14g evidence stands and nothing in phase 15 touches the pipeline.
- **The human gate is outstanding:** fvermaut confirming he would now trust a guardrail comment on a client's ticket.
