# Handover — Timone — 2026-08-02

> Prior handover: [2026-08-02-phase-10-verification-pending.md](2026-08-02-phase-10-verification-pending.md) — its "Exact next action" list is fully discharged; read this file instead.

## Snapshot

**Phase 10 is closed and PRD-01 is done as far as it will be taken for now.** The feedback stage exists, was proved against four real intakes, and drove one of them the whole way round to a pull request — so the lifecycle loops rather than ending at delivery. R14 is `verified`; 22 of PRD-01's 24 requirements are. The next body of work is **PRD-02, the inverted loop** — the daemon that drives these stages from tickets instead of them being typed by hand. fvermaut's reason for going there next rather than filling PRD-01's remaining gaps: **PRD-02 is the last thing needed before starting on a real client project, and a real project is what will actually prove all of this.** Nothing is in flight; the tree is clean and pushed on both repos.

## Done this session

- **Phase 03 verified on `scratch-app`** — clean first pass, 0 of 2 fix loops. [`phase-03-verification.md`](../../projects/scratch-app/doc/plans/phases/reports/phase-03-verification.md), commit `b52bfab`.
- **Phase 03 delivered** — [`scratch-app` PR #3](https://github.com/fvermaut/scratch-app/pull/3), base `main`, **open and not merged**. Spec axis: no findings. Standards axis: 2. [`phase-03-delivery.md`](../../projects/scratch-app/doc/plans/phases/reports/phase-03-delivery.md), commit `1442870`.
- **10d and phase 10 closed** — commit `b2d3ecb`. Full account in [`phase-10-complete.md`](../plans/phases/reports/phase-10-complete.md); do not restate it, read it.
- **PRD-01.R14 → `verified`**, with two limits written into the register as markers rather than left implied (see Decisions).
- **Two process corrections beyond 10d's plan** — `process.md`'s push rule and `timone-verify`'s allowed list. Both explained in the completion report.

## In flight / blocked

**Nothing on Timone.** Phase 10 is stamped `Complete`, every checklist box is ticked and was re-verified rather than assumed, and `main` is pushed.

On `scratch-app`, waiting on fvermaut and blocking nothing here:

- **PR #3 is open and must not merge without him.** It carries an unticked PRD-01.R7 screen-reader HUMAN-CHECK (VoiceOver + Safari, ~10 min) that no agent can discharge.
- **PR #3's two Standards findings are unactioned and unqueued** — `revalidateTodos` is named for the Next API the project rejected, and `todo-cache.ts` skips `server-only` with the exemption argued in a JSDoc rather than in `doc/standards.md`. Route: `/timone-improve scratch-app phase-03 delivery review findings`.
- **`scratch-app` PRD-01.R6 is a MUST that nothing regression-checks** until the queued first-load-freshness phase re-verifies it against its new wording.

## Decisions made this session

All fvermaut, 2026-08-02:

- **`phase-10.md` re-approved** after the six-classes-became-seven scope change that had voided its 2026-08-01 stamp. Re-approved **on the evidence, not on the marker** — by then the seventh class had been used for real and the loop had closed at a PR.
- **R14 flipped to `verified`**, with two limits recorded on the criterion: its text still names six classes when there are seven (correcting it is stage 9's write on its own record, not stage 7's), and **the `revised`-drops-out rule has a live case that does not discriminate** — `scratch-app` R6 was excluded by its `browser` channel regardless of status, so the rule was never load-bearing. Discriminating evidence needs a MUST + `api` + `verified` criterion to go `revised`; none exists.
- **10d absorbed two corrections beyond its plan**: the push rule into `process.md`, and the prior-verification-report entry into `timone-verify`'s allowed list. Both were defects this phase's own execution exposed.
- **PRD-02 is next, and the following are explicitly deferred**: the deployment and maintenance skills, R23 (onboarding repair), R24 (standards drift — needs a grill session before it can be planned), the three unenforced rules, `timone-wayfind`'s first real use, and the never-fired give-up-and-ask-a-human path. **Deferred, not dropped** — they are still in `STATUS.md` under known problems.

## Exact next action

**Plan PRD-02's first phase — `doc/plans/phases/phase-11.md` — by hand, then get fvermaut's approval stamp.**

Three facts that will otherwise cost the next session an hour of rediscovery:

1. **`/timone-plan` cannot be used for this.** Every stage skill validates its target against `timone.yaml` and touches only `projects/<name>/…`; Timone is not a managed project. Phases 01–10 were all hand-planned and hand-executed, and phase 11 will be too. The skill is still the authority on *shape* — thin vertical slices, declared TDD seams, per-slice validation steps, an approval stamp — just not the instrument.
2. **PRD-02 is `Active` with 12 requirements, all `draft` except R2 (`revised` since 2026-07-20, when [ADR-0007](../adr/0007-sessions-at-timone-root.md) moved sessions to the timone root).** Narrative: [`prd-02-inversion-of-control.md`](../specs/prd/prd-02-inversion-of-control.md). Register: [`prd-02-inversion-of-control.criteria.md`](../specs/prd/prd-02-inversion-of-control.criteria.md). **`Phases: none yet`** — phase 11 is the first, and the PRD's `Phases:` line needs updating when it exists.
3. **The runtime foundation is not installed.** `package.json` has `commander`, `yaml`, `zod` and nothing else; there is **no Agent SDK dependency**, no GitHub adapter, no daemon. [ADR-0002](../adr/0002-typescript-claude-agent-sdk.md) and [ADR-0003](../adr/0003-local-daemon-agent-runtime.md) fix the choices; the code does not exist. `src/` currently holds `manifest.ts`, `workspace.ts`, `git.ts`, `cli.ts` and the two command modules — the CLI, not the loop.

The governing ADRs to re-read before slicing: [0002](../adr/0002-typescript-claude-agent-sdk.md) (SDK), [0003](../adr/0003-local-daemon-agent-runtime.md) (daemon on own hardware), [0004](../adr/0004-github-first-adapter-pair.md) (GitHub-first adapters), [0005](../adr/0005-docker-previews-on-own-host.md) (previews), [0007](../adr/0007-sessions-at-timone-root.md) (sessions at root — R2's reason).

## Open questions

- **The Docker preview machinery has never served a page, and PRD-02 is where that stops being deferrable.** [ADR-0005](../adr/0005-docker-previews-on-own-host.md) is a founding decision that has never once executed; `timone-prototype` was built on top of it and never run. PRD-02's **R8 (preview per PR, MUST)** and **R12 (teardown, SHOULD)** are directly about it. fvermaut deferred this as a general concern at the end of this session — that judgement was made about it as a background gap, and phase planning should surface that R8 puts it on the critical path. Worth deciding early whether the first phase proves the preview path or deliberately defers it to a later one.
- **How much of PRD-02 is one phase?** Twelve requirements spanning a daemon, two adapters, three async gates and a preview lifecycle is more than one phase's worth. The slicing decision — and how many phases PRD-02 becomes — is the first thing to settle with fvermaut, and it is a planning conversation, not a fact to look up.
- **Nothing enforces three rules that are now written down**: `STATUS.md` on the default branch only, every stage pushes what it commits, and the docs-last sequencing window. All three are "the spec says so and agents mostly comply". The daemon is the first thing that could enforce any of them mechanically — worth holding in mind while slicing, without letting it grow PRD-02's scope.
- **R24 needs a grill session before it can be planned at all.** Deferred by fvermaut; recorded so it is not mistaken for something an agent can pick up unattended.
- Carried unchanged from the prior handover: whether to delete `scratch-app`'s merged `phase-01-to-do-list-vertical` branch.
