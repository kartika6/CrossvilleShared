import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('actual MCP client discovers and calls context, preview and proposal tools', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'crossville-mcp-'));
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('src/mcp-server.js')], env: { ...process.env, CROSSVILLE_DB: join(dir, 'test.sqlite') }, stderr: 'pipe' });
  const client = new Client({ name: 'crossville-test', version: '1.0.0' });
  t.after(async () => { await client.close(); rmSync(dir, { recursive: true, force: true }); });
  await client.connect(transport);
  const { tools } = await client.listTools(); assert.equal(tools.length, 6);
  const result = await client.callTool({ name: 'get_team_context', arguments: { task: 'Plan the pilot schedule', mode: 'auto' } });
  assert(!result.isError); const packet = result.structuredContent || JSON.parse(result.content[0].text);
  assert.equal(packet.status, 'ready'); assert.equal(packet.projectVersion, 2); assert(packet.text.includes('14 days'));
  const preview = await client.callTool({ name: 'get_team_context', arguments: { task: 'Plan the pilot schedule', mode: 'preview' } });
  const pending = preview.structuredContent || JSON.parse(preview.content[0].text);
  assert.equal(pending.status, 'awaiting_review');
  const confirmed = await client.callTool({ name: 'confirm_handoff', arguments: { packet_id: pending.id, selected_ids: pending.items.map(item => item.id), personal_note: 'Focus on evaluation.' } });
  assert(!confirmed.isError);
  const bad = await client.callTool({ name: 'get_team_context', arguments: { task: 'Plan the pilot', known_version: 100 } });
  assert.equal(bad.isError, true); assert(bad.content[0].text.includes('Known version'));
});
