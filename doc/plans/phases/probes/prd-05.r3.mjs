// Probe for PRD-05.R3 — Nothing reaches a default branch without a yes from a named person.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The fake forge does
// GitHub's merge for real in its bare remote and logs "MERGED" when it does: that log and the
// remote's main are the evidence of what reached the default branch.
//
// Rig note: work a step would have committed is pushed BETWEEN daemon runs, never while a step
// session is live — in the in-process runtime a push during a live step was seen to leave that
// step never ending (verification report, "Limits of the rig").
//
// Register clauses (verbatim):
//   1. GIVEN any run WHEN the runner's actions are listed
//      THEN none of them merges a pull request or pushes to a default branch
//   2. GIVEN a run in which the runner skipped the approval of the list of pieces
//      WHEN the list is committed
//      THEN the requirements and the list of pieces are not merged into the default branch
//      AND they reach the operator in a pull request
//   3. GIVEN a run in which a named person approved the list of pieces in a comment
//      WHEN the approval is recorded
//      THEN chunk zero is merged as today, and the record names the comment the approval came from
import { fixture, model, daemon, act, say, clause, assert, finish, OPERATOR, STRANGER } from './_rig.mjs';

const N = 12;
const PRD = '# PRD-01: A count of open to-dos\n\n> **Status:** Active\n\nShow how many to-dos are open.\n';
const listText = (stamp) => `# Breakdown\n\n**Status:** ${stamp}\n\n1. **The count above the list** — show how many to-dos are open, above the list. Delivers PRD-01.R1.\n\n---\n\n## What this is\n\nThe list of pieces.\n`;
const whyOf = (q) => q.brief.split('## The ticket')[0];
const ended = (fx, stage) => fx.record(N).some((e) => e.kind === 'step-ended' && e.stage === stage);
const quiet = (fx) => fx.record(N).at(-1)?.kind === 'runner-ended' || fx.record(N).at(-1)?.kind === 'seen';

// A feature walked to its list of pieces, then either the list approved in `approver`'s comment,
// or the approval skipped and the work carried on to a pull request.
async function walk({ approver = null, skipApproval = false }) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const T = {};
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const w = whyOf(c);
      if (w.includes('picked up')) return act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' });
      if (w.includes('"approve the requirements"')) return act('record_approval', { what: 'requirements', commentAt: T.req, reason: 'probe' });
      if (w.includes('"now cut it into pieces"')) return act('start_step', { stage: 'breakdown', instructions: 'cut it', reason: 'probe' });
      if (w.includes('"go on without approving the list"')) return act('start_step', { stage: 'planning', instructions: 'plan it', reason: 'probe', skipReason: 'probe: the operator said to go on without approving the list' });
      if (w.includes('preparing the work ended')) return act('start_step', { stage: 'execution', instructions: 'build it', reason: 'probe' });
      if (w.includes('"the build is pushed"')) return act('start_step', { stage: 'delivery', instructions: 'open the pull request', reason: 'probe', skipReason: 'probe: no check in this fixture' });
      if (w.includes('"approve the list"')) return act('record_approval', { what: 'pieces', commentAt: T.pcs, reason: 'probe' });
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      if ((c.brief.match(/Timone-Stage: (\S+)/) || [])[1] === 'delivery') {
        const br = fx.run(N).branch;
        fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Probe', body: 'Delivery text.', head: br, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; });
        return say('the pull request is open');
      }
      return say('done');
    },
  });
  const run = (until, ms = 30000) => daemon(fx, m, { until, timeoutMs: ms, settleMs: 1500 });
  await run(() => ended(fx, 'requirements') && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD.replace('Active', 'Draft') }, 'requirements');
  T.req = fx.comment(N, OPERATOR, 'approve the requirements');
  await run(() => fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === 'requirements').length >= 2 && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD }, 'record the requirements approval');
  fx.comment(N, OPERATOR, 'now cut it into pieces');
  await run(() => ended(fx, 'breakdown') && quiet(fx));
  const branch = fx.run(N).branch;
  const mainBefore = fx.remoteHead('main');
  if (approver) {
    fx.pushBranch(branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: listText(`Approved by ${OPERATOR} 2026-09-28 — 1 piece`) }, 'the list of pieces');
    T.pcs = fx.comment(N, approver, 'approve the list');
    await run(() => fx.gh().some((g) => /MERGED/.test(g.result ?? '')) || fx.record(N).some((e) => e.kind === 'decision' && e.action === 'record_approval' && /Refused/.test(e.detail ?? '') && e.at > T.pcs.slice(0, 19)), 40000);
  }
  if (skipApproval) {
    fx.pushBranch(branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: listText('Awaiting approval') }, 'the list of pieces');
    fx.comment(N, OPERATOR, 'go on without approving the list');
    await run(() => ended(fx, 'execution') && quiet(fx));
    fx.pushBranch(branch, { 'src/count.ts': 'export const count = 1;\n' }, 'the build');
    fx.comment(N, OPERATOR, 'the build is pushed');
    await run(() => ended(fx, 'delivery') && quiet(fx), 40000);
  }
  await m.stop();
  return {
    fx, mainBefore, mainAfter: fx.remoteHead('main'), branch, T,
    merged: fx.gh().filter((g) => /MERGED/.test(g.result ?? '')).map((g) => g.result),
    listOnMain: fx.remoteFile('main', `doc/plans/breakdowns/ticket-${N}.md`),
    prdOnMain: fx.remoteFile('main', 'doc/specs/prd/prd-01-count.md'),
    approvals: fx.record(N).filter((e) => e.kind === 'approval'),
    prs: Object.values(fx.forge().prs),
    issues: fx.forge().issues,
  };
}

