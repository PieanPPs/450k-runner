import { db } from '../db/connection.js';

function setting(key) {
  return db.prepare('SELECT value FROM project_settings WHERE key=?').get(key)?.value;
}

export function getSeasonStart() {
  return setting('season_start') || process.env.SEASON_START || '2026-06-01';
}

// หลัง close-season จนกว่าจะ start-season ใหม่ → ยังไม่มี season เปิดอยู่
export function isSeasonClosed() {
  return setting('season_closed') === '1';
}

// season ปัจจุบัน = active ล่าสุด ไม่งั้นใช้ season ล่าสุด
export function currentSeasonId() {
  const row = db.prepare("SELECT id FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1").get()
    || db.prepare('SELECT id FROM seasons ORDER BY id DESC LIMIT 1').get();
  return row?.id ?? null;
}

// กิจกรรมใหม่ที่ sync เข้ามาควรเป็น baseline (ไม่นับ km) หรือไม่
// - ก่อนวันเริ่ม season → baseline
// - ช่วงที่ season ถูกปิดแล้วแต่ยังไม่เริ่มใหม่ → baseline (start-season จะปลดให้เองถ้าวันที่ >= season_start)
// actDate = 'YYYY-MM-DD HH:MM:SS' (เวลาไทย)
export function baselineFlagFor(actDate, seasonStart = getSeasonStart(), closed = isSeasonClosed()) {
  return closed || actDate.slice(0, 10) < seasonStart ? 1 : 0;
}
