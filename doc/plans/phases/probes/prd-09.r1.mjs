// Probe for PRD-09.R1 — Every question names the command, and says both ways to answer.
// Stage 7 artifact, authored 2026-10-05 (phase 53 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN a run of ticket `<n>` of project `<project>`
//      WHEN the machine posts a question on the ticket, and none of the cases of R3 applies
//      THEN the question contains the command
//      AND it says that the person can answer either by writing on the ticket or by running the command
//   2. GIVEN a run whose pull request is open
//      WHEN the machine posts a question on the pull request, as a comment or in the pull request's
//      description, and none of the cases of R3 applies
//      THEN the question contains the command, with the ticket's number and not the pull request's
//   3. GIVEN each way the machine posts a message: the runner's post action, a step's own comment, and
//      each message that code writes itself (for example the spending limit notice and the notice that
//      an approved list of pieces could not be acted on)
//      WHEN that way posts a question
//      THEN the first two clauses hold for it
//
// A step posts its own comments from its model session, which no fake model can stand for. As the
// register's hint says, a step's part is judged on what the step is told: its instructions, as the
// step session receives them, must hold the sentence with the command for its ticket, word for word.
// The pull request's description is written by the delivery step, so it is judged the same way.
// Whether the REAL runner leaves the command in when none of R3's cases applies is a model's choice;
// it is printed BLOCKED while the replay against the real model has not run on this build.
//
// Break legs: the same scenarios on the build before phase 53 (_questions.mjs, BEFORE_PHASE_53),
// where nothing the machine posts names the command.
import { clause, blocked, assert, finish } from './_rig.mjs';
import { N, PROJECT, COMMAND, before53, textOf, isQuestion, lastAsk, runnerPosts, limitNotice, piecesFailed, stepInstructions, realReplayState, STAGES } from './_questions.mjs';
import { REAL_ONLY } from './_rig.mjs';

const ASK = (s) => `PROBE-R1 ${s}: which colour should the count be?\n\n**What I need from you:** say red or blue (${s}).`;
const old = REAL_ONLY ? null : before53();

// The sentence must say both ways: in writing, and by running the command, in the same paragraph.
function assertNamesAndBothWays(where, body, { onTicket = true } = {}) {
  assert(body, `${where}: nothing was posted`);
  assert(isQuestion(body), `${where}: setup — not a question: ${lastAsk(body)}`);
  assert(body.includes(COMMAND), `${where}: the question does not contain \`${COMMAND}\`: "${textOf(body).replace(/\s+/g, ' ').slice(0, 400)}"`);
  const para = textOf(body).split(/\n\s*\n/).find((p) => p.includes(COMMAND));
  if (onTicket) {
    assert(/\bin writing\b|\bby writing\b|\bwrite\b/i.test(para), `${where}: the paragraph with the command does not say the person can answer in writing: "${para}"`);
    assert(/\banswer\b/i.test(para) && /\brunning\b|\brun\b/i.test(para), `${where}: the paragraph with the command does not say the person can answer by running it: "${para}"`);
  }
}

// ---------------------------------------------------------------- the runner's post action
const tNow = await runnerPosts({ posts: [{ where: 'ticket', body: ASK('ticket'), reason: 'probe: a question for the person' }] });
const tOld = old ? await runnerPosts({ cli: old, posts: [{ where: 'ticket', body: ASK('ticket'), reason: 'probe: a question for the person' }] }) : null;
await clause('PRD-09.R1 clause 1 (the runner\'s post action)', 'a question the runner posts on the ticket contains the command, and says the person can answer in writing or by running it', {
  broken: async () => assertNamesAndBothWays('the build before phase 53', tOld.find('PROBE-R1 ticket')),
  correct: async () => assertNamesAndBothWays('this build', tNow.find('PROBE-R1 ticket')),
});
console.log(`    (posted: "${textOf(tNow.find('PROBE-R1 ticket') ?? '').replace(/\n/g, '⏎')}")`);

const pNow = await runnerPosts({ pr: true, posts: [{ where: 'pull-request', body: ASK('pull request'), reason: 'probe: a question on the pull request' }] });
const pOld = old ? await runnerPosts({ cli: old, pr: true, posts: [{ where: 'pull-request', body: ASK('pull request'), reason: 'probe: a question on the pull request' }] }) : null;
function assertOnPr(where, r) {
  assert(r.pr, `${where}: setup — no pull request was opened`);
  assert(r.pr !== N, `${where}: setup — the pull request has the ticket's number`);
  const body = r.onPr.find((b) => b.includes('PROBE-R1 pull request'));
  assert(body, `${where}: the question was not posted on pull request #${r.pr} (${r.results.join(' | ')})`);
  assertNamesAndBothWays(where, body, { onTicket: false });
  assert(!body.includes(`${PROJECT}#${r.pr}`), `${where}: the command names the pull request's number #${r.pr}`);
}
await clause('PRD-09.R1 clause 2 (the runner\'s post action)', 'a question the runner posts on the open pull request contains the command, with the ticket\'s number and not the pull request\'s', {
  broken: async () => assertOnPr('the build before phase 53', pOld),
  correct: async () => assertOnPr('this build', pNow),
});
console.log(`    (pull request #${pNow.pr} of ticket #${N}; posted: "${textOf(pNow.onPr.find((b) => b.includes('PROBE-R1')) ?? '').replace(/\n/g, '⏎')}")`);

