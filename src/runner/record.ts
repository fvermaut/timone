import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

import { PIPELINE_STAGES } from "../daemon/pipeline.js";

/**
 * The run record: what the machine writes down about a ticket's runs as they
 * go — each step that ran, each decision of the runner and its reason, each
 * departure, and the cost so far.
 *
 * **Written by the machine, never by the runner.** The departure list on the
 * pull request and the spending limit are both worked out from this file. If
 * the runner wrote it, the runner could leave out the step it skipped or the
 * money it spent, and the two checks that exist to catch that would read its
 * own account of itself.
 *
 * **One file per ticket, not per run.** The limit is counted across every run
 * of a ticket, so the entries that decide it have to sit together. Each entry
 * that belongs to one run carries that run's id, and a reader that wants one
 * run filters on it.
 *
 * **One JSON object per line, appended.** An entry is never rewritten, so a
 * crash can at worst cut the last line short, and {@link readRecord} names
 * that line rather than losing the file.
 */

/** When the entry was written, as an ISO-8601 timestamp. */
const at = z.string();

/** The run an entry belongs to, in the form `project#ticket/seq`. */
const runId = z.string().min(1);

/** A session's cost in dollars, as the SDK reports it. Never rounded here. */
const costUsd = z.number().nonnegative();

const stage = z.enum([...PIPELINE_STAGES]);

/** The two things a named person approves: the requirements, or the list of pieces. */
const approved = z.enum(["requirements", "pieces"]);

/**
 * Every kind of entry the record holds. The schema is the type: nothing is
 * read from the file without passing it, and nothing is written that does
 * not.
 */
export const recordEntrySchema = z.discriminatedUnion("kind", [
  /** The runner was started, and the events that started it. */
  z.strictObject({
    kind: z.literal("woke"),
    at,
    runId,
    events: z.array(z.string()),
  }),
  /** The runner's own session finished, and what it cost. */
  z.strictObject({
    kind: z.literal("runner-ended"),
    at,
    runId,
    ok: z.boolean(),
    costUsd,
    error: z.string().optional(),
  }),
  /**
   * The planner decided whether this run may build now (ADR-0065 D2): `build`
   * or `hold`, with its reason. Kept for history; the ledger holds the
   * decision the machine acts on. `waitsFor` holds the tickets a hold waits
   * for, and `onComment` the named person's comment a decision was taken on.
   * The decision's kind is `decision`, since `kind` names the entry.
   */
  z.strictObject({
    kind: z.literal("planner-decision"),
    at,
    runId,
    decision: z.enum(["build", "hold"]),
    reason: z.string(),
    waitsFor: z.array(z.number().int().positive()).optional(),
    onComment: z.strictObject({ by: z.string(), at: z.string() }).optional(),
  }),
  /** A planner session for this run finished, and what it cost (ADR-0065 D1). */
  z.strictObject({
    kind: z.literal("planner-ended"),
    at,
    runId,
    ok: z.boolean(),
    costUsd,
    error: z.string().optional(),
  }),
  /** What the runner decided, and the reason it gave. */
  z.strictObject({
    kind: z.literal("decision"),
    at,
    runId,
    action: z.string(),
    reason: z.string(),
    detail: z.string().optional(),
  }),
  /**
   * A session for one step of the work was started. `records` is set on the
   * short session that writes an approval into its file: it has the stage
   * of the step that wrote the file, but it is not that step running again.
   */
  z.strictObject({
    kind: z.literal("step-started"),
    at,
    runId,
    stage,
    sessionId: z.string(),
    instructions: z.string().optional(),
    records: approved.optional(),
  }),
  /** That session finished, and what it cost. */
  z.strictObject({
    kind: z.literal("step-ended"),
    at,
    runId,
    stage,
    sessionId: z.string(),
    ok: z.boolean(),
    costUsd,
    error: z.string().optional(),
    stoppedBy: z.string().optional(),
  }),
  /**
   * The runner chose to leave out steps of the written order. `skipped`
   * holds the ids of those steps; the reason is optional because a missing
   * reason is still a departure to list, not a line to refuse.
   */
  z.strictObject({
    kind: z.literal("departure"),
    at,
    runId,
    skipped: z.array(z.string()).min(1),
    reason: z.string().optional(),
  }),
  /** A named person approved the requirements or the list of pieces. */
  z.strictObject({
    kind: z.literal("approval"),
    at,
    runId,
    what: approved,
    by: z.string(),
    commentAt: z.string(),
  }),
  /** The ticket reached its spending limit, so no session was started. */
  z.strictObject({
    kind: z.literal("limit-reached"),
    at,
    spentUsd: z.number().nonnegative(),
  }),
  /** A named person said "continue", which allows another full limit. */
  z.strictObject({
    kind: z.literal("limit-raised"),
    at,
    by: z.string(),
    commentAt: z.string(),
  }),
  /** Comments on a thread up to this time have been read. */
  z.strictObject({
    kind: z.literal("seen"),
    at,
    thread: z.string(),
    until: z.string(),
  }),
  /** A person has been told about something, so it is not said twice. */
  z.strictObject({
    kind: z.literal("notice"),
    at,
    about: z.string(),
  }),
]);

