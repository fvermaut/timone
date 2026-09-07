# Phase 35 — Verification Report

- **Date:** 2026-09-05
- **Phase:** [phase-35.md](../phase-35.md) — stamped `Complete`, completion report [phase-35-complete.md](phase-35-complete.md)
- **Scope:** claimed — PRD-03.R1, PRD-03.R3, PRD-03.R5 (all MUST)
- **Live gate owed:** yes — PRD-03.R1 and PRD-03.R5. This diff touches every path each of them declares it depends on. Neither has ever been gated.
- **Regression set (derived):** empty after narrowing. The MUST + `api` + `verified` set at this HEAD is PRD-01.R2 and PRD-01.R3; both were narrowed out.
- **Branch:** `timone/105-1-the-run-carries-on-instead-of-stopping` @ `bb96a2d` — working tree clean on arrival. No parent phase branch needed merging in: this phase is the first built against PRD-03, and its merge base with `origin/main` is `ca9a38f`.

## Outcome

**The gate did not pass.** PRD-03.R3 is **BLOCKED** — it is a MUST criterion the register puts on the `api` channel, and it cannot be checked on that channel, in this pass or any other, as it is currently written. No criterion failed. Nothing regressed. No fix loop was consumed, because BLOCKED asserts nothing about behaviour. The register is untouched and all three criteria stay `draft`.

## Environment

The deliverable is a command-line tool and a daemon, so production form is the compiled output, not `tsx`:

- `npm run build` (`tsc`) — exit 0, no diagnostics.
- `node dist/cli.js --help` — answers, listing `projects`, `workspace`, `daemon`, `guardrails`, `status`, `transcript`, `takeover`.

No server was started: nothing in scope needs one, and this tool has no long-running foreground process to keep alive.

**Build-health smoke, run once and reported as exactly that:** `npm test` (`vitest run --passWithNoTests`) — 40 files, 1624 tests, all passing, 2.11s. This is not criterion evidence and none of the verdicts below rest on it. It did not contradict any probe, because no probe ran (see Probes).

**One environment constraint, recorded because it limited the pass.** Every access to this stage's probe directory — reading, writing and executing — was refused by a guard in this session's tooling, with the message that the directory belongs to the stage that checks the build and that nothing which builds code may read it. That guard exists to keep builders out; it did not distinguish this session, and it was not worked around. The practical effect on this pass was nil, because no probe was owed (see Probes). The effect on a future pass would not be nil: a criterion needing a fresh probe could not have one written or committed from a session in this container. It is recorded here as a fault in the tooling, not in the phase.

## Independence declaration

Read: `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md`, `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md`, the `Status` line and requirements header of `doc/plans/phases/phase-35.md`, `doc/plans/phases/reports/phase-35-complete.md` whole, `package.json`'s scripts, and Timone's own `process.md` (stage 7). The other registers, `prd-01-process-layer.criteria.md` and `prd-02-inversion-of-control.criteria.md`, were read for their `Priority`, `Status`, `Verify-via` and `Depends-on` fields only, to derive the regression set.

Not read: `phase-35-handoffs.md`, `phase-35-departures.md`, any diff or `git show` of source, anything under `src/`, the committed test suite, the changed skill files under `.claude/skills/`, and the ADRs. The skill files matter specifically: they are what PRD-03.R3 declares it depends on, so reading them would have been reading the implementation of a criterion in scope.

Git was used to inspect the history of `doc/specs/prd/` and `doc/plans/phases/phase-*.md` only. PRD-03.R3's own verification hint directs exactly that — *"inspect the work branch after a driven amendment: the plan or register diff must show a dated marker"* — so those documents are the criterion's observable surface, not source under the prohibition.

No implementation source was read. No criterion evidence below comes from the project's test suite.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R1 | MUST | live | LIVE-GATE — never gated, fresh gate owed | 0 |
| PRD-03.R3 | MUST | api | **BLOCKED** — not checkable on its declared channel | 0 |
| PRD-03.R5 | MUST | live | LIVE-GATE — never gated, fresh gate owed | 0 |

## Evidence

### PRD-03.R3 — BLOCKED

The register puts this criterion on the `api` channel. Both its clauses were examined against the branch.

**Clause 1 — "GIVEN a build step that amends the plan or the requirements it is building against WHEN the amendment is made THEN it is committed on the work branch with a dated marker naming the run that made it, and the original wording stays readable in place."**

