---
name: timone-improve
description: Stage 9 (Feedback) of the Timone process — on a managed project, turn post-delivery feedback into a diagnosis: triage each item's layer (intent change / implementation gap / the record is wrong), classify the remediation, amend the PRD or a report when that is the whole fix, and dispatch every code remediation through stages 5 → 8 once the human has confirmed it. Use when delivery or verification hands work back, when a triage record is routed to stage 9, or when the user says "act on this feedback", "act on the review findings", "this isn't what I meant", or "/timone-improve".
argument-hint: <project-name> <feedback source: record path, report/PR/finding reference, or the feedback itself>
---

# Timone Stage 9 — Feedback

Feedback is the process listening. Your job is to work out what a reaction to delivered work **means**, propose a response, and — once the human has confirmed it — route that response to the stages that already exist. The classification is the diagnosis; the pipeline is the treatment. You never treat with your own hands. The process spec (`process.md`, stage 9) is normative; when this skill and the spec disagree, the spec wins.

Two things follow from that, and they govern everything below. **You commit documents only** — the feedback record, PRD-pair amendments, record corrections to committed process artifacts, `STATUS.md`. And **an intake that closes with no remediation at all is a completed stage-9 pass, not a failure of one**: "already resolved", "working as intended" and "the human declined it" are outcomes, and recording one honestly is the whole job.

**Managed projects only.** Feedback on Timone itself stays hand-run, as Timone's own planning already is. Asked to improve Timone, say so and stop.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## The gates

Each gate stops the pass. When one fires you write **nothing** into the project, dispatch nothing, state which gate fired and why in one short paragraph, and name the skill or the human to route to. A stopped pass is a valid, complete outcome of this skill. Steps 3 and 4 of the preamble are gates in exactly this sense; the two below follow them.

**1 — Input gate.** The invocation must name the project **and** a feedback source: a path (`doc/triage/NNN-….md`, a delivery or verification report, an earlier feedback record), a reference (`PR #2`, `phase-01 delivery, Spec finding 2`, an issue number), or the feedback text itself. No source named → list what a source could plausibly be for this project — open PRs, delivery reports carrying unactioned findings, triage records routed to stage 9, register lines at `failed`, a stage-7 loop-exhaustion or BLOCKED hand-off, the outcome of a performed HUMAN-CHECK — and **stop**. **Never pick a feedback item for the user.** Acting on a grievance nobody raised is not a smaller mistake than ignoring one that was.

**2 — Source gate.** The named source must be readable: the path exists, the PR or issue exists (`gh` from within `projects/<name>/`), the finding named exists in the report named. Unreadable or ambiguous → say exactly what you looked for and where you looked, and stop. Do not substitute a nearby source that *is* readable.

- **A finding reference must name its axis.** A delivery report numbers Standards and Spec findings from 1 independently, so "finding 2" identifies two different findings. Given a bare number, ask which — do not pick.
- **A bare report path means every finding in it.** That is the batch case, not an ambiguity.
- **A dangling citation inside a readable source is not this gate firing.** Sources cite things that moved or never existed; note it in the record and judge the item on the evidence you can reach.

**You never trawl — and the test is the item set, not your motive.** **An intake's items are exactly what its named source raises.** Reading widely to judge those items is resolution; adding an item the source never raised is manufacturing feedback. That line is auditable from the record alone, which is the point: a rule about what you were *trying* to do could never be checked.

**Surfaced, not tabled.** Reading the cited artifacts will sometimes expose a real defect nobody raised. Do not table it and do not swallow it: record it under **Surfaced, not tabled** in the feedback record as a candidate intake the human may name later. Never triage it, never propose it, never act on it.

## What you read

