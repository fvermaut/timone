// Probe for PRD-07.R12 — The old rule is gone from every place it is written.
// Stage 7 artifact, authored 2026-10-04 (phase 47) from the register alone. Reads the documents
// the clauses name, at this tree's HEAD; it reads them because they ARE what the clauses are
// about, not to learn how anything was built. No source is read.
//
// Register clauses (verbatim):
//   1. GIVEN the work for this PRD has merged WHEN PRD-02.R10 is read
//      THEN it is marked as replaced by this PRD's R1, R2 and R3, with a dated note
//   2. GIVEN the same WHEN PRD-02.R22 clauses 1 and 6, PRD-05.R15 clause 2, PRD-05.R11 clause 2,
//      and the out-of-scope line of PRD-03 on how a project is held are read
//      THEN each carries a dated note naming the requirement of this PRD that changes it
//   3. GIVEN the same WHEN ADR-0026 is read
//      THEN its rule "the chunk holds the project" is marked as replaced, naming the decision
//      record that replaces it
//   4. GIVEN the same WHEN `process.md` stage 6 is read
//      THEN it no longer says that a ticket-driven run holds its project until its pull request ends
//
// Phase 47 claims R12 "for what this piece changes: PRD-02.R10, PRD-02.R22 clause 6, PRD-05.R11
// clause 2, PRD-03's out-of-scope line, ADR-0026 and process.md stage 6. PRD-02.R22 clause 1 and
// PRD-05.R15 clause 2 stay with piece 5". Those two are printed, not judged.
//
// "A dated note" is a `✏ YYYY-MM-DD` marker. Words struck through (`~~…~~`) are read as not said:
// they are kept as history and marked so.
//
// Break legs: each check run on the same files at the commit just before phase 47
// (_places.mjs's BEFORE_PHASE_47), where the old rule stands unmarked.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT, clause, assert, finish } from './_lib.mjs';
import { BEFORE_PHASE_47 } from './_places.mjs';

const P02 = 'doc/specs/prd/prd-02-inversion-of-control.criteria.md';
const P05 = 'doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md';
const P03 = 'doc/specs/prd/prd-03-a-run-ends-at-its-pull-request.md';
const ADR26 = 'doc/adr/0026-a-ticket-is-a-conversation-a-run-is-a-chunk.md';
const PROC = 'process.md';
const now = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
const then = (f) => execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_47}:${f}`], { encoding: 'utf8' });
const DATED = /✏[^\n]{0,40}?\b20\d\d-\d\d-\d\d\b/;
const block = (text, rk) => { const m = text.split(/\n(?=## R\d+ )/).find((b) => b.startsWith(`## ${rk} `)); return m ?? ''; };
// The text of clause k (1-based) of a register block, with the notes under it up to the next clause.
function clauseText(b, k) {
  const crit = b.split(/\n- \*\*Criteria:\*\*/)[1] ?? '';
  const parts = crit.split(/\n    - GIVEN /).slice(1);
  return parts[k - 1] ? `GIVEN ${parts[k - 1].split(/\n- \*\*/)[0]}` : '';
}

