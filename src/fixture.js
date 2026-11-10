export function createFixture() {
  const source = (author, label) => ({ author, label, type: 'fictional_shared_record' });
  return {
    schemaVersion: 1,
    project: { id: 'shared-context-study', name: 'Shared Context Study', version: 2 },
    items: [
      { id: 'project-goal', kind: 'brief', title: 'One shared context. Individual thinking.', text: 'Study how a small research team keeps separate AI conversations aligned with reviewed project decisions.', claimKey: 'project.goal', strength: 'default', status: 'approved', revision: 1, tags: ['research', 'team', 'project', 'study'], source: source('Alex', 'Fictional project brief') },
      { id: 'pilot-duration', kind: 'decision', title: 'Run a two-week pilot', text: 'The approved pilot lasts two weeks (14 days). Use this duration when making the study schedule.', claimKey: 'pilot.duration', strength: 'default', status: 'approved', revision: 2, tags: ['pilot', 'schedule', 'plan', 'timeline', 'duration', 'week', 'study'], source: source('Sam', 'Fictional reviewer decision') },
      { id: 'data-boundary', kind: 'constraint', title: 'Use fictional participant data', text: 'Use fictional participants and sample project data. Do not collect identifying personal information during this prototype.', claimKey: 'data.privacy', strength: 'must', status: 'approved', revision: 1, tags: ['privacy', 'participant', 'data', 'prototype', 'study'], source: source('Professor', 'Fictional study constraint') },
      { id: 'study-method', kind: 'decision', title: 'Reflect after each collaboration session', text: 'Keep a short reflection after each collaboration session: what changed, which context was useful, and what needed correction.', claimKey: 'study.method', strength: 'default', status: 'approved', revision: 1, tags: ['method', 'reflection', 'session', 'research', 'evaluation'], source: source('Alex', 'Fictional methodology discussion') },
      { id: 'evaluation-question', kind: 'question', title: 'How much context is enough?', text: 'How much shared context helps a personal AI conversation without overwhelming its current task?', claimKey: 'evaluation.context', strength: 'default', status: 'approved', revision: 1, tags: ['evaluate', 'evaluation', 'context', 'question', 'measure'], source: source('Sam', 'Fictional open question') },
      { id: 'old-duration', kind: 'decision', title: 'Earlier three-week idea', text: 'Consider a three-week pilot.', claimKey: 'pilot.duration', strength: 'default', status: 'superseded', revision: 1, tags: ['pilot', 'schedule'], source: source('Alex', 'Fictional superseded draft') }
    ],
    handoffs: [], drafts: [], proposals: [],
    events: [{ id: 'fixture-created', type: 'workspace_created', version: 2, at: '2026-11-09T12:00:00.000Z', summary: 'Fictional workspace prepared for a local test.' }],
    snapshots: []
  };
}
