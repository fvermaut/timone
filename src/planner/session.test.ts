import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketingProject, TicketThread } from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { RunStore, type Run } from "../daemon/runs.js";
import type { RunQuery } from "../runner/session.js";
import { readRecord, type RecordEntry } from "../runner/record.js";
import type { PlannerFacts } from "./facts.js";
import { PlannerSessions } from "./session.js";

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

/** scratch-app, instructed by the operator only. */
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

const NOW = "2026-10-05T10:00:00Z";

/** A marked ticket of scratch-app, with no comments. */
function thread(number: number): TicketThread {
  return {
    number,
    title: `Ticket ${number}`,
    body: "",
    labels: ["timone", "triage:feature"],
    url: `https://github.com/fvermaut/scratch-app/issues/${number}`,
    author: "fvermaut",
    createdAt: "2026-10-01T09:00:00Z",
    comments: [],
  };
}

/** The facts for deciding `ticket`: no plan yet, nothing else building, no comment. */
function factsFor(ticket: number): PlannerFacts {
  return {
    project: PROJECT.name,
    ticket: { number: ticket, title: `Ticket ${ticket}`, labels: ["timone"], plan: { kind: "known", value: undefined } },
    blockers: [],
    others: [],
    comment: undefined,
  };
}

/**
 * A stand-in for the SDK's `query`: each session it is started for makes no
 * tool call, waits for `until` when one is given, and ends with a success
 * that cost `costUsd`. What each was started with is kept.
 */
function quietPlanner(costUsd: number, until?: Promise<void>) {
  const started: { prompt: string; options: Options }[] = [];
  const runQuery: RunQuery = async function* (params) {
    started.push(params);
    if (until !== undefined) await until;
    yield { type: "result", subtype: "success", is_error: false, total_cost_usd: costUsd, num_turns: 1, result: "Done." };
  };
  return { runQuery, started };
}

/** A ledger with runs of `tickets`, each waiting for the planner, and the planner's sessions over it. */
function world(runQuery: RunQuery, tickets: readonly number[] = [12]) {
  const root = mkdtempSync(join(tmpdir(), "planner-session-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"), { now: () => NOW });
  const runs: Run[] = tickets.map((ticket) => {
    const { run } = store.register(PROJECT.name, ticket);
    return store.askPlanner(run.id, { priority: false, openedAt: "2026-10-01T09:00:00Z" });
  });
  const sessions = new PlannerSessions({
    runQuery,
    store,
    adapter: {
      getTicket: async (_project, number) => thread(number),
      postComment: async () => {},
    },
    manifest: MANIFEST,
    root,
    clock: () => NOW,
    log: () => {},
  });
  const recordOf = (ticket: number): RecordEntry[] => {
    const read = readRecord(root, PROJECT.name, ticket);
    if (!read.ok) throw new Error(read.error.message);
    return read.value;
  };
  return { root, store, runs, sessions, recordOf };
}

describe("PlannerSessions — one session per project at a time (ADR-0065 D1)", () => {
  it("starts no second session for the project while one runs, and the first still ends", async () => {
    let release: () => void = () => {};
    const planner = quietPlanner(0.1, new Promise<void>((resolve) => (release = resolve)));
    const w = world(planner.runQuery, [12, 13]);

    const first = w.sessions.decide(w.runs[0]!, factsFor(12));
    await w.sessions.decide(w.runs[1]!, factsFor(13));
    expect(planner.started).toHaveLength(1);

    release();
    await first;

    expect(planner.started).toHaveLength(1);
    expect(w.recordOf(12).map((entry) => entry.kind)).toEqual(["planner-ended"]);
    expect(w.recordOf(13)).toEqual([]);
  });
});

describe("PlannerSessions — what a session costs (ADR-0065 D1)", () => {
  it("writes the $0.30 of a session that decided nothing into the ticket's record, leaves the run waiting, and starts again when asked again", async () => {
    const planner = quietPlanner(0.3);
    const w = world(planner.runQuery);
    const [run] = w.runs;

    await w.sessions.decide(run!, factsFor(12));

    expect(w.recordOf(12)).toEqual([
      { kind: "planner-ended", at: NOW, runId: run!.id, ok: true, costUsd: 0.3 },
    ]);
    expect(w.store.waitingForPlanner(PROJECT.name).map((one) => one.id)).toEqual([run!.id]);

    await w.sessions.decide(run!, factsFor(12));

    expect(planner.started).toHaveLength(2);
  });
});

describe("PlannerSessions — a model that cannot be reached", () => {
  it("is tried again after 60 seconds and then 5 minutes, each try's cost written, and the run left waiting after the third", async () => {
    vi.useFakeTimers();
    const started: unknown[] = [];
    const unreachable: RunQuery = async function* (params) {
      started.push(params);
      throw new Error("API Error: Connection error.");
    };
    const w = world(unreachable);
    const [run] = w.runs;

    const deciding = w.sessions.decide(run!, factsFor(12));
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(started).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(started).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(started).toHaveLength(3);
    await deciding;

    const ended = {
      kind: "planner-ended",
      at: NOW,
      runId: run!.id,
      ok: false,
      costUsd: 0,
      error: "API Error: Connection error.",
    };
    expect(w.recordOf(12)).toEqual([ended, ended, ended]);
    expect(w.store.waitingForPlanner(PROJECT.name).map((one) => one.id)).toEqual([run!.id]);
  });
});

describe("PlannerSessions — what a session is started with (ADR-0065 D3)", () => {
  it("gives the planner no built-in tool, only its four tools, 12 turns and $2, and the brief for the ticket", async () => {
    const planner = quietPlanner(0.1);
    const w = world(planner.runQuery);

    await w.sessions.decide(w.runs[0]!, factsFor(12));

    const [session] = planner.started;
    expect(session?.options).toMatchObject({
      model: "claude-opus-5-5",
      tools: [],
      allowedTools: [
        "mcp__planner__let_build",
        "mcp__planner__hold",
        "mcp__planner__pass_to_runner",
        "mcp__planner__read_plan",
      ],
      settingSources: [],
      maxTurns: 12,
      maxBudgetUsd: 2,
    });
    expect(Object.keys(session?.options.mcpServers ?? {})).toEqual(["planner"]);
    expect(session?.prompt).toContain("#12");
  });
});
