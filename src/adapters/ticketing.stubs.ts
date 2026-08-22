import type {
  MergeOutcome,
  RepositoryBranches,
  Step,
  TicketingProject,
} from "./ticketing.js";

/**
 * The ticketing writes that open an initiative's step tickets, stubbed for
 * tests whose subject is not them.
 *
 * Its own module rather than a constant in one test file because seven files
 * hand-roll a {@link TicketingAdapter}, and a port that grows a method should
 * cost one edit here instead of eleven scattered ones — which is the churn
 * 29b paid before this existed.
 *
 * **Every member throws.** A silent no-op would let a test that *should* have
 * opened a step pass while opening none, and the whole subject of 29c is that
 * creating tickets is loud, external and not undone by re-running.
 */
export const noStepWrites = {
  async createStep(): Promise<number> {
    throw new Error("no test here opens a step ticket");
  },
  async blockStep(): Promise<void> {
    throw new Error("no test here declares a dependency");
  },
  async setTicketBody(): Promise<void> {
    throw new Error("no test here rewrites a ticket body");
  },
  async ensureLabel(): Promise<void> {
    throw new Error("no test here creates a label");
  },
};

/**
 * The step listing for fakes whose test is not about it: no initiative here
 * has been broken into step tickets, so there are none to list.
 */
export const noSteps = {
  async listSteps(_project: TicketingProject, _initiative: number): Promise<Step[]> {
    return [];
  },
};

/**
 * Branch state for fakes whose test is not about it: a repository whose
 * default branch carries no commits and whose work branch does not exist.
 *
 * **It answers rather than throwing, unlike {@link noStepWrites}, and the
 * difference is not laziness.** "There is no such branch" is a legitimate
 * answer and the one every test here used to get: before phase 30 the default
 * probe ran `git rev-parse` in a directory that was no repository, found
 * nothing, and said so. Keeping that silence is what lets a test about
 * something else stay about something else.
 *
 * A test whose subject *is* branch state overrides this — see the
 * `repoProbe` and `headProbe` seams, and the fakes that implement
 * `readBranches` themselves.
 */
export const noBranches = {
  async readBranches(): Promise<RepositoryBranches> {
    return { defaultBranch: "main" };
  },
};

/**
 * The merge that puts chunk zero on the default branch, stubbed for tests
 * whose subject is not it.
 *
 * **It throws**, like {@link noStepWrites} and unlike {@link noBranches}. A
 * silent no-op would let a test that should have merged pass while merging
 * nothing, and this is the one path in the system that reaches a default
 * branch with no human having read a diff — the last place to be quiet about
 * a call nobody meant to make.
 */
export const noMerges = {
  async mergeIntoDefault(): Promise<MergeOutcome> {
    throw new Error("no test here merges chunk zero");
  },
};
