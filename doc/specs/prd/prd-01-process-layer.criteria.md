# PRD-01 Acceptance Criteria — The Process Layer

> Formal register for [prd-01-process-layer.md](prd-01-process-layer.md).
> Requirement IDs are stable — never renumber, never reuse, never delete.

## R1 — Process specification document

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** human
- **Criteria:**
    - GIVEN the process spec in the Timone repo
      WHEN reviewed
      THEN every lifecycle stage (triage, requirements, architecture, planning, implementation, verification, delivery, feedback, deployment, maintenance) is defined with: purpose, produced artifact, closing gate, and owning skill — deployment/maintenance marked "stage defined, skill post-MVP"
- **Verification hint:** read `process.md` (location TBD) against the stage list above.

## R2 — Project manifest

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Depends-on:** `src/manifest.ts, src/commands/projects.ts`
- **Criteria:**
    - GIVEN a `timone.yaml` declaring a project with repo URL, local path, stack, and platform bindings
      WHEN Timone loads its configuration
      THEN the project is listed as managed with the declared attributes, and an entry missing a required field is rejected with an error naming the field
- **Verification hint:** `timone projects list` (or equivalent) against a manifest with one valid and one invalid entry.

## R3 — Workspace sync

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** api
- **Depends-on:** `src/commands/workspace.ts, src/git.ts`
- **Criteria:**
    - GIVEN a manifest project whose local path does not exist
      WHEN workspace sync runs
      THEN the repo is cloned to the declared path under `projects/`, and that path is invisible to Timone's own git status
    - GIVEN an already-cloned project with no local changes
      WHEN workspace sync runs
      THEN the clone is fast-forwarded; a clone with uncommitted changes is left untouched and reported
- **Verification hint:** `timone workspace sync` twice against a test repo; check `git -C projects/<name> log` and `git status` at the timone root.

## R4 — Skills reach project sessions, never project repos

> ✏ Revised 2026-07-19: sessions run at the timone root, not inside `projects/<name>` ([ADR-0007](../../adr/0007-sessions-at-timone-root.md)). The criterion is now target-project resolution + clean client repos.

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/, src/daemon/, src/commands/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a stage session against a managed project that is not Timone, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a session started at the timone root
      WHEN a stage skill is invoked with (or asked for) a target project
      THEN the skill validates the target against `timone.yaml`, operates only on that project's `projects/<name>/…` tree, and no commit produced in the target project contains skill or harness files (process artifacts under `doc/` and `CONTEXT.md` excepted)
- **Verification hint:** from the timone root, run a stage skill against a scratch managed project; `git log --stat` in the scratch repo.

## R5 — Onboarding skill

