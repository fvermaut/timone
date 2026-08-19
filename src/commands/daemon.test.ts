import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type {
  PullRequest,
  PullRequestThread,
  Ticket,
  TicketingAdapter,
} from "../adapters/ticketing.js";
import { RunStore } from "../daemon/runs.js";
import { pollOnce, type SessionSpawner } from "../daemon/poll.js";
import { stateLockPath } from "../daemon/lock.js";
import { runDaemon } from "./daemon.js";
import { enqueue } from "../daemon/requests.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A store whose clock the test sets by hand, instant by instant. */
function clockedStore(): {
  store: RunStore;
  set: (iso: string) => void;
  statePath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "timone-daemon-cmd-"));
  tempDirs.push(dir);
  const statePath = join(dir, ".timone", "state.json");
  let instant = "2026-08-06T10:00:00Z";
  return {
    store: RunStore.open(statePath, { now: () => instant }),
    set: (iso) => {
      instant = iso;
    },
    statePath,
  };
}

const manifest: Manifest = {
  projects: {
    "scratch-app": {
      repo_url: "https://github.com/fvermaut/scratch-app.git",
      path: "projects/scratch-app",
      stack: [],
      bindings: { ticketing: "github" },
    },
  },
};

/** An adapter that answers an empty ticket list and swallows comments. */
function quietAdapter(): TicketingAdapter {
  return {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [];
    },
    async getTicket(): Promise<never> {
      throw new Error("no ticket is read in this test");
    },
    async postComment(): Promise<void> {},
    async applyLabel(): Promise<void> {},
    async findPullRequest(): Promise<PullRequest | undefined> {
      return undefined;
    },
    async getPullRequestThread(): Promise<PullRequestThread> {
      throw new Error("no pull request exists in this test");
    },
    async postPullRequestComment(): Promise<void> {},
    async upsertPullRequestComment(): Promise<void> {},
    async upsertComment(): Promise<void> {},
    async listOpenTickets(): Promise<never[]> {
      return [];
    },
    async closeTicket(): Promise<void> {},
  };
}

const idleSpawner: SessionSpawner = {
  async spawn(): Promise<void> {},
};

/**
 * A root with no project checkouts under it, for the tests that are about the
 * lock and the cadence rather than about what a merge means. Nothing in them
 * reaches a breakdown, and a directory that does not exist is read as "this
 * ticket has no list of pieces" rather than throwing.
 */
const noCheckouts = "/nowhere";

describe("runDaemon — one writer, and it says who holds it", () => {
  it("refuses a second daemon while the first holds the ledger, naming the holder", async () => {
    const { store, statePath } = clockedStore();
    let releaseCycle = (): void => {};
    const held = new Promise<void>((done) => {
      releaseCycle = done;
    });
    // The first daemon is inside its cycle — the shape that produced two
    // sessions from one answer: a second `--once` typed while the first is
    // still blocked in a session.
    const blocking: TicketingAdapter = {
      ...quietAdapter(),
      async listMarkedTickets(): Promise<Ticket[]> {
        await held;
        return [];
      },
    };
    const first = runDaemon({
      manifest,
      store,
      statePath,
      root: noCheckouts,
      intervalMs: 60 * 1000,
      once: true,
      adapter: blocking,
      spawner: idleSpawner,
      log: () => {},
    });

    const said: string[] = [];
    const code = await runDaemon({
      manifest,
      store: RunStore.open(statePath),
      statePath,
      root: noCheckouts,
      intervalMs: 60 * 1000,
      once: true,
      adapter: quietAdapter(),
      spawner: idleSpawner,
      log: (line) => said.push(line),
    });

    expect(code).toBe(1);
    expect(said.join("\n")).toContain("timone daemon");
    expect(said.join("\n")).toContain(String(process.pid));

    releaseCycle();
    expect(await first).toBe(0);
  });

  it("leaves pollOnce untaken — a cycle driven directly holds no lock", async () => {
    // ADR-0023's consequence, guarded: the lock is on the process, not on the
    // function, so every test that drives a cycle by hand keeps working and
    // no unit had to learn about locking to keep passing.
    const { store, statePath } = clockedStore();
    const marked: TicketingAdapter = {
      ...quietAdapter(),
      async listMarkedTickets(): Promise<Ticket[]> {
        return [
          {
            number: 7,
            title: "typing in the box is fiddly on my phone",
            body: "the message box is hard to use on mobile",
            labels: ["timone"],
            url: "https://github.com/fvermaut/scratch-app/issues/7",
            author: "fvermaut",
            createdAt: "2026-08-06T09:00:00Z",
          },
        ];
      },
    };

    const result = await pollOnce({
      manifest,
      store,
      adapter: marked,
      spawner: idleSpawner,
      log: () => {},
    });

    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
    expect(existsSync(stateLockPath(statePath))).toBe(false);
  });
});

