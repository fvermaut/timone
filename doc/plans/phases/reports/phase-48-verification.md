# Phase 48 — Verification Report

- **Date:** 2026-10-04
- **Phase:** [phase-48.md](../phase-48.md) — stamped `Complete`, completion report [phase-48-complete.md](phase-48-complete.md)
- **Scope:** PRD-07.R8 clauses 2 and 3 (claimed). Clause 1 was delivered by phase 44; its probe labels were run again in the same file.
- **Live gate owed:** yes — see *Live gates*. The criteria the completion report names, PRD-02.R1, R2, R4 and R8, are among them.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-06.R5; PRD-07.R9; PRD-08.R5.
- **Branch:** `timone/200-2-status-md-and-the-requirement-register` @ `2a2b4db`. The branch was level with `origin/main` (`git log HEAD..origin/main` empty), so nothing was merged in first. The phase's diff is taken from the merge-base `bd05360`.

## Environment

This phase has no server and no screen. "The app" is the built command line, `dist/cli.js`, and the script the built daemon hands docker for a step.

Order: `npm run build` (the completion report: some checks run `dist/cli.js`); the regression probes, real runs only, in parallel (`PROBE_REAL_ONLY=1 node doc/plans/phases/probes/<id>.mjs`, 238 s); PRD-06.R5's named test; `prd-07.r8.mjs` on its own, break run then real run (151 s); the same probe twice more, real run only, after two print-only additions (the merged text, and the open case below); then the build-health smoke.

The box. There is no docker here. The probe uses the verifier's own instrument (`_steps.mjs`): the built daemon, in container mode, hands its step script to a stand-in `docker` that records it. That script is then run for real outside a container. It clones Timone at the commit under test, runs `npm ci` and the build, installs the guards, exports its git settings, and starts a stand-in agent that runs the probe's git commands in the project clone. Only two paths are moved into a scratch folder. The project remote is a local bare repository. Nothing reached GitHub. What this cannot show is the git of the real image: the git here is 2.43.0.

- **Build-health smoke**, run once at the end and not as evidence: `npm run build && npx vitest run` — 66 test files, 1761 tests passed, 3.56 s. `npx tsc --noEmit` exit 0. **Smoke failures:** none. No failing test, so nothing to mark old or new. The report on `main` it would have been compared with is `doc/plans/phases/reports/phase-47-verification.md`, whose smoke also passed whole (its line 17, read with `git show origin/main:…`).
- No contradiction between the smoke and any probe.

## Independence declaration

Read: `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (whole); the R11 block of the PRD-05 register and the R5 block of the PRD-06 register; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register, by script, to derive the regression set and the live gates; `doc/plans/phases/phase-48.md` lines 1–18, which hold the status line, the companion-phases line (it names files and ADRs), the `Screens changed` line and the requirements table, plus line 23, one paragraph of its Goal Description, which a search printed — nothing below rests on it; `doc/plans/phases/reports/phase-48-complete.md`, whole; `STATUS.md` (the first 40 lines at `bd05360`, which the probe also uses as its starting text, and item 1h on this branch); the probe directory `doc/plans/phases/probes/`. The names of the files the phase changed (`git diff --name-only bd05360 HEAD`) and the subjects of its commits (`git log --oneline`).

**Read beyond the rule, declared:** in `phase-47-verification.md` on `main` I meant to read only the smoke list (line 17). Two searches also printed its section headings, line 22 (its independence declaration) and the lines naming PRD-05.R2, R7 and R18 (lines 7, 16, 36, 40, 43, 199, 203, 206, 234, 263). They say that the same three checks were BLOCKED there for the same reasons. No verdict below rests on them: each comes from this pass's own probe output.

Not read: handoffs, diffs, source, the committed test suite, ADRs, the departures file, the breakdown for #197, the PRD-07 narrative, `README.md`, `CONTEXT.md`. There is no `doc/standards.md`. The runner's instructions for this step named ADR-0064, the plan, the breakdown and the departures file as things to check against. Those are build knowledge, and this check may not read them. The register was the only measure. No implementation source was read. All criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass. The one exception is PRD-06.R5, accepted on a named builder test by fvermaut's decision, recorded on its block.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R8 | MUST | api | PASS — clauses 1, 2 and 3. Status held at `draft`: one case of clause 3 is a question for the person (below) | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED — GitHub cannot be read from here) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; its real-runner clause BLOCKED — needs the replay) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** — the replay needs a Claude login; this container has none | — |
| PRD-06.R5 | MUST | api | PASS (regression; on the builder's named test, by fvermaut's recorded decision) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |

## Evidence

### PRD-07.R8 — PASS (status held at `draft`)

Probe: [`prd-07.r8.mjs`](../probes/prd-07.r8.mjs), clauses 2 and 3 written this pass from the register alone. Command: `node doc/plans/phases/probes/prd-07.r8.mjs` (break run, then real run), then twice more with `PROBE_REAL_ONLY=1` after print-only changes.

**The fixture.** Two pull requests, A and B, start from this repository's own `STATUS.md` and PRD-07 register as they stood at `bd05360`, before phase 48. They change both files the way runs do. In `STATUS.md`, both move the `**Last updated:**` date, both add an item "1h" at the same place, and both rewrite the same line (item 1). In the register, both write a dated note under R2, both set R2's one `Status` (A `verified`, B `failed`), both rewrite R2's hint line, and A adds R15 while B adds R16 at the end. A lands on the default branch: (a) squashed, dates A 10-05 and B 10-06; or (b) by a merge commit, dates A 10-07 and B 10-06. Then, in the box, B's branch is brought level: `git fetch`, then `git merge --no-edit origin/main`, as a merge brings a branch level. The break leg runs the same in the box script and Timone checkout of `bd05360`.

**Clause 1** — the four labels (a)–(d) from phase 44's pass ran again, break run then real run:

```
=== PRD-07.R8 clause 1 (a) — … six clones ask at the same moment
    break leg: RED (as required) — at the same moment (phase): two sessions took the same phase number: 8, 8, 8, 8, 8, 8
    green leg: PASS — assertion held
