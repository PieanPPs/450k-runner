import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes      from './routes/auth.js';
import syncRoutes      from './routes/sync.js';
import adminRoutes     from './routes/admin.js';
import { db } from './db/connection.js';

// node-cron (optional — skip gracefully if not installed)
let cron;
try { cron = (await import('node-cron')).default; } catch { cron = null; }

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env manually (no dotenv dependency)
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
  console.log('Loaded .env from', envPath);
}

const PORT        = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Ensure schema exists (idempotent - CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.resolve(__dirname, './db/schema.sql'), 'utf8');
db.exec(schema);

// Ensure gallery folder exists & serve statically at /gallery/<filename>
const galleryDir = path.resolve(__dirname, '../data/gallery');
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
app.use('/gallery', express.static(galleryDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: '450k-runner-backend' });
});

app.use('/api', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/adminpp', adminRoutes);

// ---- weekly snapshot helper ----
function takeWeeklySnapshot() {
  const SEASON_START = process.env.SEASON_START || '2026-06-01';
  const start = new Date(SEASON_START);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now - start) / 86400000));
  const weekNo = Math.max(1, Math.ceil(diffDays / 7));
  const weekLabel = `สัปดาห์ ${weekNo}`;

  // ลบ snapshot ซ้ำของสัปดาห์นี้ก่อน (ถ้า sync หลายครั้งใน 1 อาทิตย์)
  db.prepare('DELETE FROM weekly_snapshots WHERE week_no=?').run(weekNo);

  const participants = db.prepare('SELECT id,name,initials,weekly_km FROM participants ORDER BY weekly_km DESC').all();
  const ins = db.prepare('INSERT INTO weekly_snapshots (week_no,week_label,participant_id,name,initials,km,rank) VALUES (?,?,?,?,?,?,?)');
  db.transaction(() => {
    participants.forEach((p, i) => {
      ins.run(weekNo, weekLabel, p.id, p.name, p.initials, p.weekly_km, i + 1);
    });
  })();
  console.log(`[snapshot] week ${weekNo} saved — ${participants.length} participants`);
}

// ---- auto sync + snapshot every Sunday 23:59 ----
if (cron) {
  cron.schedule('59 23 * * 0', async () => {
    console.log('[cron] Sunday auto-sync starting...');
    try {
      const CLUB_ID = process.env.STRAVA_CLUB_ID;
      const tokenRow = db.prepare('SELECT access_token,refresh_token,expires_at,participant_id FROM strava_tokens LIMIT 1').get();
      if (!tokenRow || !CLUB_ID) { console.log('[cron] skip — no token or CLUB_ID'); return; }

      const { refreshAccessToken, getClubActivitiesByAthlete, calcStats } = await import('./strava/client.js');
      const SEASON_START = process.env.SEASON_START || '2026-06-01';

      let { access_token, refresh_token, expires_at } = tokenRow;
      const nowEpoch = Math.floor(Date.now() / 1000);
      if (expires_at - nowEpoch < 300) {
        const t = await refreshAccessToken(refresh_token);
        access_token = t.access_token; refresh_token = t.refresh_token; expires_at = t.expires_at;
        db.prepare('UPDATE strava_tokens SET access_token=?,refresh_token=?,expires_at=? WHERE participant_id=?')
          .run(access_token, refresh_token, expires_at, tokenRow.participant_id);
      }

      const athleteMap = await getClubActivitiesByAthlete(access_token, CLUB_ID);
      for (const [stravaKey, data] of Object.entries(athleteMap)) {
        const { stravaName, firstname, lastname, activities } = data;
        let p = db.prepare('SELECT id FROM participants WHERE strava_key=?').get(stravaKey);
        if (!p) {
          const initials = (firstname.slice(0,1) + (lastname.slice(0,1)||'')).toUpperCase();
          const info = db.prepare('INSERT INTO participants (name,initials,km,steps,streak,weekly_km,strava_key) VALUES (?,?,0,0,0,0,?)').run(stravaName, initials, stravaKey);
          p = { id: info.lastInsertRowid };
        }
        const stats = calcStats(activities, SEASON_START);
        db.prepare('UPDATE participants SET km=?,steps=?,streak=?,weekly_km=?,activity_count=? WHERE id=?')
          .run(Math.round(stats.km*10)/10, stats.steps, stats.streak, Math.round(stats.weeklyKm*10)/10, stats.activityCount, p.id);
      }
      db.prepare('INSERT INTO sync_log (status,message) VALUES (?,?)').run('ok', '[cron] auto-sync Sunday');
      console.log('[cron] sync done, taking snapshot...');
      takeWeeklySnapshot();
    } catch (err) {
      console.error('[cron] error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });
  console.log('Cron: auto-sync scheduled every Sunday 23:59 (Bangkok)');
} else {
  console.log('node-cron not installed — run: npm install node-cron (in backend folder)');
}

app.listen(PORT, () => {
  console.log('Backend running on http://localhost:' + PORT);
  console.log('  Dashboard : http://localhost:' + PORT + '/api/summary');
  console.log('  Auth      : http://localhost:' + PORT + '/api/auth/status');
  console.log('  Sync      : POST http://localhost:' + PORT + '/api/sync');
});
