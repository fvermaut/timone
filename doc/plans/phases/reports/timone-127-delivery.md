# #127 — Delivery Report

- **Date:** 2026-10-22
- **Phase:** none. No phase file was written for this ticket: the steps that prepare the work and build it were skipped, and the checking step made the fix. Its record is [timone-127-baseline-probes.md](timone-127-baseline-probes.md).
- **Branch:** `timone/127-two-shared-accessibility-checks-cannot-g-chunk-2` @ `e44f42d`
- **Base:** `main` — the project's default branch; the branch was cut from `main` @ `c5f0fc8`.
- **Pull request:** opened against this report; its address is on [ticket #127](https://github.com/fvermaut/timone/issues/127).
- **Screen:** no user-facing screen in this work.
- **Questions for the human:** none.
- **Departures:** no departures record — nothing was bent. Two steps of the default order did not run; see Notes.

## Scope

[Ticket #127](https://github.com/fvermaut/timone/issues/127): two shared accessibility checks reported false faults.

- `standards/baseline/probes/keyboard.mjs` stopped after 400 Tab presses, so on a page with more controls every control past the 400th was reported as unreachable.
- `standards/baseline/probes/reflow.mjs` reported text hidden for screen readers as text cut off by a fixed height.

The work claims no requirement IDs. [PRD-01.R20](../../../specs/prd/prd-01-process-layer.criteria.md) only asks that the shared checks run; [ADR-0048](../../../adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) says a check red on both a sound and a broken page is broken.

## How to try it

### Against the preview

This project has no preview for pull requests. Use the local steps.

### On a local checkout

Set up the project as its [README.md](../../../../README.md) says, then check out the branch. You need Playwright with a Chromium browser.

1. `node standards/baseline/probes/test-pages/run.mjs --modules <a node_modules folder that has playwright>` — every line starts with `ok`, and the last line is `every run ended as it must`.
2. To see the old faults: put back the two check files from `main` (`git checkout main -- standards/baseline/probes/keyboard.mjs standards/baseline/probes/reflow.mjs`) and run step 1 again. The keyboard check reports 147 faults on `keyboard-547-sound.html`, and the reflow check reports 2 on `reflow-sr-only-sound.html`. Then `git checkout HEAD -- standards/baseline/probes/` to restore.

## Verification outcome

From [timone-127-baseline-probes.md](timone-127-baseline-probes.md). There is no criteria list for this work, so there is no verdict table by requirement. The proof is the test pages:

| Page | Must | Result |
| --- | --- | --- |
| `keyboard-547-sound.html` | pass | pass — 547 of 547 reached |
| `keyboard-547-sound.html --break` | fail | fail — 1 finding |
| `keyboard-547-broken.html` | fail, naming control 520 only | fail — control 520 only |
| `keyboard-trap-broken.html` | fail, and still finish | fail — stopped after 62 presses, 2 findings |
| `reflow-sr-only-sound.html` | pass | pass |
| `reflow-sr-only-sound.html --break` | fail | fail — 2 findings |
| `reflow-clipped-broken.html` | fail, naming the two visible boxes only | fail — the two visible boxes only |

Before the fix, the same sound pages gave 147 false faults (keyboard) and 2 false faults (reflow).

**The whole test suite:** 2759 passed, 70 failed. All 70 fail at the same step: the test pushes to `main` in a temporary repository, and the container the check ran in refuses that push (open Timone issue [#220](https://github.com/fvermaut/timone/issues/220)). None of them touches these checks. This is a known limit, not a pass. `npm run type-check` passed.

### Outstanding for the human

- [ ] Both reviews below could not read the changed code: a guard keeps every step except checking from opening `standards/baseline/probes/`. Nobody but the step that wrote it has read this code. Read the diff yourself before merging.
- [ ] Run the whole test suite on your own machine before merging, to cover the 70 tests the container could not run.

## Standards review — #127

- **Read:** `standards/code-smells.md` (Timone root), `tsconfig.json`, `package.json` scripts, and the diff's file list with line counts. The project has no lint or format config; `tsc` covers only `src/`, so no tool checks the changed `.mjs` and `.html` files.
- **Not read:** the guard refused to show the diff of every changed file under `standards/baseline/probes/`. Not reviewed: `README.md`, `keyboard.mjs`, `reflow.mjs`, `test-pages/run.mjs`, and the five test pages.
- **Diff:** `main...timone/127-two-shared-accessibility-checks-cannot-g-chunk-2` — 9 files to review, +1371/−4 (11 files, +1472/−6 with `STATUS.md` and the report).
- **Findings:** none — because no file in scope could be read. This does not mean the code conforms.

## Spec review — #127

- **Read:** the diff's file list and line counts; `doc/specs/prd/prd-01-process-layer.criteria.md` § R20; `doc/adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md`.
- **Not read:** every changed non-process file, for the same reason: "Refused: doc/plans/phases/probes and standards/baseline/probes hold the checks, and only the checking step uses them."
- **Diff:** `main...timone/127-two-shared-accessibility-checks-cannot-g-chunk-2` — 11 files, +1472/−6 (9 non-process).
- **Findings:** none. The work claims no requirement IDs, so nothing is reported against requirements. Nothing read goes against PRD-01.R20 or ADR-0048. By file names only, the change matches the ticket's two faults and adds test pages that pass when sound and fail when broken, as ADR-0048 asks. Whether the code does what ticket #127 asks, and nothing more, was not checked.

## Notes

- **Two steps of the default order did not run:** preparing the work and building. Those steps are blocked from the two check files, so the checking step made the fix and proved it. The runner said so on the ticket on 2026-10-22.
- The checks were not run against ivtrends or any other live project.
- `axe.mjs` was not changed and not run.
