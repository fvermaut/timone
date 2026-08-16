---
name: timone-onboard
description: Stage 0 (Onboarding) of the Timone process — bring a new repo under management, once per project. Registers it in the manifest, clones it, drafts the product overview, and records founding stack ADRs. Use when the user says "onboard this project", "add a new project", "bring X under management", "register a new client repo", or names a repo/URL that isn't in timone.yaml yet.
argument-hint: <project-name> <repo-url>
---

# Timone Onboard — Onboarding (Stage 0)

Implements stage 0 of [the Timone process](../../../process.md). That spec is normative: if this skill and the spec ever disagree, the spec wins.

**Everything you put in front of the human follows [Writing to the human](../../../process.md#writing-to-the-human).** Short sentences, plain words, no process vocabulary — no stage numbers, no skill names, nothing a reader would need `process.md` to understand. A ticket comment is a few sentences and under 150 words. Specifications, requirements and technical detail are **links** to committed artifacts, never text on a ticket. Every message ends with a call to action, and "no action needed" is one.

Stage 0 is cross-cutting and runs **once per project**, before any other stage skill can operate on it. Its artifact: a manifest entry, the project's doc tree, `doc/specs/product-overview.md` (including constraints), founding ADRs for stack choices, and `doc/standards.md`. The closing gate is a human confirming **both** the product overview and the standards.

This skill covers the full onboarding flow for a project that does not yet exist in `timone.yaml`: target intake, the stack + constraints checklist, register + clone, existing-codebase detection, the doc tree, the product overview, the founding ADRs, and the standards artifact — greenfield and existing-codebase repos both, ending on the combined confirmation gate described in "Standards artifact" below.

**Never `cd` into `projects/<name>`, at any step.** Every command and file path in this skill — including inspecting `package.json`, `.eslintrc*`, or the existing `src/` layout during existing-codebase detection — is written relative to the timone repo root, exactly like every other stage skill (see `.claude/skills/README.md`). Reading a file inside the target project does not require changing directory into it (`cat projects/<name>/package.json` works from the root). If your working directory ever drifts from the timone root, every subsequent `projects/<name>/...` path silently double-nests instead of failing loudly — confirm `pwd` matches the timone root before running `mkdir -p` for the doc tree, and after any tool call that might have changed it.

---

## Target intake (this skill's own preamble — not the standard one)

Every other stage skill starts by resolving a target project **already present** in `timone.yaml`. This skill is the one that puts it there, so that preamble doesn't apply verbatim: there is no existing entry to validate against yet. Instead:

1. **Repo URL** — take it from the invocation argument, or ask for it.
2. **Project name** — take it from the invocation argument, or ask for it. This becomes the manifest key and the directory name.
3. **Confirm the local path** explicitly with the user: `projects/<name>`. This is fixed by convention (ADR-0007) — do not offer alternatives.
4. **Check for collisions before doing anything else:**
   - Read `timone.yaml` (if it exists) and check `<name>` isn't already a key. If it is, stop and tell the user — suggest either a different name or, if they mean to re-onboard, that this skill is for new projects only.
   - Check `projects/<name>/` doesn't already exist on disk. If it does, stop and ask the user to resolve the conflict (wrong name picked, stale leftover directory, etc.) before continuing.

Do not proceed to intake until name, repo URL, and path are confirmed.

---

## Stack + constraints intake (short, fixed checklist)

This is **not** a `timone-grill` interview — no relentless branching, no decision tree. Ask a fixed, short checklist, one question at a time, each with a sensible default the user can accept or override:

1. **Tech stack** — the technologies this project will use (language, framework, database, auth, hosting/runtime). This drives both the `--stack` tag list for the manifest and the founding ADRs below.
2. **Client / project constraints** — anything external that shapes decisions: client policies, hosting target, compliance requirements beyond accessibility, data residency, or similar. State explicitly to the user: **accessibility (EAA / WCAG 2.1 AA) is always in scope regardless of the answer here** — the baseline standards tier has no opt-out (see `process.md`, "The standards library"). This question is only about *additional* constraints on top of that baseline.
3. **Budget / timeline constraints**, if relevant to how the project should be built (e.g. "must ship an MVP in 6 weeks," "fixed-price, minimize infra cost"). Skip if the user has nothing to add.
4. **Ticketing and preview bindings** — confirm `--ticketing github` (currently the only supported backend) and ask whether a Docker preview environment applies (`--preview docker`) or should be omitted for now.
5. **Introducing itself on unmarked tickets** — ask whether the daemon may post one hello comment on this repository's open tickets that carry no `timone` label ([ADR-0024](../../../doc/adr/0024-every-open-ticket-answers-for-itself.md)). **Default to no, and say why**: on a repository with an existing backlog, every open issue receives that comment in the first poll cycle, and meeting a machine on two hundred tickets at once is a worse first impression than silence. Yes is the right answer for a greenfield or near-empty repository, where it is what stops a ticket nobody labelled from sitting silent with nothing on it explaining why. **This is the moment to get it right** — it is the first thing Timone says in a repository nobody invited it into, and no later stage revisits the question. Count the open issues before recommending either way (`gh issue list --repo <slug> --state open --limit 200 | wc -l`) rather than guessing.

Keep this brief. Depth on requirements belongs to `timone-grill`/`timone-prd` later, not here.

---

## Register + clone

Once the checklist above is answered, register the project through the CLI — **never** by hand-editing `timone.yaml` (ADR-0008: manifest mutation goes exclusively through the CLI, which validates against the same zod schema `loadManifest` uses):

```
node dist/cli.js projects add <name> \
  --repo <repo-url> \
  --path projects/<name> \
  --stack <comma-separated-stack-list> \
  --ticketing github \
  [--preview docker] \
  [--introduce-unmarked | --no-introduce-unmarked]
```

**Pass the answer to checklist item 5, whichever way it went.** `--introduce-unmarked` for yes, `--no-introduce-unmarked` for no; passing neither is also no, and the three are not the same thing to a later reader — the negative flag records that a human was asked and declined, while an absent key records only that the project predates the question. **Prefer the explicit flag over silence**, so the manifest says a decision was taken. The same pair exists on `projects update` if the answer changes later; that is the only supported way to change it, and `timone.yaml` is still never hand-edited (ADR-0008).

Then clone it:

```
node dist/cli.js workspace sync
```

**Error handling:**

- `projects add` exits 1 on invalid input (e.g. the name already exists, a malformed stack entry, an empty repo URL). Surface the CLI's error message verbatim to the user and **stop** — do not attempt to patch `timone.yaml` by hand to work around it, and do not retry with guessed variations. Let the user correct the input and re-run.
- `workspace sync` exits 1 if any project fails to sync (e.g. the repo URL is unreachable or invalid — reported as `failed (<git's error line>)`). If `<name>`'s entry fails, surface that line to the user and stop; the manifest entry now exists but the checkout doesn't, so don't proceed to the doc tree or product overview until it's resolved (the user may need to fix the URL and re-run `projects add`/`workspace sync`, or fix access/credentials).

---

## Existing-codebase detection

Before creating the doc tree, determine whether `projects/<name>` is **greenfield** (empty or near-empty — the default assumption the rest of this skill makes) or already carries **substantial code**. Check for common markers:

- An existing `package.json` (or equivalent manifest) that already declares dependencies, not just a bare scaffold.
- An existing `src/` (or equivalent) directory containing actual source files, not placeholders.
- Existing lint/format/test config: `.eslintrc*`, `.prettierrc*`, `biome.json`, `vitest.config.*`, `jest.config.*`, or similar.

Two or more of these present → treat it as an **existing codebase**. None present → **greenfield**; continue as the rest of this skill otherwise assumes. If the signal is ambiguous (e.g. exactly one marker present, or the markers disagree with each other), **ask the user to confirm** which path applies rather than guessing.

This determination doesn't change the doc tree, product overview, or founding-ADR steps below — it changes how `doc/standards.md` gets drafted later in this skill (see "Existing-codebase conventions" under "Standards artifact").

---

## Doc tree

Ensure the project's artifact paths exist, per the process spec's conventions section:

```
projects/<name>/doc/specs/
projects/<name>/doc/specs/prd/
projects/<name>/doc/adr/
projects/<name>/doc/plans/phases/
```

Create them with `mkdir -p`. **Choice made here:** no `.gitkeep` placeholders. `doc/specs/` and `doc/adr/` get real, git-tracked content in this same skill run (`product-overview.md` and the founding ADRs below), so they don't need one. `doc/specs/prd/` and `doc/plans/phases/` legitimately stay empty until stage 3 (`timone-prd`) and stage 5 (`timone-plan`) write into them — git simply won't track those empty directories in the meantime, and that's fine; they get created here so the paths are ready to receive files, not to force an early git presence.

---

## Product overview

Draft `projects/<name>/doc/specs/product-overview.md` as a **one-page** document, following the shape used by Timone's own `doc/specs/product-overview.md` and the process spec's conventions:

```markdown
# <Project Name> — Product Overview

> **Status:** Draft — pending confirmation
> **Source:** Onboarding conversation, <date>

## Problem statement

<What need does this project address? Who has the problem today?>

## Target users

<Who uses this — personas, roles, or a single stated user.>

## Business goals

<What outcomes make this project successful, in priority order if there's more than one.>

## Success definition

<How "done" or "working" will be recognized — milestones if there's more than one.>

## Non-goals

<Explicit exclusions — what this project deliberately will not do, at least for now.>

## Constraints

<Client policies, hosting target, compliance requirements, budget/timeline constraints
gathered during intake. Always state accessibility explicitly: "EAA / WCAG 2.1 AA
baseline applies unconditionally — see standards/baseline/accessibility.md" — this line
is never omitted, even if the user raised no other compliance constraints.>
```

Populate it from the target intake and the stack + constraints checklist — do not invent content the user hasn't stated.

**Hold this draft — do not save it yet.** It is presented for confirmation together with `doc/standards.md`, drafted next: one combined confirmation gate covers both artifacts (the stage-0 closing gate is "human confirms the overview **and** the standards" — one gate, not two separate prompts; see "Combined confirmation gate" under "Standards artifact", below). If the user requests changes to the overview at that combined presentation, revise it and re-present both drafts together before saving either. This mirrors `timone-prd`'s "lazy product overview, confirm before saving" pattern, but here it is not lazy — onboarding is precisely the stage responsible for producing it.

---

## Founding ADRs

For each stack choice from the intake checklist, apply the **same three-part significance test `timone-adr` uses** — all three required, or no ADR:

1. **Hard to reverse** — undoing it later costs real rework (migrations, rewrites, contract changes).
2. **Surprising without context** — a competent newcomer reading the code would ask "why on earth is it done this way?" without the record.
3. **The result of a real trade-off** — genuine alternatives were on the table and something was given up.

Not every stack tag warrants an ADR (e.g. "uses npm" rarely does); a database choice, an auth strategy, a hosting/runtime choice, or a framework pick usually does. Judge each one individually — don't write an ADR per `--stack` entry mechanically.

For each choice that passes the gate, write `projects/<name>/doc/adr/NNNN-<slug>.md`, numbered from `0001` (this is a fresh project — the directory is empty), in the **exact same format `timone-adr` uses**:

```markdown
# ADR-NNNN: <decision stated as a full sentence>

- **Status:** accepted
- **Date:** YYYY-MM-DD
- **Source:** Onboarding conversation

## Context

<The forces at play, and — mandatory — the genuine alternatives that were
considered. Name them and say why they lost. A Context that names no
alternatives is incomplete.>

## Decision

<What was decided, in the active voice. Bold the load-bearing choice.>

## Consequences

<What follows — good, bad, and deferred. Bullet list. Include the costs
accepted, not only the benefits.>
```

Rules, identical to `timone-adr`:

- One decision per file. Number sequentially, zero-padded to four digits, never reused.
- Status is `accepted` (the choice was just made during intake).
- Keep each ADR short — a record, not a design document.
- If a stack choice fails the significance gate, say so in one line ("No ADR for `<choice>`: not hard to reverse, doesn't pass the gate") and move on — don't write a "minor decision" note as a substitute.

---

## Standards artifact

Draft `projects/<name>/doc/standards.md` next, after the founding ADRs and before either it or the product overview is saved.

### Baseline (unconditional)

Every project's `doc/standards.md` includes both entries from `standards/README.md`'s **Baseline** table — currently `baseline/accessibility.md` and `baseline/ui-ux.md` — **unconditionally**. There is no selection step and no opt-out for the baseline, regardless of stack. State this plainly in the drafted file; do not gate it behind any checklist answer or stack choice.

### Stack entries (selected)

Match the project's chosen stack (from the "Stack + constraints intake" checklist above) against the **Scope** column of `standards/README.md`'s **Stack entries** table, and select every entry whose scope the stack touches — e.g. stack includes "Next.js" → select `nextjs.md`; includes "Prisma" or "PostgreSQL" → select `prisma-postgresql.md`; and so on across that table. Only entries marked `Approved` in the Status column are selectable (all entries in the table are `Approved` as of this writing, but a future non-`Approved` entry must not be selected). Do not restate any entry's content in `doc/standards.md` — the project artifact references the central file, it never copies it, per the library's no-duplication discipline (`process.md`, "The standards library").

### Existing-codebase conventions

If the "Existing-codebase detection" step above determined this is an **existing codebase**, run this scan before drafting the file:

- **Linter/formatter config** — read whatever `.eslintrc*`, `.prettierrc*`, `biome.json`, etc. already exist.
- **Folder structure** — inspect the existing layout: does it already resemble the bulletproof-react feature-folder shape `project-structure.md` recommends, or something else (layered, ad hoc, a different framework's convention)?
- **Test setup** — existing `vitest.config.*` / `jest.config.*` and any existing test files.

Record what is actually there under `## Deviations`, **as observed** — never silently normalized to match the library defaults, even where the library's recommendation would arguably be better.

**Where an observed convention conflicts with a central-library entry's recommendation — e.g. the existing folder structure doesn't match `project-structure.md`, or an existing eslint config contradicts a Tooling recommendation in some entry — the skill must explicitly flag the conflict and ask the user which wins. It must never silently pick one side.** This is PRD-01.R15's literal second criterion: conventions observed in the code are recorded as-is, and conflicts with the preferred standards are flagged for explicit decision, not silently overridden. Record the user's resolution (keep the observed convention, adopt the library's, or an explicit middle ground) under `## Deviations`, next to the observed fact it resolves.

### Template

```markdown
# <Project Name> — Standards

> **Status:** Draft — pending confirmation
> **Source:** Onboarding conversation, <date>

## Baseline (mandatory, no opt-out)

- [Accessibility](../../../standards/baseline/accessibility.md) — EAA / EN 301 549 / WCAG 2.1 AA
- [UI/UX](../../../standards/baseline/ui-ux.md) — cross-project UI/UX invariants

## Stack entries

<One bullet per selected entry, linking back to the central file, e.g.:>
- [Next.js](../../../standards/nextjs.md)
- [Project structure](../../../standards/project-structure.md)
- <...>

## Deviations

<Empty for a greenfield project. For an existing codebase: one entry per observed
convention, stated as fact, plus the resolution of any conflict with a library
entry's recommendation and who/what decided it.>
```

Link paths are relative from `projects/<name>/doc/standards.md` back to the Timone repo root's `standards/` (three levels up: `doc` → `<name>` → `projects` → root) — referenced, never vendored, into the project.

### Combined confirmation gate

**Present the product-overview draft and the `doc/standards.md` draft to the user together, in the same message, as a single confirmation gate.** Do not save either file until the user confirms both (or approves them after requested edits) — this is the literal stage-0 closing gate: "human confirms the overview **and** the standards," one gate, not two sequential prompts. If the user asks to change only one of the two, revise it, re-present both drafts again (even the unchanged one), and wait for confirmation before saving either.

Once confirmed, save both files.

---

## Closing

A full onboarding run produces:

- A manifest entry (`timone.yaml`) and a clone at `projects/<name>`.
- The project's doc tree (`doc/specs/`, `doc/specs/prd/`, `doc/adr/`, `doc/plans/phases/`).
- A confirmed `doc/specs/product-overview.md`, including constraints.
- Founding ADRs for the stack choices that passed the significance gate (or one-line "no ADR" notes for those that didn't).
- A confirmed `doc/standards.md` — baseline entries (unconditional), selected stack entries, and recorded deviations (empty for a greenfield project; observed conventions and any flagged, user-resolved conflicts for an existing codebase).

Report to the user:

- The manifest entry and confirmed local path.
- **Whether this repository introduces itself on unmarked tickets** (checklist item 5), in one line, whichever way it went, and that it is now in the manifest. A decision the user took and nobody repeated back is a decision they will assume landed.
- The product overview file path.
- Each founding ADR's file path and number (or the one-line "no ADR" note where the gate failed).
- The standards artifact file path, its selected stack entries, and — for an existing codebase — any conflicts that were flagged and how the user resolved them.

With both the product overview and the standards confirmed and saved, the project is fully onboarded and ready for its first real work: stage 1 (`timone-triage`) on an incoming request, typically followed by stage 2 (`timone-grill`) and stage 3 (`timone-prd`) for its first feature.
