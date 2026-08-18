# ADR-0034: A technical stop is retried, not reported

- **Status:** accepted
- **Date:** 2026-08-18
- **Source:** [timone#29](https://github.com/fvermaut/timone/issues/29), filed on fvermaut's ruling of 2026-08-18 — *"a failed run for technical/transient reasons should not surface on the ticket"*
- **Takes up:** [ADR-0017](0017-a-runs-liveness-is-its-heartbeat.md)'s own escalation clause — *"if that proves to be the wrong trade, the escalation already discussed is one free automatic re-arm per run with an attempt counter, and this ADR is what to revisit"*
- **Bounds:** [ADR-0020](0020-liveness-is-judged-only-over-witnessed-time.md), whose *"reclaim is still not recovery"* is left exactly as it stands; [ADR-0023](0023-one-answer-one-session.md), whose claim-then-start order every attempt keeps

## Context

`ivtrends` [#1](https://github.com/fvermaut/ivtrends/issues/1) was stopped three times on 2026-08-18 by something that had nothing to do with the work:

| Time (UTC) | Reason recorded | Comment |
| --- | --- | --- |
| 05:42 | `authentication_failed` | [5324119415](https://github.com/fvermaut/ivtrends/issues/1#issuecomment-5324119415) |
| 16:34 | `server_error` | [5331189484](https://github.com/fvermaut/ivtrends/issues/1#issuecomment-5331189484) |
| 17:32 | `server_error` | [5331795720](https://github.com/fvermaut/ivtrends/issues/1#issuecomment-5331795720) |

Each posted the same comment — *"Something went wrong while I was working on this"* — under a request to re-mark the ticket, which on a broken run does nothing at all ([timone#27](https://github.com/fvermaut/timone/issues/27)). Each stopped the work until somebody typed `timone retry ivtrends#1` at a terminal. The 05:42 stop cost seven hours.

**The daemon reads the error correctly and then does one thing with it.** `sessionOutcomeFrom` (`src/daemon/session.ts`) already exists precisely to catch a session whose last word was an API error — it was written on 2026-08-07 after the SDK reported success over a session that had died mid-response. It knows the error code. It then hands back a `SessionOutcome` whose only shape is `ok: false`, and `runStage` sends every `ok: false` down one road: fail the run, post `failedComment`, stop. A dropped socket and a stage that contradicted itself are indistinguishable from that road's point of view.

**Nothing retries, anywhere in the daemon.** That was decided, not overlooked. ADR-0017 chose *"a reclaimed run is failed, never resumed automatically"* on two arguments: a crash mid-stage can leave partial commits on a work branch, and a crash that reproduces would loop for ever. It priced the cost in the same breath — *"an unattended overnight run stops at the crash and waits"* — and named the escalation to reach for if the price turned out too high. ADR-0020 superseded ADR-0017's mechanism and carried its conservatism over untouched.

**What ADR-0017 was reasoning about is not what happens here, and the difference is the evidence.** Reclaim is the daemon finding a run it never watched die: no session, no result, no idea how far the stage got — blind by construction, and rightly conservative about a branch nobody vouched for. A session that dies on the link is the opposite case. The daemon watched it, holds its result, and can read from that result what stopped it. Conservatism about the first says nothing about the second.

**The act being proposed is one the human is already told to perform.** `timone retry` re-arms a failed run at the stage it failed, on the branch as the attempt left it, and `failedComment` asks for it by name. It is run routinely and it works. So automatic retry adds no act to the system; it changes who has to be awake to ask for it.

**Alternatives considered:**

- **Say nothing and stop silently.** Cheapest, and wrong: the run still holds its ticket, and a ticket that goes quiet with nothing recorded is worse than a ticket carrying a wrong message.
- **Keep the comment, fix its wording only.** Honest, and it leaves the seven hours in place — the human still has to notice, decide and type.
- **Retry for ever, with a growing wait.** Survives any outage, and revives exactly the failure ADR-0017 refused: a stage that breaks every time would loop until somebody noticed the bill.
- **A bounded retry inside the stage, then one honest comment** (chosen).

**Alternatives considered, for who classifies the stop:**

- **The runtime tags its own outcome** with a typed field. Precise at the source, and it puts the rule in every runtime — including the fakes, which then have to remember it to be tested.
- **The daemon reads the failure's words, in one function** (chosen). The runtime reports what happened; the daemon decides what kind of stop it was. One site, one rule, and every runtime is judged the same way.

## Decision

**A failure the machine can survive on its own is survived, not reported.**

**D1 — A stop is technical when the daemon can recognise it as such, and only then.** `technicalFault` reads the failure's own words and returns `link` (the connection, or the service behind it: a dropped socket, a 500, an overload, a rate limit), `credentials` (the login refused), or nothing. **An unrecognised wording is not technical.** The unknown case is reported to a human rather than retried in silence, because a stop nobody has taught the daemon about is exactly the stop that should not be repeated unattended. It lives in a module of its own (`src/daemon/faults.ts`) and stays pure: two surfaces need this judgement and only one of them may load an agent runtime.

**D2 — A broken link is tried again, up to a ceiling, and the ticket hears nothing while it is.** Two further attempts, after 60s and 300s. The ceiling is the guard ADR-0017 asked for: a stage that breaks every time reaches a human within about six minutes rather than looping. Between attempts nothing is posted, no label moves and no state is written beyond the run's own.

**D3 — A refused login is not retried.** It is technical by D1 and unfixable by repetition: the next attempt presents the same refused login. It fails at once, with the technical wording.

**D4 — The heartbeat keeps beating through a wait.** The ticker that stamps `heartbeatAt` belongs to a session, and between attempts there is none. An unstamped wait longer than four intervals is, by ADR-0017's own rule as ADR-0020 narrowed it, evidence of a dead run — so a silent wait would have the recovery machinery reclaim the run it is nursing. The ticker therefore runs over the wait too, stamping and printing nothing.

**D5 — A technical stop that survives the ceiling gets its own comment, and it asks for nothing.** `unreachableComment` says the fault is the machine's, says what was tried, says nothing on the ticket changed, and requests no act from the reader — where `failedComment` said *"something went wrong"* over a request to re-mark, which is the wrong subject and, on a broken run, a request with no effect. `failedComment` keeps every failure that is about the work.

**D6 — The ticket's standing note says the same thing.** `ctaFor` reads the recorded failure through the same function, so the note a reader is pointed at cannot say *something went wrong* over a comment saying the machine could not get through. It still names `timone retry`, because that remains the true way back — and where the login was refused it says so, since the command will do nothing until the login is mended.

**D7 — Nothing about reclaim changes.** A run whose daemon died is still failed and still waits for `timone retry`. This decision covers the failure the daemon watched happen and holds a result for; ADR-0020's rule governs the one it did not.

## Consequences

- **The overnight cost ADR-0017 accepted is narrowed, not removed.** A hiccup no longer ends the night's work. A crash that reproduces still stops, six minutes later than it used to.
- **A retried stage can repeat work a dead attempt had already committed.** This is the exposure `timone retry` has always carried, now reached without a human deciding to accept it each time. What limits it is unchanged: the stage's own entry checks refuse a tree they do not recognise, and the attempt ceiling is short.
- **Retrying costs money.** Up to three sessions where there was one, on the stage's own model. Bounded by D2 and visible in the daemon log, which names every attempt and every wait.
- **The project's slot is held while the daemon waits** — up to about six minutes in which no other ticket on that project starts. Accepted: the alternative is releasing a branch mid-stage.
- **Classification is by wording, so it will be incomplete.** New error codes will arrive unrecognised and be reported as work failures — visibly, on a ticket, which is how they get added. The list is one function and one test.
- **The refused login still lands on a ticket**, because Timone has no operator channel. It is the wrong reader for that message, and the narrowing here is only that it no longer reads as the ticket's fault. Filing an operator route stays open.
- **`timone#27` is untouched.** The false *"re-mark this ticket"* still stands under `failedComment` for every failure that is about the work. This ADR removes it only from the path it now owns.
