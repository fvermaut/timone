# Handover — Timone — 2026-08-06 (third session of the day)

> Prior handover: [2026-08-06-phase-14-planned.md](2026-08-06-phase-14-planned.md). Its "Exact next action" — *execute phase 14, starting at 14a* — **is what this session did**, through 14f. It stopped at 14g, which is fvermaut's gate.

## Snapshot

**Phase 14 is built and unproven.** Sub-phases 14a–14f are committed on `main`, 516 tests green, `type-check` clean, `npm run build` clean. Nothing is pushed. What remains is **14g, the live proof on `scratch-app`, which cannot be done without fvermaut** — it needs a fresh ticket, two approvals, a deliberate `SIGKILL`, and an interactive session he runs himself — and then 14h, whose register flips depend on what 14g observes.

The plan was followed as approved; no sub-phase was skipped or re-scoped. Two defects were found by inspection *after* their slice was committed and fixed before the gate — both are their own `fix:` commits, described below, and both are the kind that pass a unit test and fail in life.

## Done this session

Eight commits, `cc946b3`..`3c56a89`, one per sub-phase plus two fixes:

- **[14a](../../src/daemon/pipeline.ts) — each stage declares its model and effort (R16).** `StageSpec` became a union: a stage the daemon spawns *must* declare a model, one it never spawns *must not*. Both directions are type errors — verified by deliberately mutating the graph both ways and watching `tsc` refuse. `APPROVAL_RECORD_MODEL` covers the second `runtime.start` site, which is not a `PipelineStage`.
- **[14b](../../src/daemon/progress.ts) — the progress heartbeat (R17).** A `SessionProgress` accumulator over the SDK message stream; a tick line every `--progress-interval` (default 30s) and one closing line with the authoritative cost. The snapshot has **no input-token field at all**, which is asserted rather than reviewed for.
- **[14c](../../src/daemon/runs.ts) — the heartbeat is the run's liveness (R18).** Same tick stamps `heartbeatAt`; the poll cycle reclaims runs silent for four intervals *before* picking anything up. Staleness falls back to `updatedAt` when there is no heartbeat, which is what both a just-picked-up run and an older daemon's run look like.
- **[14d](../../src/commands/guardrails.ts) — the bracket moved to the hooks (R15, re-scoped).** `beforeSession`/`afterSession` deleted from `AgentSessionSpawner`; `SessionStart`/`Stop` hooks in the now-tracked [`.claude/settings.json`](../../.claude/settings.json) call `timone guardrails baseline` / `check`.
- **[14e](../../src/daemon/hooks.ts) — the provenance trailer (R19).** A fourth guardrail rule plus the instruction, which reaches a session from two places because neither alone suffices — see Decisions.
- **[14f](../../src/commands/status.ts) — status and README tell the new truths.** A working run's line names its model and elapsed time in the same phrasing the progress line uses.

## In flight / blocked

