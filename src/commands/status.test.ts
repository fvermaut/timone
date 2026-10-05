import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import {
  breakdownPath, fromWorkingTree,
  type SyncBreakdownSource,
} from "../daemon/breakdown.js";

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
): { root: string; breakdownSource: SyncBreakdownSource } {
  // `join(root, "projects", project)` is what `checkoutOf` used to supply on
  // the caller's behalf. It is spelled here because the production default no
  // longer resolves a directory at all: it reads the forge.
  return {
    root,
    breakdownSource: fromWorkingTree(join(root, "projects", project)),
  };
}

import type { Holder } from "../daemon/holder.js";
import { stageLabel } from "../daemon/pipeline.js";
import {
  RunStore,
  type DaemonRecord,
  type InitiativeRecord, runId, type Run } from "../daemon/runs.js";
import { renderStatus } from "./status.js";

/** Temp roots created by the current test, removed in afterEach. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A workspace root holding `scratch-app`'s checkout with `body` as ticket
 * `ticket`'s breakdown — or no breakdown at all when `body` is absent, which
 * is what nearly every ticket in the live ledger looks like.
 */
function rootWith(ticket: number, body?: string): string {
  const root = mkdtempSync(join(tmpdir(), "timone-status-"));
  tempDirs.push(root);
  if (body !== undefined) {
    const file = join(root, "projects", "scratch-app", breakdownPath(ticket));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body, "utf8");
  }
  return root;
}

/**
 * The artifact as a stage session writes it, spelled out rather than rendered
 * — `poll.test.ts` spells it out for the same reason: a fixture built by the
 * module under test could not catch the writer and the reader drifting apart.
 */
function breakdown(titles: string[], pieces = titles.length): string {
  return [
    "# Breakdown",
    "",
    `**Status:** Approved by fvermaut 2026-08-15 — ${pieces} pieces`,
    "",
    ...titles.map(
      (title, index) => `${index + 1}. **${title}** — what this piece delivers.`,
    ),
    "",
  ].join("\n");
}

const manifest: Manifest = {
  projects: {
    "scratch-app": {
      repo_url: "https://github.com/fvermaut/scratch-app.git",
      path: "projects/scratch-app",
      stack: [],
      bindings: { ticketing: "github" },
    },
    "other-app": {
      repo_url: "https://github.com/fvermaut/other-app.git",
      path: "projects/other-app",
      stack: [],
      bindings: { ticketing: "github" },
    },
  },
};

function run(overrides: Partial<Run> & Pick<Run, "project" | "ticket">): Run {
  return {
    id: runId(overrides.project, overrides.ticket, 1),
    seq: 1,
    status: "active",
    flags: [],
    createdAt: "2026-08-02T10:00:00Z",
    updatedAt: "2026-08-02T10:01:00Z",
    ...overrides,
  };
}

/** The line of `output` describing `project`. */
function lineFor(output: string, project: string): string {
  return (
    output.split("\n").find((line) => line.startsWith(project)) ??
    `<no line for ${project}>`
  );
}

