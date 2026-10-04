// Verifier helpers for PRD-08 (stage 7 artifact), written 2026-10-04 for phase 46's verification,
// from the register alone. No source, no diff, no test suite and no handoff note was read.
//
// approvedWalk() walks one ticket of a fixture project, on the fake forge with the built daemon
// and a fake model, from pickup to an approved list of three pieces, so that the daemon opens the
// step tickets itself. What a step ticket's title looks like ("1. Piece 1: the store") was learned
// by running the daemon and reading what it asked the fake forge to create.
import path from 'node:path';
import { fixture, model, daemon, act, say } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';

// main at the phase-46 branch's merge-base: the build before this phase.
export const BEFORE_PHASE_46 = 'a217b74bc6f7eb13d29cb4b21f0b55593a1c809f';
export const oldCli = () => oldBuild(BEFORE_PHASE_46);
export const distOf = (cli) => path.dirname(cli);

export const N = 12;
export const PIECES = [['the store', 'keep the to-dos'], ['the count', 'count the open ones'], ['the filter', 'show only the open ones']];
export const list = (stamp) => `# Breakdown\n\n**Status:** ${stamp}\n\n` +
  PIECES.map(([h, t], i) => `${i + 1}. **Piece ${i + 1}: ${h}** — ${t}. Delivers PRD-01.R${i + 1}.\n   - Needs: ${i === 0 ? 'nothing' : 'piece 1'}.\n`).join('') +
  `\n**Order:** 1, then 2 and 3 together.\n\n---\n\n## What this is\n\nThe list of pieces.\n`;
export const stepTitle = (k) => `${k}. Piece ${k}: ${PIECES[k - 1][0]}`;

const whyOf = (q) => q.brief.split('## The ticket')[0];
const ended = (fx, stage, k = 1) => fx.record(N).filter((e) => e.kind === 'step-ended' && e.stage === stage).length >= k;
const quiet = (fx) => ['runner-ended', 'seen'].includes(fx.record(N).at(-1)?.kind);
const PRD = '# PRD-01: A count of open to-dos\n\n> **Status:** Active\n\nShow how many to-dos are open.\n';

// opts: cli, operator, instructors (of the fixture project), approver (writes every comment),
// plant(forge) to edit the forge before the daemon first runs, until(fx) to end the last run.
export async function approvedWalk({ cli, operator = 'fvermaut', instructors, approver = operator, plant, until } = {}) {
  const fx = fixture({ cli, operator, projects: { fixture: instructors ? { instructors } : {} }, issues: { fixture: { [N]: { author: approver } } } });
  if (plant) fx.editForge(plant);
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
  const run = (u, ms = 40000) => daemon(fx, m, { until: u, timeoutMs: ms, settleMs: 1500 });
  await run(() => ended(fx, 'requirements') && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD.replace('Active', 'Draft') }, 'requirements');
  T.req = fx.comment(N, approver, 'approve the requirements');
  await run(() => ended(fx, 'requirements', 2) && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { 'doc/specs/prd/prd-01-count.md': PRD }, 'record the requirements approval');
  fx.comment(N, approver, 'now cut it into pieces');
  await run(() => ended(fx, 'breakdown') && quiet(fx));
  fx.pushBranch(fx.run(N).branch, { [`doc/plans/breakdowns/ticket-${N}.md`]: list(`Approved by ${approver} 2026-10-04 — 3 pieces`) }, 'the list of pieces');
  T.pcs = fx.comment(N, approver, 'approve the list');
  await run(until ?? ((f) => f.gh().some((g) => g.argv[0] === 'issue' && g.argv[1] === 'edit' && g.argv.includes('timone:map'))), 60000);
  await m.stop();
  const issues = fx.forge().issues;
  return {
    fx, issues,
    steps: (k) => Object.values(issues).filter((i) => i.number !== N && i.title === stepTitle(k)),
    creates: fx.gh().filter((g) => g.argv[0] === 'issue' && g.argv[1] === 'create'),
  };
}

// The runner files a Timone issue on its first wake, with the given words. projects as fixture().
export async function fileTimoneIssue({ cli, operator = 'fvermaut', projects, author = operator, body }) {
  const fx = fixture({ cli, operator, projects, issues: { fixture: { [N]: { author } } } });
  const m = await model({ runner: (c) => (c.wake === 0 && c.turn === 0 ? act('file_timone_issue', { title: 'PROBE-R08: a fault in Timone', body, reason: 'probe: a fault in Timone' }) : say()) });
  await daemon(fx, m, { until: (f) => f.record(N).some((e) => e.kind === 'runner-ended'), timeoutMs: 40000, settleMs: 1000 });
  await m.stop();
  const filed = Object.values(fx.forge().others['probe-owner/timone']?.issues ?? {});
  return { fx, filed, creates: fx.gh().filter((g) => g.argv[0] === 'issue' && g.argv[1] === 'create') };
}

// A logins-named check that ignores names inside backticks: GitHub notifies nobody named in code.
export const namesInPlainText = (body) => new Set([...body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').matchAll(/(^|[^\w`])@([A-Za-z0-9][A-Za-z0-9-]*)/g)].map((x) => x[2]));
