import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { participants, weeklyData, seasons, distances, milestones } from '../src/db/seed-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.resolve(rootDir, 'data');
const dbFile = process.env.DB_FILE || path.resolve(dataDir, '450k.sqlite');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbFile);
const schema = fs.readFileSync(path.resolve(rootDir, 'src/db/schema.sql'), 'utf8');
db.exec(schema);

const tx = db.transaction(() => {
  db.exec('DELETE FROM strava_tokens; DELETE FROM sync_log; DELETE FROM participants; DELETE FROM weekly_data; DELETE FROM seasons; DELETE FROM distances; DELETE FROM milestones;');

  const pStmt = db.prepare('INSERT INTO participants (id,name,initials,km,steps,streak,weekly_km) VALUES (@id,@name,@initials,@km,@steps,@streak,@weeklyKm)');
  participants.forEach((p) => pStmt.run(p));

  const wStmt = db.prepare('INSERT INTO weekly_data (week,km,steps) VALUES (@week,@km,@steps)');
  weeklyData.forEach((w) => wStmt.run(w));

  const sStmt = db.prepare('INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner) VALUES (@name,@subtitle,@dateRange,@status,@topKm,@totalKm,@participants,@winner)');
  seasons.forEach((s) => sStmt.run(s));

  const dStmt = db.prepare('INSERT INTO distances (km,label,icon,description,gmap_url) VALUES (@km,@label,@icon,@description,@gmapUrl)');
  distances.forEach((d) => dStmt.run(d));

  const mStmt = db.prepare('INSERT INTO milestones (km,reward,icon,color,bg) VALUES (@km,@reward,@icon,@color,@bg)');
  milestones.forEach((m) => mStmt.run(m));
});

tx();
console.log(`DB initialized: ${dbFile}`);
db.close();