describe("renderStatus", () => {
  it("says a project is idle when nothing is running on it", () => {
    const output = renderStatus(manifest, [], { stateExists: true });
    expect(lineFor(output, "scratch-app")).toMatch(/idle/i);
    expect(lineFor(output, "other-app")).toMatch(/idle/i);
  });

  it("shows the active ticket and the step it reached, in words a person has", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "triage" }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/#7/);
    // It said "triage" until 2026-08-19. Eight of thirteen steps had no plain
    // name and fell back on their own spelling, which is the process talking
    // to itself on the one surface written for someone who knows none of it
    // (R9). Now every step has one, because a session has to be able to name
    // a step back to the machinery (ADR-0035 D3) and a partial map cannot.
    expect(line).toContain(stageLabel("triage"));
    expect(line).not.toMatch(/triage/);
  });

  it("shows every waiting ticket, not just the first", () => {
    // Several tickets can now wait at once: a run that holds no work branch
    // holds no project either. A status line that showed one of them would
    // hide the rest of what the reader is being asked for.
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "clarification",
        wait: { on: "an answer about how it should behave", kind: "runner" },
      }),
      run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        stage: "clarification",
        wait: { on: "an answer about the wording", kind: "runner" },
      }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/#6/);
    expect(line).toMatch(/#7/);
    expect(line).toMatch(/an answer about how it should behave/);
    expect(line).toMatch(/an answer about the wording/);
  });

  it("shows the running ticket alongside the ones that are waiting", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        wait: { on: "an answer", kind: "runner" },
      }),
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "requirements" }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/#7.*working on it now/);
    expect(line).toMatch(/#6.*waiting: an answer/);
  });

  it("names every waiting ticket in the closing line", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        wait: { on: "an answer", kind: "runner" },
      }),
      run({
        project: "other-app",
        ticket: 2,
        status: "parked",
        wait: { on: "approval", kind: "runner" },
      }),
    ];
    const lastLine =
      renderStatus(manifest, runs, { stateExists: true }).trimEnd().split("\n").at(-1) ?? "";

    expect(lastLine).toMatch(/scratch-app #6/);
    expect(lastLine).toMatch(/other-app #2/);
  });

  it("names the tickets picked up beside the active one, and no queue", () => {
    // ✏ 2026-10-04: nothing is queued any more (ADR-0063 D2). A ticket picked
    // up while another ticket's step runs is picked up too.
    const runs = [
      run({ project: "scratch-app", ticket: 7, status: "active" }),
      run({ project: "scratch-app", ticket: 8, status: "picked-up" }),
      run({ project: "scratch-app", ticket: 9, status: "picked-up" }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/#8/);
    expect(line).toMatch(/#9/);
    expect(line).not.toMatch(/queued/);
  });

  it("marks a run whose automatic checks failed", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        wait: { on: "the next stage", kind: "runner" },
        flags: ["unpushed commits on phase/01"],
      }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/check/i);
    expect(line).toMatch(/1/);
  });

  it("ignores finished runs when deciding what a project is doing", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 6, status: "done" }),
      run({ project: "scratch-app", ticket: 5, status: "cancelled" }),
    ];
    expect(lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app")).toMatch(
      /idle/i,
    );
  });

  it("says a cancelled chunk was stopped, without calling it a failure", () => {
    // Typing `timone cancel` must change something the human can see, and
    // what they see must carry the difference the ledger records: abandoned
    // rather than broken.
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "cancelled",
        cancellation: "its ticket is no longer open and marked for me",
      }),
    ];
    const output = renderStatus(manifest, runs, { stateExists: true });

    expect(output).toContain(
      "scratch-app #6 was cancelled: its ticket is no longer open and marked for me",
    );
    expect(lineFor(output, "scratch-app")).toMatch(/idle/i);
    expect(output).toMatch(/nothing is waiting on you/i);
  });

  it("guides rather than crashes when the daemon has never run", () => {
    const output = renderStatus(manifest, [], { stateExists: false });
    expect(output).toMatch(/timone daemon/);
    expect(lineFor(output, "scratch-app")).toMatch(/idle/i);
  });

  it("lists a project that has runs but is unknown to the manifest", () => {
    const runs = [run({ project: "ghost-app", ticket: 1, status: "active" })];
    const output = renderStatus(manifest, runs, { stateExists: true });
    expect(output).toMatch(/ghost-app/);
  });

  it("ends with a line saying what is being asked of the reader", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        wait: { on: "approval on the ticket", kind: "runner" },
      }),
    ];
    const output = renderStatus(manifest, runs, { stateExists: true });
    const lastLine = output.trimEnd().split("\n").at(-1) ?? "";
    expect(lastLine).toMatch(/What I need from you:/);
  });
});

describe("renderStatus — the back half of the pipeline", () => {
  it("describes the building and checking stages in plain words", () => {
    const output = renderStatus(
      manifest,
      [
        run({ project: "scratch-app", ticket: 6, status: "active", stage: "execution" }),
        run({ project: "other-app", ticket: 2, status: "active", stage: "verification" }),
      ],
      { stateExists: true },
    );

    expect(lineFor(output, "scratch-app")).toMatch(/building/);
    expect(lineFor(output, "other-app")).toMatch(/checking the result/);
    expect(output).not.toMatch(/execution|verification/);
  });

  it("says what a run at the breakdown stage is doing, in words", () => {
    // `STAGE_LABELS` is a `Partial` record and an unlabelled stage falls back
    // to its own name, so nothing fails without a row here — it just prints
    // "breakdown", which to the reader this command is written for reads as
    // something having broken rather than as work in progress.
    const output = renderStatus(
      manifest,
      [run({ project: "scratch-app", ticket: 6, status: "active", stage: "breakdown" })],
      { stateExists: true },
    );

    expect(lineFor(output, "scratch-app")).toMatch(/working out the pieces/);
    expect(output).not.toMatch(/\bbreakdown\b/);
  });

});

