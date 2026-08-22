# Handover — Timone — 2026-08-22 (midday)

> Prior handover: [2026-08-21-phase-29-shipped-phase-30-next.md](2026-08-21-phase-29-shipped-phase-30-next.md)

## Snapshot

**Six of phase 30's twelve slices were built today: 30a, 30b, 30c, 30d, 30h, 30i.** With 30e, 30f and 30g already on `main`, **nine of twelve are done.** The branch is `phase-30-work-in-a-box`, nothing is merged yet.

**The half the plan calls "the relief" is complete.** The daemon no longer resolves any path under `projects/`, reads no branch and no file from disk, and merges on the forge. A guard fails `npm test` if anyone puts it back.

**1359 tests, all green.** No flakes this run; [#8](https://github.com/fvermaut/timone/issues/8)'s set passed.

**Three slices are left and two of them are blocked on fvermaut**, by a blocker found today.

## Done this session

Each slice is written up in [phase-30.md](../plans/phases/phase-30.md) under its own `✅ Built 2026-08-22` block. In short:

- **30a — Timone acts under its own identity.** `credentials.ts` mints an installation token naming **one** repository; `credentialCommandRunner` takes the scope from the command's own `--repo`, so a token can never be wider than the call. `timone.yaml` gains an `identity` block, optional in the schema and **required by the daemon**.
- **30b — branch state from the forge.** `readBranches` on the ticketing seam, GraphQL so an absent branch is a *value* rather than a 404 to be told apart from a dropped connection. The caller's swallowing `try/catch` is gone. **[#47](https://github.com/fvermaut/timone/issues/47) and [#48](https://github.com/fvermaut/timone/issues/48) fixed** at the one seam every `gh` call passes through.
- **30c — chunk zero merges on the forge.** `MergeOutcome` moved to the seam and gained `alreadyThere` and `conflict`. **[#49](https://github.com/fvermaut/timone/issues/49) fixed** — the witness measures idle time now, not time since the last cycle began.
- **30d — `projects/` is fvermaut's, and a guard says so.** Six places resolved a project path, not the one the plan named. `src/guards/checkouts.test.ts` holds two lists; `PollDeps.root` is deleted.
- **30h — the container runtime.** `container-runtime.ts`, plus the runtime switch (`--runtime`, `--image`) the plan found missing. **Off by default**, asserted.
- **30i — the services beside it.** `services.ts` brings a compose stack up on a private network with **nothing published**, and the box joins it.

## Blocked, and it is fvermaut's

**Blocker (e) — a boxed session cannot reach the model.** Recorded in the plan's blocker section. An in-process session inherits the host's login; a boxed one inherits nothing, which is the point. Checked rather than assumed: `ANTHROPIC_API_KEY` is not set, nothing in `src/`, the `Dockerfile` or `docker/` passes any model credential (the grep has **no hits at all**), and the host's Claude credentials are in the **macOS keychain**, which no container can reach.

**It blocks 30j and 30k completely** — both are defined by a session calling the model from inside the box. 30h and 30i are unaffected and were watched working.

Two answers, and the difference is billing:
- **(i) an API key** in `.timone/`, passed in as an environment variable — a separate bill from a Claude subscription;
- **(ii) the subscription's OAuth token** out of the keychain as `CLAUDE_CODE_OAUTH_TOKEN` — no extra bill, but a long-lived host secret sits inside the box.

**Blocker (d) — CI — is still open and is also his.** 30d took option (ii): the guard is a vitest file, enforced at every session's `Stop` hook, not on GitHub. A workflow is his to commit by hand, once, because the App is deliberately installed without the Workflows permission.

## What was found by running things

Three faults, all with the same shape — **an absent answer and a wrong question look identical**:

1. A transport failure read as an absent branch, which reads as "the stage produced nothing" (30b, fixed).
2. `docker compose down` with no `COMPOSE_PROFILES` **exits 0 and removes nothing**; `--remove-orphans` does not save it (30i, asserted).
3. `listFiles` could not read a repository root — `main:.` matches nothing, and joining onto an empty prefix gave `/compose.yaml`. It made `scratch-app` look as though it committed no compose file. **It does.** The wrong reading reached this plan and one commit message before being caught and corrected.

Two more, recorded not fixed:
- **A boxed run cannot follow a Timone commit nobody has pushed.** The box says so readably; the better fix is a pre-flight refusal beside 30f's, and **30k decides**.
- **`ivtrends` commits no compose file**, so 30i refuses it. `scratch-app` is fine.

One live finding that would have made three later checks pass vacuously: **GitHub renders the same App two ways**, `timone-agent` on GraphQL and `timone-agent[bot]` on REST, and this code reads both surfaces.

## Watched live, not only tested

On `fvermaut/scratch-app`, through the real credential: a comment authored by `timone-agent`; a real two-parent chunk-zero merge with no pull request, carrying `Timone-Stage: breakdown` (**R19 does not regress**); the already-merged case answering as a success. Fixture branches and marker files were deleted afterwards.

With real docker: 30g's six image assertions all pass; the box cloned both repositories at an exact commit with the prompt byte-exact through quotes and newlines and **zero mounts under `/workspace`**; a real `timone-agent` container reached `db:5432` **by service name** on a private network with nothing on the host's 5432.

## Exact next action

**Ask fvermaut blocker (e) — one word, `api key` or `my login`.** It is item 2 in `STATUS.md`. Nothing else in phase 30 can move first.

Once answered: pass the credential into the box in `container-runtime.ts`'s env (beside `GH_TOKEN`), then **30j** — its validation command block is now written in the plan — then **30k**, then **30l**.

Timone's own phases are hand-run; `/timone-execute` is for managed projects.

## Open questions carried forward

- **Blocker (d), CI.** Unresolved. His to commit.
- **A pre-flight refusal for an unpushed Timone commit.** 30k's to decide.
- **Should the breakdown format carry real dependencies?** Nothing needs it yet.
- **Clause 5 of R22 has never fired live.** Unit-proven, unwatched.
- **Three older rules, still unanswered** — see `STATUS.md`: the unlabelled-ticket contradiction, the 14 August give-up rule, and [#32](https://github.com/fvermaut/timone/issues/32).
