# Phase 32 — completion report

> **Plan:** [phase-32.md](../phase-32.md) · **Decision:** [ADR-0050](../../../adr/0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md)
> **Built:** 2026-09-04. **Gate:** [phase-32-live-gate.md](phase-32-live-gate.md).

## What this phase set out to do, and what it did

ADR-0050's bet is that fvermaut should not have to type every Timone fix. Its condition — ADR-0049 built and watched working — was met by phase 31. What stood between the decision and the manifest entry was three guards that would have fired on honest self-run work, plus timone#5.

All four are built. **Timone is a managed project and has been worked as one, once, in a container.** It got three stages of the way and handed back at the fourth, for a reason nobody had written down: [timone#84](https://github.com/fvermaut/timone/issues/84).

## Sub-phases

| | | |
| --- | --- | --- |
| 32a | The daemon says when it is running old code | Built, and **watched firing for real** |
| 32b | The harness-file rule names its exception | Built, and **watched staying quiet on a real commit to `standards/`** |
| 32c | The STATUS.md rule stops crying wolf | Built. **Proved by test, not by the gate** — see below |
| 32d | Timone joins the manifest | Built, cloned, and a real run registered against it |
| 32e | The first self-run, watched | **Partial.** Three of four things; no pull request |
| 32f | Close the phase | This report |

1615 tests pass, up from 1588. The whole suite runs green.

## The requirement registers did not move

**This phase writes no requirement and lapses none**, exactly as the plan said. ADR-0050 is a decision about how Timone is worked on, not a promise about what it does for a project. Nothing was invented to hang it on.

## What the plan got wrong, said plainly

**32c's red-green case (3) describes a case that does not exist.** It asks that `ivtrends`' 2026-08-30 pair be replayed and *"only the true half fires"*. Read against [timone#70](https://github.com/fvermaut/timone/issues/70), **both** halves of that pair are false: both commits were made on `main` and pushed to `main`, and `STATUS.md` was never edited on that branch at all. The test built is the one the evidence supports — the pair is replayed with the issue's own shas, `9e3a056` and `b5eb295`, and **neither** is reported — with a separate case for a status file that really does exist only on a branch. Nothing was silently reinterpreted; this is the reinterpretation.

**Three things the pre-flight did not see.** They are written up in the plan file as findings (e), (f) and (g). One of them stopped the phase:

**Finding (e) blocked 32e outright, and was found only by running it.** `bringUpServices` *threw* when a project committed no compose file, and the throw happens before the container exists, so the spawn is refused. Timone commits none — it is a command-line program with no services beside it. **Every self-run would have failed on its first cycle with a message telling fvermaut to add a database to Timone.** Fixed in `da4a419`: not committing a compose file is a statement, not an omission, so the machine stands nothing up, says so on its log, and carries on. Confirmed live in the gate.

The rule was right for the two projects that existed when it was written. What was wrong was making it a rule about every project — which is the same shape as the two guards this phase was already narrowing, and it was not in the plan.

## What is proved, and by what

**32a and 32b were watched working on a real run.** The out-of-date notice fired on both surfaces because `main` moved under the daemon while phase 32 was being built, and the harness rule stayed quiet on a commit to `standards/baseline/ui-ux.md` that used to produce a finding every time.

**32c was not.** The run wrote no `STATUS.md` — the stage that writes one is delivery, and delivery was never reached. Its two corrections are proved by unit test and by a replay on real git, and by nothing else. That is a weaker claim than the gate was written to make, and it is stated here rather than left to be inferred.

## D2's number

D2 asks for handbacks per merged step ticket. **There is no first reading.** Nothing merged, so the denominator is zero. One handback was seen, and it was about the machinery rather than about the work.

## What is owed next, in order

1. **[timone#84](https://github.com/fvermaut/timone/issues/84) is a decision, not a patch.** Verification of Timone's own work could run 2 of 20 regression checks in a box. Until it is answered, every Timone ticket stops in the same place — so ADR-0050's bet buys three stages and hands back the last mile, which is the mile it exists to save.
2. **Finding (f)**, recorded and not fixed: the workspace and the project are both called `timone` in a finding's own words. One line, and it costs readability on exactly the runs this phase created.
3. **Finding (g)**, recorded and not fixed: a `timone` binary from before this phase can no longer read the ledger, because the state file is a strict object and 32a adds a key. The established pattern, and worth knowing on a machine with an old binary installed.
