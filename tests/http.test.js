import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/store.js';
import { createWebServer } from '../src/web-server.js';

test('browser API exercises preview/approval and rejects cross-origin or unbound writes', async t => {
  const store = new LocalStore(':memory:'); const { server } = createWebServer({ store, port: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(origin)).text(); const token = html.match(/name="crossville-session" content="([a-f0-9]+)"/)[1];
  const post = async (path, data, headers = {}) => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crossville-Session': token, Origin: origin, ...headers }, body: JSON.stringify(data) });
  assert.equal((await post('/api/handoffs', { task: 'Pilot schedule', mode: 'preview' }, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await post('/api/handoffs', { task: 'Pilot schedule' }, { 'X-Crossville-Session': 'wrong' })).status, 403);
  const preview = await (await post('/api/handoffs', { task: 'Pilot schedule', mode: 'preview' })).json(); assert.equal(preview.status, 'awaiting_review');
  const confirmed = await post('/api/handoffs/confirm', { packetId: preview.id, selectedIds: preview.items.map(item => item.id) }); assert.equal(confirmed.status, 200);
  const draft = await (await post('/api/proposals/prepare', { title: 'One-week pilot', content: 'Use seven days for the pilot.', kind: 'decision', targetId: 'pilot-duration' })).json();
  const proposal = await (await post('/api/proposals/submit', { draftId: draft.id, confirmed: true })).json();
  const approved = await (await post('/api/proposals/review', { proposalId: proposal.id, outcome: 'approved' })).json(); assert.equal(approved.project.version, 3);
  const next = await (await post('/api/tools/call', { name: 'get_team_context', arguments: { task: 'Pilot schedule', mode: 'auto', known_version: 2 } })).json();
  assert.equal(next.changes.status, 'updated'); assert(next.text.includes('seven days'));
});
