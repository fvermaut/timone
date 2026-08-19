# ADR-0036: Feedback is triage with the documents open

- **Status:** accepted
- **Date:** 2026-08-19
- **Source:** fvermaut's ruling of 2026-08-19, on being asked whether *"a reaction to work you've already been given"* is genuinely a different kind of thing from *"a new request"*: **"it's just a later request, it has no reason to exist."**
- **Supersedes:** `process.md` stage 9 as a distinct stage, and the routing clause *bug or post-delivery observation → stage 9*
- **Occasioned by:** [phase 27's live gate](../plans/phases/reports/phase-27-live-gate.md), which built stage 9's daemon path, ran it on `scratch-app` [#4](https://github.com/fvermaut/scratch-app/issues/4), and produced the evidence that it was unnecessary
- **Answers, in passing:** [timone#32](https://github.com/fvermaut/timone/issues/32) — whether the sorting step may route on what it finds
- **Standing:** [ADR-0016](0016-review-remediation-rides-the-verify-fix-shape.md) (a review comment on an open pull request is *not* this road and never was), [ADR-0006](0006-specs-in-repo-single-source-of-truth.md), [ADR-0014](0014-artifact-first-gates.md)

## Context

**Stage 9 was built, run once, and found to be stage 1.**

Phase 27 built the daemon's path into stage 9 because one of stage 1's four classifications — `bug` — routed into a stage that had never existed, so every bug report ever filed parked for ever. The path was gated live on `scratch-app` #4, a real report that had been stuck since 2 August. It worked: it diagnosed, committed a record, asked, and took fvermaut's approval.

**What it produced is what killed it.** Its entire contribution to #4 was to overturn a triage decision made in August. The August triage had called #4 a bug because *"the requirements already promise that when you tick an item, the change shows on screen immediately."* They do not — that word is in a different clause about deleting. Stage 9 established that by reading the criteria register, which triage had never opened.

So the two stages, set side by side:

| | Stage 1 — triage | Stage 9 — feedback |
|---|---|---|
| Input | a request | a reaction |
| Does | classifies and routes | classifies and routes |
| Builds | nothing | nothing |
| Produces | a record and a rationale | a record and a rationale |
| Stops for the human | yes | yes |
| **Reads** | **the ticket's text** | **the register, the reports, git history** |

**The difference is the reading, and nothing else.** And the three *layers* stage 9 sorted feedback into turn out to be the three *kinds* stage 1 already has, seen by someone who has opened the documents:

| Stage 9's layer | The kind it actually is | Where stage 1 already sends it |
|---|---|---|
| the intent changed | a **feature** — a new or changed promise | stage 2 / 3 |
| what was built is not what was agreed | a **bug** | stage 5, anchored on the existing criterion |
| the record is wrong | a **chore** — correct a document | stage 5, unanchored |

## Decision

### D1 — Stage 9 is not a stage

`process.md` loses it. `timone-improve` is retired, and no run ever enters a `feedback` stage again. What stage 9 did, stage 1 does.

**This is a deletion, not a rename.** A "diagnose what the reaction means" step that survives under another name is the same stage with a fresh coat, and the reasoning above applies to it unchanged.

### D2 — Triage reads before it decides

Stage 1 opens the project's own documents — the criteria register, the PRD narrative, the delivery and verification reports, and the relevant git history — before it classifies. It reads what the request cites and what it needs in order to judge the request; it does not trawl the project for grievances nobody raised.

**This is the cost of D1 and is not optional.** Delete stage 9 without it and the deep reading is simply gone: a report is classified from its text, exactly as #4 was in August, and nothing downstream ever opens the register. Triage becomes a slower and more expensive session, deliberately.

It also settles [timone#32](https://github.com/fvermaut/timone/issues/32) in the affirmative, from the other end: the sorting step routes on what it finds, because finding out is now its job.

### D3 — `bug` means the code does not keep a promise that exists

Not *"a person used the word bug"*. A report whose complaint is that something never promised is missing is a **feature**. A report whose complaint is that a written document is wrong is a **chore**. Only a divergence from a criterion that is actually written down is a bug, and it routes to stage 5 anchored on that criterion.

**A person filing a report is not expected to know which of the three it is.** Working that out from the documents is what stage 1 now does, and it is why D2 is required.

### D4 — What was already carved out stays carved out

A concrete change-requesting review comment on an open pull request is confirmed intake and rides the verify-fix shape through `remediation` ([ADR-0016](0016-review-remediation-rides-the-verify-fix-shape.md)). It never went through stage 9 and it does not go through stage 1. Nothing here touches it.

## Consequences

- **`doc/feedback/` stops being written to.** Records already committed there stay where they are as history; new ones are triage records under `doc/triage/`.
- **Triage costs more per request.** That is the trade taken knowingly: one deeper session at the front, against a whole stage behind it.
- **The daemon graph loses a node and a gate.** `feedback` goes; the third gate phase 27 added goes with it, and the count returns to two.
- **A misfiled report is corrected at the front rather than three stages in.** #4 spent seventeen days parked and one full stage-9 pass to reach a conclusion that reading the register would have produced on 2 August.
- **One intake needs a new home, and it is not settled here** — the sources stage 9 accepted that are not tickets: a stage-7 loop-exhaustion or BLOCKED hand-off, a criteria line left at `failed`, the outcome of a performed HUMAN-CHECK. They were hand-run through `timone-improve` and never automated. The phase that carries out this ADR must say where they go; the obvious candidate is that they are filed as tickets and triaged like anything else.
