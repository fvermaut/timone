import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Timone's own merge rule for the two files every branch writes to:
 * `STATUS.md` and a requirement register (`doc/specs/prd/*.criteria.md`).
 * {@link mergeFile} takes the three versions of one file and returns the
 * merged text, deciding the parts git could not.
 */

/** The kinds of file this rule merges. */
export const MERGE_KINDS = ["status", "register"] as const;

/** One kind of file this rule merges. */
export type MergeKind = (typeof MERGE_KINDS)[number];

/** Whether `value` names a kind of file this rule merges. */
export function isMergeKind(value: string): value is MergeKind {
  return (MERGE_KINDS as readonly string[]).includes(value);
}

/** The three versions of one file. */
export interface MergeSides {
  /** The version both sides started from. */
  base: string;
  /** The work branch's version (git's %A, "ours"). */
  current: string;
  /** The default branch's version (git's %B, "theirs"). */
  other: string;
}

/** What the merge produced. */
export interface MergeResult {
  /** What goes into the current side's file. */
  text: string;
  /** True when every part was decided. */
  clean: boolean;
  /** One plain sentence per part that was not. */
  problems: string[];
}

/** What a git command did: its exit code and what it printed. */
interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run git in `dir` without a shell and report what it did, whatever the exit code. */
function runGit(dir: string, args: string[]): Promise<GitResult> {
  return new Promise((resolvePromise) => {
    const child = spawn("git", args, { cwd: dir });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolvePromise({ code: -1, stdout, stderr: stderr + error.message });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** git's merge of the three sides, with `diff3` conflict markers 40 characters long. */
async function gitMergeFile(sides: MergeSides): Promise<GitResult> {
  const dir = mkdtempSync(join(tmpdir(), "timone-merge-"));
  try {
    writeFileSync(join(dir, "current"), sides.current);
    writeFileSync(join(dir, "base"), sides.base);
    writeFileSync(join(dir, "other"), sides.other);
    return await runGit(dir, [
      "merge-file", "-p", "--diff3", "--marker-size=40",
      "-L", "current", "-L", "base", "-L", "other",
      "current", "base", "other",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Where a line of the merged text came from. */
type Origin = "shared" | "current" | "other";

/** One line of the merged text, with where it came from. */
interface Line {
  text: string;
  from: Origin;
}

/**
 * A run of the merged text: lines that were decided, or the two versions of a
 * range both sides changed in different ways, the other side's first.
 */
type Segment =
  | { kind: "decided"; lines: Line[] }
  | { kind: "versions"; other: Line[]; current: Line[] };

/** One conflict block of git's output, the three sides' lines. */
interface ConflictBlock {
  current: string[];
  base: string[];
  other: string[];
}

/** git's output read as plain lines and conflict blocks. */
type GitPart = { kind: "line"; text: string } | { kind: "block"; block: ConflictBlock };

const MARKER_SIZE = 40;
const OPEN_MARKER = `${"<".repeat(MARKER_SIZE)} current`;
const BASE_MARKER = `${"|".repeat(MARKER_SIZE)} base`;
const SPLIT_MARKER = "=".repeat(MARKER_SIZE);
const CLOSE_MARKER = `${">".repeat(MARKER_SIZE)} other`;

/** Split a text into lines, dropping the empty string after a final newline. */
function linesOf(text: string): string[] {
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  return lines;
}

/** Read git's diff3 output into plain lines and conflict blocks. */
function parseGitOutput(output: string): GitPart[] {
  const parts: GitPart[] = [];
  let block: ConflictBlock | undefined;
  let into: "current" | "base" | "other" = "current";
  for (const text of linesOf(output)) {
    if (text === OPEN_MARKER) {
      block = { current: [], base: [], other: [] };
      into = "current";
    } else if (block !== undefined && text === BASE_MARKER) {
      into = "base";
    } else if (block !== undefined && text === SPLIT_MARKER) {
      into = "other";
    } else if (block !== undefined && text === CLOSE_MARKER) {
      parts.push({ kind: "block", block });
      block = undefined;
    } else if (block !== undefined) {
      block[into].push(text);
    } else {
      parts.push({ kind: "line", text });
    }
  }
  return parts;
}

/**
 * In `STATUS.md`, git splits an item both sides rewrote into one conflict
 * block per paragraph. Blocks with only blank lines between them become one
 * block, the blank lines in all three sides, so the item is decided whole.
 */
function joinBlocksAcrossBlankLines(parts: GitPart[]): GitPart[] {
  const joined: GitPart[] = [];
  for (const part of parts) {
    if (part.kind === "line") {
      joined.push(part);
      continue;
    }
    let gapStart = joined.length;
    while (gapStart > 0 && isBlankText(joined[gapStart - 1]!)) gapStart--;
    const before = joined[gapStart - 1];
    if (before === undefined || before.kind !== "block") {
      joined.push(part);
      continue;
    }
    const gap = joined.splice(gapStart).flatMap((line) => (line.kind === "line" ? [line.text] : []));
    before.block = {
      current: [...before.block.current, ...gap, ...part.block.current],
      base: [...before.block.base, ...gap, ...part.block.base],
      other: [...before.block.other, ...gap, ...part.block.other],
    };
  }
  return joined;
}

/** Whether a part of git's output is a blank plain line. */
function isBlankText(part: GitPart): boolean {
  return part.kind === "line" && part.text.trim() === "";
}

/** A change one side made: base lines `start` to `end` (exclusive) replaced by `lines`. */
interface Change {
  side: "current" | "other";
  start: number;
  end: number;
  lines: string[];
}

/** The changes that turn `base` into `edited`, by a line-level longest common subsequence. */
function changesBetween(base: string[], edited: string[], side: Change["side"]): Change[] {
  const n = base.length;
  const m = edited.length;
  const common: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      common[i]![j] =
        base[i] === edited[j]
          ? common[i + 1]![j + 1]! + 1
          : Math.max(common[i + 1]![j]!, common[i]![j + 1]!);
    }
  }
  const changes: Change[] = [];
  let open: Change | undefined;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && base[i] === edited[j]) {
      open = undefined;
      i++;
      j++;
      continue;
    }
    if (open === undefined) {
      open = { side, start: i, end: i, lines: [] };
      changes.push(open);
    }
    if (j < m && (i >= n || common[i]![j + 1]! >= common[i + 1]![j]!)) {
      open.lines.push(edited[j]!);
      j++;
    } else {
      i++;
      open.end = i;
    }
  }
  return changes;
}

/**
 * Whether two changes touch the same base lines. Two insertions overlap at the
 * same point; an insertion overlaps a replacement only strictly inside it.
 */
function overlaps(a: Change, b: Change): boolean {
  const aInserts = a.start === a.end;
  const bInserts = b.start === b.end;
  if (aInserts && bInserts) return a.start === b.start;
  if (aInserts) return b.start < a.start && a.start < b.end;
  if (bInserts) return a.start < b.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}

/** Whether two changes are the same change. */
function sameChange(a: Change, b: Change): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.lines.length === b.lines.length &&
    a.lines.every((line, k) => line === b.lines[k])
  );
}

/** Both sides' changes, grouped so that changes which overlap share a group. */
function groupChanges(changes: Change[]): Change[][] {
  const sorted = [...changes].sort(
    (a, b) => a.start - b.start || (a.start === a.end ? -1 : 0) - (b.start === b.end ? -1 : 0),
  );
  const groups: Change[][] = [];
  for (const change of sorted) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.some((member) => member.side !== change.side && overlaps(member, change))) {
      last.push(change);
    } else {
      groups.push([change]);
    }
  }
  return groups;
}

