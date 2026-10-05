# Phase 52 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 52a — The operator can read how to set `places`, what it does, and that a change needs a restart

**Built.** The operator can now read, in `README.md` and in `timone.example.yaml`, that `places` on a project sets how many of its tickets may have a step running at the same time, that it is 2 when the line is missing, what takes a place and what does not, how the planner decides before a build and when it holds a ticket back, how a named person has a held-back ticket built, and that the daemon reads `timone.yaml` only when it starts, so a change needs a restart.

**Files touched.**

- `README.md` — in *Everyday commands*, one sentence after the existing restart sentence: the daemon reads `timone.yaml` only when it starts. In *The runner*, the line `places: 3` in the YAML example after `ticket_limit_usd`, and a new paragraph **How many tickets build at once.** after **The limit.**
- `timone.example.yaml` — `places` in the header comment, after `instructors`, in the same columns; `places: 3` with a one-line comment in `pilot-app`; the comment above `internal-tools` gains the words that it sets no places and so has the default 2.

**Decisions taken inside the slice.**

- The planner is introduced as "another agent, the planner", because the README has not named it before this paragraph and the reader knows the runner is an agent. ADR-0065 D1 says the planner is an agent session of its own.
- The ticket the planner keeps from building is said to be "held back", never "held", and the paragraph names no label, so it does not read as the `timone:held` label that `timone cancel` puts on. No sentence says the planner sets no label: no row of the table carries that.
- Row 4's list of steps is written as "a plan, a build, a check, or an update of a pull request": plain words, no stage names. "Delivery" is left out of the list, as the README does not use the word elsewhere for a step; the sentence still says "whatever the step is".
- In `pilot-app`, `places: 3` sits after `instructors`, at the end of the entry, with its comment on the line above, as `instructors` has its comment.
- The header comment puts `places` on one line with `(optional)`, like `repo_url`, because the name fits the column; `instructors` needs its own line only because its name is longer.
- The last sentence of the paragraph links PRD-07 (its narrative file) and ADR-0065. It states no fact about `places`, so it rests on no row.

**Validation evidence.** There is no behaviour-carrying code in this slice, so no seams were declared and there is no red-green trace. Validation is checklist-based, plus loading the example manifest through the real parser.

```
$ npm run build >/dev/null; echo build: $?
build: 0

$ node --input-type=module -e "
const m = await import('./dist/manifest.js');
const x = m.loadManifest('timone.example.yaml');
for (const [n, c] of Object.entries(x.projects)) console.log(n, m.placesOf(c));
"; echo "exit: $?"
pilot-app 3
internal-tools 2
exit: 0

$ awk '/^## The runner/{r=1} r&&/^```yaml/{f=1;next} f&&/^```/{exit} f' README.md \
  | node --input-type=module -e "…parse… console.log(Object.keys(doc.projects['scratch-app']));"; echo "exit: $?"
[ 'instructors', 'ticket_limit_usd', 'places' ]
exit: 0

$ git diff --name-only main... | grep -vE '^(README\.md|timone\.example\.yaml|doc/plans/phases/phase-52\.md|doc/plans/phases/reports/phase-52-.*)$'; echo "exit: $? (1 = nothing else changed)"
exit: 1 (1 = nothing else changed)

$ git status --porcelain
 M README.md
 M doc/plans/phases/phase-52.md
 M timone.example.yaml
?? doc/plans/phases/reports/phase-52-departures.md
?? doc/plans/phases/reports/phase-52-handoffs.md
```

- [x] The load prints `pilot-app 3` and `internal-tools 2`, exit 0. **Pass.**
- [x] The README YAML example parses and its `scratch-app` keys include `places`. **Pass.**
- [x] Nothing outside the two documents and this phase's own files changed. **Pass**: `git diff` against `main` shows nothing else, and `git status --porcelain` shows only the two documents, the phase file and this phase's reports.
- [x] Each sentence about `places` or the restart matches one row of the table. **Pass**, list below. No row was found false against the code.
- [x] The text uses the glossary's words (place, planner, named person) and names no stage or skill. **Pass.**

