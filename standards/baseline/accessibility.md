# Baseline — Accessibility (mandatory, all projects)

> **Tier: BASELINE — applies to every managed project, no selection, no opt-out.**
> **Status: framing fixed; detailed content to be authored by fvermaut.**

## Why this is baseline

The **European Accessibility Act** (Directive (EU) 2019/882) applies since **2025-06-28** to a broad range of products and services (e-commerce, banking, transport, communication services, …). For client work in the EU this is a legal requirement, not a preference. Working technical baseline: **EN 301 549**, which references **WCAG 2.1 level AA**.

## Enforcement points in the process

- **Requirements (stage 3):** PRDs covering user-facing functionality include accessibility acceptance criteria (PRD-01.R20).
- **Verification (stage 7):** browser-channel checks include accessibility checks — automated scan where tooling exists, HUMAN-CHECK script otherwise.
- **Delivery review (stage 8):** the Standards axis covers this entry.
- **Tool-enforced part** (lives in tool config, not here): eslint accessibility plugin, automated axe scans in CI — set up at onboarding per stack.

## Guidelines

*(to author — what tooling cannot enforce: semantic structure choices, focus management patterns, form error conventions, contrast/typography decisions, testing-with-assistive-tech expectations, …)*
