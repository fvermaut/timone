import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type { Preview, PreviewAdapter } from "../adapters/preview.js";
import {
  MACHINE_MARKER,
  PREVIEW_MARKER,
  type PullRequest,
  type PullRequestThread,
  type Step,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import {
  noBranches,
  noFiles,
  noRunnerCalls,
  noMerges, noStepWrites } from "../adapters/ticketing.stubs.js";
import { HELD_LABEL, MAP_LABEL } from "./steps.js";
import {
  breakdownPath, fromWorkingTree,
  type SyncBreakdownSource,
} from "./breakdown.js";

/**
 * A fixture root and the breakdown source that reads it, together.
 *
 * The two must agree, and since 30d they are two separate values — a source
 * is built by whoever knows where to look, and the poll loop's production
 * default no longer knows about a directory at all. Spreading one helper is
 * what stops a test setting `root` here and reading a breakdown from
 * somewhere else.
 */
function breakdownIn(
  root: string,
  project = "scratch-app",
): { breakdownSource: SyncBreakdownSource } {
  // `join(root, "projects", project)` is what `checkoutOf` used to supply on
  // the caller's behalf, back when the loop was told a root. It is spelled
  // here because the production default resolves no directory at all now: it
  // reads the forge.
  return { breakdownSource: fromWorkingTree(join(root, "projects", project)) };
}

import { enqueue, pending, requestsDir } from "./requests.js";
import type { Holder } from "./holder.js";
import { RunStore, type Run } from "./runs.js";
import { pollOnce } from "./poll.js";
import { RunnerDriver, pullRequestEvent, type RunnerDriverDeps } from "../runner/driver.js";
import { RunningSteps, runnerActions } from "../runner/actions.js";
import type { WakeOptions } from "../runner/session.js";
import { appendEntry, readRecord, type RecordEntry } from "../runner/record.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A store over a fresh state file with a deterministic clock. */
function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-poll-"));
  tempDirs.push(dir);
  // One **second** per clock read, not one minute.
  //
  // It was minutes until phase 30's 30c, and that made every test in this
  // file quietly sensitive to how many times a cycle happens to ask the time:
  // adding one read anywhere pushed a three-cycle test past the two-minute
  // staleness window, and three tests failed on a reclaim nobody had changed.
  // The tests that are actually about time set their own instants, so
  // shortening the tick costs them nothing and stops an unrelated change from
  // looking like a regression.
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-02T10:00:${String(tick++).padStart(2, "0")}Z`,
  });
}

/**
 * A manifest naming `names`, each with fvermaut the one person who may
 * instruct it (ADR-0060 D6).
 */
function manifestWith(...names: string[]): Manifest {
  return {
    projects: Object.fromEntries(
      names.map((name) => [
        name,
        {
          repo_url: `https://github.com/fvermaut/${name}.git`,
          path: `projects/${name}`,
          stack: [],
          bindings: { ticketing: "github" as const },
          instructors: ["fvermaut"],
        },
      ]),
    ),
  };
}

/**
 * The same manifest with every project's introduction switch turned on.
 *
 * It is a transformer rather than a second builder so that it composes with
 * whichever builder a test already uses, and — more to the point — so that
 * `manifestWith` keeps saying what a manifest entry says when nobody has
 * thought about this: **nothing**. ADR-0024's switch defaults off, and a
 * default that every test fixture quietly opted into would be a default in
 * name only.
 */
function introducing(manifest: Manifest): Manifest {
  return {
    projects: Object.fromEntries(
      Object.entries(manifest.projects).map(([name, config]) => [
        name,
        { ...config, introduce_unmarked: true },
      ]),
    ),
  };
}

function ticket(number: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    number,
    title: `ticket ${number}`,
    body: "the page feels slow when I add many items",
    labels: ["timone"],
    url: `https://github.com/fvermaut/scratch-app/issues/${number}`,
    author: "fvermaut",
    createdAt: `2026-08-01T0${number}:00:00Z`,
    ...overrides,
  };
}

interface PostedComment {
  project: string;
  number: number;
  body: string;
}

/**
 * A fake ticketing adapter: `marked` maps project name → the tickets its
 * list call returns. Every comment posted is recorded. `failing` names
 * projects whose list call throws.
 */
/**
 * The seam's pull-request surface, for fakes in tests where none exists.
 * Reading a thread throws so a test that unexpectedly reaches for one fails
 * at the reach, not on an empty answer.
 */
const noPullRequests = {
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

/**
 * The two ticket listings no fake here is *about*: the open one, and the step
 * children of an initiative. This project has nothing open beyond the marked
 * tickets it declares, and no initiative in these tests has been broken into
 * step tickets, so nothing here is ever introduced to either.
 *
 * Its own spread rather than a member of `noPullRequests`, because it is the
 * ticket surface: a fake answering these out of a constant named for pull
 * requests would be saying something it does not mean.
 */
const noOtherListings = {
  async listOpenTickets(): Promise<Ticket[]> {
    return [];
  },
  async listSteps(): Promise<Step[]> {
    return [];
  },
};

function fakeAdapter(
  marked: Record<string, Ticket[]>,
  failing: string[] = [],
): { adapter: TicketingAdapter; comments: PostedComment[] } {
  const comments: PostedComment[] = [];
  const adapter: TicketingAdapter = {
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
    // No initiative in this test is broken into step tickets.
    async listSteps(): Promise<Step[]> {
      return [];
    },
    async listMarkedTickets(project: TicketingProject): Promise<Ticket[]> {
      if (failing.includes(project.name)) {
        throw new Error(`gh exploded on ${project.name}`);
      }
      return marked[project.name] ?? [];
    },
    // Every ticket this fake declares is open, and every one of them carries
    // the mark — so the open listing is the marked listing here, and no
    // introduction is owed on any of them.
    async listOpenTickets(project: TicketingProject): Promise<Ticket[]> {
      if (failing.includes(project.name)) {
        throw new Error(`gh exploded on ${project.name}`);
      }
      return marked[project.name] ?? [];
    },
    async getTicket(
      project: TicketingProject,
      number: number,
    ): Promise<TicketThread> {
      const found = (marked[project.name] ?? []).find(
        (candidate) => candidate.number === number,
      );
      if (found === undefined) throw new Error(`no ticket ${number}`);
      return { ...found, comments: [] };
    },
    async postComment(project, number, body): Promise<void> {
      comments.push({ project: project.name, number, body });
    },
    async applyLabel(): Promise<void> {},
    ...noPullRequests,
  };
  return { adapter, comments };
}

describe("pollOnce — pickup and acknowledgement", () => {
  it("registers a run and acknowledges exactly once for a marked ticket", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, runner });

    expect(store.all()).toHaveLength(1);
    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ project: "scratch-app", number: 7 });
    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
  });

  it("touches nothing when no ticket carries the mark", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(store.all()).toEqual([]);
    expect(comments).toEqual([]);
    expect(wakes).toEqual([]);
  });

  it("says nothing on a second cycle over the same ticket", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(comments).toHaveLength(1);
    expect(store.all()).toHaveLength(1);
    expect(second.pickedUp).toEqual([]);
  });

  it("ends every acknowledgement with a call to action", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(comments).toHaveLength(2);
    for (const comment of comments) {
      const lastLine = comment.body.trimEnd().split("\n").at(-1) ?? "";
      expect(lastLine).toMatch(/\*\*What I need from you:\*\*/);
    }
  });

  it("never asks the human to know a stage or a skill name", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    for (const comment of comments) {
      expect(comment.body).not.toMatch(/timone-\w+|stage \d|sub-phase/i);
    }
  });
});

describe("pollOnce — serialization", () => {
  it("queues a second marked ticket and says so in its acknowledgement", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({
      "scratch-app": [ticket(7), ticket(8)],
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(7);
    expect(store.queue("scratch-app").map((run) => run.ticket)).toEqual([8]);
    expect(result.queued).toEqual(["scratch-app#8/1"]);

    const queuedAck = comments.find((comment) => comment.number === 8);
    expect(queuedAck?.body).toMatch(/queue/i);
    expect(queuedAck?.body).toMatch(/#7/);
    // Only the run that holds the project is handed on; the queued one waits.
    expect(wakes.map((wake) => wake.runId)).toEqual(["scratch-app#7/1"]);
  });

  it("picks the queued ticket up on a later cycle, once the first is done", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7), ticket(8)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    store.activate("scratch-app#7/1", "session-1");
    store.activate("scratch-app#7/1", "session-7");
    store.complete("scratch-app#7/1");
    await pollOnce(deps);
    await runner.drain();

    expect(store.occupyingRun("scratch-app")?.ticket).toBe(8);
    expect(wakes.map((wake) => wake.runId)).toEqual(["scratch-app#7/1", "scratch-app#8/1"]);
  });
});

describe("pollOnce — resilience", () => {
  it("carries on with the other projects when one fails", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha", "beta");
    const { adapter, comments } = fakeAdapter(
      { alpha: [ticket(1)], beta: [ticket(2)] },
      ["alpha"],
    );
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, runner });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/alpha/);
    expect(store.occupyingRun("beta")?.ticket).toBe(2);
    expect(comments.map((comment) => comment.project)).toEqual(["beta"]);
  });
});

describe("pollOnce — resuming a run whose human answered", () => {
  /** A thread whose comments the test controls. */
  function threadedAdapter(
    comments: TicketThread["comments"],
    labels: string[] = ["timone", "triage:feature"],
  ): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
  } {
    const posted: PostedComment[] = [];
    const base = ticket(6, { labels });
    const adapter: TicketingAdapter = {
      ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    return { adapter, posted };
  }

  it("starts a run left queued behind a park that no longer holds anything", async () => {
    // The exact ledger phase 11 left on disk: #4 parked holding the project
    // under the old rule, #6 queued behind it forever. Written as a file
    // rather than built through the store, because the store would never
    // produce this shape again — only a restart onto an old one can.
    const dir = mkdtempSync(join(tmpdir(), "timone-poll-legacy-"));
    tempDirs.push(dir);
    const path = join(dir, ".timone", "state.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        runs: [
          {
            id: "scratch-app#4",
            project: "scratch-app",
            ticket: 4,
            status: "parked",
            stage: "triage",
            wait: { on: "the next stage to be built" },
            flags: [],
            createdAt: "2026-08-02T18:29:31.940Z",
            updatedAt: "2026-08-02T18:32:29.650Z",
          },
          {
            id: "scratch-app#6",
            project: "scratch-app",
            ticket: 6,
            status: "queued",
            flags: [],
            createdAt: "2026-08-02T18:32:57.787Z",
            updatedAt: "2026-08-02T18:32:57.787Z",
          },
        ],
      }),
    );

    const store = RunStore.open(path);
    expect(store.get("scratch-app#6/1")?.status).toBe("queued");

    // This test is about the queue moving, not about the park being picked
    // back up.
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(4), ticket(6)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes.map((wake) => wake.runId)).toEqual(["scratch-app#6/1"]);
    expect(store.get("scratch-app#4/1")?.status).toBe("parked");
  });
});

