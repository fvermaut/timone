# Phase 42 — Departures

> One dated entry per departure from the plan or the requirements, appended by the build, the check and delivery. Never rewritten.

## 2026-10-02 — timone#185, build

**Kind:** plan step
**Agreed:** A ticket-driven piece is built only from an approved list of pieces at `doc/plans/breakdowns/ticket-NN.md`.
**Did instead:** Built with no list file. fvermaut approved PRD-06 and ADR-0061 in the terminal on 2026-10-02, on the stated understanding that the work would be planned, built, checked and opened as one pull request, with nothing more asked of him.
**Why:** That approval is the list of pieces, with one piece. Writing a file and asking him to approve it again would ask the same question twice.

## 2026-10-02 — timone#185, build

**Kind:** plan step
**Agreed:** Sub-phase 42b edits the shared probes' `README.md` (:30-39, in the probe folder under `standards/baseline`) to state the new break-run rule.
**Did instead:** The edit is moved to phase 42's checking step. The plan is amended in place.
**Why:** The file sits in the shared probe folder. Only the checking step may write there (ADR-0048 D1), and the hook refuses the folder to a building session, which this session declared itself to be. The hook also refuses any command or sub-agent prompt that contains the folder's path as text, even to forbid it; that is filed as a fault of its own, [#192](https://github.com/fvermaut/timone/issues/192).

## 2026-10-02 — timone#185, build

**Kind:** plan step
**Agreed:** The box spawn asks for a token that lives `FORGE_REFRESH_MS + BOX_TOKEN_MARGIN_MS`.
**Did instead:** It asks for the interval the box's own refresh loop will wait, plus the margin. The plan is amended in place.
**Why:** The loop waits `options.refreshIntervalMs` when one is set. With the plan's wording, an interval longer than 20 minutes would hand a box a token that dies before its first refresh.

## 2026-10-02 — timone#185, build

**Kind:** plan step
**Agreed:** Sub-phase 42b rewrites the break-run rule and the steps that state it.
**Did instead:** It also changes the paragraph on running the whole set with one command. The plan is amended in place.
**Why:** That command is each project's own runner. If it still does every probe's break run, the new rule saves nothing. Found at the slice's gate, not by the plan.
