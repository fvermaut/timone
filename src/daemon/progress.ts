import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * What a session looks like from outside, while it is still working.
 *
 * There is deliberately no input-token field. Every turn resends the whole
 * conversation, so a running total of per-turn `input_tokens` reports roughly
 * N× the true prompt on an N-turn session — and a confidently wrong number is
 * worse than no number at all. The authoritative input figures exist, once,
 * on the `result` message, and belong on the closing line.
 */
export interface ProgressSnapshot {
  /** Milliseconds since the session started. */
  elapsedMs: number;
  /** Turns the main thread has taken; the fleet's turns are not counted. */
  turns: number;
  /** Cumulative output tokens, sub-agents included — that output is real. */
  outputTokens: number;
  /** Sub-agents working right now, not sub-agents ever started. */
  subAgents: number;
}

/** What the session cost, once it has ended and can say so authoritatively. */
export interface SessionSummary {
  durationMs: number;
  turns: number;
  costUsd: number;
  models: { model: string; outputTokens: number }[];
}

/**
 * Watches an SDK message stream and answers, at any moment, how the session is
 * doing — and once it has ended, what it cost.
 *
 * Everything before the `result` message is an estimate the accumulator builds
 * itself; everything on the `result` message is the SDK's own accounting and
 * is used verbatim. The two are kept apart on purpose: {@link snapshot} never
 * claims authority it does not have, and {@link summary} never guesses.
 */
export class SessionProgress {
  private readonly now: () => number;
  private readonly startedAt: number;
  private turns = 0;
  private outputTokens = 0;
  /** Tool-use ids of sub-agents that have spoken but not yet returned. */
  private readonly liveSubAgents = new Set<string>();
  private ended: SessionSummary | undefined;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }

  /** Read one message off the stream. Anything unrecognised is ignored. */
  observe(message: SDKMessage): void {
    if (message.type === "assistant") {
      const parent = message.parent_tool_use_id;
      if (parent === null) {
        this.turns += 1;
      } else {
        // A sub-agent announces itself by speaking. There is no separate
        // "started" event, so its first message is the only signal there is.
        this.liveSubAgents.add(parent);
      }
      this.outputTokens += message.message.usage?.output_tokens ?? 0;
      return;
    }

    if (message.type === "user" && message.parent_tool_use_id === null) {
      // A tool result arriving back on the main thread is a sub-agent
      // finishing — again the only signal available, since the SDK reports no
      // sub-agent lifecycle of its own.
      for (const id of toolResultIds(message.message.content)) {
        this.liveSubAgents.delete(id);
      }
      return;
    }

    if (message.type === "result") {
      this.ended = {
        durationMs: message.duration_ms,
        turns: message.num_turns,
        costUsd: message.total_cost_usd,
        models: Object.entries(message.modelUsage).map(([model, usage]) => ({
          model,
          outputTokens: usage.outputTokens,
        })),
      };
    }
  }

  /** How the session is doing right now. */
  snapshot(): ProgressSnapshot {
    return {
      elapsedMs: this.now() - this.startedAt,
      turns: this.turns,
      outputTokens: this.outputTokens,
      subAgents: this.liveSubAgents.size,
    };
  }

  /**
   * What the session cost, or undefined while it is still running. A failed
   * session has a summary too: the money was spent either way, and saying so
   * is the difference between a cost report and a success report.
   */
  summary(): SessionSummary | undefined {
    return this.ended;
  }
}

/** The `tool_use_id`s of any tool_result blocks in a message's content. */
function toolResultIds(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const ids: string[] = [];
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "tool_result" &&
      typeof (block as { tool_use_id?: unknown }).tool_use_id === "string"
    ) {
      ids.push((block as { tool_use_id: string }).tool_use_id);
    }
  }
  return ids;
}

/**
 * One progress line, for appending. Never repainting: `log()` already fires
 * during a session from the guardrails and the poll loop, and a `\r`-based
 * line would be shredded by any of them. Append-only also reads identically
 * in a terminal, a pipe, a `nohup` log and a systemd journal — which is why
 * nothing here consults a TTY.
 */
export function tickLine(snapshot: ProgressSnapshot): string {
  const parts = [
    duration(snapshot.elapsedMs),
    count(snapshot.turns, "turn"),
    `${tokens(snapshot.outputTokens)} out`,
  ];
  if (snapshot.subAgents > 0) {
    parts.push(count(snapshot.subAgents, "sub-agent"));
  }
  return parts.join(" · ");
}

/** The one line printed when a session ends, carrying what it actually cost. */
export function closingLine(summary: SessionSummary): string {
  const parts = [
    duration(summary.durationMs),
    count(summary.turns, "turn"),
    money(summary.costUsd),
  ];
  if (summary.models.length > 0) {
    parts.push(
      summary.models
        .map((entry) => `${entry.model} ${tokens(entry.outputTokens)} out`)
        .join(", "),
    );
  }
  return parts.join(" · ");
}

/** `9s`, `4m12s`, `1h04m` — always two units at most, never a bare 3864s. */
function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h${pad(minutes)}m`;
  if (minutes > 0) return `${minutes}m${pad(seconds)}s`;
  return `${seconds}s`;
}

/** `900`, `1.5k`, `42.1k`, `1.2M` — short enough to read at a glance. */
function tokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/**
 * `$1.83`, and `$0.0004` rather than `$0.00`. A cost rounded away to nothing
 * reads as "this was free", which is a different claim from "this was cheap".
 */
function money(usd: number): string {
  if (usd > 0 && usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
