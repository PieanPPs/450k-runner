import { db } from '../db/connection.js';

export function getSetting(key) {
  return db.prepare('SELECT value FROM project_settings WHERE key=?').get(key)?.value;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO project_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, String(value));
}

// ค่าที่ระบบ season จัดการเอง — ห้ามแก้ผ่านหน้า "ตั้งค่าโครงการ" (PUT /settings)
export const INTERNAL_SEASON_KEYS = ['season_closed', 'last_frozen_through', 'next_season', 'current_season_id'];

export function getSeasonStart() {
  return getSetting('season_start') || process.env.SEASON_START || '2026-06-01';
}

export function getSeasonEnd() {
  return getSetting('season_end') || null;
}

// หลัง close-season จนกว่าจะ start-season ใหม่ → ยังไม่มี season เปิดอยู่
export function isSeasonClosed() {
  return getSetting('season_closed') === '1';
}

// season ปัจจุบัน = แถวที่ start-season สร้างล่าสุด (current_season_id)
// ถ้าไม่มี → active ล่าสุด → season ล่าสุด
export function currentSeasonId() {
  const pinned = Number(getSetting('current_season_id'));
  if (pinned && db.prepare('SELECT id FROM seasons WHERE id=?').get(pinned)) return pinned;
  const row = db.prepare("SELECT id FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1").get()
    || db.prepare('SELECT id FROM seasons ORDER BY id DESC LIMIT 1').get();
  return row?.id ?? null;
}

// ช่วงที่นับ km ของ season ปัจจุบัน — อ่านครั้งเดียวต่อ sync
export function getSeasonWindow() {
  return { start: getSeasonStart(), end: getSeasonEnd(), closed: isSeasonClosed() };
}

// กิจกรรมใหม่ที่ sync เข้ามาควรเป็น baseline (ไม่นับ km) หรือไม่
// - ก่อนวันเริ่ม หรือหลังวันสิ้นสุด season → baseline
// - ช่วงที่ season ถูกปิดแล้ว → baseline (start-season จะปลดให้เองถ้าวันที่อยู่ในช่วง season ใหม่)
// actDate = 'YYYY-MM-DD HH:MM:SS' (เวลาไทย)
export function baselineFlagFor(actDate, win = getSeasonWindow()) {
  const day = actDate.slice(0, 10);
  if (win.closed) return 1;
  if (day < win.start) return 1;
  if (win.end && day > win.end) return 1;
  return 0;
}
