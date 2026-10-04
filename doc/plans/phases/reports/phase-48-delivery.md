# Phase 48 — Delivery Report

- **Date:** 2026-10-04
- **Phase:** [phase-48.md](../phase-48.md) — `Complete`, verified in [phase-48-verification.md](phase-48-verification.md)
- **Branch:** `timone/200-2-status-md-and-the-requirement-register` @ `e36fa73`
- **Base:** `main` — the project's default branch. The branch was cut from `main` at `bd05360`, and `main` has not moved since.
- **Pull request:** opened against this report from the branch above. Its address is in the comment on [#200](https://github.com/fvermaut/timone/issues/200) and in `STATUS.md` item 1h.
- **Screen:** no user-facing screen in this phase (`Screens changed: none`).
- **Questions for the human:** 1, quoted from the verification report, plus 3 open questions from the completion report, all carried to the pull request.
- **Departures:** [`phase-48-departures.md`](phase-48-departures.md) — 5 entries (4 from the build, 1 from verification).

## Scope

This phase delivers PRD-07.R8 clauses 2 and 3 of [the PRD-07 register](../../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md), under [ADR-0064](../../../adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md). When one pull request merges, another that changed the same `STATUS.md` or requirement register is brought level with `main` in the box without a person, and no line either side wrote is lost. A new command, `timone merge-file`, is the git merge driver for these two kinds of file. The box switches it on through git's environment and writes nothing into the project. `process.md` gains one paragraph. Driving ticket: [#200](https://github.com/fvermaut/timone/issues/200), piece 2 of #197.

## How to try it

### Against the preview

Timone has no preview configured for pull requests (`timone.yaml` has no `bindings.preview` for it). Use the local steps.

### On a local checkout

Set up the checkout as [README.md](../../../../README.md) says, then check out the branch `timone/200-2-status-md-and-the-requirement-register`.

1. `npm run build && npx vitest run src/merge-rules.test.ts src/merge-rules.git.test.ts src/commands/merge-file.test.ts` — all pass. `src/merge-rules.git.test.ts` is the test with real git: two branches, one lands on `main`, the other is merged level with no conflict and every line kept.
2. `node dist/cli.js merge-file --help` — names `<kind> <base> <current> <other> [path]`, exit 0.
3. `d=$(mktemp -d) && node dist/cli.js guardrails install-merge-rules --dir "$d"; cat "$d/attributes"` — exit 0, then two lines: one for `/STATUS.md`, one for `doc/specs/prd/*.criteria.md`.
4. `git ls-files | grep -c '\.gitattributes$'` — prints `0`: the project gains no attributes file.
5. The check for PRD-07.R8, with the command given in the verification report's *Evidence* section. It runs the real box script outside a container and prints, for clauses 2 and 3, a RED line on the old build and a PASS line on this one.
6. `npm run --silent replay`, from a logged-in terminal — the check that could not run in the container (see below).

## Verification outcome

Quoted from [phase-48-verification.md](phase-48-verification.md). 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-07.R8 | MUST | api | PASS — clauses 1, 2 and 3. Status held at `draft`: one case of clause 3 is a question for the person | 0 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED — GitHub cannot be read from here) | 0 |
| PRD-05.R3 | MUST | api | PASS (regression) | 0 |
| PRD-05.R4 | MUST | api | PASS (regression) | 0 |
| PRD-05.R5 | MUST | api | PASS (regression) | 0 |
| PRD-05.R7 | MUST | api | PASS (regression; its real-runner clause BLOCKED — needs the replay) | 0 |
| PRD-05.R10 | MUST | api | PASS (regression) | 0 |
| PRD-05.R11 | MUST | api | PASS (regression) | 0 |
| PRD-05.R18 | MUST | api | **BLOCKED** — the replay needs a Claude login; this container has none | — |
| PRD-06.R5 | MUST | api | PASS (regression; on the builder's named test, by fvermaut's recorded decision) | 0 |
| PRD-07.R9 | MUST | api | PASS (regression) | 0 |
| PRD-08.R5 | MUST | api | PASS (regression) | 0 |