=== PRD-07.R8 clause 1 (b) — … never take the same number          break: RED; green: PASS
=== PRD-07.R8 clause 1 (c) — inside a run, with the run's guard …   break: RED; green: PASS
=== PRD-07.R8 clause 1 (d) — the instructions …                      break: RED; green: PASS
```

**Clause 2 — `STATUS.md`.** PASS on both variants.

```
=== PRD-07.R8 clause 2 (a) — two open pull requests that both changed `STATUS.md`; one merges squashed; the update on the other completes without a person, and `STATUS.md` on the branch keeps what both said
    break leg: RED (as required) — variant (a): the merge stopped for a person: Auto-merging STATUS.md CONFLICT (content): Merge conflict in STATUS.md … CONFLICT (content): Merge conflict in doc/specs/prd/prd-07-….criteria.md Automatic merge failed
    green leg: PASS — assertion held
    (a) STATUS.md: 443 lines; Last updated lines: ["**Last updated:** 2026-10-06."]
    (a) STATUS.md where both added an item:
      | **1h. A: probe item written by pull request A.**
      | **What I need from you:** A-probe answer.
      | **1h. B: probe item written by pull request B.**
      | **What I need from you:** B-probe answer.
    (a) STATUS.md item 1, which both rewrote:
      | **1. Restart the daemon (A rewrote this line)** so it runs the merged code of #189. …
      | **1. Restart the daemon (B rewrote this line)** so it runs the merged code of #189. …
=== PRD-07.R8 clause 2 (b) — the same when the pull request merges as a merge commit, and the default branch carries the later date
    break leg: RED (as required) — variant (b): the merge stopped for a person: … CONFLICT (content): Merge conflict in STATUS.md …
    green leg: PASS — assertion held
    (b) STATUS.md: 443 lines; Last updated lines: ["**Last updated:** 2026-10-07."]
```

What was checked: the merge exits 0, no file is unmerged, there are no conflict markers, and every non-blank line either side added is in the result. The one exception is the `**Last updated:**` line: one line is left, carrying the later date, in both orders. In (a) the merged branch was pushed to its own work branch on the remote, and that branch holds both items. The remote's `main` did not move. After both merges the clone had no `.gitattributes`, no untracked file and no merge setting in its own git config. Nothing was written into the project.

**Clause 3 — the register.** PASS on both variants.

```
=== PRD-07.R8 clause 3 (a) — two open pull requests that both changed the same requirement register; one merges squashed; the update on the other completes without a person, and no line either one wrote is lost
    break leg: RED (as required) — variant (a): the merge stopped for a person: … CONFLICT (content): Merge conflict in doc/specs/prd/prd-07-….criteria.md …
    green leg: PASS — assertion held
    (a) R2 Status lines: ["- **Status:** verified"]
    (a) R2 block as merged, head:
      | ## R2 — Each project has a number of places, 2 unless `timone.yaml` says otherwise
      | > ✏ 2026-10-04 — partial evidence: clauses 3 to 6 passed in [phase-47-verification.md] …
      | > ✏ 2026-10-05 — A: probe note under R2.
      | > ✏ 2026-10-06 — B: probe note under R2.
      | > ✏ 2026-10-04 — when this branch was brought level with the default branch, it had `- **Status:** failed`. The default branch's `- **Status:** verified` stands.
      | > ✏ 2026-10-04 — when this branch was brought level with the default branch, it had `- **Verification hint:** test it on the run store with fake steps. (B rewrote this hint.) …` … stands.
      | - **Priority:** MUST
      | - **Status:** verified
    (a) headings: "## R1 … ## R14 ## R15 ## R16"
