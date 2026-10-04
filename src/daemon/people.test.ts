import { describe, expect, it } from "vitest";

import { withPeopleNamed } from "./people.js";

describe("withPeopleNamed, the line that names a project's people on a ticket", () => {
  it("names each named person with @, after a blank line under the body", () => {
    expect(withPeopleNamed("Body.", ["alice", "bob"])).toBe(
      "Body.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @alice @bob",
    );
  });

  it("leaves the body as it is, with no @ in it, when nobody is named (R5)", () => {
    for (const people of [[], ["", "  "], ["@"]]) {
      const named = withPeopleNamed("Body.", people);

      expect(named).toBe("Body.");
      expect(named).not.toContain("@");
    }
  });

  it("names each person once and with one @, however their login was written", () => {
    expect(withPeopleNamed("Body.", ["@alice", " bob "])).toBe(
      "Body.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @alice @bob",
    );
    expect(withPeopleNamed("Body.", ["alice", "alice"])).toBe(
      "Body.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @alice",
    );
  });

  it("puts exactly one blank line under a body that ends with newlines", () => {
    expect(withPeopleNamed("Body.\n\n", ["alice"])).toBe(
      "Body.\n\nNamed so that GitHub tells them about this ticket and every comment on it: @alice",
    );
  });

  it("writes no backtick in the line it adds, so GitHub reads the names as plain text", () => {
    const named = withPeopleNamed("Body.", ["alice", "bob"]);

    expect(named.slice("Body.".length)).not.toContain("`");
  });
});
