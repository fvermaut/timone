import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  TicketingAdapter,
  TicketingProject,
  TicketThread,
} from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { SessionProgress } from "../daemon/progress.js";
import { RunStore, type Run } from "../daemon/runs.js";
import { RunningSteps, type RunnerActionDeps } from "./actions.js";
import { appendEntry, readRecord, type RecordEntry } from "./record.js";
import { RUNNER_SERVER_NAME } from "./tools.js";
import { RunnerSessions, wakeRunner, type RunQuery } from "./session.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PROJECT: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

/** scratch-app, driven by the runner and instructed by the operator. */
const MANIFEST: Manifest = {
  operator: "fvermaut",
  projects: {
    "scratch-app": {
      repo_url: PROJECT.repoUrl,
      path: "projects/scratch-app",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
    },
  },
};

/** A new feature ticket on scratch-app, with no comments yet. */
function featureTicket(): TicketThread {
  return {
    number: 12,
    title: "A due date on each task",
    body: "Each task should have a due date. The list should show the late tasks first, in red.",
    labels: ["timone", "triage:feature"],
    url: "https://github.com/fvermaut/scratch-app/issues/12",
    author: "fvermaut",
    createdAt: "2026-09-27T09:00:00Z",
    comments: [],
  };
}

/**
 * An in-memory forge holding one ticket. Only the calls a wake makes are
 * written; any other call throws, and the facts read from the forge then
 * come back unknown, which is what `gatherFacts` does with a failed call.
 */
function fakeForge(ticket: TicketThread) {
  const state = {
    thread: { ...ticket, comments: [...ticket.comments] },
    /** Every comment posted on the ticket, in order. */
    posted: [] as string[],
  };
  const known: Partial<TicketingAdapter> = {
    getTicket: async () => ({ ...state.thread, comments: [...state.thread.comments] }),
    postComment: async (_project, _number, body) => {
      state.posted.push(body);
      state.thread.comments.push({
        author: "timone-agent",
        body,
        createdAt: "2026-09-27T12:00:01Z",
        fromTimone: true,
      });
    },
  };
  const adapter = new Proxy(known, {
    get(target, name) {
      const call = target[name as keyof TicketingAdapter];
      if (call !== undefined) return call;
      return async () => {
        throw new Error(`no test here calls the forge's ${String(name)}`);
      };
    },
  }) as TicketingAdapter;
  return { adapter, state };
}

/** One call the scripted runner makes to one of its tools. */
interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * What the scripted runner does when it is started once: call its tools and
 * end with a cost; fail by throwing, as the SDK throws when it cannot reach
 * the model; or say exactly the SDK messages given, then throw `thenThrows`
 * when it is set, as the SDK does after a last message that was an error.
 */
type Play =
  | {
      kind: "calls";
      calls: ToolCall[];
      costUsd: number;
      until?: Promise<void>;
      /** Something that happens elsewhere once the calls are made, before the session ends. */
      afterCalls?: () => void;
    }
  | { kind: "throws"; error: string }
  | { kind: "says"; messages: unknown[]; thenThrows?: string };

/** A session that makes no tool call and costs `costUsd`. */
function quiet(costUsd = 0.1): Play {
  return { kind: "calls", calls: [], costUsd };
}

/**
 * A stand-in for the SDK's `query`: each start plays the next scripted play
 * against the real tool server it was handed, through an MCP client, the way
 * the model's calls reach it. What it was started with, the tools the server
 * offered, and what each call answered are kept for the test to read.
 */
