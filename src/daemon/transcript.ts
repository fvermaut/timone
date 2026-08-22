/**
 * What an agent did in a box, written so a person can read it.
 *
 * **Why this exists.** A boxed session's own transcript lives inside the
 * container and dies with it, so the first real boxed run cost an hour and $22
 * and left nothing to explain why it stopped. Keeping the stream fixed that
 * much — but the stream is `stream-json`, and in the first real run **808 of
 * its 1459 lines were streaming events**: the same words arriving in pieces.
 * A file of those is the JSON again, only longer.
 *
 * So this renders the same stream the way Claude Code renders it in a
 * terminal: what the agent said, which tool it reached for and the one thing
 * worth knowing about the call, what came back, and what it all cost. The
 * JSON is kept beside it — that is the record, and this is the reading of it.
 */

/** How many lines of a tool's answer are worth keeping in the reading. */
const RESULT_LINES = 12;

/** How wide a single rendered line may be before it is cut. */
const WIDTH = 160;

/** The nesting a sub-agent's work is drawn at. */
const INDENT = "    ";

/**
 * The field that identifies a call, per tool.
 *
 * `Bash(npm test)` rather than a JSON blob: a human scanning a log is looking
 * for the command, the file or the description, and nothing else. Anything
 * not named here falls back to the first short string in the input, which is
 * usually the right one and is never worse than the whole object.
 */
const SUMMARY_FIELD: Record<string, readonly string[]> = {
  Bash: ["command"],
  Read: ["file_path"],
  Edit: ["file_path"],
  Write: ["file_path"],
  NotebookEdit: ["notebook_path"],
  Grep: ["pattern"],
  Glob: ["pattern"],
  Task: ["description"],
  Agent: ["description"],
  Skill: ["skill"],
  WebFetch: ["url"],
  WebSearch: ["query"],
  ToolSearch: ["query"],
};

/** Cut a string to one readable line. */
function oneLine(value: string, width = WIDTH): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat;
}

/** `1h01m`, `4m30s`, `900ms` — a duration in the shortest exact words. */
function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** The one thing worth knowing about a tool call. */
function summarise(name: string, input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const fields = input as Record<string, unknown>;

  for (const key of SUMMARY_FIELD[name] ?? []) {
    const value = fields[key];
    if (typeof value === "string" && value !== "") {
      return oneLine(key.endsWith("path") ? shortPath(value) : value, 100);
    }
  }

  const first = Object.values(fields).find(
    (value) => typeof value === "string" && value !== "",
  );
  return typeof first === "string" ? oneLine(first, 100) : "";
}

/** The tail of a path, which is what identifies a file to a reader. */
function shortPath(path: string): string {
  const parts = path.split("/").filter((part) => part !== "");
  return parts.slice(-2).join("/");
}

/** Whatever a tool result's content is, as text. */
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        typeof block === "object" && block !== null && "text" in block
          ? String((block as { text: unknown }).text)
          : "",
      )
      .join("\n");
  }
  return "";
}

/**
 * One message, as lines a person can read. Empty for anything that carries no
 * information a reader wants — the streaming events above all.
 */
export function renderMessage(message: unknown): string[] {
  if (typeof message !== "object" || message === null) return [];
  const value = message as Record<string, unknown>;
  const type = value["type"];
  if (typeof type !== "string") return [];

  const nested = typeof value["parent_tool_use_id"] === "string";
  const pad = nested ? INDENT : "";

  if (type === "stream_event") return [];

  if (type === "system") return renderSystem(value, pad);

  if (type === "rate_limit_event") {
    // The status lives one level down, in `rate_limit_info`. Shown because a
    // throttled window is a reason a run crawls, and it is invisible from the
    // outside.
    const info = value["rate_limit_info"];
    const detail =
      typeof info === "object" && info !== null
        ? (info as Record<string, unknown>)
        : {};
    const status = String(detail["status"] ?? "?");
    if (status === "allowed") return [];
    return [
      `${pad}⏳ rate limit — ${status}` +
        (detail["rateLimitType"] === undefined
          ? ""
          : ` (${String(detail["rateLimitType"])})`),
    ];
  }

  if (type === "assistant") return renderAssistant(value, pad);
  if (type === "user") return renderUser(value, pad);
  if (type === "result") return renderResult(value);

  return [];
}

