import type {
  Dependency,
  TicketComment,
  TicketingAdapter,
  TicketingProject,
} from "../adapters/ticketing.js";
import type { PipelineStage } from "../daemon/pipeline.js";
import type { Run, RunStore } from "../daemon/runs.js";
import type { RunnerCycle } from "../runner/driver.js";
import { attempt, filesAddedOnBranch, PHASES, type Fact } from "../runner/facts.js";
import { planFiles } from "./plan-files.js";

/**
 * The facts the planner is given for the one ticket it decides
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D3): the ticket and the files its plan names, what it is blocked by, every
 * other ticket of the project that is building or has an open pull request,
 * and the named person's comment that woke the planner, if one did.
 *
 * **Code gathers, the planner judges.** Nothing here weighs one list of files
 * against another: that is the planner's judgement, not a count.
 */

/** The forge reads the facts need, and no other part of the port. */
export type PlannerFactsAdapter = Pick<
  TicketingAdapter,
  "readBranches" | "listFiles" | "readFile" | "listPullRequestFiles"
>;

/** What gathering the facts needs from outside. */
export interface PlannerFactsDeps {
  store: RunStore;
  adapter: PlannerFactsAdapter;
  project: TicketingProject;
}

/**
 * What the poll cycle hands over: the runner's own reader for a ticket's
 * threads, which tells a pull request's state, and the blockers its survey
 * of initiatives found for a step ticket. An ordinary ticket has none known.
 */
export type PlannerCycle = Pick<RunnerCycle, "threads"> & {
  blockedBy(ticket: number): readonly Dependency[];
};

/** A ticket's plan: the phase file its branch added, and what its markers name. */
export interface Plan {
  path: string;
  /** The text of its first `# ` heading, or undefined when it has none. */
  title: string | undefined;
  /** The files its markers name ({@link planFiles}). */
  files: string[];
  /** The whole plan, for the planner to read when the lists are not enough. */
  text: string;
}

/**
 * A ticket's plan, none yet (undefined), or unknown and why. A plan that
 * cannot be read is a fact the planner is told, never an error.
 */
export type PlanFact = Fact<Plan | undefined>;

/**
 * Another ticket of the project, and why it counts: it is building, or its
 * pull request is open, with the files that pull request changes.
 */
export interface OtherTicket {
  number: number;
  title: string;
  plan: PlanFact;
  state: { kind: "building" } | { kind: "open-pull-request"; pr: number; files: Fact<string[]> };
}

export interface PlannerFacts {
  project: string;
  /** The ticket being decided. */
  ticket: { number: number; title: string; labels: readonly string[]; plan: PlanFact };
  /** The tickets it is blocked by, as the cycle's survey found them, with whether each is open. */
  blockers: readonly Dependency[];
  /** Every other ticket of the project that is building or has an open pull request. */
  others: readonly OtherTicket[];
  /** The named person's comment that woke the planner, or undefined when none did. */
  comment: TicketComment | undefined;
}

/**
 * The stages at which an active run is building: the build itself, and the
 * steps that work on what it built before it is merged.
 */
const BUILDING_STAGES: readonly PipelineStage[] = [
  "execution",
  "verification",
  "delivery",
  "remediation",
];

/**
 * The facts for deciding `run`.
 *
 * `comment` is the named person's comment that woke the planner, when one
 * did; the caller has already checked whose it is.
 *
 * A plan or a pull request's files that cannot be read are facts, with the
 * reason. A thread the cycle's reader cannot read throws, and nothing is
 * decided this cycle.
 */
export async function gatherPlannerFacts(
  deps: PlannerFactsDeps,
  run: Run,
  cycle: PlannerCycle,
  comment?: TicketComment,
): Promise<PlannerFacts> {
  const { adapter, project } = deps;
  const defaultBranch = await attempt(async () => (await adapter.readBranches(project)).defaultBranch);
  const plan = (of: Run): Promise<PlanFact> => planOf(adapter, project, defaultBranch, of.branch);

  // The run as the ledger has it now: its branch may be newer than `run`.
  const current = deps.store.get(run.id) ?? run;
  const ticket = await cycle.threads(run.ticket).ticket();
  const others: OtherTicket[] = [];
  for (const other of deps.store.runsFor(project.name)) {
    if (other.ticket === run.ticket || other.status === "done" || other.status === "cancelled") {
      continue;
    }
    const state = await stateOf(deps, other, cycle);
    if (state === undefined) continue;
    const { title } = await cycle.threads(other.ticket).ticket();
    others.push({ number: other.ticket, title, plan: await plan(other), state });
  }

  return {
    project: project.name,
    ticket: {
      number: ticket.number,
      title: ticket.title,
      labels: ticket.labels,
      plan: await plan(current),
    },
    blockers: cycle.blockedBy(run.ticket),
    others,
    comment,
  };
}

/**
 * Why a live run counts against a build, or undefined when it does not: its
 * pull request is open, as the cycle's reader shows it; or it is building —
 * let build by the planner with no pull request yet, or active at a stage
 * that builds.
 */
async function stateOf(
  deps: PlannerFactsDeps,
  run: Run,
  cycle: PlannerCycle,
): Promise<OtherTicket["state"] | undefined> {
  if (run.pr !== undefined) {
    const pull = await cycle.threads(run.ticket).pullRequest(run.pr);
    if (pull.state === "open") {
      const pr = run.pr;
      const files = await attempt(() => deps.adapter.listPullRequestFiles(deps.project, pr));
      return { kind: "open-pull-request", pr, files };
    }
  }
  const letBuild = run.planner?.decision?.kind === "build" && run.pr === undefined;
  const active = run.status === "active" && run.stage !== undefined && BUILDING_STAGES.includes(run.stage);
  return letBuild || active ? { kind: "building" } : undefined;
}

/**
 * The plan on `branch`: the phase file it added, as the runner's facts find
 * it. None while the run has no branch, or its branch added no phase file.
 */
async function planOf(
  adapter: PlannerFactsAdapter,
  project: TicketingProject,
  defaultBranch: Fact<string>,
  branch: string | undefined,
): Promise<PlanFact> {
  if (branch === undefined) return { kind: "known", value: undefined };
  if (defaultBranch.kind === "unknown") return defaultBranch;
  const added = await attempt(() =>
    filesAddedOnBranch(adapter, project, defaultBranch.value, branch, PHASES),
  );
  if (added.kind === "unknown") return added;
  const [path, ...more] = added.value;
  if (path === undefined) return { kind: "known", value: undefined };
  if (more.length > 0) {
    return {
      kind: "unknown",
      why: `the branch ${branch} added more than one phase file: ${added.value.join(", ")}`,
    };
  }
  const text = await attempt(() => adapter.readFile(project, branch, path));
  if (text.kind === "unknown") return text;
  if (text.value === undefined) {
    return { kind: "unknown", why: `${path} is not on the branch ${branch}` };
  }
  return {
    kind: "known",
    value: { path, title: titleOf(text.value), files: planFiles(text.value), text: text.value },
  };
}

/** The text of a document's first `# ` heading, or undefined when it has none. */
function titleOf(text: string): string | undefined {
  return text.match(/^# (.+?)\s*$/m)?.[1];
}
