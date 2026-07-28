# Handover — Timone — 2026-07-28

> Prior handover: [2026-07-25-phase-07-execute-skill.md](2026-07-25-phase-07-execute-skill.md)

## Snapshot

Phase 08 is planned, executed, gated and closed in one session: stage 7 has a skill, and Timone now has eight of eleven stage skills with 17 of 24 requirements verified. `timone-verify` was proved against `projects/scratch-app` over four dry-run runs that cost three rounds of skill fixes — the middle one being the phase's most useful output, since the verifier returned a confident false "all PASS" on a genuinely broken app. Nothing on Timone waits on a human. The next phase is delivery (stage 8), and one prerequisite for it does not exist yet.

## Done this session

- **Phase 08 planned, approved, and closed** — [phase-08.md](../plans/phases/phase-08.md) (`Complete`), report at [phase-08-complete.md](../plans/phases/reports/phase-08-complete.md). Commits `eedf307` → `7054931`.
- **Stage 7's spec written** — eight decisions in [process.md](../../process.md) stage-7 note (`45717ea`, refined by `c9d503a` and `3ba62a8`): verdict vocabulary with REGRESSION as the FAIL variant for already-`verified` criteria, the closed read list, scope including the un-anchored case, fix-loop mechanics, register write timing, report required elements, production-form rule, and the derived regression suite.
- **`timone-verify` written** — [.claude/skills/timone-verify/SKILL.md](../../.claude/skills/timone-verify/SKILL.md) (`e0b85cf`).
- **PRD-01.R12 and R20 flipped to `verified`** in [prd-01-process-layer.criteria.md](../specs/prd/prd-01-process-layer.criteria.md), after fvermaut's 08c gate.
- **`scratch-app` phases 01 and 02 are verified** — three iterations in `projects/scratch-app/doc/plans/phases/reports/phase-01-verification.md`, one in `phase-02-verification.md`; its own `STATUS.md` and register carry the current picture, so no separate project handover was written.

## In flight / blocked

Nothing on Timone is in flight or blocked. Three items sit with fvermaut **on `scratch-app`, not on Timone**, none of which block phase 09:

- The R7 screen-reader HUMAN-CHECK — script in that project's `phase-01-verification.md`, unperformed by explicit choice.
- The 2 ms latency budget decision — three options in its `phase-02-verification.md`.
- A stale line in its `doc/standards.md` still listing the focus non-conformance that verification has since fixed.

## Decisions made this session

- **Phase 08's scope was R12 + R20's third criterion only** — deliver (R13/R17) deferred to phase 09; R21/R22 left unverified; R23 plannable but not taken; R24 still barred from planning until a `timone-grill` session rewrites its criteria.
- **A probe must be shown able to fail before its PASS counts, and a smoke/probe contradiction blocks the pass** (`c9d503a`). Added after the verifier's `curl -F` probe silently stripped the whitespace whose trimming it was checking, then filed the failing test suite as a note for the human while its verdicts stood. This is the verification-side twin of stage 6's tautological-assertion rule.
- **The stage-7 read list admits operational configuration and `STATUS.md`** (`3ba62a8`) — the original closed list forbade reading the compose file and `.env` needed to stand the app up, and the status file stage 7 is obliged to write. Application configuration stays forbidden.
- **`timone-execute`'s closing handover now names the phase** (`21f9210`) — it prescribed `/timone-verify <project>` with no phase reference, while verification refuses to pick a phase for the user.
- **The sanctioned regression probe and its repair stay in `scratch-app`'s history** (default posture, confirmed by fvermaut at the gate) — commits `137dd97`, `9cd7c5b`, `8d1fb9f`.
- **Loop exhaustion was deliberately not provoked**, repeating phase 07's accepted position: two skills now specify a hand-back path neither has ever fired, and engineering a trap to force one tests ingenuity rather than the tool.
- No ADRs were written — all eight stage-7 decisions failed the significance test's *hard to reverse* part, the same reasoning that kept phase 06's and 07's conventions out of the ADR log.

## Exact next action

**Plan phase 09 — delivery: `timone-deliver` (PRD-01.R13) plus the two-axis review (R17).** Timone's own phases are hand-planned, so this is written by hand against `phase-07.md`/`phase-08.md`'s four-sub-phase shape.

**Close one prerequisite first:** stage 8's Standards axis is specified against "a fixed code-smell baseline" that has never been written — there is no such entry under `standards/`. Decide whether phase 09 drafts it as a sub-phase or whether it precedes the phase.

## Open questions

- **Does the code-smell baseline become a standards entry inside phase 09, or before it?** — fvermaut decides; it is a standards-library authorship question, and library entries are agent-drafted from cited sources and human-approved.
- **When do R21 (handover) and R22 (`STATUS.md`) get verified?** — both are built and never formally checked; cheap to fold into any future verification pass. Needs no decision, just a slot.
- **`timone.yaml` is untracked at the Timone root** and has been since before this session — intentional or an oversight? fvermaut resolves.
