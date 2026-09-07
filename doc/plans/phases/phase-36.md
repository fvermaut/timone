# Phase 36: The pull request opens on what was bent, and carries the screen

> **Status:** Planned.

> **Companion phases:** [phase-35](phase-35.md) — piece 1 of the same initiative. It built the `phase-NN-departures.md` record and taught `execution` and `verification` to write every departure — a plan or requirement amendment, a check not run, a workaround, and (via the fix-loop-exhaustion and environment-gate paths) a failing or blocked state — into that one file instead of stopping. This phase is the piece that reads it. Governing decisions: [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) — the whole shape of this phase, including the reversal of [ADR-0039](../../adr/0039-the-look-is-gated-twice.md)'s delivery-time viewing gate; [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) — why the preview address cannot be known when the pull request opens, which shapes sub-phase 36a's design; [ADR-0038](../../adr/0038-a-screens-shell-is-built-before-its-behaviours.md) — the shell-slice comparison this phase quotes but does not rebuild.

## Requirements

> **PRD:** [prd-03-a-run-ends-at-its-pull-request.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.md) — criteria in [prd-03-a-run-ends-at-its-pull-request.criteria.md](../../specs/prd/prd-03-a-run-ends-at-its-pull-request.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-03.R2 | MUST | The pull request body's first section lists every departure, or says explicitly that nothing was bent |
| PRD-03.R4 | MUST | A phase carrying a user-facing screen opens its pull request without prior human viewing; the body carries the shell slice's comparison and the preview address first-thing |

PRD-03.R1, R3 and R5 are phase 35's — already `verified`, live-gated 2026-09-07 ([phase-35-live-gate.md](reports/phase-35-live-gate.md)). This phase does not touch them.

**The ticket's third clause — closing a pull request without merging bringing the work back as a fresh request rather than patching the rejected branch — is not new work here.** It reads that way in [ticket-103's breakdown](../breakdowns/ticket-103.md) because the breakdown was written 2026-09-05, before phase 35 landed the stop-and-ask mechanism this clause turned out to describe. `poll.ts`'s `closedUnmergedComment` already asks the human which of three things a close meant (unwanted, rebuild, mistake), and a rebuild is already just the ticket losing its `timone:held` label and being picked up fresh on the next cycle (`dropped.ts`'s `heldStepWayOut`) — never a patch to the closed branch. PRD-03's own out-of-scope list names this directly: *"Patching a rejected pull request in place... When the human asks for the work to be built again it is a fresh cycle, never a patch."* That sentence describes existing, unchanged behaviour, and R1's criteria register already carries this clause as `verified`. Nothing in this phase touches `poll.ts`, `dropped.ts`, or the closed-PR path.

## Goal Description

Phase 35 made the build never stop; this phase makes the one place it does stop — the pull request — say enough for a merge to be a real decision. [ADR-0052](../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) states both remaining pieces together: *"Its body's first section lists every departure... or says explicitly that nothing was bent,"* and *"the screen viewing moves into the pull request... the PR carries the preview address and the built-versus-reference comparison first-thing."* Both land in the same file, in the same part of the pull request body, so this phase treats them as one sub-phase rather than splitting them across two — a split would have two independent sub-agents editing the same template block, one blind to the other's placement decisions.

**What phase 35 already built and this phase only reads.** Every departure — a plan or requirement amendment, a check `verification` could not run, a workaround, and the fix-loop-exhaustion or environment-gate outcome that leaves criteria `failed` or BLOCKED — already lands in `phase-NN-departures.md`, one dated entry per event, created on the first departure and otherwise absent. This phase does not add a second departure source: PRD-03.R2's "a failing state if there is one" is already an entry `verification` writes into that same file (sub-phase 35c), so the pull request's opening section is a straight read of one file, never a synthesis across two.

**What does not clear the ADR bar.** The one real design question this phase has to answer is how a pull request that opens immediately (R1, phase 35 — no waiting, ever) can carry a preview address that a Docker build has not produced yet. [ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md) already answered the shape of that problem for a different surface: a preview is reconciled asynchronously by the poll loop, `ensure()` owns when it is ready, and *"R8 asks only for a per-PR URL on the PR comment"* — a preview never blocks delivery, and a failed one is posted, not withheld. Two ways to give the pull request body a real address at open time were considered and rejected without a decision record: making delivery call `ensure()` synchronously and wait (reintroduces exactly the kind of wait ADR-0052 removed, and duplicates lifecycle ownership ADR-0021 already gave to the poll loop) and adding a new "edit an open pull request's body" capability to `TicketingAdapter` so the poll loop can inject the address once ready (a twelfth capability on a seam ADR-0021's own text treats as deliberately small, solving a problem the seam's existing vehicle — the PR comment — already solves). Neither is hard to reverse, surprising against what ADR-0021 already decided, or a real trade-off once stated: the existing comment-posting mechanism already tells a reviewer where the address will appear, so the pull request's screen section names that mechanism by pointing at it — *"building now, the address lands in a comment on this pull request"* — rather than requiring the literal string to exist at the moment `gh pr create` runs. The comparison half of R4 (the shell slice's difference list) carries no such problem: it is static, already recorded in the completion report before delivery starts, and is quoted into the body directly.

