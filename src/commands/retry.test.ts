import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import {
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  type PullRequest,
  type PullRequestThread,
  type Ticket,
  type TicketingAdapter,
  type TicketThread,
} from "../adapters/ticketing.js";
import { RunStore } from "../daemon/runs.js";
import { acquireStateLock } from "../daemon/lock.js";
import { pollOnce, type SessionSpawner } from "../daemon/poll.js";
import { AgentSessionSpawner } from "../daemon/session.js";
import { runRetry } from "./retry.js";

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

function newStore(): RunStore {
  const dir = mkdtempSync(join(tmpdir(), "timone-retry-"));
  tempDirs.push(dir);
  let tick = 0;
  return RunStore.open(join(dir, ".timone", "state.json"), {
    now: () => `2026-08-06T10:${String(tick++).padStart(2, "0")}:00Z`,
  });
}

/** A run that failed mid-execution, branch and pull request in hand. */
function failedRun(store: RunStore): void {
  const { run } = store.register("scratch-app", 6);
  store.activate(run.id, "s1");
  store.claimBranch(run.id, "timone/6-fiddly-box");
  store.recordPullRequest(run.id, 9);
  store.setStage(run.id, "execution");
  store.fail(run.id, "the session died mid-slice");
}

function collect(): { log: (line: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (line) => lines.push(line), lines };
}

describe("timone retry", () => {
  it("re-arms a failed run at its stage, keeping everything it owned", () => {
    const store = newStore();
    failedRun(store);
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(0);
    const run = store.get("scratch-app#6/1");
    expect(run?.status).toBe("picked-up");
    expect(run?.stage).toBe("execution");
    expect(run?.branch).toBe("timone/6-fiddly-box");
    expect(run?.pr).toBe(9);
    expect(run?.failure).toBeUndefined();
    expect(lines.join("\n")).toMatch(/picks it up|next cycle/i);
  });

  it("refuses a run that is not failed, saying what it is doing", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.claimBranch(run.id, "timone/6-fiddly-box");
    store.park(run.id, {
      waitingOn: "your approval of the plan",
      kind: "gate",
      stage: "planning",
    });
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6/1")?.status).toBe("parked");
    expect(lines.join("\n")).toMatch(/your approval of the plan/);
  });

  it("refuses a finished run rather than resurrecting it", () => {
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.complete(run.id);
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/finished/i);
  });

  it("refuses when the project has moved on to another ticket", () => {
    const store = newStore();
    failedRun(store);
    // The failure freed the project; another ticket has since claimed it.
    const { run: next } = store.register("scratch-app", 8);
    store.activate(next.id, "s2");
    store.claimBranch(next.id, "timone/8-other-work");
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6/1")?.status).toBe("failed");
    expect(lines.join("\n")).toMatch(/#8|another/i);
  });

  it("refuses an untracked ticket and an unknown project with guidance", () => {
    const store = newStore();
    const { log, lines } = collect();

    expect(runRetry("scratch-app#99", { manifest, store, log })).toBe(1);
    expect(runRetry("nope#1", { manifest, store, log })).toBe(1);
    expect(lines.join("\n")).toMatch(/timone.*label|not working on/i);
    expect(lines.join("\n")).toContain("scratch-app");
  });

  it("re-arms nothing while a daemon holds the ledger, and says who has it", () => {
    // ADR-0023: retry rewinds a run and hands it back to the loop, so it
    // writes the ledger — and two writers of one field is the race.
    const dir = mkdtempSync(join(tmpdir(), "timone-retry-lock-"));
    tempDirs.push(dir);
    const statePath = join(dir, ".timone", "state.json");
    const store = RunStore.open(statePath, { now: () => "2026-08-06T10:00:00Z" });
    failedRun(store);
    acquireStateLock({
      statePath,
      command: "timone daemon",
      pid: 4213,
      staleAfterMs: 2 * 60 * 1000,
    });
    const { log, lines } = collect();

    const code = runRetry("scratch-app#6", { manifest, store, statePath, log });

    expect(code).toBe(1);
    expect(store.get("scratch-app#6/1")?.status).toBe("failed");
    expect(lines.join("\n")).toContain("timone daemon");
    expect(lines.join("\n")).toContain("4213");
  });

  it("refuses a malformed target with the shape it wanted", () => {
    const { log, lines } = collect();

    const code = runRetry("scratch-app", { manifest, store: newStore(), log });

    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/<project>#<ticket>/);
  });
});

