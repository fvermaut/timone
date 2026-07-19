# Baseline — Accessibility (mandatory, all projects)

> **Tier: BASELINE — applies to every managed project, no selection, no opt-out.**
> **Status: Draft — pending review (fvermaut).**

## Why this is baseline

The **European Accessibility Act** (Directive (EU) 2019/882) applies since **2025-06-28**. For client work in the EU this is a legal requirement, not a preference:

- **Scope hits typical client work.** "E-commerce services" are defined broadly — any service provided at a distance, by electronic means, at a consumer's request, "with a view to concluding a consumer contract" (Art. 2(2)). Any site with a checkout, booking, subscription or quote-to-contract flow is in scope, alongside consumer banking, transport and e-books.
- **The obligation sits on the client** (the service provider), not on the contractor. Microenterprises providing services (< 10 staff **and** ≤ €2M turnover, Art. 3(23)) are exempt (Art. 4(5)) — never assume the exemption without checking, and build to the standard regardless: conformity with the harmonised standard gives the client a presumption of conformity (Art. 15), the cheapest defensible position. Skipping requires a documented disproportionate-burden assessment (Art. 14 + Annex VI) — not our call to make.
- **No grace for new builds.** Transitional relief (Art. 32) covers pre-2025 service contracts and equipment only, until 2030-06-28 at the latest.
- **Working technical baseline: EN 301 549 v3.2.1**, the harmonised standard. Its clause 9 imports **WCAG 2.1 level A + AA** for web content; clause 10 covers downloadable documents (PDFs shipped to users count); clause 11 covers non-web software including mobile apps.
- **Churn flag (recheck at next review):** an ETSI/CEN revision of EN 301 549 aligned to **WCAG 2.2 AA** is in progress, with OJEU harmonisation expected during 2026. WCAG 2.2 drops 4.1.1 Parsing (already "always satisfied" for HTML per the 2.1 Understanding note) and adds six A/AA criteria — we meet those now (see Guidelines), since they are cheap in new builds and expensive to retrofit.

## Enforcement points in the process

- **Requirements (stage 3):** PRDs covering user-facing functionality include accessibility acceptance criteria (PRD-01.R20).
- **Verification (stage 7):** browser-channel checks include accessibility checks — automated scan where tooling exists, HUMAN-CHECK script otherwise.
- **Delivery review (stage 8):** the Standards axis covers this entry.
- **Tool-enforced part** lives in tool config, not here — see [Tooling](#tooling).

## Guidelines

What automated tooling cannot decide. Criteria numbers refer to WCAG 2.1/2.2.

### Semantics and structure

- **Native element first** — the First Rule of ARIA: if a native HTML element with the required semantics and behavior exists, use it instead of ARIA on a repurposed element. `<button>` for actions, `<a href>` for navigation; a `div` with `onClick` fails keyboard operation (2.1.1) and name/role (4.1.2) in ways linters only partially catch.
- **Headings express the outline, not font sizes** (1.3.1, 2.4.6): one `h1` per view, no skipped levels; pick the tag for structure and style it with CSS.
- **Alt text is a content decision, not presence-checking**: decorative images get `alt=""` deliberately; functional images (icon-only buttons) describe the action, not the picture (1.1.1).

### Keyboard and focus management

- DOM order = focus order = visual order (2.4.3) — CSS `order`, `flex-direction: *-reverse` and absolute positioning silently divorce the three.
- **Manage focus at every context change you create**: modal open → focus moves into the dialog, is trapped while open, returns to the trigger on close; SPA/App-Router route change → move focus to the new view's `h1` (or announce it) — a silent client-side navigation is invisible to a screen reader (2.4.3, 4.1.3).
- Never remove the focus outline without an equally visible replacement (2.4.7); the focus style is a design token chosen once, and must not be obscured by sticky headers/footers (2.4.11, WCAG 2.2).

### Forms and errors

- Every field has a programmatic `<label>`; a placeholder is not a label — it vanishes on input (3.3.2).
- Errors: text next to the field naming the problem **and** the fix (3.3.1, 3.3.3), associated via `aria-describedby` + `aria-invalid`; on failed submit, move focus to an error summary or the first invalid field. Async submit outcomes are announced via a status message (`role="status"`), not only shown (4.1.3).
- `autocomplete` tokens on all personal-data fields — 1.3.5 (AA) is trivially violated in every new form.
- WCAG 2.2 posture: don't re-ask information already entered in the same flow (3.3.7); auth must work with password managers and paste — no transcription or puzzle as the only path (3.3.8).

### ARIA judgement calls

- **No ARIA is better than bad ARIA** (ARIA APG). A widget role is a contract: it obliges the full APG keyboard pattern; if you won't implement all of it, fall back to native elements.
- Never change native semantics (Second Rule — wrap, don't override); never put `aria-hidden="true"` or `role="presentation"` on focusable elements (Fourth Rule).
- Reserve `aria-live` for genuine async status (cart updated, results loaded); a chatty live region is worse than none.

### Visual decisions

- Contrast is a token-palette decision made once at onboarding, not fixed per page: text ≥ 4.5:1 (≥ 3:1 above 24 px, or 18.66 px bold), UI component boundaries and states ≥ 3:1 (1.4.3, 1.4.11).
- Color is never the sole carrier of meaning (1.4.1) — pair with icon, text or underline (links inside body text need more than a hue shift).
- Layout reflows to 320 CSS px with no horizontal scroll (1.4.10); no fixed-height text containers — they break user text-spacing overrides (1.4.12) and translation; never lock orientation (1.3.4).
- Pointer targets ≥ 24×24 CSS px (2.5.8, WCAG 2.2); every drag interaction has a single-pointer alternative (2.5.7).

### Verification expectations (stage 7)

Automated scans flag detectable failures; they cannot establish conformance. Per user-facing feature, verification includes: (a) a full keyboard-only pass of the flow; (b) a screen-reader smoke test — VoiceOver + Safari on the dev machine (`Cmd+F5`); (c) a 320 px / 200 % zoom reflow check. Where the agent cannot perform (b) itself, it emits a HUMAN-CHECK script naming the exact flows to test.

## Tooling

Configured at onboarding per stack; the enforced rules live in that config, not in this entry.

- `eslint-plugin-jsx-a11y`, strict preset — static JSX checks (labels present, no positive `tabindex`, valid ARIA attributes) for React/Next projects.
- `@axe-core/playwright` wired into the stage-7 browser checks — violations are failures; no suppression without a linked justification.
- Do not stack additional scanners (Lighthouse a11y, Storybook a11y) — they re-run axe.

## Sources

- [Directive (EU) 2019/882 (European Accessibility Act) — EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882)
- [ETSI EN 301 549 v3.2.1 (PDF)](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)
- [European Commission — accessibility standard: latest changes (harmonised version status)](https://digital-strategy.ec.europa.eu/en/policies/latest-changes-accessibility-standard)
- [WCAG 2.1 — W3C Recommendation](https://www.w3.org/TR/WCAG21/)
- [WCAG 2.2 — W3C Recommendation](https://www.w3.org/TR/WCAG22/)
- [Understanding SC 4.1.1 Parsing (obsolete note)](https://www.w3.org/WAI/WCAG21/Understanding/parsing.html)
- [Using ARIA — the Rules of ARIA use (W3C)](https://www.w3.org/TR/using-aria/)
- [ARIA Authoring Practices Guide — Read Me First (W3C WAI)](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
