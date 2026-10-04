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
