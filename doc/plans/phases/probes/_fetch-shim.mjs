// Verifier instrument (stage 7 artifact): stands in for the network to GitHub.
// Loaded into the daemon with NODE_OPTIONS=--import by _rig.mjs. The built
// daemon mints its forge credential with a direct HTTPS call; this answers it
// locally with a throwaway token, and answers every other GitHub call with 404.
// No request to github.com leaves the machine while it is loaded.
import fs from 'node:fs';

const LOG = process.env.FAKE_NET_LOG;
const real = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  let host = '';
  try { host = new URL(url).hostname; } catch {}
  if (host.endsWith('github.com') || host.endsWith('githubusercontent.com')) {
    if (LOG) fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), method: init.method ?? 'GET', url }) + '\n');
    if (/\/app\/installations\/\d+\/access_tokens$/.test(new URL(url).pathname)) {
      return new Response(JSON.stringify({ token: 'ghs_probe_token', expires_at: new Date(Date.now() + 3600e3).toISOString() }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ message: 'probe: not faked' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  return real(input, init);
};
