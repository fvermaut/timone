import { describe, expect, it } from "vitest";

import { ctaComment, ctaFor } from "./cta.js";
import { PIPELINE_STAGES, type PipelineStage } from "./pipeline.js";
import type { Run } from "./runs.js";

/** A run in whatever state the test needs, with the rest left plausible. */
function run(overrides: Partial<Run> & Pick<Run, "project" | "ticket">): Run {
  return {
    id: `${overrides.project}#${overrides.ticket}`,
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
  research: undefined,
  requirements: "gate",
  planning: "gate",
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
      expect(cta.command).toBe(
        kind === "conversation" ? "timone takeover scratch-app#42" : undefined,
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
