import type { TicketComment, TicketingProject } from "../adapters/ticketing.js";
import type { PipelineStage } from "../daemon/pipeline.js";
import type { Run, RunStore } from "../daemon/runs.js";
import { HELD_LABEL } from "../daemon/steps.js";
import { namedPeople, ticketLimitOf, type Manifest, type ProjectConfig } from "../manifest.js";
import { isNamedPerson } from "../runner/brief.js";
import type { RunnerCycle } from "../runner/driver.js";
import { isOverLimit } from "../runner/limit.js";
import { appendEntry, readRecord, type RecordEntry } from "../runner/record.js";
import { passedToRunner } from "./actions.js";
import {
  gatherPlannerFacts,
  type PlannerCycle,
  type PlannerFacts,
  type PlannerFactsAdapter,
} from "./facts.js";

/**
 * The planner's driver: what the poll cycle calls, once a cycle, for every
 * project, after the runner's
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D1, D4, D5).
 *
 * **It chooses which run is decided, and when. It never decides.** A
 * session does that. At most one session runs for a project at a time: two
 * deciding at once could each let a ticket build without seeing the other.
 *
 * **It never waits for a session.** It asks for one and goes on, as the
 * runner's driver does with a wake, so one project's planner does not hold
 * up the next project. {@link PlannerDriver.drain} waits, for the tests and
 * for a daemon run with `--once`.
 */

/** What the driver needs from outside. */
export interface PlannerDriverDeps {
  store: RunStore;
  adapter: PlannerFactsAdapter;
  manifest: Manifest;
  /** The Timone root: where the run records live. */
  root: string;
  /**
   * Start one planner session deciding `run` with `facts`, settling when it
   * ends; `PlannerSessions.decide` in the daemon. Never asked twice at once
   * for one project.
   */
  decide: (run: Run, facts: PlannerFacts) => Promise<void>;
  /** The time now, as an ISO-8601 timestamp. */
  clock: () => string;
  log: (message: string) => void;
}

/**
 * What the poll cycle hands over: what the planner's facts need, and whether
 * a ticket is a step ticket, so its own claim is not read as a hold.
 */
export type PlannerDriverCycle = PlannerCycle & Pick<RunnerCycle, "isStep">;

/**
 * The stages at which an active run is building: the build itself, and the
 * steps that work on what it built before it is merged. The planner's facts
 * read "building" the same way.
 */
const BUILDING_STAGES: readonly PipelineStage[] = [
  "execution",
  "verification",
  "delivery",
  "remediation",
];

/**
 * What the `notice` entry says when the planner's driver gave a named
 * person's comment to a planner session: the comment is the planner's to
 * answer, and is not given to it twice.
 */
export function plannerReadComment(commentAt: string): string {
  return `planner read comment at ${commentAt}`;
}

/**
 * Whether `run` waits for the planner: it is live, and the planner was asked
 * and has not decided, or holds it. A named person's comment on its ticket
 * is then the planner's to read, not the runner's (D5).
 */
export function waitsForPlanner(run: Run): boolean {
  if (run.status === "done" || run.status === "cancelled") return false;
  const { planner } = run;
  if (planner?.decision === undefined) return planner?.askedAt !== undefined;
  return planner.decision.kind === "hold";
}

/**
 * The moment from which a named person's comment on `run`'s ticket is the
 * planner's to read: when the planner was asked, or, for a held run, when it
 * held it.
 */
function plannerSince(run: Run): string | undefined {
  const { planner } = run;
  return planner?.decision?.kind === "hold" ? planner.decision.at : planner?.askedAt;
}

/** Whether the record notes the fact `about`. */
function noticed(entries: readonly RecordEntry[], about: string): boolean {
  return entries.some((entry) => entry.kind === "notice" && entry.about === about);
}

/** An instant as milliseconds, for comparing two of them whatever their spelling. */
function ms(instant: string): number {
  return Date.parse(instant);
}

/** The run to decide next, and the named person's comment it is decided on, if any. */
interface Choice {
  run: Run;
  comment?: TicketComment;
}

/** Reduce an error to its first line. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/** Drives the planner of every project: chooses the run to decide, and starts its session. */
export class PlannerDriver {
  private readonly deps: PlannerDriverDeps;
  /** The session running for each project, by project name. */
  private readonly deciding = new Map<string, Promise<void>>();

  constructor(deps: PlannerDriverDeps) {
    this.deps = deps;
  }