**This phase owes a live gate before delivery.** PRD-03.R2 and R4 are both `Verify-via: live`, and their declared dependencies — `src/daemon/` and `.claude/skills/timone-deliver/` — overlap this phase's diff on the skill file even though `src/daemon/` itself is untouched (per [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4, a dependency list is read as OR across its comma-separated paths). Both criteria stay `draft` until a live gate has driven a real delivery — one with a screen and at least one departure, to exercise both sections at once — and watched the pull request body open with the two sections first-thing, before `## Scope`.

## Context & Prerequisites

- **[phase-35](phase-35.md) / [phase-35-complete.md](reports/phase-35-complete.md)** — the `phase-NN-departures.md` convention and template (Sub-phase 35b), and delivery's Gate 3 already drawing its verdict table from the verification report regardless of outcome (Sub-phase 35d). This phase's Gate 4 rewrite sits right next to that Gate 3 text.
- **`.claude/skills/timone-deliver/SKILL.md`** — Gate 4 (`### 4 — Look gate`, current text: a phase with a screen "does not get a pull request until the human has seen the built screen beside its reference and said yes"), the delivery report template's `**Look gate:**` field, the PR body template (`Delivers **phase NN**...` through `## Scope`), and the numbered `## Workflow` list.
- **[ADR-0038](../../adr/0038-a-screens-shell-is-built-before-its-behaviours.md) / [ADR-0039](../../adr/0039-the-look-is-gated-twice.md)** — the shell slice's fresh-context comparison against its reference (ADR-0039 check 1) is untouched by this phase and stays blocking at execution time; only check 2 (the pre-PR human viewing) is what ADR-0052 reverses. The reference a shell slice was compared against — the kept prototype, or `doc/design.md` — is named in that phase's own shell sub-phase per ADR-0038's "name the reference in the slice" rule; this phase's Gate 4 reads that name rather than re-deriving it.
- **`src/daemon/poll.ts`'s `previewComment`/`reconcilePreviews`** — existing, unmodified by this phase. The screen section's preview line points at this mechanism; it does not duplicate or replace it.
- **`process.md` stage 8 note** (the paragraph beginning "**8 — Delivery.**") and the "**How to try it**" paragraph — written last, once the skill file has settled the actual template shape.

## Sub-phases

### Sub-phase 36a: The pull request body opens on departures and, when there is a screen, its comparison

**[MODIFY]** `.claude/skills/timone-deliver/SKILL.md`:

- **Gate 4**, currently titled `**4 — Look gate.**` with the blocking behaviour described in the "Read before you plan" section above: replace the whole gate with a non-blocking one. New shape:
  - Rename to `**4 — The screen.**`
  - No screen in the phase → skip entirely, and say so in the delivery report (unchanged from today).
  - A screen in the phase → this gate no longer asks a human anything and no longer refuses on "no". It has exactly one refusal left: the phase's completion report carries no shell-slice comparison at all (not a difference explained — an outright absence, meaning [ADR-0038](../../../doc/adr/0038-a-screens-shell-is-built-before-its-behaviours.md)'s shell gate never ran or was never recorded). That is a missing artifact, not a departure: refuse, and route to `timone-execute`, naming the sub-phase whose validation should have produced the list.
  - Otherwise: read the shell slice's recorded difference list and the reference it names from the completion report, and carry both into the PR body's screen section (below).
  - State explicitly that this reverses only the delivery-time half of [ADR-0039](../../../doc/adr/0039-the-look-is-gated-twice.md); the shell slice's own fresh-context comparison (that ADR's check 1) is unaffected and still blocks at execution time under stage 6's bounded retries.
