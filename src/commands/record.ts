import type { Command } from "commander";

import { stageLabel } from "../daemon/pipeline.js";
import { loadManifest, ticketLimitOf, type Manifest } from "../manifest.js";
import { STOPPED_BY_RUNNER } from "../runner/actions.js";
import { joined } from "../runner/comments.js";
import { allowanceOf, DEFAULT_LIMIT_USD, spentOn } from "../runner/limit.js";
import { defaultOrder, TICKET_KINDS } from "../runner/order.js";
import { readRecord, type RecordEntry } from "../runner/record.js";
import type { RunnerToolName } from "../runner/tools.js";
import { parseTarget, type TakeoverTarget } from "./takeover.js";

/**
 * `timone record <project>#<ticket>`: what the machine wrote down about a
 * ticket the runner works on — each step with its start, end and cost, each
 * decision with its reason, each step left out of the default order, and
 * what the ticket has spent against its limit.
 *
 * **Read-only, and it takes no lock.** The record is only ever appended to,
 * one whole line at a time, so reading it while the daemon writes can at
 * worst miss the newest line. Nothing here writes, so there is nothing for a
 * lock to protect.
 */

/** What {@link renderRecord} is given: one ticket, and its record as read. */
export interface RecordReportInput {
  project: string;
  ticket: number;
  /** The ticket's record, as `readRecord` returned it. */
  record: ReturnType<typeof readRecord>;
  /**
   * The project's limit for one ticket before any raise: `ticketLimitOf` of
   * its manifest entry.
   */
  limitUsd: number;
}

/**
 * The record of one ticket, in plain words. Pure: it reads nothing, so a
 * fixture record is all a test needs.
 *
 * **A failure is what the command exits 1 on**: a ticket with nothing written
 * about it, and a record with a broken line. Both are said in a sentence,
 * never as a stack trace.
 */
export function renderRecord(
  input: RecordReportInput,
): { ok: true; value: string } | { ok: false; error: string } {
  // The reader's own message says "run record", which is a word for people
  // who have read the process. The line number is what a person needs, so
  // the sentence is written again around it.
  if (!input.record.ok) {
    const file = [".timone", "records", input.project, `${input.ticket}.jsonl`].join("/");
    return {
      ok: false,
      error:
        `The record of ${input.project} #${input.ticket} cannot be read: line ${input.record.error.line} of ` +
        `${file} is broken. Fix that line, then run this again.`,
    };
  }
  const entries = input.record.value;
  if (entries.length === 0) {
    return {
      ok: false,
      error:
        `There is no record of ${input.project} #${input.ticket}: nothing has been written down about it yet. ` +
        "A record is kept only for tickets in projects the runner works on.",
    };
  }
  return {
    ok: true,
    value: [
      `The record of ${input.project} #${input.ticket}.`,
      "",
      ...list("Steps:", stepLines(entries)),
      "",
      ...list("Decisions:", decisionLines(entries)),
      "",
      ...list("Steps left out of the default order:", departureLines(entries)),
      "",
      ...spendingLines(entries, input.limitUsd),
    ].join("\n"),
  };
}

/**
 * A list under its heading. A list with nothing in it says so, because a
 * heading with nothing under it could also mean the list failed to print.
 */
function list(heading: string, items: readonly string[]): string[] {
  return [heading, ...(items.length === 0 ? ["- None."] : items)];
}

/**
 * One line per step: its start, its end and its cost. A step's start and end
 * are two entries, matched by the session that ran it.
 */
function stepLines(entries: readonly RecordEntry[]): string[] {
  const lines: string[] = [];
  for (const started of entries) {
    if (started.kind !== "step-started") continue;
    const ended = entries.find(
      (entry) =>
        entry.kind === "step-ended" &&
        entry.runId === started.runId &&
        entry.sessionId === started.sessionId,
    );
    const label = capitalised(stageLabel(started.stage));
    const start = `started ${when(started.at)}`;
    if (ended?.kind !== "step-ended") {
      // Still running, or its session died before the end was written. The
      // record cannot tell those apart, so it says only what it holds.
      lines.push(`- ${label}: ${start}, no end written down yet.`);
      continue;
    }
    const line = `- ${label}: ${start}, ended ${when(ended.at)}, cost ${usd(ended.costUsd)}.`;
    lines.push(
      ended.stoppedBy === STOPPED_BY_RUNNER
        ? `${line} The runner stopped it.`
        : ended.ok
          ? line
          : `${line} ${failure(ended.error)}`,
    );
  }
  return lines;
}

/** How a step that did not end well ended, from its entry's error. */
function failure(error: string | undefined): string {
  return error === undefined ? "It failed." : `It failed: ${error}`;
}

/**
 * What each decision was, in words. The runner's decisions are named after
 * the action it took; code writes two of its own, about the list of pieces.
 * Typed over every action name, so a new action cannot be left without words.
 */
const ACTION_WORDS = new Map<string, string>(
  Object.entries({
    start_step: "start a step",
    message_step: "send a message to the running step",
    stop_step: "stop the running step",
    post: "write on the ticket",
    set_hold: "change whether the ticket is on hold",
    record_approval: "write down an approval",
    file_timone_issue: "report a fault in Timone",
    comment_timone_issue: "comment on a fault in Timone",
    end_run: "end the work",
    "chunk-zero-merged": "add the requirements and the list of pieces to the default branch",
    "chunk-zero-not-merged":
      "leave the requirements and the list of pieces off the default branch",
  } satisfies Record<RunnerToolName | "chunk-zero-merged" | "chunk-zero-not-merged", string>),
);

