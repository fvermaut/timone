# PRD-01 Acceptance Criteria — The Process Layer

> Formal register for [prd-01-process-layer.md](prd-01-process-layer.md).
> Requirement IDs are stable — never renumber, never reuse, never delete.

## R1 — Process specification document

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** human
- **Criteria:**
    - GIVEN the process spec in the Timone repo
      WHEN reviewed
      THEN every lifecycle stage (triage, requirements, architecture, planning, implementation, verification, delivery, feedback, deployment, maintenance) is defined with: purpose, produced artifact, closing gate, and owning skill — deployment/maintenance marked "stage defined, skill post-MVP"
- **Verification hint:** read `doc/process.md` (location TBD) against the stage list above.

## R2 — Project manifest

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a `timone.yaml` declaring a project with repo URL, local path, stack, and platform bindings
      WHEN Timone loads its configuration
      THEN the project is listed as managed with the declared attributes, and an entry missing a required field is rejected with an error naming the field
- **Verification hint:** `timone projects list` (or equivalent) against a manifest with one valid and one invalid entry.

## R3 — Workspace sync

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a manifest project whose local path does not exist
      WHEN workspace sync runs
      THEN the repo is cloned to the declared path under `projects/`, and that path is invisible to Timone's own git status
    - GIVEN an already-cloned project with no local changes
      WHEN workspace sync runs
      THEN the clone is fast-forwarded; a clone with uncommitted changes is left untouched and reported
- **Verification hint:** `timone workspace sync` twice against a test repo; check `git -C projects/<name> log` and `git status` at the timone root.

## R4 — Skills reach project sessions, never project repos

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a managed project
      WHEN an agent session is started in its folder (interactively for now)
      THEN Timone's stage skills are invocable in that session, and no commit produced by any stage adds skill or harness files to the project repo (process artifacts under `doc/` excepted)
- **Verification hint:** invoke a stage skill from `projects/<name>`; `git log --stat` on produced branches.

## R5 — Onboarding skill

> ✏ Revised 2026-07-19: onboarding extended — constraints elicited into the product overview, stack choices recorded as founding ADRs, standards artifact produced (see R15). Gate now covers overview **and** standards.

- **Priority:** MUST
- **Status:** revised
- **Verify-via:** api
- **Criteria:**
    - GIVEN a repo not yet managed
      WHEN the onboarding skill runs
      THEN a valid manifest entry exists, the project's process doc structure is created (`doc/specs/`, `doc/specs/prd/`, `doc/adr/`, `doc/plans/phases/`), a product overview including project constraints is drafted, stack choices are recorded as founding ADRs under `doc/adr/`, a standards artifact per R15 is produced, and the user confirms overview and standards before they are saved
- **Verification hint:** onboard a scratch repo; check manifest entry, created tree, founding ADRs, and `doc/standards.md`.

## R6 — Triage skill

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** human
- **Criteria:**
    - GIVEN an incoming request (ticket text or free-form description) on a managed project
      WHEN the triage skill runs
      THEN it records a classification (feature / bug / chore / question), the process entry point it routes to (e.g. feature → grill, bug → improve), and a one-paragraph rationale
- **Verification hint:** run against three sample requests of different kinds; check routing matches the process spec.

## R7 — Grill skill (requirements interview)

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** human
- **Criteria:**
    - GIVEN a feature idea on any managed project
      WHEN the grill skill runs
      THEN questions come one at a time, each with a recommended answer; questions answerable from the codebase are answered from the codebase instead of asked; the session ends with a summary of decisions, outstanding risks, and a handoff suggestion to the PRD skill
- **Verification hint:** run an interview on the pilot project; check against `poc-grill-me` behavior minus PoC hardcoding.

## R8 — PRD skill

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a concluded interview (or equivalent input) on a managed project
      WHEN the PRD skill runs
      THEN a two-file pair exists under the project's `doc/specs/prd/`: a narrative free of Given/When/Then machinery, and a criteria register where every MUST has at least one Given/When/Then criterion, a verification channel, and a stable `PRD-NN.R<k>` ID — and the requirement list was approved by the user before files were written
- **Verification hint:** inspect the produced pair against the register's field rules; try to find a MUST without a testable criterion.

