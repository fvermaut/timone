import { describe, expect, it } from "vitest";

import type { TicketComment } from "../adapters/ticketing.js";
import type { GateDecision } from "./gates.js";
import {
  CLASSIFICATIONS,
  PIPELINE_STAGES,
  classificationFromLabels,
  concludeConversation,
  isBuilt,
  ownsBranch,
  processStage,
  readGate,
  routeAfterTriage,
  runsUnattended,
  stageAfter,
  waitFor,
  type PipelineStage,
} from "./pipeline.js";

const reply: TicketComment = {
  author: "fvermaut",
  body: "whatever",
  createdAt: "2026-08-03T11:00:00Z",
  fromTimone: false,
};

const approval: GateDecision = { kind: "approve", comment: reply };

function changeRequest(feedback: string): GateDecision {
  return { kind: "change-request", feedback, comment: { ...reply, body: feedback } };
}

describe("classificationFromLabels", () => {
  it.each(CLASSIFICATIONS)("reads triage:%s off the labels", (kind) => {
    expect(classificationFromLabels(["timone", `triage:${kind}`])).toBe(kind);
  });

  it("yields nothing when the ticket has not been classified", () => {
    expect(classificationFromLabels(["timone", "bug"])).toBeUndefined();
  });

  it("yields nothing for a triage label naming a kind the process does not have", () => {
    // Better to look unclassified — and be re-triaged — than to route on a
    // word nobody defined.
    expect(classificationFromLabels(["triage:urgent"])).toBeUndefined();
  });
});

describe("routeAfterTriage", () => {
  it("sends a feature to the clarification conversation", () => {
    expect(routeAfterTriage("feature")).toEqual({
      kind: "advance",
      stage: "clarification",
    });
  });

  it("sends a chore straight to planning", () => {
    // process.md stage 1: chore / technical enabler → stage 5, unanchored.
    expect(routeAfterTriage("chore")).toEqual({
      kind: "advance",
      stage: "planning",
    });
  });

  it("sends a bug to the feedback stage", () => {
    expect(routeAfterTriage("bug")).toEqual({
      kind: "advance",
      stage: "feedback",
    });
  });

  it("terminates a question, which is answered rather than built", () => {
    const transition = routeAfterTriage("question");

    expect(transition.kind).toBe("finish");
    expect(transition).toMatchObject({ reason: expect.any(String) });
  });

  it("routes every classification the process defines", () => {
    for (const kind of CLASSIFICATIONS) {
      expect(routeAfterTriage(kind).kind).not.toBe("wait");
    }
  });
});

