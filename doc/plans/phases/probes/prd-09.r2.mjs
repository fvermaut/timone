// Probe for PRD-09.R2 — The command can be copied and run as it stands.
// Stage 7 artifact, authored 2026-10-05 (phase 53 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN a question that R1 says contains the command
//      WHEN its text is read
//      THEN the command is inside code formatting (one pair of backticks, or a code block)
//      AND nothing but the command is inside that code formatting
//      AND it holds no placeholder: the project's name and the ticket's number are the real ones
//   2. GIVEN that question is the newest question on the ticket
//      WHEN `timone status` is run
//      THEN it shows what the question asks, as it did before the command was added
//
// Clause 1 reads every question R1's probe makes the machine post, on this build: the runner's on
// the ticket and on the pull request, both spending limit notices, the notice that the approved
// pieces could not be acted on, and the sentence each step is told to write. The project is
// `fixture` in timone.yaml, the ticket #12, the pull request #100.
// Clause 2 runs `timone status` after a runner's question, on this build and on the build before
// phase 53, and compares the two lines for the ticket. The register's hint: what a run waits on is
// read from the last line, and nothing is read from a line over 300 characters. So the question is
// also asked with a 280-character ask, which a command added to that line would push past 300.
//
// Break legs. Clause 1a: the same questions on the build before phase 53, which carry no command.
// Clauses 1b and 1c: this build's questions with only their own fact changed (see below).
// Clause 2: an ask of 320 characters, which `timone status` is known (register hint) not to show —
// the check must go red when the ask is not shown.
import { clause, assert, finish, REAL_ONLY } from './_rig.mjs';
import { N, PROJECT, COMMAND, before53, textOf, isQuestion, codeSpans, runnerPosts, limitNotice, piecesFailed, stepInstructions, statusAfterQuestion } from './_questions.mjs';

const old = before53();
const ASK = (s) => `PROBE-R2 ${s}: which colour should the count be?\n\n**What I need from you:** say red or blue (${s}).`;

async function questions(cli) {
  const [t, p, l1, l2, f, s] = await Promise.all([
    runnerPosts({ cli, posts: [{ where: 'ticket', body: ASK('ticket'), reason: 'probe' }] }),
    runnerPosts({ cli, pr: true, posts: [{ where: 'pull-request', body: ASK('pull request'), reason: 'probe' }] }),
    limitNotice({ cli, how: 'step' }),
    limitNotice({ cli, how: 'new-run' }),
    piecesFailed({ cli }),
    stepInstructions({ cli, stages: ['triage', 'execution', 'delivery'] }),
  ]);
  const sentence = (st) => (s[st].text ?? '').split('\n').find((l) => l.startsWith('You can answer here')) ?? '';
  const list = [
    ['the runner\'s question on the ticket', t.find('PROBE-R2 ticket') ?? ''],
    [`the runner's question on pull request #${p.pr}`, p.onPr.find((b) => b.includes('PROBE-R2 pull request')) ?? ''],
    ['the spending limit notice (a step passed the limit)', l1.notice],
    ['the spending limit notice (a new run over its limit)', l2.notice],
    ['the notice that the approved pieces could not be acted on', f.notice],
    ['the sentence the triage step is told to write', sentence('triage')],
    ['the sentence the building step is told to write', sentence('execution')],
    ['the sentence the delivery step is told to write', sentence('delivery')],
  ];
  for (const r of [t, p, l1, l2, f]) r.fx.cleanup();
  return list;
}
const now = await questions(undefined);
const before = REAL_ONLY ? null : await questions(old);

