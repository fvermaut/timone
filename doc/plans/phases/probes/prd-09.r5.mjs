// Probe for PRD-09.R5 — The written rules say the same as the machine does.
// Stage 7 artifact, authored 2026-10-05 (phase 51 verification) from the register alone.
//
// Register clauses (verbatim):
//   GIVEN the build of this PRD is merged
//   WHEN `process.md`, the runner's instructions in `src/runner/brief.ts`, and the step skills under
//   `.claude/skills/` are read
//   1. THEN each place that tells the machine how to ask a person something says that a question
//      names the command, with the three cases of R3 left out
//   2. AND `process.md`'s paragraph on `timone takeover` says that a takeover typed while a step runs
//      waits for it to end, then opens
//   3. AND no line in them says that a takeover refuses while a step of its own ticket runs
//
// Phase 51 claims R5 "for the takeover paragraph only": clauses 2 and 3. Clause 1 is the second
// piece's (phase 53), and was printed as not checked until then. ✏ 2026-10-05 (phase 53
// verification): clause 1 is written at the end of this file and checked from here on.
//
// The runner's instructions are read as the runner receives them: the built daemon is run once
// through _rig.mjs, and the system prompt and first message the fake model is sent are the text.
// That is the instructions as they act, and no source file is opened.
//
// Break legs. Clause 2: `process.md` as it stood on main just before phase 51 (e16cb71), whose
// paragraph on the takeover said nothing of a running step. Clause 3 (all three places): the same
// texts with one sentence planted that says the refused thing, which the check must find. The old
// process.md has no such sentence (the refusal was the program's), so it cannot be clause 3's break.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, model, daemon, say, sleep, clause, assert, finish, REPO_ROOT, REAL_ONLY } from './_rig.mjs';

const BEFORE_PHASE_51 = 'e16cb719c20bf56ebb9f38871d27ec497dc1f32f';
const processNow = fs.readFileSync(path.join(REPO_ROOT, 'process.md'), 'utf8');
const processOld = execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_51}:process.md`], { encoding: 'utf8' });

const paragraphs = (t) => t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
const sentencesOf = (t) => paragraphs(t).flatMap((p) => p.split(/(?<=[.!?])\s+(?=[*A-Z✏(`])/));