describe("runDaemon — the cadence it keeps is the cadence it judges by", () => {
  const FOUR_INTERVALS = 4 * 30 * 1000;

  /** A run of `scratch-app` that has been quiet since ten o'clock. */
  function quietRun(store: RunStore): void {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
  }

  /** One cycle, at `at`, with the loop told to poll every `intervalMs`. */
  async function cycle(
    store: RunStore,
    set: (iso: string) => void,
    at: string,
    intervalMs: number,
  ): Promise<void> {
    set(at);
    await runDaemon({
      manifest,
      store,
      root: noCheckouts,
      intervalMs,
      staleAfterMs: FOUR_INTERVALS,
      once: true,
      adapter: quietAdapter(),
      spawner: idleSpawner,
      log: () => {},
    });
  }

  it("reads a four-minute gap as an absence at a one-minute interval", async () => {
    const { store, set } = clockedStore();
    quietRun(store);

    await cycle(store, set, "2026-08-06T10:01:00Z", 60 * 1000);
    await cycle(store, set, "2026-08-06T10:05:00Z", 60 * 1000);

    // Twice a one-minute interval is two minutes; four is an absence, so the
    // quiet run gets its window back rather than being reclaimed.
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
  });

  it("reads the same gap as jitter at a five-minute interval", async () => {
    // The threshold is not a constant — it is twice whatever cadence the
    // daemon was actually told to keep, which is what passing `--interval`
    // through to the poll cycle buys.
    const { store, set } = clockedStore();
    quietRun(store);

    await cycle(store, set, "2026-08-06T10:01:00Z", 5 * 60 * 1000);
    await cycle(store, set, "2026-08-06T10:05:00Z", 5 * 60 * 1000);

    expect(store.get("scratch-app#7/1")?.status).toBe("failed");
  });
});

/**
 * Turn a fixture directory into something shaped like a clone: one commit on
 * `main`, and an `origin/HEAD` symref pointing at it. That pair is what
 * `fromDefaultBranch` resolves, so a fixture without it reads as a project
 * with no breakdown at all.
 */
function commitOnDefaultBranch(repoDir: string): void {
  const git = (...args: string[]): void => {
    execFileSync("git", args, {
      cwd: repoDir,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@example.com",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@example.com",
      },
    });
  };
  git("init", "-b", "main");
  git("add", ".");
  git("commit", "-m", "fixture");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
}

describe("runDaemon — the loop is told where the project checkouts are", () => {
  it("reaches a ticket's breakdown, so a mid-initiative merge does not close it", async () => {
    // The poll loop cannot answer "is there another piece of this to build?"
    // without a path to `projects/<name>/`, and this command is the only place
    // a real daemon's root is known. Wired wrongly, every multi-piece
    // initiative would be truncated at its first merge and nothing would say
    // so — so the assertion is on the observable end of the thread, not on the
    // field being passed.
    const { store, statePath } = clockedStore();
    const root = mkdtempSync(join(tmpdir(), "timone-daemon-root-"));
    tempDirs.push(root);
    const file = join(
      root,
      "projects",
      "scratch-app",
      "doc",
      "plans",
      "breakdowns",
      "ticket-07.md",
    );
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      [
        "# Breakdown",
        "",
        "**Status:** Approved by fvermaut 2026-08-15 — 2 pieces",
        "",
        "1. **The ledger learns chunks** — a run carries its sequence number.",
        "2. **The next chunk opens** — a merged pull request opens the next one.",
        "",
      ].join("\n"),
      "utf8",
    );
    // ✏ A real clone since phase 27, because the loop reads the approved list
    // off the default branch rather than off whatever is checked out. Writing
    // the file alone used to be enough and is exactly what stopped being
    // enough — a session leaves this checkout on its own work branch, and the
    // list of pieces must not depend on that.
    commitOnDefaultBranch(join(root, "projects", "scratch-app"));

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/7-slow");
    store.recordPullRequest(run.id, 9);
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "delivery",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    const marked: Ticket = {
      number: 7,
      title: "typing in the box is fiddly on my phone",
      body: "the message box is hard to use on mobile",
      labels: ["timone"],
      url: "https://github.com/fvermaut/scratch-app/issues/7",
      author: "fvermaut",
      createdAt: "2026-08-06T09:00:00Z",
    };
    const closed: string[] = [];
    const merged: TicketingAdapter = {
      ...quietAdapter(),
      async listMarkedTickets(): Promise<Ticket[]> {
        return [marked];
      },
      async getTicket() {
        return { ...marked, comments: [] };
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return {
          number: 9,
          title: "piece one",
          url: "https://github.com/fvermaut/scratch-app/pull/9",
          state: "merged",
          headSha: "aaaaaaa",
          comments: [],
        };
      },
      async closeTicket(_project, number, reason): Promise<void> {
        closed.push(`${number}:${reason}`);
      },
    };

    await runDaemon({
      manifest,
      store,
      statePath,
      root,
      intervalMs: 60 * 1000,
      once: true,
      adapter: merged,
      spawner: idleSpawner,
      log: () => {},
    });

    expect(store.get("scratch-app#7/1")?.status).toBe("done");
    expect(closed).toEqual([]);
  });
});

describe("runDaemon — the requests waiting beside the ledger it holds", () => {
  /**
   * The wiring, end to end: `runDaemon` resolves one state path, takes the
   * lock on it, and must hand that same path to the cycle — otherwise the
   * queue is written by commands and read by nobody
   * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
   */
  it("carries out a request left beside the ledger", async () => {
    const { store, statePath } = clockedStore();
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.fail(run.id, "the execution stage stopped");
    enqueue(statePath, { kind: "cancel", project: "scratch-app", ticket: 31 });

    const said: string[] = [];
    const code = await runDaemon({
      manifest,
      store,
      statePath,
      root: noCheckouts,
      intervalMs: 60 * 1000,
      once: true,
      adapter: quietAdapter(),
      spawner: idleSpawner,
      log: (line) => said.push(line),
    });

    expect(code).toBe(0);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(said.join("\n")).toContain("apply  cancel scratch-app#31");
  });
});
