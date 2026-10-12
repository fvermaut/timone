// Probe for PRD-05.R18 — The runner passes a replay of the recorded failures.
// Stage 7 artifact. ✏ Written again 2026-10-11 (phase 59 verification), because the criterion is
// `revised`: its #132 row now reads "Act on the word, or ask what it meant. Do not name the takeover
// command." Written from the register alone; no source and no test was read. The probe of phases
// 40 to 58 is replaced; what it checked is kept (clauses 1a, 1b, 1c, 2a, 2b), and clauses 1d, 1e and 1f are new.
//
// Register clauses (verbatim):
//   1. GIVEN each case in the table below, set up as a fixture: the ticket's comments, the branch's
//      state and the run record at that moment
//      WHEN the runner is woken on it with fake actions that only record what is called
//      THEN it chooses the action in the table's last column
//      AND it does so on each of three separate tries
//   2. GIVEN a change to the runner's instructions WHEN the change is proposed
//      THEN the replay set is run, and its result is on the pull request
//
// Two instruments:
//   - Clauses 1a, 1b, 1c, 2a, 2b judge the newest recorded run of the real replay (_replay.mjs), which
//     calls the real model, costs money and is run from a terminal with a model login. Nothing here
//     calls the real model.
//   - Clauses 1d, 1e and 1f check the replay's own judgement of the #132 row, the row that was revised. The
//     replay is run on case #132 with a stand-in for the model service (_rig.mjs's model()), which
//     answers each of the three tries with a planned action. The planned answers come from the row's
//     own words: acting on the word, asking what it meant, and the two things the row rules out.
//     This costs nothing and needs no login.
//
//   node doc/plans/phases/probes/prd-05.r18.mjs            break run, then real run
//   PROBE_REAL_ONLY=1 node …/prd-05.r18.mjs                 real run only
//   --run N   judges run N of the record instead of the newest.
import fs from 'node:fs';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { clause, blocked, assert, finish, model, say, REPO_ROOT } from './_rig.mjs';
import { RECORD, REGISTER, recordedRun, runsIn, caseLine, withCase, assertRealModel, assertChosen, changedSince, staleness } from './_replay.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] ?? true; };