describe("reclaiming a run its daemon left behind", () => {
  /** A store whose clock the test sets by hand. */
  function clockedStore(): { store: RunStore; set: (iso: string) => void } {
    const dir = mkdtempSync(join(tmpdir(), "timone-reclaim-"));
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

  const FOUR_INTERVALS = 4 * 30 * 1000;
  const POLL_INTERVAL = 60 * 1000;

  /**
   * Leave the store's witness where a daemon polling every interval from
   * `from` until `to` would have left it (ADR-0020).
   *
   * Every reclaim test needs this, and that is the point: a daemon that was
   * not watching may not judge, so a test that reclaims without having watched
   * would be testing a daemon that cannot exist. It also keeps the tests below
   * honest — each one still fails for the reason it names, not because
   * judgement was withheld.
   */
  function watchingSince(store: RunStore, from: string, to: string): void {
    for (let at = Date.parse(from); at < Date.parse(to); at += POLL_INTERVAL) {
      store.witness({
        unwitnessedAfterMs: 2 * POLL_INTERVAL,
        staleAfterMs: FOUR_INTERVALS,
        now: new Date(at).toISOString(),
      });
    }
  }

  /**
   * A tracker for a stale run that had opened pull request #19, answering for
   * that pull request in `state`. The reclaim tests above deal in runs that
   * never got as far as one; these deal in the run that did.
   */
  function staleReviewAdapter(state: "open" | "merged" | "closed"): {
    adapter: TicketingAdapter;
    posted: PostedComment[];
    closed: string[];
  } {
    const posted: PostedComment[] = [];
    const closed: string[] = [];
    const base = ticket(7);
    const pull: PullRequestThread = {
      number: 19,
      title: "The volatility arithmetic",
      url: "https://github.com/fvermaut/ivtrends/pull/19",
      state,
      headSha: "aaaaaaa",
      comments: [],
    };
    const adapter: TicketingAdapter = {
      ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      ...noOtherListings,
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [] };
      },
      async postComment(project, number, body): Promise<void> {
        posted.push({ project: project.name, number, body });
      },
      async applyLabel(): Promise<void> {},
      async findPullRequest() {
        return { ...pull };
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return pull;
      },
      async postPullRequestComment(): Promise<void> {},
      async upsertPullRequestComment(): Promise<void> {},
      async closeTicket(_project, number, reason): Promise<void> {
        closed.push(`${number}:${reason}`);
      },
    };
    return { adapter, posted, closed };
  }

  /** A stale run that got as far as opening pull request #19. */
  function staleWithPullRequest(store: RunStore): void {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
    store.recordPullRequest(run.id, 19);
  }

  it("never reclaims a long session that is still saying it is alive", async () => {
    // The false positive that matters most. A four-hour execution session is
    // a normal thing, and reclaiming one would kill work in progress.
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-alive");
    store.claimBranch(run.id, "timone/7-slow");

    set("2026-08-06T14:00:00Z");
    store.heartbeat(run.id);
    // The daemon has been watching throughout, so this run is spared for the
    // reason the test names — its heartbeat — and not for want of a witness.
    watchingSince(store, "2026-08-06T13:57:00Z", "2026-08-06T14:00:20Z");
    set("2026-08-06T14:00:20Z");

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
    expect(comments).toEqual([]);
  });

  it("leaves a run parked on a human alone, however long it has waited", async () => {
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s");
    store.claimBranch(run.id, "timone/7-slow");
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      stage: "requirements",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    watchingSince(store, "2026-08-25T09:57:00Z", "2026-08-25T10:00:00Z");
    set("2026-08-25T10:00:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("parked");
  });

  // ─── The witness (phase 17, ADR-0020) ────────────────────────────────────

  /** A stale run of `scratch-app`, quiet since ten o'clock. */
  function quietRun(store: RunStore): void {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-gone");
    store.claimBranch(run.id, "timone/7-slow");
  }

  it("still reclaims a run it watched go quiet, gap or no gap", async () => {
    // Asserted before any test of the skip, and the order is the point: a
    // change that merely stopped reclaiming would satisfy every test below
    // and destroy the requirement this phase exists to close.
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    quietRun(store);

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:09:00Z");
    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    });
    await runner.drain();

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
    // The run goes back to the runner, which is told why.
    expect(wakes.map((wake) => wake.events)).toContainEqual([
      "The daemon stopped while a step was running.",
    ]);
  });

  it("reclaims nothing on the cycle that discovers a gap, and says why", async () => {
    // 15a's night: 146 suspensions, 113 of them past the threshold. Under a
    // continuously running daemon each one of those was a healthy run killed.
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const lines: string[] = [];
    quietRun(store);

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
      log: (line) => lines.push(line),
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
    expect(comments.some((c) => c.body.includes("stopped before the work"))).toBe(
      false,
    );
    // The gate has to be able to read this off the log and know why — both
    // that judgement was withheld and how long the daemon was away.
    expect(
      lines.some((line) => /not checking for dead runs.*17m00s/.test(line)),
    ).toBe(true);
  });

  it("tells a young watch apart from an absence, in the words it logs", async () => {
    // Found by running the real binary rather than by a test: two cycles a
    // tenth of a second apart logged "nothing was watching for 0s", which is
    // false — the daemon had been watching the whole time and was merely too
    // young to judge. An operator who reads a line they know to be nonsense
    // stops reading the lines, and this is the line the gate turns on.
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const lines: string[] = [];
    quietRun(store);
    const deps = {
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
      log: (line: string) => lines.push(line),
    };

    // A gap: nobody was watching.
    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    await pollOnce(deps);
    // No gap at all — an unbroken watch that is simply not old enough yet.
    set("2026-08-06T10:19:00Z");
    await pollOnce(deps);

    // The two refusals, in order, picked out of everything else the cycle
    // says — a cycle logs whatever else it did, and this test is about the
    // words of the refusal rather than about its place in the log.
    const refusals = lines.filter((line) =>
      line.includes("not checking for dead runs"),
    );
    expect(refusals[0]).toMatch(/the daemon was not running for 17m00s/);
    expect(refusals[1]).toMatch(/has been up 1m00s.*watch a run for 2m00s/);
    expect(refusals[1]).not.toMatch(/was not running for/);
  });

  it("is delayed, not disabled: the same run is reclaimed a window later", async () => {
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    quietRun(store);
    const deps = {
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    };

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    expect((await pollOnce(deps)).reclaimed).toEqual([]);

    set("2026-08-06T10:19:00Z");
    expect((await pollOnce(deps)).reclaimed).toEqual([]);
    set("2026-08-06T10:20:00Z");

    expect((await pollOnce(deps)).reclaimed).toEqual(["scratch-app#7/1"]);
  });

  it("grants the window on a state file no daemon has ever observed", async () => {
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    quietRun(store);

    set("2026-08-06T10:09:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("scratch-app#7/1")?.status).toBe("active");
  });

  it("takes one witness for the whole cycle, not one per project", async () => {
    // A witness taken per project would have project one's fresh stamp answer
    // for project two, which is the same masking hazard two daemons have.
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app", "other-app");
    const { adapter } = fakeAdapter({
      "scratch-app": [ticket(7)],
      "other-app": [ticket(8)],
    });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const lines: string[] = [];

    for (const [project, number] of [
      ["scratch-app", 7],
      ["other-app", 8],
    ] as const) {
      const { run } = store.register(project, number);
      store.activate(run.id, `session-gone-${number}`);
      store.claimBranch(run.id, `timone/${number}-slow`);
    }

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:18:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
      log: (line) => lines.push(line),
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get("other-app#8/1")?.status).toBe("active");
    expect(
      lines.filter((line) => /not checking for dead runs/.test(line)),
    ).toHaveLength(1);
  });

  it("derives the unwitnessed gap from the poll interval it was given", async () => {
    // Four minutes is an absence at a one-minute interval and jitter at a
    // five-minute one. The threshold is not a constant, it is twice the
    // cadence the daemon was actually told to poll at.
    const { store, set } = clockedStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    quietRun(store);

    watchingSince(store, "2026-08-06T10:00:00Z", "2026-08-06T10:02:00Z");
    set("2026-08-06T10:06:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: 5 * 60 * 1000,
    });

    expect(result.reclaimed).toEqual(["scratch-app#7/1"]);
  });
});

// ─── Previews (phase 16) ────────────────────────────────────────────────────

/** A manifest whose named projects are all bound to Docker previews. */
function manifestWithPreviews(...names: string[]): Manifest {
  const manifest = manifestWith(...names);
  for (const name of names) {
    manifest.projects[name].bindings = {
      ticketing: "github" as const,
      preview: "docker" as const,
    };
  }
  return manifest;
}

/** A run of `project` that owns a branch and has a pull request open on it. */
function runWithPullRequest(
  store: RunStore,
  project: string,
  ticketNumber: number,
  pr: number,
): void {
  const { run } = store.register(project, ticketNumber);
  store.claimBranch(run.id, `timone/${ticketNumber}-work`);
  store.recordPullRequest(run.id, pr);
}

interface Upsert {
  project: string;
  number: number;
  marker: string;
  body: string;
}

/**
 * A ticketing fake whose pull-request surface answers with `pulls`, keyed by
 * branch, and records every in-place comment revision.
 *
 * It lists no marked ticket. Its tickets and pull-request threads are still
 * readable, because the runner reads the ticket and the pull request of every
 * run it looks at: a ticket with no comments, and the pull request as `pulls`
 * holds it, with none either.
 */
function previewTicketing(pulls: Record<string, PullRequest>): {
  adapter: TicketingAdapter;
  upserts: Upsert[];
} {
  const upserts: Upsert[] = [];
  const adapter: TicketingAdapter = {
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
    async listMarkedTickets(): Promise<Ticket[]> {
      return [];
    },
    ...noOtherListings,
    async getTicket(_project, number): Promise<TicketThread> {
      return { ...ticket(number), comments: [] };
    },
    async postComment(): Promise<void> {},
    async applyLabel(): Promise<void> {},
    async findPullRequest(_project, branch): Promise<PullRequest | undefined> {
      return pulls[branch];
    },
    async getPullRequestThread(_project, number): Promise<PullRequestThread> {
      const found = Object.values(pulls).find((candidate) => candidate.number === number);
      if (found === undefined) throw new Error(`no pull request #${number} in this test`);
      return { ...found, comments: [] };
    },
    async postPullRequestComment(): Promise<void> {},
    async upsertPullRequestComment(project, number, marker, body): Promise<void> {
      upserts.push({ project: project.name, number, marker, body });
    },
    async closeTicket(): Promise<void> {},
  };
  return { adapter, upserts };
}

/** A pull request as the tracker reports it. */
function pull(
  number: number,
  headSha: string,
  state: PullRequest["state"] = "open",
): PullRequest {
  return {
    number,
    title: `pull request ${number}`,
    url: `https://github.com/fvermaut/scratch-app/pull/${number}`,
    state,
    headSha,
  };
}

/**
 * A preview adapter that answers with whatever `reply` returns for the commit
 * it is asked about, and records everything it was asked to do.
 */
function fakePreviews(
  reply: (headSha: string) => Preview | Error = () => ({
    state: "ready" as const,
    url: "http://localhost:54321/",
  }),
): {
  previews: PreviewAdapter;
  ensured: Array<{ project: string; pr: number; headSha: string }>;
  released: Array<{ project: string; pr: number }>;
} {
  const ensured: Array<{ project: string; pr: number; headSha: string }> = [];
  const released: Array<{ project: string; pr: number }> = [];
  return {
    previews: {
      async ensure(project, pr, headSha): Promise<Preview> {
        ensured.push({ project: project.name, pr, headSha });
        const answer = reply(headSha);
        if (answer instanceof Error) throw answer;
        return answer;
      },
      async release(project, pr): Promise<void> {
        released.push({ project: project.name, pr });
      },
    },
    ensured,
    released,
  };
}

describe("a run whose holder can be asked about", () => {
  const FOUR_INTERVALS = 4 * 30 * 1000;
  const POLL_INTERVAL = 60 * 1000;

  /**
   * A store whose clock and whose idea of the process table the test sets
   * (ADR-0049 D2, extending ADR-0025). The pid table is injected for the
   * reason `lock.test.ts` gives: a test cannot portably manufacture a dead
   * pid, so an uninjected probe would leave these cases asserting against
   * whatever the runner's machine happens to be running.
   */
  function watchedStore(alive: readonly number[]): {
    store: RunStore;
    set: (iso: string) => void;
  } {
    const dir = mkdtempSync(join(tmpdir(), "timone-holder-sweep-"));
    tempDirs.push(dir);
    let instant = "2026-09-04T10:00:00Z";
    return {
      store: RunStore.open(join(dir, ".timone", "state.json"), {
        now: () => instant,
        livenessOf: (holder) => (alive.includes(holder.pid) ? "alive" : "gone"),
      }),
      set: (iso) => {
        instant = iso;
      },
    };
  }

  /** A holder as a daemon or a terminal records one. */
  function holderOf(command: string, pid: number): Holder {
    return {
      token: `token-${pid}`,
      command,
      pid,
      since: "2026-09-04T10:00:00Z",
      observedAt: "2026-09-04T10:00:00Z",
      host: "fvermaut-mac",
    };
  }

  /** Leave the witness where a daemon polling right through would leave it. */
  function watchingSince(store: RunStore, from: string, to: string): void {
    for (let at = Date.parse(from); at < Date.parse(to); at += POLL_INTERVAL) {
      store.witness({
        unwitnessedAfterMs: 2 * POLL_INTERVAL,
        staleAfterMs: FOUR_INTERVALS,
        now: new Date(at).toISOString(),
      });
    }
  }

  /** A run active on a work branch, held by whoever `holder` says. */
  function runningRun(store: RunStore, holder?: Holder): string {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1", holder);
    store.claimBranch(run.id, "timone/7-slow");
    return run.id;
  }

  /**
   * One cycle at `at`, with the sweep's threshold set to four intervals, on a
   * project the runner drives.
   */
  async function cycleAt(
    store: RunStore,
    set: (iso: string) => void,
    at: string,
    lines: string[],
  ) {
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    watchingSince(store, "2026-09-04T10:00:00Z", at);
    set(at);
    return pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      log: (line) => lines.push(line),
    });
  }

  it("leaves a silent run alone while its holder's process is still running", async () => {
    // ADR-0025's argument, applied where it was always needed. A session that
    // is thinking says nothing for as long as it thinks, and the clock cannot
    // tell that from a corpse. The pid can.
    const { store, set } = watchedStore([4213]);
    const id = runningRun(store, holderOf("timone daemon scratch-app#7/1", 4213));
    const lines: string[] = [];

    const result = await cycleAt(store, set, "2026-09-04T10:09:00Z", lines);

    expect(result.reclaimed).toEqual([]);
    expect(store.get(id)?.status).toBe("active");
  });

  it("reclaims a silent run whose holder's process is gone", async () => {
    const { store, set } = watchedStore([]);
    const id = runningRun(store, holderOf("timone daemon scratch-app#7/1", 4213));
    const lines: string[] = [];

    await cycleAt(store, set, "2026-09-04T10:09:00Z", lines);

    expect(store.get(id)?.status).not.toBe("active");
  });

  it("still judges a run with no holder by witnessed time", async () => {
    // ADR-0020's path, untouched. Every run written before ADR-0049 is in
    // this state, and a phase that fixed runs by deleting the overnight
    // protection would have traded one live defect for a worse one.
    const { store, set } = watchedStore([]);
    const id = runningRun(store);
    const lines: string[] = [];

    const result = await cycleAt(store, set, "2026-09-04T10:09:00Z", lines);

    expect(result.reclaimed).toEqual([id]);
  });

  it("reclaims nothing with no holder and a gap it cannot vouch for", async () => {
    const { store, set } = watchedStore([]);
    const id = runningRun(store);
    const lines: string[] = [];
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    // One cycle, then nothing for an hour: the daemon was not there and
    // cannot say whether the run went quiet or the machine did.
    store.witness({
      unwitnessedAfterMs: 2 * POLL_INTERVAL,
      staleAfterMs: FOUR_INTERVALS,
      now: "2026-09-04T10:00:00Z",
    });
    set("2026-09-04T11:00:00Z");
    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      log: (line) => lines.push(line),
    });

    expect(result.reclaimed).toEqual([]);
    expect(store.get(id)?.status).toBe("active");
    expect(lines.some((line) => line.includes("was not running for"))).toBe(true);
  });

  it("does not take a run away from a live takeover", async () => {
    // timone#63, replayed. A terminal holds the run through a conversation
    // that may last an hour, and the sweep took it back after two minutes —
    // so the handback could never be read and the human's session was talking
    // to a run that had been failed under it.
    const { store, set } = watchedStore([9100]);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-1");
    store.claimBranch(run.id, "timone/7-slow");
    store.park(run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      resolvableBy: ["triage"],
    });
    store.claim(run.id, holderOf("timone takeover scratch-app#7", 9100));
    const lines: string[] = [];

    const result = await cycleAt(store, set, "2026-09-04T10:09:00Z", lines);

    expect(result.reclaimed).toEqual([]);
    expect(store.get(run.id)?.status).toBe("active");
    expect(store.get(run.id)?.holder?.pid).toBe(9100);
  });
});

describe("pollOnce — previews are opt-in", () => {
  it("does not reconcile a project with no preview binding at all", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
    });
    const { previews, ensured } = fakePreviews();
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      previews,
    });

    // Not "built and discarded" — never asked. A binding says which adapter,
    // never whether to have one, so an unbound project must cost nothing.
    expect(ensured).toEqual([]);
    expect(upserts).toEqual([]);
    expect(store.previewsFor("scratch-app")).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("does nothing for a bound project when the daemon has no preview adapter", async () => {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
    });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({
      manifest,
      store,
      adapter,
      runner,
    });

    expect(upserts).toEqual([]);
    expect(store.previewsFor("scratch-app")).toEqual([]);
  });
});

