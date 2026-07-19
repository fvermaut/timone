---
name: timone-triage
description: Stage 1 (Triage) of the Timone process — classify an incoming request on a managed project as feature / bug / chore / question, record the classification, and route it to the right process entry point without starting it. Use when a new request, ticket, or idea arrives and it's not yet decided which stage handles it, or when the user says "triage this", "classify this request", or "where does this go".
argument-hint: <project-name> <request text | GitHub issue ref>
---

# Timone Stage 1 — Triage

You are the front door of the pipeline: every incoming request enters here. You classify it, record the classification **on the request**, and name the next stage — you never start that stage yourself. The process spec (`process.md`, stage 1) is normative; when this skill and the spec disagree, the spec wins.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Input

The request is either **free-form text** (from the argument or prompt) or a **GitHub issue reference** (an issue number or URL). When given an issue ref, first check the same guard as the recording path — the project's `repo_url` in `timone.yaml` is GitHub-hosted (matches `github.com`). Only then fetch its title and body with `gh issue view` (run from `projects/<name>/`) — that text is the request. Non-GitHub `repo_url` → never run `gh`; use whatever request text accompanied the ref (none at all → ask for it). Ambiguous input (can't tell what is being asked at all) → ask one clarifying question; do not guess a classification from noise.

## Classify

Exactly one kind, with a **one-paragraph rationale** stating why this kind and not the nearest alternative:

| Kind | It is… |
|---|---|
| **feature** | new or changed user-visible behaviour, or a change to what the product should do |
| **bug** | observed behaviour diverging from documented/expected behaviour — including post-delivery observations on shipped work |
| **chore** | a technical enabler with no direct user-visible behaviour change (upgrade, refactor, tooling, infra) |
| **question** | a request for information; answering it fully resolves it |

When classifying, read what exists: the project's `doc/specs/`, `doc/adr/`, recent `doc/plans/phases/` — a "bug" against never-specified behaviour may actually be a feature; a "feature" that restores documented behaviour is a bug.

## Route

The entry point follows the stage-1 routing table — restated here, no variants:

| Kind | Entry point |
|---|---|
| feature | **`timone-grill`** (stage 2) — or **`timone-prd`** (stage 3) directly, *only* when the requirements are already unambiguous; skipping grill must be justified in the rationale |
| bug / post-delivery observation | **`timone-improve`** (stage 9) |
| chore / technical enabler | **`timone-plan`** (stage 5), un-anchored — the phase gets stamped un-anchored per the PRD-anchoring rule, with human agreement at planning time |
| question | no pipeline entry — **answer it now**, from the project's artifacts (`doc/standards.md`, ADRs, specs, code) rather than from memory |

Name the entry-point skill even if it is not implemented yet (`timone-plan`, `timone-improve`): the record describes the process, not what currently exists.

## Record the classification

The record carries: date, the request (verbatim), kind, entry point, rationale. Two paths — the choice is not yours to invent, it follows the spec:

**GitHub path** — only when **both** hold: an issue ref was given, **and** the project's `repo_url` in `timone.yaml` is GitHub-hosted (matches `github.com`). Then, from within `projects/<name>/`:

1. `gh issue comment <n> --body "…"` — the comment carries kind, entry point, and rationale.
2. `gh label create "triage:<kind>" …` if the label doesn't exist yet, then `gh issue edit <n> --add-label "triage:<kind>"`.

**Doc-record path** — everything else (free-form request, or an issue ref against a non-GitHub remote):

1. Allocate the number: list `projects/<name>/doc/triage/`, take the highest `NNN`, use the next, zero-padded to three digits; missing directory → create it, start at `001`. Numbers are never reused.
2. Write `projects/<name>/doc/triage/NNN-<slug>.md`:

```markdown
# Triage NNN: <request in a few words>

- **Date:** YYYY-MM-DD
- **Kind:** feature | bug | chore | question
- **Entry point:** timone-<skill> (stage N) | none — answered
- **Source:** free-form request | issue #N (fell back: `repo_url` not GitHub-hosted)

## Request

<the request, verbatim>

## Rationale

<the one-paragraph rationale>
```

3. Commit it in the target project (`docs: triage NNN — <kind>`). This record is a process artifact under `doc/` — the only kind of file this skill may cause to be committed; never touch anything outside `doc/…` in the client repo.

**The fallback is loud, never silent:** if an issue ref was given but the repo is not GitHub-hosted, say so explicitly ("issue ref given, but `repo_url` is not GitHub — recording under `doc/triage/` instead") and use the doc-record path.

## Closing

Report to the user, in this order:

1. The classification: kind + one-paragraph rationale.
2. Where it was recorded (issue comment + label, or the committed `doc/triage/` path).
3. The routing outcome: the exact next invocation (e.g. "next: `/timone-grill <project> <request>`") — or, for a question, the answer itself.

Triage routes; it never starts the next stage. Stop here.
