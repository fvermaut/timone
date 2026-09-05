# Phase 34 — Verification Report

- **Date:** 2026-09-05
- **Phase:** [phase-34.md](../phase-34.md) — stamped `Complete`, completion report [phase-34-complete.md](phase-34-complete.md)
- **Scope:** PRD-02.R22 — the phase header claims one clause of it, *"a ticket closed, or unmarked, while a run for it stands in the ledger is cancelled on the next poll, whatever state that run is in"*. The header calls it clause 7; the register lists eight clauses and it is the eighth. This report labels clauses by the register's order throughout, and the numbering difference is recorded under Probes.
- **Live gate owed:** **yes** — PRD-01.R4 and PRD-02.R1, R2, R4, R6, R7, R8 and R13. All eight are on the `live` channel and all eight declare `src/daemon/` among their dependencies; this phase's diff touches `src/daemon/poll.ts` and `src/daemon/poll.test.ts`. See Live gates.
- **Regression set (derived):** PRD-01.R2 and PRD-01.R3 before narrowing; **empty after narrowing**. See Regression.
- **Branch:** `timone/99-a-parked-run-whose-ticket-was-closed-kee` @ `c85844e8f42e7e2f4039ab6273f30dffe327b111`. No parent branch had to be merged in: the phase does not stack.

## Environment

Container, no Docker, no forge credential, no managed-project clones — so the app was driven as a terminal program against fixtures, which is what the `api` channel is.

```
npm run build          # tsc, clean
npm run type-check     # tsc --noEmit, clean
```

The daemon is stood up per poll cycle rather than left running: `timone daemon --once` runs a single cycle and returns, so nothing had to be backgrounded and nothing had to be killed. `--runtime in-process` was used because the container has no Docker; the container runtime is what a `live` gate would exercise, and its absence is part of why one is owed.

Every cycle in this pass ran against **a copy of the ledger passed with `--state`**, never a live state file, as PRD-02.R22's own verification hint requires. Four boundaries were cut so a cycle could run with no network and no credentials, all of them outside the code under test:

- the forge, at the `gh` command line — a shim earlier on `PATH` answers `gh` from a JSON fixture and records every call it receives;
- the GitHub App credential mint, at `fetch`;
- the session spawn, at the agent SDK module — replaced by a recorder, which is what lets clause 8's *"no session is spawned"* be asserted **on the spawn call** rather than on a missing log line;
- the timone root itself — a temporary git working copy declaring one fixture project, committed clean, because the daemon refuses to start a session from a root with uncommitted changes.

**Build-health smoke, run once and once only:** `npm test` — 40 files, 1619 tests, all passing. It is reported as a smoke and is not evidence for any criterion below. It does not contradict any probe result in this pass.

## Independence declaration

Read: `doc/specs/prd/prd-02-inversion-of-control.criteria.md` (R22 in full, and the priority/channel/status/`Depends-on`/`Last live gate` fields of every criterion in both registers, for the regression and live-gate computations), `doc/specs/prd/prd-01-process-layer.criteria.md` (the same fields), `doc/plans/phases/reports/phase-34-complete.md` whole, `README.md`, `CONTEXT.md`, `STATUS.md`, `package.json`, `timone.yaml`, `process.md` (stage 7), Timone's `standards/` listing, and this stage's own probe directory `doc/plans/phases/probes/` (`_lib.mjs`, `run.mjs`, `prd-01.r3.mjs`).

**Declared over-read, on the phase file.** The allowed list is the phase file's `Status` line and requirements header. Lines 1–40 were read in one go, which took in the *Goal Description* and *Context & Prerequisites* sections as well — they name the source files the fix touches and the shape of the change. Nothing from them was used to design a probe: every probe below is written from the register's clause wording, and the boundaries the probes cut (`gh`, `fetch`, the agent SDK) were found by running the built program and reading what it did, not by reading the phase file or the source. The over-read is recorded rather than left for a reader to infer.