> ✏ Revised 2026-07-19: onboarding extended — constraints elicited into the product overview, stack choices recorded as founding ADRs, standards artifact produced (see R15). Gate now covers overview **and** standards.

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-onboard/, src/manifest.ts, src/commands/workspace.ts`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs onboarding a repository that is not yet managed, and the human's confirmation inside the clause, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a repo not yet managed
      WHEN the onboarding skill runs
      THEN a valid manifest entry exists, the project's process doc structure is created (`doc/specs/`, `doc/specs/prd/`, `doc/adr/`, `doc/plans/phases/`), a product overview including project constraints is drafted, stack choices are recorded as founding ADRs under `doc/adr/`, a standards artifact per R15 is produced, and the user confirms overview and standards before they are saved
- **Verification hint:** onboard a scratch repo; check manifest entry, created tree, founding ADRs, and `doc/standards.md`.

## R6 — Triage skill

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** human
- **Criteria:**
    - GIVEN an incoming request (ticket text or free-form description) on a managed project
      WHEN the triage skill runs
      THEN it records a classification (feature / bug / chore / question), the process entry point it routes to (e.g. feature → grill, bug → improve), and a one-paragraph rationale
- **Verification hint:** run against three sample requests of different kinds; check routing matches the process spec.

## R7 — Grill skill (requirements interview)

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** human
- **Criteria:**
    - GIVEN a feature idea on any managed project
      WHEN the grill skill runs
      THEN questions come one at a time, each with a recommended answer; questions answerable from the codebase are answered from the codebase instead of asked; the session ends with a summary of decisions, outstanding risks, and a handoff suggestion to the PRD skill
- **Verification hint:** run an interview on the pilot project; check against `poc-grill-me` behavior minus PoC hardcoding.

## R8 — PRD skill

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-prd/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full requirements session against a project, and the human's approval inside the clause, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a concluded interview (or equivalent input) on a managed project
      WHEN the PRD skill runs
      THEN a two-file pair exists under the project's `doc/specs/prd/`: a narrative free of Given/When/Then machinery, and a criteria register where every MUST has at least one Given/When/Then criterion, a verification channel, and a stable `PRD-NN.R<k>` ID — and the requirement list was approved by the user before files were written
- **Verification hint:** inspect the produced pair against the register's field rules; try to find a MUST without a testable criterion.

## R9 — ADR skill

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-adr/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full architecture session against a project, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a significant technical decision arising on a managed project
      WHEN the ADR skill runs
      THEN a numbered record exists under `doc/adr/` with context, decision, consequences, and status; superseding an ADR creates a new record and flips the old one's status to superseded with a cross-link — never edits history
- **Verification hint:** create one ADR, then supersede it; check both files and their statuses.

## R10 — Plan skill

> ✏ Revised 2026-07-19: sub-phases additionally declare their seams under test (consumed by the TDD loop, R16); prefactoring and expand–contract sequencing added to the planning rules.

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-plan/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full planning session against a project, and the human's approval inside the clause, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN an approved PRD on a managed project
      WHEN the plan skill runs
      THEN a phase file exists under `doc/plans/phases/` with vertical-slice sub-phases, explicit dependencies, file markers, runnable validation commands, and declared seams under test per sub-phase; the covered requirement IDs are listed at phase level; and the user approved the breakdown before the file was written
    - GIVEN the planned work implies a significant undocumented technical decision
      WHEN the plan skill runs
      THEN it stops and routes to the ADR skill before producing the plan
- **Verification hint:** plan a small feature on the pilot; check sub-phase validation sections are copy-pasteable commands; plan a feature implying a stack choice and confirm the ADR gate fires.

## R11 — Execute skill

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-execute/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full implementation session against a project, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN an approved phase file
      WHEN the execute skill runs
      THEN sub-phases run in dependency order via fresh sub-agent contexts with handoff notes; each sub-phase's validation steps pass before the next starts; and a completion report is written under `doc/plans/phases/reports/`
- **Verification hint:** execute a two-sub-phase plan on the pilot; inspect handoffs and the completion report.

## R12 — Verify skill (standalone)

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-verify/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full verification session against a project, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a project with a criteria register and a runnable app
      WHEN the verify skill runs (invoked standalone or from execution)
      THEN a verifier context with no build knowledge checks each in-scope criterion per its channel, writes a verification report with PASS / FAIL / HUMAN-CHECK / BLOCKED verdicts and evidence, and updates register statuses; MUST+api criteria already verified are re-run as regression
- **Verification hint:** run standalone against the pilot after an execution; then break one verified behavior and re-run — expect a REGRESSION verdict.

## R13 — Deliver skill

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-deliver/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full delivery session against a project, and a forge that accepts a pull request, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a completed and verified phase on a work branch
      WHEN the deliver skill runs
      THEN a pull request exists referencing the driving ticket/requirements, its description summarizes scope and verification outcome, and branch/commit conventions match the process spec
- **Verification hint:** `gh pr view` on the pilot repo; check cross-links.
- **Evidence:** ✏ 2026-07-29 verified — phase 09's dry run opened two real pull requests on `scratch-app` ([#1](https://github.com/fvermaut/scratch-app/pull/1) against `main`, [#2](https://github.com/fvermaut/scratch-app/pull/2) stacked on its parent branch), each referencing its requirement IDs in the absence of a ticket home, summarizing scope and the verification outcome, and following the phase's branch/commit conventions. Two terminal refusals were also exercised. Records: `projects/scratch-app/doc/plans/phases/reports/phase-01-delivery.md` and `phase-02-delivery.md`. Gate passed by fvermaut 2026-07-29.


## R14 — Improve skill (feedback triage)

- **Priority:** MUST
- **Status:** verified
    - ✏ 2026-08-02 verified by fvermaut on the `human` channel, against four real intakes on `scratch-app` and one full dispatch. Evidence, clause by clause: **classifies the layer** — `doc/feedback/001`–`004` each carry a per-item layer diagnosis, and the four land on three different layers (001 already-resolved, 002 intent, 003/004 record); **classifies the remediation** — the six classes named in this criterion proved insufficient in live use and are now **seven** (see the note below); **amends the PRD when intent moved** — PRD-01.R6 of `scratch-app` was amended in place with stable IDs, `Status: revised`, and a dated marker naming `doc/feedback/002`, in the same commit as the register's intent transition (`26aba7c`), while 001, 003 and 004 left the PRD untouched, which is the verification hint's discriminating check; **executes only after user confirmation** — every one of 002's nine items carries fvermaut's recorded confirm / decline / defer, one was declined and one deferred with a trigger, and nothing moved before the gate. **The loop was seen to close**: 002 item 1 → stage 5 plan (its own approval gate) → stage 6 → stage 7 → `scratch-app` PR #3, with stage 9 authoring no code commit.
    - ✏ 2026-08-02 **the criterion's class list is out of date and deliberately not rewritten here.** It names six remediation classes; live use added a seventh (`verification pass`, for items only observed behaviour can settle) and widened `report amendment` to `record correction` over any committed process artifact. Rewriting the clause would be an intent transition — stage 9's write, on its own record, not stage 7's — and the change is a widening that this evidence satisfies rather than contradicts. Recorded here so the gap is visible; `process.md` stage 9 is the authority on the class list.
    - ✏ 2026-08-02 **known limit of the evidence.** The register carve-out's "a `revised` criterion leaves the derived regression set" clause has a live case (`scratch-app` PRD-01.R6) but **not a discriminating one**: R6 is `browser`-channel, so the `api`-only derivation excluded it regardless of its status, and the `revised` rule was never the load-bearing reason. Discriminating evidence needs a criterion that is MUST + `api` + `verified` and then goes `revised`; none exists yet. See `scratch-app`'s `doc/plans/phases/reports/phase-03-verification.md`, which computed the exclusion and said so.
- **Verify-via:** human
- **Criteria:**
    - GIVEN post-delivery feedback on a managed project
      WHEN the improve skill runs
      THEN it classifies the layer (intent change vs implementation gap) and the remediation (bug fix / refinement / plan patch / new sub-phase / new phase / report amendment), amends the PRD (stable IDs, revised/deprecated markers) when intent moved, and executes the remediation only after user confirmation
- **Verification hint:** feed it one bug report and one "works as planned but not what I meant" case; check the two route differently and the PRD is touched only in the second.

## R15 — Thin per-project standards artifact

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-onboard/, standards/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs onboarding a repository that is not yet managed, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a project being onboarded (new or existing)
      WHEN onboarding completes
      THEN `doc/standards.md` exists, listing the applicable central-library entries and project-specific deviations, and containing no rule that project tooling (linter, formatter, compiler config) already enforces
    - GIVEN an existing codebase is onboarded
      WHEN the standards artifact is drafted
      THEN conventions observed in the code are recorded as-is and conflicts with the preferred standards are flagged for explicit decision, not silently overridden
- **Verification hint:** onboard a scratch greenfield repo and an existing repo with a deliberate convention clash; inspect both `doc/standards.md` files.

## R16 — TDD implementation loop

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** human
- **Criteria:**
    - GIVEN a phase file whose sub-phases declare seams under test
      WHEN the execute skill runs a sub-phase
      THEN tests are written only at the declared seams, each written and run failing (red) before the implementation that makes it pass (green), one slice at a time; refactoring is deferred to the delivery review; the full suite runs once at sub-phase end
- **Verification hint:** inspect the sub-agent transcript/handoff for a sub-phase: the test-red evidence must precede the implementing change; look for the named anti-patterns (implementation-coupled, tautological, horizontal slicing) in the produced tests.

## R17 — Two-axis delivery review

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `.claude/skills/timone-deliver/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a full delivery session against a project, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN a completed, verified phase on a work branch
      WHEN the deliver skill runs
      THEN two parallel fresh-context reviews are produced — Standards (diff vs `doc/standards.md` + the smell baseline, skipping tool-enforced rules) and Spec (diff vs the PRD: missing requirements, scope creep, wrong-looking implementations) — reported separately in the PR, never merged into one ranked list
