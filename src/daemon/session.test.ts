import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  STAGE_DONE_MARKER,
  STAGE_HANDED_MARKER,
  isMachineComment,
  stampMachineComment,
  type PullRequest,
  type PullRequestThread,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { gateCommentFor } from "./gate-comment.js";
import {
  APPROVAL_RECORD_MODEL,
  effortFor,
  modelFor,
  type PipelineStage,
} from "./pipeline.js";
import { RunStore, type Run } from "./runs.js";
import {
  DEFAULT_PROGRESS_INTERVAL_SECONDS,
  type ProgressSnapshot,
  type SessionSummary,
} from "./progress.js";
import {
  AgentSessionSpawner,
  sessionOutcomeFrom,
  type ProgressReader,
  type SessionRequest,
  type SessionRuntime,
  type Ticker,
} from "./session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-session-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-02T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
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

const project: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

const thread: TicketThread = {
  number: 7,
  title: "the page feels slow",
  body: "when I add many items the page feels slow, it's annoying",
  labels: ["timone"],
  url: "https://github.com/fvermaut/scratch-app/issues/7",
  author: "fvermaut",
  createdAt: "2026-08-01T09:00:00Z",
  comments: [],
};

interface PostedComment {
  number: number;
  body: string;
}

/**
 * What the real GitHub adapter needs before it can address a repository. It
 * throws without it; a fake that did not would let a caller pass a project it
 * assembled itself, with the URL left blank, and nothing would notice until
 * the daemon ran for real.
 */
function requireResolvable(target: TicketingProject): void {
  if (target.repoUrl.trim() === "") {
    throw new Error(
      `Cannot derive a GitHub owner/repo from repo_url "" (project ${target.name})`,
    );
  }
}

/**
 * A ticket the fakes can actually change, because the pipeline reads the
 * ticket back after every session: the classification lives on a label, and
 * a stale fake would make the daemon look broken in tests and fine in life.
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

function fakeAdapter(initial: TicketThread = thread): {
  adapter: TicketingAdapter;
  comments: PostedComment[];
  ticket: TicketThread;
} {
  const comments: PostedComment[] = [];
  const ticket: TicketThread = {
    ...initial,
    labels: [...initial.labels],
    comments: [...initial.comments],
  };
  let clock = 0;

  const adapter: TicketingAdapter = {
    async listMarkedTickets(): Promise<Ticket[]> {
      return [ticket];
    },
    async getTicket(target): Promise<TicketThread> {
      // The real adapter resolves owner/repo from the clone URL and throws
      // without one. A fake that shrugged at a blank project let a caller
      // ship exactly that — so this one refuses too.
      requireResolvable(target);
      return { ...ticket, labels: [...ticket.labels], comments: [...ticket.comments] };
    },
    async postComment(target, number, body): Promise<void> {
      requireResolvable(target);
      const stamped = stampMachineComment(body);
      comments.push({ number, body });
      ticket.comments.push({
        author: "fvermaut",
        body: stamped,
        createdAt: `2026-08-02T11:${String(clock++).padStart(2, "0")}:00Z`,
        fromTimone: isMachineComment(stamped),
      });
    },
    async applyLabel(_project, _number, label): Promise<void> {
      if (!ticket.labels.includes(label)) ticket.labels.push(label);
    },
    ...noPullRequests,
  };
  return { adapter, comments, ticket };
}

interface FakeRuntimeOptions {
  ok?: boolean;
  error?: string;
  /** What the session does to the world before it reports back. */
  work?: () => Promise<void> | void;
}

/** A runtime that records the request, does `work`, and reports an outcome. */
function fakeRuntime(options: FakeRuntimeOptions = {}): {
  runtime: SessionRuntime;
  requests: SessionRequest[];
} {
  const requests: SessionRequest[] = [];
  let started = 0;
  const runtime: SessionRuntime = {
    async start(request) {
      requests.push(request);
      const sessionId = `session-abc${started++ === 0 ? "" : `-${started}`}`;
      return {
        sessionId,
        completed: (async () => {
          await options.work?.();
          return {
            sessionId,
            ok: options.ok ?? true,
            error: options.error,
          };
        })(),
      };
    },
  };
  return { runtime, requests };
}

/** A triage session that does its job: classifies and labels the ticket. */
function classifyingRuntime(
  kind: "feature" | "bug" | "chore" | "question",
  adapter: TicketingAdapter,
): { runtime: SessionRuntime; requests: SessionRequest[] } {
  return fakeRuntime({
    work: async () => {
      await adapter.applyLabel(project, 7, `triage:${kind}`);
      await adapter.postComment(project, 7, `I think this is a ${kind}.`);
    },
  });
}

/**
 * A branch-tip probe reporting that the session moved the branch on. Stages
 * that owe an artifact are gated on this, so any test exercising a gate has
 * to say whether work happened — silence would mean "nothing was committed".
 */
function movingProbe(): () => Promise<string> {
  let calls = 0;
  return async () => (calls++ === 0 ? "sha-before" : "sha-after");
}

/** A picked-up run on scratch-app#7. */
function pickedUpRun(store: RunStore): Run {
  return store.register("scratch-app", 7).run;
}

