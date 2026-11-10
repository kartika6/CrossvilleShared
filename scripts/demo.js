import { LocalStore } from '../src/store.js';
import { ContextService } from '../src/service.js';

const store = new LocalStore(':memory:');
const service = new ContextService(store);
const first = service.prepareHandoff({ task: 'Plan the pilot schedule', mode: 'auto' });
console.log(`1. Current handoff: v${first.projectVersion}; approved duration is two weeks.`);
const draft = service.prepareProposal({ title: 'Run a one-week pilot', content: 'The approved pilot lasts one week (7 days).', kind: 'decision', targetId: 'pilot-duration' });
const pending = service.submitProposal({ draftId: draft.id, confirmed: true });
console.log(`2. Submitted proposal: ${pending.status}; shared version is still v${service.workspace().project.version}.`);
service.reviewProposal({ proposalId: pending.id, outcome: 'approved', note: 'Approved for this fictional demonstration.' });
const next = service.prepareHandoff({ task: 'Plan the pilot schedule', mode: 'auto', knownVersion: first.projectVersion });
console.log(`3. After review: v${next.projectVersion}; ${next.changes.changed.length} selected decision changed.`);
console.log(`4. Same context service returns the new packet directly through MCP:\n\n${next.text}`);
store.close();