describe("renderStatus — a run whose daemon died under it", () => {
  it("frees the project, so the line reads idle rather than busy", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "cancelled",
          cancellation: "the machine running it stopped before the work was finished",
        }),
      ],
      { stateExists: true },
    );

    expect(lineFor(output, "scratch-app")).toContain("idle");
  });
});

describe("renderStatus — what the terminal can ask without a daemon", () => {
  /** A holder as the spawner records one. */
  function holderOf(pid: number): Holder {
    return {
      token: `token-${pid}`,
      command: "timone daemon scratch-app#7/1",
      pid,
      since: "2026-09-04T10:00:00Z",
      observedAt: "2026-09-04T10:00:00Z",
      host: "fvermaut-mac",
    };
  }

  it("does not call a run working when the process running it is gone", () => {
    // timone#11. With nothing watching, a killed session read "working on it
    // now" for ever, because the only evidence anything had was a clock and
    // the clock needs a daemon to be running to mean anything. A pid needs no
    // witness, so the terminal can ask this one on its own.
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "active",
          stage: "execution",
          holder: holderOf(4213),
        }),
      ],
      { stateExists: true, livenessOf: () => "gone" },
    );

    expect(output).not.toContain("working on it now");
    expect(output).toContain("nobody is running this");
  });

  it("keeps today's words for a run that records no holder", () => {
    // Every run written before ADR-0049. Guessing about them is worse than
    // saying what has always been said.
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "active",
          stage: "execution",
        }),
      ],
      { stateExists: true, livenessOf: () => "gone" },
    );

    expect(output).toContain("working on it now");
  });
});

describe("renderStatus — what a run is costing right now", () => {
  it("names the model and how long it has been at it", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "active",
          stage: "execution",
          updatedAt: "2026-08-06T10:00:00Z",
        }),
      ],
      { stateExists: true, now: new Date("2026-08-06T10:12:04Z") },
    );

    // The same phrasing the daemon's own progress line uses, so the two agree
    // rather than being two dialects for one fact.
    expect(lineFor(output, "scratch-app")).toContain("claude-opus-5-5");
    expect(lineFor(output, "scratch-app")).toContain("for 12m04s");
  });

  it("still speaks plainly — no stage numbers, no jargon", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "active",
          stage: "execution",
          updatedAt: "2026-08-06T10:00:00Z",
        }),
      ],
      { stateExists: true, now: new Date("2026-08-06T10:00:30Z") },
    );

    expect(lineFor(output, "scratch-app")).toContain("building");
    expect(lineFor(output, "scratch-app")).not.toMatch(
      /stage 6|heartbeat|marker|session id/i,
    );
  });

  it("says nothing about a model for a run that is waiting, not working", () => {
    // "What is this costing me" is not a question about a parked run.
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "parked",
          stage: "planning",
          wait: { on: "your answer on the ticket", kind: "runner" },
        }),
      ],
      { stateExists: true, now: new Date("2026-08-06T10:00:30Z") },
    );

    expect(lineFor(output, "scratch-app")).not.toContain("claude-");
  });

  it("omits the elapsed time rather than guessing when nobody said what now is", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "active",
          stage: "execution",
        }),
      ],
      { stateExists: true },
    );

    expect(lineFor(output, "scratch-app")).toContain("claude-opus-5-5");
    expect(lineFor(output, "scratch-app")).not.toContain(" for ");
  });
});