describe("spawn configuration", () => {
  it("runs the session from the timone root, never inside the project", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/Users/fvermaut/dev/timone",
    }).spawn(pickedUpRun(store), project);

    expect(requests[0].cwd).toBe("/Users/fvermaut/dev/timone");
  });

  it("carries the project, the ticket and its body verbatim", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    const { prompt } = requests[0];
    expect(prompt).toContain("scratch-app");
    expect(prompt).toContain("#7");
    expect(prompt).toContain(thread.body);
    expect(prompt).toContain("projects/scratch-app");
  });

  it("tells the session to classify, and never tells it the classification", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    const { prompt } = requests[0];
    expect(prompt).toMatch(/classify/i);
    expect(prompt).toContain("triage:<kind>");
    expect(prompt).not.toMatch(/triage:(bug|feature|chore|question)\b/);
  });

  it("includes the comment thread when the ticket has one", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({
      ...thread,
      comments: [
        {
          author: "fvermaut",
          body: "it's worst on the archive page",
          createdAt: "2026-08-01T10:00:00Z",
          fromTimone: false,
        },
      ],
    });
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    expect(requests[0].prompt).toContain("it's worst on the archive page");
  });

  it("tells the session to mark the comments it writes as the machine's", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    expect(requests[0].prompt).toContain(MACHINE_MARKER);
  });

  it("shows the session which thread comments are its own, not the human's", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({
      ...thread,
      comments: [
        {
          author: "fvermaut",
          body: "Picked this up.",
          createdAt: "2026-08-01T10:00:00Z",
          fromTimone: true,
        },
        {
          author: "fvermaut",
          body: "it's worst on the archive page",
          createdAt: "2026-08-01T11:00:00Z",
          fromTimone: false,
        },
      ],
    });
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    // Both comments carry the same author; the prompt must still separate them.
    const { prompt } = requests[0];
    expect(prompt).toMatch(/Timone \(you\), earlier/);
    expect(prompt).toMatch(/fvermaut \(a person\)/);
  });
});

describe("target validation", () => {
  it("refuses a project the manifest does not declare", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();
    const run = store.register("not-managed", 3).run;

    await expect(
      new AgentSessionSpawner({
        manifest,
        store,
        adapter,
        runtime,
        root: "/root",
      }).spawn(run, { name: "not-managed", repoUrl: "https://x/y.git" }),
    ).rejects.toThrow(/not-managed/);

    expect(requests).toEqual([]);
    expect(store.get(run.id)?.status).toBe("picked-up");
  });
});

describe("routing after triage", () => {
  it("opens a conversation for a feature, and parks waiting on it", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    const parked = store.get(run.id);
    expect(parked?.status).toBe("parked");
    expect(parked?.stage).toBe("clarification");
    expect(parked?.waitingKind).toBe("conversation");
    expect(parked?.waitCursor).toBeTruthy();
    expect(comments.at(-1)?.body).toContain("timone takeover scratch-app#7");
  });

  it("holds no project while it waits, since it owns no branch", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    expect(store.get(run.id)?.branch).toBeUndefined();
    expect(store.occupyingRun("scratch-app")).toBeUndefined();
  });

  it("finishes a question rather than pipelining it", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = classifyingRuntime("question", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("done");
    expect(comments.at(-1)?.body).toMatch(/question rather than something to build/i);
  });

  it("parks a bug at the stage that would act on it, saying it isn't built", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = classifyingRuntime("bug", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    const parked = store.get(run.id);
    expect(parked?.status).toBe("parked");
    expect(parked?.stage).toBe("feedback");
    expect(comments.at(-1)?.body).toMatch(/isn't built yet/i);
  });

  it("fails loudly when triage recorded no classification at all", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: true });
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("failed");
    expect(comments.at(-1)?.body).toMatch(/couldn't work out what kind/i);
  });

  it("runs one session per stage, not one per run", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("feature", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    // Triage ran; the clarification stage is a conversation, so no second
    // unattended session was started for it.
    expect(requests).toHaveLength(1);
  });
});

describe("resuming a parked run", () => {
  it("starts at the stage it is handed, not at the one it stopped in", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter({ ...thread, labels: ["timone", "triage:feature"] });
    const { runtime, requests } = fakeRuntime();
    const run = pickedUpRun(store);
    store.activate(run.id, "session-earlier");
    store.park(run.id, {
      waitingOn: "a conversation",
      kind: "conversation",
      stage: "clarification",
      waitCursor: "2026-08-02T10:00:00Z",
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(store.get(run.id)!, project, { stage: "requirements" });

    // It ran the requirements stage, not the clarification one it stopped in.
    expect(store.get(run.id)?.stage).toBe("requirements");
    expect(requests[0].prompt).toMatch(/Write down what ticket #7/);
  });

  it("hands the human's words to the stage that has to do it again", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);
    store.activate(run.id, "session-earlier");
    store.park(run.id, {
      waitingOn: "your answer",
      kind: "gate",
      stage: "triage",
      waitCursor: "2026-08-02T10:00:00Z",
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(store.get(run.id)!, project, {
      stage: "triage",
      feedback: "it's not a bug, the whole page is like that",
    });

    expect(requests[0].prompt).toContain("it's not a bug, the whole page is like that");
  });
});

describe("the conversation invitation", () => {
  it("posts what the channel gave it, and records what it waits on", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      channel: {
        name: "fake",
        async open() {
          return { comment: "come and talk to me", waitingOn: "a chat somewhere" };
        },
        async conclude() {
          return "done";
        },
      },
    }).spawn(run, project);

    expect(comments.at(-1)?.body).toBe("come and talk to me");
    expect(store.get(run.id)?.waitingOn).toBe("a chat somewhere");
  });

  it("sets the cursor past its own invitation, so it cannot answer itself", async () => {
    const store = newStore();
    const { adapter, ticket } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    const invitation = ticket.comments.at(-1)!;
    expect(store.get(run.id)?.waitCursor).toBe(invitation.createdAt);
  });

  it("tells the session, in its prompt, how to mark the record it posts back", async () => {
    // The daemon finds a concluded conversation by that marker alone; a
    // prompt that omitted it would leave the ticket waiting forever.
    const store = newStore();
    const { adapter } = fakeAdapter({ ...thread, labels: ["timone", "triage:feature"] });
    const { runtime, requests } = fakeRuntime();
    const run = pickedUpRun(store);
    store.activate(run.id, "s");
    store.park(run.id, {
      waitingOn: "a conversation",
      kind: "conversation",
      stage: "clarification",
      waitCursor: "2026-08-02T10:00:00Z",
    });

    // The clarification stage runs interactively, so ask the prompt directly.
    const { stagePrompt } = await import("./prompts.js");
    const prompt = stagePrompt("clarification", {
      project,
      ticket: await adapter.getTicket(project, 7),
    });

    expect(prompt).toContain(CONVERSATION_RECORD_MARKER);
    expect(requests).toEqual([]);
  });
});