### Outstanding for the human

- [ ] PRD-05.R18, and the real-runner clause of PRD-05.R7 — the replay against the real model was not run: the container has no Claude login. Run `npm run --silent replay` from a logged-in terminal on this branch before merging.
- [ ] PRD-05.R2 clause 2b — not run: GitHub could not be read from the container.
- [ ] PRD-02.R1, R2, R4 and R8 (and the others listed in the verification report's *Live gates*) — live gate owed: a watched run on the real machine, which is the only check that shows the box's own git, in the real image, calls the merge driver and that the push guard still works. Steps: the verification report's *Live gates* section. Commit its report before merging.
- [ ] PRD-07.R8 — question 1 below: two new requirements with the same number still need a person. The requirement stays `draft` until it is answered.

### Questions for the human

1. From the verification report: when two pull requests both add a new requirement with the same number to the same register, should bringing the second one level need a person? Today it does. A useful answer: "yes, this case may need a person" (the requirement's words change and it can be marked checked); "no, renumber the branch's new requirement"; or "no, reserve requirement numbers the way phase numbers are reserved".
2. From the completion report: the check for two `## R<k>` headings with the same number runs only when git reported a conflict. Two such sections that git merges cleanly are not reported. Should the check run on every merge?
3. From the completion report: in `STATUS.md`, if the paragraph next to the `**Last updated:**` line is rewritten on both sides, removing the older date can leave an extra blank line. No test covers it.
4. From the completion report: the driver line does not quote the path of the CLI. The box's path has no space, so it works there.

## Standards review — phase 48

- **Read:** `/workspace/timone/standards/code-smells.md`, `/workspace/timone/standards/typescript.md`, `/workspace/timone/standards/testing.md`, `tsconfig.json`, `package.json` (scripts). For context also `src/daemon/push-guard.ts` (`installPushGuard`), which did not change.
- **Diff:** `bd05360...e36fa73` — 12 files, +1705/−5. These are only the non-process files: `src/cli.ts`, `src/commands/guardrails.ts`, `src/commands/guardrails.test.ts`, `src/commands/merge-file.ts`, `src/commands/merge-file.test.ts`, `src/daemon/container-runtime.ts`, `src/daemon/container-runtime.test.ts`, `src/guards/checkouts.test.ts`, `src/merge-rules.ts`, `src/merge-rules.test.ts`, `src/merge-rules.git.test.ts`, `process.md`.
- **Findings:** 4

### 1. The code that numbers git settings into `GIT_CONFIG_*` now exists three times, and the new copy only serves tests — Duplicated code / Speculative generality

- **Where:** `src/merge-rules.ts:568–581`, `src/daemon/container-runtime.ts:270–283`
- **What:** `installMergeRules` builds an environment by hand: `const env: Record<string, string> = { GIT_CONFIG_COUNT: String(config.length) }; config.forEach(([key, value], index) => { env[`GIT_CONFIG_KEY_${index}`] = key; ... })`. In the same diff, `gitConfigExport` numbers the same settings again as a shell line: `GIT_CONFIG_KEY_${index}=${key}`, `GIT_CONFIG_VALUE_${index}="${value}"`. `installPushGuard` (`push-guard.ts:249`) has a third copy, written by hand. The only production caller of `installMergeRules` is `guardrails install-merge-rules`, and it throws the returned environment away. Only `merge-rules.git.test.ts` reads it.
- **Why it matters:** Duplicated code, the rule of three: this is the third copy of one decision. It is also Speculative generality, because the returned value has no production caller. The two records cannot be combined either. Each one starts at index 0 with its own `GIT_CONFIG_COUNT`. The comment in `container-runtime.ts` warns about exactly this: "a second export would replace the first one's settings".
- **Suggested remediation:** Keep `mergeRulesConfig`, which returns key/value pairs, as the single source. Add one helper that turns a list of pairs into the `GIT_CONFIG_*` record, next to `gitConfigExport`, and use it in both places. Then `installMergeRules` can return nothing, and the git test can build its environment with that helper. Not applied here.

### 2. The choice between `STATUS.md` and a register is made in five places, and "not status" is taken to mean "register" — Flag parameter / Duplicated code

- **Where:** `src/merge-rules.ts:323`, `:449`, `:504`, `:512–519`, `:524`
- **What:** `kind` is passed into `resolveBlock` and `joinSegments` only so they can test `kind === "status"`. `mergeFile` tests it three more times: `kind === "status" ? joinBlocksAcrossBlankLines(parts) : parts`, `if (kind === "status") { ...olderLastUpdated... } else { ...fieldClashes... }`, and `kind === "register" ? takenNumbers(text) : []`. Each test has two branches. Nothing proves that the union is fully handled.
- **Why it matters:** `typescript.md`, "Type design" ("every `switch` over the tag ends with the value assigned to `never`"). If a third kind is added to `MERGE_KINDS`, it falls into the register branch in four places and the status branch in one, and the compiler says nothing. In code-smells terms, a two-value `kind` that switches behaviour inside helpers is a Flag parameter, and the same decision repeated five times is Duplicated code.
- **Suggested remediation:** Hold the per-kind behaviour in one record keyed by `MergeKind`, for example `{ joinBlocks, joinItems, dropLines, problems, blankBetweenVersions }`. Or use one exhaustive `switch` that ends in `satisfies never`. The helpers would then no longer take `kind`. Not applied here.

### 3. Exit code 127 has a meaning but no name — Magic number

- **Where:** `src/merge-rules.ts:498`
- **What:** `if (result.code < 0 || result.code > 127) { throw new Error(`git merge-file failed: ...`) }`. The value 127 depends on how `git merge-file` reports its result: the exit code is the number of conflicts, capped at 127, and anything above means an error. Neither the code nor a comment says this.
- **Why it matters:** Magic number or string (code-smells, Obscurers). A reader has to know git's exit-code rules to see why 127 is where a conflict count ends and an error begins.
- **Suggested remediation:** Use a named constant, such as `MAX_CONFLICT_COUNT = 127`, with a one-line "why" comment that cites `git merge-file`'s exit status. Not applied here.

### 4. `merge-rules.ts` holds two concerns that change for different reasons — Large class / module

- **Where:** `src/merge-rules.ts:1–526` against `:528–582`
- **What:** The new 582-line module holds a three-way merge algorithm: git output parsing, a line-level diff, grouping, and the `STATUS.md` and register rules. It also holds how the rule is set up in git: `MERGE_RULE_PATHS`, `driverName`, `mergeRulesConfig`, and `installMergeRules`, which writes the attributes file. The first part changes when the merge rules change. The second part changes when the way the box configures git changes.
- **Why it matters:** Large class / module (code-smells, Bloaters): one file gains responsibilities that share no reason to change. The setup half also sits closer to `push-guard.ts` and `gitConfigExport` (see finding 1) than to the merge algorithm.
- **Suggested remediation:** Move `MERGE_RULE_PATHS`, `driverName`, `mergeRulesConfig` and `installMergeRules` into their own module, next to the push guard's setup. Leave `merge-rules.ts` as the pure merge logic. Not applied here.

## Spec review — phase 48

- **Read:** `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.md`, `doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md` (R8 and header), `doc/plans/phases/phase-48.md` lines 1–20, `doc/adr/0064-status-md-and-the-registers-are-merged-by-timones-own-rule-in-the-box.md`, plus the diff of `src/merge-rules.ts`, `src/commands/merge-file.ts`, `src/commands/guardrails.ts`, `src/cli.ts`, `src/daemon/container-runtime.ts`, `src/guards/checkouts.test.ts`, `process.md`
- **Diff:** `bd05360...e36fa73` — 12 files, +1705/−5 (non-process files only)
- **Findings:** 3

### 1. A clause the branch adds to the last requirement moves under a new requirement that the default branch added — PRD-07.R8 (clause 3)

- **Where:** `src/merge-rules.ts:336–340` and `349–353`
- **What:** When both sides add lines at the same place, the rule writes the other side's lines first, then the current side's lines (`[...segment.other, ...segment.current]`). I tried this with the built CLI. In the base file, R8 is the last requirement. The branch adds `    - GIVEN cur-new-clause` to R8. The default branch adds a new section `## R9`. `merge-file register` exits 0, and the branch's clause ends up at the bottom of R9. The merged register now gives R9 a criterion that was written for R8. Nothing reports this.
- **Why it matters:** PRD-07.R8 clause 3 says "no line either one wrote is lost". The line is still in the file, but it now sits under the wrong requirement. Its meaning is lost and no person is told. The `register` tests do not cover this case.
- **Suggested remediation:** When the other side's lines in a both-sides insertion start a new `## R<k>` section, put the current side's lines before that heading, not after it. Add a test for the case above. — not applied here

### 2. A field only the branch changed goes back to the base value when the default branch changed a field on the next line — PRD-07.R8 (clause 3)

- **Where:** `src/merge-rules.ts:391–412` (`fieldClashes`), with `applyChanges` at `336–340`
- **What:** The two versions of an overlapping range include the base lines inside that range, and those base lines are labelled with each side's name. `fieldClashes` then compares field lines whether a side changed them or not. I tried this. The branch changed `Priority: MUST→SHOULD` and `Status: draft→verified`. The default branch changed only `Status: draft→deprecated`. The result keeps `- **Priority:** MUST`, and the branch's `SHOULD` survives only as a note that says "The default branch's `- **Priority:** MUST` stands". The default branch never changed Priority. ADR-0064 D1 limits this rule to a field "that both sides changed to different values".
- **Why it matters:** PRD-07.R8 clause 3 asks that nothing either side wrote is lost. Here the branch's change is undone without a conflict, and the note says the default branch set a value it never set.
- **Suggested remediation:** Count a field as a clash only when both sides changed that line from the base. When only one side changed it, keep that side's value. — not applied here

### 3. A requirement heading both sides renamed is refused as "number taken on both sides", so a person is needed — PRD-07.R8 (clause 3)

- **Where:** `src/merge-rules.ts:417–430` (`takenNumbers`), with `mergeFile` at `524–525`
- **What:** I tried this. Both sides edited the title of `## R8 — Eight`, one way each. The rule keeps both heading lines, then finds two `## R8` headings. It says "R8 is taken on both sides of this merge … A person must choose." and exits 1. No new requirement was added. The same number was not taken twice. The file it leaves also has no conflict markers. ADR-0064 D1 says the command "leaves git's conflict in the file".
- **Why it matters:** PRD-07.R8 clause 3 says "the update completes without a person resolving the register". The case that is known to stay open is two new requirements with the same number. This is a different case, and it is reported to the person with the wrong reason.
- **Suggested remediation:** When the two `## R<k>` lines come from the two versions of the same base heading, treat them as one field with one value: keep the default branch's title and write the branch's title as a dated note. Refuse only when the base had no `## R<k>`. When it refuses, leave git's markers in the file, as the ADR says. — not applied here

## Notes

- The two reviews were fresh contexts, and neither read the other's report or the verification report. They were meant to start together. The first Standards attempt was refused by a guard before it read anything, because its file list named the folder of verification checks. It was started again without that file, after the Spec review had finished. The Spec review's text was not given to it.
- The three Spec findings are cases the verification check did not try. Each one is a way the register merge can still need a person, or put a line in the wrong place, with no conflict shown. They bear on whether PRD-07.R8 can be marked checked, together with question 1.
- `STATUS.md` item 1h said the pull request "opens next". It is updated with the pull request's number in its own commit, after the pull request opens.
- Nothing was merged, rebased or force-pushed.
