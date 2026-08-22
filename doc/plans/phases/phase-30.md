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

**Blocker (a) — the machine account does not exist. ~~NOT RESOLVED.~~ ✏ RESOLVED 2026-08-21 — read the block at the end of this blocker first; the App exists and is installed.** Nothing in `timone.yaml`, nothing in `src/manifest.ts`, and nothing anywhere else in the codebase references a forge account for Timone, a credential source, or a field in which either could be declared. The "Human prerequisite" recorded below is therefore not merely first in order — it is unstarted, and its absence is not visible from the code because there is no half-built shape waiting for it. It blocks **30a**, and through 30a it blocks **30b**, **30c** and **30d**; it blocks **30k** and **30l**. **There is no code substitute.** No seam, fake or fixture makes a run comment, push or merge as an identity that has not been created, and the live checks in 30a, 30c, 30d and 30k are all observations of that identity acting.

> **✏ Refined 2026-08-21 — the blocker stands; the thing that clears it is a GitHub App, not an account.** fvermaut ruled on 2026-08-21 that Timone's identity is a **GitHub App installed on the managed repositories**, not a second forge account invited to them ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). Nothing above changes in force: it is still unstarted, still invisible from the code, still blocks the same six slices, and there is still no code substitute. What changes is the act and its output:
>
> - ~~Create an account, and invite it to every repository in `timone.yaml`.~~ **Create the App once, then install it and select the repositories** — the same list `timone.yaml` declares. **The invitation step is removed**; there is no collaborator to add and no mailbox to own. Adding a project later edits the installation's repository selection.
> - The output is an **App id and a private key**, not a hand-scoped token. The key is placed under `.timone/`, which `.gitignore` already excludes as daemon machine state — so it cannot ride into a client repository, and it does not make timone's own checkout dirty, which matters because **30f** refuses to spawn on a dirty checkout.
> - The identity that appears on the forge is **`timone-agent[bot]`**. Every live check in 30a, 30c, 30d and 30k is an observation of *that* name acting.
> - ~~**The App's permission set is a choice nobody has made.** Installing it means granting issues, contents, pull requests and whatever else, and that grant is the ceiling for every future run. Recorded here, deliberately unanswered: it is fvermaut's to decide when he installs, and it should be decided rather than accepted from a default.~~ **✏ Resolved 2026-08-21** — he decided it, and the set is recorded below.

> **✏ RESOLVED 2026-08-21 — the App exists, it is installed, and two of R23's clause-5 halves were watched working before a line of this slice was written.** Everything above is kept as the record of what was missing for a day. What is true now:
>
> - **`timone-agent`, App ID `4670926`.** The bot login on the forge is **`timone-agent[bot]`** — note it is *not* `timone-agent[bot]`, which is what the amendments above and 30a's text guessed at; **every live check in 30a, 30c, 30d and 30k is an observation of `timone-agent[bot]` acting**, and a check written against the wrong login passes vacuously by finding nothing.
> - **Installed on `fvermaut`'s selected repositories, installation `155426497`.** Installation is the grant and the repository selection is the scoping, exactly as the amendment above predicts. Adding a project later edits that selection.
> - **The permission set, decided rather than defaulted:** `contents:write`, `issues:write`, `metadata:read`, `pull_requests:write`. **Withheld deliberately: Actions, Workflows, Administration, Members.** That is the ceiling for every future run, and it is what blocker (d)'s CI option (i) would have to be measured against — an App that cannot write workflows cannot install one, whoever writes the file.
> - **The private key is at `.timone/timone-agent.2026-08-21.private-key.pem`**, mode `600`. `.gitignore` already excludes `.timone/`, so it cannot ride into a client repository and it does not make timone's own checkout dirty — which matters because **30f** refuses to spawn on a dirty checkout.
>
> **Two things were observed live on the way, and they are evidence rather than test coverage.** Both are halves of [R23 clause 5](../../specs/prd/prd-02-inversion-of-control.criteria.md):
>
> - **Authorship.** A throwaway issue opened through an installation token was authored by **`timone-agent[bot]`**. The App acts under its own identity on the tracker; nothing renders it as `fvermaut`.
> - **Scoping, and this is the stronger of the two.** An installation token minted with `{"repositories": ["scratch-app"]}` returns **HTTP 200 on `scratch-app` and HTTP 404 on `ivtrends`** — both repositories being inside the same installation. **404, not 403.** The second repository is **invisible**, not merely refused, which is a better property than the blocker asked for: a token that cannot see a repository cannot be talked into acting on one by a confused agent, and there is no "permission denied" for an error message to leak the name into.
>
> **What this does not do is start any slice by itself.** 30a still owes its code and its tests — see the slice, where the same evidence is recorded against red-green case (1) and deliberately *not* counted as satisfying it.

**Blocker (b) — R23's wording is unconfirmed.** `doc/specs/prd/prd-02-inversion-of-control.criteria.md:504` carries R23 at `Status: draft`, and `:505` says in as many words that it was "drafted from fvermaut's seven rulings … and awaiting his confirmation of the wording … Nothing is built. No clause has machinery." This file's own Requirements note says R23 "is his to confirm before execution starts". Read strictly — and it should be read strictly, because R23 is the requirement the whole phase exists to satisfy — **(b) gates the entire phase**, including the slices that have no code dependency on anything. It is a five-minute human act blocking twelve slices, which makes it the cheapest thing on this list and the first to clear.

**Blocker (c) — the three network defects were unfiled. ✏ Cleared 2026-08-20: they are filed.** 30b's `[FIX FIRST]` line makes filing them a precondition of starting that slice. At pre-flight `gh issue list --state all` returned 41 issues and **none of them was any of these three**; they are now [#47](https://github.com/fvermaut/timone/issues/47) (no timeout), [#48](https://github.com/fvermaut/timone/issues/48) (no retry) and [#49](https://github.com/fvermaut/timone/issues/49) (a slow cycle read as an absent daemon), each labelled `bug`. **A fourth was found in the same pass and filed with them** — [#50](https://github.com/fvermaut/timone/issues/50), the swallowed error of amendment 8 below, which is 30b's own red-green case (3) failing one level above the adapter. This blocker is cleared; the *fixing* remains 30b's or 30c's. They are not vague: each is identifiable code today.

- **No timeout.** `src/adapters/command-runner.ts:53-57` calls `execFileAsync` with `maxBuffer`, `cwd` and `env` and no `timeout`, no `signal`, no `killSignal` — and node's `execFile` default timeout is `0`, meaning never. The same gap repeats at `src/git.ts:20-24`, at `src/daemon/session.ts:375,389,414,444,460`, and at `src/daemon/hooks.ts:552`. A hung `gh` hangs the cycle that called it, indefinitely.
- **No retry.** `command-runner.ts:47-69` is a single attempt that throws. Grepping `retry|backoff|attempt` in `github-tickets.ts` returns nothing. The only retry in the system is `DEFAULT_LINK_RETRY_WAITS_MS` (`session.ts:165`), which re-runs a **whole stage session** on a *model* link failure — it is not a forge-call retry and cannot stand in for one.
- **A slow cycle read as an absent daemon.** `src/daemon/runs.ts:974-1001` — `witness()` computes `gapMs` between successive `observedAt` stamps, that is, between cycle *ends*. A cycle whose own body is slow is therefore arithmetically identical to a daemon that was not running. The threshold is `unwitnessedAfterMs = UNWITNESSED_POLL_INTERVALS * pollIntervalMs` with `UNWITNESSED_POLL_INTERVALS = 2` (`poll.ts:215`, `poll.ts:522`). The consequence is `observingSince` resetting and `mayJudge` going false (`runs.ts:996`, gating `poll.ts:525` and `:757`), and the log printing "the daemon was not running for Xm" (`poll.ts:700-703`) — **a false statement**, written by the machine, about itself.

**30b and 30c increase forge traffic per cycle and so make the third defect more likely**, exactly as this file's own context bullet warns. Filing is the precondition; fixing is 30b or 30c's, per that bullet.

