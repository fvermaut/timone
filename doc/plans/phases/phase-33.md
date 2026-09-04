# Phase 33: Primary sources for the screen-of-figures craft rules

> **Status:** Planned.

> **Companion phases:** [phase-03](phase-03.md) (complete) — drafted this file the first time and set the pattern this phase follows: cited, ~1 page, a closing `## Sources` list. No other phase touches this file. Governing decision: [ADR-0039](../../adr/0039-the-look-is-gated-twice.md) — it is why the *Reading a screen of figures* section exists at all, and its own text is what admits the section shipped without the sources every other section in this entry carries.

## Requirements

**Un-anchored chore work (filed as [timone#39](https://github.com/fvermaut/timone/issues/39)):** `standards/baseline/ui-ux.md`'s *Reading a screen of figures* section was approved 2026-08-19 with its rules taken from one project's review findings rather than from outside research — its own amendment note says so and names this ticket as where the gap is tracked. This phase closes the gap: each of the section's five rules gets a cited primary source, or an explicit line saying it is this product family's convention rather than research. Neither PRD register asks for this — a mis-sourced document is not a product behaviour — so no requirement ID is claimed and none lapses.

**No regression set applies.** Nothing runs this document: it is prose read by people and by future drafting agents, not code, so there is no behaviour a check could watch and nothing this phase could break that a test would catch. The validation below is a checklist against the committed text, not a run of anything.

## Goal Description

Every other section of `standards/baseline/ui-ux.md` carries an NN/g or W3C citation for each of its rules. The *Reading a screen of figures* section carries one MDN link, for the CSS property behind tabular figures, and nothing else — the rest of its rules are written from what a specific project's screen got wrong, not from outside sources. The entry's own header already flags this as owed rather than finished, and the library's stated discipline (`standards/README.md`: "agents draft each entry from cited primary sources") is what the section is still catching up to.

The fix is judged rule by rule, not applied as one policy. For each of the five rules — column width, tabular figures, density, foreground ink levels, one-mark-one-meaning — the executing agent searches for a defensible primary source and cites it, matching the tier already used elsewhere in this file: NN/g and W3C are examples of that tier, not an exhaustive list, and a recognized authority in typography or information design (for instance, on how tables are set or on why a mark should carry one meaning) sits in the same tier if its claim is the one the rule makes. Where a real search turns up nothing rule-specific, the rule is kept and the section says plainly, next to it, that it is this product family's convention rather than research — the ticket names this as the correct outcome for a rule with no defensible source, not a fallback to apologize for.

This does not clear the significance bar for a decision record. Citing a source for an already-approved rule, or naming a rule as house style where no source exists, is easy to reverse (the next reviewer can swap either for a better source later), unsurprising (it is exactly what the library's own discipline already asks of every entry), and involves no trade-off between competing designs — it is research and prose, not a choice about how Timone or a project works. No ADR is written for it.

One sub-phase carries the whole of this phase. The five rules live in one section of one file, a fresh-context agent can research and write all five in a single pass, and splitting them into five slices would buy no independent reviewability — a partial edit to this section is not a state anyone would ship on its own.

## Context & Prerequisites

- **`standards/baseline/ui-ux.md`, lines 1–27** — the file this phase edits. Line 5 is the amendment note that opens this ticket; the *Reading a screen of figures* section (lines 18–27) is the one under repair; the bottom `## Sources` list (lines 77–84) is where every other section's citations already live and where this section's new ones join them.
- **`standards/README.md`** — the library's authorship model ("agents draft each entry from cited primary sources... fvermaut reviews and approves") and the per-entry discipline (no tool-enforceable rules in prose, no commonplaces, cited, short).
- **[phase-03](phase-03.md)** — drafted this file originally; its per-entry conventions (inline citation plus a closing `## Sources` list, ~1 page, `## Sources` section required) are the pattern to match rather than reinvent.
- **[ADR-0039](../../adr/0039-the-look-is-gated-twice.md)** — records why the section was added un-sourced in the first place and why it stayed normative meanwhile; it is what makes "owed" the right word rather than "wrong."
- **Known-bad state this phase fixes:** the section's five rules currently carry zero rule-specific citations between them — the MDN link documents a CSS property, not the UX claim the rule makes about it.

## Sub-phases

### Sub-phase 33a: Reading a screen of figures gets its sources

**[MODIFY]** `standards/baseline/ui-ux.md` — for each of the five rules below, either add a citation (inline, in the existing style, plus a line in the closing `## Sources` list) or add an explicit house-style sentence. Add one dated `✏ Amended <date>:` line to the file's history block (below the existing line 5) naming this change and closing timone#39 — **write no "approved" stamp on it**: this is a chore, and its judgement lands on its pull request, not on a claim made inside the file.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> No dependency on other sub-phases — the only sub-phase in this phase.

The five rules, quoted from the current text, each judged on its own:

1. **Column width** — "A column is as wide as its widest figure, plus its padding. Never stretch a table to fill the viewport." Search first among the same tier already used in this file (NN/g has written on data-table design) before reaching to a typography authority (for instance, on how tables are set in print or on screen). Cite whichever source actually makes this claim; do not cite a source that only discusses something adjacent.
2. **Tabular figures** — "Figures that are compared vertically are set tabular... and keep their trailing zeros." The MDN link stays: it correctly documents the CSS mechanism (`font-variant-numeric`). What is owed is a source for the claim the rule makes on top of the mechanism — that tabular figures help a reader compare numbers stacked in a column. A typography authority that discusses tabular numerals for this reason is the kind of source that closes this one; the CSS spec itself is not, since it says what the property does, not why a reader benefits.
3. **Density** — "Density is a stated decision, not an accident... offers the operator the looser alternative..." Search for a primary source on information density or progressive disclosure in interface design. If none defensibly supports naming a stated density decision with an operator-visible alternative — as opposed to density in general — say so and label the rule house style.
4. **Foreground ink levels** — "A screen has an explicit ground and a small number of foreground levels... Three levels is usually enough..." Search for a primary source on visual hierarchy through a small number of contrast or ink levels. If the specific number three has no defensible source even where the general principle does, say which part is sourced and which part (the number) is house style.
5. **One mark, one meaning** — "A repeated visual element means one thing... it was found and fixed in `ivtrends`'s own prototype for that reason." This rule already names its own origin as a project finding, not research — the section's history note repeats that origin for the section as a whole. Search for a primary source on a visual mark carrying a single meaning (chartjunk, redundant encoding) before concluding there is none; if the search comes up empty, keep the existing project-finding sentence and add the house-style label rather than removing the origin story, since it is true and belongs in the text either way.

Keep the section, and the file as a whole, inside the length discipline phase-03 set for this file: roughly a page for the section, no restructuring of anything outside the section and the history block.

#### Agent Validation Steps

```bash
# the section under repair, in full, for a human or the next agent to read against the checklist below
sed -n '/^## Reading a screen of figures/,/^## Responsive posture/p' standards/baseline/ui-ux.md

# every URL in the file must resolve — a citation that 404s is worse than no citation
for url in $(grep -oE 'https://[^) ]+' standards/baseline/ui-ux.md | sort -u); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -L "$url")
  echo "$code $url"
done

# nothing outside the section and the history block changed
git diff --stat standards/baseline/ui-ux.md
```

- [ ] Each of the five rules under "Reading a screen of figures" ends in either a resolvable citation (present inline and in `## Sources`) or an explicit sentence naming it as this product family's convention with no outside source — no rule is left uncited with no explanation
- [ ] The file's history block gains one dated `✏ Amended <date>:` line naming this change and closing timone#39, carrying no "approved" stamp
- [ ] `## Sources` gains one line per newly-cited publisher, grouped in the existing style
- [ ] Every URL in the file returns a non-error status in the curl check above; a 4xx/5xx is fixed or the citation is replaced
- [ ] `git diff` touches only the history block and the *Reading a screen of figures* section — no other section of the file moved

## Dependency graph

```
33a → (none)   the whole of this phase — source or label each of the five craft rules
```