// ---------------------------------------------------------------- what each step is told
const sNow = await stepInstructions({});
const sOld = old ? await stepInstructions({ cli: old, stages: ['execution', 'delivery'] }) : null;
const SENTENCE = `You can answer here in writing, or in your terminal by running \`${COMMAND}\`.`;
const started = (s) => Object.entries(s).filter(([, v]) => v.text);
function assertStepsTold(where, s) {
  const st = started(s);
  assert(st.length > 0, `${where}: no step started`);
  const missing = st.filter(([, v]) => !v.text.includes(COMMAND)).map(([k]) => k);
  assert(missing.length === 0, `${where}: these steps are not given the command for ticket #${N}: ${missing.join(', ')}`);
  const wrong = st.filter(([, v]) => /timone takeover [^\s`]+/.test(v.text) && [...v.text.matchAll(/timone takeover ([^\s`]+)/g)].some((m) => m[1] !== `${PROJECT}#${N}` && !/^<project>/.test(m[1]))).map(([k]) => k);
  assert(wrong.length === 0, `${where}: these steps are given a takeover command for another ticket: ${wrong.join(', ')}`);
}
await clause('PRD-09.R1 clause 1 and 3 (a step\'s own comment)', 'each step is told to put the command for its own ticket in a question it posts, and both ways to answer', {
  broken: async () => assertStepsTold('the build before phase 53', sOld),
  correct: async () => {
    assertStepsTold('this build', sNow);
    const noSentence = started(sNow).filter(([, v]) => !v.text.includes(SENTENCE)).map(([k]) => k);
    assert(noSentence.length === 0, `these steps are not given the sentence word for word: ${noSentence.join(', ')}`);
  },
});
for (const st of STAGES) console.log(`    (${st}: ${sNow[st].text ? (sNow[st].text.includes(SENTENCE) ? 'told the sentence word for word' : 'NOT told the sentence') : `no step session — ${sNow[st].refused.slice(0, 120)}`})`);

// The pull request's description is the delivery step's: it must be told that a question there
// carries the command with the ticket's number.
function assertDeliveryPr(where, s) {
  const t = s.delivery?.text ?? '';
  assert(t, `${where}: the delivery step did not start`);
  const para = t.split(/\n\s*\n/).filter((p) => /Questions for you/.test(p));
  const near = t.split(/\n\s*\n/).findIndex((p) => /Questions for you/.test(p) && /pull request/i.test(p));
  assert(near >= 0, `${where}: the delivery step is not told anything about the pull request's *Questions for you* section (${para.length} paragraphs name it)`);
  const following = t.split(/\n\s*\n/).slice(near, near + 2).join('\n\n');
  assert(following.includes(COMMAND), `${where}: what the delivery step is told about the pull request's questions does not carry \`${COMMAND}\`: "${following.slice(0, 400)}"`);
}
await clause('PRD-09.R1 clause 2 (the pull request\'s description)', 'the step that writes the pull request\'s description is told that a question there carries the command, with the ticket\'s number', {
  broken: async () => assertDeliveryPr('the build before phase 53', sOld),
  correct: async () => assertDeliveryPr('this build', sNow),
});

// ---------------------------------------------------------------- the messages code writes
const lStep = await limitNotice({ how: 'step' });
const lNew = await limitNotice({ how: 'new-run' });
const lOld = old ? await limitNotice({ cli: old, how: 'step' }) : null;
await clause('PRD-09.R1 clause 3 (the spending limit notice, a step passes the limit)', 'the spending limit notice code writes when a step passes the limit contains the command and both ways to answer', {
  broken: async () => assertNamesAndBothWays('the build before phase 53', lOld.notice),
  correct: async () => assertNamesAndBothWays('this build', lStep.notice),
});
console.log(`    (the notice: "${textOf(lStep.notice).replace(/\n/g, '⏎')}")`);
await clause('PRD-09.R1 clause 3 (the spending limit notice, a new run already over its limit)', 'the spending limit notice code writes for a new run already over its limit contains the command and both ways to answer', {
  broken: async () => assertNamesAndBothWays('this build, the notice with the command taken out', lNew.notice.replaceAll(COMMAND, 'timone')),
  correct: async () => { assert(lNew.runnerSessions === 0, `setup: a runner session started (${lNew.runnerSessions}), so this is not the notice code writes for a run over its limit`); assertNamesAndBothWays('this build', lNew.notice); },
});

const fNow = await piecesFailed({});
const fOld = old ? await piecesFailed({ cli: old }) : null;
await clause('PRD-09.R1 clause 3 (the notice that the approved pieces could not be acted on)', 'the notice code writes when an approved list of pieces could not be acted on contains the command and both ways to answer, and no other command', {
  broken: async () => assertNamesAndBothWays('the build before phase 53', fOld.notice),
  correct: async () => {
    assertNamesAndBothWays('this build', fNow.notice);
    const others = [...fNow.notice.matchAll(/`(timone [^`]+)`/g)].map((m) => m[1]).filter((c) => c !== COMMAND);
    assert(others.length === 0, `the notice names another command: ${others.join(', ')}`);
  },
});
console.log(`    (the notice: "${textOf(fNow.notice).replace(/\n/g, '⏎').slice(0, 600)}")`);

// ---------------------------------------------------------------- the real runner's choice
const stale = realReplayState();
if (stale) blocked('PRD-09.R1 clause 1 and 2 (the real runner)', 'the real runner leaves the command in (does not set leaveOutTakeover) when none of the cases of R3 applies — replay case #218 "a pull request closed with no reason"', `needs a real model: ${stale}`);
else console.log('=== PRD-09.R1 clause 1 and 2 (the real runner) — judged by PRD-05.R18\'s probe on the recorded replay of this build');

for (const r of [tNow, tOld, pNow, pOld, lStep, lNew, lOld, fNow, fOld]) r?.fx.cleanup();
finish('PRD-09.R1');
