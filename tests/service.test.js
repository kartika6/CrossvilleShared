import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStore } from '../src/store.js';
import { ContextService } from '../src/service.js';

function setup(t) { const store = new LocalStore(':memory:'); t.after(() => store.close()); return { store, service: new ContextService(store) }; }
const replacement = { title: 'Run a one-week pilot', content: 'The approved pilot lasts one week (7 days). Use seven days when creating the study schedule.', kind: 'decision', targetId: 'pilot-duration' };

test('retrieval excludes superseded records and includes required constraints', t => {
  const { service } = setup(t);
  const packet = service.prepareHandoff({ task: 'Plan the pilot schedule', mode: 'auto' });
  assert.equal(packet.status, 'ready'); assert.equal(packet.projectVersion, 2);
  assert(packet.items.some(item => item.id === 'pilot-duration'));
  assert(packet.items.some(item => item.id === 'data-boundary'));
  assert(!packet.items.some(item => item.id === 'old-duration'));
  assert(packet.text.includes('14 days')); assert.equal(packet.simulatedData, true);
});

test('preview edits affect only the packet and preserve approved wording', t => {
  const { service } = setup(t);
  const packet = service.prepareHandoff({ task: 'Plan the pilot schedule' });
  const ready = service.confirmHandoff({ packetId: packet.id, selectedIds: packet.items.map(item => item.id), edits: { 'pilot-duration': 'Explore a seven-day variant as a personal hypothesis.' } });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.items.find(item => item.id === 'pilot-duration').localEdit, true);
  assert(ready.text.includes('Approved source wording:'));
  assert(service.workspace().items.find(item => item.id === 'pilot-duration').text.includes('14 days'));
  assert.equal(service.workspace().project.version, 2);
  assert.throws(() => service.confirmHandoff({ packetId: ready.id, selectedIds: ready.items.map(item => item.id) }), { code: 'FINALIZED_PACKET' });
});

test('required items cannot be excluded or rewritten', t => {
  const { service } = setup(t); const packet = service.prepareHandoff({ task: 'Plan the pilot' });
  assert.throws(() => service.confirmHandoff({ packetId: packet.id, selectedIds: ['pilot-duration'] }), /required constraints/);
  assert.throws(() => service.confirmHandoff({ packetId: packet.id, selectedIds: packet.items.map(item => item.id), edits: { 'data-boundary': 'Collect real names.' } }), /cannot be changed/);
});

test('draft submission requires confirmation and is idempotent', t => {
  const { service } = setup(t); const draft = service.prepareProposal(replacement);
  assert.equal(service.workspace().proposals.length, 0);
  assert.throws(() => service.submitProposal({ draftId: draft.id }), { code: 'CONFIRMATION_REQUIRED' });
  const pending = service.submitProposal({ draftId: draft.id, confirmed: true });
  assert.equal(pending.status, 'pending'); assert.equal(service.workspace().project.version, 2);
  assert.equal(service.submitProposal({ draftId: draft.id, confirmed: true }).id, pending.id);
  assert.equal(service.workspace().proposals.length, 1);
});

test('approval changes effective context and rejects stale preview confirmation', t => {
  const { service } = setup(t); const old = service.prepareHandoff({ task: 'Plan the pilot schedule' });
  const draft = service.prepareProposal(replacement); const pending = service.submitProposal({ draftId: draft.id, confirmed: true });
  service.reviewProposal({ proposalId: pending.id, outcome: 'approved' });
  assert.equal(service.workspace().project.version, 3);
  assert.throws(() => service.confirmHandoff({ packetId: old.id, selectedIds: old.items.map(item => item.id) }), { code: 'STALE_CONTEXT' });
  const next = service.prepareHandoff({ task: 'Plan the pilot schedule', mode: 'auto', knownVersion: 2 });
  assert(next.text.includes('7 days')); assert.equal(next.changes.changed.length, 1);
  assert.equal(next.changes.changed[0].id, 'pilot-duration');
  assert(old.text.includes('14 days'));
});