function c1(read) {
  const b = block(read(P02), 'R10');
  assert(b, 'PRD-02.R10 not found');
  const head = b.split(/\n- \*\*/)[0];
  const note = head.split('\n').find((l) => /replaced/i.test(l) && /prd-07/i.test(l));
  assert(note, 'PRD-02.R10 carries no note saying it is replaced by PRD-07');
  assert(DATED.test(note), `the note is not dated: "${note.slice(0, 160)}"`);
  for (const r of ['r1--', 'r2--', 'r3--']) assert(note.toLowerCase().includes(`#${r}`), `the note does not name PRD-07 ${r.slice(0, 2).toUpperCase()}: "${note.slice(0, 200)}"`);
  return note;
}
function noteOnClause(text, what) {
  assert(text, `${what}: not found`);
  const notes = text.split('\n').filter((l) => /^\s*>/.test(l) && DATED.test(l) && /PRD-07[.\s]*R\d+|prd-07[^)]*#r\d+/i.test(l));
  assert(notes.length > 0, `${what} carries no dated note naming a requirement of PRD-07`);
  return notes.at(-1);
}
function c2(read) {
  const r22c6 = noteOnClause(clauseText(block(read(P02), 'R22'), 6), 'PRD-02.R22 clause 6');
  const r11c2 = noteOnClause(clauseText(block(read(P05), 'R11'), 2), 'PRD-05.R11 clause 2');
  const scope = read(P03).split('\n').find((l) => /how a project is held/i.test(l));
  assert(scope, 'PRD-03: no out-of-scope line on how a project is held');
  assert(DATED.test(scope) && /prd-07[^)]*#r\d+|PRD-07\.R\d+/i.test(scope), `PRD-03's out-of-scope line carries no dated note naming a requirement of PRD-07: "${scope.slice(0, 200)}"`);
  return { r22c6, r11c2, scope };
}
function c3(read) {
  const t = read(ADR26);
  const status = t.split('\n').find((l) => /^- \*\*Status:\*\*/.test(l)) ?? '';
  const marks = t.split('\n').filter((l) => /the chunk holds the project/i.test(l) && /replaced/i.test(l));
  assert(marks.length > 0, `ADR-0026 does not mark its rule "the chunk holds the project" as replaced (status: "${status.slice(0, 160)}")`);
  assert(marks.some((l) => /ADR-0063|0063-/i.test(l)), `the mark names no decision record that replaces it: "${marks[0].slice(0, 200)}"`);
  const named = (marks.find((l) => /0063-[a-z0-9-]+\.md/.test(l)) ?? '').match(/(0063-[a-z0-9-]+\.md)/)?.[1];
  assert(named && fs.existsSync(path.join(REPO_ROOT, 'doc', 'adr', named)), `the decision record it names does not exist: ${named}`);
  return marks[0];
}
function c4(read) {
  const stage6 = read(PROC).split('\n').find((l) => l.startsWith('**6 — Implementation.**'));
  assert(stage6, 'process.md has no stage 6');
  const said = stage6.replace(/~~[\s\S]*?~~/g, '');
  const hit = said.match(/[^.;(]*holds? (its|the) project until[^.;)]*/i);
  assert(!hit, `process.md stage 6 still says: "${hit?.[0].trim()}"`);
  return (stage6.match(/[^.]*✏ 2026-10-04[^~]*~~[^~]*~~/) || [''])[0];
}

