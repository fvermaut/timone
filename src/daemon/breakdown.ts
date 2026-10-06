import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TicketingProject } from "../adapters/ticketing.js";

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
  /**
   * The text after `Needs:` on the indented list line under this piece,
   * verbatim — which pieces must be built before this one. Absent when the
   * piece has no such line, which {@link orderOf} reads as "the piece just
   * above it", the order every list meant before the line existed.
   *
   * Kept as the writer's own words rather than as numbers, because
   * `parseBreakdown` does not judge it: the poll loop reads every list on
   * every cycle, and a line it could not read must not make a list it can
   * read today `malformed`. Judging the line is {@link orderOf}'s job.
   */
  needsLine?: string;
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

/** `   - Needs: <text>`, the indented list line under a piece. */
const NEEDS_LINE = /^\s+[-*]\s+(?:\*\*|__)?Needs:(?:\*\*|__)?\s*(.+?)\s*$/;

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

  const chunks: Chunk[] = [];
  for (const line of text.split("\n")) {
    const chunk = CHUNK_LINE.exec(line);
    if (chunk !== null) {
      chunks.push({ title: chunk[1] ?? "", delivers: chunk[2] ?? "" });
      continue;
    }
    // A `Needs:` line belongs to the piece above it, and only the first one
    // counts. One before any piece belongs to nothing and is left alone.
    const needs = NEEDS_LINE.exec(line);
    const current = chunks[chunks.length - 1];
    if (needs !== null && current !== undefined && current.needsLine === undefined) {
      current.needsLine = needs[1] ?? "";
    }
  }

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
 * Where a breakdown's text is read from. Two exist, and every caller says
 * which — there is deliberately **no default**.
 *
 * The parameter exists because the answer used to be "whatever is checked out
 * right now", which is not a point in the project's history at all. Sessions
 * switch branches in the same checkout the poll loop reads, so *which piece is
 * next* depended on what the last session happened to leave behind. Making the
 * source an argument means the next caller has to answer the question rather
 * than inherit somebody else's answer, which is the whole of the fix.
 *
 * Returns undefined when the file is not there — an ordinary state of the
 * world. Throwing is reserved for a source that could not look.
 */
export type BreakdownSource = (
  path: string,
) => string | undefined | Promise<string | undefined>;

/**
 * ✏ **Phase 30's 30d: a source is now built by whoever knows where to look,
 * and takes only the path.**
 *
 * It used to take `(repoDir, path)`, which forced every caller to resolve a
 * directory under `projects/` before it could ask a question — including the
 * poll loop, whose whole point since 30d is that it does not have one
 * ([ADR-0043](../../doc/adr/0043-the-humans-checkout-is-theirs-alone.md)). A
 * source that reads the forge has no directory to be given, and one that
 * reads a checkout can close over its own.
 *
 * It may answer asynchronously, because reading the forge is a network call.
 * A synchronous source still satisfies the type unchanged.
 */

/** A {@link BreakdownSource} that answers without waiting. */
export type SyncBreakdownSource = (path: string) => string | undefined;

/**
 * The file as it sits in a working tree. **Correct only when the caller owns
 * the checkout** — a test fixture, or a session working on its own branch.
 * Never right for the poll loop.
 */
export function fromWorkingTree(repoDir: string): SyncBreakdownSource {
  return (path) => {
    const full = join(repoDir, path);
    if (!existsSync(full)) return undefined;
    return readFileSync(full, "utf8");
  };
}

/**
 * The file as it stands on the project's default branch **on the forge**.
 *
 * The machine's source since 30d. Before it, the machine ran `git` in the
 * project's checkout. Nothing fetched that checkout, so it answered from
 * whatever the folder last happened to hold; and once a session runs in a
 * box, the branch is not in that folder at all.
 *
 * ✏ 2026-10-06 (#186): the `git` version is gone. Its last caller was
 * `timone status`, which no longer reads a list of pieces.
 *
 * A file that is not there answers undefined. A forge that cannot be reached
 * **throws**, and `readBreakdown` turns that into `malformed` with the reason
 * on it, which is a state the poll loop already reports rather than one it
 * mistakes for an absent breakdown.
 */
export function fromForgeDefaultBranch(
  adapter: {
    readBranches: (
      project: TicketingProject,
      branch?: string,
    ) => Promise<{ defaultBranch: string }>;
    readFile: (
      project: TicketingProject,
      branch: string,
      path: string,
    ) => Promise<string | undefined>;
  },
  project: TicketingProject,
): BreakdownSource {
  return async (path) => {
    const { defaultBranch } = await adapter.readBranches(project);
    return adapter.readFile(project, defaultBranch, path);
  };
}