// Clause 1: the runner's own actions, read from what the runner session was started with.
{
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const m = await model({ runner: () => say() });
  await daemon(fx, m, { until: () => m.runner().length > 0, timeoutMs: 20000 });
  await m.stop();
  const tools = m.runner()[0]?.tools ?? [];
  const assertNoMerge = (list) => {
    assert(list.length > 0, 'no runner session was seen');
    const bad = list.filter((t) => /(merge|push|commit|Bash|Write|Edit)/i.test(t));
    assert(bad.length === 0, `actions that could merge or push: ${bad.join(', ')}`);
  };
  await clause('PRD-05.R3 clause 1', 'none of the runner\'s actions merges a pull request or pushes to a default branch', {
    broken: async () => assertNoMerge([...tools, 'mcp__runner__merge_pull_request']),
    correct: async () => assertNoMerge(tools),
  });
  fx.cleanup();
}

const skipped = await walk({ skipApproval: true });
const approved = await walk({ approver: OPERATOR });
const byStranger = await walk({ approver: STRANGER });

// Clause 2: the pieces approval skipped — nothing reaches main, and the list reaches the operator in a pull request.
function assertNotMerged(r) {
  assert(r.merged.length === 0 && r.mainAfter === r.mainBefore, `something reached main: ${r.merged.join('; ') || `main moved ${r.mainBefore} → ${r.mainAfter}`}`);
  assert(!r.listOnMain && !r.prdOnMain, 'the requirements or the list of pieces are on main');
}
await clause('PRD-05.R3 clause 2a', 'with the pieces approval skipped, the requirements and the list of pieces are not merged into the default branch', {
  broken: async () => assertNotMerged(approved),
  correct: async () => assertNotMerged(skipped),
});
function assertInPullRequest(r) {
  const pr = r.prs.find((p) => p.head === r.branch && p.state === 'OPEN');
  assert(pr, `no open pull request from ${r.branch}`);
  assert(r.fx.remoteFile(r.branch, `doc/plans/breakdowns/ticket-${N}.md`) && r.fx.remoteFile(r.branch, 'doc/specs/prd/prd-01-count.md'), 'the pull request\'s branch does not carry the requirements and the list');
  assert(/timone:departures[\s\S]*approval of the list of pieces[\s\S]*go on without approving/i.test(pr.body), `the pull request does not say the approval of the list was skipped:\n${pr.body}`);
}
await clause('PRD-05.R3 clause 2b', 'they reach the operator in a pull request', {
  broken: async () => assertInPullRequest({ ...skipped, prs: [] }),
  correct: async () => assertInPullRequest(skipped),
});

// Clause 3: a named person's approval, recorded → chunk zero merged as today, record names the comment.
function assertChunkZero(r) {
  assert(r.merged.length === 1, `merges into main: ${r.merged.length}`);
  assert(r.listOnMain?.includes('The count above the list') && r.prdOnMain, 'main does not carry the requirements and the list');
  const steps = Object.values(r.issues).filter((i) => i.number !== N && i.title.includes('The count above the list'));
  assert(steps.length === 1, `step tickets opened: ${steps.length}`);
  assert(r.issues[N].labels.includes('timone:map'), 'the ticket did not become the map of its pieces');
  const a = r.approvals.find((x) => x.what === 'pieces');
  assert(a && a.by === OPERATOR && a.commentAt === r.T.pcs, `the record does not name the approving comment: ${JSON.stringify(r.approvals)}`);
}
await clause('PRD-05.R3 clause 3', 'a named person\'s approval, recorded: chunk zero is merged as today, and the record names the comment', {
  broken: async () => assertChunkZero(byStranger),
  correct: async () => assertChunkZero(approved),
});

for (const r of [skipped, approved, byStranger]) r.fx.cleanup();
finish('PRD-05.R3');
