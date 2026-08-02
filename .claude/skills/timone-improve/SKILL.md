---
name: timone-improve
description: Stage 9 (Feedback) of the Timone process — on a managed project, turn post-delivery feedback into a diagnosis: triage each item's layer (intent change / implementation gap / the record is wrong), classify the remediation, amend the PRD or correct a process artifact when that is the whole fix, and dispatch everything else through stages 5 → 8 or back to stage 7 once the human has confirmed it. Use when delivery or verification hands work back, when a triage record is routed to stage 9, or when the user says "act on this feedback", "act on the review findings", "this isn't what I meant", or "/timone-improve".
argument-hint: <project-name> <feedback source: record path, report/PR/finding reference, or the feedback itself>
---

# Timone Stage 9 — Feedback

Feedback is the process listening. Your job is to work out what a reaction to delivered work **means**, propose a response, and — once the human has confirmed it — route that response to the stages that already exist. The classification is the diagnosis; the pipeline is the treatment. You never treat with your own hands. The process spec (`process.md`, stage 9) is normative; when this skill and the spec disagree, the spec wins.

Two things follow from that, and they govern everything below. **You commit documents only** — the feedback record, PRD-pair amendments, record corrections to committed process artifacts, `STATUS.md`. And **an intake that closes with no remediation at all is a completed stage-9 pass, not a failure of one**: "already resolved", "working as intended" and "the human declined it" are outcomes, and recording one honestly is the whole job.

**Managed projects only.** Feedback on Timone itself stays hand-run, as Timone's own planning already is. Asked to improve Timone, say so and stop.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt. **The invocation is `<project-name> <feedback source>`: the first token is the project, the remainder is the source.**
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
- **A bare report path means every *numbered* finding in it.** That is the batch case, not an ambiguity. A defect the report mentions in prose without numbering it was not adopted as a finding: it is **surfaced, not tabled**.
- **A dangling citation inside a readable source is not this gate firing.** Sources cite things that moved or never existed; record it under *Surfaced, not tabled* and judge the item on the evidence you can reach.

## What is, and is not, an item

**An intake's items are exactly what its named source raises.** Reading widely to judge those items is resolution; adding an item the source never raised is manufacturing feedback. The test is the **item set**, which is auditable from the record — not your motive, which is not.

Three dispositions, and every run needs all three:

| | What it is | Where it goes |
|---|---|---|
| **Item** | what the invocation named — a finding, a batch of findings, a record, the feedback text | the proposal table; triaged, classified, decided |
| **Raised, not named** | other work the *source document* names, or that the process has already routed to stage 9, that this invocation did not name — numbered findings, unnumbered items awaiting the human, a triage record routed here and never actioned | listed **by reference only** in the record; not triaged, not classified. Naming one is a separate intake |
| **Surfaced, not tabled** | a defect **nobody** raised, noticed while reading the cited artifacts | one line each in the record, as candidate intakes. Never triaged, never proposed, never acted on |

**Bound the surfaced list:** one line each, and nothing already recorded as open somewhere the human reads — if `STATUS.md` or a verification report already carries it, say where it is tracked instead of restating it. A surfaced list many times the size of the item set is noise, and noise is how a real find gets missed. **`STATUS.md`'s own staleness is never a surfaced defect** — refreshing it is this stage's closing obligation, so fixing it is the workflow, not an item.

**Reading `STATUS.md` to check what is already tracked is not reading it as a source of truth.** The prohibition is on taking it as evidence about the project; checking whether the human has already been told something is a different question, and the bound above depends on it.

## What you read

