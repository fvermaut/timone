import { describe, expect, it } from "vitest";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import {
  SessionProgress,
  closingLine,
  tickLine,
  type SessionSummary,
} from "./progress.js";

/**
 * Message factories for a fabricated stream.
 *
 * Each casts once, deliberately: the real messages carry a whole `BetaMessage`
 * and a dozen fields the accumulator never reads, and conjuring those would
 * test the fixture rather than the accumulator. The production path is typed
 * against the real union, so a shape change is caught where it matters.
 */
function assistantTurn(
  outputTokens: number,
  options: { parent?: string | null; inputTokens?: number } = {},
): SDKMessage[] {
  const parent = options.parent ?? null;
  const stream = (event: unknown): SDKMessage =>
    ({
      type: "stream_event",
      event,
      parent_tool_use_id: parent,
      uuid: "stream-uuid",
      session_id: "session-abc",
    }) as unknown as SDKMessage;

  return [
    stream({ type: "message_start" }),
    // A `message_delta` carries the *cumulative* output of the message being
    // written, so a message that ends at N tokens reports N — twice, on its
    // way there, and the later value replaces rather than adds to the earlier.
    stream({ type: "message_delta", usage: { output_tokens: Math.floor(outputTokens / 2) } }),
    stream({ type: "message_delta", usage: { output_tokens: outputTokens } }),
    {
      type: "assistant",
      parent_tool_use_id: parent,
      message: {
        usage: {
          input_tokens: options.inputTokens ?? 25_000,
          // Deliberately wrong-looking: this is what the SDK actually puts
          // here, a partial snapshot, and nothing may count it.
          output_tokens: 4,
        },
      },
      uuid: "assistant-uuid",
      session_id: "session-abc",
    } as unknown as SDKMessage,
  ];
}

/** Feed a whole turn's worth of messages to the accumulator. */
function feed(progress: SessionProgress, messages: SDKMessage[]): void {
  for (const message of messages) progress.observe(message);
}

/** A tool result returning to the main thread, ending sub-agent `id`. */
function toolResult(id: string): SDKMessage {
  return {
    type: "user",
    parent_tool_use_id: null,
    message: {
      content: [{ type: "tool_result", tool_use_id: id, content: "done" }],
    },
    uuid: "user-uuid",
    session_id: "session-abc",
  } as unknown as SDKMessage;
}

function resultMessage(
  overrides: Partial<{
    duration_ms: number;
    num_turns: number;
    total_cost_usd: number;
    modelUsage: Record<string, { inputTokens: number; outputTokens: number }>;
  }> = {},
): SDKMessage {
  return {
    type: "result",
    subtype: "success",
    duration_ms: overrides.duration_ms ?? 724_000,
    num_turns: overrides.num_turns ?? 47,
    total_cost_usd: overrides.total_cost_usd ?? 1.83,
    modelUsage: overrides.modelUsage ?? {
      "claude-opus-5": { inputTokens: 1_200_000, outputTokens: 84_200 },
    },
    uuid: "result-uuid",
    session_id: "session-abc",
  } as unknown as SDKMessage;
}

