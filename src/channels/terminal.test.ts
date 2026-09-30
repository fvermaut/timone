import { describe, expect, it } from "vitest";

import { takeoverCommand } from "./terminal.js";

describe("takeoverCommand", () => {
  it("names the project and the ticket, and nothing else", () => {
    expect(takeoverCommand("scratch-app", 6)).toBe("timone takeover scratch-app#6");
  });
});