describe("pollOnce — previews reconcile and land on the pull request", () => {
  it("says it once and revises it in place, never once per cycle", async () => {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    const pulls = { "timone/7-work": pull(9, "abc1234") };
    const { adapter, upserts } = previewTicketing(pulls);
    let port = 54321;
    const { previews } = fakePreviews(() => ({
      state: "ready",
      url: `http://localhost:${port}/`,
    }));
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = {
      manifest,
      store,
      adapter,
      runner,
      previews,
    };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    // Three cycles, one statement. This is the failure mode a per-cycle
    // reconciler creates and the one that would spam a client's pull request.
    expect(upserts).toHaveLength(1);
    expect(upserts[0].marker).toBe(PREVIEW_MARKER);
    expect(upserts[0].body).toContain("http://localhost:54321/");

    // A rebuild moved the port, which is the one thing a reviewer must be
    // told again — and it is a revision, not a second comment.
    port = 49713;
    pulls["timone/7-work"] = pull(9, "def5678");
    await pollOnce(deps);

    expect(upserts).toHaveLength(2);
    expect(upserts[1].body).toContain("http://localhost:49713/");
    expect(upserts[1].body).toContain("def5678");
  });

  it("records the preview against the commit it was reconciled for", async () => {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter } = previewTicketing({ "timone/7-work": pull(9, "abc1234") });
    const { previews, ensured } = fakePreviews();
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      previews,
    });

    expect(ensured).toEqual([
      { project: "scratch-app", pr: 9, headSha: "abc1234" },
    ]);
    expect(store.previewRecord("scratch-app", 9)).toMatchObject({
      project: "scratch-app",
      pr: 9,
      headSha: "abc1234",
      state: "ready",
      url: "http://localhost:54321/",
    });
  });

  it("posts a failed preview's reason and lets the rest of the cycle happen", async () => {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app", "other-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    runWithPullRequest(store, "other-app", 3, 4);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
      "timone/3-work": pull(4, "beef999"),
    });
    const { previews, ensured } = fakePreviews((headSha) =>
      headSha === "abc1234"
        ? { state: "failed", reason: "the app container never became healthy" }
        : { state: "ready", url: "http://localhost:54321/" },
    );
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      previews,
    });

    // A failure is a value, so it is not an error and it blocks nothing.
    expect(result.errors).toEqual([]);
    expect(upserts[0].body).toContain("never became healthy");
    expect(upserts[0].body).toContain("Nothing is blocked by this");
    expect(ensured.map((call) => call.project)).toEqual([
      "scratch-app",
      "other-app",
    ]);
  });

  it("catches an adapter that throws into errors, leaving the rest of the cycle intact", async () => {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app", "other-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    runWithPullRequest(store, "other-app", 3, 4);
    const { adapter, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
      "timone/3-work": pull(4, "beef999"),
    });
    const { previews } = fakePreviews((headSha) =>
      headSha === "abc1234" ? new Error("docker daemon is not running") : {
        state: "ready",
        url: "http://localhost:54321/",
      },
    );
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      previews,
    });

    expect(result.errors).toEqual([
      "scratch-app: preview for #7: docker daemon is not running",
    ]);
    expect(upserts.map((upsert) => upsert.number)).toEqual([4]);
  });
});

describe("pollOnce — previews end when their pull request does", () => {
  /** A store and fakes with one preview already recorded and running. */
  async function withLivePreview(state: PullRequest["state"]): Promise<{
    store: RunStore;
    deps: Parameters<typeof pollOnce>[0];
    released: Array<{ project: string; pr: number }>;
    upserts: Upsert[];
    pulls: Record<string, PullRequest>;
  }> {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    const pulls: Record<string, PullRequest> = {
      "timone/7-work": pull(9, "abc1234"),
    };
    const { adapter, upserts } = previewTicketing(pulls);
    const { previews, released } = fakePreviews();
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = {
      manifest,
      store,
      adapter,
      runner,
      previews,
    };

    await pollOnce(deps);
    pulls["timone/7-work"] = pull(9, "abc1234", state);
    return { store, deps, released, upserts, pulls };
  }

  it("releases a merged pull request's preview and drops its record", async () => {
    const { store, deps, released } = await withLivePreview("merged");

    await pollOnce(deps);

    expect(released).toEqual([{ project: "scratch-app", pr: 9 }]);
    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();
  });

  it("releases a pull request closed without merging, just the same", async () => {
    const { store, deps, released } = await withLivePreview("closed");

    await pollOnce(deps);

    expect(released).toEqual([{ project: "scratch-app", pr: 9 }]);
    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();
  });

  it("releases once per ending, not once per cycle thereafter", async () => {
    const { deps, released } = await withLivePreview("merged");

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    // A merged pull request stays merged forever; a release keyed on its
    // state alone would make work for the rest of the daemon's life.
    expect(released).toHaveLength(1);
  });

  it("gives a reopened pull request a preview again, with no code of its own", async () => {
    const { store, deps, pulls, upserts } = await withLivePreview("closed");
    await pollOnce(deps);
    expect(store.previewRecord("scratch-app", 9)).toBeUndefined();

    // Reopening is not a case anything handles — it is simply an open pull
    // request with no preview recorded, which is what a new one is.
    pulls["timone/7-work"] = pull(9, "abc1234", "open");
    await pollOnce(deps);

    expect(store.previewRecord("scratch-app", 9)).toMatchObject({
      state: "ready",
    });
    expect(upserts).toHaveLength(2);
  });

  it("reports a release that fails and does not wedge the cycle", async () => {
    const store = newStore();
    const manifest = manifestWithPreviews("scratch-app");
    runWithPullRequest(store, "scratch-app", 7, 9);
    const pulls: Record<string, PullRequest> = {
      "timone/7-work": pull(9, "abc1234"),
    };
    const { adapter } = previewTicketing(pulls);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const previews: PreviewAdapter = {
      async ensure(): Promise<Preview> {
        return { state: "ready", url: "http://localhost:54321/" };
      },
      async release(): Promise<void> {
        throw new Error("docker compose down exploded");
      },
    };
    const deps = {
      manifest,
      store,
      adapter,
      runner,
      previews,
    };

    await pollOnce(deps);
    pulls["timone/7-work"] = pull(9, "abc1234", "merged");
    const result = await pollOnce(deps);

    expect(result.errors).toEqual([
      "scratch-app: preview for #7: docker compose down exploded",
    ]);
    // The record survives, so a later cycle tries again rather than leaving
    // containers on the host with nothing left that remembers them.
    expect(store.previewRecord("scratch-app", 9)).toBeDefined();
  });
});

describe("pollOnce — a wayfinder decision ticket", () => {
  it("does not work a wayfinder ticket the tracker never handed it", async () => {
    // R1's negative clause, unchanged by this phase. The mark label is the
    // permission boundary and `listMarkedTickets` is where it is applied — so
    // a wayfinder ticket without the mark is simply not in the cycle's
    // listing, and carrying `wayfinder:grilling` buys it no exemption. The
    // map itself is the ticket this protects: it is never marked, and a run
    // on it would be a run nothing could resolve.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(store.all()).toEqual([]);
    expect(wakes).toEqual([]);
    expect(comments).toEqual([]);
  });
});

describe("pollOnce — an unmarked ticket is introduced to, once", () => {
  // ADR-0024's second ruling: the `timone` label stops being the boundary of
  // what Timone will *say* and remains the boundary of what it will *do*. The
  // ticket this exists for is `scratch-app` #5 — "can I get a dark mode?",
  // filed 2026-08-03 without the label and silent ever since, with nothing on
  // it explaining why.
  //
  // Two properties, and the second is the one that must never break: an
  // unmarked ticket receives exactly one comment, ever, and **never a run**.
  // PRD-02.R1's surviving clause is that second one, and it is asserted here
  // as a regression test rather than assumed from the shape of the loop.

  /** Every call on the seam whose effect a human can see. */
  const WRITE_CALLS = [
    "postComment",
    "applyLabel",
    "closeTicket",
    "postPullRequestComment",
    "upsertPullRequestComment",
  ];

  interface SeamCall {
    call: string;
    number: number;
    body?: string;
    /** Which project was spoken to, where the call says (a comment does). */
    project?: string;
  }

  const writesIn = (calls: readonly SeamCall[]): SeamCall[] =>
    calls.filter((entry) => WRITE_CALLS.includes(entry.call));

  const writesOn = (calls: readonly SeamCall[], number: number): SeamCall[] =>
    writesIn(calls).filter((entry) => entry.number === number);

  /**
   * A fake with the two listings the loop now makes: what carries the mark,
   * and what is simply open. The marked listing is derived from the open one
   * by the label, exactly as the tracker derives it, so a test cannot set up
   * a project where the two disagree about a ticket's labels.
   *
   * `open` is the array the test holds, so a ticket can gain the label between
   * cycles exactly as a human's edit does.
   */
  function twoListings(open: Ticket[]): {
    adapter: TicketingAdapter;
    calls: SeamCall[];
  } {
    const calls: SeamCall[] = [];
    const threads = new Map<number, TicketThread["comments"]>();
    let clock = 0;
    const thread = (number: number): TicketThread["comments"] => {
      const found = threads.get(number);
      if (found !== undefined) return found;
      const fresh: TicketThread["comments"] = [];
      threads.set(number, fresh);
      return fresh;
    };
    const stamp = (body: string): string =>
      `${MACHINE_MARKER}\n\n---\n\n${body}`;

    const adapter: TicketingAdapter = {
      ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noRunnerCalls,
    ...noStepWrites,
      // No initiative in this test is broken into step tickets.
      async listSteps(): Promise<Step[]> {
        return [];
      },
      async listMarkedTickets(): Promise<Ticket[]> {
        return open.filter((candidate) => candidate.labels.includes("timone"));
      },
      async listOpenTickets(): Promise<Ticket[]> {
        return [...open];
      },
      async getTicket(_project, number): Promise<TicketThread> {
        calls.push({ call: "getTicket", number });
        const base = open.find((candidate) => candidate.number === number);
        return { ...(base ?? ticket(number)), comments: [...thread(number)] };
      },
      async postComment(project, number, body): Promise<void> {
        calls.push({ call: "postComment", number, body, project: project.name });
        thread(number).push({
          author: "fvermaut",
          body: stamp(body),
          createdAt: `2026-08-03T13:${String(clock++).padStart(2, "0")}:00Z`,
          fromTimone: true,
        });
      },
      async applyLabel(_project, number, label): Promise<void> {
        calls.push({ call: "applyLabel", number, body: label });
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return undefined;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        throw new Error("no pull request exists in this test");
      },
      async postPullRequestComment(_project, number, body): Promise<void> {
        calls.push({ call: "postPullRequestComment", number, body });
      },
      async upsertPullRequestComment(
        _project,
        number,
        _marker,
        body,
      ): Promise<void> {
        calls.push({ call: "upsertPullRequestComment", number, body });
      },
      async closeTicket(_project, number, reason): Promise<void> {
        calls.push({ call: "closeTicket", number, body: reason });
      },
    };
    return { adapter, calls };
  }

  it("creates no run for a ticket that does not carry the mark", async () => {
    // PRD-02.R1, second criterion, re-verified rather than amended: its
    // criterion forbids a *run* on an unmarked issue and has never forbidden a
    // comment. Speaking to an unmarked ticket is what this slice adds; working
    // one is what it must never do, and this is the assertion that says so.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const { adapter } = twoListings([
      ticket(5, { labels: [] }),
      ticket(7),
    ]);
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    const first = await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);
    await runner.drain();

    expect(store.all().map((run) => run.id)).toEqual(["scratch-app#7/1"]);
    expect(store.get("scratch-app#5/1")).toBeUndefined();
    expect(first.pickedUp).toEqual(["scratch-app#7/1"]);
    // And nothing was ever handed on for it either — a run is what a wake
    // needs, so this cannot fail on its own, but it is the consequence R1 is
    // actually about and it costs one line to say so.
    expect(wakes.filter((wake) => wake.runId.startsWith("scratch-app#5/"))).toEqual([]);
  });

  it("introduces itself exactly once across three cycles", async () => {
    // Three and not two: a bug that posts on cycles 1 and 3 but not 2 passes
    // a two-cycle test, and "exactly once for the life of the daemon" is the
    // whole promise. Counted on the seam rather than in the thread.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    const said = writesOn(calls, 5);
    expect(said).toHaveLength(1);
    expect(said[0]?.call).toBe("postComment");
  });

  it("names the label that would hand the ticket over, and ends on the ask", async () => {
    // The point of speaking at all: a human looking at a silent ticket has no
    // way of knowing what to do, so the one thing the comment must contain is
    // the exact label. Hand-written here rather than composed from the same
    // function the loop composes it with.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    const body = writesOn(calls, 5)[0]?.body ?? "";
    expect(body).toContain("add the `timone` label");
    expect(body.trimEnd().split("\n").at(-1)).toBe(
      "**What I need from you:** nothing — add the `timone` label if you would like me to pick this up.",
    );
  });

  it("leaves a marked ticket to the path it already had", async () => {
    // The negative half, and the one that protects everything built before
    // this: a ticket carrying the mark is acknowledged and run exactly as it
    // was, and is never introduced to.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const { adapter, calls } = twoListings([
      ticket(5, { labels: [] }),
      ticket(7),
    ]);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    await pollOnce(deps);

    const saidOnSeven = writesOn(calls, 7);
    expect(saidOnSeven.map((entry) => entry.call)).toEqual(["postComment"]);
    expect(saidOnSeven[0]?.body).toContain("**Picked this up.**");
    for (const entry of saidOnSeven) {
      expect(entry.body).not.toContain("this repository is worked by a machine");
    }
  });

  it("holds its peace once the label lands, without ever having been given a run", async () => {
    // The transition a human actually makes: they read the introduction and
    // add the label. From that cycle on the ticket is an ordinary marked one
    // — and the introduction, having been posted once, is not repeated when
    // the ticket loses the label again.
    //
    // On the third cycle the ticket has left the marked-and-open listing, so
    // the runner is told so. The introduction still stays unrepeated, which
    // is what this test is about — the ticket has a run, so
    // `introduceUnmarked` keeps its peace.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const open = [ticket(5, { labels: [] })];
    const { adapter, calls } = twoListings(open);
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    open[0] = ticket(5, { labels: ["timone"] });
    await pollOnce(deps);
    open[0] = ticket(5, { labels: [] });
    const before = calls.length;
    await pollOnce(deps);
    await runner.drain();

    expect(wakes.at(-1)?.runId).toBe("scratch-app#5/1");
    expect(wakes.at(-1)?.events).toContain("The ticket was closed, or its mark was removed.");
    expect(
      writesOn(calls, 5).filter((entry) => entry.call === "postComment"),
    ).toHaveLength(2);
    expect(writesIn(calls.slice(before))).toEqual([]);
  });

  it("says nothing on an unmarked ticket it is already working, and everything on one it is not", async () => {
    // 20g: `timone takeover` now creates a run from the tracker for an open
    // ticket that has none, and it deliberately does **not** apply the label —
    // applying it fails outright on a repository onboarded before the label
    // existed, which is the case ADR-0024 exists to rescue. So an unmarked
    // ticket can now have a run, and telling its human to "add the `timone`
    // label if you would like me to pick this up" while a session is open on
    // it is a ticket lying about its own state — the one thing this phase
    // exists to abolish.
    //
    // The control beside it is half the point: #6 has no run and must still
    // get its introduction, or the fix has silenced 20d rather than corrected
    // it.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    waitingForRunner(store, 5);
    const { adapter, calls } = twoListings([
      ticket(5, { labels: [] }),
      ticket(6, { labels: [] }),
    ]);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);

    expect(writesOn(calls, 5)).toEqual([]);
    expect(store.introducedAt("scratch-app", 5)).toBeUndefined();

    const saidOnSix = writesOn(calls, 6);
    expect(saidOnSix).toHaveLength(1);
    expect(saidOnSix[0]?.body).toContain("add the `timone` label");
  });

  it("asks the ledger whether it has said hello, never the ticket's thread", async () => {
    // Exactly-once is *recorded*, not inferred (ADR-0024). A store that
    // already holds the record keeps the machine quiet even though the thread
    // is empty — which is the discriminating case: a loop reading the thread
    // to decide would see nothing there and post.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    store.recordIntroduction("scratch-app", 5);
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(writesIn(calls)).toEqual([]);
    // And it did not read the thread to find that out, either.
    expect(calls.filter((entry) => entry.call === "getTicket")).toEqual([]);
  });

  it("writes the record down before it speaks, so a failed post is never a second comment", async () => {
    // The asymmetry the ordering is chosen on: a post that fails after the
    // record leaves one ticket unspoken-to and one line in `errors`, while a
    // record written after a successful post would put a second introduction
    // on a client's ticket the moment anything crashed between the two.
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const failing: TicketingAdapter = {
      ...adapter,
      async postComment(): Promise<void> {
        throw new Error("gh could not comment on issue 5");
      },
    };
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter: failing, manifest, sessions });
    const deps = {
      manifest,
      store,
      adapter: failing,
      runner,
    };

    const first = await pollOnce(deps);

    expect(first.errors).toHaveLength(1);
    expect(first.errors[0]).toMatch(/#5/);
    expect(store.introducedAt("scratch-app", 5)).toBeDefined();

    // The next cycle stays quiet rather than trying again, which is the price
    // of the ordering and is paid deliberately.
    const second = await pollOnce({ ...deps, adapter });
    expect(second.errors).toEqual([]);
    expect(writesIn(calls)).toEqual([]);
  });

  it("costs the project nothing else in the cycle when the open listing fails", async () => {
    // The new listing is a `gh` call that can fail on its own — a rate limit,
    // a large repository — and it is the last thing a project's turn does.
    // Letting it escape would take the project's preview reconciliation with
    // it, so a repository Timone cannot enumerate would also stop telling
    // reviewers where to look. That is a bigger consequence than the fault.
    const store = newStore();
    const manifest = introducing(manifestWithPreviews("scratch-app"));
    runWithPullRequest(store, "scratch-app", 7, 9);
    const { adapter: base, upserts } = previewTicketing({
      "timone/7-work": pull(9, "abc1234"),
    });
    const adapter: TicketingAdapter = {
      ...base,
      async listOpenTickets(): Promise<Ticket[]> {
        throw new Error("gh could not list the open issues");
      },
    };
    const { previews, ensured } = fakePreviews();
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      previews,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/could not list the open issues/);
    expect(ensured).toHaveLength(1);
    expect(upserts).toHaveLength(1);
  });

  it("says nothing at all on a project that has not asked for introductions", async () => {
    // ADR-0024's restraint, and the whole of it: the per-project switch
    // defaults off, and *absent* is what off means — a manifest entry written
    // before this existed asks for nothing and gets nothing. A repository
    // onboarded with two hundred open issues would otherwise meet Timone two
    // hundred times in its first cycle, which the ADR calls a worse first
    // impression than silence.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    let listings = 0;
    const counted: TicketingAdapter = {
      ...adapter,
      async listOpenTickets(project: TicketingProject): Promise<Ticket[]> {
        listings += 1;
        return adapter.listOpenTickets(project);
      },
    };
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter: counted, manifest, sessions });
    const deps = {
      manifest,
      store,
      adapter: counted,
      runner,
    };

    await pollOnce(deps);
    await pollOnce(deps);

    expect(writesIn(calls)).toEqual([]);
    expect(store.introducedAt("scratch-app", 5)).toBeUndefined();
    // And the tracker was never asked either. A project with introductions off
    // does not pay for a listing it would then throw away — the same shape
    // `reconcilePreviews` uses for a project with no preview binding.
    expect(listings).toBe(0);
  });

  it("speaks on the project that asked and stays silent on the one beside it", async () => {
    // The switch is *per project*, which is the half a single-project test
    // cannot show: one cycle, one daemon, one adapter and two repositories
    // whose only difference is the switch. Exactly one introduction is posted
    // and it names which repository got it, so the pair cannot pass by the
    // behaviour being globally on or globally off.
    const store = newStore();
    const { adapter, calls } = twoListings([ticket(5, { labels: [] })]);
    const both = manifestWith("quiet-app", "chatty-app");
    const manifest: Manifest = {
      projects: {
        "quiet-app": both.projects["quiet-app"]!,
        "chatty-app": {
          ...both.projects["chatty-app"]!,
          introduce_unmarked: true,
        },
      },
    };
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    const said = writesIn(calls);
    expect(said).toHaveLength(1);
    expect(said[0]?.project).toBe("chatty-app");
    expect(said[0]?.body).toContain("add the `timone` label");
    expect(store.introducedAt("chatty-app", 5)).toBeDefined();
    expect(store.introducedAt("quiet-app", 5)).toBeUndefined();
  });

  it("carries on to the next ticket when one introduction cannot be posted", async () => {
    const store = newStore();
    const manifest = introducing(manifestWith("scratch-app"));
    const { adapter, calls } = twoListings([
      ticket(5, { labels: [] }),
      ticket(6, { labels: [] }),
    ]);
    const failing: TicketingAdapter = {
      ...adapter,
      async postComment(project, number, body): Promise<void> {
        if (number === 5) throw new Error("gh could not comment on issue 5");
        await adapter.postComment(project, number, body);
      },
    };
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter: failing, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter: failing,
      runner,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/#5/);
    expect(writesOn(calls, 6)).toHaveLength(1);
  });
});

