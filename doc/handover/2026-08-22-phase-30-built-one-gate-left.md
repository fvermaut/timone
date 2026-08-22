# Handover — Timone — 2026-08-22

> Prior handover: [2026-08-21-phase-29-shipped-phase-30-next.md](2026-08-21-phase-29-shipped-phase-30-next.md)

## Snapshot

**Phase 30 is built: eleven of twelve slices.** 30a, 30b, 30c, 30d, 30h, 30i, 30j, 30k and 30l were done this session; 30e, 30f and 30g were already on `main`. The branch is `phase-30-work-in-a-box`, [PR #53](https://github.com/fvermaut/timone/pull/53), not merged.

**The container runtime is the default.** `--runtime in-process` puts a daemon back the old way in one word.

**1384 tests, all green.**

**One thing is left and it is fvermaut's**: 30k's live gate — one real marked ticket driven end to end, and the human gate he has to judge himself. Everything that does not need him is done.

## Done this session

Every slice has a `✅ Built 2026-08-22` block in [phase-30.md](../plans/phases/phase-30.md), and the [completion report](../plans/phases/reports/phase-30-complete.md) carries the whole picture, including the honest split between what was watched and what is only tested.

- **30a** — Timone acts under its own identity. Tokens are minted per repository, scoped from the command's own `--repo`.
- **30b** — branch state from the forge. Fixes [#47](https://github.com/fvermaut/timone/issues/47), [#48](https://github.com/fvermaut/timone/issues/48).
- **30c** — chunk zero merges on the forge. Fixes [#49](https://github.com/fvermaut/timone/issues/49).
- **30d** — the daemon resolves no path under `projects/`; `src/guards/checkouts.test.ts` keeps it that way.
- **30h** — the container runtime, plus the `--runtime` / `--image` switch.
- **30i** — the project's compose stack, private network, nothing published.
- **30j** — the browser leg, proven identical in the box and out of it.
- **30k** — default flipped; four of six live checks watched.
- **30l** — `mergeIntoDefault` deleted, R23 marked with evidence, [#19](https://github.com/fvermaut/timone/issues/19) closed against observation.

## Exact next action

**Ask fvermaut to run 30k's gate.** It is item 1 in `STATUS.md` and it is about five minutes:

```
node dist/cli.js daemon
```

…on a marked `scratch-app` ticket, and **while it builds he switches branch in `projects/scratch-app` and leaves it there**. Afterwards: `git status` and the reflog in that folder show no movement, R15's provenance check reported nothing false across the run, and — the part no test can assert — he says whether he still had to think about it.

**Two things to tell him before he runs it:** a boxed run will not follow a Timone commit he has not pushed (it refuses readably), and it borrows his Claude login fresh at each spawn.

Then merge PR #53.

## Open questions

- **Blocker (d), CI.** Still open, still his: a workflow he commits by hand once, because the App deliberately cannot write one.
- **`ivtrends` commits no compose file**, so 30i refuses a boxed run on it. It needs that file before it can be built again.
- **Four things are tested but unwatched** — see the completion report: clause 2 under a real daemon run, two runs an hour apart, R15 across a whole run, and container teardown after a failed and a killed run.
- **Three older rules, still unanswered** — see `STATUS.md`: the unlabelled-ticket contradiction, the 14 August give-up rule, and [#32](https://github.com/fvermaut/timone/issues/32).

## What running it found that reading it did not

Five faults. Three share a shape: **an absent answer and a wrong question look identical.**

1. A transport failure read as an absent branch — *the stage produced nothing* (30b).
2. `docker compose down` with no `COMPOSE_PROFILES` **exits 0 and removes nothing** (30i).
3. `listFiles` could not read a repository root, hiding `scratch-app`'s compose file. The wrong reading reached the plan and a commit message before being caught (30i).
4. **The box ran as root**, and the CLI refuses `bypassPermissions` under root — so the image could not have run a single session (30j).
5. **The environment never reached the container.** Eleven tests asserted it was set and all were right; none could see it (30j).

Plus: **GitHub renders the same App two ways** — `timone-agent` on GraphQL, `timone-agent[bot]` on REST — which would have made three later checks pass vacuously (30a).
