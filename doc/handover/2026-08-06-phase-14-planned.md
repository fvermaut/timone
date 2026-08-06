# Handover — Timone — 2026-08-06 (second session of the day)

> Prior handover: [2026-08-06-phase-13-closed.md](2026-08-06-phase-13-closed.md). Its "Exact next action" was *plan phase 14: Docker previews* — **that is superseded**, not done. fvermaut displaced previews on 2026-08-06; read this file instead.

## Snapshot

**A grill session settled four decisions and produced a phase 14 plan, which fvermaut approved on 2026-08-06 — asking explicitly that it be built in a separate session.** Nothing was built. The working tree carries three new ADRs, four new PRD-02 requirements, a re-scoped R15, the approved phase file and STATUS.md edits. 435 tests green, `type-check` clean (documentation-only changes; no source was touched).

**Read this before touching anything:** whether these artifacts are committed depends on what fvermaut answered at the very end of the planning session. `git status` on `main` is the source of truth — if the ADRs, `phase-14.md` and the PRD-02 changes are untracked or modified, they are this session's work and are correct as they stand; commit them as one `docs:` commit before starting 14a rather than mixing them into a build commit.

The session began from fvermaut's own framing: *"let's address the most urgent open questions"* plus two new asks — per-run model/effort, and minimal daemon progress output. He confirmed all four items in scope and chose to displace Docker previews to phase 15.

## Done this session

- **Grilled four topics to resolution**, one question at a time, each answer grounded in the codebase first. Three passed the ADR significance gate and were recorded as standalone ADRs at decision time; one was explicitly declined an ADR and recorded as a load-bearing decision in the plan.
- **[ADR-0017](../adr/0017-a-runs-liveness-is-its-heartbeat.md) — a run's liveness is its heartbeat.** The progress ticker also stamps `heartbeatAt`; staleness reclaims an orphaned run. Chosen over a startup sweep (wrong under two daemons) and a manual `--force` (useless to an unattended daemon). Reclaim **fails** the run rather than resuming it.
- **[ADR-0018](../adr/0018-the-session-bracket-belongs-to-the-hooks.md) — the session bracket belongs to the hooks.** `SessionStart`/`Stop` hooks in a newly tracked `.claude/settings.json` replace `beforeSession`/`afterSession` in the spawner, so guardrails cover interactive sessions too. Unblocked by one fact: **`settingSources` defaults to loading every source** and the daemon's runtime omits it, so daemon sessions already read project settings identically.
- **[ADR-0019](../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md) — commits carry `Timone-Stage` / `Timone-Run` / `Timone-Session`.** Extends `MACHINE_MARKER` from ticket comments to git history. Its enforcement is ADR-0018's fourth hook rule — the two ship together or neither works.
- **PRD-02 gained R16–R19 and R15 was re-scoped** and dropped from `verified` to `draft`, deliberately and with the reason written in.
- **[Phase 14 planned](../plans/phases/phase-14.md)** — eight sub-phases, 14a–14h, with the model/effort table fixed in the plan so slices don't re-argue it.

## Decisions made this session

Beyond the three ADRs:

- **The model/effort table lives in `StageSpec`, not `timone.yaml`** — the graph already holds facts about stages, and the manifest is strictly per-*project*. **No ADR:** fails the significance gate's first part (a one-line edit to reverse). The chosen table is in the phase plan.
- **`triage` runs on Sonnet, not Haiku.** It was Haiku in the first draft; the code changed the answer. A `triage:chore` label routes straight to planning while `triage:feature` opens a human interview first, so a misclassification silently skips a gate. The genuinely mechanical session is `recordApproval`, and that is the Haiku row.
- **Progress output is append-only, never repainting** — `log()` already fires mid-session from the guardrails and would shred a repainting line.
- **The live counter is cumulative *output* tokens.** Summing per-turn `input_tokens` would over-report by roughly N× on an N-turn session, because every turn resends the conversation. Recorded in the requirement so it is not "fixed" into a wrong number later.

## Findings worth keeping

Three came out of grounding and are already written into the artifacts:

- **`clarification` never spawns a session.** `spawn()` short-circuits to `openConversation` before reaching `runStage`. Any per-stage session config on it would be dead. (Its prompt exists in `PROMPTED_STAGES` and appears to be reachable only via `recordApproval` — **worth a look; not chased this session**.)
- **There are two `runtime.start` sites**, not one: `session.ts:402` and `session.ts:740`. The second is the approval-recording session and is not a `PipelineStage` — it needs its own model or it silently keeps the default.
- **PRD-02's declined-observability bullet contradicted R17/R18** and was narrowed rather than left to disagree: what stays declined is *persisted, queryable, citable* run history; ephemeral output and one liveness field are not that. `.timone/sessions.jsonl` sits closest to the line and is bounded by the same rule.

## In flight / blocked

- **Check `git status` first** — see the Snapshot. The planning artifacts may or may not have been committed at the close of the planning session.
- **`scratch-app` #4 remains parked at triage** (`triage:bug`), holds no project. Unchanged.
- **No ticket is in flight**, so phase 14's 14g live proof needs a fresh one — ideally one whose plan yields several sub-phases, so execution's sub-agent fleet is real.

## Exact next action

**Execute [phase 14](../plans/phases/phase-14.md), starting at 14a.** The plan is stamped `Approved for execution by fvermaut 2026-08-06`; the approval gate is passed and nothing else is waiting on him.

Order is `14a → 14b → 14c`, then `14d → 14e`, then `14f`, then the live gate at `14g` and the close at `14h` — the dependency graph at the foot of the plan is normative. Two sequencing notes that are easy to lose:

- **14a before 14b** — both touch `agentSdkRuntime`, and this order avoids merging the same function twice.
- **14d is technically independent but deliberately sequenced fourth**, so a regression in the one slice that re-scopes a `verified` requirement (R15) is isolated from the three changes before it.

**Do not shortcut 14g.** Its false-positive check — letting a long, healthy session run past several heartbeat intervals *without* being reclaimed — matters more than the reclaim itself, and R15 only returns to `verified` if both session kinds are observed in one pass. A daemon-only pass leaves it `draft`, and 14h says so.

## Open questions

- **The two-daemon ledger hazard is untouched.** ADR-0017 makes *reclaim* safe under concurrency; nothing makes `.timone/state.json` safe under concurrent writes — two daemons still clobber each other last-write-wins. Explicitly out of phase 14's scope.
- **Is reclaim-without-recovery too conservative?** An overnight run that crashes now stops and waits. The escalation already discussed is one free automatic re-arm with an attempt counter; ADR-0017 says it is what to revisit.
- **R15's re-verification needs both session kinds in one pass.** A daemon-only pass leaves it `draft` — 14h says so explicitly, so the phase cannot quietly close on half the evidence.
- **Every commit before this convention lands is unmarked**, so absence proves nothing about existing history. Nothing is rewritten.
- Carried unchanged from the prior handover: the real bot identity (needs a credential); only one conversation medium behind the R14 seam; the deferred PRD-01 list; `scratch-app`'s screen-reader HUMAN-CHECK and the guessed 2 ms latency budget; the bounded verify-fix loop has still never fired on the daemon path.
- **Closed by this session's plan** (were open questions in the prior handover): interactive sessions leaving no trace and no guardrails; a crashed daemon having no recovery path; the benign double guardrail call, which 14d deletes as a side effect.
