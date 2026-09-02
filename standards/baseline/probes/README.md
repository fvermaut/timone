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

A probe's pass counts only after the probe has been seen to fail, on this build,
in this run. Every probe here takes `--break`, which plants the exact fault it
exists to catch before it looks:

```
node standards/baseline/probes/axe.mjs --url … --modules … --break   # must exit 1
node standards/baseline/probes/axe.mjs --url … --modules …           # must exit 0
```

Green on both legs means the instrument is broken, not that the page is right.
Stop there and say so; record no pass. This is the executed form of the rule
that used to ask a verifier to calibrate, and
[timone#36](https://github.com/fvermaut/timone/issues/36) is the record of what
asking alone was worth.

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
