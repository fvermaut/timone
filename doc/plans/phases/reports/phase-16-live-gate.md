# Phase 16 — 16e live gate: observations

> Closes [sub-phase 16e](../phase-16.md). Everything below was observed against real Docker, a real pull request on the pilot, and a **continuously running** `timone daemon --interval 30` — not the `--once` cycles every previous gate used, because previews reconcile per cycle and `--once` cannot show a refresh happening by itself.

> **The daemon was attended throughout, lid open, at the machine.** That is a condition of this evidence and not a detail: [ADR-0020](../../../adr/0020-liveness-is-judged-only-over-witnessed-time.md)'s fix is [phase 17](../phase-17.md)'s, so an unattended run would have suspended and reclaimed healthy work. **A preview proven under an attended daemon has not been proven under an unattended one**, and nothing here says otherwise.

> **Fixture:** [`scratch-app#16`](https://github.com/fvermaut/scratch-app/pull/16) on branch `preview-gate/16e`, with [issue #15](https://github.com/fvermaut/scratch-app/issues/15) as its ticket — deliberately **unlabelled**, so the daemon could not pick it up as work. Five throwaway commits: `A` (visible change), `B` (second visible change), `C` (deliberately broken), `D` (repaired). Never merged.

## How the fixture was produced, and what that costs the evidence

**The pull request was opened by hand and its run seeded into the ledger; it was not produced by the pipeline.** fvermaut chose this on 2026-08-08 over the planned "file a fixture ticket and carry it to a pull request", which would have re-run stages 1–8 — a full pipeline run, whose only precedent cost $27.06 — to re-prove phases 11–13 in order to reach the thing phase 16 actually built.

**What that does not weaken.** Everything below runs through the real `pollOnce`, the real ledger, the real ticketing adapter and the real Docker adapter. The reconciler reads runs, and the seeded run is the same shape a delivered one is: branch claimed, pull request recorded, parked on `review` at stage `delivery`.

**What it leaves open, stated rather than implied:** a preview has never been observed appearing on a pull request that the pipeline itself opened. The gap is recorded on R8 and closes on the next real ticket that reaches delivery, at no extra cost.

## What has been observed

### Step 1 — a preview exists and opens: **observed**

One cycle after the run was seeded, the daemon logged

```
preview scratch-app!16 ready — http://localhost:55006/
```

and the pull request carried one comment giving that address. What the address served was the branch's own change, not `main`'s:

```
$ curl -s http://localhost:55006/ | grep -o "Todos[^<]*"
Todos — gate A
```

`docker ps` showed the stack under its per-pull-request compose project name, the migration job having exited successfully before the app was called healthy:

```
scratch-app-pr-16-app-1      Up (healthy)
scratch-app-pr-16-migrate-1  Exited (0)
scratch-app-pr-16-db-1       Up (healthy)
```

### Step 2 — the port was read, not computed: **observed**

Checked against Docker rather than against an expectation:

```
$ docker compose -p scratch-app-pr-16 … port app 3000
0.0.0.0:55006
```

`55006` is not `scratch-app`'s claimed block (`3100`), not the container's own port (`3000`), and not derived from the pull-request number. Across the gate the app was published on `55006`, `55007`, `55008` and `55010` — Docker's choices, each read back and none predicted. The worktree's `HEAD` was confirmed equal to the pull request's `headRefOid` at `53ffc8e`, so what was served was the commit under review.

### Step 3 — it refreshes, and the comment is revised rather than repeated: **observed**

Commit `B` was pushed. Within one cycle:

```
preview scratch-app!16 ready — http://localhost:55007/
$ curl -s http://localhost:55007/ | grep -o "Todos[^<]*"
Todos — gate B
```

**The pull request still carried exactly one comment**, whose body now named `fafff21` and the new address. The previous address stopped answering (`status=000`), which is the accepted cost of reading the port instead of allocating one — and the reason the comment is edited rather than appended.

The `db` container was **not** recreated (`Up About a minute` while `app` showed `Up 3 seconds`), so a refresh keeps whatever a reviewer had typed into the preview. Not required by any criterion; worth knowing.

**Idempotency across idle cycles is in the log by absence.** The daemon ran continuously at 30-second cycles throughout; the log contains **one line per actual change** and nothing between them. A reconciler that spoke every cycle would have filled the pull request within the hour.

### Step 4 — two previews coexisting: **observed at the adapter, not through the daemon**

Two stacks were run simultaneously against the real Docker daemon, out of band, as `pr-998` and `pr-999`:

```
scratch-app-pr-998-app-1  0.0.0.0:55004->3000/tcp
scratch-app-pr-998-db-1   0.0.0.0:55003->5432/tcp
scratch-app-pr-999-app-1  0.0.0.0:55002->3000/tcp
scratch-app-pr-999-db-1   0.0.0.0:55000->5432/tcp
local  scratch-app-pr-998_pgdata
local  scratch-app-pr-999_pgdata
```

Four distinct ports and two distinct volumes — the property `compose.yaml`'s header was written for, and the one an allocation scheme would have broken.

**Through the daemon it could not be arranged, and that is structural rather than an oversight.** R10 serializes work per project and `claimBranch` refuses a second branch while one run holds the project, so one managed project cannot today have two runs with open pull requests. With one project registered, the daemon-level ceiling is one preview. **Said plainly rather than implied**: coexistence is proven of the mechanism, not of the loop.

### Step 5 — teardown, and reopening: **observed**

The pull request was closed. In the **same cycle** that observed it:

```
done   scratch-app#15 — PR #16 closed
preview scratch-app!16 released
```

and then, checked rather than assumed:

- **containers** — none matching `scratch-app-pr-16`
- **volumes** — `scratch-app-pr-16_pgdata` gone
- **worktree** — `.timone/previews/scratch-app/pr-16` gone from disk *and* deregistered from `git worktree list`

**Volumes and worktrees, not just containers** — the accumulation nobody notices until the disk fills. **And a fourth thing the plan never named, found by checking the host after the sign-off rather than before it — see defect 3 below.**

Reopening the pull request brought the preview back one cycle later, on `http://localhost:55010/`, serving `Todos — gate D, recovered`. **No code handles reopening**: a reopened pull request is an open one with no preview recorded, which is what a new one is. Asserted in `poll.test.ts` and now watched.

**`released` appears exactly once in the whole log**, across the cycles between the close and the reopen. A merged or closed pull request stays that way forever; releasing on its state alone would have made work for the rest of the daemon's life.

**A preview outlived its run, live.** After the close, run `scratch-app#15` is `done` — terminal — while the reopened preview is `ready` and recorded. That is precisely why the ledger key is top-level rather than a field on a run, and it had until now only been argued.

### Step 6 — a failed preview is survivable: **observed, and it found two defects**

Commit `C` was pushed with a deliberate type error. Within one cycle:

```
preview scratch-app!16 failed
```

- the failure was posted **on the pull request**, as the same single comment revised
- the run stayed `parked` at `delivery`, with `flags: []` and no failure recorded
- the daemon carried on to its next cycle and its other projects
- pushing `D` **recovered it without intervention** — `preview scratch-app!16 ready — http://localhost:55008/`, serving `Todos — gate D, recovered`. The comment's promise ("I'll try again on the next commit pushed here") is therefore true rather than aspirational.

**Two defects came out of this step, neither reachable by any unit test, and both are fixed** (`6b8979b`) — see below.

### Step 7 — R11's preview clause: **not reached**

Carrying a review comment through remediation with the preview refreshing needs a real feedback session, which this fixture path deliberately does not run. **R11 therefore stays `draft`**, with the preview clause named as the outstanding one — exactly as [the plan](../phase-16.md) said it would if the gate did not get there.

## What the gate found that nothing else could

**Phase 14 found six defects this way against 532 green tests. Phase 15 found an instrument that lied in the reassuring direction. This gate found three, against 581 — and the third only because the host was inspected *after* the sign-off rather than treating the sign-off as the end.**

### 1. A failed preview told a reviewer nothing

The first failure comment read, in full:

> Dockerfile:74

True, one line, and worthless. Docker leads with build progress and a source excerpt and puts its summary **last**; the reason was taking the **first** line. It now takes the last meaningful one, strips ANSI colour and caps the length, and the same broken commit now reads:

> target app: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1

**Only a real build could have produced this.** Every unit test fed the adapter an error whose first line was the interesting one, because that is what someone writing the test would naturally invent.

### 2. Timone's own `npm test` went red on a to-do app's Playwright specs

Previews check a client's commit out at `.timone/previews/…`, which is a **second** place client source lives inside the timone root. `vitest.config.ts` excluded `projects/**` — with a comment explaining exactly why — and knew nothing about the new one. The first `npm test` after a preview existed collected five of `scratch-app`'s suites and failed on missing `@playwright/test`.

**This would have broken every future run of Timone's own tests**, and no test could have caught it: the fault is in the thing that decides which tests exist.

### 3. Teardown left 1.5 GB per pull request on the host, forever

Found during the post-gate clean-up, by looking at `docker images` after everything else had been confirmed gone:

```
scratch-app-pr-16-app       315MB
scratch-app-pr-16-migrate  1.19GB
```

Containers, volumes and worktrees were all removed — and **built images were not**, once per pull request, permanently. R12's own criterion says "stopped and removed", and 16d's checklist named volumes and worktrees because those were the ones anybody had thought of.

**The fix's first attempt did not work, and that is the more useful half.** `docker compose down --rmi local` is the documented way to do this, and it does nothing here: compose fills in a default `image` name for a build-only service during config normalisation and then skips it as "custom tagged". It reports **no error and no image**, so the flag reads as having worked. The images are now removed explicitly, filtered on the compose project prefix so nothing can reach a pinned image like `postgres:17.5` or another preview's, and **the fix was confirmed by looking at `docker images` after a real teardown** — the same discipline that found the defect. Confirmed clean: `scratch-app-pr-996-app` and `-migrate` present before, absent after, `postgres:17.5` untouched.

### And one caught before the daemon ever ran

An `ensure` against an unresolvable commit returned a reason carrying the whole argument vector — **absolute paths from this laptop, bound for a client's public pull request** (`9b808f6`). Caught by driving the adapter against real Docker out of band, which is the cheapest version of the same lesson.

## Instruments, verified before their output was believed

[The habit phases 14 and 15 both earned](phase-15-clock-investigation.md), which has now produced one fabricated defect and one fabricated clean bill of health:

- **The three new guards were each shown to have a test that goes red without them** — the opt-in check, the say-nothing-unless-it-changed check, and the release-once check were removed one at a time and exactly one test failed each time.
- **The adapter was driven against real Docker before the daemon was ever started**, so a wrong flag in the argument vector — invisible to a fake — would have surfaced out of band rather than inside the gate.
- **The port was read from `docker compose port`, not from the daemon's own log line**, since the log is the thing under test.
- **Teardown was checked against `docker volume ls`, `ls` and `git worktree list`**, not against the `released` log line, for the same reason.

## What this gate did not prove

- **Phone review.** The adapter serves `localhost`. Nothing left the host, and R8 records this rather than letting a bare `verified` imply otherwise ([ADR-0021](../../../adr/0021-previews-are-reconciled-behind-an-adapter-seam.md)).
- **A preview reachable while the machine sleeps.** Same reason, plus the machine hosting previews is the machine running the daemon.
- **Anything about an unattended daemon.** The prohibition stands until [phase 17](../phase-17.md)'s gate, and this phase earns no right to strike it.
- **A preview on a pipeline-opened pull request.** See the fixture note above.
- **R11's preview clause.** Step 7.