/**
 * A store whose state path the test also holds, so it can leave a request
 * beside the ledger the way a refused command does
 * ([ADR-0032](../../doc/adr/0032-a-human-command-asks-the-daemon-to-act.md)).
 */
function newStoreAt(): { store: RunStore; statePath: string } {
  const dir = mkdtempSync(join(tmpdir(), "timone-poll-requests-"));
  tempDirs.push(dir);
  const statePath = join(dir, ".timone", "state.json");
  let tick = 0;
  const store = RunStore.open(statePath, {
    now: () => `2026-08-16T12:${String(tick++).padStart(2, "0")}:00Z`,
  });
  return { store, statePath };
}

describe("pollOnce — requests a human left for the daemon", () => {

  it("carries out a queued cancellation, in the human's own words", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 31);
    enqueue(statePath, {
      kind: "cancel",
      project: "scratch-app",
      ticket: 31,
      reason: "I have changed my mind about labels",
    });
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      statePath,
    });

    expect(result.applied).toEqual(["cancel scratch-app#31"]);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(store.get(run.id)?.cancellation).toBe("I have changed my mind about labels");
  });

  /**
   * A request that cannot be carried out is gone all the same. One that
   * survived its own failure would be re-attempted every sixty seconds for
   * ever — a poison pill that stops everything queued behind it.
   */
  it("settles a request it cannot carry out, and does not try it again", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 31);
    store.activate(run.id, "session-1");
    store.complete(run.id);
    enqueue(statePath, { kind: "takeover-ended", project: "scratch-app", ticket: 31 });
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner, statePath };

    const first = await pollOnce(deps);
    const second = await pollOnce(deps);

    expect(first.applied).toEqual([]);
    expect(first.errors.join(" ")).toContain("could not apply takeover-ended scratch-app#31");
    expect(pending(statePath).requests).toEqual([]);
    expect(second.errors).toEqual([]);
  });

  it("reports an unreadable request, leaves it alone, and polls anyway", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    mkdirSync(requestsDir(statePath), { recursive: true });
    const corrupt = join(requestsDir(statePath), "2026-08-16T12-00-00-000Z-000000-dead.json");
    writeFileSync(corrupt, "{ not json", "utf8");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      statePath,
    });

    expect(result.errors.join(" ")).toContain("unreadable request");
    expect(readFileSync(corrupt, "utf8")).toBe("{ not json");
    // The cycle did its actual job regardless: the marked ticket was still
    // registered and acknowledged.
    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
    expect(comments).toHaveLength(1);
  });

  it("costs nothing when nobody has ever asked for anything", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      statePath,
    });

    expect(result.applied).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.pickedUp).toEqual(["scratch-app#7/1"]);
  });

  /**
   * Every existing daemon and every existing test is in this state: a cycle
   * that was never told where the ledger lives serves nobody, and behaves
   * exactly as it did before requests existed.
   */
  it("serves nobody when the cycle was never told where the ledger is", async () => {
    const { store } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    waitingForRunner(store, 31);
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
    });

    expect(result.applied).toEqual([]);
    expect(store.get("scratch-app#31/1")?.status).toBe("parked");
  });
});

describe("pollOnce — handing a run to the terminal and taking it back", () => {

  it("says so, and changes nothing, when there is nothing to hand over", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    enqueue(statePath, {
      kind: "release-takeover",
      project: "scratch-app",
      ticket: 6,
      outcome: "abandoned",
    });
    const { adapter } = fakeAdapter({ "scratch-app": [] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      statePath,
    });

    expect(result.applied).toEqual([]);
    expect(result.errors.join(" ")).toContain("not out at the terminal");
    expect(pending(statePath).requests).toEqual([]);
  });
});

/**
 * 29d — the daemon takes the *next step ticket*, not the next chunk of a
 * count.
 *
 * The trap this block exists to catch is the one the plan names: a change that
 * rewrites the wording and leaves the loop still deciding what to build from
 * the ledger. Every case here asserts on **which run was opened**, never on a
 * comment.
 */
describe("the frontier decides which step is taken", () => {
  const MAP = 7;

  /** An initiative's map ticket, and the step tickets hanging under it. */
  function initiative(
    steps: Partial<Step>[],
  ): { tickets: Ticket[]; steps: Step[] } {
    const built = steps.map((overrides, index) => ({
      number: 51 + index,
      title: `${index + 1}. Piece ${index + 1}`,
      state: "open" as const,
      labels: ["timone"],
      assignees: [] as string[],
      blockedBy: [] as Step["blockedBy"],
      dependenciesIncomplete: false,
      ...overrides,
    }));
    return {
      tickets: [
        ticket(MAP, { labels: ["timone", MAP_LABEL] }),
        ...built.map((step) =>
          ticket(step.number, { title: step.title, labels: step.labels }),
        ),
      ],
      steps: built,
    };
  }

  function trackerFor(
    marked: Ticket[],
    steps: Step[],
  ): { adapter: TicketingAdapter; labelled: { number: number; label: string }[] } {
    const base = fakeAdapter({ alpha: marked });
    const labelled: { number: number; label: string }[] = [];
    return {
      adapter: {
        ...base.adapter,
        async listSteps(): Promise<Step[]> {
          return steps.map((step) => ({ ...step }));
        },
        async applyLabel(_project, number, label): Promise<void> {
          labelled.push({ number, label });
        },
      },
      labelled,
    };
  }

  /** (1) Steps 1–2 closed → step 3 is the one that gets a run. */
  it("opens a run on the first step that is not done", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([
      { state: "closed" },
      { state: "closed" },
      {},
    ]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.runsForTicket("alpha", 53)).toHaveLength(1);
    expect(store.runsForTicket("alpha", 51)).toEqual([]);
    expect(store.runsForTicket("alpha", 52)).toEqual([]);
  });

  /**
   * The map ticket is marked — it is the ticket the human filed — and it must
   * never get a run of its own, or the daemon works the initiative and its
   * steps at the same time.
   */
  it("never opens a run on the map ticket", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([{}, {}]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.runsForTicket("alpha", MAP)).toEqual([]);
  });

  /** Fourteen marked steps must not become fourteen runs at once. */
  it("opens one run, not one per step", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative(Array.from({ length: 14 }, () => ({})));
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    const opened = steps.filter(
      (step) => store.runsForTicket("alpha", step.number).length > 0,
    );
    expect(opened.map((step) => step.number)).toEqual([51]);
  });

  /**
   * (2) A step the machine dropped stays dropped. The hold label is the only
   * thing keeping it out of the frontier, so this is the case that proves the
   * whole of `timone cancel` still means something a cycle later.
   */
  it("leaves a held step alone and takes the next one instead", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([
      { labels: ["timone", HELD_LABEL] },
      {},
    ]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.runsForTicket("alpha", 51)).toEqual([]);
    expect(store.runsForTicket("alpha", 52)).toHaveLength(1);
  });

  /** A step a person took is theirs; the machine does not start it underneath them. */
  it("leaves a step a person has taken alone", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([{ assignees: ["fvermaut"] }, {}]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.runsForTicket("alpha", 51)).toEqual([]);
    expect(store.runsForTicket("alpha", 52)).toHaveLength(1);
  });

  /** A step waiting on an open one is not eligible, whatever its position. */
  it("skips a blocked step even when it sorts first", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([
      {
        blockedBy: [
          {
            number: 52,
            url: "https://github.com/fvermaut/scratch-app/issues/52",
            open: true,
          },
        ],
      },
      {},
    ]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.runsForTicket("alpha", 51)).toEqual([]);
    expect(store.runsForTicket("alpha", 52)).toHaveLength(1);
  });

  /**
   * The claim. Without it the next cycle sees the same step open, unheld and
   * unclaimed, and every ruling about dropping work is decoration.
   */
  it("holds the step it claims, so the next cycle leaves it alone", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([{}, {}]);
    const { adapter, labelled } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(labelled).toContainEqual({ number: 51, label: HELD_LABEL });
  });

  /** The machine never writes an assignee: that field is the human's half. */
  it("never assigns anybody to anything", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([{}, {}]);
    const { adapter, labelled } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    for (const step of steps) expect(step.assignees).toEqual([]);
    expect(labelled.every((entry) => entry.label !== "assignee")).toBe(true);
  });

  /** (4) Every step closed → nothing is taken up. */
  it("opens nothing when every step is closed", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([
      { state: "closed" },
      { state: "closed" },
    ]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    for (const step of steps) {
      expect(store.runsForTicket("alpha", step.number)).toEqual([]);
    }
  });

  /**
   * The cached picture — 29f renders from it and makes no forge call of its
   * own, so a cycle that does not write it leaves `timone status` with
   * nothing to say.
   */
  it("writes down what it saw, so status need not ask GitHub", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { tickets, steps } = initiative([{ state: "closed" }, {}, {}]);
    const { adapter } = trackerFor(tickets, steps);
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.initiativeFor("alpha", 52)).toMatchObject({
      initiative: MAP,
      steps: [51, 52, 53],
      done: 1,
      next: 52,
    });
  });

  /** A ticket that is nobody's step is untouched by any of this. */
  it("leaves an ordinary marked ticket exactly as it was", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    const { adapter } = fakeAdapter({ alpha: [ticket(3)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });

    expect(store.runsForTicket("alpha", 3)).toHaveLength(1);
  });
});

