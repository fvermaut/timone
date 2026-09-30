import type {
  PullRequest,
  TicketingAdapter,
  TicketingProject,
} from "../adapters/ticketing.js";
import { breakdownPath } from "../daemon/breakdown.js";
import type { Run } from "../daemon/runs.js";

/**
 * The facts about a run's work that the runner is given each time it wakes:
 * what its branch holds, which documents are there and what their `Status:`
 * lines say, and its pull request.
 *
 * **The runner has no tool that reads.** Everything it knows about the
 * repository is what this file gathered, so it is gathered by code, from the
 * forge, every wake — never remembered from the last one, and never asked of
 * the runner.
 */

/** The forge reads the facts need, and no other part of the port. */
export type FactsAdapter = Pick<
  TicketingAdapter,
  "readBranches" | "listFiles" | "readFile" | "aheadOfDefault" | "findPullRequest"
>;

/**
 * One fact: known, or unknown and why.
 *
 * **Unknown is its own answer, never a guess.** A forge that did not answer
 * is not a forge that said "nothing there". Reading one as the other would
 * tell the runner a step produced nothing when it did, and the runner would
 * start it again.
 */
export type Fact<T> = { kind: "known"; value: T } | { kind: "unknown"; why: string };

/** A phase file on the run's branch, and what its `Status:` line says. */
export interface PhaseFile {
  path: string;
  /** The text after `Status:`, or undefined when the file has no such line. */
  status: string | undefined;
}

/** What the run's branch holds, or that the run has no branch yet. */
export type BranchFacts =
  | { kind: "no-branch" }
  | {
      kind: "branch";
      name: string;
      /**
       * How many commits the branch has that the default branch does not, or
       * undefined when the forge does not know the branch.
       */
      ahead: Fact<number | undefined>;
      /** The phase files on this branch that the default branch does not have. */
      phaseFiles: Fact<PhaseFile[]>;
      /** The verification and completion reports this branch added. */
      reports: Fact<string[]>;
      /** The branch's pull request, or undefined when it has none. */
      pullRequest: Fact<PullRequest | undefined>;
    };

/**
 * A requirements file, and what its `Status:` line says on the branch the run
 * works on — on the default branch when the run has no branch yet.
 */
export interface RequirementFile {
  path: string;
  status: string | undefined;
  /** True when the run's branch has this file and the default branch does not. */
  addedOnBranch: boolean;
}

/** The ticket's list of pieces, and what its `Status:` line says. */
export interface Breakdown {
  path: string;
  status: string | undefined;
}

export interface Facts {
  /** The default branch's name, which everything "added" is compared with. */
  defaultBranch: Fact<string>;
  branch: BranchFacts;
  requirements: Fact<RequirementFile[]>;
  /** The ticket's list of pieces, or undefined when there is none. */
  breakdown: Fact<Breakdown | undefined>;
}

const PHASES = "doc/plans/phases";
const REPORTS = "doc/plans/phases/reports";
const REQUIREMENTS = "doc/specs/prd";

/** A phase's verification report or its completion report, by file name. */
const REPORT_FILE = /\/phase-\d+-(?:verification|complete)\.md$/;

/**
 * A requirements file, and not the list of checks beside it: those end in
 * `.criteria.md` and carry a status per check, not one for the document.
 */
const REQUIREMENT_FILE = /\/prd-\d+-[^/]*(?<!\.criteria)\.md$/;

/**
 * A document's `Status:` line: at the start of a line, with the quote mark,
 * the list mark and the bold that the documents here put around it. A
 * sentence that only mentions a `Status:` line is not one.
 */
const STATUS_LINE = /^\s*(?:>\s*)?(?:[-*]\s+)?(?:\*\*|__)?Status:(?:\*\*|__)?\s*(.+?)\s*$/m;

/**
 * Every fact about `run`'s work, read from the forge.
 *
 * **It never throws.** Each fact is read on its own, and a forge call that
 * fails makes the facts that needed it unknown, with the failure as the
 * reason. The runner is still woken with everything else, and can see which
 * fact is missing rather than being told nothing at all.
 *
 * A run with no branch yet has no branch facts: nothing it could hold has
 * been made. Its requirements files and its list of pieces are read from the
 * default branch instead.
 */
export async function gatherFacts(
  adapter: FactsAdapter,
  project: TicketingProject,
  run: Pick<Run, "ticket" | "branch">,
): Promise<Facts> {
  const defaultBranch = await attempt(async () => {
    return (await adapter.readBranches(project)).defaultBranch;
  });
  const branch = run.branch;
  const [branchFacts, requirements, breakdown] = await Promise.all([
    branch === undefined
      ? Promise.resolve<BranchFacts>({ kind: "no-branch" })
      : branchFactsOf(adapter, project, defaultBranch, branch),
    comparedWith(defaultBranch, (name) =>
      requirementFiles(adapter, project, name, branch),
    ),
    branch === undefined
      ? comparedWith(defaultBranch, (name) =>
          breakdownOf(adapter, project, name, run.ticket),
        )
      : attempt(() => breakdownOf(adapter, project, branch, run.ticket)),
  ]);
  return { defaultBranch, branch: branchFacts, requirements, breakdown };
}

