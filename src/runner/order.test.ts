import { describe, expect, it } from "vitest";

import { ticketKindOf } from "./order.js";

/** A ticket that is neither a step of an initiative nor a fix to a reviewed pull request. */
const PLAIN = { isStep: false, isRemediation: false };

describe("the kind of a ticket, read off its labels", () => {
  it("reads triage:chore as a chore", () => {
    expect(ticketKindOf(["timone", "triage:chore"], PLAIN)).toBe("chore");
  });

  it("reads wayfinder:map as a map", () => {
    expect(ticketKindOf(["timone", "wayfinder:map"], PLAIN)).toBe("map");
  });

  it("reads wayfinder:research as research", () => {
    expect(ticketKindOf(["timone", "wayfinder:research"], PLAIN)).toBe("research");
  });

  it("reads the other wayfinder types as a decision ticket", () => {
    expect(ticketKindOf(["timone", "wayfinder:grilling"], PLAIN)).toBe("decision");
    expect(ticketKindOf(["timone", "wayfinder:prototype"], PLAIN)).toBe("decision");
    expect(ticketKindOf(["timone", "wayfinder:task"], PLAIN)).toBe("decision");
  });

  it("reads a step ticket as a step, whatever its labels say", () => {
    const step = { isStep: true, isRemediation: false };

    expect(ticketKindOf(["timone"], step)).toBe("step");
    expect(ticketKindOf(["timone", "triage:feature"], step)).toBe("step");
    expect(ticketKindOf(["timone", "wayfinder:map"], step)).toBe("step");
  });

  it("reads a fix to a reviewed pull request as a remediation, even on a step ticket", () => {
    expect(
      ticketKindOf(["timone", "triage:bug"], { isStep: false, isRemediation: true }),
    ).toBe("remediation");
    expect(ticketKindOf(["timone"], { isStep: true, isRemediation: true })).toBe(
      "remediation",
    );
  });
});