The clause's precondition never occurred on this branch. Commands as run:

```
$ git diff --name-status ca9a38f HEAD -- doc/specs/prd/ 'doc/plans/phases/phase-*.md'
A	doc/plans/phases/phase-35.md

$ git diff --name-status ca9a38f HEAD -- doc/specs/prd/
(no output)
```

The single change under those paths is an **addition** (`A`), not an amendment: `phase-35.md` was created by the planning commit `bf3f343`, before the build began. `git diff --numstat` reports it as 203 lines added and 0 removed. No register file changed at all. Confirmed independently by comparing each register against the default branch:

```
$ for f in $(git ls-files doc/specs/prd/); do ... sha256 of origin/main:$f vs HEAD:$f ... done
  same   doc/specs/prd/prd-01-process-layer.criteria.md
  same   doc/specs/prd/prd-01-process-layer.md
  same   doc/specs/prd/prd-02-inversion-of-control.criteria.md
  same   doc/specs/prd/prd-02-inversion-of-control.md
  same   doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md
  same   doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md
```

So there is no instance to inspect. That alone would make the clause unobserved rather than unverifiable. What makes it unverifiable is why no instance can be produced here.

The criterion's `Depends-on` line names `.claude/skills/timone-execute/` and `.claude/skills/timone-verify/` and nothing else — no `src/` path. The behaviour is therefore carried entirely by instructions that an agent session follows. There is no program to call and no stored state to read back, so nothing on the `api` channel can make the behaviour happen or observe it happening. The only instrument that produces an instance is a supervised run of a real build against real infrastructure, which is the `live` channel by definition, and which this container has none of. The criterion's own hint concedes the point by beginning *"after a driven amendment"* — driving one is a run's act, not a terminal command's.

This is BLOCKED in the precise sense the process defines: the check could not run at all, the criterion is unverifiable as written on the channel it declares. It is not FAIL — nothing was observed to be wrong, and no defect brief could honestly be written from an observation that does not exist.

**Clause 2 — "GIVEN the pull request is merged THEN the amendments land with it and stand ratified; GIVEN it is closed unmerged, THEN the amendments die with the branch and the requirements on the default branch are unchanged."**

The underlying mechanism was exercised in scratch space outside the tree, red and green, on a constructed amendment:

```
=== clause 2a — while unmerged, the default branch is unchanged ===
main digest now: 8082c498103386e8  (baseline 8082c498103386e8)
OK amendments are branch-local
=== clause 2b — merged, the amendment lands and stands ratified ===
OK amendment present on default branch after merge
=== clause 2c — closed unmerged: the amendments die with the branch ===
main digest after abandon: 44f542afe509d992 (baseline 44f542afe509d992)
GREEN requirements on the default branch are unchanged
=== BREAK STEP — amend on the default branch instead of the work branch ===
main digest now: 2c344b8e5b05e5c4 (baseline 44f542afe509d992)
RED as intended: an amendment that did not die with its branch is detected
```

The instrument works: it goes red when an amendment is written somewhere it would survive its branch, and green when it is not. The supporting precondition also holds on the real repository — every register file is tracked by git (`git ls-files doc/specs/prd/` lists all six), so branch semantics do govern them, and nothing keeps requirements in a store that would outlive a closed branch.

But this evidences the repository's layout, not this run's behaviour. The clause's subject is *"the amendments"* — the ones clause 1 describes — and this run produced none. The check was performed against an amendment this verifier constructed, which is a demonstration, not an observation of the deliverable.

**Criterion outcome.** A requirement's status is the weakest of its clauses' outcomes. Clause 1 is BLOCKED, so **PRD-03.R3 is BLOCKED**. Its register line is untouched and it stays `draft`.

**A discrepancy found while establishing the above, reported because the process requires it.** The register is the authority on expected behaviour, and where another document disagrees with it that disagreement is a finding. Two documents disagree with it here, and one disagrees with itself:

- `phase-35.md`'s requirements section states *"PRD-03.R1, R3 and R5 are all `Verify-via: live`"*.
- `phase-35-complete.md` states R3's channel correctly in its Requirements line — *"PRD-03.R3 (MUST) — draft, `Verify-via: api`"* — and then states the opposite in its closing section: *"PRD-03.R1, R3 and R5 are all `Verify-via: live` … Verification can check the daemon's own unit-level behaviour but cannot itself discharge R1/R3/R5."*

