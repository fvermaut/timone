/**
 * What a criteria register claims, and the two ways a claim can outrun what
 * established it
 * ([ADR-0055](../../doc/adr/0055-a-universal-claim-is-not-established-by-watching.md)).
 *
 * **Why this is code and not a line in a skill.** ADR-0052's rules were
 * written into `process.md` and into three skills, and the one that mattered
 * never reached `src/daemon/gates.ts`. PRD-03's register was named as the
 * thing that would catch that, and it reported the rollout complete, because
 * the criterion which would have failed was marked verified on a live gate
 * that had walked every path except the one `ivtrends` #90 walked. A rule an
 * agent is asked to honour is what that cost. So this reads the registers
 * itself.
 *
 * **It is a floor and says so.** It recognises a universal by the words used
 * to write one, so a claim phrased around them slips past, exactly as
 * ADR-0033's mechanical floor could not fire before a second pass. The first
 * detector is the person writing the criterion; this catches some of what
 * that misses, which is more than nothing catches.
 */

/** One requirement's block, as the register writes it. */
export interface RequirementBlock {
  /** `R5`, from the heading. */
  id: string;
  /** The heading's words after the dash. */
  title: string;
  priority?: string;
  status?: string;
  verifyVia?: string;
  /**
   * What would go red if this stopped holding, when the register names it.
   * A pointer for a reader — its **presence** is what this module tests, not
   * its content, because whether a named test really falsifies the claim is
   * not a question text can answer.
   */
  falsifiedBy?: string;
  /** The whole block after the heading, as written. */
  body: string;
  /**
   * Just the `Criteria` bullets — the claim itself, and the only place a
   * universal is looked for.
   *
   * **Not the whole block**, and the reason is a bug this had on its first
   * run: `- **Last live gate:** never` says a gate has never run, which is the
   * opposite of a claim about every case, and searching the block flagged
   * eleven requirements for the word in a field that was answering a different
   * question.
   */
  criteria: string;
  /** The `>` note lines above the fields, where revisions are recorded. */
  notes: string;
}

/**
 * The words people use when they mean *every case*.
 *
 * Deliberately short. Each one earns its place by appearing in a real
 * universal in this repository's own registers, and a longer list of
 * plausible-sounding words would fire on ordinary GIVEN/WHEN/THEN prose,
 * which is how a check becomes noise and then becomes ignored.
 */
const UNIVERSALS = [
  /\bnever\b/i,
  /\balways\b/i,
  /\bat no point\b/i,
  /\bin all cases\b/i,
  /\bevery time\b/i,
  /\bno .{0,40} without\b/i,
];

/**
 * The ways a register admits, in prose, that something was not seen.
 *
 * These are quotations, not guesses: each is a phrase this repository's own
 * registers used to record a hole while the status line above it said the
 * requirement was established.
 */
const ADMISSIONS = [
  /\bnever triggered\b/i,
  /\bnever observed\b/i,
  /\bnever seen\b/i,
  /\bnot observed\b/i,
  /\bowed a (direct )?sighting\b/i,
  /\bwas never\b/i,
];

export type RegisterFaultKind = "watched-only" | "status-outruns-notes";

export interface RegisterFault {
  /** `R5`. */
  requirement: string;
  kind: RegisterFaultKind;
  /** One line, in the human's terms. */
  detail: string;
  /** The words that tripped it, quoted so the reader can judge the call. */
  quoted: string;
}

/** Split a register into its requirement blocks. */
export function readRegister(source: string): RequirementBlock[] {
  const blocks: RequirementBlock[] = [];
  const headings = [...source.matchAll(/^## (R\d+)\s*(?:—\s*(.*))?$/gm)];

  for (const [index, heading] of headings.entries()) {
    const from = heading.index + heading[0].length;
    const to = headings[index + 1]?.index ?? source.length;
    const chunk = source.slice(from, to);

    blocks.push({
      id: heading[1],
      title: (heading[2] ?? "").trim(),
      priority: field(chunk, "Priority"),
      status: field(chunk, "Status"),
      verifyVia: field(chunk, "Verify-via"),
      falsifiedBy: field(chunk, "Falsified-by"),
      body: chunk,
      criteria: criteriaOf(chunk),
      notes: chunk
        .split("\n")
        .filter((line) => line.startsWith(">"))
        .join("\n"),
    });
  }

  return blocks;
}

/**
 * The `Criteria` bullets, from the field to whatever field follows it.
 * Empty when the block has none, which is itself worth nothing here: a block
 * with no criteria makes no claim to outrun.
 */
function criteriaOf(chunk: string): string {
  const from = chunk.indexOf("- **Criteria:**");
  if (from === -1) return "";

  const rest = chunk.slice(from + "- **Criteria:**".length);
  const next = /^- \*\*/m.exec(rest);
  return next === null ? rest : rest.slice(0, next.index);
}

/** `- **Status:** verified` → `verified`. */
function field(chunk: string, name: string): string | undefined {
  const found = new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.*)$`, "m").exec(chunk);
  return found === undefined || found === null ? undefined : found[1].trim();
}

/**
 * Every way this register's statuses claim more than what stands behind them.
 *
 * Both rules apply only to a `MUST` marked `verified`: a `SHOULD` carries less
 * weight by construction, and anything not yet claimed to hold is already
 * saying the honest thing.
 */
export function registerFaults(source: string): RegisterFault[] {
  const faults: RegisterFault[] = [];

  for (const block of readRegister(source)) {
    if (block.priority !== "MUST" || block.status !== "verified") continue;

    // D2 first: an admission in the block's own words outranks everything,
    // and needs no judgement about what kind of claim is being made.
    const admitted = firstMatch(block.body, ADMISSIONS);
    if (admitted !== undefined) {
      faults.push({
        requirement: block.id,
        kind: "status-outruns-notes",
        quoted: admitted,
        detail:
          `${block.id} is marked verified, and its own notes say a clause was ` +
          `never seen to hold.`,
      });
      continue;
    }

    // D1: a universal closed by watching alone. A live gate establishes the
    // paths it walked; this claims every path.
    if (block.verifyVia !== "live" || block.falsifiedBy !== undefined) continue;

    const universal = firstMatch(`${block.title}\n${block.criteria}`, UNIVERSALS);
    if (universal === undefined) continue;

    faults.push({
      requirement: block.id,
      kind: "watched-only",
      quoted: universal,
      detail:
        `${block.id} claims something about every case and is verified by ` +
        `watching, which establishes the cases that were watched.`,
    });
  }

  return faults;
}

function firstMatch(text: string, patterns: readonly RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (found !== null) return found[0];
  }
  return undefined;
}
