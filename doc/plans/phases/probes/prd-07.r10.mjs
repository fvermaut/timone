// Probe for PRD-07.R10 — The breakdown shows which pieces are built at the same time.
//
// Stage 7 artifact, written 2026-10-04 for phase 45's verification, from the criteria register
// alone. No source, no diff, no test suite and no handoff note was read to write it. What the
// app does was learned by running it: the `timone breakdown` command's own messages taught the
// list's format, and the fake forge's log showed how step tickets and their relations are written.
//
// Register clauses (verbatim):
//   1. GIVEN a breakdown whose pieces 2 and 3 both need piece 1 and not each other, and piece 4
//      needs both / WHEN it is put up for approval / THEN the order it shows reads "1, then 2 and
//      3 together, then 4", in those plain words or words as plain
//   2. GIVEN that breakdown approved / WHEN its step tickets are opened / THEN step tickets 2 and
//      3 are each blocked by step 1 and not by each other, and step 4 is blocked by steps 2 and 3
//
// Clause 1 is read in three parts, because "the order it shows" is shown by a list that a model
// session writes and a person approves as committed:
//   1a  the command that prints a list's order prints this shape's order in those words;
//   1b  that command refuses a list whose **Order:** line says another order, so a list that
//       passed it cannot show a wrong one;
//   1c  the session that writes the list is told to write each piece's needs, the **Order:**
//       line, to run the command before it commits, and to say the order in the same words;
//   1d  that command, run by the writing session where it runs, prints the order of the list the
//       session pushed.
// Clause 2 walks a ticket on the fake forge from pickup to an approved four-piece list, with the
// built daemon and a fake model, and reads the relations back from the forge.
//
// Break steps:
//   1a  the same list with piece 3 needing piece 2: the order is then a chain, and the assertion
//       on the clause's words must go red.
//   1b  the same list with a correct **Order:** line: nothing is refused, so it must go red.
//   1c, 1d and 2  the build before this phase (main at the phase branch's merge-base, b01ff59),
//       compiled by _old-build.mjs. There every step waits for the one above it, and the writing
//       session is told nothing about needs or the order, so both must go red there.
//
// Needs `npm run build` first. Nothing reaches GitHub or a real model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, model, daemon, act, say, bash, clause, assert, finish, OPERATOR, CLI } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';

export const BEFORE_PHASE_45 = 'b01ff596c7cdcbbf83732255105220669939c9d2';
const N = 12;
const ORDER = '1, then 2 and 3 together, then 4.';

// The list of pieces. needs: the `Needs:` line of each piece, by number; order: the **Order:** line.
const list = ({ stamp = 'Awaiting approval', needs = ['nothing', 'piece 1', 'piece 1', 'pieces 2 and 3'], order = ORDER } = {}) =>
  `# Breakdown\n\n**Status:** ${stamp}\n\n` +
  ['the store — keep the to-dos', 'the count — count the open ones', 'the filter — show only the open ones', 'the summary — the count and the filter together']
    .map((t, i) => `${i + 1}. **Piece ${i + 1}: ${t.split(' — ')[0]}** — ${t.split(' — ')[1]}. Delivers PRD-01.R${i + 1}.\n   - Needs: ${needs[i]}.\n`)
    .join('') +
  (order === null ? '' : `\n**Order:** ${order}\n`) +
  '\n---\n\n## What this is\n\nThe list of pieces.\n';

