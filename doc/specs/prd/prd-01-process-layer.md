# PRD-01: The Process Layer — a Skill for Every Stage

> **Status:** Active
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-01-process-layer.criteria.md](prd-01-process-layer.criteria.md)
> **Phases:** [phase-01](../../plans/phases/phase-01.md) (foundations: process spec, manifest, workspace sync — R1, R2, R3)

## Problem

The `poc-*` skills matured on client work prove that a document-driven, skill-per-step process works: interview → PRD → phase plan → orchestrated execution → feedback triage, with stable requirement IDs and fresh-context verification holding it together. But that pipeline is welded to one customer's monorepo (hardcoded PoC lists, paths, stack assumptions), and it does not cover the whole of software engineering: there is no intake/triage step, no architecture step, verification is buried inside execution, and delivery/deployment/maintenance are absent.

Timone's first deliverable — before any automation — is the complete process layer: one skill per lifecycle stage, project-agnostic, driven by a single written definition of the process. This is requirement #1; the inverted control loop ([PRD-02](prd-02-inversion-of-control.md)) orchestrates these same skills later.

## Goals

- Every development-side stage of the lifecycle is runnable today, interactively, on any managed project — no stage lives only in someone's head or in a customer-specific skill.
- The process has one written source of truth (the process spec); skills implement it rather than each implying its own variant.
- The foundations the automation will need — the workspace manifest, project onboarding, skills reaching project sessions without polluting client repos — exist from the start.

## Scope

### In scope

**One written process.** A process specification document in the Timone repo defines each lifecycle stage: its purpose, the artifact it produces, the gate that closes it, and the skill that owns it (R1). Skills reference and conform to it.

**Workspace foundations.** A `timone.yaml` manifest declares each managed project — repository, local path, stack, platform bindings (R2) — and a workspace sync command materializes it, cloning or updating repos under the gitignored `projects/` directory (R3). Timone's lifecycle skills are available in any agent session working on a managed project, without ever being committed to the project's repo (R4). An onboarding skill brings a new or existing repo under management: manifest entry, doc structure, confirmed product overview (R5).

**The stage skills.** Generalized from the `poc-*` lineage where it exists, filled in where it doesn't:

- *Triage* (R6): classify an incoming request — feature, bug, chore, question — and route it to the right process entry point.
- *Grill* (R7): the relentless requirements interview, one question at a time with recommendations, answering from the codebase when possible.
- *PRD* (R8): persist requirements as the two-file pair — stakeholder narrative plus formal criteria register with stable, never-renumbered requirement IDs.
- *ADR* (R9): record significant technical decisions as numbered Architecture Decision Records in the project repo, with a supersede lifecycle — written on demand whenever such a decision arises.
- *Plan* (R10): turn a PRD into a phase file of thin vertical-slice sub-phases, each with runnable validation steps; gated on PRD anchoring and on undocumented architecture decisions (which trigger the ADR skill first).
- *Execute* (R11): orchestrate the phase plan through fresh-context sub-agents with handoffs, budgets, and a completion report.
- *Verify* (R12): the fresh-context check of a build against its criteria register — extracted from execution into its own skill so it can also run standalone as a regression suite.
- *Deliver* (R13): produce the branch and pull request, carrying the verification outcome and linking the driving ticket or requirement.
- *Improve* (R14): triage post-delivery feedback — intent change vs implementation gap — and route the remediation, amending PRDs/ADRs when intent moved.

**Standards and test discipline** *(added 2026-07-19 after the standards/TDD grilling; inspired in part by Matt Pocock's engineering skills)*. Onboarding additionally elicits project constraints into the product overview, records stack choices as founding ADRs, and produces a deliberately thin `doc/standards.md` — applicable central-library entries plus deviations, never restating what tooling enforces; for existing codebases, conventions are observed, not imposed (R15). Timone hosts the central standards library, seeded for the preferred stack with content authored by the human (R18). Implementation follows a TDD red→green loop at seams declared per sub-phase at planning time (R16), and delivery is preceded by a two-axis review — Standards and Spec, separately reported (R17). The grill stage maintains a per-project domain glossary (R19).

### Out of scope

- The *deploy* and *maintain* stage skills — defined as stages in the process spec, implemented post-MVP.
- Everything automated: the daemon, ticket-driven triggering, async comment gates, previews — all of it is [PRD-02](prd-02-inversion-of-control.md), which consumes the skills specified here.
- Authoring the standards-library *content* — the human writes and reviews it (structure and injection are in scope, R18). The non-`poc-*` customer skills under `tmp/` are explicitly not source material.
- External/customer-shared spec stores; GitLab/Jira bindings.
- Migrating the customer `poc-*` monorepo itself onto Timone.

## Open Questions

- **Skill delivery mechanism:** how skills physically reach a session working under `projects/<name>` without being committed there — user-level skills dir, symlink, or SDK injection (interactive vs daemon may differ). To be settled in the first phase plan.
- **ADR scope threshold:** what counts as "significant" enough for an ADR — needs a working rule of thumb in the process spec (current lean: any decision that constrains future phases or is expensive to reverse).
- **Process spec granularity:** one page per stage vs one compact table — start compact, grow as skills land.
