import { describe, expect, it } from "vitest";

import { ctaComment, ctaFor } from "./cta.js";
import { PIPELINE_STAGES, type PipelineStage } from "./pipeline.js";
import { runId, type Run } from "./runs.js";

/** A run in whatever state the test needs, with the rest left plausible. */
function run(overrides: Partial<Run> & Pick<Run, "project" | "ticket">): Run {
  return {
    id: runId(overrides.project, overrides.ticket, 1),
    seq: 1,
    status: "active",
    flags: [],
    createdAt: "2026-08-13T10:00:00Z",
    updatedAt: "2026-08-13T10:01:00Z",
    ...overrides,
  };
}

describe("ctaFor", () => {
  it("names the pull request a review wait is waiting on", () => {
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "delivery",
        waitingKind: "review",
        waitingOn: "your review",
        pr: 9,
      }),
    });

    expect(cta.needFromYou).toBe("your review of pull request #9");
    expect(cta.waitingOnYou).toBe(true);
  });

  it("asks for the answer a gated run recorded, in the run's own words", () => {
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 7,
      run: run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        stage: "planning",
        waitingKind: "gate",
        waitingOn: "your answer on the ticket",
      }),
    });

    expect(cta.needFromYou).toBe("your answer on the ticket");
    expect(cta.waitingOnYou).toBe(true);
  });

  it("asks for nothing while a session is working the ticket", () => {
    // The words the acknowledgement comment already uses (`pickedUpComment`),
    // so the ticket does not acquire a second dialect for one fact.
    for (const status of ["picked-up", "active"] as const) {
      const cta = ctaFor({
        project: "scratch-app",
        ticket: 7,
        run: run({ project: "scratch-app", ticket: 7, status, stage: "triage" }),
      });

      expect(cta.needFromYou).toBe(
        "nothing right now — I'll comment here when I do.",
      );
      expect(cta.waitingOnYou).toBe(false);
    }
  });

  it("asks for nothing from a ticket blocked behind another on its project", () => {
    // `queuedComment`'s own words: a queued ticket is blocked by the one
    // ahead of it, and nothing the human does moves it up the line.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 8,
      run: run({ project: "scratch-app", ticket: 8, status: "queued" }),
    });

    expect(cta.needFromYou).toBe(
      "nothing right now — I'll comment here when I start.",
    );
    expect(cta.waitingOnYou).toBe(false);
  });

  it("names the exact retry command for a run that stopped early", () => {
    // ADR-0024's `scratch-app` #13: `timone status` already offers this
    // command and the ticket does not. One computation, so it cannot.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 13,
      run: run({
        project: "scratch-app",
        ticket: 13,
        status: "failed",
        stage: "planning",
        failure: "the model was unavailable",
      }),
    });

    expect(cta.command).toBe("timone retry scratch-app#13");
    expect(cta.needFromYou).toBe(
      "run the command and I'll pick it up from where it stopped.",
    );
  });

  it("asks for nothing from a ticket whose chunk was abandoned", () => {
    // A cancelled chunk was abandoned rather than broken, so this must not
    // read like the failure above it: no retry command, because retry refuses
    // a cancelled run outright.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 13,
      run: run({
        project: "scratch-app",
        ticket: 13,
        status: "cancelled",
        stage: "planning",
        cancellation: "you asked me to stop",
      }),
    });

    expect(cta.headline).toBe("I stopped work on this one.");
    expect(cta.needFromYou).toBe(
      "nothing — while this ticket is open and marked for me I'll start it afresh on my next pass.",
    );
    expect(cta.waitingOnYou).toBe(false);
    expect(cta.command).toBeUndefined();
  });

  it("names the exact takeover command for a ticket waiting on a conversation", () => {
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "clarification",
        waitingKind: "conversation",
        waitingOn: "a conversation in your terminal",
      }),
    });

    expect(cta.command).toBe("timone takeover scratch-app#6");
    expect(cta.needFromYou).toBe("a conversation in your terminal");
    expect(cta.waitingOnYou).toBe(true);
  });

  it("tells an unmarked ticket with no run what hands it over", () => {
    // `scratch-app` #5 in ADR-0024's table: filed, unlabelled, and silent
    // since. The label is the thing that would move it, so the line names it.
    const cta = ctaFor({ project: "scratch-app", ticket: 5, labels: ["bug"] });

    expect(cta.needFromYou).toBe(
      "add the `timone` label to this ticket and I'll pick it up.",
    );
    expect(cta.waitingOnYou).toBe(true);
  });

  it("asks for nothing from a marked ticket the daemon has yet to reach", () => {
    // Marked and unregistered is the gap between a human labelling a ticket
    // and the next poll cycle. The daemon is what moves it, so nobody is asked.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 5,
      labels: ["bug", "timone"],
    });

    expect(cta.needFromYou).toBe(
      "nothing right now — I'll comment here when I do.",
    );
    expect(cta.waitingOnYou).toBe(false);
  });

  it("asks for nothing from a ticket whose work is finished", () => {
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "done",
        stage: "delivery",
      }),
    });

    expect(cta.needFromYou).toBe(
      "nothing — file a new ticket for anything else.",
    );
    expect(cta.waitingOnYou).toBe(false);
  });

  it("says the next piece is coming while an initiative still has pieces left", () => {
    // The state 23f left broken: between two chunks the ticket's *last* run is
    // `done`, and the initiative is not. Answering "this one is finished" here
    // is the stale line R21 exists to abolish, and for a re-proposed list it
    // never goes away.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "done",
        stage: "delivery",
      }),
      progress: { total: 3, done: 1, next: { index: 2, title: "The next chunk opens" } },
    });

    expect(cta.headline).toBe("Piece 2 of 3 is next.");
    expect(cta.needFromYou).toBe(
      "nothing right now — I'll start it on my next pass.",
    );
    expect(cta.waitingOnYou).toBe(false);
  });

  it("still names the pull request when a review is a piece of an initiative", () => {
    // ADR-0028 D4's third state: the review call to action, unchanged, and
    // only gaining the piece count. The number is what a reviewer navigates
    // by, so the piece may never be added at its expense.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "delivery",
        waitingKind: "review",
        waitingOn: "your review",
        pr: 9,
      }),
      progress: {
        total: 3,
        done: 1,
        next: { index: 2, title: "The next chunk opens" },
      },
    });

    expect(cta.needFromYou).toBe(
      "your review of pull request #9 — that's piece 2 of 3.",
    );
    expect(cta.waitingOnYou).toBe(true);
  });

  it("names the piece it is building while a chunk of an initiative runs", () => {
    // ADR-0028 D4's first state. The piece being built is the one the ledger
    // has not finished yet, which is `next` — a live chunk is not a done one.
    for (const status of ["picked-up", "active"] as const) {
      const cta = ctaFor({
        project: "scratch-app",
        ticket: 6,
        run: run({ project: "scratch-app", ticket: 6, status, stage: "execution" }),
        progress: {
          total: 3,
          done: 1,
          next: { index: 2, title: "The next chunk opens" },
        },
      });

      expect(cta.headline).toBe("Building piece 2 of 3.");
      expect(cta.needFromYou).toBe(
        "nothing right now — I'll comment here when I do.",
      );
      expect(cta.waitingOnYou).toBe(false);
    }
  });

  it("says what it always said while working a ticket that has no pieces", () => {
    // Nearly every ticket in the live ledger has no breakdown at all, and this
    // slice must not change one word on any of them. Held against the literal.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 7,
      run: run({ project: "scratch-app", ticket: 7, status: "active", stage: "execution" }),
    });

    expect(cta.headline).toBe("Picked this up.");
    expect(cta.needFromYou).toBe(
      "nothing right now — I'll comment here when I do.",
    );
  });

  it("calls an initiative finished only once no piece of it remains", () => {
    // The one state where "finished" is the true answer: the last piece
    // merged. Same words as a ticket that never had pieces at all, because
    // from the reader's side it is the same situation.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "done",
        stage: "delivery",
      }),
      progress: { total: 3, done: 3 },
    });

    expect(cta.headline).toBe("This one is finished.");
    expect(cta.needFromYou).toBe(
      "nothing — file a new ticket for anything else.",
    );
    expect(cta.waitingOnYou).toBe(false);
  });

  it("asks whether to carry on when the list of pieces grew after it was approved", () => {
    // 23f's permanent contradiction: `reproposedComment` says "I've stopped
    // here, tell me whether to carry on" and the standing line, in the same
    // cycle, said nothing was needed. Two sentences on one thread, disagreeing
    // for ever. This one is the half that has to say a human is waited on.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 6,
      run: run({
        project: "scratch-app",
        ticket: 6,
        status: "done",
        stage: "delivery",
      }),
      progress: {
        total: 4,
        done: 2,
        next: { index: 3, title: "A piece nobody has read" },
        reproposed: true,
      },
    });

    expect(cta.headline).toBe(
      "The list of pieces has grown since you approved it.",
    );
    expect(cta.needFromYou).toBe(
      "say here whether to carry on with the longer list.",
    );
    expect(cta.waitingOnYou).toBe(true);
  });

  it("names what would unblock a ticket parked at a stage nobody has built", () => {
    // `scratch-app` #4 in ADR-0024's table. Nothing can move it, so no command
    // is offered — a command that does not work is worse than none — and the
    // line names the thing that would: the next stage, built.
    const cta = ctaFor({
      project: "scratch-app",
      ticket: 4,
      run: run({
        project: "scratch-app",
        ticket: 4,
        status: "parked",
        stage: "triage",
        waitingOn: "the next stage to be built",
      }),
    });

    expect(cta.needFromYou).toBe("the next stage to be built");
    expect(cta.command).toBeUndefined();
  });

  it("heads a stopped ticket with what happened, in the words already used", () => {
    // `parkedComment`'s headline for a ticket nothing can move, and
    // `failedComment`'s for one that broke — the reader has seen both before.
    const stopped = ctaFor({
      project: "scratch-app",
      ticket: 4,
      run: run({
        project: "scratch-app",
        ticket: 4,
        status: "parked",
        stage: "triage",
        waitingOn: "the next stage to be built",
      }),
    });
    const broken = ctaFor({
      project: "scratch-app",
      ticket: 13,
      run: run({ project: "scratch-app", ticket: 13, status: "failed" }),
    });

    expect(stopped.headline).toBe(
      "That's as far as I can take this one for now.",
    );
    expect(broken.headline).toBe(
      "Something went wrong while I was working on this.",
    );
  });
});