// The command, from a scratch timone root holding one project with the list committed nowhere:
// the command reads the file from the project's folder.
function breakdownCommand(text, cli = CLI) {
  const root = fs.mkdtempSync(path.join(process.env.PROBE_TMP || os.tmpdir(), 'prd07r10-'));
  const dir = path.join(root, 'projects', 'p', 'doc', 'plans', 'breakdowns');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, 'timone.yaml'), 'projects:\n  p:\n    repo_url: https://github.com/probe-owner/p.git\n    path: projects/p\n    stack:\n      - typescript\n    bindings:\n      ticketing: github\n');
  fs.writeFileSync(path.join(dir, `ticket-${N}.md`), text);
  try {
    const out = execFileSync(process.execPath, [cli, 'breakdown', 'p', String(N)], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- clause 1a

const assertShowsOrder = (r) => {
  assert(r.code === 0, `the command exited ${r.code}: ${r.out.trim()}`);
  assert(r.out.trim() === ORDER, `the order shown is "${r.out.trim()}", not "${ORDER}"`);
};
await clause('PRD-07.R10 clause 1a', 'a breakdown whose pieces 2 and 3 need piece 1 and not each other, and 4 needs both: the order it shows reads "1, then 2 and 3 together, then 4"', {
  broken: async () => assertShowsOrder(breakdownCommand(list({ needs: ['nothing', 'piece 1', 'piece 2', 'pieces 2 and 3'], order: '1, then 2, then 3, then 4.' }))),
  correct: async () => {
    const r = breakdownCommand(list());
    console.log(`    command printed: ${r.out.trim()} (exit ${r.code})`);
    assertShowsOrder(r);
  },
});

// ---------------------------------------------------------------- clause 1b

const assertRefused = (r) => {
  assert(r.code !== 0, `a list whose **Order:** line says "1, then 2, then 3, then 4." was accepted: ${r.out.trim()}`);
  assert(r.out.includes(`**Order:** ${ORDER}`), `the refusal does not name the line to write: ${r.out.trim()}`);
};
await clause('PRD-07.R10 clause 1b', 'a list put up for approval cannot show another order: one whose **Order:** line says otherwise is refused, naming the right line', {
  broken: async () => assertRefused(breakdownCommand(list())),
  correct: async () => {
    const wrong = breakdownCommand(list({ order: '1, then 2, then 3, then 4.' }));
    const missing = breakdownCommand(list({ order: null }));
    console.log(`    wrong line: exit ${wrong.code} — ${wrong.out.trim()}`);
    console.log(`    no line:    exit ${missing.code} — ${missing.out.trim()}`);
    assertRefused(wrong);
    assertRefused(missing);
  },
});

// ---------------------------------------------------------------- clause 1c

async function writerBrief(cli) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli });
  let brief;
  const m = await model({
    runner: (c) => (c.turn > 0 ? say() : act('start_step', { stage: 'breakdown', instructions: 'cut it into pieces', reason: 'probe', skipReason: 'probe: verifier fixture' })),
    step: (c) => { brief ??= c.brief; return say('done'); },
  });
  await daemon(fx, m, { until: () => brief !== undefined, timeoutMs: 60000, settleMs: 500 });
  await m.stop();
  fx.cleanup();
  return brief ?? '';
}
const assertTold = (b) => {
  assert(b.length > 0, 'no session was started to write the list');
  assert(/Needs:/.test(b), 'the session is not told to write what each piece needs');
  assert(/\*\*Order:\*\*/.test(b), 'the session is not told to write the **Order:** line');
  assert(/breakdown fixture 12/.test(b), 'the session is not told to run the command that checks the order');
  assert(/same words as the `\*\*Order:\*\*` line/.test(b), 'the session is not told to say the order in the same words in its comment');
};
await clause('PRD-07.R10 clause 1c', 'the session that writes the list is told to write each piece\'s needs and the **Order:** line, check it with the command, and say the order in the same words', {
  broken: async () => assertTold(await writerBrief(oldBuild(BEFORE_PHASE_45))),
  correct: async () => {
    const b = await writerBrief(CLI);
    for (const l of b.split('\n').filter((x) => /Needs:|Order:|breakdown fixture 12/.test(x))) console.log(`    brief: ${l.trim()}`);
    assertTold(b);
  },
});

// ---------------------------------------------------------------- clause 1d
//
// The command 1c names, run by a step session where a step session runs (the timone root), on a
// list the session itself committed and pushed to its work branch. The fixture root gets a `dist`
// link, as in _steps.mjs: the clone's push hook and the command both call `<root>/dist/cli.js`.

async function writerRunsCheck(cli) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli });
  fs.symlinkSync(path.dirname(fx.cliPath), path.join(fx.dir, 'dist'));
  const cmds = [
    'cd projects/fixture && git checkout -q -b timone/12-add-a-count-of-open-to-dos',
    `mkdir -p doc/plans/breakdowns && cat > doc/plans/breakdowns/ticket-${N}.md <<'LIST'\n${list()}LIST\ngit add -A && git -c user.email=s@example.invalid -c user.name=s commit -qm "docs: the list of pieces" && git push -q -u origin HEAD 2>&1; echo pushed=$?`,
    `cd ../.. && node dist/cli.js breakdown fixture ${N}; echo exit=$?`,
  ];
  const outs = [];
  let first;
  const m = await model({
    runner: (c) => (c.turn > 0 ? say() : act('start_step', { stage: 'breakdown', instructions: 'cut it into pieces', reason: 'probe', skipReason: 'probe: verifier fixture' })),
    step: (c) => {
      first ??= c.sid;
      if (c.sid !== first) return say('done');
      if (c.turn > 0 && c.turn <= cmds.length) outs[c.turn - 1] = c.last;
      return c.turn < cmds.length ? bash(cmds[c.turn]) : say('done');
    },
  });
  await daemon(fx, m, { until: () => outs.filter(Boolean).length >= cmds.length, timeoutMs: 60000, settleMs: 500 });
  await m.stop();
  fx.cleanup();
  return outs;
}
const assertCheckRan = (outs) => {
  assert(outs.filter(Boolean).length === 3, `the session ran ${outs.filter(Boolean).length} of 3 commands`);
  assert(/pushed=0/.test(outs[1]), `the session could not push its list: ${outs[1]}`);
  assert(outs[2].includes(ORDER) && /exit=0/.test(outs[2]), `the check, run by the session, did not print the order: ${outs[2]}`);
};
await clause('PRD-07.R10 clause 1d', 'the check the writing session is told to run, run by that session on the list it pushed, prints "1, then 2 and 3 together, then 4"', {
  broken: async () => assertCheckRan(await writerRunsCheck(oldBuild(BEFORE_PHASE_45))),
  correct: async () => {
    const outs = await writerRunsCheck(CLI);
    console.log(`    session ran the check: ${(outs[2] ?? '').trim().replace(/\n/g, ' / ')}`);
    assertCheckRan(outs);
  },
});