/**
 * Read a ticket's breakdown out of a project, from wherever `source` looks.
 *
 * **It returns an answer; it never throws.** The poll loop asks this of every
 * marked ticket on every cycle, and a project with no breakdown yet — or one
 * whose file somebody hand-edited into nonsense — is an ordinary state of the
 * world, not an exception. An exception here would take the whole project's
 * poll turn down with it.
 *
 * Every arm carries the path it looked at, so a log line or a ticket comment
 * can say *which* file, on a machine the reader is not sitting at. The path is
 * the repository-relative one, because that is what identifies the file
 * whichever branch it was read from.
 */
export async function readBreakdown(
  ticket: number,
  source: BreakdownSource,
): Promise<BreakdownRead> {
  const path = breakdownPath(ticket);

  let text: string | undefined;
  try {
    text = await source(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "malformed", path, reason };
  }
  return breakdownFrom(path, text);
}

/** Turn whatever a source answered into a {@link BreakdownRead}. */
function breakdownFrom(path: string, text: string | undefined): BreakdownRead {
  if (text === undefined) return { kind: "absent", path };

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
    ...breakdown.chunks.flatMap((chunk, index) => [
      `${index + 1}. **${chunk.title}** — ${chunk.delivers}`,
      ...(chunk.needsLine === undefined ? [] : [`   - Needs: ${chunk.needsLine}`]),
    ]),
    "",
  ];
  return lines.join("\n");
}



/**
 * The order the pieces are built in, read from their `Needs:` lines: either
 * clear — what each piece directly needs, and the same said in plain words —
 * or unclear, with a sentence saying which line could not be read.
 *
 * `needs[i]` is what piece `i + 1` directly needs, ascending. Only the direct
 * needs: a piece needing 2 and 3 waits for those two, not also for what they
 * need in turn.
 */
export type PiecesOrder =
  | { kind: "clear"; needs: number[][]; words: string }
  | { kind: "unclear"; reason: string };

/**
 * Read the order the pieces of a breakdown are built in. Pure.
 *
 * Each `Needs:` line is read from its first sentence only, so a writer can add
 * a second one explaining the first. A piece with no line needs the piece just
 * above it, and piece 1 with no line needs nothing: that is what every list
 * written before the line existed means.
 */
export function orderOf(breakdown: ParsedBreakdown): PiecesOrder {
  const count = breakdown.chunks.length;
  const needs: number[][] = [];
  for (const [index, chunk] of breakdown.chunks.entries()) {
    const piece = index + 1;
    if (chunk.needsLine === undefined) {
      needs.push(piece === 1 ? [] : [piece - 1]);
      continue;
    }

    const read = readNeedsLine(piece, chunk.needsLine, count);
    if ("reason" in read) return { kind: "unclear", reason: read.reason };
    needs.push(read.needs);
  }
  return { kind: "clear", needs, words: orderInWords(needs) };
}

/**
 * The pieces one `Needs:` line names, or why it cannot be read. The reason
 * names the piece and quotes the line, for the person who has to go and
 * correct the list.
 */
function readNeedsLine(
  piece: number,
  line: string,
  count: number,
): { needs: number[] } | { reason: string } {
  const about = `piece ${piece}'s Needs: line "${line}"`;
  const needs = needsIn(firstSentence(line));
  if (needs === undefined) {
    return {
      reason: `${about} names no piece — write the numbers of the pieces it needs, or "nothing"`,
    };
  }
  const missing = needs.find((need) => need < 1 || need > count);
  if (missing !== undefined) {
    return {
      reason: `${about} names piece ${missing}, which is not in the list — the list has ${count} pieces`,
    };
  }
  if (needs.includes(piece)) {
    return {
      reason: `${about} names piece ${piece} itself — a piece can only need pieces above it`,
    };
  }
  const later = needs.find((need) => need > piece);
  if (later !== undefined) {
    return {
      reason: `${about} names piece ${later}, which comes after it — a piece can only need pieces above it`,
    };
  }
  return { needs };
}

/**
 * Say an order in plain words: "1, then 2 and 3 together, then 4."
 *
 * Exported on its own because the ticket and the step tickets say the same
 * order, and must say it the same way.
 */
export function orderInWords(needs: number[][]): string {
  // A piece alone in its group needs nothing and is needed by nothing, and
  // says so — unless it is the whole list, which has no others to name.
  const groups = groupsOf(needs);
  return groups
    .map((group) =>
      group.length === 1 && groups.length > 1
        ? `${group[0]} needs none of the others.`
        : groupInWords(group, needs),
    )
    .join(" ");
}

/**
 * The pieces split into groups that `Needs:` lines connect, each group's
 * pieces ascending and the groups in the order of their lowest piece.
 */
function groupsOf(needs: number[][]): number[][] {
  // Each piece starts as its own group; every need joins two groups into one.
  const groupOf = needs.map((_, index) => index + 1);
  const root = (piece: number): number => {
    let at = piece;
    while (groupOf[at - 1] !== at) at = groupOf[at - 1] ?? at;
    return at;
  };
  needs.forEach((direct, index) => {
    for (const piece of direct) groupOf[root(index + 1) - 1] = root(piece);
  });

  const groups = new Map<number, number[]>();
  needs.forEach((_, index) => {
    const key = root(index + 1);
    groups.set(key, [...(groups.get(key) ?? []), index + 1]);
  });
  return [...groups.values()].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
}

