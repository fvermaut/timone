/**
 * The check that stands in front of every question put to a person
 * ([ADR-0054](../../doc/adr/0054-an-ask-check-stands-in-front-of-every-question-put-to-a-person.md)).
 *
 * **What it is for.** `ivtrends` #90 was answered `aprrove`. The gate reader
 * matches five spellings and reads everything else as a change request, so a
 * typo became a rejection, the requirements stage was re-entered to redo work
 * that would come out identical, and the only move it had left was to ask for
 * a terminal session. The stage was not confused — it said on the ticket that
 * the reply looked like a yes with a letter out of place. It had nothing cheap
 * it was allowed to do.
 *
 * **What it may do, and the limits are the point.** Two outcomes: let the
 * composed message through untouched, or replace it with one short question.
 * It cannot close a gate, cannot move a run, and cannot decide that nobody
 * need be asked. Those limits hold **by construction and not by care**:
 * {@link AskCheckVerdict} has two members and no third, this module imports
 * nothing that writes a run or a gate, and {@link askCheck} is handed a string
 * and a way to ask a model — never a store, a ledger or an adapter. A future
 * edit that wants to make it decide has to widen the type first, which is a
 * visible act rather than a quiet one.
 *
 * **Every unclear case resolves to {@link AskCheckVerdict} `as-composed`.** A
 * model that cannot be reached, times out, or answers in a shape this does not
 * recognise leaves the message exactly as it was composed. The failure this
 * guards is a person not being asked something they needed to be asked, and
 * falling back to the message the machinery already wrote is the only
 * direction that cannot cause it.
 */

/**
 * What the check concluded.
 *
 * **There is deliberately no third member**, and in particular none meaning
 * *post nothing*. Suppressing an ask is deciding, and deciding is what
 * [ADR-0033](../../doc/adr/0033-a-stage-that-cannot-act-on-an-answer-escalates.md)
 * rejected: a gate passed that nobody passed, invisibly.
 */
export type AskCheckVerdict =
  | { kind: "as-composed" }
  | { kind: "ask-instead"; question: string };

/** Everything the check can see. It is given nothing it could write to. */
export interface AskCheckInput {
  /** The message about to be posted to a person, exactly as composed. */
  composed: string;
  /**
   * The last thing the person wrote, when they have written since they were
   * asked. Absent at a stop nobody has replied to — the check still runs,
   * because a message can be too expensive without anyone having answered it.
   */
  lastWords?: string;
}

/** The one thing this module needs from the outside world. */
export interface AskCheckDeps {
  /**
   * Put the prompt to a model and hand back what it said, or `undefined` when
   * it could not be asked at all. Never throws: a check that can fail the
   * cycle it runs in is worse than no check.
   */
  consult(prompt: string): Promise<string | undefined>;
}

/**
 * What the check remembers between cycles, kept on the run.
 *
 * **A call to action is rewritten every cycle, not appended** — `upsertComment`
 * on the adapter, because what a ticket needs is a standing fact and appending
 * it would be one comment a minute. A check that consulted a model on every
 * one of those passes would be expensive, and worse, would word its question
 * differently each time and so edit the comment for ever. So the question is
 * asked once and remembered.
 */
export interface AskCheckMemory {
  /** The composed message the question stood in front of. */
  for: string;
  /** What was asked, as it was posted. */
  question: string;
  /** When it was asked. */
  askedAt: string;
  /** Whether the answer to it has already been acted on. */
  actedOn?: boolean;
}

/** What to do this cycle, decided before any model is consulted. */
export type AskCheckPlan =
  | { kind: "consult" }
  | { kind: "reuse"; question: string }
  | { kind: "as-composed" };

