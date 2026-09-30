import { pathToFileURL } from "node:url";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { stageLabel } from "../../daemon/pipeline.js";
import type { RecordEntry } from "../record.js";
import { RUNNER_MODEL, type RunQuery } from "../session.js";
import { RUNNER_SERVER_NAME } from "../tools.js";
import { CASES, type ReplayCase, type ToolCall } from "./cases.js";
import { runTry, type Call, type Seen, type Try, type Verdict } from "./recording.js";

/**
 * The replay of the recorded failures (PRD-05 R18): every case of `cases.ts`,
 * three tries each, through the real runner, with fake actions that only
 * record what is called.
 *
 * ```
 * npm run replay                  # every case, on the real model; costs money
 * npm run replay -- --case 139    # one case; --case may be given more than once
 * npm run replay -- --dry         # a scripted runner and no model: checks the wiring, costs nothing
 * ```
 *
 * It prints one line per case — PASS or FAIL, the case's issue numbers, and
 * for a failure what the runner did on each try — then how many cases passed
 * and what the runner's sessions cost. It exits 1 when any case failed.
 *
 * **Only the real mode calls the model**, through the SDK's own `query`. The
 * dry run hands `wakeRunner` a scripted stand-in instead, which plays each
 * case's right calls through the real tool server.
 */

/** How many separate tries each case gets. One pass can be luck; R18 asks for three. */
export const TRIES = 3;

/** What judging needs to know of a case. */
export interface JudgedCase {
  issues: readonly string[];
  mustDo: string;
  judge: (seen: Seen) => Verdict;
}

/**
 * How a case went over all its tries: whether it passed, the one line the
 * harness prints for it, and what the runner's sessions cost.
 */
export interface CaseVerdict {
  passed: boolean;
  line: string;
  costUsd: number;
}

/**
 * Judge one case from its tries (PRD-05 R18).
 *
 * **A case passes only when every try chose what it asks for.** The runner is
 * a model, and one good answer can be luck; three separate tries is the guard
 * R18 sets against a lucky pass. A try that errored chose nothing, so it
 * counts as a failed try, and so does a case with no tries at all.
 *
 * Pure: the tries are judged as the stand-ins recorded them, and nothing is
 * read from what the model wrote in its own words.
 */
export function judgeCase(replayCase: JudgedCase, tries: readonly Try[]): CaseVerdict {
  const verdicts = tries.map((each) => verdictOf(replayCase, each));
  const chose = verdicts.filter((verdict) => verdict.ok).length;
  const passed = tries.length > 0 && chose === tries.length;
  const costUsd = tries.reduce((sum, each) => sum + each.costUsd, 0);
  const name = replayCase.issues.join(", ");
  const line = passed
    ? `PASS ${name} — ${replayCase.mustDo} ${chose} of ${tries.length} tries.`
    : [
        `FAIL ${name} — ${replayCase.mustDo} ${chose} of ${tries.length} tries chose it.`,
        ...tries.map((each, index) => `Try ${index + 1}: ${tryText(each, verdicts[index])}.`),
      ].join(" ");
  return { passed, line, costUsd };
}

/** Whether one try chose what the case asks for. */
function verdictOf(replayCase: JudgedCase, each: Try): Verdict {
  switch (each.kind) {
    case "ran":
      return replayCase.judge(each.seen);
    case "errored":
      return { ok: false, wanted: "a session that ran to its end" };
    default:
      return each satisfies never;
  }
}

/** What one try did, in a few words, and what was wanted when it was not that. */
function tryText(each: Try, verdict: Verdict | undefined): string {
  if (each.kind === "errored") return each.error;
  const did = didText(each.seen);
  if (verdict === undefined || verdict.ok) return `chose it (${did})`;
  return `${did} — wanted: ${verdict.wanted}`;
}

/**
 * Everything a try did: the calls that reached the stand-ins, in order, then
 * what the machine wrote in the record that no call shows — an approval, a
 * departure, an action the rules refused — and whether the run ended.
 */
function didText(seen: Seen): string {
  const parts = [
    ...seen.calls.map(callText),
    ...seen.entries.flatMap(entryText),
    ...(seen.status === "done" ? ["ended the run"] : []),
  ];
  return parts.length === 0 ? "did nothing" : parts.join("; ");
}

/** One call, in a few words, with the arguments that tell calls apart. */
function callText(call: Call): string {
  switch (call.kind) {
    case "step-started":
      return `started ${stageLabel(call.stage)} (${call.stage}): "${cut(call.instructions)}"`;
    case "step-not-started":
      return `a start failed, as the case makes it (${cut(call.error)})`;
    case "posted":
      return `posted on the ${call.where === "ticket" ? "ticket" : "pull request"}: "${cut(call.body)}"`;
    case "hold":
      return call.on ? "put the hold on" : "took the hold off";
    case "label":
      return `${call.on ? "added" : "removed"} the label ${call.label}`;
    case "timone-issue-filed":
      return `filed a Timone issue: "${cut(call.title)}"`;
    case "timone-issue-commented":
      return `commented on Timone issue #${call.number}`;
    case "ticket-closed":
      return "closed the ticket";
    case "step-messaged":
      return `sent the running step a message: "${cut(call.text)}"`;
    case "step-stopped":
      return "stopped the running step";
    case "other":
      return call.what;
    default:
      return call satisfies never;
  }
}

/** What an entry of the record says that no call shows, or nothing. */
function entryText(entry: RecordEntry): string[] {
  if (entry.kind === "approval") return [`recorded ${entry.by}'s approval of the ${entry.what}`];
  if (entry.kind === "departure") return [`recorded a departure (${entry.skipped.join(", ")})`];
  if (entry.kind === "decision" && entry.detail !== undefined) {
    return [`${entry.action} was not done: "${cut(entry.detail)}"`];
  }
  return [];
}

