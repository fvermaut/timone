# Phase 52: The `places` setting is documented — `README.md` and `timone.example.yaml` say how many tickets of one project build at once, and that a change needs a restart

> **Status:** Complete — see [reports/phase-52-complete.md](reports/phase-52-complete.md).

> **Companion phases:** [phase 49](phase-49.md) — piece 5 of the list for #197, merged; it added `places` to `src/manifest.ts` and the planner, and wrote neither into `README.md` nor `timone.example.yaml`. This phase writes what it left out. [phase 47](phase-47.md) — piece 3, merged; it built the place rule in `src/daemon/runs.ts` that the new text describes. Governing decisions: [ADR-0065](../../adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md) — D1, D3, D4, D5 and D6 are what the text says about the planner, holding and overruling; the words must not say more than they do. [ADR-0063](../../adr/0063-a-ticket-takes-a-place-only-while-one-of-its-steps-runs.md) D1 — what takes a place and what does not. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so `README.md` and `timone.example.yaml` are its source and are committed here.

> **Screens changed:** none — no slice changes anything a person sees on a screen Timone draws.

## Requirements

**Un-anchored chore work (agreed 2026-10-05, the planning of #219):** documentation only. `places` works as [PRD-07.R2](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md#r2--each-project-has-a-number-of-places-2-unless-timoneyaml-says-otherwise) asks and is verified; no requirement promises that it is written down for the operator. `README.md` and `timone.example.yaml` list every other optional project line and leave this one out, so fvermaut could not find out how to set it ([#219](https://github.com/fvermaut/timone/issues/219)). Nothing in the program changes. The requirements the text describes are PRD-07.R2, R5 and R6; the text must agree with them, but this phase claims none of them.

## Goal Description

The ticket asks for two documents to be fixed, and says exactly what they must say. Triage classified it as a chore on the ticket on 2026-10-05; no triage record was committed under `doc/triage/` for it. `doc/standards.md` does not exist in this project; the central `standards/` baseline governs, and none of its entries bears on two text files.

**Every sentence the build writes rests on a line of code or a spec clause, listed below.** The check after the build compares the words with these lines. A sentence with no line here is not written.

| Statement | Rests on |
| --------- | -------- |
| `places` is a whole number, 1 or more, set on a project's entry | `src/manifest.ts:72`; ADR-0065 D6 |
| It is how many tickets of that project may have a step running at the same time | `src/manifest.ts:66-71`; `src/daemon/runs.ts:1513-1520` (`placeTakenFrom`); PRD-07.R2 clauses 3–4 |
| When the line is missing, the project has 2 | `src/manifest.ts:189` (`DEFAULT_PLACES = 2`), `:195-196` (`placesOf`); PRD-07.R2 clause 1 |
| A running step takes a place, whatever the step is (plan, build, check, delivery, update…) | `src/daemon/runs.ts:1683-1688` (`takesPlace`); PRD-07.R2 clause 3; ADR-0063 D1 |
| A place given to a waiting ticket and not yet used counts as taken | `src/daemon/runs.ts:1683-1688`, `:1530-1540` (`givePlaces`); ADR-0063 D1 |
| A ticket waiting for a person, for a merge or for its turn, or with only an open pull request, takes none; nor does a runner session or a `timone takeover` terminal | `src/daemon/runs.ts:615-621`, `:1683-1688` (`takenOver` excluded); PRD-07.R2 clauses 5–6; ADR-0063 D1 |
| The planner takes no place | ADR-0065 D1 |
| A freed place goes to `priority:high` first, then the ticket opened first | `src/daemon/runs.ts:622-625`, `byPlaceOrder` (`:1695` on); ADR-0063 D3 |
| Before a ticket's build starts, the planner decides whether it may build now; it is asked only before the build | ADR-0065 D2; PRD-07.R5 clause 1 |
| The planner holds a ticket back when another ticket that is building, or has an open pull request, changes most of the same files, or when it needs another ticket's work that is not merged | ADR-0065 D3; PRD-07.R5 clause 3; PRD-07.R4 |
| A held ticket gets a comment naming the ticket it waits for and the reason, and is decided again when that ticket's pull request merges or closes; its plan is not rewritten | `src/planner/actions.ts:74-81` (`holdComment`); ADR-0065 D4; PRD-07.R5 clause 4, R6 clause 1 |
| A named person (in `instructors`, or the `operator`) who writes on the held ticket, in plain words, that it should build now, has it built when a place is free; the machine says so on the ticket. Anyone else's comment changes nothing | `src/planner/actions.ts:148-158`, `:85-96` (`letBuildComment`); ADR-0065 D5; PRD-07.R6 clauses 2–3; PRD-05.R10 |
| The daemon reads `timone.yaml` once, when it starts; a change needs a restart | `src/commands/daemon.ts:614` (the one `loadManifest` call, in the command's start), `:642` (places handed to the ledger once); no other read under `src/daemon/`, `src/runner/`, `src/planner/` |

**Regression set.** Derived per ADR-0051 D4: the MUST, `api`, `verified` criteria whose `Depends-on` this phase's diff touches. The diff touches only `README.md`, `timone.example.yaml` and this phase's own files, and no criterion depends on those, so the set is empty. No `live` criterion depends on them either, so no live gate is owed. What protects this phase is that the example manifest still loads: unknown keys are rejected (`src/manifest.ts:126`), so a misspelt `places` would break `cp timone.example.yaml timone.yaml`. That load is a hard gate below.

**Not done here.** `ticket_limit_usd` is also missing from `timone.example.yaml`. The ticket does not ask for it, and adding it would widen the change; it is left as it is.

No decision is taken in this plan. Where the paragraph sits in `README.md` and which example project sets the line are choices of layout, each undone by an edit.

## Context & Prerequisites

- **Phase 49** — `src/manifest.ts` (`places`, `DEFAULT_PLACES`, `placesOf`, `placesIn`) and `src/planner/actions.ts`. Read only; neither changes.
- **`README.md`, section *The runner*** — the YAML example at lines 80-87 lists `instructors` and `ticket_limit_usd` with a trailing `# optional:` comment; the paragraphs **Who may instruct it.**, **How you talk to it.**, **The limit.** follow at lines 89-93. Section *Everyday commands* line 70 already says to restart the daemon after pulling.
- **`timone.example.yaml`** — the header comment lists each project field as `name  (required|optional)  text`, aligned in columns (lines 3-22). `pilot-app` is the "fully-populated" example; `internal-tools` is the minimal one.

## Sub-phases

### Sub-phase 52a: The operator can read how to set `places`, what it does, and that a change needs a restart

**[MODIFY]** `README.md` — in section *The runner*:
- add `places: 3                  # optional: how many tickets build at once; 2 when missing` (aligned with the other comments) to the YAML example, after `ticket_limit_usd`;
- add a paragraph **How many tickets build at once.** after **The limit.** It says, in the house's plain short sentences: what `places` is; 2 when the line is missing; what takes a place and what does not; that the planner decides before each build and holds a ticket that would change most of the same files as another ticket building or waiting for review, or that needs another ticket's unmerged work; that the held ticket says what it waits for and is decided again when that pull request merges or closes; that a named person who writes on it that it should build now has it built when a place is free. Every sentence is one row of the table in the Goal Description; nothing beyond it. Do not call such a ticket "held" in a way that reads as the `timone:held` label: that label is what `timone cancel` puts on (README line 91), and the planner's hold sets no label. Link PRD-07 and ADR-0065 as the paragraphs around it link ADR-0060.
- add one sentence saying the daemon reads `timone.yaml` only when it starts, so a change to it needs a restart. Put it in that paragraph, and also beside the existing restart sentence in *Everyday commands* (line 70), which is where a reader looks for it.

**[MODIFY]** `timone.example.yaml`:
- in the header comment, after `instructors`, add `places` as `(optional)` in the same columns: a whole number, 1 or more; how many of this project's tickets may have a step running at the same time; omitted means 2; read when the daemon starts, so a change needs a restart.
- in `pilot-app`, set `places: 3` with a one-line comment, as `instructors` has one; `internal-tools` keeps no line, and its comment above the entry gains a few words saying it has the default 2 places.
  ✏ 2026-10-05 (build, timone#219): the plan said the existing comment on `internal-tools` already says it has 2 places. It does not: it names the stack, the preview, the introductions and the instructors only. The comment gains the words instead, which is what the plan's sentence was there to ensure.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based, plus the load of the example manifest through the real parser.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone   # from the timone root
npm run build >/dev/null

# Hard gate: the example manifest still loads through the real parser,
# and the places it declares are read as written. Expect exactly:
#   pilot-app 3
#   internal-tools 2
#   exit: 0
node --input-type=module -e "
const m = await import('./dist/manifest.js');
const x = m.loadManifest('timone.example.yaml');
for (const [n, c] of Object.entries(x.projects)) console.log(n, m.placesOf(c));
"; echo "exit: $?"

# The README's YAML example still parses as YAML (expect exit: 0).
awk '/^## The runner/{r=1} r&&/^```yaml/{f=1;next} f&&/^```/{exit} f' README.md \
  | node --input-type=module -e "
import('yaml').then(async ({parse}) => {
  let s=''; for await (const c of process.stdin) s+=c;
  const doc = parse(s); console.log(Object.keys(doc.projects['scratch-app']));
});"; echo "exit: $?"

# Only the two documents and this phase's own files changed (expect no other line).
git diff --name-only main... | grep -vE '^(README\.md|timone\.example\.yaml|doc/plans/phases/phase-52\.md|doc/plans/phases/reports/phase-52-.*)$'; echo "exit: $? (1 = nothing else changed)"
```

- [ ] The load prints `pilot-app 3` and `internal-tools 2`, exit 0.
- [ ] The README YAML example parses and its `scratch-app` keys include `places`.
- [ ] Nothing outside the two documents and this phase's own files changed.
- [ ] Each sentence about `places` or the restart in both files matches one row of the Goal Description's table; the handoff lists sentence → row. A sentence with no row is removed, not justified.
- [ ] The text uses the glossary's words (`CONTEXT.md`: place, planner, named person) and says nothing about stages or skills by name.

---

## Dependency graph

```
52a → (none)        README.md and timone.example.yaml describe `places` and the restart
```
