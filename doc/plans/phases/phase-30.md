# Phase 30: The work happens in a box — a run stops touching fvermaut's machine

> **Status:** Planned. **Runs after [phase 29](phase-29.md) and before `ivtrends` restarts** — fvermaut's ordering of 2026-08-20, chosen over restarting `ivtrends` earlier on an unboxed pipeline.

> **Companion phases:** [phase-29](phase-29.md) — one step, one ticket; it changes the daemon's scheduling and this phase changes the daemon's *runtime*, so 29 lands first and this rebases onto it. [phase-14](phase-14.md) — provenance trailers and the R15 hooks, both of which change meaning here. Nothing in the preview machinery ([ADR-0021](../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)) is touched: previews are driven from `poll.ts` on the host and never from inside a session.
>
> Governing decisions:
> [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) — the box, what it is built from, and what it may not have;
> [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) — who it is;
> [ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md) — the folder it stops using;
> [ADR-0007](../../adr/0007-sessions-at-timone-root.md) and [ADR-0003](../../adr/0003-local-daemon-agent-runtime.md) are **amended, not replaced** — sessions still run at a timone root, and the daemon still lives on fvermaut's hardware.

## ✏ Refined 2026-08-20 — blockers found at pre-flight

A pre-flight run of this plan against the tree found four things that stop work before a line is written. They are **recorded here and not resolved**; nothing below them has been changed to work around them.

**Blocker (a) — the machine account does not exist.** Nothing in `timone.yaml`, nothing in `src/manifest.ts`, and nothing anywhere else in the codebase references a forge account for Timone, a credential source, or a field in which either could be declared. The "Human prerequisite" recorded below is therefore not merely first in order — it is unstarted, and its absence is not visible from the code because there is no half-built shape waiting for it. It blocks **30a**, and through 30a it blocks **30b**, **30c** and **30d**; it blocks **30k** and **30l**. **There is no code substitute.** No seam, fake or fixture makes a run comment, push or merge as an identity that has not been created, and the live checks in 30a, 30c, 30d and 30k are all observations of that identity acting.

> **✏ Refined 2026-08-21 — the blocker stands; the thing that clears it is a GitHub App, not an account.** fvermaut ruled on 2026-08-21 that Timone's identity is a **GitHub App installed on the managed repositories**, not a second forge account invited to them ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). Nothing above changes in force: it is still unstarted, still invisible from the code, still blocks the same six slices, and there is still no code substitute. What changes is the act and its output:
>
> - ~~Create an account, and invite it to every repository in `timone.yaml`.~~ **Create the App once, then install it and select the repositories** — the same list `timone.yaml` declares. **The invitation step is removed**; there is no collaborator to add and no mailbox to own. Adding a project later edits the installation's repository selection.
> - The output is an **App id and a private key**, not a hand-scoped token. The key is placed under `.timone/`, which `.gitignore` already excludes as daemon machine state — so it cannot ride into a client repository, and it does not make timone's own checkout dirty, which matters because **30f** refuses to spawn on a dirty checkout.
> - The identity that appears on the forge is **`timone[bot]`**. Every live check in 30a, 30c, 30d and 30k is an observation of *that* name acting.
> - **The App's permission set is a choice nobody has made.** Installing it means granting issues, contents, pull requests and whatever else, and that grant is the ceiling for every future run. Recorded here, deliberately unanswered: it is fvermaut's to decide when he installs, and it should be decided rather than accepted from a default.

**Blocker (b) — R23's wording is unconfirmed.** `doc/specs/prd/prd-02-inversion-of-control.criteria.md:504` carries R23 at `Status: draft`, and `:505` says in as many words that it was "drafted from fvermaut's seven rulings … and awaiting his confirmation of the wording … Nothing is built. No clause has machinery." This file's own Requirements note says R23 "is his to confirm before execution starts". Read strictly — and it should be read strictly, because R23 is the requirement the whole phase exists to satisfy — **(b) gates the entire phase**, including the slices that have no code dependency on anything. It is a five-minute human act blocking twelve slices, which makes it the cheapest thing on this list and the first to clear.

**Blocker (c) — the three network defects were unfiled. ✏ Cleared 2026-08-20: they are filed.** 30b's `[FIX FIRST]` line makes filing them a precondition of starting that slice. At pre-flight `gh issue list --state all` returned 41 issues and **none of them was any of these three**; they are now [#47](https://github.com/fvermaut/timone/issues/47) (no timeout), [#48](https://github.com/fvermaut/timone/issues/48) (no retry) and [#49](https://github.com/fvermaut/timone/issues/49) (a slow cycle read as an absent daemon), each labelled `bug`. **A fourth was found in the same pass and filed with them** — [#50](https://github.com/fvermaut/timone/issues/50), the swallowed error of amendment 8 below, which is 30b's own red-green case (3) failing one level above the adapter. This blocker is cleared; the *fixing* remains 30b's or 30c's. They are not vague: each is identifiable code today.

