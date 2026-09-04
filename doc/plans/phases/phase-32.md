# Phase 32: Timone works its own tickets

> **Status:** Complete, 2026-09-04 — [completion report](reports/phase-32-complete.md), [live gate](reports/phase-32-live-gate.md). 32e reached three of its four things: no pull request was opened, because the run parked at verification and was right to ([timone#84](https://github.com/fvermaut/timone/issues/84)).
>
> Governing decision: [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) — the whole of this phase.
>
> **Its condition is met.** D1 says Timone joins its own manifest once [ADR-0049](../../adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) is built *and has been observed working on a real run*. [Phase 31](phase-31.md) built it, and [its gate](reports/phase-31-live-gate.md) watched it working — twice, the second time with a real session in a container on the merged commit.

## ✏ Pre-flight findings, 2026-09-04

Read against the tree before a line was planned. **Recorded and not resolved**; nothing below is shaped around them.

**Finding (a) — the STATUS.md rule fires on every Timone self-run, and ADR-0050 does not mention it.** `checkStatusPlacement` (`src/daemon/hooks.ts:156`) reports any commit touching `STATUS.md` that is not on the repo's default branch. Every phase writes `STATUS.md` — it is an obligation on every stage ([process.md](../../../process.md), status reporting) — and a self-run works on a branch like any other run. So **every** Timone self-run would end flagged, and `timone status` would print `⚠ 1 automatic check(s) failed` against work that did exactly what it was told.

It is worse than noise, because the rule **already has a false-positive bug**: [timone#70](https://github.com/fvermaut/timone/issues/70), reproduced on this repository on 2026-09-04. `commit.branch` is decided by containment, so a commit that is on `main` *and* on a branch cut from `main` is reported against the branch. Two findings fired at once that evening, one true and one false, which is how a check stops being read.

ADR-0050 D5 narrows one guard. This is a second one, and it is not in the decision.

**Finding (b) — the harness guard's second half has no target check, exactly as D5 says.** Confirmed at `hooks.ts:269`: `for (const project of evidence.projects)` flags any commit containing a `HARNESS_PATHS` prefix, whoever the project is. A Timone self-run committing `process.md`, `standards/` or `.claude/` — which is honest Timone work — fires it every time.

**The handle is better than the name.** `RepoEvidence.repo` carries the project's manifest key, so `repo === "timone"` would work and is one typo from being wrong: a client project named `timone` would be exempted silently. The repository's own identity — the project's `repo_url` against the workspace's origin — says what is meant.

**Finding (c) — a boxed self-run clones the same repository twice, and that is correct.** `container-runtime.ts:401` clones `$TIMONE_REMOTE` to `$WORKSPACE/timone` at `$TIMONE_COMMIT`, then `$PROJECT_REMOTE` to `$WORKSPACE/timone/projects/<name>` on the work branch. For a self-run both remotes are this repository, at two different commits: the harness the run *obeys*, and the project the run *changes*. Written down so nobody removes one as a duplicate.

**Finding (d) — "the daemon is out of date" is two questions, not one.** [timone#5](https://github.com/fvermaut/timone/issues/5) is about the **daemon's own process**, which loads its code once. A boxed run already pins `TIMONE_COMMIT` and refuses a commit that is not on the remote, so a *run* is never stale in the way a daemon is. A message that does not say which of the two it is talking about will send an operator to restart the wrong thing.

## ✏ Findings from execution, 2026-09-04

Three things the pre-flight did not see. The first blocked 32e and was fixed; the other two are recorded and not resolved.

**Finding (e) — a project with no compose file could not be run at all, and Timone is one.** `bringUpServices` (`src/daemon/services.ts`) **threw** when a project committed no compose file, and the throw happens before the container exists, so the spawn is refused. Timone is a command-line program with no services beside it. Every self-run would have failed on its first cycle with a message telling fvermaut to add a database to Timone.

The rule was right for the two projects that existed when it was written and wrong as a rule about every project. Not committing a compose file is a statement, not an omission. It now stands nothing up and says so on the daemon's log, keeping the message that named what to add for a project where it really was an omission. Fixed in `da4a419`, before 32e rather than during it.

**Finding (f) — the workspace and the project are both called `timone` in a finding's own words.** `collectEvidence` labels the workspace `"timone"` (`hooks.ts`), and the project checkout's label is its manifest key, which is now also `timone`. So on a self-run a message reading `timone: STATUS.md was written on …` does not say which of the two clones it means.

**The rules are right; only the words are ambiguous.** Neither 32b nor 32c decides anything on the label — 32b compares the repositories' `origin`, and 32c distinguishes the workspace by its position in the evidence rather than by its name. This is a readability cost on exactly the run 32e watches, and it is one line to fix. It is recorded here rather than fixed because nothing in this phase's red-green asked for it.

**Finding (g) — an old `timone` binary cannot read a new ledger.** The state file is a `z.strictObject`, so an unknown top-level key fails the parse and `readState` throws. 32a adds one (`daemon`). The moment a phase-32 daemon writes a cycle, a globally installed `timone` from before phase 32 fails on **every** command that reads the ledger — `status`, `takeover`, `daemon` — with `Invalid daemon state file`.

This is the established pattern rather than a new hazard: `previews`, `introductions` and `initiatives` each did the same. It is written down because there is a globally installed old binary on this machine today, and because it sharpens 32a's own subject: an old daemon beside a new ledger is not merely stale, it is stopped.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md)
> — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

No criterion in either register asks for this. ADR-0050 is a decision about **how Timone is worked on**, not a promise about what it does for a project, and inventing a criterion to hang it on would put a process change in a register that measures product behaviour. If the throughput bet of D2 is to be measured, that measurement is a report, not a criterion.

**This phase writes no requirement and lapses none.** Say so plainly at the gate rather than leaving a reader to wonder which register moved.

## Goal Description

fvermaut types every Timone fix. ADR-0050 is a bet that he should not have to, and its condition is now met. What stands between the decision and the manifest entry is three guards that would fire on honest self-run work, one of which the decision does not mention, plus the one thing the decision named as a precondition and phase 31 did not build.

**What this phase is not.** It is not marking twenty-six issues. How much of the open list goes to the daemon at once is fvermaut's, and it is asked as a question below rather than decided here — D2's measurement needs a baseline, and a first self-run that goes wrong is cheaper to read one ticket at a time.

**The order is deliberate.** Every guard is fixed and proved able to fail *before* the manifest entry, because a self-run that ends in three false findings is a self-run nobody will trust, and the trust is the whole point of the bet.

## Context & Prerequisites

- **`src/daemon/hooks.ts`** — `HARNESS_PATHS` (118), `isHarnessPath` (223), `checkPathContainment` (242) with its two halves and the docblock at 227 that already explains why they differ, `checkStatusPlacement` (156), `checkBranchPlacement` (~200), `RepoEvidence.repo` (47).
- **`src/daemon/container-runtime.ts`** — the clone sequence at 401–425, `TIMONE_COMMIT` at 875.
- **`src/manifest.ts`** — what a manifest entry must carry, and what `workspace sync` does with `path`.
- **`src/commands/daemon.ts`** — where the daemon starts, and what it already prints at start-up (the model-login line is the precedent for a start-up statement an operator acts on).
- **[ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md)** and **[ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md)** — why this is possible at all; neither changes.

## Sub-phases

### Sub-phase 32a: The daemon says when it is running old code

[timone#5](https://github.com/fvermaut/timone/issues/5), and ADR-0050 D6 calls it *"a precondition of this decision, not a companion to it"*.

The daemon records the commit it started on and says, each cycle where it can tell, that the default branch has moved past it. Per finding (d) the message names **the daemon's own process** and says what to do about it — a restart — and does not talk about runs, which pin their own commit and refuse an unpushed one.

**Where it is said matters more than that it is said.** The daemon's terminal is the surface an operator is not reading, which is [#75](https://github.com/fvermaut/timone/issues/75)'s whole complaint. `timone status` is where a person looks.

Red-green: (1) a daemon on the tip says nothing; (2) a daemon behind the default branch says so, once, not once a cycle; (3) it says which commit it is on and that a restart is what fixes it; (4) an unreachable forge produces no claim in either direction — not knowing is not the same as being current.

#### Agent Validation Steps
```bash
npm run build && npx vitest run src/commands/daemon.test.ts src/commands/status.test.ts
```
- [ ] Four cases, each seen red first
- [ ] Case (4) asserts silence rather than a reassurance. A check that says "up to date" when it could not ask is worse than one that says nothing

> Depends on nothing.

---

### Sub-phase 32b: The harness-file rule names its exception

ADR-0050 D5, and pre-flight finding (b).

`checkPathContainment`'s second half refuses harness files in a repository that is **not Timone's own**. The test is the repository's identity rather than its manifest key, per finding (b). `CLAUDE.md` says the same rule in words and is narrowed with it, in the same commit, because the two disagreeing is how the next reader learns the wrong rule.

Red-green: (1) a harness file committed into a client repo is still refused, with the words unchanged; (2) the same file committed into Timone's own project checkout is not; (3) a client project whose manifest key is `timone` is **still refused** — the name is not the test; (4) `doc/` and `CONTEXT.md` are untouched in both, which is R2 and must not move.

#### Agent Validation Steps
```bash
npm run build && npx vitest run src/daemon/hooks.test.ts
```
- [ ] Four cases, each seen red first
- [ ] Case (3) is the one that makes the narrowing safe. A suite with (1) and (2) alone passes against a string comparison

> Depends on nothing.

---

### Sub-phase 32c: The STATUS.md rule stops crying wolf

Pre-flight finding (a), and [timone#70](https://github.com/fvermaut/timone/issues/70). **Two faults, and they must not be conflated.**

**The false one first.** A commit that is an ancestor of the remote default branch was not "written on this branch", whatever `git branch --contains` says. Fixing this alone removes the finding that fired wrongly on 2026-09-04 and on `ivtrends` on 2026-08-30.

**The true one is a decision, not a bug.** A Timone self-run writes `STATUS.md` on a work branch because that is what every run does, and the file is genuinely not on `main` until the pull request merges. The rule is *right* and the answer is *"yes, and that is the process"*. Either the rule learns that a run's own work branch is where a status file is supposed to be written — the finding being about a *stray* commit, not a planned one — or it is dropped for a repository that is a managed project. **This slice does not guess**: D-2 below settles it — expected on a run's own work branch, a finding anywhere else.

Red-green: (1) a commit on the default branch and on a branch cut from it produces no finding; (2) a commit written only on a branch still does; (3) `ivtrends`' 2026-08-30 pair is replayed and only the true half fires.

#### Agent Validation Steps
```bash
npm run build && npx vitest run src/daemon/hooks.test.ts
```
- [ ] Three cases, each seen red first
- [ ] Case (3) uses the shas from the issue, not invented ones

> Depends on nothing. Its second half is settled by D-2 below.

---

### Sub-phase 32d: Timone joins the manifest

ADR-0050 D1. The entry at `projects/timone`, materialised with `workspace sync`.

Per finding (c) a boxed self-run holds two clones of this repository and that is correct; a slice that "fixes" it has broken the run.

Red-green: (1) `timone projects list` shows it; (2) `workspace sync` clones it and `~/dev/timone` is untouched — ADR-0043, asserted rather than assumed; (3) a run registered against it enters at the right stage; (4) the guards of 32b and 32c are silent on a self-run's honest commit, which is the whole reason they come first.

#### Agent Validation Steps
```bash
npm run build && npx vitest run && node dist/cli.js projects list
```
- [ ] The whole suite: this changes what the manifest can contain
- [ ] Case (2) checks `~/dev/timone` by its git status before and after

> Depends on 32a, 32b, 32c.

---

### Sub-phase 32e: The first self-run, watched

A real daemon, a real Timone ticket, in a box.

**And it is watched with the daemon that is already running stopped first.** [Phase 31's boxed gate](reports/phase-31-live-gate.md) found that `--state` isolates the ledger and not the tracker: two daemons polled one project at once and nothing collided by luck. That mistake costs more here, because the project is Timone.

Four things:

1. **One of D-1's three tickets is picked up, built in a box and opened as a pull request**, with `~/dev/timone` untouched throughout.
2. **The guards are silent** — no harness finding, no STATUS finding, no path finding, on a run that committed `src/`, `doc/` and `STATUS.md`.
3. **The merge is fvermaut's** (D3), and the pull request says what it changed the way a client project's does.
4. **The daemon says it is out of date** the moment that pull request merges (32a), which is D6's whole point.

#### Agent Validation Steps
- [ ] No other daemon running — the process table checked, not just the ledger
- [ ] Each of the four observed, with times and the ledger's own words quoted
- [ ] What could not be reached is written down as its own section

> Depends on 32d.

---

### Sub-phase 32f: Close the phase

Completion report at `reports/phase-32-complete.md`, and the first reading of D2's number: handbacks per merged step ticket, against `ivtrends#24`'s three.

> Depends on 32e.

## Dependency graph

```
32a ──┐
32b ──┼──> 32d ──> 32e ──> 32f
32c ──┘
```

## The two open questions, decided

**fvermaut delegated both on 2026-09-04** — *"I let you decide the answers, whatever is fine for me"*. They are written here rather than left in a conversation, because a decision nobody can find later is a decision that gets taken again.

### D-1 — Three tickets go first, and one of them is in `src/daemon`

- **[#39](https://github.com/fvermaut/timone/issues/39)** — primary sources owed for the UI/UX baseline's craft rules. Documentation only, no code, and it exercises the whole loop cheaply. It may well hand back on the judgement it contains — a rule that is house style rather than research has to be *called* house style — and a handback on the first ticket is worth reading rather than avoiding.
- **[#15](https://github.com/fvermaut/timone/issues/15)** — `timone status` is blind to three things the tickets know. `src/commands`, user-visible, and checkable at a terminal in one command.
- **[#20](https://github.com/fvermaut/timone/issues/20)** — the duplicate approval comment. Small, its effect is visible on a ticket, and **it is in `src/daemon`**.

**The third one contradicts this plan's own first recommendation, and the recommendation was weak.** It said "none of them in `src/daemon`", on the grounds that a bad change to the daemon breaks the machine making the change. [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) already answers that: a run cannot modify the daemon hosting it, and D3's merge gate is where a change that would break the machine is caught. [ADR-0050 D4](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) refuses a fence in as many words, and a first three that only touched prose would prove nothing about the bet.

**Three and not twenty-six**, because D2's number needs a baseline and a first week that goes wrong should cost one ticket rather than a day of reviewing.

### D-2 — A status file on a run's own work branch is expected; anywhere else it is still a finding

`checkStatusPlacement` keeps its purpose — a status file the human will not see is worth saying out loud — and gains two corrections.

**The false half, which is [timone#70](https://github.com/fvermaut/timone/issues/70).** A commit that is an ancestor of the remote default branch was not written on this branch, whatever containment says. This is the fix that stops the rule reporting merges that have already landed.

**The true half.** A run writes `STATUS.md` on its work branch because that is what the process asks of every stage, and the file reaches `main` when the pull request does. So a status file on a **run's own work branch, in the repository that run is working**, is expected and silent. The prefix is already known to this module — `checkBranchPlacement` uses it.

**Everywhere else the finding stands**, and that includes an interactive session's own branch. It fired twice on this session's branches on 2026-09-04 and it was right both times: the file was not going to be seen until a pull request merged, and saying so once per branch is the reminder the rule was written to give.

## What 32e was waiting for, and what happened

**Written 2026-09-04 before the gate; kept as it was, with the outcome under it.**

Two things were his and both were answered. The daemon he had running (pid 74396) was stopped at 20:05:03 UTC — nothing was in flight, `ivtrends#74` had parked three minutes earlier — after he was asked and said *"Run it now"*. [timone#39](https://github.com/fvermaut/timone/issues/39) was given the `timone` label, which had to be created on this repository first.

**The gate ran 20:05–20:41 and is written up in [its own report](reports/phase-32-live-gate.md).** timone#39 was picked up, triaged, planned and built in a container, and parked at verification. It planned and executed its own phase 33 on itself. No pull request was opened, so nothing reached him to merge.

**What stopped it is [timone#84](https://github.com/fvermaut/timone/issues/84)**: 2 of 20 regression criteria passed and 18 could not run at all in a box with no `docker`, no credential beyond this repository, and no other project cloned. That is a decision about how Timone verifies itself, and until it is made every Timone ticket stops in the same place.
