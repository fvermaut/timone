// Probe for PRD-05.R17 — A fault in Timone is filed, not fixed.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The rig's manifest
// carries a `timone` project, so the runner has a Timone repository (probe-owner/timone) on the
// fake forge, holding open and closed issues.
//
// Register clauses (verbatim):
//   1. GIVEN the runner judges that a failure is caused by Timone's own code or instructions
//      WHEN an open issue on the Timone repository describes the same fault
//      THEN the runner adds a comment to that issue with the new evidence (the ticket, the time, the session) and files nothing new
//   2. GIVEN the same judgement WHEN no open issue matches
//      THEN the runner files a new issue labelled bug, written in plain words, pointing at the ticket and the session where it was seen
//   3. GIVEN a network failure that a retry fixed WHEN the run carries on THEN nothing is filed
//   4. GIVEN any run WHEN the runner acts on a fault in Timone THEN no file of Timone's is changed
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, model, daemon, act, say, clause, blocked, assert, finish } from './_rig.mjs';

const N = 12;
const TIMONE_ISSUES = {
  7: { title: 'The ledger forgets which step is running', labels: ['bug'], body: 'seen before' },
  8: { title: 'A fault that was closed', labels: ['bug'], state: 'CLOSED' },
  9: { title: 'An idea, not a fault', labels: ['enhancement'] },
};
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();

async function actOnFault(actions, { flaky = 0 } = {}) {
  const fx = fixture({ timoneRepo: true, issues: { fixture: { [N]: {} }, timone: TIMONE_ISSUES } });
  let failed = 0;
  const m = await model({
    runner: (c) => {
      if (flaky && failed < flaky) { failed++; return { httpError: 529 }; }
      if (c.wake !== 0) return say();
      return actions[c.turn] ? actions[c.turn]() : say();
    },
  });
  const headBefore = git(fx.dir, 'rev-parse', 'HEAD');
  await daemon(fx, m, { until: () => fx.record(N).some((e) => e.kind === 'runner-ended'), timeoutMs: 40000, settleMs: 1000 });
  await m.stop();
  const f = fx.forge();
  const repo = f.others['probe-owner/timone'];
  const r = {
    fx,
    brief: m.runner()[0]?.brief ?? '',
    created: Object.values(repo.issues).filter((i) => i.number >= 100),
    commentsOn7: repo.issues[7].comments,
    ticketComments: fx.issue(N).comments.slice(1),
    ended: fx.record(N).find((e) => e.kind === 'runner-ended'),
    rootStatus: git(fx.dir, 'status', '--porcelain'),
    headMoved: git(fx.dir, 'rev-parse', 'HEAD') !== headBefore,
    results: m.runner().filter((q) => q.turn > 0).map((q) => q.last),
  };
  return r;
}
const comment7 = () => act('comment_timone_issue', { number: 7, body: 'PROBE-R17-EVIDENCE: seen again.', reason: 'probe: the same fault' });
const fileNew = () => act('file_timone_issue', { title: 'PROBE-R17-NEW: a new fault', body: 'PROBE-R17-BODY: what was seen.', reason: 'probe: no open issue matches' });
const matched = await actOnFault([comment7]);
const filed = await actOnFault([fileNew]);

// Clause 1, code's part.
function assertListedAndCommented(r) {
  const section = r.brief.split('## Open Timone issues')[1] ?? '';
  assert(/#7: The ledger forgets which step is running/.test(section), `the open bug issue is not shown to the runner:\n${section}`);
  assert(!/#8|#9/.test(section), `closed or non-bug issues are shown to the runner:\n${section}`);
  assert(r.commentsOn7.some((c) => c.body.includes('PROBE-R17-EVIDENCE')), 'the comment was not added to the matching issue');
  assert(r.created.length === 0, `a new issue was filed: ${r.created.map((i) => i.title).join(', ')}`);
}
await clause('PRD-05.R17 clause 1 (code)', 'the open bug issues are shown to the runner; adding to the matching one comments on it and files nothing new', {
  broken: async () => assertListedAndCommented(filed),
  correct: async () => assertListedAndCommented(matched),
});
blocked('PRD-05.R17 clause 1 (runner)', 'the real runner judges the match, and its comment carries the ticket, the time and the session',
  'needs a real model: code posts the runner\'s words as given and adds no evidence of its own. No case of the replay (PRD-05.R18) sets up a fault in Timone with an open issue to match.');

// Clause 2, code's part.
function assertFiledAsBug(r) {
  assert(r.created.length === 1, `issues filed: ${r.created.length}`);
  assert(r.created[0].labels.includes('bug'), `the new issue is not labelled bug: ${r.created[0].labels}`);
  assert(r.created[0].body.includes('PROBE-R17-BODY'), 'the new issue does not carry the runner\'s words');
}
await clause('PRD-05.R17 clause 2 (code)', 'no open issue matches: a new issue labelled bug is filed on the Timone repository', {
  broken: async () => assertFiledAsBug(matched),
  correct: async () => assertFiledAsBug(filed),
});
blocked('PRD-05.R17 clause 2 (runner)', 'the new issue is in plain words and points at the ticket and the session',
  'needs a real model: those words are the runner\'s. No case of the replay (PRD-05.R18) judges them.');

// Clause 3: a network failure that a retry fixed (the model service answers "overloaded" twice, then works).
const fixedByRetry = await actOnFault([], { flaky: 2 });
const filedAfterRetry = await actOnFault([fileNew], { flaky: 2 });
function assertNothingFiled(r) {
  assert(r.ended?.ok === true, `the runner session did not recover: ${JSON.stringify(r.ended)}`);
  assert(r.created.length === 0 && r.commentsOn7.length === 0, 'something was filed on the Timone repository');
  assert(r.ticketComments.length === 0, `the ticket was told: ${r.ticketComments.map((c) => c.body.slice(0, 80)).join(' | ')}`);
}
await clause('PRD-05.R17 clause 3', 'a network failure that a retry fixed: the run carries on and nothing is filed', {
  broken: async () => assertNothingFiled(filedAfterRetry),
  correct: async () => assertNothingFiled(fixedByRetry),
});

// Clause 4: acting on a fault changes no file of Timone's (the daemon's own folder stands in for Timone's repository).
function assertNoTimoneFileChanged(r) {
  assert(r.rootStatus === '' && !r.headMoved, `Timone's folder changed: ${r.rootStatus || 'a new commit'}`);
}
const planted = { ...filed };
fs.writeFileSync(path.join(filed.fx.dir, 'process.md'), 'changed by someone\n');
planted.rootStatus = git(filed.fx.dir, 'status', '--porcelain');
fs.rmSync(path.join(filed.fx.dir, 'process.md'));
await clause('PRD-05.R17 clause 4', 'when the runner acts on a fault in Timone, no file of Timone\'s is changed', {
  broken: async () => assertNoTimoneFileChanged(planted),
  correct: async () => { assertNoTimoneFileChanged(matched); assertNoTimoneFileChanged(filed); },
});

for (const r of [matched, filed, fixedByRetry, filedAfterRetry]) r.fx.cleanup();
finish('PRD-05.R17');