/** A clock the test drives by hand. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1_000_000;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("what the accumulator counts", () => {
  it("adds up output tokens across every turn, sub-agents included", () => {
    const progress = new SessionProgress();

    feed(progress, assistantTurn(1_000));
    feed(progress, assistantTurn(2_500, { parent: "toolu_1" }));
    feed(progress, assistantTurn(500));

    expect(progress.snapshot().outputTokens).toBe(4_000);
  });

  it("never sums input tokens across turns", () => {
    // The tempting wrong implementation. Every turn resends the whole
    // conversation, so summing per-turn `input_tokens` reports roughly N×
    // the true prompt on an N-turn session — a confidently wrong number,
    // which is worse than no number. Asserted rather than reviewed for.
    const progress = new SessionProgress();

    feed(progress, assistantTurn(100, { inputTokens: 50_000 }));
    feed(progress, assistantTurn(100, { inputTokens: 51_000 }));
    feed(progress, assistantTurn(100, { inputTokens: 52_000 }));

    const snapshot = progress.snapshot();
    expect(snapshot.outputTokens).toBe(300);
    // Not merely "not summed" — not present. A field that does not exist
    // cannot be filled in later by someone being helpful.
    expect(snapshot).not.toHaveProperty("inputTokens");
    expect(Object.values(snapshot)).not.toContain(153_000);
  });

  it("counts main-thread turns, not the fleet's", () => {
    const progress = new SessionProgress();

    feed(progress, assistantTurn(10));
    feed(progress, assistantTurn(10, { parent: "toolu_1" }));
    feed(progress, assistantTurn(10, { parent: "toolu_1" }));
    feed(progress, assistantTurn(10));

    expect(progress.snapshot().turns).toBe(2);
  });

  it("raises the sub-agent count as the fleet fans out and drops it as it lands", () => {
    const progress = new SessionProgress();
    expect(progress.snapshot().subAgents).toBe(0);

    feed(progress, assistantTurn(10, { parent: "toolu_1" }));
    feed(progress, assistantTurn(10, { parent: "toolu_2" }));
    expect(progress.snapshot().subAgents).toBe(2);

    // A second message from a sub-agent already counted is not a second agent.
    feed(progress, assistantTurn(10, { parent: "toolu_1" }));
    expect(progress.snapshot().subAgents).toBe(2);

    progress.observe(toolResult("toolu_1"));
    expect(progress.snapshot().subAgents).toBe(1);

    progress.observe(toolResult("toolu_2"));
    expect(progress.snapshot().subAgents).toBe(0);
  });

  it("measures elapsed time from when the session started", () => {
    const clock = fakeClock();
    const progress = new SessionProgress({ now: clock.now });

    clock.advance(252_000);

    expect(progress.snapshot().elapsedMs).toBe(252_000);
  });
});

describe("the closing summary", () => {
  it("takes its cost from the result message, never from a running total", () => {
    const progress = new SessionProgress();

    feed(progress, assistantTurn(1_000));
    feed(progress, assistantTurn(2_000));
    progress.observe(resultMessage({ total_cost_usd: 1.83 }));

    expect(progress.summary()?.costUsd).toBe(1.83);
  });

  it("takes its turn count and duration from the result message too", () => {
    const clock = fakeClock();
    const progress = new SessionProgress({ now: clock.now });

    feed(progress, assistantTurn(10));
    clock.advance(1_000);
    progress.observe(resultMessage({ num_turns: 47, duration_ms: 724_000 }));

    // The accumulator saw one turn and one second; the authoritative numbers
    // are the SDK's, and they are the ones reported.
    expect(progress.summary()).toMatchObject({
      turns: 47,
      durationMs: 724_000,
    });
  });

  it("has nothing to report before the session ends", () => {
    const progress = new SessionProgress();
    feed(progress, assistantTurn(1_000));

    expect(progress.summary()).toBeUndefined();
  });

  it("reports a failed session's cost, which was still spent", () => {
    const progress = new SessionProgress();
    progress.observe({
      type: "result",
      subtype: "error_during_execution",
      duration_ms: 5_000,
      num_turns: 2,
      total_cost_usd: 0.12,
      modelUsage: {},
      uuid: "u",
      session_id: "s",
    } as unknown as SDKMessage);

    expect(progress.summary()?.costUsd).toBe(0.12);
  });

  it("names every model the session used", () => {
    const progress = new SessionProgress();
    progress.observe(
      resultMessage({
        modelUsage: {
          "claude-opus-5": { inputTokens: 1_200_000, outputTokens: 84_200 },
          "claude-haiku-4-5": { inputTokens: 8_000, outputTokens: 1_100 },
        },
      }),
    );

    expect(progress.summary()?.models).toEqual([
      { model: "claude-opus-5", outputTokens: 84_200 },
      { model: "claude-haiku-4-5", outputTokens: 1_100 },
    ]);
  });
});

describe("what the lines look like", () => {
  it("says elapsed time, turns, output tokens and sub-agents", () => {
    const line = tickLine({
      elapsedMs: 252_000,
      turns: 18,
      outputTokens: 42_100,
      subAgents: 3,
    });

    expect(line).toBe("4m12s · 18 turns · 42.1k out · 3 sub-agents");
  });

  it("says one sub-agent rather than 1 sub-agents", () => {
    const line = tickLine({
      elapsedMs: 61_000,
      turns: 1,
      outputTokens: 900,
      subAgents: 1,
    });

    expect(line).toBe("1m01s · 1 turn · 900 out · 1 sub-agent");
  });

  it("leaves the fleet out of the line entirely when there is none", () => {
    const line = tickLine({
      elapsedMs: 9_000,
      turns: 2,
      outputTokens: 1_500,
      subAgents: 0,
    });

    expect(line).toBe("9s · 2 turns · 1.5k out");
  });

  it("reaches into hours without losing the minutes", () => {
    expect(
      tickLine({ elapsedMs: 3_864_000, turns: 1, outputTokens: 0, subAgents: 0 }),
    ).toContain("1h04m");
  });

  it("closes with the authoritative cost and what spent it", () => {
    const summary: SessionSummary = {
      durationMs: 724_000,
      turns: 47,
      costUsd: 1.8342,
      models: [
        { model: "claude-opus-5", outputTokens: 84_200 },
        { model: "claude-haiku-4-5", outputTokens: 1_100 },
      ],
    };

    expect(closingLine(summary)).toBe(
      "12m04s · 47 turns · $1.83 · claude-opus-5 84.2k out, claude-haiku-4-5 1.1k out",
    );
  });

  it("prints a cost too small to round away as more than nothing", () => {
    expect(
      closingLine({ durationMs: 1_000, turns: 1, costUsd: 0.0004, models: [] }),
    ).toContain("$0.0004");
  });

  it("uses no cursor control anywhere, so a pipe reads what a terminal shows", () => {
    // Append-only is a correctness property, not a preference: `log()` already
    // fires mid-session from the guardrails and the poll loop, and any of them
    // would shred a repainting line. It also has to survive `> daemon.log`,
    // a systemd journal and a pipe identically.
    const lines = [
      tickLine({ elapsedMs: 1_000, turns: 1, outputTokens: 1, subAgents: 1 }),
      closingLine({ durationMs: 1_000, turns: 1, costUsd: 1, models: [] }),
    ];

    for (const line of lines) {
      expect(line).not.toMatch(/[\r]/);
    }
  });
});

describe("where the running token total comes from", () => {
  it("counts the cumulative delta, not the assistant message's own usage", () => {
    // Found live on 2026-08-07: `usage.output_tokens` on the assistant message
    // is a partial snapshot taken before the message is written. Summed, it
    // reported 129 tokens for a session that had actually produced 26,800.
    // The regression this pins is a confidently wrong number, which is the
    // one failure this whole line was designed to avoid.
    const progress = new SessionProgress();

    feed(progress, assistantTurn(20_000));

    expect(progress.snapshot().outputTokens).toBe(20_000);
    // The wrong answer, for contrast: four, from the assistant message.
    expect(progress.snapshot().outputTokens).not.toBe(4);
  });

  it("replaces the in-flight message's count rather than adding to it", () => {
    // A `message_delta` is cumulative for its own message. Adding successive
    // deltas would over-report by roughly the triangular number of the turn.
    const progress = new SessionProgress();
    const stream = (event: unknown): SDKMessage =>
      ({
        type: "stream_event",
        event,
        parent_tool_use_id: null,
        uuid: "u",
        session_id: "s",
      }) as unknown as SDKMessage;

    progress.observe(stream({ type: "message_start" }));
    progress.observe(stream({ type: "message_delta", usage: { output_tokens: 100 } }));
    progress.observe(stream({ type: "message_delta", usage: { output_tokens: 250 } }));
    progress.observe(stream({ type: "message_delta", usage: { output_tokens: 400 } }));

    expect(progress.snapshot().outputTokens).toBe(400);
  });

  it("keeps each sub-agent's stream on its own tally", () => {
    // Sub-agent streams interleave with the main one. A single "current
    // message" would have them overwriting each other's cumulative counts.
    const progress = new SessionProgress();
    const stream = (event: unknown, parent: string | null): SDKMessage =>
      ({
        type: "stream_event",
        event,
        parent_tool_use_id: parent,
        uuid: "u",
        session_id: "s",
      }) as unknown as SDKMessage;

    progress.observe(stream({ type: "message_start" }, null));
    progress.observe(stream({ type: "message_start" }, "toolu_1"));
    progress.observe(stream({ type: "message_delta", usage: { output_tokens: 500 } }, "toolu_1"));
    progress.observe(stream({ type: "message_delta", usage: { output_tokens: 300 } }, null));
    progress.observe(stream({ type: "message_delta", usage: { output_tokens: 900 } }, "toolu_1"));

    expect(progress.snapshot().outputTokens).toBe(1_200);
    expect(progress.snapshot().turns).toBe(1);
  });

  it("counts a message that produced nothing as nothing, not as missing", () => {
    const progress = new SessionProgress();
    const stream = (event: unknown): SDKMessage =>
      ({
        type: "stream_event",
        event,
        parent_tool_use_id: null,
        uuid: "u",
        session_id: "s",
      }) as unknown as SDKMessage;

    progress.observe(stream({ type: "message_start" }));

    expect(progress.snapshot().outputTokens).toBe(0);
    expect(progress.snapshot().turns).toBe(1);
  });
});