**Blocker (d) — there is no CI.** `.github/` does not exist: no workflow, no runner, no `npm test` invoked anywhere outside a human's terminal and the `Stop` hook in `.claude/settings.json`. 30d's `[NEW FILE]` says its guard is "run in CI alongside the tests". See the refinement under 30d for the two options and the choice that is owed.

> **✏ Refined 2026-08-21 — option (i) now costs a permission that was deliberately withheld.** The App is installed **without** the Workflows permission ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), as amended), on the stated ground that a token able to rewrite `.github/workflows` can widen its own grant on the next run. So *"30d also creates a workflow"* is no longer a thing the machine can do at all: it is either **fvermaut committing the workflow by hand**, or **widening the App's permissions** — which is the one grant most worth not making, since CI runs with whatever the workflow says and the workflow would then be machine-writable.
>
> That is not an argument against CI. It is an argument that **the workflow is a human artifact**, committed once by fvermaut, after which the machine can never alter it. Option (ii) — the guard as a vitest file only — remains available and needs nothing from anybody.
>
> **Still not resolved, and now with a clearer shape:** (i) fvermaut commits a workflow once and the guard runs in it; (ii) the guard is a vitest file and the slice's wording drops the CI claim. **Recorded, not chosen.**

**✏ Blocker (e) — the box cannot talk to the model. Found 2026-08-22 at 30j. ✅ RESOLVED the same day — fvermaut chose his own subscription. Read the block at the end of this blocker first.**

An in-process session inherits whatever the host is logged in as. A boxed one inherits nothing — that is the point of the box. Checked rather than assumed:

- `ANTHROPIC_API_KEY` is **not set** on the host, and nothing in `src/`, the `Dockerfile` or `docker/` passes any model credential to a session. Grepped; there are no hits at all.
- The host's Claude credentials are in the **macOS keychain**, which no container can reach. There is no file to read and nothing to hand over.

So **every boxed session would start, clone both repositories, and then fail to authenticate** — and it would fail *after* a container and a compose stack had been stood up, which is the expensive way to discover it. 30h and 30i are unaffected: neither needs the model, and both were watched working. **30j and 30k cannot run at all until this is answered**, because both are defined by a session that actually calls the model from inside the box.

Two answers, and the difference between them is billing rather than engineering:

- **(i) An API key.** `ANTHROPIC_API_KEY`, kept in `.timone/` beside the App key and passed into the box as an environment variable. Clean, no host state involved, and it is a **separate bill** from a Claude subscription.
- **(ii) The subscription's own token.** Read the OAuth token out of the keychain and pass it in as `CLAUDE_CODE_OAUTH_TOKEN`. Uses the plan already paid for, and puts a **long-lived host secret inside the box** — which is not what ADR-0041 forbids (it forbids the host's *filesystem*), but is a real widening of what a stray agent could take with it.

~~**Recorded, not chosen.** It is a credential and a bill, so it is not the machine's call.~~

> **✅ Resolved 2026-08-22 — fvermaut chose (ii), his own subscription, and it is built and watched working.**
>
> **The box borrows a live login; it is never given a lasting one.** `src/adapters/model-token.ts` reads the access token **fresh at every spawn** and caches it nowhere — not on disk, not in memory. The host's own CLI refreshes it about every six hours and a daemon runs for days, so a copy taken at start-up is stale before lunch; reading late is reading current. Nothing about it is written down, and it travels in the container's environment like the forge credential. It is read from the macOS keychain, with the credentials file preferred where a host has one, so the box is not macOS-only for no reason.
>
> **What the choice costs, said plainly:** while a box runs, a token that can spend fvermaut's subscription is inside it. That is the trade he took over a separate bill, and it is **not** what [ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) forbids — the ADR keeps the host's *filesystem* out of the box, which is still true.
>
> **A refusal stops the spawn rather than the session.** No login means no container is started at all, and a stack already up is taken back down — a box that clones two repositories and stands up a database before failing to authenticate has spent minutes to learn nothing. The message names the one step that fixes it: run `claude` once.
>
> **Two things the live run found, both invisible to every unit test:**
>
> - **The box ran as root, and the CLI refuses `bypassPermissions` under root.** Every daemon-spawned session uses it, so the image could not have run a single session — and the failure says *"cannot be used with root/sudo privileges"*, which mentions sudo rather than containers and names nothing about the image. The `Dockerfile` now creates `/workspace` owned by `pwuser` and ends `USER pwuser`; `docker/image-check.mjs` grew **two more checks** — not root, and the workspace is writable — because the property is invisible until a real session tries to start. Rebuilt; **all eight assertions pass.**
> - **The environment never reached the container.** Setting a variable in the options handed to `spawn` sets it on the **docker CLI's own process**, and docker does not forward its environment into a container. The box got an empty `TIMONE_REMOTE` and died on `fatal: repository '' does not exist`. Every variable is now declared as a bare `-e NAME` — **by name, never by value**, so no secret enters the argument vector, which is the property the credential tests assert. Eleven tests asserted the environment was set and every one of them was right; none of them could see this.

**What is actually startable.** **30e and 30g are blocked only by (b)**, and depend on nothing in code. 30e's anchor `session.ts:64` is exact and its gate `npm run build && npm test` is a real, non-vacuous, currently-green command. 30g needs only the `.dockerignore` correction recorded under it. **30f, 30h, 30i and 30j unblock behind those two and never need (a) at all.** ~~30a, 30b, 30c, 30d, 30k and 30l are every one of them blocked by (a).~~ **✏ Refined 2026-08-21: none of them is blocked by (a) any more** — the App is installed, and the six slices that waited on it now wait only on each other and on **(b)**, R23's wording, which is still fvermaut's five-minute confirmation and now the **only** human gate on this phase. **This inverts the closing paragraph of this file**, which says "if the phase has to stop somewhere, it stops after 30d": 30a–30d is the *most* blocked branch of the graph, and the security half the plan calls the optional one is the half that can actually begin.

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

