# Standards — shadcn/ui (UI component library)

> **Status: Draft — pending review (fvermaut).**
> Rules of this library: nothing tooling already enforces; nothing true of every project on Earth; only choices, patterns, and boundaries specific to how we use shadcn/ui.

shadcn/ui is the standard component layer on our Next.js/React/Tailwind stack. It is explicitly *"not a component library. It is how you build your component library"*: components are **copied into the repo** via a registry + CLI, not installed as a package. Visual invariants (tokens, contrast, focus styles) are governed by [baseline/ui-ux.md](baseline/ui-ux.md) and [baseline/accessibility.md](baseline/accessibility.md); this entry covers how we own, update, and compose the components.

## Ownership model

- **The copied code is ours.** No package update will ever touch `components/ui/`; upstream improvements arrive only when we deliberately re-run `add`. Edit components freely — that is the point of the model — but every non-cosmetic divergence from upstream gets a `// timone:` comment at the change site and a line in the project's `doc/standards.md`. Reason: `npx shadcn add <name>` **overwrites** the local file; unrecorded customizations are silently lost on refresh.
- **Install via CLI only, never hand-copy from the website.** `components.json` is what makes `add` place files and rewrite imports correctly; hand-copied code drifts from it immediately.
- **Update posture:** CLI 3.x has no `diff`/`update` command — refreshing a component means re-adding it and re-applying recorded divergences from the diff. Do this on-demand (a bug or a needed feature), not on a schedule; check the [changelog](https://ui.shadcn.com/docs/changelog) at review points. `migrate` codemods (`radix`, `icons`, `rtl`) are the exception: run them as published when they apply.

## Base primitives

- Since July 2026, **Base UI is the default base** for new projects; Radix and React Aria remain fully supported and components ship for both. New projects take the default; existing Radix projects don't migrate ("You do not need to migrate") unless a needed component is Base-UI-only — then migrate component-by-component, never big-bang.
- **One base per project.** The base is chosen at `init` (`-b radix|aria`) and recorded in `doc/standards.md`; mixing bases doubles bundle and behavior surface for nothing.

## Theming

- **CSS-variable tokens are the single theming surface** (`cssVariables: true`, immutable after init). The project's design system is expressed by overriding the semantic tokens (`--background`/`--foreground` pairs, `card`, `primary`, `muted`, `destructive`, `border`, `ring`, `chart-*`, `sidebar-*`) under `:root` and `.dark` — never by forking per-component classes or scattering palette utilities (`bg-zinc-100`) through feature code.
- New semantic needs get **new token pairs** (e.g. `--warning`/`--warning-foreground`) defined in `:root`/`.dark` and exposed via `@theme inline`, so light/dark stay one override away. Dark mode is only ever the `.dark` token block — no per-component `dark:` styling for themable colors.
- Token values must clear the contrast floors in [baseline/accessibility.md](baseline/accessibility.md) — that check happens once, at token definition, not per usage.

## Composition

- `components/ui/` holds **generic primitives only**: no feature logic, no data fetching, no app-specific props. Feature components live in `src/components/` (per [nextjs.md](nextjs.md) structure) and compose the primitives; needing app knowledge inside a `ui/` file means the abstraction is on the wrong side of the line.
- A recurring visual variant is added **in place** as a `cva` variant of the primitive — not a wrapper that re-styles via `className`, and not a forked copy. Forks orphan the component from upstream refreshes.
- **Don't import what an element does better.** A plain `<a>`/`next/link` beats `Button` for navigation; native `<select>` beats `Select` for short option lists (better mobile UX, zero JS); a `div` with token utilities beats `Card` for a box that isn't semantically a card; the `Form` + react-hook-form + zod stack is for real forms, not a lone search input. Each import is client-side behavior and bundle — spend it where the primitive's interactions are actually needed.

## Accessibility: free vs ours

The headless base gives, **per component instance**: roles/ARIA wiring, keyboard interaction patterns, focus trap/return for overlays. Still entirely ours (see [baseline/accessibility.md](baseline/accessibility.md)): everything **between** components — page/route-level focus management, heading structure, form labels and error association (`FormField` renders the wiring only if we provide label and messages), alt text, live-region announcements for async outcomes, and contrast of the token values we choose. A shadcn build passes no accessibility check by virtue of being a shadcn build.

## Tooling

Enforced by config, not prose: `components.json` (`style: "new-york"`, `rsc: true`, `tsx: true`, `cssVariables: true`, Tailwind v4 so `tailwind.config` stays blank, aliases matching the `src/` layout in [nextjs.md](nextjs.md)); `init`/`add`/`view`/`search` as the only installation path; the shadcn MCP server for agent sessions that browse/add registry items; `registries` entries in `components.json` if a private registry is ever introduced.

## Sources

- [Introduction](https://ui.shadcn.com/docs) — "not a component library", open-code distribution, composition, registry (verified current, 2026-07).
- [components.json](https://ui.shadcn.com/docs/components-json) — fields, immutability of `style`/`baseColor`/`cssVariables`, aliases, `registries`.
- [Theming](https://ui.shadcn.com/docs/theming) — CSS-variable tokens, background/foreground convention, custom tokens via `@theme inline`, `.dark` overrides.
- [shadcn CLI](https://ui.shadcn.com/docs/cli) — CLI 3.x command set (`init`, `add`, `view`, `search`, `migrate`, …; no diff/update command).
- [Changelog — Base UI as the Default (2026-07)](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) — Base UI default, Radix not deprecated, `-b` flag, no forced migration; [React Aria (2026-07)](https://ui.shadcn.com/docs/changelog/2026-07-react-aria) — React Aria as first-class base.
