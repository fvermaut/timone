# Phase 08 — Completion Report

- **Date:** 2026-07-28
- **Plan:** [phase-08.md](../phase-08.md) — breakdown approved by fvermaut 2026-07-26; 08c's dry-run gate passed by fvermaut 2026-07-28
- **Requirements:** PRD-01.R12 (MUST) → `verified`; PRD-01.R20 (MUST) → `verified` (its third criterion delivered here; the first two were already evidenced by the phase-02 and phase-04 verification reports)
- **Branch:** none — Timone's own phases are hand-run on `main` (`timone-plan` and `timone-execute` are managed-projects-only by choice)

## Summary

Stage 7 now has a skill. `timone-verify` takes a completed phase, stands the application up in its production form, and checks each in-scope criterion against the criteria register from a context that never saw how the thing was built — no handoffs, no diffs, no source, not even the committed test suite. What it cannot check mechanically it writes as a manual script for the human rather than assuming. What fails, it briefs to a separate fix context and re-verifies in full, twice at most, and it is the only stage permitted to write the register's `Status` field.

**The centre of gravity turned out to be the verifier's own instruments, not its rules.** The stage-7 spec was one paragraph and needed eight decisions to become executable (08a), and the skill that restates them was straightforward to write (08b). What the dry run exposed was subtler and more valuable: an independent checker with correct rules can still return a confident, wrong answer, because the *probe* it authors to observe the app can silently perform the very behaviour it is checking. That is the verification-side twin of stage 6's tautological-assertion anti-pattern, and nothing in the process had a name for it until this phase.

**Both halves of R12's verification hint were discharged, one of them twice.** The hint asks for a standalone run against the pilot after an execution, then a deliberate break of a verified behaviour expecting a REGRESSION verdict. The first attempt at the break returned all-PASS. The rules added in response then caught it correctly on re-run — and caught a second defect nobody had planted.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 08a — stage-7 spec decisions + skills-README reconciliation | Eight decisions written into `process.md`: verdict vocabulary with REGRESSION as the FAIL variant for previously-verified criteria and BLOCKED's no-loop/no-flip semantics; the closed read list; the scope rule including the un-anchored degenerate case; fix-loop mechanics; register write timing; report required elements; the production-form rule; the derived regression suite. Skills README admits stage-7 fix commits. | `45717ea` |
| 08b — the `timone-verify` skill | Written in house style: stance, the six-step targeting preamble, three terminal gates, branch mechanics including the stacked-parent merge, channel dispatch with the mandatory accessibility leg, the fix-loop contract, and three inline templates (report, defect brief, HUMAN-CHECK script). Closing names `/timone-deliver`, which does not exist yet. | `e0b85cf` |
| 08c — dry run, four runs + human gate | All four runs landed; three rounds of defects found and fixed (below). Human gate passed by fvermaut 2026-07-28. | `21f9210`, `c9d503a`, `3ba62a8`, `d80f8e2` |
| 08d — documentation | README command list and Status paragraph; R12 and R20 flipped to `verified` after the gate; `STATUS.md`. | this commit |

## The dry run, and what each round found

**Run 1 — full pass on `scratch-app` phase-01.** Ran as planned. The real focus-after-delete defect was found mechanically (`document.activeElement` landing on `<body>`), briefed, fixed by a fresh fix context, and re-verified PASS in loop 1 of 2. R1–R6 flipped to `verified`; R7 stayed `draft` behind a partial-evidence marker because its screen-reader clause can only be closed by a human.

> **Round 1 defect — in `timone-execute`, not this skill.** Its Closing prescribed `/timone-verify <project>` with no phase reference, while verification refuses to pick a phase for the user. The prescribed handover would have stranded any project past its first phase. Fixed in `timone-execute`.

**Run 2 — the sanctioned regression break.** A commit removing the trim from title normalization, its message naming itself a probe. The first attempt **returned a false all-PASS**, and the reason is the phase's most useful finding: the verifier's R1 probe posted the padded title with `curl -F`, whose multipart parser strips the padding itself. The probe pre-applied the transformation it was checking, so it could only agree with the app. The verifier was also holding the alarm — the build-health smoke was failing on exactly those trim tests — and filed the contradiction as a note for the human while letting its verdicts stand.

