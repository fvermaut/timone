import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

/** Tally key for the session's own stream, as opposed to a sub-agent's. */
const MAIN_THREAD = "main";

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
  /**
   * Replies the main thread has made so far — messages, counted live. This
   * is deliberately *not* called turns: the SDK's own `num_turns`, which the
   * closing line reports, counts round trips and comes out higher. Two
   * honest counts of different things had the same name and disagreed on
   * screen (31 against 44, live on 2026-08-07), which reads as one of them
   * being wrong.
   */
  replies: number;
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
  /**
   * Per-stream output tallies, keyed by sub-agent tool-use id (or
   * {@link MAIN_THREAD}). `committed` is every finished message; `current` is
   * the one being written, whose delta is cumulative and so replaces rather
   * than adds.
   */
  private readonly streams = new Map<string, { committed: number; current: number }>();
  /** Tool-use ids of sub-agents that have spoken but not yet returned. */
  private readonly liveSubAgents = new Set<string>();
  private ended: SessionSummary | undefined;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }

  /** Read one message off the stream. Anything unrecognised is ignored. */
  observe(message: SDKMessage): void {
    if (message.type === "stream_event") {
      this.observeStreamEvent(message.event, message.parent_tool_use_id);
      return;
    }

    if (message.type === "assistant") {
      // Read for the fleet only. Its `usage.output_tokens` is *not* the
      // finished message's output — measured live it under-reports by roughly
      // thirty times — so nothing is counted from here. See
      // {@link observeStreamEvent} for where the tokens actually come from.
      const parent = message.parent_tool_use_id;
      if (parent !== null) this.liveSubAgents.add(parent);
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

  /**
   * The one place a running total of output tokens can honestly come from.
   *
   * A `message_delta` event carries the *cumulative* output of the message
   * being written, so the running total is every finished message's final
   * delta plus the one in flight. Proven exact against the SDK's own
   * accounting rather than assumed: summed deltas and `modelUsage` agree to
   * the token.
   *
   * The obvious-looking source — `usage.output_tokens` on the assistant
   * message — is a partial snapshot taken before the message is written, and
   * summing it reports roughly a thirtieth of the truth. This phase set out
   * to avoid printing a confidently wrong number in one direction and found
   * the same trap waiting in the other.
   */
  private observeStreamEvent(
    event: { type?: string; usage?: { output_tokens?: number } },
    parent: string | null,
  ): void {
    // Sub-agent streams interleave with the main one, so each is tallied
    // under its own key; a shared "current message" would have them
    // overwriting each other's counts.
    const key = parent ?? MAIN_THREAD;

    if (event.type === "message_start") {
      const stream = this.streamFor(key);
      stream.committed += stream.current;
      stream.current = 0;
      if (parent === null) this.turns += 1;
      else this.liveSubAgents.add(parent);
      return;
    }

    if (event.type === "message_delta" && event.usage?.output_tokens !== undefined) {
      this.streamFor(key).current = event.usage.output_tokens;
    }
  }

  private streamFor(key: string): { committed: number; current: number } {
    const existing = this.streams.get(key);
    if (existing !== undefined) return existing;
    const fresh = { committed: 0, current: 0 };
    this.streams.set(key, fresh);
    return fresh;
  }

  /** How the session is doing right now. */
  snapshot(): ProgressSnapshot {
    let outputTokens = 0;
    for (const stream of this.streams.values()) {
      outputTokens += stream.committed + stream.current;
    }
    return {
      elapsedMs: this.now() - this.startedAt,
      replies: this.turns,
      outputTokens,
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
    count(snapshot.replies, "reply", "replies"),
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

function count(value: number, noun: string, plural?: string): string {
  if (value === 1) return `${value} ${noun}`;
  return `${value} ${plural ?? `${noun}s`}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Seconds between progress ticks when nobody says otherwise.
 *
 * It sets two things at once, and that is deliberate (ADR-0017): how often
 * the daemon says what a session is doing, and how often the session proves
 * it is alive. Recovery is derived from it — a run silent for four of these
 * is reclaimed — so nobody may later make the tick conditional without
 * moving recovery too.
 */
export const DEFAULT_PROGRESS_INTERVAL_SECONDS = 30;
