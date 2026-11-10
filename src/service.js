import { AppError, changesSince, currentItems, digest, ensureVersion, formatHandoff, id, kinds, required, retrieve, text } from './domain.js';

const localActor = { id: 'local-researcher', name: 'You', role: 'owner' };

export class ContextService {
  constructor(store, actor = localActor, { hosted = false } = {}) { this.store = store; this.actor = actor; this.hosted = hosted; }
  requireWrite() { if (!['owner', 'reviewer', 'editor'].includes(this.actor.role)) throw new AppError('This connection can read context but cannot create proposals.', 'FORBIDDEN', 403); }
  project(state, projectId) { if (projectId && projectId !== state.project.id) throw new AppError('Project is not available to this connection.', 'NOT_FOUND', 404); }
  event(state, type, summary, details = {}) {
    state.events.unshift({ id: id(), type, summary, at: new Date().toISOString(), version: state.project.version, actorId: this.actor.id, ...details });
  }
  owned(list, entityId) {
    const entity = list.find(entry => entry.id === entityId && entry.actorId === this.actor.id);
    if (!entity) throw new AppError('This draft is not available to this connection.', 'NOT_FOUND', 404);
    return entity;
  }

  workspace() {
    const state = this.store.read();
    return {
      mode: this.hosted ? 'hosted_team' : 'local_fictional', liveConnected: this.hosted, project: state.project, actor: this.actor,
      items: currentItems(state), proposals: state.proposals,
      handoffs: state.handoffs.filter(packet => packet.actorId === this.actor.id).slice(-20).reverse(),
      drafts: state.drafts.filter(draft => draft.actorId === this.actor.id && !draft.submittedId),
      events: state.events.filter(event => !event.private || event.actorId === this.actor.id).slice(0, 50),
      capabilities: { model: 'Provided by your connected Codex chat', retrieval: 'Deterministic task keywords + required context', sharedBackend: this.hosted ? 'Shared hosted project' : 'Local fictional workspace', approval: this.hosted ? 'Project owner or reviewer; server-checked membership' : 'Local reviewer controls; no production identity verification' }
    };
  }

  prepareHandoff({ task, mode = 'preview', knownVersion, projectId } = {}) {
    task = text(task, 'Task', 2000);
    if (!['auto', 'preview'].includes(mode)) throw new AppError('Choose automatic or preview mode.');
    return this.store.transaction(state => {
      this.project(state, projectId);
      const items = retrieve(state, task);
      const packet = { id: id(), actorId: this.actor.id, projectId: state.project.id, projectName: state.project.name, projectVersion: state.project.version, mode, status: mode === 'auto' ? 'ready' : 'awaiting_review', task, createdAt: new Date().toISOString(), items, personalNote: '', changes: changesSince(state, knownVersion, items), selectionMethod: 'task_keywords_and_required_context', excludedCount: state.items.length - items.length, scope: 'selected_project_items', simulatedData: state.project.demo !== false };
      packet.digest = digest({ version: packet.projectVersion, items: packet.items, task, personalNote: '' });
      packet.text = formatHandoff(packet);
      state.handoffs.push(packet);
      this.event(state, 'handoff_prepared', mode === 'auto' ? 'Context packet prepared for automatic use.' : 'Context packet is awaiting your review.', { packetId: packet.id, private: true });
      return packet;
    });
  }

  confirmHandoff({ packetId, selectedIds, edits = {}, personalNote = '' } = {}) {
    personalNote = typeof personalNote === 'string' ? personalNote.trim() : '';
    if (personalNote.length > 2000) throw new AppError('Personal note must be no longer than 2,000 characters.');
    return this.store.transaction(state => {
      const packet = this.owned(state.handoffs, packetId);
      ensureVersion(state, packet.projectVersion);
      if (packet.status === 'cancelled') throw new AppError('This preview was cancelled. Prepare a new handoff.');
      if (packet.status === 'ready') throw new AppError('This packet is already finalized. Prepare a new handoff to edit it.', 'FINALIZED_PACKET', 409);
      if (!Array.isArray(selectedIds) || new Set(selectedIds).size !== selectedIds.length) throw new AppError('Select a valid, unique set of context items.');
      const available = new Map(packet.items.map(item => [item.id, item]));
      if (selectedIds.some(itemId => !available.has(itemId))) throw new AppError('The preview contains an unknown context item.');
      if (packet.items.some(item => required(item) && !selectedIds.includes(item.id))) throw new AppError('Keep the project brief and required constraints in the handoff.');
      if (!edits || typeof edits !== 'object' || Array.isArray(edits) || Object.keys(edits).some(itemId => !selectedIds.includes(itemId))) throw new AppError('Edits must belong to selected context items.');
      const items = selectedIds.map(itemId => {
        const item = structuredClone(available.get(itemId));
        if (Object.hasOwn(edits, itemId) && edits[itemId] !== item.text) {
          if (required(item)) throw new AppError('Required team context cannot be changed in a personal handoff. Submit a proposal instead.');
          item.originalText = item.text; item.text = text(edits[itemId], 'Edited context', 4000); item.localEdit = true;
        }
        return item;
      });
      packet.items = items; packet.personalNote = personalNote; packet.status = 'ready'; packet.confirmedAt = new Date().toISOString();
      packet.digest = digest({ version: packet.projectVersion, items, task: packet.task, personalNote });
      packet.text = formatHandoff(packet);
      this.event(state, 'handoff_confirmed', 'Reviewed context packet is ready for the conversation.', { packetId, private: true });
      return packet;
    });
  }

