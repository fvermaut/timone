import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TicketingAdapter } from "../adapters/ticketing.js";
import type { Manifest } from "../manifest.js";
import { RunStore } from "../daemon/runs.js";
import { RunningSteps, runnerActions, type RunnerActions } from "./actions.js";
import { RUNNER_TOOL_NAMES, runnerTools } from "./tools.js";

/** Temp dirs created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PROJECT = { name: "scratch-app", repoUrl: "https://github.com/fvermaut/scratch-app.git" };

const MANIFEST: Manifest = {
  operator: "fvermaut",
  projects: {
    "scratch-app": {
      repo_url: PROJECT.repoUrl,
      path: "projects/scratch-app",
      stack: ["typescript"],
      bindings: { ticketing: "github" },
      driver: "runner",
    },
  },
};

/**
 * The runner's real actions on a fresh ticket, with nothing running. The
 * forge and the step starter are never reached by the calls these tests
 * make, so each one throws if it is.
 */
function actionsOnAFreshTicket(): RunnerActions {
  const root = mkdtempSync(join(tmpdir(), "timone-tools-"));
  tempDirs.push(root);
  const store = RunStore.open(join(root, ".timone", "state.json"));
  const { run } = store.register(PROJECT.name, 12);
  const unreachable = new Proxy(
    {},
    {
      get(_target, name) {
        return () => {
          throw new Error(`no test here calls the forge's ${String(name)}`);
        };
      },
    },
  ) as TicketingAdapter;
  return runnerActions(
    {
      store,
      adapter: unreachable,
      manifest: MANIFEST,
      root,
      timonePin: async () => undefined,
      project: PROJECT,
      ticketContext: { isStep: false, isRemediation: false },
      startStep: () => {
        throw new Error("no test here starts a step");
      },
      running: new RunningSteps(),
      stepEnded: async () => {},
      clock: () => "2026-09-27T12:00:00.000Z",
      log: () => {},
    },
    run,
  );
}

describe("the tools the runner is given", () => {
  it("offers exactly the nine actions of R2, and none that edits, writes, runs a shell, pushes or merges", () => {
    const r2 = [
      "start_step",
      "message_step",
      "stop_step",
      "post",
      "set_hold",
      "record_approval",
      "file_timone_issue",
      "comment_timone_issue",
      "end_run",
    ];

    expect(RUNNER_TOOL_NAMES).toEqual(r2);
    expect(runnerTools(actionsOnAFreshTicket()).map((tool) => tool.name)).toEqual(r2);
    for (const name of RUNNER_TOOL_NAMES) {
      expect(name).not.toMatch(/edit|write|shell|bash|push|merge/i);
    }
  });

  it("hands a refused action back to the runner as an error, saying it was refused", async () => {
    const messageStep = runnerTools(actionsOnAFreshTicket()).find(
      (tool) => tool.name === "message_step",
    );

    const answer = await messageStep!.handler(
      { text: "Run only the unit tests.", reason: "The step keeps running the browser suite." },
      {},
    );

    expect(answer.isError).toBe(true);
    expect(answer.content[0]).toMatchObject({ type: "text", text: expect.stringMatching(/^Refused: /) });
  });
});
