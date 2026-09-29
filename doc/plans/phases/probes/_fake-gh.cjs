#!/usr/bin/env node
// Verifier instrument (stage 7 artifact): a fake GitHub behind the `gh` command.
// Written 2026-09-28 for phase 40 from the commands the built daemon was seen to
// run, never from its source. The rig (_rig.mjs) puts this file first on PATH.
//
// Issues and pull requests live in $FAKE_FORGE (JSON), per repository slug.
// Branches, files and "commits ahead" are read from the bare git remote named
// for the slug in forge.remotes, so the forge agrees with what was pushed.
// Every call is logged to $FAKE_GH_LOG. A call this file does not know fails
// loudly, so the log shows what the app asked for. `gh pr merge` always fails.
const fs = require('fs');
const { execFileSync } = require('child_process');
const LOG = process.env.FAKE_GH_LOG;
const FORGE = process.env.FAKE_FORGE;
const BOT = process.env.FAKE_BOT_LOGIN || 'probe-bot';
const argv = process.argv.slice(2);
// Standard input is read only when the command asks for it ("-" as a file): a shell run by a
// step session keeps it open, and reading it unasked would wait for ever.
let stdin = '';
const wantsStdin = argv.some((a, i) => a === '-' && ['--body-file', '-F', '--input'].includes(argv[i - 1]));
try { if (wantsStdin) stdin = fs.readFileSync(0, 'utf8'); } catch {}

