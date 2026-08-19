# Baseline — UI/UX (mandatory, all projects)

> **Tier: BASELINE — applies to every managed project, no selection, no opt-out.**
> **Status: Approved 2026-07-19 (fvermaut).**
> ✏ Amended 2026-08-19, **approved 2026-08-19 (fvermaut)**: the *Reading a screen of figures* section. It is the craft this entry has never carried, and its absence is why nothing in the pipeline could fail [ivtrends#22](https://github.com/fvermaut/ivtrends/pull/22) on how it looked ([ADR-0039](../../doc/adr/0039-the-look-is-gated-twice.md)). Its rules are derived from the `ivtrends` evidence; **primary sources are still owed** and tracked as [timone#39](https://github.com/fvermaut/timone/issues/39) — the section is normative meanwhile.
> ✏ Amended 2026-07-26, approved 2026-07-26: the disabled-in-flight rule is scoped to controls whose repeat activation is *unintended*. As written it collided with [baseline/accessibility.md](accessibility.md) — measurably, executing `scratch-app` phase 01 — since disabling a focused control blurs it and focus never returns (WCAG 2.4.3).

Cross-project UI/UX invariants (Next.js/React). Project-specific design systems live in each project's `doc/standards.md`. Accessibility is governed by [baseline/accessibility.md](accessibility.md), not restated here.

## Every view ships with all of its states

Loading, empty, error, and partial-data states are acceptance criteria for every view — not polish added later.

- **Loading:** < ~0.1 s no indicator; ~1–10 s wait indicator; > ~10 s determinate progress + cancel ([NN/g, Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/)). Prefer skeletons matching the final layout (no content jump) over spinners ([NN/g, Skeleton Screens](https://www.nngroup.com/articles/skeleton-screens/)); in Next.js: `loading.tsx` / Suspense fallbacks. Never flash an indicator for sub-100 ms responses.
- **Empty:** no blank regions — state what will appear, why it's empty, and offer the primary action that fills it ([NN/g, Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)). Distinguish "no data yet" from "filter matched nothing" (the latter keeps the filter visible and offers to clear it).
- **Error:** say what happened and what to do next, in the user's language — never a raw exception, bare status code, or stack trace ([NN/g, Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)). Every fetch-level error offers retry; a failed mutation never destroys what the user typed.

## Reading a screen of figures

Every rule above is behavioural and machine-checkable. None of them is about whether a screen can be *read*, which is why a board of 520 rows could pass the whole baseline and be rejected on sight.

- **A column is as wide as its widest figure, plus its padding. Never stretch a table to fill the viewport.** Stretching puts empty space between a name and its number, and comparing down a column is what a table is for. Wide content scrolls in its own container — which the responsive posture already requires — rather than being spread to fit.
- **Figures that are compared vertically are set tabular** (`font-variant-numeric: tabular-nums`, [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)), right-aligned, and keep their trailing zeros. Proportional digits make a column of numbers ragged at the decimal point and defeat scanning.
- **Density is a stated decision, not an accident.** A screen built for scanning many rows declares its row height and offers the operator the looser alternative; a screen built for reading one thing does not need the choice. Either way the number is chosen, not inherited from a component library's default padding.
- **A screen has an explicit ground and a small number of foreground levels.** Primary figure, supporting label, and dimmed or absent value should be distinguishable without reading them. Three levels is usually enough and more than four is noise.
- **Meaning carried by colour is carried by something else too.** This is the accessibility baseline's rule (1.4.1) and it is restated here because it is where a dense screen breaks it first: sector dots, up/down figures and state marks are exactly the places a hue ends up alone.
- **A repeated visual element means one thing.** The same mark used for two facts on one screen is a defect, however convenient — it was found and fixed in `ivtrends`' own prototype for that reason.

## Responsive posture

- One responsive codebase; no separate mobile site or per-device variants ([NN/g, RWD](https://www.nngroup.com/articles/responsive-web-design-definition/)).
- Breakpoints where the content breaks, not from a device list ([NN/g, Breakpoints](https://www.nngroup.com/articles/breakpoints-in-responsive-design/)). Usable from 360 px up, no horizontal page scroll; wide content (tables, charts, code) scrolls in its own container.
- The narrow layout is first-class: same content and tasks at every width — reflow and reprioritize, never drop features.

## Interaction and feedback

- Every action gets visible acknowledgment within 0.1 s — pressed state, optimistic update, or pending indicator.
- **Submitting controls go disabled/pending in flight where repeat activation is *unintended*** — submit, pay, delete, anything whose second press is an accident. There, double-submit must be impossible from the UI.
- **Where repeating the action *is* the user's intent — toggles, steppers, quantity +/− — never disable the control.** `disabled` on a focused element blurs it and focus falls to the document, which is a WCAG 2.4.3 failure: a keyboard user who operates one row's toggle must then tab in from the top of the page to reach anything else. [baseline/accessibility.md](accessibility.md) admits no opt-out and outranks this entry. Signal in-flight state on the *container* instead (`aria-busy` on the row or group), and let n activations be n operations, dispatched in order to a consistent end state. Where a control sits on the boundary, ask whether a second press is an accident or a decision — if it is a decision, keep it focusable.
- Non-blocking success feedback (toast/inline) after every mutation that doesn't already show its result.
- Prefer undo over confirmation dialogs; reserve dialogs for genuinely irreversible, infrequent operations ([NN/g, Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/)). Confirmation buttons name the action ("Delete project"), not "Yes/OK".
- Destructive controls are spatially and visually separated from benign ones — never adjacent in menus, dialogs, or table rows ([NN/g, Proximity of Consequential Options](https://www.nngroup.com/articles/proximity-consequential-options/)).

## Forms

- Labels always visible; placeholders never substitute for labels or carry required information.
- Validate per field on blur — not per keystroke, never on untouched fields ([NN/g, Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)).
- Errors adjacent to the field, signaled by more than color, saying how to fix the problem.
- On failed submit, preserve all entered values and move focus/scroll to the first error.
- Ask only what the feature needs; every field traces to a requirement ([NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)).
- Accept forgiving input formats (spaces in card/phone numbers, locale date order) and normalize in code.

## i18n/l10n posture

Applies from day one even in single-locale projects (retrofitting is where the cost is).

- All user-facing strings go through the message layer (next-intl or equivalent); no user-visible literals in components ([W3C, Localization vs. Internationalization](https://www.w3.org/International/questions/qa-i18n)).
- Never concatenate sentence fragments or bake markup order into code: full messages with named placeholders, ICU plural/select for counts.
- Layouts tolerate text expansion (short labels can grow ~300%): no fixed widths sized to English copy on buttons, tabs, badges ([W3C, Text Size in Translation](https://www.w3.org/International/articles/article-text-size)).
- Dates, numbers, currency via `Intl` APIs from the active locale — never hand-assembled. No text baked into images.

## Sensible defaults

- Defaults are product decisions — most users never change them; every pre-filled value must serve the user, not the product ([NN/g, The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/)).
- Never pre-select options that cost the user money, data, or privacy (opt-ins, upsells, sharing scopes).
- Pre-fill what the system already knows instead of asking again.
- No safe default for a consequential choice → leave it unselected, require an explicit pick ([NN/g, Radio Buttons](https://www.nngroup.com/articles/radio-buttons-default-selection/)).

## Tooling

Tool-enforceable parts live in tool config, not prose. Recommended per project:

- **next-intl** as message layer; `react/jsx-no-literals` scoped to app components where practical.
- **Playwright** checks for the loading/empty/error matrix on key views and a 360 px-viewport smoke pass.
- **Storybook** (optional) to review state variants of shared components in isolation.

## Sources

- NN/g — [Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/) · [Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/) · [Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- NN/g — [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) · [Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/) · [Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)
- NN/g — [Responsive Web Design and UX](https://www.nngroup.com/articles/responsive-web-design-definition/) · [Breakpoints in Responsive Design](https://www.nngroup.com/articles/breakpoints-in-responsive-design/)
- NN/g — [Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/) · [Consequential Options Close to Benign Options](https://www.nngroup.com/articles/proximity-consequential-options/)
- NN/g — [The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/) · [Radio Buttons: Always Select One?](https://www.nngroup.com/articles/radio-buttons-default-selection/)
- W3C i18n — [Localization vs. Internationalization](https://www.w3.org/International/questions/qa-i18n) · [Text Size in Translation](https://www.w3.org/International/articles/article-text-size)
