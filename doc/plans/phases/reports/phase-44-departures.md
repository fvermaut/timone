# Phase 44 — Departures

> One dated entry per departure from the plan or the requirements, appended, never rewritten. Format per `process.md` stage 6.

## 2026-10-04 — timone#199, build

**Kind:** plan step
**Agreed:** 44a's file list named `src/numbers.ts`, its test, `src/commands/number.ts`, its test, and `src/cli.ts`, and its validation required the full suite to pass.
**Did instead:** the plan was amended to grant `src/guards/checkouts.test.ts` to 44a, which adds `numbers.ts` to the list of files allowed to run git and `commands/number.ts` to the list allowed to resolve a folder under `projects/`, each with its reason. The command now spells the folder `resolve(cwd, config.path)`, so that the guard sees it.
**Why:** the guard refuses any unlisted file that runs git or reaches into `projects/` (ADR-0043), and the command does both by design (ADR-0062 D1, D3). Without the two entries the full suite fails. The person reviewing should confirm that this new entry in the guard is acceptable.

## 2026-10-04 — timone#199, build

**Kind:** plan step
**Agreed:** case 7 fails first "against a message with no random line".
**Did instead:** case 7 was shown red against a message with no random line **and** no `*` check, and green with either one alone.
**Why:** the plan's own step 3 counts a push as a reservation only when exit 0 comes with a `*` line, and that rule alone already stops a duplicate. The checkbox could not be met as worded, so it was amended.

## 2026-10-04 — timone#199, build

**Kind:** plan step
**Agreed:** the `number` command is tested through `buildProgram().parseAsync([...])`.
**Did instead:** it is tested through `registerNumberCommand` on a fresh `Command`, as the other command tests do.
**Why:** importing `src/cli.ts` runs the real command line when the module loads, so no test can import `buildProgram`.

## 2026-10-04 — timone#199, build

**Kind:** check not run
**Agreed:** each slice's validation block ends with `npm test`, and the build's rule runs every suite under a minute whole at the end of each slice.
**Did instead:** from 44b on, no slice ran the whole suite. Each ran the test files of what it changed and of the code that uses it, by name. The whole suite ran once, at the close: 61 files, 1609 tests passed.
**Why:** the person running this build asked for it on 2026-10-04, after 44a had run the whole suite three times.

## 2026-10-04 — timone#199, verification

**Kind:** check not run
**Agreed:** the check runs every criterion in scope, including the standing ones this phase could affect.
**Did instead:** PRD-05.R18 was BLOCKED on all three of its clauses, and two clauses of PRD-05.R2 (2b) and PRD-05.R7 (1, the runner) were BLOCKED inside otherwise passing checks. They need either the recorded replay against the real model on this build (`npm run --silent replay`, from a logged-in terminal) or a read of GitHub. Neither exists in this box. PRD-07.R8 clauses 2 and 3 were not checked: they are not built yet. No live gate was run; the report lists the ones owed.
**Why:** no model login and no GitHub access here. The register is unchanged for every BLOCKED criterion. See [phase-44-verification.md](phase-44-verification.md).
