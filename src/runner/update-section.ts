/**
 * The update's record, and the section of the pull request that says what
 * it found (ADR-0066).
 *
 * The update writes one entry to `phase-NN-update.md` each time it brings a
 * branch level with the default branch. The driver reads the newest entry
 * and puts it at the top of the pull request, so a person sees first whether
 * the work still passes.
 */

/** The line that opens the update section of a pull request. */
export const UPDATE_START = "<!-- timone:update -->";

/** The line that closes it. */
export const UPDATE_END = "<!-- /timone:update -->";

/** One test set's line of an entry: what it said, and the text after the dash. */
export interface TestSet {
  result: "passed" | "failed" | "none";
  detail: string | undefined;
}

/**
 * The newest entry of an update record. A line the entry does not have, or
 * has in a form not read here, is undefined: it is never guessed.
 */
export interface UpdateEntry {
  /** `<default> at <sha>`. */
  levelWith: string | undefined;
  /** The pull requests that arrived, as the record words them. */
  arrived: string | undefined;
  wholeSuite: TestSet | undefined;
  ticketChecks: TestSet | undefined;
  arrivedChecks: TestSet | undefined;
  fixes: number | undefined;
  /** `none`, or plain sentences saying what changed and why. */
  codeChanged: string | undefined;
  result: { passes: true } | { passes: false; failure: string | undefined } | undefined;
}

/** A field line of an entry: `- **<label>:** <value>`. */
const FIELD = /^- \*\*(.+?):\*\* (.*)$/;

/**
 * The newest `## Update` section of `recordText`, read into its fields, or
 * undefined when the record has no entry. Each update appends its entry, so
 * the newest is the last one in the file.
 */
export function latestUpdate(recordText: string): UpdateEntry | undefined {
  const lines = recordText.split(/\r?\n/);
  let start = -1;
  lines.forEach((line, index) => {
    if (line.startsWith("## Update")) start = index;
  });
  if (start === -1) return undefined;
  const fields = new Map<string, string>();
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const field = FIELD.exec(line.trim());
    if (field?.[1] !== undefined && field[2] !== undefined) fields.set(field[1], field[2].trim());
  }
  return {
    levelWith: fields.get("Level with"),
    arrived: fields.get("Arrived"),
    wholeSuite: testSetOf(fields.get("Whole test suite"), ["passed", "failed"]),
    ticketChecks: testSetOf(fields.get("Check scripts of this ticket"), ["passed", "failed", "none"]),
    arrivedChecks: testSetOf(fields.get("Check scripts of the work that arrived"), [
      "passed",
      "failed",
      "none",
    ]),
    fixes: fixesOf(fields.get("Fixes")),
    codeChanged: fields.get("Code changed"),
    result: resultOf(fields.get("Result")),
  };
}

/** A test set's value, `<result>` or `<result> — <detail>`, when its result is one of `allowed`. */
function testSetOf(value: string | undefined, allowed: readonly TestSet["result"][]): TestSet | undefined {
  if (value === undefined) return undefined;
  const [word = "", ...rest] = value.split(" — ");
  const result = allowed.find((each) => each === word.trim());
  if (result === undefined) return undefined;
  const detail = rest.join(" — ").trim();
  return { result, detail: detail === "" ? undefined : detail };
}

/** The number of fixes the update made. */
function fixesOf(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined;
}

/** `passes`, or `does not pass — <the failure>`. */
function resultOf(value: string | undefined): UpdateEntry["result"] {
  if (value === "passes") return { passes: true };
  const failed = /^does not pass(?: — (.*))?$/.exec(value ?? "");
  if (failed === null) return undefined;
  const failure = failed[1]?.trim();
  return { passes: false, failure: failure === "" ? undefined : failure };
}

/** The three test sets, with the words the section names them by. */
function testSets(entry: UpdateEntry): { name: string; set: TestSet | undefined }[] {
  return [
    { name: "The whole test suite", set: entry.wholeSuite },
    { name: "The check scripts of this ticket", set: entry.ticketChecks },
    { name: "The check scripts of the work that arrived", set: entry.arrivedChecks },
  ];
}

/**
 * The block of a pull request's description that says what the update
 * `entry` found, between {@link UPDATE_START} and {@link UPDATE_END}.
 */
export function updateSection(entry: UpdateEntry, defaultBranch: string): string {
  const failures = failuresOf(entry);
  const lines =
    failures.length === 0
      ? [UPDATE_START, `### Brought level with ${defaultBranch}`, ""]
      : [
          UPDATE_START,
          `### This work does not pass after being brought level with ${defaultBranch}`,
          "",
          ...failures,
          "",
        ];
  lines.push(`What arrived on ${defaultBranch}: ${sentence(entry.arrived ?? "")}`, "");
  lines.push(
    entry.codeChanged === "none" ? "No code had to change." : `What had to change: ${entry.codeChanged ?? ""}`,
    "",
  );
  for (const { name, set } of testSets(entry)) {
    lines.push(
      set === undefined
        ? `- ${name}: did not run.`
        : `- ${name}: ${sentence(set.detail === undefined ? set.result : `${set.result} — ${set.detail}`)}`,
    );
  }
  lines.push(UPDATE_END);
  return lines.join("\n");
}

/**
 * The lines that say why `entry` does not pass, or none when it passes: the
 * failure the record gives, then each test set that failed or did not run.
 *
 * **A set the entry has no line for did not run**, and the work does not
 * pass, whatever its `Result:` line says: code never takes the result over a
 * set that is missing or failed.
 */
function failuresOf(entry: UpdateEntry): string[] {
  const lines: string[] = [];
  if (entry.result?.passes === false) {
    lines.push(
      entry.result.failure === undefined
        ? "It does not pass."
        : `It does not pass: ${sentence(entry.result.failure)}`,
    );
  }
  for (const { name, set } of testSets(entry)) {
    if (set === undefined) lines.push(`${name} did not run.`);
    else if (set.result === "failed") {
      lines.push(set.detail === undefined ? `${name} failed.` : `${name} failed: ${sentence(set.detail)}`);
    }
  }
  return lines;
}

/** `text` ending with a full stop, unless it ends with one already. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * `body` with `section` as its first lines, in place of any update block it
 * held already. The old block goes with its markers and the blank line after
 * it; everything else, the departures block among it, is kept where it was.
 */
export function withUpdate(body: string, section: string): string {
  const start = body.indexOf(UPDATE_START);
  const end = start === -1 ? -1 : body.indexOf(UPDATE_END, start);
  const rest =
    end === -1
      ? body
      : body.slice(0, start) + body.slice(end + UPDATE_END.length).replace(/^\r?\n(\r?\n)?/, "");
  return rest.trim() === "" ? section : `${section}\n\n${rest}`;
}