function renderSystem(value: Record<string, unknown>, pad: string): string[] {
  switch (value["subtype"]) {
    case "init": {
      const tools = Array.isArray(value["tools"]) ? value["tools"].length : 0;
      return [
        `● session ${String(value["session_id"] ?? "?")}` +
          ` · model ${String(value["model"] ?? "?")}` +
          ` · cwd ${String(value["cwd"] ?? "?")}` +
          ` · ${tools} tools`,
      ];
    }
    case "hook_started":
      // Shown deliberately. These could not run in a box at all until
      // 2026-08-22 and nothing said so; a log that omitted them would hide
      // the same fault a second time.
      return [`${pad}🔒 hook ${String(value["hook_name"] ?? value["hook_event"] ?? "?")}`];
    case "task_started":
      return [`${pad}▶ task ${oneLine(String(value["description"] ?? ""))}`];
    case "task_notification":
      return [
        `${pad}✔ task ${oneLine(String(value["summary"] ?? ""))}` +
          ` — ${String(value["status"] ?? "")}`,
      ];
    default:
      // `status`, `thinking_tokens`, `task_progress` and the rest are counters
      // the progress line already reports.
      return [];
  }
}

function renderAssistant(value: Record<string, unknown>, pad: string): string[] {
  const content = (value["message"] as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(content)) return [];

  const lines: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;

    if (b["type"] === "text" && typeof b["text"] === "string" && b["text"] !== "") {
      for (const line of b["text"].split("\n")) {
        if (line.trim() !== "") lines.push(`${pad}● ${oneLine(line)}`);
      }
    }
    if (b["type"] === "thinking") {
      // The text is encrypted on the wire — only a signature comes through —
      // so a thinking block with nothing in it says nothing, 27 times in the
      // first real run. Rendered only when there is something to render.
      const text = typeof b["thinking"] === "string" ? b["thinking"] : "";
      if (text.trim() !== "") lines.push(`${pad}  · ${oneLine(text)}`);
    }
    if (b["type"] === "tool_use") {
      const name = String(b["name"] ?? "?");
      const summary = summarise(name, b["input"]);
      lines.push(`${pad}⏺ ${name}(${summary})`);
    }
  }
  return lines;
}

function renderUser(value: Record<string, unknown>, pad: string): string[] {
  const content = (value["message"] as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(content)) return [];

  const lines: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b["type"] !== "tool_result") continue;

    const text = resultText(b["content"]).split("\n");
    const kept = text.slice(0, RESULT_LINES);
    const dropped = text.length - kept.length;

    lines.push(`${pad}  ⎿ ${oneLine(kept[0] ?? "")}`);
    for (const line of kept.slice(1)) lines.push(`${pad}    ${oneLine(line)}`);
    if (dropped > 0) lines.push(`${pad}    … +${dropped} more lines`);
  }
  return lines;
}

function renderResult(value: Record<string, unknown>): string[] {
  const usage = value["modelUsage"];
  const models =
    typeof usage === "object" && usage !== null
      ? Object.entries(usage as Record<string, { outputTokens?: number }>)
          .map(([model, u]) => `${model} ${u.outputTokens ?? 0} out`)
          .join(", ")
      : "";
  const cost = value["total_cost_usd"];

  return [
    "",
    `■ ${String(value["subtype"] ?? "?")}` +
      (value["is_error"] === true ? " (flagged as an error)" : "") +
      ` · ${duration(Number(value["duration_ms"] ?? 0))}` +
      ` · ${String(value["num_turns"] ?? "?")} turns` +
      (typeof cost === "number" ? ` · $${cost.toFixed(2)}` : "") +
      (models === "" ? "" : ` · ${models}`),
  ];
}

/**
 * A whole saved transcript, as text. Lines that are not JSON are kept
 * verbatim: something printed them, and in a container that is worth seeing.
 */
export function renderTranscript(file: string): string {
  const out: string[] = [];
  for (const raw of file.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      out.push(`· ${line}`);
      continue;
    }
    out.push(...renderMessage(parsed));
  }
  return out.join("\n");
}