  /**
   * Look at `project`'s runs that wait for the planner once, and start a
   * session for the one to decide next, unless one runs already. Returns one
   * line for what it could not do.
   */
  async tick(
    project: TicketingProject,
    config: ProjectConfig,
    cycle: PlannerDriverCycle,
  ): Promise<string[]> {
    const errors: string[] = [];
    const { store } = this.deps;
    // **A held run is asked again once what it waits for is gone** (D4):
    // no ticket it waits for is building or has an open pull request.
    for (const run of store.heldByPlanner(project.name)) {
      try {
        if (!(await this.stillWaits(run, cycle))) store.reaskPlanner(run.id);
      } catch (error) {
        errors.push(`${project.name}: the planner could not look at #${run.ticket}: ${oneLine(error)}`);
      }
    }
    if (this.deciding.has(project.name)) return errors;
    const choice = await this.choose(project, config, cycle, errors);
    if (choice === undefined) return errors;
    const { run, comment } = choice;
    try {
      const facts = await gatherPlannerFacts(
        { store, adapter: this.deps.adapter, project },
        run,
        cycle,
        comment,
      );
      if (comment !== undefined) {
        appendEntry(this.deps.root, project.name, run.ticket, {
          kind: "notice",
          at: this.deps.clock(),
          about: plannerReadComment(comment.createdAt),
        });
      }
      this.start(project.name, run, facts);
    } catch (error) {
      errors.push(`${project.name}: the planner could not look at #${run.ticket}: ${oneLine(error)}`);
    }
    return errors;
  }

  /**
   * The run to decide next. First a run that waits for the planner, or is
   * held, whose ticket has a named person's comment the planner has not
   * read (D5): that comment is what it is decided on. Otherwise the first
   * run that waits for the planner, by order. A run that cannot be looked
   * at is passed over, with a line in `errors`.
   *
   * **A ticket a person holds, or one over its spending limit, is not
   * decided.** A session costs money, and the hold says to wait for
   * someone. The label on a step ticket is the machine's own claim, put on
   * at pickup (ADR-0044 D7), and is not read as a hold, as the runner's
   * driver reads it.
   */
  private async choose(
    project: TicketingProject,
    config: ProjectConfig,
    cycle: PlannerDriverCycle,
    errors: string[],
  ): Promise<Choice | undefined> {
    const { store } = this.deps;
    const waiting = store.waitingForPlanner(project.name);
    let first: Run | undefined;
    for (const run of [...waiting, ...store.heldByPlanner(project.name)]) {
      try {
        const read = readRecord(this.deps.root, project.name, run.ticket);
        if (!read.ok) throw new Error(read.error.message);
        const ticket = await cycle.threads(run.ticket).ticket();
        if (ticket.labels.includes(HELD_LABEL) && !cycle.isStep(run.ticket)) continue;
        if (isOverLimit(read.value, ticketLimitOf(config))) continue;
        const comment = this.unreadComment(project, run, ticket.comments, read.value);
        if (comment !== undefined) return { run, comment };
        if (first === undefined && waiting.includes(run)) first = run;
      } catch (error) {
        errors.push(`${project.name}: the planner could not look at #${run.ticket}: ${oneLine(error)}`);
      }
    }
    return first === undefined ? undefined : { run: first };
  }

  /**
   * The oldest comment on `run`'s ticket that a named person wrote after the
   * planner was asked, or after it held the run, and that the planner has
   * neither read nor passed to the runner. Undefined when there is none.
   */
  private unreadComment(
    project: TicketingProject,
    run: Run,
    comments: readonly TicketComment[],
    entries: readonly RecordEntry[],
  ): TicketComment | undefined {
    const since = plannerSince(run);
    if (since === undefined) return undefined;
    const people = namedPeople(this.deps.manifest, project.name);
    return comments
      .filter(
        (comment) =>
          !comment.fromTimone &&
          isNamedPerson(people, comment.author) &&
          ms(comment.createdAt) > ms(since) &&
          !noticed(entries, plannerReadComment(comment.createdAt)) &&
          !noticed(entries, passedToRunner(comment.createdAt)),
      )
      .sort((one, other) => ms(one.createdAt) - ms(other.createdAt))[0];
  }

  /**
   * Whether a ticket held `run` waits for still has a build running or an
   * open pull request: a live run of it that the planner let build and that
   * has no pull request yet, or that is active at a stage that builds, or
   * whose pull request the cycle's reader shows open.
   */
  private async stillWaits(run: Run, cycle: PlannerDriverCycle): Promise<boolean> {
    const waitsFor = run.planner?.decision?.waitsFor ?? [];
    for (const other of this.deps.store.runsFor(run.project)) {
      if (!waitsFor.includes(other.ticket)) continue;
      if (other.status === "done" || other.status === "cancelled") continue;
      if (other.pr !== undefined) {
        const pull = await cycle.threads(other.ticket).pullRequest(other.pr);
        if (pull.state === "open") return true;
      }
      const letBuild = other.planner?.decision?.kind === "build" && other.pr === undefined;
      const active =
        other.status === "active" && other.stage !== undefined && BUILDING_STAGES.includes(other.stage);
      if (letBuild || active) return true;
    }
    return false;
  }

  /** Start the session for `run`, and keep it until it ends. */
  private start(project: string, run: Run, facts: PlannerFacts): void {
    const session = this.deps
      .decide(run, facts)
      .catch((error: unknown) => {
        this.deps.log(`planner ${run.id} — ${oneLine(error)}`);
      })
      .finally(() => this.deciding.delete(project));
    this.deciding.set(project, session);
  }

  /** Wait for every session started so far. For the tests, and for `--once`. */
  async drain(): Promise<void> {
    while (this.deciding.size > 0) await Promise.allSettled([...this.deciding.values()]);
  }
}