/** What `branch` holds that the default branch does not, and its pull request. */
async function branchFactsOf(
  adapter: FactsAdapter,
  project: TicketingProject,
  defaultBranch: Fact<string>,
  branch: string,
): Promise<BranchFacts> {
  const [ahead, phaseFiles, reports, pullRequest] = await Promise.all([
    attempt(() => adapter.aheadOfDefault(project, branch)),
    comparedWith(defaultBranch, async (name) => {
      const files: PhaseFile[] = [];
      for (const path of await addedOn(adapter, project, name, branch, PHASES)) {
        files.push({ path, status: statusOf(await adapter.readFile(project, branch, path)) });
      }
      return files;
    }),
    comparedWith(defaultBranch, async (name) =>
      (await addedOn(adapter, project, name, branch, REPORTS)).filter((path) =>
        REPORT_FILE.test(path),
      ),
    ),
    attempt(() => adapter.findPullRequest(project, branch)),
  ]);
  return { kind: "branch", name: branch, ahead, phaseFiles, reports, pullRequest };
}

/**
 * The requirements files on `branch`, or on the default branch when there is
 * no branch, each with its `Status:` line.
 *
 * **All of them, not only the new ones.** A request whose requirements were
 * approved and merged by an earlier ticket (timone#104) is one the runner
 * may start at planning, and it can only see that from the files already on
 * the default branch.
 */
async function requirementFiles(
  adapter: FactsAdapter,
  project: TicketingProject,
  defaultBranch: string,
  branch: string | undefined,
): Promise<RequirementFile[]> {
  const onDefault = (await adapter.listFiles(project, defaultBranch, REQUIREMENTS)) ?? [];
  const where = branch ?? defaultBranch;
  const listed =
    branch === undefined
      ? onDefault
      : ((await adapter.listFiles(project, branch, REQUIREMENTS)) ?? []);
  const files: RequirementFile[] = [];
  for (const path of listed.filter((path) => REQUIREMENT_FILE.test(path))) {
    files.push({
      path,
      status: statusOf(await adapter.readFile(project, where, path)),
      addedOnBranch: branch !== undefined && !onDefault.includes(path),
    });
  }
  return files;
}

/**
 * The list of pieces of ticket `ticket` on `branch`, or undefined when that
 * branch does not carry one. Its `Status:` line is what says whether a named
 * person approved it.
 *
 * **Looked for under the name the merge reads** (40u), through the one
 * function that builds it. This file once spelled the path itself, as
 * `ticket-7.md`, while the merge after the approval reads `ticket-07.md`: on
 * tickets 1 to 9 the runner was told there was no list, while there was one.
 */
async function breakdownOf(
  adapter: FactsAdapter,
  project: TicketingProject,
  branch: string,
  ticket: number,
): Promise<Breakdown | undefined> {
  const path = breakdownPath(ticket);
  const content = await adapter.readFile(project, branch, path);
  return content === undefined ? undefined : { path, status: statusOf(content) };
}

/** The files directly under `directory` that `branch` has and `defaultBranch` does not. */
async function addedOn(
  adapter: FactsAdapter,
  project: TicketingProject,
  defaultBranch: string,
  branch: string,
  directory: string,
): Promise<string[]> {
  const onDefault = new Set(
    (await adapter.listFiles(project, defaultBranch, directory)) ?? [],
  );
  const onBranch = (await adapter.listFiles(project, branch, directory)) ?? [];
  return onBranch.filter((path) => !onDefault.has(path));
}

/**
 * What `read` answers, as a known fact, or unknown with the reason it failed.
 * Every forge call here goes through this, so no fact can miss a failure.
 */
async function attempt<T>(read: () => Promise<T>): Promise<Fact<T>> {
  try {
    return { kind: "known", value: await read() };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "unknown", why: `the forge did not answer: ${message}` };
  }
}

/**
 * {@link attempt}, for a fact that needs the default branch's name. When that
 * name is itself unknown, so is this fact, and the reason says why.
 */
async function comparedWith<T>(
  defaultBranch: Fact<string>,
  read: (defaultBranch: string) => Promise<T>,
): Promise<Fact<T>> {
  if (defaultBranch.kind === "unknown") {
    return {
      kind: "unknown",
      why: `the default branch's name could not be read, and this needs it (${defaultBranch.why})`,
    };
  }
  return attempt(() => read(defaultBranch.value));
}

/** The text of a document's `Status:` line, or undefined when it has none. */
function statusOf(content: string | undefined): string | undefined {
  return content?.match(STATUS_LINE)?.[1];
}