/** Whether both sides made changes in a group. */
function bothSides(group: Change[]): boolean {
  return group.some((change) => change.side === "current") && group.some((change) => change.side === "other");
}

/**
 * In `STATUS.md`, an item is several paragraphs. Two groups both sides changed,
 * with only blank base lines between them, are one item changed twice: they
 * become one group, so that each side's version of the item stays whole.
 */
function joinRewrittenItems(groups: Change[][], base: string[]): Change[][] {
  const joined: Change[][] = [];
  for (const group of groups) {
    const last = joined[joined.length - 1];
    if (last !== undefined && bothSides(last) && bothSides(group)) {
      const gap = base.slice(Math.max(...last.map((change) => change.end)), Math.min(...group.map((change) => change.start)));
      if (gap.every((line) => line.trim() === "")) {
        last.push(...group);
        continue;
      }
    }
    joined.push(group);
  }
  return joined;
}

/** `base` lines `start` to `end` with one side's changes in that range applied. */
function applyChanges(base: string[], start: number, end: number, changes: Change[], from: Origin): Line[] {
  const lines: Line[] = [];
  let at = start;
  for (const change of changes) {
    for (; at < change.start; at++) lines.push({ text: base[at]!, from });
    for (const text of change.lines) lines.push({ text, from });
    at = change.end;
  }
  for (; at < end; at++) lines.push({ text: base[at]!, from });
  return lines;
}

