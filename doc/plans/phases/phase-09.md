# Phase 09: Delivery — `timone-deliver` and the two-axis review

> **Status:** Complete — see [reports/phase-09-complete.md](reports/phase-09-complete.md). Approved for execution by fvermaut 2026-07-28; 09b's, 09e's and 09f's gates passed by fvermaut 2026-07-29.

> **Companion phases:** [Phase 02](phase-02.md) (skill authoring conventions — the mandatory target-project resolution preamble, and the artifact rule this phase reconciles a third time), [Phase 03](phase-03.md) (the standards library's authorship model — agent-drafted from cited primary sources, human-approved — which 09b obeys), [Phase 07](phase-07.md) (its branch conventions are what the PR must match, and its deferred refactorings are 09e's Standards-axis material), [Phase 08](phase-08.md) (its output is this phase's only input: the verification report and register statuses are the stage-7→8 interface; its `timone-verify` Closing carries the defect 09c fixes). Governing decisions: [ADR-0004](../../adr/0004-github-first-adapter-pair.md) (GitHub + GitHub Issues as the first adapter pair, pull requests as the review surface — the reason the platform gate refuses rather than improvises), [ADR-0006](../../adr/0006-specs-in-repo-single-source-of-truth.md) (specs live in the repo — the reason both review reports are committed artifacts and not merely PR prose), [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (sessions run at the timone root; the skill resolves a target project and works only inside `projects/<name>/`), [ADR-0009](../../adr/0009-cli-first-agent-tooling-mcp-for-the-gap.md) (CLI-first tooling — delivery is `gh`, with no MCP gap to fill).

## Requirements

> **PRD:** [prd-01-process-layer.md](../../specs/prd/prd-01-process-layer.md) — criteria in [prd-01-process-layer.criteria.md](../../specs/prd/prd-01-process-layer.criteria.md)

| ID         | Priority | Requirement (one line)                                                                                                                                   |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD-01.R13 | MUST     | Deliver skill: on a completed and verified phase, a pull request exists referencing the driving ticket/requirements, its description summarizes scope and verification outcome, and branch/commit conventions match the process spec |
| PRD-01.R17 | MUST     | Two-axis delivery review: two parallel fresh-context reviews — Standards (diff vs `doc/standards.md` + the smell baseline, skipping tool-enforced rules) and Spec (diff vs the PRD) — reported separately in the PR, never merged into one ranked list |
| PRD-01.R21 | SHOULD   | Handover skill: a dated handover doc per scope covering done / in flight / decisions / exact next action, pointing at artifacts rather than restating them, never overwriting its predecessor |
| PRD-01.R22 | MUST     | Human-readable status artifact: `STATUS.md` per repository, plain language, no unglossed process jargon, always naming which repository an item belongs to  |

R13 and R17 are the phase's substance and are inseparable: R17's reviews are inputs to R13's PR body, and neither has a delivery vehicle other than this skill. **R17 cannot be delivered as specified until the code-smell baseline exists** — `standards/` has no such entry, so 09b writes it; that makes 09b anchored equipment for R17, not un-anchored enabler work. R21 and R22 are folded in by decision of 2026-07-28: both have been built and exercised for weeks (this file's phase siblings and both `STATUS.md` files are their evidence), both are human-channel checks against artifacts that already exist, and phase 09 is the last phase before the deliver/improve gap closes — leaving them `draft` costs a future pass its own setup for two cheap checks. Deliberately out of scope: R14 (improve — phase 10), R23 (onboarding repair), and R24, which the register itself bars from planning until a `timone-grill` session rewrites its criteria.

## Goal Description

Phase 08 closed verification and left two finished, checked, undeliverable phases sitting on `scratch-app`'s branches — the exact state stage 8 exists to resolve. Delivery is where Timone stops talking to itself: the artifact leaves the repo and lands where a human reviews it. That is also why this phase's prerequisites are heavier than any before it. **There is no GitHub anywhere in this workspace.** All three fixtures are local bare repos under `tmp/fixtures/*.git`, and `gh` is not installed on this machine — while R13's criterion is literally *"a pull request exists"*, its hint is `gh pr view`, and ADR-0004 says the pilot must live on GitHub. A dry run that never opens a PR would verify nothing, so 09d stands up a real GitHub fixture before 09e runs.