- **Verification hint:** run delivery on the pilot; check the PR description contains both reports under distinct headings, with spec findings quoting requirement IDs.
- **Evidence:** ✏ 2026-07-29 verified — both axes ran as parallel fresh contexts, blind to each other and to the verification report, and are reported under distinct headings in both PRs and both delivery reports, never merged into one ranked list. Spec findings quote requirement IDs throughout. Six Standards findings and three Spec findings on phase 01; two and two on phase 02, whose Spec axis correctly reported the un-anchored stamp rather than inventing requirements. No finding was applied — stage 8 committed no code. Gate passed by fvermaut 2026-07-29.


## R18 — Central standards library structure

> ✏ Revised 2026-07-19: the library gains a mandatory **baseline tier** (accessibility, UI/UX) included in every project with no selection — see R20.
> ✏ Revised 2026-07-19 (2): authorship model — content is **drafted by agents** from cited primary sources and **approved by the human**, who reviews but does not write.

- **Priority:** SHOULD
- **Status:** verified
- **Verify-via:** api
- **Criteria:** Timone's repo hosts `standards/` in two tiers — **baseline** (mandatory for all projects: accessibility, UI/UX) and **stack entries** (selected per project: TypeScript, Next.js, Prisma/PostgreSQL, better-auth, Docker Compose local, Vercel + Supabase live); content is drafted by agents from cited primary sources and approved by the human — Timone provides structure, injection into sessions, and the selection mechanism consumed by `doc/standards.md`.