/** Decide one conflict block: both sides' changes where they do not overlap, both versions where they do. */
function resolveBlock(kind: MergeKind, block: ConflictBlock): Segment[] {
  const changes = [
    ...changesBetween(block.base, block.current, "current"),
    ...changesBetween(block.base, block.other, "other"),
  ];
  const segments: Segment[] = [];
  let at = 0;
  const groups = groupChanges(changes);
  for (const group of kind === "status" ? joinRewrittenItems(groups, block.base) : groups) {
    const start = Math.min(...group.map((change) => change.start));
    const end = Math.max(...group.map((change) => change.end));
    segments.push({ kind: "decided", lines: applyChanges(block.base, at, start, [], "shared") });
    const currentChanges = group.filter((change) => change.side === "current");
    const otherChanges = group.filter((change) => change.side === "other");
    const [first, second] = group;
    if (group.length === 2 && first !== undefined && second !== undefined && sameChange(first, second)) {
      segments.push({ kind: "decided", lines: applyChanges(block.base, start, end, [first], "shared") });
    } else if (!bothSides(group)) {
      const from = currentChanges.length === 0 ? "other" : "current";
      segments.push({ kind: "decided", lines: applyChanges(block.base, start, end, group, from) });
    } else {
      segments.push({
        kind: "versions",
        other: applyChanges(block.base, start, end, otherChanges, "other"),
        current: applyChanges(block.base, start, end, currentChanges, "current"),
      });
    }
    at = end;
  }
  segments.push({ kind: "decided", lines: applyChanges(block.base, at, block.base.length, [], "shared") });
  return segments;
}

/** Every line of a block's segments, in order. */
function segmentLines(segments: Segment[]): Line[] {
  return segments.flatMap((segment) =>
    segment.kind === "decided" ? segment.lines : [...segment.other, ...segment.current],
  );
}

const LAST_UPDATED = /^\*\*Last updated:\*\*/;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/;

/**
 * In `STATUS.md`, the `**Last updated:**` lines of a block that are not kept:
 * all but the one with the later date, or all but the other side's line when
 * a date cannot be read.
 */
function olderLastUpdated(lines: Line[]): Line[] {
  const dated = lines.filter((line) => LAST_UPDATED.test(line.text));
  if (dated.length < 2) return [];
  const dates = dated.map((line) => ISO_DATE.exec(line.text)?.[0]);
  let kept: Line | undefined;
  if (dates.every((date) => date !== undefined)) {
    const latest = [...dates].sort().pop();
    kept = dated.find((line, k) => dates[k] === latest && line.from === "other") ??
      dated.find((_, k) => dates[k] === latest);
  } else {
    kept = dated.find((line) => line.from === "other") ?? dated[0];
  }
  return dated.filter((line) => line !== kept);
}