- **The named source, in full** — the whole triage record, the whole delivery report section, the whole PR review thread, the free-form text as given.
- **The artifacts it cites, and the ones needed to judge it** — the project's committed documents, all of them fair game: the criteria register, the PRD narrative, the completion / verification / delivery reports **and the handoff notes beside them**, the phase file's `Status` line and requirements header, `doc/standards.md`, `README.md`, `CONTEXT.md`, `doc/handover/`, tool configuration (the Standards axis whose findings you inherit reads it as a matter of course), earlier records under `doc/feedback/` and `doc/triage/`. **Any of these can be the *subject* rather than the evidence** — `doc/standards.md` is the artifact most often *wrong* in a record-layer item, so read it as a possible defendant, not only as a witness. Reading it adversarially is licence to *find*, never licence to *table*: what it yields outside your item set is surfaced, not acted on.
- **Branch and PR *state*** — `git log --oneline`, `git branch`, `git log --name-only` / `--stat`, `git merge-base --is-ancestor`, `gh pr list`, `gh pr view`. **Paths and ancestry are state; hunks are content.** Knowing *which files* a commit touched, and whether a fix is an ancestor of what shipped, is how you tell "already resolved" from "not reproducible".
- **Live state beats what the source claims about it.** A report written while a PR was open still says it is open. Check, and let the check win — taking the source's word for it is how a remediation gets aimed at a merged branch. Record what the check returned; it is usually what decides the vehicle.
- **Never: application source, diffs of code, `git show` of a hunk, the committed test suite.** Whether the code behaves is stage 7's question, answered with stage 7's instruments. **Source quoted inside an artifact you were told to read is not a loophole and not a violation:** read the report, judge the report's claim, and do not open the file it quotes. Where a claim's truth matters and only the code could settle it, the class is **verification pass** — say so rather than reading the code yourself.
- **Never run a fresh behaviour probe.** When an intake needs evidence about behaviour, cite the evidence the register and reports already hold.
- **A correction carried in the source can change the item's subject, class, owner and evidence — not merely its emphasis.** When a report's own note reverses or qualifies a finding, that note is the finding's current state: read on its headline the same finding may dispatch to another stage, and read with its reversal be a correction you make yourself. **Read every report to its end before classifying anything in it**, and read the reversals in the reports it *cites* too — the note that overturns a finding is not always in the same document.
- **A note that disclaims amending the report still establishes facts.** Delivery reports carry their axes verbatim and say so, which puts the deliverer's note in formal tension with the finding above it. Resolve it on evidence, never on authority: when the note's substance is independently checkable — a SHA's ancestry, a verification report's re-verify, a register line — check it and follow what you find. When it is not, the class is **verification pass**, because an unverifiable disagreement about behaviour is stage 7's to settle, not yours to arbitrate.

## Layer triage — first, and item by item

For each item, one question with **three** answers:

| Layer | It means | Where it goes |
|---|---|---|
| **intent** | this changes *what we want* | the PRD pair moves **before** any code does |
| **implementation** | what we want is right; *how it was built* is not | a remediation dispatched through the pipeline |
| **record** | neither — *an artifact misdescribes what exists*, whether that is the system or what another artifact says | a record correction — **unless the artifact is not yours to fix**, see below |

**The layer does not name the vehicle. Read the class table for that.** A *record*-layer item about **application code** dispatches as a **refinement** — stage 9 never commits code, and that does not bend for a one-line comment. A *record*-layer item about a **register evidence note** dispatches to **stage 7**, for the same reason its verdicts do.

**The boundary is location, not judgement.** Yours to correct: everything under `doc/`, plus `CONTEXT.md` and `STATUS.md`. Not yours: source, schema files, tooling config, `README.md` — those dispatch, however trivial the wording change.

**The layer describes the claim, judged against the artifacts as they stand** — what the reporter is asserting *about*, not whether they are right. When the claim turns out not to hold, the layer is still where it would have landed, and the **outcome** records why it didn't: an item can be honestly layered `implementation` and closed `already resolved` in the same breath.

**Two tiebreaks, because that rule alone gives opposite answers on the items that matter most:**

- **When no criterion covers the item, the layer is `intent`** — however the reporter framed it. A complaint about behaviour nobody ever specified is a request to specify it, and remediating it first would build against a standard nobody agreed to. Check the register before layering anything as `implementation`: if you cannot name the criterion the behaviour offends, you are looking at an intent item wearing an implementation's clothes.
- **When what is missing is *evidence* rather than behaviour or wording, the layer is `record`** — the register accurately records a MUST as unverified, nothing misdescribes anything, and the deficiency is in what has been checked. That is the layer for every **verification pass** item, including an unperformed HUMAN-CHECK.

