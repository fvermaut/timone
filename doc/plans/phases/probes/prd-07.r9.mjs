// Probe for PRD-07.R9 — A ticket with an open pull request keeps its run and is not picked up again.
// Stage 7 artifact, authored 2026-10-04 (phase 47) from the register alone. Runs the built
// daemon through _rig.mjs. Needs `npm run build` first.
//
// Register clauses (verbatim):
//   1. GIVEN a marked ticket whose pull request from an earlier run is open
//      WHEN the daemon reads the project's tickets
//      THEN no new run starts for that ticket as new work
//   2. GIVEN that ticket
//      WHEN its pull request merges, closes, or gets a review comment from a named person
//      THEN the run that owns that pull request wakes, and the facts it is given name the pull
//      request and its branch
//
// The state is the one the register's hint names (scratch-app#67, #181): a marked, open ticket;
// its work branch on the remote with one commit, and pull request #70 open from it; and a
// ledger with no run for the ticket — the earlier run has left it. The branch is named the way
// the built app names a ticket's work branch (`timone/<n>-<slug>`, seen in this pass).
//
// "As new work" is read from what a person and the runner see: a new run that posts
// "Picked this up" on the ticket, or wakes its runner on "A new ticket was picked up", or whose
// facts say the branch is "none yet".
//
// Break legs: the same state on the build from just before phase 47 (_places.mjs's
// BEFORE_PHASE_47), where #181 was reported.
import { fixture, model, daemon, say, sleep, clause, assert, finish, OPERATOR } from './_rig.mjs';
import { before47 } from './_places.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const N = 12;
const BR = 'timone/12-add-a-count-of-open-to-dos';
const PR = 70;

async function earlierPullRequest({ event, cli }) {
  const fx = fixture({ issues: { fixture: { [N]: { comments: [{ author: 'probe-bot', body: 'The earlier run opened pull request #70.' }] } } }, cli });
  fx.pushBranch(BR, { 'src/count.ts': 'export const count = 1;\n' }, 'the build');
  fx.editForge((f) => { f.prs[PR] = { number: PR, title: 'Add a count of open to-dos', body: `For #${N}.`, head: BR, base: 'main', state: 'OPEN', createdAt: '2026-09-30T10:00:00Z', comments: [] }; });
  const commentsBefore = fx.issue(N).comments.length;
  const m = await model({ runner: () => say() });
  // The daemon reads the project's tickets: three cycles at its 2 s interval.
  await daemon(fx, m, { until: () => false, timeoutMs: 8000 });
  const afterRead = {
    runs: fx.state().runs.filter((r) => r.ticket === N),
    posted: fx.issue(N).comments.slice(commentsBefore).map((c) => c.body),
    wakes: m.runner().map((q) => q.brief.split('## The ticket')[0]),
    briefs: m.runner().map((q) => q.brief),
  };
  const before = m.runner().length;
  if (event === 'merge') fx.editForge((f) => { f.prs[PR].state = 'MERGED'; f.prs[PR].mergedAt = new Date().toISOString(); });
  if (event === 'close') fx.editForge((f) => { f.prs[PR].state = 'CLOSED'; f.prs[PR].closedAt = new Date().toISOString(); });
  if (event === 'review') fx.comment(PR, OPERATOR, 'Please call it the open count.', { pr: true });
  await daemon(fx, m, { until: () => m.runner().length > before, timeoutMs: 20000, settleMs: 1000 });
  await m.stop();
  const wake = m.runner().slice(before).find((q) => q.turn === 0);
  return { event, fx, afterRead, wake: wake?.brief ?? '', runsAfter: fx.state().runs.filter((r) => r.ticket === N) };
}

const now = await Promise.all(['merge', 'close', 'review'].map((event) => earlierPullRequest({ event })));
const OLD = REAL_ONLY ? null : before47();
const old = REAL_ONLY ? [] : await Promise.all(['merge', 'close', 'review'].map((event) => earlierPullRequest({ event, cli: OLD })));

