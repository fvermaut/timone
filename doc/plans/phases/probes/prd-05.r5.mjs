// Probe for PRD-05.R5 — Code lists every departure on the pull request, and a skipped check comes first.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The delivery step
// opens a pull request on the fake forge; code then writes the list into its description, which
// is read back from the forge.
//
// Register clauses (verbatim):
//   1. GIVEN a run record in which the checking step did not run WHEN the pull request is opened
//      THEN the first line of its description says the work was not checked by a session that did
//      not build it, and gives the runner's reason
//   2. GIVEN a run record in which the interview and the approval of the requirements did not run
//      WHEN the pull request is opened THEN its description lists both, each with the runner's reason
//   3. GIVEN a run record with no departures WHEN the pull request is opened
//      THEN its description says the default order was followed
//   4. GIVEN a departure the runner gave no reason for WHEN the pull request is opened
//      THEN the departure is still listed, marked as having no reason given
// The register's own word list: "A departure is a step of the default order that did not run, or
// ran out of order."
//
// Clause 3 (a feature, both approvals recorded) added 2026-09-29 (re-check after 40y). The other
// clause 3 walk is a chore, which has no approvals. When a named person's approval is recorded, a
// session writes it into its file; that session is not a step of the default order, so it is not a
// departure. The label walks a feature through every step, with both approvals recorded from the
// operator's comments. A run with both approvals reaches its own pull request only when the merge
// that follows the approval of the list fails: a merge that works ends the run, and the work goes on
// in the pieces' own tickets. So the walk puts a clashing change on main before the list is approved,
// then the operator says to go on. Its break step skips the interview, with a reason.
import { fixture, model, daemon, act, say, clause, assert, finish, OPERATOR } from './_rig.mjs';

const N = 12;
const whyOf = (q) => q.brief.split('## The ticket')[0];

// Walks `steps` in the order given — each [stage, skipReason?] — then delivery opens a pull request.
async function walk(steps, { kind = 'feature' } = {}) {
  const labels = kind === 'chore' ? ['timone', 'triage:chore'] : ['timone'];
  const fx = fixture({ issues: { fixture: { [N]: { labels } } } });
  let i = 0;
  const m = await model({
    runner: (c) => {
      // Refused for a missing reason: give the reason the walk carries for that step, if any.
      if (c.turn === 1 && /^Refused/.test(c.last) && steps[i - 1]?.[2]) return act('start_step', { stage: steps[i - 1][0], instructions: 'probe: again, with the reason', reason: 'probe', skipReason: steps[i - 1][2] });
      if (c.turn > 0 || i >= steps.length) return say();
      if (!/picked up|ended: it succeeded/.test(whyOf(c))) return say();
      const [stage, skipReason] = steps[i++];
      return act('start_step', { stage, instructions: `probe: ${stage}`, reason: `probe step ${i}`, ...(skipReason ? { skipReason } : {}) });
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      if ((c.brief.match(/Timone-Stage: (\S+)/) || [])[1] === 'delivery') {
        const br = fx.run(N).branch;
        fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Probe', body: 'Delivery text.', head: br, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; });
      }
      return say('done');
    },
  });
  await daemon(fx, m, { until: () => Object.values(fx.forge().prs).some((p) => p.body.includes('timone:departures')), timeoutMs: 45000, settleMs: 1000 });
  await m.stop();
  const pr = Object.values(fx.forge().prs)[0];
  const refused = fx.record(N).filter((e) => e.kind === 'decision' && /Refused/.test(e.detail ?? '')).map((e) => e.detail);
  fx.cleanup();
  const section = pr?.body.match(/<!-- timone:departures -->\n([\s\S]*?)<!-- \/timone:departures -->/)?.[1] ?? '';
  return { body: pr?.body ?? '(no pull request)', section, firstLine: section.split('\n').find((l) => l.trim()) ?? '', refused };
}

