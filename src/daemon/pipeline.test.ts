import { describe, expect, it } from "vitest";

import {
  APPROVAL_RECORD_MODEL,
  CLASSIFICATIONS,
  PIPELINE_STAGES,
  classificationFromLabels,
  effortFor,
  modelFor,
  ownsBranch,
  stageLabel,
  wayfinderStage,
  type PipelineStage,
} from "./pipeline.js";

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
    // enters is **not** `wayfinding`.
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

describe("the stage graph", () => {
  it("keeps the breakdown on chunk zero's branch", () => {
    // ADR-0028 D2: requirements and the breakdown share one branch. `breakdown`
    // owns a branch so the project stays held across the approval —
    // `claimBranch` returns early when the run already has one, so it
    // inherits rather than cuts.
    expect(ownsBranch("breakdown")).toBe(true);
  });

  it("owns no branch before the requirements stage, and one from there on", () => {
    expect(ownsBranch("triage")).toBe(false);
    expect(ownsBranch("clarification")).toBe(false);
    expect(ownsBranch("requirements")).toBe(true);
    expect(ownsBranch("planning")).toBe(true);
    expect(ownsBranch("execution")).toBe(true);
  });

  it("holds the branch through the whole back half", () => {
    expect(ownsBranch("verification")).toBe(true);
    expect(ownsBranch("delivery")).toBe(true);
  });
});

describe("the update of an open pull request (ADR-0066 D2)", () => {
  // The same pair as `remediation`: both change a live pull request's branch.
  it("owns the branch, runs on remediation's model and effort, and has a name a person reads", () => {
    expect(ownsBranch("update")).toBe(true);
    expect(modelFor("update")).toBe("claude-opus-5-5");
    expect(effortFor("update")).toBe("high");
    expect(stageLabel("update")).toBe("bringing the work up to date");
  });
});