- **The delivery report template**: replace the `- **Look gate:** <...> — [ADR-0039](...)` field with a `- **Screen:**` field carrying one of: `"no user-facing screen in this phase"`, or `"no prior viewing — the shell slice's comparison and the preview are carried in the pull request body"` — cite [ADR-0052](../../../doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md).
- **The PR body template**: insert two new sections immediately after the `Delivers **phase NN — <theme>**...` opening line and before `## Scope` — this is the body's first content, ahead of everything else:

    ```markdown
    ## Departures

    <Every entry in `phase-NN-departures.md`, quoted in full — kind, agreed, did instead, why. When the file does not exist: the sentence "Nothing was bent building this phase." verbatim.>

    ## The screen

    <Omit this whole section when the phase built no user-facing screen.>

    Compared against <the reference the shell slice named>, recorded when that slice closed:

    <the shell slice's difference list, quoted from the completion report>

    **Preview:** <"this project has no preview configured for pull requests — see the local checkout steps below" when the project has no `bindings.preview` in `timone.yaml`, otherwise "building now — the machine posts its address in a comment on this pull request as soon as it is ready, usually within a few minutes.">

    No prior viewing: merging this pull request is the yes.
    ```

- **The `## Workflow` numbered list**: insert a step between the existing steps for writing the "How to try it" section and opening the PR — composing the Departures section (always) and the screen section (when the phase carries one) as the first content written into the body, reading `phase-NN-departures.md` and the completion report respectively.

**No behaviour-carrying code in this sub-phase** — it is a skill-instruction and template change; validation is checklist-based.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
grep -n "does not get a pull request until the human has seen" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "seen and approved by" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "^## Departures" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "^## The screen" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "\*\*Screen:\*\*" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "the shell slice's own validation should have produced this list\|naming the sub-phase whose validation should have produced" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
grep -n "posts its address in a comment on this pull request" .claude/skills/timone-deliver/SKILL.md; echo "exit: $?"
```

- [ ] First two greps exit 1 — the old blocking gate text and its "seen and approved by" field value are gone
- [ ] Next three greps exit 0 — the two new PR body sections and the new report field are documented
- [ ] Sixth grep exits 0 — Gate 4's one surviving refusal (missing shell comparison, routed to `timone-execute`) is present
- [ ] Seventh grep exits 0 — the screen section's preview wording points at the existing comment mechanism rather than requiring the literal address at open time
- [ ] Gate 4's new text names which half of ADR-0039 it reverses and which half (the shell slice's own comparison) is unaffected (diff review, not a probe — short section)
- [ ] Gates 1, 2, 3 and 5 are byte-identical to before this sub-phase (diff review)

---

### Sub-phase 36b: `process.md` describes the pull request that carries the judgement

> Sub-phase 36a must be complete before starting this sub-phase — it documents the shape 36a built, not a shape being designed here.

**[MODIFY]** `process.md`:

- The **stage 8 note** (the paragraph beginning "**8 — Delivery.**"): remove the sentence describing the pre-PR viewing gate ("a phase carrying a user-facing screen does not get its pull request opened until the human has seen the built screen beside its reference and said yes, and the delivery report records that they did") and its immediate ADR-0039 framing. Replace with a short description: the pull request body opens on two sections before `## Scope` — the departures section (every entry from `phase-NN-departures.md`, or an explicit statement that nothing was bent) and, when the phase carries a screen, that screen's comparison against its reference plus the preview address (or where it will appear) — citing [ADR-0052](doc/adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) as the decision and naming that it reverses only the delivery-time half of [ADR-0039](doc/adr/0039-the-look-is-gated-twice.md), whose execution-time shell comparison (stage 6's note, already describing it) is unaffected. Update the "**Gate order**" sentence at the end of the paragraph to describe gate 4 as refusing only on a missing shell-comparison record, not on an unviewed screen.
- The **"How to try it"** paragraph: add one clause noting the departures and screen sections, when present, precede these steps in the body's final order.

**No behaviour-carrying code in this sub-phase** — validation is checklist-based.

#### Agent Validation Steps

```bash
grep -n "does not get its pull request opened until the human has seen" process.md; echo "exit: $?"
grep -n "PRD-03.R2\|PRD-03.R4" process.md; echo "exit: $?"
grep -n "phase-NN-departures.md" process.md; echo "exit: $?"
```

- [ ] First grep exits 1 — the old pre-PR viewing description is gone from the stage 8 note
- [ ] Second and third greps exit 0 — the new description is present and cites the departures file already documented in "Artifact conventions" (added by phase 35e; this sub-phase does not duplicate that entry)
- [ ] The "Gate order" sentence reads correctly against Gate 4's new text from 36a (diff review)
- [ ] Every other stage's note is byte-identical to before this sub-phase (diff review)

---

## Dependency graph

```
36a → (none)   deliver: Gate 4 rewritten, PR body opens on Departures + The screen, report template field renamed
36b → 36a      process.md describes the finished shape
```
