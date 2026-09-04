# ADR-0050: Timone becomes a managed project, once the run path is fixed

- **Status:** accepted
- **Date:** 2026-09-04
- **Source:** the grooming of 2026-09-03, and the interview with fvermaut on 2026-09-04 that followed it
- **Standing:** [ADR-0007](0007-sessions-at-timone-root.md), [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md), [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) — all unchanged, and all three are why this is now possible
- **Depends on:** [ADR-0049](0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md), which must be built and observed working before this is done

## Context

Timone already applies most of its own process to itself. It has PRDs with criteria registers, fifty ADRs, breakdowns, phase files, completion reports, verification reports and live gate reports. What it does not have is **inversion of control**: no daemon works Timone's tickets. Every Timone fix is typed by fvermaut, or by a session he is sitting in.

That is the bottleneck, and it is the whole reason for this decision. **This is a bet on throughput, not on quality** — ruled by fvermaut on 2026-09-04, over three alternatives that each argued quality, dogfooding, or dropping the idea. The claim is not that self-management would have prevented the current bugs. It is that he should not be the one typing every fix.

**Nothing structural blocks it any more, and that is new.**

- [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md) builds every run in a container cloned from the remotes. A Timone run would build Timone in a box, push a branch and open a pull request. **The running daemon is never modified by the run it is hosting.**
- [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) keeps his checkout his. `projects/timone` would be a second clone of the same repository, and `~/dev/timone` stays untouched.
- [ADR-0044](0044-a-run-belongs-to-a-step-ticket-and-the-assignee-is-what-holds-it.md) binds a run to a step ticket, which is what the thirty-one open issues would become.

**The risk that remains is the one the throughput case runs into.** Nine of the open issues live on the unattended run path. A daemon that parks a ticket unanswerably ([#76](https://github.com/fvermaut/timone/issues/76)) or hands a run to a terminal that has gone ([#78](https://github.com/fvermaut/timone/issues/78)) does not save time — it costs a takeover plus a retry. Putting Timone's own tickets down that path before it is fixed would multiply the tax rather than the output.

## Alternatives considered

**Start now on a fenced subset** — the daemon takes only docs, standards and prose, never `src/daemon`. Real throughput on the tail of the list, no risk to the machine. Rejected by fvermaut on 2026-09-04: a fence that keeps the daemon out of the code is a fence around the work that matters.

**Start now, unfenced, and let the failures be the evidence.** Rejected for the same reason as the fence in reverse — the failures are already known and filed; paying to rediscover them under load buys nothing that reading them did not.

**Fence by risk rather than by area** — an extra human stop only where the machine could break itself. Rejected as a second gate on top of the one D3 keeps.

## Decision

### D1 — Timone joins `timone.yaml`, at `projects/timone`, and not before ADR-0049 is built

The entry is added once [ADR-0049](0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md) is built **and has been observed working on a real run**, not when its tests are green. The whole argument for waiting is that the unattended path has to carry Timone's own work, and 1522 green tests are what was true of the machinery that produced these seven issues.

### D2 — The reason is throughput, and it is measured

The bet is that fvermaut stops typing Timone's fixes. It is worth checking rather than assuming: `ivtrends#24` needed three handbacks for one merge, and if a Timone ticket needs the same, self-management adds work instead of removing it. The number to watch is handbacks per merged step ticket.

### D3 — Same gates, no exception. Merge stays human

A Timone pull request is reviewed and merged by fvermaut, exactly as a client project's is. Ruled on 2026-09-04 with the cost stated: roughly thirty-one merge decisions on top of `ivtrends`'.

**The arithmetic that makes this coherent:** the gate is one decision per step ticket. The tax is the handbacks — `ivtrends#24` had three for that one merge. The throughput comes from ADR-0049 removing handbacks that should never have happened, not from removing his authority over what lands. Timone eats what it serves.

### D4 — No fence

The daemon may work any Timone ticket, including one that changes `src/daemon`. The container is the fence: a run cannot modify the daemon hosting it, and D3's merge gate is where a change that would break the machine is caught.

### D5 — The harness-file rule is about client repos, and says so

`checkPathContainment` refuses any harness file in a project repo, with no target check — `.claude/`, `.timone/`, `timone.yaml`, `process.md`, `standards/`. Those files **are** Timone, so as written the guard fires on every self-run and on every honest commit.

The rule is narrowed to what it always meant: **no harness file may enter a repository that is not Timone's own.** `CLAUDE.md` says the same thing in words and needs the same narrowing. This is the one place where being a managed project and being the harness genuinely collide, and it is fixed by naming the exception rather than by weakening the check.

### D6 — A merged Timone pull request means the running daemon is out of date

[#5](https://github.com/fvermaut/timone/issues/5) — a running daemon keeps using the code it started with, and nothing says so — stops being cosmetic the day Timone merges its own work. It is a precondition of this decision, not a companion to it, and it is built alongside ADR-0049.

## Consequences

**Timone's bug list becomes a work queue.** The thirty-one open issues become step tickets that a daemon picks up. What is filed stops being a record of what is owed and starts being what happens next, which is a change in what the list is for.

**Two projects compete for one daemon.** The one-run-per-project rule means `ivtrends` and `timone` can each hold a run, so the machine's cost roughly doubles while both are active. That is the throughput being bought, and it is the bill for it.

**A bad merge can stop the machine.** D3 and D4 together mean the merge gate is the only thing between a broken `src/daemon` change and a daemon that will not start on next launch. The container keeps the *running* daemon safe; it does not keep the next one safe. `git revert` and a restart is the way back, and it is a human's act.

**Timone stops being able to say it is not a guinea pig.** The standing rule is that live gates run on `scratch-app` and never on a client repo. This makes Timone itself the third kind: a repository the machine works on for real. `scratch-app` stays what it is, and nothing here permits a live gate on `ivtrends`.

**This decision is reversible cheaply.** Removing the manifest entry stops it. Nothing in the repository layout changes except one clone under `projects/`, which is gitignored.
