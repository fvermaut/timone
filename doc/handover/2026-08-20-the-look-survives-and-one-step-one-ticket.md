# Handover — Timone — 2026-08-20

> Prior handover: [2026-08-15-phase-22-shipped-phase-23-planned.md](2026-08-15-phase-22-shipped-phase-23-planned.md)

## Snapshot

A rejected screen on `ivtrends` turned into three days of process change. The look now survives the prototype that settled it, a screen's shell is built before its behaviours, and the look is gated twice — all merged. Separately, one step is now one ticket instead of fourteen pieces hanging off one thread, which is decided and merged but **not built**: [phase 29](../plans/phases/phase-29.md) plans the daemon work and is waiting to be executed. `ivtrends` has been wound back to the day its questions were all answered, keeping every decision and deleting every line of code.

✏ **Updated 2026-08-20, later the same day: [PR #43](https://github.com/fvermaut/timone/pull/43) is merged and there is no blocker.** `phase-29.md`, the R22 amendment and the ADR-0040 correction are all on `main`, and no pull request is open on this repository. Phase 29 is ready to execute as it stands.

## Done this session

- **Three decisions on how a look reaches a build**, merged as [PR #38](https://github.com/fvermaut/timone/pull/38): [ADR-0037](../adr/0037-a-prototype-that-settles-a-look-is-kept-and-only-its-presentation-crosses.md) (a prototype that settles a look is kept; its stylesheet crosses, adapted), [ADR-0038](../adr/0038-a-screens-shell-is-built-before-its-behaviours.md), [ADR-0039](../adr/0039-the-look-is-gated-twice.md). `process.md` stages 5, 6 and 8 and the prototyping section revised; `timone-prototype`, `timone-plan`, `timone-execute`, `timone-deliver` follow.
- **`standards/baseline/ui-ux.md` gained a craft section**, approved 2026-08-19. It had no rule about spacing, alignment, column width or density — which is why nothing in the pipeline could fail the board on how it looked. **Its primary sources are still owed: [#39](https://github.com/fvermaut/timone/issues/39).**
- **One step is one ticket** — [ADR-0040](../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md), merged as [PR #42](https://github.com/fvermaut/timone/pull/42). Supersedes [ADR-0029](../adr/0029-a-chunk-advances-only-on-success.md).
- **The provenance check stopped reporting what nobody can fix** — [PR #44](https://github.com/fvermaut/timone/pull/44), closing [#40](https://github.com/fvermaut/timone/issues/40). It fired four times falsely in one session.
- **`ivtrends` wound back** to `9910c70`, as a revert commit rather than a force-push. All 23 decisions, the approved PRD and the design language kept; all code deleted. Everything is at the tag `pre-restart-2026-08-20`.
- **`ivtrends` #1 cleaned out** — 73 comments hidden as outdated (nothing deleted), body rewritten as a map, run cancelled, `timone` mark removed so nothing spawns.

## In flight / blocked

- **[Phase 29](../plans/phases/phase-29.md) — planned, not started.** Nine slices. Deliberately not executed: the daemon runs against real projects and half a change to its scheduling loop is worse than none.
- **`ivtrends` — idle and deliberately unmarked.** It has no code, no breakdown and no plan. Its next step is a new breakdown cut under ADR-0040, which wants phase 29 built first so the step tickets actually open.
- **Two `ivtrends` phase plans were deleted in the revert** — the universe repaint and the board rebuild. They are at the tag if wanted, but both were written against the old ticket model and should be re-cut rather than restored.

## Decisions made this session

- The three look decisions and the one-step-one-ticket decision — see the ADRs above; not re-explained here.
- **`ivtrends` goes dark** — [ivtrends ADR-0023](https://github.com/fvermaut/ivtrends/blob/main/doc/adr/0023-the-application-surfaces-are-dark-and-the-figures-carry-the-contrast.md). It overrides the shadcn base for application surfaces, and the base itself is untouched.
- **The board is rebuilt clean-sheet.** fvermaut ruled that nothing is copied from the closed phase-05 branch — not a module, not a test. Its ~2,300 lines of tested, presentation-free logic are written again. The *decision* survives as [ivtrends ADR-0022](https://github.com/fvermaut/ivtrends/blob/main/doc/adr/0022-the-board-is-one-materialised-row-set-sorted-in-the-browser-and-a-hole-has-a-fixed-place.md), carried onto `main` deliberately.
- **I filed a bug that was not real, and it is corrected rather than quietly dropped.** [#41](https://github.com/fvermaut/timone/issues/41) claimed the daemon believed `ivtrends`' board was already built. It did not: `initiativeProgress` counts `done` alone and answered correctly. I had simulated with `SETTLED`, which serves `register` and a different question. **ADR-0040 still stands** — it was decided on the 73-comment thread, not on the count — but its claim to close #41 is struck, and deleting settledness is a removal of something made unnecessary, not a repair. The correction is in [PR #43](https://github.com/fvermaut/timone/pull/43).

## Exact next action

**Execute phase 29**, from [`doc/plans/phases/phase-29.md`](../plans/phases/phase-29.md) on `main`. `timone-execute` is for managed projects and Timone is not one, so this is hand-run, slice by slice, the way Timone's own phases always are. Start at 29a and 29b — they share no files and may run in parallel.

`main` is at `1a4eb2e`, no pull request is open, and `timone guardrails check` is clean.

Two things the plan pins down that a fresh reader should not re-litigate: **29c asserts idempotence** (opening fourteen issues is the first loud, external, un-undoable thing this system does), and **29g deletes settledness last**, after the new path carries traffic.

## Open questions

- **Do the craft rules in `standards/baseline/ui-ux.md` get primary sources, or a label saying they are house style?** — [#39](https://github.com/fvermaut/timone/issues/39); fvermaut resolves.
- **When does `ivtrends` get its new breakdown?** It needs phase 29 built first for the step tickets to open, and it needs the PRD re-read once the steps are re-cut. fvermaut decides the timing.
- **Does the `chunk-N` branch suffix stay the run sequence?** It is why `chunk-6` built piece 5 and why I misread the model for a day. Harmless, but it is a naming trap and nobody has decided to keep or change it.
