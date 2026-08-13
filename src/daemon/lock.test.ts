import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RunStore } from "./runs.js";
import {
  acquireStateLock,
  releaseHeldLocks,
  withStateLock,
  type LockHolder,
} from "./lock.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A state file path nobody has written yet, in its own temp directory. */
function tempStatePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-lock-"));
  tempDirs.push(dir);
  return join(dir, ".timone", "state.json");
}

/** Four progress intervals, the window the daemon already judges runs by. */
const STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * A stand-in for the machine's process table: pid → what that pid is running.
 *
 * Liveness is injected ([ADR-0025](../../doc/adr/0025-a-lock-holders-proof-of-life-is-its-process.md))
 * because a test cannot portably manufacture a dead pid: every number it might
 * pick is one the runner's own machine may be using, so an uninjected probe
 * would leave these cases asserting against whatever the pid table happens to
 * hold. A table the test writes is a world the lock can be asked about.
 *
 * The probe answers about the *holder*, not about the pid alone: a pid running
 * something other than what the lock recorded is a reused pid, not the holder.
 */
function livenessOf(table: Map<number, string>): (holder: LockHolder) => boolean {
  return (holder) => table.get(holder.pid) === holder.command;
}

/** The ledger's bytes and the instant it was last written. */
function ledgerSnapshot(statePath: string): {
  bytes: string;
  modifiedAtMs: number;
} {
  return {
    bytes: readFileSync(statePath, "utf8"),
    modifiedAtMs: statSync(statePath).mtimeMs,
  };
}

describe("the ledger's exclusive lock", () => {
  it("refuses a second acquisition while the first is held, naming the holder", () => {
    const statePath = tempStatePath();

    const first = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });
    expect(first.ok).toBe(true);

    const second = acquireStateLock({
      statePath,
      command: "timone takeover scratch-app#6",
      pid: 4299,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:30Z",
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.message).toContain("timone daemon");
    expect(second.error.message).toContain("4213");
  });

  it("gives the lock up when the work throws, not only when it returns", async () => {
    const statePath = tempStatePath();

    await expect(
      withStateLock(
        {
          statePath,
          command: "timone daemon",
          pid: 4213,
          staleAfterMs: STALE_AFTER_MS,
          now: () => "2026-08-13T10:00:00Z",
        },
        async () => {
          throw new Error("the cycle blew up");
        },
      ),
    ).rejects.toThrow("the cycle blew up");

    // The next process finds a free ledger: a lock that outlives the process
    // holding it is a new way to wedge a project, which is the fault phase 14
    // existed to remove.
    const next = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4300,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:05Z",
    });
    expect(next.ok).toBe(true);
  });

  it("gives the lock up when the work returns, and hands back what it returned", async () => {
    const statePath = tempStatePath();

    const outcome = await withStateLock(
      {
        statePath,
        command: "timone daemon",
        pid: 4213,
        staleAfterMs: STALE_AFTER_MS,
        now: () => "2026-08-13T10:00:00Z",
      },
      async () => 0,
    );

    expect(outcome).toEqual({ ok: true, value: 0 });
    const next = acquireStateLock({
      statePath,
      command: "timone retry scratch-app#6",
      pid: 4300,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:05Z",
    });
    expect(next.ok).toBe(true);
  });

  it("gives up what this process holds when the exit path asks, signals included", () => {
    const statePath = tempStatePath();
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });

    // What Ctrl-C runs: no `finally` of anyone's gets a chance.
    releaseHeldLocks();

    const next = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4300,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:05Z",
    });
    expect(next.ok).toBe(true);
  });

  it("reclaims a crashed holder's lock, and says whom it took it from", () => {
    const statePath = tempStatePath();
    // A daemon takes the lock at ten o'clock and dies without releasing it.
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });

    // Ten minutes later, and pid 4213 is nowhere in the process table.
    const acquired = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4400,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:10:00Z",
      isHolderAlive: livenessOf(new Map()),
    });

    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.lock.holder.pid).toBe(4400);
    expect(acquired.lock.reclaimed?.pid).toBe(4213);
  });

  it("refuses a quiet holder whose process is still running, however long the silence", () => {
    // The case this slice exists to get right (ADR-0025). A daemon inside a
    // long session says nothing for the session's whole length, and a
    // suspended laptop silences it for as long as the lid is shut — neither is
    // death, and a lock broken on either puts two writers on the ledger. Same
    // holder, same ten minutes, same threshold as the case above: only the
    // process table differs, and it is what decides.
    const statePath = tempStatePath();
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });

    const refused = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4400,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:10:00Z",
      isHolderAlive: livenessOf(new Map([[4213, "timone daemon"]])),
    });

    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.holder?.pid).toBe(4213);
    expect(refused.error.message).toMatch(/still running/i);
  });

  it("reclaims from a pid the OS handed to something else", () => {
    // Identity is the pid together with what the lock recorded about the hold
    // (ADR-0025): a pid alone is reusable, so the question the lock asks is
    // never "does 4213 exist" but "is 4213 still the holder". Same table shape
    // as the case above, same pid alive in it — only what that pid is running
    // differs, and the holder is therefore gone.
    const statePath = tempStatePath();
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });

    const acquired = acquireStateLock({
      statePath,
      command: "timone takeover scratch-app#6",
      pid: 4400,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:10:00Z",
      isHolderAlive: livenessOf(new Map([[4213, "grep --colour=auto timone"]])),
    });

    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.lock.reclaimed?.pid).toBe(4213);
  });

  it("asks nothing about a holder still inside the quiet window", () => {
    // The window stays a cheap first filter and never becomes a second
    // authority (ADR-0025): a holder that touched its lock thirty seconds ago
    // is not a candidate, so nothing about its process is anybody's business.
    // Counted rather than argued — a probe consulted here would be a second
    // rule deciding the same question, and the two would drift.
    const statePath = tempStatePath();
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });

    let probes = 0;
    const refused = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4400,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:30Z",
      isHolderAlive: (holder) => {
        probes += 1;
        return livenessOf(new Map([[4213, "timone daemon"]]))(holder);
      },
    });

    expect(refused.ok).toBe(false);
    expect(probes).toBe(0);
  });

  it("writes nothing to the ledger on any path through acquisition", () => {
    // The assertion this amendment exists for (ADR-0025). The superseded
    // design gated the reclaim on `RunStore.witness`, which ends in
    // `persist()` — so asking for the lock wrote the very file the lock
    // protects, and a *refused* process mutated the ledger it was refused.
    //
    // A real ledger, with a real run in it, because "unchanged" is trivially
    // true of a file that does not exist.
    const statePath = tempStatePath();
    const store = RunStore.open(statePath, { now: () => "2026-08-13T09:00:00Z" });
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    const before = ledgerSnapshot(statePath);
    expect(before.bytes.length).toBeGreaterThan(0);

    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:00Z",
    });

    // A refusal — the path that used to write.
    const refused = acquireStateLock({
      statePath,
      command: "timone retry scratch-app#6",
      pid: 4300,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:00:30Z",
      isHolderAlive: livenessOf(new Map([[4213, "timone daemon"]])),
    });
    expect(refused.ok).toBe(false);
    expect(ledgerSnapshot(statePath)).toEqual(before);

    // And a reclaim, which writes the lock file and nothing else.
    const reclaimed = acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4400,
      staleAfterMs: STALE_AFTER_MS,
      now: () => "2026-08-13T10:10:00Z",
      isHolderAlive: livenessOf(new Map()),
    });
    expect(reclaimed.ok).toBe(true);
    expect(ledgerSnapshot(statePath)).toEqual(before);
  });
});