## R19 — Domain glossary maintenance

- **Priority:** SHOULD
- **Status:** verified
- **Verify-via:** human
- **Criteria:** the grill skill maintains `CONTEXT.md` lazily (created on first resolved term): glossary entries only, no implementation details; conflicting term usage is challenged during the interview and the resolved term recorded immediately.

## R20 — Mandatory accessibility & UI/UX baseline

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** live
- **Last live gate:** never
- **Depends-on:** `standards/baseline/`
    > ✏ Moved from `api` to `live` on 2026-09-04 ([ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D1). It needs a project with a user interface, and the browser baseline run against it, which no verification pass has. It was reported BLOCKED, not checked, before this.
- **Criteria:**
    - GIVEN any project being onboarded
      WHEN `doc/standards.md` is produced
      THEN it includes the baseline-tier entries (accessibility per EAA / EN 301 549 / WCAG 2.1 AA, and UI/UX) unconditionally — the baseline is not subject to selection or opt-out
    - GIVEN a PRD covering user-facing functionality
      WHEN the requirements stage runs
      THEN the criteria register includes accessibility acceptance criteria derived from the baseline
    - GIVEN a phase with user-facing deliverables is verified
      WHEN browser-channel checks are produced
      THEN they include the baseline accessibility checks (automated scan where tooling exists, HUMAN-CHECK script otherwise)
- **Verification hint:** onboard a scratch project and draft a PRD with a UI feature; inspect `doc/standards.md` for the baseline entries and the register for a11y criteria.

## R21 — Handover skill

- **Priority:** SHOULD
- **Status:** verified
- **Verify-via:** human
- **Criteria:**
    - GIVEN an in-progress session of work (on Timone itself, or on a managed project)
      WHEN the handover skill runs
      THEN a dated handover doc is written to `doc/handover/` (meta scope) or `projects/<name>/doc/handover/` (project scope), covering: what's done, what's in flight or blocked, key decisions since the last handover, and the exact next action — with pointers to PRDs/ADRs/phase files/reports rather than restated content
    - GIVEN a prior handover doc exists for the same scope
      WHEN a new one is written
      THEN the prior file is left in place (never deleted or overwritten) and the new file is clearly the latest by filename date
- **Verification hint:** run the skill mid-session; check the doc references artifacts by path, states a concrete next action, and doesn't duplicate PRD/ADR content.
- **Evidence:** ✏ 2026-07-29 verified — see `doc/plans/phases/reports/phase-09-verification.md`. Five dated meta-scope handovers plus one project-scope on `scratch-app`; every file carries all required elements including an exact next action and references artifacts by path; one commit per file (never modified after creation) and none ever deleted.


## R22 — Human-readable status artifact

- **Priority:** MUST
- **Status:** verified
- **Verify-via:** human
- **Criteria:**
    - GIVEN a managed project under Timone
      WHEN any stage completes work on it
      THEN `projects/<name>/STATUS.md` reflects the new state in plain language — what is done, what is in progress, what happens next, and what is waiting on the human — and states which project it covers, distinguishing that project's own work from Timone's
    - GIVEN Timone itself
      WHEN a phase of Timone's own work completes
      THEN `STATUS.md` at the Timone root does the same for Timone
    - GIVEN either file
      THEN it is comprehensible without process knowledge: no bare requirement ID, stage number, phase letter, or process term appears without a plain-language gloss, and any blocked item names **which** repository the blocker lives in
    - GIVEN either file
      THEN it is written for the human and never read by an agent as a source of truth — the PRD, phase files and reports remain the authorities, and the status file may be regenerated from them at any time without loss
- **Verification hint:** hand the file to someone who has never read `process.md` and ask them what happens next and who has to do it. If they cannot answer from the file alone, it fails. Also check that a reader cannot confuse work on a managed project with work on Timone.
- **Origin:** requested by fvermaut 2026-07-25 — "I'm always a bit lost on what are the next steps, and if they are related to the project, or the timone." The human-gate model depends on the human knowing what is happening; a process the stakeholder cannot follow has gates in name only.
- **Evidence:** ✏ 2026-07-29 verified after two fix loops — see `doc/plans/phases/reports/phase-09-verification.md`. Checked with the requirement's own instrument: two fresh naive-reader contexts given only the two `STATUS.md` files. Loop 1 found the two files contradicting each other on the current state; loop 2 found the file is branch-local, so no branch held the whole picture and the default branch had no copy at all. Both fixed. **Resolved 2026-07-29 by fvermaut:** `STATUS.md` is written only on the project's default branch, never on a work branch — every stage rewrites the whole file, so a branch-local copy conflicts the moment a second branch merges. Recorded in `process.md` § Status reporting and in the stage-7 and stage-8 skills.


## R23 — Onboarding repair of an already-managed project

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a project already in the manifest and already cloned, missing or holding an unratified stage-0 artifact (`doc/specs/product-overview.md`, the founding ADRs, `doc/standards.md`, or the process doc tree)
      WHEN onboarding runs in repair mode
      THEN the missing artifact is produced and the human gate for it is put, **without** the skill refusing on the existing manifest entry or the existing directory, and **without** modifying any stage-0 artifact that is already present and ratified
    - GIVEN a project whose stage-0 artifacts are all present and ratified
      WHEN onboarding runs in repair mode
      THEN it reports that nothing is missing and writes nothing
    - GIVEN repair mode
      THEN it never adds a manifest entry — registration remains the new-project path's job, via `timone projects add` ([ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md))
- **Verification hint:** delete `doc/standards.md` from a scratch fixture and run repair; expect the artifact regenerated and the gate put. Run it again with nothing missing; expect a no-op. Confirm the product overview is not rewritten in either run.
- **Origin:** found executing `scratch-app` phase 01, 2026-07-25. `timone-onboard` is the sole owner of `doc/standards.md` and refuses both on an existing manifest entry and on an existing directory — correctly, for its stated job of onboarding a repo *not yet managed* (R5). But that makes any project missing a stage-0 artifact unrepairable through the process: the only skill permitted to produce the file refuses to run on every project that could be missing one. `scratch-app`'s backfill only succeeded by overriding both refusals by hand. Recorded as its own requirement 2026-07-26 rather than by re-scoping R5, which is verified and true as written; the missing capability is a different one, and the register's IDs are stable.

## R24 — Standards drift detection

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the standards library, whose entries are approved against a stated ecosystem state at a stated date
      WHEN an entry's instructions no longer hold — a command that cannot run, a version that cannot be installed, a config key that no longer exists, a required option that has appeared
      THEN the drift is surfaced to the human as a finding naming the entry and what specifically stopped being true, before a project follows the stale instruction
- **Mechanism: undecided.** Version stamping per entry, a scheduled re-verification, executing each entry's commands in CI, and deriving drift from execution failures are all candidates and none is chosen. **This requirement is not plannable as written** — it goes through stage 2 (`timone-grill`) first, and its criteria are rewritten from that session before any phase consumes it.
- **Verification hint:** deliberately stale one entry against the live ecosystem and confirm the mechanism reports it, naming the entry and the specific instruction.
- **Origin:** the weekend of 2026-07-25/26, **five** approved entries were found to contain instructions that do not work — `create-next-app` cannot run in place; TypeScript 7 is uninstallable alongside `eslint-config-next`; `prisma.config.ts` has no `directUrl` key; the generators emit harness files R4 forbids; the Prisma client is unloadable by bare `node` without `importFileExtension`. Each was correct when written and each was discovered only because something finally executed it. Entries bind every managed project, so an undetected stale entry is followed faithfully until someone stubs a toe on it.
