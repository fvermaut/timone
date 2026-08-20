# Phase 30: The work happens in a box — a run stops touching fvermaut's machine

> **Status:** Planned. **Runs after [phase 29](phase-29.md) and before `ivtrends` restarts** — fvermaut's ordering of 2026-08-20, chosen over restarting `ivtrends` earlier on an unboxed pipeline.

> **Companion phases:** [phase-29](phase-29.md) — one step, one ticket; it changes the daemon's scheduling and this phase changes the daemon's *runtime*, so 29 lands first and this rebases onto it. [phase-14](phase-14.md) — provenance trailers and the R15 hooks, both of which change meaning here. Nothing in the preview machinery ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)) is touched: previews are driven from `poll.ts` on the host and never from inside a session.
>
> Governing decisions:
> [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — the box, what it is built from, and what it may not have;
> [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) — who it is;
> [ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md) — the folder it stops using;
> [ADR-0007](../../adr/0007-sessions-at-timone-root.md) and [ADR-0003](../../adr/0003-local-daemon-agent-runtime.md) are **amended, not replaced** — sessions still run at a timone root, and the daemon still lives on fvermaut's hardware.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md)
> — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID | Priority | Requirement (one line) |
| -- | -------- | ---------------------- |
| PRD-02.R23 | MUST | A run is isolated from fvermaut's machine — added 2026-08-20, `draft`, six clauses, no machinery |
| PRD-02.R15 | MUST | Post-session guardrail hooks — **must not regress**; the path-containment hook becomes the inner wall rather than the only one |
| PRD-02.R19 | MUST | Machine-authored commits are identifiable from git history — **must not regress**; this phase changes who authors them |

R23's wording was drafted from fvermaut's rulings and **is his to confirm before execution starts**. R15 and R19 are both `verified` today and both are touched by this phase; neither may lose its tick without somebody noticing.

## Goal Description

Today a daemon-spawned session runs inside the daemon's own process, at the timone root, and edits `projects/<name>/` — the folder fvermaut has open in an editor. It runs with `bypassPermissions` and it borrows his credentials, because there are none of its own anywhere in this codebase. Three things follow, and this phase ends all three: his `git switch` and a running build fight over one working tree; a stray agent has the whole machine and every repository he can reach; and a run cannot be moved anywhere, because it depends on the state of one laptop.

**The half that is easy to miss is the daemon's own git work.** It probes branch tips and merges into default branches *in the same folder*, through `gitBranchHead` and `mergeIntoDefault`. Boxing every session and stopping there would ship a promise that does not hold: a merge and a `git switch` would still collide, in a form nobody would recognise because no agent is visibly running. **Slices 30b, 30c and 30d are that half, and they come first** — they are also the ones that deliver the immediate relief, before a single container exists.

**The dangerous slice is 30c.** Merging is how work reaches a default branch, and one of the two merge paths — chunk zero's, from [ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2 — reaches it with no human having read a diff. Rewriting the hand that performs it is rewriting the most load-bearing unreviewed path in the system.

**The slice with a human prerequisite is 30a**, and nothing downstream of it works until fvermaut has created the machine account and invited it to the managed repositories. It is the first thing to ask for and it is not a code task.

**The daemon runs against real projects while this is built.** `scratch-app` is the fixture; every live exercise runs there. `ivtrends` is idle, unmarked and deliberately out of the way, and it stays that way until this phase closes.

## Context & Prerequisites

**Human prerequisite, blocking 30a:** a forge account for Timone, invited to every repository in `timone.yaml`, and whatever mints a per-repository short-lived credential from it. Roughly an hour of fvermaut's time. **Ask for this on day one, not when 30a is otherwise finished.**

- **`src/daemon/session.ts:183`** — `SessionRuntime`, one method. This is where the box plugs in; the phase adds an implementation and does not reshape the interface more than 30e requires.
- **`src/daemon/session.ts:64`** — `SessionRequest`. Today `{ cwd, prompt, model, effort }`. `cwd` is a host path and is exactly the field that stops making sense in a box.
- **`src/daemon/session.ts:1692`** — `agentSdkRuntime`, the in-process implementation. It stays, and it is what interactive and fallback paths keep using.
- **`src/daemon/session.ts:1159`** — `this.options.repoProbe ?? gitBranchHead`, and **`:1476`** — `this.options.mergeProbe ?? mergeIntoDefault`. Two seams that already exist, whose *defaults* are the disk. 30b and 30c change the defaults, not the seams.
- **`src/git.ts:148`** — `mergeIntoDefault`, and the whole file: every function in it operates on a local directory.
- **`src/adapters/github-tickets.ts`** — `gh` invoked as a bare binary at `:257`, `:297`, `:329`, `:348`, `:383` and elsewhere, authenticating as whoever is logged in. 30a's credential has to reach all of them, which is what makes `command-runner.ts` the right seam rather than each call site.
- **`src/adapters/docker-preview.ts`** — the precedent for driving docker from the daemon: compose profiles, `.env.example` interpolation, health waiting, ephemeral published ports. **30i should reuse its shape and probably some of its code.** It also fixes the convention that a project commits a compose file, which 30i now depends on for a second reason.
- **`src/daemon/progress.ts`** — `SessionProgress.observe`, fed today by iterating the SDK's in-process message stream. A boxed session has to get the same messages back across a process boundary; the shape of the answer is the CLI's streaming JSON on stdout, piped to the daemon and handed to the same `observe`.
- **`.claude/settings.json` and `src/daemon/hooks.ts`** — the R15 bracket. Inside a container the hooks still run and still matter; the path-containment rule becomes defence in depth rather than the only defence. **Nothing here is removed.**
- **`src/commands/workspace.ts`** — `workspace sync`. After 30d it is a convenience for fvermaut and a prerequisite for nothing.
- **Three unfiled network defects** — no timeout on `gh`, no retry on transport failure, and a slow cycle read as an absent daemon. 30b and 30c increase forge traffic and therefore exposure to all three. **File them before 30b, fix them in 30b or 30c**; discovering them under a rewritten merge path is the worst place to meet them.

## Sub-phases

### Sub-phase 30a: Timone's own identity, and a credential scoped to one repository

**[MODIFY]** `src/adapters/command-runner.ts` — a credential-carrying variant, so every `gh` and `git` invocation in the process runs as a declared identity rather than as whoever is logged in.
**[MODIFY]** `src/manifest.ts` / `timone.yaml` — where the machine account and its credential source are declared.
**[NEW FILE]** `src/adapters/credentials.ts` — mint a short-lived credential for **one** repository, behind a seam.

**Seams under test (TDD):** the credential provider, and the runner's use of it. Red-green: (1) a credential minted for project A carries no authority over project B — asserted on what is requested, since the forge's answer is not ours to fake; (2) a request with no credential configured fails loudly at spawn time, never falls back to ambient login; (3) the credential never appears in a log line, a ticket comment, or a progress tick; (4) `fromTimone` still identifies a machine comment when the author is the machine account, **and still identifies one when it is not** — the marker fallback stays.

> Depends on the human prerequisite above and on nothing in code.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/adapters/credentials.test.ts src/adapters/command-runner.test.ts
```

- [ ] Red→green trace for all four cases, each seen failing first
- [ ] `grep` the built output and a full daemon log for the credential string — zero hits
- [ ] One live comment on `scratch-app` appears under the machine account, and [timone#19](https://github.com/fvermaut/timone/issues/19) is checked against it before being closed

---

### Sub-phase 30b: Branch state comes from the forge

**[MODIFY]** `src/daemon/session.ts:1159` — the default `repoProbe` becomes a forge query.
**[MODIFY]** `src/adapters/ticketing.ts` (or a sibling repository adapter) — read a branch's tip.
**[FIX FIRST]** the `gh` timeout and transport-retry defects, filed as issues before this slice starts.

**Seams under test (TDD):** the adapter call, against recorded fixtures. Red-green: (1) a known branch returns its tip; (2) an absent branch returns `undefined` and is not an error — that is how "this stage produced nothing" is currently detected and the distinction must survive; (3) a transport failure is retried and then reported, never rendered as an absent branch, which would read as a stage that silently did no work.

> Depends on 30a for the credential. Parallel with nothing — 30c wants it done.

#### Agent Validation Steps

```bash
npm run build && npm test -- ticketing
```

- [ ] Red→green trace for all three cases
- [ ] Case (3) asserted with a simulated transport failure, not a comment claiming it cannot happen
- [ ] No test in this slice reaches the network

---

### Sub-phase 30c: Merging goes through the forge — both paths

**[MODIFY]** `src/daemon/session.ts:1476` — the default `mergeProbe` becomes a forge merge.
**[MODIFY]** `src/git.ts` — `mergeIntoDefault` loses its callers; it is not deleted in this slice.

Two paths, and both must land: **a step ticket's pull request**, and **chunk zero's merge with no pull request at all** ([ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2, [ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md) D3). It stays a merge with no pull request; only the hand changes.

**Seams under test (TDD):** the merge function. Red-green: (1) a clean merge reports the same `MergeOutcome` shape the pipeline already branches on; (2) a **conflict** is reported as a conflict — the forge refuses differently from a local git merge and the pipeline's existing handling must be re-checked against the new shape, not assumed; (3) the no-pull-request path merges the branch and opens no pull request; (4) a merge that has already happened is reported as such and does not fail the run.

> Depends on 30b.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/session.test.ts
```

- [ ] Red→green trace for all four cases
- [ ] The pipeline's existing conflict handling is exercised against the **new** outcome shape, and the old shape is proved gone rather than assumed
- [ ] On `scratch-app`, one real pull request merged this way, and one chunk-zero merge, both read on the forge afterwards

---

### Sub-phase 30d: `projects/` becomes fvermaut's, and a guard says so

**[MODIFY]** wherever a project path is resolved for machine use — it stops resolving.
**[NEW FILE]** a guard asserting **no machine code path performs a git operation under `projects/`**, run in CI alongside the tests.

This slice is where R23's second clause becomes true, and it is the one that fixes the problem that was actually reported. It costs hours, not days, and it delivers relief before any container exists.

**Seams under test (TDD):** the guard itself. Red-green: (1) the guard fails when a git call under `projects/` is reintroduced — proved by reintroducing one and watching it catch; (2) it passes on the tree as shipped; (3) `workspace sync` is exempt by name, being fvermaut's own command, and the exemption is narrow enough that adding a second caller does not slip through it.

> Depends on 30b and 30c — they are what remove the calls this guard then forbids.

#### Agent Validation Steps

```bash
npm run build && npm test
```

- [ ] Red→green trace, with case (1) demonstrated by an actual reintroduced call
- [ ] With the daemon running a real `scratch-app` ticket, `git status` and the reflog in `projects/scratch-app` show **no movement** across the whole run
- [ ] Branch switched in `projects/scratch-app` mid-run; the run finishes and the branch is where it was left

---

### Sub-phase 30e: A session request describes a workspace instead of a path

**[MODIFY]** `src/daemon/session.ts:64` — `SessionRequest` gains what to clone and at which versions: the two remotes, the target project's branch, and the timone commit.

`cwd` stays for the in-process runtime, which ignores the new field entirely. **No behaviour changes in this slice** — it exists so that 30h has something to be handed, and so that the change to the request shape is reviewable on its own rather than buried inside a new runtime.

**Seams under test (TDD):** the request builder. Red-green: (1) the request names the timone commit the daemon is running, not a branch name; (2) it names the target project's work branch; (3) the in-process runtime's behaviour is byte-identical before and after.

> Depends on nothing. May run in parallel with 30a–30d.

#### Agent Validation Steps

```bash
npm run build && npm test
```

- [ ] Red→green trace for all three cases
- [ ] The full suite passes unchanged — this slice is a widening, and a single altered assertion elsewhere means it was not

---

### Sub-phase 30f: The version pin, and the refusal to spawn on a dirty checkout

**[MODIFY]** the spawn path — resolve the daemon's own commit once per run and refuse to start when timone's checkout is dirty, saying which files.

[ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D2. The refusal is the load-bearing half: running pushed rules while fvermaut reads different ones on screen is the confusion the pin exists to prevent, and it is worse for being silent.

**Seams under test (TDD):** the resolver and the guard. Red-green: (1) a clean checkout yields its own commit; (2) a dirty checkout refuses, names the files, and spawns nothing; (3) an untracked file that is ignored does not count as dirty; (4) the pin is resolved **once per run** and not re-read mid-run.

> Depends on 30e.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon
```

- [ ] Red→green trace for all four cases
- [ ] The refusal message names files and is readable by somebody who does not know what a pin is
- [ ] Interaction with [timone#9](https://github.com/fvermaut/timone/issues/9) checked: that defect is about the guardrail blaming uncommitted work, and this slice adds a second thing that reacts to it — they must not double-report

---

### Sub-phase 30g: The base image

**[NEW FILE]** a Dockerfile for the agent's box: node, the toolchain, `gh`, the Claude Code CLI, and the browsers, on Playwright's published base so the browser dependencies are the vendor's problem and not ours.

**No docker CLI and no docker socket go into this image**, and that absence is asserted rather than assumed ([ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D3).

**Seams under test:** the image is not unit-testable and this slice does not pretend otherwise. What is asserted, in a script run against a built image: (1) the CLI answers `--version`; (2) `gh` is present; (3) each browser launches headless; (4) `docker` is **absent** and `/var/run/docker.sock` does not exist; (5) shared memory is sized so Chromium does not die on a real page — the default is too small and the failure looks like an unrelated crash.

> Depends on nothing in code. May run in parallel with 30a–30f.

#### Agent Validation Steps

```bash
docker build -t timone-agent . && docker run --rm timone-agent /bin/sh -c 'node -v && gh --version && ! command -v docker'
```

- [ ] All five assertions run against the built image and recorded
- [ ] Image build time and size recorded — the startup cost of every future run starts here

---

### Sub-phase 30h: The container runtime

**[NEW FILE]** `src/daemon/container-runtime.ts` — a second `SessionRuntime`. Start a container from 30g's image, clone both repositories per 30e's request, run the session, stream its messages back to the daemon, return the outcome, destroy the container.

**Chosen by configuration and off by default in this slice.** The in-process runtime stays the default until 30k.

Progress is the part that is easy to get wrong: `SessionProgress.observe` is fed today by iterating an in-process stream, and it must be fed identically across a pipe. A runtime that returns an outcome but reports no progress is a run nobody can watch, which is how [R17](../../specs/prd/prd-02-inversion-of-control.criteria.md#r17--the-daemon-shows-progress-while-a-session-runs) regresses without anybody noticing.

**Seams under test (TDD):** the runtime, against a fake container command runner. Red-green: (1) messages arriving on the pipe reach `observe` in order and produce the same snapshot as the in-process path for the same input; (2) a container that exits non-zero returns a failed outcome carrying its reason, not a thrown error; (3) a container killed mid-run resolves rather than hanging — a run that never resolves holds its project forever; (4) the container is destroyed on every exit path, including the failure ones; (5) nothing from the host filesystem is mounted, asserted on the arguments actually passed.

> Depends on 30e, 30f, 30g.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/container-runtime.test.ts
```

- [ ] Red→green trace for all five cases
- [ ] One real session run in a box on `scratch-app` with the ticker watched live — the tick must move, and its numbers must be comparable to an in-process run of the same stage
- [ ] `docker ps -a` after a failed run and after a killed run: no container left behind either time

---

### Sub-phase 30i: The services beside it

**[MODIFY]** the spawn path — bring the target project's compose stack up on a private network before the session, attach the agent's container to it, tear it down after.

Reuse `docker-preview.ts`'s shape: the same compose file, the same `.env.example` convention, the same health wait. **Ports are not published to the host**; the agent reaches services by name on the private network, which is the difference between this and a preview.

**Seams under test (TDD):** the bring-up, against a fake command runner. Red-green: (1) the stack comes up and is waited for before the session starts; (2) a stack that never becomes healthy fails the run with a readable reason rather than hanging a poll cycle; (3) teardown happens on every exit path; (4) a project with **no compose file** is refused at spawn with a message naming what it must commit — this is now a hard prerequisite for being built at all, and `ivtrends` does not satisfy it today; (5) two runs on different projects do not share a network.

> Depends on 30h.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon && npm test
```

- [ ] Red→green trace for all five cases
- [ ] On `scratch-app`, a real session reads and writes its database by name from inside the box
- [ ] `docker network ls` and `docker ps -a` clean after a passing run, a failing run and a killed run

---

### Sub-phase 30j: Playwright in the box, proven end to end

Run the verify stage's real browser leg inside the box against the stack from 30i: the accessibility scan, the keyboard-only pass, the reflow checks — the baseline legs that are unconditional for a user-facing deliverable.

This is a named slice because fvermaut asked the question directly and because a plausible-looking browser pass that silently degrades — a scan that finds nothing because the page never rendered — is worse than one that fails. **The pass must be compared against the same pass run outside a box on the same commit, and the findings must match.**

**Seams under test:** none new. The assertion is a comparison of two real verification reports.

> Depends on 30i.

#### Agent Validation Steps

- [ ] The same verification pass run in a box and on the host, same commit, and the two reports diffed — differences explained or fixed, never noted and moved past
- [ ] The server-start pattern the verify skill mandates — backgrounded, polled with `curl`, killed at the end — works unchanged inside the box
- [ ] A deliberately broken page produces a **failing** pass in the box, so the pass is proved non-vacuous

---

### Sub-phase 30k: Flip the default, and the live gate on `scratch-app`

The container runtime becomes the default for daemon-spawned sessions. Sessions fvermaut opens himself are untouched ([ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D5).

Then drive one real marked ticket on `scratch-app` end to end, and while it builds: **switch branch in `projects/scratch-app` and leave it there.**

> Depends on every preceding sub-phase.

- [ ] The run completes and the checkout is exactly where fvermaut left it — `git status` and the reflog both clean
- [ ] The container is inspected while running: no mounts from the host, no docker socket, no docker CLI
- [ ] A push attempted from inside the box to a **second** managed repository is refused
- [ ] The daemon is stopped with an uncommitted timone change and refuses to spawn, readably
- [ ] Comments and commits from the run are authored by the machine account; R15's provenance check is watched across the whole run and reports nothing false — it has fired wrongly four times in one session before, and changing commit authorship is exactly what would set it off again
- [ ] **Human gate:** fvermaut switches branches during a build, without warning anybody, and says whether he still has to think about it — which is the entire point of this phase and the one thing no test can assert

---

### Sub-phase 30l: Close the phase

**[MODIFY]** `STATUS.md`; the R23 marker with what was actually built and what was actually watched; the R15 and R19 markers if either moved. Delete `mergeIntoDefault` and whatever else in `src/git.ts` no longer has a caller — **last**, after the new path has carried real traffic.

- [ ] The completion report says plainly which R23 clauses were observed live and which were only tested
- [ ] [timone#19](https://github.com/fvermaut/timone/issues/19) closed against observed evidence, not against the code having been written

## Dependency graph

```
30a → human prerequisite   identity and a scoped credential
30b → 30a                  branch state from the forge
30c → 30b                  merging through the forge — both paths
30d → 30b, 30c             projects/ becomes fvermaut's, and a guard says so
30e → (none)               the request describes a workspace — parallel with 30a–30d
30f → 30e                  version pin, and the dirty-checkout refusal
30g → (none)               the base image — parallel with 30a–30f
30h → 30e, 30f, 30g        the container runtime, default off
30i → 30h                  the services beside it
30j → 30i                  Playwright in the box, proven
30k → 30a…30j              flip the default; the live gate
30l → 30a…30k              close, and delete what has no caller
```

**30a–30d deliver the relief; 30e–30j deliver the boundary.** If the phase has to stop somewhere, it stops after 30d with the reported problem fixed and the security half honestly unbuilt — not in the middle of 30h, where the daemon has two runtimes and neither is trusted.