test('rejection leaves context unchanged and viewer/editor permissions are enforced', t => {
  const { service, store } = setup(t); const draft = service.prepareProposal(replacement);
  const pending = service.submitProposal({ draftId: draft.id, confirmed: true });
  const viewer = new ContextService(store, { id: 'viewer', role: 'viewer', name: 'Viewer' });
  const editor = new ContextService(store, { id: 'editor', role: 'editor', name: 'Editor' });
  assert.throws(() => viewer.prepareProposal(replacement), { code: 'FORBIDDEN' });
  assert.throws(() => editor.reviewProposal({ proposalId: pending.id, outcome: 'approved' }), { code: 'FORBIDDEN' });
  service.reviewProposal({ proposalId: pending.id, outcome: 'rejected', note: 'Keep the original duration.' });
  assert.equal(service.workspace().project.version, 2);
  assert.equal(service.workspace().proposals[0].reviewNote, 'Keep the original duration.');
});

test('stale proposals cannot overwrite a newer approved version', t => {
  const { service } = setup(t);
  const first = service.prepareProposal(replacement);
  const second = service.prepareProposal({ ...replacement, content: 'Use a three-day exploratory pilot.' });
  const p1 = service.submitProposal({ draftId: first.id, confirmed: true });
  const p2 = service.submitProposal({ draftId: second.id, confirmed: true });
  service.reviewProposal({ proposalId: p1.id, outcome: 'approved' });
  assert.throws(() => service.reviewProposal({ proposalId: p2.id, outcome: 'approved' }), { code: 'STALE_CONTEXT' });
  assert.equal(service.workspace().proposals.find(p => p.id === p2.id).status, 'pending');
});

test('private drafts and packets are scoped to the configured local actor', t => {
  const { service, store } = setup(t); const draft = service.prepareProposal(replacement);
  const packet = service.prepareHandoff({ task: 'Plan the pilot' });
  const other = new ContextService(store, { id: 'other', name: 'Other', role: 'editor' });
  assert.equal(other.workspace().drafts.length, 0); assert.equal(other.workspace().handoffs.length, 0);
  assert.throws(() => other.submitProposal({ draftId: draft.id, confirmed: true }), { code: 'NOT_FOUND' });
  assert.throws(() => other.confirmHandoff({ packetId: packet.id, selectedIds: packet.items.map(item => item.id) }), { code: 'NOT_FOUND' });
});

test('cancelled previews cannot be confirmed; invalid project and version fail clearly', t => {
  const { service } = setup(t); const packet = service.prepareHandoff({ task: 'Plan the pilot' });
  service.cancelHandoff({ packetId: packet.id });
  assert.throws(() => service.confirmHandoff({ packetId: packet.id, selectedIds: packet.items.map(item => item.id) }), /cancelled/);
  assert.throws(() => service.prepareHandoff({ task: 'Schedule', projectId: 'unavailable-project' }), { code: 'NOT_FOUND' });
  assert.throws(() => service.prepareHandoff({ task: 'Schedule', knownVersion: 99 }), /Known version/);
});

test('SQLite snapshots are shared between processes/connections and survive reopening', t => {
  const dir = mkdtempSync(join(tmpdir(), 'crossville-store-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'workspace.sqlite'); const first = new LocalStore(path); const second = new LocalStore(path);
  const a = new ContextService(first); const b = new ContextService(second);
  const draft = a.prepareProposal(replacement); const pending = a.submitProposal({ draftId: draft.id, confirmed: true });
  b.reviewProposal({ proposalId: pending.id, outcome: 'approved' });
  assert.equal(a.workspace().project.version, 3); first.close(); second.close();
  const reopened = new LocalStore(path); assert.equal(new ContextService(reopened).workspace().project.version, 3); reopened.close();
});