> **Round 2 defect — two rules, both now in `process.md` and the skill.** A probe must be shown able to detect the failure it exists to catch, and transformation clauses must prove verbatim transmission to the app's boundary. And a smoke/probe contradiction is an instrument alarm that blocks the pass until resolved instrument-side — filing it as a discrepancy for the human while verdicts stand is precisely the false-negative path the rule exists to close.

Re-run under the corrected skill, the pass caught the planted break as **REGRESSION** on R1 — correctly labelled, not a plain FAIL — and found a second, genuine defect nobody planted: mutations intermittently committing server-side without reflecting in the UI, seen 4 times in ~130 driven mutations. Both were briefed to separate fix contexts and fixed in one loop (`9cd7c5b`, `8d1fb9f` on the fixture).

**Run 3 — the un-anchored phase-02.** Ran as expected, and the stacked-parent merge rule proved load-bearing rather than tidy: at phase-02's own tip every register line still read `draft`, so without merging phase-01 in first the regression set would have derived *empty* — the pass would have re-run nothing while appearing to satisfy the zero-regressions gate. The calibration rule paid twice more here, discarding another probe that could not fail and catching a probe-side false FAIL on R4 that would otherwise have sent a fix context at working code.

**Run 4 — the entry-gate probes, which turned out to be two runs.** A *nonexistent* phase never reaches gate 1; it stops at the input-resolution rule that refuses to pick a phase for the user (4a). Gate 1 needs a phase file that exists and is not stamped `Complete`, and neither fixture had one — so `scratch-existing` gained a hand-authored approved-but-unexecuted phase-02, the same way phase 07 hand-authored its approval-gate plan (4b). Both refused terminally, wrote nothing, and routed correctly.

> **Round 3 defect — the read list forbade its own mandated steps.** Every run had to disclose a deviation: the verifier needs the compose file and `.env` to learn which port and credentials stand the app up, and needs `STATUS.md` because stage 7 is obliged to write it. A closed list that makes its own instructions impossible trains agents to step around rules. Operational configuration is now admitted by name; application configuration a criterion's behaviour depends on stays forbidden.

**Deliberately not run: loop exhaustion.** The 2-loop bound and the handed-to-the-human protocol are fully specified and templated, and have never fired. This repeats phase 07's accepted position on escalation: provoking it would mean engineering a trap designed to defeat a competent verifier, which tests ingenuity rather than the tool. Its first genuine firing on a real project is its test.

## Deviations from the plan

- **Run 2 took three report iterations rather than two**, because of the false-pass defect above. Recorded in the phase file with a dated `✏ Refined` marker.
- **Run 4 became 4a and 4b.** The plan offered two fixtures for one probe and they test different things; this is a correction of a plan defect execution found, so the approval stamp stood.
- **`scratch-existing` gained a fixture phase file** (`doc/plans/phases/phase-02.md`, approved but never executed) to give gate 1 something to fire against. It stays as a fixture.
- **The sanctioned break and its repair remain in `scratch-app`'s history**, per the default posture, confirmed by fvermaut at the gate.
- Everything else executed as planned.

## Context for the next agent

**Phase 09 is delivery** — `timone-deliver` (PRD-01.R13) plus the two-axis review (R17), which `timone-verify`'s Closing already names as the next invocation. Two things it will need that do not exist yet:

- **The "fixed code-smell baseline" stage 8 references has no entry in `standards/`.** The Standards axis of the two-axis review is specified against a document nobody has written.
- **`scratch-app` is the fixture, and it is now genuinely ready**: two phases complete, both verified, three fix commits from verification on the phase-01 branch, and refactorings the phase-01 completion report deliberately deferred *to the delivery review* — `useOptimistic` on the checkbox, duplicated action wrappers, a ~55-line duplicated fixture. The Standards axis has real material waiting.

**Open against `scratch-app`, carried to its human, not to Timone:** the R7 screen-reader HUMAN-CHECK (script in the phase-01 verification report, unperformed by choice); the 2 ms latency budget decision from phase 02 (three options in the phase-02 verification report); a stale line in its `doc/standards.md` still listing the focus non-conformance that verification has since fixed; and two open baseline non-conformances (no `app` service in `compose.yaml`; no message layer).

**Still true of Timone itself:** R21 (handover) and R22 (`STATUS.md`) are built but never formally verified — cheap to close on any future pass. R23 (onboarding repair) is plannable now. R24 (standards drift) remains barred from planning until a `timone-grill` session rewrites its criteria.
