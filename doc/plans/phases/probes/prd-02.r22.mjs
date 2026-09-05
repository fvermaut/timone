// Probe for PRD-02.R22 — A ticket hosts a sequence of chunks.
//
// Stage 7 artifact. Written from the criteria register alone; no source, no
// diff, no test suite and no handoff note was read to write it.
//
// Register clauses (verbatim, in register order). The phase-34 header numbers
// the last one "clause 7"; the register lists eight, and this file labels them
// by the register's own order:
//
//   1. GIVEN an initiative whose step tickets are partly closed, and whose
//      current run has ended / WHEN the daemon next polls the project / THEN
//      the step it takes up is the first step ticket that is open, unblocked
//      and unassigned, decided from the tickets themselves and never from a
//      count of runs — and a step whose ticket declares a dependency on an
//      open step is not eligible
//   2. GIVEN a ticket whose current chunk is `failed` / WHEN the daemon polls
//      the project on that cycle and on every later one / THEN no further
//      chunk is opened — the ledger still names the failed chunk as the
//      ticket's current one — and `timone retry <project>#<ticket>` re-arms
//      that same chunk in place, at the stage it died, keeping its branch and
//      its sequence number
//   3. GIVEN an approved specification for a ticket whose work is more than
//      one chunk / WHEN the planning stage runs / THEN the breakdown … is
//      committed …, its readable list posted as a ticket comment, and the
//      ticket waits on exactly one approval …
//   4. GIVEN an approved breakdown / WHEN a chunk's phase file is written and
//      committed / THEN the chunk builds without any approval request for
//      that phase file appearing on the ticket …
//   5. GIVEN a step ticket's pull request is merged / WHEN the daemon next
//      polls the project / THEN that step ticket is closed …
//   6. GIVEN a ticket between two chunks … and another marked ticket queued on
//      the same project / WHEN the daemon next polls / THEN the queued
//      ticket's run starts in that window …
//   7. GIVEN a run in any state the ledger admits — queued, parked, active or
//      failed / WHEN `timone cancel <project>#<ticket>` is run against it /
//      THEN the chunk ends `cancelled` carrying a reason, its project is
//      released, and `.timone/state.json` needs no hand-edit for any of it
//   8. GIVEN a ticket that has been closed, or had its mark removed, while a
//      run for it stands in the ledger / WHEN the daemon next polls the
//      project / THEN that run is cancelled with a reason and no session is
//      spawned for it, asserted on the spawn itself rather than on the absence
//      of a log line
//
// Clauses 1, 3, 4, 5 and 6 are NOT DRIVEN by this file and print a label
// saying so. Each of them needs an initiative with an approved breakdown, step
// tickets carrying GitHub's own `blocked by` relation, a merged pull request,
// or a model-driven stage session actually writing a breakdown — none of which
// this pass can stand up from a terminal. They are recorded as a coverage gap
// in the verification report rather than passed silently.
//
// How the app is driven, and where the boundaries are cut:
//   * a temporary git working copy standing in for a timone root, declaring one
//     fixture project, committed clean (the daemon refuses to spawn from a
//     dirty root);
//   * the ledger is a copy passed with `--state`, never the live file, exactly
//     as the criterion's verification hint asks;
//   * the forge is cut at the `gh` command line: a shim earlier on PATH answers
//     `gh` from a JSON world file and records every call;
//   * the App credential mint is cut at `fetch`;
//   * the session spawn is cut at the agent SDK module itself, so "no session
//     is spawned" is asserted on the spawn call and not on a missing log line,
//     which is what clause 8 demands.
//
// A parked run in the fixture ledger names what it is waiting on, and its
// ticket's newest comment is Timone's own question. Both matter: a park with no
// wait recorded, or a thread with no question on it, is read as answered and
// resumed on the next cycle, which is a different behaviour from the one under
// test here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CLI, sh, clause, assert, finish } from './_lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-prd02r22-'));
const H = path.join(tmp, 'harness');
fs.mkdirSync(path.join(H, 'bin'), { recursive: true });

// ---------------------------------------------------------------- the shims