describe("ctaFor — the wayfinder map's two states", () => {
  /** The map ticket's run, parked at its own stage. */
  function map(waitingKind: Run["waitingKind"]): Run {
    return run({
      project: "ivtrends",
      ticket: 1,
      status: "parked",
      stage: "charting",
      waitingKind,
      waitingOn: "this map's own questions to be answered",
    });
  }

  it("asks for nothing at all while the map still has questions open", () => {
    // R21's fourth criterion, and the half that must never be forgotten: a
    // map does not advance on a single answer, so while it is being worked
    // the human is not being waited on and must not be told they are. The
    // words are `pickedUpComment`'s kind of words rather than a new dialect.
    const cta = ctaFor({ project: "ivtrends", ticket: 1, run: map(undefined) });

    expect(cta.waitingOnYou).toBe(false);
    expect(cta.needFromYou).toBe(
      "nothing right now — I'll come back here when the last one is closed.",
    );
    expect(cta.headline).toBe("I'm working through this map's questions.");
    expect(cta.command).toBeUndefined();
  });

  it("invites the go-ahead once the way to the destination is clear", () => {
    // R21's fifth criterion. This is the sentence `ivtrends` #1 needed on
    // 2026-08-13 and did not have: the machine said "nothing right now" and
    // fvermaut answered anyway.
    const cta = ctaFor({
      project: "ivtrends",
      ticket: 1,
      run: map("conversation"),
    });

    expect(cta.waitingOnYou).toBe(true);
    expect(cta.needFromYou).toBe(
      "say go ahead here and I'll write the specification this map has been finding its way to.",
    );
    expect(cta.headline).toBe("Every question on this map is answered.");
  });

  it("names no command for the map, because none of them holds it", () => {
    // Every other conversation park names `timone takeover`. The map's stage
    // starts no session of its own, so the terminal has nothing to hold — and
    // a call to action naming a command that answers "I can't hold a
    // conversation for that yet" is worse than one naming none.
    expect(ctaFor({ project: "ivtrends", ticket: 1, run: map("conversation") }).command)
      .toBeUndefined();
  });

  it("says a map that broke what a broken ticket says, not what a map says", () => {
    // The map's branch is a *parked* branch. A run that failed, is queued or
    // is being worked reads exactly as any other ticket in that state — the
    // map is not an exception to the rest of the computation.
    const cta = ctaFor({
      project: "ivtrends",
      ticket: 1,
      run: run({
        project: "ivtrends",
        ticket: 1,
        status: "failed",
        stage: "charting",
      }),
    });

    expect(cta.headline).toBe("Something went wrong while I was working on this.");
    expect(cta.command).toBe("timone retry ivtrends#1");
  });
});