const FIELD = /^- \*\*([^*]+):\*\*/;

/** A field both sides set: the current side's line, and the other side's line that stands. */
interface FieldClash {
  current: Line;
  other: Line;
}

/**
 * In a register, the current side's field lines that name a field the other
 * side's lines in the same block and the same section also name. The other
 * side's line stands.
 */
function fieldClashes(lines: Line[]): FieldClash[] {
  let section = 0;
  const sectionOf = new Map<Line, number>();
  for (const line of lines) {
    if (line.text.startsWith("## ")) section++;
    sectionOf.set(line, section);
  }
  const clashes: FieldClash[] = [];
  for (const line of lines) {
    if (line.from !== "current") continue;
    const name = FIELD.exec(line.text)?.[1];
    if (name === undefined) continue;
    const other = lines.find(
      (candidate) =>
        candidate.from === "other" &&
        sectionOf.get(candidate) === sectionOf.get(line) &&
        FIELD.exec(candidate.text)?.[1] === name,
    );
    if (other !== undefined) clashes.push({ current: line, other });
  }
  return clashes;
}

const REQUIREMENT_HEADING = /^## R(\d+)\b/;

/** In a register, one sentence per requirement number two headings share. */
function takenNumbers(text: string): string[] {
  const seen = new Set<string>();
  const taken = new Set<string>();
  for (const line of linesOf(text)) {
    const number = REQUIREMENT_HEADING.exec(line)?.[1];
    if (number === undefined) continue;
    if (seen.has(number)) taken.add(number);
    seen.add(number);
  }
  return [...taken].map(
    (number) =>
      `R${number} is taken on both sides of this merge, and requirement numbers are cited, so it is not renumbered. A person must choose.`,
  );
}

/** Whether a line is blank. */
function isBlank(line: Line | undefined): boolean {
  return line !== undefined && line.text.trim() === "";
}

/** A block's lines without `dropped`, with a blank line between two versions in `STATUS.md` when neither has one. */
function joinSegments(kind: MergeKind, segments: Segment[], dropped: Set<Line>): Line[] {
  const keep = (lines: Line[]): Line[] => lines.filter((line) => !dropped.has(line));
  const joined: Line[] = [];
  for (const segment of segments) {
    if (segment.kind === "decided") {
      joined.push(...keep(segment.lines));
      continue;
    }
    const other = keep(segment.other);
    const current = keep(segment.current);
    const needsBlank =
      kind === "status" &&
      other.length > 0 &&
      current.length > 0 &&
      !isBlank(other[other.length - 1]) &&
      !isBlank(current[0]);
    joined.push(...other, ...(needsBlank ? [{ text: "", from: "shared" as const }] : []), ...current);
  }
  return joined;
}

/** The note that records the current side's value of a field the other side's value replaced. */
function clashNote(clash: FieldClash, today: string): string {
  return (
    `> ✏ ${today} — when this branch was brought level with the default branch, ` +
    `it had \`${clash.current.text}\`. The default branch's \`${clash.other.text}\` stands.`
  );
}

/** Write each clash's note under the heading of the section holding the field, below the notes already there. */
function writeNotes(lines: Line[], clashes: FieldClash[], today: string): Line[] {
  const result = [...lines];
  for (const clash of clashes) {
    const fieldAt = result.indexOf(clash.other);
    let heading = fieldAt;
    while (heading >= 0 && !result[heading]!.text.startsWith("## ")) heading--;
    let after = heading;
    for (let k = heading + 1; k < fieldAt; k++) {
      const text = result[k]!.text;
      if (text.startsWith(">")) after = k;
      else if (text.trim() !== "") break;
    }
    result.splice(after + 1, 0, { text: "", from: "shared" }, { text: clashNote(clash, today), from: "shared" });
  }
  return result;
}