/**
 * 29e — a merged pull request closes **its step**, and only the last one
 * closes the initiative.
 *
 * Under one step, one ticket the run's ticket *is* the step, so the merge
 * path's old act — close `run.ticket` and say the initiative is finished —
 * would close the step while announcing the whole initiative on it.
 */
describe("closing: the step, then the initiative", () => {
  const MAP = 7;

  const step = (number: number, overrides: Partial<Step> = {}): Step => ({
    number,
    title: `${number - 50}. Piece ${number - 50}`,
    state: "open",
    labels: ["timone"],
    assignees: [],
    blockedBy: [],
    dependenciesIncomplete: false,
    ...overrides,
  });

  /**
   * A cycle in which `live`'s pull request has merged. `steps` is what the
   * tracker answers *after* that step is closed, which is what the closing
   * path reads.
   */
  async function mergeCycle(
    store: RunStore,
    live: number,
    pr: number,
    steps: Step[],
  ): Promise<{ closed: number[]; comments: PostedComment[] }> {
    const closed: number[] = [];
    const comments: PostedComment[] = [];
    const manifest = manifestWith("alpha");
    const tickets = [
      ticket(MAP, { labels: ["timone", MAP_LABEL] }),
      ...steps.map((s) => ticket(s.number, { title: s.title, labels: s.labels })),
    ];
    const merged = {
      number: pr,
      title: "the piece",
      url: `https://github.com/fvermaut/scratch-app/pull/${pr}`,
      state: "merged" as const,
      headSha: "abc",
    };
    const base = fakeAdapter({ alpha: tickets });
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async listSteps(): Promise<Step[]> {
        return steps.map((s) => ({
          ...s,
          state: s.number === live ? "closed" : s.state,
        }));
      },
      async applyLabel(): Promise<void> {},
      async postComment(project, number, body): Promise<void> {
        comments.push({ project: project.name, number, body });
      },
      async closeTicket(_project, number): Promise<void> {
        closed.push(number);
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return merged;
      },
      async aheadOfDefault(): Promise<number | undefined> {
        return 0;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return { ...merged, comments: [] };
      },
    };
    const runner = endingOnMerge({ store, adapter, manifest });

    await pollOnce({
      manifest,
      store,
      adapter,
      runner,
    });
    await runner.drain();
    return { closed, comments };
  }

  /** Puts `step` into the ledger as a delivered run whose PR is `pr`. */
  function delivered(store: RunStore, step: number, pr: number): void {
    const { run } = store.register("alpha", step);
    store.activate(run.id, `session-${step}`);
    store.claimBranch(run.id, `timone/${step}-piece`);
    store.recordPullRequest(run.id, pr);
    store.park(run.id, {
      waitingOn: `your review of pull request #${pr}`,
      kind: "runner",
      resolvableBy: ["delivery"],
    });
  }

  /** (1) A merge closes the step, and leaves the initiative open. */
  it("closes the step and not the initiative when another step is open", async () => {
    const store = newStore();
    store.rememberInitiative({
      project: "alpha",
      initiative: MAP,
      title: "the lists could be smarter",
      steps: [51, 52],
      done: 0,
      next: 51,
    });
    delivered(store, 51, 90);

    const { closed, comments } = await mergeCycle(store, 51, 90, [
      step(51),
      step(52),
    ]);

    expect(closed).toContain(51);
    expect(closed).not.toContain(MAP);
    // And nothing is said on the initiative: its closing words are owed only
    // when its last step closes.
    expect(comments.filter((comment) => comment.number === MAP)).toEqual([]);
  });

  /** (2) The last merge closes both. */
  it("closes the initiative when its last step closes", async () => {
    const store = newStore();
    store.rememberInitiative({
      project: "alpha",
      initiative: MAP,
      title: "the lists could be smarter",
      steps: [51],
      done: 0,
      next: 51,
    });
    delivered(store, 51, 90);

    const { closed } = await mergeCycle(store, 51, 90, [step(51)]);

    expect(closed).toContain(51);
    expect(closed).toContain(MAP);
  });

  /**
   * (3) File order is not doneness. The merged step is last in the list and
   * an earlier one is still open, so the initiative stays open.
   */
  it("does not close the initiative when an earlier step is still open", async () => {
    const store = newStore();
    store.rememberInitiative({
      project: "alpha",
      initiative: MAP,
      title: "the lists could be smarter",
      steps: [51, 52],
      done: 0,
      next: 52,
    });
    delivered(store, 52, 91);

    const { closed } = await mergeCycle(store, 52, 91, [step(51), step(52)]);

    expect(closed).toContain(52);
    expect(closed).not.toContain(MAP);
  });

  /**
   * (4) A dropped step does not stop the initiative closing, and the closing
   * comment says what was actually delivered. An initiative that refuses to
   * close because one step was abandoned is a thread that never ends.
   */
  it("closes with the count delivered when a step was dropped", async () => {
    const store = newStore();
    store.rememberInitiative({
      project: "alpha",
      initiative: MAP,
      title: "the lists could be smarter",
      steps: [51, 52],
      done: 0,
      next: 52,
    });
    // 51 was dropped: a run that was cancelled, and no pull request.
    const dropped = store.register("alpha", 51).run;
    store.cancel(dropped.id, "not worth doing after all");
    delivered(store, 52, 91);

    const { closed, comments } = await mergeCycle(store, 52, 91, [
      step(51, { state: "closed" }),
      step(52),
    ]);

    expect(closed).toContain(MAP);
    const closing = comments.find((comment) => comment.number === MAP)?.body ?? "";
    expect(closing).toContain("1 of 2");
    expect(closing.toLowerCase()).toContain("dropped");
  });

  /** A ticket in no initiative closes exactly as it always did. */
  it("leaves an ordinary ticket's closing untouched", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    delivered(store, 3, 92);
    const closed: number[] = [];
    const merged = {
      number: 92,
      title: "the work",
      url: "https://github.com/fvermaut/scratch-app/pull/92",
      state: "merged" as const,
      headSha: "abc",
    };
    const base = fakeAdapter({ alpha: [ticket(3)] });
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async closeTicket(_project, number): Promise<void> {
        closed.push(number);
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return merged;
      },
      async aheadOfDefault(): Promise<number | undefined> {
        return 0;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return { ...merged, comments: [] };
      },
    };
    const runner = endingOnMerge({ store, adapter, manifest });

    await pollOnce({
      manifest,
      store,
      adapter,
      runner,
    });
    await runner.drain();

    expect(closed).toEqual([3]);
  });
});

/**
 * R22 clause 6 under one step, one ticket — the queue is not starved.
 *
 * The old cover for this drove two chunks of one ticket and went with the
 * chunk model in 29g. The guarantee did not go with it.
 */
describe("a bug filed during a step takes the project before the next step", () => {
  const MAP = 7;

  const aStep = (number: number, overrides: Partial<Step> = {}): Step => ({
    number,
    title: `${number - 50}. Piece ${number - 50}`,
    state: "open",
    labels: ["timone"],
    assignees: [],
    blockedBy: [],
    dependenciesIncomplete: false,
    ...overrides,
  });

  it("promotes the waiting bug, and opens the next step behind it", async () => {
    const store = newStore();
    const manifest = manifestWith("alpha");
    store.rememberInitiative({
      project: "alpha",
      initiative: MAP,
      title: "the lists could be smarter",
      steps: [51, 52],
      done: 0,
      next: 51,
    });

    // Step 51 is out for review; a bug was filed while it was building.
    const { run } = store.register("alpha", 51);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/51-piece");
    store.recordPullRequest(run.id, 90);
    store.park(run.id, {
      waitingOn: "your review of pull request #90",
      kind: "runner",
      resolvableBy: ["delivery"],
    });
    store.register("alpha", 8);

    const steps = [aStep(51), aStep(52)];
    const tickets = [
      ticket(MAP, { labels: ["timone", MAP_LABEL] }),
      ticket(51),
      ticket(52),
      ticket(8),
    ];
    const base = fakeAdapter({ alpha: tickets });
    const merged = {
      number: 90,
      title: "the piece",
      url: "https://github.com/fvermaut/scratch-app/pull/90",
      state: "merged" as const,
      headSha: "abc",
    };
    // The tracker answers honestly across the cycle: step 51 is **open** when
    // the survey runs at the top of it, and closed only once the end of its
    // run has closed it. A fake that reported it closed from the start would
    // let the frontier take step 52 in the very cycle the bug is promoted, and
    // this test would be asserting a race that production does not have.
    const closed = new Set<number>();
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async listSteps(): Promise<Step[]> {
        return steps.map((s) => ({
          ...s,
          state: closed.has(s.number) ? "closed" : s.state,
        }));
      },
      async applyLabel(): Promise<void> {},
      async closeTicket(_project, number): Promise<void> {
        closed.add(number);
      },
      async findPullRequest(): Promise<PullRequest | undefined> {
        return merged;
      },
      async aheadOfDefault(): Promise<number | undefined> {
        return 0;
      },
      async getPullRequestThread(): Promise<PullRequestThread> {
        return { ...merged, comments: [] };
      },
    };
    const wakes: string[] = [];
    const runner = endingOnMerge({ store, adapter, manifest }, wakes);
    const deps = {
      manifest,
      store,
      adapter,
      runner,
    };

    await pollOnce(deps);
    await runner.drain();

    // The window: the step is finished, the bug holds the project, and no run
    // exists for step 52 at all yet.
    expect(store.get("alpha#51/1")?.status).toBe("done");
    expect(store.get("alpha#8/1")?.status).toBe("picked-up");
    expect(store.runsForTicket("alpha", 52)).toEqual([]);

    // The next cycle hands on the bug, and opens step 52 behind it. Asserted
    // on the wakes, not on two log lines: the bug is the run handed on.
    await pollOnce(deps);
    await runner.drain();

    expect(wakes).toContain("alpha#8/1");
    expect(wakes).not.toContain("alpha#52/1");
    expect(store.runsForTicket("alpha", 52).map((each) => each.status)).toEqual(["queued"]);
  });
});

