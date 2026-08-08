import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type {
  PullRequest,
  PullRequestThread,
  Ticket,
  TicketingAdapter,
} from "../adapters/ticketing.js";
import { RunStore } from "../daemon/runs.js";
import type { SessionSpawner } from "../daemon/poll.js";
import { runDaemon } from "./daemon.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A store whose clock the test sets by hand, instant by instant. */
function clockedStore(): { store: RunStore; set: (iso: string) => void } {
  const dir = mkdtempSync(join(tmpdir(), "timone-daemon-cmd-"));
  tempDirs.push(dir);
  let instant = "2026-08-06T10:00:00Z";
  return {
    store: RunStore.open(join(dir, ".timone", "state.json"), {
      now: () => instant,
    }),
    set: (iso) => {
      instant = iso;
    },
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
    async closeTicket(): Promise<void> {},
  };
}

const idleSpawner: SessionSpawner = {
  async spawn(): Promise<void> {},
};

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
    expect(store.get("scratch-app#7")?.status).toBe("active");
  });

  it("reads the same gap as jitter at a five-minute interval", async () => {
    // The threshold is not a constant — it is twice whatever cadence the
    // daemon was actually told to keep, which is what passing `--interval`
    // through to the poll cycle buys.
    const { store, set } = clockedStore();
    quietRun(store);

    await cycle(store, set, "2026-08-06T10:01:00Z", 5 * 60 * 1000);
    await cycle(store, set, "2026-08-06T10:05:00Z", 5 * 60 * 1000);

    expect(store.get("scratch-app#7")?.status).toBe("failed");
  });
});