=== PRD-07.R8 clause 3 (b) — the same when the pull request merges as a merge commit
    break leg: RED (as required); green leg: PASS — same shape, A's note dated 2026-10-07
```

What was checked: the merge exits 0, no file is unmerged, there are no conflict markers, and every non-blank line either side added is in the result. Each side's `Status` value is still in R2's block: one field line keeps the default branch's value, and the branch's value is kept in a dated note. Both rewritten hint lines survive: one as the field, one in full inside a note. Both new requirements are there.

**The open case, observed and not judged.** Both pull requests add a new requirement with the same number (R15) to the same register. The same box run printed:

```
=== PRD-07.R8 clause 3, open case — both pull requests add a new requirement with the same number (R15)
    observed, not judged: doc/specs/prd/prd-07-….criteria.md: R15 is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose. … CONFLICT (content): Merge conflict in doc/specs/prd/prd-07-….criteria.md …
```

Clause 3 says the update completes "without a person resolving the register", and this case needs one. The register's own header says "Requirement IDs are stable — never renumber". Read together, the register does not decide this case: either rule can win. The completion report says the build stops here on purpose. This is the first entry in *Questions for the human*. Because a known case of clause 3 still needs a person, the status stays `draft` (a status may not outrun what the block records). No fix loop was spent: a fix context cannot choose between two rules of the register.

### PRD-05.R2, R3, R4, R5, R7, R10, R11; PRD-07.R9; PRD-08.R5 — PASS (regression)

Each probe was run from the directory, real run only, `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/<id>.mjs`:

```
--- PRD-05.R2: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
--- PRD-05.R3: PASS (19 clause labels, 19 passing, real run only)
--- PRD-05.R4: PASS (6 clause labels, 6 passing, real run only)
--- PRD-05.R5: PASS (6 clause labels, 6 passing, real run only)
--- PRD-05.R7: PASS (4 clause labels, 3 passing, 1 blocked, real run only)
--- PRD-05.R10: PASS (4 clause labels, 4 passing, real run only)
--- PRD-05.R11: PASS (12 clause labels, 12 passing, real run only)
--- PRD-07.R9: PASS (4 clause labels, 4 passing, real run only)
--- PRD-08.R5: PASS (1 clause labels, 1 passing, real run only)
```

PRD-05.R3's box labels matter most here, because this phase changed the box's git environment line. They ran the daemon's box script for real and passed: "in a box, the agent's push to main is refused, also when the project's own git config sets core.hooksPath; its own work branch still takes the push", and "a box whose push guard cannot be installed stops before the agent starts". The push guard still works next to the merge rule.

Blocked labels: PRD-05.R2 clause 2b — "GitHub could not be read from here (gh)". PRD-05.R7 clause 1 (runner) — "needs a real model: replay case scratch-app#37 is its instrument, and the newest recorded replay is older than this build".

### PRD-05.R18 — BLOCKED

```
=== PRD-05.R18 clause 1 … BLOCKED — the recorded replay judged here is older than this build: run 10's commit 4686ef4 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal).
=== PRD-05.R18 clause 2a … BLOCKED — the newest recorded replay is older than this build …
=== PRD-05.R18 clause 2b … BLOCKED — no replay on this build is recorded yet …
--- PRD-05.R18: BLOCKED (3 clause labels, 0 passing, 3 blocked, real run only)
```

The replay needs a Claude login. This container has none: no `~/.claude/.credentials.json`, no token in the environment. Register untouched.

### PRD-06.R5 — PASS (regression)

No probe exists. On 2026-10-03, fvermaut decided this criterion is accepted on the builder's test that its `Falsified-by` line names (recorded on its block). Run by name, the test passes; it was not read:

```
npx vitest run src/daemon/container-runtime.test.ts src/adapters/credentials.test.ts -t "a box is never handed a token that dies before its next refresh"
 ✓ src/daemon/container-runtime.test.ts (107 tests | 106 skipped)
      Tests  1 passed | 116 skipped (117)
