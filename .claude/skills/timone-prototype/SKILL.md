---
name: timone-prototype
description: Cross-cutting utility (not a lifecycle stage) — build a cheap, throwaway prototype on a managed project for the human to react to instead of reading a document; it lives on a prototype/NN-<slug> branch served at a preview URL, is never merged, and is deleted once the reaction is recorded. Use when a timone-wayfind prototype ticket needs resolving, when timone-prd offers prototype-assisted approval, or when the user says "prototype this", "mock this up", or "show me something I can click".
argument-hint: <project-name> <the question the prototype must answer>
---

# Timone Prototype — Throwaway Reaction Surfaces

Implements the prototype convention of [ADR-0011](../../../doc/adr/0011-prototype-convention.md); [the process spec](../../../process.md) is normative. Invoked by `timone-wayfind` (resolving a `prototype` ticket) and `timone-prd` (prototype-assisted approval), or directly.

A prototype exists to be **reacted to, not read — and never to be kept.** The human's reaction is the artifact; the code never is.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## The question comes first

Every prototype answers **one stated question** — "how should this screen look", "does this flow feel right", "which of these two shapes". No question, no prototype: if the caller can't state one, send it back to grilling. The question fixes the fidelity (below) and names the place the reaction will be recorded — the wayfind ticket, or the requirement list under stage-3 approval.

## Lifecycle

1. **Branch.** `prototype/NN-<slug>`, cut from the project's default branch; `NN` is the next number not in use among existing local and remote `prototype/` branches. Refuse a dirty working tree, as stage 6 does.
2. **Build — the cheapest artifact that answers the question.** A static page with hardcoded fake data is the default; stubbed real-stack code only when the question genuinely demands real behaviour (navigation, interaction feel). Sized to **one session**. No tests, no standards conformance, no polish beyond what the question needs — this code ships to nobody, and its only quality bar is answering the question. Commit freely on the branch; commit messages are unconstrained here.
3. **Serve.** Stand it up at a **preview URL** via the project's Docker preview bindings ([ADR-0005](../../../doc/adr/0005-docker-previews-on-own-host.md)) — the human must be able to *click it*; a screenshot is not a prototype. If the preview machinery cannot serve it, say so loudly and fall back to precise local-run instructions — never silently to static images.
4. **React (HITL).** Walk the human through it against the question — never answer their side yourself. Capture the reaction where the question lives: verbatim in the wayfind ticket's resolution comment, or as edits to the requirement list under approval (with divergences surfaced per `timone-prd`).
5. **Die.** Delete the branch (local and remote) once the effort it served closes — the ticket resolved, or the PRD approved. Deletion is part of this skill's job, not housekeeping left to someone else.

## The fences

- **Never merged. Never the base of a work branch.** Delivery refuses a prototype branch; execution may not start from one; nothing is cherry-picked from it into implementation — stage 6 starts from the approved plan, always.
- **Exempt from the accessibility baseline, waiving nothing.** The prototype itself needn't conform (it ships to nobody), but an approved inaccessible prototype changes no requirement: the PRD's accessibility criteria stand regardless of what the mock did.
- **Writes nothing outside its branch.** No `doc/` artifacts, no files on the default branch; the reaction lands on the ticket or in the requirement list. `STATUS.md` is the calling stage's obligation, not this utility's.
