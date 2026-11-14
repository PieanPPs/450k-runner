// สำรองฐานข้อมูล D1 (production) เป็นไฟล์ .sql ในเครื่องนี้ — เสริมจาก D1 Time Travel ที่ย้อนได้แค่ 7 วัน (แพ็กเกจฟรี)
//
//   npm run backup:d1                       → เก็บที่ ../450k-backups (นอกโฟลเดอร์ repo เพราะมีชื่อ-ข้อมูลส่วนตัว)
//   node backend/scripts/backup-d1.mjs [โฟลเดอร์] [--keep 30] [--local]
//
// ต้อง login wrangler แล้ว (npx wrangler login) — ใช้ `wrangler d1 export` ซึ่งทำให้ D1 ตอบ query ไม่ได้ชั่วครู่ระหว่าง export
// (ฐานข้อมูลหลัก MB จึงใช้เวลาไม่กี่วินาที) --local ใช้ D1 จำลองใน .wrangler/ สำหรับทดสอบสคริปต์
// เก็บล่าสุด --keep ไฟล์ (ค่าเริ่มต้น 30) ลบเฉพาะไฟล์ชื่อ 450k-d1-*.sql ในโฟลเดอร์นั้น
// คืน exit code ≠ 0 เมื่อ export ล้มเหลวหรือไฟล์ที่ได้ผิดปกติ (ไม่ลบไฟล์เก่าในกรณีนี้)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DB_NAME = '450k-runner';
const PREFIX = '450k-d1-';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const keepIdx = args.indexOf('--keep');
const keep = keepIdx >= 0 ? Number(args[keepIdx + 1]) : 30;
const local = flag('--local');
const dirArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--keep');
const outDir = path.resolve(dirArg || path.join(root, '..', '450k-backups'));

if (!Number.isInteger(keep) || keep < 1) {
  console.error('❌ --keep ต้องเป็นจำนวนเต็ม ≥ 1');
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${PREFIX}${stamp}${local ? '-local' : ''}.sql`);

console.log(`สำรอง D1 "${DB_NAME}" (${local ? 'local' : 'remote'}) → ${outFile}`);
const r = spawnSync('npx', ['wrangler', 'd1', 'export', DB_NAME, local ? '--local' : '--remote', '--output', outFile],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) {
  console.error(`❌ export ไม่สำเร็จ (exit ${r.status}) — ถ้าขึ้นว่าไม่ได้ login ให้รัน: npx wrangler login`);
  fs.rmSync(outFile, { force: true });
  process.exit(1);
}

// ตรวจไฟล์ที่ได้: ไม่ว่าง และมีโครงสร้าง + ข้อมูลของตารางหลัก
const sql = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
const tables = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)["`]?/gi)].map(m => m[1]);
const inserts = (sql.match(/^INSERT INTO /gim) || []).length;
const required = ['participants', 'strava_activities', 'project_settings'];
const missing = required.filter(t => !tables.includes(t));
if (!sql.length || missing.length || inserts === 0) {
  console.error(`❌ ไฟล์สำรองผิดปกติ (ขนาด ${sql.length} ไบต์, ตาราง ${tables.length}, INSERT ${inserts}${missing.length ? `, ขาดตาราง: ${missing.join(', ')}` : ''}) — ไม่ลบไฟล์เก่า`);
  process.exit(1);
}
console.log(`✅ สำเร็จ: ${(sql.length / 1024).toFixed(0)} KB · ${tables.length} ตาราง · ${inserts} แถว`);

// เก็บล่าสุด N ไฟล์ (ชื่อมีวันที่ เรียงตามตัวอักษร = เรียงตามเวลา) — แยกชุด local กับ remote
const suffix = local ? '-local.sql' : '.sql';
const mine = fs.readdirSync(outDir)
  .filter(f => f.startsWith(PREFIX) && f.endsWith(suffix) && (local || !f.endsWith('-local.sql')))
  .sort();
for (const old of mine.slice(0, Math.max(0, mine.length - keep))) {
  fs.rmSync(path.join(outDir, old));
  console.log(`ลบไฟล์เก่า: ${old}`);
}
