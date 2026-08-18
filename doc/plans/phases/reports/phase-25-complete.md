# Phase 25 — Completion Report

- **Date:** 2026-08-18
- **Plan:** [phase-25.md](../phase-25.md) — approved for execution by fvermaut 2026-08-18, as written
- **Issue:** [timone#28](https://github.com/fvermaut/timone/issues/28)
- **Decision:** [ADR-0033](../../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)
- **Requirements:** PRD-02.R3 **revised, sign-off lapsed**; R21, R10 **annotated, statuses unmoved**; R13 **untouched, alignment recorded**; a requirement for the behaviour itself **recorded as owed and not written**
- **Branch:** `main` (as for phases 15–24), at `a1412bd`, pushed
- **Built:** 25a–25g. **25h, the live gate, is not run** — it needs a daemon, the `scratch-app` fixture, and fvermaut.

## Summary

**A stage handed an answer it may not act on now stops on a person instead of on a reply.** It says so once, the ticket says plainly that writing another answer will not move it, and it hands over the one command that will. Where a stage never notices, the machinery notices for it: a run that reads an answer and asks the same question again, twice running, is stopped whether or not anything said so.

The suite went **984 → 1036 green across 27 files**, type-check clean throughout. `.timone/state.json` was never read for a decision, never written, and never edited.

**The plan's ordering was the whole of its risk, and it held.** The escape hatch (25b) landed before anything could create a park needing one (25d), and the ticket's words (25c) landed before the park existed to describe. Built the other way round, the fix is strictly worse than the bug: a park that holds its project, offers no command, and cannot be resumed by anything.

**The compiler found the site the plan predicted it would.** Adding a fourth wait kind broke the daemon's own `claim-takeover` handler, which refused anything that was not a conversation — so `timone takeover` would have worked while the daemon was down and failed while it was up, which is every time it matters.

**Three surfaces beyond the plan's file lists were telling the human something false about the new park**, and each was corrected where it stood. They are named as deviations below rather than absorbed.

## Sub-phase outcomes

| Sub-phase | Outcome | Commit |
| --- | --- | --- |
| 25a — The wait nothing written can resolve | Landed as planned. The kind and the refusal together; the refusal asserted at `verification`, and the same words on a handoff at the same stage still resume — the discrimination is the park, not the stage. 11 tests. | `9fc2023` |
| 25b — The way out | Landed as planned, plus one site the compiler forced (see deviations). The unbound assertion is by identity against `stagePrompt` for every prompted stage. 14 tests. | `84486d8` |
| 25c — What the ticket says | Landed, and touched two files outside its grant (see deviations). Forbidden vocabulary asserted as a list. 5 tests. | `69194dc` |
| 25d — A stage says it cannot use the answer | Landed as planned, plus `retry.ts` (see deviations). D2's rule reaches all ten prompted stages through one block, asserted by iterating them. 15 tests. | `9a10cd1` |
| 25e — The floor | Landed as planned, inside `applyPark`, reading the consumed marker at the one instant it exists. 6 tests. | `ac40e41` |
| 25f — End to end | Landed with **no production diff**, which the plan named as success. 6 tests. | `6fb8b9c` |
| 25g — The register and the narrative | Landed as planned. No file under `src/` touched, asserted rather than intended. | `a1412bd` |
| 25h — The live gate | **Not run.** Needs a real daemon, the fixture, and fvermaut. | — |

## Deviations from the plan

**1 — The run schema's counter landed in 25c, not 25e.** 25c's words depend on which detector fired, and a CTA that says *"I asked you the same thing twice — sorry"* has to read something. The field arrived with the words that read it; 25e added the arithmetic that writes it. Nothing else moved, and 25e's own checklist — optional field, pre-field ledger loads — is asserted where the plan put it.

**2 — `timone status` prints the command, and never did before.** 25c's own check is that the ticket and the terminal agree. They did agree about the sentence and disagreed about what could be done: `describeWait` rendered only *what* a run waits on, so a reader of `timone status` alone was told they were being waited on with nothing they could type. This is not new to the escalation park — a conversation park has offered `timone takeover` on the ticket for several phases and shown nothing in the terminal — but on this park there is no other way out to guess at, so it was fixed rather than filed.

**3 — `timone retry` learned the kind, and it is in no slice's file list.** Its refusal for a parked run ends *"Answer that and it carries on by itself."* On this park that sentence is precisely the untruth the whole decision removes, said by a second command. It now names the takeover instead. One test.

**4 — `poll.ts` gained an arm in 25b**, granted to no slice. The daemon's request handler resolves a takeover exactly as the command does and refused everything that was not a conversation. Left alone, the ticket's command would have failed against a live daemon. The type checker found it at the moment the resolution gained its fourth shape, which is what the exhaustiveness discipline in this codebase is for.

**5 — The escalation prompt derives what follows, rather than carrying the stage's claim.** `PipelineTransition` gained `{ kind: "escalate"; reason; owed? }` as the plan specified, and **nothing produces one**: the path that actually runs goes through `StageOutcome`'s new `escalated`, read off the ticket, because that is where a stage's own words live. So the prompt takes the account from the escalation comment (found by the run's own cursor, which is that comment's instant) and names what ordinarily follows from `stageAfter`, marked as the pipeline's default and not as a decision. The transition variant is left declared and unused: it is the vocabulary ADR-0033 names, and removing it is a judgement for whoever next needs it.

**6 — 25f produced no production diff**, as the plan predicted and permitted. All six cases were green on first run, including the hazard it existed to prove absent: a conversation record from elsewhere cannot conclude an escalation park, because `concludeLastConversation` is only reached for a conversation wait.

## What is now true, and what is only argued

**True, and tested:** a stage that posts the escalation marker parks on a wait no comment resolves, at the stage that stopped, with the cursor on its own comment; that park survives ten cycles of a human answering, spawning nothing; a run that reads an answer and re-asks at the same stage twice running is parked the same way, whether or not a stage noticed; the ticket says writing again will not move it, says which of the two happened, and carries `timone takeover`; that command opens a session bound to no stage, carrying the thread, the ledger entry, the stage's account marked as overrulable, and the human's words; the same command still refuses a gate, a review and a park it cannot resume, each in its own sentence; a handoff at a work stage still resumes on `carry on`.

**Argued, not observed:** all of it, on a real daemon. **1036 green tests are exactly the kind of evidence that was true of the machinery which asked fvermaut the same question five times** — every one of those five passes ran on a suite that was green. That is what 25h is for, and it is why this report does not claim timone#28 is closed.

## Known gaps this phase leaves

- **The rule reaches ten prompts and its reliability is ten different jobs.** The floor exists because that cannot be proven, not because it can.
- **Over-firing is invisible here.** A stage summoning a person who was not needed costs a declined command and would be found by use.
- **The counter does not survive a reset ledger**, as with phase 20's introduction record. It adds no new class of failure and is recorded so a later reader does not read it as drift.
- **A stuck run with no ticket reaches nobody.** Hand-run work has no CTA surface; out of scope, and unproven either way.

## Handoff to the live gate

- **`npm run build` first, and restart the daemon before observing anything.** A running daemon keeps the code it started with; this has now bitten seven times.
- **`scratch-app` only, never `ivtrends`** — ruled twice, and `ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1) is being unblocked by hand elsewhere. A gate daemon should run against a **copy** of the ledger (`--state`) and a manifest naming `scratch-app` alone, so nothing on the live client repository is touched.
- **Step 1 is the expensive one.** Getting a run to a genuine stop where the answer cannot be used means driving the pipeline there; the cheapest honest fixture is a ticket whose written answer asks the running stage to change the thing it is checking against.
- **Step 4 needs a stage that stays silent**, which no prompt now encourages — the floor is proven in the loop by test, and observing it live may need a fixture that answers the same question twice on purpose.
- **Step 7 is the cost and the escape in one observation:** queue a second ticket behind the park, watch it wait, resolve the escalation, watch it promote.
- **The human question is step 1's, and it is the only thing this phase cannot answer for itself:** handed a stop the machine cannot resolve, did the ticket tell you the truth about it the first time?
