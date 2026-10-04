// Probe for PRD-07.R8 — Files almost every ticket changes never stop an update. CLAUSE 1 ONLY.
// Stage 7 artifact, authored 2026-10-04 (phase 44 verification) from the register alone.
//
// Register clause 1 (verbatim):
//   GIVEN two tickets of one project worked at the same time
//   WHEN each writes a phase file, an ADR or a triage record
//   THEN no two of them take the same number
//
// Clauses 2 and 3 (STATUS.md and the requirement registers after a merge) are not built yet;
// phase 44 claims clause 1 only. They print as BLOCKED so the gap stays a visible number, and a
// later pass that is owed them writes them here.
//
// What is observed, from outside: the built CLI's `number <project> <kind>` command, which the
// completion report names as the way a session takes a number, run from SEPARATE clones of one
// bare remote (each run has its own clone; the remote is all they share); the same command inside
// a step session the built daemon starts, with the run's guard hooks in place; and the text of the
// instructions a session is given when it writes one of these files. The remote is always a local
// bare repository in a temporary folder: never a real remote, where a reservation is permanent.
//
// Labels (a) to (d) are parts of clause 1, not extra register clauses.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { clause, blocked, assert, finish, CLI, REPO_ROOT } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';
import { stepSession } from './_steps.mjs';

// main just before phase 44 (the merge-base of timone/199): sessions numbered files by listing
// the folder, and the run's guard knew no reservation.
export const BEFORE_PHASE_44 = '2b68cbb3bc0c993faf93031eeb98364edbca293a';

const base = fs.mkdtempSync(path.join(process.env.PROBE_TMP || os.tmpdir(), 'probe-prd07r8-'));
let n = 0;
const G = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ID = ['-c', 'user.email=probe@timone.invalid', '-c', 'user.name=probe'];

// Where each kind of file lives, and how its number is written. The register names phase files,
// ADRs and triage records; these are the names this repository's own files use.
const KINDS = {
  phase: { dir: 'doc/plans/phases', file: (k) => `phase-${k}.md`, re: /^phase-(\d+)\.md$/, width: 2 },
  adr: { dir: 'doc/adr', file: (k) => `${k}-probe.md`, re: /^(\d+)-.*\.md$/, width: 4 },
  triage: { dir: 'doc/triage', file: (k) => `${k}-probe.md`, re: /^(\d+)-.*\.md$/, width: 3 },
};

// A bare remote whose default branch already holds some numbered files, with gaps.
function world() {
  const w = path.join(base, `w${n++}`);
  const origin = path.join(w, 'origin.git');
  const seed = path.join(w, 'seed');
  fs.mkdirSync(w, { recursive: true });
  G(w, 'init', '-q', '--bare', '-b', 'main', origin);
  G(w, 'init', '-q', '-b', 'main', seed);
  const existing = { phase: [1, 2, 7], adr: [1, 3], triage: [2] };
  for (const [kind, nums] of Object.entries(existing)) {
    const k = KINDS[kind];
    fs.mkdirSync(path.join(seed, k.dir), { recursive: true });
    for (const x of nums) fs.writeFileSync(path.join(seed, k.dir, k.file(String(x).padStart(k.width, '0'))), `# ${kind} ${x}\n`);
  }
  G(seed, 'add', '-A');
  G(seed, ...ID, 'commit', '-q', '-m', 'init');
  G(seed, 'push', '-q', origin, 'main');
  return { w, origin, seed, existing };
}

// One ticket's working copy, as a run gets it: its own timone root, its own clone of the default branch.
function session(wd, name) {
  const root = path.join(wd.w, name);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'timone.yaml'), `projects:\n  fixture:\n    repo_url: file://${wd.origin}\n    path: projects/fixture\n    stack:\n      - typescript\n    bindings:\n      ticketing: github\n`);
  G(root, 'clone', '-q', wd.origin, path.join('projects', 'fixture'));
  return { root, clone: path.join(root, 'projects', 'fixture') };
}

// The way the build before this phase told a session to number a file: list the folder of its own
// clone, take the highest number, use the next.
function byFolder(s, kind) {
  const k = KINDS[kind];
  const dir = path.join(s.clone, k.dir);
  const nums = fs.readdirSync(dir).map((f) => (f.match(k.re) || [])[1]).filter(Boolean).map(Number);
  return Promise.resolve({ code: 0, out: String(Math.max(0, ...nums) + 1).padStart(k.width, '0') });
}