/**
 * One group in words, by level: a piece that needs nothing is on level 0, any
 * other piece one level above the highest piece it needs.
 */
function groupInWords(group: number[], needs: number[][]): string {
  const levelOf = new Map<number, number>();
  const levels: number[][] = [];
  for (const piece of group) {
    const direct = needs[piece - 1] ?? [];
    const level =
      direct.length === 0
        ? 0
        : 1 + Math.max(...direct.map((need) => levelOf.get(need) ?? 0));
    levelOf.set(piece, level);
    (levels[level] ??= []).push(piece);
  }

  // The levels alone would say 4 waits for 2 and 3 when it needs only 2, so
  // such a piece gets its own sentence naming what it does wait for.
  const waits = group
    .filter((piece) => {
      const level = levelOf.get(piece) ?? 0;
      const direct = needs[piece - 1] ?? [];
      return (
        level > 0 &&
        !(levels[level - 1] ?? []).every((before) => direct.includes(before))
      );
    })
    .map((piece) => `${piece} waits only for ${listed(needs[piece - 1] ?? [])}.`);

  return [`${levels.map(saidTogether).join(", then ")}.`, ...waits].join(" ");
}

/** "3", "2 and 3 together", "2, 3 and 4 together". */
function saidTogether(pieces: number[]): string {
  return pieces.length === 1 ? String(pieces[0]) : `${listed(pieces)} together`;
}

/** "3", "2 and 3", "2, 3 and 4". */
function listed(pieces: number[]): string {
  const last = pieces[pieces.length - 1];
  return pieces.length === 1
    ? String(last)
    : `${pieces.slice(0, -1).join(", ")} and ${last}`;
}

/** The text up to the first full stop that ends a sentence. */
function firstSentence(text: string): string {
  return text.split(/\.(?:\s|$)/)[0] ?? "";
}

/**
 * The pieces a `Needs:` sentence names: none when it says "nothing" or
 * "none…", otherwise every whole number in it. Undefined when it does
 * neither, because reading that as "nothing" would be a guess.
 */
function needsIn(sentence: string): number[] | undefined {
  if (/^\s*(?:nothing|none)\b/i.test(sentence)) return [];
  const numbers = numbersIn(sentence);
  return numbers.length === 0 ? undefined : numbers;
}

/** Every whole number in a sentence, ascending, each once. */
function numbersIn(sentence: string): number[] {
  const numbers = (sentence.match(/\d+/g) ?? []).map(Number);
  return [...new Set(numbers)].sort((a, b) => a - b);
}

/** `**Order:** <words>`, anywhere in the file, the bold optional. */
const ORDER_LINE = /^\s*(?:\*\*|__)?Order:(?:\*\*|__)?\s*(.*?)\s*$/m;

/** What {@link checkOrderLine} found. */
export type OrderLineCheck =
  | { kind: "ok"; words: string }
  | { kind: "problem"; problem: string };

/**
 * Check a list's `**Order:**` line against what its `Needs:` lines say. Pure.
 *
 * The person who writes a list also writes its order in words, by hand, and
 * nothing else compares the two: a reader trusts the line, the step tickets
 * follow the `Needs:` lines. So the session that writes a list runs this
 * before it commits, and a line that disagrees is refused rather than shown.
 *
 * Each problem is one plain sentence that says what to change. Comparing
 * ignores the spaces at the ends of the line and one final full stop, which
 * a person may leave off without saying a different order.
 */
export function checkOrderLine(text: string): OrderLineCheck {
  const parsed = parseBreakdown(text);
  if ("kind" in parsed) {
    return {
      kind: "problem",
      problem: `The list of pieces cannot be read: ${parsed.reason}.`,
    };
  }
  const order = orderOf(parsed);
  if (order.kind === "unclear") {
    return {
      kind: "problem",
      problem: `The list of pieces does not say clearly what each piece needs: ${order.reason}.`,
    };
  }

  const line = ORDER_LINE.exec(text);
  if (line === null) {
    return {
      kind: "problem",
      problem:
        "The list of pieces has no **Order:** line. " +
        `Add this line under the list: **Order:** ${order.words}`,
    };
  }

  const says = line[1] ?? "";
  if (withoutFinalStop(says) !== withoutFinalStop(order.words)) {
    return {
      kind: "problem",
      problem:
        `The **Order:** line says "${says}", but the Needs: lines say ` +
        `"${order.words}". Change the line to: **Order:** ${order.words}`,
    };
  }
  return { kind: "ok", words: order.words };
}

/**
 * An order without the spaces at its ends and one final full stop, so that
 * "1, then 2" and "1, then 2. " count as the same order.
 */
function withoutFinalStop(order: string): string {
  return order.trim().replace(/\.$/, "").trimEnd();
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
