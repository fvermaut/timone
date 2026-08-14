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
  AgentSessionSpawner,
  type SessionRuntime,
} from "../daemon/session.js";
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
  async upsertPullRequestComment(): Promise<void> {},
  async upsertComment(): Promise<void> {},
  async listOpenTickets(): Promise<never[]> {
    return [];
  },
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

/** A commit message carrying the provenance trailer every session owes. */
function trailed(subject: string, sessionId: string): string {
  return `${subject}\n\nTimone-Stage: interactive\nTimone-Session: ${sessionId}`;
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
  // The root has a remote too, and pushing its first commit matters: without
  // one, `--not --remotes=origin` calls every commit in the fixture unpushed,
  // and a test asserting silence would be arguing with the fixture rather
  // than with the rule.
  const workspaceRemote = join(dir, "timone.git");
  git(dir, "init", "-q", "--bare", workspaceRemote);
  git(root, "remote", "add", "origin", workspaceRemote);
  git(root, "push", "-q", "origin", "main");

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

  it("finds the run of a session started under the claim-first ordering", async () => {
    // The run is claimed before the runtime is asked for a session, so for a
    // moment the ledger holds a run with no session id (ADR-0023). The id
    // still has to land, or every daemon session's `Stop` report would be
    // filed as `interactive` — on the terminal, to nobody, instead of on the
    // ticket the run belongs to.
    const dir = mkdtempSync(join(tmpdir(), "timone-guardrails-"));
    tempDirs.push(dir);
    const store = newStore(dir);
    const project = {
      name: "scratch-app",
      repoUrl: "https://github.com/fvermaut/scratch-app.git",
    };
    const ticket: TicketThread = {
      number: 7,
      title: "the page feels slow",
      body: "when I add many items the page feels slow",
      labels: ["timone", "triage:feature"],
      url: "https://github.com/fvermaut/scratch-app/issues/7",
      author: "fvermaut",
      createdAt: "2026-08-06T09:00:00Z",
      comments: [],
    };
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [];
      },
      async getTicket(): Promise<TicketThread> {
        return { ...ticket, labels: [...ticket.labels], comments: [] };
      },
      async postComment(): Promise<void> {},
      async applyLabel(): Promise<void> {},
      ...noPullRequests,
    };
    const runtime: SessionRuntime = {
      async start() {
        return {
          sessionId: "session-resumed",
          completed: Promise.resolve({ sessionId: "session-resumed", ok: true }),
        };
      },
    };

    const { run } = store.register("scratch-app", 7);
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: "2026-08-06T10:00:00Z",
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: dir,
      headProbe: async () => undefined,
    }).spawn(store.get(run.id)!, project, {
      stage: "clarification",
      feedback: "it's the draft they lose, not the phone layout",
    });

    expect(runForSession(store, "session-resumed")?.id).toBe("scratch-app#7");
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
        git(projectDir, "commit", "-q", "-m", trailed("never pushed", "session-daemon"));
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
        git(projectDir, "commit", "-q", "-m", trailed("pushed", "session-daemon"));
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
        git(projectDir, "commit", "-q", "-m", trailed("stray", "session-interactive"));
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
    git(projectDir, "commit", "-q", "-m", trailed("stray", "session-chatty"));

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

describe("the provenance trailer, read back off real commits", () => {
  it("accepts a trailed commit and flags an untrailed one", async () => {
    // The parsing is the part that can silently break: the message is
    // multi-line and the file list follows it in the same `git log` output.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(
      root,
      "session-trailers",
      store,
      adapter,
      () => {
        writeFileSync(join(projectDir, "good.txt"), "a\n");
        git(projectDir, "add", "-A");
        git(
          projectDir,
          "commit",
          "-q",
          "-m",
          "feat: something\n\nA body that wraps\nover several lines.\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nTimone-Stage: execution\nTimone-Run: scratch-app#7",
        );
        git(projectDir, "push", "-q", "origin", "HEAD:main");
      },
    );

    expect(printed.join("\n")).not.toContain("where they came from");
  });

  it("flags a commit that carries no trailer at all", async () => {
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(
      root,
      "session-untrailed",
      store,
      adapter,
      () => {
        writeFileSync(join(projectDir, "bare.txt"), "a\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", "just a subject");
        git(projectDir, "push", "-q", "origin", "HEAD:main");
      },
    );

    expect(printed.join("\n")).toContain("where they came from");
    expect(printed.join("\n")).toContain("Timone-Stage: interactive");
  });

  it("tells the session its own id and what it owes, at SessionStart", async () => {
    // The hook is the only place that knows the session id — the prompt is
    // built before the SDK has issued one — and the one place both kinds of
    // session pass through.
    const { root } = workspace();

    const reply = JSON.parse(
      await runBaseline({
        root,
        manifest,
        sessionId: "session-xyz",
        now: new Date("2026-08-06T10:00:00Z"),
      }),
    ) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };

    expect(reply.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(reply.hookSpecificOutput.additionalContext).toContain(
      "Timone-Session: session-xyz",
    );
    expect(reply.hookSpecificOutput.additionalContext).toContain("Timone-Stage:");
  });
});