/**
 * One line per decision, oldest first: when, what, and the reason given, with
 * what went wrong under it when the action did not happen. An action this
 * file has no words for is shown as it was written.
 */
function decisionLines(entries: readonly RecordEntry[]): string[] {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== "decision") continue;
    const what = ACTION_WORDS.get(entry.action) ?? entry.action;
    lines.push(`- ${when(entry.at)} — ${what}. Reason: ${entry.reason}`);
    // Written when the action was refused or failed ("Refused: …",
    // "Failed: …"). Without it, a refused step would read as one that ran.
    if (entry.detail !== undefined) lines.push(`  ${entry.detail}`);
  }
  return lines;
}

/**
 * One line per step the runner left out of the default order, oldest first,
 * with the reason it gave.
 *
 * **Read from the `departure` entries, not worked out from the order.**
 * Which order a ticket follows depends on its labels and on where its run
 * came from, and both are on the forge; this command reads no network. The
 * machine refuses a step that would leave another out unless the runner
 * gives a reason, and writes the entry when it does, so every step left out
 * is here. The pull request's own list is the one worked out from the order.
 */
function departureLines(entries: readonly RecordEntry[]): string[] {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== "departure") continue;
    const steps = joined(entry.skipped.map(labelOfStep));
    lines.push(`- ${when(entry.at)} — ${steps}. ${reasonText(entry.reason)}`);
  }
  return lines;
}

/**
 * The runner's reason, as the pull request's list shows it. A step left out
 * with no reason is still listed: a person should see that nobody explained
 * it. A reason of only spaces explains nothing either.
 */
function reasonText(reason: string | undefined): string {
  return reason === undefined || reason.trim() === "" ? "No reason given." : `Reason: ${reason}`;
}

/**
 * What a person calls the step with id `id`, from whichever written order
 * holds it. The ids are the same in every order, so the first one found is
 * the answer. An id no order knows is shown as it was written.
 */
function labelOfStep(id: string): string {
  for (const kind of TICKET_KINDS) {
    const step = defaultOrder(kind).find((one) => one.id === id);
    if (step !== undefined) return step.label;
  }
  return id;
}

/**
 * What the ticket has spent against what it may spend, in the words the
 * runner's refusal uses when the limit is reached.
 *
 * The total and the limit come from `limit.ts`, the functions that decide
 * whether another session may start, so this line and that decision cannot
 * disagree. The total is split between the steps and the runner's own
 * sessions, because only the steps are listed above: without the split, the
 * listed costs would not add up to the total.
 */
function spendingLines(entries: readonly RecordEntry[], limitUsd: number): string[] {
  let onSteps = 0;
  let onRunner = 0;
  for (const entry of entries) {
    if (entry.kind === "step-ended") onSteps += entry.costUsd;
    if (entry.kind === "runner-ended") onRunner += entry.costUsd;
  }
  const lines = [
    `This ticket has spent ${usd(spentOn(entries))} of the ${usd(allowanceOf(entries, limitUsd))} ` +
      `it may spend: ${usd(onSteps)} on steps and ${usd(onRunner)} on the runner deciding what to do next.`,
  ];
  // Each "continue" from a named person adds the project's limit once more,
  // so a ticket may spend more than the limit its project sets. Each one is
  // named, with the time of the comment that said it, so the larger number
  // has its reason beside it.
  for (const entry of entries) {
    if (entry.kind !== "limit-raised") continue;
    lines.push(`- ${entry.by} allowed another ${usd(limitUsd)} on ${when(entry.commentAt)}.`);
  }
  return lines;
}

/**
 * A time as a person reads it, `2026-09-27 10:01 UTC`. Always in UTC, as the
 * record holds it, so the same record reads the same on every machine. A
 * time that does not parse is shown as it was written.
 */
function when(at: string): string {
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return at;
  const iso = instant.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Dollars as a person reads them: `$150.40`. */
function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** `label` with its first letter in capitals, to start a line. */
function capitalised(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Register the `record` command on the program. */
export function registerRecordCommand(program: Command): void {
  program
    .command("record")
    .argument("<ticket>", "which ticket to show, as <project>#<ticket>")
    .description(
      "Show what was written down about a ticket: each step, each decision, and what it cost",
    )
    .option("--manifest <path>", "path to the timone manifest file", "timone.yaml")
    .action((raw: string, options: { manifest: string }) => {
      const fail = (error: unknown): void => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      };

      let target: TakeoverTarget;
      let manifest: Manifest;
      try {
        target = parseTarget(raw);
        manifest = loadManifest(options.manifest);
      } catch (error) {
        fail(error);
        return;
      }

      // A project missing from the manifest can still have a record, from
      // before it was removed; its limit is then the one every project has
      // unless its entry says otherwise.
      const config = manifest.projects[target.project];
      let record: ReturnType<typeof readRecord>;
      try {
        // The root is where the command was run, as for every command
        // (ADR-0007) — the same folder the daemon writes the records under.
        record = readRecord(process.cwd(), target.project, target.ticket);
      } catch (error) {
        fail(error);
        return;
      }

      const report = renderRecord({
        project: target.project,
        ticket: target.ticket,
        record,
        limitUsd: config === undefined ? DEFAULT_LIMIT_USD : ticketLimitOf(config),
      });
      if (report.ok) {
        console.log(report.value);
      } else {
        console.error(report.error);
        process.exitCode = 1;
      }
    });
}