function scriptedRunner(plays: Play[]) {
  const started: { prompt: string; options: Options }[] = [];
  const offered: string[][] = [];
  const answers: unknown[] = [];
  /** How many sessions are running now, and the most there ever were at once. */
  const at = { running: 0, most: 0 };

  async function* play(next: Play, options: Options): AsyncGenerator<unknown> {
    at.running += 1;
    at.most = Math.max(at.most, at.running);
    try {
      yield* played(next, options);
    } finally {
      at.running -= 1;
    }
  }

  async function* played(next: Play, options: Options): AsyncGenerator<unknown> {
    if (next.kind === "throws") throw new Error(next.error);
    if (next.kind === "says") {
      yield* next.messages;
      if (next.thenThrows !== undefined) throw new Error(next.thenThrows);
      return;
    }
    const server = options.mcpServers?.[RUNNER_SERVER_NAME];
    if (server?.type !== "sdk") throw new Error("the runner was given no tool server of its own");
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.instance.connect(serverSide);
    const client = new Client({ name: "scripted-runner", version: "1.0.0" });
    await client.connect(clientSide);
    offered.push((await client.listTools()).tools.map((tool) => tool.name));
    for (const call of next.calls) {
      answers.push(await client.callTool({ name: call.name, arguments: call.input }));
    }
    await client.close();
    next.afterCalls?.();
    if (next.until !== undefined) await abortable(next.until, options.abortController?.signal);
    yield {
      type: "result",
      subtype: "success",
      is_error: false,
      total_cost_usd: next.costUsd,
      num_turns: next.calls.length + 1,
      result: "Done.",
    };
  }

  const runQuery: RunQuery = ({ prompt, options }) => {
    started.push({ prompt, options });
    return play(plays.shift() ?? quiet(), options);
  };
  return { runQuery, started, offered, answers, at };
}

/**
 * `held`, or a rejection as soon as `signal` is aborted: how the SDK ends a
 * session whose abort controller fires.
 */
function abortable(held: Promise<void>, signal: AbortSignal | undefined): Promise<void> {
  if (signal === undefined) return held;
  return Promise.race([
    held,
    new Promise<void>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("The operation was aborted.")), {
        once: true,
      });
    }),
  ]);
}