describe("run lifecycle", () => {
  it("activates on start and parks once on a clean exit", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    const finished = store.get(run.id);
    expect(finished?.status).toBe("parked");
    expect(finished?.sessionId).toBe("session-abc");
    expect(finished?.waitingOn).toBeTruthy();
    // The session's own comment, then the invitation.
    expect(comments).toHaveLength(2);
    expect(comments[0].number).toBe(7);
  });

  it("ends the parking comment with a call to action", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = classifyingRuntime("bug", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(pickedUpRun(store), project);

    const body = comments.at(-1)!.body;
    const lastLine = body.trimEnd().split("\n").at(-1) ?? "";
    expect(lastLine).toMatch(/\*\*What I need from you:\*\*/);
    expect(body).not.toMatch(/timone-\w+|sub-phase/i);
  });

  it("fails the run when the session ends badly, and says so on the ticket", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = fakeRuntime({ ok: false, error: "model unavailable" });
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    const finished = store.get(run.id);
    expect(finished?.status).toBe("failed");
    expect(finished?.failure).toMatch(/model unavailable/);
    expect(comments[0].body).toMatch(/\*\*What I need from you:\*\*/);
  });

  it("flips the run state exactly once when the session ends", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("parked");
    // And a second exit flip is refused by the store, not merely avoided here.
    expect(() => store.park(run.id, { waitingOn: "again" })).toThrow(/parked/);
  });

});