**One item is one thing the human decides on.** A numbered finding is one item, even when it carries several suggested remediations — including ones that straddle layers. **The row's cells describe the remediation you recommend**; alternatives go beneath it in prose, each with its price, so the human is choosing rather than ratifying. Splitting one finding into three rows, two of which you recommend declining, manufactures items to decline.

**Number the proposal 1..N and carry the source's own reference inside each Item cell** ("Standards 2 — …", "Spec 1 — …"). Two axes each numbered from 1 is exactly the collision gate 2 exists to prevent; do not reintroduce it in your own table. Your numbers will not match the source's, and that is the trade — the record's own numbering is what every later reference uses, so the source reference has to travel inside the cell.

**A true finding you recommend declining keeps its real class.** Class describes what the remediation *would be*; the recommendation describes whether it is worth doing. "Refinement, recommended decline" is a coherent and common row — do not stretch a degenerate outcome over a finding that holds, and do not invent a criterion to quote for *working as intended* when the register is simply silent on the subject.

**When the source's headline is what you are contradicting**, state the item in its corrected direction and name the reversal inside the cell. An Item cell that repeats a claim you are about to call false misleads the person deciding.

## Classification — one of seven, plus "none"

| Class | It is | Vehicle |
|---|---|---|
| **bug fix** | behaviour diverges from an **unchanged** requirement (a REGRESSION arriving from stage 7 defaults here) | plan work → stages 6 → 7 → 8 |
| **refinement** | the requirement is met, the quality is improvable — the delivery Standards axis's native output | plan work, **un-anchored**, protected by the regression set |
| **plan patch** | an existing plan file is wrong, and a stage-5 amendment can still reach it | stage 5's amendment rules, re-approval semantics included |
| **new sub-phase** | scope grows within a phase whose branch is still open | stage 5 amends that phase; the next free letter, dated ✏ marker |
| **new phase** | scope grows beyond one phase | stage 5 writes a new phase file |
| **record correction** | a committed **process artifact** misdescribes reality — anything under `doc/`, plus `CONTEXT.md` and `STATUS.md` | a docs-only correction **you** make, naming the evidence for it |
| **verification pass** | the artifacts cannot settle it and only observed behaviour can — an unperformed HUMAN-CHECK on a `draft` requirement, a criterion left `revised` by an intent amendment, a register evidence note overstating what was checked | dispatched to **stage 7**, which owns every verdict and every claim about behaviour |
| **none** | no remediation at all | nothing moves; the item closes with a degenerate outcome and its evidence cited |

**An intent-layer item carries two.** The PRD amendment is implied by the *layer* and is yours to make; the *class* names the follow-on work the amendment requires — and an intent amendment **always** adds a verification pass on top. Put all of it in the Vehicle cell.

**A merged plan file is not patchable.** *Plan patch* presumes a plan a stage-5 amendment can still reach; its re-approval semantics are meaningless on a phase already `Complete` and merged. A factual error in a merged plan file is a **record correction** — and usually not worth making at all, which is a fine thing to recommend.

**Classification decides nothing about priority.** Whether an item is worth doing at all is the human's call, at the gate.

## The vehicle follows the branch state

| The work it concerns | The remediation lands as |
|---|---|
| a phase whose **PR is open** | on that phase: plan amendment per stage 5, execution on the same branch, stage 7 re-verifies, stage 8 re-delivers as an **iteration of the existing PR** |
| **merged** work | a **new phase file, new branch, new PR** — merged work is history, and history is never rewritten |

**Record corrections land on the default branch**, or on the next relevant branch when one has an **open PR** — the spec allows both, so say which and why. "Open" means an open PR, not a branch that still exists: a merged phase's branch lingers, and correcting a file there puts it where nobody reads. When only one candidate exists, say so rather than performing a choice. A process-artifact-only change does not re-run the delivery axes (stage 8's subject rule) — say that in the hand-back so re-delivery does not spawn them.

**Everything else you commit — the feedback record, PRD-pair amendments, `STATUS.md` — lands on the project's default branch**, and you **return the clone to the branch you found it on**.

**Push what you commit.** A record that exists only in a local clone is not a committed artifact in any sense the process means: the human reads the default branch on the remote, a PR comment linking a record nobody can open is worse than no comment, and the next stage clones from `origin`. Push the default branch after the last of your commits, before commenting anywhere. Never force-push, never rebase, never touch a branch that is not yours to move.

