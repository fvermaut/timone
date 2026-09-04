# ADR-0051: Timone verifies itself by live gate, and a regression set is narrowed by what it depends on

- **Status:** accepted
- **Date:** 2026-09-04
- **Source:** [timone#84](https://github.com/fvermaut/timone/issues/84), found by [phase 32's live gate](../plans/phases/reports/phase-32-live-gate.md) — the first Timone self-run — and approved by fvermaut the same evening
- **Standing:** [ADR-0041](0041-a-run-happens-in-a-container-built-from-the-remotes.md), [ADR-0042](0042-timone-acts-under-its-own-identity.md), [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) — all unchanged, and keeping them unchanged is most of this decision
- **Extends:** [ADR-0048](0048-a-verification-probe-is-kept-proved-able-to-fail-and-hidden-from-the-builder.md), whose probes and regression set this narrows
- **Follows:** [ADR-0050](0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md), which made this problem reachable

## Context

[ADR-0050](0050-timone-becomes-a-managed-project-once-the-run-path-is-fixed.md) made Timone a managed project. On 2026-09-04 the first self-run went through triage, planning and execution in a container without a guard firing, and then **parked at verification**.

Of the 20 MUST criteria the standing regression set derived, **2 passed and 18 were `BLOCKED`** — not failed, unrunnable. The box has no `docker`, no forge credential beyond the one repository the run is for, and no clone of any other managed project. Almost every promise in Timone's own registers is about exactly those things.

**This is the cost of ADR-0041 landing on Timone rather than on a client application.** A client app is verified by being built and driven. Timone is verified by driving a daemon, a container and somebody else's repository — and the box was built to have none of those, deliberately.

**Two things went wrong at once, and they are separate.**

The phase under verification was a documentation chore that changed fourteen lines of one markdown file. It ran a 20-criterion end-to-end regression set and learned nothing about its own change. That is a scoping fault, and it exists for every project, not only for Timone.

And the 18 criteria have no home. They are marked `api` — terminal-checkable — and they are not.

## Alternatives considered

**Give the boxed run what those checks need** — `docker` inside the box, a credential reaching every managed repository, clones of the managed projects. **Rejected.** Reaching `docker` means mounting the daemon's socket, which is root on the host; a credential spanning the repositories undoes [ADR-0042](0042-timone-acts-under-its-own-identity.md)'s per-repository scoping, the thing that stops a `scratch-app` run seeing `ivtrends`. Both make the **self-run the most privileged run in the system** — and the run that can change the harness must be the most constrained, not the least.

**Move Timone's verification out of the box, onto the machine.** **Rejected**, and for the same reason wearing different clothes: unattended code back inside `projects/`, which [ADR-0043](0043-the-humans-checkout-is-theirs-alone.md) removed, and the same privilege inversion relocated to the host.

**Report the 18 as `HUMAN-CHECK` on the existing `human` channel.** **Rejected**, and the objection is [the verification report's own](../plans/phases/reports/phase-33-verification.md): *"A criterion whose instrument is missing is BLOCKED, not turned into a script for a person: what those eighteen need is a machine with `docker`, the daemon's credentials and the client repositories, not a person reading steps off a page."* That is correct. "The daemon picks up a marked ticket and opens a pull request" is not a manual script; it is a supervised machine run, and calling it `human` would describe the wrong performer.

**Leave them `api` and let every pass report 18 `BLOCKED`.** Rejected: a gate that is blocked on every pass is a gate nobody reads, and it says the criteria are checkable when they are not.

## Decision

### D1 — A fourth channel, `live`, for what only a supervised run can observe

`live` joins `api`, `browser` and `human`. It is distinguished the way the other three are — by **who or what performs the check**:

- `api` — a terminal, against the running deliverable.
- `browser` — a driven browser.
- `human` — a person, following a written script.
- **`live` — a supervised run against real infrastructure**: a real daemon, real credentials, a real forge, real containers, real managed projects.

Its deliverable in a verification pass is **not** a script and **not** a probe. It is a statement of which live gate last observed the criterion, and the gate report is the evidence. A verification pass never performs a `live` criterion and never marks one performed.

**This names what was already true.** Timone had no verification stage of its own until 2026-09-04, so these criteria have only ever been checked by live gates and by hand. The channel makes the real arrangement visible instead of implied.

### D2 — A `live` criterion carries its last gate, in the register

Each criterion on the `live` channel gains a `Last live gate:` line naming the report that last observed it, or `never` when none has. It is written by the gate, in the same commit as the gate report.

**Without it this is a downgrade.** A criterion that leaves `api` and points at nothing is a promise nobody checks; one that names a dated report is auditable by reading two files. Today it points at nothing, so this is stronger than what it replaces, not weaker.

### D3 — A live gate is owed by trigger, not by calendar

A phase owes a live gate before delivery when its diff touches the machinery a `live` criterion declares it depends on (D4). A calendar cadence would be theatre: nothing changes for a month and a gate runs anyway, or the daemon is rewritten twice in a week and the gate is not due.

### D4 — A criterion may declare what it depends on, and the regression set is narrowed by it

A criterion may carry a `Depends-on:` line listing repository path prefixes. The standing regression set is then derived as before — MUST, `api`, `verified` — **and narrowed to those whose declared dependencies the phase's diff touches**.

**Absent means always in scope.** A criterion with no `Depends-on` behaves exactly as it does today, which keeps every register that has not been annotated correct rather than silently narrowed. The field is added to a criterion when somebody has reason to know the answer.

**Why declared rather than inferred.** A rule derived from the diff's own paths gets it wrong in both directions: a fourteen-line change to `standards/baseline/ui-ux.md` cannot break "the daemon picks up a marked ticket", and it is precisely what could break "the accessibility baseline is mandatory". Only the criterion knows what it rests on.

### D5 — Nothing about the box changes

No new capability, no wider credential, no socket. ADR-0041 and ADR-0042 stand exactly as written. **That is the point of the shape**, not a side effect of it.

## Consequences

**About fifteen of Timone's own criteria stop claiming to be automatically checked.** That reads like a loss and is not: nothing re-checks them today either. What changes is that the register says so, and names the report that last did.

**A `live` criterion can be neglected quietly.** `Last live gate: never`, or a date two years old, is a true statement that nobody is obliged to act on. D3's trigger is what stops that, and D3 is enforced by the delivery stage reading it — not by anything mechanical. **This is the weak point of the decision and it is recorded rather than argued away.**

**`Depends-on` can be wrong.** A criterion that under-declares drops out of a regression set it belonged in, which is a regression escaping. The conservative default (absent means always) limits this to criteria somebody chose to annotate, and a criterion whose dependencies are not confidently known should carry no line at all.

**timone#84 is answered, and the parked run can finish.** `timone#39` resumes at verification with a regression set it can actually run.