/**
 * The wait each stage's park opens, written out by hand from the stage graph
 * rather than read back from `waitFor()` — an expectation computed the
 * implementation's way proves nothing. A stage that waits on nothing parks only
 * when what follows it is unbuilt, which records no kind of wait at all.
 */
const WAIT_AT: Record<PipelineStage, Run["waitingKind"]> = {
  triage: undefined,
  clarification: "conversation",
  wayfinding: "conversation",
  // The map's park has two kinds across its life — none while its own
  // questions are open, a conversation once they are all closed. The
  // conversation is the one this table is about: it is the state where a
  // human is being waited on, and the two are covered case by case above.
  charting: "conversation",
  research: undefined,
  requirements: "gate",
  // ✏ ADR-0030 D1 moved the second gate off the phase file and onto the list
  // of pieces. `planning` runs once per piece now and stops for nobody: what
  // judges a piece is its pull request, so a run leaving planning is a run
  // walking straight on into the build.
  breakdown: "gate",
  planning: undefined,
  execution: undefined,
  verification: undefined,
  delivery: "review",
  remediation: undefined,
  feedback: undefined,
};

describe("ctaFor — every stage in the graph", () => {
  it("covers the whole graph, so a new stage cannot slip past this table", () => {
    expect(Object.keys(WAIT_AT).sort()).toEqual([...PIPELINE_STAGES].sort());
  });

  for (const stage of PIPELINE_STAGES) {
    it(`says what a ticket parked at ${stage} is waiting for`, () => {
      const kind = WAIT_AT[stage];
      const cta = ctaFor({
        project: "scratch-app",
        ticket: 42,
        run: run({
          project: "scratch-app",
          ticket: 42,
          status: "parked",
          stage,
          waitingKind: kind,
          waitingOn: "the thing this stage stopped on",
          ...(kind === "review" ? { pr: 11 } : {}),
        }),
      });

      expect(cta.waitingOnYou).toBe(true);
      expect(cta.needFromYou).not.toBe("");
      // The takeover is the terminal fallback for a conversation, and only for
      // a conversation: a gate is answered by replying, a review on the pull
      // request. Naming a command that resolves neither would be a dead end.
      //
      // ✏ The map is the one conversation it is a dead end for, since
      // ADR-0024: `charting` starts no session, so `takeover` refuses it by
      // name ("a stage I can't hold a conversation for yet"). Its go-ahead is
      // written on the ticket, which is what its own cases above assert.
      expect(cta.command).toBe(
        kind === "conversation" && stage !== "charting"
          ? "timone takeover scratch-app#42"
          : undefined,
      );
    });
  }
});

