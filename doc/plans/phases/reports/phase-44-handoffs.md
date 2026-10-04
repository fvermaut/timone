# Phase 44 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 44a — `timone number` reserves a number that no other session can get

**Built.** `reserveNumber(dir, kind, options?)` follows the plan's steps 1–4:
- It fetches with prune. It reads the highest number of the kind from every `refs/remotes/origin/*` ref except `origin/HEAD` (using `ls-tree` on the kind's folder), from the checkout's folder on disk, and from the reservations returned by `ls-remote origin 'refs/timone/numbers/<kind>/*'`.
- It reserves the next number by pushing a commit with an empty tree and no parent to `refs/timone/numbers/<kind>/<n>`. The message is `Reserve <kind> <n>`, a blank line, the note (default `for <TIMONE_RUN_BRANCH>`, else `for a session run by hand`), and `nonce: <16 hex>`.
- Success means exit 0 and a `*` porcelain line for that ref. Anything else re-reads the ref with `ls-remote`. If it exists, the number is taken and the next one is tried. If not, it throws with git's words.
- It tries at most 100 numbers. The command `timone number <project> <kind> [--manifest <path>]` prints only the padded number and a newline, exit 0. An unknown kind, an unknown project or a failed reservation each gives one sentence on stderr and exit 1. The kind is checked before anything else.

**Files touched.**

- `src/numbers.ts`: created. Exports `NUMBER_KINDS`, `NumberKind`, `isNumberKind` and `reserveNumber`. It has its own small spawn-based git runner, because it needs stdin, the exit code and stdout even when git fails.
- `src/numbers.test.ts`: created. Cases 1–9, 16 tests, against a bare remote and clones in temporary folders.
- `src/commands/number.ts`: created. `registerNumberCommand(program)`. It resolves the checkout as `const cwd = process.cwd(); resolve(cwd, config.path)`, the spelling of `workspace.ts`, so the guard sees it.
- `src/commands/number.test.ts`: created. Case 10, 4 tests.
- `src/cli.ts`: imports and calls `registerNumberCommand(program)`.
- `src/guards/checkouts.test.ts`: two list entries added, nothing else changed.
  - `numbers.ts` in `GIT_USERS`: a session runs it in its own checkout, never the daemon. It fetches, reads the remote branches and pushes a reservation ref (ADR-0062). It changes no file, no branch and no local ref, only the remote-tracking refs a fetch updates.
  - `commands/number.ts` in `EXEMPT`, with the same reason.

**Decisions taken inside the slice.**
- **Command test seam.** The command tests call `registerNumberCommand` on a fresh `Command`, as `projects.test.ts` does. The plan has been amended to say so.
- **Project folder.** It is resolved from the working folder, the same as `workspace.ts`. The command test runs `process.chdir` into a temporary timone root and changes back in `afterEach`.
- **Sentences.**
  - Unknown project: `I don't know a project called "<p>"; the projects I know are: a, b.`
  - Unknown kind: `"<k>" is not a kind of numbered file; the kinds are: phase, adr, triage, prd.`
  - Failed push: `Could not reserve <kind> <n>: <git's words>`.
  - Failed fetch or other git command: `git <args> failed: <git's words>`.
  - Too many tries: `Could not reserve a <kind> number: tried 100 numbers from <n> and every one was taken.`
- **Clone identity.** Every clone in the tests uses the same commit identity on purpose: all sessions on one machine commit as the same bot. That is what makes identical commits possible.
- **Case 7 setup.** Case 7 uses a `remote.origin.receivepack` wrapper script in the clone. It lets the first push through and holds a later one until a reservation is on the remote. Without it, two concurrent calls from one clone push at almost the same moment, the remote refuses one with "reference already exists", and the test could not fail even with both safeguards removed (0 of 15 runs failed).

**Validation evidence.**

Case 1: red because `./numbers.js` did not exist. Then green (4 tests).
Case 2: red `Expected "44" Received "01"` and `Expected "08" Received "01"`. Green after reading the remote branches.
Case 3: green when written (I wrote cases 3 and 4 together, which was a slip). Mutation check: reading only `refs/remotes/origin/main` gives red `Expected "46" Received "44"`. Reverted.
Case 4: red `Expected "62" Received "44"`. Green after reading the folder on disk.
Case 5: red `Expected "48" Received "44"`. Green after reading `ls-remote`. `adr/0090` is higher than 47, so mixing kinds would answer 91.
Case 6 (R8's falsifier; the test comment quotes the R8 clause):
```
$ npx vitest run src/numbers.test.ts     # reserveNumber returning the next number, no push
× gives five sessions asking for a phase number at once five different numbers, each reserved on the remote
AssertionError: expected 1 to be 5
(adr and triage also red)
```
Next step: push, counting exit 0 alone as success, with no random line. Still red (`expected 3 to be 5`, `expected 4 to be 5`) in 3 of 3 runs. The same commit pushed again gives `=` `[up to date]` with exit 0. Adding the `*` check made it green in 5 of 5 runs.
Case 7, as the amended checkbox asks. Mutation matrix, 5 runs each:
- random line removed and `*` check removed: red 5/5, `AssertionError: expected 1 to be 2`
- random line removed, `*` check kept: green 5/5
- random line kept, `*` check removed: green 5/5
Separately, case 6 with exit-0-only and the random line kept: green 3/3.
Case 8: green when written; nothing in the code writes to the checkout. Mutation check: adding `git update-ref refs/heads/kept <commit>` gives red `expected '88f98064…' to be ''`. Reverted.
Case 9: green when written. Mutation check: treating every failed push as "taken" gives red `expected … to throw error including 'pushes are refused here' but got 'Could not reserve a phase number: tried 100 numbers from 01 and every one was taken.'`. Reverted.
Case 10: prints the number: red because `./number.js` did not exist, then green. Unknown project: red (no output), then green. Unknown kind with no checkout at `projects/app`: red with `git fetch --quiet --prune origin failed: spawn git ENOENT`, then green once the kind is checked first. Failed reservation: red (uncaught `… does not appear to be a git repository`), then green.

Guard test, before and after the two list entries:
```
$ npx vitest run src/guards/checkouts.test.ts      # before
× the human's checkout is his alone > performs git only where somebody said so, and said what on
AssertionError: expected [ 'numbers.ts' ] to deeply equal []
Tests  1 failed | 6 passed (7)
$ npx vitest run src/numbers.test.ts src/commands/number.test.ts src/guards/checkouts.test.ts   # after
Test Files  3 passed (3)      Tests  27 passed (27)
```

Validation block:
```
$ npx vitest run src/numbers.test.ts src/commands/number.test.ts
Test Files  2 passed (2)      Tests  20 passed (20)
$ npm run type-check      -> exit 0
$ npm run build           -> exit 0
$ node dist/cli.js number --help; echo "exit: $?"
Usage: timone number [options] <project> <kind>
...
exit: 0
$ node dist/cli.js number nosuchproject phase; echo "exit: $?"
I don't know a project called "nosuchproject"; the projects I know are: scratch-app, ivtrends, timone.
exit: 1
$ node dist/cli.js number timone chapter; echo "exit: $?"
"chapter" is not a kind of numbered file; the kinds are: phase, adr, triage, prd.
exit: 1
$ git ls-remote origin 'refs/timone/*' | wc -l
0
$ npm test
Test Files  61 passed (61)
     Tests  1554 passed (1554)
```

**What the next slice must know.**
- `reserveNumber` needs a commit identity in the checkout, because `commit-tree` uses it.
- A project folder that does not exist gives the unclear `spawn git ENOENT`. I would add an "is not checked out at <path>" sentence, but it was outside the plan.
- `fetch` never brings `refs/timone/numbers/*` into a clone, so reservations are only ever read with `ls-remote`.
- The guard's pattern for a project folder, `/(?:join|resolve)\([^)]*\.path\b/`, does not match when a call such as `process.cwd()` comes before `.path` inside the same `resolve(...)`. Any new file that resolves a project folder that way is not caught.

**Gate note (orchestrator).** The first attempt ended with the full suite red on `src/guards/checkouts.test.ts`. That was a plan defect, not a fault of the slice: the plan was amended to grant that file (see `phase-44-departures.md`), and the second attempt turned it green. Checked again before the commit: the three test files, 27 tests passed; type check and build exit 0; the three command probes gave exit 0, 1, 1; `git ls-remote origin 'refs/timone/*' | wc -l` printed 0.

## 44b — a run's push guard lets it create a reservation, and nothing more

**Built.** Any step can now push a new number reservation through the guard, whether or not it has a work branch. `pushRefusal` allows an update when all three of these hold:
- its `remoteRef` matches `^refs/timone/numbers/(phase|adr|triage|prd)/\d+$`;
- its `remoteSha` is all zeros, so the ref does not exist on the remote yet;
- its `localSha` is not all zeros, so it is not a deletion.

Such an update is taken out before the old rules run. Every other update is judged exactly as before, and the refusal sentences are unchanged. A push that carries a reservation and any refused update is still refused whole.

**Files touched.**

- `src/daemon/push-guard.ts`: imports `NUMBER_KINDS` from `../numbers.js`. Adds `RESERVATION_REF` and the private `createsReservation(update)`. `pushRefusal` filters out the reservation updates into `others`, then applies the old two rules to `others`. One comment changed from "nothing to push" to "nothing else to push".
- `src/daemon/push-guard.test.ts`: added only, no line removed.
  - Two new import lines: `import { vi } from "vitest";` and `import { reserveNumber } from "../numbers.js";`. They are separate lines so the existing vitest import line is not edited.
  - A new describe block, "a reservation of a number, which every step may create", for cases 1–3.
  - A new `it.each` inside the existing describe block "a run's git push, with the guard switched on", for case 4.

**Decisions taken inside the slice.**
- **Kinds.** The kinds in the pattern are built from `NUMBER_KINDS`, so the guard and `reserveNumber` cannot drift apart when a kind is added. The pattern is the same as the plan's literal.
- **Both kinds of step.** Cases 1–4 each run twice: for a run with a work branch and for a step with none. A triage step has no work branch and needs triage numbers.
- **Extra row in case 2.** Besides the realistic delete (local all zeros, remote is a commit), there is a row "a delete whose far side reads as no commit" (both all zeros). Without it, the `localSha` clause could be removed and no test would fail, because the realistic delete is already refused by the `remoteSha` clause.
- **Environment in case 4.** `reserveNumber` runs git with this process's own environment. So the test uses `vi.stubEnv` to drop every inherited `GIT_*` variable, set the same clean `HOME` / `XDG_CONFIG_HOME` / `GIT_CONFIG_NOSYSTEM` as `remoteAndClone`, and add the guard's three variables. `vi.unstubAllEnvs()` runs in a `finally`.
- **Build.** Case 4 runs the hook through `dist/cli.js`, so `npm run build` has to come before it, as the file's own comment says. I ran the build. `dist/` is gitignored.

**Validation evidence.**

Case 1: written first, red against the unchanged `pushRefusal`:
```
$ npx vitest run src/daemon/push-guard.test.ts -t "reservation"
FAIL > allows a run with a work branch to create a reservation
+ Received: "Refused: this run may push only to `timone/7-x`, and this push goes to `refs/timone/numbers/phase/44`. ..."
FAIL > allows a step with no work branch to create a reservation
+ Received: "Refused: this step has no work branch, so it pushes nothing to the project. Say what you did on the ticket."
Tests  2 failed | 18 skipped (20)
```
Green after the smallest change: allow anything under `refs/timone/numbers/`.

Case 2: red against that smallest change:
```
× refuses moving a reservation that exists        (both kinds of step)
× refuses deleting a reservation                  (both)
× refuses a kind of numbered file that does not exist (both)
× refuses a number with more than digits          (both)
AssertionError: expected undefined to be defined
Tests  8 failed | 4 passed | 18 skipped (30)
```
The "outside numbers/" row was green from the start, because the smallest change already checked the prefix. Then green with the full rule (32 passed). Each clause was also checked by a mutation, reverted afterwards:
- `localSha` clause removed: red only on "a delete whose far side reads as no commit" (2 failed).
- `remoteSha` clause removed: red on "moving a reservation that exists" (2 failed).
- Kind replaced with `[a-z]+`: red on "a kind of numbered file that does not exist" (2 failed).
- End anchor `$` removed: red on "a number with more than digits" (2 failed).
- Pattern widened to `^refs/timone/`: red on the outside-numbers/, unknown-kind and non-digits rows (6 failed).

Case 3: green when written, because the "every update or none" rule already held. Mutation `if (updates.some(createsReservation)) return undefined;` gave red `AssertionError: expected undefined to be defined` (2 failed). Reverted, 34 passed.

Case 4: red with `dist/` built from the unchanged `push-guard.ts`:
```
× a run with a work branch can reserve a number, and still cannot push to the default branch
  → Could not reserve phase 01: Refused: this run may push only to `timone/7-x`, and this push goes to `refs/timone/numbers/phase/01`. ...
× a step with no work branch can reserve a number, and still cannot push to the default branch
  → Could not reserve phase 01: Refused: this step has no work branch, so it pushes nothing to the project. ...
Tests  2 failed | 34 skipped (36)
```
After restoring the change and rebuilding: 36 passed. Each test also checks that `git push origin HEAD:main` from the same clone is refused and that `main` on the remote did not move.

Case 5 (hard gate): all 20 tests that were in `push-guard.test.ts` before still pass, and so does `forge-guard.test.ts`. Neither file had a test edited (probes below).

Validation block:
```
$ npx vitest run src/daemon/push-guard.test.ts src/daemon/forge-guard.test.ts src/numbers.test.ts
Test Files  3 passed (3)      Tests  77 passed (77)
$ git diff -U0 -- src/daemon/push-guard.test.ts | grep '^-[^-]'; echo "exit: $?"
exit: 1
$ git diff --name-only -- src/daemon/forge-guard.test.ts | wc -l
0
$ npm run type-check
exit 0
```

Tests of code that uses the changed files:
```
$ npx vitest run src/commands/guardrails.test.ts src/daemon/hooks.test.ts src/daemon/session.test.ts src/daemon/container-runtime.test.ts src/guards/checkouts.test.ts src/commands/number.test.ts
Test Files  6 passed (6)      Tests  256 passed (256)
```
`npm test` was not run. The person running this build asked that no slice run the whole suite. It is left to the close of the phase.

**What delivery must know.**
- A box only allows reservations once its `dist/cli.js` contains this change, because the hook runs the built command line. Run `npm run build` before the whole suite, as the existing tests already need.
- `push-guard.ts` now imports `numbers.ts`. That file imports `node:child_process`, which the guard's `pre-push` command now loads. Nothing in `numbers.ts` runs when it is loaded.
- `git status` also shows `src/adapters/ticketing.ts`, `src/daemon/prompts.ts` and `src/daemon/prompts.test.ts` as modified. Those are 44c's files; I did not touch them.


**Gate note (orchestrator).** 44b and 44c ran at the same time: they share no file and no state outside the repository. Checked again before the commit: after `npm run build`, the three test files of the validation block, 77 tests passed; the removed-line probe gave `exit: 1`; the forge-guard probe printed `0`; type check exit 0.