**Nine spec gaps close first (09a).** Stage 8's note in `process.md` is one paragraph, and it is thinner than stage 7's was. It names no entry gate; says nothing about a phase whose verification left an unperformed HUMAN-CHECK — which is the *actual* state of `scratch-app` phase-01, whose R7 screen-reader clause is outstanding by choice; gives the two review axes no read lists despite calling them independent contexts; does not say whether their findings block the PR; does not say where the reports live; lists no required elements for the PR body; ignores stacked branches, though both of `scratch-app`'s phases are stacked and neither is merged; names GitHub nowhere despite ADR-0004, so a non-GitHub project has no defined behaviour; says nothing about re-delivery; and — the sharpest one — **contradicts stage 6.** Stage 6 tells implementers that "refactoring belongs to the review at delivery, not the red→green loop", which reads as a promise that delivery *applies* those refactorings; stage 8 says the reviews are *reported*. `scratch-app`'s phase-01 completion report has three refactorings deferred on the strength of that promise, so the contradiction is not hypothetical — it is queued.

**How that contradiction resolves, and why it is the phase's load-bearing decision.** Delivery reports; it never refactors. A refactoring commit made at stage 8 is code that no verification pass has ever seen — it would land *after* the report that certifies the behaviour and *before* the human reads the PR, quietly invalidating stage 7's evidence at precisely the moment the evidence is being presented. So stage 6's sentence is the one that gets corrected: refactoring identified at the delivery review is *raised* there and *executed* through stage 9, as a remediation like any other. This costs the fixture nothing — its three deferred items become the first genuine Standards-axis findings, which is a better test of the axis than anything synthetic.

**Why the reviews never block the PR.** A review that withheld the PR would hide its own findings from the only person who can act on them: merging is a human act, the PR is where the human is, and both axes are printed there under distinct headings. Findings route to stage 9 if the human wants them acted on. The gate stays where the process already put it — on merge.

**Why these are `process.md` amendments and not ADRs.** Each passed the significance test's trade-off part — reports-not-refactors against delivery closing its own loop, committed review artifacts against PR-body-only, a terminal platform refusal against a doc-record fallback of the kind stage 1 uses — but none is hard to reverse and none is surprising given stage 8's existing paragraph and ADR-0004. Same reasoning that kept phases 06, 07 and 08's conventions out of the ADR log.

## Context & Prerequisites

- **Phase 02** — `.claude/skills/README.md`: frontmatter rules, the mandatory six-step target-project resolution preamble (copy it verbatim), and the artifact rule that 09a reconciles a third time — stage 8 commits a delivery report and nothing else.
- **Phase 08** — `.claude/skills/timone-verify/SKILL.md` is the nearest house-style template (terminal gates that route and write nothing, a contract-shaped sub-agent section, inline fenced templates, a Closing naming a successor). Its verification report and the register statuses are this skill's only input, and its Closing carries a defect 09c fixes: it prescribes `/timone-deliver <project>` with no phase reference — the identical defect 08c round 1 found in `timone-execute`'s Closing, which would strand any project past its first phase.
- **`process.md` stage 8** — normative but one paragraph; 09a expands it with gate semantics and required elements only. The PR body's and the delivery report's document layout belongs to the skill, per the division phases 05–08 established.
- **`process.md` stage 6 and "The standards library"** — both are amended by 09a: stage 6's refactoring sentence (above), and the library section, which describes exactly two tiers and has no home for a review reference that every project gets but a project's own standards may override.
- **The standards-library authorship model** — [standards/README.md](../../../standards/README.md): agents draft from cited primary sources, fvermaut approves, an entry is normative only once approved, entries stay ~1 page. 09b obeys it; its human gate is that approval.
- **The fixture** — `projects/scratch-app`: two phases, both `Complete`, both verified ([phase-01-verification.md](../../../projects/scratch-app/doc/plans/phases/reports/phase-01-verification.md), [phase-02-verification.md](../../../projects/scratch-app/doc/plans/phases/reports/phase-02-verification.md)), branches `phase-01-to-do-list-vertical` and `phase-02-latency-smoke-check` (stacked; `main` is doc-only), R1–R6 `verified`, R7 `draft` with an unperformed screen-reader HUMAN-CHECK, phase 02 stamped un-anchored with an open latency-budget decision. Its phase-01 completion report defers three refactorings to the delivery review. `projects/scratch-existing`: phase-01 `Complete` with no verification report at all — the entry-gate fixture, needing no hand-authoring.
- **Local prerequisites for 09d/09e** — `gh` installed (`brew install gh`) and authenticated. **`gh auth login` is interactive and must be run by fvermaut**; the sub-phase stops and asks rather than attempting it.