## R9 — ADR skill

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a significant technical decision arising on a managed project
      WHEN the ADR skill runs
      THEN a numbered record exists under `doc/adr/` with context, decision, consequences, and status; superseding an ADR creates a new record and flips the old one's status to superseded with a cross-link — never edits history
- **Verification hint:** create one ADR, then supersede it; check both files and their statuses.

## R10 — Plan skill

> ✏ Revised 2026-07-19: sub-phases additionally declare their seams under test (consumed by the TDD loop, R16); prefactoring and expand–contract sequencing added to the planning rules.

- **Priority:** MUST
- **Status:** revised
- **Verify-via:** api
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
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN an approved phase file
      WHEN the execute skill runs
      THEN sub-phases run in dependency order via fresh sub-agent contexts with handoff notes; each sub-phase's validation steps pass before the next starts; and a completion report is written under `doc/plans/phases/reports/`
- **Verification hint:** execute a two-sub-phase plan on the pilot; inspect handoffs and the completion report.

## R12 — Verify skill (standalone)

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a project with a criteria register and a runnable app
      WHEN the verify skill runs (invoked standalone or from execution)
      THEN a verifier context with no build knowledge checks each in-scope criterion per its channel, writes a verification report with PASS / FAIL / HUMAN-CHECK / BLOCKED verdicts and evidence, and updates register statuses; MUST+api criteria already verified are re-run as regression
- **Verification hint:** run standalone against the pilot after an execution; then break one verified behavior and re-run — expect a REGRESSION verdict.

## R13 — Deliver skill

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a completed and verified phase on a work branch
      WHEN the deliver skill runs
      THEN a pull request exists referencing the driving ticket/requirements, its description summarizes scope and verification outcome, and branch/commit conventions match the process spec
- **Verification hint:** `gh pr view` on the pilot repo; check cross-links.

## R14 — Improve skill (feedback triage)

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** human
- **Criteria:**
    - GIVEN post-delivery feedback on a managed project
      WHEN the improve skill runs
      THEN it classifies the layer (intent change vs implementation gap) and the remediation (bug fix / refinement / plan patch / new sub-phase / new phase / report amendment), amends the PRD (stable IDs, revised/deprecated markers) when intent moved, and executes the remediation only after user confirmation
- **Verification hint:** feed it one bug report and one "works as planned but not what I meant" case; check the two route differently and the PRD is touched only in the second.

## R15 — Thin per-project standards artifact

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
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
- **Status:** draft
- **Verify-via:** human
- **Criteria:**
    - GIVEN a phase file whose sub-phases declare seams under test
      WHEN the execute skill runs a sub-phase
      THEN tests are written only at the declared seams, each written and run failing (red) before the implementation that makes it pass (green), one slice at a time; refactoring is deferred to the delivery review; the full suite runs once at sub-phase end
- **Verification hint:** inspect the sub-agent transcript/handoff for a sub-phase: the test-red evidence must precede the implementing change; look for the named anti-patterns (implementation-coupled, tautological, horizontal slicing) in the produced tests.

## R17 — Two-axis delivery review

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN a completed, verified phase on a work branch
      WHEN the deliver skill runs
      THEN two parallel fresh-context reviews are produced — Standards (diff vs `doc/standards.md` + the smell baseline, skipping tool-enforced rules) and Spec (diff vs the PRD: missing requirements, scope creep, wrong-looking implementations) — reported separately in the PR, never merged into one ranked list
- **Verification hint:** run delivery on the pilot; check the PR description contains both reports under distinct headings, with spec findings quoting requirement IDs.

## R18 — Central standards library structure

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** api
- **Criteria:** Timone's repo hosts `standards/` with per-stack entries (seeded for the preferred stack: TypeScript, Next.js, Prisma/PostgreSQL, better-auth, Docker Compose local, Vercel + Supabase live); content is authored/reviewed by the human — Timone provides structure, injection into sessions, and the selection mechanism consumed by `doc/standards.md`.

## R19 — Domain glossary maintenance

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** human
- **Criteria:** the grill skill maintains `CONTEXT.md` lazily (created on first resolved term): glossary entries only, no implementation details; conflicting term usage is challenged during the interview and the resolved term recorded immediately.
