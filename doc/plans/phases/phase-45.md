# Phase 45: The list of pieces shows what is built at the same time — each piece says what it needs, the order in plain words, step tickets that wait exactly as it says, and a check the writing session runs

> **Status:** Planned.

> **Companion phases:** [phase 44](phase-44.md) — piece 1 of the same list, merged; it gave this phase its number through `node dist/cli.js number`, and its 44c was the last change to `src/daemon/prompts.ts`, which 45d changes again in a different function (`breakdownPrompt`). Pieces 2 to 5 of the list (#200 to #203) have no phase file yet; 45d and 45e change `src/daemon/prompts.ts`, `process.md` and `.claude/skills/timone-plan/SKILL.md`, which pieces 3 and 5 are likely to change too, so whichever merges second will need bringing level with the first. Governing decisions: [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) — a step ticket declares the steps it depends on through the forge's own `blocked by` relation, and the list of pieces stays the source of truth for what the steps are and in what order; this phase makes the list say the dependencies and the tickets copy them, instead of chaining every step to the one above. [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D1 and D4 — the person approves the committed list, and the list does not change after the approval, which is why the order must be in the file before the approval and is checked when it is written, not after. [ADR-0053](../../adr/0053-a-piece-is-a-thin-path-through-every-layer-and-names-only-what-it-finishes.md) — a piece is a thin path through every layer; R11 adds a preference below that rule and never above it. [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D5 — this project is Timone, so its own skill and `process.md` are its source and are committed here. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 — decides which checks this phase owes, below.

> **Screens changed:** none — no slice changes anything a person sees. (The order appears in a markdown file and in ticket text, which Timone does not draw.)

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R10 | MUST | A list of pieces shows its order in plain words ("1, then 2 and 3 together, then 4"), and the step tickets it opens are blocked by each other exactly as that order says |
| PRD-07.R11 | SHOULD | When two ways of cutting are equally good, the list of pieces chooses the one where fewer pieces wait for each other and fewer share files; PRD-01.R25 comes first |

This is piece 6 of the [list of pieces for #197](../breakdowns/ticket-197.md). That list says it needs none of the other pieces, and none of them is a prerequisite here: piece 1 (phase 44) is merged, and pieces 2 to 5 are not needed.

## Goal Description

Today the list of pieces is a numbered list and nothing more. When it is approved, `openStepTickets` in `src/daemon/chunk-zero.ts` opens one ticket per piece and makes every step ticket blocked by the one above it — a straight chain, whatever the pieces really need. So two pieces that could be built at the same time never can, and the person approving the list cannot see from it which pieces wait for which. The list for #197 shows the gap: its writer added `Needs:` lines and an `**Order:**` line by hand, and the machine read neither; its six step tickets were chained 1 → 2 → … → 6, although piece 6 needs nothing.

This phase makes the list carry its order and the tickets obey it. Each piece may carry a `Needs:` line naming the pieces above it that it needs. One pure function turns those lines into the order in plain words — "1, then 2 and 3 together, then 4" — and the same lines become the `blocked by` relations of the step tickets, so the words and the relations come from one source and cannot disagree. The list's own `**Order:**` line is what the person reads when they approve it; a command the writing session runs before it commits (`node dist/cli.js breakdown <project> <ticket>`) prints the order and refuses a list whose `**Order:**` line is missing or says something else. The writing instructions (the prompt that writes a list, the planning skill, `process.md`) ask for the `Needs:` lines, the `**Order:**` line and the check, and add R11's preference for pieces that do not wait for each other.

**Why it is useful already, before pieces 3 and 5.** With today's rule one ticket of a project builds at a time, and the next step is the first open, unblocked one (`src/daemon/steps.ts`, [ADR-0040](../../adr/0040-one-step-is-one-ticket-and-doneness-is-a-fact-about-a-ticket.md) D2). Correct relations change nothing about that until pieces 3 and 5 let several build at once; they then let them. Nothing in this phase starts two builds at once.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test (hard to reverse, surprising without context, a real trade-off).

- **The dependencies are written in the list, one `Needs:` line under each piece.** ADR-0040 already decided that a step declares what it waits for and that the list is the source of truth; where in the list it is written is a format detail, changed in one parser. The line's shape is the one the #197 list already uses: `   - Needs: pieces 1 and 2.`, or `Needs: nothing.` / `Needs: none of the others.` Only the first sentence after `Needs:` is read, so a second sentence of explanation ("It can be built at the same time as piece 5.") is allowed and ignored.
- **A piece with no `Needs:` line needs the piece just above it; piece 1 with no line needs nothing.** This is exactly what every list written so far means today (the chain), so the three committed lists with no `Needs:` lines (`ticket-103.md`, `ticket-128.md`, `ticket-164.md`) open the same relations as before. It can only make a step wait longer than needed, never start too early.
- **A `Needs:` line that cannot be read is refused, not guessed.** A line naming the piece itself, a later piece, a number not in the list, or no number at all (other than "nothing" / "none") makes the order *unclear*, with a sentence naming the piece and the line. `openStepTickets` then opens no tickets and returns that sentence, through the failure path it already has (the run posts "the tickets for the pieces were not opened" with the reason). Falling back to the chain was weighed: it is safe but would open relations that contradict the `**Order:**` line the person approved, which is what R10 forbids. The check command stops such a list before it is committed, so this refusal is a second net, not the normal path. **`parseBreakdown` itself does not judge `Needs:` lines**, so the poll loop and `timone status`, which read every list on every cycle, are not changed by this phase.
- **The order in words.** Pieces are split into groups that are connected by `Needs:` lines. A group of one piece that needs nothing and is needed by nothing reads "6 needs none of the others." Inside a group, pieces go in levels (a piece needing nothing is level 0; otherwise one more than the highest level it needs); levels are joined by ", then ", and several pieces on one level read "2 and 3 together" or "2, 3 and 4 together". Where a piece above level 0 does not need every piece on the level just before it, a sentence says what it does wait for: "4 waits only for 2." With this, the #197 list reads "1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others." — what its writer wrote by hand. A wording, changed in one function.
- **The relations are the direct `Needs:` only.** Step 4 needing 2 and 3 is blocked by steps 2 and 3, not also by step 1 (R10 clause 2). The forge already makes the wait carry through.
- **A re-run adds the relations a step is missing and never removes one.** Today a relation is written only for a ticket the same run opened, so a run that failed between opening a ticket and writing its relation leaves it unblocked for ever. With several relations per ticket that gap is wider, so a re-run now compares each step's existing `blockedBy` with its `Needs:` and adds what is missing. A relation a person added by hand is left alone.
- **The runner's own approval request is not changed.** It links the list, which carries the `**Order:**` line, and the writing session's comment says the order in the same words. Teaching the runner's brief to quote the order would change `src/runner/brief.ts`, which [PRD-05.R18](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md) (the replay, `verified`) rests on; that is a larger cost than this piece needs.

**What this phase owes before delivery.** ADR-0051 D4 narrows the checks to criteria whose `Depends-on` this phase touches. Among `verified` MUST criteria, the `live` ones [PRD-01.R10](../../specs/prd/prd-01-process-layer.criteria.md) (`.claude/skills/timone-plan/`) and PRD-02 R1, R2, R4 and R8 (`src/daemon/`) depend on files this phase changes, so **a live gate is owed before delivery**; if only the operator can run it, it rides to the pull request ([ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md)). No `verified` MUST `api` criterion has a `Depends-on` this phase touches. **What no criterion watches:** that opening step tickets stays idempotent, and that the poll loop and `timone status` read every committed list as before. The existing tests of those (`src/daemon/breakdown.test.ts`, `src/daemon/poll.test.ts`, `src/commands/status.test.ts`, `src/daemon/steps.test.ts`, `src/runner/actions.test.ts`) are a hard gate in every slice that touches `src/`, not a courtesy.

**What is not done here.** The runner's facts and brief are not changed (above). A list already approved is not rewritten (ADR-0030 D4), and step tickets already open are not re-related unless their run opens tickets again. R10 and R11 stay `draft` after this phase; verification sets their status.

## Context & Prerequisites

- **`src/daemon/breakdown.ts`** — `Chunk` (`title`, `delivers`), `parseBreakdown`, `renderBreakdown`, `readBreakdown`, `fromWorkingTree`. `CHUNK_LINE` reads `N. **title** — delivers`; every other line is ignored today, which is why the #197 list's `Needs:` lines did nothing.
- **`src/daemon/chunk-zero.ts`** — `openStepTickets`: lists existing steps (`adapter.listSteps`), creates the missing ones by title (`stepTitle`), calls `adapter.blockStep(project, number, previous)` only for a ticket it just opened, rewrites the initiative's body (`initiativeMap`), applies the map label. Returns a sentence on failure, undefined on success; it never throws. Called from `src/runner/actions.ts`, which this phase does not change.
- **`src/adapters/ticketing.ts`** — `stepSchema.blockedBy` (each with `number`, `url`, `open`) and `dependenciesIncomplete`; `TicketingAdapter.blockStep(project, step, waitsFor)`. `src/adapters/ticketing.stubs.ts` holds stubs that throw for the methods a test does not use.
- **`src/commands/number.ts` and `src/cli.ts`** — the pattern for a command that loads the manifest, checks the project name with a readable sentence, resolves the project's checkout (`resolve(cwd, config.path)`), and sets `process.exitCode = 1` with a sentence on failure. `src/commands/number.test.ts` drives the command through a `commander` `Command`.
- **`src/daemon/prompts.ts`** — `breakdownPrompt` shows the list's shape in a fenced block; `src/daemon/prompts.test.ts` already checks that the stamp it asks for parses ("writes a stamp the breakdown parser actually accepts").
- **`doc/plans/breakdowns/`** — four committed lists: `ticket-103.md`, `ticket-128.md`, `ticket-164.md` (no `Needs:` lines) and `ticket-197.md` (`Needs:` lines and an `**Order:**` line). They are the fixtures for "reads as before".
- **`doc/standards.md`** and Timone's `standards/` — TypeScript strict, vitest, tests at public seams; no screen, so no accessibility work.

## Sub-phases

### Sub-phase 45a: Each piece says what it needs, and the order reads in plain words

**[MODIFY]** `src/daemon/breakdown.ts` — `Chunk` gains `needsLine?: string`: the text after `Needs:` on the indented list line under that piece, before the next piece line, verbatim (the `Needs:` label may be bold). `parseBreakdown` fills it and changes nothing else: its malformed cases stay exactly as they are. `renderBreakdown` writes it back as `   - Needs: <text>` under its piece, so the round trip keeps it. New exports:
- `type PiecesOrder = { kind: "clear"; needs: number[][]; words: string } | { kind: "unclear"; reason: string }` — `needs[i]` is the direct needs of piece `i + 1`, ascending.
- `orderOf(breakdown: ParsedBreakdown): PiecesOrder` — pure. Reads each `needsLine` (first sentence only; "nothing" or "none…" → `[]`; otherwise every whole number in it), applies the default for a missing line (the piece above; `[]` for piece 1), refuses as described in the Goal Description, and builds `words` by the rule there.
- `orderInWords(needs: number[][]): string` — the wording alone, exported so 45c and 45d can use it.

**[MODIFY]** `src/daemon/breakdown.test.ts` — the cases below.

**Seams under test (TDD):** `orderOf` and `parseBreakdown` are the seams — pure, public, and what 45b and 45c call. Red-green: (1) the R10 fixture — 2 and 3 need 1, 4 needs 2 and 3 — gives `words` exactly `1, then 2 and 3 together, then 4.` and `needs` `[[], [1], [1], [2, 3]]`; (2) the committed `doc/plans/breakdowns/ticket-197.md` gives `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.` and needs `[[], [], [1, 2], [3], [3], []]` — which also proves that "Needs: piece 3. It can be built at the same time as piece 5." reads as `[3]`; (3) a list with no `Needs:` lines gives the chain (`1, then 2, then 3.`, needs `[[], [1], [2]]`); (4) 2 and 3 need 1, 4 needs only 2 → `1, then 2 and 3 together, then 4. 4 waits only for 2.`; (5) three pieces needing 1 read `2, 3 and 4 together`; (6) a `Needs:` line naming the piece itself, a later piece, a number past the end, or no number and not "nothing"/"none" each gives `unclear` with a reason naming the piece's number and quoting the line; (7) every committed list under `doc/plans/breakdowns/` parses to the same titles, descriptions and stamp as before this slice (read the files; compare `title`/`delivers`/`stamp` against values written into the test); (8) `renderBreakdown` → `parseBreakdown` keeps `needsLine`.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/breakdown.test.ts
npx vitest run src/daemon/poll.test.ts src/commands/status.test.ts src/daemon/steps.test.ts
npm run type-check
```

- [ ] Cases (1)–(8) pass, and the handoff shows each first failing, then passing.
- [ ] `poll.test.ts`, `status.test.ts` and `steps.test.ts` pass unchanged — this is the hard gate for "every committed list reads as before".
- [ ] `parseBreakdown` returns `malformed` in exactly the cases it did before (the existing tests in `breakdown.test.ts` pass unchanged).

---

### Sub-phase 45b: The step tickets wait for each other exactly as the order says

**[MODIFY]** `src/daemon/chunk-zero.ts` — `openStepTickets` computes `orderOf(read.breakdown)` before it touches the forge. When it is `unclear`, it returns `the list of pieces at <path> does not say clearly what each piece needs: <reason>, so no step tickets were opened` and opens nothing. When it is `clear`: it opens the missing tickets in list order as today; then, for every piece, it calls `adapter.blockStep(project, stepNumber, neededStepNumber)` for each direct need whose step is not already in that step's `blockedBy` (matched by number **and** by the URL being this project's repository, since `blockedBy` may hold issues of other repositories — see `dependencySchema`). It never removes a relation. The `previous`-chain is deleted. `initiativeMap` adds one line after the list: `Order: <words>`.
**[NEW FILE]** `src/daemon/chunk-zero.test.ts` — the cases below, with a fake `TicketingAdapter` built from `src/adapters/ticketing.stubs.ts`, recording `createStep`, `blockStep` and `setTicketBody` calls and answering `listSteps` from an in-memory list.

**Seams under test (TDD):** `openStepTickets` is the seam — the one public function that opens the tickets, observed through the calls it makes on the adapter. Red-green: (1) the R10 fixture opens four steps; step 2 and step 3 are each blocked by step 1 only, step 4 by steps 2 and 3 only, and step 1 by nothing (R10 clause 2); (2) the #197 list (read from `doc/plans/breakdowns/ticket-197.md`) gives step 3 → steps 1 and 2, steps 4 and 5 → step 3, steps 1, 2 and 6 → nothing; (3) a list with no `Needs:` lines gives the chain exactly as today; (4) run twice on the same fake forge, the second run opens no ticket and writes no relation; (5) a re-run where step 4 exists, is blocked by step 2 only, and needs 2 and 3 adds only the relation to step 3; (6) a step already blocked by an issue of another repository with the same number as a needed step still gets the relation written; (7) an `unclear` list opens no ticket, writes no relation and no label, and returns a sentence that contains the reason; (8) the initiative's new body carries `Order: 1, then 2 and 3 together, then 4.` for the R10 fixture.

> Sub-phase 45a must be complete before starting this sub-phase (it calls `orderOf`). It shares no file with 45c and may run in parallel with it.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/chunk-zero.test.ts
npx vitest run src/runner/actions.test.ts src/daemon/steps.test.ts
npm run type-check
```

- [ ] Cases (1)–(8) pass, red then green in the handoff.
- [ ] `actions.test.ts` and `steps.test.ts` pass unchanged — the hard gate for "opening step tickets still works and stays idempotent".
- [ ] `src/runner/actions.ts` is not modified by this sub-phase (`git diff --stat` in the handoff).

---

### Sub-phase 45c: A command that prints the order and refuses a list that says it wrongly

**[MODIFY]** `src/daemon/breakdown.ts` — new pure export `checkOrderLine(text: string): { kind: "ok"; words: string } | { kind: "problem"; problem: string }`. It parses the text (`parseBreakdown`), computes `orderOf`, finds the `**Order:**` line (bold optional, anywhere in the file) and compares it with `words` ignoring spaces at the ends and a final full stop. Problems, each one plain sentence: the file is malformed (with the parser's reason); the order is unclear (with its reason); there is no `**Order:**` line (and the sentence gives the exact line to add: `**Order:** <words>`); the line says something else (quoting both: what the line says, and what the `Needs:` lines say).
**[NEW FILE]** `src/commands/breakdown.ts` — `registerBreakdownCommand(program)`: `breakdown <project> <ticket>` with `--manifest` (default `timone.yaml`). It loads the manifest, refuses an unknown project with the same sentence shape `number.ts` uses, reads `breakdownPath(ticket)` from the project's checkout with `fromWorkingTree` (the session owns that checkout and has just written the file on its branch), says so when the file is absent, and otherwise prints `words` and exits 0, or prints the problem to stderr and sets exit code 1.
**[MODIFY]** `src/cli.ts` — register it beside `registerNumberCommand`.
**[NEW FILE]** `src/commands/breakdown.test.ts` — the command cases below, in the style of `number.test.ts` (a temporary directory with a manifest and a project folder).
**[MODIFY]** `src/daemon/breakdown.test.ts` — the `checkOrderLine` cases below.

**Seams under test (TDD):** `checkOrderLine` (pure) and the `breakdown` command (its output and exit code) are the seams. Red-green: (1) the R10 fixture with `**Order:** 1, then 2 and 3 together, then 4.` → ok with those words; (2) the committed `ticket-197.md` → ok (its hand-written line already matches); (3) no `**Order:**` line → problem containing `**Order:** 1, then 2 and 3 together, then 4.`; (4) `**Order:** 1, then 2, then 3, then 4.` on the R10 fixture → problem quoting both orders; (5) an unclear `Needs:` line → problem with the reason; (6) the command on a good file prints the words, exit 0; (7) on a file with a problem, prints the problem, exit 1; (8) an unknown project, and a ticket with no list, each print a sentence and exit 1.

> Sub-phase 45a must be complete before starting this sub-phase (it uses `orderOf`). It shares no file with 45b and may run in parallel with it.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/breakdown.test.ts src/commands/breakdown.test.ts
npm run build
cd .. && cd ..   # back to the timone root, where sessions run the command
node projects/timone/dist/cli.js breakdown timone 197 --manifest timone.yaml; echo "exit: $? (expected 0)"
node projects/timone/dist/cli.js breakdown timone 103 --manifest timone.yaml; echo "exit: $? (expected 1: ticket-103.md has no Order line)"
node projects/timone/dist/cli.js breakdown nosuchproject 1 --manifest timone.yaml; echo "exit: $? (expected 1)"
```

- [ ] Cases (1)–(8) pass, red then green in the handoff.
- [ ] The first command prints `1 and 2 together, then 3, then 4 and 5 together. 6 needs none of the others.`
- [ ] The second command's sentence gives the exact `**Order:**` line to add (`1, then 2.` for a two-piece chain).

---

### Sub-phase 45d: The session that writes a list writes the `Needs:` lines, the order, and runs the check

**[MODIFY]** `src/daemon/prompts.ts` — `breakdownPrompt`:
- The shown shape gains a `Needs:` line under each piece and an `**Order:**` line under the list:
  ```markdown
  1. **<what the piece is called>** — <one line of what it delivers>
     - Needs: nothing.
  2. **<the next piece>** — <one line of what it delivers>
     - Needs: piece 1.

  **Order:** 1, then 2.
  ```
- "Order them so each can be built and merged on its own, needing only what is above it" stays. Added after it, in plain words: every piece says on its `Needs:` line which pieces above it it needs, or "nothing"; when two ways of cutting are equally good, choose the one where fewer pieces wait for each other and fewer pieces change the same files — but each piece must still work end to end on its own, and that comes first (R11, PRD-01.R25).
- Before committing, run `node dist/cli.js breakdown <project> <ticket>` (interpolated, as the path is); it prints the order, or says what is wrong. Write the `**Order:**` line with exactly what it prints, and fix the list until the command ends without a problem.
- The closing comment says the order in the same words as the `**Order:**` line.
**[MODIFY]** `src/daemon/prompts.test.ts` — the cases below.

**Seams under test (TDD):** the breakdown prompt's text, through the same public function the existing prompt tests call, is the seam; the prompt is what makes a session write a list the machine can read, so its example is tested against the parser, as the stamp already is. Red-green: (1) the fenced example in the breakdown prompt, with its placeholders filled in, passes `checkOrderLine` (so the prompt can never again show a shape the machine refuses); (2) the prompt names the check command with this project's name and ticket number; (3) the prompt contains the R11 preference and says the end-to-end rule comes first; (4) the existing breakdown-prompt tests pass unchanged.

> Sub-phase 45c must be complete before starting this sub-phase (the prompt names its command, and case (1) uses `checkOrderLine`).

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/prompts.test.ts src/daemon/breakdown.test.ts
npm run type-check
```

- [ ] Cases (1)–(4) pass, red then green in the handoff.
- [ ] No other prompt function in `prompts.ts` is changed (`git diff` in the handoff shows changes inside `breakdownPrompt` only).

---

### Sub-phase 45e: The planning skill and `process.md` say the same

**[MODIFY]** `.claude/skills/timone-plan/SKILL.md` — in *The breakdown — the one thing a human approves here*: the shape block gains the `Needs:` lines and the `**Order:**` line (the same as 45d's); after "Order the pieces so each can be built and merged needing only what is above it", a marked amendment (`✏ <date> ([PRD-07.R10, R11](…))`) saying: each piece names on a `Needs:` line the pieces above it it needs, or "nothing"; a piece with no line needs the piece just above it; the `**Order:**` line is what `node dist/cli.js breakdown <name> <ticket>` prints, and the list is not committed until that command ends without a problem; the step tickets are blocked exactly by the `Needs:` lines; and when two cuts are equally good, prefer fewer waits and fewer shared files, after the end-to-end rule. The paragraph "Write the dependencies down even when the list order makes them look obvious" gains one sentence: the `Needs:` line is where they are written.
**[MODIFY]** `process.md` — stage 5, *The breakdown, and what it gates*: one marked amendment (`✏ 2026-10-04 (PRD-07.R10, R11)`) saying the list states which pieces each one needs and its order in plain words, the step tickets wait exactly as it says, and when two cuts are equally good the one with fewer waits and fewer shared files is chosen, after the end-to-end rule of PRD-01.R25.
**[MODIFY]** `STATUS.md` — one line saying piece 6 of #197 is built and what it changed.

**Seams under test (TDD):** no behaviour-carrying code in this sub-phase, so no seams are declared; validation is checklist-based.

> Sub-phase 45d must be complete before starting this sub-phase (the skill must describe the prompt and the command as they are built, and no session may be sent to a command that does not exist yet).

#### Agent Validation Steps

```bash
cd projects/timone
grep -n "Needs:" .claude/skills/timone-plan/SKILL.md
grep -n "dist/cli.js breakdown" .claude/skills/timone-plan/SKILL.md process.md
grep -n "PRD-07.R10" process.md .claude/skills/timone-plan/SKILL.md
npx vitest run
```

- [ ] The skill's shape block and 45d's prompt example are the same list.
- [ ] The R11 sentence in both files says the end-to-end rule comes first.
- [ ] Each change carries a dated `✏` marker; no unmarked rewrite of existing text.
- [ ] The whole test suite passes (phase close).

---

## Dependency graph

```
45a → (none)        each piece's Needs line is read; the order in words
45b → 45a           step tickets blocked exactly by the Needs lines; the map shows the order
45c → 45a           the check command the writing session runs
45d → 45c           the prompt that writes a list asks for Needs, Order and the check
45e → 45d           the skill and process.md say the same (docs last)
```

45b and 45c share no file and may run in parallel.
