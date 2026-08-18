import { describe, expect, it } from "vitest";

import { technicalFault } from "./faults.js";

describe("telling a stop about the machinery from a stop about the work", () => {
  it("reads a broken link off the words the runtime used", () => {
    expect(technicalFault("the session stopped on an API error (server_error)")).toBe(
      "link",
    );
    expect(
      technicalFault("the session stopped on an API error (overloaded_error)"),
    ).toBe("link");
    expect(technicalFault("fetch failed")).toBe("link");
    expect(technicalFault("read ECONNRESET")).toBe("link");
    expect(technicalFault("API Error: Connection closed mid-response")).toBe("link");
  });

  it("reads a refused login, and does not call it a broken link", () => {
    expect(
      technicalFault("the session stopped on an API error (authentication_failed)"),
    ).toBe("credentials");
    expect(technicalFault("OAuth token has expired")).toBe("credentials");
  });

  it("calls everything it does not recognise a failure about the work", () => {
    // The safe direction, and the one that matters: a stop nobody has taught
    // this function about is put in front of a human rather than retried in
    // silence.
    expect(technicalFault("error_max_turns")).toBeUndefined();
    expect(
      technicalFault("the planning stage said it finished, but nothing was committed"),
    ).toBeUndefined();
    expect(technicalFault("the machine running it stopped before the work was finished"))
      .toBeUndefined();
    expect(technicalFault(undefined)).toBeUndefined();
  });
});
