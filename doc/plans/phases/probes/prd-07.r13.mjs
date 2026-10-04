// Probe for PRD-07.R13 — A takeover is allowed while another ticket of the same project is building.
// Stage 7 artifact, authored 2026-10-04 (phase 47) from the register alone. Runs the built
// daemon and the built `timone takeover` through _rig.mjs. Needs `npm run build` first.
//
// Register clauses (verbatim):
//   1. GIVEN a ticket nothing is working on, and a step of another ticket of the same project running
//      WHEN a person runs `timone takeover <ticket>` on the first ticket
//      THEN a terminal session opens on it, and it is not refused because of the other ticket
//   2. GIVEN a ticket nothing is working on, and another ticket of the same project holding a work
//      branch or an open pull request
//      WHEN a person runs `timone takeover <ticket>` on the first ticket
//      THEN a terminal session opens on it, and it is not refused because of the other ticket
//   3. GIVEN a ticket whose own step the machine is working on
//      WHEN a person runs `timone takeover <ticket>` on it
//      THEN no session opens, and the message says what is happening, as today
//
// Ticket 12's runner does nothing when it is picked up, so nothing is working on it. Ticket 13
// is then put into the state the clause names. `timone takeover fixture#12` is run with the
// daemon running. A stand-in `claude` on PATH plays the terminal session: it records how it was
// started and ends at once. "A session opens" is that record naming the ticket.
//
// Break legs. Clauses 1 and 2: the same fixture on the build from just before phase 47
// (_places.mjs's BEFORE_PHASE_47), whose takeover was refused there (PRD-05.R11's old note,
// checked by prd-05.r11.mjs up to phase 46). Clause 3: the takeover of ticket 12 while nothing
// works on it, where a session does open.
import fs from 'node:fs';
import path from 'node:path';
import { fixture, model, daemon, say, sleep, clause, assert, finish, OPERATOR } from './_rig.mjs';
import { before47, START, tk, whyOf, addTicket, startTakeover, runsLine, started } from './_places.mjs';

const REAL_ONLY = process.env.PROBE_REAL_ONLY === '1';
const N = 12, OTHER = 13;

function standIn(fx) {
  fs.writeFileSync(path.join(fx.dir, 'bin', 'claude'), ['#!/bin/sh', `printf '%s\\n' "$@" > "${path.join(fx.dir, 'takeover-prompt.txt')}"`, 'exit 0', ''].join('\n'));
  fs.chmodSync(path.join(fx.dir, 'bin', 'claude'), 0o755);
}
const promptOf = (fx) => (fs.existsSync(path.join(fx.dir, 'takeover-prompt.txt')) ? fs.readFileSync(path.join(fx.dir, 'takeover-prompt.txt'), 'utf8') : '');

// other: 'step-running' | 'branch' | 'pr-open' (ticket 13's state) | 'self-step' (ticket 12's own step runs) | 'none'
async function takeoverWhile({ other, cli }) {
  const fx = fixture({ issues: { fixture: { [N]: { title: 'Ticket to take over', createdAt: '2026-09-01T10:00:00.000Z' } } }, cli });
  standIn(fx);
  let pr = null;
  const m = await model({
    runner: (c) => {
      if (c.turn > 0) return say();
      const t = tk(c), w = whyOf(c);
      if (t === N) return other === 'self-step' && w.includes('picked up') ? START() : say();
      if (w.includes('picked up')) return START();
      if (other === 'pr-open' && /step building ended/i.test(w)) return START('delivery');
      return say();
    },
    step: (c) => {
      if (c.turn > 0) return say('done');
      const me = fx.state().runs.find((r) => r.status === 'active' && r.stage);
      if (!me || me.ticket === N || other === 'step-running') return { hang: true };
      if (me.stage === 'execution' && me.branch) fx.pushBranch(me.branch, { 'src/other.ts': 'export const other = 1;\n' }, 'the other build');
      if (me.stage === 'delivery') pr = fx.editForge((f) => { const num = f.nextNumber++; f.prs[num] = { number: num, title: 'Other', body: `For #${OTHER}.`, head: me.branch, base: 'main', state: 'OPEN', createdAt: new Date().toISOString(), comments: [] }; return num; });
      return say('done');
    },
  });
  const otherReady = () => {
    const o = fx.run(OTHER);
    const quiet = ['runner-ended', 'seen'].includes(fx.record(OTHER).at(-1)?.kind);
    if (other === 'step-running') return started(fx, OTHER).length > 0;
    if (other === 'branch') return o?.status === 'parked' && o.branch && fx.remoteHead(o.branch) && quiet && fx.record(OTHER).some((e) => e.kind === 'step-ended');
    if (other === 'pr-open') return pr && o?.status === 'parked' && quiet && fx.record(OTHER).some((e) => e.kind === 'step-ended' && e.stage === 'delivery');
    return true;
  };
  const selfReady = () => (other === 'self-step' ? started(fx, N).length > 0 : fx.record(N).some((e) => e.kind === 'runner-ended'));
  let added = other === 'self-step' || other === 'none', t = null, given = null;
  await daemon(fx, m, {
    until: () => {
      if (!added && selfReady()) { added = true; addTicket(fx, OTHER, { title: 'Other ticket', createdAt: '2026-09-02T10:00:00.000Z' }); }
      if (added && !t && selfReady() && otherReady()) { given = { runs: runsLine(fx), mine: fx.run(N)?.status, other: fx.run(OTHER) }; t = startTakeover(fx, m, N); }
      return t && t.code !== null;
    },
    timeoutMs: 60000, settleMs: 1500,
  });
  if (t) await Promise.race([t.done, sleep(10000)]);
  await m.stop();
  return { other, fx, given, said: (t?.out ?? '').trim(), code: t?.code, prompt: promptOf(fx), pr };
}

