# Phase 35 — live gate

> **Plan:** [phase-35.md](../phase-35.md) · **Verification:** [phase-35-verification.md](phase-35-verification.md), which named this gate as owed · **Decision:** [ADR-0051](../../../adr/0051-timone-verifies-itself-by-live-gate-and-a-regression-set-is-narrowed-by-what-it-depends-on.md), [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md)
> **Run:** 2026-09-06 into 2026-09-07, on the **scratch-app fixture**, supervised from fvermaut's terminal, session `a0e62450-20e3-455d-8ca0-bcfa216f3ef9`.
> **Timone under test:** branch `timone/105-1-the-run-carries-on-instead-of-stopping` @ `c026c7d`.

## What this gate reached, in one line

The three promises phase 35 claims were watched on a real daemon: **R3 and R5 pass, and R1 does not — clause 1 was seen working repeatedly, but clause 3 does not do what the register says, and clause 2 was never triggered.** The divergence is a real finding a terminal could not have produced.

## Why a fixture, and how it was set up

ADR-0051 fixed that Timone verifies its own build stages only by a supervised live run, and [live projects are never the fixture for it](https://github.com/fvermaut/timone/issues). So the gate ran on `scratch-app`, the throwaway to-do app, on a real `timone daemon` reading the real ledger and manifest, building each run in a container.

- fvermaut's own daemon (pid 12993, started 09:44) was stopped with `SIGTERM` while nothing was in flight (only a stale queued run for the already-abandoned fixture `#48`, whose pickup label had been removed first). The gate daemon (pid 22892) ran the `c026c7d` build and was stopped with `SIGTERM` at the end; its lock is gone and no `timone-*` container is left running.
- Two fixture tickets were written, machine-typed and declared as such on the tickets:
  - **[scratch-app#50](https://github.com/fvermaut/scratch-app/issues/50)** — "show how many are left in the browser tab", seeded with a wrong fact (it cited a function that does not exist and gave an empty-state rule the app contradicts), to make a build meet a contradiction.
  - **[scratch-app#51](https://github.com/fvermaut/scratch-app/issues/51)** — "find a to-do by typing", carrying a verbatim signed acceptance test of layered Unicode-folding cases, to make a build meet a hard, unchangeable check.
- The spent fixtures from the earlier one-ticket-per-step demo (`#45`–`#48`) were taken out of the daemon's reach first, so they could not be picked up as live work.

Both tickets were driven the whole way by typed replies on the tickets — every question the process asked was answered in writing from the terminal, never by a takeover. The machine cut each feature into two steps of its own accord (`#50`→`#52`,`#53`; `#51`→`#55`,`#56`), and it found and fixed, on its own, a defect nobody had reported: `scratch-app`'s `main` branch did not compile (`remaining-count.tsx` called `getTodos()` with no argument after the labels work), so it made the repair its own first step.

## The runs, end to end

Every run was pinned at `c026c7d` (the branch under test) — see the pin note under *An instrument fault the gate hit*, which explains the one run that briefly was not.

| Run | What it was | Path | Ended at |
| --- | --- | --- | --- |
| `#50` | requirements for the tab count | triage → clarification → requirements → breakdown | approved artifacts merged to `main`; cut into `#52`, `#53` |
| `#52` | piece 1: repair the count line, make it follow the filter | planning 13m → execution 37m → verification 45m (clean, 0 fix loops) → delivery | **[PR #54](https://github.com/fvermaut/scratch-app/pull/54), merged** |
| `#53` | piece 2: the count in the tab title | planning 6m → execution 1h01m → verification 1h03m → delivery | **[PR #59](https://github.com/fvermaut/scratch-app/pull/59), closed unmerged** (see R1 clause 3) |
| `#51` | requirements for the search box | triage → clarification → requirements → breakdown | approved artifacts merged to `main`; cut into `#55`, `#56` |
| `#55` | piece 1: the matching rule + the signed test | planning 5m → execution 18m → verification 21m (clean) → delivery | **[PR #57](https://github.com/fvermaut/scratch-app/pull/57), merged** |
| `#56` | piece 2: the search box on the page | planning 12m → execution 1h15m → verification 43m → delivery | **[PR #58](https://github.com/fvermaut/scratch-app/pull/58), merged** |

Not one of these stopped, asked, or entered a waiting state between its last human agreement (the approved breakdown) and its pull request. That is R1 clause 1's headline, watched four times over.

## What each promise did

### PRD-03.R1 — the build has one ending: a pull request — **NOT PASSED**

**Clause 1 (a run past agreement adapts and carries on; no question, no waiting state, reaches a PR): PASS, watched repeatedly and organically.** Two builds hit real trouble and neither stopped:

- **`#53` execution** met a plan step it could not follow: the plan said key the title-setting effect on `[text]`, and measured red-green that this silently reverted the tab to `"Todos"` after every mutation. It **amended the plan in place with a dated marker naming the run, wrote a departure record, and carried on** — see [phase-09-departures.md on the `#53` branch](https://github.com/fvermaut/scratch-app/blob/timone/53-2-the-count-in-the-browser-tab/doc/plans/phases/reports/phase-09-departures.md).
- **`#56` execution** met two: a validation step it could not run (no Docker for the database in the box), and a requirement (R8) whose fix answered a deliberately-open question as a side effect. It **substituted an equivalent build check, recorded both departures with dated markers, documented the foreseen failing tests, and carried on to a pull request** — [phase-10-departures.md on the `#56` branch](https://github.com/fvermaut/scratch-app/blob/timone/56-2-the-search-box-on-the-page/doc/plans/phases/reports/phase-10-departures.md).

This is exactly the behaviour phase 35 built, seen in the wild rather than in a unit test.

**Clause 2 (retries exhausted, tests still failing → the PR still opens, saying first-thing it does not pass): NOT TRIGGERED.** No run's own work ever failed its own tests — the hard signed test in `#55` passed, and `#56` shipped with only pre-existing, unrelated failures, named. The behaviour behind this clause is unit-tested in phase 35 (`timone-deliver` no longer refuses on a failed or blocked register), but this gate did not observe it. It remains owed.

**Clause 3 (a PR closed unmerged → nothing further committed to the branch, and the rejection re-enters as a new request anchored on the PR's discussion): DIVERGES from the register.** `#53`'s PR `#59` was closed unmerged on purpose (it could not merge anyway — see the numbering finding below). Watched:

- Nothing further was committed to the branch — **holds** (its tip `60f1bc5` was identical before and after).
- The requirements on `main` were unchanged — **holds** (the PRD-05 files' digests were identical before and after).
- **But the rejection did not re-enter as a new request.** The daemon instead parked the ticket, applied `timone:held`, and asked the human to choose: close the ticket, remove the label to rebuild, or reopen and merge by hand. Its reason is sound — *"a close by hand can mean the work was wrong, or it can mean the close was a mistake, and I cannot tell which"* — but it is **not what the criterion says**, and it is a stop where the register promises automatic re-entry.

**Because clause 3 diverges and clause 2 was never seen, R1 is not passed by this gate.** Its register status stays `draft`. The register-versus-behaviour question is fvermaut's to settle, and is filed as a defect.

> ✏ 2026-09-07 — resolved. fvermaut chose ([timone#111](https://github.com/fvermaut/timone/issues/111)) to **reword the criterion to the stop-and-ask that exists** rather than change the code to re-enter automatically. Clause 3 now matches what this gate observed and passes; R1 moved to `verified` on clauses 1 and 3, with clause 2's own-tests-red case the one spot still resting on the unit test plus the partial sighting (delivery opened scratch-app#58 on a red suite).

### PRD-03.R3 — mid-build amendments carry their marks — **PASS**

Watched twice, in `#53` and `#56` (the departure records above). Each amendment was committed on the work branch with a dated marker naming the run (`✏ … (build, scratch-app#NN)`), and the original wording stayed readable. The merged-versus-closed half of the clause was also exercised: `#55`/`#56`'s amendments merged into `main` with their PRs and stand there; `#53`'s died with its closed branch, and `main` was unchanged. Its status moves `draft` → `verified`.

### PRD-03.R5 — no question without the power to act on its answer — **PASS**

Every typed reply moved the work, and at no point was a written answer met with "run this command instead". Watched across many rounds: `#50` and `#51` each went question → typed answer → the next cycle acted on it, through clarification, a requirements check-back, a requirements approval and a breakdown approval. Two of the replies granted something unusual — a scope trim ("no clear button, no shortcuts, no highlighting — drop them") and a correction that removed a planned behaviour (no URL persistence) — and both were carried into the written requirements. Its status moves `draft` → `verified`.

## Faults the gate found, all filed separately

- **R1 clause 3 diverges** (above) — the headline finding; only a live close-and-watch could produce it.
- **Parallel breakdown pieces collide on process-artifact names.** `#53` and `#55`/`#56` each numbered themselves `phase-09`/`phase-10` and both edited the shared probe runner, so `#59` could not merge into `main` — every conflict was a process artifact, not source. Phase numbers are allocated per branch with nothing shared.
- **A boxed run is pinned at the host working tree's HEAD, which another process can move.** Mid-gate, a second session sharing this one checkout moved HEAD from the branch back to `main`; the next run was re-pinned at the pre-fix commit. Caught before it reached a build stage (the pre-build skills are identical between the two commits) and corrected, but a run reaching execution on the wrong commit would have run the old stop-and-park skills and read as a false failure.
- **A borrowed model login has a hard ceiling a long run crosses.** The 8-hour token expired mid-gate twice, killing a verification session after an hour of work; the daemon's own advice is `claude setup-token`.
- **The container name race** already filed as [timone#73](https://github.com/fvermaut/timone/issues/73) fired again, and its automatic second attempt re-raced the same removal, spending the whole retry budget so a human `timone retry` was needed.

## An instrument fault the gate hit

The gate was slower and more hands-on than it should have been, and none of it was the behaviour under test:

- **Two token expiries** cost roughly 20 minutes of dead waiting and two re-armed runs.
- **The HEAD-pin race** cost the attention described above.
- A single small build step (`#53`, one component and one pure function) took 68 minutes of wall time, of which about 42 were shell commands in the box — 12 of those dead, waiting on a token refresh, and ~22 re-running the full browser suite eight times. This is filed as [timone#110](https://github.com/fvermaut/timone/issues/110).

## Cost

About **$120** of model spend across the runs, roughly six hours of machine time end to end, on top of the ~20 hours the ticket had already spent stopped before the gate began.
