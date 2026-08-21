# Phase 29 — Sub-agent handoffs

> One section per sub-phase, appended in execution order, each committed with its own sub-phase's commit. Format per `process.md` stage 6.

> **Branch.** `phase-29-one-step-one-ticket`, cut from `phase-30-work-in-a-box` rather than from `main`. The phase-29 plan's own amendments — the four rulings and everything after them — live on the phase-30 branch and nowhere else, so a branch cut from `main` would have been executing a plan it could not read. Phase 29 depends on nothing in phase 30's code, and phase 30's three slices are unreviewed, which is why this is its own branch rather than more commits on that one.

> **Timone runs its own phases by hand.** `/timone-execute` operates on managed projects and Timone is not one, so there are no sub-agents here: each slice is built in the session, in the order the dependency graph gives.

## 29a — The frontier query: which step is next, from tickets

**Built.** `nextStep` is a pure, offline function in the new `src/daemon/steps.ts`. Given an initiative's step tickets it returns the first that is **open, unblocked, unheld and unclaimed**, or `undefined` — which is the signal to close the initiative. `HELD_LABEL` is named here, once, and every other mention in the phase points at it.

Nothing calls it yet. It is the rule on its own, which is what makes it testable without a tracker.

**Files touched.**

- `src/daemon/steps.ts` — **new.** `HELD_LABEL` and `nextStep`.
- `src/daemon/steps.test.ts` — **new.** Nine cases.
- `src/adapters/ticketing.ts` — `Step` and `Dependency` live here rather than in `steps.ts`; see the decision below. (Committed with 29b, which is the slice that owns this file.)

**Decisions taken inside the slice.**

- **`Step` belongs to the port, not to the daemon.** The plan puts `Step` in 29a and the reading of it in 29b, which reads as though the type were the daemon's. It is not: `src/adapters/` imports nothing from `src/daemon/` anywhere in the tree, and inverting that for one type would be the first exception. `stepSchema` therefore sits beside `ticketSchema` in `src/adapters/ticketing.ts`, and `steps.ts` imports it. `HELD_LABEL` stays in `steps.ts` — the adapter reports labels and has no opinion about which one holds a step.
- **A dependency carries its own state rather than a number to resolve.** Forced by 29b's reading of gh's real output; the reasoning is under 29b, because that is where it was found. `nextStep` therefore has no set of open numbers and no lookup, and the cycle case (7) falls out for free rather than needing a guard: two steps that block each other each carry an open dependency, both are skipped, and the call returns `undefined` without walking anything.
- **Eligibility is four conditions and the plan names four.** `dependenciesIncomplete` is the ninth case and is not in the plan's seven — again, found in 29b.
- **No special case for the machine's own name.** The function reads `HELD_LABEL` as a constant and asks whether `assignees` is empty. It knows no login, compares against no identity, and cannot be made to behave differently for the bot than for a person. The plan forbids the special case and there was no temptation to add one, because there is no identity in scope to compare against.

**Validation evidence.**

`npm run build && npx vitest run src/daemon/steps.test.ts` — **9 passed**.

Red first, in two goes. Cases (1) through (8) were written against a `nextStep` that threw `not implemented`, and all eight were seen failing before the body was written:

```
× takes the first when every step is open and none is blocked
× takes the second when the first is closed
× skips a step whose dependency is still open, even when it sorts first
× takes a step whose dependency is closed
× skips an open step the machine is holding
× skips an open step a person has taken
× returns undefined when every step is closed
× returns undefined on a dependency cycle rather than looping
Tests  8 failed (8)
```

Case (9), added later from 29b's finding, was proved red by deleting its own clause from the implemented function and re-running: `× skips a step whose dependency list came back incomplete`, `1 failed | 8 passed`. The clause was restored and all nine pass.

**The plan's checks, answered.**

- **All eight cases seen failing first** — yes, the trace above. Nine, with the one the plan did not know about.
- **(5a) and (5b) both present and both red first** — yes, and they are the fifth and sixth lines of the trace. They are separate `it` blocks reading separate fields; an implementation that read only `labels` or only `assignees` fails one of them.
- **Case (7) asserted with a real cycle, not a comment** — yes: two steps, each declaring the other open. The function has no loop to hang in, which the test confirms rather than assumes.

**What this slice does not prove.** That the frontier is *reached* — nothing calls `nextStep`. And a step the machine is holding still blocks steps that depend on it, because it is open; the plan does not say whether a dropped step should hold its dependents back, and this slice does not decide it. Flagged for 29d.

## 29b — Reading an initiative's step tickets

**Built.** `listSteps(project, initiative)` joins the ticketing port and the GitHub adapter: the children of one initiative, **open and closed alike**, in the order its approved breakdown put them. One `gh issue list --json` call. No GraphQL.

**Files touched.**

