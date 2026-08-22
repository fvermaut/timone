# Phase 30 — completion report

> **Plan:** [phase-30.md](../phase-30.md) · **Requirement:** [PRD-02.R23](../../../specs/prd/prd-02-inversion-of-control.criteria.md#r23--a-run-is-isolated-from-fvermauts-machine)
> **Built:** 2026-08-22, one session. **Status: eleven of twelve slices done.** 30k is half open and what is left needs fvermaut at the keyboard.

## What this phase set out to do

Stop a daemon-spawned run touching fvermaut's machine. Three things followed from it doing so, and this phase ends all three: his `git switch` and a running build fighting over one working tree; a stray agent holding the whole machine and every repository he can reach; and a run being unmovable because it depends on the state of one laptop.

## What is done

| Slice | State |
|---|---|
| 30a Timone's own identity | Done, watched live |
| 30b branch state from the forge | Done, watched live |
| 30c chunk zero merges on the forge | Done, watched live |
| 30d `projects/` becomes fvermaut's | Done, guard in the suite |
| 30e request describes a workspace | Done (before this session) |
| 30f version pin, dirty-checkout refusal | Done (before this session), refusal watched live |
| 30g the base image | Done (before this session), eight assertions watched |
| 30h the container runtime | Done, watched live |
| 30i the services beside it | Done, watched live |
| 30j Playwright in the box | Done, watched live both ways |
| 30k flip the default, live gate | **Half.** Default flipped, four of six checks watched |
| 30l close the phase | This report |

**1384 tests pass.**

## Which R23 clauses were observed live, and which were only tested

This is the section the slice asked for, and it is the honest split.

**Observed live:**

- **A session ran in a container**, from the image, cloning both repositories from the remotes. `Mounts: []`, `Binds: []`, `Privileged: false`; from inside, no `docker` on `PATH`, no `/var/run/docker.sock`, no `/Users`, zero mounts under `/workspace`, and `uid=1001` rather than root.
- **The browser leg is identical inside and outside the box.** `scratch-app`'s own accessibility suite — axe scan, keyboard traversal, reflow at 320 px and 200 % zoom — ran on commit `69ad47ed` twice: **22 passed in the box, 22 passed on the host, the same 22 test names.** A deliberately broken page took the box run to **3 failures, exactly the axe tests**, so the pass is not vacuous.
- **Services beside it, reached by name.** The project's real compose stack came up on a private network with nothing published; the suite reached `db:5432` by service name, migrated and seeded through it. fvermaut's own dev stack was running on the host at the same time, holding port 5433, and the two never met.
- **Authorship.** A comment on `scratch-app#45` and a two-parent chunk-zero merge commit, both authored by `timone-agent`. The merge still carries `Timone-Stage: breakdown`, so **R19 does not regress**.
- **The scoped credential.** From inside a box holding a `scratch-app` token, `ivtrends` answers **`Repository not found`** to both a clone and a push — invisible, not refused.
- **The dirty-checkout refusal**, firing and naming files, against this session's own uncommitted work.
- **The progress tick.** Live output tokens and the authoritative count agreed **exactly — 2731 against 2731**, where [timone#10](https://github.com/fvermaut/timone/issues/10) would show a thirtieth.

**Tested but not watched:**

- **Clause 2's own wording** — that across a whole daemon-driven run *no git operation touched `projects/<name>`*. The guard enforces it in the suite and every machine path was converted, but no daemon has driven a real ticket end to end under the boxed default. A weaker form was seen: after three boxed sessions and two stacks, `projects/scratch-app` was on `main` with an empty `git status`.
- **Two runs an hour apart holding the same timone commit.** Unit-covered; nobody has waited an hour.
- **R15's provenance check across a whole run.** It has fired wrongly four times in one session before, and this phase changes commit authorship — exactly what would set it off. Not yet watched.
- **Container teardown after a *failed* and a *killed* run.** Four exit paths are unit-covered and teardown after success was watched; the failure paths were not exercised live.

## What is left, and it is fvermaut's

1. **One real marked ticket on `scratch-app`, driven end to end** under the boxed default, with R15 watched across it.
2. **The human gate.** He switches branches in `projects/scratch-app` during a build, without warning anybody, and says whether he still has to think about it. That is the entire point of the phase and the one thing no test can assert.

## Decisions taken during the build

- **`hooks.ts` stays on ambient git** (30a). Every `git()` call in it is a local read that never reaches the forge, so routing it through a credential-carrying runner would mint a forge token for a call that makes no forge request. Case (2) names the paths the runner owns instead.
- **Blocker (d), CI: option (ii).** The guard is a vitest file, enforced at every session's `Stop` hook, not on GitHub. A workflow is fvermaut's to commit by hand — the App is deliberately installed without the Workflows permission, because a token that can rewrite `.github/workflows` can widen its own grant. **Still open.**
- **Blocker (e), the model credential: fvermaut chose his own subscription** over a separate API key. The token is read fresh at every spawn and cached nowhere. What it costs, plainly: while a box runs, a token that can spend his subscription is inside it.
- **An unpushed timone commit is refused before anything is created** (30k), rather than left as a readable failure.

## What running it found that reading it did not

Five faults, and the first three share a shape worth naming: **an absent answer and a wrong question look identical.**

1. A transport failure read as an absent branch, which reads as *the stage produced nothing* (30b).
2. `docker compose down` with no `COMPOSE_PROFILES` **exits 0 and removes nothing**; `--remove-orphans` does not save it (30i).
3. `listFiles` could not read a repository root, which made `scratch-app` look as though it committed no compose file. It does. The wrong reading reached the plan and a commit message before it was caught (30i).
4. **The box ran as root, and the CLI refuses `bypassPermissions` under root** — so the image could not have run a single session, and the failure mentions sudo rather than containers (30j).
5. **The environment never reached the container.** Setting a variable in the options handed to `spawn` sets it on the docker CLI's own process. Eleven tests asserted the environment was set and every one was right; none could see this (30j).

And one that would have made three later checks pass vacuously: **GitHub renders the same App two ways** — `timone-agent` on GraphQL, `timone-agent[bot]` on REST — and this code reads both surfaces (30a).

## A fault this phase's own guardrail caught, in this phase's own work

**Five commits on `scratch-app`'s `main` carry no `Timone-Stage:` trailer**, and they are mine: 30c's live check created and deleted marker files through GitHub's Contents API, whose `message` strings were written by hand. Filed as [timone#54](https://github.com/fvermaut/timone/issues/54).

- `0f738da`, `b7208ef` — marker files created on two fixture branches
- `3732431`, `69ad47e` — the same files deleted afterwards
- `48b1502` — a merge commit, from the one live check that passed a hand-written message instead of `mergeMessage(branch)`

**Timone's own machinery is not at fault, and that was checked rather than assumed.** The merge that went through the real code path — `ace8698`, built by `mergeMessage()` — carries `Timone-Stage: breakdown`. R19 does not regress. What went wrong is a hand-written script going around the machinery.

**Not fixed by amending, deliberately.** That would mean force-pushing rewritten history on a client repository's default branch. The marker files are already deleted, so nothing but commit messages would change — and the rewrite would invalidate shas this report, the plan and several commit messages cite as evidence, `69ad47ed` most of all, which is the commit 30j's two verification passes were compared on.

**The gap worth closing is named in the issue:** `mergeMessage()` exists because a *merge* through the forge needed a trailer, and nothing builds a message for any other kind of forge-API commit — while this phase has just made the forge the way this system writes to repositories.

**The `Stop` hook found this**, on real work rather than on a fixture, which is the R15 bracket doing its job.

## What was deleted

`mergeIntoDefault` and `mergeInProgress`, from `src/git.ts`, **last** — after the forge path had carried real traffic. **Nothing else in that file went with it**: the other seven exports keep `workspace sync` as their caller, which 30d went out of its way to preserve. Both `timone projects list` and `timone workspace sync` were run afterwards and work.

## Known limits

- **`ivtrends` commits no compose file**, so 30i refuses a boxed run on it. `scratch-app` is fine. Building `ivtrends` in a box needs that file first.
- **A boxed run needs the daemon's timone commit pushed.** Refused readably; it will bite the first time fvermaut runs a boxed daemon on unmerged work.
