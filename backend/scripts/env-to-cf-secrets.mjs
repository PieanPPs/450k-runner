// คัดค่าลับจาก backend/.env ของ VPS เป็นไฟล์สำหรับ `wrangler secret bulk`
//
//   node backend/scripts/env-to-cf-secrets.mjs <path/to/.env> cf-secrets.env
//   npx wrangler secret bulk cf-secrets.env
//   (แล้วลบ cf-secrets.env ทิ้ง — ไฟล์นี้ถูก .gitignore ไว้แล้ว)
//
// ค่าอื่นใน .env (PORT, DB_FILE, BACKUP_DIR, CORS_ORIGIN, ...) ไม่ใช้บน Cloudflare
// หรือตั้งไว้ใน wrangler.jsonc → vars แล้ว จึงไม่คัดมา (ชื่อซ้ำกับ vars จะ deploy ไม่ผ่าน)
// สคริปต์ไม่พิมพ์ค่าลับออกหน้าจอ — แสดงแค่ชื่อ key
import fs from 'fs';

const KEYS = [
  'STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_CLUB_ID',
  'ADMIN_USER', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET',
  'SEASON_START',
];
const REQUIRED = KEYS.filter(k => k !== 'SEASON_START');

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('ใช้: node backend/scripts/env-to-cf-secrets.mjs <path/to/.env> cf-secrets.env');
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(src, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}

const picked = KEYS.filter(k => env[k]);
const missing = REQUIRED.filter(k => !env[k]);
fs.writeFileSync(out, picked.map(k => `${k}=${env[k]}`).join('\n') + '\n', { mode: 0o600 });

console.log(`เขียน ${out}: ${picked.join(', ')}`);
if (missing.length) console.log(`⚠️ ไม่พบใน .env (ต้องตั้งเอง: npx wrangler secret put <ชื่อ>): ${missing.join(', ')}`);
console.log(`ต่อไป: npx wrangler secret bulk ${out}  แล้วลบไฟล์ ${out}`);
