// Probe for PRD-05.R18 — The runner passes a replay of the recorded failures.
// Stage 7 artifact, authored 2026-09-28 (phase 40) from the register alone. The replay set is the
// criterion's own instrument (`npm run replay`, which calls the real model, about $2.50 a run).
//
// ✏ 2026-09-29 (re-check after 40z): by default this probe no longer runs the replay. It judges
// the newest run recorded in phase-40-replay.md (see _replay.mjs), which fvermaut ran from his own
// terminal, and it checks that the run is on the code this branch carries. It used to run the
// real replay whenever a model login existed, which spent money and called the model unasked.
// `--live` restores that: where a login exists, it runs the replay and judges its output instead.
// `--run N` judges run N of the record instead of the newest.
//
// Register clauses (verbatim):
//   1. GIVEN each case in the table below, set up as a fixture: the ticket's comments, the branch's
//      state and the run record at that moment
//      WHEN the runner is woken on it with fake actions that only record what is called
//      THEN it chooses the action in the table's last column
//      AND it does so on each of three separate tries
//   2. GIVEN a change to the runner's instructions WHEN the change is proposed
//      THEN the replay set is run, and its result is on the pull request
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { clause, blocked, assert, finish, REPO_ROOT } from './_rig.mjs';
import { RECORD, recordedRun, runsIn, tableCases, caseLine, withCase, assertRealModel, assertChosen, changedSince, staleness } from './_replay.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] ?? true; };
const CASES = tableCases();
assert(CASES.length > 0, 'no case found in the register\'s table');
console.log(`    (the register's table has ${CASES.length} cases: ${CASES.join(' · ')})`);

const run = recordedRun(arg('--run') ? Number(arg('--run')) : undefined);
const earlier = runsIn(fs.readFileSync(path.join(REPO_ROOT, RECORD), 'utf8')).filter((r) => r.n < run.n && r.result.includes('FAIL '));
const lastFail = earlier.at(-1);