Not read: `phase-34-handoffs.md` (none exists), any diff or `git show` of code, anything under `src/`, the committed test suite, any ADR, and any prior verification report — no HUMAN-CHECK was carried forward by the completion report, so the one section that would have been readable was not needed. The only thing taken from the diff is the **list of paths it touches**, which the scope and live-gate computations require: `doc/plans/phases/phase-34.md`, `doc/plans/phases/reports/phase-34-complete.md`, `src/daemon/poll.ts`, `src/daemon/poll.test.ts`.

No implementation source was read. All criterion evidence below comes from verifier-authored probes.

## Verdict summary

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-02.R22 — the clause this phase claims (register clause 8) | MUST | api | PASS | 0 |
| PRD-02.R22 — register clause 7, checked alongside it | MUST | api | PASS | 0 |
| PRD-02.R22 — register clause 2, checked alongside it | MUST | api | PASS | 0 |
| PRD-02.R22 — register clauses 1, 3, 4, 5, 6 | MUST | api | not driven this pass — see Probes | 0 |
| PRD-01.R2, PRD-01.R3 (standing set, narrowed out) | MUST | api | not re-run as regression; run anyway, both PASS | 0 |

**Nothing failed, nothing regressed, and no fix loop was needed.** The gate is nevertheless **not passed**, for one reason and one only: this phase owes a live gate that has not been run. That is set out under Live gates and under Handed to the human.

## Evidence

### PRD-02.R22, the clause this phase claims — PASS

Register clause 8, verbatim:

> GIVEN a ticket that has been closed, or had its mark removed, while a run for it stands in the ledger
> WHEN the daemon next polls the project
> THEN that run is cancelled with a reason and **no session is spawned for it**, asserted on the spawn itself rather than on the absence of a log line

Probe, as run:

```
node doc/plans/phases/probes/prd-02.r22.mjs
```

Its output for this clause, both legs of each label:

```
=== PRD-02.R22 clause 8a — a ticket closed while a run for it stands in the ledger — that run is cancelled with a reason
    break leg: RED (as required) — the run holding the project is still "parked" after the poll:
waiting not checking for dead runs — this state file is new to the daemon, so every run gets a full 2m00s to check in first
cta    fixture#7

    green leg: PASS — assertion held
=== PRD-02.R22 clause 8b — a ticket whose mark was removed while a run for it stands in the ledger — that run is cancelled with a reason
    break leg: RED (as required) — the run holding the project is still "parked" after the poll:
waiting not checking for dead runs — this state file is new to the daemon, so every run gets a full 2m00s to check in first
cta    fixture#7

    green leg: PASS — assertion held
=== PRD-02.R22 clause 8c — and no session is spawned for it, asserted on the spawn itself rather than on the absence of a log line
    break leg: RED (as required) — a session was spawned: 1 agent-SDK call(s) — first prompt: {"prompt":"A ticket was filed on the managed project **fixture** and marked for Timone.…"}
    green leg: PASS — assertion held
```

What each leg is:

- **8a.** The ledger holds one run for ticket #7, `parked`, holding its project by owning a branch, waiting on an answer. **Break:** the ticket is open and still marked — the run must be left alone, and the poll leaves it `parked`, so the assertion goes red. **Green:** the ticket is closed — the poll ends the run `cancelled`, carrying the reason *"its ticket is no longer open and marked for me"*.
- **8b.** Same ledger, the ticket open but with the `timone` mark taken off. Cancelled the same way, with the same reason. The clause names both ways a ticket can leave the listing and both are checked.
- **8c.** The recorder sits on the agent SDK, so the assertion is on the spawn call itself. **Break:** a marked ticket with nothing in the ledger — the daemon picks it up and starts a session, the recorder catches one SDK call, and *"no session is spawned"* goes red. That leg is also the transport proof: it shows the recorder is wired to the path a real spawn takes, so its silence on the green leg means something. **Green:** the closed ticket's parked run — zero SDK calls.

The state the phase is about is the `parked` one, and it is the state the fixture uses throughout: a run that owns a work branch and is waiting on a conversation. Two things had to be right in the fixture before the check meant anything, and both were found by driving the program: a parked run has to record **what it is waiting on**, and its ticket's newest comment has to be Timone's own question. A park missing either is read as answered and resumed on the next cycle — a different behaviour, and one that would have hidden this clause entirely. The probe carries both, and says so in its own comments.

