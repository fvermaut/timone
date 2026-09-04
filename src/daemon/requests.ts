import {
  existsSync,
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

import { holderSchema } from "./holder.js";

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
    /**
     * The terminal that will be holding the run, so the daemon claims it on
     * that terminal's behalf rather than on its own
     * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)
     * D1). Without it the run would record the daemon as holder, and the
     * daemon's own sweep would then read a live conversation as its own work
     * and reclaim it — timone#63.
     *
     * Optional, because a request written before this field existed is still
     * a request. One without it claims as it always did.
     */
    holder: holderSchema.optional(),
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

/** How long a command watches for its request to be carried out. */
export interface WaitOptions {
  /** How often to look. */
  intervalMs?: number;
  /**
   * How long to look before taking the request back. See
   * {@link WATCH_BOUND_MS} for what it has to cover and why it cannot cover
   * all of it.
   */
  boundMs?: number;
  /** Injected so a test does not wait a real minute to watch a timeout. */
  sleep?: (ms: number) => Promise<void>;
}

const WATCH_INTERVAL_MS = 1_000;

/**
 * How long a command waits for the daemon before taking its request back.
 *
 * **It was 75s on the words "one poll interval plus a margin", and that was
 * wrong** (ADR-0049 D3). The daemon sleeps its interval *after* a cycle and
 * reads requests at the start of the next one, so a request left just after a
 * read waits out the rest of that cycle **and then** a full interval. Cycles
 * on the trading app measured 29–33 seconds, which puts the real wait past 90
 * seconds — so the old bound gave up while the daemon was still coming, and
 * left the request behind to be applied minutes later. That is timone#78: the
 * run was handed to a terminal that had gone.
 *
 * **No bound can cover all of it, and pretending otherwise is the other
 * mistake.** A cycle awaits whatever it is running, which can be an hour. So
 * this covers the ordinary case — a full interval plus a cycle of about
 * ninety seconds — and what makes giving up safe is not the number: it is
 * that the request is **withdrawn** when the bound passes, so nothing is left
 * on disk for a later cycle to act on.
 */
export const WATCH_BOUND_MS = 150_000;

/**
 * Wait for the daemon to deal with one request, and answer whether it did.
 *
 * **A request being gone is the signal**, not the effect it had: the daemon
 * settles a request whether or not it could carry it out, so this answers
 * "has it been dealt with?" and leaves "what happened?" to the caller, who
 * reads the ledger for it. One question each, and neither guesses the other's.
 *
 * **The bound is the point.** A command that waits for ever on a daemon that
 * has died is the silent hang this whole path exists to avoid, so the wait
 * ends and says so.
 */
export async function waitUntilSettled(
  path: string,
  options: WaitOptions = {},
): Promise<boolean> {
  const intervalMs = options.intervalMs ?? WATCH_INTERVAL_MS;
  const boundMs = options.boundMs ?? WATCH_BOUND_MS;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));

  for (let waited = 0; waited < boundMs; waited += intervalMs) {
    if (!existsSync(path)) return true;
    await sleep(intervalMs);
  }
  return !existsSync(path);
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
