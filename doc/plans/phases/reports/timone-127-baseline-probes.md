# #127 — two shared accessibility checks, fixed and proved

- **Date:** 2026-10-22
- **Ticket:** [timone#127](https://github.com/fvermaut/timone/issues/127)
- **Branch:** `timone/127-two-shared-accessibility-checks-cannot-g-chunk-2`, cut from `main` @ `c5f0fc8`
- **Files changed:** `standards/baseline/probes/keyboard.mjs`, `standards/baseline/probes/reflow.mjs`, `standards/baseline/probes/README.md`, and the new `standards/baseline/probes/test-pages/`

## Why the checking step made this change

The runner asked the checking step to make the fix, because only that step may open `standards/baseline/probes/`. The step was also told to check a plan file on this branch. The branch did not exist on the remote, and no plan file or criteria list covers this ticket, so there was nothing of that kind to check. This report records the fix and its proof instead. No criteria list changed.

## What changed

1. **`keyboard.mjs`** pressed Tab at most 400 times. On a page with more controls, every control past the 400th was reported as unreachable. It now counts the page's tab stops and presses Tab up to twice that number plus 50. It stops early when every control is reached, or when focus comes back to the first control it landed on. No page gets more than 10,000 presses, so a page that traps focus still ends.
2. **`reflow.mjs`** reported text hidden for screen readers as "text is clipped by a fixed height". It now skips an element when it, or a box around it, is placed with `position: absolute` or `fixed`, is 1 px or less on both sides, and has its overflow hidden or a `clip` or `clip-path`. This is read from the computed styles. The class name plays no part. Visible text cut off by a fixed height is still reported.

## The test pages

All under `standards/baseline/probes/test-pages/`, opened from disk:

| Page | What it is | The check must |
| --- | --- | --- |
| `keyboard-547-sound.html` | 547 controls, all in the tab order | pass |
| `keyboard-547-broken.html` | the same, with control 520 out of the tab order | fail, naming control 520 only |
| `keyboard-trap-broken.html` | focus enters three buttons and never leaves them | fail, and still finish |
| `reflow-sr-only-sound.html` | text hidden for screen readers, with `clip`, with `clip-path`, and a hidden box holding a paragraph | pass |
| `reflow-clipped-broken.html` | the same hidden text, plus a visible box with a fixed height, plus a box with the class `sr-only` that is visible and cut off | fail, naming the two visible boxes only |

## Results

Command, run from the project root, with Playwright from `/opt/timone/node_modules` (outside the project):

```
node standards/baseline/probes/test-pages/run.mjs --modules /opt/timone/node_modules
```

Output, trimmed to what carries the evidence:

```
ok   keyboard on keyboard-547-sound.html: exit 0, must be 0
      === … 547 of 547 controls reached by Tab (547 presses, 547 tab stops; every control reached)
      PASS — nothing found
ok   keyboard on keyboard-547-sound.html --break: exit 1, must be 1
      break step: took one <button> out of the tab order
      === … 546 of 547 controls reached by Tab (548 presses, 546 tab stops; focus came back to the first control)
      FAIL — 1 finding(s)
ok   keyboard on keyboard-547-broken.html: exit 1, must be 1
      === … 546 of 547 controls reached by Tab (548 presses, 546 tab stops; focus came back to the first control)
        not reachable by keyboard: button "Control 520 (out of the tab order)"
      FAIL — 1 finding(s)
ok   keyboard on keyboard-trap-broken.html: exit 1, must be 1
      === … 4 of 6 controls reached by Tab (62 presses, 6 tab stops; stopped at the limit of 62 presses)
        not reachable by keyboard: a "After the loop, first"
        not reachable by keyboard: a "After the loop, second"
      FAIL — 2 finding(s)
ok   reflow on reflow-sr-only-sound.html: exit 0, must be 0
      PASS — nothing found
ok   reflow on reflow-sr-only-sound.html --break: exit 1, must be 1
      break step: injected a 900px-wide block
        the page scrolls horizontally at 320px: content is 916px wide in a 320px viewport
      FAIL — 2 finding(s)
ok   reflow on reflow-clipped-broken.html: exit 1, must be 1
        text is clipped by a fixed height: <div> is 20px but its text needs 90px
        text is clipped by a fixed height: <div> is 20px but its text needs 67px
      FAIL — 2 finding(s)
every run ended as it must
```

**Keyboard check:** green on the sound page with 547 controls, red on the broken one, and red when it takes a control out itself (`--break`). It found exactly the one control that was taken out, at position 520, past the old limit of 400. On the focus trap it stopped after 62 presses and reported the two links it could not reach.

**Reflow check:** green on the page with text for screen readers, red on the broken page, and red when it plants its own wide block (`--break`). On the broken page it reported the two visible boxes and not the hidden text. One of the two boxes has the class `sr-only`, which shows the class name does not hide a fault.

### The old checks on the same pages

The same pages, with the two files as they were on `main` @ `c5f0fc8`:

```
=== keyboard on …/keyboard-547-sound.html — 400 of 547 controls reached by Tab
FAIL — 147 finding(s)
  not reachable by keyboard: a "Control 402"
  …
  not reachable by keyboard: button "Control 547"

=== reflow on …/reflow-sr-only-sound.html at 320x256
  text is clipped by a fixed height: <span> is 1px but its text needs 22px
  text is clipped by a fixed height: <span> is 1px but its text needs 15px
FAIL — 2 finding(s)
```

Both faults the ticket describes show up on the sound pages before the fix, and are gone after it.

## The whole test suite

Run once at the end, after `npm run build`: **2759 passed, 70 failed**, in 4 files (`src/commands/guardrails.test.ts` 45, `src/numbers.test.ts` 16, `src/workspace.test.ts` 6, `src/commands/number.test.ts` 3). Every one of the 70 fails at the same step: the test sets up a temporary repository and pushes to its `main`, and this container refuses any push that is not to this ticket's branch ("Refused: this run may push only to `timone/127-…`"). None of these tests touches the two checks. `npm run type-check` passed.

## What was not done

- The checks were not run against ivtrends or any other live project, as the runner asked.
- `axe.mjs` was not changed and not run.
