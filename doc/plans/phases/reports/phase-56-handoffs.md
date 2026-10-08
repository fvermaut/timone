# Phase 56 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

## 56a — The file tools, the search tools and a helper's prompt are judged by what they open

**Built.** The probe guard now judges a tool call by what the tool opens, not by every word it carries. `Read`, `Write` and `Edit` are judged on `file_path` only, `NotebookEdit` on `notebook_path`, `Glob` on `pattern` and `path`, `Grep` on `path` and `glob` (its `pattern` is text). `Agent` and `Task` are never judged: a helper's prompt is text. `Bash`, any other tool, and a call with no tool name keep the old rule (all of the input's text). The hook's `guard` command passes the payload's `tool_name` through, so this holds for every kind of session, on the host and in a container. A helper told to keep out of a check-script folder, and a plan that names one, now pass with no reply. A real read is judged as before, with the same three reasons.

**Files touched.**

- `src/daemon/probeGuard.ts` — `ProbeGuardInput` gains `toolName?: string | undefined`. New exported `reachesProbeDirectory(toolName, toolInput)` with a private `TARGET_FIELDS` map of tool name to the fields that name a target; `probeGuardDecision` calls it in place of `mentionsProbeDirectory`. Doc comments: `reachesProbeDirectory` says why tools are judged by their target (#192) and that a tool with no rule keeps the old rule; `mentionsProbeDirectory` says it is now the rule for a tool with no rule. The three reasons are unchanged.
- `src/commands/guardrails.ts` — `runGuard` passes `toolName: deps.toolName` to `probeGuardDecision`. One line.
- `src/commands/stage.ts` — `guardSays` asks about a `Read` of `join(PROBE_DIRECTORIES[0], "x.mjs")`; `join` added to the existing `node:path` import. Sentences unchanged.
- `src/daemon/probeGuard.test.ts` — new `describe` at the end (cases 1 to 4). Old tests not edited.
- `src/commands/guardrails.test.ts` — new `describe` at the end (cases 5 and 6), never calls `workspace()`. The top of the file is not touched: `PROBE_DIRECTORIES` comes from a module-level `const { PROBE_DIRECTORIES } = await import("../daemon/probeGuard.js")` placed just before the new block. Old tests not edited.

**Decisions taken inside the slice.**

- `TARGET_FIELDS` is a `Map`, not an object literal, so a tool named like an object key (`constructor`, `toString`) cannot find a prototype member and crash the guard. A field is read with `Reflect.get`, so no cast is needed.
- A tool in the map whose input is not an object is not judged (it has no target fields). A tool not in the map goes to `mentionsProbeDirectory` as before.
- Case 2 pins the three reasons word for word, built from `PROBE_DIRECTORIES`, so the plan's "the three reasons stay word for word" is checked, not only the decision.
- Case 3's `WebFetch` input also carries a `url`, as the real tool does; the `mcp__x__y` input names the folder inside an array inside an object.
- In `guardrails.test.ts`, each case makes its own root with `mkdtempSync` (registered in `tempDirs`) and opens the ledger with `newStore(root)`. The run is registered as `timone#229` for session `session-192`. `root` is passed to `runGuard`, as the hook does, so the declared-step lookup runs and finds nothing.
- Case 6 expects `ask` for the person in a container too, as today. The plan leaves that row to piece 2.

**Validation evidence.**

Red-green trace.

1. Case 1 written alone, before any code change: `npx vitest run src/daemon/probeGuard.test.ts` → `Tests 36 failed | 19 passed (55)`. The 36 are the 6 calls x 6 kinds of session. Failure messages: `AssertionError: expected { permissionDecision: 'deny', …(1) } to be undefined` (and the same with `'allow'` and `'ask'`).
2. Case 5 written alone, before any code change: `npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"` → `Tests 12 failed | 52 skipped (64)`. Failure message: `AssertionError: expected '{"hookSpecificOutput":{"hookEventName…' to be undefined`.
3. Cases 2, 3 and 4 added, still before the code change: `probeGuard.test.ts` → `Tests 36 failed | 127 passed (163)`. The 36 failures are only case 1's six labels; all 108 tests of cases 2, 3 and 4 and the 19 old tests pass.
4. Case 6 added, still before the code change: `-t "only real reads and writes"` → `Tests 12 failed | 6 passed | 52 skipped (70)`. The 6 that pass are case 6.
5. After the change: `probeGuard.test.ts` → `163 passed (163)`; `-t "only real reads and writes"` → `18 passed | 52 skipped (70)`.

Validation commands, run from the project folder.

- `npx tsc --noEmit; echo "exit: $?"` → `exit: 0`.
- `npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts` → `Test Files 2 passed (2)`, `Tests 166 passed (166)`, exit 0.
- `npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"` → `Test Files 1 passed (1)`, `Tests 18 passed | 52 skipped (70)`, exit 0.
- `npm run build >/dev/null; echo "exit: $?"` → `exit: 0`.
- The `Agent` payload piped to `node dist/cli.js guardrails guard --root . --state "$S"` → no output, `exit: 0`.
- The `Read` payload of `$P/a.sh` piped to the same command, `grep -c '"permissionDecision":"ask"'` → `1`.

Checkboxes.

- [x] Cases 1 and 5 were red before the change and are green after (steps 1, 2 and 5 above).
- [x] Cases 2, 3, 4 and 6 are green before and after (steps 3, 4 and 5).
- [x] `stage.test.ts` passes without an edit: `3 passed (3)`.
- [x] The guard command prints nothing for the helper's prompt and still asks about the read.
- [x] No failure outside the four files of #220 in the files this change can reach (below); `guardrails.test.ts` has 45 failures, as today. The whole-suite line was left to the phase close, at the runner's request.
- [x] No added or changed line names a folder: a `node` script over `git diff -U0`, matching against `PROBE_DIRECTORIES`, reports `changed lines: 268 lines naming a folder: 0`. The diff was also read by eye. The test files have additions only.

Tests run at slice end, by file (every test file that imports `probeGuard`, `guardrails` or `stage`):

- `src/daemon/probeGuard.test.ts` — 163 passed.
- `src/commands/stage.test.ts` — 3 passed.
- `src/commands/guardrails.test.ts` — 45 failed, 25 passed (70). All 45 fail with `Error: Command failed: git push -q origin main`, the push guard refusing `workspace()`'s push (#220). All 18 new tests pass.
- `src/update-checks.test.ts` — 2 passed.
- `src/update-checks.git.test.ts` — 7 passed.
- `src/guards/checkouts.test.ts` — 7 passed.

**What 56b must know.**

- `Bash` has no entry in `TARGET_FIELDS`, so `reachesProbeDirectory` sends it to `mentionsProbeDirectory`. A shell rule needs parsing, not a list of fields, so it most likely belongs as its own branch in `reachesProbeDirectory`, before the map lookup.
- In `guardrails.test.ts`, the binding `PROBE_DIRECTORIES` now exists at module level, from the `await import` just before the 56a block. A later block at the end of the file can use it; declaring it again would be an error.
- Case 6 takes the expected decision from `SESSIONS[].read`, which depends on the kind of session only, not on host or container. When piece 2 refuses the container row with no run, that row needs its own expected value.

## 56b — A shell command is judged by the words that reach the folders

**Built.** A `Bash` call is now judged by the words of its command, not by every character it carries. A small reader, written by hand, splits the command into simple commands and their words. It handles quotes, separators, groups, `$( … )`, backticks, redirections and here-documents. The guard then judges the call when a folder's path starts a word, or follows a `/`, `:` or `=` in it. Here-document bodies, commit messages, ticket and pull request text, and lines written into another file are text and pass with no reply. A command that hands code to an interpreter as text (`bash -c`, `node -e`, `python3 -` reading a here-document, a pipe into `sh`, `eval`, `xargs`) is still judged by all of its text, as before. So is a command the reader cannot read to the end. #192's third call, a commit whose message names a folder, now passes for every kind of session. A real read joined to it is still judged.

**Files touched.**

- `src/daemon/shell-words.ts` (new) — `readShellCommand(command)` returns the list of simple commands (`words`, `heredocs`, `substitutions`), or `undefined` when the command cannot be read. It never throws: an internal `Unreadable` error and anything else, such as a stack overflow from deep nesting, are caught and give `undefined`. Imported only by `probeGuard.ts`.
- `src/daemon/probeGuard.ts` — `reachesProbeDirectory` sends `Bash` to a new private `shellReachesProbeDirectory`, with private helpers `handsCodeToInterpreter` and `wordReaches`. The comment on `mentionsProbeDirectory` now states the accepted gap (two moves, a variable, a path built from pieces, a wildcard, a search of the whole project), the start-of-word rule with its cost, and the interpreter rule with its reason and cost. The line "`Bash` is judged that way too for now" is gone.
- `src/daemon/probeGuard.test.ts` — new `describe("what the guard judges: shell commands (PRD-10 R4, R5)")` at the end. It holds cases 1 to 6, each as an `it.each` table over the same six kinds of session. Old tests not edited.
- `src/commands/guardrails.test.ts` — cases 7 and 8 added at the end of 56a's `describe`, using its `judge` helper and `KINDS`. The top of the file is not touched.

**Decisions taken inside the slice.**

- *Unreadable* is `undefined`, the same way `forge-guard.ts` returns "nothing to say". Inside the reader, failure is an exception that never leaves the file.
- A substitution adds nothing to the word it sits in, because its output is not known. Its commands are read on their own and join the list. So `echo "$(cat <folder>/a.sh)"` is judged by the inner `cat`, and a commit written as `"$(cat <<'EOF' …)"` leaves an empty word.
- A here-document body whose delimiter is not quoted is scanned for `$( … )` and backticks, and their commands join the list. A quoted delimiter turns that off, as in the shell.
- `<( … )` and `>( … )` are read as substitutions. A `#` that starts a word starts a comment, so an apostrophe in a trailing comment does not make the command unreadable.
- Finding the program: past `VAR=value` words, past the wrappers of the plan, and past these shell keywords: `{ ! if then elif else do while until`. Without the keywords, `if …; then python3 - <<'EOF'` would have the program `then` and would escape the interpreter rule. A wrapper's flags are skipped. The word after a wrapper's flag, or a number, is skipped too, since it may be the flag's value (`sudo -u root`, `nice -n 10`, `timeout 5`). It is not skipped when it is itself an interpreter.
- What counts as code given as text: `-c`, `-e`, `-p`, `--eval`, `--print` (and `--eval=`/`--print=`), or a group of short flags before the script that contains `c`, `e` or `p` (`bash -lc`, `perl -ne`). Also `-` anywhere, no script word at all, and `deno eval`. This leans towards judging. A flag such as `-Werror` before the script is taken as code given as text. That costs nothing unless the command's text also names a folder.
- `{`, `}` and keywords are left in the words. Only the program search skips them.
- No separate test file for the reader. It is reached only through `probeGuardDecision`, as the plan asks.

**Validation evidence.**

Red-green trace.

1. Case 1 written alone, before any code change: `npx vitest run src/daemon/probeGuard.test.ts` → `Tests 54 failed | 163 passed (217)`. The 54 are the 9 commands x 6 kinds of session. Failure messages: `AssertionError: expected { permissionDecision: 'deny', …(1) } to be undefined`, and the same with `'allow'` and `'ask'`.
2. Case 7 written alone, before any code change: `npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"` → `Tests 6 failed | 18 passed | 52 skipped (76)`. The 6 are "lets … commit a message that names a folder" for the 3 kinds of session x host and container. Failure message: `AssertionError: expected '{"hookSpecificOutput":{"hookEventName…' to be undefined`.
3. Cases 2 to 6 added, still before the code change: `probeGuard.test.ts` → `Tests 54 failed | 349 passed (403)`. The 54 failures are only case 1's nine labels. All 186 tests of cases 2 to 6 pass (25 judged commands and 6 silent ones, x 6), and so do the 163 earlier tests.
4. Case 8 added, still before the code change: `-t "only real reads and writes"` → `Tests 6 failed | 24 passed | 52 skipped (82)`. The 6 failures are case 7 only; case 8's 6 pass.
5. After the change: `probeGuard.test.ts` → `403 passed (403)`; `-t "only real reads and writes"` → `30 passed | 52 skipped (82)`.

Validation commands, run from the project folder.

- `npx tsc --noEmit; echo "exit: $?"` → `exit: 0`.
- `npx vitest run src/daemon/probeGuard.test.ts src/commands/stage.test.ts` → `Test Files 2 passed (2)`, `Tests 406 passed (406)`, exit 0.
- `npx vitest run src/commands/guardrails.test.ts -t "only real reads and writes"` → `Test Files 1 passed (1)`, `Tests 30 passed | 52 skipped (82)`, exit 0.
- `grep -rln "shell-words" src --include=*.ts` → `src/daemon/probeGuard.ts` only, `exit: 0`.
- `npm run build >/dev/null; echo "exit: $?"` → `exit: 0`.
- #192's commit (the here-document form, naming `$P/README.md`) piped to `node dist/cli.js guardrails guard --root . --state "$S"` → no output, `exit: 0`.
- `git commit -m "x" && cat $P/a.sh` piped to the same command, `grep -c '"permissionDecision":"ask"'` → `1`.

Checkboxes.

- [x] Cases 1 and 7 were red before the change and are green after (steps 1, 2 and 5).
- [x] Cases 2 to 6 and 8 are green before and after (steps 3, 4 and 5).
- [x] The guard command prints nothing for #192's commit and still asks about the joined read.
- [x] `mentionsProbeDirectory`'s comment states the accepted gap, the interpreter rule and the start-of-word rule with its cost.
- [x] No failure in the files this change can reach, other than #220's. `guardrails.test.ts` has 45 failures, the same as today. The whole-suite line was left to the phase close, at the runner's request.
- [x] No added or changed line names a folder. A `node` script checked the added lines of `git diff -U0` and all of `shell-words.ts` against `PROBE_DIRECTORIES` and reported `lines checked: 591 lines naming a folder: 0`.

Tests run at slice end, by file (`src/commands/stage.test.ts`, and every test file that imports `probeGuard`, `guardrails` or `stage`):

- `src/daemon/probeGuard.test.ts` — 403 passed.
- `src/commands/stage.test.ts` — 3 passed.
- `src/commands/guardrails.test.ts` — 45 failed, 37 passed (82). All 45 fail with `Error: Command failed: git push -q origin main`: `workspace()` pushes and is refused (#220). All 30 tests in the "only real reads and writes" block pass.
- `src/update-checks.test.ts` — 2 passed.
- `src/update-checks.git.test.ts` — 7 passed.
- `src/guards/checkouts.test.ts` — 7 passed.

Extra check, not a test: 18 more commands were run through the built `reachesProbeDirectory` and gave the expected result. Among them: `bash -lc`, `sudo -u root python3 -`, `if …; then python3 -`, `<( … )`, backticks, `$( … )` in an unquoted here-document, `./` before the path, a `( … )` group, a `{ …; }` group, `timeout 5 node -`, `env -i /usr/bin/python3.12 -c`, `--include=… <folder>`, and 20,000 open brackets (this falls back to the old rule and is judged). Two commands were judged that I had first expected to pass: `grep -rn "<folder>" src` and `--note "<folder>"`. Once the quotes are removed, the word begins with the path. This is the known cost the plan accepts.

**What delivery must know.**

- Known cost, as approved: a commit message, a `grep` pattern or any quoted argument that *begins* with a folder's path is judged. Start the sentence with a word, or use the `Grep` tool. A script given to an interpreter as text is judged even if it only prints a sentence naming a folder.
- Accepted gap, unchanged: a path reached in two moves, held in a variable, built from pieces, matched by a wildcard, or found by a search of the whole project is not judged.
- Gaps the reader leaves, all of which fall back to judging or to the old rule. A `case … in x)` pattern ends a group early, so the command is unreadable and judged by all its text. `$'…'` quoting is read as `$` plus a single-quoted string. A here-document opened inside a group whose body starts after the group's line is not supported, and the command reads as unreadable.
- `SimpleCommand.substitutions` is filled, as the plan specifies, but the guard does not read it: it only uses the commands the substitutions add to the list.
- What I would refactor: the two `describe` blocks in `probeGuard.test.ts` each define `SESSIONS` and `everySession`. A shared module-level helper would remove the copy, but 56a's block cannot be edited because of the line rule.