/** A promise the test resolves when it chooses, to hold a session open. */
function gate(): { opened: Promise<void>; open(): void } {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/** Everything one test needs, and the doubles to look at afterwards. */
interface World {
  root: string;
  store: RunStore;
  run: Run;
  forge: ReturnType<typeof fakeForge>["state"];
  running: RunningSteps;
  actionDeps: (run: Run) => RunnerActionDeps;
  /** The ticket's record, as the machine wrote it. */
  record(): RecordEntry[];
}

/**
 * Run `scratch-app#12/1`, just picked up, with nothing running, on a project
 * with `places` places.
 *
 * ✏ 2026-10-05: one place unless a case says otherwise. The cases here were
 * written when every project had one place (ADR-0063 D1); a project now has
 * two unless `timone.yaml` sets another number (PRD-07.R2).
 */
function world(places = 1): World {
  const root = mkdtempSync(join(tmpdir(), "timone-runner-session-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"), {
    placesOf: () => places,
  });
  const { run } = store.register(PROJECT.name, 12);
  const { adapter, state } = fakeForge(featureTicket());
  const running = new RunningSteps();
  const actionDeps = (): RunnerActionDeps => ({
    store,
    adapter,
    manifest: MANIFEST,
    root,
    timonePin: async () => undefined,
    project: PROJECT,
    ticketContext: { isStep: false, isRemediation: false },
    startStep: () => {
      throw new Error("no test here starts a step");
    },
    running,
    stepEnded: async () => {},
    clock: () => "2026-09-27T12:00:00.000Z",
    log: () => {},
  });
  return {
    root,
    store,
    run,
    forge: state,
    running,
    actionDeps,
    record: () => {
      const read = readRecord(root, PROJECT.name, 12);
      if (!read.ok) throw new Error(read.error.message);
      return read.value;
    },
  };
}

describe("a wake of the runner", () => {
  it("starts the runner with no built-in tool and one tool server, allowed only the nine actions (R2)", async () => {
    const w = world();
    const runner = scriptedRunner([quiet()]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
    );

    expect(runner.started).toHaveLength(1);
    const { options } = runner.started[0]!;
    expect(options.tools).toEqual([]);
    expect(Object.keys(options.mcpServers ?? {})).toEqual(["runner"]);
    expect(options.allowedTools).toEqual([
      "mcp__runner__start_step",
      "mcp__runner__message_step",
      "mcp__runner__stop_step",
      "mcp__runner__post",
      "mcp__runner__set_hold",
      "mcp__runner__record_approval",
      "mcp__runner__file_timone_issue",
      "mcp__runner__comment_timone_issue",
      "mcp__runner__end_run",
    ]);
    expect(runner.offered).toEqual([
      [
        "start_step",
        "message_step",
        "stop_step",
        "post",
        "set_hold",
        "record_approval",
        "file_timone_issue",
        "comment_timone_issue",
        "end_run",
      ],
    ]);
  });

  it("parks a run whose wake started no step on the runner's wait, waiting for what the runner asked for on the ticket", async () => {
    const w = world();
    const runner = scriptedRunner([
      {
        kind: "calls",
        calls: [
          {
            name: "post",
            input: {
              where: "ticket",
              body:
                "**The requirements are written.** [prd-02-due-dates.md](https://github.com/fvermaut/scratch-app/blob/timone/12-a-due-date-on-each-task/doc/specs/prd/prd-02-due-dates.md)\n\n" +
                '**What I need from you:** read them and reply "approved", or say what to change.',
              reason: "The requirements need a named person's approval before the pieces are worked out.",
            },
          },
        ],
        costUsd: 0.31,
      },
    ]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["The step that writes down what it needs ended."],
    );

    expect(w.forge.posted).toHaveLength(1);
    const parked = w.store.get(w.run.id);
    expect(parked?.status).toBe("parked");
    expect(parked?.wait).toMatchObject({
      kind: "runner",
      on: 'read them and reply "approved", or say what to change.',
    });
  });

  it("lets the runner end a run it is woken on as soon as the run is picked up", async () => {
    const w = world();
    const runner = scriptedRunner([
      {
        kind: "calls",
        calls: [
          {
            name: "end_run",
            input: {
              reason: "The ticket asks a question that is already answered in the README.",
              closeTicket: false,
            },
          },
        ],
        costUsd: 0.12,
      },
    ]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["The ticket was marked for the machine."],
    );

    expect(runner.answers).toEqual([{ content: [{ type: "text", text: "The run is ended." }] }]);
    expect(w.store.get(w.run.id)?.status).toBe("done");
  });

  it("starts no session for a run that ended before its wake came round, and writes nothing about it", async () => {
    const w = world();
    w.store.activate(w.run.id, "step-session-1");
    w.store.complete(w.run.id);
    const runner = scriptedRunner([quiet()]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["The step that records the approval ended."],
    );

    expect(runner.started).toEqual([]);
    expect(w.record()).toEqual([]);
    expect(w.store.get(w.run.id)?.status).toBe("done");
  });

  it("writes down that the runner woke, with its events, and what its session cost when it ended", async () => {
    const w = world();
    const runner = scriptedRunner([quiet(0.42)]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
    );

    expect(w.record()).toEqual([
      {
        kind: "woke",
        at: "2026-09-27T12:00:00.000Z",
        runId: "scratch-app#12/1",
        events: ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
      },
      {
        kind: "runner-ended",
        at: "2026-09-27T12:00:00.000Z",
        runId: "scratch-app#12/1",
        ok: true,
        costUsd: 0.42,
      },
    ]);
  });

  it("runs a wake asked for while one is running after it, with the events of every wake asked for meanwhile", async () => {
    const w = world();
    const held = gate();
    const runner = scriptedRunner([
      { kind: "calls", calls: [], costUsd: 0.2, until: held.opened },
      quiet(0.15),
    ]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const first = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.waitFor(() => expect(runner.started).toHaveLength(1));
    const second = sessions.wake(w.run, ["The step that writes down what it needs ended."]);
    const third = sessions.wake(w.run, [
      "fvermaut commented on the pull request at 2026-09-27T12:03:10Z.",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runner.started).toHaveLength(1);

    held.open();
    await Promise.all([first, second, third]);

    expect(runner.started).toHaveLength(2);
    expect(runner.at.most).toBe(1);
    expect(
      w.record().flatMap((entry) => (entry.kind === "woke" ? [entry.events] : [])),
    ).toEqual([
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
      [
        "The step that writes down what it needs ended.",
        "fvermaut commented on the pull request at 2026-09-27T12:03:10Z.",
      ],
    ]);
    expect(runner.started[1]!.prompt).toContain("- The step that writes down what it needs ended.");
    expect(runner.started[1]!.prompt).toContain(
      "- fvermaut commented on the pull request at 2026-09-27T12:03:10Z.",
    );
  });

  it("starts no session when the ticket's record cannot be read, and writes down why", async () => {
    const w = world();
    const path = join(w.root, ".timone", "records", "scratch-app", "12.jsonl");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '{"kind":"step-started","at":"2026-09-27T09:01:00Z"\n');
    const runner = scriptedRunner([quiet()]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
    );

    expect(runner.started).toEqual([]);
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(JSON.parse(lines.at(-1)!)).toEqual({
      kind: "runner-ended",
      at: "2026-09-27T12:00:00.000Z",
      runId: "scratch-app#12/1",
      ok: false,
      costUsd: 0,
      error:
        "The run record .timone/records/scratch-app/12.jsonl cannot be read: line 1 is not JSON.",
    });
  });

  it("tells the runner what the running step did since the last check, and since when it has been silent", async () => {
    const w = world();
    w.store.activate(w.run.id, "step-session-7");
    let now = Date.parse("2026-09-27T11:40:00.000Z");
    const progress = new SessionProgress({ now: () => now });
    progress.observe({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "npm test" } }],
        usage: { input_tokens: 25_000, output_tokens: 4 },
      },
      uuid: "assistant-uuid",
      session_id: "step-session-7",
    } as unknown as SDKMessage);
    now = Date.parse("2026-09-27T12:00:00.000Z");
    w.running.set(w.run.id, {
      stage: "execution",
      startedAt: "2026-09-27T11:30:00.000Z",
      session: {
        sessionId: "step-session-7",
        completed: new Promise(() => {}),
        progress,
        stop: () => {},
      },
    });
    const runner = scriptedRunner([quiet()]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["The step has been running for 30 minutes."],
      { checkSince: "2026-09-27T11:45:00.000Z" },
    );

    const prompt = runner.started[0]!.prompt;
    expect(prompt).toContain("A step is running: building. It started at 2026-09-27T11:30:00.000Z.");
    expect(prompt).toContain("Commands and tools it used since the last check: none");
    // `npm test` has had no result: it started before the last check, and
    // still runs.
    expect(prompt).toContain(
      "Still running: Bash(npm test), started at 2026-09-27T11:40:00.000Z, 20 minutes ago.",
    );
    expect(prompt).toContain("It has been silent since 2026-09-27T11:40:00.000Z.");
  });

  it("tells the runner a step ticket is not held, though it carries timone:held, the machine's own claim put on at pickup", async () => {
    const w = world();
    w.forge.thread.labels = ["timone", "timone:held"];
    const onAStep = (run: Run): RunnerActionDeps => ({
      ...w.actionDeps(run),
      ticketContext: { isStep: true, isRemediation: false },
    });
    const runner = scriptedRunner([quiet()]);

    await wakeRunner({ runQuery: runner.runQuery, actionsFor: onAStep }, w.run, [
      "The ticket was marked for the machine.",
    ]);

    const prompt = runner.started[0]!.prompt;
    expect(prompt).toContain("\nNot held.\n");
    expect(prompt).not.toContain("Held: the ticket has the label timone:held");
  });

  it("tells the runner a ticket that is not a step ticket is held when it carries timone:held", async () => {
    const w = world();
    w.forge.thread.labels = ["timone", "triage:feature", "timone:held"];
    const runner = scriptedRunner([quiet()]);

    await wakeRunner({ runQuery: runner.runQuery, actionsFor: w.actionDeps }, w.run, [
      "fvermaut commented on the ticket at 2026-09-27T11:58:40Z.",
    ]);

    const prompt = runner.started[0]!.prompt;
    expect(prompt).toContain(
      "Held: the ticket has the label timone:held, so the machine will not take it up again until a person removes that label.",
    );
    expect(prompt).not.toContain("\nNot held.\n");
  });
});

