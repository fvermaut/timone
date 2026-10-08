// Probe for PRD-10.R6 — A test runs the guard command as a container session runs it.
// Stage 7 artifact, authored 2026-10-08 (phase 57 verification) from the register alone.
//
// Register clauses (verbatim):
//   1. GIVEN the project's test suite
//      WHEN it is run
//      THEN it holds a test that starts the guard command itself, as the hook starts it, with a state
//      file that holds no run, a hook payload on stdin, and an environment holding `TIMONE_RUN_PROJECT`
//      and the container's step
//      AND that test checks that a `Write` of `<probes>/prd-10.r1.mjs` is allowed for `verification`,
//      and that a `Read` of it is refused for `execution`
//   2. GIVEN that test
//      WHEN the guard command is changed for a moment to ignore the container's step
//      THEN the test fails
//
// How it observes, WITHOUT READING THE TEST SUITE (stage 7 may not). The suite is run as a black box,
// in a clone of this repository at HEAD, built there, so the working tree is never touched. In the
// clone, the built command `dist/cli.js` is moved aside and replaced by a recorder that runs it. For
// `guardrails guard` the recorder writes down what the command was started with — its arguments, the
// TIMONE_RUN_* names of its environment, the state file's runs, the payload on stdin — and its answer.
// Every other command it hands straight to the real one, in the same process. A mode file tells it to
// change the guard for a moment:
//   pass         nothing changed: the clause 1 run.
//   ignore-step  the guard is run with TIMONE_RUN_STAGE removed from its environment: clause 2's change.
//   flip-exec    the guard's refusal of a Read for the container step `execution` is turned into an
//                allow: the change that shows a test CHECKS that refusal (clause 1's last line).
//   flip-verify  the guard's allow of a Write for the container step `verification` is turned into a
//                refusal: the change that shows a test CHECKS that allow.
// A test that "checks" an answer is one that fails when the answer changes. The tests that start to
// fail under a mode are named from the runner's own report (titles only).
//
// "A state file that holds no run" is taken to be met by a `--state` path where no file exists as well
// as by a file with no runs: in a real container the ledger file is absent (its .timone/ starts empty),
// and the guard reads no run either way. The output says which of the two the test used.
//
// Which test files: every `*.test.ts` under src/ by default; PROBE_R6_FILES (comma-separated) narrows
// the run, and the report says when it did.
//
// Break legs: both clauses, the same runs on a clone at the commit before phase 57 (c718880), whose suite
// holds no such test: no guard command is started that way, and removing the step changes no result.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { clause, finish, assert, REAL_ONLY } from './_rig.mjs';
import { REPO_ROOT } from './_lib.mjs';

const BEFORE_PHASE_57 = 'c718880c2b9a1901c0b4e46df6c02b380333f235';
const VAR = 'TIMONE_RUN_STAGE';
const memo = (f) => { let p; return () => (p ??= f()); };