export type RecordEntry = z.infer<typeof recordEntrySchema>;

/**
 * Whether `entry` starts a step of the written order: a session started at a
 * stage, but not the short session that writes an approval into its file.
 *
 * **That session is not its stage's step running again** (40v). It has the
 * stage of the step that wrote the file, and it starts after the approval,
 * which comes later in the order. Counted as a step, it made every run that
 * recorded an approval list that step as run out of order.
 */
export function startsAStep(
  entry: RecordEntry,
): entry is Extract<RecordEntry, { kind: "step-started" }> {
  return entry.kind === "step-started" && entry.records === undefined;
}

/** Where a ticket's record lives, relative to the timone root. */
function recordPath(project: string, ticket: number): string {
  return join(".timone", "records", project, `${ticket}.jsonl`);
}

/**
 * A record that could not be read, and the line that stopped it. `line`
 * counts from 1, as an editor does, so a person can go straight to it.
 */
export interface RecordError {
  line: number;
  message: string;
}

/**
 * Add one entry to the end of a ticket's record.
 *
 * The entry is parsed before it is written. A caller holding a typed entry
 * can still hand over extra fields, since TypeScript only checks those on a
 * fresh literal; parsing refuses them here, so the file never holds a line
 * {@link readRecord} would then reject. A refusal is a bug in the caller, so
 * it throws.
 */
export function appendEntry(
  dir: string,
  project: string,
  ticket: number,
  entry: RecordEntry,
): void {
  const path = join(dir, recordPath(project, ticket));
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(recordEntrySchema.parse(entry))}\n`);
}

/**
 * Every entry of a ticket's record, oldest first.
 *
 * **A bad line fails the whole read.** The limit and the departure list are
 * sums and absences: skipping a line would quietly drop a cost or hide a
 * step, and both checks exist to stop exactly that. So the caller gets the
 * line number instead, and a person can mend the file.
 *
 * A ticket with no file yet has simply had nothing written about it, so it
 * reads as an empty record rather than an error.
 */
export function readRecord(
  dir: string,
  project: string,
  ticket: number,
): { ok: true; value: RecordEntry[] } | { ok: false; error: RecordError } {
  const path = recordPath(project, ticket);
  if (!existsSync(join(dir, path))) return { ok: true, value: [] };
  const lines = readFileSync(join(dir, path), "utf8").split("\n");
  const value: RecordEntry[] = [];
  for (const [index, line] of lines.entries()) {
    if (line === "") continue;
    const refuse = (why: string) => ({
      ok: false as const,
      error: {
        line: index + 1,
        message: `The run record ${path} cannot be read: line ${index + 1} ${why}.`,
      },
    });
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      return refuse("is not JSON");
    }
    const parsed = recordEntrySchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "the entry"}: ${issue.message}`)
        .join("; ");
      return refuse(`is not a record entry (${issues})`);
    }
    value.push(parsed.data);
  }
  return { ok: true, value };
}
