import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PullRequest,
  PullRequestThread,
  Ticket,
  TicketingAdapter,
  TicketThread,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import {
  appendJournal,
  readHookPayload,
  runBaseline,
  runCheck,
  runForSession,
} from "./guardrails.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

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

interface PostedComment {
  number: number;
  body: string;
}

const noPullRequests = {
  async findPullRequest(): Promise<PullRequest | undefined> {
    return undefined;
  },
  async getPullRequestThread(): Promise<PullRequestThread> {
    throw new Error("no pull request exists in this test");
  },
  async postPullRequestComment(): Promise<void> {},
  async closeTicket(): Promise<void> {},
};

function fakeAdapter(): {
  adapter: TicketingAdapter;
  comments: PostedComment[];
} {
  const comments: PostedComment[] = [];
  return {
    adapter: {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [];
      },
      async getTicket(): Promise<TicketThread> {
        throw new Error("not needed");
      },
      async postComment(_project, number, body): Promise<void> {
        comments.push({ number, body });
      },
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    },
    comments,
  };
}

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
}

/**
 * A timone root with a real git repo in it, plus a real clone of a bare
 * "remote" as `projects/scratch-app`.
 *
 * Real repos rather than fabricated evidence, because this slice's risk is
 * not in the rules — those are pure functions and already shown red — but in
 * the plumbing between two processes: does the baseline survive, does the
 * evidence come back, does the session id find its run.
 */
function workspace(): { root: string; projectDir: string } {
  const dir = mkdtempSync(join(tmpdir(), "timone-guardrails-"));
  tempDirs.push(dir);
  const root = join(dir, "timone");
  mkdirSync(root, { recursive: true });

  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "t");
  writeFileSync(join(root, "README.md"), "timone\n");
  // The real root ignores both, and the containment rule reads the working
  // tree — a fixture without them would report the workspace's own machinery
  // as stray files, which is a property of the fixture and not of the rule.
  writeFileSync(join(root, ".gitignore"), "projects/\n.timone/\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "first");

  // A bare remote, then a clone of it, so "unpushed" is a real question.
  const remote = join(dir, "scratch-app.git");
  git(dir, "init", "-q", "--bare", remote);
  const projectDir = join(root, "projects", "scratch-app");
  mkdirSync(join(root, "projects"), { recursive: true });
  git(dir, "clone", "-q", remote, projectDir);
  git(projectDir, "config", "user.email", "t@example.com");
  git(projectDir, "config", "user.name", "t");
  writeFileSync(join(projectDir, "README.md"), "app\n");
  git(projectDir, "add", "-A");
  git(projectDir, "commit", "-q", "-m", "first");
  git(projectDir, "push", "-q", "origin", "HEAD:main");

  return { root, projectDir };
}

