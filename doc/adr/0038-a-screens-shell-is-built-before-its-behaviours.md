# ADR-0038: A screen's shell is built before its behaviours

- **Status:** accepted
- **Date:** 2026-08-19
- **Source:** fvermaut's ruling of 2026-08-19, choosing shell-first over a composition slice at the end or a single undivided context
- **Occasioned by:** `ivtrends` phase 05, nine sub-phases that each added a behaviour to the same file and produced a screen nobody had designed
- **Standing:** [ADR-0037](0037-a-prototype-that-settles-a-look-is-kept-and-only-its-presentation-crosses.md), [ADR-0039](0039-the-look-is-gated-twice.md); stage 5's vertical-slicing rule, which this refines rather than replaces

## Context

**Appearance is the one property that only exists at the whole, and vertical slicing dissolves it.**

`ivtrends` phase 05 ran nine sub-phases through nine fresh contexts: 05a sorting, 05d the columns, 05e the rail, 05f the foot of the board, 05g the first screenful, 05h persistence, 05i the keyboard. Each is a correct vertical slice by stage 5's definition — end-to-end, independently executable, its own validation. Each was built by a context that could not see the others' reasoning.

**05a produced a bare table, and every slice after it inherited "bare" as the norm.** Nothing in the phase ever held the screen as an object, so nothing ever judged it as one. The delivery review's first finding — *"`BoardTable` is a 488-line function… neighbours 5–30 lines"* — reads as a code smell and is really a fingerprint: that is what accretion by nine blind authors looks like.

The contrast with the artifact fvermaut preferred is exact. `prototype/01-screener` was **one context, one sitting**, and its 330 lines of CSS existed *before* its features did. The stylesheet was the thing being built; the behaviours were hung on it.

Two alternatives were weighed and not taken:

- **A composition slice at the end** — the behaviours as today, then one final context that owns the whole screen and styles what the others made. Rejected as the most expensive option: it is restyling markup that was never built to be styled, and it lands last, where phase budget is already spent and polish is classically dropped.
- **One context builds the whole screen** — no slicing for UI phases at all, which is literally what the prototype did. Rejected because it fights the entire execution model: fresh-context TDD, one slice at a time, per-slice validation, bounded retries. Phase 05 landed 16,165 lines; making that one context's work is what the slicing exists to prevent.

## Decision

**A phase that builds or substantially changes a user-facing screen opens with a shell sub-phase, and no later sub-phase restyles.**

### The shell sub-phase

It is the phase's first slice and every other slice depends on it. It delivers:

- the screen's **stylesheet**, taken from the kept prototype under [ADR-0037](0037-a-prototype-that-settles-a-look-is-kept-and-only-its-presentation-crosses.md) and adapted, or from the project's design file where no prototype settled this screen
- the screen's **layout and structure** — its regions, its grid, its density, how a figure is set, how a column is sized
- enough **static content** to render, so the shell is a screen a person can look at rather than a stylesheet nobody has seen

It carries the project's accessibility obligations from the first commit — the reflow behaviour, the focus treatment, the non-colour carriers — because these are layout decisions and retrofitting them is what forces a later slice to restyle.

### Later slices fill it in and may not restyle

Behaviour slices use the shell's classes and structure. A slice that finds the shell wrong **amends the shell** — as an explicit, marked plan amendment naming what moved and why — rather than styling around it locally. Local overrides accumulating across nine contexts is the failure this decision exists to prevent, and it is invisible in review because each override is individually reasonable.

### Planning states which screens this applies to

Stage 5 identifies user-facing screens at plan time and orders the phase accordingly. A phase with no screen has no shell slice and is not defective for it.

## Consequences

- **One extra slice at the front of every UI phase.** The cost is small and it is paid where changes are cheapest. It is smaller than it looks: work the shell does is work the behaviour slices no longer each do badly.
- **The shell is a dependency bottleneck.** Nothing else in the phase can start until it lands, so a UI phase loses whatever parallelism stage 5 might have found. Stage 5 already sequences sequentially by default and parallelises only slices sharing zero files — which a screen's slices never do — so in practice this forbids nothing that was happening.
- **"Substantially changes" is a judgement, and stage 5 makes it.** A phase adding one column to an existing board needs no shell slice; one introducing a screen, or reworking its layout, does. Getting this wrong in the cheap direction — a shell slice that turns out trivial — costs one small slice. Getting it wrong the other way is phase 05.
- **A phase that inherits an unstyled screen has to pay the debt.** `ivtrends`' board has no shell and cannot get one by amendment; the first phase to touch it seriously will carry a shell slice that is really a rebuild. This decision does not make that cheaper, it makes it happen once.
- **The restyling ban needs enforcement, and does not have it mechanically.** No linter distinguishes a legitimate component style from a local override of the shell. [ADR-0039](0039-the-look-is-gated-twice.md)'s comparison at the shell slice catches the shell being wrong; a behaviour slice quietly overriding it is caught only by review, and this is the weakest joint in the three decisions.