- **No timeout.** `src/adapters/command-runner.ts:53-57` calls `execFileAsync` with `maxBuffer`, `cwd` and `env` and no `timeout`, no `signal`, no `killSignal` — and node's `execFile` default timeout is `0`, meaning never. The same gap repeats at `src/git.ts:20-24`, at `src/daemon/session.ts:375,389,414,444,460`, and at `src/daemon/hooks.ts:552`. A hung `gh` hangs the cycle that called it, indefinitely.
- **No retry.** `command-runner.ts:47-69` is a single attempt that throws. Grepping `retry|backoff|attempt` in `github-tickets.ts` returns nothing. The only retry in the system is `DEFAULT_LINK_RETRY_WAITS_MS` (`session.ts:165`), which re-runs a **whole stage session** on a *model* link failure — it is not a forge-call retry and cannot stand in for one.
- **A slow cycle read as an absent daemon.** `src/daemon/runs.ts:974-1001` — `witness()` computes `gapMs` between successive `observedAt` stamps, that is, between cycle *ends*. A cycle whose own body is slow is therefore arithmetically identical to a daemon that was not running. The threshold is `unwitnessedAfterMs = UNWITNESSED_POLL_INTERVALS * pollIntervalMs` with `UNWITNESSED_POLL_INTERVALS = 2` (`poll.ts:215`, `poll.ts:522`). The consequence is `observingSince` resetting and `mayJudge` going false (`runs.ts:996`, gating `poll.ts:525` and `:757`), and the log printing "the daemon was not running for Xm" (`poll.ts:700-703`) — **a false statement**, written by the machine, about itself.

**30b and 30c increase forge traffic per cycle and so make the third defect more likely**, exactly as this file's own context bullet warns. Filing is the precondition; fixing is 30b or 30c's, per that bullet.

**Blocker (d) — there is no CI.** `.github/` does not exist: no workflow, no runner, no `npm test` invoked anywhere outside a human's terminal and the `Stop` hook in `.claude/settings.json`. 30d's `[NEW FILE]` says its guard is "run in CI alongside the tests". See the refinement under 30d for the two options and the choice that is owed.

**What is actually startable.** **30e and 30g are blocked only by (b)**, and depend on nothing in code. 30e's anchor `session.ts:64` is exact and its gate `npm run build && npm test` is a real, non-vacuous, currently-green command. 30g needs only the `.dockerignore` correction recorded under it. **30f, 30h, 30i and 30j unblock behind those two and never need (a) at all.** 30a, 30b, 30c, 30d, 30k and 30l are every one of them blocked by (a). **This inverts the closing paragraph of this file**, which says "if the phase has to stop somewhere, it stops after 30d": 30a–30d is the *most* blocked branch of the graph, and the security half the plan calls the optional one is the half that can actually begin.

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

**The slice with a human prerequisite is 30a**, and nothing downstream of it works until fvermaut has ~~created the machine account and invited it to the managed repositories~~ **created the GitHub App and installed it on the managed repositories** (**✏ Refined 2026-08-21**, [ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md) as amended — installation replaces invitation). It is the first thing to ask for and it is not a code task.

**The daemon runs against real projects while this is built.** `scratch-app` is the fixture; every live exercise runs there. `ivtrends` is idle, unmarked and deliberately out of the way, and it stays that way until this phase closes.

## Context & Prerequisites

~~**Human prerequisite, blocking 30a:** a forge account for Timone, invited to every repository in `timone.yaml`, and whatever mints a per-repository short-lived credential from it. Roughly an hour of fvermaut's time.~~ **Ask for this on day one, not when 30a is otherwise finished.**

> **✏ Refined 2026-08-21 — replacing the struck line above.** **Human prerequisite, blocking 30a:** a **GitHub App** for Timone, **installed** on the repositories declared in `timone.yaml`, with its **App id recorded and its private key saved under `.timone/`**. Roughly an hour of fvermaut's time, and **there is no "invite it to each repo" step** — installation *is* the grant, and selecting repositories *is* the scoping. The App mints the per-repository short-lived credential itself, so the "whatever mints it" of the old line is no longer an open shape: it is a JWT signed with the private key, exchanged for an installation access token that expires in an hour ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). The identity that shows up on the forge is **`timone[bot]`**.

