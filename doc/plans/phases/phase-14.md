# Phase 14: the machine is watchable — right-sized sessions, visible progress, accountable work

> **Status:** **Approved for execution by fvermaut 2026-08-06.** Execution deliberately deferred to a separate session — the plan was approved at the end of the planning session rather than built in it. Hand-planned 2026-08-06, as all Timone-self phases are (`/timone-plan` targets managed projects only); the plan skill's shape rules — thin vertical slices, declared seams, per-slice validation — are followed, not the instrument. Every decision below was settled at the grill of 2026-08-06 **before** this plan was written, applying the 12e lesson: three became ADRs, one was explicitly declined an ADR against the significance gate.

> **Fourth phase of [PRD-02](../../specs/prd/prd-02-inversion-of-control.md).** Governing decisions: [ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md) (a run's liveness is its heartbeat), [ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md) (the session bracket belongs to the hooks, not the spawner), [ADR-0019](../../adr/0019-timone-authored-commits-carry-a-provenance-trailer.md) (Timone-authored commits carry a provenance trailer). Standing: [ADR-0013](../../adr/0013-stateless-session-reentry.md), [ADR-0007](../../adr/0007-sessions-at-timone-root.md) (every session runs at the root — which is what makes one hook pair reach them all), [ADR-0008](../../adr/0008-manifest-writes-via-cli-command.md) (why the model table is *not* in `timone.yaml`).

> **This phase displaces Docker previews**, which were phase 13's recorded next action. fvermaut chose the displacement on 2026-08-06: the open questions this phase closes have live consequences today, and one of them — an unguarded interactive session — has already cost a blocked build. **Previews become phase 15**, and R11's last clause stays `draft` one phase longer than planned. That cost is stated rather than discovered later.

## Requirements

> **PRD:** [prd-02-inversion-of-control.md](../../specs/prd/prd-02-inversion-of-control.md) — criteria in [prd-02-inversion-of-control.criteria.md](../../specs/prd/prd-02-inversion-of-control.criteria.md)

| ID         | Priority | Requirement (one line) |
| ---------- | -------- | ---------------------- |
| PRD-02.R16 | SHOULD   | Each stage runs on a model and reasoning effort suited to its work |
| PRD-02.R17 | SHOULD   | The daemon shows progress while a session runs, and its authoritative cost when it ends |
| PRD-02.R18 | MUST     | A run orphaned by a crashed daemon is reclaimed, reported and its project freed |
| PRD-02.R19 | SHOULD   | Machine-authored commits are identifiable from git history alone |
| PRD-02.R15 | SHOULD   | *(re-scoped)* guardrails bracket **every** session at the timone root, not only daemon-spawned ones |

**R15 is re-verified, not newly built.** Its three rules are unchanged in substance; what changes is where the bracket lives and therefore what it covers. The requirement drops from `verified` to `draft` on this phase's opening, and 14g is what earns it back — on **both** session kinds in one pass, because the widened criterion is not settled by either alone.

Deliberately **not** this phase: R8/R12 (Docker previews — phase 15) and R11's preview clause with them; the Slack adapter (its own phase, behind the R14 seam); a real bot identity (still needs a credential from fvermaut); **the bug-ticket path into stage 9** — `scratch-app` #4 stays parked at triage exactly as it did through phase 13; **ledger safety under two concurrent daemons** — ADR-0017 makes *reclaim* safe under concurrency but leaves the last-write-wins hazard on `.timone/state.json` untouched, and closing it is a different slice than this phase's.

## Goal Description

A run stops being a black box. While a stage works, the daemon says so every thirty seconds — how long, how many turns, how many tokens, how many sub-agents — and when the stage ends it says what it cost. That same heartbeat is what proves the run alive, so a daemon killed at three in the morning no longer leaves a run wedged `active` forever with its project hostage: the next daemon finds the stale heartbeat, fails the run, says so on the ticket, frees the project and promotes the queue, and `timone retry` brings it back. Each stage runs on a model chosen for its work rather than one default for all of them. And the checks that have been watching the daemon's sessions since phase 11 start watching **every** session at the timone root — including the ones fvermaut runs himself, one of which left the stray commit that blocked a build on 2026-08-06 — while every commit any Timone session makes says in its own message which stage, run and session made it.

**Load-bearing decisions, fixed here so slices don't re-litigate them:**

- **Model and effort are facts of the stage graph, and get no ADR.** `StageSpec` gains `model` and an optional `effort`, alongside `waits`, `ownsBranch`, `built` and `next` — `pipeline.ts` already says the graph holds *"which skill runs, what the run then waits for, and what comes next — and those are facts, not code paths"*, and which model serves a stage is that kind of fact. **The significance gate was applied and failed on its first part**: moving the table to YAML later is a refactor and changing a model is a one-line edit, so there is no ADR and this bullet is the record. `timone.yaml` was rejected on shape as well as cost — it is strictly per-*project* (`projects:` is its only top-level key, a `strictObject`), a per-*stage* setting does not belong there, and ADR-0008 would require a CLI writer built for it.
- **The declared table**, settled at the grill and not to be re-argued slice by slice:

  | stage | model | effort | why |
  | --- | --- | --- | --- |
  | `triage` | `claude-sonnet-5` | `medium` | routes silently — `triage:chore` goes straight to planning while `triage:feature` opens a human interview first, so a misclassification skips a gate |
  | `requirements` | `claude-opus-5` | `high` | the PRD everything downstream is built and verified against |
  | `planning` | `claude-opus-5` | `high` | human-gated, but a bad cut costs a whole phase |
  | `execution` | `claude-opus-5` | `xhigh` | **a fleet** — `timone-execute` spawns one sub-agent per sub-phase and they inherit this row |
  | `verification` | `claude-opus-5` | `xhigh` | the check nobody else performs; correctness over cost |
  | `delivery` | `claude-opus-5` | `high` | **a fleet** — two review axes as parallel fresh contexts |
  | `remediation` | `claude-opus-5` | `high` | coding, on a live pull request |
  | *approval-record* | `claude-haiku-4-5` | *(none)* | stamps a name and a date into an artifact and commits |
  | `clarification` | — | — | **never spawned** — see below |
  | `feedback` | — | — | not built |

- **`clarification` gets no entry, and that is a correctness point rather than an omission.** `spawn()` short-circuits to `openConversation` before reaching `runStage` whenever `runsUnattended` is false, and clarification waits on a conversation. It never calls `runtime.start`. A model on it would be config that nothing reads — the kind of dead setting that later reads as a bug.
- **Haiku 4.5 sends no `effort` at all.** It does not support the parameter and rejects it; `effort` is optional on `StageSpec` for exactly this reason, and the type system carries the constraint rather than a runtime check.
- **There are two spawn sites, not one.** `session.ts:402` (`runStage`) and `session.ts:740` (`recordApproval`). The second is not a `PipelineStage` and needs its own declared model, or it silently keeps the runtime default — which is the whole defect this requirement addresses, surviving in the one place nobody looked.
- **Progress output is append-only, never a repainting line.** `this.log()` already fires *during* a session — guardrail reports at `session.ts:897` and `:910` — and the poll loop logs on its own schedule; a `\r`-repainting line would be shredded by any of them. Append-only also behaves identically in a terminal, a pipe, a `nohup` log and a systemd journal, which a TTY-aware line does not.
- **The live token counter is cumulative *output* tokens, and this is not a detail to optimise later.** Summing per-turn `usage.input_tokens` would report input roughly N× the true prompt on an N-turn session, because every turn resends the whole conversation. A wrong number printed confidently is worse than no number. Authoritative totals — `total_cost_usd`, `modelUsage` — exist only on the final `result` message and belong on the closing line, never on a tick.
- **One tick, two jobs** ([ADR-0017](../../adr/0017-a-runs-liveness-is-its-heartbeat.md)). The progress tick also stamps `heartbeatAt`. `--progress-interval` therefore sets both the print cadence *and* the staleness threshold, and is a correctness setting: nobody may later make the tick conditional — quiet mode, non-TTY suppression — without also moving recovery. The tick must keep stamping even when it prints nothing.
- **Reclaim is not recovery.** A stale run is `failed` with a plain reason and its ticket told; `timone retry` is the way back. A crash mid-stage can leave partial commits on the branch, and a reproducible crash would loop forever. The accepted cost, stated plainly: **an unattended overnight run stops at the crash and waits for fvermaut.**
- **The guardrail bracket moves out of the spawner entirely** ([ADR-0018](../../adr/0018-the-session-bracket-belongs-to-the-hooks.md)). `beforeSession`/`afterSession` are deleted from `AgentSessionSpawner`, not kept alongside hooks — two callers of one rule set is the drift `pipeline.ts:210` names when it derives `runsUnattended` rather than declaring it twice. The bracket works because `settingSources` defaults to loading every source and the daemon's runtime omits it, so daemon sessions already read `.claude/settings.json` exactly as interactive ones do.
- **The report path is resolved, not configured.** The check looks up `session_id` in the ledger — runs already store it, via `store.activate(run.id, started.sessionId)`. A run found means report on its ticket and flag it; no run means print plainly and append to `.timone/sessions.jsonl`. One implementation, two audiences.
- **The trailer convention and its enforcement ship together or neither works.** A convention binds only the sessions that follow it, and an interactive session follows no skill — so a trailer emitted only by the stage skills would re-create precisely the gap it closes. 14e writes the convention; 14d's hook gains the fourth rule that makes it a fact.
- **An accepted consequence, stated rather than hidden:** the hooks fire on *every* session at the timone root, including ones doing nothing repository-shaped — reading `STATUS.md`, answering a question. The checks are pure functions over git evidence and a clean tree produces silence, so this is a fast no-op rather than noise. It is also two extra subprocess spawns per session, which is the price of covering the sessions nobody was watching.

## Context & Prerequisites

- Phase 13 closed 2026-08-06: the loop runs from ticket to merged pull request. 435 tests green, `type-check` clean, `main` pushed.
- **The two open questions this phase closes were both carried out of phase 13's handover**, one of them flagged as overdue. The interactive-session gap is not theoretical: the stray `email-alerts` commit that blocked a build came from fvermaut's own R13 test session.
- **`scratch-app` #4 remains parked at triage** (`triage:bug`, holds no project) and stays parked.
- **No ticket is currently in flight**, so 14g's live proof needs a fresh one — which is convenient, because it wants a run that exercises execution's fleet.
- `.claude/settings.json` **does not exist**; only the gitignored `.claude/settings.local.json` does. 14d creates the tracked file.
- The Agent SDK in use is `@anthropic-ai/claude-agent-sdk@0.3.220`; `options.model`, `options.effort`, `SDKResultMessage.usage`/`modelUsage`/`total_cost_usd`, and non-null `parent_tool_use_id` on sub-agent messages are all confirmed present in its types.

## Sub-phases

### Sub-phase 14a: each stage declares its model and effort (R16)

**[MODIFY]** `src/daemon/pipeline.ts`, `pipeline.test.ts` — `StageSpec` gains `model: string` and `effort?: EffortLevel`; the table above is filled in; `clarification` and `feedback` carry neither. Two accessors join `waitFor`/`ownsBranch`/`isBuilt`: `modelFor(stage)` and `effortFor(stage)`.
**[MODIFY]** `src/daemon/session.ts`, `session.test.ts` — `SessionRequest` gains `model` and optional `effort`; `runStage` fills them from the graph, and `recordApproval` fills them from a declared constant of its own (`APPROVAL_RECORD_MODEL`), never from the runtime default.
**[MODIFY]** `src/daemon/session.ts` — `agentSdkRuntime` passes both to `query()`, omitting `effort` when absent rather than sending `undefined`.

**Seams under test (TDD):** the request the `SessionRuntime` seam receives, per stage, asserted against the declared table — which is the whole point of that seam existing; a stage whose row carries no effort produces a request with **no effort key at all**, not an undefined one; the approval-record session carries its own model; a stage the graph calls built but gives no model is a wiring defect caught by the type system, not at runtime.

> No dependency on other sub-phases.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/pipeline.test.ts src/daemon/session.test.ts
npm run type-check
```

- [ ] Every spawned session carries a declared model — including the approval-record one
- [ ] The Haiku row sends no `effort` field whatsoever
- [ ] `clarification` carries no model, and nothing reads one for it

---

### Sub-phase 14b: the progress heartbeat (R17)

**[NEW FILE]** `src/daemon/progress.ts`, `progress.test.ts` — a `SessionProgress` accumulator fed the SDK message stream: turns taken, cumulative **output** tokens, live sub-agents (from non-null `parent_tool_use_id`), elapsed time; and the closing summary read off the `result` message (`total_cost_usd`, `modelUsage`, `duration_ms`, `num_turns`). Two renderers: the tick line and the closing line.
**[MODIFY]** `src/daemon/session.ts` — `agentSdkRuntime` feeds the accumulator as it consumes the stream, rather than discarding everything but the result; `StartedSession` exposes progress so the spawner can tick it.
**[MODIFY]** `src/daemon/session.ts` — the spawner starts a ticker at `--progress-interval` for the life of a session and clears it in a `finally`, so a failed session never leaks a timer.
**[MODIFY]** `src/commands/daemon.ts`, `src/cli.ts` — `--progress-interval <seconds>`, default 30.

**Seams under test (TDD):** the accumulator over a fabricated message stream — output tokens accumulate and input tokens are **never summed** (asserted directly, because the wrong implementation is the tempting one); sub-agent count rises and falls with `parent_tool_use_id`; the closing line's cost comes from the result message and not from any running total; the tick renders identically regardless of TTY, because nothing consults one; a session shorter than one interval prints no tick and still prints its closing line.

> Sub-phase 14a should be complete first — both touch `agentSdkRuntime`, and taking them in this order avoids a merge of the same function.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/progress.test.ts src/daemon/session.test.ts src/commands/status.test.ts
npm run type-check
node dist/cli.js daemon --help
```

- [ ] Input tokens are never summed across turns — proven by assertion, not by review
- [ ] Cost on the closing line equals the result message's, exactly
- [ ] No cursor control anywhere in the output path
- [ ] The ticker is cleared on every exit path, including failure

---

### Sub-phase 14c: the heartbeat is the run's liveness (R18)

**[MODIFY]** `src/daemon/runs.ts`, `runs.test.ts` — `heartbeatAt` joins `runSchema` as optional (so existing state files load unchanged); `store.heartbeat(id)` stamps it; `store.staleRuns(threshold, now)` returns runs that are `active` or `picked-up` with a heartbeat older than the threshold — **or with none at all**, which is what an older daemon's run looks like; the `active → failed` reclaim edge.
**[MODIFY]** `src/daemon/session.ts` — the 14b ticker also stamps, in the same tick.
**[MODIFY]** `src/daemon/poll.ts`, `poll.test.ts` — before picking anything up, a cycle reclaims stale runs: `store.fail` with a plain reason, `failedComment` on the ticket, project released, queue promoted. Threshold is four intervals.
**[MODIFY]** `src/commands/status.ts`, `status.test.ts` — a reclaimed run reads as failed with its reason, in plain words, with `timone retry` named.

**Seams under test (TDD):** staleness over an injected clock — a fresh heartbeat is never stale however long the run has been `active`, which is the property the startup-sweep alternative could not have; a stale run reclaims exactly once and is idempotent across cycles; reclaim frees the project and promotes a queued run in the same cycle; a reclaimed run then satisfies `timone retry`'s failed-only precondition without any change to that command; a run written before this phase (no `heartbeatAt`) is reclaimable rather than immortal.

> Sub-phase 14b must be complete before starting this sub-phase — the tick it hangs on does not exist before then.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/runs.test.ts src/daemon/poll.test.ts src/commands/status.test.ts src/commands/retry.test.ts
npm run type-check
```

- [ ] A long, healthy session is never reclaimed — the false-positive that would be worst
- [ ] Reclaim frees the project and promotes the queue in the same cycle
- [ ] `timone retry` needs no change to handle a reclaimed run
- [ ] `timone status` explains the reclaim without process jargon

---

### Sub-phase 14d: the guardrail bracket moves to the hooks (R15, re-scoped)

**[MODIFY]** `src/daemon/hooks.ts`, `hooks.test.ts` — the baseline store is keyed by **session id** rather than run id (an interactive session has no run), and persists across processes, since `SessionStart` and `Stop` are separate invocations; `reportGuardrails` gains the no-run path.
**[NEW FILE]** `src/commands/guardrails.ts`, `guardrails.test.ts` — `timone guardrails baseline` and `timone guardrails check`, both reading the hook payload on stdin; `check` resolves `session_id` against the ledger and reports either on the run's ticket (as today) or to stdout plus `.timone/sessions.jsonl`.
**[NEW FILE]** `.claude/settings.json` — **tracked, not local** — declaring the `SessionStart` and `Stop` hooks.
**[MODIFY]** `src/daemon/session.ts`, `session.test.ts` — `beforeSession`/`afterSession` **deleted** from `AgentSessionSpawner`, and every call site with them. The benign double guardrail call on gate-failure paths goes with them.
**[MODIFY]** `src/commands/daemon.ts` — stop constructing the observer for the spawner.
**[MODIFY]** `src/cli.ts` — register the command.

**Seams under test (TDD):** the three existing rules unchanged, still pure functions over injected git evidence, each still shown red; `session_id` → run resolution, and its absence; a violation with a run posts on the ticket and flags the run exactly as before — the regression that matters most, since this slice's risk is breaking what already worked; a violation without a run writes a journal line and prints, and posts nothing anywhere; a clean session of either kind is silent; a `Stop` with no matching baseline says so rather than passing silently.

> Sub-phases 14a–14c are independent of this one, but this is the slice that re-scopes a `verified` requirement — take it after them so a regression here is isolated from three other changes.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/hooks.test.ts src/commands/guardrails.test.ts src/daemon/session.test.ts
npm run type-check
node dist/cli.js guardrails --help
git check-ignore -v .claude/settings.json || echo "tracked, as intended"
```

- [ ] The daemon path behaves exactly as it did before the move — same comment, same flag
- [ ] An interactive violation reaches stdout and the journal, and no ticket
- [ ] `AgentSessionSpawner` no longer mentions guardrails at all
- [ ] `.claude/settings.json` is tracked, and `settings.local.json` still is not

---

### Sub-phase 14e: the provenance trailer (R19)

**[MODIFY]** `src/daemon/prompts.ts`, `prompts.test.ts` — every committing prompt instructs the trailer: `Timone-Stage`, `Timone-Session`, and `Timone-Run` when a run drove it.
**[MODIFY]** the stage skills under `.claude/skills/` that commit — `timone-execute`, `timone-verify`, `timone-deliver`, `timone-improve`, `timone-prd`, `timone-plan`, `timone-adr` — to state the convention where they state their commit shapes.
**[MODIFY]** `src/daemon/hooks.ts`, `hooks.test.ts` — the fourth rule: a commit made between baseline and `Stop` carrying no `Timone-Stage` trailer is a violation, reported like the other three. This is what makes the convention binding on interactive sessions, which follow no skill.
**[MODIFY]** `CLAUDE.md` — the client-repo rule narrowed from "nothing of Timone's" to "no harness *files*", since a trailer now lands in client history.

**Seams under test (TDD):** trailer presence and shape over fabricated commits — a run-driven commit carries three lines, an interactive one carries two with `Timone-Stage: interactive` and no `Timone-Run`; the absence of a trailer is a violation while a pre-existing commit outside the session window is not; `Co-Authored-By` is untouched; prompt construction carries the obligation for every committing stage.

> Sub-phase 14d must be complete before starting this sub-phase — the fourth rule needs the bracket that runs it.

#### Agent Validation Steps

```bash
npx vitest run src/daemon/hooks.test.ts src/daemon/prompts.test.ts
npm run type-check
git log -1 --format=%B    # this phase's own commits carry it
```

- [ ] An untrailed commit is caught, and a commit from before the session is not
- [ ] `Timone-Stage: interactive` is emitted where no run exists, so absence is never ambiguous
- [ ] `CLAUDE.md` and R2 now say the same thing about what may reach a client repo

---

### Sub-phase 14f: `timone status` and the ledger tell the new truths

**[MODIFY]** `src/commands/status.ts`, `status.test.ts` — a running stage shows its model and how long it has been running, so the thing the daemon prints and the thing `status` reports agree; a reclaimed run says what happened in plain words.
**[MODIFY]** `README.md` — `--progress-interval` and what its two jobs are; what a reclaimed run looks like and that `timone retry` is the way back; the trailer convention and how to audit a repo with it; that guardrails now cover sessions fvermaut starts himself.

**Seams under test (TDD):** status rendering for a running run, a reclaimed run and a healthy long-running one, each in words that assume no process knowledge (12c's discipline).

> Sub-phases 14a, 14c and 14e must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
npx vitest run src/commands/status.test.ts
npm run type-check
node dist/cli.js status
grep -n "progress-interval\|Timone-Stage" README.md | head
```

- [ ] Nothing in `status` output requires knowing what a stage or a marker is
- [ ] The README says `--progress-interval` changes recovery, not just output

---

### Sub-phase 14g: live proof on the pilot

**Seams under test (TDD):** no Timone code — the seam is the observable end state of the live run.

> All prior sub-phases must be complete before starting this sub-phase.

Against `projects/scratch-app`, `--once` per step so every transition stays inspectable. A fresh ticket is needed, and it should be one whose plan yields several sub-phases, so execution's fleet is real.

1. **R16:** file and mark a ticket; let it run to the plan gate. Expect triage on Sonnet and requirements and planning on Opus, confirmed from the daemon's own output rather than inferred, and the approval-recording session on Haiku after fvermaut approves the PRD.
2. **R17:** during execution, expect a tick roughly every thirty seconds naming elapsed time, turns, output tokens and a sub-agent count that actually moves as `timone-execute` fans out; then one closing line whose cost matches the session's. Re-run once with `> daemon.log` and confirm the file's content is identical to what the terminal showed.
3. **R18:** kill the daemon mid-execution with `SIGKILL` — not a graceful stop, which proves nothing. Restart it. Expect the next cycle to reclaim the run, comment on the ticket, free the project, and `timone status` to say so in plain words; then `timone retry` re-arms it and it carries on. **Then the false-positive check, which matters more:** let a long execution session run past several intervals untouched and confirm nothing reclaims it.
4. **R15, both kinds in one pass** — this is what earns the requirement back. **Daemon side:** force one violation in a daemon session and confirm the loud ticket comment and the flagged run, unchanged from phase 11's behaviour. **Interactive side:** fvermaut opens a session himself at the timone root, commits something stray — deliberately reproducing the 2026-08-06 accident — and confirms the `Stop` hook catches it, prints it, and writes the journal line. Then a clean session of each kind, confirming silence.
5. **R19:** inspect the trailers on the phase's commits in `scratch-app` and on fvermaut's own interactive commit; confirm `git log --grep=Timone-Stage` lists the machine-authored work and that `git log --stat` still matches no harness path.
6. **The whole loop still works.** Take the ticket the rest of the way to a merged PR. Nothing in this phase should have changed the pipeline's behaviour, and the way to know is to watch it.

#### Agent Validation Steps

```bash
node dist/cli.js daemon --once
node dist/cli.js status
node dist/cli.js retry scratch-app#N
git -C projects/scratch-app log --grep=Timone-Stage --oneline | head
git -C projects/scratch-app log --stat --all | grep -cE "\.claude/|timone\.yaml"   # expect 0
cat .timone/sessions.jsonl
```

- [ ] Steps 1–6 each observed, evidence captured for the completion report
- [ ] A healthy long session was **not** reclaimed — the false positive checked, not assumed
- [ ] Both session kinds were guarded in the same pass, which is what R15's new criterion demands
- [ ] **Human gate:** fvermaut confirms the daemon's output tells him what he wants while a run is working, and that the interactive-session check would have caught the commit that blocked his build

---

### Sub-phase 14h: documentation and close

**[MODIFY]** `doc/specs/prd/prd-02-inversion-of-control.criteria.md` — after 14g's gate: R16–R19 as warranted, and **R15 back to `verified` only if both session kinds were observed** — a daemon-only pass leaves it `draft` with the gap named, because that is exactly the evidence limit the re-scope created.
**[MODIFY]** `STATUS.md` — phase 15 (Docker previews) named as next, and the two open questions this phase closes struck from the known-problems list.
**[NEW FILE]** `doc/plans/phases/reports/phase-14-complete.md` — carrying forward what this phase deliberately did not close: the two-daemon ledger hazard, and whether reclaim-without-recovery proves too conservative for genuinely unattended overnight runs.

**Seams under test (TDD):** no behaviour-carrying code; validation is checklist-based.

> All prior sub-phases must be complete before starting this sub-phase.

#### Agent Validation Steps

```bash
grep -n "Status:\*\* verified" doc/specs/prd/prd-02-inversion-of-control.criteria.md
grep -n "R15" doc/specs/prd/prd-02-inversion-of-control.criteria.md | head
```

- [ ] R15 flips back only on two-kind evidence, with the limit written in if not
- [ ] The report names what this phase left open rather than implying it closed everything

## Dependency graph

```
14a → (none)        model + effort per stage (R16)
14b → 14a           the progress heartbeat (R17)
14c → 14b           heartbeat as liveness, orphan reclaim (R18)
14d → (none)*       the guardrail bracket moves to hooks (R15 re-scoped)
14e → 14d           the provenance trailer + its enforcing rule (R19)
14f → 14a,14c,14e   status + README tell the new truths
14g → all prior     live proof on scratch-app, human gate
14h → 14g           docs last + register flips

* 14d is technically independent, but is sequenced after 14a–14c so that a
  regression in the one slice touching a verified requirement is isolated.
```
