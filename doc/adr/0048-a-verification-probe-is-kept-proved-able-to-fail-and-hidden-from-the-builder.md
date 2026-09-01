# ADR-0048: A verification probe is kept, proved able to fail, and hidden from the builder

- **Status:** accepted
- **Date:** 2026-09-01
- **Source:** fvermaut's request of 2026-09-01 — *"the verify stage on ivtrends takes an awful lot of time. It seems the agent is running every tests one by one. There surely must be a more efficient solution than this."* — and the six answers given in the grill that followed
- **Amends:** [`process.md` stage 7](../../process.md), which today requires that all criterion evidence come from *"verifier-authored throwaway probes, in scratch space, never committed"*. That sentence is replaced by the decisions below. Nothing else about stage 7 changes: the closed read list, the channels, the verdicts, the fix loop and its two-loop cap, the register writes and the report's required elements all stand
- **Closes:** [timone#36](https://github.com/fvermaut/timone/issues/36) — *"Verification passed a probe that could not fail"* — whose own diagnosis is that the calibration rule is *"written as prose the verifier is asked to honour, with nothing that makes it observable whether it did"*
- **Standing:** [ADR-0006](0006-specs-in-repo-single-source-of-truth.md) — the probes are committed artifacts in the repo, like every other record; [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) — every run's box clones both repositories, which is why D4 is a hook and not a sentence

## Context

**Verification is the most expensive stage, and most of what it spends is spent twice.** The phase-16 pass on `ivtrends` ran 1 hour 13 minutes over 245 tool calls, 223 of them shell commands, at $34.51. It wrote **29 probe files, about 126 KB of code**, and deleted every one of them. Roughly half the wall clock was the model writing and reading; the other half was commands running, of which three accounted for 14.6 minutes (a 450-second data seed, a 219-second database pass, the 209-second committed suite run as the build-health smoke).

**Most of a pass re-checks what already passed.** Phase 16's scope was twelve criteria and **ten of them were the standing regression set** — 47 clauses re-probed from nothing. The register holds 24 criteria, 12 of them on the `api` channel, and PRD-02 adds 8 more. The regression set therefore grows towards 20 while the claimed set stays at about two per phase. Cost per phase rises with every phase shipped, and the rise is entirely re-authoring.

**The accessibility work is worse, and is not even in the regression set.** Of phase 16's 29 probes, roughly half were the baseline leg — the scan, colour contrast, the keyboard path, focus outlines, reflow. Those run on every phase carrying a screen, are written from scratch each time, and are not specific to `ivtrends` at all: [`standards/baseline/accessibility.md`](../../standards/baseline/accessibility.md) carries a *Verification (stage 7)* section that is the same list for every project Timone will ever manage.

**Throwing probes away was never what protected independence, and it does not prevent a lazy checker.** The rule's stated reason is that the committed suite *"encodes the builder's understanding of the requirements; verifying against it verifies the builder against the builder"*. That argument is about the **builder's** artifacts. A probe authored by a previous verifier is a stage-7 artifact, and stage 7 already accepts exactly this reasoning once: a verifier may read a prior verification report's HUMAN-CHECK scripts section, because *"a verification report is a stage-7 artifact written under these same rules: it carries evidence and scripts, never build knowledge."*

Meanwhile the failure the throw-away rule is imagined to prevent has already happened under it. timone#36 records three consecutive passes confirming the board was sorted by IV Rank while every one of the 520 rows carried IV Rank 100.0. The probe could not have failed. Discarding it afterwards changed nothing.

Alternatives considered:

- **Leave stage 7 alone and cut the regression set** — sample it, rotate it, or cap it. Rejected: it buys speed by giving up the guarantee. The right move is to make the full re-check cheap, not smaller.
- **Weaken the full re-verify after a fix loop.** Rejected for the same reason, and it becomes unnecessary: once the set is one command, running all of it after every fix costs almost nothing.
- **Keep the probes but store them outside the project, in Timone.** Rejected as a hiding place. ADR-0041 D1 has every run's container clone **both** timone and the target project, so the builder's box holds them either way. Timone remains the right home for the *shared* probes (D5), for reuse, not for concealment.
- **Let the committed test suite serve as the regression set.** Rejected, unchanged: that is the builder's suite and the original objection to it stands in full.
- **Keep the builder out with a written rule plus an end-of-run report.** Rejected on timone#36's own lesson — one more sentence asking an agent to honour something, discovered too late to matter.

## Decision

### D1 — A verifier's probe is a committed artifact, and only stage 7 may write it

Probes live at `doc/plans/phases/probes/<criterion-id>.<ext>` in the target project — under `doc/`, beside the reports, never in the source tree and never in the project's own test directories. One file per criterion. It is committed in the same `docs: verify phase NN — <theme>` commit that carries the report and the register flip.

A probe is authored fresh when its criterion is first checked. Later passes **run** it rather than re-derive it. It is thrown away and written again from the register when the criterion's status goes `revised`, because changed intent makes the old probe stale by definition.

The read carve-out this creates is deliberate and is the same one stage 7 already grants HUMAN-CHECK scripts: **a stage-7 artifact carries evidence and scripts, never build knowledge.**

### D2 — A probe's pass is worthless until the probe has been seen to fail, in the same run

Every probe carries a second half that breaks, on purpose, the thing the probe exists to catch. Each run does both legs, in order:

1. Break it. Run the probe. **It must go red.**
2. Restore it. Run the probe. **It must go green.**

Green alone is not evidence. A probe that goes green on both legs is a broken instrument, and the run stops and says so rather than recording a pass.

This replaces the *Calibrate the instrument before trusting it* paragraph as the operative mechanism. The paragraph's reasoning stays; what changes is that the obligation is now executed and observable instead of requested. It also catches drift for free: a probe whose selector or query has stopped matching the application cannot be made to go red either, so silent decay surfaces as a stopped run.

### D3 — A probe that cannot be broken on purpose is still kept, and is flagged

Some clauses have no single fact to flip — *"nothing raw survives the night"* has no row that makes it false. Those probes are saved like any other, marked in the file and in the report by the verifier who wrote them, with the reason.

They still run. The report states the count plainly — *18 probes proven able to fail, 2 not* — so the unproven ones are a visible number rather than a silent assumption.

### D4 — The builder is blocked from the probe directory by a hook, not by an instruction

A `PreToolUse` hook refuses any read of `doc/plans/phases/probes/` during a stage-6 run, at the moment it is attempted. The directory also joins stage 6's never-read list, but the list is not what enforces it.

This is the risk the change creates and it is real: a builder that reads the verifier's probes writes code to pass them, and the independence hole moves rather than closes. The existing session bracket ([ADR-0018](0018-the-session-bracket-belongs-to-the-hooks.md)) already runs `guardrails baseline` at `SessionStart` and `guardrails check` at `Stop`; this is one more check, on the tool call.

### D5 — The baseline probes live in Timone, once, and every project runs the same ones

The accessibility and UI/UX baseline checks are Timone's, not any project's. They are written once under `standards/baseline/probes/`, take a page address and report what they found, and are invoked by every project's browser channel.

`doc/plans/phases/probes/` in a project therefore holds only what is specific to that project's rules and data. When the baseline changes, one probe changes and every project gets it.

### D6 — A probe names the clause it checks, in the register's words, and the verifier lines the two lists up

Each probe labels its output per clause — `=== R1 clause 4 — a watched name with no index membership is still ingested`. Each pass the verifier compares the register's clause list against the labels the probe printed. R3 has seven clauses; a probe printing six has a gap, and the missing clause is written now.

This is a comparison of two short lists, not a rewrite, and it catches a clause added to a criterion whose probe was never extended. It does **not** catch a probe that covers every clause but tests one of them wrongly; D2 is what limits that, since a probe aimed at the wrong fact usually cannot be made to go red on the right one.

### D7 — The regression set is run by one command, in parallel

A single runner executes the whole set concurrently against the standing application and prints a verdict table plus each probe's per-clause output. The report quotes that output, so its required elements are unchanged — *commands as run and per-clause outcomes* — while roughly 150 shell calls and the model turn behind each of them collapse into one.

## Consequences

- **The re-authoring cost disappears and does not come back as the register grows.** The ten-criterion regression set, and the baseline leg on every screen phase, become one command each. What still needs fresh authoring is the two-or-so criteria a phase actually claims, which is correct.
- **The full re-verify after every fix loop is kept, unweakened, and is now nearly free.** This was the outcome worth protecting.
- **timone#36's class of fault becomes unexpressible.** An ordering probe over a constant column cannot be made to go red, so it stops the run instead of passing three times.
- **A mistake now lives longer.** A probe misread from the register at birth is re-run forever and looks healthy. D2 and D6 limit it; neither eliminates it. This is the cost accepted, and it is accepted knowingly against a throw-away regime whose mistakes died in one pass but were re-made in the next.
- **Verification gains write access to a new directory in every managed project**, and stage 6 gains a hook that can refuse it. Both are new surfaces to maintain.
- **The baseline probes must be general enough for any project's page**, which is more work to write the first time than a bespoke script. The saving lands on every project from its first screen phase, so it repays quickly.
- **The command half of a pass is untouched.** Phase 16's 450-second data seed and its companions are project work — dumping the seeded database once and restoring it rather than rebuilding from empty — and are filed separately against `ivtrends`.
- **Browser criteria are still never re-checked once verified**, because the standing regression set is defined as MUST + `api` + `verified`. That gap existed because browser probes were expensive, and this ADR removes the reason without closing the gap. Left open deliberately, to be decided on its own.
