import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One piece an initiative will be built in: a chunk, in the domain's word
 * (`CONTEXT.md`, [ADR-0026](../../doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md)).
 * A chunk is one run — its own branch, its own pull request — and this is the
 * human-readable half of it, written before any of them exists.
 */
export interface Chunk {
  /** What the piece is called, in the list the human approved. */
  title: string;
  /** One line of what it delivers, in behaviour terms. */
  delivers: string;
}

/**
 * The state of a breakdown's approval, as its own `Status:` line records it.
 *
 * The approved arm carries the **piece count the human saw**, and that is what
 * makes it more than decoration: a list longer than the count its own stamp
 * names has gained a chunk since the approval, which is
 * [ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D3's re-proposal. See {@link isReproposal}.
 */
export type BreakdownStamp =
  | { kind: "awaiting" }
  | { kind: "approved"; by: string; at: string; pieces: number };

/** A breakdown as the file says it: its stamp, and its ordered chunks. */
export interface ParsedBreakdown {
  stamp: BreakdownStamp;
  chunks: Chunk[];
}

/** The `Status:` line, tolerating the emphasis people put around it. */
const STATUS_LINE = /^\s*(?:\*\*|__)?Status:(?:\*\*|__)?\s*(.+?)\s*$/m;

/**
 * `Approved by <who> <date> — N pieces`, the stamp's second state.
 *
 * **The date tolerates a time, because the thing that writes it is a prompt
 * and the thing that reads it is this regex.** Nothing type-checks one against
 * the other, and on 2026-08-15 that cost the live gate a whole initiative: the
 * approval-record session was handed the gate reply's ISO timestamp, wrote
 * `Approved by fvermaut 2026-08-15T17:24:24Z — 2 pieces` — a fair reading of
 * `<date>` — and this pattern rejected it. A rejected stamp makes the whole
 * breakdown `malformed`, and an unreadable breakdown **closes its ticket**, so
 * the second of two pieces would never have been built and nothing would have
 * said why.
 *
 * The count stays strict, because `isReproposal` compares against it and a
 * wrong number there approves work nobody saw. The date is informational and
 * is parsed loosely on purpose.
 */
const APPROVED_STAMP =
  /^Approved by\s+(.+?)\s+(\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+Z?)?)\s*[—-]\s*(\d+)\s+pieces?$/;

/** `N. **<title>** — <what it delivers>`, one chunk of the ordered list. */
const CHUNK_LINE = /^\s*\d+\.\s+(?:\*\*|__)(.+?)(?:\*\*|__)\s*[—-]\s*(.+?)\s*$/;

/**
 * Read a breakdown out of its markdown. Pure, and the inverse of
 * {@link renderBreakdown}.
 *
 * Answers rather than throws, all the way down: the poll loop asks this every
 * cycle (23f), and an exception there would take a whole project's turn with
 * it. A file it cannot read is `malformed` carrying a reason written for the
 * person who will have to go and look at the file.
 */
export function parseBreakdown(
  text: string,
): ParsedBreakdown | { kind: "malformed"; reason: string } {
  const status = STATUS_LINE.exec(text);
  if (status === null) {
    return {
      kind: "malformed",
      reason: "no `Status:` line — a breakdown says whether it is approved",
    };
  }

  const stamp = parseStamp(status[1] ?? "");
  if ("reason" in stamp) return stamp;

  const chunks = text
    .split("\n")
    .map((line) => CHUNK_LINE.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ title: match[1] ?? "", delivers: match[2] ?? "" }));

  if (chunks.length === 0) {
    return {
      kind: "malformed",
      reason:
        "no chunks listed — a breakdown is the list of pieces an initiative " +
        "will be built in, and an empty one names none",
    };
  }

  return { stamp, chunks };
}

/**
 * Where a ticket's breakdown lives in its project's checkout, relative to the
 * repository root ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D1). **The only place this path is spelled** — every reader goes through
 * here, so the artifact can never be written to one path and looked for at
 * another.
 *
 * The number is zero-padded to two digits, matching `doc/plans/phases/` next
 * door (`phase-01.md`) and `doc/triage/`'s three: a person browsing
 * `doc/plans/` sees one shape. Tickets past 99 simply grow, as phases do.
 */
export function breakdownPath(ticket: number): string {
  return join("doc", "plans", "breakdowns", `ticket-${pad(ticket)}.md`);
}

/** What reading a ticket's breakdown off disk found. */
export type BreakdownRead =
  | { kind: "ok"; path: string; breakdown: ParsedBreakdown }
  | { kind: "absent"; path: string }
  | { kind: "malformed"; path: string; reason: string };