describe("the stage graph", () => {
  it("runs clarification → requirements → planning → execution", () => {
    expect(stageAfter("clarification")).toBe("requirements");
    expect(stageAfter("requirements")).toBe("planning");
    expect(stageAfter("planning")).toBe("execution");
  });

  it("waits on a conversation at clarification and on a gate at both write stages", () => {
    expect(waitFor("clarification")).toBe("conversation");
    expect(waitFor("requirements")).toBe("gate");
    expect(waitFor("planning")).toBe("gate");
  });

  it("owns no branch before the requirements stage, and one from there on", () => {
    expect(ownsBranch("triage")).toBe(false);
    expect(ownsBranch("clarification")).toBe(false);
    expect(ownsBranch("requirements")).toBe(true);
    expect(ownsBranch("planning")).toBe(true);
    expect(ownsBranch("execution")).toBe(true);
  });

  it("knows which stages can actually be run right now", () => {
    // A stage the graph calls built but nothing can run is a lie the daemon
    // acts on: it would start a session with no prompt. Each flips as the
    // slice that builds it lands — requirements in 12e, planning in 12f,
    // the back half across phase 13.
    expect(isBuilt("triage")).toBe(true);
    expect(isBuilt("clarification")).toBe(true);
    expect(isBuilt("requirements")).toBe(true);
    expect(isBuilt("planning")).toBe(true);
    // The back half exists in the graph from 13b but flips built only as the
    // slice supplying each stage's prompt lands: execution in 13c,
    // verification in 13d, delivery in 13e.
    expect(isBuilt("execution")).toBe(true);
    expect(isBuilt("verification")).toBe(false);
    expect(isBuilt("delivery")).toBe(false);
    // Acting on a bug-classified ticket is stage 9's daemon path — not built.
    expect(isBuilt("feedback")).toBe(false);
  });

  it("runs execution → verification → delivery, and nothing follows delivery", () => {
    expect(stageAfter("execution")).toBe("verification");
    expect(stageAfter("verification")).toBe("delivery");
    // Nothing follows delivery in the graph: the run ends at the PR, whose
    // merge or close is a terminal event, not a stage.
    expect(stageAfter("delivery")).toBeUndefined();
  });

  it("maps the back half onto process.md stages 6, 7 and 8", () => {
    expect(processStage("execution")).toBe(6);
    expect(processStage("verification")).toBe(7);
    expect(processStage("delivery")).toBe(8);
  });

  it("waits on nothing through the build and check, then on a review", () => {
    expect(waitFor("execution")).toBe("none");
    expect(waitFor("verification")).toBe("none");
    expect(waitFor("delivery")).toBe("review");
  });

  it("holds the branch through the whole back half", () => {
    expect(ownsBranch("verification")).toBe(true);
    expect(ownsBranch("delivery")).toBe(true);
  });

  it("runs the whole back half unattended", () => {
    expect(runsUnattended("execution")).toBe(true);
    expect(runsUnattended("verification")).toBe(true);
    expect(runsUnattended("delivery")).toBe(true);
  });

  it("leaves the conversation stage to a human-opened session", () => {
    // A conversation needs someone at the keyboard; the daemon's sessions
    // run with nobody there.
    expect(runsUnattended("clarification")).toBe(false);
    expect(runsUnattended("triage")).toBe(true);
    expect(runsUnattended("requirements")).toBe(true);
    expect(runsUnattended("planning")).toBe(true);
  });

  it("describes every stage it can route to", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(typeof waitFor(stage)).toBe("string");
      expect(typeof ownsBranch(stage)).toBe("boolean");
    }
  });
});

describe("readGate", () => {
  it("advances a waiting run exactly one stage on approval", () => {
    expect(readGate("requirements", approval)).toEqual({
      kind: "advance",
      stage: "planning",
    });
    expect(readGate("planning", approval)).toEqual({
      kind: "advance",
      stage: "execution",
    });
  });

  it("re-enters the same stage on a change request, carrying the words", () => {
    const transition = readGate("requirements", changeRequest("it's not about phones"));

    expect(transition).toEqual({
      kind: "repeat",
      stage: "requirements",
      feedback: "it's not about phones",
    });
  });

  it("never advances on a change request, at either gated stage", () => {
    for (const stage of ["requirements", "planning"] as PipelineStage[]) {
      expect(readGate(stage, changeRequest("no")).kind).toBe("repeat");
    }
  });

  it("waits while the human has not answered", () => {
    expect(readGate("requirements", undefined)).toEqual({ kind: "wait" });
  });

  it("refuses to read a gate at a stage that has none", () => {
    // A gate reply at a stage that waits on a conversation means the caller
    // has lost track of what the run is doing — a loud failure, not a guess.
    expect(() => readGate("clarification", approval)).toThrow(/clarification/);
  });

  it("uses one mechanism for both gated stages", () => {
    // 12f's "no second copy of the approval logic", asserted by construction:
    // the two stages differ only in what follows them.
    const gated = PIPELINE_STAGES.filter((stage) => waitFor(stage) === "gate");

    expect(gated).toEqual(["requirements", "planning"]);
    for (const stage of gated) {
      expect(readGate(stage, approval)).toEqual({
        kind: "advance",
        stage: stageAfter(stage),
      });
    }
  });
});

describe("concludeConversation", () => {
  it("advances when the human accepted the outcome", () => {
    expect(concludeConversation("clarification", { accepted: true })).toEqual({
      kind: "advance",
      stage: "requirements",
    });
  });

  it("keeps waiting when the conversation ended without acceptance", () => {
    // Someone opened the interview and walked away. Nothing was decided, so
    // nothing moves — the ticket is still waiting on them.
    expect(concludeConversation("clarification", { accepted: false })).toEqual({
      kind: "wait",
    });
  });

  it("refuses at a stage that waits on a gate instead", () => {
    expect(() => concludeConversation("requirements", { accepted: true })).toThrow(
      /requirements/,
    );
  });
});