// ---------------------------------------------------------------- clause 2
// The paragraph on `timone takeover`: the paragraph that starts with the command, as a heading-like
// bold lead, or failing that every paragraph that names it.
function takeoverParagraph(t) {
  const ps = paragraphs(t);
  const lead = ps.filter((p) => /^\*\*`timone takeover/.test(p));
  return lead.length ? lead : ps.filter((p) => p.includes('timone takeover'));
}
function assertSaysWaits(t) {
  const ps = takeoverParagraph(t);
  assert(ps.length > 0, 'no paragraph on `timone takeover`');
  const ok = ps.some((p) => p.split(/(?<=[.!?])\s+/).some((s) => /typed while a step|while a step .*runs|while .*step .*running/i.test(s) && /\bwaits?\b/i.test(s) && /\bend/i.test(s) && /\bopens?\b/i.test(s)));
  assert(ok, `the paragraph on timone takeover does not say that a takeover typed while a step runs waits for it to end, then opens: "${ps[0].slice(0, 300)}"`);
}
await clause('PRD-09.R5 clause 2', "process.md's paragraph on `timone takeover` says that a takeover typed while a step runs waits for it to end, then opens", {
  broken: async () => assertSaysWaits(processOld),
  correct: async () => assertSaysWaits(processNow),
});
console.log(`    (the paragraph: "${takeoverParagraph(processNow)[0]?.slice(0, 900)}")`);

// ---------------------------------------------------------------- clause 3
// A sentence says a takeover refuses while a step of its own ticket runs when it names the takeover,
// says it is refused or opens nothing, and says why in terms of the machine working on the run or a
// step running. A sentence that tells the history of the rule (no longer, used to, is gone, replaced)
// or that is about another ticket is not one.
const REFUSE = /(refus|opens no session|does not open|doesn't open|won't open|will not open|no session opens)/i;
const BUSY = /(working on|step .*run|running step|step is running|busy)/i;
const HISTORY = /(no longer|used to|is gone|was replaced|is replaced|replaced by|replaces|removed|instead of)/i;
const OTHER = /(another (ticket|run)|other (ticket|run))/i;
const PICKED_UP = /(picked up|picked-up|no step runs)/i;
function refusals(t) {
  return sentencesOf(t).filter((s) => /takeover/i.test(s) && REFUSE.test(s) && BUSY.test(s) && !HISTORY.test(s) && !OTHER.test(s) && !PICKED_UP.test(s));
}
const PLANTED = '\n\nA takeover is refused while a step of its own ticket is running: no session opens, and it says the machine is working on it.\n\n';
const assertNone = (where, t) => {
  const r = refusals(t);
  assert(r.length === 0, `${where} says a takeover refuses while a step of its own ticket runs: ${r.map((s) => `"${s.slice(0, 260)}"`).join(' | ')}`);
};
await clause('PRD-09.R5 clause 3 (process.md)', 'no line in process.md says that a takeover refuses while a step of its own ticket runs', {
  broken: async () => assertNone('process.md, with one planted sentence', processNow + PLANTED),
  correct: async () => assertNone('process.md', processNow),
});
console.log(`    (process.md before phase 51 had no such sentence either: ${refusals(processOld).length} found; the refusal was the program's, not the document's)`);

const SKILLS = path.join(REPO_ROOT, '.claude', 'skills');
const skillFiles = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md')) skillFiles.push(p); } };
walk(SKILLS);
const skillsText = skillFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n\n');
await clause('PRD-09.R5 clause 3 (skills)', `no line in the step skills under .claude/skills/ (${skillFiles.length} files) says that a takeover refuses while a step of its own ticket runs`, {
  broken: async () => assertNone('the skills, with one planted sentence', skillsText + PLANTED),
  correct: async () => assertNone('the skills', skillsText),
});

// The runner's instructions, as the runner receives them.
const fx = fixture({ issues: { fixture: { 12: {} } } });
const m = await model({ runner: () => say() });
await daemon(fx, m, { until: () => m.runner().length > 0, timeoutMs: 30000, settleMs: 500 });
await m.stop();
const q = m.runner()[0];
const runnerText = q ? `${q.system}\n\n${q.brief}` : '';
await clause('PRD-09.R5 clause 3 (the runner\'s instructions)', "no line in the runner's instructions, as the runner receives them, says that a takeover refuses while a step of its own ticket runs", {
  broken: async () => { assert(runnerText.length > 1000, 'setup: no runner instructions were captured'); assertNone("the runner's instructions, with one planted sentence", runnerText + PLANTED); },
  correct: async () => { assert(runnerText.length > 1000, 'setup: no runner instructions were captured'); assertNone("the runner's instructions", runnerText); },
});
const mentions = sentencesOf(runnerText).filter((s) => /takeover/i.test(s));
console.log(`    (the runner's instructions: ${runnerText.length} characters; sentences naming the takeover: ${mentions.length})`);
for (const s of mentions) console.log(`      - "${s.slice(0, 240)}"`);
fx.cleanup();
// The filters above are the probe's judgement. Every sentence they set aside is printed, so a reader
// can argue with each one.
for (const [where, t] of [['process.md', processNow], ['skills', skillsText], ["runner's instructions", runnerText]]) {
  const aside = sentencesOf(t).filter((s) => /takeover/i.test(s) && REFUSE.test(s) && !refusals(t).includes(s));
  console.log(`    (set aside in ${where}: ${aside.length} sentence(s) naming a takeover and a refusal)`);
  for (const s of aside) console.log(`      - "${s.slice(0, 300)}"`);
}

// ---------------------------------------------------------------- clause 1
// ✏ 2026-10-05 (phase 53 verification): clause 1 is phase 53's, and is checked from here on.
// "Each place that tells the machine how to ask a person something":
//   - in process.md, the paragraph that starts "Every message ends with the line *What I need from
//     you:*", and the section Writing to the human, whose rule every skill points at;
//   - the runner's instructions, as the runner receives them (captured above);
//   - every skill under .claude/skills/ that tells the machine how to write to a person: it names
//     the *What I need from you* line, or points at Writing to the human for what it posts on a
//     ticket. A skill whose only rule on asking is to ask nobody anything is not such a place; it is
//     named below, so a reader can argue with that.
// Says the rule: names `timone takeover` with the project and the ticket, and leaves out the three
// cases of R3 — listed (a missing key or secret; a misspelled word meant approve; a terminal session
// that did not settle things), or by pointing at the place in process.md that lists them.
// Break legs: process.md and the skills as they stood at phase 53's merge-base (BEFORE_PHASE_53),
// and the runner's instructions of the build before phase 53.
const BEFORE_PHASE_53 = '3d7c360e6464882f7e149ffce5c0ede6396d6506';
const flat = (t) => t.replace(/\s+/g, ' ');
const THREE = [/missing key|key or secret[^.]*missing|missing[^.]*key or secret|key or secret/i, /misspel[^.]*approv/i, /terminal session[^.]*(did not settle|without settling|ended without)|did not settle/i];
const namesCommand = (t) => /timone takeover (<project>#<n>|`?<project>`?#`?<n>`?)|`timone takeover` (for|with) (its|this) ticket|`timone takeover`[^.]*(this|its) ticket|takeover[^.]*this ticket/i.test(flat(t));
const threeCases = (t) => THREE.every((re) => re.test(flat(t))) || /three cases[^.]*\[?Writing to the human/i.test(flat(t));
function assertProcess(t, where) {
  const ps = paragraphs(t);
  const ends = ps.find((p) => p.startsWith('**Every message ends with the line *What I need from you:*.**'));
  assert(ends, `${where}: no paragraph starts "Every message ends with the line *What I need from you:*"`);
  assert(namesCommand(ends) && /three cases/i.test(ends), `${where}: the paragraph "Every message ends with the line *What I need from you:*" does not say a question names the command, with three cases left out: "${ends.slice(-400)}"`);
  const sec = t.split(/\n(?=## )/).find((x) => /^## Writing to the human/.test(x)) ?? '';
  assert(sec, `${where}: no section Writing to the human`);
  const rule = paragraphs(sec).findIndex((p) => /question names the command/i.test(p));
  assert(rule >= 0, `${where}: Writing to the human has no rule that a question names the command`);
  const block = paragraphs(sec).slice(rule, rule + 6).join('\n\n');
  assert(/timone takeover <project>#<n>/.test(block), `${where}: the rule in Writing to the human does not name \`timone takeover <project>#<n>\``);
  assert(THREE.every((re) => re.test(flat(block))), `${where}: the rule in Writing to the human does not list the three cases of R3: ${THREE.filter((re) => !re.test(flat(block))).join(', ')}`);
}
const processBefore53 = execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_53}:process.md`], { encoding: 'utf8' });
await clause('PRD-09.R5 clause 1 (process.md)', 'process.md, where it tells the machine how to ask a person something, says that a question names the command, with the three cases of R3 left out', {
  broken: async () => assertProcess(processBefore53, 'process.md before phase 53'),
  correct: async () => assertProcess(processNow, 'process.md'),
});

function assertRunner(t, where) {
  assert(t.length > 1000, `${where}: setup — no runner instructions were captured`);
  const ss = sentencesOf(t).filter((x) => /takeover/i.test(x) && /question/i.test(x));
  assert(ss.length > 0, `${where}: no sentence of the runner's instructions says a question names the takeover command`);
  const rule = paragraphs(t).filter((p) => /takeover/i.test(p) && /question/i.test(p)).join(' ');
  assert(THREE.every((re) => re.test(rule)), `${where}: the runner's rule on questions does not leave out the three cases of R3: ${THREE.filter((re) => !re.test(rule)).join(', ')}`);
}
let runnerBefore53 = '';
if (!REAL_ONLY) {
  const { oldBuild } = await import('./_old-build.mjs');
  const fx0 = fixture({ issues: { fixture: { 12: {} } }, cli: oldBuild(BEFORE_PHASE_53) });
  const m0 = await model({ runner: () => say() });
  await daemon(fx0, m0, { until: () => m0.runner().length > 0, timeoutMs: 30000, settleMs: 500 });
  await m0.stop();
  const q0 = m0.runner()[0];
  runnerBefore53 = q0 ? `${q0.system}\n\n${q0.brief}` : '';
  fx0.cleanup();
}
await clause('PRD-09.R5 clause 1 (the runner\'s instructions)', 'the runner\'s instructions, as the runner receives them, say that a question names the command, with the three cases of R3 left out', {
  broken: async () => assertRunner(runnerBefore53, 'the build before phase 53'),
  correct: async () => assertRunner(runnerText, 'this build'),
});
for (const p of paragraphs(runnerText).filter((p) => /takeover/i.test(p) && /question/i.test(p))) console.log(`    (the runner is told: "${p.slice(0, 500)}")`);

// The skills: which tell the machine how to write to a person, and does each say the rule.
const skillDirs = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const readSkill = (dir, sha) => (sha ? (() => { try { return execFileSync('git', ['-C', REPO_ROOT, 'show', `${sha}:.claude/skills/${dir}/SKILL.md`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } })() : fs.readFileSync(path.join(SKILLS, dir, 'SKILL.md'), 'utf8'));
const asksNobody = (t) => /ask nobody anything/i.test(t) && /do not post a comment that asks for anything/i.test(flat(t));
const tellsHowToAsk = (t) => /What I need from you/.test(t) || /follows \[Writing to the human\]/.test(t) || /ticket comment/i.test(t);
function judgeSkills(sha) {
  return skillDirs.map((d) => {
    const t = readSkill(d, sha);
    const place = tellsHowToAsk(t) && !asksNobody(t);
    return { d, place, nobody: asksNobody(t), says: place ? namesCommand(t) && threeCases(t) : null };
  });
}
function assertSkills(js, where) {
  const places = js.filter((j) => j.place);
  assert(places.length > 0, `${where}: no skill tells the machine how to ask`);
  const bad = places.filter((j) => !j.says).map((j) => j.d);
  assert(bad.length === 0, `${where}: these skills tell the machine how to write to a person and do not say a question names the command with the three cases left out: ${bad.join(', ')}`);
}
const skillsNow = judgeSkills(null);
await clause('PRD-09.R5 clause 1 (the step skills)', `each step skill under .claude/skills/ that tells the machine how to ask a person something says that a question names the command, with the three cases of R3 left out`, {
  broken: async () => assertSkills(judgeSkills(BEFORE_PHASE_53), 'the skills before phase 53'),
  correct: async () => assertSkills(skillsNow, 'the skills'),
});
for (const j of skillsNow) console.log(`    (${j.d}: ${j.place ? (j.says ? 'tells how to ask; says the rule' : 'tells how to ask; DOES NOT say the rule') : j.nobody ? 'not a place that tells how to ask: its rule is to ask nobody anything' : 'not a place that tells how to ask'})`);
finish('PRD-09.R5');
