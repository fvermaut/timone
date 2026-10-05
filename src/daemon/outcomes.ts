import { NEEDED_FROM_YOU } from "../adapters/ticketing.js";

// ✏ 2026-09-30: the readers of a stage's outcome and of a handback note went
// with the old spawner, their last caller. The runner reads what a stage
// asked for through `askedFor`.

/**
 * The longest ask this will carry onto a run. Past it, what the stage wrote
 * is a paragraph rather than a line, and the wait it would become is shown on
 * one line of `timone status` — so the wait the run already had, or the
 * runner's default words, is the honest thing to say instead.
 */
export const LONGEST_ASK = 300;

/**
 * What a stage's closing comment asked the person for, taken from the line
 * every Timone message ends on ([timone#144](https://github.com/fvermaut/timone/issues/144)).
 *
 * **Read from the stage's own words, never composed here.** The fault this
 * closes is a wait written without looking at the comment it waits on: on
 * `ivtrends` #111 the planning stage handed back saying it needed nothing,
 * and the run parked on *"your answer to the question in my last comment"* —
 * so the ticket's standing note sent a person to a question that was never
 * asked. Reading the line means the wait and the comment cannot disagree:
 * either the stage asked something and that is what the ticket waits on, or
 * it asked nothing and this returns undefined, which is a visible fault in
 * the stage rather than an invisible one in the wait.
 *
 * **The last one, when there are several.** Every Timone comment ends on this
 * line, and a stage quoting an earlier message would otherwise have the quote
 * read as its own ask.
 */
export function askedFor(body: string): string | undefined {
  const at = body.lastIndexOf(NEEDED_FROM_YOU);
  if (at === -1) return undefined;

  const asked = body.slice(at + NEEDED_FROM_YOU.length).split("\n")[0]?.trim();
  if (asked === undefined || asked === "" || asked.length > LONGEST_ASK) {
    return undefined;
  }

  return asked;
}

/**
 * Whether a message asks the person something: the text after its last
 * `**What I need from you:**`, to the end of that line, is not empty and
 * does not start with "nothing" (PRD-09).
 *
 * ✏ 2026-10-05 (PRD-09): a question names the takeover command, and this is
 * how code tells a question from a message that asks for nothing. Unlike
 * `askedFor` it has no length limit: a long ask is still a question.
 */
export function isQuestion(body: string): boolean {
  const at = body.lastIndexOf(NEEDED_FROM_YOU);
  if (at === -1) return false;
  const asked = (body.slice(at + NEEDED_FROM_YOU.length).split("\n")[0] ?? "").trim();
  return asked !== "" && !/^nothing/i.test(asked);
}
