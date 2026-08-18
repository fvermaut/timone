import { describe, expect, it } from "vitest";

import {
  CLARIFICATION_MARKER,
  CONVERSATION_RECORD_MARKER,
  MACHINE_MARKER,
  STAGE_DONE_MARKER,
  STAGE_HANDED_MARKER,
  type TicketingProject,
  type TicketThread,
} from "../adapters/ticketing.js";
import {
  parseBreakdown,
  renderBreakdown,
  type ParsedBreakdown,
} from "./breakdown.js";
import {
  PROMPTED_STAGES,
  approvalRecordPrompt,
  conversationSubject,
  escalationPrompt,
  stagePrompt,
  takeoverPrompt,
  workBranch,
  type PromptContext,
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

  it.each(PROMPTED_STAGES)("%s carries the human's words when a gate sent it back", (stage) => {
    const words = "it's not about phones, it's about losing the draft";
    const prompt = stagePrompt(stage, { ...context, feedback: words });

    expect(prompt).toContain(words);
    expect(prompt).toMatch(/again/i);
  });

  it.each(PROMPTED_STAGES)("%s says nothing about feedback when there was none", (stage) => {
    expect(stagePrompt(stage, context)).not.toMatch(/asked for a change/i);
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

  it("does not send the session past its own stage", () => {
    expect(stagePrompt("triage", { project, ticket })).toMatch(
      /do not act on it beyond classifying/i,
    );
  });
});

describe("the clarification prompt", () => {
  const prompt = stagePrompt("clarification", context);

  it("tells the session someone is present and waiting, when one is", () => {
    // ✏ Re-pointed at the session a human actually opened. The prompt used to
    // claim this unconditionally, which was false the moment ADR-0022 let the
    // daemon start this stage to ingest an answer written on the ticket — and
    // it is the sentence most likely to make such a session behave wrongly.
    expect(stagePrompt("clarification", { ...context, interactive: true })).toMatch(
      /at the keyboard/i,
    );
  });

  it("carries what triage decided, so the interview does not start from nothing", () => {
    expect(prompt).toContain("feature");
  });

  it("supposes no answer to the questions it exists to ask", () => {
    expect(prompt).not.toMatch(/the problem is|they want|you should build/i);
  });

  it("requires an accepted summary, marked so the machine can find it again", () => {
    expect(prompt).toMatch(/accept/i);
    expect(prompt).toContain(CONVERSATION_RECORD_MARKER);
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

  it("is a stage a takeover can hold a conversation for", () => {
    // `runTakeover` refuses any stage the prompts module cannot instruct, so
    // this membership is what turns the CTA on a wayfinder ticket from an
    // instruction the human cannot follow into one that works.
    expect(PROMPTED_STAGES).toContain("wayfinding");
  });

  it("tells the session someone is present and waiting, when one is", () => {
    expect(stagePrompt("wayfinding", { ...context, interactive: true })).toMatch(
      /at the keyboard/i,
    );
  });

  it("marks the resolution so the machinery knows the run is over", () => {
    // ✏ The amendment's third settled question. Nothing follows wayfinding,
    // so the record marker is what turns a resolved decision ticket into a
    // finished run instead of one parked forever on a question already
    // answered.
    expect(prompt).toContain(CONVERSATION_RECORD_MARKER);
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

describe("a conversation prompt built for a written answer", () => {
  const CONVERSATION_STAGES = ["clarification", "wayfinding"] as const;
  const answer = "it's the draft they lose, not the phone layout";

  /** The thread as it stands once the machine has already asked once more. */
  function afterOneRound(): TicketThread {
    return {
      ...ticket,
      comments: [
        ...ticket.comments,
        {
          author: "fvermaut",
          body: `${MACHINE_MARKER}\n\n${CLARIFICATION_MARKER}\n\nwhich of the two first?`,
          createdAt: "2026-08-03T10:00:00Z",
          fromTimone: true,
        },
      ],
    };
  }

  it.each(CONVERSATION_STAGES)(
    "%s does not claim anyone is at the keyboard when nobody is",
    (stage) => {
      // The daemon started this session because they wrote on the ticket. A
      // session told a human is waiting in front of it will behave as though
      // its reply is being read in the moment — and nothing it says reaches
      // them except as a comment.
      const prompt = stagePrompt(stage, { ...context, feedback: answer });

      expect(prompt).not.toMatch(/at the keyboard/i);
      expect(prompt).toMatch(/in writing/i);
      expect(prompt).toMatch(/comment/i);
    },
  );

  it.each(CONVERSATION_STAGES)("%s carries what they wrote, as an answer", (stage) => {
    const prompt = stagePrompt(stage, { ...context, feedback: answer });

    expect(prompt).toContain(answer);
    // Not as a gate's change request: they answered a question, they did not
    // reject a document.
    expect(prompt).not.toMatch(/asked for a change/i);
  });

  it.each(CONVERSATION_STAGES)(
    "%s forbids re-asking what the answer already settles",
    (stage) => {
      expect(stagePrompt(stage, { ...context, feedback: answer })).toMatch(
        /do not ask .*again|already answered/i,
      );
    },
  );

  it.each(CONVERSATION_STAGES)(
    "%s allows exactly one more question, marked so it can be counted",
    (stage) => {
      const prompt = stagePrompt(stage, { ...context, feedback: answer });

      expect(prompt).toContain(CLARIFICATION_MARKER);
      expect(prompt).toMatch(/once/i);
    },
  );

  it.each(CONVERSATION_STAGES)(
    "%s hands back the takeover instead of asking a third time",
    (stage) => {
      // ADR-0022's bound, and the one thing this slice guarantees: escalation
      // is the session's judgement, but a second unsettled answer must
      // produce the takeover rather than another question.
      const prompt = stagePrompt(stage, {
        ...context,
        ticket: afterOneRound(),
        feedback: "still not sure really",
      });

      expect(prompt).toContain("timone takeover scratch-app#6");
      expect(prompt).toMatch(/not ask (them )?again|no more questions|third/i);
      // The marker itself is still in the prompt — it is in the thread the
      // prompt renders, which is exactly how the round was counted. What must
      // be gone is the *authorisation* to spend another one.
      expect(prompt).not.toMatch(/you may ask/i);
    },
  );
});

describe("conversationSubject", () => {
  it("says what is about to be talked through, in the ticket's own terms", () => {
    const subject = conversationSubject(ticket);

    expect(subject).toContain(ticket.title);
    expect(subject.toLowerCase()).not.toContain("stage");
    expect(subject.toLowerCase()).not.toContain("timone-");
  });
});

describe("takeoverPrompt", () => {
  it("is the stage's own prompt, framed for a human who just opened it", () => {
    const prompt = takeoverPrompt("scratch-app", "clarification", ticket);

    expect(prompt).toContain(ticket.body);
    expect(prompt).toMatch(/Timone \(you\), earlier/);
    expect(prompt).toContain("timone takeover scratch-app#6");
  });
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

  it("asks for the outcome record the daemon reads it by", () => {
    // Found live on 2026-08-15, twice, on scratch-app #31. Every wait-free
    // working stage is judged by `afterStage` reading an outcome record off
    // the ticket; `planning` was gated until this morning, so the approval
    // reply was its signal and it never carried this block. ADR-0030 D1 made
    // it wait-free and nobody moved the block across, so the session wrote
    // the plan, posted a comment nothing could read, and the run failed with
    // "the planning stage ended without recording an outcome, and the branch
    // carries what it planned". No unit test could have caught it: the tests
    // inject the outcome.
    expect(prompt).toContain(STAGE_DONE_MARKER);
    expect(prompt).toContain(STAGE_HANDED_MARKER);
  });

  it("still asks the human for nothing", () => {
    // The instruction that used to live in the comment paragraph moved inside
    // the outcome block; it must survive the move, because this is the whole
    // of what ADR-0030 D1 bought — a piece already agreed when the list was.
    expect(prompt).toMatch(/ask them for nothing/i);
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
    // lines apart in the prompt, and the closing flip is what `session.ts` reads
    // with `/^Complete\b/` to judge whether the run succeeded. Delete it with
    // the entry gate and every chunk fails its own outcome check, silently.
    expect(prompt).not.toMatch(/authority on whether you may/i);
    expect(prompt).not.toContain("Approved for execution");
    expect(prompt).toContain("Complete — see <report>");
  });

  it("carries both outcome markers, verbatim", () => {
    expect(prompt).toContain(STAGE_DONE_MARKER);
    expect(prompt).toContain(STAGE_HANDED_MARKER);
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

  it("carries both outcome markers, verbatim", () => {
    expect(prompt).toContain(STAGE_DONE_MARKER);
    expect(prompt).toContain(STAGE_HANDED_MARKER);
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

  it("carries both outcome markers, verbatim", () => {
    expect(prompt).toContain(STAGE_DONE_MARKER);
    expect(prompt).toContain(STAGE_HANDED_MARKER);
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
    feedback: "Please rename this variable, it shadows the prop.",
  });

  it("carries the review comment as the defect brief", () => {
    expect(prompt).toContain("shadows the prop");
  });

  it("commits with the review-fix convention on the same branch", () => {
    expect(prompt).toContain("fix: review");
    expect(prompt).toContain("timone/6-typing-in-the-box");
  });

  it("draws the ADR-0016 boundary: requirement-moving comments are not fixes", () => {
    expect(prompt).toMatch(/criteria register|PRD/);
    expect(prompt).toMatch(/reply|ask/i);
  });

  it("carries both outcome markers, verbatim", () => {
    expect(prompt).toContain(STAGE_DONE_MARKER);
    expect(prompt).toContain(STAGE_HANDED_MARKER);
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

describe("the escalation prompt", () => {
  // ADR-0033 D5. The session this prompt starts is bound to no stage: it is
  // opened on a run the machine stopped and cannot take further, and its job
  // is to work out what that run actually needs.

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
    waitingOn: "me — I can't take this one further myself.",
    waitCursor: stopped,
  };

  it("is not any stage's prompt, wearing a hat", () => {
    // Asserted by identity against every prompt a stage has, not by looking
    // for a word: a session handed a stage's instructions is the bound
    // session ADR-0033 rejected, whatever it is called.
    const prompt = escalationPrompt("scratch-app", run, stuck);

    for (const stage of PROMPTED_STAGES) {
      expect(prompt).not.toBe(
        stagePrompt(stage, {
          project: { name: "scratch-app", repoUrl: "" },
          ticket: stuck,
          interactive: true,
        }),
      );
    }
    expect(prompt).not.toBe(takeoverPrompt("scratch-app", "verification", stuck));
  });

  it("carries the ticket and its thread, with the voices told apart", () => {
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toContain("the page is slow when I add many items");
    expect(prompt).toContain("how many times do I need to say YES?");
  });

  it("says where the run stopped, and what it holds", () => {
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toContain("scratch-app#31/1");
    expect(prompt).toContain("verification");
    expect(prompt).toContain("timone/31-slow-page");
  });

  it("carries the stopped stage's account, and says it may be wrong", () => {
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toContain("the check would prove nothing");
    // Quoted without the thread's own plumbing: the marker is how the ticket
    // tells the voices apart, and reading it back as part of the account
    // would have the session treat punctuation as evidence.
    expect(
      prompt.slice(
        prompt.indexOf("--- what the stage said ---"),
        prompt.indexOf("--- end of what the stage said ---"),
      ),
    ).not.toContain(MACHINE_MARKER);
    // The account is evidence, not an instruction — and the prompt has to say
    // why: the stage that wrote it could not read the source, the decisions or
    // the diff. On ivtrends #1 an account like this named two promises as
    // broken when only one was.
    expect(prompt).toMatch(/may be wrong/i);
    expect(prompt).toMatch(/could not read|cannot read|never read/i);
  });

  it("names what normally follows as the pipeline's default, not as a decision", () => {
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toContain("delivery");
    expect(prompt).toMatch(/you may|need not|not a decision/i);
  });

  it("carries what the human wrote after it stopped", () => {
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toMatch(/how many times do I need to say YES\?/);
  });

  it("copes with a stop nobody wrote an account for, and with silence after it", () => {
    const bare: TicketThread = { ...stuck, comments: [] };

    const prompt = escalationPrompt("scratch-app", run, bare);

    expect(prompt).toContain("scratch-app#31/1");
    expect(prompt).not.toContain("undefined");
  });

  it("grants the authority a stage does not have, in as many words", () => {
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toMatch(/whichever .*skill/i);
    expect(prompt).toMatch(/depart/i);
  });

  it("names the record it owes", () => {
    // The only audit an unbound session has. Its absence is a failure, not a
    // nit: nothing else records what was done or why it departed from a
    // default.
    const prompt = escalationPrompt("scratch-app", run, stuck);

    expect(prompt).toMatch(/commit/i);
    expect(prompt).toMatch(/record/i);
  });

  it("is not a stage, and is not listed as one", () => {
    expect(PROMPTED_STAGES as readonly string[]).not.toContain("escalation");
  });
});
