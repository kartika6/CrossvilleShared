import assets from 'virtual:assets';
import { createFixture } from '../src/fixture.js';
import { ContextService } from '../src/service.js';
import { MemoryStore } from '../src/memory-store.js';
import { AppError } from '../src/domain.js';
import { callTool } from '../src/tools.js';

const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });

async function readWorkspace(env, userId) {
  if (!env.DB) throw new AppError('The hosted workspace database is not available.', 'STORAGE_UNAVAILABLE', 503);
  const initial = createFixture();
  initial.ownerId = userId;
  initial.csrfToken = crypto.randomUUID() + crypto.randomUUID();
  initial.snapshots.push({ version: initial.project.version, items: initial.items.filter(item => item.status === 'approved') });
  await env.DB.prepare('INSERT OR IGNORE INTO hosted_workspace (id, data, revision) VALUES (?, ?, 0)').bind('fictional-project', JSON.stringify(initial)).run();
  const row = await env.DB.prepare('SELECT data, revision FROM hosted_workspace WHERE id = ?').bind('fictional-project').first();
  if (!row) throw new AppError('The hosted workspace could not be loaded.', 'STORAGE_UNAVAILABLE', 503);
  return { state: JSON.parse(row.data), revision: row.revision };
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      // Sites provides and validates these headers before forwarding a request.
      const userId = request.headers.get('oai-authenticated-user-id');
      if (!userId) return json(401, { error: 'Sign in to open this private prototype.', code: 'UNAUTHENTICATED' });
      if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json(403, { error: 'Use the prototype from its own page.', code: 'FORBIDDEN' });
      if (request.method === 'GET' && assets[url.pathname] && url.pathname !== '/') return new Response(assets[url.pathname].body, { headers: { ...headers, 'Content-Type': assets[url.pathname].type } });
      const { state, revision } = await readWorkspace(env, userId);
      const actor = { id: userId, name: 'You', role: state.ownerId === userId ? 'owner' : 'viewer' };
      const store = new MemoryStore(state);
      const service = new ContextService(store, actor);
      if (request.method === 'GET' && url.pathname === '/') {
        const html = assets['/'].body.replace('__SESSION__', state.csrfToken)
          .replace('Local prototype · fictional project data', 'Private hosted prototype · fictional project data')
          .replace('Your local workspace', 'Your private workspace');
        return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
      }
      if (request.method === 'GET' && url.pathname === '/healthz') return json(200, { status: 'ok', mode: 'hosted_fictional' });
      if (request.method === 'GET' && url.pathname === '/api/workspace') {
        const workspace = service.workspace();
        workspace.mode = 'hosted_fictional';
        workspace.capabilities.sharedBackend = 'Hosted fictional project';
        return json(200, workspace);
      }
      if (request.method === 'GET' && url.pathname === '/api/connection') return json(200, {
        hosted: true, connectedToLiveTeam: false,
        repositoryUrl: 'https://github.com/kartika6/CrossvilleShared',
        message: 'The published preview uses a hosted fictional workspace. The local MCP server uses its own local SQLite workspace. They are not synchronized; a member-authenticated backend adapter is the next step.'
      });
      const actions = {
        '/api/handoffs': input => service.prepareHandoff(input), '/api/handoffs/confirm': input => service.confirmHandoff(input), '/api/handoffs/cancel': input => service.cancelHandoff(input),
        '/api/proposals/prepare': input => service.prepareProposal(input), '/api/proposals/submit': input => service.submitProposal(input), '/api/proposals/review': input => service.reviewProposal(input),
        '/api/tools/call': input => callTool(service, input.name, input.arguments)
      };
      if (request.method !== 'POST' || !actions[url.pathname]) return json(404, { error: 'This page was not found.', code: 'NOT_FOUND' });
      if (request.headers.get('X-Crossville-Session') !== state.csrfToken) return json(403, { error: 'Refresh the prototype before trying again.', code: 'SESSION_EXPIRED' });
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new AppError('Expected a JSON request.');
      const reader = request.body?.getReader();
      if (!reader) throw new AppError('Expected a JSON request body.');
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length; if (size > 32000) { await reader.cancel(); throw new AppError('The request is too large.', 'TOO_LARGE', 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let input;
      try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError('The request was not valid JSON.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Expected a JSON object.');
      const result = await actions[url.pathname](input);
      const update = await env.DB.prepare('UPDATE hosted_workspace SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(JSON.stringify(store.state), 'fictional-project', revision).run();
      if (update.meta.changes !== 1) return json(409, { error: 'Another request changed the workspace. Refresh and review before retrying.', code: 'STALE_CONTEXT' });
      return json(200, result);
    } catch (error) {
      if (!error.status) console.error('CrossvilleShared worker error', error.message);
      return json(error.status || 500, { error: error.status ? error.message : 'The hosted prototype could not finish this request. Refresh and try again.', code: error.code || 'INTERNAL_ERROR' });
    }
  }
};
