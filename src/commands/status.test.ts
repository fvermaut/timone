import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

import { ctaComment, ctaFor } from "../daemon/cta.js";
import { progressOf, reclaimedReason } from "../daemon/poll.js";
import { stageLabel } from "../daemon/pipeline.js";
import {
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

describe("renderStatus — a ticket built in pieces", () => {
  it("names which piece of an initiative is waiting on a review", () => {
    // ADR-0028 D4's third state on the terminal: the pull request number is
    // what the reader navigates by, and the piece is how much of the whole
    // this review is.
    const runs = [
      run({
        project: "scratch-app",
        ticket: 51,
        status: "parked",
        stage: "delivery",
        waitingKind: "review",
        waitingOn: "your review",
        pr: 9,
      }),
    ];
    // ✏ 29g: which piece this is comes off the **step tickets** now, cached in
    // the ledger, rather than from counting done runs against a file. The
    // sentence the reader sees is unchanged, which is the point of asserting
    // it here rather than asserting the source.
    const output = renderStatus(manifest, runs, {
      stateExists: true,
      pictures: (project) =>
        project === "scratch-app"
          ? [
              {
                project: "scratch-app",
                initiative: 6,
                title: "the lists could be smarter",
                steps: [51, 52],
                done: 0,
                next: 51,
                nextTitle: "The ledger learns chunks",
                at: "2026-08-02T10:00:00Z",
              },
            ]
          : [],
    });

    expect(lineFor(output, "scratch-app")).toContain(
      "your review of pull request #9 — that's piece 1 of 2.",
    );
  });

  it("says a project with no breakdown anywhere exactly what it always said", () => {
    // The checkout has no `doc/plans/breakdowns/` at all — nearly every
    // ticket, and every chore. Held against the literal line.
    const runs = [
      run({
        project: "scratch-app",
        ticket: 6,
        status: "parked",
        stage: "delivery",
        waitingKind: "review",
        waitingOn: "your review",
        pr: 9,
      }),
    ];
    const output = renderStatus(manifest, runs, {
      stateExists: true,
      // A plain fixture directory, not a clone: the production default reads
      // the approved list off the default branch (ADR-0030 D2).
            ...breakdownIn(rootWith(6)),
    });

    expect(lineFor(output, "scratch-app")).toBe(
      "scratch-app  #6 (delivering) — waiting on you: your review of pull request #9",
    );
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

  it("agrees about a run nothing written can restart, and shows the way out", () => {
    // R21 clause 8 for ADR-0033's park. The same one call, rendered twice —
    // and the terminal has to show the command as well as the sentence, or a
    // reader of `timone status` alone is told they are being waited on with
    // nothing they can do about it.
    const stuck = run({
      project: "scratch-app",
      ticket: 31,
      status: "parked",
      stage: "verification",
      waitingKind: "escalation",
      waitingOn: "me — I can't take this one further myself.",
      branch: "timone/31-slow-page",
    });

    const cta = ctaFor({ project: "scratch-app", ticket: 31, run: stuck });
    const output = renderStatus(manifest, [stuck], { stateExists: true });

    expect(ctaComment(cta)).toContain(cta.needFromYou);
    expect(output).toContain(cta.needFromYou);
    expect(output).toContain("timone takeover scratch-app#31");
  });

  it("resolves an initiative's progress the same way for the ticket and the terminal", () => {
    // R21 clause 8, asserted rather than intended. **One** progress value,
    // resolved the way `reconcileCtas` resolves it — through `progressOf`
    // over the ledger's picture — fed to `ctaFor` once, and both renderings
    // of that one call are then required to carry the same sentence.
    // `renderStatus` resolves its own value internally, so if it read a
    // different picture or counted differently, its line would name a
    // different piece and this fails.
    //
    // ✏ 29g: the value used to be counted out of the ledger against a file in
    // a checkout. The guarantee is unchanged and the source is not: doneness
    // is a fact about step tickets now (ADR-0040).
    const record: InitiativeRecord = {
      project: "scratch-app",
      initiative: 6,
      title: "the lists could be smarter",
      steps: [51, 52, 53],
      done: 1,
      next: 52,
      nextTitle: "The next chunk opens",
      at: "2026-08-02T10:00:00Z",
    };
    const pictures = (project: string): readonly InitiativeRecord[] =>
      project === "scratch-app" ? [record] : [];
    const runs = [
      run({
        project: "scratch-app",
        ticket: 52,
        status: "parked",
        stage: "delivery",
        waitingKind: "review",
        waitingOn: "your review",
        pr: 12,
      }),
    ];

    const cta = ctaFor({
      project: "scratch-app",
      ticket: 52,
      run: runs.at(-1),
      progress: progressOf(record),
    });

    // Not agreement about nothing: the sentence they have to agree on is the
    // one that names the piece.
    expect(cta.needFromYou).toContain("piece 2 of 3");
    expect(ctaComment(cta)).toContain(cta.needFromYou);
    expect(renderStatus(manifest, runs, { stateExists: true, pictures })).toContain(
      cta.needFromYou,
    );
  });

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