```

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and the completion report carries none forward.

## Live gates

No criterion in scope is on the `live` channel. This phase's diff touches what these `live` criteria declare they depend on (`src/daemon/`, `src/commands/`, `src/commands/guardrails.ts`, `process.md`), so it owes them a fresh gate:

- PRD-02.R1 — last gate [phase-32-live-gate.md](phase-32-live-gate.md) (marked-ticket clause only). Owed.
- PRD-02.R2, R4, R8 — never. Owed.
- PRD-02.R6, R7 (`revised`), R13; PRD-01.R4; PRD-03.R1, R2, R4, R5; PRD-07.R5, R7, R14 — owed by the same prefix (`src/daemon/` or `src/commands/`). R13, PRD-03.R1 and R5 last saw a gate in phase 32 or 35; the rest never.
- PRD-06.R1–R4 — never; they depend on `process.md`, which this phase changed by one paragraph.
- With no `Depends-on` line, so counted as owed: PRD-04.R1, PRD-05.R9, R12, R13, R15, PRD-08.R6.

The one that matters for this phase is the watched run that the completion report also names. In the real image, with its own git, a branch brought level with `main` does not stop on `STATUS.md` or a register, and the push guard still works with the four git settings. This check ran the same box script outside a container, with git 2.43.0. Delivery carries the gate onto the pull request as an item to tick.

## Regression

- PRD-05.R2 — PASS (clause 2b BLOCKED).
- PRD-05.R3 — PASS.
- PRD-05.R4 — PASS.
- PRD-05.R5 — PASS.
- PRD-05.R7 — PASS (its real-runner clause BLOCKED).
- PRD-05.R10 — PASS.
- PRD-05.R11 — PASS.
- PRD-05.R18 — **BLOCKED**: the replay needs a Claude login. Not a regression: nothing was observed.
- PRD-06.R5 — PASS (`Depends-on` `src/daemon/container-runtime.ts`, which this phase changed).
- PRD-07.R9 — PASS (`Depends-on` `src/daemon/`).
- PRD-08.R5 — PASS.

PRD-05's eight and PRD-08.R5 have no `Depends-on` line, so they are always in scope.

Narrowed out — the phase's diff touches none of the prefixes:

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-07.R1 — `src/daemon/runs.ts, src/runner/`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R10 — `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

## Probes

**11 probes proven able to fail, 0 not.** PRD-06.R5 has no probe (see above).

- `prd-07.r8.mjs` — run from the directory and extended this pass. Clauses 2 and 3 were written this pass, because this is the first check of those clauses: four new labels, 2 (a), 2 (b), 3 (a), 3 (b). The two `blocked(…)` lines phase 44 left for them were removed. Break run: all eight labels went RED on the build before phase 48 (`bd05360`), or on the older build for clause 1; then GREEN. The open case prints an observation and is not a verdict.
- Ran without a break run this pass (real run only, proved able to fail by an earlier pass): PRD-05.R2, PRD-05.R3, PRD-05.R4, PRD-05.R5, PRD-05.R7, PRD-05.R10, PRD-05.R11, PRD-05.R18, PRD-07.R9, PRD-08.R5.
- Clause coverage: the register's clause count matches the clause numbers each probe printed, for all eleven. PRD-07.R8 had a gap of two clauses (2 and 3), closed this pass.
- `run.mjs` was not changed: it already does real runs only.

## Fix-loop accounting

0 of 2 — no FAIL and no REGRESSION was observed.

## Figures on the preview's data

No screen changed in this phase (`Screens changed: none`).

## Questions for the human

1. **When two pull requests both add a new requirement with the same number to the same requirement register, should bringing the second one level need a person?** Today it does. The merge stops on the register and says "R15 is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose." Every other change tried was merged with no person and no line lost. The requirement says the update "completes without a person resolving the register" (PRD-07.R8 clause 3). The register also says "Requirement IDs are stable — never renumber". The two cannot both hold in this one case, so this check cannot decide it. A useful answer is one of: "yes, this case may need a person" (the requirement's words are then changed and it can be marked checked); "no, renumber the branch's new requirement"; or "no, reserve requirement numbers the way phase-file numbers are reserved". The requirement stays unconfirmed until then. The build's own open question 1, on two requirements with the same number that git merges without any conflict, is about the same subject.

## Register changes

- PRD-07.R8: `Status` stays `draft`. A dated partial-evidence marker was added: clauses 1, 2 and 3 pass here, and the same-number case is open (question 1).
- No other change. PRD-05.R18 is BLOCKED, so its register line is untouched.

## Carried forward

- **PRD-05.R18 — BLOCKED**, and the real-runner clause of PRD-05.R7: the replay (`npm run --silent replay`) needs a Claude login, which this container has none of. A person runs it from a logged-in terminal on this branch before merging.
- **PRD-05.R2 clause 2b — BLOCKED**: GitHub could not be read from here.
- Both are recorded in [`phase-48-departures.md`](phase-48-departures.md).