## Sub-phases

### Sub-phase 09a: process-spec amendment — stage-8 decisions

**[MODIFY]** `process.md` — expand the stage-8 note with nine decisions, correct one sentence in stage 6, and add the review-reference tier to the standards-library section. Keep `process.md` thin: gate semantics and required elements, never document layout.

1. **Entry gate.** Delivery admits a phase stamped `Complete — see <report>` whose verification report exists and whose stage-7 gate passed: every MUST criterion PASS or HUMAN-CHECK, zero unresolved regressions, within 2 fix loops. Any register status of `failed`, or any BLOCKED verdict, refuses and routes to stage 9 — not to stage 7, since a failed pass has already spent its loops. A phase `Complete` with **no** verification report refuses and routes to `timone-verify`.
2. **An unperformed HUMAN-CHECK does not block delivery.** It is carried into the PR body as an explicit, unticked checklist item naming the script's location, because merging is a human act and the PR is where that human already is. Its requirement stays `draft`; delivery never writes the register — only stage 7 does.
3. **The two axes are independent fresh contexts with their own read lists.** **Standards** reads the phase's diff, the project's `doc/standards.md`, the smell baseline, and the project's tool configuration — the last so it can *skip* what linting and type-checking already enforce, per the library's own discipline. **Spec** reads the diff, the PRD pair, and the phase file's requirements header. Neither reads the other's report, and neither reads the verification report: behaviour evidence is stage 7's, and a spec reviewer holding a PASS table reviews the report instead of the diff. They run in parallel and are never merged into one ranked list — standards-clean code can build the wrong thing, and spec-faithful code can break conventions.
4. **The reviews report; they never block, and they never refactor.** Findings do not withhold the PR. Refactoring identified at the delivery review is raised in the Standards report and executed through **stage 9**, never committed by stage 8 — code committed after the verification report and before the human's read would invalidate stage 7's evidence at the moment it is presented. **Stage 6's sentence is corrected to say so**: refactoring is deferred *to the delivery review for identification*, and remediated via stage 9.
5. **Both reports are committed artifacts**, not PR prose alone: `doc/plans/phases/reports/phase-NN-delivery.md` carries both axes verbatim, the PR URL, and the scope and verification summary the PR body quotes (ADR-0006 — the repo is the source of truth; a PR body lives on a platform). Committed on the phase's branch as `docs: deliver phase NN — <theme>`, **before** the PR is opened, so the PR's first commit-visible artifact is its own record.
6. **PR required elements** (layout in the skill): a title following the phase's convention; the driving ticket reference, or the requirement IDs when the project has no ticket home — R13's "ticket/requirements" is a disjunction, and it is the fallback that applies to every fixture here; a scope summary; the verification outcome as a verdict table with outstanding HUMAN-CHECKs as unticked checklist items; both review reports under distinct headings, with Spec findings quoting requirement IDs; a link to the committed delivery report; and the base branch with its reason when it is not the default branch.
7. **Stacked branches.** When the phase's branch was cut from a previous phase's unmerged branch (stage 6's stacking rule), the PR is opened **against that parent branch**, not the default branch, and the body says which PR must merge first. Delivery never merges and never rebases: merge order is the human's.
8. **Platform binding — GitHub only, and the refusal is terminal.** Per ADR-0004 the PR *is* stage 8's artifact, so a project whose `repo_url` is not GitHub-hosted is refused loudly and routed to the human; unlike stage 1's triage record there is no doc-record fallback, because a delivery record without a review surface would let R13 pass without any PR ever existing. `gh` absent or unauthenticated refuses the same way. **Gate order is: input resolution → phase `Complete` → verification gate → platform binding** — gates about the work precede gates about where it goes, so an unverified phase hears that rather than a complaint about its host.
9. **Re-delivery updates; it never forks.** A branch that already has an open PR gets that PR's body refreshed and an iteration section appended to the existing delivery report — never a second PR, never a second file. Mirrors stage 7's re-verification rule.

**[MODIFY]** `.claude/skills/README.md` — reconcile the artifact rule a third time: stage 8 (`timone-deliver`) commits the delivery report and nothing else; it never commits application code, and the refactorings its Standards axis identifies are stage 9's work. What stays forbidden in every case is unchanged (PRD-01.R4).

**[MODIFY]** `process.md` "The standards library" — a third tier beside baseline and stack entries: **review references**, applied by stage 8 to every project and overridable by a project's own `doc/standards.md`. The code-smell baseline is the first and only member. This tier exists because the mandatory baseline admits no exceptions while stage 8's own wording says repo standards override the smell list — the two cannot be the same tier. State also that the tier is the sanctioned exception to the library's "true of every project on Earth" rule: a shared review checklist is universal by construction.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
grep -n "review reference\|delivery report\|gh pr\|stacked" process.md
grep -n "refactoring" process.md
grep -n "timone-deliver" .claude/skills/README.md
git -C . diff --stat
```

- [ ] Stage-8 note states all nine decisions: the entry gate and its routing; HUMAN-CHECK as non-blocking and carried into the PR; both axes' read lists and their mutual and verification-report blindness; reports-never-block and reports-never-refactor; the committed delivery report and its commit message; PR required elements including the requirements fallback for ticketless projects; the stacked-branch base rule; the GitHub-only terminal refusal with the stated gate order; re-delivery as update
- [ ] Stage 6's refactoring sentence is corrected and no longer promises that delivery applies refactorings; nothing else in stage 6 moved
- [ ] The standards-library section gains the review-reference tier, its override rule, and the universality exception
- [ ] `process.md` gained no PR-body or delivery-report *template* (those belong to the skill)
- [ ] `.claude/skills/README.md`'s artifact rule permits the stage-8 delivery report, forbids stage-8 code commits, and still forbids skill/harness/timone-internal files, matching R4's wording
- [ ] No other stage's text altered; stage 7's text untouched
- [ ] No PRD amendment was made — R13 and R17 needed none

---

### Sub-phase 09b: the code-smell review reference

**[NEW FILE]** `standards/code-smells.md`
**[MODIFY]** `standards/README.md` — a third table for the review-reference tier, matching 09a's `process.md` wording.

Per the library's authorship model: **agent-drafted from cited primary sources, fvermaut approves, ~1 page.** Sources are named inline and are the established catalogues — Fowler & Beck, *Refactoring* (2nd ed.), the smell catalogue; Fowler's `refactoring.com` catalogue; Martin, *Clean Code*, ch. 17. The entry is a fixed checklist a fresh-context reviewer can apply to a diff without knowing the project: the smell, the signal that identifies it in a diff, and what it usually indicates. It states what it deliberately excludes — anything a linter, formatter or type-checker enforces (the library's standing discipline), and anything that is a project convention rather than a smell (those live in `doc/standards.md`, which overrides this file on conflict).

The entry is **not** placed under `standards/baseline/`: that tier is defined as admitting no opt-out, and stage 8's own rule is that a project's standards override the smell list.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based plus the human gate.

> No dependency on other sub-phases. 09a's tier wording and this entry's placement must agree; whichever lands second reconciles.

#### Agent Validation Steps

```bash
wc -l standards/code-smells.md
grep -n "Refactoring\|Clean Code\|refactoring.com" standards/code-smells.md
grep -n "code-smells" standards/README.md
ls standards/baseline/
```

- [ ] The entry cites its primary sources by name and edition, inline
- [ ] Every item states the diff-visible signal, not only the smell's name
- [ ] Nothing in it restates a tool-enforceable rule; it says so explicitly
- [ ] It states that a project's `doc/standards.md` overrides it on conflict
- [ ] It is ~1 page and lives at `standards/code-smells.md`, not under `baseline/`
- [ ] `standards/README.md` lists it under a review-reference table with a `Status` cell
- [ ] **Human gate:** fvermaut approves the entry; its `Status` flips to `Approved <date>` only then, and it is normative only once approved

---

### Sub-phase 09c: `timone-deliver` skill

**[NEW FILE]** `.claude/skills/timone-deliver/SKILL.md`
**[MODIFY]** `.claude/skills/timone-verify/SKILL.md` — its Closing prescribes `/timone-deliver <project>` with no phase reference; delivery, like verification, refuses to pick a phase for the user, so as written the stage-7→8 handover would strand any project past its first phase. This is the identical defect 08c round 1 found in `timone-execute`; fix it the same way, and drop the "does not exist yet" note now that it does.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based, with the real test deferred to 09e.

> Sub-phase 09a must be complete before starting this sub-phase (spec wins; the skill restates it). 09b need not be — the skill references the entry by path.

Per `process.md` stage 8, with the standard target-project resolution preamble from `.claude/skills/README.md` — managed projects only. Input: a project name plus a phase reference. **Standalone and from-verification are the same invocation**, as they are for stage 7. The skill:

1. **Opens with the stance** — delivery presents work for human judgement; it does not improve it, does not merge it, and does not decide anything the PR exists to let a human decide.
2. **Fires its gates in the stated order**, each terminal, each naming where to route, none writing anything: input resolution (never pick a phase for the user) → phase not `Complete` → no verification report, or a gate that did not pass → non-GitHub `repo_url`, or `gh` absent or unauthenticated.
3. **Sets up the branch** — deliver at the phase branch's HEAD; refuse a dirty tree; determine the base branch per 09a's stacking rule and record why; push the branch to `origin`.
4. **Runs the two axes as parallel fresh contexts**, each contract-shaped — inputs (the diff range, its own read list), outputs (a report in the fixed section shape) — with any concrete spawning mechanism named only as an example, exactly as stage 7 states its fix context. Neither axis's output is ranked against the other's; the skill concatenates, never merges.
5. **Writes and commits the delivery report** per 09a, then opens the PR with `gh pr create`, then records the PR URL back into the report only if that requires no second commit — otherwise the report states the PR is opened against it and the URL lives in the Closing.
6. **Handles re-delivery** — existing open PR → refresh the body, append an iteration section.
7. **Updates `STATUS.md`** in the managed project's terms (and Timone's own only when delivering Timone), per the every-stage obligation.

The skill carries three inline fenced templates (house style — no bundled reference files): the **PR body** (every 09a required element), the **delivery report**, and the **review-axis report section** shared by both axes. 

Closing: report the gate outcome or the PR URL, the base branch and why, both axes' finding counts stated separately, the delivery report's path, every outstanding HUMAN-CHECK, and the next invocation — `/timone-improve <project>` for anything the human wants acted on. Note explicitly that `timone-improve` does not exist yet (phase 10); name it anyway, as every stage skill names its successor.

#### Agent Validation Steps

```bash
head -6 .claude/skills/timone-deliver/SKILL.md
grep -n "Standards\|Spec\|never merged\|never refactor" .claude/skills/timone-deliver/SKILL.md | head -20
grep -n "gh pr create\|base\|stacked" .claude/skills/timone-deliver/SKILL.md | head
grep -n "timone-deliver" .claude/skills/timone-verify/SKILL.md
grep -c "timone-improve" .claude/skills/timone-deliver/SKILL.md
```

- [ ] Frontmatter + targeting per `.claude/skills/README.md` (`argument-hint` starts with `<project-name>`, then the phase reference)
- [ ] Stage-8 rules restated with no variants: gate order, both axes' read lists, non-blocking and non-refactoring reviews, committed report, PR elements, stacking, re-delivery — all matching 09a exactly
- [ ] All four gates are terminal, write nothing, and name the skill or human to route to
- [ ] The two axes are stated as parallel fresh contexts, blind to each other and to the verification report, with no runtime-specific mechanism written in as a requirement
- [ ] All three inline templates present; the PR body template carries every 09a required element including the ticketless requirements fallback and the unticked HUMAN-CHECK items
- [ ] The skill never commits code, never merges, never rebases, and never writes the criteria register
- [ ] `timone-verify`'s Closing now names the phase in its `/timone-deliver` handover and no longer says the skill does not exist

---

### Sub-phase 09d: GitHub fixture — and the platform-refusal run

**[MODIFY]** `timone.yaml` — via `node dist/cli.js projects update scratch-app --repo <github-url>` ([ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md): never hand-edit).

> Sub-phases 09a and 09c must be complete before starting this sub-phase — its first step invokes the skill.

R13's criterion demands a pull request and its hint names `gh pr view`; no fixture is GitHub-hosted and `gh` is not installed, so the dry run cannot begin here. Ordered so the pre-migration state is spent on the one assertion only it can make:

1. **Platform-refusal run, before anything changes.** Invoke `/timone-deliver scratch-app phase-01` while `repo_url` is still the local bare repo. Expect a terminal refusal naming the platform binding, no push, no PR, nothing written. This assertion is only possible now — after the repoint there is no non-GitHub project carrying a verified phase.
2. **Install and authenticate `gh`.** `brew install gh`, then **stop and ask fvermaut to run `gh auth login`** — it is interactive and must not be attempted by an agent.
3. **Create the GitHub repo and push.** A private repo under fvermaut's account named `scratch-app`, pushed with `main` and both phase branches, preserving history.
4. **Repoint the manifest** via `projects update`, then confirm `node dist/cli.js projects list` shows the new URL and `git -C projects/scratch-app remote -v` agrees.

The two remaining fixtures stay on local bare repos: they are the standing non-GitHub cases, and nothing in this phase needs them delivered.

**Seams under test (TDD):** no Timone code is written here; the "seams" are the observable end states asserted below.

#### Agent Validation Steps

```bash
gh auth status
gh repo view <owner>/scratch-app --json name,visibility,defaultBranchRef
git -C projects/scratch-app remote -v
git -C projects/scratch-app branch -r
node dist/cli.js projects list
git -C . diff --stat timone.yaml
```

- [ ] The platform-refusal run happened **before** the repoint, refused terminally, and pushed nothing
- [ ] `gh auth login` was performed by fvermaut, not attempted by an agent
- [ ] The GitHub repo is private and carries `main` plus both phase branches with their existing history
- [ ] `timone.yaml`'s change was made by `projects update`, not by hand
- [ ] `scratch-app-2` and `scratch-existing` still point at local bare repos

---

### Sub-phase 09e: Dry-run — four runs against the fixtures

**Seams under test (TDD):** this sub-phase writes no Timone code; its "seam" is the observable end state of each run, asserted below.

> Sub-phases 09a, 09b, 09c and 09d must be complete before starting this sub-phase — 09b because the Standards axis has nothing to review against without it.

From fresh timone-root sessions:

1. **Full delivery — `scratch-app` phase-01**, invoked with exactly the command line `timone-verify`'s Closing prescribes; that is the from-verification evidence, and no separate machinery exists to test. Expect: PR opened against `main`; body carrying scope, the verdict table from the verification report, **R7's screen-reader HUMAN-CHECK as an unticked checklist item**, and both axes under distinct headings with Spec findings quoting requirement IDs; delivery report committed `docs: deliver phase 01 — …` before the PR opened; register untouched. **The Standards axis has known material waiting** — the three refactorings phase-01's completion report deferred to this review (`useOptimistic` on the controlled checkbox, the duplicated action wrappers, the `exclusiveList` fixture duplicated across two spec files). Finding them is the axis working; missing them is a defect in the axis, not in the fixture. It must also not commit them.
2. **Stacked, un-anchored delivery — `scratch-app` phase-02.** Expect: PR opened **against `phase-01-to-do-list-vertical`**, not `main`, with the body naming which PR merges first; the Spec axis reporting that the phase claims no requirement IDs and saying so rather than manufacturing findings; the open 2 ms latency-budget decision carried into the body as an unticked item.

   > ✏ Refined 2026-07-28 (from 09e round 2): ran as expected — but preparing it exposed a **contradiction in 09c's own read rules**. The axes are told to read "the current content of the files the diff touches" *and* forbidden the verification report — which is always in the range, because a phase commits its own reports to its own branch. A rule that mandates reading what it forbids is the inverse of the defect 08c round 3 found in `timone-verify`, and trains agents to pick one silently. The skill now states that the **review subject is the range's non-process files**, and that a read list always outranks the diff's contents. The run also produced a finding worth keeping about the axes' limits: the Spec axis identified a real contradiction in `doc/standards.md` and resolved it the *wrong way*, because the commit settling it (`fa0da1c`) sits in the base, outside the reviewed range. It hedged correctly, and the delivery report records the correction as a deliverer's note without touching the verbatim report — which is what the never-merge rule is for.
3. **Entry-gate refusal — `scratch-existing` phase-01** (`Complete`, no verification report). Expect: terminal refusal at the verification gate — naming `timone-verify` as the route — reached *before* the platform gate, though this project is also non-GitHub. That ordering is the assertion; the refusal alone is not.
4. **Re-delivery — `scratch-app` phase-01 again.** Expect: the existing PR's body refreshed, an iteration section appended to the existing delivery report, no second PR, no second file.

   > ✏ Refined 2026-07-28 (from 09e round 3): **re-delivery as first specified re-reviewed its own delivery report.** The rule said re-run the axes on new commits; the delivery report and `STATUS.md` *are* commits on the branch, so every re-delivery would have re-reviewed what the last one wrote, and the next re-reviewed that — a loop with no fixed point, each turn spending two fresh contexts on an unchanged diff. The skill now ties re-running to a change in the axis's **subject**, not to any commit: when only process artifacts moved, the iteration says so and carries the prior findings forward. Run 4 discharged it under the corrected rule — subject byte-identical across both ranges (35 files, +11790/−1), axes not re-run, findings carried, one PR, one file, one appended section.

Then: `git log --stat` in the fixture — no skill files, no harness config, no timone internals (R4 regression, now that a third skill commits into a client repo), and no code commit from stage 8 at all.

Explicit non-goals: **nothing is merged** — merging is a human act and the two PRs stay open for fvermaut. **No synthetic review-failure run** — the phase-01 refactorings are real material and the un-anchored phase is a real degenerate case; manufacturing a standards violation to see the axis fire would test ingenuity rather than the tool, the position phases 07 and 08 both took and both had upheld at sign-off.

#### Agent Validation Steps

```bash
cd projects/scratch-app
gh pr list --state open
gh pr view <n1> --json baseRefName,body | head -40
gh pr view <n2> --json baseRefName
ls doc/plans/phases/reports/ | grep delivery
git log --oneline phase-01-to-do-list-vertical | head -5
grep -c "^## " doc/plans/phases/reports/phase-01-delivery.md
# Failure probe: stage 8 must not have committed application code
git log --stat --grep "deliver phase" -- ':!doc' ; echo "exit: $? (no files listed = clean)"
# Failure probe: no skill, harness or timone-internal file may appear in the fixture's history
git log --stat | grep -E "\.claude/|timone\.yaml"; echo "exit: $? (1 = clean, as required)"
```

- [ ] Run 1: PR open against `main`; both axes present under distinct headings and never merged into one list; Spec findings quote requirement IDs; R7's HUMAN-CHECK appears unticked with its script's location; delivery report committed before the PR opened
- [ ] Run 1: the deferred refactorings were found and none was committed

   > ✏ Refined 2026-07-28 (from 09e run 1): the assertion **presumed all three deferred items were Standards material, and one is not.** `useOptimistic` on the controlled checkbox is a behaviour concern and was caught by the **Spec** axis against R6's "immediately" clause — the axes' own division working, not a miss. Of the two that are Standards material, the mutex duplication was found and the action wrappers' thrice-copied `updateTag("todos")` was not. That miss was real and instrument-side: `code-smells.md`'s Duplicated-code signal read "the same **block**", so a repeated one-liner did not trip it. The reference now says a repeated one-liner counts, and the axis was re-run against the corrected reference.
- [ ] Run 2: base branch is `phase-01-to-do-list-vertical`, stated with the merge-order note; the un-anchored case is reported, not invented around
- [ ] Run 3: refusal names the verification gate and routes to `timone-verify`, having been reached before the platform gate
- [ ] Run 4: one PR, one delivery report, one appended iteration section
- [ ] `git log --stat` in the fixture shows no skill, harness or timone-internal files, and no stage-8 code commit
- [ ] Defects found are fixed in `timone-deliver` (and in `process.md` when the spec is what was wrong, never by bending the skill around it)
- [ ] **Human gate:** fvermaut reviews both PRs as a reviewer would, both delivery reports, the two refusal transcripts, and confirms the Standards axis's findings are real; this gate is also R13's and R17's evidence

---

### Sub-phase 09f: verification of R21 and R22

**Seams under test (TDD):** no behaviour-carrying code; the seam is the artifacts as they stand, checked against the register.

> Sub-phase 09e must be complete before starting this sub-phase — R22's check is stronger once every 09e run has updated `STATUS.md`, and stale-after-a-stage is exactly its failure mode.

Both requirements are human-channel and both are checked against artifacts that already exist; nothing is built here. **R21** — `doc/handover/` in this repo holds a dated series, newest current, each pointing at PRDs, phase files and reports by path rather than restating them, each naming an exact next action, none overwritten. **R22** — both `STATUS.md` files against all four of R22's criteria, the third being the sharpest: no bare requirement ID, stage number, phase letter or process term without a plain-language gloss, and every blocked item naming which repository it lives in. R22's own hint prescribes the test — hand the file to a reader who has never read `process.md` and ask what happens next and who has to do it.

Failures here are recorded and fixed in the artifacts or their skills, not waved through: a `STATUS.md` that fails its own third criterion is a defect in `timone-handover`'s and every stage's obligation, not in the register.

#### Agent Validation Steps

```bash
ls doc/handover/
grep -c "](\.\./" doc/handover/2026-07-28-phase-08-verify-skill.md
grep -n "PRD-01\.R\|stage [0-9]\|phase-0[0-9][a-z]" STATUS.md projects/scratch-app/STATUS.md
grep -n "Timone\|scratch-app" projects/scratch-app/STATUS.md | head
```

- [ ] R21: the handover series is dated, additive, artifact-referencing and next-action-bearing across every file, not just the newest
- [ ] R22: both files pass all four criteria, including the no-unglossed-jargon and which-repository clauses
- [ ] Any failure found is fixed in the artifact and, where the cause is the instruction, in the owning skill
- [ ] **Human gate:** fvermaut answers R22's own test question from `STATUS.md` alone

---

### Sub-phase 09g: Documentation

**[MODIFY]** `README.md` — add `/timone-deliver <project-name> <phase-NN>` to the "Working with Timone" command list; add the review-reference tier to the `standards/` line; update the Status paragraph.
**[MODIFY]** `doc/specs/prd/prd-01-process-layer.criteria.md` — flip R13, R17, R21 and R22 to `verified` once 09e's and 09f's human gates pass.
**[MODIFY]** `STATUS.md` — Timone's own, per the every-stage obligation, retiring the "code smell baseline doesn't exist" and "two finished pieces of work not shipped" entries under *Known problems*.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "timone-deliver" README.md
grep -n -A3 "^## R13\|^## R17\|^## R21\|^## R22" doc/specs/prd/prd-01-process-layer.criteria.md
grep -n "code smell" STATUS.md
```

- [ ] Documented invocation matches actual behaviour; links resolve
- [ ] R13, R17, R21 and R22 flipped only after the 09e and 09f human gates passed
- [ ] The Status paragraph names what remains: the improve skill (R14), onboarding repair (R23), and standards drift (R24, still awaiting a grill session)
- [ ] `STATUS.md`'s stale entries are retired, and it names the two open PRs as waiting on fvermaut

## Dependency graph

```
09a → (none)              process.md: stage-8 decisions (entry gate, HUMAN-CHECK, axis read lists, report-never-refactor,
                          committed report, PR elements, stacking, GitHub-only gate order, re-delivery); stage-6 correction;
                          review-reference tier; skills-README reconciliation (spec first)
09b → (none)              standards/code-smells.md + README tier — human approval gate
09c → 09a                 timone-deliver skill; timone-verify Closing fix
09d → 09a, 09c            GitHub fixture: platform-refusal run first, then gh + repo + repoint
09e → 09a, 09b, 09c, 09d  dry run: 4 runs (full delivery, stacked un-anchored, entry-gate refusal, re-delivery), human gate
09f → 09e                 verification of R21 and R22, human gate
09g → 09e, 09f            docs last + R13/R17/R21/R22 → verified
```
