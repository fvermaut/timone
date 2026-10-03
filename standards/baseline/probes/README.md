# The shared baseline probes

These are the accessibility and UI/UX checks **stage 7** runs on every project's
browser channel. They live here, once, rather than in each project, because
[`../accessibility.md`](../accessibility.md) and [`../ui-ux.md`](../ui-ux.md) are
the same for every project Timone manages
([ADR-0048](../../../doc/adr/0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md) D5).

**Stage 6 may not read this directory.** A `PreToolUse` hook refuses it. A
builder that reads the checks writes code to pass them, which is the fault the
whole arrangement exists to prevent.

## Running them

Each probe takes a URL and prints its findings. They need Playwright and
`@axe-core/playwright`, which they resolve from the **project's own**
`node_modules` — passed as `--modules` — so nothing needs installing here.

```
node standards/baseline/probes/axe.mjs        --url http://localhost:3000/ --modules projects/<name>/node_modules
node standards/baseline/probes/keyboard.mjs   --url http://localhost:3000/ --modules projects/<name>/node_modules
node standards/baseline/probes/reflow.mjs     --url http://localhost:3000/ --modules projects/<name>/node_modules
```

Exit code is `0` when the probe found nothing wrong and `1` when it did. Every
finding is printed, not only the first.

## Red before green

✏ Revised 2026-10-02 ([ADR-0061](../../../doc/adr/0061-a-check-script-proves-itself-once-and-a-fix-re-runs-what-it-can-affect.md) D1).
This section used to say that a probe must be seen to fail on every build, in
every run. That is no longer the rule.

A probe's pass counts only after the probe has been seen to fail. Every probe
here takes `--break`, which plants the exact fault it exists to catch before it
looks. A run with `--break` is the probe's **break run**, and it must exit 1. A
run without it is the **real run**, and it must exit 0:

```
node standards/baseline/probes/axe.mjs --url … --modules … --break   # break run: must exit 1
node standards/baseline/probes/axe.mjs --url … --modules …           # real run: must exit 0
```

**A probe here does its break run, then its real run, when it is run against a
page it has never been run against.** A new page has a new layout, so the plant
is not yet known to show up there. When you cannot tell whether the probe has
run against that page before, treat the page as new. It also does both runs when
its result is in doubt: when the project's own tests say the opposite of what
its real run says.

**Every other run is the real run only.** That covers a page an earlier check
already ran this probe against, and every run again after a fix. The check
report lists every probe that ran without a break run.

When both runs happen, green on both means the instrument is broken, not that
the page is right. Stop there and say so; record no pass. This is the executed
form of the rule that used to ask a verifier to calibrate, and
[timone#36](https://github.com/fvermaut/timone/issues/36) is the record of what
asking alone was worth.

The risk this accepts: a probe that has stopped being able to fail on a page it
already checked is no longer caught by a break run there.

The plant is made in the live page only, through the DOM, and the page is never
reloaded between planting and scanning. Nothing reaches the project's files.

## What each probe covers

| Probe | Baseline rule | Break step |
| --- | --- | --- |
| `axe.mjs` | `@axe-core/playwright` over `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`; violations are failures, no suppression | inserts an `<img>` with no alt text, which must be reported as `image-alt` |
| `keyboard.mjs` | full keyboard-only pass: every interactive element reachable by Tab, focus always visible, no trap | makes one focusable control `tabindex="-1"`, which must show up as unreachable |
| `reflow.mjs` | reflow to 320 CSS px with no horizontal scroll (1.4.10); no fixed-height text containers (1.4.12) | injects a fixed 900 px-wide block, which must show up as horizontal scroll |

**The screen-reader smoke test is not here and cannot be.** The baseline requires
VoiceOver + Safari, which no probe drives. It stays a HUMAN-CHECK with a written
script, as it always was.