- **`src/daemon/session.ts:183`** — `SessionRuntime`, one method. This is where the box plugs in; the phase adds an implementation and does not reshape the interface more than 30e requires.
- **`src/daemon/session.ts:64`** — `SessionRequest`. Today `{ cwd, prompt, model, effort }`. `cwd` is a host path and is exactly the field that stops making sense in a box.
- **`src/daemon/session.ts:1692`** — `agentSdkRuntime`, the in-process implementation. It stays, and it is what interactive and fallback paths keep using.
- **`src/daemon/session.ts:1159`** — `this.options.repoProbe ?? gitBranchHead`, and **`:1476`** — `this.options.mergeProbe ?? mergeIntoDefault`. Two seams that already exist, whose *defaults* are the disk. 30b and 30c change the defaults, not the seams.
- **`src/git.ts:148`** — `mergeIntoDefault`, and the whole file: every function in it operates on a local directory.
- **`src/adapters/github-tickets.ts`** — `gh` invoked as a bare binary at `:257`, `:297`, `:329`, `:348`, `:383` and elsewhere, authenticating as whoever is logged in. 30a's credential has to reach all of them, which is what makes `command-runner.ts` the right seam rather than each call site.
  - **✏ Refined 2026-08-20: the reason above is wrong; the conclusion it reaches is right.** `gh` is **not** invoked as a bare binary. All fourteen call sites go through an injected runner — `this.run`, the option declared at `github-tickets.ts:211`, the field at `:227`, defaulting to `execCommandRunner` at `:232` — and the five line anchors quoted above are exact. So `command-runner.ts` is the right seam because the seam **already exists and every call site already reaches it**, not because the call sites are unseamed. Same conclusion, opposite reason, and the difference matters: 30a is a substitution at one place, not fourteen rewrites.
  - **✏ Refined 2026-08-20: the wrong reason was hiding a real gap.** Nothing constructs the adapter *with* a runner. `src/commands/daemon.ts:215` builds `new GitHubTicketingAdapter()` with no options at all, and `:250` builds `new DockerPreviewAdapter({ root })` likewise. **There is no path today from the CLI to an injected runner**, so a credential-carrying variant could be written, tested and never used in production without a single test failing. 30a has to add that path, and `src/commands/daemon.ts` is added to its `[MODIFY]` list below.
- **`src/adapters/docker-preview.ts`** — the precedent for driving docker from the daemon: compose profiles, `.env.example` interpolation, health waiting, ephemeral published ports. **30i should reuse its shape and probably some of its code.** It also fixes the convention that a project commits a compose file, which 30i now depends on for a second reason.
- **`src/daemon/progress.ts`** — `SessionProgress.observe`, fed today by iterating the SDK's in-process message stream. A boxed session has to get the same messages back across a process boundary; the shape of the answer is the CLI's streaming JSON on stdout, piped to the daemon and handed to the same `observe`.
- **`.claude/settings.json` and `src/daemon/hooks.ts`** — the R15 bracket. Inside a container the hooks still run and still matter; the path-containment rule becomes defence in depth rather than the only defence. **Nothing here is removed.**
- **`src/commands/workspace.ts`** — `workspace sync`. After 30d it is a convenience for fvermaut and a prerequisite for nothing.
- **Three unfiled network defects** — no timeout on `gh`, no retry on transport failure, and a slow cycle read as an absent daemon. 30b and 30c increase forge traffic and therefore exposure to all three. **File them before 30b, fix them in 30b or 30c**; discovering them under a rewritten merge path is the worst place to meet them.
  - **✏ Refined 2026-08-20:** still unfiled — see blocker (c) above, which now names the exact code behind each of the three so that filing is transcription rather than re-diagnosis.

> **✏ Refined 2026-08-20 — confirmed against the tree, do not re-check.** Everything this section guessed at was verified today and is exact:
>
> - **All seven cited anchors land where the plan says they do:** `session.ts:183`, `:64`, `:1692`, `:1159`, `:1476`; `git.ts:148`; and the five `gh` call sites in `github-tickets.ts` (`:257`, `:297`, `:329`, `:348`, `:383`). A slice may open these files at these lines and find what it was told to find.
> - **Every export in `src/git.ts` does take a local directory**, as claimed. That is precisely why the file is the boundary this phase moves, and it is also why 30l can delete so little of it — see the refinement there.
> - **`docker-preview.ts` is a sound precedent for 30i, and more directly than the bullet above claims.** Its test at `src/adapters/docker-preview.test.ts:32-70` builds a fake `CommandRunner` that records `{ command, args, options }` per invocation, with a `vector(command, verb)` helper for asserting against one recorded call. That fake is reusable as it stands for **30h's case (5)** ("nothing from the host filesystem is mounted, asserted on the arguments actually passed") and for **all five of 30i's cases**. Neither slice writes one from scratch.

