// Checks the runner asked for on timone#250 (phase 64), beyond the criteria register.
// Stage 7 artifact, written 2026-10-18 by phase 64's verification.
//
// This is NOT the probe of a criterion. Phase 64 claims PRD-02.R15 clause 5 for one false
// finding, and that has its own probe (prd-02.r15.mjs). The runner's instructions asked for
// three things to be confirmed:
//   1. the real PRD-07.R3 note gives no finding from the verified-status check — this is the
//      R15 probe's clause, and is not repeated here;
//   2. notes that say "never seen", "never observed", "never triggered" are still flagged;
//   3. each finding has its own advice, and the never-seen finding no longer asks for a
//      `Falsified-by:` line.
// The rule the check enforces is the one the verification instructions state: a status may not
// outrun the block's own notes, and a claim about every case is not closed by watching unless a
// `Falsified-by:` line names a check that can fail. Written from those words and from what the
// built Stop hook printed. No source and no test source was read.
//
// Part 2's break leg: the same notes on a block whose status is `draft`, where nothing is owed,
// so the check must stay silent and the assertion must go red. Part 3's break leg: the build just
// before phase 64 (`ba699d2`), which is known to offer a `Falsified-by:` line for every finding.
//
//   node doc/plans/phases/probes/phase-64-requested.mjs                     break leg, then real leg
//   PROBE_REAL_ONLY=1 node doc/plans/phases/probes/phase-64-requested.mjs   real leg only
import { clause, assert, finish, CLI } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';
import { registerSession, findings, BEFORE_PHASE_64 } from './_register-session.mjs';

const ADMISSIONS = ['never seen', 'never observed', 'never triggered'];

// A requirement block. note: the ✏ line under Status. falsified: add a Falsified-by line.
const req = ({ rk = 'R1', title = 'A freed place goes to the oldest ticket', status = 'verified', note, via = 'api', falsified = false, then = 'the place goes to the oldest of them' }) => [
  `## ${rk} — ${title}`, '',
  '- **Priority:** MUST',
  `- **Status:** ${status}`,
  `    - ✏ 2026-10-18 ${note}`,
  `- **Verify-via:** ${via}`,
  ...(falsified ? ['- **Falsified-by:** a test with two tickets waiting, which fails if the newer one gets the place'] : []),
  '- **Criteria:**',
  '    - GIVEN tickets waiting for a place', '      WHEN a place frees', `      THEN ${then}`, '',
].join('\n');
const file = (...blocks) => ({ 'doc/specs/prd/prd-01-probe.criteria.md': `# PRD-01 — criteria\n\n${blocks.join('\n')}` });
const admitNote = (w) => `checked on a live run. Clause 1: ${w} on this build, the probe could not reach it.`;

// Each finding bullet the Stop hook printed, with the lines under it (its advice). The closing
// text every finding shares ("Deal with this before you stop…") is cut off first.
const bullets = (out) => findings(out.split('**Deal with this before you stop.**')[0]).flatMap((f) => f.split(/\n {4}- /).slice(1)).map((b) => {
  const [head, ...rest] = b.split('\n');
  return { head, advice: rest.map((l) => l.trim()).filter(Boolean).join(' ') };
});

function assertFlagged(cli, status) {
  for (const w of ADMISSIONS) {
    for (const falsified of [false, true]) {
      const r = registerSession(cli, { files: file(req({ status, note: admitNote(w), falsified })) });
      const b = bullets(r.out);
      assert(r.code !== 0 && b.length === 1 && /^R1 /.test(b[0].head) && b[0].head.includes(w), `a verified block whose note says "${w}"${falsified ? ', with a Falsified-by line,' : ''} was not flagged with the words quoted (exit ${r.code}): ${r.out.slice(0, 300) || '(silent)'}`);
    }
  }
}
await clause('phase 64 part 2', 'a verified requirement whose note says "never seen", "never observed" or "never triggered" is still flagged, with or without a Falsified-by line, and the finding quotes the words', {
  broken: async () => assertFlagged(CLI, 'draft'),
  correct: async () => assertFlagged(CLI, 'verified'),
});

function assertOwnAdvice(cli) {
  // One file, two findings of the two kinds: a note admitting a clause unseen (R1), and a claim
  // about every case verified by watching alone (R2, on the live channel, no Falsified-by line).
  const r = registerSession(cli, { files: file(
    req({ rk: 'R1', note: admitNote('never observed') }),
    req({ rk: 'R2', title: 'A place is never given to two tickets', note: 'seen on a live run: one ticket started.', via: 'live', then: 'the place is never given to both' }),
  ) });
  const b = bullets(r.out);
  const seen = b.find((x) => /^R1 /.test(x.head));
  const watched = b.find((x) => /^R2 /.test(x.head));
  assert(b.length === 2 && seen && watched, `expected two findings, R1 and R2, each its own: ${r.out.slice(0, 400) || '(silent)'}`);
  assert(seen.advice && watched.advice, `a finding has no advice of its own under it: R1 "${seen.advice}", R2 "${watched.advice}"`);
  assert(seen.advice !== watched.advice, `the two findings carry the same advice: "${seen.advice}"`);
  assert(!/Falsified-by/.test(seen.advice), `the never-seen finding still asks for a Falsified-by line: "${seen.advice}"`);
  assert(/draft/.test(seen.advice) && /note/.test(seen.advice), `the never-seen finding does not say to go back to draft or to change the note: "${seen.advice}"`);
  assert(/Falsified-by/.test(watched.advice), `the watched-only finding no longer offers a Falsified-by line: "${watched.advice}"`);
  console.log(`    (R1 advice: ${seen.advice})`);
  console.log(`    (R2 advice: ${watched.advice})`);
}
await clause('phase 64 part 3', 'each finding carries its own advice under it; the never-seen finding says to go back to draft or change the note and asks for no Falsified-by line; the watched-only finding still offers one', {
  broken: async () => assertOwnAdvice(oldBuild(BEFORE_PHASE_64)),
  correct: async () => assertOwnAdvice(CLI),
});

finish('phase 64 (requested)');