function newStore(root: string): RunStore {
  let tick = 0;
  return RunStore.open(join(root, ".timone", "state.json"), {
    now: () => `2026-08-06T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

/** Bracket a session: baseline, do `work`, then check. */
async function bracket(
  root: string,
  sessionId: string,
  store: RunStore,
  adapter: TicketingAdapter,
  work: () => void,
): Promise<{ account: string; printed: string[]; journalled: string[] }> {
  await runBaseline({
    root,
    manifest,
    sessionId,
    now: new Date("2026-08-06T10:00:00Z"),
  });
  work();
  const printed: string[] = [];
  const journalled: string[] = [];
  const account = await runCheck({
    root,
    manifest,
    store,
    adapter,
    sessionId,
    print: (message) => printed.push(message),
    journal: (line) => journalled.push(line),
  });
  return { account, printed, journalled };
}

describe("reading the hook payload", () => {
  it("takes the session id off the payload", async () => {
    const payload = await readHookPayload(
      Readable.from([JSON.stringify({ session_id: "abc", cwd: "/root" })]),
    );

    expect(payload?.session_id).toBe("abc");
  });

  it("yields nothing rather than throwing on rubbish", async () => {
    // This runs as a hook on every session. A guardrail that can break a
    // session is a worse failure than one that occasionally cannot judge it.
    expect(await readHookPayload(Readable.from(["not json"]))).toBeUndefined();
    expect(await readHookPayload(Readable.from(["{}"]))).toBeUndefined();
    expect(await readHookPayload(Readable.from([""]))).toBeUndefined();
  });
});

describe("finding the run that drove a session", () => {
  it("resolves the session id against the ledger", () => {
    const { root } = workspace();
    const store = newStore(root);
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-abc");

    expect(runForSession(store, "session-abc")?.id).toBe("scratch-app#7");
  });

  it("finds nobody for a session no run ever claimed", () => {
    const { root } = workspace();
    const store = newStore(root);
    store.register("scratch-app", 7);

    expect(runForSession(store, "session-interactive")).toBeUndefined();
  });
});

describe("a session the daemon drove", () => {
  it("posts on the ticket and flags the run, exactly as it did before", async () => {
    // The regression that matters most in this slice: the path that already
    // worked has to keep working after the bracket moved.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter, comments } = fakeAdapter();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-daemon");

    const { printed, journalled } = await bracket(
      root,
      "session-daemon",
      store,
      adapter,
      () => {
        writeFileSync(join(projectDir, "feature.txt"), "work\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", "never pushed");
      },
    );

    expect(comments).toHaveLength(1);
    expect(comments[0].number).toBe(7);
    expect(comments[0].body).toContain("never reached the remote");
    expect(store.get("scratch-app#7")?.flags).toHaveLength(1);
    // And nothing leaked to the interactive audience.
    expect(printed).toEqual([]);
    expect(journalled).toEqual([]);
  });

  it("says nothing anywhere when the session behaved", async () => {
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter, comments } = fakeAdapter();
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "session-daemon");

    const { account, printed } = await bracket(
      root,
      "session-daemon",
      store,
      adapter,
      () => {
        writeFileSync(join(projectDir, "feature.txt"), "work\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", "pushed");
        git(projectDir, "push", "-q", "origin", "HEAD:main");
      },
    );

    expect(comments).toEqual([]);
    expect(printed).toEqual([]);
    expect(store.get("scratch-app#7")?.flags).toEqual([]);
    expect(account).toContain("clean");
  });
});

describe("a session a human drove", () => {
  it("prints the finding and journals it, and posts on no ticket at all", async () => {
    // The 2026-08-06 accident, reproduced: a commit left in a project
    // checkout by a session nobody was watching.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter, comments } = fakeAdapter();

    const { printed, journalled } = await bracket(
      root,
      "session-interactive",
      store,
      adapter,
      () => {
        writeFileSync(join(projectDir, "stray.txt"), "left behind\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", "stray");
      },
    );

    expect(printed.join("\n")).toContain("never reached the remote");
    expect(journalled).toHaveLength(1);
    expect(JSON.parse(journalled[0])).toMatchObject({
      session: "session-interactive",
      rule: "unpushed",
    });
    // No run owns it, so there is nowhere to post and nothing to flag.
    expect(comments).toEqual([]);
  });

  it("says nothing when the session behaved", async () => {
    const { root } = workspace();
    const store = newStore(root);
    const { adapter, comments } = fakeAdapter();

    const { account, printed, journalled } = await bracket(
      root,
      "session-interactive",
      store,
      adapter,
      () => {},
    );

    expect(printed).toEqual([]);
    expect(journalled).toEqual([]);
    expect(comments).toEqual([]);
    expect(account).toContain("clean");
  });

  it("does not judge Timone's own work against a project it never had", async () => {
    // A session working on Timone itself touches `src/` and `doc/`, which are
    // outside every `projects/<name>/`. Judged against a target it never
    // declared, every honest edit would read as a containment violation.
    const { root } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(
      root,
      "session-interactive",
      store,
      adapter,
      () => {
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "thing.ts"), "export const x = 1;\n");
      },
    );

    expect(printed.join("\n")).not.toContain("outside");
  });

  it("says the same thing once, however many turns the session takes", async () => {
    // `Stop` fires at the end of every assistant turn, not once per session.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    await runBaseline({
      root,
      manifest,
      sessionId: "session-chatty",
      now: new Date("2026-08-06T10:00:00Z"),
    });

    writeFileSync(join(projectDir, "stray.txt"), "left behind\n");
    git(projectDir, "add", "-A");
    git(projectDir, "commit", "-q", "-m", "stray");

    const printed: string[] = [];
    const deps = {
      root,
      manifest,
      store,
      adapter,
      sessionId: "session-chatty",
      print: (message: string) => printed.push(message),
      journal: () => {},
    };

    const first = await runCheck(deps);
    const second = await runCheck(deps);

    expect(first).toContain("flagged");
    expect(second).toContain("clean");
    expect(printed).toHaveLength(1);
  });
});

describe("a session with no baseline", () => {
  it("says so rather than passing silently", async () => {
    // Silence would look exactly like a clean session, which is the one
    // reading it must never produce.
    const { root } = workspace();
    const store = newStore(root);
    const { adapter, comments } = fakeAdapter();

    const account = await runCheck({
      root,
      manifest,
      store,
      adapter,
      sessionId: "session-never-started",
      print: () => {},
      journal: () => {},
    });

    expect(account).toContain("no baseline");
    expect(account).not.toContain("clean");
    expect(comments).toEqual([]);
  });
});

describe("the journal", () => {
  it("appends one line per finding, and creates the file", () => {
    const { root } = workspace();

    appendJournal(root, JSON.stringify({ session: "a", rule: "unpushed" }));
    appendJournal(root, JSON.stringify({ session: "b", rule: "unpushed" }));

    const lines = readFileSync(join(root, ".timone", "sessions.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line !== "");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1])).toMatchObject({ session: "b" });
  });
});
