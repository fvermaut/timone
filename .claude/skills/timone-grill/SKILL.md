---
name: timone-grill
description: 'Stage 2 (Requirements discovery) of the Timone process: relentlessly interview the user about a topic or plan for a managed project until every branch of the decision tree is resolved, maintaining the project domain glossary along the way. Use when the user wants to stress-test a plan, explore requirements for a new feature, get grilled on a design, or says "grill me".'
argument-hint: <project-name> <topic/plan to grill>
---

# Timone Grill — Requirements Discovery (Stage 2)

Implements stage 2 of [the Timone process](../../../doc/process.md). That spec is normative: if this skill and the spec ever disagree, the spec wins.

The output of this stage is a **resolved decision tree** (in conversation) plus **inline glossary updates** in the target project's `CONTEXT.md`. The closing gate: all branches resolved and the summary accepted by the human.

## Target-project resolution (do this first)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file you read or write lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `doc/process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

## Prepare: explore before you ask

Before asking a single question, ground yourself in the target project:

- Read `projects/<name>/CONTEXT.md` if it exists — the domain glossary is the vocabulary of the interview.
- Read `projects/<name>/doc/specs/product-overview.md` for the why, users, goals, non-goals, and constraints.
- Skim existing PRDs (`doc/specs/prd/`), ADRs (`doc/adr/`), and any source code relevant to the topic being grilled.

**Anything answerable from the codebase is answered from the codebase, not asked.** Questions about current behaviour, existing schema, tech stack, or what the code does today are yours to resolve by reading; only questions about intent, priorities, trade-offs, and the future belong to the user.

## The interview

Interview the user relentlessly about every aspect of the topic until you reach shared understanding, walking down each branch of the decision tree and resolving dependencies between decisions one by one.

Discipline, per question:

- **One question at a time.** Never batch questions; wait for the answer before moving on.
- **Always give a recommended answer** or direction with each question, so the user can confirm cheaply or push back with substance.
- **State what the codebase told you** when it informs the question (and skip the question entirely when the code fully answers it).
- **Resolve dependent branches before opening new topics.** After each answer, decide whether it opens sub-questions or closes a branch; unresolved dependencies take priority over fresh ground.

## Domain glossary maintenance

Throughout the interview, maintain the project's domain glossary — `projects/<name>/CONTEXT.md`:

- **Challenge conflicts on the spot.** If the user uses a term in a way that conflicts with the existing glossary, raise it immediately and get it resolved — either the usage bends or the glossary is amended.
- **Sharpen fuzzy terms.** When a vague or overloaded term surfaces, pin down a canonical name and definition as part of the interview.
- **Write resolved terms down immediately** — during the interview, not at the end. Create `CONTEXT.md` lazily on the first term if it doesn't exist yet.
- **Glossary only.** `CONTEXT.md` holds the ubiquitous language: terms and their meanings. No implementation details, no decisions, no requirements — those belong to ADRs and PRDs.

`CONTEXT.md` is the only file this skill writes.

## Conclude and hand off

When all branches of the decision tree are resolved:

1. **Summarise the decisions reached** — the shared understanding, branch by branch.
2. **Highlight outstanding risks** and any questions deliberately left open.
3. **State concrete next steps.**
4. **Suggest running `timone-prd`** (stage 3) to persist the requirements as a PRD pair. The grill session's conclusions are raw material — they evaporate with the conversation unless persisted; the PRD is the artifact.

The stage closes only when the human accepts the summary.