## The proposal, and the gate

Present the proposal, then **stop**. Nothing is committed, amended or dispatched before the human answers — not the "obvious" ones, not the record-layer ones.

```markdown
## Feedback NNN — proposal for <project> (nothing has moved yet)

**Source:** <the named source> — <N> items.
**Read:** <the artifacts read, by path>

| # | Item | Layer | Class | Vehicle | Scope | Recommended |
|---|---|---|---|---|---|---|
| 1 | <the finding in one line, carrying its source reference> | intent / implementation / record | <class, or "none"> | <what would actually happen — branch, dispatch, chain> | <how big, honestly> | confirm / decline / defer |

<Per item, one line: why this layer and this class, and not the nearest alternative.>
<Per item with alternatives: each one, with its price.>
```

The human's answer per item is **confirm, decline, or defer**:

- **Confirm** — it moves, by the vehicle stated. **For an item classed "none", confirm confirms the close**: the three words answer your *proposal*, not a vehicle. Say in the row what confirming will actually cause, so no one mistakes it for authorising work.
- **Decline** — it does not move, ever, for this intake. Record the human's reason **verbatim**. Never re-argue a decline. Declining a "none" item means the human rejects your diagnosis: the item stays open, their reason recorded, and the vehicle is usually a **verification pass** — they have seen something the artifacts do not hold.
- **Defer** — it does not move now. Record it verbatim too; the record is what makes a deferred item findable later, which is the difference between deferring and dropping. **A defer wants a trigger** — the condition that should bring it back ("when a third e2e spec exists"). Record the trigger beside the reason; a defer with no trigger is a drop with better manners.

**This gate is yours, not stage 5's.** It answers *"is this the right response to the feedback?"* — right layer, right class, right scope. Plan work you dispatch still faces stage 5's own approval, which answers *"is this breakdown executable?"*.

Recommend a decision for every item — a proposal with no recommendation makes the human do the diagnosis you were invoked for. Recommending *decline* is a real recommendation.

## Executing what was confirmed

**Intent first.** Before anything else moves, amend the PRD pair ([ADR-0006](../../../doc/adr/0006-specs-in-repo-single-source-of-truth.md) — the pair is the source of truth for intent):

- **Same ID forever.** Criteria updated **in place**, never renumbered, never reused, never deleted.
- `Status: revised` — or `DEPRECATED` with a one-line reason, the block staying.
- A dated `✏ <YYYY-MM-DD>:` marker naming the feedback record.
- The register's **intent transition lands in the same commit** as the amendment that motivates it, messaged `docs: amend PRD-NN — <requirement IDs> <what moved>`. That is your one register write. **You never write a verdict** — `draft` / `verified` / `failed` are stage 7's, always.
- **Then dispatch a verification pass — always, even when no code moves.** A `revised` criterion drops out of the derived regression set until stage 7 re-verifies it against its new wording, so an intent amendment with nothing queued behind it leaves a MUST quietly un-regression-checked. This is an obligation, not a disclosure: say it in the record *and* hand over the invocation. **One carve-out:** when the amendment's follow-on is itself plan work, that chain's own stage-7 leg *is* the pass — record the obligation and name what discharges it, rather than handing over a `/timone-verify` aimed at a phase stage 5 has not created yet.

**Record corrections** you make yourself, on the branch determined above, **naming durable evidence** — a SHA, a report path, a register line — never "corrected per feedback" with nothing behind it. Commit as `docs: correct <artifact> — <what changed>`. The correction's own text should stand on evidence that already exists; the feedback record may be referenced once it is written, but a correction whose only justification is a document that does not exist yet is not evidenced. A correction to *application code* or to a *register evidence note* is not yours: dispatch it, per the class table.

**Everything else you dispatch.** Hand plan-file vehicles over as an explicit invocation:

```
/timone-plan <project> doc/feedback/NNN-<slug>.md — <the confirmed items, by number>
```

then name the chain that follows: stage 6 executes, stage 7 verifies, stage 8 delivers.

