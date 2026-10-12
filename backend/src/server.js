// Entry สำหรับ VPS (Node + better-sqlite3 + node-cron)
// Cloudflare ใช้ src/worker.js แทน — routes/logic ใช้ร่วมกันผ่าน app.js
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const { openNodeDatabase }  = await import('./db/driver-node.js');
const { runNodeMigrations } = await import('./db/migrate-node.js');
const { setDbDriver }       = await import('./lib/db.js');
const { setPlatform }       = await import('./lib/platform.js');
const { createFileBackup, createDailyBackup, createDiskFiles } = await import('./lib/backup.js');
const { migrateSeasonState, runSeasonLifecycle } = await import('./lib/seasonLifecycle.js');
const { runSixHourly, runDaily } = await import('./lib/jobs.js');
const { createApp }         = await import('./app.js');

// ── Database + migrations ───────────────────────────────
const { raw, driver } = openNodeDatabase();
setDbDriver(driver);
runNodeMigrations(raw);

setPlatform({
  backup: createFileBackup(raw),
  files: createDiskFiles(path.resolve(__dirname, '../data/gallery')),
});

// ระบบเดิมยังไม่มี season_closed → เดาสถานะครั้งแรก แล้วขยับ season ตามวันที่ทันทีตอนเปิดเซิร์ฟเวอร์
await migrateSeasonState();
runSeasonLifecycle('startup').catch(err => console.error('[season:startup] error:', err.message));

// ── HTTP ────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 4000);
const app = createApp();
app.listen(PORT, () => {
  console.log('Backend running on http://localhost:' + PORT);
  console.log('  Dashboard : http://localhost:' + PORT + '/api/summary');
  console.log('  Auth      : http://localhost:' + PORT + '/api/auth/status');
  console.log('  Sync      : POST http://localhost:' + PORT + '/api/sync');
});

// ── Cron (node-cron optional — skip gracefully if not installed) ──
let cron;
try { cron = (await import('node-cron')).default; } catch { cron = null; }

if (cron) {
  const dailyBackup = createDailyBackup(raw);
  cron.schedule('0 */6 * * *', () => runSixHourly('cron-6h'), { timezone: 'Asia/Bangkok' });
  cron.schedule('59 23 * * *', () => runDaily({ label: 'cron-daily', dailyBackup }), { timezone: 'Asia/Bangkok' });
  console.log('Cron: season lifecycle + sync every 6h | daily sync+backup at 23:59 | weekly snapshot on Sunday (Bangkok)');
} else {
  console.log('node-cron not installed — run: npm install node-cron (in backend folder)');
}
