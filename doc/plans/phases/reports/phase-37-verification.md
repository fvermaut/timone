# Phase 37 — Verification Report

- **Date:** 2026-09-07
- **Phase:** [phase-37.md](../phase-37.md) — stamped `Complete`, completion report [phase-37-complete.md](phase-37-complete.md)
- **Scope:** PRD-03.R1 (MUST, `live`) — the single ID the phase file's requirements header carries, cross-checked against the completion report's requirements line, which names the same one.
- **Live gate owed:** **yes** — PRD-03.R1. Its `Depends-on` line lists `src/daemon/`, and this phase's diff changes `src/daemon/poll.ts` and `src/daemon/poll.test.ts`.
- **Regression set (derived):** empty after narrowing. See [Regression](#regression) for the pre-narrowing set and every removal.
- **Branch:** `timone/115-daemon-resumes-a-parked-run-on-a-held-ti` @ `62dfd9fbfa0c3d4d7e284b1304dd19abe2c9eabc`, working tree clean at entry. Not stacked: the branch is cut from `origin/main` at `7b520be`, which already carries phase 36's verification commits, so nothing was merged in.

## Environment

Timone is a command-line tool and a daemon; there is no server to stand up and no dev-versus-production split beyond the TypeScript build. It was observed in its production form — the compiled output under `dist/`, never `tsx src/cli.ts`.

Commands, in order, from `projects/timone/`:

```
node --version                  # v24.18.1
npm run build                   # tsc — exit 0
node dist/cli.js --help         # the compiled CLI answers, listing projects/workspace/daemon/
                                # guardrails/status/transcript/takeover
```

`npm run build` is `tsc`, so a clean build is also a clean type-check.

**Build-health smoke (not criterion evidence).** The project's own suite was run once, as the completion report instructs:

```
npx vitest run
  Test Files  40 passed (40)
       Tests  1628 passed (1628)
    Duration  2.02s
```

Green. This is reported as a build-health signal only. It contradicts nothing below, because no probe ran this pass — see [Probes](#probes).

## Independence declaration

**Read:** `doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md` (the register in full), `doc/specs/prd/prd-01-process-layer.criteria.md` and `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (read only for the `Priority` / `Status` / `Verify-via` / `Depends-on` fields, to derive the regression set), `doc/plans/phases/phase-37.md`, `doc/plans/phases/reports/phase-37-complete.md` (whole), `STATUS.md`, `package.json`, and Timone's own `process.md` stage 7. The list of changed paths was taken with `git diff --name-only` — path names only, never the diff's content — because the narrowing rule cannot be computed without it.

**Not read:** `phase-37-handoffs.md`, any diff or `git show` of code, anything under `src/`, the committed test suite, ADRs.

**One departure from the read list, declared.** The phase file was opened with `sed -n '1,60p'`, which returned the whole file rather than only the `Status` line and requirements header. Sub-phase 37a's body was therefore read, and it describes the intended code change and the intended test cases — build knowledge this stage is meant not to have. The effect on this pass is nil in fact, not by argument: the one in-scope criterion is on the `live` channel, so no probe was authored, no behaviour was judged, and no verdict rests on anything observed there. It is recorded rather than glossed over, because a later reader must be able to weigh it themselves.

No implementation source was read. No criterion evidence is claimed below from any source at all — the single in-scope criterion resolves to a live-gate report line, as the channel requires.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-03.R1 | MUST | live | LIVE-GATE — fresh gate owed | 0 |

No FAIL, no REGRESSION, no BLOCKED. The closing gate is **not** met, for one reason and one reason only: a phase that owes a fresh live gate does not pass until that gate has run and its report is committed.

## Evidence

### PRD-03.R1 — LIVE-GATE

The criterion is `Verify-via: live`. This stage never performs a live check, never authors a probe for one and never writes a manual script for one — the deliverable is the gate line, and it is in [Live gates](#live-gates) below.

For the record of what the criterion asks and what has been seen of it:

- **Register status at this HEAD:** `verified`.
- **Clause 3** is the clause this phase's ticket is about: *"GIVEN a pull request from a run is closed without merging, WHEN the next poll cycle completes, THEN nothing further is committed to that branch and the requirements on the default branch are unchanged, and the run stops rather than restarting on its own: the ticket is marked held and a comment asks the human which of three things the close meant…"*
- **What the existing gate covered.** The [phase-35 live gate](phase-35-live-gate.md) is the report R1's `Last live gate:` names. Its recorded scope for clause 3 is the reworded stop-and-ask, observed on the path that applies the hold. The register's own `✏ 2026-09-07` note records that rewording and the decision behind it.
- **Why that is not enough for this phase.** The phase's completion report states plainly that the change closes a gap in the mechanism R1's `verified` status covers, and that whether re-examining R1 needs a fresh live gate is this stage's call. It does, and the rule is mechanical rather than a judgement: R1 declares `src/daemon/` among its dependencies, and this phase's diff changes `src/daemon/poll.ts`. A fresh gate is owed.

The register is left at `verified`. A LIVE-GATE verdict asserts nothing about behaviour and writes nothing — it does not lower the status, and it does not raise it.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` or `browser` channel, and the completion report carries no HUMAN-CHECK item forward from an earlier phase.

A live gate is deliberately **not** written up as a HUMAN-CHECK script here. The two channels differ by who performs the check: a live gate is a machine run with a person watching, not a list of steps a person follows, and writing it as a script would name the wrong performer.

## Live gates

- **PRD-03.R1** — `Last live gate:` [phase-35-live-gate.md](phase-35-live-gate.md), 2026-09-07. **This phase owes a fresh one**: R1's `Depends-on` lists `src/daemon/`, and the diff changes `src/daemon/poll.ts` and `src/daemon/poll.test.ts`.

That is the only `live` criterion in this phase's claimed scope. For completeness, because the delivery gate reads the same rule against every live criterion rather than only the claimed one, these live criteria also declare `src/daemon/` and are touched by this diff: PRD-01.R4; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R2, R4, R5. They are listed as information, not as separate verdicts — they sit outside this phase's claimed scope and outside the derived regression set. In practice one watched run that exercises the parked-run resume path against a held ticket is the instrument for all of them; PRD-03.R1 is the one that must be recorded.

## Regression

**The derived regression set is empty; nothing to re-run.**

Derivation, from the three registers as they stand at this HEAD. The rule is: priority MUST, `Verify-via: api`, status `verified`.

| ID | Priority | Channel | Status | In the pre-narrowing set? |
| --- | --- | --- | --- | --- |
| PRD-01.R2 | MUST | api | verified | yes |
| PRD-01.R3 | MUST | api | verified | yes |

Nothing else qualifies. Every other `api` criterion carrying `verified` is priority SHOULD (PRD-01.R18; PRD-02.R9, R12, R16, R19), and every other MUST `api` criterion is `draft`, `revised` or `failed` (PRD-01.R23, R24; PRD-02.R3, R5, R11, R14, R15, R17, R18, R20, R21, R22, R23). No MUST `api` `verified` criterion lacks a `Depends-on` line, so nothing enters the set by the always-in-scope rule.

**What the narrowing removed** — both members, leaving the set empty:

- **PRD-01.R2** — removed by `Depends-on: src/manifest.ts, src/commands/projects.ts`. The diff touches neither.
- **PRD-01.R3** — removed by `Depends-on: src/commands/workspace.ts, src/git.ts`. The diff touches neither.

The diff's full path list, against which the narrowing was computed: `doc/plans/phases/phase-37.md`, `doc/plans/phases/reports/phase-37-complete.md`, `doc/plans/phases/reports/phase-37-handoffs.md`, `src/daemon/poll.test.ts`, `src/daemon/poll.ts`.

## Probes

**No probe was run this pass, and none was authored.** The one criterion in scope is on the `live` channel, where authoring a probe is forbidden, and the derived regression set is empty, so there was nothing for the runner to run. There is consequently no break-step accounting and no clause-label comparison to report: both are properties of probes that ran.

**One thing a later pass needs to know.** Reading or running anything under the phase probe directory was refused in this session by an automatic check, with the message *"belongs to the stage that checks the build. Nothing that builds code may read it."* The refusal hit `ls`, the file-reading tool, and the runner command alike. It cost this pass nothing, because the regression set was empty and no probe was needed. It would have blocked a pass whose regression set was not empty, which is a fault in the check rather than in this phase — the guard cannot tell the stage that owns that directory from the stage that must not see it. It is recorded here so the next pass with a non-empty set recognises it immediately instead of rediscovering it. The directory's contents were established from `git ls-tree` path names alone: `_lib.mjs`, `prd-01.r2.mjs`, `prd-01.r3.mjs`, `prd-02.r22.mjs`, `run.mjs`.

## Fix-loop accounting

**0 of 2 loops consumed.** No FAIL and no REGRESSION was found, so no defect brief was issued and no fix context was spawned. A LIVE-GATE verdict consumes no loop by rule: it is not a failure to behave, it is a check this stage was never going to perform.

## Register changes

**None.**

- PRD-03.R1 stays `verified`. LIVE-GATE leaves the register untouched — it neither confirms nor withdraws the status, and only a live gate report may move a `Last live gate:` line.
- No other register line was in scope.

## Carried forward

Nothing is BLOCKED and nothing is `failed`, so no departures entry was written for this phase.

What remains outstanding is the live gate itself: **PRD-03.R1 owes a supervised run against real infrastructure before this phase can be delivered.** Under `process.md` stage 8 that is the one condition delivery still refuses on, and it routes to the human, because a live gate nobody has run is not evidence a pull request can open on.
