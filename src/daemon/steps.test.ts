import { describe, expect, it } from "vitest";

import { type Dependency, type Step } from "../adapters/ticketing.js";
import {
  HELD_LABEL,
  HELD_LABEL_DESCRIPTION,
  MAP_LABEL_DESCRIPTION,
  nextStep,
} from "./steps.js";

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
  dependenciesIncomplete: false,
  ...overrides,
});

/** A dependency on another step, carrying its own state rather than a number. */
const on = (number: number, open: boolean): Dependency => ({
  number,
  url: `https://github.com/fvermaut/scratch-app/issues/${number}`,
  open,
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
    const steps = [step(11, { blockedBy: [on(12, true)] }), step(12)];

    expect(nextStep(steps)?.number).toBe(12);
  });

  it("takes a step whose dependency is closed", () => {
    const steps = [
      step(11, { blockedBy: [on(12, false)] }),
      step(12, { state: "closed" }),
    ];

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
    const steps = [
      step(11, { blockedBy: [on(12, true)] }),
      step(12, { blockedBy: [on(11, true)] }),
    ];

    expect(nextStep(steps)).toBeUndefined();
  });

  /**
   * Not one of the plan's seven: found while verifying `gh`'s real output for
   * 29b. A dependency list the tracker counted but did not hand over in full
   * leaves the step waiting on something nobody can name, and the safe answer
   * is the one that holds it back.
   */
  it("skips a step whose dependency list came back incomplete", () => {
    const steps = [step(11, { dependenciesIncomplete: true }), step(12)];

    expect(nextStep(steps)?.number).toBe(12);
  });
});

/**
 * 29j — the four sentences that tell a human how to hand a dropped step back
 * all name the label, and all name it from **one** constant.
 *
 * 29a promises the label is "trivially renamed by one constant if he dislikes
 * it". Four hand-typed copies of the string in four user-facing sentences is
 * what quietly breaks that promise: the constant changes, the code compiles,
 * and every surface goes on telling the human to remove a label that no
 * longer exists.
 */
describe("the hold label is named from one place", () => {
  it("is spelled out for the reader rather than described", () => {
    expect(HELD_LABEL).toBe("timone:held");
  });

  it("says what removing it does, for whoever reads it on the tracker", () => {
    expect(HELD_LABEL_DESCRIPTION.toLowerCase()).toContain("remove");
  });
});

/**
 * ✏ Found by phase 29's live gate. GitHub refuses a label description over
 * 100 characters with `HTTP 422: Validation Failed`, naming no field. At 111
 * characters the hold label could not be created, `openStepTickets` gave up,
 * and no step ticket was opened — while the run carried on regardless.
 *
 * A unit test is worth more than a comment here because the limit is
 * invisible: nothing in the type system, the linter or the local build knows
 * about it, and the only other place it shows up is a 422 in a daemon log.
 */
describe("a label description GitHub will accept", () => {
  it.each([
    ["the hold", HELD_LABEL_DESCRIPTION],
    ["the map", MAP_LABEL_DESCRIPTION],
  ])("keeps %s under GitHub's 100-character limit", (_which, description) => {
    expect(description.length).toBeLessThanOrEqual(100);
  });
});