describe("a project called `timone` is a project like any other", () => {
  it("registers a run and picks it up", async () => {
    // ADR-0050 D1. Nothing in the loop may treat Timone's own name specially:
    // what makes a self-run different is the repository, and the repository is
    // the harness rule's business (32b), not the pickup's.
    const store = newStore();
    const manifest = manifestWith("timone");
    const { adapter, comments } = fakeAdapter({ timone: [ticket(39)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
    });

    expect(result.pickedUp).toEqual(["timone#39/1"]);
    expect(store.occupyingRun("timone")?.ticket).toBe(39);
    expect(comments[0]).toMatchObject({ project: "timone", number: 39 });
  });
});

/** One wake the cycle asked the runner for. */
interface AskedWake {
  runId: string;
  events: string[];
  options: WakeOptions;
}

/**
 * A stand-in for the runner's sessions: it writes down every wake and every
 * stop it is asked for, and does nothing else. `never` makes each wake a
 * promise that never settles — a runner whose session, or the step it
 * started, goes on for ever.
 */
function fakeWakes(settles: "at-once" | "never" = "at-once"): {
  sessions: ReturnType<RunnerDriverDeps["sessionsFor"]>;
  wakes: AskedWake[];
  stops: string[];
} {
  const wakes: AskedWake[] = [];
  const stops: string[] = [];
  return {
    sessions: {
      wake(run, events, options = {}) {
        wakes.push({ runId: run.id, events: [...events], options });
        return settles === "never" ? new Promise<void>(() => {}) : Promise.resolve();
      },
      stop(runId) {
        stops.push(runId);
      },
    },
    wakes,
    stops,
  };
}

/**
 * The real driver over the test's store and forge, with its record kept in a
 * fresh folder, and a runner that is never really started.
 */
function runnerFor(
  deps: Pick<RunnerDriverDeps, "store" | "adapter" | "manifest"> &
    Partial<Pick<RunnerDriverDeps, "running" | "consult" | "clock">> & {
      sessions: ReturnType<RunnerDriverDeps["sessionsFor"]>;
    },
): { runner: RunnerDriver; root: string } {
  const root = mkdtempSync(join(tmpdir(), "timone-runner-"));
  tempDirs.push(root);
  const runner = new RunnerDriver({
    store: deps.store,
    adapter: deps.adapter,
    manifest: deps.manifest,
    root,
    sessionsFor: () => deps.sessions,
    running: deps.running ?? new RunningSteps(),
    consult: deps.consult ?? (async () => undefined),
    startStep: async () => {
      throw new Error("no step starts in this test");
    },
    timonePin: async () => undefined,
    clock: deps.clock ?? (() => "2026-09-27T12:00:00Z"),
    log: () => {},
  });
  return { runner, root };
}

/**
 * The real driver, over a runner that does what a runner does once it hears
 * that a run's pull request was merged: it ends the run and closes its
 * ticket, through the real actions. It does nothing on any other wake. Each
 * run it is woken for is written down in `woken`.
 */
function endingOnMerge(
  deps: Pick<RunnerDriverDeps, "store" | "adapter" | "manifest">,
  woken: string[] = [],
): RunnerDriver {
  const root = mkdtempSync(join(tmpdir(), "timone-runner-"));
  tempDirs.push(root);
  return new RunnerDriver({
    store: deps.store,
    adapter: deps.adapter,
    manifest: deps.manifest,
    root,
    sessionsFor: (actionsFor) => ({
      async wake(run, events) {
        woken.push(run.id);
        if (run.pr === undefined || !events.includes(pullRequestEvent(run.pr, "merged"))) return;
        await runnerActions(actionsFor(run), run).endRun({
          reason: `Pull request #${run.pr} was merged.`,
          closeTicket: true,
        });
      },
      stop() {},
    }),
    running: new RunningSteps(),
    consult: async () => undefined,
    startStep: async () => {
      throw new Error("no step starts in this test");
    },
    timonePin: async () => undefined,
    clock: () => "2026-09-27T12:00:00Z",
    log: () => {},
  });
}

/**
 * A forge for the runner's tests: the project's marked tickets, each with the
 * comments the test gives it, and the pull requests it gives. Built on
 * {@link fakeAdapter}, so every call no test here is about behaves as there.
 */
function runnerAdapter(
  tickets: Ticket[],
  given: {
    comments?: Record<number, TicketThread["comments"]>;
    pulls?: Record<number, PullRequestThread>;
  } = {},
): { adapter: TicketingAdapter; comments: PostedComment[] } {
  const base = fakeAdapter({ "scratch-app": tickets });
  return {
    comments: base.comments,
    adapter: {
      ...base.adapter,
      async getTicket(_project, number): Promise<TicketThread> {
        const found = tickets.find((candidate) => candidate.number === number);
        if (found === undefined) throw new Error(`no ticket ${number}`);
        return { ...found, comments: given.comments?.[number] ?? [] };
      },
      async getPullRequestThread(_project, number): Promise<PullRequestThread> {
        const found = given.pulls?.[number];
        if (found === undefined) throw new Error(`no pull request ${number}`);
        return found;
      },
    },
  };
}

/** A comment by a person, as the forge hands it over. */
function personSaid(author: string, body: string, createdAt: string): TicketThread["comments"][number] {
  return { author, body, createdAt, fromTimone: false };
}

/** A run of ticket `number` waiting for the runner, as a wake leaves it. */
function waitingForRunner(store: RunStore, number: number, project = "scratch-app"): Run {
  const { run } = store.register(project, number);
  return store.park(run.id, {
    waitingOn: "the next thing that happens on this ticket",
    kind: "runner",
    resolvableBy: ["triage"],
  });
}

/** Pull request #19 of ticket 7's run, in `state`, with what was said on it. */
function pullRequest19(
  state: "open" | "merged" | "closed",
  comments: PullRequestThread["comments"] = [],
): PullRequestThread {
  return {
    number: 19,
    title: "A due date on each task",
    url: "https://github.com/fvermaut/scratch-app/pull/19",
    state,
    headSha: "aaaaaaa",
    comments,
  };
}

/** A run of ticket 7 that opened pull request #19, and now waits for the runner. */
function waitingWithPullRequest(store: RunStore): Run {
  const { run } = store.register("scratch-app", 7);
  store.claimBranch(run.id, "timone/7-due-dates");
  store.recordPullRequest(run.id, 19);
  return store.park(run.id, {
    waitingOn: "your review of pull request #19",
    kind: "runner",
    resolvableBy: ["delivery"],
  });
}

/** Every entry of ticket 7's record on scratch-app, or the test fails. */
function recordOf7(root: string): RecordEntry[] {
  const read = readRecord(root, "scratch-app", 7);
  if (!read.ok) throw new Error(read.error.message);
  return read.value;
}

/**
 * Leave ticket 7's record where a step that cost $150.40 left it: over the
 * $150 limit, and the ticket told so at 11:00:02.
 */
function spentItsLimit(root: string, runId: string): void {
  const entries: RecordEntry[] = [
    {
      kind: "step-ended",
      at: "2026-08-02T11:00:00Z",
      runId,
      stage: "execution",
      sessionId: "step-session-1",
      ok: true,
      costUsd: 150.4,
    },
    { kind: "limit-reached", at: "2026-08-02T11:00:01Z", spentUsd: 150.4 },
    { kind: "notice", at: "2026-08-02T11:00:02Z", about: "limit" },
  ];
  for (const entry of entries) appendEntry(root, "scratch-app", 7, entry);
}

describe("the runner drives its projects in the poll cycle", () => {
  it("asks the runner to wake for a new ticket", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: "scratch-app#7/1",
        events: ["A new ticket was picked up. Nothing has been done on it yet."],
        options: {},
      },
    ]);
  });

  it("asks the runner to wake for a named person's comment, with their words", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    const { adapter } = runnerAdapter([ticket(7)], {
      comments: {
        7: [personSaid("fvermaut", "skip the interview, go straight to planning", "2026-08-03T09:00:00Z")],
      },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: run.id,
        events: [
          'fvermaut commented on the ticket at 2026-08-03T09:00:00Z: "skip the interview, go straight to planning"',
        ],
        options: {},
      },
    ]);
  });

  it("asks for no wake for a comment by someone who is not named for the project", async () => {
    // R10, falsified at the seam that wakes the runner: a public repository
    // lets anyone comment, and a stranger's "approved" must move nothing.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    waitingForRunner(store, 7);
    const { adapter } = runnerAdapter([ticket(7)], {
      comments: {
        7: [personSaid("drive-by-dave", "approved, merge it", "2026-08-03T09:00:00Z")],
      },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([]);
  });

  it("reaches a second project's named comment in the same cycle while the first project's step never ends (R15)", async () => {
    // #148: the old daemon awaited a session, so a project building for an
    // hour held every other project for that hour. Here the first project's
    // step never ends and the wake asked for it never settles, and the cycle
    // must still reach the second project, and still return.
    const store = newStore();
    const manifest = manifestWith("scratch-app", "ivtrends");
    const { run: building } = store.register("scratch-app", 7);
    store.activate(building.id, "step-session-1");
    const running = new RunningSteps();
    running.set(building.id, {
      stage: "execution",
      session: { sessionId: "step-session-1", completed: new Promise(() => {}), stop() {} },
      startedAt: "2026-09-27T12:00:00Z",
    });
    const waiting = waitingForRunner(store, 3, "ivtrends");
    const said: Record<string, TicketThread["comments"]> = {
      "scratch-app": [personSaid("fvermaut", "how far has it got?", "2026-08-03T09:00:00Z")],
      ivtrends: [personSaid("fvermaut", "try again", "2026-08-03T09:05:00Z")],
    };
    const base = fakeAdapter({ "scratch-app": [ticket(7)], ivtrends: [ticket(3)] });
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async getTicket(project, number): Promise<TicketThread> {
        return { ...ticket(number), comments: said[project.name] ?? [] };
      },
    };
    const { sessions, wakes } = fakeWakes("never");
    const { runner } = runnerFor({ store, adapter, manifest, sessions, running });

    await pollOnce({ manifest, store, adapter, runner });

    expect(wakes.map((wake) => wake.runId)).toEqual([building.id, waiting.id]);
    expect(wakes[1]?.events).toEqual([
      'fvermaut commented on the ticket at 2026-08-03T09:05:00Z: "try again"',
    ]);
  });

  it("asks the runner to wake when the run's pull request was merged, saying so", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingWithPullRequest(store);
    const { adapter } = runnerAdapter([ticket(7)], { pulls: { 19: pullRequest19("merged") } });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      { runId: run.id, events: ["Pull request #19 was merged."], options: {} },
    ]);
  });

  it("asks for no wake on a held ticket when only its pull request moved", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    waitingWithPullRequest(store);
    const held = ticket(7, { labels: ["timone", HELD_LABEL] });
    const { adapter } = runnerAdapter([held], { pulls: { 19: pullRequest19("merged") } });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([]);
  });

  it("wakes the runner on a held ticket for a named person's comment, and tells it only that", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingWithPullRequest(store);
    const held = ticket(7, { labels: ["timone", HELD_LABEL] });
    const { adapter } = runnerAdapter([held], {
      comments: { 7: [personSaid("fvermaut", "ok, carry on", "2026-08-03T09:00:00Z")] },
      pulls: { 19: pullRequest19("merged") },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: run.id,
        events: ['fvermaut commented on the ticket at 2026-08-03T09:00:00Z: "ok, carry on"'],
        options: {},
      },
    ]);
  });

  it("allows another limit and wakes the runner when a named person's reply to the limit means go on", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    const { adapter } = runnerAdapter([ticket(7)], {
      comments: {
        7: [personSaid("fvermaut", "yes keep going, it is worth it", "2026-08-03T09:00:00Z")],
      },
    });
    const asked: string[] = [];
    const consult = async (prompt: string): Promise<string | undefined> => {
      asked.push(prompt);
      return "YES";
    };
    const { sessions, wakes } = fakeWakes();
    const { runner, root } = runnerFor({ store, adapter, manifest, sessions, consult });
    spentItsLimit(root, run.id);

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(asked).toEqual([
      "A ticket reached its spending limit, and the machine asked whether to go on. " +
        "A person replied: yes keep going, it is worth it. " +
        "Does this reply mean they want the work to go on? Answer with one word: YES or NO.",
    ]);
    expect(recordOf7(root).filter((entry) => entry.kind === "limit-raised")).toEqual([
      {
        kind: "limit-raised",
        at: "2026-09-27T12:00:00Z",
        by: "fvermaut",
        commentAt: "2026-08-03T09:00:00Z",
      },
    ]);
    expect(wakes).toEqual([
      {
        runId: run.id,
        events: [
          'fvermaut commented on the ticket at 2026-08-03T09:00:00Z: "yes keep going, it is worth it"',
        ],
        options: {},
      },
    ]);
  });

  it("changes nothing at the limit when the check does not answer yes to a named person's reply", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    const { adapter } = runnerAdapter([ticket(7)], {
      comments: {
        7: [personSaid("fvermaut", "hmm, why did it cost so much?", "2026-08-03T09:00:00Z")],
      },
    });
    const consult = async (): Promise<string | undefined> => "NO. They are asking a question.";
    const { sessions, wakes } = fakeWakes();
    const { runner, root } = runnerFor({ store, adapter, manifest, sessions, consult });
    spentItsLimit(root, run.id);

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(recordOf7(root).filter((entry) => entry.kind === "limit-raised")).toEqual([]);
    expect(wakes).toEqual([]);
  });

  it("tells the ticket once that it spent its limit, frees the project, and wakes nothing, for a new run of a ticket over its limit", async () => {
    // R8: at the limit no session starts, the runner's included, and the
    // ticket says what was spent. With no runner session to say it, the
    // machine does, once. A new run left picked up would hold the project
    // with nothing working on it (R16), so it is put on the runner's wait.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { run: earlier } = store.register("scratch-app", 7);
    store.activate(earlier.id, "step-session-1");
    store.complete(earlier.id);
    const { run } = store.register("scratch-app", 7);
    const { adapter, comments } = runnerAdapter([ticket(7)]);
    const { sessions, wakes } = fakeWakes();
    const { runner, root } = runnerFor({ store, adapter, manifest, sessions });
    appendEntry(root, "scratch-app", 7, {
      kind: "step-ended",
      at: "2026-08-02T11:00:00Z",
      runId: earlier.id,
      stage: "execution",
      sessionId: "step-session-1",
      ok: true,
      costUsd: 150.4,
    });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();
    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([]);
    expect(comments.map((comment) => comment.body)).toEqual([
      "**This ticket has reached its spending limit.** It has cost $150.40, and the limit is $150.00. " +
        "I will not start any more work on it for now.\n\n" +
        "Nothing is done yet. Next, in the usual order: sorting the request.\n\n" +
        '**What I need from you:** reply "continue" to allow another $150.00, or say nothing and it stays stopped.',
    ]);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(store.occupyingRun("scratch-app")).toBeUndefined();
  });

  it("says where the work stands when the runner's own session takes the ticket over its limit while a step runs", async () => {
    // R8: the ticket says what was spent and where the work stands. Here the
    // steps that finished, the step still running, and what comes after it.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "step-session-3");
    const running = new RunningSteps();
    running.set(run.id, {
      stage: "execution",
      session: { sessionId: "step-session-3", completed: new Promise(() => {}), stop() {} },
      startedAt: "2026-09-27T11:40:00Z",
    });
    const { adapter, comments } = runnerAdapter([ticket(7, { labels: ["timone", "triage:chore"] })]);
    const { sessions, wakes } = fakeWakes();
    const { runner, root } = runnerFor({ store, adapter, manifest, sessions, running });
    const entries: RecordEntry[] = [
      { kind: "step-started", at: "2026-09-27T10:00:00Z", runId: run.id, stage: "triage", sessionId: "step-session-1" },
      { kind: "step-ended", at: "2026-09-27T10:05:00Z", runId: run.id, stage: "triage", sessionId: "step-session-1", ok: true, costUsd: 100 },
      { kind: "step-started", at: "2026-09-27T10:10:00Z", runId: run.id, stage: "planning", sessionId: "step-session-2" },
      { kind: "step-ended", at: "2026-09-27T11:30:00Z", runId: run.id, stage: "planning", sessionId: "step-session-2", ok: true, costUsd: 40 },
      { kind: "step-started", at: "2026-09-27T11:40:00Z", runId: run.id, stage: "execution", sessionId: "step-session-3" },
      { kind: "runner-ended", at: "2026-09-27T11:41:00Z", runId: run.id, ok: true, costUsd: 11 },
    ];
    for (const entry of entries) appendEntry(root, "scratch-app", 7, entry);

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([]);
    expect(comments.map((comment) => comment.body.split("\n\n")[1])).toEqual([
      "Done so far: sorting the request and preparing the work. Running now: building. " +
        "Next, in the usual order: checking the result.",
    ]);
  });

  it("settles a retry request left from before the command was removed, and says so once", async () => {
    // `timone retry` was removed on 2026-09-30. A request an older command
    // left beside the ledger is written here by hand, in the shape it wrote.
    const { store, statePath } = newStoreAt();
    const run = waitingForRunner(store, 31);
    mkdirSync(requestsDir(statePath), { recursive: true });
    const leftover = join(requestsDir(statePath), "2026-09-29T18-00-00-000Z-000000-0a1b2c3d.json");
    writeFileSync(
      leftover,
      `${JSON.stringify(
        {
          askedAt: "2026-09-29T18:00:00.000Z",
          askedBy: "fvermaut",
          body: { kind: "retry", project: "scratch-app", ticket: 31 },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(31)] });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, statePath, runner };

    const first = await pollOnce(deps);
    const second = await pollOnce(deps);
    await runner.drain();

    expect(first.applied).toEqual([]);
    expect(first.errors).toEqual([
      "could not apply retry scratch-app#31 asked by fvermaut: " +
        "the retry command was removed. Write on the ticket instead: say what you want done.",
    ]);
    expect(readdirSync(requestsDir(statePath))).toEqual([]);
    expect(second.applied).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(store.get(run.id)).toEqual(run);
  });

  it("stops the running step and the runner's session when a runner project's run is cancelled", async () => {
    // PRD-05 R11: `timone cancel` stays, and stops any running session.
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "step-session-1");
    const running = new RunningSteps();
    let stepStops = 0;
    running.set(run.id, {
      stage: "execution",
      session: {
        sessionId: "step-session-1",
        completed: new Promise(() => {}),
        stop() {
          stepStops += 1;
        },
      },
      startedAt: "2026-09-27T12:00:00Z",
    });
    enqueue(statePath, {
      kind: "cancel",
      project: "scratch-app",
      ticket: 7,
      reason: "not needed any more",
    });
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, stops } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions, running });

    const result = await pollOnce({ manifest, store, adapter, statePath, runner });
    await runner.drain();

    expect(result.applied).toEqual(["cancel scratch-app#7"]);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(stops).toEqual([run.id]);
    expect(stepStops).toBe(1);
  });

  it("puts a runner project's run back on the runner's wait when the daemon stopped while its step ran, and wakes the runner", async () => {
    // R16's third clause: the run is not failed for a machine stopping, and
    // it is not left holding the project with nothing working on it.
    const dir = mkdtempSync(join(tmpdir(), "timone-runner-reclaim-"));
    tempDirs.push(dir);
    let instant = "2026-09-04T10:00:00Z";
    const store = RunStore.open(join(dir, ".timone", "state.json"), {
      now: () => instant,
      livenessOf: () => "gone",
    });
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "step-session-1", {
      token: "token-4213",
      command: `timone daemon ${run.id}`,
      pid: 4213,
      since: "2026-09-04T10:00:00Z",
      observedAt: "2026-09-04T10:00:00Z",
      host: "fvermaut-mac",
    });
    instant = "2026-09-04T10:09:00Z";
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner, staleAfterMs: 4 * 30 * 1000 });
    await runner.drain();

    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(wakes).toEqual([
      { runId: run.id, events: ["The daemon stopped while a step was running."], options: {} },
    ]);
    expect(comments).toEqual([]);
  });

  it("hands a run the runner waits on to the terminal, and wakes the runner once the terminal gives it back", async () => {
    // PRD-05 R11: when a takeover's session ends, the runner wakes and reads
    // what it left. While the terminal holds the run, nothing wakes it.
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 6);
    enqueue(statePath, { kind: "claim-takeover", project: "scratch-app", ticket: 6 });
    const { adapter } = runnerAdapter([ticket(6)], {
      comments: { 6: [personSaid("fvermaut", "I am looking at it myself", "2026-08-17T09:00:00Z")] },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, statePath, runner };

    const claiming = await pollOnce(deps);
    await runner.drain();

    expect(claiming.applied).toEqual(["claim-takeover scratch-app#6"]);
    expect(store.get(run.id)?.status).toBe("active");
    expect(wakes).toEqual([]);

    enqueue(statePath, {
      kind: "release-takeover",
      project: "scratch-app",
      ticket: 6,
      outcome: "ended",
    });
    const releasing = await pollOnce(deps);
    await runner.drain();

    expect(releasing.applied).toEqual(["release-takeover scratch-app#6"]);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(wakes[0]).toEqual({
      runId: run.id,
      events: ["The terminal session ended."],
      options: {},
    });
  });

  it("wakes the runner on its first cycle when a terminal session ended while no daemon was running", async () => {
    // PRD-05 R11: the takeover gave the run back itself, since nothing held
    // the ledger, and left this request so the runner still reads what the
    // session left.
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 6);
    enqueue(statePath, { kind: "takeover-ended", project: "scratch-app", ticket: 6 });
    const { adapter } = runnerAdapter([ticket(6)]);
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, statePath, runner });
    await runner.drain();

    expect(result.applied).toEqual(["takeover-ended scratch-app#6"]);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(wakes).toEqual([{ runId: run.id, events: ["The terminal session ended."], options: {} }]);
  });

  it("checks on a running step every 15 minutes, with what it did since the last check (R12)", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "step-session-1");
    const running = new RunningSteps();
    running.set(run.id, {
      stage: "execution",
      session: { sessionId: "step-session-1", completed: new Promise(() => {}), stop() {} },
      startedAt: "2026-09-27T12:00:00Z",
    });
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    let now = "2026-09-27T12:14:59Z";
    const { runner } = runnerFor({ store, adapter, manifest, sessions, running, clock: () => now });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    now = "2026-09-27T12:15:00Z";
    await pollOnce(deps);
    now = "2026-09-27T12:29:59Z";
    await pollOnce(deps);
    now = "2026-09-27T12:30:00Z";
    await pollOnce(deps);
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: run.id,
        events: ["A 15-minute check on the running step."],
        options: { checkSince: "2026-09-27T12:00:00Z" },
      },
      {
        runId: run.id,
        events: ["A 15-minute check on the running step."],
        options: { checkSince: "2026-09-27T12:15:00Z" },
      },
    ]);
  });

  it("tells the runner once that its run's ticket was closed, or its mark removed", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    // The listing no longer holds #7; the ticket itself can still be read.
    const base = fakeAdapter({ "scratch-app": [] });
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async getTicket(): Promise<TicketThread> {
        return { ...ticket(7), comments: [] };
      },
    };
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      { runId: run.id, events: ["The ticket was closed, or its mark was removed."], options: {} },
    ]);
  });

  it("wakes the runner for a new step ticket, though the ticket carries the label that claims it", async () => {
    // On a step ticket the hold label is the machine's own claim, applied at
    // pickup (ADR-0044 D7), not a person's or the runner's hold. Read as a
    // hold, it would keep every new step's run from ever being woken.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 20);
    const map = ticket(19, { labels: ["timone", MAP_LABEL] });
    const claimed = ticket(20, { labels: ["timone", HELD_LABEL] });
    const base = fakeAdapter({ "scratch-app": [map, claimed] });
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async listSteps(): Promise<Step[]> {
        return [
          {
            number: 20,
            title: claimed.title,
            state: "open",
            labels: claimed.labels,
            assignees: [],
            blockedBy: [],
            dependenciesIncomplete: false,
          },
        ];
      },
    };
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: run.id,
        events: ["A new ticket was picked up. Nothing has been done on it yet."],
        options: {},
      },
    ]);
  });

  it("asks the runner to wake for a named person's comment on the run's pull request", async () => {
    // R9 and #147: a change asked for on the pull request reaches the runner,
    // which replies there before the step that makes it starts.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const run = waitingWithPullRequest(store);
    const { adapter } = runnerAdapter([ticket(7)], {
      pulls: {
        19: pullRequest19("open", [
          personSaid("fvermaut", "please show late tasks in red, not orange", "2026-08-03T09:00:00Z"),
        ]),
      },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: run.id,
        events: [
          'fvermaut commented on the pull request at 2026-08-03T09:00:00Z: "please show late tasks in red, not orange"',
        ],
        options: {},
      },
    ]);
  });

  it("asks for one wake for a named person's comment, however many cycles read it", async () => {
    // Each wake is a runner session, and each session costs money: a comment
    // read again every minute would spend the ticket's limit on one sentence.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    waitingForRunner(store, 7);
    const { adapter } = runnerAdapter([ticket(7)], {
      comments: { 7: [personSaid("fvermaut", "go back to planning", "2026-08-03T09:00:00Z")] },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    await pollOnce(deps);
    await pollOnce(deps);
    await runner.drain();

    expect(wakes).toHaveLength(1);
  });
});

/**
 * A forge whose one marked ticket, #7 on scratch-app, keeps the labels put on
 * it: each `applyLabel` shows in the next listing, as on GitHub. Built on
 * {@link fakeAdapter}, so every other call behaves as there.
 */
function labellingAdapter(): { adapter: TicketingAdapter; applied: string[] } {
  const labels = ["timone"];
  const applied: string[] = [];
  const listed = (): Ticket[] => [ticket(7, { labels: [...labels] })];
  const base = fakeAdapter({ "scratch-app": [] });
  return {
    applied,
    adapter: {
      ...base.adapter,
      async listMarkedTickets(): Promise<Ticket[]> {
        return listed();
      },
      async listOpenTickets(): Promise<Ticket[]> {
        return listed();
      },
      async getTicket(): Promise<TicketThread> {
        return { ...ticket(7, { labels: [...labels] }), comments: [] };
      },
      async ensureLabel(): Promise<void> {},
      async applyLabel(_project, number, label): Promise<void> {
        applied.push(`#${number} ${label}`);
        if (!labels.includes(label)) labels.push(label);
      },
    },
  };
}

