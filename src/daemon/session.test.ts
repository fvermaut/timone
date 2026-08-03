import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  isMachineComment,
  stampMachineComment,
  type Ticket,
  type TicketingAdapter,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import { gateCommentFor } from "./gate-comment.js";
import { RunStore, type Run } from "./runs.js";
import {
  AgentSessionSpawner,
  type SessionRequest,
  type SessionRuntime,
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
 * A ticket the fakes can actually change, because the pipeline reads the
 * ticket back after every session: the classification lives on a label, and
 * a stale fake would make the daemon look broken in tests and fine in life.
 */
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
    async getTicket(): Promise<TicketThread> {
      return { ...ticket, labels: [...ticket.labels], comments: [...ticket.comments] };
    },
    async postComment(_project, number, body): Promise<void> {
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
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("parked");
    // And a second exit flip is refused by the store, not merely avoided here.
    expect(() => store.park(run.id, { waitingOn: "again" })).toThrow(/parked/);
  });

  it("runs the post-session checks after the session, not before", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = classifyingRuntime("feature", adapter);
    const order: string[] = [];
    const run = pickedUpRun(store);

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      afterSession: async (finishedRun) => {
        order.push(`checked:${finishedRun.id}`);
      },
    }).spawn(run, project);

    expect(order).toEqual(["checked:scratch-app#7"]);
  });

  it("checks after every session, not only the last one", async () => {
    const store = newStore();
    const { adapter } = fakeAdapter();
    const { runtime } = classifyingRuntime("bug", adapter);
    const checks: string[] = [];

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
      afterSession: async (run) => {
        checks.push(run.status);
      },
    }).spawn(pickedUpRun(store), project);

    // Once after triage's session, once when the run parks unbuilt.
    expect(checks).toEqual(["active", "parked"]);
  });

  it("does not let a failing post-session check crash the spawn", async () => {
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
      afterSession: async () => {
        throw new Error("git blew up");
      },
    }).spawn(run, project);

    expect(store.get(run.id)?.status).toBe("parked");
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
    }).spawn(atRequirements(store), project, { stage: "requirements" });

    // The branch existed while the session ran: a session that cut one on a
    // project another run held would collide before the ledger knew.
    expect(claimed).toEqual(["timone/7-the-page-feels-slow"]);
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
    const { adapter, comments } = fakeAdapter(settled);
    const { runtime, requests } = fakeRuntime();

    await new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime,
      root: "/root",
    }).spawn(atPlanningGate(store), project, {
      stage: "execution",
      approval: { stage: "planning", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    // One session — the recording one. Execution is not built, so the run
    // then parks there and says so.
    expect(requests).toHaveLength(1);
    expect(store.get("scratch-app#7")?.stage).toBe("execution");
    expect(comments.at(-1)?.body).toMatch(/isn't built yet/i);
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
    }).spawn(store.get(run.id)!, project, {
      stage: "planning",
      approval: { stage: "requirements", by: "fvermaut", at: "2026-08-03T12:00:00Z" },
    });

    expect(requests[0].prompt).toMatch(/status to Active/i);
  });
});
