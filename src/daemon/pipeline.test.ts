import { assert, describe, expect, it } from "vitest";

import type { TicketComment } from "../adapters/ticketing.js";
import type { GateDecision } from "./gates.js";
import {
  APPROVAL_RECORD_MODEL,
  CLASSIFICATIONS,
  PIPELINE_STAGES,
  classificationFromLabels,
  concludeConversation,
  effortFor,
  isBuilt,
  modelFor,
  ownsBranch,
  processStage,
  readGate,
  routeAfterTriage,
  runsUnattended,
  stageAfter,
  waitFor,
  wayfinderStage,
  type PipelineStage,
  type PipelineTransition,
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

describe("wayfinderStage", () => {
  it.each(["grilling", "prototype", "task"])(
    "sends a %s decision ticket to the wayfinding conversation",
    (type) => {
      // ADR-0010's table: these three resolve only through exchange with a
      // human, which is a conversation whatever medium it runs on.
      expect(wayfinderStage(["timone", `wayfinder:${type}`])).toBe("wayfinding");
    },
  );

  it("sends a research ticket to the stage nobody waits on", () => {
    // The one type whose own CTA asks the human for nothing.
    expect(wayfinderStage(["timone", "wayfinder:research"])).toBe("research");
  });

  it("sends the map to a stage of its own, beside the decision tickets", () => {
    // ✏ ADR-0024 amends ADR-0010 here, and only here. The map used to be
    // unroutable on purpose — an index nobody answers — and the effect was
    // that fvermaut's "ok go ahead and write the spec" on `ivtrends` #1 had
    // nowhere to land. It is now a ticket of its own kind, and the stage it
    // enters is **not** `wayfinding`: see the graph, where wayfinding still
    // has nothing following it.
    expect(wayfinderStage(["timone", "wayfinder:map"])).toBe("charting");
  });

  it("yields nothing for a wayfinder type nobody defined", () => {
    // The same conservatism as an unrecognised `triage:` kind: routing on a
    // word the process does not have is worse than not routing at all.
    expect(wayfinderStage(["timone", "wayfinder:vibes"])).toBeUndefined();
  });

  it("yields nothing for an ordinary ticket, which still goes through triage", () => {
    expect(wayfinderStage(["timone", "triage:feature"])).toBeUndefined();
  });
});

describe("routeAfterTriage", () => {
  it("sends a feature to the clarification conversation", () => {
    expect(routeAfterTriage("feature")).toEqual({
      kind: "advance",
      stage: "clarification",
    });
  });

  it("sends a chore straight to planning, and planning stops for nobody", () => {
    // process.md stage 1: chore / technical enabler → stage 5, unanchored.
    const chore = routeAfterTriage("chore");

    expect(chore).toEqual({ kind: "advance", stage: "planning" });

    // ✏ ADR-0030 D3. The route is untouched and the ruling is about where it
    // lands: a chore skips requirements and the breakdown, and since D1 the
    // stage it does reach no longer gates — so it meets no human between
    // triage and its pull request, on purpose. Asserted as the property *and*
    // as the value above, because either alone can be satisfied by the wrong
    // change: the value by gating `planning` again and calling it a fix, the
    // property by quietly re-pointing the chore at some other ungated stage.
    assert(chore.kind === "advance");
    expect(waitFor(chore.stage)).toBe("none");
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
  it("runs clarification → requirements → breakdown → planning → execution", () => {
    // ✏ ADR-0030 D1 put `breakdown` between the specification and the plan.
    // The breakdown is the list of pieces the initiative is built in, approved
    // once; `planning` then runs once per piece and writes that piece's phase
    // file with no gate of its own.
    expect(stageAfter("clarification")).toBe("requirements");
    expect(stageAfter("requirements")).toBe("breakdown");
    expect(stageAfter("breakdown")).toBe("planning");
    expect(stageAfter("planning")).toBe("execution");
  });

  it("waits on a conversation at clarification, and gates the two written proposals", () => {
    // ✏ The gate moved with the artifact (ADR-0030 D1). `planning` is
    // deliberately wait-free now: what the human approved is the breakdown,
    // and a per-chunk phase file re-opening a gate they already answered is
    // the shape the split exists to prevent.
    expect(waitFor("clarification")).toBe("conversation");
    expect(waitFor("requirements")).toBe("gate");
    expect(waitFor("breakdown")).toBe("gate");
    expect(waitFor("planning")).toBe("none");
  });

  it("keeps the breakdown on chunk zero's branch, at process stage 5", () => {
    // ADR-0028 D2: requirements and the breakdown share one branch. `breakdown`
    // owns a branch so the project stays held across the gate — `claimBranch`
    // returns early when the run already has one, so it inherits rather than
    // cuts. `processStage: 5` because it is written by the planning stage in
    // `process.md`'s sense (ADR-0030 D1's answered objection).
    expect(processStage("breakdown")).toBe(5);
    expect(processStage("planning")).toBe(5);
    expect(ownsBranch("breakdown")).toBe(true);
    expect(isBuilt("breakdown")).toBe(true);
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
    expect(isBuilt("verification")).toBe(true);
    expect(isBuilt("delivery")).toBe(true);
    // Acting on a bug-classified ticket is stage 9's daemon path — not built.
    expect(isBuilt("feedback")).toBe(false);
  });

  it("sends a remediation through the full check again — never straight back to the PR", () => {
    // ADR-0016's invariant: nothing lands on the pull request unverified.
    expect(stageAfter("remediation")).toBe("verification");
    expect(ownsBranch("remediation")).toBe(true);
    expect(isBuilt("remediation")).toBe(true);
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

  it("resolves a wayfinder decision ticket at process stage 2, on a conversation", () => {
    // Stage 2 at scale (ADR-0010) — the same requirements discovery as the
    // interview, so the same process stage and the same kind of wait. It
    // holds no branch: a decision ticket produces a decision, not a commit.
    expect(processStage("wayfinding")).toBe(2);
    expect(waitFor("wayfinding")).toBe("conversation");
    expect(ownsBranch("wayfinding")).toBe(false);
    expect(isBuilt("wayfinding")).toBe(true);
  });

  it("leaves a research ticket unattended, and says plainly it is not built yet", () => {
    // Nobody waits on a research ticket — its CTA promises the machine will
    // resolve it. What is missing is the daemon's ability to judge such a
    // session's outcome, so the stage exists and is honestly unbuilt: a
    // marked research ticket parks and says so rather than being triaged.
    expect(processStage("research")).toBe(2);
    expect(waitFor("research")).toBe("none");
    expect(runsUnattended("research")).toBe(true);
    expect(ownsBranch("research")).toBe(false);
    expect(isBuilt("research")).toBe(false);
  });

  it("carries the map itself at process stage 2, and hands it to stage 3", () => {
    // ADR-0024's fourth ruling. The map is the effort's own ticket: it holds
    // no branch and runs no session of its own, and what follows it is the
    // specification the whole map was finding its way to — which is why the
    // `next` is here and not on `wayfinding`.
    expect(processStage("charting")).toBe(2);
    expect(waitFor("charting")).toBe("conversation");
    expect(ownsBranch("charting")).toBe(false);
    expect(isBuilt("charting")).toBe(true);
    expect(stageAfter("charting")).toBe("requirements");
  });

  it("still has nothing following a decision ticket, now that the map has", () => {
    // **The property most easily broken by adding the stage beside it.** A
    // decision ticket's answer resolves that ticket and ends its run; a PRD
    // written off one answer is the fault this clause exists to prevent
    // (ADR-0010, and ADR-0024's own words: "decision tickets are unchanged
    // and `wayfinding` still has nothing following it"). Asserted directly,
    // beside the map's `next`, so the two can never be confused for one.
    expect(stageAfter("wayfinding")).toBeUndefined();
    expect(stageAfter("charting")).toBe("requirements");
  });

  it("ends a decision ticket's run where the ticket ends, rather than in a PRD", () => {
    // The trap the clarification row sets: `stageAfter("clarification")` is
    // requirements, so a decision ticket parked at a stage copied from it
    // would advance into writing requirements off a single answer. The
    // destination artifact is the whole map's to hand over, once it closes.
    expect(stageAfter("wayfinding")).toBeUndefined();
    expect(stageAfter("research")).toBeUndefined();
  });

  it("leaves the conversation stage to a human-opened session", () => {
    // A conversation needs someone at the keyboard; the daemon's sessions
    // run with nobody there.
    expect(runsUnattended("clarification")).toBe(false);
    expect(runsUnattended("triage")).toBe(true);
    expect(runsUnattended("requirements")).toBe(true);
    // ✏ Both halves of the split run unattended. `runsUnattended` is derived
    // from the wait being a conversation, so `planning` losing its gate does
    // not change this answer — asserted for both so the split is on record as
    // having left it alone.
    expect(runsUnattended("breakdown")).toBe(true);
    expect(runsUnattended("planning")).toBe(true);
  });

  it("describes every stage it can route to", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(typeof waitFor(stage)).toBe("string");
      expect(typeof ownsBranch(stage)).toBe("boolean");
    }
  });
});

describe("the model and effort each stage runs on", () => {
  it("declares the table settled at the grill, stage by stage", () => {
    // Written out rather than looped, because the point of the table is the
    // specific choice per stage — a loop would pass against any table at all.
    expect(modelFor("triage")).toBe("claude-sonnet-5");
    expect(effortFor("triage")).toBe("medium");

    expect(modelFor("requirements")).toBe("claude-opus-5");
    expect(effortFor("requirements")).toBe("high");

    // ✏ The breakdown's pair, added with the stage (ADR-0030 D1). The same as
    // planning's, and for a stronger version of planning's reason: this is the
    // cut of a whole initiative, approved once, and every pull request that
    // follows is shaped by it.
    expect(modelFor("breakdown")).toBe("claude-opus-5");
    expect(effortFor("breakdown")).toBe("high");

    expect(modelFor("planning")).toBe("claude-opus-5");
    expect(effortFor("planning")).toBe("high");

    expect(modelFor("execution")).toBe("claude-opus-5");
    expect(effortFor("execution")).toBe("xhigh");

    expect(modelFor("verification")).toBe("claude-opus-5");
    expect(effortFor("verification")).toBe("xhigh");

    expect(modelFor("delivery")).toBe("claude-opus-5");
    expect(effortFor("delivery")).toBe("high");

    expect(modelFor("remediation")).toBe("claude-opus-5");
    expect(effortFor("remediation")).toBe("high");
  });

  it("runs a conversation the daemon ingests an answer into on the same pair as planning", () => {
    // ✏ The amendment's first settled question. A conversation stage is
    // spawned after all — not of the daemon's own accord, but to ingest a
    // written answer (ADR-0022) — and a stage the runtime starts without a
    // declared model silently takes whatever the runtime defaults to. The
    // session judges whether an answer settles a decision, re-asks or
    // resolves on that judgement, and may write an ADR: requirements' and
    // planning's class of work, so requirements' and planning's pair.
    expect(modelFor("clarification")).toBe("claude-opus-5");
    expect(effortFor("clarification")).toBe("high");

    expect(modelFor("wayfinding")).toBe("claude-opus-5");
    expect(effortFor("wayfinding")).toBe("high");
  });

  it("keeps triage off the cheapest model, because it routes silently", () => {
    // A `triage:chore` label goes straight to planning while `triage:feature`
    // opens a human interview first — so a misclassification skips a gate
    // nobody notices was skipped. The genuinely mechanical session is the
    // approval record, and that is the one Haiku row.
    expect(modelFor("triage")).not.toBe(APPROVAL_RECORD_MODEL);
  });

  it("gives every stage the daemon spawns a session for a declared model", () => {
    for (const stage of PIPELINE_STAGES) {
      if (!isBuilt(stage) || !runsUnattended(stage)) continue;
      expect(modelFor(stage), `${stage} declares no model`).toEqual(
        expect.any(String),
      );
    }
  });

  it("declares nothing for a stage no session is ever started for", () => {
    // A stage whose machinery does not exist calls `runtime.start` by no
    // path at all, so a model on it would be config nothing reads — the kind
    // that later looks like a bug.
    //
    // ✏ This guard used to point at `clarification`, on the reasoning that
    // `spawn()` short-circuited to `openConversation` before ever reaching
    // `runStage`. ADR-0022 made that false: a written answer is ingested by a
    // session the daemon starts at that very stage. Re-pointed rather than
    // deleted — the property is real, and the unbuilt stages are where it
    // still holds.
    expect(modelFor("research")).toBeUndefined();
    expect(effortFor("research")).toBeUndefined();
    expect(modelFor("feedback")).toBeUndefined();
    expect(effortFor("feedback")).toBeUndefined();
    // ✏ And the second way to be one, since ADR-0024: the map's stage is
    // built, and what happens at it is a ticket waiting rather than a session
    // running. The session that follows the go-ahead is stage 3's.
    expect(isBuilt("charting")).toBe(true);
    expect(modelFor("charting")).toBeUndefined();
    expect(effortFor("charting")).toBeUndefined();
  });

  it("runs the approval record on Haiku, and sends it no effort at all", () => {
    // Haiku 4.5 does not support the parameter and rejects it, so there is no
    // effort to declare — not a default one, and not an undefined one.
    expect(APPROVAL_RECORD_MODEL).toBe("claude-haiku-4-5");
  });
});

describe("readGate", () => {
  it("advances a waiting run exactly one stage on approval", () => {
    expect(readGate("requirements", approval)).toEqual({
      kind: "advance",
      stage: "breakdown",
    });
    // ✏ Was `planning → execution`. `planning` is no longer a gate at all
    // (ADR-0030 D1), so asking it to read one now throws — the second gate is
    // the breakdown, and what it advances to is the per-chunk planning stage.
    expect(readGate("breakdown", approval)).toEqual({
      kind: "advance",
      stage: "planning",
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
    // ✏ Derived rather than written out, so the pair it loops over is the pair
    // that actually gates. Written out, this test would have gone on asserting
    // a property of `planning` after `planning` stopped having it.
    for (const stage of PIPELINE_STAGES.filter((s) => waitFor(s) === "gate")) {
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

    // ✏ Was `["requirements", "planning"]`. ADR-0030 D1 moved the second gate
    // off the phase file and onto the breakdown — the list of pieces, approved
    // once for the whole initiative. The set is still exactly two, and this
    // literal is the alarm that says so: a third gate appearing here is a
    // decision, not a detail.
    expect(gated).toEqual(["requirements", "breakdown"]);
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

describe("the escalation wait", () => {
  // ADR-0033. A stage that is handed an answer it may not act on stops and
  // says so. What the run then waits on is a person, not a comment — so the
  // kind exists here beside the other three, and the refusal to resume on
  // written words lives with it.

  it("is a kind of park, and no stage declares it as its own wait", () => {
    // A stage's declared wait is what its *own* session opens when it ends
    // well. An escalation is the opposite of that: it is written onto a run
    // whichever stage was running. A stage declaring it would mean every run
    // reaching that stage escalates.
    for (const stage of PIPELINE_STAGES) {
      expect(waitFor(stage)).not.toBe("escalation");
    }
  });

  it("is not an answer any stage can be handed", () => {
    // The same refusal `readGate` and `concludeConversation` already make for
    // each other's answers, asserted for the new kind so nothing routes one
    // into a stage as though a human had replied.
    expect(() => readGate("requirements", approval)).not.toThrow();
    expect(() => concludeConversation("requirements", { accepted: true })).toThrow(
      /requirements/,
    );
  });

  it("carries why the stage stopped, and what it could not get to", () => {
    const transition: PipelineTransition = {
      kind: "escalate",
      reason: "the answer asks me to reword the promises I check against",
      owed: "delivery",
    };

    expect(transition.reason).toContain("reword");
    expect(transition.owed).toBe("delivery");
  });

  it("can name no stage at all, for a stop with nothing owed after it", () => {
    const transition: PipelineTransition = { kind: "escalate", reason: "stuck" };
    expect(transition.owed).toBeUndefined();
  });
});