// One writer at a time: the rig takes the same lock to add comments.
const LOCK = `${FORGE}.lock`;
const deadline = Date.now() + 10000;
for (;;) {
  try { fs.mkdirSync(LOCK); break; } catch {
    if (Date.now() > deadline) { try { fs.rmdirSync(LOCK); } catch {} }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
}
process.on('exit', () => { try { fs.rmdirSync(LOCK); } catch {} });

function load() { return JSON.parse(fs.readFileSync(FORGE, 'utf8')); }
function save(f) { fs.writeFileSync(FORGE, JSON.stringify(f, null, 2)); }
function logLine(extra) {
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), argv, stdin: stdin.slice(0, 6000), ...extra }) + '\n');
}
function out(obj) { process.stdout.write(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function fail(msg) { logLine({ result: 'FAIL: ' + msg }); process.stderr.write('fake gh: ' + msg + '\n'); process.exit(1); }
function opt(...names) {
  for (const name of names) { const i = argv.indexOf(name); if (i >= 0) return argv[i + 1]; }
  return undefined;
}
function opts(name) { const r = []; argv.forEach((a, i) => { if (a === name) r.push(argv[i + 1]); }); return r; }
function fields() { return opts('-f').concat(opts('-F')).concat(opts('--raw-field')).concat(opts('--field')); }
function field(k) { const x = fields().find((v) => v.startsWith(k + '=')); return x === undefined ? undefined : x.slice(k.length + 1); }
function now() { return new Date().toISOString(); }
function bodyArg() {
  const bf = opt('--body-file', '-F');
  if (bf === '-') return stdin;
  if (bf) return fs.readFileSync(bf, 'utf8');
  return opt('--body', '-b') ?? '';
}
function pick(obj, fl) {
  if (!fl) return obj;
  const r = {};
  for (const k of fl.split(',')) r[k] = obj[k] === undefined ? null : obj[k];
  return r;
}
const f = load();
const slug = opt('--repo', '-R') || f.slug;
f.others ??= {};
const repo = slug === f.slug ? f : (f.others[slug] ??= { issues: {}, prs: {} });
repo.prs ??= {};
const remote = (f.remotes ?? {})[slug];
function git(...args) { return execFileSync('git', ['--git-dir', remote, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
function tryGit(...args) { if (!remote) return undefined; try { return git(...args); } catch { return undefined; } }
const ZERO = '0000000000000000000000000000000000000000';

function commentView(c, base) {
  return { id: c.id, author: { login: c.author }, body: c.body, createdAt: c.createdAt, url: `${base}#issuecomment-${c.id}` };
}
function restComment(c, base) {
  return { id: c.id, user: { login: c.author }, body: c.body, created_at: c.createdAt, updated_at: c.createdAt, html_url: `${base}#issuecomment-${c.id}` };
}
function issueView(i) {
  const base = `https://github.com/${slug}/issues/${i.number}`;
  return {
    number: i.number, title: i.title, body: i.body, state: i.state,
    labels: i.labels.map((name) => ({ name })),
    author: { login: i.author }, createdAt: i.createdAt, updatedAt: i.updatedAt ?? i.createdAt,
    url: base, comments: i.comments.map((c) => commentView(c, base)),
    closedAt: i.closedAt ?? null, stateReason: i.stateReason ?? null,
    assignees: (i.assignees ?? []).map((login) => ({ login })),
    blockedBy: { totalCount: (i.blockedBy ?? []).length, nodes: (i.blockedBy ?? []).map((x) => ({ number: x })) },
    parent: i.parent ? { number: i.parent } : null,
  };
}
function prView(p) {
  const base = `https://github.com/${slug}/pull/${p.number}`;
  return {
    number: p.number, title: p.title, body: p.body, state: p.state, headRefName: p.head, baseRefName: p.base ?? 'main',
    url: base, mergedAt: p.mergedAt ?? null, closedAt: p.closedAt ?? null,
    headRefOid: p.headRefOid ?? ((tryGit('rev-parse', `refs/heads/${p.head}`) ?? '').trim() || ZERO),
    author: { login: p.author ?? BOT }, createdAt: p.createdAt, isDraft: false,
    comments: (p.comments ?? []).map((c) => commentView(c, base)),
    reviews: p.reviews ?? [], labels: [],
  };
}
const n = (x) => Number(String(x).replace(/^#/, '').replace(/.*\//, ''));
const [a0, a1] = argv;

if (a0 === 'issue' && a1 === 'list') {
  const label = opts('--label');
  const state = (opt('--state', '-s') || 'open').toUpperCase();
  const list = Object.values(repo.issues).filter((i) => (state === 'ALL' || i.state === state) && label.every((l) => i.labels.includes(l)));
  logLine({ result: `listed ${list.length}` });
  out(list.map((i) => pick(issueView(i), opt('--json'))));
} else if (a0 === 'issue' && a1 === 'view') {
  const i = repo.issues[n(argv[2])];
  if (!i) fail(`no issue ${argv[2]} in ${slug}`);
  logLine({ result: 'viewed' });
  out(pick(issueView(i), opt('--json')));
} else if (a0 === 'issue' && a1 === 'comment') {
  const i = repo.issues[n(argv[2])];
  if (!i) fail(`no issue ${argv[2]} in ${slug}`);
  const id = f.nextComment++;
  i.comments.push({ id, author: BOT, body: bodyArg(), createdAt: now() });
  save(f); logLine({ result: `commented ${id}` });
  out(`https://github.com/${slug}/issues/${i.number}#issuecomment-${id}\n`);
} else if (a0 === 'issue' && a1 === 'edit') {
  const i = repo.issues[n(argv[2])];
  if (!i) fail(`no issue ${argv[2]} in ${slug}`);
  for (const l of opts('--add-label')) for (const x of l.split(',')) if (!i.labels.includes(x)) i.labels.push(x);
  for (const l of opts('--remove-label')) for (const x of l.split(',')) i.labels = i.labels.filter((y) => y !== x);
  if (opt('--body') !== undefined || opt('--body-file') !== undefined) i.body = bodyArg();
  if (opt('--title')) i.title = opt('--title');
  save(f); logLine({ result: 'edited' });
} else if (a0 === 'issue' && (a1 === 'close' || a1 === 'reopen')) {
  const i = repo.issues[n(argv[2])];
  if (!i) fail(`no issue ${argv[2]} in ${slug}`);
  i.state = a1 === 'close' ? 'CLOSED' : 'OPEN';
  if (a1 === 'close') { i.closedAt = now(); i.stateReason = opt('--reason') ?? 'completed'; }
  const c = opt('--comment', '-c');
  if (c) i.comments.push({ id: f.nextComment++, author: BOT, body: c, createdAt: now() });
  save(f); logLine({ result: a1 });
} else if (a0 === 'issue' && a1 === 'create') {
  const num = f.nextNumber++;
  repo.issues[num] = { number: num, title: opt('--title', '-t'), body: bodyArg(), labels: opts('--label').concat(opts('-l')).flatMap((l) => l.split(',')), state: 'OPEN', author: BOT, createdAt: now(), comments: [] };
  save(f); logLine({ result: `created ${slug} #${num}` });
  out(`https://github.com/${slug}/issues/${num}\n`);
} else if (a0 === 'label' && (a1 === 'create' || a1 === 'list')) {
  repo.labels ??= [];
  if (a1 === 'create') {
    const name = argv[2];
    if (!repo.labels.includes(name)) repo.labels.push(name);
    save(f); logLine({ result: `label ${name}` });
  } else { logLine({ result: 'labels listed' }); out(repo.labels.map((name) => ({ name }))); }
} else if (a0 === 'pr' && a1 === 'list') {
  const head = opt('--head', '-H');
  const state = (opt('--state', '-s') || 'open').toUpperCase();
  const list = Object.values(repo.prs).filter((p) => (!head || p.head === head) && (state === 'ALL' || p.state === state));
  logLine({ result: `listed ${list.length}` });
  out(list.map((p) => pick(prView(p), opt('--json'))));
} else if (a0 === 'pr' && a1 === 'view') {
  const key = argv[2];
  const p = /^\d+$/.test(String(key)) ? repo.prs[n(key)] : Object.values(repo.prs).find((x) => x.head === key);
  if (!p) fail(`no pull request ${key}`);
  logLine({ result: 'viewed' });
  out(pick(prView(p), opt('--json')));
} else if (a0 === 'pr' && a1 === 'edit') {
  const p = repo.prs[n(argv[2])];
  if (!p) fail(`no pull request ${argv[2]}`);
  if (opt('--body') !== undefined || opt('--body-file') !== undefined) p.body = bodyArg();
  save(f); logLine({ result: 'edited' });
} else if (a0 === 'pr' && a1 === 'comment') {
  const p = repo.prs[n(argv[2])];
  if (!p) fail(`no pull request ${argv[2]}`);
  const id = f.nextComment++;
  (p.comments ??= []).push({ id, author: BOT, body: bodyArg(), createdAt: now() });
  save(f); logLine({ result: `commented ${id}` });
  out(`https://github.com/${slug}/pull/${p.number}#issuecomment-${id}\n`);
} else if (a0 === 'pr' && a1 === 'create') {
  const num = f.nextNumber++;
  repo.prs[num] = { number: num, title: opt('--title', '-t'), body: bodyArg(), head: opt('--head', '-H'), base: opt('--base', '-B') || 'main', state: 'OPEN', createdAt: now(), comments: [] };
  save(f); logLine({ result: `created pr #${num}` });
  out(`https://github.com/${slug}/pull/${num}\n`);
} else if (a0 === 'pr' && a1 === 'merge') {
  fail('merge is refused by this fixture: nothing here may merge');
} else if (a0 === 'api') {
  const skip = new Set(['-X', '--method', '-f', '-F', '--raw-field', '--field', '--jq', '-q', '--input', '-H', '--header']);
  const path = argv.find((x, i) => i > 0 && !x.startsWith('-') && !skip.has(argv[i - 1]));
  const method = (opt('-X', '--method') || (fields().length && path !== 'graphql' ? 'POST' : 'GET')).toUpperCase();
  let m;
  if (path === 'graphql') {
    const q = field('query') ?? '';
    if (q.includes('defaultBranchRef')) {
      const oid = (tryGit('rev-parse', 'main') ?? '').trim();
      logLine({ result: `graphql defaultBranchRef ${oid}` });
      out({ data: { repository: { defaultBranchRef: { name: 'main', target: { oid } } } } });
    } else if (q.includes('object(expression')) {
      const expr = field('expression');
      const type = tryGit('cat-file', '-t', expr)?.trim();
      let object = null;
      if (type === 'tree' && q.includes('on Tree')) {
        object = { entries: git('ls-tree', expr).trim().split('\n').filter(Boolean).map((l) => { const [meta, name] = l.split('\t'); return { name, type: meta.split(' ')[1] }; }) };
      } else if (type === 'blob' && q.includes('on Blob')) {
        object = { text: git('cat-file', 'blob', expr) };
      }
      logLine({ result: `graphql object ${expr} -> ${type ?? 'missing'}` });
      out({ data: { repository: { object } } });
    } else {
      const hit = (f.graphql ?? []).find((g) => q.includes(g.match));
      if (!hit) fail(`graphql not faked: ${q.slice(0, 400)}`);
      logLine({ result: `graphql canned (${hit.match})` });
      out(hit.response);
    }
  } else if ((m = /^repos\/([^/]+\/[^/]+)\/compare\/([^.]+)\.\.\.(.+)$/.exec(path))) {
    let ahead = (f.ahead ?? {})[m[3]];
    if (ahead === undefined) {
      const exists = tryGit('rev-parse', '--verify', '--quiet', `refs/heads/${m[3]}`);
      if (!exists) fail(`gh: Not Found (HTTP 404) compare ${m[2]}...${m[3]}`);
      ahead = Number(git('rev-list', '--count', `${m[2]}..${m[3]}`).trim());
    }
    logLine({ result: `ahead ${ahead}` });
    const jq = opt('--jq', '-q');
    out(jq === '.ahead_by' ? `${ahead}\n` : { ahead_by: ahead, status: ahead > 0 ? 'ahead' : 'identical' });
  } else if (/^repos\/[^/]+\/[^/]+\/merges$/.test(path) && method === 'POST') {
    // GitHub's merge API, done for real in the bare remote, and logged so a
    // probe can see exactly when anything reached the default branch.
    const base = field('base'), head = field('head'), msg = field('commit_message') ?? `Merge ${head} into ${base}`;
    const b = tryGit('rev-parse', `refs/heads/${base}`)?.trim(), h = tryGit('rev-parse', `refs/heads/${head}`)?.trim();
    if (!b || !h) fail(`gh: Not Found (HTTP 404) merge ${head} into ${base}`);
    let sha;
    if (tryGit('merge-base', '--is-ancestor', h, b) !== undefined) { logLine({ result: 'merge: nothing to merge' }); process.exit(0); }
    // A conflict is answered as GitHub answers it: HTTP 409, "Merge conflict", and nothing merged.
    // (Added 2026-09-29, re-check after 40y: before, a conflict crashed this file with a stack trace.)
    const mt = tryGit('merge-tree', '--write-tree', b, h);
    if (mt === undefined) {
      logLine({ result: `merge: CONFLICT ${head} into ${base} (409)` });
      out({ message: 'Merge conflict', documentation_url: 'https://docs.github.com/rest/branches/branches#merge-a-branch', status: '409' });
      process.stderr.write('gh: Merge conflict (HTTP 409)\n');
      process.exit(1);
    }
    const tree = mt.trim().split('\n')[0];
    sha = execFileSync('git', ['--git-dir', remote, '-c', 'user.email=forge@example.invalid', '-c', 'user.name=forge', 'commit-tree', tree, '-p', b, '-p', h, '-m', msg], { encoding: 'utf8' }).trim();
    git('update-ref', `refs/heads/${base}`, sha, b);
    logLine({ result: `MERGED ${head} into ${base} as ${sha}` });
    out({ sha, commit: { message: msg } });
  } else if ((m = /^repos\/[^/]+\/[^/]+\/(pulls|issues)\/(\d+)\/(comments|reviews)$/.exec(path)) && method === 'GET') {
    const num = Number(m[2]);
    const holder = repo.prs[num] ?? repo.issues[num];
    if (!holder) fail(`no ${m[1]} ${num}`);
    const base = `https://github.com/${slug}/${m[1] === 'pulls' ? 'pull' : 'issues'}/${num}`;
    let list;
    if (m[3] === 'reviews') list = holder.reviews ?? [];
    else if (m[1] === 'pulls') list = (holder.reviewComments ?? []).map((c) => restComment(c, base));
    else list = (holder.comments ?? []).map((c) => restComment(c, base));
    logLine({ result: `listed ${list.length} ${m[3]}` });
    out(list);
  } else if ((m = /^repos\/[^/]+\/[^/]+\/issues\/comments\/(\d+)$/.exec(path))) {
    const id = Number(m[1]);
    let found, holder;
    for (const i of Object.values(repo.issues)) for (const c of i.comments) if (c.id === id) { found = c; holder = i.comments; }
    for (const p of Object.values(repo.prs)) for (const c of p.comments ?? []) if (c.id === id) { found = c; holder = p.comments; }
    if (!found) fail(`no comment ${id}`);
    if (method === 'PATCH') {
      const fb = field('body');
      if (fb !== undefined) found.body = fb;
      else if (opt('--input') === '-') found.body = JSON.parse(stdin).body;
      save(f); logLine({ result: `patched ${id}` });
    } else if (method === 'DELETE') {
      holder.splice(holder.indexOf(found), 1);
      save(f); logLine({ result: `deleted ${id}` });
    } else logLine({ result: 'got comment' });
    out({ id, body: found.body, user: { login: found.author }, created_at: found.createdAt });
  } else {
    const handler = (f.api ?? {})[path];
    if (handler === undefined) fail(`api path not faked: ${method} ${path}`);
    logLine({ result: 'api canned' });
    out(handler);
  }
} else {
  fail(`command not faked: ${argv.join(' ')}`);
}