describe("timone retry — the answer a killed session had already read", () => {
  // The live gate of 2026-08-13 on `scratch-app` #26. The daemon consumed the
  // answer, spawned the session, and the session was killed — leaving the run
  // `failed` with no cursor at all, because activating it cleared the wait.
  // `retry` then had nothing to rewind, fell through to the entry path, and
  // re-posted the original invitation verbatim: the human's words discarded and
  // the same question asked again. ADR-0023 undertook that `retry` rewinds the
  // marker, and this is that undertaking on the path the gate actually took.
  const answer = {
    author: "fvermaut",
    body: "it's the draft they lose, not the phone layout",
    createdAt: "2026-08-06T09:30:00Z",
    fromTimone: false,
  };

  /** Whether a comment is the invitation — the thing that must be posted once. */
  function isInvitation(body: string): boolean {
    return /two ways to answer/i.test(body);
  }

  /**
   * The decision ticket the conversation happens on, with a thread that really
   * grows: what the machine posts lands on it, after everything already there.
   * So the invitation the daemon posts is on the thread the next cycle reads,
   * and every comment it posts across the whole sequence is countable.
   */
  function conversationTicket(): {
    adapter: TicketingAdapter;
    thread: TicketThread["comments"];
    posted: string[];
  } {
    const base: Ticket = {
      number: 26,
      title: "which half do they lose?",
      body: "a decision ticket off the map",
      labels: ["timone", "wayfinder:grilling"],
      url: "https://github.com/fvermaut/scratch-app/issues/26",
      author: "fvermaut",
      createdAt: "2026-08-06T08:00:00Z",
    };
    const thread: TicketThread["comments"] = [];
    const posted: string[] = [];
    const adapter: TicketingAdapter = {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [...thread] };
      },
      async postComment(_project, _number, body): Promise<void> {
        posted.push(body);
        const last = thread.at(-1)?.createdAt ?? base.createdAt;
        thread.push({
          author: "fvermaut",
          body: `${MACHINE_MARKER}\n\n---\n\n${body}`,
          createdAt: new Date(Date.parse(last) + 60_000).toISOString(),
          fromTimone: true,
        });
      },
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
    return { adapter, thread, posted };
  }

  /**
   * The real spawner over a runtime the test kills once.
   *
   * Real, because "the answer reaches a session rather than a fresh
   * invitation" is a claim about the poll loop, the stage graph and the spawner
   * together — and because the invitation being counted is the one the spawner
   * itself posts. The kill is the runtime reporting the signal the live gate
   * sent, which is what walks the ledger through `active` and then `failed`.
   */
  function spawnerDyingOnce(
    store: RunStore,
    adapter: TicketingAdapter,
    prompts: string[],
  ): SessionSpawner {
    let killed = false;
    return new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: {
        async start(request) {
          prompts.push(request.prompt);
          if (killed) {
            return {
              sessionId: "session-after-retry",
              completed: Promise.resolve({
                sessionId: "session-after-retry",
                ok: true,
              }),
            };
          }
          killed = true;
          return {
            sessionId: "session-killed",
            completed: Promise.resolve({
              sessionId: "session-killed",
              ok: false,
              error: "Claude Code process terminated by signal SIGKILL",
            }),
          };
        },
      },
      root: "/nowhere",
    });
  }

  it("hands back an answer whose session died active, not a fresh invitation", async () => {
    const store = newStore();
    const { adapter, thread, posted } = conversationTicket();
    const prompts: string[] = [];
    const deps = {
      manifest,
      store,
      adapter,
      spawner: spawnerDyingOnce(store, adapter, prompts),
    };
    const { log } = collect();

    // The map's ticket is picked up and the human invited.
    await pollOnce(deps);
    // They answer in writing. The next cycle consumes it, spawns — and that
    // session is killed.
    thread.push(answer);
    const read = await pollOnce(deps);
    const dead = store.get("scratch-app#26/1");

    const code = runRetry("scratch-app#26", { manifest, store, log });
    const rearmed = store.get("scratch-app#26/1");
    const again = await pollOnce(deps);

    expect(read.resumed).toEqual(["scratch-app#26/1"]);
    // What the fault rested on: the run was activated, which clears the wait,
    // so the failed run has nothing left pointing at the answer it read.
    expect(dead?.status).toBe("failed");
    expect(dead?.waitCursor).toBeUndefined();
    // And it is handed back anyway — to before the answer, not to now.
    expect(code).toBe(0);
    expect(rearmed?.status).toBe("parked");
    expect(rearmed?.waitingKind).toBe("conversation");
    expect(Date.parse(rearmed?.waitCursor ?? "")).toBeLessThan(
      Date.parse(answer.createdAt),
    );
    // So the next cycle resumes on their words, in a second session.
    expect(again.resumed).toEqual(["scratch-app#26/1"]);
    expect(prompts).toHaveLength(2);
    expect(prompts.at(-1)).toContain("it's the draft they lose");
    // And the question was asked once, across the whole sequence.
    expect(posted.filter(isInvitation)).toHaveLength(1);
  });

  it("asks the question once, counting what lands on the thread", async () => {
    // The symptom the gate caught was not a cursor: it was the original
    // invitation posted a second time, verbatim, under the answer it ignored.
    // So this counts invitations on the thread rather than reading the ledger —
    // a cursor assertion would pass with the re-ask still happening.
    const store = newStore();
    const { adapter, thread, posted } = conversationTicket();
    const prompts: string[] = [];
    const deps = {
      manifest,
      store,
      adapter,
      spawner: spawnerDyingOnce(store, adapter, prompts),
    };
    const { log } = collect();

    await pollOnce(deps);
    thread.push(answer);
    await pollOnce(deps);
    const askedBeforeRetry = posted.filter(isInvitation).length;

    runRetry("scratch-app#26", { manifest, store, log });
    await pollOnce(deps);
    await pollOnce(deps);

    // One invitation, and the recovery adds none — not on the cycle that
    // resumes, and not on the one after it either.
    expect(askedBeforeRetry).toBe(1);
    expect(posted.filter(isInvitation)).toHaveLength(1);
    // Their answer is still there, word for word: only the marker ever moved.
    expect(thread.filter((comment) => comment.createdAt === answer.createdAt)).toEqual([
      answer,
    ]);
  });

  it("still rewinds a park consumed before the marker existed", async () => {
    // 19c's route back, unchanged and not traded away for the one above. A
    // ledger written by the previous build has the cursor sitting on the answer
    // and no marker at all — which is also every run already parked when this
    // build lands. The cursor is what it has, so the cursor is what it uses.
    const store = newStore();
    const { adapter, thread } = conversationTicket();
    thread.push(answer);
    const { run } = store.register("scratch-app", 26);
    store.activate(run.id, "session-1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "wayfinding",
      // Consumed by the previous build: the cursor moved, nothing recorded it.
      waitCursor: answer.createdAt,
    });
    const legacy = store.get("scratch-app#26/1");
    const prompts: string[] = [];
    const deps = {
      manifest,
      store,
      adapter,
      spawner: spawnerDyingOnce(store, adapter, prompts),
    };
    const { log } = collect();

    const stalled = await pollOnce(deps);
    const code = runRetry("scratch-app#26", { manifest, store, log });
    const again = await pollOnce(deps);

    // The ledger it works from has nothing but the cursor.
    expect(legacy?.consumedAnswerAt).toBeUndefined();
    expect(stalled.resumed).toEqual([]);
    expect(code).toBe(0);
    expect(again.resumed).toEqual(["scratch-app#26/1"]);
    expect(prompts.at(-1)).toContain("it's the draft they lose");
  });

  it("leaves a resolved run nothing a later retry could reopen", async () => {
    // The other end of the window: the session did settle it. The answer has
    // been acted on, the run is done, and the marker is gone with it — so no
    // later retry can reach back past a decision and read that answer again.
    const store = newStore();
    const { adapter, thread, posted } = conversationTicket();
    const prompts: string[] = [];
    const project = {
      name: "scratch-app",
      repoUrl: "https://github.com/fvermaut/scratch-app.git",
    };
    const settling = new AgentSessionSpawner({
      manifest,
      store,
      adapter,
      runtime: {
        async start(request) {
          prompts.push(request.prompt);
          return {
            sessionId: "session-settled",
            completed: (async () => {
              await adapter.postComment(
                project,
                26,
                `${CONVERSATION_RECORD_MARKER}\n\nAgreed: it's the draft.`,
              );
              return { sessionId: "session-settled", ok: true };
            })(),
          };
        },
      },
      root: "/nowhere",
    });
    const deps = { manifest, store, adapter, spawner: settling };
    const { log, lines } = collect();

    await pollOnce(deps);
    thread.push(answer);
    await pollOnce(deps);

    const settled = store.get("scratch-app#26/1");
    const code = runRetry("scratch-app#26", { manifest, store, log });

    expect(settled?.status).toBe("done");
    expect(settled?.consumedAnswerAt).toBeUndefined();
    // And retry refuses it as the finished run it is, changing nothing.
    expect(code).toBe(1);
    expect(lines.join("\n")).toMatch(/finished/i);
    expect(store.get("scratch-app#26/1")?.status).toBe("done");
    expect(posted.filter(isInvitation)).toHaveLength(1);
  });
});

