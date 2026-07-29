# Handover — Timone — 2026-07-29

> Prior handover: [2026-07-28-phase-08-verify-skill.md](2026-07-28-phase-08-verify-skill.md)

## Snapshot

Phase 09 is planned, executed, gated and closed: stage 8 has a skill, and Timone now has **nine of twelve stage skills with 21 of 24 requirements verified**. `timone-deliver` opened two real pull requests on `projects/scratch-app`, and **fvermaut merged the first** — the first work Timone has taken from an empty repository to merged through every stage. Two prerequisites the prior handover had not both caught were closed inside the phase: the code-smell reference did not exist, and neither did any GitHub remote or `gh` binary anywhere in the workspace. Nothing on Timone waits on a human. The next phase is feedback (stage 9), the last real gap — stages 10 and 11 are deliberately post-MVP.

## Done this session

- **Phase 09 planned, approved, executed and closed** — [phase-09.md](../plans/phases/phase-09.md) (`Complete`), report at [phase-09-complete.md](../plans/phases/reports/phase-09-complete.md). Commits `3bafe5f` → `78617d6`.
- **Stage 8's spec written** — nine decisions in [process.md](../../process.md)'s stage-8 note (`e25258d`), plus a **correction to stage 6** and a **third standards-library tier**.
- **`timone-deliver` written** — [.claude/skills/timone-deliver/SKILL.md](../../.claude/skills/timone-deliver/SKILL.md) (`a148cec`), amended twice during the dry run (`4046b06`).
- **The code-smell review reference written and approved** — [standards/code-smells.md](../../standards/code-smells.md) (`92a5178`, approved `ff8a547`).
- **R13, R17, R21 and R22 flipped to `verified`** in [prd-01-process-layer.criteria.md](../specs/prd/prd-01-process-layer.criteria.md) — 17 of 24 → 21 of 24.
- **R21/R22 verification report** — [phase-09-verification.md](../plans/phases/reports/phase-09-verification.md) (`8c9b9a1`). R21 clean; R22 failed and passed after two fix loops.
- **`scratch-app` migrated to a real GitHub remote** — `github.com/fvermaut/scratch-app` (private), `gh` 2.96.0 installed and authenticated. Manifest repointed via `projects update` (`5c8daf5`); `timone.yaml` is now tracked (`e1adeca`).
- **`timone-verify`'s Closing fixed** — it prescribed `/timone-deliver <project>` with no phase reference, the identical defect 08c round 1 found in `timone-execute`.

## In flight / blocked

Nothing on Timone is in flight or blocked. Three items sit with fvermaut **on `scratch-app`, not on Timone**, none of which block phase 10:

- **[PR #2](https://github.com/fvermaut/scratch-app/pull/2)** — open, retargeted to `main`, `MERGEABLE`. Carries the **2 ms latency-budget decision** (three options in that project's `phase-02-verification.md`).
- **R7's screen-reader HUMAN-CHECK** — still unperformed by choice, and now on **merged** code. Script in that project's `phase-01-verification.md`.
- **Nine review findings from PR #1**, merged unaddressed by design — see *Exact next action*.

## Decisions made this session

- **Stage 6's refactoring sentence was wrong, and stage 8 was right** — the phase's load-bearing decision. Stage 6 promised implementers that refactoring belongs to the delivery review, which reads as delivery *applying* it; stage 8 says the reviews only report. Delivery may never commit code: it would land after the verification report certifies the behaviour and before the human reads it, invalidating stage 7's evidence at the moment it is presented. Remediation goes through stage 9.
- **Delivery is GitHub-only, and the refusal is terminal** — no doc-record fallback of the kind stage 1 has, because a delivery record with no review surface would ship nothing while reporting success. Gate order is **work before host**, so an unverified phase hears that rather than a complaint about its host.
- **The code-smell list is a third library tier, not the mandatory baseline** — the baseline admits no exceptions while stage 8's own rule lets a project's `doc/standards.md` override the smell list. `process.md`'s standards section names the tier and its sanctioned exception to the universality rule.
- **`STATUS.md` is written only on a project's default branch, never on a work branch** (fvermaut, 2026-07-29) — every stage rewrites the whole file, so two branches editing it collide on merge. Recorded in `process.md` § Status reporting with its mechanics (commit on the default branch, then return the clone to the branch it was on) and in the stage-7 and stage-8 skills. `scratch-app` was repaired by hand; the collision fired for real on the attempt to merge PR #2.
- **Both `STATUS.md` files were rewritten** after R22 failed its own naive-reader test twice. The first reader found the two files contradicting each other on whether delivery existed — a window this session opened by updating the project's file during the dry run while Timone's waited for docs-last.
- **No ADRs.** All the above fail the significance test's *hard to reverse* part, the same reasoning that kept phases 06–08's conventions out of the log.
- **The nine review findings stay unaddressed**, deliberately, as phase 10's fixture.

## Exact next action

**Plan phase 10 — feedback: `timone-improve` (PRD-01.R14).** Timone's own phases are hand-planned, so write it by hand against [phase-08.md](../plans/phases/phase-08.md)/[phase-09.md](../plans/phases/phase-09.md)'s sub-phase shape.

**No prerequisite is missing this time** — and the fixture is unusually rich, which is the opposite of phase 09's problem. Waiting on `scratch-app`: nine review findings across two PRs (six Standards, three Spec, in the two delivery reports), two open HUMAN-CHECKs, one stale `doc/standards.md` line the Spec axis rediscovered, and merged code carrying an unconfirmed accessibility requirement. **Do not spend these by hand** — stage 9's whole job is deciding intent-versus-implementation and remediating after confirmation, and this is the first genuine post-delivery feedback the workspace has ever held.

R23 (onboarding repair) is also plannable. R24 remains barred from planning until a `timone-grill` session rewrites its criteria.

## Open questions

- **Nothing enforces the `STATUS.md` branch rule.** It is written into `process.md` and both skills, but no check confirms a stage obeyed it — this session's instance was fixed by hand, and the next lapse surfaces as a merge conflict. Recorded under *Known problems* in [STATUS.md](../../STATUS.md); a candidate for stage 9's remediation or a CLI check.
- **Docs-last sequencing on Timone's own phases reopens the status-contradiction window** every phase. 09f closed this instance by bringing Timone's file current mid-phase, ahead of 09g. Needs a convention, or accepting the window.
- **Should the phase-01 branch be deleted** now that PR #1 is merged? Keeping it left PR #2 needing a manual retarget. fvermaut decides; it also bears on whether the stacked-branch case stays exercised in the fixture.
- **A range-bounded review cannot always resolve a contradiction whose resolution lives in the base** — the Spec axis found a real one and got its direction wrong for exactly that reason. Whether stage 8 should let an axis consult the base is unresolved; it hedged correctly, so this is a refinement, not a defect.
