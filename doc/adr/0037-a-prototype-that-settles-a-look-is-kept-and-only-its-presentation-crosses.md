# ADR-0037: A prototype that settles a look is kept, and only its presentation crosses

- **Status:** accepted
- **Date:** 2026-08-19
- **Source:** fvermaut's rejection of [ivtrends#22](https://github.com/fvermaut/ivtrends/pull/22) on 2026-08-19 — *"The UI is bad, lots of issues, disaligned stuff, scrolling issues… The prototype that was generated during wayfinding was much better actually — the UI generated during phase 5 has nothing to do with it"* — and the grill session that followed
- **Amends:** [ADR-0011](0011-prototype-convention.md) — the death clause and the cherry-pick fence, both narrowed; everything else in it stands
- **Occasioned by:** `ivtrends` [#11](https://github.com/fvermaut/ivtrends/issues/11), whose prototype was deleted on 2026-08-12 having settled the screener's look, and whose look did not reach the build that implemented it
- **Standing:** [ADR-0006](0006-specs-in-repo-single-source-of-truth.md), [ADR-0005](0005-docker-previews-on-own-host.md), [ADR-0038](0038-a-screens-shell-is-built-before-its-behaviours.md), [ADR-0039](0039-the-look-is-gated-twice.md)

## Context

**A prototype settled the look, was deleted, and the look died with it.**

`ivtrends` #11 asked how the screener should look, and answered it the way ADR-0011 intends: a throwaway branch, fixture data, a running page, a human reacting to it. `prototype/01-screener` was 1,420 lines — **330 of them hand-written CSS**. fvermaut approved it. The branch was then deleted, per this convention's own instruction, and [ADR-0012](https://github.com/fvermaut/ivtrends/blob/main/doc/adr/0012-the-screener-is-one-dense-table-with-a-frozen-spine-and-switchable-column-groups.md) recorded what it decided.

What ADR-0012 records is **shape**: a table rather than cards, five frozen columns, four switchable groups, a rail collapsed by default. What it does not record — because prose about a screen cannot hold it — is **craft**: a 30px row, monospace tabular figures, three ink levels on a dark ground, and a column sized to its widest number rather than stretched across the viewport.

Phase 05 implemented ADR-0012 faithfully and produced a screen fvermaut rejected on sight. The phase wrote **zero lines of CSS**. Its 16,165 added lines include 2,723 in one Playwright spec and roughly 1,400 more in unit tests. The only design decisions anywhere in the repository are the contrast adjustments in `globals.css`, made to clear WCAG floors.

Both agents obeyed their instructions exactly. This skill says *"No tests, no standards conformance, no polish beyond what the question needs."* The process told the prototype to spend everything on the screen, and told the build to spend everything on conformance. It then destroyed the only artifact that held the screen.

**The recovery is the argument.** The prototype was recovered on 2026-08-19 from a dangling git object, restored to `prototype/01-screener` and pushed. Getting the look back required breaking the rule that lost it. A convention whose repair is its own violation is the wrong convention.

### Why the obvious alternatives were rejected

- **Write the look down instead of keeping the code.** This is what ADR-0012 already is, and what fvermaut's own first instinct — *"a wireframe step"* — would formalise. Rejected on the evidence: a wireframe is *lower* fidelity than what already existed, and strips exactly the properties that failed. A structure document is the artifact that has already been tried.
- **Keep the fence and match by eye from screenshots.** Rejected: every spacing and colour decision would be re-derived by a context that did not make it, across nine sub-phase contexts that each eyeball the same picture. Drift is guaranteed and invisible.
- **Tokens only, re-implemented.** A written vocabulary crosses; no CSS does. Rejected because phase 05 was already free to write its own CSS against any vocabulary it liked, and wrote none. A token list does not change the incentive that produced that.

## Decision

**A prototype that settles a user-facing look is kept and served; its stylesheet crosses into the build; its logic, markup and fixtures never do.**

### The death clause is conditional, not absolute

ADR-0011's *"deleted once the reaction is recorded"* stands for every prototype that answers a question about **behaviour, flow or shape**. A prototype whose reaction settled how a screen **looks** is **kept on its branch**, indefinitely, and stays servable. Deletion of such a branch is a defect, not housekeeping.

The branch is still never merged and is still never the base of a work branch. Keeping is not merging.

### The fence splits in two

*"Nothing is cherry-picked out of it"* becomes: **presentation crosses; behaviour does not.**

| File | Crosses | Why |
| --- | --- | --- |
| the stylesheet | **yes**, then adapted | carries the craft and no behaviour; no test could have covered it |
| markup | no | no accessible structure, no message layer |
| logic | no | untested, unverified, written to be thrown away |
| fixtures | no | invented numbers |

**Adapted, and the adaptation is recorded.** A prototype is exempt from the accessibility baseline and normally fails it; `ivtrends`' prototype was measured at 320 px on 2026-08-19 and needs **1136 px** in a 320 px window, with `body { overflow: hidden }` making the overflow unreachable. So the crossing is never a copy: what the baseline and narrow-screen reflow require is rebuilt, and every rule that had to change is written down with its reason. An unrecorded change is drift.

**The exemption still waives nothing.** ADR-0011's rule holds unchanged — an approved inaccessible prototype changes no requirement, and the PRD's accessibility criteria stand over anything the stylesheet brought with it.

### The look becomes the project's, not one screen's

The first kept prototype on a project is **harvested once** into a committed design file — the project's ground, ink levels, row heights, figure treatment, column sizing and signal colours. A screen with a prototype matches its prototype; a screen without one matches the design file. This is what stops a product looking like two products, which is the state `ivtrends` is in today: a board built to one intent and a universe page built to library defaults.

## Consequences

- **A prototype that settles a look costs more to build.** Its stylesheet is now an input to production rather than scaffolding, so it is written to be read. This is a real increase in prototype cost and it is the price of the craft surviving. The fidelity rule is otherwise unchanged: cheapest that answers the question.
- **Prototype branches accumulate.** A project gathers one long-lived `prototype/NN-<slug>` branch per settled look. They are never merged, so they cost storage and a line in `git branch -a` and nothing else. Behaviour and flow prototypes still die on schedule, so this is bounded by the number of distinct screens.
- **An unmerged branch rots.** The kept prototype is static and depends on nothing, which is why it can be kept at all — `ivtrends`' recovered prototype still runs three months on with `python3 -m http.server`. A prototype built on the real stack would not survive this way, and one that stops running has stopped being a reference; the design file harvested from it is the durable record, and that is the second reason the harvest exists.
- **"Adapted" is the seam where this can fail.** A builder that adapts freely and records nothing has the old problem back with extra steps. [ADR-0039](0039-the-look-is-gated-twice.md) is what makes the adaptation visible; without it this decision is inert.
- **Prototypes are still not specs.** Nothing here makes a prototype normative. It is a reference for presentation only; what the screen must *do* remains the criteria register's, and where the two disagree the register wins.
- **`ivtrends` gains work it did not have.** Its prototype is restored and its design file is owed. Its board needs a shell it was never given — that is a phase, not a patch, since `board-table.tsx` is 488 lines of markup never built to be styled.
