import { describe, expect, it } from "vitest";

import {
  MACHINE_MARKER,
  NEEDED_FROM_YOU,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import {
  parseBreakdown,
  renderBreakdown,
  type ParsedBreakdown,
} from "./breakdown.js";
import { stageLabel } from "./pipeline.js";
import {
  PROMPTED_STAGES,
  approvalRecordPrompt,
  stagePrompt,
  takeoverPrompt,
  workBranch,
  type PromptContext,
  type TakeoverFacts,
  type TakeoverRun,
} from "./prompts.js";

const project: TicketingProject = {
  name: "scratch-app",
  repoUrl: "https://github.com/fvermaut/scratch-app.git",
};

const ticket: TicketThread = {
  number: 6,
  title: "typing in the box is fiddly on my phone",
  body: "the message box is hard to use on mobile. i keep losing what i typed.",
  labels: ["timone", "triage:feature"],
  url: "https://github.com/fvermaut/scratch-app/issues/6",
  author: "fvermaut",
  createdAt: "2026-08-03T09:00:00Z",
  comments: [
    {
      author: "fvermaut",
      body: "Picked this up.",
      createdAt: "2026-08-03T09:05:00Z",
      fromTimone: true,
    },
    {
      author: "fvermaut",
      body: "it's worse in landscape",
      createdAt: "2026-08-03T09:10:00Z",
      fromTimone: false,
    },
  ],
};

const context: PromptContext = { project, ticket, classification: "feature" };

/**
 * The stages whose prompt carries the ticket and its thread. Every prompted
 * stage except verification, whose independence is exactly the absence of
 * that context — asserted in its own block below.
 */
const THREADED_STAGES = PROMPTED_STAGES.filter(
  (stage) => stage !== "verification",
);

/**
 * The rules that hold for every prompt, whichever stage it belongs to. New
 * stages inherit them by existing, which is the point of listing the prompts
 * rather than the tests.
 */
describe("every stage prompt", () => {
  it.each(THREADED_STAGES)("%s carries the ticket in the words it was written in", (stage) => {
    const prompt = stagePrompt(stage, context);
    expect(prompt).toContain(ticket.body);
    expect(prompt).toContain(ticket.title);
  });

  it.each(THREADED_STAGES)("%s separates the voices in the thread", (stage) => {
    // Timone posts under the human's account, so the login cannot tell them
    // apart and the prompt has to.
    const prompt = stagePrompt(stage, context);
    expect(prompt).toMatch(/Timone \(you\), earlier/);
    expect(prompt).toMatch(/fvermaut \(a person\)/);
    expect(prompt).toContain("it's worse in landscape");
  });

  it.each(PROMPTED_STAGES)("%s tells the session to stamp what it posts", (stage) => {
    expect(stagePrompt(stage, context)).toContain(MACHINE_MARKER);
  });

  it.each(PROMPTED_STAGES)("%s names the one project it may touch", (stage) => {
    expect(stagePrompt(stage, context)).toContain("projects/scratch-app/");
  });

  it.each(PROMPTED_STAGES)("%s says which repository its git commands act on", (stage) => {
    // Finding 11 of phase 20's gate: a session sits at the timone root
    // (ADR-0007) and is told to "work on the branch X" with no repository
    // named, so a bare `git checkout -b` cuts the branch in the harness repo.
    // Naming the branch without naming the checkout is the whole defect.
    const prompt = stagePrompt(stage, context);

    expect(prompt).toContain("git -C projects/scratch-app");
    expect(prompt).toMatch(/timone's own repository/i);
  });

  it.each(PROMPTED_STAGES)("%s rebuilds from the artifacts and the thread alone", (stage) => {
    // ADR-0013: every human wait is a session boundary, so a resuming
    // session is handed a router and not a memory.
    expect(stagePrompt(stage, context)).toMatch(/nothing was carried over/i);
  });

  it.each(PROMPTED_STAGES)("%s writes back for someone new to all this", (stage) => {
    expect(stagePrompt(stage, context)).toMatch(/knows nothing about/i);
  });
});

/**
 * The marker lines a step was once told to write, as they were written. The
 * runner reads a step's plain comment, not a marker, so no step is told to
 * write one any more. Written out here rather than imported: most of their
 * constants were deleted with the last code that read them (41g).
 */
const RETIRED_MARKERS = [
  "✅ **Agreed** · the record of a conversation, accepted by the human",
  "❓ **Still open** · written by the machine when a written answer left something unsettled",
  "🏁 **Step finished** · written by the machine when a stage completed its work",
  "🙋 **Needs a person** · written by the machine when a stage stopped and is asking for help",
  "🆘 **Needs more than a reply** · written by the machine when a stage cannot act on the answer it was given",
  "🔁 **Picking it back up** · written by the machine when a stop has been cleared and the work goes on without you",
  "Carrying on at:",
  "📌 **Where this stands** · what this ticket needs right now, kept up to date by the machine",
];

describe("what a step is told matches the runner (41g)", () => {
  it.each(PROMPTED_STAGES)("%s is told to write none of the retired marker lines", (stage) => {
    const prompt = stagePrompt(stage, { ...context, branch: "timone/6-typing-in-the-box" });

    for (const marker of RETIRED_MARKERS) {
      expect(prompt, `${stage} still carries: ${marker}`).not.toContain(marker);
    }
  });

  it.each(PROMPTED_STAGES)("%s is still told to end with the line `askedFor` reads", (stage) => {
    // `askedFor` takes what a step asked for from the line that starts with
    // NEEDED_FROM_YOU, and the runner's wait and `timone status` say those
    // words. A step never told the exact words writes something close, and
    // then the ticket waits on nothing anyone asked.
    const prompt = stagePrompt(stage, { ...context, branch: "timone/6-typing-in-the-box" });

    expect(prompt).toContain(`End every message to them with one line that starts with ${NEEDED_FROM_YOU}`);
  });
});

describe("the triage prompt", () => {
  it("does not tell the session what kind of request it is", () => {
    // Working that out from the raw text is the entire job of the stage.
    const prompt = stagePrompt("triage", { project, ticket });

    expect(prompt).toMatch(/has not been classified/i);
    expect(prompt).not.toMatch(/this is a feature/i);
  });

  it("asks for the classification to be recorded where the process wants it", () => {
    expect(stagePrompt("triage", { project, ticket })).toContain("triage:<kind>");
  });

  it("tells the session to read the project's documents before deciding", () => {
    // ADR-0036 D2. This is what stage 9 used to do, and deleting that stage
    // without this leaves nothing in the process that ever opens the register.
    const prompt = stagePrompt("triage", { project, ticket });

    expect(prompt).toMatch(/criteria register/i);
    expect(prompt).toMatch(/before you decide/i);
  });

  it("carries the three definitions a classification now turns on", () => {
    // D3. A complaint about a promise nobody made is a feature, a wrong
    // document is a chore, and only a break from a written promise is a bug.
    const prompt = stagePrompt("triage", { project, ticket });

    expect(prompt).toMatch(/no criterion promises it/i);
    expect(prompt).toMatch(/cannot name one, it is not a bug/i);
    expect(prompt).toMatch(/committed document is/i);
  });

  it("expects a bug report to turn out to be something else, and says so", () => {
    // The failure this replaces: scratch-app #4 was called a bug in August on
    // a misreading of the register, and nothing revisited it for 17 days.
    const prompt = stagePrompt("triage", { project, ticket });

    expect(prompt).toMatch(/filed as a bug and turns out to be a feature/i);
    expect(prompt).toMatch(/contradicts an earlier comment/i);
  });

  it("does not send the session past its own stage", () => {
    expect(stagePrompt("triage", { project, ticket })).toMatch(
      /do not act on it beyond classifying/i,
    );
  });
});

describe("the clarification prompt", () => {
  const prompt = stagePrompt("clarification", context);

  it("carries what triage decided, so the interview does not start from nothing", () => {
    expect(prompt).toContain("feature");
  });

  it("supposes no answer to the questions it exists to ask", () => {
    expect(prompt).not.toMatch(/the problem is|they want|you should build/i);
  });

  it("requires an accepted summary before it posts one as agreed", () => {
    // ✏ 2026-09-30: no marker line under it. The runner reads the summary
    // itself.
    expect(prompt).toMatch(/accept/i);
    expect(prompt).toMatch(/record of what was agreed/i);
  });

  it("forbids treating the conversation itself as a record", () => {
    expect(prompt).toMatch(/not a process artifact/i);
  });

  it("says plainly what to do when the human leaves without accepting", () => {
    expect(prompt).toMatch(/without accepting/i);
  });

  it("forbids asking the human to name a stage or a skill", () => {
    expect(prompt).toMatch(/never ask them to name a stage/i);
  });
});

describe("the wayfinding prompt", () => {
  const prompt = stagePrompt("wayfinding", context);

  it("is a step the runner can start a session for", () => {
    // ✏ 2026-09-30: `isPrompted` reads this list, and the runner refuses to
    // start a step that is not on it. A takeover no longer uses a step's
    // prompt at all.
    expect(PROMPTED_STAGES).toContain("wayfinding");
  });

  it("sends the session to this one ticket on its map", () => {
    expect(prompt).toContain("timone-wayfind");
    expect(prompt).toMatch(/one ticket per session/i);
  });

  it("resolves the ticket rather than writing the destination artifact", () => {
    // ADR-0010: the map produces decisions, and the destination is the whole
    // effort's to hand over once it closes. One answer is not a PRD.
    expect(prompt).toMatch(/close/i);
    expect(prompt).toMatch(/not.*(write|requirements)/i);
  });

  it("supposes no answer to the question the ticket exists to ask", () => {
    expect(prompt).not.toMatch(/the problem is|they want|you should build/i);
  });
});

describe("a conversation prompt, with nobody at the keyboard", () => {
  const CONVERSATION_STAGES = ["clarification", "wayfinding"] as const;

  it.each(CONVERSATION_STAGES)(
    "%s does not claim anyone is at the keyboard, or that a written answer started it",
    (stage) => {
      // The runner starts this step, and nothing it says reaches them except
      // as a comment. ✏ 2026-09-30: the reason it used to give — they
      // answered in writing — was the old code's, and is gone with it.
      const prompt = stagePrompt(stage, context);

      expect(prompt).not.toMatch(/at the keyboard/i);
      expect(prompt).not.toMatch(/because they answered/i);
      expect(prompt).toMatch(/posted as a comment on the ticket/i);
    },
  );
});

describe("the planning prompt", () => {
  const prompt = stagePrompt("planning", {
    ...context,
    branch: "timone/6-typing-in-the-box",
  });

  it("writes the phase file as an artifact, and nothing waits on it", () => {
    // ✏ ADR-0030 D1: `planning` stopped gating. What the human approved is the
    // list of pieces; this is the plan for one of them. Asserted as an absence
    // because the failure it guards is a prompt that still stamps a file for an
    // approval nobody will ever be asked for — the run would not park, it would
    // build against a file claiming it was not allowed to be built.
    expect(prompt).not.toMatch(/awaiting approval/i);
    expect(prompt).not.toMatch(/approval request|ask them to approve/i);
  });

  it("still commits the phase file and pushes it", () => {
    // The other half, in the same block: a plan that is committed and not
    // pushed is one the session that builds it cannot read, and this is the
    // stage where dropping the push would look like tidying.
    expect(prompt).toMatch(/commit the phase file/i);
    expect(prompt).toMatch(/push it/i);
  });

  it("asks for the closing comment the runner reads", () => {
    // Found live on 2026-08-15, twice, on scratch-app #31: `planning` had been
    // gated until that morning, never carried the block that asks for a
    // closing comment, and its run failed for want of one. ✏ 2026-09-30: the
    // comment no longer opens on a marker line; the runner reads it as it is.
    expect(prompt).toMatch(/exactly one comment on the ticket/i);
    expect(prompt).toMatch(/the runner reads this comment/i);
  });

  it("still asks the human for nothing", () => {
    // The instruction that used to live in the comment paragraph moved inside
    // the outcome block; it must survive the move, because this is the whole
    // of what ADR-0030 D1 bought — a piece already agreed when the list was.
    expect(prompt).toMatch(/ask them for nothing/i);
  });

  // timone#144. `ivtrends` #111: the stage posted the handed line and closed
  // on "What I need from you: nothing right now". It stopped the work and
  // asked for nothing, and the ticket sat still.
  it("requires a question on the ending that stops for a person", () => {
    expect(prompt).toMatch(/must end on one question/i);
    expect(prompt).toMatch(/What I need from you: nothing/);
  });

  // The other half of the same stop: the ticket it was stopping on had been
  // opened to ask for the very change it wanted permission for.
  it("says a ticket asking for the change is the permission to make it", () => {
    expect(prompt).toMatch(/before you stop at all, read the ticket/i);
  });
});

describe("the execution prompt", () => {
  const prompt = stagePrompt("execution", {
    ...context,
    branch: "timone/6-typing-in-the-box",
  });

  it("stays on the run's branch and never cuts a new one", () => {
    expect(prompt).toContain("timone/6-typing-in-the-box");
    expect(prompt).toMatch(/never a new one/i);
  });

  it("does not make the phase file's stamp the permission to build, but still flips it at the close", () => {
    // ✏ ADR-0030 D1: what was agreed is the list of pieces, not the phase file,
    // so nothing here may refuse to build over a `Status:` line — every chunk's
    // phase file is unstamped by construction and execution would refuse all of
    // them. **Both halves are asserted in one test on purpose**: they live four
    // lines apart in the prompt, and the closing flip is the `Status:` line the
    // runner is shown for the branch's phase file. Delete it with the entry
    // gate and every built chunk looks unfinished, silently.
    expect(prompt).not.toMatch(/authority on whether you may/i);
    expect(prompt).not.toContain("Approved for execution");
    expect(prompt).toContain("Complete — see <report>");
  });

  it("asks for exactly one closing comment", () => {
    expect(prompt).toMatch(/exactly one comment/i);
  });
});

describe("the verification prompt", () => {
  const prompt = stagePrompt("verification", {
    ...context,
    branch: "timone/6-typing-in-the-box",
  });

  it("withholds the ticket's text and its thread — independence by construction", () => {
    // Stage 7 checks behaviour from a context that did not watch the build.
    // The thread holds execution's own account of what it built, and the
    // ticket's prose holds the request in the reporter's framing; the
    // register is the only authority on expected behaviour, so the prompt
    // hands over neither.
    expect(prompt).not.toContain(ticket.body);
    expect(prompt).not.toContain(ticket.title);
    expect(prompt).not.toContain("it's worse in landscape");
    expect(prompt).not.toMatch(/Timone \(you\), earlier/);
  });

  it("still names the project, the ticket number and the branch", () => {
    expect(prompt).toContain("projects/scratch-app/");
    expect(prompt).toContain("#6");
    expect(prompt).toContain("timone/6-typing-in-the-box");
  });

  it("says why the context is empty, so the session does not go looking", () => {
    expect(prompt).toMatch(/did not watch the build/i);
  });
});

describe("the delivery prompt", () => {
  const prompt = stagePrompt("delivery", {
    ...context,
    branch: "timone/6-typing-in-the-box",
  });

  it("opens the pull request from the run's branch, referencing the ticket", () => {
    expect(prompt).toContain("timone/6-typing-in-the-box");
    expect(prompt).toMatch(/pull request/i);
    expect(prompt).toContain("#6");
  });

  it("requires the cross-links both ways", () => {
    // R7: the PR references the ticket, and the ticket links the PR.
    expect(prompt).toMatch(/ticket.*links|link.*on the ticket/i);
  });

  it("never merges the pull request — that stays a human act", () => {
    // Narrowed rather than dropped (ADR-0030 D2): the daemon now merges chunk
    // zero itself, once, so a blanket "never merge" would be a rule the
    // machine breaks. The instruction keeps its whole force for the thing it
    // was written about — the pull request this session just opened.
    expect(prompt).toMatch(/never merge (the |this )?pull request/i);
    expect(prompt).toMatch(/merging (it )?is (the human's|yours)/i);
  });
});

describe("the remediation prompt", () => {
  const prompt = stagePrompt("remediation", {
    ...context,
    branch: "timone/6-typing-in-the-box",
  });

  it("takes the review comment on the pull request as the defect brief", () => {
    // ✏ 2026-09-30: the comment is no longer carried in the prompt. The
    // runner says in its instructions which comment to act on.
    expect(prompt).toMatch(/review comment on the pull request is your instruction/i);
    expect(prompt).toMatch(/runner's instructions/i);
  });

  it("commits with the review-fix convention on the same branch", () => {
    expect(prompt).toContain("fix: review");
    expect(prompt).toContain("timone/6-typing-in-the-box");
  });

  it("draws the ADR-0016 boundary: requirement-moving comments are not fixes", () => {
    expect(prompt).toMatch(/criteria register|PRD/);
    expect(prompt).toMatch(/reply|ask/i);
  });

  // ADR-0058, after ivtrends#118 on 2026-09-22: a comment with four points,
  // one of which decided a requirement, got every point refused and a
  // question the comment had already answered.
  it("judges a comment point by point, never as one piece", () => {
    expect(prompt).toMatch(/each point/i);
    expect(prompt).not.toMatch(/exactly one of these/i);
  });

  it("never holds a clear fix back because another point needs something else", () => {
    expect(prompt).toMatch(/never hold(s)? (a|one) clear (point|fix) back/i);
  });

  it("writes a requirement the comment itself decides, as a marked amendment", () => {
    expect(prompt).toMatch(/the comment (itself )?(states|decides|says) what the\s+requirement/i);
    expect(prompt).toMatch(/marked amendment/i);
    expect(prompt).toContain("revised");
  });

  it("asks only about a point it would have to guess at", () => {
    expect(prompt).toMatch(/ask about that point only/i);
  });

  it("answers on the pull request's own thread", () => {
    expect(prompt).toMatch(/pull request/i);
  });
});

describe("every unattended work prompt", () => {
  // The stages that do real work with nobody at the keyboard. A session that
  // ends its turn "waiting to be notified" of background work simply ends —
  // the delivery session did exactly that in 13h, launching its review axes
  // in the background and finishing with nothing to show.
  const WORK_STAGES = ["execution", "verification", "delivery", "remediation"] as const;

  it.each(WORK_STAGES)("%s says that nothing survives the end of the turn", (stage) => {
    const prompt = stagePrompt(stage, {
      ...context,
      branch: "timone/6-typing-in-the-box",
    });
    expect(prompt).toMatch(/unattended/i);
    expect(prompt).toMatch(/before you finish|within this session/i);
  });
});

describe("the provenance trailer every committing session owes", () => {
  it("carries the obligation on every prompted stage, without exception", () => {
    for (const stage of PROMPTED_STAGES) {
      const prompt = stagePrompt(stage, context);
      expect(prompt, `${stage} does not instruct the trailer`).toContain(
        "Timone-Stage:",
      );
    }
  });

  it("names the stage and the run, which only the prompt knows", () => {
    const prompt = stagePrompt("execution", context);

    expect(prompt).toContain("Timone-Stage: execution");
    expect(prompt).toContain("Timone-Run: scratch-app#6");
  });

  it("leaves the session id to the hook, which is the only thing that has it", () => {
    // The prompt is built before the SDK has issued a session id, so the
    // prompt cannot carry one. The `SessionStart` hook tells the session.
    const prompt = stagePrompt("execution", context);

    expect(prompt).toContain("Timone-Session:");
    expect(prompt).toContain("the id you were given at the start");
  });

  it("adds the trailer rather than replacing what git already puts there", () => {
    expect(stagePrompt("execution", context)).toContain("Co-Authored-By:");
  });

  it("instructs the approval-recording session too, short as it is", () => {
    const prompt = approvalRecordPrompt(
      { stage: "planning", by: "fvermaut", at: "2026-08-06T12:00:00Z" },
      context,
    );

    expect(prompt).toContain("Timone-Stage: planning (recording the approval)");
    expect(prompt).toContain("Timone-Run: scratch-app#6");
  });
});

/**
 * The prompt that made finding 11 happen.
 *
 * It is the shortest prompt in the file and the only one outside
 * {@link stagePrompt}, so it inherits none of the shared blocks — which is
 * exactly how it came to say "work on the branch X" to a session sitting in
 * the wrong repository, twice, twenty minutes apart.
 */
describe("the approval-recording prompt", () => {
  const approval = {
    stage: "requirements" as const,
    by: "fvermaut",
    at: "2026-08-14T15:51:00Z",
  };

  it("names the checkout the branch lives in, not just the branch", () => {
    const prompt = approvalRecordPrompt(approval, {
      ...context,
      branch: "timone/6-typing-in-the-box",
    });

    expect(prompt).toContain("timone/6-typing-in-the-box");
    expect(prompt).toContain("git -C projects/scratch-app");
    expect(prompt).toMatch(/timone's own repository/i);
  });

  it("says so even when no branch was resolved for the run", () => {
    // The fallback wording — "the run's work branch" — is the case where the
    // session has the least to go on and the most room to improvise.
    const prompt = approvalRecordPrompt(approval, context);

    expect(prompt).toContain("git -C projects/scratch-app");
  });

  it("has no record to write for a phase file, and falls back harmlessly", () => {
    // ✏ ADR-0030 D1 took `planning`'s row out of `APPROVAL_RECORD`: no approval
    // is ever recorded for a stage that never opens a gate, so this call is
    // unreachable in practice. It is asserted rather than assumed because
    // `APPROVAL_RECORD` is a `Partial` record — a missing row is not a type
    // error and not a build failure — and what a caller reaching it would get
    // is the generic wording, not a prompt telling a session to forge stage 5's
    // retired stamp onto a phase file.
    const prompt = approvalRecordPrompt(
      { stage: "planning", by: "fvermaut", at: "2026-08-15" },
      { ...context, branch: "timone/6-typing-in-the-box" },
    );

    expect(prompt).not.toContain("Approved for execution");
    expect(prompt).toContain("the artifact this stage produced");
    expect(prompt).toContain("record the approval");
  });

  it("tells the breakdown's stamp to carry the count of pieces", () => {
    // **The count is not decoration.** `isReproposal` compares the number the
    // stamp names against the length of the list beneath it — that is how a
    // breakdown that gained a chunk after its approval is recognised — and
    // `parseBreakdown` accepts no other shape: a stamp written without the
    // count is `malformed`, which makes the whole file unreadable and the
    // initiative look as though it has no breakdown at all. Nothing type-checks
    // this prompt against that parser, so it is asserted here.
    const prompt = approvalRecordPrompt(
      { stage: "breakdown", by: "fvermaut", at: "2026-08-15" },
      { ...context, branch: "timone/6-typing-in-the-box" },
    );

    expect(prompt).toContain("Approved by <who> <date> — N pieces");
    expect(prompt).toMatch(/how many pieces/i);
    expect(prompt).toContain("doc/plans/breakdowns/ticket-06.md");
  });

  it("writes a stamp the breakdown parser actually accepts", () => {
    // The end-to-end version of the case above, driven through 23a's own
    // reader rather than through a regular expression written here: the shape
    // the prompt dictates is parsed, and it has to come back approved with the
    // count intact. This is the one assertion that would survive somebody
    // rewording the prompt.
    const stamped = renderBreakdown({
      stamp: { kind: "approved", by: "fvermaut", at: "2026-08-15", pieces: 3 },
      chunks: [
        { title: "One", delivers: "the first piece" },
        { title: "Two", delivers: "the second piece" },
        { title: "Three", delivers: "the third piece" },
      ],
    });
    const parsed = parseBreakdown(stamped);

    expect(parsed).not.toHaveProperty("reason");
    expect((parsed as ParsedBreakdown).stamp).toEqual({
      kind: "approved",
      by: "fvermaut",
      at: "2026-08-15",
      pieces: 3,
    });
    // And the prompt asks for exactly that line, verbatim.
    const prompt = approvalRecordPrompt(
      { stage: "breakdown", by: "fvermaut", at: "2026-08-15" },
      context,
    );
    expect(stamped).toContain("Approved by fvermaut 2026-08-15 — 3 pieces");
    expect(prompt).toContain("`Status:`");
  });
});

describe("workBranch — one branch per chunk, not one per ticket", () => {
  it("names chunk 1 exactly as it always has", () => {
    // A literal, deliberately. 26 runs in the live ledger carry branch names
    // rendered by this function and every one of them is a chunk 1, so a
    // "harmless" reformatting here is a branch nothing can resolve any more.
    expect(workBranch(ticket, 1)).toBe(
      "timone/6-typing-in-the-box-is-fiddly-on-my-phone",
    );
  });

  it("gives a successor chunk a branch of its own", () => {
    // Without this, chunk 2 claims the branch chunk 1 merged and closed, and
    // opens a pull request against itself.
    expect(workBranch(ticket, 2)).not.toBe(workBranch(ticket, 1));
    expect(workBranch(ticket, 2)).toBe(
      "timone/6-typing-in-the-box-is-fiddly-on-my-phone-chunk-2",
    );
  });

  it("keeps the prefix the branch-placement guardrail reads", () => {
    // `hooks.ts`'s WORK_BRANCH_PREFIX. A chunk whose branch stopped starting
    // `timone/` would be cut in the harness repo unnoticed.
    expect(workBranch(ticket, 1).startsWith("timone/")).toBe(true);
    expect(workBranch(ticket, 3).startsWith("timone/")).toBe(true);
  });
});

describe("the rule every step carries for when it cannot go on", () => {
  // Appended in `stagePrompt` beside the checkout and provenance blocks. Ten
  // copies of a rule is ten chances to word it differently, and the one stage
  // that got it wrong would be invisible. ✏ 2026-09-30: the step writes no
  // marker line and no command. It says why it stopped and what it needs, and
  // the runner reads that.

  it.each(PROMPTED_STAGES)("is carried by the %s prompt", (stage) => {
    const prompt = stagePrompt(stage, context);

    expect(prompt).toMatch(/outside what this (step|stage) may do/i);
    expect(prompt).toMatch(/the runner reads your comment/i);
  });

  it("says what is not a reason to stop, beside what is", () => {
    // The counter-example is what stops over-firing. A step that merely finds
    // the work hard, or needs an answer it can simply ask for, has no reason
    // to stop.
    const prompt = stagePrompt("execution", context);

    expect(prompt).toMatch(/hard|difficult/i);
    expect(prompt).toMatch(/not.*(asked|question)/i);
  });
});

describe("the takeover prompt for a run the runner waits on (41g)", () => {
  const waiting: TakeoverRun = {
    id: "scratch-app#6/1",
    stage: "requirements",
    branch: "timone/6-typing-in-the-box",
    wait: {
      on: "your answer to the two questions in my last comment",
      opened: "2026-08-03T09:30:00Z",
    },
  };
  const facts: TakeoverFacts = { record: { ok: true, value: [] }, namedPeople: ["fvermaut"] };

  it("names the run's step and what it waits on, and says nothing about a hand-back line", () => {
    const prompt = takeoverPrompt("scratch-app", waiting, ticket, facts);

    expect(prompt).toContain(stageLabel("requirements"));
    expect(prompt).toContain("your answer to the two questions in my last comment");
    expect(prompt).not.toContain("Picking it back up");
    expect(prompt).not.toContain("Carrying on at:");
    expect(prompt).not.toMatch(/hand (the work|it) back/i);
  });

  it.each([
    ["wayfinding", "timone-wayfind"],
    ["clarification", "timone-grill"],
    ["charting", "timone-wayfind"],
  ] as const)("tells the session to hold the %s conversation with the person, with `%s`", (stage, skill) => {
    const prompt = takeoverPrompt("scratch-app", { ...waiting, stage }, ticket, facts);

    expect(prompt).toContain(`\`${skill}\``);
    expect(prompt).toMatch(/hold that conversation with the person/i);
  });

  it("holds no conversation for a step that is not one", () => {
    const prompt = takeoverPrompt("scratch-app", { ...waiting, stage: "execution" }, ticket, facts);

    expect(prompt).not.toMatch(/hold that conversation/i);
    expect(prompt).not.toContain("timone-grill");
    expect(prompt).not.toContain("timone-wayfind");
  });

  it("says the runner wakes when the session ends and reads what it left on the ticket", () => {
    // Nothing in the terminal reaches the runner. The ticket does, so the
    // session's last act is to write there what it did and what comes next.
    const prompt = takeoverPrompt("scratch-app", waiting, ticket, facts);

    expect(prompt).toMatch(/when this session ends, the runner wakes/i);
    expect(prompt).toMatch(/reads what you left on the ticket/i);
    expect(prompt).toMatch(/what you did and what should happen next/i);
  });

  it("says what the run record says happened on this run, and on no other", () => {
    const prompt = takeoverPrompt("scratch-app", waiting, ticket, {
      ...facts,
      record: {
        ok: true,
        value: [
          { kind: "step-ended", at: "2026-08-01T08:00:00Z", runId: "scratch-app#6/0", stage: "execution", sessionId: "s0", ok: false, costUsd: 1, error: "an older run's failure" },
          { kind: "step-started", at: "2026-08-03T09:10:00Z", runId: "scratch-app#6/1", stage: "requirements", sessionId: "s1" },
          { kind: "step-ended", at: "2026-08-03T09:25:00Z", runId: "scratch-app#6/1", stage: "requirements", sessionId: "s1", ok: true, costUsd: 0.8 },
          { kind: "decision", at: "2026-08-03T09:30:00Z", runId: "scratch-app#6/1", action: "post", reason: "two questions only the operator can answer" },
        ],
      },
    });

    expect(prompt).toContain("two questions only the operator can answer");
    expect(prompt).toMatch(/2026-08-03T09:25:00Z.*writing down what it needs.*finished/);
    expect(prompt).not.toContain("an older run's failure");
  });

  it("says so when the run record cannot be read", () => {
    const prompt = takeoverPrompt("scratch-app", waiting, ticket, {
      ...facts,
      record: { ok: false, error: { line: 3, message: "The run record .timone/records/scratch-app/6.jsonl cannot be read: line 3 is not JSON." } },
    });

    expect(prompt).toContain("line 3 is not JSON");
  });

  it("carries what the named people wrote since the run began waiting, and nobody else's words", () => {
    const thread: TicketThread = {
      ...ticket,
      comments: [
        ...ticket.comments,
        { author: "fvermaut", body: "only the draft matters", createdAt: "2026-08-03T09:40:00Z", fromTimone: false },
        { author: "drive-by-dave", body: "make it purple", createdAt: "2026-08-03T09:45:00Z", fromTimone: false },
      ],
    };

    const prompt = takeoverPrompt("scratch-app", waiting, thread, facts);
    const since = prompt.slice(
      prompt.indexOf("--- what they wrote ---"),
      prompt.indexOf("--- end of what they wrote ---"),
    );

    expect(since).toContain("only the draft matters");
    // Written before the run began waiting: the runner already read it.
    expect(since).not.toContain("it's worse in landscape");
    // Not named for the project, so not an instruction.
    expect(since).not.toContain("make it purple");
  });

  it("compares when a comment was written with when the wait opened as instants, whatever their spelling", () => {
    // The ledger writes an instant with milliseconds, and GitHub writes one
    // without. As text, "…T10:00:00Z" sorts after "…T10:00:00.500Z", though
    // it is half a second before it.
    const opened: TakeoverRun = {
      ...waiting,
      wait: { on: "an answer", opened: "2026-08-03T10:00:00.500Z" },
    };
    const thread: TicketThread = {
      ...ticket,
      comments: [
        { author: "fvermaut", body: "written just before the wait opened", createdAt: "2026-08-03T10:00:00Z", fromTimone: false },
        { author: "fvermaut", body: "written just after the wait opened", createdAt: "2026-08-03T10:00:01Z", fromTimone: false },
      ],
    };

    const prompt = takeoverPrompt("scratch-app", opened, thread, facts);
    const since = prompt.slice(
      prompt.indexOf("--- what they wrote ---"),
      prompt.indexOf("--- end of what they wrote ---"),
    );

    expect(since).toContain("written just after the wait opened");
    expect(since).not.toContain("written just before the wait opened");
  });

  it("asks a session that ran no step's skill to sign its commits `Timone-Stage: interactive`", () => {
    // The value CLAUDE.md, the session's start and the check at its end all
    // give for a session in which no step was running.
    const { stage: _none, ...noStep } = waiting;

    const prompt = takeoverPrompt("scratch-app", noStep, ticket, facts);

    expect(prompt).toContain(
      "Timone-Stage: <the stage whose skill you ran, or `interactive` if none>",
    );
    expect(prompt).not.toMatch(/Timone-Stage:.*escalation/);
  });
});

describe("the takeover prompt for a run that stopped at a step", () => {
  // ADR-0033 D5. The session this prompt starts is bound to no stage. ✏
  // 2026-09-30: it is the prompt for every takeover of a run, and the run
  // here is one that stopped at a step.

  const stopped = "2026-08-17T10:00:00Z";
  const account =
    "I was told to go ahead to delivery, but two of the promises I check " +
    "against are worded so that nothing can pass them. Rewording them is not " +
    "something I may do — if I wrote the promises I check against, the check " +
    "would prove nothing.";

  const stuck: TicketThread = {
    ...ticket,
    number: 31,
    title: "the page is slow when I add many items",
    comments: [
      {
        author: "fvermaut",
        body: `${MACHINE_MARKER}\n\n---\n\n${account}`,
        createdAt: stopped,
        fromTimone: true,
      },
      {
        author: "fvermaut",
        body: "yes. how many times do I need to say YES?",
        createdAt: "2026-08-17T10:30:00Z",
        fromTimone: false,
      },
    ],
  };

  const run = {
    id: "scratch-app#31/1",
    stage: "verification" as const,
    branch: "timone/31-slow-page",
    wait: { on: "me — I can't take this one further myself.", opened: stopped },
  };
  const facts: TakeoverFacts = { record: { ok: true, value: [] }, namedPeople: ["fvermaut"] };

  it("is not any stage's prompt, wearing a hat", () => {
    // Asserted by identity against every prompt a stage has, not by looking
    // for a word: a session handed a stage's instructions is the bound
    // session ADR-0033 rejected, whatever it is called.
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    for (const stage of PROMPTED_STAGES) {
      expect(prompt).not.toBe(
        stagePrompt(stage, {
          project: { name: "scratch-app", repoUrl: "" },
          ticket: stuck,
        }),
      );
    }
  });

  it("carries the ticket and its thread, with the voices told apart", () => {
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toContain("the page is slow when I add many items");
    expect(prompt).toContain("how many times do I need to say YES?");
  });

  it("says where the run stopped, and what it holds", () => {
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toContain("scratch-app#31/1");
    expect(prompt).toContain("verification");
    expect(prompt).toContain("timone/31-slow-page");
  });

  it("carries the stopped step's account, and says the machine's comments may be wrong", () => {
    // ✏ 2026-09-30: the account is read in the thread, not quoted apart. It
    // was found by the comment posted at the instant the wait opened, which
    // only the old code between steps arranged.
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toContain("the check would prove nothing");
    // The account is evidence, not an instruction — and the prompt has to say
    // why: the step that wrote it could not read what the session can. On
    // ivtrends #1 an account like this named two promises as broken when only
    // one was.
    expect(prompt).toMatch(/may be wrong/i);
    expect(prompt).toMatch(/could not read|cannot read|never read/i);
  });

  it("carries what a named person wrote after the run began waiting", () => {
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toMatch(/how many times do I need to say YES\?/);
  });

  it("copes with a stop nobody wrote an account for, and with silence after it", () => {
    const bare: TicketThread = { ...stuck, comments: [] };

    const prompt = takeoverPrompt("scratch-app", run, bare, facts);

    expect(prompt).toContain("scratch-app#31/1");
    expect(prompt).not.toContain("undefined");
  });

  it("grants the authority a stage does not have, in as many words", () => {
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toMatch(/whichever .*skill/i);
    expect(prompt).toMatch(/depart/i);
  });

  it("names the record it owes", () => {
    // The only audit an unbound session has. Its absence is a failure, not a
    // nit: nothing else records what was done or why it departed from a
    // default.
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toMatch(/commit/i);
    expect(prompt).toMatch(/record/i);
  });

  it("is not a stage, and is not listed as one", () => {
    expect(PROMPTED_STAGES as readonly string[]).not.toContain("escalation");
  });

  // ADR-0035. Everything below is the half phase 25 left out: where this
  // session's job ends. ✏ 2026-09-30: it no longer names a step to carry on
  // at; the runner decides that from the session's closing comment.

  it("says building is not its job, and says why", () => {
    // scratch-app #37, 2026-08-18: the session got the approval and then
    // carried the whole feature to a pull request in the terminal. The rule
    // needs the reason with it — a rule with no reason is one a capable
    // session talks itself out of.
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toMatch(/do not write .*code/i);
    expect(prompt).toMatch(/pull request/i);
    expect(prompt).toMatch(/one piece at a time|piece by piece/i);
  });

  it("names what it may write instead", () => {
    // The line is artifacts, not code: the decision, the promises, the record.
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toMatch(/requirements|promises|decision/i);
  });

  it("names the other honest ending, for work that should not happen", () => {
    const prompt = takeoverPrompt("scratch-app", run, stuck, facts);

    expect(prompt).toContain("timone cancel scratch-app#31");
  });
});
