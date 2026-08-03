import type { TicketingProject } from "../adapters/ticketing.js";
import { APPROVAL_TOKENS } from "./gates.js";
import type { PipelineStage } from "./pipeline.js";

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

/**
 * The web address of `path` on `branch`, derived from the clone URL.
 *
 * GitHub-shaped, because GitHub is the only ticketing binding that exists
 * (ADR-0004) and a gate comment has to link somewhere a person can click. A
 * clone URL that is not GitHub-shaped yields undefined, and the gate comment
 * simply names the branch instead of guessing at a URL.
 */
export function branchUrl(
  project: TicketingProject,
  branch: string,
  path: string,
): string | undefined {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)(.+?)(?:\.git)?$/.exec(
    project.repoUrl.trim(),
  );
  if (match === null) return undefined;
  return `https://github.com/${match[1]}/tree/${branch}/${path}`;
}

/** What each gated stage puts in front of the human, and what follows it. */
const GATED: Partial<
  Record<PipelineStage, { headline: string; where: string; label: string; onApproval: string }>
> = {
  requirements: {
    headline: "I've written down what I think you're asking for.",
    where: "doc/specs/prd",
    label: "what I understood you're asking for",
    onApproval: "work out how to build it and come back with a plan.",
  },
};

/**
 * The gate comment for a stage, or undefined for a stage with no gate.
 *
 * The daemon posts this, not the session that did the work: the CTA has to
 * match what {@link readGateDecision} accepts, exactly, every time. A session
 * asked to write its own approval request would eventually word it in a way
 * the parser does not recognise, and the human would be answering a question
 * nobody was listening to.
 */
export function gateCommentFor(
  stage: PipelineStage,
  project: TicketingProject,
  branch: string,
  summary: string[],
): string | undefined {
  const spec = GATED[stage];
  if (spec === undefined) return undefined;

  const url = branchUrl(project, branch, spec.where);

  return gateComment({
    headline: spec.headline,
    summary: [
      ...summary,
      ...(url === undefined
        ? [`It's committed on the branch \`${branch}\`, under \`${spec.where}\`.`]
        : []),
    ],
    artifacts: url === undefined ? [] : [{ label: spec.label, url }],
    onApproval: spec.onApproval,
  });
}
