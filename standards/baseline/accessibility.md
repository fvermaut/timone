# Baseline — Accessibility (mandatory, all projects)

> **Tier: BASELINE — applies to every managed project, no selection, no opt-out.**
> **Status: Approved 2026-07-19 (fvermaut).**

## Why this is baseline

The **European Accessibility Act** (Directive (EU) 2019/882) applies since **2025-06-28** — for EU client work a legal requirement, not a preference:

- **Scope hits typical client work:** "e-commerce services" = any electronic distance service "with a view to concluding a consumer contract" (Art. 2(2)) — checkout, booking, subscription, quote-to-contract flows, plus consumer banking, transport, e-books.
- **The obligation sits on the client** (service provider). Microenterprise services (< 10 staff **and** ≤ €2M turnover, Art. 3(23)) are exempt (Art. 4(5)) — never assume it; build to the standard regardless (harmonised-standard conformity = presumption of conformity, Art. 15, the cheapest defensible position). Skipping requires a documented disproportionate-burden assessment (Art. 14 + Annex VI) — not our call.
- **No grace for new builds:** transitional relief (Art. 32) covers pre-2025 service contracts and equipment only, until 2030-06-28.
- **Technical baseline: EN 301 549 v3.2.1** (harmonised): clause 9 = WCAG 2.1 A + AA for web; clause 10 = downloadable documents (shipped PDFs count); clause 11 = non-web software incl. mobile apps.
- **Churn flag (recheck at next review):** an EN 301 549 revision aligned to **WCAG 2.2 AA** is in progress, OJEU harmonisation expected during 2026. 2.2 drops 4.1.1 Parsing and adds six A/AA criteria — we meet those now (cheap in new builds, expensive to retrofit).

## Enforcement points

PRDs for user-facing functionality include accessibility acceptance criteria (PRD-01.R20, stage 3); stage-7 browser checks include accessibility (automated scan or HUMAN-CHECK script); stage-8 Standards axis covers this entry. Tool-enforced part lives in tool config — see [Tooling](#tooling).

## Guidelines

What tooling cannot decide. Criteria numbers refer to WCAG 2.1/2.2.

### Semantics and structure

- **Native element first** (First Rule of ARIA): `<button>` for actions, `<a href>` for navigation — a `div` with `onClick` fails 2.1.1 and 4.1.2.
- Headings express the outline, not font sizes (1.3.1, 2.4.6): one `h1` per view, no skipped levels; style with CSS.
- Alt text is a content decision: decorative → `alt=""` deliberately; functional images describe the action, not the picture (1.1.1).

### Keyboard and focus

- DOM order = focus order = visual order (2.4.3) — CSS `order`, `*-reverse`, absolute positioning silently divorce the three.
- Manage focus at every context change: modal open → focus in, trapped, back to trigger on close; SPA route change → focus or announce the new view's `h1` (2.4.3, 4.1.3).
- Never remove the focus outline without an equally visible replacement (2.4.7); it is a design token chosen once, not obscured by sticky headers/footers (2.4.11).

### Forms and errors

- Every field has a programmatic `<label>`; a placeholder is not a label (3.3.2).
- Errors: text next to the field naming problem **and** fix (3.3.1, 3.3.3), via `aria-describedby` + `aria-invalid`; failed submit → focus an error summary or first invalid field; async outcomes announced via `role="status"` (4.1.3).
- `autocomplete` tokens on all personal-data fields (1.3.5).
- WCAG 2.2: don't re-ask information already entered in the flow (3.3.7); auth works with password managers and paste (3.3.8).

### ARIA judgement calls

- **No ARIA is better than bad ARIA** (ARIA APG). A widget role obliges the full APG keyboard pattern — otherwise use native elements.
- Never change native semantics (wrap, don't override); never `aria-hidden="true"`/`role="presentation"` on focusable elements.
- `aria-live` only for genuine async status; a chatty live region is worse than none.

### Visual decisions

- Contrast is a token-palette decision made once at onboarding: text ≥ 4.5:1 (≥ 3:1 above 24 px or 18.66 px bold), UI component boundaries/states ≥ 3:1 (1.4.3, 1.4.11).
- Color never the sole carrier of meaning (1.4.1) — pair with icon, text, or underline.
- Reflow to 320 CSS px with no horizontal scroll (1.4.10); no fixed-height text containers (1.4.12); never lock orientation (1.3.4).
- Pointer targets ≥ 24×24 CSS px (2.5.8); every drag has a single-pointer alternative (2.5.7).

### Verification (stage 7)

Automated scans cannot establish conformance. Per user-facing feature: (a) full keyboard-only pass; (b) screen-reader smoke test — VoiceOver + Safari (`Cmd+F5`), or a HUMAN-CHECK script naming the exact flows; (c) 320 px / 200 % zoom reflow check.

## Tooling

Configured at onboarding per stack; enforced rules live in that config.

- `eslint-plugin-jsx-a11y`, strict preset (React/Next).
- `@axe-core/playwright` in stage-7 browser checks — violations are failures; no suppression without a linked justification.
- No additional scanners (Lighthouse/Storybook a11y re-run axe).

## Sources

- [Directive (EU) 2019/882 (European Accessibility Act) — EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882)
- [ETSI EN 301 549 v3.2.1 (PDF)](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)
- [European Commission — accessibility standard: latest changes](https://digital-strategy.ec.europa.eu/en/policies/latest-changes-accessibility-standard)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Using ARIA — the Rules of ARIA use (W3C)](https://www.w3.org/TR/using-aria/)
- [ARIA Authoring Practices Guide — Read Me First (W3C WAI)](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