// A clone at `sha`, built, with the recorder in front of dist/cli.js.
function rig(sha) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prd10-r6-'));
  process.on('exit', () => { if (!process.env.PROBE_KEEP) fs.rmSync(dir, { recursive: true, force: true }); });
  const clone = path.join(dir, 'repo');
  execFileSync('git', ['clone', '-q', '--no-checkout', REPO_ROOT, clone], { stdio: 'ignore' });
  execFileSync('git', ['-C', clone, 'checkout', '-q', '--detach', sha], { stdio: 'ignore' });
  fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(clone, 'node_modules'));
  execFileSync(process.execPath, [path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', clone], { stdio: 'ignore', timeout: 5 * 60 * 1000 });
  const dist = path.join(clone, 'dist');
  fs.renameSync(path.join(dist, 'cli.js'), path.join(dist, 'cli.real.js'));
  const modeFile = path.join(dir, 'mode');
  const log = path.join(dir, 'guard.jsonl');
  fs.writeFileSync(path.join(dist, 'cli.js'), `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const real = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.real.js');
const args = process.argv.slice(2);
if (!(args[0] === 'guardrails' && args[1] === 'guard')) {
  process.argv[1] = real;
  await import(real);
} else {
  const mode = fs.existsSync(${JSON.stringify(modeFile)}) ? fs.readFileSync(${JSON.stringify(modeFile)}, 'utf8').trim() : 'pass';
  const input = fs.readFileSync(0, 'utf8');
  const env = { ...process.env };
  if (mode === 'ignore-step') delete env.${VAR};
  const r = spawnSync(process.execPath, [real, ...args], { input, env, encoding: 'utf8' });
  let out = r.stdout ?? '';
  let payload = null, decision = null, runs = null;
  try { payload = JSON.parse(input); } catch {}
  try { decision = JSON.parse(out).hookSpecificOutput.permissionDecision; } catch {}
  const si = args.indexOf('--state');
  // The state file as the guard found it: its number of runs, or 'no file', or what it held when it was not JSON.
  if (si < 0) runs = 'no --state';
  else if (!fs.existsSync(path.resolve(args[si + 1]))) runs = 'no file';
  else { const t = fs.readFileSync(path.resolve(args[si + 1]), 'utf8'); try { runs = (JSON.parse(t).runs ?? []).length; } catch { runs = 'not JSON: ' + JSON.stringify(t.slice(0, 60)); } }
  const step = process.env.${VAR};
  const tool = payload?.tool_name;
  let changed = false;
  if (mode === 'flip-exec' && step === 'execution' && tool === 'Read' && decision === 'deny') { out = out.replace('"permissionDecision":"deny"', '"permissionDecision":"allow"'); changed = true; }
  if (mode === 'flip-verify' && step === 'verification' && tool === 'Write' && decision === 'allow') { out = out.replace('"permissionDecision":"allow"', '"permissionDecision":"deny"'); changed = true; }
  fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ mode, args, project: process.env.TIMONE_RUN_PROJECT ?? null, step: step ?? null, runs, tool, input: payload?.tool_input ?? null, stdin: !!input.trim(), decision, changed }) + '\\n');
  process.stdout.write(out);
  process.stderr.write(r.stderr ?? '');
  process.exit(r.status ?? 1);
}
`);
  return { clone, modeFile, log };
}

const FILES = (process.env.PROBE_R6_FILES ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// Runs the suite in `mode`. Returns the failing test names and the guard calls the recorder saw.
function suite(r, mode) {
  fs.writeFileSync(r.modeFile, mode);
  fs.rmSync(r.log, { force: true });
  const report = path.join(path.dirname(r.modeFile), `vitest-${mode}.json`);
  const env = { ...process.env };
  for (const k of ['TIMONE_RUN_PROJECT', 'TIMONE_RUN_BRANCH', VAR]) delete env[k];
  try {
    execFileSync(process.execPath, [path.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--reporter=json', `--outputFile=${report}`, ...FILES], { cwd: r.clone, stdio: 'ignore', timeout: 15 * 60 * 1000, env });
  } catch { /* failing tests exit non-zero; the report says which */ }
  const j = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : { testResults: [], numTotalTests: 0 };
  const failed = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === 'failed').map((a) => `${path.relative(r.clone, f.name)} > ${a.fullName}`));
  const calls = fs.existsSync(r.log) ? fs.readFileSync(r.log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { failed: new Set(failed), total: j.numTotalTests, calls };
}

const inProbes = (p, name) => typeof p === 'string' && /(doc\/plans\/phases\/probes|standards\/baseline\/probes)\//.test(p) && p.endsWith(name);
const NEW = memo(() => rig('HEAD'));
const OLD = memo(() => rig(BEFORE_PHASE_57));
const runs = {};
const run = (which, mode) => (runs[`${which}:${mode}`] ??= suite(which === 'old' ? OLD() : NEW(), mode));

function c1(which) {
  const base = run(which, 'pass');
  const shaped = (step, tool) => base.calls.filter((c) => c.args[0] === 'guardrails' && c.args[1] === 'guard' && c.args.includes('--state') && (c.runs === 0 || c.runs === 'no file') && c.stdin && c.project && c.step === step && c.tool === tool && inProbes(c.input?.file_path, 'prd-10.r1.mjs'));
  const w = shaped('verification', 'Write');
  const rd = shaped('execution', 'Read');
  assert(w.length > 0, `no test started the guard command with a state file that holds no run, a payload on stdin, TIMONE_RUN_PROJECT and step verification, for a Write of <probes>/prd-10.r1.mjs (${base.calls.length} guard commands seen in all)`);
  assert(rd.length > 0, `no test started the guard command that way with step execution, for a Read of <probes>/prd-10.r1.mjs (${base.calls.length} guard commands seen)`);
  assert(w.every((c) => c.decision === 'allow') && rd.every((c) => c.decision === 'deny'), `the guard's own answers were not allow / deny: ${w.map((c) => c.decision)} / ${rd.map((c) => c.decision)}`);
  // "checks": a test fails when either answer is changed.
  const fe = run(which, 'flip-exec');
  const fv = run(which, 'flip-verify');
  const newly = (m) => [...m.failed].filter((t) => !base.failed.has(t));
  assert(fe.calls.some((c) => c.changed) && newly(fe).length > 0, `with the execution Read's refusal turned into an allow, no test failed (${fe.calls.filter((c) => c.changed).length} answers changed)`);
  assert(fv.calls.some((c) => c.changed) && newly(fv).length > 0, `with the verification Write's allow turned into a refusal, no test failed (${fv.calls.filter((c) => c.changed).length} answers changed)`);
  return { base, w: w.length, rd: rd.length, fe: newly(fe), fv: newly(fv), shapes: [...w, ...rd].map((c) => (c.runs === 'no file' ? '--state names no file, as in a container, whose .timone/ starts empty' : 'an empty file')) };
}
await clause('R6 clause 1', 'the suite holds a test that starts the guard command as a container session does, and checks verification Write allowed and execution Read refused', {
  broken: () => c1('old'),
  correct: () => {
    const r = c1('new');
    console.log(`    files run: ${FILES.length ? FILES.join(', ') : 'every test file under src/'}; ${r.base.total} tests, ${r.base.failed.size} failing with nothing changed`);
    console.log(`    guard commands seen with a state file that holds no run (${[...new Set(r.shapes)].join(', ')}), a payload on stdin and a container's environment: ${r.w} for a verification Write (allow), ${r.rd} for an execution Read (deny)`);
    console.log(`    execution Read's refusal turned into an allow → newly failing: ${r.fe.join(' | ')}`);
    console.log(`    verification Write's allow turned into a refusal → newly failing: ${r.fv.join(' | ')}`);
  },
});

function c2(which) {
  const base = run(which, 'pass');
  const ig = run(which, 'ignore-step');
  const newly = [...ig.failed].filter((t) => !base.failed.has(t));
  assert(newly.length > 0, `with the guard command made to ignore ${VAR}, no test that passed before failed`);
  return newly;
}
await clause('R6 clause 2', "with the guard command made to ignore the container's step, the test fails", {
  broken: () => c2('old'),
  correct: () => console.log(`    newly failing with ${VAR} removed from the guard command's environment: ${c2('new').join(' | ')}`),
});

finish('PRD-10.R6');
