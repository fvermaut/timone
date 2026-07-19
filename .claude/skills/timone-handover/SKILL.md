---
name: timone-handover
description: "Cross-cutting utility (not a lifecycle stage) — capture the full state of an in-progress session so a fresh session or a different agent can resume without re-deriving context from the conversation. Use when the user says 'make a handover', 'write a handover', 'I want to continue this in another session', 'summarize where we are for next time', or ends a session with unfinished work. Two scopes: meta (Timone itself) or a named managed project."
argument-hint: '[project-name] — omit for a meta (Timone-level) handover'
---

# Timone Handover

Implements the Handover utility of [the Timone process](../../../process.md) ("Cross-cutting utilities"). That spec is normative: if this skill and the spec disagree, the spec wins.

Handover is not one of the twelve lifecycle stages — it doesn't belong to a single PRD or phase. It exists because sessions end mid-work, and the person or agent picking it back up shouldn't have to re-read the whole conversation to know what's true right now.

## Scope

- **No argument (or a Timone-level topic named):** a **meta** handover — the state of Timone itself: which phases/PRDs are done, in flight, or queued. Written to `doc/handover/` at the timone root.
- **A project name given:** a **project** handover — the state of one piece of work on a managed project (a ticket, a feature, an in-progress phase). Written to `projects/<name>/doc/handover/`. Validate the name against `timone.yaml` first, same as every other stage skill; abort with the valid-names list if unknown.

Only one scope per invocation. If the session touched both Timone itself and a managed project, ask which handover to write — or write both, as two separate files, if the user wants both.

## What makes a handover good

A handover is a **pointer document**, not a summary of everything said. Content a fresh reader needs, nothing else:

1. **Snapshot** — one paragraph: where things stand right now, in plain terms.
2. **Done** — what was completed this session, each item a one-line pointer to its artifact (a phase completion report, a merged PR, an approved PRD) — not a restatement of what the artifact contains. Link, don't paraphrase.
3. **In flight / blocked** — work that's started but not finished, and why it's paused (waiting on a human decision, a dry-run gate, an external dependency). Name the exact file or PR if one exists in a partial state.
4. **Decisions made this session** — a bullet list of anything that would surprise the next reader if they didn't know it happened: ADRs written (link them), PRD revisions, scope changes, corrections the user gave that changed how work should proceed. Do not re-explain a decision whose ADR already explains it — just link it.
5. **Exact next action** — not "continue working on X" but the literal next step: which skill to invoke, with what arguments, or which question is still open and who needs to answer it.
6. **Open questions** — anything genuinely unresolved, each with who/what would resolve it.

Keep it short. A handover that takes longer to read than re-deriving the context from the artifacts directly has failed at its job — most of its value is in the pointers, not the prose.

## Workflow

1. Determine scope (see above). Resolve the target path: `doc/handover/` or `projects/<name>/doc/handover/`.
2. Check for an existing handover file in that directory. If one exists, skim it — the new handover only needs to cover what changed *since* that file, not repeat it. Reference the prior handover by path if useful context predates this session.
3. Draft the six sections above from the current session's actual state — read the artifacts you're pointing to (recent commits, phase reports, PRD statuses) rather than relying purely on conversational memory, so links and statuses are accurate as of now, not as of when they were last mentioned.
4. Write the file as `<scope-dir>/YYYY-MM-DD-<slug>.md` (date from the conversation's current date; slug is a short kebab-case label for the session's main thread of work). **Never overwrite or delete a prior handover** — each session's handover is its own dated file; the newest one is the current one by construction.
5. Confirm the file with the user before considering the handover done — a handover that misrepresents state is worse than none, so a quick human check is worth it even though this isn't a MUST-priority gate.

## Template

```markdown
# Handover — <scope: Timone | project-name> — <date>

> Prior handover: <link, or "none">

## Snapshot

<one paragraph>

## Done this session

- <one line + artifact link>
- ...

## In flight / blocked

- <what, why paused, exact file/PR if applicable>

## Decisions made this session

- <decision — link its ADR/PRD revision if one exists>

## Exact next action

<the literal next step — skill + arguments, or the specific open question and who answers it>

## Open questions

- <question — who/what resolves it>
```
