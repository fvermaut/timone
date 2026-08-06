# ADR-0018: The session bracket belongs to the hooks, not the spawner

- **Status:** accepted
- **Date:** 2026-08-06
- **Source:** grill session of 2026-08-06 — the marker-as-convention grill [phase 13](../plans/phases/phase-13.md) recorded as overdue, brought forward by a live consequence

## Context

R15's guardrails are the deterministic checks on what agents most often silently break: commits left unpushed, `STATUS.md` written anywhere but the default branch, files touched outside the target project. They work. They fired live, they stayed silent on clean runs, and they are `verified`.

**They cover only sessions the daemon starts.** `GuardrailObserver.before()` and `.after()` are called from inside `AgentSessionSpawner`, bracketing `runtime.start`. The baseline is keyed by `run.id`; violations are posted on `run.ticket`. A session fvermaut opens himself at the timone root passes through none of that: it has no run, no ticket, and therefore no baseline, no checks, and no record that it ever happened. `STATUS.md` has carried the gap as a known problem since 2026-08-03 — *"It only covers sessions the machine starts. When you run a stage yourself in a terminal, nothing checks."*

It stopped being theoretical on 2026-08-06. The stray `email-alerts` commit that blocked a build on `scratch-app` came from fvermaut's own interactive R13 test. A daemon-spawned session would have been caught at once by the very rule that was already written, already tested and already running — it simply was not looking at that session.

The gap is not fundamental. It is an artefact of *where the bracket was installed*. And one fact removes the obstacle to moving it: the Agent SDK's `settingSources` **defaults to loading every source** when omitted, and the daemon's runtime omits it. Daemon sessions therefore already read `.claude/settings.json`, `.claude/settings.local.json` and `CLAUDE.md` exactly as an interactive session does. A hook declared in project settings fires for both kinds, uniformly, with no per-kind wiring at all.

The run is still reachable from a hook, too: `store.activate(run.id, started.sessionId)` records the SDK session id on the run, so a hook handed a `session_id` can look up its run — or discover there isn't one, which is exactly the signal that distinguishes the two cases.

The alternatives considered:

- **Leave guardrails machine-only** and rely on a commit trace to make stray work attributable afterwards. Cheapest. The failure recurs; it just becomes diagnosable in seconds rather than hours. Rejected: the checks exist to prevent the thing, and the one time it happened, prevention was what was missing.
- **A hook for interactive sessions only**, daemon keeps its in-process bracket. R15 untouched, no re-verification, one slice. Rejected on the codebase's own stated principle — `pipeline.ts:210` derives `runsUnattended` rather than declaring it *"because it **is** the same fact… Recording it twice would let the two drift."* Two callers of one rule set is that failure, invited. And the interactive path needs a `SessionStart` baseline regardless, at which point it is this ADR's design, implemented twice.
- **Hooks own the bracket for every session** (chosen).

## Decision

**The guardrail bracket is a pair of Claude Code hooks in `.claude/settings.json`, and every session at the timone root passes through it.**

- **`SessionStart` takes the baseline; `Stop` collects the evidence and reports.** These are the same two halves `beforeSession`/`afterSession` are today, hoisted to the one place both session kinds already pass through. `AgentSessionSpawner` stops calling them.
- **The report path is resolved from the session, not configured.** The check looks up `session_id` in the ledger: a run is found → report as today, loudly on the ticket, flagging the run in `timone status`; no run → the session is interactive, and the violation is printed plainly and appended to `.timone/sessions.jsonl`. One implementation, two audiences.
- **`.claude/settings.json` becomes a committed file.** Only `.claude/settings.local.json` exists today and it is gitignored; the bracket is not a personal preference, so it lives in the tracked file where it is reviewable and shared.
- **The baseline is keyed by session id, not run id.** It has to be — an interactive session has no run — and this is what lets one keyed store serve both.

## Consequences

- **The stray-commit failure is caught at its source**, on every session, by the rules that already existed. That is the whole point.
- **R15's mechanism moves, so R15 must be re-verified.** Its criterion currently reads *"GIVEN a daemon-spawned stage session completes"*; that scope widens to every session at the timone root, which changes what the requirement claims. It drops out of `verified` and back to `draft` until a pass observes the new scope on both session kinds. This is a real, named cost of the decision, not an oversight — it was weighed against permanent drift between two copies of the checks and lost.
- **The benign double guardrail call on gate-failure paths disappears** as a side effect. It exists because the spawner calls `after()` from more than one branch of its own control flow; once the bracket is not in that control flow, it cannot double-fire. The tidy item recorded in phase 13's handover closes here rather than separately.
- The daemon no longer owns the checks it depends on, which is a genuine loss of directness: a broken or missing `.claude/settings.json` silently disarms guardrails for daemon sessions too, where previously they were wired in code. Mitigation is that the check command is still Timone's own CLI and still fails loudly; the settings file is committed and reviewed like any other artifact.
- Hooks fire on **every** session at the timone root, including ones doing nothing repository-shaped at all — reading STATUS.md, answering a question. The checks are pure functions over git evidence and a clean tree produces silence, so the cost is a fast no-op, not noise.
- `.timone/` is already gitignored, so the interactive session journal is machine state and never a process artifact — the same standing rule as the ledger.
