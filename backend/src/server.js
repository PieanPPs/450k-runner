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
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure schema exists (idempotent - CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.resolve(__dirname, './db/schema.sql'), 'utf8');
db.exec(schema);

// Migration: เพิ่ม is_baseline
try {
  db.prepare('ALTER TABLE strava_activities ADD COLUMN is_baseline INTEGER NOT NULL DEFAULT 0').run();
  console.log('[migration] added is_baseline column to strava_activities');
} catch { /* column มีอยู่แล้ว — ข้ามได้ */ }

// Migration: เพิ่ม age_group
try {
  db.prepare("ALTER TABLE participants ADD COLUMN age_group TEXT NOT NULL DEFAULT 'general'").run();
  console.log('[migration] added age_group column to participants');
} catch { /* column มีอยู่แล้ว — ข้ามได้ */ }

// Migration: credited_km — km ที่ admin ปรับแล้ว (ตัด commute ออก)
// NULL = ใช้ distance_km เต็ม | เลข = ใช้ค่านี้แทน
try {
  db.prepare('ALTER TABLE strava_activities ADD COLUMN credited_km REAL').run();
  console.log('[migration] added credited_km column to strava_activities');
} catch { /* column มีอยู่แล้ว — ข้ามได้ */ }

// Migration: moving_time — เวลาเคลื่อนที่จริง (ตัดเวลาหยุดออก) ใช้คำนวณ pace
// DEFAULT 0 → ถ้า 0 ให้ fallback ใช้ elapsed_time แทน (ข้อมูลเก่า)
try {
  db.prepare('ALTER TABLE strava_activities ADD COLUMN moving_time INTEGER NOT NULL DEFAULT 0').run();
  console.log('[migration] added moving_time column to strava_activities');
} catch { /* column มีอยู่แล้ว — ข้ามได้ */ }