The register says `api`. The build proceeded believing `live`. On the substance the build's belief matches what this pass found: R3 cannot be discharged from a terminal. The register's `Verify-via` field is the one that is wrong, and it is not this stage's field to write — this stage writes `Status` and nothing else. Resolving it is the requirements owner's act, and it is the first thing named under **Handed to the human** below.

### PRD-03.R1 — LIVE-GATE

No probe was authored and no manual script was written, both by rule: a verification pass never performs a `live` criterion.

- `Last live gate:` — the register carries no such line for this criterion, so it reads **never**. It has not been observed by any gate.
- **Fresh gate owed: yes.** The criterion declares `Depends-on: src/daemon/, .claude/skills/timone-execute/, .claude/skills/timone-verify/, .claude/skills/timone-deliver/`. This phase's diff touches all four: `src/daemon/` (`cta.ts`, `faults.ts`, `pipeline.ts`, `session.ts`), `.claude/skills/timone-execute/SKILL.md`, `.claude/skills/timone-verify/SKILL.md`, `.claude/skills/timone-deliver/SKILL.md`.

Register line untouched; stays `draft`. This does not block the gate — a criterion that was never going to run here has not failed to run.

### PRD-03.R5 — LIVE-GATE

Same rule, same treatment.

- `Last live gate:` — no line in the register, so **never**.
- **Fresh gate owed: yes.** Declares `Depends-on: src/daemon/, .claude/skills/`; the diff touches both.