/** Today's date in UTC, `YYYY-MM-DD`. */
function todayInUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Merge the three versions of a file of `kind`. */
export async function mergeFile(
  kind: MergeKind,
  sides: MergeSides,
  options?: { today?: string },
): Promise<MergeResult> {
  const result = await gitMergeFile(sides);
  if (result.code === 0) return { text: result.stdout, clean: true, problems: [] };
  if (result.code < 0 || result.code > 127) {
    throw new Error(`git merge-file failed: ${result.stderr.trim() || `exit code ${result.code}`}`);
  }
  const lines: Line[] = [];
  const clashes: FieldClash[] = [];
  const parts = parseGitOutput(result.stdout);
  for (const part of kind === "status" ? joinBlocksAcrossBlankLines(parts) : parts) {
    if (part.kind === "line") {
      lines.push({ text: part.text, from: "shared" });
      continue;
    }
    const segments = resolveBlock(kind, part.block);
    const blockLines = segmentLines(segments);
    const dropped = new Set<Line>();
    if (kind === "status") {
      for (const line of olderLastUpdated(blockLines)) dropped.add(line);
    } else {
      for (const clash of fieldClashes(blockLines)) {
        dropped.add(clash.current);
        if (clash.current.text !== clash.other.text) clashes.push(clash);
      }
    }
    lines.push(...joinSegments(kind, segments, dropped));
  }
  const merged = writeNotes(lines, clashes, options?.today ?? todayInUtc());
  const text = merged.map((line) => line.text).join("\n") + (result.stdout.endsWith("\n") ? "\n" : "");
  const problems = kind === "register" ? takenNumbers(text) : [];
  return { text, clean: problems.length === 0, problems };
}

/** The paths each rule applies to, as git attribute patterns relative to the repository root. */
export const MERGE_RULE_PATHS: Readonly<Record<MergeKind, string>> = {
  status: "/STATUS.md",
  register: "doc/specs/prd/*.criteria.md",
};

/** The name git knows the rule for `kind` by, in `merge=<name>` and `merge.<name>.driver`. */
function driverName(kind: MergeKind): string {
  return `timone-${kind}`;
}

/**
 * The git settings that switch both rules on: `core.attributesFile` and one
 * driver per kind. Git runs the driver with the base (%O), the current side
 * (%A, which the driver overwrites), the other side (%B) and the path (%P).
 */
export function mergeRulesConfig(options: {
  cli: string;
  dir: string;
}): ReadonlyArray<readonly [string, string]> {
  return [
    ["core.attributesFile", join(options.dir, "attributes")],
    ...MERGE_KINDS.map(
      (kind) =>
        [
          `merge.${driverName(kind)}.driver`,
          `node ${options.cli} merge-file ${kind} %O %A %B %P`,
        ] as const,
    ),
  ];
}

/**
 * Write `<dir>/attributes` and return the environment (`GIT_CONFIG_COUNT`,
 * `GIT_CONFIG_KEY_n`, `GIT_CONFIG_VALUE_n`) that makes git use it.
 *
 * **The environment, not the checkout**, as for the push guard: nothing is
 * written into the project, so a client repository never gains a
 * `.gitattributes` or a driver in its `.git/config`.
 */
export function installMergeRules(dir: string, options: { cli: string }): Record<string, string> {
  const at = resolve(dir);
  mkdirSync(at, { recursive: true });
  writeFileSync(
    join(at, "attributes"),
    MERGE_KINDS.map((kind) => `${MERGE_RULE_PATHS[kind]} merge=${driverName(kind)}\n`).join(""),
  );
  const config = mergeRulesConfig({ cli: options.cli, dir: at });
  const env: Record<string, string> = { GIT_CONFIG_COUNT: String(config.length) };
  config.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return env;
}