describe("a cancel on a runner project holds the ticket (40u)", () => {
  it("puts the hold on the ticket, and takes it up as no new run on the next cycle", async () => {
    // Verification of phase 40, found outside the verdicts, item 2: the ticket
    // stayed open and marked after the cancel, so the daemon took it up again
    // as a new run within seconds. The dropped-step rule (ADR-0044) applied
    // to a runner ticket: the hold keeps it, until a person takes it off.
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    enqueue(statePath, {
      kind: "cancel",
      project: "scratch-app",
      ticket: 7,
      reason: "not needed any more",
    });
    const { adapter, applied } = labellingAdapter();
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const deps = { manifest, store, adapter, statePath, runner };

    const cancelling = await pollOnce(deps);
    await runner.drain();
    const next = await pollOnce(deps);
    await runner.drain();

    expect(cancelling.applied).toEqual(["cancel scratch-app#7"]);
    expect(applied).toEqual([`#7 ${HELD_LABEL}`]);
    expect(store.runsForTicket("scratch-app", 7).map((each) => [each.id, each.status])).toEqual([
      [run.id, "cancelled"],
    ]);
    expect(next.pickedUp).toEqual([]);
    expect(wakes).toEqual([]);
  });
});

describe("a runner refused a step because its project was busy is woken once it is free (40u)", () => {
  it("wakes the refused run once, when the other ticket's run has finished and its ticket closed", async () => {
    // Verification of phase 40, found outside the verdicts, item 1, as the
    // check saw it: two tickets picked up together, one runner refused a
    // step, and after the other ticket's run finished and its ticket closed,
    // the refused ticket was never woken again.
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const marked = { "scratch-app": [ticket(7), ticket(8)] };
    const { adapter } = fakeAdapter(marked);
    const first = waitingForRunner(store, 7);
    const { run: second } = store.register("scratch-app", 8);
    const { sessions, wakes } = fakeWakes();
    const { runner, root } = runnerFor({ store, adapter, manifest, sessions });
    // The refusal as the runner's actions write it down.
    appendEntry(root, "scratch-app", 7, {
      kind: "decision",
      at: "2026-09-27T11:59:00Z",
      runId: first.id,
      action: "start_step",
      reason: "A new ticket starts with sorting.",
      detail:
        "Refused: The step did not start: Project scratch-app already has a session for run " +
        `${second.id} (picked-up) — one session per project at a time`,
    });
    const deps = { manifest, store, adapter, runner };

    await pollOnce(deps);
    await runner.drain();
    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([]);

    store.activate(second.id, "step-session-2");
    store.complete(second.id);
    marked["scratch-app"] = [ticket(7)];
    await pollOnce(deps);
    await pollOnce(deps);
    await runner.drain();

    expect(wakes.filter((wake) => wake.runId === first.id)).toEqual([
      { runId: first.id, events: ["The project is free now."], options: {} },
    ]);
  });
});

describe("a runner ticket cancelled while the cycle walks its project is not taken up from the old listing (40u)", () => {
  /**
   * A forge whose one marked ticket, #7, is listed as it was when the listing
   * was read, while `during` runs: the cancel watch carrying out a cancel of
   * its run at that moment. Every later read of the ticket sees the labels
   * the carry-out put on it.
   */
  function listedBeforeTheHold(during: (labels: string[]) => void): TicketingAdapter {
    const labels = ["timone"];
    const base = fakeAdapter({ "scratch-app": [] });
    return {
      ...base.adapter,
      async listMarkedTickets(): Promise<Ticket[]> {
        const listed = [ticket(7, { labels: [...labels] })];
        during(labels);
        return listed;
      },
      async listOpenTickets(): Promise<Ticket[]> {
        return [ticket(7, { labels: [...labels] })];
      },
      async getTicket(): Promise<TicketThread> {
        return { ...ticket(7, { labels: [...labels] }), comments: [] };
      },
    };
  }

  it("opens no new run when the hold went on after the listing was read", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    const adapter = listedBeforeTheHold((labels) => {
      store.cancel(run.id, "not needed any more");
      labels.push(HELD_LABEL);
    });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, statePath, runner });
    await runner.drain();

    expect(result.pickedUp).toEqual([]);
    expect(store.runsForTicket("scratch-app", 7).map((each) => each.status)).toEqual(["cancelled"]);
  });

  it("opens no new run while the cancel of its run is still being carried out", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    // The run is cancelled in the ledger, and the request is not settled yet:
    // the hold has not gone on.
    const adapter = listedBeforeTheHold(() => {
      enqueue(statePath, { kind: "cancel", project: "scratch-app", ticket: 7 });
      store.cancel(run.id, "not needed any more");
    });
    const { sessions } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      statePath,
      runner,
      cancelWatchIntervalMs: 60_000,
    });
    await runner.drain();

    expect(result.pickedUp).toEqual([]);
    expect(store.runsForTicket("scratch-app", 7).map((each) => each.status)).toEqual(["cancelled"]);
  });
});

/**
 * A project entry names no driver any more: the runner drives every project
 * (ADR-0060 D9), and the cycle has one path.
 */
