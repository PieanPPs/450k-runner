// Driver สำหรับ VPS (Node) — better-sqlite3 + ไฟล์ SQLite
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openNodeDatabase(dbFile = process.env.DB_FILE || path.resolve(__dirname, '../../data/450k.sqlite')) {
  const raw = new Database(dbFile);
  raw.pragma('journal_mode = WAL');

  const runOne = (sql, params) => {
    const info = raw.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
  };

  const driver = {
    get: async (sql, params) => raw.prepare(sql).get(...params) ?? undefined,
    all: async (sql, params) => raw.prepare(sql).all(...params),
    run: async (sql, params) => runOne(sql, params),
    batch: async (stmts) => raw.transaction(() => stmts.map(s => runOne(s.sql, s.params)))(),
    exec: async (sql) => { raw.exec(sql); },
  };
  return { raw, driver };
}
