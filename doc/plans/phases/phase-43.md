# Phase 43: A run cannot reach the default branch — the push guard, the forge-call guard, the box's run declaration, the status-file check both ways, and the status rule in the written process

> **Status:** Planned.

> **Companion phases:** [phase 32](phase-32.md) — its 32c corrected `checkStatusPlacement` twice and its D-2 settled that a status file on a run's own work branch is expected; this phase adds the direction 32c did not look at, and changes the same function and its test file. [phase 42](phase-42.md) — last changed `src/daemon/container-runtime.ts`'s box script and token handling; this phase adds to the same script, after its project install and before `claude` starts. [phase 40](phase-40.md) — built the runner and `startStepSession`'s callers in `src/runner/actions.ts`, which this phase gives one more field to pass. Governing decisions: [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) D2 and D4 — nothing reaches a default branch without a named person's yes, and code keeps what protects the person, which is what 43a and 43b build; [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D3 — merge stays human on Timone exactly as on a client, so the same guard binds a Timone self-run; [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) D2 — "the worst a run can do to the forge is push a bad branch to the project it was already sent to work on", which this phase makes true for the default branch; [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — the box is built from the remotes and holds one token, so the guard is installed by the box script, not carried in from the host; [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md) and [ADR-0027](../../adr/0027-a-guardrail-finding-is-addressed-to-the-session-that-caused-it.md) — the Stop check's findings go back to the session first, which is why 43d's wording is what a session acts on.

> **Screens changed:** none — no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-05-a-runner-decides-each-step.md](../../specs/prd/prd-05-a-runner-decides-each-step.md) — criteria in [prd-05-a-runner-decides-each-step.criteria.md](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-05.R3 | MUST | Nothing reaches a default branch without a yes from a named person |

This is a bug fix against an `Active` PRD whose R3 is `verified`. R3's own verification covered the runner's actions and `mergeChunkZero`; it did not cover the step sessions, which run with a token that can write any branch. That gap is the bug. **The requirements are not changed.** [PRD-01.R22](../../specs/prd/prd-01-process-layer.criteria.md#r22--human-readable-status-artifact) is touched by 43e's text and is discussed under the Goal Description; its criteria are not edited either.

## Goal Description

[timone#85](https://github.com/fvermaut/timone/issues/85): on 2026-09-04 the verification session of `timone#39`, running in a container, committed `STATUS.md` straight onto `origin/main` (`518252a`). The [phase 40 live check](reports/phase-40-live-gate.md) saw the same three more times on scratch-app (`570f682`, `78db7e8`, `99dbc31`, finding 5). Three things let it happen, and this phase fixes all three:

1. **Nothing stops it.** The box's token is a GitHub App installation token with `contents:write` on the project ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md)). A git push to any branch succeeds, and so does a write through the forge's API.
2. **The written process asks for it.** `process.md` § Status reporting says the status file "is written only on the project's default branch — never on a work branch", and the checking and delivery skills repeat it (`.claude/skills/timone-verify/SKILL.md:307`, `.claude/skills/timone-deliver/SKILL.md:262`). The session of `518252a` was a checking session doing exactly what its skill said.
3. **The guard is blind to it, and its words point the wrong way.** `checkStatusPlacement` skips every commit on the default branch (`src/daemon/hooks.ts:281`), and its finding says "Nobody reading `main` will see it until that branch merges" (`:289`). **A finding made at planning makes this worse inside a box:** the guard learns which run a session belongs to from the ledger (`runForSession`, `src/commands/guardrails.ts:196`), and the ledger lives on the host. A boxed session finds no run, is judged as a person's own session, and so a status file on the run's **own** work branch — which [phase 32 D-2](phase-32.md#d-2--a-status-file-on-a-runs-own-work-branch-is-expected-anywhere-else-it-is-still-a-finding) made silent — is reported inside a box, with the sentence that sends the agent to `main`. [timone#87](https://github.com/fvermaut/timone/issues/87) is the same cause seen from the probe guard.

**The cut, most important first.** 43a makes a git push to anything but the run's own work branch fail, in the box and in the host-side runtime alike. 43b does the same for the forge calls a session can make with `gh`. Those two are the part that matters ([PRD-05.R3](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person), [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) D2, [ADR-0050](../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) D3). 43c makes the box say which run it is, so the checks inside it can judge a run as a run, and refuses the two commands that switch 43a's guard off. 43d turns `checkStatusPlacement` to look the other way too and rewrites its message and `checkUnpushed`'s so that neither names the default branch as the remedy for a run (phase 32 D-2). 43e changes the written process and the two skills, and tells a step with no work branch that it commits nothing to the project.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test.

- **The push path refuses; the token is not narrowed.** The ticket allows either. A GitHub installation token has no branch dimension: it can be narrowed to repositories and to permissions, and a session needs `contents:write` to push its own branch. A repository rule that blocks the App on the default branch would also block the daemon's chunk-zero merge (`mergeIntoDefault`, `src/adapters/github-tickets.ts:463`), which uses the same App and which R3's third clause requires. So "the token is scoped so it cannot" is not available without a second identity, and that is the open question below. The guard is a git hook directory and a `gh` check, removed by deleting them: not hard to reverse. Not an ADR.
- **The guard is installed through git's environment, not through a global or a per-clone setting.** `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0=core.hooksPath` outranks a repository's own `core.hooksPath` (checked at planning with git 2.43: a local `core.hooksPath=.husky` is overridden), so a project that sets its own hooks directory cannot switch the guard off by accident. The cost is that the project's own hooks would no longer run, so the guard's directory forwards every client-side hook to the project's own. `git -c core.hooksPath=…` still outranks the environment (also checked); 43c refuses that command in a run.
- **A step with no work branch may push nothing at all.** Triage, clarification, wayfinding and research own no branch (`src/daemon/pipeline.ts`, `ownsBranch: false`). Under R3 there is no branch they may write, and their account already lives on the ticket. The phase 40 live check names its three commits as sorting and status-file commits, which looks like this case. This follows from R3 with no trade-off left. Not an ADR.
- **A session a person runs by hand is unchanged.** It writes `STATUS.md` on the default branch as today: the person is the named person, and the commit is theirs. Phase 32 D-2 already keeps that finding for a person's own branch. Only a run changes.
- **Every box gets the guard, a takeover box included.** A takeover box works under the App's token, not the person's; a person who wants to push to the default branch does it from their own checkout.

**What this costs, said once.** With a run's status file on its work branch, the default branch's `STATUS.md` does not show a run's work until its pull request merges, and two open pull requests that both change `STATUS.md` will clash at the second merge. [PRD-01.R22](../../specs/prd/prd-01-process-layer.criteria.md#r22--human-readable-status-artifact)'s evidence records fvermaut's ruling of 2026-07-29 that the file is written only on the default branch, for exactly that reason. ADR-0060 D2 (2026-09-26), phase 32 D-2 (2026-09-04) and fvermaut's own ticket #85 ("Since D-2 the remedy on a run is the work branch") came later and settle it for runs; the ruling still holds for sessions a person runs. R22's criteria do not name a branch and are not edited. While a run is open, its ticket and its pull request are where a person reads its state. For the same reason, this planning step wrote no `STATUS.md`.

**Questions only fvermaut can answer. The plan does not wait on them.**

- **Q1 — Make it impossible on the forge too?** 43a and 43b stop a session that follows its instructions, or makes a mistake. They do not stop a session that sets out to get round them: the token sits in a file the session can read, and `curl` with it reaches the API directly. Closing that needs the forge to refuse, which needs a branch rule on each managed repository that the box's identity cannot pass, and so a **second** GitHub App for the daemon's own chunk-zero merge. It needs admin rights on each repository and, for a private repository, a paid GitHub plan. A useful answer is "yes, do it as its own ticket", or "no, the guard in the box is enough".
- **Q2 — Mark PRD-01.R22's 2026-07-29 ruling?** Its evidence still says the file is written only on the default branch. A dated note saying that since this phase it applies to sessions a person runs would stop a later reader being misled. The runner's instructions were not to change requirements, so this phase does not.

**What is not done here.** The probe guard's own fault in a box, [timone#87](https://github.com/fvermaut/timone/issues/87), is not fixed: 43c's declaration carries the project and the work branch, and #87 adds the stage to it — one more variable and the probe guard's tests. A live check of a boxed run being refused is not owed by this phase: PRD-05.R3 is `api`, 43a's test pushes through real git with the box's own installation steps, and there is no docker here. A watched run on scratch-app would still be the strongest evidence, and only the operator can run one.

## Context & Prerequisites

- **`src/daemon/container-runtime.ts`** — `boxScript` (:427-640): clones Timone (:475) and the project (:493), checks out `$PROJECT_BRANCH` when the step owns a branch (:494-498), writes the token file and the `gh` wrapper in `$HOME/.local/bin` (:454-474), installs and builds Timone (`npm ci`, `npm run build`, :562-573) and the project's dependencies (:575-618), then `exec claude` (:620-639). `PROJECT_BRANCH` is passed with `-e` only when the request has a branch (:997). The box script is read back in tests by `boxScriptOf` (`container-runtime.test.ts:1306`).
- **`src/daemon/session.ts`** — `SessionRequest` (:86-122) and `sessionRequest` (:152); `workspaceFor(pin, project, branch)` (:389) drops the branch when there is no pin; `agentSdkRuntime.start` (:477) calls the SDK's `query` with `cwd`, `permissionMode` and no `env` today.
- **`src/runner/actions.ts`** — `branchFor` (:469) gives the step's branch name; the two session starts at :837-851 and :1003-1006 pass it to `workspaceFor`.
- **`src/daemon/hooks.ts`** — `SessionEvidence` (:107-162) carries `target?` and no work branch; `checkUnpushed` (:217), `checkStatusPlacement` (:260-298), `checkAll` (:615), `violationFeedback` (:705); `collectEvidence(root, baseline, { sessionId, target })` (:1113). `WORK_BRANCH_PREFIX` (:180).
- **`src/commands/guardrails.ts`** — `runGuard` (PreToolUse, :161), `runForSession` (:196), `runCheck` (Stop, :219-260), and the `guardrails` sub-commands (:280-380). Every hook command must never fail a session (the `try`/`catch` posture at :307, :336).
- **`src/daemon/hooks.test.ts`** — `checkStatusPlacement` cases (:133-313) and the evidence helpers (`cleanEvidence`, temp repos at :47).
- **`process.md`** — the artifact table's `STATUS.md` line (:70-71) and § Status reporting (:107-111).
- **`.claude/skills/timone-verify/SKILL.md:305-308`** and **`.claude/skills/timone-deliver/SKILL.md:260-263`** — the "Status reporting" sections carrying the default-branch sentence. `.claude/skills/timone-wayfind/SKILL.md:167,178` ("Update `STATUS.md`") — wayfinding owns no branch.
- **`src/daemon/prompts.ts`** — branch-owning stages are told "Nothing goes on the default branch" (:762-763, :1042-1043, :1112-1113). Branchless stages are told nothing about committing.
- **`src/daemon/pipeline.ts`** — `ownsBranch` per stage (:155-286): triage, clarification, wayfinding (two entries) and research own none.
- **Git facts this plan relies on, checked at planning with git 2.43.** A `pre-push` hook reads lines `<local ref> <local sha> <remote ref> <remote sha>` on stdin and a non-zero exit refuses the whole push; `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` outrank local config; `git -c` outranks them; `git push --no-verify` skips `pre-push`.
- **The box's git is not the host's.** Nothing in this phase changes the person's own `~/.gitconfig` or any checkout outside a run's session ([ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md)).

## Sub-phases

### Sub-phase 43a: A run's git push reaches its own work branch and nothing else

**[NEW FILE]** `src/daemon/push-guard.ts` — three exports:
- `pushRefusal(updates: RefUpdate[], workBranch: string | undefined): string | undefined` — pure. `RefUpdate` is one parsed `pre-push` line (`localRef`, `localSha`, `remoteRef`, `remoteSha`). Allowed only when **every** update's `remoteRef` is `refs/heads/<workBranch>` and its `localSha` is not all zeros (a delete is refused). With no `workBranch`, every update is refused. Returns the refusal in plain words, naming the refused ref and the branch that is allowed, for example: *"Refused: this run may push only to `timone/85-…`. `refs/heads/main` is the project's default branch or another branch, and nothing reaches the default branch without a person's yes. Commit on `timone/85-…` and push that."* With no work branch: *"Refused: this step has no work branch, so it pushes nothing to the project. Say what you did on the ticket."* Never names the default branch as a place to put anything.
- `parsePrePushInput(text: string): RefUpdate[]`.
- `installPushGuard(dir: string, options: { workBranch?: string; cli: string }): Record<string, string>` — writes `dir/pre-push`, which runs `node <cli> guardrails pre-push` (with `--branch <workBranch>` baked in when there is one) on its stdin and, when that passes, hands the same stdin to the project's own `pre-push` if it has one. It also writes a forwarder for every other client-side hook git runs (`applypatch-msg`, `pre-applypatch`, `post-applypatch`, `pre-commit`, `pre-merge-commit`, `prepare-commit-msg`, `commit-msg`, `post-commit`, `pre-rebase`, `post-checkout`, `post-merge`, `pre-auto-gc`, `post-rewrite`, `reference-transaction`): each runs the repository's own hook of that name, found from the repository's **local** `core.hooksPath` when set (relative to the work tree) and otherwise `$(git rev-parse --git-common-dir)/hooks`, and exits 0 when there is none. Files are mode 0755. Returns the environment that switches it on: `{ GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.hooksPath", GIT_CONFIG_VALUE_0: dir }`. A forwarder must pass its arguments and stdin through unchanged.
**[MODIFY]** `src/commands/guardrails.ts` — add `guardrails pre-push [--branch <name>]`: reads stdin, calls `pushRefusal`, prints the refusal to stderr and exits 1, or exits 0. **Unlike the other hook commands, an internal error here refuses the push** (exit 1 with the error in the message): a guard that lets everything through when it breaks is the fault this phase fixes. Say so in a comment.
**[MODIFY]** `src/daemon/session.ts` — `SessionRequest` and `SessionRequestInput` gain `workBranch?: string`, passed through by `sessionRequest`. `agentSdkRuntime.start` creates a fresh directory under `<cwd>/.timone/push-guard/` (gitignored with the rest of `.timone/`), calls `installPushGuard` with `cli` = `<cwd>/dist/cli.js`, and passes `env: { ...process.env, ...guardEnv }` to `query`. The directory is removed when the session completes.
**[MODIFY]** `src/runner/actions.ts` — both session starts (:837-851, :1003-1006) pass `workBranch: branch.name` (or `branch`) into the request, whether or not there is a pin.
**[MODIFY]** `src/daemon/container-runtime.ts` — the box passes `TIMONE_RUN_BRANCH` with `-e` when the request has `workBranch` (beside `PROJECT_BRANCH`, :997). `boxScript`, after the project's install and immediately before `claude` starts: `node /workspace/timone/dist/cli.js guardrails install-push-guard --dir "$HOME/.timone/git-hooks" ${TIMONE_RUN_BRANCH:+--branch "$TIMONE_RUN_BRANCH"}` and then `export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0="$HOME/.timone/git-hooks"`. A failure to install stops the box (`exit 79`, the same code and the same kind of sentence as Timone's own build failure at :569-573): a run must not start with the guard missing. Add the small `guardrails install-push-guard --dir <d> [--branch <b>]` command to `src/commands/guardrails.ts` so the box and the tests install through the same code.
**[NEW FILE]** `src/daemon/push-guard.test.ts`.
**[MODIFY]** `src/daemon/container-runtime.test.ts`, `src/daemon/session.test.ts`, `src/runner/actions.test.ts` — the cases below.

**Seams under test (TDD):** three seams. `pushRefusal` is pure and holds the rule. **A real `git push`** from a clone of a temporary bare repository, with the guard installed by `installPushGuard` and only its returned environment set, is the observable end: what reaches the remote. The box script, read back with `boxScriptOf`, and the `query` options `agentSdkRuntime` builds, are where the guard is switched on — a guard that exists and is never installed is the bug. Red-green:
1. `pushRefusal` with `workBranch: "timone/7-x"`: an update to `refs/heads/timone/7-x` is allowed; one to `refs/heads/main`, one to `refs/heads/other`, one to `refs/tags/v1`, and a delete of `refs/heads/timone/7-x` are each refused; a push carrying one allowed and one refused update is refused. The refusal text names `timone/7-x` and contains no sentence telling the reader to put anything on `main`.
2. `pushRefusal` with no work branch refuses every update, and says the step pushes nothing.
3. **The falsifying test, named `"a run cannot push to the default branch"`** so a reader of PRD-05.R3 finds it: in a clone with the guard's environment set, `git push origin HEAD:main` exits non-zero and the bare remote's `main` has not moved; `git push origin HEAD:timone/7-x` succeeds and the remote has the branch. Then prove it can fail: run the same push without the environment, see the remote's `main` move, record that in the handoff.
4. A clone whose local config sets `core.hooksPath` to its own directory: the guard still refuses `HEAD:main`; the project's own `pre-push` runs on an allowed push (it writes a marker file); the project's own `pre-commit` still runs on `git commit` through the forwarder, and a `pre-commit` that exits 1 still stops the commit.
5. `guardrails pre-push` exits 1 when given input it cannot parse.
6. The box script installs the guard after the project's install and before `claude`, exports the three `GIT_CONFIG_*` variables, and passes `--branch "$TIMONE_RUN_BRANCH"` only when it is set; a request with `workBranch` puts `-e TIMONE_RUN_BRANCH` in the `docker run` arguments, and one without does not.
7. `agentSdkRuntime` passes an `env` to `query` that carries `GIT_CONFIG_VALUE_0` pointing at a directory holding `pre-push`, and keeps the rest of `process.env`. (Inject the `query` function or read the options through the existing test seam in `session.test.ts`; do not start a real session.)
8. Both session starts in `actions.ts` put the step's branch in `workBranch`, including when `timonePin` returns undefined.

> No dependency on other sub-phases.

**Hook tests run real git.** Use temporary directories and set `HOME` and `GIT_CONFIG_NOSYSTEM=1` for the child processes, so the person's own git configuration can neither help nor break the test. Set `user.name` and `user.email` in the temporary clones.

#### Agent Validation Steps

```bash
npm run build
npx vitest run src/daemon/push-guard.test.ts src/daemon/container-runtime.test.ts src/daemon/session.test.ts src/runner/actions.test.ts
# The guard refuses when the input is malformed: expected exit 1.
printf 'not a ref line\n' | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"
# Allowed update: expected exit 0.
printf 'refs/heads/timone/7-x %s refs/heads/timone/7-x %s\n' 1111111111111111111111111111111111111111 0000000000000000000000000000000000000000 | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"
# Default branch: expected exit 1, and the message names timone/7-x.
printf 'refs/heads/main %s refs/heads/main %s\n' 1111111111111111111111111111111111111111 2222222222222222222222222222222222222222 | node dist/cli.js guardrails pre-push --branch timone/7-x; echo "exit: $?"
```

- [ ] Cases 1–8 each seen red before green, recorded in the handoff; case 3's "without the guard the remote moves" run recorded with its output.
- [ ] The three probe commands above give exit 1, 0, 1 in that order.
- [ ] No hook command other than `pre-push` changed its never-fail posture.
- [ ] Nothing under the person's home directory or any `~/.gitconfig` is written by the tests (they set `HOME` to a temporary directory).

---

### Sub-phase 43b: A run cannot write to a branch or merge through the forge's API either

**[NEW FILE]** `src/daemon/forge-guard.ts` — `forgeCallRefusal(args: string[], workBranch: string | undefined): string | undefined`, pure. `args` is a `gh` command line without the `gh`. Refused:
- `pr merge` (any form) — the machine never merges a pull request (ADR-0060 D2);
- `repo sync` — it moves a branch on the remote;
- `api` with a writing method — `-X`/`--method` other than `GET`, or no method given and any of `-f`, `-F`, `--field`, `--raw-field`, `--input` present, which `gh` sends as `POST` — to a path matching `repos/<o>/<r>/merges`, `repos/<o>/<r>/pulls/<n>/merge`, `repos/<o>/<r>/git/refs…`, or `repos/<o>/<r>/contents/…`, **except** a `contents/…` write whose `branch` field names `workBranch`;
- `api graphql` whose query (from `-f query=…` or `--input`) contains a mutation named `mergePullRequest`, `enablePullRequestAutoMerge`, `mergeBranch`, `createCommitOnBranch`, `updateRef`, `updateRefs`, `createRef` or `deleteRef`.
Everything else returns undefined — reading, commenting, labelling, opening a pull request (`pr create`), editing an issue. The refusal names what was refused and why, in the same words as 43a.
**[MODIFY]** `src/commands/guardrails.ts` — `guardrails forge-call [--branch <name>] -- <gh args…>`: prints the refusal to stderr and exits 1, or exits 0. Refuses on an internal error, as 43a's command does.
**[MODIFY]** `src/daemon/container-runtime.ts` — the `gh` wrapper (:465-472) runs `node /workspace/timone/dist/cli.js guardrails forge-call ${TIMONE_RUN_BRANCH:+--branch "$TIMONE_RUN_BRANCH"} -- "$@" || exit 1` before it hands over to the real binary. The wrapper is written before Timone is built (:454), so it must check that `dist/cli.js` exists and refuse (exit 1, with a sentence saying the guard is not built yet) when it does not; nothing in the box script itself calls `gh` before the build.
**[MODIFY]** `src/daemon/push-guard.ts` and `src/daemon/session.ts` — the host-side runtime gets the same check: `installPushGuard`'s directory also gains a `gh` wrapper that runs the check and then the real `gh` found on the original `PATH`, and `agentSdkRuntime` puts that directory first on the session's `PATH`. The daemon's own `gh` calls (`src/adapters/`) are made by the daemon process, not the session, and are untouched — the chunk-zero merge in particular.
✏ 2026-10-03 (build, timone#85): the session's checking `gh` goes in a `bin/` folder inside the guard directory, and that `bin/` folder is what goes first on `PATH`. The guard directory itself also holds the fifteen hook files, whose names are commands too: on `PATH`, a session running the common `pre-commit` tool would have run Timone's hook file instead. Both wrappers (box and session) also run the check with `< /dev/null`, so the check never takes the input `gh api --input -` needs. Recorded in [reports/phase-43-departures.md](reports/phase-43-departures.md).
**[NEW FILE]** `src/daemon/forge-guard.test.ts`; **[MODIFY]** `src/daemon/container-runtime.test.ts`, `src/daemon/session.test.ts`.

**Seams under test (TDD):** `forgeCallRefusal` is pure and holds the whole rule; the wrapper in the box script and the host-side `PATH` are where it is switched on. Red-green:
1. Refused: `pr merge 12 --squash`; `repo sync`; `api repos/o/r/merges -f base=main -f head=x`; `api -X PUT repos/o/r/contents/STATUS.md -f message=m -f content=…` (no branch: the forge's default); the same with `-f branch=main`; `api -X PATCH repos/o/r/git/refs/heads/main -f sha=…`; `api -X PUT repos/o/r/pulls/3/merge`; `api graphql -f query='mutation { mergePullRequest(…) }'`.
2. Allowed: `pr create …`; `issue comment 85 --body x`; `api repos/o/r/issues/85/comments`; `api -X POST repos/o/r/issues/85/comments -f body=x`; `api -X PUT repos/o/r/contents/doc/x.md -f branch=timone/7-x …` with `workBranch: "timone/7-x"`; `api graphql -f query='query { … }'`.
3. With no work branch, the `contents` write naming any branch is refused.
4. The box's `gh` wrapper calls the check before `exec /usr/local/bin/gh` and refuses when `dist/cli.js` is missing.
5. The host-side session's `PATH` starts with the guard directory, and the `gh` there runs the check before the real `gh`.

> Sub-phase 43a must be complete before starting this sub-phase (it adds `TIMONE_RUN_BRANCH`, the guard directory and `agentSdkRuntime`'s `env`, which this slice extends).

#### Agent Validation Steps

```bash
npm run build
npx vitest run src/daemon/forge-guard.test.ts src/daemon/container-runtime.test.ts src/daemon/session.test.ts
# Expected exit 1: a merge.
node dist/cli.js guardrails forge-call --branch timone/7-x -- pr merge 12 --squash; echo "exit: $?"
# Expected exit 0: a comment.
node dist/cli.js guardrails forge-call --branch timone/7-x -- issue comment 85 --body hi; echo "exit: $?"
```

- [ ] Cases 1–5 each seen red before green, recorded in the handoff.
- [ ] The two probe commands give exit 1 then 0.
- [ ] `src/adapters/github-tickets.ts` is unchanged by this slice (`git diff --stat` in the handoff).

---

### Sub-phase 43c: The checks inside a box know which run they belong to

**[MODIFY]** `src/daemon/container-runtime.ts` — the box also passes `TIMONE_RUN_PROJECT` (the project's manifest name) with `-e`, for every box that has a workspace. `TIMONE_RUN_BRANCH` is already there from 43a.
**[MODIFY]** `src/commands/guardrails.ts` — a new `sessionRun(store, sessionId, env): { project: string; workBranch?: string } | undefined`: the ledger's run first (`runForSession`, with `run.branch` as the work branch), and only when the ledger has none, the box's declaration from `TIMONE_RUN_PROJECT` and `TIMONE_RUN_BRANCH`. `runCheck` uses it for `collectEvidence`'s target and passes the work branch through. The report target (`ReportTarget`) stays as it is: a box has no ledger to flag, and its findings go back to the session.
**[MODIFY]** `src/daemon/hooks.ts` — `SessionEvidence` gains `workBranch?: string` (documented: the branch the run that drove this session works on; absent for a person's own session and for a step that owns none). `collectEvidence`'s `session` argument gains it.
**[MODIFY]** `src/commands/guardrails.ts` — `runGuard` (PreToolUse): when `sessionRun` finds a run, a `Bash` call whose command contains `core.hooksPath`, `GIT_CONFIG_`, or both `push` and `--no-verify`, is denied with the reason that these switch off the guard that keeps a run off the default branch. A person's own session is not affected. This is a check against the accident, not against a session working to get round it, in the same sense as `mentionsProbeDirectory` (`src/daemon/probeGuard.ts`). The probe guard's own decision is untouched ([timone#87](https://github.com/fvermaut/timone/issues/87) is separate).
**[MODIFY]** `src/commands/guardrails.test.ts`, `src/daemon/container-runtime.test.ts`.

**Seams under test (TDD):** `sessionRun` and `runCheck`/`runGuard` as the hook commands call them, with an injected environment and an empty ledger — the state every boxed session is in, which no test covers today. Red-green:
1. Ledger empty, environment declares `TIMONE_RUN_PROJECT=timone`, `TIMONE_RUN_BRANCH=timone/39-x`: `sessionRun` returns both.
2. Ledger has a run for the session with branch `timone/40-y`, environment declares `timone/39-x`: the ledger wins.
3. Neither: undefined, and `runCheck` judges the session as a person's own, as today.
4. **The box case of phase 32 D-2:** `runCheck` with an empty ledger and the box's declaration, over a session whose only commit puts `STATUS.md` on `timone/39-x` in `projects/timone`, hands back no finding. (Red today: the session is judged as a person's and the finding fires.)
5. `runGuard` with a box declaration denies `git push --no-verify origin x`, `git -c core.hooksPath=/tmp/h push`, and `GIT_CONFIG_COUNT=0 git push`; it says nothing about `git push origin timone/39-x` or `git commit --no-verify -m x`; with no run at all it says nothing about any of them.
6. A box request puts `-e TIMONE_RUN_PROJECT` in the `docker run` arguments, with the value in the environment and not in the argument vector.

> Sub-phase 43a must be complete before starting this sub-phase (`TIMONE_RUN_BRANCH` and the guard directory). Edits `container-runtime.ts` and `guardrails.ts` as 43b does, so not in parallel with 43b.

#### Agent Validation Steps

```bash
npm run build
npx vitest run src/commands/guardrails.test.ts src/daemon/container-runtime.test.ts src/daemon/hooks.test.ts
```

- [ ] Cases 1–6 each seen red before green, recorded in the handoff; case 4's red run quotes the finding it printed.
- [ ] `src/daemon/probeGuard.ts` is unchanged by this slice.

---

### Sub-phase 43d: The status-file check looks both ways, and names the work branch as the remedy

**[MODIFY]** `src/daemon/hooks.ts` —
- `checkStatusPlacement`: when `evidence.target` names the repository and the session is a run (`evidence.target !== undefined`), a commit touching `STATUS.md` whose `branch` is the default branch **is reported** instead of skipped. With `evidence.workBranch` set, the summary says `STATUS.md` was written on `<default>`, which a run may not write, and the detail says to move the commit onto `<workBranch>` (for example `git cherry-pick` it there, then put the local `<default>` back to `origin/<default>`), and that the file reaches `<default>` when that branch's pull request is merged. With no work branch, it says this step writes nothing to the project and its account belongs on the ticket. The existing direction — a status file on a branch that is not the run's own — keeps firing, but its detail no longer says the default branch is where the file should be when the session is a run: for a run it names the run's work branch; for a person's own session (no target) it keeps today's sentence, which phase 32 D-2 kept and which is still right there. Update the function's doc comment: a third paragraph for the third direction, citing PRD-05.R3 and phase 32 D-2.
- `checkUnpushed`: for a run (`evidence.target` set), an unpushed commit on the repository's **default** branch gets a detail line that says the push will be refused and the commit belongs on the work branch (or, with none, nowhere in the project) — never "push it". Other branches keep today's wording.
- `violationFeedback`: the generic line "Either fix it — push the commits, move the branch, …" stays, but its list must not be the only advice a run reads for a default-branch commit; the rule's own detail (above) is what says what to do. No change unless a test shows the generic line contradicting the detail.
**[MODIFY]** `src/daemon/hooks.test.ts`.

**Seams under test (TDD):** `checkStatusPlacement` and `checkUnpushed`, pure over fabricated `SessionEvidence` — the house pattern of `hooks.test.ts:133-313`. Red-green:
1. **The replay of `518252a`:** a run targeting `timone`, `workBranch: "timone/39-primary-sources-owed-for-the-ui-ux-basel"`, one commit `518252a` on `main` touching `STATUS.md` with the trailers from the ticket → exactly one finding; its text names `timone/39-primary-sources-owed-for-the-ui-ux-basel` and does not contain "Nobody reading" nor any sentence presenting `main` as where the file belongs.
2. A run with no work branch (a sorting step), `STATUS.md` committed on `main` → one finding saying the step writes nothing to the project.
3. A person's own session (no target), `STATUS.md` on `main` → no finding (unchanged).
4. A run, `STATUS.md` on its own work branch in its own project → no finding (phase 32 D-2, unchanged).
5. A run, `STATUS.md` on some other branch → one finding whose detail names the run's work branch, not `main`; a person's own session in the same shape → today's finding and today's sentence.
6. A run's commit already on `origin/main` before the session (`onDefaultBranch: true`, not made by this session's work on `main`) is not reported — check this against how `collectEvidence` sets `branch` and `onDefaultBranch`, and keep timone#70's case silent.
7. `checkUnpushed`, a run with an unpushed commit on `main` → the detail says it belongs on the work branch and contains no instruction to push it; the same on a work branch → today's wording.
8. `ivtrends`' 2026-08-30 pair (phase 32c's case 3, already in the test file) still gives exactly today's answer.

> Sub-phase 43c must be complete before starting this sub-phase (it adds `SessionEvidence.workBranch`).

#### Agent Validation Steps

```bash
npm run build
npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts
# The old sentence is gone from code (comments excluded): expected no output and exit 1.
grep -n "will see it until that branch merges" src/daemon/hooks.ts | grep -v '^\s*[0-9]*:\s*\(//\|\*\)'; echo "exit: $?"
```

- [ ] Cases 1–8 each seen red before green (case 3, 4 and 8 are guards against change and are green throughout — say so), recorded in the handoff.
- [ ] Case 1 uses `518252a` and the branch name from the ticket, not invented ones.

---

### Sub-phase 43e: The written process says where a run's status file goes

**[MODIFY]** `process.md` —
- The artifact table (:70-71): `STATUS.md` "lives on the default branch only" becomes: written by a run on its work branch, and by a person's own session on the default branch (see Status reporting below).
- § Status reporting (:109): replace the paragraph "It is written only on the project's default branch — never on a work branch …" with a marked revision — `✏ Revised <date> ([timone#85](https://github.com/fvermaut/timone/issues/85), [ADR-0060](doc/adr/0060-…) D2)` — saying, in plain words: **in a run, a step that owns a work branch writes `STATUS.md` on that branch, in its own `docs: STATUS.md — <theme>` commit, and it reaches the default branch with the pull request; a step that owns no branch writes no `STATUS.md` and commits nothing to the project — its account is its comment on the ticket; nothing a run does is pushed to the default branch, and the push is refused if it tries.** A session a person runs by hand writes it on the default branch, as before. Keep the "accepted consequence" sentence about naming which branch and pull request each item belongs to, and add the cost from this plan's Goal Description: the default branch's copy shows a run's work only once its pull request merges, and two open pull requests that both change it clash at the second merge. Keep the earlier ruling visible as history (struck or quoted with its date), as the house style does for revised rules.
- § Status reporting (:111): "the artifacts on a work branch as much as `STATUS.md` on the default branch" becomes "… as much as `STATUS.md`".
**[MODIFY]** `.claude/skills/timone-verify/SKILL.md` (:307) and `.claude/skills/timone-deliver/SKILL.md` (:262) — the "Status reporting" sections: in a run, on the phase's work branch, in its own commit; when a person runs the skill by hand, on the default branch as before, returning the clone to the work branch afterwards. Delivery's sentence "the PR's own branch never gains a `STATUS.md` edit" goes, since in a run it now does.
**[MODIFY]** `.claude/skills/timone-wayfind/SKILL.md` (:167, :178) — "Update `STATUS.md`" becomes "per the process convention", which for a run with no branch means none.
**[MODIFY]** `src/daemon/prompts.ts` — the prompt for each stage that owns no branch (triage, clarification, wayfinding, research) gains one sentence: this step has no work branch, so it commits and pushes nothing to the project, and what it did goes in its comment on the ticket.
**[NEW FILE]** `src/process-text.test.ts` — reads `process.md` and every `.claude/skills/*/SKILL.md` from the repository root.
**[MODIFY]** `src/daemon/prompts.test.ts`.

**Seams under test (TDD):** two. The **text a session follows** is the observable end for the process change, because nothing in `src/` writes `STATUS.md`: a step session does, from `process.md` and its skill. `process-text.test.ts` reads those files as a session would. And the stage prompts, through the existing exported prompt builders in `prompts.ts`. Red-green:
1. No file among `process.md` and `.claude/skills/*/SKILL.md` contains "written only on the project's default branch" or "on the project's default branch, never on the phase branch" outside a struck or dated-history passage (strike-through `~~…~~` lines are excluded). Red today: three files carry them.
2. `process.md`'s § Status reporting says a run writes `STATUS.md` on its work branch, and that a step with no branch writes none — asserted on two short exact phrases the slice chooses and quotes in the handoff.
3. The verify and deliver skills' "Status reporting" sections each mention the work branch for a run.
4. The triage, clarification, wayfinding and research prompts each carry the sentence that the step commits nothing to the project; the planning and execution prompts do not.

> Sub-phases 43a–43d must be complete before starting this sub-phase (the text describes the refusal they build and the finding's new wording).

**Write it for a reader who knows nothing about the process,** per [Writing to the human](../../../process.md#writing-to-the-human) — the skills are read by sessions, but `process.md` is read by fvermaut.

#### Agent Validation Steps

```bash
npm run build
npx vitest run src/process-text.test.ts src/daemon/prompts.test.ts
# The whole suite once, at the close of the phase.
npx vitest run
npx tsc --noEmit
```

- [ ] Cases 1–4 each seen red before green, recorded in the handoff.
- [ ] The whole suite and the type check pass.
- [ ] No requirement file under `doc/specs/prd/` is changed by any slice of this phase (`git diff --stat origin/main -- doc/specs/prd/` is empty): the runner's instructions were not to change requirements.

---

## Dependency graph

```
43a → (none)        a run's git push reaches its own work branch only — the part that matters most
43b → 43a           the same for forge calls through gh; extends 43a's guard directory and env
43c → 43a           the box says which run it is; refuses the commands that switch the guard off
43d → 43c           checkStatusPlacement reports a run's default-branch commit; messages name the work branch
43e → 43a–43d       process.md, two skills and the branchless prompts say where a run's status file goes
```

43b and 43c both edit `src/daemon/container-runtime.ts` and `src/commands/guardrails.ts`, so they run one after the other, in either order. Nothing in this phase runs in parallel.
