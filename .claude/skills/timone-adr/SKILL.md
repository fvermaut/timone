---
name: timone-adr
description: Stage 4 (Architecture) of the Timone process — record a significant technical decision as an ADR in a managed project, or explicitly decline when the decision doesn't pass the significance gate. Use when a decision was just made during grilling, planning, or execution, or when the user says "record an ADR", "document this decision", "write an architecture decision record", or "supersede ADR-NNNN".
argument-hint: <project-name> <decision to record>
---

# Timone Stage 4 — Architecture (ADR)

You record one architectural decision as an ADR under a managed project — or you decide, explicitly, that no ADR is warranted. The process spec (`process.md`, stage 4) is normative; when this skill and the spec disagree, the spec wins.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Standalone at decision time

An ADR is written **the moment the decision is made** — in a grill session, during planning, or mid-execution. It is a standalone artifact, never a scheduled task: "write ADR for X" must not appear as plan work in any phase file. If you are invoked from another stage (grilling, planning, execution), record the ADR now and return to that stage; if planning surfaces a significant undocumented decision, the plan waits until the ADR exists.

## The significance gate (three parts, all required)

Before writing anything, test the decision against all three parts:

1. **Hard to reverse** — undoing it later would cost real rework (migrations, rewrites, contract changes), not a quick edit.
2. **Surprising without context** — a competent newcomer reading the code would ask "why on earth is it done this way?" without the record.
3. **The result of a real trade-off** — genuine alternatives were on the table and something was given up; not the only sane option.

**If any part fails, the outcome is: no ADR.** Tell the user in one line which part failed and why — e.g. "No ADR: easily reversible (it's a config flag), doesn't pass the significance gate." — and stop. Declining is a valid, complete outcome of this skill; do not write a "minor decision" note anywhere as a substitute.

## Numbering

- ADRs live at `projects/<name>/doc/adr/NNNN-<slug>.md`.
- List the existing files, take the highest `NNNN`, and use the next number, zero-padded to four digits (`0001`, `0002`, …). Empty directory → `0001`.
- Numbers are **never reused**, even if an ADR was deleted or superseded. Never renumber existing ADRs.

## Format

One decision per file. Match the format of Timone's own reference ADRs (`doc/adr/0006-specs-in-repo-single-source-of-truth.md`, `doc/adr/0007-sessions-at-timone-root.md`):

```markdown
# ADR-NNNN: <decision stated as a full sentence>

- **Status:** accepted
- **Date:** YYYY-MM-DD
- **Source:** <optional: grill session / phase / ticket that triggered the decision>

## Context

<The forces at play, and — mandatory — the genuine alternatives that were
considered. A Context that names no alternatives is incomplete: the trade-off
part of the gate guarantees they exist, so state them and why they lost.>

## Decision

<What was decided, in the active voice. Bold the load-bearing choice.>

## Consequences

<What follows — good, bad, and deferred. Bullet list. Include the costs
accepted, not only the benefits.>
```

- Status lifecycle: `accepted` → optionally `superseded by ADR-NNNN`. New ADRs are written `accepted` (the decision has already been made by the time this skill runs; the closing gate is that status).
- Keep it short: an ADR is a record, not a design document.

## Superseding an existing ADR

When a new decision replaces an old one:

1. Create a **new** ADR (next number) recording the new decision. Its Context must reference the old ADR and say what changed.
2. Flip the old ADR's status line to `superseded by [ADR-NNNN](NNNN-<slug>.md)` — a cross-link to the new one.
3. Change **nothing else** in the old ADR. History is never edited: Context, Decision, and Consequences stay exactly as written, even where now wrong.

Never delete a superseded ADR and never rewrite it in place.


## Commit provenance

Every commit you cause to be made in a managed project carries the trailer
([ADR-0019](../../../doc/adr/0019-timone-authored-commits-carry-a-provenance-trailer.md)),
below any `Co-Authored-By:` line:

```
Timone-Stage: <this stage>
Timone-Run: <project>#<ticket>     # only when a ticket drove this session
Timone-Session: <the id you were given at the start of this session>
```

It is what makes machine-authored work identifiable from git history alone. An
automatic check at the end of every session reports any commit that omits it,
so leaving it off costs a correction rather than passing quietly.

## Closing

- Report the created file path and ADR number to the user (or the "no ADR" one-liner).
- Do not commit unless the invoking stage or the user asks; ADRs are process artifacts under `doc/` and are the only kind of file this skill may cause to be committed in the target project.