// Where the result comes from: the record, or (with --live and a login) a run made now.
let result = run.result;
let source = `run ${run.n} of the record ("${run.heading}", at ${run.commit})`;
let stale = staleness(run);
if (arg('--live')) {
  let loggedIn = false;
  try { loggedIn = JSON.parse(execFileSync('claude', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).loggedIn === true; } catch {}
  if (!loggedIn) { console.log('    --live: no model login here; judging the record instead'); }
  else {
    result = execFileSync('npm', ['run', '--silent', 'replay'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30 * 60 * 1000 });
    source = 'a replay run now, on this build'; stale = null;
  }
}
console.log(`    (judged: ${source})`);
console.log(result.trim().split('\n').map((l) => `    | ${l}`).join('\n'));

// The scripted runner's output, as a break input: it passes every case, with no model.
function dryReplay() {
  const env = { ...process.env, ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
  for (const k of ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN']) delete env[k];
  return execFileSync('npm', ['run', '--silent', 'replay', '--', '--dry'], { cwd: REPO_ROOT, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5 * 60 * 1000 });
}

const allPresent = (r) => { for (const c of CASES) assert(caseLine(r, c), `case ${c} is missing from the result`); };
// ✏ 2026-10-10 (phase 58 verification): every case of the table is judged, and every one that
// failed is named, not only the first. The result's own count line ("N of N cases passed.") is no
// longer required: the replay now holds cases the table does not list, so that line counts them too.
const allChosen = (r) => {
  const failed = [];
  for (const c of CASES) { try { assertChosen(r, c); } catch (e) { failed.push(e.message); } }
  assert(failed.length === 0, `${failed.length} of the table's ${CASES.length} cases did not choose the table's action on three tries of three: ${failed.join(' || ')}`);
};

if (stale) {
  blocked('PRD-05.R18 clause 1', 'each case in the table chooses the action in the table\'s last column, on each of three separate tries',
    `the recorded replay judged here is older than this build: ${stale}. A new replay on this build is owed (\`npm run --silent replay\`, from a logged-in terminal).`);
} else {
  await clause('PRD-05.R18 clause 1a', 'each case in the table is in the replay\'s result', {
    broken: async () => allPresent(withCase(result, CASES.at(-1), null)),
    correct: async () => allPresent(result),
  });
  await clause('PRD-05.R18 clause 1b', 'the runner was woken by the real model, on three separate tries per case — not by the scripted runner', {
    broken: async () => assertRealModel(dryReplay(), CASES.length),
    correct: async () => assertRealModel(result, CASES.length),
  });
  await clause('PRD-05.R18 clause 1c', 'it chooses the action in the table\'s last column, on each of the three tries, for every case', {
    // Break: this result with one case put back to its last recorded failure (run 6's #120, 2 of 3).
    broken: async () => {
      const c = CASES.find((x) => caseLine(lastFail?.result ?? '', x)?.startsWith('FAIL ')) ?? CASES[0];
      const bad = caseLine(lastFail?.result ?? '', c) ?? `FAIL ${c} — planted. 2 of 3 tries chose it.`;
      console.log(`    (break input: case ${c} as run ${lastFail?.n ?? '—'} recorded it: "${bad.slice(0, 110)}…")`);
      allChosen(withCase(result, c, bad).replace(/^\d+ of \d+ cases passed\./m, `${CASES.length - 1} of ${CASES.length} cases passed.`));
    },
    correct: async () => allChosen(result),
  });
}

// Clause 2. The one change in scope is this pull request's; its last change to the runner's
// instructions is the newest code commit. The run must be on that code, and its record must be
// on the branch the pull request is opened from (as this clone last saw the remote).
// ✏ 2026-10-02 (phase 41 verification): when the newest recorded run is older than this build,
// clause 2 is BLOCKED too, as _replay.mjs says every clause judged on such a run is: the run that
// would be on the pull request has not been made yet. The break leg of 2a used run 7's commit, which
// is not in this branch's history once phase 40 was merged, so it went red on a git error rather
// than on the fact; it now uses the commit just before the newest change outside doc/plans/ and
// doc/specs/, which always differs from HEAD.
const branch = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
function assertOnThisCode(r) {
  assert(r?.commit, `run ${r?.n ?? '(none)'} does not name the commit it ran on`);
  const changed = changedSince(r.commit);
  assert(changed.length === 0, `files outside doc/plans/ and doc/specs/ changed after run ${r.n} (at ${r.commit}): ${changed.length}, under ${[...new Set(changed.map((f) => f.split('/')[0] + '/'))].join(', ')}`);
}
function assertOnTheBranch(ref, r) {
  let text = '';
  try { text = execFileSync('git', ['-C', REPO_ROOT, 'show', `${ref}:${RECORD}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch {}
  const there = runsIn(text).find((x) => x.n === r.n);
  assert(there && there.result === r.result, `run ${r.n}'s result is not in ${RECORD} at ${ref}`);
}
if (stale) {
  blocked('PRD-05.R18 clause 2a', 'the replay set was run on the runner\'s instructions as the pull request carries them',
    `the newest recorded replay is older than this build: ${stale}. The replay owed on this build has not been run yet.`);
  blocked('PRD-05.R18 clause 2b', 'its result is on the pull request: the record holding it is on the branch the pull request is opened from',
    'no replay on this build is recorded yet, so there is no result to look for on the branch.');
} else {
  const lastCode = execFileSync('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%H', '--', '.', ':!doc/plans', ':!doc/specs'], { encoding: 'utf8' }).trim();
  await clause('PRD-05.R18 clause 2a', 'the replay set was run on the runner\'s instructions as the pull request carries them', {
    broken: async () => assertOnThisCode({ ...run, commit: `${lastCode}^` }),
    correct: async () => assertOnThisCode(run),
  });
  let before = '';
  try { before = execFileSync('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%H', `${run.commit}`], { encoding: 'utf8' }).trim(); } catch {}
  await clause('PRD-05.R18 clause 2b', 'its result is on the pull request: the record holding it is on the branch the pull request is opened from', {
    broken: async () => assertOnTheBranch(before || 'HEAD~1', run),
    correct: async () => assertOnTheBranch(`origin/${branch}`, run),
  });
  console.log(`    (the pull request itself is not read here: nothing in this probe reaches GitHub. Its description is written when the work is delivered.)`);
}

finish('PRD-05.R18');