- **The named source, in full** — the whole triage record, the whole delivery report section, the whole PR review thread, the free-form text as given.
- **The artifacts it cites, and the ones needed to judge it** — the project's committed documents, all of them fair game: the criteria register, the PRD narrative, the completion / verification / delivery reports **and the handoff notes beside them**, the phase file's `Status` line and requirements header, `doc/standards.md`, `README.md`, `CONTEXT.md`, earlier records under `doc/feedback/` and `doc/triage/`. **Any of these can be the *subject* rather than the evidence** — `doc/standards.md` is the artifact most often *wrong* in a record-layer item, so read it as a possible defendant, not only as a witness.
- **Branch and PR *state*** — `git log --oneline`, `git branch`, `git log --name-only` / `--stat`, `git merge-base --is-ancestor`, `gh pr list`, `gh pr view`. **Paths and ancestry are state; hunks are content.** Knowing *which files* a commit touched, and whether a fix is an ancestor of what shipped, is how you tell "already resolved" from "not reproducible" — refusing it leaves you inferring from commit-message prefixes, which a single mislabelled commit defeats.
- **Live state beats what the source claims about it.** A report written while a PR was open still says it is open. Check, and let the check win — taking the source's word for it is how a remediation gets aimed at a merged branch.
- **Never: application source, diffs of code, `git show` of a hunk, the committed test suite.** Classification is about what the feedback *means* against what was promised; whether the code behaves is stage 7's question, answered with stage 7's instruments. A finding you cannot classify without reading the code is a finding whose class is **verification pass** — say so, rather than reading the code to settle it yourself.
- **Never run a fresh behaviour probe.** When an intake needs evidence about behaviour, cite the evidence the register and reports already hold. If none exists and the answer matters, the item's vehicle is a verification pass, not a curiosity you satisfy yourself.
- **A correction carried in the source is part of the source.** When a delivery report's own note already reverses or qualifies a finding — the deliverer caught it after writing it — that note is the finding's current state; classify what the source actually says, not the headline.

## Layer triage — first, and item by item

For each item, one question with **three** answers:

| Layer | It means | Where it goes |
|---|---|---|
| **intent** | this changes *what we want* | the PRD pair moves **before** any code does |
| **implementation** | what we want is right; *how it was built* is not | a remediation dispatched through the pipeline |
| **record** | neither — *the artifacts misdescribe what exists* | a record correction — **unless the misdescribing artifact is not yours to fix**, see below |

**The layer does not always name the vehicle, and this is where a run goes wrong.** A *record*-layer item whose misdescribing artifact is **application code** (a stale comment, a README inside the source tree) is still record-layer, but you may not fix it: it dispatches as a **refinement**, because stage 9 never commits code and that rule does not bend for a one-line comment. A *record*-layer item about a **register evidence note** — the dated partial-evidence markers recording what a pass actually checked — dispatches to **stage 7**, for the same reason its verdicts do. Read the class table below for the vehicle; never infer it from the layer.

**The layer describes the claim, judged against the artifacts as they stand.** When the claim turns out not to hold at all, the layer is still where it *would* have landed had it held, and the outcome — not the layer — records why it didn't. An item can be honestly layered `implementation` and closed `already resolved` in the same breath.

The third answer earns its place: a stale non-conformance line in a delivery report is neither a requirements change nor a code change, and a two-way question trains you to shrug one way silently. **A batch is layered item by item, never wholesale** — nine findings from one report can carry all three layers, and the human's decisions differ per item.

**One item is one thing the human decides on.** A numbered finding is one item, even when it carries several suggested remediations — including ones that straddle layers. Put the remediation you recommend in the row, and state the alternatives beneath it **with their prices**, so the human is choosing rather than ratifying. Splitting one finding into three rows, two of which you recommend declining, manufactures items to decline; merging two findings loses a decision the human is entitled to make separately.

Give each item **one line of rationale** saying why this layer and not the nearest alternative — the same discipline `timone-triage` applies to kinds.

## Classification — one of seven, each with a vehicle

