// Probe for PRD-09.R3 — Three kinds of question leave the command out.
// Stage 7 artifact, authored 2026-10-05 (phase 53 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN a step stopped because a key or secret is missing where it runs
//      WHEN the machine asks for the key to be added
//      THEN the message does not contain `timone takeover`, not even to say that it will not help
//   2. GIVEN a run waiting for an approval
//      WHEN a named person replies with a word that is plainly a misspelling of an approval word, and
//      the machine asks whether they meant to approve
//      THEN that question does not contain `timone takeover` (PRD-04.R1)
//   3. GIVEN a terminal session opened with the command on this ticket has ended, and what it was
//      opened for is still not settled
//      WHEN the machine next asks the person something on the ticket or its pull request
//      THEN that question does not contain `timone takeover`, and says what is actually needed
//      (PRD-05.R18, case #120)
//
// Who asks. The runner asks through its post action; a step asks from its own session. Which of the
// three cases a question is, is a judgement only the model can make: code cannot tell a key request
// or a settled session from any other question. So each clause is checked in four parts:
//   (code)          when the runner marks the case, the message posted holds no `timone takeover`,
//                   and a message that names it anyway is not posted;
//   (runner told)   the runner's instructions, as the runner receives them, name the case;
//   (steps told)    each step's instructions, as the step receives them, name the case;
//   (real runner)   the real runner marks the case — a model's choice, judged by the replay against
//                   the real model; BLOCKED while no replay on this build is recorded.
// What the build was seen to do in this pass, and leaned on here: the post action's schema offers
// `leaveOutTakeover` with the values missing-key, approval-word and terminal-did-not-settle-it.
//
// Break legs. (code): the same message posted without marking the case, where this build adds the
// command. (runner told) and (steps told): the instructions of the build before phase 53, which name
// no case.
import { clause, blocked, assert, finish, REAL_ONLY } from './_rig.mjs';
import { N, COMMAND, before53, textOf, runnerPosts, stepInstructions, runnerInstructions, afterTakeover, realReplayState } from './_questions.mjs';

const old = REAL_ONLY ? null : before53();
const KEY = 'PROBE-R3 key: the build needs a key to reach the mail service.\n\nAdd `MAIL_API_KEY` to `.timone/env/fixture.env` in the folder the daemon runs from.\n\n**What I need from you:** add the key MAIL_API_KEY to that file.';
const WORD = 'PROBE-R3 word: you wrote "aprovd" on the list of pieces.\n\n**What I need from you:** say whether you meant to approve it.';
const KEY_SAYS = 'PROBE-R3 key-says: the build needs a key. A terminal session with `timone takeover` will not help here.\n\n**What I need from you:** add the key MAIL_API_KEY to `.timone/env/fixture.env`.';
const KEY_NAMES = `PROBE-R3 key-names: the build needs a key. Do not run \`${COMMAND}\` for this.\n\n**What I need from you:** add the key MAIL_API_KEY to \`.timone/env/fixture.env\`.`;
const P = (body, leave) => ({ where: 'ticket', body, reason: 'probe', ...(leave ? { leaveOutTakeover: leave } : {}) });

const posts = await runnerPosts({ posts: [P(KEY, 'missing-key'), P(WORD, 'approval-word'), P(KEY_SAYS, 'missing-key'), P(KEY_NAMES, 'missing-key')] });
const unmarked = REAL_ONLY ? null : await runnerPosts({ posts: [P(KEY), P(WORD)] });
const [runnerNow, runnerOld] = await Promise.all([runnerInstructions({}), old ? runnerInstructions({ cli: old }) : null]);
const [stepsNow, stepsOld] = await Promise.all([stepInstructions({}), old ? stepInstructions({ cli: old, stages: ['triage', 'execution', 'delivery'] }) : null]);
const stale = realReplayState();

const noCommand = (where, body) => { assert(body, `${where}: nothing was posted`); assert(!body.includes('timone takeover'), `${where}: the message contains \`timone takeover\`: "${textOf(body).replace(/\s+/g, ' ').slice(0, 300)}"`); };
const sentencesWith = (t, re) => t.replace(/\s+/g, ' ').split(/(?<=[.!?:])\s+/).filter((s) => re.test(s));
function runnerTold(t, value, caseRe) {
  assert(t.length > 1000, 'setup: no runner instructions were captured');
  const s = sentencesWith(t, new RegExp(value));
  assert(s.length > 0, `the runner's instructions never name "${value}"`);
  assert(sentencesWith(t, caseRe).length > 0, `the runner's instructions do not describe the case (${caseRe})`);
}
function stepsTold(s, caseRe) {
  const st = Object.entries(s).filter(([, v]) => v.text);
  assert(st.length > 0, 'no step started');
  const bad = st.filter(([, v]) => !sentencesWith(v.text, /timone takeover/).length || !v.text.replace(/\s+/g, ' ').match(/[Ll]eave the sentence out[^.]*timone takeover[^.]*nowhere[^]*?\./) || !caseRe.test(v.text.replace(/\s+/g, ' '))).map(([k]) => k);
  assert(bad.length === 0, `these steps are not told to leave the command out in this case: ${bad.join(', ')}`);
}

