import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LocalStore, projectRoot } from './store.js';
import { ContextService } from './service.js';
import { AppError } from './domain.js';
import { callTool } from './tools.js';

export function createWebServer({ store = new LocalStore(), port = Number(process.env.CROSSVILLE_PORT || 4317) } = {}) {
  const service = new ContextService(store);
  const session = randomBytes(32).toString('hex');
  const routes = new Map([
    ['/api/handoffs', input => service.prepareHandoff(input)],
    ['/api/handoffs/confirm', input => service.confirmHandoff(input)],
    ['/api/handoffs/cancel', input => service.cancelHandoff(input)],
    ['/api/proposals/prepare', input => service.prepareProposal(input)],
    ['/api/proposals/submit', input => service.submitProposal(input)],
    ['/api/proposals/review', input => service.reviewProposal(input)],
    ['/api/tools/call', input => callTool(service, input.name, input.arguments)]
  ]);
  const server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new AppError('Use the local connector address.', 'FORBIDDEN', 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new AppError('Requests must come from the local connector.', 'FORBIDDEN', 403);
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/healthz') return send(200, { status: 'ok', mode: 'local_fictional' });
      if (req.method === 'GET' && url.pathname === '/api/workspace') return send(200, service.workspace());
      if (req.method === 'GET' && url.pathname === '/api/connection') return send(200, {
        command: process.execPath, args: [resolve(projectRoot, 'src/mcp-server.js')],
        config: `[mcp_servers.crossville_shared]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(resolve(projectRoot, 'src/mcp-server.js'))}]\n`,
        projectRoot, connectedToLiveTeam: false
      });
      if (req.method === 'POST' && routes.has(url.pathname)) {
        if (req.headers['x-crossville-session'] !== session) throw new AppError('Refresh the connector before trying again.', 'SESSION_EXPIRED', 403);
        if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('Expected a JSON request.');
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 32000) throw new AppError('The request is too large.', 'TOO_LARGE', 413); chunks.push(chunk); }
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('The request was not valid JSON.'); }
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Expected a JSON object.');
        return send(200, await routes.get(url.pathname)(input));
      }
      if (req.method === 'GET') {
        const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
        const asset = assets[url.pathname];
        if (asset) {
          let body = await readFile(resolve(projectRoot, 'public', asset[0]), 'utf8');
          if (url.pathname === '/') body = body.replace('__SESSION__', session);
          res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }); return res.end(body);
        }
      }
      send(404, { error: 'This page was not found.', code: 'NOT_FOUND' });
    } catch (error) {
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'The connector could not finish this request. Try again.', code: error.code || 'INTERNAL_ERROR', details: error.details || {} });
      else res.end();
      if (!error.status) console.error(error);
    }
  });
  return { server, service, store, port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server, port } = createWebServer();
  server.on('error', error => { console.error(`CrossvilleShared could not start: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`CrossvilleShared · http://127.0.0.1:${port} · local fictional data`));
}