| Class | It is | Vehicle |
|---|---|---|
| **bug fix** | behaviour diverges from an **unchanged** requirement (a REGRESSION arriving from stage 7 defaults here) | plan work → stages 6 → 7 → 8 |
| **refinement** | the requirement is met, the quality is improvable — the delivery Standards axis's native output | plan work, **un-anchored**, protected by the regression set |
| **plan patch** | an existing plan file is wrong | stage 5's amendment rules, re-approval semantics included |
| **new sub-phase** | scope grows within a phase whose branch is still open | stage 5 amends that phase; the next free letter, dated ✏ marker |
| **new phase** | scope grows beyond one phase | stage 5 writes a new phase file |
| **record correction** | a committed **process artifact** misdescribes reality — a report, `doc/standards.md`, a plan file's statement of fact, an earlier triage or feedback record | a docs-only correction **you** make, naming the evidence for it |
| **verification pass** | the artifacts cannot settle it and only observed behaviour can — an unperformed HUMAN-CHECK on a `draft` requirement, a criterion left `revised` by an intent amendment, a register evidence note overstating what was checked | dispatched to **stage 7**, which owns every verdict and every claim about behaviour |

**Plus "none"** — the item needs no remediation at all. That is a class, it goes in the table, and it is confirmable like any other; see Degenerate outcomes.

**A merged plan file is not patchable.** *Plan patch* presumes a plan a stage-5 amendment can still reach; stage 5's re-approval semantics are meaningless on a phase already `Complete` and merged. A factual error in a merged plan file is a **record correction**, not a plan patch — and usually not worth making at all, which is a fine thing to recommend.

**Classification decides nothing about priority.** Whether an item is worth doing at all is the human's call, at the gate — a correctly classified finding that is declined is a correctly handled finding.

## The vehicle follows the branch state

| The work it concerns | The remediation lands as |
|---|---|
| a phase whose **PR is open** | on that phase: plan amendment per stage 5, execution on the same branch, stage 7 re-verifies, stage 8 re-delivers as an **iteration of the existing PR** |
| **merged** work | a **new phase file, new branch, new PR** — merged work is history, and history is never rewritten |

