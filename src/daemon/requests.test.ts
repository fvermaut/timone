import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { acquireStateLock } from "./lock.js";
import { enqueue, pending, requestsDir, settle } from "./requests.js";

/**
 * Temp directories made by these tests, removed together afterwards. Same
 * shape as `runs.test.ts` uses, so a reader moving between the two files is
 * not learning a second convention.
 */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A state path under a fresh temp root — the file itself need not exist. */
function statePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "timone-requests-"));
  tempDirs.push(dir);
  return join(dir, ".timone", "state.json");
}

/** A clock frozen at one instant, so same-millisecond writes are the default. */
function frozen(at = "2026-08-16T12:00:00.000Z"): () => string {
  return () => at;
}

describe("requestsDir", () => {
  it("sits beside the state file", () => {
    const path = statePath();
    expect(requestsDir(path)).toBe(join(path, "..", "requests"));
  });
});

describe("enqueue", () => {
  it("writes a readable request and returns where it put it", () => {
    const path = statePath();

    const file = enqueue(
      path,
      { kind: "retry", project: "scratch-app", ticket: 31 },
      { now: frozen(), by: "fvermaut" },
    );

    expect(readFileSync(file, "utf8")).toContain("scratch-app");
    const { requests } = pending(path);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toEqual({
      kind: "retry",
      project: "scratch-app",
      ticket: 31,
    });
    expect(requests[0]?.askedBy).toBe("fvermaut");
    expect(requests[0]?.askedAt).toBe("2026-08-16T12:00:00.000Z");
  });

  /**
   * The property the whole of ADR-0032 rests on. An implementation that
   * "just takes the lock quickly" would pass every other test in this file,
   * so this one holds a lock whose pid is genuinely alive — this process —
   * and asserts the enqueue goes through anyway.
   */
  it("needs no lock, even one a live process is holding", () => {
    const path = statePath();
    const held = acquireStateLock({
      statePath: path,
      command: "timone daemon",
      staleAfterMs: 120_000,
    });
    expect(held.ok).toBe(true);

    const file = enqueue(path, { kind: "cancel", project: "scratch-app", ticket: 31 });

    expect(readFileSync(file, "utf8")).toContain("cancel");
    expect(pending(path).requests).toHaveLength(1);
    if (held.ok) held.lock.release();
  });

  it("keeps both requests written in the same millisecond, in write order", () => {
    const path = statePath();
    const now = frozen();

    enqueue(path, { kind: "retry", project: "scratch-app", ticket: 31 }, { now });
    enqueue(path, { kind: "cancel", project: "scratch-app", ticket: 32 }, { now });

    const { requests } = pending(path);
    expect(requests.map((request) => request.body.kind)).toEqual(["retry", "cancel"]);
  });

  it("orders requests by when they were asked", () => {
    const path = statePath();

    enqueue(
      path,
      { kind: "retry", project: "scratch-app", ticket: 1 },
      { now: frozen("2026-08-16T12:00:02.000Z") },
    );
    enqueue(
      path,
      { kind: "retry", project: "scratch-app", ticket: 2 },
      { now: frozen("2026-08-16T12:00:01.000Z") },
    );

    const { requests } = pending(path);
    expect(requests.map((request) => request.body.ticket)).toEqual([2, 1]);
  });
});

describe("pending", () => {
  it("answers nothing when nobody has ever asked for anything", () => {
    // The state every existing installation is in: no directory at all.
    expect(pending(statePath())).toEqual({ requests: [], unreadable: [] });
  });

  /**
   * One corrupt file must not stop the daemon reading the rest, and must not
   * be deleted behind the operator's back either: it is the only evidence of
   * whatever wrote it.
   */
  it("skips an unreadable request, names it, and leaves it on disk", () => {
    const path = statePath();
    enqueue(path, { kind: "retry", project: "scratch-app", ticket: 31 }, { now: frozen() });
    const corrupt = join(requestsDir(path), "2026-08-16T12-00-00-000Z-000000-dead.json");
    writeFileSync(corrupt, "{ this is not json", "utf8");

    const { requests, unreadable } = pending(path);

    expect(requests).toHaveLength(1);
    expect(unreadable).toEqual([corrupt]);
    expect(readFileSync(corrupt, "utf8")).toBe("{ this is not json");
  });

  it("treats a well-formed file with an unknown kind as unreadable", () => {
    const path = statePath();
    const wrong = join(requestsDir(path), "2026-08-16T12-00-00-000Z-000000-beef.json");
    enqueue(path, { kind: "retry", project: "scratch-app", ticket: 31 }, { now: frozen() });
    writeFileSync(wrong, JSON.stringify({ body: { kind: "explode" } }), "utf8");

    const { requests, unreadable } = pending(path);

    expect(requests).toHaveLength(1);
    expect(unreadable).toEqual([wrong]);
  });

  it("ignores anything that is not a request file", () => {
    const path = statePath();
    enqueue(path, { kind: "retry", project: "scratch-app", ticket: 31 }, { now: frozen() });
    writeFileSync(join(requestsDir(path), "README"), "not mine", "utf8");

    expect(pending(path).requests).toHaveLength(1);
    expect(pending(path).unreadable).toEqual([]);
  });
});

describe("settle", () => {
  it("removes exactly the one it is given", () => {
    const path = statePath();
    const now = frozen();
    const first = enqueue(path, { kind: "retry", project: "scratch-app", ticket: 1 }, { now });
    enqueue(path, { kind: "retry", project: "scratch-app", ticket: 2 }, { now });

    settle(first);

    const { requests } = pending(path);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.body.ticket).toBe(2);
    expect(readdirSync(requestsDir(path))).toHaveLength(1);
  });

  it("is content with a request somebody else already settled", () => {
    const path = statePath();
    const file = enqueue(path, { kind: "retry", project: "scratch-app", ticket: 1 });

    settle(file);

    expect(() => settle(file)).not.toThrow();
  });
});