describe("renderStatus — who the closing line names", () => {
  it("names a ticket once in its closing line however many pieces it has had", () => {
    // A re-proposed initiative is the first state in which a *done* run is
    // waiting on the human, and a ticket built in three pieces holds three of
    // them. Naming the ticket once per finished piece would make the one line
    // the reader is meant to act on read "scratch-app #6, scratch-app #6".
    const root = rootWith(
      6,
      breakdown(["one", "two", "three", "four"], 2),
    );
    const runs = [
      run({ project: "scratch-app", ticket: 6, status: "done", stage: "delivery", pr: 9 }),
      run({ project: "scratch-app", ticket: 6, status: "done", stage: "delivery", pr: 12 }),
    ];

    const lastLine =
      renderStatus(manifest, runs, { stateExists: true, ...breakdownIn(root) })
        .trimEnd()
        .split("\n")
        .at(-1) ?? "";

    expect(lastLine).toBe(
      "**What I need from you:** answer on scratch-app #6 — each ticket says what it needs.",
    );
  });

  it("names in its closing line exactly the tickets that are waiting on the reader", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "planning",
        wait: { kind: "runner", on: "your answer on the ticket" },
      }),
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "execution" }),
      run({
        project: "other-app",
        ticket: 2,
        status: "cancelled",
        stage: "planning",
        cancellation: "the model was unavailable",
      }),
    ];

    const lastLine =
      renderStatus(manifest, runs, { stateExists: true }).trimEnd().split("\n").at(-1) ?? "";

    // Hand-written from the line `timone status` prints today: the working
    // ticket and the broken one are not waiting on an answer, and only the
    // parked one is named.
    expect(lastLine).toBe(
      "**What I need from you:** answer on scratch-app #6 — each ticket says what it needs.",
    );
  });
});

/**
 * 29f — which step is live, and how many are left.
 *
 * Nothing has ever *displayed* the step the daemon thinks is next. That is
 * the one thing [timone#41](https://github.com/fvermaut/timone/issues/41) was
 * right about even though its defect was not real: the only way to see the
 * pointer was to run the function by hand, so a wrong one would stay
 * invisible after this whole phase.
 *
 * **The render stays synchronous and holds no adapter.** Everything below
 * comes off the ledger — the run's own ticket *is* the live step, and the
 * picture beside it was written by the daemon's last cycle (ADR-0044 D5).
 */
describe("which step of an initiative is live", () => {
  const picture = (
    overrides: Partial<InitiativeRecord> = {},
  ): InitiativeRecord => ({
    project: "scratch-app",
    initiative: 7,
    title: "the lists could be smarter",
    steps: [51, 52, 53],
    done: 1,
    next: 52,
    nextTitle: "2. The board",
    at: "2026-08-02T10:00:00Z",
    ...overrides,
  });

  const pictures =
    (record: InitiativeRecord) =>
    (project: string): readonly InitiativeRecord[] =>
      record.project === project ? [record] : [];

  /** (1) A live step names itself, its initiative, and how far along it is. */
  it("names the live step, its initiative and how many there are", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 52, status: "active", stage: "planning" }),
    ];

    const line = lineFor(
      renderStatus(manifest, runs, {
        stateExists: true,
        pictures: pictures(picture()),
      }),
      "scratch-app",
    );

    expect(line).toContain("#52");
    expect(line).toContain("step 2 of 3");
    expect(line).toContain("#7");
  });

  /**
   * (2) Between steps: nothing is running, and the reader still wants to know
   * the initiative is alive and what comes next. Without this the line reads
   * `idle`, which is true of the project and false of the work.
   */
  it("says what is next when an initiative is between steps", () => {
    const line = lineFor(
      renderStatus(manifest, [], {
        stateExists: true,
        pictures: pictures(picture()),
      }),
      "scratch-app",
    );

    expect(line).not.toMatch(/^scratch-app\s+idle/);
    expect(line).toContain("#7");
    expect(line).toContain("1 of 3");
    expect(line).toContain("2. The board");
  });

  /** An initiative with no eligible step says so rather than inventing one. */
  it("says an initiative is waiting when no step is eligible", () => {
    const line = lineFor(
      renderStatus(manifest, [], {
        stateExists: true,
        pictures: pictures(picture({ done: 1, next: undefined, nextTitle: undefined })),
      }),
      "scratch-app",
    );

    expect(line).toContain("#7");
    expect(line).toContain("nothing to take");
  });

  /** An initiative whose steps are all closed is finished, and says nothing. */
  it("says nothing about an initiative whose steps are all done", () => {
    const line = lineFor(
      renderStatus(manifest, [], {
        stateExists: true,
        pictures: pictures(
          picture({ done: 3, next: undefined, nextTitle: undefined }),
        ),
      }),
      "scratch-app",
    );

    expect(line).toMatch(/idle/i);
  });

  /** A project with no picture at all reads exactly as it always did. */
  it("leaves a project with no initiative reading as before", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "triage" }),
    ];

    const line = lineFor(
      renderStatus(manifest, runs, { stateExists: true }),
      "scratch-app",
    );

    expect(line).toContain("#7");
    expect(line).not.toContain("step");
  });
});

