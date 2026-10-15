# Phase 62 — Delivery Report

- **Date:** 2026-10-15
- **Phase:** [phase-62.md](../phase-62.md) — `Complete`, verified in [phase-62-verification.md](phase-62-verification.md)
- **Branch:** `timone/254-a-comment-on-a-map-ticket-gets-no-answer` @ `35d8f1c` (the reviewed head; this report is the commit after it)
- **Base:** `main` — the project's default branch. The branch was cut from `main`'s head, `ed8312b`, and stacks on no other phase.
- **Pull request:** opened against this report, from this branch into `main`, after this commit. Its address is on [timone#254](https://github.com/fvermaut/timone/issues/254).
- **Screen:** no user-facing screen in this phase — the phase file's `Screens changed` line says none. [ADR-0052](../../../adr/0052-a-run-that-enters-the-build-ends-at-its-pull-request.md), [ADR-0057](../../../adr/0057-every-screen-a-phase-changes-is-looked-at-and-its-figures-read-on-the-preview-data.md)
- **Questions for the human:** none — the verification report's section of that name says none.
- **Departures:** [`phase-62-departures.md`](phase-62-departures.md) — 1 entry (a check not run at the planned time: the whole test suite ran once at the close, not at the end of 62a).

## Scope

Bug [timone#254](https://github.com/fvermaut/timone/issues/254): on ivtrends#217, a named person wrote a question on a map ticket and nothing answered it. Nothing read the comments on a map ticket once its piece tickets were open. This phase claims PRD-05.R9 (MUST, `live`) and PRD-05.R10 (MUST, `api`), from [prd-05-a-runner-decides-each-step.criteria.md](../../../specs/prd/prd-05-a-runner-decides-each-step.criteria.md).

Now, when a named person writes on an open map ticket that no live run is reading, the machine posts one reply. The reply says the ticket is not read any more, and links each open piece ticket as the place to write, or says to open a new ticket. Several comments written between two cycles get one reply. The reply is marked in the ticket's record before it is posted, so it is never posted twice, also after a restart. The machine's own comments, and comments by people not named for the project, get no reply. The reply is written by code with fixed words; no runner session wakes. `CONTEXT.md`'s *Map ticket* entry gets one dated line saying this.

Left for a later ticket: treating a comment on a map ticket as a new request.

## How to try it

### Against the preview

This project has no preview configured for pull requests (`timone.yaml` gives `timone` no `bindings.preview`). Use the local steps, or the live check below.

The live check, which only fvermaut can run (it needs the real daemon and a real GitHub login):

1. Run the daemon from this branch's build against scratch-app.
2. On scratch-app, find (or make) a map ticket — label `timone:map` — whose piece tickets are open and whose own run is finished.
3. As a named person, write a comment on the map ticket. Within one cycle you should see exactly one machine reply: "**This ticket is not read any more.**", then a list of the open piece tickets as `#N — title`, then a closing line that starts with "**What I need from you:**". Closed piece tickets are not listed.
4. Write two more comments quickly. You should see one more reply, not two.
5. Restart the daemon. No further reply should appear.

### On a local checkout

Install and build as the project's [README.md](../../../../README.md) says (*Getting started*). Then:

1. `npx vitest run src/runner/comments.test.ts src/runner/driver.test.ts src/daemon/poll.test.ts` — you should see 173 of 173 pass; the map-ticket cases are in the `describe("a comment on a map ticket", …)` block of `driver.test.ts`.
2. `npm run build`, then `PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-05.r10.mjs` — this runs the built daemon against a fake GitHub. You should see every label PASS, including "clause 1 (map ticket)" and "clause 3 (map ticket)", and the control line quoting the reply that lists #52 and #53 but not the closed #51.
3. `npx vitest run` — the whole suite. In the build container 71 tests fail, the same 71 by name as on `main`; they are git-fixture tests whose pushes the container refuses, and one register test. None fails only on this branch. On your own machine fewer, or none, may fail.

## Verification outcome

From [phase-62-verification.md](phase-62-verification.md) — 0 of 2 fix loops consumed.

| ID | Priority | Channel | Verdict | Loop |
| --- | --- | --- | --- | --- |
| PRD-05.R9 | MUST | live | LIVE-GATE | 0 |
| PRD-05.R10 | MUST | api | PASS | 0 |
| Regression set, 22 more criteria | MUST | api | PASS (7 parts of 3 of them could not run here) | 0 |

Whole suite: 2800 tests, 2729 passed, 71 failed — the same 71 tests, by name, as the list on `main`; none fails only on this branch.

### Outstanding for the human

- [ ] PRD-05.R9 — live gate owed: a named person writes on a scratch-app map ticket and sees exactly one reply that links the open piece tickets. Seen working only with a fake GitHub. Its steps are under *How to try it* above and in [phase-62-verification.md](phase-62-verification.md) § Live gates. The gate's runner also judges whether a reply written by code, with no runner session woken, meets R9's words "the runner wakes and either acts or answers".

## Standards review — phase 62

- **Read:** `git diff origin/main...HEAD` for `src/daemon/poll.ts`, `src/daemon/poll.test.ts`, `src/runner/comments.ts`, `src/runner/comments.test.ts`, `src/runner/driver.ts` and `src/runner/driver.test.ts`; `src/runner/driver.ts` lines 865–925, to see the existing comment-reading code; `/workspace/timone/standards/code-smells.md`; `tsconfig.json`; the `package.json` scripts. The project has no ESLint or Prettier config and no `doc/standards.md`.
- **Diff:** `origin/main...HEAD` (`ed8312b...35d8f1c`): 6 files, +477/−3 (review subject only)
- **Findings:** 2

### 1. The shape "a map ticket with its steps" is written out three times and has no name — Duplicated code

- **Where:** `src/daemon/poll.ts:1012–1017`, `src/daemon/poll.ts:1047`, `src/runner/driver.ts:104–108`
- **What:** The same inline type appears three times across two files:
  - `maps: { number: number; steps: readonly Step[] }[];` (the `Frontier` interface)
  - `const maps: { number: number; steps: readonly Step[] }[] = [];` (in `surveyInitiatives`)
  - `maps: readonly { number: number; steps: readonly Step[] }[];` (the `RunnerCycle` interface)

  `answerMap` then refers to it as `RunnerCycle["maps"][number]`, because the type has no name of its own.
- **Why it matters:** This is Duplicated code under the rule of three; the reference counts a repeated one-liner. It is also an unnamed concept. Each copy has to be edited by hand if the shape changes, and the copies already differ in whether the outer array is `readonly`.
- **Suggested remediation:** Declare one exported type for a map and its steps, and use it in all three places — not applied here.

### 2. `answerMap` repeats the "read new comments, then mark them read" steps of `newComments`, and finds the newest comment a second way — Duplicated code

- **Where:** `src/runner/driver.ts:364–371`, `src/runner/driver.ts:535–550` (compare with the existing `src/runner/driver.ts:876–887`)
- **What:** The new method follows the same steps as `newComments`: `since` comes from `seenUntil(...)`; `fresh` keeps the comments whose `ms(comment.createdAt) > ms(since)`; `newest` is the latest of the fresh comments; then `appendEntry(... { kind: "seen", at: this.deps.clock(), thread: "ticket", until: newest })`. For the newest comment the diff adds a helper `newestOf(comments)`, while `newComments` still finds it with its own inline `fresh.reduce(...)`.
- **Why it matters:** This is Duplicated code, at its second copy, which the reference calls tolerable. But it is the same decision written twice, about how a thread's new comments are found and marked read. The new helper sits next to an inline version of the same calculation, so the file now does one thing two ways.
- **Suggested remediation:** Use `newestOf` in `newComments` as well, or move the shared "fresh comments and seen mark" steps into one helper — not applied here.

## Spec review — phase 62

- **Read:** `git diff origin/main...HEAD` for `src/daemon/poll.ts`, `src/daemon/poll.test.ts`, `src/runner/comments.ts`, `src/runner/comments.test.ts`, `src/runner/driver.ts`, `src/runner/driver.test.ts`, `CONTEXT.md`, and the criteria register (no change). Current `src/daemon/poll.ts` lines 1025–1070 and 1175–1195. `src/runner/record.ts` `readRecord`. `doc/specs/prd/prd-05-a-runner-decides-each-step.md`. `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`, R9 and R10. `doc/plans/phases/phase-62.md`, from the top to the end of "Goal Description".
- **Diff:** `origin/main...HEAD` (`ed8312b...35d8f1c`): 6 files, +477/−4 (review subject only)
- **Findings:** 3

### 1. A named person's comment on a map with no mark and no machine comment is marked read and never answered — PRD-05.R9

- **Where:** `src/runner/driver.ts:535–551`
- **What:** `const since = seenUntil(read.value, "ticket") ?? newestOf(comments.filter((comment) => comment.fromTimone));` When `since` is undefined, the code writes a `seen` mark over every comment and then stops: `if (since === undefined) return;`. A named person's comment in that case gets no reply, and because of the mark it is never answered later either. `readRecord` returns an empty record when the file is missing (`record.ts:241`). So a map ticket with no record and no machine comment on it falls into this branch. The phase only says what to do when there is no mark but there is a machine comment. None of the new driver tests covers this branch.
- **Why it matters:** PRD-05.R9 clause 1 says a run "of any kind, in any state" gets an answer when a named person comments. Here the comment is consumed with no answer. This is the same kind of fault as #254, only in a narrower case.
- **Suggested remediation:** When there is no point to read from, still reply if a named person wrote (or at least log a line), and add a test for this branch — not applied here.

### 2. The reply can send the person to a dropped step ticket, which nothing reads either — PRD-05.R9

- **Where:** `src/runner/driver.ts:554`
- **What:** `const open = map.steps.filter((step) => step.state === "open");` A dropped step stays open and carries `timone:held`. The poll skips held tickets (`poll.ts:1184`, `if (ticket.labels.includes(HELD_LABEL)) continue;`), and the driver reads only runs that are not finished. The reply still lists that ticket as a place to write ("write it again on that ticket"). A comment written there gets no answer, which is the #254 fault moved to another ticket.
- **Why it matters:** PRD-05.R9 clause 1: the comment the person is told to move must get an answer. The phase's goal says "each open step ticket", so the code matches the phase, but sending people to a ticket nothing reads does not meet R9's intent.
- **Suggested remediation:** Leave held steps out of the list, or mark them as dropped in the reply — not applied here.

### 3. R9's evidence line was not updated for the new way of answering — PRD-05.R9

- **Where:** `doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md`, R9 (no change in the range)
- **What:** R9 clause 1 says "the runner wakes and either acts or answers". The new code answers with fixed words from code and never wakes the runner (`answerMap`, "The runner is not woken"). The phase says: "Verification should note this reading in R9's evidence." The diff leaves the register unchanged, so the reading is recorded only in the phase file and not on the criterion. The `CONTEXT.md` "Map ticket" amendment is present and matches the code.
- **Why it matters:** PRD-05.R9 is `draft`/`live`. A later reader of the register sees a criterion that says "the runner wakes", while the code says it does not. Nothing on the criterion explains why that is allowed.
- **Suggested remediation:** Add a dated ✏ evidence or amendment line under R9 recording that code answers on map tickets, citing phase 62 and #254 — not applied here.

No fault was found against PRD-05.R10. Only comments that are not the machine's (`!comment.fromTimone`) and come from a named person (`isNamedPerson`) can trigger the reply. The machine's own reply is marked read on the next cycle and is never answered. The tests cover both cases. No scope creep was seen: the poll change only passes on the map list it already reads, and no runner rules changed.

## Notes

- Delivery checked spec finding 1 against the code before carrying it. The behaviour is on purpose: a code comment says that with no mark and no machine comment, "the comments are only marked read". A map ticket normally carries the machine's notice that its pieces were approved, so the case needs a map the machine never wrote on. No test covers it.
- Once this is merged and the daemon runs it, ivtrends#217 gets one late reply to the 16:39Z question of 2026-10-15, pointing at its open piece tickets. The question was already moved by hand to a new ivtrends ticket, so the reply is late but correct.
- Each cycle now reads the comment thread of every open map ticket: one extra read per map per cycle.
- Container test failures: the completion report counted 101 failures in its container and the verification report 71 in its own; in both, each failing test also fails on `main`, and none fails only on this branch.
