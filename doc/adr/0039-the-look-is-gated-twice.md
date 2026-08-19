# ADR-0039: The look is gated twice — at the shell, and by the human before the pull request

- **Status:** accepted
- **Date:** 2026-08-19
- **Source:** fvermaut's ruling of 2026-08-19, selecting both blocking checks and declining the two non-blocking ones
- **Occasioned by:** `ivtrends` [#22](https://github.com/fvermaut/ivtrends/pull/22) — three verification passes, two review axes, eight standing findings, and a screen its owner rejected on sight
- **Standing:** [ADR-0037](0037-a-prototype-that-settles-a-look-is-kept-and-only-its-presentation-crosses.md), [ADR-0038](0038-a-screens-shell-is-built-before-its-behaviours.md), [ADR-0016](0016-review-remediation-rides-the-verify-fix-shape.md), [ADR-0014](0014-artifact-first-gates.md)

## Context

**Nothing in the pipeline ever looked at the screen.** Every stage converts the question into propositions that can be evaluated, and appearance is not one.

- **The criteria register** holds what can be asserted. `ivtrends` R17 asks whether *"the first screenful states how many were removed"*; R18 is discharged by the rail's inputs measuring `0 px` wide. One verification pass records the board's table starting at **`y = 405` of 800** and marks it a PASS — half the first screenful is preamble and the gate is satisfied.
- **Verification's browser channel** is Playwright, axe, a keyboard pass and reflow checks. `timone-verify` states the intent outright: focus assertions are *"a fact, not a judgement"*. Judgement is designed out, deliberately and for good reasons.
- **Delivery's two axes** are Standards and Spec. The Standards review of the board returned **seven findings, every one about code** — a long function, a shadowed variable, a `Record<string, string>`. Zero about appearance, because appearance is on neither read list.
- **The UI/UX baseline has no craft in it.** Every rule in `standards/baseline/ui-ux.md` is behavioural and Playwright-checkable: states, responsive posture, feedback, forms, i18n, defaults. There is no rule about spacing, alignment, column width, type hierarchy or density — so a reviewer who wanted to fail this board on looks had nothing to cite.

**The only check that worked was the human opening the pull request.** Commit `1ddecba` fixed precisely what he named: a rail that pushed all 520 rows below the fold, headings that did not stay put, and a table *"stretched to the full width of the screen, putting a hand's width of nothing between a name and its number."* That commit is stamped `Timone-Stage: remediation`. **There is no remediation stage.** The one signal that worked came back through a stage that does not exist.

### Why a third delivery axis was rejected

The obvious symmetry — a "Look" axis beside Standards and Spec — was offered and declined. Delivery axes are forbidden from fixing anything: a change there *"would land code no verification pass has seen, after the report certifying the behaviour and before you read it."* That is why #22 says *"nothing from the first delivery's eight findings was fixed — every one of them still stands."* A third axis would produce a ninth finding nobody acts on. It reports; it does not repair.

A look check inside **verification** was also rejected. It would have real force, but the prototype is build intent, and stage 7's independence is a closed allowed list that exists precisely to keep build intent out. Buying a look gate with stage 7's independence is too expensive, and it fires after the whole phase is built.

## Decision

**Two checks, both blocking, at the two moments where looking is still cheap.**

### 1 — At the shell slice, by a fresh context

[ADR-0038](0038-a-screens-shell-is-built-before-its-behaviours.md)'s shell sub-phase does not close until a context that did not build it opens the shell and the reference side by side, at the same window size, and reports the differences. The reference is the kept prototype, or the project's design file where no prototype settled this screen.

Every difference is **fixed, or written down with its reason** — the accessibility and reflow adaptations [ADR-0037](0037-a-prototype-that-settles-a-look-is-kept-and-only-its-presentation-crosses.md) requires are the expected content of that list. An unexplained difference fails the slice's validation like any other failing check, under stage 6's ordinary bounded retries.

**It is a named comparison, not a pixel diff.** Density, how figures are set, how columns are sized, ink levels, signal colours, the treatment of the frozen region. Pixel comparison against an adapted screen would fail always and mean nothing.

This is the cheap moment: one slice, not a phase; the builder is still there; nothing is built on top yet. It is where *"the table is stretched to the full width of the screen"* is caught before eight slices inherit it.

### 2 — Before the pull request opens, by the human

Delivery does not open the pull request for a phase carrying a user-facing screen until the human has seen the built screen beside its reference and said yes. The delivery report records that they did.

This is one look, and **it is a look the human already spends** — today after the PR, as disappointment, at the moment when nothing can be fixed without invalidating the verification evidence. Moving it earlier costs nothing extra and saves a delivery that had to be redone.

It is a stage-8 gate in the ordinary sense: it stops, it routes to the human, and a stopped delivery is a valid complete outcome. A "no" is not a review finding — it goes back through stage 1 like any other rejection.

## Consequences

- **Delivery can now block on a person, and `ivtrends` #22 shows how long that can take.** The pull request is where the human already is, and this gate is upstream of it, so a silent human means no PR at all. That is the cost of the gate having force. The daemon's conversation-waiting machinery already handles exactly this shape of wait, and the same escape applies.
- **It reverses a rule that was load-bearing.** *"An unperformed HUMAN-CHECK does not block delivery"* stands and is untouched — a scripted accessibility check is evidence a human gathers later, and withholding the PR would hide it. The look gate is a different act: it is a judgement, not a measurement, and it is the judgement the PR exists to obtain. Presenting a screen its owner has not seen is not presenting it.
- **The shell comparison can be gamed by a builder that writes a long enough reason list.** A recorded difference is accepted by construction. This is deliberate — the alternative is a machine judging taste — and it means the list itself is what the human is really approving at gate 2.
- **The two gates catch different things and neither is redundant.** Gate 1 catches drift from the reference, mechanically and early, and is blind to the reference being wrong for this screen. Gate 2 catches the screen being bad, and is too late to be cheap. Removing either leaves a hole that `ivtrends` #22 already fell through.
- **`Timone-Stage: remediation` still needs a home.** This decision gives the look a gate before delivery; it does not decide where a post-delivery reaction goes. [ADR-0036](0036-feedback-is-triage-with-the-documents-open.md) already answered that — such a reaction is a later request and re-enters stage 1 — so the stamp on `1ddecba` was wrong rather than the process being incomplete. Filed as a defect against the run that wrote it.
- **The baseline gains craft rules it has never had.** Gate 1 needs something to compare against for screens with no prototype, so the generalisable rules — a column sized to its content and never stretched to the viewport, figures set tabular, an explicit density — move into `standards/baseline/ui-ux.md`, which today contains none.