## Sub-phases

### Sub-phase 30a: Timone's own identity, and a credential scoped to one repository

**[MODIFY]** `src/adapters/command-runner.ts` — a credential-carrying variant, so every `gh` and `git` invocation in the process runs as a declared identity rather than as whoever is logged in.
**[MODIFY]** `src/manifest.ts` / `timone.yaml` — where the machine account and its credential source are declared.
**[NEW FILE]** `src/adapters/credentials.ts` — mint a short-lived credential for **one** repository, behind a seam.
**[MODIFY]** ✏ **Refined 2026-08-20 — added:** `src/commands/daemon.ts`. `:215` constructs `new GitHubTicketingAdapter()` with no options and `:250` `new DockerPreviewAdapter({ root })` the same, so nothing in the CLI can hand either one a credential-carrying runner. **The wiring is part of this slice**: without it the variant exists, passes its unit tests, and is never reached in production.

**Seams under test (TDD):** the credential provider, and the runner's use of it. Red-green: (1) a credential minted for project A carries no authority over project B — asserted on what is requested, since the forge's answer is not ours to fake; (2) a request with no credential configured fails loudly at spawn time, never falls back to ambient login; (3) the credential never appears in a log line, a ticket comment, or a progress tick; (4) `fromTimone` still identifies a machine comment when the author is the machine account, **and still identifies one when it is not** — the marker fallback stays.