describe("timone retry — the way back from a consumed answer", () => {
  const invitation = {
    author: "fvermaut",
    body: `${MACHINE_MARKER}\n\ntwo ways to answer this`,
    createdAt: "2026-08-06T09:00:00Z",
    fromTimone: true,
  };
  const answer = {
    author: "fvermaut",
    body: "it's the draft they lose, not the phone layout",
    createdAt: "2026-08-06T09:30:00Z",
    fromTimone: false,
  };

  /** The ticket the conversation is happening on, and nothing else. */
  function conversationAdapter(): TicketingAdapter {
    const base: Ticket = {
      number: 6,
      title: "the page feels slow",
      body: "when I add many items the page feels slow",
      labels: ["timone", "triage:feature"],
      url: "https://github.com/fvermaut/scratch-app/issues/6",
      author: "fvermaut",
      createdAt: "2026-08-06T08:00:00Z",
    };
    return {
      async listMarkedTickets(): Promise<Ticket[]> {
        return [base];
      },
      async getTicket(): Promise<TicketThread> {
        return { ...base, comments: [invitation, answer] };
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

  it("makes an answer the daemon consumed readable again", async () => {
    // ADR-0023 trades a silent double-answer for a visible stall: the cursor
    // moves as the answer is read, so a session that dies holding it leaves a
    // ticket that looks answered with nothing working on it. This is the way
    // out, and it is proven by running the loop rather than by writing the
    // cursor the test wants to see.
    const store = newStore();
    const { run } = store.register("scratch-app", 6);
    store.activate(run.id, "s1");
    store.park(run.id, {
      waitingOn: "a conversation in your terminal",
      kind: "conversation",
      stage: "clarification",
      waitCursor: invitation.createdAt,
    });

    const contexts: { feedback?: string }[] = [];
    const spawner: SessionSpawner = {
      async spawn(_run, _project, context) {
        contexts.push(context ?? {});
      },
    };
    const deps = { manifest, store, adapter: conversationAdapter(), spawner };
    const { log } = collect();

    const read = await pollOnce(deps);
    const stalled = await pollOnce(deps);
    const code = runRetry("scratch-app#6", { manifest, store, log });
    const again = await pollOnce(deps);

    expect(read.resumed).toEqual(["scratch-app#6/1"]);
    // Consumed: the same thread now holds nothing outstanding.
    expect(stalled.resumed).toEqual([]);
    // And the rewind hands it back, with the human's own words.
    expect(code).toBe(0);
    expect(again.resumed).toEqual(["scratch-app#6/1"]);
    expect(contexts.at(-1)?.feedback).toBe(answer.body);
  });
});