const CHORE_ALL = [['triage'], ['planning'], ['execution'], ['verification'], ['delivery']];
const noCheck = await walk([['triage'], ['planning'], ['execution'], ['delivery', 'PROBE-R1: the check needs a service this fixture does not have']], { kind: 'chore' });
const followed = await walk(CHORE_ALL, { kind: 'chore' });
const twoReasons = await walk([
  ['triage'],
  ['requirements', 'PROBE-R2A: the ticket already says what is needed'],
  ['breakdown', 'PROBE-R2B: the operator said the requirements need no approval'],
  ['planning', 'PROBE-R2C: one piece only'],
  ['execution'], ['verification'], ['delivery'],
]);
// Going back: building runs again after the check. Without a second check, delivery needs a reason
// (the third element is given only after code refuses the start); with a second check it needs none.
const wentBack = await walk([['triage'], ['planning'], ['execution'], ['verification'], ['execution'], ['delivery', undefined, 'PROBE-R5-BACK: the second build changed one line']], { kind: 'chore' });
const wentBackRechecked = await walk([['triage'], ['planning'], ['execution'], ['verification'], ['execution'], ['verification'], ['delivery']], { kind: 'chore' });
console.log(`    (no check: first line "${noCheck.firstLine}")`);
console.log(`    (went back to building after the check, then delivered: refused first — "${wentBack.refused[0] ?? 'not refused'}" — then "${wentBack.section.trim().replace(/\n/g, ' | ')}")`);
console.log(`    (went back to building, checked again, then delivered: "${wentBackRechecked.section.trim().replace(/\n/g, ' | ')}")`);

function assertNotCheckedFirst(r, reason) {
  assert(/^\*\*Not checked\.\*\*/.test(r.firstLine) && /no session other than the one that built/i.test(r.firstLine), `the first line does not say the work was not checked: "${r.firstLine}"`);
  if (reason) assert(r.firstLine.includes(reason), `the first line does not give the runner's reason: "${r.firstLine}"`);
}
await clause('PRD-05.R5 clause 1', 'the checking step did not run: the first line says the work was not checked by a session that did not build it, with the runner\'s reason', {
  broken: async () => assertNotCheckedFirst(followed, 'PROBE-R1'),
  correct: async () => assertNotCheckedFirst(noCheck, 'PROBE-R1'),
});

function assertBothListed(r) {
  const lines = r.section.split('\n');
  const interview = lines.find((l) => /asking what you need/i.test(l));
  const approval = lines.find((l) => /approval of the requirements/i.test(l));
  assert(interview && /did not run/.test(interview) && interview.includes('PROBE-R2A'), `the interview is not listed with its reason: ${interview ?? '(missing)'}`);
  assert(approval && /did not run/.test(approval) && approval.includes('PROBE-R2B'), `the approval of the requirements is not listed with its reason: ${approval ?? '(missing)'}`);
}
await clause('PRD-05.R5 clause 2', 'the interview and the approval of the requirements did not run: both are listed, each with the runner\'s reason', {
  broken: async () => assertBothListed(noCheck),
  correct: async () => assertBothListed(twoReasons),
});

function assertFollowed(r) {
  assert(r.section.trim() === 'The default order was followed.', `the description says: "${r.section.trim()}"`);
}
await clause('PRD-05.R5 clause 3', 'no departures: the description says the default order was followed', {
  broken: async () => assertFollowed(noCheck),
  correct: async () => assertFollowed(followed),
});

