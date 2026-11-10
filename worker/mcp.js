import { z } from 'zod';
import { definitions, callTool, serverInstructions } from '../src/tools.js';
import { AppError } from '../src/domain.js';
import { Collaboration, identity } from './collaboration.js';

const projectTool = { name: 'list_projects', description: 'List only the CrossvilleShared projects that the signed-in caller belongs to, including their role and project ID. Create or join projects on the website.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } };
export function toolCatalog() {
  return [projectTool, ...definitions().map(tool => ({ name: tool.name, description: tool.description, inputSchema: z.toJSONSchema(tool.schema), annotations: { readOnlyHint: !!tool.readOnly, destructiveHint: false, idempotentHint: !!tool.idempotent, openWorldHint: false } }))];
}
export async function mcp(message, request, env) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return { jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid JSON-RPC request.' } };
  const reply = result => ({ jsonrpc: '2.0', id: message.id ?? null, result });
  if (message.method === 'server/discover') return reply({ supportedVersions: ['2026-07-28'], capabilities: { tools: {} }, serverInfo: { name: 'CrossvilleShared', version: '0.2.0' }, instructions: serverInstructions });
  if (message.method === 'initialize') return reply({ protocolVersion: message.params?.protocolVersion || '2026-07-28', capabilities: { tools: {} }, serverInfo: { name: 'CrossvilleShared', version: '0.2.0' }, instructions: serverInstructions });
  if (message.method.startsWith('notifications/')) return null;
  if (message.method === 'ping') return reply({});
  if (message.method === 'tools/list') return reply({ tools: toolCatalog() });
  if (message.method !== 'tools/call') return { jsonrpc: '2.0', id: message.id ?? null, error: { code: -32601, message: 'Method not found.' } };
  try {
    const team = new Collaboration(env.DB, identity(request));
    const { name, arguments: args = {} } = message.params || {};
    let result;
    if (name === 'list_projects') result = { projects: await team.projects() };
    else {
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new AppError('Tool arguments must be an object.');
      const { projects, selected } = await team.choose(args.project_id);
      if (!selected) throw new AppError('Create or join a project on the CrossvilleShared website first.', 'PROJECT_REQUIRED', 409);
      if (!args.project_id && projects.length > 1) throw new AppError('Choose a project_id from list_projects so context cannot be taken from the wrong project.', 'PROJECT_REQUIRED', 409);
      result = await team.run(selected, service => callTool(service, name, args));
    }
    return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false });
  } catch (error) {
    const safe = { error: error.status ? error.message : 'The shared workspace could not finish the tool call.', code: error.code || 'INTERNAL_ERROR' };
    return reply({ content: [{ type: 'text', text: JSON.stringify(safe) }], structuredContent: safe, isError: true });
  }
}