// Migration: ถังขยะ — เก็บ activity ที่ถูกลบไว้ก่อน ป้องกันลบพลาด
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS deleted_activities (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      original_id  INTEGER,
      strava_key   TEXT,
      activity_hash TEXT,
      distance_km  REAL,
      credited_km  REAL,
      elapsed_time INTEGER,
      activity_name TEXT,
      first_seen   TEXT,
      is_baseline  INTEGER DEFAULT 0,
      deleted_at   TEXT
    )
  `).run();
  console.log('[migration] created deleted_activities table (recycle bin)');
} catch { /* already exists */ }

// Ensure gallery folder exists & serve statically at /gallery/<filename>
const galleryDir = path.resolve(__dirname, '../data/gallery');
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
app.use('/gallery', express.static(galleryDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: '450k-runner-backend' });
});

// Public settings endpoint (no auth required — used by frontend About section)
app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key,value FROM project_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

app.use('/api', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/adminpp', adminRoutes);

// ---- helpers ----
function getSeasonStart() {
  const row = db.prepare("SELECT value FROM project_settings WHERE key='season_start'").get();
  return row?.value || process.env.SEASON_START || '2026-06-01';
}

// ---- weekly snapshot helper ----
function takeWeeklySnapshot() {
  const SEASON_START = getSeasonStart();
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

// ---- shared cron sync logic ----
async function runAutoSync(label = 'cron') {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  const tokenRow = db.prepare('SELECT access_token,refresh_token,expires_at,participant_id FROM strava_tokens LIMIT 1').get();
  if (!tokenRow || !CLUB_ID) { console.log(`[${label}] skip — no token or CLUB_ID`); return; }

  const { refreshAccessToken, getClubActivitiesByAthlete } = await import('./strava/client.js');

  let { access_token, refresh_token, expires_at } = tokenRow;
  const nowEpoch = Math.floor(Date.now() / 1000);
  if (expires_at - nowEpoch < 300) {
    const t = await refreshAccessToken(refresh_token);
    access_token = t.access_token; refresh_token = t.refresh_token; expires_at = t.expires_at;
    db.prepare('UPDATE strava_tokens SET access_token=?,refresh_token=?,expires_at=? WHERE participant_id=?')
      .run(access_token, refresh_token, expires_at, tokenRow.participant_id);
  }

  const athleteMap = await getClubActivitiesByAthlete(access_token, CLUB_ID);
  const insActivity = db.prepare(`
    INSERT INTO strava_activities (strava_key,activity_hash,distance_km,elapsed_time,moving_time,activity_name,first_seen,is_baseline)
    VALUES (?,?,?,?,?,?,?,0)
    ON CONFLICT(activity_hash) DO UPDATE SET first_seen = MIN(first_seen, excluded.first_seen)
  `);
  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');

  for (const [stravaKey, data] of Object.entries(athleteMap)) {
    const { stravaName, firstname, lastname, activities } = data;
    let p = db.prepare('SELECT id FROM participants WHERE strava_key=?').get(stravaKey);
    if (!p) {
      const initials = (firstname.slice(0,1) + (lastname.slice(0,1)||'')).toUpperCase();
      const info = db.prepare('INSERT INTO participants (name,initials,km,steps,streak,weekly_km,strava_key) VALUES (?,?,0,0,0,0,?)').run(stravaName, initials, stravaKey);
      p = { id: info.lastInsertRowid };
    }
    const batchSeen = []; // in-batch dedup: phone vs smartwatch ใน sync เดียวกัน
    for (const act of activities) {
      const distKm  = (act.distance||0)/1000;
      const elapsed = act.elapsed_time||0;
      const moving  = act.moving_time||0;
      let actDate = thaiNow;
      if (act.start_date_local) {
        const d = act.start_date_local.replace('T',' ').slice(0,19);
        actDate = d < thaiNow ? d : thaiNow; // ป้องกัน future date
      }
      const hash = `${stravaKey}|${act.distance}|${act.elapsed_time}|${act.name || ''}`;

      // ── ตรวจถังขยะก่อน — ถ้า admin เคยลบไว้ → ข้ามเสมอ (ไม่ insert คืน)
      const inTrash = db.prepare(
        'SELECT id FROM deleted_activities WHERE activity_hash=? OR (strava_key=? AND ABS(distance_km-?)<0.1 AND ABS(elapsed_time-?)<=60)'
      ).get(hash, stravaKey, distKm, elapsed);
      if (inTrash) continue;

      // in-batch dedup: phone vs smartwatch บันทึก run เดียวกัน → ปรากฏใน batch เดียวกัน
      // ไม่ query DB → ไม่บล็อกคนวิ่ง route เดิมคนละวัน
      const inBatch = batchSeen.some(s => Math.abs(s.distKm - distKm) < 0.1 && Math.abs(s.elapsed - elapsed) <= 60);
      if (inBatch) continue;
      batchSeen.push({ distKm, elapsed });

      insActivity.run(stravaKey, hash, distKm, elapsed, moving, act.name||'', actDate);
    }
    // คำนวณ km, weekly_km
    const seasonRow = db.prepare('SELECT COALESCE(SUM(distance_km),0) as km, COUNT(*) as cnt FROM strava_activities WHERE strava_key=? AND is_baseline=0').get(stravaKey);
    const totalKm  = Math.round(seasonRow.km * 100) / 100;
    const steps    = Math.round(totalKm * 1350);
    // weekly km — จันทร์ถึงอาทิตย์ปัจจุบัน (calendar week ตรงกับ Strava)
    const nowBkk2    = new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Bangkok' }));
    const dow2       = nowBkk2.getDay();
    const dFromMon2  = dow2 === 0 ? 6 : dow2 - 1;
    const wStart2    = new Date(nowBkk2);
    wStart2.setDate(nowBkk2.getDate() - dFromMon2);
    wStart2.setHours(0, 0, 0, 0);
    const weekStr  = wStart2.toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ').slice(0,19);
    const weekRow  = db.prepare('SELECT COALESCE(SUM(distance_km),0) as km FROM strava_activities WHERE strava_key=? AND is_baseline=0 AND first_seen >= ?').get(stravaKey, weekStr);
    const weeklyKm = Math.round(weekRow.km * 100) / 100;
    // คำนวณ streak จาก first_seen (Strava Club API ไม่มีวันจริง)
    const seenDates = db.prepare('SELECT DISTINCT substr(first_seen,1,10) as day FROM strava_activities WHERE strava_key=? AND is_baseline=0').all(stravaKey).map(r => r.day);
    const dateSet = new Set(seenDates);
    let streak = 0;
    const todayD = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(todayD); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dateSet.has(key)) { streak++; }
      else if (i === 0) { continue; }
      else { break; }
    }
    db.prepare('UPDATE participants SET km=?,steps=?,weekly_km=?,streak=?,activity_count=? WHERE id=?')
      .run(totalKm, steps, weeklyKm, streak, seasonRow.cnt, p.id);
  }
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)').run(thaiNow, 'ok', `[${label}] auto-sync`);
  console.log(`[${label}] sync done — ${Object.keys(athleteMap).length} athletes`);
}

// ---- daily backup helper ----
async function dailyBackup() {
  const backupDir = process.env.BACKUP_DIR || '/app/data/backups';
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts   = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' })
                         .replace(/[: ]/g, '-').slice(0, 19);
  const dest = path.join(backupDir, `daily_${ts}.sqlite`);
  await db.backup(dest);
  // เก็บ daily backup ไว้ 90 ไฟล์ (3 เดือน)
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('daily_') && f.endsWith('.sqlite'))
    .sort();
  if (files.length > 90) {
    files.slice(0, files.length - 90).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
  }
  console.log(`[backup] daily backup saved: ${dest}`);
}

// ---- cron schedule ----
if (cron) {
  // sync ทุก 6 ชั่วโมง: 00:00, 06:00, 12:00, 18:00
  cron.schedule('0 */6 * * *', async () => {
    try { await runAutoSync('cron-6h'); }
    catch (err) { console.error('[cron-6h] error:', err.message); }
  }, { timezone: 'Asia/Bangkok' });

  // ทุกคืน 23:59 — sync สุดท้ายของวัน + backup รายวัน
  cron.schedule('59 23 * * *', async () => {
    console.log('[cron] daily end-of-day sync + backup...');
    try {
      await runAutoSync('cron-daily');
      await dailyBackup();
      // วันอาทิตย์ → เพิ่ม weekly snapshot
      if (new Date().getDay() === 0) {
        takeWeeklySnapshot();
        console.log('[cron] Sunday weekly snapshot done');
      }
    } catch (err) { console.error('[cron-daily] error:', err.message); }
  }, { timezone: 'Asia/Bangkok' });

  console.log('Cron: sync every 6h | daily sync+backup at 23:59 | weekly snapshot on Sunday (Bangkok)');
} else {
  console.log('node-cron not installed — run: npm install node-cron (in backend folder)');
}

app.listen(PORT, () => {
  console.log('Backend running on http://localhost:' + PORT);
  console.log('  Dashboard : http://localhost:' + PORT + '/api/summary');
  console.log('  Auth      : http://localhost:' + PORT + '/api/auth/status');
  console.log('  Sync      : POST http://localhost:' + PORT + '/api/sync');
});
