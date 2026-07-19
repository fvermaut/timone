# Baseline — UI/UX (mandatory, all projects)

> **Tier: BASELINE — applies to every managed project, no selection, no opt-out.**
> **Status: Draft — pending review (fvermaut).**

Cross-project UI/UX invariants for the web apps we build (Next.js/React). Project-specific design systems, brand, and visual language live in each project's `doc/standards.md` — this entry holds only what is true regardless of the design. Accessibility requirements (contrast, focus, semantics, target sizes, `lang`, reduced motion) are governed by [baseline/accessibility.md](accessibility.md) and are not restated here.

## Every view ships with all of its states

A screen or data-bearing component is not done when the happy path renders. Loading, empty, error, and partial-data states are part of the acceptance criteria for every view, not polish added later.

**Loading.** Apply the three response-time limits: under ~0.1 s no indicator is needed; between ~1 s and 10 s show a wait indicator; beyond ~10 s show determinate progress and a way to cancel ([NN/g, Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/)). For page- and section-level loads, prefer skeleton screens that mirror the final layout over centered spinners ([NN/g, Skeleton Screens](https://www.nngroup.com/articles/skeleton-screens/)); in Next.js this maps to `loading.tsx` / Suspense fallbacks. Skeletons must match the eventual layout so content does not jump when it arrives. Never flash an indicator for sub-100 ms responses.

**Empty.** No data-bearing view may render as a blank region. An empty state states what will appear here, why it is empty, and offers the primary action that fills it ("No invoices yet — create your first invoice"), because empty states are where users learn the system during onboarding ([NN/g, Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)). Distinguish "no data yet" from "your filter/search matched nothing" — the second keeps the filter visible and offers to clear it.

**Error.** Error states say what happened and what to do next, in the user's language — never a raw exception, status code alone, or stack trace ([NN/g, Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)). Every fetch-level error state offers a retry. A failed mutation must never destroy what the user typed.

## Responsive posture

- One responsive codebase; no separate mobile site or per-device page variants ([NN/g, RWD](https://www.nngroup.com/articles/responsive-web-design-definition/)).
- Breakpoints are chosen where the content breaks, not from a device list ([NN/g, Breakpoints in Responsive Design](https://www.nngroup.com/articles/breakpoints-in-responsive-design/)). Every layout must be usable from a 360 px viewport up, with no horizontal scrolling of the page body; wide content (tables, charts, code) scrolls inside its own container.
- The narrow layout is a first-class deliverable: same content and same tasks available at every width — narrower screens reflow and reprioritize, they do not drop features.

## Interaction and feedback

- Every user action gets visible acknowledgment within the 0.1 s limit — pressed states, optimistic update, or a pending indicator ([NN/g, Response Times](https://www.nngroup.com/articles/response-times-3-important-limits/)).
- Submitting controls enter a disabled/pending state while the request is in flight; double-submit of a mutation must be impossible from the UI.
- Non-blocking success feedback (toast/inline confirmation) after every mutation that doesn't already show its result on screen.
- For destructive actions, prefer undo over a confirmation dialog; reserve confirmation dialogs for genuinely irreversible, infrequent operations, and never make confirming a reflex by overusing them ([NN/g, Confirmation Dialogs](https://www.nngroup.com/articles/confirmation-dialog/)). Confirmation buttons name the action ("Delete project"), not "Yes/OK".
- Destructive controls are separated — spatially and visually — from benign ones; never adjacent in menus, dialogs, or table rows ([NN/g, Proximity of Consequential Options](https://www.nngroup.com/articles/proximity-consequential-options/)).

## Forms

- Labels are always visible; placeholder text never substitutes for a label and disappears the moment typing starts, so it may not carry required information.
- Validate inline, per field, when the user finishes the field (on blur) — not on every keystroke and never before they've had a chance to type; flagging an untouched field as an error is a hostile pattern ([NN/g, Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)).
- Error messages appear adjacent to the offending field, signaled by more than color alone, and say how to fix the problem, not just that it's wrong.
- On failed submit, preserve all entered values and move focus/scroll to the first error.
- Ask only for what the feature actually needs; every field must trace to a requirement ([NN/g, Website Forms Usability](https://www.nngroup.com/articles/web-form-design/)).
- Accept forgiving input formats (spaces in card/phone numbers, either date order the locale allows) and normalize in code rather than rejecting.

## i18n/l10n posture

Applies from day one even when a project launches in a single locale — retrofitting is where the cost is.

- All user-facing strings go through the message layer (next-intl or equivalent); no user-visible literals in components. This is the invariant that keeps later localization a translation task instead of a refactor ([W3C, Localization vs. Internationalization](https://www.w3.org/International/questions/qa-i18n)).
- Never build sentences by concatenating fragments or embedding markup order into code; use full messages with named placeholders, and ICU plural/select for counts — word order and plural rules differ per language ([W3C i18n best practices](https://www.w3.org/International/questions/qa-i18n)).
- Layouts must tolerate text expansion: short labels can grow ~300% in translation, so no fixed widths sized to the English copy on buttons, tabs, or badges ([W3C, Text Size in Translation](https://www.w3.org/International/articles/article-text-size)).
- Dates, numbers, and currency are formatted with the `Intl` APIs from the active locale — never hand-assembled.
- No text baked into images.

## Sensible defaults

- Defaults are product decisions: most users never change them, so every pre-filled value and pre-selected option must be the choice that serves the user best, not the one that serves the product ([NN/g, The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/)).
- Never pre-select options that cost the user money, data, or privacy (opt-ins, upsells, sharing scopes).
- Pre-fill what the system already knows (locale-derived country, remembered values) instead of asking again.
- When no safe default exists for a consequential choice, leave it unselected and require an explicit pick rather than guessing ([NN/g, Radio Buttons: Always Select One?](https://www.nngroup.com/articles/radio-buttons-default-selection/)).

## Tooling

Tool-enforceable parts of the above live in tool config, not prose. Recommended per project:

- **next-intl** as the message layer; enable its ESLint-detectable pattern of no literal strings in JSX where practical (e.g. `react/jsx-no-literals` scoped to app components).
- **Playwright** checks for the state matrix on key views (loading/empty/error) and a 360 px-viewport smoke pass.
- **Storybook** (optional, per project) to make loading/empty/error variants of shared components reviewable in isolation.

## Sources

- NN/g — [Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- NN/g — [Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/)
- NN/g — [Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/)
- NN/g — [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) and [10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- NN/g — [Website Forms Usability: Top 10 Recommendations](https://www.nngroup.com/articles/web-form-design/)
- NN/g — [Responsive Web Design (RWD) and User Experience](https://www.nngroup.com/articles/responsive-web-design-definition/) and [Breakpoints in Responsive Design](https://www.nngroup.com/articles/breakpoints-in-responsive-design/)
- NN/g — [Confirmation Dialogs Can Prevent User Errors](https://www.nngroup.com/articles/confirmation-dialog/) and [Dangerous UX: Consequential Options Close to Benign Options](https://www.nngroup.com/articles/proximity-consequential-options/)
- NN/g — [The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/) and [Radio Buttons: Always Select One?](https://www.nngroup.com/articles/radio-buttons-default-selection/)
- W3C i18n — [Localization vs. Internationalization](https://www.w3.org/International/questions/qa-i18n) and [Text Size in Translation](https://www.w3.org/International/articles/article-text-size)