const [whileStep, whileBranch, whilePr, ownStep, nothing] = await Promise.all(['step-running', 'branch', 'pr-open', 'self-step', 'none'].map((other) => takeoverWhile({ other })));
const OLD = REAL_ONLY ? null : before47();
const [oldStep, oldBranch, oldPr] = REAL_ONLY ? [] : await Promise.all(['step-running', 'branch', 'pr-open'].map((other) => takeoverWhile({ other, cli: OLD })));

const opened = (r) => r.prompt.includes(`fixture #${N}`) || r.prompt.includes(`fixture#${N}`);
function assertOpened(r, setup) {
  assert(r.given, `setup: the fixture never reached its state (${runsLine(r.fx)})`);
  assert(r.given.mine !== 'active', `setup: ticket ${N}'s run is ${r.given.mine}, so something is working on it`);
  setup(r);
  assert(opened(r), `no terminal session opened on the ticket; takeover said, exit ${r.code}: "${r.said.replace(/\n/g, ' ')}"`);
}
const stepRuns = (r) => assert(r.given.other?.status === 'active', `setup: ticket ${OTHER}'s step is not running (${r.given.runs})`);
const holdsBranch = (r) => assert(r.given.other?.status === 'parked' && r.given.other.branch && r.fx.remoteHead(r.given.other.branch), `setup: ticket ${OTHER} holds no work branch (${r.given.runs})`);
const hasPr = (r) => assert(r.pr && r.given.other?.status === 'parked', `setup: ticket ${OTHER} has no open pull request (${r.given.runs})`);

await clause('PRD-07.R13 clause 1', 'a ticket nothing is working on, and a step of another ticket of the same project running: timone takeover on the first ticket opens a terminal session on it, and it is not refused because of the other ticket', {
  broken: async () => assertOpened(oldStep, stepRuns),
  correct: async () => assertOpened(whileStep, stepRuns),
});
console.log(`    (runs at the takeover: ${whileStep.given?.runs}. Takeover said, exit ${whileStep.code}: "${whileStep.said.replace(/\n/g, ' ')}")`);
if (oldStep) console.log(`    (break leg, the build before phase 47, exit ${oldStep.code}: "${oldStep.said.replace(/\n/g, ' ').slice(0, 240)}")`);
await clause('PRD-07.R13 clause 2 (work branch)', 'a ticket nothing is working on, and another ticket of the same project holding a work branch: timone takeover on the first ticket opens a terminal session on it, and it is not refused because of the other ticket', {
  broken: async () => assertOpened(oldBranch, holdsBranch),
  correct: async () => assertOpened(whileBranch, holdsBranch),
});
console.log(`    (runs at the takeover: ${whileBranch.given?.runs}. Takeover said, exit ${whileBranch.code}: "${whileBranch.said.replace(/\n/g, ' ')}")`);
if (oldBranch) console.log(`    (break leg, the build before phase 47, exit ${oldBranch.code}: "${oldBranch.said.replace(/\n/g, ' ').slice(0, 240)}")`);
await clause('PRD-07.R13 clause 2 (open pull request)', 'a ticket nothing is working on, and another ticket of the same project with an open pull request: timone takeover on the first ticket opens a terminal session on it, and it is not refused because of the other ticket', {
  broken: async () => assertOpened(oldPr, hasPr),
  correct: async () => assertOpened(whilePr, hasPr),
});
console.log(`    (runs at the takeover: ${whilePr.given?.runs}. Takeover said, exit ${whilePr.code}: "${whilePr.said.replace(/\n/g, ' ')}")`);
if (oldPr) console.log(`    (break leg, the build before phase 47, exit ${oldPr.code}: "${oldPr.said.replace(/\n/g, ' ').slice(0, 240)}")`);

function assertRefusedOwn(r, { breakLeg = false } = {}) {
  assert(r.given, `setup: the fixture never reached its state (${runsLine(r.fx)})`);
  if (!breakLeg) assert(r.given.mine === 'active', `setup: ticket ${N}'s own step is not running (${r.given.runs})`);
  assert(!opened(r), `a terminal session opened on the ticket: "${r.prompt.split('\n')[0].slice(0, 120)}"`);
  assert(/working on/i.test(r.said) && r.said.includes(`#${N}`), `the message does not say what is happening: "${r.said.replace(/\n/g, ' ').slice(0, 200)}"`);
}
await clause('PRD-07.R13 clause 3', 'a ticket whose own step the machine is working on: timone takeover on it opens no session, and the message says what is happening, as today', {
  broken: async () => assertRefusedOwn(nothing, { breakLeg: true }),
  correct: async () => assertRefusedOwn(ownStep),
});
console.log(`    (runs at the takeover: ${ownStep.given?.runs}. Takeover said, exit ${ownStep.code}: "${ownStep.said.replace(/\n/g, ' ')}")`);

for (const r of [whileStep, whileBranch, whilePr, ownStep, nothing, oldStep, oldBranch, oldPr]) r?.fx.cleanup();
finish('PRD-07.R13');