// ---------------------------------------------------------------- clause 1: a missing key
await clause('PRD-09.R3 clause 1 (code)', 'a request for a missing key, marked as one, does not contain `timone takeover`, and one that says it will not help, or names it, is not posted', {
  broken: async () => noCommand('the same request, not marked', unmarked.find('PROBE-R3 key:')),
  correct: async () => {
    noCommand('the marked request', posts.find('PROBE-R3 key:'));
    assert(!posts.find('PROBE-R3 key-says'), `a marked request saying "\`timone takeover\` will not help" was posted (${posts.results[2]})`);
    assert(!posts.find('PROBE-R3 key-names'), `a marked request naming \`${COMMAND}\` was posted (${posts.results[3]})`);
  },
});
console.log(`    (the post action answered: ${posts.results.map((r) => `"${r.slice(0, 160)}"`).join(' | ')})`);
await clause('PRD-09.R3 clause 1 (runner told)', 'the runner\'s instructions say to leave the command out of a request for a missing key, not even to say it will not help', {
  broken: async () => runnerTold(runnerOld, 'missing-key', /key or secret[^.]*missing|missing key/i),
  correct: async () => { runnerTold(runnerNow, 'missing-key', /key or secret[^.]*missing|missing key/i); assert(/not even to say that it will not help/.test(runnerNow.replace(/\s+/g, ' ')), 'the runner is not told "not even to say that it will not help"'); },
});
await clause('PRD-09.R3 clause 1 (steps told)', 'each step\'s instructions say to write `timone takeover` nowhere when asking for a missing key or secret', {
  broken: async () => stepsTold(stepsOld, /missing key or secret/),
  correct: async () => stepsTold(stepsNow, /missing key or secret/),
});
if (stale) blocked('PRD-09.R3 clause 1 (real runner)', 'the real runner marks a request for a missing key as one (the replay\'s missing-key case)', `needs a real model: ${stale}`);

// ---------------------------------------------------------------- clause 2: a misspelled approval word
await clause('PRD-09.R3 clause 2 (code)', 'the question whether a misspelled word meant approve, marked as one, does not contain `timone takeover`', {
  broken: async () => noCommand('the same question, not marked', unmarked.find('PROBE-R3 word')),
  correct: async () => noCommand('the marked question', posts.find('PROBE-R3 word')),
});
await clause('PRD-09.R3 clause 2 (runner told)', 'the runner\'s instructions say to leave the command out of the question whether a misspelled word meant approve', {
  broken: async () => runnerTold(runnerOld, 'approval-word', /misspel[^.]*approv/i),
  correct: async () => runnerTold(runnerNow, 'approval-word', /misspel[^.]*approv/i),
});
await clause('PRD-09.R3 clause 2 (steps told)', 'each step\'s instructions say to write `timone takeover` nowhere when asking whether a misspelled word meant approve', {
  broken: async () => stepsTold(stepsOld, /misspelled word meant approve/),
  correct: async () => stepsTold(stepsNow, /misspelled word meant approve/),
});
if (stale) blocked('PRD-09.R3 clause 2 (real runner)', 'the real runner, told "aprovd", records the approval or asks what the word meant, and does not name the command (replay case #218, the misspelled approval word)', `needs a real model: ${stale}`);

// ---------------------------------------------------------------- clause 3: after a terminal session
const ASKED = 'PROBE-R3 after: the session ended, and the colour of the count is still open.\n\n**What I need from you:** say which colour the count should be.';
const tNow = await afterTakeover({ post: P(ASKED, 'terminal-did-not-settle-it') });
const tUnmarked = REAL_ONLY ? null : await afterTakeover({ post: P(ASKED) });
await clause('PRD-09.R3 clause 3 (code)', 'after a terminal session on the ticket ended, a question marked as following one that did not settle things does not contain `timone takeover`', {
  broken: async () => noCommand('the same question, not marked', tUnmarked.comment),
  correct: async () => { assert(/terminal session ended/i.test(tNow.wake), `setup: the runner was not woken by the session's end: "${tNow.wake.slice(0, 200)}"`); noCommand('the marked question', tNow.comment); },
});
console.log(`    (the runner was woken with: "${tNow.wake.replace(/\s+/g, ' ').replace(/^## Why you were woken /, '').slice(0, 160)}")`);
console.log(`    (the terminal session was told: "${(tNow.session.split('\n').find((l) => /Do not write the takeover command/.test(l)) ?? 'nothing about the command').trim()}")`);
await clause('PRD-09.R3 clause 3 (runner told)', 'the runner\'s instructions say to leave the command out of a question asked after a terminal session that did not settle things', {
  broken: async () => runnerTold(runnerOld, 'terminal-did-not-settle-it', /terminal session[^.]*(did not settle|without settling)/i),
  correct: async () => runnerTold(runnerNow, 'terminal-did-not-settle-it', /terminal session[^.]*(did not settle|without settling)/i),
});
await clause('PRD-09.R3 clause 3 (steps told)', 'each step\'s instructions say to write `timone takeover` nowhere when a terminal session on the ticket has just ended without settling what is asked', {
  broken: async () => stepsTold(stepsOld, /terminal session on this ticket has just ended without settling/),
  correct: async () => stepsTold(stepsNow, /terminal session on this ticket has just ended without settling/),
});
if (stale) blocked('PRD-09.R3 clause 3 (real runner)', 'the real runner, woken after a terminal session that did not settle things, marks its question and says what is actually needed (replay case #120)', `needs a real model: ${stale}`);

for (const r of [posts, unmarked, tNow, tUnmarked]) r?.fx.cleanup();
finish('PRD-09.R3');
