import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * What a human command asks the daemon to do
 * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
 *
 * A command that finds the ledger held by a **live** daemon cannot write it —
 * ADR-0023 gives the ledger exactly one writer and this decision keeps that
 * literally true — so it leaves the errand here instead and the daemon runs it
 * on its next cycle.
 *
 * **One file per request is the whole design.** Creating a file is not a
 * read-modify-write, so enqueuing needs no lock at all; every other property
 * of this module follows from that one and none of it may be traded away for
 * a tidier directory.
 */
const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("retry"),
    project: z.string().min(1),
    ticket: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("cancel"),
    project: z.string().min(1),
    ticket: z.number().int().positive(),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("claim-takeover"),
    project: z.string().min(1),
    ticket: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("release-takeover"),
    project: z.string().min(1),
    ticket: z.number().int().positive(),
    /**
     * How the conversation ended. What each of these means for the run is
     * 24d's to settle; what matters here is that the daemon can tell a
     * takeover that finished from one that was abandoned, because a claim
     * that outlives its session is phase 14's stuck run.
     */
    outcome: z.enum(["ended", "abandoned"]),
  }),
]);

/** The errand itself, without the envelope that says who asked for it. */
export type RequestBody = z.infer<typeof bodySchema>;

const envelopeSchema = z.object({
  /** When it was asked for. Requests are applied in this order. */
  askedAt: z.string().min(1),
  /**
   * Who asked. A request applied minutes later, by a different process, needs
   * to be attributable in the daemon's log and in any report about it.
   */
  askedBy: z.string().min(1),
  body: bodySchema,
});

/** A request found on disk, and where it was found. */
export interface QueuedRequest {
  /** The file it came from — what {@link settle} is given once it is applied. */
  path: string;
  askedAt: string;
  askedBy: string;
  body: RequestBody;
}

/** Everything waiting, and everything that could not be read. */
export interface PendingRequests {
  /** Readable requests, oldest first. */
  requests: QueuedRequest[];
  /**
   * Paths of files that are request-shaped and could not be understood. They
   * are reported rather than thrown on, so one corrupt file cannot stop the
   * daemon reading the rest — and they are left on disk, because the file is
   * the only evidence of whatever wrote it.
   */
  unreadable: string[];
}

/** Options for {@link enqueue}, both injected so tests are deterministic. */
export interface EnqueueOptions {
  now?: () => string;
  by?: string;
}

/**
 * Where a state file's requests live: beside it, never inside it. The only
 * place this path is spelled.
 */
export function requestsDir(statePath: string): string {
  return join(dirname(statePath), "requests");
}

/**
 * Leave a request for the daemon, and answer where it was put.
 *
 * **Takes no lock, and must never take one.** This is the property the whole
 * decision rests on: a command refused the ledger by a live holder still has
 * to be able to say what it wanted.
 */
export function enqueue(
  statePath: string,
  body: RequestBody,
  options: EnqueueOptions = {},
): string {
  const askedAt = (options.now ?? (() => new Date().toISOString()))();
  const askedBy = options.by ?? `pid ${process.pid}`;

  const dir = requestsDir(statePath);
  mkdirSync(dir, { recursive: true });

  const path = join(dir, fileName(dir, askedAt));
  // Atomic, exactly as `RunStore.persist` is: a reader that catches the file
  // half-written would count as unreadable and be reported as a corruption
  // that never happened.
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ askedAt, askedBy, body }, null, 2)}\n`, "utf8");
  renameSync(temp, path);

  return path;
}

/**
 * Every request waiting, oldest first, plus whatever could not be read.
 *
 * An absent directory is not a problem to report: it is the state of every
 * installation that has never had a request, which is all of them until the
 * first one.
 */
export function pending(statePath: string): PendingRequests {
  const dir = requestsDir(statePath);

  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return { requests: [], unreadable: [] };
  }

  const requests: QueuedRequest[] = [];
  const unreadable: string[] = [];

  // Sorted by name, which sorts by the instant in it and then by the counter
  // that separates requests written inside the same millisecond. See
  // `fileName`, where that ordering is built.
  for (const name of names.filter(isRequestFile).sort()) {
    const path = join(dir, name);
    const parsed = read(path);
    if (parsed === undefined) unreadable.push(path);
    else requests.push({ path, ...parsed });
  }

  return { requests, unreadable };
}

/**
 * Forget a request that has been applied. Content with a file that is already
 * gone: two readers settling one request is a race nobody needs to lose.
 */
export function settle(path: string): void {
  rmSync(path, { force: true });
}

/** Whether a directory entry is one of ours at all. */
function isRequestFile(name: string): boolean {
  return name.endsWith(".json");
}

function read(path: string): Omit<QueuedRequest, "path"> | undefined {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }

  const parsed = envelopeSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

/**
 * A name that sorts into write order and cannot collide.
 *
 * Three parts, each earning its place: the **instant**, so requests apply in
 * the order they were asked for; a **counter** of what is already there for
 * that instant, so two requests inside one millisecond keep their order; and a
 * **random suffix**, so two *processes* that computed the same counter both
 * survive rather than one overwriting the other. Order between those two is
 * arbitrary, which is the one thing here that is genuinely undecidable and is
 * also the one nobody needs.
 */
function fileName(dir: string, askedAt: string): string {
  const stamp = askedAt.replace(/[:.]/g, "-");
  let taken = 0;
  try {
    taken = readdirSync(dir).filter((name) => name.startsWith(`${stamp}-`)).length;
  } catch {
    taken = 0;
  }
  return `${stamp}-${String(taken).padStart(6, "0")}-${randomUUID().slice(0, 8)}.json`;
}
