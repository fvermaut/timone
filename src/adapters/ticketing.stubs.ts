import type { Step, TicketingProject } from "./ticketing.js";

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