describe("timone status says when the daemon is running old code", () => {
  const TIP = "9a1c2b4f0e6d5c4b3a2918f7e6d5c4b3a2918f7e";
  const BEHIND = "f5eb4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c";

  /** What the last cycle wrote down about the daemon's own process. */
  function recorded(tip?: string): DaemonRecord {
    return {
      commit: BEHIND,
      ...(tip === undefined ? {} : { tip }),
      holder: {
        token: "daemon-hold",
        command: "timone daemon",
        pid: 4242,
        since: "2026-09-04T20:00:00Z",
        observedAt: "2026-09-04T20:10:00Z",
        host: "laptop",
      },
      at: "2026-09-04T20:10:00Z",
    };
  }

  it("names the commit it is on and the command that fixes it", () => {
    const output = renderStatus(manifest, [], {
      stateExists: true,
      daemonVersion: () => recorded(TIP),
    });
    expect(output).toContain(BEHIND.slice(0, 7));
    expect(output).toContain(TIP.slice(0, 7));
    expect(output).toContain("node dist/cli.js daemon");
  });

  it("says it above the projects, before anything it produced", () => {
    const output = renderStatus(manifest, [], {
      stateExists: true,
      daemonVersion: () => recorded(TIP),
    });
    const notice = output.split("\n").findIndex((line) => /old copy/i.test(line));
    const project = output.split("\n").findIndex((line) =>
      line.startsWith("scratch-app"),
    );
    expect(notice).toBeGreaterThanOrEqual(0);
    expect(notice).toBeLessThan(project);
  });

  it("says nothing when the daemon is on the tip", () => {
    const output = renderStatus(manifest, [], {
      stateExists: true,
      daemonVersion: () => ({ ...recorded(BEHIND) }),
    });
    expect(output).not.toMatch(/old copy/i);
  });

  it("says nothing when the last cycle could not reach the remote", () => {
    const output = renderStatus(manifest, [], {
      stateExists: true,
      daemonVersion: () => recorded(),
    });
    expect(output).not.toMatch(/old copy/i);
    expect(output).not.toMatch(/up to date/i);
  });

  it("says nothing when no daemon is running", () => {
    // `RunStore.daemonVersion` answers undefined once the recorded process is
    // gone, and this is the line that depends on it: asking a reader to
    // restart a daemon that is not running is worse than saying nothing.
    const output = renderStatus(manifest, [], {
      stateExists: true,
      daemonVersion: () => undefined,
    });
    expect(output).not.toMatch(/old copy/i);
  });
});

import { RUNNER_DEFAULT_WAIT } from "../runner/session.js";

describe("renderStatus — a run the runner is waiting on", () => {
  it("reads 'waiting:' and the runner's own words for a run on the runner's wait", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "requirements",
        wait: {
          on: 'read them and reply "approved", or say what to change.',
          kind: "runner",
        },
      }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toContain('— waiting: read them and reply "approved", or say what to change.');
  });

  it("names the ticket in its closing line when the runner asked a person for something", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "requirements",
        wait: {
          on: 'read them and reply "approved", or say what to change.',
          kind: "runner",
        },
      }),
    ];
    const output = renderStatus(manifest, runs, { stateExists: true });

    expect(output.split("\n").at(-1)).toBe(
      "**What I need from you:** answer on scratch-app #12 — each ticket says what it needs.",
    );
  });

  it("does not name the ticket in its closing line when the runner asked nobody for anything", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "execution",
        wait: { on: RUNNER_DEFAULT_WAIT, kind: "runner" },
      }),
    ];
    const output = renderStatus(manifest, runs, { stateExists: true });

    expect(output.split("\n").at(-1)).toBe(
      "**What I need from you:** nothing — nothing is waiting on you right now.",
    );
  });

  it("does not name the ticket in its closing line when the runner wrote that it needs nothing", () => {
    // The runner is told to end every message with what it needs from the
    // reader, "or nothing" — and the words after "nothing" are its own.
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "execution",
        wait: { on: "Nothing — I will start the build next.", kind: "runner" },
      }),
    ];
    const output = renderStatus(manifest, runs, { stateExists: true });

    expect(output.split("\n").at(-1)).toBe(
      "**What I need from you:** nothing — nothing is waiting on you right now.",
    );
  });
});