describe("every project is driven by the runner", () => {
  const FOUR_INTERVALS = 4 * 30 * 1000;
  const POLL_INTERVAL = 60 * 1000;

  /**
   * A store whose clock the test sets, and whose idea of the process table
   * says every holder is `liveness`.
   */
  function heldStore(liveness: "gone" | "unknown"): {
    store: RunStore;
    set: (iso: string) => void;
  } {
    const dir = mkdtempSync(join(tmpdir(), "timone-one-path-"));
    tempDirs.push(dir);
    let instant = "2026-09-04T10:00:00Z";
    return {
      store: RunStore.open(join(dir, ".timone", "state.json"), {
        now: () => instant,
        livenessOf: () => liveness,
      }),
      set: (iso) => {
        instant = iso;
      },
    };
  }

  /** Leave the witness where a daemon polling right through would leave it. */
  function watchingSince(store: RunStore, from: string, to: string): void {
    for (let at = Date.parse(from); at < Date.parse(to); at += POLL_INTERVAL) {
      store.witness({
        unwitnessedAfterMs: 2 * POLL_INTERVAL,
        staleAfterMs: FOUR_INTERVALS,
        now: new Date(at).toISOString(),
      });
    }
  }

  /** A run of ticket 7 running a step, held by the daemon process 4213. */
  function stepRunning(store: RunStore): Run {
    const { run } = store.register("scratch-app", 7);
    return store.activate(run.id, "step-session-1", {
      token: "token-4213",
      command: `timone daemon ${run.id}`,
      pid: 4213,
      since: "2026-09-04T10:00:00Z",
      observedAt: "2026-09-04T10:00:00Z",
      host: "fvermaut-mac",
    });
  }

  it("asks the runner to wake for a new marked ticket on a project whose entry names no driver", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const { adapter } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([
      {
        runId: "scratch-app#7/1",
        events: ["A new ticket was picked up. Nothing has been done on it yet."],
        options: {},
      },
    ]);
  });

  it("reaches a second project's named comment in the same cycle while the first project's step never ends (R15)", async () => {
    // R15 without the split the old path needed: no project is walked first,
    // and none waits for a session. Both entries name no driver.
    const store = newStore();
    const manifest = manifestWith("scratch-app", "ivtrends");
    const { run: building } = store.register("scratch-app", 7);
    store.activate(building.id, "step-session-1");
    const running = new RunningSteps();
    running.set(building.id, {
      stage: "execution",
      session: { sessionId: "step-session-1", completed: new Promise(() => {}), stop() {} },
      startedAt: "2026-09-27T12:00:00Z",
    });
    const waiting = waitingForRunner(store, 3, "ivtrends");
    const said: Record<string, TicketThread["comments"]> = {
      "scratch-app": [personSaid("fvermaut", "how far has it got?", "2026-08-03T09:00:00Z")],
      ivtrends: [personSaid("fvermaut", "try again", "2026-08-03T09:05:00Z")],
    };
    const base = fakeAdapter({ "scratch-app": [ticket(7)], ivtrends: [ticket(3)] });
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async getTicket(project, number): Promise<TicketThread> {
        return { ...ticket(number), comments: said[project.name] ?? [] };
      },
    };
    const { sessions, wakes } = fakeWakes("never");
    const { runner } = runnerFor({ store, adapter, manifest, sessions, running });

    await pollOnce({ manifest, store, adapter, runner });

    expect(wakes.map((wake) => wake.runId)).toEqual([building.id, waiting.id]);
    expect(wakes[1]?.events).toEqual([
      'fvermaut commented on the ticket at 2026-08-03T09:05:00Z: "try again"',
    ]);
  });

  it("gives a run whose holder is gone back to the runner, and neither fails it nor starts it again", async () => {
    const { store, set } = heldStore("gone");
    const manifest = manifestWith("scratch-app");
    const run = stepRunning(store);
    set("2026-09-04T10:09:00Z");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, runner, staleAfterMs: FOUR_INTERVALS });
    await runner.drain();

    expect(result.reclaimed).toEqual([run.id]);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(wakes).toEqual([
      { runId: run.id, events: ["The daemon stopped while a step was running."], options: {} },
    ]);
    expect(comments).toEqual([]);
  });

  it("gives a run that went quiet while the daemon watched back to the runner, and does not fail it", async () => {
    const { store, set } = heldStore("unknown");
    const manifest = manifestWith("scratch-app");
    const run = stepRunning(store);
    watchingSince(store, "2026-09-04T10:00:00Z", "2026-09-04T10:09:00Z");
    set("2026-09-04T10:09:00Z");
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(7)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      staleAfterMs: FOUR_INTERVALS,
      pollIntervalMs: POLL_INTERVAL,
    });
    await runner.drain();

    expect(result.reclaimed).toEqual([run.id]);
    expect(store.get(run.id)).toMatchObject({ status: "parked", wait: { kind: "runner" } });
    expect(wakes).toEqual([
      { runId: run.id, events: ["The daemon stopped while a step was running."], options: {} },
    ]);
    expect(comments).toEqual([]);
  });

  it("stops the running step and the runner's session when a cancel is asked for", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "step-session-1");
    const running = new RunningSteps();
    let stepStops = 0;
    running.set(run.id, {
      stage: "execution",
      session: {
        sessionId: "step-session-1",
        completed: new Promise(() => {}),
        stop() {
          stepStops += 1;
        },
      },
      startedAt: "2026-09-27T12:00:00Z",
    });
    enqueue(statePath, { kind: "cancel", project: "scratch-app", ticket: 7 });
    const { adapter } = labellingAdapter();
    const { sessions, stops } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions, running });

    const result = await pollOnce({ manifest, store, adapter, statePath, runner });
    await runner.drain();

    expect(result.applied).toEqual(["cancel scratch-app#7"]);
    expect(store.get(run.id)?.status).toBe("cancelled");
    expect(stops).toEqual([run.id]);
    expect(stepStops).toBe(1);
  });
});

/**
 * A ticket whose run ended is not taken up again while its approved list of
 * pieces says there is nothing more to build, or has grown since a person
 * approved it (ADR-0028 D3, ADR-0030 D2). The check is made at pickup, before
 * the ledger is touched.
 */
describe("a ticket's next run waits on what a person approved, on a runner project", () => {
  /**
   * A workspace root whose scratch-app checkout holds ticket 6's list of
   * pieces: `titles`, stamped approved for `pieces` of them.
   */
  function approvedList(
    titles: string[],
    pieces = titles.length,
  ): { breakdownSource: SyncBreakdownSource } {
    const root = mkdtempSync(join(tmpdir(), "timone-root-"));
    tempDirs.push(root);
    const file = join(root, "projects", "scratch-app", breakdownPath(6));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      [
        "# Breakdown",
        "",
        `**Status:** Approved by fvermaut 2026-08-15 — ${pieces} pieces`,
        "",
        ...titles.map((title, index) => `${index + 1}. **${title}** — what this piece delivers.`),
        "",
      ].join("\n"),
      "utf8",
    );
    return breakdownIn(root);
  }

  /** Ticket 6's first run, ended once its pull request #9 merged. */
  function firstRunDone(store: RunStore): Run {
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "step-session-1");
    store.claimBranch(run.id, "timone/6-first-piece");
    store.recordPullRequest(run.id, 9);
    return store.complete(run.id);
  }

  it("opens no second run on a ticket whose approved pieces are all built", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const first = firstRunDone(store);
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(6)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const lines: string[] = [];

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      log: (line) => lines.push(line),
      ...approvedList(["The ledger learns chunks", "The next chunk opens"]),
    });
    await runner.drain();

    expect(store.runsForTicket("scratch-app", 6).map((run) => run.id)).toEqual([first.id]);
    expect(result.pickedUp).toEqual([]);
    expect(comments).toEqual([]);
    expect(wakes).toEqual([]);
    expect(lines).toContain("hold   scratch-app#6 — every piece the human approved has been built");
  });

  it("opens no second run on a ticket whose list of pieces grew since it was approved", async () => {
    const store = newStore();
    const manifest = manifestWith("scratch-app");
    const first = firstRunDone(store);
    const { adapter, comments } = fakeAdapter({ "scratch-app": [ticket(6)] });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });
    const lines: string[] = [];

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      runner,
      log: (line) => lines.push(line),
      // Three pieces listed, and the stamp says two were approved.
      ...approvedList(["The ledger learns chunks", "The next chunk opens", "A piece nobody read"], 2),
    });
    await runner.drain();

    expect(store.runsForTicket("scratch-app", 6).map((run) => run.id)).toEqual([first.id]);
    expect(result.pickedUp).toEqual([]);
    expect(comments).toEqual([]);
    expect(wakes).toEqual([]);
    expect(lines).toContain("hold   scratch-app#6 — the list of pieces has grown to 3 since 2 were approved");
  });
});

/**
 * A `timone cancel` left while the cycle is held by a slow call is carried
 * out before the cycle ends (ADR-0047, #69). On a runner project nothing in
 * the cycle waits for a session, but the forge can still be slow to answer.
 */
describe("a cancel left while a runner project's forge is slow to answer is carried out at once", () => {
  it("cancels the run, and stops the runner's work, while the slow call is still under way", async () => {
    const { store, statePath } = newStoreAt();
    const manifest = manifestWith("scratch-app");
    const run = waitingForRunner(store, 7);
    const { adapter: base } = labellingAdapter();
    let statusWhenAnswered: string | undefined;
    const adapter: TicketingAdapter = {
      ...base,
      // The listing is slow. The cancel is asked for while the cycle waits
      // on it, and the listing answers once the run is cancelled, or after
      // about a second.
      async listMarkedTickets(project): Promise<Ticket[]> {
        enqueue(statePath, {
          kind: "cancel",
          project: "scratch-app",
          ticket: 7,
          reason: "not needed any more",
        });
        for (let waited = 0; waited < 1000 && store.get(run.id)?.status !== "cancelled"; waited += 1) {
          await new Promise((done) => setTimeout(done, 1));
        }
        statusWhenAnswered = store.get(run.id)?.status;
        return base.listMarkedTickets(project);
      },
    };
    const { sessions, stops } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({
      manifest,
      store,
      adapter,
      statePath,
      runner,
      cancelWatchIntervalMs: 1,
    });
    await runner.drain();

    expect(statusWhenAnswered).toBe("cancelled");
    expect(stops).toEqual([run.id]);
    expect(result.applied).toEqual(["cancel scratch-app#7"]);
    expect(pending(statePath).requests).toEqual([]);
  });
});

/**
 * The ledger typed for 41c (`fixtures/ledger-before-166.json`, described in
 * `runs.test.ts`), copied into a throwaway directory and opened there, with a
 * clock that starts after everything in it.
 */
function storeOnLedgerBefore166(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-poll-"));
  tempDirs.push(dir);
  const path = join(dir, ".timone", "state.json");
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(
    fileURLToPath(new URL("./fixtures/ledger-before-166.json", import.meta.url)),
    path,
  );
  let tick = 0;
  return RunStore.open(path, {
    now: () => new Date(Date.parse("2026-09-30T10:00:00Z") + tick++ * 1000).toISOString(),
  });
}

/**
 * The forge beside that ledger. Every ticket of a run that is waiting is open
 * and marked, and pull request #31 is open. The done and cancelled runs'
 * tickets are closed, so they are not listed.
 *
 * `failedTickets` says how the failed runs' tickets stand. `open and marked`
 * is how the old code left them: it never took the mark off a failed run's
 * ticket, and never held it. `closed or not marked` is scratch-app #21 open
 * with its mark taken off, and ivtrends #88 closed.
 *
 * Nobody has written anything, except what `said` gives, keyed
 * `<project>#<ticket>`. Every write to the forge is written down in `writes`.
 */
function forgeBefore166(given: {
  failedTickets: "open and marked" | "closed or not marked";
  said?: Record<string, TicketThread["comments"]>;
}): {
  adapter: TicketingAdapter;
  writes: string[];
} {
  const said = given.said ?? {};
  const opened = (project: string, number: number, labels = ["timone"]): Ticket =>
    ticket(number, {
      labels,
      url: `https://github.com/fvermaut/${project}/issues/${number}`,
      createdAt: "2026-09-20T09:00:00Z",
    });
  const failedListed = given.failedTickets === "open and marked";
  const marked: Record<string, Ticket[]> = {
    "scratch-app": [...(failedListed ? [21] : []), 24].map((number) =>
      opened("scratch-app", number),
    ),
    ivtrends: [...(failedListed ? [88] : []), 90, 91, 92, 93, 94].map((number) =>
      opened("ivtrends", number),
    ),
  };
  const unmarked: Record<string, Ticket[]> = {
    "scratch-app": failedListed ? [] : [opened("scratch-app", 21, [])],
  };
  const writes: string[] = [];
  const { adapter } = fakeAdapter(marked);
  return {
    writes,
    adapter: {
      ...adapter,
      async listOpenTickets(project): Promise<Ticket[]> {
        return [...(marked[project.name] ?? []), ...(unmarked[project.name] ?? [])];
      },
      async getTicket(project, number): Promise<TicketThread> {
        const found = [...(marked[project.name] ?? []), ...(unmarked[project.name] ?? [])].find(
          (one) => one.number === number,
        );
        if (found === undefined) throw new Error(`no ticket ${number}`);
        return { ...found, comments: said[`${project.name}#${number}`] ?? [] };
      },
      async getPullRequestThread(project, number): Promise<PullRequestThread> {
        if (project.name !== "scratch-app" || number !== 31) {
          throw new Error(`no pull request ${number}`);
        }
        return {
          number: 31,
          title: "Sort tasks by due date",
          url: "https://github.com/fvermaut/scratch-app/pull/31",
          state: "open",
          headSha: "bbbbbbb",
          comments: [],
        };
      },
      async postComment(project, number, body): Promise<void> {
        writes.push(`comment on ${project.name}#${number}: ${body}`);
      },
      async applyLabel(project, number, label): Promise<void> {
        writes.push(`label ${label} on ${project.name}#${number}`);
      },
      async closeTicket(project, number): Promise<void> {
        writes.push(`closed ${project.name}#${number}`);
      },
      async postPullRequestComment(project, number, body): Promise<void> {
        writes.push(`comment on ${project.name} pull request #${number}: ${body}`);
      },
      async upsertPullRequestComment(project, number): Promise<void> {
        writes.push(`comment kept up to date on ${project.name} pull request #${number}`);
      },
    },
  };
}

describe("the runs the old code left in the ledger, on the first cycle after it was removed", () => {
  it("asks for no wake and posts nothing for a converted run when nobody has written anything, and no failed run's ticket is still open and marked", async () => {
    const store = storeOnLedgerBefore166();
    const manifest = manifestWith("scratch-app", "ivtrends");
    const { adapter, writes } = forgeBefore166({ failedTickets: "closed or not marked" });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes).toEqual([]);
    expect(writes).toEqual([]);
    expect(result.pickedUp).toEqual([]);
    expect(result.queued).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("asks for a wake when a named person writes on a converted run's ticket", async () => {
    const store = storeOnLedgerBefore166();
    const manifest = manifestWith("scratch-app", "ivtrends");
    // ivtrends #90 waited on a gate, and is now waiting for the runner.
    const { adapter } = forgeBefore166({
      failedTickets: "open and marked",
      said: { "ivtrends#90": [personSaid("fvermaut", "approved", "2026-09-30T09:30:00Z")] },
    });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(wakes.filter((wake) => wake.runId === "ivtrends#90/1")).toEqual([
      {
        runId: "ivtrends#90/1",
        events: ['fvermaut commented on the ticket at 2026-09-30T09:30:00Z: "approved"'],
        options: {},
      },
    ]);
  });

  it("picks a converted failed run's ticket up again as new work while it is still open and marked", async () => {
    // As any marked ticket with no run is (timone#166): the failed run is
    // cancelled now, and a cancelled run no longer holds its ticket. ivtrends
    // is free, so its ticket is picked up and the runner woken. scratch-app is
    // held by #24, parked on its branch, so its ticket queues behind it.
    const store = storeOnLedgerBefore166();
    const manifest = manifestWith("scratch-app", "ivtrends");
    const { adapter, writes } = forgeBefore166({ failedTickets: "open and marked" });
    const { sessions, wakes } = fakeWakes();
    const { runner } = runnerFor({ store, adapter, manifest, sessions });

    const result = await pollOnce({ manifest, store, adapter, runner });
    await runner.drain();

    expect(result.pickedUp).toEqual(["ivtrends#88/2"]);
    expect(result.queued).toEqual(["scratch-app#21/2"]);
    expect(wakes).toEqual([
      {
        runId: "ivtrends#88/2",
        events: ["A new ticket was picked up. Nothing has been done on it yet."],
        options: {},
      },
    ]);
    expect(writes).toEqual([
      expect.stringMatching(/^comment on scratch-app#21: \*\*This one is in the queue\.\*\*/),
      expect.stringMatching(/^comment on ivtrends#88: \*\*Picked this up\.\*\*/),
    ]);
    expect(result.errors).toEqual([]);
  });
});
