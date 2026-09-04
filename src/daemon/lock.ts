import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

import { holderProcessIsAlive, holderSchema, type Holder } from "./holder.js";

/**
 * Who holds the ledger. One shape for every hold in Timone, and the lock's
 * copy is the one that moved: {@link Holder} is `holder.ts`'s
 * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)),
 * and the name is kept because a lock's holder is what every refusal in here
 * calls it.
 */
export type LockHolder = Holder;

/** A lock this process is holding. */
export interface StateLock {
  readonly holder: LockHolder;
  /**
   * Whom it was taken from, when it was taken from anyone. Present only on
   * the reclaim path, so a daemon that broke a dead holder's lock can say so
   * rather than doing it silently.
   */
  readonly reclaimed?: LockHolder;
  /**
   * Say the holder is still here. The daemon does this every cycle, which is
   * what keeps a long-lived holder out of the reclaim path.
   */
  touch(): void;
  /** Give the lock up. Idempotent, and leaves anyone else's lock alone. */
  release(): void;
}

/** Why an acquisition was refused, and by whom. */
export interface LockRefusal {
  /** One plain sentence, naming the holder. */
  message: string;
  /** The holder, when one could be read. */
  holder?: LockHolder;
}

export type Acquisition =
  | { ok: true; lock: StateLock }
  | { ok: false; error: LockRefusal };

export interface LockRequest {
  /** The state file this lock protects; the lock sits beside it. */
  statePath: string;
  /** What is asking, as the refusal will name it. */
  command: string;
  /** Silence longer than this makes a holder a candidate for reclaiming. */
  staleAfterMs: number;
  /**
   * Whether the holder is still there
   * ([ADR-0025](../../doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md)):
   * the one question a stale lock is decided on.
   *
   * Injected, and defaulting to {@link holderProcessIsAlive}, because a test
   * cannot portably manufacture a dead pid — every number it might pick is one
   * the runner's machine may be using — and a case left asserting against
   * whatever the pid table happens to hold asserts nothing.
   */
  isHolderAlive?: (holder: LockHolder) => boolean;
  /** Injected clock, so tests get deterministic timestamps. */
  now?: () => string;
  /** Injected process id, for the same reason. */
  pid?: number;
}

/**
 * Every lock this process is holding right now.
 *
 * A signal handler cannot run anybody's `finally`, and Ctrl-C is how every
 * operator stops the daemon — so the exit path needs one thing to call that
 * gives back whatever is held, without knowing who took it.
 */
const heldHere = new Set<StateLock>();

/** Give up every lock this process holds. For exit paths, signals included. */
export function releaseHeldLocks(): void {
  for (const lock of [...heldHere]) lock.release();
}

/** Where the lock for a given state file lives. */
export function stateLockPath(statePath: string): string {
  return `${statePath}.lock`;
}

/**
 * Take the ledger's exclusive lock, or refuse naming whoever has it
 * ([ADR-0023](../../doc/adr/0023-one-answer-one-session.md)).
 *
 * A refusal, never a wait and never a second copy: two processes mutating the
 * run ledger is how one written answer bought two agent sessions, and a queue
 * would make two daemons look supported.
 *
 * A crashed holder must not wedge a project either, so a held lock is broken
 * on one piece of evidence and no other: **the holder's process is gone**
 * ([ADR-0025](../../doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md)).
 * Whatever this does, it does to the *lock* file — the ledger beside it is
 * read by nothing here and written by nothing here, on any path, which is what
 * stops a refused process from mutating the file it was just refused.
 */
export function acquireStateLock(request: LockRequest): Acquisition {
  const now = request.now ?? (() => new Date().toISOString());
  const pid = request.pid ?? process.pid;
  const path = stateLockPath(request.statePath);

  const at = now();
  const mine: LockHolder = {
    token: randomUUID(),
    command: request.command,
    pid,
    since: at,
    observedAt: at,
  };

  const existing = readHolder(path);
  if (existing === "unreadable") {
    return {
      ok: false,
      error: {
        message:
          `The ledger lock at ${path} is there but cannot be read, so who ` +
          "holds it is unknown — delete it if no timone process is running.",
      },
    };
  }
  if (existing !== undefined) {
    const quietMs = Date.parse(at) - Date.parse(existing.observedAt);
    if (quietMs <= request.staleAfterMs) {
      return {
        ok: false,
        error: { message: heldMessage(existing), holder: existing },
      };
    }
    // Quiet is only a first filter. What decides is whether the holder's
    // process is still there: a daemon inside a long session, or one on a
    // laptop that was shut, has said nothing for an hour and is not dead.
    const alive = request.isHolderAlive ?? holderProcessIsAlive;
    if (alive(existing)) {
      return {
        ok: false,
        error: { message: stillRunningMessage(existing), holder: existing },
      };
    }
    write(path, mine);
    return { ok: true, lock: held(path, mine, now, existing) };
  }

  // Exclusive create, so two processes starting in the same instant cannot
  // both read an empty directory and both decide they are the writer.
  if (!create(path, mine)) {
    const winner = readHolder(path);
    if (winner === undefined || winner === "unreadable") {
      return {
        ok: false,
        error: {
          message: `The ledger lock at ${path} was taken as this one asked.`,
        },
      };
    }
    return { ok: false, error: { message: heldMessage(winner), holder: winner } };
  }
  return { ok: true, lock: held(path, mine, now) };
}

