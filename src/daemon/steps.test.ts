import { describe, expect, it } from "vitest";

import { HELD_LABEL, nextStep, type Step } from "./steps.js";

/**
 * A step ticket as the frontier sees it, with the free shape as its default:
 * open, unblocked, unheld and unclaimed. Every case below says only what it
 * changes, so a reader can see the one condition each one is about.
 */
const step = (number: number, overrides: Partial<Step> = {}): Step => ({
  number,
  title: `Step ${number}`,
  state: "open",
  labels: ["timone"],
  assignees: [],
  blockedBy: [],
  ...overrides,
});

describe("nextStep", () => {
  it("takes the first when every step is open and none is blocked", () => {
    const steps = [step(11), step(12), step(13)];

    expect(nextStep(steps)?.number).toBe(11);
  });

  it("takes the second when the first is closed", () => {
    const steps = [step(11, { state: "closed" }), step(12), step(13)];

    expect(nextStep(steps)?.number).toBe(12);
  });

  it("skips a step whose dependency is still open, even when it sorts first", () => {
    const steps = [step(11, { blockedBy: [12] }), step(12)];

    expect(nextStep(steps)?.number).toBe(12);
  });

  it("takes a step whose dependency is closed", () => {
    const steps = [step(11, { blockedBy: [12] }), step(12, { state: "closed" })];

    expect(nextStep(steps)?.number).toBe(11);
  });

  /**
   * (5a) The machine's own hold. This is not a nicety: after a
   * `timone cancel` the label is the *only* thing keeping the dropped step
   * out of the frontier, so a daemon that ignores it rebuilds work the
   * human deliberately stopped — with every call succeeding and nothing
   * reporting a fault. See ADR-0044 D3.
   */
  it("skips an open step the machine is holding", () => {
    const steps = [step(11, { labels: ["timone", HELD_LABEL] }), step(12)];

    expect(nextStep(steps)?.number).toBe(12);
  });

  /**
   * (5b) A human's takeover, on its own field. Only people can be issue
   * assignees, so this half of the claim can never be carried by the label
   * above — reading one field and not the other builds half a rule that
   * looks whole.
   */
  it("skips an open step a person has taken", () => {
    const steps = [step(11, { assignees: ["fvermaut"] }), step(12)];

    expect(nextStep(steps)?.number).toBe(12);
  });

  it("returns undefined when every step is closed", () => {
    const steps = [step(11, { state: "closed" }), step(12, { state: "closed" })];

    expect(nextStep(steps)).toBeUndefined();
  });

  it("returns undefined on a dependency cycle rather than looping", () => {
    const steps = [step(11, { blockedBy: [12] }), step(12, { blockedBy: [11] })];

    expect(nextStep(steps)).toBeUndefined();
  });
});
