# PRD-01: The Process Layer — a Skill for Every Stage

> **Status:** Active
> **Project:** timone — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-01-process-layer.criteria.md](prd-01-process-layer.criteria.md)
> **Phases:** [phase-01](../../plans/phases/phase-01.md) (foundations: process spec, manifest, workspace sync — R1, R2, R3 ✓), [phase-02](../../plans/phases/phase-02.md) (stage skills at the root: grill, PRD, ADR — R4, R7, R8, R9, R19 ✓), [phase-03](../../plans/phases/phase-03.md) (standards library content — R18 ✓, R20 partial), [phase-04](../../plans/phases/phase-04.md) (onboarding: `projects add` + `timone-onboard` — R5, R15 ✓)

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
- *Handover* (R21, cross-cutting utility, not a lifecycle stage): capture the state of an in-progress session — done, in-flight, decisions since the last handover, exact next action — as a dated doc referencing artifacts by path, so a fresh session can resume without re-deriving context.

**Standards and test discipline** *(added 2026-07-19 after the standards/TDD grilling; inspired in part by Matt Pocock's engineering skills)*. Onboarding additionally elicits project constraints into the product overview, records stack choices as founding ADRs, and produces a deliberately thin `doc/standards.md` — applicable central-library entries plus deviations, never restating what tooling enforces; for existing codebases, conventions are observed, not imposed (R15). Timone hosts the central standards library, seeded for the preferred stack — content drafted by agents from cited primary sources and approved by the human (R18). Implementation follows a TDD red→green loop at seams declared per sub-phase at planning time (R16), and delivery is preceded by a two-axis review — Standards and Spec, separately reported (R17). The grill stage maintains a per-project domain glossary (R19).

**Keeping the process and its inputs repairable** *(added 2026-07-26, both found by executing `scratch-app` phase 01)*. Onboarding gains a **repair mode** (R23): a project already in the manifest and already cloned, but missing a stage-0 artifact, must be fixable through the process rather than by overriding the skill's refusals by hand — which is the only way `scratch-app`'s missing `doc/standards.md` was recovered, since the sole skill permitted to write that file refuses to run on any project that already exists. And the standards library gains **drift detection** (R24): entries are approved against an ecosystem state at a date, five of them were found stale in one weekend, and each was discovered only because something finally ran it. R24's mechanism is deliberately undecided — it goes through the grill stage before it is plannable.

**Mandatory accessibility & UI/UX baseline** *(added 2026-07-19)*. The standards library has a **baseline tier** applied to every project with no opt-out: UI/UX guidelines and accessibility — a legal requirement under the European Accessibility Act (EAA, applicable since June 2025), with EN 301 549 / WCAG 2.1 AA as the working baseline. Every onboarded project's `doc/standards.md` includes the baseline unconditionally; PRDs for user-facing functionality carry accessibility acceptance criteria; browser-channel verification includes accessibility checks (R20).

### Out of scope

- The *deploy* and *maintain* stage skills — defined as stages in the process spec, implemented post-MVP.
- Everything automated: the daemon, ticket-driven triggering, async comment gates, previews — all of it is [PRD-02](prd-02-inversion-of-control.md), which consumes the skills specified here.
- Importing content from the non-`poc-*` customer skills under `tmp/` — never source material; standards content is drafted by agents from primary sources and human-approved (R18, phase-03).
- External/customer-shared spec stores; GitLab/Jira bindings.
- Migrating the customer `poc-*` monorepo itself onto Timone.

## Open Questions

- ~~**Skill delivery mechanism:** how skills physically reach a session working under `projects/<name>` without being committed there.~~ **Closed 2026-07-19 by [ADR-0007](../../adr/0007-sessions-at-timone-root.md)**: sessions run at the timone root, so skills are ordinary `.claude/skills/` entries and there is no delivery mechanism at all.
- **ADR scope threshold:** what counts as "significant" enough for an ADR — needs a working rule of thumb in the process spec (current lean: any decision that constrains future phases or is expensive to reverse).
- **Process spec granularity:** one page per stage vs one compact table — start compact, grow as skills land.
