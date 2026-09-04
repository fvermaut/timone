# Phase 33 — Completion Report

- **Date:** 2026-09-04
- **Plan:** [phase-33.md](../phase-33.md) — un-anchored chore work (no breakdown; the plan's own text names this as a chore that neither PRD register asks for)
- **Requirements:** none claimed — the plan states no requirement ID applies, since a mis-sourced document is not a product behaviour
- **Branch:** `timone/39-primary-sources-owed-for-the-ui-ux-basel`

## Summary

`standards/baseline/ui-ux.md`'s *Reading a screen of figures* section shipped on 2026-08-19 with rules taken from one project's review findings rather than from cited primary sources, and its own amendment note said so. This phase closed that gap. Each of the section's five rules was judged on its own: four gained a real, fetched-and-confirmed primary source at the same tier the rest of the file already uses (NN/g, plus A List Apart and Butterick's Practical Typography for the two typography-specific claims), and one — the density rule — had no defensible outside source for the specific claim it makes, so it is now labeled this product family's house style instead of quietly reading as research.

The centre of gravity was research, not editing: finding a source that actually supports the specific claim a rule makes, rather than one merely adjacent in topic, and being willing to label a rule house style when a genuine search came up empty. One rule (foreground ink levels) split down the middle — the general principle is sourced, the specific count of three is not, and the text now says which is which.

The one sub-phase the plan called for carried the whole of this work; it executed as planned, with no seams (the plan itself states this section carries no behaviour, so validation was checklist-based, not test-based).

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 33a — Reading a screen of figures gets its sources | Passed on first attempt; all checklist items confirmed, all newly-added URLs verified live | `150c802` |

## Deviations from the plan

None — the phase executed as planned.

## Context for the next agent

- The document change is prose only; there is nothing to run to observe the change beyond reading the file.
- One pre-existing link in the file's 2026-08-19 history line (`github.com/fvermaut/ivtrends/pull/22`) returns 404 under an unauthenticated fetch — most likely a private-repo link rather than a dead one, and it predates this phase. It sits outside this phase's edit scope (the plan permitted only the *Reading a screen of figures* section and a new history line below the existing ones), so it was left untouched and is worth a separate look if it matters.
- The 2026-08-19 history line still reads "primary sources are still owed"; the new 2026-09-04 line below it is what closes that claim, read in date order. The plan's instruction was to add a line below the existing ones, not to edit them, so the two lines were left to read in sequence rather than reconciled into one.
- Full detail of what was cited, and why each choice was made over the alternatives considered, is in [reports/phase-33-handoffs.md](phase-33-handoffs.md).
