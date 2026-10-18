# Phase 64 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 64a — The check stops reading "was never" as an admission, and each finding carries the advice that clears it

**Built.**

- `registerFaults` no longer counts `was never` as an admission. The dated line on `ADMISSIONS` says why. The other admission phrases are unchanged.
- Each `RegisterFault` now has a `remedy`, the advice that clears it. An admission (`status-outruns-notes`) says to put the status back to `draft` or to correct the note. It does not mention `Falsified-by`. A universal closed by watching (`watched-only`) keeps today's advice, with the `Falsified-by:` line.
- `checkRegisterClaims` prints each fault's remedy on the line under it. The blank line and the shared advice line at the end are gone. The opening line and the summary are unchanged.
- PRD-07.R3 in this repository's register is no longer flagged, so `this repository's own registers` passes again. No register file was edited.

**Files touched.**

- `src/daemon/register.ts`
- `src/daemon/hooks.ts`
- `src/daemon/register.test.ts`: one new `describe("an old build's words are not an admission (timone#250)")` with cases 1 to 6.
- `src/daemon/hooks.test.ts`: one new nested `describe("the advice under each finding (timone#250)")` inside `describe("a register that claims more than it established")`, with cases 7 to 9.
- `doc/plans/phases/reports/phase-64-handoffs.md` (this file)

Both test files only gain lines (`git diff --numstat`: 68 and 88 added, 0 removed). No existing test was edited.

**Decisions taken inside the slice.**

- The frozen R3 block is copied into both test files: into `register.test.ts` for case 1 and into `hooks.test.ts` for case 7. Case 7 needs the block too, and importing one test file from another would run its tests twice. I generated both copies from the register file on this branch, line by line, so they match it exactly. The comment on each copy dates it 2026-10-18.
- Case 8's register is a small inline constant (`ADMITTED`, verify-via `api`, with a `Falsified-by:` line) next to the new cases. `block()` lives only in `register.test.ts`.
- Case 9 is a new test that reuses the existing `UNIVERSAL` constant. The existing `UNIVERSAL` tests are untouched.
- In `hooks.ts`, `faults.map` became `faults.flatMap`, so each finding gives two lines: the finding, then its remedy indented by two spaces.

**Validation evidence.**

Red run, on the code before the change (`npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts`): `Tests 7 failed | 89 passed (96)`, `exit: 1`.

| Case | Test | Before the change | Plan expected |
|---|---|---|---|
| 1 | leaves PRD-07.R3 alone | fail: one `R3` fault, expected `[]` | fail |
| 2 | does not read a note about an older build as an admission | fail: one `R1` fault, expected `[]` | fail |
| 3 | still flags an admission when the block has a Falsified-by line | pass | pass |
| 4 | still flags an admission in the gate line | pass | pass |
| 5 | advises the status or the note for an admission, not a Falsified-by line | fail: `remedy` is undefined | fail |
| 6 | advises a Falsified-by line for a universal closed by watching | **fail: `remedy` is undefined** | pass |
| 7 | says nothing about PRD-07.R3, so a clean session stays silent | fail: one `register-claims` violation | fail |
| 8 | advises the status or the note for an admission, not a Falsified-by line (hooks) | fail: detail contains `Falsified-by` | fail |
| 9 | still advises a Falsified-by line for a universal closed by watching (hooks) | pass | pass |
| — | this repository's own registers | fail: `prd-07-…criteria.md R3 (status-outruns-notes)` | fail |

Case 6 differs from the plan. It reads `fault.remedy`, and before the change that field does not exist. So it fails for the same reason as case 5, and it cannot be a guard that passes before the change. I kept the test as the plan declares it. The part of case 6 that is a guard (the rule still fires as `watched-only`) is already covered by the existing test "flags a universal closed by watching alone", which passed in the red run.

Green, after the change:

- `npx vitest run src/daemon/register.test.ts src/daemon/hooks.test.ts`: `Test Files 2 passed (2)`, `Tests 96 passed (96)`, `exit: 0`.
- `npx tsc --noEmit`: `exit: 0`.
- `npx vitest run src/daemon/register.test.ts -t "admission"`: `Tests 7 passed | 10 skipped (17)`, `exit: 0`. The 7 are the existing "flags an admission even on a channel no test could cover" and the six new cases.
- `npx vitest run` (the whole suite): `Test Files 12 failed | 66 passed (78)`, `Tests 100 failed | 2729 passed (2829)`, 8.69 s, `exit: 1`. **Not exit 0.** On the code before the change, the same run in this environment gave `Tests 101 failed | 2719 passed (2820)`, 7.92 s. The only difference between the two lists of failed tests is that `this repository's own registers` is now gone. The other 100 failures come from this run's environment, not from this slice. A guard here refuses every `git push … main`, including the pushes the tests make into their own temporary repos ("Refused: this run may push only to `timone/250-…`"). That accounts for 45 in `guardrails.test.ts`, 16 in `numbers.test.ts`, and others. Also, `dist/cli.js` is not built, which fails `cli.test.ts`. I did not work around the guard.