- **One dispatch per anchoring posture, per phase.** Refinements ride **un-anchored**; a bug fix is **anchored** on the requirement it restores. Stage 5 cannot cut one phase that is both, so confirmed items of both kinds produce **two** `/timone-plan` invocations — say which items are in each. Two items anchored on *different* requirements do not necessarily share a dispatch either; when pricing an alternative, say whether it joins an existing dispatch or adds one.
- **Verification-pass vehicles go to stage 7**, not stage 5: `/timone-verify <project> <phase-NN>`, naming the criteria to re-check and why.
- **A HUMAN-CHECK needs a human, and saying so is part of the dispatch.** Stage 7 cannot perform one; dispatched with nobody available, it returns the item unchanged. State in the Scope cell what the human personally has to do and on what equipment, so the cost is visible rather than hidden behind "stage 7 handles it".
- **You never invoke stage 6 directly** — planning's gate is not yours to skip — and you never commit application code.

## Degenerate outcomes are outcomes

Close the intake, citing the evidence that already exists — never a fresh probe:

- **Already resolved** — the divergence no longer exists. Either it was built away and verified since, **or the report predated the build entirely** and what was built conforms — a stage-1 record is classified against the PRD, not against a running app, so a bug routed here before the feature existed is normal, and it is *resolved*, not *unreproducible*. **A resolved behaviour does not close a record-layer item:** when the fix landed but an artifact still says the gap is open, the behaviour is resolved and the record is not — that is a record correction, not a degenerate close.
- **Not reproducible** — the source describes something no artifact records. Say what you looked at.
- **Working as intended** — the requirement says what the reporter wishes it didn't. Quote the criterion; if the human disagrees with the criterion, that is an *intent* item, and it goes back through the gate as one.
- **Declined by the human** — their reason, verbatim.

## The feedback record

`projects/<name>/doc/feedback/NNN-<slug>.md` — NNN zero-padded, allocated by listing the directory and taking the next number; numbers are never reused. One record per intake. Commit it on the default branch as `docs: feedback NNN — <slug>`.

**Allocate the number by looking, not by writing.** The proposal quotes `NNN` at the gate, and nothing may be written before the human answers — so a missing `doc/feedback/` directory means "start at `001`", and you create it when you write the record, not when you number it.

```markdown
# Feedback NNN: <what it was about, in a few words>

- **Date:** YYYY-MM-DD
- **Source:** <doc/triage/NNN-….md, routed here by stage 1 | phase-NN-delivery.md § Spec review finding 2 | PR #N review | free-form request>
- **Read:** <every artifact read, by path — including timone's own `process.md` and `standards/` where they were consulted>
- **Branch state at triage:** <what the live check returned, and what it decided — "PR #1 and #2 merged 2026-07-28; vehicle is new-phase, not iteration">
- **Items:** <N> — <a> confirmed, <b> declined, <c> deferred

## Source

<The feedback verbatim when free-form; otherwise the reference plus each item's text quoted from it.>

## Triage

| # | Item | Layer | Class | Vehicle | Scope | Recommended | Decision |
|---|---|---|---|---|---|---|---|
| 1 | <one line, carrying the source's own reference> | intent / implementation / record | <class or "none"> | <vehicle> | <how big> | confirm / decline / defer | confirm / decline / defer — with a defer's trigger |

### <n>. <item>

- **Rationale:** <why this layer and this class, and not the nearest alternative>
- **Alternatives offered:** <any other remediation the source suggested, with its price — omit when there were none>
- **Decision:** confirm | decline | defer — <the human's reason, verbatim>

<This is the proposal's table plus a Decision column — the same columns, so nothing is lost in transcription. **Recommended** stays next to **Decision**: it is the only trace of whether stage 9's diagnoses are any good, and it earns its place precisely where the human overruled one. **Scope** stays because an estimate the human relied on is worth keeping when it turns out wrong.>

## Amendments

- `<path>` — <what changed: R6's criteria plus `Status: revised` and its dated marker> — `<sha>`

<"None." when the pass amended nothing.>

## Dispatch

- Item <n> → `/timone-plan <project> doc/feedback/NNN-<slug>.md` — <vehicle> — then stages 6 → 7 → 8.
- Item <n> → `/timone-verify <project> phase-NN` — <the criteria, and why>.

<"None." when nothing was dispatched.>

## Outcome

<Every item closed without remediation, with its degenerate outcome and the evidence cited by path. An intake closed entirely here is a complete pass.>

## Raised, not named

<Findings the source document carries that this invocation did not name — by reference only, untriaged. Naming one is a separate intake.>

<"None." when the source raised only what was named.>

## Surfaced, not tabled

<Defects noticed while reading the cited artifacts that nobody raised — one line each, with where they live, and where they are already tracked if they are. Candidate intakes; none was triaged, proposed or acted on. Dangling citations found in the source go here too.>

<"None." when nothing was noticed.>
```