- **14g is not started and is blocked on fvermaut.** Its six steps are in [the plan](../plans/phases/phase-14.md#sub-phase-14g-live-proof-on-the-pilot); step 4 explicitly needs him to open a session himself and commit something stray.
- **14h is blocked on 14g**, deliberately: R15 only returns to `verified` if **both** session kinds are observed in one pass, and a daemon-only pass leaves it `draft` with the gap written in. That is not a formality — it is the whole evidence limit the re-scope created.
- **Nothing is pushed.** `main` is eight commits ahead of `origin/main`.
- **`scratch-app` #4 remains parked at triage** (`triage:bug`, holds no project). Unchanged. **`scratch-app` #10 sits `failed`** from an earlier session ("the planning stage finished without committing anything to gate") — visible in `timone status`, not touched this session.
- **The hooks have never run inside a real Claude Code session.** They are proven from the CLI end (payload on stdin, from a foreign cwd, real git repos in the unit tests) but this session predates `.claude/settings.json`, so its own hooks never fired. **That is exactly what 14g step 4 proves, and it is the single largest unproven thing in the phase.**

## Decisions made this session

Everything load-bearing was settled at the 2026-08-06 grill and is in the plan. Five decisions were made *during* the build, each because the plan left the shape open:

- **`StageSpec` is a discriminated union rather than optional fields.** The plan asked for the wiring defect to be "caught by the type system, not at runtime"; a union on `built`/`waits` is what delivers that. A defensive runtime branch remains in `runStage`, commented as unreachable-while-the-graph-type-checks.
- **The evidence covers every declared project, not one target.** `SessionStart` cannot know what a session will touch, so it baselines them all, and `SessionEvidence.target` became optional. **Containment's "stayed inside `projects/<target>/`" half runs only when a run named a target** — a session working on Timone itself was *sent* to change `src/`, and judging it against a target it never had would flag every honest edit. Its other half (no harness file in a client repo) needs no target and runs for both kinds.
- **`Stop` fires per assistant turn, not once per session.** ADR-0018 chose `Stop` and that stands, but the consequence is real: an interactive session reaches the check repeatedly. The parked baseline therefore also records what has already been said, so a finding is reported once rather than after every reply.
- **The trailer instruction arrives from the `SessionStart` hook, not only from the prompt.** The prompt carries `Timone-Stage` and `Timone-Run`, which only it knows; the hook carries `Timone-Session`, which only *it* knows — **the prompt is built before the SDK has issued a session id** — and the hook is the one place interactive sessions pass through. It is delivered as the hook's `additionalContext`.
- **The hooks take `--root` and the settings file passes `$CLAUDE_PROJECT_DIR`.** A hook is invoked by the harness, not by a shell someone stood in; trusting `process.cwd()` was a latent break.

## Findings worth keeping

Two defects found by inspection before the gate, both fixed, both worth remembering because **they passed their unit tests**:

- **The ledger had a second writer and was losing its writes** (`5e393a4`). 14d put the guardrail checks in their own process, and flagging a run is one of the things they do — but a long-lived daemon store held an in-memory copy from before the hook ran, so its next write put that copy back and the flag was gone. Reproduced in a scratch script first, then fixed: `RunStore` re-reads before every mutation, making last-write-wins per *mutation* rather than per process. The test suite never saw it because a test has one store. **This does not make two daemons safe** — two writers of the same field still race.
- **`--progress-interval`'s description was a display setting and is not one.** It sets when a run counts as abandoned. Both the flag's help text and the README now say so; ADR-0017 says nobody may make the tick conditional without moving recovery too.

Three things learned from the code that are already written into the artifacts:

- `CLAUDE_CODE_SESSION_ID` is in a session's environment, so a session *can* know its own id without the hook. The hook is still the mechanism, because it also carries the obligation — but this is the cheap fallback if `additionalContext` turns out not to arrive.
- Reading trailers back needed the `git log` format to change: the message is multi-line and the file list follows it, so the two are now delimited (`%x00%H%x01%B%x02`) rather than guessed apart. Covered against real commits, not fabricated evidence.
- The daemon path's guardrail regression risk was covered with **real git repos** (a bare remote, a clone, real commits) rather than fabricated evidence, because the risk in 14d was never in the rules — those are pure functions already shown red — but in the plumbing between two processes.

## Exact next action

**Run [14g](../plans/phases/phase-14.md#sub-phase-14g-live-proof-on-the-pilot) with fvermaut**, against `projects/scratch-app`, `--once` per step. It needs a **fresh ticket whose plan yields several sub-phases**, so execution's sub-agent fleet is real.

Before the first cycle, two things this session could not do:

1. **`npm run build`** — the hooks call `dist/cli.js`, so a stale `dist/` disarms them silently. (It is current as of this handover, but rebuild after any pull.)
2. **Start one throwaway interactive session at the timone root and confirm the `SessionStart` hook fires** — look for the trailer instruction arriving in context, and for a file appearing under `.timone/baselines/`. If it does not fire, nothing else in step 4 will, and the cause is `.claude/settings.json` rather than any of the code.

Then the plan's six steps in order. **Do not shortcut step 3's false-positive check** — letting a long, healthy session run past several heartbeat intervals *without* being reclaimed matters more than the reclaim itself.

**CTA for fvermaut: say when you have time to sit with a live run, and I will start 14g — or say "push" first if you want the eight commits on `origin/main` before the gate.**

## Open questions

- **Does `additionalContext` from `SessionStart` actually reach the session?** Unproven. The fallback is `CLAUDE_CODE_SESSION_ID`, above.
- **Is per-turn `Stop` firing acceptable in practice?** Suppression makes it quiet, but it also means the checks run their git commands after every reply of every session. If that reads as slow at the keyboard, `SessionEnd` is the alternative and would need an ADR-0018 amendment.
- **The two-daemon ledger hazard is still open**, now narrowed: `5e393a4` made two writers of *different* fields safe; two writers of the same field still race. Explicitly out of phase 14's scope.
- **Is reclaim-without-recovery too conservative?** Unchanged from the prior handover: an overnight run that crashes now stops and waits. ADR-0017 names one free automatic re-arm with an attempt counter as what to revisit.
- **R15's re-verification needs both session kinds in one pass.** A daemon-only pass leaves it `draft` — 14h says so explicitly.
- **Every commit before 14e is unmarked**, so absence proves nothing about existing history. Nothing was rewritten, deliberately. This session's own commits from 14e onward carry `Timone-Stage: interactive`.
- Carried unchanged: the real bot identity (needs a credential); only one conversation medium behind the R14 seam; the deferred PRD-01 list (R23 onboarding repair, R24 standards drift); `scratch-app`'s screen-reader HUMAN-CHECK and the guessed 2 ms latency budget; the bounded verify-fix loop has still never fired on the daemon path; Docker previews are now phase 15.
