// Assertions the agent's box has to pass before a run is trusted to it.
//
// Copied into the image at /opt/timone/image-check.mjs and run there.
// Exits 0 when every check passes and 1 when any of them fails. Every check
// runs whatever the others do, so one failure never hides another, and each
// prints its own line.
//
// Two things are checked that a `docker run ... --version` cannot show:
//   - each browser LAUNCHES AND LOADS A PAGE. A browser that launches and
//     dies on the first real page is the failure mode this exists to catch,
//     and it looks like an unrelated crash when it happens mid-run.
//   - /dev/shm is big enough, as a number against a floor. Docker's default
//     is 64 MiB, which kills Chromium on real pages.

import { createServer } from 'node:http';
import { existsSync, statfsSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';

// Docker's default /dev/shm is 64 MiB. Playwright's own guidance is 1 GiB,
// which is what the daemon passes; the floor is set below that so a smaller
// but still workable size does not fail the check, and well above the
// default so the default never passes.
const SHM_FLOOR_BYTES = 256 * 1024 * 1024;

const MARKER = 'the box is awake';

const failures = [];

function report(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

function mib(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MiB`;
}

function checkSharedMemory() {
  const stats = statfsSync('/dev/shm');
  const total = stats.bsize * stats.blocks;
  report(
    '/dev/shm size',
    total >= SHM_FLOOR_BYTES,
    `${mib(total)} against a floor of ${mib(SHM_FLOOR_BYTES)}`,
  );
}

function checkNoDocker() {
  const onPath = (process.env.PATH ?? '')
    .split(':')
    .filter(Boolean)
    .map((dir) => `${dir}/docker`)
    .find((candidate) => existsSync(candidate));
  report('no docker CLI', onPath === undefined, onPath ?? 'not on PATH');
  const socket = '/var/run/docker.sock';
  const socketExists = existsSync(socket);
  report('no docker socket', !socketExists, `${socket} ${socketExists ? 'present' : 'absent'}`);
}

async function startPageServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(
      `<!doctype html><html><head><title>${MARKER}</title></head>` +
        `<body><h1 id="marker">${MARKER}</h1></body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

async function checkBrowser(name, engine, url) {
  let browser;
  try {
    browser = await engine.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const heading = await page.textContent('#marker');
    if (heading !== MARKER) {
      throw new Error(`page loaded but read "${heading}"`);
    }
    report(`${name} loads a page`, true, `version ${browser.version()}`);
  } catch (error) {
    report(`${name} loads a page`, false, error.message);
  } finally {
    await browser?.close();
  }
}

const server = await startPageServer();
try {
  checkSharedMemory();
  checkNoDocker();
  for (const [name, engine] of [
    ['chromium', chromium],
    ['firefox', firefox],
    ['webkit', webkit],
  ]) {
    await checkBrowser(name, engine, server.url);
  }
} finally {
  server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