/**
 * Decide whether the check may run, reuse what it asked, or stand aside —
 * without consulting anything.
 *
 * This is where the one-question budget lives (ADR-0054 D4), and it is a rule
 * in code rather than an instruction to a model, because a budget a model is
 * merely asked to respect is not a budget.
 *
 * - The question was answered and the answer acted on: the check is finished
 *   with this ask for good, whatever the message says now.
 * - Nothing remembered, or remembered against a **different** message: this is
 *   an ask the check has not stood in front of, so it may consult.
 * - Remembered against this message, and the person has said nothing since:
 *   reuse the very words already on the ticket, so the cycle changes nothing.
 * - Remembered against this message, and the person **has** answered since:
 *   the question is spent. The message the machinery composed is posted as it
 *   stands, and the check does not get a second try at the same ask.
 */
export function planAskCheck(
  composed: string,
  memory: AskCheckMemory | undefined,
  lastHumanWordsAt: string | undefined,
): AskCheckPlan {
  if (memory?.actedOn === true) return { kind: "as-composed" };
  if (memory === undefined || memory.for !== composed) return { kind: "consult" };

  const answered =
    lastHumanWordsAt !== undefined &&
    Date.parse(lastHumanWordsAt) > Date.parse(memory.askedAt);

  return answered ? { kind: "as-composed" } : { kind: "reuse", question: memory.question };
}

/**
 * The longest question the check may post. A question past this is not a short
 * question, so it fails what it was for, and the composed message goes instead.
 */
export const LONGEST_QUESTION = 900;

/** What the model is told. */
export function askCheckPrompt(input: AskCheckInput): string {
  return [
    "A machine is about to post the message below to a person. Your only job",
    "is to decide whether that message is more expensive than it needs to be.",
    "",
    "--- the message about to be posted ---",
    input.composed,
    "--- end of the message ---",
    ...(input.lastWords === undefined
      ? []
      : [
          "",
          "--- the last thing the person wrote ---",
          input.lastWords,
          "--- end of what they wrote ---",
        ]),
    "",
    "Answer with one of exactly two things, and nothing else.",
    "",
    "1. `LET IT THROUGH` — the message is the right thing to send. This is the",
    "   right answer whenever you are unsure. It is also the right answer when",
    "   the message is asking for a real decision that only the person can make.",
    "",
    "2. `ASK: <question>` — a short question would settle this instead, and",
    "   sending the composed message would cost the person far more than the",
    "   matter is worth. The clearest case: they replied with something that is",
    "   plainly a misspelling of a word the machine was waiting for, and the",
    "   machine is about to send them somewhere else because of it.",
    "",
    "Rules for a question you write:",
    "",
    "- Quote back what they actually wrote, so they can see what was read.",
    "- Say exactly what to reply to carry on, and make it one word where a",
    "  single word will do.",
    "- Say what to do instead if that is not what they meant.",
    "- Short sentences, common words, no comparisons, and nothing that only",
    "  means something to someone who has read this machine's documentation.",
    "- A few sentences at most.",
    "",
    "You are not deciding anything. You cannot approve, reject, or move any",
    "work. The person's answer to your question is read by the ordinary",
    "machinery exactly as any other answer is.",
  ].join("\n");
}

/**
 * Run the check.
 *
 * The parse is strict on purpose: `LET IT THROUGH` is the only accepted way to
 * say *leave it alone*, and `ASK:` the only accepted way to say *ask this*.
 * Everything else — prose around the answer, a refusal, an empty reply, a
 * model that could not be reached — is read as `as-composed`, so the fallback
 * is the same for a failure as for a deliberate stand-aside.
 */
export async function askCheck(
  input: AskCheckInput,
  deps: AskCheckDeps,
): Promise<AskCheckVerdict> {
  const said = await deps.consult(askCheckPrompt(input));
  if (said === undefined) return { kind: "as-composed" };

  return readAskCheckAnswer(said);
}

/** What the model said, read into a verdict. Exported for its tests. */
export function readAskCheckAnswer(said: string): AskCheckVerdict {
  const answer = said.trim();
  const asked = /^ASK:\s*([\s\S]+)$/.exec(answer);
  if (asked === null) return { kind: "as-composed" };

  const question = asked[1].trim();
  if (question === "" || question.length > LONGEST_QUESTION) {
    return { kind: "as-composed" };
  }

  return { kind: "ask-instead", question };
}