// ---------------------------------------------------------------- clause 2

const whyOf = (q) => q.brief.split('## The ticket')[0];
const ended = (fx, stage, k = 1) => fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === stage).length >= k;
const quiet = (fx) => ['runner-ended', 'seen'].includes(fx.record(N).at(-1)?.kind);
const PRD = '# PRD-01: A count of open to-dos\n\n> **Status:** Active\n\nShow how many to-dos are open.\n';

// A feature walked to its list of pieces, the list approved in the operator's comment.
async function approvedWalk(cli) {
  const fx = fixture({ issues: { fixture: { [N]: {} } }, cli });
  const T = {};
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const w = whyOf(c);
      if (w.includes('picked up')) return act('start_step', { stage: 'requirements', instructions: 'write it down', reason: 'probe', skipReason: 'probe: the request is clear' });
      if (w.includes('"approve the requirements"')) return act('record_approval', { what: 'requirements', commentAt: T.req, reason: 'probe' });
      if (w.includes('"now cut it into pieces"')) return act('start_step', { stage: 'breakdown', instructions: 'cut it', reason: 'probe' });
      if (w.includes('"approve the list"')) return act('record_approval', { what: 'pieces', commentAt: T.pcs, reason: 'probe' });
      return say();
    },
    step: () => say('done'),
  });
  const run = (until, ms = 40000) => daemon(fx, m, { until, timeoutMs: ms, settleMs: 1500 });
  await run(() => ended(fx, 'requirements') && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD.replace('Active', 'Draft') }, 'requirements');
  T.req = fx.comment(N, OPERATOR, 'approve the requirements');
  await run(() => ended(fx, 'requirements', 2) && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD }, 'record the requirements approval');
  fx.comment(N, OPERATOR, 'now cut it into pieces');
  await run(() => ended(fx, 'breakdown') && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: list({ stamp: `Approved by ${OPERATOR} 2026-10-04 — 4 pieces` }) }, 'the list of pieces');
  T.pcs = fx.comment(N, OPERATOR, 'approve the list');
  await run(() => fx.gh().filter((g) => g.argv[0] === 'issue' && g.argv[1] === 'create').length >= 4 && fx.gh().some((g) => g.argv.includes('timone:map') && g.argv[1] === 'edit'), 60000);
  await m.stop();
  const issues = fx.forge().issues;
  const step = (k) => Object.values(issues).find((i) => i.number !== N && i.title.startsWith(`${k}. `));
  const r = { fx, issues, step, relationCalls: fx.gh().filter((g) => g.argv.includes('--add-blocked-by')).map((g) => g.argv.join(' ')) };
  return r;
}
const blockers = (r, k) => (r.step(k)?.blockedBy ?? []).map((x) => Object.values(r.issues).find((i) => i.number === x)?.title.split('.')[0]).map(Number).sort();
const assertRelations = (r) => {
  for (const k of [1, 2, 3, 4]) assert(r.step(k), `step ticket ${k} was not opened`);
  const got = [1, 2, 3, 4].map((k) => `${k}←[${blockers(r, k).join(',')}]`).join(' ');
  assert(blockers(r, 1).length === 0, `step 1 is blocked: ${got}`);
  assert(blockers(r, 2).join(',') === '1', `step 2 is not blocked by step 1 alone: ${got}`);
  assert(blockers(r, 3).join(',') === '1', `step 3 is not blocked by step 1 alone: ${got}`);
  assert(blockers(r, 4).join(',') === '2,3', `step 4 is not blocked by steps 2 and 3 alone: ${got}`);
};
await clause('PRD-07.R10 clause 2', 'that breakdown approved: step tickets 2 and 3 are each blocked by step 1 and not by each other, and step 4 is blocked by steps 2 and 3', {
  broken: async () => {
    const r = await approvedWalk(oldBuild(BEFORE_PHASE_45));
    try { assertRelations(r); } finally { r.fx.cleanup(); }
  },
  correct: async () => {
    const r = await approvedWalk(CLI);
    try {
      for (const c of r.relationCalls) console.log(`    forge call: gh ${c}`);
      console.log(`    relations read back: ${[1, 2, 3, 4].map((k) => `step ${k} blocked by [${blockers(r, k).join(', ')}]`).join('; ')}`);
      console.log(`    map ticket: ${(r.issues[N].body.match(/^Order:.*$/m) ?? ['(no Order line)'])[0]}`);
      assertRelations(r);
    } finally { r.fx.cleanup(); }
  },
});

finish('PRD-07.R10');