// A feature walked through every step of its default order, both approvals recorded from the
// operator's comments, then delivered. With skipInterview, the interview is skipped with a reason.
const PRD = '# PRD-01: A count of open to-dos\n\n> **Status:** Active\n\nShow how many to-dos are open.\n';
const LIST = `# Breakdown\n\n**Status:** Approved by ${OPERATOR} 2026-09-29 — 1 piece\n\n1. **The count above the list** — show how many to-dos are open, above the list. Delivers PRD-01.R1.\n`;
async function featureWalk({ skipInterview = false } = {}) {
  const fx = fixture({ issues: { fixture: { [N]: {} } } });
  const T = {};
  const mine = (c) => c.brief.includes(`fixture #${N}:`);
  const next = (stage, extra = {}) => act('start_step', { stage, instructions: `probe: ${stage}`, reason: 'probe: next in order', ...extra });
  const m = await model({
    runner: (c) => {
      if (c.turn > 0 || !mine(c)) return say();
      const w = whyOf(c);
      if (w.includes('picked up')) return next('triage');
      if (w.includes('sorting the request ended')) return skipInterview ? next('requirements', { skipReason: 'PROBE-R5-F: the ticket is clear' }) : next('clarification');
      if (w.includes('asking what you need ended')) return next('requirements');
      if (w.includes('"approve the requirements"')) return act('record_approval', { what: 'requirements', commentAt: T.req, reason: 'probe: the operator approved' });
      if (w.includes('"now cut it into pieces"')) return next('breakdown');
      if (w.includes('"approve the list"')) return act('record_approval', { what: 'pieces', commentAt: T.pcs, reason: 'probe: the operator approved' });
      if (w.includes('"go on with the work"')) return next('planning');
      if (w.includes('preparing the work ended')) return next('execution');
      if (w.includes('building ended')) return next('verification');
      if (w.includes('checking the result ended')) return next('delivery');
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      if ((c.brief.match(/Timone-Stage: (\S+)/) || [])[1] === 'delivery') {
        const br = fx.run(N).branch;
        fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Probe', body: 'Delivery text.', head: br, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; });
      }
      return say('done');
    },
  });
  const ended = (stage, n = 1) => fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === stage).length >= n;
  const quiet = () => ['runner-ended', 'seen'].includes(fx.record(N).at(-1)?.kind);
  const stopped = () => ['done', 'failed', 'cancelled'].includes(fx.run(N)?.status);
  const run = (until, ms = 40000) => daemon(fx, m, { until, timeoutMs: ms, settleMs: 1500 });
  await run(() => ended('requirements') && quiet());
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD.replace('Active', 'Draft') }, 'requirements');
  T.req = fx.comment(N, OPERATOR, 'approve the requirements');
  await run(() => ended('requirements', 2) && quiet());
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD }, 'record the requirements approval');
  fx.comment(N, OPERATOR, 'now cut it into pieces');
  await run(() => ended('breakdown') && quiet());
  fx.pushBranch(fx.run(N).branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: LIST }, 'the list of pieces');
  fx.pushBranch('main', { 'doc/specs/prd/prd-01-count.md': '# PRD-01: another text\n\n> **Status:** Active\n\nA clashing change on main.\n' }, 'a clashing change on main');
  T.pcs = fx.comment(N, OPERATOR, 'approve the list');
  await run(() => stopped() || (ended('breakdown', 2) && quiet() && fx.gh().some((g) => /merge:|MERGED/.test(g.result ?? ''))), 40000);
  if (!stopped()) {
    fx.comment(N, OPERATOR, 'go on with the work');
    await run(() => stopped() || Object.values(fx.forge().prs).some((p) => p.body.includes('timone:departures')), 60000);
  }
  await m.stop();
  const pr = Object.values(fx.forge().prs)[0];
  const rec = fx.record(N);
  const r = {
    section: pr?.body.match(/<!-- timone:departures -->\n([\s\S]*?)<!-- \/timone:departures -->/)?.[1] ?? '(no pull request)',
    approvals: rec.filter((e) => e.kind === 'approval').map((e) => e.what),
    steps: rec.filter((e) => e.kind === 'step-started').map((e) => e.stage),
    status: fx.run(N)?.status,
  };
  fx.cleanup();
  return r;
}
const feature = await featureWalk();
const featureNoInterview = await featureWalk({ skipInterview: true });
console.log(`    (a feature, both approvals recorded: approvals ${JSON.stringify(feature.approvals)}; steps started ${feature.steps.join(', ')}; the run ${feature.status}; the list on the pull request: "${feature.section.trim().replace(/\n/g, ' | ')}")`);
function assertFeatureFollowed(r) {
  assert(r.approvals.includes('requirements') && r.approvals.includes('pieces'), `the walk did not record both approvals: ${JSON.stringify(r.approvals)}`);
  assertFollowed(r);
}
await clause('PRD-05.R5 clause 3 (a feature, both approvals recorded)', 'a feature that ran every step, with both approvals recorded from a named person\'s comments: the description says the default order was followed', {
  broken: async () => assertFeatureFollowed(featureNoInterview),
  correct: async () => assertFeatureFollowed(feature),
});

// Clause 4. Code refuses a skip with no reason, so the only departure without a reason is one the
// runner is never asked about: a step that ran out of order ("A departure is a step of the default
// order that did not run, or ran out of order"). Here building ran again after the check, then
// the check ran again, and delivery followed.
function assertListedNoReason(r) {
  assert(!/The default order was followed/.test(r.section), `the description says the default order was followed: "${r.section.trim()}"`);
  assert(/building/i.test(r.section) && /no reason given/i.test(r.section), `the out-of-order step is not listed as having no reason given: "${r.section.trim()}"`);
}
await clause('PRD-05.R5 clause 4', 'a departure the runner gave no reason for (building ran again after the check) is still listed, marked no reason given', {
  broken: async () => assertListedNoReason(followed),
  correct: async () => assertListedNoReason(wentBackRechecked),
});
function assertBackNeedsReasonThenNotChecked(r) {
  assert(r.refused.some((x) => /leaves out checking the result/.test(x)), 'delivering after a second build, with no check since, was not refused for a missing reason');
  assertNotCheckedFirst(r, 'PROBE-R5-BACK');
}
await clause('PRD-05.R5 clause 1 (after going back)', 'the last build was never checked: code asks for a reason, and the first line says the work was not checked, with it', {
  broken: async () => assertBackNeedsReasonThenNotChecked(followed),
  correct: async () => assertBackNeedsReasonThenNotChecked(wentBack),
});

finish('PRD-05.R5');