- `src/adapters/ticketing.ts` — added `dependencySchema`, `stepSchema`, their inferred types, and `listSteps` on the port.
- `src/adapters/github-tickets.ts` — added `ghDependencySchema`, `ghStepSchema`, `STEP_FIELDS`, `BODY_DEPENDENCY_LINE`, `toStep` and the `listSteps` method.
- `src/adapters/github-tickets.test.ts` — added `ghStep`, `ghDependency` and a ten-case `describe("listSteps")`.
- Eleven stub adapters across `poll.test.ts`, `session.test.ts`, `hooks.test.ts`, `daemon.test.ts`, `guardrails.test.ts`, `retry.test.ts` and `takeover.test.ts` gained a `listSteps`.

**Two corrections to the plan, both found by reading `gh`'s real output before writing a fixture.**

The plan is emphatic that fixtures carry gh's real shape. Getting it meant creating a throwaway parent and child on `fvermaut/scratch-app` — #42 and #43, both now closed, with the transcript on #42. Two things came out of it that the plan did not know, and both change the design rather than decorating it.

- **A dependency does not say which repository it is in.** #43 was blocked by `scratch-app#42` *and* `timone#8`. `--json blockedBy` returned them as the bare numbers `42` and `8`; only the `url` distinguishes them. **An implementation that resolved a dependency by number against the initiative's steps would have matched `timone#8` to `scratch-app#8`** — a real, unrelated issue — and answered confidently with the wrong state. Every node carries its own `state` in the same response, so `Dependency` carries `open` and no number is ever looked up. This is why 29a's cycle case needs no guard.
- **A dependency list can be counted without being handed over.** `blockedBy` is `{nodes, totalCount}`. When the count exceeds the nodes, the step waits on something nobody can name. It reads as **blocked, never as free** — a step that should have been held back and was not is the failure mode ADR-0040 names as the one to watch. That is `dependenciesIncomplete`, and 29a's ninth case.

Recorded shapes, verified 2026-08-21: `parent` is `{id, number, state, title, url}` or `null`; `state` is `OPEN`/`CLOSED`; `assignees` elements carry `login`; `labels` was already in `LIST_FIELDS`.

**Decisions taken inside the slice.**

- **The children are filtered here, not by gh.** `gh issue list` has no `--parent` filter — verified. So the listing asks for the repository's issues with `parent` among the fields and keeps those whose parent is the initiative.
- **Order is by number ascending, and the slice says why.** The plan asks for "the breakdown's order". 29c opens one ticket per step in the order the human approved, so ascending number *is* that order. gh answers newest-first, which would run an initiative backwards — which is what the plan's case (1) is really guarding, and the test uses out-of-order input to prove it.
- **`closed` is not requested, though gh offers it.** `state` already says it. Two fields for one fact are two chances to disagree.
- **The truncation refusal is repeated, not shared.** `listIssues` refuses a page-limited list; so does this. The message differs because the consequence differs — choosing a step from a truncated list picks the wrong step, rather than merely missing a ticket.
- **The body line is matched whole and never parsed.** `BODY_DEPENDENCY_LINE` captures the line verbatim so the machine can quote it back. Nothing extracts the numbers, because nothing acts on them (ADR-0044 D6).
- **`noUnmarkedTickets` became `noOtherListings`** in `poll.test.ts`. It now stubs two listings rather than one, and its old name would have been describing half of itself.

**Validation evidence.**

`npm run build && npx vitest run src/adapters/github-tickets.test.ts` — **39 passed**, of which ten are this slice's. All ten were seen red first, against a port that had no `listSteps`: `TypeError: (intermediate value).listSteps is not a function`, ten times.

Full suite: **1157 tests, 1156 green.** The one failure is `guardrails.test.ts > resolves the session id against the ledger`, timing out at 20s — the known flake, [timone#8](https://github.com/fvermaut/timone/issues/8). It passes on its own (23/23) and it failed the same way before this branch existed.

**The plan's checks, answered.**

- **All six cases red first** — yes, and four more besides: the argument vector, a closed child, a cross-repository dependency, and no network.
- **No `gh api graphql` in this slice** — `grep -n "graphql" src/adapters/github-tickets.ts` returns nothing.
- **`LIST_FIELDS` widened, and the code reads both `labels` and `assignees`** — `STEP_FIELDS` extends `LIST_FIELDS` with `state,assignees,blockedBy,parent`; `labels` was already there. `toStep` reads both fields, and cases (5) and (6) fail separately if either is dropped.
- **No test reaches the network** — every call goes through `fakeRunner`, which throws on an unexpected call. Asserted explicitly.
- **A non-zero test count** — 39, read from the run, not inferred from the colour.

**What this slice does not prove.** That anything calls `listSteps`; that an initiative's children exist to be listed (29c opens them); and that the `Blocked by:` line, once reported, is actually said on the ticket — this slice carries the line, and a later slice must speak it.
