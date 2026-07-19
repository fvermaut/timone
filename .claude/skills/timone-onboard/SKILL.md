---
name: timone-onboard
description: Stage 0 (Onboarding) of the Timone process — bring a new repo under management, once per project. Registers it in the manifest, clones it, drafts the product overview, and records founding stack ADRs. Use when the user says "onboard this project", "add a new project", "bring X under management", "register a new client repo", or names a repo/URL that isn't in timone.yaml yet.
argument-hint: <project-name> <repo-url>
---

# Timone Onboard — Onboarding (Stage 0)

Implements stage 0 of [the Timone process](../../../process.md). That spec is normative: if this skill and the spec ever disagree, the spec wins.

Stage 0 is cross-cutting and runs **once per project**, before any other stage skill can operate on it. Its artifact: a manifest entry, the project's doc tree, `doc/specs/product-overview.md` (including constraints), founding ADRs for stack choices, and `doc/standards.md`. The closing gate is a human confirming **both** the product overview and the standards.

This sub-phase covers the **greenfield path**: a project that does not yet exist in `timone.yaml` and is empty or near-empty on the remote. It ends after the founding ADRs are recorded — standards-artifact drafting and the existing-codebase path are covered further down (see the section boundary near the end of this file).

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
  [--preview docker]
```

Then clone it:

```
node dist/cli.js workspace sync
```

**Error handling:**

- `projects add` exits 1 on invalid input (e.g. the name already exists, a malformed stack entry, an empty repo URL). Surface the CLI's error message verbatim to the user and **stop** — do not attempt to patch `timone.yaml` by hand to work around it, and do not retry with guessed variations. Let the user correct the input and re-run.
- `workspace sync` exits 1 if any project fails to sync (e.g. the repo URL is unreachable or invalid — reported as `failed (<git's error line>)`). If `<name>`'s entry fails, surface that line to the user and stop; the manifest entry now exists but the checkout doesn't, so don't proceed to the doc tree or product overview until it's resolved (the user may need to fix the URL and re-run `projects add`/`workspace sync`, or fix access/credentials).

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

**Present the full draft to the user and do not save the file until they confirm or correct it.** This is a blocking step: no file write happens until explicit confirmation. If the user requests changes, revise and re-present before saving. This mirrors `timone-prd`'s "lazy product overview, confirm before saving" pattern, but here it is not lazy — onboarding is precisely the stage responsible for producing it.

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

## — End of greenfield-path content (sub-phase 04b) —

> **For 04c:** insert the standards-artifact step (drafting `projects/<name>/doc/standards.md` — baseline + selected stack entries + any deviations) and the existing-codebase path (observing conventions from code instead of imposing them, flagging conflicts with preferred standards for an explicit decision) here, before the closing handoff below. Both still gate on human confirmation per the stage-0 closing gate ("human confirms the overview **and** the standards").

## Closing (interim — until 04c adds the standards gate)

At the end of this sub-phase's scope: the manifest entry exists, the project is cloned, the doc tree is ready, the product overview is confirmed and saved, and the founding ADRs are recorded. Report to the user:

- The manifest entry and confirmed local path.
- The product overview file path.
- Each founding ADR's file path and number (or the one-line "no ADR" note where the gate failed).
- That the next step is the standards artifact (`doc/standards.md`) — not yet implemented by this skill — after which the project is ready for its first real work (stage 1, `timone-triage`, on an incoming request).
