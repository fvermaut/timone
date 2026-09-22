# ADR-0058: A review comment is judged point by point, and may decide a requirement

- **Status:** accepted
- **Date:** 2026-09-22
- **Source:** fvermaut, on [ivtrends#118](https://github.com/fvermaut/ivtrends/pull/118), 2026-09-22, after the machine's reply to his review comment.
- **Amends:** [ADR-0016](0016-review-remediation-rides-the-verify-fix-shape.md) (the intent boundary).

## Context

fvermaut left one comment on ivtrends#118 with four points. Three were plain faults: date-range totals at $0, sample runs dated in the future, and layout faults. The fourth decided a question the requirement had left open — "a ticker's total counts only finished trades" — and asked for it to be written into R22 as a marked amendment.

The machine changed nothing. Its reply said the fourth point was a requirement change and had to take the full path, and that fixing the other three beside it "would make it unclear which parts are settled". It then asked him to choose between two options, one of which he had already written in the comment.

Two rules in the remediation prompt produced this:

1. **"Take exactly one of these three paths."** The prompt judged the comment as one piece, so one point that needed something else stopped all four.
2. **"A comment that would move a requirement — reply, commit nothing."** ADR-0016 drew this line so the machine would not change a requirement on its own reading. But here the reading was not the machine's. The comment stated the new requirement in the words of the person who approves requirements. The full path would have asked him to confirm what he had just written.

## Decision

**A review comment is judged point by point.** Each point takes its own path. A clear point is never held back because another point in the same comment needs a question or a requirement change.

**A requirement change the comment itself decides is made, not refused.** When the comment states what the requirement should say, it is the human's decision and all the confirmation the change needs. The remediation writes it into the criteria register as a marked amendment — a dated note quoting the comment, the old wording kept readable, the clause changed — sets the requirement to `revised` so the next check writes a fresh probe, and makes the code change.

**Only an undecided point waits.** A point that would move a requirement without saying how, or that the machine would have to guess at, gets a question in the reply. Nothing is committed for that point, and everything else in the comment is still done.

**One reply, point by point**, saying what was changed for each and asking only what could not be acted on.

## Consequences

- One comment costs one round-trip again, which was ADR-0016's own promise.
- A requirement can now change from a pull request comment. The record is the marked amendment in the register, which names the comment, and the full re-check that follows every remediation. If the pull request is closed unmerged, the amendment goes with the branch, as PRD-03 R3 already says of amendments made during the build.
- ADR-0016's residual risk grows a little: the machine now judges whether a comment *decides* a requirement, not only whether it *touches* one. A misjudged point lands a marked amendment the human can read and revert on the pull request, not a silent change.