Register line untouched; stays `draft`.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` or `browser` channel, and no HUMAN-CHECK was carried forward by the completion report. A `live` criterion never receives a manual script: writing one would name the wrong performer, because a supervised machine run is not a set of steps a person follows off a page.

## Live gates

- **PRD-03.R1** — last live gate: `never` (no `Last live gate:` line in the register). This phase **owes a fresh gate**: its diff touches all four declared dependencies.
- **PRD-03.R5** — last live gate: `never` (no `Last live gate:` line in the register). This phase **owes a fresh gate**: its diff touches both declared dependencies.

Neither is BLOCKED and neither blocks this pass on its own. Both are owed before delivery, and the phase does not reach a merge until they have run and their report is committed.

A defect in the register itself, noted while reading these fields: **PRD-03 gives no `Last live gate:` line to any of its four `live` criteria** (R1, R2, R4, R5), whereas PRD-01 carries the line on every one of its own. The absence reads as `never`, so nothing here is misreported, but the line is required, and without it the channel is a promise pointing at nothing. Adding it belongs to the requirements owner.

## Regression

**The derived regression set is empty after narrowing; nothing was re-run.**

Derived before narrowing — the criteria that are MUST, `api` and `verified` at this HEAD:

| ID | Depends-on | In set? |
| --- | --- | --- |
| PRD-01.R2 | `src/manifest.ts, src/commands/projects.ts` | no — narrowed out |
| PRD-01.R3 | `src/commands/workspace.ts, src/git.ts` | no — narrowed out |

**What the narrowing removed, and why:**

- **PRD-01.R2** — declares `src/manifest.ts` and `src/commands/projects.ts`. This diff touches neither; both files are unchanged between `ca9a38f` and HEAD.
- **PRD-01.R3** — declares `src/commands/workspace.ts` and `src/git.ts`. This diff touches neither.

The diff's fifteen files are confined to `src/daemon/`, three skill files, `process.md`, and documents under `doc/plans/phases/`. No other criterion qualified for the set in the first place: the remaining `api` criteria are either SHOULD priority (PRD-01.R18, PRD-02.R9, R12, R16, R19), or not `verified` — `draft` (PRD-01.R23, PRD-02.R11, R21, R22, R23), `revised` (PRD-02.R3, R5, R14, R18), or `failed` (PRD-02.R20).

Both removals are arguable, and that is why they are listed. Neither criterion's declared dependencies overlap this phase's diff, so neither was re-run.

## Probes

**0 probes authored, 0 probes run. 0 proven able to fail, 0 not — because none was owed.**

Per criterion:

- **PRD-03.R1**, **PRD-03.R5** — `live`. Authoring a probe for a `live` criterion is forbidden, not merely unnecessary.
- **PRD-03.R3** — `api`, and the only criterion in scope that could have carried a probe. None was authored: clause 1 has no fact a terminal can flip, for the reason set out under Evidence, and a probe that cannot make the behaviour happen cannot be seen to fail on it. Clause 2's mechanism was exercised red-then-green in scratch space and its output is quoted under Evidence, but it ran against a constructed amendment rather than an observation of this deliverable, so it is reported as a demonstration and is not counted as a probe.
- **Regression set** — empty, so the regression runner had nothing to run.

Clause coverage: PRD-03.R3's register lists two clauses, and both are addressed under Evidence with a stated outcome each. No clause went unexamined. No gap to close.

Independently of what was owed, this stage's probe directory was not reachable from this session at all — see the environment constraint above. Had a probe been owed, it could not have been written or committed from here.

## Fix-loop accounting

**0 of 2 loops consumed.** No FAIL and no REGRESSION was observed, so no defect brief was issued and no fix context was spawned. BLOCKED consumes no loop by rule: it asserts nothing about behaviour, and there is nothing for a fix context to repair.

## Register changes

**None.** Every criterion in scope stays `draft`, and the reason differs by channel:

- **PRD-03.R1**, **PRD-03.R5** — LIVE-GATE leaves the register untouched. Only a live gate can move them.
- **PRD-03.R3** — BLOCKED leaves the register untouched.

This report is therefore committed on its own. The report-and-flip coupling exists so that a status change always has evidence beside it; with no status changing, there is nothing to couple.

## Handed to the human

Three things remain. None is a defect in what phase 35 built.

1. **PRD-03.R3's channel is wrong in the register, and only the requirements owner can change it.** The register says `api`. The criterion describes what an agent does while building, its declared dependencies are two instruction files with no code behind them, and its own hint presupposes a driven run. It cannot be discharged from a terminal. Both the phase file and the completion report already assume it is `live`. The likely correct resolution is to move R3 to `live` so it rides the same gate as R1 and R5; the alternative is to reword its clauses so a terminal can reach them. Either way it is a change to `Verify-via`, which this stage may not write. Evidence: this report's Evidence section for R3.

2. **This phase owes a live gate before it can be delivered, covering PRD-03.R1 and PRD-03.R5** — and PRD-03.R3 as well, if the first item resolves the way it probably should. Neither R1 nor R5 has ever been gated. Until that gate has run and its report is committed, the phase does not pass, and the three criteria have no evidence behind them.

3. **Two smaller record defects, both for the requirements owner.** PRD-03 gives none of its four `live` criteria the `Last live gate:` line the process requires. And `phase-35-complete.md` contradicts itself on R3's channel between its Requirements line and its closing section.

A separate note for whoever maintains the harness rather than the requirements: this stage's probe directory refused every read, write and execute from this session. It did not cost this pass anything, because no probe was owed. It would stop the next pass that needs one.

---

# Iteration 2 — 2026-09-06

- **Date:** 2026-09-06
- **Phase:** [phase-35.md](../phase-35.md) — stamped `Complete`, completion report [phase-35-complete.md](phase-35-complete.md)
- **Scope:** claimed set PRD-03.R1 (MUST, `live`), PRD-03.R3 (MUST, `api`), PRD-03.R5 (MUST, `live`)
- **Live gate owed:** yes — PRD-03.R1 and PRD-03.R5: this phase's diff touches `src/daemon/`, `.claude/skills/timone-execute/`, `.claude/skills/timone-verify/`, `.claude/skills/timone-deliver/`, which their `Depends-on` lines declare
- **Regression set (derived):** empty — the only MUST + `api` + `verified` criteria at this HEAD are PRD-01.R2 and PRD-01.R3, and both were narrowed out (below)
- **Branch:** `timone/105-1-the-run-carries-on-instead-of-stopping` @ `f7fbcbe` — not stacked; no parent merge needed

## Environment

Timone is a CLI and daemon; its production form is the compiled build. `npm run build` (tsc) compiled cleanly. Build-health smoke, run once: `npx vitest run src/daemon` — 1179 tests in 21 files, all passing, matching the completion report's stated count. The smoke is build health only, never criterion evidence. No server was stood up: no in-scope criterion is checkable against a running process in this pass (see verdicts), and the regression set is empty.

## Independence declaration

Read: `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md` and the other two registers' status/priority/channel/depends-on lines (scope derivation only); `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md` (narrative); `doc/plans/phases/phase-35.md` status line and requirements header only; `doc/plans/phases/reports/phase-35-complete.md` whole; this report's own `## HUMAN-CHECK scripts` section from iteration 1 (lines 130–133 — it carries none forward); `README.md`, `CONTEXT.md`, `STATUS.md` (`doc/standards.md` does not exist in this repository); `doc/plans/phases/probes/` listing; the diff's file names only (scope narrowing). Not read: handoffs, the departures record, sub-phase bodies, diffs' content, source, the committed test suite, ADRs, iteration 1's verdicts or evidence. No implementation source was read.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R1 | MUST | live | LIVE-GATE | 0 |
| PRD-03.R3 | MUST | api | BLOCKED | 0 |
| PRD-03.R5 | MUST | live | LIVE-GATE | 0 |

