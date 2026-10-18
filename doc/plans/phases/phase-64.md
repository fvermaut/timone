# Phase 64: The verified-status check reads only what a note admits — "was never" about an old build is not a clause never seen to hold, and the advice offers only what clears the finding

> **Status:** Planned.

> **Companion phases:** none edits the same lines. The check was built outside a phase file, in [#131](https://github.com/fvermaut/timone/pull/131) (commit `860c332`, for timone#129), and has not changed since. [Phase 60](phase-60.md) wrote the PRD-07.R3 note this check misreads; [phase 63](phase-63.md) ran its suite with `src/daemon/register.test.ts` left out because of this fault (its departures record says so). Governing decisions: [ADR-0055](../../adr/0055-a-universal-claim-is-not-established-by-watching.md), because D2 is the rule the check enforces ("a criterion carrying a written record that one of its clauses was never observed is not `verified`") and D1 is the only rule a `Falsified-by:` line answers; [ADR-0027](../../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md), because a finding goes first to the session that caused it, so a false one costs that session a round.

> **Screens changed:** none — the change is in the text of a check that runs at the end of a session; no slice changes anything a person sees on a screen Timone draws.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R15 | SHOULD | Post-session guardrail hooks report real violations and, for a clean session, stay silent (clause 5: "GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent"). |

The check itself is defined by [ADR-0055](../../adr/0055-a-universal-claim-is-not-established-by-watching.md) D2 and D4, not by a criterion of its own. This phase claims clause 5 of PRD-02.R15 for this one false finding only. R15 stays `draft`: its own note lists what must be seen live before it can be `verified`, and this phase does not supply that.

## Goal Description

**What is wrong.** [timone#250](https://github.com/fvermaut/timone/issues/250): the check at the end of session 36a1b0c7 (2026-10-13) said "PRD-07 R3 is marked verified, and its own notes say a clause was never seen to hold. It says: `was never`." The words come from R3's note of 2026-10-13: "This check went red on the build from just before phase 60, where that ticket was never woken". That sentence describes the old build, where the check was made to fail on purpose; the same note says "all four clauses pass on this build". Two faults, both in the check:

1. **The match.** `ADMISSIONS` in `src/daemon/register.ts` holds `/\bwas never\b/i`, searched over the whole block. "was never" is not an admission; it is two common words. The other five patterns (`never triggered`, `never observed`, `never seen`, `not observed`, `owed a (direct )?sighting`) each say that something was not seen, which is what D2 forbids. The one place `was never` was quoted from when it was added (commit `860c332`) is PRD-01.R14's "the rule 'was never the load-bearing reason'", which says nothing about a clause going unobserved; R14 is `draft` today, so nothing in this repository depends on it being caught. The same fault makes `src/daemon/register.test.ts > this repository's own registers` fail on `main` today, which is why phase 63 had to leave that file out of its checks.
2. **The advice.** `checkRegisterClaims` in `src/daemon/hooks.ts` ends every finding with one shared line: "Either put the status back to `draft`, or name what would go red if it stopped holding in a `- **Falsified-by:**` line." For a D2 finding (`status-outruns-notes`) a `Falsified-by:` line clears nothing: `registerFaults` checks D2 first and never looks at that field for it. R3 already has such a line, and was still told to add one.

**What this phase builds.** `/\bwas never\b/i` is removed from `ADMISSIONS`; the other five stay as they are. Each `RegisterFault` carries its own `remedy`, written by `registerFaults`, and `checkRegisterClaims` prints each fault's remedy under it instead of the shared line. A D1 finding (`watched-only`) keeps today's advice, `draft` or a `Falsified-by:` line; it only fires when the block has no `Falsified-by:` line, so it never asks for one that is there. A D2 finding offers only what clears it: put the status back to `draft`, or, once that clause has been seen to hold, say so in the note in place of the words quoted. It never names `Falsified-by`.

**Decisions taken here that did not reach an ADR.** (1) **Remove `was never` rather than replace it with a longer list of verbs** ("was never exercised", "was never tested", …). The comment on `ADMISSIONS` says each pattern "is a phrase this repository's own registers used to record a hole"; none of those verbs appears in any register here (checked at planning time with `grep -iE "never (exercised|tested|checked|sighted|witnessed|watched)" doc/specs/prd/*.criteria.md`: no match), and "was never seen / observed / triggered" are already caught by the patterns that stay. (2) **No attempt to tell an old build from this one in the prose** (for example skipping a sentence that names "the build from before"). That would be a guess about how people write notes; the narrower list fixes the case seen without one. **Known limit, kept on purpose:** a note that says "on the old build, clause 2 was never observed" would still be flagged. That is a real admission phrase in a note that should then be reworded, and over-reporting is the safe side. (3) **The remedy lives on the fault, not in the hook.** `registerFaults` already knows which rule fired, so it writes the advice for that rule; the hook only lays it out. Each is a few lines, undone by an edit, so none passes the "hard to reverse" part of the test.

**Regression set and what no criterion watches.** The diff touches `src/daemon/register.ts`, `src/daemon/register.test.ts`, `src/daemon/hooks.ts` and `src/daemon/hooks.test.ts`. Derived from the register at planning time (MUST, `api`, `verified`, narrowed by `Depends-on`; a criterion with no `Depends-on` is always in): PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5; PRD-10.R2, R3, R4, R5, R6. Verification derives it again from the register as it stands then. The `live` criteria that are `verified` and name `src/daemon/` (PRD-02.R1, R2, R4, R8) name the whole folder; this diff changes the phrase list and the advice text of the register check, and none of them exercises that check, so no live gate is owed. **What no criterion watches:** that the check still fires on a real admission. No criterion in the set reads a register. The tests of 64a that must stay red-capable (a note saying a clause "was never triggered" or "was never observed" is still flagged, also when the block has a `Falsified-by:` line) are therefore a hard gate, and so is `this repository's own registers`, which turns green with this phase.

**No triage record.** The ticket was classified as a bug on the ticket itself (comment of 2026-10-18), and no file under `doc/triage/` was committed for it. The runner's instructions for this step restate the classification; this plan follows them.

## Context & Prerequisites

- **`src/daemon/register.ts`** — `ADMISSIONS` (lines ~72–86) with its doc comment; `RegisterFault` (lines ~90–98: `requirement`, `kind`, `detail`, `quoted`); `registerFaults` (lines ~156–195), which checks D2 over `block.body` first, then D1 only when `verifyVia === "live"` and `falsifiedBy === undefined`. `readRegister` and `firstMatch` do not change.
- **`src/daemon/register.test.ts`** — helper `block({...})` builds one block from parts (`note`, `falsifiedBy`, `gate`, `criteria`, …); `describe("a claim that outruns what established it")` holds the D1/D2 cases; `describe("this repository's own registers")` runs `registerFaults` over every `doc/specs/prd/*.criteria.md` and expects `[]`. It fails on `main` today with exactly one line: `prd-07-several-tickets-of-one-project-at-once.criteria.md R3 (status-outruns-notes)`.
- **`src/daemon/hooks.ts`** — `checkRegisterClaims` (line ~717). Its `detail` array is: an opening line, one line per fault (`- ${fault.detail} It says: \`${fault.quoted}\`.`), a blank line, and the shared advice line this phase removes. Only `register.ts` is imported for this (`registerFaults`).
- **`src/daemon/hooks.test.ts`** — `describe("a register that claims more than it established")` (line ~1413): helper `registered(source, touched = true)` and the fixture `UNIVERSAL` (a D1 case). New cases go in this block.
- **`doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md`** — the R3 block (heading `## R3 — A freed place goes to one ticket: …` down to, not including, `## R4`). Read only. It is the real case: its note holds "was never woken" and it has a `- **Falsified-by:**` line.
- **[ADR-0055](../../adr/0055-a-universal-claim-is-not-established-by-watching.md)** — read only. D2 is unchanged; this phase makes the check match its words more closely.
- **Known state** — `npx vitest run src/daemon/register.test.ts` on `main` (`ba699d2`): 10 pass, 1 fails (`this repository's own registers`). That failure is this ticket.

## Sub-phases

### Sub-phase 64a: The check stops reading "was never" as an admission, and each finding carries the advice that clears it

**[MODIFY]** `src/daemon/register.ts`:
- Remove `/\bwas never\b/i` from `ADMISSIONS`. Add one dated line to the doc comment above it: `✏ 2026-10-18 (timone#250): "was never" removed. It is two common words, not an admission: PRD-07.R3's note used it about the build before a fix ("where that ticket was never woken"), while saying every clause passes on this one. "was never seen", "observed" and "triggered" are still caught by the phrases above.` Keep the comment's other lines.
- Add `remedy: string` to `RegisterFault`, with a doc comment: what clears this finding, in the human's terms; it differs by rule, because a `Falsified-by:` line answers D1 and nothing in D2.
- In `registerFaults`, set `remedy` on both pushes:
  - `status-outruns-notes`: `` "Either put the status back to `draft`, or, once that clause has been seen to hold, say so in the note in place of the words quoted." `` — no mention of `Falsified-by`.
  - `watched-only`: `` "Either put the status back to `draft`, or name what would go red if it stopped holding in a `- **Falsified-by:**` line." `` (today's text; the rule only fires when the block has no such line).

**[MODIFY]** `src/daemon/hooks.ts` — in `checkRegisterClaims`, print each fault's remedy on the line under it (for example `  ${fault.remedy}`), and remove the blank line and the shared advice line at the end of `detail`. The opening line and the `summary` do not change.

**[MODIFY]** `src/daemon/register.test.ts` — one new `describe("an old build's words are not an admission (timone#250)")` block, and nothing else edited. The real R3 block goes in as a **frozen copy** in a constant (copied verbatim from the register on this branch at the time of the build), so a later edit of the register cannot remove the case.

**[MODIFY]** `src/daemon/hooks.test.ts` — new cases inside `describe("a register that claims more than it established")`; existing cases unedited.

**Seams under test (TDD):** `registerFaults(source)` is the first seam — pure, a register's text in, its faults out; it decides what counts as an admission and which advice belongs to which rule. `checkRegisterClaims(evidence)` is the second — pure over injected evidence, and it is the text the session is actually given. Red-green:

At `registerFaults`:
1. The frozen PRD-07.R3 block (MUST, `verified`, `api`, with its 2026-10-13 note and its `Falsified-by:` line) gives `[]`.
2. A `block({ note: "This check went red on the build from just before phase 60, where that ticket was never woken. All four clauses pass on this build." })` gives `[]`.
3. A `block({ note: "clause 3 was never seen to hold", falsifiedBy: "a test that goes red" })` still gives one fault of kind `status-outruns-notes`: a `Falsified-by:` line does not clear a D2 finding.
4. A `block({ gate: "2026-09-07 PASS — clause 2 was never triggered" })` still gives one `status-outruns-notes` fault, quoting `never triggered`.
5. The `status-outruns-notes` fault's `remedy` contains `` `draft` `` and does not contain `Falsified-by`.
6. A `watched-only` fault's `remedy` (the `UNIVERSAL`-shaped case: `criteria: "THEN at no point is the human told to run a command"`) contains `Falsified-by`.

At `checkRegisterClaims`:
7. A touched register whose only block is the frozen R3 block gives `[]` — a clean session stays silent (PRD-02.R15 clause 5).
8. A touched register with a D2 fault in a block that has a `- **Falsified-by:**` line gives one `register-claims` violation whose joined `detail` contains `draft` and does not contain `Falsified-by`.
9. The existing `UNIVERSAL` case's joined `detail` still contains `Falsified-by` (the D1 advice did not go away).

And unedited: `this repository's own registers` in `register.test.ts` passes.

Cases 1, 2, 5, 7, 8 and `this repository's own registers` must be seen to fail on the code before the change (5 fails because `remedy` is undefined). Cases 3, 4, 6 and 9 already pass before the change; they are guards that the fix does not stop the check firing, and must be seen to **pass** in the red run too. Record that red run in the handoff, naming each case and its result. A type error from `remedy` in the red run is expected; run the red step with vitest, which does not type-check.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone   # from the timone root

# Red first: the new tests, run against the check as it was. Expect cases
# 1, 2, 5, 7, 8 and "this repository's own registers" to fail, cases 3, 4,
# 6, 9 to pass, and a non-zero exit.
npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts ; echo "exit: $?"

# Green after the change. Expect every test in both files to pass, exit: 0.
# This includes "this repository's own registers", unedited: a hard gate.
npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts ; echo "exit: $?"
npx tsc --noEmit ; echo "exit: $?"            # expect exit: 0

# The check still fires on a real admission: the new block and the existing
# "flags an admission even on a channel no test could cover" both match.
# Expect every matched test passed, exit: 0.
npx vitest run src/daemon/register.test.ts -t "admission" ; echo "exit: $?"

# The whole suite, with nothing left out. register.test.ts is back in.
# Expect exit: 0.
npx vitest run ; echo "exit: $?"
```

- [ ] The red run is in the handoff, naming which cases failed and which passed before the change.
- [ ] `src/daemon/register.test.ts` and `src/daemon/hooks.test.ts` pass in full, with every existing test unedited.
- [ ] `this repository's own registers` passes without any change to a file under `doc/specs/prd/`.
- [ ] Printing `checkRegisterClaims` output for case 8 shows, under the finding, the D2 advice and no `Falsified-by`; for the `UNIVERSAL` case, the D1 advice with `Falsified-by`. Paste both into the handoff.
- [ ] `git diff --stat main` lists only `src/daemon/register.ts`, `src/daemon/register.test.ts`, `src/daemon/hooks.ts`, `src/daemon/hooks.test.ts`, and this phase's own files under `doc/plans/phases/`.

---

## Dependency graph

```
64a → (none)        the check stops reading "was never" as an admission, and each finding carries its own advice, with tests
```
