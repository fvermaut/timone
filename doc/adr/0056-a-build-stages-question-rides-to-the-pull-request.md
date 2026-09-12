# ADR-0056: A build stage's question rides to the pull request

- **Status:** accepted
- **Date:** 2026-09-12
- **Source:** fvermaut, on [ivtrends#93](https://github.com/fvermaut/ivtrends/issues/93), 2026-09-12: *"a piece of work should go to the PR no matter what, and report any issue in the PR"* — said, by his count, for at least the fifth time. Amends [ADR-0052](0052-a-run-that-enters-the-build-ends-at-its-pull-request.md).

## Context

ADR-0052 ruled that a run never stops between its last human agreement and its pull request, and it left the escalation machinery standing as a last-resort guard: a run entering it is *"a fault to file, never a wait to serve"*. The daemon filed that fault by failing the run.

Failing the run is still a stop. The work sits one step short of the pull request, the ticket says the machine stopped, and a person has to type `timone retry` to start it again — which re-runs the same stage, which makes the same judgement, and asks again. That is what happened:

- `ivtrends` #89, 2026-09-11. The checking step did its whole job and then asked about blocked checks. The run was filed. Three sentences left behind in the checking step's instructions were corrected the same evening.
- `ivtrends` #93, 2026-09-12, with those sentences already corrected. The checking step asked anyway, the run was filed, the retry ran the step again, and it asked the same question a second time. Four interventions on one ticket, none of which bought a decision.

The instructions were right both times and were read both times. A rule the machinery only writes down is a rule it does not have.

Alternatives considered and rejected:

- **Correct the words again.** Rejected: tried twice, and #93 asked its question on a run whose skill already forbade it in four separate paragraphs.
- **Answer the question automatically.** Rejected for ADR-0052's own reason: machinery that answers its own questions rubber-stamps the one gate that matters.
- **Let the retry resume at the next stage instead of the failed one.** Rejected: it keeps the stop and the human command, and only shortens what they cost.

## Decision

**A build stage asking a person for something is recorded and overtaken, never obeyed.** At `execution`, `verification` and `delivery`, the two sentences a session can use to stop on a person — a hand-back and an escalation — are read by the daemon as the stage having finished. The stage's own words are written onto the run, and the run advances exactly as a clean finish would.

**The words ride to the pull request.** Stage 8's prompt carries every question an earlier stage asked, and the pull request's departures section states each one: what was asked, and what the work did instead. This is the same place ADR-0052 already sends checks that did not run, amended requirements and failing tests.

**What is still checked is the artifact, never the question.** A stage that asked *and* did not leave what it owes on the branch — an unstamped phase file, a missing verification report, a delivery with no pull request — still fails the run. A question is carried; a missing artifact is not, because the next stage would have nothing to work on.

**The fault stays a fault.** The record is kept so the behaviour stays visible and fixable in the stage's own instructions. What it no longer does is stop the work.

## Consequences

- No build stage can park a run on a person any more by any route, whatever its instructions say or fail to say. The rule is now in the daemon, where ADR-0052 only ever put it in prose.
- A pull request may open carrying a question nobody answered. That is the intent: the reviewer is already there, and merging or closing answers it.
- `timone retry` is no longer the way out of a question asked inside the build, because there is no longer a stop to retry. The existing `BUILD_ESCALATION_PREFIX` reading stays only for runs already filed that way.
- A stage whose instructions are wrong now costs a confusing paragraph in a pull request instead of a stopped run. The paragraph is the signal that the instructions need fixing — quieter than a stop, and it must be watched for.
- ADR-0052's last paragraph is amended: inside the build the escalation class is not merely empty by rule, it is unreachable by construction.