> **✏ Refined 2026-08-21 — the identity is a GitHub App, and `credentials.ts` stops being a shape to invent.** fvermaut ruled on 2026-08-21 that Timone is a **GitHub App installed on the managed repositories**, not an account invited to them ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). Three consequences land on this slice:
>
> - **`src/adapters/credentials.ts` now has a concrete job**, in three steps that are all documented platform calls rather than design work: **sign a JWT with the App private key**, **exchange it for an installation access token scoped to the target repository**, and **cache it for its one-hour life** so a cycle does not re-mint per call. That is the whole of the seam. The private key is read from `.timone/`, which `.gitignore` already covers.
> - **`src/manifest.ts` / `timone.yaml` declare an App id and a key path, not an account name** — and there is no per-repository invitation to record anywhere, because the installation carries that.
> - **Red-green case (1) becomes directly assertable**, and this is the part worth saying out loud. It was written defensively — *"asserted on what is requested, since the forge's answer is not ours to fake"* — because on an account shape, authority is a property of the account's memberships and a unit test can only ever inspect the request. Under an App, **the repository scope is a parameter of the mint request itself**, so a test asserts on the argument vector that a token minted for project A named project A and nothing else. The hedge in the original wording stands, but it is no longer a compromise: what is requested *is* the mechanism.
>
> **What is still not proven, and this slice must not assume it:** that `timone[bot]` can be **assigned to an issue** end to end. The schema supports it — `Issue.assignedActors`, an `Assignee` union admitting `Bot`, and the `replaceActorsForAssignable` mutation, all verified on `fvermaut/scratch-app` on 2026-08-21 — but nothing has been assigned, because that needs the App installed. [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3 rests on it and so does the whole of phase 29. **The first thing done with the freshly installed App is to assign it to one issue on `scratch-app` and read it back.**

> **✏ Refined 2026-08-20: "every `gh` and `git` invocation in the process" is false as written, and closing the gap is a decision this slice owes.** Three modules spawn git directly through `execFileAsync` and never touch `CommandRunner` at all: **`src/git.ts:18-38`** (`runGit`, which is `mergeIntoDefault`'s spawner and which **pushes** at `git.ts:185`); **`src/daemon/session.ts:375,389,414,444,460`** (the five probe implementations); and **`src/daemon/hooks.ts:552`**. Two of the three close as a side effect of this phase — 30c removes `git.ts`'s only machine caller and 30b replaces the `session.ts` probes — but **`hooks.ts` keeps spawning ambient git**, and red-green case (2) above ("a request with no credential configured fails loudly at spawn time, never falls back to ambient login") **is not enforceable across a codebase that still holds an un-seamed spawn point**. Either 30a widens to route `hooks.ts:552` through the runner, or case (2) narrows to the paths the runner actually owns and says which those are. **The choice is owed and is deliberately not made here.**

> Depends on the human prerequisite above and on nothing in code.
> **✏ Refined 2026-08-20:** that prerequisite is blocker (a) — unstarted, with nothing in `timone.yaml` or `src/manifest.ts` to build on.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/adapters/credentials.test.ts src/adapters/command-runner.test.ts
```

- [ ] Red→green trace for all four cases, each seen failing first
- [ ] `grep` the built output and a full daemon log for the credential string — zero hits
- [ ] One live comment on `scratch-app` appears under the machine account, and [timone#19](https://github.com/fvermaut/timone/issues/19) is checked against it before being closed
- [ ] ✏ **Refined 2026-08-20 — the command above reports a non-zero test count.** `vitest.config.ts:5` sets `passWithNoTests: true` globally, so run today this exact command prints `No test files found, exiting with code 0`: a green exit that asserts nothing. Read the count, not the exit code. Here that is expected only until the two test files exist.
- [ ] ✏ **Refined 2026-08-20 — [timone#19](https://github.com/fvermaut/timone/issues/19) is already closed**, which makes the item above unfalsifiable as written. It was closed `2026-08-20T19:12:04Z` as `COMPLETED` — the same day this plan was written, with no machine account existing and no code written. Its body still reads: "The real fix is a separate account for the machine. That needs a credential from you." **Reopen it before this slice starts**, or rewrite the item to check the live observation rather than the act of closing. Same correction applies to 30l's second checklist item.

---

### Sub-phase 30b: Branch state comes from the forge

**[MODIFY]** `src/daemon/session.ts:1159` — the default `repoProbe` becomes a forge query.
**[MODIFY]** `src/adapters/ticketing.ts` (or a sibling repository adapter) — read a branch's tip.
**[FIX FIRST]** the `gh` timeout and transport-retry defects, filed as issues before this slice starts.
**[MODIFY]** ✏ **Refined 2026-08-20 — added:** `src/daemon/session.ts:1160-1164`, the try/catch around the `repoProbe` call. See the case (3) refinement below.

**Seams under test (TDD):** the adapter call, against recorded fixtures. Red-green: (1) a known branch returns its tip; (2) an absent branch returns `undefined` and is not an error — that is how "this stage produced nothing" is currently detected and the distinction must survive; (3) a transport failure is retried and then reported, never rendered as an absent branch, which would read as a stage that silently did no work.

> **✏ Refined 2026-08-20: the `[MODIFY]` list under-counts this by eight files.** `TicketingAdapter` (`src/adapters/ticketing.ts:259-394`) has **no repository operation at all** — eleven methods, every one of them issues, pull requests or labels. So "read a branch's tip" is a **new capability on the interface**, not a new argument to an existing method, and 30c's "merge through the forge" is a second one. Between them they change the interface, `GitHubTicketingAdapter`, and **every fake in nine test files**: `src/daemon/poll.test.ts`, `src/daemon/session.test.ts`, `src/daemon/hooks.test.ts`, `src/commands/daemon.test.ts`, `src/commands/takeover.test.ts`, `src/commands/retry.test.ts`, `src/commands/guardrails.test.ts`, `src/adapters/github-tickets.test.ts`, `src/adapters/github-pulls.test.ts`. Budget for nine fakes, and expect the compiler to find them all at once the moment the interface widens.

> **✏ Refined 2026-08-20: case (3) already fails one level above the adapter, and this slice fixes that too.** `src/daemon/session.ts:1160-1164` wraps the `repoProbe` call in a try/catch that **swallows the error into `undefined`**. A transport failure is therefore *today* indistinguishable from an absent branch — which is exactly the confusion case (3) exists to forbid. Fixing the adapter alone changes nothing observable: the caller erases the new distinction on its way out. **Case (3) is asserted at the caller, not only at the adapter.**

> Depends on 30a for the credential. Parallel with nothing — 30c wants it done.
> **✏ Refined 2026-08-20:** and therefore on blocker (a). The `[FIX FIRST]` line is blocker (c): none of the three defects is filed.

#### Agent Validation Steps

```bash
# ✏ Refined 2026-08-20 — superseded: `npm run build && npm test -- ticketing`.
# That filter matches no test file: no test path in this repo contains the
# string "ticketing" (the tests are src/adapters/github-tickets.test.ts and
# src/adapters/github-pulls.test.ts). With `passWithNoTests: true` at
# vitest.config.ts:5 it prints "No test files found, exiting with code 0" —
# and unlike 30a's and 30h's commands this one stays vacuous *permanently*,
# green on zero tests even after the slice is fully written.
npm run build && npx vitest run src/adapters/github-tickets.test.ts
```

- [ ] Red→green trace for all three cases
- [ ] Case (3) asserted with a simulated transport failure, not a comment claiming it cannot happen
- [ ] No test in this slice reaches the network
- [ ] ✏ **Refined 2026-08-20 — the command reports a non-zero test count.** Exit code 0 from vitest means nothing on its own here; read the number of tests it says it ran.
- [ ] ✏ **Refined 2026-08-20 — the full suite passes**, and the only assertions that changed are the nine fakes gaining the new method. This is 30b's counterpart to 30e's "passes unchanged": the widening is expected to touch fakes and nothing else, so a changed assertion anywhere but those nine files means the change leaked past the seam.

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

> **✏ Refined 2026-08-20: the guard needs at least four exemptions, not one, and case (2) is false as the slice is written.** "No machine code path performs a git operation under `projects/`" is contradicted today by three further machine paths, and **the first two of them must survive this phase**:
>
> - **The R15 guardrail.** `src/daemon/hooks.ts:635` (`captureBaseline`) and `:796` (`collectEvidence`) both build `join(root, "projects", name)` and hand it to `git()` at `hooks.ts:552`. This file's own context bullet says of the R15 bracket: "**Nothing here is removed.**" The guard cannot forbid what the phase promises to keep.
> - **The preview adapter.** `src/adapters/docker-preview.ts:332` — `repoPath()` returns `join(root, project.path)`, and it drives `git worktree remove` (`:148`), `git fetch` (`:208`), `git checkout --detach` (`:212`), `git worktree add` (`:214`) and again at `:320`. Those write into `projects/<name>/.git`. This file's opening note says the preview machinery is not touched.
> - **`src/daemon/poll.ts:1765`** — `checkoutOf(root, project)`, feeding `timone status` and the breakdown reader.
>
> So the assertion the guard actually enforces is "no machine code path performs a git operation under `projects/` **except `workspace sync`, the R15 hooks, the preview adapter, and `poll.ts`'s `checkoutOf`**" — four names, and **red-green case (3) has to prove narrowness against four exemptions rather than the single one it is written around**. Case (2) becomes true only once all four are named; run against the tree as shipped with one exemption, it fails. **Say this plainly, because it lands on the slice this plan calls the one that fixes the problem that was actually reported:** 30d is not a wall, it is a wall with four doors, and what it buys is the difference between four known doors and an unknown number.

> **✏ Refined 2026-08-20: there is no CI for this guard to run in.** `.github/` does not exist — no workflow, no runner, and `npm test` is invoked nowhere outside a human's terminal and the `Stop` hook in `.claude/settings.json`. The `[NEW FILE]` line above says the guard is "run in CI alongside the tests", and that is not currently possible. Two options: **(i)** 30d also creates a workflow — unplanned and unscoped work, needing a runner with git and node because the suite drives real git and takes about 85 seconds; or **(ii)** the guard is a vitest file only, which is a materially weaker promise than the slice's wording and should be reworded rather than left to imply an enforcement that does not exist. **The choice is owed and is deliberately not made here.** This is blocker (d).

> Depends on 30b and 30c — they are what remove the calls this guard then forbids.
> **✏ Refined 2026-08-20:** and therefore on blocker (a), through 30b.

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

> **✏ Refined 2026-08-20:** [timone#9](https://github.com/fvermaut/timone/issues/9) was confirmed **open** at pre-flight, exactly as this slice assumes. **Nobody needs to re-check its state** — go straight to the interaction. Note the contrast with [timone#19](https://github.com/fvermaut/timone/issues/19) under 30a, which was *not* as assumed.

---

### Sub-phase 30g: The base image

**[NEW FILE]** a Dockerfile for the agent's box: node, the toolchain, `gh`, the Claude Code CLI, and the browsers, on Playwright's published base so the browser dependencies are the vendor's problem and not ours.
**[NEW FILE]** ✏ **Refined 2026-08-20 — added: `.dockerignore`.** There is none, and the validation command below builds with the timone root as its context — which means the daemon would hand docker `node_modules/`, `dist/`, `.timone/` (previews and `state.json`), `daemon.log`, four PNGs, and **`projects/`, which is every client repository on the machine**. Baking client source into an image layer is the exact opposite of what [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) asks of this image. Either this file lands with the Dockerfile or the build runs from a subdirectory context; the file is the smaller change and the one this slice takes.

**No docker CLI and no docker socket go into this image**, and that absence is asserted rather than assumed ([ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D3).

**Seams under test:** the image is not unit-testable and this slice does not pretend otherwise. What is asserted, in a script run against a built image: (1) the CLI answers `--version`; (2) `gh` is present; (3) each browser launches headless; (4) `docker` is **absent** and `/var/run/docker.sock` does not exist; (5) shared memory is sized so Chromium does not die on a real page — the default is too small and the failure looks like an unrelated crash.

> Depends on nothing in code. May run in parallel with 30a–30f.

#### Agent Validation Steps

```bash
# ✏ Refined 2026-08-20 — superseded:
#   docker build -t timone-agent . && docker run --rm timone-agent /bin/sh -c 'node -v && gh --version && ! command -v docker'
# It proved three of the five assertions and silently skipped the other three:
# each browser launching headless, /var/run/docker.sock being absent, and the
# /dev/shm sizing. The checkbox "all five assertions run" was therefore not
# true of the command it sat under. Widened, and split so the browser leg is
# the script this slice already promises rather than a shell one-liner:

docker build -t timone-agent .                      # .dockerignore must exist first

# assertions (1), (2), (4) and the reading for (5):
docker run --rm timone-agent /bin/sh -c '
  node -v &&
  gh --version &&
  claude --version &&
  ! command -v docker &&
  ! test -e /var/run/docker.sock &&
  df -h /dev/shm
'

# assertion (3), and (5) proved rather than read — the script the slice writes,
# launching each browser headless and loading one real page in each:
docker run --rm timone-agent node /opt/timone/image-check.mjs
```

- [ ] All five assertions run against the built image and recorded
- [ ] Image build time and size recorded — the startup cost of every future run starts here
- [ ] ✏ **Refined 2026-08-20 — `.dockerignore` exists before the first build is run**, and the build context size is recorded next to the image size. A context in the hundreds of megabytes means it did not take effect and `projects/` went into the build.
- [ ] ✏ **Refined 2026-08-20 — assertion (5) is a number compared against a floor, not a `df` line pasted into a report.** Chromium dying on a real page is what this assertion exists to prevent, and the failure looks like an unrelated crash, so the browser leg has to load a page rather than just launch.

---

### Sub-phase 30h: The container runtime

**[NEW FILE]** `src/daemon/container-runtime.ts` — a second `SessionRuntime`. Start a container from 30g's image, clone both repositories per 30e's request, run the session, stream its messages back to the daemon, return the outcome, destroy the container.

**Chosen by configuration and off by default in this slice.** The in-process runtime stays the default until 30k.

> **✏ Refined 2026-08-20: "chosen by configuration" is a thing this slice has to build, because no seam for it exists and no slice owned it.** `runtime` is a **non-optional constructor argument** — `AgentSessionSpawnerOptions.runtime`, `src/daemon/session.ts:191` — and it is hard-coded at the single production wiring site, `src/commands/daemon.ts:224` (imported at `:21`). There is nothing to set. So "chosen by configuration and off by default" means a new CLI flag or manifest key, its plumbing down to that one site, and its default — **added to this slice's scope**, small but not free, and invisible until somebody looks for the switch and finds none. Two request build sites must keep working across the change, both passing `cwd: root`: **`session.ts:794`** and **`session.ts:1417`**.

Progress is the part that is easy to get wrong: `SessionProgress.observe` is fed today by iterating an in-process stream, and it must be fed identically across a pipe. A runtime that returns an outcome but reports no progress is a run nobody can watch, which is how [R17](../../specs/prd/prd-02-inversion-of-control.criteria.md#r17--the-daemon-shows-progress-while-a-session-runs) regresses without anybody noticing.

> **✏ Refined 2026-08-20: two named hazards under that paragraph, both of them code the plan does not name.**
>
> - **There is no entry point for a message that arrived as text.** `SessionProgress.observe` (`src/daemon/progress.ts:90`) is typed to the SDK's `SDKMessage` and has exactly **one** feeder: `src/daemon/session.ts:1730-1731`, iterating `query({...})`. There is no `fromJson`, no `observeRaw`, nothing that takes a line off a pipe. A boxed CLI's stdout JSON therefore has to be parsed **and typed** into `SDKMessage` before it can reach `observe` — and that parser is a new, untyped-at-the-boundary surface which this slice must write and test, not a plumbing detail.
> - **The only honest token source depends on a flag that is easy to omit.** `observeStreamEvent` (`progress.ts:144`) is where real token counts come from, and it is fed only when `includePartialMessages: true` — whose absence `session.ts:1698-1704` already documents as making "the progress line report about a thirtieth of the truth". **A boxed CLI launched without the equivalent flag reproduces [timone#10](https://github.com/fvermaut/timone/issues/10) silently**, and R17 still looks satisfied because the tick still moves. Case (1)'s "same snapshot as the in-process path for the same input" only catches this if the fixture contains partial-message events; make sure it does.

**Seams under test (TDD):** the runtime, against a fake container command runner. Red-green: (1) messages arriving on the pipe reach `observe` in order and produce the same snapshot as the in-process path for the same input; (2) a container that exits non-zero returns a failed outcome carrying its reason, not a thrown error; (3) a container killed mid-run resolves rather than hanging — a run that never resolves holds its project forever; (4) the container is destroyed on every exit path, including the failure ones; (5) nothing from the host filesystem is mounted, asserted on the arguments actually passed.

> Depends on 30e, 30f, 30g.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/container-runtime.test.ts
```

- [ ] Red→green trace for all five cases
- [ ] One real session run in a box on `scratch-app` with the ticker watched live — the tick must move, and its numbers must be comparable to an in-process run of the same stage
- [ ] `docker ps -a` after a failed run and after a killed run: no container left behind either time
- [ ] ✏ **Refined 2026-08-20 — the command above reports a non-zero test count.** With `passWithNoTests: true` at `vitest.config.ts:5` it prints `No test files found, exiting with code 0` until `container-runtime.test.ts` exists; a green exit before that point says nothing at all. Read the count, not the exit code.
- [ ] ✏ **Refined 2026-08-20 — the runtime switch is exercised both ways**: default off reaches the in-process runtime, the flag or key on reaches the container runtime, asserted at `src/commands/daemon.ts`'s wiring and not only in a unit test of the runtime itself.

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

> **✏ Refined 2026-08-20 — two small things, neither one blocking.** The command `npx vitest run src/daemon && npm test` is **redundant**: `npm test` is a strict superset of the first half. Harmless, kept as written, but the first half buys nothing except a slightly earlier failure. And **case (4) needs confirming before it is asserted**: `ivtrends` carries `preview: docker` in `timone.yaml`, while this plan states it commits no compose file. One of those two is wrong. Settle which before the refusal is written, or the first thing the new refusal does is contradict the manifest.
> The fake `CommandRunner` at `src/adapters/docker-preview.test.ts:32-70` covers all five of this slice's cases as it stands — see the confirmed note under Context & Prerequisites.

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

> **✏ Refined 2026-08-20: this slice has no `Agent Validation Steps` command block, and every other slice in this phase has one.** process.md stage 5 requires copy-pasteable validation commands per sub-phase. The comparison this slice is built around — two real verification reports, produced and diffed — is not a gate until a named command produces both and diffs them; as written, "the two reports diffed" is an instruction to a human, and an executing agent has nothing to run. **The gap is recorded, not filled**: the command depends on how 30h and 30i end up invoking the verify stage inside the box, which is not settled. Write it when 30i closes, before this slice starts.

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

> **✏ Refined 2026-08-20: "whatever else no longer has a caller" is nothing else — delete less than that.** Only `mergeIntoDefault` loses its caller in this phase; its importers are `src/commands/workspace.ts:6-14` and `src/daemon/session.ts:8`, and 30c removes the second. The other seven exports of `src/git.ts` — `clone`, `isGitRepo`, `isClean`, `currentBranch`, `defaultBranch`, `fetch`, and the `MergeOutcome` type — **all keep `workspace sync` as their caller**, and 30d deliberately preserves `workspace sync` as fvermaut's own command. An agent reading the instruction as written, grepping for callers and finding only `workspace.ts`, could reasonably delete the file and break the command 30d just went out of its way to protect. **The instruction narrows to: delete `mergeIntoDefault`, and nothing else in `src/git.ts`.**

- [ ] The completion report says plainly which R23 clauses were observed live and which were only tested
- [ ] [timone#19](https://github.com/fvermaut/timone/issues/19) closed against observed evidence, not against the code having been written
- [ ] ✏ **Refined 2026-08-20 — the item above cannot be done as written: [timone#19](https://github.com/fvermaut/timone/issues/19) was already closed** on `2026-08-20T19:12:04Z` as `COMPLETED`, the same day this plan was written, with no machine account existing and no code written. It must be **reopened** (see 30a) or this item rewritten to record the observed evidence without depending on the closing being this phase's act.

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

> **✏ Refined 2026-08-20: true as a stopping rule, backwards as a starting one.** The paragraph above reads as though 30a–30d were the safe ground to reach first. At pre-flight it is the **most blocked branch of the graph**: every one of 30a, 30b, 30c and 30d waits on blocker (a), the machine account, which does not exist anywhere in the manifest or the code and which no code substitute can stand in for. **30e and 30g are blocked only by (b)**, the confirmation of R23's wording, and depend on nothing in code; **30f, 30h, 30i and 30j unblock behind them and never need (a) at all.** So the half this paragraph calls optional is the half that can actually begin, and the half it calls the priority cannot start until fvermaut spends the hour. Both statements can hold at once — start at 30e and 30g, stop after 30d — but only if the account is asked for on day one, as the Context section already says and as blocker (a) now makes concrete.