### PRD-02.R22, register clause 7 — PASS

> GIVEN a run in any state the ledger admits — queued, parked, active or failed
> WHEN `timone cancel <project>#<ticket>` is run against it
> THEN the chunk ends `cancelled` carrying a reason, its project is released, and `.timone/state.json` needs no hand-edit for any of it

Checked because the clause this phase claims is about a cancel reaching every ledger state, and this clause is where the register names those states. All four run once each:

```
=== PRD-02.R22 clause 7 (queued) …    break leg: RED — no run fixture#9/1 in the ledger:
I'm not working on fixture #9, so there is nothing to cancel.
    green leg: PASS — assertion held
=== PRD-02.R22 clause 7 (parked) …    break leg: RED …   green leg: PASS
=== PRD-02.R22 clause 7 (active) …    break leg: RED …   green leg: PASS
=== PRD-02.R22 clause 7 (failed) …    break leg: RED …   green leg: PASS
=== PRD-02.R22 clause 7 (release) — its project is released, and `.timone/state.json` needs no hand-edit for any of it
    break leg: RED (as required) — the project was not released: the run queued behind the cancelled one is still queued
    green leg: PASS — assertion held
```

The reason given on the command line is read back out of the ledger, so *"carrying a reason"* is checked against the words the operator typed, not against the presence of a field. The release leg puts a second run in the queue behind the occupier: without the cancel it stays `queued`, and after the cancel the next poll moves it on. No hand-edit: the ledger file is written by the command, and the probe asserts the file changed under the command alone.

### PRD-02.R22, register clause 2 — PASS

> GIVEN a ticket whose current chunk is `failed`
> WHEN the daemon polls the project on that cycle and on every later one
> THEN **no further chunk is opened** — the ledger still names the failed chunk as the ticket's current one — and `timone retry <project>#<ticket>` re-arms that same chunk in place, at the stage it died, keeping its branch and its sequence number

```
=== PRD-02.R22 clause 2a — a ticket whose current chunk is `failed` — no further chunk is opened, …
    break leg: RED (as required) — a further chunk was opened: fixture#9/1=done, fixture#9/2=failed
    green leg: PASS — assertion held
=== PRD-02.R22 clause 2b — `timone retry <project>#<ticket>` re-arms that same chunk in place, …
    break leg: RED (as required) — the chunk was not re-armed: still "done"
fixture #9 is finished. Retry can't reopen it — file a new ticket instead.
    green leg: PASS — assertion held
```

Clause 2a's green leg polls twice — *"on that cycle and on every later one"* — with the ticket open and marked throughout. Its break leg settles the chunk `done` instead of `failed`, which does open a successor, so the assertion has a real way to fail. Clause 2b reads the re-armed chunk back: same id, sequence still 1, branch unchanged, stage still the one it died at.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` or `browser` channel, and the completion report carried no HUMAN-CHECK forward. This section is stated rather than omitted.

## Live gates

No criterion in the claimed set or the regression set is on the `live` channel. **A gate is owed anyway**, and this is the section that says so: a phase owes a fresh live gate when its diff touches what a `live` criterion declares it depends on, and this diff touches `src/daemon/poll.ts` and `src/daemon/poll.test.ts` — the daemon's registration cycle, which is the code that picks tickets up.

Eight `live` criteria declare `src/daemon/` among their dependencies:

| ID | Its `Last live gate:` | Fresh gate owed by this phase |
| --- | --- | --- |
| PRD-02.R1 — Ticket pickup | [phase-32-live-gate.md](phase-32-live-gate.md), 2026-09-04, marked-ticket clause only; the unmarked clause last seen at [phase-20-live-gate.md](phase-20-live-gate.md) | yes |
| PRD-02.R2 — Daemon-spawned sessions resolve a target project | never | yes |
| PRD-02.R4 — PRD gate on the ticket | never | yes |
| PRD-02.R6 — Autonomous execution with verification | never | yes |
| PRD-02.R7 — Pull request delivery | never | yes |
| PRD-02.R8 — Docker preview per pull request | never | yes |
| PRD-02.R13 — Harness-owned routing | [phase-32-live-gate.md](phase-32-live-gate.md), 2026-09-04 | yes |
| PRD-01.R4 — Skills reach project sessions, never project repos | never | yes |

