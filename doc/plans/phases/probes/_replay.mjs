// Reads the recorded result of the replay of PRD-05.R18 (stage 7 artifact).
// Written 2026-09-29 (phase 40, re-check after 40z) from the register and the replay record
// alone. The replay calls the real model, and a verifier's sandbox has no model login, so the
// probes judge the result fvermaut recorded from his own terminal, in
// doc/plans/phases/reports/phase-40-replay.md. Nothing here calls a model or GitHub.
//
// A recorded run counts for this build only when no file outside doc/plans/ and doc/specs/
// changed between the commit the run names and HEAD. When something did, the run is older
// than the build: a probe reports its clause BLOCKED (not seen on this build), never PASS.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './_lib.mjs';

// A later phase that records its replay in another file points REPLAY_RECORD at it.
// ✏ 2026-10-10 (phase 58 verification): without REPLAY_RECORD, the record is the replay file of
// the highest phase in doc/plans/phases/reports/ (phase-NN-replay.md), not always phase 40's.
// Phase 58 recorded its run in phase-58-replay.md, and the old default judged run 10 of phase 40.
function newestRecord() {
  const dir = path.join(REPO_ROOT, 'doc', 'plans', 'phases', 'reports');
  const files = fs.readdirSync(dir).map((f) => [f, (f.match(/^phase-(\d+)-replay\.md$/) || [])[1]]).filter(([, n]) => n);
  if (!files.length) return 'doc/plans/phases/reports/phase-40-replay.md';
  const [f] = files.reduce((a, b) => (Number(b[1]) > Number(a[1]) ? b : a));
  return `doc/plans/phases/reports/${f}`;
}
export const RECORD = process.env.REPLAY_RECORD || newestRecord();
export const REGISTER = 'doc/specs/prd/prd-05-a-runner-decides-each-step.criteria.md';

const git = (...a) => execFileSync('git', ['-C', REPO_ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// The record's runs, as they stand in a file's text: number, heading, the commit the run names
// (the first `sha` after "at"), and the result (the first fenced block of the section).
export function runsIn(text) {
  const runs = [];
  for (const sec of text.split(/\n(?=## Run \d+ )/).slice(1)) {
    const n = Number(sec.match(/^## Run (\d+) /)[1]);
    const heading = sec.split('\n')[0].replace(/^## /, '');
    // ✏ 2026-10-10 (phase 58 verification): blank lines at the top of the block are dropped.
    // phase-58-replay.md's block starts with one, and the header check read "" as the first line.
    const result = ((sec.match(/```\n([\s\S]*?)\n```/) || [])[1] ?? '').replace(/^\s*\n/, '');
    const commit = (sec.match(/\bat `([0-9a-f]{7,40})`/) || [])[1];
    runs.push({ n, heading, result, commit });
  }
  return runs;
}
export const recordedRuns = () => runsIn(fs.readFileSync(path.join(REPO_ROOT, RECORD), 'utf8'));
export function recordedRun(n) {
  const runs = recordedRuns();
  const r = n === undefined ? runs.reduce((a, b) => (b.n > a.n ? b : a)) : runs.find((x) => x.n === n);
  if (!r) throw new Error(`run ${n} is not in ${RECORD}`);
  return r;
}

// The register's table of cases for R18, by the ticket names in its first column
// ("[#143](…), [#161](…)" is the case "#143, #161"), as the replay prints them.
export function tableCases() {
  const reg = fs.readFileSync(path.join(REPO_ROOT, REGISTER), 'utf8');
  const block = reg.split(/\n(?=## R\d+ )/).find((b) => b.startsWith('## R18 '));
  return block.split('\n').filter((l) => /^\s*\| \[/.test(l)).map((l) => [...l.split('|')[1].matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).join(', '));
}

export const caseLine = (result, c) => result.split('\n').find((l) => l.startsWith(`PASS ${c} — `) || l.startsWith(`FAIL ${c} — `));

// A copy of a result with one case's line replaced (or removed, with null): for break legs.
export function withCase(result, c, line) {
  const out = result.split('\n').flatMap((l) => (l.startsWith(`PASS ${c} — `) || l.startsWith(`FAIL ${c} — `) ? (line === null ? [] : [line]) : [l]));
  return out.join('\n');
}

// The result is the real model's, with three separate tries per case: not the scripted runner.
export function assertRealModel(result, count) {
  const head = result.split('\n')[0] ?? '';
  const m = head.match(/^Replaying (\d+) cases, 3 tries each, on (\S+)\.$/);
  assert(m && !/--dry|scripted runner|no model/.test(head), `not a run of the real model with three tries each: "${head}"`);
  // ✏ 2026-10-10 (phase 58 verification): at least the table's cases, not exactly. The replay
  // has grown cases the table does not list (#202, #218, #238); the clause is about the table's.
  assert(Number(m[1]) >= count, `the replay ran ${m[1]} cases; the register's table has ${count}`);
}
// The case chose the table's action on each of three tries.
export function assertChosen(result, c) {
  const line = caseLine(result, c);
  assert(line, `case ${c} is missing from the result`);
  assert(line.startsWith('PASS ') && / 3 of 3 tries\.$/.test(line.trim()), `case ${c}: ${line.slice(0, 200)}`);
}

// Which paths outside doc/plans/ and doc/specs/ changed between a commit and HEAD.
export function changedSince(commit) {
  git('merge-base', '--is-ancestor', commit, 'HEAD');
  return git('diff', '--name-only', commit, 'HEAD').split('\n').filter(Boolean).filter((p) => !/^doc\/(plans|specs)\//.test(p));
}
// Is a recorded run on this build? Returns null when it is, or the reason it is not.
export function staleness(run) {
  if (!run.commit) return `run ${run.n} does not name the commit it ran on`;
  let changed;
  try { changed = changedSince(run.commit); } catch { return `run ${run.n}'s commit ${run.commit} is not in this branch's history`; }
  return changed.length ? `run ${run.n} ran at ${run.commit}, and ${changed.length} file(s) outside doc/plans/ and doc/specs/ changed since` : null;
}

function assert(cond, message) { if (!cond) throw new Error(message); }