await clause('PRD-07.R12 clause 1', 'PRD-02.R10 is read: it is marked as replaced by this PRD\'s R1, R2 and R3, with a dated note', { broken: () => c1(then), correct: () => c1(now) });
console.log(`    (the note: "${c1(now).slice(0, 300)}…")`);
// The break leg goes red only when each of the three places fails on the old files.
function c2EachRed(read) {
  const parts = [
    () => noteOnClause(clauseText(block(read(P02), 'R22'), 6), 'PRD-02.R22 clause 6'),
    () => noteOnClause(clauseText(block(read(P05), 'R11'), 2), 'PRD-05.R11 clause 2'),
    () => { const sc = read(P03).split('\n').find((l) => /how a project is held/i.test(l)) ?? ''; assert(DATED.test(sc) && /prd-07[^)]*#r\d+|PRD-07\.R\d+/i.test(sc), 'PRD-03: no dated note naming PRD-07'); },
  ];
  const errs = [];
  for (const f of parts) { try { f(); } catch (e) { errs.push(e.message); } }
  if (errs.length === parts.length) throw new Error(errs.join(' / '));
}
await clause('PRD-07.R12 clause 2 (for what this piece changes)', 'PRD-02.R22 clause 6, PRD-05.R11 clause 2, and the out-of-scope line of PRD-03 on how a project is held are read: each carries a dated note naming the requirement of this PRD that changes it', { broken: () => c2EachRed(then), correct: () => c2(now) });
{
  const n = c2(now);
  console.log(`    (PRD-02.R22 clause 6: "${n.r22c6.trim().slice(0, 200)}…")`);
  console.log(`    (PRD-05.R11 clause 2: "${n.r11c2.trim().slice(0, 200)}…")`);
  console.log(`    (PRD-03: "…${n.scope.slice(n.scope.indexOf('✏') - 1, n.scope.indexOf('✏') + 220)}…")`);
  const left = [['PRD-02.R22 clause 1', clauseText(block(now(P02), 'R22'), 1)], ['PRD-05.R15 clause 2', clauseText(block(now(P05), 'R15'), 2)]];
  for (const [what, text] of left) {
    const has = text.split('\n').some((l) => /^\s*>/.test(l) && DATED.test(l) && /PRD-07|prd-07/.test(l));
    console.log(`    (NOT CLAIMED by phase 47, piece 5's: ${what} — ${has ? 'carries' : 'does not carry yet'} a dated note naming a requirement of PRD-07)`);
  }
}
// ✏ 2026-10-05 (phase 49 verification): phase 49 (piece 5) claims R12 for PRD-02.R22 clause 1
// and PRD-05.R15 clause 2, the two places phase 47 left. Same check as above, on those two
// clauses. Break leg: the same files at the commit just before phase 49 (BEFORE_PHASE_49, the
// merge-base of timone/203 with main), where neither carried a note; both must go red there.
const BEFORE_PHASE_49 = '55cddb4820ea9965313972e1848fe29a21f5a2f0';
const before49 = (f) => execFileSync('git', ['-C', REPO_ROOT, 'show', `${BEFORE_PHASE_49}:${f}`], { encoding: 'utf8' });
function c2Piece5(read) {
  return {
    r22c1: noteOnClause(clauseText(block(read(P02), 'R22'), 1), 'PRD-02.R22 clause 1'),
    r15c2: noteOnClause(clauseText(block(read(P05), 'R15'), 2), 'PRD-05.R15 clause 2'),
  };
}
function c2Piece5EachRed(read) {
  const errs = [];
  for (const f of [() => noteOnClause(clauseText(block(read(P02), 'R22'), 1), 'PRD-02.R22 clause 1'), () => noteOnClause(clauseText(block(read(P05), 'R15'), 2), 'PRD-05.R15 clause 2')]) { try { f(); } catch (e) { errs.push(e.message); } }
  if (errs.length < 2) throw new Error(`only ${errs.length} of the two places lacks the note on the old files`);
  throw new Error(errs.join(' / '));
}
await clause('PRD-07.R12 clause 2 (for what piece 5 changes)', 'PRD-02.R22 clause 1 and PRD-05.R15 clause 2 are read: each carries a dated note naming the requirement of this PRD that changes it', { broken: () => { try { c2Piece5EachRed(before49); } catch (e) { if (/only \d of the two/.test(e.message)) return; throw e; } }, correct: () => c2Piece5(now) });
{
  const n = c2Piece5(now);
  console.log(`    (PRD-02.R22 clause 1: "${n.r22c1.trim().slice(0, 300)}…")`);
  console.log(`    (PRD-05.R15 clause 2: "${n.r15c2.trim().slice(0, 300)}…")`);
}
await clause('PRD-07.R12 clause 3', 'ADR-0026 is read: its rule "the chunk holds the project" is marked as replaced, naming the decision record that replaces it', { broken: () => c3(then), correct: () => c3(now) });
console.log(`    (the mark: "${c3(now).slice(0, 260)}…")`);
await clause('PRD-07.R12 clause 4', 'process.md stage 6 is read: it no longer says that a ticket-driven run holds its project until its pull request ends', { broken: () => c4(then), correct: () => c4(now) });
console.log(`    (what stands there now: "${c4(now).trim().slice(-420)}")`);

finish('PRD-07.R12');