describe("renderStatus — what a ticket the runner works on has spent", () => {
  const runnerManifest: Manifest = {
    projects: {
      "scratch-app": {
        repo_url: "https://github.com/fvermaut/scratch-app.git",
        path: "projects/scratch-app",
        stack: [],
        bindings: { ticketing: "github" },
        ticket_limit_usd: 80,
      },
    },
  };

  it("shows on a runner project's line what each ticket has spent, against its limit", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "execution",
        wait: { on: RUNNER_DEFAULT_WAIT, kind: "runner" },
      }),
    ];
    const output = renderStatus(runnerManifest, runs, {
      stateExists: true,
      records: (project, ticket) =>
        project === "scratch-app" && ticket === 12
          ? {
              ok: true,
              value: [
                {
                  kind: "runner-ended",
                  at: "2026-09-27T10:00:30.000Z",
                  runId: "scratch-app#12/1",
                  ok: true,
                  costUsd: 2.24,
                },
                {
                  kind: "step-ended",
                  at: "2026-09-27T10:40:00.000Z",
                  runId: "scratch-app#12/1",
                  stage: "execution",
                  sessionId: "s-1",
                  ok: true,
                  costUsd: 10.1,
                },
              ],
            }
          : { ok: true, value: [] },
    });

    // $2.24 + $10.10, worked out by hand; $80 is this project's own limit.
    expect(lineFor(output, "scratch-app")).toBe(
      `scratch-app  #12 (building) — waiting: ${RUNNER_DEFAULT_WAIT} — $12.34 of $80.00 spent`,
    );
  });

  it("says the spending is unknown, and where to look, when the ticket's record cannot be read", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "execution",
        wait: { on: RUNNER_DEFAULT_WAIT, kind: "runner" },
      }),
    ];
    const output = renderStatus(runnerManifest, runs, {
      stateExists: true,
      records: () => ({
        ok: false,
        error: { line: 3, message: "line 3 is not JSON" },
      }),
    });

    expect(lineFor(output, "scratch-app")).toBe(
      `scratch-app  #12 (building) — waiting: ${RUNNER_DEFAULT_WAIT} — ` +
        "spending unknown: its record cannot be read, see timone record scratch-app#12",
    );
  });

  it("shows what a ticket has spent against the default limit", () => {
    // Every project is driven by the runner now, so every project's line
    // says what its ticket has spent.
    const runs = [
      run({
        project: "scratch-app",
        ticket: 12,
        status: "parked",
        stage: "execution",
        wait: { on: RUNNER_DEFAULT_WAIT, kind: "runner" },
      }),
    ];
    const output = renderStatus(manifest, runs, {
      stateExists: true,
      records: () => ({
        ok: true,
        value: [
          {
            kind: "step-ended",
            at: "2026-09-27T10:40:00.000Z",
            runId: "scratch-app#12/1",
            stage: "execution",
            sessionId: "s-1",
            ok: true,
            costUsd: 4.5,
          },
        ],
      }),
    });

    // $150 is the limit of a project that names none of its own.
    expect(lineFor(output, "scratch-app")).toBe(
      `scratch-app  #12 (building) — waiting: ${RUNNER_DEFAULT_WAIT} — $4.50 of $150.00 spent`,
    );
  });
});