/** The first line of `text`, cut to a length that fits on the case's line. */
function cut(text: string): string {
  const first = (text.split("\n").find((line) => line.trim() !== "") ?? "").trim();
  return first.length <= 100 ? first : `${first.slice(0, 99)}…`;
}

/**
 * A stand-in for the SDK's `query` that makes `calls`, in order, through the
 * real tool server it is handed — over MCP, the way a model's calls reach it
 * — and ends as a session that cost nothing. It reads no answer: it shows
 * that the case's right calls get through the real tools and the real rules,
 * and that the case's matcher sees them.
 */
export function scriptedRunner(calls: readonly ToolCall[]): RunQuery {
  return ({ options }) => played(calls, options);
}

async function* played(calls: readonly ToolCall[], options: Options): AsyncGenerator<unknown> {
  const server = options.mcpServers?.[RUNNER_SERVER_NAME];
  if (server?.type !== "sdk") throw new Error("the runner was given no tool server of its own");
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.instance.connect(serverSide);
  const client = new Client({ name: "replay-dry-run", version: "1.0.0" });
  await client.connect(clientSide);
  try {
    for (const call of calls) {
      await client.callTool({ name: call.name, arguments: call.input });
    }
  } finally {
    await client.close();
  }
  yield {
    type: "result",
    subtype: "success",
    is_error: false,
    total_cost_usd: 0,
    num_turns: calls.length + 1,
    result: "Done.",
  };
}

/** What the command line asked for. */
interface ReplayOptions {
  dry: boolean;
  /** The cases asked for by `--case`, as typed; empty for every case. */
  cases: string[];
}

/** Read the command line. A mistake in it is an answer, with the words to print. */
function readArguments(argv: readonly string[]): { ok: true; value: ReplayOptions } | { ok: false; error: string } {
  const value: ReplayOptions = { dry: false, cases: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry") {
      value.dry = true;
    } else if (argument === "--case") {
      const asked = argv[index + 1];
      if (asked === undefined || asked.startsWith("--")) {
        return { ok: false, error: "--case needs an issue number after it, like --case 139." };
      }
      value.cases.push(asked);
      index += 1;
    } else {
      return { ok: false, error: `I do not know "${argument}". Use --dry, or --case <issue number>.` };
    }
  }
  return { ok: true, value };
}

/**
 * Whether `issue`, as a case names it, is the one `asked` for: the same
 * text, or the same number when no project was typed — so `139` is `#139`
 * and `37` is `scratch-app#37`.
 */
function answersTo(issue: string, asked: string): boolean {
  if (issue === asked) return true;
  const typedProject = asked.includes("#") && !asked.startsWith("#");
  const number = (text: string): string => text.slice(text.indexOf("#") + 1);
  return !typedProject && number(issue) === number(asked);
}

/** The cases asked for, or every case when none was. */
function chosen(asked: readonly string[]): { ok: true; value: readonly ReplayCase[] } | { ok: false; error: string } {
  if (asked.length === 0) return { ok: true, value: CASES };
  const unknown = asked.filter((each) => !CASES.some((replayCase) => replayCase.issues.some((issue) => answersTo(issue, each))));
  if (unknown.length > 0) {
    const names = CASES.map((replayCase) => replayCase.issues.join(", ")).join("; ");
    return { ok: false, error: `No case is called ${unknown.join(", ")}. The cases are: ${names}.` };
  }
  return {
    ok: true,
    value: CASES.filter((replayCase) => replayCase.issues.some((issue) => asked.some((each) => answersTo(issue, each)))),
  };
}

/**
 * Run the replay and print its lines. The three tries of a case run side by
 * side: each has its own folder, ledger and forge, so they cannot see each
 * other. Answers the exit code: 0 when every case passed, 1 when one failed,
 * 2 when the command line was wrong.
 */
export async function replay(
  argv: readonly string[],
  print: (line: string) => void = (line) => console.log(line),
): Promise<number> {
  const options = readArguments(argv);
  if (!options.ok) {
    print(options.error);
    return 2;
  }
  const cases = chosen(options.value.cases);
  if (!cases.ok) {
    print(cases.error);
    return 2;
  }
  print(
    options.value.dry
      ? `Replaying ${cases.value.length} cases, ${TRIES} tries each, with a scripted runner and no model (--dry).`
      : `Replaying ${cases.value.length} cases, ${TRIES} tries each, on ${RUNNER_MODEL}.`,
  );
  let passed = 0;
  let costUsd = 0;
  for (const replayCase of cases.value) {
    const runQuery: RunQuery = options.value.dry ? scriptedRunner(replayCase.rightCalls) : query;
    const tries = await Promise.all(
      Array.from({ length: TRIES }, () => runTry(replayCase.moment, runQuery)),
    );
    const verdict = judgeCase(replayCase, tries);
    print(verdict.line);
    if (verdict.passed) passed += 1;
    costUsd += verdict.costUsd;
  }
  print(`${passed} of ${cases.value.length} cases passed. The runner's sessions cost $${costUsd.toFixed(2)} in all.`);
  return passed === cases.value.length ? 0 : 1;
}

// Run when started as a script (`npm run replay`), and not when a test
// imports this file for `judgeCase`.
const started = process.argv[1];
if (started !== undefined && import.meta.url === pathToFileURL(started).href) {
  replay(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
      process.exitCode = 1;
    },
  );
}
