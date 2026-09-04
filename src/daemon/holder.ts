import { hostname } from "node:os";
import { z } from "zod";

/**
 * Who is holding something, in the words a refusal uses.
 *
 * One shape for the ledger lock and for a run
 * ([ADR-0049](../../doc/adr/0049-a-runs-proof-of-life-is-its-holder-and-its-wait-is-one-value.md)),
 * because two ideas of what holding something means is the fault that let a
 * takeover be reclaimed under a live conversation. The identity is recorded
 * rather than inferred: a refusal has to name the holder, since "something
 * else is using this" tells an operator nothing they can act on.
 */
export const holderSchema = z.strictObject({
  /**
   * This particular hold, so a holder only ever gives up its own. A process
   * whose hold was reclaimed must not release the reclaimer's on its way out
   * — that would hand the thing to a third writer silently.
   */
  token: z.string(),
  /** What is holding it: `timone daemon`, `timone takeover scratch-app#6`. */
  command: z.string(),
  /** The holder's process id, so the human can go and look for it. */
  pid: z.number().int(),
  /** When it took the hold. */
  since: z.string(),
  /**
   * When the holder last showed it was still there. Quiet for longer than the
   * staleness window makes a hold a *candidate* for reclaiming and nothing
   * more: what decides is whether the process is still running
   * ([ADR-0025](../../doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md)).
   */
  observedAt: z.string(),
  /**
   * The machine the holder is running on, when it recorded one.
   *
   * Optional, and its absence means *this* machine: every lock and every
   * ledger written before the field existed was written here. It is here so
   * {@link holderLiveness} can refuse to answer rather than guess — a pid
   * table says nothing about a pid on another host.
   */
  host: z.string().optional(),
});

export type Holder = z.infer<typeof holderSchema>;

/**
 * What can be said about the process behind a hold.
 *
 * **Three answers, not two.** `unknown` is not a shy `gone`: the caller reads
 * `gone` as permission to reclaim, so folding the two would let one machine
 * take another machine's live run away from it. Timone runs one daemon on one
 * machine today, and that is precisely why a wrong default here would go
 * unnoticed until the day it stops being true.
 */
export type Liveness = "alive" | "gone" | "unknown";

/** The two questions {@link holderLiveness} asks, injected so tests can answer them. */
export interface LivenessProbe {
  /**
   * Whether a pid exists on this machine. Injected, and defaulting to
   * {@link processIsRunning}, because a test cannot portably manufacture a
   * dead pid — every number it might pick is one the runner's machine may be
   * using — and a case left asserting against whatever the pid table happens
   * to hold asserts nothing.
   */
  processIsRunning?: (pid: number) => boolean;
  /** This machine's name. Injected for the same reason. */
  thisHost?: () => string;
}

/**
 * Whether the process behind a hold is still there — the one question a stale
 * hold is decided on
 * ([ADR-0025](../../doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md)).
 *
 * The recorded `command` is a label for a human, not an OS command line, so
 * there is nothing here to compare it against: pid reuse inside the staleness
 * window stays a bounded residual risk, as ADR-0025 records. It is the
 * caller's to refine, which is why the whole holder is passed rather than its
 * pid.
 */
export function holderLiveness(
  holder: Holder,
  probe: LivenessProbe = {},
): Liveness {
  const here = (probe.thisHost ?? hostname)();
  if (holder.host !== undefined && holder.host !== here) return "unknown";
  const running = probe.processIsRunning ?? processIsRunning;
  return running(holder.pid) ? "alive" : "gone";
}

/**
 * Whether a pid exists on this machine.
 *
 * Signal `0` sends nothing; it asks the OS whether the pid exists and whether
 * this process may signal it. `EPERM` therefore means *alive and somebody
 * else's*, which is still alive — reading it as death would let an
 * unprivileged rival break a root daemon's hold.
 */
function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return codeOf(error) === "EPERM";
  }
}

/**
 * Whether a hold may be treated as still held — the boolean the ledger lock
 * has always asked for, in terms of {@link holderLiveness}.
 *
 * `unknown` answers **true**, and that is the whole reason this is a function
 * rather than a comparison at each call site. The lock breaks a hold on one
 * piece of evidence and no other, so anything short of proof of death is a
 * holder that is still the holder.
 */
export function holderProcessIsAlive(holder: Holder): boolean {
  return holderLiveness(holder) !== "gone";
}

/** The `errno` label a Node system error carries, when it is one. */
function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** This machine's name, as a holder records it. */
export function thisHost(): string {
  return hostname();
}