describe("the requirements gate", () => {
  /** A ticket already through triage and clarification. */
  const settled: TicketThread = {
    ...thread,
    labels: ["timone", "triage:feature"],
    comments: [
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\n${CONVERSATION_RECORD_MARKER}\n\nwe agreed the list should page`,
        createdAt: "2026-08-03T09:30:00Z",
        fromTimone: true,
      },
    ],
  };

  /** A run resumed straight into the requirements stage. */
  function atRequirements(store: RunStore): Run {
    const run = pickedUpRun(store);
    store.activate(run.id, "session-earlier");
    store.park(run.id, {
      waitingOn: "a conversation",
      kind: "conversation",
      stage: "clarification",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  it("claims a work branch before the session starts, not after", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const claimed: (string | undefined)[] = [];
    const { runtime } = fakeRuntime({
      work: () => {
        claimed.push(store.get("scratch-app#7")?.branch);
      },
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    // The branch existed while the session ran: a session that cut one on a
    // project another run held would collide before the ledger knew.
    expect(claimed).toEqual(["timone/7-the-page-feels-slow"]);
  });

  it("records the stage before the session starts, not after it ends", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const seen: (string | undefined)[] = [];
    const { runtime } = fakeRuntime({
      work: () => {
        seen.push(store.get("scratch-app#7")?.stage);
      },
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    // Written only on completion, the ledger names the *previous* stage for as
    // long as the current one takes — hours, for a build — and `timone status`
    // reads it to say both what a run is doing and which model it is doing it
    // on. Seen live on 2026-08-07: a run minutes into building read "planning".
    expect(seen).toEqual(["requirements"]);
  });

  it("holds the project from the moment it owns a branch", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    expect(store.occupyingRun("scratch-app")?.id).toBe("scratch-app#7");
    expect(store.register("scratch-app", 9).run.status).toBe("queued");
  });

  it("tells the session which branch to work on, and to push it", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    expect(requests[0].prompt).toContain("timone/7-the-page-feels-slow");
    expect(requests[0].prompt).toMatch(/push/i);
  });

  it("hands the session what the conversation settled", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    expect(requests[0].prompt).toContain("we agreed the list should page");
  });

  it("posts the approval request itself, linking the artifact on the branch", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    const gate = comments.at(-1)!.body;
    expect(gate).toContain(
      "https://github.com/fvermaut/scratch-app/tree/timone/7-the-page-feels-slow/doc/specs/prd",
    );
    expect(gate).toContain("`approve`");
    expect(gate.trimEnd().split("\n").at(-1)).toMatch(/isn't `approve`/);
  });

  it("forbids the session from inventing its own approval instruction", async () => {
    // Two sets of instructions in one thread tell the human two different
    // things, and only one of them is the one being listened for.
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    expect(requests[0].prompt).toMatch(/do \*\*not\*\* ask\s+them to approve it/i);
  });

  it("parks on the gate with a cursor past its own request", async () => {
    const store = newStore();
    const { adapter, ticket: live } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    const parked = store.get("scratch-app#7");
    expect(parked?.status).toBe("parked");
    expect(parked?.waitingKind).toBe("gate");
    expect(parked?.stage).toBe("requirements");
    expect(parked?.waitCursor).toBe(live.comments.at(-1)?.createdAt);
  });

  it("names the branch when the clone URL is not one it can link into", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), { name: "scratch-app", repoUrl: "/tmp/local.git" }, {
      stage: "requirements",
    });

    expect(comments.at(-1)!.body).toContain("timone/7-the-page-feels-slow");
  });

  it("keeps the branch it already owns rather than cutting a second one", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();
    const run = atRequirements(store);
    store.claimBranch(run.id, "timone/7-something-else");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(store.get(run.id)!, project, { stage: "requirements" });

    expect(store.get(run.id)?.branch).toBe("timone/7-something-else");
  });
});

describe("the plan gate", () => {
  /** A run parked on the requirements gate, branch and all. */
  function atRequirementsGate(store: RunStore): Run {
    const run = pickedUpRun(store);
    store.activate(run.id, "session-earlier");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  const settled: TicketThread = {
    ...thread,
    labels: ["timone", "triage:feature"],
    comments: [],
  };

  it("uses one gate mechanism for both stages, not a second copy", () => {
    // Asserted by construction: the two stages supply their own words, but
    // the part the human is actually judged on — the word to reply and the
    // rule that anything else is a change — is the same text both times.
    const forRequirements = gateCommentFor("requirements", project, "b", ["x"])!;
    const forPlanning = gateCommentFor("planning", project, "b", ["x"])!;
    const rule = (body: string) => body.trimEnd().split("\n").at(-1);

    expect(rule(forRequirements)).toBe(rule(forPlanning));
    expect(rule(forRequirements)).toMatch(/isn't `approve`/);
    for (const body of [forRequirements, forPlanning]) {
      expect(body).toContain("**What I need from you:** read it and reply on this ticket.");
    }
  });

  it("links the plan where the plan actually lives", () => {
    expect(gateCommentFor("planning", project, "timone/7-slow", [])).toContain(
      "https://github.com/fvermaut/scratch-app/tree/timone/7-slow/doc/plans/phases",
    );
  });

  it("has no gate comment for a stage that has no gate", () => {
    expect(gateCommentFor("triage", project, "b", [])).toBeUndefined();
    expect(gateCommentFor("clarification", project, "b", [])).toBeUndefined();
  });

  it("tells the planning session to stamp the file as not yet approved", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();
    const run = atRequirementsGate(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project, { stage: "planning" });

    expect(requests[0].prompt).toContain("Awaiting approval");
    expect(requests[0].prompt).toMatch(/stay on the branch/i);
  });

  it("parks awaiting the building that is not built, and says so", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();
    const run = atRequirementsGate(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(run, project, { stage: "planning", approval: undefined });

    // Planning ran, its gate went up, and the run waits on the human — the
    // park at execution comes only once they approve.
    const parked = store.get(run.id);
    expect(parked?.stage).toBe("planning");
    expect(parked?.waitingKind).toBe("gate");
    expect(comments.at(-1)?.body).toContain("Here's how I propose to build it.");
  });
});

describe("recording an approval in the artifact", () => {
  const settled: TicketThread = {
    ...thread,
    labels: ["timone", "triage:feature"],
    comments: [],
  };

  function atPlanningGate(store: RunStore): Run {
    const run = pickedUpRun(store);
    store.activate(run.id, "session-earlier");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "planning",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  it("writes the stamp stage 6 refuses to start without", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atPlanningGate(store), project, {
      stage: "execution",
      approval: { stage: "planning", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    const [recording] = requests;
    expect(recording.prompt).toContain("Approved for execution by <who> <date>");
    expect(recording.prompt).toContain("fvermaut");
    expect(recording.prompt).toContain("2026-08-03T12:00:00Z");
    expect(recording.prompt).toContain("timone/7-the-page-feels-slow");
  });

  it("records it before the run moves on, not after", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Approved for execution by fvermaut",
    }).spawn(atPlanningGate(store), project, {
      stage: "execution",
      approval: { stage: "planning", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    // Two sessions, in that order: the recording one first, and only then
    // the execution the approval unblocked — an approval recorded after the
    // build started would vanish whenever the pipeline stopped between them.
    expect(requests).toHaveLength(2);
    expect(requests[0].prompt).toContain("2026-08-03T12:00:00Z");
    expect(requests[1].prompt).toContain(STAGE_DONE_MARKER);
  });

  it("tells the recording session to change nothing else and say nothing", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atPlanningGate(store), project, {
      stage: "execution",
      approval: { stage: "planning", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    expect(requests[0].prompt).toMatch(/do not revise the artifact's content/i);
    expect(requests[0].prompt).toMatch(/do not comment on the ticket/i);
  });

  it("stops the run when the approval cannot be recorded", async () => {
    // Advancing anyway would leave the next stage looking at an artifact that
    // says nobody approved it.
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime({ ok: false, error: "push rejected" });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atPlanningGate(store), project, {
      stage: "execution",
      approval: { stage: "planning", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    expect(store.get("scratch-app#7")?.status).toBe("failed");
    expect(store.get("scratch-app#7")?.failure).toMatch(/could not record the approval/);
    expect(comments.at(-1)?.body).toMatch(/push rejected/);
  });

  it("records a requirements approval the same way", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();
    const run = pickedUpRun(store);
    store.activate(run.id, "s");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.park(run.id, {
      waitingOn: "your answer",
      kind: "gate",
      stage: "requirements",
      waitCursor: "2026-08-03T09:00:00Z",
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(store.get(run.id)!, project, {
      stage: "planning",
      approval: { stage: "requirements", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    expect(requests[0].prompt).toMatch(/status to Active/i);
  });
});

describe("a gate is never opened over nothing", () => {
  const settled: TicketThread = {
    ...thread,
    labels: ["timone", "triage:feature"],
    comments: [],
  };

  function atRequirements(store: RunStore): Run {
    const run = pickedUpRun(store);
    store.activate(run.id, "session-earlier");
    store.park(run.id, {
      waitingOn: "a conversation",
      kind: "conversation",
      stage: "clarification",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  /** A probe reporting a branch tip that never moves. */
  const stuckProbe = async (): Promise<string> => "sha-unchanged";

  /** A probe reporting a tip that moves once the session has run. */
  function movingProbe(): () => Promise<string> {
    let calls = 0;
    return async () => (calls++ === 0 ? "sha-before" : "sha-after");
  }

  it("refuses to ask for approval of a document the stage never wrote", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: stuckProbe,
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    const body = comments.at(-1)!.body;
    expect(body).not.toContain("`approve`");
    expect(body).toMatch(/nothing for you to approve/i);
  });

  it("fails the run rather than parking it on a gate nobody can answer", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: stuckProbe,
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    const finished = store.get("scratch-app#7");
    expect(finished?.status).toBe("failed");
    expect(finished?.failure).toMatch(/without committing anything to gate/);
  });

  it("opens the gate normally when the branch did move", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    expect(comments.at(-1)!.body).toContain("`approve`");
    expect(store.get("scratch-app#7")?.waitingKind).toBe("gate");
  });

  it("treats a branch that did not exist before as work, once it does", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();
    let calls = 0;

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: async () => (calls++ === 0 ? undefined : "sha-first"),
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    expect(comments.at(-1)!.body).toContain("`approve`");
  });

  it("says nothing has moved on, so earlier answers still stand", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: stuckProbe,
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    const body = comments.at(-1)!.body;
    expect(body).toMatch(/still stands/i);
    expect(body.trimEnd().split("\n").at(-1)).toMatch(/What I need from you:/);
  });
});

describe("the execution stage", () => {
  /** A run holding its branch, resumed at execution after plan approval. */
  function atExecution(store: RunStore): Run {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.park(run.id, {
      waitingOn: "the building to start",
      stage: "planning",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  /** A session that closes with the given outcome marker on the ticket. */
  function buildingRuntime(
    adapter: TicketingAdapter,
    marker: string,
    text: string,
  ): ReturnType<typeof fakeRuntime> {
    return fakeRuntime({
      work: async () => {
        await adapter.postComment(project, 7, `${marker}\n\n${text}`);
      },
    });
  }

  it("advances to verification when the plan flipped and the session said done", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = buildingRuntime(
      adapter,
      STAGE_DONE_MARKER,
      "Built all slices.",
    );

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Complete — see reports/phase-04-complete.md",
      verificationReportProbe: async () =>
        "doc/plans/phases/reports/phase-04-verification.md",
    }).spawn(atExecution(store), project, { stage: "execution" });

    // The build's honest pair hands straight into a verification session —
    // recognisable by the one prompt built without the ticket's text.
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests[1].prompt).toMatch(/without having watched/i);
  });

  it("fails the run when the session said done but the plan never flipped", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = buildingRuntime(adapter, STAGE_DONE_MARKER, "Built it.");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Approved for execution by fvermaut 2026-08-05",
    }).spawn(atExecution(store), project, { stage: "execution" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    expect(run?.failure).toMatch(/phase file/i);
    expect(comments.at(-1)?.body).toMatch(/went wrong/i);
  });

  it("fails the run when the plan flipped but no outcome was recorded", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Complete — see reports/phase-04-complete.md",
    }).spawn(atExecution(store), project, { stage: "execution" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    expect(run?.failure).toMatch(/outcome/i);
  });

  it("stops quietly when the session handed the work to a person", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = buildingRuntime(
      adapter,
      STAGE_HANDED_MARKER,
      "Slice 04c failed twice; both attempts below.",
    );

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Approved for execution by fvermaut 2026-08-05",
    }).spawn(atExecution(store), project, { stage: "execution" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    // The session's own comment is the report; the daemon adds nothing on top.
    expect(comments.at(-1)?.body).toContain("failed twice");
  });

  it("hands the session the execution prompt on the run's branch", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = buildingRuntime(adapter, STAGE_DONE_MARKER, "done");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Complete — see reports/phase-04-complete.md",
    }).spawn(atExecution(store), project, { stage: "execution" });

    expect(requests[0].prompt).toContain("timone/7-the-page-feels-slow");
    expect(requests[0].prompt).toContain(STAGE_DONE_MARKER);
  });
});

describe("the verification stage", () => {
  /** A run holding its branch, advanced to verification after the build. */
  function atVerification(store: RunStore): Run {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.setStage(run.id, "verification");
    store.park(run.id, {
      waitingOn: "the checking to start",
      stage: "verification",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  function checkingRuntime(
    adapter: TicketingAdapter,
    marker: string,
    text: string,
  ): ReturnType<typeof fakeRuntime> {
    return fakeRuntime({
      work: async () => {
        await adapter.postComment(project, 7, `${marker}\n\n${text}`);
      },
    });
  }

  it("advances to delivery when the report exists and the session said done", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = checkingRuntime(
      adapter,
      STAGE_DONE_MARKER,
      "All criteria pass.",
    );

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      verificationReportProbe: async () =>
        "doc/plans/phases/reports/phase-04-verification.md",
    }).spawn(atVerification(store), project, { stage: "verification" });

    // The clean pass hands straight into a delivery session — recognisable
    // by the prompt that opens the pull request.
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests[1].prompt).toMatch(/pull request/i);
    expect(store.get("scratch-app#7")?.stage).toBe("delivery");
  });

  it("fails the run when the session said done but no report exists", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = checkingRuntime(adapter, STAGE_DONE_MARKER, "All pass.");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      verificationReportProbe: async () => undefined,
    }).spawn(atVerification(store), project, { stage: "verification" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    expect(run?.failure).toMatch(/report/i);
  });

  it("stops without advancing when the gate did not pass", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter();
    const { runtime } = checkingRuntime(
      adapter,
      STAGE_HANDED_MARKER,
      "Two criteria still fail after both loops; the report has the evidence.",
    );

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      verificationReportProbe: async () =>
        "doc/plans/phases/reports/phase-04-verification.md",
    }).spawn(atVerification(store), project, { stage: "verification" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    // The session's own comment is R6's failure report; nothing is added.
    expect(comments.at(-1)?.body).toContain("both loops");
  });
});

describe("the delivery stage", () => {
  function atDelivery(store: RunStore): Run {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.setStage(run.id, "delivery");
    store.park(run.id, {
      waitingOn: "the delivery to start",
      stage: "delivery",
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  const openPr = {
    number: 9,
    title: "Fix the box",
    url: "https://github.com/fvermaut/scratch-app/pull/9",
    state: "open" as const,
    headSha: "aaaaaaa",
  };

  /** The fake adapter with a pull-request surface that has a PR to find. */
  function adapterWithPr(pr: typeof openPr | undefined) {
    const base = fakeAdapter();
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async findPullRequest() {
        return pr;
      },
      async getPullRequestThread() {
        if (pr === undefined) throw new Error("no PR");
        return {
          ...pr,
          comments: [
            {
              author: "fvermaut",
              body: "opening comment",
              createdAt: "2026-08-06T09:00:00Z",
              fromTimone: true,
            },
          ],
        };
      },
    };
    return { ...base, adapter };
  }

  function deliveringRuntime(
    adapter: TicketingAdapter,
    marker: string,
    text: string,
  ): ReturnType<typeof fakeRuntime> {
    return fakeRuntime({
      work: async () => {
        await adapter.postComment(project, 7, `${marker}\n\n${text}`);
      },
    });
  }

  it("parks on the review, knowing its pull request, when the PR exists", async () => {
    const store = newStore();
    const { adapter } = adapterWithPr(openPr);
    const { runtime } = deliveringRuntime(adapter, STAGE_DONE_MARKER, "PR is open.");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atDelivery(store), project, { stage: "delivery" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("parked");
    expect(run?.waitingKind).toBe("review");
    expect(run?.pr).toBe(9);
    expect(run?.waitingOn).toMatch(/pull request #9/);
    // The cursor sits at the PR thread's newest comment, so only what the
    // human says after the park can wake the run.
    expect(run?.waitCursor).toBe("2026-08-06T09:00:00Z");
  });

  it("fails the run when the session said done but no pull request exists", async () => {
    // The 12f rule wearing stage 8's clothes: the PR is the artifact, and a
    // park on a review nobody can perform is a gate over nothing.
    const store = newStore();
    const { adapter, comments } = adapterWithPr(undefined);
    const { runtime } = deliveringRuntime(adapter, STAGE_DONE_MARKER, "Done!");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atDelivery(store), project, { stage: "delivery" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    expect(run?.failure).toMatch(/pull request/i);
    expect(comments.at(-1)?.body).toMatch(/went wrong/i);
  });

  it("stops quietly when the session handed the delivery to a person", async () => {
    const store = newStore();
    const { adapter, comments } = adapterWithPr(undefined);
    const { runtime } = deliveringRuntime(
      adapter,
      STAGE_HANDED_MARKER,
      "The verification gate refused delivery; details on the branch.",
    );

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atDelivery(store), project, { stage: "delivery" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("failed");
    expect(comments.at(-1)?.body).toContain("refused delivery");
  });
});

describe("the remediation stage", () => {
  function atRemediation(store: RunStore): Run {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.recordPullRequest(run.id, 9);
    store.setStage(run.id, "remediation");
    store.park(run.id, {
      waitingOn: "your review of pull request #9",
      kind: "review",
      stage: "remediation",
      waitCursor: "2026-08-06T10:00:00Z",
    });
    return store.get(run.id)!;
  }

  const openPr = {
    number: 9,
    title: "Fix the box",
    url: "https://github.com/fvermaut/scratch-app/pull/9",
    state: "open" as const,
    headSha: "aaaaaaa",
  };

  function adapterWithPrThread() {
    const base = fakeAdapter();
    const adapter: TicketingAdapter = {
      ...base.adapter,
      async findPullRequest() {
        return openPr;
      },
      async getPullRequestThread() {
        return {
          ...openPr,
          comments: [
            {
              author: "fvermaut",
              body: "the reply the session just posted",
              createdAt: "2026-08-06T13:00:00Z",
              fromTimone: true,
            },
          ],
        };
      },
    };
    return { ...base, adapter };
  }

  it("re-verifies after a fix lands — nothing reaches the PR unchecked", async () => {
    const store = newStore();
    const { adapter } = adapterWithPrThread();
    const { runtime, requests } = fakeRuntime({
      work: async () => {
        await adapter.postComment(project, 7, `${STAGE_DONE_MARKER}\n\nRenamed it.`);
      },
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      verificationReportProbe: async () =>
        "doc/plans/phases/reports/phase-04-verification.md",
    }).spawn(atRemediation(store), project, { stage: "remediation" });

    // The fix hands into a fresh verification session (the thread-less
    // prompt), exactly as a first build does.
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests[1].prompt).toMatch(/without having watched/i);
  });

  it("re-parks on the review when the session only replied, changing nothing", async () => {
    const store = newStore();
    const { adapter } = adapterWithPrThread();
    // A probe that reports the branch did not move: the session's whole act
    // was a clarifying reply in the PR thread.
    const { runtime } = fakeRuntime({
      work: async () => {
        await adapter.postComment(project, 7, `${STAGE_DONE_MARKER}\n\nAsked a question instead.`);
      },
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: async () => "same-sha",
    }).spawn(atRemediation(store), project, { stage: "remediation" });

    const run = store.get("scratch-app#7");
    expect(run?.status).toBe("parked");
    expect(run?.waitingKind).toBe("review");
    // The cursor advanced past the session's own reply, so only what the
    // human says next can wake it again.
    expect(run?.waitCursor).toBe("2026-08-06T13:00:00Z");
  });

  it("fails quietly when the remediation handed the work to a person", async () => {
    const store = newStore();
    const { adapter, comments } = adapterWithPrThread();
    const { runtime } = fakeRuntime({
      work: async () => {
        await adapter.postComment(
          project,
          7,
          `${STAGE_HANDED_MARKER}\n\nThis comment moves a requirement; it needs the full path.`,
        );
      },
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(atRemediation(store), project, { stage: "remediation" });

    expect(store.get("scratch-app#7")?.status).toBe("failed");
    expect(comments.at(-1)?.body).toContain("moves a requirement");
  });
});

describe("the model each session runs on", () => {
  /** A run parked at a gate, ready to be resumed into `stage`. */
  function parkedAt(store: RunStore, stage: PipelineStage): Run {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.park(run.id, {
      waitingOn: "the next stage",
      stage,
      waitCursor: "2026-08-03T09:00:00Z",
    });
    return store.get(run.id)!;
  }

  it("gives a triage session the model and effort the graph declares", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = classifyingRuntime("question", adapter);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(requests[0].model).toBe(modelFor("triage"));
    expect(requests[0].effort).toBe(effortFor("triage"));
  });

  it("gives an execution session its own row, not triage's", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime({
      work: async () => {
        await adapter.postComment(project, 7, `${STAGE_DONE_MARKER}\n\nBuilt.`);
      },
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      planStatusProbe: async () => "Complete — see reports/phase-04-complete.md",
      verificationReportProbe: async () =>
        "doc/plans/phases/reports/phase-04-verification.md",
    }).spawn(parkedAt(store, "planning"), project, { stage: "execution" });

    expect(requests[0].model).toBe(modelFor("execution"));
    expect(requests[0].effort).toBe("xhigh");
  });

  it("runs the approval record on its own declared model, never the default", async () => {
    // The second `runtime.start` site, and the one that would otherwise have
    // quietly kept whatever the runtime defaults to while every stage moved.
    const store = newStore();
    const { adapter } = fakeAdapter({
      ...thread,
      labels: ["timone", "triage:feature"],
      comments: [],
    });
    const { runtime, requests } = fakeRuntime();

    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");
    store.park(run.id, {
      waitingOn: "your answer on the ticket",
      kind: "gate",
      stage: "planning",
      waitCursor: "2026-08-03T09:00:00Z",
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
    }).spawn(store.get(run.id)!, project, {
      stage: "execution",
      approval: { stage: "planning", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    expect(requests[0].model).toBe(APPROVAL_RECORD_MODEL);
    // Not undefined — absent. Haiku 4.5 rejects the parameter, so the request
    // must not carry the key at all for the runtime to have anything to omit.
    expect("effort" in requests[0]).toBe(false);
  });

  it("starts no session at all for clarification, so its missing model is read by nobody", async () => {
    // This is why clarification declares neither model nor effort. `spawn()`
    // short-circuits to `openConversation` before `runStage`, so the request
    // that would have needed a model is never built.
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime, requests } = fakeRuntime();

    // Reached the way the pipeline reaches it: triage has already run, so the
    // run is active when clarification comes round.
    const run = pickedUpRun(store);
    store.activate(run.id, "session-triage");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      channel: {
        name: "fake",
        async open() {
          return { comment: "come and talk to me", waitingOn: "a chat" };
        },
        async conclude() {
          return "done";
        },
      },
    }).spawn(store.get(run.id)!, project, { stage: "clarification" });

    expect(requests).toHaveLength(0);
    expect(store.get("scratch-app#7")?.waitingKind).toBe("conversation");
  });
});

describe("saying what a session is doing while it does it", () => {
  /** A progress reader the test drives by hand. */
  function fakeProgress(): {
    reader: ProgressReader;
    setSnapshot: (snapshot: ProgressSnapshot) => void;
    setSummary: (summary: SessionSummary) => void;
  } {
    let snapshot: ProgressSnapshot = {
      elapsedMs: 0,
      replies: 0,
      outputTokens: 0,
      subAgents: 0,
    };
    let summary: SessionSummary | undefined;
    return {
      reader: {
        snapshot: () => snapshot,
        summary: () => summary,
      },
      setSnapshot: (next) => {
        snapshot = next;
      },
      setSummary: (next) => {
        summary = next;
      },
    };
  }

  /**
   * A ticker under the test's control, recording the interval it was asked
   * for and every time it was stopped. `ticks` says how many intervals have
   * elapsed by the time the session starts — deterministic, where firing by
   * hand mid-session would race the runtime's own promise.
   */
  function handTicker(options: { ticks?: number } = {}): {
    ticker: (onTick: () => void, intervalMs: number) => Ticker;
    stops: number;
    intervals: number[];
  } {
    const state = { stops: 0, intervals: [] as number[] };
    return {
      ticker: (fn, intervalMs) => {
        state.intervals.push(intervalMs);
        for (let i = 0; i < (options.ticks ?? 0); i += 1) fn();
        return {
          stop: () => {
            state.stops += 1;
          },
        };
      },
      get stops() {
        return state.stops;
      },
      get intervals() {
        return state.intervals;
      },
    };
  }

  /** A runtime whose session reports progress the test controls. */
  function watchedRuntime(
    progress: ProgressReader,
    options: { ok?: boolean; error?: string; work?: () => Promise<void> } = {},
  ): SessionRuntime {
    return {
      async start() {
        return {
          sessionId: "session-abc",
          progress,
          completed: (async () => {
            await options.work?.();
            return {
              sessionId: "session-abc",
              ok: options.ok ?? true,
              error: options.error,
            };
          })(),
        };
      },
    };
  }

  it("prints elapsed time, turns, tokens and the fleet on every tick", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const progress = fakeProgress();
    const clock = handTicker({ ticks: 1 });
    const lines: string[] = [];

    progress.setSnapshot({
      elapsedMs: 252_000,
      replies: 18,
      outputTokens: 42_100,
      subAgents: 3,
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: watchedRuntime(progress.reader, {
        work: async () => {
          await adapter.applyLabel(project, 7, "triage:question");
          await adapter.postComment(project, 7, "a question.");
        },
      }),
      root: "/root",
      ticker: clock.ticker,
      log: (message) => lines.push(message),
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(lines).toContainEqual(
      expect.stringContaining("4m12s · 18 replies · 42.1k out · 3 sub-agents"),
    );
  });

  it("closes with the cost, and stops the ticker, even when the session failed", async () => {
    // The failure path is where a leaked timer would live, because it is the
    // path nobody watches — and the cost was spent either way.
    const store = newStore();
    const { adapter } = fakeAdapter();
    const progress = fakeProgress();
    const clock = handTicker();
    const lines: string[] = [];

    progress.setSummary({
      durationMs: 5_000,
      turns: 2,
      costUsd: 0.12,
      models: [{ model: "claude-sonnet-5", outputTokens: 900 }],
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: watchedRuntime(progress.reader, {
        ok: false,
        error: "model unavailable",
      }),
      root: "/root",
      ticker: clock.ticker,
      log: (message) => lines.push(message),
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(store.get("scratch-app#7")?.status).toBe("failed");
    expect(lines).toContainEqual(expect.stringContaining("$0.12"));
    expect(clock.stops).toBe(1);
  });

  it("prints no tick at all for a session shorter than one interval", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const progress = fakeProgress();
    const clock = handTicker();
    const lines: string[] = [];

    progress.setSummary({
      durationMs: 4_000,
      turns: 1,
      costUsd: 0.02,
      models: [],
    });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: watchedRuntime(progress.reader, {
        work: async () => {
          // The ticker is never fired: the session ended before one interval.
          await adapter.applyLabel(project, 7, "triage:question");
          await adapter.postComment(project, 7, "a question.");
        },
      }),
      root: "/root",
      ticker: clock.ticker,
      log: (message) => lines.push(message),
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(lines.filter((line) => line.startsWith("work"))).toHaveLength(0);
    expect(lines).toContainEqual(expect.stringContaining("$0.02"));
  });

  it("ticks at the interval it was given, in milliseconds", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const progress = fakeProgress();
    const clock = handTicker();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: watchedRuntime(progress.reader, {
        work: async () => {
          await adapter.applyLabel(project, 7, "triage:question");
          await adapter.postComment(project, 7, "a question.");
        },
      }),
      root: "/root",
      progressIntervalMs: 45_000,
      ticker: clock.ticker,
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(clock.intervals).toEqual([45_000]);
  });

  it("ticks even when it has nothing to print, because the tick is also the heartbeat", async () => {
    // ADR-0017: one tick, two jobs. A tick made conditional on having
    // something to say would move recovery with it — the run would go quiet
    // and be reclaimed for having no progress reader.
    const store = newStore();
    const { adapter } = fakeAdapter();
    const clock = handTicker({ ticks: 1 });
    const lines: string[] = [];

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: classifyingRuntime("question", adapter).runtime,
      root: "/root",
      ticker: clock.ticker,
      log: (message) => lines.push(message),
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(clock.intervals).toEqual([30_000]);
    expect(clock.stops).toBe(1);
    // Nothing printed — there was nothing to say — but the run was stamped.
    expect(lines.filter((line) => line.startsWith("work"))).toHaveLength(0);
    expect(store.get("scratch-app#7")?.heartbeatAt).toEqual(expect.any(String));
  });

  it("stamps the heartbeat on every tick of a session that does report", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const progress = fakeProgress();
    const clock = handTicker({ ticks: 2 });

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: watchedRuntime(progress.reader, {
        work: async () => {
          await adapter.applyLabel(project, 7, "triage:question");
          await adapter.postComment(project, 7, "a question.");
        },
      }),
      root: "/root",
      ticker: clock.ticker,
    }).spawn(pickedUpRun(store), project, { stage: "triage" });

    expect(store.get("scratch-app#7")?.heartbeatAt).toEqual(expect.any(String));
  });

  it("defaults to thirty seconds", () => {
    expect(DEFAULT_PROGRESS_INTERVAL_SECONDS).toBe(30);
  });
});

describe("how a session's ending is judged", () => {
  it("believes a plain success", () => {
    expect(sessionOutcomeFrom("s1", { subtype: "success" }, undefined)).toEqual({
      sessionId: "s1",
      ok: true,
    });
  });

  it("fails a session whose last word was an API error, however it was reported", () => {
    // Found live on 2026-08-07. A planning session died on "API Error:
    // Connection closed mid-response" — the transcript ends on a synthetic
    // message carrying `error: "server_error"` — and the SDK still reported
    // `subtype: "success"`. The daemon believed it, opened a gate over a
    // branch with nothing on it, and asked a human to approve a document
    // that was never written.
    const outcome = sessionOutcomeFrom("s1", { subtype: "success" }, "server_error");

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("server_error");
  });

  it("fails a success that flags itself as an error", () => {
    const outcome = sessionOutcomeFrom("s1", { subtype: "success", is_error: true }, undefined);

    expect(outcome.ok).toBe(false);
  });

  it("still reports a non-success subtype as before", () => {
    expect(
      sessionOutcomeFrom("s1", { subtype: "error_max_turns" }, undefined),
    ).toMatchObject({ ok: false, error: "error_max_turns" });
  });

  it("does not fail a session that recovered from a transient error", () => {
    // The caller clears the error whenever the model speaks again, so an
    // error the CLI retried past never reaches here. Recording the rule where
    // it is relied upon, so the clearing is not later "tidied" into a latch.
    expect(sessionOutcomeFrom("s1", { subtype: "success" }, undefined).ok).toBe(true);
  });
});

describe("a gate is never opened over a branch that was merely created", () => {
  /** A run parked at the plan gate, ready to be resumed into planning. */
  function readyToPlan(store: RunStore): Run {
    const { run } = store.register("scratch-app", 7);
    store.activate(run.id, "s0");
    return store.get(run.id)!;
  }

  it("refuses to gate when the stage cut a branch and committed nothing", async () => {
    // Found live on 2026-08-07: `headBefore` was undefined because the branch
    // did not exist, so an empty branch cut from main compared unequal and
    // read as work. The gate-over-nothing guard had a hole exactly where it
    // was most needed — the first stage to own a branch.
    const store = newStore();
    const { adapter, comments } = fakeAdapter({
      ...thread,
      labels: ["timone", "triage:chore"],
      comments: [],
    });
    const { runtime } = fakeRuntime();
    let calls = 0;

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      // The branch does not exist before the session — the stage cuts it —
      // and afterwards it sits on exactly the commit it was cut from.
      repoProbe: async () => (calls++ === 0 ? undefined : "sha-base"),
      headProbe: async () => "sha-base",
    }).spawn(readyToPlan(store), project, { stage: "planning" });

    expect(store.get("scratch-app#7")?.status).toBe("failed");
    expect(store.get("scratch-app#7")?.failure).toMatch(/without committing anything/);
    expect(comments.at(-1)?.body).toContain("nothing for you to approve");
  });

  it("gates normally when the new branch actually carries a commit", async () => {
    const store = newStore();
    const { adapter, comments } = fakeAdapter({
      ...thread,
      labels: ["timone", "triage:chore"],
      comments: [],
    });
    const { runtime } = fakeRuntime();
    let calls = 0;

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: async () => (calls++ === 0 ? undefined : "sha-after"),
      headProbe: async () => "sha-base",
    }).spawn(readyToPlan(store), project, { stage: "planning" });

    expect(store.get("scratch-app#7")?.status).toBe("parked");
    expect(comments.at(-1)?.body).toContain("approve");
  });

  it("still judges an existing branch by whether its tip moved", async () => {
    // The path that already worked, unchanged: a stage resuming on a branch
    // it already owns is measured against that branch, not against HEAD.
    const store = newStore();
    const { adapter } = fakeAdapter({
      ...thread,
      labels: ["timone", "triage:chore"],
      comments: [],
    });
    const { runtime } = fakeRuntime();
    const run = readyToPlan(store);
    store.claimBranch(run.id, "timone/7-the-page-feels-slow");

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      repoProbe: movingProbe(),
      // Deliberately equal to the "after" tip: if HEAD were consulted for a
      // branch that already exists, this would wrongly read as no work.
      headProbe: async () => "sha-after",
    }).spawn(store.get(run.id)!, project, { stage: "planning" });

    expect(store.get("scratch-app#7")?.status).toBe("parked");
  });
});
