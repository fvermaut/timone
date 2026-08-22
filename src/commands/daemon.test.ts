import { generateKeyPairSync } from "node:crypto";
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
  Step,
  Ticket,
  TicketingAdapter,
} from "../adapters/ticketing.js";
import {
  noBranches,
  noFiles,
  noMerges, noStepWrites } from "../adapters/ticketing.stubs.js";
import { RunStore } from "../daemon/runs.js";
import { pollOnce, type SessionSpawner } from "../daemon/poll.js";
import { stateLockPath } from "../daemon/lock.js";
import {
  DEFAULT_IMAGE,
  DEFAULT_RUNTIME,
  machineAdapter,
  runDaemon,
  runtimeFor,
} from "./daemon.js";
import { agentSdkRuntime } from "../daemon/session.js";
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
    ...noBranches,
    ...noFiles,
    ...noMerges,
    ...noStepWrites,
    // No initiative in this test is broken into step tickets.
    async listSteps(): Promise<Step[]> {
      return [];
    },
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

describe("runDaemon — the loop reads a ticket's breakdown from the forge", () => {
  it("does not close over a list that has regrown, without any checkout on disk", async () => {
    // ✏ Rewritten by phase 30's 30d. This test used to build a real clone
    // under `projects/scratch-app`, commit the breakdown to its default
    // branch, and assert that `runDaemon` passed its root down far enough for
    // the poll loop to read the file — the plumbing being the subject.
    //
    // **That plumbing is gone.** The loop reads the approved list off the
    // project's default branch *on the forge*
    // ([ADR-0043](../../doc/adr/0043-the-humans-checkout-is-theirs-alone.md)),
    // so there is no root to pass and no checkout to build. The observable
    // end of the thread is unchanged and is still what is asserted: a list
    // that grew after it was approved must leave the ticket open, because the
    // human is asked rather than the ticket being finished on their behalf.
    //
    // The root handed to `runDaemon` below is a directory holding no
    // checkouts at all. A loop that had gone on reading disk would find
    // nothing, read that as "no breakdown", and close the ticket.
    const { store, statePath } = clockedStore();

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

    // The stamp names two pieces and the list holds three: a re-proposal.
    const breakdown = [
      "# Breakdown",
      "",
      "**Status:** Approved by fvermaut 2026-08-15 — 2 pieces",
      "",
      "1. **The ledger learns chunks** — a run carries its sequence number.",
      "2. **The next chunk opens** — a merged pull request opens the next one.",
      "3. **The ticket closes** — the last merge ends the conversation.",
      "",
    ].join("\n");

    const asked: { branch: string; path: string }[] = [];
    const closed: string[] = [];
    const merged: TicketingAdapter = {
      ...quietAdapter(),
      async readBranches() {
        return { defaultBranch: "main", defaultHead: "aaaaaaa" };
      },
      async readFile(_project, branch, path) {
        asked.push({ branch, path });
        return path.endsWith("ticket-07.md") ? breakdown : undefined;
      },
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
      root: noCheckouts,
      intervalMs: 60 * 1000,
      once: true,
      adapter: merged,
      spawner: idleSpawner,
      log: () => {},
    });

    expect(store.get("scratch-app#7/1")?.status).toBe("done");
    expect(closed).toEqual([]);
    // And it asked the forge, on the default branch, for the path the
    // breakdown lives at — rather than looking anywhere on disk.
    expect(asked).toContainEqual({
      branch: "main",
      path: "doc/plans/breakdowns/ticket-07.md",
    });
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

describe("the daemon acts under Timone's own identity, never a borrowed one", () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  /** A timone root with the App key on disk, and a manifest naming it. */
  function rootWithIdentity(): { root: string; manifest: Manifest } {
    const root = mkdtempSync(join(tmpdir(), "timone-identity-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".timone"), { recursive: true });
    writeFileSync(join(root, ".timone", "app.pem"), privateKey, { mode: 0o600 });

    return {
      root,
      manifest: {
        identity: {
          app_id: 4670926,
          installation_id: 155426497,
          private_key_path: ".timone/app.pem",
          login: "timone-agent[bot]",
        },
        projects: {
          "scratch-app": {
            repo_url: "https://github.com/fvermaut/scratch-app.git",
            path: "projects/scratch-app",
            stack: ["typescript"],
            bindings: { ticketing: "github" },
          },
        },
      },
    };
  }

  it("refuses to build a ticketing adapter when no identity is declared", () => {
    const { root, manifest } = rootWithIdentity();
    const { identity: _dropped, ...withoutIdentity } = manifest;

    expect(() => machineAdapter(withoutIdentity, root)).toThrow(/identity/);
  });

  it("names the manifest and says what it will not do instead", () => {
    const { root, manifest } = rootWithIdentity();
    const { identity: _dropped, ...withoutIdentity } = manifest;

    expect(() => machineAdapter(withoutIdentity, root)).toThrow(
      /never runs under (?:a|an) .*login/i,
    );
  });

  it("reaches the forge under a token scoped to the one repository", async () => {
    const { root, manifest } = rootWithIdentity();
    const calls: { args: string[]; env?: Record<string, string> }[] = [];
    const minted: string[][] = [];

    const adapter = machineAdapter(manifest, root, {
      run: async (_command, args, options) => {
        calls.push({ args, env: options?.env });
        return "[]";
      },
      mint: async (request) => {
        minted.push(request.repositories);
        return { token: "ghs_minted", expiresAt: "2099-01-01T00:00:00Z" };
      },
    });

    await adapter.listMarkedTickets({
      name: "scratch-app",
      repoUrl: "https://github.com/fvermaut/scratch-app.git",
    });

    expect(minted).toEqual([["scratch-app"]]);
    expect(calls[0].env?.GH_TOKEN).toBe("ghs_minted");
    expect(calls[0].args).not.toContain("ghs_minted");
  });

  it("resolves the key path against the timone root, not the process's cwd", async () => {
    const { root, manifest } = rootWithIdentity();

    const adapter = machineAdapter(manifest, root, {
      run: async () => "[]",
      mint: async () => ({
        token: "ghs_minted",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    });

    // The key exists only under `root`; a provider reading it relative to the
    // process's own directory would throw here.
    await expect(
      adapter.listMarkedTickets({
        name: "scratch-app",
        repoUrl: "https://github.com/fvermaut/scratch-app.git",
      }),
    ).resolves.toEqual([]);
  });

  it("tells its own comments by the login the manifest declares", async () => {
    const { root, manifest } = rootWithIdentity();
    const adapter = machineAdapter(manifest, root, {
      run: async () =>
        JSON.stringify({
          number: 7,
          title: "the page feels slow",
          body: "it drags",
          labels: [],
          url: "https://github.com/fvermaut/scratch-app/issues/7",
          author: { login: "fvermaut" },
          createdAt: "2026-08-02T10:00:00Z",
          comments: [
            {
              author: { login: "timone-agent[bot]" },
              body: "Picked this up.",
              createdAt: "2026-08-02T10:05:00Z",
            },
          ],
        }),
      mint: async () => ({
        token: "ghs_minted",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    });

    const thread = await adapter.getTicket(
      { name: "scratch-app", repoUrl: "https://github.com/fvermaut/scratch-app.git" },
      7,
    );

    expect(thread.comments[0].fromTimone).toBe(true);
  });
});

describe("choosing which runtime a daemon spawns sessions in", () => {
  it("uses the in-process runtime when nothing asks for a box", () => {
    expect(runtimeFor({ image: "timone-box:test" })).toBe(agentSdkRuntime);
  });

  it("uses the container runtime when asked for one", () => {
    // The switch the plan found missing: `runtime` is a non-optional
    // constructor argument hard-coded at one wiring site, so "chosen by
    // configuration and off by default" was a thing that had to be built.
    expect(runtimeFor({ runtime: "container", image: "timone-box:test" })).not.toBe(
      agentSdkRuntime,
    );
  });

  it("refuses a runtime nobody has built, rather than falling back quietly", () => {
    expect(() =>
      runtimeFor({ runtime: "vm" as "container", image: "timone-box:test" }),
    ).toThrow(/vm/);
  });

  it("defaults to the image 30g's Dockerfile actually builds", () => {
    // A default naming an image nobody builds fails at the first boxed spawn,
    // with a message about a missing image rather than about a wrong name.
    expect(DEFAULT_IMAGE.split(":")[0]).toBe("timone-agent");
  });

  it("is off by default, so this phase does not flip anything by accident", () => {
    // 30k flips it, deliberately and with a live gate. Until then a daemon
    // started with no flag behaves exactly as it did before this slice.
    expect(DEFAULT_RUNTIME).toBe("in-process");
  });
});