describe("renderStatus — the runs the old code left in the ledger", () => {
  it("shows what a converted run waits on, in the words it waited on", () => {
    // The ledger typed for 41c (`src/daemon/fixtures/ledger-before-166.json`),
    // read from a throwaway copy the way `timone status` reads the real one.
    const root = mkdtempSync(join(tmpdir(), "timone-status-"));
    tempDirs.push(root);
    const path = join(root, ".timone", "state.json");
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(
      fileURLToPath(new URL("../daemon/fixtures/ledger-before-166.json", import.meta.url)),
      path,
    );
    const both: Manifest = {
      projects: {
        "scratch-app": {
          repo_url: "https://github.com/fvermaut/scratch-app.git",
          path: "projects/scratch-app",
          stack: [],
          bindings: { ticketing: "github" },
        },
        ivtrends: {
          repo_url: "https://github.com/fvermaut/ivtrends.git",
          path: "projects/ivtrends",
          stack: [],
          bindings: { ticketing: "github" },
        },
      },
    };

    const output = renderStatus(both, RunStore.open(path).all(), { stateExists: true });

    // A review, then a gate, a conversation, an escalation, a wait of no kind,
    // and a run that already waited for the runner.
    expect(lineFor(output, "scratch-app")).toBe(
      "scratch-app  #24 (delivering) — waiting: your review of pull request #31",
    );
    expect(lineFor(output, "ivtrends")).toBe(
      [
        "ivtrends     #90 (writing down what it needs) — waiting: your approval of the requirements I wrote down",
        "#91 (asking what you need) — waiting: your answer to the question in my last comment.",
        "#92 (talking a question through) — waiting: me — I can't take this one further on my own.",
        "#93 (sorting the request) — waiting: the next stage to be built",
        "#94 (sorting the request) — waiting: the next thing that happens on this ticket",
      ].join("  ·  "),
    );
  });

  it("shows no list of failures, and names no command that no longer exists", () => {
    // The same ledger, read the same way. Its two failed runs read as
    // cancelled, and `retry` was removed on 2026-09-30.
    const root = mkdtempSync(join(tmpdir(), "timone-status-"));
    tempDirs.push(root);
    const path = join(root, ".timone", "state.json");
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(
      fileURLToPath(new URL("../daemon/fixtures/ledger-before-166.json", import.meta.url)),
      path,
    );
    const both: Manifest = {
      projects: {
        "scratch-app": {
          repo_url: "https://github.com/fvermaut/scratch-app.git",
          path: "projects/scratch-app",
          stack: [],
          bindings: { ticketing: "github" },
        },
        ivtrends: {
          repo_url: "https://github.com/fvermaut/ivtrends.git",
          path: "projects/ivtrends",
          stack: [],
          bindings: { ticketing: "github" },
        },
      },
    };

    const output = renderStatus(both, RunStore.open(path).all(), { stateExists: true });

    expect(output).not.toMatch(/stopped early/);
    expect(output).not.toMatch(/pick it up from where it stopped/);
    expect(output).not.toMatch(/\bretry\b/);
  });

  it("says where each kind of run stands, and names no command", () => {
    // The same ledger, read the same way. After it is read it holds three
    // kinds of run: done, cancelled (two of them were failed), and waiting
    // for the runner (five of them waited on an older kind of wait). Written
    // out by hand from the fixture.
    const root = mkdtempSync(join(tmpdir(), "timone-status-"));
    tempDirs.push(root);
    const path = join(root, ".timone", "state.json");
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(
      fileURLToPath(new URL("../daemon/fixtures/ledger-before-166.json", import.meta.url)),
      path,
    );
    const both: Manifest = {
      projects: {
        "scratch-app": {
          repo_url: "https://github.com/fvermaut/scratch-app.git",
          path: "projects/scratch-app",
          stack: [],
          bindings: { ticketing: "github" },
        },
        ivtrends: {
          repo_url: "https://github.com/fvermaut/ivtrends.git",
          path: "projects/ivtrends",
          stack: [],
          bindings: { ticketing: "github" },
        },
      },
    };

    const output = renderStatus(both, RunStore.open(path).all(), { stateExists: true });

    // A done run is not on its project's line. Every waiting run is, in its
    // own words. Every cancelled run is listed with its reason. The closing
    // line names every waiting run that asked for something, and not #94,
    // which waits on the runner's own words for asking nobody anything.
    expect(output).toBe(
      [
        "scratch-app  #24 (delivering) — waiting: your review of pull request #31",
        [
          "ivtrends     #90 (writing down what it needs) — waiting: your approval of the requirements I wrote down",
          "#91 (asking what you need) — waiting: your answer to the question in my last comment.",
          "#92 (talking a question through) — waiting: me — I can't take this one further on my own.",
          "#93 (sorting the request) — waiting: the next stage to be built",
          "#94 (sorting the request) — waiting: the next thing that happens on this ticket",
        ].join("  ·  "),
        "",
        "scratch-app #15 was cancelled: fvermaut: not needed any more",
        "scratch-app #21 was cancelled: stopped before the old code was removed: " +
          "the execution stage finished without committing anything to gate",
        "ivtrends #61 was cancelled: fvermaut: a duplicate of #60",
        "ivtrends #88 was cancelled: stopped before the old code was removed: " +
          "triage recorded no classification",
        "",
        "**What I need from you:** answer on scratch-app #24, ivtrends #90, " +
          "ivtrends #91, ivtrends #92, ivtrends #93 — each ticket says what it needs.",
      ].join("\n"),
    );
    expect(output).not.toMatch(/timone \w+/);
  });
});