fs.writeFileSync(
  path.join(H, 'bin', 'gh.mjs'),
  `import fs from 'node:fs';
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(argv) + '\\n');
const world = JSON.parse(fs.readFileSync(process.env.GH_WORLD, 'utf8'));
const out = (v) => { process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v)); process.exit(0); };
const issues = world.issues || [];
const full = (i) => ({ number: i.number, title: i.title ?? 'a fixture ticket', body: i.body ?? 'please do a thing', labels: i.labels ?? [{ name: 'timone' }], url: i.url ?? ('https://github.com/fvermaut/scratch-app/issues/' + i.number), author: i.author ?? { login: 'fvermaut' }, createdAt: i.createdAt ?? '2026-09-01T00:00:00Z', state: i.state ?? 'OPEN', comments: i.comments ?? [], assignees: i.assignees ?? [] });
if (argv[0] === 'issue' && argv[1] === 'list') out(issues.filter((i) => (i.state ?? 'OPEN') === 'OPEN' && (i.labels ?? [{ name: 'timone' }]).some((l) => l.name === 'timone')).map(full));
if (argv[0] === 'issue' && argv[1] === 'view') { const i = issues.find((x) => String(x.number) === String(argv[2])); if (!i) { process.stderr.write('not found\\n'); process.exit(1); } out(full(i)); }
if (argv[0] === 'issue') out('ok\\n');
if (argv[0] === 'pr') out(world.pr ?? []);
if (argv[0] === 'api') {
  const q = argv.find((a) => String(a).startsWith('query=')) ?? '';
  if (/defaultBranchRef/.test(q)) out({ data: { repository: { defaultBranchRef: { name: 'main', target: { oid: 'a'.repeat(40) } } } } });
  out({ data: { repository: {} } });
}
out([]);
`,
);
fs.writeFileSync(path.join(H, 'bin', 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(H, 'bin', 'gh.mjs')}" "$@"\n`);
fs.chmodSync(path.join(H, 'bin', 'gh'), 0o755);

// The agent SDK, replaced by a recorder. A spawn writes one line and returns an
// empty stream; nothing about the session's own behaviour is under test here.
fs.writeFileSync(
  path.join(H, 'fake-sdk.mjs'),
  `import fs from 'node:fs';
export function query(opts) {
  fs.appendFileSync(process.env.SPAWN_LOG, JSON.stringify({ prompt: String(opts && opts.prompt).slice(0, 300) }) + '\\n');
  return (async function* () {})();
}
export function tool() { return { name: 'tool' }; }
export function createSdkMcpServer() { return {}; }
export default { query, tool, createSdkMcpServer };
`,
);
fs.writeFileSync(
  path.join(H, 'loader.mjs'),
  `export async function resolve(spec, ctx, next) {
  if (spec === '@anthropic-ai/claude-agent-sdk') return { url: ${JSON.stringify('file://' + path.join(H, 'fake-sdk.mjs'))}, shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
`,
);
fs.writeFileSync(
  path.join(H, 'preload.mjs'),
  `import { register } from 'node:module';
register(${JSON.stringify('file://' + path.join(H, 'loader.mjs'))});
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  const body = /access_tokens/.test(url)
    ? JSON.stringify({ token: 'ghs_probe_fixture', expires_at: '2030-01-01T00:00:00Z' })
    : '[]';
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
};
`,
);

const GH_LOG = path.join(H, 'gh.log');
const SPAWN_LOG = path.join(H, 'spawn.log');

// ---------------------------------------------------------------- the world

let n = 0;
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' });

// A clean timone root declaring one fixture project. Committed, because the
// daemon refuses to start a session from a root with uncommitted changes.
function world() {
  const root = path.join(tmp, `w${n++}`);
  fs.mkdirSync(root, { recursive: true });
  sh('git init -q -b main .', root);
  sh('git config user.email probe@timone.invalid && git config user.name probe', root);
  fs.writeFileSync(path.join(root, 'key.pem'), PEM);
  fs.writeFileSync(
    path.join(root, 'timone.yaml'),
    [
      'identity:',
      '  app_id: 1',
      '  installation_id: 2',
      '  private_key_path: key.pem',
      '  login: fixture-agent[bot]',
      '  commit_email: fixture@users.noreply.github.com',
      'projects:',
      '  fixture:',
      '    repo_url: https://github.com/fvermaut/scratch-app.git',
      '    path: projects/fixture',
      '    stack:',
      '      - typescript',
      '    bindings:',
      '      ticketing: github',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(path.join(root, '.gitignore'), 'projects/\n');
  sh('git add -A && git commit -qm root', root);
  return root;
}

// A thread whose newest comment is Timone's own question — the shape of a
// ticket that is genuinely waiting on a person, so nothing resumes the park.
const WAITING_THREAD = [
  { id: '1', author: { login: 'fvermaut' }, body: 'please do a thing', createdAt: '2026-09-01T00:00:00Z', url: 'https://example.invalid/c1' },
  { id: '2', author: { login: 'fixture-agent[bot]' }, body: '**What I need from you:** an answer on this ticket.', createdAt: '2026-09-02T00:00:00Z', url: 'https://example.invalid/c2' },
];

// A parked run, as the ledger records one: it names what it waits on.
const PARKED = { status: 'parked', stage: 'planning', wait: { kind: 'conversation', on: 'an answer' } };

const run = (over = {}) => ({
  id: `fixture#${over.ticket}/${over.seq ?? 1}`,
  project: 'fixture',
  seq: 1,
  flags: [],
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
  ...over,
});

function ledger(runs) {
  const f = path.join(tmp, `state-${n}-${Math.abs(runs.length + n)}-${process.hrtime.bigint()}.json`);
  fs.writeFileSync(f, JSON.stringify({ version: 1, runs }));
  return f;
}

const readLedger = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).runs;
const runOf = (f, id) => readLedger(f).find((r) => r.id === id);

function issues(list) {
  const f = path.join(tmp, `world-${process.hrtime.bigint()}.json`);
  fs.writeFileSync(f, JSON.stringify({ issues: list }));
  return f;
}

// Run the built CLI with the forge, the credential mint and the agent SDK cut.
function timone(args, { root, state, worldFile }) {
  fs.writeFileSync(GH_LOG, '');
  fs.writeFileSync(SPAWN_LOG, '');
  let code = 0;
  let out = '';
  try {
    out = execFileSync(
      process.execPath,
      ['--import', 'file://' + path.join(H, 'preload.mjs'), CLI, ...args, '--state', state],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${path.join(H, 'bin')}:${process.env.PATH}`,
          GH_LOG,
          SPAWN_LOG,
          GH_WORLD: worldFile,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).toString();
  } catch (e) {
    code = e.status ?? 1;
    out = `${(e.stdout ?? '').toString()}${(e.stderr ?? '').toString()}`;
  }
  return {
    code,
    out,
    spawns: fs.readFileSync(SPAWN_LOG, 'utf8').trim().split('\n').filter(Boolean),
    gh: fs.readFileSync(GH_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)),
  };
}

const poll = (o) => timone(['daemon', '--once', '--runtime', 'in-process'], o);

// ============================================================== clause 8 ====
// The clause this phase claims.

function pollWithParkedOccupier(ticket) {
  const root = world();
  const state = ledger([run({ ticket: 7, ...PARKED, branch: 'timone/7-fixture' })]);
  const worldFile = issues(ticket ? [{ ...ticket, comments: WAITING_THREAD }] : []);
  const r = poll({ root, state, worldFile });
  return { r, state };
}

// open and still marked — the run must be left alone
const STILL_LISTED = { number: 7, labels: [{ name: 'timone' }] };
// open, but the mark was taken off
const UNMARKED = { number: 7, labels: [{ name: 'bug' }] };
// closed, still marked — gone from the cycle's listing of open marked tickets
const CLOSED = { number: 7, state: 'CLOSED', labels: [{ name: 'timone' }] };

clause(
  'PRD-02.R22 clause 8a',
  'a ticket closed while a run for it stands in the ledger — that run is cancelled with a reason',
  {
    broken: () => {
      // The ticket is still open and marked, so the run must be left alone and
      // the "it was cancelled" assertion has to go red.
      const { r, state } = pollWithParkedOccupier(STILL_LISTED);
      assertCancelledWithReason(state, r);
    },
    correct: () => {
      // The ticket is closed, so it is gone from the cycle's listing.
      const { r, state } = pollWithParkedOccupier(CLOSED);
      assertCancelledWithReason(state, r);
    },
  },
);

function assertCancelledWithReason(state, r) {
  const run7 = runOf(state, 'fixture#7/1');
  assert(run7 !== undefined, 'the fixture run vanished from the ledger');
  assert(
    run7.status === 'cancelled',
    `the run holding the project is still "${run7.status}" after the poll:\n${r.out}`,
  );
  assert(
    typeof run7.cancellation === 'string' && run7.cancellation.trim().length > 0,
    'the run was cancelled without a reason recorded',
  );
}

clause(
  'PRD-02.R22 clause 8b',
  'a ticket whose mark was removed while a run for it stands in the ledger — that run is cancelled with a reason',
  {
    broken: () => {
      // The mark is still on the ticket, so nothing may be cancelled.
      const { r, state } = pollWithParkedOccupier(STILL_LISTED);
      assertCancelledWithReason(state, r);
    },
    correct: () => {
      const { r, state } = pollWithParkedOccupier(UNMARKED);
      assertCancelledWithReason(state, r);
    },
  },
);

clause(
  'PRD-02.R22 clause 8c',
  'and no session is spawned for it, asserted on the spawn itself rather than on the absence of a log line',
  {
    broken: () => {
      // A marked ticket with nothing in the ledger: the daemon picks it up and
      // starts a session, the recorder sees the agent SDK called, and "no
      // spawn" goes red. This is the transport proof — it shows the recorder
      // is wired to the path a real spawn takes.
      const root = world();
      const state = ledger([]);
      const worldFile = issues([{ number: 7 }]);
      const r = poll({ root, state, worldFile });
      assertNoSpawn(r);
    },
    correct: () => {
      const { r } = pollWithParkedOccupier(CLOSED);
      assertNoSpawn(r);
    },
  },
);

function assertNoSpawn(r) {
  assert(
    r.spawns.length === 0,
    `a session was spawned: ${r.spawns.length} agent-SDK call(s) — first prompt: ${r.spawns[0] ?? ''}`,
  );
}

// ============================================================== clause 7 ====

for (const status of ['queued', 'parked', 'active', 'failed']) {
  clause(
    `PRD-02.R22 clause 7 (${status})`,
    'timone cancel against a run in any state the ledger admits — the chunk ends cancelled carrying a reason',
    {
      broken: () => {
        // No run for that ticket at all: nothing can end cancelled.
        const root = world();
        const state = ledger([run({ ticket: 99, status, branch: 'timone/99-x', stage: 'planning' })]);
        const worldFile = issues([]);
        const r = timone(['cancel', 'fixture#9', '--reason', 'probe: stopping this on purpose'], { root, state, worldFile });
        assertCancelled(state, 'fixture#9/1', r);
      },
      correct: () => {
        const root = world();
        const state = ledger([run({ ticket: 9, status, branch: 'timone/9-x', stage: 'planning' })]);
        const worldFile = issues([]);
        const r = timone(['cancel', 'fixture#9', '--reason', 'probe: stopping this on purpose'], { root, state, worldFile });
        assertCancelled(state, 'fixture#9/1', r);
      },
    },
  );
}

function assertCancelled(state, id, r) {
  const run9 = runOf(state, id);
  assert(run9 !== undefined, `no run ${id} in the ledger:\n${r.out}`);
  assert(run9.status === 'cancelled', `the run is "${run9.status}", not cancelled:\n${r.out}`);
  assert(
    typeof run9.cancellation === 'string' && run9.cancellation.includes('probe: stopping this on purpose'),
    `the reason given on the command line was not recorded: ${JSON.stringify(run9.cancellation)}`,
  );
}

clause(
  'PRD-02.R22 clause 7 (release)',
  'its project is released, and `.timone/state.json` needs no hand-edit for any of it',
  {
    broken: () => {
      // The occupier is not cancelled, so it keeps holding the project and the
      // queued run behind it cannot move.
      const root = world();
      const state = ledger([
        run({ ticket: 9, ...PARKED, branch: 'timone/9-x' }),
        run({ ticket: 10, status: 'queued' }),
      ]);
      const worldFile = issues([{ number: 9, comments: WAITING_THREAD }, { number: 10 }]);
      poll({ root, state, worldFile });
      assertReleased(state);
    },
    correct: () => {
      const root = world();
      const state = ledger([
        run({ ticket: 9, ...PARKED, branch: 'timone/9-x' }),
        run({ ticket: 10, status: 'queued' }),
      ]);
      const worldFile = issues([{ number: 9, comments: WAITING_THREAD }, { number: 10 }]);
      // The command alone, with no hand-edit of the ledger file.
      const before = fs.statSync(state).mtimeMs;
      const c = timone(['cancel', 'fixture#9', '--reason', 'probe: stopping this on purpose'], { root, state, worldFile });
      assert(c.code === 0, `cancel exited ${c.code}:\n${c.out}`);
      assert(fs.statSync(state).mtimeMs !== before, 'the ledger was not written by the command');
      poll({ root, state, worldFile });
      assertReleased(state);
    },
  },
);

function assertReleased(state) {
  const queued = runOf(state, 'fixture#10/1');
  assert(queued !== undefined, 'the queued run vanished');
  assert(
    queued.status !== 'queued',
    'the project was not released: the run queued behind the cancelled one is still queued',
  );
}

// ============================================================== clause 2 ====

clause(
  'PRD-02.R22 clause 2a',
  'a ticket whose current chunk is `failed` — no further chunk is opened, and the ledger still names the failed chunk as the ticket\'s current one',
  {
    broken: () => {
      // The chunk is `done` instead of `failed`: the ticket is still open and
      // marked, so a successor chunk is opened and the assertion goes red.
      const root = world();
      const state = ledger([run({ ticket: 9, status: 'done', branch: 'timone/9-x', stage: 'delivery' })]);
      const worldFile = issues([{ number: 9 }]);
      poll({ root, state, worldFile });
      poll({ root, state, worldFile });
      assertNoSuccessor(state);
    },
    correct: () => {
      const root = world();
      const state = ledger([run({ ticket: 9, status: 'failed', branch: 'timone/9-x', stage: 'planning', failure: 'the session stopped' })]);
      const worldFile = issues([{ number: 9 }]);
      poll({ root, state, worldFile }); // that cycle
      poll({ root, state, worldFile }); // and every later one
      assertNoSuccessor(state);
    },
  },
);

function assertNoSuccessor(state) {
  const rs = readLedger(state).filter((r) => r.ticket === 9);
  assert(
    rs.length === 1,
    `a further chunk was opened: ${rs.map((r) => `${r.id}=${r.status}`).join(', ')}`,
  );
  assert(rs[0].id === 'fixture#9/1', `the ledger no longer names the first chunk: ${rs[0].id}`);
}

clause(
  'PRD-02.R22 clause 2b',
  '`timone retry <project>#<ticket>` re-arms that same chunk in place, at the stage it died, keeping its branch and its sequence number',
  {
    broken: () => {
      // Nothing failed, so there is nothing to re-arm.
      const root = world();
      const state = ledger([run({ ticket: 9, status: 'done', branch: 'timone/9-x', stage: 'delivery' })]);
      const worldFile = issues([{ number: 9 }]);
      const r = timone(['retry', 'fixture#9'], { root, state, worldFile });
      assertReArmed(state, r);
    },
    correct: () => {
      const root = world();
      const state = ledger([run({ ticket: 9, status: 'failed', branch: 'timone/9-x', stage: 'planning', failure: 'the session stopped' })]);
      const worldFile = issues([{ number: 9 }]);
      const r = timone(['retry', 'fixture#9'], { root, state, worldFile });
      assertReArmed(state, r);
    },
  },
);

function assertReArmed(state, r) {
  const rs = readLedger(state).filter((x) => x.ticket === 9);
  assert(rs.length === 1, `retry did not re-arm in place — the ledger now holds ${rs.length} chunks for #9`);
  const only = rs[0];
  assert(only.status !== 'failed' && only.status !== 'done', `the chunk was not re-armed: still "${only.status}"\n${r.out}`);
  assert(only.seq === 1, `the sequence number moved to ${only.seq}`);
  assert(only.branch === 'timone/9-x', `the branch changed to ${only.branch}`);
  assert(only.stage === 'planning', `the stage moved to ${only.stage}, not the one it died at`);
}

// ==================================================== clauses not driven ====
// Printed, never silently skipped. Each names what would be needed.

for (const [id, why] of [
  ['PRD-02.R22 clause 1', 'the frontier rule — needs an initiative with step tickets carrying GitHub\'s own `blocked by` relation and a hold label, which this pass cannot stand up from a terminal'],
  ['PRD-02.R22 clause 3', 'the breakdown and the one approval — needs a model-driven planning session actually writing the breakdown file'],
  ['PRD-02.R22 clause 4', 'no gate between the breakdown\'s approval and the chunk\'s pull request — needs a chunk built end to end'],
  ['PRD-02.R22 clause 5', 'a merged pull request closing its step ticket — needs a real pull request on a real forge'],
  ['PRD-02.R22 clause 6', 'a queued ticket starting between two chunks of an initiative — needs the initiative and its breakdown, as clause 3 does'],
]) {
  console.log(`=== ${id} — NOT DRIVEN`);
  console.log(`    ${why}`);
}

finish('PRD-02.R22 (clauses 2, 7 and 8)');