> **✏ Refined 2026-08-21 — replacing the struck line above.** **Human prerequisite, blocking 30a:** a **GitHub App** for Timone, **installed** on the repositories declared in `timone.yaml`, with its **App id recorded and its private key saved under `.timone/`**. Roughly an hour of fvermaut's time, and **there is no "invite it to each repo" step** — installation *is* the grant, and selecting repositories *is* the scoping. The App mints the per-repository short-lived credential itself, so the "whatever mints it" of the old line is no longer an open shape: it is a JWT signed with the private key, exchanged for an installation access token that expires in an hour ([ADR-0042](../../adr/0042-timone-acts-under-its-own-identity.md), amended). The identity that shows up on the forge is **`timone-agent[bot]`**.
>
> **✏ Refined 2026-08-21 — done, and one detail of the line above is wrong.** The App exists and is installed: **App ID `4670926`, installation `155426497`**, key at `.timone/timone-agent.2026-08-21.private-key.pem`, permissions `contents:write, issues:write, metadata:read, pull_requests:write`. It took twenty minutes, not the hour budgeted. **The identity is `timone-agent[bot]`, not `timone-agent[bot]`** — the App was registered under the slug `timone-agent`, and every place in this plan that guessed at `timone-agent[bot]` names something that does not exist. Every live check in this phase reads the real login. Details and the two live observations are under **blocker (a)**; the mint recipe is under **30a**.

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
> ~~**What is still not proven, and this slice must not assume it:** that `timone-agent[bot]` can be **assigned to an issue** end to end. The schema supports it — `Issue.assignedActors`, an `Assignee` union admitting `Bot`, and the `replaceActorsForAssignable` mutation, all verified on `fvermaut/scratch-app` on 2026-08-21 — but nothing has been assigned, because that needs the App installed. [ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3 rests on it and so does the whole of phase 29. **The first thing done with the freshly installed App is to assign it to one issue on `scratch-app` and read it back.**~~
>
> **✏ Superseded 2026-08-21 (later the same day) — it was the first thing done, and the answer was no. It changes nothing in this slice.** A GitHub App's bot **cannot be assigned to an issue** by any route: `replaceActorsForAssignable` refuses an installation token outright (*"Assigning agents is not supported with GitHub App installation tokens"*), refuses fvermaut's user token too (*"Bot does not have access to the repository"*), REST `POST /issues/41/assignees` answers **403**, and `suggestedActors(capabilities: [CAN_BE_ASSIGNED])` returns `fvermaut` alone from either token. The transcript is [scratch-app#41](https://github.com/fvermaut/scratch-app/issues/41). That path is **reserved for GitHub's own registered coding agents**. [Phase 29](phase-29.md) moves its hold to a **label** and is unaffected — indeed it stops needing the App at all ([ADR-0044](../../adr/0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) D3, superseded block). **This slice never depended on assignment**; it is recorded here because this is where the check was ordered.

> **✏ Refined 2026-08-21 (later the same day) — the App is installed, and `credentials.ts` now has a recipe that was run by hand rather than a shape to design.** Blocker (a) is resolved and carries the identity's details; what matters to this file is the four steps, every one of them already exercised against `fvermaut/scratch-app`:
>
> 1. **Sign a JWT** with the key at `.timone/timone-agent.2026-08-21.private-key.pem` — **RS256**, `iss` = the App ID **`4670926`**, expiry **≤ 10 minutes** (GitHub rejects longer, and rejects a clock that runs fast — set `iat` a little in the past).
> 2. **POST it to `/app/installations/155426497/access_tokens`**, with a **`repositories` array naming one repository** and nothing else. That array *is* the scoping, and it is the whole of red-green case (1)'s mechanism.
> 3. **Use the returned token for an hour.** It expires on its own, so a cycle caches it rather than re-minting per call — the "cache it for its one-hour life" of the block above, now with the real lifetime rather than a supposed one.
> 4. **Nothing else is scoped by hand.** No collaborator invite, no per-repository token, no `gh auth` state to keep straight.
>
> **The installation id is an installation's, not a project's.** One installation covers every selected repository; the per-repository narrowing happens at step 2 and only there. An implementation that mints once per cycle and reuses the token across projects has silently thrown away the whole property this slice exists to buy.

> **✏ Refined 2026-08-21 (later the same day) — red-green case (1) has been demonstrated by hand, and the slice still owes it as a test.** *"A credential minted for project A carries no authority over project B"* was watched happening: a token minted with `{"repositories": ["scratch-app"]}` returns **HTTP 200 on `scratch-app` and HTTP 404 on `ivtrends`**, both repositories being inside the same installation. **404, not 403 — the second repository is invisible, not merely refused**, which is a stronger property than the case asks for and is worth asserting in those terms.
>
> **Say the obvious thing plainly, because a slice reading the evidence above could reasonably think its first case was already green: a thing observed once by hand is not a regression guard.** Nothing about that observation fails if somebody later widens the `repositories` array, drops it, or reuses a cached token across projects — and every one of those is a plausible edit, none of them looks wrong in a diff, and the failure they cause is an agent acting on a repository it was never given. **The automated assertion is still owed**, on the argument vector of the mint request, per the earlier amendment: a token minted for project A named project A and nothing else.
>
> **A second, cheap assertion the hand check suggests and the plan did not have:** the mint request is made **per project**, not once per cycle — asserted by driving two projects through the runner and reading two distinct mint calls. The hand check cannot catch a shared token; a test can.

> **✏ Refined 2026-08-20: "every `gh` and `git` invocation in the process" is false as written, and closing the gap is a decision this slice owes.** Three modules spawn git directly through `execFileAsync` and never touch `CommandRunner` at all: **`src/git.ts:18-38`** (`runGit`, which is `mergeIntoDefault`'s spawner and which **pushes** at `git.ts:185`); **`src/daemon/session.ts:375,389,414,444,460`** (the five probe implementations); and **`src/daemon/hooks.ts:552`**. Two of the three close as a side effect of this phase — 30c removes `git.ts`'s only machine caller and 30b replaces the `session.ts` probes — but **`hooks.ts` keeps spawning ambient git**, and red-green case (2) above ("a request with no credential configured fails loudly at spawn time, never falls back to ambient login") **is not enforceable across a codebase that still holds an un-seamed spawn point**. Either 30a widens to route `hooks.ts:552` through the runner, or case (2) narrows to the paths the runner actually owns and says which those are. **The choice is owed and is deliberately not made here.**

> Depends on the human prerequisite above and on nothing in code.
> **✏ Refined 2026-08-20:** that prerequisite is blocker (a) — unstarted, with nothing in `timone.yaml` or `src/manifest.ts` to build on.
> **✏ Refined 2026-08-21:** blocker (a) is **resolved** — the App is created and installed, and the key is on disk. The "nothing in `timone.yaml` or `src/manifest.ts`" half is still true and is now this slice's own work rather than a wait. **It depends on nothing outside itself except (b)**, R23's wording.

> **✅ Built 2026-08-22 — 30a is done, and the owed choice was made.**
>
> **The owed choice — `hooks.ts:552` — is resolved by narrowing case (2), and the narrowing is not a retreat.** Every `git()` call in `src/daemon/hooks.ts` is a **local read**: `rev-parse` (`:561`, `:685`), `symbolic-ref` (`:579`), `status --porcelain` (`:587`), `log` (`:728`). Not one of them reaches the forge, so not one of them can act under a borrowed identity — there is nothing to borrow on a local `git status`. Routing them through the credential runner would mint a forge token for a call that never makes a forge request. So case (2) reads: **no path that reaches the forge falls back to ambient login**, and the paths the runner owns are every `gh` invocation in `github-tickets.ts`, which is all fourteen of them, through the single injected runner. 30b and 30c still remove the `session.ts` probes and `git.ts`'s machine caller as the plan says; `hooks.ts` keeps its local reads and is named in 30d's exemptions, where it already had to be.
>
> **What was built.** `src/adapters/credentials.ts` (new), the JWT/mint/cache recipe behind a `MintCall` seam. `src/adapters/command-runner.ts` gains `credentialCommandRunner`. `src/manifest.ts` gains an optional `identity` block — `app_id`, `installation_id`, `private_key_path`, `login` — and `timone.yaml` and `timone.example.yaml` declare it. `src/commands/daemon.ts` gains `machineAdapter()`, which is the gap the 2026-08-20 refinement found: it is the path from the CLI to an injected runner, and the daemon now goes through it.
>
> **Where case (2) actually lives:** `machineAdapter` throws when the manifest declares no `identity`, and the daemon prints it and exits 1. The schema keeps the block optional on purpose — `workspace sync` and `projects list` are fvermaut's own commands and are entitled to his login. The daemon is not.
>
> **The scoping is taken from the command's own arguments.** Every `gh` call passes `--repo <owner/name>`, so the runner reads the repository out of the argument vector and mints for that. A token derived this way can never be wider than the call that uses it, and **a command naming no repository is refused rather than run** — there is no ambient path. `GH_CONFIG_DIR` is pointed at an empty directory so `gh`'s stored host credentials are not a fallback either.
>
> **✏ A live finding that would have made three checks in this phase pass vacuously.** The plan says the login is `timone-agent[bot]`, and it warned in as many words that "a check written against the wrong login passes vacuously by finding nothing". **Both spellings are real and they name the same identity.** GitHub renders an App's bot as **`timone-agent` on GraphQL** — which `gh --json` speaks, and which is where a ticket thread comes from — and as **`timone-agent[bot]` on REST**, which is where an inline pull-request comment comes from. `github-tickets.ts` reads both surfaces. Observed on `fvermaut/scratch-app` on 2026-08-22 by posting a comment under the App and reading it back on each. `isFromTimone` now compares with the `[bot]` suffix stripped from both sides, whole-string rather than by prefix. **Every later slice comparing a login must accept both spellings**; 30c, 30d and 30k each have such a check.
>
> **32 tests added**, all seen failing first. Suite: 1256 tests, and the only failures are the known flaky set of [#8](https://github.com/fvermaut/timone/issues/8), which pass when their files are run alone.

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/adapters/credentials.test.ts src/adapters/command-runner.test.ts
```

- [x] Red→green trace for all four cases, each seen failing first — 8 in `credentials.test.ts`, 10 in `command-runner.test.ts`, 6 in `manifest.test.ts`, 5 in `commands/daemon.test.ts`, 3 in `github-tickets.test.ts`
- [x] `grep` the built output for the credential string — the token reaches exactly one place, the child's environment at `command-runner.ts`, and nothing in the tree stringifies an environment into a message. **The daemon-log half is not done**: no daemon has run under this credential yet, and it belongs to 30k's live gate.
- [x] One live comment on `scratch-app` appears under the machine account — [scratch-app#45](https://github.com/fvermaut/scratch-app/issues/45), authored by **`timone-agent`** and not by `fvermaut`. **[timone#19](https://github.com/fvermaut/timone/issues/19) is reopened**, per the refinement below, carrying that observation; 30l closes it.
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

> **✅ Built 2026-08-22 — 30b is done, and it found a bigger version of its own case (3).**
>
> **The `[FIX FIRST]` defects are fixed, both of them, at the one seam every `gh` call passes through.** `execRunner` in `src/adapters/command-runner.ts` now gives every command a **90-second deadline** ([#47](https://github.com/fvermaut/timone/issues/47)) and **retries a transport failure twice, waiting 2s then 8s** ([#48](https://github.com/fvermaut/timone/issues/48)). The distinction that makes retrying safe is asserted: **a 404 is an answer and is never retried**; a reset connection, a DNS failure, a killed child and a 5xx are the forge not having spoken, and those are. [#49](https://github.com/fvermaut/timone/issues/49) is not fixed here — it is a different mechanism in `runs.ts`, and 30c owns it.
>
> **The widening is one method, not two.** `TicketingAdapter.readBranches(project, branch?)` answers the default branch, its tip, and the named branch's tip in **one round trip**. Two methods would have doubled a per-stage per-project call, which is exactly the traffic #49 turns into a false report of a stopped daemon.
>
> **GraphQL rather than REST, and that choice *is* the answer to case (2).** A missing ref comes back as `ref: null` — a value in a successful response. REST's `/git/ref/heads/…` answers 404, which arrives as a failed process, and telling that apart from a dropped connection by matching an error string is the confusion this slice exists to forbid. Verified live against `fvermaut/scratch-app`: an absent branch answers `{defaultBranch, defaultHead}` with no `head` and no error; `main` answers with its tip.
>
> **The fake count was seven, not nine.** `poll.test.ts`, `session.test.ts`, `hooks.test.ts`, `commands/daemon.test.ts`, `takeover.test.ts`, `retry.test.ts`, `guardrails.test.ts`. `github-tickets.test.ts` and `github-pulls.test.ts` drive the real adapter through a fake *runner*, so they never needed the method. All seven took **one line each** — `...noBranches`, a new stub beside `noStepWrites` in `ticketing.stubs.ts`. It answers rather than throwing, deliberately: "there is no such branch" is what those tests used to get from a `git rev-parse` in a directory that was no repository, and keeping that silence is what lets a test about something else stay about something else.
>
> **`gitBranchHead` and `gitCurrentHead` are deleted**, not left unused, so 30d's guard has nothing to make an exception for.
>
> **✏ A finding this slice did not fix, and 30d must settle. Three more probes read a branch out of `projects/<name>`, and they will answer wrongly the moment 30h lands.** `planStatusProbe` (`gitPlanStatus`), `verificationReportProbe` (`gitVerificationReport`) and `BreakdownSource` (`fromDefaultBranch`) all read file *content* off a branch with `git ls-tree` / `git show` in the human's checkout. Nothing fetches that checkout. Today they work only because the session runs in that same folder and leaves the branch there. **Once a session runs in a box, the branch exists only on the forge, these three answer `undefined`, and `undefined` here means "the stage produced nothing"** — the same wrong answer case (3) was written to forbid, one level up and silent. They were left alone because converting them is not what this slice was scoped to, and because `BreakdownSource` is **synchronous** and read for every marked ticket on every cycle, so making it a forge call is both an API change through `poll.ts` and a traffic multiplier. **Recorded, not worked around.** 30d names them; they are either its fifth, sixth and seventh exemptions or a slice of their own before 30h.
>
> **41 tests added**, all seen failing first. Suite: **1279 tests, all green** — including the [#8](https://github.com/fvermaut/timone/issues/8) flakes, which passed this run.

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

- [x] Red→green trace for all three cases — 9 in `github-tickets.test.ts` for the adapter, 4 in `session.test.ts` for the caller, 9 in `command-runner.test.ts` for the timeout and the retry, 19 more carried from 30a
- [x] Case (3) asserted with a simulated transport failure, not a comment claiming it cannot happen — and asserted **twice**, once at the adapter and once at the caller, because the caller used to erase the distinction on its way out
- [x] No test in this slice reaches the network. The live read against `fvermaut/scratch-app` was run by hand, outside the suite, and is recorded above
- [ ] ✏ **Refined 2026-08-20 — the command reports a non-zero test count.** Exit code 0 from vitest means nothing on its own here; read the number of tests it says it ran.
- [ ] ✏ **Refined 2026-08-20 — the full suite passes**, and the only assertions that changed are the nine fakes gaining the new method. This is 30b's counterpart to 30e's "passes unchanged": the widening is expected to touch fakes and nothing else, so a changed assertion anywhere but those nine files means the change leaked past the seam.

---

### Sub-phase 30c: Merging goes through the forge — both paths

**[MODIFY]** `src/daemon/session.ts:1476` — the default `mergeProbe` becomes a forge merge.
**[MODIFY]** `src/git.ts` — `mergeIntoDefault` loses its callers; it is not deleted in this slice.

Two paths, and both must land: **a step ticket's pull request**, and **chunk zero's merge with no pull request at all** ([ADR-0030](../../adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md) D2, [ADR-0043](../../adr/0043-the-humans-checkout-is-theirs-alone.md) D3). It stays a merge with no pull request; only the hand changes.

**Seams under test (TDD):** the merge function. Red-green: (1) a clean merge reports the same `MergeOutcome` shape the pipeline already branches on; (2) a **conflict** is reported as a conflict — the forge refuses differently from a local git merge and the pipeline's existing handling must be re-checked against the new shape, not assumed; (3) the no-pull-request path merges the branch and opens no pull request; (4) a merge that has already happened is reported as such and does not fail the run.

> Depends on 30b.

> **✅ Built 2026-08-22 — 30c is done, and "both paths" turned out to be one.**
>
> **✏ There is no machine merge of a pull request, and there never was.** This slice was written around two merge paths. Grepping the tree for one finds nothing: the only merges anywhere are `git.ts`'s `fastForward` (which is `workspace sync`, fvermaut's own command) and `mergeIntoDefault` (chunk zero). A step ticket's pull request is merged **by fvermaut, on github.com**, and the daemon only ever *reads* `state === "merged"` (`poll.ts:840`, `poll.ts:1890`). So the first path was already on the forge, by a human's hand, and needed nothing. **The slice is half the size the plan gave it, and none of the safety is lost** — what the plan called the dangerous half, chunk zero, is the whole of it.
>
> **The merge is `POST /repos/{owner}/{repo}/merges`, and the four outcomes are HTTP status codes rather than prose.** `201` with a commit is a merge, `204` with an empty body is "there was nothing to merge", `409` is a conflict, anything else is a refusal carrying what GitHub said. A **transport failure is rethrown, never turned into a refusal** — the retry layer has already tried three times, and calling it a declined merge would put a sentence on a ticket that nobody ever said.
>
> **The `MergeOutcome` shape widened, and the old shape is gone rather than assumed gone** — it moved out of `src/git.ts` into `src/adapters/ticketing.ts`, so every use of it is now a use of the new one and the compiler said so. Two flags were added, and each is the difference between a run that carries on and a run that stops wrongly:
> - `alreadyThere` — `merged` is still **true**, so every existing `if (outcome.merged)` keeps working unchanged, and a cycle retried after a merge that landed is never told to redo it.
> - `conflict` — separated from every other refusal because it is the one a human can act on. The ticket now says the two sides clash and that trying again changes nothing, instead of quoting a status line.
>
> **[#49](https://github.com/fvermaut/timone/issues/49) is fixed here**, as the plan allows. `witness()` measured the gap between two cycle **starts**, so a cycle whose body ran longer than the unwitnessed window was arithmetically identical to a daemon that had been switched off — and the log printed a false statement about the daemon itself. A new `workedUntil` stamp, written by `cycleEnded()` at the end of every cycle, makes the measured gap the time the daemon was **idle**. Optional in the schema, so `version` stays `1` and an older state file falls back to the old reading, which errs towards not reclaiming.
>
> **✏ A fixture fragility this uncovered, fixed rather than worked around.** `poll.test.ts`'s clock advanced **one minute per read**, so adding one clock read anywhere pushed a three-cycle test past the two-minute staleness window and three unrelated tests failed on a reclaim nobody had touched. It advances one second now. The tests that are actually about time set their own instants and are unaffected — all 164 pass.
>
> **Watched live on `fvermaut/scratch-app`, and one of the three observations is R19's:**
> - **A real chunk-zero merge with no pull request.** A branch was created on the forge, given a commit, and merged: `{merged: true, into: "main"}`, `main` moved, and the commit has **two parents**. No pull request was opened.
> - **Case (4) live.** Merging `main` into itself answers `{merged: true, into: "main", alreadyThere: true}` — a success, not a failure.
> - **[R19](../../specs/prd/prd-02-inversion-of-control.criteria.md) does not regress, and this was worth checking rather than assuming.** GitHub's merge endpoint takes one `commit_message`, and the whole of `mergeMessage`'s multi-line body survives it: the merge commit on the forge carries **`Timone-Stage: breakdown`** and is authored by **`timone-agent[bot]`**. Machine authorship is now readable from git history in two independent ways where it used to be readable in one.
> - The two fixture branches and their marker files were deleted afterwards; `scratch-app` carries only the merge history.
>
> **21 tests added**, all seen failing first. Suite: **1295 tests, all green.**

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/session.test.ts
```

- [x] Red→green trace for all four cases — 8 in `github-tickets.test.ts` for the merge itself, 4 in `session.test.ts` for the caller, 5 in `runs.test.ts` for #49
- [x] The pipeline's existing conflict handling is exercised against the **new** outcome shape, and the old shape is proved gone rather than assumed — the type moved modules, so nothing can still be reading the old one
- [x] On `scratch-app`, one chunk-zero merge, read on the forge afterwards. **The pull-request half of this item is void**: no machine merges a pull request — see the finding above

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

> **✅ Built 2026-08-22 — 30d is done, and it was bigger than the slice as written.**
>
> **✏ The `[MODIFY]` line — "wherever a project path is resolved for machine use" — turned out to name six places, not one.** 30b converted the branch-tip probes and recorded the rest as a finding; this slice discharges it. Converted here: `planStatusProbe` and `verificationReportProbe`, which read the newest phase file's `Status:` line and the verification report beside it with `git ls-tree` and `git show`; and the **breakdown source**, which read a ticket's approved list with `git show` off the default branch. All three now read the forge, through a third widening of the seam: `readFile(project, branch, path)` and `listFiles(project, branch, directory)`, both GraphQL, both answering `null` for an absent path in a **successful** response so "not there" stays a value rather than a status code to be told apart from a dropped connection. Verified live on `fvermaut/scratch-app`: a real listing, a real file, and undefined for both absences.
>
> **They were not deferrable. Left alone they would have answered "the stage produced nothing" the moment 30h landed** — the branch would exist only on the forge, `git ls-tree` in the human's checkout would find nothing, and the caller reads nothing as *no work*. Silent, at the heart of the pipeline.
>
> **The breakdown source stopped taking a directory.** It is `(path) => …` now, built by whoever knows where to look, and it may answer asynchronously. `fromWorkingTree(dir)` and `fromDefaultBranch(dir)` became factories and are **fvermaut's**; `fromForgeDefaultBranch(adapter, project)` is the machine's. `readBreakdown` is async; `readBreakdownSync` exists for `timone status`, which renders without waiting and reads his own folder.
>
> **`PollDeps.root` is gone.** The whole reason the poll loop was told a root was to reach `projects/<name>/` for a breakdown. It reads the forge now, so the field said something false and would have been the obvious thing to reach for again. `checkoutOf` moved out of `poll.ts` to `commands/status.ts`, its only remaining caller. `src/daemon/session.ts` resolves no path under `projects/` at all any more, and its `execFileAsync` import is deleted with the last probe that used it.
>
> **The guard is `src/guards/checkouts.test.ts`, and it is two lists rather than one.** Separating them is what makes it say something true: git against the *timone* checkout is an ordinary thing this system does — the version pin, the dirty-tree refusal — and git against a *project's* checkout is what this phase ended. One list would have had to ban the first or excuse the second.
> - **`EXEMPT`** — five files that may resolve a path under `projects/`: `commands/workspace.ts` and `commands/status.ts` (fvermaut's own commands), `daemon/hooks.ts` (the R15 bracket, local read-only git, never the forge), `adapters/docker-preview.ts` (worktrees, ADR-0021, untouched by this phase), and `daemon/prompts.ts` (it writes the sentence into a *prompt*; it resolves nothing).
> - **`GIT_USERS`** — six files that may perform git at all, each saying what on.
>
> **Two holes were found in the guard by the guard, while writing it.** It missed git reached **through `src/git.ts`** — so `commands/workspace.ts`, which clones and fast-forwards every checkout there is, read as innocent — and it missed paths built from a manifest entry's `path` field, which is required to start with `projects/`. Both are closed. It also had to learn that `commands/projects.ts` registers a CLI subcommand called `projects` and reaches into nothing: a guard that flags that is a guard somebody switches off.
>
> **The exemption list cannot rot.** One test asserts every name still does the thing it was excused for, so an exemption that outlives its reason fails rather than accumulating. That is case (3)'s narrowness, against five exemptions rather than the one the slice was written around.
>
> **✏ Blocker (d) is answered as option (ii), and the CI question is still fvermaut's.** The guard is a vitest file. It fails `npm test`, and `npm test` runs at every session's `Stop` hook, so it is enforced on every session — but **not** in CI, because `.github/` does not exist and the Timone App is installed **without** the Workflows permission, deliberately. Option (i) is a workflow **fvermaut commits by hand**, once, after which the machine can never alter it. **Recorded as open. It is the one thing on this phase that still needs him.**
>
> **The rewritten test worth naming.** `commands/daemon.test.ts` had a test that built a real clone under `projects/scratch-app`, committed a breakdown to its default branch, and asserted `runDaemon` passed its root down far enough for the loop to read the file. That plumbing is gone. It is rewritten to assert the same observable end — a list that regrew leaves the ticket open — with **no checkout on disk at all**, plus that the forge was asked for that path on that branch. The real-git fixture is deleted with it, and that test file went from 11 seconds to instant.
>
> **13 tests added** (7 guard, 6 adapter), and case (1) was demonstrated rather than asserted: a `join(root, "projects", project)` was genuinely reintroduced into `poll.ts`, the guard named `daemon/poll.ts`, and it passed again on revert. Suite: **1308 tests, all green.**

#### Agent Validation Steps

```bash
npm run build && npm test
```

- [x] Red→green trace, with case (1) demonstrated by an actual reintroduced call — reintroduced into `src/daemon/poll.ts`, caught by name, reverted
- [ ] With the daemon running a real `scratch-app` ticket, `git status` and the reflog in `projects/scratch-app` show **no movement** across the whole run — **live, and deferred to 30k's gate**, which runs a real marked ticket end to end
- [ ] Branch switched in `projects/scratch-app` mid-run; the run finishes and the branch is where it was left — **the same live run**, and it is 30k's human gate

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

- [x] ✏ **2026-08-22 — all six assertions run against the built image and recorded here.** `docker run --rm --shm-size=1g timone-agent:latest node /opt/timone/image-check.mjs`:
      `/dev/shm size — 1024 MiB against a floor of 256 MiB`; `no docker CLI — not on PATH`; `no docker socket — /var/run/docker.sock absent`; `chromium loads a page — 151.0.7922.34`; `firefox loads a page — 153.0`; `webkit loads a page — 26.5`. Separately: `node v24.18.1`, `gh 2.97.0`, `claude 2.1.238`.
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

> **✅ Built 2026-08-22 — 30h is done as far as it can be without a live session, and the box was watched cloning for real.**
>
> **`src/daemon/container-runtime.ts` is the second runtime.** It starts a container from 30g's image, clones both repositories at the versions 30e's request names, streams the CLI's messages back, returns the outcome, and destroys the container. All five red-green cases are covered, plus four the plan did not have.
>
> **The switch the plan found missing is built.** `runtimeFor()` in `src/commands/daemon.ts`, behind `--runtime in-process|container` and `--image <ref>`, plumbed to the single production wiring site. **Default is `in-process` and 30k flips it** — asserted as a test, so this phase cannot change where every run happens as a side effect. An **unknown name throws**: a daemon that fell back to the in-process runtime because a flag was misspelled would run every session on fvermaut's machine while its operator believed otherwise.
>
> **Progress was the hazard and it is covered at the seam the plan named.** `parseSessionMessage` is exported and separately tested because it is a **new, untyped boundary**: in the in-process runtime the messages are values the SDK handed over; here they are text, printed by a program in a container, on a stream anything else in that container may also print to. A line that is not JSON, is JSON but not an object, or carries no `type` is **ignored** — a banner on stdout is not a reason to fail a run. Case (1)'s fixture carries **partial-message events**, per the plan's warning, and asserts the boxed path's snapshot equals a fresh accumulator fed the same lines: 900 output tokens both ways. The CLI is launched with `--include-partial-messages`, without which [timone#10](https://github.com/fvermaut/timone/issues/10) reproduces silently and R17 still looks satisfied.
>
> **Two decisions worth naming.**
> - **The container is named, not `--rm`.** A container docker removes on exit cannot be inspected after a failure, which is exactly when somebody wants to look. This runtime removes it itself, on every exit path — success, non-zero exit, kill, and a stream that throws. Four tests, one per path.
> - **The prompt, the commit, the branch and the token travel in the environment, never in the argument vector.** The prompt is arbitrary human and machine text; building a shell command out of a ticket body is how a ticket body ends up executed. Asserted: the prompt does not appear in the command line, and neither does the token.
>
> **Watched live on 2026-08-22, against the real remotes and the real image.** The box script cloned Timone, checked out an exact pinned commit, cloned `scratch-app`, landed on the right branch, and reported the prompt arriving **byte-exact through quotes, dollars and newlines** — and `/proc/mounts` showed **zero mounts under `/workspace`**, which is case (5) observed rather than asserted.
>
> **✏ A finding the live run produced, and the plan did not have it: a boxed run cannot follow a Timone commit nobody has pushed.** The box is built from the remotes, so `git checkout <sha>` in a fresh clone fails with `fatal: reference is not a tree` — a true sentence naming no cause and suggesting no action. It happened on the first live attempt, because the daemon's own branch was unpushed, and **it will happen to fvermaut the first time he runs a boxed daemon on unmerged work**. The box now says so in words he can act on, and the reason reaches the ticket. **The better fix is a pre-flight refusal**, beside 30f's dirty-checkout refusal — the run should not start rather than start and fail — but that needs the spawner to know which runtime it has, which is an interface change nothing else in this phase wants. **Recorded, not taken. 30k decides**, since 30k is where the default flips and where this stops being hypothetical.
>
> **What is still owed and is not a unit test's to give:** one real session run in a box with the ticker watched, and `docker ps -a` clean after a failed and a killed run. Both need a session that actually calls the model from inside the container, which is 30k's gate.
>
> **23 tests added**, all seen failing first. Suite: **1336 tests, all green.**

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon/container-runtime.test.ts
```

- [x] Red→green trace for all five cases — 23 tests in `container-runtime.test.ts`, plus 5 in `commands/daemon.test.ts` for the switch
- [ ] One real session run in a box on `scratch-app` with the ticker watched live — **deferred to 30k**, which is where a session actually calls the model from inside the box. The clone half was watched live and is recorded above
- [ ] `docker ps -a` after a failed run and after a killed run: no container left behind either time — **deferred to 30k** for the same reason. Removal on all four exit paths is unit-covered
- [ ] ✏ **Refined 2026-08-20 — the command above reports a non-zero test count.** With `passWithNoTests: true` at `vitest.config.ts:5` it prints `No test files found, exiting with code 0` until `container-runtime.test.ts` exists; a green exit before that point says nothing at all. Read the count, not the exit code.
- [x] ✏ **Refined 2026-08-20 — the runtime switch is exercised both ways**: `runtimeFor({})` returns `agentSdkRuntime` and `runtimeFor({runtime: "container"})` does not, asserted at `src/commands/daemon.ts`'s wiring. A third test asserts the default *is* `in-process`, and a fourth that an unknown name throws rather than falling back.

---

### Sub-phase 30i: The services beside it

**[MODIFY]** the spawn path — bring the target project's compose stack up on a private network before the session, attach the agent's container to it, tear it down after.

Reuse `docker-preview.ts`'s shape: the same compose file, the same `.env.example` convention, the same health wait. **Ports are not published to the host**; the agent reaches services by name on the private network, which is the difference between this and a preview.

**Seams under test (TDD):** the bring-up, against a fake command runner. Red-green: (1) the stack comes up and is waited for before the session starts; (2) a stack that never becomes healthy fails the run with a readable reason rather than hanging a poll cycle; (3) teardown happens on every exit path; (4) a project with **no compose file** is refused at spawn with a message naming what it must commit — this is now a hard prerequisite for being built at all, and `ivtrends` does not satisfy it today; (5) two runs on different projects do not share a network.

> Depends on 30h.

> **✅ Built 2026-08-22 — 30i is done, and the live run found a teardown that reported success and removed nothing.**
>
> **`src/daemon/services.ts` stands the stack up and takes it down**, and `container-runtime.ts` joins the box to its network. All five cases are covered, plus six the plan did not have.
>
> **✏ Case (4)'s contradiction is settled, and the plan had it right.** `scratch-app` **does** commit `compose.yaml`; `ivtrends` does not, exactly as the plan said. So the refusal bites `ivtrends` alone, and the fixture every live gate runs on is unaffected.
>
> **Getting to that answer found a bug, and the bug is the more useful half.** A first check concluded that *neither* project committed one, and that reading was written into this file and into 30i's commit message before it was caught. Two faults in `listFiles`, both about the **repository root**: the forge spells the root with *nothing* after the colon, so `main:.` matches nothing and answers null — which reads as "the branch has no such directory" — and joining a name onto an empty prefix produced `/compose.yaml`, a path that matches nothing either. A compose file lives at the root, so the root is not an edge case here; it is the case. Both are fixed, both are tested, and the corrected reading was confirmed live. **The lesson is the one this phase keeps re-learning: an absent answer and a wrong question look identical**, which is the same shape as 30b's case (3) and 30i's silent teardown.
>
> **The daemon clones the project's source itself, under `.timone/stacks/`.** It has to: the compose file lives in the project repository, the daemon no longer has a checkout (30d), and the box cannot stand anything up because it has no docker CLI and no socket, deliberately (ADR-0041 D3). This is the same shape `docker-preview.ts` already uses for worktrees under `.timone/previews/`, and it is beside `projects/` rather than in it, so the 30d guard permits it by design rather than by exception. The clone's credential travels through a git credential helper in the environment — **never in the URL**, which would land in a log line, a `ps` listing and git's own error messages.
>
> **Nothing is published to the host, and making that true took a real decision.** Compose has no "do not publish" flag, so this writes a per-run override clearing every service's ports. It must be **`ports: !reset []`** and not `ports: []` — an override's empty list is *merged* into the project's own and changes nothing at all. Asserted as a test, and the test was mutation-checked: changing `!reset []` to `[]` fails it.
>
> **✏ The live run found a bug with the worst possible shape, and it is not in this code — it is in compose.** `docker compose down` with `COMPOSE_PROFILES` unset **exits 0 and removes nothing**: a service declared under a profile is invisible to compose without it, and `--remove-orphans` does not save you. A teardown that reports success and leaks the container, the network and the volumes is how a machine fills up quietly. The implementation already passed the profile on every call; **nothing asserted it**, and it would have survived any refactor that split `up` and `down` apart. Two tests now do.
>
> **Watched live on 2026-08-22, with a real Postgres stack:**
> - `docker compose ps` shows `5432/tcp` — exposed inside, **not published**. `nc` against the host's 5432 finds nothing.
> - The network is `timone-live-30i_default`, exactly what the code computes from the compose project name.
> - **A real `timone-agent` container on that network reached `db:5432` by service name.** That is case (5)'s property and 30i's whole reason for existing, observed rather than argued.
> - After `down -v --remove-orphans` with the profile set: no container, no network, no volume.
>
> **Three mutations were introduced and each was caught** — `!reset []` → `[]`, `--wait` → `--wait-not`, and the per-run network name → a shared one. The suite is not vacuous.
>
> **19 tests added.** Suite: **1357 tests, all green.**

#### Agent Validation Steps

```bash
npm run build && npx vitest run src/daemon && npm test
```

- [x] Red→green trace for all five cases — 15 in `services.test.ts`, 6 more in `container-runtime.test.ts` for the attachment and teardown
- [x] On `scratch-app`, a real session reads and writes its database by name from inside the box — **done at 30j**: `scratch-app`'s real stack was brought up through `bringUpServices`, and its own accessibility suite ran inside the box against `db:5432` **by service name**, migrating and seeding rows as it went. fvermaut's own dev stack was up on the host at the same time and the two never met
- [x] `docker network ls` and `docker ps -a` clean after a passing run — watched live, including the compose-profile trap that made an earlier teardown silently leak everything. The failing and killed runs are unit-covered and go to 30k

> **✏ Refined 2026-08-20 — two small things, neither one blocking.** The command `npx vitest run src/daemon && npm test` is **redundant**: `npm test` is a strict superset of the first half. Harmless, kept as written, but the first half buys nothing except a slightly earlier failure. And **case (4) needs confirming before it is asserted**: `ivtrends` carries `preview: docker` in `timone.yaml`, while this plan states it commits no compose file. One of those two is wrong. Settle which before the refusal is written, or the first thing the new refusal does is contradict the manifest.
> The fake `CommandRunner` at `src/adapters/docker-preview.test.ts:32-70` covers all five of this slice's cases as it stands — see the confirmed note under Context & Prerequisites.

---

### Sub-phase 30j: Playwright in the box, proven end to end

Run the verify stage's real browser leg inside the box against the stack from 30i: the accessibility scan, the keyboard-only pass, the reflow checks — the baseline legs that are unconditional for a user-facing deliverable.

This is a named slice because fvermaut asked the question directly and because a plausible-looking browser pass that silently degrades — a scan that finds nothing because the page never rendered — is worse than one that fails. **The pass must be compared against the same pass run outside a box on the same commit, and the findings must match.**

**Seams under test:** none new. The assertion is a comparison of two real verification reports.

> Depends on 30i.

#### Agent Validation Steps

- [x] The same verification pass run in a box and on the host, same commit (`69ad47ed`), and the two compared — **22 passed both ways, the same 22 test names**. No differences to explain
- [x] The server-start pattern the verify skill mandates — backgrounded, polled, killed at the end — works unchanged inside the box. Playwright's own `webServer` did it, against the project's committed configuration
- [x] A deliberately broken page produces a **failing** pass in the box — an `<img>` with no `alt` took it to **3 failures, exactly the axe tests**, keyboard and reflow still passing

> **✅ Built and watched 2026-08-22 — 30j is done, and the browser leg is identical in the box and out of it.**
>
> **The comparison the slice is built around, run for real.** `scratch-app`'s own `tests/e2e/accessibility.spec.ts` — the axe scan, the keyboard traversal, and the reflow checks at 320 px and 200 % zoom — was run twice on commit **`69ad47ed`**: once **inside the box** against 30i's live stack, once **on the host** outside any container. **22 passed in the box. 22 passed on the host. The same 22 test names.** The findings match, which is the assertion, and neither run was a scan finding nothing because the page never rendered — the reflow legs print the boxes they measured, and they measured them.
>
> **The pass is non-vacuous, proved by breaking a page rather than by arguing.** An `<img>` with no alternative text was added to `src/app/page.tsx` inside the box, and the run went to **3 failures — exactly the three axe-violation tests**, with the keyboard and reflow tests still passing, which is correct: a missing `alt` does not change tab order. A browser leg that cannot fail is not a browser leg.
>
> **The server-start pattern works unchanged inside the box.** `playwright.config.ts` declares a `webServer` that runs `npm run dev`, polls `http://localhost:3000` and kills it at the end. It did exactly that **inside the container**, and the suite completed — no change to the project's own configuration, and nothing about the box visible to it.
>
> **The project brings its own tooling and the box needs nothing extra.** `@axe-core/playwright` and `@playwright/test` are `scratch-app`'s devDependencies; `npm ci` inside the box installs them, and the browsers come from the image. The box provides node and browsers; the project provides what it wants to test with. That is the right seam and it was not designed — it fell out of running the thing.
>
> **Two live observations worth keeping, neither of them planned:**
> - **fvermaut's own `scratch-app` dev stack was running on the host throughout**, holding host port 5433. The boxed stack published nothing and the two never met — case (5)'s property observed against a real collision rather than a hypothetical one.
> - **His checkout came through clean.** `projects/scratch-app` was on `main` with an empty `git status` after three boxed sessions and two stacks. Not the full 30k gate, which is daemon-driven, but the same property.
>
> **Everything was taken down.** No `timone-*` container, no `timone-*` network, no clone under `.timone/stacks/`. His own stack was still running, untouched.

> **✏ Refined 2026-08-20: this slice has no `Agent Validation Steps` command block, and every other slice in this phase has one.** process.md stage 5 requires copy-pasteable validation commands per sub-phase. The comparison this slice is built around — two real verification reports, produced and diffed — is not a gate until a named command produces both and diffs them; as written, "the two reports diffed" is an instruction to a human, and an executing agent has nothing to run. **The gap is recorded, not filled**: the command depends on how 30h and 30i end up invoking the verify stage inside the box, which is not settled. Write it when 30i closes, before this slice starts.

> **✏ Written 2026-08-22, now that 30i is closed — the command this slice was owed, and the blocker that stops it running.**
>
> **It is blocked by (e)**, and completely: both halves of the comparison are a real verification session, one of them inside the box, and a boxed session cannot reach the model until fvermaut answers how it authenticates. **Do not start this slice before (e) is answered.** Everything below is what to run once it is.
>
> The shape settled by 30h and 30i: a boxed run is `timone daemon --runtime container`, the stack comes up from the project's own `compose.yaml` under an `app` profile with no published ports, and the box joins `<compose-project>_default`. So the two passes differ only in `--runtime`, and the commit is held still by driving the same ticket twice.

#### Agent Validation Steps

```bash
# Both passes on the same commit of scratch-app. The only difference between
# them is where the session ran, which is the whole assertion.
#
# 1. On the host, as every verification has run until now.
node dist/cli.js daemon --once --runtime in-process
cp projects/scratch-app/doc/plans/phases/reports/phase-NN-verification.md /tmp/host.md

# 2. In the box, same ticket, same commit.
node dist/cli.js daemon --once --runtime container --image timone-agent:latest

# 3. The comparison this slice exists for. Differences are explained or
#    fixed, never noted and moved past — a scan that finds nothing because
#    the page never rendered reads exactly like a clean pass.
gh api "repos/fvermaut/scratch-app/contents/doc/plans/phases/reports/phase-NN-verification.md?ref=<branch>" \
  --jq '.content' | base64 -d > /tmp/box.md
diff -u /tmp/host.md /tmp/box.md

# 4. Non-vacuity: the same pass against a deliberately broken page must FAIL
#    in the box. A browser leg that cannot fail is not a browser leg.
docker run --rm --shm-size=1g --network <compose-project>_default timone-agent:latest \
  node /opt/timone/image-check.mjs

# 5. Nothing left behind, on every path.
docker ps -a --filter name=timone- --format '{{.Names}}'   # expect nothing
docker network ls --format '{{.Name}}' | grep '^timone-'    # expect nothing
```

---

### Sub-phase 30k: Flip the default, and the live gate on `scratch-app`

> **◐ Half done, 2026-08-22. The default is flipped and four of the six checks are watched. The two that remain need fvermaut at the keyboard.**
>
> **The default is `container`.** `DEFAULT_RUNTIME` moved only after 30h built the box, 30i gave it services, and 30j watched a real session and a real browser pass inside one. **`--runtime in-process` puts a daemon back the old way in one word** — that has to stay one word, because it is what an operator reaches for when a box misbehaves at two in the morning. Sessions fvermaut opens himself never come through here at all (ADR-0041 D5).
>
> **30h's finding is decided, and the answer is a refusal.** A boxed run cannot follow a Timone commit nobody has pushed. `isCommitOnRemote` reads the remote **tracking refs**, so the question is offline — what this checkout last saw — rather than a network call at every spawn, and being a cycle out of date errs the safe way: it refuses a run that would have worked rather than starting one that cannot. It is asked **before anything is created**, so a run that could never work does not first spend a compose build and two clones finding out.
>
> **What was watched, on 2026-08-22:**
> - **The container, inspected while running.** `Mounts: []`, `Binds: []`, `Privileged: false`. From inside: no `docker` on `PATH`, no `/var/run/docker.sock`, no `/Users`, **zero mounts under `/workspace`**, and `uid=1001(pwuser)` — not root.
> - **A second managed repository is invisible from inside the box.** With a token minted for `scratch-app`, `git clone` and `git push --dry-run` against `ivtrends` both answer **`Repository not found`** — not "permission denied". A token that cannot see a repository cannot be talked into acting on one.
> - **The dirty-checkout refusal fires and reads well**, demonstrated against this session's own uncommitted work: it names the files and says what to do, in one line, because the poll loop keeps only the first.
> - **The `--runtime` and `--image` flags are on the CLI**, with `container` as the printed default.
>
> **What is left, and it is his:**
> - **One real marked ticket on `scratch-app`, driven end to end**, with R15's provenance check watched across the whole run — it has fired wrongly four times in one session before, and changing commit authorship is exactly what would set it off again.
> - **The human gate.** He switches branches in `projects/scratch-app` during a build, without warning anybody, and says whether he still has to think about it. That is the entire point of this phase and the one thing no test can assert.
>
> **30d's two live items ride on that same run** — `git status` and the reflog showing no movement, and a branch switched mid-run staying switched. A weaker form of both was seen at 30j: after three boxed sessions and two stacks, `projects/scratch-app` was on `main` with an empty `git status`, and fvermaut's own dev stack was still running untouched beside them.

The container runtime becomes the default for daemon-spawned sessions. Sessions fvermaut opens himself are untouched ([ADR-0041](../../adr/0041-a-run-happens-in-a-container-built-from-the-remotes.md) D5).

Then drive one real marked ticket on `scratch-app` end to end, and while it builds: **switch branch in `projects/scratch-app` and leave it there.**

> Depends on every preceding sub-phase.

- [ ] The run completes and the checkout is exactly where fvermaut left it — `git status` and the reflog both clean. **Needs the real run.** A weaker form was seen at 30j: clean after three boxed sessions and two stacks
- [x] The container is inspected while running: no mounts from the host, no docker socket, no docker CLI — and no `/Users`, no `Binds`, not privileged, and **not root**
- [x] A push attempted from inside the box to a **second** managed repository is refused — **`Repository not found`**, not "permission denied": it is invisible
- [x] The daemon is stopped with an uncommitted timone change and refuses to spawn, readably — demonstrated against this session's own uncommitted work
- [ ] Comments and commits from the run are authored by the machine account; R15's provenance check is watched across the whole run. **Needs the real run.** Authorship itself is watched: a comment on [scratch-app#45](https://github.com/fvermaut/scratch-app/issues/45) and a merge commit both signed `timone-agent`, the merge still carrying `Timone-Stage:`
- [ ] **Human gate:** fvermaut switches branches during a build, without warning anybody, and says whether he still has to think about it — which is the entire point of this phase and the one thing no test can assert

---

### Sub-phase 30l: Close the phase

**[MODIFY]** `STATUS.md`; the R23 marker with what was actually built and what was actually watched; the R15 and R19 markers if either moved. Delete `mergeIntoDefault` and whatever else in `src/git.ts` no longer has a caller — **last**, after the new path has carried real traffic.

> **✏ Refined 2026-08-20: "whatever else no longer has a caller" is nothing else — delete less than that.** Only `mergeIntoDefault` loses its caller in this phase; its importers are `src/commands/workspace.ts:6-14` and `src/daemon/session.ts:8`, and 30c removes the second. The other seven exports of `src/git.ts` — `clone`, `isGitRepo`, `isClean`, `currentBranch`, `defaultBranch`, `fetch`, and the `MergeOutcome` type — **all keep `workspace sync` as their caller**, and 30d deliberately preserves `workspace sync` as fvermaut's own command. An agent reading the instruction as written, grepping for callers and finding only `workspace.ts`, could reasonably delete the file and break the command 30d just went out of its way to protect. **The instruction narrows to: delete `mergeIntoDefault`, and nothing else in `src/git.ts`.**

- [ ] The completion report says plainly which R23 clauses were observed live and which were only tested
- [ ] [timone#19](https://github.com/fvermaut/timone/issues/19) closed against observed evidence, not against the code having been written
- [ ] ✏ **Refined 2026-08-20 — the item above cannot be done as written: [timone#19](https://github.com/fvermaut/timone/issues/19) was already closed** on `2026-08-20T19:12:04Z` as `COMPLETED`, the same day this plan was written, with no machine account existing and no code written. It must be **reopened** (see 30a) or this item rewritten to record the observed evidence without depending on the closing being this phase's act.

## Dependency graph

> **✏ Refined 2026-08-21 — one edge on this graph is discharged.** `30a → human prerequisite` is **met**: the GitHub App is created and installed (blocker (a)). Read the first line below as `30a → (none in code)`, and with it 30b, 30c, 30d, 30k and 30l stop waiting on an hour of fvermaut's time. **The one human gate left on this phase is blocker (b)** — five minutes confirming R23's wording — and it still gates everything.

```
30a → human prerequisite   identity and a scoped credential — ✏ 2026-08-21: MET
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

> **✏ Refined 2026-08-21 — the account was asked for on day one and it was made on day one, so the inversion above expires.** Blocker (a) is resolved: the App exists, is installed, and its key is on disk. **30a–30d is no longer the most blocked branch of the graph** — it is ordinary work with ordinary dependencies, and the original paragraph's stopping rule is good advice again as written. **The only human gate left on this phase is blocker (b)**, R23's wording, which is five minutes and gates every slice. **Ask for that and nothing else.**
