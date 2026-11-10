import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

test('hosted build requires identity, persists reviewed context and enforces owner role', async t => {
  const { default: worker } = await import('../dist/server/index.js');
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync('drizzle/0000_workspace.sql', 'utf8'));
  t.after(() => database.close());
  const env = { DB: { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async run() { const result = database.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; }, async first() { return database.prepare(sql).get(...args); } }; } } };
  const send = (path, input, extra = {}) => worker.fetch(new Request(`https://example.test${path}`, { method: input ? 'POST' : 'GET', headers: { 'oai-authenticated-user-id': 'owner', ...extra }, ...(input ? { body: JSON.stringify(input) } : {}) }), env);
  const anonymous = await worker.fetch(new Request('https://example.test/'), env); assert.equal(anonymous.status, 401);
  const page = await send('/'); const html = await page.text(); const csrf = html.match(/name="crossville-session" content="([a-f0-9-]+)"/)[1];
  assert(html.includes('Private hosted prototype'));
  const headers = { 'Content-Type': 'application/json', 'X-Crossville-Session': csrf, Origin: 'https://example.test' };
  const first = await (await send('/api/workspace')).json(); assert.equal(first.mode, 'hosted_fictional'); assert.equal(first.project.version, 2);
  assert.equal((await send('/api/proposals/prepare', { title: 'Short pilot', content: 'One week.', kind: 'decision' }, { ...headers, 'oai-authenticated-user-id': 'other' })).status, 403);
  assert.equal((await send('/api/handoffs', { task: 'Pilot schedule' }, { ...headers, Origin: 'https://other.test' })).status, 403);
  const draft = await (await send('/api/proposals/prepare', { title: 'One week', content: 'Use one week (7 days) for the pilot.', kind: 'decision', targetId: 'pilot-duration' }, headers)).json();
  const proposal = await (await send('/api/proposals/submit', { draftId: draft.id, confirmed: true }, headers)).json();
  const approved = await (await send('/api/proposals/review', { proposalId: proposal.id, outcome: 'approved' }, headers)).json(); assert.equal(approved.project.version, 3);
  const next = await (await send('/api/handoffs', { task: 'Pilot schedule', mode: 'auto', knownVersion: 2 }, headers)).json(); assert(next.text.includes('7 days')); assert.equal(next.changes.status, 'updated');
  const connection = await (await send('/api/connection')).json(); assert.equal(connection.hosted, true); assert(connection.message.includes('not synchronized'));
});
