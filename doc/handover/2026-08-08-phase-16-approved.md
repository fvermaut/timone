# Handover — Timone — 2026-08-08

> Prior handover: [2026-08-08-phase-15-closed.md](2026-08-08-phase-15-closed.md). Its "Exact next action" — *record the ADR, then plan phase 16, in that order* — **is what this session did**, and then fvermaut changed the shape of the result. Same date, third session.

## Snapshot

**Phase 16 is approved and ready to execute; nothing has been built yet.** Two ADRs were recorded, a grill settled a question open since 2026-07-19, and the phase that was planned as one was **split in two on fvermaut's decision**: [phase 16](../plans/phases/phase-16.md) is **previews and nothing else** (approved for execution), [phase 17](../plans/phases/phase-17.md) is the liveness/clock fix (planned, **parked, not seeking approval**). Three commits, `19c8d67`..`ee5b1ff`, all pushed; `main` level with `origin/main`, **539 tests green**, `type-check` clean. **No source file was touched this session** — it is entirely documentation. **The next move is Timone's**: execute phase 16.

## Done this session

- **[ADR-0020](../adr/0020-liveness-is-judged-only-over-witnessed-time.md)** — liveness is judged only over witnessed time. **Supersedes [ADR-0017](../adr/0017-a-runs-liveness-is-its-heartbeat.md)**, whose status line is flipped and whose body is untouched. **Timone's first supersession**, so it is also the precedent for how the next one is done.
- **[ADR-0021](../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)** — previews are reconciled behind an adapter seam. Settles the exposure model [PRD-02](../specs/prd/prd-02-inversion-of-control.md) deferred with *"settle when building R8"*.
- **A hand-run grill on preview exposure** — four questions, one at a time. Its output is ADR-0021 plus two glossary terms (**Preview**, **Preview adapter**) in [CONTEXT.md](../../CONTEXT.md).
- **[Phase 16](../plans/phases/phase-16.md) planned and approved** — six slices, previews only.
- **[Phase 17](../plans/phases/phase-17.md) planned and parked** — written at the moment of the split so ADR-0020's decision does not evaporate.
- **[STATUS.md](../../STATUS.md) corrected where it had gone stale** — it still asked fvermaut to make a decision he had already made, and still said the next move was Timone's own planning.

## In flight / blocked

- **Nothing is blocked.** Phase 16 needs no further input to start.
- **Phase 17 is deliberately parked** and must not be started or approved alongside phase 16.
- **`scratch-app` #10 and #13 still `failed`, #4 still parked at triage** — untouched, exactly as the prior two handovers left them.

## Decisions made this session

- **The liveness fix: the daemon witnesses its own absence.** Recorded in [ADR-0020](../adr/0020-liveness-is-judged-only-over-witnessed-time.md); do not re-derive it from 15a's five options. **The trap 15a warned about held**: the obvious-looking monotonic tick was rejected because it is display-only and cannot follow into a persisted ledger other processes read.
- **The preview seam is reconciliation, not commands.** [ADR-0021](../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md). Triggered by fvermaut's answer that he wants to end up on **a managed platform like Vercel**, which turned the seam from hypothetical into load-bearing.
- **Exposure was dissolved rather than answered** — because `ensure` returns the URL, addressing is adapter-local and not a Timone-wide decision. First adapter serves `localhost`; **phone review is explicitly not delivered** and that goes on R8.
- **Real data in previews is refused outright**, so "make previews realistic" never becomes the reason a production copy appears.
- **fvermaut split the phase, previews first**, judging the liveness defect *"more a bug I can live with"* — with the measurement in hand, not in ignorance of it. **Previews are not displaced again.**
- **Found while planning: R8's criterion presupposes a "preview stage" that will not exist.** The same fault 15d fixed in R18, found the same way. It is sub-phase 16a.

## Exact next action

**Execute [phase 16](../plans/phases/phase-16.md), starting with 16a or 16b** (they are independent; **16b is the long pole and everything downstream waits on it**, so do not sequence it last of the two).

**Timone's own execution stays hand-run** — `/timone-execute` targets managed projects only, and `/timone-improve` is not the route for Timone's own defects.

**Three constraints an executing agent will otherwise get wrong**, all recorded in the phase file and repeated here because they are the expensive ones:

1. **Do not tidy the ADR-0017 citations in `src/`** (`progress.ts`, `runs.ts`, `poll.ts`, `commands/daemon.ts`). They are still **correct** — they describe behaviour that has not changed. Updating them is phase 17's, and doing it early makes the code claim a fix that does not exist.
2. **16e must be driven attended, lid open**, and its evidence must say so. Previews reconcile per poll cycle, so proving R8/R12 needs a *continuous* daemon rather than the `--once` cycles every previous gate used — and the liveness defect is still present.
3. **16b's contract with Docker is the argument vector**, asserted verbatim against an injected fake. A wrong flag there is invisible until the live gate.

**The operational warning stands, unchanged and now for longer:** do not leave `timone daemon` running unattended overnight on a laptop that sleeps. **Phase 16 earns no right to strike it** — only phase 17's gate does.

## Open questions

- **Does a preview's changing port matter?** New. The adapter reads its port from `docker compose port` rather than allocating one, so **the URL is not stable across a rebuild**; the PR comment is updated in place instead. Flagged to fvermaut at approval and not objected to — resolved by 16e's gate if it turns out to grate in practice.
- **Why did the token counter freeze at 4.7k for four hours while replies advanced 8→22?** Unchanged, and now unaddressed by **either** phase. 5.8× under-reporting on a stage that spawned **no** sub-agents. It is why R17 may not close even in phase 17.
- **Should `duration_api_ms` be used at all?** Carried to phase 17, which decides it deliberately by leaving it unread rather than by omission.
- **Can sub-agent output tokens be obtained honestly?** Unchanged — the obvious fallback is the source 14b rejected for under-reporting ~30×.
- Carried unchanged: the real bot identity (needs a credential); one conversation medium behind the R14 seam; the deferred PRD-01 list (R23, R24); `scratch-app`'s screen-reader HUMAN-CHECK; the **two-daemon ledger hazard**, which **16c widens slightly** by adding `previews` to what two daemons would clobber; **reclaim-without-recovery** conservatism.
- **Closed by this session:** how the sleeping-laptop fault gets fixed (ADR-0020); how previews are addressed and who owns them (ADR-0021); whether previews and the liveness fix ship together (**no** — split).

## A habit this session earned

**Read the artifact before designing around it.** The preview half looked like a large build until `scratch-app`'s `compose.yaml` was actually opened — whose header says outright that it *"doubles as the definition the PR-preview adapter runs on our own host"*, with interpolated host ports, prefixed volumes, a gated migrate job and a readiness healthcheck already in place. **The client repo had been ready for this for weeks**, which turned an allocation scheme into `APP_PORT=0` and a seeding mechanism into a compose profile.

The same reading killed two questions that were about to be asked: the standards library already fixes the per-project port block, and `manifest.ts` already carries the binding slot. **This is 15a's lesson in a second key** — there, the operating system's own sleep log beat every experiment; here, the repository's own files beat the design session. **Look for an existing record before building anything, including a question.**