const spansWith = (body) => codeSpans(body).filter((c) => c.includes('timone takeover'));
function each(list, fn) {
  const bad = [];
  for (const [where, body] of list) {
    try { assert(body, 'nothing was posted'); if (!where.startsWith('the sentence')) assert(isQuestion(body), 'setup: not a question'); fn(body); } catch (e) { bad.push(`${where}: ${e.message}`); }
  }
  assert(bad.length === 0, bad.join(' | '));
}
const inCode = (body) => assert(spansWith(body).length > 0, `the command is not inside code formatting: "${textOf(body).replace(/\s+/g, ' ').slice(0, 200)}"`);
const onlyCommand = (body) => { inCode(body); const extra = spansWith(body).filter((c) => c.trim() !== c || !/^timone takeover \S+$/.test(c)); assert(extra.length === 0, `something besides the command is inside the code formatting: ${extra.map((c) => `\`${c}\``).join(', ')}`); };
const real = (body) => { inCode(body); const wrong = spansWith(body).filter((c) => c !== COMMAND); assert(wrong.length === 0, `the command is not \`${COMMAND}\` (project ${PROJECT} in timone.yaml, ticket #${N}): ${wrong.map((c) => `\`${c}\``).join(', ')}`); assert(!/[<>]|\bNN\b|\bproject\b#|#n\b/.test(spansWith(body).join(' ')), 'the command holds a placeholder'); };

await clause('PRD-09.R2 clause 1a', 'the command is inside code formatting (one pair of backticks, or a code block)', {
  broken: async () => each(before, inCode),
  correct: async () => each(now, inCode),
});
// The break legs of 1b and 1c change only the fact each exists to catch, in this build's own
// questions: something added inside the code formatting (1b); a placeholder, or the pull request's
// number in place of the ticket's (1c). The build before phase 53 would go red on 1a's fact first.
const mutate = (fn) => now.map(([w, b]) => [w, b.replaceAll(`\`${COMMAND}\``, fn())]);
await clause('PRD-09.R2 clause 1b', 'nothing but the command is inside that code formatting', {
  broken: async () => each(mutate(() => `\`${COMMAND} --now\``), onlyCommand),
  correct: async () => each(now, onlyCommand),
});
await clause('PRD-09.R2 clause 1c', 'it holds no placeholder: the project\'s name and the ticket\'s number are the real ones', {
  broken: async () => { let e1 = null; try { each(mutate(() => '`timone takeover <project>#<n>`'), real); } catch (e) { e1 = e; } assert(e1, 'a placeholder was not caught'); each(mutate(() => '`timone takeover fixture#100`'), real); },
  correct: async () => each(now, real),
});
for (const [where, body] of now) console.log(`    (${where}: ${spansWith(body).map((c) => `\`${c}\``).join(', ') || 'no code span with the command'})`);

// ---------------------------------------------------------------- clause 2
const SHORT = 'say whether the count goes above the list or below it.';
const LONG = `say whether the count goes above the list or below it, and whether it counts only the open to-dos or all of them; if you are not sure, say what you would expect to see on the screen when the list is empty, and I will write it the same way${'.'.padEnd(280 - 225, '.')}`.slice(0, 280);
const TOO_LONG = `${LONG}${' and more words.'.repeat(3)}`.slice(0, 320);
const [sNow, sOld, lNow, lOld, xNow] = await Promise.all([
  statusAfterQuestion({ ask: SHORT }),
  statusAfterQuestion({ cli: old, ask: SHORT }),
  statusAfterQuestion({ ask: LONG }),
  statusAfterQuestion({ cli: old, ask: LONG }),
  REAL_ONLY ? null : statusAfterQuestion({ ask: TOO_LONG }),
]);
function assertShows(where, r, ask, beforeLine) {
  const posted = r.find('Which colour');
  assert(posted && isQuestion(posted), `${where}: setup — the question was not posted`);
  assert(r.line.includes(ask.replace(/\.+$/, '').slice(0, 60)), `${where}: \`timone status\` does not show what the question asks: "${r.line}"`);
  if (beforeLine !== undefined) assert(r.line === beforeLine, `${where}: \`timone status\` shows "${r.line}", where the build before phase 53 showed "${beforeLine}"`);
}
await clause('PRD-09.R2 clause 2', '`timone status` shows what the newest question asks, as it did before the command was added', {
  broken: async () => assertShows(`an ask of ${TOO_LONG.length} characters`, xNow, TOO_LONG),
  correct: async () => {
    assert(sNow.find('Which colour')?.includes(COMMAND), 'setup: the question on this build does not carry the command');
    assertShows('a short ask', sNow, SHORT, sOld.line);
    assertShows(`an ask of ${LONG.length} characters`, lNow, LONG, lOld.line);
  },
});
console.log(`    (this build, short ask:    "${sNow.line.trim()}")`);
console.log(`    (before phase 53:          "${sOld.line.trim()}")`);
console.log(`    (this build, ${LONG.length}-character ask: "${lNow.line.trim().slice(0, 120)}…")`);
for (const r of [sNow, sOld, lNow, lOld, xNow]) r?.fx.cleanup();
finish('PRD-09.R2');
