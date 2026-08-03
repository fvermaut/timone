import { APPROVAL_TOKENS } from "./gates.js";

/** The literal word the CTA asks for — the parser's first token, never a copy. */
export const APPROVAL_WORD = APPROVAL_TOKENS[0];

/** Something committed and pushed that the human can go and read. */
export interface GateArtifact {
  /** What it is, in the human's terms — not a filename if a phrase will do. */
  label: string;
  /** Where to read it. Must be reachable: a gate on an unpushed file is a dead end. */
  url: string;
}

export interface GateCommentInput {
  /** One line, bolded at the top: what just happened. */
  headline: string;
  /** The substance, in plain sentences. Written for someone new to all this. */
  summary: string[];
  /** What they are being asked to read before answering. */
  artifacts: GateArtifact[];
  /** What approving causes, in the human's terms — no stage or skill names. */
  onApproval: string;
}

/**
 * Build a gate comment: what happened, what to read, and a closing CTA that
 * names the literal word to reply with.
 *
 * The CTA states both halves of the rule the reader is actually subject to —
 * that one word approves, and that *anything else* is read as a change. That
 * is not a courtesy: {@link readGateDecision} judges replies by shape, so a
 * human who does not know the shape can be surprised by their own gate.
 *
 * No machine marker here. The ticketing adapter stamps everything it posts,
 * so a builder that added one would either double it or invite callers to
 * remember something they should not have to.
 */
export function gateComment(input: GateCommentInput): string {
  const lines = [`**${input.headline}**`, "", ...input.summary];

  if (input.artifacts.length > 0) {
    lines.push(
      "",
      input.artifacts.length === 1 ? "Here it is:" : "Here they are:",
      ...input.artifacts.map(
        (artifact) => `- [${artifact.label}](${artifact.url})`,
      ),
    );
  }

  lines.push(
    "",
    "**What I need from you:** read it and reply on this ticket.",
    "",
    `- If it's right, reply with the single word \`${APPROVAL_WORD}\` — ${input.onApproval}`,
    "- If anything is wrong or missing, reply saying what you want different." +
      ` Anything that isn't \`${APPROVAL_WORD}\` I read as a change, and I'll` +
      " do this step again with your words in hand.",
  );

  return lines.join("\n");
}
