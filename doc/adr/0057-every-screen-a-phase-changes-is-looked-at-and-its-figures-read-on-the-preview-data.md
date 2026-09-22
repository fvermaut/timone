# ADR-0057: Every screen a phase changes is looked at, and its figures are read on the preview's data

- **Status:** accepted
- **Date:** 2026-09-22
- **Source:** fvermaut, on [ivtrends#118](https://github.com/fvermaut/ivtrends/pull/118), 2026-09-22: *"this looks completely broken. How does it even pass verification?"* The three choices below were his, in the session that followed.
- **Amends:** [ADR-0039](0039-the-look-is-gated-twice.md) (check 1 now runs on every changed screen, not only on a shell slice). Leaves [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md) and [ADR-0056](0056-a-build-stages-question-rides-to-the-pull-request.md) as they are: nothing here stops a run.

## Context

Phase 36 of `ivtrends` added a new section, "Whether it's working", under the positions table. Its pull request said 38 of 38 criteria pass. The preview showed:

- **SLV total: -$3,421.** 100 shares bought and still held. The code adds the cash paid for every plain trade, so a purchase not yet sold reads as a loss.
- **Every ticker total in the date range is $0**, because the range starts as today to today.
- **Two "finished" runs close in October**, after the data's own date of 2026-09-20.
- **Run cards with their text pushed right** and the left half empty, ticker totals with no label, and "Sold at 76.0% a year Delivered 73.0% a year Gap -3.0%" run together.
- **The positions table cut off** at the right edge.

Three things let this through:

1. **No check looked at the screen.** ADR-0039's first check runs only on a shell slice, which a phase has only when it builds a screen or changes its layout. Phase 36 added a whole section to an existing screen, so it had none. Its second check, the human before the pull request, was moved after the pull request by ADR-0052. The delivery report recorded the exemption itself: *"ADR-0038's shell-comparison gate applies only to a new shell slice, and this phase built none."*
2. **The checker used its own data, never the preview's.** Its SLV bought 100 shares and then sold them, so the total came out right ($229). The preview's SLV holds its shares. Nobody ran the requirement against the data the human would see.
3. **Every requirement about the screen was checked through the page's text.** `timone-prd` says to prefer the text channel *"even if it also has a UI"*, because it is cheap and re-runs on every later phase. R20–R23 describe what the screen shows, and their scripts confirmed the right numbers are in the page's text. A script that reads text cannot see that a number has no label or sits in the wrong place.

Alternatives considered and rejected:

- **A look check after every build step that changes a screen.** Catches a fault one step earlier, but a section built across three steps is then judged in pieces, and the check runs three times.
- **Count "adds a section" as a new screen**, so the phase must start with a shell slice. Fewest words changed, but it still misses smaller visible changes, and it asks the planner to judge "substantial" again, which is the judgement that failed here.
- **Fail any number a trader would not believe, even where the requirement allows it.** The builder would then choose the meaning inside the fix loop. That is the human's decision, and the fix loop is the wrong place to make it.
- **Check every screen requirement only in a browser.** Browser checks are not in the set re-run on every later phase, so the arithmetic would lose its regression cover.

## Decision

### 1 — The build ends with a look at every screen it changed

**The phase file names the screens the phase changes**, by address, or says none. The planner writes this line, the same way it writes the requirements table.

**Before the completion report is written, a fresh context that did not build the phase opens each named screen** with the preview's sample data loaded, at the window size the reference uses, and compares it with the reference: the kept prototype for that screen, or the project's `doc/design.md`. It is ADR-0039's named comparison, not a pixel diff, with three items added because phase 36 failed all three:

- **every figure has a label** a reader can see beside it
- **nothing is cut off** at the window edge, and nothing needs a sideways scroll the reference does not have
- **new content is set the same way as the content already on the screen**: the same alignment, the same spacing, the same type sizes

Every difference is fixed, or written down with its reason. An unexplained difference fails the phase's close under the ordinary two attempts, then is recorded as a departure. The list and one screenshot per screen go into the completion report. The shell slice's own check is unchanged and still runs when there is a shell slice.

### 2 — The checker reads every figure on the preview's own data

After its own probes, the checker loads the sample data the preview loads — the project's compose `seed` service, or the seed command the completion report names — opens every screen the phase changed in a browser, takes a screenshot, and reads every figure shown. It is looking for a figure no reader of this app would believe. The list is fixed:

- a gain or a loss where nothing was closed
- a total of zero or blank where the data holds trades that should count
- a thing called finished, closed or past whose date is after the data's own date
- the same figure disagreeing between two places on the screen
- a figure with no label
- a figure the register's own arithmetic contradicts

**Where a register clause covers the figure, it is a FAIL on that clause** and goes through the normal fix loop. **Where no clause covers it**, the checker cannot know which meaning is right, and neither can the builder: it becomes a **question for the human**, with the screenshot. It does not stop the run, does not consume a fix loop and does not change any register status. The pull request puts these questions first, before the departures.

This reads no build intent. The sample data is loaded by running a command the checker's allowed list already covers; the checker never reads the seed script or the code. That is why it does not reopen ADR-0039's refusal to put a look check in verification — that refusal was about the prototype, which is build intent.

### 3 — A requirement that shows something new carries one line checked in a browser

**The arithmetic stays on the text channel**, so it stays in the regression set. But a requirement whose outcome puts something new on a screen also carries **at least one clause marked `(browser)`**: what the person sees and where it sits — for example, *"each ticker's total sits on the ticker's own line, labelled with the ticker's name."* The checker runs that clause in a real browser, with a screenshot in the report. The requirement stays on its channel and in the regression set; its browser clause is re-run with it.

`timone-prd` writes that line when it writes the requirement. When `timone-plan` finds a claimed requirement that shows something new and has no such line, it does not stop the run: it adds the line to the register as a marked amendment and records it as a departure, as ADR-0052 already allows for requirement amendments inside the build.

## Consequences

- **Every phase that changes a screen pays for one more fresh context at close and one more browser pass at verification.** A phase that changes no screen pays nothing.
- **A pull request can open with questions at the top.** R22's "plain trades" is one: does a purchase not yet sold count in a ticker's total? The register does not say, and now the human is asked instead of the build choosing silently.
- **The look check still cannot judge taste.** A builder can write a long enough reason list. As in ADR-0039, the list is the artifact the human reads, and the screenshot now sits beside it.
- **The fixed list of unbelievable figures is written for money figures first**, because that is the app that failed. A project whose screens hold other kinds of figures may need items added. That is an edit to this list, not a new decision.
- **The delivery screen gate changes.** It used to refuse only when a shell slice's comparison was missing. It now refuses when the phase names a changed screen and the completion report carries no comparison for it.