// The way a session takes a number now: the command, run from its own timone root.
function byCommand(s, kind) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, 'number', 'fixture', kind], { cwd: s.root, encoding: 'utf8' }, (err, stdout, stderr) =>
      resolve({ code: err ? (err.code ?? 1) : 0, out: String(stdout).trim(), err: String(stderr).trim() }),
    );
  });
}

// A ticket writes the file under the number it took, and pushes it on its own branch.
function writeAndPush(s, kind, num, branch) {
  const k = KINDS[kind];
  fs.writeFileSync(path.join(s.clone, k.dir, k.file(num)), `# ${kind} ${num} by ${branch}\n`);
  G(s.clone, 'checkout', '-q', '-B', branch);
  G(s.clone, 'add', '-A');
  G(s.clone, ...ID, 'commit', '-q', '-m', `${kind} ${num}`);
  G(s.clone, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`);
}

function assertDistinct(label, results, existing, kind) {
  const bad = results.filter((r) => r.code !== 0 || !/^\d+$/.test(r.out));
  assert(bad.length === 0, `${label}: a session got no number: ${JSON.stringify(bad[0])}`);
  const nums = results.map((r) => Number(r.out));
  const dup = nums.filter((x, i) => nums.indexOf(x) !== i);
  assert(dup.length === 0, `${label}: two sessions took the same ${kind} number: ${nums.join(', ')}`);
  const clash = nums.filter((x) => existing.includes(x));
  assert(clash.length === 0, `${label}: a session took a ${kind} number a file on the default branch already has: ${clash.join(', ')}`);
  return nums;
}

// (a) SIX tickets of one project, each in its own clone, take a number of each kind at the same moment.
async function sameMoment(take) {
  const wd = world();
  const sessions = Array.from({ length: 6 }, (_, i) => session(wd, `ticket${i + 1}`));
  const seen = {};
  for (const kind of Object.keys(KINDS)) {
    const results = await Promise.all(sessions.map((s) => take(s, kind)));
    seen[kind] = assertDistinct(`at the same moment (${kind})`, results, wd.existing[kind], kind);
  }
  return seen;
}

// (b) One ticket takes a number and writes its file on its branch, not merged. A second ticket,
// started later from a fresh clone of the default branch (which does not hold that file), takes one.
async function oneAfterTheOther(take) {
  const wd = world();
  const seen = {};
  for (const kind of Object.keys(KINDS)) {
    const first = session(wd, `first-${kind}`);
    const a = await take(first, kind);
    assert(a.code === 0 && /^\d+$/.test(a.out), `the first ticket got no ${kind} number: ${JSON.stringify(a)}`);
    writeAndPush(first, kind, a.out, `timone/1-first-${kind}`);
    const second = session(wd, `second-${kind}`);
    assert(!fs.readdirSync(path.join(second.clone, KINDS[kind].dir)).includes(KINDS[kind].file(a.out)), 'the second clone already holds the first file: the fixture is wrong');
    const b = await take(second, kind);
    seen[kind] = assertDistinct(`one after the other (${kind})`, [a, b], wd.existing[kind], kind);
  }
  return seen;
}

const memo = (f) => { let p; return () => (p ??= f()); };

await clause('PRD-07.R8 clause 1 (a)', 'two tickets of one project worked at the same time, each writing a phase file, an ADR or a triage record, never take the same number — six clones ask at the same moment', {
  broken: async () => { await sameMoment(byFolder); },
  correct: async () => { const s = await sameMoment(byCommand); console.log(`    numbers taken: ${JSON.stringify(s)}`); },
});

await clause('PRD-07.R8 clause 1 (b)', 'a ticket that took a number and has not merged its file, and a ticket started after it from the default branch, never take the same number', {
  broken: async () => { await oneAfterTheOther(byFolder); },
  correct: async () => { const s = await oneAfterTheOther(byCommand); console.log(`    numbers taken: ${JSON.stringify(s)}`); },
});

// (c) Inside a run: a step session the built daemon starts, with the run's own guard hooks in the
// fixture root, takes a number. Each run takes it, so the guard must let it through. Two step
// sessions, one after the other on two fixtures sharing nothing but this check, would add nothing
// (b) does not cover; what this adds is the guard. Break leg: the guard of the build before this
// phase, with the same command.
const P = (fx) => `cd ${fx.dir} && `;
const inRun = async (cli) => {
  const r = await stepSession({
    cli,
    commands: (fx) => [
      `${P(fx)}node ${CLI} number fixture phase 2>&1; echo EXIT=$?`,
      `${P(fx)}node ${CLI} number fixture phase 2>&1; echo EXIT=$?`,
    ],
  });
  const refs = G(path.join(r.fx.dir, 'remote', 'fixture.git'), 'for-each-ref', '--format=%(refname)');
  r.fx.cleanup?.();
  return { outs: r.outs, refs };
};
const RUN_NEW = memo(() => inRun(CLI));
const RUN_OLD = memo(async () => inRun(oldBuild(BEFORE_PHASE_44)));
function assertInRun(r) {
  const got = r.outs.map((o) => ((o ?? '').match(/^(\d+)\s*$/m) || [])[1]);
  assert(r.outs.length === 2 && r.outs.every((o) => /EXIT=0/.test(o ?? '')) && got.every(Boolean), `a step session could not take a number: ${JSON.stringify(r.outs)}`);
  assert(got[0] !== got[1], `two takes inside a run gave the same number: ${got.join(', ')}`);
}
await clause('PRD-07.R8 clause 1 (c)', "inside a run, with the run's guard in place, a session can take a number, and two takes give two numbers", {
  broken: async () => assertInRun(await RUN_OLD()),
  correct: async () => { const r = await RUN_NEW(); console.log(`    step outputs: ${JSON.stringify(r.outs.map((o) => o.replace(/\s+/g, ' ').slice(0, 160)))}`); assertInRun(r); },
});

// (d) The instructions. A session writes these files by following Timone's instructions for that
// file, so the instructions must send it to the command and must no longer tell it to count the
// folder. Checked on the text as shipped on this branch; the break leg runs the same check on the
// text at the commit before this phase.
const INSTR = {
  'phase file': '.claude/skills/timone-plan/SKILL.md',
  'ADR (timone-adr)': '.claude/skills/timone-adr/SKILL.md',
  'ADR (timone-onboard)': '.claude/skills/timone-onboard/SKILL.md',
  'triage record': '.claude/skills/timone-triage/SKILL.md',
};
const KIND_OF = { 'phase file': 'phase', 'ADR (timone-adr)': 'adr', 'ADR (timone-onboard)': 'adr', 'triage record': 'triage' };
// Words that tell a session to number by counting what is already there. Struck text (~~…~~) is
// a record of what the instruction used to say, not an instruction, and is removed first.
const COUNTING = /(take the highest|highest existing|next available `?N|use the next(,| number)|number sequentially)/i;
const unstruck = (t) => t.replace(/~~[^~]*~~/g, '');
function instructions(read) {
  const wrong = [];
  for (const [what, file] of Object.entries(INSTR)) {
    const text = unstruck(read(file));
    const cmd = new RegExp(`number\\s+(<[^>]+>|\\S+)\\s+${KIND_OF[what]}\\b`);
    if (!cmd.test(text)) wrong.push(`${what}: ${file} does not send the session to \`number <project> ${KIND_OF[what]}\``);
    const counting = text.split('\n').filter((l) => COUNTING.test(l));
    if (counting.length) wrong.push(`${what}: ${file} still tells the session to count: ${counting[0].trim().slice(0, 200)}`);
  }
  const proc = unstruck(read('process.md'));
  if (!/number\s+<[^>]+>\s+<?kind>?|cli\.js number/.test(proc)) wrong.push('process.md does not name the command');
  return wrong;
}
const atHead = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
const atOld = (f) => { try { return execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_44}:${f}`], { encoding: 'utf8' }); } catch { return ''; } };
await clause('PRD-07.R8 clause 1 (d)', 'the instructions a session follows to write a phase file, an ADR or a triage record take the number from the command, and none tells it to count the folder', {
  broken: async () => { const w = instructions(atOld); assert(w.length === 0, w.join(' | ')); },
  correct: async () => { const w = instructions(atHead); assert(w.length === 0, w.join(' | ')); },
});

blocked('PRD-07.R8 clause 2', 'two open pull requests that both changed `STATUS.md`: the update completes without a person', 'not built yet — phase 44 claims clause 1 only (piece 2 of the breakdown for #197)');
blocked('PRD-07.R8 clause 3', 'two open pull requests that both changed the same requirement register: the update completes without a person', 'not built yet — phase 44 claims clause 1 only (piece 2 of the breakdown for #197)');

if (!process.env.PROBE_KEEP) fs.rmSync(base, { recursive: true, force: true });
finish('PRD-07.R8');