describe("renderStatus — the tickets that wait for a place (ADR-0063)", () => {
  /**
   * A ledger in a temporary folder, read and written as the daemon does, with
   * one place on the project. ✏ 2026-10-05: these cases were written when
   * every project had one place (ADR-0063 D1); a project now has two unless
   * `timone.yaml` sets another number (PRD-07.R2).
   */
  function ledger(): RunStore {
    const root = mkdtempSync(join(tmpdir(), "timone-status-"));
    tempDirs.push(root);
    return RunStore.open(join(root, ".timone", "state.json"), { placesOf: () => 1 });
  }

  /** A run of scratch-app whose step runs, so it takes the project's place. */
  function stepRunning(store: RunStore, ticket: number): string {
    const { run } = store.register("scratch-app", ticket);
    store.activate(run.id, `session-${ticket}`);
    return run.id;
  }

  /** A run of scratch-app that asked for a place, with its ticket's order. */
  function asksForAPlace(
    store: RunStore,
    ticket: number,
    order: { priority: boolean; openedAt: string },
  ): void {
    const { run } = store.register("scratch-app", ticket);
    store.park(run.id, { waitingOn: "the runner", kind: "runner", stage: "triage" });
    store.askPlace(run.id, order);
  }

  /** scratch-app's line, rendered from the ledger as the command reads it. */
  function scratchLine(store: RunStore): string {
    return lineFor(
      renderStatus(manifest, store.all(), {
        stateExists: true,
        waitingForPlace: (project) => store.waitingForPlace(project),
      }),
      "scratch-app",
    );
  }

  it("names the tickets waiting for a place after the runs, in the order they get it, priority:high first", () => {
    const store = ledger();
    stepRunning(store, 7);
    // #9 was opened first; #12 carries priority:high, so it comes first.
    asksForAPlace(store, 9, { priority: false, openedAt: "2026-08-01T09:00:00Z" });
    asksForAPlace(store, 12, { priority: true, openedAt: "2026-08-03T09:00:00Z" });

    expect(scratchLine(store)).toMatch(/ {2}· {2}waiting for a place: #12, then #9$/);
  });

  it("names the ticket the place is given to, and no longer counts it as waiting", () => {
    const store = ledger();
    const seven = stepRunning(store, 7);
    asksForAPlace(store, 9, { priority: false, openedAt: "2026-08-01T09:00:00Z" });
    asksForAPlace(store, 12, { priority: true, openedAt: "2026-08-03T09:00:00Z" });

    // #7's run ends, so the ledger gives its place to #12, first in order.
    store.complete(seven);

    expect(scratchLine(store)).toMatch(
      / {2}· {2}the place is given to #12 {2}· {2}waiting for a place: #9$/,
    );
  });

  it("says nothing about a place when no ticket waits for one", () => {
    const store = ledger();
    stepRunning(store, 7);
    // Parked on the runner's wait, but it never asked for a place.
    const { run } = store.register("scratch-app", 9);
    store.park(run.id, { waitingOn: "the runner", kind: "runner", stage: "triage" });

    const line = scratchLine(store);

    expect(line).toMatch(/#7/);
    expect(line).toMatch(/#9/);
    expect(line).not.toMatch(/place/);
  });
});