**When the source is a GitHub PR or issue**, comment the link to the committed record ([ADR-0004](../../../doc/adr/0004-github-first-adapter-pair.md)) — `gh pr comment` / `gh issue comment` from within `projects/<name>/`. When the source is a *file* whose findings an **open** PR carries, comment there too: the record belongs where the reviewer is looking. A merged PR gets no comment. A non-GitHub `repo_url` → skip **loudly**, as stage 1 does with its fallback.

## Status reporting

Before finishing, update the target project's `STATUS.md` — on the **default branch only**, its own `docs: STATUS.md — <theme>` commit, then return the clone to the branch you found it on (`process.md`, Status reporting). Plain language: what feedback arrived, what the human decided, what was amended, what is now queued and where it will surface, and always naming which repository each item sits in. Never read it as a source of truth.

## Workflow

1. Resolve the target project (preamble), then the feedback source (gates 1 and 2). If a gate fires, stop, route, write nothing.
2. Read the named source **to its end** — reversals live in closing notes — plus the artifacts it cites. Establish live branch and PR state.
3. Layer each item, then classify it, each with a one-line rationale. Separate *raised, not named* and *surfaced, not tabled* from the item set.
4. Present the proposal table and **stop**. Nothing moves before the human answers.
5. Record every decision verbatim — confirmed, declined and deferred alike.
6. Amend intent first (PRD pair + the register's intent transition, one commit), then any confirmed record corrections on the branch determined for them. **An item confirmed as "none" executes nothing here** — its close is the record entry, and steps 6 and 8 simply have no work for it.
7. Write and commit the feedback record; push the default branch; comment the link where the rule above calls for it.
8. Dispatch: `/timone-plan` per anchoring posture, `/timone-verify` for verification passes — including the one every intent amendment owes. Never stage 6 directly.
9. Update `STATUS.md`.
10. Report per Closing below.

## Closing

**A pass has three endings, not two.** Report the one you reached.

**Ending A — a gate fired.** Which gate, why, and the exact next invocation. Nothing else applies.

**Ending B — you reached the confirmation gate.** This is the *normal* ending, because the human answers after your turn, not inside it. Report:

1. The proposal table, plus the per-item rationales and any alternatives with their prices.
2. The artifacts you read, by path — the human is being asked to trust that you did not trawl, and this is the evidence.
3. Anything **raised, not named** and anything **surfaced, not tabled**, each marked plainly as outside the item set.
4. What confirming would cause — files, branches, commits, dispatches. Report it for the slate you recommend, then say how it varies at the edges: which dispatch disappears if a group is declined, what an intent alternative would add.
5. An explicit statement that nothing has been committed, amended or dispatched, and that you are waiting on a per-item decision.

Then **stop**. Do not write the record, do not number a directory into existence, do not dispatch.

**Ending C — the human has decided and you have executed.** Report, in this order:

1. The feedback record's path **and its commit SHA**.
2. The per-item tally: confirmed / declined / deferred.
3. Every commit this pass made, with its SHA and what it changed — amendments, record corrections, and the `STATUS.md` refresh alike. A pass that amended nothing still made commits; report them rather than reporting "none". Say explicitly that the default branch was pushed.
4. Every dispatch, as the exact invocation handed over, with the chain that follows — stages 6 → 7 → 8 for plan work, stage 7 alone for a verification pass.
5. Everything closed with a degenerate outcome, and the evidence cited for it.

Stage 9 diagnoses, records and routes. It never fixes with its own hands, never verifies behaviour, never merges, and never overrides a decline. Stop here.
