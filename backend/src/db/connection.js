import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = process.env.DB_FILE || path.resolve(__dirname, '../../data/450k.sqlite');

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