/**
 * Hold the lock for the length of `work`, and give it up either way.
 *
 * The release lives in a `finally` rather than after the call because the
 * path that matters is the one nobody tests: a cycle that throws leaves the
 * ledger locked by a process that is already gone, and the next daemon is
 * refused by a corpse.
 *
 * A refusal is returned — the caller decides what to say and what to exit
 * with. Anything `work` throws is re-thrown once the lock is back, because
 * that is a bug rather than an expected failure.
 */
export async function withStateLock<T>(
  request: LockRequest,
  work: (lock: StateLock) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: LockRefusal }> {
  const acquired = acquireStateLock(request);
  if (!acquired.ok) return acquired;
  try {
    return { ok: true, value: await work(acquired.lock) };
  } finally {
    acquired.lock.release();
  }
}

/** The handle a successful acquisition hands back. */
function held(
  path: string,
  holder: LockHolder,
  now: () => string,
  reclaimed?: LockHolder,
): StateLock {
  /** Whether this process still holds what is on disk. */
  const stillMine = (): boolean => {
    const current = readHolder(path);
    if (current === undefined || current === "unreadable") return false;
    return current.token === holder.token;
  };
  const lock: StateLock = {
    holder,
    ...(reclaimed === undefined ? {} : { reclaimed }),
    touch(): void {
      if (!stillMine()) return;
      write(path, { ...holder, observedAt: now() });
    },
    release(): void {
      heldHere.delete(lock);
      if (!stillMine()) return;
      rmSync(path, { force: true });
    },
  };
  heldHere.add(lock);
  return lock;
}

/**
 * Take the file if nobody has it: an exclusive create, which is the only
 * step in here that is genuinely atomic. False means somebody else won.
 */
function create(path: string, holder: LockHolder): boolean {
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, serialize(holder), { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (isAlreadyThere(error)) return false;
    throw error;
  }
}

/**
 * Replace the lock file's contents — a reclaim, or a holder saying it is
 * still here. Written through a temp file and renamed over, as the state file
 * is, so a reader never sees half a lock.
 */
function write(path: string, holder: LockHolder): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, serialize(holder), "utf8");
  renameSync(temp, path);
}

function serialize(holder: LockHolder): string {
  return `${JSON.stringify(holder, null, 2)}\n`;
}

/** Whether a failed create failed because the lock was already there. */
function isAlreadyThere(error: unknown): boolean {
  return codeOf(error) === "EEXIST";
}

/** The `errno` label a Node system error carries, when it is one. */
function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** One plain sentence: who holds the ledger, and since when. */
function heldMessage(holder: LockHolder): string {
  return (
    `${holder.command} (pid ${holder.pid}) is already working this ledger — ` +
    `it took it at ${holder.since}, so this one stops rather than becoming a ` +
    "second writer."
  );
}

/**
 * One plain sentence for the refusal that matters most: the holder went quiet,
 * and is nevertheless still there.
 *
 * Silence is not death (ADR-0025). A daemon inside a two-hour session says
 * nothing for two hours, and a suspended laptop silences its holder for as
 * long as the lid is shut — a lock broken on either puts two writers on the
 * ledger, which is the fault phase 19 exists to remove.
 */
function stillRunningMessage(holder: LockHolder): string {
  return (
    `${holder.command} (pid ${holder.pid}) has not touched this ledger since ` +
    `${holder.observedAt}, but its process is still running — a busy holder ` +
    "is still the holder, so this one stops rather than becoming a second writer."
  );
}

/**
 * The current holder, `undefined` when the lock is free, and `"unreadable"`
 * when there is a file that is not a lock. The third answer is not folded
 * into the second: overwriting a file it cannot read would be a process
 * deciding, on no evidence, that nobody is there.
 */
function readHolder(path: string): LockHolder | undefined | "unreadable" {
  if (!existsSync(path)) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return "unreadable";
  }
  const parsed = holderSchema.safeParse(data);
  return parsed.success ? parsed.data : "unreadable";
}
