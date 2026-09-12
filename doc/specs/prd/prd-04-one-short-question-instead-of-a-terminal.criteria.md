# PRD-04 Acceptance Criteria — One short question instead of a terminal session

> Formal register for [prd-04-one-short-question-instead-of-a-terminal.md](prd-04-one-short-question-instead-of-a-terminal.md).
> Maintained by: timone-prd (creation), timone-verify (status),
> timone-prd (revisions). Requirement IDs are stable — never renumber.

## R1 — A reply that is neither an approval nor a change request is met with one short question

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Criteria:**
    - GIVEN a run parked on a request for approval
      WHEN the human replies with a word that is plainly a misspelling of an approval word, and asks for no change
      THEN the ticket's next message is one short question asking whether they meant to approve
      AND no stage session is started
      AND the ticket does not name a `timone takeover` command
    - GIVEN that question has been posted
      WHEN the human replies with a word matching a known approval word
      THEN the gate closes and the work carries on to the next step with no further message asking anything of them
- **Verification hint:** supervised run against a real forge. Open a run to a request for approval, comment `aprrove`, and watch the ticket. The expected shape is the exchange recorded in [ADR-0054](../../adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md). The failing shape is the one on [ivtrends#90](https://github.com/fvermaut/ivtrends/issues/90): a message containing `timone takeover`.

## R2 — Only a known approval word closes a gate

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** `ask-check.test.ts` — *the limits hold by construction*: the module's import list is asserted empty, so it can reach no gate reader. A gate outcome taking a model's output as input would have to add an import, and that test goes red.
- **Criteria:**
    - GIVEN a gate awaiting an answer
      WHEN the ask check is given a reply that it judges to mean approval but which matches no known approval word
      THEN the gate does not close
      AND the reply is still read by the ordinary gate reader, which decides the outcome
    - GIVEN any reply at all
      WHEN the gate outcome is computed
      THEN that outcome is a function of the reply text and the known approval words only, and no model output is an input to it
- **Verification hint:** the gate reader is `readGateDecision` in `src/daemon/gates.ts`; the approval words are `APPROVAL_TOKENS` in the same file. The check is that the ask check has no write path to a gate outcome — a test that hands it a reply it reads as approval and asserts the run's state is unchanged, plus a reading of the seam showing the ask check's result is never an input to `readGateDecision`.

## R3 — The ask check cannot move work to another step

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** `ask-check.test.ts` — the empty import list, plus `poll.test.ts` *is not consulted about a ticket that is waiting on nobody*. The check is handed no store, so a call that moved a run would not compile.
- **Criteria:**
    - GIVEN a run at any step
      WHEN the ask check runs, whatever it concludes
      THEN the run's step is the same before and after
      AND the run's recorded waiting state is the same before and after
- **Verification hint:** the ask check is given no means of writing a run's state, so this holds by construction rather than by care. Verify by the seam: the ask check's declared output type admits only *let it through* and *ask this instead*, and it is handed nothing that can write the ledger. A test asserting run state is unchanged across an ask-check call backs it up.

## R4 — A message the ask check does not replace is posted unchanged, and it may never withhold one

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** `ask-check.test.ts` — *offers no way to say post nothing*, which asserts the verdict type's two members across every input shape, and the three *posts the composed message when …* cases.
- **Criteria:**
    - GIVEN a message about to be sent to a person
      WHEN the ask check lets it through
      THEN the text posted is byte for byte the text that was composed
    - GIVEN a message about to be sent to a person
      WHEN the ask check judges that the person need not be asked at all
      THEN it has no way to express that, and the message is posted
- **Verification hint:** the ask check's output type has exactly two cases and no third meaning *post nothing*. Test both: a let-through preserves the composed text exactly, and there is no code path from an ask-check result to a suppressed message.

## R5 — One question per ask, and it does not spend the clarifying round

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Criteria:**
    - GIVEN the ask check has already replaced one message on a given ask
      WHEN the answer to its question still cannot be used
      THEN the message it originally stood in front of is posted as composed
      AND it does not ask a second time on that ask
    - GIVEN the ask check has spent its question on a ticket
      WHEN a stage later reads a written answer on that same ticket
      THEN the stage's own single clarifying round is still unspent
- **Verification hint:** the existing clarifying round is counted by `clarifyingRounds` in `src/daemon/gates.ts`, reading a marker on the thread. The ask check's budget must be counted separately, so a test that spends an ask-check question and then asserts `clarifyingRounds` still reads zero is the direct check.

## R6 — The ask check speaks only where a person was already going to be asked

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** api
- **Falsified-by:** `poll.test.ts` — *is not consulted about a ticket that is waiting on nobody*, and the single call site in `reconcileCtas`.
- **Criteria:**
    - GIVEN any run in any state
      WHEN no message asking a person for something is about to be sent
      THEN the ask check does not run, and no message is posted
    - GIVEN a full pass over a set of runs
      WHEN the messages posted with the ask check in place are compared to those posted without it
      THEN the count of messages asking a person for something is the same or lower, never higher
- **Verification hint:** the ask check is called from the one place a person-directed message is composed, and from nowhere else. Verify by call sites, plus a test over a set of run states asserting the count of person-directed messages does not rise.

## R7 — A written answer starts the unbound session, but only when it answers the ask check's own question
> ✏ 2026-09-12 (built under [timone#132](https://github.com/fvermaut/timone/issues/132)): the machinery now exists. A stop of this kind is started by the answer to a question the check framed, and by nothing else — any other comment still moves nothing, so [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) D4's reason stands. The check's silence on these stops, recorded in [the phase 39 report](../../plans/phases/reports/phase-39-complete.md), is lifted.

- **Priority:** MUST
- **Status:** draft
- **Verify-via:** live
- **Falsified-by:** `poll.test.ts` — *and answering it moves a stop that words used to not move*: three cases covering the answer that starts a session, the comment that starts nothing because the machine asked nothing, and the second cycle that starts no second session.
- **Criteria:**
    - GIVEN a run the machine has given up on, where the ask check has posted a question framed to unstick it
      WHEN the human answers that question in writing
      THEN a session bound to no stage starts by itself, carrying that answer and the whole thread
      AND the human is asked to run no command
    - GIVEN a run the machine has given up on, where no such question was posted
      WHEN the human writes any comment
      THEN nothing starts, and the ticket still names the command that moves it
    - GIVEN the unbound session has run
      WHEN it finishes
      THEN it has committed a record naming what it did and any default it departed from
- **Verification hint:** supervised run against a real forge. Drive a run into a dead stop both ways — once with an ask-check question posted, once without — and compare. The record the session owes is the one [ADR-0033](../../adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md) D5 already requires.

## R8 — The question reads plainly and says what is needed

- **Priority:** SHOULD
- **Status:** draft
- **Verify-via:** human
- **Criteria:**
    - The question follows the project's writing rules: short sentences, common words, no comparisons, and no words that only mean something to someone who has read the process document.
    - It quotes back what the person actually wrote, so they can see what was read.
    - It ends by saying what is needed from them, and answering it takes one line.
- **Verification hint:** read the question the ask check posted on the run used for R1 and judge it against `process.md`'s writing rules. A question longer than a few sentences fails.

## Accessibility

No requirement here delivers a user interface. The only thing a person sees is a comment on a ticket, rendered by the forge, so the mandatory baseline attaches nothing to this register. Recorded rather than skipped in silence, per PRD-01.R20.