describe("a runner that fails", () => {
  it("is tried again after 60 seconds and then 5 minutes, with nothing posted on the ticket meanwhile (R16)", async () => {
    vi.useFakeTimers();
    const w = world();
    const unreachable: Play = { kind: "throws", error: "API Error: Connection error." };
    const runner = scriptedRunner([unreachable, unreachable, quiet(0.2)]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.started).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(runner.started).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(runner.started).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(299_999);
    expect(runner.started).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(runner.started).toHaveLength(3);
    await woken;

    expect(w.forge.posted).toEqual([]);
    expect(w.record().filter((entry) => entry.kind === "woke")).toHaveLength(3);
  });

  it("says once, after the third failure, that the machine cannot reach its model, leaves the run as it was, and tries again 15 minutes later (R16)", async () => {
    vi.useFakeTimers();
    const w = world();
    w.store.park(w.run.id, {
      waitingOn: 'read them and reply "approved", or say what to change.',
      kind: "runner",
      waitCursor: "2026-09-27T11:00:00.000Z",
      resolvableBy: ["requirements"],
    });
    const before = w.store.get(w.run.id);
    const unreachable: Play = { kind: "throws", error: "API Error: Connection error." };
    const runner = scriptedRunner([unreachable, unreachable, unreachable, unreachable, unreachable]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.advanceTimersByTimeAsync(60_000 + 300_000);
    await woken;

    expect(runner.started).toHaveLength(3);
    expect(w.forge.posted).toEqual([
      "**I cannot reach the model I use to decide what to do next.** I tried three times. " +
        "Nothing on this ticket changed, and nothing you did caused this. " +
        "I will keep trying every 15 minutes.\n\n" +
        "**What I need from you:** nothing.",
    ]);
    const after = w.store.get(w.run.id);
    expect(after?.status).toBe(before?.status);
    expect(after?.wait).toEqual(before?.wait);

    await vi.advanceTimersByTimeAsync(15 * 60_000 - 1);
    expect(runner.started).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(runner.started).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(runner.started).toHaveLength(5);
    expect(w.forge.posted).toHaveLength(1);
  });

  it("is tried no more once the run's wakes are stopped", async () => {
    vi.useFakeTimers();
    const w = world();
    const unreachable: Play = { kind: "throws", error: "API Error: Connection error." };
    const runner = scriptedRunner([unreachable, unreachable, unreachable, unreachable]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.started).toHaveLength(1);
    sessions.stop(w.run.id);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    await woken;

    expect(runner.started).toHaveLength(1);
    expect(w.forge.posted).toEqual([]);
  });

  it("ends the session in flight when the run's wakes are stopped, and writes down that it was stopped", async () => {
    const w = world();
    const never = gate();
    const runner = scriptedRunner([{ kind: "calls", calls: [], costUsd: 0.3, until: never.opened }]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.waitFor(() => expect(runner.started).toHaveLength(1));
    sessions.stop(w.run.id);
    await woken;

    expect(w.record().at(-1)).toEqual({
      kind: "runner-ended",
      at: "2026-09-27T12:00:00.000Z",
      runId: "scratch-app#12/1",
      ok: false,
      costUsd: 0,
      error: "the session was stopped",
    });
  });

  it("is tried again when its session stopped on a broken link, though the SDK called that a success", async () => {
    vi.useFakeTimers();
    const w = world();
    const runner = scriptedRunner([
      {
        kind: "says",
        messages: [
          {
            type: "assistant",
            parent_tool_use_id: null,
            error: "server_error",
            message: { content: [{ type: "text", text: "API Error: Connection closed mid-response" }] },
          },
          { type: "result", subtype: "success", is_error: false, total_cost_usd: 0.05, result: "" },
        ],
      },
      quiet(0.2),
    ]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.advanceTimersByTimeAsync(60_000);
    await woken;

    expect(runner.started).toHaveLength(2);
    expect(w.record().filter((entry) => entry.kind === "runner-ended")).toEqual([
      {
        kind: "runner-ended",
        at: "2026-09-27T12:00:00.000Z",
        runId: "scratch-app#12/1",
        ok: false,
        costUsd: 0.05,
        error: "the session stopped on an API error (server_error: API Error: Connection closed mid-response)",
      },
      {
        kind: "runner-ended",
        at: "2026-09-27T12:00:00.000Z",
        runId: "scratch-app#12/1",
        ok: true,
        costUsd: 0.2,
      },
    ]);
  });

  it("writes down a session that reached its spending cap as failed, and neither tries it again nor posts anything", async () => {
    vi.useFakeTimers();
    const w = world();
    w.store.park(w.run.id, {
      waitingOn: "the next thing that happens on this ticket",
      kind: "runner",
      waitCursor: "2026-09-27T11:00:00.000Z",
      resolvableBy: ["triage"],
    });
    const before = w.store.get(w.run.id);
    const runner = scriptedRunner([
      {
        kind: "says",
        messages: [
          {
            type: "result",
            subtype: "error_max_budget_usd",
            is_error: true,
            total_cost_usd: 5.02,
            errors: ["Reached maximum budget ($5)"],
          },
        ],
      },
    ]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    await woken;

    expect(runner.started).toHaveLength(1);
    expect(w.forge.posted).toEqual([]);
    expect(w.store.get(w.run.id)?.wait).toEqual(before?.wait);
    expect(w.record().at(-1)).toEqual({
      kind: "runner-ended",
      at: "2026-09-27T12:00:00.000Z",
      runId: "scratch-app#12/1",
      ok: false,
      costUsd: 5.02,
      error: "error_max_budget_usd: Reached maximum budget ($5)",
    });
  });
});

describe("what a runner session that fails costs the ticket", () => {
  it("keeps the cost of a session the SDK ended by throwing after its last message, which was an error", async () => {
    const w = world();
    const runner = scriptedRunner([
      {
        kind: "says",
        messages: [
          {
            type: "result",
            subtype: "error_max_budget_usd",
            is_error: true,
            total_cost_usd: 5.02,
            errors: ["Reached maximum budget ($5)"],
          },
        ],
        thenThrows: "Claude Code returned an error result: Reached maximum budget ($5)",
      },
    ]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.run,
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
    );

    expect(w.record().at(-1)).toMatchObject({ kind: "runner-ended", ok: false, costUsd: 5.02 });
  });

  it("starts no second session once a failed session took the ticket over its limit, though the failure is one that is tried again", async () => {
    vi.useFakeTimers();
    const w = world();
    appendEntry(w.root, PROJECT.name, 12, {
      kind: "step-ended",
      at: "2026-09-27T11:00:00.000Z",
      runId: w.run.id,
      stage: "triage",
      sessionId: "a7c0e2d4-triage",
      ok: true,
      costUsd: 148,
    });
    const runner = scriptedRunner([
      {
        kind: "says",
        messages: [
          {
            type: "result",
            subtype: "success",
            is_error: true,
            total_cost_usd: 4.002,
            result: "API Error: 400 The request was refused.",
          },
        ],
        thenThrows: "Claude Code returned an error result: API Error: 400 The request was refused.",
      },
      quiet(0.2),
    ]);
    const sessions = new RunnerSessions({ runQuery: runner.runQuery, actionsFor: w.actionDeps });

    const woken = sessions.wake(w.run, ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."]);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    await woken;

    expect(runner.started).toHaveLength(1);
    expect(w.record().filter((entry) => entry.kind === "runner-ended")).toEqual([
      {
        kind: "runner-ended",
        at: "2026-09-27T12:00:00.000Z",
        runId: "scratch-app#12/1",
        ok: false,
        costUsd: 4.002,
        error: "Claude Code returned an error result: API Error: 400 The request was refused.",
      },
    ]);
  });
});

describe("what a run waits on after a wake in which the runner posted nothing", () => {
  it("waits on what the ticket's newest machine comment asks for, after a step whose comment asked a question", async () => {
    const w = world();
    // The step that asks what the ticket needs has ended, and the driver put
    // the run back on the runner's wait, as it does after every step.
    w.store.park(w.run.id, {
      waitingOn: "the runner to look at what the step did",
      kind: "runner",
      stage: "clarification",
      waitCursor: "2026-09-27T11:59:30Z",
      resolvableBy: ["clarification"],
    });
    w.forge.thread.comments.push({
      author: "timone-agent",
      body:
        "**I have two questions before I write down what you need.**\n\n" +
        "1. Should a task with no due date go last in the list? I suggest yes.\n" +
        "2. Should a late task show its date in red, or only its title? I suggest the date.\n\n" +
        '**What I need from you:** answer the two questions, or reply "yes to all" to take my suggestions.',
      createdAt: "2026-09-27T11:59:10Z",
      fromTimone: true,
    });
    const runner = scriptedRunner([quiet(0.05)]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.store.get(w.run.id)!,
      ["The step asking what you need ended: it succeeded."],
    );

    expect(w.forge.posted).toEqual([]);
    const parked = w.store.get(w.run.id);
    expect(parked?.status).toBe("parked");
    expect(parked?.wait).toMatchObject({
      kind: "runner",
      on: 'answer the two questions, or reply "yes to all" to take my suggestions.',
    });
  });

  it("keeps the wait it had, and still ends the wake, when the ticket cannot be read once the session has ended", async () => {
    const w = world();
    w.store.park(w.run.id, {
      waitingOn: 'read them and reply "approved", or say what to change.',
      kind: "runner",
      waitCursor: "2026-09-27T11:59:30Z",
      resolvableBy: ["requirements"],
    });
    // The forge answers while the brief is built, and stops answering once
    // the session has ended.
    const actionsFor = (run: Run): RunnerActionDeps => {
      const deps = w.actionDeps(run);
      const adapter = new Proxy(deps.adapter, {
        get(target, name) {
          if (name !== "getTicket") return Reflect.get(target, name);
          return async (...args: Parameters<TicketingAdapter["getTicket"]>) => {
            if (w.record().some((entry) => entry.kind === "runner-ended")) {
              throw new Error("GitHub answered 502 Bad Gateway");
            }
            return target.getTicket(...args);
          };
        },
      });
      return { ...deps, adapter };
    };
    const runner = scriptedRunner([quiet(0.05)]);

    const end = await wakeRunner(
      { runQuery: runner.runQuery, actionsFor },
      w.store.get(w.run.id)!,
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
    );

    expect(end).toEqual({ kind: "ended", costUsd: 0.05 });
    expect(w.store.get(w.run.id)?.wait).toMatchObject({
      kind: "runner",
      on: 'read them and reply "approved", or say what to change.',
    });
  });
});

describe("a place on the project after a wake (ADR-0063 D2, D3)", () => {
  /** When each ticket was opened on the forge: #12 first, then #13. */
  const OPENED = { 12: "2026-09-27T09:00:00Z", 13: "2026-09-27T10:00:00Z" } as const;

  /** The runner's wait, as a wake leaves a run it just picked up. */
  const RUNNER_WAIT = {
    waitingOn: "the next thing that happens on this ticket",
    kind: "runner" as const,
    resolvableBy: ["triage" as const],
  };

  /**
   * The world's run #12, parked, beside #11, whose step takes the project's
   * one place, and #13, which waits for a place behind #12.
   */
  function threeRuns(w: World): { first: Run; next: Run } {
    const first = w.store.activate(w.store.register(PROJECT.name, 11).run.id, "step-session-11");
    w.store.park(w.run.id, RUNNER_WAIT);
    const next = w.store.park(w.store.register(PROJECT.name, 13).run.id, RUNNER_WAIT);
    w.store.askPlace(next.id, { priority: false, openedAt: OPENED[13] });
    return { first, next };
  }

  /** The ids of the runs of the project that take a place now. */
  function holders(w: World): string[] {
    return w.store.placeHolders(PROJECT.name).map((run) => run.id);
  }

  /** The ids of the runs of the project that wait for a place, in order. */
  function waiting(w: World): string[] {
    return w.store.waitingForPlace(PROJECT.name).map((run) => run.id);
  }

  it("gives the place to the next waiting run when the wake of the run given it ends with no step started, and the run waits no more (R3 clause 4)", async () => {
    const w = world();
    const { first, next } = threeRuns(w);
    w.store.askPlace(w.run.id, { priority: false, openedAt: OPENED[12] });
    w.store.park(first.id, RUNNER_WAIT);
    expect(holders(w)).toEqual([w.run.id]);

    await wakeRunner(
      { runQuery: scriptedRunner([quiet()]).runQuery, actionsFor: w.actionDeps },
      w.store.get(w.run.id)!,
      ["A place on the project is free for this ticket now. A step you start will not be refused for want of one."],
    );

    expect(holders(w)).toEqual([next.id]);
    expect(waiting(w)).toEqual([]);
  });

  it("leaves a run waiting for its turn when its try to start a step in the wake was refused for want of a place", async () => {
    const w = world();
    const { next } = threeRuns(w);
    const runner = scriptedRunner([
      {
        kind: "calls",
        calls: [
          {
            name: "start_step",
            input: {
              stage: "triage",
              instructions: "Sort the request.",
              reason: "A new ticket starts with sorting.",
            },
          },
        ],
        costUsd: 0.1,
      },
    ]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.store.get(w.run.id)!,
      ["A new ticket was picked up. Nothing has been done on it yet."],
    );

    expect(runner.answers).toEqual([
      {
        content: [
          {
            type: "text",
            text: expect.stringMatching(/^Refused: No place is free on scratch-app: run scratch-app#11\/1 has a step running\./),
          },
        ],
        isError: true,
      },
    ]);
    expect(waiting(w)).toEqual([w.run.id, next.id]);
  });

  it("lets a run keep a place given to it after its try was refused in the same wake, so it is woken for it next (ADR-0063 D3)", async () => {
    const w = world();
    const { first, next } = threeRuns(w);
    const runner = scriptedRunner([
      {
        kind: "calls",
        calls: [
          {
            name: "start_step",
            input: {
              stage: "triage",
              instructions: "Sort the request.",
              reason: "A new ticket starts with sorting.",
            },
          },
        ],
        costUsd: 0.1,
        // #11's step ends while the session is still running, so the ledger
        // gives the place to #12, which comes first.
        afterCalls: () => w.store.park(first.id, RUNNER_WAIT),
      },
    ]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.store.get(w.run.id)!,
      ["A new ticket was picked up. Nothing has been done on it yet."],
    );

    expect(holders(w)).toEqual([w.run.id]);
    expect(w.store.get(w.run.id)?.place?.givenAt).toBeDefined();
    expect(waiting(w)).toEqual([next.id]);
  });

  it("gives the place to the next waiting run when the wake of the run given it fails", async () => {
    const w = world();
    const { first, next } = threeRuns(w);
    w.store.askPlace(w.run.id, { priority: false, openedAt: OPENED[12] });
    w.store.park(first.id, RUNNER_WAIT);
    expect(holders(w)).toEqual([w.run.id]);

    const end = await wakeRunner(
      {
        runQuery: scriptedRunner([{ kind: "throws", error: "API Error: Connection error." }]).runQuery,
        actionsFor: w.actionDeps,
      },
      w.store.get(w.run.id)!,
      ["A place on the project is free for this ticket now. A step you start will not be refused for want of one."],
    );

    expect(end.kind).toBe("failed");
    expect(holders(w)).toEqual([next.id]);
  });

  it("tells the runner in its brief who takes the project's place, or that it is given to this ticket", async () => {
    const w = world();
    const { first } = threeRuns(w);
    const runner = scriptedRunner([quiet(), quiet()]);
    const wake = () =>
      wakeRunner(
        { runQuery: runner.runQuery, actionsFor: w.actionDeps },
        w.store.get(w.run.id)!,
        ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
      );

    await wake();
    w.store.askPlace(w.run.id, { priority: false, openedAt: OPENED[12] });
    w.store.park(first.id, RUNNER_WAIT);
    await wake();

    const placeLine = (prompt: string) =>
      prompt.split("\n").find((line) => line.startsWith("- The project's place:"));
    expect(runner.started.map((session) => placeLine(session.prompt))).toEqual([
      "- The project's place: taken: scratch-app#11/1 has a step running.",
      "- The project's place: given to this ticket — a step you start now will not be refused.",
    ]);
  });

  it("tells the runner the place is free while one of the project's two places is taken (PRD-07.R2)", async () => {
    const w = world(2);
    w.store.activate(w.store.register(PROJECT.name, 11).run.id, "step-session-11");
    w.store.park(w.run.id, RUNNER_WAIT);
    const runner = scriptedRunner([quiet()]);

    await wakeRunner(
      { runQuery: runner.runQuery, actionsFor: w.actionDeps },
      w.store.get(w.run.id)!,
      ["fvermaut commented on the ticket at 2026-09-27T11:58:40Z."],
    );

    const placeLine = (prompt: string) =>
      prompt.split("\n").find((line) => line.startsWith("- The project's place:"));
    expect(runner.started.map((session) => placeLine(session.prompt))).toEqual([
      "- The project's place: free.",
    ]);
  });
});