The orchestrator ran the whole suite again after `npm run build`, which fixes the `dist/cli.js` failures: `Test Files 4 failed | 74 passed (78)`, `Tests 70 failed | 2759 passed (2829)`, 12 s, `exit: 1`. On the code before the change, with the same build: `Tests 71 failed | 2749 passed (2820)`. The two lists of failed tests differ only by `this repository's own registers`. Each of the 70 failures stops on the same refusal: the container refuses the tests' `git push … main` into their own temporary repositories (`guardrails.test.ts` 45, `numbers.test.ts` 16, `workspace.test.ts` 6, `commands/number.test.ts` 3).

The orchestrator also fixed the indentation of the `PRD_07_R3` array in `register.test.ts` (2 spaces to 4, as in the rest of the file), and checked both frozen copies against the register: the text is the same, except that the register has one more blank line before `## R4`. After that, the two files gave 96 of 96, `tsc` exit 0, and `-t "admission"` 7 passed.

Printed `checkRegisterClaims` output for case 8 (a `status-outruns-notes` fault in a block with a `Falsified-by:` line):

```
scratch-app: doc/specs/prd/prd-01-x.criteria.md marks 1 requirement(s) verified on more than it established
A requirement is verified when something stands behind it. These say more than that:
- R1 is marked verified, and its own notes say a clause was never seen to hold. It says: `never seen`.
  Either put the status back to `draft`, or, once that clause has been seen to hold, say so in the note in place of the words quoted.
```

For the `UNIVERSAL` case (a `watched-only` fault):

```
scratch-app: doc/specs/prd/prd-01-x.criteria.md marks 1 requirement(s) verified on more than it established
A requirement is verified when something stands behind it. These say more than that:
- R1 claims something about every case and is verified by watching, which establishes the cases that were watched. It says: `at no point`.
  Either put the status back to `draft`, or name what would go red if it stopped holding in a `- **Falsified-by:**` line.
```

`git diff --stat main` (with this file marked for adding, so it shows):

```
 doc/plans/phases/phase-64.md                  | 119 ++++++++++++++++++++++++++
 doc/plans/phases/reports/phase-64-handoffs.md |  90 +++++++++++++++++++
 src/daemon/hooks.test.ts                      |  68 +++++++++++++++
 src/daemon/hooks.ts                           |   7 +-
 src/daemon/register.test.ts                   |  88 +++++++++++++++++++
 src/daemon/register.ts                        |  18 +++-
 6 files changed, 386 insertions(+), 4 deletions(-)
```

Nothing under `doc/specs/prd/` changed.

Checkboxes:

- [x] The red run is in the handoff, naming which cases failed and which passed before the change. Pass (case 6 failed, which the plan did not expect; see above).
- [x] `register.test.ts` and `hooks.test.ts` pass in full, with every existing test unedited. Pass: 96 of 96, and only lines were added.
- [x] `this repository's own registers` passes without any change to a file under `doc/specs/prd/`. Pass.
- [x] The printed output for case 8 shows the D2 advice under the finding and no `Falsified-by`. For `UNIVERSAL`, it shows the D1 advice with `Falsified-by`. Pass: both are pasted above.
- [x] `git diff --stat main` lists only the four source files and this phase's files under `doc/plans/phases/`. Pass.

**What delivery must know.**

- In this run's container, the whole suite does not exit 0: after `npm run build`, 70 tests fail before and after the change, all on the container's refusal of a push to `main`. Nothing in this slice causes them. Run the whole suite on a machine without that refusal before delivery.
- Case 6 cannot pass before the change, so as written in the plan it is not a guard.
- `Falsified-by:` no longer appears in the advice for an admission. Only the `watched-only` advice mentions it.
- Possible later cleanup, not done here: the two copies of the frozen R3 block could become one shared test fixture file, if a later phase allows one.
