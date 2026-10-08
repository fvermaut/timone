# Phase 56 — Delivery Report

- **Date:** 2026-10-08
- **Phase:** [phase-56.md](../phase-56.md) — `Complete`, verified in [phase-56-verification.md](phase-56-verification.md)
- **Branch:** `timone/229-1-the-guard-judges-only-real-reads-and-w` @ `e517b06` before this report
- **Base:** `main` — the project's default branch; the branch was cut from `main` at `f8b6fbf` and nothing was stacked. `main` has moved on since (`0b51657`); the diff range uses the merge-base.
- **Pull request:** opened against this report, from the branch above, referencing [#229](https://github.com/fvermaut/timone/issues/229); its address is posted on the ticket.
- **Screen:** no user-facing screen in this phase (`Screens changed: none` — the guard answers a hook on stdout) — [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none in the verification report. The runner carried one request to this step: that fvermaut run the replay of recorded failures (`npm run --silent replay`) on this branch and reply with its result line before merging. It is the pull request's one question.
- **Departures:** [`phase-56-departures.md`](phase-56-departures.md) — 2 entries.

In this report, as in the phase file, **`<probes>`** stands for either folder in `PROBE_DIRECTORIES` (`src/daemon/probeGuard.ts`).

## Scope

Piece 1 of the list approved on [#87](https://github.com/fvermaut/timone/issues/87) ([breakdown](../../breakdowns/ticket-87.md)), driven by [#229](https://github.com/fvermaut/timone/issues/229). It addresses the three refused calls recorded in [#192](https://github.com/fvermaut/timone/issues/192). Claims PRD-10.R4 (MUST) and PRD-10.R5 (MUST), both now `verified`.

The guard that keeps a builder away from the check scripts is told which tool is being called. `Read`, `Write`, `Edit` and `NotebookEdit` are judged by the file they open; `Glob` and `Grep` by the folder they search; a helper's prompt is not judged. A new reader, `src/daemon/shell-words.ts`, splits a `Bash` command into its commands and words. A word is judged when a check folder's path starts it, or follows `/`, `:` or `=` in it. Commit messages, ticket text and text written into other files pass. A real read, list, run or write of a check script is still judged, also when joined to another command, and so is a script handed to an interpreter as text. A tool with no rule is judged by all of its input, as before.

## How to try it

### Against the preview

This project has no preview configured for pull requests (`timone.yaml` has no `bindings.preview` for `timone`). The guard is a hook command; use the local steps.

### On a local checkout

Setup is in the project's [README.md](../../../../README.md). Then, on this branch (steps lifted from the phase file's validation commands):

1. `npx tsc --noEmit` — expect exit 0.
2. `npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts` — expect all to pass.
3. `npm run build`, then take a check folder's path and a scratch state file:
   `S="$(mktemp -d)/state.json"; P=$(node -e 'import("./dist/daemon/probeGuard.js").then(m=>console.log(m.PROBE_DIRECTORIES[0]))')`
4. A helper's prompt that names the folder:
   `printf '{"session_id":"s1","tool_name":"Agent","tool_input":{"prompt":"Do not open %s","description":"d"}}' "$P" | node dist/cli.js guardrails guard --root . --state "$S"` — expect no output. Before this change it printed a question.
5. A real read of a check script:
   `printf '{"session_id":"s1","tool_name":"Read","tool_input":{"file_path":"%s/a.sh"}}' "$P" | node dist/cli.js guardrails guard --root . --state "$S"` — expect a line with `"permissionDecision":"ask"` (a person's session is asked; a building step is refused).
6. A real read joined to a commit:
   `node -e 'const p=process.argv[1]; console.log(JSON.stringify({session_id:"s1",tool_name:"Bash",tool_input:{command:"git commit -m x && cat "+p+"/a.sh"}}))' "$P" | node dist/cli.js guardrails guard --root . --state "$S"` — expect `"permissionDecision":"ask"`.
7. `npx vitest run` — outside a container, expect no failure. Inside a run's container, 70 tests fail on `main` too (Timone issue #220).
8. `npm run --silent replay`, from a terminal signed in to the model — the check that could not run here. Expect a result line such as "19 of 19".

## Verification outcome

From [phase-56-verification.md](phase-56-verification.md) — 1 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-10.R4 | MUST | api | PASS | 0 |
| PRD-10.R5 | MUST | api | PASS (FAIL at loop 0, fixed in `1cb9c00`) | 1 |
| PRD-05.R2 | MUST | api | PASS (regression; clause 2b BLOCKED, GitHub not reachable) | — |
| PRD-05.R3 | MUST | api | PASS (regression) | — |
| PRD-05.R4 | MUST | api | PASS (regression) | — |
| PRD-05.R5 | MUST | api | PASS (regression) | — |
| PRD-05.R7 | MUST | api | PASS (regression; clause 1 with the real runner BLOCKED, needs the real model) | — |
| PRD-05.R10 | MUST | api | PASS (regression) | — |
| PRD-05.R11 | MUST | api | PASS (regression) | — |
| PRD-05.R18 | MUST | api | BLOCKED (regression; needs a replay on this build against the real model) | — |
| PRD-07.R4 | MUST | api | PASS (regression) | — |
| PRD-07.R6 | MUST | api | PASS (regression) | — |
| PRD-07.R9 | MUST | api | PASS (regression) | — |
| PRD-08.R5 | MUST | api | PASS (regression) | — |
| PRD-09.R2 | MUST | api | PASS (regression) | — |
| PRD-09.R4 | MUST | api | PASS (regression) | — |
| PRD-09.R5 | MUST | api | PASS (regression) | — |

The loop-0 failure: 14 one-command ways to read a check script got through, such as `python3 <<<"…"`, `cat $'…'` and `curl -d @file`. The fix `1cb9c00` closed them. Whole suite at the close of the build: 2398 tests, 2328 passed, 70 failed — the same 70 container failures as on `main` (#220).

### Outstanding for the human

- [ ] PRD-05.R18, and PRD-05.R7 clause 1 (real runner) — **NOT RUN**: the replay of recorded failures against the real model on this build. The container has no sign-in to the model. Run `npm run --silent replay` on this branch from a terminal signed in to the model, and reply with the result line, before merging.
- [ ] PRD-05.R2 clause 2b — not run: needs GitHub, not reachable from the container.
- [ ] Live gates owed, by the register's `Depends-on` lines (this diff touches `src/daemon/` and `src/commands/`): PRD-01.R4; PRD-02.R1, R2, R4, R6, R7, R8, R13; PRD-03.R1, R2, R4, R5; PRD-04.R1; PRD-05.R9, R12, R13, R15; PRD-07.R5, R7, R14; PRD-08.R6; PRD-10.R8. The list and each one's last run are in [phase-56-verification.md](phase-56-verification.md) § Live gates. PRD-02.R2 names `src/commands/guardrails.ts`; the change there only passes the tool's name to the guard, and does not touch how a session finds its project. No check observed that.

## Standards review — phase 56

- **Read:** the diff `git diff origin/main...HEAD` for the six named files; the current `src/daemon/shell-words.ts`; `/workspace/timone/standards/code-smells.md`, `/workspace/timone/standards/typescript.md`, `/workspace/timone/standards/testing.md`; `tsconfig.json`; the `scripts` block of `package.json`. The project has no `doc/standards.md`, so the central standards apply. The project has no ESLint or Prettier config. The only checks a tool runs are `tsc` (strict) and vitest.
- **Diff:** `origin/main...HEAD` — 6 files, +995/−11 (of the reviewed files)
- **Findings:** 3

### 1. Two fields of `SimpleCommand` are filled but never read for their content — Speculative generality

- **Where:** `src/daemon/shell-words.ts:33–36`, `286`, `307`, `353`, `371`
- **What:** The reader fills `heredocs: string[]` (`heredoc.command.heredocs.push(body)`) and `substitutions: string[]` (`command.substitutions.push(...)`). Only one caller exists, `shellReachesProbeDirectory` in `probeGuard.ts`, and it reads only `found.words` and `found.herestrings`. That function's comment says the guard does not look at here-document bodies. Inside the module, the two fields are used only to count length in the empty-command filter: `found.words.length + found.herestrings.length + found.heredocs.length + found.substitutions.length > 0`. The text of a substitution is already read as commands of its own.
- **Why it matters:** code-smells.md, Speculative generality. These are two public fields with no consumer and no requirement behind them. A reader of the interface has to work out what each one is for.
- **Suggested remediation:** Remove the two fields. Keep only what the filter needs, for example a count or a boolean that marks a command as non-empty. — not applied here

### 2. `Reader.readList` is one long branch chain with a comment on each section — Long function

- **Where:** `src/daemon/shell-words.ts:82–203`
- **What:** `readList` is about 120 lines long. It is one `while` loop over a chain of `else if` branches: backslash, `$'…'`, `$"…"`, quotes, `$(`, backticks, comments, blanks, newline, `&>`, separators, parentheses, and redirections (which have their own nested `<<<` / `<<` / `<(` chain). Most branches start with a comment that names the section, for example `` // `$'…'`: quoted, with backslash escapes… `` and `` // `&>` and `&>>` send both outputs… ``. The other methods in the class are 15–40 lines each.
- **Why it matters:** code-smells.md, Long function. The signal is that the function is much longer than its neighbours and has a comment introducing each section.
- **Suggested remediation:** Move the redirection branch (`<` / `>` with its here-string, here-document and process-substitution cases) and the quoting branches into named private methods, as `readAnsiC` and `readDelimiter` already are. — not applied here

### 3. `readDoubleQuoted(command, closed)` takes a boolean that switches what it reads — Flag parameter

- **Where:** `src/daemon/shell-words.ts:205–237`, called at about lines 120, 130 and 354
- **What:** The doc comment says: "with `closed` false, read to the end instead, as the body of a here-document is read". With `true`, the method stops at `"` and throws if the quote is never closed. With `false`, it reads to the end of the text and never throws. Two call sites pass `true` and one passes `false`: `new Reader(body, this.commands).readDoubleQuoted(heredoc.command, false)`.
- **Why it matters:** code-smells.md, Flag parameter. One name covers two jobs: reading a quoted string, and scanning a here-document body for substitutions.
- **Suggested remediation:** Split it into two methods, for example `readDoubleQuoted` and `readHeredocBody`, that share the loop body through a small helper. — not applied here

## Spec review — phase 56

- **Read:** the diff of `src/daemon/probeGuard.ts`, `src/daemon/shell-words.ts`, `src/daemon/probeGuard.test.ts`, `src/commands/guardrails.ts`, `src/commands/guardrails.test.ts` and `src/commands/stage.ts`; the full new `src/daemon/shell-words.ts`; `doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.md`; `doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md` and its diff (R4 and R5 changed from `draft` to `verified`); lines 1–16 of `doc/plans/phases/phase-56.md`.
- **Diff:** `origin/main...HEAD`: 6 files, +995/−11 (of the reviewed files)
- **Findings:** 3

### 1. A script passed as text to an interpreter that a launcher starts, or to `awk` or `sed`, is not judged — PRD-10.R5

- **Where:** `src/daemon/probeGuard.ts`, the `INTERPRETERS`, `WRAPPERS` and `handsCodeToInterpreter` block (about lines 117–175 of the new file)
- **What:** The program is found only after `VAR=value` words, shell keywords and the wrappers `env sudo command exec time nice nohup timeout`. Launchers such as `npx`, `npm exec`, `pnpm exec` and `uv run` are not on that list, so the interpreter after them is never found. `awk` and `sed` are not on the `INTERPRETERS` list, but both run program text. Inside that text the path follows a quote mark, so the guard treats it as plain text. Each command below was run against the branch with stage `execution`. `<p>` is `PROBE_DIRECTORIES[0]`:
  - `npx tsx -e "console.log(require('fs').readFileSync('<p>/a.mjs','utf8'))"` → silent
  - `npm exec -- node -e "require('fs').readFileSync('<p>/a.mjs')"` → silent
  - `uv run python -c "print(open('<p>/a.sh').read())"` → silent
  - `awk 'BEGIN{while((getline l < "<p>/a.sh")>0) print l}'` → silent
  - `sed '1r <p>/a.sh' README.md` → silent

  On `origin/main` the old rule refused all five. `npx tsx -e` is a normal way to run a snippet in this repository.
- **Why it matters:** R5 says "a script handed to `python`, `node` or a shell as text is judged by all of its text, as today". Today all five are refused. After this change a builder can read a check script through `npx tsx -e` without any refusal. This is a step back from ADR-0048 D4, and it is not one of the gaps the PRD's Out of scope accepts: a path in more than one move, a variable, a path built from pieces, a wildcard, or a search of the whole project.
- **Suggested remediation:** Treat common launchers (`npx`, `npm exec`, `pnpm exec`/`dlx`, `yarn`, `bunx`, `uv run`, `poetry run`) like the wrappers, skipping their own flags and `--`. Add `awk`, `gawk` and `sed` (or, more safely, any program whose argument holds program text) to the rule that judges all of the text. Add these commands to the R5 table test. Not applied here.

### 2. A message or body that starts with the folder's path is still judged — PRD-10.R4

- **Where:** `src/daemon/probeGuard.ts`, the `wordReaches` function and the comment above `mentionsProbeDirectory` that names this cost
- **What:** A word counts as a target when the path starts it, so `git commit -m "<p>/README.md: fix"` is refused for a builder. I checked this on the branch: it is denied. The code comment accepts this: "a commit message or a `grep` pattern that begins with the path is judged. Start the message with a word". The same holds for a `--body` or `--title` that starts with the path, and for `-m"<p>…"` with the flag glued on.
- **Why it matters:** R4 says that "a commit message", ticket text and pull request text are not judged, for every kind of session. The register's example puts text before the path (`"… <probes> …"`), so the listed criteria pass. But a commit subject that starts with a path is a common form, and the PRD does not list this cost as accepted. It reproduces the #192 problem that R4 is meant to close.
- **Suggested remediation:** When the word is the value of a known text flag (`-m`, `--message`, `--title`, `--body`, `-b`, `-t`) of `git commit`, `gh issue` or `gh pr`, treat it as text. Otherwise, record the cost in the PRD's Out of scope so the requirement and the code agree. Not applied here.

### 3. Turning to the parent folder, `doc/plans/phases`, reads the check scripts without a refusal — PRD-10.R5

- **Where:** `src/daemon/probeGuard.ts`, `TARGET_FIELDS` (`Grep` → `path`, `glob`) and `wordReaches`
- **What:** A `Grep` with `path: "doc/plans/phases"` and a `Bash` call `grep -rn total doc/plans/phases` both search the check-script folder below it, and the guard says nothing. The guard only matches the folder's full path. This is not a regression: `origin/main` lets these through too.
- **Why it matters:** R5 requires that a search reading a check script is judged. The PRD's Out of scope accepts only "a search that reads the whole project" from the root. A search of the parent folder of the plans is narrower than that and is not named there. This is low priority, and I note it so the gap is written down and not silent.
- **Suggested remediation:** Judge a recursive search (`Grep` without a `glob` that excludes the folder, `grep -r`, `rg`, `find`, `ls -R`) whose target is a parent of a check-script folder. Otherwise, widen the Out of scope line to name this case. Not applied here.

No scope creep was found. `src/commands/guardrails.ts` only passes `toolName` along. `src/commands/stage.ts` only changes how `guardSays` probes the guard, which the R4 hint asks for. Nothing teaches a container its step (R1–R3 and R7 are untouched).

## Notes

- **Spec finding 1 is a step back from `main`**, not only a gap: five one-command reads that `main` refuses now pass silently, among them `npx tsx -e "…"`. The check did not try launchers, `awk` or `sed`. It is worth deciding before merging whether to fix it first or file it as its own ticket.
- This session's own guard, the one on `main`, refused the first prompt written for the requirements review because the prompt named the check folder: the problem this phase fixes. The prompt was rewritten without the folder's path and the review ran.
- Do not close #87 or #192 when this merges: #229 is piece 1 of #87. Piece 2, *each container knows its step*, builds on this.
