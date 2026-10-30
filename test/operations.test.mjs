import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createApp, safeHeaders } from '../src/server.mjs';

async function running(t, options = {}) {
  const server = createApp({ configured: true, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('the health route answers without sign-in and says nothing about configuration', async t => {
  const origin = await running(t);
  const res = await fetch(origin + '/api/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ['build', 'status']);
  assert.equal(body.status, 'ok');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  // Everything else under /api still needs a session.
  assert.equal((await fetch(origin + '/api/status')).status, 401);
});

test('every response carries the security headers, and the Vercel config sends the same ones for static files', async t => {
  const origin = await running(t);
  const res = await fetch(origin + '/api/auth');
  for (const [name, value] of Object.entries(safeHeaders)) assert.equal(res.headers.get(name), value, name);
  assert.match(res.headers.get('permissions-policy'), /microphone=\(self\)/);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const site = Object.fromEntries(vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value]));
  for (const [name, value] of Object.entries(safeHeaders)) assert.equal(site[name], value, `vercel.json ${name}`);
});

test('the request log is one JSON line per API request without the query string or body', async t => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  t.after(() => { console.log = original; });
  const origin = await running(t, { requestLog: true });
  await fetch(origin + '/api/health?token=secret-value');
  await fetch(origin + '/');
  await new Promise(resolve => setTimeout(resolve, 20));
  const entries = lines.map(l => JSON.parse(l));
  assert.equal(entries.length, 1, 'only API requests are logged');
  assert.deepEqual(Object.keys(entries[0]).sort(), ['at', 'id', 'method', 'ms', 'path', 'status']);
  assert.equal(entries[0].path, '/api/health');
  assert.equal(entries[0].status, 200);
  assert.ok(!lines.join('\n').includes('secret-value'));
});

test('the request log is off by default outside Vercel', async t => {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  t.after(() => { console.log = original; });
  const origin = await running(t);
  await fetch(origin + '/api/health');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(lines.length, 0);
});
