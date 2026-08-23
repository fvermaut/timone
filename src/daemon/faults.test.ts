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
    expect(technicalFault("invalid_api_key")).toBe("credentials");
  });

  it("tells a token that ran out from a login that was refused", () => {
    // The distinction the daemon acts on: one of these is retried and the
    // other is handed to a human (#55). Both carry the same short code, so
    // the sentence beside it is the only thing that separates them — which is
    // why the runtime's full wording is kept and not just the code.
    expect(technicalFault("OAuth token has expired")).toBe("expired");
    expect(
      technicalFault(
        "the session stopped on an API error (authentication_failed: Failed to " +
          "authenticate. API Error: 401 OAuth access token has expired. " +
          "Re-authenticate to continue.)",
      ),
    ).toBe("expired");
  });

  it("still calls a bare authentication code a refusal, since nothing says otherwise", () => {
    // The safe direction of this particular pair. A code with no sentence
    // beside it is not evidence of an expiry, so it is reported rather than
    // retried.
    expect(technicalFault("authentication_failed")).toBe("credentials");
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
