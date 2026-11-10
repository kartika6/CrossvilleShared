import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixture } from './fixture.js';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultDatabase = resolve(projectRoot, '.data/workspace.sqlite');

export class LocalStore {
  constructor(path = process.env.CROSSVILLE_DB || defaultDatabase) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL);');
    const initial = createFixture();
    initial.snapshots.push({ version: initial.project.version, items: initial.items.filter(item => item.status === 'approved') });
    this.db.prepare('INSERT OR IGNORE INTO workspace (id, data) VALUES (1, ?)').run(JSON.stringify(initial));
  }

  read() {
    return JSON.parse(this.db.prepare('SELECT data FROM workspace WHERE id = 1').get().data);
  }

  transaction(operation) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.read();
      const result = operation(state);
      if (result && typeof result.then === 'function') throw new Error('Store transactions must be synchronous.');
      this.db.prepare('UPDATE workspace SET data = ? WHERE id = 1').run(JSON.stringify(state));
      this.db.exec('COMMIT');
      return structuredClone(result);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() { this.db.close(); }
}
