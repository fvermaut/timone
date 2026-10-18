// PRD-02.R15 — Post-session guardrail hooks.
// Stage 7 artifact, authored 2026-10-18 (phase 64 verification, timone#250) from the register
// alone. No source and no test was read.
//
// The register's fifth clause, verbatim:
//   GIVEN a clean session of either kind
//   WHEN the hooks run
//   THEN they stay silent
//
// PARTIAL BY DESIGN. Phase 64 claims clause 5 for one false finding only: a session whose work
// holds PRD-07.R3's note as the register has it. That note says, of the build before phase 60,
// "that ticket was never woken". Nothing in the note says a clause was not seen to hold, so a
// session that commits it, and pushes it, is clean, and the hooks must say nothing. Clauses 1 to
// 4 (a first sighting handed back, a run flagged, a person's session journalled) are not claimed
// by this phase and are not checked here; the register's own note on R15 says what they owe is
// a live observation. A later pass that checks them adds their labels to this file.
//
// Break leg: the same session, run on the build just before phase 64 (`ba699d2`, the base of
// timone/250), where the hooks are known to speak on this note. It must go red there.
//
//   node doc/plans/phases/probes/prd-02.r15.mjs                     break leg, then real leg
//   PROBE_REAL_ONLY=1 node doc/plans/phases/probes/prd-02.r15.mjs   real leg only
import path from 'node:path';
import fs from 'node:fs';
import { clause, assert, finish, REPO_ROOT, CLI } from './_rig.mjs';
import { oldBuild } from './_old-build.mjs';
import { registerSession, block } from './_register-session.mjs';

import { BEFORE_PHASE_64 } from './_register-session.mjs';
const PRD = path.join(REPO_ROOT, 'doc', 'specs', 'prd');
const PRD07 = path.join(PRD, fs.readdirSync(PRD).find((f) => /^prd-07-.*\.criteria\.md$/.test(f)));
const R3 = block(PRD07, 'R3');
assert(R3 && /was never woken/.test(R3) && /\*\*Status:\*\* verified/.test(R3), "PRD-07.R3 in the register no longer holds the note this probe is about (verified, 'was never woken')");

function assertSilent(cli) {
  for (const kind of ['person', 'run']) {
    // The register file as the project has it, whole, and R3's block alone in a file of its own.
    for (const [name, text] of [['whole PRD-07 register', fs.readFileSync(PRD07, 'utf8')], ['R3 alone', `# PRD-01 — criteria\n\n${R3}`]]) {
      const r = registerSession(cli, { kind, files: { [name === 'R3 alone' ? 'doc/specs/prd/prd-01-probe.criteria.md' : `doc/specs/prd/${path.basename(PRD07)}`]: text } });
      assert(/^## \S+\.\.\.origin\/\S+$/.test(r.status), `${kind} session, ${name}: the session's commit did not reach the remote (${r.status}), so the session was not clean`);
      assert(r.code === 0 && r.out.trim() === '', `${kind} session, ${name}: the hooks spoke on a clean session (exit ${r.code}): ${r.out.slice(0, 400)}`);
    }
  }
}

await clause('PRD-02.R15 clause 5', 'GIVEN a clean session of either kind WHEN the hooks run THEN they stay silent — a session that commits and pushes PRD-07.R3 as the register has it ("that ticket was never woken")', {
  broken: async () => assertSilent(oldBuild(BEFORE_PHASE_64)),
  correct: async () => assertSilent(CLI),
});

finish('PRD-02.R15');
