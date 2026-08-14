# Phase 21: the guardrail round, watched

> **Status:** Awaiting approval.

> **Tenth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md), and the first that builds almost nothing.** Governing decision: **[ADR-0027](../../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md)** (a guardrail finding is addressed to the session that caused it, and never to a client's ticket), made by fvermaut on 2026-08-14 from two questions with three options each. Standing: [ADR-0007](../../adr/0007-sessions-at-timone-root.md), [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md), [ADR-0020](../../adr/0020-liveness-is-judged-only-over-witnessed-time.md).

## Why this phase exists, and why it is next

**The machinery already exists and was built outside a phase.** On 2026-08-14, findings 1 and 11 of [phase 20's live gate](reports/phase-20-live-gate.md) were shown to share one cause, fvermaut ruled on both, and the build landed interactively at `f44a52a` (the prompt and the branch-placement rule) and `70bce0a` (the round itself). **That is a deviation and it is recorded here rather than left to be noticed**: a Timone-self change of this size normally gets a plan and an approval before a line of it is written, and this one got neither. What it did get is 818 green tests and a type-check — which is exactly the evidence [phase 14](phase-14.md) established is not sufficient, six defects ago.

So this phase is the half that is missing: **the world.** `PRD-02` R15 sits at `draft` because [its second criterion](../../specs/prd/prd-02-inversion-of-control.criteria.md#r15--post-session-guardrail-hooks) asserted a ticket comment that no longer happens. Nothing about the new behaviour has been observed anywhere but in a test.

**And one step below is not a check — it is a question with the evidence in front of it.** See 21a step 2.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) | This phase |
| --- | --- | --- | --- |
| PRD-02.R15 | SHOULD | Post-session guardrail hooks | **closes**, all four criteria, if 21a's human gate is obtained |

Deliberately **not** this phase: **[ADR-0026](../../adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)'s chunking**, which is the larger next thing and has four open questions of its own; the **attribution defect itself** — an uncommitted change still carries no trailer and the rule can still name the wrong session, which ADR-0027 changes the *audience* of and not the *accuracy* of; the frozen output-token counter; `timone status` understanding "blocked by".

## Goal Description

Every claim ADR-0027 makes is watched happening, on the fixture, including the two it costs.

**Load-bearing, so the gate does not drift into checking something easier:**

- **Silence has to be shown meaning something.** A first sighting produces *nothing anywhere* — no flag, no print, no journal line, no comment. That is indistinguishable from a rule that has stopped working, so **every step that asserts silence must be paired with the round that breaks it.** [Phase 15](phase-15.md)'s gate established this exact discipline and it is not to be relaxed.
- **The ticket is checked, not assumed.** "Nothing is posted on a client's ticket" is verified by reading the ticket thread, on a run that produced a finding. A passing test proves the call was deleted; only the thread proves nothing else posts.
- **Everything runs on `scratch-app`.** No step touches `ivtrends`, whatever it would cost to manufacture the fixture. This has been ruled on twice.

## Context & Prerequisites

- **`main` is the working branch**, as for phases 15–20. `main` is at `70bce0a`.
- **The daemon must be restarted before the gate**, and this has now bitten three times in one day: a running daemon keeps the code it started with, so a gate driven against a daemon started before `70bce0a` measures the old behaviour. **Confirm the restart before step 1, not after a confusing result.**
- **818 tests green at `70bce0a`**, type-check clean, `dist/` built.
- **The ledger must be clear of residue before starting.** [Phase 20's gate](reports/phase-20-live-gate.md) findings 8 and 9 are unfixed: a queued run promotes onto a closed ticket, and there is no way to end a run. Fixture runs from this gate will leave the same residue, and clearing it still means hand-editing `state.json`.

## Sub-phases

### 21a — The live gate: the round, and the two things it costs

**[NO CODE.]** Every step on `scratch-app`.

1. **The round, on a session the daemon drove.** Mark a throwaway ticket and let a stage run that commits without pushing. Expect, at the first `Stop`: the finding **handed to the session**, and the ledger carrying **no flag**, the terminal **no print**, the journal **no line**, the ticket **no comment**. Then whichever way the session goes — it pushes and the run stays clean, or it does not and the next `Stop` flags the run. **Both outcomes are acceptable; only the silence at the first stop and the flag-not-comment at the second are the claim.** Read the ticket thread with `gh issue view` and confirm it is untouched.

2. **The refutation — finding 1 reproduced deliberately, and the question it raises.** Before the daemon starts a session, change `timone.yaml` at the root and leave it **uncommitted**, which is exactly what the orchestrator did on 2026-08-14. The containment rule will fire against a session that did nothing. Expect: the session is handed the accusation and **can answer it** — it knows it never touched the file, which is the knowledge the rule cannot have.

   **Then watch what happens at the next stop, because this is where the build and the decision may disagree.** The uncommitted change is still there, so **the rule fires again and the finding escalates to a run flag despite having been refuted.** Saying "not mine" does not clear it; nothing in the build lets a session dismiss a finding, only fix one. **This is a gap between [ADR-0027](../../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md)'s wording — *"fix it, or say why the finding is wrong"* — and what was built**, found while planning this gate rather than while running it, and left open on purpose: it is fvermaut's to settle with the behaviour in front of him. **The question:** is a refuted finding landing as a flag acceptable — it is now a private flag rather than a public accusation, which was the whole cost — or does a session need a way to dismiss one, and what stops that from being a way to silence true findings?

3. **The interactive half.** Run a session by hand that commits something stray. Expect: first stop hands it over with nothing printed or journalled; second stop prints and appends one line to `.timone/sessions.jsonl`. No ticket anywhere, no run to flag.

4. **The two new mechanisms of `f44a52a`, neither yet seen outside a test.** Cut `timone/99-x` in the Timone repository during a session and confirm the branch-placement rule reaches the session that cut it. Then, on a real fixture run that takes a work branch, confirm the branch lands in `projects/scratch-app/` and **not** at the root — which is the fix for [finding 11](reports/phase-20-live-gate.md) and the thing that started all of this.

5. **The recorded hole, measured rather than asserted.** Kill a session immediately after it has been handed a finding. Expect: **nothing escalates, ever** — no flag, no print, no line — and the finding sits in `.timone/baselines/<session>.json` as returned-but-unescalated until the daily sweep. ADR-0027 records this limit; this step is what makes it a measurement instead of a prediction, and it is the step most likely to change how bad it looks.

6. **Silence, on a clean session of each kind.** Nothing at all, from either. Run after step 1 so it is silence *following* a firing rather than silence in a vacuum.

**Seams under test (TDD):** none — this is the live gate. Phase 14 found six defects this way against 532 green tests; phase 20's gate found ten against 792, three of which no test could have seen.

> The daemon must have been restarted at or after `70bce0a`.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
gh issue view <n> --repo fvermaut/scratch-app --comments
cat .timone/sessions.jsonl
cat .timone/baselines/*.json
```

- [ ] Steps 1–6 each observed, evidence captured with timestamps for the gate report
- [ ] The ticket thread read directly, on a run that produced a finding — **not inferred from the absence of a fake call**
- [ ] Silence shown at a first stop **and** the round shown breaking it, so a dead rule cannot pass as a quiet one
- [ ] Step 5's hole measured and written down whatever its size
- [ ] **Human gate:** fvermaut judges step 2 — whether a refuted finding may escalate to a flag, or whether a session needs a way to dismiss one

### 21b — Register, status, and the two reports

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — R15 `draft` → `verified` **only on 21a's evidence**, and only if every one of its four criteria was observed. If step 2's question is left unsettled, R15 stays `draft` and says so.
**[MODIFY]** `STATUS.md` — plain language: what changed about where findings go, what step 2 showed, and the count of verified requirements corrected either way.
**[MODIFY]** [ADR-0027](../../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md) — a consequences entry if step 2 or step 5 changes what it claims. An ADR that survives its own gate unamended should say so; one that does not is amended rather than quietly outlived.
**[NEW FILE]** `doc/plans/phases/reports/phase-21-live-gate.md`, and `reports/phase-21-complete.md` recording that the machinery predates the plan.

**Seams under test (TDD):** none.

> 21a must be complete.

#### Agent Validation Steps

```bash
grep -n -A4 "^## R15" doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n "sixteen are verified\|seventeen are verified" STATUS.md
```

- [ ] R15 does not flip on a merged diff — only on 21a
- [ ] The count in `STATUS.md` matches the register, whichever way it went
- [ ] The deviation — machinery built before the plan — is in the completion report, not only here

## Dependency graph

```
21a → (none)          the live gate: the round, and the two things it costs
21b → 21a             register, status, and the two reports
```

## What this phase does not prove

- **That the attribution is right.** An uncommitted change carries no trailer and the containment rule can still name the wrong session. Step 2 deliberately *uses* that defect rather than fixing it.
- **The round on a session that argues well.** Step 2 obtains one session's answer to one staged accusation. Whether sessions in general refute wrong findings rather than apologising and inventing a fix is a claim one observation cannot make.
- **Anything on a repository with other contributors.** Two solo repositories cannot show what a guardrail flag looks like to somebody who is not fvermaut, and after ADR-0027 nothing lands where they could see it anyway.
