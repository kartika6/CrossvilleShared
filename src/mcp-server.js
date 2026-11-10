import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { LocalStore } from './store.js';
import { ContextService } from './service.js';
import { definitions, serverInstructions } from './tools.js';

const store = new LocalStore();
const service = new ContextService(store);

serveStdio(() => {
  const server = new McpServer({ name: 'CrossvilleShared', version: '0.1.0' }, { instructions: serverInstructions });
  for (const tool of definitions(service)) {
    server.registerTool(tool.name, {
      description: tool.description, inputSchema: tool.schema,
      annotations: { readOnlyHint: Boolean(tool.readOnly), destructiveHint: false, idempotentHint: Boolean(tool.idempotent || tool.readOnly), openWorldHint: false }
    }, async input => {
      try {
        const result = await tool.run(input);
        return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: error.message, code: error.code || 'INTERNAL_ERROR', details: error.details || {} }) }] };
      }
    });
  }
  return server;
});

console.error('CrossvilleShared MCP ready · local fictional workspace · no live team connection');
