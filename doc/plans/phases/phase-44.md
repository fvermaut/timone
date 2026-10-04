# Phase 44: Numbered files never take the same number — the `number` command, the push guard that lets it reserve, the prompts that find a branch's own phase file, and the skills that use it

> **Status:** Complete — see [reports/phase-44-complete.md](reports/phase-44-complete.md).

> **Companion phases:** [phase 43](phase-43.md) — built the push guard (`src/daemon/push-guard.ts`, `pushRefusal`) that 44b widens, and its real-git tests in `src/daemon/push-guard.test.ts`, which 44b adds to; its open question Q3 (a step with no work branch cannot push a record it writes) is named below and not answered here; its 43e was also the last change to `src/daemon/prompts.ts`, which 44c corrects. Governing decisions: [ADR-0062](../../adr/0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md) — recorded while planning this phase; every slice builds one of its parts (D1–D4 in 44a, D5 in 44b, its consequence on "the newest phase file" in 44c, D3's "no skill counts files" in 44d). [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — each run has its own clone, so the remote is the only thing two runs share, which is why the reservation lives there. [ADR-0060](../../adr/0060-a-runner-decides-each-step-and-nothing-merges-without-a-persons-yes.md) D2 and [PRD-05.R3](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person) — 44b must widen the guard by exactly one kind of push and leave the default branch as closed as it is. [ADR-0051](../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md) D4 — decides which checks this phase owes, below. [ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md) — the command works in `projects/<name>`, Timone's own checkout, never in a person's.

> **Screens changed:** none — no slice changes anything a person sees.

## Requirements

> **PRD:** [prd-07-several-tickets-of-one-project-at-once.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.md) — criteria in [prd-07-several-tickets-of-one-project-at-once.criteria.md](../../specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-07.R8 | MUST | Clause 1 only: two tickets of one project worked at the same time never give a phase file, an ADR or a triage record the same number |

R8's clauses 2 and 3 (`STATUS.md` and the requirement registers after a merge) are piece 2 of the [list of pieces for #197](../breakdowns/ticket-197.md) and are not planned here. R8 stays `draft` after this phase: verification may record clause 1 as passing, but the register's status covers all three clauses.

## Goal Description

Every skill that writes a numbered file says: list the folder, take the highest number, use the next. With one ticket of a project worked at a time that is safe. PRD-07 lets several be worked at once, each in its own box with its own clone cut from the default branch, so two plans written at the same moment both take phase 44. The list of pieces puts this first because the pieces after it make it happen ([ticket-197.md](../breakdowns/ticket-197.md), piece 1). **No code in `src/` picks a number today.** The numbers are picked by sessions, following five skills: `timone-plan` (phase files), `timone-adr` and `timone-onboard` (ADRs), `timone-triage` (triage records) and `timone-prd` (PRDs). So the fix is a command that reserves a number safely, plus those five skills telling a session to use it.

[ADR-0062](../../adr/0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md) records the choice, made while planning because the plan could not be written without it: a number is reserved by creating the ref `refs/timone/numbers/<kind>/<number>` on the project's remote, which the server does for exactly one of two sessions that try at once. **Checked at planning with git 2.43 against a bare repository:** ten pushes started at the same moment to the same new ref gave exactly one success and nine refusals; a second push of a different commit to an existing ref is refused as "non-fast-forward", exit 1. And two reservation commits made from the same message in the same second are the *same* commit, so a push of the second would report success while reserving nothing. That last fact is why 44a puts a random line in every reservation message, and why it has a test.

**The cut.** 44a builds the command and is the part that delivers R8: its test runs several reservations at once from separate clones and fails if two get the same number, which is R8's falsifier. 44b lets a run's push guard pass the one push 44a makes; without it the command is refused inside every box, because the guard allows a run's own work branch and nothing else. 44c changes two prompt lines that find "the newest phase file" on a branch: once numbers are reserved, phase 45 can merge before phase 44, and a branch brought level with the default branch would then build or check another ticket's plan. 44d changes the five skills and `process.md` last, so that no session is sent to a command that does not exist yet.

**Decisions taken at planning, below the ADR bar.** Each was checked against the three-part test.

- **The command is `node dist/cli.js number <project> <kind>`, kinds `phase`, `adr`, `triage`, `prd`.** A name and an argument list, changed in one place: not hard to reverse. PRDs are not named by the ticket but are added beside the three it names: R8's scope paragraph says "documents numbered by taking the next free number", and two PRDs written at once with the same number would also give their requirements the same IDs (`PRD-08.R1`), which is worse than a clash of file names.
- **Left out, with reasons.** Breakdowns are named after their ticket and cannot clash. Prototype branches (`prototype/NN-…`) are branches: pushing one whose name is taken already fails. Wayfinding maps under `doc/wayfinder/` are a fallback for a project not on GitHub, and every managed project is on GitHub. Feedback records under `doc/feedback/` are written by no skill today.
- **The first number tried also counts files in the checkout's own folder**, besides every remote branch and every reservation (ADR-0062 D2). A session that wrote a file the old way and has not pushed it is then not overtaken. One more list to read; no trade-off.
- **The command tries at most 100 numbers in a row, then stops with a sentence.** 100 sessions racing for numbers on one project does not happen; a loop with no end would hide a fault. A constant, and not tested: reaching it needs 100 sessions racing.
- **The reservation commit is made with no local ref.** It is pushed by its commit name, so no branch in the checkout points at it, and the Stop check (which reads local branches, `branchTips` in `src/daemon/hooks.ts`) never sees it and never asks it for a trailer.

**What this phase owes before delivery.** ADR-0051 D4 narrows the checks to criteria whose `Depends-on` this phase touches. Among `verified` MUST criteria, the `live` ones [PRD-01.R10](../../specs/prd/prd-01-process-layer.criteria.md) (`.claude/skills/timone-plan/`) and PRD-02 R1, R2, R4 and R8 (`src/daemon/`) depend on files this phase changes, so **a live gate is owed before delivery.** A live gate also gives the one fact no test here can: that GitHub accepts a push to `refs/timone/numbers/…` from the box's App token (ADR-0062, consequences). If only the operator can run it, it rides to the pull request ([ADR-0059](../../adr/0059-a-live-check-only-the-operator-can-run-rides-to-the-pull-request.md)). [PRD-05.R3](../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md#r3--nothing-reaches-a-default-branch-without-a-yes-from-a-named-person) (`api`, `verified`) carries no `Depends-on`; 44b changes the code it rests on, so the push guard's existing tests are a hard gate in 44b, not a courtesy.

**What is not done here.** A step with no work branch (triage among them) cannot push a record it writes since phase 43 — that is [phase 43's Q3](phase-43.md), still open. 44b lets such a step reserve a number, so the number is safe if Q3 is ever answered by letting it commit; it does not answer Q3. This phase's own number (44) and its ADR's (0062) were taken the old way, because the command does not exist yet; no other branch of the project carried a phase file or an ADR when they were taken.

## Context & Prerequisites

- **The five skills and their numbering lines:** `.claude/skills/timone-plan/SKILL.md` § Numbering (:140); `.claude/skills/timone-adr/SKILL.md` § Numbering (:37-40); `.claude/skills/timone-triage/SKILL.md` step 1 (:80); `.claude/skills/timone-prd/SKILL.md` (:44); `.claude/skills/timone-onboard/SKILL.md` (:162, :189). These are Timone's own source, in this repository.
- **`process.md`** — the artifact tree (:74-91) names every numbered path and says nothing about how a number is chosen.
- **`src/cli.ts`** — `buildProgram` (:72-92) registers one `register…Command(program)` per file under `src/commands/`. `src/commands/workspace.ts` shows the house pattern for a command that loads `timone.yaml` (`--manifest <path>`, default `timone.yaml`, `loadManifest`) and resolves a project's checkout with `resolve(cwd, project.path)` (:50). `src/commands/takeover.ts:166-167` shows the unknown-project sentence that lists the known names.
- **`src/git.ts`** — `runGit` (:18) runs git without a shell and throws with git's own words; it is module-private, so 44a either exports it or keeps its own small runner in the new module, as `src/daemon/hooks.ts:925` does.
- **`src/daemon/push-guard.ts`** — `pushRefusal(updates, workBranch)` (:39-67): a step with no work branch may push nothing; a run may push only `refs/heads/<workBranch>` and never a deletion (`NO_COMMIT`). `RefUpdate` carries `remoteSha`, which git sets to all zeros when the ref does not exist on the remote. `installPushGuard` (:181) and the real-git tests (`push-guard.test.ts:154-267`) show how a test pushes through the guard.
- **`src/daemon/prompts.ts`** — `verificationPrompt` (:444, the line at :463) and the build prompt (:563) both say "the newest phase file under `doc/plans/phases/` on that branch". `src/runner/facts.ts:156` already finds the phase files a branch *added* (`addedOn`), which is the correct reading; the prompts are the only place left saying "newest". The comment at `src/adapters/ticketing.ts:414` says "the newest phase file" about the same reads.
- **`src/process-text.test.ts`** — reads `process.md` and every `SKILL.md` as a session would, with struck passages removed (`unstruck`). 44d adds to it.
- **Which names count.** `doc/plans/phases/phase-NN.md` counts; files in the `reports` and `probes` subfolders of `doc/plans/phases/` do not. ADRs `doc/adr/NNNN-<slug>.md`; triage `doc/triage/NNN-<slug>.md`; PRDs `doc/specs/prd/prd-NN-<slug>.md` and its `.criteria.md` (the same number).
- **Never run the command against `projects/timone` or any real remote while building or validating.** Every test and every validation step uses temporary repositories with a bare repository as the remote. A reservation on the real remote is permanent (ADR-0062 D4).

## Sub-phases

### Sub-phase 44a: `timone number` reserves a number that no other session can get

**[NEW FILE]** `src/numbers.ts` — the kinds, their folders, patterns and padding; reading the highest number taken; and `reserveNumber`.
**[NEW FILE]** `src/numbers.test.ts` — the cases below, against temporary repositories with a bare remote.
**[NEW FILE]** `src/commands/number.ts` — `registerNumberCommand(program)`.
**[NEW FILE]** `src/commands/number.test.ts` — the command's cases below.
**[MODIFY]** `src/cli.ts` — import and call `registerNumberCommand(program)` in `buildProgram`.
**[MODIFY]** `src/guards/checkouts.test.ts` — ✏ 2026-10-04 (build, timone#199): add `numbers.ts` to `GIT_USERS` and `commands/number.ts` to `EXEMPT`, each with its reason. The guard refuses any source file that runs git, or resolves a manifest project's `path`, unless one of its two lists names it. `reserveNumber` runs git in `projects/<name>`, and the command resolves that folder, so the full suite cannot pass without these two entries. The reason given: the command is run by a session in its own checkout, never by the daemon; it changes no file, no branch and no local ref there, only the remote-tracking refs a fetch updates. The command resolves the folder as `resolve(cwd, project.path)`, the spelling of `workspace.ts`, so that the guard sees it.

**Seams under test (TDD):** two seams. `reserveNumber(dir, kind, options?)` is the seam for the behaviour: it is the public function every caller goes through, and a test observes it only by what it returns and what the bare remote holds afterwards, never by how it reads. The `number` command, through `buildProgram().parseAsync([...])` with a temporary `timone.yaml`, is the seam for what a session sees: the printed number, the exit code and the sentences. Red-green:

1. A project with no file and no reservation of the kind gets `01` for `phase`, `0001` for `adr`, `001` for `triage`, `01` for `prd`.
2. With `phase-43.md` on the default branch it gets `44`; `reports/phase-43-complete.md` and `reports/phase-50-delivery.md` do not count. `prd-07-x.md` with `prd-07-x.criteria.md` gives `08`.
3. A file only on another branch of the remote (`phase-45.md` on `timone/9-x`, pushed from a second clone after the first clone was made) gives `46`.
4. A file only in the checkout's own folder, not committed, gives one above it.
5. An existing reservation `refs/timone/numbers/phase/47` and nothing higher gives `48`; a reservation of another kind (`adr/0090`) does not change a `phase` answer.
6. **Several at once (R8's falsifier):** five clones of one bare remote call `reserveNumber(clone, "phase")` together (`Promise.all`); the five answers are all different, and the remote holds exactly five new refs under `refs/timone/numbers/phase/`, one per answer. The same for `adr` and `triage`. The test's comment names the R8 clause it falsifies.
7. Two reservations from the same clone in the same second, with the same note, get two different numbers (the random line in the message; see the Goal Description).
8. After a reservation the checkout is as it was: same current branch, same `git status --porcelain`, and no local ref points at the reservation commit (`git for-each-ref --points-at <sha>` prints nothing).
9. When the push fails for a reason other than the number being taken — the remote path does not exist, or a `pre-push` hook in the clone refuses — `reserveNumber` throws an error whose message carries git's own words, and the remote holds no new reservation. It never answers with a number it did not reserve.
10. Command: `number <project> <kind>` with a temporary manifest prints only the padded number and a newline, exit 0. Unknown project → one sentence naming the known projects, exit 1. Unknown kind → one sentence naming `phase, adr, triage, prd`, exit 1, checked before any git command (shown by pointing the manifest at a project path that does not exist and still getting the kind sentence). A failing reservation → the error sentence on stderr, nothing on stdout, exit 1.

✏ 2026-10-04 (build, timone#199): the command's seam is `registerNumberCommand` on a fresh `Command`, as `src/commands/projects.test.ts` does, not `buildProgram().parseAsync`. Importing `src/cli.ts` runs `buildProgram().parseAsync(process.argv)` when the module loads, and no test imports it.

> No dependency on other sub-phases.

`reserveNumber(dir: string, kind: NumberKind, options?: { note?: string }): Promise<string>` returns the padded number. In order:

1. `git fetch --quiet --prune origin` in `dir`.
2. The highest number of the kind among: the names under the kind's folder on every `refs/remotes/origin/*` ref (`git ls-tree --name-only <ref> -- <folder>/`, skipping `origin/HEAD`), the names in the checkout's own folder on disk, and the refs from `git ls-remote origin 'refs/timone/numbers/<kind>/*'`. Numbers are read with each kind's pattern only (`^phase-(\d+)\.md$`, `^(\d{4})-`, `^(\d{3})-`, `^prd-(\d+)-`), never from a subfolder.
3. From one above it: make a commit with `git mktree < /dev/null` for the tree, no parent, and the message `Reserve <kind> <number>`, a blank line, the note (default: `for <TIMONE_RUN_BRANCH>` when that variable is set, else `for a session run by hand`), and a line `nonce: <random hex>`. Push it with `git push --porcelain origin <sha>:refs/timone/numbers/<kind>/<number>`. Success is exit 0 **and** a porcelain line starting `*` for that ref (a new ref). Anything else: read `git ls-remote origin refs/timone/numbers/<kind>/<number>` again. If the ref now exists, the number is taken — try the next. If it does not, the push failed for another reason — throw with git's words.
4. At most 100 tries, then throw a sentence saying how many numbers were tried.

The padding is two digits for `phase` and `prd`, four for `adr`, three for `triage`, and a number past the width simply grows (`100`), as phases do today.

#### Agent Validation Steps

```bash
cd projects/timone   # the project's checkout, wherever the build runs it
npx vitest run src/numbers.test.ts src/commands/number.test.ts
npm run type-check
npm run build
node dist/cli.js number --help; echo "exit: $?"                          # lists <project> <kind>; exit: 0
node dist/cli.js number nosuchproject phase; echo "exit: $?"            # one sentence naming the known projects; exit: 1
node dist/cli.js number timone chapter; echo "exit: $?"                 # one sentence naming phase, adr, triage, prd; exit: 1
git ls-remote origin 'refs/timone/*' | wc -l                            # 0 — nothing in this sub-phase reserved anything on the real remote
npm test
```

- [ ] Case 6 passes, and the handoff shows it failing first (red) against a version of `reserveNumber` that returns the next number without pushing.
- [ ] Case 7 passes, and the handoff shows it failing first against a message with no random line ~~.~~ ✏ 2026-10-04 (build, timone#199): **and no `*` check**. Step 3's own success rule (exit 0 *and* a `*` line) already stops a second push of the same commit from counting, so removing only the random line cannot turn case 7 red. The two safeguards each cover the case; the red is shown with both removed, and the handoff shows each one alone keeping it green.
- [ ] The `ls-remote` line prints `0`.
- [ ] The full suite passes.

---

### Sub-phase 44b: a run's push guard lets it create a reservation, and nothing more

**[MODIFY]** `src/daemon/push-guard.ts` — `pushRefusal` allows an update whose `remoteRef` matches `^refs/timone/numbers/(phase|adr|triage|prd)/\d+$`, whose `remoteSha` is all zeros (the ref does not exist yet) and whose `localSha` is not all zeros (not a deletion) — for every step, with or without a work branch. Every other rule stays as it is. The refusal sentences stay as they are; they do not mention reservations.
**[MODIFY]** `src/daemon/push-guard.test.ts` — the cases below.

**Seams under test (TDD):** `pushRefusal` is the seam for the rule — pure, and every push in a box passes through it. The real-git describe block "a run's git push, with the guard switched on" (`push-guard.test.ts:154`) is the seam for the effect: `reserveNumber` from 44a, run in a temporary clone with the guard installed by `installPushGuard`, against a bare remote. Red-green:

1. `pushRefusal` allows creating `refs/timone/numbers/phase/44` for a run with a work branch, and for a step with no work branch.
2. It refuses moving an existing reservation (`remoteSha` not zero), deleting one (`localSha` zero), a ref under `refs/timone/` outside `numbers/` (`refs/timone/other/1`), an unknown kind (`refs/timone/numbers/chapter/1`), and a number with anything but digits (`refs/timone/numbers/phase/44a`).
3. A push carrying one reservation and one update to the default branch is refused whole (the guard's rule that every update has to be allowed, or none goes).
4. With the guard switched on, `reserveNumber(clone, "phase")` succeeds and the bare remote holds the ref; a plain `git push origin HEAD:main` from the same clone, in the same test, is still refused.
5. **Hard gate:** every test that was in `push-guard.test.ts` and `forge-guard.test.ts` before this sub-phase passes, and none of them is edited.

> Sub-phase 44a must be complete before starting this sub-phase (case 4 calls `reserveNumber`).

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/push-guard.test.ts src/daemon/forge-guard.test.ts src/numbers.test.ts
git diff -U0 -- src/daemon/push-guard.test.ts | grep '^-[^-]'; echo "exit: $?"   # run before committing: no removed line, exit: 1
git diff --name-only -- src/daemon/forge-guard.test.ts | wc -l                   # 0
npm run type-check
npm test
```

- [ ] The removed-line probe prints nothing and `exit: 1`; the forge-guard probe prints `0`.
- [ ] The handoff shows case 1 failing first against the unchanged `pushRefusal`.
- [ ] The full suite passes.

---

### Sub-phase 44c: the build and the check find their own phase file by what the branch added

**[MODIFY]** `src/daemon/prompts.ts` — in `verificationPrompt` (:462-464) and the build prompt (:563-564), replace "the newest phase file under `doc/plans/phases/` on that branch" with "the phase file this branch added under `doc/plans/phases/` — the one the default branch does not have". The build prompt keeps its sentence telling the session to stop when there is no such file. The verification prompt keeps "its own status line tells you whether it is yours to verify".
**[MODIFY]** `src/adapters/ticketing.ts` — the comment at :414: "the newest phase file's `Status:` line" becomes "the `Status:` line of the phase file the branch added".
**[MODIFY]** `src/daemon/prompts.test.ts` — the cases below.

**Seams under test (TDD):** `stagePrompt` (exported, `src/daemon/prompts.ts:264`) is the seam: the prompt text is the whole of what the session is told, and the existing tests already read it this way. Red-green:

1. The `verification` and `execution` prompts each say "the phase file this branch added".
2. No prompt for any stage in `PROMPTED_STAGES` matches `/newest phase file/i`.

> No dependency on other sub-phases. It shares no file with 44a, 44b or 44d and may run beside them.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/daemon/prompts.test.ts
grep -rn "newest phase file" src --include=*.ts | grep -v '\.test\.ts:'; echo "exit: $?"   # no line; exit: 1
npm run type-check
npm test
```

- [ ] The grep prints nothing and `exit: 1`.
- [ ] The handoff shows case 2 failing first.
- [ ] The full suite passes.

---

### Sub-phase 44d: every skill that numbers a file takes its number from the command

**[MODIFY]** `.claude/skills/timone-plan/SKILL.md` § Numbering — the number comes from `node dist/cli.js number <name> phase`, which reserves it on the project's remote and prints it ([ADR-0062](../../adr/0062-a-numbered-file-takes-its-number-by-reserving-it-on-the-projects-remote.md)). Keep "never reused" and "never renumber". Say: if the command fails, stop and say so; never count the files instead. Mark the change `✏ <date> (ADR-0062)` and strike the old sentence (`~~…~~`), as the skills do.
**[MODIFY]** `.claude/skills/timone-adr/SKILL.md` § Numbering — the same, with `adr`. Its § Superseding step 1 "(next number)" becomes "(a number from the command)".
**[MODIFY]** `.claude/skills/timone-triage/SKILL.md` step 1 — the same, with `triage`. Creating the folder when it is missing stays.
**[MODIFY]** `.claude/skills/timone-prd/SKILL.md` (:44) — the same, with `prd`. "PRD numbering is independent of phase numbering" stays.
**[MODIFY]** `.claude/skills/timone-onboard/SKILL.md` (:162, :189) — each founding ADR takes its number from the command, `adr`; on a fresh project the first is `0001`.
**[MODIFY]** `process.md` — one paragraph after the artifact tree (:91): a file whose name carries a number (phase files, ADRs, triage records, PRDs) takes it from `node dist/cli.js number <project> <kind>`, which reserves it on the project's remote so two sessions never take the same one; a number is never taken by counting the files in a folder. Link ADR-0062. Mark it `✏ <date> (ADR-0062)`.
**[MODIFY]** `src/process-text.test.ts` — a new describe block, cases below.

**Seams under test (TDD):** the text a session follows is the seam, read as `src/process-text.test.ts` already reads it: `process.md` and every `SKILL.md`, with struck passages removed. Nothing in `src/` picks a number, so this text is what decides how a session numbers a file. Red-green:

1. Each of the five skills names `node dist/cli.js number` with its kind (`phase` in plan, `adr` in adr and onboard, `triage` in triage, `prd` in prd), and `process.md` names the command.
2. No unstruck text in `process.md` or any skill tells a session to find a number from a folder: none matches `/highest existing|take the highest|next available `?NN|use the next, zero-padded|Number sequentially/i`.
3. Each of the five skills says, in the same paragraph as `dist/cli.js number`, that a failing command stops the session (matches `/fails?/i`).

> Sub-phase 44a must be complete before starting this sub-phase (the text sends sessions to the command 44a builds, and the kinds must match its list).

No behaviour-carrying code changes in this sub-phase beyond the text test; the seam is the text itself, as above.

#### Agent Validation Steps

```bash
cd projects/timone
npx vitest run src/process-text.test.ts
grep -c "dist/cli.js number" .claude/skills/timone-plan/SKILL.md .claude/skills/timone-adr/SKILL.md .claude/skills/timone-triage/SKILL.md .claude/skills/timone-prd/SKILL.md .claude/skills/timone-onboard/SKILL.md process.md   # every file at least 1
npm test
```

- [ ] The handoff shows cases 1 and 2 failing first against the unchanged text.
- [ ] Each changed passage carries a dated `✏` mark naming ADR-0062, and the old sentence is struck, not deleted.
- [ ] Nothing outside the five skills, `process.md` and `src/process-text.test.ts` changes in this sub-phase, other than its own handoff section.

## Dependency graph

```
44a → (none)        the command that reserves a number; delivers R8 clause 1
44b → 44a           the push guard lets a run make that one push
44c → (none)        the prompts find the branch's own phase file, not the highest; may run beside 44a, 44b, 44d
44d → 44a           the five skills and process.md use the command
```
