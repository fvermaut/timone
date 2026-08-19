---
name: timone-prd
description: "Owns stage 3 (Requirements) of the Timone process for a managed project: converts any input (a timone-grill session, a BRD, meeting notes, a free-form description) into a persistent PRD pair — a stakeholder-readable narrative plus a formal acceptance-criteria register that drives planning and verification. Use when the user says 'write the PRD', 'create a PRD', 'persist the requirements', 'capture the what', 'turn this conversation into requirements', or after a timone-grill session concludes. Triggers on: 'create prd', 'write prd', 'to prd', 'capture requirements', 'persist requirements', 'requirements doc', 'acceptance criteria'."
argument-hint: '<project-name> then the input — a grill conversation, a BRD path, notes, or a free-form feature description'
---

# Timone PRD

Implement **stage 3 — Requirements** of [the Timone process](../../../process.md) for one managed project. The process spec is normative: when this skill and the spec disagree, the spec wins.

**Everything you put in front of the human follows [Writing to the human](../../../process.md#writing-to-the-human).** Short sentences, plain words, no process vocabulary — no stage numbers, no skill names, nothing a reader would need `process.md` to understand. A ticket comment is a few sentences and under 150 words. Specifications, requirements and technical detail are **links** to committed artifacts, never text on a ticket. Every message ends with a call to action, and "no action needed" is one.

The PRD pair is the **single source of truth** for what is being built (ADR-0006). Tickets scope work and point here; they never hold requirement detail.

Pipeline position: `timone-grill` → **`timone-prd`** → `timone-plan` → `timone-execute` → `timone-verify` → … and back here for amendments, which this skill owns since [ADR-0036](../../../doc/adr/0036-feedback-is-triage-with-the-documents-open.md) retired stage 9.

---

## Target-project resolution (required preamble)

1. The target project is the one named in the invocation argument or prompt.
2. If no project is named: read `timone.yaml`, list the project names, and **ask** the user to pick. Never guess.
3. Validate the name against `timone.yaml`. Unknown name → abort, listing the valid names.
4. Check `projects/<name>/` exists on disk. Not cloned → abort, suggesting `node dist/cli.js workspace sync`.
5. From here on, every file this skill reads or writes lives under `projects/<name>/…` — the only exceptions are *reading* timone's own `process.md`, `standards/`, and `timone.yaml`.
6. In loop mode (daemon-initiated sessions), the target project arrives in the event context; the same validation applies.

---

## Before Starting

### 1. Ensure the "why" layer exists (lazy, once per project)

Check for `projects/<name>/doc/specs/product-overview.md`. Onboarding (stage 0) normally created it; if it does **not** exist, draft it before writing any PRD:

1. Read the project's `README.md`, `CONTEXT.md`, and any existing business material under `projects/<name>/doc/`.
2. Write a **one-page** draft covering: problem statement, target users/personas, business goals, success definition, explicit non-goals, and constraints (client policies, hosting, compliance, budget).
3. **Present the draft to the user for confirmation/correction before saving.** This file is the anchor every PRD's goals link back to — do not invent content the user hasn't validated.

Keep `product-overview.md` short. It changes rarely; PRDs change often.

### 2. Determine the PRD number

List `projects/<name>/doc/specs/prd/`. Use the next available `NN` (zero-padded). PRD numbering is independent of phase numbering — one PRD may feed several phases.

### 3. Parse the input

The input may be: the current conversation (typically a concluded `timone-grill` session with its resolved decision tree), a BRD or design document (read it), meeting notes, or a free-form description. Extract:

- The problem/opportunity and how it links to `product-overview.md`
- The desired behaviours and outcomes (candidate requirements)
- Explicit exclusions and deferrals (non-goals)
- Open questions and unvalidated assumptions

Use the project's `CONTEXT.md` glossary terms — the canonical ubiquitous language — in all requirement wording. If required context is missing, ask the user — do not infer requirements that were never stated.

---

## The Two-File PRD

Every PRD is a pair in `projects/<name>/doc/specs/prd/`:

| File | Audience | Content |
| ---- | -------- | ------- |
| `prd-NN-<slug>.md` | Humans — shareable with stakeholders as-is | Narrative: problem, goals, scope, prose requirement summaries referencing IDs |
| `prd-NN-<slug>.criteria.md` | Agents — injected into planner and verifier contexts | Formal register: one block per requirement ID with priority, criteria, verification channel, status |

The **requirement ID** is the join key between the two files, and between the PRD and phase files. Keep the narrative file free of Given/When/Then machinery — it must read like a document you could email to a stakeholder untouched.

### Requirement ID rules

- Format: `PRD-NN.R<k>` (e.g. `PRD-04.R2`). Within the criteria file, blocks are headed `R<k>`.
- IDs are **stable forever**: never renumber, never reuse, never delete.
- A requirement whose intent changes keeps its ID, gets its criteria updated, `Status: revised`, and a dated `> ✏ Revised <date>: <reason>` marker (applied here — this skill owns the PRD, and has owned its amendments since [ADR-0036](../../../doc/adr/0036-feedback-is-triage-with-the-documents-open.md) retired stage 9).
- An obsolete requirement is marked `DEPRECATED` with a one-line reason — the block stays in the file.
- New needs always get the next unused `R<k>`.

---

## Narrative File Template — `prd-NN-<slug>.md`

```markdown
# PRD-NN: <Feature Title>

> **Status:** Draft | Active | Delivered | Superseded
> **Project:** <name> — see [product-overview.md](../product-overview.md)
> **Criteria register:** [prd-NN-<slug>.criteria.md](prd-NN-<slug>.criteria.md)
> **Phases:** <links to phase files as they are created, or "none yet">

## Problem

<2–3 paragraphs. What user or business need does this address? Quote the source
(grill session conclusion, BRD section, ticket, stakeholder feedback) where possible.>

## Goals

<What outcomes make this feature successful, tied to the product overview's goals.>

## Scope

### In scope

<Prose description of the capability. Reference requirement IDs inline, e.g.
"An analyst can recall a published snapshot (R1) and see the full recall
history (R3)." Every MUST requirement in the criteria file must be mentioned here.>

### Out of scope

<Explicit exclusions and deferrals — as important as the in-scope list.>

## Open Questions

<Unresolved items, each with an owner or a trigger for resolution. Remove or
resolve as the PRD matures.>
```

---

## Criteria File Template — `prd-NN-<slug>.criteria.md`

```markdown
# PRD-NN Acceptance Criteria — <Feature Title>

> Formal register for [prd-NN-<slug>.md](prd-NN-<slug>.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

## R1 — <short requirement title>

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN <precondition / seeded state>
      WHEN <action — API call, user interaction>
      THEN <observable outcome>
    - GIVEN … WHEN … THEN … <additional criteria as needed>
- **Verification hint:** <concrete pointer: endpoint + example payload, page
  path + element to observe, or DB query. Enough for a fresh agent with no
  build context to attempt verification.>

## R2 — <short requirement title>

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** human
- **Criteria:** <prose is acceptable for SHOULD/NICE — see strictness rules>
```

### Field rules

| Field | Values | Rules |
| ----- | ------ | ----- |
| Priority | `MUST` / `SHOULD` / `NICE` | `MUST` = the deliverable fails without it; drives automated verification and regression |
| Status | `draft` / `verified` / `failed` / `revised` / `deprecated` | `draft` on creation; `verified`/`failed` set by the `timone-verify` verifier; `revised`/`deprecated` set here, with the amendment |
| Verify-via | `api` / `browser` / `human` | `api` = checkable via HTTP/CLI/DB from a terminal (these also form the standing regression suite); `browser` = requires driving the UI; `human` = subjective (UX feel, visual quality) — both `browser` and `human` are reported as HUMAN-CHECK with a precise manual script until tooling covers them |

### Strictness rules

- **Every `MUST` requirement needs at least one Given/When/Then criterion and a verification hint.** If you cannot write one, the requirement is not yet testable — **ask the user** to sharpen it or downgrade it to `SHOULD`. Never emit a MUST without observable criteria.
- `SHOULD` and `NICE` requirements may use free-form prose criteria.
- Prefer `verify-via: api` wherever a behaviour is observable at the API/DB level, even if it also has a UI — the api channel is the cheap, automated one.
- Criteria describe **observable behaviour**, never implementation ("the endpoint returns the recalled snapshot with status 410", not "the recallSnapshot function sets the flag").

### Accessibility criteria (mandatory baseline — PRD-01.R20)

When **any requirement covers user-facing functionality**, the criteria register must include accessibility acceptance criteria derived from the mandatory baseline: timone's `standards/baseline/accessibility.md` (European Accessibility Act; working baseline EN 301 549 / WCAG 2.1 AA — no project may opt out).

- Read `standards/baseline/accessibility.md` before drafting criteria for user-facing requirements.
- Either attach accessibility criteria to the user-facing requirement's own block, or add a dedicated accessibility requirement (its own `R<k>`) covering the delivered UI — whichever reads more clearly.
- Prompt the user during the quiz step: point out which requirements are user-facing and confirm the accessibility criteria with them. Do not silently skip them, and do not let the user opt out — the baseline admits no exceptions.
- Typical shape: `verify-via: browser` (automated scan where tooling exists, HUMAN-CHECK script otherwise) with criteria on keyboard operability, semantic structure, focus management, form error handling, and contrast.

---

## Workflow

1. **Draft the requirement list first.** Before writing any file, present the user a numbered list: ID, title, priority, verify-via, one-line criterion summary. Include the proposed out-of-scope list, and flag which requirements are user-facing (and thus carry accessibility criteria).
2. **Offer prototype-assisted approval** when the work has a user-facing surface — optional, the human decides. If accepted, invoke `timone-prototype` ([ADR-0011](../../../doc/adr/0011-prototype-convention.md)) to build a cheap throwaway prototype of the proposed requirements and stand it up at a preview URL. Walk the user through it, mapping what they see to requirement IDs, and fold their reactions into the requirement list as edits. **The gate is unchanged** — approval lands on the requirement list, never on the prototype — and every divergence between what the prototype shows and what the list says (error paths, MUST/SHOULD priorities, non-UI requirements, accessibility criteria — the things a prototype under-specifies) is surfaced explicitly before approval is requested.
3. **Quiz the user:**
    - Are the MUST/SHOULD/NICE assignments right?
    - Is any MUST criterion untestable as written?
    - Is anything missing, or captured that was never agreed?
    - Is the out-of-scope list complete?
    - For user-facing requirements: are the proposed accessibility criteria right?
4. **Write the pair, then gate on it** ([ADR-0014](../../../doc/adr/0014-artifact-first-gates.md)). Write both files on the work branch with the narrative stamped `Draft`, commit and push them, and ask for approval **against the committed register** — not against a paraphrase of it in conversation. The register's precision is the whole reason it exists; summarising it for approval approves a different object from the one that gets kept (ADR-0006). Where the work is daemon-driven the approval arrives as a ticket reply (ADR-0012); in a hand-run session it is the conversation itself. **A change request re-enters this stage**, which rewrites the pair in place — renumbering requirement IDs freely, because until the gate closes nothing is ratified and IDs are not yet stable. On approval, flip the narrative to `Active`: that flip is the gate's written trace, and until it happens stage 5 will refuse to plan against the PRD.
5. **Hand off:** suggest running `timone-plan` with a pointer to the new PRD. If the PRD came from a grill session, note that in the narrative's Problem section as the source.

---

## Output Checklist

- [ ] `projects/<name>/doc/specs/product-overview.md` exists (drafted and user-confirmed if new)
- [ ] `projects/<name>/doc/specs/prd/prd-NN-<slug>.md` written — readable standalone, no Given/When/Then blocks
- [ ] `projects/<name>/doc/specs/prd/prd-NN-<slug>.criteria.md` written — every requirement has ID, priority, status `draft`, verify-via
- [ ] Every MUST has at least one Given/When/Then criterion and a verification hint
- [ ] Every MUST ID is referenced in the narrative's In-scope section
- [ ] Out-of-scope section is non-empty (an empty one means scope was never questioned)
- [ ] User-facing requirements carry accessibility acceptance criteria from the baseline (PRD-01.R20)
- [ ] The pair was committed and pushed on a work branch, stamped `Draft`, **before** approval was requested — and approval was asked against the committed register, not a summary of it
- [ ] On approval, the narrative was flipped to `Active` and that flip committed; a change request instead rewrote the pair in place, renumbering IDs freely
- [ ] If a prototype assisted the approval: divergences between prototype and list were surfaced before sign-off, and the `prototype/NN-<slug>` branch is deleted (never merged)

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