/**
 * Read a ticket's breakdown out of a project checkout.
 *
 * **It returns an answer; it never throws.** The poll loop asks this of every
 * marked ticket on every cycle, and a project with no breakdown yet — or one
 * whose file somebody hand-edited into nonsense — is an ordinary state of the
 * world, not an exception. An exception here would take the whole project's
 * poll turn down with it.
 *
 * Every arm carries the path it looked at, so a log line or a ticket comment
 * can say *which* file, on a machine the reader is not sitting at.
 */
export function readBreakdown(repoDir: string, ticket: number): BreakdownRead {
  const path = join(repoDir, breakdownPath(ticket));
  if (!existsSync(path)) return { kind: "absent", path };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "malformed", path, reason };
  }

  const parsed = parseBreakdown(text);
  return "kind" in parsed
    ? { kind: "malformed", path, reason: parsed.reason }
    : { kind: "ok", path, breakdown: parsed };
}

/** Write a breakdown back out. The inverse of {@link parseBreakdown}. */
export function renderBreakdown(breakdown: ParsedBreakdown): string {
  const lines = [
    "# Breakdown",
    "",
    `**Status:** ${renderStamp(breakdown.stamp)}`,
    "",
    ...breakdown.chunks.map(
      (chunk, index) => `${index + 1}. **${chunk.title}** — ${chunk.delivers}`,
    ),
    "",
  ];
  return lines.join("\n");
}

/** How far through its chunks an initiative is, and which one comes next. */
export interface ChunkProgress {
  /** How many chunks the approved list holds. */
  total: number;
  /** How many of them the ledger has settled. */
  done: number;
  /** The chunk to build next, or undefined when none remains. */
  next?: { index: number; title: string };
}

/**
 * Where an initiative stands: the approved list, read against how many of its
 * chunks the ledger has settled.
 *
 * **This is the whole of derived doneness**
 * ([ADR-0030](../../doc/adr/0030-the-breakdown-is-a-stage-and-chunk-zero-merges-without-a-pull-request.md)
 * D4). Nothing is ever written back into the file as chunks land — the file
 * the human approved is the file that stays on the branch — so *which piece is
 * next* is computed here, from the artifact and the count, every time it is
 * asked.
 *
 * `done` is clamped to the list. A ledger holding more settled chunks than the
 * breakdown lists is a real state — a re-proposal shrank the list, or a chunk
 * was opened by hand — and the honest answer to it is "there is nothing left
 * to build", not an exception on the poll loop's every cycle.
 */
export function chunkProgress(
  breakdown: ParsedBreakdown,
  doneChunks: number,
): ChunkProgress {
  const total = breakdown.chunks.length;
  const done = Math.min(Math.max(doneChunks, 0), total);
  const next = breakdown.chunks[done];
  return next === undefined
    ? { total, done }
    : { total, done, next: { index: done + 1, title: next.title } };
}

/**
 * Whether this breakdown has gained a chunk since the human read it
 * ([ADR-0028](../../doc/adr/0028-the-breakdown-is-an-artifact-and-the-ticket-follows-it.md)
 * D3: a breakdown that gains a chunk mid-flight is a re-proposal and re-gates).
 *
 * **Answered from the artifact alone**, by the stamp's own piece count against
 * the length of the list beneath it. That is why the count is in the stamp:
 * comparing against the ledger instead would put the answer in a second place
 * that can drift from the file, which is the fault D1 chose a committed
 * artifact to avoid.
 *
 * An unapproved breakdown is never a re-proposal — nothing has been approved,
 * so nothing has been re-proposed. Neither is a list *shorter* than its stamp:
 * that is a breakdown that lost a chunk, which is a different event and not one
 * this predicate is entitled to name.
 */
export function isReproposal(breakdown: ParsedBreakdown): boolean {
  if (breakdown.stamp.kind !== "approved") return false;
  return breakdown.chunks.length > breakdown.stamp.pieces;
}

/** {@link parseBreakdown} for the `Status:` line's own two states. */
function parseStamp(
  value: string,
): BreakdownStamp | { kind: "malformed"; reason: string } {
  if (value.toLowerCase() === "awaiting approval") return { kind: "awaiting" };

  const approved = APPROVED_STAMP.exec(value);
  if (approved !== null) {
    return {
      kind: "approved",
      by: approved[1] ?? "",
      at: approved[2] ?? "",
      pieces: Number(approved[3]),
    };
  }

  return {
    kind: "malformed",
    reason:
      `unreadable \`Status:\` line "${value}" — expected "Awaiting approval" ` +
      "or \"Approved by <who> <date> — N pieces\"",
  };
}

/** Two digits at least, so `doc/plans/breakdowns/` sorts and reads as a list. */
function pad(ticket: number): string {
  return String(ticket).padStart(2, "0");
}

/** {@link renderBreakdown} for the stamp. */
function renderStamp(stamp: BreakdownStamp): string {
  return stamp.kind === "awaiting"
    ? "Awaiting approval"
    : `Approved by ${stamp.by} ${stamp.at} — ${stamp.pieces} pieces`;
}
