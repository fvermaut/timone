import { describe, expect, it } from "vitest";

import type { ContainerExit, ContainerSpawn } from "./container-runtime.js";
import {
  leftoverBoxes,
  parseListing,
  sweepLeftoverBoxes,
  type ListedBox,
} from "./leftover-boxes.js";

/** The daemon fvermaut runs, with the projects its manifest names. */
const owner = {
  ledger: "/home/f/timone/.timone/state.json",
  projects: ["ivtrends", "timone", "scratch-app"],
};

/** A box as the listing gives it, with an id nobody needs to read. */
function box(name: string, ledger = ""): ListedBox {
  return { id: `id-of-${name}`, name, ledger };
}

describe("the boxes a starting daemon removes (timone#73)", () => {
  it("removes a box labelled with its own ledger, whatever its name", () => {
    const listed = [box("anything-at-all", "/home/f/timone/.timone/state.json")];

    expect(leftoverBoxes(listed, owner)).toEqual(listed);
  });

  it("keeps a box labelled with another daemon's ledger", () => {
    // A second daemon on the same machine — a live check, say — keeps its
    // own ledger, and its boxes are its own.
    const listed = [box("timone-ivtrends-4", "/tmp/live-check/state.json")];

    expect(leftoverBoxes(listed, owner)).toEqual([]);
  });

  it("removes an unlabelled box with the old name of one of its projects", () => {
    // `timone-<project>-<counter>`: what every box was called before it
    // carried a ledger label, and the name a restarted daemon asked for again.
    const listed = [box("timone-ivtrends-4"), box("timone-timone-13")];

    expect(leftoverBoxes(listed, owner)).toEqual(listed);
  });

  it("keeps the previews and the service containers that share the prefix", () => {
    // None of these is a box. A preview of the `timone` project is named
    // `timone-pr-<n>-…`, and a run's services are named after the project
    // and the branch; removing them takes down what fvermaut is looking at,
    // or the database a live run is using.
    const listed = [
      box("timone-pr-5-app-1"),
      box("timone-timone-default-db-1"),
      box("timone-ivtrends-timone-73-db-1"),
      box("ivtrends-pr-12-web-1"),
    ];

    expect(leftoverBoxes(listed, owner)).toEqual([]);
  });

  it("keeps an unlabelled box with the old name of a project it does not manage", () => {
    expect(leftoverBoxes([box("timone-otherproject-3")], owner)).toEqual([]);
  });

  it("keeps an unlabelled box with the new name, which only a label can claim", () => {
    // Every box with the new name carries its ledger's label, so one without
    // a label was not started by this daemon's runtime.
    const listed = [box("timone-ivtrends-37-1-delivery-0a1b2c3d")];

    expect(leftoverBoxes(listed, owner)).toEqual([]);
  });
});

describe("reading the listing docker gives", () => {
  it("reads each line's id, name and label, and skips a blank line", () => {
    const lines = [
      "a1\ttimone-ivtrends-37-1-delivery-0a1b2c3d\t/home/f/timone/.timone/state.json",
      "b2\ttimone-ivtrends-4\t",
      "",
      "c3\tivtrends-pr-12-web-1",
    ];

    expect(parseListing(lines)).toEqual([
      {
        id: "a1",
        name: "timone-ivtrends-37-1-delivery-0a1b2c3d",
        ledger: "/home/f/timone/.timone/state.json",
      },
      { id: "b2", name: "timone-ivtrends-4", ledger: "" },
      { id: "c3", name: "ivtrends-pr-12-web-1", ledger: "" },
    ]);
  });
});

/**
 * A docker that answers `ps` with the given lines and exit, and `rm` with the
 * given exit, recording every call as its argument vector.
 */
function fakeDocker(
  listing: string[],
  listed: Partial<ContainerExit> = {},
  removed: Partial<ContainerExit> = {},
): { spawn: ContainerSpawn; calls: string[][] } {
  const calls: string[][] = [];
  const spawn: ContainerSpawn = (command, args) => {
    calls.push([command, ...args]);
    const lines = args[0] === "ps" ? listing : [];
    const exit = args[0] === "ps" ? listed : removed;
    return {
      lines: (async function* () {
        yield* lines;
      })(),
      exit: Promise.resolve({ code: 0, signal: null, stderr: "", ...exit }),
      kill: () => {},
    };
  };
  return { spawn, calls };
}

