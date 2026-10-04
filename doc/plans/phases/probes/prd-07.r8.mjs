// Probe for PRD-07.R8 — Files almost every ticket changes never stop an update.
// Stage 7 artifact, authored 2026-10-04 (phase 44 verification) from the register alone.
//
// Register clause 1 (verbatim):
//   GIVEN two tickets of one project worked at the same time
//   WHEN each writes a phase file, an ADR or a triage record
//   THEN no two of them take the same number
//
// Clauses 2 and 3 (STATUS.md and the requirement registers after a merge) were added by phase 48's
// verification, 2026-10-04; see their own comment below.
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
import { clause, assert, finish, CLI, REPO_ROOT } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';
import { stepSession, boxScript, boxReplay, BR } from './_steps.mjs';

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

// ✏ 2026-10-04 (phase 48 verification): clauses 2 and 3, written from the register alone.
//
// Register clause 2 (verbatim):
//   GIVEN two open pull requests of one project that both changed `STATUS.md`
//   WHEN one merges and the update runs on the other
//   THEN the update completes without a person resolving `STATUS.md`, and `STATUS.md` on the
//   branch keeps what both said
// Register clause 3 (verbatim):
//   GIVEN two open pull requests of one project that both changed the same requirement register
//   WHEN one merges and the update runs on the other
//   THEN the update completes without a person resolving the register, and no line either one
//   wrote is lost
//
// What is observed, from outside: the script the BUILT daemon hands docker for a step, run for
// real outside a container (_steps.mjs boxReplay), with a stand-in agent that brings its work
// branch level with the default branch by `git merge` — the way an update brings a branch level
// is not built yet (PRD-07.R7), and a merge is the plain git way. Two pull requests start from
// this repository's own STATUS.md and PRD-07 register as they stood before phase 48, and change
// them the way runs do: both move the `**Last updated:**` date, both add an item at the same
// place, both rewrite the same line; in the register both write a dated note under the same
// requirement, both set its one `Status`, both rewrite the same hint line, and both add a new
// requirement at the end. Pull request A lands on the default branch first, (a) squashed, or
// (b) as a merge commit with the dates the other way round; pull request B is then merged level.
// Break leg: the same, with the box script and Timone checkout of the build before phase 48.
const BEFORE_PHASE_48 = 'bd05360f1aa5946988160b92668ac21e8c842c06';
const REG = 'doc/specs/prd/prd-07-several-tickets-of-one-project-at-once.criteria.md';
const baseOf = (f) => execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_48}:${f}`], { encoding: 'utf8' });
const after = (text, anchor, lines) => { assert(text.includes(anchor), `fixture: anchor not found: ${anchor.slice(0, 60)}`); return text.replace(anchor, `${anchor}\n${lines.join('\n')}`); };
const swap = (text, from, to) => { assert(text.includes(from), `fixture: line not found: ${from.slice(0, 60)}`); return text.replace(from, to); };
// Only inside the R2 block: `- **Status:** draft` is the first one after the R2 heading.
const inBlock = (text, k, f) => { const re = new RegExp(`(^## R${k} [\\s\\S]*?)(?=^## R|(?![\\s\\S]))`, 'm'); return text.replace(re, (b) => f(b)); };
const blockOf = (text, k) => (text.match(new RegExp(`^## R${k} [\\s\\S]*?(?=^## R|(?![\\s\\S]))`, 'm')) || [''])[0];
const ITEM_ANCHOR = '**What I need from you:** run the two checks, then review and merge #212, and answer its four questions there.';
const ITEM1 = '**1. Restart the daemon** so it runs the merged code of #189.';
const R2_NOTE = 'so the status stays `draft`.';
const R2_HINT = '- **Verification hint:** test it on the run store with fake steps.';
function side(who, date) {
  let s = baseOf('STATUS.md');
  s = swap(s, '**Last updated:** 2026-10-04.', `**Last updated:** ${date}.`);
  s = after(s, ITEM_ANCHOR, ['', `**1h. ${who}: probe item written by pull request ${who}.**`, '', `**What I need from you:** ${who}-probe answer.`]);
  s = swap(s, ITEM1, `**1. Restart the daemon (${who} rewrote this line)** so it runs the merged code of #189.`);
  let r = baseOf(REG);
  r = inBlock(r, 2, (b) => swap(after(b, R2_NOTE, ['', `> ✏ ${date} — ${who}: probe note under R2.`]), '- **Status:** draft', `- **Status:** ${who === 'A' ? 'verified' : 'failed'}`));
  r = swap(r, R2_HINT, `${R2_HINT} (${who} rewrote this hint.)`);
  r = `${r.trimEnd()}\n\n## R${who === 'A' ? 15 : 16} — ${who}: probe requirement added by pull request ${who}\n\n- **Priority:** MUST\n- **Status:** draft\n- **Verify-via:** api\n- **Criteria:** ${who}: probe criterion text.\n`;
  return { 'STATUS.md': s, [REG]: r };
}
const added = (base, mine) => { const b = new Set(base.split('\n')); return mine.split('\n').filter((l) => l.trim() && !b.has(l)); };
const BR2 = 'timone/12-probe-merge-commit';
const BR3 = 'timone/12-probe-same-number';
// The project remote: base on main; B's branch from base; A landed on main squashed, and on a
// second ref as a merge commit (variant b, dates the other way round).
function plantPRs(remote) {
  const w = fs.mkdtempSync(path.join(base, 'prs-'));
  const c = path.join(w, 'c');
  G(w, 'clone', '-q', remote, c);
  const write = (files) => { for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(c, f)), { recursive: true }); fs.writeFileSync(path.join(c, f), t); } G(c, 'add', '-A'); };
  const commit = (m) => G(c, ...ID, 'commit', '-q', '-m', m);
  G(c, 'checkout', '-q', 'main');
  write({ 'STATUS.md': baseOf('STATUS.md'), [REG]: baseOf(REG) }); commit('base: STATUS.md and the register as before phase 48');
  const baseSha = G(c, 'rev-parse', 'HEAD').trim();
  // variant (a): A dated 10-05 squashed onto main; B dated 10-06 on the run's own branch
  G(c, 'checkout', '-q', '-b', 'pr-a'); write(side('A', '2026-10-05')); commit('A');
  G(c, 'checkout', '-q', '-b', BR, baseSha); write(side('B', '2026-10-06')); commit('B');
  G(c, 'checkout', '-q', 'main'); G(c, 'merge', '-q', '--squash', 'pr-a'); commit('A (#1) squashed');
  // variant (b): A dated 10-07 landed by a merge commit; B dated 10-06
  G(c, 'checkout', '-q', '-b', 'pr-a2', baseSha); write(side('A', '2026-10-07')); commit('A2');
  G(c, 'checkout', '-q', '-b', 'landed-merge', baseSha); G(c, ...ID, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #1', 'pr-a2');
  G(c, 'checkout', '-q', '-b', BR2, baseSha); write(side('B', '2026-10-06')); commit('B2');
  // the open case (c): both pull requests add a new requirement with the SAME number, R15
  const dup = (who) => ({ [REG]: `${baseOf(REG).trimEnd()}\n\n## R15 — ${who}: probe requirement added by pull request ${who}\n\n- **Priority:** MUST\n- **Status:** draft\n- **Verify-via:** api\n- **Criteria:** ${who}: probe criterion text.\n` });
  G(c, 'checkout', '-q', '-b', 'landed-dup', baseSha); write(dup('A')); commit('A3 (#1)');
  G(c, 'checkout', '-q', '-b', BR3, baseSha); write(dup('B')); commit('B3');
  G(c, 'push', '-q', '-f', 'origin', 'main', BR, BR2, BR3, 'landed-merge', 'landed-dup');
  return { a: side('A', '2026-10-05'), b: side('B', '2026-10-06'), a2: side('A', '2026-10-07'), base: { 'STATUS.md': baseOf('STATUS.md'), [REG]: baseOf(REG) } };
}
const updateRun = async (cli, timoneCommit) => {
  const b = await boxScript({ cli });
  assert(b.script, `the daemon handed docker no script: ${b.decision}`);
  const remote = path.join(b.fx.dir, 'remote', 'fixture.git');
  const sides = plantPRs(remote);
  const mainBefore = b.fx.remoteHead('main');
  const M = '-c user.email=box@timone.invalid -c user.name=box';
  const show = (tag) => `echo "=== ${tag} STATUS"; cat STATUS.md; echo "=== ${tag} REG"; cat ${REG}; echo "=== ${tag} END"`;
  const r = boxReplay({
    script: b.script, projectRemote: remote,
    timoneCommit: timoneCommit ?? execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    agent: [
      `git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'`,
      `git checkout -q -B "${BR}" "origin/${BR}"`,
      `echo "=== a merge"; git ${M} merge --no-edit origin/main 2>&1; echo EXIT=$?; echo "UNMERGED=[$(git diff --name-only --diff-filter=U | tr '\\n' ' ')]"`,
      show('a'),
      `echo "=== a push"; git push origin "HEAD:refs/heads/${BR}" 2>&1; echo EXIT=$?`,
      `git merge --abort 2>/dev/null; git reset -q --hard; git checkout -q -B "${BR2}" "origin/${BR2}"`,
      `echo "=== b merge"; git ${M} merge --no-edit origin/landed-merge 2>&1; echo EXIT=$?; echo "UNMERGED=[$(git diff --name-only --diff-filter=U | tr '\\n' ' ')]"`,
      show('b'),
      `git merge --abort 2>/dev/null; git reset -q --hard; git checkout -q -B "${BR3}" "origin/${BR3}"`,
      `echo "=== c merge"; git ${M} merge --no-edit origin/landed-dup 2>&1; echo EXIT=$?; echo "UNMERGED=[$(git diff --name-only --diff-filter=U | tr '\\n' ' ')]"; git merge --abort 2>/dev/null; git reset -q --hard`,
      `echo "=== clone"; git status --porcelain --ignored | grep -v '^!! node_modules' ; test -e .gitattributes && echo GITATTRIBUTES-PRESENT; git config --local --list | grep -i merge; echo CLONE-END`,
    ],
  });
  const res = { ...r, sides, mainBefore, mainAfter: b.fx.remoteHead('main'), own: b.fx.remoteHead(BR), remote };
  res.ownStatus = res.own ? G(remote, 'show', `${res.own}:STATUS.md`) : '';
  b.fx.cleanup();
  return res;
};
const UPD_NEW = memo(() => updateRun(CLI));
// The open case, observed and printed, not judged: when both pull requests add a requirement with
// the same new number, the build stops for a person on purpose (its completion report). Whether
// that case is inside clause 3 is a question for the person; this prints what happens.
function observeSameNumber(r) {
  const c = cut(r.out, 'c merge', 'clone').replace(/\s+/g, ' ').trim();
  console.log(`=== PRD-07.R8 clause 3, open case — both pull requests add a new requirement with the same number (R15)`);
  console.log(`    observed, not judged: ${c.slice(0, 400)}`);
}
const UPD_OLD = memo(async () => updateRun(oldBuild(BEFORE_PHASE_48), BEFORE_PHASE_48));
const cut = (out, from, to) => ((out.split(`=== ${from}\n`)[1] ?? '').split(`\n=== ${to}`)[0]);
function assertCompleted(r, v) {
  assert(r.agentRan, `the box script did not reach the agent (exit ${r.code}): ${r.out.slice(-400)}`);
  const m = cut(r.out, `${v} merge`, `${v} STATUS`);
  assert(/EXIT=0/.test(m) && /UNMERGED=\[\]/.test(m), `variant (${v}): the merge stopped for a person: ${m.replace(/\s+/g, ' ').slice(0, 300)}`);
  return m;
}
const nolost = (label, text, lines) => { const miss = lines.filter((l) => !text.includes(l)); assert(miss.length === 0, `${label}: ${miss.length} line(s) lost, first: ${JSON.stringify(miss[0]?.slice(0, 120))}`); };
function assertStatus(r, v) {
  assertCompleted(r, v);
  const s = cut(r.out, `${v} STATUS`, `${v} REG`);
  assert(!/^(<{7}|>{7}|={7}$|\|{7})/m.test(s), `variant (${v}): STATUS.md carries conflict markers`);
  const [A, B, later] = v === 'a' ? [r.sides.a, r.sides.b, '2026-10-06'] : [r.sides.a2, r.sides.b, '2026-10-07'];
  const keep = (x) => added(r.sides.base['STATUS.md'], x['STATUS.md']).filter((l) => !/^\*\*Last updated:\*\*/.test(l));
  nolost(`variant (${v}) STATUS.md, lines of the pull request that merged`, s, keep(A));
  nolost(`variant (${v}) STATUS.md, lines of the branch`, s, keep(B));
  assert(s.includes(`**Last updated:** ${later}.`), `variant (${v}): STATUS.md does not carry the later date ${later}`);
  const dates = (s.match(/^\*\*Last updated:\*\*.*$/gm) || []);
  console.log(`    (${v}) STATUS.md: ${s.split('\n').length} lines; Last updated lines: ${JSON.stringify(dates)}`);
  const at = s.split('\n').findIndex((l) => l.startsWith('**1h.'));
  console.log(`    (${v}) STATUS.md where both added an item:\n${s.split('\n').slice(at - 1, at + 8).map((l) => `      | ${l}`).join('\n')}`);
  console.log(`    (${v}) STATUS.md item 1, which both rewrote:\n${s.split('\n').filter((l) => l.startsWith('**1. Restart')).map((l) => `      | ${l.slice(0, 110)}`).join('\n')}`);
}
function assertRegister(r, v) {
  assertCompleted(r, v);
  const t = cut(r.out, `${v} REG`, `${v} END`);
  assert(!/^(<{7}|>{7}|={7}$|\|{7})/m.test(t), `variant (${v}): the register carries conflict markers`);
  const A = v === 'a' ? r.sides.a : r.sides.a2;
  const keep = (x) => added(r.sides.base[REG], x[REG]).filter((l) => !/^- \*\*Status:\*\*/.test(l));
  nolost(`variant (${v}) register, lines of the pull request that merged`, t, keep(A));
  nolost(`variant (${v}) register, lines of the branch`, t, keep(r.sides.b));
  // The one-value Status line both set: neither side's value may vanish from R2's block.
  const r2 = blockOf(t, 2);
  assert(/\bverified\b/.test(r2) && /\bfailed\b/.test(r2), `variant (${v}): R2's block lost a side's Status value (verified from the merged pull request, failed from the branch)`);
  const statusLines = r2.match(/^- \*\*Status:\*\*.*$/gm) || [];
  const notes = r2.split('\n').filter((l) => /failed|verified/.test(l) && !/^- \*\*Status/.test(l)).map((l) => l.slice(0, 140));
  console.log(`    (${v}) R2 Status lines: ${JSON.stringify(statusLines)}; other R2 lines naming a value: ${JSON.stringify(notes)}`);
  console.log(`    (${v}) R2 block as merged, head:\n${r2.split('\n').slice(0, 14).map((l) => `      | ${l.slice(0, 200)}`).join('\n')}`);
  console.log(`    (${v}) R2 hint lines: ${JSON.stringify(r2.split('\n').filter((l) => l.includes('rewrote this hint')).map((l) => l.slice(-40)))}`);
  console.log(`    (${v}) headings: ${JSON.stringify((t.match(/^## R\d+/gm) || []).join(' '))}`);
}
function assertPushed(r) {
  assert(r.mainAfter === r.mainBefore, `the default branch moved: ${r.mainBefore} → ${r.mainAfter}`);
  assert(/EXIT=0/.test(cut(r.out, 'a push', 'b merge')), `the merged branch could not be pushed: ${cut(r.out, 'a push', 'b merge').slice(0, 300)}`);
  assert(r.ownStatus.includes('A: probe item written by pull request A') && r.ownStatus.includes('B: probe item written by pull request B'), 'the work branch on the remote does not hold both sides\' STATUS.md');
}
await clause('PRD-07.R8 clause 2 (a)', 'two open pull requests that both changed `STATUS.md`; one merges squashed; the update on the other completes without a person, and `STATUS.md` on the branch keeps what both said', {
  broken: async () => assertStatus(await UPD_OLD(), 'a'),
  correct: async () => { const r = await UPD_NEW(); assertStatus(r, 'a'); assertPushed(r); console.log(`    clone after the merges: ${JSON.stringify(cut(r.out, 'clone', 'xx').replace(/CLONE-END[\s\S]*/, '').trim())}`); },
});
await clause('PRD-07.R8 clause 2 (b)', 'the same when the pull request merges as a merge commit, and the default branch carries the later date', {
  broken: async () => assertStatus(await UPD_OLD(), 'b'),
  correct: async () => assertStatus(await UPD_NEW(), 'b'),
});
await clause('PRD-07.R8 clause 3 (a)', 'two open pull requests that both changed the same requirement register; one merges squashed; the update on the other completes without a person, and no line either one wrote is lost', {
  broken: async () => assertRegister(await UPD_OLD(), 'a'),
  correct: async () => assertRegister(await UPD_NEW(), 'a'),
});
await clause('PRD-07.R8 clause 3 (b)', 'the same when the pull request merges as a merge commit', {
  broken: async () => assertRegister(await UPD_OLD(), 'b'),
  correct: async () => assertRegister(await UPD_NEW(), 'b'),
});
observeSameNumber(await UPD_NEW());

if (!process.env.PROBE_KEEP) fs.rmSync(base, { recursive: true, force: true });
finish('PRD-07.R8');