Sentence → row (rows named by their statement in the Goal Description's table):

`README.md`, *Everyday commands*:

1. "The daemon reads `timone.yaml` only when it starts, so a change to that file needs a restart too." → *The daemon reads `timone.yaml` once, when it starts; a change needs a restart.*

`README.md`, *The runner*, YAML example:

2. `places: 3   # optional: how many tickets build at once; 2 when missing` → *It is how many tickets … may have a step running at the same time* and *When the line is missing, the project has 2* (the line given word for word by the plan).

`README.md`, **How many tickets build at once.**:

3. "`places` on the project is a whole number, 1 or more." → *`places` is a whole number, 1 or more, set on a project's entry.*
4. "It is how many of the project's tickets may have a step running at the same time." → *It is how many tickets of that project may have a step running at the same time.*
5. "When the line is missing, the project has 2." → *When the line is missing, the project has 2.*
6. "A running step takes a place, whatever the step is: a plan, a build, a check, or an update of a pull request." → *A running step takes a place, whatever the step is.*
7. "A place given to a waiting ticket and not yet used counts as taken." → *A place given to a waiting ticket and not yet used counts as taken.*
8. "Nothing else takes one: not a ticket waiting for a person, for a merge or for its turn, not a ticket with only an open pull request, not a runner session, and not a `timone takeover` terminal." → *A ticket waiting for a person, for a merge or for its turn, or with only an open pull request, takes none; nor does a runner session or a `timone takeover` terminal.*
9. "A freed place goes to a ticket labelled `priority:high` first, then to the ticket opened first." → *A freed place goes to `priority:high` first, then the ticket opened first.*
10. "Before a ticket's build starts, another agent, the planner, decides whether it may build now." and "It is asked only before the build." → *Before a ticket's build starts, the planner decides whether it may build now; it is asked only before the build.*
11. "The planner takes no place." → *The planner takes no place.*
12. "It holds the ticket back when another ticket that is building, or that has an open pull request, changes most of the same files." and "It also holds it back when it needs another ticket's work that is not merged." → *The planner holds a ticket back when another ticket that is building, or has an open pull request, changes most of the same files, or when it needs another ticket's work that is not merged.*
13. "The ticket then gets a comment that names the ticket it waits for and gives the reason." and "It is decided again when that ticket's pull request merges or closes, and its plan is not rewritten." → *A held ticket gets a comment naming the ticket it waits for and the reason, and is decided again when that ticket's pull request merges or closes; its plan is not rewritten.*
14. "A named person — someone in `instructors`, or the `operator` — can write on the ticket, in plain words, that it should build now.", "The ticket is then built when a place is free, and the machine says so on the ticket." and "Anyone else's comment changes nothing." → *A named person … who writes on the held ticket, in plain words, that it should build now, has it built when a place is free; the machine says so on the ticket. Anyone else's comment changes nothing.*
15. "The daemon reads `timone.yaml` only when it starts, so a change to it needs a restart." → *The daemon reads `timone.yaml` once, when it starts; a change needs a restart.*
16. "The requirements are [PRD-07](…); the decision is [ADR-0065](…)." → no row; a link sentence that states nothing about `places` or the restart.

`timone.example.yaml`:

17. Header: "A whole number, 1 or more: how many of this project's tickets may have a step running at the same time." → *`places` is a whole number, 1 or more* and *It is how many tickets of that project may have a step running at the same time.*
18. Header: "Omitted means 2." → *When the line is missing, the project has 2.*
19. Header: "The daemon reads it when it starts, so a change needs a restart." → *The daemon reads `timone.yaml` once, when it starts; a change needs a restart.*
20. `pilot-app`: "Three of this project's tickets may have a step running at the same time." → *It is how many tickets of that project may have a step running at the same time.*
21. `internal-tools`: "… and sets no places, so it has the default 2." → *When the line is missing, the project has 2.*

Whole vitest suite (`npx vitest run`): 76 files, 1908 tests; 72 files and 1838 tests pass, 4 files and 70 tests fail; 8.36 s. Every one of the 70 failures is the same: a test fixture runs `git push … main` into a temporary bare repository, and this run's own push guard (set through the `GIT_CONFIG_*` variables of the run's environment) refuses it with "this run may push only to `timone/219-the-places-setting-is-not-documented`". The four files are `src/commands/guardrails.test.ts` (45), `src/numbers.test.ts` (16), `src/workspace.test.ts` (6) and `src/commands/number.test.ts` (3). None of them reads `README.md` or `timone.example.yaml` of this repository; the `README.md` they write is one they create in a temporary folder. This slice changes no code, so the failures come from where the suite runs, not from the change.

**What delivery must know.** The 70 failing tests fail only inside a run's box, where the push guard refuses the test fixtures' pushes to `main` in temporary repositories. They were not run outside the box here, and the guard was not switched off to run them. Phase 50's completion report records the same 76 files and 1908 tests, all passing, in 5.8 s.
