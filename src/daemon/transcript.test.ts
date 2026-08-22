import { describe, expect, it } from "vitest";

import { renderTranscript, renderMessage } from "./transcript.js";

/** Real shapes, copied from a real boxed run on 2026-08-22. */
const init = {
  type: "system",
  subtype: "init",
  cwd: "/workspace/timone",
  session_id: "4f5718e2",
  model: "claude-opus-5",
  tools: ["Task", "Bash", "Read", "Edit"],
};

const bash = {
  type: "assistant",
  parent_tool_use_id: null,
  message: {
    content: [
      {
        type: "tool_use",
        id: "toolu_01N5",
        name: "Bash",
        input: { command: "npm test", description: "Run the suite" },
      },
    ],
  },
};

function toolResult(content: string, parent: string | null = null): unknown {
  return {
    type: "user",
    parent_tool_use_id: parent,
    message: {
      content: [{ type: "tool_result", tool_use_id: "toolu_01N5", content }],
    },
  };
}

describe("reading back what an agent did", () => {
  it("opens with the session, its model and where it ran", () => {
    const lines = renderMessage(init);

    expect(lines.join(" ")).toContain("4f5718e2");
    expect(lines.join(" ")).toContain("claude-opus-5");
    expect(lines.join(" ")).toContain("/workspace/timone");
  });

  it("shows what the agent said", () => {
    const lines = renderMessage({
      type: "assistant",
      parent_tool_use_id: null,
      message: { content: [{ type: "text", text: "I'll rebuild context first." }] },
    });

    expect(lines.join("\n")).toContain("I'll rebuild context first.");
  });

  it("names a tool and the one thing worth knowing about the call", () => {
    // `Bash(npm test)` rather than a JSON blob. The command is the thing a
    // human scanning a log is looking for.
    expect(renderMessage(bash).join("\n")).toContain("Bash(npm test)");
  });

  it("summarises each tool by the field that identifies its call", () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ["Read", { file_path: "/workspace/timone/src/git.ts" }, "src/git.ts"],
      ["Edit", { file_path: "/a/b/c.ts" }, "c.ts"],
      ["Write", { file_path: "/a/b/new.md" }, "new.md"],
      ["Grep", { pattern: "TODO", path: "src" }, "TODO"],
      ["Task", { description: "Build 06c" }, "Build 06c"],
      ["Skill", { skill: "timone-execute" }, "timone-execute"],
    ];

    for (const [name, input, expected] of cases) {
      const rendered = renderMessage({
        type: "assistant",
        parent_tool_use_id: null,
        message: { content: [{ type: "tool_use", id: "t", name, input }] },
      }).join("\n");
      expect(rendered, `${name} should mention ${expected}`).toContain(expected);
    }
  });

  it("shows a tool's answer, shortened, and says how much it dropped", () => {
    const long = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");

    const rendered = renderMessage(toolResult(long)).join("\n");

    expect(rendered).toContain("line 0");
    expect(rendered).not.toContain("line 39");
    expect(rendered).toMatch(/\+\d+ more lines/);
  });

  it("keeps a short answer whole", () => {
    expect(renderMessage(toolResult("ok")).join("\n")).toContain("ok");
  });

  it("indents a sub-agent's work so the nesting is visible", () => {
    const nested = renderMessage(toolResult("done", "toolu_parent"))[0];
    const top = renderMessage(toolResult("done", null))[0];

    expect(nested.length - nested.trimStart().length).toBeGreaterThan(
      top.length - top.trimStart().length,
    );
  });

  it("shows a sub-agent starting and finishing", () => {
    const started = renderMessage({
      type: "system",
      subtype: "task_started",
      task_id: "b1i9",
      description: "Materialize managed project workspace",
    }).join("\n");
    const finished = renderMessage({
      type: "system",
      subtype: "task_notification",
      task_id: "b1i9",
      status: "completed",
      summary: "Materialize managed project workspace",
    }).join("\n");

    expect(started).toContain("Materialize managed project workspace");
    expect(finished).toContain("completed");
  });

  it("shows the guardrail hooks, because their silence is what went unnoticed", () => {
    // They could not run in the box at all until 2026-08-22, and nothing said
    // so. A log that omits them would hide the same fault twice.
    const rendered = renderMessage({
      type: "system",
      subtype: "hook_started",
      hook_name: "SessionStart:startup",
      hook_event: "SessionStart",
    }).join("\n");

    expect(rendered).toContain("SessionStart");
  });

  it("shows a rate limit, which is a reason a run slows down", () => {
    // The status is one level down, in `rate_limit_info` — read from a real
    // run rather than assumed, which is how the first version printed an
    // empty reason.
    expect(
      renderMessage({
        type: "rate_limit_event",
        rate_limit_info: { status: "throttled", rateLimitType: "five_hour" },
      }).join("\n"),
    ).toMatch(/rate limit.*throttled/i);
  });

  it("says nothing when the rate limit is simply allowing the call", () => {
    expect(
      renderMessage({
        type: "rate_limit_event",
        rate_limit_info: { status: "allowed" },
      }),
    ).toEqual([]);
  });

  it("says nothing for a thinking block with nothing in it", () => {
    // The text is encrypted on the wire and only a signature arrives, so an
    // empty thinking block said "thought for 0 characters" 27 times in the
    // first real run.
    expect(
      renderMessage({
        type: "assistant",
        parent_tool_use_id: null,
        message: { content: [{ type: "thinking", thinking: "", signature: "x" }] },
      }),
    ).toEqual([]);
  });

  it("closes with what the session cost and how it ended", () => {
    const rendered = renderMessage({
      type: "result",
      subtype: "success",
      is_error: false,
      duration_ms: 3_661_000,
      num_turns: 88,
      total_cost_usd: 21.99,
      modelUsage: { "claude-opus-5": { outputTokens: 208_200 } },
    }).join("\n");

    expect(rendered).toContain("success");
    expect(rendered).toContain("88");
    expect(rendered).toContain("21.99");
    expect(rendered).toMatch(/1h0?1m/);
  });

  it("drops the streaming events, which are the same words arriving in pieces", () => {
    // 808 of the 1459 lines in the first real run were these. A log that kept
    // them would be the JSON again, only longer.
    expect(
      renderMessage({ type: "stream_event", event: { type: "content_block_delta" } }),
    ).toEqual([]);
  });

  it("says nothing for a line it cannot read, rather than guessing", () => {
    expect(renderMessage("not json at all")).toEqual([]);
    expect(renderMessage({ no: "type" })).toEqual([]);
  });
});

describe("rendering a whole saved transcript", () => {
  it("turns a file of JSON lines into something a person can scan", () => {
    const file = [
      JSON.stringify(init),
      JSON.stringify({ type: "stream_event", event: { type: "message_start" } }),
      JSON.stringify(bash),
      JSON.stringify(toolResult("2 passed")),
      "",
      "a banner nobody meant to print",
    ].join("\n");

    const out = renderTranscript(file);

    expect(out).toContain("4f5718e2");
    expect(out).toContain("Bash(npm test)");
    expect(out).toContain("2 passed");
    expect(out).not.toContain("message_start");
  });
});