**Record corrections follow the artifact they correct.** One living on an open branch is corrected **there**, and a process-artifact-only change does not re-run the delivery axes (stage 8's subject rule) — say that in the hand-back so re-delivery does not spawn them. One whose work is merged is corrected on the default branch, **or on the next relevant branch when one is open** — the spec allows both; pick one and say why.

**Everything else you commit — the feedback record, PRD-pair amendments, `STATUS.md` — lands on the project's default branch**, and you **return the clone to the branch you found it on**. Those artifacts are read outside any one phase, and the default branch is where the human reads.

## The proposal, and the gate

Present the proposal, then **stop**. Nothing is committed, amended or dispatched before the human answers — not the "obvious" ones, not the record-layer ones.

```markdown
## Feedback NNN — proposal for <project> (nothing has moved yet)

**Source:** <the named source> — <N> items.

| # | Item | Layer | Class | Vehicle | Scope | Recommended |
|---|---|---|---|---|---|---|
| 1 | <the finding in one line, with its reference> | intent / implementation / record | <class, or "none"> | <what would actually happen> | <how big, honestly> | confirm / decline / defer |

<Per item, one line: why this layer and this class, and not the nearest alternative.>
```

The human's answer per item is **confirm, decline, or defer**:

- **Confirm** — it moves, by the vehicle stated. **For an item classed "none", confirm confirms the close**: the three words answer your *proposal*, not a vehicle, so a no-remediation item is confirmable exactly like any other. Say in the row what confirming will actually cause, so no one mistakes it for authorising work.
- **Decline** — it does not move, ever, for this intake. Record the human's reason **verbatim**. Never re-argue a decline and never quietly re-raise it in a later section. Declining a "none" item means the human rejects your diagnosis: the item stays open, their reason recorded, and the vehicle is usually a **verification pass** — they have seen something the artifacts do not hold.
- **Defer** — it does not move now. Record it verbatim too; the record is what makes a deferred item findable later, which is the difference between deferring and dropping.

**This gate is yours, not stage 5's.** It answers *"is this the right response to the feedback?"* — right layer, right class, right scope. Plan work you dispatch still faces stage 5's own approval, which answers *"is this breakdown executable?"*. Collapsing them would let a feedback conversation silently approve a plan nobody has read.

Recommend a decision for every item — a proposal with no recommendation makes the human do the diagnosis you were invoked for. Recommending *decline* is a real recommendation.

## Executing what was confirmed

**Intent first.** Before anything else moves, amend the PRD pair ([ADR-0006](../../../doc/adr/0006-specs-in-repo-single-source-of-truth.md) — the pair is the source of truth for intent):

- **Same ID forever.** Criteria updated **in place**, never renumbered, never reused, never deleted.
- `Status: revised` — or `DEPRECATED` with a one-line reason, the block staying.
- A dated `✏ <YYYY-MM-DD>:` marker naming the feedback record.
- The register's **intent transition lands in the same commit** as the amendment that motivates it. That is your one register write. **You never write a verdict** — `draft` / `verified` / `failed` are stage 7's, always.
- A `revised` criterion drops out of the derived regression set until stage 7 re-verifies it against its new wording. Its old evidence is stale by construction; say so in the record, so the next verifier is not surprised by a MUST that stopped being regression-checked.

**Record corrections** you make yourself, on the branch the artifact lives on, naming the evidence for the correction (a SHA, a report path, a register line) — never "corrected per feedback" with nothing behind it. A correction to *application code* or to a *register evidence note* is not yours: dispatch it, per the class table.

**Everything else you dispatch.** Hand plan-file vehicles over as an explicit invocation:

```
/timone-plan <project> doc/feedback/NNN-<slug>.md — <the confirmed items, by number>
```

then name the chain that follows: stage 6 executes, stage 7 verifies, stage 8 delivers.

- **One dispatch per anchoring posture.** Refinements ride **un-anchored**; a bug fix is **anchored** on the requirement it restores. Stage 5 cannot cut one phase that is both, so confirmed items of both kinds produce **two** `/timone-plan` invocations, not one — say which items are in each.
- **Verification-pass vehicles go to stage 7**, not stage 5: `/timone-verify <project> <phase-NN>`, naming the criteria to re-check and why. This is the vehicle for an unperformed HUMAN-CHECK, for a criterion you just marked `revised`, and for a stale register evidence note.
- **You never invoke stage 6 directly** — planning's gate is not yours to skip — and you never commit application code. Code committed here would be code no verification pass has seen and no delivery review has read: the hole stage 8 closes by refusing to refactor, reopened one stage later.

## Degenerate outcomes are outcomes

Close the intake, citing the evidence that already exists — never a fresh probe:

- **Already resolved** — the divergence no longer exists. Either it was built away and verified since, **or the report predated the build entirely** and what was built conforms — a stage-1 record is classified against the PRD, not against a running app, so a bug routed here before the feature existed is normal, and it is *resolved*, not *unreproducible*. Cite the register line and the verification report.
- **Not reproducible** — the source describes something no artifact records. Say what you looked at.
- **Working as intended** — the requirement says what the reporter wishes it didn't. Quote the criterion; if the human disagrees with the criterion, that is an *intent* item, and it goes back through the gate as one.
- **Declined by the human** — their reason, verbatim.

## The feedback record

`projects/<name>/doc/feedback/NNN-<slug>.md` — NNN zero-padded, allocated by listing the directory and taking the next number; numbers are never reused. One record per intake. Commit it on the default branch as `docs: feedback NNN — <slug>`.

**Allocate the number by looking, not by writing.** The proposal quotes `NNN` at the gate, and nothing may be written before the human answers — so a missing `doc/feedback/` directory means "start at `001`", and you create it when you write the record, not when you number it.

```markdown
# Feedback NNN: <what it was about, in a few words>

- **Date:** YYYY-MM-DD
- **Source:** <doc/triage/NNN-….md, routed here by stage 1 | phase-NN-delivery.md § Spec review | PR #N review | free-form request>
- **Read:** <every artifact read, by path>
- **Items:** <N> — <a> confirmed, <b> declined, <c> deferred

## Source

<The feedback verbatim when free-form; otherwise the reference plus each item's text quoted from it.>

## Triage

| # | Item | Layer | Class | Proposed remediation | Recommended | Decision |
|---|---|---|---|---|---|---|
| 1 | <one line> | intent / implementation / record | <class or "none"> | <vehicle> | confirm / decline / defer | confirm / decline / defer |

### <n>. <item>

- **Rationale:** <why this layer and this class, and not the nearest alternative>
- **Alternatives offered:** <any other remediation the source suggested, with its price — omit when there were none>
- **Decision:** confirm | decline | defer — <the human's reason, verbatim>

<The **Recommended** column stays in the record next to the decision: it is the only trace of whether stage 9's diagnoses are any good, and it is worth keeping precisely where the human overruled one.>

## Amendments

- `<path>` — <what changed: R6's criteria plus `Status: revised` and its dated marker> — `<sha>`

<"None." when the pass amended nothing.>

## Dispatch

- Item <n> → `/timone-plan <project> doc/feedback/NNN-<slug>.md` — <vehicle: new phase, merged work | amendment to phase-NN, PR #N open> — then stages 6 → 7 → 8.

<"None." when nothing was dispatched.>

## Outcome

<Every item closed without remediation, with its degenerate outcome and the evidence cited by path. An intake closed entirely here is a complete pass.>

## Surfaced, not tabled

<Defects noticed while reading the cited artifacts that this source did not raise — one line each, with where they live. Candidate intakes the human may name later; none of them was triaged, proposed or acted on here.>

<"None." when nothing was noticed.>
```

**When the source is a GitHub PR or issue**, comment the link to the committed record ([ADR-0004](../../../doc/adr/0004-github-first-adapter-pair.md)) — `gh pr comment` / `gh issue comment` from within `projects/<name>/`. The comment points at the record; the record is never PR prose alone (ADR-0006). A non-GitHub `repo_url` → skip the comment **loudly**, as stage 1 does with its fallback.

## Status reporting

Before finishing, update the target project's `STATUS.md` — on the **default branch only**, its own `docs: STATUS.md — <theme>` commit, then return the clone to the branch you found it on (`process.md`, Status reporting). Plain language: what feedback arrived, what the human decided, what was amended, what is now queued for planning and where it will surface, and always naming which repository each item sits in. Never read it as a source of truth.

## Workflow

1. Resolve the target project (preamble), then the feedback source (gates 1 and 2). If a gate fires, stop, route, write nothing.
2. Read the named source in full, plus the artifacts it cites. Establish branch and PR state for the work it concerns.
3. Layer each item, then classify it, each with a one-line rationale.
4. Present the proposal table and **stop**. Nothing moves before the human answers.
5. Record every decision verbatim — confirmed, declined and deferred alike.
6. Amend intent first (PRD pair + the register's intent transition, one commit), then any confirmed record corrections on the branch their artifact lives on.
7. Write and commit the feedback record; comment the link when the source is a GitHub PR or issue.
8. Dispatch confirmed plan work with the exact `/timone-plan` invocation. Never stage 6 directly.
9. Update `STATUS.md`.
10. Report per Closing below.

## Closing

**A pass has three endings, not two.** Report the one you reached.

**Ending A — a gate fired.** Which gate, why, and the exact next invocation. Nothing else applies.

**Ending B — you reached the confirmation gate.** This is the *normal* ending, because the human answers after your turn, not inside it. Report:

1. The proposal table, plus the per-item rationales and any alternatives with their prices.
2. Anything **surfaced, not tabled**, marked plainly as outside the item set.
3. Exactly what confirming would cause — files, branches, commits, dispatches — so the decision is informed.
4. An explicit statement that nothing has been committed, amended or dispatched, and that you are waiting on a per-item decision.

Then **stop**. Do not write the record, do not number a directory into existence, do not dispatch.

**Ending C — the human has decided and you have executed.** Report, in this order:

1. The feedback record's path.
2. The per-item tally: confirmed / declined / deferred.
3. Every amendment committed, with its SHA and what it changed.
4. Every dispatch, as the exact invocation handed over, with the vehicle and the chain that follows — stages 6 → 7 → 8 for plan work, stage 7 alone for a verification pass.
5. Everything closed with a degenerate outcome, and the evidence cited for it.

Stage 9 diagnoses, records and routes. It never fixes with its own hands, never verifies behaviour, never merges, and never overrides a decline. Stop here.
