# Phase 33 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 33a — Reading a screen of figures gets its sources

**Built.** Each of the five rules in the *Reading a screen of figures* section of `standards/baseline/ui-ux.md` now ends in either a cited primary source or an explicit house-style label. Four rules gained a real source found and fetched (not just search-snippet-guessed): column width (A List Apart, on sizing table columns to their data), tabular figures (Butterick's Practical Typography, on why tabular figures help vertical comparison — the existing MDN link stays as the mechanism citation, not the UX claim), foreground ink levels (NN/g's Visual Hierarchy piece, for the "distinguishable without reading" claim only — the specific count of three is labeled house style since no source defends that number), and one-mark-one-meaning (NN/g's consistency heuristic, chosen over Tufte's chartjunk/data-ink idea because Tufte's concept is about excess ink, not symbol ambiguity, and doesn't fit this rule's actual claim). Density has no defensible outside source for the specific combination the rule makes (a stated decision paired with an operator-visible looser alternative), so it is now explicitly labeled this product family's house style rather than left looking like uncredited research. The file's history block gained one dated line naming the change and closing timone#39, with no approval wording. The `## Sources` list gained three new bullets for the newly-cited publishers.

**Files touched.**

- `standards/baseline/ui-ux.md` — sourced/labeled the five rules, added one `✏ Amended 2026-09-04` history line, extended `## Sources`. No other section changed.

**Decisions taken inside the slice.**

- Column width: A List Apart over any NN/g data-table piece — NN/g's table content doesn't make this specific sizing claim; A List Apart's does, at a comparable tier.
- Tabular figures: Butterick's Practical Typography, a recognized typography reference, for the vertical-comparison claim; MDN stays as the mechanism citation only, per the plan's explicit instruction that MDN cannot carry the UX claim.
- Density: no citation added. Search turned up only product pattern-library docs (not this file's citation tier) for the operator-toggle idea, and NN/g's progressive-disclosure material doesn't address row density or a stated toggle. Labeled house style rather than stretching a mismatched source to fit.
- Foreground ink levels: split the claim — "distinguishable without reading" is sourced to NN/g's squint-test description in Visual Hierarchy in UX; the number three is unsupported anywhere found and is labeled house style, following the shape the plan itself suggested for this rule.
- One mark, one meaning: NN/g's consistency heuristic over Tufte. Tufte's chartjunk/data-ink principle is about removing non-data ink and explicitly praises multifunctioning marks — the opposite of what this rule needs, which is that one mark must not carry two meanings. NN/g's heuristic ("different words/situations/actions should not appear to mean the same thing" — applied here in its converse, the same thing should not appear to mean different things) is the on-point match. The existing `ivtrends` origin sentence was kept unchanged, as instructed, since it is true regardless of whether an outside source also exists.
- Left the 2026-08-19 history line's "primary sources are still owed" wording untouched, since the plan's instruction was to add a line *below* the existing ones, not edit them; the new 2026-09-04 line, read after it in date order, is what resolves the claim.

**Validation evidence.** No behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace; validation is checklist-based, per the plan.

```
$ sed -n '/^## Reading a screen of figures/,/^## Responsive posture/p' standards/baseline/ui-ux.md
```
Confirmed: all five rules end in a citation or an explicit house-style sentence; the pre-existing colour rule (already sourced to WCAG 1.4.1) was left untouched.

```
$ for url in $(grep -oE 'https://[^) ]+' standards/baseline/ui-ux.md | sort -u); do code=$(curl -s -o /dev/null -w '%{http_code}' -L "$url" --max-time 15); echo "$code $url"; done
```
Every URL returned 2xx except one pre-existing, untouched link in the 2026-08-19 history line (`github.com/fvermaut/ivtrends/pull/22`, 404 — a private-repo link, out of this slice's edit scope, not one of the five citations owed).

```
$ git diff --stat standards/baseline/ui-ux.md
 standards/baseline/ui-ux.md | 14 +++++++++-----
 1 file changed, 9 insertions(+), 5 deletions(-)
```
Only `standards/baseline/ui-ux.md` changed; within it, only the history block, the *Reading a screen of figures* section, and the `## Sources` list moved — every other section is untouched.

**Checklist outcomes.**

- [x] Each of the five rules ends in a resolvable citation or an explicit house-style sentence — no rule left uncited with no explanation.
- [x] The history block gains one dated `✏ Amended 2026-09-04:` line naming this change and closing timone#39, carrying no "approved" stamp.
- [x] `## Sources` gains one line per newly-cited publisher (A List Apart, Butterick's Practical Typography, and a new NN/g bullet for the two newly-cited NN/g articles).
- [x] Every URL touched by this slice returns non-error; the one 4xx in the file predates this slice and sits outside its edit scope.
- [x] `git diff` touches only the history block, the *Reading a screen of figures* section, and `## Sources` — no other section moved.

**What delivery must know.** The pre-existing 404 on `github.com/fvermaut/ivtrends/pull/22` (in the 2026-08-19 history line) is not something this slice was permitted to fix — flag it separately if it needs attention. The 2026-08-19 line still reads "primary sources are still owed"; the 2026-09-04 line below it is what closes that, read in date order, rather than the earlier line being edited for consistency.
