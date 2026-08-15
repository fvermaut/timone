import { describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import { ctaComment, ctaFor } from "../daemon/cta.js";
import { reclaimedReason } from "../daemon/poll.js";
import { runId, type Run } from "../daemon/runs.js";
import { renderStatus } from "./status.js";

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

  it("shows the active ticket and the stage it reached", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "triage" }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/#7/);
    expect(line).toMatch(/triage/);
  });

  it("names who is waited on, and what for, when a run is parked", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        stage: "triage",
        waitingOn: "approval on the ticket",
      }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/waiting on you/i);
    expect(line).toMatch(/approval on the ticket/);
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
        waitingOn: "an answer about how it should behave",
      }),
      run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        stage: "clarification",
        waitingOn: "an answer about the wording",
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
        waitingOn: "an answer",
      }),
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "requirements" }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/#7.*working on it now/);
    expect(line).toMatch(/#6.*waiting on you/);
  });

  it("names every waiting ticket in the closing line", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 6, status: "parked", waitingOn: "an answer" }),
      run({ project: "other-app", ticket: 2, status: "parked", waitingOn: "approval" }),
    ];
    const lastLine =
      renderStatus(manifest, runs, { stateExists: true }).trimEnd().split("\n").at(-1) ?? "";

    expect(lastLine).toMatch(/scratch-app #6/);
    expect(lastLine).toMatch(/other-app #2/);
  });

  it("shows how many tickets are queued behind the active one", () => {
    const runs = [
      run({ project: "scratch-app", ticket: 7, status: "active" }),
      run({ project: "scratch-app", ticket: 8, status: "queued" }),
      run({ project: "scratch-app", ticket: 9, status: "queued" }),
    ];
    const line = lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app");

    expect(line).toMatch(/2 queued/);
    expect(line).toMatch(/#8/);
    expect(line).toMatch(/#9/);
  });

  it("marks a run whose automatic checks failed", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 7,
        status: "parked",
        waitingOn: "the next stage",
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
      run({ project: "scratch-app", ticket: 5, status: "failed" }),
    ];
    expect(lineFor(renderStatus(manifest, runs, { stateExists: true }), "scratch-app")).toMatch(
      /idle/i,
    );
  });

  it("mentions a project's last failure rather than hiding it", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "failed",
        failure: "model unavailable",
      }),
    ];
    const output = renderStatus(manifest, runs, { stateExists: true });
    expect(output).toMatch(/model unavailable/);
  });

  it("says a cancelled chunk was stopped, without calling it a failure", () => {
    // Typing `timone cancel` must change something the human can see, and
    // what they see must carry the difference the ledger records: abandoned
    // rather than broken, so no "stopped early" and no retry command.
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
    expect(output).not.toMatch(/stopped early/);
    expect(output).not.toMatch(/timone retry/);
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
        waitingOn: "approval on the ticket",
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

  it("names the pull request a review wait is waiting on", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 6,
          status: "parked",
          stage: "delivery",
          waitingKind: "review",
          waitingOn: "your review",
          pr: 9,
          branch: "timone/6-fiddly-box",
        }),
      ],
      { stateExists: true },
    );

    const line = lineFor(output, "scratch-app");
    expect(line).toMatch(/waiting on you/i);
    expect(line).toMatch(/pull request #9/);
  });
});

describe("renderStatus — a run whose daemon died under it", () => {
  it("says what happened and what to type, without naming a daemon or a run", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "failed",
          stage: "execution",
          failure: reclaimedReason(),
        }),
      ],
      { stateExists: true },
    );

    expect(output).toContain(
      "scratch-app #7 stopped early: the machine running it stopped before the work was finished",
    );
    expect(output).toContain("timone retry scratch-app#7");
    // 12c's discipline: nothing here should require knowing what a stage,
    // a heartbeat, a poll cycle or a marker is.
    expect(output).not.toMatch(/heartbeat|stale|reclaim|poll|session id/i);
  });

  it("frees the project, so the line reads idle rather than busy", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "failed",
          failure: reclaimedReason(),
        }),
      ],
      { stateExists: true },
    );

    expect(lineFor(output, "scratch-app")).toContain("idle");
  });

  it("names the way back for every failure, not only the reclaimed ones", () => {
    const output = renderStatus(
      manifest,
      [
        run({
          project: "scratch-app",
          ticket: 7,
          status: "failed",
          failure: "the model was unavailable",
        }),
      ],
      { stateExists: true },
    );

    expect(output).toContain("timone retry scratch-app#7");
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
    expect(lineFor(output, "scratch-app")).toContain("claude-opus-5");
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
          waitingOn: "your answer on the ticket",
          waitingKind: "gate",
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

    expect(lineFor(output, "scratch-app")).toContain("claude-opus-5");
    expect(lineFor(output, "scratch-app")).not.toContain(" for ");
  });
});

describe("renderStatus — one computation, two renderers", () => {
  it("says the same thing on the ticket and on the status line, from one call", () => {
    const parked = run({
      project: "scratch-app",
      ticket: 6,
      status: "parked",
      stage: "delivery",
      waitingKind: "review",
      waitingOn: "your review",
      pr: 9,
      branch: "timone/6-fiddly-box",
    });

    // **One call**, whose result is handed to both renderers. The expectations
    // below are the computed CTA itself rather than two literals that happen to
    // match, so a change to the computation has to move both outputs or this
    // fails — which is the property R21's clause 8 closes by construction.
    const cta = ctaFor({
      project: parked.project,
      ticket: parked.ticket,
      run: parked,
    });

    expect(cta.needFromYou).not.toBe("");
    expect(ctaComment(cta)).toContain(cta.needFromYou);
    expect(
      renderStatus(manifest, [parked], { stateExists: true }),
    ).toContain(cta.needFromYou);
  });

  it("names in its closing line exactly the tickets the computation is waiting on", () => {
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "planning",
        waitingKind: "gate",
        waitingOn: "your answer on the ticket",
      }),
      run({ project: "scratch-app", ticket: 7, status: "active", stage: "execution" }),
      run({
        project: "other-app",
        ticket: 2,
        status: "failed",
        stage: "planning",
        failure: "the model was unavailable",
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