PRD-02.R1 is the one that matters most here, and it is not a technicality: the changed code is the registration cycle, and *"the daemon picks up a marked ticket"* is what that cycle does. R1's own last gate covered the marked-ticket clause and explicitly did **not** cover the unmarked one — which is half of the very clause this phase claims.

This pass performs none of them, writes no script for them, and flips none of their statuses. That is the `live` channel's rule.

## Regression

The derived standing set at this HEAD — priority MUST, verify-via `api`, status `verified` — is **PRD-01.R2** and **PRD-01.R3**. Nothing from PRD-02 qualifies: every MUST criterion in that register is `draft`, `revised` or `failed` at this HEAD, so none of them is a regression candidate.

**What the narrowing removed, in full:**

- **PRD-01.R2 — Project manifest.** Dropped. `Depends-on: src/manifest.ts, src/commands/projects.ts`; this diff touches neither.
- **PRD-01.R3 — Workspace sync.** Dropped. `Depends-on: src/commands/workspace.ts, src/git.ts`; this diff touches neither.

**So the narrowed regression set is empty.** The runner was run anyway, because an empty set is a claim worth testing and both probes exist:

```
node doc/plans/phases/probes/run.mjs --regression

| ID         | Verdict   | Criterion
|------------|-----------|----------
| PRD-01.R2 | PASS      | R2 — Project manifest
| PRD-01.R3 | PASS      | R3 — Workspace sync

2 passing, 0 failing, 0 with no probe.
```

Both pass. Neither counts as regression evidence for this phase, because the narrowing removed both; they are reported so the removal can be argued with rather than taken on trust.

## Probes

**10 probes proven able to fail, 0 not.** Every clause label printed by `prd-02.r22.mjs` carries a break step, and every break step went red in this run, on this build, before its green leg was allowed to count.

| Probe | Criterion | Authored or run | Break step |
| --- | --- | --- | --- |
| `prd-02.r22.mjs` | PRD-02.R22 | **Authored this pass** — first check of the criterion, so there was nothing to run | 10 labels, all red then green |
| `prd-01.r2.mjs` | PRD-01.R2 | Run from the directory (narrowed out; run for completeness) | 5 labels, all red then green |
| `prd-01.r3.mjs` | PRD-01.R3 | Run from the directory (narrowed out; run for completeness) | 4 labels, all red then green |

All three live in `doc/plans/phases/probes/`.

**Clause coverage — the gap, stated plainly.** PRD-02.R22 carries **eight** clauses. The probe prints **ten labels covering three of them** (clause 8 as 8a/8b/8c, clause 7 as five labels, clause 2 as 2a/2b). **Five clauses are printed as `NOT DRIVEN`**, each with the reason, so the gap is a visible line in the output and not a silent omission:

- **clause 1** — the frontier rule. Needs an initiative whose step tickets carry GitHub's own `blocked by` relation and the hold label.
- **clause 3** — the breakdown and its single approval. Needs a model-driven planning session actually writing the breakdown file.
- **clause 4** — no gate between the breakdown's approval and the chunk's pull request. Needs a chunk built end to end.
- **clause 5** — a merged pull request closing its step ticket. Needs a real pull request on a real forge.
- **clause 6** — a queued ticket starting between two chunks. Needs the initiative and its breakdown, as clause 3 does.

None of the five is in this phase's claim. All five were built in earlier phases (22, 23, 29) and none has ever had a verifier's verdict written on it. They are recorded here because R22's status is the weakest of its clauses' outcomes, and three clauses' worth of evidence does not settle an eight-clause requirement.

**A note for the register's owner, not a defect of this phase.** R22 is declared `Verify-via: api`, and clauses 3, 4 and 5 cannot be reached from a terminal: they need a model-driven session, a real forge and a merged pull request. On the register's own definitions that is the `live` channel. Changing a criterion's channel is an intent amendment and belongs to the requirement's owner, so nothing here changes it.

