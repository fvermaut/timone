import type { Fact } from "../runner/facts.js";
import type { OtherTicket, PlanFact, PlannerFacts } from "./facts.js";

/**
 * The planner's brief: its rules, and the facts for the one ticket it
 * decides
 * ([ADR-0065](../../doc/adr/0065-the-planner-is-a-session-of-its-own-asked-when-a-build-would-start.md)
 * D3).
 *
 * **The planner reads code through nothing.** It is told the files each plan
 * names and the files each open pull request changes, and it may read a plan
 * in full. What is not written here does not exist for it.
 */

/**
 * What the planner is told when a ticket's plan cannot be read, as one
 * sentence: a fact, with the reason, never an error.
 */
export function planNotRead(ticket: number, why: string): string {
  return `The plan of #${ticket} could not be read: ${why.trim().replace(/\.$/, "")}.`;
}

/** The planner's rules, the same for every ticket. */
const SYSTEM = [
  "You are the planner. Timone is a machine that does software work on tickets. You decide for one ticket whether it may be built now, or must wait. You do not build anything yourself.",
  "",
  "## How you decide",
  "",
  "- Compare the files the ticket's plan names with the files of each ticket that is building or has an open pull request. For an open pull request, you are also shown the files it changes.",
  "- When the overlap is small, the ticket may be built at once. When it is large, the ticket waits. You judge which. It is not a count of files: one shared file can change in the same lines, and ten shared files can each get one new line.",
  "- A ticket that needs another ticket's work waits for it, while that work is not merged. Its plan may say so: read it with read_plan when the lists of files are not enough.",
  "- When a named person's comment woke you and it says to build now, let the ticket build with let_build, and give the time of the comment as commentAt, exactly as shown.",
  "- When that comment is about something else, pass it to the runner with pass_to_runner. The runner is the agent that does the rest of the work on the ticket.",
  "- With hold, name the tickets this ticket waits for. Only tickets you were shown as building, with an open pull request, or blocking this ticket can be named.",
  "- Call exactly one of let_build, hold and pass_to_runner, once.",
  "",
  "## Writing the reason",
  "",
  "- Write the reason for a person who does not know how Timone works, and who may not read English as a first language. A hold's reason is posted on the ticket.",
  "- One or two short sentences. Common words. No metaphors, no comparisons.",
  "- Name files by their path.",
].join("\n");

/** Build the planner's brief for one ticket. Pure: the same facts give the same text. */
export function buildPlannerBrief(facts: PlannerFacts): { system: string; prompt: string } {
  return {
    system: SYSTEM,
    prompt: [
      ticketSection(facts),
      blockersSection(facts),
      othersSection(facts),
      commentSection(facts),
    ].join("\n\n"),
  };
}

/** The ticket being decided, and its plan. */
function ticketSection(facts: PlannerFacts): string {
  const { ticket } = facts;
  return [
    "## The ticket you decide for",
    "",
    `${facts.project} #${ticket.number}: ${ticket.title}`,
    `Labels: ${ticket.labels.length === 0 ? "none" : ticket.labels.join(", ")}`,
    ...planLines(ticket.number, ticket.plan),
  ].join("\n");
}

/** The tickets this one is blocked by, as the survey of its initiative found them. */
function blockersSection(facts: PlannerFacts): string {
  return [
    "## What this ticket is blocked by",
    "",
    ...(facts.blockers.length === 0
      ? ["Nothing that is known."]
      : facts.blockers.map(
          (blocker) => `- #${blocker.number}, ${blocker.open ? "open" : "closed"} (${blocker.url})`,
        )),
  ].join("\n");
}

/** Every other ticket of the project that is building or has an open pull request. */
function othersSection(facts: PlannerFacts): string {
  return [
    "## Tickets building or with an open pull request",
    "",
    ...(facts.others.length === 0 ? ["None."] : facts.others.flatMap(otherLines)),
  ].join("\n");
}

/** One other ticket: why it counts, its plan, and the files its pull request changes. */
function otherLines(other: OtherTicket): string[] {
  const { state } = other;
  const head =
    state.kind === "building"
      ? `- #${other.number}: ${other.title}. It is building.`
      : `- #${other.number}: ${other.title}. Its pull request #${state.pr} is open.`;
  const changed =
    state.kind === "building"
      ? []
      : [factLine(`Files pull request #${state.pr} changes`, state.files, listOrNone)];
  return [head, ...[...planLines(other.number, other.plan), ...changed].map((line) => `  ${line}`)];
}

/** A plan as the brief writes it: its path and title, and the files it names. */
function planLines(ticket: number, plan: PlanFact): string[] {
  if (plan.kind === "unknown") return [planNotRead(ticket, plan.why)];
  if (plan.value === undefined) return ["Plan: none yet."];
  const { path, title, files } = plan.value;
  return [
    `Plan: ${path}${title === undefined ? "" : ` (${title})`}`,
    `Files its plan names: ${listOrNone(files)}`,
  ];
}

/** The named person's comment that woke the planner, in their words. */
function commentSection(facts: PlannerFacts): string {
  const { comment } = facts;
  return [
    "## The comment that woke you",
    "",
    ...(comment === undefined
      ? ["No comment woke you."]
      : [`${comment.author} wrote at ${comment.createdAt}:`, "", quoted(comment.body)]),
  ].join("\n");
}

/** One line of facts: the value written by `write`, or unknown and why. */
function factLine<T>(label: string, fact: Fact<T>, write: (value: T) => string): string {
  return fact.kind === "known" ? `${label}: ${write(fact.value)}` : `${label}: unknown (${fact.why})`;
}

/** `items` joined on one line, or "none". */
function listOrNone(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.join(", ");
}

/** `text` as a Markdown quote, so where a comment ends is never in doubt. */
function quoted(text: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");
}