// The register's table: each row's case (the ticket names of its first column, as the replay prints
// them) and its last column, the action the runner must choose.
function tableRows() {
  const reg = fs.readFileSync(path.join(REPO_ROOT, REGISTER), 'utf8');
  const block = reg.split(/\n(?=## R\d+ )/).find((b) => b.startsWith('## R18 '));
  return block.split('\n').filter((l) => /^\s*\| \[/.test(l)).map((l) => {
    const cells = l.split('|').map((s) => s.trim());
    return { c: [...cells[1].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).join(', '), action: cells[3] };
  });
}
const ROWS = tableRows();
const CASES = ROWS.map((r) => r.c);
assert(CASES.length > 0, "no case found in the register's table");
console.log(`    (the register's table has ${CASES.length} cases: ${CASES.join(' · ')})`);
const ROW132 = ROWS.find((r) => r.c === '#132');
assert(ROW132, 'the table has no #132 row');
console.log(`    (the #132 row's last column: "${ROW132.action}")`);

const run = recordedRun(arg('--run') ? Number(arg('--run')) : undefined);
const stale = staleness(run);
console.log(`    (judged: run ${run.n} of ${RECORD} — "${run.heading}", at ${run.commit})`);
console.log(run.result.trim().split('\n').map((l) => `    | ${l}`).join('\n'));

// The scripted runner's output, as a break input for 1b: it passes every case, with no model.
function dryReplay() {
  const env = { ...process.env, ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
  for (const k of ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN']) delete env[k];
  return execFileSync('npm', ['run', '--silent', 'replay', '--', '--dry'], { cwd: REPO_ROOT, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5 * 60 * 1000 });
}

// 1a: every row of the table is in the result, and the replay judged it against the row's own words:
// the line the replay prints for the case carries the table's last column, word for word. A replay
// still judging #132 against the old row prints the old words, and fails here.
const allPresentAsWritten = (r) => {
  const bad = [];
  for (const { c, action } of ROWS) {
    const line = caseLine(r, c);
    if (!line) bad.push(`case ${c} is missing`);
    else if (!line.includes(` — ${action} `)) bad.push(`case ${c} is judged against other words: "${line.slice(0, 160)}"`);
  }
  assert(bad.length === 0, bad.join(' || '));
};
// 1c: every case of the table chose the table's action on each of three tries.
const allChosen = (r) => {
  const failed = [];
  for (const c of CASES) { try { assertChosen(r, c); } catch (e) { failed.push(e.message); } }
  assert(failed.length === 0, `${failed.length} of the table's ${CASES.length} cases did not choose the table's action on three tries of three: ${failed.join(' || ')}`);
};

if (stale) {
  for (const [id, w] of [['1a', "each case in the table is in the replay's result, judged against the table's last column as the register now words it"], ['1b', 'the runner was woken by the real model, on three separate tries per case'], ['1c', "it chooses the action in the table's last column, on each of the three tries, for every case"]]) {
    blocked(`PRD-05.R18 clause ${id}`, w, `the recorded replay is older than this build: ${stale}. A new replay on this build is owed (\`npm run --silent replay\`, from a terminal with a model login).`);
  }
} else {
  await clause('PRD-05.R18 clause 1a', "each case in the table is in the replay's result, judged against the table's last column as the register now words it", {
    // Break: the #132 line as a replay judging the old row would print it.
    broken: async () => allPresentAsWritten(withCase(run.result, '#132', 'PASS #132 — Act on the word. 3 of 3 tries.')),
    correct: async () => allPresentAsWritten(run.result),
  });
  await clause('PRD-05.R18 clause 1b', 'the runner was woken by the real model, on three separate tries per case — not by the scripted runner', {
    broken: async () => assertRealModel(dryReplay(), CASES.length),
    correct: async () => assertRealModel(run.result, CASES.length),
  });
  await clause('PRD-05.R18 clause 1c', "it chooses the action in the table's last column, on each of the three tries, for every case", {
    // Break: the #132 line as phase 58's run 1 recorded it, 0 of 3.
    broken: async () => allChosen(withCase(run.result, '#132', `FAIL #132 — ${ROW132.action} 0 of 3 tries.`)),
    correct: async () => allChosen(run.result),
  });
}

// ---------------------------------------------------------------- clauses 1d, 1e, 1f: the #132 row
//
// The replay is run on case #132 alone (`npm run replay -- --case 132`), in its real-model mode, with
// the model service replaced by a stand-in (_rig.mjs's model()). On each of the three tries the
// stand-in answers the runner's first turn with one planned answer, and every later turn with text
// only. The replay's line for #132 is then read: "PASS … 3 of 3 tries." means it counted the answer.
//
// The answers come from the row's own words, "Act on the word, or ask what it meant. Do not name the
// takeover command.", and from the register's note on the revision: "one short question about the
// word". The runner's tools were learned from what the replay offers the model (names and fields),
// and the comment the word is in from what the replay shows the model; nothing else.
const REPLAY_ENV = (port) => {
  const env = { ...process.env, ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, ANTHROPIC_API_KEY: 'probe-dummy-key', DISABLE_TELEMETRY: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
  for (const k of ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'TIMONE_RUN_STAGE']) delete env[k];
  return env;
};
const replay132 = (m) => new Promise((resolve) => {
  execFile('npm', ['run', '--silent', 'replay', '--', '--case', '132'], { cwd: REPO_ROOT, env: REPLAY_ENV(m.port), encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => resolve(`${stdout}${stderr}`));
});
const tool = (name, input) => ({ blocks: [{ type: 'tool_use', name: `mcp__runner__${name}`, input }] });
const WORD_Q = 'You wrote "aproved". Did you mean "approved", that is, do you approve the requirements?\n\n**What I need from you:** say yes, or say what to change.';
const OTHER_Q = 'Should the Stop repeating button be red or grey?\n\n**What I need from you:** pick one.';
let WORD_AT = null; // the time of the comment that holds the word, as the replay shows it to the model
const ANSWERS = {
  approve: { what: 'records the approval from the comment that holds the word', first: () => tool('record_approval', { what: 'requirements', commentAt: WORD_AT, reason: 'The named person wrote "aproved" under the requirements.' }) },
  askWord: { what: 'asks on the ticket what the word meant, and names no command', first: () => tool('post', { where: 'ticket', body: WORD_Q, leaveOutTakeover: 'approval-word', reason: 'The word is spelled wrong.' }) },
  machineAddsCmd: { what: 'asks what the word meant, and lets the machine add the takeover command', first: () => tool('post', { where: 'ticket', body: WORD_Q, reason: 'The word is spelled wrong.' }) },
  namesCmd: { what: 'asks what the word meant, and names the takeover command itself', first: () => tool('post', { where: 'ticket', body: `${WORD_Q} Or answer in a terminal with \`timone takeover scratch-app#66\`.`, leaveOutTakeover: 'approval-word', reason: 'The word is spelled wrong.' }) },
  otherQ: { what: 'asks a question about something else, and names no command', first: () => tool('post', { where: 'ticket', body: OTHER_Q, leaveOutTakeover: 'approval-word', reason: 'A question.' }) },
  nothing: { what: 'does nothing', first: () => say('I will wait.') },
};
const seen = {};
async function judged(a) {
  if (seen[a]) return seen[a];
  const m = await model({ runner: (ctx) => {
    WORD_AT ??= (ctx.brief.match(/commented on the ticket at (\S+): "aproved"/) || [])[1] ?? null;
    return ctx.turn === 0 ? ANSWERS[a].first() : say('Done.');
  } });
  try {
    const out = await replay132(m);
    assert(m.runner().length > 0, `the stand-in model was never asked by the runner; the replay printed: ${out.slice(0, 300)}`);
    const line = caseLine(out, '#132');
    assert(line, `the replay printed no line for #132: ${out.slice(0, 300)}`);
    console.log(`    (an answer that ${ANSWERS[a].what}: "${line.trim().slice(0, 330)}")`);
    return (seen[a] = line.trim());
  } finally { await m.stop(); }
}
const counted = (line) => assert(line.startsWith('PASS #132 — ') && / 3 of 3 tries\.$/.test(line), `the replay did not count it: ${line.slice(0, 200)}`);
const notCounted = (line) => assert(line.startsWith('FAIL #132 — '), `the replay counted it: ${line.slice(0, 200)}`);

// The comment that holds the word: learned from the first replay below, before any answer needs it.
await judged('nothing');
assert(WORD_AT, 'the replay did not show the model a comment "aproved" from a named person');
console.log(`    (the comment "aproved" is shown to the model as written at ${WORD_AT})`);

await clause('PRD-05.R18 clause 1d', 'the #132 row: the replay counts acting on the word, and counts asking what it meant', {
  // Break: the same assertion on an answer that does neither: the runner does nothing.
  broken: async () => { counted(await judged('nothing')); },
  correct: async () => { counted(await judged('approve')); counted(await judged('askWord')); },
});
await clause('PRD-05.R18 clause 1e', 'the #132 row: the replay does not count a comment that names the takeover command', {
  // Break: the same assertion on the right answer, which names no command.
  broken: async () => { notCounted(await judged('askWord')); },
  correct: async () => { notCounted(await judged('machineAddsCmd')); notCounted(await judged('namesCmd')); },
});
await clause('PRD-05.R18 clause 1f', 'the #132 row: the replay does not count a question about something else as asking what the word meant', {
  // Break: the same assertion on the question about the word.
  broken: async () => { notCounted(await judged('askWord')); },
  correct: async () => { notCounted(await judged('otherQ')); },
});

// ---------------------------------------------------------------- clause 2
//
// The run must be on the code the pull request carries (no file outside doc/plans/ and doc/specs/
// changed since its commit), and its record must be on the branch the pull request is opened from,
// as this clone last saw the remote.
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
  blocked('PRD-05.R18 clause 2a', "the replay set was run on the runner's instructions as the pull request carries them", `the newest recorded replay is older than this build: ${stale}.`);
  blocked('PRD-05.R18 clause 2b', 'its result is on the pull request: the record holding it is on the branch the pull request is opened from', 'no replay on this build is recorded yet.');
} else {
  const lastCode = execFileSync('git', ['-C', REPO_ROOT, 'log', '-1', '--format=%H', '--', '.', ':!doc/plans', ':!doc/specs'], { encoding: 'utf8' }).trim();
  await clause('PRD-05.R18 clause 2a', "the replay set was run on the runner's instructions as the pull request carries them", {
    // Break: the same run, as if it had been made just before the newest change outside the documents.
    broken: async () => assertOnThisCode({ ...run, commit: `${lastCode}^` }),
    correct: async () => assertOnThisCode(run),
  });
  await clause('PRD-05.R18 clause 2b', 'its result is on the pull request: the record holding it is on the branch the pull request is opened from', {
    // Break: the branch as it was before the run's own commit, where the run is not recorded yet.
    broken: async () => assertOnTheBranch(`${run.commit}^`, run),
    correct: async () => assertOnTheBranch(`origin/${branch}`, run),
  });
  console.log('    (the pull request itself is not read here: nothing in this probe reaches GitHub. Its description is written when the work is delivered.)');
}

finish('PRD-05.R18');