describe("ctaComment", () => {
  it("opens with the headline, offers the command, and closes on the CTA", () => {
    const body = ctaComment({
      headline: "This one is waiting on you.",
      needFromYou: "a conversation in your terminal",
      waitingOnYou: true,
      command: "timone takeover scratch-app#6",
    });

    const lines = body.split("\n");
    expect(lines[0]).toBe("**This one is waiting on you.**");
    // Copy-pasteable, as every other command Timone puts on a ticket is.
    expect(body).toContain("```\ntimone takeover scratch-app#6\n```");
    // The house rule every comment obeys: the last line is what is being asked.
    expect(lines.at(-1)).toBe(
      "**What I need from you:** a conversation in your terminal",
    );
  });

  it("says nothing about a command when none moves the ticket", () => {
    const body = ctaComment({
      headline: "That's as far as I can take this one for now.",
      needFromYou: "the next stage to be built",
      waitingOnYou: true,
    });

    expect(body).not.toContain("```");
    expect(body.split("\n").at(-1)).toBe(
      "**What I need from you:** the next stage to be built",
    );
  });
});

describe("ctaFor — a run the machine broke itself", () => {
  it("says the fault is its own when the link went, and still names the way back", () => {
    const cta = ctaFor({
      project: "ivtrends",
      ticket: 1,
      run: run({
        project: "ivtrends",
        ticket: 1,
        status: "failed",
        failure: "the session stopped on an API error (server_error)",
      }),
    });

    expect(cta.headline).toBe("I could not reach the service I run on, so I stopped.");
    expect(cta.waitingOnYou).toBe(false);
    expect(cta.command).toBe("timone retry ivtrends#1");
  });

  it("says the login was refused, and that it needs fixing before the command works", () => {
    const cta = ctaFor({
      project: "ivtrends",
      ticket: 1,
      run: run({
        project: "ivtrends",
        ticket: 1,
        status: "failed",
        failure: "the session stopped on an API error (authentication_failed)",
      }),
    });

    expect(cta.headline).toBe(
      "My login to the service I run on was refused, so I stopped.",
    );
    expect(cta.needFromYou).toMatch(/login needs fixing first/);
  });

  it("keeps the old words for a failure that was about the work", () => {
    const cta = ctaFor({
      project: "ivtrends",
      ticket: 1,
      run: run({
        project: "ivtrends",
        ticket: 1,
        status: "failed",
        failure: "the planning stage said it finished, but nothing was committed",
      }),
    });

    expect(cta.headline).toBe("Something went wrong while I was working on this.");
  });
});