  cancelHandoff({ packetId } = {}) {
    return this.store.transaction(state => {
      const packet = this.owned(state.handoffs, packetId);
      if (packet.status !== 'awaiting_review') throw new AppError('Only an open preview can be cancelled.');
      packet.status = 'cancelled';
      return { id: packet.id, status: packet.status };
    });
  }

  prepareProposal({ title, content, kind = 'decision', targetId = null, sourceNote = 'Prepared from a user-selected contribution.' } = {}) {
    this.requireWrite(); title = text(title, 'Title', 160); content = text(content, 'Contribution', 4000); sourceNote = text(sourceNote, 'Source note', 1000);
    if (!kinds.includes(kind)) throw new AppError('Choose a supported context category.');
    return this.store.transaction(state => {
      const target = targetId ? currentItems(state).find(item => item.id === targetId) : null;
      if (targetId && !target) throw new AppError('The context item to replace is no longer current.', 'STALE_CONTEXT', 409);
      if (target && target.kind !== kind) throw new AppError('A replacement must keep the existing item category.');
      const draft = { id: id(), actorId: this.actor.id, author: this.actor.name, title, content, kind, targetId, sourceNote, projectId: state.project.id, baseVersion: state.project.version, createdAt: new Date().toISOString(), status: 'private_draft', before: target ? { id: target.id, title: target.title, text: target.text, revision: target.revision } : null, comparison: target ? { relation: target.text === content ? 'unchanged' : 'proposed_replacement', explanation: target.text === content ? 'This matches the approved wording.' : 'This explicitly targets an approved item. A reviewer must decide whether it should replace it.' } : { relation: 'new_item', explanation: 'No replacement target was selected. This is a new proposal; semantic conflict analysis is not connected.' } };
      state.drafts.push(draft);
      return draft;
    });
  }

  submitProposal({ draftId, confirmed = false } = {}) {
    this.requireWrite();
    if (confirmed !== true) throw new AppError('Confirm the exact contribution before submitting it to review.', 'CONFIRMATION_REQUIRED');
    return this.store.transaction(state => {
      const draft = this.owned(state.drafts, draftId);
      if (draft.submittedId) return state.proposals.find(proposal => proposal.id === draft.submittedId);
      ensureVersion(state, draft.baseVersion);
      if (draft.comparison.relation === 'unchanged') throw new AppError('The contribution is unchanged. Edit it before proposing a replacement.');
      const proposal = { ...structuredClone(draft), id: id(), draftId, status: 'pending', submittedAt: new Date().toISOString() };
      state.proposals.push(proposal); draft.submittedId = proposal.id;
      this.event(state, 'proposal_submitted', `A proposal is awaiting review: ${proposal.title}`, { proposalId: proposal.id });
      return proposal;
    });
  }

  reviewProposal({ proposalId, outcome, note = '' } = {}) {
    if (!['owner', 'reviewer'].includes(this.actor.role)) throw new AppError('Only a project owner or reviewer can review proposals.', 'FORBIDDEN', 403);
    if (!['approved', 'rejected'].includes(outcome)) throw new AppError('Choose approve or reject.');
    if (typeof note !== 'string' || note.length > 2000) throw new AppError('Review note must be no longer than 2,000 characters.');
    return this.store.transaction(state => {
      const proposal = state.proposals.find(entry => entry.id === proposalId);
      if (!proposal) throw new AppError('Proposal was not found.', 'NOT_FOUND', 404);
      if (proposal.status !== 'pending') throw new AppError('This proposal has already been reviewed.', 'ALREADY_REVIEWED', 409);
      if (outcome === 'approved') {
        ensureVersion(state, proposal.baseVersion);
        const target = proposal.targetId ? currentItems(state).find(item => item.id === proposal.targetId) : null;
        if (proposal.targetId && (!target || target.revision !== proposal.before.revision || target.text !== proposal.before.text)) throw new AppError('The replacement target changed. Prepare a new proposal.', 'STALE_CONTEXT', 409);
        const source = { author: proposal.author || proposal.actorId, reviewer: this.actor.name, label: `Reviewed proposal ${proposal.id.slice(0, 8)}`, type: 'reviewed_proposal', proposalId: proposal.id, note: proposal.sourceNote };
        if (target) {
          state.items.push({ ...structuredClone(target), id: `${target.id}-history-${id()}`, status: 'superseded' });
          target.title = proposal.title; target.text = proposal.content; target.revision++;
          target.source = source;
        } else state.items.push({ id: id(), title: proposal.title, text: proposal.content, kind: proposal.kind, claimKey: `proposal.${id()}`, strength: 'default', status: 'approved', revision: 1, tags: proposal.content.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)?.slice(0, 30) || [], source });
        state.project.version++;
        state.snapshots.push({ version: state.project.version, items: structuredClone(currentItems(state)) });
      }
      proposal.status = outcome; proposal.reviewNote = note.trim(); proposal.reviewedAt = new Date().toISOString(); proposal.reviewedBy = this.actor.id;
      this.event(state, `proposal_${outcome}`, `${outcome === 'approved' ? 'Approved' : 'Rejected'}: ${proposal.title}`, { proposalId, supersedes: proposal.targetId });
      return { proposal, project: state.project };
    });
  }
}
