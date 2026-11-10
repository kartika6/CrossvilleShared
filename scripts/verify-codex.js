import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { projectRoot } from '../src/store.js';

const directory = mkdtempSync(join(tmpdir(), 'crossville-model-check-'));
const binary = process.env.CROSSVILLE_CODEX_BIN || '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex';
const prompt = 'This is a bounded integration test with a fictional project. Use only the CrossvilleShared MCP get_team_context tool, with task "Plan the pilot study schedule" and mode "auto". Do not use shell, filesystem, browser, other services or write any proposals. After receiving the actual tool result, answer in three short lines: the context version; the approved pilot duration; and the required data privacy constraint. Do not invent a tool result.';
const args = ['exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--json',
  '-c', `mcp_servers.crossville_shared.command=${JSON.stringify(process.execPath)}`,
  '-c', `mcp_servers.crossville_shared.args=${JSON.stringify([resolve(projectRoot, 'src/mcp-server.js')])}`,
  '-c', `mcp_servers.crossville_shared.env.CROSSVILLE_DB=${JSON.stringify(join(directory, 'workspace.sqlite'))}`,
  prompt];
let output = '';
const child = spawn(binary, args, { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => { output += data; process.stdout.write(data); });
child.stderr.on('data', data => process.stderr.write(data));
child.on('error', error => { console.error(error.message); rmSync(directory, { recursive: true, force: true }); process.exitCode = 1; });
const timeout = setTimeout(() => child.kill('SIGTERM'), 90000);
child.on('close', code => {
  clearTimeout(timeout);
  mkdirSync(resolve(projectRoot, 'artifacts'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'artifacts/codex-smoke.jsonl'), output);
  rmSync(directory, { recursive: true, force: true });
  const events = output.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const call = events.find(event => event.type === 'item.completed' && event.item?.type === 'mcp_tool_call' && event.item.tool === 'get_team_context' && event.item.status === 'completed' && !event.item.error);
  const answer = events.filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message').at(-1)?.item.text || '';
  const passed = code === 0 && Boolean(call) && answer.includes('14 days') && /version[^\n]*2/i.test(answer) && /fictional/i.test(answer);
  writeFileSync(resolve(projectRoot, 'artifacts/codex-verification.json'), JSON.stringify({ passed, verifiedAt: new Date().toISOString(), tool: call?.item.tool || null, mode: 'isolated_fictional_data', expectedVersion: 2, expectedDurationDays: 14, answer }, null, 2));
  if (!passed) console.error('The live model check did not satisfy all expected evidence. Inspect artifacts/codex-smoke.jsonl.');
  process.exitCode = passed ? 0 : 1;
});