/**
 * The 14g attribution defect, per rule.
 *
 * Two sessions are open at the timone root — which is how this project is
 * developed, and the daemon builds while fvermaut works. The rules scoped
 * "this session's commits" by diffing against the session's `SessionStart`
 * baseline alone, so the session whose baseline was older was blamed for the
 * other's work. At 14g that posted a false accusation on a client's ticket
 * naming three files the accused session never touched — all three carrying
 * the trailer that would have exonerated it.
 *
 * Every rule is asserted separately rather than once. One filter at the
 * evidence boundary corrects all four, and that is the design — but a test
 * naming only one rule would not notice a rule reading commits by some other
 * route, which is exactly how the unpushed half came to need its own fix.
 */
describe("commits another session made", () => {
  it("are invisible to the unpushed rule, and do not inflate its count", async () => {
    // The common case rather than the edge one: `rev-list --not
    // --remotes=origin` is a repository-state question with no session
    // scoping in it at all, so *any* interactive session opened while the
    // daemon holds in-flight commits reported them as its own.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(root, "mine", store, adapter, () => {
      writeFileSync(join(projectDir, "theirs.txt"), "the daemon's work\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", trailed("theirs", "session-daemon"));
      writeFileSync(join(projectDir, "mine.txt"), "my work\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", trailed("mine", "mine"));
    });

    const report = printed.join("\n");
    expect(report).toContain("1 commit(s)");
    expect(report).toContain(git(projectDir, "rev-parse", "--short", "HEAD").trim());
    expect(report).not.toContain(
      git(projectDir, "rev-parse", "--short", "HEAD~1").trim(),
    );
  });

  it("are invisible to the STATUS.md placement rule", async () => {
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(root, "mine", store, adapter, () => {
      git(projectDir, "checkout", "-q", "-b", "feature");
      writeFileSync(join(projectDir, "STATUS.md"), "# status\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", trailed("status", "session-daemon"));
      git(projectDir, "push", "-q", "origin", "HEAD:feature");
    });

    expect(printed.join("\n")).not.toContain("STATUS.md was written on");
  });

  it("are invisible to the path-containment rule — the 14g accusation itself", async () => {
    // The one that reached a client's ticket. A daemon session working
    // `scratch-app` is judged against `projects/scratch-app/`, and the files
    // an interactive session committed to Timone's own tree were counted
    // against it.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter, comments } = fakeAdapter();
    const { run } = store.register("scratch-app", 11);
    store.activate(run.id, "session-daemon");

    const { printed } = await bracket(
      root,
      "session-daemon",
      store,
      adapter,
      () => {
        // The daemon's own work, where it belongs.
        writeFileSync(join(projectDir, "feature.txt"), "work\n");
        git(projectDir, "add", "-A");
        git(projectDir, "commit", "-q", "-m", trailed("feature", "session-daemon"));
        git(projectDir, "push", "-q", "origin", "HEAD:main");
        // Meanwhile, a human writing this very report in the workspace.
        writeFileSync(join(root, "report.md"), "# gate\n");
        git(root, "add", "-A");
        git(root, "commit", "-q", "-m", trailed("the report", "dd86be88"));
      },
    );

    expect(comments).toEqual([]);
    expect(printed).toEqual([]);
    expect(store.get("scratch-app#11")?.flags).toEqual([]);
  });

  it("are invisible to the provenance rule", async () => {
    // A commit naming its session but not its stage: trailed enough to be
    // attributable, untrailed enough for the provenance rule to fire on it.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(root, "mine", store, adapter, () => {
      writeFileSync(join(projectDir, "theirs.txt"), "a\n");
      git(projectDir, "add", "-A");
      git(
        projectDir,
        "commit",
        "-q",
        "-m",
        "feat: theirs\n\nTimone-Session: session-daemon",
      );
      git(projectDir, "push", "-q", "origin", "HEAD:main");
    });

    expect(printed.join("\n")).not.toContain("where they came from");
  });

  it("are still judged when they name no session at all — the fix's known limit", async () => {
    // Deliberate, and asserted so a later tidy-up cannot remove it without
    // a test going red. A commit carrying no session trailer is genuinely
    // unattributable, and over-reporting a real violation is the safe
    // direction. The duplicate provenance line survives by necessity.
    const { root, projectDir } = workspace();
    const store = newStore(root);
    const { adapter } = fakeAdapter();

    const { printed } = await bracket(root, "mine", store, adapter, () => {
      writeFileSync(join(projectDir, "orphan.txt"), "a\n");
      git(projectDir, "add", "-A");
      git(projectDir, "commit", "-q", "-m", "just a subject");
      git(projectDir, "push", "-q", "origin", "HEAD:main");
    });

    expect(printed.join("\n")).toContain("where they came from");
  });
});
