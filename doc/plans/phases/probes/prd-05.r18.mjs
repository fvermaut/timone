// Probe for PRD-05.R18 — The runner passes a replay of the recorded failures.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The replay set is the
// criterion's own instrument (`npm run replay`, which calls the real model). This probe runs it
// only where a model login exists, and judges its printed result against the clause: every case of
// the register's table, three tries each, all passing. Where there is no login it says BLOCKED.
// It costs about $2.50 a run.
//
// Register clauses (verbatim):
//   1. GIVEN each case in the table below, set up as a fixture: the ticket's comments, the branch's
//      state and the run record at that moment
//      WHEN the runner is woken on it with fake actions that only record what is called
//      THEN it chooses the action in the table's last column
//      AND it does so on each of three separate tries
//   2. GIVEN a change to the runner's instructions WHEN the change is proposed
//      THEN the replay set is run, and its result is on the pull request
import { execFileSync } from 'node:child_process';
import { clause, blocked, assert, finish, REPO_ROOT } from './_rig.mjs';

// The 19 cases of the register's table, by the ticket they are named after.
const CASES = ['#139', '#140', '#144', '#143, #161', '#99', '#115', '#142', '#108', '#111', '#159', '#117', '#120', '#125, #135', '#132', '#147', '#104', 'scratch-app#37', 'ivtrends#1', '#110'];

function judge(out) {
  assert(!/--dry|scripted runner and no model/.test(out), 'this is the dry replay, not the model');
  for (const c of CASES) {
    const line = out.split('\n').find((l) => l.startsWith(`PASS ${c} — `) || l.startsWith(`FAIL ${c} — `));
    assert(line, `case ${c} is missing from the replay`);
    assert(line.startsWith('PASS') && /3 of 3 tries/.test(line), `case ${c}: ${line.slice(0, 160)}`);
  }
  assert(/19 of 19 cases passed/.test(out), 'not 19 of 19');
}

// Break leg: the last real run on record (run 5, 2026-09-28, on the build before 40t) — #115 two tries of three.
const RUN5 = ['Replaying 19 cases, 3 tries each, on claude-opus-5-5.', ...CASES.map((c) => (c === '#115' ? `FAIL ${c} — Start nothing on it. 2 of 3 tries chose it.` : `PASS ${c} — x. 3 of 3 tries.`)), '18 of 19 cases passed.'].join('\n');

let loggedIn = false;
try { loggedIn = JSON.parse(execFileSync('claude', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).loggedIn === true; } catch {}
if (loggedIn) {
  const out = execFileSync('npm', ['run', '--silent', 'replay'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30 * 60 * 1000 });
  console.log(out.trim().split('\n').map((l) => `    | ${l}`).join('\n'));
  await clause('PRD-05.R18 clause 1', 'each of the 19 cases chooses the action in the table\'s last column, on each of three tries', {
    broken: async () => judge(RUN5),
    correct: async () => judge(out),
  });
} else {
  try { judge(RUN5); console.log('=== PRD-05.R18 clause 1 — break leg did not go red: instrument broken'); } catch (e) { console.log(`    (break leg on run 5's recorded result: RED as required — ${e.message})`); }
  blocked('PRD-05.R18 clause 1', 'each of the 19 cases chooses the action in the table\'s last column, on each of three tries',
    'no model login here (`claude auth status`: not logged in). The last real run on record is run 5 (phase-40-replay.md): 18 of 19, #115 two tries of three, on the build before 40t. Run 6, on this build, is owed.');
}
blocked('PRD-05.R18 clause 2', 'a change to the runner\'s instructions: the replay is run, and its result is on the pull request',
  'the pull request does not exist yet; delivery must put run 6\'s result on it.');

finish('PRD-05.R18');