**On the clause numbering.** The phase file and the completion report both call the clause this phase built *"clause 7"*. The register lists eight clauses and it is the eighth; the register's seventh is `timone cancel`. The wording each document quotes is unambiguous, so this is a numbering slip and not a scope disagreement — both name the same behaviour. It is recorded rather than corrected, because the phase file is a stage-5 artifact.

## Fix-loop accounting

**0 of 2 loops consumed — the initial pass was clean.** No FAIL and no REGRESSION was observed, so no defect brief was written and no fix context was spawned.

## Register changes

**PRD-02.R22 stays `draft`.** A dated partial-evidence marker was added to it, naming this report and listing which clauses now carry verifier evidence and which do not. No `Status` field moved in either register this pass.

The status does not move to `verified` because a requirement's status is the weakest of its clauses' outcomes: five of R22's eight clauses have no verifier evidence at all. It does not move to `failed` because nothing was observed failing.

## Handed to the human

**One thing is owed, and only a person can do it: a watched run of the daemon against real infrastructure.**

The behaviour this phase built is checked and holds — a run left parked, holding its project, is now ended when its ticket is closed or unmarked, with a reason, and nothing is started for it. It is checked in the state the bug was seen in, by a reader who did not build it, and every check was proven able to fail before it was allowed to pass.

What is not checked is the thing that can only be watched. The change is in the daemon's ticket-pickup loop, and eight of Timone's promises say plainly that they rest on that code. Seven of the eight have never been watched running at all; the eighth was watched on 4 September for the *marked* half of its clause and explicitly not for the *unmarked* half — which is half of what this phase changed. A container with no Docker, no forge credential and no copy of the managed projects cannot watch any of them, and this pass did not pretend to.

So the phase is finished, correct as far as a terminal can tell, and **owes one watched run before it is delivered**. There is nothing here for a fix context to fix and nothing to route to triage.

## Addendum — 2026-09-05: the watched run is waived for this delivery

**Written by a takeover session, not by the verifier.** The pass above ended saying this phase owes one watched run before it is delivered. fvermaut read that on [ticket #99](https://github.com/fvermaut/timone/issues/99) and answered at 2026-09-05T13:15:46Z: *"go ahead without it"*. The stage that was running may not act on such an answer — it only checks work and writes down what it finds — so the run stopped, and fvermaut opened a takeover session (`timone takeover timone#99`, session `31307100-f5ce-462d-9536-849cc9879a6a`). This addendum is that session's record, owed by [ADR-0033](../../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) D5 and bounded by [ADR-0035](../../../adr/0035-a-resolved-escalation-hands-the-run-back.md) D1.

**What is decided.** The pull request for phase 34 is opened without the watched run. The decision is fvermaut's, in his own words on the ticket, and this note is the committed form of it.

**What the waiver covers, and what it does not:**

- It covers this delivery only: the pull request may be opened while the live gate this phase owes is unrun.
- It changes no register line. The eight `live` criteria named under Live gates keep their `Last live gate:` values — seven still say `never` — and PRD-02.R22 stays `draft`.
- The debt stands. The next phase whose diff touches `src/daemon/` owes a live gate under the same rule, and one watched run can pay several of these lines at once.
- The pull request must say plainly what was not watched and that **merging is fvermaut's acceptance of the skipped run** — the same wording the pull request for #39 carried ([PR #89](https://github.com/fvermaut/timone/pull/89)).

**Departures from defaults, named:**

1. This file is a stage-7 artifact and only stage 7 writes it. The takeover session wrote this addendum anyway, because this report is where delivery reads the verification outcome, and the waiver belongs next to the sentence it answers. It is the record of a human decision, not verifier evidence; no verdict above changes, and the report's account of what was and was not checked stands word for word.
2. The stopped stage's own closing said the way forward was a watched run on fvermaut's machine, or his choice carried into the pull request. The second is what happens; the first remains open to him at any time before merging.

**What the takeover session did, in full:** read this report, the stage-7 and stage-8 rules in `process.md`, ADR-0033, ADR-0035, and PR #89's record of the same choice; wrote this addendum; committed and pushed it on the phase's branch; handed the run back to delivery on the ticket. It wrote no application code, changed no register, and opened no pull request.
