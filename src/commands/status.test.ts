import { describe, expect, it } from "vitest";

import type { Manifest } from "../manifest.js";
import type { Run } from "../daemon/runs.js";
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
    id: `${overrides.project}#${overrides.ticket}`,
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
