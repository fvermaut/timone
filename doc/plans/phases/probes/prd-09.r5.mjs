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
// piece's, and this probe prints it as not checked in this phase.
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
import { fixture, model, daemon, say, sleep, clause, assert, finish, REPO_ROOT } from './_rig.mjs';

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

console.log('=== PRD-09.R5 clause 1 — each place that tells the machine how to ask a person something says that a question names the command, with the three cases of R3 left out');
console.log('    NOT CHECKED IN THIS PHASE — phase 51 claims R5 for the takeover paragraph only; this clause is the second piece\'s.');
finish('PRD-09.R5');