const facts = (brief) => (brief.match(/## Facts about the work\n([\s\S]*?)\n## /) || [])[1] ?? '';
function assertNotNewWork(r) {
  const a = r.afterRead;
  assert(!a.posted.some((b) => /Picked this up/i.test(b)), `the ticket was told it was picked up as new work: "${(a.posted.find((b) => /Picked this up/i.test(b)) ?? "").slice(0, 160).replace(/\n/g, " ")}"`);
  assert(!a.wakes.some((w) => /new ticket was picked up/i.test(w)), 'a runner was woken on "A new ticket was picked up"');
  assert(!a.briefs.some((b) => /Branch: none yet/i.test(facts(b))), 'a runner was given facts that say the branch is none yet');
}
await clause('PRD-07.R9 clause 1', 'a marked ticket whose pull request from an earlier run is open: the daemon reads the project\'s tickets, and no new run starts for that ticket as new work', {
  broken: async () => assertNotNewWork(old[0]),
  correct: async () => { for (const r of now) assertNotNewWork(r); },
});
{
  const r = now[0];
  console.log(`    (after the read, the ledger holds for #${N}: ${r.afterRead.runs.map((x) => `${x.id} ${x.status} at ${x.stage}, branch ${x.branch}, pull request ${x.pr ? `#${x.pr}` : 'none'}, waiting on "${x.wait?.on}"`).join('; ') || 'nothing'}; posted on the ticket: ${r.afterRead.posted.length}; runner sessions: ${r.afterRead.wakes.length})`);
  if (old[0]) console.log(`    (break leg, the build before phase 47: posted ${JSON.stringify(old[0].afterRead.posted.map((b) => b.split('\n').find((l) => /\*\*/.test(l)) ?? b.slice(0, 60)))}; woken on ${JSON.stringify(old[0].afterRead.wakes.map((w) => (w.match(/^- .*$/m) || [''])[0]))})`);
}

function assertWokeWithFacts(r) {
  assert(r.wake, `the run that owns the pull request did not wake after the ${r.event} (${r.runsAfter.map((x) => `${x.id} ${x.status}`).join(', ')})`);
  const why = r.wake.split('## The ticket')[0];
  const want = { merge: /merged/i, close: /closed/i, review: /Please call it the open count/ }[r.event];
  assert(want.test(why), `it woke, but not on the ${r.event}: "${why.replace(/\n/g, ' ').slice(0, 200)}"`);
  const f = facts(r.wake);
  assert(new RegExp(`#${PR}\\b`).test(f), `the facts it is given do not name pull request #${PR}: "${f.replace(/\n/g, ' | ')}"`);
  assert(f.includes(BR), `the facts it is given do not name the branch ${BR}: "${f.replace(/\n/g, ' | ')}"`);
  const owners = r.runsAfter.filter((x) => x.pr === PR || x.branch === BR);
  assert(r.runsAfter.length === 1 && owners.length === 1, `more than one run for the ticket, or none owning the pull request: ${r.runsAfter.map((x) => `${x.id} ${x.status} ${x.branch ?? 'no branch'}`).join(', ')}`);
}
for (const [i, ev] of ['merge', 'close', 'review'].entries()) {
  const words = { merge: 'merges', close: 'closes', review: 'gets a review comment from a named person' }[ev];
  await clause(`PRD-07.R9 clause 2 (${ev})`, `that ticket: its pull request ${words}, and the run that owns that pull request wakes, and the facts it is given name the pull request and its branch`, {
    broken: async () => assertWokeWithFacts(old[i]),
    correct: async () => assertWokeWithFacts(now[i]),
  });
  const f = facts(now[i].wake).split('\n').filter((l) => /Branch:|Pull request:/.test(l)).join(' | ');
  console.log(`    (woken on: "${(now[i].wake.split('## The ticket')[0].match(/^- .*$/m) || [''])[0]}"; facts: ${f})`);
  if (old[i]) console.log(`    (break leg, the build before phase 47: ${old[i].wake ? `woken on "${(old[i].wake.split('## The ticket')[0].match(/^- .*$/m) || [''])[0]}", facts ${facts(old[i].wake).split('\n').filter((l) => /Branch:|Pull request:/.test(l)).join(' | ')}` : 'not woken'}; runs ${old[i].runsAfter.map((x) => `${x.id} ${x.status}`).join(', ')})`);
}

for (const r of [...now, ...old]) r.fx.cleanup();
finish('PRD-07.R9');