## Evidence

### PRD-03.R1 — LIVE-GATE

`Verify-via: live`. The criterion carries no `Last live gate:` field — never observed by a live gate. This phase's diff touches every prefix its `Depends-on` line declares, so a fresh gate is owed. No probe and no manual script are authored for a `live` criterion; the register line is untouched.

### PRD-03.R3 — BLOCKED

`Verify-via: api`, but neither clause can be exercised from a terminal against this build:

- Clause 1 (a build step that amends the plan or the register commits the amendment with a dated marker naming the run, original wording readable in place): its GIVEN is a build step making an amendment. No such amendment exists on this branch — the diff touches no register file, and the completion report records no plan or register amendment (its one departure is a skill-file fix). Producing an instance means driving a build step through a contradiction, which is a supervised live run, not a terminal probe.
- Clause 2 (merged → amendments ratified; closed unmerged → amendments die with the branch): no pull request from this run exists yet, and opening or closing one is not this pass's to do.

BLOCKED asserts nothing about behaviour: no probe was authored (any probe would simulate the build step and then measure the simulation), the register line is untouched, no fix loop is consumed. Note for the human: the criterion's own verification hint says "inspect the work branch **after a driven amendment**" — its substance is only observable after a live driven run, so its declared channel (`api`) looks wrong. Revising the register is not this pass's authority. The completion report and the phase file both call R3 `live` in one passage while the register says `api`; the register is the authority, and this discrepancy is recorded here as a finding.

### PRD-03.R5 — LIVE-GATE

`Verify-via: live`. No `Last live gate:` field — never observed. Its `Depends-on` (`src/daemon/`, `.claude/skills/`) is touched by this diff, so a fresh gate is owed. Register line untouched.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` or `browser` channel, and iteration 1 carried none forward.

## Live gates

- PRD-03.R1 — last live gate: never. This phase owes a fresh one.
- PRD-03.R5 — last live gate: never. This phase owes a fresh one.

## Regression

The derived regression set is empty; nothing to re-run. What the narrowing removed:

- PRD-01.R2 (MUST, api, verified) — `Depends-on: src/manifest.ts, src/commands/projects.ts`; this diff touches neither.
- PRD-01.R3 (MUST, api, verified) — `Depends-on: src/commands/workspace.ts, src/git.ts`; this diff touches neither.

No other criterion at this HEAD is MUST + `api` + `verified`.

## Probes

0 probes run, 0 authored. R1 and R5 are `live` (no probe by rule); R3 is BLOCKED with no authorable probe (its preconditions cannot be produced from the terminal — see its evidence section). The committed probe set (`prd-01.r2.mjs`, `prd-01.r3.mjs`, `prd-02.r22.mjs`) was not run: none of their criteria are in scope after narrowing.

## Fix-loop accounting

0 of 2 loops consumed — nothing FAILED; BLOCKED consumes no loop.

## Register changes

None: LIVE-GATE leaves the register untouched by rule, and BLOCKED asserts nothing about behaviour.

## Handed to the human

The phase cannot pass this check as things stand, and no re-run of it will change that:

- R1 and R5 owe a live gate — a supervised run on real infrastructure — that this stage never performs and that has never been run. Until that gate has run and its report is committed, the phase does not pass.
- R3 is BLOCKED: declared terminal-checkable, but only observable after a driven run. It needs either the live gate (which would produce the amendment and the pull request its clauses require) or a register revision correcting its channel.

Both roads go through a person: scheduling the watched run, or revising the register. The ticket comment for this pass says so and carries the takeover command.
