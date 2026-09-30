import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";

import { sdkConsult } from "./consult.js";

describe("sdkConsult — one question to a model, one answer", () => {
  it("starts the model with no tools at all and no project settings (40u)", async () => {
    // Verification of phase 40, found outside the verdicts, item 4: the check
    // that reads a reply at the limit was started with every built-in tool,
    // in the daemon's folder, and handed a named person's words. It must be
    // able to do nothing but answer.
    const asked: Options[] = [];
    const consult = sdkConsult({
      query: ({ options }) => {
        asked.push(options);
        return (async function* (): AsyncGenerator<SDKMessage> {})();
      },
    });

    await consult("A person replied: yes, go on. Does this mean go on? Answer YES or NO.");

    expect(asked).toHaveLength(1);
    expect(asked[0]?.tools).toEqual([]);
    expect(asked[0]?.settingSources).toEqual([]);
  });
});