const LEDGER = "/home/f/timone/.timone/state.json";

describe("a starting daemon removes the boxes an earlier one left (timone#73)", () => {
  it("lists every container, removes its leftovers in one call, and says which", async () => {
    const { spawn, calls } = fakeDocker([
      `a1\ttimone-ivtrends-37-1-delivery-0a1b2c3d\t${LEDGER}`,
      "b2\ttimone-pr-5-app-1\t",
      "c3\ttimone-timone-13\t",
    ]);
    const said: string[] = [];

    const removed = await sweepLeftoverBoxes({
      spawn,
      ledger: LEDGER,
      projects: ["ivtrends", "timone"],
      log: (message) => said.push(message),
    });

    expect(calls).toEqual([
      [
        "docker",
        "ps",
        "-a",
        "--no-trunc",
        "--format",
        '{{.ID}}\t{{.Names}}\t{{.Label "timone.ledger"}}',
      ],
      ["docker", "rm", "-f", "a1", "c3"],
    ]);
    expect(said).toEqual([
      "removed 2 box(es) left by an earlier daemon: " +
        "timone-ivtrends-37-1-delivery-0a1b2c3d, timone-timone-13",
    ]);
    expect(removed).toEqual([
      "timone-ivtrends-37-1-delivery-0a1b2c3d",
      "timone-timone-13",
    ]);
  });

  it("asks docker to remove nothing, and says nothing, when nothing is left", async () => {
    const { spawn, calls } = fakeDocker([
      "b2\ttimone-pr-5-app-1\t",
      "d4\ttimone-ivtrends-4\t/tmp/live-check/state.json",
    ]);
    const said: string[] = [];

    const removed = await sweepLeftoverBoxes({
      spawn,
      ledger: LEDGER,
      projects: ["ivtrends", "timone"],
      log: (message) => said.push(message),
    });

    expect(calls.map((call) => call[1])).toEqual(["ps"]);
    expect(said).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("says it could not list the containers, and removes nothing, when the listing fails", async () => {
    const { spawn, calls } = fakeDocker(
      [`a1\ttimone-ivtrends-4\t${LEDGER}`],
      {
        code: 1,
        stderr: "Cannot connect to the Docker daemon. Is the docker daemon running?\n",
      },
    );
    const said: string[] = [];

    const removed = await sweepLeftoverBoxes({
      spawn,
      ledger: LEDGER,
      projects: ["ivtrends"],
      log: (message) => said.push(message),
    });

    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^could not list containers/);
    expect(calls.map((call) => call[1])).toEqual(["ps"]);
    expect(removed).toEqual([]);
  });

  it("says it could not list the containers, and does not reject, when docker cannot be started", async () => {
    const said: string[] = [];
    const spawn: ContainerSpawn = () => {
      throw new Error("spawn docker ENOENT");
    };

    const removed = await sweepLeftoverBoxes({
      spawn,
      ledger: LEDGER,
      projects: ["ivtrends"],
      log: (message) => said.push(message),
    });

    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^could not list containers/);
    expect(removed).toEqual([]);
  });

  it("says it could not remove every leftover box when the removal fails, and resolves", async () => {
    const { spawn } = fakeDocker(
      [`a1\ttimone-ivtrends-4\t${LEDGER}`],
      {},
      {
        code: 1,
        stderr: "Error response from daemon: removal of container a1 is already in progress\n",
      },
    );
    const said: string[] = [];

    await sweepLeftoverBoxes({
      spawn,
      ledger: LEDGER,
      projects: ["ivtrends"],
      log: (message) => said.push(message),
    });

    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^could not remove every leftover box/);
  });

  it("says it could not remove every leftover box, and does not reject, when the removal cannot be started", async () => {
    const listing = fakeDocker([`a1\ttimone-ivtrends-4\t${LEDGER}`]);
    const spawn: ContainerSpawn = (command, args) => {
      if (args[0] === "rm") throw new Error("spawn docker EAGAIN");
      return listing.spawn(command, args);
    };
    const said: string[] = [];

    await sweepLeftoverBoxes({
      spawn,
      ledger: LEDGER,
      projects: ["ivtrends"],
      log: (message) => said.push(message),
    });

    expect(said).toEqual([
      "could not remove every leftover box (timone-ivtrends-4): spawn docker EAGAIN",
    ]);
  });
});

