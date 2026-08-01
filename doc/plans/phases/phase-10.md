# Phase 10: Feedback — `timone-improve` and the remediation loop

> **Status:** Approved for execution by fvermaut 2026-08-01

> **Companion phases:** [Phase 02](phase-02.md) (skill authoring conventions — the mandatory target-project resolution preamble, and the artifact rule this phase reconciles a fourth time), [Phase 05](phase-05.md) (triage's routing table sends "bug / post-delivery observation" here; its fixture records are this phase's oldest intake), [Phase 07](phase-07.md) (the execute machinery every code remediation is dispatched through), [Phase 08](phase-08.md) (stage 7's fix-loop shape, its REGRESSION label — which stage 9 "reads differently" — and its loop-exhaustion route, which lands here), [Phase 09](phase-09.md) (the delivery review whose findings are this phase's richest intake, and the re-delivery iteration mechanics a remediation on an open PR rides). Governing decisions: [ADR-0004](../../adr/0004-github-first-adapter-pair.md) (GitHub-first — when the feedback's source is a PR or issue, the record links back to it), [ADR-0006](../../adr/0006-specs-in-repo-single-source-of-truth.md) (the PRD pair is the single source of truth for intent — which is why intent changes amend it before any code moves, and why the feedback record is a committed artifact rather than PR prose), [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (sessions at the timone root; the skill resolves a target project and works only inside `projects/<name>/`).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line) |
| ---------- | -------- | ---------------------- |
| PRD-01.R14 | MUST     | Improve skill: on post-delivery feedback, classify the layer (intent change vs implementation gap) and the remediation (bug fix / refinement / plan patch / new sub-phase / new phase / report amendment), amend the PRD (stable IDs, revised/deprecated markers) when intent moved, and execute the remediation only after user confirmation |

R14 is the last MUST with no skill behind it — stage 9 is the one gap between "work merges" and "the process is closed end to end"; stages 10 and 11 are post-MVP by PRD-01's own out-of-scope list. Deliberately out of scope here: R23 (onboarding repair — plannable but a separate concern), R24 (barred from planning until a `timone-grill` session rewrites its criteria), and the deployment/maintenance skills.

## Goal Description

Every stage now routes *to* stage 9 and nothing exists there to receive the traffic. Triage sends bugs and post-delivery observations to it (`scratch-app` has carried a routed bug record since 2026-07-19). Verification's loop exhaustion "goes to the human via stage 9". Delivery refuses `failed` registers toward it, raises its Standards-axis refactorings "for stage 9", and its Closing tells the human `/timone-improve <project> <what to act on>` — with a parenthesis admitting the skill does not exist. Stage 5 defers "post-delivery plan changes" to stage 9's plan patch. Four stages have written cheques against this phase.

**The fixture is the opposite of phase 09's problem — unusually rich, and none of it synthetic.** Waiting on `scratch-app`: a routed bug report that predates the build (triage 001 — the reported divergence has since been built correctly and verified, making it a genuine already-resolved intake, not a failure to provoke); PR #1's nine review findings, merged unaddressed **by design** as this phase's working material (six Standards — refinement-shaped; three Spec — one bug-shaped, one intent-shaped, one register-state); PR #2's four findings on a still-open PR (two Standards; two Spec, of which one is a report amendment whose direction the deliverer's note already reversed, and one recommends taking unknown-id behaviour "back through the requirements stage" — an intent amendment in the making); and the 2 ms latency-budget decision. The handover's instruction stands: **do not spend these by hand** — they are the first genuine post-delivery feedback the workspace has ever held, and stage 9's dry run is what they were saved for.

**The load-bearing decision: stage 9 routes; it never implements.** The temptation is a skill that "just fixes the bug" — and every rule the last three phases fought for says no. Code committed by stage 9 would be code no verification pass has seen and no delivery review has read: the exact hole phase 09 closed when it forbade delivery to refactor, reopened one stage later. So `timone-improve` commits **documents only** — the feedback record, PRD amendments, report amendments, `STATUS.md` — and every code remediation is dispatched through the stages that already exist: stage 5 shapes it, stage 6 builds it, stage 7 proves it, stage 8 presents it. The classification is the *diagnosis*; the existing pipeline is the *treatment*. This costs ceremony on a one-line fix, and buys the invariant that no code lands unverified and unreviewed — the ceremony is one sub-phase in a plan file, which is cheap; the invariant is the product.

**Second decision: the confirmation gate is stage 9's own, and it is not stage 5's approval.** R14's criterion is explicit — remediation executes only after user confirmation. That confirmation answers *"is this the right response to the feedback?"* (right layer, right classification, right scope). Stage 5's gate still answers *"is this breakdown executable?"* for whatever plan work the confirmation dispatches. Two gates, two questions; collapsing them would let a feedback conversation silently approve a plan nobody has read.

**Third: intent transitions expose a latent register contradiction, and this phase resolves it.** Stage 7's note claims "only this stage writes the register's `Status` field" — while the stable-ID section prescribes `Status: revised` on intent change, which is exactly stage 9's move. Both cannot stand as written. The resolution: **verdict transitions** (`draft`/`verified`/`failed`, evidence-driven) remain stage 7's exclusively; **intent transitions** (`revised`, `DEPRECATED`) are stage 9's, made in the same commit as the PRD amendment that motivates them. A `revised` criterion drops out of the derived regression set until re-verified — its old evidence is stale by definition, which is the point of marking it.

## Context & Prerequisites

- **Phase 02** — `.claude/skills/README.md`: frontmatter rules, the six-step target-project resolution preamble (copy it verbatim), and the artifact rule 10a reconciles a fourth time: what stage 9 may commit.
- **Phase 09** — `.claude/skills/timone-deliver/SKILL.md` is the nearest house-style template (terminal gates that route and write nothing, contract-shaped sub-agent sections, inline fenced templates, a Closing naming successors). Its Closing and `timone-verify`'s § fix-loop note both say `timone-improve` "does not exist yet — it arrives in phase 10"; 10b retires both.
- **`process.md` stage 9** — normative but one paragraph; 10a expands it with gate semantics and required elements only. Document layout belongs to the skill, per the division phases 05–09 established.
- **`process.md` cross-references that already point here** — stage 1's routing table, stage 5's "post-delivery plan changes are stage 9's plan patch", stage 6's "stage 9 remediates", stage 7's REGRESSION note and loop-exhaustion route, stage 8's `failed`-register refusal route. 10a must land decisions consistent with all five; none of those sentences should need to move.
- **The fixture** — `projects/scratch-app`: `doc/triage/001-completed-todos-reappear-after-reload.md` (kind: bug, entry point: stage 9, dated before the build; R2 has since been `verified` with evidence); [phase-01-delivery.md](../../../projects/scratch-app/doc/plans/phases/reports/phase-01-delivery.md) (6 Standards + 3 Spec findings, PR #1 **merged** 2026-07-29 with all nine unaddressed); [phase-02-delivery.md](../../../projects/scratch-app/doc/plans/phases/reports/phase-02-delivery.md) (2 + 2 findings, [PR #2](https://github.com/fvermaut/scratch-app/pull/2) **open**, base retargeted to `main`); the 2 ms latency-budget decision (three options in that project's `phase-02-verification.md`); R7's screen-reader HUMAN-CHECK, open on merged code.
- **No missing prerequisite.** `gh` is installed and authenticated, the fixture is GitHub-hosted, and every artifact the intake references already exists.

## Sub-phases

### Sub-phase 10a: process-spec amendment — stage-9 decisions

**[MODIFY]** `process.md` — expand the stage-9 note with ten decisions, resolve the register-write contradiction in stage 7's favour-with-a-carve-out, and add one line to the artifact conventions. Keep `process.md` thin: gate semantics and required elements, never document layout.

1. **Intake — what stage 9 admits.** Post-delivery feedback on a managed project, arriving as: a triage record routed here (stage 1's bug / post-delivery observation); delivery-review findings the human names for action; a stage-7 loop-exhaustion or BLOCKED hand-off, or a register line at `failed`; the outcome of a performed HUMAN-CHECK; or free-form human reaction to delivered work. **Input resolution never hunts:** the invocation names the project and the feedback source — a record path, a PR or finding reference, or the feedback text itself; reading the named source in full is resolution, trawling for unnamed grievances is not. Stage 9 never manufactures feedback.
2. **The feedback record is the stage's artifact.** `doc/feedback/NNN-<slug>.md` in the target project — NNN zero-padded, allocated by scanning, exactly as `doc/triage/` does — one record per intake (an intake may bundle many findings from one source), carrying the source, the per-item triage table (layer / classification / proposed remediation / human decision), amendments made, and the dispatch trace. This record *is* the process table's "iteration report". When the source is a GitHub PR or issue, a comment links the committed record (ADR-0004); the record itself is always the committed file (ADR-0006). Artifact conventions gain the `doc/feedback/NNN-<slug>.md` line.
3. **Layer triage first, and it admits three answers.** *Does this change what we want (intent), how it was built (implementation), or neither — the record is wrong (the artifacts misdescribe what exists)?* The third answer routes straight to report amendment; feedback like PR #2's stale-standards finding is neither a requirements change nor a code change, and forcing it through the two-way question trains agents to shrug one way silently. A batch is layered item by item, never wholesale.
4. **Intent moves the PRD before any code moves.** Same ID forever, criteria updated in place, `Status: revised` (or `DEPRECATED` with a one-line reason), dated ✏ marker naming the feedback record. **Register carve-out:** verdict transitions (`draft` / `verified` / `failed`) remain stage 7's exclusive writes; intent transitions (`revised`, `DEPRECATED`) are stage 9's, made in the same commit as the PRD amendment they belong to — stage 7's "only this stage writes the register" is corrected to say verdicts. A `revised` criterion leaves the derived regression set until stage 7 re-verifies it against its new wording; its old evidence is stale by construction.
5. **Classification is one of six, each with a defined vehicle.**
   > ✏ Refined 2026-08-02 (10c round 1 — **scope change, needs fvermaut's agreement**): the six are **seven**. Three of the four dry runs independently hit the same wall — the *record* layer had exactly one class, `report amendment`, defined over "a completion, verification or delivery report", and the artifacts that actually misdescribed reality were `doc/standards.md` (runs 3 and 4) and `prisma/schema.prisma` (run 2). Two changes: **report amendment** widens to **record correction** over any committed *process artifact*; and a seventh class, **verification pass**, dispatches to stage 7 the items only observed behaviour can settle — an unperformed HUMAN-CHECK, a criterion left `revised` by an intent amendment, a stale register evidence note. Without the seventh, run 2's item 9 and run 3's intent route had a correct diagnosis and no legal vehicle. Also recorded here: two boundaries the record layer needs — a misdescribing *code* comment dispatches as a refinement (stage 9 never commits code), and a register *evidence* note is stage 7's to fix, not stage 9's.
 **Bug fix** — behaviour diverges from an unchanged requirement (a REGRESSION arriving from stage 7 defaults here). **Refinement** — requirements met, quality improvable; the delivery Standards axis's native output; rides as un-anchored work protected by the regression set. **Plan patch** — an existing plan file is wrong; stage 5's amendment rules apply, with their own re-approval semantics. **New sub-phase** — scope grows within a phase whose branch is still open. **New phase** — scope grows beyond one. **Report amendment** — the record misdescribes reality; a docs-only correction naming its evidence. Classification decides nothing about priority — that is the human's, at the gate.
6. **The confirmation gate.** Stage 9 proposes — per item: layer, classification, vehicle, scope — and stops. The human's decision per item is **confirm, decline, or defer**; declined and deferred items are recorded in the feedback record with the human's reason, not argued with and not silently dropped. Only confirmed items move, and nothing moves before the gate. The confirmation is stage 9's gate, not stage 5's: plan work it dispatches still faces stage 5's own approval.
7. **Stage 9 routes; it never implements.** It commits documents only: the feedback record, PRD-pair amendments, report amendments, `STATUS.md`. Every code remediation is dispatched — plan-file vehicles to stage 5, then through stages 6 → 7 → 8 as any work; no code lands unverified, and delivery remains where a human judges code. (The skills-README artifact rule is reconciled a fourth time to say so.)
8. **The vehicle follows the branch state.** Feedback on a phase whose PR is **open**: the remediation lands on that phase — plan amendment per stage 5's rules, execution on the same branch, stage 7 re-verifies, stage 8 re-delivers as an iteration of the existing PR. Feedback on **merged** work: a new phase file, new branch, new PR — the merged branch is history and history is never rewritten. Report amendments follow the report: a report living on an open branch is corrected there (and a process-artifact-only change does not re-run the delivery axes, per stage 8's subject rule); a merged report is corrected on the default branch or the next relevant branch.
9. **Degenerate outcomes are outcomes.** *Already resolved* (triage 001 — the divergence was built away and verified since), *not reproducible*, *working as intended* (the requirement says what the reporter wishes it didn't), and *declined by the human* all close the intake with the evidence cited — the register's and reports' existing evidence, never a fresh behaviour probe, because behaviour evidence is stage 7's. An intake closed with remediation "none" is a completed stage-9 pass, not a failure of one.
10. **What stage 9 never does:** never merges, never verifies behaviour, never commits application code, never writes verdict transitions, never manufactures feedback, never overrides a decline. And it is for managed projects only — feedback on Timone itself stays hand-run, as Timone's own planning already is.

**[MODIFY]** `.claude/skills/README.md` — the fourth artifact-rule reconciliation: stage 9 (`timone-improve`) commits the feedback record, PRD-pair amendments, report amendments and `STATUS.md`; it never commits application code, plan execution, or verdict transitions. Forbidden-in-every-case unchanged (PRD-01.R4).

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
grep -n "feedback\|revised\|DEPRECATED\|doc/feedback" process.md
grep -n "only this stage writes\|verdict" process.md
grep -n "timone-improve" .claude/skills/README.md
git -C . diff --stat
```

- [ ] Stage-9 note states all ten decisions: intake sources and no-hunting resolution; the feedback record with its numbering, GitHub link-back and artifact-conventions line; three-answer layer triage; PRD-before-code with the register carve-out; the six classifications with vehicles; the confirm/decline/defer gate distinct from stage 5's; routes-never-implements; the open-vs-merged vehicle rule; degenerate outcomes; the never-list including managed-projects-only
- [ ] Stage 7's register-exclusivity sentence now says **verdict** transitions; nothing else in stage 7 moved
- [ ] The stable-ID section and the new stage-9 note agree verbatim on `revised` / `DEPRECATED` mechanics
- [ ] Stage 1, 5, 6 and 8's existing pointers at stage 9 stand unmodified and consistent with the new note
- [ ] `process.md` gained no feedback-record or proposal *template* (those belong to the skill)
- [ ] `.claude/skills/README.md`'s artifact rule covers stage 9, forbids stage-9 code commits, and still matches R4's wording

---

### Sub-phase 10b: `timone-improve` skill

**[NEW FILE]** `.claude/skills/timone-improve/SKILL.md`
**[MODIFY]** `.claude/skills/timone-deliver/SKILL.md` — its Closing names `/timone-improve` and then concedes it "does not exist yet — it arrives in phase 10"; drop the concession.
**[MODIFY]** `.claude/skills/timone-verify/SKILL.md` — the same concession in its fix-loop note (§4); drop it there too.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based, with the real test deferred to 10c.

> Sub-phase 10a must be complete before starting this sub-phase (spec wins; the skill restates it).

Per `process.md` stage 9, with the standard target-project resolution preamble from `.claude/skills/README.md` — managed projects only. Input: a project name plus a feedback source (record path, PR/finding reference, or the feedback itself). The skill:

1. **Opens with the stance** — feedback is the process listening; the skill diagnoses and proposes, the human decides, the existing stages treat. It never fixes anything itself, and a closed intake with no remediation is a success, not a shrug.
2. **Fires its gates in order**, each terminal, each naming where to route, none writing anything: input resolution (never pick a feedback item for the user; never trawl) → unknown or unreadable source → project checks per the preamble.
3. **Reads the named source in full**, plus the artifacts it cites — the register, the delivery/verification reports, the phase file's Status and requirements header. It never reads application source or diffs: classification is about what the feedback *means*, and behaviour evidence is stage 7's. Where a finding's own text already carries a deliverer's correction (PR #2's reversed direction), the correction is part of the source.
4. **Triages layer, then classifies**, item by item, against 10a's three-answer question and six classes, each with a one-line rationale — the same discipline as `timone-triage`, which is the house pattern for recorded classification.
5. **Proposes and stops.** The proposal table carries layer / class / vehicle / scope per item, with recommended decisions. Confirm, decline, defer — recorded verbatim with the human's reasons.
6. **Executes documents itself, dispatches everything else:** PRD amendments (stable IDs, `revised` / `DEPRECATED`, dated markers, register intent-transitions in the same commit), report amendments on the branch the report lives on, then hands plan-file vehicles to `/timone-plan <project> <feedback-record>` and names the 6 → 7 → 8 chain that follows. It never invokes execution directly — planning's gate is not its to skip.
7. **Writes the feedback record** as the durable trace of all of the above, commits it `docs: feedback NNN — <slug>`, comments the link when the source is a GitHub PR or issue.
8. **Updates `STATUS.md`** in the managed project's terms, on the default branch only, per the every-stage obligation.

The skill carries two inline fenced templates (house style — no bundled reference files): the **feedback record** (source, per-item triage table, decisions verbatim, amendments, dispatch trace) and the **proposal table** presented at the gate.

Closing: report the record's path, the per-item decision tally (confirmed / declined / deferred), every amendment committed with its SHA, every dispatch with the exact `/timone-plan` invocation handed over, and anything closed with a degenerate outcome and its cited evidence.

#### Agent Validation Steps

```bash
head -6 .claude/skills/timone-improve/SKILL.md
grep -n "intent\|implementation\|record\|revised\|DEPRECATED" .claude/skills/timone-improve/SKILL.md | head -20
grep -n "confirm\|decline\|defer\|dispatch\|timone-plan" .claude/skills/timone-improve/SKILL.md | head
grep -n "does not exist" .claude/skills/timone-deliver/SKILL.md .claude/skills/timone-verify/SKILL.md
grep -rn "timone-improve" .claude/skills/*/SKILL.md | grep -v "improve/SKILL" | head
```

- [ ] Frontmatter + targeting per `.claude/skills/README.md` (`argument-hint` starts with `<project-name>`, then the feedback source)
- [ ] Stage-9 rules restated with no variants: intake, three-answer layer triage, six classes with vehicles, PRD-before-code, register carve-out, confirm/decline/defer, routes-never-implements, open-vs-merged, degenerate outcomes — all matching 10a exactly
- [ ] All gates are terminal, write nothing, and name the route
- [ ] The skill never reads application source or diffs, never commits code, never writes verdict transitions, never merges, never invokes stage 6 directly
- [ ] Both inline templates present; the record template carries decisions verbatim, not summarized
- [ ] No skill anywhere still claims `timone-improve` does not exist

---

### Sub-phase 10c: dry run — the fixture spends its savings

**Seams under test (TDD):** this sub-phase writes no Timone code; its "seam" is the observable end state of each run, asserted below.

> Sub-phases 10a and 10b must be complete before starting this sub-phase.

From fresh timone-root sessions, against `projects/scratch-app`. R14's own hint is the run design: *"feed it one bug report and one 'works as planned but not what I meant' case; check the two route differently and the PRD is touched only in the second."* Both cases exist for real.

1. **The routed bug — triage 001.** Invoke with the record `timone-triage` wrote in 2026-07-19 and routed here; that is the from-triage evidence, and no separate machinery exists to test. The reported divergence (completed todos reappearing after reload) was built correctly eight days later and R2 is `verified` with evidence. Expect: layer **implementation**, and the degenerate outcome **already resolved**, closed citing the register and verification report — no fresh behaviour probe, no PRD touch, no dispatch. A feedback record exists, numbered by scan, and the intake is complete.
2. **The batch — PR #1's nine findings.** Invoke naming the phase-01 delivery report. Expect: nine items triaged and classified individually (the plausible readings: the six Standards findings as **refinements**; Spec 1 as the run's live intent-vs-implementation question — R6's "immediately" either sharpened by fvermaut into a PRD amendment or held as an implementation gap; Spec 2 as **bug fix**-shaped; Spec 3 as **report amendment** / plan-patch territory — but the *classification is the run's output, not this plan's*: what is asserted is that each item gets a layer, a class, a vehicle and a rationale, and that **nothing executes before the gate**). fvermaut confirms, declines or defers each — declining most is a fine outcome and exercises the recording of it. Expect the PRD untouched unless and until an item is confirmed as intent.
3. **The intent case — PR #2 Spec finding 2.** The finding itself recommends taking unknown-id behaviour on R2/R3 "back through the requirements stage". If fvermaut confirms it as intent: expect the PRD pair amended **first** — same IDs, criteria gaining the unknown-id clause, `Status: revised`, dated markers naming the feedback record — the register intent-transition landing in the same commit, R2/R3 leaving the derived regression set, and only then any dispatch. This is the run that discharges the hint's "PRD is touched only in the second" clause against run 1.
4. **A report amendment executed — PR #2 Spec finding 1, direction reversed.** The stale `doc/standards.md` open non-conformance line sits on the still-open phase-02 branch; the deliverer's note already established the truth (the fix landed in the base as `fa0da1c`). Expect: layer **record**, the amendment committed on that branch, and stage 8's re-delivery iteration on PR #2 with the axes **not** re-run — a process-artifact-only change, per the subject rule. One run exercises the open-branch vehicle, the report-amendment class and the stage-8 iteration in a chain.
5. **One code remediation dispatched end to end.** From run 2's confirmed items, fvermaut picks **one** (the cache-tag constant and the focus-successor extraction are the natural candidates — small, real, refinement-shaped, on merged code). Expect: stage 9 hands `/timone-plan` the feedback record; a new phase file on `scratch-app` (merged-work vehicle: new phase, new branch), stage 5's own approval gate, then 6 → 7 → 8 to a new PR whose Spec axis sees an un-anchored refinement and whose regression set protects R1–R6. This is the run that proves the loop *closes* — feedback in, reviewed PR out — and it is deliberately bounded to one item.

Then: `git log --stat` in the fixture — no skill files, no harness config, no timone internals (R4 regression check, now that a fourth skill writes into a client repo), and no application-code commit authored by stage 9 anywhere.

Explicit non-goals: **nothing merges** — PR #2 and run 5's PR stay open for fvermaut. **The nine findings are not all remediated** — the human's confirm/decline/defer is the point, not a completion quota; deferred and declined items remain in the feedback record as the durable trace. **No synthetic feedback** — the same position phases 07–09 took, upheld each time: the fixture's real material is strictly better than anything manufactured. **The latency-budget decision is not forced** — if fvermaut settles it during run 2's gate it flows as a normal item; if not it stays deferred, which the record can now represent.

#### Agent Validation Steps

```bash
ls projects/scratch-app/doc/feedback/
grep -n "Layer\|Class\|confirm\|decline\|defer" projects/scratch-app/doc/feedback/*.md | head -20
grep -n "revised" projects/scratch-app/doc/specs/prd/prd-01-todo-list.criteria.md
cd projects/scratch-app && gh pr list --state open
gh pr view 2 --json comments --jq '.comments[-1].body' | head -5
# Failure probe: stage 9 must not have committed application code
git log --stat --grep "feedback" -- ':!doc' ':!STATUS.md'; echo "exit: $? (no files listed = clean)"
# Failure probe: no skill, harness or timone-internal file in the fixture's history
git log --stat | grep -E "\.claude/|timone\.yaml"; echo "exit: $? (1 = clean, as required)"
```

- [ ] Run 1: closed **already resolved**, citing register evidence; no probe, no PRD touch, no dispatch; the record exists and is numbered by scan
- [ ] Run 2: nine items individually layered, classified and vehicled with rationales; nothing executed before the gate; every decline and defer recorded verbatim
- [ ] Run 3: PRD amended before anything else — stable IDs, `revised`, dated markers, intent-transition in the same commit; R2/R3 out of the derived regression set
- [ ] Runs 1 vs 3 discharge R14's hint: the bug and the intent case routed differently, and the PRD was touched only in the second
- [ ] Run 4: record-layer amendment on the open branch; PR #2 iterated; axes not re-run
- [ ] Run 5: dispatch went through `/timone-plan` with its own approval gate, and the chain closed at a new PR; stage 9 authored no code commit
- [ ] The fixture's history shows no skill/harness/internal files and no stage-9 code commit
- [ ] Defects found are fixed in `timone-improve` (and in `process.md` when the spec is what was wrong, never by bending the skill around it)
- [ ] **Human gate:** fvermaut confirms the classifications were honest, the gate held (nothing moved unconfirmed), and the record reads as the durable trace; this gate is R14's evidence

---

### Sub-phase 10d: documentation

**[MODIFY]** `README.md` — add `/timone-improve <project-name> <feedback-source>` to the "Working with Timone" command list; update the Status paragraph.
**[MODIFY]** `doc/specs/prd/prd-01-process-layer.criteria.md` — flip R14 to `verified` once 10c's human gate passes.
**[MODIFY]** `STATUS.md` — Timone's own, per the every-stage obligation: the "one real gap" framing retires; what remains is post-MVP stages, R23, R24 and the inverted loop (PRD-02).

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "timone-improve" README.md
grep -n -A3 "^## R14" doc/specs/prd/prd-01-process-layer.criteria.md
grep -n "gap\|feedback" STATUS.md | head
```

- [ ] Documented invocation matches actual behaviour; links resolve
- [ ] R14 flipped only after 10c's human gate passed
- [ ] The Status paragraph names what remains: R23, R24 (still awaiting its grill session), deployment/maintenance, and the PRD-02 inverted loop as the next horizon
- [ ] `STATUS.md` retires the "one real gap" entry and names the fixture PRs still waiting on fvermaut

## Dependency graph

```
10a → (none)      process.md: stage-9 decisions (intake, feedback record, three-answer layer triage, PRD-before-code
                  + register carve-out, six classes with vehicles, confirm/decline/defer gate, routes-never-implements,
                  open-vs-merged vehicle rule, degenerate outcomes, never-list); skills-README fourth reconciliation
10b → 10a         timone-improve skill; retire both "does not exist yet" concessions (deliver Closing, verify §4)
10c → 10a, 10b    dry run: 5 runs (routed bug → already-resolved; the nine-finding batch; the intent amendment;
                  the report amendment + PR #2 iteration; one dispatch closed end to end), human gate = R14 evidence
10d → 10c         docs last + R14 → verified
```