describe("the model and effort each stage runs on", () => {
  it("declares the table settled at the grill, stage by stage", () => {
    // Written out rather than looped, because the point of the table is the
    // specific choice per stage — a loop would pass against any table at all.
    expect(modelFor("triage")).toBe("claude-opus-5-5");
    expect(effortFor("triage")).toBe("medium");

    expect(modelFor("requirements")).toBe("claude-opus-5-5");
    expect(effortFor("requirements")).toBe("high");

    // ✏ The breakdown's pair, added with the stage (ADR-0030 D1). The same as
    // planning's, and for a stronger version of planning's reason: this is the
    // cut of a whole initiative, approved once, and every pull request that
    // follows is shaped by it.
    expect(modelFor("breakdown")).toBe("claude-opus-5-5");
    expect(effortFor("breakdown")).toBe("high");

    expect(modelFor("planning")).toBe("claude-opus-5-5");
    expect(effortFor("planning")).toBe("high");

    expect(modelFor("execution")).toBe("claude-opus-5-5");
    expect(effortFor("execution")).toBe("high");

    expect(modelFor("verification")).toBe("claude-opus-5-5");
    expect(effortFor("verification")).toBe("high");

    expect(modelFor("delivery")).toBe("claude-opus-5-5");
    expect(effortFor("delivery")).toBe("medium");

    expect(modelFor("remediation")).toBe("claude-opus-5-5");
    expect(effortFor("remediation")).toBe("high");
  });

  it("keeps Opus on the three judgements nothing downstream repeats", () => {
    // ✏ Added at the 2026-08-30 step down, which fvermaut asked for because
    // the runs cost too many tokens. Most stages moved to Sonnet; these three
    // did not, and this test says which they are so that a later sweep for
    // savings has to argue with a named list rather than with a table.
    //
    // - `requirements` is the artifact every phase is planned and verified
    //   against, and nothing later rewrites it.
    // - `breakdown` is the one cut of a whole initiative the human approves.
    // - `verification` is now the only check standing over a build Sonnet
    //   wrote.
    expect(modelFor("requirements")).toBe("claude-opus-5-5");
    expect(modelFor("breakdown")).toBe("claude-opus-5-5");
    expect(modelFor("verification")).toBe("claude-opus-5-5");
  });

  it("sends no stage a reasoning effort above high", () => {
    // ✏ The other half of the 2026-08-30 step down. `execution` and
    // `verification` were the two `xhigh` rows and both came down one notch.
    for (const stage of PIPELINE_STAGES) {
      expect(effortFor(stage), `${stage} runs above high`).not.toBe("xhigh");
    }
  });

  it("runs a conversation the daemon ingests an answer into on the same pair as planning", () => {
    // ✏ The amendment's first settled question. A conversation stage is
    // spawned after all — not of the daemon's own accord, but to ingest a
    // written answer (ADR-0022) — and a stage the runtime starts without a
    // declared model silently takes whatever the runtime defaults to. The
    // session judges whether an answer settles a decision, re-asks or
    // resolves on that judgement, and may write an ADR: requirements' and
    // planning's class of work, so requirements' and planning's pair.
    //
    // ✏ Both moved to Sonnet with planning on 2026-08-30. The effort stays
    // `high`, because judging whether an answer settles a question is the
    // whole of what these sessions do.
    expect(modelFor("clarification")).toBe("claude-opus-5-5");
    expect(effortFor("clarification")).toBe("high");

    expect(modelFor("wayfinding")).toBe("claude-opus-5-5");
    expect(effortFor("wayfinding")).toBe("high");
  });

  it("keeps triage off the cheapest model, because it routes silently", () => {
    // A `triage:chore` label goes straight to planning while `triage:feature`
    // opens a human interview first — so a misclassification skips a gate
    // nobody notices was skipped. The genuinely mechanical session is the
    // approval record, and that is the one Haiku row.
    expect(modelFor("triage")).not.toBe(APPROVAL_RECORD_MODEL);
  });

  it("gives every stage a session is started for a declared model", () => {
    // ✏ 2026-09-30: was every stage the daemon started of its own accord.
    // The runner starts a session for every stage but the map's.
    for (const stage of PIPELINE_STAGES) {
      if (stage === "charting") continue;
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
    // ✏ Both examples this used to name — `research` and `feedback` — were
    // built by phase 27, so they now declare a model like every other spawned
    // stage. The property survives them: the one remaining way to start no
    // session is `charting`, asserted just below.
    // ✏ And the second way to be one, since ADR-0024: the map's stage is
    // built, and what happens at it is a ticket waiting rather than a session
    // running. The session that follows the go-ahead is stage 3's.
    expect(modelFor("charting")).toBeUndefined();
    expect(effortFor("charting")).toBeUndefined();
  });

  it("runs the approval record on Haiku, and sends it no effort at all", () => {
    // Haiku 4.5 does not support the parameter and rejects it, so there is no
    // effort to declare — not a default one, and not an undefined one.
    expect(APPROVAL_RECORD_MODEL).toBe("claude-haiku-4-5");
  });
});

describe("one name per step, in one place", () => {
  // ADR-0035 D3. The name a person reads for a step has to be total and
  // unambiguous. It was neither: it lived in `status.ts` and covered five
  // stages of thirteen.

  it("gives every stage a name written for a person", () => {
    // A loop rather than a list, so a stage added later cannot quietly ship
    // without one.
    for (const stage of PIPELINE_STAGES) {
      expect(stageLabel(stage)).not.toBe("");
      expect(stageLabel(stage).trim()).toBe(stageLabel(stage));
    }
  });

  it("gives no two stages the same name", () => {
    // Two stages sharing a name would read to a person as one step.
    const labels = PIPELINE_STAGES.map((stage) => stageLabel(stage));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("keeps the five names `timone status` already shipped", () => {
    // Not a rewrite of what a person has already learned to read.
    expect(stageLabel("execution")).toBe("building");
    expect(stageLabel("verification")).toBe("checking the result");
    expect(stageLabel("delivery")).toBe("delivering");
    expect(stageLabel("remediation")).toBe("acting on your review");
    expect(stageLabel("breakdown")).toBe("working out the pieces");
  });

  it("names no step in the words the process uses for itself", () => {
    // R9 and `process.md`'s writing rule: these reach a person, on a ticket
    // and in the terminal. "triage" and "remediation" are not words this
    // reader has.
    for (const stage of PIPELINE_STAGES) {
      expect(stageLabel(stage)).not.toContain(stage);
    }
  });
});

describe("what the runner reads from the step table (41h)", () => {
  // The four values the runner reads for every step, written out by hand.
  // ✏ 2026-09-30 (41h): copied from the table on `main` before the columns
  // only the old code read were deleted, so that none of these moved when
  // the rest went.
  const table: Record<
    PipelineStage,
    { label: string; model?: string; effort?: string; ownsBranch: boolean }
  > = {
    triage: { label: "sorting the request", model: "claude-opus-5-5", effort: "medium", ownsBranch: false },
    clarification: { label: "asking what you need", model: "claude-opus-5-5", effort: "high", ownsBranch: false },
    wayfinding: { label: "talking a question through", model: "claude-opus-5-5", effort: "high", ownsBranch: false },
    charting: { label: "keeping the list of questions", ownsBranch: false },
    research: { label: "looking something up", model: "claude-opus-5-5", effort: "high", ownsBranch: false },
    requirements: { label: "writing down what it needs", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
    breakdown: { label: "working out the pieces", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
    planning: { label: "preparing the work", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
    execution: { label: "building", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
    verification: { label: "checking the result", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
    delivery: { label: "delivering", model: "claude-opus-5-5", effort: "medium", ownsBranch: true },
    remediation: { label: "acting on your review", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
    // ✏ 2026-10-05 (50b): the update, added after the table was copied (ADR-0066 D2).
    update: { label: "bringing the work up to date", model: "claude-opus-5-5", effort: "high", ownsBranch: true },
  };

  it("lists every step, in order", () => {
    expect([...PIPELINE_STAGES]).toEqual(Object.keys(table));
  });

  it.each(PIPELINE_STAGES)("gives %s its label, model, effort and branch", (stage) => {
    expect({
      label: stageLabel(stage),
      model: modelFor(stage),
      effort: effortFor(stage),
      ownsBranch: ownsBranch(stage),
    }).toEqual(table[stage]);
  });
});
